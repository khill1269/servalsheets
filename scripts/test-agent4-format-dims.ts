/**
 * Test Agent 4: Format & Dimensions (Fixes #6, #7)
 *
 * Tests:
 * 1. Color precision auto-rounding to 4 decimals
 * 2. Dimension operations with numeric columnIndex
 * 3. Auto-fit with lowercase dimensions
 */

import { SheetsCoreHandler } from '../src/handlers/core.js';
import { FormatHandler } from '../src/handlers/format.js';
import { DimensionsHandler } from '../src/handlers/dimensions.js';
import { google } from 'googleapis';
import type { HandlerContext } from '../src/handlers/base.js';

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

class Agent4Tester {
  private spreadsheetId?: string;
  private sheetId?: number;
  private results: TestResult[] = [];
  private context: HandlerContext;
  private sheetsApi: any;
  private coreHandler: SheetsCoreHandler;
  private formatHandler: FormatHandler;
  private dimensionsHandler: DimensionsHandler;

  constructor() {
    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheetsApi = google.sheets({ version: 'v4', auth });

    // Create handler context
    this.context = {
      googleOAuth2Client: auth as any,
      verbosity: 'standard',
      sessionContext: {
        spreadsheetId: undefined,
        sheetId: undefined,
        lastRange: undefined,
        lastAction: undefined,
      },
      requestId: `test-agent4-${Date.now()}`,
    };

    // Initialize handlers
    this.coreHandler = new SheetsCoreHandler(this.context, this.sheetsApi);
    this.formatHandler = new FormatHandler(this.context, this.sheetsApi);
    this.dimensionsHandler = new DimensionsHandler(this.context, this.sheetsApi);
  }

  async run(): Promise<void> {
    console.log('🧪 Test Agent 4: Format & Dimensions\n');

    try {
      // Step 1: Create test spreadsheet
      await this.createTestSpreadsheet();

      // Step 2: Test color precision
      await this.testColorPrecision();

      // Step 3: Test dimension operations with numeric columnIndex
      await this.testDimensionOperations();

      // Step 4: Test auto-fit with lowercase dimensions
      await this.testAutoFitLowercase();

      // Report results
      this.reportResults();
    } catch (error) {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    }
  }

  private async createTestSpreadsheet(): Promise<void> {
    console.log('📝 Creating test spreadsheet...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const title = `ServalSheets Fix Test - FormatDims - ${timestamp}`;

    try {
      const result = await this.coreHandler.handle({
        request: {
          action: 'create',
          title,
          sheets: [{ title: 'TestSheet', rowCount: 20, columnCount: 10 }],
        },
      });

      if (!result.response.success) {
        throw new Error('Failed to create spreadsheet');
      }

      this.spreadsheetId = result.response.spreadsheetId;
      this.sheetId = result.response.sheets![0].sheetId;

      // Update context
      this.context.sessionContext.spreadsheetId = this.spreadsheetId;
      this.context.sessionContext.sheetId = this.sheetId;

      console.log(`✅ Created spreadsheet: ${this.spreadsheetId}\n`);

      // Add test data for sorting/filtering
      const testData = [
        ['Product', 'Price', 'Quantity', 'Category', 'Status'],
        ['Apple', '1.99', '100', 'Fruit', 'In Stock'],
        ['Banana', '0.99', '150', 'Fruit', 'In Stock'],
        ['Carrot', '2.49', '75', 'Vegetable', 'Low Stock'],
        ['Date', '3.99', '50', 'Fruit', 'In Stock'],
        ['Eggplant', '2.99', '80', 'Vegetable', 'In Stock'],
      ];

      await this.sheetsApi.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: 'TestSheet!A1:E6',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: testData },
      });

