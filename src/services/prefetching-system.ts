/**
 * ServalSheets - Predictive Prefetching System
 *
 * Intelligently prefetches data based on access patterns to reduce latency.
 * Phase 2, Task 2.2
 *
 * Features:
 * - Pattern-based prefetching
 * - Adjacent range prefetching
 * - Background refresh before cache expiry
 * - Priority-based prefetch queue
 * - Configurable strategies
 */

import type { sheets_v4 } from "googleapis";
import {
  getAccessPatternTracker,
  type PredictedAccess,
} from "./access-pattern-tracker.js";
import { cacheManager, createCacheKey } from "../utils/cache-manager.js";
import { logger } from "../utils/logger.js";
import PQueue from "p-queue";

export interface PrefetchOptions {
  /** Enable/disable prefetching (default: true) */
  enabled?: boolean;
  /** Maximum concurrent prefetch requests (default: 2) */
  concurrency?: number;
  /** Minimum confidence threshold for prefetching (default: 0.5) */
  minConfidence?: number;
  /** Enable background refresh (default: true) */
  backgroundRefresh?: boolean;
  /** Refresh TTL threshold in ms (default: 60000 = 1 min before expiry) */
  refreshThreshold?: number;
}

export interface PrefetchTask {
  spreadsheetId: string;
  range?: string;
  sheetId?: number;
  comprehensive?: boolean; // Phase 2: Flag for comprehensive metadata
  confidence: number;
  reason: string;
  priority: number;
}

export interface RefreshTask {
  cacheKey: string;
  spreadsheetId: string;
  range?: string;
  sheetId?: number;
  comprehensive?: boolean;
  priority: number;
  lastAccessed: number;
  accessCount: number;
}

export interface RefreshMetadata {
  spreadsheetId: string;
  range?: string;
  comprehensive?: boolean;
  lastAccessed: number;
  accessCount: number;
}

export interface PrefetchStats {
  totalPrefetches: number;
  successfulPrefetches: number;
  failedPrefetches: number;
  cacheHitsFromPrefetch: number;
  prefetchHitRate: number;
  totalRefreshes: number;
  successfulRefreshes: number;
  failedRefreshes: number;
  refreshHitRate: number;
}

/**
 * Predictive Prefetching System
 */
export class PrefetchingSystem {
  private sheetsApi: sheets_v4.Sheets;
  private enabled: boolean;
  private minConfidence: number;
  private backgroundRefresh: boolean;
  private refreshThreshold: number;
  private queue: PQueue;
  private refreshTimer?: NodeJS.Timeout;

  // Track which prefetches were used
  private prefetchedKeys = new Set<string>();

  // Track refresh metadata for each cache key
  private refreshMetadata = new Map<string, RefreshMetadata>();

  // Refresh check interval (30 seconds)
  private refreshCheckInterval = 30000;

  // Metrics
  private stats = {
    totalPrefetches: 0,
    successfulPrefetches: 0,
    failedPrefetches: 0,
    cacheHitsFromPrefetch: 0,
    totalRefreshes: 0,
    successfulRefreshes: 0,
    failedRefreshes: 0,
  };

  constructor(sheetsApi: sheets_v4.Sheets, options: PrefetchOptions = {}) {
    this.sheetsApi = sheetsApi;
    this.enabled = options.enabled ?? true;
    this.minConfidence = options.minConfidence ?? 0.5;
    this.backgroundRefresh = options.backgroundRefresh ?? true;
    this.refreshThreshold = options.refreshThreshold ?? 60000;

    this.queue = new PQueue({
      concurrency: options.concurrency ?? 2, // Low concurrency to not interfere with user requests
      autoStart: true,
    });

    if (this.backgroundRefresh) {
      this.startBackgroundRefresh();
    }

    logger.info("Prefetching system initialized", {
      enabled: this.enabled,
      minConfidence: this.minConfidence,
      backgroundRefresh: this.backgroundRefresh,
    });
  }

