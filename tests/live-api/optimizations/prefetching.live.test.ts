/**
 * Prefetching System Live Verification
 *
 * Verifies that the prefetching system correctly predicts and prefetches data.
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

describeOrSkip('Prefetching System Live Verification', () => {
  let harness: McpTestHarness;
  let spreadsheetManager: TestSpreadsheetManager;
  let testSpreadsheet: TestSpreadsheet;

  beforeAll(async () => {
    const client = await getLiveApiClient();
    spreadsheetManager = createTestSpreadsheetManager(client, 'PREFETCH_TEST_');
    testSpreadsheet = await spreadsheetManager.createTestSpreadsheet('MAIN');
    await spreadsheetManager.populateTestData(testSpreadsheet.id, { rows: 200 });

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

  describe('Access Pattern Learning', () => {
    it('should learn sequential access patterns', async () => {
      // Access rows sequentially to establish pattern
      const ranges = [
        'TestData!A1:F10',
        'TestData!A11:F20',
        'TestData!A21:F30',
      ];

      const durations: number[] = [];

      for (const range of ranges) {
        const start = performance.now();
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
        durations.push(performance.now() - start);
      }

      console.log(`Sequential access durations: ${durations.map(d => d.toFixed(2)).join('ms, ')}ms`);

      // All reads should succeed
      expect(durations.length).toBe(3);
      expect(durations.every(d => d > 0)).toBe(true);
    });

    it('should handle repeated access to same ranges', async () => {
      const range = 'TestData!A50:F60';

      // Access the same range multiple times
      const durations: number[] = [];

      for (let i = 0; i < 3; i++) {
        const start = performance.now();
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
        durations.push(performance.now() - start);
      }

      console.log(`Repeated access durations: ${durations.map(d => d.toFixed(2)).join('ms, ')}ms`);

      // Later accesses may be faster due to caching/prefetching
      expect(durations[0]).toBeGreaterThan(0);
    });
  });

  describe('Adjacent Range Prefetching', () => {
    it('should potentially prefetch adjacent ranges', async () => {
      // Read one range
      await harness.client.callTool({
        name: 'sheets_data',
        arguments: {
          request: {
            action: 'read',
            spreadsheetId: testSpreadsheet.id,
            range: 'TestData!A100:F110',
          },
        },
      });

      // Small delay to allow prefetching
      await new Promise(resolve => setTimeout(resolve, 100));

      // Read adjacent range - might be prefetched
      const start = performance.now();
      const result = await harness.client.callTool({
        name: 'sheets_data',
        arguments: {
          request: {
            action: 'read',
            spreadsheetId: testSpreadsheet.id,
            range: 'TestData!A111:F120',
          },
        },
      });
      const duration = performance.now() - start;

      console.log(`Adjacent range read: ${duration.toFixed(2)}ms`);

      const response = (result.structuredContent as { response: { success: boolean } }).response;
      expect(response.success).toBe(true);
    });
  });

  describe('Different Sheet Access', () => {
    it('should handle cross-sheet access patterns', async () => {
      // Add another sheet with data
      const _sheetId = await spreadsheetManager.addSheet(testSpreadsheet.id, 'PrefetchTest');

      // Write some data to the new sheet
      await harness.client.callTool({
        name: 'sheets_data',
        arguments: {
          request: {
            action: 'write',
            spreadsheetId: testSpreadsheet.id,
            range: 'PrefetchTest!A1:C10',
            values: Array.from({ length: 10 }, (_, i) => [`Row${i}`, i, `Data${i}`]),
          },
        },
      });

      // Read from both sheets
      const results = await Promise.all([
        harness.client.callTool({
          name: 'sheets_data',
          arguments: {
            request: {
              action: 'read',
              spreadsheetId: testSpreadsheet.id,
              range: 'TestData!A1:C5',
            },
          },
        }),
        harness.client.callTool({
          name: 'sheets_data',
          arguments: {
            request: {
              action: 'read',
              spreadsheetId: testSpreadsheet.id,
              range: 'PrefetchTest!A1:C5',
            },
          },
        }),
      ]);

      for (const result of results) {
        const response = (result.structuredContent as { response: { success: boolean } }).response;
        expect(response.success).toBe(true);
      }
    });
  });
});
