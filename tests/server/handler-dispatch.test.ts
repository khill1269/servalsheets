import { describe, expect, it, vi } from 'vitest';

import { dispatchServerToolCall } from '../../src/server/handler-dispatch.js';

describe('dispatchServerToolCall', () => {
  it('routes tool execution through the stdio routing helper', async () => {
    const localHandler = vi.fn(async () => ({ response: { success: true, source: 'local' } }));
    const executeRoutedToolCall = vi.fn(async ({ localExecute }: { localExecute: () => Promise<unknown> }) => {
      return await Promise.resolve({
        response: {
          success: true,
          source: 'remote',
        },
        localExecuteDefined: typeof localExecute === 'function',
      });
    });

    const result = await dispatchServerToolCall(
      {
        toolName: 'sheets_federation',
        args: { request: { action: 'list_servers' } },
        rawArgs: { request: { action: 'list_servers' } },
        rawAction: 'list_servers',
        handlers: {} as never,
        authHandler: null,
        cachedHandlerMap: { sheets_federation: localHandler },
        context: { sessionContext: undefined } as never,
        googleClient: null,
        requestId: 'req-1',
        costTrackingTenantId: 'tenant-1',
      },
      {
        executeRoutedToolCall,
      }
    );

    expect(result.kind).toBe('result');
    if (result.kind !== 'result') {
      throw new Error('Expected routed result');
    }

    expect(result.result).toMatchObject({
      response: {
        success: true,
        source: 'remote',
      },
      localExecuteDefined: true,
    });
    expect(localHandler).not.toHaveBeenCalled();
    expect(executeRoutedToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'sheets_federation',
        transport: 'stdio',
      })
    );
  });
});
