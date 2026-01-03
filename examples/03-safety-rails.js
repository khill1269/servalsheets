#!/usr/bin/env node
/**
 * ServalSheets Example 3: Safety Rails
 *
 * This example demonstrates ServalSheets' safety features that prevent
 * accidental data loss and enable safe preview of operations.
 *
 * Features demonstrated:
 * - Dry-run mode (preview changes without executing)
 * - Effect scope limits (prevent large-scale accidents)
 * - Expected state validation (optimistic locking)
 * - Auto-snapshots (backup before destructive operations)
 *
 * Prerequisites:
 * - Node.js 22+
 * - npm install servalsheets
 * - GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_ACCESS_TOKEN set
 */

import { google } from 'googleapis';
import crypto from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

const SPREADSHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
const SHEET_NAME = 'Sheet1';

// ============================================================================
// Authentication
// ============================================================================

async function getGoogleAuth() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return auth.getClient();
  }

  if (process.env.GOOGLE_ACCESS_TOKEN) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: process.env.GOOGLE_ACCESS_TOKEN,
    });
    return oauth2Client;
  }

  throw new Error('No credentials found');
}

// ============================================================================
// Safety Feature 1: Dry-Run Mode
// ============================================================================

/**
 * Preview write operation without executing
 */
async function dryRunWrite(sheets, spreadsheetId, range, values) {
  console.log('\n[DRY-RUN] Previewing write operation...');
  console.log(`  Range: ${range}`);
  console.log(`  Rows to write: ${values.length}`);
  console.log(`  Cells to affect: ${values.reduce((sum, row) => sum + row.length, 0)}`);

  // Calculate what would be affected
  const preview = {
    dryRun: true,
    range,
    rowsAffected: values.length,
    cellsAffected: values.reduce((sum, row) => sum + row.length, 0),
    columnsAffected: Math.max(...values.map(row => row.length)),
    dataPreview: values.slice(0, 3), // First 3 rows
  };

  console.log('\nPreview Results:');
  console.log(`  ✓ Would affect ${preview.cellsAffected} cells`);
  console.log(`  ✓ Would write ${preview.rowsAffected} rows`);
  console.log(`  ✓ Would span ${preview.columnsAffected} columns`);
  console.log('\n  First 3 rows of data:');
  preview.dataPreview.forEach((row, i) => {
    console.log(`    Row ${i + 1}: [${row.join(', ')}]`);
  });

  return preview;
}

/**
 * Execute write operation after dry-run approval
 */
