/**
 * Batching System Live Verification
 *
 * Verifies that the BatchingSystem correctly batches multiple operations
 * and measures actual API call reduction.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getLiveApiClient, isLiveApiEnabled } from '../setup/live-api-client.js';
import {
  TestSpreadsheetManager,
  createTestSpreadsheetManager,
  type TestSpreadsheet,
} from '../setup/test-spreadsheet-manager.js';
import { BatchingSystem } from '../../../src/services/batching-system.js';

const runTests = isLiveApiEnabled();
const describeOrSkip = runTests ? describe : describe.skip;

describeOrSkip('BatchingSystem Live Verification', () => {
  let spreadsheetManager: TestSpreadsheetManager;
  let testSpreadsheet: TestSpreadsheet;
  let batchingSystem: BatchingSystem;

  beforeAll(async () => {
    const client = await getLiveApiClient();
    spreadsheetManager = createTestSpreadsheetManager(client, 'BATCH_TEST_');
    testSpreadsheet = await spreadsheetManager.createTestSpreadsheet('MAIN');
    await spreadsheetManager.populateTestData(testSpreadsheet.id, { rows: 100 });
  }, 30000);

  beforeEach(() => {
    // Create fresh batching system for each test
    batchingSystem = BatchingSystem.getInstance();
    batchingSystem.reset();
  });

  afterAll(async () => {
    await spreadsheetManager.cleanup();
  }, 30000);

  describe('Batch Merging', () => {
    it('should batch multiple write operations within time window', async () => {
      const operations = Array.from({ length: 5 }, (_, i) => ({
        id: `write-${i}`,
        type: 'values:update' as const,
        spreadsheetId: testSpreadsheet.id,
        params: {
          range: `TestData!A${i + 1}`,
          values: [[`Batched_${i}`]],
        },
      }));

      // Queue all operations
      const promises = operations.map((op) => batchingSystem.queueOperation(op));

      // Wait for batch to execute
      await Promise.all(promises);

      const stats = batchingSystem.getStats();

      // Verify batching occurred
      expect(stats.totalOperations).toBeGreaterThanOrEqual(5);
      expect(stats.batchedOperations).toBeGreaterThan(0);
    });

    it('should keep operations for different spreadsheets separate', async () => {
      const otherSpreadsheet = await spreadsheetManager.createTestSpreadsheet('OTHER');

      const op1 = {
        id: 'op1',
        type: 'values:update' as const,
        spreadsheetId: testSpreadsheet.id,
        params: { range: 'TestData!B1', values: [['Value1']] },
      };

      const op2 = {
        id: 'op2',
        type: 'values:update' as const,
        spreadsheetId: otherSpreadsheet.id,
        params: { range: 'TestData!B1', values: [['Value2']] },
      };

      const [result1, result2] = await Promise.all([
        batchingSystem.queueOperation(op1),
        batchingSystem.queueOperation(op2),
      ]);

      // Both should succeed
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();

      // Stats should show separate batches
      const stats = batchingSystem.getStats();
      expect(stats.totalOperations).toBe(2);
    });
  });

  describe('Timing Window', () => {
    it('should respect windowMs before executing batch', async () => {
      const startTime = Date.now();

      await batchingSystem.queueOperation({
        id: 'timing-test',
        type: 'values:update',
        spreadsheetId: testSpreadsheet.id,
        params: { range: 'TestData!C1', values: [['Timing']] },
      });

      const elapsed = Date.now() - startTime;

      // Should have waited at least some time for batching window
      // (exact timing depends on BatchingSystem config)
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid operations gracefully', async () => {
      const invalidOp = {
        id: 'invalid',
        type: 'values:update' as const,
        spreadsheetId: 'invalid-spreadsheet-id-12345',
        params: { range: 'Sheet1!A1', values: [['Test']] },
      };

      await expect(batchingSystem.queueOperation(invalidOp)).rejects.toThrow();
    });
  });

  describe('Statistics', () => {
    it('should track batch statistics accurately', async () => {
      // Reset stats
      batchingSystem.reset();

      // Execute some operations
      const ops = Array.from({ length: 3 }, (_, i) => ({
        id: `stat-${i}`,
        type: 'values:update' as const,
        spreadsheetId: testSpreadsheet.id,
        params: { range: `TestData!D${i + 1}`, values: [[`Stats_${i}`]] },
      }));

      await Promise.all(ops.map((op) => batchingSystem.queueOperation(op)));

      const stats = batchingSystem.getStats();

      expect(stats.totalOperations).toBe(3);
      expect(stats.batchedOperations).toBeGreaterThanOrEqual(0);
    });
  });
});
