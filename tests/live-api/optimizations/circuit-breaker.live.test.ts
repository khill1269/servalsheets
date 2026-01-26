/**
 * Circuit Breaker Live Verification
 *
 * Verifies that the circuit breaker correctly handles failures and recovers.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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
import { CircuitBreaker } from '../../../src/utils/circuit-breaker.js';

const runTests = isLiveApiEnabled();
const describeOrSkip = runTests ? describe : describe.skip;

describeOrSkip('Circuit Breaker Live Verification', () => {
  let harness: McpTestHarness;
  let spreadsheetManager: TestSpreadsheetManager;
  let testSpreadsheet: TestSpreadsheet;

  beforeAll(async () => {
    const client = await getLiveApiClient();
    spreadsheetManager = createTestSpreadsheetManager(client, 'CIRCUIT_TEST_');
    testSpreadsheet = await spreadsheetManager.createTestSpreadsheet('MAIN');
    await spreadsheetManager.populateTestData(testSpreadsheet.id, { rows: 50 });

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

  describe('Circuit Breaker Unit Tests', () => {
    let breaker: CircuitBreaker;

    beforeEach(() => {
      breaker = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
        name: 'test-breaker',
      });
    });

    it('should start in closed state', () => {
      expect(breaker.getState()).toBe('closed');
      expect(breaker.isOpen()).toBe(false);
    });

    it('should open after consecutive failures', async () => {
      const failingFn = async (): Promise<string> => {
        throw new Error('Simulated failure');
      };

      // Attempt until circuit opens
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn);
        } catch {
          // Expected to fail
        }
      }

      expect(breaker.getState()).toBe('open');
      expect(breaker.isOpen()).toBe(true);
    });

    it('should reject requests when open', async () => {
      // Force open
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => { throw new Error('fail'); });
        } catch {
          // Expected
        }
      }

      // Should reject immediately
      await expect(
        breaker.execute(async () => 'success')
      ).rejects.toThrow(/Circuit breaker is open/);
    });

    it('should transition to half-open after timeout', async () => {
      // Force open
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => { throw new Error('fail'); });
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('open');

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Next call should be allowed (half-open)
      const result = await breaker.execute(async () => 'recovered');
      expect(result).toBe('recovered');
    });

    it('should close after successful operations in half-open', async () => {
      // Force open
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => { throw new Error('fail'); });
        } catch {
          // Expected
        }
      }

      // Wait for half-open
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Successful operations
      await breaker.execute(async () => 'success1');
      await breaker.execute(async () => 'success2');

      expect(breaker.getState()).toBe('closed');
    });

    it('should track statistics', async () => {
      // Some successful calls
      await breaker.execute(async () => 'ok1');
      await breaker.execute(async () => 'ok2');

      // A failure
      try {
        await breaker.execute(async () => { throw new Error('fail'); });
      } catch {
        // Expected
      }

      const stats = breaker.getStats();
      expect(stats.successCount).toBe(2);
      expect(stats.failureCount).toBe(1);
      expect(stats.totalCount).toBe(3);
    });
  });

  describe('Integration with Live API', () => {
    it('should handle successful operations without tripping', async () => {
      // Execute multiple successful operations
      const operations = Array.from({ length: 5 }, () =>
        harness.client.callTool({
          name: 'sheets_data',
          arguments: {
            request: {
              action: 'read',
              spreadsheetId: testSpreadsheet.id,
              range: 'TestData!A1:F10',
            },
          },
        })
      );

      const results = await Promise.all(operations);

      // All should succeed
      for (const result of results) {
        const response = (result.structuredContent as { response: { success: boolean } }).response;
        expect(response.success).toBe(true);
      }
    });

    it('should handle invalid operations gracefully', async () => {
      // This should fail but not crash
      const result = await harness.client.callTool({
        name: 'sheets_core',
        arguments: {
          request: {
            action: 'get',
            spreadsheetId: 'invalid-spreadsheet-id-that-does-not-exist',
          },
        },
      });

      const response = (result.structuredContent as { response: { success: boolean } }).response;
      // Should return error response, not crash
      expect(response.success).toBe(false);
    });
  });

  describe('Recovery Behavior', () => {
    it('should recover after transient failures', async () => {
      // First, verify we can read
      const result1 = await harness.client.callTool({
        name: 'sheets_data',
        arguments: {
          request: {
            action: 'read',
            spreadsheetId: testSpreadsheet.id,
            range: 'TestData!A1:B5',
          },
        },
      });

      expect((result1.structuredContent as { response: { success: boolean } }).response.success).toBe(true);

      // Even after a failure, subsequent valid operations should work
      try {
        await harness.client.callTool({
          name: 'sheets_data',
          arguments: {
            request: {
              action: 'read',
              spreadsheetId: 'bad-id',
              range: 'Sheet1!A1',
            },
          },
        });
      } catch {
        // Expected to fail
      }

      // This should still work
      const result2 = await harness.client.callTool({
        name: 'sheets_data',
        arguments: {
          request: {
            action: 'read',
            spreadsheetId: testSpreadsheet.id,
            range: 'TestData!A1:B5',
          },
        },
      });

      expect((result2.structuredContent as { response: { success: boolean } }).response.success).toBe(true);
    });
  });
});
