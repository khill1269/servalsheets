/**
 * ServalSheets - Task Store
 *
 * Implementation of MCP task-based execution (SEP-1686)
 * Supports: working → input_required → completed/failed/cancelled
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../utils/logger.js";

export type TaskStatus =
  | "working"
  | "input_required"
  | "completed"
  | "failed"
  | "cancelled";

export interface Task {
  taskId: string;
  status: TaskStatus;
  statusMessage?: string;
  createdAt: string; // ISO 8601
  lastUpdatedAt: string; // ISO 8601
  ttl: number; // milliseconds
  pollInterval?: number; // milliseconds
}

export interface TaskResult {
  result: CallToolResult;
  status: "completed" | "failed" | "cancelled";
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
  updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    message?: string,
  ): Promise<void>;
  storeTaskResult(
    taskId: string,
    status: "completed" | "failed" | "cancelled",
    result: CallToolResult,
  ): Promise<void>;
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
export class InMemoryTaskStore implements TaskStore {
  private tasks = new Map<string, Task>();
  private results = new Map<string, TaskResult>();
  private cancelledTasks = new Map<string, string>(); // taskId -> reason
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
      status: "working",
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
    message?: string,
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
   * @param status - 'completed', 'failed', or 'cancelled'
   * @param result - Tool result to return to client
   */
  async storeTaskResult(
    taskId: string,
    status: "completed" | "failed" | "cancelled",
    result: CallToolResult,
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
   * Returns tasks sorted by creation time (newest first)
   *
   * @returns Array of all non-expired tasks, sorted newest first
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

    // Sort by creation time, newest first
    activeTasks.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA;
    });

    return activeTasks;
  }

  /**
   * Get task count by status (for monitoring)
   *
   * @returns Object with count per status
   */
  async getTaskStats(): Promise<Record<TaskStatus, number>> {
    await this.cleanupExpiredTasks();
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

  /**
   * Cancel a running task
   *
   * @param taskId - Task identifier
   * @param reason - Optional reason for cancellation
   */
  async cancelTask(taskId: string, reason?: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status === "completed" || task.status === "failed") {
      // Already finished, can't cancel
      return;
    }

    // Mark as cancelled
    this.cancelledTasks.set(taskId, reason || "Cancelled by client");

    // Update task status
    await this.updateTaskStatus(taskId, "cancelled");

    logger.warn("Task cancelled", { taskId, reason: reason || "no reason" });
  }

  /**
   * Check if task was cancelled
   *
   * @param taskId - Task identifier
   * @returns true if task was cancelled
   */
  async isTaskCancelled(taskId: string): Promise<boolean> {
    return this.cancelledTasks.has(taskId);
  }

  /**
   * Get cancellation reason if any
   *
   * @param taskId - Task identifier
   * @returns Cancellation reason or null
   */
  async getCancellationReason(taskId: string): Promise<string | null> {
    return this.cancelledTasks.get(taskId) || null;
  }
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
export class RedisTaskStore implements TaskStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any; // Redis client (dynamic import, type not available at compile time)
  private connected: boolean = false;
  private keyPrefix: string;

  constructor(
    private redisUrl: string,
    keyPrefix: string = "servalsheets:task:",
  ) {
    this.keyPrefix = keyPrefix;
  }

  /**
   * Initialize Redis connection (lazy)
   */
  private async ensureConnected(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // Dynamic import to make Redis optional
      // @ts-ignore - Redis is an optional peer dependency
      const { createClient } = await import("redis");

      this.client = createClient({
        url: this.redisUrl,
      });

      this.client.on("error", (err: Error) => {
        logger.error("Redis task store error", { error: err });
      });

      await this.client.connect();
      this.connected = true;
      logger.info("Redis task store connected");
    } catch (error) {
      throw new Error(
        `Failed to connect to Redis at ${this.redisUrl}. ` +
          `Make sure Redis is installed (npm install redis) and running. ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private getTaskKey(taskId: string): string {
    return `${this.keyPrefix}${taskId}`;
  }

  private getResultKey(taskId: string): string {
    return `${this.keyPrefix}result:${taskId}`;
  }

  /**
   * Create a new task
   */
  async createTask(options: { ttl?: number } = {}): Promise<Task> {
    await this.ensureConnected();

    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const now = new Date().toISOString();
    const ttl = options.ttl ?? 3600000; // Default 1 hour

    const task: Task = {
      taskId,
      status: "working",
      createdAt: now,
      lastUpdatedAt: now,
      ttl,
      pollInterval: 5000,
    };

    // Store as Redis hash
    const taskKey = this.getTaskKey(taskId);
    await this.client.hSet(taskKey, {
      taskId,
      status: task.status,
      createdAt: task.createdAt,
      lastUpdatedAt: task.lastUpdatedAt,
      ttl: task.ttl.toString(),
      pollInterval: task.pollInterval?.toString() ?? "5000",
    });

    // Set expiration (convert ms to seconds)
    const ttlSeconds = Math.ceil(ttl / 1000);
    await this.client.expire(taskKey, ttlSeconds);

    return task;
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    await this.ensureConnected();

    const taskKey = this.getTaskKey(taskId);
    const taskData = await this.client.hGetAll(taskKey);

    if (!taskData || Object.keys(taskData).length === 0) {
      return null;
    }

    // Parse task data
    const task: Task = {
      taskId: taskData["taskId"],
      status: taskData["status"] as TaskStatus,
      statusMessage: taskData["statusMessage"],
      createdAt: taskData["createdAt"],
      lastUpdatedAt: taskData["lastUpdatedAt"],
      ttl: parseInt(taskData["ttl"], 10),
      pollInterval: taskData["pollInterval"]
        ? parseInt(taskData["pollInterval"], 10)
        : undefined,
    };

    // Check if expired based on application TTL (handles sub-second TTLs)
    const expiresAt = new Date(task.createdAt).getTime() + task.ttl;
    if (Date.now() > expiresAt) {
      // Clean up the expired task
      await this.deleteTask(taskId);
      return null;
    }

    return task;
  }

  /**
   * Update task status and message
   */
  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    message?: string,
  ): Promise<void> {
    await this.ensureConnected();

    const taskKey = this.getTaskKey(taskId);

    // Check if task exists
    const exists = await this.client.exists(taskKey);
    if (!exists) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const now = new Date().toISOString();
    const updates: Record<string, string> = {
      status,
      lastUpdatedAt: now,
    };

    if (message !== undefined) {
      updates["statusMessage"] = message;
    }

    await this.client.hSet(taskKey, updates);
  }

  /**
   * Store task result (terminal state)
   */
  async storeTaskResult(
    taskId: string,
    status: "completed" | "failed" | "cancelled",
    result: CallToolResult,
  ): Promise<void> {
    await this.ensureConnected();

    // Update task status
    await this.updateTaskStatus(taskId, status);

    // Store result as JSON
    const resultKey = this.getResultKey(taskId);
    const taskResult: TaskResult = { result, status };
    await this.client.set(resultKey, JSON.stringify(taskResult));

    // Set same expiration as task
    const taskKey = this.getTaskKey(taskId);
    const ttl = await this.client.ttl(taskKey);
    if (ttl > 0) {
      await this.client.expire(resultKey, ttl);
    }
  }

  /**
   * Get task result
   */
  async getTaskResult(taskId: string): Promise<TaskResult | null> {
    await this.ensureConnected();

    const resultKey = this.getResultKey(taskId);
    const resultData = await this.client.get(resultKey);

    if (!resultData) {
      return null;
    }

    try {
      return JSON.parse(resultData) as TaskResult;
    } catch (error) {
      logger.error("Failed to parse Redis task result", { error });
      return null;
    }
  }

  /**
   * Delete task and its result
   */
  async deleteTask(taskId: string): Promise<void> {
    await this.ensureConnected();

    const taskKey = this.getTaskKey(taskId);
    const resultKey = this.getResultKey(taskId);

    await this.client.del([taskKey, resultKey]);
  }

  /**
   * Clean up expired tasks
   *
   * Note: Redis handles TTL automatically, but this provides
   * explicit cleanup for monitoring purposes
   */
  async cleanupExpiredTasks(): Promise<number> {
    await this.ensureConnected();

    let cleaned = 0;
    let cursor = "0";

    // Use SCAN to iterate over task keys
    do {
      const result = await this.client.scan(cursor, {
        MATCH: `${this.keyPrefix}*`,
        COUNT: 100,
      });

      cursor = result.cursor;
      const keys = result.keys;

      for (const key of keys) {
        // Skip result keys
        if (key.includes(":result:")) continue;

        // Check if key still exists (may have been expired)
        const exists = await this.client.exists(key);
        if (!exists) {
          cleaned++;
        }
      }
    } while (cursor !== "0");

    return cleaned;
  }

  /**
   * Get all active tasks
   */
  async getAllTasks(): Promise<Task[]> {
    await this.ensureConnected();

    const tasks: Task[] = [];
    const now = Date.now();
    let cursor = "0";

    // Use SCAN to iterate over task keys
    do {
      const result = await this.client.scan(cursor, {
        MATCH: `${this.keyPrefix}task_*`,
        COUNT: 100,
      });

      cursor = result.cursor;
      const keys = result.keys;

      for (const key of keys) {
        // Skip result keys
        if (key.includes(":result:")) continue;

        const taskData = await this.client.hGetAll(key);
        if (taskData && Object.keys(taskData).length > 0) {
          const task: Task = {
            taskId: taskData["taskId"],
            status: taskData["status"] as TaskStatus,
            statusMessage: taskData["statusMessage"],
            createdAt: taskData["createdAt"],
            lastUpdatedAt: taskData["lastUpdatedAt"],
            ttl: parseInt(taskData["ttl"], 10),
            pollInterval: taskData["pollInterval"]
              ? parseInt(taskData["pollInterval"], 10)
              : undefined,
          };

          // Check if expired based on application TTL (handles sub-second TTLs)
          const expiresAt = new Date(task.createdAt).getTime() + task.ttl;
          if (now <= expiresAt) {
            tasks.push(task);
          }
        }
      }
    } while (cursor !== "0");

    // Sort by creation time, newest first
    tasks.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA;
    });

    return tasks;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.connected && this.client) {
      await this.client.quit();
      this.connected = false;
    }
  }

  /**
   * Get task count by status (for monitoring)
   */
  async getTaskStats(): Promise<Record<TaskStatus, number>> {
    const tasks = await this.getAllTasks();

    const stats: Record<TaskStatus, number> = {
      working: 0,
      input_required: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const task of tasks) {
      stats[task.status]++;
    }

    return stats;
  }

  /**
   * Cancel a running task
   *
   * @param taskId - Task identifier
   * @param reason - Optional reason for cancellation
   */
  async cancelTask(taskId: string, reason?: string): Promise<void> {
    await this.ensureConnected();

    const taskKey = this.getTaskKey(taskId);
    const task = await this.client.hGetAll(taskKey);

    if (!task || Object.keys(task).length === 0) {
      throw new Error(`Task ${taskId} not found`);
    }

    const status = task["status"];
    if (status === "completed" || status === "failed") {
      return;
    }

    // Store cancellation reason
    const cancelKey = `${this.keyPrefix}cancelled:${taskId}`;
    const ttlSeconds = Math.ceil(parseInt(task["ttl"], 10) / 1000);
    await this.client.set(cancelKey, reason || "Cancelled by client", {
      EX: ttlSeconds,
    });

    // Update task status
    await this.updateTaskStatus(taskId, "cancelled");

    logger.warn("Task cancelled", { taskId, reason: reason || "no reason" });
  }

  /**
   * Check if task was cancelled
   *
   * @param taskId - Task identifier
   * @returns true if task was cancelled
   */
  async isTaskCancelled(taskId: string): Promise<boolean> {
    await this.ensureConnected();

    const cancelKey = `${this.keyPrefix}cancelled:${taskId}`;
    const reason = await this.client.get(cancelKey);
    return reason !== null;
  }

  /**
   * Get cancellation reason if any
   *
   * @param taskId - Task identifier
   * @returns Cancellation reason or null
   */
  async getCancellationReason(taskId: string): Promise<string | null> {
    await this.ensureConnected();

    const cancelKey = `${this.keyPrefix}cancelled:${taskId}`;
    return await this.client.get(cancelKey);
  }
}
