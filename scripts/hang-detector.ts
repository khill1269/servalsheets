#!/usr/bin/env npx tsx
/**
 * ServalSheets Hang Detector
 * 
 * Quickly tests actions WITH AUTHENTICATION to detect hangs.
 * Uses 5-second timeout to catch issues fast.
 * 
 * Usage:
 *   npx tsx scripts/hang-detector.ts
 *   npx tsx scripts/hang-detector.ts --tool sheets_data
 *   npx tsx scripts/hang-detector.ts --timeout 3000
 *   npx tsx scripts/hang-detector.ts --only-critical
 * 
 * This complements test-all-actions-comprehensive.ts which runs WITHOUT auth.
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

// ============================================================================
// CONFIG
// ============================================================================

const TEST_SPREADSHEET_ID = '1P-uRTiCXwaKBI4il2qUMmJinZaHKjnRE2-q2IGSgBNA';
const TEST_SHEET_NAME = '🧪 Test Sandbox';
const TEST_SHEET_ID = 23117074;

interface Config {
  timeout: number;
  filterTool: string | null;
  onlyCritical: boolean;
  verbose: boolean;
}

const config: Config = {
  timeout: 5000,
  filterTool: null,
  onlyCritical: false,
  verbose: false,
};

// Parse args
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--timeout=')) config.timeout = parseInt(arg.split('=')[1]);
  if (arg.startsWith('--tool=')) config.filterTool = arg.split('=')[1];
  if (arg === '--only-critical') config.onlyCritical = true;
  if (arg === '--verbose' || arg === '-v') config.verbose = true;
}

// ============================================================================
// TEST DEFINITIONS
// ============================================================================

interface ActionTest {
  tool: string;
  action: string;
  args: any;
  critical?: boolean; // Actions known to potentially hang
  skip?: string;
}

const wrap = (args: any) => ({ request: args });

function getTestActions(): ActionTest[] {
  const ssId = TEST_SPREADSHEET_ID;
  const sheetId = TEST_SHEET_ID;
  const range = `'${TEST_SHEET_NAME}'!A1:B2`;
  const cell = `'${TEST_SHEET_NAME}'!Z99`;

  const actions: ActionTest[] = [
    // ===== sheets_auth =====
    { tool: 'sheets_auth', action: 'status', args: wrap({ action: 'status' }) },

    // ===== sheets_core (safe reads) =====
    { tool: 'sheets_core', action: 'get', args: wrap({ action: 'get', spreadsheetId: ssId }) },
    { tool: 'sheets_core', action: 'get_url', args: wrap({ action: 'get_url', spreadsheetId: ssId }) },
    { tool: 'sheets_core', action: 'list', args: wrap({ action: 'list', maxResults: 3 }) },
    { tool: 'sheets_core', action: 'list_sheets', args: wrap({ action: 'list_sheets', spreadsheetId: ssId }) },
    { tool: 'sheets_core', action: 'get_sheet', args: wrap({ action: 'get_sheet', spreadsheetId: ssId, sheetId }) },

    // ===== sheets_data (CRITICAL - where hangs occur) =====
    { tool: 'sheets_data', action: 'read', args: wrap({ action: 'read', spreadsheetId: ssId, range }), critical: true },
    { tool: 'sheets_data', action: 'batch_read', args: wrap({ action: 'batch_read', spreadsheetId: ssId, ranges: [range] }), critical: true },
    { tool: 'sheets_data', action: 'write', args: wrap({ action: 'write', spreadsheetId: ssId, range: cell, values: [['test']] }), critical: true },
    { tool: 'sheets_data', action: 'batch_write', args: wrap({ action: 'batch_write', spreadsheetId: ssId, data: [{ range: cell, values: [['test']] }] }), critical: true },
    { tool: 'sheets_data', action: 'clear', args: wrap({ action: 'clear', spreadsheetId: ssId, range: cell }), critical: true }, // KNOWN HANG
    { tool: 'sheets_data', action: 'batch_clear', args: wrap({ action: 'batch_clear', spreadsheetId: ssId, ranges: [cell] }), critical: true }, // KNOWN HANG
    { tool: 'sheets_data', action: 'append', args: wrap({ action: 'append', spreadsheetId: ssId, range: `'${TEST_SHEET_NAME}'!A:B`, values: [['X', 'Y']] }), critical: true },
    { tool: 'sheets_data', action: 'find_replace', args: wrap({ action: 'find_replace', spreadsheetId: ssId, find: 'ZZZNOTEXIST' }), critical: true },
    { tool: 'sheets_data', action: 'get_merges', args: wrap({ action: 'get_merges', spreadsheetId: ssId, sheetId }), critical: true },
    { tool: 'sheets_data', action: 'cut_paste', args: wrap({ action: 'cut_paste', spreadsheetId: ssId, source: cell, destination: `'${TEST_SHEET_NAME}'!Z98` }), critical: true },
    { tool: 'sheets_data', action: 'copy_paste', args: wrap({ action: 'copy_paste', spreadsheetId: ssId, source: cell, destination: `'${TEST_SHEET_NAME}'!Z97` }), critical: true },

    // ===== sheets_format =====
    { tool: 'sheets_format', action: 'set_format', args: wrap({ action: 'set_format', spreadsheetId: ssId, range: cell, format: { bold: true } }), critical: true },
    { tool: 'sheets_format', action: 'clear_format', args: wrap({ action: 'clear_format', spreadsheetId: ssId, range: cell }), critical: true },
    { tool: 'sheets_format', action: 'rule_list_conditional_formats', args: wrap({ action: 'rule_list_conditional_formats', spreadsheetId: ssId, sheetId }) },

    // ===== sheets_dimensions =====
    { tool: 'sheets_dimensions', action: 'insert_rows', args: wrap({ action: 'insert_rows', spreadsheetId: ssId, sheetId, startIndex: 90, endIndex: 91 }), critical: true },
    { tool: 'sheets_dimensions', action: 'delete_rows', args: wrap({ action: 'delete_rows', spreadsheetId: ssId, sheetId, startIndex: 90, endIndex: 91 }), critical: true },
    { tool: 'sheets_dimensions', action: 'list_filter_views', args: wrap({ action: 'list_filter_views', spreadsheetId: ssId, sheetId }) },
    { tool: 'sheets_dimensions', action: 'list_slicers', args: wrap({ action: 'list_slicers', spreadsheetId: ssId, sheetId }) },

    // ===== sheets_visualize =====
    { tool: 'sheets_visualize', action: 'chart_list', args: wrap({ action: 'chart_list', spreadsheetId: ssId }) },
    { tool: 'sheets_visualize', action: 'pivot_list', args: wrap({ action: 'pivot_list', spreadsheetId: ssId }) },

    // ===== sheets_collaborate =====
    { tool: 'sheets_collaborate', action: 'share_list', args: wrap({ action: 'share_list', spreadsheetId: ssId }) },
    { tool: 'sheets_collaborate', action: 'comment_list', args: wrap({ action: 'comment_list', spreadsheetId: ssId }) },
    { tool: 'sheets_collaborate', action: 'version_list_revisions', args: wrap({ action: 'version_list_revisions', spreadsheetId: ssId }) },

    // ===== sheets_advanced =====
    { tool: 'sheets_advanced', action: 'list_named_ranges', args: wrap({ action: 'list_named_ranges', spreadsheetId: ssId }) },
    { tool: 'sheets_advanced', action: 'list_protected_ranges', args: wrap({ action: 'list_protected_ranges', spreadsheetId: ssId }) },
    { tool: 'sheets_advanced', action: 'list_banding', args: wrap({ action: 'list_banding', spreadsheetId: ssId }) },

    // ===== sheets_analyze =====
    { tool: 'sheets_analyze', action: 'comprehensive', args: wrap({ action: 'comprehensive', spreadsheetId: ssId }), critical: true },
    { tool: 'sheets_analyze', action: 'analyze_structure', args: wrap({ action: 'analyze_structure', spreadsheetId: ssId }) },

    // ===== sheets_session =====
    { tool: 'sheets_session', action: 'get_context', args: wrap({ action: 'get_context' }) },
    { tool: 'sheets_session', action: 'get_preferences', args: wrap({ action: 'get_preferences' }) },

    // ===== sheets_history =====
    { tool: 'sheets_history', action: 'list', args: wrap({ action: 'list', limit: 5 }) },
    { tool: 'sheets_history', action: 'stats', args: wrap({ action: 'stats' }) },

    // ===== sheets_transaction =====
    { tool: 'sheets_transaction', action: 'list', args: wrap({ action: 'list' }) },

    // ===== sheets_templates =====
    { tool: 'sheets_templates', action: 'list', args: wrap({ action: 'list' }) },

    // ===== sheets_quality =====
    { tool: 'sheets_quality', action: 'detect_conflicts', args: wrap({ action: 'detect_conflicts', spreadsheetId: ssId }) },

    // ===== sheets_confirm =====
    { tool: 'sheets_confirm', action: 'get_stats', args: wrap({ action: 'get_stats' }) },

    // ===== sheets_fix =====
    { tool: 'sheets_fix', action: 'fix', args: wrap({ action: 'fix', spreadsheetId: ssId, issues: [], mode: 'preview' }) },

    // ===== sheets_bigquery =====
    { tool: 'sheets_bigquery', action: 'list_connections', args: wrap({ action: 'list_connections', spreadsheetId: ssId }) },
  ];

  return actions;
}

// ============================================================================
// TEST RUNNER
// ============================================================================

interface Result {
  tool: string;
  action: string;
  status: 'PASS' | 'FAIL' | 'TIMEOUT' | 'SKIP';
  duration: number;
  message: string;
  critical: boolean;
}

async function runHangDetector() {
  console.log('🔍 ServalSheets Hang Detector\n');
  console.log(`⏱️  Timeout: ${config.timeout}ms`);
  console.log(`📋 Mode: ${config.onlyCritical ? 'Critical actions only' : 'All test actions'}`);
  if (config.filterTool) console.log(`🔧 Filter: ${config.filterTool}`);
  console.log('');

  // Spawn MCP server
  const child = spawn('node', ['dist/cli.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd(),
  });

  let buffer = '';
  const pending = new Map<number, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();
  let reqId = 1;

  child.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.id && pending.has(json.id)) {
          const p = pending.get(json.id)!;
          clearTimeout(p.timeout);
          p.resolve(json);
          pending.delete(json.id);
        }
      } catch {
        if (config.verbose) console.log('  [LOG]', line.slice(0, 80));
      }
    }
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    if (config.verbose) console.error('  [ERR]', chunk.toString().slice(0, 100));
  });

  const send = (method: string, params: any = {}): Promise<any> => {
    return new Promise((resolve, reject) => {
      const id = reqId++;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error('TIMEOUT'));
      }, config.timeout);
      pending.set(id, { resolve, reject, timeout });
      child.stdin?.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  };

  const results: Result[] = [];

  try {
    // Initialize
    console.log('🚀 Starting server...');
    await send('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'hang-detector', version: '1.0' },
    });

    // Check auth
    console.log('🔐 Checking auth...');
    const authRes = await send('tools/call', { name: 'sheets_auth', arguments: wrap({ action: 'status' }) });
    const authText = authRes.result?.content?.[0]?.text || '{}';
    const authData = JSON.parse(authText);
    if (!authData.response?.authenticated) {
      console.log('❌ Not authenticated! Run sheets_auth login first.\n');
      process.exit(1);
    }
    console.log('✅ Authenticated\n');

    // Get actions to test
    let actions = getTestActions();
    if (config.filterTool) actions = actions.filter(a => a.tool === config.filterTool);
    if (config.onlyCritical) actions = actions.filter(a => a.critical);

    console.log(`📊 Testing ${actions.length} actions...\n`);
    console.log('─'.repeat(60));

    let currentTool = '';
    for (const test of actions) {
      if (test.tool !== currentTool) {
        currentTool = test.tool;
        console.log(`\n📦 ${currentTool}`);
      }

      if (test.skip) {
        results.push({ tool: test.tool, action: test.action, status: 'SKIP', duration: 0, message: test.skip, critical: !!test.critical });
        console.log(`   ⏭️  ${test.action} - SKIP`);
        continue;
      }

      const start = Date.now();
      try {
        const res = await send('tools/call', { name: test.tool, arguments: test.args });
        const duration = Date.now() - start;
        const text = res.result?.content?.[0]?.text || '{}';
        
        let parsed;
        try { parsed = JSON.parse(text); } catch { parsed = { response: { success: false, error: { message: text.slice(0, 50) } } }; }

        if (parsed.response?.success) {
          results.push({ tool: test.tool, action: test.action, status: 'PASS', duration, message: 'OK', critical: !!test.critical });
          console.log(`   ✅ ${test.action} (${duration}ms)`);
        } else {
          const err = parsed.response?.error?.code || 'FAIL';
          results.push({ tool: test.tool, action: test.action, status: 'FAIL', duration, message: err, critical: !!test.critical });
          console.log(`   ❌ ${test.action} [${err}] (${duration}ms)`);
        }
      } catch (e: any) {
        const duration = Date.now() - start;
        if (e.message === 'TIMEOUT') {
          results.push({ tool: test.tool, action: test.action, status: 'TIMEOUT', duration, message: `Hung after ${config.timeout}ms`, critical: !!test.critical });
          console.log(`   ⏱️  ${test.action} - TIMEOUT after ${config.timeout}ms ${test.critical ? '⚠️ CRITICAL' : ''}`);
        } else {
          results.push({ tool: test.tool, action: test.action, status: 'FAIL', duration, message: e.message, critical: !!test.critical });
          console.log(`   💥 ${test.action} - ERROR (${duration}ms)`);
        }
      }
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(60));

    const pass = results.filter(r => r.status === 'PASS').length;
    const fail = results.filter(r => r.status === 'FAIL').length;
    const timeout = results.filter(r => r.status === 'TIMEOUT').length;
    const skip = results.filter(r => r.status === 'SKIP').length;

    console.log(`\n✅ PASS:    ${pass}`);
    console.log(`❌ FAIL:    ${fail}`);
    console.log(`⏱️  TIMEOUT: ${timeout}`);
    console.log(`⏭️  SKIP:    ${skip}`);
    console.log(`📦 TOTAL:   ${results.length}`);

    // Show timeouts (critical bugs)
    const timeouts = results.filter(r => r.status === 'TIMEOUT');
    if (timeouts.length > 0) {
      console.log('\n🚨 TIMEOUT ISSUES (require code fix):');
      for (const t of timeouts) {
        console.log(`   • ${t.tool}.${t.action} ${t.critical ? '⚠️ CRITICAL' : ''}`);
      }
    }

    // Show critical failures
    const criticalFails = results.filter(r => r.status === 'FAIL' && r.critical);
    if (criticalFails.length > 0) {
      console.log('\n⚠️ CRITICAL FAILURES:');
      for (const f of criticalFails) {
        console.log(`   • ${f.tool}.${f.action}: ${f.message}`);
      }
    }

    // Save results
    const output = {
      timestamp: new Date().toISOString(),
      config,
      summary: { pass, fail, timeout, skip, total: results.length },
      timeouts: timeouts.map(t => `${t.tool}.${t.action}`),
      results,
    };
    writeFileSync('hang-detector-results.json', JSON.stringify(output, null, 2));
    console.log('\n📄 Results saved to: hang-detector-results.json');

    // Exit code
    if (timeout > 0) {
      console.log('\n❌ FAILED: Timeouts detected - requires code fix');
      process.exit(1);
    } else {
      console.log('\n✅ No hangs detected');
      process.exit(0);
    }

  } finally {
    child.kill();
  }
}

runHangDetector().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
