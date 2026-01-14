/**
 * ServalSheets v2.0 - Data Handler
 *
 * Consolidated data operations handler combining:
 * - Cell value operations (read, write, append, clear, find, replace)
 * - Cell-level operations (notes, validation, hyperlinks, merge, cut, copy)
 *
 * Architecture: Main handler delegates to sub-handlers for organization
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type { SheetsDataInput, SheetsDataOutput } from '../schemas/data.js';
import type { ValuesArray } from '../schemas/index.js';
import { getRequestLogger } from '../utils/request-context.js';
import { logger } from '../utils/logger.js';
import { cacheManager, createCacheKey } from '../utils/cache-manager.js';
import { createRequestKey } from '../utils/request-deduplication.js';
import { confirmDestructiveAction } from '../mcp/elicitation.js';
import { CACHE_TTL_VALUES } from '../config/constants.js';
import { FallbackStrategies } from '../utils/circuit-breaker.js';
import { validateHyperlinkUrl } from '../utils/url.js';
import {
  parseA1Notation,
  parseCellReference,
  toGridRange,
  type GridRangeInput,
} from '../utils/google-sheets-helpers.js';

/**
 * Response type union for all data operations
 */
type DataResponse =
  | { success: true; action: string; [key: string]: unknown }
  | {
      success: false;
      error: { code: string; message: string; retryable: boolean; [key: string]: unknown };
    };

/**
 * Main handler for sheets_data tool
 * Delegates to sub-handlers based on action type
 */
