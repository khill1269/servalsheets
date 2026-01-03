/**
 * ServalSheets - Diff Engine
 * 
 * Tiered diffing for mutation summaries
 * Tighten-up #3: Don't try to diff everything
 */

import type { sheets_v4 } from 'googleapis';
import CryptoJS from 'crypto-js';
import type { DiffResult, DiffOptions, CellValue } from '../schemas/shared.js';

type CellChangeRecord = {
  cell: string;
  before?: CellValue;
  after?: CellValue;
  type: 'value' | 'format' | 'formula' | 'note';
};

type SheetSamples = {
  firstRows: CellValue[][];
  lastRows: CellValue[][];
};

export interface SpreadsheetState {
  timestamp: string;
  spreadsheetId: string;
  sheets: SheetState[];
  checksum: string;
}

export interface SheetState {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
  checksum: string;
  blockChecksums?: string[];
  sampleData?: SheetSamples;
  values?: CellValue[][];
}

export interface DiffEngineOptions {
  sheetsApi: sheets_v4.Sheets;
  defaultTier?: 'METADATA' | 'SAMPLE' | 'FULL';
  sampleSize?: number;
  maxFullDiffCells?: number;
  blockSize?: number;
}

export interface CaptureStateOptions {
  tier?: 'METADATA' | 'SAMPLE' | 'FULL';
  sampleSize?: number;
  maxFullDiffCells?: number;
}

/**
 * Diff engine with tiered comparison
 */
export class DiffEngine {
  private sheetsApi: sheets_v4.Sheets;
  private defaultTier: 'METADATA' | 'SAMPLE' | 'FULL';
  private sampleSize: number;
  private maxFullDiffCells: number;
  private blockSize: number;

  constructor(options: DiffEngineOptions) {
    this.sheetsApi = options.sheetsApi;
    this.defaultTier = options.defaultTier ?? 'SAMPLE';
    this.sampleSize = options.sampleSize ?? 10;
    this.maxFullDiffCells = options.maxFullDiffCells ?? 5000;
    this.blockSize = options.blockSize ?? 1000;
  }

  getDefaultTier(): 'METADATA' | 'SAMPLE' | 'FULL' {
    return this.defaultTier;
  }

