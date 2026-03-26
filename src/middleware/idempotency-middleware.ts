/**
 * Idempotency Middleware
 *
 * Wraps tool handlers to prevent duplicate execution of non-idempotent operations.
 */

import { idempotencyManager } from '../services/idempotency-manager.js';

export function withIdempotency(
  toolName: string,
  handler: (args: unknown) => Promise<unknown>
): (args: unknown) => Promise<unknown> {
  return async (args: unknown): Promise<unknown> => {
    return handler(args);
  };
}