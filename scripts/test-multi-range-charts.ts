#!/usr/bin/env tsx
/**
 * Test Agent 1: Multi-Range Chart Creation (Fix #1 - A1 Notation)
 *
 * Tests the critical fix for A1 notation that now accepts comma-separated
 * ranges for multi-series charts.
 */

import { z } from 'zod';
import { A1NotationSchema } from '../src/schemas/shared.js';

interface TestCase {
  name: string;
  value: string;
  shouldPass: boolean;
}

const testCases: TestCase[] = [
  // Multi-range tests (the critical fix)
  {
    name: 'Two comma-separated ranges',
    value: 'A1:A10,D1:D10',
    shouldPass: true,
  },
  {
    name: 'Three comma-separated ranges',
    value: 'A1:A5,D1:D5,E1:E5',
    shouldPass: true,
  },
  {
    name: 'Multi-range with sheet name',
    value: 'Sheet1!A1:A10,Sheet1!D1:D10',
    shouldPass: true,
  },
  {
    name: 'Multi-range with quoted sheet name',
    value: "'Sales Data'!A1:A10,'Sales Data'!D1:D10",
    shouldPass: true,
  },
  // Single range tests (should still work)
  {
    name: 'Single cell',
    value: 'A1',
    shouldPass: true,
  },
  {
    name: 'Single range',
    value: 'A1:C10',
    shouldPass: true,
  },
  {
    name: 'Full columns',
    value: 'A:B',
    shouldPass: true,
  },
  {
    name: 'Full rows',
    value: '1:5',
    shouldPass: true,
  },
  {
    name: 'With sheet name',
    value: 'Sheet1!A1:C10',
    shouldPass: true,
  },
  {
    name: 'Quoted sheet name',
    value: "'Sales Data'!A1:C10",
    shouldPass: true,
  },
  {
    name: 'Whole sheet',
    value: 'Sheet1',
    shouldPass: true,
  },
  // Invalid cases (should fail)
  {
    name: 'Contains brackets (invalid)',
    value: 'A1:A10[0]',
    shouldPass: false,
  },
  {
    name: 'Empty string (invalid)',
    value: '',
    shouldPass: false,
  },
];

function main() {
  console.log('='.repeat(80));
  console.log('Test Agent 1: Multi-Range A1 Notation Schema Validation');
  console.log('='.repeat(80));
  console.log();
  console.log('Testing the fix for comma-separated ranges in A1 notation...');
  console.log();

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    process.stdout.write(`Testing: ${testCase.name.padEnd(45)} ... `);

    try {
      A1NotationSchema.parse(testCase.value);
      if (testCase.shouldPass) {
        console.log('✓ PASS');
        passed++;
      } else {
        console.log('✗ FAIL (should have rejected but accepted)');
        failed++;
      }
    } catch (err) {
      if (!testCase.shouldPass) {
        console.log('✓ PASS (correctly rejected)');
        passed++;
      } else {
        console.log('✗ FAIL');
        console.log(`  Expected: acceptance`);
        console.log(`  Got: rejection`);
        if (err instanceof z.ZodError) {
          console.log(`  Error: ${err.errors[0]?.message || 'Unknown error'}`);
        }
        failed++;
      }
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
    console.log('  • Comma-separated ranges (A1:A10,D1:D10) are now accepted ✓');
    console.log('  • Multi-range with sheet names work ✓');
    console.log('  • Single ranges still work as expected ✓');
    console.log('  • Invalid formats are properly rejected ✓');
    console.log();
    console.log('The A1 notation fix is working correctly!');
    process.exit(0);
  } else {
    console.log('✗ SOME TESTS FAILED');
    console.log();
    console.log('Please review the failed tests above.');
    process.exit(1);
  }
}

main();
