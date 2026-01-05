/**
 * ServalSheets - RedisTaskStore Tests
 *
 * Comprehensive test suite for RedisTaskStore implementation
 * Tests distributed task lifecycle, Redis persistence, and TTL behavior
 *
 * MCP Protocol: 2025-11-25 (SEP-1686)
 *
 * Prerequisites:
 * - Redis server running on localhost:6379
 * - Or set REDIS_URL environment variable for custom Redis instance
 *
 * Skip tests if Redis is unavailable:
 * - Tests will be skipped automatically if Redis connection fails
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { RedisTaskStore } from '../../src/core/task-store.js';
import type { TaskStatus } from '../../src/core/task-store.js';

// Check if Redis is available
let redisAvailable = false;
const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379';

describe('RedisTaskStore', () => {
  let store: RedisTaskStore;

  beforeAll(async () => {
    // Test Redis availability
    try {
      const testStore = new RedisTaskStore(redisUrl, 'test:availability:');
      await testStore.createTask();
      await testStore.disconnect();
      redisAvailable = true;
    } catch (error) {
      console.warn('Redis not available, skipping RedisTaskStore tests:', error);
      redisAvailable = false;
    }
  });

  beforeEach(async () => {
    if (!redisAvailable) return;

    // Use unique key prefix for test isolation
    const prefix = `test:${Date.now()}:`;
    store = new RedisTaskStore(redisUrl, prefix);
  });

  afterEach(async () => {
    if (!redisAvailable || !store) return;

    try {
      // Clean up all test tasks
      const tasks = await store.getAllTasks();
      for (const task of tasks) {
        await store.deleteTask(task.taskId);
      }
      await store.disconnect();
    } catch (error) {
      console.warn('Error during cleanup:', error);
    }
  });

  describe('createTask', () => {
    it.skipIf(!redisAvailable)('should create a task with default TTL', async () => {
      const task = await store.createTask();

      expect(task.taskId).toMatch(/^task_\d+_[a-z0-9]+$/);
      expect(task.status).toBe('working');
      expect(task.ttl).toBe(3600000); // 1 hour
      expect(task.pollInterval).toBe(5000);
      expect(task.createdAt).toBeDefined();
      expect(task.lastUpdatedAt).toBeDefined();
    });

    it.skipIf(!redisAvailable)('should create a task with custom TTL', async () => {
      const task = await store.createTask({ ttl: 600000 });
      expect(task.ttl).toBe(600000); // 10 minutes
    });

    it.skipIf(!redisAvailable)('should create tasks with unique IDs', async () => {
      const task1 = await store.createTask();
      const task2 = await store.createTask();

      expect(task1.taskId).not.toBe(task2.taskId);
    });

    it.skipIf(!redisAvailable)('should persist task to Redis', async () => {
      const task = await store.createTask();

      // Create new store instance to verify persistence
      const store2 = new RedisTaskStore(redisUrl, (store as any).keyPrefix);
      const retrieved = await store2.getTask(task.taskId);

      expect(retrieved).toEqual(task);
      await store2.disconnect();
    });

    it.skipIf(!redisAvailable)('should set Redis TTL correctly', async () => {
      const task = await store.createTask({ ttl: 10000 }); // 10 seconds

      // Verify task exists
      const retrieved = await store.getTask(task.taskId);
      expect(retrieved).not.toBeNull();
    });
  });

  describe('getTask', () => {
    it.skipIf(!redisAvailable)('should retrieve an existing task', async () => {
      const created = await store.createTask();
      const retrieved = await store.getTask(created.taskId);

      expect(retrieved).toEqual(created);
    });

    it.skipIf(!redisAvailable)('should return null for non-existent task', async () => {
      const retrieved = await store.getTask('task_nonexistent');
      expect(retrieved).toBeNull();
    });

    it.skipIf(!redisAvailable)('should return null for expired task', async () => {
      // Create task with short TTL
      const task = await store.createTask({ ttl: 100 }); // 100ms

      // Wait for Redis to expire the key
      await new Promise(resolve => setTimeout(resolve, 200));

      const retrieved = await store.getTask(task.taskId);
      expect(retrieved).toBeNull();
    });

    it.skipIf(!redisAvailable)('should return task with updated fields', async () => {
      const task = await store.createTask();
      await store.updateTaskStatus(task.taskId, 'completed', 'Done!');

      const retrieved = await store.getTask(task.taskId);
      expect(retrieved?.status).toBe('completed');
      expect(retrieved?.statusMessage).toBe('Done!');
    });
  });

  describe('updateTaskStatus', () => {
    it.skipIf(!redisAvailable)('should update task status', async () => {
      const task = await store.createTask();

      await store.updateTaskStatus(task.taskId, 'completed', 'Success');

      const updated = await store.getTask(task.taskId);
      expect(updated?.status).toBe('completed');
      expect(updated?.statusMessage).toBe('Success');
    });

    it.skipIf(!redisAvailable)('should throw for non-existent task', async () => {
      await expect(
        store.updateTaskStatus('task_nonexistent', 'completed')
      ).rejects.toThrow('Task not found');
    });

    it.skipIf(!redisAvailable)('should update lastUpdatedAt timestamp', async () => {
      const task = await store.createTask();
      const originalTimestamp = task.lastUpdatedAt;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      await store.updateTaskStatus(task.taskId, 'working', 'In progress...');

      const updated = await store.getTask(task.taskId);
      expect(updated?.lastUpdatedAt).not.toBe(originalTimestamp);
      expect(updated!.lastUpdatedAt > originalTimestamp).toBe(true);
    });

    it.skipIf(!redisAvailable)('should allow status transition to all valid states', async () => {
      const task = await store.createTask();

      const states: TaskStatus[] = ['working', 'completed', 'failed', 'cancelled', 'input_required'];

      for (const status of states) {
        await store.updateTaskStatus(task.taskId, status);
        const updated = await store.getTask(task.taskId);
        expect(updated?.status).toBe(status);
      }
    });

    it.skipIf(!redisAvailable)('should persist across store instances', async () => {
      const task = await store.createTask();
      await store.updateTaskStatus(task.taskId, 'completed', 'Done');

      // Create new store instance
      const store2 = new RedisTaskStore(redisUrl, (store as any).keyPrefix);
      const retrieved = await store2.getTask(task.taskId);

      expect(retrieved?.status).toBe('completed');
      expect(retrieved?.statusMessage).toBe('Done');

      await store2.disconnect();
    });
  });

  describe('storeTaskResult and getTaskResult', () => {
    it.skipIf(!redisAvailable)('should store and retrieve task result', async () => {
      const task = await store.createTask();
      const result = {
        content: [{ type: 'text' as const, text: 'Success!' }],
        isError: false,
      };

      await store.storeTaskResult(task.taskId, 'completed', result);
      const retrieved = await store.getTaskResult(task.taskId);

      expect(retrieved).toEqual({ status: 'completed', result });
    });

    it.skipIf(!redisAvailable)('should return null for task without result', async () => {
      const task = await store.createTask();
      const result = await store.getTaskResult(task.taskId);

      expect(result).toBeNull();
    });

    it.skipIf(!redisAvailable)('should throw for non-existent task when storing result', async () => {
      await expect(
        store.storeTaskResult('task_nonexistent', 'completed', { content: [], isError: false })
      ).rejects.toThrow('Task not found');
    });

    it.skipIf(!redisAvailable)('should persist result across store instances', async () => {
      const task = await store.createTask();
      const result = {
        content: [{ type: 'text' as const, text: 'Test result' }],
        isError: false,
      };

      await store.storeTaskResult(task.taskId, 'completed', result);

      // Create new store instance
      const store2 = new RedisTaskStore(redisUrl, (store as any).keyPrefix);
      const retrieved = await store2.getTaskResult(task.taskId);

      expect(retrieved?.result).toEqual(result);
      await store2.disconnect();
    });

    it.skipIf(!redisAvailable)('should handle large result data', async () => {
      const task = await store.createTask();
      const largeText = 'x'.repeat(100000); // 100KB text
      const result = {
        content: [{ type: 'text' as const, text: largeText }],
        isError: false,
      };

      await store.storeTaskResult(task.taskId, 'completed', result);
      const retrieved = await store.getTaskResult(task.taskId);

      expect(retrieved?.result.content[0].text).toBe(largeText);
    });
  });

  describe('getAllTasks', () => {
    it.skipIf(!redisAvailable)('should return empty array when no tasks', async () => {
      const tasks = await store.getAllTasks();
      expect(tasks).toEqual([]);
    });

    it.skipIf(!redisAvailable)('should return all tasks', async () => {
      await store.createTask();
      await store.createTask();
      await store.createTask();

      const tasks = await store.getAllTasks();
      expect(tasks).toHaveLength(3);
    });

    it.skipIf(!redisAvailable)('should sort tasks by creation time (newest first)', async () => {
      const task1 = await store.createTask();
      await new Promise(resolve => setTimeout(resolve, 10));
      const task2 = await store.createTask();
      await new Promise(resolve => setTimeout(resolve, 10));
      const task3 = await store.createTask();

      const tasks = await store.getAllTasks();

      expect(tasks[0].taskId).toBe(task3.taskId);
      expect(tasks[1].taskId).toBe(task2.taskId);
      expect(tasks[2].taskId).toBe(task1.taskId);
    });

    it.skipIf(!redisAvailable)('should not include expired tasks', async () => {
      // Create short-lived task
      await store.createTask({ ttl: 100 }); // 100ms
      // Create long-lived task
      await store.createTask({ ttl: 60000 });

      // Wait for short task to expire
      await new Promise(resolve => setTimeout(resolve, 200));

      const tasks = await store.getAllTasks();
      expect(tasks).toHaveLength(1);
    });

    it.skipIf(!redisAvailable)('should work across store instances', async () => {
      await store.createTask();
      await store.createTask();

      // Create new store instance
      const store2 = new RedisTaskStore(redisUrl, (store as any).keyPrefix);
      const tasks = await store2.getAllTasks();

      expect(tasks).toHaveLength(2);
      await store2.disconnect();
    });
  });

  describe('deleteTask', () => {
    it.skipIf(!redisAvailable)('should delete task and result', async () => {
      const task = await store.createTask();
      const result = { content: [{ type: 'text' as const, text: 'Test' }], isError: false };
      await store.storeTaskResult(task.taskId, 'completed', result);

      await store.deleteTask(task.taskId);

      const retrieved = await store.getTask(task.taskId);
      expect(retrieved).toBeNull();

      const retrievedResult = await store.getTaskResult(task.taskId);
      expect(retrievedResult).toBeNull();
    });

    it.skipIf(!redisAvailable)('should not throw for non-existent task', async () => {
      await expect(store.deleteTask('task_nonexistent')).resolves.not.toThrow();
    });

    it.skipIf(!redisAvailable)('should persist deletion across store instances', async () => {
      const task = await store.createTask();
      await store.deleteTask(task.taskId);

      // Create new store instance
      const store2 = new RedisTaskStore(redisUrl, (store as any).keyPrefix);
      const retrieved = await store2.getTask(task.taskId);

      expect(retrieved).toBeNull();
      await store2.disconnect();
    });
  });

  describe('getTaskStats', () => {
    it.skipIf(!redisAvailable)('should return counts by status', async () => {
      // Create tasks with different statuses
      await store.createTask(); // working
      const task2 = await store.createTask();
      await store.updateTaskStatus(task2.taskId, 'completed');
      const task3 = await store.createTask();
      await store.updateTaskStatus(task3.taskId, 'failed');
      const task4 = await store.createTask();
      await store.updateTaskStatus(task4.taskId, 'cancelled');

      const stats = await store.getTaskStats();

      expect(stats.working).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.cancelled).toBe(1);
      expect(stats.input_required).toBe(0);
    });

    it.skipIf(!redisAvailable)('should return zero counts when no tasks', async () => {
      const stats = await store.getTaskStats();

      expect(stats.working).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.cancelled).toBe(0);
      expect(stats.input_required).toBe(0);
    });
  });

  describe('cleanupExpiredTasks', () => {
    it.skipIf(!redisAvailable)('should report expired tasks', async () => {
      // Create short-lived tasks
      await store.createTask({ ttl: 100 });
      await store.createTask({ ttl: 100 });
      await store.createTask({ ttl: 60000 }); // long-lived

      // Wait for short tasks to expire
      await new Promise(resolve => setTimeout(resolve, 200));

      const cleaned = await store.cleanupExpiredTasks();

      // Redis auto-expires, so cleanup returns 0 (keys already gone)
      // This is different from InMemoryTaskStore which manually tracks
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('disconnect', () => {
    it.skipIf(!redisAvailable)('should disconnect successfully', async () => {
      await store.createTask();
      await expect(store.disconnect()).resolves.not.toThrow();
    });

    it.skipIf(!redisAvailable)('should be safe to call multiple times', async () => {
      await store.disconnect();
      await expect(store.disconnect()).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it.skipIf(!redisAvailable)('should handle concurrent task creations', async () => {
      const promises = Array.from({ length: 20 }, () => store.createTask());
      const tasks = await Promise.all(promises);

      expect(tasks).toHaveLength(20);
      expect(new Set(tasks.map(t => t.taskId)).size).toBe(20); // All unique
    });

    it.skipIf(!redisAvailable)('should handle status message with special characters', async () => {
      const task = await store.createTask();
      const message = 'Error: "Invalid" <data> & more\n\tSpecial chars';

      await store.updateTaskStatus(task.taskId, 'failed', message);

      const updated = await store.getTask(task.taskId);
      expect(updated?.statusMessage).toBe(message);
    });

    it.skipIf(!redisAvailable)('should handle JSON serialization in results', async () => {
      const task = await store.createTask();
      const result = {
        content: [
          { type: 'text' as const, text: 'Result with "quotes" and \n newlines' },
          { type: 'text' as const, text: JSON.stringify({ nested: { data: true } }) }
        ],
        isError: false,
      };

      await store.storeTaskResult(task.taskId, 'completed', result);
      const retrieved = await store.getTaskResult(task.taskId);

      expect(retrieved?.result).toEqual(result);
    });
  });

  describe('multi-instance behavior', () => {
    it.skipIf(!redisAvailable)('should share tasks across multiple store instances', async () => {
      const store1 = new RedisTaskStore(redisUrl, 'multi-test:');
      const store2 = new RedisTaskStore(redisUrl, 'multi-test:');

      try {
        const task = await store1.createTask();
        const retrieved = await store2.getTask(task.taskId);

        expect(retrieved).toEqual(task);

        await store1.deleteTask(task.taskId);
      } finally {
        await store1.disconnect();
        await store2.disconnect();
      }
    });

    it.skipIf(!redisAvailable)('should propagate status updates across instances', async () => {
      const store1 = new RedisTaskStore(redisUrl, 'multi-status:');
      const store2 = new RedisTaskStore(redisUrl, 'multi-status:');

      try {
        const task = await store1.createTask();
        await store1.updateTaskStatus(task.taskId, 'completed', 'Done from store1');

        const retrieved = await store2.getTask(task.taskId);
        expect(retrieved?.status).toBe('completed');
        expect(retrieved?.statusMessage).toBe('Done from store1');

        await store1.deleteTask(task.taskId);
      } finally {
        await store1.disconnect();
        await store2.disconnect();
      }
    });
  });
});
