/**
 * ServalSheets - Remote Server Entry Point
 *
 * Combined HTTP/SSE server with OAuth 2.1 support
 * For Claude Connectors Directory
 * MCP Protocol: 2025-11-25
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

import { OAuthProvider } from './oauth-provider.js';
import { createGoogleApiClient } from './services/google-api.js';
import { initTransactionManager } from './services/transaction-manager.js';
import { initConflictDetector } from './services/conflict-detector.js';
import { initImpactAnalyzer } from './services/impact-analyzer.js';
import { initValidationEngine } from './services/validation-engine.js';
import { validateEnv } from './config/env.js';
import { VERSION, SERVER_INFO } from './version.js';
import {
  TOOL_COUNT,
  ACTION_COUNT,
} from './schemas/index.js';
import {
  getToolMetadata,
} from './schemas/annotations.js';
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
import { logger } from './utils/logger.js';
import { registerKnowledgeResources } from './resources/knowledge.js';
import {
  registerServalSheetsPrompts,
  registerServalSheetsResources,
  registerServalSheetsTools,
} from './mcp/registration.js';
import { createServerCapabilities, SERVER_INSTRUCTIONS } from './mcp/features-2025-11-25.js';
import { requestDeduplicator } from './utils/request-deduplication.js';
import { sessionLimiter } from './utils/session-limiter.js';
import { patchMcpServerRequestHandler } from './mcp/sdk-compat.js';

patchMcpServerRequestHandler();

export interface RemoteServerConfig {
  port: number;
  host: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  jwtSecret: string;
  stateSecret: string;
  allowedRedirectUris: string[];
  googleClientId: string;
  googleClientSecret: string;
  corsOrigins: string[];
  accessTokenTtl: number;   // seconds
  refreshTokenTtl: number;  // seconds
}

interface SessionData {
  transport: SSEServerTransport;
  mcpServer: McpServer;
  googleToken: string | null;
  taskStore: TaskStoreAdapter;
}

function loadConfig(): RemoteServerConfig {
  const isProduction = process.env['NODE_ENV'] === 'production';

  // ✅ SECURITY FIX: Require explicit secrets in production
  const jwtSecret = process.env['JWT_SECRET'];
  const stateSecret = process.env['STATE_SECRET'];
  const clientSecret = process.env['OAUTH_CLIENT_SECRET'];

  if (isProduction) {
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is required in production. Generate with: openssl rand -hex 32');
    }
    if (!stateSecret) {
      throw new Error('STATE_SECRET is required in production. Generate with: openssl rand -hex 32');
    }
    if (!clientSecret) {
      throw new Error('OAUTH_CLIENT_SECRET is required in production. Generate with: openssl rand -hex 32');
    }

    // ✅ SECURITY: Require Redis in production for session and task store
    const redisUrl = process.env['REDIS_URL'];
    if (!redisUrl) {
      throw new Error(
        'REDIS_URL is required in production. ' +
        'In-memory session store does not support multiple instances or persist across restarts. ' +
        'Set REDIS_URL=redis://localhost:6379 or your Redis connection string.'
      );
    }

    logger.info('Production mode: Redis session and task store required', {
      redisUrl: redisUrl.replace(/:\/\/.*@/, '://*****@')  // Mask credentials in logs
    });
  } else {
    // Development mode: warn if using random secrets
    if (!jwtSecret || !stateSecret || !clientSecret) {
      logger.warn('⚠️  Using random secrets (development only - DO NOT USE IN PRODUCTION)');
    }
  }

  return {
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    // HIGH-003 FIX: Default to localhost for security (0.0.0.0 exposes to entire network)
    // Override with HOST=0.0.0.0 in production if external access needed
    host: process.env['HOST'] ?? '127.0.0.1',
    issuer: process.env['OAUTH_ISSUER'] ?? 'https://servalsheets.example.com',
    clientId: process.env['OAUTH_CLIENT_ID'] ?? 'servalsheets',
    clientSecret: clientSecret ?? randomUUID(),
    jwtSecret: jwtSecret ?? randomUUID(),
    stateSecret: stateSecret ?? randomUUID(),
    allowedRedirectUris: (process.env['ALLOWED_REDIRECT_URIS'] ?? 'http://localhost:3000/callback').split(','),
    googleClientId: process.env['GOOGLE_CLIENT_ID'] ?? '',
    googleClientSecret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
    corsOrigins: (process.env['CORS_ORIGINS'] ?? 'https://claude.ai,https://claude.com').split(','),
    // Token expiration (seconds)
    accessTokenTtl: parseInt(process.env['ACCESS_TOKEN_TTL'] ?? '3600', 10),      // 1 hour default
    refreshTokenTtl: parseInt(process.env['REFRESH_TOKEN_TTL'] ?? '2592000', 10), // 30 days default
  };
}

/**
 * Start remote server - convenience function for CLI
 */
