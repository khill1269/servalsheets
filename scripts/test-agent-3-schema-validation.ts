/**
 * Test Agent 3: Quality & Confirm Schema Validation
 *
 * Tests the specific schema validation issues that had 43-57% failure rates:
 * 1. Quality tool regex validation for tool names
 * 2. Confirm tool optional fields handling
 */

import { SheetsQualityInputSchema } from '../src/schemas/quality.js';
import { SheetsConfirmInputSchema } from '../src/schemas/confirm.js';

console.log('\n=== Test Agent 3: Schema Validation Tests ===\n');

let totalTests = 0;
let passedTests = 0;

// Test 1: Quality tool regex validation for valid tool names
console.log('1. Testing sheets_quality.analyze_impact with VALID tool names');
const validTools = ['sheets_data', 'sheets_format', 'sheets_visualize', 'sheets_core'];

for (const toolName of validTools) {
  totalTests++;
  try {
    const result = SheetsQualityInputSchema.safeParse({
      request: {
        action: 'analyze_impact',
        spreadsheetId: 'test123',
        operation: {
          type: 'values_write',
          tool: toolName,
          action: 'test_action',
          params: {
            range: 'A1:B10',
            values: [['test']],
          },
        },
      },
    });

    if (result.success) {
      console.log(`✅ ${toolName}: ACCEPTED (as expected)`);
      passedTests++;
    } else {
      console.log(`❌ ${toolName}: REJECTED (should accept)`);
      if (result.error?.errors) {
        console.log(`   Errors:`, result.error.errors.map((e) => e.message).join(', '));
      } else {
        console.log(`   Error:`, result.error);
      }
    }
  } catch (error: any) {
    console.log(`❌ ${toolName}: EXCEPTION - ${error.message}`);
  }
}

// Test 2: Quality tool regex validation for INVALID tool names
console.log('\n2. Testing sheets_quality.analyze_impact with INVALID tool names');
const invalidTools = ['invalid_tool', 'data', 'sheets_', 'sheets_DATA', 'sheets-data'];

for (const toolName of invalidTools) {
  totalTests++;
  try {
    const result = SheetsQualityInputSchema.safeParse({
      request: {
        action: 'analyze_impact',
        spreadsheetId: 'test123',
        operation: {
          type: 'values_write',
          tool: toolName,
          action: 'test_action',
          params: {
            range: 'A1:B10',
            values: [['test']],
          },
        },
      },
    });

    if (!result.success) {
      console.log(`✅ ${toolName}: REJECTED (as expected)`);
      passedTests++;
    } else {
      console.log(`❌ ${toolName}: ACCEPTED (should reject)`);
    }
  } catch (error: any) {
    console.log(`❌ ${toolName}: EXCEPTION - ${error.message}`);
  }
}

// Test 3: Confirm tool WITHOUT optional fields (was 57% error rate!)
console.log('\n3. Testing sheets_confirm.request WITHOUT optional fields');
totalTests++;
try {
  const result = SheetsConfirmInputSchema.safeParse({
    request: {
      action: 'request',
      plan: {
        title: 'Test Plan',
        description: 'Testing without optional fields',
        steps: [
          {
            stepNumber: 1,
            description: 'Read data',
            tool: 'sheets_data',
            action: 'read',
            // NO optional fields: risk, isDestructive, canUndo, estimatedApiCalls
          },
          {
            stepNumber: 2,
            description: 'Format cells',
            tool: 'sheets_format',
            action: 'format',
            // NO optional fields
          },
          {
            stepNumber: 3,
            description: 'Create chart',
            tool: 'sheets_visualize',
            action: 'create',
            // NO optional fields
          },
        ],
      },
    },
  });

  if (result.success) {
    console.log(`✅ Confirm WITHOUT optional fields: ACCEPTED`);
    console.log(`   Defaults applied:`);
    console.log(`   - Step 1 risk: ${result.data.request.plan.steps[0].risk} (expected: low)`);
    console.log(
      `   - Step 1 isDestructive: ${result.data.request.plan.steps[0].isDestructive} (expected: false)`
    );
    console.log(
      `   - Step 1 canUndo: ${result.data.request.plan.steps[0].canUndo} (expected: false)`
    );
    passedTests++;
  } else {
    console.log(`❌ Confirm WITHOUT optional fields: REJECTED`);
    if (result.error?.errors) {
      console.log(
        `   Errors:`,
        result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n   ')
      );
    } else {
      console.log(`   Error:`, result.error);
    }
  }
} catch (error: any) {
  console.log(`❌ Confirm WITHOUT optional fields: EXCEPTION - ${error.message}`);
}

