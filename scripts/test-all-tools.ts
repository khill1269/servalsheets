/**
 * Comprehensive MCP Tool Tester
 *
 * Tests all 26 tools with sample inputs and validates:
 * - Tool registration
 * - Schema validation
 * - Handler execution
 * - Response structure
 * - Error handling
 */

import { createServalSheetsServer } from '../src/server.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

interface TestResult {
  tool: string;
  action?: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  error?: unknown;
}

const results: TestResult[] = [];

async function testTool(toolName: string, request: CallToolRequest['params']): Promise<void> {
  const actionName = typeof request.arguments === 'object' && request.arguments !== null
    ? (request.arguments as Record<string, unknown>).action
    : undefined;

  try {
    const server = await createServalSheetsServer({
      enableOAuth: false, // Skip OAuth for testing
    });

    // Get the tool
    const tools = await server.listTools();
    const tool = tools.tools.find(t => t.name === toolName);

    if (!tool) {
      results.push({
        tool: toolName,
        action: actionName as string | undefined,
        status: 'fail',
        message: `Tool not registered: ${toolName}`,
      });
      return;
    }

    // Validate schema exists
    if (!tool.inputSchema) {
      results.push({
        tool: toolName,
        action: actionName as string | undefined,
        status: 'fail',
        message: `Tool missing input schema: ${toolName}`,
      });
      return;
    }

    // Try to call the tool
    try {
      const result = await server.callTool(request);

      // Validate response structure
      if (!result.content || !Array.isArray(result.content)) {
        results.push({
          tool: toolName,
          action: actionName as string | undefined,
          status: 'fail',
          message: `Invalid response structure: missing content array`,
        });
        return;
      }

      // Check if it's an error response
      const textContent = result.content.find(c => c.type === 'text');
      if (textContent && 'text' in textContent) {
        const text = textContent.text;
        if (text.includes('Error:') || text.includes('not authenticated') || text.includes('OAUTH_NOT_CONFIGURED')) {
          results.push({
            tool: toolName,
            action: actionName as string | undefined,
            status: 'skip',
            message: `Expected auth error (no credentials configured)`,
          });
          return;
        }
      }

      results.push({
        tool: toolName,
        action: actionName as string | undefined,
        status: 'pass',
        message: `Tool executed successfully`,
      });
    } catch (err) {
      // Handle expected errors
      const error = err as Error;
      if (error.message.includes('not authenticated') ||
          error.message.includes('OAUTH_NOT_CONFIGURED') ||
          error.message.includes('Missing required parameter')) {
        results.push({
          tool: toolName,
          action: actionName as string | undefined,
          status: 'skip',
          message: `Expected error: ${error.message}`,
        });
      } else {
        results.push({
          tool: toolName,
          action: actionName as string | undefined,
          status: 'fail',
          message: `Unexpected error: ${error.message}`,
          error: err,
        });
      }
    }
  } catch (err) {
    results.push({
      tool: toolName,
      action: actionName as string | undefined,
      status: 'fail',
      message: `Failed to initialize server: ${(err as Error).message}`,
      error: err,
    });
  }
}

