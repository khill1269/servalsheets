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
import type { SheetsAuthInput, SheetsAuthOutput, AuthAction, AuthResponse } from '../schemas/auth.js';
import { initiateOAuthFlow } from '../mcp/elicitation.js';
import type { ElicitationServer } from '../mcp/elicitation.js';

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

  constructor(options: AuthHandlerOptions = {}) {
    const envConfig = getOAuthEnvConfig();

    this.googleClient = options.googleClient ?? null;
    this.oauthClientId = options.oauthClientId ?? envConfig.clientId;
    this.oauthClientSecret = options.oauthClientSecret ?? envConfig.clientSecret;
    this.redirectUri = options.redirectUri ?? envConfig.redirectUri ?? 'http://localhost:3000/callback';
    this.tokenStorePath = options.tokenStorePath ?? process.env['GOOGLE_TOKEN_STORE_PATH'] ?? getDefaultTokenStorePath();
    this.tokenStoreKey = options.tokenStoreKey ?? process.env['ENCRYPTION_KEY'];
    this.elicitationServer = options.elicitationServer;
  }

  async handle(input: SheetsAuthInput): Promise<SheetsAuthOutput> {
    const { request } = input;

    try {
      let response: AuthResponse;
      switch (request.action) {
        case 'status':
          response = await this.handleStatus();
          break;
        case 'login':
          response = await this.handleLogin(request);
          break;
        case 'callback':
          response = await this.handleCallback(request);
          break;
        case 'logout':
          response = await this.handleLogout();
          break;
        default: {
          // TypeScript exhaustiveness check - this should never be reached
          const exhaustiveCheck: never = request;
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

      return { response };
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

      return {
        success: true,
        action: 'status',
        authenticated: hasTokens,
        authType,
        hasAccessToken: tokenStatus.hasAccessToken,
        hasRefreshToken: tokenStatus.hasRefreshToken,
        scopes: this.googleClient.scopes,
        message: hasTokens
          ? 'OAuth credentials present. Ready to use sheets_* tools.'
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

  private async handleLogin(
    request: Extract<AuthAction, { action: 'login' }>
  ): Promise<AuthResponse> {
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

    if (this.elicitationServer) {
      try {
        await initiateOAuthFlow(this.elicitationServer, {
          authUrl,
          provider: 'Google',
          scopes: requestedScopes,
        });
      } catch {
        // Elicitation is optional; continue with normal response.
      }
    }

    return {
      success: true,
      action: 'login',
      authenticated: false,
      authUrl,
      scopes: requestedScopes,
      message: 'Visit the authorization URL to sign in, then provide the code.',
      instructions: [
        '1. Open the authorization URL and sign in to Google',
        '2. Approve the requested permissions',
        '3. Copy the authorization code from the redirect URL',
        '4. Call sheets_auth with action "callback" and the code',
      ],
    };
  }

  private async handleCallback(
    request: Extract<AuthAction, { action: 'callback' }>
  ): Promise<AuthResponse> {
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

  private createOAuthClient(): OAuth2Client | null {
    if (!this.oauthClientId || !this.oauthClientSecret) {
      return null;
    }
    return new google.auth.OAuth2(
      this.oauthClientId,
      this.oauthClientSecret,
      this.redirectUri
    );
  }
}
