/**
 * TransactionManager.mergeAdjacentUpdates — coalesce tests
 *
 * Validates that consecutive overlapping/adjacent updateCells requests
 * targeting the same sheet are merged into fewer, larger updateCells
 * requests while non-updateCells requests are preserved in place.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { sheets_v4 } from 'googleapis';
import { TransactionManager } from '../../src/services/transaction-manager.js';
import type { BatchRequestEntry } from '../../src/types/transaction.js';

function makeUpdateCells(
  sheetId: number,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
  fillValue = 'x'
): BatchRequestEntry {
  const rowCount = endRow - startRow;
  const colCount = endCol - startCol;
  const rows: sheets_v4.Schema$RowData[] = Array.from({ length: rowCount }, () => ({
    values: Array.from({ length: colCount }, () => ({
      userEnteredValue: { stringValue: fillValue },
    })),
  }));
  return {
    updateCells: {
      range: {
        sheetId,
        startRowIndex: startRow,
        endRowIndex: endRow,
        startColumnIndex: startCol,
        endColumnIndex: endCol,
      },
      rows,
      fields: 'userEnteredValue',
    },
  };
}

describe('TransactionManager.mergeAdjacentUpdates', () => {
  let tm: TransactionManager;

  beforeEach(() => {
    tm = new TransactionManager({ enabled: true });
  });

  it('coalesces 50 overlapping updateCells into ≤5 requests', () => {
    // Build 50 updateCells each overlapping the next by 1 row.
    const requests: BatchRequestEntry[] = [];
    for (let i = 0; i < 50; i++) {
      requests.push(makeUpdateCells(1, i, i + 2, 0, 5));
    }
    const coalesced = tm.mergeAdjacentUpdates(requests);
    expect(coalesced.length).toBeLessThanOrEqual(5);
    // In practice this merges cleanly into a single request:
    expect(coalesced.length).toBe(1);
    const merged = coalesced[0]!.updateCells as {
      range: sheets_v4.Schema$GridRange;
      rows: sheets_v4.Schema$RowData[];
    };
    expect(merged.range.startRowIndex).toBe(0);
    expect(merged.range.endRowIndex).toBe(51);
  });

  it('preserves addSheet position and only coalesces writes on each side', () => {
    const requests: BatchRequestEntry[] = [];
    for (let i = 0; i < 20; i++) requests.push(makeUpdateCells(1, i, i + 2, 0, 5));
    requests.push({ addSheet: { properties: { title: 'NewTab' } } });
    for (let i = 100; i < 120; i++) requests.push(makeUpdateCells(1, i, i + 2, 0, 5));

    const coalesced = tm.mergeAdjacentUpdates(requests);
    // Expect: 1 coalesced write group + 1 addSheet + 1 coalesced write group
    expect(coalesced.length).toBe(3);
    expect(coalesced[1]!.addSheet).toBeDefined();
    expect(coalesced[0]!.updateCells).toBeDefined();
    expect(coalesced[2]!.updateCells).toBeDefined();
    // addSheet position preserved (not reordered)
    expect(coalesced[0]!.addSheet).toBeUndefined();
    expect(coalesced[2]!.addSheet).toBeUndefined();
  });

  it('does NOT coalesce non-overlapping, non-adjacent writes', () => {
    const requests: BatchRequestEntry[] = [
      // Far apart rectangles on the same sheet — no overlap, no adjacency.
      makeUpdateCells(1, 0, 2, 0, 2),
      makeUpdateCells(1, 100, 102, 100, 102),
      makeUpdateCells(1, 500, 502, 500, 502),
    ];
    const coalesced = tm.mergeAdjacentUpdates(requests);
    expect(coalesced.length).toBe(3);
  });

  it('does not coalesce across different sheetIds', () => {
    const requests: BatchRequestEntry[] = [
      makeUpdateCells(1, 0, 2, 0, 2),
      makeUpdateCells(2, 0, 2, 0, 2),
      makeUpdateCells(3, 0, 2, 0, 2),
    ];
    const coalesced = tm.mergeAdjacentUpdates(requests);
    expect(coalesced.length).toBe(3);
  });

  it('uses last-write-wins for overlapping cells', () => {
    const requests: BatchRequestEntry[] = [
      makeUpdateCells(1, 0, 2, 0, 2, 'FIRST'),
      makeUpdateCells(1, 0, 2, 0, 2, 'SECOND'),
    ];
    const coalesced = tm.mergeAdjacentUpdates(requests);
    expect(coalesced.length).toBe(1);
    const merged = coalesced[0]!.updateCells as {
      rows: sheets_v4.Schema$RowData[];
    };
    const cell = merged.rows[0]!.values![0]!.userEnteredValue!.stringValue;
    expect(cell).toBe('SECOND');
  });

  it('returns input unchanged when there is 0 or 1 request', () => {
    expect(tm.mergeAdjacentUpdates([])).toEqual([]);
    const single = [makeUpdateCells(1, 0, 2, 0, 2)];
    expect(tm.mergeAdjacentUpdates(single).length).toBe(1);
  });

  it('passes through updateCells with unbounded ranges (no silent loss)', () => {
    const unbounded: BatchRequestEntry = {
      updateCells: {
        range: { sheetId: 1 }, // missing indices
        rows: [],
        fields: 'userEnteredValue',
      },
    };
    const requests: BatchRequestEntry[] = [
      makeUpdateCells(1, 0, 2, 0, 2),
      unbounded,
      makeUpdateCells(1, 10, 12, 10, 12),
    ];
    const coalesced = tm.mergeAdjacentUpdates(requests);
    // Unbounded entry breaks the merge group AND passes through untouched.
    expect(coalesced.length).toBe(3);
    expect(coalesced[1]).toBe(unbounded);
  });
});
