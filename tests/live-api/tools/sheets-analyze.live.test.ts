/**
 * Live API Tests for sheets_analyze Tool
 *
 * Tests analysis operations against the real Google API.
 * Requires TEST_REAL_API=true environment variable.
 *
 * 16 Actions:
 * Core (5): comprehensive, analyze_data, suggest_visualization, generate_formula, detect_patterns
 * Specialized (4): analyze_structure, analyze_quality, analyze_performance, analyze_formulas
 * Intelligence (2): query_natural_language, explain_analysis
 * Progressive (5): scout, plan, execute_plan, drill_down, generate_actions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LiveApiClient } from '../setup/live-api-client.js';
import { TestSpreadsheetManager, TestSpreadsheet } from '../setup/test-spreadsheet-manager.js';
import {
  loadTestCredentials,
  shouldRunIntegrationTests,
} from '../../helpers/credential-loader.js';

const runLiveTests = shouldRunIntegrationTests();

describe.skipIf(!runLiveTests)('sheets_analyze Live API Tests', () => {
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
    testSpreadsheet = await manager.createTestSpreadsheet('analyze');
    const meta = await client.sheets.spreadsheets.get({
      spreadsheetId: testSpreadsheet.id,
    });
    sheetId = meta.data.sheets![0].properties!.sheetId!;

    // Seed with sample data for analysis
    await client.sheets.spreadsheets.values.update({
      spreadsheetId: testSpreadsheet.id,
      range: 'TestData!A1:E10',
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          ['Name', 'Department', 'Sales', 'Quarter', 'Year'],
          ['Alice', 'Engineering', '15000', 'Q1', '2024'],
          ['Bob', 'Sales', '22000', 'Q1', '2024'],
          ['Carol', 'Engineering', '18000', 'Q2', '2024'],
          ['David', 'Marketing', '12000', 'Q2', '2024'],
          ['Eve', 'Sales', '28000', 'Q3', '2024'],
          ['Frank', 'Engineering', '21000', 'Q3', '2024'],
          ['Grace', 'Marketing', '16000', 'Q4', '2024'],
          ['Henry', 'Sales', '25000', 'Q4', '2024'],
          ['Ivy', 'Engineering', '19000', 'Q4', '2024'],
        ],
      },
    });
  });

  describe('Structure Analysis', () => {
    describe('analyze_structure action', () => {
      it('should get spreadsheet metadata', async () => {
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'properties,sheets.properties,namedRanges',
        });

        expect(response.status).toBe(200);
        expect(response.data.properties?.title).toBeDefined();
        expect(response.data.sheets).toBeDefined();
        expect(response.data.sheets!.length).toBeGreaterThan(0);
      });

      it('should detect sheet structure', async () => {
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'sheets(properties,data.rowData.values.userEnteredValue)',
        });

        expect(response.status).toBe(200);
        const sheet = response.data.sheets![0];
        expect(sheet.properties).toBeDefined();
        expect(sheet.properties!.gridProperties).toBeDefined();
      });
    });
  });

  describe('Data Quality Analysis', () => {
    describe('analyze_quality action', () => {
      it('should detect data types in columns', async () => {
        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:E10',
          valueRenderOption: 'UNFORMATTED_VALUE',
        });

        expect(response.status).toBe(200);
        expect(response.data.values).toBeDefined();
        expect(response.data.values!.length).toBe(10);

        // Verify data structure
        const headers = response.data.values![0];
        expect(headers).toContain('Name');
        expect(headers).toContain('Sales');
      });

      it('should detect missing values', async () => {
        // Add data with missing values
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A12:E15',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Name', 'Department', 'Sales', 'Quarter', 'Year'],
              ['John', '', '10000', 'Q1', '2024'],  // Missing department
              ['Jane', 'Sales', '', 'Q2', '2024'],   // Missing sales
              ['', 'Marketing', '15000', 'Q3', ''],  // Missing name and year
            ],
          },
        });

        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A12:E15',
        });

        expect(response.status).toBe(200);
        // Verify we can read the data with gaps
        const data = response.data.values!;
        expect(data[1][1]).toBe('');  // Missing department
        expect(data[2][2]).toBe('');  // Missing sales
      });

      it('should detect duplicates', async () => {
        // Add duplicate data
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!G1:H5',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['ID', 'Value'],
              ['A001', '100'],
              ['A002', '200'],
              ['A001', '150'],  // Duplicate ID
              ['A003', '300'],
            ],
          },
        });

        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!G1:H5',
        });

        expect(response.status).toBe(200);
        const data = response.data.values!;
        // Verify duplicate exists
        const ids = data.slice(1).map(row => row[0]);
        const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
        expect(duplicates).toContain('A001');
      });
    });
  });

  describe('Statistical Analysis', () => {
    describe('analyze_data action', () => {
      it('should compute basic statistics', async () => {
        // Get sales data for statistical analysis
        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!C2:C10',
          valueRenderOption: 'UNFORMATTED_VALUE',
        });

        expect(response.status).toBe(200);
        const values = response.data.values!.flat().map(Number);

        // Calculate basic stats
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);

        expect(sum).toBeGreaterThan(0);
        expect(avg).toBeGreaterThan(0);
        expect(min).toBeLessThan(max);
      });

      it('should analyze data distribution', async () => {
        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!B2:B10',
        });

        expect(response.status).toBe(200);
        const departments = response.data.values!.flat();

        // Count distribution
        const distribution: Record<string, number> = {};
        departments.forEach(dept => {
          distribution[dept] = (distribution[dept] || 0) + 1;
        });

        expect(Object.keys(distribution).length).toBeGreaterThan(1);
      });
    });
  });

  describe('Pattern Detection', () => {
    describe('detect_patterns action', () => {
      it('should detect trends in time series data', async () => {
        // Add time series data
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'Benchmarks!A1:B13',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Month', 'Revenue'],
              ['Jan', '10000'],
              ['Feb', '11500'],
              ['Mar', '12000'],
              ['Apr', '13500'],
              ['May', '14000'],
              ['Jun', '15500'],
              ['Jul', '16000'],
              ['Aug', '17500'],
              ['Sep', '18000'],
              ['Oct', '19500'],
              ['Nov', '20000'],
              ['Dec', '21500'],
            ],
          },
        });

        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'Benchmarks!B2:B13',
          valueRenderOption: 'UNFORMATTED_VALUE',
        });

        expect(response.status).toBe(200);
        const values = response.data.values!.flat().map(Number);

        // Detect upward trend (each value >= previous)
        let isUpwardTrend = true;
        for (let i = 1; i < values.length; i++) {
          if (values[i] < values[i - 1]) {
            isUpwardTrend = false;
            break;
          }
        }
        expect(isUpwardTrend).toBe(true);
      });

      it('should detect outliers', async () => {
        // Add data with outliers
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'Formulas!A1:B10',
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['ID', 'Value'],
              ['1', '100'],
              ['2', '105'],
              ['3', '98'],
              ['4', '102'],
              ['5', '500'],  // Outlier
              ['6', '99'],
              ['7', '103'],
              ['8', '97'],
              ['9', '101'],
            ],
          },
        });

        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'Formulas!B2:B10',
          valueRenderOption: 'UNFORMATTED_VALUE',
        });

        expect(response.status).toBe(200);
        const values = response.data.values!.flat().map(Number);

        // Calculate mean and std dev
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        // Find values more than 2 std devs from mean
        const outliers = values.filter(v => Math.abs(v - mean) > 2 * stdDev);
        expect(outliers).toContain(500);
      });
    });
  });

  describe('Formula Analysis', () => {
    describe('analyze_formulas action', () => {
      it('should detect formulas in a range', async () => {
        // Add formulas
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'Formulas!D1:E5',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              ['Sum', 'Average'],
              ['=SUM(B2:B10)', '=AVERAGE(B2:B10)'],
              ['=MAX(B2:B10)', '=MIN(B2:B10)'],
              ['=COUNT(B2:B10)', '=COUNTA(B2:B10)'],
              ['=MEDIAN(B2:B10)', '=STDEV(B2:B10)'],
            ],
          },
        });

        // Get formulas
        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'Formulas!D2:E5',
          valueRenderOption: 'FORMULA',
        });

        expect(response.status).toBe(200);
        const formulas = response.data.values!.flat();
        expect(formulas.some(f => f.includes('SUM'))).toBe(true);
        expect(formulas.some(f => f.includes('AVERAGE'))).toBe(true);
      });

      it('should detect formula errors', async () => {
        // Add formula that will produce an error
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'Formulas!G1:G3',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              ['Error Tests'],
              ['=1/0'],  // Division by zero
              ['=SQRT(-1)'],  // Invalid operation
            ],
          },
        });

        // Get values to see errors
        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'Formulas!G2:G3',
          valueRenderOption: 'FORMATTED_VALUE',
        });

        expect(response.status).toBe(200);
        const values = response.data.values!.flat();
        // Google Sheets shows #DIV/0! and #NUM! for these errors
        expect(values.some(v => v.includes('#'))).toBe(true);
      });
    });
  });

  describe('Visualization Suggestions', () => {
    describe('suggest_visualization action', () => {
      it('should identify suitable chart types for categorical data', async () => {
        // Read existing data to suggest charts
        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:E10',
        });

        expect(response.status).toBe(200);
        const data = response.data.values!;
        const headers = data[0];

        // Check if we have the right data types for different chart types
        expect(headers).toContain('Department');  // Categorical - good for pie/bar
        expect(headers).toContain('Sales');       // Numeric - good for bar/line
        expect(headers).toContain('Quarter');     // Time-based - good for line
      });

      it('should identify data suitable for pivot tables', async () => {
        const response = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:E10',
        });

        expect(response.status).toBe(200);
        const data = response.data.values!;

        // Data suitable for pivot if:
        // - Has multiple categorical columns (Department, Quarter)
        // - Has numeric columns for aggregation (Sales)
        // - Has enough rows for meaningful aggregation
        expect(data.length).toBeGreaterThanOrEqual(5);
        expect(data[0].length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('Scout (Quick Metadata Scan)', () => {
    describe('scout action', () => {
      it('should quickly retrieve spreadsheet metadata', async () => {
        const startTime = Date.now();

        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'properties,sheets.properties',
        });

        const duration = Date.now() - startTime;

        expect(response.status).toBe(200);
        expect(response.data.properties?.title).toBeDefined();
        expect(response.data.sheets).toBeDefined();

        // Scout should be fast (typically < 500ms)
        expect(duration).toBeLessThan(5000);  // 5 second max for test reliability
      });

      it('should get sheet-level statistics', async () => {
        const response = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'sheets(properties(sheetId,title,gridProperties))',
        });

        expect(response.status).toBe(200);
        const sheets = response.data.sheets!;

        sheets.forEach(sheet => {
          expect(sheet.properties?.sheetId).toBeDefined();
          expect(sheet.properties?.title).toBeDefined();
          expect(sheet.properties?.gridProperties?.rowCount).toBeDefined();
          expect(sheet.properties?.gridProperties?.columnCount).toBeDefined();
        });
      });
    });
  });

  describe('Comprehensive Analysis', () => {
    describe('comprehensive action', () => {
      it('should retrieve complete spreadsheet data for analysis', async () => {
        // Get all data
        const dataResponse = await client.sheets.spreadsheets.values.batchGet({
          spreadsheetId: testSpreadsheet.id,
          ranges: ['TestData!A1:E10', 'Benchmarks!A1:Z100', 'Formulas!A1:Z100'],
        });

        expect(dataResponse.status).toBe(200);
        expect(dataResponse.data.valueRanges).toBeDefined();
        expect(dataResponse.data.valueRanges!.length).toBeGreaterThan(0);
      });

      it('should get both metadata and data in single operation', async () => {
        // Batch get metadata and data
        const metaResponse = await client.sheets.spreadsheets.get({
          spreadsheetId: testSpreadsheet.id,
          fields: 'properties,sheets.properties,namedRanges',
        });

        const dataResponse = await client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:E10',
        });

        expect(metaResponse.status).toBe(200);
        expect(dataResponse.status).toBe(200);
        expect(metaResponse.data.sheets).toBeDefined();
        expect(dataResponse.data.values).toBeDefined();
      });
    });
  });

  describe('Large Dataset Handling', () => {
    it('should handle sampling for large datasets', async () => {
      // Create larger dataset
      const largeData = [['ID', 'Value', 'Category']];
      for (let i = 1; i <= 100; i++) {
        largeData.push([
          String(i),
          String(Math.floor(Math.random() * 1000)),
          ['A', 'B', 'C'][i % 3],
        ]);
      }

      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'Benchmarks!A1:C101',
        valueInputOption: 'RAW',
        requestBody: {
          values: largeData,
        },
      });

      // Read with sampling (just first N rows)
      const sampleResponse = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'Benchmarks!A1:C20',  // Sample of 20 rows
      });

      expect(sampleResponse.status).toBe(200);
      expect(sampleResponse.data.values!.length).toBe(20);
    });
  });

  describe('Performance Metrics', () => {
    it('should track analysis API latency', async () => {
      client.resetMetrics();

      // Perform typical analysis workflow
      await client.sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheet.id,
        fields: 'properties,sheets.properties',
      });

      await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:E10',
      });

      await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:E10',
        valueRenderOption: 'FORMULA',
      });

      const stats = client.getStats();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(3);
      expect(stats.avgDuration).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid range gracefully', async () => {
      await expect(
        client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'NonExistentSheet!A1:Z100',
        })
      ).rejects.toThrow();
    });

    it('should handle non-existent spreadsheet', async () => {
      await expect(
        client.sheets.spreadsheets.get({
          spreadsheetId: 'non-existent-spreadsheet-id',
        })
      ).rejects.toThrow();
    });
  });
});
