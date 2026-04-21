// Probe: BUG #4 (sanitize undefined in fixableVia.params) and BUG #5 (no remote fallback when remote disabled)

import { suggestFix } from '../dist/services/error-fix-suggester.js';

console.log('--- BUG #4: sanitize undefined params ---');

// FEATURE_UNAVAILABLE with no spreadsheetId in context → must NOT produce {spreadsheetId: undefined}
const fix1 = suggestFix('FEATURE_UNAVAILABLE', 'not supported');
console.log('fix1:', JSON.stringify(fix1, null, 2));
if (fix1 && 'spreadsheetId' in fix1.params && fix1.params.spreadsheetId === undefined) {
  console.log('[FAIL] params.spreadsheetId is undefined — schema will reject');
  process.exit(1);
}
console.log('[OK  ] no undefined values in params');

// With spreadsheetId in context, it should be preserved
const fix2 = suggestFix('FEATURE_UNAVAILABLE', 'not supported', 'sheets_advanced', 'list_named_functions', { spreadsheetId: 'abc123' });
console.log('fix2:', JSON.stringify(fix2, null, 2));
if (!fix2 || fix2.params.spreadsheetId !== 'abc123') {
  console.log('[FAIL] spreadsheetId not preserved');
  process.exit(1);
}
console.log('[OK  ] spreadsheetId preserved');

// Now check a few more branches that previously had undefined issues
const cases = [
  ['NOT_FOUND', 'not found'],
  ['CIRCULAR_REFERENCE', 'circular'],
  ['PROTECTED_RANGE', 'protected'],
  ['BATCH_UPDATE_FAILED', 'batch failed'],
];
for (const [code, msg] of cases) {
  const f = suggestFix(code, msg);
  if (!f) continue;
  const undefinedKeys = Object.entries(f.params).filter(([, v]) => v === undefined).map(([k]) => k);
  if (undefinedKeys.length > 0) {
    console.log(`[FAIL] ${code}: params still has undefined: ${undefinedKeys.join(',')}`);
    process.exit(1);
  }
  console.log(`[OK  ] ${code}: params clean (${Object.keys(f.params).length} keys)`);
}

console.log('\n--- BUG #5: no remote failover when remote disabled ---');

// Note: This is tested indirectly via dispatchToolCall, but we can at least
// verify that isRemoteMcpExecutorToolEnabled returns false when not configured.
const { isRemoteMcpExecutorToolEnabled } = await import('../dist/services/remote-mcp-tool-client.js');
// Clear env to simulate no remote config
delete process.env.REMOTE_MCP_EXECUTOR_URL;
delete process.env.REMOTE_MCP_EXECUTOR_ENABLED;
const enabled = isRemoteMcpExecutorToolEnabled('sheets_analyze');
console.log('isRemoteMcpExecutorToolEnabled(sheets_analyze):', enabled);
if (enabled) {
  console.log('[FAIL] remote executor claims enabled without config');
  process.exit(1);
}
console.log('[OK  ] remote not enabled by default');

console.log('\nAll BUG #4 and BUG #5 probes passed.');
