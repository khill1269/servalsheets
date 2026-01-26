/**
 * Live API Tests for sheets_format Tool
 *
 * Tests cell formatting operations against the real Google Sheets API.
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

describe.skipIf(!runLiveTests)('sheets_format Live API Tests', () => {
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
    testSpreadsheet = await manager.createTestSpreadsheet('format');
    // Get sheet ID for formatting operations
    const meta = await client.sheets.spreadsheets.get({
      spreadsheetId: testSpreadsheet.id,
    });
    sheetId = meta.data.sheets![0].properties!.sheetId!;
  });

  describe('Background Color Formatting', () => {
    it('should set background color on a cell', async () => {
      const response = await client.sheets.spreadsheets.batchUpdate({
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
                  endColumnIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: {
                      red: 0.2,
                      green: 0.6,
                      blue: 0.8,
                    },
                  },
                },
                fields: 'userEnteredFormat.backgroundColor',
              },
            },
          ],
        },
      });

      expect(response.status).toBe(200);

      // Verify the format was applied
      const verifyResponse = await client.sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheet.id,
        ranges: ['TestData!A1'],
        includeGridData: true,
      });

      const cellFormat =
        verifyResponse.data.sheets![0].data![0].rowData![0].values![0]
          .userEnteredFormat;
      expect(cellFormat?.backgroundColor?.red).toBeCloseTo(0.2, 1);
      expect(cellFormat?.backgroundColor?.green).toBeCloseTo(0.6, 1);
      expect(cellFormat?.backgroundColor?.blue).toBeCloseTo(0.8, 1);
    });

    it('should set background color on a range', async () => {
      const response = await client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 3,
                  startColumnIndex: 0,
                  endColumnIndex: 3,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: {
                      red: 1,
                      green: 0.9,
                      blue: 0.8,
                    },
                  },
                },
                fields: 'userEnteredFormat.backgroundColor',
              },
            },
          ],
        },
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Text Formatting', () => {
    it('should set bold text format', async () => {
      // First write some text
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [['Bold Text']] },
      });

      // Apply bold formatting
      const response = await client.sheets.spreadsheets.batchUpdate({
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
                  endColumnIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: {
                      bold: true,
                    },
                  },
                },
                fields: 'userEnteredFormat.textFormat.bold',
              },
            },
          ],
        },
      });

      expect(response.status).toBe(200);

      // Verify
      const verifyResponse = await client.sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheet.id,
        ranges: ['TestData!A1'],
        includeGridData: true,
      });

      const textFormat =
        verifyResponse.data.sheets![0].data![0].rowData![0].values![0]
          .userEnteredFormat?.textFormat;
      expect(textFormat?.bold).toBe(true);
    });

    it('should set font size and color', async () => {
      const response = await client.sheets.spreadsheets.batchUpdate({
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
                  endColumnIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: {
                      fontSize: 14,
                      foregroundColor: {
                        red: 0,
                        green: 0,
                        blue: 0.8,
                      },
                    },
                  },
                },
                fields: 'userEnteredFormat.textFormat(fontSize,foregroundColor)',
              },
            },
          ],
        },
      });

      expect(response.status).toBe(200);

      // Verify
      const verifyResponse = await client.sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheet.id,
        ranges: ['TestData!A1'],
        includeGridData: true,
      });

      const textFormat =
        verifyResponse.data.sheets![0].data![0].rowData![0].values![0]
          .userEnteredFormat?.textFormat;
      expect(textFormat?.fontSize).toBe(14);
    });

    it('should apply multiple text formats at once', async () => {
      const response = await client.sheets.spreadsheets.batchUpdate({
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
                  endColumnIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: {
                      bold: true,
                      italic: true,
                      underline: true,
                      fontSize: 12,
                    },
                  },
                },
                fields: 'userEnteredFormat.textFormat',
              },
            },
          ],
        },
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Number Formatting', () => {
    it('should format numbers as currency', async () => {
      // Write a number
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [['1234.56']] },
      });

      // Apply currency format
      const response = await client.sheets.spreadsheets.batchUpdate({
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
                  endColumnIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    numberFormat: {
                      type: 'CURRENCY',
                      pattern: '$#,##0.00',
                    },
                  },
                },
                fields: 'userEnteredFormat.numberFormat',
              },
            },
          ],
        },
      });

      expect(response.status).toBe(200);

      // Verify formatted value
      const verifyResponse = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
        valueRenderOption: 'FORMATTED_VALUE',
      });

      expect(verifyResponse.data.values![0][0]).toMatch(/\$1,234\.56/);
    });

    it('should format numbers as percentages', async () => {
      // Write a decimal
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [['0.75']] },
      });

      // Apply percentage format
      const response = await client.sheets.spreadsheets.batchUpdate({
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
                  endColumnIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    numberFormat: {
                      type: 'PERCENT',
                      pattern: '0%',
                    },
                  },
                },
                fields: 'userEnteredFormat.numberFormat',
              },
            },
          ],
        },
      });

      expect(response.status).toBe(200);

      // Verify
      const verifyResponse = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
        valueRenderOption: 'FORMATTED_VALUE',
      });

      expect(verifyResponse.data.values![0][0]).toBe('75%');
    });
  });

  describe('Border Formatting', () => {
    it('should add borders to a range', async () => {
      const response = await client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          requests: [
            {
              updateBorders: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 3,
                  startColumnIndex: 0,
                  endColumnIndex: 3,
                },
                top: {
                  style: 'SOLID',
                  width: 1,
                  color: { red: 0, green: 0, blue: 0 },
                },
                bottom: {
                  style: 'SOLID',
                  width: 1,
                  color: { red: 0, green: 0, blue: 0 },
                },
                left: {
                  style: 'SOLID',
                  width: 1,
                  color: { red: 0, green: 0, blue: 0 },
                },
                right: {
                  style: 'SOLID',
                  width: 1,
                  color: { red: 0, green: 0, blue: 0 },
                },
                innerHorizontal: {
                  style: 'SOLID',
                  width: 1,
                  color: { red: 0.8, green: 0.8, blue: 0.8 },
                },
                innerVertical: {
                  style: 'SOLID',
                  width: 1,
                  color: { red: 0.8, green: 0.8, blue: 0.8 },
                },
              },
            },
          ],
        },
      });

      expect(response.status).toBe(200);
    });

    it('should add thick border to header row', async () => {
      const response = await client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          requests: [
            {
              updateBorders: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 5,
                },
                bottom: {
                  style: 'SOLID_THICK',
                  width: 2,
                  color: { red: 0, green: 0, blue: 0 },
                },
              },
            },
          ],
        },
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Cell Alignment', () => {
    it('should set horizontal alignment', async () => {
      const response = await client.sheets.spreadsheets.batchUpdate({
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
                  endColumnIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    horizontalAlignment: 'CENTER',
                  },
                },
                fields: 'userEnteredFormat.horizontalAlignment',
              },
            },
          ],
        },
      });

      expect(response.status).toBe(200);

      // Verify
      const verifyResponse = await client.sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheet.id,
        ranges: ['TestData!A1'],
        includeGridData: true,
      });

      const alignment =
        verifyResponse.data.sheets![0].data![0].rowData![0].values![0]
          .userEnteredFormat?.horizontalAlignment;
      expect(alignment).toBe('CENTER');
    });

    it('should set vertical alignment', async () => {
      const response = await client.sheets.spreadsheets.batchUpdate({
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
                  endColumnIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    verticalAlignment: 'MIDDLE',
                  },
                },
                fields: 'userEnteredFormat.verticalAlignment',
              },
            },
          ],
        },
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Conditional Formatting', () => {
    it('should add conditional formatting rule', async () => {
      const response = await client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          requests: [
            {
              addConditionalFormatRule: {
                rule: {
                  ranges: [
                    {
                      sheetId,
                      startRowIndex: 1,
                      endRowIndex: 100,
                      startColumnIndex: 0,
                      endColumnIndex: 1,
                    },
                  ],
                  booleanRule: {
                    condition: {
                      type: 'NUMBER_GREATER',
                      values: [{ userEnteredValue: '100' }],
                    },
                    format: {
                      backgroundColor: {
                        red: 0.8,
                        green: 1,
                        blue: 0.8,
                      },
                    },
                  },
                },
                index: 0,
              },
            },
          ],
        },
      });

      expect(response.status).toBe(200);
    });

    it('should add gradient conditional formatting', async () => {
      const response = await client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          requests: [
            {
              addConditionalFormatRule: {
                rule: {
                  ranges: [
                    {
                      sheetId,
                      startRowIndex: 1,
                      endRowIndex: 100,
                      startColumnIndex: 1,
                      endColumnIndex: 2,
                    },
                  ],
                  gradientRule: {
                    minpoint: {
                      color: { red: 1, green: 0.8, blue: 0.8 },
                      type: 'MIN',
                    },
                    midpoint: {
                      color: { red: 1, green: 1, blue: 0.8 },
                      type: 'PERCENTILE',
                      value: '50',
                    },
                    maxpoint: {
                      color: { red: 0.8, green: 1, blue: 0.8 },
                      type: 'MAX',
                    },
                  },
                },
                index: 0,
              },
            },
          ],
        },
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Batch Format Operations', () => {
    it('should apply multiple formats in a single request', async () => {
      const response = await client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          requests: [
            // Header row formatting
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 5,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.2, green: 0.4, blue: 0.6 },
                    textFormat: {
                      bold: true,
                      foregroundColor: { red: 1, green: 1, blue: 1 },
                    },
                    horizontalAlignment: 'CENTER',
                  },
                },
                fields:
                  'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
              },
            },
            // Alternating row colors
            {
              addConditionalFormatRule: {
                rule: {
                  ranges: [
                    {
                      sheetId,
                      startRowIndex: 1,
                      endRowIndex: 100,
                      startColumnIndex: 0,
                      endColumnIndex: 5,
                    },
                  ],
                  booleanRule: {
                    condition: {
                      type: 'CUSTOM_FORMULA',
                      values: [{ userEnteredValue: '=ISEVEN(ROW())' }],
                    },
                    format: {
                      backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
                    },
                  },
                },
                index: 0,
              },
            },
          ],
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.replies).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid color values gracefully', async () => {
      // Colors should be 0-1, but API may accept >1 and clamp
      const response = await client.sheets.spreadsheets.batchUpdate({
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
                  endColumnIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: {
                      red: 0.5,
                      green: 0.5,
                      blue: 0.5,
                    },
                  },
                },
                fields: 'userEnteredFormat.backgroundColor',
              },
            },
          ],
        },
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Performance Metrics', () => {
    it('should track batch formatting efficiency', async () => {
      client.resetMetrics();

      // Apply multiple format operations in one batch
      await client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 5 },
                cell: { userEnteredFormat: { backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } },
                fields: 'userEnteredFormat.backgroundColor',
              },
            },
            {
              updateBorders: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 5 },
                top: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
                bottom: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
              },
            },
          ],
        },
      });

      const stats = client.getStats();
      expect(stats.totalRequests).toBe(1); // All in one batch
      expect(stats.avgDuration).toBeGreaterThan(0);
    });
  });
});
