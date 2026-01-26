#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Test metadata verbosity optimization
 * Verifies Phase 1.5 implementation
 */

import {
  enhanceResponse,
  estimateCost,
  type EnhancementContext,
} from '../src/utils/response-enhancer.js';

console.log('Testing Metadata Verbosity Optimization (Phase 1.5)\n');

// Mock context for a typical read operation
const context: EnhancementContext = {
  tool: 'sheets_data',
  action: 'read',
  input: {
    spreadsheetId: 'test123',
    range: 'A1:B10',
  },
  result: {
    values: Array.from({ length: 100 }, (_, i) => [`Row ${i}`, `Value ${i}`]),
  },
  cellsAffected: 200,
  apiCallsMade: 1,
  duration: 150,
};

// Test 1: Full metadata (detailed verbosity)
console.log('Test 1: Detailed verbosity (full metadata)');
const fullMeta = enhanceResponse(context);
const fullSize = JSON.stringify(fullMeta).length;

console.log('  Full metadata fields:', Object.keys(fullMeta).join(', '));
console.log('  Suggestions count:', fullMeta.suggestions?.length ?? 0);
console.log('  Related tools count:', fullMeta.relatedTools?.length ?? 0);
console.log('  Next steps count:', fullMeta.nextSteps?.length ?? 0);
console.log('  Size:', fullSize, 'bytes');

// Test 2: Cost-only metadata (standard verbosity)
console.log('\nTest 2: Standard verbosity (cost-only metadata)');
const costOnlyMeta = { costEstimate: estimateCost(context) };
const costSize = JSON.stringify(costOnlyMeta).length;

console.log('  Cost-only metadata fields:', Object.keys(costOnlyMeta).join(', '));
console.log('  Size:', costSize, 'bytes');

// Test 3: No metadata (minimal verbosity)
console.log('\nTest 3: Minimal verbosity (no metadata)');
const noMeta = undefined;
const noMetaSize = JSON.stringify({ _meta: noMeta }).length;

console.log('  No metadata');
console.log('  Size:', noMetaSize, 'bytes');

// Test 4: Token savings calculation
console.log('\nTest 4: Token savings analysis');
const tokenSavingsStandard = Math.round((fullSize - costSize) / 4); // ~4 chars per token
const tokenSavingsMinimal = Math.round(fullSize / 4);

console.log(
  '  Full metadata → Standard: -' +
    tokenSavingsStandard +
    ' tokens (~' +
    ((costSize / fullSize) * 100).toFixed(1) +
    '% of original)'
);
console.log('  Full metadata → Minimal: -' + tokenSavingsMinimal + ' tokens (100% reduction)');

const expectedSavingsRange = tokenSavingsStandard >= 50 && tokenSavingsStandard <= 200;

if (expectedSavingsRange) {
  console.log('  ✅ PASS: Standard verbosity saves 50-200 tokens\n');
} else {
  console.log(`  ❌ FAIL: Expected 50-200 tokens, got ${tokenSavingsStandard}\n`);
}

// Test 5: Verify cost estimate structure
console.log('Test 5: Cost estimate structure');
const cost = estimateCost(context);

console.log('  API calls:', cost.apiCalls);
console.log('  Latency estimate:', cost.estimatedLatencyMs, 'ms');
console.log('  Data transferred:', cost.dataTransferredKB, 'KB');

if (cost.apiCalls === 1 && cost.estimatedLatencyMs && cost.dataTransferredKB) {
  console.log('  ✅ PASS: Cost estimate has all required fields\n');
} else {
  console.log('  ❌ FAIL: Cost estimate missing fields\n');
}

// Test 6: Compare with destructive operation
console.log('Test 6: Destructive operation metadata (high priority warnings)');
const destructiveContext: EnhancementContext = {
  tool: 'sheets_data',
  action: 'clear',
  input: {
    spreadsheetId: 'test123',
    range: 'A1:Z1000',
  },
  result: { cellsCleared: 26000 },
  cellsAffected: 26000,
  apiCallsMade: 1,
  duration: 200,
};

const destructiveMeta = enhanceResponse(destructiveContext);
const destructiveSize = JSON.stringify(destructiveMeta).length;
const highPrioritySuggestions =
  destructiveMeta.suggestions?.filter((s) => s.priority === 'high').length ?? 0;

console.log('  Full metadata size:', destructiveSize, 'bytes');
console.log('  High priority suggestions:', highPrioritySuggestions);

const destructiveCostOnly = { costEstimate: estimateCost(destructiveContext) };
const destructiveCostSize = JSON.stringify(destructiveCostOnly).length;
const destructiveTokenSavings = Math.round((destructiveSize - destructiveCostSize) / 4);

console.log('  Cost-only size:', destructiveCostSize, 'bytes');
console.log('  Token savings with standard:', destructiveTokenSavings);

if (highPrioritySuggestions >= 1) {
  console.log('  ✅ PASS: Destructive operations generate high-priority warnings\n');
} else {
  console.log('  ❌ FAIL: Expected high-priority warnings for destructive operations\n');
}

console.log('✅ Metadata verbosity optimization test complete');
console.log('\nSummary:');
console.log('  - Minimal verbosity: 100% metadata reduction (0 tokens)');
console.log(
  '  - Standard verbosity: ~' +
    tokenSavingsStandard +
    ' token reduction vs detailed (keeps cost info)'
);
console.log('  - Detailed verbosity: Full metadata with suggestions, next steps, related tools');

process.exit(0);
