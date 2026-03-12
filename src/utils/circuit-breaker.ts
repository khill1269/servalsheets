/**
 * ServalSheets - Circuit Breaker
 *
 * Google Sheets-specific circuit breaker wrapper over @serval/core's
 * platform-agnostic implementation. Adds: readOnlyMode fallback strategy
 * for Google Sheets write operations.
 */

import {
  CircuitBreaker,
  CircuitBreakerError,
  FallbackStrategies as CoreFallbackStrategies,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
  type CircuitState,
  type FallbackStrategy,
} from '@serval/core';

// Re-export types and classes so callers don't need to change imports
export {
  CircuitBreaker,
  CircuitBreakerError,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
  type CircuitState,
  type FallbackStrategy,
};

/**
 * Extended fallback strategies including Google Sheets-specific strategies.
 *
 * Extends serval-core's FallbackStrategies with:
 * - readOnlyMode: Returns a degraded response for failed write operations
 */
export const FallbackStrategies = {
  ...CoreFallbackStrategies,

  /**
   * Return read-only mode response.
   * Use when write operations fail but read operations still work.
   *
   * shouldUse() uses code-based classification instead of text-based message
   * inspection. Permanent failures (PERMISSION_DENIED, UNAUTHENTICATED,
   * SPREADSHEET_NOT_FOUND, INVALID_ARGUMENT) do NOT enter read-only mode —
   * those require manual intervention, not degraded retries. Transient errors
   * (rate limits, server errors, unknown) DO enter read-only mode.
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
    execute: async () => readOnlyResponse,
    shouldUse: (error: Error) => {
      // Code-based classification: permanent errors do not trigger read-only mode
      const NON_RETRYABLE_FOR_CIRCUIT_BREAKER = new Set([
        'PERMISSION_DENIED',
        'UNAUTHENTICATED',
        'SPREADSHEET_NOT_FOUND',
        'INVALID_ARGUMENT',
      ]);
      const errorCode = (error as Error & { errorCode?: string }).errorCode ?? '';
      // Only permanent, non-retryable codes skip read-only mode.
      // All other errors (transient, unknown) may benefit from read-only degradation.
      return !NON_RETRYABLE_FOR_CIRCUIT_BREAKER.has(errorCode);
    },
  }),
};