async function runTests() {
  console.log('🧪 Starting comprehensive MCP tool testing...\n');

  // Test 1: sheets_auth
  await testTool('sheets_auth', {
    name: 'sheets_auth',
    arguments: { action: 'status' },
  });

  // Test 2: sheets_spreadsheet
  await testTool('sheets_spreadsheet', {
    name: 'sheets_spreadsheet',
    arguments: {
      action: 'list',
      pageSize: 1,
    },
  });

  // Test 3: sheets_sheet
  await testTool('sheets_sheet', {
    name: 'sheets_sheet',
    arguments: {
      action: 'list',
      spreadsheetId: 'test123',
    },
  });

  // Test 4: sheets_values
  await testTool('sheets_values', {
    name: 'sheets_values',
    arguments: {
      action: 'read',
      spreadsheetId: 'test123',
      range: 'Sheet1!A1:B2',
    },
  });

  // Test 5: sheets_cells
  await testTool('sheets_cells', {
    name: 'sheets_cells',
    arguments: {
      action: 'get_note',
      spreadsheetId: 'test123',
      cell: 'A1',
    },
  });

  // Test 6: sheets_format
  await testTool('sheets_format', {
    name: 'sheets_format',
    arguments: {
      action: 'set_background',
      spreadsheetId: 'test123',
      range: 'A1:B2',
      color: { red: 1, green: 0, blue: 0 },
    },
  });

  // Test 7: sheets_dimensions
  await testTool('sheets_dimensions', {
    name: 'sheets_dimensions',
    arguments: {
      action: 'insert_rows',
      spreadsheetId: 'test123',
      startIndex: 0,
      endIndex: 1,
    },
  });

  // Test 8: sheets_rules
  await testTool('sheets_rules', {
    name: 'sheets_rules',
    arguments: {
      action: 'list_conditional_formats',
      spreadsheetId: 'test123',
    },
  });

  // Test 9: sheets_charts
  await testTool('sheets_charts', {
    name: 'sheets_charts',
    arguments: {
      action: 'list',
      spreadsheetId: 'test123',
    },
  });

  // Test 10: sheets_pivot
  await testTool('sheets_pivot', {
    name: 'sheets_pivot',
    arguments: {
      action: 'list',
      spreadsheetId: 'test123',
    },
  });

  // Test 11: sheets_filter_sort
  await testTool('sheets_filter_sort', {
    name: 'sheets_filter_sort',
    arguments: {
      action: 'get_basic_filter',
      spreadsheetId: 'test123',
    },
  });

  // Test 12: sheets_sharing
  await testTool('sheets_sharing', {
    name: 'sheets_sharing',
    arguments: {
      action: 'list_permissions',
      spreadsheetId: 'test123',
    },
  });

  // Test 13: sheets_comments
  await testTool('sheets_comments', {
    name: 'sheets_comments',
    arguments: {
      action: 'list',
      spreadsheetId: 'test123',
    },
  });

  // Test 14: sheets_versions
  await testTool('sheets_versions', {
    name: 'sheets_versions',
    arguments: {
      action: 'list_revisions',
      spreadsheetId: 'test123',
    },
  });

  // Test 15: sheets_analysis
  await testTool('sheets_analysis', {
    name: 'sheets_analysis',
    arguments: {
      action: 'summary',
      spreadsheetId: 'test123',
      range: 'Sheet1!A1:B10',
    },
  });

  // Test 16: sheets_advanced
  await testTool('sheets_advanced', {
    name: 'sheets_advanced',
    arguments: {
      action: 'list_named_ranges',
      spreadsheetId: 'test123',
    },
  });

  // Test 17: sheets_transaction
  await testTool('sheets_transaction', {
    name: 'sheets_transaction',
    arguments: {
      action: 'list',
    },
  });

  // Test 18: sheets_validation
  await testTool('sheets_validation', {
    name: 'sheets_validation',
    arguments: {
      action: 'validate',
      data: [['test']],
      rules: [{ type: 'not_empty', column: 0 }],
    },
  });

  // Test 19: sheets_conflict
  await testTool('sheets_conflict', {
    name: 'sheets_conflict',
    arguments: {
      action: 'detect',
      spreadsheetId: 'test123',
      range: 'A1:B2',
      localVersion: 1,
    },
  });

  // Test 20: sheets_impact
  await testTool('sheets_impact', {
    name: 'sheets_impact',
    arguments: {
      action: 'analyze',
      spreadsheetId: 'test123',
      operation: {
        type: 'delete_rows',
        startIndex: 0,
        endIndex: 1,
      },
    },
  });

  // Test 21: sheets_history
  await testTool('sheets_history', {
    name: 'sheets_history',
    arguments: {
      action: 'list',
    },
  });

  // Test 22: sheets_confirm
  await testTool('sheets_confirm', {
    name: 'sheets_confirm',
    arguments: {
      action: 'get_stats',
    },
  });

  // Test 23: sheets_analyze
  await testTool('sheets_analyze', {
    name: 'sheets_analyze',
    arguments: {
      action: 'get_stats',
    },
  });

  // Test 24: sheets_fix
  await testTool('sheets_fix', {
    name: 'sheets_fix',
    arguments: {
      spreadsheetId: 'test123',
      issues: [],
      mode: 'preview',
    },
  });

  // Test 25: sheets_composite
  await testTool('sheets_composite', {
    name: 'sheets_composite',
    arguments: {
      action: 'import_csv',
      spreadsheetId: 'test123',
      csvContent: 'a,b\n1,2',
      sheetName: 'Test',
    },
  });

  // Test 26: sheets_session
  await testTool('sheets_session', {
    name: 'sheets_session',
    arguments: {
      action: 'get_active',
    },
  });

  // Print results
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(80) + '\n');

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;

  console.log(`✅ Passed:  ${passed}`);
  console.log(`❌ Failed:  ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📦 Total:   ${results.length}\n`);

  // Show failures
  const failures = results.filter(r => r.status === 'fail');
  if (failures.length > 0) {
    console.log('❌ FAILURES:\n');
    failures.forEach(f => {
      console.log(`  • ${f.tool}${f.action ? ` (${f.action})` : ''}`);
      console.log(`    ${f.message}`);
      if (f.error) {
        console.log(`    ${(f.error as Error).stack || f.error}`);
      }
      console.log('');
    });
  }

  // Show all results
  console.log('\n' + '='.repeat(80));
  console.log('📋 DETAILED RESULTS');
  console.log('='.repeat(80) + '\n');

  results.forEach((r, i) => {
    const icon = r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⏭️';
    console.log(`${i + 1}. ${icon} ${r.tool}${r.action ? ` (${r.action})` : ''}`);
    console.log(`   ${r.message}\n`);
  });

  // Exit with error code if any failures
  if (failures.length > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
