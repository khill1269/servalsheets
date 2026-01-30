/**
 * ConflictDetector
 *
 * @purpose Detects and resolves multi-user conflicts using version tracking, checksums, and 6 resolution strategies
 * @category Quality
 * @usage Use for collaborative editing to prevent data loss; tracks range versions, detects concurrent modifications, suggests resolutions
 * @dependencies logger, crypto (for checksums), uuid
 * @stateful Yes - maintains version cache (range → version/checksum), active edit sessions, optimistic locks (TTL 5min)
 * @singleton Yes - one instance per process to coordinate conflict detection across all requests
 *
 * @example
 * const detector = new ConflictDetector({ conflictTtl: 300000 });
 * const lock = await detector.acquireLock(spreadsheetId, range, userId);
 * const conflict = await detector.detectConflict(spreadsheetId, range, newValues, lock.version);
 * if (conflict) await detector.resolveConflict(conflict, 'merge');
 */
import { Conflict, RangeVersion, ConflictResolution, ConflictResolutionResult, ConflictDetectorConfig, ConflictDetectorStats } from '../types/conflict.js';
/**
 * Conflict Detector - Detects and resolves multi-user conflicts
 */
export declare class ConflictDetector {
    private config;
    private googleClient?;
    private stats;
    private versionCache;
    private locks;
    private editSessions;
    private activeConflicts;
    constructor(config?: ConflictDetectorConfig);
    /**
     * Track a range version
     */
    trackVersion(spreadsheetId: string, range: string, modifiedBy: string, data?: unknown): Promise<RangeVersion>;
    /**
     * Check for conflicts before write operation
     */
    detectConflict(spreadsheetId: string, range: string, expectedVersion?: RangeVersion): Promise<Conflict | null>;
    /**
     * Resolve a conflict
     */
    resolveConflict(resolution: ConflictResolution): Promise<ConflictResolutionResult>;
    /**
     * Resolve by overwriting with user's version
     *
     * DESIGN NOTE: This method updates version tracking metadata.
     * The actual write operation should be performed by the caller
     * (e.g., values handler) after conflict resolution succeeds.
     * This follows the separation of concerns where conflict-detector
     * handles versioning and conflict state, not data mutations.
     */
    private resolveOverwrite;
    /**
     * Resolve by merging changes
     *
     * DESIGN NOTE: If mergeData is provided, it should contain the
     * already-merged cell values. This method updates version tracking.
     * The caller should write mergeData to the sheet after resolution.
     *
     * For automatic 3-way merge, use external merge utilities before
     * calling this method. Complex merge logic belongs in application
     * layer, not in conflict detection infrastructure.
     */
    private resolveMerge;
    /**
     * Resolve by canceling user's changes
     */
    private resolveCancel;
    /**
     * Resolve with last write wins
     */
    private resolveLastWriteWins;
    /**
     * Resolve with first write wins
     */
    private resolveFirstWriteWins;
    /**
     * Check if there's a conflict between versions
     */
    private hasConflict;
    /**
     * Create conflict object
     */
    private createConflict;
    /**
     * Suggest best resolution strategy
     */
    private suggestResolution;
    /**
     * Fetch current version from spreadsheet
     *
     * PRODUCTION: Fetches actual cell values and metadata from Google Sheets API
     */
    private fetchCurrentVersion;
    /**
     * Calculate checksum for data
     */
    private calculateChecksum;
    /**
     * Get cache key
     */
    private getCacheKey;
    /**
     * Format time since
     */
    private formatTimeSince;
    /**
     * Start background cache cleanup
     */
    private startCacheCleanup;
    /**
     * Start background lock cleanup
     */
    private startLockCleanup;
    /**
     * Delay helper
     */
    private delay;
    /**
     * Log message
     */
    private log;
    /**
     * Get statistics
     */
    getStats(): ConflictDetectorStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Get active conflicts
     */
    getActiveConflicts(): Conflict[];
    /**
     * Clear all caches
     */
    clearCaches(): void;
}
/**
 * Initialize conflict detector (call once during server startup)
 */
export declare function initConflictDetector(googleClient?: ConflictDetectorConfig['googleClient']): ConflictDetector;
/**
 * Get conflict detector instance
 */
export declare function getConflictDetector(): ConflictDetector;
/**
 * Reset conflict detector (for testing only)
 * @internal
 */
export declare function resetConflictDetector(): void;
//# sourceMappingURL=conflict-detector.d.ts.map