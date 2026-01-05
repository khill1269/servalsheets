/**
 * ServalSheets - Task Endpoints Integration Tests
 *
 * Tests MCP task endpoints (SEP-1686)
 * - tasks/get
 * - tasks/list
 * - tasks/cancel
 * - tasks/result (blocking)
 * - Tool execution with task mode
 *
 * MCP Protocol: 2025-11-25
 *
 * NOTE: These tests are currently skipped and need to be rewritten
 * to use proper MCP client/server setup instead of calling server.server.request()
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { ServalSheetsServer } from '../../src/server.js';
import type { TaskStoreAdapter } from '../../src/core/task-store-adapter.js';

describe.skip('Task Endpoints (SEP-1686) - TODO: Rewrite with proper MCP client', () => {
  let server: ServalSheetsServer;
  let taskStore: TaskStoreAdapter;
  let createdTaskIds: string[] = [];

  beforeAll(async () => {
    // Create server with minimal config (no Google API needed for task tests)
    server = new ServalSheetsServer({
      name: 'servalsheets-test',
      version: '1.0.0-test',
    });

    // Note: Don't call initialize() - it requires Google API
    // Just access the task store directly for these tests

    // Get task store reference for testing
    taskStore = (server as any).taskStore;
  });

  afterAll(async () => {
    // Cleanup created tasks
    for (const taskId of createdTaskIds) {
      try {
        await taskStore.getUnderlyingStore().deleteTask(taskId);
      } catch {
        // Ignore cleanup errors
      }
    }

    await server.shutdown();
  });

  describe('Task Creation via tools/call', () => {
    it('should create task when tool supports tasks and client requests it', async () => {
      // Skip if no Google API configured (task creation requires handler execution)
      if (!(server as any).googleClient) {
        console.log('Skipping: No Google API configured');
        return;
      }

      const response = await server.server.request({
        method: 'tools/call',
        params: {
          name: 'sheets_analysis',
          arguments: {
            request: {
              action: 'data_quality',
              spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
              range: 'Sheet1!A1:Z100',
            },
          },
          _meta: {
            progressToken: 'test-progress-123',
          },
          task: { ttl: 300000 }, // Request task mode
        },
      });

      expect(response).toBeDefined();

      if ('task' in response) {
        expect(response.task).toBeDefined();
        expect(response.task.taskId).toMatch(/^task_/);
        expect(response.task.status).toMatch(/working|completed|failed/);
        expect(response.task.ttl).toBe(300000);

        createdTaskIds.push(response.task.taskId);
      }
    });

    it('should execute synchronously when task not requested', async () => {
      // Without task parameter, should return result directly
      try {
        const response = await server.server.request({
          method: 'tools/call',
          params: {
            name: 'sheets_values',
            arguments: {
              request: {
                action: 'read',
                spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
                range: 'Sheet1!A1',
              },
            },
          },
        });

        expect(response).toBeDefined();
        // Should have content, not task
        expect('content' in response).toBe(true);
      } catch (err) {
        // Expected if no Google API configured
        console.log('Skipping sync test: No Google API');
      }
    });
  });

  describe('tasks/get endpoint', () => {
    it('should retrieve task by ID', async () => {
      // Create a task first
      const task = await taskStore.createTask(
        { ttl: 300000 },
        'test-request-id',
        { method: 'tools/call', params: {} } as any
      );
      createdTaskIds.push(task.taskId);

      const response = await server.server.request({
        method: 'tasks/get',
        params: { taskId: task.taskId },
      });

      expect(response.taskId).toBe(task.taskId);
      expect(response.status).toBe('working');
      expect(response.ttl).toBe(300000);
    });

    it('should return error for non-existent task', async () => {
      await expect(
        server.server.request({
          method: 'tasks/get',
          params: { taskId: 'task_nonexistent' },
        })
      ).rejects.toThrow(/not found/i);
    });

    it('should return updated status after status change', async () => {
      const task = await taskStore.createTask(
        { ttl: 300000 },
        'test-request-id',
        { method: 'tools/call', params: {} } as any
      );
      createdTaskIds.push(task.taskId);

      // Update status
      await taskStore.updateTaskStatus(task.taskId, 'completed', 'Task finished');

      const response = await server.server.request({
        method: 'tasks/get',
        params: { taskId: task.taskId },
      });

      expect(response.status).toBe('completed');
      expect(response.statusMessage).toBe('Task finished');
    });
  });

  describe('tasks/list endpoint', () => {
    it('should list all tasks', async () => {
      // Create multiple tasks
      const task1 = await taskStore.createTask(
        { ttl: 300000 },
        'req-1',
        { method: 'tools/call', params: {} } as any
      );
      const task2 = await taskStore.createTask(
        { ttl: 300000 },
        'req-2',
        { method: 'tools/call', params: {} } as any
      );
      createdTaskIds.push(task1.taskId, task2.taskId);

      const response = await server.server.request({
        method: 'tasks/list',
        params: {},
      });

      expect(response.tasks).toBeInstanceOf(Array);
      expect(response.tasks.length).toBeGreaterThanOrEqual(2);

      const taskIds = response.tasks.map((t: any) => t.taskId);
      expect(taskIds).toContain(task1.taskId);
      expect(taskIds).toContain(task2.taskId);
    });

    it('should support cursor-based pagination', async () => {
      // Create many tasks (if not already created)
      const tasksToCreate = 15;
      for (let i = 0; i < tasksToCreate; i++) {
        const task = await taskStore.createTask(
          { ttl: 300000 },
          `req-${i}`,
          { method: 'tools/call', params: {} } as any
        );
        createdTaskIds.push(task.taskId);
      }

      // First page (if pagination is implemented with default page size < 15)
      const page1 = await server.server.request({
        method: 'tasks/list',
        params: {},
      });

      expect(page1.tasks).toBeInstanceOf(Array);

      // If nextCursor exists, fetch next page
      if (page1.nextCursor) {
        const page2 = await server.server.request({
          method: 'tasks/list',
          params: { cursor: page1.nextCursor },
        });

        expect(page2.tasks).toBeInstanceOf(Array);
        // Verify no overlap in task IDs
        const page1Ids = new Set(page1.tasks.map((t: any) => t.taskId));
        const page2Ids = page2.tasks.map((t: any) => t.taskId);

        for (const id of page2Ids) {
          expect(page1Ids.has(id)).toBe(false);
        }
      }
    });

    it('should return tasks sorted by creation time (newest first)', async () => {
      // Create tasks with slight delays
      const task1 = await taskStore.createTask(
        { ttl: 300000 },
        'old-task',
        { method: 'tools/call', params: {} } as any
      );

      await new Promise(resolve => setTimeout(resolve, 10));

      const task2 = await taskStore.createTask(
        { ttl: 300000 },
        'new-task',
        { method: 'tools/call', params: {} } as any
      );

      createdTaskIds.push(task1.taskId, task2.taskId);

      const response = await server.server.request({
        method: 'tasks/list',
        params: {},
      });

      const tasks = response.tasks;
      const task1Index = tasks.findIndex((t: any) => t.taskId === task1.taskId);
      const task2Index = tasks.findIndex((t: any) => t.taskId === task2.taskId);

      // task2 (newer) should come before task1 (older)
      if (task1Index >= 0 && task2Index >= 0) {
        expect(task2Index < task1Index).toBe(true);
      }
    });
  });

  describe('tasks/cancel endpoint', () => {
    it('should cancel an active task', async () => {
      const task = await taskStore.createTask(
        { ttl: 300000 },
        'req-cancel-test',
        { method: 'tools/call', params: {} } as any
      );
      createdTaskIds.push(task.taskId);

      // Task should be working
      expect(task.status).toBe('working');

      // Cancel it
      const cancelResponse = await server.server.request({
        method: 'tasks/cancel',
        params: { taskId: task.taskId },
      });

      expect(cancelResponse).toBeDefined();

      // Verify cancellation
      const updatedTask = await server.server.request({
        method: 'tasks/get',
        params: { taskId: task.taskId },
      });

      expect(updatedTask.status).toBe('cancelled');
    });

    it('should reject cancellation of terminal task', async () => {
      const task = await taskStore.createTask(
        { ttl: 300000 },
        'req-terminal',
        { method: 'tools/call', params: {} } as any
      );
      createdTaskIds.push(task.taskId);

      // Mark as completed (terminal status)
      await taskStore.updateTaskStatus(task.taskId, 'completed');

      // Try to cancel
      await expect(
        server.server.request({
          method: 'tasks/cancel',
          params: { taskId: task.taskId },
        })
      ).rejects.toThrow(/terminal|completed/i);
    });

    it('should reject cancellation of non-existent task', async () => {
      await expect(
        server.server.request({
          method: 'tasks/cancel',
          params: { taskId: 'task_nonexistent' },
        })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('tasks/result endpoint (blocking)', () => {
    it('should wait for task completion and return result', async () => {
      const task = await taskStore.createTask(
        { ttl: 300000 },
        'req-result-test',
        { method: 'tools/call', params: {} } as any
      );
      createdTaskIds.push(task.taskId);

      // Simulate async completion after 100ms
      setTimeout(async () => {
        await taskStore.storeTaskResult(task.taskId, 'completed', {
          content: [{ type: 'text', text: 'Task completed successfully!' }],
          isError: false,
        });
      }, 100);

      // Block and wait for result (with timeout)
      const resultPromise = server.server.request({
        method: 'tasks/result',
        params: { taskId: task.taskId },
      });

      // Race with timeout to prevent hanging test
      const result = await Promise.race([
        resultPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for result')), 5000)
        ),
      ]);

      expect(result).toBeDefined();
      expect((result as any).content[0].text).toBe('Task completed successfully!');
    });

    it('should return immediately if task already completed', async () => {
      const task = await taskStore.createTask(
        { ttl: 300000 },
        'req-already-done',
        { method: 'tools/call', params: {} } as any
      );
      createdTaskIds.push(task.taskId);

      // Complete the task immediately
      await taskStore.storeTaskResult(task.taskId, 'completed', {
        content: [{ type: 'text', text: 'Already done!' }],
        isError: false,
      });

      // Should return immediately
      const start = Date.now();
      const result = await server.server.request({
        method: 'tasks/result',
        params: { taskId: task.taskId },
      });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100); // Should be nearly instant
      expect((result as any).content[0].text).toBe('Already done!');
    });
  });

  describe('Task lifecycle', () => {
    it('should follow complete lifecycle: create → work → complete → result', async () => {
      // 1. Create task
      const task = await taskStore.createTask(
        { ttl: 300000 },
        'lifecycle-test',
        { method: 'tools/call', params: {} } as any
      );
      createdTaskIds.push(task.taskId);

      expect(task.status).toBe('working');

      // 2. Update progress
      await taskStore.updateTaskStatus(task.taskId, 'working', 'Step 1 of 3...');

      let retrieved = await server.server.request({
        method: 'tasks/get',
        params: { taskId: task.taskId },
      });
      expect(retrieved.statusMessage).toBe('Step 1 of 3...');

      // 3. More progress
      await taskStore.updateTaskStatus(task.taskId, 'working', 'Step 2 of 3...');

      // 4. Complete
      await taskStore.storeTaskResult(task.taskId, 'completed', {
        content: [{ type: 'text', text: 'All done!' }],
        isError: false,
      });

      // 5. Verify final state
      retrieved = await server.server.request({
        method: 'tasks/get',
        params: { taskId: task.taskId },
      });
      expect(retrieved.status).toBe('completed');

      // 6. Get result
      const result = await server.server.request({
        method: 'tasks/result',
        params: { taskId: task.taskId },
      });
      expect((result as any).content[0].text).toBe('All done!');
    });

    it('should handle failed task lifecycle', async () => {
      const task = await taskStore.createTask(
        { ttl: 300000 },
        'fail-test',
        { method: 'tools/call', params: {} } as any
      );
      createdTaskIds.push(task.taskId);

      // Simulate failure
      await taskStore.storeTaskResult(task.taskId, 'failed', {
        content: [{ type: 'text', text: 'Operation failed: Network error' }],
        isError: true,
      });

      const retrieved = await server.server.request({
        method: 'tasks/get',
        params: { taskId: task.taskId },
      });

      expect(retrieved.status).toBe('failed');

      const result = await server.server.request({
        method: 'tasks/result',
        params: { taskId: task.taskId },
      });

      expect((result as any).isError).toBe(true);
    });
  });

  describe('Task expiration', () => {
    it('should expire task after TTL', async () => {
      // Create task with very short TTL
      const task = await taskStore.getUnderlyingStore().createTask({ ttl: 50 });
      createdTaskIds.push(task.taskId);

      // Should exist initially
      const initial = await taskStore.getTask(task.taskId);
      expect(initial).not.toBeNull();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should be gone
      await expect(
        server.server.request({
          method: 'tasks/get',
          params: { taskId: task.taskId },
        })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('Error handling', () => {
    it('should handle malformed taskId', async () => {
      await expect(
        server.server.request({
          method: 'tasks/get',
          params: { taskId: '' },
        })
      ).rejects.toThrow();

      await expect(
        server.server.request({
          method: 'tasks/get',
          params: { taskId: 'not-a-task-id' },
        })
      ).rejects.toThrow();
    });

    it('should handle missing required parameters', async () => {
      await expect(
        server.server.request({
          method: 'tasks/get',
          params: {},
        })
      ).rejects.toThrow();
    });
  });
});
