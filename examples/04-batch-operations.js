#!/usr/bin/env node
/**
 * ServalSheets Example 4: Batch Operations
 *
 * This example demonstrates efficient batch operations for reading and writing
 * multiple ranges in a single API call, dramatically improving performance.
 *
 * Features demonstrated:
 * - Batch reading (multiple ranges at once)
 * - Batch writing (atomic multi-range updates)
 * - Performance comparison (batch vs sequential)
 * - Error handling in batch operations
 * - Best practices for large-scale operations
 *
 * Prerequisites:
 * - Node.js 22+
 * - npm install servalsheets
 * - GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_ACCESS_TOKEN set
 */

import { google } from 'googleapis';

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
// Batch Read Operations
// ============================================================================

/**
 * Batch read multiple ranges in a single API call
 */
async function batchRead(sheets, spreadsheetId, ranges) {
  console.log(`\n[BATCH READ] Reading ${ranges.length} ranges...`);

  const startTime = Date.now();

  try {
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges,
      valueRenderOption: 'FORMATTED_VALUE',
      majorDimension: 'ROWS',
    });

    const duration = Date.now() - startTime;

    console.log(`✓ Successfully read ${response.data.valueRanges.length} ranges in ${duration}ms`);

    response.data.valueRanges.forEach((valueRange, i) => {
      const rowCount = valueRange.values?.length || 0;
      const cellCount = valueRange.values?.reduce((sum, row) => sum + row.length, 0) || 0;
      console.log(`  Range ${i + 1} (${valueRange.range}): ${rowCount} rows, ${cellCount} cells`);
    });

    return {
      valueRanges: response.data.valueRanges,
      duration,
    };
  } catch (error) {
    console.error(`✗ Batch read failed: ${error.message}`);
    throw error;
  }
}

/**
 * Sequential read (for comparison)
 */
