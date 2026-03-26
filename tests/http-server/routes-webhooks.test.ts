import { describe, expect, it, vi } from 'vitest';
import { registerHttpWebhookRoutes } from '../../src/http-server/routes-webhooks.js';

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
    send: vi.fn(function (this: any, body: unknown) {
      this.body = body;
      return this;
    }),
  };
}

describe('http webhook routes', () => {
  it('rejects drive callbacks with missing headers', async () => {
    const post = vi.fn();
    registerHttpWebhookRoutes({ post } as never, {
      getWebhookManager: vi.fn(() => null),
      getWebhookQueue: vi.fn(() => null),
      loadFormulaCallbackModule: vi.fn(async () => {
        throw new Error('should not load');
      }),
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        log: vi.fn(),
      } as never,
    });

    const driveHandler = post.mock.calls.find((call) => call[0] === '/webhook/drive-callback')?.[1];
    const res = createResponseDouble();

    await driveHandler(
      {
        headers: {},
        get: () => undefined,
      } as never,
      res as never
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Missing required webhook headers',
      },
    });
  });

  it('acknowledges workspace events immediately and forwards them asynchronously', async () => {
    const post = vi.fn();
    const handleWorkspaceEvent = vi.fn(async () => undefined);

    registerHttpWebhookRoutes({ post } as never, {
      getWebhookManager: () =>
        ({
          handleWorkspaceEvent,
        }) as never,
      getWebhookQueue: vi.fn(() => null),
      loadFormulaCallbackModule: vi.fn(async () => {
        throw new Error('should not load');
      }),
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        log: vi.fn(),
      } as never,
    });

    const workspaceHandler = post.mock.calls.find((call) => call[0] === '/webhook/workspace-events')?.[1];
    const res = createResponseDouble();

    workspaceHandler({ body: { id: 'evt-1' } } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
    await vi.waitFor(() => {
      expect(handleWorkspaceEvent).toHaveBeenCalledWith({ id: 'evt-1' });
    });
  });

  it('rejects SERVAL formula callbacks without auth headers', async () => {
    const post = vi.fn();
    registerHttpWebhookRoutes({ post } as never, {
      getWebhookManager: vi.fn(() => null),
      getWebhookQueue: vi.fn(() => null),
      loadFormulaCallbackModule: vi.fn(async () => {
        throw new Error('should not load');
      }),
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        log: vi.fn(),
      } as never,
    });

    const formulaHandler = post.mock.calls.find((call) => call[0] === '/api/serval-formula')?.[1];
    const res = createResponseDouble();

    await formulaHandler({ headers: {}, body: {} } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing authentication headers' });
  });
});
