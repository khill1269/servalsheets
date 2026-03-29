import { describe, expect, it, vi } from 'vitest';

import { createStdioTaskHandler } from '../../../packages/mcp-stdio/src/create-stdio-task-handler.js';

describe('@serval/mcp-stdio createStdioTaskHandler', () => {
  it('stores a completed result for successful task execution', async () => {
    const stored: Array<{ status: 'completed' | 'failed'; result: unknown }> = [];
    const taskStore = {
      createTask: vi.fn(async () => ({ taskId: 'task-1' })),
      getTask: vi.fn(),
      getTaskResult: vi.fn(),
      updateTaskStatus: vi.fn(async () => undefined),
      storeTaskResult: vi.fn(async (_taskId, status, result) => {
        stored.push({ status, result });
      }),
      isTaskCancelled: vi.fn(async () => false),
      getCancellationReason: vi.fn(async () => null),
    };

    const handler = createStdioTaskHandler('sheets_auth', {
      createTaskStoreNotConfiguredError: (toolName) => new Error(`${toolName} missing task store`),
      taskStoreForCancellation: taskStore,
      taskAbortControllers: new Map(),
      taskWatchdogTimers: new Map(),
      taskWatchdogMs: 1000,
      runTool: vi.fn(async () => ({
        content: [{ type: 'text' as const, text: 'ok' }],
      })) as any,
      buildCancelledTaskResult: (message) => ({
        content: [],
        structuredContent: { response: { success: false, error: { code: 'TASK_CANCELLED', message } } },
      }),
      buildInternalErrorResult: (error) => ({
        content: [],
        structuredContent: {
          response: {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: error instanceof Error ? error.message : String(error),
            },
          },
        },
      }),
      log: {
        warn: vi.fn(),
        error: vi.fn(),
      },
    });

    await handler.createTask({}, { taskStore, taskRequestedTtl: 60_000 } as never);

    await vi.waitFor(() => {
      expect(taskStore.storeTaskResult).toHaveBeenCalledOnce();
    });

    expect(stored[0]?.status).toBe('completed');
  });

  it('stores TASK_CANCELLED when task execution aborts', async () => {
    const stored: Array<{ status: 'completed' | 'failed'; result: unknown }> = [];
    const taskStore = {
      createTask: vi.fn(async () => ({ taskId: 'task-2' })),
      getTask: vi.fn(),
      getTaskResult: vi.fn(),
      updateTaskStatus: vi.fn(async () => undefined),
      storeTaskResult: vi.fn(async (_taskId, status, result) => {
        stored.push({ status, result });
      }),
      isTaskCancelled: vi.fn(async () => false),
      getCancellationReason: vi.fn(async () => null),
    };

    const handler = createStdioTaskHandler('sheets_auth', {
      createTaskStoreNotConfiguredError: (toolName) => new Error(`${toolName} missing task store`),
      taskStoreForCancellation: taskStore,
      taskAbortControllers: new Map(),
      taskWatchdogTimers: new Map(),
      taskWatchdogMs: 1000,
      runTool: vi.fn(async (_args, extra) => {
        const error = new Error(String(extra?.abortSignal?.reason ?? 'aborted'));
        error.name = 'AbortError';
        throw error;
      }) as any,
      buildCancelledTaskResult: (message) => ({
        content: [],
        structuredContent: { response: { success: false, error: { code: 'TASK_CANCELLED', message } } },
      }),
      buildInternalErrorResult: (error) => ({
        content: [],
        structuredContent: {
          response: {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: error instanceof Error ? error.message : String(error),
            },
          },
        },
      }),
      log: {
        warn: vi.fn(),
        error: vi.fn(),
      },
    });

    const created = await handler.createTask({}, { taskStore, taskRequestedTtl: 60_000 } as never);
    expect(created.task.taskId).toBe('task-2');

    await vi.waitFor(() => {
      expect(taskStore.storeTaskResult).toHaveBeenCalledOnce();
    });

    expect(stored[0]?.status).toBe('failed');
    expect(stored[0]?.result).toMatchObject({
      structuredContent: {
        response: {
          error: {
            code: 'TASK_CANCELLED',
          },
        },
      },
    });
  });
});
