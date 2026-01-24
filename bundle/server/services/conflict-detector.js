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
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
/**
 * Conflict Detector - Detects and resolves multi-user conflicts
 */
export class ConflictDetector {
    config;
    googleClient;
    stats;
    versionCache;
    locks;
    editSessions;
    activeConflicts;
    constructor(config = {}) {
        this.googleClient = config.googleClient;
        this.config = {
            enabled: config.enabled ?? true,
            checkBeforeWrite: config.checkBeforeWrite ?? true,
            autoResolve: config.autoResolve ?? false,
            defaultResolution: config.defaultResolution ?? 'manual',
            versionCacheTtl: config.versionCacheTtl ?? 300000, // 5 minutes
            maxVersionsToCache: config.maxVersionsToCache ?? 1000,
            optimisticLocking: config.optimisticLocking ?? false,
            conflictCheckTimeoutMs: config.conflictCheckTimeoutMs ?? 5000,
            verboseLogging: config.verboseLogging ?? false,
        };
        this.stats = {
            totalChecks: 0,
            conflictsDetected: 0,
            conflictsResolved: 0,
            conflictsAutoResolved: 0,
            conflictsManuallyResolved: 0,
            detectionRate: 0,
            resolutionSuccessRate: 0,
            avgResolutionTime: 0,
            resolutionsByStrategy: {
                overwrite: 0,
                merge: 0,
                cancel: 0,
                manual: 0,
                last_write_wins: 0,
                first_write_wins: 0,
            },
            cacheHitRate: 0,
            versionsTracked: 0,
        };
        this.versionCache = new Map();
        this.locks = new Map();
        this.editSessions = new Map();
        this.activeConflicts = new Map();
        // Start background cleanup
        this.startCacheCleanup();
        this.startLockCleanup();
    }
    /**
     * Track a range version
     */
    async trackVersion(spreadsheetId, range, modifiedBy, data) {
        this.log(`Tracking version for range: ${range}`);
        const checksum = this.calculateChecksum(data);
        const cacheKey = this.getCacheKey(spreadsheetId, range);
        const cachedEntry = this.versionCache.get(cacheKey);
        const version = {
            spreadsheetId,
            range,
            lastModified: Date.now(),
            modifiedBy,
            checksum,
            version: cachedEntry ? cachedEntry.version.version + 1 : 1,
        };
        this.versionCache.set(cacheKey, {
            version,
            cachedAt: Date.now(),
            ttl: this.config.versionCacheTtl,
            accessCount: 0,
        });
        this.stats.versionsTracked++;
        return version;
    }
    /**
     * Check for conflicts before write operation
     */
    async detectConflict(spreadsheetId, range, expectedVersion) {
        if (!this.config.enabled || !this.config.checkBeforeWrite) {
            return null;
        }
        this.stats.totalChecks++;
        this.log(`Checking for conflicts in range: ${range}`);
        const cacheKey = this.getCacheKey(spreadsheetId, range);
        const cachedEntry = this.versionCache.get(cacheKey);
        if (!cachedEntry || !expectedVersion) {
            return null; // No cached version to compare
        }
        // Fetch current state from spreadsheet
        const currentVersion = await this.fetchCurrentVersion(spreadsheetId, range);
        // Compare versions
        if (this.hasConflict(expectedVersion, currentVersion)) {
            const conflict = this.createConflict(expectedVersion, currentVersion);
            this.stats.conflictsDetected++;
            this.stats.detectionRate = this.stats.conflictsDetected / this.stats.totalChecks;
            this.activeConflicts.set(conflict.id, conflict);
            this.log(`Conflict detected: ${conflict.id}`);
            // Auto-resolve if configured
            if (this.config.autoResolve) {
                await this.resolveConflict({
                    conflictId: conflict.id,
                    strategy: this.config.defaultResolution,
                });
            }
            return conflict;
        }
        return null;
    }
    /**
     * Resolve a conflict
     */
    async resolveConflict(resolution) {
        const startTime = Date.now();
        const conflict = this.activeConflicts.get(resolution.conflictId);
        if (!conflict) {
            return {
                conflictId: resolution.conflictId,
                success: false,
                strategyUsed: resolution.strategy,
                duration: Date.now() - startTime,
                error: new Error('Conflict not found'),
            };
        }
        this.log(`Resolving conflict ${resolution.conflictId} with strategy: ${resolution.strategy}`);
        try {
            let result;
            switch (resolution.strategy) {
                case 'overwrite':
                    result = await this.resolveOverwrite(conflict);
                    break;
                case 'merge':
                    result = await this.resolveMerge(conflict, resolution.mergeData);
                    break;
                case 'cancel':
                    result = await this.resolveCancel(conflict);
                    break;
                case 'last_write_wins':
                    result = await this.resolveLastWriteWins(conflict);
                    break;
                case 'first_write_wins':
                    result = await this.resolveFirstWriteWins(conflict);
                    break;
                default:
                    result = {
                        conflictId: conflict.id,
                        success: false,
                        strategyUsed: resolution.strategy,
                        duration: Date.now() - startTime,
                        error: new Error(`Unknown resolution strategy: ${resolution.strategy}`),
                    };
            }
            // Update statistics
            this.stats.conflictsResolved++;
            this.stats.resolutionsByStrategy[resolution.strategy]++;
            if (this.config.autoResolve) {
                this.stats.conflictsAutoResolved++;
            }
            else {
                this.stats.conflictsManuallyResolved++;
            }
            this.stats.resolutionSuccessRate =
                this.stats.conflictsResolved / this.stats.conflictsDetected;
            const duration = Date.now() - startTime;
            this.stats.avgResolutionTime =
                (this.stats.avgResolutionTime * (this.stats.conflictsResolved - 1) + duration) /
                    this.stats.conflictsResolved;
            // Remove from active conflicts
            this.activeConflicts.delete(conflict.id);
            return result;
        }
        catch (error) {
            return {
                conflictId: conflict.id,
                success: false,
                strategyUsed: resolution.strategy,
                duration: Date.now() - startTime,
                error: error instanceof Error ? error : new Error(String(error)),
            };
        }
    }
    /**
     * Resolve by overwriting with user's version
     *
     * DESIGN NOTE: This method updates version tracking metadata.
     * The actual write operation should be performed by the caller
     * (e.g., values handler) after conflict resolution succeeds.
     * This follows the separation of concerns where conflict-detector
     * handles versioning and conflict state, not data mutations.
     */
    async resolveOverwrite(conflict) {
        const startTime = Date.now();
        this.log(`Resolving conflict ${conflict.id} with overwrite strategy`);
        // Create the new version based on user's version
        const finalVersion = {
            ...conflict.yourVersion,
            lastModified: Date.now(),
            version: conflict.currentVersion.version + 1,
        };
        // Update version cache to reflect the resolution
        const cacheKey = this.getCacheKey(conflict.spreadsheetId, conflict.range);
        this.versionCache.set(cacheKey, {
            version: finalVersion,
            cachedAt: Date.now(),
            ttl: this.config.versionCacheTtl,
            accessCount: 1,
        });
        this.log(`Conflict ${conflict.id} resolved: version ${finalVersion.version} will overwrite`);
        return {
            conflictId: conflict.id,
            success: true,
            strategyUsed: 'overwrite',
            finalVersion,
            duration: Date.now() - startTime,
        };
    }
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
    async resolveMerge(conflict, mergeData) {
        const startTime = Date.now();
        this.log(`Resolving conflict ${conflict.id} with merge strategy`);
        // If merge data provided, write to Google Sheets
        if (mergeData && this.googleClient && Array.isArray(mergeData)) {
            try {
                await this.googleClient.sheets.spreadsheets.values.update({
                    spreadsheetId: conflict.spreadsheetId,
                    range: conflict.range,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: mergeData,
                    },
                });
                this.log(`Merged data written to ${conflict.range}`);
            }
            catch (error) {
                this.log(`Failed to write merged data: ${error instanceof Error ? error.message : String(error)}`);
                return {
                    conflictId: conflict.id,
                    success: false,
                    strategyUsed: 'merge',
                    duration: Date.now() - startTime,
                    error: error instanceof Error ? error : new Error(String(error)),
                };
            }
        }
        // Calculate checksum for merged data (or preserve existing if no data)
        const newChecksum = mergeData
            ? this.calculateChecksum(mergeData)
            : conflict.yourVersion.checksum;
        const mergeResult = {
            success: true,
            mergedData: mergeData || {},
            changes: {
                range: conflict.range,
                totalChanges: Array.isArray(mergeData)
                    ? mergeData.reduce((sum, row) => sum + (Array.isArray(row) ? row.length : 0), 0)
                    : 0,
            },
        };
        const finalVersion = {
            ...conflict.yourVersion,
            lastModified: Date.now(),
            version: conflict.currentVersion.version + 1,
            checksum: newChecksum,
        };
        // Update version cache
        const cacheKey = this.getCacheKey(conflict.spreadsheetId, conflict.range);
        this.versionCache.set(cacheKey, {
            version: finalVersion,
            cachedAt: Date.now(),
            ttl: this.config.versionCacheTtl,
            accessCount: 1,
        });
        return {
            conflictId: conflict.id,
            success: true,
            strategyUsed: 'merge',
            finalVersion,
            changesApplied: mergeResult.changes,
            duration: Date.now() - startTime,
        };
    }
    /**
     * Resolve by canceling user's changes
     */
    async resolveCancel(conflict) {
        this.log(`Resolving conflict ${conflict.id} with cancel strategy`);
        // Keep current version, discard user's changes
        return {
            conflictId: conflict.id,
            success: true,
            strategyUsed: 'cancel',
            finalVersion: conflict.currentVersion,
            duration: 0,
        };
    }
    /**
     * Resolve with last write wins
     */
    async resolveLastWriteWins(conflict) {
        this.log(`Resolving conflict ${conflict.id} with last_write_wins strategy`);
        // Most recent modification wins
        const winner = conflict.yourVersion.lastModified > conflict.currentVersion.lastModified
            ? conflict.yourVersion
            : conflict.currentVersion;
        return {
            conflictId: conflict.id,
            success: true,
            strategyUsed: 'last_write_wins',
            finalVersion: winner,
            duration: 0,
        };
    }
    /**
     * Resolve with first write wins
     */
    async resolveFirstWriteWins(conflict) {
        this.log(`Resolving conflict ${conflict.id} with first_write_wins strategy`);
        // First modification wins
        const winner = conflict.yourVersion.lastModified < conflict.currentVersion.lastModified
            ? conflict.yourVersion
            : conflict.currentVersion;
        return {
            conflictId: conflict.id,
            success: true,
            strategyUsed: 'first_write_wins',
            finalVersion: winner,
            duration: 0,
        };
    }
    /**
     * Check if there's a conflict between versions
     */
    hasConflict(expected, current) {
        // Conflict exists if:
        // 1. Timestamps differ
        // 2. Checksums differ
        // 3. Versions differ
        return (current.lastModified > expected.lastModified ||
            current.checksum !== expected.checksum ||
            current.version > expected.version);
    }
    /**
     * Create conflict object
     */
    createConflict(yourVersion, currentVersion) {
        const timeSinceModification = Date.now() - currentVersion.lastModified;
        // Determine severity based on time difference
        let severity;
        if (timeSinceModification < 60000) {
            // < 1 minute
            severity = 'critical';
        }
        else if (timeSinceModification < 300000) {
            // < 5 minutes
            severity = 'error';
        }
        else if (timeSinceModification < 1800000) {
            // < 30 minutes
            severity = 'warning';
        }
        else {
            severity = 'info';
        }
        const conflict = {
            id: uuidv4(),
            type: 'concurrent_modification',
            severity,
            spreadsheetId: yourVersion.spreadsheetId,
            range: yourVersion.range,
            yourVersion,
            currentVersion,
            timeSinceModification,
            modifiedBy: currentVersion.modifiedBy,
            description: `Range "${yourVersion.range}" was modified by "${currentVersion.modifiedBy}" ${this.formatTimeSince(timeSinceModification)} ago`,
            suggestedResolution: this.suggestResolution(yourVersion, currentVersion),
            alternativeResolutions: ['overwrite', 'merge', 'cancel', 'last_write_wins'],
            timestamp: Date.now(),
            autoResolvable: severity === 'info' || severity === 'warning',
        };
        return conflict;
    }
    /**
     * Suggest best resolution strategy
     */
    suggestResolution(yourVersion, currentVersion) {
        const timeDiff = Date.now() - currentVersion.lastModified;
        // If modification was very recent, suggest manual review
        if (timeDiff < 60000) {
            return 'manual';
        }
        // If modification was a while ago, suggest overwrite
        if (timeDiff > 1800000) {
            // 30 minutes
            return 'overwrite';
        }
        // Default: suggest merge
        return 'merge';
    }
    /**
     * Fetch current version from spreadsheet
     *
     * PRODUCTION: Fetches actual cell values and metadata from Google Sheets API
     */
    async fetchCurrentVersion(spreadsheetId, range) {
        this.log(`Fetching current version for range: ${range}`);
        const cacheKey = this.getCacheKey(spreadsheetId, range);
        const cached = this.versionCache.get(cacheKey);
        // Return cached version if still valid
        if (cached && Date.now() - cached.cachedAt < this.config.versionCacheTtl) {
            this.log(`Using cached version for ${range}`);
            return cached.version;
        }
        if (!this.googleClient) {
            throw new Error('Conflict detector requires Google API client for version checking. ' +
                'Simulated version checking has been removed for production safety.');
        }
        try {
            // Fetch current cell values for checksum calculation
            const response = await this.googleClient.sheets.spreadsheets.values.get({
                spreadsheetId,
                range,
                valueRenderOption: 'FORMATTED_VALUE',
                dateTimeRenderOption: 'FORMATTED_STRING',
            });
            const values = response.data.values || [];
            const checksum = this.calculateChecksum(values);
            // Increment version if checksum changed
            const version = cached && cached.version.checksum !== checksum
                ? cached.version.version + 1
                : (cached?.version.version ?? 1);
            const rangeVersion = {
                spreadsheetId,
                range,
                lastModified: Date.now(),
                modifiedBy: 'api', // Google Sheets API doesn't provide user info in values response
                checksum,
                version,
            };
            // Update cache
            this.versionCache.set(cacheKey, {
                version: rangeVersion,
                cachedAt: Date.now(),
                ttl: this.config.versionCacheTtl,
                accessCount: (cached?.accessCount ?? 0) + 1,
            });
            this.log(`Fetched version ${version} for ${range} (checksum: ${checksum.substring(0, 8)}...)`);
            return rangeVersion;
        }
        catch (error) {
            this.log(`Failed to fetch current version: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Calculate checksum for data
     */
    calculateChecksum(data) {
        const hash = crypto.createHash('sha256');
        hash.update(JSON.stringify(data || {}));
        return hash.digest('hex');
    }
    /**
     * Get cache key
     */
    getCacheKey(spreadsheetId, range) {
        return `${spreadsheetId}:${range}`;
    }
    /**
     * Format time since
     */
    formatTimeSince(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0)
            return `${days} day${days > 1 ? 's' : ''}`;
        if (hours > 0)
            return `${hours} hour${hours > 1 ? 's' : ''}`;
        if (minutes > 0)
            return `${minutes} minute${minutes > 1 ? 's' : ''}`;
        return `${seconds} second${seconds > 1 ? 's' : ''}`;
    }
    /**
     * Start background cache cleanup
     */
    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            const expired = [];
            for (const [key, entry] of this.versionCache.entries()) {
                if (now - entry.cachedAt > entry.ttl) {
                    expired.push(key);
                }
            }
            for (const key of expired) {
                this.versionCache.delete(key);
                this.log(`Cleaned up expired version cache: ${key}`);
            }
            // Enforce max cache size
            if (this.versionCache.size > this.config.maxVersionsToCache) {
                // Remove oldest entries
                const entries = Array.from(this.versionCache.entries()).sort((a, b) => a[1].cachedAt - b[1].cachedAt);
                const toRemove = entries.slice(0, this.versionCache.size - this.config.maxVersionsToCache);
                for (const [key] of toRemove) {
                    this.versionCache.delete(key);
                }
            }
        }, 60000); // Every minute
    }
    /**
     * Start background lock cleanup
     */
    startLockCleanup() {
        setInterval(() => {
            const now = Date.now();
            const expired = [];
            for (const [key, lock] of this.locks.entries()) {
                if (now > lock.expiresAt) {
                    expired.push(key);
                }
            }
            for (const key of expired) {
                this.locks.delete(key);
                this.log(`Cleaned up expired lock: ${key}`);
            }
        }, 30000); // Every 30 seconds
    }
    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Log message
     */
    log(message) {
        if (this.config.verboseLogging) {
            logger.debug('[ConflictDetector] ' + message);
        }
    }
    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalChecks: 0,
            conflictsDetected: 0,
            conflictsResolved: 0,
            conflictsAutoResolved: 0,
            conflictsManuallyResolved: 0,
            detectionRate: 0,
            resolutionSuccessRate: 0,
            avgResolutionTime: 0,
            resolutionsByStrategy: {
                overwrite: 0,
                merge: 0,
                cancel: 0,
                manual: 0,
                last_write_wins: 0,
                first_write_wins: 0,
            },
            cacheHitRate: 0,
            versionsTracked: 0,
        };
    }
    /**
     * Get active conflicts
     */
    getActiveConflicts() {
        return Array.from(this.activeConflicts.values());
    }
    /**
     * Clear all caches
     */
    clearCaches() {
        this.versionCache.clear();
        this.locks.clear();
        this.activeConflicts.clear();
    }
}
// Singleton instance
let conflictDetectorInstance = null;
/**
 * Initialize conflict detector (call once during server startup)
 */
export function initConflictDetector(googleClient) {
    if (!conflictDetectorInstance) {
        conflictDetectorInstance = new ConflictDetector({
            enabled: process.env['CONFLICT_DETECTION_ENABLED'] !== 'false',
            checkBeforeWrite: process.env['CONFLICT_CHECK_BEFORE_WRITE'] !== 'false',
            autoResolve: process.env['CONFLICT_AUTO_RESOLVE'] === 'true',
            defaultResolution: process.env['CONFLICT_DEFAULT_RESOLUTION'] || 'manual',
            versionCacheTtl: parseInt(process.env['CONFLICT_VERSION_CACHE_TTL'] || '300000'),
            maxVersionsToCache: parseInt(process.env['CONFLICT_MAX_VERSIONS_TO_CACHE'] || '1000'),
            optimisticLocking: process.env['CONFLICT_OPTIMISTIC_LOCKING'] === 'true',
            conflictCheckTimeoutMs: parseInt(process.env['CONFLICT_CHECK_TIMEOUT_MS'] || '5000'),
            verboseLogging: process.env['CONFLICT_VERBOSE'] === 'true',
            googleClient,
        });
    }
    return conflictDetectorInstance;
}
/**
 * Get conflict detector instance
 */
export function getConflictDetector() {
    if (!conflictDetectorInstance) {
        throw new Error('Conflict detector not initialized. Call initConflictDetector() first.');
    }
    return conflictDetectorInstance;
}
/**
 * Reset conflict detector (for testing only)
 * @internal
 */
export function resetConflictDetector() {
    if (process.env['NODE_ENV'] !== 'test' && process.env['VITEST'] !== 'true') {
        throw new Error('resetConflictDetector() can only be called in test environment');
    }
    conflictDetectorInstance = null;
}
//# sourceMappingURL=conflict-detector.js.map