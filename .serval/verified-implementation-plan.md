# Verified Implementation Plan — Session 103

> All findings verified line-by-line against source code on 2026-03-24.
> Only CONFIRMED findings included. False positives eliminated.

## Verification Summary

| Original ID | Finding | Status | Notes |
|-------------|---------|--------|-------|
| C-1 | `knownSpreadsheets` unbounded | **FALSE POSITIVE** | Has 5-min TTL + delete-on-invalidate |
| C-2 | `sessionContexts` unbounded | **CONFIRMED** | No background GC; lazy TTL only |
| C-3 | TenantContext maps unbounded | **CONFIRMED** | No cleanup on any of 3 maps |
| C-4 | Connection reset race condition | **CONFIRMED** | No mutex; concurrent resets possible |
| H-1 | Task abort controller leak | **FALSE POSITIVE** | try/finally covers all paths |
| H-2 | Handler loader race | **CONFIRMED** | No Promise dedup on concurrent loads |
| H-6 | `recentFailuresByPrincipal` unbounded | **FALSE POSITIVE** | Time-windowed (5min) with active pruning |
| H-7 | ParallelExecutor no per-task timeout | **FALSE POSITIVE** | Request-level timeout inherited |
| H-9 | No P50/P95/P99 tracking | **FALSE POSITIVE** | Prometheus Summary with percentiles exists |
| H-10 | No trace propagation | **FALSE POSITIVE** | W3C traceparent + x-request-id injected |
| R-1 | Per-user rate limit missing | **FALSE POSITIVE** | user-rate-limiter.ts enforces 100 req/min |
| R-2 | Read/write quota not separated | **PARTIAL** | Separated at tenant level, not circuit breaker |
| R-3 | Retry-After not parsed | **FALSE POSITIVE** | Parsed in both wrapper and core retry |
| R-4 | Jitter formula mismatch | **CONFIRMED** | Symmetric jitter vs Google's additive |
| R-5 | No $/cancelRequest on timeout | **FALSE POSITIVE** | tasks/cancel handler implemented |
| R-6 | Elicitation state on session IDs | **FALSE POSITIVE** | Uses unique elicitationId, not sessionId |
| R-7 | No RFC 8707 resource indicators | **FALSE POSITIVE** | aud claim set to resourceIndicator |
| R-8 | No OAuth metadata discovery | **FALSE POSITIVE** | .well-known endpoints implemented |

---

## CONFIRMED FIXES (5 total)

### FIX-1: Background GC for `sessionContexts` Map
**File:** `src/services/session-context.ts`
**Lines:** 1483-1486 (declarations), 1607-1626 (getOrCreate)
**Problem:** No background sweep of expired sessions. Map grows with HTTP session churn.
**Fix:**
- Add `MAX_CONCURRENT_SESSIONS = 10_000` constant
- Add background interval (every 5 min) that sweeps expired entries
- Add size cap in `getOrCreateSessionContext()` — evict oldest-idle when at capacity

```typescript
// After line 1485, add:
const MAX_CONCURRENT_SESSIONS = 10_000;
const SESSION_GC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Background GC interval
let sessionGcInterval: NodeJS.Timeout | null = null;

function startSessionGc(): void {
  if (sessionGcInterval) return;
  sessionGcInterval = setInterval(() => {
    const now = Date.now();
    const ttlMs = getSessionTtlMs();
    let evicted = 0;
    for (const [id, mgr] of sessionContexts.entries()) {
      if (now - mgr.getState().lastActivityAt > ttlMs) {
        sessionContexts.delete(id);
        hydratedSessionContexts.delete(id);
        sessionContextHydrations.delete(id);
        evicted++;
      }
    }
    if (evicted > 0) {
      logger.info('Session GC sweep completed', {
        component: 'session-context',
        evicted,
        remaining: sessionContexts.size,
      });
    }
  }, SESSION_GC_INTERVAL_MS);
  sessionGcInterval.unref(); // Don't prevent process exit
}

// In getOrCreateSessionContext(), before creating new entry (line 1622), add:
// Cap enforcement
if (sessionContexts.size >= MAX_CONCURRENT_SESSIONS) {
  let oldestId: string | undefined;
  let oldestActivity = Date.now();
  for (const [id, mgr] of sessionContexts.entries()) {
    const activity = mgr.getState().lastActivityAt;
    if (activity < oldestActivity) {
      oldestActivity = activity;
      oldestId = id;
    }
  }
  if (oldestId) {
    sessionContexts.delete(oldestId);
    hydratedSessionContexts.delete(oldestId);
    sessionContextHydrations.delete(oldestId);
    logger.warn('Evicted oldest session to stay under cap', {
      component: 'session-context',
      evictedId: oldestId,
      mapSize: sessionContexts.size,
    });
  }
}
```

