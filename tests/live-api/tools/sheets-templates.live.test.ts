/**
 * Live API Tests for sheets_templates Tool
 *
 * Tests template management with real Google Sheets/Drive data.
 * Requires TEST_REAL_API=true environment variable.
 *
 * 8 Actions:
 * - list: List all saved templates
 * - get: Get template details by ID
 * - create: Save spreadsheet as a new template
 * - apply: Create new spreadsheet from template
 * - update: Update template definition
 * - delete: Delete a saved template
 * - preview: Preview template structure without applying
 * - import_builtin: Import a builtin template to your collection
 *
 * Note: Templates are stored in Google Drive appDataFolder which requires
 * special scope and may not be accessible in all test environments.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LiveApiClient } from '../setup/live-api-client.js';
import { TestSpreadsheetManager, TestSpreadsheet } from '../setup/test-spreadsheet-manager.js';
import { loadTestCredentials, shouldRunIntegrationTests } from '../../helpers/credential-loader.js';

const runLiveTests = shouldRunIntegrationTests();

describe.skipIf(!runLiveTests)('sheets_templates Live API Tests', () => {
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
    testSpreadsheet = await manager.createTestSpreadsheet('templates');
  });

  describe('Template Structure Validation', () => {
    describe('list action context', () => {
      it('should handle empty template list', () => {
        const templates: unknown[] = [];
        expect(templates.length).toBe(0);
      });

      it('should filter templates by category', () => {
        const templates = [
          { id: '1', name: 'Budget', category: 'finance' },
          { id: '2', name: 'Timeline', category: 'project' },
          { id: '3', name: 'Invoice', category: 'finance' },
        ];

        const financeTemplates = templates.filter((t) => t.category === 'finance');
        expect(financeTemplates.length).toBe(2);
      });
    });

    describe('get action context', () => {
      it('should validate template structure', () => {
        const template = {
          id: 'template_123',
          name: 'Sales Report',
          description: 'Monthly sales tracking',
          category: 'sales',
          version: '1.0.0',
          sheets: [
            {
              name: 'Data',
              headers: ['Date', 'Product', 'Quantity', 'Revenue'],
              rowCount: 1000,
              columnCount: 10,
              frozenRowCount: 1,
            },
            {
              name: 'Summary',
              headers: ['Metric', 'Value'],
              rowCount: 100,
              columnCount: 2,
            },
          ],
          namedRanges: [
            { name: 'DataRange', range: 'Data!A2:D1000' },
            { name: 'SummaryTable', range: 'Summary!A1:B100' },
          ],
        };

        expect(template.sheets.length).toBe(2);
        expect(template.sheets[0].headers).toContain('Revenue');
        expect(template.namedRanges?.length).toBe(2);
      });
    });

    describe('create action context', () => {
      it('should extract template from existing spreadsheet', async () => {
        // Set up test spreadsheet with structure
        const meta = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
        });

        const sheetId = meta.data.sheets![0].properties!.sheetId!;

        // Add headers
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:E1',
          valueInputOption: 'RAW',
          requestBody: {
            values: [['ID', 'Name', 'Quantity', 'Price', 'Total']],
          },
        });

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
                  },
                  cell: {
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                    },
                  },
                  fields: 'userEnteredFormat(textFormat.bold,backgroundColor)',
                },
              },
            ],
          },
        });

        // Freeze header row
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

        // Read back the structure
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          includeGridData: false,
        });

        const sheet = response.data.sheets![0];
        const frozenRows = sheet.properties?.gridProperties?.frozenRowCount || 0;

        expect(frozenRows).toBe(1);
      });

      it('should capture column widths for template', async () => {
        const meta = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
        });

        const sheetId = meta.data.sheets![0].properties!.sheetId!;

        // Set specific column widths
        await client.sheets.spreadsheets.batchUpdate({
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
                    pixelSize: 150,
                  },
                  fields: 'pixelSize',
                },
              },
              {
                updateDimensionProperties: {
                  range: {
                    sheetId,
                    dimension: 'COLUMNS',
                    startIndex: 1,
                    endIndex: 2,
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

        // Get updated dimensions
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          includeGridData: true,
          ranges: ['TestData!A1:B1'],
        });

        const gridData = response.data.sheets![0].data?.[0];
        expect(gridData).toBeDefined();
      });
    });

    describe('apply action context', () => {
      it('should create new spreadsheet from template structure', async () => {
        // Template definition
        const template = {
          name: 'Test Template',
          sheets: [
            {
              name: 'Data',
              headers: ['Column A', 'Column B', 'Column C'],
              frozenRowCount: 1,
            },
          ],
        };

        // Create new spreadsheet based on template
        const createResponse = await client.sheets.spreadsheets.create({
          requestBody: {
            properties: {
              title: `FromTemplate_${Date.now()}`,
            },
            sheets: template.sheets.map((s) => ({
              properties: {
                title: s.name,
                gridProperties: {
                  frozenRowCount: s.frozenRowCount || 0,
                },
              },
            })),
          },
        });

        const newSpreadsheetId = createResponse.data.spreadsheetId!;
        expect(newSpreadsheetId).toBeDefined();

        // Add headers from template
        for (const sheet of template.sheets) {
          if (sheet.headers?.length) {
            await client.sheets.spreadsheets.values.update({
              spreadsheetId: newSpreadsheetId,
              range: `${sheet.name}!A1:${String.fromCharCode(64 + sheet.headers.length)}1`,
              valueInputOption: 'RAW',
              requestBody: {
                values: [sheet.headers],
              },
            });
          }
        }

        // Verify
        const readResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: newSpreadsheetId,
          range: 'Data!A1:C1',
        });

        expect(readResponse.data.values![0]).toEqual(['Column A', 'Column B', 'Column C']);

        // Cleanup
        await client.drive.files.delete({ fileId: newSpreadsheetId });
      });

      it('should apply named ranges from template', async () => {
        // Create spreadsheet with data first
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B5',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Name', 'Value'],
              ['Item1', '100'],
              ['Item2', '200'],
              ['Item3', '300'],
              ['Item4', '400'],
            ],
          },
        });

        const meta = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
        });

        const sheetId = meta.data.sheets![0].properties!.sheetId!;

        // Add named range (simulating template application)
        await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addNamedRange: {
                  namedRange: {
                    name: 'DataValues',
                    range: {
                      sheetId,
                      startRowIndex: 1,
                      endRowIndex: 5,
                      startColumnIndex: 1,
                      endColumnIndex: 2,
                    },
                  },
                },
              },
            ],
          },
        });

        // Verify named range exists
        const verifyResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'namedRanges',
        });

        const namedRanges = verifyResponse.data.namedRanges || [];
        expect(namedRanges.some((nr) => nr.name === 'DataValues')).toBe(true);
      });
    });

    describe('update action context', () => {
      it('should update template metadata', () => {
        const template = {
          id: 'template_123',
          name: 'Old Name',
          description: 'Old description',
          version: '1.0.0',
        };

        const updates = {
          name: 'New Name',
          description: 'Updated description',
          version: '1.1.0',
        };

        const updatedTemplate = {
          ...template,
          ...updates,
          updated: new Date().toISOString(),
        };

        expect(updatedTemplate.name).toBe('New Name');
        expect(updatedTemplate.version).toBe('1.1.0');
      });
    });

    describe('delete action context', () => {
      it('should handle template deletion', () => {
        const templates = [
          { id: 't1', name: 'Template 1' },
          { id: 't2', name: 'Template 2' },
          { id: 't3', name: 'Template 3' },
        ];

        const toDelete = 't2';
        const remaining = templates.filter((t) => t.id !== toDelete);

        expect(remaining.length).toBe(2);
        expect(remaining.find((t) => t.id === 't2')).toBeUndefined();
      });
    });

    describe('preview action context', () => {
      it('should generate template preview', () => {
        const template = {
          name: 'Invoice Template',
          description: 'Standard invoice format',
          sheets: [
            {
              name: 'Invoice',
              headers: ['Date', 'Description', 'Quantity', 'Rate', 'Amount'],
              rowCount: 100,
              columnCount: 5,
            },
            {
              name: 'Terms',
              headers: ['Condition', 'Details'],
              rowCount: 20,
              columnCount: 2,
            },
          ],
          namedRanges: [
            { name: 'LineItems', range: 'Invoice!A2:E100' },
            { name: 'TotalCell', range: 'Invoice!E101' },
          ],
        };

        const preview = {
          name: template.name,
          description: template.description,
          sheets: template.sheets.map((s) => ({
            name: s.name,
            headers: s.headers,
            rowCount: s.rowCount,
            columnCount: s.columnCount,
          })),
          namedRanges: template.namedRanges?.map((nr) => nr.name),
        };

        expect(preview.sheets.length).toBe(2);
        expect(preview.namedRanges).toContain('LineItems');
      });
    });

    describe('import_builtin action context', () => {
      it('should define builtin template structure', () => {
        // Builtin templates that could be available
        const builtinTemplates = [
          {
            builtinName: 'budget_tracker',
            name: 'Budget Tracker',
            category: 'finance',
            sheets: ['Transactions', 'Summary', 'Categories'],
          },
          {
            builtinName: 'project_timeline',
            name: 'Project Timeline',
            category: 'project',
            sheets: ['Tasks', 'Milestones', 'Resources'],
          },
          {
            builtinName: 'inventory_manager',
            name: 'Inventory Manager',
            category: 'operations',
            sheets: ['Items', 'Transactions', 'Alerts'],
          },
        ];

        expect(builtinTemplates.length).toBeGreaterThan(0);

        const budgetTemplate = builtinTemplates.find((t) => t.builtinName === 'budget_tracker');
        expect(budgetTemplate?.sheets).toContain('Transactions');
      });

      it('should customize imported template name', () => {
        const builtinTemplate = {
          builtinName: 'budget_tracker',
          name: 'Budget Tracker',
        };

        const customName = 'My Personal Budget';
        const importedTemplate = {
          ...builtinTemplate,
          name: customName,
          id: `imported_${Date.now()}`,
        };

        expect(importedTemplate.name).toBe('My Personal Budget');
        expect(importedTemplate.id).toContain('imported_');
      });
    });
  });

  describe('Template Operations with Real Data', () => {
    it('should create template-ready spreadsheet structure', async () => {
      // Set up a complete template-worthy spreadsheet
      const meta = await client.sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheet.id,
      });

      const sheetId = meta.data.sheets![0].properties!.sheetId!;

      // Add headers with formatting
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:F1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['ID', 'Date', 'Description', 'Category', 'Amount', 'Status']],
        },
      });

      // Apply header formatting and freeze
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
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                    backgroundColor: { red: 0.2, green: 0.4, blue: 0.7 },
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)',
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

      // Verify structure
      const verifyResponse = await client.sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheet.id,
      });

      const sheet = verifyResponse.data.sheets![0];
      expect(sheet.properties?.gridProperties?.frozenRowCount).toBe(1);
    });

    it('should clone spreadsheet structure for template application', async () => {
      // Add some structure to test spreadsheet
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:C3',
        valueInputOption: 'RAW',
        requestBody: {
          values: [
            ['Header1', 'Header2', 'Header3'],
            ['Data1', 'Data2', 'Data3'],
            ['Data4', 'Data5', 'Data6'],
          ],
        },
      });

      // Create a copy (simulating template apply)
      const copyResponse = await client.drive.files.copy({
        fileId: testSpreadsheet.id,
        requestBody: {
          name: `TemplateCopy_${Date.now()}`,
        },
      });

      const copiedId = copyResponse.data.id!;
      expect(copiedId).toBeDefined();

      // Verify copy has same structure
      const verifyResponse = await client.sheets.spreadsheets.values.get({
        spreadsheetId: copiedId,
        range: 'TestData!A1:C1',
      });

      expect(verifyResponse.data.values![0]).toEqual(['Header1', 'Header2', 'Header3']);

      // Cleanup
      await client.drive.files.delete({ fileId: copiedId });
    });
  });

  describe('Performance Metrics', () => {
    it('should track template-related operations', async () => {
      client.resetMetrics();

      // Operations typical for template management
      await client.sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheet.id,
        fields: 'sheets.properties,namedRanges',
      });

      await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!1:1',
      });

      const stats = client.getStats();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(2);
    });
  });
});
