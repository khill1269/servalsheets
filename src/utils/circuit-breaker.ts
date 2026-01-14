/**
 * Circuit Breaker Pattern
 *
 * Protects against cascading failures by temporarily blocking requests
 * to a failing service, giving it time to recover.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failure threshold reached, requests blocked
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 */

import { logger } from './logger.js';

export type CircuitState = 'closed' | 'open' | 'half_open';

/**
 * Fallback strategy interface
 * Defines how to handle circuit breaker failures
 */
export interface FallbackStrategy<T> {
  /** Strategy name for logging */
  name: string;
  /** Execute the fallback */
  execute: () => Promise<T>;
  /** Determine if this strategy should be used for the given error */
  shouldUse: (error: Error) => boolean;
  /** Priority (higher = tried first) */
  priority?: number;
}

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit */
  failureThreshold: number;
  /** Number of consecutive successes in half-open to close circuit */
  successThreshold: number;
  /** Time to stay open before transitioning to half-open (ms) */
  timeout: number;
  /** Name for logging and identification */
  name?: string;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  lastFailure?: string;
  nextAttempt?: string;
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly circuitName: string,
    public readonly nextAttemptTime: number
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Circuit breaker implementation with fallback strategies
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private lastFailureTime?: number;
  private nextAttemptTime = Date.now();
  private readonly name: string;
  private fallbackStrategies: FallbackStrategy<unknown>[] = [];
  private fallbackUsageCount = 0;

  constructor(private config: CircuitBreakerConfig) {
    this.name = config.name ?? 'default';
  }

  /**
   * Register a fallback strategy
   * Strategies are tried in order of priority (highest first)
   */
  registerFallback<T>(strategy: FallbackStrategy<T>): void {
    this.fallbackStrategies.push(strategy as FallbackStrategy<unknown>);
    // Sort by priority (highest first)
    this.fallbackStrategies.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    logger.debug('Fallback strategy registered', {
      circuit: this.name,
      strategy: strategy.name,
      priority: strategy.priority ?? 0,
      totalStrategies: this.fallbackStrategies.length,
    });
  }

  /**
   * Clear all registered fallback strategies
   */
  clearFallbacks(): void {
    this.fallbackStrategies = [];
    logger.debug('Fallback strategies cleared', { circuit: this.name });
  }

  /**
   * Execute operation with circuit breaker protection
   *
   * @param operation - The operation to execute
   * @param fallback - Optional fallback operation (backwards compatible)
   * @throws CircuitBreakerError if circuit is open and no fallback available
   */
  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === 'open') {
      if (Date.now() < this.nextAttemptTime) {
        logger.warn('Circuit breaker is open, attempting fallback', {
          circuit: this.name,
          state: this.state,
          retryInMs: this.nextAttemptTime - Date.now(),
          registeredFallbacks: this.fallbackStrategies.length,
        });

        // Try registered fallback strategies first
        if (this.fallbackStrategies.length > 0) {
          const error = new Error('Circuit breaker is OPEN');
          return (await this.executeFallbacks(error)) as T;
        }

        // Fall back to legacy single fallback
        if (fallback) {
          this.fallbackUsageCount++;
          return fallback();
        }

        throw new CircuitBreakerError(
          `Circuit breaker [${this.name}] is OPEN`,
          this.name,
          this.nextAttemptTime
        );
      }

      // Move to half-open for testing
      this.transitionTo('half_open');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);

      // Try fallback strategies
      if (this.fallbackStrategies.length > 0) {
        return (await this.executeFallbacks(
          error instanceof Error ? error : new Error(String(error))
        )) as T;
      }

      // Legacy fallback support
      if (this.state === 'open' && fallback) {
        logger.info('Circuit opened, using legacy fallback', {
          circuit: this.name,
        });
        this.fallbackUsageCount++;
        return fallback();
      }

      throw error;
    }
  }

  /**
   * Execute registered fallback strategies
   * Tries each strategy in priority order until one succeeds
   */
  private async executeFallbacks(error: Error): Promise<unknown> {
    for (const strategy of this.fallbackStrategies) {
      if (!strategy.shouldUse(error)) {
        logger.debug('Skipping fallback strategy (shouldUse=false)', {
          circuit: this.name,
          strategy: strategy.name,
          error: error.message,
        });
        continue;
      }

      try {
        logger.info('Attempting fallback strategy', {
          circuit: this.name,
          strategy: strategy.name,
          priority: strategy.priority ?? 0,
        });

        const result = await strategy.execute();
        this.fallbackUsageCount++;

        logger.info('Fallback strategy succeeded', {
          circuit: this.name,
          strategy: strategy.name,
        });

        return result;
      } catch (fallbackError) {
        logger.warn('Fallback strategy failed', {
          circuit: this.name,
          strategy: strategy.name,
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        });
        // Continue to next strategy
      }
    }

    // All fallback strategies failed
    logger.error('All fallback strategies exhausted', {
      circuit: this.name,
      strategiesTried: this.fallbackStrategies.length,
    });

    throw error;
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'half_open') {
      this.successCount++;
      logger.debug('Circuit breaker success in half-open', {
        circuit: this.name,
        successCount: this.successCount,
        threshold: this.config.successThreshold,
      });

      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    }
  }

  private onFailure(error: unknown): void {
    this.successCount = 0;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    logger.warn('Circuit breaker failure', {
      circuit: this.name,
      failureCount: this.failureCount,
      threshold: this.config.failureThreshold,
      error: error instanceof Error ? error.message : String(error),
    });

    if (this.failureCount >= this.config.failureThreshold) {
      this.transitionTo('open');
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === 'open') {
      this.nextAttemptTime = Date.now() + this.config.timeout;
      this.failureCount = 0; // Reset for next half-open attempt
    } else if (newState === 'closed') {
      this.successCount = 0;
      this.failureCount = 0;
    }

    logger.info('Circuit breaker state transition', {
      circuit: this.name,
      from: oldState,
      to: newState,
      nextAttempt: newState === 'open' ? new Date(this.nextAttemptTime).toISOString() : undefined,
    });
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats & {
    fallbackUsageCount: number;
    registeredFallbacks: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : undefined,
      nextAttempt: this.state === 'open' ? new Date(this.nextAttemptTime).toISOString() : undefined,
      fallbackUsageCount: this.fallbackUsageCount,
      registeredFallbacks: this.fallbackStrategies.length,
    };
  }

  /**
   * Manually reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    logger.info('Circuit breaker manually reset', { circuit: this.name });
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is allowing requests
   */
  isOpen(): boolean {
    return this.state === 'open' && Date.now() < this.nextAttemptTime;
  }
}

