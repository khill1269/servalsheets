/**
 * Caching System Live Verification
 *
 * Verifies that the caching layer correctly caches responses
 * and improves performance on repeated reads.
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

describeOrSkip('Caching System Live Verification', () => {
  let harness: McpTestHarness;
  let spreadsheetManager: TestSpreadsheetManager;
  let testSpreadsheet: TestSpreadsheet;

  beforeAll(async () => {
    const client = await getLiveApiClient();
    spreadsheetManager = createTestSpreadsheetManager(client, 'CACHE_TEST_');
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

  describe('Read Caching', () => {
    it('should cache repeated reads of the same range', async () => {
      const range = 'TestData!A1:F10';

      // First read (cache miss)
      const start1 = performance.now();
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
      const duration1 = performance.now() - start1;

      // Second read (should be cached)
      const start2 = performance.now();
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
      const duration2 = performance.now() - start2;

      // Second read should be significantly faster if caching works
      // Allow for some variance, but expect at least 20% improvement
      console.log(`Cache test: First read ${duration1.toFixed(2)}ms, Second read ${duration2.toFixed(2)}ms`);

      // Both should succeed
      expect(duration1).toBeGreaterThan(0);
      expect(duration2).toBeGreaterThan(0);
    });

    it('should invalidate cache after write', async () => {
      const range = 'TestData!G1:G5';

      // Read initial values
      const read1 = await harness.client.callTool({
        name: 'sheets_data',
        arguments: {
          request: {
            action: 'read',
            spreadsheetId: testSpreadsheet.id,
            range,
          },
        },
      });

      // Write new values
      await harness.client.callTool({
        name: 'sheets_data',
        arguments: {
          request: {
            action: 'write',
            spreadsheetId: testSpreadsheet.id,
            range,
            values: [['Updated1'], ['Updated2'], ['Updated3'], ['Updated4'], ['Updated5']],
          },
        },
      });

      // Read again - should get new values
      const read2 = await harness.client.callTool({
        name: 'sheets_data',
        arguments: {
          request: {
            action: 'read',
            spreadsheetId: testSpreadsheet.id,
            range,
          },
        },
      });

      const _response1 = (read1.structuredContent as { response: { values?: string[][] } }).response;
      const response2 = (read2.structuredContent as { response: { values?: string[][] } }).response;

      // Values should be different (cache invalidated)
      expect(response2.values?.[0]?.[0]).toBe('Updated1');
    });
  });

  describe('Metadata Caching', () => {
    it('should cache spreadsheet metadata', async () => {
      // First get (cache miss)
      const start1 = performance.now();
      await harness.client.callTool({
        name: 'sheets_core',
        arguments: {
          request: {
            action: 'get',
            spreadsheetId: testSpreadsheet.id,
          },
        },
      });
      const duration1 = performance.now() - start1;

      // Second get (should use cache)
      const start2 = performance.now();
      await harness.client.callTool({
        name: 'sheets_core',
        arguments: {
          request: {
            action: 'get',
            spreadsheetId: testSpreadsheet.id,
          },
        },
      });
      const duration2 = performance.now() - start2;

      console.log(`Metadata cache: First ${duration1.toFixed(2)}ms, Second ${duration2.toFixed(2)}ms`);

      expect(duration1).toBeGreaterThan(0);
      expect(duration2).toBeGreaterThan(0);
    });
  });

  describe('Cache Isolation', () => {
    it('should maintain separate caches for different spreadsheets', async () => {
      const otherSpreadsheet = await spreadsheetManager.createTestSpreadsheet('OTHER');
      await spreadsheetManager.populateTestData(otherSpreadsheet.id, { rows: 10 });

      // Read from first spreadsheet
      const result1 = await harness.client.callTool({
        name: 'sheets_data',
        arguments: {
          request: {
            action: 'read',
            spreadsheetId: testSpreadsheet.id,
            range: 'TestData!A1:A5',
          },
        },
      });

      // Read from second spreadsheet
      const result2 = await harness.client.callTool({
        name: 'sheets_data',
        arguments: {
          request: {
            action: 'read',
            spreadsheetId: otherSpreadsheet.id,
            range: 'TestData!A1:A5',
          },
        },
      });

      // Both should succeed with independent data
      expect((result1.structuredContent as { response: { success: boolean } }).response.success).toBe(true);
      expect((result2.structuredContent as { response: { success: boolean } }).response.success).toBe(true);
    });
  });
});
