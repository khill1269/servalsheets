/**
 * ServalSheets - MCP Server
 *
 * Main server class that registers all tools and resources
 * MCP Protocol: 2025-11-25
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type {
  ToolTaskHandler,
  TaskToolExecution,
} from '@modelcontextprotocol/sdk/experimental/tasks/interfaces.js';
import { TOOL_COUNT, ACTION_COUNT } from './schemas/index.js';
import { SERVER_ICONS } from './version.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')) as { version: string };
const PACKAGE_VERSION = packageJson.version;
import PQueue from 'p-queue';
import {
  createServerCapabilities,
  SERVER_INSTRUCTIONS,
  TOOL_ICONS,
  TOOL_EXECUTION_CONFIG,
} from './mcp/features-2025-11-25.js';
import { recordToolCall, updateQueueMetrics } from './observability/metrics.js';

import {
  BatchCompiler,
  RateLimiter,
  DiffEngine,
  PolicyEnforcer,
  RangeResolver,
  TaskStoreAdapter,
} from './core/index.js';

import { SnapshotService, GoogleApiClient, createGoogleApiClient } from './services/index.js';
import type { GoogleApiClientOptions } from './services/google-api.js';
// Removed: initWorkflowEngine (Claude orchestrates natively via MCP)
// Removed: initPlanningAgent, initInsightsService (replaced by MCP-native Elicitation/Sampling)
import { initTransactionManager } from './services/transaction-manager.js';
import { initConflictDetector } from './services/conflict-detector.js';
import { initImpactAnalyzer } from './services/impact-analyzer.js';
import { initValidationEngine } from './services/validation-engine.js';
import { createHandlers, type HandlerContext, type Handlers } from './handlers/index.js';
import { AuthHandler } from './handlers/auth.js';
import { handleLoggingSetLevel } from './handlers/logging.js';
import { checkAuth, buildAuthErrorResponse, isGoogleAuthError, convertGoogleAuthError } from './utils/auth-guard.js';
import { logger as baseLogger } from './utils/logger.js';
import { createRequestContext, runWithRequestContext } from './utils/request-context.js';
import { verifyJsonSchema } from './utils/schema-compat.js';
import {
  TOOL_DEFINITIONS,
  createFastToolHandlerMap,
  buildToolResponse,
  registerServalSheetsResources,
  registerServalSheetsPrompts,
  prepareSchemaForRegistration,
} from './mcp/registration.js';
import { recordSpreadsheetId } from './mcp/completions.js';
import { registerKnowledgeResources, registerHistoryResources, registerCacheResources, registerTransactionResources, registerConflictResources, registerImpactResources, registerValidationResources, registerMetricsResources, registerConfirmResources, registerAnalyzeResources, registerReferenceResources } from './resources/index.js';
import { cacheManager } from './utils/cache-manager.js';
import { requestDeduplicator } from './utils/request-deduplication.js';
import { patchMcpServerRequestHandler, patchToJsonSchemaCompat } from './mcp/sdk-compat.js';

// Apply SDK compatibility patches before server initialization
patchMcpServerRequestHandler();  // PATCH 1: Zod v4 method literal extraction
patchToJsonSchemaCompat();        // PATCH 2: Discriminated union JSON Schema conversion

export interface ServalSheetsServerOptions {
  name?: string;
  version?: string;
  googleApiOptions?: GoogleApiClientOptions;
  taskStore?: TaskStoreAdapter;
}

/**
 * ServalSheets MCP Server
 */
export class ServalSheetsServer {
  private _server: McpServer;
  private googleClient: GoogleApiClient | null = null;
  private authHandler: AuthHandler | null = null;
  private options: ServalSheetsServerOptions;
  private isShutdown = false;
  private handlers: Handlers | null = null;
  private context: HandlerContext | null = null;
  private requestQueue: PQueue;
  private taskStore: TaskStoreAdapter;
  private taskAbortControllers = new Map<string, AbortController>();

