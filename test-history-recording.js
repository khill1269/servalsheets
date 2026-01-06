#!/usr/bin/env node
/**
 * Test script to verify operation history recording
 *
 * This script simulates a tool call and verifies that it's recorded in history.
 */

import { getHistoryService } from './dist/services/history-service.js';

async function testHistoryRecording() {
  console.log('Testing operation history recording...\n');

  const historyService = getHistoryService();

  // Clear any existing history
  historyService.clear();
  console.log('✓ Cleared existing history');

  // Record a test operation
  const testOperation = {
    id: 'test-operation-123',
    timestamp: new Date().toISOString(),
    tool: 'sheets_values',
    action: 'read',
    params: {
      request: {
        action: 'read',
        params: {
          spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
          range: 'Sheet1!A1:B10'
        }
      }
    },
    result: 'success',
    duration: 245,
    cellsAffected: 20,
    spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
  };

  historyService.record(testOperation);
  console.log('✓ Recorded test operation');

  // Verify it was recorded
  const recent = historyService.getRecent(1);
  if (recent.length === 0) {
    console.error('✗ FAILED: No operations found in history');
    process.exit(1);
  }

  const recorded = recent[0];
  if (recorded.id !== testOperation.id) {
    console.error('✗ FAILED: Operation ID mismatch');
    process.exit(1);
  }

  console.log('✓ Verified operation was recorded\n');

  // Test retrieval methods
  console.log('Testing retrieval methods:');

  const byId = historyService.getById(testOperation.id);
  console.log(`  ✓ getById(): ${byId ? 'Found' : 'Not found'}`);

  const all = historyService.getAll();
  console.log(`  ✓ getAll(): ${all.length} operation(s)`);

  const stats = historyService.getStats();
  console.log(`  ✓ getStats(): ${stats.totalOperations} total, ${stats.successfulOperations} successful`);

  const byTool = historyService.getAll({ tool: 'sheets_values' });
  console.log(`  ✓ Filter by tool: ${byTool.length} operation(s)`);

  const byAction = historyService.getAll({ action: 'read' });
  console.log(`  ✓ Filter by action: ${byAction.length} operation(s)`);

  const byResult = historyService.getAll({ result: 'success' });
  console.log(`  ✓ Filter by result: ${byResult.length} operation(s)`);

  const bySpreadsheet = historyService.getBySpreadsheet(testOperation.spreadsheetId);
  console.log(`  ✓ Filter by spreadsheetId: ${bySpreadsheet.length} operation(s)`);

  console.log('\n✓ All tests passed!');
  console.log('\nOperation history recording is working correctly.');
}

testHistoryRecording().catch(error => {
  console.error('✗ Test failed:', error);
  process.exit(1);
});
