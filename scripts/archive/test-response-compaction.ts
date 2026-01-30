#!/usr/bin/env tsx
/**
 * Quick test to verify response compaction integration
 */

// Enable compact mode
process.env['COMPACT_RESPONSES'] = 'true';

import { compactResponse } from '../src/utils/response-compactor.js';

// Test 1: Large array should be truncated
const largeResponse = {
  success: true as const,
  action: 'read',
  values: Array.from({ length: 200 }, (_, i) => [`Row ${i}`, `Value ${i}`]),
};

const compacted = compactResponse(largeResponse, { verbosity: 'standard' });

console.log('Test 1: Large array truncation');
console.log('Original rows:', largeResponse.values.length);
console.log('Compacted structure:', JSON.stringify(compacted, null, 2).substring(0, 500) + '...');

if (
  'values' in compacted &&
  typeof compacted.values === 'object' &&
  compacted.values &&
  '_truncated' in compacted.values
) {
  console.log('✅ PASS: Array was truncated');
} else {
  console.log('❌ FAIL: Array was not truncated');
}

// Test 2: Detailed verbosity should skip truncation
const detailed = compactResponse(largeResponse, { verbosity: 'detailed' });
console.log('\nTest 2: Detailed verbosity');
console.log(
  'With verbosity:detailed, rows:',
  Array.isArray(detailed.values) ? detailed.values.length : 'truncated'
);

if (Array.isArray(detailed.values) && detailed.values.length === 200) {
  console.log('✅ PASS: Detailed verbosity preserved all data');
} else {
  console.log('❌ FAIL: Detailed verbosity did not preserve all data');
}

// Test 3: Small arrays should not be truncated
const smallResponse = {
  success: true as const,
  action: 'read',
  values: [
    ['A', 'B'],
    ['C', 'D'],
  ],
};

const compactedSmall = compactResponse(smallResponse, { verbosity: 'standard' });
console.log('\nTest 3: Small array preservation');
console.log('Small array truncated?', !Array.isArray(compactedSmall.values));

if (Array.isArray(compactedSmall.values) && compactedSmall.values.length === 2) {
  console.log('✅ PASS: Small arrays are not truncated');
} else {
  console.log('❌ FAIL: Small arrays should not be truncated');
}

console.log('\n✅ Response compaction integration verified');