async function sequentialRead(sheets, spreadsheetId, ranges) {
  console.log(`\n[SEQUENTIAL READ] Reading ${ranges.length} ranges...`);

  const startTime = Date.now();
  const results = [];

  try {
    for (const range of ranges) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: 'FORMATTED_VALUE',
      });
      results.push(response.data);
    }

    const duration = Date.now() - startTime;

    console.log(`✓ Successfully read ${results.length} ranges in ${duration}ms`);

    results.forEach((result, i) => {
      const rowCount = result.values?.length || 0;
      const cellCount = result.values?.reduce((sum, row) => sum + row.length, 0) || 0;
      console.log(`  Range ${i + 1} (${result.range}): ${rowCount} rows, ${cellCount} cells`);
    });

    return {
      valueRanges: results,
      duration,
    };
  } catch (error) {
    console.error(`✗ Sequential read failed: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// Batch Write Operations
// ============================================================================

/**
 * Batch write multiple ranges atomically
 */
async function batchWrite(sheets, spreadsheetId, data) {
  console.log(`\n[BATCH WRITE] Writing ${data.length} ranges...`);

  const startTime = Date.now();
  const totalCells = data.reduce((sum, item) =>
    sum + item.values.reduce((s, row) => s + row.length, 0), 0
  );

  console.log(`  Total cells to write: ${totalCells}`);

  try {
    const response = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: data.map(item => ({
          range: item.range,
          values: item.values,
        })),
      },
    });

    const duration = Date.now() - startTime;

    console.log(`✓ Successfully wrote ${response.data.totalUpdatedCells} cells in ${duration}ms`);
    console.log(`  Ranges updated: ${response.data.responses.length}`);
    console.log(`  Total rows updated: ${response.data.totalUpdatedRows}`);
    console.log(`  Total columns updated: ${response.data.totalUpdatedColumns}`);

    return {
      response: response.data,
      duration,
    };
  } catch (error) {
    console.error(`✗ Batch write failed: ${error.message}`);
    throw error;
  }
}

/**
 * Sequential write (for comparison)
 */
async function sequentialWrite(sheets, spreadsheetId, data) {
  console.log(`\n[SEQUENTIAL WRITE] Writing ${data.length} ranges...`);

  const startTime = Date.now();
  const results = [];

  try {
    for (const item of data) {
      const response = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: item.range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: item.values,
        },
      });
      results.push(response.data);
    }

    const duration = Date.now() - startTime;
    const totalCells = results.reduce((sum, r) => sum + (r.updatedCells || 0), 0);

    console.log(`✓ Successfully wrote ${totalCells} cells in ${duration}ms`);
    console.log(`  Ranges updated: ${results.length}`);

    return {
      results,
      duration,
    };
  } catch (error) {
    console.error(`✗ Sequential write failed: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// Batch Clear Operations
// ============================================================================

/**
 * Batch clear multiple ranges
 */
async function batchClear(sheets, spreadsheetId, ranges) {
  console.log(`\n[BATCH CLEAR] Clearing ${ranges.length} ranges...`);

  const startTime = Date.now();

  try {
    const response = await sheets.spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: {
        ranges,
      },
    });

    const duration = Date.now() - startTime;

    console.log(`✓ Successfully cleared ${response.data.clearedRanges.length} ranges in ${duration}ms`);
    response.data.clearedRanges.forEach((range, i) => {
      console.log(`  Cleared: ${range}`);
    });

    return {
      response: response.data,
      duration,
    };
  } catch (error) {
    console.error(`✗ Batch clear failed: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// Advanced Batch Patterns
// ============================================================================

/**
 * Read-modify-write pattern with batching
 */
async function batchReadModifyWrite(sheets, spreadsheetId, transformations) {
  console.log(`\n[READ-MODIFY-WRITE] Processing ${transformations.length} transformations...`);

  const startTime = Date.now();

  try {
    // Step 1: Batch read all ranges
    console.log('\n  Step 1: Reading data...');
    const ranges = transformations.map(t => t.range);
    const readResult = await batchRead(sheets, spreadsheetId, ranges);

    // Step 2: Apply transformations
    console.log('\n  Step 2: Applying transformations...');
    const writeData = transformations.map((transform, i) => {
      const values = readResult.valueRanges[i].values || [];
      const modifiedValues = transform.modify(values);
      return {
        range: transform.range,
        values: modifiedValues,
      };
    });

    // Step 3: Batch write modified data
    console.log('\n  Step 3: Writing modified data...');
    const writeResult = await batchWrite(sheets, spreadsheetId, writeData);

    const totalDuration = Date.now() - startTime;

    console.log(`\n✓ Read-modify-write complete in ${totalDuration}ms`);
    console.log(`  Read time: ${readResult.duration}ms`);
    console.log(`  Write time: ${writeResult.duration}ms`);

    return {
      readDuration: readResult.duration,
      writeDuration: writeResult.duration,
      totalDuration,
    };
  } catch (error) {
    console.error(`✗ Read-modify-write failed: ${error.message}`);
    throw error;
  }
}

/**
 * Chunk large batch operations to stay within API limits
 */
async function chunkedBatchWrite(sheets, spreadsheetId, data, chunkSize = 100) {
  console.log(`\n[CHUNKED BATCH] Writing ${data.length} ranges in chunks of ${chunkSize}...`);

  const startTime = Date.now();
  const chunks = [];

  // Split into chunks
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }

  console.log(`  Split into ${chunks.length} chunks`);

  try {
    let totalCells = 0;

    for (let i = 0; i < chunks.length; i++) {
      console.log(`\n  Processing chunk ${i + 1}/${chunks.length}...`);
      const result = await batchWrite(sheets, spreadsheetId, chunks[i]);
      totalCells += result.response.totalUpdatedCells;

      // Rate limiting: wait between chunks
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const duration = Date.now() - startTime;

    console.log(`\n✓ Chunked batch complete in ${duration}ms`);
    console.log(`  Total cells written: ${totalCells}`);

    return {
      totalCells,
      duration,
      chunks: chunks.length,
    };
  } catch (error) {
    console.error(`✗ Chunked batch failed: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// Demo Setup
// ============================================================================

async function setupDemoData(sheets, spreadsheetId, sheetName) {
  console.log('\n[SETUP] Creating demo data...');

  const data = [
    {
      range: `${sheetName}!A1:C5`,
      values: [
        ['Name', 'Age', 'City'],
        ['Alice', '25', 'NYC'],
        ['Bob', '30', 'LA'],
        ['Carol', '28', 'Chicago'],
        ['David', '35', 'Boston'],
      ],
    },
    {
      range: `${sheetName}!E1:G5`,
      values: [
        ['Product', 'Price', 'Stock'],
        ['Widget A', '29.99', '100'],
        ['Widget B', '39.99', '50'],
        ['Widget C', '19.99', '200'],
        ['Widget D', '24.99', '75'],
      ],
    },
    {
      range: `${sheetName}!I1:K5`,
      values: [
        ['Date', 'Sales', 'Region'],
        ['2025-01-01', '1000', 'East'],
        ['2025-01-02', '1500', 'West'],
        ['2025-01-03', '1200', 'Central'],
        ['2025-01-04', '1800', 'East'],
      ],
    },
  ];

  await batchWrite(sheets, spreadsheetId, data);
  console.log('✓ Demo data created');
}

// ============================================================================
// Main Example
// ============================================================================

async function main() {
  console.log('=== ServalSheets Example: Batch Operations ===\n');
  console.log(`Spreadsheet ID: ${SPREADSHEET_ID}`);
  console.log(`Sheet: ${SHEET_NAME}`);

  try {
    // Initialize
    const auth = await getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Setup demo data
    await setupDemoData(sheets, SPREADSHEET_ID, SHEET_NAME);

    // ========================================================================
    // Example 1: Batch Read Performance Comparison
    // ========================================================================
    console.log('\n--- Example 1: Batch Read Performance ---');

    const readRanges = [
      `${SHEET_NAME}!A1:C5`,
      `${SHEET_NAME}!E1:G5`,
      `${SHEET_NAME}!I1:K5`,
    ];

    const batchResult = await batchRead(sheets, SPREADSHEET_ID, readRanges);
    const seqResult = await sequentialRead(sheets, SPREADSHEET_ID, readRanges);

    console.log('\n📊 Performance Comparison:');
    console.log(`  Batch:      ${batchResult.duration}ms`);
    console.log(`  Sequential: ${seqResult.duration}ms`);
    console.log(`  Speedup:    ${(seqResult.duration / batchResult.duration).toFixed(1)}x faster`);

    // ========================================================================
    // Example 2: Batch Write Performance Comparison
    // ========================================================================
    console.log('\n--- Example 2: Batch Write Performance ---');

    const writeData = [
      {
        range: `${SHEET_NAME}!A6`,
        values: [['Eve']],
      },
      {
        range: `${SHEET_NAME}!E6`,
        values: [['Widget E']],
      },
      {
        range: `${SHEET_NAME}!I6`,
        values: [['2025-01-05']],
      },
    ];

    const batchWriteResult = await batchWrite(sheets, SPREADSHEET_ID, writeData);

    // Prepare for sequential write (different cells)
    const seqWriteData = [
      {
        range: `${SHEET_NAME}!A7`,
        values: [['Frank']],
      },
      {
        range: `${SHEET_NAME}!E7`,
        values: [['Widget F']],
      },
      {
        range: `${SHEET_NAME}!I7`,
        values: [['2025-01-06']],
      },
    ];

    const seqWriteResult = await sequentialWrite(sheets, SPREADSHEET_ID, seqWriteData);

    console.log('\n📊 Performance Comparison:');
    console.log(`  Batch:      ${batchWriteResult.duration}ms`);
    console.log(`  Sequential: ${seqWriteResult.duration}ms`);
    console.log(`  Speedup:    ${(seqWriteResult.duration / batchWriteResult.duration).toFixed(1)}x faster`);

    // ========================================================================
    // Example 3: Batch Clear
    // ========================================================================
    console.log('\n--- Example 3: Batch Clear ---');

    const clearRanges = [
      `${SHEET_NAME}!A6:C7`,
      `${SHEET_NAME}!E6:G7`,
      `${SHEET_NAME}!I6:K7`,
    ];

    await batchClear(sheets, SPREADSHEET_ID, clearRanges);

    // ========================================================================
    // Example 4: Read-Modify-Write Pattern
    // ========================================================================
    console.log('\n--- Example 4: Read-Modify-Write Pattern ---');

    const transformations = [
      {
        range: `${SHEET_NAME}!B2:B5`,
        modify: (values) => {
          // Increment all ages by 1
          return values.map(row => [parseInt(row[0] || 0) + 1]);
        },
      },
      {
        range: `${SHEET_NAME}!F2:F5`,
        modify: (values) => {
          // Apply 10% discount to all prices
          return values.map(row => [(parseFloat(row[0] || 0) * 0.9).toFixed(2)]);
        },
      },
      {
        range: `${SHEET_NAME}!J2:J5`,
        modify: (values) => {
          // Increase sales by 5%
          return values.map(row => [Math.round(parseInt(row[0] || 0) * 1.05)]);
        },
      },
    ];

    await batchReadModifyWrite(sheets, SPREADSHEET_ID, transformations);

    // ========================================================================
    // Example 5: Chunked Batch Operations
    // ========================================================================
    console.log('\n--- Example 5: Chunked Batch Operations ---');

    // Generate large dataset
    const largeData = [];
    for (let i = 0; i < 25; i++) {
      largeData.push({
        range: `${SHEET_NAME}!M${i + 1}`,
        values: [[`Cell ${i + 1}`]],
      });
    }

    await chunkedBatchWrite(sheets, SPREADSHEET_ID, largeData, 10);

    // ========================================================================
    // Example 6: Error Handling in Batch Operations
    // ========================================================================
    console.log('\n--- Example 6: Batch Error Handling ---');

    const mixedData = [
      {
        range: `${SHEET_NAME}!A1`,
        values: [['Valid']],
      },
      {
        range: 'InvalidSheet!A1', // This will cause an error
        values: [['Invalid']],
      },
    ];

    try {
      await batchWrite(sheets, SPREADSHEET_ID, mixedData);
      console.log('✗ Should have thrown error');
    } catch (error) {
      console.log('✓ Correctly caught batch error');
      console.log(`  Error: ${error.message}`);
      console.log('  Note: Batch operations are atomic - all or nothing');
    }

    // ========================================================================
    // Success!
    // ========================================================================
    console.log('\n=== Example Complete ===');
    console.log('\nKey Takeaways:');
    console.log('  1. Batch operations are 2-5x faster than sequential');
    console.log('  2. Use batchGet for reading multiple ranges');
    console.log('  3. Use batchUpdate for atomic multi-range writes');
    console.log('  4. Batch operations are atomic (all or nothing)');
    console.log('  5. Chunk large batches to stay within API limits (100 ranges/request)');
    console.log('  6. Read-modify-write pattern works efficiently with batching');
    console.log('  7. Always prefer batch operations for better performance and quota usage');

  } catch (error) {
    console.error('\n=== Example Failed ===');
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the example
main();
