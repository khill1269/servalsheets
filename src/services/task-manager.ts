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

import { logger as baseLogger } from '../utils/logger.js';
import { NotFoundError, ServiceError } from '../core/errors.js';

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
  /** Timestamps */
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

/**
 * TaskManager — manages task lifecycle
 */
export class TaskManager {
  private activeTasks = new Map<string, ManagedTaskInfo>();
  private readonly taskTTL = 60 * 60 * 1000; // 1 hour
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    // Auto-cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Register a new task
   */
  registerTask(metadata: TaskMetadata): string {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();

    const taskInfo: ManagedTaskInfo = {
      taskId,
      status: 'pending',
      metadata,
      createdAt: now,
    };

    this.activeTasks.set(taskId, taskInfo);
    return taskId;
  }

  /**
   * Start a task (transition from pending to running)
   */
  startTask(taskId: string): void {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }
    task.status = 'running';
    task.startedAt = Date.now();
  }

  /**
   * Update task progress
   */
  updateTaskProgress(taskId: string, progress: number, message?: string): void {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }
    task.progress = Math.min(100, Math.max(0, progress));
    if (message) {
      task.progressMessage = message;
    }
  }

  /**
   * Complete a task
   */
  completeTask(taskId: string, result?: unknown): void {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }
    task.status = 'completed';
    task.completedAt = Date.now();
    task.result = result;
  }

  /**
   * Fail a task
   */
  failTask(taskId: string, error: string): void {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }
    task.status = 'failed';
    task.completedAt = Date.now();
    task.error = error;
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): void {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      throw new NotFoundError('Task', taskId);
    }
    task.status = 'cancelled';
    task.completedAt = Date.now();
  }

  /**
   * Get task info
   */
  getTaskInfo(taskId: string): ManagedTaskInfo | undefined {
    return this.activeTasks.get(taskId);
  }

  /**
   * Get all active tasks
   */
  getAllTasks(): ManagedTaskInfo[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: ManagedTaskStatus): ManagedTaskInfo[] {
    return Array.from(this.activeTasks.values()).filter((t) => t.status === status);
  }

  /**
   * Cleanup expired tasks
   */
  private cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [taskId, task] of this.activeTasks.entries()) {
      if (task.completedAt && now - task.completedAt > this.taskTTL) {
        expired.push(taskId);
      }
    }

    for (const taskId of expired) {
      this.activeTasks.delete(taskId);
    }
  }

  /**
   * Destroy the TaskManager (cleanup interval)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