---

### FIX-2: Periodic Cleanup for TenantContext Maps
**File:** `src/services/tenant-context.ts`
**Lines:** 134-136 (declarations), 415-427 (hourly usage counter)
**Problem:** `apiKeyMap`, `hourlyUsage`, `spreadsheetAccessMap` — no periodic cleanup.
**Fix:**
- Add `cleanup()` method that prunes stale hourly windows
- Add `MAX_SPREADSHEETS_PER_TENANT` cap
- Call cleanup on a periodic interval

```typescript
// Add to TenantContextService class after line 136:
private static readonly HOURLY_RETENTION_MS = 2 * 60 * 60 * 1000; // Keep 2 hours
private static readonly MAX_SPREADSHEETS_PER_TENANT = 50_000;
private cleanupInterval: NodeJS.Timeout | null = null;

startPeriodicCleanup(): void {
  if (this.cleanupInterval) return;
  this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000); // Every hour
  this.cleanupInterval.unref();
}

cleanup(): void {
  const now = Date.now();
  let hourlyEvicted = 0;

  // Prune stale hourly usage windows
  for (const [key, entry] of this.hourlyUsage.entries()) {
    if (now - entry.windowStartMs > TenantContextService.HOURLY_RETENTION_MS) {
      this.hourlyUsage.delete(key);
      hourlyEvicted++;
    }
  }

  // Cap spreadsheet access maps
  for (const [tenantId, spreadsheets] of this.spreadsheetAccessMap.entries()) {
    if (spreadsheets.size > TenantContextService.MAX_SPREADSHEETS_PER_TENANT) {
      // Keep only the most recent entries by rebuilding
      const arr = [...spreadsheets];
      const trimmed = new Set(arr.slice(-TenantContextService.MAX_SPREADSHEETS_PER_TENANT));
      this.spreadsheetAccessMap.set(tenantId, trimmed);
    }
  }

  if (hourlyEvicted > 0) {
    logger.info('TenantContext cleanup completed', {
      component: 'tenant-context',
      hourlyEvicted,
      remainingHourly: this.hourlyUsage.size,
      tenants: this.apiKeyMap.size,
    });
  }
}

// At global instance (line 433), add:
// tenantContextService.startPeriodicCleanup();
```

---

### FIX-3: PQueue Mutex for Connection Reset
**File:** `src/services/google-api.ts`
**Lines:** 274 (flag), 708-758 (two methods)
**Problem:** `connectionResetInProgress` flag is check-then-set without synchronization. Two concurrent callers can both pass the check.
**Fix:** Replace boolean flag with PQueue(concurrency: 1), matching the existing `tokenRefreshQueue` pattern at line 360.

