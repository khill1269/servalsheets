#!/usr/bin/env tsx
/**
 * MCP Protocol Test Script
 *
 * Validates ServalSheets MCP server functionality programmatically
 * Tests all 24 tools and verifies protocol compliance
 */

import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    results.push({
      name,
      passed: true,
      message: 'PASS',
      duration: Date.now() - start,
    });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.push({
      name,
      passed: false,
      message: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    });
    console.log(`❌ ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const getTextContent = (response: { content?: Array<{ type: string; text?: string }> }): string => {
  const content = response.content?.[0];
  if (!content || content.type !== 'text' || typeof content.text !== 'string') {
    throw new Error('Expected text content');
  }
  return content.text;
};

async function main() {
  console.log('🚀 Starting MCP Protocol Tests for ServalSheets\n');

  // Start the server
  const serverProcess = spawn('node', ['dist/cli.js', '--stdio'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/cli.js', '--stdio'],
  });

  const client = new Client({
    name: 'test-client',
    version: '1.0.0',
  }, {
    capabilities: {},
  });

  try {
    // Test 1: Connect to server
    await runTest('Connect to MCP Server', async () => {
      await client.connect(transport);
      if (!client) throw new Error('Failed to connect');
    });

    // Test 2: List tools
    let toolsList: any;
    await runTest('List All Tools', async () => {
      const response = await client.request(
        {
          method: 'tools/list',
        },
        ListToolsResultSchema
      );

      toolsList = response.tools;

      if (!Array.isArray(toolsList)) {
        throw new Error('tools/list did not return an array');
      }

      if (toolsList.length !== 24) {
        throw new Error(`Expected 24 tools, got ${toolsList.length}`);
      }
    });

    // Test 3: Verify tool names
    await runTest('Verify Tool Names', async () => {
      const expectedTools = [
        'sheets_auth', 'sheets_spreadsheet', 'sheets_sheet', 'sheets_values',
        'sheets_cells', 'sheets_format', 'sheets_dimensions', 'sheets_rules',
        'sheets_charts', 'sheets_pivot', 'sheets_filter_sort', 'sheets_sharing',
        'sheets_comments', 'sheets_versions', 'sheets_analysis', 'sheets_advanced',
        'sheets_transaction', 'sheets_validation', 'sheets_conflict', 'sheets_impact',
        'sheets_history', 'sheets_confirm', 'sheets_analyze', 'sheets_fix',
      ];

      const toolNames = toolsList.map((t: any) => t.name).sort();
      const expected = [...expectedTools].sort();

      for (let i = 0; i < expected.length; i++) {
        if (toolNames[i] !== expected[i]) {
          throw new Error(`Tool mismatch at index ${i}: expected ${expected[i]}, got ${toolNames[i]}`);
        }
      }
    });

    // Test 4: Verify all tools have schemas
    await runTest('Verify Tool Schemas', async () => {
      for (const tool of toolsList) {
        if (!tool.inputSchema) {
          throw new Error(`Tool ${tool.name} missing inputSchema`);
        }
        if (!tool.description) {
          throw new Error(`Tool ${tool.name} missing description`);
        }
      }
    });

    // Test 5: Test sheets_auth (no auth required)
    await runTest('Execute sheets_auth (status)', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'sheets_auth',
            arguments: {
              request: {
                action: 'status',
              },
            },
          },
        },
        CallToolResultSchema
      );

      if (!response.content || response.content.length === 0) {
        throw new Error('No response content');
      }

      const data = JSON.parse(getTextContent(response));
      if (!('response' in data)) {
        throw new Error('Response missing response field');
      }
    });

    // Test 6: Test sheets_history (no auth required)
    await runTest('Execute sheets_history (list)', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'sheets_history',
            arguments: {
              request: {
                action: 'list',
              },
            },
          },
        },
        CallToolResultSchema
      );

      if (!response.content || response.content.length === 0) {
        throw new Error('No response content');
      }

      const data = JSON.parse(getTextContent(response));

      if (!('response' in data)) {
        throw new Error('Response missing response field');
      }

      const resp = data.response;
      if (!('success' in resp)) {
        throw new Error('Response missing success field');
      }
    });

    // Test 7: Test sheets_confirm (no auth required)
    await runTest('Execute sheets_confirm (get_stats)', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'sheets_confirm',
            arguments: {
              request: {
                action: 'get_stats',
              },
            },
          },
        },
        CallToolResultSchema
      );

      const data = JSON.parse(getTextContent(response));

      if (!data.response || !('success' in data.response)) {
        throw new Error('Invalid response structure');
      }
    });

    // Test 8: Test error handling (invalid action)
    await runTest('Verify Error Handling', async () => {
      try {
        await client.request(
          {
            method: 'tools/call',
            params: {
              name: 'sheets_spreadsheet',
              arguments: {
                request: {
                  action: 'invalid_action',
                  spreadsheetId: 'test123',
                },
              },
            },
          },
          CallToolResultSchema
        );
        throw new Error('Should have thrown validation error');
      } catch (error) {
        // Expected to fail - validation should catch this
        if (error instanceof Error && !error.message.includes('Should have thrown')) {
          // Good - it failed as expected
          return;
        }
        throw error;
      }
    });

    // Test 9: Test response structure
    await runTest('Verify Response Structure', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'sheets_history',
            arguments: {
              request: {
                action: 'stats',
              },
            },
          },
        },
        CallToolResultSchema
      );

      const data = JSON.parse(getTextContent(response));

      // Should have discriminated union with success field
      if (typeof data.response.success !== 'boolean') {
        throw new Error('Response missing success discriminator');
      }
    });

    // Test 10: Test tool with authentication requirement
    await runTest('Execute sheets_spreadsheet (expects auth error)', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'sheets_spreadsheet',
            arguments: {
              request: {
                action: 'get',
                spreadsheetId: '1Sz5aRCE1D17NI4BT6KGiGCA7cSpbQ1vPM5BoskkzrM4',
              },
            },
          },
        },
        CallToolResultSchema
      );

      const data = JSON.parse(getTextContent(response));

      // Should get either success (if authenticated) or auth error
      if (!data.response || !('success' in data.response)) {
        throw new Error('Invalid response structure');
      }

      // If error, should have resolution steps
      if (data.response.success === false) {
        if (!data.response.error || !data.response.error.resolution) {
          throw new Error('Error missing resolution guidance');
        }
      }
    });

  } finally {
    // Cleanup
    await client.close();
    serverProcess.kill();
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const passRate = ((passed / total) * 100).toFixed(1);

  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Pass Rate: ${passRate}%`);

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`⏱️  Total Duration: ${totalDuration}ms`);

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL TESTS PASSED!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