export class SheetsDataHandler extends BaseHandler<SheetsDataInput, SheetsDataOutput> {
  private sheetsApi: sheets_v4.Sheets;
  private valuesOps: ValuesOperations;
  private cellsOps: CellsOperations;
  private valueCacheMap = new Map<string, sheets_v4.Schema$ValueRange>();

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_data', context);
    this.sheetsApi = sheetsApi;
    this.valuesOps = new ValuesOperations(this);
    this.cellsOps = new CellsOperations(this);
    this.registerReadFallbacks();
  }

  /**
   * Register circuit breaker fallback strategies for read operations
   *
   * Production Pattern: Multi-tier fallback system
   *
   * When Google Sheets API fails or circuit opens:
   * 1. Try cached data (priority 100) - Return stale data if available
   * 2. Retry with backoff (priority 80) - Handle transient failures
   * 3. Degraded mode (priority 50) - Return empty result with warning
   *
   * This ensures the system remains responsive even during API outages.
   */
  private registerReadFallbacks(): void {
    if (!this.context.circuitBreaker) {
      return; // Circuit breaker not configured
    }

    // Fallback 1: Return cached data (highest priority)
    this.context.circuitBreaker.registerFallback(
      FallbackStrategies.cachedData(
        this.valueCacheMap,
        'values-fallback-cache',
        100 // Highest priority
      )
    );

    // Fallback 2: Retry with exponential backoff (high priority)
    this.context.circuitBreaker.registerFallback(
      FallbackStrategies.retryWithBackoff(
        async () => {
          throw new Error('Retry operation not set');
        },
        3, // Max 3 retries
        1000, // 1 second base delay
        80 // High priority
      )
    );

    // Fallback 3: Degraded mode (low priority, last resort)
    this.context.circuitBreaker.registerFallback(
      FallbackStrategies.degradedMode(
        {
          values: [],
          range: '',
          warning:
            'Google Sheets API unavailable. Returning empty data. System is in degraded mode.',
          degraded: true,
        },
        50 // Lower priority
      )
    );

    logger.info('Registered circuit breaker fallback strategies for data handler', {
      strategies: ['cached-data', 'retry-with-backoff', 'degraded-mode'],
      circuitName: this.context.circuitBreaker.getState(),
    });
  }

  /**
   * Apply verbosity filtering to optimize token usage (LLM optimization)
   */
  private applyVerbosityFilter(
    response: DataResponse,
    verbosity: 'minimal' | 'standard' | 'detailed'
  ): DataResponse {
    if (!response.success || verbosity === 'standard') {
      return response; // No filtering for errors or standard verbosity
    }

    if (verbosity === 'minimal') {
      // Minimal: Return only essential fields (~60% token reduction)
      const filtered = { ...response };

      // For read operations: keep only values, omit metadata
      if ('values' in filtered && Array.isArray(filtered['values'])) {
        // Keep values but omit row counts, column counts, etc
        return {
          success: true,
          action: filtered.action,
          values: filtered['values'],
        } as DataResponse;
      }

      // For write operations: keep only summary
      if ('updated' in filtered) {
        return {
          success: true,
          action: filtered.action,
          updated: filtered['updated'],
        } as DataResponse;
      }

      // For other operations: keep action + success + primary data field
      // Omit: _meta, rowMetadata, columnMetadata, etc.
      const primaryDataFields = ['note', 'hyperlink', 'merged', 'cutSuccess', 'copiedRange'];
      const minimalResponse: DataResponse = {
        success: true,
        action: filtered.action,
      };

      // Copy only primary data fields
      for (const field of primaryDataFields) {
        if (field in filtered) {
          (minimalResponse as any)[field] = (filtered as any)[field];
        }
      }

      return minimalResponse;
    }

    // Detailed: Add extra metadata (future enhancement)
    return response;
  }

  async handle(input: SheetsDataInput): Promise<SheetsDataOutput> {
    // Require authentication before proceeding
    this.requireAuth();

    // Track spreadsheet ID for better error messages
    if ('spreadsheetId' in input) {
      this.trackSpreadsheetId(input.spreadsheetId);
    }

    // Infer parameters from context
    const req = this.inferRequestParameters(input) as SheetsDataInput;

    try {
      const response = await this.executeAction(req);

      // Track context after successful operation
      if (response.success && 'spreadsheetId' in req) {
        this.trackContextFromRequest({
          spreadsheetId: req.spreadsheetId,
          sheetId:
            'sheetId' in req
              ? typeof req.sheetId === 'number'
                ? req.sheetId
                : undefined
              : undefined,
          range:
            'range' in req ? (typeof req.range === 'string' ? req.range : undefined) : undefined,
        });
      }

      // Apply verbosity filtering (LLM optimization)
      const verbosity = req.verbosity ?? 'standard';
      const filteredResponse = this.applyVerbosityFilter(response, verbosity);

      return filteredResponse as unknown as SheetsDataOutput;
    } catch (err) {
      return this.mapError(err) as unknown as SheetsDataOutput;
    }
  }

  protected createIntents(input: SheetsDataInput): Intent[] {
    const baseIntent = {
      target: {
        spreadsheetId: 'spreadsheetId' in input ? input.spreadsheetId! : '',
      },
      metadata: {
        sourceTool: this.toolName,
        sourceAction: input.action,
        priority: 1,
        destructive: false,
      },
    };

    switch (input.action) {
      case 'write':
        return [
          {
            ...baseIntent,
            type: 'SET_VALUES' as const,
            payload: { values: input.values },
            metadata: {
              ...baseIntent.metadata,
              estimatedCells: input.values!.reduce((sum, row) => sum + row.length, 0),
            },
          },
        ];
      case 'append':
        return [
          {
            ...baseIntent,
            type: 'APPEND_VALUES' as const,
            payload: { values: input.values },
            metadata: {
              ...baseIntent.metadata,
              estimatedCells: input.values!.reduce((sum, row) => sum + row.length, 0),
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
   * Route action to appropriate sub-handler
   */
  private async executeAction(request: SheetsDataInput): Promise<DataResponse> {
    // Values operations
    const valuesActions = [
      'read',
      'write',
      'append',
      'clear',
      'batch_read',
      'batch_write',
      'find',
      'replace',
    ];

    if (valuesActions.includes(request.action)) {
      return this.valuesOps.handle(request);
    }

    // Cells operations
    const cellsActions = [
      'add_note',
      'get_note',
      'clear_note',
      'set_hyperlink',
      'clear_hyperlink',
      'merge',
      'unmerge',
      'get_merges',
      'cut',
      'copy_cells',
      'get_properties',
    ];

    if (cellsActions.includes(request.action)) {
      return this.cellsOps.handle(request);
    }

    return this.error({
      code: 'INVALID_PARAMS',
      message: `Unknown action: ${request.action}`,
      retryable: false,
    });
  }
}

// =============================================================================
// VALUES OPERATIONS SUB-HANDLER
// =============================================================================

/**
 * Handles all cell value operations (read, write, append, clear, find, replace)
 */
class ValuesOperations {
  constructor(private parent: SheetsDataHandler) {}

  // Accessor methods for parent's dependencies
  private get sheetsApi() {
    return this.parent['sheetsApi'];
  }
  private get context() {
    return this.parent['context'];
  }
  private get valueCacheMap() {
    return this.parent['valueCacheMap'];
  }
  private get toolName() {
    return this.parent['toolName'];
  }

  // Delegate to parent methods
  private success = <T extends Record<string, unknown>>(
    action: string,
    data: T,
    mutation?: any,
    dryRun?: boolean
  ) => this.parent['success'](action, data, mutation, dryRun);

  private error = (error: any) => this.parent['error'](error);
  private async resolveRange(spreadsheetId: string, range: string): Promise<string> {
    const resolved = await this.context.rangeResolver.resolve(spreadsheetId, { a1: range });
    return resolved.a1Notation;
  }
  private createMutationSummary = (results: any[]) => this.parent['createMutationSummary'](results);
  private columnToLetter = (index: number) => this.parent['columnToLetter'](index);

  async handle(input: SheetsDataInput): Promise<DataResponse> {
    switch (input.action) {
      case 'read':
        return await this.handleRead(input as any);
      case 'write':
        return await this.handleWrite(input as any);
      case 'append':
        return await this.handleAppend(input as any);
      case 'clear':
        return await this.handleClear(input as any);
      case 'batch_read':
        return await this.handleBatchRead(input as any);
      case 'batch_write':
        return await this.handleBatchWrite(input as any);
      case 'find':
        return await this.handleFind(input as any);
      case 'replace':
        return await this.handleReplace(input as any);
      default:
        return this.error({
          code: 'INVALID_PARAMS',
          message: `Unknown values action: ${input.action}`,
          retryable: false,
        });
    }
  }

  private async handleRead(input: any): Promise<DataResponse> {
    const range = await this.resolveRange(input.spreadsheetId, input.range);

    const params: sheets_v4.Params$Resource$Spreadsheets$Values$Get = {
      spreadsheetId: input.spreadsheetId,
      range,
      fields: 'range,majorDimension,values',
    };
    if (input.valueRenderOption) params.valueRenderOption = input.valueRenderOption;
    if (input.dateTimeRenderOption) params.dateTimeRenderOption = input.dateTimeRenderOption;
    if (input.majorDimension) params.majorDimension = input.majorDimension;

    // Try cache first
    const cacheKey = createCacheKey('values:read', params as unknown as Record<string, unknown>);
    const cached = cacheManager.get<sheets_v4.Schema$ValueRange>(cacheKey, 'values');

    const response = (
      cached
        ? { data: cached }
        : await (async () => {
            const requestKey = createRequestKey('values.get', {
              spreadsheetId: input.spreadsheetId,
              range,
              valueRenderOption: input.valueRenderOption,
              majorDimension: input.majorDimension,
            });

            const fetchFn = async (): Promise<unknown> => {
              const requestMerger = cacheManager.getRequestMerger();
              let result: sheets_v4.Schema$ValueRange;

              if (requestMerger) {
                result = await requestMerger.mergeRead(this.sheetsApi, input.spreadsheetId, range, {
                  valueRenderOption: input.valueRenderOption,
                  majorDimension: input.majorDimension,
                });
              } else {
                const apiResponse = await this.sheetsApi.spreadsheets.values.get(params);
                result = apiResponse.data;
              }

              cacheManager.set(cacheKey, result, {
                ttl: CACHE_TTL_VALUES,
                namespace: 'values',
              });
              cacheManager.trackRangeDependency(input.spreadsheetId, range, cacheKey);
              this.valueCacheMap.set('values-fallback-cache', result);
              return { data: result };
            };

            return this.context.requestDeduplicator
              ? await this.context.requestDeduplicator.deduplicate(requestKey, fetchFn)
              : await fetchFn();
          })()
    ) as { data: sheets_v4.Schema$ValueRange };

    const values = (response.data.values ?? []) as ValuesArray;

    const result: Record<string, unknown> = {
      values,
      range: response.data.range ?? range,
    };

    if (response.data.majorDimension) {
      result['majorDimension'] = response.data.majorDimension;
    }

    return this.success('read', result);
  }

  private async handleWrite(input: any): Promise<DataResponse> {
    const range = await this.resolveRange(input.spreadsheetId, input.range);
    const cellCount = input.values.reduce((sum: number, row: any[]) => sum + row.length, 0);

    const updatedRows = input.values.length;
    const updatedColumns =
      input.values.length > 0 ? Math.max(...input.values.map((row: any[]) => row.length)) : 0;
    let updateResult: sheets_v4.Schema$UpdateValuesResponse | undefined;

    const execution = await this.context.batchCompiler.executeWithSafety({
      spreadsheetId: input.spreadsheetId,
      safety: input.safety,
      estimatedCells: cellCount,
      range,
      diffOptions: input.diffOptions,
      operation: async () => {
        const response = await this.sheetsApi.spreadsheets.values.update({
          spreadsheetId: input.spreadsheetId,
          range,
          valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
          includeValuesInResponse: input.includeValuesInResponse ?? false,
          requestBody: { values: input.values },
          fields: 'spreadsheetId,updatedCells,updatedRows,updatedColumns,updatedRange',
        });
        updateResult = response.data;
      },
    });

    if (!execution.success) {
      return this.error(
        execution.error ?? {
          code: 'INTERNAL_ERROR',
          message: `Write operation to range ${input.range} failed: Unknown error`,
          details: {
            spreadsheetId: input.spreadsheetId,
            range: input.range,
            valueCount: input.values?.length,
            cellCount: (input.values?.length || 0) * (input.values?.[0]?.length || 0),
          },
          retryable: true,
          retryStrategy: 'exponential_backoff',
          resolution:
            'Retry the operation. If error persists, check spreadsheet permissions and Google API status.',
        }
      );
    }

    const mutation = this.createMutationSummary([execution]);

    if (execution.dryRun) {
      return this.success(
        'write',
        {
          updatedCells: cellCount,
          updatedRows,
          updatedColumns,
          updatedRange: range,
        },
        mutation,
        true
      );
    }

    // Invalidate affected cache entries
    cacheManager.invalidateRange(input.spreadsheetId, range);

    const responseData: Record<string, unknown> = {
      updatedCells: updateResult?.updatedCells ?? 0,
      updatedRows: updateResult?.updatedRows ?? 0,
      updatedColumns: updateResult?.updatedColumns ?? 0,
      updatedRange: updateResult?.updatedRange ?? range,
    };

    if (input.includeValuesInResponse && updateResult?.['updatedData']) {
      responseData['updatedData'] = updateResult['updatedData'];
    }

    return this.success('write', responseData, mutation);
  }

  private async handleAppend(input: any): Promise<DataResponse> {
    const range = await this.resolveRange(input.spreadsheetId, input.range);
    const cellCount = input.values.reduce((sum: number, row: any[]) => sum + row.length, 0);

    const updatedRows = input.values.length;
    const updatedColumns =
      input.values.length > 0 ? Math.max(...input.values.map((row: any[]) => row.length)) : 0;
    let updates: sheets_v4.Schema$UpdateValuesResponse | undefined;

    const execution = await this.context.batchCompiler.executeWithSafety({
      spreadsheetId: input.spreadsheetId,
      safety: input.safety,
      estimatedCells: cellCount,
      range,
      operation: async () => {
        if (
          this.context.batchingSystem &&
          !input.safety?.dryRun &&
          input.insertDataOption !== 'OVERWRITE'
        ) {
          const batchResult = await this.context.batchingSystem.execute<{
            updates?: sheets_v4.Schema$UpdateValuesResponse;
            tableRange?: string;
          }>({
            id: `append-${Date.now()}-${Math.random()}`,
            type: 'values:append',
            spreadsheetId: input.spreadsheetId,
            params: {
              range,
              values: input.values,
              valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
              insertDataOption: input.insertDataOption ?? 'INSERT_ROWS',
            },
          });
          updates = batchResult.updates;
        } else {
          const response = await this.sheetsApi.spreadsheets.values.append({
            spreadsheetId: input.spreadsheetId,
            range,
            valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
            insertDataOption: input.insertDataOption ?? 'INSERT_ROWS',
            requestBody: { values: input.values },
            fields:
              'spreadsheetId,updates(spreadsheetId,updatedCells,updatedRows,updatedColumns,updatedRange)',
          });
          updates = response.data.updates;
        }
      },
    });

    if (!execution.success) {
      return this.error(
        execution.error ?? {
          code: 'INTERNAL_ERROR',
          message: `Append operation to range ${input.range} failed: Unknown error`,
          details: {
            spreadsheetId: input.spreadsheetId,
            range: input.range,
            valueCount: input.values?.length,
            rowsToAppend: input.values?.length,
          },
          retryable: true,
          retryStrategy: 'exponential_backoff',
          resolution:
            'Retry the operation. If error persists, check spreadsheet permissions and ensure the range is valid.',
        }
      );
    }

    const mutation = this.createMutationSummary([execution]);

    if (execution.dryRun) {
      return this.success(
        'append',
        {
          updatedCells: cellCount,
          updatedRows,
          updatedColumns,
          updatedRange: range,
        },
        mutation,
        true
      );
    }

    return this.success(
      'append',
      {
        updatedCells: updates?.updatedCells ?? 0,
        updatedRows: updates?.updatedRows ?? 0,
        updatedColumns: updates?.updatedColumns ?? 0,
        updatedRange: updates?.updatedRange ?? range,
      },
      mutation
    );
  }

  private async handleClear(input: any): Promise<DataResponse> {
    const resolved = await this.context.rangeResolver.resolve(input.spreadsheetId, input.range);
    const range = resolved.a1Notation;
    const estimatedCells = this.estimateCellsFromGridRange(resolved.gridRange);

    // Request confirmation for destructive operation if elicitation is supported
    if (this.context.samplingServer) {
      try {
        const confirmation = await confirmDestructiveAction(
          this.context
            .samplingServer as unknown as import('../mcp/elicitation.js').ElicitationServer,
          'Clear Cell Values',
          `This will permanently clear all values in range ${range} (approximately ${estimatedCells} cells) in spreadsheet ${input.spreadsheetId}.`
        );

        if (!confirmation.confirmed) {
          return this.error({
            code: 'INVALID_REQUEST',
            message: 'Operation cancelled by user',
            retryable: false,
          });
        }
      } catch (error) {
        getRequestLogger().warn('Elicitation failed for clear operation', {
          error,
        });
      }
    }

    let clearedRange: string | undefined;

    const execution = await this.context.batchCompiler.executeWithSafety({
      spreadsheetId: input.spreadsheetId,
      safety: input.safety,
      estimatedCells,
      range,
      highRisk: true,
      operation: async () => {
        const response = await this.sheetsApi.spreadsheets.values.clear({
          spreadsheetId: input.spreadsheetId,
          range,
        });
        clearedRange = response.data.clearedRange ?? range;
      },
    });

    if (!execution.success) {
      return this.error(
        execution.error ?? {
          code: 'INTERNAL_ERROR',
          message: `Clear operation on range ${input.range} failed: Unknown error`,
          details: {
            spreadsheetId: input.spreadsheetId,
            range: input.range,
          },
          retryable: true,
          retryStrategy: 'exponential_backoff',
          resolution:
            'Retry the operation. If error persists, check spreadsheet permissions and ensure the range exists.',
        }
      );
    }

    const mutation = this.createMutationSummary([execution]);

    if (execution.dryRun) {
      return this.success(
        'clear',
        {
          updatedRange: range,
        },
        mutation,
        true
      );
    }

    return this.success(
      'clear',
      {
        updatedRange: clearedRange ?? range,
      },
      mutation
    );
  }

  private async handleBatchRead(input: any): Promise<DataResponse> {
    const ranges = await Promise.all(
      input.ranges.map((r: string) => this.resolveRange(input.spreadsheetId, r))
    );

    const params: sheets_v4.Params$Resource$Spreadsheets$Values$Batchget = {
      spreadsheetId: input.spreadsheetId,
      ranges,
    };
    if (input.valueRenderOption) params.valueRenderOption = input.valueRenderOption;
    if (input.dateTimeRenderOption) params.dateTimeRenderOption = input.dateTimeRenderOption;
    if (input.majorDimension) params.majorDimension = input.majorDimension;

    // For large batch reads (>10 ranges), chunk and report progress
    if (ranges.length > 10) {
      const { sendProgress } = await import('../utils/request-context.js');
      await sendProgress(0, ranges.length, 'Starting batch read...');

      const chunkSize = 10;
      const allValueRanges: sheets_v4.Schema$ValueRange[] = [];

      for (let i = 0; i < ranges.length; i += chunkSize) {
        const chunk = ranges.slice(i, Math.min(i + chunkSize, ranges.length));

        const response = await this.sheetsApi.spreadsheets.values.batchGet({
          ...params,
          ranges: chunk,
        });

        allValueRanges.push(...(response.data.valueRanges ?? []));

        const completed = Math.min(i + chunkSize, ranges.length);
        await sendProgress(completed, ranges.length, `Read ${completed}/${ranges.length} ranges`);
      }

      return this.success('batch_read', {
        valueRanges: allValueRanges.map((vr) => ({
          range: vr.range ?? '',
          values: (vr.values ?? []) as ValuesArray,
        })),
      });
    }

    const requestKey = createRequestKey('values.batchGet', {
      spreadsheetId: input.spreadsheetId,
      ranges,
      valueRenderOption: input.valueRenderOption,
      majorDimension: input.majorDimension,
    });

    const fetchFn = async (): Promise<unknown> =>
      this.sheetsApi.spreadsheets.values.batchGet(params);
    const response = (
      this.context.requestDeduplicator
        ? await this.context.requestDeduplicator.deduplicate(requestKey, fetchFn)
        : await fetchFn()
    ) as { data: { valueRanges?: sheets_v4.Schema$ValueRange[] } };

    return this.success('batch_read', {
      valueRanges: (response.data.valueRanges ?? []).map((vr: sheets_v4.Schema$ValueRange) => ({
        range: vr.range ?? '',
        values: (vr.values ?? []) as ValuesArray,
      })),
    });
  }

  private async handleBatchWrite(input: any): Promise<DataResponse> {
    const { sendProgress } = await import('../utils/request-context.js');

    await sendProgress(0, 3, 'Preparing batch write data...');

    const data = await Promise.all(
      input.data.map(async (d: any) => ({
        range: await this.resolveRange(input.spreadsheetId, d.range),
        values: d.values,
      }))
    );

    const totalCells = data.reduce(
      (sum, d) => sum + d.values.reduce((s: number, row: any[]) => s + row.length, 0),
      0
    );

    await sendProgress(1, 3, `Writing ${totalCells.toLocaleString()} cells...`);

    let batchResult: sheets_v4.Schema$BatchUpdateValuesResponse | undefined;

    const execution = await this.context.batchCompiler.executeWithSafety({
      spreadsheetId: input.spreadsheetId,
      safety: input.safety,
      estimatedCells: totalCells,
      range: data.map((d) => d.range).join(','),
      diffOptions: input.diffOptions,
      operation: async () => {
        const response = await this.sheetsApi.spreadsheets.values.batchUpdate({
          spreadsheetId: input.spreadsheetId,
          requestBody: {
            valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
            includeValuesInResponse: input.includeValuesInResponse ?? false,
            data,
          },
        });
        batchResult = response.data;
      },
    });

    await sendProgress(3, 3, 'Batch write complete');

    if (!execution.success) {
      return this.error(
        execution.error ?? {
          code: 'INTERNAL_ERROR',
          message: `Batch write operation failed: Unknown error`,
          details: {
            spreadsheetId: input.spreadsheetId,
            rangeCount: input.data.length,
            ranges: input.data.map((d: any) => d.range),
            totalCells: input.data.reduce(
              (sum: number, d: any) => sum + (d.values?.length || 0) * (d.values?.[0]?.length || 0),
              0
            ),
          },
          retryable: true,
          retryStrategy: 'exponential_backoff',
          resolution:
            'Retry the operation. If error persists, check spreadsheet permissions and Google API status.',
        }
      );
    }

    const mutation = this.createMutationSummary([execution]);

    if (execution.dryRun) {
      return this.success(
        'batch_write',
        {
          updatedCells: totalCells,
        },
        mutation,
        true
      );
    }

    const responseData: Record<string, unknown> = {
      updatedCells: batchResult?.totalUpdatedCells ?? 0,
      updatedRows: batchResult?.totalUpdatedRows ?? 0,
      updatedColumns: batchResult?.totalUpdatedColumns ?? 0,
    };

    if (input.includeValuesInResponse && batchResult?.['responses']) {
      responseData['responses'] = batchResult['responses'];
    }

    return this.success('batch_write', responseData, mutation);
  }

  private async handleFind(input: any): Promise<DataResponse> {
    const range = input.range
      ? await this.resolveRange(input.spreadsheetId, input.range)
      : undefined;

    const params: sheets_v4.Params$Resource$Spreadsheets$Values$Get = {
      spreadsheetId: input.spreadsheetId,
      range: range ?? 'A:ZZ',
      valueRenderOption: input.includeFormulas ? 'FORMULA' : 'FORMATTED_VALUE',
      fields: 'range,values',
    };

    const response = await this.sheetsApi.spreadsheets.values.get(params);

    const values = response.data.values ?? [];
    const matches: Array<{
      cell: string;
      value: string;
      row: number;
      column: number;
    }> = [];
    const query = input.matchCase ? input.searchValue : input.searchValue.toLowerCase();
    const limit = 100;

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

    return this.success('find', { matches });
  }

  private async handleReplace(input: any): Promise<DataResponse> {
    const resolvedRange = input.range
      ? await this.resolveRange(input.spreadsheetId, input.range)
      : undefined;

    let replacementsCount = 0;
    const execution = await this.context.batchCompiler.executeWithSafety({
      spreadsheetId: input.spreadsheetId,
      safety: input.safety,
      estimatedCells: 0,
      range: resolvedRange,
      operation: async () => {
        const response = await this.sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: input.spreadsheetId,
          requestBody: {
            requests: [
              {
                findReplace: {
                  find: input.find,
                  replacement: input.replacement,
                  matchCase: input.matchCase,
                  matchEntireCell: input.matchEntireCell,
                  allSheets: input.allSheets ?? true,
                },
              },
            ],
          },
        });

        const reply = response.data.replies?.[0]?.findReplace;
        replacementsCount = reply?.occurrencesChanged ?? 0;
      },
    });

    if (!execution.success) {
      return this.error(
        execution.error ?? {
          code: 'INTERNAL_ERROR',
          message: `Replace operation failed: Unknown error`,
          details: {
            spreadsheetId: input.spreadsheetId,
            range: input.range,
            searchTerm: input.find,
            replacement: input.replacement,
          },
          retryable: true,
          retryStrategy: 'exponential_backoff',
          resolution:
            'Retry the operation. If error persists, check spreadsheet permissions and Google API status.',
        }
      );
    }

    const mutation = this.createMutationSummary([execution]);

    if (execution.dryRun) {
      return this.success(
        'replace',
        {
          replacementsCount: 0,
        },
        mutation,
        true
      );
    }

    return this.success(
      'replace',
      {
        replacementsCount,
      },
      mutation
    );
  }

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
}

// =============================================================================
// CELLS OPERATIONS SUB-HANDLER
// =============================================================================

/**
 * Handles all cell-level operations (notes, validation, hyperlinks, merge, cut, copy)
 */
class CellsOperations {
  constructor(private parent: SheetsDataHandler) {}

  // Accessor methods for parent's dependencies
  private get sheetsApi() {
    return this.parent['sheetsApi'];
  }
  private get context() {
    return this.parent['context'];
  }
  private get toolName() {
    return this.parent['toolName'];
  }

  // Delegate to parent methods
  private success = <T extends Record<string, unknown>>(
    action: string,
    data: T,
    mutation?: any,
    dryRun?: boolean
  ) => this.parent['success'](action, data, mutation, dryRun);

  private error = (error: any) => this.parent['error'](error);
  private async resolveRange(spreadsheetId: string, range: string): Promise<string> {
    const resolved = await this.context.rangeResolver.resolve(spreadsheetId, { a1: range });
    return resolved.a1Notation;
  }
  private getSheetId = (spreadsheetId: string, sheetName?: string, sheetsApi?: any) =>
    this.parent['getSheetId'](spreadsheetId, sheetName, sheetsApi);

  async handle(input: SheetsDataInput): Promise<DataResponse> {
    switch (input.action) {
      case 'add_note':
        return await this.handleAddNote(input as any);
      case 'get_note':
        return await this.handleGetNote(input as any);
      case 'clear_note':
        return await this.handleClearNote(input as any);
      case 'set_hyperlink':
        return await this.handleSetHyperlink(input as any);
      case 'clear_hyperlink':
        return await this.handleClearHyperlink(input as any);
      case 'merge':
        return await this.handleMerge(input as any);
      case 'unmerge':
        return await this.handleUnmerge(input as any);
      case 'get_merges':
        return await this.handleGetMerges(input as any);
      case 'cut':
        return await this.handleCut(input as any);
      case 'copy':
        return await this.handleCopyCells(input as any);
      default:
        return this.error({
          code: 'INVALID_PARAMS',
          message: `Unknown cells action: ${input.action}`,
          retryable: false,
        });
    }
  }

  // ============================================================
  // Note Actions
  // ============================================================

  private async handleAddNote(input: any): Promise<DataResponse> {
    const gridRange = await this.cellToGridRange(input.spreadsheetId, input.range);

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

  private async handleGetNote(input: any): Promise<DataResponse> {
    const requestKey = createRequestKey('spreadsheets.get', {
      spreadsheetId: input.spreadsheetId,
      ranges: [input.range],
      action: 'get_note',
    });

    const fetchFn = async (): Promise<unknown> =>
      this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        ranges: [input.range],
        includeGridData: true,
        fields: 'sheets.data.rowData.values.note',
      });

    const response = (
      this.context.requestDeduplicator
        ? await this.context.requestDeduplicator.deduplicate(requestKey, fetchFn)
        : await fetchFn()
    ) as {
      data: {
        sheets?: Array<{
          data?: Array<{
            rowData?: Array<{ values?: Array<{ note?: string }> }>;
          }>;
        }>;
      };
    };

    const note = response.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]?.note ?? '';
    return this.success('get_note', { note });
  }

  private async handleClearNote(input: any): Promise<DataResponse> {
    const gridRange = await this.cellToGridRange(input.spreadsheetId, input.range);

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

  // ============================================================
  // Hyperlink Actions
  // ============================================================

  private async handleSetHyperlink(input: any): Promise<DataResponse> {
    const validation = validateHyperlinkUrl(input.url);
    if (!validation.ok) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: `Invalid hyperlink URL: ${validation.reason}`,
        retryable: false,
        suggestedFix: 'Use a valid http or https URL.',
      });
    }

    const gridRange = await this.cellToGridRange(input.spreadsheetId, input.range);
    const safeUrl = this.escapeFormulaString(validation.normalized);
    const safeLabel = input.displayText ? this.escapeFormulaString(input.displayText) : undefined;
    const formula = safeLabel
      ? `=HYPERLINK("${safeUrl}","${safeLabel}")`
      : `=HYPERLINK("${safeUrl}")`;

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

  private escapeFormulaString(value: string): string {
    return value.replace(/"/g, '""');
  }

  private async handleClearHyperlink(input: any): Promise<DataResponse> {
    const gridRange = await this.cellToGridRange(input.spreadsheetId, input.range);

    const response = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId: input.spreadsheetId,
      range: input.range,
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

  // ============================================================
  // Merge Actions
  // ============================================================

  private async handleMerge(input: any): Promise<DataResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);

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

    return this.success('merge', {});
  }

  private async handleUnmerge(input: any): Promise<DataResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range);
    const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);

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

    return this.success('unmerge', {});
  }

  private async handleGetMerges(input: any): Promise<DataResponse> {
    const requestKey = createRequestKey('spreadsheets.get', {
      spreadsheetId: input.spreadsheetId,
      sheetId: input.sheetId,
      action: 'get_merges',
    });

    const fetchFn = async (): Promise<unknown> =>
      this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        fields: 'sheets.merges,sheets.properties.sheetId',
      });

    const response = (
      this.context.requestDeduplicator
        ? await this.context.requestDeduplicator.deduplicate(requestKey, fetchFn)
        : await fetchFn()
    ) as {
      data: {
        sheets?: Array<{
          properties?: { sheetId?: number };
          merges?: Array<{
            startRowIndex?: number;
            endRowIndex?: number;
            startColumnIndex?: number;
            endColumnIndex?: number;
          }>;
        }>;
      };
    };

    const sheet = response.data.sheets?.find(
      (s: { properties?: { sheetId?: number } }) => s.properties?.sheetId === input.sheetId
    );
    const merges = (sheet?.merges ?? []).map(
      (m: {
        startRowIndex?: number;
        endRowIndex?: number;
        startColumnIndex?: number;
        endColumnIndex?: number;
      }) => ({
        startRow: m.startRowIndex ?? 0,
        endRow: m.endRowIndex ?? 0,
        startColumn: m.startColumnIndex ?? 0,
        endColumn: m.endColumnIndex ?? 0,
      })
    );

    return this.success('get_merges', { merges });
  }

  // ============================================================
  // Cut/Copy Actions
  // ============================================================

  private async handleCut(input: any): Promise<DataResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.source);
    const sourceRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const sourceRows = (sourceRange.endRowIndex ?? 0) - (sourceRange.startRowIndex ?? 0);
    const sourceCols = (sourceRange.endColumnIndex ?? 0) - (sourceRange.startColumnIndex ?? 0);
    const estimatedCells = sourceRows * sourceCols;

    if (this.context.elicitationServer && estimatedCells > 100) {
      try {
        const confirmation = await confirmDestructiveAction(
          this.context.elicitationServer,
          'Cut Cells',
          `You are about to cut approximately ${estimatedCells.toLocaleString()} cells from ${rangeA1} to ${input.destination}.\n\nThe source range will be cleared and all content will be moved to the destination.`
        );

        if (!confirmation.confirmed) {
          return this.error({
            code: 'PRECONDITION_FAILED',
            message: 'Cut operation cancelled by user',
            retryable: false,
          });
        }
      } catch (err) {
        this.context.logger?.warn('Elicitation failed for cut, proceeding with operation', {
          error: err,
        });
      }
    }

    if (input.safety?.dryRun) {
      return this.success('cut', {}, undefined, true);
    }

    const destParsed = parseCellReference(input.destination);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            cutPaste: {
              source: toGridRange(sourceRange),
              destination: {
                sheetId: sourceRange.sheetId,
                rowIndex: destParsed.row,
                columnIndex: destParsed.col,
              },
              pasteType: 'PASTE_NORMAL',
            },
          },
        ],
      },
    });

    return this.success('cut', {});
  }

  private async handleCopyCells(input: any): Promise<DataResponse> {
    const rangeA1 = await this.resolveRange(input.spreadsheetId, input.source);
    const sourceRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
    const destParsed = parseCellReference(input.destination);

    const sourceRows = (sourceRange.endRowIndex ?? 0) - (sourceRange.startRowIndex ?? 0);
    const sourceCols = (sourceRange.endColumnIndex ?? 0) - (sourceRange.startColumnIndex ?? 0);

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: input.spreadsheetId,
      requestBody: {
        requests: [
          {
            copyPaste: {
              source: toGridRange(sourceRange),
              destination: toGridRange({
                sheetId: sourceRange.sheetId,
                startRowIndex: destParsed.row,
                startColumnIndex: destParsed.col,
                endRowIndex: destParsed.row + sourceRows,
                endColumnIndex: destParsed.col + sourceCols,
              }),
              pasteType: input.pasteType ?? 'PASTE_NORMAL',
            },
          },
        ],
      },
    });

    return this.success('copy_cells', {});
  }

  private async handleGetProperties(input: any): Promise<DataResponse> {
    const requestKey = createRequestKey('spreadsheets.get', {
      spreadsheetId: input.spreadsheetId,
      ranges: [input.range],
      action: 'get_properties',
    });

    const fields =
      input.fields?.join(',') ??
      'userEnteredValue,effectiveValue,formattedValue,userEnteredFormat,effectiveFormat';

    const fetchFn = async (): Promise<unknown> =>
      this.sheetsApi.spreadsheets.get({
        spreadsheetId: input.spreadsheetId,
        ranges: [input.range],
        includeGridData: true,
        fields: `sheets.data.rowData.values(${fields})`,
      });

    const response = (
      this.context.requestDeduplicator
        ? await this.context.requestDeduplicator.deduplicate(requestKey, fetchFn)
        : await fetchFn()
    ) as {
      data: {
        sheets?: Array<{
          data?: Array<{
            rowData?: Array<{ values?: Array<any> }>;
          }>;
        }>;
      };
    };

    const cellData = response.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0] ?? {};
    return this.success('get_properties', { properties: cellData });
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private async cellToGridRange(spreadsheetId: string, cell: string): Promise<GridRangeInput> {
    const parsed = parseCellReference(cell);
    const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);

    return {
      sheetId,
      startRowIndex: parsed.row,
      endRowIndex: parsed.row + 1,
      startColumnIndex: parsed.col,
      endColumnIndex: parsed.col + 1,
    };
  }

  private async a1ToGridRange(spreadsheetId: string, a1: string): Promise<GridRangeInput> {
    const parsed = parseA1Notation(a1);
    const sheetId = await this.getSheetId(spreadsheetId, parsed.sheetName, this.sheetsApi);

    return {
      sheetId,
      startRowIndex: parsed.startRow,
      endRowIndex: parsed.endRow,
      startColumnIndex: parsed.startCol,
      endColumnIndex: parsed.endCol,
    };
  }
}
