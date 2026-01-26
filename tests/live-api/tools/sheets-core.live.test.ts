/**
 * Live API Tests for sheets_core Tool
 *
 * Tests spreadsheet and sheet management operations against the real Google Sheets API.
 * Requires TEST_REAL_API=true environment variable.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LiveApiClient } from '../setup/live-api-client.js';
import { TestSpreadsheetManager, TestSpreadsheet } from '../setup/test-spreadsheet-manager.js';
import {
  loadTestCredentials,
  shouldRunIntegrationTests,
} from '../../helpers/credential-loader.js';

// Skip all tests if not running against real API
const runLiveTests = shouldRunIntegrationTests();

describe.skipIf(!runLiveTests)('sheets_core Live API Tests', () => {
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
    // Cleanup all test spreadsheets created during this test run
    await manager.cleanup();
  });

  beforeEach(async () => {
    // Create a fresh test spreadsheet for each test
    testSpreadsheet = await manager.createTestSpreadsheet('core');
  });

  describe('Spreadsheet Operations', () => {
    describe('get action', () => {
      it('should retrieve spreadsheet metadata', async () => {
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
        });

        expect(response.status).toBe(200);
        expect(response.data.spreadsheetId).toBe(testSpreadsheet.id);
        expect(response.data.properties?.title).toContain('SERVAL_TEST_');
        expect(response.data.sheets).toBeDefined();
        expect(response.data.sheets!.length).toBeGreaterThan(0);
      });

      it('should include sheet properties in response', async () => {
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          includeGridData: false,
        });

        const firstSheet = response.data.sheets![0];
        expect(firstSheet.properties).toBeDefined();
        expect(firstSheet.properties!.sheetId).toBeDefined();
        expect(firstSheet.properties!.title).toBeDefined();
        expect(firstSheet.properties!.gridProperties).toBeDefined();
      });
    });

    describe('create action', () => {
      it('should create a new spreadsheet', async () => {
        const title = `SERVAL_TEST_created_${Date.now()}`;

        const response = await client.sheets.spreadsheets.create({
          requestBody: {
            properties: {
              title,
            },
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.spreadsheetId).toBeDefined();
        expect(response.data.properties?.title).toBe(title);

        // Track for cleanup
        manager.trackSpreadsheet(response.data.spreadsheetId!);
      });

      it('should create spreadsheet with initial sheets', async () => {
        const title = `SERVAL_TEST_multi_sheet_${Date.now()}`;

        const response = await client.sheets.spreadsheets.create({
          requestBody: {
            properties: { title },
            sheets: [
              { properties: { title: 'Data' } },
              { properties: { title: 'Summary' } },
              { properties: { title: 'Config' } },
            ],
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.sheets).toHaveLength(3);

        const sheetTitles = response.data.sheets!.map((s) => s.properties?.title);
        expect(sheetTitles).toContain('Data');
        expect(sheetTitles).toContain('Summary');
        expect(sheetTitles).toContain('Config');

        // Track for cleanup
        manager.trackSpreadsheet(response.data.spreadsheetId!);
      });
    });

    describe('copy action', () => {
      it('should copy a spreadsheet', async () => {
        // First create a spreadsheet with some data
        const sourceId = testSpreadsheet.id;

        // Add some data to the source
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: sourceId,
          range: 'TestData!A1:B2',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Header1', 'Header2'],
              ['Value1', 'Value2'],
            ],
          },
        });

        // Copy the spreadsheet using Drive API
        const copyResponse = await client.drive.files.copy({
          fileId: sourceId,
          requestBody: {
            name: `SERVAL_TEST_copy_${Date.now()}`,
          },
        });

        expect(copyResponse.status).toBe(200);
        expect(copyResponse.data.id).toBeDefined();
        expect(copyResponse.data.id).not.toBe(sourceId);

        // Track for cleanup
        manager.trackSpreadsheet(copyResponse.data.id!);

        // Verify the copy has the same data
        const verifyResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: copyResponse.data.id!,
          range: 'TestData!A1:B2',
        });

        expect(verifyResponse.data.values).toEqual([
          ['Header1', 'Header2'],
          ['Value1', 'Value2'],
        ]);
      });
    });
  });

  describe('Sheet Operations', () => {
    describe('add_sheet action', () => {
      it('should add a new sheet to spreadsheet', async () => {
        const newSheetTitle = `TestSheet_${Date.now()}`;

        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: newSheetTitle,
                  },
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.replies).toHaveLength(1);

        const addedSheet = response.data.replies![0].addSheet;
        expect(addedSheet?.properties?.title).toBe(newSheetTitle);
        expect(addedSheet?.properties?.sheetId).toBeDefined();
      });

      it('should add sheet with specific properties', async () => {
        const newSheetTitle = `GridSheet_${Date.now()}`;

        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: newSheetTitle,
                    gridProperties: {
                      rowCount: 100,
                      columnCount: 26,
                      frozenRowCount: 1,
                    },
                    tabColor: {
                      red: 0.2,
                      green: 0.6,
                      blue: 0.8,
                    },
                  },
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);

        const addedSheet = response.data.replies![0].addSheet;
        expect(addedSheet?.properties?.gridProperties?.rowCount).toBe(100);
        expect(addedSheet?.properties?.gridProperties?.columnCount).toBe(26);
        expect(addedSheet?.properties?.gridProperties?.frozenRowCount).toBe(1);
      });
    });

    describe('delete_sheet action', () => {
      it('should delete a sheet from spreadsheet', async () => {
        // First add a sheet to delete
        const addResponse = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: `ToDelete_${Date.now()}`,
                  },
                },
              },
            ],
          },
        });

        const sheetId = addResponse.data.replies![0].addSheet?.properties?.sheetId;
        expect(sheetId).toBeDefined();

        // Now delete the sheet
        const deleteResponse = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                deleteSheet: {
                  sheetId,
                },
              },
            ],
          },
        });

        expect(deleteResponse.status).toBe(200);

        // Verify sheet is gone
        const verifyResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
        });

        const sheetIds = verifyResponse.data.sheets!.map((s) => s.properties?.sheetId);
        expect(sheetIds).not.toContain(sheetId);
      });
    });

    describe('rename_sheet action', () => {
      it('should rename an existing sheet', async () => {
        // Get the first sheet's ID
        const getResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
        });

        const firstSheet = getResponse.data.sheets![0];
        const sheetId = firstSheet.properties!.sheetId;
        const newTitle = `Renamed_${Date.now()}`;

        // Rename the sheet
        const renameResponse = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                updateSheetProperties: {
                  properties: {
                    sheetId,
                    title: newTitle,
                  },
                  fields: 'title',
                },
              },
            ],
          },
        });

        expect(renameResponse.status).toBe(200);

        // Verify the rename
        const verifyResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
        });

        const renamedSheet = verifyResponse.data.sheets!.find(
          (s) => s.properties?.sheetId === sheetId
        );
        expect(renamedSheet?.properties?.title).toBe(newTitle);
      });
    });

    describe('duplicate_sheet action', () => {
      it('should duplicate a sheet within the same spreadsheet', async () => {
        // Add some data to the first sheet
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Original', 'Data'],
              ['Row2', 'Values'],
            ],
          },
        });

        // Get the first sheet's ID
        const getResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
        });

        const sourceSheetId = getResponse.data.sheets![0].properties!.sheetId;

        // Duplicate the sheet
        const duplicateResponse = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                duplicateSheet: {
                  sourceSheetId,
                  newSheetName: `Copy_${Date.now()}`,
                },
              },
            ],
          },
        });

        expect(duplicateResponse.status).toBe(200);

        const duplicatedSheet = duplicateResponse.data.replies![0].duplicateSheet;
        expect(duplicatedSheet?.properties?.sheetId).toBeDefined();
        expect(duplicatedSheet?.properties?.sheetId).not.toBe(sourceSheetId);

        // Verify the duplicate has the same data
        const verifyResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: `${duplicatedSheet?.properties?.title}!A1:B2`,
        });

        expect(verifyResponse.data.values).toEqual([
          ['Original', 'Data'],
          ['Row2', 'Values'],
        ]);
      });
    });

    describe('list_sheets action', () => {
      it('should list all sheets in a spreadsheet', async () => {
        // Add a couple more sheets
        await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              { addSheet: { properties: { title: 'ExtraSheet1' } } },
              { addSheet: { properties: { title: 'ExtraSheet2' } } },
            ],
          },
        });

        // List all sheets
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'sheets.properties',
        });

        expect(response.status).toBe(200);
        expect(response.data.sheets).toBeDefined();
        // Default sheets (TestData, Benchmarks, Formulas) + 2 extra = 5+
        expect(response.data.sheets!.length).toBeGreaterThanOrEqual(5);

        const titles = response.data.sheets!.map((s) => s.properties?.title);
        expect(titles).toContain('ExtraSheet1');
        expect(titles).toContain('ExtraSheet2');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent spreadsheet', async () => {
      await expect(
        client.sheets.spreadsheets.get({
          spreadsheetId: 'non-existent-spreadsheet-id-12345',
        })
      ).rejects.toThrow();
    });

    it('should handle deleting non-existent sheet', async () => {
      await expect(
        client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                deleteSheet: {
                  sheetId: 999999999,
                },
              },
            ],
          },
        })
      ).rejects.toThrow();
    });

    it('should handle duplicate sheet name', async () => {
      // Try to add a sheet with the same name as an existing one
      await expect(
        client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'TestData', // Already exists
                  },
                },
              },
            ],
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    it('should track API call metrics', async () => {
      client.resetMetrics();

      // Make a few API calls
      await client.sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheet.id,
      });

      await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
      });

      const stats = client.getStats();

      expect(stats.totalRequests).toBeGreaterThanOrEqual(2);
      expect(stats.avgDuration).toBeGreaterThan(0);
    });
  });
});
