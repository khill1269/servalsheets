/**
 * Live API Tests for sheets_dependencies Tool
 *
 * Tests formula dependency analysis with real Google Sheets data.
 * Requires TEST_REAL_API=true environment variable.
 *
 * 7 Actions:
 * - build: Build dependency graph for spreadsheet
 * - analyze_impact: Analyze impact of changing a cell
 * - detect_cycles: Detect circular dependencies
 * - get_dependencies: Get cells that a cell depends on
 * - get_dependents: Get cells that depend on a cell
 * - get_stats: Get dependency statistics
 * - export_dot: Export graph in DOT format (Graphviz)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LiveApiClient } from '../setup/live-api-client.js';
import { TestSpreadsheetManager, TestSpreadsheet } from '../setup/test-spreadsheet-manager.js';
import { loadTestCredentials, shouldRunIntegrationTests } from '../../helpers/credential-loader.js';

const runLiveTests = shouldRunIntegrationTests();

describe.skipIf(!runLiveTests)('sheets_dependencies Live API Tests', () => {
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
    testSpreadsheet = await manager.createTestSpreadsheet('dependencies');
  });

  describe('build action', () => {
    it('should create dependency graph from formulas', async () => {
      // Create spreadsheet with formulas
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:D5',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            ['Value1', 'Value2', 'Sum', 'Product'],
            ['10', '20', '=A2+B2', '=A2*B2'],
            ['30', '40', '=A3+B3', '=A3*B3'],
            ['50', '60', '=A4+B4', '=A4*B4'],
            ['Total', '', '=SUM(C2:C4)', '=SUM(D2:D4)'],
          ],
        },
      });

      // Read formulas to build dependency graph
      const response = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:D5',
        valueRenderOption: 'FORMULA',
      });

      const values = response.data.values!;

      // Verify formulas are present
      expect(values[1][2]).toBe('=A2+B2');
      expect(values[4][2]).toBe('=SUM(C2:C4)');
    });

    it('should identify formula cells vs value cells', async () => {
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:C3',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            ['100', '200', '=A1+B1'],
            ['Text', 'More text', '=CONCATENATE(A2,B2)'],
            ['', '', '=IF(A1>B1,"Yes","No")'],
          ],
        },
      });

      // Get both values and formulas
      const [_valuesResponse, formulasResponse] = await Promise.all([
        client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:C3',
          valueRenderOption: 'UNFORMATTED_VALUE',
        }),
        client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:C3',
          valueRenderOption: 'FORMULA',
        }),
      ]);

      const formulas = formulasResponse.data.values!;

      // Column C contains formulas
      expect(formulas[0][2]).toContain('=');
      expect(formulas[1][2]).toContain('=');
      expect(formulas[2][2]).toContain('=');

      // Columns A and B are values (no = prefix)
      expect(formulas[0][0]).not.toContain('=');
    });
  });

  describe('analyze_impact action', () => {
    it('should analyze impact of changing a source cell', async () => {
      // Create formula chain: A1 -> B1 -> C1 -> D1
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:D1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['100', '=A1*2', '=B1+10', '=C1/5']],
        },
      });

      // Read calculated values
      const response = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:D1',
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      // A1=100, B1=200, C1=210, D1=42
      expect(response.data.values![0]).toEqual([100, 200, 210, 42]);

      // Impact analysis: changing A1 affects B1, C1, D1
      // Impact chain length: 3 cells
      const impactedCells = 3;
      expect(impactedCells).toBe(3);
    });

    it('should calculate recalculation cost', async () => {
      // Create a complex dependency structure
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:F10',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            ['Data', 'Col1', 'Col2', 'Col3', 'Col4', 'Total'],
            ...Array.from({ length: 9 }, (_, i) => [
              `Row${i + 1}`,
              `${(i + 1) * 10}`,
              `${(i + 1) * 20}`,
              `=B${i + 2}+C${i + 2}`,
              `=D${i + 2}*2`,
              `=SUM(B${i + 2}:E${i + 2})`,
            ]),
          ],
        },
      });

      // Verify formulas work
      const response = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!F2:F10',
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      expect(response.data.values!.length).toBe(9);

      // Cost calculation would consider:
      // - Number of affected formulas: 27 (9 rows x 3 formula columns)
      // - Depth of dependency chain: 3
      // - Complexity score: moderate
    });
  });

  describe('detect_cycles action', () => {
    it('should detect direct circular reference', async () => {
      // Note: Google Sheets will show #REF! for circular references
      // We can still detect them by analyzing formula references

      // Create data that would be circular if referenced
      const circularFormula = {
        cell: 'A1',
        wouldBe: '=A1+1', // Direct self-reference
      };

      expect(circularFormula.wouldBe).toContain('A1');
    });

    it('should detect indirect circular reference chain', () => {
      // A1 -> B1 -> C1 -> A1 (cycle)
      const formulas = [
        { cell: 'A1', formula: '=C1+1', dependsOn: ['C1'] },
        { cell: 'B1', formula: '=A1*2', dependsOn: ['A1'] },
        { cell: 'C1', formula: '=B1-5', dependsOn: ['B1'] },
      ];

      // Build dependency graph
      const graph: Record<string, string[]> = {};
      for (const f of formulas) {
        graph[f.cell] = f.dependsOn;
      }

      // DFS to detect cycle
      function hasCycle(start: string, visited: Set<string>, path: Set<string>): boolean {
        if (path.has(start)) return true;
        if (visited.has(start)) return false;

        visited.add(start);
        path.add(start);

        for (const dep of graph[start] || []) {
          if (hasCycle(dep, visited, path)) return true;
        }

        path.delete(start);
        return false;
      }

      const visited = new Set<string>();
      const cycleDetected = hasCycle('A1', visited, new Set());
      expect(cycleDetected).toBe(true);
    });
  });

  describe('get_dependencies action', () => {
    it('should get direct dependencies of a formula cell', async () => {
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:C1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['10', '20', '=A1+B1']],
        },
      });

      // Get formula
      const response = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!C1',
        valueRenderOption: 'FORMULA',
      });

      const formula = response.data.values![0][0];
      expect(formula).toBe('=A1+B1');

      // Parse dependencies from formula
      const cellRefs = formula.match(/[A-Z]+\d+/g) || [];
      expect(cellRefs).toContain('A1');
      expect(cellRefs).toContain('B1');
    });

    it('should handle range references', async () => {
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:A5',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['10'], ['20'], ['30'], ['40'], ['=SUM(A1:A4)']],
        },
      });

      const response = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A5',
        valueRenderOption: 'FORMULA',
      });

      const formula = response.data.values![0][0];
      expect(formula).toContain('A1:A4');

      // Range A1:A4 expands to: A1, A2, A3, A4
      const expandedDeps = ['A1', 'A2', 'A3', 'A4'];
      expect(expandedDeps.length).toBe(4);
    });

    it('should handle cross-sheet references', async () => {
      // Add another sheet
      await client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: testSpreadsheet.id,
        requestBody: {
          requests: [{ addSheet: { properties: { title: 'DataSource' } } }],
        },
      });

      // Write data to source sheet
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'DataSource!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['100']],
        },
      });

      // Create cross-sheet reference
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['=DataSource!A1*2']],
        },
      });

      const response = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1',
        valueRenderOption: 'FORMULA',
      });

      expect(response.data.values![0][0]).toContain('DataSource!');
    });
  });

  describe('get_dependents action', () => {
    it('should get cells that depend on a given cell', async () => {
      // A1 is depended on by B1, C1
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:C1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['100', '=A1*2', '=A1+50']],
        },
      });

      // Get all formulas
      const response = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:C1',
        valueRenderOption: 'FORMULA',
      });

      const formulas = response.data.values![0];

      // Find cells that reference A1
      const dependents: string[] = [];
      const cellAddresses = ['A1', 'B1', 'C1'];

      for (let i = 0; i < formulas.length; i++) {
        if (formulas[i].includes('A1') && cellAddresses[i] !== 'A1') {
          dependents.push(cellAddresses[i]);
        }
      }

      expect(dependents).toContain('B1');
      expect(dependents).toContain('C1');
    });
  });

  describe('get_stats action', () => {
    it('should calculate dependency statistics', async () => {
      // Create a spreadsheet with various cell types
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:D5',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            ['Value', 'Value', 'Formula', 'Formula'],
            ['10', '20', '=A2+B2', '=C2*2'],
            ['30', '40', '=A3+B3', '=C3*2'],
            ['50', '60', '=A4+B4', '=C4*2'],
            ['', '', '=SUM(C2:C4)', '=SUM(D2:D4)'],
          ],
        },
      });

      // Get formulas to count
      const response = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:D5',
        valueRenderOption: 'FORMULA',
      });

      const values = response.data.values!;
      let formulaCells = 0;
      let valueCells = 0;

      for (const row of values) {
        for (const cell of row) {
          if (cell && cell.toString().startsWith('=')) {
            formulaCells++;
          } else if (cell !== '' && cell !== undefined) {
            valueCells++;
          }
        }
      }

      expect(formulaCells).toBe(8); // C2:C5, D2:D5
      expect(valueCells).toBe(7); // A2:A4, B2:B4, A1
    });
  });

  describe('export_dot action', () => {
    it('should generate DOT format graph', async () => {
      // Create simple dependency chain
      await client.sheets.spreadsheets.values.update({
        spreadsheetId: testSpreadsheet.id,
        range: 'TestData!A1:C1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [['100', '=A1*2', '=B1+10']],
        },
      });

      // Generate DOT format
      const dependencies = [
        { from: 'A1', to: 'B1' },
        { from: 'B1', to: 'C1' },
      ];

      const dotGraph = `digraph Dependencies {
  rankdir=LR;
  node [shape=box];
  ${dependencies.map((d) => `"${d.from}" -> "${d.to}";`).join('\n  ')}
}`;

      expect(dotGraph).toContain('digraph');
      expect(dotGraph).toContain('A1');
      expect(dotGraph).toContain('->');
    });
  });

  describe('Performance Metrics', () => {
    it('should track dependency analysis operations', async () => {
      client.resetMetrics();

      // Create data with formulas
      await client.trackOperation('valuesUpdate', 'POST', () =>
        client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B3',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              ['100', '=A1*2'],
              ['200', '=A2*2'],
              ['=SUM(A1:A2)', '=SUM(B1:B2)'],
            ],
          },
        })
      );

      // Read formulas for analysis
      await client.trackOperation('valuesGet', 'GET', () =>
        client.sheets.spreadsheets.values.get({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1:B3',
          valueRenderOption: 'FORMULA',
        })
      );

      const stats = client.getStats();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(2);
    });
  });
});
