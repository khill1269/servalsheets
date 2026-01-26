/**
 * Live API Tests for sheets_data Tool
 *
 * Tests data read/write operations against the real Google Sheets API.
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

describe.skipIf(!runLiveTests)('sheets_data Live API Tests', () => {
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
    testSpreadsheet = await manager.createTestSpreadsheet('data');
  });

  describe('Read Operations', () => {
    describe('read action', () => {
      it('should read cell values from a range', async () => {
        // First write some data
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:C3',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Name', 'Age', 'City'],
              ['Alice', 30, 'NYC'],
              ['Bob', 25, 'LA'],
            ],
          },
        });

        // Read it back
        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:C3',
        });

        expect(response.status).toBe(200);
        expect(response.data.values).toEqual([
          ['Name', 'Age', 'City'],
          ['Alice', '30', 'NYC'],
          ['Bob', '25', 'LA'],
        ]);
      });

      it('should read with different value render options', async () => {
        // Write a formula
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              ['10', '20'],
              ['=A1+B1', '=SUM(A1:B1)'],
            ],
          },
        });

        // Read with FORMATTED_VALUE (default)
        const formattedResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A2:B2',
          valueRenderOption: 'FORMATTED_VALUE',
        });

        expect(formattedResponse.data.values![0][0]).toBe('30');
        expect(formattedResponse.data.values![0][1]).toBe('30');

        // Read with FORMULA
        const formulaResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A2:B2',
          valueRenderOption: 'FORMULA',
        });

        expect(formulaResponse.data.values![0][0]).toBe('=A1+B1');
        expect(formulaResponse.data.values![0][1]).toBe('=SUM(A1:B1)');
      });

      it('should handle empty cells gracefully', async () => {
        // Write sparse data
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:C3',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['A1', '', 'C1'],
              ['', 'B2', ''],
              ['A3', '', 'C3'],
            ],
          },
        });

        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:C3',
        });

        expect(response.data.values![0][0]).toBe('A1');
        expect(response.data.values![0][1]).toBe('');
        expect(response.data.values![1][1]).toBe('B2');
      });
    });

    describe('batch_read action', () => {
      it('should read multiple ranges in a single request', async () => {
        // Write data to multiple areas
        await client.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            valueInputOption: 'RAW',
            data: [
              { range: 'TestData!A1:A3', values: [['A1'], ['A2'], ['A3']] },
              { range: 'TestData!C1:C3', values: [['C1'], ['C2'], ['C3']] },
            ],
          },
        });

        // Batch read
        const response = await client.sheets.spreadsheets.values.batchGet({
          spreadsheetId: testSpreadsheet.id,
          ranges: ['TestData!A1:A3', 'TestData!C1:C3'],
        });

        expect(response.status).toBe(200);
        expect(response.data.valueRanges).toHaveLength(2);
        expect(response.data.valueRanges![0].values).toEqual([['A1'], ['A2'], ['A3']]);
        expect(response.data.valueRanges![1].values).toEqual([['C1'], ['C2'], ['C3']]);
      });
    });
  });

  describe('Write Operations', () => {
    describe('write action', () => {
      it('should write values to a range', async () => {
        const response = await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Hello', 'World'],
              ['Foo', 'Bar'],
            ],
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.updatedCells).toBe(4);
        expect(response.data.updatedRows).toBe(2);
        expect(response.data.updatedColumns).toBe(2);
      });

      it('should handle USER_ENTERED input option', async () => {
        const response = await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:A2',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['100'], ['=A1*2']],
          },
        });

        expect(response.status).toBe(200);

        // Verify the formula was interpreted
        const verifyResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A2',
          valueRenderOption: 'FORMATTED_VALUE',
        });

        expect(verifyResponse.data.values![0][0]).toBe('200');
      });
    });

    describe('append action', () => {
      it('should append values after existing data', async () => {
        // Write initial data
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Header1', 'Header2'],
              ['Row1', 'Data1'],
            ],
          },
        });

        // Append new rows
        const appendResponse = await client.sheets.spreadsheets.values.append({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A:B',
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [
              ['Row2', 'Data2'],
              ['Row3', 'Data3'],
            ],
          },
        });

        expect(appendResponse.status).toBe(200);
        expect(appendResponse.data.updates?.updatedRows).toBe(2);

        // Verify all data
        const verifyResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B4',
        });

        expect(verifyResponse.data.values).toHaveLength(4);
        expect(verifyResponse.data.values![2]).toEqual(['Row2', 'Data2']);
        expect(verifyResponse.data.values![3]).toEqual(['Row3', 'Data3']);
      });
    });

    describe('batch_write action', () => {
      it('should write to multiple ranges in a single request', async () => {
        const response = await client.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            valueInputOption: 'RAW',
            data: [
              { range: 'TestData!A1:A3', values: [['A1'], ['A2'], ['A3']] },
              { range: 'TestData!C1:C3', values: [['C1'], ['C2'], ['C3']] },
              { range: 'TestData!E1:E3', values: [['E1'], ['E2'], ['E3']] },
            ],
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.totalUpdatedCells).toBe(9);
        expect(response.data.responses).toHaveLength(3);
      });
    });

    describe('clear action', () => {
      it('should clear values from a range', async () => {
        // Write some data first
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Data1', 'Data2'],
              ['Data3', 'Data4'],
            ],
          },
        });

        // Clear the range
        const clearResponse = await client.sheets.spreadsheets.values.clear({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
        });

        expect(clearResponse.status).toBe(200);

        // Verify it's cleared
        const verifyResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
        });

        // Empty range returns no values or empty array
        expect(verifyResponse.data.values ?? []).toEqual([]);
      });
    });
  });

  describe('Search Operations', () => {
    describe('find action', () => {
      it('should find cells matching a pattern', async () => {
        // Write data with searchable content
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:C3',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['apple', 'banana', 'cherry'],
              ['apricot', 'blueberry', 'apple pie'],
              ['avocado', 'apple sauce', 'cranberry'],
            ],
          },
        });

        // Read all data and search client-side (Sheets API doesn't have native search)
        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:C3',
        });

        const values = response.data.values!;
        const matches: Array<{ row: number; col: number; value: string }> = [];

        values.forEach((row, rowIdx) => {
          row.forEach((cell: string, colIdx) => {
            if (cell.includes('apple')) {
              matches.push({ row: rowIdx + 1, col: colIdx + 1, value: cell });
            }
          });
        });

        expect(matches.length).toBe(4);
        expect(matches.map((m) => m.value)).toContain('apple');
        expect(matches.map((m) => m.value)).toContain('apple pie');
        expect(matches.map((m) => m.value)).toContain('apple sauce');
      });
    });

    describe('replace action', () => {
      it('should replace values matching a pattern', async () => {
        // Write initial data
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['old_value', 'keep_this'],
              ['old_value', 'old_value'],
            ],
          },
        });

        // Read, modify, write back
        const readResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
        });

        const updatedValues = readResponse.data.values!.map((row: string[]) =>
          row.map((cell: string) => cell.replace(/old_value/g, 'new_value'))
        );

        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
          valueInputOption: 'RAW',
          requestBody: {
            values: updatedValues,
          },
        });

        // Verify
        const verifyResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B2',
        });

        expect(verifyResponse.data.values).toEqual([
          ['new_value', 'keep_this'],
          ['new_value', 'new_value'],
        ]);
      });
    });
  });

  describe('Cell Metadata Operations', () => {
    describe('set_note action', () => {
      it('should add a note to a cell', async () => {
        // Write a value first
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
          valueInputOption: 'RAW',
          requestBody: { values: [['Cell with note']] },
        });

        // Get sheet ID
        const metaResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
        });
        const sheetId = metaResponse.data.sheets![0].properties!.sheetId;

        // Add note
        const noteResponse = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                updateCells: {
                  rows: [
                    {
                      values: [
                        {
                          note: 'This is a test note',
                        },
                      ],
                    },
                  ],
                  fields: 'note',
                  start: {
                    sheetId,
                    rowIndex: 0,
                    columnIndex: 0,
                  },
                },
              },
            ],
          },
        });

        expect(noteResponse.status).toBe(200);

        // Verify note exists
        const verifyResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          ranges: ['TestData!A1'],
          includeGridData: true,
        });

        const cellNote =
          verifyResponse.data.sheets![0].data![0].rowData![0].values![0].note;
        expect(cellNote).toBe('This is a test note');
      });
    });

    describe('set_hyperlink action', () => {
      it('should add a hyperlink to a cell', async () => {
        // Get sheet ID
        const metaResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
        });
        const sheetId = metaResponse.data.sheets![0].properties!.sheetId;

        // Add hyperlink
        const linkResponse = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                updateCells: {
                  rows: [
                    {
                      values: [
                        {
                          userEnteredValue: {
                            formulaValue: '=HYPERLINK("https://example.com", "Click here")',
                          },
                        },
                      ],
                    },
                  ],
                  fields: 'userEnteredValue',
                  start: {
                    sheetId,
                    rowIndex: 0,
                    columnIndex: 0,
                  },
                },
              },
            ],
          },
        });

        expect(linkResponse.status).toBe(200);

        // Verify hyperlink
        const verifyResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
          valueRenderOption: 'FORMULA',
        });

        expect(verifyResponse.data.values![0][0]).toContain('HYPERLINK');
      });
    });
  });

  describe('Merge Operations', () => {
    describe('merge action', () => {
      it('should merge cells in a range', async () => {
        // Get sheet ID
        const metaResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
        });
        const sheetId = metaResponse.data.sheets![0].properties!.sheetId;

        // Merge cells
        const mergeResponse = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                mergeCells: {
                  range: {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 2,
                    startColumnIndex: 0,
                    endColumnIndex: 2,
                  },
                  mergeType: 'MERGE_ALL',
                },
              },
            ],
          },
        });

        expect(mergeResponse.status).toBe(200);

        // Verify merge exists
        const verifyResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          includeGridData: false,
        });

        const merges = verifyResponse.data.sheets![0].merges;
        expect(merges).toBeDefined();
        expect(merges!.length).toBeGreaterThan(0);
      });
    });

    describe('unmerge action', () => {
      it('should unmerge previously merged cells', async () => {
        // Get sheet ID
        const metaResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
        });
        const sheetId = metaResponse.data.sheets![0].properties!.sheetId;

        // First merge
        await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                mergeCells: {
                  range: {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 2,
                    startColumnIndex: 0,
                    endColumnIndex: 2,
                  },
                  mergeType: 'MERGE_ALL',
                },
              },
            ],
          },
        });

        // Then unmerge
        const unmergeResponse = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                unmergeCells: {
                  range: {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 2,
                    startColumnIndex: 0,
                    endColumnIndex: 2,
                  },
                },
              },
            ],
          },
        });

        expect(unmergeResponse.status).toBe(200);

        // Verify merge is gone
        const verifyResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          includeGridData: false,
        });

        const merges = verifyResponse.data.sheets![0].merges ?? [];
        expect(merges).toEqual([]);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid range format', async () => {
      await expect(
        client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'InvalidRange!!!',
        })
      ).rejects.toThrow();
    });

    it('should handle writing to protected range', async () => {
      // Get sheet ID
      const metaResponse = await client.sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheet.id,
      });
      const sheetId = metaResponse.data.sheets![0].properties!.sheetId;

      // Protect a range
      await client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          requests: [
            {
              addProtectedRange: {
                protectedRange: {
                  range: {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: 1,
                  },
                  warningOnly: false,
                  editors: {
                    users: [], // No editors - fully protected
                  },
                },
              },
            },
          ],
        },
      });

      // Note: Writing to protected ranges by the owner still works
      // This test documents the behavior rather than expecting an error
      const response = await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [['Protected']] },
      });

      // Owner can still write to protected ranges
      expect(response.status).toBe(200);
    });
  });

  describe('Performance Metrics', () => {
    it('should track batch operation efficiency', async () => {
      client.resetMetrics();

      // Perform batch write
      await client.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          valueInputOption: 'RAW',
          data: [
            { range: 'TestData!A1:A10', values: Array(10).fill(['A']) },
            { range: 'TestData!B1:B10', values: Array(10).fill(['B']) },
            { range: 'TestData!C1:C10', values: Array(10).fill(['C']) },
          ],
        },
      });

      const stats = client.getStats();

      // Batch operation should be single API call
      expect(stats.totalRequests).toBe(1);
      expect(stats.avgDuration).toBeGreaterThan(0);
    });
  });
});
