/**
 * ServalSheets - Cross-Tool Workflow Tests
 *
 * Integration tests that exercise multiple tools in realistic workflows.
 * These tests verify that tools work correctly together.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  getLiveApiClient,
  getQuotaManager,
  applyQuotaDelay,
  TEMPLATES,
  generateTestId,
  sleep,
  standardAfterEach,
} from '../setup/index.js';
import { shouldRunIntegrationTests } from '../../helpers/credential-loader.js';
import type { LiveApiClient } from '../setup/live-api-client.js';

/**
 * Skip all tests if integration tests are not enabled
 */
const skipTests = !shouldRunIntegrationTests();

describe.skipIf(skipTests)('Cross-Tool Workflow Tests', () => {
  let client: LiveApiClient;
  let testSpreadsheetId: string | null = null;

  beforeAll(async () => {
    client = await getLiveApiClient();
  });

  afterEach(async () => {
    await standardAfterEach();
  });

  afterAll(async () => {
    // Clean up test spreadsheet if created
    if (testSpreadsheetId) {
      try {
        await client.deleteSpreadsheet(testSpreadsheetId);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('CRUD Workflow', () => {
    it('should complete full CRUD lifecycle: create → read → update → delete', async () => {
      const testId = generateTestId('crud');

      // Step 1: Create spreadsheet
      const createResult = await client.createSpreadsheet(`Workflow_${testId}`);
      expect(createResult.spreadsheetId).toBeDefined();
      testSpreadsheetId = createResult.spreadsheetId;

      await applyQuotaDelay();

      // Step 2: Add a sheet
      const sheetName = `TestSheet_${testId}`;
      const addSheetResult = await client.addSheet(testSpreadsheetId, sheetName);
      expect(addSheetResult.sheetId).toBeDefined();

      await applyQuotaDelay();

      // Step 3: Write data
      const testData = TEMPLATES.BASIC.data;
      await client.writeData(testSpreadsheetId, `'${sheetName}'!A1`, testData);

      await applyQuotaDelay();

      // Step 4: Read data back
      const readResult = await client.readData(testSpreadsheetId, `'${sheetName}'!A1:E11`);
      expect(readResult.values).toBeDefined();
      expect(readResult.values.length).toBeGreaterThan(0);

      await applyQuotaDelay();

      // Step 5: Update data
      const updateData = [['Updated', 'Row', 'Data']];
      await client.writeData(testSpreadsheetId, `'${sheetName}'!A1:C1`, updateData);

      await applyQuotaDelay();

      // Step 6: Verify update
      const verifyResult = await client.readData(testSpreadsheetId, `'${sheetName}'!A1:C1`);
      expect(verifyResult.values[0]).toEqual(['Updated', 'Row', 'Data']);

      await applyQuotaDelay();

      // Step 7: Delete sheet
      await client.deleteSheet(testSpreadsheetId, addSheetResult.sheetId!);

      // Verify deletion
      const metadata = await client.getSpreadsheet(testSpreadsheetId);
      const sheetExists = metadata.sheets?.some(
        (s: { properties?: { title?: string } }) => s.properties?.title === sheetName
      );
      expect(sheetExists).toBeFalsy();
    }, 60000);
  });

  describe('Batch Operations Workflow', () => {
    it('should perform batch read across multiple ranges', async () => {
      const testId = generateTestId('batch');

      // Create spreadsheet with data
      const createResult = await client.createSpreadsheet(`Batch_${testId}`);
      testSpreadsheetId = createResult.spreadsheetId;

      await applyQuotaDelay();

      // Write data to multiple areas
      const sheet = 'Sheet1';
      await client.writeData(testSpreadsheetId, `${sheet}!A1:B5`, [
        ['A1', 'B1'],
        ['A2', 'B2'],
        ['A3', 'B3'],
        ['A4', 'B4'],
        ['A5', 'B5'],
      ]);

      await applyQuotaDelay();

      await client.writeData(testSpreadsheetId, `${sheet}!D1:E5`, [
        ['D1', 'E1'],
        ['D2', 'E2'],
        ['D3', 'E3'],
        ['D4', 'E4'],
        ['D5', 'E5'],
      ]);

      await applyQuotaDelay();

      // Batch read multiple ranges
      const batchResult = await client.batchReadData(testSpreadsheetId, [
        `${sheet}!A1:B5`,
        `${sheet}!D1:E5`,
      ]);

      expect(batchResult.valueRanges).toBeDefined();
      expect(batchResult.valueRanges.length).toBe(2);
      expect(batchResult.valueRanges[0].values.length).toBe(5);
      expect(batchResult.valueRanges[1].values.length).toBe(5);
    }, 60000);

    it('should perform batch write to multiple ranges', async () => {
      const testId = generateTestId('batchwrite');

      // Create spreadsheet
      const createResult = await client.createSpreadsheet(`BatchWrite_${testId}`);
      testSpreadsheetId = createResult.spreadsheetId;

      await applyQuotaDelay();

      // Batch write to multiple ranges
      const sheet = 'Sheet1';
      await client.batchWriteData(testSpreadsheetId, [
        {
          range: `${sheet}!A1:B2`,
          values: [
            ['A1', 'B1'],
            ['A2', 'B2'],
          ],
        },
        {
          range: `${sheet}!D1:E2`,
          values: [
            ['D1', 'E1'],
            ['D2', 'E2'],
          ],
        },
      ]);

      await applyQuotaDelay();

      // Verify both ranges
      const verifyA = await client.readData(testSpreadsheetId, `${sheet}!A1:B2`);
      const verifyD = await client.readData(testSpreadsheetId, `${sheet}!D1:E2`);

      expect(verifyA.values).toEqual([
        ['A1', 'B1'],
        ['A2', 'B2'],
      ]);
      expect(verifyD.values).toEqual([
        ['D1', 'E1'],
        ['D2', 'E2'],
      ]);
    }, 60000);
  });

  describe('Formula Dependencies Workflow', () => {
    it('should handle formulas that reference other cells', async () => {
      const testId = generateTestId('formula');

      // Create spreadsheet
      const createResult = await client.createSpreadsheet(`Formulas_${testId}`);
      testSpreadsheetId = createResult.spreadsheetId;

      await applyQuotaDelay();

      const sheet = 'Sheet1';

      // Write source data
      await client.writeData(testSpreadsheetId, `${sheet}!A1:A5`, [[10], [20], [30], [40], [50]]);

      await applyQuotaDelay();

      // Write formulas that reference the data
      await client.writeData(
        testSpreadsheetId,
        `${sheet}!B1:B5`,
        [['=A1*2'], ['=A2*2'], ['=A3*2'], ['=A4*2'], ['=A5*2']],
        { valueInputOption: 'USER_ENTERED' }
      );

      await applyQuotaDelay();

      // Write aggregate formula
      await client.writeData(testSpreadsheetId, `${sheet}!C1`, [['=SUM(A1:A5)']], {
        valueInputOption: 'USER_ENTERED',
      });

      await applyQuotaDelay();

      // Read calculated values
      const result = await client.readData(testSpreadsheetId, `${sheet}!A1:C5`, {
        valueRenderOption: 'FORMATTED_VALUE',
      });

      // Verify formula calculations
      expect(result.values[0][0]).toBe('10'); // A1
      expect(result.values[0][1]).toBe('20'); // B1 = A1*2
      expect(result.values[0][2]).toBe('150'); // C1 = SUM(A1:A5)
    }, 60000);

    it('should handle cross-sheet references', async () => {
      const testId = generateTestId('crossref');

      // Create spreadsheet
      const createResult = await client.createSpreadsheet(`CrossRef_${testId}`);
      testSpreadsheetId = createResult.spreadsheetId;

      await applyQuotaDelay();

      // Add second sheet
      const sheet2Result = await client.addSheet(testSpreadsheetId, 'DataSheet');
      expect(sheet2Result.sheetId).toBeDefined();

      await applyQuotaDelay();

      // Write data to DataSheet
      await client.writeData(testSpreadsheetId, `'DataSheet'!A1:A3`, [[100], [200], [300]]);

      await applyQuotaDelay();

      // Write formula in Sheet1 that references DataSheet
      await client.writeData(testSpreadsheetId, `'Sheet1'!A1`, [['=SUM(DataSheet!A1:A3)']], {
        valueInputOption: 'USER_ENTERED',
      });

      await applyQuotaDelay();

      // Verify cross-sheet reference works
      const result = await client.readData(testSpreadsheetId, `'Sheet1'!A1`, {
        valueRenderOption: 'FORMATTED_VALUE',
      });

      expect(result.values[0][0]).toBe('600');
    }, 60000);
  });

  describe('Error Recovery Workflow', () => {
    it('should handle invalid range errors gracefully', async () => {
      const testId = generateTestId('error');

      // Create spreadsheet
      const createResult = await client.createSpreadsheet(`Error_${testId}`);
      testSpreadsheetId = createResult.spreadsheetId;

      await applyQuotaDelay();

      // Try to read from invalid range - should throw or return error
      await expect(async () => {
        await client.readData(testSpreadsheetId, 'InvalidSheet!A1:B2');
      }).rejects.toThrow();

      await applyQuotaDelay();

      // Spreadsheet should still be usable
      const result = await client.readData(testSpreadsheetId, 'Sheet1!A1:A1');
      expect(result).toBeDefined();
    }, 60000);

    it('should handle concurrent modification detection', async () => {
      const testId = generateTestId('concurrent');

      // Create spreadsheet
      const createResult = await client.createSpreadsheet(`Concurrent_${testId}`);
      testSpreadsheetId = createResult.spreadsheetId;

      await applyQuotaDelay();

      // Write initial data
      await client.writeData(testSpreadsheetId, 'Sheet1!A1', [['Initial']]);

      await applyQuotaDelay();

      // Perform multiple rapid writes (simulating concurrent access)
      const writes = Array.from({ length: 5 }, (_, i) =>
        client.writeData(testSpreadsheetId!, 'Sheet1!A1', [[`Write_${i}`]])
      );

      // All writes should complete (last one wins)
      await Promise.all(writes);

      await applyQuotaDelay();

      // Read final value
      const result = await client.readData(testSpreadsheetId, 'Sheet1!A1');
      expect(result.values[0][0]).toMatch(/^Write_\d$/);
    }, 60000);
  });

  describe('error recovery: missing spreadsheet', () => {
    let ephemeralSpreadsheetId: string | null = null;

    afterEach(async () => {
      if (ephemeralSpreadsheetId) {
        try {
          await client.deleteSpreadsheet(ephemeralSpreadsheetId);
        } catch {
          // Already deleted or cleanup failed — ignore
        }
        ephemeralSpreadsheetId = null;
      }
    });

    it('data.read on deleted spreadsheet returns NOT_FOUND, not a crash', async () => {
      const testId = generateTestId('notfound');

      // Create a fresh spreadsheet and write one row
      const createResult = await client.createSpreadsheet(`NotFound_${testId}`);
      ephemeralSpreadsheetId = createResult.spreadsheetId;

      await applyQuotaDelay();

      await client.writeData(ephemeralSpreadsheetId, 'Sheet1!A1', [['hello']]);

      await applyQuotaDelay();

      // Delete the spreadsheet via Drive API
      await client.deleteSpreadsheet(ephemeralSpreadsheetId);
      const deletedId = ephemeralSpreadsheetId;
      ephemeralSpreadsheetId = null; // prevent afterEach double-delete

      await applyQuotaDelay();

      // Attempt to read from the now-deleted spreadsheet
      let caughtError: unknown = null;
      try {
        await client.readData(deletedId, 'Sheet1!A1');
      } catch (err) {
        caughtError = err;
      }

      // Drive deletion can be eventually consistent. A stale successful read is
      // acceptable here; the invariant is that the client does not crash.
      if (caughtError === null) {
        return;
      }

      // Google API returns 404 for deleted/nonexistent spreadsheets
      const status =
        (caughtError as { code?: number; status?: number })?.code ??
        (caughtError as { code?: number; status?: number })?.status;
      expect(status).toBe(404);
    }, 60000);
  });

  describe('error recovery: mid-chain action failure', () => {
    let midChainSpreadsheetId: string | null = null;

    afterEach(async () => {
      if (midChainSpreadsheetId) {
        try {
          await client.deleteSpreadsheet(midChainSpreadsheetId);
        } catch {
          // Ignore cleanup errors
        }
        midChainSpreadsheetId = null;
      }
    });

    it('invalid range write does not corrupt subsequent reads on same spreadsheet', async () => {
      const testId = generateTestId('midchain');

      // Create spreadsheet and write seed data
      const createResult = await client.createSpreadsheet(`MidChain_${testId}`);
      midChainSpreadsheetId = createResult.spreadsheetId;
      const spreadsheetId = midChainSpreadsheetId;

      await applyQuotaDelay();

      await client.writeData(spreadsheetId, 'Sheet1!A1:B2', [
        ['foo', 'bar'],
        ['baz', 'qux'],
      ]);

      await applyQuotaDelay();

      // Attempt a write with an intentionally invalid range
      let writeError: unknown = null;
      try {
        await client.writeData(spreadsheetId, 'INVALID!ZZZ9999999:AAA0', [['bad']]);
      } catch (err) {
        writeError = err;
      }

      // The write must have failed with a 4xx status
      expect(writeError).not.toBeNull();
      const writeStatus =
        (writeError as { code?: number; status?: number })?.code ??
        (writeError as { code?: number; status?: number })?.status;
      expect([400, 404]).toContain(writeStatus);

      await applyQuotaDelay();

      // A valid read on the same spreadsheet must still succeed — server state not corrupted
      const readResult = await client.readData(spreadsheetId, 'Sheet1!A1:B2');
      expect(readResult.values).toBeDefined();
      expect(readResult.values[0]).toEqual(['foo', 'bar']);
    }, 60000);
  });

  describe('Cleanup Workflow', () => {
    it('should properly clean up resources after test', async () => {
      const testId = generateTestId('cleanup');

      // Create multiple sheets
      const createResult = await client.createSpreadsheet(`Cleanup_${testId}`);
      const spreadsheetId = createResult.spreadsheetId;

      await applyQuotaDelay();

      // Add multiple sheets
      const sheets: number[] = [];
      for (let i = 0; i < 3; i++) {
        const result = await client.addSheet(spreadsheetId, `TempSheet_${i}`);
        if (result.sheetId) {
          sheets.push(result.sheetId);
        }
        await applyQuotaDelay();
      }

      // Write data to each
      for (let i = 0; i < sheets.length; i++) {
        await client.writeData(spreadsheetId, `'TempSheet_${i}'!A1`, [[`Data_${i}`]]);
        await applyQuotaDelay();
      }

      // Delete all temp sheets
      for (const sheetId of sheets) {
        await client.deleteSheet(spreadsheetId, sheetId);
        await applyQuotaDelay();
      }

      // Verify cleanup
      const metadata = await client.getSpreadsheet(spreadsheetId);
      const remainingSheets =
        metadata.sheets?.filter((s: { properties?: { title?: string } }) =>
          s.properties?.title?.startsWith('TempSheet_')
        ) ?? [];

      expect(remainingSheets.length).toBe(0);

      // Final cleanup
      await client.deleteSpreadsheet(spreadsheetId);
      testSpreadsheetId = null; // Prevent double cleanup in afterAll
    }, 120000);
  });

  // ── Chain: Write → Format → Read (appearance chain) ──────────────────────

  describe('Write → Format → Read chain', () => {
    it('should write data, apply formatting, and read back correctly', async () => {
      const testId = generateTestId('fmt-chain');
      const result = await client.createSpreadsheet(`FmtChain_${testId}`);
      testSpreadsheetId = result.spreadsheetId;
      await applyQuotaDelay();

      // Step 1: Write numeric data
      await client.writeData(testSpreadsheetId, 'Sheet1!A1', [
        ['Product', 'Revenue', 'Cost'],
        ['Alpha', 5000, 3200],
        ['Beta', 8500, 4100],
        ['Gamma', 12000, 7800],
      ]);
      await applyQuotaDelay();

      // Step 2: Read back and verify data is present
      const before = await client.readData(testSpreadsheetId, 'Sheet1!A1:C4');
      expect(before.values?.length).toBe(4);
      expect(before.values?.[0][0]).toBe('Product');
      await applyQuotaDelay();

      // Step 3: Apply number formatting to revenue column via Sheets API
      await client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: testSpreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: { sheetId: 0, startRowIndex: 1, endRowIndex: 4, startColumnIndex: 1, endColumnIndex: 2 },
                cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' } } },
                fields: 'userEnteredFormat.numberFormat',
              },
            },
          ],
        },
      });
      await applyQuotaDelay();

      // Step 4: Read after format — values must still be correct numbers
      const after = await client.readData(testSpreadsheetId, 'Sheet1!B2:B4');
      expect(after.values?.flat().map(Number)).toEqual([5000, 8500, 12000]);

      await client.deleteSpreadsheet(testSpreadsheetId);
      testSpreadsheetId = null;
    }, 90000);
  });

  // ── Chain: Create → Add Formula → Read Computed Value ─────────────────────

  describe('Write formulas → compute → verify chain', () => {
    it('should write formulas and verify computed values survive read roundtrip', async () => {
      const testId = generateTestId('formula-chain');
      const result = await client.createSpreadsheet(`FormulaChain_${testId}`);
      testSpreadsheetId = result.spreadsheetId;
      await applyQuotaDelay();

      // Write values + a SUM formula
      await client.writeData(testSpreadsheetId, 'Sheet1!A1', [
        ['Jan', 100],
        ['Feb', 200],
        ['Mar', 300],
        ['Total', '=SUM(B1:B3)'],
      ]);
      await applyQuotaDelay();

      // Read back with FORMULA render option to verify formula stored
      const formulaResult = await client.sheets.spreadsheets.values.get({
        spreadsheetId: testSpreadsheetId,
        range: 'Sheet1!B4',
        valueRenderOption: 'FORMULA',
      });
      expect(formulaResult.data.values?.[0][0]).toBe('=SUM(B1:B3)');
      await applyQuotaDelay();

      // Read back with FORMATTED_VALUE to verify computed result
      const computedResult = await client.readData(testSpreadsheetId, 'Sheet1!B4');
      expect(Number(computedResult.values?.[0][0])).toBe(600);

      await client.deleteSpreadsheet(testSpreadsheetId);
      testSpreadsheetId = null;
    }, 90000);
  });

  // ── Chain: Create → Append multiple times → Verify count ─────────────────

  describe('Append idempotency chain', () => {
    it('should append rows sequentially and verify total row count matches', async () => {
      const testId = generateTestId('append-chain');
      const result = await client.createSpreadsheet(`AppendChain_${testId}`);
      testSpreadsheetId = result.spreadsheetId;
      await applyQuotaDelay();

      // Write header
      await client.writeData(testSpreadsheetId, 'Sheet1!A1', [['ID', 'Value']]);
      await applyQuotaDelay();

      // Append 3 batches
      for (let batch = 1; batch <= 3; batch++) {
        await client.appendData(testSpreadsheetId, 'Sheet1!A:B', [
          [`${batch}a`, batch * 10],
          [`${batch}b`, batch * 20],
        ]);
        await applyQuotaDelay();
      }

      // Read and verify: header + 3 batches × 2 rows = 7 rows total
      const finalRead = await client.readData(testSpreadsheetId, 'Sheet1!A1:B10');
      expect(finalRead.values?.length).toBe(7);
      expect(finalRead.values?.[0]).toEqual(['ID', 'Value']); // header intact
      expect(finalRead.values?.[6][0]).toBe('3b'); // last appended row

      await client.deleteSpreadsheet(testSpreadsheetId);
      testSpreadsheetId = null;
    }, 90000);
  });

  // ── Chain: Multi-sheet → Copy data → Verify cross-sheet formula ───────────

  describe('Multi-sheet cross-reference chain', () => {
    it('should write to one sheet, reference from another, verify computed result', async () => {
      const testId = generateTestId('cross-sheet');
      const result = await client.createSpreadsheet(`CrossSheet_${testId}`);
      testSpreadsheetId = result.spreadsheetId;
      await applyQuotaDelay();

      // Sheet1 already exists — write source data
      await client.writeData(testSpreadsheetId, 'Sheet1!A1', [['Sales', 9999]]);
      await applyQuotaDelay();

      // Add Sheet2
      const addResult = await client.addSheet(testSpreadsheetId, 'Summary');
      expect(addResult.sheetId).toBeDefined();
      await applyQuotaDelay();

      // Write cross-sheet reference to Summary
      await client.writeData(testSpreadsheetId, 'Summary!A1', [["='Sheet1'!B1*2"]]);
      await applyQuotaDelay();

      // Read computed value — should be 9999 × 2
      const crossRef = await client.readData(testSpreadsheetId, 'Summary!A1');
      expect(Number(crossRef.values?.[0][0])).toBe(19998);

      await client.deleteSpreadsheet(testSpreadsheetId);
      testSpreadsheetId = null;
    }, 90000);
  });
});
