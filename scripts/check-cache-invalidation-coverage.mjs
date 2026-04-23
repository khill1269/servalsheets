#!/usr/bin/env node
/**
 * CI Gate: Cache Invalidation Rule Coverage
 *
 * Every (tool, action) pair surfaced through TOOL_ACTIONS must have a
 * matching rule in CacheInvalidationGraph.buildInvalidationRules().
 * Missing rules silently fall through to `{ invalidates: [] }` at
 * runtime, so stale caches survive mutations — a correctness bug with
 * no logs to trace.
 *
 * This script parses both sources statically and exits non-zero if
 * anything is missing. Known-OK gaps (rare; typically for new tools
 * that hadn't been wired yet) must be added to the KNOWN_MISSING
 * allowlist below with a short justification.
 *
 * Usage: node scripts/check-cache-invalidation-coverage.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Allowlist: known (tool.action) keys that intentionally lack a rule.
// Every entry needs a short justification.
//
// The entries captured at gate introduction all share the same reason:
// "pre-existing gap at coverage-gate introduction" — a systematic
// audit of buildInvalidationRules() vs TOOL_ACTIONS found these 171
// tool-action pairs with no rule. They are intentionally frozen here so
// the gate catches *new* drift, while follow-up work can burn down the
// existing backlog tool-by-tool.
//
// When you wire a rule in src/services/cache-invalidation-graph.ts,
// delete the matching entry below.
// ---------------------------------------------------------------------------
const DEFAULT_REASON = 'pre-existing gap at coverage-gate introduction';
const KNOWN_MISSING = new Map([
  // All 171 previously-missing rules have been wired to cache-invalidation-graph.ts
  // (follow-up to e544e19d). This allowlist is now empty — any NEW drift will fail the gate.

]);

// ---------------------------------------------------------------------------
// Parse TOOL_ACTIONS from the generated completions file.
// ---------------------------------------------------------------------------
function loadToolActions() {
  const src = readFileSync(resolve(ROOT, 'src/generated/completions.ts'), 'utf8');
  const blockMatch = src.match(
    /export const TOOL_ACTIONS[^=]*=\s*\{([\s\S]*?)\n\};/
  );
  if (!blockMatch) {
    console.error('  error: Could not find TOOL_ACTIONS export in src/generated/completions.ts');
    process.exit(1);
  }
  const block = blockMatch[1];

  // Match each `tool_name: [ 'a', 'b', ... ]`.
  const toolRe = /(sheets_[a-z_]+)\s*:\s*\[([\s\S]*?)\],?\n/g;
  const pairs = [];
  let m;
  while ((m = toolRe.exec(block)) !== null) {
    const tool = m[1];
    const body = m[2];
    for (const actionMatch of body.matchAll(/'([^']+)'/g)) {
      pairs.push(`${tool}.${actionMatch[1]}`);
    }
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// Parse rule keys from cache-invalidation-graph.ts
// Pattern: rules['sheets_x.action'] = { invalidates: [...] };
// ---------------------------------------------------------------------------
function loadRuleKeys() {
  const src = readFileSync(resolve(ROOT, 'src/services/cache-invalidation-graph.ts'), 'utf8');
  const keys = new Set();
  for (const m of src.matchAll(/rules\[\s*'(sheets_[a-z_]+\.[a-z_0-9]+)'\s*\]\s*=/g)) {
    keys.add(m[1]);
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('=======================================================');
console.log('  Cache Invalidation Rule Coverage Check');
console.log('=======================================================\n');

const expectedKeys = loadToolActions();
const ruleKeys = loadRuleKeys();

console.log(`  TOOL_ACTIONS pairs:    ${expectedKeys.length}`);
console.log(`  cache-graph rule keys: ${ruleKeys.size}`);
console.log(`  allowlisted gaps:      ${KNOWN_MISSING.size}\n`);

const missing = [];
for (const key of expectedKeys) {
  if (ruleKeys.has(key)) continue;
  if (KNOWN_MISSING.has(key)) continue;
  missing.push(key);
}

if (missing.length === 0) {
  console.log('  result: PASS — every tool.action has a cache-invalidation rule');
  console.log('\n=======================================================');
  process.exit(0);
}

console.log(`  result: FAIL — ${missing.length} tool.action pair(s) have no cache-invalidation rule:\n`);
console.log('    key');
console.log('    -----------------------------------------------');
for (const key of missing.sort()) {
  console.log(`    ${key}`);
}
console.log('\n  To fix:');
console.log('    1. Add a rule to buildInvalidationRules() in');
console.log('       src/services/cache-invalidation-graph.ts. Use');
console.log('       { invalidates: [] } for read-only actions, or a pattern like');
console.log("       { invalidates: ['values:*'] } / { invalidates: ['metadata:*'] } for mutations.");
console.log('    2. If an action is legitimately out of scope, add it to KNOWN_MISSING');
console.log('       in this script with a justification.');
console.log('\n=======================================================');
process.exit(1);
