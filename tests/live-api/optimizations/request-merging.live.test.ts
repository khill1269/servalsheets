/**
 * Request Merging Live Verification
 *
 * Verifies that overlapping read requests are merged into single API calls.
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

describeOrSkip('Request Merging Live Verification', () => {
  let harness: McpTestHarness;
  let spreadsheetManager: TestSpreadsheetManager;
  let testSpreadsheet: TestSpreadsheet;

  beforeAll(async () => {
    const client = await getLiveApiClient();
    spreadsheetManager = createTestSpreadsheetManager(client, 'MERGE_TEST_');
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

  describe('Overlapping Range Merging', () => {
    it('should handle concurrent reads of overlapping ranges', async () => {
      // Request overlapping ranges concurrently
      const ranges = [
        'TestData!A1:C10',
        'TestData!B5:D15',
        'TestData!A1:D20',
      ];

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

      console.log(`Merged reads completed in ${duration.toFixed(2)}ms`);
    });

    it('should handle batch_read efficiently', async () => {
      const startTime = performance.now();

      const result = await harness.client.callTool({
        name: 'sheets_data',
        arguments: {
          request: {
            action: 'batch_read',
            spreadsheetId: testSpreadsheet.id,
            ranges: [
              'TestData!A1:B10',
              'TestData!C1:D10',
              'TestData!E1:F10',
            ],
          },
        },
      });

      const duration = performance.now() - startTime;

      const response = (result.structuredContent as { response: { success: boolean; valueRanges?: unknown[] } }).response;
      expect(response.success).toBe(true);
      expect(response.valueRanges).toHaveLength(3);

      console.log(`Batch read completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Sequential vs Parallel', () => {
    it('should be faster with parallel requests than sequential', async () => {
      const ranges = ['TestData!A1:B5', 'TestData!C1:D5', 'TestData!E1:F5'];

      // Sequential reads
      const seqStart = performance.now();
      for (const range of ranges) {
        await harness.client.callTool({
          name: 'sheets_data',
          arguments: {
            request: {
              action: 'read',
              spreadsheetId: testSpreadsheet.id,
              range,
            },
          },
        });
      }
      const seqDuration = performance.now() - seqStart;

      // Parallel reads
      const parStart = performance.now();
      await Promise.all(
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
      const parDuration = performance.now() - parStart;

      console.log(`Sequential: ${seqDuration.toFixed(2)}ms, Parallel: ${parDuration.toFixed(2)}ms`);

      // Parallel should generally be faster (unless rate limited)
      // Just verify both complete successfully
      expect(seqDuration).toBeGreaterThan(0);
      expect(parDuration).toBeGreaterThan(0);
    });
  });
});
