#!/usr/bin/env node
/**
 * CI guard: verify src/version.ts VERSION constant matches package.json "version" field.
 *
 * Prevents the drift observed in the audit where:
 *   - package.json      was 2.0.0
 *   - src/version.ts    was 2.0.0 (OK)
 *   - skill/SKILL.md    claimed 1.6.0
 *   - src/server/health.ts fallback was '1.4.0'
 *
 * Run in CI via `npm run verify:version`. Exits 1 on mismatch.
 *
 * Non-goals: does NOT handle pre-release tags or monorepo sub-packages.
 *   Extend if those become relevant.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
const versionTs = readFileSync(join(repoRoot, 'src/version.ts'), 'utf8');

const match = versionTs.match(/export const VERSION = ['"]([^'"]+)['"]/);
if (!match) {
  console.error('❌ Could not locate VERSION constant in src/version.ts');
  process.exit(1);
}

const tsVersion = match[1];
const pkgVersion = pkg.version;

if (tsVersion !== pkgVersion) {
  console.error(
    `❌ Version drift detected:\n` +
    `   package.json      : ${pkgVersion}\n` +
    `   src/version.ts    : ${tsVersion}\n` +
    `   Fix: update src/version.ts VERSION = '${pkgVersion}'`
  );
  process.exit(1);
}

console.log(`✅ Versions aligned: ${pkgVersion}`);
