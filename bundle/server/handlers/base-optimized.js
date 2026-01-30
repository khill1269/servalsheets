/**
 * ServalSheets - Optimized Base Handler
 *
 * Performance-optimized base class for all handlers.
 *
 * Optimizations:
 * 1. Removed unnecessary async/await chains
 * 2. Inlined hot path operations
 * 3. Lazy initialization of heavy objects
 * 4. Pre-computed constants (column letters)
 * 5. Cached method bindings
 * 6. Reduced object allocations
 */
import { parseGoogleApiError, createNotFoundError } from '../utils/error-factory.js';
import { getContextManager } from '../services/context-manager.js';
import { requiresConfirmation, generateSafetyWarnings, createSnapshotIfNeeded, formatSafetyWarnings, shouldReturnPreview, buildSnapshotInfo, } from '../utils/safety-helpers.js';
// ============================================================================
// PRE-COMPUTED CONSTANTS
// ============================================================================
// Pre-computed column letters (A-ZZ) - 702 columns
const COLUMN_LETTERS = [];
for (let i = 0; i < 702; i++) {
    let letter = '';
    let temp = i + 1;
    while (temp > 0) {
        const mod = (temp - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        temp = Math.floor((temp - 1) / 26);
    }
    COLUMN_LETTERS.push(letter);
}
// Pre-computed letter to column map for reverse lookup
const LETTER_TO_COLUMN = new Map();
for (let i = 0; i < COLUMN_LETTERS.length; i++) {
    LETTER_TO_COLUMN.set(COLUMN_LETTERS[i], i);
}
// Export for use in other modules
export { COLUMN_LETTERS, LETTER_TO_COLUMN };
// ============================================================================
// OPTIMIZED BASE HANDLER
// ============================================================================
/**
 * Optimized Base Handler
 *
 * Key optimizations:
 * - Lazy initialization of context manager
 * - Pre-computed column letter lookups
 * - Reduced object allocations in success/error paths
 * - Inline error mapping for common cases
 */
export class OptimizedBaseHandler {
    context;
    toolName;
    currentSpreadsheetId;
    // Lazy-initialized context manager
    _contextManager;
    constructor(toolName, context) {
        this.toolName = toolName;
        this.context = context;
    }
    /**
     * Execute intents through batch compiler
     */
    async executeIntents(intents, safety) {
        const batches = await this.context.batchCompiler.compile(intents);
        return this.context.batchCompiler.executeAll(batches, safety);
    }
    /**
     * Resolve range using range resolver
     */
    async resolveRange(spreadsheetId, range) {
        const resolved = await this.context.rangeResolver.resolve(spreadsheetId, range);
        return resolved.a1Notation;
    }
    /**
     * Optimized success response builder
     * - Single object allocation
     * - Conditional field assignment (avoids undefined properties)
     */
    success(action, data, mutation, dryRun) {
        const result = {
            success: true,
            action,
            ...data,
        };
        // Only add optional fields if they have values
        if (mutation)
            result.mutation = mutation;
        if (dryRun !== undefined)
            result.dryRun = dryRun;
        return result;
    }
    /**
     * Optimized error response
     */
    error(error) {
        return { success: false, error };
    }
    /**
     * Optimized error mapping with fast paths for common cases
     */
    mapError(err) {
        // Fast path: already structured error
        if (err && typeof err === 'object' && 'code' in err) {
            const structured = err;
            return this.error({
                code: structured.code,
                message: structured.message,
                details: structured.details,
                retryable: structured.retryable ?? false,
            });
        }
        // Error instance path
        if (err instanceof Error) {
            return this.error(this.mapGoogleApiError(err));
        }
        // Unknown error fallback
        return this.error({
            code: 'UNKNOWN_ERROR',
            message: String(err),
            retryable: false,
        });
    }
    /**
     * Map Google API error - inlined for performance
     */
    mapGoogleApiError(error) {
        const errorAny = error;
        // Fast path: structured Google API error with numeric code
        if (typeof errorAny['code'] === 'number') {
            const parsed = parseGoogleApiError(errorAny);
            if (this.currentSpreadsheetId && parsed.details?.['resourceId'] === 'unknown') {
                parsed.details['resourceId'] = this.currentSpreadsheetId;
            }
            return parsed;
        }
        // String-based detection (slower path)
        const message = error.message.toLowerCase();
        if (message.includes('429') || message.includes('rate limit')) {
            return {
                code: 'RATE_LIMITED',
                message: 'Rate limited. Retry in 60 seconds.',
                retryable: true,
            };
        }
        if (message.includes('403') || message.includes('permission')) {
            return {
                code: 'PERMISSION_DENIED',
                message: 'Permission denied.',
                retryable: false,
            };
        }
        if (message.includes('404') || message.includes('not found')) {
            return createNotFoundError({
                resourceType: 'spreadsheet',
                resourceId: this.currentSpreadsheetId || 'unknown',
                searchSuggestion: 'Verify the spreadsheet ID is correct and you have access to it',
            });
        }
        if (message.includes('unable to parse range')) {
            return {
                code: 'INVALID_PARAMS',
                message: 'Invalid range format',
                retryable: false,
            };
        }
        return { code: 'INTERNAL_ERROR', message: error.message, retryable: false };
    }
    /**
     * Create mutation summary from execution results
     */
    createMutationSummary(results) {
        const firstResult = results[0];
        // OK: Explicit empty - typed as optional, no execution results
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
     * Column index to letter - O(1) lookup for common columns
     */
    columnToLetter(index) {
        if (index < COLUMN_LETTERS.length) {
            return COLUMN_LETTERS[index];
        }
        // Fallback for very large indices (beyond ZZ)
        let letter = '';
        let temp = index + 1;
        while (temp > 0) {
            const mod = (temp - 1) % 26;
            letter = String.fromCharCode(65 + mod) + letter;
            temp = Math.floor((temp - 1) / 26);
        }
        return letter;
    }
    /**
     * Letter to column index - O(1) lookup for common columns
     */
    letterToColumn(letter) {
        const cached = LETTER_TO_COLUMN.get(letter);
        if (cached !== undefined)
            return cached;
        // Fallback computation
        let index = 0;
        for (let i = 0; i < letter.length; i++) {
            index = index * 26 + (letter.charCodeAt(i) - 64);
        }
        return index - 1;
    }
    /**
     * Track spreadsheet ID for error context
     */
    trackSpreadsheetId(spreadsheetId) {
        this.currentSpreadsheetId = spreadsheetId;
    }
    /**
     * Infer parameters from context - lazy init
     */
    inferRequestParameters(request) {
        if (!this._contextManager) {
            this._contextManager = getContextManager();
        }
        return this._contextManager.inferParameters(request);
    }
    /**
     * Track context from request - lazy init
     */
    trackContextFromRequest(params) {
        if (!this._contextManager) {
            this._contextManager = getContextManager();
        }
        this._contextManager.updateContext(params);
    }
    // Safety helpers - direct delegation (no wrapper overhead)
    shouldRequireConfirmation(context) {
        return requiresConfirmation(context);
    }
    getSafetyWarnings(context, safetyOptions) {
        return generateSafetyWarnings(context, safetyOptions);
    }
    async createSafetySnapshot(context, safetyOptions) {
        return createSnapshotIfNeeded(this.context.snapshotService, context, safetyOptions);
    }
    formatWarnings(warnings) {
        return formatSafetyWarnings(warnings);
    }
    isDryRun(safetyOptions) {
        return shouldReturnPreview(safetyOptions);
    }
    snapshotInfo(snapshot) {
        return buildSnapshotInfo(snapshot);
    }
    /**
     * Fetch comprehensive metadata with caching
     */
    async fetchComprehensiveMetadata(spreadsheetId, sheetsApi) {
        const { cacheManager, createCacheKey } = await import('../utils/cache-manager.js');
        const { CACHE_TTL_SPREADSHEET } = await import('../config/constants.js');
        const cacheKey = createCacheKey('spreadsheet:comprehensive', {
            spreadsheetId,
        });
        const cached = cacheManager.get(cacheKey, 'spreadsheet');
        if (cached)
            return cached;
        const response = await sheetsApi.spreadsheets.get({
            spreadsheetId,
            includeGridData: false,
            fields: 'spreadsheetId,properties,namedRanges,sheets(properties,conditionalFormats,protectedRanges,charts,filterViews,basicFilter,merges)',
        });
        cacheManager.set(cacheKey, response.data, {
            ttl: CACHE_TTL_SPREADSHEET,
            namespace: 'spreadsheet',
        });
        return response.data;
    }
}
// Re-export as BaseHandler for drop-in replacement
export { OptimizedBaseHandler as BaseHandler };
//# sourceMappingURL=base-optimized.js.map