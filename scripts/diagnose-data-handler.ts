/**
 * Diagnostic script to test sheets_data handler directly
 * Run: npx ts-node scripts/diagnose-data-handler.ts
 */

import { spawn } from 'child_process';

const TEST_SPREADSHEET_ID = '1Sz5aRCE1D17NI4BT6KGiGCA7cSpbQ1vPM5BoskkzrM4';

async function main() {
  console.log('🔍 Starting ServalSheets diagnostic...\n');

  const child = spawn('node', ['dist/cli.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let buffer = '';
  const pending = new Map<number, { resolve: Function; reject: Function }>();
  let requestId = 1;

  child.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.id && pending.has(json.id)) {
          pending.get(json.id)?.resolve(json);
          pending.delete(json.id);
        }
      } catch {
        // Non-JSON output (logs)
        if (process.env.DEBUG) console.log('LOG:', line);
      }
    }
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    if (process.env.DEBUG || text.includes('Error')) {
      console.error('STDERR:', text);
    }
  });

  const send = (method: string, params: any = {}): Promise<any> => {
    return new Promise((resolve, reject) => {
      const id = requestId++;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`TIMEOUT after 30s: ${method}`));
      }, 30000);

      pending.set(id, {
        resolve: (result: any) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        },
      });

      const request = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
      child.stdin?.write(request);
    });
  };

  try {
    // Initialize
    console.log('1️⃣ Initializing MCP server...');
    const initResult = await send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'diagnostic-client', version: '1.0.0' },
    });
    console.log('   ✅ Initialize:', initResult.result ? 'OK' : 'FAILED');

    // Check auth
    console.log('\n2️⃣ Checking authentication...');
    const authResult = await send('tools/call', {
      name: 'sheets_auth',
      arguments: { request: { action: 'status' } },
    });
    const authResponse = JSON.parse(authResult.result?.content?.[0]?.text || '{}');
    console.log(
      '   Auth status:',
      authResponse.response?.authenticated ? '✅ Authenticated' : '❌ Not authenticated'
    );

    if (!authResponse.response?.authenticated) {
      console.log('\n⚠️  Not authenticated. Run OAuth login first.');
      process.exit(1);
    }

    // Test sheets_core first
    console.log('\n3️⃣ Testing sheets_core (get)...');
    const startCore = Date.now();
    const coreResult = await send('tools/call', {
      name: 'sheets_core',
      arguments: { request: { action: 'get', spreadsheetId: TEST_SPREADSHEET_ID } },
    });
    const coreDuration = Date.now() - startCore;
    const coreResponse = JSON.parse(coreResult.result?.content?.[0]?.text || '{}');
    console.log(
      `   sheets_core: ${coreResponse.response?.success ? '✅ OK' : '❌ FAILED'} (${coreDuration}ms)`
    );

    // Test sheets_data read
    console.log('\n4️⃣ Testing sheets_data (read)...');
    const startData = Date.now();
    try {
      const dataResult = await send('tools/call', {
        name: 'sheets_data',
        arguments: {
          request: {
            action: 'read',
            spreadsheetId: TEST_SPREADSHEET_ID,
            range: "'MCP Test Duplicate'!A1:E10",
          },
        },
      });
      const dataDuration = Date.now() - startData;
      const dataResponse = JSON.parse(dataResult.result?.content?.[0]?.text || '{}');
      console.log(
        `   sheets_data: ${dataResponse.response?.success ? '✅ OK' : '❌ FAILED'} (${dataDuration}ms)`
      );

      if (dataResponse.response?.success) {
        console.log(`   Returned ${dataResponse.response?.values?.length || 0} rows`);
      } else {
        console.log('   Error:', dataResponse.response?.error);
      }
    } catch (err: any) {
      const dataDuration = Date.now() - startData;
      console.log(`   ❌ sheets_data FAILED after ${dataDuration}ms`);
      console.log(`   Error: ${err.message}`);
    }

    // Test sheets_data batch_read
    console.log('\n5️⃣ Testing sheets_data (batch_read)...');
    const startBatch = Date.now();
    try {
      const batchResult = await send('tools/call', {
        name: 'sheets_data',
        arguments: {
          request: {
            action: 'batch_read',
            spreadsheetId: TEST_SPREADSHEET_ID,
            ranges: ["'MCP Test Duplicate'!A1:B5", "'MCP Test Duplicate'!C1:D5"],
          },
        },
      });
      const batchDuration = Date.now() - startBatch;
      const batchResponse = JSON.parse(batchResult.result?.content?.[0]?.text || '{}');
      console.log(
        `   batch_read: ${batchResponse.response?.success ? '✅ OK' : '❌ FAILED'} (${batchDuration}ms)`
      );
    } catch (err: any) {
      const batchDuration = Date.now() - startBatch;
      console.log(`   ❌ batch_read FAILED after ${batchDuration}ms`);
      console.log(`   Error: ${err.message}`);
    }

    console.log('\n✅ Diagnostic complete!\n');
  } catch (err: any) {
    console.error('\n❌ Diagnostic failed:', err.message);
  } finally {
    child.kill();
    process.exit(0);
  }
}

main();
