/**
 * Tiered diffing system for mutation tracking
 * Supports METADATA, SAMPLE, and FULL tier comparisons with block checksums
 */

import { createHash } from 'crypto';
import { logger } from '../utils/logger.js';

export type DiffTier = 'METADATA' | 'SAMPLE' | 'FULL';

export interface CellState {
  value: unknown;
  formula?: string;
  formattedValue?: string;
}

export interface RangeState {
  range: string;
  data: Map<string, CellState>;
  checksum: string;
  tier: DiffTier;
}

export interface DiffResult {
  added: Array<{ cell: string; value: unknown }>;
  removed: Array<{ cell: string; value: unknown }>;
  changed: Array<{ cell: string; oldValue: unknown; newValue: unknown }>;
  summary: {
    cellsAdded: number;
    cellsRemoved: number;
    cellsChanged: number;
    totalChanges: number;
  };
}

const SAMPLE_SIZE = 100;
const BLOCK_SIZE = 10000;

export class DiffEngine {
  private snapshots: Map<string, RangeState> = new Map();

  /**
   * Capture current state of entire spreadsheet
   */
  captureState(spreadsheetId: string, data: Record<string, unknown>, tier: DiffTier = 'SAMPLE'): RangeState {
    const rangeState: RangeState = {
      range: `${spreadsheetId}!*`,
      data: new Map(),
      checksum: '',
      tier,
    };

    // Convert data to cell map
    let cellCount = 0;
    for (const [key, value] of Object.entries(data)) {
      if (tier === 'SAMPLE' && cellCount >= SAMPLE_SIZE) break;
      rangeState.data.set(key, { value });
      cellCount++;
    }

    rangeState.checksum = this.computeChecksum(rangeState.data);
    const key = `${spreadsheetId}_state`;
    this.snapshots.set(key, rangeState);

    return rangeState;
  }

  /**
   * Capture state of specific range
   */
  captureRangeState(
    spreadsheetId: string,
    range: string,
    data: unknown[][],
    tier: DiffTier = 'SAMPLE'
  ): RangeState {
    const rangeState: RangeState = {
      range,
      data: new Map(),
      checksum: '',
      tier,
    };

    // Convert 2D array to cell map
    let cellCount = 0;
    for (let i = 0; i < data.length; i++) {
      if (tier === 'SAMPLE' && cellCount >= SAMPLE_SIZE) break;
      for (let j = 0; j < data[i].length; j++) {
        const cellRef = this.getA1Reference(i, j);
        rangeState.data.set(cellRef, { value: data[i][j] });
        cellCount++;
      }
    }

    rangeState.checksum = this.computeChecksum(rangeState.data);
    this.snapshots.set(`${spreadsheetId}_${range}`, rangeState);

    return rangeState;
  }

  /**
   * Capture state from Google Sheets API response
   */
  captureStateFromResponse(
    spreadsheetId: string,
    range: string,
    response: Record<string, unknown>,
    tier: DiffTier = 'SAMPLE'
  ): RangeState {
    const rangeState: RangeState = {
      range,
      data: new Map(),
      checksum: '',
      tier,
    };

    // Parse response based on response type
    const values = (response as { values?: unknown[][] }).values || [];
    if (Array.isArray(values)) {
      return this.captureRangeState(spreadsheetId, range, values as unknown[][], tier);
    }

    rangeState.checksum = this.computeChecksum(rangeState.data);
    this.snapshots.set(`${spreadsheetId}_${range}`, rangeState);

    return rangeState;
  }

  /**
   * Compute diff between two states
   */
  diff(state1: RangeState, state2: RangeState): DiffResult {
    const result: DiffResult = {
      added: [],
      removed: [],
      changed: [],
      summary: {
        cellsAdded: 0,
        cellsRemoved: 0,
        cellsChanged: 0,
        totalChanges: 0,
      },
    };

    // Quick check: checksums match
    if (state1.checksum === state2.checksum) {
      return result;
    }

    // Compare cell-by-cell
    const allCells = new Set([
      ...state1.data.keys(),
      ...state2.data.keys(),
    ]);

    for (const cell of allCells) {
      const oldState = state1.data.get(cell);
      const newState = state2.data.get(cell);

      if (!oldState && newState) {
        result.added.push({ cell, value: newState.value });
        result.summary.cellsAdded++;
      } else if (oldState && !newState) {
        result.removed.push({ cell, value: oldState.value });
        result.summary.cellsRemoved++;
      } else if (oldState && newState && oldState.value !== newState.value) {
        result.changed.push({ cell, oldValue: oldState.value, newValue: newState.value });
        result.summary.cellsChanged++;
      }
    }

    result.summary.totalChanges =
      result.summary.cellsAdded + result.summary.cellsRemoved + result.summary.cellsChanged;

    return result;
  }

  /**
   * Compute SHA-256 checksum of data
   */
  private computeChecksum(data: Map<string, CellState>): string {
    const entries = Array.from(data.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
      .join('|');

    return createHash('sha256').update(entries).digest('hex');
  }

  /**
   * Convert row/col indices to A1 reference
   */
  private getA1Reference(row: number, col: number): string {
    let colRef = '';
    let c = col + 1;
    while (c > 0) {
      colRef = String.fromCharCode((c - 1) % 26 + 65) + colRef;
      c = Math.floor((c - 1) / 26);
    }
    return `${colRef}${row + 1}`;
  }
}
