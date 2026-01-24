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
import { google } from 'googleapis';
import { executeWithRetry } from '../utils/retry.js';
import { logger } from '../utils/logger.js';
import { EncryptedFileTokenStore } from './token-store.js';
import { CircuitBreaker } from '../utils/circuit-breaker.js';
import { getCircuitBreakerConfig } from '../config/env.js';
import { circuitBreakerRegistry } from './circuit-breaker-registry.js';
import PQueue from 'p-queue';
import { getRequestContext } from '../utils/request-context.js';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';
import { ServiceError } from '../core/errors.js';
import { TokenManager } from './token-manager.js';
import { logHTTP2Capabilities, validateHTTP2Config } from '../utils/http2-detector.js';
/**
 * Default scopes - minimal permissions (drive.file only)
 * Use this for most operations
 */
export const DEFAULT_SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file', // Only files created/opened by app
];
/**
 * Elevated scopes - full drive access
 * Required for: sharing, permissions, listing all files, ownership transfer
 */
export const ELEVATED_SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive', // Full drive access
];
/**
 * Read-only scopes for analysis operations
 */
export const READONLY_SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
];
/**
 * BigQuery scopes for Connected Sheets and direct BigQuery operations
 * Required for: sheets_bigquery tool operations
 */
export const BIGQUERY_SCOPES = [
    'https://www.googleapis.com/auth/cloud-platform.read-only', // Read BigQuery data
    'https://www.googleapis.com/auth/cloud-platform', // Full BigQuery access (for exports)
];
/**
 * Create HTTP agents with connection pooling
 * Optimizes performance by reusing TCP connections
 */
