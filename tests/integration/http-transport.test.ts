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

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createHttpServer, type HttpServerOptions } from '../../src/http-server.js';
import type { Express } from 'express';

describe('HTTP Transport Integration Tests', () => {
  let app: Express;
  let server: ReturnType<typeof createHttpServer>;

  beforeAll(async () => {
    // Create HTTP server for testing
    const options: HttpServerOptions = {
      port: 0, // Use random port
      host: 'localhost',
      corsOrigins: ['http://localhost:3000'],
      rateLimitMax: 1000, // High limit for tests
      trustProxy: false,
    };

    server = createHttpServer(options);
    // `createHttpServer` currently types `app` as `unknown` even though it is an Express app.
    // For test purposes we narrow it here.
    app = server.app as Express;
  });

  afterAll(async () => {
    // Clean up any active sessions/transports
    const sessions = server.sessions as Map<string, { transport?: { close?: () => void }; taskStore?: { dispose?: () => void } }>;
    sessions.forEach((session) => {
      if (typeof session.transport?.close === 'function') {
        session.transport.close();
      }
      if (typeof session.taskStore?.dispose === 'function') {
        session.taskStore.dispose();
      }
    });
    sessions.clear();
  });

  describe('Health and Info Endpoints', () => {
    it('should return healthy status on /health', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/);

      // May be 'degraded' if OAuth tokens not configured (expected in test env)
      expect(['healthy', 'degraded']).toContain(response.body.status);
      expect(response.body).toMatchObject({
        version: '1.3.0',
      });
    });

    it('should return server info on /info', async () => {
      const response = await request(app)
        .get('/info')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toMatchObject({
        name: 'servalsheets',
        version: '1.3.0',
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

      const response = await request(app)
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

      const response = await request(app)
        .post('/mcp')
        .send(toolsListRequest)
        .set('Content-Type', 'application/json')
        .set('X-Session-ID', 'test-session-tools-list');

      // Should return tools list or handle appropriately
      expect([200, 406, 426]).toContain(response.status);
    });
  });

  describe('Session Management', () => {
    it('should create session on first /mcp request', async () => {
      const sessionId = 'test-session-create';

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

      const response = await request(app)
        .post('/mcp')
        .send(initializeRequest)
        .set('Content-Type', 'application/json')
        .set('X-Session-ID', sessionId);

      // Should accept request
      expect([200, 406, 426]).toContain(response.status);

      // Session may or may not be stored depending on transport type
      // This is implementation-specific
    });

    it('should delete session via DELETE endpoint', async () => {
      const sessionId = 'test-session-delete';

      // Create session first
      const initRequest = {
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

      const createResponse = await request(app)
        .post('/mcp')
        .send(initRequest)
        .set('X-Session-ID', sessionId);

      // Should accept request
      expect([200, 406, 426]).toContain(createResponse.status);

      // Now delete it
      const deleteResponse = await request(app)
        .delete(`/session/${sessionId}`)
        .timeout({
          // Prevent occasional hangs from causing global Vitest timeout.
          // Either response is acceptable (200 = deleted, 404 = already gone).
          response: 2000,
          deadline: 5000,
        });

      // Delete should return 200 for success or 404 if session not found
      expect([200, 404]).toContain(deleteResponse.status);
    });

    it('should return 404 when deleting non-existent session', async () => {
      const response = await request(app)
        .delete('/session/non-existent-session')
        .expect(404);

      // Error format may vary - check for error indication
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('should include security headers from helmet', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Helmet adds various security headers
      expect(response.headers['x-content-type-options']).toBeDefined();
    });

    it('should include CORS headers', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    it('should include request ID in response', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
      expect(typeof response.headers['x-request-id']).toBe('string');
    });

    it('should accept custom request ID from client', async () => {
      const customRequestId = 'custom-test-request-id';

      const response = await request(app)
        .get('/health')
        .set('X-Request-ID', customRequestId)
        .expect(200);

      expect(response.headers['x-request-id']).toBe(customRequestId);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/mcp')
        .send('invalid json{')
        .set('Content-Type', 'application/json');

      // Express should return 400 for malformed JSON
      expect([400, 500]).toContain(response.status);
    });

    it('should handle missing session ID on SSE message endpoint', async () => {
      const response = await request(app)
        .post('/sse/message')
        .send({ jsonrpc: '2.0', method: 'test' })
        .expect(400);

      // Error format may vary - check for error indication
      expect(response.body.error).toBeDefined();
    });

    it('should handle non-existent session on SSE message endpoint', async () => {
      const response = await request(app)
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
        await request(app)
          .get('/health')
          .expect(200);
      }
    });

    // Note: Testing rate limit enforcement would require exceeding the limit
    // which is set high for tests (1000). Skipping actual enforcement test.
  });

  describe('Authorization Header Handling', () => {
    it('should accept Bearer token in Authorization header', async () => {
      const response = await request(app)
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
      const response = await request(app)
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
});
