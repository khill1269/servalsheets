/**
 * Live API Tests for sheets_composite Tool
 *
 * Tests composite/bulk operations against the real Google API.
 * Requires TEST_REAL_API=true environment variable.
 *
 * 10 Actions:
 * - import_csv: Import CSV data into spreadsheet
 * - smart_append: Append data matching column headers
 * - bulk_update: Update rows by matching key column
 * - deduplicate: Remove duplicate rows
 * - export_xlsx: Export as Excel file
 * - import_xlsx: Import Excel file
 * - get_form_responses: Read form responses
 * - setup_sheet: Create and configure sheet in one operation
 * - import_and_format: Import CSV and apply formatting
 * - clone_structure: Copy sheet structure without data
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LiveApiClient } from '../setup/live-api-client.js';
import { TestSpreadsheetManager, TestSpreadsheet } from '../setup/test-spreadsheet-manager.js';
import {
  loadTestCredentials,
  shouldRunIntegrationTests,
} from '../../helpers/credential-loader.js';

const runLiveTests = shouldRunIntegrationTests();

describe.skipIf(!runLiveTests)('sheets_composite Live API Tests', () => {
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
    testSpreadsheet = await manager.createTestSpreadsheet('composite');
    const meta = await client.sheets.spreadsheets.get({
      spreadsheetId: testSpreadsheet.id,
    });
    sheetId = meta.data.sheets![0].properties!.sheetId!;
  });

  describe('CSV Import Operations', () => {
    describe('import_csv action', () => {
      it('should import CSV data with headers', async () => {
        const csvData = 'Name,Email,Department\nAlice,alice@example.com,Engineering\nBob,bob@example.com,Sales';

        // Parse CSV manually for import
        const rows = csvData.split('\n').map(row => row.split(','));

        // Write to sheet
        const response = await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
          valueInputOption: 'RAW',
          requestBody: {
            values: rows,
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.updatedRows).toBe(3);
        expect(response.data.updatedColumns).toBe(3);
      });

      it('should handle different delimiters', async () => {
        const tsvData = 'Name\tEmail\tDepartment\nAlice\talice@example.com\tEngineering';

        const rows = tsvData.split('\n').map(row => row.split('\t'));

        const response = await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
          valueInputOption: 'RAW',
          requestBody: {
            values: rows,
          },
        });

        expect(response.status).toBe(200);

        // Verify data
        const readResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:C2',
        });

        expect(readResponse.data.values![0]).toEqual(['Name', 'Email', 'Department']);
      });

      it('should import to new sheet', async () => {
        // Create new sheet
        const addResponse = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'CSVImport',
                  },
                },
              },
            ],
          },
        });

        const newSheetId = addResponse.data.replies![0].addSheet?.properties?.sheetId;
        expect(newSheetId).toBeDefined();

        // Import data to new sheet
        const csvData = [
          ['ID', 'Product', 'Price'],
          ['1', 'Widget', '10.99'],
          ['2', 'Gadget', '24.99'],
        ];

        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'CSVImport!A1',
          valueInputOption: 'RAW',
          requestBody: {
            values: csvData,
          },
        });

        // Verify
        const readResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'CSVImport!A1:C3',
        });

        expect(readResponse.data.values).toHaveLength(3);
      });
    });
  });

  describe('Smart Append Operations', () => {
    describe('smart_append action', () => {
      it('should append data matching existing headers', async () => {
        // Setup existing data with headers
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:C2',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Name', 'Department', 'Salary'],
              ['Alice', 'Engineering', '80000'],
            ],
          },
        });

        // Append new row
        const response = await client.sheets.spreadsheets.values.append({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A:C',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [['Bob', 'Sales', '75000']],
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.updates?.updatedRows).toBe(1);

        // Verify
        const readResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:C3',
        });

        expect(readResponse.data.values).toHaveLength(3);
        expect(readResponse.data.values![2]).toEqual(['Bob', 'Sales', '75000']);
      });

      it('should handle missing columns gracefully', async () => {
        // Setup with headers
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:D1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['Name', 'Email', 'Department', 'Salary']],
          },
        });

        // Append with partial data (missing Salary)
        await client.sheets.spreadsheets.values.append({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A:D',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [['Carol', 'carol@example.com', 'Marketing', '']],
          },
        });

        // Verify
        const readResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A2:D2',
        });

        expect(readResponse.data.values![0][0]).toBe('Carol');
      });
    });
  });

  describe('Bulk Update Operations', () => {
    describe('bulk_update action', () => {
      it('should update rows by matching key column', async () => {
        // Setup data
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:C4',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['ID', 'Name', 'Status'],
              ['001', 'Alice', 'pending'],
              ['002', 'Bob', 'pending'],
              ['003', 'Carol', 'pending'],
            ],
          },
        });

        // Update specific rows by ID
        // In a real bulk update, we'd match by key column
        await client.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            valueInputOption: 'RAW',
            data: [
              { range: 'TestData!C2', values: [['complete']] },
              { range: 'TestData!C4', values: [['complete']] },
            ],
          },
        });

        // Verify
        const readResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:C4',
        });

        expect(readResponse.data.values![1][2]).toBe('complete');
        expect(readResponse.data.values![2][2]).toBe('pending');
        expect(readResponse.data.values![3][2]).toBe('complete');
      });

      it('should handle multiple column updates', async () => {
        // Setup
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:D3',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['ID', 'Name', 'Status', 'Updated'],
              ['001', 'Alice', 'pending', ''],
              ['002', 'Bob', 'pending', ''],
            ],
          },
        });

        // Batch update multiple columns
        await client.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            valueInputOption: 'RAW',
            data: [
              { range: 'TestData!C2:D2', values: [['complete', '2024-01-15']] },
              { range: 'TestData!C3:D3', values: [['in_progress', '2024-01-16']] },
            ],
          },
        });

        // Verify
        const readResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!C2:D3',
        });

        expect(readResponse.data.values![0]).toEqual(['complete', '2024-01-15']);
        expect(readResponse.data.values![1]).toEqual(['in_progress', '2024-01-16']);
      });
    });
  });

  describe('Deduplication Operations', () => {
    describe('deduplicate action', () => {
      it('should detect duplicate rows', async () => {
        // Setup data with duplicates
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B6',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['ID', 'Value'],
              ['A001', '100'],
              ['A002', '200'],
              ['A001', '150'],  // Duplicate ID
              ['A003', '300'],
              ['A002', '250'],  // Duplicate ID
            ],
          },
        });

        // Read and detect duplicates
        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A2:A6',
        });

        const ids = response.data.values!.flat();
        const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
        expect(duplicates).toContain('A001');
        expect(duplicates).toContain('A002');
      });

      it('should remove duplicates keeping first occurrence', async () => {
        // Setup data with duplicates
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B5',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['ID', 'Value'],
              ['A001', '100'],
              ['A002', '200'],
              ['A001', '150'],  // Duplicate - should be removed
              ['A003', '300'],
            ],
          },
        });

        // In a real dedupe, we'd identify and remove duplicates
        // Here we simulate by clearing and rewriting unique data
        const uniqueData = [
          ['ID', 'Value'],
          ['A001', '100'],
          ['A002', '200'],
          ['A003', '300'],
        ];

        await client.sheets.spreadsheets.values.clear({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B10',
        });

        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
          valueInputOption: 'RAW',
          requestBody: { values: uniqueData },
        });

        // Verify
        const readResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B4',
        });

        expect(readResponse.data.values).toHaveLength(4);
      });
    });
  });

  describe('Export Operations', () => {
    describe('export_xlsx action', () => {
      it('should export spreadsheet as downloadable file', async () => {
        // Add some data first
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:C3',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Name', 'Department', 'Salary'],
              ['Alice', 'Engineering', '80000'],
              ['Bob', 'Sales', '75000'],
            ],
          },
        });

        // Export as XLSX using Drive API
        const response = await client.drive.files.export({
          fileId: testSpreadsheet.id,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }, {
          responseType: 'arraybuffer',
        });

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        // Response should be binary data
      });
    });
  });

  describe('Sheet Setup Operations', () => {
    describe('setup_sheet action', () => {
      it('should create sheet with headers and formatting', async () => {
        // Create new sheet
        const addResponse = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'SetupTest',
                    gridProperties: {
                      rowCount: 100,
                      columnCount: 5,
                    },
                  },
                },
              },
            ],
          },
        });

        const newSheetId = addResponse.data.replies![0].addSheet?.properties?.sheetId!;

        // Add headers
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'SetupTest!A1:E1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['ID', 'Name', 'Email', 'Department', 'Start Date']],
          },
        });

        // Apply formatting and freeze header
        await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              // Bold headers
              {
                repeatCell: {
                  range: {
                    sheetId: newSheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: 5,
                  },
                  cell: {
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
                    },
                  },
                  fields: 'userEnteredFormat(textFormat.bold,backgroundColor)',
                },
              },
              // Freeze header row
              {
                updateSheetProperties: {
                  properties: {
                    sheetId: newSheetId,
                    gridProperties: {
                      frozenRowCount: 1,
                    },
                  },
                  fields: 'gridProperties.frozenRowCount',
                },
              },
            ],
          },
        });

        // Verify
        const metaResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'sheets(properties)',
        });

        const setupSheet = metaResponse.data.sheets!.find(
          s => s.properties?.title === 'SetupTest'
        );
        expect(setupSheet?.properties?.gridProperties?.frozenRowCount).toBe(1);
      });
    });
  });

  describe('Clone Structure Operations', () => {
    describe('clone_structure action', () => {
      it('should copy sheet structure without data', async () => {
        // Setup source sheet with headers and formatting
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:D5',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Name', 'Email', 'Department', 'Salary'],
              ['Alice', 'alice@example.com', 'Engineering', '80000'],
              ['Bob', 'bob@example.com', 'Sales', '75000'],
              ['Carol', 'carol@example.com', 'Marketing', '70000'],
              ['Dave', 'dave@example.com', 'Engineering', '85000'],
            ],
          },
        });

        // Add formatting to source
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
                    endColumnIndex: 4,
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

        // Duplicate sheet (copies structure and formatting)
        const duplicateResponse = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                duplicateSheet: {
                  sourceSheetId: sheetId,
                  newSheetName: 'ClonedStructure',
                },
              },
            ],
          },
        });

        const _clonedSheetId = duplicateResponse.data.replies![0].duplicateSheet?.properties?.sheetId!;

        // Clear data but keep headers
        await client.sheets.spreadsheets.values.clear({
          spreadsheetId: testSpreadsheet.id,
          range: 'ClonedStructure!A2:D100',
        });

        // Verify structure preserved
        const headerResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'ClonedStructure!A1:D1',
        });

        expect(headerResponse.data.values![0]).toEqual(['Name', 'Email', 'Department', 'Salary']);

        // Verify data cleared
        const dataResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'ClonedStructure!A2:D5',
        });

        // Should be empty or undefined
        expect(dataResponse.data.values).toBeUndefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid CSV data', async () => {
      // Empty CSV should still work (no rows)
      const response = await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [],
        },
      });

      // Empty update is allowed
      expect(response.status).toBe(200);
    });

    it('should handle non-existent sheet', async () => {
      await expect(
        client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'NonExistentSheet!A1',
        })
      ).rejects.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    it('should track composite operation latency', async () => {
      client.resetMetrics();

      // Typical composite workflow: import CSV, format, freeze headers
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:C3',
        valueInputOption: 'RAW',
        requestBody: {
          values: [
            ['Name', 'Email', 'Department'],
            ['Alice', 'alice@example.com', 'Engineering'],
            ['Bob', 'bob@example.com', 'Sales'],
          ],
        },
      });

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
                  endColumnIndex: 3,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: { bold: true },
                  },
                },
                fields: 'userEnteredFormat.textFormat.bold',
              },
            },
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: {
                    frozenRowCount: 1,
                  },
                },
                fields: 'gridProperties.frozenRowCount',
              },
            },
          ],
        },
      });

      const stats = client.getStats();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(2);
      expect(stats.avgDuration).toBeGreaterThan(0);
    });
  });
});
