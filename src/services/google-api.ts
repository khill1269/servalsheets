/**
 * ServalSheets - Google API Client
 * 
 * Initializes and provides Google Sheets and Drive API clients
 * MCP Protocol: 2025-11-25
 */

import { google, sheets_v4, drive_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { executeWithRetry, type RetryOptions } from '../utils/retry.js';
import { logger } from '../utils/logger.js';
import { EncryptedFileTokenStore, type TokenStore, type StoredTokens } from './token-store.js';

export interface GoogleApiClientOptions {
  credentials?: {
    clientId: string;
    clientSecret: string;
    redirectUri?: string;
  };
  accessToken?: string;
  refreshToken?: string;
  serviceAccountKeyPath?: string;
  scopes?: string[];
  /** Use elevated scopes (full drive access) - required for sharing/permissions */
  elevatedAccess?: boolean;
  /** Retry/backoff options for API calls */
  retryOptions?: RetryOptions;
  /** Per-request timeout for Google API calls (ms) */
  timeoutMs?: number;
  /** Encrypted token store path */
  tokenStorePath?: string;
  /** Encryption key (hex) for token store */
  tokenStoreKey?: string;
  /** Custom token store implementation */
  tokenStore?: TokenStore;
}

/**
 * Default scopes - minimal permissions (drive.file only)
 * Use this for most operations
 */
export const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',  // Only files created/opened by app
];

/**
 * Elevated scopes - full drive access
 * Required for: sharing, permissions, listing all files, ownership transfer
 */
export const ELEVATED_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',  // Full drive access
];

/**
 * Read-only scopes for analysis operations
 */
export const READONLY_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
];

/**
 * Google API client wrapper
 */
export class GoogleApiClient {
  private auth: OAuth2Client | null = null;
  private _sheets: sheets_v4.Sheets | null = null;
  private _drive: drive_v3.Drive | null = null;
  private options: GoogleApiClientOptions;
  private _scopes: string[];
  private retryOptions?: RetryOptions;
  private timeoutMs?: number;
  private tokenStore?: TokenStore;

  constructor(options: GoogleApiClientOptions = {}) {
    this.options = options;
    // Determine scopes based on options
    this._scopes = options.scopes ?? (options.elevatedAccess ? ELEVATED_SCOPES : DEFAULT_SCOPES);
    this.retryOptions = options.retryOptions;
    this.timeoutMs = options.timeoutMs;
    this.tokenStore = options.tokenStore;
    if (!this.tokenStore && options.tokenStorePath && options.tokenStoreKey) {
      this.tokenStore = new EncryptedFileTokenStore(options.tokenStorePath, options.tokenStoreKey);
    }
  }

  /**
   * Initialize authentication
   */
  async initialize(): Promise<void> {
    const scopes = this._scopes;

    if (this.options.serviceAccountKeyPath) {
      // Service account authentication
      const auth = new google.auth.GoogleAuth({
        keyFile: this.options.serviceAccountKeyPath,
        scopes,
      });
      this.auth = (await auth.getClient()) as OAuth2Client;
    } else if (this.options.credentials) {
      // OAuth2 authentication
      const { clientId, clientSecret, redirectUri } = this.options.credentials;
      this.auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    } else if (this.options.accessToken) {
      // Direct token
      this.auth = new google.auth.OAuth2();
    } else {
      // Application default credentials
      const auth = new google.auth.GoogleAuth({ scopes });
      this.auth = (await auth.getClient()) as OAuth2Client;
    }

    await this.loadStoredTokens();
    this.attachTokenListener();

    // Initialize API clients
    const sheetsApi = google.sheets({ version: 'v4', auth: this.auth });
    const driveApi = google.drive({ version: 'v3', auth: this.auth });

    this._sheets = wrapGoogleApi(sheetsApi, {
      ...(this.retryOptions ?? {}),
      timeoutMs: this.timeoutMs,
    });
    this._drive = wrapGoogleApi(driveApi, {
      ...(this.retryOptions ?? {}),
      timeoutMs: this.timeoutMs,
    });
  }

  private async loadStoredTokens(): Promise<void> {
    if (!this.auth || !(this.auth instanceof google.auth.OAuth2)) {
      return;
    }

    let storedTokens: StoredTokens | null = null;
    if (this.tokenStore) {
      try {
        storedTokens = await this.tokenStore.load();
      } catch (error) {
        logger.warn('Failed to load token store', { error });
      }
    }

    const explicitTokens: StoredTokens = this.sanitizeTokens({
      access_token: this.options.accessToken,
      refresh_token: this.options.refreshToken,
    });

    if (explicitTokens.access_token || explicitTokens.refresh_token) {
      this.auth.setCredentials(explicitTokens);
      if (this.tokenStore) {
        const merged = this.mergeTokens(storedTokens, explicitTokens);
        await this.safeSaveTokens(merged);
      }
      return;
    }

    if (storedTokens) {
      this.auth.setCredentials(storedTokens);
    }
  }

  private attachTokenListener(): void {
    if (!this.auth || !(this.auth instanceof google.auth.OAuth2) || !this.tokenStore) {
      return;
    }

    this.auth.on('tokens', async (tokens) => {
      const current = this.sanitizeTokens({ ...(this.auth?.credentials ?? {}) } as Record<string, unknown>);
      const incoming = this.sanitizeTokens(tokens as Record<string, unknown>);
      const merged = this.mergeTokens(current, incoming);
      await this.safeSaveTokens(merged);
    });
  }

