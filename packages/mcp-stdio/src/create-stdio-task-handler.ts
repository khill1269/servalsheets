import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import type { ToolTaskHandler } from '@modelcontextprotocol/sdk/experimental/tasks/interfaces.js';

export interface StdioTaskStatusUpdaterLike {
  updateTaskStatus(
    taskId: string,
    status: 'working' | 'input_required' | 'completed' | 'failed' | 'cancelled',
    statusMessage?: string
  ): Promise<unknown>;
}

export interface StdioTaskRequestStoreLike extends StdioTaskStatusUpdaterLike {
  createTask(input: {
    ttl?: number | null | undefined;
    pollInterval?: number | undefined;
    context?: Record<string, unknown> | undefined;
  }): Promise<unknown>;
  getTask(taskId: string): Promise<unknown>;
  getTaskResult(taskId: string): Promise<unknown>;
  storeTaskResult(
    taskId: string,
    status: 'completed' | 'failed',
    result: CallToolResult
  ): Promise<void>;
}

export interface StdioCancellationStoreLike {
  isTaskCancelled?(taskId: string): Promise<boolean>;
  getCancellationReason?(taskId: string): Promise<string | null | undefined>;
}

export interface StdioTaskHandlerLogger {
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface CreateStdioTaskHandlerDependencies {
  readonly createTaskStoreNotConfiguredError: (toolName: string) => Error;
  readonly taskStoreForCancellation: StdioCancellationStoreLike;
  readonly taskAbortControllers: Map<string, AbortController>;
  readonly taskWatchdogTimers: Map<string, NodeJS.Timeout>;
  readonly taskWatchdogMs: number;
  readonly runTool: (
    args: Record<string, unknown>,
    extra?: {
      sendNotification?: ((notification: ServerNotification) => Promise<void>) | undefined;
      progressToken?: string | number | undefined;
      abortSignal?: AbortSignal | undefined;
      taskId?: string | undefined;
      taskStore?: StdioTaskStatusUpdaterLike | undefined;
    }
  ) => Promise<CallToolResult>;
  readonly buildCancelledTaskResult: (message: string) => CallToolResult;
  readonly buildInternalErrorResult: (error: unknown) => CallToolResult;
  readonly log: StdioTaskHandlerLogger;
}

type CreateTaskResponse = Awaited<ReturnType<ToolTaskHandler<AnySchema>['createTask']>>;
type GetTaskResponse = Awaited<ReturnType<ToolTaskHandler<AnySchema>['getTask']>>;
type GetTaskResultResponse = Awaited<ReturnType<ToolTaskHandler<AnySchema>['getTaskResult']>>;

export function createStdioTaskHandler(
  toolName: string,
  dependencies: CreateStdioTaskHandlerDependencies
): ToolTaskHandler<AnySchema> {
  const isTaskStoreCancelled = async (taskId: string): Promise<boolean> => {
    if (typeof dependencies.taskStoreForCancellation.isTaskCancelled !== 'function') {
      return false;
    }
    return await dependencies.taskStoreForCancellation.isTaskCancelled(taskId);
  };

  const getCancellationReason = async (taskId: string): Promise<string> => {
    if (typeof dependencies.taskStoreForCancellation.getCancellationReason !== 'function') {
      return 'Task was cancelled';
    }
    return (await dependencies.taskStoreForCancellation.getCancellationReason(taskId)) || 'Task was cancelled';
  };

  const storeCancelledTaskResult = async (
    taskStore: StdioTaskRequestStoreLike,
    taskId: string,
    message: string
  ): Promise<void> => {
    await taskStore.storeTaskResult(taskId, 'failed', dependencies.buildCancelledTaskResult(message));
  };

  return {
    createTask: async (args, extra) => {
      if (!extra.taskStore) {
        throw dependencies.createTaskStoreNotConfiguredError(toolName);
      }

      const taskStore = extra.taskStore as unknown as StdioTaskRequestStoreLike;
      const task = (await taskStore.createTask({
        ttl: extra.taskRequestedTtl ?? undefined,
      })) as CreateTaskResponse['task'];

      const abortController = new AbortController();
      dependencies.taskAbortControllers.set(task.taskId, abortController);

      const watchdogTimer = setTimeout(() => {
        if (dependencies.taskAbortControllers.has(task.taskId)) {
          dependencies.log.warn('Task watchdog: aborting hung task', {
            taskId: task.taskId,
            toolName,
            maxLifetimeMs: dependencies.taskWatchdogMs,
          });
          abortController.abort(
            `Task exceeded maximum runtime of ${(dependencies.taskWatchdogMs / 60000).toFixed(1)} minutes`
          );
          dependencies.taskAbortControllers.delete(task.taskId);
          dependencies.taskWatchdogTimers.delete(task.taskId);
        }
      }, dependencies.taskWatchdogMs);
      dependencies.taskWatchdogTimers.set(task.taskId, watchdogTimer);

      void (async () => {
        try {
          if (await isTaskStoreCancelled(task.taskId)) {
            await storeCancelledTaskResult(taskStore, task.taskId, await getCancellationReason(task.taskId));
            return;
          }

          const result = await dependencies.runTool(args as Record<string, unknown>, {
            sendNotification: extra.sendNotification as
              | ((notification: ServerNotification) => Promise<void>)
              | undefined,
            progressToken: extra._meta?.progressToken,
            abortSignal: abortController.signal,
            taskId: task.taskId,
            taskStore,
          });

          if (await isTaskStoreCancelled(task.taskId)) {
            await storeCancelledTaskResult(taskStore, task.taskId, await getCancellationReason(task.taskId));
            return;
          }

          await taskStore.storeTaskResult(task.taskId, 'completed', result);
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            try {
              await storeCancelledTaskResult(taskStore, task.taskId, error.message);
            } catch (storeError) {
              dependencies.log.error('Failed to store cancelled task result', { toolName, storeError });
            }
            return;
          }

          if (await isTaskStoreCancelled(task.taskId)) {
            try {
              await storeCancelledTaskResult(
                taskStore,
                task.taskId,
                await getCancellationReason(task.taskId)
              );
            } catch (storeError) {
              dependencies.log.error('Failed to store cancelled task result', { toolName, storeError });
            }
            return;
          }

          try {
            await taskStore.storeTaskResult(
              task.taskId,
              'failed',
              dependencies.buildInternalErrorResult(error)
            );
          } catch (storeError) {
            dependencies.log.error('Failed to store task result', { toolName, storeError });
          }
        } finally {
          dependencies.taskAbortControllers.delete(task.taskId);
          clearTimeout(dependencies.taskWatchdogTimers.get(task.taskId));
          dependencies.taskWatchdogTimers.delete(task.taskId);
        }
      })();

      return { task } as CreateTaskResponse;
    },
    getTask: async (_args, extra) => {
      if (!extra.taskStore) {
        throw dependencies.createTaskStoreNotConfiguredError(toolName);
      }
      return (await (extra.taskStore as unknown as StdioTaskRequestStoreLike).getTask(
        extra.taskId
      )) as GetTaskResponse;
    },
    getTaskResult: async (_args, extra) => {
      if (!extra.taskStore) {
        throw dependencies.createTaskStoreNotConfiguredError(toolName);
      }
      return (await (extra.taskStore as unknown as StdioTaskRequestStoreLike).getTaskResult(
        extra.taskId
      )) as GetTaskResultResponse;
    },
  };
}
