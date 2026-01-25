#!/usr/bin/env tsx
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Test silent failure detection and logging
 * Verifies Phase 1.2 implementation
 */

process.env['METRICS_ENABLED'] = 'true';

import { MetricsService } from '../src/services/metrics.js';
import { logger } from '../src/utils/logger.js';

// Mock logger to capture alerts
const alerts: any[] = [];
const originalError = logger.error;
logger.error = function (message: string, metadata?: any) {
  if (message.includes('[ALERT]')) {
    alerts.push({ message, metadata });
  }
  return originalError.call(this, message, metadata);
} as any;

console.log('Testing Silent Failure Detection (Phase 1.2)\n');

// Test 1: Record confirmation skips
console.log('Test 1: Record confirmation skips');
const metrics = new MetricsService({ enabled: true });

// Simulate 40 safe skips
for (let i = 0; i < 40; i++) {
  metrics.recordConfirmationSkip({
    action: 'sheets_data.read',
    reason: 'elicitation_disabled',
    timestamp: Date.now(),
    spreadsheetId: `spreadsheet-${i}`,
    destructive: false,
  });
}

// Simulate 10 destructive skips (10/50 = 20%, should trigger alert at >10%)
for (let i = 0; i < 10; i++) {
  metrics.recordConfirmationSkip({
    action: 'sheets_data.clear',
    reason: 'elicitation_failed',
    timestamp: Date.now(),
    spreadsheetId: `spreadsheet-${i}`,
    destructive: true,
  });
}

const skipMetrics = metrics.getConfirmationSkipMetrics();
console.log('  Total skips:', skipMetrics.totalSkips);
console.log('  Destructive skips:', skipMetrics.destructiveSkips);
console.log(
  '  Recent destructive rate:',
  (skipMetrics.recentDestructiveRate * 100).toFixed(2) + '%'
);
console.log('  Alert threshold exceeded:', skipMetrics.alertThresholdExceeded);

if (skipMetrics.totalSkips === 50 && skipMetrics.destructiveSkips === 10) {
  console.log('  ✅ PASS: Skip counts are correct\n');
} else {
  console.log(
    `  ❌ FAIL: Expected 50 total, 10 destructive (got ${skipMetrics.totalSkips} total, ${skipMetrics.destructiveSkips} destructive)\n`
  );
}

// Test 2: Alert on high skip rate
console.log('Test 2: Alert on high destructive skip rate');
if (skipMetrics.recentDestructiveRate > 0.1) {
  console.log('  ✅ PASS: Skip rate exceeds 10% threshold\n');
} else {
  console.log('  ❌ FAIL: Skip rate should exceed 10%\n');
}

// Test 3: Alert threshold flag
console.log('Test 3: Alert threshold flag');
if (skipMetrics.alertThresholdExceeded) {
  console.log('  ✅ PASS: Alert threshold flag is set\n');
} else {
  console.log('  ❌ FAIL: Alert threshold should be exceeded\n');
}

// Test 4: Alert was logged
console.log('Test 4: Alert logging');
if (alerts.length > 0) {
  console.log('  ✅ PASS: Alert was logged');
  console.log('  Alert message:', alerts[0].message);
  console.log('  Skip rate:', alerts[0].metadata?.skipRate);
  console.log('  Severity:', alerts[0].metadata?.severity);
} else {
  console.log('  ❌ FAIL: No alert was logged\n');
}

// Test 5: By-action breakdown
console.log('\nTest 5: By-action breakdown');
let foundClearAction = false;
for (const [action, stats] of skipMetrics.byAction.entries()) {
  console.log(`  ${action}: ${stats.count} skips, ${stats.affectedSpreadsheets} spreadsheets`);
  if (action.includes('clear')) {
    foundClearAction = true;
  }
}

if (foundClearAction) {
  console.log('  ✅ PASS: Clear action tracked\n');
} else {
  console.log('  ❌ FAIL: Clear action not found\n');
}

console.log('✅ Silent failure detection test complete');