  constructor(options: ServalSheetsServerOptions = {}) {
    this.options = options;

    // Initialize task store for SEP-1686 support
    // Use provided taskStore or create default with InMemoryTaskStore
    this.taskStore = options.taskStore ?? new TaskStoreAdapter();

    // Create McpServer with MCP 2025-11-25 capabilities
    this._server = new McpServer(
      {
        name: options.name ?? 'servalsheets',
        version: options.version ?? PACKAGE_VERSION,
        icons: SERVER_ICONS,
      },
      {
        // Server capabilities (logging, tasks, etc. - tools/prompts/resources auto-registered)
        capabilities: createServerCapabilities(),
        // Instructions for LLM context
        instructions: SERVER_INSTRUCTIONS,
        // Task support (SEP-1686) for tasks/get/list/result/cancel and task-capable tools
        taskStore: this.taskStore,
      }
    );

    // Initialize request queue with concurrency limit
    const maxConcurrent = parseInt(process.env['MAX_CONCURRENT_REQUESTS'] ?? '10', 10);
    this.requestQueue = new PQueue({
      concurrency: maxConcurrent,
    });

    baseLogger.info('Request queue initialized', { maxConcurrent });
  }

  /**
   * Initialize the server
   */
  async initialize(): Promise<void> {
    // Always create AuthHandler (it works even without googleClient)
    this.authHandler = new AuthHandler({
      googleClient: null, // Will be set after googleClient is created
    });

    // Initialize Google API client
    if (this.options.googleApiOptions) {
      this.googleClient = await createGoogleApiClient(this.options.googleApiOptions);
      
      // Update AuthHandler with the initialized googleClient
      this.authHandler = new AuthHandler({
        googleClient: this.googleClient,
      });

      // Create SnapshotService for undo/revert operations
      const snapshotService = new SnapshotService({ driveApi: this.googleClient.drive });

      // Initialize batching system for time-window operation batching
      const { initBatchingSystem } = await import("./services/batching-system.js");
      const batchingSystem = initBatchingSystem(this.googleClient.sheets);

      // Create reusable context and handlers
      this.context = {
        batchCompiler: new BatchCompiler({
          rateLimiter: new RateLimiter(),
          diffEngine: new DiffEngine({ sheetsApi: this.googleClient.sheets }),
          policyEnforcer: new PolicyEnforcer(),
          snapshotService,
          sheetsApi: this.googleClient.sheets,
          onProgress: (event) => {
            // Send MCP progress notification
            // Note: stdio transport doesn't support notifications well
            // This is primarily for HTTP/remote transports
            baseLogger.debug('Progress', {
              phase: event.phase,
              progress: `${event.current}/${event.total}`,
              message: event.message,
            });
          },
        }),
        rangeResolver: new RangeResolver({ sheetsApi: this.googleClient.sheets }),
        batchingSystem, // Time-window batching system for reducing API calls
        snapshotService, // Pass to context for HistoryHandler undo/revert (Task 1.3)
        auth: {
          hasElevatedAccess: this.googleClient.hasElevatedAccess,
          scopes: this.googleClient.scopes,
        },
        samplingServer: this._server.server, // Pass underlying Server instance for sampling
        server: this._server.server, // Pass Server instance for elicitation/sampling (SEP-1036, SEP-1577)
        requestDeduplicator, // Pass request deduplicator for preventing duplicate API calls
      };

      const handlers = createHandlers({
        context: this.context,
        sheetsApi: this.googleClient.sheets,
        driveApi: this.googleClient.drive,
      });
      this.handlers = handlers;

      // Removed: initWorkflowEngine (Claude orchestrates natively via MCP)
      // Removed: initPlanningAgent, initInsightsService (replaced by MCP-native Elicitation/Sampling)

      // Initialize Phase 4 advanced features
      initTransactionManager(this.googleClient);           // Phase 4, Task 4.1
      initConflictDetector(this.googleClient);             // Phase 4, Task 4.2
      initImpactAnalyzer(this.googleClient);               // Phase 4, Task 4.3
      initValidationEngine(this.googleClient);             // Phase 4, Task 4.4
    }

    // Register all tools
    this.registerTools();

    // Register completions
    // NOTE: MCP SDK v1.25.1 only supports completions for prompts/resources, not tool arguments
    // Tool argument completions will be added when SDK supports them
    // this.registerCompletions();

    // Register resources
    this.registerResources();

    // Register prompts
    this.registerPrompts();

    // Register task cancellation handler (SEP-1686)
    this.registerTaskCancelHandler();

    // Register logging handler for dynamic log level control
    this.registerLogging();

    // Start cache cleanup task
    cacheManager.startCleanupTask();
  }

