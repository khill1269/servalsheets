/**
 * Comprehensive Test Orchestrator
 * Tests all 208 actions across 26 tools with full observability
 *
 * Features:
 * - Real-time progress tracking
 * - Structured logging with request tracing
 * - Test result database
 * - Detailed error reporting
 * - Live MCP server communication
 */

import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { TestLogger } from './test-infrastructure/logger.js';
import { TestDatabase } from './test-infrastructure/test-db.js';
import { ProgressTracker } from './test-infrastructure/progress.js';
import { TOOL_ACTIONS } from '../src/schemas/index.js';
import { writeFileSync } from 'fs';

// Test spreadsheet ID (public Google Sheets example)
const TEST_SPREADSHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

let requestIdCounter = 1;

interface JsonRpcClient {
  send: (method: string, params?: any) => Promise<any>;
}

function createJsonRpcClient(child: ChildProcess): JsonRpcClient {
  let buffer = '';
  const pending = new Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  child.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;

      // Log all stdout for debugging
      console.log('[MCP STDOUT]', line.substring(0, 200));

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
    const text = chunk.toString();
    // Log all stderr for debugging
    console.error('[MCP STDERR]', text.substring(0, 500));
  });

  const send = (method: string, params: any = {}): Promise<any> => {
    return new Promise((resolve, reject) => {
      const id = requestIdCounter++;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000); // 30 second timeout

      pending.set(id, { resolve, reject, timeout });

      const request = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
      child.stdin?.write(request);
    });
  };

  return { send };
}

/**
 * Get test arguments for a specific tool/action
 */
function getTestArgs(tool: string, action: string): any {
  const baseArgs: Record<string, Record<string, any>> = {
    sheets_auth: {
      status: { action: 'status' },
      login: { action: 'login' },
      logout: { action: 'logout' },
      callback: { action: 'callback', code: 'test-code' },
    },
    sheets_spreadsheet: {
      list: { action: 'list', pageSize: 5 },
      get: { action: 'get', spreadsheetId: TEST_SPREADSHEET_ID },
      create: { action: 'create', title: 'Test Spreadsheet (Will Fail - No Auth)' },
      copy: { action: 'copy', spreadsheetId: TEST_SPREADSHEET_ID },
      update_properties: {
        action: 'update_properties',
        spreadsheetId: TEST_SPREADSHEET_ID,
        title: 'Updated Title',
      },
      get_url: { action: 'get_url', spreadsheetId: TEST_SPREADSHEET_ID },
      batch_get: { action: 'batch_get', spreadsheetIds: [TEST_SPREADSHEET_ID] },
      get_comprehensive: {
        action: 'get_comprehensive',
        spreadsheetId: TEST_SPREADSHEET_ID,
      },
    },
    sheets_sheet: {
      list: { action: 'list', spreadsheetId: TEST_SPREADSHEET_ID },
      get: {
        action: 'get',
        spreadsheetId: TEST_SPREADSHEET_ID,
        sheetName: 'Sheet1',
      },
      add: {
        action: 'add',
        spreadsheetId: TEST_SPREADSHEET_ID,
        title: 'New Sheet',
      },
      delete: {
        action: 'delete',
        spreadsheetId: TEST_SPREADSHEET_ID,
        sheetId: 999,
      },
      duplicate: {
        action: 'duplicate',
        spreadsheetId: TEST_SPREADSHEET_ID,
        sourceSheetId: 0,
      },
      update: {
        action: 'update',
        spreadsheetId: TEST_SPREADSHEET_ID,
        sheetId: 0,
        title: 'Updated Sheet',
      },
      copy_to: {
        action: 'copy_to',
        spreadsheetId: TEST_SPREADSHEET_ID,
        sheetId: 0,
        destinationSpreadsheetId: TEST_SPREADSHEET_ID,
      },
    },
    sheets_values: {
      read: {
        action: 'read',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:D10',
      },
      write: {
        action: 'write',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:B2',
        values: [
          ['Test', 'Data'],
          ['123', '456'],
        ],
      },
      append: {
        action: 'append',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1',
        values: [['Append', 'Test']],
      },
      clear: {
        action: 'clear',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!Z100',
      },
      batch_read: {
        action: 'batch_read',
        spreadsheetId: TEST_SPREADSHEET_ID,
        ranges: ['Sheet1!A1:B2', 'Sheet1!C1:D2'],
      },
      batch_write: {
        action: 'batch_write',
        spreadsheetId: TEST_SPREADSHEET_ID,
        data: [
          { range: 'Sheet1!A1:B1', values: [['Test1', 'Test2']] },
          { range: 'Sheet1!A2:B2', values: [['Test3', 'Test4']] },
        ],
      },
      batch_clear: {
        action: 'batch_clear',
        spreadsheetId: TEST_SPREADSHEET_ID,
        ranges: ['Sheet1!Z100', 'Sheet1!Z101'],
      },
      find: {
        action: 'find',
        spreadsheetId: TEST_SPREADSHEET_ID,
        query: 'test',
        range: 'Sheet1!A1:D10',
      },
      replace: {
        action: 'replace',
        spreadsheetId: TEST_SPREADSHEET_ID,
        find: 'old',
        replace: 'new',
        range: 'Sheet1!A1:D10',
      },
    },
    sheets_format: {
      apply_preset: {
        action: 'apply_preset',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:D10',
        preset: 'header_row',
      },
      set_background: {
        action: 'set_background',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1',
        color: { red: 1, green: 0, blue: 0 },
      },
      // Add more format actions...
    },
    // Add more tools...
  };

  return baseArgs[tool]?.[action] || { action };
}

