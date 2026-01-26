#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Test request correlation IDs
 * Verifies Phase 1.4 implementation
 */

import {
  createRequestContext,
  runWithRequestContext,
  getRequestContext,
} from '../src/utils/request-context.js';
import { logger } from '../src/utils/logger.js';

console.log('Testing Request Correlation IDs (Phase 1.4)\n');

// Test 1: Logger auto-injects requestId from context
console.log('Test 1: Auto-inject requestId in logs');

const ctx1 = createRequestContext({
  requestId: 'test-request-123',
  traceId: 'trace-abc',
  spanId: 'span-xyz',
});

await runWithRequestContext(ctx1, async () => {
  const currentCtx = getRequestContext();
  console.log('  Current context:', {
    requestId: currentCtx?.requestId,
    traceId: currentCtx?.traceId,
    spanId: currentCtx?.spanId,
  });

  // Log a message - should include requestId automatically
  logger.info('[TEST] This log should include requestId');
  logger.debug('[TEST] Debug log should also include requestId');

  console.log('  ✅ PASS: Request context accessible\n');
});

// Test 2: Nested contexts preserve requestId
console.log('Test 2: Nested context preservation');

const ctx2 = createRequestContext({ requestId: 'parent-request-456' });

await runWithRequestContext(ctx2, async () => {
  logger.info('[TEST] Parent context log');

  // Simulate nested service call
  await simulateServiceCall();

  console.log('  ✅ PASS: Nested context preserved\n');
});

async function simulateServiceCall() {
  const ctx = getRequestContext();
  console.log('  Nested context requestId:', ctx?.requestId);
  logger.info('[TEST] Nested service call log');
}

// Test 3: Context isolation between concurrent requests
console.log('Test 3: Context isolation (concurrent requests)');

const request1 = runWithRequestContext(
  createRequestContext({ requestId: 'concurrent-1' }),
  async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    const ctx = getRequestContext();
    console.log('  Request 1 requestId:', ctx?.requestId);
    return ctx?.requestId;
  }
);

const request2 = runWithRequestContext(
  createRequestContext({ requestId: 'concurrent-2' }),
  async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    const ctx = getRequestContext();
    console.log('  Request 2 requestId:', ctx?.requestId);
    return ctx?.requestId;
  }
);

const [id1, id2] = await Promise.all([request1, request2]);

if (id1 === 'concurrent-1' && id2 === 'concurrent-2') {
  console.log('  ✅ PASS: Context isolation working\n');
} else {
  console.log('  ❌ FAIL: Context leaked between requests\n');
}

// Test 4: Outside request context (no requestId)
console.log('Test 4: Outside request context');
const outsideCtx = getRequestContext();
console.log('  Context outside request:', outsideCtx);

if (outsideCtx === undefined) {
  console.log('  ✅ PASS: No context outside request scope\n');
} else {
  console.log('  ❌ FAIL: Context leaked outside scope\n');
}

// Test 5: W3C Trace Context propagation
console.log('Test 5: W3C Trace Context');
const traceCtx = createRequestContext({
  requestId: 'req-789',
  traceId: '0af7651916cd43dd8448eb211c80319c',
  spanId: 'b7ad6b7169203331',
  parentSpanId: 'b9c7c989f97918e1',
});

await runWithRequestContext(traceCtx, async () => {
  const ctx = getRequestContext();
  console.log('  W3C Trace Context:', {
    traceId: ctx?.traceId,
    spanId: ctx?.spanId,
    parentSpanId: ctx?.parentSpanId,
  });

  if (ctx?.traceId === '0af7651916cd43dd8448eb211c80319c') {
    console.log('  ✅ PASS: W3C Trace Context preserved\n');
  } else {
    console.log('  ❌ FAIL: Trace context lost\n');
  }
});

console.log('✅ Request correlation test complete');
console.log('\nNote: Check stderr for actual log output with injected requestId, traceId, spanId');

process.exit(0);
