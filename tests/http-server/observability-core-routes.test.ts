import { describe, expect, it, vi } from 'vitest';
import { ACTION_COUNT, TOOL_COUNT } from '../../src/schemas/action-counts.js';
import { registerHttpObservabilityCoreRoutes } from '../../src/http-server/observability-core-routes.js';
import { SERVER_INFO, VERSION } from '../../src/version.js';

function createJsonResponseDouble() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status: vi.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: vi.fn(function (this: any, body: unknown) {
      this.body = body;
      return this;
    }),
    end: vi.fn(),
  };
}

describe('http observability core routes', () => {
  it('registers health, trace, info, and HEAD routes with root metadata', async () => {
    const get = vi.fn();
    const head = vi.fn();

    registerHttpObservabilityCoreRoutes({
      app: { get, head } as never,
      healthService: {
        checkLiveness: vi.fn(async () => ({ status: 'healthy' })),
        checkReadiness: vi.fn(async () => ({ status: 'degraded', checks: ['cache'] })),
      },
      options: {
        enableOAuth: true,
        oauthConfig: {
          clientId: 'client-id',
          clientSecret: 'client-secret',
        },
      },
      host: '127.0.0.1',
      port: 3000,
      legacySseEnabled: true,
      getSessionCount: () => 2,
    });

    expect(get).toHaveBeenCalledWith('/health/live', expect.any(Function));
    expect(get).toHaveBeenCalledWith('/health/ready', expect.any(Function));
    expect(get).toHaveBeenCalledWith('/health', expect.any(Function));
    expect(get).toHaveBeenCalledWith('/trace', expect.any(Function));
    expect(get).toHaveBeenCalledWith('/info', expect.any(Function));
    expect(head).toHaveBeenCalledTimes(4);

    const readyHandler = get.mock.calls.find(([path]) => path === '/health/ready')?.[1];
    const readyRes = createJsonResponseDouble();
    await readyHandler?.({} as never, readyRes as never);

    expect(readyRes.status).toHaveBeenCalledWith(200);
    expect(readyRes.body).toEqual({
      status: 'degraded',
      checks: ['cache'],
      oauth: {
        enabled: true,
        configured: true,
      },
      sessions: {
        hasAuthentication: true,
      },
    });

    const infoHandler = get.mock.calls.find(([path]) => path === '/info')?.[1];
    const infoRes = createJsonResponseDouble();
    infoHandler?.(
      {
        secure: true,
        headers: {
          host: 'localhost:3000',
          'x-forwarded-host': 'api.example.com',
        },
      } as never,
      infoRes as never
    );

    expect(infoRes.body).toMatchObject({
      name: SERVER_INFO.name,
      version: VERSION,
      description: 'Production-grade Google Sheets MCP server',
      tools: TOOL_COUNT,
      actions: ACTION_COUNT,
      protocol: `MCP ${SERVER_INFO.protocolVersion}`,
      transports: ['stdio', 'streamable-http', 'sse'],
      endpoints: {
        mcp: 'https://api.example.com/mcp',
        apiDocs: 'https://api.example.com/api-docs',
      },
    });
  });
});
