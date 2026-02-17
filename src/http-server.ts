/**
 * ServalSheets - HTTP Transport Server
 *
 * Streamable HTTP transport for Claude Connectors Directory
 * Supports both SSE and HTTP streaming
 * MCP Protocol: 2025-11-25
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { resolve, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import * as swaggerUi from 'swagger-ui-express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SetLevelRequestSchema, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { OAuthProvider } from './oauth-provider.js';
import { validateEnv, env, getEnv } from './config/env.js';
import { createGoogleApiClient, GoogleApiClient } from './services/google-api.js';
import { initTransactionManager } from './services/transaction-manager.js';
import { initConflictDetector } from './services/conflict-detector.js';
import { initImpactAnalyzer } from './services/impact-analyzer.js';
import { initValidationEngine } from './services/validation-engine.js';
import { ACTION_COUNT, TOOL_COUNT } from './schemas/action-counts.js';
import { VERSION, SERVER_INFO, SERVER_ICONS } from './version.js';
import { logger } from './utils/logger.js';
import { HealthService } from './server/health.js';
import { metricsHandler, sessionsTotal } from './observability/metrics.js';
import { UserRateLimiter, createUserRateLimiterFromEnv } from './services/user-rate-limiter.js';
import { responseRedactionMiddleware } from './middleware/redaction.js';
import { circuitBreakerRegistry } from './services/circuit-breaker-registry.js';
import {
  BatchCompiler,
  RateLimiter,
  DiffEngine,
  PolicyEnforcer,
  RangeResolver,
  TaskStoreAdapter,
} from './core/index.js';
import { SnapshotService } from './services/snapshot.js';
import { createHandlers, type HandlerContext } from './handlers/index.js';
import { handleLoggingSetLevel } from './handlers/logging.js';
import {
  registerKnowledgeResources,
  registerHistoryResources,
  registerCacheResources,
  registerTransactionResources,
  registerConflictResources,
  registerImpactResources,
  registerValidationResources,
  registerMetricsResources,
  registerConfirmResources,
  registerAnalyzeResources,
  registerReferenceResources,
  registerSchemaResources,
  registerCostDashboardResources,
  registerGuideResources,
  registerDecisionResources,
  registerExamplesResources,
  registerPatternResources,
  registerSheetResources,
  registerDiscoveryResources,
  registerConnectionHealthResource,
  registerRestartHealthResource,
  registerMasterIndexResource,
  registerKnowledgeIndexResource,
  registerKnowledgeSearchResource,
  initializeResourceNotifications,
} from './resources/index.js';
import { getTraceAggregator } from './services/trace-aggregator.js';
import { getRequestRecorder, initRequestRecorder } from './services/request-recorder.js';
import {
  extractVersionFromRequest,
  addDeprecationHeaders,
  type VersionSelection,
} from './versioning/schema-manager.js';
// import { addGraphQLEndpoint } from './graphql/index.js'; // Temporarily disabled
import { addAdminRoutes, type AdminSessionManager } from './admin/index.js';
import {
  registerServalSheetsPrompts,
  registerServalSheetsResources,
  registerServalSheetsTools,
} from './mcp/registration.js';
import { createServerCapabilities, SERVER_INSTRUCTIONS } from './mcp/features-2025-11-25.js';
import { InMemoryEventStore, RedisEventStore } from './mcp/event-store.js';
import {
  startBackgroundTasks,
  registerSignalHandlers,
  onShutdown,
  logEnvironmentConfig,
  getCacheStats,
  getDeduplicationStats,
  getConnectionStats,
  getTracingStats,
} from './startup/lifecycle.js';
import { requestDeduplicator } from './utils/request-deduplication.js';
import { sessionLimiter } from './utils/session-limiter.js';
import { registerWellKnownHandlers } from './server/well-known.js';
import {
  optionalResourceIndicatorMiddleware,
  createResourceIndicatorValidator,
} from './security/index.js';
import { getWebhookManager, getWebhookQueue } from './services/index.js';

export interface HttpServerOptions {
  port?: number;
  host?: string;
  corsOrigins?: string[];
  rateLimitWindowMs?: number;
  rateLimitMax?: number;
  trustProxy?: boolean;

  // OAuth mode (optional)
  enableOAuth?: boolean;
  oauthConfig?: {
    issuer: string;
    clientId: string;
    clientSecret: string;
    jwtSecret: string;
    stateSecret: string;
    allowedRedirectUris: string[];
    googleClientId: string;
    googleClientSecret: string;
    accessTokenTtl: number;
    refreshTokenTtl: number;
  };
}

const DEFAULT_PORT = 3000;
// HIGH-003 FIX: Default to localhost for security (0.0.0.0 exposes to entire network)
// Override with HOST=0.0.0.0 in production if external access needed
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60000;
const DEFAULT_RATE_LIMIT_MAX = 100;

// Monkey-patches removed: All schemas now use flattened z.object() pattern
// which works natively with MCP SDK v1.25.x - no patches required!

async function createMcpServerInstance(
  googleToken?: string,
  googleRefreshToken?: string
): Promise<{ mcpServer: McpServer; taskStore: TaskStoreAdapter }> {
  // Create task store for SEP-1686 support - uses createTaskStore() for Redis support
  const { createTaskStore } = await import('./core/task-store-factory.js');
  const taskStore = await createTaskStore();

  const mcpServer = new McpServer(
    {
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
      icons: SERVER_ICONS,
    },
    {
      capabilities: createServerCapabilities(),
      instructions: SERVER_INSTRUCTIONS,
      taskStore,
    }
  );

  let handlers = null;
  let googleClient: GoogleApiClient | null = null;
  let context: HandlerContext | null = null;

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

    // Initialize all performance optimizations (batching, caching, merging, prefetching)
    const { initializePerformanceOptimizations } = await import('./startup/performance-init.js');
    const {
      batchingSystem,
      cachedSheetsApi,
      requestMerger,
      parallelExecutor,
      prefetchPredictor,
      accessPatternTracker,
      queryOptimizer,
    } = await initializePerformanceOptimizations(googleClient.sheets);

    context = {
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
      googleClient, // For authentication checks in handlers
      batchingSystem, // Time-window batching system for reducing API calls
      cachedSheetsApi, // ETag-based caching for reads (30-50% API savings)
      requestMerger, // Phase 2: Merge overlapping read requests (20-40% API savings)
      parallelExecutor, // Phase 2: Parallel batch execution (40% faster batch ops)
      prefetchPredictor, // Phase 3: Predictive prefetching (200-500ms latency reduction)
      accessPatternTracker, // Phase 3: Access pattern learning for smarter predictions
      queryOptimizer, // Phase 3B: Adaptive query optimization (-25% avg latency)
      snapshotService, // Pass to context for HistoryHandler undo/revert (Task 1.3)
      auth: {
        // Use getters to always read live values from GoogleApiClient
        // This ensures re-auth with broader scopes takes effect immediately
        get hasElevatedAccess() {
          return googleClient?.hasElevatedAccess ?? false;
        },
        get scopes() {
          return googleClient?.scopes ?? [];
        },
      },
      samplingServer: mcpServer.server, // Pass underlying Server instance for sampling
      server: mcpServer.server, // Pass Server instance for elicitation/sampling (SEP-1036, SEP-1577)
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
  await registerKnowledgeResources(mcpServer);

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

  // Register cost dashboard resources (billing integration)
  registerCostDashboardResources(mcpServer);

  // Register discovery resources (requires Google client)
  if (googleClient) {
    registerDiscoveryResources(mcpServer);
  }

  // Register dynamic sheet discovery (requires Google client + context)
  if (googleClient && context) {
    registerSheetResources(mcpServer, context);
  }

  // Register guide, decision, examples, and pattern resources
  registerGuideResources(mcpServer);
  registerDecisionResources(mcpServer);
  registerExamplesResources(mcpServer);
  registerPatternResources(mcpServer);

  // Register health resources
  registerConnectionHealthResource(mcpServer);
  registerRestartHealthResource(mcpServer);

  // Register index and knowledge search resources
  registerMasterIndexResource(mcpServer);
  registerKnowledgeIndexResource(mcpServer);
  registerKnowledgeSearchResource(mcpServer);

  // Initialize resource change notifications
  initializeResourceNotifications(mcpServer);

  // Register logging handler
  mcpServer.server.setRequestHandler(SetLevelRequestSchema, async (request: z.infer<typeof SetLevelRequestSchema>) => {
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
export function createHttpServer(options: HttpServerOptions = {}): {
  app: unknown;
  start: () => Promise<void>;
  stop: () => Promise<void> | undefined;
  sessions: unknown;
} {
  const port = options.port ?? DEFAULT_PORT;
  const host = options.host ?? DEFAULT_HOST;
  const corsOrigins = options.corsOrigins ?? ['https://claude.ai', 'https://claude.com'];
  const rateLimitWindowMs = options.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS;
  const rateLimitMax = options.rateLimitMax ?? DEFAULT_RATE_LIMIT_MAX;
  const trustProxy = options.trustProxy ?? true;
  const envConfig = getEnv();
  const legacySseEnabled = envConfig.ENABLE_LEGACY_SSE;
  const eventStoreRedisUrl = envConfig.REDIS_URL;
  const eventStoreTtlMs = envConfig.STREAMABLE_HTTP_EVENT_TTL_MS;
  const eventStoreMaxEvents = envConfig.STREAMABLE_HTTP_EVENT_MAX_EVENTS;

  const app = express();

  // Derive __dirname for ESM (needed for static file serving)
  const dirname = resolve(fileURLToPath(import.meta.url), '..', '..');

  // Health service for liveness/readiness probes
  // Note: GoogleClient is session-specific, so health checks will report on active sessions
  const healthService = new HealthService(null);

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allow SSE
      strictTransportSecurity:
        process.env['NODE_ENV'] === 'production'
          ? {
              maxAge: 31536000, // 1 year
              includeSubDomains: true,
              preload: true,
            }
          : false, // Disable in development (localhost issues)
    })
  );

  // Compression middleware (gzip)
  app.use(
    compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      threshold: 1024, // Only compress responses larger than 1KB
    })
  );

  // Response redaction middleware (strips tokens, API keys from error responses)
  // Enabled by default in production, or when ENABLE_RESPONSE_REDACTION=true
  app.use(responseRedactionMiddleware());

  // Schema versioning middleware (P3-5)
  // Handles version negotiation via query param or header
  app.use((req: Request, res: Response, next: NextFunction) => {
    const versionSelection = extractVersionFromRequest(req);
    addDeprecationHeaders(res, versionSelection);
    (req as any).schemaVersion = versionSelection.selectedVersion;
    next();
  });

  // Request recording middleware (P3-6)
  // Records all tool calls to SQLite for replay and debugging
  // Controlled by RECORD_REQUESTS env var (default: true)
  const recorder = getRequestRecorder();
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalJson = res.json.bind(res);

    // Intercept res.json to capture response
    res.json = function (data: any) {
      const duration = Date.now() - startTime;

      // Extract tool info from request body
      const toolName = req.body?.tool || req.body?.name || 'unknown';
      const action = req.body?.action || req.body?.arguments?.action || 'unknown';
      const spreadsheetId =
        req.body?.spreadsheetId ||
        req.body?.arguments?.spreadsheetId ||
        req.body?.params?.spreadsheetId ||
        null;

      // Record the request/response pair
      recorder.record({
        timestamp: startTime,
        tool_name: toolName,
        action,
        spreadsheet_id: spreadsheetId,
        request_body: JSON.stringify(req.body || {}),
        response_body: JSON.stringify(data),
        status_code: res.statusCode,
        duration_ms: duration,
        error_message: data?.error ? JSON.stringify(data.error) : null,
      });

      return originalJson(data);
    };

    next();
  });

  // HTTPS Enforcement (Production Only)
  if (process.env['NODE_ENV'] === 'production') {
    app.use((req: Request, res: Response, next: NextFunction) => {
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
            reason:
              'Security: OAuth tokens and sensitive data must be transmitted over encrypted connections',
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
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'X-Request-ID',
        'X-Session-ID',
        'MCP-Session-Id',
        'MCP-Protocol-Version',
        'Last-Event-ID',
      ],
      exposedHeaders: ['MCP-Session-Id', 'X-Session-ID', 'MCP-Protocol-Version'],
    })
  );

  // Origin Validation for Authenticated Endpoints
  // CORS handles browser preflight, but this adds explicit validation for all authenticated requests
  app.use((req: Request, res: Response, next: NextFunction) => {
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

  // DNS Rebinding Protection - Host header validation
  // Ensures requests target expected hostnames, preventing DNS rebinding attacks
  // that could bypass Origin checks by pointing a malicious domain at localhost
  app.use((req: Request, res: Response, next: NextFunction) => {
    const host = req.get('host');

    // Skip for requests without Host header (non-standard but possible)
    if (!host) {
      next();
      return;
    }

    // Extract hostname (strip port)
    const hostname = (host.split(':')[0] ?? host).toLowerCase();

    // Allow localhost variants and configured hostnames
    const allowedHosts = new Set([
      'localhost',
      '127.0.0.1',
      '::1',
      '0.0.0.0',
      ...(process.env['SERVAL_ALLOWED_HOSTS']?.split(',').map((h) => h.trim().toLowerCase()) ?? []),
    ]);

    if (!allowedHosts.has(hostname)) {
      logger.warn('Rejected request with invalid Host header (DNS rebinding protection)', {
        host,
        hostname,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Invalid Host header',
        details: {
          received: hostname,
          hint: 'Set SERVAL_ALLOWED_HOSTS env var to allow additional hostnames',
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
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: res.getHeader('RateLimit-Reset'),
      });
    },
  });

  // Apply rate limiting to all routes EXCEPT health checks
  // Health checks must not be rate-limited to ensure reliable monitoring
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/health')) {
      return next(); // Skip rate limiter for health endpoints
    }
    limiter(req, res, next);
  });

  // Add explicit X-RateLimit-* headers for better client compatibility
  app.use((req: Request, res: Response, next: NextFunction) => {
    // express-rate-limit@8 sets RateLimit-* headers (RFC 6585)
    // Also expose as X-RateLimit-* for legacy compatibility
    const limit = res.getHeader('RateLimit-Limit');
    const remaining = res.getHeader('RateLimit-Remaining');
    const reset = res.getHeader('RateLimit-Reset');

    if (limit) res.setHeader('X-RateLimit-Limit', limit);
    if (remaining) res.setHeader('X-RateLimit-Remaining', remaining);
    if (reset) res.setHeader('X-RateLimit-Reset', reset);

    next();
  });

  // Parse JSON
  app.use(express.json({ limit: '10mb' }));

  // MCP Protocol Version Header (MCP 2025-11-25 Compliance)
  // Specification: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports.md
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Always set supported version on response
    res.setHeader('MCP-Protocol-Version', '2025-11-25');

    // Skip version check for non-MCP endpoints (health, metrics, info, etc.)
    if (
      !req.path.startsWith('/sse') &&
      !req.path.startsWith('/mcp') &&
      !req.path.startsWith('/session')
    ) {
      return next();
    }

    const clientVersion = req.headers['mcp-protocol-version'] as string | undefined;

    // If client specifies a different version, reject with 400
    if (clientVersion && clientVersion !== '2025-11-25') {
      logger.warn('Request rejected: unsupported MCP protocol version', {
        clientVersion,
        supportedVersion: '2025-11-25',
        path: req.path,
        method: req.method,
      });

      res.status(400).json({
        error: 'UNSUPPORTED_PROTOCOL_VERSION',
        message: `MCP protocol version '${clientVersion}' is not supported`,
        details: {
          requested: clientVersion,
          supported: '2025-11-25',
          spec: 'https://modelcontextprotocol.io/specification/2025-11-25/basic/transports',
        },
      });
      return;
    }

    next();
  });

  // OAuth provider (optional)
  let oauth: OAuthProvider | null = null;
  if (options.enableOAuth && options.oauthConfig) {
    oauth = new OAuthProvider(options.oauthConfig);
    app.use(oauth.createRouter());
    logger.info('HTTP Server: OAuth mode enabled', {
      issuer: options.oauthConfig.issuer,
      clientId: options.oauthConfig.clientId,
    });
  }

  // Per-user rate limiting with Redis (optional)
  let userRateLimiter: UserRateLimiter | null = null;
  const redisUrl = process.env['REDIS_URL'];

  if (redisUrl) {
    (async () => {
      try {
        const { createClient } = await import('redis');
        const redis = createClient({ url: redisUrl });

        redis.on('error', (err) => {
          logger.error('Redis connection error', { error: err });
        });

        await redis.connect();

        userRateLimiter = createUserRateLimiterFromEnv(redis);
        logger.info('Per-user rate limiter initialized with Redis', {
          redisUrl: redisUrl.replace(/:[^:]*@/, ':***@'), // Mask credentials
        });
      } catch (error) {
        logger.error('Failed to initialize Redis for rate limiting', { error });
        logger.warn('Continuing without per-user rate limiting');
      }
    })();
  } else {
    logger.debug('REDIS_URL not set, per-user rate limiting disabled');
  }

  // Per-user rate limiting middleware (if Redis available)
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    // Skip rate limiting for health checks
    if (req.path.startsWith('/health')) {
      return next();
    }

    if (!userRateLimiter) {
      return next(); // No Redis, skip per-user limiting
    }

    try {
      // Extract user ID from Authorization header
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      // Use token hash as user ID (or 'anonymous' if no token)
      const userId = token
        ? `user:${Buffer.from(token.substring(0, 16)).toString('base64')}`
        : 'anonymous';

      const limitCheck = await userRateLimiter.checkLimit(userId);

      if (!limitCheck.allowed) {
        res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Per-user rate limit exceeded',
          retryAfter: limitCheck.resetAt.toISOString(),
          remaining: 0,
          minuteUsage: limitCheck.minuteUsage,
          hourUsage: limitCheck.hourUsage,
        });
        return;
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-User-Remaining', limitCheck.remaining.toString());
      res.setHeader('X-RateLimit-User-Reset', limitCheck.resetAt.toISOString());

      next();
    } catch (error) {
      logger.error('Per-user rate limit check failed', { error });
      next(); // Fail open - allow request on error
    }
  });

  // Request ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  // Enterprise middleware (all feature-flagged, default OFF)
  // Uses lazy loading: middleware modules are imported on first request to avoid
  // blocking startup, while maintaining correct middleware ordering.

  // Tenant Isolation (must be before RBAC - tenant context needed for RBAC decisions)
  if (envConfig.ENABLE_TENANT_ISOLATION) {
    let tenantMw: Promise<typeof import('./middleware/tenant-isolation.js')> | null = null;
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (!tenantMw) {
        tenantMw = import('./middleware/tenant-isolation.js');
        logger.info('HTTP Server: Tenant isolation middleware enabled');
      }
      void tenantMw.then((mod) => {
        mod.tenantIsolationMiddleware()(req, res, next);
      }).catch(next);
    });
  }

  // RBAC (Role-Based Access Control)
  if (envConfig.ENABLE_RBAC) {
    let rbacMw: Promise<typeof import('./middleware/rbac-middleware.js')> | null = null;
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (!rbacMw) {
        rbacMw = import('./middleware/rbac-middleware.js');
        logger.info('HTTP Server: RBAC middleware enabled');
      }
      void rbacMw.then((mod) => {
        mod.rbacMiddleware()(req, res, next);
      }).catch(next);
    });
  }

  // W3C Trace Context middleware (distributed tracing)
  // Spec: https://www.w3.org/TR/trace-context/
  app.use((req: Request, res: Response, next: NextFunction) => {
    const incomingTraceparent = req.header('traceparent');

    let traceId: string;
    let parentId: string;

    if (incomingTraceparent) {
      // Parse: version-traceId-parentId-flags (e.g., "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01")
      const parts = incomingTraceparent.split('-');
      if (parts.length === 4 && parts[0] === '00' && parts[1] && parts[2]) {
        traceId = parts[1]; // 32 hex chars
        parentId = parts[2]; // 16 hex chars
      } else {
        // Invalid format, generate new trace
        traceId = randomBytes(16).toString('hex');
        parentId = randomBytes(8).toString('hex');
        logger.warn('Invalid traceparent header, generating new trace', {
          traceparent: incomingTraceparent,
        });
      }
    } else {
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
  app.get('/health/live', async (_req: Request, res: Response) => {
    const health = await healthService.checkLiveness();
    res.status(200).json(health);
  });

  // Readiness probe - Is the server ready to handle requests?
  app.get('/health/ready', async (_req: Request, res: Response) => {
    const baseHealth = await healthService.checkReadiness();

    // Extended health response with OAuth and session info
    const health: typeof baseHealth & {
      oauth?: {
        enabled: boolean;
        configured: boolean;
        issuer?: string;
        clientId?: string;
      };
      sessions?: {
        active: number;
        hasAuthentication: boolean;
      };
    } = { ...baseHealth };

    // Add OAuth status if enabled
    if (options.enableOAuth && options.oauthConfig) {
      health.oauth = {
        enabled: true,
        configured: Boolean(
          options.oauthConfig.googleClientId && options.oauthConfig.googleClientSecret
        ),
        issuer: options.oauthConfig.issuer,
        clientId: options.oauthConfig.clientId,
      };
    }

    // Add active session info
    health.sessions = {
      active: sessions.size,
      hasAuthentication: sessions.size > 0, // Sessions are created with auth tokens
    };

    // Return 200 for healthy/degraded, 503 for unhealthy
    const statusCode = health.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(health);
  });

  // Legacy /health endpoint (redirects to /health/ready for compatibility)
  app.get('/health', async (_req: Request, res: Response) => {
    const health = await healthService.checkReadiness();
    const statusCode = health.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(health);
  });

  // Trace context endpoint - View current request's trace information
  app.get('/trace', (req: Request, res: Response) => {
    const traceId = req.headers['x-trace-id'] as string | undefined;
    const spanId = req.headers['x-span-id'] as string | undefined;
    const parentSpanId = req.headers['x-parent-span-id'] as string | undefined;
    const requestId = req.headers['x-request-id'] as string | undefined;

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
  app.get('/info', (req: Request, res: Response) => {
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || `${host}:${port}`;
    const baseUrl = `${protocol}://${hostHeader}`;
    const transports = legacySseEnabled
      ? ['stdio', 'streamable-http', 'sse']
      : ['stdio', 'streamable-http'];
    const endpoints: Record<string, string> = {
      mcp: `${baseUrl}/mcp`,
      health: `${baseUrl}/health`,
      metrics: `${baseUrl}/metrics`,
      circuitBreakers: `${baseUrl}/metrics/circuit-breakers`,
      stats: `${baseUrl}/stats`,
      traces: `${baseUrl}/traces`,
      tracesRecent: `${baseUrl}/traces/recent`,
      tracesSlow: `${baseUrl}/traces/slow`,
      tracesErrors: `${baseUrl}/traces/errors`,
      tracesStats: `${baseUrl}/traces/stats`,
      apiDocs: `${baseUrl}/api-docs`,
      openapiJson: `${baseUrl}/api-docs/openapi.json`,
      openapiYaml: `${baseUrl}/api-docs/openapi.yaml`,
    };
    if (legacySseEnabled) {
      endpoints['sse'] = `${baseUrl}/sse`;
    }

    res.json({
      name: SERVER_INFO.name,
      version: VERSION,
      description: 'Production-grade Google Sheets MCP server',
      tools: TOOL_COUNT,
      actions: ACTION_COUNT,
      protocol: `MCP ${SERVER_INFO.protocolVersion}`,
      transports,
      discovery: {
        mcp_configuration: `${baseUrl}/.well-known/mcp-configuration`,
        oauth_authorization_server: `${baseUrl}/.well-known/oauth-authorization-server`,
        oauth_protected_resource: `${baseUrl}/.well-known/oauth-protected-resource`,
      },
      endpoints,
    });
  });

  // Explicit HEAD support for directory compliance testing
  // Express auto-handles HEAD for GET routes, but explicit handlers
  // ensure consistent behavior for Anthropic directory health checks
  app.head('/health', (_req: Request, res: Response) => res.status(200).end());
  app.head('/health/live', (_req: Request, res: Response) => res.status(200).end());
  app.head('/health/ready', (_req: Request, res: Response) => res.status(200).end());
  app.head('/info', (_req: Request, res: Response) => res.status(200).end());

  // OpenAPI/Swagger documentation
  const openapiJsonPath = join(process.cwd(), 'openapi.json');
  const openapiYamlPath = join(process.cwd(), 'openapi.yaml');

  // Serve OpenAPI spec (JSON)
  app.get('/api-docs/openapi.json', (req: Request, res: Response) => {
    try {
      if (existsSync(openapiJsonPath)) {
        const spec = JSON.parse(readFileSync(openapiJsonPath, 'utf-8'));
        res.json(spec);
      } else {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'OpenAPI spec not generated. Run: npm run gen:openapi',
          },
        });
      }
    } catch (error) {
      logger.error('Failed to serve OpenAPI spec', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load OpenAPI spec',
        },
      });
    }
  });

  // Serve OpenAPI spec (YAML)
  app.get('/api-docs/openapi.yaml', (req: Request, res: Response) => {
    try {
      if (existsSync(openapiYamlPath)) {
        const spec = readFileSync(openapiYamlPath, 'utf-8');
        res.set('Content-Type', 'text/yaml');
        res.send(spec);
      } else {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'OpenAPI spec not generated. Run: npm run gen:openapi',
          },
        });
      }
    } catch (error) {
      logger.error('Failed to serve OpenAPI spec', { error });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load OpenAPI spec',
        },
      });
    }
  });

  // Swagger UI
  if (existsSync(openapiJsonPath)) {
    try {
      const openapiSpec = JSON.parse(readFileSync(openapiJsonPath, 'utf-8'));
      app.use(
        '/api-docs',
        swaggerUi.serve,
        swaggerUi.setup(openapiSpec, {
          customCss: '.swagger-ui .topbar { display: none }',
          customSiteTitle: 'ServalSheets API Documentation',
          customfavIcon: '/favicon.ico',
        })
      );
      logger.info('Swagger UI enabled at /api-docs');
    } catch (error) {
      logger.warn('Failed to load OpenAPI spec for Swagger UI', { error });
    }
  } else {
    // Provide placeholder route when spec not generated
    app.get('/api-docs', (req: Request, res: Response) => {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'API documentation not available. Generate OpenAPI spec with: npm run gen:openapi',
          hint: 'Run the generator script to create openapi.json and enable interactive documentation',
        },
      });
    });
  }

  // Prometheus metrics endpoint
  app.get('/metrics', metricsHandler);

  // Circuit breaker metrics endpoint
  app.get('/metrics/circuit-breakers', async (_req: Request, res: Response) => {
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
    } catch (error) {
      logger.error('Failed to fetch circuit breaker metrics', { error });
      res.status(500).json({ error: 'Failed to fetch circuit breaker metrics' });
    }
  });

  // Webhook delivery dashboard endpoint
  app.get('/webhooks/dashboard', async (req: Request, res: Response) => {
    try {
      const { getWebhookManager, getWebhookQueue } = await import('./services/index.js');

      // Get spreadsheet filter if provided
      const spreadsheetId = req.query['spreadsheetId'] as string | undefined;

      const manager = getWebhookManager();
      const queue = getWebhookQueue();

      // Get all webhooks (filtered by spreadsheetId if provided)
      const webhooks = await manager.list(spreadsheetId, undefined);

      // Get queue statistics
      const queueStats = await queue.getStats();

      // Calculate aggregate statistics
      const totalWebhooks = webhooks.length;
      const activeWebhooks = webhooks.filter((w) => w.active).length;
      const totalDeliveries = webhooks.reduce((sum, w) => sum + w.deliveryCount, 0);
      const totalFailures = webhooks.reduce((sum, w) => sum + w.failureCount, 0);

      // Calculate average delivery rate (deliveries per webhook)
      const avgDeliveryRate = totalWebhooks > 0 ? totalDeliveries / totalWebhooks : 0;

      // Per-webhook statistics
      const webhookStats = webhooks.map((webhook) => {
        const successCount = webhook.deliveryCount - webhook.failureCount;
        const successRate =
          webhook.deliveryCount > 0 ? (successCount / webhook.deliveryCount) * 100 : 0;

        return {
          webhookId: webhook.webhookId,
          spreadsheetId: webhook.spreadsheetId,
          active: webhook.active,
          deliveryCount: webhook.deliveryCount,
          failureCount: webhook.failureCount,
          successRate: Math.round(successRate * 100) / 100, // 2 decimal places
          avgDeliveryTimeMs: webhook.avgDeliveryTimeMs,
          p95DeliveryTimeMs: webhook.p95DeliveryTimeMs,
          p99DeliveryTimeMs: webhook.p99DeliveryTimeMs,
          lastDelivery: webhook.lastDelivery,
          lastFailure: webhook.lastFailure,
        };
      });

      res.json({
        timestamp: new Date().toISOString(),
        summary: {
          totalWebhooks,
          activeWebhooks,
          totalDeliveries,
          totalFailures,
          avgDeliveryRate: Math.round(avgDeliveryRate * 100) / 100,
        },
        queue: {
          pending: queueStats.pendingCount,
          retry: queueStats.retryCount,
          dlq: queueStats.dlqCount,
        },
        webhooks: webhookStats,
      });
    } catch (error) {
      logger.error('Failed to fetch webhook dashboard', { error });
      res.status(500).json({ error: 'Failed to fetch webhook dashboard' });
    }
  });

  // Statistics dashboard endpoint
  app.get('/stats', async (req: Request, res: Response) => {
    const cacheStats = getCacheStats() as Record<string, unknown> | null;
    const dedupStats = getDeduplicationStats() as Record<string, unknown> | null;
    const connStats = getConnectionStats() as Record<string, unknown> | null;
    const tracingStats = getTracingStats() as Record<string, unknown> | null;
    const memUsage = process.memoryUsage();

    // Get per-user quota stats if rate limiter available
    let userQuota = null;
    if (userRateLimiter) {
      try {
        // Extract user ID from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
        const userId = token
          ? `user:${Buffer.from(token.substring(0, 16)).toString('base64')}`
          : 'anonymous';

        const quotaStats = await userRateLimiter.getUsage(userId);
        userQuota = {
          enabled: true,
          minuteUsage: quotaStats.minuteUsage,
          minuteLimit: quotaStats.minuteLimit,
          minuteRemaining: quotaStats.minuteRemaining,
          hourUsage: quotaStats.hourUsage,
          hourLimit: quotaStats.hourLimit,
          hourRemaining: quotaStats.hourRemaining,
        };
      } catch (error) {
        logger.error('Failed to get per-user quota stats', { error });
        userQuota = { enabled: false, error: 'Failed to fetch quota' };
      }
    }

    res.json({
      uptime: {
        seconds: Math.floor(process.uptime()),
        formatted: formatUptime(process.uptime()),
      },
      cache: cacheStats
        ? {
            enabled: true,
            totalEntries: cacheStats['totalEntries'] as number,
            totalSizeMB: parseFloat(((cacheStats['totalSize'] as number) / 1024 / 1024).toFixed(2)),
            hits: cacheStats['hits'] as number,
            misses: cacheStats['misses'] as number,
            hitRate: parseFloat((cacheStats['hitRate'] as number).toFixed(2)),
            byNamespace: cacheStats['byNamespace'] as Record<string, unknown>,
            oldestEntry: cacheStats['oldestEntry']
              ? new Date(cacheStats['oldestEntry'] as number).toISOString()
              : null,
            newestEntry: cacheStats['newestEntry']
              ? new Date(cacheStats['newestEntry'] as number).toISOString()
              : null,
          }
        : { enabled: false },
      deduplication: dedupStats
        ? {
            enabled: true,
            totalRequests: dedupStats['totalRequests'] as number,
            deduplicatedRequests: dedupStats['deduplicatedRequests'] as number,
            savedRequests: dedupStats['savedRequests'] as number,
            deduplicationRate: parseFloat((dedupStats['deduplicationRate'] as number).toFixed(2)),
            pendingCount: dedupStats['pendingCount'] as number,
            oldestRequestAgeMs: dedupStats['oldestRequestAge'] as number,
          }
        : { enabled: false },
      connection: connStats
        ? {
            status: connStats['status'] as string,
            uptimeSeconds: connStats['uptimeSeconds'] as number,
            totalHeartbeats: connStats['totalHeartbeats'] as number,
            disconnectWarnings: connStats['disconnectWarnings'] as number,
            timeSinceLastActivityMs: connStats['timeSinceLastActivity'] as number,
            lastActivity: new Date(connStats['lastActivity'] as number).toISOString(),
          }
        : null,
      tracing: tracingStats
        ? {
            totalSpans: tracingStats['totalSpans'] as number,
            averageDurationMs: parseFloat((tracingStats['averageDuration'] as number).toFixed(2)),
            spansByKind: tracingStats['spansByKind'] as Record<string, unknown>,
            spansByStatus: tracingStats['spansByStatus'] as Record<string, unknown>,
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
        apiCallReduction:
          dedupStats && cacheStats
            ? {
                deduplicationSavings: `${(dedupStats['deduplicationRate'] as number).toFixed(1)}%`,
                cacheSavings: `${(cacheStats['hitRate'] as number).toFixed(1)}%`,
                estimatedTotalSavings: calculateTotalSavings(dedupStats, cacheStats),
              }
            : null,
      },
      sessions: {
        active: sessions.size,
      },
      userQuota: userQuota || { enabled: false },
      circuitBreakers: circuitBreakerRegistry.getAllStats(),
    });
  });

  // ==================== Trace Endpoints ====================

  // Search traces with filters
  app.get('/traces', (req: Request, res: Response) => {
    try {
      // Uses static import at top of file
      const aggregator = getTraceAggregator();

      if (!aggregator.isEnabled()) {
        res.json({
          enabled: false,
          message:
            'Trace aggregation is not enabled. Set TRACE_AGGREGATION_ENABLED=true to enable.',
        });
        return;
      }

      // Parse query filters
      const filters: Record<string, unknown> = {};
      if (req.query['tool']) filters['tool'] = req.query['tool'] as string;
      if (req.query['action']) filters['action'] = req.query['action'] as string;
      if (req.query['errorCode']) filters['errorCode'] = req.query['errorCode'] as string;
      if (req.query['success']) filters['success'] = req.query['success'] === 'true';
      if (req.query['minDuration'])
        filters['minDuration'] = Number.parseInt(req.query['minDuration'] as string, 10);
      if (req.query['maxDuration'])
        filters['maxDuration'] = Number.parseInt(req.query['maxDuration'] as string, 10);
      if (req.query['startTime'])
        filters['startTime'] = Number.parseInt(req.query['startTime'] as string, 10);
      if (req.query['endTime'])
        filters['endTime'] = Number.parseInt(req.query['endTime'] as string, 10);

      const limit = req.query['limit'] ? Number.parseInt(req.query['limit'] as string, 10) : 100;

      const traces = aggregator.searchTraces(
        filters as import('./services/trace-aggregator.js').TraceSearchFilters
      );

      res.json({
        count: traces.length,
        traces: traces.slice(0, limit),
        filters,
        _links: {
          self: '/traces',
          recent: '/traces/recent',
          slow: '/traces/slow',
          errors: '/traces/errors',
          stats: '/traces/stats',
        },
      });
    } catch (error) {
      logger.error('Failed to search traces', { error });
      res.status(500).json({ error: 'Failed to search traces' });
    }
  });

  // Get recent traces
  app.get('/traces/recent', (req: Request, res: Response) => {
    try {
      // Uses static import at top of file
      const aggregator = getTraceAggregator();

      if (!aggregator.isEnabled()) {
        res.json({
          enabled: false,
          message:
            'Trace aggregation is not enabled. Set TRACE_AGGREGATION_ENABLED=true to enable.',
        });
        return;
      }

      const limit = req.query['limit'] ? Number.parseInt(req.query['limit'] as string, 10) : 100;
      const traces = aggregator.getRecentTraces(limit);

      res.json({
        count: traces.length,
        traces,
      });
    } catch (error) {
      logger.error('Failed to get recent traces', { error });
      res.status(500).json({ error: 'Failed to get recent traces' });
    }
  });

  // Get slowest traces
  app.get('/traces/slow', (req: Request, res: Response) => {
    try {
      // Uses static import at top of file
      const aggregator = getTraceAggregator();

      if (!aggregator.isEnabled()) {
        res.json({
          enabled: false,
          message:
            'Trace aggregation is not enabled. Set TRACE_AGGREGATION_ENABLED=true to enable.',
        });
        return;
      }

      const limit = req.query['limit'] ? Number.parseInt(req.query['limit'] as string, 10) : 10;
      const traces = aggregator.getSlowestTraces(limit);

      res.json({
        count: traces.length,
        traces,
      });
    } catch (error) {
      logger.error('Failed to get slowest traces', { error });
      res.status(500).json({ error: 'Failed to get slowest traces' });
    }
  });

  // Get error traces
  app.get('/traces/errors', (req: Request, res: Response) => {
    try {
      // Uses static import at top of file
      const aggregator = getTraceAggregator();

      if (!aggregator.isEnabled()) {
        res.json({
          enabled: false,
          message:
            'Trace aggregation is not enabled. Set TRACE_AGGREGATION_ENABLED=true to enable.',
        });
        return;
      }

      const limit = req.query['limit'] ? Number.parseInt(req.query['limit'] as string, 10) : 100;
      const traces = aggregator.getErrorTraces(limit);

      res.json({
        count: traces.length,
        traces,
      });
    } catch (error) {
      logger.error('Failed to get error traces', { error });
      res.status(500).json({ error: 'Failed to get error traces' });
    }
  });

  // Get trace statistics
  app.get('/traces/stats', (_req: Request, res: Response) => {
    try {
      // Uses static import at top of file
      const aggregator = getTraceAggregator();

      if (!aggregator.isEnabled()) {
        res.json({
          enabled: false,
          message:
            'Trace aggregation is not enabled. Set TRACE_AGGREGATION_ENABLED=true to enable.',
        });
        return;
      }

      const stats = aggregator.getStats();
      const cacheStats = aggregator.getCacheStats();

      res.json({
        timestamp: new Date().toISOString(),
        enabled: true,
        cache: cacheStats,
        statistics: {
          total: stats.totalTraces,
          success: stats.successCount,
          errors: stats.errorCount,
          errorRate:
            stats.totalTraces > 0
              ? ((stats.errorCount / stats.totalTraces) * 100).toFixed(2) + '%'
              : '0%',
          averageDuration: `${stats.averageDuration.toFixed(2)}ms`,
          p50Duration: `${stats.p50Duration.toFixed(2)}ms`,
          p95Duration: `${stats.p95Duration.toFixed(2)}ms`,
          p99Duration: `${stats.p99Duration.toFixed(2)}ms`,
        },
        byTool: Object.entries(stats.byTool).map(([tool, toolStats]) => {
          const stats = toolStats as { count: number; averageDuration: number; errorRate: number };
          return {
            tool,
            count: stats.count,
            averageDuration: `${stats.averageDuration.toFixed(2)}ms`,
            errorRate: `${(stats.errorRate * 100).toFixed(2)}%`,
          };
        }),
        byError: stats.byError,
      });
    } catch (error) {
      logger.error('Failed to get trace stats', { error });
      res.status(500).json({ error: 'Failed to get trace stats' });
    }
  });

  // Get specific trace by request ID
  app.get('/traces/:requestId', (req: Request, res: Response) => {
    try {
      // Uses static import at top of file
      const aggregator = getTraceAggregator();

      if (!aggregator.isEnabled()) {
        res.json({
          enabled: false,
          message:
            'Trace aggregation is not enabled. Set TRACE_AGGREGATION_ENABLED=true to enable.',
        });
        return;
      }

      const requestId = req.params['requestId'] as string;
      const trace = aggregator.getTrace(requestId);

      if (!trace) {
        res.status(404).json({
          error: 'Trace not found',
          requestId,
          hint: 'Traces are kept in memory for 5 minutes. Check /traces/recent for available traces.',
        });
        return;
      }

      res.json(trace);
    } catch (error) {
      logger.error('Failed to get trace', { error, requestId: req.params['requestId'] });
      res.status(500).json({ error: 'Failed to get trace' });
    }
  });

  // ==================== End of Trace Endpoints ====================

  // ==================== Tracing UI Routes ====================

  // Integrate tracing dashboard UI (P3-2)
  // Loaded synchronously - routes are added during server initialization
  try {
    import('./http-server-tracing-ui.js')
      .then(({ addTracingUIRoutes }) => {
        addTracingUIRoutes(app);
        logger.info('Tracing UI routes loaded successfully');
      })
      .catch((error) => {
        logger.warn('Failed to load tracing UI routes', { error });
        // UI routes are optional - server still functions without them
      });
  } catch (error) {
    logger.warn('Failed to initialize tracing UI', { error });
  }

  // ==================== End of Tracing UI Routes ====================

  // Helper function to format uptime
  function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
  }

  // Helper function to calculate total savings
  function calculateTotalSavings(
    dedupStats: Record<string, unknown>,
    cacheStats: Record<string, unknown>
  ): string {
    // Estimate combined savings (not perfect but reasonable approximation)
    // Deduplication happens first, cache applies to non-deduplicated requests
    const dedupRate = (dedupStats['deduplicationRate'] as number) / 100;
    const cacheRate = (cacheStats['hitRate'] as number) / 100;
    const combinedSavings = (dedupRate + (1 - dedupRate) * cacheRate) * 100;
    return `~${combinedSavings.toFixed(1)}%`;
  }

  // Session security context for preventing hijacking (MCP 2025-11-25 Security)
  interface SessionSecurityContext {
    ipAddress: string;
    userAgent: string;
    tokenHash: string; // First 16 chars of token hash for validation
  }

  /**
   * Create security context for session binding
   */
  function createSecurityContext(req: Request, token: string): SessionSecurityContext {
    const ipAddress = (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.ip ||
      'unknown'
    ).trim();
    const userAgent = (req.headers['user-agent'] as string) || 'unknown';
    const tokenHash = createHash('sha256').update(token).digest('hex').substring(0, 16);

    return { ipAddress, userAgent, tokenHash };
  }

  /**
   * Verify security context matches for reconnection
   */
  function verifySecurityContext(
    stored: SessionSecurityContext,
    current: SessionSecurityContext
  ): { valid: boolean; reason?: string } {
    if (stored.tokenHash !== current.tokenHash) {
      return { valid: false, reason: 'Token mismatch' };
    }
    if (stored.userAgent !== current.userAgent) {
      return { valid: false, reason: 'User-agent mismatch' };
    }
    if (stored.ipAddress !== current.ipAddress) {
      // IP mismatch is a warning but not blocking (mobile networks can change IPs)
      logger.warn('Session IP address changed', {
        stored: stored.ipAddress,
        current: current.ipAddress,
      });
    }
    return { valid: true };
  }

  const createEventStore = (sessionId: string): InMemoryEventStore | RedisEventStore => {
    const options = {
      ttlMs: eventStoreTtlMs,
      maxEvents: eventStoreMaxEvents,
      streamId: sessionId,
    };
    if (eventStoreRedisUrl) {
      return new RedisEventStore(eventStoreRedisUrl, options);
    }
    return new InMemoryEventStore(options);
  };

  const clearEventStore = (eventStore?: { clear: () => void | Promise<void> }): void => {
    if (!eventStore) {
      return;
    }
    void Promise.resolve(eventStore.clear()).catch((error) => {
      logger.warn('Failed to clear event store', { error });
    });
  };

  // Store active sessions with security binding
  const sessions = new Map<
    string,
    {
      transport: SSEServerTransport | StreamableHTTPServerTransport;
      mcpServer: McpServer;
      taskStore: TaskStoreAdapter;
      eventStore?: InMemoryEventStore | RedisEventStore;
      securityContext: SessionSecurityContext; // Security binding to prevent hijacking
      lastActivity: number; // Timestamp of last request for idle eviction
    }
  >();

  // Idle session cleanup (prevents memory leak from abandoned sessions)
  const sessionTimeoutMs = envConfig.SESSION_TIMEOUT_MS;

  const sessionCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastActivity > sessionTimeoutMs) {
        sessions.delete(id);
        sessionsTotal.set(sessions.size);
        sessionLimiter.unregisterSession(id);
        clearEventStore(session.eventStore);
        if (typeof session.transport.close === 'function') {
          session.transport.close();
        }
        logger.info('Evicted idle session', { sessionId: id });
      }
    }
  }, 60000);

  // Resource Indicator validation (RFC 8707) - validates tokens if present
  const serverUrl = process.env['SERVER_URL'] || `http://${host}:${port}`;
  const resourceValidator = createResourceIndicatorValidator(serverUrl);
  const validateResourceIndicator = optionalResourceIndicatorMiddleware(resourceValidator);

  const coerceHeaderValue = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  const normalizeSessionHeader = (req: Request): string | undefined => {
    const existing = coerceHeaderValue(req.headers['mcp-session-id']);
    if (existing) {
      return existing;
    }

    const legacy = coerceHeaderValue(req.headers['x-session-id']);
    if (legacy) {
      (req.headers as Record<string, string | string[] | undefined>)['mcp-session-id'] = legacy;
    }
    return legacy;
  };

  // SSE endpoint for Server-Sent Events transport
  // Add OAuth validation middleware if OAuth is enabled
  const sseMiddleware =
    options.enableOAuth && oauth
      ? [validateResourceIndicator as express.RequestHandler, oauth.validateToken()]
      : [validateResourceIndicator as express.RequestHandler];

  const legacySseHeaders = {
    Deprecation: 'true',
    Sunset: 'Wed, 29 Apr 2026 00:00:00 GMT',
    Link: '</mcp>; rel="alternate"',
  };

  if (!legacySseEnabled) {
    app.get('/sse', ...sseMiddleware, (_req: Request, res: Response) => {
      res
        .status(410)
        .set(legacySseHeaders)
        .json({
          error: {
            code: 'DEPRECATED',
            message: 'Legacy SSE transport is disabled. Use /mcp (Streamable HTTP).',
            retryable: false,
          },
        });
    });

    app.post(
      '/sse/message',
      validateResourceIndicator as express.RequestHandler,
      (_req: Request, res: Response) => {
        res
          .status(410)
          .set(legacySseHeaders)
          .json({
            error: {
              code: 'DEPRECATED',
              message: 'Legacy SSE transport is disabled. Use /mcp (Streamable HTTP).',
              retryable: false,
            },
          });
      }
    );
  } else {
    app.get('/sse', ...sseMiddleware, async (req: Request, res: Response) => {
      // Extract Google token - from OAuth or Authorization header
      const googleToken =
        options.enableOAuth && oauth
          ? ((await oauth.getGoogleToken(req)) ?? undefined)
          : req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : undefined;

      // Extract user ID (use token hash as user ID)
      const userId = googleToken ? `google:${googleToken.substring(0, 16)}` : 'anonymous';

      // Check for SSE reconnection via Last-Event-ID header (RFC 8895)
      const lastEventId = req.headers['last-event-id'] as string | undefined;
      const requestedSessionId = (req.query['session'] as string | undefined) || lastEventId;

      // Try to reconnect to existing session if requested
      if (requestedSessionId && sessions.has(requestedSessionId)) {
        const existingSession = sessions.get(requestedSessionId)!;

        // Verify security context to prevent session hijacking
        const currentSecurityContext = createSecurityContext(req, googleToken || '');
        const securityCheck = verifySecurityContext(
          existingSession.securityContext,
          currentSecurityContext
        );

        if (!securityCheck.valid) {
          logger.warn('Session reconnection rejected - security context mismatch', {
            sessionId: requestedSessionId,
            reason: securityCheck.reason,
            userId,
          });

          res
            .status(403)
            .set(legacySseHeaders)
            .json({
              error: {
                code: 'SESSION_SECURITY_VIOLATION',
                message: `Session reconnection rejected: ${securityCheck.reason}`,
                retryable: false,
              },
            });
          return;
        }

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
        res.setHeader('Deprecation', legacySseHeaders.Deprecation);
        res.setHeader('Sunset', legacySseHeaders.Sunset);
        res.setHeader('Link', legacySseHeaders.Link);

        // Send reconnection acknowledgment
        res.write(
          `event: reconnect\ndata: {"sessionId":"${requestedSessionId}","status":"reconnected"}\n\n`
        );

        // Replay events if lastEventId provided and eventStore available
        if (lastEventId && existingSession?.eventStore) {
          try {
            logger.info('Replaying SSE events after reconnection', {
              sessionId: requestedSessionId,
              lastEventId,
            });

            await existingSession.eventStore.replayEventsAfter(lastEventId, {
              send: async (eventId: string, message: unknown) => {
                res.write(`id: ${eventId}\n`);
                res.write(`data: ${JSON.stringify(message)}\n\n`);
              },
            });

            logger.info('SSE event replay completed', {
              sessionId: requestedSessionId,
            });
          } catch (error) {
            logger.warn('SSE event replay failed', {
              sessionId: requestedSessionId,
              lastEventId,
              error,
            });
          }
        }

        return;
      }

      // Check session limits before creating new session
      const limitCheck = sessionLimiter.canCreateSession(userId);
      if (!limitCheck.allowed) {
        res
          .status(429)
          .set(legacySseHeaders)
          .json({
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
      res.setHeader('Deprecation', legacySseHeaders.Deprecation);
      res.setHeader('Sunset', legacySseHeaders.Sunset);
      res.setHeader('Link', legacySseHeaders.Link);

      try {
        // Create SSE transport
        const transport = new SSEServerTransport('/sse/message', res);

        // Register session in limiter
        sessionLimiter.registerSession(sessionId, userId);

        // Create security context for session binding
        const securityContext = createSecurityContext(req, googleToken || '');

        // Create event store for event replay on reconnection
        const eventStore = createEventStore(sessionId);

        // Create and connect MCP server with task store
        const { mcpServer, taskStore } = await createMcpServerInstance(googleToken);
        await mcpServer.connect(transport);
        sessions.set(sessionId, { transport, mcpServer, taskStore, securityContext, eventStore, lastActivity: Date.now() });
        sessionsTotal.set(sessions.size);

        // Cleanup on disconnect
        req.on('close', () => {
          const session = sessions.get(sessionId);
          if (session) {
            // Session cleanup logic can be added here if needed
          }
          sessions.delete(sessionId);
          sessionsTotal.set(sessions.size);
          sessionLimiter.unregisterSession(sessionId);
          if (typeof transport.close === 'function') {
            transport.close();
          }
        });
      } catch (error) {
        res
          .status(500)
          .set(legacySseHeaders)
          .json({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to establish SSE connection',
              details:
                process.env['NODE_ENV'] === 'production'
                  ? undefined
                  : error instanceof Error
                    ? error.message
                    : String(error),
            },
          });
      }
    });

    // SSE message endpoint
    app.post(
      '/sse/message',
      validateResourceIndicator as express.RequestHandler,
      async (req: Request, res: Response) => {
        const sessionId =
          (req.headers['x-session-id'] as string | undefined) ||
          (req.headers['mcp-session-id'] as string | undefined);

        if (!sessionId) {
          res
            .status(400)
            .set(legacySseHeaders)
            .json({
              error: {
                code: 'INVALID_REQUEST',
                message: 'Missing X-Session-ID header',
              },
            });
          return;
        }

        const session = sessions.get(sessionId);
        if (session) session.lastActivity = Date.now();
        const transport = session?.transport;

        if (!transport) {
          res
            .status(404)
            .set(legacySseHeaders)
            .json({
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
          } else {
            res
              .status(400)
              .set(legacySseHeaders)
              .json({
                error: {
                  code: 'INVALID_REQUEST',
                  message: 'Invalid transport type for SSE message',
                },
              });
          }
        } catch (error) {
          res
            .status(500)
            .set(legacySseHeaders)
            .json({
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to process message',
                details:
                  process.env['NODE_ENV'] === 'production'
                    ? undefined
                    : error instanceof Error
                      ? error.message
                      : String(error),
              },
            });
        }
      }
    );
  }

  // Streamable HTTP endpoint (GET/POST/DELETE)
  const streamableMiddleware =
    options.enableOAuth && oauth
      ? [validateResourceIndicator as express.RequestHandler, oauth.validateToken()]
      : [validateResourceIndicator as express.RequestHandler];

  app.all('/mcp', ...streamableMiddleware, async (req: Request, res: Response) => {
    // Extract Google token
    const authHeader = req.headers.authorization;
    const googleToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    // Extract user ID (use token hash as user ID)
    const userId = googleToken ? `google:${googleToken.substring(0, 16)}` : 'anonymous';

    const sessionId = normalizeSessionHeader(req);
    const isPost = req.method === 'POST';

    try {
      // Create transport if new session (POST + initialize only)
      let session = sessionId ? sessions.get(sessionId) : undefined;
      if (session) session.lastActivity = Date.now();
      let transport = session?.transport;

      if (sessionId && session && !(transport instanceof StreamableHTTPServerTransport)) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Session exists but uses a different transport protocol',
          },
        });
        return;
      }

      if (!transport) {
        if (sessionId && !isPost) {
          res.status(404).json({
            error: {
              code: 'SESSION_NOT_FOUND',
              message: 'Session not found',
            },
          });
          return;
        }
        if (!isPost) {
          res.status(400).json({
            error: {
              code: 'INVALID_REQUEST',
              message: 'Missing Mcp-Session-Id header',
            },
          });
          return;
        }

        const body = req.body as unknown;
        const isInitRequest = Array.isArray(body)
          ? body.some((msg) => isInitializeRequest(msg))
          : isInitializeRequest(body);

        if (sessionId && !isInitRequest) {
          res.status(404).json({
            error: {
              code: 'SESSION_NOT_FOUND',
              message: 'Session not found',
            },
          });
          return;
        }

        if (!isInitRequest) {
          res.status(400).json({
            error: {
              code: 'INVALID_REQUEST',
              message: 'Bad Request: No valid session ID provided',
            },
          });
          return;
        }

        if (sessionId) {
          res.status(400).json({
            error: {
              code: 'INVALID_REQUEST',
              message:
                'Mcp-Session-Id must not be provided on initialize; the server generates session IDs',
            },
          });
          return;
        }

        const newSessionId = randomUUID();

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

        const eventStore = createEventStore(newSessionId);
        const newTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId,
          eventStore,
        });
        transport = newTransport;

        // Register session in limiter
        sessionLimiter.registerSession(newSessionId, userId);

        // Create security context for session binding
        const securityContext = createSecurityContext(req, googleToken || '');

        const { mcpServer, taskStore } = await createMcpServerInstance(googleToken);
        sessions.set(newSessionId, {
          transport: newTransport,
          mcpServer,
          taskStore,
          eventStore,
          securityContext,
          lastActivity: Date.now(),
        });
        sessionsTotal.set(sessions.size);

        newTransport.onclose = () => {
          sessions.delete(newSessionId);
          sessionsTotal.set(sessions.size);
          sessionLimiter.unregisterSession(newSessionId);
          clearEventStore(eventStore);
        };

        // Connect with transport - use type assertion for SDK compatibility
        await mcpServer.connect(newTransport as unknown as Parameters<typeof mcpServer.connect>[0]);
      } else if (session && transport instanceof StreamableHTTPServerTransport) {
        // Reconnecting to existing session - verify security context
        const currentSecurityContext = createSecurityContext(req, googleToken || '');
        const securityCheck = verifySecurityContext(
          session.securityContext,
          currentSecurityContext
        );

        if (!securityCheck.valid) {
          logger.warn('StreamableHTTP session rejected - security context mismatch', {
            sessionId,
            reason: securityCheck.reason,
            userId,
          });

          res.status(403).json({
            error: {
              code: 'SESSION_SECURITY_VIOLATION',
              message: `Session reconnection rejected: ${securityCheck.reason}`,
              retryable: false,
            },
          });
          return;
        }
      }

      // Handle the request
      if (transport instanceof StreamableHTTPServerTransport) {
        await transport.handleRequest(req, res, isPost ? req.body : undefined);
      }
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process MCP request',
          details:
            process.env['NODE_ENV'] === 'production'
              ? undefined
              : error instanceof Error
                ? error.message
                : String(error),
        },
      });
    }
  });

  // Session cleanup endpoint
  app.delete('/session/:sessionId', (req: Request, res: Response) => {
    const sessionId = req.params['sessionId'] as string;

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
      clearEventStore(session.eventStore);
      sessions.delete(sessionId);
      sessionsTotal.set(sessions.size);
      sessionLimiter.unregisterSession(sessionId);
      res.json({ success: true, message: 'Session terminated' });
    } else {
      res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found',
        },
      });
    }
  });

  // =====================================================================
  // Phase 1: Webhook Drive API Callback Endpoint
  // =====================================================================

  /**
   * Helper function to categorize changes into webhook event types
   * (Phase 4.2A - Fine-Grained Event Filtering)
   */
  function categorizeChanges(
    diff: import('./schemas/shared.js').DiffResult
  ): Array<import('./schemas/webhook.js').WebhookEventType> {
    const eventTypes = new Set<import('./schemas/webhook.js').WebhookEventType>();

    // Check for sheet-level changes
    if (diff.sheetChanges) {
      if (diff.sheetChanges.sheetsAdded.length > 0) {
        eventTypes.add('sheet.create');
      }
      if (diff.sheetChanges.sheetsRemoved.length > 0) {
        eventTypes.add('sheet.delete');
      }
      if (diff.sheetChanges.sheetsRenamed.length > 0) {
        eventTypes.add('sheet.rename');
      }
    }

    // Check for cell changes (tier-specific)
    if (diff.tier === 'SAMPLE' && diff.samples) {
      const hasChanges =
        diff.samples.firstRows.length > 0 ||
        diff.samples.lastRows.length > 0 ||
        diff.samples.randomRows.length > 0;
      if (hasChanges) {
        eventTypes.add('cell.update');
      }
    } else if (diff.tier === 'FULL' && diff.changes) {
      if (diff.changes.length > 0) {
        // Check if changes include format changes
        const hasFormatChanges = diff.changes.some((c) => c.type === 'format');
        if (hasFormatChanges) {
          eventTypes.add('format.update');
        }
        eventTypes.add('cell.update');
      }
    }

    // Fallback to generic sheet.update if no specific events detected
    if (eventTypes.size === 0) {
      eventTypes.add('sheet.update');
    }

    return Array.from(eventTypes);
  }

  /**
   * POST /webhook/drive-callback
   *
   * Receives push notifications from Google Drive API watch channels.
   * Validates X-Goog headers, enqueues events for async delivery.
   *
   * Drive API headers:
   * - X-Goog-Channel-ID: Unique channel identifier
   * - X-Goog-Resource-State: Event type (sync, update, trash, etc.)
   * - X-Goog-Resource-ID: Resource identifier from watch response
   * - X-Goog-Channel-Token: Webhook ID for correlation
   * - X-Goog-Message-Number: Sequential message number
   *
   * @see https://developers.google.com/workspace/drive/api/guides/push
   */
  app.post('/webhook/drive-callback', async (req: Request, res: Response) => {
    try {
      // Extract X-Goog headers
      const channelId = req.headers['x-goog-channel-id'] as string;
      const resourceState = req.headers['x-goog-resource-state'] as string;
      const resourceId = req.headers['x-goog-resource-id'] as string;
      const channelToken = req.headers['x-goog-channel-token'] as string; // webhookId
      const messageNumber = req.headers['x-goog-message-number'] as string;

      logger.info('Drive API webhook callback received', {
        channelId,
        resourceState,
        resourceId,
        messageNumber,
      });

      // Validate required headers
      if (!channelId || !resourceState || !resourceId || !channelToken) {
        logger.warn('Drive webhook callback missing required headers', {
          channelId,
          resourceState,
          resourceId,
          channelToken,
        });
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing required X-Goog headers',
          },
        });
        return;
      }

      // Handle sync event (initial verification)
      if (resourceState === 'sync') {
        logger.info('Drive webhook sync event acknowledged', { channelId });
        res.status(200).send('OK');
        return;
      }

      // Get webhook record
      const webhookManager = getWebhookManager();
      if (!webhookManager) {
        logger.error('Webhook manager not initialized');
        res.status(503).json({
          error: {
            code: 'SERVICE_NOT_INITIALIZED',
            message: 'Webhook manager not available',
          },
        });
        return;
      }

      const webhook = await webhookManager.get(channelToken);
      if (!webhook) {
        logger.warn('Webhook not found for callback', { webhookId: channelToken });
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Webhook not found',
          },
        });
        return;
      }

      // Validate channelId and resourceId match stored values (security check against spoofing)
      if (webhook.channelId !== channelId || webhook.resourceId !== resourceId) {
        logger.warn('Webhook validation failed - ID mismatch', {
          webhookId: channelToken,
          headerChannelId: channelId,
          storedChannelId: webhook.channelId,
          headerResourceId: resourceId,
          storedResourceId: webhook.resourceId,
        });
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Unauthorized webhook - ID mismatch',
          },
        });
        return;
      }

      logger.info('Webhook validation passed', {
        webhookId: channelToken,
        channelId,
        resourceId,
      });

      // Phase 4.2A: Use DiffEngine to detect and categorize changes
      let detectedEventTypes: Array<import('./schemas/webhook.js').WebhookEventType> = [];
      let changeDetails: import('./schemas/webhook.js').WebhookPayload['changeDetails'] = undefined;

      try {
        // Capture current state
        const currentState = await webhookManager.diffEngine.captureState(webhook.spreadsheetId, {
          tier: 'SAMPLE', // Use SAMPLE tier for balance between accuracy and performance
        });

        // Try to get cached previous state
        const previousState = await webhookManager.getCachedState(webhook.spreadsheetId);

        if (previousState) {
          // Compare states to detect specific changes
          const diff = await webhookManager.diffEngine.compareStates(previousState, currentState);

          // Categorize changes into event types
          detectedEventTypes = categorizeChanges(diff);

          // Build changeDetails for webhook payload
          const cellRanges: string[] = [];

          // Extract cell ranges based on diff tier
          if (diff.tier === 'FULL' && diff.changes && diff.changes.length > 0) {
            // For FULL tier, collect first few changed cells (already in A1 notation)
            const cells = diff.changes.slice(0, 10).map((c) => c.cell);
            if (cells.length > 0) {
              cellRanges.push(cells.join(', '));
            }
          } else if (diff.tier === 'SAMPLE' && diff.samples) {
            // For SAMPLE tier, note that changes were detected via sampling
            const totalSamples =
              diff.samples.firstRows.length +
              diff.samples.lastRows.length +
              diff.samples.randomRows.length;
            if (totalSamples > 0) {
              cellRanges.push(`${totalSamples} cells changed (detected via sampling)`);
            }
          }

          if (diff.sheetChanges) {
            changeDetails = {
              sheetsAdded: diff.sheetChanges.sheetsAdded.map((s) => s.title),
              sheetsRemoved: diff.sheetChanges.sheetsRemoved.map((s) => s.title),
              sheetsRenamed: diff.sheetChanges.sheetsRenamed.map((s) => ({
                from: s.oldTitle,
                to: s.newTitle,
              })),
              cellRanges,
            };
          }

          logger.info('Drive webhook changes detected', {
            webhookId: webhook.webhookId,
            spreadsheetId: webhook.spreadsheetId,
            detectedEventTypes,
            changeDetails,
          });
        } else {
          // No previous state - use fallback event type from Drive notification
          const eventTypeMap: Record<string, 'sheet.update' | 'sheet.delete'> = {
            update: 'sheet.update',
            trash: 'sheet.delete',
          };
          detectedEventTypes = [eventTypeMap[resourceState] || 'sheet.update'];

          logger.info('Drive webhook no previous state - using fallback', {
            webhookId: webhook.webhookId,
            spreadsheetId: webhook.spreadsheetId,
            resourceState,
            eventType: detectedEventTypes[0],
          });
        }

        // Cache current state for future comparisons
        await webhookManager.cacheState(webhook.spreadsheetId, currentState);
      } catch (diffError) {
        // Fallback to simple event mapping if diff fails
        logger.warn('Failed to detect changes via DiffEngine - using fallback', {
          webhookId: webhook.webhookId,
          spreadsheetId: webhook.spreadsheetId,
          error: diffError instanceof Error ? diffError.message : String(diffError),
        });

        const eventTypeMap: Record<string, 'sheet.update' | 'sheet.delete'> = {
          update: 'sheet.update',
          trash: 'sheet.delete',
        };
        detectedEventTypes = [eventTypeMap[resourceState] || 'sheet.update'];
      }

      // Filter detected events by webhook subscription
      const matchedEventTypes = detectedEventTypes.filter(
        (eventType) => webhook.eventTypes.includes(eventType) || webhook.eventTypes.includes('all')
      );

      // Skip delivery if no matched events
      if (matchedEventTypes.length === 0) {
        logger.info('Drive webhook events filtered out - no matching subscriptions', {
          webhookId: webhook.webhookId,
          spreadsheetId: webhook.spreadsheetId,
          detected: detectedEventTypes,
          subscribed: webhook.eventTypes,
        });

        res.status(200).send('OK');
        return;
      }

      // Enqueue events for async delivery
      const webhookQueue = getWebhookQueue();
      if (!webhookQueue) {
        logger.error('Webhook queue not initialized');
        res.status(503).json({
          error: {
            code: 'SERVICE_NOT_INITIALIZED',
            message: 'Webhook queue not available',
          },
        });
        return;
      }

      // Enqueue each matched event type separately
      for (const eventType of matchedEventTypes) {
        await webhookQueue.enqueue({
          webhookId: webhook.webhookId,
          webhookUrl: webhook.webhookUrl,
          eventType,
          payload: {
            channelId,
            resourceId,
            resourceState,
            spreadsheetId: webhook.spreadsheetId,
            messageNumber,
            timestamp: new Date().toISOString(),
            changeDetails,
          },
          secret: undefined, // Secret not exposed in WebhookInfo for security
          maxAttempts: env.WEBHOOK_MAX_ATTEMPTS,
          scheduledAt: Date.now(),
        });
      }

      // Phase 4.2A: Record event stats for filtering efficiency tracking
      await webhookManager.recordEventStats(
        webhook.webhookId,
        detectedEventTypes,
        matchedEventTypes
      );

      logger.info('Drive webhook events enqueued', {
        webhookId: webhook.webhookId,
        spreadsheetId: webhook.spreadsheetId,
        eventTypes: matchedEventTypes,
        filteredOut: detectedEventTypes.length - matchedEventTypes.length,
      });

      // Respond immediately (async delivery)
      res.status(200).send('OK');
    } catch (error) {
      logger.error('Drive webhook callback error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process webhook callback',
        },
      });
    }
  });

  // Error handler
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('HTTP server error', {
      error: err,
      request: {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
      stack: err.stack,
    });
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: process.env['NODE_ENV'] === 'production' ? undefined : err.message,
      },
    });
  });

  let httpServer: ReturnType<typeof app.listen> | null = null;

  // Register shutdown callback to close HTTP server
  onShutdown(async () => {
    if (httpServer) {
      logger.info('Closing HTTP server...');
      return new Promise<void>((resolve, reject) => {
        httpServer!.close((err) => {
          if (err) {
            logger.error('Error closing HTTP server', { error: err });
            reject(err);
          } else {
            logger.info('HTTP server closed');
            resolve();
          }
        });
      });
    }
  });

  // Clear session cleanup interval on shutdown
  onShutdown(async () => {
    clearInterval(sessionCleanupInterval);
  });

  // Register shutdown callback to close all sessions
  onShutdown(async () => {
    logger.info(`Closing ${sessions.size} active sessions...`);
    for (const [sessionId, session] of sessions.entries()) {
      try {
        // Dispose task store resources
        session.taskStore.dispose();
        clearEventStore(session.eventStore);

        if (typeof session.transport.close === 'function') {
          session.transport.close();
        }
        sessions.delete(sessionId);
      } catch (error) {
        logger.error('Error closing transport', { sessionId, error });
      }
    }
    sessionsTotal.set(sessions.size);
    logger.info('All sessions closed');
  });

  // NOTE: GraphQL handler context function temporarily disabled
  // const getHandlerContextForGraphQL = (req: Request): HandlerContext => {
  //   // ... implementation ...
  // };

  // NOTE: GraphQL endpoint temporarily disabled due to TypeScript issues
  // Will be re-enabled after fixing handler integration
  // addGraphQLEndpoint(app, getHandlerContextForGraphQL)
  //   .then(() => {
  //     logger.info('GraphQL endpoint initialized at /graphql');
  //   })
  //   .catch((error) => {
  //     logger.error('Failed to initialize GraphQL endpoint', { error });
  //   });

  // Session manager for admin dashboard
  const sessionManager: AdminSessionManager = {
    getAllSessions: () => {
      return Array.from(sessions.entries()).map(([id]) => ({
        id,
        clientName: 'MCP Client',
        clientVersion: '1.0.0',
        createdAt: Date.now(), // Approximate - sessions don't track creation time
      }));
    },
    getSessionCount: () => sessions.size,
    getTotalRequests: () => {
      // Approximate - use deduplication stats as proxy
      const stats = requestDeduplicator.getStats();
      return stats.totalRequests;
    },
  };

  // Initialize Admin Dashboard (P3-7)
  addAdminRoutes(app, sessionManager);

  return {
    app,
    start: async () => {
      await new Promise<void>((resolve) => {
        httpServer = app.listen(port, host, () => {
          logger.info(`ServalSheets HTTP server listening on ${host}:${port}`);
          if (legacySseEnabled) {
            logger.info(`SSE endpoint: http://${host}:${port}/sse`);
          } else {
            logger.info('Legacy SSE endpoints disabled (use /mcp)');
          }
          logger.info(`HTTP endpoint: http://${host}:${port}/mcp`);
          logger.info(`Health check: http://${host}:${port}/health`);
          logger.info(`Metrics: ${TOOL_COUNT} tools, ${ACTION_COUNT} actions`);
          resolve();
        });
      });

    },
    stop: async () => {
      if (httpServer) {
        return new Promise<void>((resolve, reject) => {
          httpServer!.close((err) => {
            if (err) {
              reject(err);
            } else {
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
export async function startHttpServer(options: HttpServerOptions = {}): Promise<void> {
  const port = options.port ?? parseInt(process.env['PORT'] ?? '3000', 10);
  const server = createHttpServer({ ...options, port });
  await server.start();
}

/**
 * Start remote server with OAuth - convenience function for CLI
 * This is a compatibility wrapper that enables OAuth mode
 */
export async function startRemoteServer(options: { port?: number } = {}): Promise<void> {
  // Validate environment variables
  validateEnv();

  // Load OAuth config from environment
  const oauthConfig = {
    issuer: env.OAUTH_ISSUER,
    clientId: env.OAUTH_CLIENT_ID,
    clientSecret: env.OAUTH_CLIENT_SECRET!,
    jwtSecret: env.JWT_SECRET!,
    stateSecret: env.STATE_SECRET!,
    allowedRedirectUris: env.ALLOWED_REDIRECT_URIS.split(','),
    googleClientId: env.GOOGLE_CLIENT_ID!,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET!,
    accessTokenTtl: env.ACCESS_TOKEN_TTL,
    refreshTokenTtl: env.REFRESH_TOKEN_TTL,
  };

  const server = createHttpServer({
    port: options.port ?? env.PORT,
    host: env.HOST,
    enableOAuth: true,
    oauthConfig,
    corsOrigins: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
  });

  await server.start();
}

const isDirectEntry = (() => {
  try {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '');
  } catch {
    return false;
  }
})();

// CLI entry point
if (isDirectEntry) {
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
    } catch (error) {
      logger.error('Failed to start HTTP server', { error });
      process.exit(1);
    }
  })();
}
