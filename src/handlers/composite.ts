/**
 * ServalSheets - Composite Operations Handler
 *
 * Handles high-level composite operations (import_csv, smart_append, etc.)
 *
 * MCP Protocol: 2025-11-25
 * Google Sheets API: v4
 *
 * @module handlers/composite
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext, type HandlerError } from './base.js';
import {
  CompositeOperationsService,
  type CsvImportResult,
  type SmartAppendResult,
  type BulkUpdateResult,
  type DeduplicateResult,
} from '../services/composite-operations.js';
import { SheetResolver, initializeSheetResolver } from '../services/sheet-resolver.js';
import type {
  CompositeInput,
  CompositeOutput,
  CompositeImportCsvInput,
  CompositeSmartAppendInput,
  CompositeBulkUpdateInput,
  CompositeDeduplicateInput,
} from '../schemas/composite.js';
import type { Intent } from '../core/intent.js';
import { getRequestLogger } from '../utils/request-context.js';
import type { VerbosityLevel } from '../utils/response-optimizer.js';

// ============================================================================
// Handler
// ============================================================================

/**
 * Composite Operations Handler
 *
 * Provides high-level operations that combine multiple API calls.
 */
export class CompositeHandler extends BaseHandler<CompositeInput, CompositeOutput> {
  private sheetsApi: sheets_v4.Sheets;
  private compositeService: CompositeOperationsService;
  private sheetResolver: SheetResolver;

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_composite', context);
    this.sheetsApi = sheetsApi;

    // Initialize sheet resolver
    this.sheetResolver = initializeSheetResolver(sheetsApi);

    // Initialize composite operations service
    this.compositeService = new CompositeOperationsService(sheetsApi, this.sheetResolver);
  }

  /**
   * Apply verbosity filtering to optimize token usage (LLM optimization)
   */
  private applyVerbosityFilter(
    response: CompositeOutput['response'],
    verbosity: VerbosityLevel
  ): CompositeOutput['response'] {
    if (!response.success || verbosity === 'standard') {
      return response;
    }

    if (verbosity === 'minimal') {
      // For minimal verbosity, strip _meta field
      const { _meta, ...rest } = response as Record<string, unknown>;
      return rest as CompositeOutput['response'];
    }

    return response;
  }

  async handle(input: CompositeInput): Promise<CompositeOutput> {
    const logger = getRequestLogger();
    this.trackSpreadsheetId(input.spreadsheetId);

    try {
      let response: CompositeOutput['response'];

      switch (input.action) {
        case 'import_csv':
          response = await this.handleImportCsv(input as CompositeImportCsvInput);
          break;
        case 'smart_append':
          response = await this.handleSmartAppend(input as CompositeSmartAppendInput);
          break;
        case 'bulk_update':
          response = await this.handleBulkUpdate(input as CompositeBulkUpdateInput);
          break;
        case 'deduplicate':
          response = await this.handleDeduplicate(input as CompositeDeduplicateInput);
          break;
        default:
          throw new Error(`Unknown action: ${input.action}`);
      }

      // Track context
      this.trackContextFromRequest({
        spreadsheetId: input.spreadsheetId,
      });

      // Apply verbosity filtering (LLM optimization)
      const verbosity: VerbosityLevel =
        'verbosity' in input
          ? ((input as { verbosity?: VerbosityLevel }).verbosity ?? 'standard')
          : 'standard';
      const filteredResponse = this.applyVerbosityFilter(response, verbosity);

      return { response: filteredResponse };
    } catch (error) {
      logger.error('Composite operation failed', {
        action: input.action,
        error: error instanceof Error ? error.message : String(error),
      });
      return { response: this.mapError(error) as HandlerError };
    }
  }

  protected createIntents(_input: CompositeInput): Intent[] {
    // Composite operations use services directly, not intents
    return [];
  }

  // ==========================================================================
  // Action Handlers
  // ==========================================================================

  private async handleImportCsv(
    input: CompositeImportCsvInput
  ): Promise<CompositeOutput['response']> {
    const result: CsvImportResult = await this.compositeService.importCsv({
      spreadsheetId: input.spreadsheetId,
      sheet:
        input.sheet !== undefined
          ? typeof input.sheet === 'string'
            ? input.sheet
            : input.sheet
          : undefined,
      csvData: input.csvData,
      delimiter: input.delimiter,
      hasHeader: input.hasHeader,
      mode: input.mode,
      newSheetName: input.newSheetName,
      skipEmptyRows: input.skipEmptyRows,
      trimValues: input.trimValues,
    });

    return {
      success: true as const,
      action: 'import_csv' as const,
      ...result,
      mutation: {
        cellsAffected: result.rowsImported * result.columnsImported,
        reversible: false,
      },
      _meta: this.generateMeta(
        'import_csv',
        input as unknown as Record<string, unknown>,
        result as unknown as Record<string, unknown>,
        {
          cellsAffected: result.rowsImported * result.columnsImported,
        }
      ),
    };
  }

  private async handleSmartAppend(
    input: CompositeSmartAppendInput
  ): Promise<CompositeOutput['response']> {
    const result: SmartAppendResult = await this.compositeService.smartAppend({
      spreadsheetId: input.spreadsheetId,
      sheet: input.sheet,
      data: input.data,
      matchHeaders: input.matchHeaders,
      createMissingColumns: input.createMissingColumns,
      skipEmptyRows: input.skipEmptyRows,
    });

    const cellsAffected = result.rowsAppended * result.columnsMatched.length;

    return {
      success: true as const,
      action: 'smart_append' as const,
      ...result,
      mutation: {
        cellsAffected,
        reversible: false,
      },
      _meta: this.generateMeta(
        'smart_append',
        input as unknown as Record<string, unknown>,
        result as unknown as Record<string, unknown>,
        { cellsAffected }
      ),
    };
  }

  private async handleBulkUpdate(
    input: CompositeBulkUpdateInput
  ): Promise<CompositeOutput['response']> {
    const result: BulkUpdateResult = await this.compositeService.bulkUpdate({
      spreadsheetId: input.spreadsheetId,
      sheet: input.sheet,
      keyColumn: input.keyColumn,
      updates: input.updates,
      createUnmatched: input.createUnmatched,
    });

    return {
      success: true as const,
      action: 'bulk_update' as const,
      ...result,
      mutation: {
        cellsAffected: result.cellsModified,
        reversible: false,
      },
      _meta: this.generateMeta(
        'bulk_update',
        input as unknown as Record<string, unknown>,
        result as unknown as Record<string, unknown>,
        {
          cellsAffected: result.cellsModified,
        }
      ),
    };
  }

  private async handleDeduplicate(
    input: CompositeDeduplicateInput
  ): Promise<CompositeOutput['response']> {
    const result: DeduplicateResult = await this.compositeService.deduplicate({
      spreadsheetId: input.spreadsheetId,
      sheet: input.sheet,
      keyColumns: input.keyColumns,
      keep: input.keep,
      preview: input.preview,
    });

    return {
      success: true as const,
      action: 'deduplicate' as const,
      ...result,
      mutation:
        result.rowsDeleted > 0
          ? {
              cellsAffected: result.rowsDeleted,
              reversible: false,
            }
          : undefined,
      _meta: this.generateMeta(
        'deduplicate',
        input as unknown as Record<string, unknown>,
        result as unknown as Record<string, unknown>
      ),
    };
  }
}
