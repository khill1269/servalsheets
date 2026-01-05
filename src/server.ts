/**
 * ServalSheets - MCP Server
 * 
 * Main server class that registers all tools and resources
 * MCP Protocol: 2025-11-25
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AnySchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type {
  ToolTaskHandler,
  TaskToolExecution,
} from '@modelcontextprotocol/sdk/experimental/tasks/interfaces.js';
import { TOOL_COUNT, ACTION_COUNT } from './schemas/index.js';
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
import { createHandlers, type HandlerContext, type Handlers } from './handlers/index.js';
import { AuthHandler } from './handlers/auth.js';
import { checkAuth, buildAuthErrorResponse, isGoogleAuthError, convertGoogleAuthError } from './utils/auth-guard.js';
import { logger as baseLogger } from './utils/logger.js';
import { createRequestContext, runWithRequestContext } from './utils/request-context.js';
import { zodToJsonSchemaCompat, isDiscriminatedUnion, verifyJsonSchema } from './utils/schema-compat.js';
import {
  TOOL_DEFINITIONS,
  createToolHandlerMap,
  buildToolResponse,
  registerServalSheetsResources,
  registerServalSheetsPrompts,
  prepareSchemaForRegistration,
} from './mcp/registration.js';
import { recordSpreadsheetId } from './mcp/completions.js';
import { registerKnowledgeResources } from './resources/knowledge.js';
import { cacheManager } from './utils/cache-manager.js';
import { requestDeduplicator } from './utils/request-deduplication.js';
import { patchMcpServerRequestHandler } from './mcp/sdk-compat.js';

patchMcpServerRequestHandler();

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

  constructor(options: ServalSheetsServerOptions = {}) {
    this.options = options;

    // Initialize task store for SEP-1686 support
    // Use provided taskStore or create default with InMemoryTaskStore
    this.taskStore = options.taskStore ?? new TaskStoreAdapter();

    // Create McpServer with MCP 2025-11-25 capabilities
    this._server = new McpServer(
      {
        name: options.name ?? 'servalsheets',
        version: options.version ?? '1.2.0',
      },
      {
        // Server capabilities (logging, tasks, etc. - tools/prompts/resources auto-registered)
        capabilities: createServerCapabilities(),
        // Instructions for LLM context
        instructions: SERVER_INSTRUCTIONS,
        // Task store for SEP-1686 task support
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
      
      // Create reusable context and handlers
      this.context = {
        batchCompiler: new BatchCompiler({
          rateLimiter: new RateLimiter(),
          diffEngine: new DiffEngine({ sheetsApi: this.googleClient.sheets }),
          policyEnforcer: new PolicyEnforcer(),
          snapshotService: new SnapshotService({ driveApi: this.googleClient.drive }),
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
        auth: {
          hasElevatedAccess: this.googleClient.hasElevatedAccess,
          scopes: this.googleClient.scopes,
        },
        samplingServer: this._server.server, // Pass underlying Server instance for sampling
        requestDeduplicator, // Pass request deduplicator for preventing duplicate API calls
      };

      this.handlers = createHandlers({
        context: this.context,
        sheetsApi: this.googleClient.sheets,
        driveApi: this.googleClient.drive,
      });
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

    // Start cache cleanup task
    cacheManager.startCleanupTask();
  }

  /**
   * Register all 15 tools with proper annotations
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
          extra: { sendNotification: (n: unknown) => Promise<void>; requestInfo?: { _meta?: { progressToken?: string | number } } }
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
          const progressToken = extra.requestInfo?._meta?.progressToken;
          return this.handleToolCall(tool.name, args, {
            sendNotification: extra.sendNotification as (n: import('@modelcontextprotocol/sdk/types.js').ServerNotification) => Promise<void>,
            progressToken,
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

        const taskStore = extra.taskStore;
        void (async () => {
          try {
            const result = await this.handleToolCall(toolName, args as Record<string, unknown>);
            await taskStore.storeTaskResult(task.taskId, 'completed', result);
          } catch (error) {
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
              await taskStore.storeTaskResult(task.taskId, 'failed', errorResult);
            } catch (storeError) {
              baseLogger.error('Failed to store task result', { toolName, storeError });
            }
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
   * Handle a tool call - routes to appropriate handler
   */
  private async handleToolCall(
    toolName: string,
    args: Record<string, unknown>,
    extra?: {
      sendNotification?: (notification: import('@modelcontextprotocol/sdk/types.js').ServerNotification) => Promise<void>;
      progressToken?: string | number;
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

          // Route to appropriate handler
          const handlerMap = createToolHandlerMap(this.handlers, this.authHandler ?? undefined);

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

          const result = await handler(args);
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
  }

  /**
   * Register prompts
   */
  private registerPrompts(): void {
    registerServalSheetsPrompts(this._server);
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
    await this.initialize();
    const transport = new StdioServerTransport();
    
    // Handle process signals for graceful shutdown
    const handleShutdown = async (signal: string) => {
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
    
    await this._server.connect(transport);
    baseLogger.info(`ServalSheets MCP Server started (${TOOL_COUNT} tools, ${ACTION_COUNT} actions)`);
  }

  /**
   * Get server info
   */
  getInfo(): { name: string; version: string; tools: number; actions: number } {
    return {
      name: this.options.name ?? 'servalsheets',
      version: this.options.version ?? '1.2.0',
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

  const server = new ServalSheetsServer(options);
  await server.start();
  return server;
}
