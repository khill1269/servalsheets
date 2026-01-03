/**
 * ServalSheets - Remote Server Entry Point
 * 
 * Combined HTTP/SSE server with OAuth 2.1 support
 * For Claude Connectors Directory
 * MCP Protocol: 2025-11-25
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

import { OAuthProvider } from './oauth-provider.js';
import { createGoogleApiClient } from './services/google-api.js';
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
} from './core/index.js';
import { SnapshotService } from './services/snapshot.js';
import { createHandlers, type HandlerContext } from './handlers/index.js';
import { logger } from './utils/logger.js';
import {
  registerServalSheetsPrompts,
  registerServalSheetsResources,
  registerServalSheetsTools,
} from './mcp/registration.js';

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
}

interface SessionData {
  transport: SSEServerTransport;
  mcpServer: McpServer;
  googleToken: string | null;
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
  } else {
    // Development mode: warn if using random secrets
    if (!jwtSecret || !stateSecret || !clientSecret) {
      logger.warn('⚠️  Using random secrets (development only - DO NOT USE IN PRODUCTION)');
    }
  }

  return {
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    host: process.env['HOST'] ?? '0.0.0.0',
    issuer: process.env['OAUTH_ISSUER'] ?? 'https://servalsheets.example.com',
    clientId: process.env['OAUTH_CLIENT_ID'] ?? 'servalsheets',
    clientSecret: clientSecret ?? randomUUID(),
    jwtSecret: jwtSecret ?? randomUUID(),
    stateSecret: stateSecret ?? randomUUID(),
    allowedRedirectUris: (process.env['ALLOWED_REDIRECT_URIS'] ?? 'http://localhost:3000/callback').split(','),
    googleClientId: process.env['GOOGLE_CLIENT_ID'] ?? '',
    googleClientSecret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
    corsOrigins: (process.env['CORS_ORIGINS'] ?? 'https://claude.ai,https://claude.com').split(','),
  };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const app = express();

  // Security
  app.use(helmet({ contentSecurityPolicy: false }));
  app.set('trust proxy', 1);

  // CORS
  app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'X-Request-ID'],
  }));

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
  });

  // Mount OAuth routes
  app.use(oauth.createRouter());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      version: '4.0.0',
      tools: TOOL_COUNT,
      actions: ACTION_COUNT,
    });
  });

  // Server info
  app.get('/info', (_req, res) => {
    res.json({
      name: 'servalsheets',
      version: '4.0.0',
      description: 'Production-grade Google Sheets MCP server',
      protocol: 'MCP 2025-11-25',
      tools: getToolMetadata(),
    });
  });

  // Active sessions
  const sessions = new Map<string, SessionData>();

  // SSE endpoint (requires auth)
  app.get('/sse', oauth.validateToken(), async (req, res) => {
    const sessionId = randomUUID();
    const googleToken = oauth.getGoogleToken(req) ?? null;

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Session-ID', sessionId);

    try {
      // Create Google client if token available
      const googleClient = googleToken
        ? await createGoogleApiClient({ accessToken: googleToken })
        : undefined;

      // Create MCP server
      const mcpServer = new McpServer({
        name: 'servalsheets',
        version: '4.0.0',
      });

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

      // Connect
      await mcpServer.connect(transport);

      // Store session
      sessions.set(sessionId, { transport, mcpServer, googleToken });

      // Cleanup on disconnect
      req.on('close', () => {
        sessions.delete(sessionId);
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
      if (typeof session.transport.close === 'function') {
        session.transport.close();
      }
      sessions.delete(sessionId);
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

main().catch((error: unknown) => {
  logger.error('Remote server failed', { error });
});