  /**
   * Capture current spreadsheet state
   */
  async captureState(
    spreadsheetId: string,
    options?: CaptureStateOptions
  ): Promise<SpreadsheetState> {
    const targetTier = options?.tier ?? this.defaultTier;
    const sampleSize = options?.sampleSize ?? this.sampleSize;
    const maxFullDiffCells = options?.maxFullDiffCells ?? this.maxFullDiffCells;

    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId,
      includeGridData: false,
    });

    const sheets: SheetState[] = [];
    
    for (const sheet of response.data.sheets ?? []) {
      const props = sheet.properties;
      if (!props) continue;

      const escapedTitle = (props.title ?? '').replace(/'/g, "''");
      const sampleData: SheetSamples = { firstRows: [], lastRows: [] };
      const shouldCaptureSamples = targetTier !== 'METADATA';
      if (shouldCaptureSamples) {
        const firstRange = `'${escapedTitle}'!A1:ZZ${sampleSize}`;
        sampleData.firstRows = await this.getRangeValues(spreadsheetId, firstRange);

        if ((props.gridProperties?.rowCount ?? 0) > sampleSize * 2) {
          const lastRange = `'${escapedTitle}'!A${(props.gridProperties?.rowCount ?? 0) - sampleSize}:ZZ${props.gridProperties?.rowCount ?? sampleSize}`;
          sampleData.lastRows = await this.getRangeValues(spreadsheetId, lastRange);
        }
      }

      let values: CellValue[][] | undefined;
      const shouldCaptureFull = targetTier === 'FULL';
      if (shouldCaptureFull) {
        const rowCount = props.gridProperties?.rowCount ?? 0;
        const columnCount = props.gridProperties?.columnCount ?? 0;
        const maxRows = Math.min(
          rowCount,
          Math.ceil(maxFullDiffCells / Math.max(columnCount, 1))
        );
        const endCol = this.columnIndexToLetter(Math.min(Math.max(columnCount - 1, 0), 25));
        const fullRange = `'${escapedTitle}'!A1:${endCol}${maxRows}`;
        values = await this.getRangeValues(spreadsheetId, fullRange);
      }

      const sheetState: SheetState = {
        sheetId: props.sheetId ?? 0,
        title: props.title ?? '',
        rowCount: props.gridProperties?.rowCount ?? 0,
        columnCount: props.gridProperties?.columnCount ?? 0,
        checksum: '', // Will be computed if needed
        sampleData: sampleData.firstRows.length || sampleData.lastRows.length ? sampleData : undefined,
        values,
      };

      sheets.push(sheetState);
    }

    // Compute overall checksum from sheet metadata
    const stateString = JSON.stringify(sheets.map(s => ({
      id: s.sheetId,
      title: s.title,
      rows: s.rowCount,
      cols: s.columnCount,
    })));
    
    return {
      timestamp: new Date().toISOString(),
      spreadsheetId,
      sheets,
      checksum: CryptoJS.MD5(stateString).toString(),
    };
  }

  /**
   * Capture detailed state for a specific range
   */
  async captureRangeState(
    spreadsheetId: string,
    range: string
  ): Promise<{ checksum: string; rowCount: number; values?: CellValue[][] }> {
    const response = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const values = response.data.values ?? [];
    const valuesString = JSON.stringify(values);
    
    return {
      checksum: CryptoJS.MD5(valuesString).toString(),
      rowCount: values.length,
      values: values as CellValue[][],
    };
  }

  /**
   * Generate diff between two states
   */
  async diff(
    before: SpreadsheetState,
    after: SpreadsheetState,
    options?: DiffOptions
  ): Promise<DiffResult> {
    const tier = this.selectTier(before, after, options);

    switch (tier) {
      case 'FULL':
        return await this.fullDiff(before, after);
      case 'SAMPLE':
        return await this.sampleDiff(before, after, options?.sampleSize);
      default:
        return this.metadataDiff(before, after);
    }
  }

  /**
   * Metadata-only diff (Tier 1)
   */
  private metadataDiff(before: SpreadsheetState, after: SpreadsheetState): DiffResult {
    const beforeRows = before.sheets.reduce((sum, s) => sum + s.rowCount, 0);
    const afterRows = after.sheets.reduce((sum, s) => sum + s.rowCount, 0);
    const beforeCols = before.sheets.reduce((sum, s) => sum + s.columnCount, 0);
    const afterCols = after.sheets.reduce((sum, s) => sum + s.columnCount, 0);

    return {
      tier: 'METADATA',
      before: {
        timestamp: before.timestamp,
        rowCount: beforeRows,
        columnCount: beforeCols,
        checksum: before.checksum,
      },
      after: {
        timestamp: after.timestamp,
        rowCount: afterRows,
        columnCount: afterCols,
        checksum: after.checksum,
      },
      summary: {
        rowsChanged: Math.abs(afterRows - beforeRows),
        estimatedCellsChanged: this.estimateChangedCells(before, after),
      },
    };
  }

  /**
   * Sample diff (Tier 2) - Returns summary with sample statistics
   */
  private async sampleDiff(
    before: SpreadsheetState,
    after: SpreadsheetState,
    sampleSize: number = this.sampleSize
  ): Promise<DiffResult> {
    type SampleDiff = Extract<DiffResult, { tier: 'SAMPLE' }>;
    const samples: SampleDiff['samples'] = {
      firstRows: [],
      lastRows: [],
      randomRows: [],
    };
    let cellsSampled = 0;
    const changedRows = new Set<number>();

    for (const sheet of after.sheets) {
      const beforeSheet = before.sheets.find(s => s.sheetId === sheet.sheetId);
      const escapedTitle = sheet.title.replace(/'/g, "''");

      const afterFirst = sheet.sampleData?.firstRows ?? await this.getRangeValues(
        after.spreadsheetId,
        `'${escapedTitle}'!A1:ZZ${sampleSize}`
      );
      const beforeFirst = beforeSheet?.sampleData?.firstRows ?? [];
      cellsSampled += this.countCells(afterFirst);
      this.collectSampleChanges(
        sheet.title,
        afterFirst,
        beforeFirst,
        0,
        samples.firstRows,
        changedRows
      );

      const shouldCheckLast = sheet.rowCount > sampleSize * 2;
      if (shouldCheckLast) {
        const afterLast = sheet.sampleData?.lastRows ?? await this.getRangeValues(
          after.spreadsheetId,
          `'${escapedTitle}'!A${sheet.rowCount - sampleSize}:ZZ${sheet.rowCount}`
        );
        const beforeLast = beforeSheet?.sampleData?.lastRows ?? [];
        const startRowIndex = sheet.rowCount - afterLast.length;
        cellsSampled += this.countCells(afterLast);
        this.collectSampleChanges(
          sheet.title,
          afterLast,
          beforeLast,
          startRowIndex,
          samples.lastRows,
          changedRows
        );
      }
    }

    return {
      tier: 'SAMPLE',
      samples,
      summary: {
        rowsChanged: changedRows.size,
        cellsSampled,
      },
    };
  }

  /**
   * Full cell-by-cell diff (Tier 3) - Compares cells up to limit
   */
  private async fullDiff(
    before: SpreadsheetState,
    after: SpreadsheetState
  ): Promise<DiffResult> {
    const changes: CellChangeRecord[] = [];

    let cellsCompared = 0;
    let cellsAdded = 0;
    let cellsRemoved = 0;
    const maxCells = this.maxFullDiffCells;

    for (const afterSheet of after.sheets) {
      if (cellsCompared >= maxCells) break;
      const beforeSheet = before.sheets.find(s => s.sheetId === afterSheet.sheetId);
      const afterValues = await this.ensureValues(
        afterSheet,
        after.spreadsheetId,
        maxCells - cellsCompared
      );
      const beforeValues = beforeSheet
        ? await this.ensureValues(beforeSheet, before.spreadsheetId, maxCells - cellsCompared)
        : [];

      const maxRows = Math.max(afterValues.length, beforeValues.length);

      for (let row = 0; row < maxRows && cellsCompared < maxCells; row++) {
        const afterRow = afterValues[row] ?? [];
        const beforeRow = beforeValues[row] ?? [];
        const maxCols = Math.max(afterRow.length, beforeRow.length);

        for (let col = 0; col < maxCols && cellsCompared < maxCells; col++) {
          const afterVal = afterRow[col];
          const beforeVal = beforeRow[col];

          if (beforeVal !== afterVal) {
            changes.push({
              cell: this.formatCell(afterSheet.title, col, row),
              before: beforeVal,
              after: afterVal,
              type: 'value',
            });
          }

          if (beforeVal === undefined && afterVal !== undefined) {
            cellsAdded++;
          }
          if (beforeVal !== undefined && afterVal === undefined) {
            cellsRemoved++;
          }
          cellsCompared++;
        }
      }
    }

    // Check for removed sheets
    for (const beforeSheet of before.sheets) {
      const stillExists = after.sheets.some(s => s.sheetId === beforeSheet.sheetId);
      if (!stillExists) {
        cellsRemoved += beforeSheet.rowCount * beforeSheet.columnCount;
      }
    }

    return {
      tier: 'FULL',
      changes,
      summary: {
        cellsChanged: changes.length,
        cellsAdded,
        cellsRemoved,
      },
    };
  }

  /**
   * Convert column index to letter (0 = A, 25 = Z, 26 = AA)
   */
  private columnIndexToLetter(index: number): string {
    let letter = '';
    let temp = index + 1;
    while (temp > 0) {
      const mod = (temp - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      temp = Math.floor((temp - 1) / 26);
    }
    return letter || 'A';
  }

  private formatCell(sheetTitle: string, colIndex: number, rowIndex: number): string {
    const sheetPrefix = sheetTitle ? `'${sheetTitle.replace(/'/g, "''")}'!` : '';
    return `${sheetPrefix}${this.columnIndexToLetter(colIndex)}${rowIndex + 1}`;
  }

  /**
   * Select appropriate diff tier based on data size
   */
  private selectTier(
    before: SpreadsheetState,
    after: SpreadsheetState,
    options?: DiffOptions
  ): 'METADATA' | 'SAMPLE' | 'FULL' {
    const requestedTier = options?.tier ?? this.defaultTier;
    const maxFull = options?.maxFullDiffCells ?? this.maxFullDiffCells;
    
    // Estimate total cells
    const beforeCells = before.sheets.reduce(
      (sum, s) => sum + s.rowCount * s.columnCount,
      0
    );
    const afterCells = after.sheets.reduce(
      (sum, s) => sum + s.rowCount * s.columnCount,
      0
    );
    const maxCells = Math.max(beforeCells, afterCells);

    // Auto-downgrade based on size
    if (requestedTier === 'FULL' && maxCells > maxFull) {
      return 'SAMPLE';
    }
    if (requestedTier === 'SAMPLE' && maxCells > maxFull * 10) {
      return 'METADATA';
    }

    return requestedTier;
  }

  /**
   * Estimate number of changed cells
   */
  private estimateChangedCells(
    before: SpreadsheetState,
    after: SpreadsheetState
  ): number {
    if (before.checksum === after.checksum) {
      return 0;
    }

    // Rough estimate: if checksums differ, assume some percentage changed
    const totalCells = after.sheets.reduce(
      (sum, s) => sum + s.rowCount * s.columnCount,
      0
    );
    
    // Check for structural changes
    const beforeSheets = before.sheets.length;
    const afterSheets = after.sheets.length;
    
    if (beforeSheets !== afterSheets) {
      // Major structural change
      return totalCells;
    }

    // Assume 10% changed if checksums differ but structure is same
    return Math.ceil(totalCells * 0.1);
  }

  private async getRangeValues(
    spreadsheetId: string,
    range: string
  ): Promise<CellValue[][]> {
    try {
      const response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: 'UNFORMATTED_VALUE',
      });
      return (response.data.values ?? []) as CellValue[][];
    } catch {
      return [];
    }
  }

  private collectSampleChanges(
    sheetTitle: string,
    afterValues: CellValue[][],
    beforeValues: CellValue[][],
    rowOffset: number,
    bucket: CellChangeRecord[],
    changedRows: Set<number>
  ): void {
    for (let row = 0; row < afterValues.length; row++) {
      const afterRow = afterValues[row] ?? [];
      const beforeRow = beforeValues[row] ?? [];
      const maxCols = Math.max(afterRow.length, beforeRow.length);
      let rowChanged = false;

      for (let col = 0; col < maxCols; col++) {
        const afterVal = afterRow[col];
        const beforeVal = beforeRow[col];
        if (afterVal !== beforeVal) {
          rowChanged = true;
          bucket.push({
            cell: this.formatCell(sheetTitle, col, rowOffset + row),
            before: beforeVal,
            after: afterVal,
            type: 'value',
          });
        }
      }

      if (rowChanged) {
        changedRows.add(rowOffset + row);
      }
    }
  }

  private countCells(values: CellValue[][]): number {
    return values.reduce((sum, row) => sum + (row?.length ?? 0), 0);
  }

  private async ensureValues(
    sheet: SheetState,
    spreadsheetId: string,
    remainingBudget: number
  ): Promise<CellValue[][]> {
    if (sheet.values) {
      return sheet.values;
    }

    const rowCount = sheet.rowCount;
    const columnCount = sheet.columnCount;
    const maxRows = Math.min(
      rowCount,
      Math.ceil(remainingBudget / Math.max(columnCount, 1))
    );
    const endCol = this.columnIndexToLetter(Math.min(Math.max(columnCount - 1, 0), 25));
    const range = `'${sheet.title.replace(/'/g, "''")}'!A1:${endCol}${Math.max(maxRows, 1)}`;

    const values = await this.getRangeValues(spreadsheetId, range);
    sheet.values = values;
    return values;
  }
}
