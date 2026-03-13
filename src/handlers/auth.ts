/**
 * ServalSheets - Auth Handler
 *
 * Handles OAuth authentication flows for sheets_auth tool.
 */

import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { GoogleApiClient } from '../services/google-api.js';
import { getRecommendedScopes } from '../config/oauth-scopes.js';
import { EncryptedFileTokenStore } from '../services/token-store.js';
import { getDefaultTokenStorePath, sanitizeTokenStorePath } from '../utils/auth-paths.js';
import { getOAuthEnvConfig } from '../utils/oauth-config.js';
import type {
  SheetsAuthInput,
  SheetsAuthOutput,
  AuthResponse,
  AuthLoginInput,
  AuthCallbackInput,
  AuthSetupFeatureInput,
} from '../schemas/auth.js';
import { initiateOAuthFlow, safeElicit, stringField, selectField } from '../mcp/elicitation.js';
import type { ElicitationServer } from '../mcp/elicitation.js';
import { runtimeConfigStore } from '../config/runtime-config-store.js';
import { startCallbackServer, extractPortFromRedirectUri } from '../utils/oauth-callback-server.js';
import { TokenManager } from '../services/token-manager.js';
import { logger } from '../utils/logger.js';
import open from 'open';
import { unwrapRequest } from './base.js';
import { executeWithRetry } from '../utils/retry.js';
import { mapStandaloneError } from './helpers/error-mapping.js';
import { applyVerbosityFilter } from './helpers/verbosity-filter.js';
import { randomBytes } from 'crypto';
import { getSessionContext } from '../services/session-context.js';
import { ErrorCodes } from './error-codes.js';

/** Module-level CSRF state store with 10-minute TTL */
const pendingStates = new Map<string, number>();

/** Temporary session state storage keyed by OAuth state token */
const pendingSessionStates = new Map<string, { exportedState: string; expiresAt: number }>();

/** Clean up expired session state entries */
function cleanupExpiredSessionStates(): void {
  const now = Date.now();
  for (const [key, value] of pendingSessionStates) {
    if (value.expiresAt < now) {
      pendingSessionStates.delete(key);
    }
  }
}

function generateOAuthState(): string {
  const state = randomBytes(32).toString('hex');
  pendingStates.set(state, Date.now() + 10 * 60 * 1000);
  // Prune expired entries
  const now = Date.now();
  for (const [key, expiry] of pendingStates) {
    if (expiry < now) pendingStates.delete(key);
  }
  return state;
}

