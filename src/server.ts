/**
 * ServalSheets - MCP Server
 * 
 * Main server class that registers all tools and resources
 * MCP Protocol: 2025-11-25
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { TOOL_COUNT, ACTION_COUNT } from './schemas/index.js';

import {
  BatchCompiler,
  RateLimiter,
  DiffEngine,
  PolicyEnforcer,
  RangeResolver,
} from './core/index.js';

import { SnapshotService, GoogleApiClient, createGoogleApiClient } from './services/index.js';
import type { GoogleApiClientOptions } from './services/google-api.js';
import { createHandlers, type HandlerContext, type Handlers } from './handlers/index.js';
import { logger as baseLogger } from './utils/logger.js';
import { createRequestContext, runWithRequestContext } from './utils/request-context.js';
import {
  TOOL_DEFINITIONS,
  createToolHandlerMap,
  buildToolResponse,
  registerServalSheetsResources,
  registerServalSheetsPrompts,
} from './mcp/registration.js';
import { registerKnowledgeResources } from './resources/knowledge.js';

export interface ServalSheetsServerOptions {
  name?: string;
  version?: string;
  googleApiOptions?: GoogleApiClientOptions;
}

/**
 * ServalSheets MCP Server
 */
export class ServalSheetsServer {
  private server: McpServer;
  private googleClient: GoogleApiClient | null = null;
  private options: ServalSheetsServerOptions;
  private isShutdown = false;
  private handlers: Handlers | null = null;
  private context: HandlerContext | null = null;

  constructor(options: ServalSheetsServerOptions = {}) {
    this.options = options;
    this.server = new McpServer({
      name: options.name ?? 'servalsheets',
      version: options.version ?? '4.0.0',
    });
  }

  /**
   * Initialize the server
   */
  async initialize(): Promise<void> {
    // Initialize Google API client
    if (this.options.googleApiOptions) {
      this.googleClient = await createGoogleApiClient(this.options.googleApiOptions);
      
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
      };

      this.handlers = createHandlers({
        context: this.context,
        sheetsApi: this.googleClient.sheets,
        driveApi: this.googleClient.drive,
      });
    }

    // Register all tools
    this.registerTools();
    
    // Register resources
    this.registerResources();
    
    // Register prompts
    this.registerPrompts();
  }

  /**
   * Register all 15 tools with proper annotations
   */
  private registerTools(): void {
    for (const tool of TOOL_DEFINITIONS) {
      this.server.registerTool(
        tool.name,
        {
          title: tool.annotations.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          annotations: tool.annotations,
        },
        async (args: Record<string, unknown>) => {
          return this.handleToolCall(tool.name, args);
        }
      );
    }
  }

  /**
   * Handle a tool call - routes to appropriate handler
   */
  private async handleToolCall(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<CallToolResult> {
    const requestContext = createRequestContext();
    return runWithRequestContext(requestContext, async () => {
      const logger = requestContext.logger;

      // Check if shutting down
      if (this.isShutdown) {
        return buildToolResponse({
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Server is shutting down',
              retryable: false,
            },
        });
      }

      try {
        if (!this.googleClient || !this.handlers) {
          return buildToolResponse({
              success: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Google API client not initialized. Please provide credentials.',
                retryable: false,
                suggestedFix: 'Set GOOGLE_APPLICATION_CREDENTIALS or provide --service-account flag',
              },
          });
        }

        // Route to appropriate handler
        const handlerMap = createToolHandlerMap(this.handlers);

        const handler = handlerMap[toolName];
        if (!handler) {
        return buildToolResponse({
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
          });
        }

        const result = await handler(args);
        if (typeof result === 'object' && result !== null && 'success' in result && result['success'] === false) {
          logger.warn('Tool call failed', {
            tool: toolName,
            error: (result as { error?: unknown }).error,
          });
        }
        return buildToolResponse(result);
      } catch (error) {
        logger.error('Tool call threw exception', { tool: toolName, error });
        return buildToolResponse({
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: error instanceof Error ? error.message : String(error),
              retryable: false,
            },
        });
      }
    });
  }

  /**
   * Register resources
   */
  private registerResources(): void {
    registerServalSheetsResources(this.server, this.googleClient);
    
    // Register embedded knowledge resources
    registerKnowledgeResources(this.server);
  }

  /**
   * Register prompts
   */
  private registerPrompts(): void {
    registerServalSheetsPrompts(this.server);
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShutdown) return;
    this.isShutdown = true;
    
    baseLogger.info('ServalSheets: Shutting down...');
    
    // Clear range resolver cache
    if (this.context?.rangeResolver) {
      this.context.rangeResolver.clearCache();
    }
    
    // Clear references
    this.googleClient = null;
    this.handlers = null;
    this.context = null;
    
    baseLogger.info('ServalSheets: Shutdown complete');
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
    
    await this.server.connect(transport);
    baseLogger.info(`ServalSheets MCP Server started (${TOOL_COUNT} tools, ${ACTION_COUNT} actions)`);
  }

  /**
   * Get server info
   */
  getInfo(): { name: string; version: string; tools: number; actions: number } {
    return {
      name: this.options.name ?? 'servalsheets',
      version: this.options.version ?? '4.0.0',
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
 */
export async function createServalSheetsServer(
  options: ServalSheetsServerOptions = {}
): Promise<ServalSheetsServer> {
  const server = new ServalSheetsServer(options);
  await server.start();
  return server;
}
