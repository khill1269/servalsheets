/**
 * Idempotency Manager
 *
 * Prevents duplicate execution of non-idempotent operations during retries.
 * Uses in-memory LRU cache with TTL for storing operation results.
 *
 * Design:
 * - Client sends X-Idempotency-Key header OR auto-generated for non-idempotent ops
 * - Before execution, check if key was already used
 * - Store result with key + TTL (default 24 hours)
 * - If key exists, return cached result instead of re-executing
 *
 * @category Services
 */

import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger.js';
import { ACTION_METADATA } from '../schemas/action-metadata.js';

/**
 * Idempotency key configuration
 */
export interface IdempotencyConfig {
  /** Maximum number of cached results (default: 10000) */
  maxSize?: number;

  /** TTL for cached results in milliseconds (default: 24 hours) */
  ttl?: number;

  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Cached operation result
 */
interface CachedResult {
  /** Operation result (success or error) */
  result: unknown;

  /** Timestamp when cached */
  timestamp: number;

  /** Tool name */
  tool: string;

  /** Action name */
  action: string;

  /** Request fingerprint (for verification) */
  fingerprint: string;
}

/**
 * Idempotency Manager
 *
 * Thread-safe operation result caching to prevent duplicate executions.
 */
export class IdempotencyManager {
  private cache: LRUCache<string, CachedResult>;
  private config: Required<IdempotencyConfig>;

  constructor(config: IdempotencyConfig = {}) {
    this.config = {
      maxSize: config.maxSize ?? 10000,
      ttl: config.ttl ?? 24 * 60 * 60 * 1000, // 24 hours
      verbose: config.verbose ?? false,
    };

    this.cache = new LRUCache<string, CachedResult>({
      max: this.config.maxSize,
      ttl: this.config.ttl,
      updateAgeOnGet: false,
      updateAgeOnHas: false,
    });

    logger.info('Idempotency Manager initialized', {
      maxSize: this.config.maxSize,
      ttlHours: this.config.ttl / (60 * 60 * 1000),
    });
  }

  /**
   * Check if operation is idempotent
   *
   * @param tool - Tool name
   * @param action - Action name
   * @returns True if operation is safe to retry without side effects
   */
  isIdempotent(tool: string, action: string): boolean {
    const metadata = ACTION_METADATA[tool]?.[action];
    return metadata?.idempotent ?? false;
  }

  /**
   * Check if idempotency key exists and return cached result
   *
   * @param key - Idempotency key
   * @param tool - Tool name (for logging)
   * @param action - Action name (for logging)
   * @param fingerprint - Request fingerprint (for verification)
   * @returns Cached result if exists and fingerprint matches, undefined otherwise
   */
  getCachedResult(
    key: string,
    tool: string,
    action: string,
    fingerprint: string
  ): unknown | undefined {
    const cached = this.cache.get(key);

    if (!cached) {
      return undefined;
    }

    // Verify fingerprint to prevent key collision attacks
    if (cached.fingerprint !== fingerprint) {
      logger.warn('Idempotency key collision detected', {
        key: key.substring(0, 16) + '...',
        tool,
        action,
        cachedTool: cached.tool,
        cachedAction: cached.action,
      });
      return undefined; // key mismatch — not a cache hit
    }

    if (this.config.verbose) {
      logger.debug('Idempotency key cache hit', {
        key: key.substring(0, 16) + '...',
        tool,
        action,
        age: Date.now() - cached.timestamp,
      });
    }

    return cached.result;
  }

  /**
   * Store operation result with idempotency key
   *
   * @param key - Idempotency key
   * @param tool - Tool name
   * @param action - Action name
   * @param fingerprint - Request fingerprint
   * @param result - Operation result to cache
   */
  storeResult(
    key: string,
    tool: string,
    action: string,
    fingerprint: string,
    result: unknown
  ): void {
    const cached: CachedResult = {
      result,
      timestamp: Date.now(),
      tool,
      action,
      fingerprint,
    };

    this.cache.set(key, cached);

    if (this.config.verbose) {
      logger.debug('Idempotency key stored', {
        key: key.substring(0, 16) + '...',
        tool,
        action,
        cacheSize: this.cache.size,
      });
    }
  }

  /**
   * Clear all cached results (for testing)
   */
  clear(): void {
    this.cache.clear();
    logger.info('Idempotency cache cleared');
  }

  /**
   * Get cache statistics
   *
   * @returns Cache size and hit rate metrics
   */
  getStats(): {
    size: number;
    maxSize: number;
    utilizationPercent: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      utilizationPercent: Math.round((this.cache.size / this.config.maxSize) * 100),
    };
  }

  /**
   * Check if key exists in cache
   *
   * @param key - Idempotency key
   * @returns True if key exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Remove specific key from cache
   *
   * @param key - Idempotency key to delete
   */
  delete(key: string): void {
    this.cache.delete(key);
  }
}

/**
 * Global idempotency manager instance
 */
export const idempotencyManager = new IdempotencyManager();

/**
 * Enable verbose idempotency logging
 */
export function enableIdempotencyLogging(): void {
  idempotencyManager['config'].verbose = true;
  logger.info('Idempotency verbose logging enabled');
}

/**
 * Disable verbose idempotency logging
 */
export function disableIdempotencyLogging(): void {
  idempotencyManager['config'].verbose = false;
  logger.info('Idempotency verbose logging disabled');
}
