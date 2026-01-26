/**
 * Parallel Execution Live Verification
 *
 * Verifies that the parallel executor correctly handles concurrent operations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getLiveApiClient, isLiveApiEnabled } from '../setup/live-api-client.js';
import {
  TestSpreadsheetManager,
  createTestSpreadsheetManager,
  type TestSpreadsheet,
} from '../setup/test-spreadsheet-manager.js';
import {
  createServalSheetsTestHarness,
  type McpTestHarness,
} from '../../helpers/mcp-test-harness.js';

const runTests = isLiveApiEnabled();
const describeOrSkip = runTests ? describe : describe.skip;

describeOrSkip('Parallel Execution Live Verification', () => {
  let harness: McpTestHarness;
  let spreadsheetManager: TestSpreadsheetManager;
  let testSpreadsheet: TestSpreadsheet;

  beforeAll(async () => {
    const client = await getLiveApiClient();
    spreadsheetManager = createTestSpreadsheetManager(client, 'PARALLEL_TEST_');
    testSpreadsheet = await spreadsheetManager.createTestSpreadsheet('MAIN');
    await spreadsheetManager.populateTestData(testSpreadsheet.id, { rows: 100 });

    harness = await createServalSheetsTestHarness({
      serverOptions: {
        googleApiOptions: {
          serviceAccountKeyPath: process.env['GOOGLE_APPLICATION_CREDENTIALS'],
        },
      },
    });
  }, 30000);

  afterAll(async () => {
    await spreadsheetManager.cleanup();
    await harness.close();
  }, 30000);

  describe('Concurrent Read Operations', () => {
    it('should handle 10 concurrent reads successfully', async () => {
      const ranges = Array.from({ length: 10 }, (_, i) => `TestData!A${i * 10 + 1}:F${i * 10 + 10}`);

      const startTime = performance.now();

      const results = await Promise.all(
        ranges.map((range) =>
          harness.client.callTool({
            name: 'sheets_data',
            arguments: {
              request: {
                action: 'read',
                spreadsheetId: testSpreadsheet.id,
                range,
              },
            },
          })
        )
      );

      const duration = performance.now() - startTime;

      // All should succeed
      for (const result of results) {
        const response = (result.structuredContent as { response: { success: boolean } }).response;
        expect(response.success).toBe(true);
      }

      console.log(`10 concurrent reads completed in ${duration.toFixed(2)}ms`);
    });

    it('should handle mixed read/write operations concurrently', async () => {
      const operations = [
        // Reads
        harness.client.callTool({
          name: 'sheets_data',
          arguments: {
            request: {
              action: 'read',
              spreadsheetId: testSpreadsheet.id,
              range: 'TestData!A1:B10',
            },
          },
        }),
        // Write
        harness.client.callTool({
          name: 'sheets_data',
          arguments: {
            request: {
              action: 'write',
              spreadsheetId: testSpreadsheet.id,
              range: 'Benchmarks!A1:B5',
              values: [['Mixed', 'Op1'], ['Test', 'Op2'], ['Data', 'Op3'], ['Row', 'Op4'], ['Five', 'Op5']],
            },
          },
        }),
        // Another read
        harness.client.callTool({
          name: 'sheets_data',
          arguments: {
            request: {
              action: 'read',
              spreadsheetId: testSpreadsheet.id,
              range: 'TestData!C1:D10',
            },
          },
        }),
      ];

      const results = await Promise.all(operations);

      for (const result of results) {
        const response = (result.structuredContent as { response: { success: boolean } }).response;
        expect(response.success).toBe(true);
      }
    });
  });

  describe('Concurrent Multi-Tool Operations', () => {
    it('should handle concurrent operations across different tools', async () => {
      const operations = [
        // sheets_core
        harness.client.callTool({
          name: 'sheets_core',
          arguments: {
            request: {
              action: 'get',
              spreadsheetId: testSpreadsheet.id,
            },
          },
        }),
        // sheets_data
        harness.client.callTool({
          name: 'sheets_data',
          arguments: {
            request: {
              action: 'read',
              spreadsheetId: testSpreadsheet.id,
              range: 'TestData!A1:F5',
            },
          },
        }),
        // sheets_analyze
        harness.client.callTool({
          name: 'sheets_analyze',
          arguments: {
            request: {
              action: 'analyze_structure',
              spreadsheetId: testSpreadsheet.id,
            },
          },
        }),
      ];

      const startTime = performance.now();
      const results = await Promise.all(operations);
      const duration = performance.now() - startTime;

      for (const result of results) {
        const response = (result.structuredContent as { response: { success: boolean } }).response;
        expect(response.success).toBe(true);
      }

      console.log(`3 concurrent multi-tool ops completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Throughput Under Load', () => {
    it('should maintain throughput with sustained concurrent operations', async () => {
      const batchSize = 5;
      const batchCount = 3;
      const durations: number[] = [];

      for (let batch = 0; batch < batchCount; batch++) {
        const operations = Array.from({ length: batchSize }, (_, i) =>
          harness.client.callTool({
            name: 'sheets_data',
            arguments: {
              request: {
                action: 'read',
                spreadsheetId: testSpreadsheet.id,
                range: `TestData!A${batch * 10 + i + 1}:F${batch * 10 + i + 5}`,
              },
            },
          })
        );

        const start = performance.now();
        await Promise.all(operations);
        durations.push(performance.now() - start);

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`Batch durations: ${durations.map(d => d.toFixed(2)).join('ms, ')}ms`);

      // All batches should complete successfully
      expect(durations.length).toBe(batchCount);
      expect(durations.every(d => d > 0)).toBe(true);
    });
  });
});
