# Background Refresh - Quick Reference

## What is it?

A proactive cache refresh system that automatically refreshes cache entries before they expire, eliminating latency spikes from cache misses.

## How it works

```
┌─────────────┐
│ User Access │ → Cache Hit → Fast Response
└─────────────┘

┌─────────────────────────────────────────────────┐
│ Background (every 30s):                         │
│ 1. Detect entries expiring within 60s           │
│ 2. Prioritize by hotness (access frequency)     │
│ 3. Refresh hot data before expiry               │
│ 4. Update cache with fresh data                 │
└─────────────────────────────────────────────────┘

Result: Zero cache misses on hot paths
```

## Quick Start

### Enable Background Refresh

Background refresh is **enabled by default**. To configure:

```typescript
// Via environment variables
PREFETCH_BACKGROUND_REFRESH=true
PREFETCH_CONCURRENCY=2

// Or via constructor
const prefetchSystem = new PrefetchingSystem(sheetsApi, {
  backgroundRefresh: true,
  refreshThreshold: 60000,  // 60 seconds before expiry
  concurrency: 2
});
```

### Monitor Refresh Status

```typescript
const stats = prefetchSystem.getStats();

console.log(`Refresh success rate: ${stats.refreshHitRate}%`);
console.log(`Total refreshes: ${stats.totalRefreshes}`);
console.log(`Successful: ${stats.successfulRefreshes}`);
console.log(`Failed: ${stats.failedRefreshes}`);
```

### Track Access Patterns

```typescript
// Automatically tracked when using cache
prefetchSystem.markPrefetchHit(cacheKey);

// The system uses this to prioritize refreshes
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `backgroundRefresh` | `true` | Enable/disable background refresh |
| `refreshThreshold` | `60000` | Refresh when entry expires within this time (ms) |
| `concurrency` | `2` | Max concurrent refresh operations |
| `enabled` | `true` | Enable/disable entire prefetch system |

## Priority Algorithm

The system calculates refresh priority (0-10) based on:

### Frequency Score (0-5)
```
Access Count:  1    2    3    4    5+
Score:         1    2    3    4    5
```

### Recency Score (0-3)
```
Last Access:   <1min  <5min  <10min  >10min
Score:         3      2      1       0
```

### Urgency Score (0-2)
```
Expires In:    <30s   <60s   <120s   >120s
Score:         2      1      0.5     0
```

### Total Priority
```
Priority = min(10, Frequency + Recency + Urgency)
```

## Examples

### Hot Data (Priority 10)
```typescript
// Accessed 10 times, last access 30s ago, expires in 45s
Frequency: 5 + Recency: 3 + Urgency: 2 = 10
→ Refreshed immediately
```

### Warm Data (Priority 6)
```typescript
// Accessed 3 times, last access 2 min ago, expires in 90s
Frequency: 3 + Recency: 2 + Urgency: 1 = 6
→ Refreshed after hot data
```

### Cold Data (Priority 1)
```typescript
// Accessed 1 time, last access 15 min ago, expires in 3 min
Frequency: 1 + Recency: 0 + Urgency: 0 = 1
→ Refreshed last (if at all)
```

## Metrics Dashboard

```typescript
const stats = prefetchSystem.getStats();

// Prefetch metrics
stats.totalPrefetches      // Total prefetch operations
stats.successfulPrefetches // Successful prefetches
stats.failedPrefetches     // Failed prefetches
stats.cacheHitsFromPrefetch // Cache hits from prefetched data
stats.prefetchHitRate      // % of prefetches that were used

// Refresh metrics (NEW)
stats.totalRefreshes       // Total background refreshes
stats.successfulRefreshes  // Successful refreshes
stats.failedRefreshes      // Failed refreshes
stats.refreshHitRate       // % of successful refreshes
```

## Troubleshooting

### Low Refresh Success Rate (<90%)

**Possible causes:**
- API rate limiting
- Network issues
- Auth token expiry

**Solution:**
```typescript
// Check failed refresh count
const stats = prefetchSystem.getStats();
if (stats.refreshHitRate < 90) {
  console.warn('Low refresh success rate:', stats.failedRefreshes);
  // Check logs for specific errors
}
```

### High Memory Usage

**Check metadata size:**
```typescript
// Metadata is automatically limited to 1000 entries
// If concerned, monitor cache size
const cacheStats = cacheManager.getStats();
console.log('Cache entries:', cacheStats.totalEntries);
console.log('Cache size:', cacheStats.totalSize / 1024 / 1024, 'MB');
```

### Refresh Not Triggering

**Check configuration:**
```typescript
// 1. Verify background refresh is enabled
const system = getPrefetchingSystem();
// Check logs for "Background refresh started"