async function executeWrite(sheets, spreadsheetId, range, values) {
  console.log('\n[EXECUTE] Performing actual write...');

  try {
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    console.log(`✓ Successfully wrote ${response.data.updatedCells} cells`);
    return response.data;
  } catch (error) {
    console.error(`✗ Write failed: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// Safety Feature 2: Effect Scope Limits
// ============================================================================

/**
 * Validate that operation doesn't exceed safety limits
 */
function validateEffectScope(values, maxCells = 1000, maxRows = 100) {
  console.log('\n[SCOPE CHECK] Validating operation size...');

  const cellCount = values.reduce((sum, row) => sum + row.length, 0);
  const rowCount = values.length;

  console.log(`  Cells to affect: ${cellCount} (limit: ${maxCells})`);
  console.log(`  Rows to affect: ${rowCount} (limit: ${maxRows})`);

  if (cellCount > maxCells) {
    const error = new Error(`Operation would affect ${cellCount} cells, exceeding limit of ${maxCells}`);
    error.code = 'EFFECT_SCOPE_EXCEEDED';
    throw error;
  }

  if (rowCount > maxRows) {
    const error = new Error(`Operation would affect ${rowCount} rows, exceeding limit of ${maxRows}`);
    error.code = 'EFFECT_SCOPE_EXCEEDED';
    throw error;
  }

  console.log('  ✓ Operation within safe limits');
  return { safe: true, cellCount, rowCount };
}

// ============================================================================
// Safety Feature 3: Expected State Validation
// ============================================================================

/**
 * Calculate checksum of current data state
 */
function calculateChecksum(values) {
  const data = JSON.stringify(values);
  return crypto.createHash('md5').update(data).digest('hex').substring(0, 8);
}

/**
 * Read current state and create expected state snapshot
 */
async function captureExpectedState(sheets, spreadsheetId, range) {
  console.log('\n[STATE CAPTURE] Reading current state...');

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const values = response.data.values || [];
    const checksum = calculateChecksum(values);

    const state = {
      range,
      rowCount: values.length,
      columnCount: values.length > 0 ? values[0].length : 0,
      checksum,
      capturedAt: new Date().toISOString(),
    };

    console.log('✓ State captured:');
    console.log(`  Rows: ${state.rowCount}`);
    console.log(`  Columns: ${state.columnCount}`);
    console.log(`  Checksum: ${state.checksum}`);
    console.log(`  Captured at: ${state.capturedAt}`);

    return state;
  } catch (error) {
    console.error(`✗ Failed to capture state: ${error.message}`);
    throw error;
  }
}

/**
 * Validate that current state matches expected state
 */
async function validateExpectedState(sheets, spreadsheetId, expectedState) {
  console.log('\n[STATE VALIDATION] Verifying data hasn\'t changed...');

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: expectedState.range,
    });

    const currentValues = response.data.values || [];
    const currentChecksum = calculateChecksum(currentValues);

    console.log(`  Expected checksum: ${expectedState.checksum}`);
    console.log(`  Current checksum:  ${currentChecksum}`);
    console.log(`  Expected rows:     ${expectedState.rowCount}`);
    console.log(`  Current rows:      ${currentValues.length}`);

    if (currentChecksum !== expectedState.checksum) {
      const error = new Error('Data has changed since last read. Please refresh and retry.');
      error.code = 'PRECONDITION_FAILED';
      throw error;
    }

    console.log('  ✓ State matches - safe to proceed');
    return true;
  } catch (error) {
    if (error.code === 'PRECONDITION_FAILED') {
      console.error('  ✗ State mismatch - data was modified by another user/process');
    }
    throw error;
  }
}

// ============================================================================
// Safety Feature 4: Auto-Snapshots
// ============================================================================

/**
 * Create snapshot of data before destructive operation
 */
async function createSnapshot(sheets, spreadsheetId, range, operation) {
  console.log('\n[SNAPSHOT] Creating backup before operation...');

  try {
    // Read current data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const snapshot = {
      id: crypto.randomUUID(),
      operation,
      range,
      data: response.data.values || [],
      createdAt: new Date().toISOString(),
    };

    console.log(`✓ Snapshot created: ${snapshot.id}`);
    console.log(`  Operation: ${operation}`);
    console.log(`  Range: ${range}`);
    console.log(`  Rows backed up: ${snapshot.data.length}`);
    console.log(`  Created at: ${snapshot.createdAt}`);

    return snapshot;
  } catch (error) {
    console.error(`✗ Failed to create snapshot: ${error.message}`);
    throw error;
  }
}

/**
 * Restore data from snapshot
 */
async function restoreSnapshot(sheets, spreadsheetId, snapshot) {
  console.log('\n[RESTORE] Restoring from snapshot...');
  console.log(`  Snapshot ID: ${snapshot.id}`);
  console.log(`  Original operation: ${snapshot.operation}`);

  try {
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: snapshot.range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: snapshot.data,
      },
    });

    console.log(`✓ Restored ${response.data.updatedCells} cells`);
    console.log(`  Original timestamp: ${snapshot.createdAt}`);
    return response.data;
  } catch (error) {
    console.error(`✗ Failed to restore: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// Demo Setup
// ============================================================================

async function setupDemoData(sheets, spreadsheetId, sheetName) {
  console.log('\n[SETUP] Creating demo data...');

  const demoData = [
    ['ID', 'Name', 'Status', 'Value'],
    ['1', 'Alice', 'Active', '100'],
    ['2', 'Bob', 'Active', '200'],
    ['3', 'Carol', 'Inactive', '150'],
    ['4', 'David', 'Active', '300'],
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1:D5`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: demoData },
  });

  console.log('✓ Demo data created');
}

// ============================================================================
// Main Example
// ============================================================================

async function main() {
  console.log('=== ServalSheets Example: Safety Rails ===\n');
  console.log(`Spreadsheet ID: ${SPREADSHEET_ID}`);
  console.log(`Sheet: ${SHEET_NAME}`);

  try {
    // Initialize
    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Setup demo data
    await setupDemoData(sheets, SPREADSHEET_ID, SHEET_NAME);

    // ========================================================================
    // Example 1: Dry-Run Mode
    // ========================================================================
    console.log('\n--- Example 1: Dry-Run Preview ---');

    const updateRange = `${SHEET_NAME}!C2:C5`;
    const updateData = [
      ['Pending'],
      ['Pending'],
      ['Active'],
      ['Pending'],
    ];

    // Preview the operation
    const preview = await dryRunWrite(sheets, SPREADSHEET_ID, updateRange, updateData);

    // User would review preview and approve
    console.log('\n[USER DECISION] Preview looks good, executing...');

    // Execute the operation
    await executeWrite(sheets, SPREADSHEET_ID, updateRange, updateData);

    // ========================================================================
    // Example 2: Effect Scope Validation
    // ========================================================================
    console.log('\n--- Example 2: Effect Scope Limits ---');

    // Small operation (should pass)
    const smallData = [['A'], ['B'], ['C']];
    try {
      validateEffectScope(smallData, 1000, 100);
      console.log('  ✓ Small operation approved');
    } catch (error) {
      console.error(`  ✗ Unexpected rejection: ${error.message}`);
    }

    // Large operation (should fail)
    const largeData = Array(200).fill().map(() => ['X', 'Y', 'Z']);
    try {
      validateEffectScope(largeData, 1000, 100);
      console.error('  ✗ Large operation should have been rejected!');
    } catch (error) {
      console.log(`  ✓ Large operation correctly rejected: ${error.message}`);
    }

    // ========================================================================
    // Example 3: Expected State Validation (Optimistic Locking)
    // ========================================================================
    console.log('\n--- Example 3: Expected State Validation ---');

    const lockRange = `${SHEET_NAME}!A1:D5`;

    // Capture current state
    const expectedState = await captureExpectedState(sheets, SPREADSHEET_ID, lockRange);

    // Simulate some time passing
    console.log('\n[SIMULATION] Time passes... other processes might have modified data...');
    await new Promise(resolve => setTimeout(resolve, 100));

    // Validate state before write
    try {
      await validateExpectedState(sheets, SPREADSHEET_ID, expectedState);
      console.log('  ✓ Safe to proceed with update');
    } catch (error) {
      console.error(`  ✗ Update aborted: ${error.message}`);
    }

    // ========================================================================
    // Example 4: State Mismatch Detection
    // ========================================================================
    console.log('\n--- Example 4: Detecting State Changes ---');

    // Capture state
    const state1 = await captureExpectedState(sheets, SPREADSHEET_ID, lockRange);

    // Modify data (simulating another user/process)
    console.log('\n[SIMULATION] Another process modifies the data...');
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!D2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['999']] },
    });

    // Try to validate (should fail)
    try {
      await validateExpectedState(sheets, SPREADSHEET_ID, state1);
      console.error('  ✗ Should have detected state change!');
    } catch (error) {
      console.log('  ✓ State change detected successfully');
      console.log(`    Error: ${error.message}`);
    }

    // ========================================================================
    // Example 5: Auto-Snapshot and Restore
    // ========================================================================
    console.log('\n--- Example 5: Snapshot & Restore ---');

    const snapshotRange = `${SHEET_NAME}!A1:D5`;

    // Create snapshot before destructive operation
    const snapshot = await createSnapshot(
      sheets,
      SPREADSHEET_ID,
      snapshotRange,
      'Batch status update'
    );

    // Perform destructive operation
    console.log('\n[OPERATION] Performing destructive update...');
    const destructiveData = [
      ['ID', 'Name', 'Status', 'Value'],
      ['1', 'DELETED', 'Inactive', '0'],
      ['2', 'DELETED', 'Inactive', '0'],
      ['3', 'DELETED', 'Inactive', '0'],
      ['4', 'DELETED', 'Inactive', '0'],
    ];
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: snapshotRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: destructiveData },
    });
    console.log('  ✓ Destructive update complete');

    // Oops! Need to undo
    console.log('\n[OOPS] That was a mistake! Restoring from snapshot...');
    await new Promise(resolve => setTimeout(resolve, 500));
    await restoreSnapshot(sheets, SPREADSHEET_ID, snapshot);

    // Verify restoration
    const restored = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: snapshotRange,
    });
    console.log('\n  Verification: First row after restore:');
    console.log(`    [${restored.data.values[1].join(', ')}]`);

    // ========================================================================
    // Example 6: Complete Safe Update Workflow
    // ========================================================================
    console.log('\n--- Example 6: Complete Safe Workflow ---');
    console.log('Demonstrating all safety features together:\n');

    const safeRange = `${SHEET_NAME}!C2:C5`;
    const safeData = [['Complete'], ['Complete'], ['Complete'], ['Complete']];

    // Step 1: Dry-run
    console.log('Step 1: Preview changes (dry-run)');
    const safePreview = await dryRunWrite(sheets, SPREADSHEET_ID, safeRange, safeData);

    // Step 2: Validate scope
    console.log('\nStep 2: Validate effect scope');
    validateEffectScope(safeData, 1000, 100);

    // Step 3: Capture expected state
    console.log('\nStep 3: Capture current state');
    const safeState = await captureExpectedState(sheets, SPREADSHEET_ID, safeRange);

    // Step 4: Create snapshot
    console.log('\nStep 4: Create snapshot');
    const safeSnapshot = await createSnapshot(sheets, SPREADSHEET_ID, safeRange, 'Safe update');

    // Step 5: Validate state hasn't changed
    console.log('\nStep 5: Validate state (optimistic lock)');
    await validateExpectedState(sheets, SPREADSHEET_ID, safeState);

    // Step 6: Execute
    console.log('\nStep 6: Execute update');
    await executeWrite(sheets, SPREADSHEET_ID, safeRange, safeData);

    console.log('\n✓ All safety checks passed - update successful!');

    // ========================================================================
    // Success!
    // ========================================================================
    console.log('\n=== Example Complete ===');
    console.log('\nKey Takeaways:');
    console.log('  1. Always preview changes with dry-run before executing');
    console.log('  2. Set effect scope limits to prevent accidents');
    console.log('  3. Use expected state validation to detect concurrent modifications');
    console.log('  4. Create snapshots before destructive operations');
    console.log('  5. Combine all features for maximum safety in production');
    console.log('  6. Safety rails add minimal overhead but prevent disasters');

  } catch (error) {
    console.error('\n=== Example Failed ===');
    console.error(`Error: ${error.message}`);
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    process.exit(1);
  }
}

// Run the example
main();
