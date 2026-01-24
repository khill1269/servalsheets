/**
 * TaskManager
 *
 * @purpose Manages async task lifecycle with progress tracking, cancellation, cleanup; higher-level abstraction over MCP task store (SEP-1686)
 * @category Infrastructure
 * @usage Use for long-running operations (bulk updates, analysis); tracks progress, allows cancellation, automatic cleanup after completion
 * @dependencies logger
 * @stateful Yes - maintains active tasks map (taskId → state), progress updates, completion timestamps
 * @singleton Yes - one instance per process to coordinate task lifecycle globally
 *
 * @example
 * const taskMgr = new TaskManager();
 * const taskId = await taskMgr.create({ name: 'Bulk Update', totalSteps: 100 });
 * await taskMgr.updateProgress(taskId, 50, 'Processed 50 rows');
 * await taskMgr.complete(taskId, { updated: 100 });
 * // Auto-cleanup after 1 hour
 */
/**
 * Task status states
 */
export type ManagedTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
/**
 * Task metadata provided when registering a task
 */
export interface TaskMetadata {
    /** Operation name (e.g., 'spreadsheets.update') */
    operation: string;
    /** Spreadsheet ID if applicable */
    spreadsheetId?: string;
    /** Task start time */
    startTime: number;
    /** Additional metadata */
    [key: string]: unknown;
}
/**
 * Task information managed by TaskManager
 */
export interface ManagedTaskInfo {
    /** Unique task identifier */
    taskId: string;
    /** Current status */
    status: ManagedTaskStatus;
    /** Progress percentage (0-100) */
    progress?: number;
    /** Human-readable progress message */
    progressMessage?: string;
    /** Task result when completed */
    result?: unknown;
    /** Error message when failed */
    error?: string;
    /** Task metadata */
    metadata: TaskMetadata;
    /** Start timestamp */
    startTime: number;
    /** End timestamp (when terminal state reached) */
    endTime?: number;
}
/**
 * Task manager options
 */
export interface TaskManagerOptions {
    /** How long to keep completed tasks (ms). Default: 1 hour */
    taskTTL?: number;
    /** Maximum concurrent tasks. Default: 100 */
    maxTasks?: number;
    /** Cleanup interval (ms). Default: 60 seconds */
    cleanupIntervalMs?: number;
}
/**
 * TaskManager - Manages async task lifecycle for MCP operations
 *
 * Features:
 * - Task registration and lifecycle tracking
 * - Progress updates with percentage and messages
 * - Task cancellation support
 * - Automatic cleanup of old completed tasks
 * - Concurrent task limit enforcement
 *
 * Usage:
 * ```typescript
 * const taskManager = new TaskManager({ taskTTL: 3600000, maxTasks: 100 });
 *
 * // Register task
 * const taskId = 'task-123';
 * taskManager.registerTask(taskId, {
 *   operation: 'spreadsheets.batchUpdate',
 *   spreadsheetId: 'abc123',
 *   startTime: Date.now(),
 * });
 *
 * // Update progress
 * taskManager.updateTaskProgress(taskId, 50, 'Processing rows...');
 *
 * // Complete task
 * taskManager.completeTask(taskId, { updatedCells: 100 });
 *
 * // Cleanup
 * taskManager.destroy();
 * ```
 */
export declare class TaskManager {
    private tasks;
    private cleanupInterval;
    private options;
    constructor(options?: TaskManagerOptions);
    /**
     * Register a new task
     *
     * @param taskId - Unique task identifier
     * @param metadata - Task metadata
     * @throws Error if max tasks limit reached
     */
    registerTask(taskId: string, metadata: TaskMetadata): void;
    /**
     * Update task progress
     *
     * Automatically transitions task from 'pending' to 'running' if needed.
     *
     * @param taskId - Task identifier
     * @param progress - Progress percentage (0-100)
     * @param progressMessage - Optional human-readable status message
     * @throws Error if task not found
     */
    updateTaskProgress(taskId: string, progress: number, progressMessage?: string): void;
    /**
     * Mark task as complete
     *
     * @param taskId - Task identifier
     * @param result - Optional result data
     * @throws Error if task not found
     */
    completeTask(taskId: string, result?: unknown): void;
    /**
     * Mark task as failed
     *
     * @param taskId - Task identifier
     * @param error - Error object or message
     * @throws Error if task not found
     */
    failTask(taskId: string, error: Error | string): void;
    /**
     * Cancel a task
     *
     * Can only cancel pending or running tasks.
     * Returns true if cancelled, false if already in terminal state.
     *
     * @param taskId - Task identifier
     * @returns true if task was cancelled, false if already completed/failed
     * @throws Error if task not found
     */
    cancelTask(taskId: string): boolean;
    /**
     * Get task status
     *
     * @param taskId - Task identifier
     * @returns Task status or undefined if not found
     */
    getTaskStatus(taskId: string): ManagedTaskInfo | undefined;
    /**
     * List all active tasks
     *
     * Returns tasks that are pending or running (not in terminal state).
     *
     * @returns Array of active task statuses
     */
    listActiveTasks(): ManagedTaskInfo[];
    /**
     * Get all tasks (including completed/failed)
     *
     * @returns Array of all task statuses
     */
    getAllTasks(): ManagedTaskInfo[];
    /**
     * Cleanup completed tasks older than TTL
     *
     * Removes tasks in terminal states (completed/failed/cancelled) that have
     * exceeded the configured TTL since their end time.
     *
     * @returns Number of tasks cleaned up
     */
    private cleanupCompletedTasks;
    /**
     * Start automatic cleanup interval
     *
     * @param intervalMs - Cleanup interval in milliseconds (default: from options)
     */
    startCleanup(intervalMs?: number): void;
    /**
     * Stop automatic cleanup interval
     */
    stopCleanup(): void;
    /**
     * Get task statistics
     *
     * @returns Statistics about tasks by status
     */
    getStatistics(): {
        total: number;
        pending: number;
        running: number;
        completed: number;
        failed: number;
        cancelled: number;
    };
    /**
     * Destroy task manager
     *
     * Stops cleanup interval and clears all tasks.
     */
    destroy(): void;
}
//# sourceMappingURL=task-manager.d.ts.map