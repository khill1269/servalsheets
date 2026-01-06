/**
 * ServalSheets - Values Handler
 * 
 * Handles sheets_values tool (read, write, append, clear, find, replace)
 * MCP Protocol: 2025-11-25
 */

import type { sheets_v4 } from 'googleapis';
import { BaseHandler, type HandlerContext } from './base.js';
import type { Intent } from '../core/intent.js';
import type {
  SheetsValuesInput,
  SheetsValuesOutput,
  ValuesAction,
  ValuesResponse,
  ValuesArray,
} from '../schemas/index.js';
import { getRequestContext, getRequestLogger } from '../utils/request-context.js';
import { logger } from '../utils/logger.js';
import { cacheManager, createCacheKey } from '../utils/cache-manager.js';
import { createRequestKey } from '../utils/request-deduplication.js';
import { confirmDestructiveAction } from '../mcp/elicitation.js';
import { CACHE_TTL_VALUES } from '../config/constants.js';
import { getParallelExecutor } from '../services/parallel-executor.js';
import { FallbackStrategies } from '../utils/circuit-breaker.js';

export class ValuesHandler extends BaseHandler<SheetsValuesInput, SheetsValuesOutput> {
  private sheetsApi: sheets_v4.Sheets;
  private valueCacheMap = new Map<string, sheets_v4.Schema$ValueRange>();

  constructor(context: HandlerContext, sheetsApi: sheets_v4.Sheets) {
    super('sheets_values', context);
    this.sheetsApi = sheetsApi;

    // Register circuit breaker fallback strategies for read operations
    // This demonstrates production-ready resilience patterns
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
    // Use for read operations that can tolerate slightly stale data
    this.context.circuitBreaker.registerFallback(
      FallbackStrategies.cachedData(
        this.valueCacheMap,
        'values-fallback-cache',
        100 // Highest priority
      )
    );

    // Fallback 2: Retry with exponential backoff (high priority)
    // Use for transient failures (timeouts, rate limits)
    this.context.circuitBreaker.registerFallback(
      FallbackStrategies.retryWithBackoff(
        async () => {
          // This will be set dynamically per request
          throw new Error('Retry operation not set');
        },
        3,    // Max 3 retries
        1000, // 1 second base delay
        80    // High priority
      )
    );

    // Fallback 3: Degraded mode (low priority, last resort)
    // Return empty result with warning instead of complete failure
    this.context.circuitBreaker.registerFallback(
      FallbackStrategies.degradedMode(
        {
          values: [],
          range: '',
          warning: 'Google Sheets API unavailable. Returning empty data. System is in degraded mode.',
          degraded: true,
        },
        50 // Lower priority
      )
    );

    logger.info('Registered circuit breaker fallback strategies for values handler', {
      strategies: ['cached-data', 'retry-with-backoff', 'degraded-mode'],
      circuitName: this.context.circuitBreaker.getState(),
    });
  }

