/**
 * ServalSheets - Auth Handler
 *
 * Thin dispatch handler for OAuth authentication flows.
 * Action implementations are in src/handlers/auth-actions/
 */

import type { GoogleApiClient } from '../services/google-api.js';
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
import type { ElicitationServer } from '../mcp/elicitation.js';
import { logger } from '../utils/logger.js';
import { unwrapRequest } from './base.js';
import { mapStandaloneError } from './helpers/error-mapping.js';
import { applyVerbosityFilter } from './helpers/verbosity-filter.js';
import { ErrorCodes } from './error-codes.js';
import { markOnboardingComplete } from '../mcp/registration/tool-response.js';
import { handleStatus } from './auth-actions/status.js';
import { handleLogin, handleCallback, handleLogout } from './auth-actions/auth-flow.js';
import { handleSetupFeature } from './auth-actions/feature-setup.js';
import { createOAuthClient, createFreshAuthUrl } from './auth-actions/internal.js';
import { TokenManager } from '../services/token-manager.js';
import { EncryptedFileTokenStore } from '../services/token-store.js';

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
  private pendingOAuthElicitationId: { value?: string } = {};
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

  /** Start a TokenManager for the given OAuth2 client (used by tests and auth-flow). */
  startTokenManager(oauthClient: { refreshAccessToken: () => Promise<unknown>; setCredentials: (c: unknown) => void; generateAuthUrl?: (opts: unknown) => string }): void {
    if (this.tokenManager) {
      this.tokenManager.stop();
    }

    let consecutiveRefreshFailures = 0;

    this.tokenManager = new TokenManager({
      oauthClient: oauthClient as any,
      refreshThreshold: 0.8,
      checkIntervalMs: 300000,
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
          this.googleClient.setCredentials(
            tokens.access_token,
            tokens.refresh_token ?? undefined
          );
        }
      },
      onRefreshError: async (error: Error) => {
        consecutiveRefreshFailures++;
        logger.error('Token refresh failed', {
          error: error.message,
          consecutiveFailures: consecutiveRefreshFailures,
          recommendation: 'User may need to re-authenticate',
        });

        if (consecutiveRefreshFailures >= 3) {
          this.pendingReauthState = {
            authUrl: createFreshAuthUrl(oauthClient as any, this.googleClient?.scopes),
            failureCount: consecutiveRefreshFailures,
            lastError: error.message,
          };
        }
      },
    });

    this.tokenManager.start();
  }

  async handle(input: SheetsAuthInput): Promise<SheetsAuthOutput> {
    const req = unwrapRequest<SheetsAuthInput['request']>(input) as SheetsAuthInput['request'] & {
      verbosity?: 'minimal' | 'standard' | 'detailed';
    };
    const verbosity = req.verbosity ?? 'standard';

    try {
      let response: AuthResponse;
      const oauthClient = createOAuthClient(
        this.oauthClientId,
        this.oauthClientSecret,
        this.redirectUri
      );

      switch (req.action) {
        case 'status':
          response = await handleStatus(
            this.googleClient,
            this.pendingReauthState,
            { oauthClientId: this.oauthClientId, oauthClientSecret: this.oauthClientSecret }
          );
          markOnboardingComplete();
          break;
        case 'login': {
          const result = await handleLogin(
            oauthClient,
            req as AuthLoginInput,
            this.googleClient,
            this.tokenStorePath,
            this.tokenStoreKey,
            this.redirectUri,
            this.elicitationServer,
            this.pendingOAuthElicitationId
          );
          response = result.response;
          if (result.tokenManager) {
            this.tokenManager = result.tokenManager;
          }
          break;
        }
        case 'callback': {
          const result = await handleCallback(
            oauthClient,
            req as AuthCallbackInput,
            this.googleClient,
            this.tokenStorePath,
            this.tokenStoreKey,
            this.elicitationServer,
            this.pendingOAuthElicitationId
          );
          response = result.response;
          if (result.tokenManager) {
            this.tokenManager = result.tokenManager;
          }
          this.pendingReauthState = undefined;
          break;
        }
        case 'logout':
          response = await handleLogout(this.googleClient, this.tokenStorePath, this.tokenStoreKey);
          if (this.tokenManager) {
            this.tokenManager.stop();
            this.tokenManager = undefined;
          }
          this.pendingReauthState = undefined;
          break;
        case 'setup_feature':
          response = await handleSetupFeature(req as AuthSetupFeatureInput, this.elicitationServer);
          break;
        default: {
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
}
