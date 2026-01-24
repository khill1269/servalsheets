/**
 * ServalSheets - HTTP Transport Server
 *
 * Streamable HTTP transport for Claude Connectors Directory
 * Supports both SSE and HTTP streaming
 * MCP Protocol: 2025-11-25
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { randomUUID, randomBytes } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { OAuthProvider } from './oauth-provider.js';
import { validateEnv, env } from './config/env.js';
import { createGoogleApiClient } from './services/google-api.js';
import { initTransactionManager } from './services/transaction-manager.js';
import { initConflictDetector } from './services/conflict-detector.js';
import { initImpactAnalyzer } from './services/impact-analyzer.js';
import { initValidationEngine } from './services/validation-engine.js';
import { ACTION_COUNT, TOOL_COUNT } from './schemas/annotations.js';
import { VERSION, SERVER_INFO, SERVER_ICONS } from './version.js';
import { logger } from './utils/logger.js';
import { HealthService } from './server/health.js';
import { metricsHandler } from './observability/metrics.js';
import { BatchCompiler, RateLimiter, DiffEngine, PolicyEnforcer, RangeResolver, } from './core/index.js';
import { SnapshotService } from './services/snapshot.js';
import { createHandlers } from './handlers/index.js';
import { handleLoggingSetLevel } from './handlers/logging.js';
import { registerKnowledgeResources, registerHistoryResources, registerCacheResources, registerTransactionResources, registerConflictResources, registerImpactResources, registerValidationResources, registerMetricsResources, registerConfirmResources, registerAnalyzeResources, registerReferenceResources, registerSchemaResources, } from './resources/index.js';
import { registerServalSheetsPrompts, registerServalSheetsResources, registerServalSheetsTools, } from './mcp/registration.js';
import { createServerCapabilities, SERVER_INSTRUCTIONS } from './mcp/features-2025-11-25.js';
import { startBackgroundTasks, registerSignalHandlers, onShutdown, logEnvironmentConfig, getCacheStats, getDeduplicationStats, getConnectionStats, getTracingStats, } from './startup/lifecycle.js';
import { requestDeduplicator } from './utils/request-deduplication.js';
import { sessionLimiter } from './utils/session-limiter.js';
import { registerWellKnownHandlers } from './server/well-known.js';
import { optionalResourceIndicatorMiddleware, createResourceIndicatorValidator, } from './security/index.js';
const DEFAULT_PORT = 3000;
// HIGH-003 FIX: Default to localhost for security (0.0.0.0 exposes to entire network)
// Override with HOST=0.0.0.0 in production if external access needed
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60000;
const DEFAULT_RATE_LIMIT_MAX = 100;
// Monkey-patches removed: All schemas now use flattened z.object() pattern
// which works natively with MCP SDK v1.25.x - no patches required!
async function createMcpServerInstance(googleToken, googleRefreshToken) {
    // Create task store for SEP-1686 support - uses createTaskStore() for Redis support
    const { createTaskStore } = await import('./core/task-store-factory.js');
    const taskStore = await createTaskStore();
    const mcpServer = new McpServer({
        name: SERVER_INFO.name,
        version: SERVER_INFO.version,
        icons: SERVER_ICONS,
    }, {
        capabilities: createServerCapabilities(),
        instructions: SERVER_INSTRUCTIONS,
        taskStore,
    });
    let handlers = null;
    let googleClient = null;
    if (googleToken) {
        googleClient = await createGoogleApiClient({
            accessToken: googleToken,
            refreshToken: googleRefreshToken,
        });
        // Initialize Phase 4 advanced features (required for sheets_transaction, etc.)
        initTransactionManager(googleClient);
        initConflictDetector(googleClient);
        initImpactAnalyzer(googleClient);
        initValidationEngine(googleClient);
        // Create SnapshotService for undo/revert operations
        const snapshotService = new SnapshotService({ driveApi: googleClient.drive });
        const context = {
            batchCompiler: new BatchCompiler({
                rateLimiter: new RateLimiter(),
                diffEngine: new DiffEngine({ sheetsApi: googleClient.sheets }),
                policyEnforcer: new PolicyEnforcer(),
                snapshotService,
                sheetsApi: googleClient.sheets,
                onProgress: async (event) => {
                    // Send MCP progress notification over HTTP transport
                    // Note: This requires sessionId and transport to be available in scope
                    // For now, just log progress
                    logger.debug('Operation progress', {
                        phase: event.phase,
                        progress: `${event.current}/${event.total}`,
                        message: event.message,
                        spreadsheetId: event.spreadsheetId,
                    });
                },
            }),
            rangeResolver: new RangeResolver({ sheetsApi: googleClient.sheets }),
            snapshotService, // Pass to context for HistoryHandler undo/revert (Task 1.3)
            auth: {
                hasElevatedAccess: googleClient.hasElevatedAccess,
                scopes: googleClient.scopes,
            },
            samplingServer: mcpServer.server, // Pass underlying Server instance for sampling
            requestDeduplicator, // Pass request deduplicator for preventing duplicate API calls
        };
        handlers = createHandlers({
            context,
            sheetsApi: googleClient.sheets,
            driveApi: googleClient.drive,
        });
    }
    await registerServalSheetsTools(mcpServer, handlers, { googleClient });
    registerServalSheetsResources(mcpServer, googleClient);
    registerServalSheetsPrompts(mcpServer);
    registerKnowledgeResources(mcpServer);
    // Register operation history resources
    registerHistoryResources(mcpServer);
    // Register cache statistics resources
    registerCacheResources(mcpServer);
    // Register Phase 4 resources (only if Google client was initialized)
    if (googleClient) {
        registerTransactionResources(mcpServer);
        registerConflictResources(mcpServer);
        registerImpactResources(mcpServer);
        registerValidationResources(mcpServer);
        registerMetricsResources(mcpServer);
    }
    // Register MCP-native resources (Elicitation & Sampling)
    registerConfirmResources(mcpServer);
    registerAnalyzeResources(mcpServer);
    // Register static reference resources
    registerReferenceResources(mcpServer);
    // Register schema resources for deferred loading (SERVAL_DEFER_SCHEMAS=true)
    registerSchemaResources(mcpServer);
    // Register logging handler
    // Note: Using 'as any' to bypass TypeScript's deep type inference issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mcpServer.server.setRequestHandler(SetLevelRequestSchema, async (request) => {
        const level = request.params.level;
        const response = await handleLoggingSetLevel({ level });
        logger.info('Log level changed via logging/setLevel', {
            previousLevel: response.previousLevel,
            newLevel: response.newLevel,
        });
        // OK: Explicit empty - MCP logging/setLevel returns empty object per protocol
        return {};
    });
    logger.info('HTTP Server: Logging handler registered (logging/setLevel)');
    return { mcpServer, taskStore };
}
/**
 * Create HTTP server with MCP transport
 */
