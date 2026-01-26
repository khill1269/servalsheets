/**
 * Live API Tests for sheets_dimensions Tool
 *
 * Tests row and column operations against the real Google Sheets API.
 * Requires TEST_REAL_API=true environment variable.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LiveApiClient } from '../setup/live-api-client.js';
import { TestSpreadsheetManager, TestSpreadsheet } from '../setup/test-spreadsheet-manager.js';
import {
  loadTestCredentials,
  shouldRunIntegrationTests,
} from '../../helpers/credential-loader.js';

const runLiveTests = shouldRunIntegrationTests();

describe.skipIf(!runLiveTests)('sheets_dimensions Live API Tests', () => {
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
    testSpreadsheet = await manager.createTestSpreadsheet('dimensions');

    // Get sheet ID
    const meta = await client.sheets.spreadsheets.get({
      spreadsheetId: testSpreadsheet.id,
    });
    sheetId = meta.data.sheets![0].properties!.sheetId!;

    // Populate with sample data
    await client.sheets.spreadsheets.values.update({
      spreadsheetId: testSpreadsheet.id,
      range: 'TestData!A1:E10',
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          ['ID', 'Name', 'Value', 'Date', 'Status'],
          ['1', 'Item A', '100', '2024-01-01', 'Active'],
          ['2', 'Item B', '200', '2024-01-02', 'Pending'],
          ['3', 'Item C', '300', '2024-01-03', 'Active'],
          ['4', 'Item D', '400', '2024-01-04', 'Complete'],
          ['5', 'Item E', '500', '2024-01-05', 'Active'],
          ['6', 'Item F', '600', '2024-01-06', 'Pending'],
          ['7', 'Item G', '700', '2024-01-07', 'Active'],
          ['8', 'Item H', '800', '2024-01-08', 'Complete'],
          ['9', 'Item I', '900', '2024-01-09', 'Active'],
        ],
      },
    });
  });

  describe('Row Operations', () => {
    describe('insert_rows action', () => {
      it('should insert rows at the beginning', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                insertDimension: {
                  range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: 0,
                    endIndex: 2,
                  },
                  inheritFromBefore: false,
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);

        // Verify rows were inserted
        const verifyResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:A15',
        });

        // First 2 rows should be empty, then our data
        expect(verifyResponse.data.values![2][0]).toBe('ID');
      });

      it('should insert rows in the middle', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                insertDimension: {
                  range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: 5, // After row 5
                    endIndex: 8, // Insert 3 rows
                  },
                  inheritFromBefore: true,
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
      });
    });

    describe('delete_rows action', () => {
      it('should delete specific rows', async () => {
        // Delete rows 3-5 (0-indexed: 2-4)
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: 2,
                    endIndex: 5,
                  },
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);

        // Verify rows were deleted
        const verifyResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:A10',
        });

        // Should have fewer rows now
        expect(verifyResponse.data.values!.length).toBe(7);
      });
    });

    describe('move_rows action', () => {
      it('should move rows to a new position', async () => {
        // Move rows 2-3 (0-indexed: 1-2) to after row 6
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                moveDimension: {
                  source: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: 1,
                    endIndex: 3,
                  },
                  destinationIndex: 7,
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
      });
    });

    describe('resize_rows action', () => {
      it('should resize row height', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                updateDimensionProperties: {
                  range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: 0,
                    endIndex: 1,
                  },
                  properties: {
                    pixelSize: 50,
                  },
                  fields: 'pixelSize',
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);

        // Verify row height
        const verifyResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          ranges: ['TestData'],
          includeGridData: true,
        });

        const rowMetadata =
          verifyResponse.data.sheets![0].data![0].rowMetadata![0];
        expect(rowMetadata.pixelSize).toBe(50);
      });

      it('should auto-resize rows to fit content', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                autoResizeDimensions: {
                  dimensions: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: 0,
                    endIndex: 10,
                  },
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
      });
    });

    describe('hide_rows action', () => {
      it('should hide specific rows', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                updateDimensionProperties: {
                  range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: 2,
                    endIndex: 5,
                  },
                  properties: {
                    hiddenByUser: true,
                  },
                  fields: 'hiddenByUser',
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);

        // Verify rows are hidden
        const verifyResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          ranges: ['TestData'],
          includeGridData: true,
        });

        const rowMetadata =
          verifyResponse.data.sheets![0].data![0].rowMetadata![2];
        expect(rowMetadata.hiddenByUser).toBe(true);
      });
    });

    describe('unhide_rows action', () => {
      it('should unhide previously hidden rows', async () => {
        // First hide some rows
        await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                updateDimensionProperties: {
                  range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: 2,
                    endIndex: 4,
                  },
                  properties: { hiddenByUser: true },
                  fields: 'hiddenByUser',
                },
              },
            ],
          },
        });

        // Then unhide them
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                updateDimensionProperties: {
                  range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: 2,
                    endIndex: 4,
                  },
                  properties: { hiddenByUser: false },
                  fields: 'hiddenByUser',
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
      });
    });
  });

  describe('Column Operations', () => {
    describe('insert_columns action', () => {
      it('should insert columns at the beginning', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                insertDimension: {
                  range: {
                    sheetId,
                    dimension: 'COLUMNS',
                    startIndex: 0,
                    endIndex: 2,
                  },
                  inheritFromBefore: false,
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);

        // Verify columns were inserted
        const verifyResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:G1',
        });

        // First 2 columns should be empty
        expect(verifyResponse.data.values![0][2]).toBe('ID');
      });

      it('should insert columns in the middle', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                insertDimension: {
                  range: {
                    sheetId,
                    dimension: 'COLUMNS',
                    startIndex: 2,
                    endIndex: 4,
                  },
                  inheritFromBefore: true,
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
      });
    });

    describe('delete_columns action', () => {
      it('should delete specific columns', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId,
                    dimension: 'COLUMNS',
                    startIndex: 2,
                    endIndex: 4,
                  },
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);

        // Verify columns were deleted
        const verifyResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:E1',
        });

        // Value column should be gone, Status should be at column C now
        expect(verifyResponse.data.values![0]).toEqual([
          'ID',
          'Name',
          'Status',
        ]);
      });
    });

    describe('resize_columns action', () => {
      it('should resize column width', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                updateDimensionProperties: {
                  range: {
                    sheetId,
                    dimension: 'COLUMNS',
                    startIndex: 0,
                    endIndex: 1,
                  },
                  properties: {
                    pixelSize: 200,
                  },
                  fields: 'pixelSize',
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);

        // Verify column width
        const verifyResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          ranges: ['TestData'],
          includeGridData: true,
        });

        const colMetadata =
          verifyResponse.data.sheets![0].data![0].columnMetadata![0];
        expect(colMetadata.pixelSize).toBe(200);
      });

      it('should auto-resize columns to fit content', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
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

        expect(response.status).toBe(200);
      });
    });

    describe('hide_columns action', () => {
      it('should hide specific columns', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                updateDimensionProperties: {
                  range: {
                    sheetId,
                    dimension: 'COLUMNS',
                    startIndex: 2,
                    endIndex: 4,
                  },
                  properties: {
                    hiddenByUser: true,
                  },
                  fields: 'hiddenByUser',
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
      });
    });
  });

  describe('Freeze Operations', () => {
    describe('freeze_rows action', () => {
      it('should freeze header row', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
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

        expect(response.status).toBe(200);

        // Verify frozen rows
        const verifyResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
        });

        const gridProps =
          verifyResponse.data.sheets![0].properties!.gridProperties;
        expect(gridProps!.frozenRowCount).toBe(1);
      });

      it('should freeze multiple rows', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                updateSheetProperties: {
                  properties: {
                    sheetId,
                    gridProperties: {
                      frozenRowCount: 3,
                    },
                  },
                  fields: 'gridProperties.frozenRowCount',
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
      });
    });

    describe('freeze_columns action', () => {
      it('should freeze first column', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                updateSheetProperties: {
                  properties: {
                    sheetId,
                    gridProperties: {
                      frozenColumnCount: 1,
                    },
                  },
                  fields: 'gridProperties.frozenColumnCount',
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);

        // Verify frozen columns
        const verifyResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
        });

        const gridProps =
          verifyResponse.data.sheets![0].properties!.gridProperties;
        expect(gridProps!.frozenColumnCount).toBe(1);
      });
    });

    describe('unfreeze action', () => {
      it('should unfreeze all rows and columns', async () => {
        // First freeze some rows and columns
        await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                updateSheetProperties: {
                  properties: {
                    sheetId,
                    gridProperties: {
                      frozenRowCount: 2,
                      frozenColumnCount: 2,
                    },
                  },
                  fields: 'gridProperties(frozenRowCount,frozenColumnCount)',
                },
              },
            ],
          },
        });

        // Then unfreeze
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                updateSheetProperties: {
                  properties: {
                    sheetId,
                    gridProperties: {
                      frozenRowCount: 0,
                      frozenColumnCount: 0,
                    },
                  },
                  fields: 'gridProperties(frozenRowCount,frozenColumnCount)',
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
      });
    });
  });

  describe('Group Operations', () => {
    describe('group_rows action', () => {
      it('should group rows', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addDimensionGroup: {
                  range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: 2,
                    endIndex: 6,
                  },
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
      });

      it('should create nested groups', async () => {
        // Create outer group
        await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addDimensionGroup: {
                  range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: 1,
                    endIndex: 8,
                  },
                },
              },
            ],
          },
        });

        // Create inner group
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addDimensionGroup: {
                  range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: 2,
                    endIndex: 5,
                  },
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
      });
    });

    describe('ungroup_rows action', () => {
      it('should ungroup rows', async () => {
        // First create a group
        await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addDimensionGroup: {
                  range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: 2,
                    endIndex: 6,
                  },
                },
              },
            ],
          },
        });

        // Then remove it
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                deleteDimensionGroup: {
                  range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: 2,
                    endIndex: 6,
                  },
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
      });
    });
  });

  describe('Batch Dimension Operations', () => {
    it('should perform multiple dimension operations in one request', async () => {
      const response = await client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          requests: [
            // Freeze header row
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: { frozenRowCount: 1 },
                },
                fields: 'gridProperties.frozenRowCount',
              },
            },
            // Set header row height
            {
              updateDimensionProperties: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: 0,
                  endIndex: 1,
                },
                properties: { pixelSize: 40 },
                fields: 'pixelSize',
              },
            },
            // Auto-resize all columns
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

      expect(response.status).toBe(200);
      expect(response.data.replies).toHaveLength(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid row indices', async () => {
      await expect(
        client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: 1000000,
                    endIndex: 1000001,
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
    it('should track batch dimension operations', async () => {
      client.resetMetrics();

      await client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          requests: [
            {
              insertDimension: {
                range: { sheetId, dimension: 'ROWS', startIndex: 5, endIndex: 7 },
              },
            },
            {
              updateDimensionProperties: {
                range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 5 },
                properties: { pixelSize: 100 },
                fields: 'pixelSize',
              },
            },
          ],
        },
      });

      const stats = client.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.avgDuration).toBeGreaterThan(0);
    });
  });
});
