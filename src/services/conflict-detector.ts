/**
 * ServalSheets - Conflict Detector
 *
 * Multi-user conflict detection and resolution:
 * - Version tracking for ranges
 * - Concurrent modification detection
 * - Resolution strategies (overwrite, merge, cancel)
 * - Optimistic locking
 *
 * Phase 4, Task 4.2
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import {
  Conflict,
  ConflictType as _ConflictType,
  ConflictSeverity,
  RangeVersion,
  ConflictResolution,
  ConflictResolutionResult,
  ResolutionStrategy,
  ChangeSet as _ChangeSet,
  CellChange as _CellChange,
  VersionCacheEntry,
  OptimisticLock,
  EditSession,
  ConcurrentEditWarning as _ConcurrentEditWarning,
  ConflictDetectorConfig,
  ConflictDetectorStats,
  MergeResult,
} from '../types/conflict.js';

/**
 * Conflict Detector - Detects and resolves multi-user conflicts
 */
export class ConflictDetector {
  private config: Required<ConflictDetectorConfig>;
  private stats: ConflictDetectorStats;
  private versionCache: Map<string, VersionCacheEntry>;
  private locks: Map<string, OptimisticLock>;
  private editSessions: Map<string, EditSession>;
  private activeConflicts: Map<string, Conflict>;

