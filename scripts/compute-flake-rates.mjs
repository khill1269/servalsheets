#!/usr/bin/env node
/**
 * Compute per-action flake rates from action matrix benchmark history.
 *
 * Reads all action-matrix-v2-*.json files in tests/benchmarks/, computes
 * pass/fail counts per action across runs, and outputs actions ranked by
 * instability (flake rate = failures / total_runs).
 *
 * Usage:
 *   node scripts/compute-flake-rates.mjs [--min-runs 3] [--top 20] [--json]
 *
 * Output: Sorted table of flakiest actions with pass rate, run count, last status.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const benchmarksDir = join(__dirname, '..', 'tests', 'benchmarks');

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const minRuns = parseInt(args[args.indexOf('--min-runs') + 1] ?? '2', 10) || 2;
const topN = parseInt(args[args.indexOf('--top') + 1] ?? '25', 10) || 25;

// ── Load all benchmark files ─────────────────────────────────────────────────
const files = readdirSync(benchmarksDir)
  .filter((f) => f.startsWith('action-matrix-v2-') && f.endsWith('.json'))
  .sort(); // chronological by filename (ISO timestamp in name)

if (files.length === 0) {
  console.error('No action-matrix-v2-*.json files found in tests/benchmarks/');
  process.exit(1);
}

// ── Aggregate per-action stats ───────────────────────────────────────────────
const actionStats = new Map(); // actionKey → { tool, action, runs, passes, failures, lastStatus, lastRun }

for (const file of files) {
  const data = JSON.parse(readFileSync(join(benchmarksDir, file), 'utf-8'));
  const runDate = data.generatedAt ?? file.replace('action-matrix-v2-', '').replace('.json', '');
  const results = data.results ?? [];

  for (const r of results) {
    if (!r.actionKey) continue;
    if (r.mode === 'external_pack') continue; // excluded by design

    const key = r.actionKey;
    if (!actionStats.has(key)) {
      actionStats.set(key, {
        actionKey: key,
        tool: r.tool,
        action: r.action,
        mode: r.mode,
        runs: 0,
        passes: 0,
        failures: 0,
        lastStatus: null,
        lastRun: null,
      });
    }
    const s = actionStats.get(key);
    s.runs++;
    if (r.success || r.gated) {
      s.passes++;
      s.lastStatus = r.success ? 'pass' : 'gated';
    } else {
      s.failures++;
      s.lastStatus = 'fail';
    }
    s.lastRun = runDate;
  }
}

// ── Compute flake rates ──────────────────────────────────────────────────────
const rows = Array.from(actionStats.values())
  .filter((s) => s.runs >= minRuns)
  .map((s) => ({
    ...s,
    flakeRate: s.failures / s.runs,
    passRate: (s.passes / s.runs) * 100,
  }))
  .sort((a, b) => b.flakeRate - a.flakeRate);

// ── Output ───────────────────────────────────────────────────────────────────
if (jsonMode) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), totalFiles: files.length, rows }, null, 2));
  process.exit(0);
}

const flaky = rows.filter((r) => r.flakeRate > 0).slice(0, topN);
const stable = rows.filter((r) => r.flakeRate === 0).length;

console.log(`\n📊 Action Matrix Flake Rate Report`);
console.log(`   Benchmark files: ${files.length}  |  Oldest: ${files[0]}  |  Newest: ${files[files.length - 1]}`);
console.log(`   Min runs required: ${minRuns}  |  Total actions tracked: ${rows.length}  |  Stable (0% flake): ${stable}\n`);

if (flaky.length === 0) {
  console.log('✅ No flaky actions found across all benchmark runs!');
  process.exit(0);
}

// Table header
console.log(`${'Action'.padEnd(50)} ${'Flake%'.padStart(7)} ${'Passes'.padStart(7)} ${'Failures'.padStart(9)} ${'Runs'.padStart(5)} ${'Last'}`);
console.log('─'.repeat(100));

for (const r of flaky) {
  const pct = (r.flakeRate * 100).toFixed(1).padStart(6) + '%';
  const status = r.lastStatus === 'fail' ? '❌' : r.lastStatus === 'pass' ? '✅' : '⏭';
  console.log(
    `${r.actionKey.padEnd(50)} ${pct} ${String(r.passes).padStart(7)} ${String(r.failures).padStart(9)} ${String(r.runs).padStart(5)} ${status}`
  );
}

console.log('\n💡 Tip: Actions with flake rate > 20% should be investigated for quota sensitivity or test fixture issues.');
console.log(`    Run with --json for machine-readable output  |  --min-runs N to require more history\n`);

// Exit 0 if all flake rates < 30%, exit 1 if any > 50% (for CI use)
const critical = flaky.filter((r) => r.flakeRate > 0.5);
if (critical.length > 0) {
  console.error(`⚠️  ${critical.length} action(s) failing > 50% of the time — investigate before shipping`);
  process.exit(1);
}
