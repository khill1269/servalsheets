/**
 * ServalSheets - Data Handler (Refactored)
 *
 * Consolidated data operations handler combining:
 * - Cell value operations (read, write, append, clear, find, replace)
 * - Cell-level operations (notes, validation, hyperlinks, merge, cut, copy)
 *
 * Architecture: Single class with direct methods (like sheets_format)
 * MCP Protocol: 2025-11-25
 *
 * Refactored to remove:
 * - Sub-handler delegation (ValuesOperations, CellsOperations)
 * - Circuit breaker fallbacks
 * - Batching system integration
 * - Request deduplication
 * - Dynamic imports
 *
 * Now uses:
 * - Direct Google API calls
 * - Proper MCP elicitation capability checking with try/catch
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext, unwrapRequest } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsDataInput, SheetsDataOutput, DataResponse } from '../schemas/data.js';
import { getEnv } from '../config/env.js';
import { getETagCache } from '../services/etag-cache.js';
import { v4 as uuidv4 } from 'uuid';

// Type alias for the request union
type DataRequest = SheetsDataInput['request'];
import type { ValuesArray } from '../schemas/index.js';
import type { RangeInput } from '../schemas/shared.js';
import { confirmDestructiveAction } from '../mcp/elicitation.js';
import { validateHyperlinkUrl } from '../utils/url.js';
import {
  validateValuesPayload,
  validateValuesBatchPayload,
  type PayloadSizeResult,
} from '../utils/payload-validator.js';
import {
  buildA1Notation,
  buildGridRangeInput,
  parseA1Notation,
  parseCellReference,
  toGridRange,
  type GridRangeInput,
} from '../utils/google-sheets-helpers.js';

const DEFAULT_READ_PAGE_SIZE = 1000;
// Heuristic safety limit to keep read payloads small and latency predictable.
const MAX_CELLS_PER_REQUEST = 10_000;

/**
 * Main handler for sheets_data tool
 * Single class with direct methods - no sub-handler delegation
 */