  constructor(config: ConflictDetectorConfig = {}) {
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
  async trackVersion(
    spreadsheetId: string,
    range: string,
    modifiedBy: string,
    data?: unknown
  ): Promise<RangeVersion> {
    this.log(`Tracking version for range: ${range}`);

    const checksum = this.calculateChecksum(data);
    const cacheKey = this.getCacheKey(spreadsheetId, range);
    const cachedEntry = this.versionCache.get(cacheKey);

    const version: RangeVersion = {
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
  async detectConflict(
    spreadsheetId: string,
    range: string,
    expectedVersion?: RangeVersion
  ): Promise<Conflict | null> {
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
  async resolveConflict(
    resolution: ConflictResolution
  ): Promise<ConflictResolutionResult> {
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
      let result: ConflictResolutionResult;

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
      } else {
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
    } catch (error) {
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
   */
  private async resolveOverwrite(conflict: Conflict): Promise<ConflictResolutionResult> {
    this.log(`Resolving conflict ${conflict.id} with overwrite strategy`);

    // TODO: Integrate with Google Sheets API to write user's version
    // For now, simulate
    await this.delay(100);

    const finalVersion: RangeVersion = {
      ...conflict.yourVersion,
      lastModified: Date.now(),
      version: conflict.currentVersion.version + 1,
    };

    return {
      conflictId: conflict.id,
      success: true,
      strategyUsed: 'overwrite',
      finalVersion,
      duration: 100,
    };
  }

  /**
   * Resolve by merging changes
   */
  private async resolveMerge(
    conflict: Conflict,
    mergeData?: unknown
  ): Promise<ConflictResolutionResult> {
    this.log(`Resolving conflict ${conflict.id} with merge strategy`);

    // TODO: Implement 3-way merge algorithm
    // For now, simulate simple merge
    await this.delay(200);

    const mergeResult: MergeResult = {
      success: true,
      mergedData: mergeData || {},
      changes: {
        range: conflict.range,
        totalChanges: 0,
      },
    };

    const finalVersion: RangeVersion = {
      ...conflict.yourVersion,
      lastModified: Date.now(),
      version: conflict.currentVersion.version + 1,
      checksum: this.calculateChecksum(mergeResult.mergedData),
    };

    return {
      conflictId: conflict.id,
      success: true,
      strategyUsed: 'merge',
      finalVersion,
      changesApplied: mergeResult.changes,
      duration: 200,
    };
  }

  /**
   * Resolve by canceling user's changes
   */
  private async resolveCancel(conflict: Conflict): Promise<ConflictResolutionResult> {
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
  private async resolveLastWriteWins(conflict: Conflict): Promise<ConflictResolutionResult> {
    this.log(`Resolving conflict ${conflict.id} with last_write_wins strategy`);

    // Most recent modification wins
    const winner =
      conflict.yourVersion.lastModified > conflict.currentVersion.lastModified
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
  private async resolveFirstWriteWins(conflict: Conflict): Promise<ConflictResolutionResult> {
    this.log(`Resolving conflict ${conflict.id} with first_write_wins strategy`);

    // First modification wins
    const winner =
      conflict.yourVersion.lastModified < conflict.currentVersion.lastModified
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
  private hasConflict(expected: RangeVersion, current: RangeVersion): boolean {
    // Conflict exists if:
    // 1. Timestamps differ
    // 2. Checksums differ
    // 3. Versions differ

    return (
      current.lastModified > expected.lastModified ||
      current.checksum !== expected.checksum ||
      current.version > expected.version
    );
  }

  /**
   * Create conflict object
   */
  private createConflict(
    yourVersion: RangeVersion,
    currentVersion: RangeVersion
  ): Conflict {
    const timeSinceModification = Date.now() - currentVersion.lastModified;

    // Determine severity based on time difference
    let severity: ConflictSeverity;
    if (timeSinceModification < 60000) {
      // < 1 minute
      severity = 'critical';
    } else if (timeSinceModification < 300000) {
      // < 5 minutes
      severity = 'error';
    } else if (timeSinceModification < 1800000) {
      // < 30 minutes
      severity = 'warning';
    } else {
      severity = 'info';
    }

    const conflict: Conflict = {
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
  private suggestResolution(
    yourVersion: RangeVersion,
    currentVersion: RangeVersion
  ): ResolutionStrategy {
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
   */
  private async fetchCurrentVersion(
    spreadsheetId: string,
    range: string
  ): Promise<RangeVersion> {
    this.log(`Fetching current version for range: ${range}`);

    // TODO: Integrate with Google Sheets API
    // For now, return simulated version
    await this.delay(50);

    const cacheKey = this.getCacheKey(spreadsheetId, range);
    const cached = this.versionCache.get(cacheKey);

    return cached?.version || {
      spreadsheetId,
      range,
      lastModified: Date.now(),
      modifiedBy: 'unknown',
      checksum: this.calculateChecksum(null),
      version: 1,
    };
  }

  /**
   * Calculate checksum for data
   */
  private calculateChecksum(data: unknown): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data || {}));
    return hash.digest('hex');
  }

  /**
   * Get cache key
   */
  private getCacheKey(spreadsheetId: string, range: string): string {
    return `${spreadsheetId}:${range}`;
  }

  /**
   * Format time since
   */
  private formatTimeSince(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  }

  /**
   * Start background cache cleanup
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const expired: string[] = [];

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
        const entries = Array.from(this.versionCache.entries()).sort(
          (a, b) => a[1].cachedAt - b[1].cachedAt
        );
        const toRemove = entries.slice(
          0,
          this.versionCache.size - this.config.maxVersionsToCache
        );
        for (const [key] of toRemove) {
          this.versionCache.delete(key);
        }
      }
    }, 60000); // Every minute
  }

  /**
   * Start background lock cleanup
   */
  private startLockCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const expired: string[] = [];

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
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log message
   */
  private log(message: string): void {
    if (this.config.verboseLogging) {
      // eslint-disable-next-line no-console
      console.log(`[ConflictDetector] ${message}`); // Debugging output when verboseLogging enabled
    }
  }

  /**
   * Get statistics
   */
  getStats(): ConflictDetectorStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
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
  getActiveConflicts(): Conflict[] {
    return Array.from(this.activeConflicts.values());
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.versionCache.clear();
    this.locks.clear();
    this.activeConflicts.clear();
  }
}

// Singleton instance
let conflictDetectorInstance: ConflictDetector | null = null;

/**
 * Get conflict detector instance
 */
export function getConflictDetector(
  config?: ConflictDetectorConfig
): ConflictDetector {
  if (!conflictDetectorInstance) {
    conflictDetectorInstance = new ConflictDetector(config);
  }
  return conflictDetectorInstance;
}