  /**
   * Prefetch data based on current access
   */
  async prefetch(current: {
    spreadsheetId: string;
    sheetId?: number;
    range?: string;
  }): Promise<void> {
    if (!this.enabled) return;

    const tracker = getAccessPatternTracker();
    const predictions = tracker.predictNext(current);

    // Filter by confidence threshold
    const tasks = predictions
      .filter((p) => p.confidence >= this.minConfidence)
      .map((p) => this.createPrefetchTask(p));

    // Sort by priority (confidence)
    tasks.sort((a, b) => b.priority - a.priority);

    // Queue prefetch tasks
    for (const task of tasks) {
      this.queuePrefetch(task);
    }

    logger.debug("Prefetch predictions generated", {
      total: predictions.length,
      queued: tasks.length,
      spreadsheetId: current.spreadsheetId,
    });
  }

  /**
   * Prefetch common resources on spreadsheet open
   * Phase 2: Enhanced to prefetch COMPREHENSIVE metadata
   */
  async prefetchOnOpen(spreadsheetId: string): Promise<void> {
    if (!this.enabled) return;

    logger.debug("Prefetching on spreadsheet open (comprehensive mode)", {
      spreadsheetId,
    });

    // Strategy 1: Prefetch COMPREHENSIVE metadata (Phase 2 optimization)
    // This single prefetch replaces multiple API calls for analysis operations
    this.queuePrefetch({
      spreadsheetId,
      comprehensive: true,
      confidence: 0.95,
      reason:
        "Comprehensive metadata on open (all sheets, charts, formats, rules)",
      priority: 10,
    });

    // Strategy 2: Prefetch first 100 rows (for data analysis)
    this.queuePrefetch({
      spreadsheetId,
      range: "A1:Z100",
      confidence: 0.8,
      reason: "First 100 rows on open",
      priority: 9,
    });
  }

  /**
   * Create prefetch task from prediction
   */
  private createPrefetchTask(prediction: PredictedAccess): PrefetchTask {
    return {
      spreadsheetId: prediction.spreadsheetId,
      range: prediction.range,
      sheetId: prediction.sheetId,
      confidence: prediction.confidence,
      reason: prediction.reason,
      priority: Math.round(prediction.confidence * 10),
    };
  }

  /**
   * Queue a prefetch task
   */
  private queuePrefetch(task: PrefetchTask): void {
    const cacheKey = this.getPrefetchCacheKey(task);

    // Skip if already in cache
    if (cacheManager.has("prefetch", cacheKey)) {
      logger.debug("Prefetch skipped - already cached", {
        spreadsheetId: task.spreadsheetId,
        range: task.range,
      });
      return;
    }

    // Skip if already prefetching
    if (this.prefetchedKeys.has(cacheKey)) {
      return;
    }

    this.stats.totalPrefetches++;
    this.prefetchedKeys.add(cacheKey);

    // Add to queue with priority
    void this.queue.add(
      async () => {
        try {
          await this.executePrefetch(task);
          this.stats.successfulPrefetches++;
        } catch (error) {
          this.stats.failedPrefetches++;
          logger.debug("Prefetch failed", {
            spreadsheetId: task.spreadsheetId,
            range: task.range,
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          // Remove from tracking after completion
          setTimeout(() => {
            this.prefetchedKeys.delete(cacheKey);
          }, 5000);
        }
      },
      { priority: task.priority },
    );
  }

  /**
   * Execute prefetch task
   * Phase 2: Enhanced to support comprehensive metadata prefetching
   */
  private async executePrefetch(task: PrefetchTask): Promise<void> {
    const cacheKey = this.getPrefetchCacheKey(task);

    logger.debug("Executing prefetch", {
      spreadsheetId: task.spreadsheetId,
      range: task.range,
      comprehensive: task.comprehensive,
      confidence: task.confidence,
      reason: task.reason,
    });

    if (task.range) {
      // Prefetch specific range
      const response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: task.spreadsheetId,
        range: task.range,
        valueRenderOption: "UNFORMATTED_VALUE",
      });

      // Cache the result
      cacheManager.set(cacheKey, response.data, { namespace: "prefetch" });

      // Track metadata for refresh
      this.trackRefreshMetadata(cacheKey, {
        spreadsheetId: task.spreadsheetId,
        range: task.range,
        lastAccessed: Date.now(),
        accessCount: 1,
      });
    } else if (task.comprehensive) {
      // Phase 2: Prefetch COMPREHENSIVE metadata (all analysis data in one call)
      const fields = [
        "spreadsheetId",
        "properties",
        "namedRanges",
        "sheets(properties,conditionalFormats,protectedRanges,charts,filterViews,basicFilter,merges)",
      ].join(",");

      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: task.spreadsheetId,
        includeGridData: false,
        fields,
      });

