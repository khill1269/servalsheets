#!/usr/bin/env node
/**
 * ServalSheets — Action-Alias Registry Guard
 *
 * Verifies `src/schemas/action-aliases.ts:ACTION_ALIASES` is self-consistent:
 *   1. Every key parses as `{toolName}.{oldAction}`.
 *   2. Every `canonical` target exists in `TOOL_ACTIONS[toolName]`.
 *   3. `deprecatedSince` is a valid semver string.
 *   4. If `removeIn` is set it is also valid semver.
 *   5. No entry has `removeIn <= current package version` (stale alias CI gate).
 *
 * Run via: `npm run check:action-aliases`
 *
 * Exit codes:
 *   0 — all aliases healthy
 *   1 — one or more aliases violate a rule (stderr lists each)
 *   2 — invocation error (module load failure, missing file, etc.)
 *
 * Notes on implementation:
 *   - We import the compiled TypeScript modules via `tsx/esm` loader so we
 *     don't need a prior `npm run build`. Matches the pattern used by
 *     scripts/validate-schema-handler-alignment.ts.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = join(dirname(__filename), '..');

// Parse semver strict (MAJOR.MINOR.PATCH with optional -prerelease/+build).
// This matches the format used by deprecatedSince / removeIn fields.
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** Compare two semver strings. Returns -1 / 0 / 1. */
function semverCmp(a, b) {
  const [aMain] = a.split(/[-+]/);
  const [bMain] = b.split(/[-+]/);
  const [a1, a2, a3] = aMain.split('.').map(Number);
  const [b1, b2, b3] = bMain.split('.').map(Number);
  if (a1 !== b1) return a1 < b1 ? -1 : 1;
  if (a2 !== b2) return a2 < b2 ? -1 : 1;
  if (a3 !== b3) return a3 < b3 ? -1 : 1;
  return 0;
}

async function loadPackageVersion() {
  const pkgRaw = await readFile(join(repoRoot, 'package.json'), 'utf8');
  const pkg = JSON.parse(pkgRaw);
  return pkg.version;
}

async function loadModules() {
  // Register tsx's ESM loader at runtime so plain `import()` resolves .ts.
  await import('tsx/esm');
  const aliases = await import(join(repoRoot, 'src/schemas/action-aliases.ts'));
  const completions = await import(join(repoRoot, 'src/mcp/completions.ts'));
  return { aliases, completions };
}

async function main() {
  let pkgVersion;
  let aliases;
  let completions;
  try {
    pkgVersion = await loadPackageVersion();
    ({ aliases, completions } = await loadModules());
  } catch (err) {
    console.error(
      `check-action-aliases: failed to load modules — ${err && err.message ? err.message : err}`
    );
    process.exit(2);
  }

  const ACTION_ALIASES = aliases.ACTION_ALIASES;
  const TOOL_ACTIONS = completions.TOOL_ACTIONS;

  if (!ACTION_ALIASES || typeof ACTION_ALIASES !== 'object') {
    console.error('check-action-aliases: ACTION_ALIASES is not exported or is not an object');
    process.exit(2);
  }
  if (!TOOL_ACTIONS || typeof TOOL_ACTIONS !== 'object') {
    console.error('check-action-aliases: TOOL_ACTIONS is not exported or is not an object');
    process.exit(2);
  }

  const errors = [];
  for (const [key, meta] of Object.entries(ACTION_ALIASES)) {
    const dotIdx = key.indexOf('.');
    if (dotIdx === -1) {
      errors.push(`  ${key}: key must be '{toolName}.{oldAction}'`);
      continue;
    }
    const toolName = key.slice(0, dotIdx);
    const oldAction = key.slice(dotIdx + 1);
    if (!toolName || !oldAction) {
      errors.push(`  ${key}: tool or action segment is empty`);
      continue;
    }
    const validActions = TOOL_ACTIONS[toolName];
    if (!validActions) {
      errors.push(`  ${key}: tool '${toolName}' is not in TOOL_ACTIONS`);
      continue;
    }
    if (!validActions.includes(meta.canonical)) {
      errors.push(
        `  ${key}: canonical '${meta.canonical}' is not in TOOL_ACTIONS[${toolName}] — ` +
          `rename canonical or run 'npm run schema:commit'`
      );
    }
    if (!meta.deprecatedSince || !SEMVER_RE.test(meta.deprecatedSince)) {
      errors.push(
        `  ${key}: deprecatedSince='${meta.deprecatedSince}' is not a valid semver string`
      );
    }
    if (meta.removeIn) {
      if (!SEMVER_RE.test(meta.removeIn)) {
        errors.push(`  ${key}: removeIn='${meta.removeIn}' is not a valid semver string`);
      } else if (semverCmp(meta.removeIn, pkgVersion) <= 0) {
        errors.push(
          `  ${key}: removeIn='${meta.removeIn}' <= package version '${pkgVersion}' — ` +
            `retire this alias or bump removeIn`
        );
      }
    }
    // Alias must not equal canonical (that would be a silent no-op).
    if (oldAction === meta.canonical) {
      errors.push(`  ${key}: oldAction equals canonical — remove the no-op entry`);
    }
  }

  if (errors.length === 0) {
    console.log(
      `action-aliases OK: ${Object.keys(ACTION_ALIASES).length} aliases checked against ${Object.keys(TOOL_ACTIONS).length} tools`
    );
    process.exit(0);
  }

  console.error(`action-aliases FAIL: ${errors.length} issue(s):`);
  for (const line of errors) console.error(line);
  process.exit(1);
}

main().catch((err) => {
  console.error('check-action-aliases: unexpected failure', err);
  process.exit(2);
});