  async handle(input: SheetsValuesInput): Promise<SheetsValuesOutput> {
    const { request } = input;

    // Phase 1, Task 1.4: Infer missing parameters from context
    const inferredRequest = this.inferRequestParameters(request) as ValuesAction;

    try {
      const response = await this.executeAction(inferredRequest);

      // Phase 1, Task 1.4: Track context after successful operation
      if (response.success) {
        this.trackContextFromRequest({
          spreadsheetId: inferredRequest.spreadsheetId,
          sheetId: 'sheetId' in inferredRequest ? (typeof inferredRequest.sheetId === 'number' ? inferredRequest.sheetId : undefined) : undefined,
          range: 'range' in inferredRequest ? (typeof inferredRequest.range === 'string' ? inferredRequest.range : undefined) : undefined,
        });
      }

      return { response };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  protected createIntents(input: SheetsValuesInput): Intent[] {
    const req = input.request;
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
        return [{
          ...baseIntent,
          type: 'SET_VALUES' as const,
          payload: { values: req.values },
          metadata: {
            ...baseIntent.metadata,
            estimatedCells: req.values.reduce((sum, row) => sum + row.length, 0),
          },
        }];
      case 'append':
        return [{
          ...baseIntent,
          type: 'APPEND_VALUES' as const,
          payload: { values: req.values },
          metadata: {
            ...baseIntent.metadata,
            estimatedCells: req.values.reduce((sum, row) => sum + row.length, 0),
          },
        }];
      case 'clear':
        return [{
          ...baseIntent,
          type: 'CLEAR_VALUES' as const,
          payload: {},
          metadata: {
            ...baseIntent.metadata,
            destructive: true,
          },
        }];
      default:
        return [];
    }
  }


  /**
   * Execute action and return response (extracted for task/non-task paths)
   */
  private async executeAction(request: ValuesAction): Promise<ValuesResponse> {
    switch (request.action) {
      case 'read':
        return await this.handleRead(request);
      case 'write':
        return await this.handleWrite(request);
      case 'append':
        return await this.handleAppend(request);
      case 'clear':
        return await this.handleClear(request);
      case 'batch_read':
        return await this.handleBatchRead(request);
      case 'batch_write':
        return await this.handleBatchWrite(request);
      case 'batch_clear':
        return await this.handleBatchClear(request);
      case 'find':
        return await this.handleFind(request);
      case 'replace':
        return await this.handleReplace(request);
      default:
        return this.error({
          code: 'INVALID_PARAMS',
          message: `Unknown action: ${(request as { action: string }).action}`,
          retryable: false,
        });
    }
  }

  /**
   * Handle read operation with circuit breaker protection
   *
   * Production Pattern: Circuit breaker with fallback strategies
   *
   * Example of how to use circuit breaker in handlers:
   * ```typescript
   * const result = await this.context.circuitBreaker?.execute(
   *   async () => {
   *     // Primary operation - Google Sheets API call
   *     return await this.sheetsApi.spreadsheets.values.get(params);
   *   },
   *   async () => {
   *     // Legacy single fallback (backwards compatible)
   *     // Circuit breaker will try registered strategies first
   *     return { data: this.valueCacheMap.get(cacheKey) };
   *   }
   * );
   * ```
   *
   * The circuit breaker will:
   * 1. Execute the primary operation
   * 2. Track failures and open circuit after threshold
   * 3. When circuit opens or operation fails, try fallback strategies in priority order:
   *    - Cached data (priority 100)
   *    - Retry with backoff (priority 80)
   *    - Degraded mode (priority 50)
   * 4. Return result from first successful strategy
   *
   * This ensures graceful degradation and system resilience.
   */
  private async handleRead(
    input: Extract<ValuesAction, { action: 'read' }>
  ): Promise<ValuesResponse> {
    // Use streaming mode for large reads if requested
    if (input.streaming) {
      return this.handleStreamingRead(input);
    }

    const range = await this.resolveRange(input.spreadsheetId, input.range);

    // Build params, only including defined values
    const params: sheets_v4.Params$Resource$Spreadsheets$Values$Get = {
      spreadsheetId: input.spreadsheetId,
      range,
    };
    if (input.valueRenderOption) params.valueRenderOption = input.valueRenderOption;
    if (input.majorDimension) params.majorDimension = input.majorDimension;

    // Try cache first (1min TTL for values data)
    const cacheKey = createCacheKey('values:read', params as unknown as Record<string, unknown>);
    const cached = cacheManager.get<sheets_v4.Schema$ValueRange>(cacheKey, 'values');

    const response = (cached ? { data: cached } : await (async () => {
      // Create deduplication key
      const requestKey = createRequestKey('values.get', {
        spreadsheetId: input.spreadsheetId,
        range,
        valueRenderOption: input.valueRenderOption,
        majorDimension: input.majorDimension,
      });

      // Deduplicate the API call
      const fetchFn = async (): Promise<unknown> => {
        const result = await this.sheetsApi.spreadsheets.values.get(params);
        // Cache the result for standard cache
        cacheManager.set(cacheKey, result.data, { ttl: CACHE_TTL_VALUES, namespace: 'values' });
        // Track range dependency for invalidation
        cacheManager.trackRangeDependency(input.spreadsheetId, range, cacheKey);
        // Also store in fallback cache for circuit breaker resilience
        this.valueCacheMap.set('values-fallback-cache', result.data);
        return result;
      };

      return this.context.requestDeduplicator
        ? await this.context.requestDeduplicator.deduplicate(requestKey, fetchFn)
        : await fetchFn();
    })()) as { data: sheets_v4.Schema$ValueRange };

    const values = (response.data.values ?? []) as ValuesArray;

    // Check for large data - provide summary instead of full dump
    const cellCount = values.reduce((sum, row) => sum + row.length, 0);
    const truncated = cellCount > 10000;

    // Build result object, only including defined values (not null)
    const result: Record<string, unknown> = {
      values: truncated ? values.slice(0, 100) : values,
      range: response.data.range ?? range,
    };

    // Only add optional fields if they have truthy values
    if (response.data.majorDimension) {
      result['majorDimension'] = response.data.majorDimension;
    }
    if (truncated) {
      result['truncated'] = true;
      result['resourceUri'] = `sheets:///${input.spreadsheetId}/${encodeURIComponent(range)}`;
    }

    return this.success('read', result);
  }

  /**
   * Handle streaming read for large datasets
   * Chunks data to respect request deadlines and memory limits
   */
  private async handleStreamingRead(
    input: Extract<ValuesAction, { action: 'read' }>
  ): Promise<ValuesResponse> {
    const chunkSize = input.chunkSize ?? 1000;
    const range = await this.resolveRange(input.spreadsheetId, input.range);

    // Parse range to extract sheet name and bounds
    const rangeMatch = range.match(/^([^!]+)!([A-Z]+)(\d+):([A-Z]+)(\d+)?$/);
    if (!rangeMatch) {
      // If range doesn't match expected pattern, fall back to non-streaming
      logger.warn('Streaming mode requires explicit range format (Sheet!A1:D100)', {
        range,
        spreadsheetId: input.spreadsheetId,
      });
      return this.handleRead({ ...input, streaming: false });
    }

    const [, sheetName, startCol, startRow, endCol, endRow] = rangeMatch;
    const allValues: ValuesArray = [];
    let currentRow = parseInt(startRow!);
    const finalRow = endRow ? parseInt(endRow) : currentRow + 10000; // Default max 10k rows
    let hasMore = true;
    const ctx = getRequestContext();

    while (hasMore && currentRow <= finalRow) {
      // Check deadline
      if (ctx && Date.now() > ctx.deadline) {
        logger.warn('Streaming read interrupted by deadline', {
          rowsRead: allValues.length,
          requestId: ctx.requestId,
          spreadsheetId: input.spreadsheetId,
        });
        break;
      }

      // Build chunk range
      const chunkEndRow = Math.min(currentRow + chunkSize - 1, finalRow);
      const chunkRange = `${sheetName}!${startCol}${currentRow}:${endCol}${chunkEndRow}`;

      const params: sheets_v4.Params$Resource$Spreadsheets$Values$Get = {
        spreadsheetId: input.spreadsheetId,
        range: chunkRange,
      };
      if (input.valueRenderOption) params.valueRenderOption = input.valueRenderOption;
      if (input.majorDimension) params.majorDimension = input.majorDimension;

      const response = await this.sheetsApi.spreadsheets.values.get(params);
      const chunkValues = (response.data.values ?? []) as ValuesArray;

      allValues.push(...chunkValues);

      // Report progress
      if (this.context.batchCompiler['onProgress']) {
        this.context.batchCompiler['onProgress']({
          phase: 'executing',
          current: allValues.length,
          total: finalRow - parseInt(startRow!) + 1,
          message: `Read ${allValues.length} rows`,
          spreadsheetId: input.spreadsheetId,
        });
      }

      // Check if we got fewer rows than requested (end of data)
      hasMore = chunkValues.length === chunkSize;
      currentRow += chunkSize;
    }

    logger.info('Streaming read completed', {
      spreadsheetId: input.spreadsheetId,
      rowsRead: allValues.length,
      chunksRead: Math.ceil(allValues.length / chunkSize),
    });

    return this.success('read', {
      values: allValues,
      range,
      rowCount: allValues.length,
      streaming: true,
      majorDimension: input.majorDimension ?? 'ROWS',
    });
  }

  private async handleWrite(
    input: Extract<ValuesAction, { action: 'write' }>
  ): Promise<ValuesResponse> {
    const range = await this.resolveRange(input.spreadsheetId, input.range);
    const cellCount = input.values.reduce((sum, row) => sum + row.length, 0);

    const updatedRows = input.values.length;
    const updatedColumns = input.values.length > 0
      ? Math.max(...input.values.map(row => row.length))
      : 0;
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
        });
        updateResult = response.data;
      },
    });

    if (!execution.success) {
      return this.error(execution.error ?? {
        code: 'INTERNAL_ERROR',
        message: `Write operation to range ${input.range} failed: Unknown error`,
        details: {
          spreadsheetId: input.spreadsheetId,
          range: input.range,
          valueCount: input.values?.length,
          cellCount: (input.values?.length || 0) * (input.values?.[0]?.length || 0),
        },
        retryable: true,  // Server errors are often transient
        retryStrategy: 'exponential_backoff',
        resolution: 'Retry the operation. If error persists, check spreadsheet permissions and Google API status.',
      });
    }

    const mutation = this.createMutationSummary([execution]);

    if (execution.dryRun) {
      return this.success('write', {
        updatedCells: cellCount,
        updatedRows,
        updatedColumns,
        updatedRange: range,
      }, mutation, true);
    }

    // Invalidate affected cache entries
    cacheManager.invalidateRange(input.spreadsheetId, range);

    // Build response, conditionally including updatedData
    const responseData: Record<string, unknown> = {
      updatedCells: updateResult?.updatedCells ?? 0,
      updatedRows: updateResult?.updatedRows ?? 0,
      updatedColumns: updateResult?.updatedColumns ?? 0,
      updatedRange: updateResult?.updatedRange ?? range,
    };

    // Include updatedData if requested
    if (input.includeValuesInResponse && updateResult?.['updatedData']) {
      responseData['updatedData'] = updateResult['updatedData'];
    }

    return this.success('write', responseData, mutation);
  }

  private async handleAppend(
    input: Extract<ValuesAction, { action: 'append' }>
  ): Promise<ValuesResponse> {
    const range = await this.resolveRange(input.spreadsheetId, input.range);
    const cellCount = input.values.reduce((sum, row) => sum + row.length, 0);

    const updatedRows = input.values.length;
    const updatedColumns = input.values.length > 0
      ? Math.max(...input.values.map(row => row.length))
      : 0;
    let updates: sheets_v4.Schema$UpdateValuesResponse | undefined;

    const execution = await this.context.batchCompiler.executeWithSafety({
      spreadsheetId: input.spreadsheetId,
      safety: input.safety,
      estimatedCells: cellCount,
      range,
      operation: async () => {
        const response = await this.sheetsApi.spreadsheets.values.append({
          spreadsheetId: input.spreadsheetId,
          range,
          valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
          insertDataOption: input.insertDataOption ?? 'INSERT_ROWS',
          requestBody: { values: input.values },
        });
        updates = response.data.updates;
      },
    });

    if (!execution.success) {
      return this.error(execution.error ?? {
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
        resolution: 'Retry the operation. If error persists, check spreadsheet permissions and ensure the range is valid.',
      });
    }

    const mutation = this.createMutationSummary([execution]);

    if (execution.dryRun) {
      return this.success('append', {
        updatedCells: cellCount,
        updatedRows,
        updatedColumns,
        updatedRange: range,
      }, mutation, true);
    }

    return this.success('append', {
      updatedCells: updates?.updatedCells ?? 0,
      updatedRows: updates?.updatedRows ?? 0,
      updatedColumns: updates?.updatedColumns ?? 0,
      updatedRange: updates?.updatedRange ?? range,
    }, mutation);
  }

  private async handleClear(
    input: Extract<ValuesAction, { action: 'clear' }>
  ): Promise<ValuesResponse> {
    const resolved = await this.context.rangeResolver.resolve(input.spreadsheetId, input.range);
    const range = resolved.a1Notation;
    const estimatedCells = this.estimateCellsFromGridRange(resolved.gridRange);

    // Request confirmation for destructive operation if elicitation is supported
    if (this.context.samplingServer) {
      try {
        const confirmation = await confirmDestructiveAction(
          this.context.samplingServer as unknown as import('../mcp/elicitation.js').ElicitationServer,
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
        // If elicitation fails, proceed (backward compatibility)
        getRequestLogger().warn('Elicitation failed for clear operation', { error });
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
      return this.error(execution.error ?? {
        code: 'INTERNAL_ERROR',
        message: `Clear operation on range ${input.range} failed: Unknown error`,
        details: {
          spreadsheetId: input.spreadsheetId,
          range: input.range,
        },
        retryable: true,
        retryStrategy: 'exponential_backoff',
        resolution: 'Retry the operation. If error persists, check spreadsheet permissions and ensure the range exists.',
      });
    }

    const mutation = this.createMutationSummary([execution]);

    if (execution.dryRun) {
      return this.success('clear', {
        updatedRange: range,
      }, mutation, true);
    }

    return this.success('clear', {
      updatedRange: clearedRange ?? range,
    }, mutation);
  }

  private async handleBatchRead(
    input: Extract<ValuesAction, { action: 'batch_read' }>
  ): Promise<ValuesResponse> {
    const ranges = await Promise.all(
      input.ranges.map(r => this.resolveRange(input.spreadsheetId, r))
    );

    const params: sheets_v4.Params$Resource$Spreadsheets$Values$Batchget = {
      spreadsheetId: input.spreadsheetId,
      ranges,
    };
    if (input.valueRenderOption) params.valueRenderOption = input.valueRenderOption;
    if (input.majorDimension) params.majorDimension = input.majorDimension;

    // Create deduplication key for batch read
    const requestKey = createRequestKey('values.batchGet', {
      spreadsheetId: input.spreadsheetId,
      ranges,
      valueRenderOption: input.valueRenderOption,
      majorDimension: input.majorDimension,
    });

    // Deduplicate the API call
    const fetchFn = async (): Promise<unknown> => this.sheetsApi.spreadsheets.values.batchGet(params);
    const response = (this.context.requestDeduplicator
      ? await this.context.requestDeduplicator.deduplicate(requestKey, fetchFn)
      : await fetchFn()) as { data: { valueRanges?: sheets_v4.Schema$ValueRange[] } };

    return this.success('batch_read', {
      valueRanges: (response.data.valueRanges ?? []).map((vr: sheets_v4.Schema$ValueRange) => ({
        range: vr.range ?? '',
        values: (vr.values ?? []) as ValuesArray,
      })),
    });
  }

  private async handleBatchWrite(
    input: Extract<ValuesAction, { action: 'batch_write' }>
  ): Promise<ValuesResponse> {
    const data = await Promise.all(
      input.data.map(async d => ({
        range: await this.resolveRange(input.spreadsheetId, d.range),
        values: d.values,
      }))
    );

    const totalCells = data.reduce(
      (sum, d) => sum + d.values.reduce((s, row) => s + row.length, 0),
      0
    );
    let batchResult: sheets_v4.Schema$BatchUpdateValuesResponse | undefined;

    const execution = await this.context.batchCompiler.executeWithSafety({
      spreadsheetId: input.spreadsheetId,
      safety: input.safety,
      estimatedCells: totalCells,
      range: data.map(d => d.range).join(','),
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

    if (!execution.success) {
      return this.error(execution.error ?? {
        code: 'INTERNAL_ERROR',
        message: `Batch write operation failed: Unknown error`,
        details: {
          spreadsheetId: input.spreadsheetId,
          rangeCount: input.data.length,
          ranges: input.data.map(d => d.range),
          totalCells: input.data.reduce((sum, d) => sum + (d.values?.length || 0) * (d.values?.[0]?.length || 0), 0),
        },
        retryable: true,
        retryStrategy: 'exponential_backoff',
        resolution: 'Retry the operation. If error persists, check spreadsheet permissions and Google API status.',
      });
    }

    const mutation = this.createMutationSummary([execution]);

    if (execution.dryRun) {
      return this.success('batch_write', {
        updatedCells: totalCells,
      }, mutation, true);
    }

    // Build response, conditionally including responses data
    const responseData: Record<string, unknown> = {
      updatedCells: batchResult?.totalUpdatedCells ?? 0,
      updatedRows: batchResult?.totalUpdatedRows ?? 0,
      updatedColumns: batchResult?.totalUpdatedColumns ?? 0,
    };

    // Include responses (each with updatedData) if requested
    if (input.includeValuesInResponse && batchResult?.['responses']) {
      responseData['responses'] = batchResult['responses'];
    }

    return this.success('batch_write', responseData, mutation);
  }

  private async handleBatchClear(
    input: Extract<ValuesAction, { action: 'batch_clear' }>
  ): Promise<ValuesResponse> {
    const resolvedRanges = await Promise.all(
      input.ranges.map(r => this.context.rangeResolver.resolve(input.spreadsheetId, r))
    );
    const ranges = resolvedRanges.map(r => r.a1Notation);
    const estimatedCells = resolvedRanges.reduce(
      (sum, r) => sum + this.estimateCellsFromGridRange(r.gridRange),
      0
    );

    // Request confirmation for destructive batch operation if elicitation is supported
    if (this.context.elicitationServer && (input.ranges.length > 5 || estimatedCells > 1000)) {
      try {
        const confirmation = await confirmDestructiveAction(
          this.context.elicitationServer,
          'Batch Clear Data',
          `You are about to clear ${input.ranges.length} range${input.ranges.length > 1 ? 's' : ''} containing approximately ${estimatedCells.toLocaleString()} cells.\n\nAll data in these ranges will be permanently removed:\n${ranges.slice(0, 5).join(', ')}${ranges.length > 5 ? ` and ${ranges.length - 5} more...` : ''}`
        );

        if (!confirmation.confirmed) {
          return this.error({
            code: 'PRECONDITION_FAILED',
            message: 'Batch clear operation cancelled by user',
            retryable: false,
          });
        }
      } catch (err) {
        // If elicitation fails, proceed (backward compatibility)
        this.context.logger?.warn('Elicitation failed for batch_clear, proceeding with operation', { error: err });
      }
    }

    const execution = await this.context.batchCompiler.executeWithSafety({
      spreadsheetId: input.spreadsheetId,
      safety: input.safety,
      estimatedCells,
      range: ranges.join(','),
      highRisk: true,
      operation: async () => {
        await this.sheetsApi.spreadsheets.values.batchClear({
          spreadsheetId: input.spreadsheetId,
          requestBody: { ranges },
        });
      },
    });

    if (!execution.success) {
      return this.error(execution.error ?? {
        code: 'INTERNAL_ERROR',
        message: `Batch clear operation failed: Unknown error`,
        details: {
          spreadsheetId: input.spreadsheetId,
          rangeCount: input.ranges.length,
          ranges: input.ranges,
        },
        retryable: true,
        retryStrategy: 'exponential_backoff',
        resolution: 'Retry the operation. If error persists, check spreadsheet permissions and ensure all ranges exist.',
      });
    }

    const mutation = this.createMutationSummary([execution]);

    if (execution.dryRun) {
      return this.success('batch_clear', {
        updatedCells: estimatedCells,
      }, mutation, true);
    }

    return this.success('batch_clear', {
      updatedCells: 0,
    }, mutation);
  }

  private async handleFind(
    input: Extract<ValuesAction, { action: 'find' }>
  ): Promise<ValuesResponse> {
    // Get all values in range
    const range = input.range 
      ? await this.resolveRange(input.spreadsheetId, input.range)
      : undefined;

    const params: sheets_v4.Params$Resource$Spreadsheets$Values$Get = {
      spreadsheetId: input.spreadsheetId,
      range: range ?? 'A:ZZ',
      valueRenderOption: input.includeFormulas ? 'FORMULA' : 'FORMATTED_VALUE',
    };
    
    const response = await this.sheetsApi.spreadsheets.values.get(params);

    const values = response.data.values ?? [];
    const matches: Array<{ cell: string; value: string; row: number; column: number }> = [];
    const query = input.matchCase ? input.query : input.query.toLowerCase();
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

    return this.success('find', { matches });
  }

  private async handleReplace(
    input: Extract<ValuesAction, { action: 'replace' }>
  ): Promise<ValuesResponse> {
    const resolvedRange = input.range
      ? await this.resolveRange(input.spreadsheetId, input.range)
      : undefined;
    const needsEstimate = Boolean(input.safety?.dryRun || input.safety?.effectScope);
    let estimatedMatches = 0;

    if (needsEstimate) {
      const maxCells = input.safety?.effectScope?.maxCellsAffected;
      const limit = maxCells ? maxCells + 1 : 10000;
      const findInput = {
        action: 'find' as const,
        spreadsheetId: input.spreadsheetId,
        query: input.find,
        matchCase: input.matchCase ?? false,
        matchEntireCell: input.matchEntireCell ?? false,
        includeFormulas: false,
        limit,
        range: input.range,
      };

      const findResult = await this.handleFind(findInput);
      if (!findResult.success) {
        return findResult;
      }

      estimatedMatches = (findResult as { matches?: unknown[] }).matches?.length ?? 0;
    }

    let replacementsCount = 0;
    const execution = await this.context.batchCompiler.executeWithSafety({
      spreadsheetId: input.spreadsheetId,
      safety: input.safety,
      estimatedCells: estimatedMatches,
      range: resolvedRange,
      operation: async () => {
        const response = await this.sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: input.spreadsheetId,
          requestBody: {
            requests: [{
              findReplace: {
                find: input.find,
                replacement: input.replacement,
                matchCase: input.matchCase,
                matchEntireCell: input.matchEntireCell,
                allSheets: !input.range,
              },
            }],
          },
        });

        const reply = response.data.replies?.[0]?.findReplace;
        replacementsCount = reply?.occurrencesChanged ?? 0;
      },
    });

    if (!execution.success) {
      return this.error(execution.error ?? {
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
        resolution: 'Retry the operation. If error persists, check spreadsheet permissions and Google API status.',
      });
    }

    const mutation = this.createMutationSummary([execution]);

    if (execution.dryRun) {
      return this.success('replace', {
        replacementsCount: estimatedMatches,
      }, mutation, true);
    }

    return this.success('replace', {
      replacementsCount,
    }, mutation);
  }

  /**
   * Read large range in parallel chunks for improved performance
   * Phase 2, Task 2.1
   *
   * Splits the range into smaller chunks and reads them concurrently,
   * significantly improving performance for large datasets.
   */
  private async handleParallelChunkedRead(
    spreadsheetId: string,
    range: string,
    chunkSize: number,
    options?: {
      valueRenderOption?: string;
      majorDimension?: string;
    }
  ): Promise<ValuesArray> {
    const parallelExecutor = getParallelExecutor();

    // Parse range to extract sheet name and bounds
    const rangeMatch = range.match(/^([^!]+)!([A-Z]+)(\d+):([A-Z]+)(\d+)?$/);
    if (!rangeMatch) {
      // Fall back to non-chunked read for non-standard ranges
      const response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: options?.valueRenderOption,
        majorDimension: options?.majorDimension,
      });
      return (response.data.values ?? []) as ValuesArray;
    }

    const [, sheetName, startCol, startRow, endCol, endRow] = rangeMatch;
    const finalRow = endRow ? parseInt(endRow) : parseInt(startRow!) + 10000;
    const startRowNum = parseInt(startRow!);

    // Calculate chunks
    const chunks: Array<{ start: number; end: number; range: string }> = [];
    for (let row = startRowNum; row <= finalRow; row += chunkSize) {
      const chunkEnd = Math.min(row + chunkSize - 1, finalRow);
      const chunkRange = `${sheetName}!${startCol}${row}:${endCol}${chunkEnd}`;
      chunks.push({ start: row, end: chunkEnd, range: chunkRange });
    }

    logger.info('Reading range in parallel chunks', {
      spreadsheetId,
      totalRows: finalRow - startRowNum + 1,
      chunkCount: chunks.length,
      chunkSize,
    });

    // Create parallel tasks
    const tasks = chunks.map((chunk, index) => ({
      id: `chunk-${index}`,
      fn: async () => {
        const response = await this.sheetsApi.spreadsheets.values.get({
          spreadsheetId,
          range: chunk.range,
          valueRenderOption: options?.valueRenderOption,
          majorDimension: options?.majorDimension,
        });
        return response.data.values ?? [];
      },
      priority: index, // Read in order for better cache locality
    }));

    // Execute chunks in parallel
    const chunkResults = await parallelExecutor.executeAllSuccessful(tasks, (progress) => {
      if (this.context.batchCompiler['onProgress']) {
        this.context.batchCompiler['onProgress']({
          phase: 'executing',
          current: progress.completed,
          total: progress.total,
          message: `Reading chunks: ${progress.completed}/${progress.total}`,
          spreadsheetId,
        });
      }
    });

    // Merge chunks into single array
    const allValues: ValuesArray = [];
    for (const chunkData of chunkResults) {
      allValues.push(...chunkData);
    }

    logger.info('Parallel chunked read completed', {
      spreadsheetId,
      chunksRead: chunkResults.length,
      totalRows: allValues.length,
    });

    return allValues;
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
