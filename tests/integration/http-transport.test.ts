/**
 * ServalSheets - HTTP Transport Integration Tests
 *
 * Tests MCP protocol over HTTP transport including:
 * - Server initialization
 * - Health checks
 * - Tools listing
 * - Tool invocation
 *
 * These tests verify the HTTP/SSE server works correctly
 * without requiring actual Google API access.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { VERSION } from '../../src/version.js';
import { createHttpServer, type HttpServerOptions } from '../../src/http-server.js';
import { logger } from '../../src/utils/logger.js';
import {
  getOrCreateSessionContext,
  removeSessionContext,
} from '../../src/services/session-context.js';
import type { Express } from 'express';
import net from 'node:net';

const canListenLocalhost = await new Promise<boolean>((resolve) => {
  const server = net.createServer();
  server.once('error', () => resolve(false));
  server.listen(0, '127.0.0.1', () => {
    server.close(() => resolve(true));
  });
});

const SKIP_HTTP_INTEGRATION =
  process.env['TEST_HTTP_INTEGRATION'] !== 'true' || !canListenLocalhost;

describe.skipIf(SKIP_HTTP_INTEGRATION)('HTTP Transport Integration Tests', () => {
  let app: Express;
  let server: ReturnType<typeof createHttpServer>;
  let httpServer: ReturnType<Express['listen']>;
  let agent: ReturnType<typeof request>;
  const previousLegacySse = process.env['ENABLE_LEGACY_SSE'];

  beforeAll(async () => {
    process.env['ENABLE_LEGACY_SSE'] = 'true';

    // Create HTTP server for testing
    const options: HttpServerOptions = {
      port: 0, // Use random port
      host: '127.0.0.1',
      corsOrigins: ['http://localhost:3000'],
      rateLimitMax: 1000, // High limit for tests
      trustProxy: false,
    };

    server = createHttpServer(options);
    // `createHttpServer` currently types `app` as `unknown` even though it is an Express app.
    // For test purposes we narrow it here.
    app = server.app as Express;
    httpServer = await new Promise<ReturnType<Express['listen']>>((resolve, reject) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
      listener.on('error', reject);
    });
    const address = httpServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('HTTP test server failed to start');
    }
    agent = request(`http://127.0.0.1:${address.port}`);
  });

  afterAll(async () => {
    if (previousLegacySse === undefined) {
      delete process.env['ENABLE_LEGACY_SSE'];
    } else {
      process.env['ENABLE_LEGACY_SSE'] = previousLegacySse;
    }

    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
    // Clean up any active sessions/transports
    if (server?.sessions) {
      const sessions = server.sessions as Map<
        string,
        { transport?: { close?: () => void }; taskStore?: { dispose?: () => void } }
      >;
      sessions.forEach((session) => {
        if (typeof session.transport?.close === 'function') {
          session.transport.close();
        }
        if (typeof session.taskStore?.dispose === 'function') {
          session.taskStore.dispose();
        }
      });
      sessions.clear();
    }
    await server.stop?.();
  });

  describe('Health and Info Endpoints', () => {
    it('should return healthy status on /health', async () => {
      const response = await agent.get('/health').expect(200).expect('Content-Type', /json/);

      // May be 'degraded' if OAuth tokens not configured (expected in test env)
      expect(['healthy', 'degraded']).toContain(response.body.status);
      expect(response.body).toMatchObject({
        version: VERSION,
      });
    });

    it('should return server info on /info', async () => {
      const response = await agent.get('/info').expect(200).expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        name: 'servalsheets',
        version: VERSION,
        description: 'Production-grade Google Sheets MCP server',
        protocol: 'MCP 2025-11-25',
      });

      // Verify tool and action counts are present
      expect(response.body.tools).toBeDefined();
      expect(response.body.actions).toBeDefined();
      expect(typeof response.body.tools).toBe('number');
      expect(typeof response.body.actions).toBe('number');
      expect(response.body.tools).toBeGreaterThan(0);
      expect(response.body.actions).toBeGreaterThan(0);
    });

    it('should not expose oauth issuer/client metadata or session counts in readiness health', async () => {
      const oauthServer = createHttpServer({
        port: 0,
        host: '127.0.0.1',
        corsOrigins: ['http://localhost:3000'],
        rateLimitMax: 1000,
        trustProxy: false,
        enableOAuth: true,
        oauthConfig: {
          issuer: 'https://issuer.example.com',
          clientId: 'oauth-client-id',
          clientSecret: 'oauth-client-secret',
          jwtSecret: 'x'.repeat(32),
          stateSecret: 'y'.repeat(32),
          allowedRedirectUris: ['http://localhost:3000/callback'],
          googleClientId: 'google-client-id',
          googleClientSecret: 'google-client-secret',
          accessTokenTtl: 3600,
          refreshTokenTtl: 86400,
        },
      });

      const oauthApp = oauthServer.app as Express;
      const oauthHttpServer = await new Promise<ReturnType<Express['listen']>>(
        (resolve, reject) => {
          const listener = oauthApp.listen(0, '127.0.0.1', () => resolve(listener));
          listener.on('error', reject);
        }
      );
      const address = oauthHttpServer.address();
      if (!address || typeof address === 'string') {
        throw new Error('OAuth test server failed to start');
      }

      const oauthAgent = request(`http://127.0.0.1:${address.port}`);
      const response = await oauthAgent.get('/health/ready').expect('Content-Type', /json/);

      expect([200, 503]).toContain(response.status);
      expect(response.body.oauth).toBeDefined();
      expect(response.body.oauth).toMatchObject({
        enabled: true,
        configured: true,
      });
      expect(response.body.oauth).not.toHaveProperty('issuer');
      expect(response.body.oauth).not.toHaveProperty('clientId');

      expect(response.body.sessions).toBeDefined();
      expect(response.body.sessions).toHaveProperty('hasAuthentication');
      expect(typeof response.body.sessions.hasAuthentication).toBe('boolean');
      expect(response.body.sessions).not.toHaveProperty('active');

      await new Promise<void>((resolve) => oauthHttpServer.close(() => resolve()));
      const oauthSessions = oauthServer.sessions as Map<
        string,
        { transport?: { close?: () => void }; taskStore?: { dispose?: () => void } }
      >;
      oauthSessions.forEach((session) => {
        if (typeof session.transport?.close === 'function') {
          session.transport.close();
        }
        if (typeof session.taskStore?.dispose === 'function') {
          session.taskStore.dispose();
        }
      });
      oauthSessions.clear();
      await oauthServer.stop?.();
    });
  });

  describe('MCP Initialize Handshake', () => {
    it('should accept POST requests to /mcp endpoint', async () => {
      const initializeRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      };

      const response = await agent
        .post('/mcp')
        .send(initializeRequest)
        .set('Content-Type', 'application/json');

      // Should handle MCP request (may return 200, 406, or 426 Upgrade Required for WebSocket)
      expect([200, 406, 426]).toContain(response.status);
    });

    it('should handle tools/list request', async () => {
      const toolsListRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      };

      const response = await agent
        .post('/mcp')
        .send(toolsListRequest)
        .set('Content-Type', 'application/json');

      // No session established yet; should reject the request
      expect(response.status).toBe(400);
    });
  });

  describe('Session Management', () => {
    it('should create session on first /mcp request', async () => {
      const initializeRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      };

      const response = await agent
        .post('/mcp')
        .send(initializeRequest)
        .set('Content-Type', 'application/json');

      // Should accept request
      expect([200, 406]).toContain(response.status);

      // Session may or may not be stored depending on transport type
      // This is implementation-specific
    });

    it('should delete session via DELETE endpoint', async () => {
      const sessionId = 'test-session-delete';

      // Seed an in-memory session entry to exercise the endpoint
      const sessions = server.sessions as Map<
        string,
        { transport?: { close?: () => void }; taskStore?: { dispose?: () => void } }
      >;
      sessions.set(sessionId, {
        transport: { close: vi.fn() },
        taskStore: { dispose: vi.fn() },
      });

      // Now delete it
      const deleteResponse = await agent.delete(`/session/${sessionId}`).timeout({
        // Prevent occasional hangs from causing global Vitest timeout.
        // Either response is acceptable (200 = deleted, 404 = already gone).
        response: 2000,
        deadline: 5000,
      });

      // Delete should return 200 for success or 404 if session not found
      expect([200, 404]).toContain(deleteResponse.status);
    });

    it('should return 404 when deleting non-existent session', async () => {
      const response = await agent.delete('/session/non-existent-session').expect(404);

      // Error format may vary - check for error indication
      expect(response.body.error).toBeDefined();
    });

    it('should remove session-scoped context when deleting a session', async () => {
      const sessionId = 'test-session-context-cleanup';
      const initialContext = getOrCreateSessionContext(sessionId);

      const sessions = server.sessions as Map<
        string,
        { transport?: { close?: () => void }; taskStore?: { dispose?: () => void } }
      >;
      sessions.set(sessionId, {
        transport: { close: vi.fn() },
        taskStore: { dispose: vi.fn() },
      });

      await agent.delete(`/session/${sessionId}`).expect(200);

      const recreatedContext = getOrCreateSessionContext(sessionId);
      expect(recreatedContext).not.toBe(initialContext);
      removeSessionContext(sessionId);
    });
  });

  describe('Streamable HTTP transport behavior', () => {
    it('should reject client-specified session ID on initialize', async () => {
      const initializeRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      };

      const response = await agent
        .post('/mcp')
        .send(initializeRequest)
        .set('Content-Type', 'application/json')
        .set('Mcp-Session-Id', 'client-specified');

      expect(response.status).toBe(400);
    });

    it('should return 400 on GET /mcp without session', async () => {
      const response = await agent.get('/mcp');
      expect(response.status).toBe(400);
    });

    it('should return 404 on GET /mcp with unknown session', async () => {
      const response = await agent.get('/mcp').set('Mcp-Session-Id', 'missing-session');
      expect(response.status).toBe(404);
    });

    it('should return 404 on DELETE /mcp with unknown session', async () => {
      const response = await agent.delete('/mcp').set('Mcp-Session-Id', 'missing-session');
      expect(response.status).toBe(404);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers from helmet', async () => {
      const response = await agent.get('/health').expect(200);

      // Helmet adds various security headers
      expect(response.headers['x-content-type-options']).toBeDefined();
    });

    it('should include CORS headers', async () => {
      const response = await agent
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should include request ID in response', async () => {
      const response = await agent.get('/health').expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
      expect(typeof response.headers['x-request-id']).toBe('string');
    });

    it('should accept custom request ID from client', async () => {
      const customRequestId = 'custom-test-request-id';

      const response = await agent.get('/health').set('X-Request-ID', customRequestId).expect(200);

      expect(response.headers['x-request-id']).toBe(customRequestId);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await agent
        .post('/mcp')
        .send('invalid json{')
        .set('Content-Type', 'application/json');

      // Express should return 400 for malformed JSON
      expect([400, 500]).toContain(response.status);
    });

    it('should handle missing session ID on SSE message endpoint', async () => {
      const response = await agent
        .post('/sse/message')
        .send({ jsonrpc: '2.0', method: 'test' })
        .expect(400);

      // Error format may vary - check for error indication
      expect(response.body.error).toBeDefined();
    });

    it('should handle non-existent session on SSE message endpoint', async () => {
      const response = await agent
        .post('/sse/message')
        .set('X-Session-ID', 'non-existent')
        .send({ jsonrpc: '2.0', method: 'test' })
        .expect(404);

      // Error format may vary - check for error indication
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should accept requests under rate limit', async () => {
      // Make several requests
      for (let i = 0; i < 5; i++) {
        await agent.get('/health').expect(200);
      }
    });

    // Note: Testing rate limit enforcement would require exceeding the limit
    // which is set high for tests (1000). Skipping actual enforcement test.
  });

  describe('Authorization Header Handling', () => {
    it('should accept Bearer token in Authorization header', async () => {
      const response = await agent
        .post('/mcp')
        .set('Authorization', 'Bearer test-token-123')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-11-25',
            capabilities: {},
            clientInfo: {
              name: 'test-client',
              version: '1.0.0',
            },
          },
        });

      // Should accept the request with Authorization header
      // May return 200, 406, 426 (Upgrade Required), or 401 (if token validation enabled)
      expect([200, 401, 406, 426]).toContain(response.status);
    });

    it('should work without Authorization header', async () => {
      const response = await agent
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-11-25',
            capabilities: {},
            clientInfo: {
              name: 'test-client',
              version: '1.0.0',
            },
          },
        });

      // Should work without token (limited functionality)
      // May return 200, 406, or 426 (Upgrade Required for WebSocket transport)
      expect([200, 406, 426]).toContain(response.status);
    });
  });

  describe('MCP Logging Bridge', () => {
    it('should forward logger output after logging/setLevel via MCP notifications', async () => {
      const initializeRequest = {
        jsonrpc: '2.0',
        id: 9001,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: {
            name: 'logging-bridge-test-client',
            version: '1.0.0',
          },
        },
      };

      const initResponse = await agent
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .send(initializeRequest)
        .expect(200);

      const sessionIdHeader =
        initResponse.headers['mcp-session-id'] ?? initResponse.headers['x-session-id'];
      const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
      expect(typeof sessionId).toBe('string');
      expect(sessionId).toBeTruthy();

      const sessions = server.sessions as Map<
        string,
        {
          mcpServer: {
            server: {
              sendLoggingMessage: (message: unknown) => Promise<void>;
            };
          };
        }
      >;
      const session = sessions.get(sessionId as string);
      expect(session).toBeDefined();

      const sendLoggingMessageSpy = vi
        .spyOn(session!.mcpServer.server, 'sendLoggingMessage')
        .mockResolvedValue(undefined);

      await agent
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .set('Mcp-Session-Id', sessionId as string)
        .send({
          jsonrpc: '2.0',
          id: 9002,
          method: 'logging/setLevel',
          params: { level: 'debug' },
        })
        .expect(200);

      logger.info('http-logging-bridge-regression-test');

      await vi.waitFor(() => {
        expect(sendLoggingMessageSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            logger: 'servalsheets',
          })
        );
      });
    });
  });
});