export function createHttpServer(options = {}) {
    const port = options.port ?? DEFAULT_PORT;
    const host = options.host ?? DEFAULT_HOST;
    const corsOrigins = options.corsOrigins ?? ['https://claude.ai', 'https://claude.com'];
    const rateLimitWindowMs = options.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS;
    const rateLimitMax = options.rateLimitMax ?? DEFAULT_RATE_LIMIT_MAX;
    const trustProxy = options.trustProxy ?? true;
    const app = express();
    // Health service for liveness/readiness probes
    // Note: GoogleClient is session-specific, so health checks will report on active sessions
    const healthService = new HealthService(null);
    // Security middleware
    app.use(helmet({
        contentSecurityPolicy: false, // Allow SSE
        strictTransportSecurity: process.env['NODE_ENV'] === 'production'
            ? {
                maxAge: 31536000, // 1 year
                includeSubDomains: true,
                preload: true,
            }
            : false, // Disable in development (localhost issues)
    }));
    // Compression middleware (gzip)
    app.use(compression({
        filter: (req, res) => {
            if (req.headers['x-no-compression']) {
                return false;
            }
            return compression.filter(req, res);
        },
        threshold: 1024, // Only compress responses larger than 1KB
    }));
    // HTTPS Enforcement (Production Only)
    if (process.env['NODE_ENV'] === 'production') {
        app.use((req, res, next) => {
            // Check if request is HTTPS (direct or behind proxy)
            const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
            if (!isHttps) {
                logger.warn('Rejected non-HTTPS request in production', {
                    method: req.method,
                    path: req.path,
                    ip: req.ip,
                    protocol: req.protocol,
                    forwardedProto: req.headers['x-forwarded-proto'],
                });
                res.status(426).json({
                    error: 'UPGRADE_REQUIRED',
                    message: 'HTTPS is required for all requests in production mode',
                    details: {
                        reason: 'Security: OAuth tokens and sensitive data must be transmitted over encrypted connections',
                        action: 'Use https:// instead of http:// in your request URL',
                    },
                });
                return;
            }
            next();
        });
    }
    // Trust proxy for rate limiting behind load balancer
    if (trustProxy) {
        app.set('trust proxy', 1);
    }
    // CORS configuration
    app.use(cors({
        origin: corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Session-ID'],
    }));
    // Origin Validation for Authenticated Endpoints
    // CORS handles browser preflight, but this adds explicit validation for all authenticated requests
    app.use((req, res, next) => {
        const origin = req.get('origin');
        const referer = req.get('referer');
        // Skip validation for requests without origin (same-origin, curl, etc.)
        if (!origin && !referer) {
            next();
            return;
        }
        // Extract origin from referer if origin header is missing (some clients)
        const requestOrigin = origin || (referer ? new URL(referer).origin : null);
        if (requestOrigin && !corsOrigins.includes(requestOrigin)) {
            logger.warn('Rejected request with invalid Origin', {
                origin: requestOrigin,
                path: req.path,
                method: req.method,
                ip: req.ip,
                allowedOrigins: corsOrigins,
            });
            res.status(403).json({
                error: 'FORBIDDEN',
                message: 'Invalid Origin header',
                details: {
                    received: requestOrigin,
                    allowed: corsOrigins,
                },
            });
            return;
        }
        next();
    });
    // Rate limiting with explicit values - exempt health check endpoints
    const limiter = rateLimit({
        windowMs: rateLimitWindowMs,
        limit: rateLimitMax,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests, please try again later' },
        // Add custom rate limit info handler
        handler: (req, res) => {
            res.status(429).json({
                error: 'Too many requests',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: res.getHeader('RateLimit-Reset'),
            });
        },
    });
    // Apply rate limiting to all routes EXCEPT health checks
    // Health checks must not be rate-limited to ensure reliable monitoring
    app.use((req, res, next) => {
        if (req.path.startsWith('/health')) {
            return next(); // Skip rate limiter for health endpoints
        }
        limiter(req, res, next);
    });
    // Add explicit X-RateLimit-* headers for better client compatibility
    app.use((req, res, next) => {
        // express-rate-limit@8 sets RateLimit-* headers (RFC 6585)
        // Also expose as X-RateLimit-* for legacy compatibility
        const limit = res.getHeader('RateLimit-Limit');
        const remaining = res.getHeader('RateLimit-Remaining');
        const reset = res.getHeader('RateLimit-Reset');
        if (limit)
            res.setHeader('X-RateLimit-Limit', limit);
        if (remaining)
            res.setHeader('X-RateLimit-Remaining', remaining);
        if (reset)
            res.setHeader('X-RateLimit-Reset', reset);
        next();
    });
    // Parse JSON
    app.use(express.json({ limit: '10mb' }));
    // OAuth provider (optional)
    let oauth = null;
    if (options.enableOAuth && options.oauthConfig) {
        oauth = new OAuthProvider(options.oauthConfig);
        app.use(oauth.createRouter());
        logger.info('HTTP Server: OAuth mode enabled', {
            issuer: options.oauthConfig.issuer,
            clientId: options.oauthConfig.clientId,
        });
    }
    // Request ID middleware
    app.use((req, res, next) => {
        const requestId = req.headers['x-request-id'] ?? randomUUID();
        req.headers['x-request-id'] = requestId;
        res.setHeader('X-Request-ID', requestId);
        next();
    });
    // W3C Trace Context middleware (distributed tracing)
    // Spec: https://www.w3.org/TR/trace-context/
    app.use((req, res, next) => {
        const incomingTraceparent = req.header('traceparent');
        let traceId;
        let parentId;
        if (incomingTraceparent) {
            // Parse: version-traceId-parentId-flags (e.g., "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01")
            const parts = incomingTraceparent.split('-');
            if (parts.length === 4 && parts[0] === '00' && parts[1] && parts[2]) {
                traceId = parts[1]; // 32 hex chars
                parentId = parts[2]; // 16 hex chars
            }
            else {
                // Invalid format, generate new trace
                traceId = randomBytes(16).toString('hex');
                parentId = randomBytes(8).toString('hex');
                logger.warn('Invalid traceparent header, generating new trace', {
                    traceparent: incomingTraceparent,
                });
            }
        }
        else {
            // No incoming trace, generate new one
            traceId = randomBytes(16).toString('hex');
            parentId = randomBytes(8).toString('hex');
        }
        // Generate span ID for this service
        const spanId = randomBytes(8).toString('hex');
        // Set traceparent for downstream services
        // Format: version-traceId-spanId-flags
        // flags: 01 = sampled (always trace for now)
        const traceparent = `00-${traceId}-${spanId}-01`;
        res.setHeader('traceparent', traceparent);
        // Store in request for logging (store on headers for easy access)
        req.headers['x-trace-id'] = traceId;
        req.headers['x-span-id'] = spanId;
        req.headers['x-parent-span-id'] = parentId;
        next();
    });
    // Well-known discovery endpoints (RFC 8615)
    // These must be registered before rate limiting exemption or after with explicit allow
    registerWellKnownHandlers(app);
    // Liveness probe - Is the server running?
    app.get('/health/live', async (_req, res) => {
        const health = await healthService.checkLiveness();
        res.status(200).json(health);
    });
    // Readiness probe - Is the server ready to handle requests?
    app.get('/health/ready', async (_req, res) => {
        const health = await healthService.checkReadiness();
        // Add OAuth status if enabled
        if (options.enableOAuth && options.oauthConfig) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            health.oauth = {
                enabled: true,
                configured: Boolean(options.oauthConfig.googleClientId && options.oauthConfig.googleClientSecret),
                issuer: options.oauthConfig.issuer,
                clientId: options.oauthConfig.clientId,
            };
        }
        // Add active session info
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        health.sessions = {
            active: sessions.size,
            hasAuthentication: sessions.size > 0, // Sessions are created with auth tokens
        };
        // Return 200 for healthy/degraded, 503 for unhealthy
        const statusCode = health.status === 'unhealthy' ? 503 : 200;
        res.status(statusCode).json(health);
    });
    // Legacy /health endpoint (redirects to /health/ready for compatibility)
    app.get('/health', async (_req, res) => {
        const health = await healthService.checkReadiness();
        const statusCode = health.status === 'unhealthy' ? 503 : 200;
        res.status(statusCode).json(health);
    });
    // Trace context endpoint - View current request's trace information
    app.get('/trace', (req, res) => {
        const traceId = req.headers['x-trace-id'];
        const spanId = req.headers['x-span-id'];
        const parentSpanId = req.headers['x-parent-span-id'];
        const requestId = req.headers['x-request-id'];
        res.json({
            traceContext: {
                traceId,
                spanId,
                parentSpanId,
                requestId,
            },
            message: 'W3C Trace Context information for this request',
            spec: 'https://www.w3.org/TR/trace-context/',
            usage: 'Include traceparent header in requests: traceparent: 00-<traceId>-<parentId>-01',
        });
    });
    // MCP server info
    app.get('/info', (req, res) => {
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || `${host}:${port}`;
        const baseUrl = `${protocol}://${hostHeader}`;
        res.json({
            name: SERVER_INFO.name,
            version: VERSION,
            description: 'Production-grade Google Sheets MCP server',
            tools: TOOL_COUNT,
            actions: ACTION_COUNT,
            protocol: `MCP ${SERVER_INFO.protocolVersion}`,
            transports: ['stdio', 'sse', 'streamable-http'],
            discovery: {
                mcp_configuration: `${baseUrl}/.well-known/mcp-configuration`,
                oauth_authorization_server: `${baseUrl}/.well-known/oauth-authorization-server`,
                oauth_protected_resource: `${baseUrl}/.well-known/oauth-protected-resource`,
            },
            endpoints: {
                sse: `${baseUrl}/sse`,
                mcp: `${baseUrl}/mcp`,
                health: `${baseUrl}/health`,
                metrics: `${baseUrl}/metrics`,
                circuitBreakers: `${baseUrl}/metrics/circuit-breakers`,
                stats: `${baseUrl}/stats`,
            },
        });
    });
    // Prometheus metrics endpoint
    app.get('/metrics', metricsHandler);
    // Circuit breaker metrics endpoint
    app.get('/metrics/circuit-breakers', async (_req, res) => {
        try {
            const { circuitBreakerRegistry } = await import('./services/circuit-breaker-registry.js');
            const breakers = circuitBreakerRegistry.getAll();
            const metrics = breakers.map((entry) => {
                const stats = entry.breaker.getStats();
                return {
                    name: entry.name,
                    description: entry.description,
                    state: stats.state,
                    isOpen: stats.state === 'open',
                    isHalfOpen: stats.state === 'half_open',
                    isClosed: stats.state === 'closed',
                    failureCount: stats.failureCount,
                    successCount: stats.successCount,
                    totalRequests: stats.totalRequests,
                    lastFailure: stats.lastFailure,
                    nextAttempt: stats.nextAttempt,
                    fallbackUsageCount: stats.fallbackUsageCount,
                    registeredFallbacks: stats.registeredFallbacks,
                };
            });
            res.json({
                timestamp: new Date().toISOString(),
                circuitBreakers: metrics,
                summary: {
                    total: metrics.length,
                    open: metrics.filter((m) => m.isOpen).length,
                    halfOpen: metrics.filter((m) => m.isHalfOpen).length,
                    closed: metrics.filter((m) => m.isClosed).length,
                },
            });
        }
        catch (error) {
            logger.error('Failed to fetch circuit breaker metrics', { error });
            res.status(500).json({ error: 'Failed to fetch circuit breaker metrics' });
        }
    });
    // Statistics dashboard endpoint
    app.get('/stats', (_req, res) => {
        const cacheStats = getCacheStats();
        const dedupStats = getDeduplicationStats();
        const connStats = getConnectionStats();
        const tracingStats = getTracingStats();
        const memUsage = process.memoryUsage();
        res.json({
            uptime: {
                seconds: Math.floor(process.uptime()),
                formatted: formatUptime(process.uptime()),
            },
            cache: cacheStats
                ? {
                    enabled: true,
                    totalEntries: cacheStats['totalEntries'],
                    totalSizeMB: parseFloat((cacheStats['totalSize'] / 1024 / 1024).toFixed(2)),
                    hits: cacheStats['hits'],
                    misses: cacheStats['misses'],
                    hitRate: parseFloat(cacheStats['hitRate'].toFixed(2)),
                    byNamespace: cacheStats['byNamespace'],
                    oldestEntry: cacheStats['oldestEntry']
                        ? new Date(cacheStats['oldestEntry']).toISOString()
                        : null,
                    newestEntry: cacheStats['newestEntry']
                        ? new Date(cacheStats['newestEntry']).toISOString()
                        : null,
                }
                : { enabled: false },
            deduplication: dedupStats
                ? {
                    enabled: true,
                    totalRequests: dedupStats['totalRequests'],
                    deduplicatedRequests: dedupStats['deduplicatedRequests'],
                    savedRequests: dedupStats['savedRequests'],
                    deduplicationRate: parseFloat(dedupStats['deduplicationRate'].toFixed(2)),
                    pendingCount: dedupStats['pendingCount'],
                    oldestRequestAgeMs: dedupStats['oldestRequestAge'],
                }
                : { enabled: false },
            connection: connStats
                ? {
                    status: connStats['status'],
                    uptimeSeconds: connStats['uptimeSeconds'],
                    totalHeartbeats: connStats['totalHeartbeats'],
                    disconnectWarnings: connStats['disconnectWarnings'],
                    timeSinceLastActivityMs: connStats['timeSinceLastActivity'],
                    lastActivity: new Date(connStats['lastActivity']).toISOString(),
                }
                : null,
            tracing: tracingStats
                ? {
                    totalSpans: tracingStats['totalSpans'],
                    averageDurationMs: parseFloat(tracingStats['averageDuration'].toFixed(2)),
                    spansByKind: tracingStats['spansByKind'],
                    spansByStatus: tracingStats['spansByStatus'],
                }
                : null,
            memory: {
                heapUsedMB: parseFloat((memUsage.heapUsed / 1024 / 1024).toFixed(2)),
                heapTotalMB: parseFloat((memUsage.heapTotal / 1024 / 1024).toFixed(2)),
                rssMB: parseFloat((memUsage.rss / 1024 / 1024).toFixed(2)),
                externalMB: parseFloat((memUsage.external / 1024 / 1024).toFixed(2)),
                arrayBuffersMB: parseFloat((memUsage.arrayBuffers / 1024 / 1024).toFixed(2)),
            },
            performance: {
                apiCallReduction: dedupStats && cacheStats
                    ? {
                        deduplicationSavings: `${dedupStats['deduplicationRate'].toFixed(1)}%`,
                        cacheSavings: `${cacheStats['hitRate'].toFixed(1)}%`,
                        estimatedTotalSavings: calculateTotalSavings(dedupStats, cacheStats),
                    }
                    : null,
            },
            sessions: {
                active: sessions.size,
            },
        });
    });
    // Helper function to format uptime
    function formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const parts = [];
        if (days > 0)
            parts.push(`${days}d`);
        if (hours > 0)
            parts.push(`${hours}h`);
        if (minutes > 0)
            parts.push(`${minutes}m`);
        parts.push(`${secs}s`);
        return parts.join(' ');
    }
    // Helper function to calculate total savings
    function calculateTotalSavings(dedupStats, cacheStats) {
        // Estimate combined savings (not perfect but reasonable approximation)
        // Deduplication happens first, cache applies to non-deduplicated requests
        const dedupRate = dedupStats['deduplicationRate'] / 100;
        const cacheRate = cacheStats['hitRate'] / 100;
        const combinedSavings = (dedupRate + (1 - dedupRate) * cacheRate) * 100;
        return `~${combinedSavings.toFixed(1)}%`;
    }
    // Store active sessions
    const sessions = new Map();
    // Resource Indicator validation (RFC 8707) - validates tokens if present
    const serverUrl = process.env['SERVER_URL'] || `http://${host}:${port}`;
    const resourceValidator = createResourceIndicatorValidator(serverUrl);
    const validateResourceIndicator = optionalResourceIndicatorMiddleware(resourceValidator);
    // SSE endpoint for Server-Sent Events transport
    // Add OAuth validation middleware if OAuth is enabled
    const sseMiddleware = options.enableOAuth && oauth
        ? [validateResourceIndicator, oauth.validateToken()]
        : [validateResourceIndicator];
    app.get('/sse', ...sseMiddleware, async (req, res) => {
        // Extract Google token - from OAuth or Authorization header
        const googleToken = options.enableOAuth && oauth
            ? (oauth.getGoogleToken(req) ?? undefined)
            : req.headers.authorization?.startsWith('Bearer ')
                ? req.headers.authorization.slice(7)
                : undefined;
        // Extract user ID (use token hash as user ID)
        const userId = googleToken ? `google:${googleToken.substring(0, 16)}` : 'anonymous';
        // Check for SSE reconnection via Last-Event-ID header (RFC 8895)
        const lastEventId = req.headers['last-event-id'];
        const requestedSessionId = req.query['session'] || lastEventId;
        // Try to reconnect to existing session if requested
        if (requestedSessionId && sessions.has(requestedSessionId)) {
            const _existingSession = sessions.get(requestedSessionId);
            logger.info('SSE session reconnection', {
                sessionId: requestedSessionId,
                userId,
                lastEventId,
            });
            // Set SSE headers for reconnection
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Session-ID', requestedSessionId);
            res.setHeader('X-Reconnected', 'true');
            // Send reconnection acknowledgment
            res.write(`event: reconnect\ndata: {"sessionId":"${requestedSessionId}","status":"reconnected"}\n\n`);
            // Note: Full event replay would require event buffering in the session
            // This implementation acknowledges reconnection but doesn't replay events
            return;
        }
        // Check session limits before creating new session
        const limitCheck = sessionLimiter.canCreateSession(userId);
        if (!limitCheck.allowed) {
            res.status(429).json({
                error: {
                    code: 'TOO_MANY_SESSIONS',
                    message: limitCheck.reason,
                    retryable: true,
                },
            });
            return;
        }
        const sessionId = randomUUID();
        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Session-ID', sessionId);
        try {
            // Create SSE transport
            const transport = new SSEServerTransport('/sse/message', res);
            // Register session in limiter
            sessionLimiter.registerSession(sessionId, userId);
            // Create and connect MCP server with task store
            const { mcpServer, taskStore } = await createMcpServerInstance(googleToken);
            await mcpServer.connect(transport);
            sessions.set(sessionId, { transport, mcpServer, taskStore });
            // Cleanup on disconnect
            req.on('close', () => {
                const session = sessions.get(sessionId);
                if (session) {
                    // Session cleanup logic can be added here if needed
                }
                sessions.delete(sessionId);
                sessionLimiter.unregisterSession(sessionId);
                if (typeof transport.close === 'function') {
                    transport.close();
                }
            });
        }
        catch (error) {
            res.status(500).json({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to establish SSE connection',
                    details: process.env['NODE_ENV'] === 'production'
                        ? undefined
                        : error instanceof Error
                            ? error.message
                            : String(error),
                },
            });
        }
    });
    // SSE message endpoint
    app.post('/sse/message', validateResourceIndicator, async (req, res) => {
        const sessionId = req.headers['x-session-id'];
        if (!sessionId) {
            res.status(400).json({
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'Missing X-Session-ID header',
                },
            });
            return;
        }
        const session = sessions.get(sessionId);
        const transport = session?.transport;
        if (!transport) {
            res.status(404).json({
                error: {
                    code: 'SESSION_NOT_FOUND',
                    message: 'Session not found',
                },
            });
            return;
        }
        try {
            // Handle incoming message through transport
            if (transport instanceof SSEServerTransport) {
                await transport.handlePostMessage(req, res);
            }
            else {
                res.status(400).json({
                    error: {
                        code: 'INVALID_REQUEST',
                        message: 'Invalid transport type for SSE message',
                    },
                });
            }
        }
        catch (error) {
            res.status(500).json({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to process message',
                    details: process.env['NODE_ENV'] === 'production'
                        ? undefined
                        : error instanceof Error
                            ? error.message
                            : String(error),
                },
            });
        }
    });
    // Streamable HTTP endpoint
    app.post('/mcp', validateResourceIndicator, async (req, res) => {
        // Extract Google token
        const authHeader = req.headers.authorization;
        const googleToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
        // Extract user ID (use token hash as user ID)
        const userId = googleToken ? `google:${googleToken.substring(0, 16)}` : 'anonymous';
        const sessionId = req.headers['x-session-id'] ?? randomUUID();
        try {
            // Create transport if new session
            let session = sessions.get(sessionId);
            let transport = session?.transport;
            if (!transport || !(transport instanceof StreamableHTTPServerTransport)) {
                // Check session limits before creating new session
                const limitCheck = sessionLimiter.canCreateSession(userId);
                if (!limitCheck.allowed) {
                    res.status(429).json({
                        error: {
                            code: 'TOO_MANY_SESSIONS',
                            message: limitCheck.reason,
                            retryable: true,
                        },
                    });
                    return;
                }
                const newTransport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => sessionId,
                });
                transport = newTransport;
                // Register session in limiter
                sessionLimiter.registerSession(sessionId, userId);
                const { mcpServer, taskStore } = await createMcpServerInstance(googleToken);
                sessions.set(sessionId, { transport: newTransport, mcpServer, taskStore });
                // Connect with transport - use type assertion for SDK compatibility
                await mcpServer.connect(newTransport);
            }
            // Handle the request
            if (transport instanceof StreamableHTTPServerTransport) {
                await transport.handleRequest(req, res);
            }
        }
        catch (error) {
            res.status(500).json({
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Failed to process MCP request',
                    details: process.env['NODE_ENV'] === 'production'
                        ? undefined
                        : error instanceof Error
                            ? error.message
                            : String(error),
                },
            });
        }
    });
    // Session cleanup endpoint
    app.delete('/session/:sessionId', (req, res) => {
        const sessionId = req.params['sessionId'];
        if (!sessionId) {
            res.status(400).json({
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'Session ID required',
                },
            });
            return;
        }
        const session = sessions.get(sessionId);
        if (session) {
            if (typeof session.transport.close === 'function') {
                session.transport.close();
            }
            sessions.delete(sessionId);
            sessionLimiter.unregisterSession(sessionId);
            res.json({ success: true, message: 'Session terminated' });
        }
        else {
            res.status(404).json({
                error: {
                    code: 'SESSION_NOT_FOUND',
                    message: 'Session not found',
                },
            });
        }
    });
    // Error handler
    app.use((err, _req, res, _next) => {
        logger.error('HTTP server error', { error: err });
        res.status(500).json({
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Internal server error',
                details: process.env['NODE_ENV'] === 'production' ? undefined : err.message,
            },
        });
    });
    let httpServer = null;
    // Register shutdown callback to close HTTP server
    onShutdown(async () => {
        if (httpServer) {
            logger.info('Closing HTTP server...');
            return new Promise((resolve, reject) => {
                httpServer.close((err) => {
                    if (err) {
                        logger.error('Error closing HTTP server', { error: err });
                        reject(err);
                    }
                    else {
                        logger.info('HTTP server closed');
                        resolve();
                    }
                });
            });
        }
    });
    // Register shutdown callback to close all sessions
    onShutdown(async () => {
        logger.info(`Closing ${sessions.size} active sessions...`);
        for (const [sessionId, session] of sessions.entries()) {
            try {
                // Dispose task store resources
                session.taskStore.dispose();
                if (typeof session.transport.close === 'function') {
                    session.transport.close();
                }
                sessions.delete(sessionId);
            }
            catch (error) {
                logger.error('Error closing transport', { sessionId, error });
            }
        }
        logger.info('All sessions closed');
    });
    return {
        app,
        start: () => {
            return new Promise((resolve) => {
                httpServer = app.listen(port, host, () => {
                    logger.info(`ServalSheets HTTP server listening on ${host}:${port}`);
                    logger.info(`SSE endpoint: http://${host}:${port}/sse`);
                    logger.info(`HTTP endpoint: http://${host}:${port}/mcp`);
                    logger.info(`Health check: http://${host}:${port}/health`);
                    logger.info(`Metrics: ${TOOL_COUNT} tools, ${ACTION_COUNT} actions`);
                    resolve();
                });
            });
        },
        stop: async () => {
            if (httpServer) {
                return new Promise((resolve, reject) => {
                    httpServer.close((err) => {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve();
                        }
                    });
                });
            }
        },
        sessions,
    };
}
/**
 * Start HTTP server - convenience function for CLI
 */
