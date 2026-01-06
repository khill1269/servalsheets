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

import type { sheets_v4 } from 'googleapis';
import { getAccessPatternTracker, type PredictedAccess } from './access-pattern-tracker.js';
import { cacheManager, createCacheKey } from '../utils/cache-manager.js';
import { logger } from '../utils/logger.js';
import PQueue from 'p-queue';

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
  confidence: number;
  reason: string;
  priority: number;
}

export interface PrefetchStats {
  totalPrefetches: number;
  successfulPrefetches: number;
  failedPrefetches: number;
  cacheHitsFromPrefetch: number;
  prefetchHitRate: number;
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

  // Metrics
  private stats = {
    totalPrefetches: 0,
    successfulPrefetches: 0,
    failedPrefetches: 0,
    cacheHitsFromPrefetch: 0,
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

    logger.info('Prefetching system initialized', {
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

    logger.debug('Prefetch predictions generated', {
      total: predictions.length,
      queued: tasks.length,
      spreadsheetId: current.spreadsheetId,
    });
  }

  /**
   * Prefetch common resources on spreadsheet open
   */
  async prefetchOnOpen(spreadsheetId: string): Promise<void> {
    if (!this.enabled) return;

    logger.debug('Prefetching on spreadsheet open', { spreadsheetId });

    // Strategy 1: Prefetch spreadsheet metadata
    this.queuePrefetch({
      spreadsheetId,
      confidence: 0.9,
      reason: 'Spreadsheet metadata on open',
      priority: 10,
    });

    // Strategy 2: Prefetch first 100 rows
    this.queuePrefetch({
      spreadsheetId,
      range: 'A1:Z100',
      confidence: 0.8,
      reason: 'First 100 rows on open',
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
    if (cacheManager.has('prefetch', cacheKey)) {
      logger.debug('Prefetch skipped - already cached', {
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
          logger.debug('Prefetch failed', {
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
      { priority: task.priority }
    );
  }

  /**
   * Execute prefetch task
   */
  private async executePrefetch(task: PrefetchTask): Promise<void> {
    const cacheKey = this.getPrefetchCacheKey(task);

    logger.debug('Executing prefetch', {
      spreadsheetId: task.spreadsheetId,
      range: task.range,
      confidence: task.confidence,
      reason: task.reason,
    });

    if (task.range) {
      // Prefetch specific range
      const response = await this.sheetsApi.spreadsheets.values.get({
        spreadsheetId: task.spreadsheetId,
        range: task.range,
        valueRenderOption: 'UNFORMATTED_VALUE',
      });

      // Cache the result
      cacheManager.set(cacheKey, response.data, { namespace: 'prefetch' });
    } else {
      // Prefetch spreadsheet metadata
      const response = await this.sheetsApi.spreadsheets.get({
        spreadsheetId: task.spreadsheetId,
        includeGridData: false,
      });

      // Cache the result
      cacheManager.set(cacheKey, response.data, { namespace: 'prefetch' });
    }

    logger.debug('Prefetch completed', {
      spreadsheetId: task.spreadsheetId,
      range: task.range,
      cacheKey,
    });
  }

  /**
   * Start background refresh worker
   */
  private startBackgroundRefresh(): void {
    // Check every 30 seconds for cache entries that need refresh
    this.refreshTimer = setInterval(() => {
      this.refreshExpiringSoon();
    }, 30000);

    // Don't keep process alive
    if (this.refreshTimer.unref) {
      this.refreshTimer.unref();
    }
  }

  /**
   * Refresh cache entries that are expiring soon
   */
  private refreshExpiringSoon(): void {
    // This would integrate with cache manager to find expiring entries
    // For now, this is a placeholder for the architecture
    logger.debug('Background refresh check');
  }

  /**
   * Generate cache key for prefetch
   */
  private getPrefetchCacheKey(task: PrefetchTask): string {
    if (task.range) {
      return createCacheKey(task.spreadsheetId, { range: task.range, type: 'values' });
    }
    return createCacheKey(task.spreadsheetId, { type: 'metadata' });
  }

  /**
   * Mark that a cache hit came from prefetch
   */
  markPrefetchHit(cacheKey: string): void {
    if (this.prefetchedKeys.has(cacheKey)) {
      this.stats.cacheHitsFromPrefetch++;
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
          ? (this.stats.cacheHitsFromPrefetch / this.stats.totalPrefetches) * 100
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
export function initPrefetchingSystem(sheetsApi: sheets_v4.Sheets): PrefetchingSystem {
  if (!prefetchingSystem) {
    prefetchingSystem = new PrefetchingSystem(sheetsApi, {
      enabled: process.env['PREFETCH_ENABLED'] !== 'false',
      concurrency: parseInt(process.env['PREFETCH_CONCURRENCY'] || '2', 10),
      minConfidence: parseFloat(process.env['PREFETCH_MIN_CONFIDENCE'] || '0.5'),
      backgroundRefresh: process.env['PREFETCH_BACKGROUND_REFRESH'] !== 'false',
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
