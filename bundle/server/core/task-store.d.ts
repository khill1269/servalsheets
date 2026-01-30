/**
 * ServalSheets - Task Store
 *
 * Implementation of MCP task-based execution (SEP-1686)
 * Supports: working → input_required → completed/failed/cancelled
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
export type TaskStatus = 'working' | 'input_required' | 'completed' | 'failed' | 'cancelled';
export interface Task {
    taskId: string;
    status: TaskStatus;
    statusMessage?: string;
    createdAt: string;
    lastUpdatedAt: string;
    ttl: number;
    pollInterval?: number;
}
export interface TaskResult {
    result: CallToolResult;
    status: 'completed' | 'failed' | 'cancelled';
}
/**
 * Task store interface for MCP task system
 *
 * MCP Spec Reference: SEP-1686 (experimental)
 * - Tasks have lifecycle: working → input_required → completed/failed/cancelled
 * - TTL determines retention after creation
 * - Poll interval suggests client polling frequency
 */
export interface TaskStore {
    createTask(options: {
        ttl?: number;
    }): Promise<Task>;
    getTask(taskId: string): Promise<Task | null>;
    updateTaskStatus(taskId: string, status: TaskStatus, message?: string): Promise<void>;
    storeTaskResult(taskId: string, status: 'completed' | 'failed' | 'cancelled', result: CallToolResult): Promise<void>;
    getTaskResult(taskId: string): Promise<TaskResult | null>;
    deleteTask(taskId: string): Promise<void>;
    cleanupExpiredTasks(): Promise<number>;
    getAllTasks(): Promise<Task[]>;
    /**
     * Cancel a running task
     * @param taskId - Task identifier
     * @param reason - Optional reason for cancellation
     */
    cancelTask(taskId: string, reason?: string): Promise<void>;
    /**
     * Check if task was cancelled
     * @param taskId - Task identifier
     * @returns true if task was cancelled
     */
    isTaskCancelled(taskId: string): Promise<boolean>;
    /**
     * Get cancellation reason if any
     * @param taskId - Task identifier
     * @returns Cancellation reason or null
     */
    getCancellationReason(taskId: string): Promise<string | null>;
}
/**
 * In-memory task store implementation
 *
 * Suitable for:
 * - Single-process deployments
 * - Development/testing
 *
 * For multi-node production:
 * - Implement Redis-backed store
 * - Share task state across instances
 * - Enable horizontal scaling
 */
