import type { Express } from 'express';
import net from 'node:net';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

const httpTransportFailoverMocks = vi.hoisted(() => {
  const remoteToolCall = vi.fn();
  const getRemoteToolClient = vi.fn(async (toolName?: string) => {
    const allowlist = (process.env['MCP_REMOTE_EXECUTOR_TOOLS'] ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!process.env['MCP_REMOTE_EXECUTOR_URL'] || !toolName || !allowlist.includes(toolName)) {
      return null;
    }

    return {
      callRemoteTool: remoteToolCall,
    };
  });

  return {
    remoteToolCall,
    getRemoteToolClient,
    resetRemoteToolClient: vi.fn(async () => undefined),
  };
});

vi.mock('../../src/services/remote-mcp-tool-client.js', () => ({
  getRemoteToolClient: httpTransportFailoverMocks.getRemoteToolClient,
  resetRemoteToolClient: httpTransportFailoverMocks.resetRemoteToolClient,
}));

vi.mock('../../src/handlers/compute.js', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = await importOriginal<any>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  class MockComputeHandler extends actual.ComputeHandler {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async handle(input: any) {
      const req = (input as Record<string, unknown>)['request'] ?? input;
      if (
        (req as Record<string, unknown>)['action'] === 'evaluate' &&
        (req as Record<string, unknown>)['formula'] === '=REMOTE_FAILOVER_SENTINEL()'
      ) {
        throw new Error('local compute failed');
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      return await super.handle(input);
    }
  }

  return {
    ...actual,
    ComputeHandler: MockComputeHandler,
  };
});

vi.mock('../../src/handlers/analyze.js', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = await importOriginal<any>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  class MockAnalyzeHandler extends actual.AnalyzeHandler {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async handle(input: any) {
      // Check action only — spreadsheetId may be at a different nesting level
      // after parseForHandler schema validation (passthrough vs strict)
      const req = (input as Record<string, unknown>)['request'] ?? input;
      if (
        (req as Record<string, unknown>)['action'] === 'analyze_data' &&
        ((req as Record<string, unknown>)['spreadsheetId'] === 'remote-failover-analyze' ||
          (input as Record<string, unknown>)['spreadsheetId'] === 'remote-failover-analyze')
      ) {
        throw new Error('local analyze failed');
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
      return await super.handle(input);
    }
  }

  return {
    ...actual,
    AnalyzeHandler: MockAnalyzeHandler,
  };
});

import { createHttpServer } from '../../src/http-server.js';

const canListenLocalhost = await new Promise<boolean>((resolve) => {
  const server = net.createServer();
  server.once('error', () => resolve(false));
  server.listen(0, '127.0.0.1', () => {
    server.close(() => resolve(true));
  });
});

function createJwtLikeBearerToken(
  audience: string,
  overrides?: Record<string, unknown>
): string {
  const encode = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');

  return [
    encode({ alg: 'none', typ: 'JWT' }),
    encode({
      aud: audience,
      iss: 'https://accounts.google.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
      email: 'http-failover-test@example.com',
      ...overrides,
    }),
    'signature',
  ].join('.');
}

function extractJsonRpcResult(response: request.Response, requestId: number): Record<string, unknown> | undefined {
  if (response.body?.result) {
    return response.body.result as Record<string, unknown>;
  }

  const blocks = response.text.split(/\r?\n\r?\n/);
  for (const block of blocks) {
    const dataLines = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart());

    if (dataLines.length === 0) {
      continue;
    }

    let payload: { id?: number; result?: Record<string, unknown> } | undefined;
    try {
      payload = JSON.parse(dataLines.join('\n')) as {
        id?: number;
        result?: Record<string, unknown>;
      };
    } catch {
      continue;
    }

    if (payload.id === requestId) {
      return payload.result;
    }
  }

  return undefined;
}

