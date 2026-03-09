/**
 * Standalone Handler Error Mapping Helper
 *
 * Provides a single function to map any thrown value to a structured ErrorDetail
 * with a valid ErrorCode enum value. Used in catch blocks of the 9 standalone
 * handlers that manage their own error handling outside BaseHandler.
 *
 * Design constraints:
 * - No new dependencies beyond existing error classes
 * - Every returned code must be a member of ErrorCodeSchema
 * - Preserves specific codes from typed errors (ValidationError, NotFoundError, etc.)
 */

import { ErrorCodes } from '../error-codes.js';
import type { ErrorDetail } from '../../schemas/shared.js';
import {
  ValidationError,
  NotFoundError,
  AuthenticationError,
  ServiceError,
  ConfigError,
} from '../../core/errors.js';
import { ServalError, CircuitBreakerError } from '@serval/core';

/**
 * Maps an unknown caught value to a structured ErrorDetail with a valid ErrorCode.
 *
 * Priority:
 * 1. Typed ServalSheets errors → use their specific code
 * 2. CircuitBreakerError → UNAVAILABLE with retryAfterMs (ISSUE-149)
 * 3. Queue-full errors → RESOURCE_EXHAUSTED with retryAfterMs (ISSUE-149)
 * 4. Generic Error → INTERNAL_ERROR, retryable=true
 * 5. Non-Error throw → INTERNAL_ERROR, String()-ified message
 */
export function mapStandaloneError(error: unknown): {
  code: ErrorDetail['code'];
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  retryAfterMs?: number;
} {
  // CircuitBreakerError → UNAVAILABLE with retryAfterMs (ISSUE-149)
  if (error instanceof CircuitBreakerError) {
    return {
      code: ErrorCodes.UNAVAILABLE,
      message: error.message,
      retryable: true,
      retryAfterMs: Math.max(0, error.nextAttemptTime - Date.now()),
    };
  }

  // Queue-full errors from ConcurrencyCoordinator → RESOURCE_EXHAUSTED with retryAfterMs (ISSUE-149)
  if (
    error instanceof Error &&
    error.message.includes('Concurrency queue full') &&
    typeof (error as Error & { retryAfterMs?: number }).retryAfterMs === 'number'
  ) {
    return {
      code: ErrorCodes.RESOURCE_EXHAUSTED,
      message: error.message,
      retryable: true,
      retryAfterMs: (error as Error & { retryAfterMs: number }).retryAfterMs,
    };
  }

  // ValidationError → VALIDATION_ERROR
  if (error instanceof ValidationError) {
    return {
      code: ErrorCodes.VALIDATION_ERROR,
      message: error.message,
      retryable: false,
    };
  }

  // NotFoundError → NOT_FOUND
  if (error instanceof NotFoundError) {
    return {
      code: ErrorCodes.NOT_FOUND,
      message: error.message,
      retryable: false,
    };
  }

  // AuthenticationError → use its own code (AUTH_ERROR or more specific)
  if (error instanceof AuthenticationError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable ?? false,
    };
  }

  // ServiceError → use its own code (SERVICE_NOT_INITIALIZED, UNAVAILABLE, etc.)
  if (error instanceof ServiceError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable ?? false,
    };
  }

  // ConfigError → CONFIG_ERROR
  if (error instanceof ConfigError) {
    return {
      code: ErrorCodes.CONFIG_ERROR,
      message: error.message,
      retryable: false,
    };
  }

  // Any other ServalError base → INTERNAL_ERROR (preserve message)
  if (error instanceof ServalError) {
    return {
      code: ErrorCodes.INTERNAL_ERROR,
      message: error.message,
      retryable: true,
    };
  }

  // Generic Error → INTERNAL_ERROR (not retryable — unknown if safe to retry)
  if (error instanceof Error) {
    return {
      code: ErrorCodes.INTERNAL_ERROR,
      message: error.message,
      retryable: false,
    };
  }

  // Non-Error throw (string, number, null, undefined, etc.)
  return {
    code: ErrorCodes.INTERNAL_ERROR,
    message: error != null ? String(error) : 'An unknown error occurred',
    retryable: false,
  };
}
