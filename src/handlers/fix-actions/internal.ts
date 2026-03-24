/**
 * Fix Handler Internal Types & Handler Access
 *
 * Provides typed access to FixHandler private methods and internal state
 * needed by submodule functions.
 */

import type { sheets_v4 } from 'googleapis';
import type { HandlerContext, HandlerError } from '../base.js';
import type { CleanCellChange, SheetsFixResponse } from '../../schemas/fix.js';

/**
 * Handler access type for fix-actions submodules
 *
 * Exposes only the methods and properties needed by submodule functions.
 * Uses `_` prefix to indicate internal/private methods that are exposed
 * for submodule delegation only.
 */
export interface FixHandlerAccess {
  // Public handler properties
  readonly context: HandlerContext;

  // Internal methods exposed for submodule delegation
  _fetchRangeData(
    spreadsheetId: string,
    range: string
  ): Promise<(string | number | boolean | null)[][]>;

  _writeChanges(
    spreadsheetId: string,
    range: string,
    originalData: (string | number | boolean | null)[][],
    changes: CleanCellChange[],
    rangeOffset: { startRow: number; startCol: number }
  ): Promise<void>;

  _createSnapshot(spreadsheetId: string): Promise<{ revisionId: string } | undefined>;

  _confirmOperation(
    title: string,
    description: string,
    metadata: { isDestructive: boolean; operationType: string },
    options: { skipIfElicitationUnavailable: boolean }
  ): Promise<boolean>;

  _trackContextFromRequest(data: { spreadsheetId: string }): void;

  _applyVerbosityFilter<T extends SheetsFixResponse>(
    response: T,
    verbosity: 'minimal' | 'standard' | 'detailed'
  ): T;

  _mapError(error: unknown): HandlerError;

  _sendProgress(current: number, total: number, message: string): Promise<void>;

  // Sheets API access
  readonly sheetsApi: sheets_v4.Sheets;
}
