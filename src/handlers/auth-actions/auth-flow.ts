/**
 * OAuth authentication flow handlers - login, callback, logout
 */

import type { OAuth2Client } from 'google-auth-library';
import type { GoogleApiClient } from '../../services/google-api.js';
import type { AuthResponse, AuthLoginInput, AuthCallbackInput } from '../../schemas/auth.js';
import { getRecommendedScopes } from '../../config/oauth-scopes.js';
import { EncryptedFileTokenStore } from '../../services/token-store.js';
import { startCallbackServer, extractPortFromRedirectUri } from '../../utils/oauth-callback-server.js';
import { TokenManager } from '../../services/token-manager.js';
import { logger } from '../../utils/logger.js';
import { executeWithRetry } from '../../utils/retry.js';
import { ErrorCodes } from '../error-codes.js';
import open from 'open';
import { getSessionContext } from '../../services/session-context.js';
import type { ElicitationServer } from '../../mcp/elicitation.js';
import {
  initiateOAuthFlow,
  completeOAuthFlow,
} from '../../mcp/elicitation.js';
import {
  verifyOAuthState,
  cleanupExpiredSessionStates,
  pendingSessionStates,
  createFreshAuthUrl,
} from './internal.js';

export async function handleLogin(
  oauthClient: OAuth2Client | null,
  request: AuthLoginInput,
  googleClient: GoogleApiClient | null | undefined,
  tokenStorePath: string | undefined,
  tokenStoreKey: string | undefined,
  redirectUri: string | undefined,
  elicitationServer: ElicitationServer | undefined,
  _pendingOAuthElicitationId: { value?: string }
): Promise<{ response: AuthResponse; pendingReauthState?: undefined; tokenManager?: TokenManager; pendingOAuthElicitationId?: string }> {
  if (!oauthClient) {
    return {
      response: {
        success: false,
        error: {
          code: ErrorCodes.CONFIG_ERROR,
          message: 'OAuth client credentials are not configured.',
          retryable: false,
          resolution:
            'Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET (or GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) in your environment.',
          resolutionSteps: [
            '1. Create or locate a Google desktop-app OAuth client',
            '2. Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET in your environment or .env',
            '3. Restart the server',
          ],
        },
      },
    };
  }

  const baseScopes = googleClient?.scopes ?? Array.from(getRecommendedScopes());
  const requestedScopes = request.scopes?.length
    ? Array.from(new Set([...baseScopes, ...request.scopes]))
    : baseScopes;
  const authUrl = createFreshAuthUrl(oauthClient, requestedScopes);

  const useCallbackServer = process.env['OAUTH_USE_CALLBACK_SERVER'] !== 'false';
  const autoOpenBrowser = process.env['OAUTH_AUTO_OPEN_BROWSER'] !== 'false';

  if (useCallbackServer && redirectUri && redirectUri.includes('localhost')) {
    try {
      const port = extractPortFromRedirectUri(redirectUri);
      logger.info(`Starting OAuth callback server on port ${port}...`);
      const callbackPromise = startCallbackServer({ port, timeout: 120000 });

      if (elicitationServer) {
        try {
          const oauthElicit = await initiateOAuthFlow(elicitationServer, {
            authUrl,
            provider: 'Google',
            scopes: requestedScopes,
          });
          _pendingOAuthElicitationId.value = oauthElicit.elicitationId;
        } catch {
          // Elicitation is optional
        }
      }

      if (autoOpenBrowser) {
        try {
          logger.info('Opening browser for OAuth...', { url: authUrl.substring(0, 100) + '...' });
          const subprocess = await open(authUrl, { wait: false });
          subprocess.stdout?.destroy();
          subprocess.stderr?.destroy();
          subprocess.unref();
          logger.info('Browser opened successfully');
        } catch (error) {
          logger.error('Failed to open browser - user must open URL manually', {
            error: error instanceof Error ? error.message : String(error),
            url: authUrl,
          });
        }
      }

      logger.info('Waiting for OAuth callback...');
      const result = await callbackPromise;

      if (!verifyOAuthState(result.state)) {
        return {
          response: {
            success: false,
            error: {
              code: ErrorCodes.AUTH_ERROR,
              message: 'OAuth state verification failed. Possible CSRF attack or expired session.',
              retryable: true,
              suggestedFix: 'Restart the login flow with sheets_auth action "login".',
            },
          },
        };
      }

      if (result.error) {
        return {
          response: {
            success: false,
            error: {
              code: ErrorCodes.AUTH_ERROR,
              message: `OAuth authentication failed: ${result.error}`,
              retryable: true,
            },
          },
        };
      }

      if (!result.code) {
        return {
          response: {
            success: false,
            error: {
              code: ErrorCodes.AUTH_ERROR,
              message: 'No authorization code received',
              retryable: true,
            },
          },
        };
      }

      logger.info('Received authorization code, exchanging for tokens...');
      const tokenResponse = await executeWithRetry(
        async (_signal) => {
          return await oauthClient.getToken(result.code!);
        },
        {
          maxRetries: 2,
          baseDelayMs: 1000,
          maxDelayMs: 30000,
          timeoutMs: 30000,
        }
      );
      const { tokens } = tokenResponse;
      oauthClient.setCredentials(tokens);

      const grantedScope = tokens.scope;
      if (!grantedScope) {
        logger.warn('OAuth callback did not return granted scopes', {
          component: 'auth-handler',
          flow: 'automatic_callback',
        });
      }
      if (tokenStoreKey) {
        const tokenStore = new EncryptedFileTokenStore(tokenStorePath!, tokenStoreKey);
        await tokenStore.save({
          access_token: tokens.access_token ?? undefined,
          refresh_token: tokens.refresh_token ?? undefined,
          expiry_date: tokens.expiry_date ?? undefined,
          token_type: tokens.token_type ?? undefined,
          scope: grantedScope,
          id_token: tokens.id_token ?? undefined,
        });
      }

      if (googleClient && tokens.access_token) {
        googleClient.setCredentials(tokens.access_token, tokens.refresh_token ?? undefined);
        if (grantedScope) {
          googleClient.setScopes(grantedScope.split(' '));
        }
      }

      let tokenManager: TokenManager | undefined;
      if (tokens.refresh_token) {
        tokenManager = new TokenManager({
          oauthClient,
          refreshThreshold: 0.8,
          checkIntervalMs: 300000,
          onTokenRefreshed: async (refreshedTokens) => {
            if (tokenStoreKey && tokenStorePath) {
              try {
                const tokenStore = new EncryptedFileTokenStore(tokenStorePath, tokenStoreKey);
                await tokenStore.save({
                  access_token: refreshedTokens.access_token ?? undefined,
                  refresh_token: refreshedTokens.refresh_token ?? undefined,
                  expiry_date: refreshedTokens.expiry_date ?? undefined,
                  token_type: refreshedTokens.token_type ?? undefined,
                  scope: refreshedTokens.scope ?? undefined,
                  id_token: refreshedTokens.id_token ?? undefined,
                });
              } catch (error) {
                logger.error('Failed to save refreshed tokens', {
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }
            if (googleClient && refreshedTokens.access_token) {
              googleClient.setCredentials(
                refreshedTokens.access_token,
                refreshedTokens.refresh_token ?? undefined
              );
            }
          },
          onRefreshError: async (error) => {
            logger.error('Token refresh failed', {
              error: error.message,
              recommendation: 'User may need to re-authenticate',
            });
          },
        });
        tokenManager.start();
      }

      const pendingEntry = result.state ? pendingSessionStates.get(result.state) : undefined;
      if (pendingEntry) {
        try {
          getSessionContext().importState(pendingEntry.exportedState);
          if (result.state) pendingSessionStates.delete(result.state);
          logger.info('Restored session state after re-auth', { component: 'auth' });
        } catch (err) {
          logger.warn('Failed to restore session state after re-auth', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const hasRefreshToken = Boolean(tokens.refresh_token);
      const warning = tokenStoreKey
        ? undefined
        : 'ENCRYPTION_KEY not set; tokens will not persist across restarts.';

      if (elicitationServer && _pendingOAuthElicitationId.value) {
        try {
          await completeOAuthFlow(elicitationServer, _pendingOAuthElicitationId.value);
        } catch {
          // Non-blocking
        }
      }

      return {
        response: {
          success: true,
          action: 'login',
          authenticated: true,
          hasRefreshToken,
          message: warning
            ? `Authentication successful! ${warning}`
            : 'Authentication successful! You can now use sheets_* tools.',
        },
        tokenManager,
      };
    } catch (error) {
      logger.error('Callback server error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Fall back to manual flow
    }
  }

  // Manual flow (fallback or if callback server disabled)
  if (elicitationServer) {
    try {
      const oauthElicit = await initiateOAuthFlow(elicitationServer, {
        authUrl,
        provider: 'Google',
        scopes: requestedScopes,
      });
      _pendingOAuthElicitationId.value = oauthElicit.elicitationId;
    } catch {
      // Elicitation is optional
    }
  }

  let browserOpened = false;
  if (autoOpenBrowser) {
    try {
      const manualProc = await open(authUrl, { wait: false });
      manualProc.stdout?.destroy();
      manualProc.stderr?.destroy();
      manualProc.unref();
      browserOpened = true;
    } catch (error) {
      logger.error('Failed to open browser', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    response: {
      success: true,
      action: 'login',
      authenticated: false,
      authUrl,
      scopes: requestedScopes,
      message: browserOpened
        ? 'Browser opened for authentication. Sign in to Google, then paste the authorization code here.'
        : 'Visit the authorization URL to sign in, then provide the code.',
      instructions: browserOpened
        ? [
            '1. Complete the authentication in the browser window that just opened',
            '2. Approve the requested permissions',
            '3. Copy the authorization code and state from the redirect URL',
            '4. Paste them here (Claude will call sheets_auth with action "callback")',
          ]
        : [
            '1. Open the authorization URL and sign in to Google',
            '2. Approve the requested permissions',
            '3. Copy the authorization code and state from the redirect URL',
            '4. Call sheets_auth with action "callback", the code, and state when available',
          ],
    },
  };
}

export async function handleCallback(
  oauthClient: OAuth2Client | null,
  request: AuthCallbackInput,
  googleClient: GoogleApiClient | null | undefined,
  tokenStorePath: string | undefined,
  tokenStoreKey: string | undefined,
  elicitationServer: ElicitationServer | undefined,
  _pendingOAuthElicitationId: { value?: string }
): Promise<{ response: AuthResponse; tokenManager?: TokenManager }> {
  if (!oauthClient) {
    return {
      response: {
        success: false,
        error: {
          code: ErrorCodes.CONFIG_ERROR,
          message: 'OAuth client credentials are not configured.',
          retryable: false,
          resolution:
            'Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET (or GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) in your environment, then retry the callback.',
        },
      },
    };
  }

  cleanupExpiredSessionStates();

  if (!request.state || !verifyOAuthState(request.state)) {
    return {
      response: {
        success: false,
        error: {
          code: ErrorCodes.AUTH_ERROR,
          message: 'OAuth state verification failed. Possible CSRF attack or expired session.',
          retryable: true,
          suggestedFix: 'Restart the login flow with sheets_auth action "login".',
        },
      },
    };
  }

  const tokenResponse = await executeWithRetry(
    async (_signal) => {
      return await oauthClient.getToken(request.code);
    },
    {
      maxRetries: 2,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      timeoutMs: 30000,
    }
  );
  const { tokens } = tokenResponse;
  oauthClient.setCredentials(tokens);

  const callbackScope = tokens.scope;

  if (callbackScope) {
    const grantedScopes = callbackScope.split(' ');
    const hasSheetsScope =
      grantedScopes.includes('https://www.googleapis.com/auth/spreadsheets') ||
      grantedScopes.includes('https://www.googleapis.com/auth/spreadsheets.readonly');
    if (!hasSheetsScope) {
      logger.warn('OAuth callback: Google Sheets scope not granted — some operations will fail', {
        component: 'auth-handler',
        grantedScopes,
      });
    }
  } else {
    logger.warn('OAuth callback did not return granted scopes', {
      component: 'auth-handler',
    });
  }

  if (tokenStoreKey) {
    const tokenStore = new EncryptedFileTokenStore(tokenStorePath!, tokenStoreKey);
    await tokenStore.save({
      access_token: tokens.access_token ?? undefined,
      refresh_token: tokens.refresh_token ?? undefined,
      expiry_date: tokens.expiry_date ?? undefined,
      token_type: tokens.token_type ?? undefined,
      scope: callbackScope,
      id_token: tokens.id_token ?? undefined,
    });
  }

  if (googleClient && tokens.access_token) {
    googleClient.setCredentials(tokens.access_token, tokens.refresh_token ?? undefined);
    if (callbackScope) {
      googleClient.setScopes(callbackScope.split(' '));
    }
  }

  let tokenManager: TokenManager | undefined;
  if (tokens.refresh_token) {
    tokenManager = new TokenManager({
      oauthClient,
      refreshThreshold: 0.8,
      checkIntervalMs: 300000,
      onTokenRefreshed: async (refreshedTokens) => {
        if (tokenStoreKey && tokenStorePath) {
          try {
            const tokenStore = new EncryptedFileTokenStore(tokenStorePath, tokenStoreKey);
            await tokenStore.save({
              access_token: refreshedTokens.access_token ?? undefined,
              refresh_token: refreshedTokens.refresh_token ?? undefined,
              expiry_date: refreshedTokens.expiry_date ?? undefined,
              token_type: refreshedTokens.token_type ?? undefined,
              scope: refreshedTokens.scope ?? undefined,
              id_token: refreshedTokens.id_token ?? undefined,
            });
          } catch (error) {
            logger.error('Failed to save refreshed tokens', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        if (googleClient && refreshedTokens.access_token) {
          googleClient.setCredentials(
            refreshedTokens.access_token,
            refreshedTokens.refresh_token ?? undefined
          );
        }
      },
      onRefreshError: async (error) => {
        logger.error('Token refresh failed', {
          error: error.message,
          recommendation: 'User may need to re-authenticate',
        });
      },
    });
    tokenManager.start();
  }

  if (request.state) {
    const pendingEntry = pendingSessionStates.get(request.state);
    if (pendingEntry) {
      try {
        getSessionContext().importState(pendingEntry.exportedState);
        pendingSessionStates.delete(request.state);
        logger.info('Restored session state after re-auth (manual callback)', {
          component: 'auth',
        });
      } catch (err) {
        logger.warn('Failed to restore session state after re-auth', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  if (elicitationServer && _pendingOAuthElicitationId.value) {
    try {
      await completeOAuthFlow(elicitationServer, _pendingOAuthElicitationId.value);
    } catch {
      // Non-blocking
    }
  }

  const hasRefreshToken = Boolean(tokens.refresh_token);
  const warning = tokenStoreKey
    ? undefined
    : 'ENCRYPTION_KEY not set; tokens will not persist across restarts.';

  return {
    response: {
      success: true,
      action: 'callback',
      authenticated: true,
      hasRefreshToken,
      message: warning
        ? `Authenticated. ${warning}`
        : 'Authenticated successfully. You can now use sheets_* tools.',
    },
    tokenManager,
  };
}

export async function handleLogout(
  googleClient: GoogleApiClient | null | undefined,
  tokenStorePath: string | undefined,
  tokenStoreKey: string | undefined
): Promise<AuthResponse> {
  if (googleClient) {
    try {
      await googleClient.revokeAccess();
    } catch {
      // Ignore revoke errors
    }
    await googleClient.clearStoredTokens();
  } else if (tokenStoreKey) {
    const tokenStore = new EncryptedFileTokenStore(tokenStorePath!, tokenStoreKey);
    await tokenStore.clear();
  }

  return {
    success: true,
    action: 'logout',
    authenticated: false,
    message: 'Authentication cleared.',
  };
}