export async function startRemoteServer(options: { port?: number } = {}): Promise<void> {
  if (options.port) {
    process.env['PORT'] = options.port.toString();
  }
  await main();
}

async function main(): Promise<void> {
  // HIGH-004 FIX: Validate environment variables on startup
  validateEnv();

  const config = loadConfig();
  const app = express();

  // Security
  app.use(helmet({
    contentSecurityPolicy: false,
    strictTransportSecurity: process.env['NODE_ENV'] === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  }));

  // HTTPS Enforcement (Production Only)
  if (process.env['NODE_ENV'] === 'production') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

      if (!isHttps) {
        logger.warn('Rejected non-HTTPS request', { path: req.path, ip: req.ip });
        res.status(426).json({
          error: 'UPGRADE_REQUIRED',
          message: 'HTTPS required in production',
        });
        return;
      }
      next();
    });
  }

  app.set('trust proxy', 1);

  // CORS
  app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'X-Request-ID'],
  }));

  // Origin Validation
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.get('origin');
    if (origin && !config.corsOrigins.includes(origin)) {
      logger.warn('Invalid Origin', { origin, allowed: config.corsOrigins });
      res.status(403).json({ error: 'FORBIDDEN', message: 'Invalid Origin' });
      return;
    }
    next();
  });

  // Rate limiting
  app.use(rateLimit({
    windowMs: 60000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  // JSON parsing
  app.use(express.json({ limit: '10mb' }));

  // OAuth provider
  const oauth = new OAuthProvider({
    issuer: config.issuer,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    jwtSecret: config.jwtSecret,
    stateSecret: config.stateSecret,
    allowedRedirectUris: config.allowedRedirectUris,
    googleClientId: config.googleClientId,
    googleClientSecret: config.googleClientSecret,
    accessTokenTtl: config.accessTokenTtl,
    refreshTokenTtl: config.refreshTokenTtl,
  });

  // Mount OAuth routes
  app.use(oauth.createRouter());

  // Health check with OAuth readiness validation
  // MEDIUM-003 FIX: Comprehensive health check
  app.get('/health', (_req, res) => {
    const checks = {
      server: 'healthy',
      oauth: {
        configured: Boolean(config.googleClientId && config.googleClientSecret),
        issuer: config.issuer,
        clientId: config.clientId,
      },
      session: {
        type: process.env['SESSION_STORE_TYPE'] || 'memory',
        ready: true, // TODO: Add Redis ping check
      },
      version: VERSION,
      tools: TOOL_COUNT,
      actions: ACTION_COUNT,
    };

    // Overall status
    const isHealthy = checks.oauth.configured;
    const status = isHealthy ? 'healthy' : 'degraded';
    const httpStatus = isHealthy ? 200 : 503;

    res.status(httpStatus).json({
      status,
      checks,
      timestamp: new Date().toISOString(),
    });
  });

  // Server info
  app.get('/info', (_req, res) => {
    res.json({
      name: SERVER_INFO.name,
      version: VERSION,
      description: 'Production-grade Google Sheets MCP server',
      protocol: `MCP ${SERVER_INFO.protocolVersion}`,
      tools: getToolMetadata(),
    });
  });

  // Active sessions
  const sessions = new Map<string, SessionData>();

  // SSE endpoint (requires auth)
  app.get('/sse', oauth.validateToken(), async (req, res) => {
    // Extract user ID from token (use Google token hash as user ID)
    const googleToken = oauth.getGoogleToken(req) ?? null;
    const userId = googleToken ? `google:${googleToken.substring(0, 16)}` : 'anonymous';

    // Check session limits before creating new session
    const limitCheck = sessionLimiter.canCreateSession(userId);
    if (!limitCheck.allowed) {
      res.status(429).json({
        error: {
          code: 'TOO_MANY_SESSIONS',
          message: limitCheck.reason,
          retryable: true,
        }
      });
      return;
    }

    const sessionId = randomUUID();
    const googleRefreshToken = oauth.getGoogleRefreshToken(req) ?? undefined;

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Session-ID', sessionId);

    try {
      // Create Google client if token available (with refresh token for auto-refresh)
      const googleClient = googleToken
        ? await createGoogleApiClient({
            accessToken: googleToken,
            refreshToken: googleRefreshToken,
          })
        : undefined;

      // Initialize Phase 4 advanced features (required for sheets_transaction, etc.)
      if (googleClient) {
        initTransactionManager(googleClient);
        initConflictDetector(googleClient);
        initImpactAnalyzer(googleClient);
        initValidationEngine(googleClient);
      }

      // Create task store for SEP-1686 support - uses createTaskStore() for Redis support
      const { createTaskStore } = await import('./core/task-store-factory.js');
      const taskStore = await createTaskStore();

      // Create MCP server
      const mcpServer = new McpServer(
        {
          name: SERVER_INFO.name,
          version: SERVER_INFO.version,
        },
        {
          capabilities: createServerCapabilities(),
          instructions: SERVER_INSTRUCTIONS,
          taskStore,
        }
      );

      // Create SSE transport
      const transport = new SSEServerTransport('/sse/message', res);

      let handlers: ReturnType<typeof createHandlers> | null = null;

      if (googleClient) {
        const context: HandlerContext = {
          batchCompiler: new BatchCompiler({
            rateLimiter: new RateLimiter(),
            diffEngine: new DiffEngine({ sheetsApi: googleClient.sheets }),
            policyEnforcer: new PolicyEnforcer(),
            snapshotService: new SnapshotService({ driveApi: googleClient.drive }),
            sheetsApi: googleClient.sheets,
            onProgress: async (event) => {
              // Send MCP progress notification over SSE transport
              logger.debug('Operation progress', {
                phase: event.phase,
                progress: `${event.current}/${event.total}`,
                message: event.message,
                spreadsheetId: event.spreadsheetId,
              });
            },
          }),
          rangeResolver: new RangeResolver({ sheetsApi: googleClient.sheets }),
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

      registerServalSheetsTools(mcpServer, handlers);
      registerServalSheetsResources(mcpServer, googleClient ?? null);
      registerServalSheetsPrompts(mcpServer);
      registerKnowledgeResources(mcpServer);

      // Connect
      await mcpServer.connect(transport);

      // Store session with task store
      sessions.set(sessionId, { transport, mcpServer, googleToken, taskStore });

      // Register session in limiter
      sessionLimiter.registerSession(sessionId, userId);

      // Cleanup on disconnect
      req.on('close', () => {
        const session = sessions.get(sessionId);
        if (session) {
          // Dispose task store resources
          session.taskStore.dispose();
        }
        sessions.delete(sessionId);
        sessionLimiter.unregisterSession(sessionId);
        if (typeof transport.close === 'function') {
          transport.close();
        }
      });

    } catch (error) {
      logger.error('SSE connection error', { error });
      res.status(500).json({ error: 'Connection failed' });
    }
  });

  // SSE message endpoint
  app.post('/sse/message', oauth.validateToken(), async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    
    if (typeof sessionId !== 'string') {
      res.status(400).json({ error: 'Missing X-Session-ID header' });
      return;
    }
    
    const session = sessions.get(sessionId);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    try {
      await session.transport.handlePostMessage(req, res);
    } catch (error) {
      logger.error('SSE message error', { error });
      res.status(500).json({ error: 'Message processing failed' });
    }
  });

  // Session termination
  app.delete('/session/:sessionId', oauth.validateToken(), (req, res) => {
    const sessionId = req.params['sessionId'];
    
    if (!sessionId) {
      res.status(400).json({ error: 'Session ID required' });
      return;
    }
    
    const session = sessions.get(sessionId);

    if (session) {
      // Dispose task store resources
      session.taskStore.dispose();

      if (typeof session.transport.close === 'function') {
        session.transport.close();
      }
      sessions.delete(sessionId);
      sessionLimiter.unregisterSession(sessionId);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  });

  // Start server
  app.listen(config.port, config.host, () => {
    const banner = `
╔═══════════════════════════════════════════════════════════════╗
║                    ServalSheets.0.0                        ║
║             Production Google Sheets MCP Server               ║
╠═══════════════════════════════════════════════════════════════╣
║  Tools: ${TOOL_COUNT.toString().padEnd(2)}                 Actions: ${ACTION_COUNT.toString().padEnd(3)}                        ║
║  Protocol: MCP 2025-11-25                                     ║
╠═══════════════════════════════════════════════════════════════╣
║  Endpoints:                                                   ║
║    Health:    http://${config.host}:${config.port}/health${' '.repeat(Math.max(0, 30 - config.host.length - config.port.toString().length))}║
║    SSE:       http://${config.host}:${config.port}/sse${' '.repeat(Math.max(0, 33 - config.host.length - config.port.toString().length))}║
║    OAuth:     /.well-known/oauth-authorization-server         ║
╠═══════════════════════════════════════════════════════════════╣
║  OAuth Client ID: ${config.clientId.substring(0, 40).padEnd(42)}║
╚═══════════════════════════════════════════════════════════════╝
`;
    logger.info('ServalSheets remote server started', { banner });
  });
}

// CLI entry point - only run when called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    logger.error('Remote server failed', { error });
    process.exit(1);
  });
}
