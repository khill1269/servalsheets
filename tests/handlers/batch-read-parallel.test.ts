/**
 * Parallel Batch Read Tests
 *
 * Tests for ENABLE_PARALLEL_EXECUTOR feature flag behavior.
 * Validates concurrent batch reads work correctly, respect rate limits,
 * and produce consistent results compared to sequential execution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ParallelExecutor,
  type ParallelTask,
  type ParallelResult,
} from '../../src/services/parallel-executor.js';

describe('ParallelExecutor - Batch Read Integration', () => {
  let executor: ParallelExecutor;

  beforeEach(() => {
    executor = new ParallelExecutor({
      concurrency: 5,
      retryOnError: true,
      maxRetries: 2,
      retryDelayMs: 10, // Fast retries for tests
      verboseLogging: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should execute concurrent tasks up to concurrency limit', async () => {
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const tasks: ParallelTask<string>[] = Array.from({ length: 15 }, (_, i) => ({
      id: `task-${i}`,
      fn: async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 10));
        currentConcurrent--;
        return `result-${i}`;
      },
    }));

    const results = await executor.executeAll(tasks);

    // All tasks should succeed
    expect(results.every((r: ParallelResult<string>) => r.success)).toBe(true);
    expect(results).toHaveLength(15);

    // Concurrency should be bounded by the configured limit (5)
    expect(maxConcurrent).toBeLessThanOrEqual(5);
    // But should have actually run some in parallel
    expect(maxConcurrent).toBeGreaterThan(1);
  });

  it('should return results in correct order matching task IDs', async () => {
    const tasks: ParallelTask<number>[] = Array.from({ length: 10 }, (_, i) => ({
      id: `range-${i}`,
      fn: async () => {
        // Random delay to simulate variable API response times
        await new Promise((resolve) => setTimeout(resolve, (i % 5) * 4));
        return i * 10;
      },
    }));

    const results = await executor.executeAll(tasks);

    // Results should be returned for all tasks
    expect(results).toHaveLength(10);

    // Each result should have matching ID and correct value
    for (let i = 0; i < 10; i++) {
      const result = results.find((r: ParallelResult<number>) => r.id === `range-${i}`);
      expect(result).toBeDefined();
      expect(result!.success).toBe(true);
      expect(result!.result).toBe(i * 10);
    }
  });

  it('should retry failed tasks and report errors for persistent failures', async () => {
    let callCount = 0;

    const tasks: ParallelTask<string>[] = [
      {
        id: 'success-task',
        fn: async () => 'ok',
      },
      {
        id: 'flaky-task',
        fn: async () => {
          callCount++;
          if (callCount <= 2) {
            throw new Error('Transient error');
          }
          return 'recovered';
        },
      },
      {
        id: 'always-fails',
        fn: async () => {
          throw new Error('Persistent failure');
        },
      },
    ];

    const results = await executor.executeAll(tasks);

    // Success task should succeed
    const successResult = results.find((r: ParallelResult<string>) => r.id === 'success-task');
    expect(successResult?.success).toBe(true);
    expect(successResult?.result).toBe('ok');

    // Flaky task should recover after retries
    const flakyResult = results.find((r: ParallelResult<string>) => r.id === 'flaky-task');
    expect(flakyResult?.success).toBe(true);
    expect(flakyResult?.result).toBe('recovered');

    // Always-fails should report error after exhausting retries
    const failResult = results.find((r: ParallelResult<string>) => r.id === 'always-fails');
    expect(failResult?.success).toBe(false);
    expect(failResult?.error).toBeDefined();
  });

  it('should handle empty task list gracefully', async () => {
    const results = await executor.executeAll([]);
    expect(results).toHaveLength(0);
  });

  it('should track execution statistics', async () => {
    const tasks: ParallelTask<string>[] = Array.from({ length: 5 }, (_, i) => ({
      id: `stat-task-${i}`,
      fn: async () => `result-${i}`,
    }));

    await executor.executeAll(tasks);
    const stats = executor.getStats();

    expect(stats.totalExecuted).toBeGreaterThanOrEqual(5);
    expect(stats.totalSucceeded).toBeGreaterThanOrEqual(5);
    expect(stats.totalFailed).toBe(0);
  });

  it('should execute a single task and return one result', async () => {
    const tasks: ParallelTask<string>[] = [
      {
        id: 'single-task',
        fn: async () => 'single-result',
      },
    ];

    const results = await executor.executeAll(tasks);

    expect(results).toHaveLength(1);
    expect(results[0]?.success).toBe(true);
    expect(results[0]?.result).toBe('single-result');
    expect(results[0]?.id).toBe('single-task');
  });

  it('should reset statistics after resetStats()', async () => {
    const tasks: ParallelTask<number>[] = Array.from({ length: 3 }, (_, i) => ({
      id: `reset-task-${i}`,
      fn: async () => i,
    }));

    await executor.executeAll(tasks);
    expect(executor.getStats().totalExecuted).toBeGreaterThan(0);

    executor.resetStats();
    const stats = executor.getStats();
    expect(stats.totalExecuted).toBe(0);
    expect(stats.totalSucceeded).toBe(0);
    expect(stats.totalFailed).toBe(0);
  });

  it('should report correct failed count when tasks fail without retry', async () => {
    const noRetryExecutor = new ParallelExecutor({
      concurrency: 3,
      retryOnError: false,
      maxRetries: 0,
      retryDelayMs: 0,
      verboseLogging: false,
    });

    const tasks: ParallelTask<string>[] = [
      { id: 'ok-1', fn: async () => 'good' },
      { id: 'fail-1', fn: async () => { throw new Error('boom'); } },
      { id: 'fail-2', fn: async () => { throw new Error('boom2'); } },
    ];

    const results = await noRetryExecutor.executeAll(tasks);

    expect(results).toHaveLength(3);
    const successResults = results.filter((r: ParallelResult<string>) => r.success);
    const failResults = results.filter((r: ParallelResult<string>) => !r.success);
    expect(successResults).toHaveLength(1);
    expect(failResults).toHaveLength(2);

    const stats = noRetryExecutor.getStats();
    expect(stats.totalFailed).toBe(2);
    expect(stats.totalSucceeded).toBe(1);
  });

  it('should respect per-task timeout and mark timed-out task as failed', async () => {
    const tasks: ParallelTask<string>[] = [
      {
        id: 'fast-task',
        fn: async () => 'done',
      },
      {
        id: 'slow-task',
        timeout: 50, // 50ms timeout
        fn: async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return 'too-late';
        },
      },
    ];

    const results = await executor.executeAll(tasks);

    const fastResult = results.find((r: ParallelResult<string>) => r.id === 'fast-task');
    const slowResult = results.find((r: ParallelResult<string>) => r.id === 'slow-task');

    expect(fastResult?.success).toBe(true);
    expect(fastResult?.result).toBe('done');
    expect(slowResult?.success).toBe(false);
    expect(slowResult?.error?.message).toContain('timeout');
  }, 10000);

  it('should handle tasks that return falsy values (0, false, empty string)', async () => {
    const tasks: ParallelTask<number | boolean | string>[] = [
      { id: 'zero', fn: async () => 0 },
      { id: 'false', fn: async () => false as boolean },
      { id: 'empty', fn: async () => '' as string },
    ];

    const results = await executor.executeAll(tasks);

    expect(results).toHaveLength(3);
    for (const r of results) {
      expect((r as ParallelResult<number | boolean | string>).success).toBe(true);
    }

    const zeroResult = results.find((r) => r.id === 'zero');
    expect(zeroResult?.result).toBe(0);

    const falseResult = results.find((r) => r.id === 'false');
    expect(falseResult?.result).toBe(false);

    const emptyResult = results.find((r) => r.id === 'empty');
    expect(emptyResult?.result).toBe('');
  });
});
