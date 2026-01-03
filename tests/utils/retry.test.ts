/**
 * ServalSheets v4 - Retry Utility Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeWithRetry } from '../../src/utils/retry.js';

describe('executeWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries on retryable errors and succeeds', async () => {
    let attempts = 0;
    const op = vi.fn().mockImplementation(() => {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error('rate limit');
        (error as unknown as { response: { status: number } }).response = { status: 429 };
        return Promise.reject(error);
      }
      return Promise.resolve('ok');
    });

    const promise = executeWithRetry((signal) => op(signal), {
      maxRetries: 3,
      baseDelayMs: 10,
      maxDelayMs: 10,
      jitterRatio: 0,
      timeoutMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(20);
    await expect(promise).resolves.toBe('ok');
    expect(attempts).toBe(3);
  });
});