export class SheetsDataHandler extends BaseHandler<SheetsDataInput, SheetsDataOutput> {
  private sheetsApi: sheets_v4.Sheets;
  private featureFlags: {
    enableDataFilterBatch: boolean;
    enableTableAppends: boolean;
    enablePayloadValidation: boolean;
  };

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_data', context);
    this.sheetsApi = sheetsApi;
    const env = getEnv();
    this.featureFlags = {
      enableDataFilterBatch: env.ENABLE_DATAFILTER_BATCH,
      enableTableAppends: env.ENABLE_TABLE_APPENDS,
      enablePayloadValidation: env.ENABLE_PAYLOAD_VALIDATION,
    };
    // No circuit breaker registration - direct API calls only
  }

  /**
   * Record access pattern and trigger background prefetch (Phase 3)
   * Non-blocking - errors are logged but don't affect the main operation
   */
  private recordAccessAndTriggerPrefetch(
    spreadsheetId: string,
    range: string,
    action: 'read' | 'write'
  ): void {
    try {
      // Record access pattern
      const tracker = this.context.accessPatternTracker;
      if (tracker) {
        tracker.recordAccess({
          spreadsheetId,
          range,
          action,
        });
      }

      // Trigger background prefetch for read operations
      if (action === 'read' && this.context.prefetchPredictor && this.context.cachedSheetsApi) {
        const predictor = this.context.prefetchPredictor;
        const cachedApi = this.context.cachedSheetsApi;

        // Learn from history and generate predictions
        predictor.learnFromHistory();
        const predictions = predictor.predict();

        if (predictions.length > 0) {
          // Execute prefetches in background (non-blocking)
          predictor
            .prefetchInBackground(predictions, async (pred) => {
              if (pred.tool === 'sheets_data' && pred.action === 'read' && pred.params['range']) {
                const prefetchRange = pred.params['range'] as string;
                const prefetchSpreadsheetId =
                  (pred.params['spreadsheetId'] as string) || spreadsheetId;
                await cachedApi.getValues(prefetchSpreadsheetId, prefetchRange);
              }
            })
            .catch((err) => {
              // Log but don't propagate prefetch errors
              this.context.logger?.warn?.('Prefetch failed', { error: String(err) });
            });
        }
      }
    } catch (err) {
      // Non-blocking - log but don't affect main operation
      this.context.logger?.warn?.('Pattern recording failed', { error: String(err) });
    }
  }

  async handle(input: SheetsDataInput): Promise<SheetsDataOutput> {
    this.requireAuth();

    const inferredRequest = this.inferRequestParameters(
      unwrapRequest<SheetsDataInput['request']>(input)
    ) as DataRequest;

    // Set verbosity early to skip metadata generation for minimal mode (saves ~400-800 tokens)
    const verbosity = inferredRequest.verbosity ?? 'standard';
    this.setVerbosity(verbosity);

    // Track spreadsheet ID for better error messages
    if ('spreadsheetId' in inferredRequest) {
      this.trackSpreadsheetId(inferredRequest.spreadsheetId);
    }

    try {
      const response = await this.executeAction(inferredRequest);

      // Track context after successful operation
      if (response.success && 'spreadsheetId' in inferredRequest) {
        this.trackContextFromRequest({
          spreadsheetId: inferredRequest.spreadsheetId,
          sheetId:
            'sheetId' in inferredRequest
              ? typeof inferredRequest.sheetId === 'number'
                ? inferredRequest.sheetId
                : undefined
              : undefined,
          range:
            'range' in inferredRequest
              ? typeof inferredRequest.range === 'string'
                ? inferredRequest.range
                : undefined
              : undefined,
        });
      }

      // Apply verbosity filtering (LLM optimization)
      const verbosity = inferredRequest.verbosity ?? 'standard';
      const filteredResponse = super.applyVerbosityFilter(response, verbosity);

      return { response: filteredResponse } as SheetsDataOutput;
    } catch (err) {
      return { response: this.mapError(err) } as SheetsDataOutput;
    }
  }

  protected createIntents(input: SheetsDataInput): Intent[] {
    const req = unwrapRequest<SheetsDataInput['request']>(input);
    if (!('spreadsheetId' in req)) {
      return [];
    }
    const baseIntent = {
      target: {
        spreadsheetId: req.spreadsheetId,
      },
      metadata: {
        sourceTool: this.toolName,
        sourceAction: req.action,
        priority: 1,
        destructive: false,
      },
    };

    switch (req.action) {
      case 'write':
        return [
          {
            ...baseIntent,
            type: 'SET_VALUES' as const,
            payload: { values: req.values },
            metadata: {
              ...baseIntent.metadata,
              estimatedCells: req.values.reduce((sum, row) => sum + row.length, 0),
            },
          },
        ];
      case 'append':
        return [
          {
            ...baseIntent,
            type: 'APPEND_VALUES' as const,
            payload: { values: req.values },
            metadata: {
              ...baseIntent.metadata,
              estimatedCells: req.values.reduce((sum, row) => sum + row.length, 0),
            },
          },
        ];
      case 'clear':
        return [
          {
            ...baseIntent,
            type: 'CLEAR_VALUES' as const,
            payload: {},
            metadata: {
              ...baseIntent.metadata,
              destructive: true,
            },
          },
        ];
      default:
        return [];
    }
  }

  /**
   * Route action to appropriate handler method - direct dispatch, no sub-handlers
   */
  private async executeAction(request: DataRequest): Promise<DataResponse> {
    switch (request.action) {
      // Values operations
      case 'read':
        return this.handleRead(request);
      case 'write':
        return this.handleWrite(request);
      case 'append':
        return this.handleAppend(request);
      case 'clear':
        return this.handleClear(request);
      case 'batch_read':
        return this.handleBatchRead(request);
      case 'batch_write':
        return this.handleBatchWrite(request);
      case 'batch_clear':
        return this.handleBatchClear(request);
      case 'find_replace':
        return this.handleFindReplace(request);
      // Cells operations
      case 'add_note':
        return this.handleAddNote(request);
      case 'get_note':
        return this.handleGetNote(request);
      case 'clear_note':
        return this.handleClearNote(request);
      // set_validation, clear_validation removed in v2.0 - moved to sheets_format
      case 'set_hyperlink':
        return this.handleSetHyperlink(request);
      case 'clear_hyperlink':
        return this.handleClearHyperlink(request);
      case 'merge_cells':
        return this.handleMergeCells(request);
      case 'unmerge_cells':
        return this.handleUnmergeCells(request);
      case 'get_merges':
        return this.handleGetMerges(request);
      case 'cut_paste':
        return this.handleCutPaste(request);
      case 'copy_paste':
        return this.handleCopyPaste(request);
      default:
        return this.error({
          code: 'INVALID_PARAMS',
          message: `Unknown action: ${(request as { action: string }).action}`,
          retryable: false,
        });
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  /**
   * Resolve a range input to A1 notation string
   * Handles both string and RangeInput types
   */
  private async resolveRangeToA1(
    spreadsheetId: string,
    range: RangeInput | string
  ): Promise<string> {
    const rangeInput = typeof range === 'string' ? { a1: range } : range;
    const resolved = await this.context.rangeResolver.resolve(spreadsheetId, rangeInput);
    return resolved.a1Notation;
  }

  // columnToLetter is inherited from BaseHandler

  private estimateCellsFromGridRange(range: {
    startRowIndex?: number;
    endRowIndex?: number;
    startColumnIndex?: number;
    endColumnIndex?: number;
  }): number {
    if (
      range.startRowIndex === undefined ||
      range.endRowIndex === undefined ||
      range.startColumnIndex === undefined ||
      range.endColumnIndex === undefined
    ) {
      return 0;
    }

    const rows = Math.max(range.endRowIndex - range.startRowIndex, 0);
    const columns = Math.max(range.endColumnIndex - range.startColumnIndex, 0);
    return rows * columns;
  }

  private escapeFormulaString(value: string): string {
    return value.replace(/"/g, '""');
  }

  private buildPayloadWarnings(
    action: string,
    validation: {
      level: 'none' | 'warning' | 'critical' | 'exceeded';
      message: string;
      suggestions?: string[];
    }
  ): string[] | undefined {
    if (validation.level === 'none') {
      return undefined;
    }

    if (validation.level !== 'exceeded') {
      this.context.metrics?.recordPayloadWarning({
        level: validation.level,
        tool: this.toolName,
        action,
      });
    }

    const warnings = [validation.message];
    if (validation.suggestions && validation.suggestions.length > 0) {
      warnings.push(...validation.suggestions);
    }
    return warnings;
  }

  private payloadTooLargeError(
    action: string,
    validation: {
      message: string;
      sizeMB: string;
      suggestions?: string[];
      estimatedSplitCount?: number;
    }
  ): DataResponse {
    this.context.metrics?.recordPayloadWarning({
      level: 'exceeded',
      tool: this.toolName,
      action,
    });

    return this.error({
      code: 'PAYLOAD_TOO_LARGE',
      message: validation.message,
      retryable: false,
      suggestedFix: validation.suggestions?.join('; ') || 'Split request into smaller batches',
      details: {
        payloadSizeMB: validation.sizeMB,
        limitMB: 9,
        estimatedSplitCount: validation.estimatedSplitCount,
      },
    });
  }

  private validateValuesPayloadIfEnabled(values: ValuesArray, range?: string): PayloadSizeResult {
    if (!this.featureFlags.enablePayloadValidation) {
      return {
        sizeBytes: 0,
        sizeMB: '0.00',
        withinLimits: true,
        level: 'none',
        message: 'Payload validation disabled',
      };
    }

    return validateValuesPayload(values, range);
  }

  private validateValuesBatchPayloadIfEnabled(
    data: Array<{ values: ValuesArray }>
  ): PayloadSizeResult {
    if (!this.featureFlags.enablePayloadValidation) {
      return {
        sizeBytes: 0,
        sizeMB: '0.00',
        withinLimits: true,
        level: 'none',
        message: 'Payload validation disabled',
      };
    }

    return validateValuesBatchPayload(data, {
      spreadsheetId: this.currentSpreadsheetId,
      operationType: 'values.batchUpdate',
    });
  }

  private decodeCursor(cursor?: string): number | null {
    if (!cursor) return 0;
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const offset = Number.parseInt(decoded, 10);
      return Number.isFinite(offset) ? offset : null;
    } catch {
      return null;
    }
  }

  private encodeCursor(offset: number): string {
    return Buffer.from(String(offset)).toString('base64');
  }

  private buildPaginationPlan(options: {
    range: string;
    cursor?: string;
    pageSize?: number;
    chunkSize?: number;
    streaming?: boolean;
  }):
    | {
        range: string;
        hasMore: boolean;
        nextCursor?: string;
        totalRows: number;
      }
    | { error: DataResponse }
    | undefined {
    const { range, cursor, pageSize, chunkSize, streaming } = options;
    const wantsPagination = Boolean(cursor || pageSize || streaming);

    let parsed;
    try {
      parsed = parseA1Notation(range);
    } catch (error) {
      if (wantsPagination) {
        return {
          error: this.error({
            code: 'INVALID_PARAMS',
            message: 'Pagination is not supported for this range format',
            retryable: false,
            details: {
              range,
              reason: error instanceof Error ? error.message : String(error),
            },
          }),
        };
      }
      return undefined;
    }

    const totalRows = Math.max(parsed.endRow - parsed.startRow, 0);
    const totalColumns = Math.max(parsed.endCol - parsed.startCol, 1);
    const totalCells = totalRows * totalColumns;
    const autoPaginate = totalCells > MAX_CELLS_PER_REQUEST;
    if (!wantsPagination && !autoPaginate) {
      return undefined;
    }

    const maxRowsPerPage = Math.max(1, Math.floor(MAX_CELLS_PER_REQUEST / totalColumns));
    const effectivePageSize = Math.min(
      pageSize ?? chunkSize ?? DEFAULT_READ_PAGE_SIZE,
      maxRowsPerPage
    );
    const offset = this.decodeCursor(cursor);
    if (offset === null || offset < 0 || offset >= totalRows) {
      return {
        error: this.error({
          code: 'INVALID_PARAMS',
          message: 'Invalid pagination cursor',
          retryable: false,
          details: { cursor },
        }),
      };
    }

    const pageStart = parsed.startRow + offset;
    const pageEnd = Math.min(pageStart + effectivePageSize, parsed.endRow);
    const pageRange = buildA1Notation(
      parsed.sheetName,
      parsed.startCol,
      pageStart,
      parsed.endCol,
      pageEnd
    );
    const hasMore = pageEnd < parsed.endRow;
    const nextCursor = hasMore ? this.encodeCursor(pageEnd - parsed.startRow) : undefined;

    return {
      range: pageRange,
      hasMore,
      nextCursor,
      totalRows,
    };
  }

  private buildRowData(values: ValuesArray, valueInputOption: string): sheets_v4.Schema$RowData[] {
    return values.map((rowValues: unknown[]) => ({
      values: rowValues.map((cellValue: unknown) => {
        const isFormula = typeof cellValue === 'string' && cellValue.startsWith('=');

        if (valueInputOption === 'USER_ENTERED' || valueInputOption === 'RAW') {
          if (isFormula) {
            return { userEnteredValue: { formulaValue: cellValue as string } };
          }
          if (typeof cellValue === 'number') {
            return { userEnteredValue: { numberValue: cellValue } };
          }
          if (typeof cellValue === 'boolean') {
            return { userEnteredValue: { boolValue: cellValue } };
          }
          return { userEnteredValue: { stringValue: String(cellValue) } };
        }

        return { userEnteredValue: { stringValue: String(cellValue) } };
      }),
    }));
  }

  private async cellToGridRange(spreadsheetId: string, cell: string): Promise<GridRangeInput> {
    const parsed = parseCellReference(cell);
    const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);

    return buildGridRangeInput(sheetId, parsed.row, parsed.row + 1, parsed.col, parsed.col + 1);
  }

  private async a1ToGridRange(spreadsheetId: string, a1: string): Promise<GridRangeInput> {
    const parsed = parseA1Notation(a1);
    const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);

    return buildGridRangeInput(
      sheetId,
      parsed.startRow,
      parsed.endRow,
      parsed.startCol,
      parsed.endCol
    );
  }

  /**
   * Request confirmation for destructive operations with proper capability checking
   * Returns true if operation should proceed, false if cancelled
   */
  private async requestDestructiveConfirmation(
    action: string,
    description: string,
    estimatedCells: number,
    threshold: number = 100
  ): Promise<{ proceed: boolean; reason?: string }> {
    // Only request confirmation for operations above threshold
    if (estimatedCells <= threshold) {
      return { proceed: true };
    }

    // Check if elicitation is available
    if (!this.context.elicitationServer) {
      // No elicitation server, proceed without confirmation
      return { proceed: true };
    }

    try {
      const confirmation = await confirmDestructiveAction(
        this.context.elicitationServer,
        action,
        description
      );

      if (!confirmation.confirmed) {
        return { proceed: false, reason: confirmation.reason || 'User cancelled the operation' };
      }

      return { proceed: true };
    } catch (err) {
      // If elicitation fails, proceed with warning (backward compatibility per MCP spec)
      this.context.logger?.warn('Elicitation failed, proceeding with operation', {
        action,
        error: err instanceof Error ? err.message : String(err),
      });
      return { proceed: true };
    }
  }

  // =============================================================================
  // VALUES OPERATIONS
  // =============================================================================

  private async handleRead(input: DataRequest & { action: 'read' }): Promise<DataResponse> {
    const range = await this.resolveRangeToA1(input.spreadsheetId, input.range);
    const paginationPlan = this.buildPaginationPlan({
      range,
      cursor: input.cursor,
      pageSize: input.pageSize,
      chunkSize: input.chunkSize,
      streaming: input.streaming,
    });
    if (paginationPlan && 'error' in paginationPlan) {
      return paginationPlan.error;
    }
    const readRange = paginationPlan?.range ?? range;
    const etagCache = getETagCache();

    // Build cache key for this request
    const cacheKey = {
      spreadsheetId: input.spreadsheetId,
      endpoint: 'values' as const,
      range: readRange,
      params: {
        valueRenderOption: input.valueRenderOption,
        majorDimension: input.majorDimension,
      },
    };

    // Check for cached data (TTL-based caching)
    const cachedData = etagCache.getCachedData(cacheKey) as sheets_v4.Schema$ValueRange | null;
    if (cachedData && etagCache.getETag(cacheKey)) {
      this.context.logger?.info('Cache hit for values read', {
        spreadsheetId: input.spreadsheetId,
        range: readRange,
        savedApiCall: true,
      });

      const values = (cachedData.values ?? []) as ValuesArray;
      const result: Record<string, unknown> = {
        values,
        range: cachedData.range ?? readRange,
        _cached: true,
      };
      if (cachedData.majorDimension) {
        result['majorDimension'] = cachedData.majorDimension;
      }
      if (paginationPlan) {
        result['nextCursor'] = paginationPlan.nextCursor;
        result['hasMore'] = paginationPlan.hasMore;
        result['totalRows'] = paginationPlan.totalRows;
      }
      return this.success('read', result);
    }

    // Cache miss - fetch from API
    const response = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId: input.spreadsheetId,
      range: readRange,
      valueRenderOption: input.valueRenderOption,
      majorDimension: input.majorDimension,
      fields: 'range,majorDimension,values',
    });

    // Cache the response
    etagCache.setETag(cacheKey, `cached-${Date.now()}`, response.data);

    // Record access pattern for predictive prefetching (Phase 3)
    this.recordAccessAndTriggerPrefetch(input.spreadsheetId, readRange, 'read');

    const values = (response.data.values ?? []) as ValuesArray;
    const result: Record<string, unknown> = {
      values,
      range: response.data.range ?? readRange,
    };

    if (response.data.majorDimension) {
      result['majorDimension'] = response.data.majorDimension;
    }
    if (paginationPlan) {
      result['nextCursor'] = paginationPlan.nextCursor;
      result['hasMore'] = paginationPlan.hasMore;
      result['totalRows'] = paginationPlan.totalRows;
    }

    return this.success('read', result);
  }

  private async handleWrite(input: DataRequest & { action: 'write' }): Promise<DataResponse> {
    const range = await this.resolveRangeToA1(input.spreadsheetId, input.range);
    const payloadValidation = this.validateValuesPayloadIfEnabled(input.values, range);
    if (!payloadValidation.withinLimits) {
      return this.payloadTooLargeError('write', payloadValidation);
    }
    const cellCount = input.values.reduce((sum: number, row: unknown[]) => sum + row.length, 0);

    // Check for dryRun
    if (input.safety?.dryRun) {
      const warnings = this.buildPayloadWarnings('write', payloadValidation);
      const meta = warnings
        ? {
            ...this.generateMeta('write', input, {
              updatedCells: cellCount,
              updatedRows: input.values.length,
              updatedColumns:
                input.values.length > 0
                  ? Math.max(...input.values.map((row: unknown[]) => row.length))
                  : 0,
              updatedRange: range,
            }),
            warnings,
          }
        : undefined;

      return this.success(
        'write',
        {
          updatedCells: cellCount,
          updatedRows: input.values.length,
          updatedColumns:
            input.values.length > 0
              ? Math.max(...input.values.map((row: unknown[]) => row.length))
              : 0,
          updatedRange: range,
        },
        undefined,
        true,
        meta
      );
    }

    // Use batching system if available (20-40% API reduction via time-window batching)
    if (this.context.batchingSystem) {
      try {
        const result =
          await this.context.batchingSystem.execute<sheets_v4.Schema$UpdateValuesResponse>({
            id: uuidv4(),
            type: 'values:update',
            spreadsheetId: input.spreadsheetId,
            params: {
              range,
              values: input.values,
              valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
            },
          });

        // Invalidate ETag cache after mutation
        getETagCache().invalidateSpreadsheet(input.spreadsheetId);

        const responseData: Record<string, unknown> = {
          updatedCells: result?.updatedCells ?? cellCount,
          updatedRows: result?.updatedRows ?? input.values.length,
          updatedColumns: result?.updatedColumns ?? 0,
          updatedRange: result?.updatedRange ?? range,
          _batched: true, // Indicate this was batched
        };

        const warnings = this.buildPayloadWarnings('write', payloadValidation);
        const meta = warnings
          ? {
              ...this.generateMeta('write', input, responseData, {
                cellsAffected: (responseData['updatedCells'] as number | undefined) ?? undefined,
              }),
              warnings,
            }
          : undefined;

        return this.success('write', responseData, undefined, undefined, meta);
      } catch (err) {
        // Fall through to direct API call on batching error
        this.context.logger?.warn('Batching failed, falling back to direct API call', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Direct API call (fallback or when batching unavailable)
    const response = await this.sheetsApi.spreadsheets.values.update({
      spreadsheetId: input.spreadsheetId,
      range,
      valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
      includeValuesInResponse: input.includeValuesInResponse ?? false,
      requestBody: { values: input.values },
      fields: 'spreadsheetId,updatedCells,updatedRows,updatedColumns,updatedRange',
    });

    // Invalidate ETag cache after mutation
    getETagCache().invalidateSpreadsheet(input.spreadsheetId);

    const responseData: Record<string, unknown> = {
      updatedCells: response.data.updatedCells ?? 0,
      updatedRows: response.data.updatedRows ?? 0,
      updatedColumns: response.data.updatedColumns ?? 0,
      updatedRange: response.data.updatedRange ?? range,
    };

    const warnings = this.buildPayloadWarnings('write', payloadValidation);
    const meta = warnings
      ? {
          ...this.generateMeta('write', input, responseData, {
            cellsAffected: response.data.updatedCells ?? undefined,
          }),
          warnings,
        }
      : undefined;

    return this.success('write', responseData, undefined, undefined, meta);
  }

  private async handleAppend(input: DataRequest & { action: 'append' }): Promise<DataResponse> {
    const range = input.range
      ? await this.resolveRangeToA1(input.spreadsheetId, input.range)
      : undefined;
    const payloadValidation = this.validateValuesPayloadIfEnabled(input.values, range);
    if (!payloadValidation.withinLimits) {
      return this.payloadTooLargeError('append', payloadValidation);
    }
    const cellCount = input.values.reduce((sum: number, row: unknown[]) => sum + row.length, 0);

    // Check for dryRun
    if (input.safety?.dryRun) {
      const warnings = this.buildPayloadWarnings('append', payloadValidation);
      const meta = warnings
        ? {
            ...this.generateMeta('append', input, {
              updatedCells: cellCount,
              updatedRows: input.values.length,
              updatedColumns:
                input.values.length > 0
                  ? Math.max(...input.values.map((row: unknown[]) => row.length))
                  : 0,
              ...(range ? { updatedRange: range } : {}),
            }),
            warnings,
          }
        : undefined;

      return this.success(
        'append',
        {
          updatedCells: cellCount,
          updatedRows: input.values.length,
          updatedColumns:
            input.values.length > 0
              ? Math.max(...input.values.map((row: unknown[]) => row.length))
              : 0,
          ...(range ? { updatedRange: range } : {}),
        },
        undefined,
        true,
        meta
      );
    }

    if (input.tableId) {
      if (!this.featureFlags.enableTableAppends) {
        this.context.metrics?.recordFeatureFlagBlock({
          flag: 'tableAppends',
          tool: this.toolName,
          action: 'append',
        });
        return this.error({
          code: 'FEATURE_UNAVAILABLE',
          message: 'Table appends are disabled. Set ENABLE_TABLE_APPENDS=true to enable.',
          retryable: false,
        });
      }

      if (this.context.batchingSystem) {
        try {
          await this.context.batchingSystem.execute({
            id: uuidv4(),
            type: 'values:append',
            spreadsheetId: input.spreadsheetId,
            params: {
              tableId: input.tableId,
              range,
              values: input.values,
              valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
            },
          });

          // Invalidate ETag cache after mutation
          getETagCache().invalidateSpreadsheet(input.spreadsheetId);

          const responseData: Record<string, unknown> = {
            updatedCells: cellCount,
            updatedRows: input.values.length,
            updatedColumns:
              input.values.length > 0
                ? Math.max(...input.values.map((row: unknown[]) => row.length))
                : 0,
            ...(range ? { updatedRange: range } : {}),
            _batched: true,
          };

          const warnings = this.buildPayloadWarnings('append', payloadValidation);
          const meta = warnings
            ? {
                ...this.generateMeta('append', input, responseData, {
                  cellsAffected: cellCount,
                }),
                warnings,
              }
            : undefined;

          return this.success('append', responseData, undefined, undefined, meta);
        } catch (err) {
          this.context.logger?.warn(
            'Batching failed for table append, falling back to direct API',
            {
              error: err instanceof Error ? err.message : String(err),
            }
          );
        }
      }

      const rows = this.buildRowData(input.values, input.valueInputOption ?? 'USER_ENTERED');

      await this.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: input.spreadsheetId,
        requestBody: {
          requests: [
            {
              appendCells: {
                tableId: input.tableId,
                rows,
                fields: 'userEnteredValue',
              },
            },
          ],
          includeSpreadsheetInResponse: false,
        },
      });

      // Invalidate ETag cache after mutation
      getETagCache().invalidateSpreadsheet(input.spreadsheetId);

      const responseData: Record<string, unknown> = {
        updatedCells: cellCount,
        updatedRows: input.values.length,
        updatedColumns:
          input.values.length > 0
            ? Math.max(...input.values.map((row: unknown[]) => row.length))
            : 0,
        ...(range ? { updatedRange: range } : {}),
      };

      const warnings = this.buildPayloadWarnings('append', payloadValidation);
      const meta = warnings
        ? {
            ...this.generateMeta('append', input, responseData, {
              cellsAffected: cellCount,
            }),
            warnings,
          }
        : undefined;

      return this.success('append', responseData, undefined, undefined, meta);
    }

    if (!range) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: 'Range is required when tableId is not provided for append',
        retryable: false,
      });
    }

    // Use batching system if available (20-40% API reduction)
    if (this.context.batchingSystem) {
      try {
        const result =
          await this.context.batchingSystem.execute<sheets_v4.Schema$AppendValuesResponse>({
            id: uuidv4(),
            type: 'values:append',
            spreadsheetId: input.spreadsheetId,
            params: {
              range,
              values: input.values,
              valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
              insertDataOption: input.insertDataOption ?? 'INSERT_ROWS',
            },
          });

        // Invalidate ETag cache after mutation
        getETagCache().invalidateSpreadsheet(input.spreadsheetId);

        const updates = result?.updates;
        const responseData: Record<string, unknown> = {
          updatedCells: updates?.updatedCells ?? cellCount,
          updatedRows: updates?.updatedRows ?? input.values.length,
          updatedColumns: updates?.updatedColumns ?? 0,
          updatedRange: updates?.updatedRange ?? range,
          _batched: true,
        };

        const warnings = this.buildPayloadWarnings('append', payloadValidation);
        const meta = warnings
          ? {
              ...this.generateMeta('append', input, responseData, {
                cellsAffected: updates?.updatedCells ?? cellCount,
              }),
              warnings,
            }
          : undefined;

        return this.success('append', responseData, undefined, undefined, meta);
      } catch (err) {
        this.context.logger?.warn('Batching failed for append, falling back to direct API', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Direct API call (fallback)
    const response = await this.sheetsApi.spreadsheets.values.append({
      spreadsheetId: input.spreadsheetId,
      range,
      valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
      insertDataOption: input.insertDataOption ?? 'INSERT_ROWS',
      requestBody: { values: input.values },
      fields:
        'spreadsheetId,updates(spreadsheetId,updatedCells,updatedRows,updatedColumns,updatedRange)',
    });

    // Invalidate ETag cache after mutation
    getETagCache().invalidateSpreadsheet(input.spreadsheetId);

    const updates = response.data.updates;

    const responseData: Record<string, unknown> = {
      updatedCells: updates?.updatedCells ?? 0,
      updatedRows: updates?.updatedRows ?? 0,
      updatedColumns: updates?.updatedColumns ?? 0,
      updatedRange: updates?.updatedRange ?? range,
    };

    const warnings = this.buildPayloadWarnings('append', payloadValidation);
    const meta = warnings
      ? {
          ...this.generateMeta('append', input, responseData, {
            cellsAffected: updates?.updatedCells ?? undefined,
          }),
          warnings,
        }
      : undefined;

    return this.success('append', responseData, undefined, undefined, meta);
  }

  private async handleClear(input: DataRequest & { action: 'clear' }): Promise<DataResponse> {
    // Simplified: Skip elicitation confirmation to avoid MCP hang issues
    // CRITICAL: Track confirmation skip for data corruption monitoring
    this.context.metrics?.recordConfirmationSkip({
      action: 'sheets_data.clear',
      reason: 'elicitation_disabled',
      timestamp: Date.now(),
      spreadsheetId: input.spreadsheetId,
      destructive: true,
    });

    const range = await this.resolveRangeToA1(input.spreadsheetId, input.range);

    // Check for dryRun
    if (input.safety?.dryRun) {
      return this.success('clear', { updatedRange: range }, undefined, true);
    }

    // Direct API call - no confirmation, no snapshot (simplified for reliability)
    const response = await this.sheetsApi.spreadsheets.values.clear({
      spreadsheetId: input.spreadsheetId,
      range,
      fields: 'clearedRange',
    });

    // Invalidate ETag cache after mutation
    getETagCache().invalidateSpreadsheet(input.spreadsheetId);

    return this.success('clear', {
      updatedRange: response.data.clearedRange ?? range,
    });
  }

  private async handleBatchRead(
    input: DataRequest & { action: 'batch_read' }
  ): Promise<DataResponse> {
    // Pagination support exists but disabled pending schema updates (cursor, pageSize, streaming fields)
    const wantsPagination = false; // Boolean(input.cursor || input.pageSize || input.streaming);

    if (wantsPagination) {
      if (input.dataFilters && input.dataFilters.length > 0) {
        return this.error({
          code: 'INVALID_PARAMS',
          message: 'Pagination is not supported with dataFilters in batch_read',
          retryable: false,
        });
      }
      if (!input.ranges || input.ranges.length !== 1) {
        return this.error({
          code: 'INVALID_PARAMS',
          message: 'Pagination in batch_read requires exactly one range',
          retryable: false,
        });
      }

      const singleRange = await this.resolveRangeToA1(input.spreadsheetId, input.ranges![0] as any);
      const paginationPlan = this.buildPaginationPlan({
        range: singleRange,
        cursor: undefined, // input.cursor,
        pageSize: undefined, // input.pageSize,
        streaming: undefined, // input.streaming,
      });
      if (paginationPlan && 'error' in paginationPlan) {
        return paginationPlan.error;
      }
      const readRange = paginationPlan?.range ?? singleRange;

      const response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: input.spreadsheetId,
        range: readRange,
        valueRenderOption: input.valueRenderOption,
        majorDimension: input.majorDimension,
        fields: 'range,majorDimension,values',
      });

      const responseData: Record<string, unknown> = {
        valueRanges: [
          {
            range: response.data.range ?? readRange,
            values: (response.data.values ?? []) as ValuesArray,
          },
        ],
      };

      if (response.data.majorDimension) {
        responseData['majorDimension'] = response.data.majorDimension;
      }
      if (paginationPlan) {
        responseData['nextCursor'] = paginationPlan.nextCursor;
        responseData['hasMore'] = paginationPlan.hasMore;
        responseData['totalRows'] = paginationPlan.totalRows;
      }

      return this.success('batch_read', responseData);
    }

    if (input.dataFilters && input.dataFilters.length > 0) {
      if (!this.featureFlags.enableDataFilterBatch) {
        this.context.metrics?.recordFeatureFlagBlock({
          flag: 'dataFilterBatch',
          tool: this.toolName,
          action: 'batch_read',
        });
        return this.error({
          code: 'FEATURE_UNAVAILABLE',
          message: 'DataFilter batch reads are disabled. Set ENABLE_DATAFILTER_BATCH=true.',
          retryable: false,
        });
      }

      const response = await this.sheetsApi.spreadsheets.values.batchGetByDataFilter({
        spreadsheetId: input.spreadsheetId,
        fields: 'valueRanges(valueRange(range,values))',
        requestBody: {
          dataFilters: input.dataFilters,
          valueRenderOption: input.valueRenderOption,
          majorDimension: input.majorDimension,
        },
      });

      return this.success('batch_read', {
        valueRanges: (response.data.valueRanges ?? []).map(
          (mvr: sheets_v4.Schema$MatchedValueRange) => ({
            range: mvr.valueRange?.range ?? '',
            values: (mvr.valueRange?.values ?? []) as ValuesArray,
          })
        ),
      });
    }

    const ranges = await Promise.all(
      (input.ranges ?? []).map((r: RangeInput) => this.resolveRangeToA1(input.spreadsheetId, r))
    );

    // Try cached API first for better performance (30-50% API savings)
    const cachedApi = this.context.cachedSheetsApi;
    if (cachedApi) {
      try {
        const cachedResult = await cachedApi.batchGetValues(input.spreadsheetId, ranges, {
          valueRenderOption: input.valueRenderOption,
          majorDimension: input.majorDimension,
        });

        if (cachedResult && cachedResult.valueRanges) {
          return this.success('batch_read', {
            valueRanges: cachedResult.valueRanges.map((vr: sheets_v4.Schema$ValueRange) => ({
              range: vr.range ?? '',
              values: (vr.values ?? []) as ValuesArray,
            })),
            _cached: true,
          });
        }
      } catch (_cacheError) {
        // Fall through to direct API call on cache error
      }
    }

    // Direct API call - no chunking with dynamic imports, just simple batch
    const response = await this.sheetsApi.spreadsheets.values.batchGet({
      spreadsheetId: input.spreadsheetId,
      ranges,
      valueRenderOption: input.valueRenderOption,
      majorDimension: input.majorDimension,
      fields: 'valueRanges(range,values)',
    });

    // Record access patterns for predictive prefetching (Phase 3)
    for (const range of ranges) {
      this.recordAccessAndTriggerPrefetch(input.spreadsheetId, range, 'read');
    }

    return this.success('batch_read', {
      valueRanges: (response.data.valueRanges ?? []).map((vr: sheets_v4.Schema$ValueRange) => ({
        range: vr.range ?? '',
        values: (vr.values ?? []) as ValuesArray,
      })),
    });
  }

  private async handleBatchWrite(
    input: DataRequest & { action: 'batch_write' }
  ): Promise<DataResponse> {
    const payloadValidation = this.validateValuesBatchPayloadIfEnabled(input.data);
    if (!payloadValidation.withinLimits) {
      return this.payloadTooLargeError('batch_write', payloadValidation);
    }

    const totalCells = input.data.reduce(
      (sum: number, d: { values: ValuesArray }) =>
        sum + d.values.reduce((s: number, row: unknown[]) => s + row.length, 0),
      0
    );

    const hasDataFilters = input.data.some((d) => (d as { dataFilter?: unknown }).dataFilter);
    const hasRanges = input.data.some((d) => (d as { range?: unknown }).range);

    if (hasDataFilters && !this.featureFlags.enableDataFilterBatch) {
      this.context.metrics?.recordFeatureFlagBlock({
        flag: 'dataFilterBatch',
        tool: this.toolName,
        action: 'batch_write',
      });
      return this.error({
        code: 'FEATURE_UNAVAILABLE',
        message: 'DataFilter batch writes are disabled. Set ENABLE_DATAFILTER_BATCH=true.',
        retryable: false,
      });
    }

    if (hasDataFilters && !hasRanges) {
      const data = input.data.map((d) => ({
        dataFilter: (d as { dataFilter: sheets_v4.Schema$DataFilter }).dataFilter,
        values: d.values as ValuesArray,
        majorDimension: (d as { majorDimension?: string }).majorDimension,
      }));

      if (input.safety?.dryRun) {
        const warnings = this.buildPayloadWarnings('batch_write', payloadValidation);
        const meta = warnings
          ? {
              ...this.generateMeta('batch_write', input, { updatedCells: totalCells }),
              warnings,
            }
          : undefined;

        return this.success('batch_write', { updatedCells: totalCells }, undefined, true, meta);
      }

      const response = await this.sheetsApi.spreadsheets.values.batchUpdateByDataFilter({
        spreadsheetId: input.spreadsheetId,
        fields: 'totalUpdatedCells,totalUpdatedRows,totalUpdatedColumns',
        requestBody: {
          valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
          includeValuesInResponse: input.includeValuesInResponse ?? false,
          data,
        },
      });

      // Invalidate ETag cache after mutation
      getETagCache().invalidateSpreadsheet(input.spreadsheetId);

      const responseData: Record<string, unknown> = {
        updatedCells: response.data.totalUpdatedCells ?? 0,
        updatedRows: response.data.totalUpdatedRows ?? 0,
        updatedColumns: response.data.totalUpdatedColumns ?? 0,
      };

      const warnings = this.buildPayloadWarnings('batch_write', payloadValidation);
      const meta = warnings
        ? {
            ...this.generateMeta('batch_write', input, responseData, {
              cellsAffected: response.data.totalUpdatedCells ?? undefined,
            }),
            warnings,
          }
        : undefined;

      return this.success('batch_write', responseData, undefined, undefined, meta);
    }

    if (hasDataFilters && hasRanges) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: 'Do not mix range-based and dataFilter-based entries in batch_write',
        retryable: false,
      });
    }

    const rangeEntries = input.data as Array<{ range?: RangeInput; values: ValuesArray }>;
    if (rangeEntries.some((entry) => !entry.range)) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: 'Missing range for batch_write entry',
        retryable: false,
      });
    }

    const data = await Promise.all(
      rangeEntries.map(async (d) => ({
        range: await this.resolveRangeToA1(input.spreadsheetId, d.range!),
        values: d.values,
      }))
    );

    // Check for dryRun
    if (input.safety?.dryRun) {
      const warnings = this.buildPayloadWarnings('batch_write', payloadValidation);
      const meta = warnings
        ? {
            ...this.generateMeta('batch_write', input, { updatedCells: totalCells }),
            warnings,
          }
        : undefined;

      return this.success('batch_write', { updatedCells: totalCells }, undefined, true, meta);
    }

    // Direct API call - no progress reporting with dynamic imports
    const response = await this.sheetsApi.spreadsheets.values.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      fields: 'totalUpdatedCells,totalUpdatedRows,totalUpdatedColumns',
      requestBody: {
        valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
        includeValuesInResponse: input.includeValuesInResponse ?? false,
        data,
      },
    });

    // Invalidate ETag cache after mutation
    getETagCache().invalidateSpreadsheet(input.spreadsheetId);

    const responseData: Record<string, unknown> = {
      updatedCells: response.data.totalUpdatedCells ?? 0,
      updatedRows: response.data.totalUpdatedRows ?? 0,
      updatedColumns: response.data.totalUpdatedColumns ?? 0,
    };

    const warnings = this.buildPayloadWarnings('batch_write', payloadValidation);
    const meta = warnings
      ? {
          ...this.generateMeta('batch_write', input, responseData, {
            cellsAffected: response.data.totalUpdatedCells ?? undefined,
          }),
          warnings,
        }
      : undefined;

    return this.success('batch_write', responseData, undefined, undefined, meta);
  }

  private async handleBatchClear(
    input: DataRequest & { action: 'batch_clear' }
  ): Promise<DataResponse> {
    // Simplified: Skip elicitation confirmation to avoid MCP hang issues
    // CRITICAL: Track confirmation skip for data corruption monitoring
    this.context.metrics?.recordConfirmationSkip({
      action: 'sheets_data.batch_clear',
      reason: 'elicitation_disabled',
      timestamp: Date.now(),
      spreadsheetId: input.spreadsheetId,
      destructive: true,
    });

    if (input.dataFilters && input.dataFilters.length > 0) {
      if (!this.featureFlags.enableDataFilterBatch) {
        this.context.metrics?.recordFeatureFlagBlock({
          flag: 'dataFilterBatch',
          tool: this.toolName,
          action: 'batch_clear',
        });
        return this.error({
          code: 'FEATURE_UNAVAILABLE',
          message: 'DataFilter batch clears are disabled. Set ENABLE_DATAFILTER_BATCH=true.',
          retryable: false,
        });
      }

      if (input.safety?.dryRun) {
        return this.success(
          'batch_clear',
          {
            clearedRanges: [],
          },
          undefined,
          true
        );
      }

      const response = await this.sheetsApi.spreadsheets.values.batchClearByDataFilter({
        spreadsheetId: input.spreadsheetId,
        fields: 'clearedRanges',
        requestBody: { dataFilters: input.dataFilters },
      });

      // Invalidate ETag cache after mutation
      getETagCache().invalidateSpreadsheet(input.spreadsheetId);

      return this.success('batch_clear', {
        clearedRanges: response.data.clearedRanges ?? [],
      });
    }

    const ranges = await Promise.all(
      (input.ranges ?? []).map((range: RangeInput) =>
        this.resolveRangeToA1(input.spreadsheetId, range)
      )
    );

    // Check for dryRun
    if (input.safety?.dryRun) {
      return this.success(
        'batch_clear',
        {
          clearedCells: 0,
          updatedRange: ranges.join(','),
        },
        undefined,
        true
      );
    }

    // Direct API call - no confirmation, no snapshot (simplified for reliability)
    const response = await this.sheetsApi.spreadsheets.values.batchClear({
      spreadsheetId: input.spreadsheetId,
      fields: 'clearedRanges',
      requestBody: { ranges },
    });

    // Invalidate ETag cache after mutation
    getETagCache().invalidateSpreadsheet(input.spreadsheetId);

    return this.success('batch_clear', {
      clearedRanges: response.data.clearedRanges ?? ranges,
    });
  }

  private async handleFindReplace(
    input: DataRequest & { action: 'find_replace' }
  ): Promise<DataResponse> {
    const resolvedRange = input.range
      ? await this.resolveRangeToA1(input.spreadsheetId, input.range)
      : undefined;

    // FIND-ONLY MODE: No replacement provided
    if (input.replacement === undefined || input.replacement === null) {
      // Direct API call
      const response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: input.spreadsheetId,
        range: resolvedRange ?? 'A:ZZ',
        valueRenderOption: input.includeFormulas ? 'FORMULA' : 'FORMATTED_VALUE',
        fields: 'range,values',
      });

      const values = response.data.values ?? [];
      const matches: Array<{
        cell: string;
        value: string;
        row: number;
        column: number;
      }> = [];
      const query = input.matchCase ? input.find : input.find.toLowerCase();
      const limit = input.limit ?? 100;

      for (let row = 0; row < values.length && matches.length < limit; row++) {
        const rowData = values[row];
        if (!rowData) continue;

        for (let col = 0; col < rowData.length && matches.length < limit; col++) {
          const cellValue = String(rowData[col] ?? '');
          const compareValue = input.matchCase ? cellValue : cellValue.toLowerCase();

          const isMatch = input.matchEntireCell
            ? compareValue === query
            : compareValue.includes(query);

          if (isMatch) {
            matches.push({
              cell: `${this.columnToLetter(col)}${row + 1}`,
              value: cellValue,
              row: row + 1,
              column: col + 1,
            });
          }
        }
      }

      return this.success('find_replace', { matches, mode: 'find' });
    }

    // REPLACE MODE: Replacement provided
    // Check for dryRun
    if (input.safety?.dryRun) {
      return this.success(
        'find_replace',
        {
          replacementsCount: 0,
          mode: 'replace',
        },
        undefined,
        true
      );
    }

    // Build findReplace request - Google API requires allSheets=true if set, or omit it for range-based search
    const findReplaceRequest: sheets_v4.Schema$FindReplaceRequest = {
      find: input.find,
      replacement: input.replacement,
      matchCase: input.matchCase,
      matchEntireCell: input.matchEntireCell,
      searchByRegex: input.searchByRegex,
      includeFormulas: input.includeFormulas,
    };

    // Only set allSheets OR range, not both (Google API constraint)
    if (resolvedRange) {
      // Search within specific range - parse to GridRange
      const gridRange = await this.a1ToGridRange(input.spreadsheetId, resolvedRange);
      findReplaceRequest.range = toGridRange(gridRange);
    } else {
      // Search all sheets (default when no range specified)
      findReplaceRequest.allSheets = true;
    }

    // Direct API call
    const response = await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            findReplace: findReplaceRequest,
          },
        ],
      },
    });

    const reply = response.data.replies?.[0]?.findReplace;
    const replacementsCount = reply?.occurrencesChanged ?? 0;

    return this.success('find_replace', {
      replacementsCount,
      mode: 'replace',
    });
  }

  // =============================================================================
  // CELLS OPERATIONS
  // =============================================================================

  private async handleAddNote(input: DataRequest & { action: 'add_note' }): Promise<DataResponse> {
    const gridRange = await this.cellToGridRange(input.spreadsheetId, input.cell);

    // Direct API call
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: toGridRange(gridRange),
              rows: [{ values: [{ note: input.note }] }],
              fields: 'note',
            },
          },
        ],
      },
    });

    return this.success('add_note', {});
  }

  private async handleGetNote(input: DataRequest & { action: 'get_note' }): Promise<DataResponse> {
    // Direct API call - no request deduplication
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      ranges: [input.cell],
      includeGridData: true,
      fields: 'sheets.data.rowData.values.note',
    });

    const note = response.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]?.note ?? '';
    return this.success('get_note', { note });
  }

  private async handleClearNote(
    input: DataRequest & { action: 'clear_note' }
  ): Promise<DataResponse> {
    const gridRange = await this.cellToGridRange(input.spreadsheetId, input.cell);

    // Direct API call
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: toGridRange(gridRange),
              rows: [{ values: [{ note: '' }] }],
              fields: 'note',
            },
          },
        ],
      },
    });

    return this.success('clear_note', {});
  }

  // handleSetValidation and handleClearValidation removed in v2.0
  // These actions moved to sheets_format tool
  // Use sheets_format.set_data_validation and sheets_format.clear_data_validation instead

  private async handleSetHyperlink(
    input: DataRequest & { action: 'set_hyperlink' }
  ): Promise<DataResponse> {
    const validation = validateHyperlinkUrl(input.url);
    if (!validation.ok) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: `Invalid hyperlink URL: ${validation.reason}`,
        retryable: false,
        suggestedFix: 'Use a valid http or https URL.',
      });
    }

    const gridRange = await this.cellToGridRange(input.spreadsheetId, input.cell);
    const safeUrl = this.escapeFormulaString(validation.normalized);
    const safeLabel = input.label ? this.escapeFormulaString(input.label) : undefined;
    const formula = safeLabel
      ? `=HYPERLINK("${safeUrl}","${safeLabel}")`
      : `=HYPERLINK("${safeUrl}")`;

    // Direct API call
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: toGridRange(gridRange),
              rows: [
                {
                  values: [
                    {
                      userEnteredValue: { formulaValue: formula },
                    },
                  ],
                },
              ],
              fields: 'userEnteredValue',
            },
          },
        ],
      },
    });

    return this.success('set_hyperlink', {});
  }

  private async handleClearHyperlink(
    input: DataRequest & { action: 'clear_hyperlink' }
  ): Promise<DataResponse> {
    const gridRange = await this.cellToGridRange(input.spreadsheetId, input.cell);

    // Direct API call
    const response = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId: input.spreadsheetId,
      range: input.cell,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const currentValue = response.data.values?.[0]?.[0] ?? '';

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: toGridRange(gridRange),
              rows: [
                {
                  values: [
                    {
                      userEnteredValue: { stringValue: String(currentValue) },
                    },
                  ],
                },
              ],
              fields: 'userEnteredValue',
            },
          },
        ],
      },
    });

    return this.success('clear_hyperlink', {});
  }

  private async handleMergeCells(
    input: DataRequest & { action: 'merge_cells' }
  ): Promise<DataResponse> {
    const rangeA1 = await this.resolveRangeToA1(input.spreadsheetId, input.range);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);

    // Direct API call
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            mergeCells: {
              range: toGridRange(gridRange),
              mergeType: input.mergeType ?? 'MERGE_ALL',
            },
          },
        ],
      },
    });

    return this.success('merge_cells', {});
  }

  private async handleUnmergeCells(
    input: DataRequest & { action: 'unmerge_cells' }
  ): Promise<DataResponse> {
    const rangeA1 = await this.resolveRangeToA1(input.spreadsheetId, input.range);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);

    // Direct API call
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            unmergeCells: {
              range: toGridRange(gridRange),
            },
          },
        ],
      },
    });

    return this.success('unmerge_cells', {});
  }

  private async handleGetMerges(
    input: DataRequest & { action: 'get_merges' }
  ): Promise<DataResponse> {
    // Direct API call - no request deduplication
    const response = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId,
      fields: 'sheets.merges,sheets.properties.sheetId',
    });

    const sheet = response.data.sheets?.find((s) => s.properties?.sheetId === input.sheetId);
    const merges = (sheet?.merges ?? []).map((m) => ({
      startRow: m.startRowIndex ?? 0,
      endRow: m.endRowIndex ?? 0,
      startColumn: m.startColumnIndex ?? 0,
      endColumn: m.endColumnIndex ?? 0,
    }));

    return this.success('get_merges', { merges });
  }

  private async handleCutPaste(
    input: DataRequest & { action: 'cut_paste' }
  ): Promise<DataResponse> {
    // Simplified: Skip elicitation confirmation to avoid MCP hang issues
    // CRITICAL: Track confirmation skip for data corruption monitoring
    this.context.metrics?.recordConfirmationSkip({
      action: 'sheets_data.cut_paste',
      reason: 'elicitation_disabled',
      timestamp: Date.now(),
      spreadsheetId: input.spreadsheetId,
      destructive: true,
    });

    const rangeA1 = await this.resolveRangeToA1(input.spreadsheetId, input.source);
    const sourceRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);

    if (input.safety?.dryRun) {
      return this.success('cut_paste', {}, undefined, true);
    }

    const destParsed = parseCellReference(input.destination);
    const destinationSheetId = destParsed.sheetName
      ? await this.getSheetId(input.spreadsheetId, destParsed.sheetName, this.sheetsApi)
      : sourceRange.sheetId;

    // Direct API call - no confirmation, no snapshot (simplified for reliability)
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            cutPaste: {
              source: toGridRange(sourceRange),
              destination: {
                sheetId: destinationSheetId,
                rowIndex: destParsed.row,
                columnIndex: destParsed.col,
              },
              pasteType: input.pasteType ?? 'PASTE_NORMAL',
            },
          },
        ],
      },
    });

    return this.success('cut_paste', {});
  }

  private async handleCopyPaste(
    input: DataRequest & { action: 'copy_paste' }
  ): Promise<DataResponse> {
    const rangeA1 = await this.resolveRangeToA1(input.spreadsheetId, input.source);
    const sourceRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const destParsed = parseCellReference(input.destination);
    const destinationSheetId = destParsed.sheetName
      ? await this.getSheetId(input.spreadsheetId, destParsed.sheetName, this.sheetsApi)
      : sourceRange.sheetId;

    const sourceRows = (sourceRange.endRowIndex ?? 0) - (sourceRange.startRowIndex ?? 0);
    const sourceCols = (sourceRange.endColumnIndex ?? 0) - (sourceRange.startColumnIndex ?? 0);

    // Direct API call
    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            copyPaste: {
              source: toGridRange(sourceRange),
              destination: toGridRange(
                buildGridRangeInput(
                  destinationSheetId,
                  destParsed.row,
                  destParsed.row + sourceRows,
                  destParsed.col,
                  destParsed.col + sourceCols
                )
              ),
              pasteType: input.pasteType ?? 'PASTE_NORMAL',
            },
          },
        ],
      },
    });

    return this.success('copy_paste', {});
  }
}
