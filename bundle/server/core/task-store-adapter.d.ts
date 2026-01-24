/**
 * ServalSheets - Task Store Adapter
 *
 * Adapter that bridges SDK TaskStore interface with custom InMemoryTaskStore
 * Handles parameter mapping and type conversions while preserving custom features
 *
 * MCP Protocol: 2025-11-25 (SEP-1686)
 */
import type { Task, RequestId, Result, Request } from '@modelcontextprotocol/sdk/types.js';
import type { TaskStore as SDKTaskStore, CreateTaskOptions } from '@modelcontextprotocol/sdk/experimental/tasks/interfaces.js';
import type { TaskStore as CustomTaskStore } from './task-store.js';
/**
 * Adapter that implements SDK TaskStore interface and delegates to custom InMemoryTaskStore
 *
 * Type Mappings:
 * - SDK Task ↔ Custom Task (structures are compatible)
 * - SDK Result ↔ Custom CallToolResult (both have content/isError)
 * - SDK CreateTaskOptions ↔ Custom { ttl?: number }
 *
 * Parameter Handling:
 * - Ignores requestId/request/sessionId (not needed by custom store)
 * - Extracts ttl from CreateTaskOptions
 * - Maps status between SDK and custom types
 */
export declare class TaskStoreAdapter implements SDKTaskStore {
    private store;
    constructor(store?: CustomTaskStore);
    /**
     * SDK TaskStore.createTask - Maps to custom createTask
     *
     * Ignores requestId, request, sessionId (not used by custom store)
     * Extracts ttl from taskParams
     */
    createTask(taskParams: CreateTaskOptions, _requestId: RequestId, _request: Request, _sessionId?: string): Promise<Task>;
    /**
     * SDK TaskStore.getTask - Direct delegation
     */
    getTask(taskId: string, _sessionId?: string): Promise<Task | null>;
    /**
     * SDK TaskStore.storeTaskResult - Maps Result to CallToolResult
     */
    storeTaskResult(taskId: string, status: 'completed' | 'failed' | 'cancelled', result: Result, _sessionId?: string): Promise<void>;
    /**
     * SDK TaskStore.getTaskResult - Maps TaskResult to Result
     */
    getTaskResult(taskId: string, _sessionId?: string): Promise<Result>;
    /**
     * SDK TaskStore.updateTaskStatus - Detects cancellation and triggers cancelTask
     */
    updateTaskStatus(taskId: string, status: Task['status'], statusMessage?: string, _sessionId?: string): Promise<void>;
    /**
     * SDK TaskStore.listTasks - Implements pagination
     *
     * Uses getAllTasks() and implements cursor-based pagination
     * Cursor format: base64-encoded offset number
     */
    listTasks(cursor?: string, _sessionId?: string): Promise<{
        tasks: Task[];
        nextCursor?: string;
    }>;
    /**
     * Cancel a running task
     */
    cancelTask(taskId: string, reason?: string): Promise<void>;
    /**
     * Check if task was cancelled
     */
    isTaskCancelled(taskId: string): Promise<boolean>;
    /**
     * Get cancellation reason if any
     */
    getCancellationReason(taskId: string): Promise<string | null>;
    /**
     * Get underlying custom task store (for tests and advanced usage)
     */
    getUnderlyingStore(): CustomTaskStore;
    /**
     * Cleanup and dispose resources
     */
    dispose(): void;
}
//# sourceMappingURL=task-store-adapter.d.ts.map