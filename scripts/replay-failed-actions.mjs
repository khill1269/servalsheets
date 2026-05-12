#!/usr/bin/env node
/**
 * Replay Failed Actions from Benchmark
 *
 * Reads a specific action-matrix benchmark JSON, filters to failed actions,
 * and re-runs them via the MCP protocol smoke infrastructure. Useful for
 * verifying a fix without running the full 30-45 min nightly suite.
 *
 * Usage:
 *   node scripts/replay-failed-actions.mjs [benchmark-file-or-latest] [--tool sheets_data] [--dry-run]
 *
 * Examples:
 *   node scripts/replay-failed-actions.mjs                          # latest benchmark
 *   node scripts/replay-failed-actions.mjs tests/benchmarks/action-matrix-v2-2026-04-28T20-00-20-481Z.json
 *   node scripts/replay-failed-actions.mjs --tool sheets_format     # only failed format actions
 *   node scripts/replay-failed-actions.mjs --dry-run                # show what would run
 */

import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const benchmarksDir = join(projectRoot, 'tests', 'benchmarks');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const toolFilter = args.includes('--tool') ? args[args.indexOf('--tool') + 1] : null;

// ── Find benchmark file ──────────────────────────────────────────────────────
let benchmarkFile = args.find((a) => a.endsWith('.json'));
if (!benchmarkFile) {
  const files = readdirSync(benchmarksDir)
    .filter((f) => f.startsWith('action-matrix-v2-') && f.endsWith('.json'))
    .sort();
  if (files.length === 0) {
    console.error('No benchmark files found in tests/benchmarks/');
    process.exit(1);
  }
  benchmarkFile = join(benchmarksDir, files[files.length - 1]);
  console.log(`Using latest benchmark: ${files[files.length - 1]}`);
}

// ── Load failed actions ──────────────────────────────────────────────────────
const data = JSON.parse(readFileSync(benchmarkFile, 'utf-8'));
const allResults = data.results ?? [];

const failedActions = allResults.filter(
  (r) => !r.success && !r.gated && r.mode !== 'external_pack' && (!toolFilter || r.tool === toolFilter)
);

if (failedActions.length === 0) {
  console.log('✅ No failed actions found in this benchmark. Nothing to replay.');
  process.exit(0);
}

console.log(`\n🔄 Replay: ${failedActions.length} failed action(s) from ${benchmarkFile.split('/').pop()}`);
if (toolFilter) console.log(`   Filter: --tool ${toolFilter}`);
console.log();

for (const r of failedActions) {
  const reason = typeof r.reason === 'string' ? r.reason.slice(0, 80) : '';
  console.log(`  ❌ ${r.actionKey.padEnd(50)} ${reason}`);
}

if (dryRun) {
  console.log('\n--dry-run: would replay the above actions via MCP protocol. Remove flag to execute.');
  process.exit(0);
}

// ── Load fixture inputs ──────────────────────────────────────────────────────
let fixtureMap = new Map();
try {
  const { generateAllFixtures } = await import('../dist/tests/audit/action-coverage-fixtures.js');
  const fixtures = generateAllFixtures();
  for (const f of fixtures) {
    fixtureMap.set(`${f.tool}.${f.action}`, f);
  }
} catch {
  console.warn('⚠  Could not load dist fixtures — using minimal inputs (spreadsheetId only)');
}

// ── Start server and replay ──────────────────────────────────────────────────
const serverEnv = {
  ...process.env,
  NODE_ENV: 'test',
  SESSION_STORE_TYPE: 'memory',
  ALLOW_MEMORY_SESSIONS: 'true',
  CACHE_REDIS_ENABLED: 'false',
  LOG_LEVEL: 'error',
  SKIP_PREFLIGHT: 'true',
  MCP_TRANSPORT: 'stdio',
  SERVAL_TOOL_MODE: 'bundled',
  SERVAL_STAGED_REGISTRATION: 'false',
  SERVALSHEETS_LOAD_DOTENV: 'false',
  ENABLE_PYTHON_COMPUTE: 'false',
};

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['--import', 'tsx', join(projectRoot, 'src/cli.ts'), '--stdio'],
  env: serverEnv,
  stderr: 'pipe',
});

const client = new Client({ name: 'replay-client', version: '1.0.0' }, { capabilities: {} });

try {
  await client.connect(transport);
  console.log('\n📡 Connected. Replaying failed actions...\n');

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const r of failedActions) {
    const fixture = fixtureMap.get(r.actionKey);
    const input = fixture?.validInput ?? { request: { action: r.action, spreadsheetId: 'replay-test-id' } };

    try {
      const result = await Promise.race([
        client.callTool({ name: r.tool, arguments: input }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10_000)),
      ]);

      const content = result.content?.[0];
      const text = content?.type === 'text' ? content.text : '';
      const nowSuccess = !result.isError || text.includes('NOT_AUTHENTICATED') || text.includes('AUTHENTICATION_REQUIRED');

      if (nowSuccess) {
        console.log(`  ✅ ${r.actionKey.padEnd(50)} FIXED`);
        passed++;
        results.push({ actionKey: r.actionKey, status: 'fixed' });
      } else {
        const errSnippet = text.slice(0, 100);
        console.log(`  ❌ ${r.actionKey.padEnd(50)} STILL FAILING: ${errSnippet}`);
        failed++;
        results.push({ actionKey: r.actionKey, status: 'still_failing', error: errSnippet });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ⚠  ${r.actionKey.padEnd(50)} ERROR: ${msg.slice(0, 80)}`);
      failed++;
      results.push({ actionKey: r.actionKey, status: 'error', error: msg });
    }
  }

  console.log(`\n📊 Replay summary: ${passed} fixed, ${failed} still failing of ${failedActions.length} total`);

  // Write results file
  mkdirSync(join(projectRoot, '.tmp'), { recursive: true });
  const outFile = join(projectRoot, '.tmp', `replay-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(outFile, JSON.stringify({ replayedAt: new Date().toISOString(), source: benchmarkFile, results }, null, 2));
  console.log(`\n💾 Results saved: ${outFile}`);

  await client.close();
  process.exit(failed > 0 ? 1 : 0);
} catch (err) {
  console.error('Fatal error:', err);
  process.exit(1);
}