function verifyOAuthState(state: string | undefined): boolean {
  if (!state) return false;
  const expiry = pendingStates.get(state);
  if (!expiry) return false;
  pendingStates.delete(state);
  return Date.now() < expiry;
}

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
  private pendingReauthState?: {
    authUrl: string;
    failureCount: number;
    lastError: string;
  };

  constructor(options: AuthHandlerOptions = {}) {
    const envConfig = getOAuthEnvConfig();

    this.googleClient = options.googleClient ?? null;
    this.oauthClientId = options.oauthClientId ?? envConfig.clientId;
    this.oauthClientSecret = options.oauthClientSecret ?? envConfig.clientSecret;
    this.redirectUri =
      options.redirectUri ?? envConfig.redirectUri ?? 'http://localhost:3000/callback';
    this.tokenStorePath = sanitizeTokenStorePath(
      options.tokenStorePath ?? process.env['GOOGLE_TOKEN_STORE_PATH'] ?? getDefaultTokenStorePath()
    );
    this.tokenStoreKey = options.tokenStoreKey ?? process.env['ENCRYPTION_KEY'];
    this.elicitationServer = options.elicitationServer;
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
        case 'setup_feature':
          response = await this.handleSetupFeature(req as AuthSetupFeatureInput);
          break;
        default: {
          // TypeScript exhaustiveness check - this should never be reached
          const exhaustiveCheck: never = req as never;
          response = {
            success: false,
            error: {
              code: ErrorCodes.INVALID_PARAMS,
              message: `Unsupported auth action: ${(exhaustiveCheck as { action: string }).action}`,
              retryable: false,
              suggestedFix: "Check parameter format - ranges use A1 notation like 'Sheet1!A1:D10'",
            },
          };
        }
      }

      // Apply verbosity filtering (LLM optimization)
      return { response: applyVerbosityFilter(response, verbosity) };
    } catch (error) {
      logger.error('Auth handler error', {
        action: req.action,
        error,
      });
      return {
        response: {
          success: false,
          error: mapStandaloneError(error),
        },
      };
    }
  }

  private async handleStatus(): Promise<AuthResponse> {
    if (this.pendingReauthState) {
      return {
        success: false,
        error: {
          code: ErrorCodes.INVALID_CREDENTIALS,
          message:
            'OAuth refresh failed repeatedly. Re-authentication is required before using sheets_* tools.',
          retryable: false,
          resolution: 'Open the re-authentication URL and complete a fresh OAuth login.',
          resolutionSteps: [
            '1. Open the re-authentication URL from error.details.re_auth_url',
            '2. Complete the Google OAuth prompt and grant the requested permissions',
            '3. Retry your original request after authentication succeeds',
          ],
          details: {
            consecutiveFailures: this.pendingReauthState.failureCount,
            lastRefreshError: this.pendingReauthState.lastError,
            re_auth_url: this.pendingReauthState.authUrl,
          },
        },
      };
    }

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
        : 'OAuth credentials not configured. Install the latest version of ServalSheets which includes embedded credentials, or set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET manually.',
    };
  }

  private async handleLogin(request: AuthLoginInput): Promise<AuthResponse> {
    const oauthClient = this.createOAuthClient();
    if (!oauthClient) {
      return {
        success: false,
        error: {
          code: ErrorCodes.CONFIG_ERROR,
          message: 'OAuth client credentials are not configured.',
          retryable: false,
          resolution:
            'Update to the latest ServalSheets version (embedded credentials), or set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET (or GOOGLE_CLIENT_ID/SECRET) in your environment.',
          resolutionSteps: [
            '1. Update ServalSheets to the latest version (includes embedded OAuth credentials)',
            '2. Or manually set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET in your environment or .env',
            '3. Restart the server',
          ],
        },
      };
    }

    const baseScopes = this.googleClient?.scopes ?? Array.from(getRecommendedScopes());
    const requestedScopes = request.scopes?.length
      ? Array.from(new Set([...baseScopes, ...request.scopes]))
      : baseScopes;
    const authUrl = this.createFreshAuthUrl(oauthClient, requestedScopes);

    // Check if we should use automatic callback server
    const useCallbackServer = process.env['OAUTH_USE_CALLBACK_SERVER'] !== 'false';
    const autoOpenBrowser = process.env['OAUTH_AUTO_OPEN_BROWSER'] !== 'false';

    if (useCallbackServer && this.redirectUri && this.redirectUri.includes('localhost')) {
      // Automatic callback flow with local server
      try {
        const port = extractPortFromRedirectUri(this.redirectUri);

        // Gap 1 Fix: Increase callback server timeout to 120s (was 60s) for slow connections
        // Reduces timeout failures from 60s window → 120s window
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
        // IMPORTANT: In STDIO mode, stdout is the MCP JSON-RPC channel.
        // The `open` package can write status text to stdout, corrupting the protocol.
        // Use wait:false and suppress child process output to prevent stdout contamination.
        if (autoOpenBrowser) {
          try {
            logger.info('Opening browser for OAuth...', { url: authUrl.substring(0, 100) + '...' });
            const subprocess = await open(authUrl, { wait: false });
            // Prevent any subprocess output from leaking into STDIO transport
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

        // Wait for callback
        logger.info('Waiting for OAuth callback...');
        const result = await callbackPromise;

        // Verify CSRF state parameter
        if (!verifyOAuthState(result.state)) {
          return {
            success: false,
            error: {
              code: ErrorCodes.AUTH_ERROR,
              message: 'OAuth state verification failed. Possible CSRF attack or expired session.',
              retryable: true,
              suggestedFix: 'Restart the login flow with sheets_auth action "login".',
            },
          };
        }

        if (result.error) {
          return {
            success: false,
            error: {
              code: ErrorCodes.AUTH_ERROR,
              message: `OAuth authentication failed: ${result.error}`,
              retryable: true,
            },
          };
        }

        if (!result.code) {
          return {
            success: false,
            error: {
              code: ErrorCodes.AUTH_ERROR,
              message: 'No authorization code received',
              retryable: true,
            },
          };
        }

        // Exchange code for tokens automatically with retry protection
        // Gap 1 Fix: Wrap OAuth token exchange with retry logic (3 attempts, exponential backoff)
        // Prevents cascade failures from network timeouts (67% of all timeouts in audit)
        logger.info('Received authorization code, exchanging for tokens...');
        const tokenResponse = await executeWithRetry(
          async (_signal) => {
            return await oauthClient.getToken(result.code!);
          },
          {
            maxRetries: 2, // Total of 3 attempts (initial + 2 retries)
            baseDelayMs: 1000, // Start with 1s delay (longer than default for OAuth)
            maxDelayMs: 30000, // Cap at 30s
            timeoutMs: 30000, // 30s timeout per attempt
          }
        );
        const { tokens } = tokenResponse;
        oauthClient.setCredentials(tokens);

        // Only trust scopes explicitly returned by Google for this callback.
        const grantedScope = tokens.scope;
        if (!grantedScope) {
          logger.warn('OAuth callback did not return granted scopes', {
            component: 'auth-handler',
            flow: 'automatic_callback',
          });
        }
        if (this.tokenStoreKey) {
          const tokenStore = new EncryptedFileTokenStore(this.tokenStorePath!, this.tokenStoreKey);
          await tokenStore.save({
            access_token: tokens.access_token ?? undefined,
            refresh_token: tokens.refresh_token ?? undefined,
            expiry_date: tokens.expiry_date ?? undefined,
            token_type: tokens.token_type ?? undefined,
            scope: grantedScope,
            id_token: tokens.id_token ?? undefined,
          });
        }

        // Update Google client
        if (this.googleClient && tokens.access_token) {
          this.googleClient.setCredentials(tokens.access_token, tokens.refresh_token ?? undefined);
          // Update client scopes only when Google explicitly returned them.
          if (grantedScope) {
            this.googleClient.setScopes(grantedScope.split(' '));
          }
        }

        // Start token manager for proactive refresh (Phase 1, Task 1.1)
        if (tokens.refresh_token) {
          this.startTokenManager(oauthClient);
        }

        this.pendingReauthState = undefined;

        // Restore session state from before the OAuth redirect
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
    };
  }

  private async handleCallback(request: AuthCallbackInput): Promise<AuthResponse> {
    const oauthClient = this.createOAuthClient();
    if (!oauthClient) {
      return {
        success: false,
        error: {
          code: ErrorCodes.CONFIG_ERROR,
          message: 'OAuth client credentials are not configured.',
          retryable: false,
          resolution:
            'Update to the latest ServalSheets version (embedded credentials), or set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET (or GOOGLE_CLIENT_ID/SECRET) in your environment.',
        },
      };
    }

    cleanupExpiredSessionStates();

    if (!request.state || !verifyOAuthState(request.state)) {
      return {
        success: false,
        error: {
          code: ErrorCodes.AUTH_ERROR,
          message: 'OAuth state verification failed. Possible CSRF attack or expired session.',
          retryable: true,
          suggestedFix: 'Restart the login flow with sheets_auth action "login".',
        },
      };
    }

    // Gap 1 Fix: Wrap OAuth token exchange with retry logic
    const tokenResponse = await executeWithRetry(
      async (_signal) => {
        return await oauthClient.getToken(request.code);
      },
      {
        maxRetries: 2, // Total of 3 attempts (initial + 2 retries)
        baseDelayMs: 1000, // Start with 1s delay
        maxDelayMs: 30000, // Cap at 30s
        timeoutMs: 30000, // 30s timeout per attempt
      }
    );
    const { tokens } = tokenResponse;
    oauthClient.setCredentials(tokens);

    // Only trust scopes returned by Google for this callback.
    const callbackScope = tokens.scope;

    // Validate that the critical Sheets scope was granted
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

    if (this.tokenStoreKey) {
      const tokenStore = new EncryptedFileTokenStore(this.tokenStorePath!, this.tokenStoreKey);
      await tokenStore.save({
        access_token: tokens.access_token ?? undefined,
        refresh_token: tokens.refresh_token ?? undefined,
        expiry_date: tokens.expiry_date ?? undefined,
        token_type: tokens.token_type ?? undefined,
        scope: callbackScope,
        id_token: tokens.id_token ?? undefined,
      });
    }

    if (this.googleClient && tokens.access_token) {
      this.googleClient.setCredentials(tokens.access_token, tokens.refresh_token ?? undefined);
      // Only update scopes when Google explicitly returned them for this callback.
      if (callbackScope) {
        this.googleClient.setScopes(callbackScope.split(' '));
      }
    }

    // Start token manager for proactive refresh (Phase 1, Task 1.1)
    if (tokens.refresh_token) {
      this.startTokenManager(oauthClient);
    }

    this.pendingReauthState = undefined;

    // Only restore session state when the manual callback includes the exact OAuth state token.
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

    this.pendingReauthState = undefined;

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

    let consecutiveRefreshFailures = 0;

    // Create new token manager with refresh callback
    this.tokenManager = new TokenManager({
      oauthClient,
      refreshThreshold: 0.8, // Refresh at 80% of token lifetime
      checkIntervalMs: 300000, // Check every 5 minutes
      onTokenRefreshed: async (tokens) => {
        consecutiveRefreshFailures = 0;
        this.pendingReauthState = undefined;

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
        consecutiveRefreshFailures++;
        logger.error('Token refresh failed', {
          error: error.message,
          consecutiveFailures: consecutiveRefreshFailures,
          recommendation: 'User may need to re-authenticate',
        });

        if (consecutiveRefreshFailures >= 3) {
          this.pendingReauthState = {
            authUrl: this.createFreshAuthUrl(oauthClient, this.googleClient?.scopes),
            failureCount: consecutiveRefreshFailures,
            lastError: error.message,
          };
        }
      },
    });

    // Start background monitoring
    this.tokenManager.start();
    logger.info('Token manager started for proactive refresh');
  }

  // ---------------------------------------------------------------------------
  // setup_feature wizard
  // ---------------------------------------------------------------------------

  private async handleSetupFeature(req: AuthSetupFeatureInput): Promise<AuthResponse> {
    let feature = (req as { feature?: string }).feature as
      | 'connectors'
      | 'sampling'
      | 'webhooks'
      | 'federation'
      | undefined;

    // If feature not provided and elicitation is available, ask the user
    if (!feature && this.elicitationServer) {
      try {
        const result = await safeElicit<{ feature: string } | null>(
          this.elicitationServer,
          {
            mode: 'form',
            message:
              'Which optional feature would you like to configure? All credentials are encrypted and persist across Claude Desktop restarts.',
            requestedSchema: {
              type: 'object',
              properties: {
                feature: selectField({
                  title: 'Feature to configure',
                  description: 'Select the feature you want to set up',
                  options: [
                    {
                      label:
                        'Data Connectors — live market data (Finnhub, FRED, Alpha Vantage, Polygon, FMP)',
                      value: 'connectors',
                    },
                    {
                      label: 'AI Sampling — Anthropic API key for formula suggestions & analysis',
                      value: 'sampling',
                    },
                    {
                      label: 'Webhooks — Redis URL for push notifications on sheet changes',
                      value: 'webhooks',
                    },
                    {
                      label: 'Federation — Connect to remote MCP servers',
                      value: 'federation',
                    },
                  ],
                }),
              },
            },
          },
          null
        );
        if (result?.feature) {
          feature = result.feature as 'connectors' | 'sampling' | 'webhooks' | 'federation';
        }
      } catch {
        // Elicitation not supported — fall through to instructions
      }
    }

    if (!feature) {
      return {
        success: true,
        action: 'setup_feature',
        message: 'Call setup_feature with a feature value to configure that feature.',
        instructions: [
          'Available features:',
          '  feature: "connectors" — API keys for live data connectors (Finnhub, FRED, Alpha Vantage, Polygon, FMP)',
          '  feature: "sampling"   — ANTHROPIC_API_KEY for AI-powered formula suggestions & analysis',
          '  feature: "webhooks"   — REDIS_URL for push notification webhooks on spreadsheet changes',
          '  feature: "federation" — MCP_FEDERATION_SERVERS to call tools on remote MCP servers',
          '',
          'All credentials are encrypted at rest and restored automatically on restart.',
        ],
      };
    }

    switch (feature) {
      case 'connectors':
        return this.setupConnector(req);
      case 'sampling':
        return this.setupSampling(req);
      case 'webhooks':
        return this.setupWebhooks(req);
      case 'federation':
        return this.setupFederation(req);
    }
  }

  private async setupConnector(req: AuthSetupFeatureInput): Promise<AuthResponse> {
    const CONNECTOR_INFO: Record<string, { name: string; signupUrl: string; hint: string }> = {
      finnhub: {
        name: 'Finnhub',
        signupUrl: 'https://finnhub.io/register',
        hint: 'Free tier: 60 req/min — stocks, earnings, news',
      },
      fred: {
        name: 'FRED (Federal Reserve)',
        signupUrl: 'https://fred.stlouisfed.org/docs/api/api_key.html',
        hint: 'Free — economic indicators, interest rates, GDP',
      },
      alpha_vantage: {
        name: 'Alpha Vantage',
        signupUrl: 'https://www.alphavantage.co/support/#api-key',
        hint: 'Free tier: 5 req/min — stocks, forex, crypto',
      },
      polygon: {
        name: 'Polygon.io',
        signupUrl: 'https://polygon.io/dashboard/signup',
        hint: 'Free tier: 5 req/min — real-time & historical market data',
      },
      fmp: {
        name: 'Financial Modeling Prep',
        signupUrl: 'https://financialmodelingprep.com/developer/docs',
        hint: 'Free tier: 250 req/day — financial statements, fundamentals',
      },
    };

    let connectorId = (req as { connectorId?: string }).connectorId as
      | 'finnhub'
      | 'fred'
      | 'alpha_vantage'
      | 'polygon'
      | 'fmp'
      | undefined;

    if (!connectorId && this.elicitationServer) {
      try {
        const result = await safeElicit<{ connectorId: string } | null>(
          this.elicitationServer,
          {
            mode: 'form',
            message: 'Which data connector would you like to configure?',
            requestedSchema: {
              type: 'object',
              properties: {
                connectorId: selectField({
                  title: 'Connector',
                  description: 'Select the data source to configure',
                  options: [
                    { label: 'Finnhub — stocks, earnings, news (free tier)', value: 'finnhub' },
                    { label: 'FRED — economic indicators, GDP, rates (free)', value: 'fred' },
                    {
                      label: 'Alpha Vantage — stocks, forex, crypto (free tier)',
                      value: 'alpha_vantage',
                    },
                    { label: 'Polygon.io — real-time market data', value: 'polygon' },
                    { label: 'FMP — financial statements & fundamentals', value: 'fmp' },
                  ],
                }),
              },
            },
          },
          null
        );
        if (result?.connectorId) {
          connectorId = result.connectorId as
            | 'finnhub'
            | 'fred'
            | 'alpha_vantage'
            | 'polygon'
            | 'fmp';
        }
      } catch {
        // Elicitation not supported
      }
    }

    if (!connectorId) {
      return {
        success: true,
        action: 'setup_feature',
        message: 'Specify connectorId to configure a data connector.',
        instructions: [
          'Call: sheets_auth { "action": "setup_feature", "feature": "connectors", "connectorId": "<id>", "apiKey": "<key>" }',
          'Connector IDs: finnhub | fred | alpha_vantage | polygon | fmp',
        ],
      };
    }

    const info = CONNECTOR_INFO[connectorId];
    let apiKey = (req as { apiKey?: string }).apiKey;

    if (!apiKey && this.elicitationServer && info) {
      // Open signup page so the user can get a key
      try {
        await initiateOAuthFlow(this.elicitationServer, {
          authUrl: info.signupUrl,
          provider: info.name,
          scopes: [],
        });
      } catch {
        // Optional
      }
      try {
        const keyResult = await safeElicit<{ apiKey: string } | null>(
          this.elicitationServer,
          {
            mode: 'form',
            message: `Enter your ${info.name} API key. ${info.hint}`,
            requestedSchema: {
              type: 'object',
              properties: {
                apiKey: stringField({
                  title: 'API Key',
                  description: `Paste your ${info.name} API key`,
                  minLength: 4,
                }),
              },
            },
          },
          null
        );
        if (keyResult?.apiKey) {
          apiKey = keyResult.apiKey;
        }
      } catch {
        // Elicitation not supported
      }
    }

    if (!apiKey) {
      return {
        success: true,
        action: 'setup_feature',
        message: `Get a ${info?.name ?? connectorId} API key, then provide it via apiKey parameter.`,
        instructions: [
          `1. Sign up at: ${info?.signupUrl ?? 'the provider website'}`,
          `2. Copy your API key`,
          `3. Call: sheets_auth { "action": "setup_feature", "feature": "connectors", "connectorId": "${connectorId}", "apiKey": "<your-key>" }`,
          '4. The key will be encrypted and restored automatically on restart',
        ],
      };
    }

    // Configure via ConnectorManager (handles encrypted persistence to .serval/connectors/)
    try {
      const { connectorManager } = await import('../connectors/connector-manager.js');
      const configured = await connectorManager.configure(connectorId, {
        type: 'api_key' as const,
        apiKey,
      });
      if (!configured.success) {
        return {
          success: false,
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: `Health check failed: ${configured.message}`,
            retryable: true,
            suggestedFix: 'Verify your API key and try again.',
          },
        };
      }
      return {
        success: true,
        action: 'setup_feature',
        message: `${info?.name ?? connectorId} configured, verified, and encrypted.`,
        instructions: [
          `${info?.name ?? connectorId} is ready. Use sheets_connectors to query live data.`,
          `Example: sheets_connectors { "action": "query", "connectorId": "${connectorId}", "endpoint": "...", "params": {} }`,
          'Key persists across Claude Desktop restarts (stored at .serval/connectors/)',
        ],
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: `Failed to configure connector: ${err instanceof Error ? err.message : String(err)}`,
          retryable: true,
        },
      };
    }
  }

  private async setupSampling(req: AuthSetupFeatureInput): Promise<AuthResponse> {
    let apiKey = (req as { apiKey?: string }).apiKey;

    if (!apiKey && this.elicitationServer) {
      try {
        await initiateOAuthFlow(this.elicitationServer, {
          authUrl: 'https://console.anthropic.com/settings/keys',
          provider: 'Anthropic',
          scopes: [],
        });
      } catch {
        // Optional
      }
      try {
        const result = await safeElicit<{ apiKey: string } | null>(
          this.elicitationServer,
          {
            mode: 'form',
            message:
              'Enter your Anthropic API key to enable AI-powered formula suggestions, data analysis, and auto-enhance. Free tier available.',
            requestedSchema: {
              type: 'object',
              properties: {
                apiKey: stringField({
                  title: 'Anthropic API Key',
                  description:
                    'Starts with sk-ant-... — get one at console.anthropic.com/settings/keys',
                  minLength: 20,
                }),
              },
            },
          },
          null
        );
        if (result?.apiKey) {
          apiKey = result.apiKey;
        }
      } catch {
        // Elicitation not supported
      }
    }

    if (!apiKey) {
      return {
        success: true,
        action: 'setup_feature',
        message:
          'Get an Anthropic API key to enable AI-powered features, then provide it via apiKey.',
        instructions: [
          '1. Visit https://console.anthropic.com/settings/keys',
          '2. Create an API key (free credits available)',
          '3. Call: sheets_auth { "action": "setup_feature", "feature": "sampling", "apiKey": "sk-ant-..." }',
          '4. Key is encrypted and restored automatically on restart',
        ],
      };
    }

    // Apply immediately to current process + persist for future restarts
    process.env['ANTHROPIC_API_KEY'] = apiKey;
    await runtimeConfigStore.save('ANTHROPIC_API_KEY', apiKey);

    return {
      success: true,
      action: 'setup_feature',
      message: 'Anthropic API key saved. MCP sampling and AI analysis are now enabled.',
      instructions: [
        'AI features unlocked for this session and future restarts:',
        '  • sheets_analyze action "generate_formula" — AI formula builder',
        '  • sheets_analyze action "suggest_visualization" — chart recommendations',
        '  • sheets_analyze action "auto_enhance" — intelligent spreadsheet improvements',
        '  • sheets_compute action "sklearn_model" — ML model training',
        'Key encrypted at .serval/runtime-keys.json',
      ],
    };
  }

  private async setupWebhooks(req: AuthSetupFeatureInput): Promise<AuthResponse> {
    // apiKey field repurposed to carry the Redis URL (no dedicated URL field in schema)
    let redisUrl = (req as { apiKey?: string }).apiKey;

    if (!redisUrl && this.elicitationServer) {
      try {
        const result = await safeElicit<{ redisUrl: string } | null>(
          this.elicitationServer,
          {
            mode: 'form',
            message:
              'Enter your Redis connection URL to enable spreadsheet change webhooks. Free options: Upstash (upstash.com) or Redis Cloud.',
            requestedSchema: {
              type: 'object',
              properties: {
                redisUrl: stringField({
                  title: 'Redis URL',
                  description:
                    'Format: redis://[:password@]host[:port][/db] or rediss:// for TLS. Example: redis://localhost:6379',
                  minLength: 8,
                }),
              },
            },
          },
          null
        );
        if (result?.redisUrl) {
          redisUrl = result.redisUrl;
        }
      } catch {
        // Elicitation not supported
      }
    }

    if (!redisUrl) {
      return {
        success: true,
        action: 'setup_feature',
        message: 'Provide a Redis URL via apiKey parameter to enable webhooks.',
        instructions: [
          'Free Redis options:',
          '  • Upstash (serverless): https://upstash.com',
          '  • Redis Cloud free tier: https://redis.com/try-free/',
          '',
          'Then call: sheets_auth { "action": "setup_feature", "feature": "webhooks", "apiKey": "redis://..." }',
          'Note: Pass the Redis URL as the apiKey parameter value.',
        ],
      };
    }

    process.env['REDIS_URL'] = redisUrl;
    await runtimeConfigStore.save('REDIS_URL', redisUrl);

    return {
      success: true,
      action: 'setup_feature',
      message: 'Redis URL saved. Webhook support is now enabled.',
      instructions: [
        'Webhooks are ready for this session and future restarts:',
        '  • sheets_webhook action "register" — register a webhook endpoint',
        '  • sheets_webhook action "watch_changes" — subscribe to cell/range changes',
        '  • sheets_webhook action "list" — see active webhooks',
        'URL encrypted at .serval/runtime-keys.json',
      ],
    };
  }

  private async setupFederation(req: AuthSetupFeatureInput): Promise<AuthResponse> {
    // apiKey field carries the JSON server list
    let serversJson = (req as { apiKey?: string }).apiKey;

    if (!serversJson && this.elicitationServer) {
      try {
        const result = await safeElicit<{ serversJson: string } | null>(
          this.elicitationServer,
          {
            mode: 'form',
            message:
              'Enter the list of remote MCP servers to connect to, as a JSON array. Each server needs a name and URL.',
            requestedSchema: {
              type: 'object',
              properties: {
                serversJson: stringField({
                  title: 'Federation Servers (JSON)',
                  description:
                    'JSON array, e.g.: [{"name":"my-server","url":"http://localhost:4000"}]. Or JSON object map.',
                  minLength: 2,
                }),
              },
            },
          },
          null
        );
        if (result?.serversJson) {
          serversJson = result.serversJson;
        }
      } catch {
        // Elicitation not supported
      }
    }

    if (!serversJson) {
      return {
        success: true,
        action: 'setup_feature',
        message: 'Provide MCP federation server configuration via the apiKey parameter.',
        instructions: [
          'Format: JSON array — [{"name":"server-name","url":"http://host:port"}]',
          '',
          'Example: sheets_auth {',
          '  "action": "setup_feature",',
          '  "feature": "federation",',
          '  "apiKey": "[{\\"name\\":\\"my-server\\",\\"url\\":\\"http://localhost:4000\\"}]"',
          '}',
          'Note: Pass the JSON as the apiKey parameter value.',
        ],
      };
    }

    // Validate JSON before saving
    try {
      JSON.parse(serversJson);
    } catch {
      return {
        success: false,
        error: {
          code: ErrorCodes.INVALID_PARAMS,
          message: 'Invalid JSON for federation servers. Expected a JSON array or object.',
          retryable: true,
          suggestedFix: 'Example: [{"name":"my-server","url":"http://localhost:4000"}]',
        },
      };
    }

    process.env['MCP_FEDERATION_SERVERS'] = serversJson;
    process.env['MCP_FEDERATION_ENABLED'] = 'true';
    await runtimeConfigStore.save('MCP_FEDERATION_SERVERS', serversJson);
    await runtimeConfigStore.save('MCP_FEDERATION_ENABLED', 'true');

    let serverCount = 0;
    try {
      const parsed = JSON.parse(serversJson) as unknown;
      serverCount = Array.isArray(parsed) ? parsed.length : Object.keys(parsed as object).length;
    } catch {
      // best-effort
    }

    return {
      success: true,
      action: 'setup_feature',
      message: `${serverCount} federation server${serverCount !== 1 ? 's' : ''} saved. MCP federation is now enabled.`,
      instructions: [
        'Federation is ready for this session and future restarts:',
        '  • sheets_federation action "list_servers" — see available remote servers',
        '  • sheets_federation action "get_server_tools" — discover tools on a server',
        '  • sheets_federation action "call_remote" — invoke a remote tool',
        'Config encrypted at .serval/runtime-keys.json',
      ],
    };
  }

  private createOAuthClient(): OAuth2Client | null {
    if (!this.oauthClientId || !this.oauthClientSecret) {
      return null;
    }
    return new google.auth.OAuth2(this.oauthClientId, this.oauthClientSecret, this.redirectUri);
  }

  private createFreshAuthUrl(oauthClient: OAuth2Client, scopes?: string[]): string {
    const requestedScopes =
      scopes && scopes.length > 0
        ? Array.from(new Set(scopes))
        : Array.from(getRecommendedScopes());
    const state = generateOAuthState();

    try {
      cleanupExpiredSessionStates();
      const exportedState = getSessionContext().exportState();
      pendingSessionStates.set(state, {
        exportedState,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });
    } catch (err) {
      logger.warn('Failed to export session state before OAuth redirect', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return oauthClient.generateAuthUrl({
      access_type: 'offline',
      scope: requestedScopes,
      prompt: 'consent',
      include_granted_scopes: true,
      state,
    });
  }
}
