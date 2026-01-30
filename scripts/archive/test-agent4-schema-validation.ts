/**
 * Test Agent 4: Schema Validation (Fixes #6, #7)
 *
 * Tests that schemas properly handle:
 * 1. Color precision auto-rounding to 4 decimals
 * 2. Dimension operations with numeric columnIndex
 * 3. Auto-fit with lowercase dimensions
 *
 * This tests the Zod schema transformations WITHOUT needing authentication.
 */

import { ColorSchema, DimensionSchema } from '../src/schemas/shared.js';
import { SheetsFormatInputSchema } from '../src/schemas/format.js';
import { SheetsDimensionsInputSchema } from '../src/schemas/dimensions.js';

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

class SchemaValidationTester {
  private results: TestResult[] = [];

  async run(): Promise<void> {
    console.log('🧪 Test Agent 4: Schema Validation (Color Precision & Dimensions)\n');

    // Test 1: Color precision auto-rounding
    this.testColorPrecision();

    // Test 2: Dimension lowercase handling
    this.testDimensionLowercase();

    // Test 3: columnIndex numeric validation
    this.testColumnIndexNumeric();

    // Test 4: Auto-fit with lowercase dimensions
    this.testAutoFitLowercase();

    // Report results
    this.reportResults();
  }

  private testColorPrecision(): void {
    console.log('🎨 Testing color precision auto-rounding...\n');

    const colorTests = [
      {
        name: 'High precision RGB values',
        input: { red: 0.333333333333, green: 0.666666666666, blue: 0.999999999999 },
        expected: { red: 0.3333, green: 0.6667, blue: 1, alpha: 1 },
      },
      {
        name: 'Mixed precision values',
        input: { red: 0.123456789, green: 0.987654321, blue: 0.5 },
        expected: { red: 0.1235, green: 0.9877, blue: 0.5, alpha: 1 },
      },
      {
        name: 'Google blue #4285F4',
        input: { red: 0.2588235294117647, green: 0.5215686274509804, blue: 0.9568627450980393 },
        expected: { red: 0.2588, green: 0.5216, blue: 0.9569, alpha: 1 },
      },
      {
        name: 'Near-zero precision',
        input: { red: 0.00001, green: 0.99999, blue: 0.123456 },
        expected: { red: 0, green: 1, blue: 0.1235, alpha: 1 },
      },
    ];

    for (const test of colorTests) {
      try {
        console.log(`  Testing: ${test.name}`);
        console.log(`    Input:    ${JSON.stringify(test.input)}`);

        const result = ColorSchema.parse(test.input);

        console.log(`    Output:   ${JSON.stringify(result)}`);
        console.log(`    Expected: ${JSON.stringify(test.expected)}`);

        // Verify rounding
        const matches =
          result.red === test.expected.red &&
          result.green === test.expected.green &&
          result.blue === test.expected.blue &&
          result.alpha === test.expected.alpha;

        if (matches) {
          console.log(`    ✅ ${test.name} passed\n`);
          this.results.push({
            name: `Color: ${test.name}`,
            success: true,
            details: { input: test.input, output: result },
          });
        } else {
          throw new Error(
            `Color mismatch: got ${JSON.stringify(result)}, expected ${JSON.stringify(test.expected)}`
          );
        }
      } catch (error) {
        console.log(`    ❌ ${test.name} failed: ${error}\n`);
        this.results.push({
          name: `Color: ${test.name}`,
          success: false,
          error: String(error),
        });
      }
    }
  }

  private testDimensionLowercase(): void {
    console.log('📏 Testing dimension lowercase handling...\n');

    const dimensionTests = [
      { name: 'Lowercase "rows"', input: 'rows', expected: 'ROWS' },
      { name: 'Lowercase "columns"', input: 'columns', expected: 'COLUMNS' },
      { name: 'Uppercase "ROWS"', input: 'ROWS', expected: 'ROWS' },
      { name: 'Uppercase "COLUMNS"', input: 'COLUMNS', expected: 'COLUMNS' },
      { name: 'Mixed case "Rows"', input: 'Rows', expected: 'ROWS' },
      { name: 'Mixed case "CoLuMnS"', input: 'CoLuMnS', expected: 'COLUMNS' },
    ];

    for (const test of dimensionTests) {
      try {
        console.log(`  Testing: ${test.name}`);
        console.log(`    Input:    "${test.input}"`);

        const result = DimensionSchema.parse(test.input);

        console.log(`    Output:   "${result}"`);
        console.log(`    Expected: "${test.expected}"`);

        if (result === test.expected) {
          console.log(`    ✅ ${test.name} passed\n`);
          this.results.push({
            name: `Dimension: ${test.name}`,
            success: true,
            details: { input: test.input, output: result },
          });
        } else {
          throw new Error(`Dimension mismatch: got "${result}", expected "${test.expected}"`);
        }
      } catch (error) {
        console.log(`    ❌ ${test.name} failed: ${error}\n`);
        this.results.push({
          name: `Dimension: ${test.name}`,
          success: false,
          error: String(error),
        });
      }
    }
  }