// Test 4: Confirm tool WITH all optional fields
console.log('\n4. Testing sheets_confirm.request WITH all optional fields');
totalTests++;
try {
  const result = SheetsConfirmInputSchema.safeParse({
    request: {
      action: 'request',
      plan: {
        title: 'Destructive Plan',
        description: 'Testing with all optional fields',
        steps: [
          {
            stepNumber: 1,
            description: 'Delete sheet',
            tool: 'sheets_core',
            action: 'delete',
            risk: 'high',
            estimatedApiCalls: 2,
            isDestructive: true,
            canUndo: false,
          },
          {
            stepNumber: 2,
            description: 'Clear data',
            tool: 'sheets_data',
            action: 'clear',
            risk: 'critical',
            estimatedApiCalls: 5,
            isDestructive: true,
            canUndo: false,
          },
        ],
      },
    },
  });

  if (result.success) {
    console.log(`✅ Confirm WITH optional fields: ACCEPTED`);
    console.log(`   Values preserved:`);
    console.log(`   - Step 1 risk: ${result.data.request.plan.steps[0].risk} (expected: high)`);
    console.log(
      `   - Step 1 isDestructive: ${result.data.request.plan.steps[0].isDestructive} (expected: true)`
    );
    console.log(
      `   - Step 1 canUndo: ${result.data.request.plan.steps[0].canUndo} (expected: false)`
    );
    passedTests++;
  } else {
    console.log(`❌ Confirm WITH optional fields: REJECTED`);
    if (result.error?.errors) {
      console.log(
        `   Errors:`,
        result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n   ')
      );
    } else {
      console.log(`   Error:`, result.error);
    }
  }
} catch (error: any) {
  console.log(`❌ Confirm WITH optional fields: EXCEPTION - ${error.message}`);
}

// Test 5: Confirm tool with INVALID tool name in steps
console.log('\n5. Testing sheets_confirm.request with INVALID tool name');
totalTests++;
try {
  const result = SheetsConfirmInputSchema.safeParse({
    request: {
      action: 'request',
      plan: {
        title: 'Invalid Tool Plan',
        description: 'Testing with invalid tool name',
        steps: [
          {
            stepNumber: 1,
            description: 'Invalid step',
            tool: 'invalid_tool', // Should fail regex
            action: 'do_something',
          },
        ],
      },
    },
  });

  if (!result.success) {
    console.log(`✅ Confirm with invalid tool name: REJECTED (as expected)`);
    if (result.error?.errors?.[0]) {
      console.log(`   Error: ${result.error.errors[0].message}`);
    }
    passedTests++;
  } else {
    console.log(`❌ Confirm with invalid tool name: ACCEPTED (should reject)`);
  }
} catch (error: any) {
  console.log(`❌ Confirm with invalid tool name: EXCEPTION - ${error.message}`);
}

// Summary
console.log('\n=== Test Results Summary ===');
console.log(`Total tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${totalTests - passedTests}`);
console.log(`Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (passedTests === totalTests) {
  console.log('\n✅ All schema validation tests PASSED!');
  console.log('   The 57% error rate issue is FIXED - optional fields work correctly');
  console.log('   Tool name regex validation works as expected');
  process.exit(0);
} else {
  console.log('\n❌ Some tests FAILED');
  process.exit(1);
}
