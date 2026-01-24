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
import { BaseHandler, unwrapRequest } from './base.js';
import { ServiceError } from '../core/errors.js';
import { logger } from '../utils/logger.js';
import { cacheManager, createCacheKey } from '../utils/cache-manager.js';
import { createRequestKey } from '../utils/request-deduplication.js';
import { confirmDestructiveAction } from '../mcp/elicitation.js';
import { createSnapshotIfNeeded } from '../utils/safety-helpers.js';
import { CACHE_TTL_VALUES } from '../config/constants.js';
import { FallbackStrategies } from '../utils/circuit-breaker.js';
import { validateHyperlinkUrl } from '../utils/url.js';
import { parseA1Notation, parseCellReference, toGridRange, } from '../utils/google-sheets-helpers.js';
/**
 * Main handler for sheets_data tool
 * Delegates to sub-handlers based on action type
 */
export class SheetsDataHandler extends BaseHandler {
    sheetsApi;
    valuesOps;
    cellsOps;
    valueCacheMap = new Map();
    constructor(context, sheetsApi) {
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
    registerReadFallbacks() {
        if (!this.context.circuitBreaker) {
            return; // Circuit breaker not configured
        }
        // Fallback 1: Return cached data (highest priority)
        this.context.circuitBreaker.registerFallback(FallbackStrategies.cachedData(this.valueCacheMap, 'values-fallback-cache', 100 // Highest priority
        ));
        // Fallback 2: Retry with exponential backoff (high priority)
        this.context.circuitBreaker.registerFallback(FallbackStrategies.retryWithBackoff(async () => {
            throw new ServiceError('Retry operation not set', 'INTERNAL_ERROR', 'CircuitBreaker', false);
        }, 3, // Max 3 retries
        1000, // 1 second base delay
        80 // High priority
        ));
        // Fallback 3: Degraded mode (low priority, last resort)
        this.context.circuitBreaker.registerFallback(FallbackStrategies.degradedMode({
            values: [],
            range: '',
            warning: 'Google Sheets API unavailable. Returning empty data. System is in degraded mode.',
            degraded: true,
        }, 50 // Lower priority
        ));
        logger.info('Registered circuit breaker fallback strategies for data handler', {
            strategies: ['cached-data', 'retry-with-backoff', 'degraded-mode'],
            circuitName: this.context.circuitBreaker.getState(),
        });
    }
    async handle(input) {
        this.requireAuth();
        const inferredRequest = this.inferRequestParameters(unwrapRequest(input));
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
                    sheetId: 'sheetId' in inferredRequest
                        ? typeof inferredRequest.sheetId === 'number'
                            ? inferredRequest.sheetId
                            : undefined
                        : undefined,
                    range: 'range' in inferredRequest
                        ? typeof inferredRequest.range === 'string'
                            ? inferredRequest.range
                            : undefined
                        : undefined,
                });
            }
            // Apply verbosity filtering (LLM optimization) - uses base handler implementation
            const verbosity = inferredRequest.verbosity ?? 'standard';
            const filteredResponse = super.applyVerbosityFilter(response, verbosity);
            return { response: filteredResponse };
        }
        catch (err) {
            return { response: this.mapError(err) };
        }
    }
    createIntents(input) {
        const req = unwrapRequest(input);
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
                        type: 'SET_VALUES',
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
                        type: 'APPEND_VALUES',
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
                        type: 'CLEAR_VALUES',
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
    async executeAction(request) {
        // Values operations
        const valuesActions = [
            'read',
            'write',
            'append',
            'clear',
            'batch_read',
            'batch_write',
            'batch_clear',
            'find_replace',
        ];
        if (valuesActions.includes(request.action)) {
            return this.valuesOps.handle(request);
        }
        // Cells operations
        const cellsActions = [
            'add_note',
            'get_note',
            'clear_note',
            'set_validation',
            'clear_validation',
            'set_hyperlink',
            'clear_hyperlink',
            'merge_cells',
            'unmerge_cells',
            'get_merges',
            'cut_paste',
            'copy_paste',
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
    parent;
    constructor(parent) {
        this.parent = parent;
    }
    // Accessor methods for parent's dependencies
    get sheetsApi() {
        return this.parent['sheetsApi'];
    }
    get context() {
        return this.parent['context'];
    }
    get valueCacheMap() {
        return this.parent['valueCacheMap'];
    }
    get toolName() {
        return this.parent['toolName'];
    }
    // Delegate to parent methods
    success = (action, data, mutation, dryRun) => this.parent['success'](action, data, mutation, dryRun);
    error = (error) => this.parent['error'](error);
    async resolveRange(spreadsheetId, range) {
        const rangeInput = typeof range === 'string' ? { a1: range } : range;
        const resolved = await this.context.rangeResolver.resolve(spreadsheetId, rangeInput);
        return resolved.a1Notation;
    }
    createMutationSummary = (results) => this.parent['createMutationSummary'](results);
    columnToLetter = (index) => this.parent['columnToLetter'](index);
    async handle(input) {
        switch (input.action) {
            case 'read':
                return await this.handleRead(input);
            case 'write':
                return await this.handleWrite(input);
            case 'append':
                return await this.handleAppend(input);
            case 'clear':
                return await this.handleClear(input);
            case 'batch_read':
                return await this.handleBatchRead(input);
            case 'batch_write':
                return await this.handleBatchWrite(input);
            case 'batch_clear':
                return await this.handleBatchClear(input);
            case 'find_replace':
                return await this.handleFindReplace(input);
            default:
                return this.error({
                    code: 'INVALID_PARAMS',
                    message: `Unknown values action: ${input.action}`,
                    retryable: false,
                });
        }
    }
    async handleRead(input) {
        const range = await this.resolveRange(input.spreadsheetId, input.range);
        const params = {
            spreadsheetId: input.spreadsheetId,
            range,
            fields: 'range,majorDimension,values',
        };
        if (input.valueRenderOption)
            params.valueRenderOption = input.valueRenderOption;
        if (input.dateTimeRenderOption)
            params.dateTimeRenderOption = input.dateTimeRenderOption;
        if (input.majorDimension)
            params.majorDimension = input.majorDimension;
        // Try cache first
        const cacheKey = createCacheKey('values:read', params);
        const cached = cacheManager.get(cacheKey, 'values');
        const response = (cached
            ? { data: cached }
            : await (async () => {
                const requestKey = createRequestKey('values.get', {
                    spreadsheetId: input.spreadsheetId,
                    range,
                    valueRenderOption: input.valueRenderOption,
                    majorDimension: input.majorDimension,
                });
                const fetchFn = async () => {
                    const requestMerger = cacheManager.getRequestMerger();
                    let result;
                    if (requestMerger) {
                        result = await requestMerger.mergeRead(this.sheetsApi, input.spreadsheetId, range, {
                            valueRenderOption: input.valueRenderOption,
                            majorDimension: input.majorDimension,
                        });
                    }
                    else {
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
            })());
        const values = (response.data.values ?? []);
        const result = {
            values,
            range: response.data.range ?? range,
        };
        if (response.data.majorDimension) {
            result['majorDimension'] = response.data.majorDimension;
        }
        return this.success('read', result);
    }
    async handleWrite(input) {
        const range = await this.resolveRange(input.spreadsheetId, input.range);
        const cellCount = input.values.reduce((sum, row) => sum + row.length, 0);
        const updatedRows = input.values.length;
        const updatedColumns = input.values.length > 0 ? Math.max(...input.values.map((row) => row.length)) : 0;
        let updateResult;
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
            return this.error(execution.error ?? {
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
        const responseData = {
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
    async handleAppend(input) {
        const range = await this.resolveRange(input.spreadsheetId, input.range);
        const cellCount = input.values.reduce((sum, row) => sum + row.length, 0);
        const updatedRows = input.values.length;
        const updatedColumns = input.values.length > 0 ? Math.max(...input.values.map((row) => row.length)) : 0;
        let updates;
        const execution = await this.context.batchCompiler.executeWithSafety({
            spreadsheetId: input.spreadsheetId,
            safety: input.safety,
            estimatedCells: cellCount,
            range,
            operation: async () => {
                if (this.context.batchingSystem &&
                    !input.safety?.dryRun &&
                    input.insertDataOption !== 'OVERWRITE') {
                    const batchResult = await this.context.batchingSystem.execute({
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
                }
                else {
                    const response = await this.sheetsApi.spreadsheets.values.append({
                        spreadsheetId: input.spreadsheetId,
                        range,
                        valueInputOption: input.valueInputOption ?? 'USER_ENTERED',
                        insertDataOption: input.insertDataOption ?? 'INSERT_ROWS',
                        requestBody: { values: input.values },
                        fields: 'spreadsheetId,updates(spreadsheetId,updatedCells,updatedRows,updatedColumns,updatedRange)',
                    });
                    updates = response.data.updates;
                }
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
    async handleClear(input) {
        const resolved = await this.context.rangeResolver.resolve(input.spreadsheetId, input.range);
        const range = resolved.a1Notation;
        const estimatedCells = this.estimateCellsFromGridRange(resolved.gridRange);
        // Request confirmation for destructive operation if elicitation is supported
        if (this.context.elicitationServer) {
            const confirmation = await confirmDestructiveAction(this.context.elicitationServer, 'clear', `Clear all values in range ${range} (approximately ${estimatedCells} cells) in spreadsheet ${input.spreadsheetId}. This action will permanently remove all cell values.`);
            if (!confirmation.confirmed) {
                return this.error({
                    code: 'PRECONDITION_FAILED',
                    message: confirmation.reason || 'User cancelled the operation',
                    retryable: false,
                });
            }
        }
        // Create snapshot if requested
        const snapshot = await createSnapshotIfNeeded(this.context.snapshotService, {
            operationType: 'clear',
            isDestructive: true,
            spreadsheetId: input.spreadsheetId,
            affectedCells: estimatedCells,
        }, input.safety);
        let clearedRange;
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
            snapshotId: snapshot?.snapshotId,
        }, mutation);
    }
    async handleBatchRead(input) {
        const ranges = await Promise.all(input.ranges.map((r) => this.resolveRange(input.spreadsheetId, r)));
        const params = {
            spreadsheetId: input.spreadsheetId,
            ranges,
        };
        if (input.valueRenderOption)
            params.valueRenderOption = input.valueRenderOption;
        if (input.dateTimeRenderOption)
            params.dateTimeRenderOption = input.dateTimeRenderOption;
        if (input.majorDimension)
            params.majorDimension = input.majorDimension;
        // For large batch reads (>10 ranges), chunk and report progress
        if (ranges.length > 10) {
            const { sendProgress } = await import('../utils/request-context.js');
            await sendProgress(0, ranges.length, 'Starting batch read...');
            const chunkSize = 10;
            const allValueRanges = [];
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
                    values: (vr.values ?? []),
                })),
            });
        }
        const requestKey = createRequestKey('values.batchGet', {
            spreadsheetId: input.spreadsheetId,
            ranges,
            valueRenderOption: input.valueRenderOption,
            majorDimension: input.majorDimension,
        });
        const fetchFn = async () => this.sheetsApi.spreadsheets.values.batchGet(params);
        const response = (this.context.requestDeduplicator
            ? await this.context.requestDeduplicator.deduplicate(requestKey, fetchFn)
            : await fetchFn());
        return this.success('batch_read', {
            valueRanges: (response.data.valueRanges ?? []).map((vr) => ({
                range: vr.range ?? '',
                values: (vr.values ?? []),
            })),
        });
    }
    async handleBatchWrite(input) {
        const { sendProgress } = await import('../utils/request-context.js');
        await sendProgress(0, 3, 'Preparing batch write data...');
        const data = await Promise.all(input.data.map(async (d) => ({
            range: await this.resolveRange(input.spreadsheetId, d.range),
            values: d.values,
        })));
        const totalCells = data.reduce((sum, d) => sum + d.values.reduce((s, row) => s + row.length, 0), 0);
        await sendProgress(1, 3, `Writing ${totalCells.toLocaleString()} cells...`);
        let batchResult;
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
            return this.error(execution.error ?? {
                code: 'INTERNAL_ERROR',
                message: `Batch write operation failed: Unknown error`,
                details: {
                    spreadsheetId: input.spreadsheetId,
                    rangeCount: input.data.length,
                    ranges: input.data.map((d) => d.range),
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
        const responseData = {
            updatedCells: batchResult?.totalUpdatedCells ?? 0,
            updatedRows: batchResult?.totalUpdatedRows ?? 0,
            updatedColumns: batchResult?.totalUpdatedColumns ?? 0,
        };
        if (input.includeValuesInResponse && batchResult?.['responses']) {
            responseData['responses'] = batchResult['responses'];
        }
        return this.success('batch_write', responseData, mutation);
    }
    async handleBatchClear(input) {
        const resolved = await Promise.all(input.ranges.map((range) => this.context.rangeResolver.resolve(input.spreadsheetId, range)));
        const ranges = resolved.map((result) => result.a1Notation);
        const estimatedCells = resolved.reduce((sum, result) => sum + this.estimateCellsFromGridRange(result.gridRange), 0);
        if (this.context.elicitationServer) {
            const confirmation = await confirmDestructiveAction(this.context.elicitationServer, 'batch_clear', `Clear values in ${ranges.length} range(s) (~${estimatedCells} cells) in spreadsheet ${input.spreadsheetId}. This action will permanently remove all cell values.`);
            if (!confirmation.confirmed) {
                return this.error({
                    code: 'PRECONDITION_FAILED',
                    message: confirmation.reason || 'User cancelled the operation',
                    retryable: false,
                });
            }
        }
        const snapshot = await createSnapshotIfNeeded(this.context.snapshotService, {
            operationType: 'batch_clear',
            isDestructive: true,
            spreadsheetId: input.spreadsheetId,
            affectedCells: estimatedCells,
        }, input.safety);
        let clearedRanges;
        const execution = await this.context.batchCompiler.executeWithSafety({
            spreadsheetId: input.spreadsheetId,
            safety: input.safety,
            estimatedCells,
            range: ranges.join(','),
            highRisk: true,
            operation: async () => {
                const response = await this.sheetsApi.spreadsheets.values.batchClear({
                    spreadsheetId: input.spreadsheetId,
                    requestBody: { ranges },
                });
                clearedRanges = response.data.clearedRanges ?? ranges;
            },
        });
        if (!execution.success) {
            return this.error(execution.error ?? {
                code: 'INTERNAL_ERROR',
                message: `Batch clear operation failed: Unknown error`,
                details: {
                    spreadsheetId: input.spreadsheetId,
                    ranges,
                    rangeCount: ranges.length,
                    estimatedCells,
                },
                retryable: true,
                retryStrategy: 'exponential_backoff',
                resolution: 'Retry the operation. If error persists, check spreadsheet permissions and ensure the ranges exist.',
            });
        }
        const mutation = this.createMutationSummary([execution]);
        if (execution.dryRun) {
            return this.success('batch_clear', {
                clearedCells: estimatedCells,
                updatedRange: ranges.join(','),
            }, mutation, true);
        }
        return this.success('batch_clear', {
            clearedCells: estimatedCells,
            clearedRanges: clearedRanges ?? ranges,
            snapshotId: snapshot?.snapshotId,
        }, mutation);
    }
    /**
     * Merged find + replace action (v2.0)
     *
     * If replacement is provided: Uses Google's findReplace API (batch update)
     * If replacement is omitted: Performs find-only search (read values locally)
     */
    async handleFindReplace(input) {
        const resolvedRange = input.range
            ? await this.resolveRange(input.spreadsheetId, input.range)
            : undefined;
        // FIND-ONLY MODE: No replacement provided
        if (input.replacement === undefined || input.replacement === null) {
            const params = {
                spreadsheetId: input.spreadsheetId,
                range: resolvedRange ?? 'A:ZZ',
                valueRenderOption: input.includeFormulas ? 'FORMULA' : 'FORMATTED_VALUE',
                fields: 'range,values',
            };
            const response = await this.sheetsApi.spreadsheets.values.get(params);
            const values = response.data.values ?? [];
            const matches = [];
            const query = input.matchCase ? input.find : input.find.toLowerCase();
            const limit = input.limit ?? 100;
            for (let row = 0; row < values.length && matches.length < limit; row++) {
                const rowData = values[row];
                if (!rowData)
                    continue;
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
                                    searchByRegex: input.searchByRegex,
                                    includeFormulas: input.includeFormulas,
                                    // Note: Google API doesn't support range + allSheets together
                                    // If range is provided, only search that range. Otherwise use allSheets.
                                    allSheets: resolvedRange ? false : (input.allSheets ?? false),
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
            return this.error(execution.error ?? {
                code: 'INTERNAL_ERROR',
                message: `Find/replace operation failed: Unknown error`,
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
            return this.success('find_replace', {
                replacementsCount: 0,
                mode: 'replace',
            }, mutation, true);
        }
        return this.success('find_replace', {
            replacementsCount,
            mode: 'replace',
        }, mutation);
    }
    estimateCellsFromGridRange(range) {
        if (range.startRowIndex === undefined ||
            range.endRowIndex === undefined ||
            range.startColumnIndex === undefined ||
            range.endColumnIndex === undefined) {
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
    parent;
    constructor(parent) {
        this.parent = parent;
    }
    // Accessor methods for parent's dependencies
    get sheetsApi() {
        return this.parent['sheetsApi'];
    }
    get context() {
        return this.parent['context'];
    }
    get toolName() {
        return this.parent['toolName'];
    }
    // Delegate to parent methods
    success = (action, data, mutation, dryRun) => this.parent['success'](action, data, mutation, dryRun);
    error = (error) => this.parent['error'](error);
    async resolveRange(spreadsheetId, range) {
        const rangeInput = typeof range === 'string' ? { a1: range } : range;
        const resolved = await this.context.rangeResolver.resolve(spreadsheetId, rangeInput);
        return resolved.a1Notation;
    }
    getSheetId = (spreadsheetId, sheetName, sheetsApi) => this.parent['getSheetId'](spreadsheetId, sheetName, sheetsApi);
    async handle(input) {
        switch (input.action) {
            case 'add_note':
                return await this.handleAddNote(input);
            case 'get_note':
                return await this.handleGetNote(input);
            case 'clear_note':
                return await this.handleClearNote(input);
            case 'set_validation':
                return await this.handleSetValidation(input);
            case 'clear_validation':
                return await this.handleClearValidation(input);
            case 'set_hyperlink':
                return await this.handleSetHyperlink(input);
            case 'clear_hyperlink':
                return await this.handleClearHyperlink(input);
            case 'merge_cells':
                return await this.handleMergeCells(input);
            case 'unmerge_cells':
                return await this.handleUnmergeCells(input);
            case 'get_merges':
                return await this.handleGetMerges(input);
            case 'cut_paste':
                return await this.handleCutPaste(input);
            case 'copy_paste':
                return await this.handleCopyPaste(input);
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
    async handleAddNote(input) {
        const gridRange = await this.cellToGridRange(input.spreadsheetId, input.cell);
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
    async handleGetNote(input) {
        const requestKey = createRequestKey('spreadsheets.get', {
            spreadsheetId: input.spreadsheetId,
            ranges: [input.cell],
            action: 'get_note',
        });
        const fetchFn = async () => this.sheetsApi.spreadsheets.get({
            spreadsheetId: input.spreadsheetId,
            ranges: [input.cell],
            includeGridData: true,
            fields: 'sheets.data.rowData.values.note',
        });
        const response = (this.context.requestDeduplicator
            ? await this.context.requestDeduplicator.deduplicate(requestKey, fetchFn)
            : await fetchFn());
        const note = response.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]?.note ?? '';
        return this.success('get_note', { note });
    }
    async handleClearNote(input) {
        const gridRange = await this.cellToGridRange(input.spreadsheetId, input.cell);
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
    async handleSetHyperlink(input) {
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
    escapeFormulaString(value) {
        return value.replace(/"/g, '""');
    }
    async handleClearHyperlink(input) {
        const gridRange = await this.cellToGridRange(input.spreadsheetId, input.cell);
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
    // ============================================================
    // Merge Actions
    // ============================================================
    async handleMergeCells(input) {
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
        return this.success('merge_cells', {});
    }
    async handleUnmergeCells(input) {
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
        return this.success('unmerge_cells', {});
    }
    async handleGetMerges(input) {
        const requestKey = createRequestKey('spreadsheets.get', {
            spreadsheetId: input.spreadsheetId,
            sheetId: input.sheetId,
            action: 'get_merges',
        });
        const fetchFn = async () => this.sheetsApi.spreadsheets.get({
            spreadsheetId: input.spreadsheetId,
            fields: 'sheets.merges,sheets.properties.sheetId',
        });
        const response = (this.context.requestDeduplicator
            ? await this.context.requestDeduplicator.deduplicate(requestKey, fetchFn)
            : await fetchFn());
        const sheet = response.data.sheets?.find((s) => s.properties?.sheetId === input.sheetId);
        const merges = (sheet?.merges ?? []).map((m) => ({
            startRow: m.startRowIndex ?? 0,
            endRow: m.endRowIndex ?? 0,
            startColumn: m.startColumnIndex ?? 0,
            endColumn: m.endColumnIndex ?? 0,
        }));
        return this.success('get_merges', { merges });
    }
    // ============================================================
    // Cut/Copy Actions
    // ============================================================
    async handleCutPaste(input) {
        const rangeA1 = await this.resolveRange(input.spreadsheetId, input.source);
        const sourceRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
        const sourceRows = (sourceRange.endRowIndex ?? 0) - (sourceRange.startRowIndex ?? 0);
        const sourceCols = (sourceRange.endColumnIndex ?? 0) - (sourceRange.startColumnIndex ?? 0);
        const estimatedCells = sourceRows * sourceCols;
        if (this.context.elicitationServer && estimatedCells > 100) {
            const confirmation = await confirmDestructiveAction(this.context.elicitationServer, 'cut', `Cut approximately ${estimatedCells.toLocaleString()} cells from ${rangeA1} to ${input.destination}. The source range will be cleared and all content will be moved to the destination.`);
            if (!confirmation.confirmed) {
                return this.error({
                    code: 'PRECONDITION_FAILED',
                    message: confirmation.reason || 'User cancelled the operation',
                    retryable: false,
                });
            }
        }
        if (input.safety?.dryRun) {
            return this.success('cut_paste', {}, undefined, true);
        }
        // Create snapshot if requested
        const snapshot = await createSnapshotIfNeeded(this.context.snapshotService, {
            operationType: 'cut',
            isDestructive: true,
            spreadsheetId: input.spreadsheetId,
            affectedCells: estimatedCells,
        }, input.safety);
        const destParsed = parseCellReference(input.destination);
        const destinationSheetId = destParsed.sheetName
            ? await this.getSheetId(input.spreadsheetId, destParsed.sheetName, this.sheetsApi)
            : sourceRange.sheetId;
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
        return this.success('cut_paste', {
            snapshotId: snapshot?.snapshotId,
        });
    }
    async handleCopyPaste(input) {
        const rangeA1 = await this.resolveRange(input.spreadsheetId, input.source);
        const sourceRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
        const destParsed = parseCellReference(input.destination);
        const destinationSheetId = destParsed.sheetName
            ? await this.getSheetId(input.spreadsheetId, destParsed.sheetName, this.sheetsApi)
            : sourceRange.sheetId;
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
                                sheetId: destinationSheetId,
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
        return this.success('copy_paste', {});
    }
    async handleSetValidation(input) {
        if (input.safety?.dryRun) {
            return this.success('set_validation', {}, undefined, true);
        }
        const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range);
        const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
        const validation = input.validation;
        const condition = {
            type: validation.condition.type,
        };
        if (validation.condition.values && validation.condition.values.length > 0) {
            condition.values = validation.condition.values.map((value) => ({
                userEnteredValue: value,
            }));
        }
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        setDataValidation: {
                            range: toGridRange(gridRange),
                            rule: {
                                condition,
                                inputMessage: validation.inputMessage,
                                strict: validation.strict ?? true,
                                showCustomUi: validation.showDropdown ?? true,
                            },
                        },
                    },
                ],
            },
        });
        return this.success('set_validation', {});
    }
    async handleClearValidation(input) {
        if (input.safety?.dryRun) {
            return this.success('clear_validation', {}, undefined, true);
        }
        const rangeA1 = await this.resolveRange(input.spreadsheetId, input.range);
        const gridRange = await this.a1ToGridRange(input.spreadsheetId, rangeA1);
        const snapshot = await createSnapshotIfNeeded(this.context.snapshotService, {
            operationType: 'clear_validation',
            isDestructive: true,
            spreadsheetId: input.spreadsheetId,
        }, input.safety);
        await this.sheetsApi.spreadsheets.batchUpdate({
            spreadsheetId: input.spreadsheetId,
            requestBody: {
                requests: [
                    {
                        setDataValidation: {
                            range: toGridRange(gridRange),
                        },
                    },
                ],
            },
        });
        return this.success('clear_validation', {
            snapshotId: snapshot?.snapshotId,
        });
    }
    // ============================================================
    // Helper Methods
    // ============================================================
    async cellToGridRange(spreadsheetId, cell) {
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
    async a1ToGridRange(spreadsheetId, a1) {
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
//# sourceMappingURL=data.js.map