```typescript
// Replace line 274:
// private connectionResetInProgress = false;
// With:
private connectionResetQueue: PQueue = new PQueue({ concurrency: 1 });

// Replace resetConnectionsAfterErrors (lines 708-735):
private async resetConnectionsAfterErrors(): Promise<void> {
  if (this.connectionResetQueue.pending > 0) {
    logger.debug('Connection reset already in progress, skipping');
    return;
  }

  await this.connectionResetQueue.add(async () => {
    logger.warn('Resetting HTTP/2 connections due to consecutive errors', {
      consecutiveErrors: this.consecutiveErrors,
      lastSuccess: new Date(this.lastSuccessfulCall).toISOString(),
    });

    try {
      (await getMetrics())?.recordHttp2ConnectionReset('consecutive_errors');
      await this.resetHttpAgents();
      this.consecutiveErrors = 0;
      this.lastSuccessfulCall = Date.now();
      logger.info('HTTP/2 connections reset successfully after errors');
    } catch (error) {
      logger.error('Failed to reset connections after errors', { error });
    }
  });
}

// Replace resetOnConnectionError (lines 741-758):
public async resetOnConnectionError(): Promise<void> {
  if (this.connectionResetQueue.pending > 0) {
    return; // Already resetting
  }

  await this.connectionResetQueue.add(async () => {
    try {
      logger.warn('Resetting HTTP/2 connections due to GOAWAY error during retry');
      (await getMetrics())?.recordHttp2ConnectionReset('goaway_retry');
      await this.resetHttpAgents();
      this.consecutiveErrors = 0;
      logger.info('HTTP/2 connections reset successfully for retry');
    } catch (error) {
      logger.error('Failed to reset connections for retry', { error });
    }
  });
}
```

---

### FIX-4: Promise-Based Handler Loader Dedup
**File:** `src/handlers/index.ts`
**Lines:** 268-292 (Proxy handler)
**Problem:** Two concurrent requests for the same unloaded handler both call `loader()` — no Promise dedup.
**Fix:** Cache the loading Promise, not the result, so concurrent callers share the same in-flight load.

```typescript
// Add after line 109 (cache declaration):
const loadingPromises = {} as Partial<Record<keyof Handlers, Promise<unknown>>>;

// Replace lines 274-276:
// if (!cache[prop as keyof Handlers]) {
//   (cache as Record<string, unknown>)[prop as string] = await loader();
// }
// With:
if (!cache[prop as keyof Handlers]) {
  const key = prop as keyof Handlers;
  if (!loadingPromises[key]) {
    loadingPromises[key] = loader().then((result) => {
      (cache as Record<string, unknown>)[prop as string] = result;
      delete loadingPromises[key];
      return result;
    }).catch((err) => {
      delete loadingPromises[key];
      throw err;
    });
  }
  await loadingPromises[key];
}
```

---

### FIX-5: Jitter Formula — Google-Spec Additive Jitter
**File:** `packages/serval-core/src/safety/retry.ts`
**Lines:** 107-109
**Problem:** Symmetric jitter `backoff * jitterRatio * (Math.random() * 2 - 1)` can REDUCE delay. Google spec uses additive jitter `(2^n) + random_milliseconds` where random ≤ 1000ms.
**Fix:** Change to additive jitter that only increases delay.

```typescript
// Replace lines 107-109:
// const backoff = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
// const jitter = backoff * jitterRatio * (Math.random() * 2 - 1);
// const delay = Math.max(0, retryAfterMs ?? backoff + jitter);
// With:
const backoff = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
const jitter = Math.floor(Math.random() * Math.min(1000, backoff * jitterRatio));
const delay = Math.max(0, retryAfterMs ?? backoff + jitter);
```

This ensures jitter is always positive (0 to min(1000ms, backoff*ratio)), matching Google's spec.

---

## IMPLEMENTATION ORDER

| Order | Fix | File | Risk | Lines Changed |
|-------|-----|------|------|---------------|
| 1 | FIX-3: Connection reset mutex | google-api.ts | Medium (concurrency) | ~40 |
| 2 | FIX-4: Handler loader dedup | handlers/index.ts | Low (initialization) | ~15 |
| 3 | FIX-1: Session GC | session-context.ts | Low (additive) | ~50 |
| 4 | FIX-2: Tenant cleanup | tenant-context.ts | Low (additive) | ~40 |
| 5 | FIX-5: Jitter formula | serval-core/retry.ts | Medium (retry behavior) | ~3 |

**Total: ~148 lines changed across 5 files**
**Risk: Low-Medium (all fixes are additive or replace isolated logic)**