      console.log('✅ Added test data\n');
    } catch (error) {
      this.results.push({
        name: 'Create Test Spreadsheet',
        success: false,
        error: String(error),
      });
      throw error;
    }
  }

  private async testColorPrecision(): Promise<void> {
    console.log('🎨 Testing color precision auto-rounding...\n');

    // Test 1: Background color with high precision
    await this.testColorOperation(
      'set_background with high precision',
      'set_background',
      'A1:A3',
      { red: 0.333333333333, green: 0.666666666666, blue: 0.999999999999 }
    );

    // Test 2: Text color with high precision
    await this.testColorOperation(
      'set_text_format with high precision',
      'set_text_format',
      'B1:B3',
      { red: 0.123456789, green: 0.987654321, blue: 0.5 }
    );

    // Test 3: Google blue (real-world example)
    await this.testColorOperation(
      'Google blue color',
      'set_background',
      'C1:C3',
      { red: 0.2588235294117647, green: 0.5215686274509804, blue: 0.9568627450980393 }
    );

    // Test 4: Conditional formatting with gradient
    await this.testConditionalFormattingColor();
  }

  private async testColorOperation(
    testName: string,
    action: string,
    range: string,
    color: { red: number; green: number; blue: number }
  ): Promise<void> {
    try {
      console.log(`  Testing: ${testName}`);
      console.log(`    Input color: ${JSON.stringify(color)}`);

      let result;
      if (action === 'set_background') {
        result = await this.formatHandler.handle({
          request: {
            action: 'set_background',
            spreadsheetId: this.spreadsheetId!,
            range,
            color,
          },
        });
      } else if (action === 'set_text_format') {
        result = await this.formatHandler.handle({
          request: {
            action: 'set_text_format',
            spreadsheetId: this.spreadsheetId!,
            range,
            textFormat: { foregroundColor: color },
          },
        });
      }

      if (result?.response.success) {
        // Color should be rounded to 4 decimals by schema
        const roundedColor = {
          red: Math.round(color.red * 10000) / 10000,
          green: Math.round(color.green * 10000) / 10000,
          blue: Math.round(color.blue * 10000) / 10000,
        };

        console.log(`    Rounded color: ${JSON.stringify(roundedColor)}`);
        console.log(`    ✅ ${testName} passed\n`);

        this.results.push({
          name: testName,
          success: true,
          details: { originalColor: color, roundedColor },
        });
      } else {
        throw new Error('Operation failed');
      }
    } catch (error) {
      console.log(`    ❌ ${testName} failed: ${error}\n`);
      this.results.push({
        name: testName,
        success: false,
        error: String(error),
      });
    }
  }

  private async testConditionalFormattingColor(): Promise<void> {
    const testName = 'Conditional formatting with color gradient';

    try {
      console.log(`  Testing: ${testName}`);

      const result = await this.formatHandler.handle({
        request: {
          action: 'rule_add_conditional_format',
          spreadsheetId: this.spreadsheetId!,
          sheetId: this.sheetId!,
          range: 'B2:B6',
          rule: {
            type: 'gradient',
            minpoint: {
              type: 'MIN',
              color: { red: 0.984313725490196, green: 0.737254901960784, blue: 0.015686274509804 }, // #FB BC 04
            },
            maxpoint: {
              type: 'MAX',
              color: { red: 0.227450980392157, green: 0.843137254901961, blue: 0.294117647058824 }, // #3A D7 4B
            },
          },
        },
      });

      if (result.response.success) {
        console.log(`    ✅ ${testName} passed\n`);
        this.results.push({
          name: testName,
          success: true,
          details: { ruleIndex: result.response.ruleIndex },
        });
      } else {
        throw new Error('Conditional formatting failed');
      }
    } catch (error) {
      console.log(`    ❌ ${testName} failed: ${error}\n`);
      this.results.push({
        name: testName,
        success: false,
        error: String(error),
      });
    }
  }

  private async testDimensionOperations(): Promise<void> {
    console.log('📊 Testing dimension operations with numeric columnIndex...\n');

    // Test 1: Sort by column C (columnIndex: 2)
    await this.testSort('Sort by column C (Price)', 2, 'ASCENDING');

    // Test 2: Sort by column A (columnIndex: 0)
    await this.testSort('Sort by column A (Product)', 0, 'ASCENDING');

    // Test 3: Sort by column E (columnIndex: 4)
    await this.testSort('Sort by column E (Status)', 4, 'DESCENDING');

    // Test 4: Multi-column sort
    await this.testMultiColumnSort();
  }

  private async testSort(
    testName: string,
    columnIndex: number,
    sortOrder: 'ASCENDING' | 'DESCENDING'
  ): Promise<void> {
    try {
      console.log(`  Testing: ${testName}`);
      console.log(`    columnIndex: ${columnIndex} (numeric)`);

      const result = await this.dimensionsHandler.handle({
        request: {
          action: 'sort_range',
          spreadsheetId: this.spreadsheetId!,
          range: 'A2:E6', // Skip header row
          sortSpecs: [{ columnIndex, sortOrder }],
        },
      });

      if (result.response.success) {
        console.log(`    ✅ ${testName} passed\n`);
        this.results.push({
          name: testName,
          success: true,
          details: { columnIndex, sortOrder },
        });
      } else {
        throw new Error('Sort failed');
      }
    } catch (error) {
      console.log(`    ❌ ${testName} failed: ${error}\n`);
      this.results.push({
        name: testName,
        success: false,
        error: String(error),
      });
    }
  }

  private async testMultiColumnSort(): Promise<void> {
    const testName = 'Multi-column sort (Category ASC, Price DESC)';

    try {
      console.log(`  Testing: ${testName}`);

      const result = await this.dimensionsHandler.handle({
        request: {
          action: 'sort_range',
          spreadsheetId: this.spreadsheetId!,
          range: 'A2:E6',
          sortSpecs: [
            { columnIndex: 3, sortOrder: 'ASCENDING' }, // Category
            { columnIndex: 1, sortOrder: 'DESCENDING' }, // Price
          ],
        },
      });

      if (result.response.success) {
        console.log(`    ✅ ${testName} passed\n`);
        this.results.push({
          name: testName,
          success: true,
        });
      } else {
        throw new Error('Multi-column sort failed');
      }
    } catch (error) {
      console.log(`    ❌ ${testName} failed: ${error}\n`);
      this.results.push({
        name: testName,
        success: false,
        error: String(error),
      });
    }
  }

  private async testAutoFitLowercase(): Promise<void> {
    console.log('📏 Testing auto-fit with lowercase dimensions...\n');

    // Test 1: Auto-fit columns (lowercase)
    await this.testAutoFit('Auto-fit columns (lowercase)', 'columns');

    // Test 2: Auto-fit rows (lowercase)
    await this.testAutoFit('Auto-fit rows (lowercase)', 'rows');

    // Test 3: Auto-fit both (lowercase)
    await this.testAutoFit('Auto-fit both (lowercase)', 'both');
  }

  private async testAutoFit(testName: string, dimension: string): Promise<void> {
    try {
      console.log(`  Testing: ${testName}`);
      console.log(`    dimension: "${dimension}" (lowercase input)`);

      const result = await this.formatHandler.handle({
        request: {
          action: 'auto_fit',
          spreadsheetId: this.spreadsheetId!,
          range: 'A1:E6',
          dimension: dimension as any, // Test lowercase input
        },
      });

      if (result.response.success) {
        console.log(`    ✅ ${testName} passed\n`);
        this.results.push({
          name: testName,
          success: true,
          details: { dimension },
        });
      } else {
        throw new Error('Auto-fit failed');
      }
    } catch (error) {
      console.log(`    ❌ ${testName} failed: ${error}\n`);
      this.results.push({
        name: testName,
        success: false,
        error: String(error),
      });
    }
  }

  private reportResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60) + '\n');

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
    const colorTests = this.results.filter((r) => r.name.includes('color') || r.name.includes('Conditional'));
    const sortTests = this.results.filter((r) => r.name.includes('Sort') || r.name.includes('column'));
    const autoFitTests = this.results.filter((r) => r.name.includes('Auto-fit'));

    console.log(`  Color Precision: ${colorTests.filter((r) => r.success).length}/${colorTests.length} passed`);
    console.log(`  Dimension Operations: ${sortTests.filter((r) => r.success).length}/${sortTests.length} passed`);
    console.log(`  Auto-fit Lowercase: ${autoFitTests.filter((r) => r.success).length}/${autoFitTests.length} passed`);

    console.log('\n' + '='.repeat(60));
    console.log(`Spreadsheet ID: ${this.spreadsheetId}`);
    console.log(`URL: https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`);
    console.log('='.repeat(60) + '\n');

    if (failCount > 0) {
      process.exit(1);
    }
  }
}

// Run tests
const tester = new Agent4Tester();
tester.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
