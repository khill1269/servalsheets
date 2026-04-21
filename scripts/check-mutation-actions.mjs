#!/usr/bin/env node
/**
 * CI Check: Mutation Action Alignment
 *
 * Validates that:
 *   1. Both `src/middleware/audit-middleware.ts` and
 *      `src/middleware/write-lock-middleware.ts` derive their `MUTATION_ACTIONS`
 *      Set from the canonical `MUTATION_ACTION_NAMES` tuple in
 *      `src/middleware/mutation-actions.constants.ts` (no inline literals).
 *   2. `FORCE_WRITE_ACTIONS` in write-lock-middleware does not overlap with the
 *      canonical mutation list.
 *   3. The cache invalidation graph has rules for all declared mutations.
 *
 * Before the de-duplication refactor, Check 1 compared two independently-declared
 * inline Set literals for equality. Drift is now impossible by construction,
 * so Check 1 now verifies both files continue to derive from the shared source.
 *
 * Usage: node scripts/check-mutation-actions.mjs
 * Exit code 0 = aligned, 1 = misaligned (CI gate failure)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Parse sets from source files (AST-free: regex over source text)
// ---------------------------------------------------------------------------

function extractSetEntries(filePath, setName) {
  const src = readFileSync(resolve(ROOT, filePath), 'utf8');
  // Match: export const SET_NAME = new Set<...>([\n  'entry1',\n  'entry2',\n]);
  const re = new RegExp(
    `export\\s+const\\s+${setName}\\s*=\\s*new\\s+Set[^(]*\\(\\[([\\s\\S]*?)\\]\\)`,
    'm'
  );
  const match = src.match(re);
  if (!match) {
    console.error(`  ❌ Could not find ${setName} in ${filePath}`);
    process.exit(1);
  }
  const entries = [];
  for (const m of match[1].matchAll(/'([^']+)'/g)) {
    entries.push(m[1]);
  }
  return new Set(entries);
}

/**
 * Extract the canonical MUTATION_ACTION_NAMES tuple from the shared constants file.
 */
function extractCanonicalMutationNames() {
  const src = readFileSync(
    resolve(ROOT, 'src/middleware/mutation-actions.constants.ts'),
    'utf8'
  );
  const match = src.match(
    /export const MUTATION_ACTION_NAMES[\s\S]*?=\s*\[([\s\S]*?)\]\s*as\s+const/
  );
  if (!match) {
    console.error(
      '  ❌ Could not find MUTATION_ACTION_NAMES in src/middleware/mutation-actions.constants.ts'
    );
    process.exit(1);
  }
  const entries = [];
  for (const m of match[1].matchAll(/'([^']+)'/g)) {
    entries.push(m[1]);
  }
  return new Set(entries);
}

/**
 * Verify that a middleware file derives its MUTATION_ACTIONS Set from the
 * shared canonical names list (not from a local inline array).
 */
function derivesFromCanonical(filePath) {
  const src = readFileSync(resolve(ROOT, filePath), 'utf8');
  return (
    src.includes('MUTATION_ACTION_NAMES') &&
    /new Set[^(]*\(\s*MUTATION_ACTION_NAMES\s*\)/.test(src)
  );
}

function extractCacheInvalidationMutations(filePath) {
  const src = readFileSync(resolve(ROOT, filePath), 'utf8');
  const mutations = new Set();
  // Match: rules['tool.action'] = { invalidates: ['something'] };
  // Skip lines where invalidates is empty []
  const re = /rules\['([^']+)'\]\s*=\s*\{\s*invalidates:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const key = m[1];       // e.g. 'sheets_data.write'
    const deps = m[2].trim(); // e.g. "'values:*'" or ""
    if (deps.length > 0) {
      // This action has cache invalidation = it's a mutation
      const action = key.split('.')[1];
      if (action) mutations.add(action);
    }
  }
  return mutations;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('═══════════════════════════════════════════════════════');
console.log('  Mutation Action Alignment Check');
console.log('═══════════════════════════════════════════════════════\n');

