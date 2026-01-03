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
  createdAt: string;  // ISO 8601
  lastUpdatedAt: string;  // ISO 8601
  ttl: number;  // milliseconds
  pollInterval?: number;  // milliseconds
}

export interface TaskResult {
  result: CallToolResult;
  status: 'completed' | 'failed';
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
  createTask(options: { ttl?: number }): Promise<Task>;
  getTask(taskId: string): Promise<Task | null>;
  updateTaskStatus(taskId: string, status: TaskStatus, message?: string): Promise<void>;
  storeTaskResult(taskId: string, status: 'completed' | 'failed', result: CallToolResult): Promise<void>;
  getTaskResult(taskId: string): Promise<TaskResult | null>;
  deleteTask(taskId: string): Promise<void>;
  cleanupExpiredTasks(): Promise<number>;
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
export class InMemoryTaskStore implements TaskStore {
  private tasks = new Map<string, Task>();
  private results = new Map<string, TaskResult>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(cleanupIntervalMs: number = 60000) {
    // Cleanup expired tasks periodically
    this.cleanupInterval = setInterval(() => {
      void this.cleanupExpiredTasks();
    }, cleanupIntervalMs);
  }

  /**
   * Create a new task
   *
   * @param options.ttl - Time to live in milliseconds (default: 1 hour)
   * @returns Task with unique ID and working status
   */
  async createTask(options: { ttl?: number } = {}): Promise<Task> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const now = new Date().toISOString();
    const ttl = options.ttl ?? 3600000; // Default 1 hour

    const task: Task = {
      taskId,
      status: 'working',
      createdAt: now,
      lastUpdatedAt: now,
      ttl,
      pollInterval: 5000, // Suggest 5 second polling
    };

    this.tasks.set(taskId, task);
    return task;
  }

  /**
   * Get task by ID
   *
   * @param taskId - Task identifier
   * @returns Task or null if not found/expired
   */
  async getTask(taskId: string): Promise<Task | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    // Check if expired
    const expiresAt = new Date(task.createdAt).getTime() + task.ttl;
    if (Date.now() > expiresAt) {
      await this.deleteTask(taskId);
      return null;
    }

    return task;
  }

  /**
   * Update task status and message
   *
   * @param taskId - Task identifier
   * @param status - New status
   * @param message - Optional human-readable status message
   */
  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    message?: string
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.status = status;
    task.statusMessage = message;
    task.lastUpdatedAt = new Date().toISOString();

    this.tasks.set(taskId, task);
  }

  /**
   * Store task result (terminal state)
   *
   * @param taskId - Task identifier
   * @param status - 'completed' or 'failed'
   * @param result - Tool result to return to client
   */
  async storeTaskResult(
    taskId: string,
    status: 'completed' | 'failed',
    result: CallToolResult
  ): Promise<void> {
    // Update task status to terminal state
    await this.updateTaskStatus(taskId, status);

    // Store result
    this.results.set(taskId, { result, status });
  }

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
  async getTaskResult(taskId: string): Promise<TaskResult | null> {
    return this.results.get(taskId) ?? null;
  }

  /**
   * Delete task and its result
   *
   * @param taskId - Task identifier
   */
  async deleteTask(taskId: string): Promise<void> {
    this.tasks.delete(taskId);
    this.results.delete(taskId);
  }

  /**
   * Clean up expired tasks
   *
   * Called automatically on interval, but can be called manually
   *
   * @returns Number of tasks cleaned up
   */
  async cleanupExpiredTasks(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [taskId, task] of this.tasks.entries()) {
      const expiresAt = new Date(task.createdAt).getTime() + task.ttl;
      if (now > expiresAt) {
        await this.deleteTask(taskId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Stop cleanup interval and clear all tasks
   */
  dispose(): void {
    clearInterval(this.cleanupInterval);
    this.tasks.clear();
    this.results.clear();
  }

  /**
   * Get all active tasks (for debugging/monitoring)
   *
   * @returns Array of all non-expired tasks
   */
  async getAllTasks(): Promise<Task[]> {
    const now = Date.now();
    const activeTasks: Task[] = [];

    for (const task of this.tasks.values()) {
      const expiresAt = new Date(task.createdAt).getTime() + task.ttl;
      if (now <= expiresAt) {
        activeTasks.push(task);
      }
    }

    return activeTasks;
  }

  /**
   * Get task count by status (for monitoring)
   *
   * @returns Object with count per status
   */
  async getTaskStats(): Promise<Record<TaskStatus, number>> {
    const stats: Record<TaskStatus, number> = {
      working: 0,
      input_required: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const task of this.tasks.values()) {
      stats[task.status]++;
    }

    return stats;
  }
}

/**
 * Redis-backed task store (placeholder for production)
 *
 * Implementation notes:
 * - Use Redis hashes for task metadata
 * - Use Redis strings for task results (with JSON serialization)
 * - Use Redis TTL for automatic expiration
 * - Use Redis pub/sub for task status notifications
 *
 * Example:
 * - Key: tasks:{taskId} → hash with status, createdAt, etc.
 * - Key: task_results:{taskId} → JSON string of CallToolResult
 * - Channel: task_status:{taskId} → publish status updates
 */
export class RedisTaskStore implements TaskStore {
  constructor(/* redisClient: Redis */) {
    throw new Error('RedisTaskStore not yet implemented - use InMemoryTaskStore');
  }

  async createTask(_options: { ttl?: number }): Promise<Task> {
    throw new Error('Not implemented');
  }

  async getTask(_taskId: string): Promise<Task | null> {
    throw new Error('Not implemented');
  }

  async updateTaskStatus(_taskId: string, _status: TaskStatus, _message?: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async storeTaskResult(_taskId: string, _status: 'completed' | 'failed', _result: CallToolResult): Promise<void> {
    throw new Error('Not implemented');
  }

  async getTaskResult(_taskId: string): Promise<TaskResult | null> {
    throw new Error('Not implemented');
  }

  async deleteTask(_taskId: string): Promise<void> {
    throw new Error('Not implemented');
  }

  async cleanupExpiredTasks(): Promise<number> {
    throw new Error('Not implemented');
  }
}