  private sanitizeTokens(tokens: Record<string, unknown>): StoredTokens {
    const sanitized: StoredTokens = {};
    const allowedKeys: Array<keyof StoredTokens> = [
      'access_token',
      'refresh_token',
      'expiry_date',
      'token_type',
      'scope',
      'id_token',
    ];
    for (const key of allowedKeys) {
      const value = tokens[key as string];
      if (value !== null && value !== undefined) {
        sanitized[key] = value as never;
      }
    }
    return sanitized;
  }

  private mergeTokens(base: StoredTokens | null, updates: StoredTokens): StoredTokens {
    return {
      ...(base ?? {}),
      ...updates,
      access_token: updates.access_token ?? base?.access_token,
      refresh_token: updates.refresh_token ?? base?.refresh_token,
      expiry_date: updates.expiry_date ?? base?.expiry_date,
      token_type: updates.token_type ?? base?.token_type,
      scope: updates.scope ?? base?.scope,
      id_token: updates.id_token ?? base?.id_token,
    };
  }

  private async safeSaveTokens(tokens: StoredTokens): Promise<void> {
    if (!this.tokenStore) return;
    try {
      await this.tokenStore.save(tokens);
    } catch (error) {
      logger.warn('Failed to save tokens', { error });
    }
  }

  /**
   * Get Sheets API client
   */
  get sheets(): sheets_v4.Sheets {
    if (!this._sheets) {
      throw new Error('Google API client not initialized. Call initialize() first.');
    }
    return this._sheets;
  }

  /**
   * Get Drive API client
   */
  get drive(): drive_v3.Drive {
    if (!this._drive) {
      throw new Error('Google API client not initialized. Call initialize() first.');
    }
    return this._drive;
  }

  /**
   * Get OAuth2 client for token management
   */
  get oauth2(): OAuth2Client {
    if (!this.auth) {
      throw new Error('Google API client not initialized. Call initialize() first.');
    }
    return this.auth;
  }

  /**
   * Get current scopes
   */
  get scopes(): string[] {
    return [...this._scopes];
  }

  /**
   * Check if elevated access is available
   */
  get hasElevatedAccess(): boolean {
    return this._scopes.includes('https://www.googleapis.com/auth/drive');
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(additionalScopes?: string[]): string {
    if (!this.auth) {
      throw new Error('Google API client not initialized.');
    }
    const scopes = additionalScopes 
      ? [...new Set([...this._scopes, ...additionalScopes])]
      : this._scopes;
    
    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getToken(code: string): Promise<{ accessToken: string; refreshToken?: string }> {
    if (!this.auth) {
      throw new Error('Google API client not initialized.');
    }
    const { tokens } = await this.auth.getToken(code);
    this.auth.setCredentials(tokens);
    await this.safeSaveTokens(this.sanitizeTokens(tokens as Record<string, unknown>));
    const result: { accessToken: string; refreshToken?: string } = {
      accessToken: tokens.access_token ?? '',
    };
    if (tokens.refresh_token) {
      result.refreshToken = tokens.refresh_token;
    }
    return result;
  }

  /**
   * Update credentials
   */
  setCredentials(accessToken: string, refreshToken?: string): void {
    if (!this.auth) {
      throw new Error('Google API client not initialized.');
    }
    const tokens: StoredTokens = this.sanitizeTokens({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    this.auth.setCredentials(tokens);
    void this.safeSaveTokens(tokens);
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.auth !== null && this._sheets !== null;
  }

  /**
   * Revoke access tokens
   */
  async revokeAccess(): Promise<void> {
    if (!this.auth) {
      throw new Error('Google API client not initialized.');
    }
    const credentials = this.auth.credentials;
    if (credentials.access_token) {
      await this.auth.revokeToken(credentials.access_token);
    }
  }
}

/**
 * Create and initialize a Google API client
 */
export async function createGoogleApiClient(
  options: GoogleApiClientOptions = {}
): Promise<GoogleApiClient> {
  const client = new GoogleApiClient(options);
  await client.initialize();
  return client;
}

function wrapGoogleApi<T extends object>(api: T, options?: RetryOptions): T {
  const cache = new WeakMap<object, unknown>();

  const wrapObject = (obj: object): unknown => {
    if (cache.has(obj)) {
      return cache.get(obj);
    }

    const proxy = new Proxy(obj, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === 'function') {
          return (...args: unknown[]) => {
            return executeWithRetry((signal) => {
              const callArgs = injectSignal(args, signal);
              return (value as (...params: unknown[]) => Promise<unknown>).apply(target, callArgs);
            }, options);
          };
        }

        if (value && typeof value === 'object') {
          return wrapObject(value as object);
        }

        return value;
      },
    });

    cache.set(obj, proxy);
    return proxy;
  };

  return wrapObject(api) as T;
}

function injectSignal(args: unknown[], signal: AbortSignal): unknown[] {
  if (args.length === 0) {
    return [{ signal }];
  }

  const last = args[args.length - 1];
  if (typeof last === 'function') {
    return args;
  }

  if (last && typeof last === 'object' && !Array.isArray(last)) {
    return [...args.slice(0, -1), { ...(last as Record<string, unknown>), signal }];
  }

  return [...args, { signal }];
}
