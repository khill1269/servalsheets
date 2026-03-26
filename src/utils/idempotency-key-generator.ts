/**
 * Idempotency key generation and validation utilities
 * Supports request deduplication and fingerprinting
 */

import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

/**
 * Generate a new idempotency key (UUID v4)
 */
export function generateIdempotencyKey(): string {
  return randomUUID();
}

/**
 * Generate a request fingerprint from request data
 * Uses SHA-256 to create a deterministic hash
 */
export function generateRequestFingerprint(
  method: string,
  path: string,
  body?: unknown
): string {
  const data = {
    method,
    path,
    body: typeof body === 'string' ? body : JSON.stringify(body || ''),
  };

  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

/**
 * Validate idempotency key format
 * Must be UUID v4 or hex string
 */
export function validateIdempotencyKey(key: string): boolean {
  // UUID v4 format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  // Hex string format
  const hexRegex = /^[0-9a-f]{64}$/i;

  return uuidRegex.test(key) || hexRegex.test(key);
}

/**
 * Extract idempotency key from request headers
 */
export function extractIdempotencyKeyFromHeaders(
  headers: Record<string, string | string[] | undefined>
): string | undefined {
  const key =
    headers['idempotency-key'] ||
    headers['x-idempotency-key'] ||
    headers['x-request-id'];

  if (typeof key === 'string') {
    return validateIdempotencyKey(key) ? key : undefined;
  }

  if (Array.isArray(key) && key.length > 0) {
    return validateIdempotencyKey(key[0]) ? key[0] : undefined;
  }

  return undefined; // OK: Explicit empty
}
