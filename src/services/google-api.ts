/**
 * ServalSheets - Google API Client
 *
 * Initializes and provides Google Sheets and Drive API clients
 * MCP Protocol: 2025-11-25
 */

import { google, sheets_v4, drive_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { executeWithRetry, type RetryOptions } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import {
  EncryptedFileTokenStore,
  type TokenStore,
  type StoredTokens,
} from "./token-store.js";
import { CircuitBreaker } from "../utils/circuit-breaker.js";
import { getCircuitBreakerConfig } from "../config/env.js";
import PQueue from "p-queue";
import { getRequestContext } from "../utils/request-context.js";
import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";
import { ServiceError } from "../core/errors.js";
import { TokenManager } from "./token-manager.js";
import {
  logHTTP2Capabilities,
  validateHTTP2Config,
} from "../utils/http2-detector.js";

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

export type GoogleAuthType =
  | "service_account"
  | "oauth"
  | "access_token"
  | "application_default";

/**
 * Default scopes - minimal permissions (drive.file only)
 * Use this for most operations
 */
export const DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file", // Only files created/opened by app
];

/**
 * Elevated scopes - full drive access
 * Required for: sharing, permissions, listing all files, ownership transfer
 */
export const ELEVATED_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive", // Full drive access
];

/**
 * Read-only scopes for analysis operations
 */
export const READONLY_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

/**
 * Create HTTP agents with connection pooling
 * Optimizes performance by reusing TCP connections
 */