/**
 * Test a single action
 */
async function testAction(
  client: JsonRpcClient,
  logger: TestLogger,
  db: TestDatabase,
  tool: string,
  action: string,
): Promise<void> {
  const testId = `${tool}.${action}`;
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger.startTimer(requestId);
  logger.info(requestId, tool, action, 'start', 'Starting test', { testId });

  const args = getTestArgs(tool, action);

  try {
    // Start test in database
    db.startTest(testId, args);

    logger.debug(requestId, tool, action, 'request', 'Sending MCP request', { args });

    // Send request to MCP server
    const response = await client.send('tools/call', {
      name: tool,
      arguments: args,
    });

    logger.debug(requestId, tool, action, 'response', 'Received MCP response', {
      hasResult: !!response.result,
      hasError: !!response.error,
    });

    // Check for errors in response
    if (response.error) {
      logger.error(requestId, tool, action, 'mcp-error', 'MCP protocol error', response.error);
      db.failTest(testId, response.error);
      return;
    }

    // Check response structure
    if (!response.result || !response.result.content) {
      logger.error(
        requestId,
        tool,
        action,
        'validation',
        'Invalid response structure: missing content',
      );
      db.failTest(testId, new Error('Invalid response structure'));
      return;
    }

    const content = response.result.content;
    const textContent = content.find((c: any) => c.type === 'text');

    if (!textContent || !textContent.text) {
      logger.error(
        requestId,
        tool,
        action,
        'validation',
        'Invalid response structure: no text content',
      );
      db.failTest(testId, new Error('No text content in response'));
      return;
    }

    const text = textContent.text;

    // Check for authentication errors
    if (
      text.includes('not authenticated') ||
      text.includes('OAUTH_NOT_CONFIGURED') ||
      text.includes('AUTH_REQUIRED') ||
      text.includes('authentication required') ||
      text.toLowerCase().includes('call sheets_auth')
    ) {
      logger.info(
        requestId,
        tool,
        action,
        'auth-required',
        'Authentication required (expected without credentials)',
      );
      db.authRequiredTest(testId, 'Authentication required');
      return;
    }

    // Check for errors in response text
    if (
      text.includes('Error:') ||
      text.includes('Failed') ||
      text.includes('INVALID') ||
      text.includes('"success":false') ||
      text.includes('"success": false')
    ) {
      logger.warn(requestId, tool, action, 'tool-error', 'Tool returned error', {
        excerpt: text.substring(0, 200),
      });
      db.failTest(testId, { message: text.substring(0, 500) });
      return;
    }

    // Success!
    const duration = logger.getDuration(requestId);
    logger.info(requestId, tool, action, 'complete', `Test passed in ${duration}ms`);
    db.passTest(testId, { text: text.substring(0, 500) });
  } catch (error) {
    const duration = logger.getDuration(requestId);
    logger.error(
      requestId,
      tool,
      action,
      'exception',
      `Test failed after ${duration}ms: ${(error as Error).message}`,
      error,
    );
    db.failTest(testId, error);
  }
}

