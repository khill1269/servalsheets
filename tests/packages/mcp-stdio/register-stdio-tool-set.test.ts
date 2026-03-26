import { describe, expect, it, vi } from 'vitest';

import { registerStdioToolSet } from '../../../packages/mcp-stdio/src/register-stdio-tool-set.js';

describe('@serval/mcp-stdio registerStdioToolSet', () => {
  it('registers task-capable tools with the task registrar', () => {
    const registerTaskTool = vi.fn();

    registerStdioToolSet(
      [
        {
          name: 'sheets_compute',
          description: 'Compute',
          inputSchema: {},
          outputSchema: {},
          annotations: { title: 'Compute' },
        },
      ],
      {
        createTaskHandler: vi.fn(() => ({ createTask: vi.fn(), getTask: vi.fn(), getTaskResult: vi.fn() })),
        handleToolCall: vi.fn(),
        getToolIcons: vi.fn(() => undefined),
        getToolExecution: vi.fn(() => ({ taskSupport: 'required' })),
        registerTaskTool,
        registerTool: vi.fn(),
      }
    );

    expect(registerTaskTool).toHaveBeenCalledOnce();
  });

  it('registers non-task tools and forwards progress metadata into handleToolCall', async () => {
    const registerTool = vi.fn();
    const handleToolCall = vi.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] }));

    registerStdioToolSet(
      [
        {
          name: 'sheets_auth',
          description: 'Auth',
          inputSchema: {},
          outputSchema: {},
          annotations: { title: 'Auth' },
        },
      ],
      {
        createTaskHandler: vi.fn(),
        handleToolCall,
        getToolIcons: vi.fn(() => []),
        getToolExecution: vi.fn(() => undefined),
        registerTaskTool: vi.fn(),
        registerTool,
      }
    );

    const callback = registerTool.mock.calls[0]?.[2] as (
      args: Record<string, unknown>,
      extra: {
        _meta?: { progressToken?: string | number };
        signal?: AbortSignal;
      }
    ) => Promise<unknown>;

    await callback(
      { request: { action: 'status' } },
      {
        _meta: { progressToken: 'token-1' },
        signal: new AbortController().signal,
      }
    );

    expect(handleToolCall).toHaveBeenCalledWith(
      'sheets_auth',
      { request: { action: 'status' } },
      expect.objectContaining({
        progressToken: 'token-1',
      })
    );
  });
});
