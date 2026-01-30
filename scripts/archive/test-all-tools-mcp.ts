/**
 * Comprehensive MCP Tool Tester via STDIO
 *
 * Tests all 21 tools by spawning the server and communicating via JSON-RPC
 */

import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

interface TestResult {
  tool: string;
  action?: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
}

const results: TestResult[] = [];
let requestId = 1;

function createJsonRpcClient(child: ChildProcess) {
  let buffer = '';
  const pending = new Map<
    number,
    { resolve: (value: any) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }
  >();

  child.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const json = JSON.parse(line);
        const id = json?.id;
        if (typeof id === 'number' && pending.has(id)) {
          const entry = pending.get(id);
          if (entry) {
            clearTimeout(entry.timeout);
            pending.delete(id);
            entry.resolve(json);
          }
        }
      } catch {
        // Ignore non-JSON log lines
      }
    }
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    // Log stderr but don't fail
    const text = chunk.toString();
    if (!text.includes('[ServalSheets]')) {
      console.error('STDERR:', text);
    }
  });

  const send = (method: string, params: any = {}): Promise<any> => {
    return new Promise((resolve, reject) => {
      const id = requestId++;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 5000);

      pending.set(id, { resolve, reject, timeout });

      const request = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
      child.stdin?.write(request);
    });
  };

  return { send };
}

async function testAllTools() {
  console.log('🧪 Starting comprehensive MCP tool testing via STDIO...\n');

  const child = spawn('node', ['dist/cli.js', '--stdio'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, OAUTH_AUTO_OPEN_BROWSER: 'false' },
  });

  const client = createJsonRpcClient(child);

  try {
    // Initialize
    await client.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0',
      },
    });

    console.log('✅ Server initialized\n');

    // Get tools list
    const toolsResponse = await client.send('tools/list', {});
    const tools = toolsResponse.result?.tools || [];

    console.log(`📦 Found ${tools.length} tools\n`);

    // Test each tool
    for (const tool of tools) {
      const toolName = tool.name;

      try {
        // Get a simple action for this tool
        const testCase = getTestCase(toolName);

        if (!testCase) {
          results.push({
            tool: toolName,
            status: 'skip',
            message: 'No test case defined',
          });
          continue;
        }

        try {
          const response = await client.send('tools/call', {
            name: toolName,
            arguments: testCase.arguments,
          });

          // Check response structure
          if (!response.result || !response.result.content) {
            results.push({
              tool: toolName,
              action: testCase.action,
              status: 'fail',
              message: 'Invalid response structure',
            });
            continue;
          }

          const content = response.result.content;
          const textContent = content.find((c: any) => c.type === 'text');

          if (textContent && textContent.text) {
            const text = textContent.text;

            // Check for auth errors (expected)
            if (
              text.includes('not authenticated') ||
              text.includes('OAUTH_NOT_CONFIGURED') ||
              text.includes('OAuth') ||
              text.includes('login')
            ) {
              results.push({
                tool: toolName,
                action: testCase.action,
                status: 'skip',
                message: 'Expected auth error (no credentials)',
              });
              continue;
            }

            // Check for other errors
            if (text.includes('Error:') || text.includes('Failed')) {
              results.push({
                tool: toolName,
                action: testCase.action,
                status: 'fail',
                message: `Tool returned error: ${text.substring(0, 100)}`,
              });
              continue;
            }
          }

          results.push({
            tool: toolName,
            action: testCase.action,
            status: 'pass',
            message: 'Tool executed successfully',
          });
        } catch (err) {
          results.push({
            tool: toolName,
            action: testCase.action,
            status: 'fail',
            message: `Tool call failed: ${(err as Error).message}`,
          });
        }
      } catch (err) {
        results.push({
          tool: toolName,
          status: 'fail',
          message: `Setup failed: ${(err as Error).message}`,
        });
      }
    }

    // Print results
    printResults();
  } finally {
    child.kill();
  }
}

function getTestCase(toolName: string): { action?: string; arguments: any } | null {
  const cases: Record<string, any> = {
    sheets_auth: {
      action: 'status',
      arguments: { action: 'status' },
    },
    sheets_core: {
      action: 'list',
      arguments: { action: 'list', pageSize: 1 },
    },
    sheets_data: {
      action: 'read',
      arguments: { action: 'read', spreadsheetId: 'test123', range: 'A1:B2' },
    },
    sheets_format: {
      action: 'set_background',
      arguments: {
        action: 'set_background',
        spreadsheetId: 'test123',
        range: 'A1',
        color: { red: 1, green: 0, blue: 0 },
      },
    },
    sheets_dimensions: {
      action: 'insert_rows',
      arguments: {
        action: 'insert_rows',
        spreadsheetId: 'test123',
        sheetId: 0,
        startIndex: 0,
        endIndex: 1,
      },
    },
    sheets_visualize: {
      action: 'chart_list',
      arguments: { action: 'chart_list', spreadsheetId: 'test123' },
    },
    sheets_collaborate: {
      action: 'share_list',
      arguments: { action: 'share_list', spreadsheetId: 'test123' },
    },
    sheets_advanced: {
      action: 'list_named_ranges',
      arguments: { action: 'list_named_ranges', spreadsheetId: 'test123' },
    },
    sheets_transaction: {
      action: 'list',
      arguments: { action: 'list' },
    },
    sheets_quality: {
      action: 'validate',
      arguments: { action: 'validate', value: 'test' },
    },
    sheets_history: {
      action: 'list',
      arguments: { action: 'list' },
    },
    sheets_confirm: {
      action: 'get_stats',
      arguments: { action: 'get_stats' },
    },
    sheets_analyze: {
      action: 'comprehensive',
      arguments: { action: 'comprehensive', spreadsheetId: 'test123' },
    },
    sheets_fix: {
      action: 'fix',
      arguments: {
        action: 'fix',
        spreadsheetId: 'test123',
        issues: [
          {
            type: 'NO_FROZEN_HEADERS',
            severity: 'low',
            description: 'Missing frozen header',
          },
        ],
        mode: 'preview',
      },
    },
    sheets_composite: {
      action: 'import_csv',
      arguments: {
        action: 'import_csv',
        spreadsheetId: 'test123',
        csvData: 'a,b\\nc,d',
        mode: 'replace',
      },
    },
    sheets_session: {
      action: 'get_active',
      arguments: { action: 'get_active' },
    },
  };

  return cases[toolName] || null;
}

function printResults() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(80) + '\n');

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const skipped = results.filter((r) => r.status === 'skip').length;

  console.log(`✅ Passed:  ${passed}`);
  console.log(`❌ Failed:  ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📦 Total:   ${results.length}\n`);

  // Show failures
  const failures = results.filter((r) => r.status === 'fail');
  if (failures.length > 0) {
    console.log('❌ FAILURES:\n');
    failures.forEach((f) => {
      console.log(`  • ${f.tool}${f.action ? ` (${f.action})` : ''}`);
      console.log(`    ${f.message}\n`);
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

  // Exit with error if failures
  if (failures.length > 0) {
    process.exit(1);
  }
}

testAllTools().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