export declare class InMemoryTaskStore implements TaskStore {
    private tasks;
    private results;
    private cancelledTasks;
    private cleanupInterval;
    constructor(cleanupIntervalMs?: number);
    /**
     * Create a new task
     *
     * @param options.ttl - Time to live in milliseconds (default: 1 hour)
     * @returns Task with unique ID and working status
     */
    createTask(options?: {
        ttl?: number;
    }): Promise<Task>;
    /**
     * Get task by ID
     *
     * @param taskId - Task identifier
     * @returns Task or null if not found/expired
     */
    getTask(taskId: string): Promise<Task | null>;
    /**
     * Update task status and message
     *
     * @param taskId - Task identifier
     * @param status - New status
     * @param message - Optional human-readable status message
     */
    updateTaskStatus(taskId: string, status: TaskStatus, message?: string): Promise<void>;
    /**
     * Store task result (terminal state)
     *
     * @param taskId - Task identifier
     * @param status - 'completed', 'failed', or 'cancelled'
     * @param result - Tool result to return to client
     */
    storeTaskResult(taskId: string, status: 'completed' | 'failed' | 'cancelled', result: CallToolResult): Promise<void>;
    /**
     * Get task result (blocks until terminal status)
     *
     * MCP Spec: tasks/result SHOULD block until terminal status
     * This implementation returns immediately if result exists, null otherwise
     *
     * For true blocking behavior, implement polling in the caller
     *
     * @param taskId - Task identifier
     * @returns Task result or null if not yet available
     */
    getTaskResult(taskId: string): Promise<TaskResult | null>;
    /**
     * Delete task and its result
     *
     * @param taskId - Task identifier
     */
    deleteTask(taskId: string): Promise<void>;
    /**
     * Clean up expired tasks
     *
     * Called automatically on interval, but can be called manually
     *
     * @returns Number of tasks cleaned up
     */
    cleanupExpiredTasks(): Promise<number>;
    /**
     * Stop cleanup interval and clear all tasks
     */
    dispose(): void;
    /**
     * Get all active tasks (for debugging/monitoring)
     *
     * Returns tasks sorted by creation time (newest first)
     *
     * @returns Array of all non-expired tasks, sorted newest first
     */
    getAllTasks(): Promise<Task[]>;
    /**
     * Get task count by status (for monitoring)
     *
     * @returns Object with count per status
     */
    getTaskStats(): Promise<Record<TaskStatus, number>>;
    /**
     * Cancel a running task
     *
     * @param taskId - Task identifier
     * @param reason - Optional reason for cancellation
     */
    cancelTask(taskId: string, reason?: string): Promise<void>;
    /**
     * Check if task was cancelled
     *
     * @param taskId - Task identifier
     * @returns true if task was cancelled
     */
    isTaskCancelled(taskId: string): Promise<boolean>;
    /**
     * Get cancellation reason if any
     *
     * @param taskId - Task identifier
     * @returns Cancellation reason or null
     */
    getCancellationReason(taskId: string): Promise<string | null>;
}
/**
 * Redis-backed task store for production use
 *
 * Features:
 * - Distributed task state across multiple instances
 * - Automatic TTL-based expiration
 * - Horizontal scaling support
 * - Persistent task history
 *
 * Implementation:
 * - Redis hashes for task metadata (tasks:{taskId})
 * - Redis strings for task results (task_results:{taskId})
 * - Redis TTL for automatic expiration
 * - Redis SCAN for efficient task listing
 */
export declare class RedisTaskStore implements TaskStore {
    private redisUrl;
    private client;
    private connected;
    private keyPrefix;
    constructor(redisUrl: string, keyPrefix?: string);
    /**
     * Initialize Redis connection (lazy)
     */
    private ensureConnected;
    private getTaskKey;
    private getResultKey;
    /**
     * Create a new task
     */
    createTask(options?: {
        ttl?: number;
    }): Promise<Task>;
    /**
     * Get task by ID
     */
    getTask(taskId: string): Promise<Task | null>;
    /**
     * Update task status and message
     */
    updateTaskStatus(taskId: string, status: TaskStatus, message?: string): Promise<void>;
    /**
     * Store task result (terminal state)
     */
    storeTaskResult(taskId: string, status: 'completed' | 'failed' | 'cancelled', result: CallToolResult): Promise<void>;
    /**
     * Get task result
     */
    getTaskResult(taskId: string): Promise<TaskResult | null>;
    /**
     * Delete task and its result
     */
    deleteTask(taskId: string): Promise<void>;
    /**
     * Clean up expired tasks
     *
     * Note: Redis handles TTL automatically, but this provides
     * explicit cleanup for monitoring purposes
     */
    cleanupExpiredTasks(): Promise<number>;
    /**
     * Get all active tasks
     */
    getAllTasks(): Promise<Task[]>;
    /**
     * Disconnect from Redis
     */
    disconnect(): Promise<void>;
    /**
     * Get task count by status (for monitoring)
     */
    getTaskStats(): Promise<Record<TaskStatus, number>>;
    /**
     * Cancel a running task
     *
     * @param taskId - Task identifier
     * @param reason - Optional reason for cancellation
     */
    cancelTask(taskId: string, reason?: string): Promise<void>;
    /**
     * Check if task was cancelled
     *
     * @param taskId - Task identifier
     * @returns true if task was cancelled
     */
    isTaskCancelled(taskId: string): Promise<boolean>;
    /**
     * Get cancellation reason if any
     *
     * @param taskId - Task identifier
     * @returns Cancellation reason or null
     */
    getCancellationReason(taskId: string): Promise<string | null>;
}
//# sourceMappingURL=task-store.d.ts.map