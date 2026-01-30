#!/usr/bin/env tsx
/**
 * Test: Enum Case-Insensitive Validation
 *
 * Tests that chart type and legend position enums accept lowercase values
 * and correctly convert them to uppercase.
 */

import { ChartTypeSchema, LegendPositionSchema } from '../src/schemas/shared.js';

interface TestCase {
  name: string;
  schema: typeof ChartTypeSchema | typeof LegendPositionSchema;
  input: string;
  expected: string;
}

const testCases: TestCase[] = [
  // ChartType tests
  { name: 'ChartType: lowercase "bar"', schema: ChartTypeSchema, input: 'bar', expected: 'BAR' },
  {
    name: 'ChartType: lowercase "column"',
    schema: ChartTypeSchema,
    input: 'column',
    expected: 'COLUMN',
  },
  { name: 'ChartType: lowercase "line"', schema: ChartTypeSchema, input: 'line', expected: 'LINE' },
  { name: 'ChartType: lowercase "pie"', schema: ChartTypeSchema, input: 'pie', expected: 'PIE' },
  {
    name: 'ChartType: mixed case "CoLuMn"',
    schema: ChartTypeSchema,
    input: 'CoLuMn',
    expected: 'COLUMN',
  },
  { name: 'ChartType: uppercase "BAR"', schema: ChartTypeSchema, input: 'BAR', expected: 'BAR' },

  // LegendPosition tests
  {
    name: 'Legend: lowercase "top_legend"',
    schema: LegendPositionSchema,
    input: 'top_legend',
    expected: 'TOP_LEGEND',
  },
  {
    name: 'Legend: lowercase "bottom_legend"',
    schema: LegendPositionSchema,
    input: 'bottom_legend',
    expected: 'BOTTOM_LEGEND',
  },
  {
    name: 'Legend: lowercase "left_legend"',
    schema: LegendPositionSchema,
    input: 'left_legend',
    expected: 'LEFT_LEGEND',
  },
  {
    name: 'Legend: lowercase "right_legend"',
    schema: LegendPositionSchema,
    input: 'right_legend',
    expected: 'RIGHT_LEGEND',
  },
  {
    name: 'Legend: lowercase "no_legend"',
    schema: LegendPositionSchema,
    input: 'no_legend',
    expected: 'NO_LEGEND',
  },
  {
    name: 'Legend: mixed case "Top_Legend"',
    schema: LegendPositionSchema,
    input: 'Top_Legend',
    expected: 'TOP_LEGEND',
  },
  {
    name: 'Legend: uppercase "TOP_LEGEND"',
    schema: LegendPositionSchema,
    input: 'TOP_LEGEND',
    expected: 'TOP_LEGEND',
  },
];

function main() {
  console.log('='.repeat(80));
  console.log('Test: Enum Case-Insensitive Validation');
  console.log('='.repeat(80));
  console.log();
  console.log('Testing that chart and legend enums accept lowercase values...');
  console.log();

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    process.stdout.write(`Testing: ${testCase.name.padEnd(45)} ... `);

    try {
      const result = testCase.schema.parse(testCase.input);
      if (result === testCase.expected) {
        console.log(`✓ PASS`);
        passed++;
      } else {
        console.log(`✗ FAIL`);
        console.log(`  Expected: "${testCase.expected}"`);
        console.log(`  Got: "${result}"`);
        failed++;
      }
    } catch (err) {
      console.log(`✗ FAIL (threw error)`);
      console.log(`  Input: "${testCase.input}"`);
      console.log(`  Expected: "${testCase.expected}"`);
      console.log(`  Error: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  console.log();
  console.log('='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log();
  console.log(`Total tests: ${testCases.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log();

  if (failed === 0) {
    console.log('✓ ALL TESTS PASSED!');
    console.log();
    console.log('Key findings:');
    console.log('  • Lowercase chart types (bar, column, line, pie) accepted ✓');
    console.log('  • Lowercase legend positions (top_legend, bottom_legend) accepted ✓');
    console.log('  • Mixed case values correctly normalized to uppercase ✓');
    console.log('  • Uppercase values still work as expected ✓');
    console.log();
    console.log('The enum case-insensitive preprocessing is working correctly!');
    process.exit(0);
  } else {
    console.log('✗ SOME TESTS FAILED');
    console.log();
    console.log('Please review the failed tests above.');
    process.exit(1);
  }
}

main();