/**
 * Common fallback strategy implementations
 *
 * These are pre-built strategies for common fallback scenarios.
 * Use these as templates or customize for your specific needs.
 */
export const FallbackStrategies = {
  /**
   * Return cached data from a Map
   * Use for read operations that can tolerate slightly stale data
   *
   * @example
   * circuitBreaker.registerFallback(
   *   FallbackStrategies.cachedData(dataCache, 'spreadsheet:123:values', 100)
   * );
   */
  cachedData: <T>(cache: Map<string, T>, key: string, priority = 100): FallbackStrategy<T> => ({
    name: 'cached-data',
    priority,
    execute: async () => {
      const cached = cache.get(key);
      if (!cached) {
        throw new Error(`No cached data available for key: ${key}`);
      }
      logger.info('Fallback: Using cached data', { key });
      return cached;
    },
    shouldUse: (error) => {
      // Don't use cache for auth errors
      const errorMsg = error.message.toLowerCase();
      return (
        !errorMsg.includes('auth') &&
        !errorMsg.includes('permission') &&
        !errorMsg.includes('forbidden')
      );
    },
  }),

  /**
   * Return degraded/partial data
   * Use when partial functionality is better than complete failure
   *
   * @example
   * circuitBreaker.registerFallback(
   *   FallbackStrategies.degradedMode({ values: [], warning: 'Using degraded mode' }, 50)
   * );
   */
  degradedMode: <T>(degradedData: T, priority = 50): FallbackStrategy<T> => ({
    name: 'degraded-mode',
    priority,
    execute: async () => {
      logger.warn('Fallback: Using degraded mode', { data: degradedData });
      return degradedData;
    },
    shouldUse: () => true, // Always usable as last resort
  }),

  /**
   * Return safe default value
   * Use when empty/default response is acceptable
   *
   * @example
   * circuitBreaker.registerFallback(
   *   FallbackStrategies.safeDefault({ values: [], metadata: { fromCache: false } }, 10)
   * );
   */
  safeDefault: <T>(defaultValue: T, priority = 10): FallbackStrategy<T> => ({
    name: 'safe-default',
    priority,
    execute: async () => {
      logger.info('Fallback: Using safe default', { default: defaultValue });
      return defaultValue;
    },
    shouldUse: () => true, // Always usable as last resort
  }),

  /**
   * Retry with exponential backoff
   * Use for transient failures that may resolve quickly
   *
   * @example
   * circuitBreaker.registerFallback(
   *   FallbackStrategies.retryWithBackoff(operation, 3, 1000, 80)
   * );
   */
  retryWithBackoff: <T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 1000,
    priority = 80
  ): FallbackStrategy<T> => ({
    name: 'retry-with-backoff',
    priority,
    execute: async () => {
      let lastError: Error | undefined;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.debug('Fallback: Retry attempt', { attempt, maxRetries });
          return await operation();
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (attempt < maxRetries) {
            const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
            logger.debug('Fallback: Retry failed, waiting', {
              attempt,
              delayMs,
              error: lastError.message,
            });
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
      }

      throw lastError || new Error('All retry attempts failed');
    },
    shouldUse: (error) => {
      // Only retry for transient errors
      const errorMsg = error.message.toLowerCase();
      return (
        errorMsg.includes('timeout') ||
        errorMsg.includes('network') ||
        errorMsg.includes('temporary') ||
        error.message.includes('503') ||
        error.message.includes('429')
      ); // Rate limit
    },
  }),

  /**
   * Use alternate data source
   * Use when multiple data sources are available
   *
   * @example
   * circuitBreaker.registerFallback(
   *   FallbackStrategies.alternateSource(backupApiCall, 90)
   * );
   */
  alternateSource: <T>(
    alternateOperation: () => Promise<T>,
    priority = 90
  ): FallbackStrategy<T> => ({
    name: 'alternate-source',
    priority,
    execute: async () => {
      logger.info('Fallback: Using alternate data source');
      return await alternateOperation();
    },
    shouldUse: () => true, // Try alternate source for any error
  }),

  /**
   * Return read-only mode response
   * Use when write operations fail but read operations still work
   *
   * @example
   * circuitBreaker.registerFallback(
   *   FallbackStrategies.readOnlyMode(
   *     { success: false, error: 'Read-only mode', data: null },
   *     30
   *   )
   * );
   */
  readOnlyMode: <T>(readOnlyResponse: T, priority = 30): FallbackStrategy<T> => ({
    name: 'read-only-mode',
    priority,
    execute: async () => {
      logger.warn('Fallback: Entering read-only mode');
      return readOnlyResponse;
    },
    shouldUse: (error) => {
      // Only for write operation failures
      const errorMsg = error.message.toLowerCase();
      return (
        errorMsg.includes('write') ||
        errorMsg.includes('update') ||
        errorMsg.includes('delete') ||
        errorMsg.includes('modify')
      );
    },
  }),
};

/**
 * Example: Create a circuit breaker with multiple fallback strategies
 *
 * @example
 * ```typescript
 * const dataCache = new Map();
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   successThreshold: 2,
 *   timeout: 60000,
 *   name: 'sheets-api',
 * });
 *
 * // Register fallbacks in priority order (highest first)
 * breaker.registerFallback(
 *   FallbackStrategies.cachedData(dataCache, 'key', 100)
 * );
 * breaker.registerFallback(
 *   FallbackStrategies.retryWithBackoff(operation, 3, 1000, 80)
 * );
 * breaker.registerFallback(
 *   FallbackStrategies.degradedMode({ values: [], warning: 'Degraded' }, 50)
 * );
 *
 * // Execute with fallbacks
 * const result = await breaker.execute(async () => {
 *   return await sheetsApi.values.get({ ... });
 * });
 * ```
 */