/**
 * Main test orchestrator
 */
async function runAllTests() {
  console.log('🚀 ServalSheets Comprehensive Test Suite\n');
  console.log('Testing all 26 tools with 208 actions');
  console.log('=' .repeat(80) + '\n');

  // Initialize infrastructure
  const logger = new TestLogger('./test-logs');
  const db = new TestDatabase('./test-results');

  // Calculate total tests
  const allTests: Array<{ tool: string; action: string }> = [];
  for (const [toolName, actions] of Object.entries(TOOL_ACTIONS)) {
    for (const action of actions) {
      allTests.push({ tool: toolName, action });
      db.addTestCase({
        id: `${toolName}.${action}`,
        tool: toolName,
        action,
      });
    }
  }

  const progress = new ProgressTracker(allTests.length);

  console.log(`📋 Total tests: ${allTests.length}`);
  console.log(`📁 Log file: ${logger.getLogFile?.() || 'test-logs/'}`);
  console.log(`💾 Database: ${db.getPath()}\n`);

  // Start MCP server
  console.log('🔧 Starting MCP server...\n');
  const child = spawn('node', ['dist/cli.js', '--stdio'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'development', // Override production mode for testing
      OAUTH_AUTO_OPEN_BROWSER: 'false',
      LOG_LEVEL: 'info',
    },
  });

  // Add error handlers for child process
  child.on('error', (error) => {
    console.error('❌ Failed to start MCP server:', error);
    logger.error('system', 'mcp', 'spawn', 'error', 'Child process error', error);
  });

  child.on('exit', (code, signal) => {
    console.log(`MCP server exited with code ${code}, signal ${signal}`);
    logger.info('system', 'mcp', 'exit', 'complete', `Server exited: code=${code}, signal=${signal}`);
  });

  const client = createJsonRpcClient(child);

  try {
    // Initialize MCP server
    logger.info('system', 'mcp', 'init', 'initialize', 'Initializing MCP server');
    await client.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-orchestrator',
        version: '1.0.0',
      },
    });

    logger.info('system', 'mcp', 'init', 'complete', 'MCP server initialized');
    console.log('✅ MCP server ready\n');

    // Run all tests
    console.log('🧪 Running tests...\n');

    let testCount = 0;
    for (const { tool, action } of allTests) {
      testCount++;

      await testAction(client, logger, db, tool, action);

      // Update progress
      const testCase = db.getTestCase(`${tool}.${action}`);
      if (testCase) {
        progress.update({
          tool,
          action,
          status: testCase.status,
          message: testCase.error?.message || 'OK',
          current: testCount,
          total: allTests.length,
          duration: testCase.duration,
        });
      }

      // Small delay between tests to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    progress.complete();

    // Complete test run
    db.complete();
    logger.writeSummary();

    // Generate final report
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(80) + '\n');

    const stats = db.getStats();
    const summary = progress.getSummary();

    console.log(`Total Tests:         ${stats.total}`);
    console.log(`✅ Passed:           ${stats.pass}`);
    console.log(`❌ Failed:           ${stats.fail}`);
    console.log(`⊘  Skipped:          ${stats.skip}`);
    console.log(`🔐 Auth Required:    ${stats.auth_required}`);
    console.log(`⏱  Duration:         ${formatDuration(summary.duration)}\n`);

    // Show failures
    const failures = db.getTestCasesByStatus('fail');
    if (failures.length > 0) {
      console.log('=' .repeat(80));
      console.log(`❌ FAILURES (${failures.length})`);
      console.log('='.repeat(80) + '\n');

      failures.forEach((test) => {
        console.log(`${test.tool}.${test.action}`);
        console.log(`  Error: ${test.error?.message?.substring(0, 200)}`);
        console.log('');
      });
    }

    // Generate HTML report
    generateHtmlReport(db, logger);

    console.log('\n📄 Reports generated:');
    console.log(`  - JSON: ${db.getPath()}`);
    console.log(`  - Logs: ${logger.getLogFile?.() || 'test-logs/'}`);
    console.log(`  - HTML: ./test-results/report.html\n`);

    // Exit code based on failures
    if (failures.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    logger.error('system', 'orchestrator', 'fatal', 'fatal-error', 'Test orchestrator failed', error);
    console.error('\n❌ Test orchestrator failed:', error);
    process.exit(1);
  } finally {
    child.kill();
  }
}