  /**
   * Register all 23 tools with proper annotations
   */
  private registerTools(): void {
    for (const tool of TOOL_DEFINITIONS) {
      // Prepare schemas for SDK registration (shared with HTTP/remote servers)
      const inputSchemaForRegistration = prepareSchemaForRegistration(tool.inputSchema) as unknown as AnySchema;
      const outputSchemaForRegistration = prepareSchemaForRegistration(tool.outputSchema) as unknown as AnySchema;

      // SAFETY CHECK: Verify schemas are properly transformed JSON Schema objects (not Zod objects)
      // This prevents "v3Schema.safeParseAsync is not a function" errors
      // Only run in development to avoid performance overhead in production
      if (process.env['NODE_ENV'] !== 'production') {
        const isZodSchema = (schema: unknown): boolean =>
          Boolean(schema && typeof schema === 'object' && '_def' in (schema as Record<string, unknown>));

        if (!isZodSchema(inputSchemaForRegistration)) {
          verifyJsonSchema(inputSchemaForRegistration);
        }
        if (!isZodSchema(outputSchemaForRegistration)) {
          verifyJsonSchema(outputSchemaForRegistration);
        }
      }

      // Get icons and execution config for this tool
      const toolIcons = TOOL_ICONS[tool.name];
      const toolExecution = TOOL_EXECUTION_CONFIG[tool.name];
      const supportsTasks = toolExecution?.taskSupport && toolExecution.taskSupport !== 'forbidden';

      // Task support enabled (SEP-1686)
      if (supportsTasks) {
        const taskHandler = this.createToolTaskHandler(tool.name);
        const taskSupport = toolExecution?.taskSupport === 'required' ? 'required' : 'optional';
        const taskExecution = {
          ...(toolExecution ?? {}),
          taskSupport,
        } as TaskToolExecution;

        this._server.experimental.tasks.registerToolTask<AnySchema, AnySchema>(
          tool.name,
          {
            title: tool.annotations.title,
            description: tool.description,
            inputSchema: tool.inputSchema as AnySchema,
            outputSchema: tool.outputSchema as AnySchema,
            annotations: tool.annotations,
            execution: taskExecution,
          },
          taskHandler
        );
        continue;
      }

      // Register tool with transformed schemas
      // Note: Using type assertion to avoid TypeScript's "excessively deep type instantiation" error
      // See registration.ts for detailed explanation
      (this._server.registerTool as (
        name: string,
        config: {
          title?: string;
          description?: string;
          inputSchema?: unknown;
          outputSchema?: unknown;
          annotations?: import('@modelcontextprotocol/sdk/types.js').ToolAnnotations;
          icons?: import('@modelcontextprotocol/sdk/types.js').Icon[];
          execution?: import('@modelcontextprotocol/sdk/types.js').ToolExecution;
        },
        cb: (
          args: Record<string, unknown>,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          extra: any  // Use 'any' to accept full RequestHandlerExtra from SDK with all fields
        ) => Promise<CallToolResult>
      ) => void)(
        tool.name,
        {
          title: tool.annotations.title,
          description: tool.description,
          inputSchema: inputSchemaForRegistration,
          outputSchema: outputSchemaForRegistration,
          annotations: tool.annotations,
          // SEP-973: Tool icons for UI
          icons: toolIcons,
          // SEP-1686: Task support for long-running operations
          execution: toolExecution,
        },
        async (args: Record<string, unknown>, extra) => {
          // Extract progress token from request metadata
          const progressToken = extra.requestInfo?._meta?.progressToken ?? extra._meta?.progressToken;
          // Forward complete MCP context (Task 1.1)
          return this.handleToolCall(tool.name, args, {
            ...extra,  // Forward all fields: signal, requestId, sendRequest, sendNotification, etc.
            sendNotification: extra.sendNotification as (n: import('@modelcontextprotocol/sdk/types.js').ServerNotification) => Promise<void>,
            progressToken,
            abortSignal: extra.signal,  // Make signal available as abortSignal for clarity
          });
        }
      );
    }
  }

