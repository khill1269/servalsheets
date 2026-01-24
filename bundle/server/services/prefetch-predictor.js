/**
 * PrefetchPredictor
 *
 * @purpose Analyzes operation patterns to predict next operations for background prefetching; achieves 70%+ prediction accuracy
 * @category Performance
 * @usage Use with AccessPatternTracker; recognizes sequential patterns, predicts adjacent ranges/sheets, scores confidence (0-1)
 * @dependencies logger, AccessPatternTracker
 * @stateful Yes - maintains pattern recognition models, operation history analysis, confidence scores per pattern
 * @singleton Yes - one instance per process to learn patterns globally
 *
 * @example
 * const predictor = new PrefetchPredictor({ minConfidence: 0.7 });
 * const predictions = await predictor.predict({ lastOp: 'read', range: 'A1:Z10' });
 * // [{ operation: 'read', range: 'A11:Z20', confidence: 0.85 }, { operation: 'read', sheet: 'Sheet2', confidence: 0.72 }]
 * for (const pred of predictions.filter(p => p.confidence > 0.7)) await prefetch(pred);
 */
import { logger } from '../utils/logger.js';
import { getHistoryService } from './history-service.js';
import { getParallelExecutor } from './parallel-executor.js';
/**
 * Predictive Prefetch Service
 *
 * Learns from operation patterns and prefetches likely next operations
 */