  private testColumnIndexNumeric(): void {
    console.log('📊 Testing numeric columnIndex in sort operations...\n');

    const sortTests = [
      {
        name: 'Sort by column A (index 0)',
        input: {
          request: {
            action: 'sort_range',
            spreadsheetId: '1234567890abcdef',
            range: 'A1:E10',
            sortSpecs: [{ columnIndex: 0, sortOrder: 'ASCENDING' }],
          },
        },
      },
      {
        name: 'Sort by column C (index 2)',
        input: {
          request: {
            action: 'sort_range',
            spreadsheetId: '1234567890abcdef',
            range: 'A1:E10',
            sortSpecs: [{ columnIndex: 2, sortOrder: 'DESCENDING' }],
          },
        },
      },
      {
        name: 'Multi-column sort (indices 3 and 1)',
        input: {
          request: {
            action: 'sort_range',
            spreadsheetId: '1234567890abcdef',
            range: 'A1:E10',
            sortSpecs: [
              { columnIndex: 3, sortOrder: 'ASCENDING' },
              { columnIndex: 1, sortOrder: 'DESCENDING' },
            ],
          },
        },
      },
      {
        name: 'Sort with string columnIndex (coerce)',
        input: {
          request: {
            action: 'sort_range',
            spreadsheetId: '1234567890abcdef',
            range: 'A1:E10',
            sortSpecs: [{ columnIndex: '2' as any, sortOrder: 'ASCENDING' }],
          },
        },
      },
    ];

    for (const test of sortTests) {
      try {
        console.log(`  Testing: ${test.name}`);

        const result = SheetsDimensionsInputSchema.parse(test.input);

        if (result.request.action === 'sort_range') {
          console.log(`    ✅ ${test.name} passed`);
          console.log(
            `    columnIndex values: ${result.request.sortSpecs.map((s) => s.columnIndex).join(', ')}\n`
          );

          this.results.push({
            name: `Sort: ${test.name}`,
            success: true,
            details: { sortSpecs: result.request.sortSpecs },
          });
        } else {
          throw new Error('Action type mismatch');
        }
      } catch (error) {
        console.log(`    ❌ ${test.name} failed: ${error}\n`);
        this.results.push({
          name: `Sort: ${test.name}`,
          success: false,
          error: String(error),
        });
      }
    }
  }

  private testAutoFitLowercase(): void {
    console.log('📐 Testing auto_fit with lowercase dimensions...\n');

    const autoFitTests = [
      {
        name: 'Auto-fit lowercase "columns"',
        input: {
          request: {
            action: 'auto_fit',
            spreadsheetId: '1234567890abcdef',
            range: 'A1:E10',
            dimension: 'columns',
          },
        },
        expected: 'COLUMNS',
      },
      {
        name: 'Auto-fit lowercase "rows"',
        input: {
          request: {
            action: 'auto_fit',
            spreadsheetId: '1234567890abcdef',
            range: 'A1:E10',
            dimension: 'rows',
          },
        },
        expected: 'ROWS',
      },
      {
        name: 'Auto-fit lowercase "both"',
        input: {
          request: {
            action: 'auto_fit',
            spreadsheetId: '1234567890abcdef',
            range: 'A1:E10',
            dimension: 'both',
          },
        },
        expected: 'BOTH',
      },
      {
        name: 'Auto-fit uppercase "COLUMNS" (passthrough)',
        input: {
          request: {
            action: 'auto_fit',
            spreadsheetId: '1234567890abcdef',
            range: 'A1:E10',
            dimension: 'COLUMNS',
          },
        },
        expected: 'COLUMNS',
      },
    ];

    for (const test of autoFitTests) {
      try {
        console.log(`  Testing: ${test.name}`);
        console.log(`    Input dimension:    "${test.input.request.dimension}"`);

        const result = SheetsFormatInputSchema.parse(test.input);

        if (result.request.action === 'auto_fit') {
          console.log(`    Output dimension:   "${result.request.dimension}"`);
          console.log(`    Expected dimension: "${test.expected}"`);

          if (result.request.dimension === test.expected) {
            console.log(`    ✅ ${test.name} passed\n`);
            this.results.push({
              name: `Auto-fit: ${test.name}`,
              success: true,
              details: {
                inputDimension: test.input.request.dimension,
                outputDimension: result.request.dimension,
              },
            });
          } else {
            throw new Error(
              `Dimension mismatch: got "${result.request.dimension}", expected "${test.expected}"`
            );
          }
        } else {
          throw new Error('Action type mismatch');
        }
      } catch (error) {
        console.log(`    ❌ ${test.name} failed: ${error}\n`);
        this.results.push({
          name: `Auto-fit: ${test.name}`,
          success: false,
          error: String(error),
        });
      }
    }
  }

  private reportResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(80) + '\n');

    const totalTests = this.results.length;
    const successCount = this.results.filter((r) => r.success).length;
    const failCount = totalTests - successCount;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${successCount}`);
    console.log(`❌ Failed: ${failCount}\n`);

    if (failCount > 0) {
      console.log('Failed Tests:');
      this.results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  - ${r.name}: ${r.error}`);
        });
      console.log();
    }

    console.log('Test Categories:');
    const colorTests = this.results.filter((r) => r.name.startsWith('Color:'));
    const dimensionTests = this.results.filter((r) => r.name.startsWith('Dimension:'));
    const sortTests = this.results.filter((r) => r.name.startsWith('Sort:'));
    const autoFitTests = this.results.filter((r) => r.name.startsWith('Auto-fit:'));

    console.log(
      `  Color Precision: ${colorTests.filter((r) => r.success).length}/${colorTests.length} passed`
    );
    console.log(
      `  Dimension Lowercase: ${dimensionTests.filter((r) => r.success).length}/${dimensionTests.length} passed`
    );
    console.log(
      `  Numeric columnIndex: ${sortTests.filter((r) => r.success).length}/${sortTests.length} passed`
    );
    console.log(
      `  Auto-fit Lowercase: ${autoFitTests.filter((r) => r.success).length}/${autoFitTests.length} passed`
    );

    console.log('\n' + '='.repeat(80));
    console.log('✅ Schema Validation Tests Complete');
    console.log('='.repeat(80) + '\n');

    if (failCount > 0) {
      process.exit(1);
    }
  }
}

// Run tests
const tester = new SchemaValidationTester();
tester.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
