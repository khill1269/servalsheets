/**
 * GoogleApiClient
 *
 * @purpose Primary interface to Google Sheets and Drive APIs with connection pooling and circuit breaker
 * @category Core
 * @usage Use this service for all Google API operations (sheets, drive); handles auth, retries, and rate limiting
 * @dependencies OAuth2Client, googleapis, TokenStore, CircuitBreaker, TokenManager
 * @stateful Yes - maintains OAuth client, circuit breaker state, token store, HTTP/2 connection pools
 * @singleton Yes - one instance per process to share connection pools and circuit breaker state
 *
 * @example
 * const client = new GoogleApiClient({ credentials, tokenStore });
 * await client.initialize();
 * const sheets = await client.getSheetsClient();
 * const response = await sheets.spreadsheets.get({ spreadsheetId });
 */

import {
  google,
  sheets_v4,
  drive_v3,
  bigquery_v2,
  docs_v1,
  slides_v1,
  drivelabels_v2,
  driveactivity_v2,
  workspaceevents_v1,
} from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { executeWithRetry, type RetryOptions } from '../utils/retry.js';
import { logger } from '../utils/logger.js';
import { EncryptedFileTokenStore, type TokenStore, type StoredTokens } from './token-store.js';
import { HybridTokenStore } from './keychain-store.js';
import {
  CircuitBreaker,
  QuotaCircuitBreaker,
  FallbackStrategies,
  type ICircuitBreaker,
} from '../utils/circuit-breaker.js';
import { getCircuitBreakerConfig, getEnv } from '../config/env.js';
import { circuitBreakerRegistry } from './circuit-breaker-registry.js';
import PQueue from 'p-queue';
import { getRequestContext } from '../utils/request-context.js';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { ServiceError } from '../core/errors.js';
import { TokenManager } from './token-manager.js';
import { logHTTP2Capabilities, validateHTTP2Config } from '../utils/http2-detector.js';

import {
  FULL_ACCESS_SCOPES,
  getConfiguredScopes,
  getRecommendedScopes,
} from '../config/oauth-scopes.js';
import { registerCleanup } from '../utils/resource-cleanup.js';
import { PerSpreadsheetThrottle } from './per-spreadsheet-throttle.js';

// Lazy-loaded metrics module — avoids dynamic import overhead on every API call
let _metricsModule: typeof import('../observability/metrics.js') | null = null;
async function getMetrics(): Promise<typeof import('../observability/metrics.js') | null> {
  if (_metricsModule) return _metricsModule;
  try {
    _metricsModule = await import('../observability/metrics.js');
    return _metricsModule;
  } catch {
    return null;
  }
}

// ============================================================================
// SHARED DRIVE RATE LIMITER (token bucket algorithm)
// ============================================================================

/**
 * Rate limiter for Shared Drive write operations.
 * Shared Drives have stricter write quotas than personal drives.
 * Uses a token bucket algorithm for smooth rate limiting.
 */
class SharedDriveRateLimiter {
  private tokens: number;
  private lastRefillTime: number = Date.now();
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second

