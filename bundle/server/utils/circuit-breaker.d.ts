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
export declare class CircuitBreakerError extends Error {
    readonly circuitName: string;
    readonly nextAttemptTime: number;
    constructor(message: string, circuitName: string, nextAttemptTime: number);
}
/**
 * Circuit breaker implementation with fallback strategies
 */
export declare class CircuitBreaker {
    private config;
    private state;
    private failureCount;
    private successCount;
    private totalRequests;
    private lastFailureTime?;
    private nextAttemptTime;
    private readonly name;
    private fallbackStrategies;
    private fallbackUsageCount;
    constructor(config: CircuitBreakerConfig);
    /**
     * Register a fallback strategy
     * Strategies are tried in order of priority (highest first)
     */
    registerFallback<T>(strategy: FallbackStrategy<T>): void;
    /**
     * Clear all registered fallback strategies
     */
    clearFallbacks(): void;
    /**
     * Execute operation with circuit breaker protection
     *
     * @param operation - The operation to execute
     * @param fallback - Optional fallback operation (backwards compatible)
     * @throws CircuitBreakerError if circuit is open and no fallback available
     */
    execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T>;
    /**
     * Execute registered fallback strategies
     * Tries each strategy in priority order until one succeeds
     */
    private executeFallbacks;
    private onSuccess;
    private onFailure;
    private transitionTo;
    /**
     * Get current circuit breaker statistics
     */
    getStats(): CircuitBreakerStats & {
        fallbackUsageCount: number;
        registeredFallbacks: number;
    };
    /**
     * Manually reset the circuit breaker to closed state
     */
    reset(): void;
    /**
     * Get current state
     */
    getState(): CircuitState;
    /**
     * Check if circuit is allowing requests
     */
    isOpen(): boolean;
}
/**
 * Common fallback strategy implementations
 *
 * These are pre-built strategies for common fallback scenarios.
 * Use these as templates or customize for your specific needs.
 */
export declare const FallbackStrategies: {
    /**
     * Return cached data from a Map
     * Use for read operations that can tolerate slightly stale data
     *
     * @example
     * circuitBreaker.registerFallback(
     *   FallbackStrategies.cachedData(dataCache, 'spreadsheet:123:values', 100)
     * );
     */
    cachedData: <T>(cache: Map<string, T>, key: string, priority?: number) => FallbackStrategy<T>;
    /**
     * Return degraded/partial data
     * Use when partial functionality is better than complete failure
     *
     * @example
     * circuitBreaker.registerFallback(
     *   FallbackStrategies.degradedMode({ values: [], warning: 'Using degraded mode' }, 50)
     * );
     */
    degradedMode: <T>(degradedData: T, priority?: number) => FallbackStrategy<T>;
    /**
     * Return safe default value
     * Use when empty/default response is acceptable
     *
     * @example
     * circuitBreaker.registerFallback(
     *   FallbackStrategies.safeDefault({ values: [], metadata: { fromCache: false } }, 10)
     * );
     */
    safeDefault: <T>(defaultValue: T, priority?: number) => FallbackStrategy<T>;
    /**
     * Retry with exponential backoff
     * Use for transient failures that may resolve quickly
     *
     * @example
     * circuitBreaker.registerFallback(
     *   FallbackStrategies.retryWithBackoff(operation, 3, 1000, 80)
     * );
     */
    retryWithBackoff: <T>(operation: () => Promise<T>, maxRetries?: number, baseDelayMs?: number, priority?: number) => FallbackStrategy<T>;
    /**
     * Use alternate data source
     * Use when multiple data sources are available
     *
     * @example
     * circuitBreaker.registerFallback(
     *   FallbackStrategies.alternateSource(backupApiCall, 90)
     * );
     */
    alternateSource: <T>(alternateOperation: () => Promise<T>, priority?: number) => FallbackStrategy<T>;
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
    readOnlyMode: <T>(readOnlyResponse: T, priority?: number) => FallbackStrategy<T>;
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
//# sourceMappingURL=circuit-breaker.d.ts.map