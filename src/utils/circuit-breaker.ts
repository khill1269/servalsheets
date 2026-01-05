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
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private lastFailureTime?: number;
  private nextAttemptTime = Date.now();
  private readonly name: string;

  constructor(private config: CircuitBreakerConfig) {
    this.name = config.name ?? 'default';
  }

  /**
   * Execute operation with circuit breaker protection
   *
   * @param operation - The operation to execute
   * @param fallback - Optional fallback operation if circuit is open
   * @throws CircuitBreakerError if circuit is open and no fallback provided
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === 'open') {
      if (Date.now() < this.nextAttemptTime) {
        logger.warn('Circuit breaker is open', {
          circuit: this.name,
          state: this.state,
          retryInMs: this.nextAttemptTime - Date.now(),
        });

        if (fallback) {
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

      // If circuit just opened and fallback exists, use it
      if (this.state === 'open' && fallback) {
        logger.info('Circuit opened, using fallback', { circuit: this.name });
        return fallback();
      }

      throw error;
    }
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
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : undefined,
      nextAttempt: this.state === 'open' ? new Date(this.nextAttemptTime).toISOString() : undefined,
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