export async function startHttpServer(options = {}) {
    const port = options.port ?? parseInt(process.env['PORT'] ?? '3000', 10);
    const server = createHttpServer({ ...options, port });
    await server.start();
}
/**
 * Start remote server with OAuth - convenience function for CLI
 * This is a compatibility wrapper that enables OAuth mode
 */
export async function startRemoteServer(options = {}) {
    // Validate environment variables
    validateEnv();
    // Load OAuth config from environment
    const oauthConfig = {
        issuer: env.OAUTH_ISSUER,
        clientId: env.OAUTH_CLIENT_ID,
        clientSecret: env.OAUTH_CLIENT_SECRET,
        jwtSecret: env.JWT_SECRET,
        stateSecret: env.STATE_SECRET,
        allowedRedirectUris: env.ALLOWED_REDIRECT_URIS.split(','),
        googleClientId: env.GOOGLE_CLIENT_ID,
        googleClientSecret: env.GOOGLE_CLIENT_SECRET,
        accessTokenTtl: env.ACCESS_TOKEN_TTL,
        refreshTokenTtl: env.REFRESH_TOKEN_TTL,
    };
    const server = createHttpServer({
        port: options.port ?? env.PORT,
        host: env.HOST,
        enableOAuth: true,
        oauthConfig,
        corsOrigins: env.CORS_ORIGINS.split(','),
    });
    await server.start();
}
// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
    (async () => {
        try {
            // Log environment configuration
            logEnvironmentConfig();
            // Start background tasks and validate configuration
            await startBackgroundTasks();
            // Register signal handlers for graceful shutdown
            registerSignalHandlers();
            // Start HTTP server
            const port = parseInt(process.env['PORT'] ?? '3000', 10);
            const server = createHttpServer({ port });
            await server.start();
            logger.info('ServalSheets HTTP server started successfully');
        }
        catch (error) {
            logger.error('Failed to start HTTP server', { error });
            process.exit(1);
        }
    })();
}
//# sourceMappingURL=http-server.js.map