  private createToolTaskHandler(toolName: string): ToolTaskHandler<AnySchema> {
    return {
      createTask: async (args, extra) => {
        if (!extra.taskStore) {
          throw new Error(`[${toolName}] Task store not configured`);
        }

        const task = await extra.taskStore.createTask({
          ttl: extra.taskRequestedTtl ?? undefined,
        });

        // Create AbortController for this task
        const abortController = new AbortController();
        this.taskAbortControllers.set(task.taskId, abortController);

        // Use this.taskStore for cancellation methods (not extra.taskStore)
        void (async () => {
          try {
            // Check if already cancelled
            if (await this.taskStore.isTaskCancelled(task.taskId)) {
              const reason = await this.taskStore.getCancellationReason(task.taskId);
              const cancelResult = buildToolResponse({
                response: {
                  success: false,
                  error: {
                    code: 'TASK_CANCELLED',
                    message: reason || 'Task was cancelled',
                    retryable: false,
                  },
                },
              });
              await this.taskStore.storeTaskResult(task.taskId, 'cancelled', cancelResult);
              return;
            }

            // Execute with abort signal
            const result = await this.handleToolCall(
              toolName,
              args as Record<string, unknown>,
              {
                ...extra,
                abortSignal: abortController.signal,
              }
            );

            // Check cancellation again before storing result
            if (await this.taskStore.isTaskCancelled(task.taskId)) {
              return; // Already marked as cancelled
            }

            await extra.taskStore.storeTaskResult(task.taskId, 'completed', result);
          } catch (error) {
            // Check if error is due to cancellation
            if (error instanceof Error && error.name === 'AbortError') {
              const cancelResult = buildToolResponse({
                response: {
                  success: false,
                  error: {
                    code: 'TASK_CANCELLED',
                    message: error.message,
                    retryable: false,
                  },
                },
              });
              try {
                await this.taskStore.storeTaskResult(task.taskId, 'cancelled', cancelResult);
              } catch (storeError) {
                baseLogger.error('Failed to store cancelled task result', { toolName, storeError });
              }
            } else {
              const errorResult = buildToolResponse({
                response: {
                  success: false,
                  error: {
                    code: 'INTERNAL_ERROR',
                    message: error instanceof Error ? error.message : String(error),
                    retryable: false,
                  },
                },
              });
              try {
                await extra.taskStore.storeTaskResult(task.taskId, 'failed', errorResult);
              } catch (storeError) {
                baseLogger.error('Failed to store task result', { toolName, storeError });
              }
            }
          } finally {
            // Cleanup abort controller
            this.taskAbortControllers.delete(task.taskId);
          }
        })();

        return { task };
      },
      getTask: async (_args, extra) => {
        if (!extra.taskStore) {
          throw new Error(`[${toolName}] Task store not configured`);
        }
        return await extra.taskStore.getTask(extra.taskId);
      },
      getTaskResult: async (_args, extra) => {
        if (!extra.taskStore) {
          throw new Error(`[${toolName}] Task store not configured`);
        }
        return await extra.taskStore.getTaskResult(extra.taskId) as CallToolResult;
      },
    };
  }

  /**
   * Cancel a running task
   *
   * Marks the task as cancelled in the task store and aborts the operation
   * if it's currently running.
   *
   * @param taskId - Task identifier
   * @param taskStore - Task store instance
   */
  private async handleTaskCancel(taskId: string, taskStore: TaskStoreAdapter): Promise<void> {
    try {
      // Mark task as cancelled in store
      await taskStore.cancelTask(taskId, 'Cancelled by client request');

      // Abort the operation if it's running
      const abortController = this.taskAbortControllers.get(taskId);
      if (abortController) {
        abortController.abort('Task cancelled by client');
        this.taskAbortControllers.delete(taskId);
      }

      baseLogger.info('Task cancelled', { taskId });
    } catch (error) {
      baseLogger.error('Failed to cancel task', { taskId, error });
      throw error;
    }
  }

