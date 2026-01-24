/**
 * AccessPatternTracker
 *
 * @purpose Tracks user access patterns (spreadsheet/sheet/range sequences) to enable predictive prefetching with 70%+ accuracy
 * @category Performance
 * @usage Use with PrefetchingSystem; records access sequences, detects patterns, predicts next access with confidence scores
 * @dependencies logger
 * @stateful Yes - maintains access history (configurable window, default 100), pattern frequency map, last access timestamps
 * @singleton Yes - one instance per process to learn patterns across all requests
 *
 * @example
 * const tracker = AccessPatternTracker.getInstance({ historySize: 100 });
 * tracker.recordAccess({ spreadsheetId: '1ABC', sheetName: 'Sheet1', range: 'A1:Z10' });
 * const predictions = tracker.getPredictions(spreadsheetId); // [{ range: 'A1:Z20', confidence: 0.85 }, ...]
 */
export interface AccessRecord {
    timestamp: number;
    spreadsheetId: string;
    sheetId?: number;
    sheetName?: string;
    range?: string;
    action: 'read' | 'write' | 'open';
    userId?: string;
}
export interface AccessPattern {
    /** Pattern identifier */
    id: string;
    /** Sequence of accesses that form this pattern */
    sequence: AccessRecord[];
    /** How many times this pattern has occurred */
    frequency: number;
    /** Last time this pattern was observed */
    lastSeen: number;
    /** Confidence score (0-1) */
    confidence: number;
}
export interface PredictedAccess {
    spreadsheetId: string;
    sheetId?: number;
    range?: string;
    confidence: number;
    reason: string;
}
export interface AccessPatternTrackerOptions {
    /** Maximum number of access records to keep (default: 1000) */
    maxHistory?: number;
    /** Time window for pattern detection in ms (default: 300000 = 5 min) */
    patternWindow?: number;
    /** Minimum pattern frequency to consider (default: 2) */
    minPatternFrequency?: number;
}
/**
 * Tracks access patterns for predictive prefetching
 */
export declare class AccessPatternTracker {
    private history;
    private patterns;
    private maxHistory;
    private patternWindow;
    private minPatternFrequency;
    private stats;
    constructor(options?: AccessPatternTrackerOptions);
    /**
     * Record an access
     */
    recordAccess(access: Omit<AccessRecord, 'timestamp'>): void;
    /**
     * Predict next accesses based on current context
     */
    predictNext(current: {
        spreadsheetId: string;
        sheetId?: number;
        range?: string;
    }): PredictedAccess[];
    /**
     * Predict based on detected patterns
     */
    private predictFromPatterns;
    /**
     * Predict adjacent ranges
     * Examples: A1:B10 → B1:C10 (horizontal), A11:B20 (vertical)
     */
    private predictAdjacentRanges;
    /**
     * Predict common resources (first rows, metadata, etc.)
     */
    private predictCommonResources;
    /**
     * Detect patterns in recent access history
     */
    private detectPatterns;
    /**
     * Generate pattern identifier from sequence
     */
    private generatePatternId;
    /**
     * Parse range into components (simple parser)
     */
    private parseRange;
    /**
     * Shift range horizontally
     */
    private shiftRangeHorizontal;
    /**
     * Shift range vertically
     */
    private shiftRangeVertical;
    /**
     * Convert column letter to number (A=1, Z=26, AA=27)
     */
    private columnLetterToNumber;
    /**
     * Convert column number to letter (1=A, 26=Z, 27=AA)
     */
    private columnNumberToLetter;
    /**
     * Get statistics
     */
    getStats(): unknown;
    /**
     * Clear history and patterns
     */
    clear(): void;
}
/**
 * Get or create the access pattern tracker singleton
 */
export declare function getAccessPatternTracker(): AccessPatternTracker;
/**
 * Reset access pattern tracker (for testing only)
 * @internal
 */
export declare function resetAccessPatternTracker(): void;
//# sourceMappingURL=access-pattern-tracker.d.ts.map