      // Cache with the comprehensive key (shared with BaseHandler.fetchComprehensiveMetadata)
      const comprehensiveCacheKey = createCacheKey(
        "spreadsheet:comprehensive",
        {
          spreadsheetId: task.spreadsheetId,
        },
      );
      cacheManager.set(comprehensiveCacheKey, response.data, {
        namespace: "spreadsheet",
        ttl: 300000, // 5 minutes
      });

      // Track metadata for refresh
      this.trackRefreshMetadata(comprehensiveCacheKey, {
        spreadsheetId: task.spreadsheetId,
        comprehensive: true,
        lastAccessed: Date.now(),
        accessCount: 1,
      });

      logger.debug("Comprehensive metadata prefetched", {
        spreadsheetId: task.spreadsheetId,
        sheetsCount: response.data.sheets?.length ?? 0,
        namedRangesCount: response.data.namedRanges?.length ?? 0,
      });
    } else {
      // Prefetch basic spreadsheet metadata (fallback)
      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: task.spreadsheetId,
        includeGridData: false,
      });

      // Cache the result
      cacheManager.set(cacheKey, response.data, { namespace: "prefetch" });

      // Track metadata for refresh
      this.trackRefreshMetadata(cacheKey, {
        spreadsheetId: task.spreadsheetId,
        lastAccessed: Date.now(),
        accessCount: 1,
      });
    }

    logger.debug("Prefetch completed", {
      spreadsheetId: task.spreadsheetId,
      range: task.range,
      comprehensive: task.comprehensive,
      cacheKey,
    });
  }

  /**
   * Track refresh metadata for a cache entry
   *
   * Stores metadata needed to reconstruct refresh tasks
   */
  private trackRefreshMetadata(
    cacheKey: string,
    metadata: RefreshMetadata,
  ): void {
    // Update existing metadata or create new
    const existing = this.refreshMetadata.get(cacheKey);
    if (existing) {
      existing.accessCount++;
      existing.lastAccessed = metadata.lastAccessed;
    } else {
      this.refreshMetadata.set(cacheKey, metadata);
    }

    // Limit metadata storage to prevent memory bloat
    if (this.refreshMetadata.size > 1000) {
      // Remove oldest entries
      const entries = Array.from(this.refreshMetadata.entries());
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      const toRemove = entries.slice(0, 100);
      toRemove.forEach(([key]) => this.refreshMetadata.delete(key));
    }
  }

  /**
   * Start background refresh worker
   */
  private startBackgroundRefresh(): void {
    // Check every 30 seconds for cache entries that need refresh
    this.refreshTimer = setInterval(() => {
      void this.refreshExpiringSoon();
    }, this.refreshCheckInterval);

    // Don't keep process alive
    if (this.refreshTimer.unref) {
      this.refreshTimer.unref();
    }

    logger.debug("Background refresh started", {
      checkInterval: `${this.refreshCheckInterval}ms`,
      refreshThreshold: `${this.refreshThreshold}ms`,
    });
  }

  /**
   * Refresh cache entries that are expiring soon
   *
   * This method detects cache entries expiring within the refresh threshold
   * and proactively refreshes them to prevent cache misses on hot paths.
   */
  private async refreshExpiringSoon(): Promise<void> {
    try {
      // Get entries from prefetch namespace that are expiring within the threshold
      const expiringEntries = cacheManager.getExpiringEntries(
        this.refreshThreshold,
        "prefetch",
      );

      // Also check spreadsheet namespace for comprehensive metadata
      const expiringSpreadsheetEntries = cacheManager.getExpiringEntries(
        this.refreshThreshold,
        "spreadsheet",
      );

      const allExpiring = [...expiringEntries, ...expiringSpreadsheetEntries];

      if (allExpiring.length === 0) {
        logger.debug("Background refresh: no expiring entries");
        return;
      }

      logger.debug("Background refresh: expiring entries detected", {
        count: allExpiring.length,
        threshold: `${this.refreshThreshold}ms`,
      });

      // Convert expiring cache keys to refresh tasks
      const refreshTasks: RefreshTask[] = [];

      for (const entry of allExpiring) {
        const refreshTask = this.createRefreshTask(entry.key, entry.expiresIn);
        if (refreshTask) {
          refreshTasks.push(refreshTask);
        }
      }

      if (refreshTasks.length === 0) {
        logger.debug("Background refresh: no valid refresh tasks");
        return;
      }

      // Sort by priority (hot data first)
      refreshTasks.sort((a, b) => b.priority - a.priority);

      logger.debug("Background refresh: queueing refresh tasks", {
        total: refreshTasks.length,
        highPriority: refreshTasks.filter((t) => t.priority >= 8).length,
      });

      // Queue refresh tasks
      for (const task of refreshTasks) {
        void this.queue.add(
          async () => {
            try {
              await this.refreshCacheEntry(task);
              this.stats.successfulRefreshes++;
            } catch (error) {
              this.stats.failedRefreshes++;
              logger.debug("Background refresh failed", {
                cacheKey: task.cacheKey,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          },
          { priority: task.priority },
        );
      }
    } catch (error) {
      logger.warn("Background refresh check failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Create a refresh task from a cache key
   *
   * Parses the cache key to reconstruct the original request parameters
   * and determines refresh priority based on access patterns.
   */
  private createRefreshTask(
    cacheKey: string,
    expiresIn: number,
  ): RefreshTask | null {
    // Try to get stored metadata first
    const metadata = this.refreshMetadata.get(cacheKey);
    if (metadata) {
      // Calculate priority based on access count and recency
      const priority = this.calculateRefreshPriority(
        metadata.accessCount,
        metadata.lastAccessed,
        expiresIn,
      );

      return {
        cacheKey,
        spreadsheetId: metadata.spreadsheetId,
        range: metadata.range,
        comprehensive: metadata.comprehensive,
        priority,
        lastAccessed: metadata.lastAccessed,
        accessCount: metadata.accessCount,
      };
    }

    // Fallback: Parse cache key to reconstruct task
    const parsed = this.parseCacheKey(cacheKey);
    if (!parsed) {
      logger.debug("Background refresh: unable to parse cache key", {
        cacheKey,
      });
      return null;
    }

    // Default priority for entries without metadata
    const priority = this.calculateRefreshPriority(1, Date.now(), expiresIn);

    return {
      cacheKey,
      spreadsheetId: parsed.spreadsheetId,
      range: parsed.range,
      comprehensive: parsed.comprehensive,
      priority,
      lastAccessed: Date.now(),
      accessCount: 1,
    };
  }

  /**
   * Calculate refresh priority based on access patterns
   *
   * Hot data (frequently accessed, recently used) gets higher priority
   */
  private calculateRefreshPriority(
    accessCount: number,
    lastAccessed: number,
    expiresIn: number,
  ): number {
    // Base priority on access frequency (capped at 5)
    const frequencyScore = Math.min(5, accessCount);

    // Recency score: higher for recently accessed data
    const ageMs = Date.now() - lastAccessed;
    const recencyScore =
      ageMs < 60000 ? 3 : ageMs < 300000 ? 2 : ageMs < 600000 ? 1 : 0;

    // Urgency score: higher for entries expiring sooner
    const urgencyScore =
      expiresIn < 30000
        ? 2
        : expiresIn < 60000
          ? 1
          : expiresIn < 120000
            ? 0.5
            : 0;

    // Combine scores (max 10)
    const priority = Math.min(10, frequencyScore + recencyScore + urgencyScore);

    return Math.round(priority);
  }

  /**
   * Parse cache key to extract request parameters
   *
   * Cache keys are in format: "operation:param1=value1&param2=value2"
   */
  private parseCacheKey(cacheKey: string): {
    spreadsheetId: string;
    range?: string;
    comprehensive?: boolean;
  } | null {
    try {
      // Remove namespace prefix if present
      const key = cacheKey.includes(":")
        ? cacheKey.substring(cacheKey.indexOf(":") + 1)
        : cacheKey;

      // Check for comprehensive metadata pattern
      if (key.includes("spreadsheet:comprehensive")) {
        const match = key.match(/spreadsheetId="([^"]+)"/);
        if (match?.[1]) {
          return {
            spreadsheetId: match[1],
            comprehensive: true,
          };
        }
      }

      // Parse standard cache key format
      const params: Record<string, string> = {};
      const parts = key.split("&");

      for (const part of parts) {
        const [paramKey, paramValue] = part.split("=");
        if (paramKey && paramValue) {
          // Remove quotes from JSON-stringified values
          params[paramKey] = paramValue.replace(/^"(.*)"$/, "$1");
        }
      }

      // Extract spreadsheetId
      let spreadsheetId = params["spreadsheetId"];

      // If not found in params, try to extract from first part
      if (!spreadsheetId && parts[0]) {
        const firstPart = parts[0];
        if (firstPart.includes(":")) {
          const afterColon = firstPart.split(":").pop();
          if (afterColon && !afterColon.includes("=")) {
            spreadsheetId = afterColon;
          }
        }
      }

      if (!spreadsheetId) {
        return null;
      }

      return {
        spreadsheetId,
        range: params["range"],
        comprehensive: params["type"] === "metadata",
      };
    } catch (error) {
      logger.debug("Failed to parse cache key", {
        cacheKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Refresh a cache entry
   *
   * Re-fetches the data and updates the cache
   */
  private async refreshCacheEntry(task: RefreshTask): Promise<void> {
    this.stats.totalRefreshes++;

    logger.debug("Refreshing cache entry", {
      spreadsheetId: task.spreadsheetId,
      range: task.range,
      comprehensive: task.comprehensive,
      priority: task.priority,
      accessCount: task.accessCount,
    });

    try {
      if (task.range) {
        // Refresh specific range
        const response = await this.sheetsApi.spreadsheets.values.get({
          spreadsheetId: task.spreadsheetId,
          range: task.range,
          valueRenderOption: "UNFORMATTED_VALUE",
        });

        // Update cache
        const cacheKey = createCacheKey(task.spreadsheetId, {
          range: task.range,
          type: "values",
        });
        cacheManager.set(cacheKey, response.data, { namespace: "prefetch" });

        logger.debug("Cache entry refreshed", {
          spreadsheetId: task.spreadsheetId,
          range: task.range,
        });
      } else if (task.comprehensive) {
        // Refresh comprehensive metadata
        const fields = [
          "spreadsheetId",
          "properties",
          "namedRanges",
          "sheets(properties,conditionalFormats,protectedRanges,charts,filterViews,basicFilter,merges)",
        ].join(",");

        const response = await this.sheetsApi.spreadsheets.get({
          spreadsheetId: task.spreadsheetId,
          includeGridData: false,
          fields,
        });

        // Update cache
        const comprehensiveCacheKey = createCacheKey(
          "spreadsheet:comprehensive",
          {
            spreadsheetId: task.spreadsheetId,
          },
        );
        cacheManager.set(comprehensiveCacheKey, response.data, {
          namespace: "spreadsheet",
          ttl: 300000, // 5 minutes
        });

        logger.debug("Comprehensive metadata refreshed", {
          spreadsheetId: task.spreadsheetId,
          sheetsCount: response.data.sheets?.length ?? 0,
        });
      } else {
        // Refresh basic spreadsheet metadata
        const response = await this.sheetsApi.spreadsheets.get({
          spreadsheetId: task.spreadsheetId,
          includeGridData: false,
        });

        // Update cache
        const cacheKey = createCacheKey(task.spreadsheetId, {
          type: "metadata",
        });
        cacheManager.set(cacheKey, response.data, { namespace: "prefetch" });

        logger.debug("Basic metadata refreshed", {
          spreadsheetId: task.spreadsheetId,
        });
      }

      // Update metadata tracking
      const metadata = this.refreshMetadata.get(task.cacheKey);
      if (metadata) {
        metadata.lastAccessed = Date.now();
      }
    } catch (error) {
      logger.debug("Failed to refresh cache entry", {
        spreadsheetId: task.spreadsheetId,
        range: task.range,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate cache key for prefetch
   * Phase 2: Updated to handle comprehensive metadata
   */
  private getPrefetchCacheKey(task: PrefetchTask): string {
    if (task.range) {
      return createCacheKey(task.spreadsheetId, {
        range: task.range,
        type: "values",
      });
    }
    if (task.comprehensive) {
      return createCacheKey("spreadsheet:comprehensive", {
        spreadsheetId: task.spreadsheetId,
      });
    }
    return createCacheKey(task.spreadsheetId, { type: "metadata" });
  }

  /**
   * Mark that a cache hit came from prefetch
   */
  markPrefetchHit(cacheKey: string): void {
    if (this.prefetchedKeys.has(cacheKey)) {
      this.stats.cacheHitsFromPrefetch++;
    }

    // Update access metadata for refresh priority
    const metadata = this.refreshMetadata.get(cacheKey);
    if (metadata) {
      metadata.accessCount++;
      metadata.lastAccessed = Date.now();
    }
  }

  /**
   * Get prefetch statistics
   */
  getStats(): PrefetchStats {
    return {
      totalPrefetches: this.stats.totalPrefetches,
      successfulPrefetches: this.stats.successfulPrefetches,
      failedPrefetches: this.stats.failedPrefetches,
      cacheHitsFromPrefetch: this.stats.cacheHitsFromPrefetch,
      prefetchHitRate:
        this.stats.totalPrefetches > 0
          ? (this.stats.cacheHitsFromPrefetch / this.stats.totalPrefetches) *
            100
          : 0,
      totalRefreshes: this.stats.totalRefreshes,
      successfulRefreshes: this.stats.successfulRefreshes,
      failedRefreshes: this.stats.failedRefreshes,
      refreshHitRate:
        this.stats.totalRefreshes > 0
          ? (this.stats.successfulRefreshes / this.stats.totalRefreshes) * 100
          : 0,
    };
  }

  /**
   * Stop background refresh
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    this.queue.clear();
  }
}

// Singleton instance
let prefetchingSystem: PrefetchingSystem | null = null;

/**
 * Initialize the prefetching system
 */
export function initPrefetchingSystem(
  sheetsApi: sheets_v4.Sheets,
): PrefetchingSystem {
  if (!prefetchingSystem) {
    prefetchingSystem = new PrefetchingSystem(sheetsApi, {
      enabled: process.env["PREFETCH_ENABLED"] !== "false",
      concurrency: parseInt(process.env["PREFETCH_CONCURRENCY"] || "2", 10),
      minConfidence: parseFloat(
        process.env["PREFETCH_MIN_CONFIDENCE"] || "0.5",
      ),
      backgroundRefresh: process.env["PREFETCH_BACKGROUND_REFRESH"] !== "false",
    });
  }
  return prefetchingSystem;
}

/**
 * Get the prefetching system singleton
 */
export function getPrefetchingSystem(): PrefetchingSystem | null {
  return prefetchingSystem;
}

/**
 * Reset the prefetching system (for testing only)
 * @internal
 */
export function resetPrefetchingSystem(): void {
  if (process.env["NODE_ENV"] !== "test" && process.env["VITEST"] !== "true") {
    throw new Error(
      "resetPrefetchingSystem() can only be called in test environment",
    );
  }
  if (prefetchingSystem) {
    prefetchingSystem.destroy();
  }
  prefetchingSystem = null;
}
