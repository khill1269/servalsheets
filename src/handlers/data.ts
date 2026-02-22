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
import { getEnv, getBackgroundAnalysisConfig } from '../config/env.js';
import { getETagCache } from '../services/etag-cache.js';
import { v4 as uuidv4 } from 'uuid';
import { getBackgroundAnalyzer } from '../services/background-analyzer.js';

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
import { sendProgress, getRequestLogger } from '../utils/request-context.js';
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
// Fix 2.3: Auto-chunk large batch operations to prevent timeouts (e.g., 29-range batch → 3 chunks of 10)
const MAX_BATCH_RANGES = 50;

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
    // Use context feature flags if available (for testing), otherwise use environment
    const contextFlags = (context as HandlerContext & { featureFlags?: Record<string, unknown> })
      .featureFlags;
    this.featureFlags = {
      enableDataFilterBatch:
        (contextFlags?.['enableDataFilterBatch'] as boolean | undefined) ??
        env.ENABLE_DATAFILTER_BATCH,
      enableTableAppends:
        (contextFlags?.['enableTableAppends'] as boolean | undefined) ?? env.ENABLE_TABLE_APPENDS,
      enablePayloadValidation:
        (contextFlags?.['enablePayloadValidation'] as boolean | undefined) ??
        env.ENABLE_PAYLOAD_VALIDATION,
    };
    // No circuit breaker registration - direct API calls only
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
    // Handler supports aliases (set_note→add_note, merge→merge_cells, etc.)
    // Use 'as any' on alias cases since they don't match schema types
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
      case 'detect_spill_ranges':
        return this.handleDetectSpillRanges(request);

      default: {
        // ACTION ALIASES - Common variations that map to existing actions
        // These prevent "Unknown action" errors when LLMs guess action names
        const action = (request as { action: string }).action;
        if (action === 'set_note' || action === 'notes') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return this.handleAddNote(request as any);
        }
        if (action === 'add_hyperlink' || action === 'hyperlink' || action === 'hyperlinks') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return this.handleSetHyperlink(request as any);
        }
        if (action === 'merge') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return this.handleMergeCells(request as any);
        }
        if (action === 'unmerge') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return this.handleUnmergeCells(request as any);
        }

        // Unknown action - return error
        return this.error({
          code: 'INVALID_PARAMS',
          message: `Unknown action: ${action}. Available actions: read, write, append, clear, batch_read, batch_write, batch_clear, find_replace, add_note, get_note, clear_note, set_hyperlink, clear_hyperlink, merge_cells, unmerge_cells, get_merges, cut_paste, copy_paste`,
          retryable: false,
          suggestedFix:
            'Check the parameter format and ensure all required parameters are provided',
        });
      }
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
    } catch (error) {
      this.context.logger?.warn?.('Failed to decode pagination cursor', {
        error: error instanceof Error ? error.message : String(error),
        cursor,
      });
      return null;
    }
  }

  private encodeCursor(offset: number): string {
    return Buffer.from(String(offset)).toString('base64');
  }

  /**
   * Encode multi-range pagination state to cursor
   */
  private encodeMultiRangeCursor(state: {
    rangeIndex: number;
    offsetInRange: number;
    pageSize: number;
  }): string {
    return Buffer.from(JSON.stringify(state)).toString('base64');
  }

  /**
   * Decode multi-range pagination cursor to state
   */
  private decodeMultiRangeCursor(
    cursor?: string
  ): { rangeIndex: number; offsetInRange: number; pageSize: number } | null {
    if (!cursor) return null;
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const state = JSON.parse(decoded);
      // Validate state structure
      if (
        typeof state.rangeIndex !== 'number' ||
        typeof state.offsetInRange !== 'number' ||
        typeof state.pageSize !== 'number'
      ) {
        return null;
      }
      return state;
    } catch (error) {
      this.context.logger?.warn?.('Failed to decode multi-range cursor', {
        error: error instanceof Error ? error.message : String(error),
        cursor,
      });
      return null;
    }
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
            suggestedFix:
              'Check the parameter format and ensure all required parameters are provided',
            details: {
              range,
              reason: error instanceof Error ? error.message : String(error),
            },
          }),
        };
      }
      return undefined; // spill detection fallback
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
          suggestedFix:
            'Check the parameter format and ensure all required parameters are provided',
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

  /**
   * Build pagination plan for multiple ranges (Phase 1.1: Multi-range batch_read pagination)
   */
  private async buildMultiRangePaginationPlan(options: {
    spreadsheetId: string;
    ranges: RangeInput[];
    cursor?: string;
    pageSize?: number;
  }): Promise<
    | {
        rangesToFetch: RangeInput[];
        rangeIndices: number[];
        hasMore: boolean;
        nextCursor?: string;
        totalRanges: number;
      }
    | { error: DataResponse }
  > {
    const { ranges, cursor, pageSize = 5 } = options;

    // Decode cursor to get current position
    const state = this.decodeMultiRangeCursor(cursor) || {
      rangeIndex: 0,
      offsetInRange: 0,
      pageSize,
    };

    // Validate range index
    if (state.rangeIndex < 0 || state.rangeIndex >= ranges.length) {
      return {
        error: this.error({
          code: 'INVALID_PARAMS',
          message: 'Invalid pagination cursor: range index out of bounds',
          retryable: false,
          suggestedFix: "Check parameter format - ranges use A1 notation like 'Sheet1!A1:D10'",
          details: { cursor, rangeIndex: state.rangeIndex, totalRanges: ranges.length },
        }),
      };
    }

    // Collect ranges for this page
    const rangesToFetch: RangeInput[] = [];
    const rangeIndices: number[] = [];
    let currentRangeIndex = state.rangeIndex;
    let remainingPageSize = state.pageSize;

    while (currentRangeIndex < ranges.length && remainingPageSize > 0) {
      rangesToFetch.push(ranges[currentRangeIndex]!);
      rangeIndices.push(currentRangeIndex);
      remainingPageSize--;
      currentRangeIndex++;
    }

    // Determine if there are more ranges
    const hasMore = currentRangeIndex < ranges.length;
    const nextCursor = hasMore
      ? this.encodeMultiRangeCursor({
          rangeIndex: currentRangeIndex,
          offsetInRange: 0,
          pageSize: state.pageSize,
        })
      : undefined;

    return {
      rangesToFetch,
      rangeIndices,
      hasMore,
      nextCursor,
      totalRanges: ranges.length,
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
    // NEW: DataFilter path (uses batch API with single filter)
    if (input.dataFilter) {
      if (!this.featureFlags.enableDataFilterBatch) {
        this.context.metrics?.recordFeatureFlagBlock({
          flag: 'dataFilterBatch',
          tool: this.toolName,
          action: 'read',
        });
        return this.error({
          code: 'FEATURE_UNAVAILABLE',
          message: 'DataFilter reads are disabled. Set ENABLE_DATAFILTER_BATCH=true.',
          retryable: false,
          suggestedFix: 'Enable the feature by setting the appropriate environment variable',
        });
      }

      const response = await this.sheetsApi.spreadsheets.values.batchGetByDataFilter({
        spreadsheetId: input.spreadsheetId,
        fields: 'valueRanges(valueRange(range,values))',
        requestBody: {
          dataFilters: [input.dataFilter], // Single-entry array
          valueRenderOption: input.valueRenderOption,
          majorDimension: input.majorDimension,
        },
      });

      const valueRanges = response.data.valueRanges ?? [];
      if (valueRanges.length === 0) {
        return this.error({
          code: 'NOT_FOUND',
          message: 'No data matched the provided DataFilter',
          retryable: false,
          suggestedFix:
            'Check that developer metadata exists for the given lookup criteria. Use sheets_advanced.set_metadata to tag ranges first.',
        });
      }

      // Extract first (and only) matched range
      const matchedValueRange = valueRanges[0];
      if (!matchedValueRange) {
        return this.error({
          code: 'NO_DATA',
          message: 'No data found matching the filter',
          retryable: false,
        });
      }
      const range = matchedValueRange.valueRange?.range ?? '';
      const values = (matchedValueRange.valueRange?.values ?? []) as ValuesArray;

      return this.success('read', {
        range,
        values,
        rowCount: values.length,
        columnCount: values.length > 0 ? Math.max(...values.map((row) => row.length)) : 0,
      });
    }

    // EXISTING: Traditional range-based path
    const range = await this.resolveRangeToA1(input.spreadsheetId, input.range!);

    // Redundant read detection: Check if this range was read recently without intervening writes
    // Audit optimization: Prevents 174 instances of wasted redundant reads
    if (this.context.sessionContext) {
      const redundantTimestamp = this.context.sessionContext.checkRedundantRead(
        input.spreadsheetId,
        range
      );
      if (redundantTimestamp !== null) {
        const logger = this.context.logger;
        logger?.info('Redundant read operation detected - consider caching or batch_read', {
          spreadsheetId: input.spreadsheetId,
          range,
          timeSinceLastRead: Date.now() - redundantTimestamp,
        });
      }
      // Track this read for future redundancy detection
      this.context.sessionContext.trackReadOperation(input.spreadsheetId, range);
    }

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
    const cachedData = (await etagCache.getCachedData(
      cacheKey
    )) as sheets_v4.Schema$ValueRange | null;
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
        if (paginationPlan.hasMore && paginationPlan.nextCursor) {
          result['_paginationHint'] =
            `Showing page of ${paginationPlan.totalRows} total rows. ` +
            `To fetch next page, repeat this call with cursor:"${paginationPlan.nextCursor}"`;
        }
      }
      return this.success('read', result);
    }

    // Cache miss - fetch from API
    // Use RequestMerger if enabled (merges overlapping reads within 50ms window)
    const env = getEnv();
    let responseData: sheets_v4.Schema$ValueRange;

    if (this.context.requestMerger && env.ENABLE_REQUEST_MERGING) {
      responseData = await this.context.requestMerger.mergeRead(
        this.sheetsApi,
        input.spreadsheetId,
        readRange,
        {
          valueRenderOption: input.valueRenderOption,
          majorDimension: input.majorDimension,
        }
      );
    } else {
      // Use request deduplication to prevent duplicate API calls
      const dedupKey = `values:get:${input.spreadsheetId}:${readRange}:${input.valueRenderOption ?? 'FORMATTED_VALUE'}:${input.majorDimension ?? 'ROWS'}`;
      const response = await this.deduplicatedApiCall(dedupKey, () =>
        this.sheetsApi.spreadsheets.values.get({
          spreadsheetId: input.spreadsheetId,
          range: readRange,
          valueRenderOption: input.valueRenderOption,
          majorDimension: input.majorDimension,
          dateTimeRenderOption:
            input.valueRenderOption === 'UNFORMATTED_VALUE' ? 'FORMATTED_STRING' : undefined,
          fields: 'range,values,majorDimension',
        })
      );
      responseData = response.data;
    }

    // Cache the response
    etagCache.setETag(cacheKey, `cached-${Date.now()}`, responseData);

    // Record access pattern and trigger prefetch (80% latency reduction on sequential ops)
    this.recordAccessAndPrefetch({
      spreadsheetId: input.spreadsheetId,
      range: readRange,
      action: 'read',
    });

    const values = (responseData.values ?? []) as ValuesArray;
    const result: Record<string, unknown> = {
      values,
      range: responseData.range ?? readRange,
    };

    if (responseData.majorDimension) {
      result['majorDimension'] = responseData.majorDimension;
    }
    if (paginationPlan) {
      result['nextCursor'] = paginationPlan.nextCursor;
      result['hasMore'] = paginationPlan.hasMore;
      result['totalRows'] = paginationPlan.totalRows;
      if (paginationPlan.hasMore && paginationPlan.nextCursor) {
        result['_paginationHint'] =
          `Showing page of ${paginationPlan.totalRows} total rows. ` +
          `To fetch next page, repeat this call with cursor:"${paginationPlan.nextCursor}"`;
      }
    }

    return this.success('read', result);
  }

  private async handleWrite(input: DataRequest & { action: 'write' }): Promise<DataResponse> {
    // Validate payload size (use default range for dataFilter)
    const range = input.range
      ? await this.resolveRangeToA1(input.spreadsheetId, input.range)
      : '(dynamic)';
    const payloadValidation = this.validateValuesPayloadIfEnabled(input.values, range);
    if (!payloadValidation.withinLimits) {
      return this.payloadTooLargeError('write', payloadValidation);
    }
    const cellCount = input.values.reduce((sum: number, row: unknown[]) => sum + row.length, 0);

    // NEW: DataFilter path
    if (input.dataFilter) {
      if (!this.featureFlags.enableDataFilterBatch) {
        return this.error({
          code: 'FEATURE_UNAVAILABLE',
          message: 'DataFilter writes are disabled. Set ENABLE_DATAFILTER_BATCH=true.',
          retryable: false,
          suggestedFix: 'Enable the feature by setting the appropriate environment variable',
        });
      }

      // Dry-run path
      if (input.safety?.dryRun) {
        const warnings = this.buildPayloadWarnings('write', payloadValidation);
        const meta = warnings
          ? {
              ...this.generateMeta('write', input, { updatedCells: cellCount }),
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
          },
          undefined,
          true,
          meta
        );
      }

      // API call
      const response = await this.sheetsApi.spreadsheets.values.batchUpdateByDataFilter({
        spreadsheetId: input.spreadsheetId,
        fields: 'totalUpdatedCells,totalUpdatedRows,totalUpdatedColumns,responses',
        requestBody: {
          valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
          includeValuesInResponse: input.includeValuesInResponse ?? false,
          data: [
            {
              dataFilter: input.dataFilter,
              values: input.values,
              majorDimension: (input as DataRequest & { majorDimension?: string }).majorDimension,
            },
          ],
        },
      });

      // Invalidate cache
      getETagCache().invalidateSpreadsheet(input.spreadsheetId);

      const responseData: Record<string, unknown> = {
        updatedCells: response.data.totalUpdatedCells ?? 0,
        updatedRows: response.data.totalUpdatedRows ?? 0,
        updatedColumns: response.data.totalUpdatedColumns ?? 0,
      };

      // Extract matched range from response if available
      if (response.data.responses && response.data.responses.length > 0) {
        responseData['updatedRange'] =
          response.data.responses[0]?.['updatedRange'] ?? '(dataFilter)';
      }

      const warnings = this.buildPayloadWarnings('write', payloadValidation);
      const meta = warnings
        ? {
            ...this.generateMeta('write', input, responseData, {
              cellsAffected: response.data.totalUpdatedCells ?? undefined,
            }),
            warnings,
          }
        : undefined;

      return this.success('write', responseData, undefined, undefined, meta);
    }

    // EXISTING: Traditional range-based path

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

        // Trigger background quality analysis (Phase 4: Optional Enhancement)
        const analysisConfig = getBackgroundAnalysisConfig();
        const cellsAffected = (responseData['updatedCells'] as number | undefined) ?? cellCount;
        if (analysisConfig.enabled && cellsAffected >= analysisConfig.minCells) {
          const analyzer = getBackgroundAnalyzer();
          analyzer.analyzeInBackground(input.spreadsheetId, range, cellsAffected, this.sheetsApi, {
            qualityThreshold: 70,
            minCellsChanged: analysisConfig.minCells,
            debounceMs: analysisConfig.debounceMs,
          });
        }

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
    // Protected with circuit breaker to prevent cascade failures during API degradation
    const response = await this.withCircuitBreaker('values.update', () =>
      this.sheetsApi.spreadsheets.values.update({
        spreadsheetId: input.spreadsheetId,
        range,
        valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
        includeValuesInResponse: input.includeValuesInResponse ?? false,
        requestBody: { values: input.values },
        fields: 'spreadsheetId,updatedCells,updatedRows,updatedColumns,updatedRange',
      })
    );

    // Invalidate ETag cache after mutation
    getETagCache().invalidateSpreadsheet(input.spreadsheetId);

    const responseData: Record<string, unknown> = {
      updatedCells: response.data.updatedCells ?? 0,
      updatedRows: response.data.updatedRows ?? 0,
      updatedColumns: response.data.updatedColumns ?? 0,
      updatedRange: response.data.updatedRange ?? range,
    };

    // Trigger background quality analysis (Phase 4: Optional Enhancement)
    const analysisConfig = getBackgroundAnalysisConfig();
    const cellsAffected = response.data.updatedCells ?? 0;
    if (analysisConfig.enabled && cellsAffected >= analysisConfig.minCells) {
      const analyzer = getBackgroundAnalyzer();
      analyzer.analyzeInBackground(input.spreadsheetId, range, cellsAffected, this.sheetsApi, {
        qualityThreshold: 70,
        minCellsChanged: analysisConfig.minCells,
        debounceMs: analysisConfig.debounceMs,
      });
    }

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
          suggestedFix:
            'Enable the feature by setting the appropriate environment variable, or contact your administrator',
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

          // Trigger background quality analysis
          const analysisConfig = getBackgroundAnalysisConfig();
          if (analysisConfig.enabled && cellCount >= analysisConfig.minCells) {
            const analyzer = getBackgroundAnalyzer();
            analyzer.analyzeInBackground(
              input.spreadsheetId,
              range ?? 'A1',
              cellCount,
              this.sheetsApi,
              {
                qualityThreshold: 70,
                minCellsChanged: analysisConfig.minCells,
                debounceMs: analysisConfig.debounceMs,
              }
            );
          }

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

      // Trigger background quality analysis
      const analysisConfig = getBackgroundAnalysisConfig();
      if (analysisConfig.enabled && cellCount >= analysisConfig.minCells) {
        const analyzer = getBackgroundAnalyzer();
        analyzer.analyzeInBackground(
          input.spreadsheetId,
          range ?? 'A1',
          cellCount,
          this.sheetsApi,
          {
            qualityThreshold: 70,
            minCellsChanged: analysisConfig.minCells,
            debounceMs: analysisConfig.debounceMs,
          }
        );
      }

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
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
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

        // Trigger background quality analysis
        const analysisConfig = getBackgroundAnalysisConfig();
        const affectedCells = (updates?.updatedCells as number | undefined) ?? cellCount;
        if (analysisConfig.enabled && affectedCells >= analysisConfig.minCells) {
          const analyzer = getBackgroundAnalyzer();
          analyzer.analyzeInBackground(input.spreadsheetId, range, affectedCells, this.sheetsApi, {
            qualityThreshold: 70,
            minCellsChanged: analysisConfig.minCells,
            debounceMs: analysisConfig.debounceMs,
          });
        }

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
    // Protected with circuit breaker to prevent cascade failures during API degradation
    const response = await this.withCircuitBreaker('values.append', () =>
      this.sheetsApi.spreadsheets.values.append({
        spreadsheetId: input.spreadsheetId,
        range,
        valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
        insertDataOption: input.insertDataOption ?? 'INSERT_ROWS',
        requestBody: { values: input.values },
        fields:
          'spreadsheetId,updates(spreadsheetId,updatedCells,updatedRows,updatedColumns,updatedRange)',
      })
    );

    // Invalidate ETag cache after mutation
    getETagCache().invalidateSpreadsheet(input.spreadsheetId);

    const updates = response.data.updates;

    const responseData: Record<string, unknown> = {
      updatedCells: updates?.updatedCells ?? 0,
      updatedRows: updates?.updatedRows ?? 0,
      updatedColumns: updates?.updatedColumns ?? 0,
      updatedRange: updates?.updatedRange ?? range,
    };

    // Trigger background quality analysis
    const analysisConfig = getBackgroundAnalysisConfig();
    const affectedCells = updates?.updatedCells ?? 0;
    if (analysisConfig.enabled && affectedCells >= analysisConfig.minCells) {
      const analyzer = getBackgroundAnalyzer();
      analyzer.analyzeInBackground(input.spreadsheetId, range, affectedCells, this.sheetsApi, {
        qualityThreshold: 70,
        minCellsChanged: analysisConfig.minCells,
        debounceMs: analysisConfig.debounceMs,
      });
    }

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

    // NEW: DataFilter path (uses batch API with single filter)
    if (input.dataFilter) {
      if (!this.featureFlags.enableDataFilterBatch) {
        this.context.metrics?.recordFeatureFlagBlock({
          flag: 'dataFilterBatch',
          tool: this.toolName,
          action: 'clear',
        });
        return this.error({
          code: 'FEATURE_UNAVAILABLE',
          message: 'DataFilter clears are disabled. Set ENABLE_DATAFILTER_BATCH=true.',
          retryable: false,
          suggestedFix: 'Enable the feature by setting the appropriate environment variable',
        });
      }

      // Check for dryRun
      if (input.safety?.dryRun) {
        return this.success(
          'clear',
          {
            clearedRanges: ['(dataFilter - dry run)'],
            _dryRun: true,
          },
          undefined,
          true
        );
      }

      const logger = this.context.logger || getRequestLogger();
      const startTime = Date.now();
      logger.info('Clear operation starting (dataFilter)', {
        dataFilter: input.dataFilter,
        spreadsheetId: input.spreadsheetId,
      });

      try {
        // API call with timeout
        const response = await Promise.race([
          this.withCircuitBreaker('values.batchClearByDataFilter', () =>
            this.sheetsApi.spreadsheets.values.batchClearByDataFilter({
              spreadsheetId: input.spreadsheetId,
              fields: 'clearedRanges',
              requestBody: {
                dataFilters: [input.dataFilter!], // Single-entry array (non-null: inside if block at line 1505)
              },
            })
          ),
          new Promise<never>((_, reject) => {
            const timeoutMs = parseInt(process.env['GOOGLE_API_TIMEOUT_MS'] ?? '60000', 10);
            setTimeout(
              () =>
                reject(new Error(`Clear operation timed out after ${timeoutMs / 1000} seconds`)),
              timeoutMs
            );
          }),
        ]);

        const duration = Date.now() - startTime;
        logger.info('Clear operation completed (dataFilter)', { duration });

        // Invalidate ETag cache after mutation
        getETagCache().invalidateSpreadsheet(input.spreadsheetId);

        const clearedRanges = response.data.clearedRanges ?? [];
        if (clearedRanges.length === 0) {
          return this.error({
            code: 'NOT_FOUND',
            message: 'No data matched the provided DataFilter for clear',
            retryable: false,
            suggestedFix:
              'Check that developer metadata exists for the given lookup criteria. Use sheets_advanced.set_metadata to tag ranges first.',
          });
        }

        // Trigger background quality analysis for first cleared range
        const analysisConfig = getBackgroundAnalysisConfig();
        if (analysisConfig.enabled && clearedRanges.length > 0) {
          const analyzer = getBackgroundAnalyzer();
          analyzer.analyzeInBackground(
            input.spreadsheetId,
            clearedRanges[0]!, // Non-null: inside length > 0 check
            100, // Conservative estimate for cleared cells
            this.sheetsApi,
            {
              qualityThreshold: 70,
              minCellsChanged: analysisConfig.minCells,
              debounceMs: analysisConfig.debounceMs,
            }
          );
        }

        return this.success('clear', {
          clearedRanges,
          updatedRange: clearedRanges[0] ?? '(dataFilter)',
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Clear operation failed (dataFilter)', {
          error: error instanceof Error ? error.message : String(error),
          duration,
          spreadsheetId: input.spreadsheetId,
        });

        // Provide helpful error with workaround if timeout
        if (error instanceof Error && error.message.includes('timed out')) {
          return this.error({
            code: 'DEADLINE_EXCEEDED',
            message: `Clear operation (dataFilter) timed out after ${duration}ms. Consider using a more specific filter.`,
            retryable: false,
            suggestedFix: 'Try using a more specific dataFilter or clearing by A1 range instead',
            details: {
              duration,
              workaround: 'Use A1 range-based clear if possible',
            },
          });
        }

        throw error;
      }
    }

    // EXISTING: Traditional range-based path
    if (!input.range) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: 'Range is required for clear operation',
        retryable: false,
      });
    }
    const range = await this.resolveRangeToA1(input.spreadsheetId, input.range);

    // Check for dryRun
    if (input.safety?.dryRun) {
      return this.success('clear', { updatedRange: range }, undefined, true);
    }

    // FIX 1.5: Enhanced diagnostics for clear timeout issue
    const logger = this.context.logger || getRequestLogger();
    const startTime = Date.now();
    logger.info('Clear operation starting', {
      range,
      spreadsheetId: input.spreadsheetId,
    });

    try {
      // Direct API call with 30s timeout (increased from 10s to match other mutation operations)
      // Protected with circuit breaker to prevent cascade failures during API degradation
      const response = await Promise.race([
        this.withCircuitBreaker('values.clear', () =>
          this.sheetsApi.spreadsheets.values.clear({
            spreadsheetId: input.spreadsheetId,
            range,
            fields: 'clearedRange',
          })
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Clear operation timed out after 30 seconds')), 30000)
        ),
      ]);

      const duration = Date.now() - startTime;
      logger.info('Clear operation completed', { duration, range });

      // Invalidate ETag cache after mutation
      getETagCache().invalidateSpreadsheet(input.spreadsheetId);

      // Trigger background quality analysis
      // Clear is a destructive operation that warrants quality monitoring
      const analysisConfig = getBackgroundAnalysisConfig();
      if (analysisConfig.enabled) {
        // Estimate cells affected from range (conservative estimate)
        const clearedRange = response.data.clearedRange ?? range;
        const analyzer = getBackgroundAnalyzer();
        analyzer.analyzeInBackground(
          input.spreadsheetId,
          clearedRange,
          100, // Conservative estimate for cleared cells
          this.sheetsApi,
          {
            qualityThreshold: 70,
            minCellsChanged: analysisConfig.minCells,
            debounceMs: analysisConfig.debounceMs,
          }
        );
      }

      return this.success('clear', {
        updatedRange: response.data.clearedRange ?? range,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Clear operation failed', {
        error: error instanceof Error ? error.message : String(error),
        range,
        duration,
        spreadsheetId: input.spreadsheetId,
      });

      // Provide helpful error with workaround if timeout
      if (error instanceof Error && error.message.includes('timed out')) {
        return this.error({
          code: 'DEADLINE_EXCEEDED',
          message: `Clear operation timed out after ${duration}ms.`,
          retryable: false,
          suggestedFix:
            `Workaround: Use sheets_data.write with empty values instead:\n` +
            `{"action":"write","spreadsheetId":"${input.spreadsheetId}","range":"${range}","values":[[]]}`,
          details: {
            range,
            duration,
            workaround: 'Use write action with empty values array',
          },
        });
      }

      throw error;
    }
  }

  private async handleBatchRead(
    input: DataRequest & { action: 'batch_read' }
  ): Promise<DataResponse> {
    // Pagination enabled: check for cursor or pageSize fields
    const wantsPagination = Boolean(input.cursor || input.pageSize);

    if (wantsPagination) {
      if (input.dataFilters && input.dataFilters.length > 0) {
        return this.error({
          code: 'INVALID_PARAMS',
          message: 'Pagination is not supported with dataFilters in batch_read',
          retryable: false,
          suggestedFix:
            'Check the parameter format and ensure all required parameters are provided',
        });
      }
      if (!input.ranges || input.ranges.length === 0) {
        return this.error({
          code: 'INVALID_PARAMS',
          message: 'Pagination in batch_read requires at least one range',
          retryable: false,
          suggestedFix:
            'Check the parameter format and ensure all required parameters are provided',
        });
      }

      // Phase 1.1: Multi-range pagination support
      const paginationPlan = await this.buildMultiRangePaginationPlan({
        spreadsheetId: input.spreadsheetId,
        ranges: input.ranges,
        cursor: input.cursor,
        pageSize: input.pageSize,
      });

      if ('error' in paginationPlan) {
        return paginationPlan.error;
      }

      // Fetch the ranges for this page
      const valueRanges: Array<{ range: string; values: ValuesArray }> = [];

      for (let i = 0; i < paginationPlan.rangesToFetch.length; i++) {
        const range = paginationPlan.rangesToFetch[i]!;

        // Phase 2: Send progress notification (HTTP only, throttled to 1/sec)
        await this.sendProgress(
          i + 1,
          paginationPlan.totalRanges,
          `Reading range ${i + 1}/${paginationPlan.rangesToFetch.length} in current page`
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resolvedRange = await this.resolveRangeToA1(input.spreadsheetId, range as any);
        const dedupKey = `values:get:${input.spreadsheetId}:${resolvedRange}:${input.valueRenderOption ?? 'FORMATTED_VALUE'}:${input.majorDimension ?? 'ROWS'}`;

        const response = await this.deduplicatedApiCall(dedupKey, () =>
          this.sheetsApi.spreadsheets.values.get({
            spreadsheetId: input.spreadsheetId,
            range: resolvedRange,
            valueRenderOption: input.valueRenderOption,
            majorDimension: input.majorDimension,
            dateTimeRenderOption:
              input.valueRenderOption === 'UNFORMATTED_VALUE' ? 'FORMATTED_STRING' : undefined,
            fields: 'range,majorDimension,values',
          })
        );

        valueRanges.push({
          range: response.data.range ?? resolvedRange,
          values: (response.data.values ?? []) as ValuesArray,
        });
      }

      const responseData: Record<string, unknown> = {
        valueRanges,
        nextCursor: paginationPlan.nextCursor,
        hasMore: paginationPlan.hasMore,
        totalRanges: paginationPlan.totalRanges,
        currentPage: {
          rangeIndices: paginationPlan.rangeIndices,
          rangeCount: paginationPlan.rangesToFetch.length,
        },
      };

      if (paginationPlan.hasMore && paginationPlan.nextCursor) {
        responseData['_paginationHint'] =
          `Showing ${paginationPlan.rangesToFetch.length} of ${paginationPlan.totalRanges} ranges. ` +
          `To fetch next page, repeat this call with cursor:"${paginationPlan.nextCursor}"`;
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
          suggestedFix:
            'Enable the feature by setting the appropriate environment variable, or contact your administrator',
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

    // Track batch reads for redundancy detection
    if (this.context.sessionContext) {
      for (const range of ranges) {
        this.context.sessionContext.trackReadOperation(input.spreadsheetId, range);
      }
    }

    // Synchronous range merging optimization (30-50% API call reduction)
    const { mergeOverlappingRanges, splitMergedResponse, calculateReductionPercentage } =
      await import('../utils/range-merger.js');
    const mergeResult = mergeOverlappingRanges(ranges);

    // Record range merging metrics
    if (mergeResult.apiCallReduction > 0) {
      const reductionPercentage = calculateReductionPercentage(mergeResult);
      this.context.logger?.info('Range merging optimization applied', {
        originalRanges: mergeResult.originalCount,
        mergedRanges: mergeResult.mergedCount,
        apiCallsSaved: mergeResult.apiCallReduction,
        reductionPercentage: `${reductionPercentage.toFixed(1)}%`,
      });

      // Record Prometheus metrics
      const { recordRangeMerging } = await import('../observability/metrics.js');
      recordRangeMerging('batch_read', mergeResult.apiCallReduction, reductionPercentage);
    }

    // Fix 2.3: Auto-chunk large batches to prevent timeouts
    if (ranges.length > MAX_BATCH_RANGES) {
      const logger = this.context.logger;
      const chunks: string[][] = [];
      for (let i = 0; i < ranges.length; i += MAX_BATCH_RANGES) {
        chunks.push(ranges.slice(i, i + MAX_BATCH_RANGES));
      }

      logger?.info(`Auto-chunking ${ranges.length} ranges into ${chunks.length} batches`, {
        totalRanges: ranges.length,
        maxPerBatch: MAX_BATCH_RANGES,
        chunkCount: chunks.length,
      });

      const allValueRanges: Array<{ range: string; values: ValuesArray }> = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        logger?.info(`Processing chunk ${i + 1}/${chunks.length}`, {
          chunkSize: chunk.length,
        });

        const response = await this.sheetsApi.spreadsheets.values.batchGet({
          spreadsheetId: input.spreadsheetId,
          ranges: chunk,
          valueRenderOption: input.valueRenderOption,
          majorDimension: input.majorDimension,
          dateTimeRenderOption:
            input.valueRenderOption === 'UNFORMATTED_VALUE' ? 'FORMATTED_STRING' : undefined,
          fields: 'valueRanges(range,values)',
        });

        const chunkValueRanges = (response.data.valueRanges ?? []).map(
          (vr: sheets_v4.Schema$ValueRange) => ({
            range: vr.range ?? '',
            values: (vr.values ?? []) as ValuesArray,
          })
        );

        allValueRanges.push(...chunkValueRanges);
      }

      logger?.info(`Batch chunking complete`, {
        totalRanges: ranges.length,
        chunksProcessed: chunks.length,
        rangesRetrieved: allValueRanges.length,
      });

      return this.success('batch_read', {
        valueRanges: allValueRanges,
        _chunked: true,
        _chunkCount: chunks.length,
      });
    }

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

    // Check if ParallelExecutor should be used for large batch operations
    const env = getEnv();
    const useParallel =
      this.context.parallelExecutor &&
      env.ENABLE_PARALLEL_EXECUTOR &&
      ranges.length > env.PARALLEL_EXECUTOR_THRESHOLD;

    let valueRanges: sheets_v4.Schema$ValueRange[];

    if (useParallel) {
      // Use ParallelExecutor with merged ranges for optimal performance
      const tasks = mergeResult.mergedRanges.map((merged, i) => ({
        id: `batch-read-merged-${i}`,
        fn: async () => {
          const dedupKey = `values:get:${input.spreadsheetId}:${merged.mergedRange}:${input.valueRenderOption ?? 'FORMATTED_VALUE'}:${input.majorDimension ?? 'ROWS'}`;
          const res = await this.deduplicatedApiCall(dedupKey, () =>
            this.sheetsApi.spreadsheets.values.get({
              spreadsheetId: input.spreadsheetId,
              range: merged.mergedRange,
              valueRenderOption: input.valueRenderOption,
              majorDimension: (input as DataRequest & { majorDimension?: string }).majorDimension,
              dateTimeRenderOption:
                input.valueRenderOption === 'UNFORMATTED_VALUE' ? 'FORMATTED_STRING' : undefined,
              fields: 'range,values',
            })
          );
          return { mergedData: res.data, merged };
        },
        priority: 1,
      }));

      // Send granular progress if enabled
      const onProgress = env.ENABLE_GRANULAR_PROGRESS
        ? async (progress: { completed: number; total: number }) => {
            await sendProgress(
              progress.completed,
              progress.total,
              `Reading ${progress.completed}/${mergeResult.mergedCount} merged ranges`
            );
          }
        : undefined;

      const results = await this.context.parallelExecutor!.executeAllSuccessful(tasks, onProgress);

      // Split merged responses back to original ranges
      valueRanges = new Array(ranges.length);
      for (const result of results) {
        const { mergedData, merged } = result as {
          mergedData: sheets_v4.Schema$ValueRange;
          merged: { rangeInfo: unknown; originalIndices: number[] };
        };
        const mergedValues = (mergedData.values || []) as unknown[][];

        for (const originalIndex of merged.originalIndices) {
          const originalRange = ranges[originalIndex]!;
          const { parseA1Range } = await import('../services/request-merger.js');
          const targetRangeInfo = parseA1Range(originalRange);

          // Split the merged response for this original range
          const splitValues = splitMergedResponse(
            mergedValues,
            merged.rangeInfo as Parameters<typeof splitMergedResponse>[1],
            targetRangeInfo
          );

          valueRanges[originalIndex] = {
            range: originalRange,
            values: splitValues,
            majorDimension: mergedData.majorDimension,
          };
        }
      }
    } else {
      // Direct API call with merged ranges
      const mergedRangeStrings = mergeResult.mergedRanges.map((m) => m.mergedRange);
      const response = await this.sheetsApi.spreadsheets.values.batchGet({
        spreadsheetId: input.spreadsheetId,
        ranges: mergedRangeStrings,
        valueRenderOption: input.valueRenderOption,
        majorDimension: input.majorDimension,
        dateTimeRenderOption:
          input.valueRenderOption === 'UNFORMATTED_VALUE' ? 'FORMATTED_STRING' : undefined,
        fields: 'valueRanges(range,values)',
      });
      const mergedResults = response.data.valueRanges ?? [];

      // Split merged responses back to original ranges
      valueRanges = new Array(ranges.length);
      for (let i = 0; i < mergeResult.mergedRanges.length; i++) {
        const merged = mergeResult.mergedRanges[i]!;
        const mergedData = mergedResults[i];
        if (!mergedData) continue;

        const mergedValues = (mergedData.values || []) as unknown[][];

        for (const originalIndex of merged.originalIndices) {
          const originalRange = ranges[originalIndex]!;
          const { parseA1Range } = await import('../services/request-merger.js');
          const targetRangeInfo = parseA1Range(originalRange);

          // Split the merged response for this original range
          const splitValues = splitMergedResponse(mergedValues, merged.rangeInfo, targetRangeInfo);

          valueRanges[originalIndex] = {
            range: originalRange,
            values: splitValues,
            majorDimension: mergedData.majorDimension,
          };
        }
      }
    }

    // Record access patterns and trigger prefetch (80% latency reduction on sequential ops)
    for (const range of ranges) {
      this.recordAccessAndPrefetch({
        spreadsheetId: input.spreadsheetId,
        range,
        action: 'read',
      });
    }

    return this.success('batch_read', {
      valueRanges: valueRanges.map((vr: sheets_v4.Schema$ValueRange) => ({
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

    // Request confirmation for large batch writes (>1000 cells)
    if (totalCells > 1000 && this.context.elicitationServer) {
      const confirmation = await confirmDestructiveAction(
        this.context.elicitationServer,
        'batch_write',
        `Batch write will overwrite ${totalCells} cells across ${input.data.length} ranges in spreadsheet ${input.spreadsheetId}. This action cannot be undone without a snapshot.`
      );
      if (!confirmation.confirmed) {
        return this.error({
          code: 'PRECONDITION_FAILED',
          message: confirmation.reason || 'User cancelled the operation',
          retryable: false,
          suggestedFix: 'Review the operation requirements and try again',
        });
      }
    }

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
        suggestedFix:
          'Enable the feature by setting the appropriate environment variable, or contact your administrator',
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
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    const rangeEntries = input.data as Array<{ range?: RangeInput; values: ValuesArray }>;
    if (rangeEntries.some((entry) => !entry.range)) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: 'Missing range for batch_write entry',
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    const data = await Promise.all(
      rangeEntries.map(async (d) => ({
        range: await this.resolveRangeToA1(input.spreadsheetId, d.range!),
        values: d.values,
      }))
    );

    // Fix 2.3: Auto-chunk large batch writes to prevent timeouts
    if (data.length > MAX_BATCH_RANGES) {
      const logger = this.context.logger;
      const chunks: Array<typeof data> = [];
      for (let i = 0; i < data.length; i += MAX_BATCH_RANGES) {
        chunks.push(data.slice(i, i + MAX_BATCH_RANGES));
      }

      logger?.info(`Auto-chunking ${data.length} write ranges into ${chunks.length} batches`, {
        totalRanges: data.length,
        maxPerBatch: MAX_BATCH_RANGES,
        chunkCount: chunks.length,
      });

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

      let totalUpdatedCells = 0;
      let totalUpdatedRows = 0;
      let totalUpdatedColumns = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        logger?.info(`Processing write chunk ${i + 1}/${chunks.length}`, {
          chunkSize: chunk.length,
        });

        const response = await this.withCircuitBreaker('values.batchUpdate', () =>
          this.sheetsApi.spreadsheets.values.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            fields: 'totalUpdatedCells,totalUpdatedRows,totalUpdatedColumns',
            requestBody: {
              valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
              includeValuesInResponse: input.includeValuesInResponse ?? false,
              data: chunk,
            },
          })
        );

        totalUpdatedCells += response.data.totalUpdatedCells ?? 0;
        totalUpdatedRows += response.data.totalUpdatedRows ?? 0;
        totalUpdatedColumns += response.data.totalUpdatedColumns ?? 0;
      }

      // Invalidate ETag cache after mutation
      getETagCache().invalidateSpreadsheet(input.spreadsheetId);

      logger?.info(`Batch write chunking complete`, {
        totalRanges: data.length,
        chunksProcessed: chunks.length,
        totalUpdatedCells,
      });

      const responseData: Record<string, unknown> = {
        updatedCells: totalUpdatedCells,
        updatedRows: totalUpdatedRows,
        updatedColumns: totalUpdatedColumns,
        _chunked: true,
        _chunkCount: chunks.length,
      };

      const warnings = this.buildPayloadWarnings('batch_write', payloadValidation);
      const meta = warnings
        ? {
            ...this.generateMeta('batch_write', input, responseData, {
              cellsAffected: totalUpdatedCells,
            }),
            warnings,
          }
        : undefined;

      return this.success('batch_write', responseData, undefined, undefined, meta);
    }

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
    // Protected with circuit breaker to prevent cascade failures during API degradation
    const includeValues = input.includeValuesInResponse ?? false;
    const response = await this.withCircuitBreaker('values.batchUpdate', () =>
      this.sheetsApi.spreadsheets.values.batchUpdate({
        spreadsheetId: input.spreadsheetId,
        fields: includeValues
          ? 'totalUpdatedCells,totalUpdatedRows,totalUpdatedColumns,responses(updatedData)'
          : 'totalUpdatedCells,totalUpdatedRows,totalUpdatedColumns',
        requestBody: {
          valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
          includeValuesInResponse: includeValues,
          data,
        },
      })
    );

    // Invalidate ETag cache after mutation
    getETagCache().invalidateSpreadsheet(input.spreadsheetId);

    const responseData: Record<string, unknown> = {
      updatedCells: response.data.totalUpdatedCells ?? 0,
      updatedRows: response.data.totalUpdatedRows ?? 0,
      updatedColumns: response.data.totalUpdatedColumns ?? 0,
    };

    // Surface echoed-back values when includeValuesInResponse was requested
    if (includeValues && response.data.responses) {
      responseData['updatedData'] = response.data.responses
        .map((r) => r.updatedData?.values)
        .filter(Boolean);
    }

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
          suggestedFix:
            'Enable the feature by setting the appropriate environment variable, or contact your administrator',
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
    // Protected with circuit breaker to prevent cascade failures during API degradation
    const response = await this.withCircuitBreaker('values.batchClear', () =>
      this.sheetsApi.spreadsheets.values.batchClear({
        spreadsheetId: input.spreadsheetId,
        fields: 'clearedRanges',
        requestBody: { ranges },
      })
    );

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
      // Use request deduplication for read
      const searchRange = resolvedRange ?? 'A:ZZ';
      const renderOption = input.includeFormulas ? 'FORMULA' : 'FORMATTED_VALUE';
      const dedupKey = `values:get:${input.spreadsheetId}:${searchRange}:${renderOption}:ROWS`;
      const response = await this.deduplicatedApiCall(dedupKey, () =>
        this.sheetsApi.spreadsheets.values.get({
          spreadsheetId: input.spreadsheetId,
          range: searchRange,
          valueRenderOption: renderOption,
          fields: 'range,values',
        })
      );

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
    // Protected with circuit breaker to prevent cascade failures during API degradation
    const response = await this.withCircuitBreaker('batchUpdate.findReplace', () =>
      this.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: input.spreadsheetId,
        requestBody: {
          requests: [
            {
              findReplace: findReplaceRequest,
            },
          ],
        },
      })
    );

    const reply = response.data?.replies?.[0]?.findReplace;
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
    // Protected with circuit breaker to prevent cascade failures during API degradation
    await this.withCircuitBreaker('batchUpdate.setHyperlink', () =>
      this.sheetsApi.spreadsheets.batchUpdate({
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
      })
    );

    return this.success('set_hyperlink', {});
  }

  private async handleClearHyperlink(
    input: DataRequest & { action: 'clear_hyperlink' }
  ): Promise<DataResponse> {
    const gridRange = await this.cellToGridRange(input.spreadsheetId, input.cell);

    // Use request deduplication for read
    const dedupKey = `values:get:${input.spreadsheetId}:${input.cell}:FORMATTED_VALUE:ROWS`;
    const response = await this.deduplicatedApiCall(dedupKey, () =>
      this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: input.spreadsheetId,
        range: input.cell,
        valueRenderOption: 'FORMATTED_VALUE',
        fields: 'values',
      })
    );
    const currentValue = response.data.values?.[0]?.[0] ?? '';

    // Protected with circuit breaker to prevent cascade failures during API degradation
    await this.withCircuitBreaker('batchUpdate.clearHyperlink', () =>
      this.sheetsApi.spreadsheets.batchUpdate({
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
      })
    );

    return this.success('clear_hyperlink', {});
  }

  private async handleMergeCells(
    input: DataRequest & { action: 'merge_cells' }
  ): Promise<DataResponse> {
    const rangeA1 = await this.resolveRangeToA1(input.spreadsheetId, input.range);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);

    // Direct API call
    // Protected with circuit breaker to prevent cascade failures during API degradation
    await this.withCircuitBreaker('batchUpdate.mergeCells', () =>
      this.sheetsApi.spreadsheets.batchUpdate({
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
      })
    );

    return this.success('merge_cells', {});
  }

  private async handleUnmergeCells(
    input: DataRequest & { action: 'unmerge_cells' }
  ): Promise<DataResponse> {
    const rangeA1 = await this.resolveRangeToA1(input.spreadsheetId, input.range);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);

    // Direct API call
    // Protected with circuit breaker to prevent cascade failures during API degradation
    await this.withCircuitBreaker('batchUpdate.unmergeCells', () =>
      this.sheetsApi.spreadsheets.batchUpdate({
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
      })
    );

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

    let destParsed;
    try {
      destParsed = parseCellReference(input.destination);
    } catch (_error) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: `Invalid destination cell reference: ${input.destination}. Expected format: 'Sheet1!A1' or 'A1'`,
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    const destinationSheetId = destParsed.sheetName
      ? await this.getSheetId(input.spreadsheetId, destParsed.sheetName, this.sheetsApi)
      : sourceRange.sheetId;

    // Direct API call - no confirmation, no snapshot (simplified for reliability)
    // Protected with circuit breaker to prevent cascade failures during API degradation
    await this.withCircuitBreaker('batchUpdate.cutPaste', () =>
      this.sheetsApi.spreadsheets.batchUpdate({
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
      })
    );

    return this.success('cut_paste', {});
  }

  private async handleCopyPaste(
    input: DataRequest & { action: 'copy_paste' }
  ): Promise<DataResponse> {
    const rangeA1 = await this.resolveRangeToA1(input.spreadsheetId, input.source);
    const sourceRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);

    let destParsed;
    try {
      destParsed = parseCellReference(input.destination);
    } catch (_error) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: `Invalid destination cell reference: ${input.destination}. Expected format: 'Sheet1!A1' or 'A1'`,
        retryable: false,
        suggestedFix: 'Check the parameter format and ensure all required parameters are provided',
      });
    }

    const destinationSheetId = destParsed.sheetName
      ? await this.getSheetId(input.spreadsheetId, destParsed.sheetName, this.sheetsApi)
      : sourceRange.sheetId;

    const sourceRows = (sourceRange.endRowIndex ?? 0) - (sourceRange.startRowIndex ?? 0);
    const sourceCols = (sourceRange.endColumnIndex ?? 0) - (sourceRange.startColumnIndex ?? 0);

    // Direct API call
    // Protected with circuit breaker to prevent cascade failures during API degradation
    await this.withCircuitBreaker('batchUpdate.copyPaste', () =>
      this.sheetsApi.spreadsheets.batchUpdate({
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
      })
    );

    return this.success('copy_paste', {});
  }

  private async handleDetectSpillRanges(
    input: Extract<SheetsDataInput['request'], { action: 'detect_spill_ranges' }>
  ): Promise<DataResponse> {
    // Resolve which sheet to scan
    let rangeStr: string;
    if (input.range) {
      rangeStr = await this.resolveRangeToA1(input.spreadsheetId!, input.range);
    } else if (input.sheetId !== undefined) {
      const spreadsheet = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId!,
        fields: 'sheets.properties',
      });
      const sheet = spreadsheet.data.sheets?.find((s) => s.properties?.sheetId === input.sheetId);
      rangeStr = sheet?.properties?.title ?? 'Sheet1';
    } else {
      // Default: scan first sheet
      const spreadsheet = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId!,
        fields: 'sheets.properties',
      });
      rangeStr = spreadsheet.data.sheets?.[0]?.properties?.title ?? 'Sheet1';
    }

    // Read cell formulas
    const result = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: input.spreadsheetId!,
      ranges: [rangeStr],
      fields: 'sheets.data.rowData.values.userEnteredValue',
      includeGridData: true,
    });

    const sheetName = rangeStr.split('!')[0];
    const sheetData = result.data.sheets?.[0]?.data?.[0];
    const rows = sheetData?.rowData ?? [];

    // Dynamic array functions that produce spill ranges in Google Sheets
    const dynamicArrayRe =
      /^=\s*(FILTER|SORT|UNIQUE|SEQUENCE|RANDARRAY|XLOOKUP|XMATCH|MMULT|TRANSPOSE|FLATTEN|CHOOSEROWS|CHOOSECOLS|HSTACK|VSTACK|TOROW|TOCOL|BYROW|BYCOL|MAP|REDUCE|SCAN|MAKEARRAY)\s*\(/i;

    const spillRanges: Array<{
      sourceCell: string;
      formula: string;
      spillRange: string;
      rows: number;
      cols: number;
    }> = [];

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const cells = rows[rowIdx]?.values ?? [];
      for (let colIdx = 0; colIdx < cells.length; colIdx++) {
        const formula = cells[colIdx]?.userEnteredValue?.formulaValue ?? '';
        if (!formula || !dynamicArrayRe.test(formula)) continue;

        // Estimate spill extent: count consecutive non-formula cells right and down
        let spillCols = 1;
        for (let c = colIdx + 1; c < cells.length; c++) {
          const adj = cells[c]?.userEnteredValue;
          if (!adj || (adj as { formulaValue?: string }).formulaValue) break;
          spillCols++;
        }

        let spillRows = 1;
        for (let r = rowIdx + 1; r < Math.min(rowIdx + 1000, rows.length); r++) {
          const adjCell = rows[r]?.values?.[colIdx]?.userEnteredValue;
          if (!adjCell || (adjCell as { formulaValue?: string }).formulaValue) break;
          spillRows++;
        }

        const startRef = this.buildCellRef(rowIdx, colIdx);
        const endRef = this.buildCellRef(rowIdx + spillRows - 1, colIdx + spillCols - 1);
        spillRanges.push({
          sourceCell: `${sheetName}!${startRef}`,
          formula,
          spillRange: `${sheetName}!${startRef}:${endRef}`,
          rows: spillRows,
          cols: spillCols,
        });
      }
    }

    return this.success('detect_spill_ranges', { spillRanges });
  }

  /** Convert 0-based row/col to A1 cell reference (e.g. 0,0 → "A1") */
  private buildCellRef(rowIndex: number, colIndex: number): string {
    let col = '';
    let c = colIndex;
    do {
      col = String.fromCharCode(65 + (c % 26)) + col;
      c = Math.floor(c / 26) - 1;
    } while (c >= 0);
    return `${col}${rowIndex + 1}`;
  }
}
