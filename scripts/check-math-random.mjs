#!/usr/bin/env node
/**
 * Guard against Math.random() usage in test files.
 *
 * Non-deterministic data in tests (Math.random(), new Date()) produces results
 * that differ between runs, masking real failures and making CI flaky.
 * Tests must use fixed, deterministic values. See ISSUE-237 in CLAUDE.md.
 *
 * Allowlist exceptions via inline comment: // check-math-random-ok
 */

import { readFileSync } from 'fs';
import pkg from 'glob';
const { sync: globSync } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Only scan unit and contract tests. Chaos/benchmark/load/e2e tests legitimately
// use Math.random() for probabilistic simulation and are excluded.
const TEST_GLOBS = [
  'tests/handlers/**/*.ts',
  'tests/contracts/**/*.ts',
  'tests/services/**/*.ts',
  'tests/mcp/**/*.ts',
  'tests/unit/**/*.ts',
  'src/**/*.test.ts',
  'src/**/*.spec.ts',
];

const files = TEST_GLOBS.flatMap((g) => globSync(g, { cwd: root, absolute: true }));

const violations = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('Math.random()') && !line.includes('check-math-random-ok')) {
      violations.push({ file: path.relative(root, file), line: i + 1, text: line.trim() });
    }
  }
}

if (violations.length === 0) {
  console.log('check-math-random: OK — no Math.random() usage in test files');
  process.exit(0);
} else {
  console.error(`check-math-random: FAIL — ${violations.length} violation(s) found`);
  console.error('');
  console.error('Math.random() produces non-deterministic test data (ISSUE-237).');
  console.error('Replace with fixed values. To allow a specific line, add: // check-math-random-ok');
  console.error('');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.text}`);
  }
  process.exit(1);
}
