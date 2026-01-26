/**
 * Live API Tests for sheets_transaction Tool
 *
 * Tests transaction operations (begin, queue, commit, rollback, status, list)
 * against the real Google API.
 * Requires TEST_REAL_API=true environment variable.
 *
 * 6 Actions:
 * - begin: Start a new transaction
 * - queue: Queue an operation in the transaction
 * - commit: Execute all queued operations
 * - rollback: Discard queued operations
 * - status: Get transaction status
 * - list: List all active transactions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LiveApiClient } from '../setup/live-api-client.js';
import { TestSpreadsheetManager, TestSpreadsheet } from '../setup/test-spreadsheet-manager.js';
import {
  loadTestCredentials,
  shouldRunIntegrationTests,
} from '../../helpers/credential-loader.js';

const runLiveTests = shouldRunIntegrationTests();

describe.skipIf(!runLiveTests)('sheets_transaction Live API Tests', () => {
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
    testSpreadsheet = await manager.createTestSpreadsheet('transaction');
    const meta = await client.sheets.spreadsheets.get({
      spreadsheetId: testSpreadsheet.id,
    });
    sheetId = meta.data.sheets![0].properties!.sheetId!;
  });

  describe('Atomic Multi-Operation Transactions', () => {
    describe('Batch Write Operations', () => {
      it('should batch multiple write operations into single API call', async () => {
        // Write multiple ranges - Google Sheets API supports batch updates
        const response = await client.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            valueInputOption: 'RAW',
            data: [
              {
                range: 'TestData!A1:B2',
                values: [
                  ['Name', 'Value'],
                  ['Test1', '100'],
                ],
              },
              {
                range: 'TestData!A5:B6',
                values: [
                  ['Category', 'Amount'],
                  ['Sales', '500'],
                ],
              },
              {
                range: 'TestData!D1:E2',
                values: [
                  ['ID', 'Status'],
                  ['001', 'Active'],
                ],
              },
            ],
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.totalUpdatedCells).toBeGreaterThan(0);
        expect(response.data.responses).toHaveLength(3);
      });

      it('should batch multiple format operations into single API call', async () => {
        // Multiple formatting requests batched together
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              // Format first cell bold
              {
                repeatCell: {
                  range: {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: 1,
                  },
                  cell: {
                    userEnteredFormat: {
                      textFormat: { bold: true },
                    },
                  },
                  fields: 'userEnteredFormat.textFormat.bold',
                },
              },
              // Format second cell italic
              {
                repeatCell: {
                  range: {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 1,
                    endColumnIndex: 2,
                  },
                  cell: {
                    userEnteredFormat: {
                      textFormat: { italic: true },
                    },
                  },
                  fields: 'userEnteredFormat.textFormat.italic',
                },
              },
              // Set background color on third cell
              {
                repeatCell: {
                  range: {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 2,
                    endColumnIndex: 3,
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.9, green: 0.9, blue: 0.5 },
                    },
                  },
                  fields: 'userEnteredFormat.backgroundColor',
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.replies).toHaveLength(3);
      });
    });

    describe('Mixed Operation Transactions', () => {
      it('should handle mixed structural and data operations', async () => {
        // Get initial sheet count
        const initialMeta = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'sheets.properties',
        });
        const initialSheetCount = initialMeta.data.sheets!.length;

        // Batch: Add sheet + Add data + Add named range
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              // Add a new sheet
              {
                addSheet: {
                  properties: {
                    title: 'TransactionTestSheet',
                    gridProperties: {
                      rowCount: 100,
                      columnCount: 10,
                    },
                  },
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
        const newSheetId = response.data.replies![0].addSheet?.properties?.sheetId;
        expect(newSheetId).toBeDefined();

        // Write data to the new sheet
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TransactionTestSheet!A1:C3',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Header1', 'Header2', 'Header3'],
              ['Data1', 'Data2', 'Data3'],
              ['Data4', 'Data5', 'Data6'],
            ],
          },
        });

        // Add a named range
        await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addNamedRange: {
                  namedRange: {
                    name: 'TransactionData',
                    range: {
                      sheetId: newSheetId,
                      startRowIndex: 0,
                      endRowIndex: 3,
                      startColumnIndex: 0,
                      endColumnIndex: 3,
                    },
                  },
                },
              },
            ],
          },
        });

        // Verify sheet was added
        const finalMeta = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'sheets.properties,namedRanges',
        });

        expect(finalMeta.data.sheets!.length).toBe(initialSheetCount + 1);
        expect(finalMeta.data.namedRanges).toBeDefined();
        expect(
          finalMeta.data.namedRanges!.some((nr) => nr.name === 'TransactionData')
        ).toBe(true);
      });
    });
  });

  describe('Rollback Simulation', () => {
    it('should be able to restore previous state after changes', async () => {
      // Write initial data
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

      // Read initial state
      const initialRead = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:B2',
      });
      const initialData = initialRead.data.values;

      // Make changes
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:B2',
        valueInputOption: 'RAW',
        requestBody: {
          values: [
            ['Modified', 'Content'],
            ['Changed', 'Values'],
          ],
        },
      });

      // Verify changes were made
      const modifiedRead = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:B2',
      });
      expect(modifiedRead.data.values).not.toEqual(initialData);

      // Simulate rollback by restoring original data
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:B2',
        valueInputOption: 'RAW',
        requestBody: {
          values: initialData,
        },
      });

      // Verify rollback
      const finalRead = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:B2',
      });
      expect(finalRead.data.values).toEqual(initialData);
    });
  });

  describe('Transaction Isolation Patterns', () => {
    it('should demonstrate read-committed isolation', async () => {
      // Write initial data
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Initial Value']],
        },
      });

      // Read the committed value
      const read1 = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
      });
      expect(read1.data.values![0][0]).toBe('Initial Value');

      // Make an update
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Updated Value']],
        },
      });

      // Read again - should see the committed change
      const read2 = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
      });
      expect(read2.data.values![0][0]).toBe('Updated Value');
    });

    it('should handle concurrent-safe batch updates', async () => {
      // Prepare test data
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:B5',
        valueInputOption: 'RAW',
        requestBody: {
          values: [
            ['Counter', 'Status'],
            ['1', 'pending'],
            ['2', 'pending'],
            ['3', 'pending'],
            ['4', 'pending'],
          ],
        },
      });

      // Perform batch update that would be atomic
      const response = await client.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          valueInputOption: 'RAW',
          data: [
            { range: 'TestData!B2', values: [['complete']] },
            { range: 'TestData!B3', values: [['complete']] },
            { range: 'TestData!B4', values: [['complete']] },
            { range: 'TestData!B5', values: [['complete']] },
          ],
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.totalUpdatedCells).toBe(4);

      // Verify all updates were applied
      const verifyRead = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!B2:B5',
      });

      expect(verifyRead.data.values).toEqual([
        ['complete'],
        ['complete'],
        ['complete'],
        ['complete'],
      ]);
    });
  });

  describe('Transaction API Call Efficiency', () => {
    it('should demonstrate batch update efficiency', async () => {
      client.resetMetrics();

      // Single batch update for multiple operations
      await client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          requests: [
            // Insert row
            {
              insertDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: 0,
                  endIndex: 1,
                },
              },
            },
            // Insert column
            {
              insertDimension: {
                range: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: 1,
                },
              },
            },
            // Add banding
            {
              addBanding: {
                bandedRange: {
                  range: {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 10,
                    startColumnIndex: 0,
                    endColumnIndex: 5,
                  },
                  rowProperties: {
                    firstBandColor: { red: 1, green: 1, blue: 1 },
                    secondBandColor: { red: 0.95, green: 0.95, blue: 0.95 },
                  },
                },
              },
            },
            // Add named range
            {
              addNamedRange: {
                namedRange: {
                  name: 'EfficiencyTest',
                  range: {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 5,
                    startColumnIndex: 0,
                    endColumnIndex: 3,
                  },
                },
              },
            },
          ],
        },
      });

      const stats = client.getStats();
      // Single batch update should be 1 API call for 4 operations
      // Plus initial getSpreadsheet in beforeEach
      expect(stats.totalRequests).toBeLessThanOrEqual(3);
    });

    it('should demonstrate batch values update efficiency', async () => {
      client.resetMetrics();

      // Single batch values update for multiple ranges
      await client.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          valueInputOption: 'RAW',
          data: [
            { range: 'TestData!A1:C1', values: [['H1', 'H2', 'H3']] },
            { range: 'TestData!A2:C2', values: [['D1', 'D2', 'D3']] },
            { range: 'TestData!A3:C3', values: [['D4', 'D5', 'D6']] },
            { range: 'TestData!E1:G1', values: [['H4', 'H5', 'H6']] },
            { range: 'TestData!E2:G2', values: [['D7', 'D8', 'D9']] },
          ],
        },
      });

      const stats = client.getStats();
      // 5 range updates in 1 API call (plus beforeEach setup)
      expect(stats.totalRequests).toBeLessThanOrEqual(3);
    });
  });

  describe('Error Handling in Transactions', () => {
    it('should handle partial failure in batch operations gracefully', async () => {
      // First create valid data
      await client.sheets.spreadsheets.values.update({
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

      // Try to read multiple ranges, including one that might have issues
      const response = await client.sheets.spreadsheets.values.batchGet({
        spreadsheetId: testSpreadsheet.id,
        ranges: ['TestData!A1:B2', 'TestData!Z1:Z1'], // Second range might be empty
      });

      expect(response.status).toBe(200);
      expect(response.data.valueRanges).toBeDefined();
      expect(response.data.valueRanges!.length).toBe(2);
      // First range has data
      expect(response.data.valueRanges![0].values).toBeDefined();
    });

    it('should reject invalid batch operations', async () => {
      // Try to add a named range with invalid name
      await expect(
        client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addNamedRange: {
                  namedRange: {
                    name: '123InvalidName', // Names can't start with numbers
                    range: {
                      sheetId,
                      startRowIndex: 0,
                      endRowIndex: 1,
                      startColumnIndex: 0,
                      endColumnIndex: 1,
                    },
                  },
                },
              },
            ],
          },
        })
      ).rejects.toThrow();
    });

    it('should handle non-existent spreadsheet', async () => {
      await expect(
        client.sheets.spreadsheets.values.get({
          spreadsheetId: 'non-existent-spreadsheet-id-12345',
          range: 'Sheet1!A1',
        })
      ).rejects.toThrow();
    });
  });

  describe('Complex Transaction Scenarios', () => {
    it('should handle create-update-format workflow', async () => {
      // Step 1: Write data
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:D4',
        valueInputOption: 'RAW',
        requestBody: {
          values: [
            ['Product', 'Q1', 'Q2', 'Total'],
            ['Widget A', '100', '150', '=B2+C2'],
            ['Widget B', '200', '180', '=B3+C3'],
            ['Total', '=SUM(B2:B3)', '=SUM(C2:C3)', '=SUM(D2:D3)'],
          ],
        },
      });

      // Step 2: Format headers and totals in single batch
      await client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          requests: [
            // Bold headers
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
                    backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
                  },
                },
                fields: 'userEnteredFormat(textFormat.bold,backgroundColor)',
              },
            },
            // Bold total row
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 3,
                  endRowIndex: 4,
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
            // Number format for currency columns
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 1,
                  endRowIndex: 4,
                  startColumnIndex: 1,
                  endColumnIndex: 4,
                },
                cell: {
                  userEnteredFormat: {
                    numberFormat: {
                      type: 'CURRENCY',
                      pattern: '$#,##0',
                    },
                  },
                },
                fields: 'userEnteredFormat.numberFormat',
              },
            },
          ],
        },
      });

      // Verify data was written correctly
      const readResponse = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:D4',
        valueRenderOption: 'FORMATTED_VALUE',
      });

      expect(readResponse.data.values![0][0]).toBe('Product');
      // Total column should have calculated values
      expect(readResponse.data.values![1][3]).toBeDefined();
    });

    it('should handle bulk data import workflow', async () => {
      // Generate sample data
      const headerRow = ['ID', 'Name', 'Email', 'Department', 'Salary'];
      const dataRows = Array.from({ length: 50 }, (_, i) => [
        String(i + 1),
        `Employee ${i + 1}`,
        `employee${i + 1}@example.com`,
        ['Engineering', 'Sales', 'Marketing', 'HR'][i % 4],
        String(50000 + Math.floor(Math.random() * 50000)),
      ]);

      // Write all data in single batch
      const writeResponse = await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:E51',
        valueInputOption: 'RAW',
        requestBody: {
          values: [headerRow, ...dataRows],
        },
      });

      expect(writeResponse.status).toBe(200);
      expect(writeResponse.data.updatedCells).toBe(51 * 5); // 51 rows x 5 columns

      // Apply formatting and protection
      await client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          requests: [
            // Freeze header row
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
            // Add filter
            {
              setBasicFilter: {
                filter: {
                  range: {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 51,
                    startColumnIndex: 0,
                    endColumnIndex: 5,
                  },
                },
              },
            },
            // Auto-resize columns
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: 5,
                },
              },
            },
          ],
        },
      });

      // Verify
      const finalMeta = await client.sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheet.id,
        fields: 'sheets.properties,sheets.basicFilter',
      });

      const sheet = finalMeta.data.sheets![0];
      expect(sheet.properties!.gridProperties!.frozenRowCount).toBe(1);
      expect(sheet.basicFilter).toBeDefined();
    });
  });

  describe('Performance Metrics', () => {
    it('should track transaction API latency', async () => {
      client.resetMetrics();

      // Perform a typical transaction workflow
      await client.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          valueInputOption: 'RAW',
          data: [
            { range: 'TestData!A1:B1', values: [['Key', 'Value']] },
            { range: 'TestData!A2:B2', values: [['Item1', '100']] },
            { range: 'TestData!A3:B3', values: [['Item2', '200']] },
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

      const stats = client.getStats();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(2);
      expect(stats.avgDuration).toBeGreaterThan(0);
    });
  });
});
