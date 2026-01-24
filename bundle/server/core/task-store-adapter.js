/**
 * ServalSheets - Task Store Adapter
 *
 * Adapter that bridges SDK TaskStore interface with custom InMemoryTaskStore
 * Handles parameter mapping and type conversions while preserving custom features
 *
 * MCP Protocol: 2025-11-25 (SEP-1686)
 */
import { InMemoryTaskStore } from './task-store.js';
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
export class TaskStoreAdapter {
    store;
    constructor(store) {
        // Use provided store or create default InMemoryTaskStore
        this.store = store ?? new InMemoryTaskStore();
    }
    /**
     * SDK TaskStore.createTask - Maps to custom createTask
     *
     * Ignores requestId, request, sessionId (not used by custom store)
     * Extracts ttl from taskParams
     */
    async createTask(taskParams, _requestId, _request, _sessionId) {
        // Map CreateTaskOptions to custom options
        const customOptions = {
            ttl: taskParams.ttl === null ? undefined : taskParams.ttl,
        };
        const customTask = await this.store.createTask(customOptions);
        // Custom Task structure is compatible with SDK Task
        return customTask;
    }
    /**
     * SDK TaskStore.getTask - Direct delegation
     */
    async getTask(taskId, _sessionId) {
        const customTask = await this.store.getTask(taskId);
        return customTask;
    }
    /**
     * SDK TaskStore.storeTaskResult - Maps Result to CallToolResult
     */
    async storeTaskResult(taskId, status, result, _sessionId) {
        // Result and CallToolResult are structurally compatible
        // Both have: content: Content[], isError?: boolean
        // Use type assertion since structures are compatible
        await this.store.storeTaskResult(taskId, status, result);
    }
    /**
     * SDK TaskStore.getTaskResult - Maps TaskResult to Result
     */
    async getTaskResult(taskId, _sessionId) {
        const taskResult = await this.store.getTaskResult(taskId);
        if (!taskResult) {
            throw new Error(`No result found for task ${taskId}`);
        }
        // TaskResult.result (CallToolResult) is compatible with Result
        return taskResult.result;
    }
    /**
     * SDK TaskStore.updateTaskStatus - Detects cancellation and triggers cancelTask
     */
    async updateTaskStatus(taskId, status, statusMessage, _sessionId) {
        // SDK Task['status'] includes same values as custom TaskStatus
        // 'working' | 'input_required' | 'completed' | 'failed' | 'cancelled'
        // When status is 'cancelled', call cancelTask to properly set cancellation flags
        // This ensures isTaskCancelled() returns true and abort signals can be triggered
        if (status === 'cancelled') {
            await this.cancelTask(taskId, statusMessage || 'Task cancelled');
        }
        else {
            await this.store.updateTaskStatus(taskId, status, statusMessage);
        }
    }
    /**
     * SDK TaskStore.listTasks - Implements pagination
     *
     * Uses getAllTasks() and implements cursor-based pagination
     * Cursor format: base64-encoded offset number
     */
    async listTasks(cursor, _sessionId) {
        const PAGE_SIZE = 50;
        // Decode cursor to get offset
        const offset = cursor ? parseInt(Buffer.from(cursor, 'base64').toString('utf-8'), 10) : 0;
        // Get all tasks (already sorted by creation time, newest first)
        const allTasks = await this.store.getAllTasks();
        // Slice for pagination
        const tasks = allTasks.slice(offset, offset + PAGE_SIZE);
        // Generate next cursor if more tasks exist
        const nextCursor = offset + PAGE_SIZE < allTasks.length
            ? Buffer.from((offset + PAGE_SIZE).toString(), 'utf-8').toString('base64')
            : undefined;
        return {
            tasks: tasks,
            nextCursor,
        };
    }
    /**
     * Cancel a running task
     */
    async cancelTask(taskId, reason) {
        return this.store.cancelTask(taskId, reason);
    }
    /**
     * Check if task was cancelled
     */
    async isTaskCancelled(taskId) {
        return this.store.isTaskCancelled(taskId);
    }
    /**
     * Get cancellation reason if any
     */
    async getCancellationReason(taskId) {
        return this.store.getCancellationReason(taskId);
    }
    /**
     * Get underlying custom task store (for tests and advanced usage)
     */
    getUnderlyingStore() {
        return this.store;
    }
    /**
     * Cleanup and dispose resources
     */
    dispose() {
        if (this.store instanceof InMemoryTaskStore) {
            this.store.dispose();
        }
    }
}
//# sourceMappingURL=task-store-adapter.js.map