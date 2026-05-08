#!/usr/bin/env node
/**
 * ServalSheets Full Test Suite Runner
 *
 * Runs all test layers in order: TypeScript → unit → simulation → audit → live → stress
 * Produces a formatted summary table with timing and pass/fail per layer.
 *
 * Usage:
 *   node scripts/run-full-test-suite.mjs            # all layers
 *   node scripts/run-full-test-suite.mjs --skip-live  # skip live API tests
 *   node scripts/run-full-test-suite.mjs --json       # emit JSON report to stdout
 *   node scripts/run-full-test-suite.mjs --layer unit # run single layer
 *
 * Exit code: 0 if all non-optional layers pass, 1 if any fail.
 */

import { execSync, spawnSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Argument parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const SKIP_LIVE = args.includes('--skip-live');
const SKIP_STRESS = args.includes('--skip-stress');
const JSON_MODE = args.includes('--json');
const LAYER_FILTER = args.find(a => a.startsWith('--layer='))?.split('=')[1];

// ── Suite definitions ─────────────────────────────────────────────────────────

const SUITES = [
  {
    id: 'typecheck',
    name: 'TypeScript',
    cmd: 'npm run typecheck',
    timeout: 60_000,
    parse: (out) => {
      const errors = (out.match(/error TS\d+/g) || []).length;
      return { detail: errors === 0 ? '0 errors' : `${errors} error(s)`, ok: errors === 0 };
    },
  },
  {
    id: 'drift',
    name: 'Metadata Drift',
    cmd: 'npm run check:drift',
    timeout: 30_000,
    parse: (out) => {
      const match = out.match(/(\d+) tools, (\d+) actions/);
      return {
        detail: match ? `${match[1]} tools, ${match[2]} actions synchronized` : 'synchronized',
        ok: out.includes('✅') || out.includes('passed'),
      };
    },
  },
  {
    id: 'unit',
    name: 'Unit + Contract',
    cmd: 'npm run test:fast',
    timeout: 120_000,
    parse: parseVitestOutput,
  },
  {
    id: 'simulation',
    name: 'Simulation (23 categories)',
    cmd: 'npm run test:simulation',
    timeout: 180_000,
    parse: parseVitestOutput,
  },
  {
    id: 'audit-gate',
    name: 'Audit Gates (A1–A14)',
    // A15 is mutation testing (10-20min) — run separately via npm run audit:full
    cmd: 'SKIP_MUTATION_TESTING=true npm run audit:gate',
    timeout: 600_000,
    parse: (out) => {
      const gateMatch = out.match(/(\d+)\/(\d+) gates passed/i);
      const ok = /all \d+ gates passed/i.test(out) || out.includes('ALL GATES PASSED') || (gateMatch && gateMatch[1] === gateMatch[2]);
      return { detail: gateMatch ? `${gateMatch[1]}/${gateMatch[2]} gates` : (ok ? 'all gates pass' : 'gate failure'), ok };
    },
  },
  {
    id: 'perf',
    name: 'Performance Bench',
    cmd: 'npx vitest bench --run tests/audit/performance-profile.bench.ts',
    timeout: 180_000,
    optional: true,
    parse: (out, exitCode) => {
      // vitest bench exits 0 on success; timeout (ETIMEDOUT signal) counts as complete
      const fatalError = out.includes('ERR_MODULE') || out.includes('Cannot find') || out.includes('SyntaxError');
      const ok = exitCode === 0 || (!fatalError && (out.includes('ops/s') || out.includes('hz')));
      return { detail: ok ? 'benchmarks ran' : 'benchmark error', ok };
    },
  },
  {
    id: 'memory',
    name: 'Memory Leaks',
    cmd: 'npm run audit:memory',
    timeout: 60_000,
    parse: parseVitestOutput,
  },
  {
    id: 'live',
    name: 'Live API (27 tools)',
    cmd: 'npm run test:live:fast',
    timeout: 300_000,
    optional: true,
    skip: SKIP_LIVE,
    parse: (out) => {
      const skipped = (out.match(/\d+ skipped/)?.[0] || '').replace(' skipped', '');
      return {
        ...parseVitestOutput(out),
        detail: parseVitestOutput(out).detail + (skipped ? ` (${skipped} skipped — no creds)` : ''),
      };
    },
  },
  {
    id: 'stress-dry',
    name: 'Stress (dry-run)',
    cmd: 'npm run test:stress:dry',
    timeout: 120_000,
    optional: true,
    skip: SKIP_STRESS,
    parse: parseVitestOutput,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseVitestOutput(out) {
  const testMatch = out.match(/Tests\s+(\d+)\s+(?:passed)(?:\s*\|\s*(\d+) failed)?/i)
    || out.match(/(\d+) passed/i);
  const fileMatch = out.match(/Test Files\s+(\d+)\s+passed/i);
  const failMatch = out.match(/(\d+) failed/i);

  const passed = testMatch ? parseInt(testMatch[1]) : 0;
  const failed = failMatch ? parseInt(failMatch[1]) : 0;
  const files = fileMatch ? parseInt(fileMatch[1]) : 0;

  const ok = failed === 0 && (passed > 0 || out.includes('passed'));
  const detail = passed || failed
    ? `${passed}${failed ? `/${passed + failed}` : ''} pass${files ? ` (${files} files)` : ''}`
    : (ok ? 'pass' : 'fail');
  return { detail, ok };
}

function pad(str, len, right = false) {
  const s = String(str);
  return right ? s.padStart(len) : s.padEnd(len);
}

function fmt(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${((ms % 60_000) / 1000).toFixed(0)}s`;
}

function run(suite) {
  const start = Date.now();
  try {
    const result = spawnSync(suite.cmd, {
      shell: true,
      cwd: ROOT,
      timeout: suite.timeout,
      encoding: 'utf8',
    });
    const out = (result.stdout || '') + (result.stderr || '');
    const elapsed = Date.now() - start;
    const parsed = suite.parse(out, result.status ?? -1);
    return { ok: result.status === 0 && parsed.ok, detail: parsed.detail, ms: elapsed, out };
  } catch (err) {
    return { ok: false, detail: `error: ${err.message}`, ms: Date.now() - start, out: '' };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const startAll = Date.now();
const results = [];

if (!JSON_MODE) {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  ServalSheets Full Test Suite                                ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
}

for (const suite of SUITES) {
  if (LAYER_FILTER && suite.id !== LAYER_FILTER) continue;

  if (suite.skip) {
    if (!JSON_MODE) {
      console.log(`║  ${pad(suite.name, 28)}  ⚪  skipped                       ║`);
    }
    results.push({ id: suite.id, name: suite.name, status: 'skipped', ms: 0 });
    continue;
  }

  if (!JSON_MODE && process.stdout.isTTY) process.stdout.write(`║  ${pad(suite.name, 28)}  ⏳  running...\r`);

  const r = run(suite);
  const icon = r.ok ? '✅' : (suite.optional ? '⚠️ ' : '❌');
  const detail = pad(r.detail, 30);
  const time = pad(`(${fmt(r.ms)})`, 9, true);

  if (!JSON_MODE) {
    console.log(`║  ${pad(suite.name, 28)}  ${icon}  ${detail}  ${time}  ║`);
  }

  results.push({
    id: suite.id,
    name: suite.name,
    status: r.ok ? 'pass' : (suite.optional ? 'warn' : 'fail'),
    detail: r.detail,
    ms: r.ms,
  });
}

const totalMs = Date.now() - startAll;
const passed = results.filter(r => r.status === 'pass').length;
const failed = results.filter(r => r.status === 'fail').length;
const skipped = results.filter(r => r.status === 'skipped').length;
const warned = results.filter(r => r.status === 'warn').length;
const ran = results.filter(r => r.status !== 'skipped').length;

if (JSON_MODE) {
  console.log(JSON.stringify({ results, summary: { passed, failed, skipped, warned, totalMs } }, null, 2));
} else {
  console.log('╠══════════════════════════════════════════════════════════════╣');
  const summaryLine = `${passed}/${ran} suites passed${skipped ? ` (${skipped} skipped)` : ''}${warned ? ` (${warned} optional warn)` : ''}`;
  console.log(`║  ${pad('Total: ' + summaryLine, 48)}  ${pad('(' + fmt(totalMs) + ')', 9, true)}  ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (failed > 0) {
    console.error(`\n❌ ${failed} suite(s) failed:\n`);
    results.filter(r => r.status === 'fail').forEach(r => {
      console.error(`   • ${r.name}: ${r.detail}`);
    });
    console.error('');
  }
}

process.exit(failed > 0 ? 1 : 0);
