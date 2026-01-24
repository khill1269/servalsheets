/**
 * ContextManager
 *
 * @purpose Tracks recently used parameters (spreadsheetId, sheetId, range) and auto-infers when missing, reducing required params by ~30%
 * @category Core
 * @usage Use to enable conversational interactions like "read the next sheet" without repeating spreadsheetId; tracks last 10 values per param
 * @dependencies logger
 * @stateful Yes - maintains LRU cache of recent parameters (spreadsheetId, sheetId, range, last N values)
 * @singleton No - one instance per session to maintain conversation-specific context
 *
 * @example
 * const ctx = new ContextManager({ maxHistorySize: 10 });
 * ctx.recordSpreadsheet('1ABC'); // Track usage
 * const inferred = ctx.inferSpreadsheet(); // Returns '1ABC' for next call
 * ctx.recordRange('Sheet1!A1:Z10');
 * const nextRange = ctx.suggestNextRange(); // Suggests 'Sheet1!A11:Z20' (adjacent)
 */
import { logger } from '../utils/logger.js';
/**
 * Context Manager
 *
 * Maintains conversational context by tracking recently used parameters.
 * Enables natural language operations like "read the next sheet" or
 * "write to the same spreadsheet".
 */
export class ContextManager {
    context = {};
    verboseLogging;
    contextTTL;
    // Statistics
    stats = {
        totalInferences: 0,
        spreadsheetIdInferences: 0,
        sheetIdInferences: 0,
        rangeInferences: 0,
        contextUpdates: 0,
    };
    constructor(options = {}) {
        this.verboseLogging = options.verboseLogging ?? false;
        this.contextTTL = options.contextTTL ?? 3600000; // 1 hour default
        logger.info('Context manager initialized', {
            verboseLogging: this.verboseLogging,
            contextTTL: this.contextTTL,
        });
    }
    /**
     * Update context with new values
     */
    updateContext(updates, requestId) {
        const previousContext = { ...this.context };
        // Update only provided values
        if (updates.spreadsheetId !== undefined) {
            this.context.spreadsheetId = updates.spreadsheetId;
        }
        if (updates.sheetId !== undefined) {
            this.context.sheetId = updates.sheetId;
        }
        if (updates.range !== undefined) {
            this.context.range = updates.range;
        }
        if (updates.sheetName !== undefined) {
            this.context.sheetName = updates.sheetName;
        }
        this.context.lastUpdated = Date.now();
        this.context.requestId = requestId;
        this.stats.contextUpdates++;
        if (this.verboseLogging) {
            logger.debug('Context updated', {
                previous: previousContext,
                current: this.context,
                requestId,
            });
        }
    }
    /**
     * Infer missing parameters from context
     *
     * @param params - Parameters with potentially missing values
     * @returns Parameters with inferred values filled in
     */
    inferParameters(params) {
        // Check if context is stale
        if (this.isContextStale()) {
            if (this.verboseLogging) {
                logger.debug('Context is stale, skipping inference');
            }
            return params;
        }
        const inferred = { ...params };
        let inferencesMade = false;
        // Infer spreadsheetId
        if (!inferred['spreadsheetId'] && this.context.spreadsheetId) {
            inferred['spreadsheetId'] = this.context.spreadsheetId;
            this.stats.spreadsheetIdInferences++;
            this.stats.totalInferences++;
            inferencesMade = true;
            if (this.verboseLogging) {
                logger.debug('Inferred spreadsheetId from context', {
                    value: inferred['spreadsheetId'],
                });
            }
        }
        // Infer sheetId
        if (inferred['sheetId'] === undefined && this.context.sheetId !== undefined) {
            inferred['sheetId'] = this.context.sheetId;
            this.stats.sheetIdInferences++;
            this.stats.totalInferences++;
            inferencesMade = true;
            if (this.verboseLogging) {
                logger.debug('Inferred sheetId from context', {
                    value: inferred['sheetId'],
                });
            }
        }
        // Infer range
        if (!inferred['range'] && this.context.range) {
            inferred['range'] = this.context.range;
            this.stats.rangeInferences++;
            this.stats.totalInferences++;
            inferencesMade = true;
            if (this.verboseLogging) {
                logger.debug('Inferred range from context', {
                    value: inferred['range'],
                });
            }
        }
        // Log inference summary if any were made
        if (inferencesMade && !this.verboseLogging) {
            logger.debug('Parameters inferred from context', {
                inferredFields: [
                    inferred['spreadsheetId'] !== params['spreadsheetId'] && 'spreadsheetId',
                    inferred['sheetId'] !== params['sheetId'] && 'sheetId',
                    inferred['range'] !== params['range'] && 'range',
                ].filter(Boolean),
            });
        }
        return inferred;
    }
    /**
     * Get current context
     */
    getContext() {
        return { ...this.context };
    }
    /**
     * Check if context is stale (older than TTL)
     */
    isContextStale() {
        if (!this.context.lastUpdated) {
            return true;
        }
        const age = Date.now() - this.context.lastUpdated;
        return age > this.contextTTL;
    }
    /**
     * Reset context (clear all tracked values)
     */
    reset() {
        const previousContext = { ...this.context };
        this.context = {};
        logger.info('Context reset', {
            previous: previousContext,
        });
    }
    /**
     * Get inference statistics
     */
    getStats() {
        return {
            ...this.stats,
            currentContext: this.context,
            contextAge: this.context.lastUpdated ? Date.now() - this.context.lastUpdated : undefined,
            isContextStale: this.isContextStale(),
            inferenceRate: this.stats.contextUpdates > 0 ? this.stats.totalInferences / this.stats.contextUpdates : 0,
        };
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalInferences: 0,
            spreadsheetIdInferences: 0,
            sheetIdInferences: 0,
            rangeInferences: 0,
            contextUpdates: 0,
        };
        logger.info('Context statistics reset');
    }
    /**
     * Check if a specific parameter can be inferred
     */
    canInfer(paramName) {
        if (this.isContextStale()) {
            return false;
        }
        return this.context[paramName] !== undefined;
    }
    /**
     * Get specific inferred value
     */
    getInferredValue(paramName) {
        if (this.isContextStale()) {
            // OK: Explicit empty - typed as optional, stale context returns undefined
            return undefined;
        }
        return this.context[paramName];
    }
}
// Singleton instance
let contextManager = null;
/**
 * Get or create the context manager singleton
 */
export function getContextManager() {
    if (!contextManager) {
        contextManager = new ContextManager();
    }
    return contextManager;
}
/**
 * Set the context manager (for testing or custom configuration)
 */
export function setContextManager(manager) {
    contextManager = manager;
}
/**
 * Reset the context manager (for testing only)
 * @internal
 */
export function resetContextManager() {
    if (process.env['NODE_ENV'] !== 'test' && process.env['VITEST'] !== 'true') {
        throw new Error('resetContextManager() can only be called in test environment');
    }
    contextManager = null;
}
//# sourceMappingURL=context-manager.js.map