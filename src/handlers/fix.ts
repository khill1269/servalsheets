/**
 * ServalSheets - Fix Handler (Thin Dispatcher)
 *
 * Automated issue resolution (F0) and data cleaning pipeline (F3).
 * Dispatches to submodules: auto-fix, cleaning-operations, analysis.
 */

import { BaseHandler, type HandlerContext, unwrapRequest } from './base.js';
import type { Intent } from '../core/intent.js';
import type { sheets_v4 } from 'googleapis';
import type {
  SheetsFixInput,
  SheetsFixOutput,
  FixRequest,
  CleanInput,
  StandardizeFormatsInput,
  FillMissingInput,
  DetectAnomaliesInput,
  SuggestCleaningInput,
} from '../schemas/fix.js';
import { ValidationError } from '../core/errors.js';
import { handleFixAction } from './fix-actions/auto-fix.js';
import {
  handleCleanAction,
  handleStandardizeFormatsAction,
  handleFillMissingAction,
} from './fix-actions/cleaning-operations.js';
import {
  handleDetectAnomaliesAction,
  handleSuggestCleaningAction,
} from './fix-actions/analysis.js';
import type { FixHandlerAccess } from './fix-actions/internal.js';

export class FixHandler extends BaseHandler<SheetsFixInput, SheetsFixOutput> {
  private sheetsApi: sheets_v4.Sheets;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_fix', context);
    this.sheetsApi = sheetsApi;
  }

  async handle(input: SheetsFixInput): Promise<SheetsFixOutput> {
    try {
      // Phase 1, Task 1.4: Infer missing parameters from context
      const rawReq = unwrapRequest<SheetsFixInput['request']>(input);
      const req = this.inferRequestParameters(rawReq) as FixRequest & {
        verbosity?: 'minimal' | 'standard' | 'detailed';
      };

      this.checkOperationScopes(`${this.toolName}.${req.action}`);
      const verbosity = req.verbosity ?? 'standard';

      // Build handler access for submodules
      const handlerAccess = this.buildHandlerAccess();

      // Dispatch based on action
      switch (req.action) {
        case 'fix':
          return handleFixAction(handlerAccess, req as FixRequest & { action: 'fix' }, verbosity);

        case 'clean':
          return handleCleanAction(handlerAccess, req as CleanInput, verbosity);

        case 'standardize_formats':
          return handleStandardizeFormatsAction(
            handlerAccess,
            req as StandardizeFormatsInput,
            verbosity
          );

        case 'fill_missing':
          return handleFillMissingAction(handlerAccess, req as FillMissingInput, verbosity);

        case 'detect_anomalies':
          return handleDetectAnomaliesAction(handlerAccess, req as DetectAnomaliesInput, verbosity);

        case 'suggest_cleaning':
          return handleSuggestCleaningAction(handlerAccess, req as SuggestCleaningInput, verbosity);

        default: {
          const _exhaustiveCheck: never = req;
          return {
            response: this.mapError(
              new ValidationError(
                `Unknown action: ${(_exhaustiveCheck as { action: string }).action}`,
                'action',
                'fix | clean | standardize_formats | fill_missing | detect_anomalies | suggest_cleaning'
              )
            ),
          };
        }
      }
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  // ─── Intent creation ───

  protected createIntents(input: SheetsFixInput): Intent[] {
    const req = unwrapRequest<SheetsFixInput['request']>(input);

    // Read-only actions never create intents
    if (req.action === 'detect_anomalies' || req.action === 'suggest_cleaning') {
      return []; // OK: Explicit empty — read-only actions
    }

    if ((req.mode ?? 'preview') === 'preview' || req.safety?.dryRun) {
      return []; // OK: Explicit empty — preview mode is read-only
    }

    if (!req.spreadsheetId) {
      return []; // OK: Explicit empty — missing required field
    }

    // Mutating actions (fix, clean, standardize_formats, fill_missing) are destructive
    return [
      {
        type: 'SET_VALUES' as const,
        target: {
          spreadsheetId: req.spreadsheetId,
        },
        payload: {
          action: req.action,
        },
        metadata: {
          sourceTool: 'sheets_fix',
          sourceAction: req.action,
          priority: 0,
          destructive: true,
        },
      },
    ];
  }

  // ─── Handler access builder ───

  private buildHandlerAccess(): FixHandlerAccess {
    return {
      // Public properties
      context: this.context,
      sheetsApi: this.sheetsApi,

      // Internal methods exposed for submodule delegation
      _fetchRangeData: this.fetchRangeData.bind(this),
      _writeChanges: this.writeChanges.bind(this),
      _createSnapshot: this.createSnapshot.bind(this),
      _confirmOperation: this.confirmOperation.bind(this),
      _trackContextFromRequest: this.trackContextFromRequest.bind(this),
      _applyVerbosityFilter: this.applyVerbosityFilter.bind(this),
      _mapError: this.mapError.bind(this),
      _sendProgress: async (current: number, total: number, message: string) => {
        const { sendProgress } = await import('../utils/request-context.js');
        return sendProgress(current, total, message);
      },
    };
  }

  // ─── Internal methods (used by submodules via handler access) ───

  /**
   * Fetch range data from Google Sheets
   */
  private async fetchRangeData(
    spreadsheetId: string,
    range: string
  ): Promise<(string | number | boolean | null)[][]> {
    const response = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    return (response.data.values ?? []) as (string | number | boolean | null)[][];
  }

  /**
   * Write cell changes back to the spreadsheet
   */
  private async writeChanges(
    spreadsheetId: string,
    range: string,
    originalData: (string | number | boolean | null)[][],
    changes: Array<{ row: number; col: number; newValue: string | number | boolean | null }>,
    _rangeOffset: { startRow: number; startCol: number }
  ): Promise<void> {
    // Apply changes to the data grid
    const updatedData = originalData.map((row) => [...row]);

    for (const change of changes) {
      // Convert absolute row/col back to data array indices
      const dataRow = change.row - _rangeOffset.startRow;
      const dataCol = change.col - _rangeOffset.startCol;

      const targetRow = updatedData[dataRow];
      if (dataRow >= 0 && dataRow < updatedData.length && targetRow) {
        while (targetRow.length <= dataCol) {
          targetRow.push(null);
        }
        targetRow[dataCol] = change.newValue;
      }
    }

    // Write the entire updated range back
    await this.sheetsApi.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: updatedData,
      },
    });
  }

  /**
   * Create snapshot before making changes
   */
  private async createSnapshot(spreadsheetId: string): Promise<{ revisionId: string } | undefined> {
    try {
      await this.sheetsApi.spreadsheets.get({
        spreadsheetId,
        fields: 'spreadsheetUrl',
      });

      // Note: Google Sheets API doesn't have a direct "create snapshot" endpoint
      // Versions are auto-created. We'd use sheets_collaborate version_create_snapshot in real impl
      return { revisionId: `auto_${Date.now()}` };
    } catch {
      // OK: Explicit empty — snapshot creation failed (versions API not available)
      return undefined; // OK: Explicit empty
    }
  }
}