describe.skipIf(!canListenLocalhost)('HTTP transport hosted failover', () => {
  afterEach(async () => {
    httpTransportFailoverMocks.remoteToolCall.mockReset();
    httpTransportFailoverMocks.getRemoteToolClient.mockClear();
    httpTransportFailoverMocks.resetRemoteToolClient.mockClear();
    delete process.env['MCP_REMOTE_EXECUTOR_URL'];
    delete process.env['MCP_REMOTE_EXECUTOR_TOOLS'];
    await httpTransportFailoverMocks.resetRemoteToolClient();
  });

  it('fails over sheets_compute through the real /mcp session flow when local execution throws', async () => {
    process.env['MCP_REMOTE_EXECUTOR_URL'] = 'https://example.com/mcp';
    process.env['MCP_REMOTE_EXECUTOR_TOOLS'] = 'sheets_compute';
    httpTransportFailoverMocks.remoteToolCall.mockResolvedValue({
      structuredContent: {
        response: {
          success: true,
          action: 'evaluate',
          source: 'remote',
          value: 42,
        },
      },
    });

    const server = createHttpServer({
      host: '127.0.0.1',
      port: 0,
      corsOrigins: ['http://localhost:3000'],
      rateLimitMax: 10_000,
      rateLimitWindowMs: 1_000,
      trustProxy: false,
    });
    const app = server.app as Express;
    const agent = request(app);
    const authToken = createJwtLikeBearerToken('http://127.0.0.1:3000', {
      email: 'compute-failover@example.com',
      sub: 'compute-failover-user',
      nonce: 'compute-failover-nonce',
    });

    try {
      const initResponse = await agent
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jsonrpc: '2.0',
          id: 4001,
          method: 'initialize',
          params: {
            protocolVersion: '2025-11-25',
            capabilities: {},
            clientInfo: {
              name: 'http-failover-test-client',
              version: '1.0.0',
            },
          },
        })
        .expect(200);

      const sessionIdHeader =
        initResponse.headers['mcp-session-id'] ?? initResponse.headers['x-session-id'];
      const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
      expect(typeof sessionId).toBe('string');
      expect(sessionId).toBeTruthy();

      await agent
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${authToken}`)
        .set('MCP-Protocol-Version', '2025-11-25')
        .set('Mcp-Session-Id', sessionId as string)
        .send({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        })
        .expect((response) => {
          expect([200, 202, 204]).toContain(response.status);
        });

      const toolResponse = await agent
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${authToken}`)
        .set('MCP-Protocol-Version', '2025-11-25')
        .set('Mcp-Session-Id', sessionId as string)
        .send({
          jsonrpc: '2.0',
          id: 4002,
          method: 'tools/call',
          params: {
            name: 'sheets_compute',
            arguments: {
              request: {
                action: 'evaluate',
                spreadsheetId: 'spreadsheet-123',
                formula: '=REMOTE_FAILOVER_SENTINEL()',
              },
            },
          },
        })
        .expect(200);

      const result = extractJsonRpcResult(toolResponse, 4002);
      expect(result).toMatchObject({
        structuredContent: {
          response: {
            success: true,
            action: 'evaluate',
            source: 'remote',
            value: 42,
          },
        },
      });
      expect(httpTransportFailoverMocks.getRemoteToolClient).toHaveBeenCalledWith(
        'sheets_compute'
      );
      expect(httpTransportFailoverMocks.remoteToolCall).toHaveBeenCalledWith('sheets_compute', {
        request: {
          action: 'evaluate',
          spreadsheetId: 'spreadsheet-123',
          formula: '=REMOTE_FAILOVER_SENTINEL()',
        },
      });
    } finally {
      await server.stop?.();
    }
  });

  it('fails over sheets_analyze through the real /mcp session flow when local execution throws', async () => {
    process.env['MCP_REMOTE_EXECUTOR_URL'] = 'https://example.com/mcp';
    process.env['MCP_REMOTE_EXECUTOR_TOOLS'] = 'sheets_analyze';
    httpTransportFailoverMocks.remoteToolCall.mockResolvedValue({
      structuredContent: {
        response: {
          success: true,
          action: 'analyze_data',
          source: 'remote',
          summary: 'remote analyze',
        },
      },
    });

    const server = createHttpServer({
      host: '127.0.0.1',
      port: 0,
      corsOrigins: ['http://localhost:3000'],
      rateLimitMax: 10_000,
      rateLimitWindowMs: 1_000,
      trustProxy: false,
    });
    const app = server.app as Express;
    const agent = request(app);
    const authToken = createJwtLikeBearerToken('http://127.0.0.1:3000', {
      email: 'analyze-failover@example.com',
      sub: 'analyze-failover-user',
      nonce: 'analyze-failover-nonce',
    });

    try {
      const initResponse = await agent
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          jsonrpc: '2.0',
          id: 4101,
          method: 'initialize',
          params: {
            protocolVersion: '2025-11-25',
            capabilities: {},
            clientInfo: {
              name: 'http-failover-test-client',
              version: '1.0.0',
            },
          },
        })
        .expect(200);

      const sessionIdHeader =
        initResponse.headers['mcp-session-id'] ?? initResponse.headers['x-session-id'];
      const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
      expect(typeof sessionId).toBe('string');
      expect(sessionId).toBeTruthy();

      await agent
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${authToken}`)
        .set('MCP-Protocol-Version', '2025-11-25')
        .set('Mcp-Session-Id', sessionId as string)
        .send({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        })
        .expect((response) => {
          expect([200, 202, 204]).toContain(response.status);
        });

      const toolResponse = await agent
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .set('Authorization', `Bearer ${authToken}`)
        .set('MCP-Protocol-Version', '2025-11-25')
        .set('Mcp-Session-Id', sessionId as string)
        .send({
          jsonrpc: '2.0',
          id: 4102,
          method: 'tools/call',
          params: {
            name: 'sheets_analyze',
            arguments: {
              request: {
                action: 'analyze_data',
                spreadsheetId: 'remote-failover-analyze',
                analysisTypes: ['summary'],
              },
            },
          },
        })
        .expect(200);

      const result = extractJsonRpcResult(toolResponse, 4102);
      expect(result).toMatchObject({
        structuredContent: {
          response: {
            success: true,
            action: 'analyze_data',
            source: 'remote',
            summary: 'remote analyze',
          },
        },
      });
      expect(httpTransportFailoverMocks.getRemoteToolClient).toHaveBeenCalledWith(
        'sheets_analyze'
      );
      expect(httpTransportFailoverMocks.remoteToolCall).toHaveBeenCalledWith('sheets_analyze', {
        request: {
          action: 'analyze_data',
          spreadsheetId: 'remote-failover-analyze',
          analysisTypes: ['summary'],
        },
      });
    } finally {
      await server.stop?.();
    }
  });
});
