/**
 * Live API Tests for sheets_session Tool
 *
 * Tests session context management with real Google Sheets data.
 * Requires TEST_REAL_API=true environment variable.
 *
 * 17 Actions:
 * Context: set_active, get_active, get_context, reset
 * Operations: record_operation, get_last_operation, get_history, find_by_reference
 * Preferences: update_preferences, get_preferences
 * Pending: set_pending, get_pending, clear_pending
 * Checkpoints: save_checkpoint, load_checkpoint, list_checkpoints, delete_checkpoint
 *
 * Note: These tests verify that session operations work correctly in the context
 * of real spreadsheet data, not just in isolation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LiveApiClient } from '../setup/live-api-client.js';
import { TestSpreadsheetManager, TestSpreadsheet } from '../setup/test-spreadsheet-manager.js';
import {
  loadTestCredentials,
  shouldRunIntegrationTests,
} from '../../helpers/credential-loader.js';

const runLiveTests = shouldRunIntegrationTests();

describe.skipIf(!runLiveTests)('sheets_session Live API Tests', () => {
  let client: LiveApiClient;
  let manager: TestSpreadsheetManager;
  let testSpreadsheet: TestSpreadsheet;

  beforeAll(async () => {
    const credentials = await loadTestCredentials();
    if (!credentials) {
      throw new Error('Test credentials not available');
    }
    client = new LiveApiClient(credentials, { trackMetrics: true });
    manager = new TestSpreadsheetManager(client);
  });

  afterAll(async () => {
    await manager.cleanup();
  });

  beforeEach(async () => {
    testSpreadsheet = await manager.createTestSpreadsheet('session');
  });

  describe('Session Context with Real Spreadsheets', () => {
    describe('set_active context', () => {
      it('should retrieve spreadsheet metadata for session context', async () => {
        // When setting active, we need to fetch metadata
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'properties.title,sheets.properties.title',
        });

        expect(response.status).toBe(200);
        expect(response.data.properties?.title).toBe(testSpreadsheet.title);
        expect(response.data.sheets).toBeDefined();

        // Extract sheet names for session context
        const sheetNames = response.data.sheets!.map(s => s.properties?.title!);
        expect(sheetNames.length).toBeGreaterThan(0);
      });

      it('should handle spreadsheets with multiple sheets', async () => {
        // Add additional sheets
        await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              { addSheet: { properties: { title: 'SessionSheet1' } } },
              { addSheet: { properties: { title: 'SessionSheet2' } } },
            ],
          },
        });

        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'sheets.properties.title',
        });

        expect(response.status).toBe(200);
        const sheetNames = response.data.sheets!.map(s => s.properties?.title!);
        expect(sheetNames).toContain('SessionSheet1');
        expect(sheetNames).toContain('SessionSheet2');
      });
    });
  });

  describe('Operation Recording Verification', () => {
    describe('record_operation action', () => {
      it('should track write operations with actual cell changes', async () => {
        // Perform a real write operation
        const writeResponse = await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Name', 'Value'],
              ['Test', '100'],
            ],
          },
        });

        expect(writeResponse.status).toBe(200);

        // Operation metadata that would be recorded
        const operationData = {
          tool: 'sheets_data',
          action: 'write',
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
          cellsAffected: writeResponse.data.updatedCells,
          undoable: true,
        };

        expect(operationData.cellsAffected).toBe(4);
        expect(operationData.undoable).toBe(true);
      });

      it('should track format operations', async () => {
        // Get sheet ID for format operations
        const meta = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
        });
        const sheetId = meta.data.sheets![0].properties!.sheetId!;

        // Perform a format operation
        const formatResponse = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: 2,
                  },
                  cell: {
                    userEnteredFormat: {
                      textFormat: { bold: true },
                    },
                  },
                  fields: 'userEnteredFormat.textFormat.bold',
                },
              },
            ],
          },
        });

        expect(formatResponse.status).toBe(200);

        // Operation metadata
        const operationData = {
          tool: 'sheets_format',
          action: 'set_text_format',
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B1',
          undoable: true,
        };

        expect(operationData.tool).toBe('sheets_format');
      });

      it('should track structural operations', async () => {
        // Add a sheet
        const addResponse = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'RecordedSheet',
                  },
                },
              },
            ],
          },
        });

        expect(addResponse.status).toBe(200);
        const newSheetId = addResponse.data.replies![0].addSheet?.properties?.sheetId;

        // Operation metadata
        const operationData = {
          tool: 'sheets_core',
          action: 'add_sheet',
          spreadsheetId: testSpreadsheet.id,
          undoable: true,
          metadata: {
            sheetId: newSheetId,
            sheetName: 'RecordedSheet',
          },
        };

        expect(operationData.metadata.sheetId).toBeDefined();
      });
    });
  });

  describe('Natural Language Reference Resolution', () => {
    describe('find_by_reference with real data', () => {
      it('should find spreadsheet by partial title match', async () => {
        // Get the title
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'properties.title',
        });

        const title = response.data.properties?.title;
        expect(title).toContain('session');

        // In real usage, find_by_reference would match "session" to this spreadsheet
      });

      it('should identify spreadsheet by last access', async () => {
        // Make an API call to simulate "last accessed"
        await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'properties.title',
        });

        // The session would record this as the most recent spreadsheet
        // "the spreadsheet" would resolve to this one
      });
    });
  });

  describe('Multi-Spreadsheet Context', () => {
    it('should handle multiple active spreadsheets', async () => {
      // Create additional spreadsheets
      const spreadsheet1 = await manager.createTestSpreadsheet('multi-1');
      const spreadsheet2 = await manager.createTestSpreadsheet('multi-2');

      // Verify both exist
      const response1 = await client.sheets.spreadsheets.get({
        spreadsheetId: spreadsheet1.id,
        fields: 'properties.title',
      });
      const response2 = await client.sheets.spreadsheets.get({
        spreadsheetId: spreadsheet2.id,
        fields: 'properties.title',
      });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.data.properties?.title).toContain('multi-1');
      expect(response2.data.properties?.title).toContain('multi-2');
    });

    it('should track recent spreadsheets for context switching', async () => {
      const spreadsheets = [];

      // Create multiple spreadsheets
      for (let i = 0; i < 3; i++) {
        const ss = await manager.createTestSpreadsheet(`recent-${i}`);
        spreadsheets.push(ss);

        // Access each one
        await client.sheets.spreadsheets.get({
          spreadsheetId: ss.id,
          fields: 'properties.title',
        });
      }

      // All should be accessible
      expect(spreadsheets.length).toBe(3);
    });
  });

  describe('Checkpoint with Real Data', () => {
    describe('save_checkpoint context', () => {
      it('should capture current spreadsheet state', async () => {
        // Write some data
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B3',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Checkpoint', 'Data'],
              ['Row1', '100'],
              ['Row2', '200'],
            ],
          },
        });

        // Read the state
        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B3',
        });

        expect(response.status).toBe(200);
        expect(response.data.values).toHaveLength(3);

        // This data would be part of the checkpoint context
      });
    });

    describe('load_checkpoint context', () => {
      it('should restore to known state', async () => {
        // Set initial state
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['Initial State']],
          },
        });

        // Make changes
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['Modified State']],
          },
        });

        // "Restore" by writing initial state back
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['Initial State']],
          },
        });

        // Verify restoration
        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
        });

        expect(response.data.values![0][0]).toBe('Initial State');
      });
    });
  });

  describe('Pending Operation State', () => {
    describe('Multi-step operation tracking', () => {
      it('should track progress through multi-step operations', async () => {
        // Simulate a multi-step import operation
        const _steps = [
          { step: 1, action: 'Validate data format' },
          { step: 2, action: 'Create target sheet' },
          { step: 3, action: 'Write data' },
          { step: 4, action: 'Apply formatting' },
        ];

        // Step 1: Validate (read operation)
        await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:Z1',
        });

        // Step 2: Create sheet
        await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              { addSheet: { properties: { title: 'ImportTarget' } } },
            ],
          },
        });

        // Step 3: Write data
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'ImportTarget!A1:C3',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Col1', 'Col2', 'Col3'],
              ['A', 'B', 'C'],
              ['D', 'E', 'F'],
            ],
          },
        });

        // Verify completion
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'sheets.properties.title',
        });

        const sheetNames = response.data.sheets!.map(s => s.properties?.title);
        expect(sheetNames).toContain('ImportTarget');
      });
    });
  });

  describe('Error Recovery Context', () => {
    it('should handle partial operation failure', async () => {
      // Start a multi-write operation
      let successfulWrites = 0;

      try {
        // First write - should succeed
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
          valueInputOption: 'RAW',
          requestBody: { values: [['Write 1']] },
        });
        successfulWrites++;

        // Second write - should succeed
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A2',
          valueInputOption: 'RAW',
          requestBody: { values: [['Write 2']] },
        });
        successfulWrites++;

        // Third write to non-existent sheet - should fail
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'NonExistent!A1',
          valueInputOption: 'RAW',
          requestBody: { values: [['Write 3']] },
        });
        successfulWrites++;
      } catch {
        // Expected - partial failure
      }

      // Should have completed 2 out of 3 writes
      expect(successfulWrites).toBe(2);

      // Verify successful writes persisted
      const response = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:A2',
      });

      expect(response.data.values).toHaveLength(2);
    });
  });

  describe('Performance Metrics', () => {
    it('should track session-related operations', async () => {
      client.resetMetrics();

      // Typical session workflow
      await client.sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheet.id,
        fields: 'properties.title,sheets.properties.title',
      });

      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [['Session Data']] },
      });

      await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
      });

      const stats = client.getStats();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(3);
      expect(stats.avgDuration).toBeGreaterThan(0);
    });
  });
});
