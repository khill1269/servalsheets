#!/usr/bin/env node
/**
 * ServalSheets — Dist Integrity Check
 *
 * Runs `node --check` on every compiled .js file under dist/ to catch
 * syntax corruption / truncated files / dangling transpile output before
 * the artefact ships. This is a defence-in-depth check because an
 * incomplete `tsc` run can leave behind syntactically invalid files that
 * only fail at module-load time in production.
 *
 * Signals:
 *   - Exit 0: every file parses cleanly
 *   - Exit 1: one or more files fail `node --check` (first 20 errors printed)
 *   - Exit 2: invocation error (missing dist/, etc.)
 *
 * Wire-up:
 *   npm run build && node scripts/verify-dist-integrity.mjs
 *   (intended to run as a postbuild step or from verify:release)
 */

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const scriptDir = join(__filename, '..');
const repoRoot = join(scriptDir, '..');
const distDir = join(repoRoot, 'dist');

/** Concurrency for parallel node --check invocations. */
const CONCURRENCY = 8;

async function collectJsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip common large / irrelevant directories if they ever end up here.
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      results.push(...(await collectJsFiles(full)));
    } else if (entry.isFile() && full.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

function nodeCheck(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--check', file], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (c) => {
      stderr += c.toString('utf8');
    });
    child.on('error', (err) => resolve({ file, ok: false, error: err.message }));
    child.on('close', (code) => {
      if (code === 0) resolve({ file, ok: true });
      else resolve({ file, ok: false, error: stderr.trim() || `exit ${code}` });
    });
  });
}

async function pMap(items, mapper, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await mapper(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

async function main() {
  let files;
  try {
    files = await collectJsFiles(distDir);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      console.error(`dist/ not found at ${distDir}. Run \`npm run build\` first.`);
      process.exit(2);
    }
    throw err;
  }

  if (files.length === 0) {
    console.error(`No .js files found under ${distDir}. Is the build wired correctly?`);
    process.exit(2);
  }

  const started = Date.now();
  const results = await pMap(files, nodeCheck, CONCURRENCY);
  const failures = results.filter((r) => !r.ok);
  const elapsedMs = Date.now() - started;

  if (failures.length === 0) {
    console.log(
      `dist integrity OK: ${files.length} files parsed in ${elapsedMs}ms (concurrency=${CONCURRENCY})`
    );
    process.exit(0);
  }

  console.error(
    `dist integrity FAIL: ${failures.length} / ${files.length} files failed to parse.`
  );
  for (const f of failures.slice(0, 20)) {
    console.error(`  ${relative(repoRoot, f.file)}`);
    if (f.error) {
      const firstLine = f.error.split('\n').find((l) => l.trim()) ?? f.error;
      console.error(`    ${firstLine.trim()}`);
    }
  }
  if (failures.length > 20) {
    console.error(`  ...and ${failures.length - 20} more`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('verify-dist-integrity: unexpected failure', err);
  process.exit(2);
});
