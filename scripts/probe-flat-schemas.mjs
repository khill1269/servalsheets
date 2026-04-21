// Probe: verify per-action JSON schema derivation works end-to-end.
// Usage: NODE_OPTIONS="--max-old-space-size=4096" node scripts/probe-flat-schemas.mjs

import {
  buildFlatInputSchemaForAction,
  clearFlatInputSchemaCache,
} from '../dist/mcp/registration/flat-input-schemas.js';

const cases = [
  // BUG #3: sheets_agent actions require planId, not spreadsheetId
  ['sheets_agent', 'plan', ['description'], ['spreadsheetId']],
  ['sheets_agent', 'execute', ['planId'], []],
  ['sheets_agent', 'get_status', ['planId'], []],
  // BUG #6: list_plans must NOT require spreadsheetId (strict schema rejects it)
  ['sheets_agent', 'list_plans', [], ['spreadsheetId']],
  // BUG #3: sheets_advanced list_named_functions
  ['sheets_advanced', 'list_named_functions', [], []],
  // Smoke: sheets_data.read — ALWAYS_LOADED so this goes through override, but should still work here
  ['sheets_data', 'read', ['spreadsheetId'], []],
  // sheets_analyze.analyze_data
  ['sheets_analyze', 'analyze_data', ['spreadsheetId'], []],
];

clearFlatInputSchemaCache();
let failures = 0;
for (const [tool, action, mustRequire, mustNotHaveRequired] of cases) {
  const schema = buildFlatInputSchemaForAction(tool, action);
  const label = `${tool}.${action}`;
  if (!schema) {
    console.log(`[FAIL ] ${label}: schema derivation returned null`);
    failures++;
    continue;
  }
  const required = new Set(schema.required ?? []);
  const missing = mustRequire.filter((r) => !required.has(r));
  const banned = mustNotHaveRequired.filter((r) => required.has(r));
  if (missing.length || banned.length) {
    console.log(
      `[FAIL ] ${label}: missing=${JSON.stringify(missing)} banned-present=${JSON.stringify(banned)}`
    );
    console.log('        required:', JSON.stringify(schema.required));
    console.log('        props:', Object.keys(schema.properties || {}).join(','));
    failures++;
  } else {
    console.log(`[OK   ] ${label}: required=${JSON.stringify(schema.required ?? [])}`);
  }
}

console.log(failures === 0 ? '\nAll cases passed.' : `\n${failures} case(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