function createHttpAgents(): { http: HttpAgent; https: HttpsAgent } {
  const maxSockets = parseInt(process.env["GOOGLE_API_MAX_SOCKETS"] ?? "50");
  const keepAliveTimeout = parseInt(
    process.env["GOOGLE_API_KEEPALIVE_TIMEOUT"] ?? "30000",
  );

  const agentOptions = {
    keepAlive: true,
    keepAliveMsecs: keepAliveTimeout,
    maxSockets,
    maxFreeSockets: Math.floor(maxSockets / 2),
    timeout: 60000,
    scheduling: "lifo" as const, // Use most recent connection first
  };

  return {
    http: new HttpAgent(agentOptions),
    https: new HttpsAgent(agentOptions),
  };
}

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
  private circuit: CircuitBreaker;
  private tokenRefreshQueue: PQueue;
  private tokenListener?: (
    tokens: import("google-auth-library").Credentials,
  ) => void;
  private httpAgents: { http: HttpAgent; https: HttpsAgent };
  private _authType: GoogleAuthType;
  private tokenManager?: TokenManager;

  constructor(options: GoogleApiClientOptions = {}) {
    this.options = options;
    this._authType = options.serviceAccountKeyPath
      ? "service_account"
      : options.credentials
        ? "oauth"
        : options.accessToken
          ? "access_token"
          : "application_default";
    // Determine scopes based on options
    this._scopes =
      options.scopes ??
      (options.elevatedAccess ? ELEVATED_SCOPES : DEFAULT_SCOPES);
    this.retryOptions = options.retryOptions;
    this.timeoutMs = options.timeoutMs;
    this.tokenStore = options.tokenStore;
    if (!this.tokenStore && options.tokenStorePath && options.tokenStoreKey) {
      this.tokenStore = new EncryptedFileTokenStore(
        options.tokenStorePath,
        options.tokenStoreKey,
      );
    }

    // Initialize circuit breaker
    const circuitConfig = getCircuitBreakerConfig();
    this.circuit = new CircuitBreaker({
      ...circuitConfig,
      name: "google-api",
    });

    // Initialize token refresh queue (prevents concurrent refreshes)
    this.tokenRefreshQueue = new PQueue({ concurrency: 1 });

    // Initialize HTTP agents with connection pooling
    this.httpAgents = createHttpAgents();
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
    this.initializeTokenManager();

    // Log HTTP/2 capabilities at initialization
    logHTTP2Capabilities();

    // Enable HTTP/2 for improved performance (5-15% latency reduction)
    // gaxios automatically negotiates HTTP/2 via ALPN if server supports it
    const enableHTTP2 =
      process.env["GOOGLE_API_HTTP2_ENABLED"] !== "false"; // Enabled by default

    // Validate HTTP/2 configuration
    const validation = validateHTTP2Config(enableHTTP2);
    if (validation.warnings.length > 0) {
      logger.warn("HTTP/2 configuration warnings", {
        warnings: validation.warnings,
      });
    }

    // Initialize API clients with HTTP/2 enabled
    const sheetsApi = google.sheets({
      version: "v4",
      auth: this.auth,
      // Enable HTTP/2 for automatic protocol negotiation via ALPN
      http2: enableHTTP2,
    });
    const driveApi = google.drive({
      version: "v3",
      auth: this.auth,
      http2: enableHTTP2,
    });

    logger.info("Google API clients initialized", {
      http2Enabled: enableHTTP2,
      expectedLatencyReduction: enableHTTP2 ? "5-15%" : "N/A",
    });

    // Configure transport options for auth client
    if (this.auth && "transporter" in this.auth) {
      const transporter = (this.auth as unknown as Record<string, unknown>)[
        "transporter"
      ] as Record<string, unknown> | undefined;
      if (transporter && transporter["defaults"]) {
        const defaults = transporter["defaults"] as Record<string, unknown>;
        defaults["agent"] = this.httpAgents.https;
        defaults["httpAgent"] = this.httpAgents.http;
      }
    }

    this._sheets = wrapGoogleApi(sheetsApi, {
      ...(this.retryOptions ?? {}),
      timeoutMs: this.timeoutMs,
      circuit: this.circuit,
    });
    this._drive = wrapGoogleApi(driveApi, {
      ...(this.retryOptions ?? {}),
      timeoutMs: this.timeoutMs,
      circuit: this.circuit,
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
        logger.warn("Failed to load token store", { error });
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
    if (
      !this.auth ||
      !(this.auth instanceof google.auth.OAuth2) ||
      !this.tokenStore
    ) {
      return;
    }

    // Remove existing listener if any
    if (this.tokenListener) {
      this.auth.off("tokens", this.tokenListener);
    }

    // Create and store the listener
    this.tokenListener = async (
      tokens: import("google-auth-library").Credentials,
    ) => {
      // Wrap in queue to prevent concurrent token refreshes
      await this.tokenRefreshQueue.add(async () => {
        const current = this.sanitizeTokens({
          ...(this.auth?.credentials ?? {}),
        } as Record<string, unknown>);
        const incoming = this.sanitizeTokens(tokens as Record<string, unknown>);
        const merged = this.mergeTokens(current, incoming);

        logger.debug("Token refresh triggered", {
          hasAccessToken: Boolean(merged.access_token),
          hasRefreshToken: Boolean(merged.refresh_token),
        });

        await this.safeSaveTokens(merged);
      });
    };

    this.auth.on("tokens", this.tokenListener);
  }

  private sanitizeTokens(tokens: Record<string, unknown>): StoredTokens {
    const sanitized: StoredTokens = {};
    const allowedKeys: Array<keyof StoredTokens> = [
      "access_token",
      "refresh_token",
      "expiry_date",
      "token_type",
      "scope",
      "id_token",
    ];
    for (const key of allowedKeys) {
      const value = tokens[key as string];
      if (value !== null && value !== undefined) {
        sanitized[key] = value as never;
      }
    }
    return sanitized;
  }

  private mergeTokens(
    base: StoredTokens | null,
    updates: StoredTokens,
  ): StoredTokens {
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
      logger.warn("Failed to save tokens", { error });
    }
  }

  /**
   * Initialize proactive token refresh manager
   */
  private initializeTokenManager(): void {
    // Only enable for OAuth2 clients with refresh tokens
    if (!this.auth || !(this.auth instanceof google.auth.OAuth2)) {
      return;
    }

    const credentials = this.auth.credentials;
    if (!credentials.refresh_token) {
      logger.debug(
        "No refresh token available, skipping token manager initialization",
      );
      return;
    }

    logger.info("Initializing proactive token manager");

    this.tokenManager = new TokenManager({
      oauthClient: this.auth,
      refreshThreshold: 0.8, // Refresh at 80% of token lifetime
      checkIntervalMs: 300000, // Check every 5 minutes
      onTokenRefreshed: async (_tokens) => {
        logger.info("Token proactively refreshed by TokenManager");
        // Tokens are automatically saved by the 'tokens' event listener
      },
      onRefreshError: (error) => {
        logger.error("Token refresh failed in TokenManager", {
          error: error.message,
        });
      },
    });

    this.tokenManager.start();
  }

  /**
   * Get Sheets API client
   */
  get sheets(): sheets_v4.Sheets {
    if (!this._sheets) {
      throw new ServiceError(
        "Google API client not initialized",
        "SERVICE_NOT_INITIALIZED",
        "GoogleAPI",
        false,
        { method: "sheets", hint: "Call initialize() first" },
      );
    }
    return this._sheets;
  }

  /**
   * Get Drive API client
   */
  get drive(): drive_v3.Drive {
    if (!this._drive) {
      throw new ServiceError(
        "Google API client not initialized",
        "SERVICE_NOT_INITIALIZED",
        "GoogleAPI",
        false,
        { method: "drive", hint: "Call initialize() first" },
      );
    }
    return this._drive;
  }

  /**
   * Get OAuth2 client for token management
   */
  get oauth2(): OAuth2Client {
    if (!this.auth) {
      throw new ServiceError(
        "Google API client not initialized",
        "SERVICE_NOT_INITIALIZED",
        "GoogleAPI",
        false,
        { method: "oauth2", hint: "Call initialize() first" },
      );
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
   * Get authentication type
   */
  get authType(): GoogleAuthType {
    return this._authType;
  }

  /**
   * Get token status for OAuth-based auth
   */
  getTokenStatus(): {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    expiryDate?: number;
    scope?: string;
  } {
    if (!this.auth || !(this.auth instanceof google.auth.OAuth2)) {
      return {
        hasAccessToken: false,
        hasRefreshToken: false,
      };
    }

    const { access_token, refresh_token, expiry_date, scope } =
      this.auth.credentials;
    return {
      hasAccessToken: Boolean(access_token),
      hasRefreshToken: Boolean(refresh_token),
      expiryDate: typeof expiry_date === "number" ? expiry_date : undefined,
      scope,
    };
  }

  /**
   * Check if elevated access is available
   */
  get hasElevatedAccess(): boolean {
    return this._scopes.includes("https://www.googleapis.com/auth/drive");
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(additionalScopes?: string[]): string {
    if (!this.auth || !(this.auth instanceof google.auth.OAuth2)) {
      throw new ServiceError(
        "OAuth2 client not configured",
        "AUTH_ERROR",
        "GoogleAPI",
        false,
        { method: "getAuthUrl", hint: "Provide OAuth client credentials" },
      );
    }
    const scopes = additionalScopes
      ? [...new Set([...this._scopes, ...additionalScopes])]
      : this._scopes;

    return this.auth.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent", // Force consent to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getToken(
    code: string,
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    if (!this.auth || !(this.auth instanceof google.auth.OAuth2)) {
      throw new ServiceError(
        "OAuth2 client not configured",
        "AUTH_ERROR",
        "GoogleAPI",
        false,
        { method: "getToken", hint: "Provide OAuth client credentials" },
      );
    }
    const { tokens } = await this.auth.getToken(code);
    this.auth.setCredentials(tokens);
    await this.safeSaveTokens(
      this.sanitizeTokens(tokens as Record<string, unknown>),
    );
    const result: { accessToken: string; refreshToken?: string } = {
      accessToken: tokens.access_token ?? "",
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
    if (!this.auth || !(this.auth instanceof google.auth.OAuth2)) {
      throw new ServiceError(
        "OAuth2 client not configured",
        "AUTH_ERROR",
        "GoogleAPI",
        false,
        { method: "setCredentials", hint: "Provide OAuth client credentials" },
      );
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
   * Get circuit breaker statistics
   */
  getCircuitStats(): unknown {
    return this.circuit.getStats();
  }

  /**
   * Log scope usage for audit trail
   * Particularly important for elevated scope operations
   */
  logScopeUsage(operation: string, resourceId?: string): void {
    if (this.hasElevatedAccess) {
      logger.info("Elevated scope operation", {
        operation,
        resourceId,
        scopes: this._scopes,
        category: "audit",
      });
    }
  }

  /**
   * Revoke access tokens
   */
  async revokeAccess(): Promise<void> {
    if (!this.auth) {
      throw new ServiceError(
        "Google API client not initialized",
        "SERVICE_NOT_INITIALIZED",
        "GoogleAPI",
        false,
        { method: "revokeAccess", hint: "Call initialize() first" },
      );
    }
    const credentials = this.auth.credentials;
    if (credentials.access_token) {
      await this.auth.revokeToken(credentials.access_token);
    }
  }

  /**
   * Clear stored tokens and in-memory credentials
   */
  async clearStoredTokens(): Promise<void> {
    if (this.tokenStore) {
      try {
        await this.tokenStore.clear();
      } catch (error) {
        logger.warn("Failed to clear token store", { error });
      }
    }

    if (this.auth && this.auth instanceof google.auth.OAuth2) {
      this.auth.setCredentials({});
    }
  }

  /**
   * Cleanup resources and remove event listeners
   * Prevents memory leaks from accumulating listeners
   */
  destroy(): void {
    // Stop token manager
    if (this.tokenManager) {
      this.tokenManager.stop();
      this.tokenManager = undefined;
    }

    // Remove token listener to prevent memory leak
    if (
      this.auth &&
      this.tokenListener &&
      this.auth instanceof google.auth.OAuth2
    ) {
      this.auth.off("tokens", this.tokenListener);
      this.tokenListener = undefined;
    }

    // Destroy HTTP agents to close persistent connections
    this.httpAgents.http.destroy();
    this.httpAgents.https.destroy();

    // Clear auth and API clients
    this.auth = null;
    this._sheets = null;
    this._drive = null;
  }
}

/**
 * Create and initialize a Google API client
 */
export async function createGoogleApiClient(
  options: GoogleApiClientOptions = {},
): Promise<GoogleApiClient> {
  const client = new GoogleApiClient(options);
  await client.initialize();
  return client;
}

function wrapGoogleApi<T extends object>(
  api: T,
  options?: RetryOptions & { circuit?: CircuitBreaker },
): T {
  const cache = new WeakMap<object, unknown>();
  const circuit = options?.circuit;

  const wrapObject = (obj: object): unknown => {
    if (cache.has(obj)) {
      return cache.get(obj);
    }

    const proxy = new Proxy(obj, {
      get(target, prop, receiver) {
        // Get property descriptor to check invariants
        const descriptor = Object.getOwnPropertyDescriptor(target, prop);

        // CRITICAL: For non-configurable, non-writable data properties,
        // we MUST return the exact target value (proxy invariant requirement).
        // We cannot wrap these - JavaScript enforces this strictly.
        if (
          descriptor &&
          !descriptor.configurable &&
          !descriptor.writable &&
          "value" in descriptor
        ) {
          // Return exact value - do NOT wrap, even for objects
          return descriptor.value;
        }

        const value = Reflect.get(target, prop, receiver);

        if (typeof value === "function") {
          return (...args: unknown[]) => {
            const operation = (): Promise<unknown> =>
              executeWithRetry((signal) => {
                const callArgs = injectSignal(args, signal);
                return (
                  value as (...params: unknown[]) => Promise<unknown>
                ).apply(target, callArgs);
              }, options);

            // Wrap with circuit breaker if available
            if (circuit) {
              return circuit.execute(operation);
            }

            return operation();
          };
        }

        // For configurable properties that are objects, we can wrap them
        if (value && typeof value === "object") {
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
  // Get request context for trace propagation
  const ctx = getRequestContext();
  const requestId = ctx?.requestId;

  // Build base options with signal and optional request ID header
  const baseOptions: Record<string, unknown> = { signal };
  if (requestId) {
    baseOptions["headers"] = { "x-request-id": requestId };
  }

  if (args.length === 0) {
    return [baseOptions];
  }

  const last = args[args.length - 1];
  if (typeof last === "function") {
    return args;
  }

  if (last && typeof last === "object" && !Array.isArray(last)) {
    const updated: Record<string, unknown> = {
      ...(last as Record<string, unknown>),
      signal,
    };

    // Merge headers if they exist
    if (requestId) {
      updated["headers"] = {
        ...((updated["headers"] as Record<string, unknown>) ?? {}),
        "x-request-id": requestId,
      };
    }

    return [...args.slice(0, -1), updated];
  }

  return [...args, baseOptions];
}