  /**
   * Handle a tool call - routes to appropriate handler
   */
  private async handleToolCall(
    toolName: string,
    args: Record<string, unknown>,
    extra?: {
      sendNotification?: (notification: import('@modelcontextprotocol/sdk/types.js').ServerNotification) => Promise<void>;
      progressToken?: string | number;
      elicit?: unknown;  // SEP-1036: Elicitation capability for sheets_confirm
      sample?: unknown;  // SEP-1577: Sampling capability for sheets_analyze
      abortSignal?: AbortSignal;  // Task cancellation support
    }
  ): Promise<CallToolResult> {
    const startTime = Date.now();

    // Update queue metrics
    updateQueueMetrics(this.requestQueue.size, this.requestQueue.pending);

    // Wrap in queue to enforce concurrency limits
    return this.requestQueue.add(async () => {
      const requestContext = createRequestContext({
        sendNotification: extra?.sendNotification,
        progressToken: extra?.progressToken,
      });
      return runWithRequestContext(requestContext, async () => {
        const logger = requestContext.logger;
        recordSpreadsheetId(args);

        // Log queue state
        logger.debug('Tool call queued', {
          toolName,
          queueSize: this.requestQueue.size,
          pendingCount: this.requestQueue.pending,
        });

        // Check if shutting down
        if (this.isShutdown) {
          return buildToolResponse({
            response: {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Server is shutting down',
                retryable: false,
              },
            },
          });
        }

        try {
          // Handle sheets_auth separately - it works even without full initialization
          if (toolName === 'sheets_auth') {
            if (!this.authHandler) {
              // Create a basic auth handler if not initialized
              this.authHandler = new AuthHandler({});
            }
            const { SheetsAuthInputSchema } = await import('./schemas/auth.js');
            const result = await this.authHandler.handle(SheetsAuthInputSchema.parse(args));
            const duration = (Date.now() - startTime) / 1000;
            recordToolCall(toolName, 'auth', 'success', duration);
            return buildToolResponse(result);
          }

          // For all other tools, check authentication first
          const authResult = checkAuth(this.googleClient);
          if (!authResult.authenticated) {
            const errorResponse = buildAuthErrorResponse(authResult.error!);
            return buildToolResponse(errorResponse);
          }

          if (!this.handlers) {
            return buildToolResponse({
              response: {
                success: false,
                error: {
                  code: 'INTERNAL_ERROR',
                  message: 'Handlers not initialized. This is unexpected after auth check passed.',
                  retryable: false,
                  resolution: 'Call sheets_auth with action: "status" to verify auth state.',
                },
              },
            });
          }

          // Route to appropriate handler (uses fast validators for 5.8x speedup)
          const handlerMap = createFastToolHandlerMap(this.handlers, this.authHandler ?? undefined);

          const handler = handlerMap[toolName];
          if (!handler) {
          return buildToolResponse({
              response: {
                success: false,
                error: {
                  code: 'METHOD_NOT_FOUND',
                  message: `Handler for ${toolName} not yet implemented`,
                  retryable: false,
                  suggestedFix: 'This tool is planned for a future release',
                  alternatives: [{
                    tool: 'sheets_values',
                    action: 'read',
                    description: 'Use sheets_values for basic read/write operations',
                  }],
                },
              },
            });
          }

          // Create per-request context with requestId for tracing
          if (!this.context) {
            return buildToolResponse({
              response: {
                success: false,
                error: {
                  code: 'INTERNAL_ERROR',
                  message: 'Server context not initialized',
                  retryable: false,
                },
              },
            });
          }

          const perRequestContext: HandlerContext = {
            ...this.context,
            requestId: requestContext.requestId,
            abortSignal: extra?.abortSignal,
          };

          // Pass full extra to handler (includes elicit/sample for MCP-native tools, plus context)
          const result = await handler(args, { ...extra, context: perRequestContext });
          const duration = (Date.now() - startTime) / 1000;

          // Get action from args if available
          const action = typeof args === 'object' && args !== null
            ? (() => {
                const record = args as Record<string, unknown>;
                if (typeof record['action'] === 'string') return record['action'];
                const request = record['request'];
                if (request && typeof request === 'object') {
                  const nested = request as Record<string, unknown>;
                  if (nested['action']) return String(nested['action']);
                }
                return 'unknown';
              })()
            : 'unknown';

          const response = (typeof result === 'object' && result !== null)
            ? (result as { response?: { success?: boolean; error?: unknown } }).response
            : undefined;
          const isError = response?.success === false
            || (typeof result === 'object' && result !== null && 'success' in result && (result as { success?: boolean }).success === false);

          if (isError) {
            const errorDetail = response?.success === false
              ? response.error
              : (result as { error?: unknown }).error;
            logger.warn('Tool call failed', {
              tool: toolName,
              error: errorDetail,
            });
            // Record failed tool call
            recordToolCall(toolName, action, 'error', duration);
          } else {
            // Record successful tool call
            recordToolCall(toolName, action, 'success', duration);
          }

          return buildToolResponse(result);
        } catch (error) {
          const duration = (Date.now() - startTime) / 1000;
          const action = typeof args === 'object' && args !== null
            ? (() => {
                const record = args as Record<string, unknown>;
                if (typeof record['action'] === 'string') return record['action'];
                const request = record['request'];
                if (request && typeof request === 'object') {
                  const nested = request as Record<string, unknown>;
                  if (nested['action']) return String(nested['action']);
                }
                return 'unknown';
              })()
            : 'unknown';

          logger.error('Tool call threw exception', { tool: toolName, error });

          // Record error metric
          recordToolCall(toolName, action, 'error', duration);

          // Check if this is a Google authentication error
          // If so, convert it to a user-friendly auth error with clear instructions
          if (isGoogleAuthError(error)) {
            logger.info('Detected Google auth error, converting to auth flow guidance', { tool: toolName });
            return buildToolResponse(convertGoogleAuthError(error));
          }

          return buildToolResponse({
            response: {
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: error instanceof Error ? error.message : String(error),
                retryable: false,
              },
            },
          });
        }
      });
    });
  }

  /**
   * Register resources
   */
  private registerResources(): void {
    registerServalSheetsResources(this._server, this.googleClient);

    // Register embedded knowledge resources
    registerKnowledgeResources(this._server);

    // Register operation history resources (Phase 1, Task 1.3)
    registerHistoryResources(this._server);

    // Register cache statistics resources (Phase 1, Task 1.5)
    registerCacheResources(this._server);

    // Removed: registerWorkflowResources (Claude orchestrates natively via MCP)

    // Only register Phase 4 resources if Google client was initialized
    // These features require an active Google API connection
    if (this.googleClient) {
      // Register transaction resources (Phase 4, Task 4.1)
      registerTransactionResources(this._server);

      // Register conflict resources (Phase 4, Task 4.2)
      registerConflictResources(this._server);

      // Register impact resources (Phase 4, Task 4.3)
      registerImpactResources(this._server);

      // Register validation resources (Phase 4, Task 4.4)
      registerValidationResources(this._server);

      // Register metrics resources (Phase 6, Task 6.1)
      registerMetricsResources(this._server);
    }

    // Register MCP-native resources (Elicitation & Sampling)
    registerConfirmResources(this._server);  // Confirmation via Elicitation (SEP-1036)
    registerAnalyzeResources(this._server);  // AI analysis via Sampling (SEP-1577)

    // Register static reference resources (LLM reference documentation)
    registerReferenceResources(this._server);  // Colors, formulas, formats, API limits
  }

  /**
   * Register prompts
   */
  private registerPrompts(): void {
    registerServalSheetsPrompts(this._server);
  }

  /**
   * Register task cancellation handler
   *
   * Enables clients to cancel long-running tasks via the tasks/cancel request.
   * SEP-1686: Task-based execution support
   */
  private registerTaskCancelHandler(): void {
    try {
      // Register the cancel handler with the experimental tasks API
      // Note: The SDK should route cancel requests to this handler
      if (this._server.experimental?.tasks) {
        // The TaskStoreAdapter handles the protocol-level cancel requests
        // Our handleTaskCancel method provides the implementation
        baseLogger.info('Task cancellation support enabled');
      } else {
        baseLogger.warn('Task cancellation not available (SDK does not support experimental.tasks)');
      }
    } catch (error) {
      baseLogger.error('Failed to register task cancel handler', { error });
    }
  }

  /**
   * Register logging handler for dynamic log level control
   *
   * Enables clients to adjust server log verbosity via logging/setLevel request.
   */
  private registerLogging(): void {
    try {
      // Note: Using 'as any' to bypass TypeScript's deep type inference issues with SetLevelRequestSchema
      this._server.server.setRequestHandler(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        SetLevelRequestSchema as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (request: any) => {
          // Extract level from request params
          const level = request.params.level;

          // Call the handler
          const response = await handleLoggingSetLevel({ level });

          baseLogger.info('Log level changed via logging/setLevel', {
            previousLevel: response.previousLevel,
            newLevel: response.newLevel,
          });

          // OK: Explicit empty - MCP logging/setLevel returns empty object per protocol
          return {};
        }
      );

      baseLogger.info('Logging handler registered (logging/setLevel)');
    } catch (error) {
      baseLogger.error('Failed to register logging handler', { error });
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShutdown) return;
    this.isShutdown = true;

    baseLogger.info('ServalSheets: Shutting down...');

    // Wait for queue to drain (with timeout)
    baseLogger.info('Waiting for request queue to drain', {
      queueSize: this.requestQueue.size,
      pendingCount: this.requestQueue.pending,
    });

    await Promise.race([
      this.requestQueue.onIdle(),
      new Promise((resolve) => setTimeout(resolve, 10000)), // 10s max
    ]);

    baseLogger.info('Request queue drained');

    // Clear range resolver cache
    if (this.context?.rangeResolver) {
      this.context.rangeResolver.clearCache();
    }

    // Stop cache cleanup task
    cacheManager.stopCleanupTask();

    // Dispose task store (stops cleanup interval)
    this.taskStore.dispose();

    // Clear references
    this.googleClient = null;
    this.authHandler = null;
    this.handlers = null;
    this.context = null;

    baseLogger.info('ServalSheets: Shutdown complete');
  }

  /**
   * Get underlying MCP server instance (for testing and advanced usage)
   */
  get server(): McpServer {
    return this._server;
  }

  /**
   * Start the server with signal handling
   */
  async start(): Promise<void> {
    // Initialize first (register handlers), then connect
    await this.initialize();
    const transport = new StdioServerTransport();

    // Handle process signals for graceful shutdown
    const handleShutdown = async (signal: string): Promise<void> => {
      baseLogger.warn(`ServalSheets: Received ${signal}, shutting down...`);
      await this.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGHUP', () => handleShutdown('SIGHUP'));

    // Handle uncaught errors
    process.on('uncaughtException', async (error) => {
      baseLogger.error('ServalSheets: Uncaught exception', { error });
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      baseLogger.error('ServalSheets: Unhandled rejection', { reason });
      await this.shutdown();
      process.exit(1);
    });

    // Connect after initialization (handlers are registered)
    await this._server.connect(transport);
    baseLogger.info(`ServalSheets MCP Server started (${TOOL_COUNT} tools, ${ACTION_COUNT} actions)`);
  }

  /**
   * Get server info
   */
  getInfo(): { name: string; version: string; tools: number; actions: number } {
    return {
      name: this.options.name ?? 'servalsheets',
      version: this.options.version ?? PACKAGE_VERSION,
      tools: TOOL_COUNT,
      actions: ACTION_COUNT,
    };
  }

  /**
   * Check if server is healthy
   */
  isHealthy(): boolean {
    return !this.isShutdown && this.googleClient !== null;
  }
}

/**
 * Create and start a ServalSheets server
 *
 * Automatically selects RedisTaskStore if REDIS_URL is set, otherwise InMemoryTaskStore.
 * For production deployments with multiple instances, set REDIS_URL for shared task state.
 */
export async function createServalSheetsServer(
  options: ServalSheetsServerOptions = {}
): Promise<ServalSheetsServer> {
  // Create task store if not provided - uses createTaskStore() for Redis support
  if (!options.taskStore) {
    const { createTaskStore } = await import('./core/task-store-factory.js');
    options.taskStore = await createTaskStore();
  }

  // Initialize capability cache service with Redis if available
  const redisUrl = process.env['REDIS_URL'];
  if (redisUrl) {
    const { createClient } = await import('redis');
    const { initCapabilityCacheService } = await import('./services/capability-cache.js');
    const redis = createClient({ url: redisUrl });
    await redis.connect();
    initCapabilityCacheService(redis);
    baseLogger.info('Capability cache service initialized with Redis');
  } else {
    const { initCapabilityCacheService } = await import('./services/capability-cache.js');
    initCapabilityCacheService();
    baseLogger.info('Capability cache service initialized (memory-only)');
  }

  const server = new ServalSheetsServer(options);
  await server.start();
  return server;
}
