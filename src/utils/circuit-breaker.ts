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
