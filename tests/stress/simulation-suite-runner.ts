/**
 * ServalSheets — Simulation Suite Runner
 *
 * Runs all cat01-catX and supplementary simulation test files
 * and aggregates pass/fail results into a combined report.
 *
 * Usage:
 *   npx tsx tests/stress/simulation-suite-runner.ts
 *   npx tsx tests/stress/simulation-suite-runner.ts --json
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const SIMULATION_CATEGORIES = [
  'tests/simulation/cat01-core-crud.test.ts',
  'tests/simulation/cat02-data-operations.test.ts',
  'tests/simulation/cat03-formatting.test.ts',
  'tests/simulation/cat04-analysis-intelligence.test.ts',
  'tests/simulation/cat05-visualization.test.ts',
  'tests/simulation/cat06-collaboration.test.ts',
  'tests/simulation/cat07-advanced-features.test.ts',
  'tests/simulation/cat08-agent-workflows.test.ts',
  'tests/simulation/cat09-external-integrations.test.ts',
  'tests/simulation/cat10-compute-engine.test.ts',
  'tests/simulation/cat11-error-recovery.test.ts',
  'tests/simulation/cat12-llm-intelligence.test.ts',
  'tests/simulation/cat13-elicitation-wizards.test.ts',
  'tests/simulation/catE2E-persona-workflows.test.ts',
  'tests/simulation/catX-cross-cutting-stress.test.ts',
  'tests/simulation/concurrent-stress.test.ts',
  'tests/simulation/action-fuzzer.test.ts',
  'tests/simulation/mcp-pipeline-fuzz.test.ts',
  'tests/simulation/user-flows.test.ts',
];

interface CategoryResult {
  file: string;
  passed: boolean;
  duration: number;
  output: string;
  error?: string;
}

interface SuiteReport {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: CategoryResult[];
}

function runCategory(file: string): CategoryResult {
  const start = Date.now();
  try {
    const output = execSync(`npx vitest run ${file} --reporter=verbose`, {
      cwd: ROOT,
      timeout: 120_000,
      encoding: 'utf-8',
      env: { ...process.env, NODE_ENV: 'test' },
    });
    return { file, passed: true, duration: Date.now() - start, output };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return {
      file,
      passed: false,
      duration: Date.now() - start,
      output: e.stdout ?? '',
      error: e.stderr ?? e.message ?? String(err),
    };
  }
}

function formatReport(report: SuiteReport): string {
  const lines: string[] = [
    '',
    '═══════════════════════════════════════════════════════════════',
    ' ServalSheets Simulation Suite Report',
    '═══════════════════════════════════════════════════════════════',
    `  Total categories : ${report.total}`,
    `  Passed           : ${report.passed}`,
    `  Failed           : ${report.failed}`,
    `  Duration         : ${(report.durationMs / 1000).toFixed(1)}s`,
    '───────────────────────────────────────────────────────────────',
  ];

  for (const r of report.results) {
    const icon = r.passed ? '  PASS' : '  FAIL';
    const dur = `${(r.duration / 1000).toFixed(1)}s`;
    lines.push(`${icon}  ${r.file.padEnd(55)} ${dur}`);
    if (!r.passed && r.error) {
      const excerpt = r.error.split('\n').slice(0, 5).join('\n        ');
      lines.push(`        ${excerpt}`);
    }
  }

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(report.failed === 0 ? '  All simulation categories passed.' : `  ${report.failed} categor${report.failed === 1 ? 'y' : 'ies'} failed.`);
  lines.push('');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const jsonMode = process.argv.includes('--json');
  const start = Date.now();
  const results: CategoryResult[] = [];

  console.log(`\nRunning ${SIMULATION_CATEGORIES.length} simulation categories...\n`);

  for (const file of SIMULATION_CATEGORIES) {
    process.stdout.write(`  Running ${file}... `);
    const result = runCategory(file);
    results.push(result);
    console.log(result.passed ? 'PASS' : 'FAIL');
  }

  const report: SuiteReport = {
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    durationMs: Date.now() - start,
    results,
  };

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReport(report));
  }

  process.exit(report.failed > 0 ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error('Simulation runner failed:', err);
  process.exit(1);
});
