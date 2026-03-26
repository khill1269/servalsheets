/**
 * Idempotency Key Generator
 *
 * Generates and validates idempotency keys for request deduplication.
 * Also computes request fingerprints for caching and audit trails.
 */

import { randomUUID } from 'crypto';
import { createHash } from 'crypto';

export interface IdempotencyKeyValidation {
  valid: boolean;
  error?: string;
}

export class IdempotencyKeyGenerator {
  /**
   * Generate a UUID v4 idempotency key
   */
  static generate(): string {
    return randomUUID();
  }

  /**
   * Validate idempotency key format
   * - Length: 16-128 characters
   * - Characters: alphanumeric + hyphens
   * - Uniqueness: at least 2 unique characters
   */
  static validate(key: string): IdempotencyKeyValidation {
    if (!key) {
      return { valid: false, error: 'Idempotency key is empty' };
    }

    if (key.length < 16 || key.length > 128) {
      return { valid: false, error: 'Idempotency key must be 16-128 characters' };
    }

    if (!/^[a-zA-Z0-9\-]+$/.test(key)) {
      return { valid: false, error: 'Idempotency key must contain only alphanumeric characters and hyphens' };
    }

    const uniqueChars = new Set(key);
    if (uniqueChars.size < 2) {
      return { valid: false, error: 'Idempotency key must have at least 2 unique characters' };
    }

    return { valid: true };
  }

  /**
   * Extract idempotency key from HTTP headers
   * Checks common header names: Idempotency-Key, X-Idempotency-Key, X-Request-ID
   */
  static extractFromHeaders(headers: Record<string, string | string[] | undefined>): string | undefined {
    const headerNames = ['idempotency-key', 'x-idempotency-key', 'x-request-id'];

    for (const name of headerNames) {
      const value = headers[name] ?? headers[name.toUpperCase()];
      if (Array.isArray(value)) {
        const first = value[0]?.trim();
        if (first) return first;
      } else if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }
    }

    return undefined;
  }

  /**
   * Compute SHA-256 fingerprint of a request for caching/audit
   * Inputs: tool, action, spreadsheetId, range (if applicable)
   */
  static computeRequestFingerprint(data: Record<string, unknown>): string {
    const normalized = JSON.stringify(data, Object.keys(data).sort());
    return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }

  /**
   * Normalize idempotency key (lowercase, trim)
   */
  static normalize(key: string): string {
    return key.toLowerCase().trim();
  }
}
