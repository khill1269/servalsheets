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
import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createGoogleApiClient } from './services/google-api.js';
import { ACTION_COUNT, TOOL_COUNT } from './schemas/annotations.js';
import { logger } from './utils/logger.js';
import {
  BatchCompiler,
  RateLimiter,
  DiffEngine,
  PolicyEnforcer,
  RangeResolver,
} from './core/index.js';
import { SnapshotService } from './services/snapshot.js';
import { createHandlers, type HandlerContext } from './handlers/index.js';
import {
  registerServalSheetsPrompts,
  registerServalSheetsResources,
  registerServalSheetsTools,
} from './mcp/registration.js';

export interface HttpServerOptions {
  port?: number;
  host?: string;
  corsOrigins?: string[];
  rateLimitWindowMs?: number;
  rateLimitMax?: number;
  trustProxy?: boolean;
}

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60000;
const DEFAULT_RATE_LIMIT_MAX = 100;

async function createMcpServerInstance(googleToken?: string) {
  const mcpServer = new McpServer({
    name: 'servalsheets',
    version: '4.0.0',
  });

  let handlers = null;
  let googleClient = null;

  if (googleToken) {
    googleClient = await createGoogleApiClient({ accessToken: googleToken });
    const context: HandlerContext = {
      batchCompiler: new BatchCompiler({
        rateLimiter: new RateLimiter(),
        diffEngine: new DiffEngine({ sheetsApi: googleClient.sheets }),
        policyEnforcer: new PolicyEnforcer(),
        snapshotService: new SnapshotService({ driveApi: googleClient.drive }),
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
  registerServalSheetsResources(mcpServer, googleClient);
  registerServalSheetsPrompts(mcpServer);

  return mcpServer;
}

/**
 * Create HTTP server with MCP transport
 */
export function createHttpServer(options: HttpServerOptions = {}) {
  const port = options.port ?? DEFAULT_PORT;
  const host = options.host ?? DEFAULT_HOST;
  const corsOrigins = options.corsOrigins ?? ['https://claude.ai', 'https://claude.com'];
  const rateLimitWindowMs = options.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS;
  const rateLimitMax = options.rateLimitMax ?? DEFAULT_RATE_LIMIT_MAX;
  const trustProxy = options.trustProxy ?? true;

  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Allow SSE
  }));

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

  // Rate limiting with explicit values
  const limiter = rateLimit({
    windowMs: rateLimitWindowMs,
    limit: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  });
  app.use(limiter);

  // Parse JSON
  app.use(express.json({ limit: '10mb' }));

  // Request ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ 
      status: 'healthy',
      version: '4.0.0',
      protocol: 'MCP 2025-11-25',
    });
  });

  // MCP server info
  app.get('/info', (_req: Request, res: Response) => {
    res.json({
      name: 'servalsheets',
      version: '4.0.0',
      description: 'Production-grade Google Sheets MCP server',
      tools: TOOL_COUNT,
      actions: ACTION_COUNT,
      protocol: 'MCP 2025-11-25',
      transports: ['stdio', 'sse', 'http'],
    });
  });

  // Store active transports
  const transports = new Map<string, SSEServerTransport | StreamableHTTPServerTransport>();

  // SSE endpoint for Server-Sent Events transport
  app.get('/sse', async (req: Request, res: Response) => {
    const sessionId = randomUUID();
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Session-ID', sessionId);

    // Extract Google token from Authorization header
    const authHeader = req.headers.authorization;
    const googleToken = authHeader?.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : undefined;

    try {
      // Create SSE transport
      const transport = new SSEServerTransport('/sse/message', res);
      transports.set(sessionId, transport);

      // Create and connect MCP server
      const mcpServer = await createMcpServerInstance(googleToken);
      await mcpServer.connect(transport);

      // Cleanup on disconnect
      req.on('close', () => {
        transports.delete(sessionId);
        if (typeof transport.close === 'function') {
          transport.close();
        }
      });

    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to establish SSE connection',
          details: process.env['NODE_ENV'] === 'production' ? undefined : (error instanceof Error ? error.message : String(error)),
        }
      });
    }
  });

  // SSE message endpoint
  app.post('/sse/message', async (req: Request, res: Response) => {
    const sessionId = req.headers['x-session-id'] as string | undefined;

    if (!sessionId) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing X-Session-ID header',
        }
      });
      return;
    }

    const transport = transports.get(sessionId);

    if (!transport) {
      res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found',
        }
      });
      return;
    }

    try {
      // Handle incoming message through transport
      if (transport instanceof SSEServerTransport) {
        await transport.handlePostMessage(req, res);
      } else {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid transport type for SSE message',
          }
        });
      }
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process message',
          details: process.env['NODE_ENV'] === 'production' ? undefined : (error instanceof Error ? error.message : String(error)),
        }
      });
    }
  });

  // Streamable HTTP endpoint
  app.post('/mcp', async (req: Request, res: Response) => {
    const sessionId = (req.headers['x-session-id'] as string | undefined) ?? randomUUID();
    
    // Extract Google token
    const authHeader = req.headers.authorization;
    const googleToken = authHeader?.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : undefined;

    try {
      // Create transport if new session
      let transport = transports.get(sessionId);
      
      if (!transport || !(transport instanceof StreamableHTTPServerTransport)) {
        const newTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => sessionId,
        });
        transports.set(sessionId, newTransport);
        transport = newTransport;

        const mcpServer = await createMcpServerInstance(googleToken);

        // Connect with transport - use type assertion for SDK compatibility
        await mcpServer.connect(newTransport as unknown as Parameters<typeof mcpServer.connect>[0]);
      }

      // Handle the request
      if (transport instanceof StreamableHTTPServerTransport) {
        await transport.handleRequest(req, res);
      }

    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process MCP request',
          details: process.env['NODE_ENV'] === 'production' ? undefined : (error instanceof Error ? error.message : String(error)),
        }
      });
    }
  });

  // Session cleanup endpoint
  app.delete('/session/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;

    if (!sessionId) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Session ID required',
        }
      });
      return;
    }

    const transport = transports.get(sessionId);

    if (transport) {
      if (typeof transport.close === 'function') {
        transport.close();
      }
      transports.delete(sessionId);
      res.json({ success: true, message: 'Session terminated' });
    } else {
      res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found',
        }
      });
    }
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('HTTP server error', { error: err });
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: process.env['NODE_ENV'] === 'production' ? undefined : err.message,
      }
    });
  });

  return {
    app,
    start: () => {
      return new Promise<void>((resolve) => {
        app.listen(port, host, () => {
          logger.info(`ServalSheets HTTP server listening on ${host}:${port}`);
          logger.info(`SSE endpoint: http://${host}:${port}/sse`);
          logger.info(`HTTP endpoint: http://${host}:${port}/mcp`);
          resolve();
        });
      });
    },
    transports,
  };
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.env['PORT'] ?? '3000', 10);
  const server = createHttpServer({ port });
  server.start().catch((error: unknown) => {
    logger.error('Failed to start HTTP server', { error });
  });
}
