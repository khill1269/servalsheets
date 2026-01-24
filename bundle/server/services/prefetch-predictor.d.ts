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
export interface PrefetchPrediction {
    /** Type of operation to prefetch */
    tool: string;
    /** Action to perform */
    action: string;
    /** Parameters for the operation */
    params: Record<string, unknown>;
    /** Confidence score (0-1) */
    confidence: number;
    /** Reason for prediction */
    reason: string;
    /** Priority (higher = more important) */
    priority: number;
}
export interface PrefetchResult {
    /** Prediction that was executed */
    prediction: PrefetchPrediction;
    /** Whether prefetch succeeded */
    success: boolean;
    /** Duration in ms */
    duration: number;
    /** Error if failed */
    error?: Error;
}
export interface PredictorOptions {
    /** Enable verbose logging (default: false) */
    verboseLogging?: boolean;
    /** Minimum confidence threshold (default: 0.5) */
    minConfidence?: number;
    /** Max predictions to generate (default: 5) */
    maxPredictions?: number;
    /** Enable background prefetching (default: true) */
    enablePrefetch?: boolean;
}
/**
 * Predictive Prefetch Service
 *
 * Learns from operation patterns and prefetches likely next operations
 */
export declare class PrefetchPredictor {
    private verboseLogging;
    private minConfidence;
    private maxPredictions;
    private enablePrefetch;
    private sequencePatterns;
    private lastOperations;
    private stats;
    constructor(options?: PredictorOptions);
    /**
     * Analyze recent operations and learn patterns
     */
    learnFromHistory(): void;
    /**
     * Generate predictions for likely next operations
     */
    predict(): PrefetchPrediction[];
    /**
     * Execute predictions in background (prefetch)
     */
    prefetchInBackground(predictions: PrefetchPrediction[], executor: (prediction: PrefetchPrediction) => Promise<void>): Promise<PrefetchResult[]>;
    /**
     * Predict based on learned sequential patterns
     */
    private predictFromSequence;
    /**
     * Predict related data operations (same spreadsheet, next sheet)
     */
    private predictRelatedData;
    /**
     * Predict adjacent range reads
     */
    private predictAdjacentRanges;
    /**
     * Create a key for an operation
     */
    private operationKey;
    /**
     * Infer parameters for predicted operation based on last operation
     */
    private inferParams;
    /**
     * Record prediction accuracy (was prediction correct?)
     */
    recordPredictionAccuracy(wasCorrect: boolean): void;
    /**
     * Get statistics
     */
    getStats(): unknown;
    /**
     * Reset statistics
     */
    resetStats(): void;
}
/**
 * Get or create the prefetch predictor singleton
 */
export declare function getPrefetchPredictor(): PrefetchPredictor;
/**
 * Set the prefetch predictor (for testing or custom configuration)
 */
export declare function setPrefetchPredictor(predictor: PrefetchPredictor): void;
/**
 * Reset the prefetch predictor (for testing only)
 * @internal
 */
export declare function resetPrefetchPredictor(): void;
//# sourceMappingURL=prefetch-predictor.d.ts.map