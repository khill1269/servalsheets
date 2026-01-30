/**
 * ServalSheets - Auth Handler
 *
 * Handles OAuth authentication flows for sheets_auth tool.
 */

import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { GoogleApiClient } from '../services/google-api.js';
import { DEFAULT_SCOPES } from '../services/google-api.js';
import { EncryptedFileTokenStore } from '../services/token-store.js';
import { getDefaultTokenStorePath } from '../utils/auth-paths.js';
import { getOAuthEnvConfig } from '../utils/oauth-config.js';
import type {
  SheetsAuthInput,
  SheetsAuthOutput,
  AuthResponse,
  AuthLoginInput,
  AuthCallbackInput,
} from '../schemas/auth.js';
import { initiateOAuthFlow } from '../mcp/elicitation.js';
import type { ElicitationServer } from '../mcp/elicitation.js';
import { startCallbackServer, extractPortFromRedirectUri } from '../utils/oauth-callback-server.js';
import { TokenManager } from '../services/token-manager.js';
import { logger } from '../utils/logger.js';
import open from 'open';
import { unwrapRequest } from './base.js';

export interface AuthHandlerOptions {
  googleClient?: GoogleApiClient | null;
  oauthClientId?: string;
  oauthClientSecret?: string;
  redirectUri?: string;
  tokenStorePath?: string;
  tokenStoreKey?: string;
  elicitationServer?: ElicitationServer;
}

export class AuthHandler {
  private googleClient?: GoogleApiClient | null;
  private oauthClientId?: string;
  private oauthClientSecret?: string;
  private redirectUri?: string;
  private tokenStorePath?: string;
  private tokenStoreKey?: string;
  private elicitationServer?: ElicitationServer;
  private tokenManager?: TokenManager;

  constructor(options: AuthHandlerOptions = {}) {
    const envConfig = getOAuthEnvConfig();

    this.googleClient = options.googleClient ?? null;
    this.oauthClientId = options.oauthClientId ?? envConfig.clientId;
    this.oauthClientSecret = options.oauthClientSecret ?? envConfig.clientSecret;
    this.redirectUri =
      options.redirectUri ?? envConfig.redirectUri ?? 'http://localhost:3000/callback';
    this.tokenStorePath =
      options.tokenStorePath ??
      process.env['GOOGLE_TOKEN_STORE_PATH'] ??
      getDefaultTokenStorePath();
    this.tokenStoreKey = options.tokenStoreKey ?? process.env['ENCRYPTION_KEY'];
    this.elicitationServer = options.elicitationServer;
  }

  /**
   * Apply verbosity filtering to optimize token usage (LLM optimization)
   */
  private applyVerbosityFilter(
    response: AuthResponse,
    verbosity: 'minimal' | 'standard' | 'detailed'
  ): AuthResponse {
    if (!response.success || verbosity === 'standard') {
      return response;
    }

    if (verbosity === 'minimal') {
      // For minimal verbosity, strip _meta field and instructions
      const { _meta, instructions: _instructions, ...rest } = response as Record<string, unknown>;
      return rest as AuthResponse;
    }

    return response;
  }

