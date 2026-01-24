/**
 * ServalSheets - MCP Server
 *
 * Main server class that registers all tools and resources
 * MCP Protocol: 2025-11-25
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TaskStoreAdapter } from './core/index.js';
import type { GoogleApiClientOptions } from './services/google-api.js';
export interface ServalSheetsServerOptions {
    name?: string;
    version?: string;
    googleApiOptions?: GoogleApiClientOptions;
    taskStore?: TaskStoreAdapter;
}
/**
 * ServalSheets MCP Server
 */
export declare class ServalSheetsServer {
    private _server;
    private googleClient;
    private authHandler;
    private options;
    private isShutdown;
    private handlers;
    private context;
    private requestQueue;
    private taskStore;
    private taskAbortControllers;
    constructor(options?: ServalSheetsServerOptions);
    /**
     * Initialize the server
     */
    initialize(): Promise<void>;
    /**
     * Register all 16 tools with proper annotations
     */
    private registerTools;
    private createToolTaskHandler;
    /**
     * Cancel a running task
     *
     * Marks the task as cancelled in the task store and aborts the operation
     * if it's currently running.
     *
     * @param taskId - Task identifier
     * @param taskStore - Task store instance
     */
    private handleTaskCancel;
    /**
     * Handle a tool call - routes to appropriate handler
     */
    private handleToolCall;
    /**
     * Register resources
     */
    private registerResources;
    /**
     * Register prompts
     */
    private registerPrompts;
    /**
     * Register task cancellation handler
     *
     * Enables clients to cancel long-running tasks via the tasks/cancel request.
     * SEP-1686: Task-based execution support
     */
    private registerTaskCancelHandler;
    /**
     * Register logging handler for dynamic log level control
     *
     * Enables clients to adjust server log verbosity via logging/setLevel request.
     */
    private registerLogging;
    /**
     * Graceful shutdown
     */
    shutdown(): Promise<void>;
    /**
     * Get underlying MCP server instance (for testing and advanced usage)
     */
    get server(): McpServer;
    /**
     * Start the server with signal handling
     */
    start(): Promise<void>;
    /**
     * Get server info
     */
    getInfo(): {
        name: string;
        version: string;
        tools: number;
        actions: number;
    };
    /**
     * Check if server is healthy
     */
    isHealthy(): boolean;
}
/**
 * Create and start a ServalSheets server
 *
 * Automatically selects RedisTaskStore if REDIS_URL is set, otherwise InMemoryTaskStore.
 * For production deployments with multiple instances, set REDIS_URL for shared task state.
 */
export declare function createServalSheetsServer(options?: ServalSheetsServerOptions): Promise<ServalSheetsServer>;
//# sourceMappingURL=server.d.ts.map