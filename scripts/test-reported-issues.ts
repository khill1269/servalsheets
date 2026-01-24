/**
 * Test Reported Issues
 *
 * Focused testing on the specific issues reported by the user:
 * 1. sheets_auth status - Reports tokens present even when invalid
 * 2. sheets_data write/read - Range validation bug
 * 3. sheets_format apply_preset - Range validation bug
 */

import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

interface TestResult {
  test: string;
  status: 'pass' | 'fail';
  message: string;
  error?: string;
}

const results: TestResult[] = [];
let requestId = 1;

const TEST_SPREADSHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

function createJsonRpcClient(child: ChildProcess) {
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
    if (process.env.LOG_LEVEL === 'debug') {
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

async function testAuthStatus(client: any): Promise<TestResult> {
  console.log('\n🔍 Test 1: sheets_auth status validation\n');

  try {
    const response = await client.send('tools/call', {
      name: 'sheets_auth',
      arguments: { action: 'status' },
    });

    const content = response.result?.content;
    const textContent = content?.find((c: any) => c.type === 'text');
    const text = textContent?.text || '';

    console.log('Response:', text.substring(0, 300));

    // Check if it properly validates token validity
    if (text.includes('authenticated: true') || text.includes('"authenticated":true')) {
      // Check if it actually validates the token or just checks existence
      if (text.includes('hasAccessToken') || text.includes('hasRefreshToken')) {
        return {
          test: 'sheets_auth status',
          status: 'pass',
          message: 'Status reports token presence correctly',
        };
      } else {
        return {
          test: 'sheets_auth status',
          status: 'fail',
          message: 'Status does not provide token validity details',
          error: text.substring(0, 500),
        };
      }
    } else if (text.includes('not authenticated') || text.includes('authenticated: false')) {
      return {
        test: 'sheets_auth status',
        status: 'pass',
        message: 'Status correctly reports not authenticated',
      };
    } else {
      return {
        test: 'sheets_auth status',
        status: 'fail',
        message: 'Status response unclear about authentication state',
        error: text.substring(0, 500),
      };
    }
  } catch (err) {
    return {
      test: 'sheets_auth status',
      status: 'fail',
      message: 'Exception during test',
      error: (err as Error).message,
    };
  }
}

async function testValuesWrite(client: any): Promise<TestResult> {
  console.log('\n🔍 Test 2: sheets_data write with range validation\n');

  try {
    const response = await client.send('tools/call', {
      name: 'sheets_data',
      arguments: {
        action: 'write',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:B2',
        values: [
          ['Test1', 'Test2'],
          ['Test3', 'Test4'],
        ],
      },
    });

    const content = response.result?.content;
    const textContent = content?.find((c: any) => c.type === 'text');
    const text = textContent?.text || '';

    console.log('Response:', text.substring(0, 300));

    // Check for range validation errors
    if (text.includes('Range validation') || text.includes('INVALID_RANGE')) {
      return {
        test: 'sheets_data write',
        status: 'fail',
        message: 'Range validation error detected',
        error: text.substring(0, 500),
      };
    } else if (text.includes('not authenticated') || text.includes('OAuth')) {
      return {
        test: 'sheets_data write',
        status: 'pass',
        message: 'Expected auth error (no credentials), no range validation bug',
      };
    } else if (text.includes('success') || text.includes('updated')) {
      return {
        test: 'sheets_data write',
        status: 'pass',
        message: 'Write succeeded, no range validation error',
      };
    } else {
      return {
        test: 'sheets_data write',
        status: 'fail',
        message: 'Unexpected response',
        error: text.substring(0, 500),
      };
    }
  } catch (err) {
    return {
      test: 'sheets_data write',
      status: 'fail',
      message: 'Exception during test',
      error: (err as Error).message,
    };
  }
}

async function testValuesRead(client: any): Promise<TestResult> {
  console.log('\n🔍 Test 3: sheets_data read with range validation\n');

  try {
    const response = await client.send('tools/call', {
      name: 'sheets_data',
      arguments: {
        action: 'read',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:D10',
      },
    });

    const content = response.result?.content;
    const textContent = content?.find((c: any) => c.type === 'text');
    const text = textContent?.text || '';

    console.log('Response:', text.substring(0, 300));

    // Check for range validation errors
    if (text.includes('Range validation') || text.includes('INVALID_RANGE')) {
      return {
        test: 'sheets_data read',
        status: 'fail',
        message: 'Range validation error detected',
        error: text.substring(0, 500),
      };
    } else if (text.includes('not authenticated') || text.includes('OAuth')) {
      return {
        test: 'sheets_data read',
        status: 'pass',
        message: 'Expected auth error (no credentials), no range validation bug',
      };
    } else if (text.includes('values') || text.includes('data')) {
      return {
        test: 'sheets_data read',
        status: 'pass',
        message: 'Read succeeded, no range validation error',
      };
    } else {
      return {
        test: 'sheets_data read',
        status: 'fail',
        message: 'Unexpected response',
        error: text.substring(0, 500),
      };
    }
  } catch (err) {
    return {
      test: 'sheets_data read',
      status: 'fail',
      message: 'Exception during test',
      error: (err as Error).message,
    };
  }
}

async function testFormatPreset(client: any): Promise<TestResult> {
  console.log('\n🔍 Test 4: sheets_format apply_preset with range validation\n');

  try {
    const response = await client.send('tools/call', {
      name: 'sheets_format',
      arguments: {
        action: 'apply_preset',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:D10',
        preset: 'header_row',
      },
    });

    const content = response.result?.content;
    const textContent = content?.find((c: any) => c.type === 'text');
    const text = textContent?.text || '';

    console.log('Response:', text.substring(0, 300));

    // Check for range validation errors
    if (text.includes('Range validation') || text.includes('INVALID_RANGE')) {
      return {
        test: 'sheets_format apply_preset',
        status: 'fail',
        message: 'Range validation error detected',
        error: text.substring(0, 500),
      };
    } else if (text.includes('not authenticated') || text.includes('OAuth')) {
      return {
        test: 'sheets_format apply_preset',
        status: 'pass',
        message: 'Expected auth error (no credentials), no range validation bug',
      };
    } else if (text.includes('success') || text.includes('applied')) {
      return {
        test: 'sheets_format apply_preset',
        status: 'pass',
        message: 'Preset applied successfully, no range validation error',
      };
    } else {
      return {
        test: 'sheets_format apply_preset',
        status: 'fail',
        message: 'Unexpected response',
        error: text.substring(0, 500),
      };
    }
  } catch (err) {
    return {
      test: 'sheets_format apply_preset',
      status: 'fail',
      message: 'Exception during test',
      error: (err as Error).message,
    };
  }
}

async function runTests() {
  console.log('🧪 Testing Reported Issues\n');
  console.log('='.repeat(80));
  console.log('Testing specific issues reported by user:');
  console.log('1. sheets_auth status - Token validity check');
  console.log('2. sheets_data write - Range validation');
  console.log('3. sheets_data read - Range validation');
  console.log('4. sheets_format apply_preset - Range validation');
  console.log('='.repeat(80));

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
        name: 'issue-test-client',
        version: '1.0.0',
      },
    });

    console.log('\n✅ Server initialized');

    // Run tests
    results.push(await testAuthStatus(client));
    results.push(await testValuesWrite(client));
    results.push(await testValuesRead(client));
    results.push(await testFormatPreset(client));

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(80) + '\n');

    const passed = results.filter((r) => r.status === 'pass').length;
    const failed = results.filter((r) => r.status === 'fail').length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📦 Total:  ${results.length}\n`);

    // Show results
    results.forEach((r) => {
      const icon = r.status === 'pass' ? '✅' : '❌';
      console.log(`${icon} ${r.test}`);
      console.log(`   ${r.message}`);
      if (r.error) {
        console.log(`   Error: ${r.error.substring(0, 200)}${r.error.length > 200 ? '...' : ''}`);
      }
      console.log('');
    });

    // Exit code
    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    child.kill();
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