/**
 * Format duration
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Generate HTML report
 */
function generateHtmlReport(db: TestDatabase, logger: TestLogger): void {
  const testRun = db.getTestRun();
  const logSummary = logger.getSummary();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>ServalSheets Test Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
    .stat-card { background: #f9f9f9; padding: 20px; border-radius: 8px; border-left: 4px solid #4CAF50; }
    .stat-value { font-size: 2em; font-weight: bold; color: #333; }
    .stat-label { color: #666; font-size: 0.9em; text-transform: uppercase; }
    .pass { color: #4CAF50; }
    .fail { color: #f44336; }
    .skip { color: #ff9800; }
    .auth { color: #2196F3; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:hover { background: #f9f9f9; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 600; }
    .badge-pass { background: #4CAF50; color: white; }
    .badge-fail { background: #f44336; color: white; }
    .badge-skip { background: #ff9800; color: white; }
    .badge-auth { background: #2196F3; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧪 ServalSheets Test Report</h1>
    <p><strong>Test Run ID:</strong> ${testRun.id}</p>
    <p><strong>Started:</strong> ${new Date(testRun.startTime).toLocaleString()}</p>
    <p><strong>Duration:</strong> ${formatDuration(testRun.duration || 0)}</p>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${testRun.stats.total}</div>
        <div class="stat-label">Total Tests</div>
      </div>
      <div class="stat-card">
        <div class="stat-value pass">${testRun.stats.pass}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value fail">${testRun.stats.fail}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value auth">${testRun.stats.auth_required}</div>
        <div class="stat-label">Auth Required</div>
      </div>
    </div>

    <h2>Test Cases</h2>
    <table>
      <thead>
        <tr>
          <th>Tool</th>
          <th>Action</th>
          <th>Status</th>
          <th>Duration</th>
          <th>Message</th>
        </tr>
      </thead>
      <tbody>
        ${testRun.testCases
          .map(
            (tc) => `
          <tr>
            <td><code>${tc.tool}</code></td>
            <td><code>${tc.action}</code></td>
            <td><span class="badge badge-${tc.status}">${tc.status.toUpperCase()}</span></td>
            <td>${tc.duration ? tc.duration + 'ms' : '-'}</td>
            <td>${tc.error?.message?.substring(0, 100) || 'OK'}</td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
  `;

  writeFileSync('./test-results/report.html', html);
}

// Add getLogFile method to TestLogger if missing
declare module './test-infrastructure/logger.js' {
  interface TestLogger {
    getLogFile?(): string;
  }
}

// Run the test suite
runAllTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
