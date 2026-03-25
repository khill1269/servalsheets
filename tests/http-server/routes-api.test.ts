import { describe, expect, it, vi } from 'vitest';
import { registerApiRoutes } from '../../src/http-server/routes-api.js';

function createResponseDouble() {
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
  };
}

describe('http api routes', () => {
  it('rejects requests without a prompt', async () => {
    const post = vi.fn();
    registerApiRoutes({ post } as never, { samplingServer: null });

    const handler = post.mock.calls[0]?.[1];
    const res = createResponseDouble();

    await handler({ body: {} } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INVALID_REQUEST', message: 'Missing required field: prompt' },
    });
  });

  it('returns SAMPLING_UNAVAILABLE when no sampling server is configured', async () => {
    const post = vi.fn();
    registerApiRoutes({ post } as never, { samplingServer: null });

    const handler = post.mock.calls[0]?.[1];
    const res = createResponseDouble();

    await handler({ body: { prompt: 'sum column A' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'SAMPLING_UNAVAILABLE',
        message: 'MCP Sampling server is not configured. Set ANTHROPIC_API_KEY.',
      },
    });
  });

  it('normalizes fenced formula output and returns the selected model', async () => {
    const post = vi.fn();
    const samplingServer = {
      createMessage: vi.fn(async () => ({
        content: { type: 'text', text: '```formula\nSUM(A:A)\n```' },
      })),
      getClientCapabilities: vi.fn(() => ({ sampling: {} })),
    };

    registerApiRoutes({ post } as never, { samplingServer });

    const handler = post.mock.calls[0]?.[1];
    const res = createResponseDouble();

    await handler({ body: { prompt: 'sum column A', spreadsheetId: 'sheet-1' } } as never, res as never);

    expect(samplingServer.createMessage).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith({
      formula: '=SUM(A:A)',
      model: 'claude-haiku-4-5-20251001',
      cached: false,
    });
  });
});
