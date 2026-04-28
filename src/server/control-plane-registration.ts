import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { LoggingLevel } from '@modelcontextprotocol/sdk/types.js';
import type { TaskStoreAdapter } from '../core/index.js';
import { handleLoggingSetLevel } from '../handlers/logging.js';
import { logger as baseLogger } from '../utils/logger.js';
import {
  completeAction,
  completeRangeContextAware,
  completeSheetName,
  completeSpreadsheetId,
  TOOL_ACTIONS,
} from '../mcp/completions.js';

export function registerServerTaskCancelHandler(params: {
  taskStore: TaskStoreAdapter;
  taskAbortControllers: Map<string, AbortController>;
  taskWatchdogTimers: Map<string, NodeJS.Timeout>;
  log?: typeof baseLogger;
}): void {
  const { taskStore, taskAbortControllers, taskWatchdogTimers, log = baseLogger } = params;

  try {
    // Wire the cancel callback: when the SDK's TaskStore.cancelTask() is called
    // (via tasks/cancel protocol request), abort the running operation's AbortController.
    const underlyingStore = taskStore.getUnderlyingStore();
    if ('onTaskCancelled' in underlyingStore) {
      (
        underlyingStore as { onTaskCancelled?: (taskId: string, reason: string) => void }
      ).onTaskCancelled = (taskId, reason) => {
        const abortController = taskAbortControllers.get(taskId);
        if (abortController) {
          abortController.abort(reason);
          taskAbortControllers.delete(taskId);
          log.info('Task abort signal sent', { taskId, reason });
        }

        // Clear watchdog timer when task is cancelled via store.
        clearTimeout(taskWatchdogTimers.get(taskId));
        taskWatchdogTimers.delete(taskId);
      };
      log.info('Task cancellation support enabled');
    } else {
      log.warn('Task cancellation not available (store does not support onTaskCancelled)');
    }
  } catch (error) {
    log.error('Failed to register task cancel handler', { error });
  }
}

export function registerServerLoggingSetLevelHandler(params: {
  server: McpServer;
  setRequestedMcpLogLevel: (level: LoggingLevel) => void;
  installLoggingBridge: () => void;
  log?: typeof baseLogger;
}): void {
  const { server, setRequestedMcpLogLevel, installLoggingBridge, log = baseLogger } = params;

  try {
    server.server.setRequestHandler(
      SetLevelRequestSchema,
      async (request: { params: { level: LoggingLevel } }) => {
        const level = request.params.level;
        setRequestedMcpLogLevel(level);
        installLoggingBridge();

        const response = await handleLoggingSetLevel({ level });
        log.info('Log level changed via logging/setLevel', {
          previousLevel: response.previousLevel,
          newLevel: response.newLevel,
        });

        // OK: Explicit empty - MCP logging/setLevel returns empty object per protocol.
        return {};
      }
    );

    log.info('Logging handler registered (logging/setLevel)');
  } catch (error) {
    log.error('Failed to register logging handler', { error });
  }
}

/**
 * Wire the completion/complete request handler for tool-argument autocompletion.
 *
 * The MCP SDK auto-registers completion/complete for prompt arguments declared
 * with completable(). Tool-argument completions (spreadsheetId, range, action)
 * require a custom handler registered via server.server.setRequestHandler().
 *
 * Ref type: ServalSheets uses a custom "ref/tool" ref type (non-standard
 * extension beyond the SDK's ref/prompt and ref/resource).
 */
export function registerToolCompletionHandler(params: {
  server: McpServer;
  log?: typeof baseLogger;
}): void {
  const { server, log = baseLogger } = params;

  try {
    // We use a loose schema to intercept all completion/complete requests,
    // including the custom ref/tool type not defined in the SDK's schema.
    // The SDK's CompleteRequestSchema only accepts ref/prompt and ref/resource.
    const looseCompleteSchema = {
      safeParse: (data: unknown) => ({ success: true, data }),
    } as unknown as Parameters<typeof server.server.setRequestHandler>[0];

    server.server.setRequestHandler(
      looseCompleteSchema,
      async (
        request: unknown
      ): Promise<{ completion: { values: string[]; hasMore: boolean; total?: number } }> => {
        const req = request as {
          method?: string;
          params?: {
            ref?: { type?: string; name?: string };
            argument?: { name?: string; value?: string };
          };
        };

        // Only handle completion/complete requests
        if (req.method !== 'completion/complete') {
          return { completion: { values: [], hasMore: false } };
        }

        const ref = req.params?.ref;
        const arg = req.params?.argument;
        const partial = arg?.value ?? '';

        // Handle ref/tool — ServalSheets custom extension for tool-argument completions
        if (ref?.type === 'ref/tool') {
          const toolName = ref.name ?? '';
          const argName = arg?.name ?? '';

          if (argName === 'action') {
            // completeAction returns [] for empty partial (defensive guard in
            // generated code).  When no partial is given return all actions.
            const values = partial
              ? completeAction(toolName, partial)
              : (TOOL_ACTIONS[toolName] ?? []);
            return { completion: { values, hasMore: false } };
          }

          if (argName === 'spreadsheetId') {
            const values = completeSpreadsheetId(partial);
            return { completion: { values, hasMore: false } };
          }

          if (argName === 'range' || argName === 'ranges') {
            const values = completeRangeContextAware(partial);
            return { completion: { values, hasMore: false } };
          }

          // Unknown argument for a known tool — return empty
          return { completion: { values: [], hasMore: false } };
        }

        // Handle ref/prompt — route argument names to their completers.
        // The SDK's completable() functions are stored per-prompt at registration
        // time. We replicate the argument-name routing here since our loose schema
        // handler overrides the SDK's built-in completion/complete handler.
        if (ref?.type === 'ref/prompt') {
          const argName = arg?.name ?? '';

          // Most prompt args that benefit from completions use these two completers.
          if (argName === 'spreadsheetId') {
            const values = completeSpreadsheetId(partial);
            return { completion: { values, hasMore: false } };
          }

          if (argName === 'range' || argName === 'ranges') {
            const values = completeRangeContextAware(partial);
            return { completion: { values, hasMore: false } };
          }

          // Other prompt arguments (e.g. transformation, reportType) are free-form;
          // return empty so the client shows no autocomplete popup.
          return { completion: { values: [], hasMore: false } };
        }

        // Handle ref/resource — route by argument name to the same completers used
        // for ref/tool and ref/prompt. Without this branch, resource template
        // arguments (e.g. spreadsheetId in a resource URI) returned empty completions.
        if (ref?.type === 'ref/resource') {
          const argName = arg?.name ?? '';
          if (argName === 'spreadsheetId' || argName === 'uri') {
            const values = completeSpreadsheetId(partial);
            return { completion: { values, hasMore: false } };
          }
          if (argName === 'sheetName' || argName === 'sheet') {
            const values = completeSheetName(partial);
            return { completion: { values, hasMore: false } };
          }
          if (argName === 'range' || argName === 'ranges') {
            const values = completeRangeContextAware(partial);
            return { completion: { values, hasMore: false } };
          }
          return { completion: { values: [], hasMore: false } };
        }

        // For any future unknown ref types, return empty.
        return { completion: { values: [], hasMore: false } };
      }
    );

    log.info('Tool-argument completion handler registered (completion/complete)');
  } catch (error) {
    log.error('Failed to register tool completion handler', { error });
  }
}
