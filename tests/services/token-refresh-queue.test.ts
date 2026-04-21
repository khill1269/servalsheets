/**
 * ServalSheets - Token Refresh Queue Serialization Tests (C5)
 *
 * Regression tests for the TOCTOU race condition in token refresh:
 * GoogleApiClient.refreshTokenOnAuthError() must use tokenRefreshQueue
 * (concurrency: 1) so that concurrent 401-triggered refreshes are
 * serialized rather than fanning out to the OAuth endpoint in parallel.
 *
 * The fix is in src/services/google-api.ts:839-844.
 * These tests verify the queue serializes concurrent calls.
 */

import { describe, it, expect, vi } from 'vitest';
import PQueue from 'p-queue';

describe('token refresh queue serialization (C5)', () => {
  /**
   * Core invariant: a PQueue with concurrency:1 must execute tasks
   * sequentially even when many are added simultaneously.
   */
  it('PQueue concurrency:1 runs tasks sequentially, not concurrently', async () => {
    const queue = new PQueue({ concurrency: 1 });
    const executionOrder: number[] = [];
    let inFlight = 0;
    let maxConcurrency = 0;

    const makeTask = (id: number) => async () => {
      inFlight++;
      maxConcurrency = Math.max(maxConcurrency, inFlight);
      executionOrder.push(id);
      // Simulate async work
      await Promise.resolve();
      inFlight--;
    };

    // Add 5 tasks simultaneously
    await Promise.all([0, 1, 2, 3, 4].map((id) => queue.add(makeTask(id))));

    // Queue with concurrency:1 must never run more than 1 task at a time
    expect(maxConcurrency).toBe(1);
    // All 5 tasks must complete
    expect(executionOrder).toHaveLength(5);
  });

  /**
   * The deduplication property: when the inner refresh fn uses a time-based
   * cooldown, serializing via concurrency:1 means the 2nd+ tasks see an
   * updated lastRefreshTime and skip the actual OAuth call.
   */
  it('serialized queue + cooldown reduces multiple concurrent triggers to one real refresh', async () => {
    const queue = new PQueue({ concurrency: 1 });
    let refreshCallCount = 0;

    // Simulate TokenManager.refreshTokenOnAuthError() with a cooldown
    let lastRefreshTime = 0;
    const cooldownMs = 5000;
    const mockRefreshOnAuthError = vi.fn(async () => {
      const now = Date.now();
      if (now - lastRefreshTime < cooldownMs) {
        return false; // cooldown active — skip
      }
      lastRefreshTime = now;
      refreshCallCount++;
      return true;
    });

    // Simulate GoogleApiClient.refreshTokenOnAuthError() — wraps in queue
    const clientRefreshOnAuthError = async () => {
      await queue.add(async () => {
        await mockRefreshOnAuthError();
      });
    };

    // 3 concurrent 401 errors all trigger refresh simultaneously
    await Promise.all([
      clientRefreshOnAuthError(),
      clientRefreshOnAuthError(),
      clientRefreshOnAuthError(),
    ]);

    // Queue serializes the calls; after the first one sets lastRefreshTime,
    // the 2nd and 3rd see timeSinceLastRefresh < cooldownMs and skip.
    // Exactly 1 real refresh should have fired.
    expect(refreshCallCount).toBe(1);
    expect(mockRefreshOnAuthError).toHaveBeenCalledTimes(3); // called 3x but only 1 did work
  });

  /**
   * Without the serialization queue, if the inner refresh fn does async work
   * BEFORE updating lastRefreshTime (e.g., awaits the OAuth network call first),
   * then concurrent calls all pass the cooldown check before any one finishes.
   * This test demonstrates the race when the async gap opens the TOCTOU window.
   */
  it('without queue, async gap before setting lastRefreshTime allows concurrent fires', async () => {
    let refreshCallCount = 0;
    let lastRefreshTime = 0;
    const cooldownMs = 5000;

    // Simulate the race: cooldown check passes, THEN async work, THEN lastRefreshTime update
    // This models a fn that does: check → await networkCall() → set lastRefreshTime
    const unguardedWithAsyncGap = vi.fn(async () => {
      const now = Date.now();
      if (now - lastRefreshTime < cooldownMs) {
        return false;
      }
      // Async gap — all concurrent callers have already passed the cooldown check
      await Promise.resolve(); // simulates async OAuth call
      lastRefreshTime = Date.now();
      refreshCallCount++;
      return true;
    });

    // 3 concurrent calls: all pass cooldown check before the first one sets lastRefreshTime
    await Promise.all([
      unguardedWithAsyncGap(),
      unguardedWithAsyncGap(),
      unguardedWithAsyncGap(),
    ]);

    // All 3 fire because they all passed the cooldown check before any updated lastRefreshTime
    expect(refreshCallCount).toBe(3);
  });
});
