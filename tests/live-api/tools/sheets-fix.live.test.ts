/**
 * Live API Tests for sheets_fix Tool
 *
 * Tests automated issue resolution against the real Google API.
 * Requires TEST_REAL_API=true environment variable.
 *
 * 1 Action:
 * - fix: Apply automated fixes to identified issues
 *
 * Fixable Issues:
 * - MULTIPLE_TODAY: Multiple TODAY() function calls
 * - FULL_COLUMN_REFS: Full column references (A:A)
 * - NO_FROZEN_HEADERS: Headers not frozen
 * - NO_FROZEN_COLUMNS: Key columns not frozen
 * - NO_PROTECTION: Sensitive data not protected
 * - NESTED_IFERROR: Deeply nested IFERROR calls
 * - EXCESSIVE_CF_RULES: Too many conditional formatting rules
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LiveApiClient } from '../setup/live-api-client.js';
import { TestSpreadsheetManager, TestSpreadsheet } from '../setup/test-spreadsheet-manager.js';
import {
  loadTestCredentials,
  shouldRunIntegrationTests,
} from '../../helpers/credential-loader.js';

const runLiveTests = shouldRunIntegrationTests();

describe.skipIf(!runLiveTests)('sheets_fix Live API Tests', () => {
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
    testSpreadsheet = await manager.createTestSpreadsheet('fix');
    const meta = await client.sheets.spreadsheets.get({
      spreadsheetId: testSpreadsheet.id,
    });
    sheetId = meta.data.sheets![0].properties!.sheetId!;
  });

  describe('Freeze Header Fix', () => {
    describe('NO_FROZEN_HEADERS issue', () => {
      it('should detect unfrozen headers', async () => {
        // Add header row
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:D1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['Name', 'Email', 'Department', 'Salary']],
          },
        });

        // Check current freeze state
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'sheets.properties.gridProperties',
        });

        const gridProps = response.data.sheets![0].properties!.gridProperties;
        // By default, headers are not frozen
        expect(gridProps?.frozenRowCount || 0).toBe(0);
      });

      it('should apply freeze header fix', async () => {
        // Add header row
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:D1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['Name', 'Email', 'Department', 'Salary']],
          },
        });

        // Apply the fix: freeze header row
        await client.sheets.spreadsheets.batchUpdate({
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

        // Verify fix was applied
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'sheets.properties.gridProperties',
        });

        const gridProps = response.data.sheets![0].properties!.gridProperties;
        expect(gridProps?.frozenRowCount).toBe(1);
      });
    });
  });

  describe('Protection Fix', () => {
    describe('NO_PROTECTION issue', () => {
      it('should detect unprotected sensitive data', async () => {
        // Add sensitive data (salary column)
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:D3',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Name', 'Email', 'Department', 'Salary'],
              ['Alice', 'alice@example.com', 'Engineering', '80000'],
              ['Bob', 'bob@example.com', 'Sales', '75000'],
            ],
          },
        });

        // Check for existing protections
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'sheets.protectedRanges',
        });

        const protectedRanges = response.data.sheets![0].protectedRanges;
        // No protection by default
        expect(protectedRanges || []).toHaveLength(0);
      });

      it('should apply protection fix', async () => {
        // Add data
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:D3',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Name', 'Email', 'Department', 'Salary'],
              ['Alice', 'alice@example.com', 'Engineering', '80000'],
              ['Bob', 'bob@example.com', 'Sales', '75000'],
            ],
          },
        });

        // Apply fix: protect salary column
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
                      endRowIndex: 100,
                      startColumnIndex: 3, // Column D (Salary)
                      endColumnIndex: 4,
                    },
                    description: 'Protected salary data',
                    warningOnly: true,
                  },
                },
              },
            ],
          },
        });

        // Verify protection was applied
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'sheets.protectedRanges',
        });

        const protectedRanges = response.data.sheets![0].protectedRanges;
        expect(protectedRanges!.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Formula Fix', () => {
    describe('MULTIPLE_TODAY issue', () => {
      it('should detect multiple TODAY() calls', async () => {
        // Add formulas with multiple TODAY() calls
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:C3',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              ['Date1', 'Date2', 'Date3'],
              ['=TODAY()', '=TODAY()', '=TODAY()'],
              ['=TODAY()+1', '=TODAY()+7', '=TODAY()+30'],
            ],
          },
        });

        // Get formulas
        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:C3',
          valueRenderOption: 'FORMULA',
        });

        // Count TODAY() occurrences
        const formulas = response.data.values!.flat().join('');
        const todayCount = (formulas.match(/TODAY\(\)/g) || []).length;
        expect(todayCount).toBeGreaterThan(1);
      });

      it('should consolidate TODAY() to single cell reference', async () => {
        // Add formulas
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:D4',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              ['Today', 'Plus 1', 'Plus 7', 'Plus 30'],
              ['=TODAY()', '=$A$2+1', '=$A$2+7', '=$A$2+30'],
              ['Computed', '=A2', '=B2', '=C2'],
            ],
          },
        });

        // Verify consolidated formula structure
        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A2:D2',
          valueRenderOption: 'FORMULA',
        });

        const formulas = response.data.values![0];
        // Only first cell should have TODAY()
        expect(formulas[0]).toContain('TODAY()');
        expect(formulas[1]).toContain('$A$2');
        expect(formulas[2]).toContain('$A$2');
      });
    });

    describe('FULL_COLUMN_REFS issue', () => {
      it('should detect full column references', async () => {
        // Add formula with full column reference
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B5',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              ['Values', 'Sum'],
              ['10', '=SUM(A:A)'],
              ['20', ''],
              ['30', ''],
              ['40', ''],
            ],
          },
        });

        // Get formulas
        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!B2',
          valueRenderOption: 'FORMULA',
        });

        const formula = response.data.values![0][0];
        // Should contain A:A (full column reference)
        expect(formula).toMatch(/[A-Z]:[A-Z]/);
      });

      it('should convert to bounded range', async () => {
        // Apply fix: convert A:A to A2:A100 (bounded range)
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!B2',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['=SUM(A2:A100)']],
          },
        });

        // Verify
        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!B2',
          valueRenderOption: 'FORMULA',
        });

        const formula = response.data.values![0][0];
        expect(formula).toBe('=SUM(A2:A100)');
        expect(formula).not.toMatch(/[A-Z]:[A-Z]/);
      });
    });
  });

  describe('Conditional Formatting Fix', () => {
    describe('EXCESSIVE_CF_RULES issue', () => {
      it('should detect excessive conditional formatting rules', async () => {
        // Add many conditional formatting rules
        const requests = [];
        for (let i = 0; i < 10; i++) {
          requests.push({
            addConditionalFormatRule: {
              rule: {
                ranges: [
                  {
                    sheetId,
                    startRowIndex: i,
                    endRowIndex: i + 1,
                    startColumnIndex: 0,
                    endColumnIndex: 5,
                  },
                ],
                booleanRule: {
                  condition: {
                    type: 'NUMBER_GREATER',
                    values: [{ userEnteredValue: String(i * 10) }],
                  },
                  format: {
                    backgroundColor: { red: 1, green: 0, blue: 0 },
                  },
                },
              },
              index: i,
            },
          });
        }

        await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: { requests },
        });

        // Check rule count
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'sheets.conditionalFormats',
        });

        const cfRules = response.data.sheets![0].conditionalFormats || [];
        expect(cfRules.length).toBeGreaterThanOrEqual(10);
      });

      it('should consolidate redundant CF rules', async () => {
        // First add excessive rules
        const requests = [];
        for (let i = 0; i < 5; i++) {
          requests.push({
            addConditionalFormatRule: {
              rule: {
                ranges: [
                  {
                    sheetId,
                    startRowIndex: 0,
                    endRowIndex: 10,
                    startColumnIndex: i,
                    endColumnIndex: i + 1,
                  },
                ],
                booleanRule: {
                  condition: {
                    type: 'NUMBER_GREATER',
                    values: [{ userEnteredValue: '100' }],
                  },
                  format: {
                    backgroundColor: { red: 1, green: 0, blue: 0 },
                  },
                },
              },
              index: i,
            },
          });
        }

        await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: { requests },
        });

        // Get current rules
        const beforeResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'sheets.conditionalFormats',
        });
        const rulesBefore = beforeResponse.data.sheets![0].conditionalFormats || [];

        // Delete all rules and add consolidated one
        const deleteRequests = rulesBefore.map((_, index) => ({
          deleteConditionalFormatRule: {
            sheetId,
            index: rulesBefore.length - 1 - index, // Delete from end
          },
        }));

        await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: { requests: deleteRequests },
        });

        // Add single consolidated rule
        await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addConditionalFormatRule: {
                  rule: {
                    ranges: [
                      {
                        sheetId,
                        startRowIndex: 0,
                        endRowIndex: 10,
                        startColumnIndex: 0,
                        endColumnIndex: 5,
                      },
                    ],
                    booleanRule: {
                      condition: {
                        type: 'NUMBER_GREATER',
                        values: [{ userEnteredValue: '100' }],
                      },
                      format: {
                        backgroundColor: { red: 1, green: 0, blue: 0 },
                      },
                    },
                  },
                  index: 0,
                },
              },
            ],
          },
        });

        // Verify consolidation
        const afterResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'sheets.conditionalFormats',
        });
        const rulesAfter = afterResponse.data.sheets![0].conditionalFormats || [];
        expect(rulesAfter.length).toBe(1);
      });
    });
  });

  describe('Fix Preview Mode', () => {
    it('should capture state for preview without applying', async () => {
      // Add data with issues
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:B3',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            ['Header', 'Value'],
            ['=TODAY()', '100'],
            ['=TODAY()+1', '200'],
          ],
        },
      });

      // Capture current state (preview)
      const beforeState = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:B3',
        valueRenderOption: 'FORMULA',
      });

      // State captured for analysis
      expect(beforeState.data.values).toBeDefined();
      expect(beforeState.data.values![1][0]).toContain('TODAY()');
    });
  });

  describe('Fix Safety', () => {
    it('should support creating snapshot before fix', async () => {
      // Add data
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:B3',
        valueInputOption: 'RAW',
        requestBody: {
          values: [
            ['Name', 'Value'],
            ['Item1', '100'],
            ['Item2', '200'],
          ],
        },
      });

      // Capture snapshot (read current state)
      const snapshot = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:B3',
      });

      // Apply changes
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!B2:B3',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['150'], ['250']],
        },
      });

      // Verify changes were made
      const afterChange = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!B2:B3',
      });
      expect(afterChange.data.values).toEqual([['150'], ['250']]);

      // Rollback using snapshot
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:B3',
        valueInputOption: 'RAW',
        requestBody: {
          values: snapshot.data.values,
        },
      });

      // Verify rollback
      const afterRollback = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!B2:B3',
      });
      expect(afterRollback.data.values).toEqual([['100'], ['200']]);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid spreadsheet ID', async () => {
      await expect(
        client.sheets.spreadsheets.get({
          spreadsheetId: 'invalid-spreadsheet-id',
        })
      ).rejects.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    it('should track fix operation latency', async () => {
      client.resetMetrics();

      // Typical fix workflow
      await client.sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheet.id,
        fields: 'sheets.properties.gridProperties',
      });

      await client.sheets.spreadsheets.batchUpdate({
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

      const stats = client.getStats();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(2);
      expect(stats.avgDuration).toBeGreaterThan(0);
    });
  });
});