  async handle(input: SheetsAuthInput): Promise<SheetsAuthOutput> {
    const req = unwrapRequest<SheetsAuthInput['request']>(input) as SheetsAuthInput['request'] & {
      verbosity?: 'minimal' | 'standard' | 'detailed';
    };
    const verbosity = req.verbosity ?? 'standard';

    try {
      let response: AuthResponse;
      switch (req.action) {
        case 'status':
          response = await this.handleStatus();
          break;
        case 'login':
          response = await this.handleLogin(req as AuthLoginInput);
          break;
        case 'callback':
          response = await this.handleCallback(req as AuthCallbackInput);
          break;
        case 'logout':
          response = await this.handleLogout();
          break;
        default: {
          // TypeScript exhaustiveness check - this should never be reached
          const exhaustiveCheck: never = input as never;
          response = {
            success: false,
            error: {
              code: 'INVALID_PARAMS',
              message: `Unsupported auth action: ${(exhaustiveCheck as { action: string }).action}`,
              retryable: false,
            },
          };
        }
      }

      // Apply verbosity filtering (LLM optimization)
      return { response: this.applyVerbosityFilter(response, verbosity) };
    } catch (error) {
      return {
        response: {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : String(error),
            retryable: false,
          },
        },
      };
    }
  }

  private async handleStatus(): Promise<AuthResponse> {
    if (this.googleClient) {
      const authType = this.googleClient.authType;
      const tokenStatus = this.googleClient.getTokenStatus();
      const hasTokens = tokenStatus.hasAccessToken || tokenStatus.hasRefreshToken;

      if (authType === 'service_account' || authType === 'application_default') {
        return {
          success: true,
          action: 'status',
          authenticated: true,
          authType,
          message: `Authenticated via ${authType.replace('_', ' ')} credentials.`,
        };
      }

      // Validate token if present (check that it actually works)
      let tokenValid = false;
      let validationError: string | undefined;
      if (hasTokens) {
        const validation = await this.googleClient.validateToken();
        tokenValid = validation.valid;
        validationError = validation.error;
      }

      return {
        success: true,
        action: 'status',
        authenticated: hasTokens && tokenValid, // Must exist AND be valid
        authType,
        hasAccessToken: tokenStatus.hasAccessToken,
        hasRefreshToken: tokenStatus.hasRefreshToken,
        tokenValid, // NEW: Indicates if token is actually valid
        scopes: this.googleClient.scopes,
        message: tokenValid
          ? 'OAuth credentials present and valid. Ready to use sheets_* tools.'
          : hasTokens
            ? `OAuth credentials present but invalid: ${validationError}. Call sheets_auth action "login" to re-authenticate.`
            : 'Not authenticated. Call sheets_auth action "login" to start OAuth.',
      };
    }

    const configured = Boolean(this.oauthClientId && this.oauthClientSecret);
    return {
      success: true,
      action: 'status',
      authenticated: false,
      authType: configured ? 'oauth' : 'unconfigured',
      message: configured
        ? 'OAuth credentials configured but no session. Call sheets_auth action "login".'
        : 'OAuth credentials not configured. Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET.',
    };
  }

  private async handleLogin(request: AuthLoginInput): Promise<AuthResponse> {
    const oauthClient = this.createOAuthClient();
    if (!oauthClient) {
      return {
        success: false,
        error: {
          code: 'CONFIG_ERROR',
          message: 'OAuth client credentials are not configured.',
          retryable: false,
          resolution: 'Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET (or GOOGLE_CLIENT_ID/SECRET).',
          resolutionSteps: [
            '1. Create OAuth credentials in Google Cloud Console',
            '2. Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET in your environment or .env',
            '3. Restart the server',
          ],
        },
      };
    }

    const baseScopes = this.googleClient?.scopes ?? DEFAULT_SCOPES;
    const requestedScopes = request.scopes?.length
      ? Array.from(new Set([...baseScopes, ...request.scopes]))
      : baseScopes;

    const authUrl = oauthClient.generateAuthUrl({
      access_type: 'offline',
      scope: requestedScopes,
      prompt: 'consent',
    });

    // Check if we should use automatic callback server
    const useCallbackServer = process.env['OAUTH_USE_CALLBACK_SERVER'] !== 'false';
    const autoOpenBrowser = process.env['OAUTH_AUTO_OPEN_BROWSER'] !== 'false';

    if (useCallbackServer && this.redirectUri && this.redirectUri.includes('localhost')) {
      // Automatic callback flow with local server
      try {
        const port = extractPortFromRedirectUri(this.redirectUri);

        // Start callback server
        logger.info(`Starting OAuth callback server on port ${port}...`);
        const callbackPromise = startCallbackServer({ port, timeout: 120000 });

        // Use elicitation API if available
        if (this.elicitationServer) {
          try {
            await initiateOAuthFlow(this.elicitationServer, {
              authUrl,
              provider: 'Google',
              scopes: requestedScopes,
            });
          } catch {
            // Elicitation is optional; continue
          }
        }

        // Open browser
        if (autoOpenBrowser) {
          try {
            await open(authUrl);
          } catch (error) {
            logger.error('Failed to open browser', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Wait for callback
        logger.info('Waiting for OAuth callback...');
        const result = await callbackPromise;

        if (result.error) {
          return {
            success: false,
            error: {
              code: 'AUTH_ERROR',
              message: `OAuth authentication failed: ${result.error}`,
              retryable: true,
            },
          };
        }

        if (!result.code) {
          return {
            success: false,
            error: {
              code: 'AUTH_ERROR',
              message: 'No authorization code received',
              retryable: true,
            },
          };
        }

        // Exchange code for tokens automatically
        logger.info('Received authorization code, exchanging for tokens...');
        const { tokens } = await oauthClient.getToken(result.code);
        oauthClient.setCredentials(tokens);

        // Save tokens
        if (this.tokenStoreKey) {
          const tokenStore = new EncryptedFileTokenStore(this.tokenStorePath!, this.tokenStoreKey);
          await tokenStore.save({
            access_token: tokens.access_token ?? undefined,
            refresh_token: tokens.refresh_token ?? undefined,
            expiry_date: tokens.expiry_date ?? undefined,
            token_type: tokens.token_type ?? undefined,
            scope: tokens.scope ?? undefined,
            id_token: tokens.id_token ?? undefined,
          });
        }

        // Update Google client
        if (this.googleClient && tokens.access_token) {
          this.googleClient.setCredentials(tokens.access_token, tokens.refresh_token ?? undefined);
        }

        // Start token manager for proactive refresh (Phase 1, Task 1.1)
        if (tokens.refresh_token) {
          this.startTokenManager(oauthClient);
        }

        const hasRefreshToken = Boolean(tokens.refresh_token);
        const warning = this.tokenStoreKey
          ? undefined
          : 'ENCRYPTION_KEY not set; tokens will not persist across restarts.';

        return {
          success: true,
          action: 'login',
          authenticated: true,
          hasRefreshToken,
          message: warning
            ? `Authentication successful! ${warning}`
            : 'Authentication successful! You can now use sheets_* tools.',
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
    if (this.elicitationServer) {
      try {
        await initiateOAuthFlow(this.elicitationServer, {
          authUrl,
          provider: 'Google',
          scopes: requestedScopes,
        });
      } catch {
        // Elicitation is optional; continue
      }
    }

    let browserOpened = false;
    if (autoOpenBrowser) {
      try {
        await open(authUrl);
        browserOpened = true;
      } catch (error) {
        logger.error('Failed to open browser', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
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
            '3. Copy the authorization code from the redirect URL',
            '4. Paste the code here (Claude will call sheets_auth with action "callback")',
          ]
        : [
            '1. Open the authorization URL and sign in to Google',
            '2. Approve the requested permissions',
            '3. Copy the authorization code from the redirect URL',
            '4. Call sheets_auth with action "callback" and the code',
          ],
    };
  }

  private async handleCallback(request: AuthCallbackInput): Promise<AuthResponse> {
    const oauthClient = this.createOAuthClient();
    if (!oauthClient) {
      return {
        success: false,
        error: {
          code: 'CONFIG_ERROR',
          message: 'OAuth client credentials are not configured.',
          retryable: false,
          resolution: 'Set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET (or GOOGLE_CLIENT_ID/SECRET).',
        },
      };
    }

    const { tokens } = await oauthClient.getToken(request.code);
    oauthClient.setCredentials(tokens);

    if (this.tokenStoreKey) {
      const tokenStore = new EncryptedFileTokenStore(this.tokenStorePath!, this.tokenStoreKey);
      await tokenStore.save({
        access_token: tokens.access_token ?? undefined,
        refresh_token: tokens.refresh_token ?? undefined,
        expiry_date: tokens.expiry_date ?? undefined,
        token_type: tokens.token_type ?? undefined,
        scope: tokens.scope ?? undefined,
        id_token: tokens.id_token ?? undefined,
      });
    }

    if (this.googleClient && tokens.access_token) {
      this.googleClient.setCredentials(tokens.access_token, tokens.refresh_token ?? undefined);
    }

    // Start token manager for proactive refresh (Phase 1, Task 1.1)
    if (tokens.refresh_token) {
      this.startTokenManager(oauthClient);
    }

    const hasRefreshToken = Boolean(tokens.refresh_token);
    const warning = this.tokenStoreKey
      ? undefined
      : 'ENCRYPTION_KEY not set; tokens will not persist across restarts.';

    return {
      success: true,
      action: 'callback',
      authenticated: true,
      hasRefreshToken,
      message: warning
        ? `Authenticated. ${warning}`
        : 'Authenticated successfully. You can now use sheets_* tools.',
    };
  }

  private async handleLogout(): Promise<AuthResponse> {
    // Stop token manager (Phase 1, Task 1.1)
    if (this.tokenManager) {
      this.tokenManager.stop();
      this.tokenManager = undefined;
    }

    if (this.googleClient) {
      try {
        await this.googleClient.revokeAccess();
      } catch {
        // Ignore revoke errors; continue to clear tokens.
      }
      await this.googleClient.clearStoredTokens();
    } else if (this.tokenStoreKey) {
      const tokenStore = new EncryptedFileTokenStore(this.tokenStorePath!, this.tokenStoreKey);
      await tokenStore.clear();
    }

    return {
      success: true,
      action: 'logout',
      authenticated: false,
      message: 'Authentication cleared.',
    };
  }

  /**
   * Initialize and start token manager for proactive refresh
   * Phase 1, Task 1.1: Proactive OAuth Token Refresh
   */
  private startTokenManager(oauthClient: OAuth2Client): void {
    // Stop existing manager if present
    if (this.tokenManager) {
      this.tokenManager.stop();
    }

    // Create new token manager with refresh callback
    this.tokenManager = new TokenManager({
      oauthClient,
      refreshThreshold: 0.8, // Refresh at 80% of token lifetime
      checkIntervalMs: 300000, // Check every 5 minutes
      onTokenRefreshed: async (tokens) => {
        // Save refreshed tokens to encrypted store
        if (this.tokenStoreKey && this.tokenStorePath) {
          try {
            const tokenStore = new EncryptedFileTokenStore(this.tokenStorePath, this.tokenStoreKey);
            await tokenStore.save({
              access_token: tokens.access_token ?? undefined,
              refresh_token: tokens.refresh_token ?? undefined,
              expiry_date: tokens.expiry_date ?? undefined,
              token_type: tokens.token_type ?? undefined,
              scope: tokens.scope ?? undefined,
              id_token: tokens.id_token ?? undefined,
            });
            logger.info('Refreshed tokens saved to encrypted store');
          } catch (error) {
            logger.error('Failed to save refreshed tokens', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Update Google client credentials
        if (this.googleClient && tokens.access_token) {
          this.googleClient.setCredentials(tokens.access_token, tokens.refresh_token ?? undefined);
        }
      },
      onRefreshError: async (error) => {
        logger.error('Token refresh failed', {
          error: error.message,
          recommendation: 'User may need to re-authenticate',
        });
      },
    });

    // Start background monitoring
    this.tokenManager.start();
    logger.info('Token manager started for proactive refresh');
  }

  private createOAuthClient(): OAuth2Client | null {
    if (!this.oauthClientId || !this.oauthClientSecret) {
      return null;
    }
    return new google.auth.OAuth2(this.oauthClientId, this.oauthClientSecret, this.redirectUri);
  }
}