const canonicalMutations = extractCanonicalMutationNames();
const writeLockForce = extractSetEntries(
  'src/middleware/write-lock-middleware.ts',
  'FORCE_WRITE_ACTIONS'
);

console.log(`  Canonical MUTATION_ACTION_NAMES: ${canonicalMutations.size} entries`);
console.log(`  Write-lock FORCE_WRITE:           ${writeLockForce.size} entries`);

let failures = 0;

// Check 1: both middleware files must derive from the canonical names list,
// not declare their own inline literals (which is how drift used to creep in).
const auditDerives = derivesFromCanonical('src/middleware/audit-middleware.ts');
const writeLockDerives = derivesFromCanonical('src/middleware/write-lock-middleware.ts');

if (!auditDerives || !writeLockDerives) {
  console.log('\n❌ Check 1: middleware no longer derives from MUTATION_ACTION_NAMES');
  if (!auditDerives) {
    console.log(
      '   src/middleware/audit-middleware.ts is missing `new Set<...>(MUTATION_ACTION_NAMES)`'
    );
  }
  if (!writeLockDerives) {
    console.log(
      '   src/middleware/write-lock-middleware.ts is missing `new Set<string>(MUTATION_ACTION_NAMES)`'
    );
  }
  console.log(
    '   Restoring an inline literal would re-open the ISSUE-231 drift class.'
  );
  failures++;
} else {
  console.log(
    '\n✅ Check 1: both middleware files derive MUTATION_ACTIONS from the canonical list'
  );
}

// Check 2: no overlap between canonical mutations and FORCE_WRITE_ACTIONS
const overlap = [...canonicalMutations].filter((a) => writeLockForce.has(a));
if (overlap.length > 0) {
  console.log(`\n❌ Check 2: overlap between MUTATION_ACTION_NAMES and FORCE_WRITE: ${overlap.join(', ')}`);
  failures++;
} else {
  console.log('✅ Check 2: no overlap between MUTATION_ACTION_NAMES and FORCE_WRITE_ACTIONS');
}

// Check 3: cache invalidation graph covers all declared mutations
const cacheMutations = extractCacheInvalidationMutations(
  'src/services/cache-invalidation-graph.ts'
);
console.log(`\n  Cache invalidation mutations: ${cacheMutations.size} entries`);

const allDeclared = new Set([...canonicalMutations, ...writeLockForce]);
const missingCacheRules = [...allDeclared].filter((a) => !cacheMutations.has(a));
// Filter out actions that are mutations but don't touch spreadsheet data directly
// (e.g. transaction management, webhook ops, auth ops)
const exemptActions = new Set([
  'begin', 'queue', 'commit', 'rollback', 'abort', 'status',  // transaction
  'register', 'unregister', 'test',                             // webhook
  'login', 'logout', 'callback',                                // auth
  'configure', 'setup_feature',                                  // connectors
  'plan', 'execute', 'execute_step',                            // agent
  'undo', 'redo', 'revert_to',                                   // history
  'set_active', 'set_context',                                   // session
]);
const genuinelyMissing = missingCacheRules.filter((a) => !exemptActions.has(a));

if (genuinelyMissing.length > 0) {
  console.log(`\n⚠️  Check 3: ${genuinelyMissing.length} mutation(s) missing cache invalidation rules:`);
  for (const a of genuinelyMissing.sort()) {
    console.log(`   - ${a}`);
  }
  // Warning only — not all mutations need cache rules (e.g. create in new spreadsheet)
} else {
  console.log('✅ Check 3: all non-exempt mutations have cache invalidation rules');
}

console.log('\n═══════════════════════════════════════════════════════');
if (failures > 0) {
  console.log(`  ❌ ${failures} CHECK(S) FAILED`);
  console.log('═══════════════════════════════════════════════════════');
  process.exit(1);
} else {
  console.log('  ✅ ALL CHECKS PASSED');
  console.log('═══════════════════════════════════════════════════════');
}
