import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it, vi } from 'vitest';

import { installInitializeCancellationGuard } from '../../../packages/mcp-runtime/src/index.js';

function createGuardableServer(rawServer: {
  _onrequest?: (request: { id?: string | number; method?: string }, extra?: unknown) => unknown;
  _oncancel?: (notification: { params?: { requestId?: string | number } }) => unknown;
}): Pick<McpServer, 'server'> {
  return {
    server: rawServer,
  } as Pick<McpServer, 'server'>;
}

describe('@serval/mcp-runtime initialize cancellation guard', () => {
  it('ignores cancellation for in-flight initialize requests', async () => {
    let resolveRequest!: () => void;
    const onCancel = vi.fn();

    const rawServer = {
      _onrequest: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveRequest = resolve;
          })
      ),
      _oncancel: onCancel,
    };
    const ignoredCancellation = vi.fn();

    expect(
      installInitializeCancellationGuard(createGuardableServer(rawServer), {
        onIgnoredCancellation: ignoredCancellation,
      })
    ).toBe(true);

    const requestPromise = rawServer._onrequest({
      id: 'init-1',
      method: 'initialize',
    });

    rawServer._oncancel({
      params: {
        requestId: 'init-1',
      },
    });

    expect(ignoredCancellation).toHaveBeenCalledWith('init-1');
    expect(onCancel).not.toHaveBeenCalled();

    resolveRequest();
    await requestPromise;

    rawServer._oncancel({
      params: {
        requestId: 'init-1',
      },
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('clears protection on the next turn for synchronous initialize handlers', async () => {
    const onCancel = vi.fn();
    const rawServer = {
      _onrequest: vi.fn(),
      _oncancel: onCancel,
    };

    installInitializeCancellationGuard(createGuardableServer(rawServer));

    rawServer._onrequest({
      id: 7,
      method: 'initialize',
    });

    rawServer._oncancel({
      params: {
        requestId: 7,
      },
    });

    expect(onCancel).not.toHaveBeenCalled();

    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

    rawServer._oncancel({
      params: {
        requestId: 7,
      },
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('returns false when the server internals do not expose request hooks', () => {
    expect(
      installInitializeCancellationGuard(
        createGuardableServer({
          _oncancel: vi.fn(),
        })
      )
    ).toBe(false);
  });
});