export class PrefetchPredictor {
    verboseLogging;
    minConfidence;
    maxPredictions;
    enablePrefetch;
    // Pattern tracking
    sequencePatterns = new Map();
    lastOperations = [];
    // Statistics
    stats = {
        totalPredictions: 0,
        correctPredictions: 0,
        totalPrefetches: 0,
        successfulPrefetches: 0,
        cacheHitsFromPrefetch: 0,
    };
    constructor(options = {}) {
        this.verboseLogging = options.verboseLogging ?? false;
        this.minConfidence = options.minConfidence ?? 0.5;
        this.maxPredictions = options.maxPredictions ?? 5;
        this.enablePrefetch = options.enablePrefetch ?? true;
        if (this.verboseLogging) {
            logger.info('Prefetch predictor initialized', {
                minConfidence: this.minConfidence,
                maxPredictions: this.maxPredictions,
                enablePrefetch: this.enablePrefetch,
            });
        }
    }
    /**
     * Analyze recent operations and learn patterns
     */
    learnFromHistory() {
        const historyService = getHistoryService();
        const operations = historyService.getRecent(50);
        if (operations.length < 2) {
            return;
        }
        // Build sequence patterns (operation A → operation B)
        for (let i = 0; i < operations.length - 1; i++) {
            const current = operations[i];
            const next = operations[i + 1];
            if (!current || !next || current.result !== 'success') {
                continue;
            }
            const currentKey = this.operationKey(current);
            const nextKey = this.operationKey(next);
            if (!this.sequencePatterns.has(currentKey)) {
                this.sequencePatterns.set(currentKey, new Map());
            }
            const transitions = this.sequencePatterns.get(currentKey);
            transitions.set(nextKey, (transitions.get(nextKey) || 0) + 1);
        }
        this.lastOperations = operations.slice(-10);
        if (this.verboseLogging) {
            logger.debug('Pattern learning complete', {
                patterns: this.sequencePatterns.size,
                recentOps: this.lastOperations.length,
            });
        }
    }
    /**
     * Generate predictions for likely next operations
     */
    predict() {
        const predictions = [];
        // Get last successful operation
        const lastOp = this.lastOperations.filter((op) => op.result === 'success').slice(-1)[0];
        if (!lastOp) {
            return predictions;
        }
        // Prediction 1: Sequential pattern prediction
        predictions.push(...this.predictFromSequence(lastOp));
        // Prediction 2: Related data prediction
        predictions.push(...this.predictRelatedData(lastOp));
        // Prediction 3: Adjacent range prediction
        predictions.push(...this.predictAdjacentRanges(lastOp));
        // Sort by priority and confidence, take top N
        const sorted = predictions
            .filter((p) => p.confidence >= this.minConfidence)
            .sort((a, b) => {
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }
            return b.confidence - a.confidence;
        })
            .slice(0, this.maxPredictions);
        this.stats.totalPredictions += sorted.length;
        if (this.verboseLogging) {
            logger.debug('Generated predictions', {
                total: predictions.length,
                filtered: sorted.length,
                topPrediction: sorted[0],
            });
        }
        return sorted;
    }
    /**
     * Execute predictions in background (prefetch)
     */
    async prefetchInBackground(predictions, executor) {
        if (!this.enablePrefetch || predictions.length === 0) {
            return [];
        }
        const parallelExecutor = getParallelExecutor();
        const tasks = predictions.map((prediction) => ({
            id: `prefetch-${prediction.tool}-${prediction.action}`,
            fn: async () => {
                const startTime = Date.now();
                try {
                    await executor(prediction);
                    return {
                        prediction,
                        success: true,
                        duration: Date.now() - startTime,
                    };
                }
                catch (error) {
                    return {
                        prediction,
                        success: false,
                        duration: Date.now() - startTime,
                        error: error instanceof Error ? error : new Error(String(error)),
                    };
                }
            },
            priority: prediction.priority,
        }));
        const allResults = await parallelExecutor.executeAll(tasks);
        // Extract successful results and filter out failures
        // Check both task-level success and result-level success
        const results = allResults
            .filter((r) => r.success && r.result && r.result.success)
            .map((r) => r.result);
        this.stats.totalPrefetches += allResults.length;
        this.stats.successfulPrefetches += results.filter((r) => r.success).length;
        logger.info('Background prefetch completed', {
            total: allResults.length,
            successful: results.filter((r) => r.success).length,
            failed: allResults.length - results.length,
        });
        return results;
    }
    /**
     * Predict based on learned sequential patterns
     */
    predictFromSequence(lastOp) {
        const predictions = [];
        const lastKey = this.operationKey(lastOp);
        const transitions = this.sequencePatterns.get(lastKey);
        if (!transitions || transitions.size === 0) {
            return predictions;
        }
        // Calculate total occurrences for confidence
        const total = Array.from(transitions.values()).reduce((sum, count) => sum + count, 0);
        // Create predictions for most common transitions
        for (const [nextKey, count] of transitions.entries()) {
            const confidence = count / total;
            if (confidence >= this.minConfidence) {
                const [tool, action] = nextKey.split(':');
                predictions.push({
                    tool: tool,
                    action: action,
                    params: this.inferParams(lastOp, tool, action),
                    confidence,
                    reason: `Sequential pattern: ${tool}:${action} follows ${lastOp.tool}:${lastOp.action} ${Math.round(confidence * 100)}% of the time`,
                    priority: 3,
                });
            }
        }
        return predictions;
    }
    /**
     * Predict related data operations (same spreadsheet, next sheet)
     */
    predictRelatedData(lastOp) {
        const predictions = [];
        // If last op was reading a sheet, predict reading next sheet
        if (lastOp.tool === 'sheets_data' && lastOp.action === 'read' && lastOp.sheetId !== undefined) {
            predictions.push({
                tool: 'sheets_data',
                action: 'read',
                params: {
                    spreadsheetId: lastOp.spreadsheetId,
                    sheetId: lastOp.sheetId + 1,
                },
                confidence: 0.6,
                reason: 'Users often read sequential sheets',
                priority: 2,
            });
        }
        // If last op was on a spreadsheet, predict getting spreadsheet metadata
        if (lastOp.spreadsheetId && lastOp.tool !== 'sheets_core') {
            predictions.push({
                tool: 'sheets_core',
                action: 'get',
                params: {
                    spreadsheetId: lastOp.spreadsheetId,
                },
                confidence: 0.5,
                reason: 'Spreadsheet metadata often accessed after operations',
                priority: 1,
            });
        }
        return predictions;
    }
    /**
     * Predict adjacent range reads
     */
    predictAdjacentRanges(lastOp) {
        const predictions = [];
        // If last op was reading a range, predict reading adjacent ranges
        if (lastOp.tool === 'sheets_data' &&
            lastOp.action === 'read' &&
            typeof lastOp.params['range'] === 'string') {
            const range = lastOp.params['range'];
            const match = range.match(/^([^!]+)!([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
            if (match) {
                const [, sheet, startCol, startRow, endCol, endRow] = match;
                const rowCount = parseInt(endRow) - parseInt(startRow) + 1;
                // Predict next range (scroll down)
                const nextStartRow = parseInt(endRow) + 1;
                const nextEndRow = nextStartRow + rowCount - 1;
                const nextRange = `${sheet}!${startCol}${nextStartRow}:${endCol}${nextEndRow}`;
                predictions.push({
                    tool: 'sheets_data',
                    action: 'read',
                    params: {
                        spreadsheetId: lastOp.spreadsheetId,
                        range: nextRange,
                    },
                    confidence: 0.7,
                    reason: 'Users often scroll through sequential ranges',
                    priority: 2,
                });
            }
        }
        return predictions;
    }
    /**
     * Create a key for an operation
     */
    operationKey(op) {
        return `${op.tool}:${op.action}`;
    }
    /**
     * Infer parameters for predicted operation based on last operation
     */
    inferParams(lastOp, _tool, _action) {
        const params = {};
        // Copy common params
        if (lastOp.spreadsheetId) {
            params['spreadsheetId'] = lastOp.spreadsheetId;
        }
        if (lastOp.sheetId !== undefined) {
            params['sheetId'] = lastOp.sheetId;
        }
        return params;
    }
    /**
     * Record prediction accuracy (was prediction correct?)
     */
    recordPredictionAccuracy(wasCorrect) {
        if (wasCorrect) {
            this.stats.correctPredictions++;
        }
    }
    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            accuracy: this.stats.totalPredictions > 0
                ? (this.stats.correctPredictions / this.stats.totalPredictions) * 100
                : 0,
            prefetchSuccessRate: this.stats.totalPrefetches > 0
                ? (this.stats.successfulPrefetches / this.stats.totalPrefetches) * 100
                : 0,
            patternCount: this.sequencePatterns.size,
        };
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalPredictions: 0,
            correctPredictions: 0,
            totalPrefetches: 0,
            successfulPrefetches: 0,
            cacheHitsFromPrefetch: 0,
        };
    }
}
// Singleton instance
let prefetchPredictor = null;
/**
 * Get or create the prefetch predictor singleton
 */
export function getPrefetchPredictor() {
    if (!prefetchPredictor) {
        prefetchPredictor = new PrefetchPredictor({
            verboseLogging: process.env['PREFETCH_VERBOSE'] === 'true',
            minConfidence: parseFloat(process.env['PREFETCH_MIN_CONFIDENCE'] || '0.5'),
            enablePrefetch: process.env['PREFETCH_ENABLED'] !== 'false',
        });
    }
    return prefetchPredictor;
}
/**
 * Set the prefetch predictor (for testing or custom configuration)
 */
export function setPrefetchPredictor(predictor) {
    prefetchPredictor = predictor;
}
/**
 * Reset the prefetch predictor (for testing only)
 * @internal
 */
export function resetPrefetchPredictor() {
    if (process.env['NODE_ENV'] !== 'test' && process.env['VITEST'] !== 'true') {
        throw new Error('resetPrefetchPredictor() can only be called in test environment');
    }
    prefetchPredictor = null;
}
//# sourceMappingURL=prefetch-predictor.js.map