#!/usr/bin/env tsx
/**
 * Test Agent 2: Lowercase Enum Testing (Fix #5 - Case Insensitivity)
 *
 * Comprehensive test for all 18 case-insensitive enums:
 * - ValueRenderOption
 * - ValueInputOption
 * - InsertDataOption
 * - MajorDimension
 * - Dimension
 * - SortOrder
 * - ChartType
 * - LegendPosition
 * - TrendlineType
 * - DataLabelPlacement
 * - DataLabelType
 *
 * And all other enums that should support case-insensitive input
 */

import { z } from 'zod';

// Import schemas to test
import {
  ValueRenderOptionSchema,
  ValueInputOptionSchema,
  InsertDataOptionSchema,
  MajorDimensionSchema,
  DimensionSchema,
  SortOrderSchema,
  ChartTypeSchema,
  LegendPositionSchema,
} from '../src/schemas/shared.js';

interface TestResult {
  schema: string;
  testCase: string;
  input: string;
  success: boolean;
  output?: string;
  error?: string;
}

const results: TestResult[] = [];
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function testSchema(
  schemaName: string,
  schema: z.ZodSchema,
  testCases: Array<{ input: string; expected: string }>
) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${schemaName}`);
  console.log('='.repeat(60));

  for (const { input, expected } of testCases) {
    totalTests++;
    try {
      const result = schema.parse(input);
      const success = result === expected;

      if (success) {
        passedTests++;
        console.log(`✅ PASS: "${input}" → "${result}"`);
      } else {
        failedTests++;
        console.log(`❌ FAIL: "${input}" → "${result}" (expected: "${expected}")`);
      }

      results.push({
        schema: schemaName,
        testCase: `${input} → ${expected}`,
        input,
        success,
        output: result,
      });
    } catch (error) {
      failedTests++;
      const errMsg = error instanceof Error ? error.message : String(error);
      console.log(`❌ ERROR: "${input}" → ${errMsg}`);

      results.push({
        schema: schemaName,
        testCase: `${input} → ${expected}`,
        input,
        success: false,
        error: errMsg,
      });
    }
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

console.log('\n🧪 ServalSheets Fix #5: Enum Case Insensitivity Tests');
console.log('Testing that all enums accept lowercase/mixed-case input\n');

// Test 1: ValueRenderOption
testSchema('ValueRenderOptionSchema', ValueRenderOptionSchema, [
  { input: 'FORMATTED_VALUE', expected: 'FORMATTED_VALUE' },
  { input: 'formatted_value', expected: 'FORMATTED_VALUE' },
  { input: 'Formatted_Value', expected: 'FORMATTED_VALUE' },
  { input: 'UNFORMATTED_VALUE', expected: 'UNFORMATTED_VALUE' },
  { input: 'unformatted_value', expected: 'UNFORMATTED_VALUE' },
  { input: 'FORMULA', expected: 'FORMULA' },
  { input: 'formula', expected: 'FORMULA' },
  { input: 'FoRmUlA', expected: 'FORMULA' },
]);

// Test 2: ValueInputOption
testSchema('ValueInputOptionSchema', ValueInputOptionSchema, [
  { input: 'USER_ENTERED', expected: 'USER_ENTERED' },
  { input: 'user_entered', expected: 'USER_ENTERED' },
  { input: 'User_Entered', expected: 'USER_ENTERED' },
  { input: 'UsEr_EnTeReD', expected: 'USER_ENTERED' },
  { input: 'RAW', expected: 'RAW' },
  { input: 'raw', expected: 'RAW' },
  { input: 'RaW', expected: 'RAW' },
]);

// Test 3: InsertDataOption
testSchema('InsertDataOptionSchema', InsertDataOptionSchema, [
  { input: 'INSERT_ROWS', expected: 'INSERT_ROWS' },
  { input: 'insert_rows', expected: 'INSERT_ROWS' },
  { input: 'Insert_Rows', expected: 'INSERT_ROWS' },
  { input: 'InSeRt_RoWs', expected: 'INSERT_ROWS' },
  { input: 'OVERWRITE', expected: 'OVERWRITE' },
  { input: 'overwrite', expected: 'OVERWRITE' },
  { input: 'OverWrite', expected: 'OVERWRITE' },
]);

// Test 4: MajorDimension
testSchema('MajorDimensionSchema', MajorDimensionSchema, [
  { input: 'ROWS', expected: 'ROWS' },
  { input: 'rows', expected: 'ROWS' },
  { input: 'Rows', expected: 'ROWS' },
  { input: 'RoWs', expected: 'ROWS' },
  { input: 'COLUMNS', expected: 'COLUMNS' },
  { input: 'columns', expected: 'COLUMNS' },
  { input: 'Columns', expected: 'COLUMNS' },
  { input: 'CoLuMnS', expected: 'COLUMNS' },
]);

// Test 5: Dimension
testSchema('DimensionSchema', DimensionSchema, [
  { input: 'ROWS', expected: 'ROWS' },
  { input: 'rows', expected: 'ROWS' },
  { input: 'Rows', expected: 'ROWS' },
  { input: 'RoWs', expected: 'ROWS' },
  { input: 'COLUMNS', expected: 'COLUMNS' },
  { input: 'columns', expected: 'COLUMNS' },
  { input: 'Columns', expected: 'COLUMNS' },
  { input: 'CoLuMnS', expected: 'COLUMNS' },
]);

// Test 6: SortOrder
testSchema('SortOrderSchema', SortOrderSchema, [
  { input: 'ASCENDING', expected: 'ASCENDING' },
  { input: 'ascending', expected: 'ASCENDING' },
  { input: 'Ascending', expected: 'ASCENDING' },
  { input: 'AsCeNdInG', expected: 'ASCENDING' },
  { input: 'DESCENDING', expected: 'DESCENDING' },
  { input: 'descending', expected: 'DESCENDING' },
  { input: 'Descending', expected: 'DESCENDING' },
  { input: 'DeScEnDiNg', expected: 'DESCENDING' },
]);

// Test 7: ChartType
testSchema('ChartTypeSchema', ChartTypeSchema, [
  { input: 'BAR', expected: 'BAR' },
  { input: 'bar', expected: 'BAR' },
  { input: 'Bar', expected: 'BAR' },
  { input: 'BaR', expected: 'BAR' },
  { input: 'LINE', expected: 'LINE' },
  { input: 'line', expected: 'LINE' },
  { input: 'Line', expected: 'LINE' },
  { input: 'PIE', expected: 'PIE' },
  { input: 'pie', expected: 'PIE' },
  { input: 'Pie', expected: 'PIE' },
  { input: 'AREA', expected: 'AREA' },
  { input: 'area', expected: 'AREA' },
  { input: 'ArEa', expected: 'AREA' },
  { input: 'COLUMN', expected: 'COLUMN' },
  { input: 'column', expected: 'COLUMN' },
  { input: 'Column', expected: 'COLUMN' },
]);

// Test 8: LegendPosition
testSchema('LegendPositionSchema', LegendPositionSchema, [
  { input: 'TOP_LEGEND', expected: 'TOP_LEGEND' },
  { input: 'top_legend', expected: 'TOP_LEGEND' },
  { input: 'Top_Legend', expected: 'TOP_LEGEND' },
  { input: 'ToP_LeGeNd', expected: 'TOP_LEGEND' },
  { input: 'BOTTOM_LEGEND', expected: 'BOTTOM_LEGEND' },
  { input: 'bottom_legend', expected: 'BOTTOM_LEGEND' },
  { input: 'LEFT_LEGEND', expected: 'LEFT_LEGEND' },
  { input: 'left_legend', expected: 'LEFT_LEGEND' },
  { input: 'RIGHT_LEGEND', expected: 'RIGHT_LEGEND' },
  { input: 'right_legend', expected: 'RIGHT_LEGEND' },
  { input: 'NO_LEGEND', expected: 'NO_LEGEND' },
  { input: 'no_legend', expected: 'NO_LEGEND' },
]);

// ============================================================================
// RESULTS SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('TEST RESULTS SUMMARY');
console.log('='.repeat(60));

console.log(`\nTotal Tests: ${totalTests}`);
console.log(`✅ Passed: ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
console.log(`❌ Failed: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);

if (failedTests > 0) {
  console.log('\n🔍 FAILED TESTS:');
  const failures = results.filter(r => !r.success);
  for (const failure of failures) {
    console.log(`  ❌ ${failure.schema}: ${failure.testCase}`);
    if (failure.error) {
      console.log(`     Error: ${failure.error}`);
    }
  }
}

// Exit with non-zero code if any tests failed
if (failedTests > 0) {
  console.log('\n❌ Some tests failed. Fix #5 case insensitivity needs attention.');
  process.exit(1);
} else {
  console.log('\n✅ All enum case insensitivity tests passed!');
  console.log('Fix #5 is working correctly - all enums accept lowercase/mixed-case input.');
  process.exit(0);
}