function createHttpAgents() {
    const maxSockets = parseInt(process.env['GOOGLE_API_MAX_SOCKETS'] ?? '50');
    const keepAliveTimeout = parseInt(process.env['GOOGLE_API_KEEPALIVE_TIMEOUT'] ?? '30000');
    const agentOptions = {
        keepAlive: true,
        keepAliveMsecs: keepAliveTimeout,
        maxSockets,
        maxFreeSockets: Math.floor(maxSockets / 2),
        timeout: 60000,
        scheduling: 'lifo', // Use most recent connection first
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
    auth = null;
    _sheets = null;
    _drive = null;
    _bigquery = null;
    options;
    _scopes;
    retryOptions;
    timeoutMs;
    tokenStore;
    circuit;
    tokenRefreshQueue;
    tokenListener;
    httpAgents;
    _authType;
    tokenManager;
    poolMonitorInterval;
    constructor(options = {}) {
        this.options = options;
        this._authType = options.serviceAccountKeyPath
            ? 'service_account'
            : options.credentials
                ? 'oauth'
                : options.accessToken
                    ? 'access_token'
                    : 'application_default';
        // Determine scopes based on options
        this._scopes = options.scopes ?? (options.elevatedAccess ? ELEVATED_SCOPES : DEFAULT_SCOPES);
        this.retryOptions = options.retryOptions;
        this.timeoutMs = options.timeoutMs;
        this.tokenStore = options.tokenStore;
        if (!this.tokenStore && options.tokenStorePath && options.tokenStoreKey) {
            this.tokenStore = new EncryptedFileTokenStore(options.tokenStorePath, options.tokenStoreKey);
        }
        // Initialize circuit breaker
        const circuitConfig = getCircuitBreakerConfig();
        this.circuit = new CircuitBreaker({
            ...circuitConfig,
            name: 'google-api',
        });
        // Register circuit breaker for monitoring
        circuitBreakerRegistry.register('google-api', this.circuit, 'Main Google API client circuit breaker');
        // Initialize token refresh queue (prevents concurrent refreshes)
        this.tokenRefreshQueue = new PQueue({ concurrency: 1 });
        // Initialize HTTP agents with connection pooling
        this.httpAgents = createHttpAgents();
        // Set up connection pool monitoring if enabled
        this.setupConnectionPoolMonitoring();
    }
    /**
     * Initialize authentication
     */
    async initialize() {
        const scopes = this._scopes;
        if (this.options.serviceAccountKeyPath) {
            // Service account authentication
            const auth = new google.auth.GoogleAuth({
                keyFile: this.options.serviceAccountKeyPath,
                scopes,
            });
            this.auth = (await auth.getClient());
        }
        else if (this.options.credentials) {
            // OAuth2 authentication
            const { clientId, clientSecret, redirectUri } = this.options.credentials;
            this.auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
        }
        else if (this.options.accessToken) {
            // Direct token
            this.auth = new google.auth.OAuth2();
        }
        else {
            // Application default credentials
            const auth = new google.auth.GoogleAuth({ scopes });
            this.auth = (await auth.getClient());
        }
        await this.loadStoredTokens();
        this.attachTokenListener();
        this.initializeTokenManager();
        // Log HTTP/2 capabilities at initialization
        logHTTP2Capabilities();
        // Enable HTTP/2 for improved performance (5-15% latency reduction)
        // gaxios automatically negotiates HTTP/2 via ALPN if server supports it
        const enableHTTP2 = process.env['GOOGLE_API_HTTP2_ENABLED'] !== 'false'; // Enabled by default
        // Validate HTTP/2 configuration
        const validation = validateHTTP2Config(enableHTTP2);
        if (validation.warnings.length > 0) {
            logger.warn('HTTP/2 configuration warnings', {
                warnings: validation.warnings,
            });
        }
        // Initialize API clients with HTTP/2 enabled
        const sheetsApi = google.sheets({
            version: 'v4',
            auth: this.auth,
            // Enable HTTP/2 for automatic protocol negotiation via ALPN
            http2: enableHTTP2,
        });
        const driveApi = google.drive({
            version: 'v3',
            auth: this.auth,
            http2: enableHTTP2,
        });
        const bigqueryApi = google.bigquery({
            version: 'v2',
            auth: this.auth,
            http2: enableHTTP2,
        });
        logger.info('Google API clients initialized', {
            http2Enabled: enableHTTP2,
            expectedLatencyReduction: enableHTTP2 ? '5-15%' : 'N/A',
        });
        // Configure transport options for auth client
        if (this.auth && 'transporter' in this.auth) {
            const transporter = this.auth['transporter'];
            if (transporter && transporter['defaults']) {
                const defaults = transporter['defaults'];
                defaults['agent'] = this.httpAgents.https;
                defaults['httpAgent'] = this.httpAgents.http;
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
        this._bigquery = wrapGoogleApi(bigqueryApi, {
            ...(this.retryOptions ?? {}),
            timeoutMs: this.timeoutMs,
            circuit: this.circuit,
        });
        // Optional: Validate schemas with Discovery API if enabled
        await this.validateSchemasWithDiscovery();
    }
    /**
     * Validate API schemas using Discovery API (optional)
     * Only runs if DISCOVERY_API_ENABLED environment variable is true
     */
    async validateSchemasWithDiscovery() {
        if (process.env['DISCOVERY_API_ENABLED'] !== 'true') {
            return;
        }
        try {
            // Dynamically import to avoid circular dependencies
            const { getSchemaValidator } = await import('./schema-validator.js');
            const validator = getSchemaValidator();
            logger.debug('Validating API schemas with Discovery API');
            // Validate Sheets API schema
            try {
                const sheetsValidation = await validator.validateAgainstCurrent('sheets');
                if (!sheetsValidation.valid || sheetsValidation.comparison?.hasChanges) {
                    logger.warn('Sheets API schema validation detected issues', {
                        issues: sheetsValidation.issues.map((issue) => ({
                            severity: issue.severity,
                            type: issue.type,
                            message: issue.message,
                        })),
                        hasChanges: sheetsValidation.comparison?.hasChanges,
                    });
                    // Log critical issues
                    const criticalIssues = sheetsValidation.issues.filter((issue) => issue.severity === 'critical' || issue.severity === 'high');
                    if (criticalIssues.length > 0) {
                        logger.error('Critical Sheets API schema issues detected', {
                            count: criticalIssues.length,
                            issues: criticalIssues.map((issue) => issue.message),
                            recommendation: sheetsValidation.recommendation,
                        });
                    }
                }
                else {
                    logger.debug('Sheets API schema validation passed');
                }
            }
            catch (error) {
                const err = error;
                logger.warn('Failed to validate Sheets API schema', { error: err.message });
            }
            // Validate Drive API schema
            try {
                const driveValidation = await validator.validateAgainstCurrent('drive');
                if (!driveValidation.valid || driveValidation.comparison?.hasChanges) {
                    logger.warn('Drive API schema validation detected issues', {
                        issues: driveValidation.issues.map((issue) => ({
                            severity: issue.severity,
                            type: issue.type,
                            message: issue.message,
                        })),
                        hasChanges: driveValidation.comparison?.hasChanges,
                    });
                    // Log critical issues
                    const criticalIssues = driveValidation.issues.filter((issue) => issue.severity === 'critical' || issue.severity === 'high');
                    if (criticalIssues.length > 0) {
                        logger.error('Critical Drive API schema issues detected', {
                            count: criticalIssues.length,
                            issues: criticalIssues.map((issue) => issue.message),
                            recommendation: driveValidation.recommendation,
                        });
                    }
                }
                else {
                    logger.debug('Drive API schema validation passed');
                }
            }
            catch (error) {
                const err = error;
                logger.warn('Failed to validate Drive API schema', { error: err.message });
            }
        }
        catch (error) {
            const err = error;
            logger.debug('Discovery API validation skipped', { reason: err.message });
        }
    }
    async loadStoredTokens() {
        if (!this.auth || !(this.auth instanceof google.auth.OAuth2)) {
            return;
        }
        let storedTokens = null;
        if (this.tokenStore) {
            try {
                storedTokens = await this.tokenStore.load();
            }
            catch (error) {
                logger.warn('Failed to load token store', { error });
            }
        }
        const explicitTokens = this.sanitizeTokens({
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
    attachTokenListener() {
        if (!this.auth || !(this.auth instanceof google.auth.OAuth2) || !this.tokenStore) {
            return;
        }
        // Remove existing listener if any
        if (this.tokenListener) {
            this.auth.off('tokens', this.tokenListener);
        }
        // Create and store the listener
        this.tokenListener = async (tokens) => {
            // Wrap in queue to prevent concurrent token refreshes
            await this.tokenRefreshQueue.add(async () => {
                const current = this.sanitizeTokens({
                    ...(this.auth?.credentials ?? {}),
                });
                const incoming = this.sanitizeTokens(tokens);
                const merged = this.mergeTokens(current, incoming);
                logger.debug('Token refresh triggered', {
                    hasAccessToken: Boolean(merged.access_token),
                    hasRefreshToken: Boolean(merged.refresh_token),
                });
                await this.safeSaveTokens(merged);
            });
        };
        this.auth.on('tokens', this.tokenListener);
    }
    sanitizeTokens(tokens) {
        const sanitized = {};
        const allowedKeys = [
            'access_token',
            'refresh_token',
            'expiry_date',
            'token_type',
            'scope',
            'id_token',
        ];
        for (const key of allowedKeys) {
            const value = tokens[key];
            if (value !== null && value !== undefined) {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    mergeTokens(base, updates) {
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
    async safeSaveTokens(tokens) {
        if (!this.tokenStore)
            return;
        try {
            await this.tokenStore.save(tokens);
        }
        catch (error) {
            logger.warn('Failed to save tokens', { error });
        }
    }
    /**
     * Initialize proactive token refresh manager
     */
    initializeTokenManager() {
        // Only enable for OAuth2 clients with refresh tokens
        if (!this.auth || !(this.auth instanceof google.auth.OAuth2)) {
            return;
        }
        const credentials = this.auth.credentials;
        if (!credentials.refresh_token) {
            logger.debug('No refresh token available, skipping token manager initialization');
            return;
        }
        logger.info('Initializing proactive token manager');
        this.tokenManager = new TokenManager({
            oauthClient: this.auth,
            refreshThreshold: 0.8, // Refresh at 80% of token lifetime
            checkIntervalMs: 300000, // Check every 5 minutes
            onTokenRefreshed: async (_tokens) => {
                logger.info('Token proactively refreshed by TokenManager');
                // Tokens are automatically saved by the 'tokens' event listener
            },
            onRefreshError: (error) => {
                logger.error('Token refresh failed in TokenManager', {
                    error: error.message,
                });
            },
        });
        this.tokenManager.start();
    }
    /**
     * Get Sheets API client
     */
    get sheets() {
        if (!this._sheets) {
            throw new ServiceError('Google API client not initialized', 'SERVICE_NOT_INITIALIZED', 'GoogleAPI', false, { method: 'sheets', hint: 'Call initialize() first' });
        }
        return this._sheets;
    }
    /**
     * Get Drive API client
     */
    get drive() {
        if (!this._drive) {
            throw new ServiceError('Google API client not initialized', 'SERVICE_NOT_INITIALIZED', 'GoogleAPI', false, { method: 'drive', hint: 'Call initialize() first' });
        }
        return this._drive;
    }
    /**
     * Get BigQuery API client
     * Returns null if BigQuery is not configured (optional API)
     */
    get bigquery() {
        return this._bigquery;
    }
    /**
     * Get OAuth2 client for token management
     */
    get oauth2() {
        if (!this.auth) {
            throw new ServiceError('Google API client not initialized', 'SERVICE_NOT_INITIALIZED', 'GoogleAPI', false, { method: 'oauth2', hint: 'Call initialize() first' });
        }
        return this.auth;
    }
    /**
     * Get current scopes
     */
    get scopes() {
        return [...this._scopes];
    }
    /**
     * Get authentication type
     */
    get authType() {
        return this._authType;
    }
    /**
     * Get token status for OAuth-based auth
     */
    getTokenStatus() {
        if (!this.auth || !(this.auth instanceof google.auth.OAuth2)) {
            return {
                hasAccessToken: false,
                hasRefreshToken: false,
            };
        }
        const { access_token, refresh_token, expiry_date, scope } = this.auth.credentials;
        return {
            hasAccessToken: Boolean(access_token),
            hasRefreshToken: Boolean(refresh_token),
            expiryDate: typeof expiry_date === 'number' ? expiry_date : undefined,
            scope,
        };
    }
    /**
     * Validate that OAuth tokens are valid by making a lightweight API call
     * Returns both validity status and any error message
     */
    async validateToken() {
        // Only validate OAuth tokens (not service account or ADC)
        if (!this.auth || !(this.auth instanceof google.auth.OAuth2)) {
            return { valid: false, error: 'No OAuth client configured' };
        }
        const status = this.getTokenStatus();
        if (!status.hasAccessToken && !status.hasRefreshToken) {
            return { valid: false, error: 'No tokens present' };
        }
        try {
            // Make lightweight API call to validate token
            const oauth2 = google.oauth2({ version: 'v2', auth: this.auth });
            await oauth2.userinfo.get();
            return { valid: true };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.debug('Token validation failed', { error: errorMessage });
            return {
                valid: false,
                error: errorMessage,
            };
        }
    }
    /**
     * Check if elevated access is available
     */
    get hasElevatedAccess() {
        return this._scopes.includes('https://www.googleapis.com/auth/drive');
    }
    /**
     * Generate OAuth2 authorization URL
     */
    getAuthUrl(additionalScopes) {
        if (!this.auth || !(this.auth instanceof google.auth.OAuth2)) {
            throw new ServiceError('OAuth2 client not configured', 'AUTH_ERROR', 'GoogleAPI', false, {
                method: 'getAuthUrl',
                hint: 'Provide OAuth client credentials',
            });
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
    async getToken(code) {
        if (!this.auth || !(this.auth instanceof google.auth.OAuth2)) {
            throw new ServiceError('OAuth2 client not configured', 'AUTH_ERROR', 'GoogleAPI', false, {
                method: 'getToken',
                hint: 'Provide OAuth client credentials',
            });
        }
        const { tokens } = await this.auth.getToken(code);
        this.auth.setCredentials(tokens);
        await this.safeSaveTokens(this.sanitizeTokens(tokens));
        const result = {
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
    setCredentials(accessToken, refreshToken) {
        if (!this.auth || !(this.auth instanceof google.auth.OAuth2)) {
            throw new ServiceError('OAuth2 client not configured', 'AUTH_ERROR', 'GoogleAPI', false, {
                method: 'setCredentials',
                hint: 'Provide OAuth client credentials',
            });
        }
        const tokens = this.sanitizeTokens({
            access_token: accessToken,
            refresh_token: refreshToken,
        });
        this.auth.setCredentials(tokens);
        void this.safeSaveTokens(tokens);
    }
    /**
     * Check if authenticated
     */
    isAuthenticated() {
        return this.auth !== null && this._sheets !== null;
    }
    /**
     * Get circuit breaker statistics
     */
    getCircuitStats() {
        return this.circuit.getStats();
    }
    /**
     * Set up HTTP/2 connection pool monitoring
     * Logs connection pool statistics at regular intervals
     * Controlled by ENABLE_HTTP2_POOL_MONITORING environment variable
     */
    setupConnectionPoolMonitoring() {
        const enableMonitoring = process.env['ENABLE_HTTP2_POOL_MONITORING'] === 'true';
        if (!enableMonitoring) {
            return;
        }
        // Monitor every 5 minutes by default
        const intervalMs = parseInt(process.env['HTTP2_POOL_MONITOR_INTERVAL_MS'] || '300000', 10);
        this.poolMonitorInterval = setInterval(() => {
            this.logConnectionPoolStats();
        }, intervalMs);
        logger.info('HTTP/2 connection pool monitoring enabled', {
            intervalMs,
            intervalMin: Math.round(intervalMs / 60000),
        });
    }
    /**
     * Log HTTP/2 connection pool statistics
     * Provides visibility into connection reuse and pool utilization
     */
    logConnectionPoolStats() {
        const httpsAgent = this.httpAgents.https;
        // Count active and free sockets
        const activeSockets = Object.keys(httpsAgent.sockets || {}).length || 0;
        const freeSockets = Object.keys(httpsAgent.freeSockets || {}).length || 0;
        const pendingRequests = Object.keys(httpsAgent.requests || {}).length || 0;
        // Get max sockets from environment
        const maxSockets = parseInt(process.env['GOOGLE_API_MAX_SOCKETS'] || '50', 10);
        // Calculate utilization percentage
        const utilizationPercent = ((activeSockets / maxSockets) * 100).toFixed(1);
        const stats = {
            active_sockets: activeSockets,
            free_sockets: freeSockets,
            pending_requests: pendingRequests,
            max_sockets: maxSockets,
            utilization_percent: parseFloat(utilizationPercent),
            total_available: activeSockets + freeSockets,
        };
        logger.info('HTTP/2 connection pool statistics', stats);
        // Warn if pool is at or near capacity
        if (activeSockets >= maxSockets) {
            logger.warn('HTTP/2 connection pool at max capacity', {
                ...stats,
                recommendation: 'Consider increasing GOOGLE_API_MAX_SOCKETS environment variable',
            });
        }
        else if (activeSockets >= maxSockets * 0.8) {
            logger.warn('HTTP/2 connection pool utilization high (>80%)', {
                ...stats,
                recommendation: 'Monitor for performance degradation; consider increasing pool size',
            });
        }
    }
    /**
     * Get current HTTP/2 connection pool statistics
     * Returns current state without logging
     */
    getConnectionPoolStats() {
        const httpsAgent = this.httpAgents.https;
        const activeSockets = Object.keys(httpsAgent.sockets || {}).length || 0;
        const freeSockets = Object.keys(httpsAgent.freeSockets || {}).length || 0;
        const pendingRequests = Object.keys(httpsAgent.requests || {}).length || 0;
        const maxSockets = parseInt(process.env['GOOGLE_API_MAX_SOCKETS'] || '50', 10);
        return {
            activeSockets,
            freeSockets,
            pendingRequests,
            maxSockets,
            utilizationPercent: parseFloat(((activeSockets / maxSockets) * 100).toFixed(1)),
        };
    }
    /**
     * Log scope usage for audit trail
     * Particularly important for elevated scope operations
     */
    logScopeUsage(operation, resourceId) {
        if (this.hasElevatedAccess) {
            logger.info('Elevated scope operation', {
                operation,
                resourceId,
                scopes: this._scopes,
                category: 'audit',
            });
        }
    }
    /**
     * Revoke access tokens
     */
    async revokeAccess() {
        if (!this.auth) {
            throw new ServiceError('Google API client not initialized', 'SERVICE_NOT_INITIALIZED', 'GoogleAPI', false, { method: 'revokeAccess', hint: 'Call initialize() first' });
        }
        const credentials = this.auth.credentials;
        if (credentials.access_token) {
            await this.auth.revokeToken(credentials.access_token);
        }
    }
    /**
     * Clear stored tokens and in-memory credentials
     */
    async clearStoredTokens() {
        if (this.tokenStore) {
            try {
                await this.tokenStore.clear();
            }
            catch (error) {
                logger.warn('Failed to clear token store', { error });
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
    destroy() {
        // Stop connection pool monitoring
        if (this.poolMonitorInterval) {
            clearInterval(this.poolMonitorInterval);
            this.poolMonitorInterval = undefined;
        }
        // Stop token manager
        if (this.tokenManager) {
            this.tokenManager.stop();
            this.tokenManager = undefined;
        }
        // Remove token listener to prevent memory leak
        if (this.auth && this.tokenListener && this.auth instanceof google.auth.OAuth2) {
            this.auth.off('tokens', this.tokenListener);
            this.tokenListener = undefined;
        }
        // Destroy HTTP agents to close persistent connections
        this.httpAgents.http.destroy();
        this.httpAgents.https.destroy();
        // Clear auth and API clients
        this.auth = null;
        this._sheets = null;
        this._drive = null;
        logger.info('Google API client destroyed');
    }
}
/**
 * Create and initialize a Google API client
 */
export async function createGoogleApiClient(options = {}) {
    const client = new GoogleApiClient(options);
    await client.initialize();
    return client;
}
function wrapGoogleApi(api, options) {
    const cache = new WeakMap();
    const circuit = options?.circuit;
    const wrapObject = (obj) => {
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
                if (descriptor &&
                    !descriptor.configurable &&
                    !descriptor.writable &&
                    'value' in descriptor) {
                    // Return exact value - do NOT wrap, even for objects
                    return descriptor.value;
                }
                const value = Reflect.get(target, prop, receiver);
                if (typeof value === 'function') {
                    return (...args) => {
                        const operation = () => executeWithRetry((signal) => {
                            const callArgs = injectSignal(args, signal);
                            return value.apply(target, callArgs);
                        }, options);
                        // Wrap with circuit breaker if available
                        if (circuit) {
                            return circuit.execute(operation);
                        }
                        return operation();
                    };
                }
                // For configurable properties that are objects, we can wrap them
                if (value && typeof value === 'object') {
                    return wrapObject(value);
                }
                return value;
            },
        });
        cache.set(obj, proxy);
        return proxy;
    };
    return wrapObject(api);
}
function injectSignal(args, signal) {
    // Get request context for trace propagation
    const ctx = getRequestContext();
    const requestId = ctx?.requestId;
    // Build base headers with request ID and W3C Trace Context
    const headers = {};
    if (requestId) {
        headers['x-request-id'] = requestId;
    }
    // Add W3C Trace Context (traceparent header)
    // Format: version-traceId-parentId-flags
    if (ctx?.traceId && ctx?.spanId) {
        headers['traceparent'] = `00-${ctx.traceId}-${ctx.spanId}-01`;
    }
    // Build base options with signal and headers
    const baseOptions = { signal };
    if (Object.keys(headers).length > 0) {
        baseOptions['headers'] = headers;
    }
    if (args.length === 0) {
        return [baseOptions];
    }
    const last = args[args.length - 1];
    if (typeof last === 'function') {
        return args;
    }
    if (last && typeof last === 'object' && !Array.isArray(last)) {
        const updated = {
            ...last,
            signal,
        };
        // Merge headers if they exist
        if (Object.keys(headers).length > 0) {
            updated['headers'] = {
                ...(updated['headers'] ?? {}),
                ...headers,
            };
        }
        return [...args.slice(0, -1), updated];
    }
    return [...args, baseOptions];
}
//# sourceMappingURL=google-api.js.map