  constructor(requestsPerSecond: number = 3) {
    this.capacity = requestsPerSecond;
    this.refillRate = requestsPerSecond;
    this.tokens = this.capacity;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTime) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillRate);
    this.lastRefillTime = now;
  }

  /**
   * Wait until a token is available, then consume it.
   * Returns the wait time in milliseconds.
   */
  async waitForToken(): Promise<number> {
    const startTime = Date.now();

    while (true) {
      this.refillTokens();

      if (this.tokens >= 1) {
        this.tokens--;
        return Date.now() - startTime;
      }

      // Sleep for a short time (10ms) to avoid busy-waiting
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

// Module-level singleton — shared across all GoogleApiClient instances so that
// concurrent calls from different client instances for the same spreadsheet
// still respect the per-spreadsheet RPS cap (src/config/env.ts:PER_SPREADSHEET_RPS).
const perSpreadsheetThrottle = new PerSpreadsheetThrottle();

export interface GoogleApiClientOptions {
  credentials?: {
    clientId: string;
    clientSecret: string;
    redirectUri?: string;
  };
  accessToken?: string;
  refreshToken?: string;
  oauthTokens?: StoredTokens;
  serviceAccountKeyPath?: string;
  scopes?: string[];
  /** @deprecated Use scopes array directly. Retained for backward compatibility. */
  elevatedAccess?: boolean;
  /** Retry/backoff options for API calls */
  retryOptions?: RetryOptions;
  /** Per-request timeout for Google API calls (ms) */
  timeoutMs?: number;
  /** Encrypted token store path */
  tokenStorePath?: string;
  /** Encryption key (hex) for token store */
  tokenStoreKey?: string;
  /** Use OS keychain for token storage (falls back to file if unavailable) */
  useKeychain?: boolean;
  /** Custom token store implementation */
  tokenStore?: TokenStore;
}

export type GoogleAuthType = 'service_account' | 'oauth' | 'access_token' | 'application_default';

/**
 * @deprecated Use getRecommendedScopes() from config/oauth-scopes.ts instead
 */
export const DEFAULT_SCOPES = Array.from(getRecommendedScopes());

/**
 * @deprecated Use FULL_ACCESS_SCOPES from config/oauth-scopes.ts instead
 */
export const ELEVATED_SCOPES = Array.from(FULL_ACCESS_SCOPES);

/**
 * @deprecated Use getRecommendedScopes() from config/oauth-scopes.ts instead
 */
export const READONLY_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
];

/**
 * @deprecated Use getRecommendedScopes() from config/oauth-scopes.ts instead
 */
export const BIGQUERY_SCOPES = [
  'https://www.googleapis.com/auth/bigquery',
  'https://www.googleapis.com/auth/cloud-platform',
];

/**
 * @deprecated Use getRecommendedScopes() from config/oauth-scopes.ts instead
 */
export const APPSSCRIPT_SCOPES = [
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.deployments',
  'https://www.googleapis.com/auth/script.processes',
];

/**
 * @deprecated Use FULL_ACCESS_SCOPES from config/oauth-scopes.ts instead
 */
export const FULL_SCOPES = Array.from(FULL_ACCESS_SCOPES);

function parsePositiveInteger(value: string | undefined): number | null {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolveGoogleApiAgentTimeoutMs(envSource: NodeJS.ProcessEnv = process.env): number {
  return (
    parsePositiveInteger(envSource['GOOGLE_API_TIMEOUT_MS']) ??
    parsePositiveInteger(envSource['GOOGLE_API_REQUEST_TIMEOUT_MS']) ??
    60000
  );
}

/**
 * Create HTTP agents with connection pooling
 * Optimizes performance by reusing TCP connections
 */
function createHttpAgents(): { http: HttpAgent; https: HttpsAgent } {
  const maxSockets = parseInt(process.env['GOOGLE_API_MAX_SOCKETS'] ?? '50');
  const keepAliveTimeout = parseInt(process.env['GOOGLE_API_KEEPALIVE_TIMEOUT'] ?? '30000');

  const agentOptions = {
    keepAlive: true,
    keepAliveMsecs: keepAliveTimeout,
    maxSockets,
    maxFreeSockets: Math.floor(maxSockets / 2),
    timeout: resolveGoogleApiAgentTimeoutMs(),
    scheduling: 'lifo' as const, // Use most recent connection first
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
  private _driveLabels: drivelabels_v2.Drivelabels | null = null;
  private _bigquery: bigquery_v2.Bigquery | null = null;
  private _docs: docs_v1.Docs | null = null;
  private _slides: slides_v1.Slides | null = null;
  private _driveActivity: driveactivity_v2.Driveactivity | null = null;
  private _workspaceEvents: workspaceevents_v1.Workspaceevents | null = null;
  private options: GoogleApiClientOptions;
  private _scopes: string[];
  private retryOptions?: RetryOptions;
  private timeoutMs?: number;
  private tokenStore?: TokenStore;
  private sheetsCircuit: QuotaCircuitBreaker;
  private driveCircuit: CircuitBreaker;
  private bigqueryCircuit: CircuitBreaker;
  private docsCircuit: CircuitBreaker;
  private slidesCircuit: CircuitBreaker;
  private tokenRefreshQueue: PQueue;
  private tokenListener?: (tokens: import('google-auth-library').Credentials) => void;
  private httpAgents: { http: HttpAgent; https: HttpsAgent };
  private _authType: GoogleAuthType;
  private tokenManager?: TokenManager;
  // Existence pre-check cache: spreadsheetId → expiry timestamp (Fix B).
  // Survives reinitializeApis() calls; invalidated explicitly on 404.
  private readonly spreadsheetExistenceCache = new Map<string, number>();
  private static readonly EXISTENCE_TTL_MS = 5 * 60 * 1000;
  private poolMonitorInterval?: NodeJS.Timeout;
  // Token validation cache to avoid excessive API calls
  private lastValidationResult?: { valid: boolean; error?: string };
  private lastValidationTime?: number;
  private static readonly VALIDATION_CACHE_TTL_MS = 60 * 1000; // 1 minute (reduced from 5min to detect token invalidation faster)

  // HTTP/2 Connection Health Management
  private consecutiveErrors = 0;
  private static readonly CONNECTION_ERROR_THRESHOLD = 5;
  private lastSuccessfulCall = Date.now();
  private connectionResetQueue: PQueue = new PQueue({ concurrency: 1 });
  private keepaliveInterval?: NodeJS.Timeout;

  // Shared Drive rate limiter
  private sharedDriveRateLimiter: SharedDriveRateLimiter;
  private sharedDriveMembershipCache = new Map<string, { value: boolean; timestamp: number }>();
  private static readonly DRIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly DRIVE_CACHE_MAX = 1000; // LRU eviction threshold

  constructor(options: GoogleApiClientOptions = {}) {
    this.options = options;
    this._authType = options.serviceAccountKeyPath
      ? 'service_account'
      : options.credentials
        ? 'oauth'
        : options.accessToken
          ? 'access_token'
          : 'application_default';
    // Determine scopes based on options (explicit scopes > legacy elevated flag > configured defaults)
    this._scopes =
      options.scopes ??
      (options.elevatedAccess ? Array.from(ELEVATED_SCOPES) : Array.from(getConfiguredScopes()));
    this.retryOptions = options.retryOptions;
    this.timeoutMs = options.timeoutMs;
    this.tokenStore = options.tokenStore;
    // Token store will be initialized in initialize() if using keychain
    if (