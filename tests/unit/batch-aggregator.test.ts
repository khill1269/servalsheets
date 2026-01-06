/**
 * BatchAggregator Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchAggregator, type BatchRequest } from '../../src/services/batch-aggregator.js';

describe('BatchAggregator', () => {
  let aggregator: BatchAggregator;
  let executedBatches: BatchRequest[][];

  beforeEach(() => {
    executedBatches = [];

    // Mock batch executor
    const batchExecutor = async (requests: BatchRequest[]) => {
      executedBatches.push(requests);
      // Return mock results
      return requests.map((_, index) => ({ result: `result-${index}` }));
    };

    aggregator = new BatchAggregator(batchExecutor, {
      windowMs: 50,
      maxBatchSize: 5,
      verboseLogging: false,
    });
  });

  describe('add', () => {
    it('should aggregate requests within time window', async () => {
      const promise1 = aggregator.add('req1', 'sheet1', { range: 'A1' });
      const promise2 = aggregator.add('req2', 'sheet1', { range: 'A2' });
      const promise3 = aggregator.add('req3', 'sheet1', { range: 'A3' });

      // Wait for window to execute
      await Promise.all([promise1, promise2, promise3]);

      // Should execute as a single batch
      expect(executedBatches.length).toBe(1);
      expect(executedBatches[0]).toHaveLength(3);
    });

    it('should execute batch when max size reached', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        aggregator.add(`req${i}`, 'sheet1', { range: `A${i}` })
      );

      // Wait for execution
      await Promise.all(promises);

      // Should execute immediately when max size reached
      expect(executedBatches.length).toBe(1);
      expect(executedBatches[0]).toHaveLength(5);
    });

    it('should group by spreadsheet', async () => {
      const promise1 = aggregator.add('req1', 'sheet1', { range: 'A1' });
      const promise2 = aggregator.add('req2', 'sheet2', { range: 'A1' });
      const promise3 = aggregator.add('req3', 'sheet1', { range: 'A2' });

      await Promise.all([promise1, promise2, promise3]);

      // Should create 2 batches (one per spreadsheet)
      expect(executedBatches.length).toBe(2);

      // Check grouping
      const sheet1Batch = executedBatches.find(b => b[0]?.spreadsheetId === 'sheet1');
      const sheet2Batch = executedBatches.find(b => b[0]?.spreadsheetId === 'sheet2');

      expect(sheet1Batch).toHaveLength(2);
      expect(sheet2Batch).toHaveLength(1);
    });

    it('should resolve individual promises with correct results', async () => {
      const promise1 = aggregator.add('req1', 'sheet1', { range: 'A1' });
      const promise2 = aggregator.add('req2', 'sheet1', { range: 'A2' });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toEqual({ result: 'result-0' });
      expect(result2).toEqual({ result: 'result-1' });
    });

    it('should reject promises when batch fails', async () => {
      const failingAggregator = new BatchAggregator(
        async () => {
          throw new Error('Batch failed');
        },
        { windowMs: 10 }
      );

      const promise = failingAggregator.add('req1', 'sheet1', { range: 'A1' });

      await expect(promise).rejects.toThrow('Batch failed');
    });
  });

  describe('flush', () => {
    it('should execute all pending windows immediately', async () => {
      aggregator.add('req1', 'sheet1', { range: 'A1' });
      aggregator.add('req2', 'sheet1', { range: 'A2' });

      // Don't wait for window to expire
      await aggregator.flush();

      expect(executedBatches.length).toBe(1);
      expect(executedBatches[0]).toHaveLength(2);
    });

    it('should handle multiple spreadsheets', async () => {
      aggregator.add('req1', 'sheet1', { range: 'A1' });
      aggregator.add('req2', 'sheet2', { range: 'A1' });
      aggregator.add('req3', 'sheet3', { range: 'A1' });

      await aggregator.flush();

      expect(executedBatches.length).toBe(3);
    });
  });

  describe('statistics', () => {
    it('should track batch statistics', async () => {
      const promise1 = aggregator.add('req1', 'sheet1', { range: 'A1' });
      const promise2 = aggregator.add('req2', 'sheet1', { range: 'A2' });
      const promise3 = aggregator.add('req3', 'sheet1', { range: 'A3' });

      await Promise.all([promise1, promise2, promise3]);

      const stats = aggregator.getStats();

      expect(stats.totalRequests).toBe(3);
      expect(stats.batchedRequests).toBe(3);
      expect(stats.batchesSent).toBe(1);
      expect(stats.averageBatchSize).toBe(3);
      expect(stats.apiCallReduction).toBeCloseTo(66.67, 1);
    });

    it('should calculate API call reduction correctly', async () => {
      // Send 10 requests that get batched into 2 batches
      const promises: Promise<any>[] = [];

      for (let i = 0; i < 5; i++) {
        promises.push(aggregator.add(`req${i}`, 'sheet1', { range: `A${i}` }));
      }
      await Promise.all(promises);

      const promises2: Promise<any>[] = [];
      for (let i = 5; i < 10; i++) {
        promises2.push(aggregator.add(`req${i}`, 'sheet1', { range: `A${i}` }));
      }
      await Promise.all(promises2);

      const stats = aggregator.getStats();

      // 10 requests → 2 batch calls = 80% reduction
      expect(stats.totalRequests).toBe(10);
      expect(stats.batchesSent).toBe(2);
      expect(stats.apiCallReduction).toBeCloseTo(80, 0);
    });

    it('should reset statistics', async () => {
      await aggregator.add('req1', 'sheet1', { range: 'A1' });
      await aggregator.flush();

      aggregator.resetStats();

      const stats = aggregator.getStats();

      expect(stats.totalRequests).toBe(0);
      expect(stats.batchedRequests).toBe(0);
      expect(stats.batchesSent).toBe(0);
    });
  });

  describe('window behavior', () => {
    it('should execute after window timeout', async () => {
      const promise = aggregator.add('req1', 'sheet1', { range: 'A1' });

      // Should execute after 50ms window
      await promise;

      expect(executedBatches.length).toBe(1);
    });

    it('should handle rapid sequential requests', async () => {
      const promises: Promise<any>[] = [];

      // Add 20 requests rapidly
      for (let i = 0; i < 20; i++) {
        promises.push(aggregator.add(`req${i}`, 'sheet1', { range: `A${i}` }));
      }

      await Promise.all(promises);

      // Should batch into groups of 5 (maxBatchSize)
      expect(executedBatches.length).toBe(4);
      executedBatches.forEach(batch => {
        expect(batch.length).toBeLessThanOrEqual(5);
      });
    });

    it('should handle slow requests correctly', async () => {
      const promise1 = aggregator.add('req1', 'sheet1', { range: 'A1' });

      // Wait for first window to execute
      await promise1;

      // Add another request (new window)
      const promise2 = aggregator.add('req2', 'sheet1', { range: 'A2' });
      await promise2;

      // Should create 2 separate batches
      expect(executedBatches.length).toBe(2);
      expect(executedBatches[0]).toHaveLength(1);
      expect(executedBatches[1]).toHaveLength(1);
    });
  });

  describe('getPendingCount', () => {
    it('should return number of pending windows', () => {
      aggregator.add('req1', 'sheet1', { range: 'A1' });
      aggregator.add('req2', 'sheet2', { range: 'A1' });

      expect(aggregator.getPendingCount()).toBe(2);
    });

    it('should return 0 after flush', async () => {
      aggregator.add('req1', 'sheet1', { range: 'A1' });

      expect(aggregator.getPendingCount()).toBe(1);

      await aggregator.flush();

      expect(aggregator.getPendingCount()).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all pending windows', () => {
      aggregator.add('req1', 'sheet1', { range: 'A1' });
      aggregator.add('req2', 'sheet2', { range: 'A1' });

      expect(aggregator.getPendingCount()).toBe(2);

      aggregator.clear();

      expect(aggregator.getPendingCount()).toBe(0);
    });
  });

  describe('concurrent batches', () => {
    it('should handle concurrent batches from different spreadsheets', async () => {
      const promises = [
        aggregator.add('req1', 'sheet1', { range: 'A1' }),
        aggregator.add('req2', 'sheet1', { range: 'A2' }),
        aggregator.add('req3', 'sheet2', { range: 'A1' }),
        aggregator.add('req4', 'sheet2', { range: 'A2' }),
        aggregator.add('req5', 'sheet3', { range: 'A1' }),
      ];

      await Promise.all(promises);

      // Should create multiple batches
      expect(executedBatches.length).toBeGreaterThan(0);

      // Verify each batch contains requests from same spreadsheet (key property)
      executedBatches.forEach(batch => {
        const spreadsheetId = batch[0]?.spreadsheetId;
        expect(batch.every(req => req.spreadsheetId === spreadsheetId)).toBe(true);
      });

      // Verify we have batches for all three spreadsheets
      const spreadsheetIds = new Set(
        executedBatches.flat().map(req => req.spreadsheetId)
      );
      expect(spreadsheetIds.size).toBeGreaterThanOrEqual(3);
    });
  });
});
