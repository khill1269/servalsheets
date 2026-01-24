/**
 * ServalSheets - Base Handler
 *
 * Abstract base class for tool handlers
 * MCP Protocol: 2025-11-25
 */
import { ServiceError } from '../core/errors.js';
import { getRequestLogger } from '../utils/request-context.js';
import { createPermissionError, createRateLimitError, createNotFoundError, createValidationError, parseGoogleApiError, } from '../utils/error-factory.js';
import { enhanceResponse } from '../utils/response-enhancer.js';
import { getContextManager } from '../services/context-manager.js';
import { requiresConfirmation, generateSafetyWarnings, createSnapshotIfNeeded, formatSafetyWarnings, shouldReturnPreview, buildSnapshotInfo, } from '../utils/safety-helpers.js';
import { createEnhancedError } from '../utils/enhanced-errors.js';
import { memoize } from '../utils/memoization.js';
/**
 * Unwrap legacy direct inputs to the request envelope.
 */
export function unwrapRequest(input) {
    if (input && typeof input === 'object' && 'request' in input) {
        const container = input;
        if (container.request && typeof container.request === 'object') {
            return container.request;
        }
    }
    return input;
}
/**
 * Memoized column conversion functions for performance
 * Shared across all handler instances
 */
const memoizedColumnToLetter = memoize((index) => {
    let letter = '';
    let temp = index + 1;
    while (temp > 0) {
        const mod = (temp - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        temp = Math.floor((temp - 1) / 26);
    }
    return letter;
}, { maxSize: 500, ttl: 300000 }); // Cache 500 entries for 5 minutes
const memoizedLetterToColumn = memoize((letter) => {
    let index = 0;
    for (let i = 0; i < letter.length; i++) {
        index = index * 26 + (letter.charCodeAt(i) - 64);
    }
    return index - 1;
}, { maxSize: 500, ttl: 300000 });
/**
 * Base handler with common utilities
 */
export class BaseHandler {
    context;
    toolName;
    currentSpreadsheetId; // Track current request for better error messages
    constructor(toolName, context) {
        this.toolName = toolName;
        this.context = context;
    }
    /**
     * Require authentication before executing tool
     * Throws clear error with step-by-step instructions if not authenticated
     */
    requireAuth() {
        if (!this.context.googleClient) {
            const error = createEnhancedError('AUTH_REQUIRED', `Authentication required for ${this.toolName}. Call sheets_auth with action "status" to check authentication, or action "login" to authenticate.`, {
                tool: this.toolName,
                hint: 'Authentication is required before using this tool',
                resolution: 'Authenticate using sheets_auth tool',
                steps: [
                    '1. Check auth status: sheets_auth action="status"',
                    '2. If not authenticated: sheets_auth action="login"',
                    '3. Follow the OAuth flow to complete authentication',
                    '4. Retry this operation',
                ],
            });
            throw error;
        }
    }
    /**
     * Execute intents through the batch compiler
     */
    async executeIntents(intents, safety) {
        const batches = await this.context.batchCompiler.compile(intents);
        return this.context.batchCompiler.executeAll(batches, safety);
    }
    /**
     * Resolve a range input to A1 notation
     */
    async resolveRange(spreadsheetId, range) {
        const resolved = await this.context.rangeResolver.resolve(spreadsheetId, range);
        return resolved.a1Notation;
    }
    /**
     * Create a success response - FLAT structure matching outputSchema
     * Data fields are spread directly into the result (not nested under 'data')
     * Automatically generates response metadata if not provided
     */
    success(action, data, mutation, dryRun, meta) {
        const result = {
            success: true,
            action,
            ...data,
        };
        // Only include optional fields if they have values
        if (mutation !== undefined) {
            result.mutation = mutation;
        }
        if (dryRun !== undefined) {
            result.dryRun = dryRun;
        }
        // Auto-generate metadata if not provided
        // Handlers can still override by passing explicit meta
        if (meta !== undefined) {
            result._meta = meta;
        }
        else {
            // Generate metadata with context from the result
            const cellsAffected = this.extractCellsAffected(data);
            result._meta = this.generateMeta(action, data, data, { cellsAffected });
        }
        // DEBUG: Log response structure for sheets_collaborate to diagnose validation issue
        if (this.toolName === 'sheets_collaborate') {
            const logger = getRequestLogger();
            logger.info('[DEBUG] sheets_collaborate response', {
                toolName: this.toolName,
                action,
                successField: result.success,
                successType: typeof result.success,
                successValue: JSON.stringify(result.success),
                keys: Object.keys(result),
                fullResponse: JSON.stringify(result),
            });
        }
        return result;
    }
    /**
     * Extract cells affected count from result data
     */
    extractCellsAffected(data) {
        // Try common field names
        if (typeof data['updatedCells'] === 'number')
            return data['updatedCells'];
        if (typeof data['cellsAffected'] === 'number')
            return data['cellsAffected'];
        if (typeof data['cellsFormatted'] === 'number')
            return data['cellsFormatted'];
        // Try to infer from values array
        const values = data['values'];
        if (Array.isArray(values)) {
            return values.reduce((sum, row) => {
                return sum + (Array.isArray(row) ? row.length : 0);
            }, 0);
        }
        // OK: Explicit empty - typed as optional, cells count cannot be inferred
        return undefined;
    }
    /**
     * Generate response metadata with suggestions and cost estimates
     */
    generateMeta(action, input, result, options) {
        const context = {
            tool: this.toolName,
            action,
            input,
            result,
            cellsAffected: options?.cellsAffected,
            apiCallsMade: options?.apiCallsMade || 1,
            duration: options?.duration,
        };
        return enhanceResponse(context);
    }
    /**
     * Create an error response with enhanced context
     */
    error(error) {
        return {
            success: false,
            error,
        };
    }
    /**
     * Create enhanced error with suggested fixes
     */
    enhancedError(code, message, context) {
        return createEnhancedError(code, message, context);
    }
    /**
     * Helper: Create "not found" error (SHEET_NOT_FOUND, CHART_NOT_FOUND, etc.)
     */
    notFoundError(resourceType, identifier, details) {
        return this.error({
            code: 'SHEET_NOT_FOUND',
            message: `${resourceType} ${identifier} not found`,
            retryable: false,
            details,
        });
    }
    /**
     * Helper: Create "invalid" error (INVALID_RANGE, INVALID_REQUEST, etc.)
     */
    invalidError(what, why, details) {
        return this.error({
            code: 'INVALID_REQUEST',
            message: `Invalid ${what}: ${why}`,
            retryable: false,
            details,
        });
    }
    /**
     * Map any error to a structured HandlerError
     */
    mapError(err) {
        const logger = getRequestLogger();
        if (err instanceof Error) {
            // Check if it's already a structured error (from RangeResolver, PolicyEnforcer, etc.)
            const errAny = err;
            if ('code' in err && typeof errAny['code'] === 'string') {
                const structured = err;
                return this.error({
                    code: structured.code,
                    message: structured.message,
                    details: structured.details,
                    retryable: structured.retryable ?? false,
                });
            }
            // Map Google API errors
            const mapped = this.mapGoogleApiError(err);
            if (mapped.code === 'INTERNAL_ERROR' || mapped.code === 'UNKNOWN_ERROR') {
                logger.error('Handler error', { tool: this.toolName, error: err });
            }
            return this.error(mapped);
        }
        logger.error('Handler error', { tool: this.toolName, error: err });
        return this.error({
            code: 'UNKNOWN_ERROR',
            message: String(err),
            retryable: false,
        });
    }
    /**
     * Map Google API error to ErrorDetail with agent-actionable information
     */
    mapGoogleApiError(error) {
        const message = error.message.toLowerCase();
        // Try to extract structured error info from Google API error
        const errorAny = error;
        if ('code' in errorAny && typeof errorAny['code'] === 'number') {
            // Use error factory for structured Google API errors
            const googleError = errorAny;
            const parsed = parseGoogleApiError(googleError);
            // Fix "unknown" resourceId if we have actual spreadsheet ID
            if (this.currentSpreadsheetId && parsed.details?.['resourceId'] === 'unknown') {
                parsed.details['resourceId'] = this.currentSpreadsheetId;
                // Also fix the message text
                if (parsed.message) {
                    parsed.message = parsed.message.replace('unknown', this.currentSpreadsheetId);
                }
            }
            return parsed;
        }
        // Fallback: Parse from message string
        // Rate limit (429)
        if (message.includes('429') || message.includes('rate limit')) {
            return createRateLimitError({
                quotaType: 'requests',
                retryAfterMs: 60000,
            });
        }
        // Quota exceeded
        if (message.includes('quota exceeded') || message.includes('quota')) {
            return createRateLimitError({
                quotaType: 'requests',
                retryAfterMs: 3600000,
            });
        }
        // Permission denied (403)
        if (message.includes('403') ||
            message.includes('permission') ||
            message.includes('forbidden')) {
            return createPermissionError({
                operation: 'perform this operation',
                resourceType: 'spreadsheet',
                currentPermission: 'view',
                requiredPermission: 'edit',
            });
        }
        // Not found (404)
        if (message.includes('404') ||
            message.includes('not found') ||
            message.includes('requested entity was not found')) {
            return createNotFoundError({
                resourceType: 'spreadsheet',
                resourceId: this.currentSpreadsheetId || 'unknown (check spreadsheet ID)',
                searchSuggestion: 'Verify the spreadsheet URL and your access permissions',
            });
        }
        // Invalid range
        if (message.includes('unable to parse range') || message.includes('invalid range')) {
            return createValidationError({
                field: 'range',
                value: 'invalid',
                expectedFormat: 'A1 notation (e.g., "Sheet1!A1:C10")',
                reason: 'Range specification could not be parsed',
            });
        }
        // Circular reference
        if (message.includes('circular')) {
            return createValidationError({
                field: 'formula',
                value: 'contains circular reference',
                reason: 'Formula creates a circular dependency',
            });
        }
        // Default: internal error
        return {
            code: 'INTERNAL_ERROR',
            message: error.message,
            category: 'server',
            severity: 'high',
            retryable: false,
            retryStrategy: 'none',
            resolution: 'This is an internal error. Check the error message for details or contact support.',
            resolutionSteps: [
                '1. Check the error message for specific details',
                '2. Verify your request parameters are correct',
                '3. If the error persists, report it with the full error message',
            ],
        };
    }
    /**
     * Create mutation summary from execution results
     */
    createMutationSummary(results) {
        // OK: Explicit empty - typed as optional, no results to summarize
        if (results.length === 0)
            return undefined;
        const firstResult = results[0];
        // OK: Explicit empty - typed as optional, invalid result
        if (!firstResult)
            return undefined;
        return {
            cellsAffected: firstResult.diff?.tier === 'METADATA'
                ? firstResult.diff.summary.estimatedCellsChanged
                : firstResult.diff?.tier === 'FULL'
                    ? firstResult.diff.summary.cellsChanged
                    : 0,
            diff: firstResult.diff,
            reversible: !!firstResult.snapshotId,
            revertSnapshotId: firstResult.snapshotId,
        };
    }
    /**
     * Convert column index (0-based) to letter (A, B, ..., Z, AA, AB, ...)
     * Uses memoization for performance on frequently-accessed columns
     */
    columnToLetter(index) {
        return memoizedColumnToLetter(index);
    }
    /**
     * Convert column letter to 0-based index
     * Uses memoization for performance on frequently-accessed columns
     */
    letterToColumn(letter) {
        return memoizedLetterToColumn(letter);
    }
    /**
     * Track spreadsheet ID for better error messages
     *
     * Call this at the start of handle() to enable better error reporting.
     * This allows error messages to show the actual spreadsheet ID instead of "unknown".
     */
    trackSpreadsheetId(spreadsheetId) {
        this.currentSpreadsheetId = spreadsheetId;
    }
    /**
     * Infer missing parameters from conversational context
     *
     * Phase 1, Task 1.4 - Parameter Inference
     *
     * Automatically fills in spreadsheetId, sheetId, and range from recent operations
     * when they're missing from the current request.
     */
    inferRequestParameters(request) {
        const contextManager = getContextManager();
        return contextManager.inferParameters(request);
    }
    /**
     * Update conversational context from successful operation
     *
     * Phase 1, Task 1.4 - Parameter Inference
     *
     * Tracks spreadsheetId, sheetId, and range for future parameter inference.
     * Call this after successful operations to maintain context.
     */
    trackContextFromRequest(params) {
        const contextManager = getContextManager();
        contextManager.updateContext(params);
    }
    /**
     * Check if operation requires confirmation
     */
    shouldRequireConfirmation(context) {
        return requiresConfirmation(context);
    }
    /**
     * Generate safety warnings for operation
     */
    getSafetyWarnings(context, safetyOptions) {
        return generateSafetyWarnings(context, safetyOptions);
    }
    /**
     * Create snapshot if needed for destructive operation
     */
    async createSafetySnapshot(context, safetyOptions) {
        return createSnapshotIfNeeded(this.context.snapshotService, context, safetyOptions);
    }
    /**
     * Format safety warnings for response
     */
    formatWarnings(warnings) {
        return formatSafetyWarnings(warnings);
    }
    /**
     * Check if should return preview (dry-run mode)
     */
    isDryRun(safetyOptions) {
        return shouldReturnPreview(safetyOptions);
    }
    /**
     * Build snapshot info for response
     */
    snapshotInfo(snapshot) {
        return buildSnapshotInfo(snapshot);
    }
    /**
     * Fetch comprehensive metadata for analysis (Phase 2 optimization)
     *
     * This helper provides a single method for all handlers to fetch comprehensive
     * spreadsheet metadata in ONE API call, instead of making multiple separate calls.
     *
     * Returns cached data if available, otherwise fetches comprehensive metadata
     * including:
     * - All sheet properties
     * - All conditional formats
     * - All protected ranges
     * - All charts
     * - All named ranges
     * - All filter views
     * - All merges
     *
     * Usage in analysis handlers:
     * ```typescript
     * const metadata = await this.fetchComprehensiveMetadata(spreadsheetId, sheetsApi);
     * const sheets = metadata.sheets ?? [];
     * const namedRanges = metadata.namedRanges ?? [];
     * ```
     */
    async fetchComprehensiveMetadata(spreadsheetId, sheetsApi) {
        const { cacheManager, createCacheKey } = await import('../utils/cache-manager.js');
        const { CACHE_TTL_SPREADSHEET } = await import('../config/constants.js');
        // Check cache first
        const cacheKey = createCacheKey('spreadsheet:comprehensive', {
            spreadsheetId,
        });
        const cached = cacheManager.get(cacheKey, 'spreadsheet');
        if (cached) {
            return cached;
        }
        // Fetch comprehensive metadata in ONE call
        const fields = [
            'spreadsheetId',
            'properties',
            'namedRanges',
            'sheets(properties,conditionalFormats,protectedRanges,charts,filterViews,basicFilter,merges)',
        ].join(',');
        const response = await sheetsApi.spreadsheets.get({
            spreadsheetId,
            includeGridData: false,
            fields,
        });
        // Cache for 5 minutes
        cacheManager.set(cacheKey, response.data, {
            ttl: CACHE_TTL_SPREADSHEET,
            namespace: 'spreadsheet',
        });
        return response.data;
    }
    /**
     * Apply verbosity filtering to optimize token usage (Phase 1 LLM optimization)
     *
     * Generic implementation that can be overridden by handlers for custom filtering.
     * Handles the most common verbosity filtering patterns:
     * - minimal: Remove _meta, limit arrays to first 5 items, strip technical details
     * - standard: No filtering (return as-is)
     * - detailed: Future enhancement for additional metadata
     *
     * @param response - Response object to filter
     * @param verbosity - Verbosity level
     * @returns Filtered response
     */
    applyVerbosityFilter(response, verbosity = 'standard') {
        // No filtering for errors or standard verbosity
        if (!response.success || verbosity === 'standard') {
            return response;
        }
        if (verbosity === 'minimal') {
            // Minimal: Return only essential fields (60-80% token reduction)
            const filtered = { ...response };
            // Remove technical metadata
            if ('_meta' in filtered) {
                delete filtered._meta;
            }
            // Limit large arrays to first 5 items (can be overridden in specific handlers)
            for (const [key, value] of Object.entries(filtered)) {
                if (Array.isArray(value) && value.length > 5 && key !== 'values') {
                    // Preserve 'values' arrays as they're essential data
                    filtered[key] = value.slice(0, 5);
                }
            }
            return filtered;
        }
        // Detailed: Future enhancement for additional metadata
        return response;
    }
    /**
     * Get sheet ID by name with caching
     *
     * Reduces redundant API calls by caching spreadsheet metadata.
     * Multiple calls within same request will only hit API once.
     */
    async getSheetId(spreadsheetId, sheetName, sheetsApi) {
        const { cacheManager, createCacheKey } = await import('../utils/cache-manager.js');
        const { CACHE_TTL_SPREADSHEET } = await import('../config/constants.js');
        // Check cache first
        const cacheKey = createCacheKey('spreadsheet:metadata', {
            spreadsheetId,
        });
        let metadata = cacheManager.get(cacheKey, 'spreadsheet');
        // Fetch if not cached
        if (!metadata) {
            if (!sheetsApi) {
                throw new ServiceError('sheetsApi required when metadata not cached', 'SERVICE_NOT_INITIALIZED', 'SheetsAPI', false);
            }
            const response = await sheetsApi.spreadsheets.get({
                spreadsheetId,
                fields: 'sheets.properties',
            });
            metadata = response.data;
            // Cache for 5 minutes
            cacheManager.set(cacheKey, metadata, {
                ttl: CACHE_TTL_SPREADSHEET,
                namespace: 'spreadsheet',
            });
        }
        const sheets = metadata.sheets ?? [];
        if (!sheetName) {
            return sheets[0]?.properties?.sheetId ?? 0;
        }
        const match = sheets.find((s) => s.properties?.title === sheetName);
        if (!match) {
            const RangeResolutionError = (await import('../core/range-resolver.js')).RangeResolutionError;
            throw new RangeResolutionError(`Sheet "${sheetName}" not found`, 'SHEET_NOT_FOUND', { sheetName, spreadsheetId }, false);
        }
        return match.properties?.sheetId ?? 0;
    }
}
//# sourceMappingURL=base.js.map