// 2. Check if entries are expiring
const expiring = cacheManager.getExpiringEntries(60000);
console.log('Expiring entries:', expiring.length);

// 3. Verify prefetch system is initialized
if (!system) {
  console.error('Prefetch system not initialized');
}
```

## Performance Impact

| Metric | Impact |
|--------|--------|
| CPU | Negligible (30s check interval) |
| Memory | ~100KB (1000 entries max) |
| Network | Only for expiring entries |
| Latency | Zero (background operation) |
| User Operations | No impact (separate queue) |

## Best Practices

### 1. Monitor Metrics Regularly
```typescript
setInterval(() => {
  const stats = prefetchSystem.getStats();
  if (stats.refreshHitRate < 95) {
    console.warn('Refresh success rate dropped:', stats);
  }
}, 300000); // Every 5 minutes
```

### 2. Track Access Patterns
```typescript
// Always mark cache hits
if (cached) {
  prefetchSystem.markPrefetchHit(cacheKey);
  return cached;
}
```

### 3. Use Appropriate TTLs
```typescript
// Shorter TTL for frequently changing data
cacheManager.set(key, data, {
  ttl: 60000,  // 1 minute
  namespace: 'prefetch'
});

// Longer TTL for stable data
cacheManager.set(key, data, {
  ttl: 300000, // 5 minutes
  namespace: 'spreadsheet'
});
```

### 4. Configure Refresh Threshold Appropriately
```typescript
// For high-frequency data: longer threshold
refreshThreshold: 120000, // Refresh 2 min before expiry

// For low-frequency data: shorter threshold
refreshThreshold: 30000,  // Refresh 30s before expiry
```

## Logging

Enable debug logging to see refresh activity:

```typescript
// Set LOG_LEVEL=debug in environment
LOG_LEVEL=debug

// You'll see logs like:
// "Background refresh: expiring entries detected"
// "Refreshing cache entry"
// "Cache entry refreshed"
```

## Common Patterns

### Pattern 1: High-Priority Data
```typescript
// Frequently accessed data is automatically prioritized
// No special configuration needed
await prefetchSystem.prefetchOnOpen(spreadsheetId);
```

### Pattern 2: Manual Priority Boost
```typescript
// Mark data as frequently accessed
for (let i = 0; i < 5; i++) {
  prefetchSystem.markPrefetchHit(cacheKey);
}
// This entry will now have higher refresh priority
```

### Pattern 3: Monitor Hot Paths
```typescript
// Track which entries are being refreshed
const stats = prefetchSystem.getStats();
const refreshRate = stats.totalRefreshes / stats.totalPrefetches;
console.log('Refresh rate:', refreshRate);
// Higher rate = more entries staying hot
```

## FAQ

### Q: Does background refresh make API calls?
**A:** Yes, but only for entries approaching expiry. It doesn't refresh all cached data.

### Q: What happens if a refresh fails?
**A:** The cache entry expires normally, and the next user request re-fetches the data. No data loss.

### Q: Can I disable background refresh?
**A:** Yes, set `PREFETCH_BACKGROUND_REFRESH=false` or pass `backgroundRefresh: false` to constructor.

### Q: How do I know if it's working?
**A:** Check `stats.totalRefreshes > 0` and `stats.refreshHitRate > 95%`.

### Q: Does it work with Redis cache?
**A:** Yes, it works with both in-memory and Redis cache backends.

### Q: What's the overhead?
**A:** ~100KB memory, negligible CPU, only API calls for expiring entries.

## Related Documentation

- **Implementation Details:** [BACKGROUND_REFRESH_IMPLEMENTATION.md](./BACKGROUND_REFRESH_IMPLEMENTATION.md)
- **Architecture Diagrams:** [BACKGROUND_REFRESH_ARCHITECTURE.md](./BACKGROUND_REFRESH_ARCHITECTURE.md)
- **Complete Report:** [AGENT_TEAM_2D_COMPLETE.md](./AGENT_TEAM_2D_COMPLETE.md)
- **Test Coverage:** [tests/unit/background-refresh.test.ts](./tests/unit/background-refresh.test.ts)

## Support

For issues or questions:
1. Check logs with `LOG_LEVEL=debug`
2. Monitor metrics via `getStats()`
3. Review test cases for examples
4. See architecture documentation for deep dive
