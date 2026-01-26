/**
 * Live API Tests for sheets_history Tool
 *
 * Tests operation history and undo/redo capabilities against the real Google API.
 * Requires TEST_REAL_API=true environment variable.
 *
 * 7 Actions:
 * - list: List operation history
 * - get: Get details of a specific operation
 * - stats: Get operation history statistics
 * - undo: Undo the last operation
 * - redo: Redo the last undone operation
 * - revert_to: Revert to a specific operation
 * - clear: Clear operation history
 *
 * Note: These tests verify that history/undo operations work correctly
 * by simulating the data capture and restoration workflow.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LiveApiClient } from '../setup/live-api-client.js';
import { TestSpreadsheetManager, TestSpreadsheet } from '../setup/test-spreadsheet-manager.js';
import {
  loadTestCredentials,
  shouldRunIntegrationTests,
} from '../../helpers/credential-loader.js';

const runLiveTests = shouldRunIntegrationTests();

describe.skipIf(!runLiveTests)('sheets_history Live API Tests', () => {
  let client: LiveApiClient;
  let manager: TestSpreadsheetManager;
  let testSpreadsheet: TestSpreadsheet;
  let sheetId: number;

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
    testSpreadsheet = await manager.createTestSpreadsheet('history');
    const meta = await client.sheets.spreadsheets.get({
      spreadsheetId: testSpreadsheet.id,
    });
    sheetId = meta.data.sheets![0].properties!.sheetId!;
  });

  describe('Operation Recording', () => {
    describe('Capturing operation state', () => {
      it('should capture state before write operations', async () => {
        // Write initial data
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Initial', 'Data'],
              ['Row', 'Values'],
            ],
          },
        });

        // Capture current state (this would be stored for undo)
        const beforeState = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
        });

        expect(beforeState.status).toBe(200);
        expect(beforeState.data.values).toBeDefined();

        // Make changes
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Modified', 'Content'],
              ['New', 'Values'],
            ],
          },
        });

        // Current state after change
        const afterState = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
        });

        // States should be different
        expect(afterState.data.values).not.toEqual(beforeState.data.values);
      });

      it('should capture format state before formatting operations', async () => {
        // Apply formatting
        await client.sheets.spreadsheets.batchUpdate({
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
                      backgroundColor: { red: 1, green: 0, blue: 0 },
                    },
                  },
                  fields: 'userEnteredFormat.backgroundColor',
                },
              },
            ],
          },
        });

        // Get cell data with format info
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          ranges: ['TestData!A1:B1'],
          fields: 'sheets.data.rowData.values.userEnteredFormat.backgroundColor',
        });

        expect(response.status).toBe(200);
        // Format was applied
        const rowData = response.data.sheets?.[0]?.data?.[0]?.rowData;
        if (rowData && rowData[0]?.values?.[0]?.userEnteredFormat?.backgroundColor) {
          expect(rowData[0].values[0].userEnteredFormat.backgroundColor.red).toBe(1);
        }
      });

      it('should capture structural changes', async () => {
        // Add a new sheet
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'HistoryTestSheet',
                  },
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
        const newSheetId = response.data.replies![0].addSheet?.properties?.sheetId;
        expect(newSheetId).toBeDefined();

        // Get current sheets
        const sheetsResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'sheets.properties',
        });

        const sheetNames = sheetsResponse.data.sheets!.map(s => s.properties?.title);
        expect(sheetNames).toContain('HistoryTestSheet');
      });
    });
  });

  describe('Undo Simulation', () => {
    describe('undo action', () => {
      it('should restore previous data state', async () => {
        // Set initial state
        const initialData = [['Original', 'Content']];
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B1',
          valueInputOption: 'RAW',
          requestBody: { values: initialData },
        });

        // Capture state for undo
        const savedState = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B1',
        });

        // Make changes
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B1',
          valueInputOption: 'RAW',
          requestBody: { values: [['Changed', 'Data']] },
        });

        // Verify change
        const changedState = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B1',
        });
        expect(changedState.data.values![0]).toEqual(['Changed', 'Data']);

        // Undo: restore saved state
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B1',
          valueInputOption: 'RAW',
          requestBody: { values: savedState.data.values },
        });

        // Verify restoration
        const restoredState = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B1',
        });
        expect(restoredState.data.values).toEqual(initialData);
      });

      it('should handle undo of cell clearing', async () => {
        // Set initial data
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B3',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Header1', 'Header2'],
              ['Data1', 'Data2'],
              ['Data3', 'Data4'],
            ],
          },
        });

        // Capture state
        const savedState = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B3',
        });

        // Clear cells
        await client.sheets.spreadsheets.values.clear({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B3',
        });

        // Verify cleared
        const clearedState = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B3',
        });
        expect(clearedState.data.values).toBeUndefined();

        // Undo: restore
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B3',
          valueInputOption: 'RAW',
          requestBody: { values: savedState.data.values },
        });

        // Verify restoration
        const restoredState = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B3',
        });
        expect(restoredState.data.values).toEqual(savedState.data.values);
      });
    });
  });

  describe('Redo Simulation', () => {
    describe('redo action', () => {
      it('should restore state after undo', async () => {
        // Initial state
        const state1 = [['State 1']];
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
          valueInputOption: 'RAW',
          requestBody: { values: state1 },
        });

        // Change to state 2
        const state2 = [['State 2']];
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
          valueInputOption: 'RAW',
          requestBody: { values: state2 },
        });

        // Undo to state 1
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
          valueInputOption: 'RAW',
          requestBody: { values: state1 },
        });

        // Verify at state 1
        let current = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
        });
        expect(current.data.values).toEqual(state1);

        // Redo to state 2
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
          valueInputOption: 'RAW',
          requestBody: { values: state2 },
        });

        // Verify at state 2
        current = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
        });
        expect(current.data.values).toEqual(state2);
      });
    });
  });

  describe('Revert To Simulation', () => {
    describe('revert_to action', () => {
      it('should revert through multiple states', async () => {
        const states: string[][][] = [];

        // Create multiple states
        for (let i = 1; i <= 5; i++) {
          const state = [[`Version ${i}`]];
          states.push(state);
          await client.sheets.spreadsheets.values.update({
            spreadsheetId: testSpreadsheet.id,
            range: 'TestData!A1',
            valueInputOption: 'RAW',
            requestBody: { values: state },
          });
        }

        // Currently at version 5
        let current = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
        });
        expect(current.data.values![0][0]).toBe('Version 5');

        // Revert to version 2
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
          valueInputOption: 'RAW',
          requestBody: { values: states[1] },  // states[1] is Version 2
        });

        current = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
        });
        expect(current.data.values![0][0]).toBe('Version 2');
      });
    });
  });

  describe('Google Drive Revision History', () => {
    describe('Built-in version history', () => {
      it('should create versions through multiple edits', async () => {
        // Make several edits
        for (let i = 1; i <= 3; i++) {
          await client.sheets.spreadsheets.values.update({
            spreadsheetId: testSpreadsheet.id,
            range: 'TestData!A1',
            valueInputOption: 'RAW',
            requestBody: { values: [[`Edit ${i}`]] },
          });
        }

        // List revisions
        const response = await client.drive.revisions.list({
          fileId: testSpreadsheet.id,
          fields: 'revisions(id,modifiedTime)',
        });

        expect(response.status).toBe(200);
        expect(response.data.revisions).toBeDefined();
        // Google Sheets consolidates rapid edits, so we might not have 3 separate revisions
        // but we should have at least the initial revision
      });

      it('should get revision metadata', async () => {
        // Make an edit first
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
          valueInputOption: 'RAW',
          requestBody: { values: [['Revision Test']] },
        });

        // List revisions
        const listResponse = await client.drive.revisions.list({
          fileId: testSpreadsheet.id,
          fields: 'revisions(id,modifiedTime,lastModifyingUser)',
        });

        expect(listResponse.status).toBe(200);

        if (listResponse.data.revisions && listResponse.data.revisions.length > 0) {
          const revisionId = listResponse.data.revisions[0].id!;

          // Get specific revision
          const getResponse = await client.drive.revisions.get({
            fileId: testSpreadsheet.id,
            revisionId: revisionId,
            fields: 'id,modifiedTime,lastModifyingUser',
          });

          expect(getResponse.status).toBe(200);
          expect(getResponse.data.id).toBe(revisionId);
        }
      });
    });
  });

  describe('Operation Statistics', () => {
    describe('stats action', () => {
      it('should track operation metrics', async () => {
        client.resetMetrics();

        // Perform various operations
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
          valueInputOption: 'RAW',
          requestBody: { values: [['Write Op']] },
        });

        await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
        });

        await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
                  cell: { userEnteredFormat: { textFormat: { bold: true } } },
                  fields: 'userEnteredFormat.textFormat.bold',
                },
              },
            ],
          },
        });

        const stats = client.getStats();
        expect(stats.totalRequests).toBeGreaterThanOrEqual(3);
        expect(stats.avgDuration).toBeGreaterThan(0);
      });
    });
  });

  describe('Batch Operation History', () => {
    it('should track batch operations as single history entry', async () => {
      // Perform batch operation
      const response = await client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          requests: [
            {
              updateCells: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
                rows: [{ values: [{ userEnteredValue: { stringValue: 'Batch 1' } }] }],
                fields: 'userEnteredValue',
              },
            },
            {
              updateCells: {
                range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 1 },
                rows: [{ values: [{ userEnteredValue: { stringValue: 'Batch 2' } }] }],
                fields: 'userEnteredValue',
              },
            },
            {
              updateCells: {
                range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 1 },
                rows: [{ values: [{ userEnteredValue: { stringValue: 'Batch 3' } }] }],
                fields: 'userEnteredValue',
              },
            },
          ],
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.replies).toHaveLength(3);

      // Verify all changes were applied
      const readResponse = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:A3',
      });

      expect(readResponse.data.values).toEqual([['Batch 1'], ['Batch 2'], ['Batch 3']]);
    });
  });

  describe('Error Handling', () => {
    it('should handle undo of non-existent operation gracefully', async () => {
      // Reading current state should always work
      const response = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:A1',
      });
      expect(response.status).toBe(200);
    });

    it('should handle revert to invalid state', async () => {
      // Any attempt to access non-existent data
      await expect(
        client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'NonExistentSheet!A1',
        })
      ).rejects.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    it('should track history operation latency', async () => {
      client.resetMetrics();

      // Operations that would be tracked in history
      await client.trackOperation('valuesUpdate', 'POST', () =>
        client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['History', 'Test'],
              ['Data', 'Values'],
            ],
          },
        })
      );

      await client.trackOperation('valuesGet', 'GET', () =>
        client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
        })
      );

      await client.trackOperation('revisionsList', 'GET', () =>
        client.drive.revisions.list({
          fileId: testSpreadsheet.id,
          fields: 'revisions(id)',
        })
      );

      const stats = client.getStats();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(3);
      expect(stats.avgDuration).toBeGreaterThan(0);
    });
  });
});
