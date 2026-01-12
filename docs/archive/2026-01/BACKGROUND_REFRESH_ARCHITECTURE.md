# Background Refresh Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Background Refresh System                        │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│  User Request    │
│  (API Call)      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐      Cache Hit      ┌──────────────────┐
│  Cache Manager   │◄────────────────────┤   Cache Store    │
│  (Check Cache)   │                     │   (In-Memory)    │
└────────┬─────────┘                     └──────────────────┘
         │
         │ Cache Miss
         ▼
┌──────────────────┐
│  Google Sheets   │
│  API Call        │
└────────┬─────────┘
         │
         │ Store Result
         ▼
┌──────────────────┐
│  Cache Manager   │
│  (Set Cache)     │
└────────┬─────────┘
         │
         │ Track Metadata
         ▼
┌──────────────────┐
│  Prefetch System │
│  (Metadata Map)  │
└──────────────────┘

═══════════════════════════════════════════════════════════════════════════

                        Background Refresh Loop
                        (Every 30 seconds)

┌──────────────────┐
│   Timer Tick     │
│   (30s interval) │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    refreshExpiringSoon()                                 │
│  1. Get expiring entries from cache manager                              │
│  2. Convert cache keys to refresh tasks                                  │
│  3. Sort by priority (hot data first)                                    │
│  4. Queue refresh tasks                                                  │
└────────┬─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    Cache Manager.getExpiringEntries()                    │
│  • Check "prefetch" namespace                                            │
│  • Check "spreadsheet" namespace                                         │
│  • Return entries expiring within threshold (60s)                        │
└────────┬─────────────────────────────────────────────────────────────────┘
         │
         │ Expiring Entries List
         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    createRefreshTask()                                   │
│  For each expiring entry:                                                │
│  1. Look up metadata (spreadsheetId, range, access count)                │
│  2. Calculate priority (frequency + recency + urgency)                   │
│  3. Create RefreshTask object                                            │
└────────┬─────────────────────────────────────────────────────────────────┘
         │
         │ RefreshTask[]
         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    Priority Sorting                                      │
│  Sort by priority (0-10):                                                │
│  • 10: Hot data expiring soon (high frequency, recent, urgent)           │
│  • 5-9: Warm data                                                        │
│  • 1-4: Cold data (low frequency, old, not urgent)                       │
└────────┬─────────────────────────────────────────────────────────────────┘
         │
         │ Sorted RefreshTask[]
         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    PQueue (Priority Queue)                               │
│  • Concurrency: 2 (configurable)                                         │
│  • Higher priority tasks execute first                                   │
│  • Non-blocking (background operation)                                   │
└────────┬─────────────────────────────────────────────────────────────────┘
         │
         ▼
    ┌────────────────────────────────────────────┐
    │                                            │
    ▼                                            ▼
┌──────────────────┐                  ┌──────────────────┐
│  Worker 1        │                  │  Worker 2        │
│  refreshCacheEnt │                  │  refreshCacheEnt │
└────────┬─────────┘                  └────────┬─────────┘
         │                                     │
         ▼                                     ▼
┌──────────────────┐                  ┌──────────────────┐
│  Google Sheets   │                  │  Google Sheets   │
│  API Call        │                  │  API Call        │
│  (Fetch Fresh)   │                  │  (Fetch Fresh)   │
└────────┬─────────┘                  └────────┬─────────┘
         │                                     │
         ▼                                     ▼
┌──────────────────┐                  ┌──────────────────┐
│  Update Cache    │                  │  Update Cache    │
│  (Fresh Data)    │                  │  (Fresh Data)    │
└────────┬─────────┘                  └────────┬─────────┘
         │                                     │
         ▼                                     ▼
┌──────────────────┐                  ┌──────────────────┐
│  Update Stats    │                  │  Update Stats    │
│  successfulRefres │                  │  successfulRefres │
└──────────────────┘                  └──────────────────┘
```

## Priority Calculation Algorithm

```
Priority = min(10, FrequencyScore + RecencyScore + UrgencyScore)

┌─────────────────────────────────────────────────────────────────────┐
│                      Frequency Score (0-5)                          │
├─────────────────────────────────────────────────────────────────────┤
│  Access Count:  1    2    3    4    5+                              │
│  Score:         1    2    3    4    5                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      Recency Score (0-3)                            │
├─────────────────────────────────────────────────────────────────────┤
│  Last Access:   <1min  <5min  <10min  >10min                        │
│  Score:         3      2      1        0                            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      Urgency Score (0-2)                            │
├─────────────────────────────────────────────────────────────────────┤
│  Expires In:    <30s   <60s   <120s   >120s                         │
│  Score:         2      1      0.5     0                             │
└─────────────────────────────────────────────────────────────────────┘

Example Calculations:
─────────────────────────────────────────────────────────────────────
Hot Data (Priority 10):
  • Accessed 10+ times (score: 5)
  • Last accessed 30s ago (score: 3)
  • Expires in 45s (score: 2)
  • Total: min(10, 5+3+2) = 10

Warm Data (Priority 6):
  • Accessed 3 times (score: 3)
  • Last accessed 2 min ago (score: 2)
  • Expires in 90s (score: 1)
  • Total: min(10, 3+2+1) = 6

Cold Data (Priority 1):
  • Accessed 1 time (score: 1)
  • Last accessed 15 min ago (score: 0)
  • Expires in 3 min (score: 0)
  • Total: min(10, 1+0+0) = 1
```

## Cache Key Parsing Logic

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Cache Key Formats                              │
└─────────────────────────────────────────────────────────────────────┘

Format 1: Values Range
────────────────────────────────────────────────────────────────────
Input:  spreadsheetId:range="A1:B10"&type="values"
Output: { spreadsheetId, range: "A1:B10" }

Format 2: Comprehensive Metadata
────────────────────────────────────────────────────────────────────
Input:  spreadsheet:comprehensive:spreadsheetId="1234"
Output: { spreadsheetId: "1234", comprehensive: true }

Format 3: Basic Metadata
────────────────────────────────────────────────────────────────────
Input:  spreadsheetId:type="metadata"
Output: { spreadsheetId, comprehensive: true }

Parsing Steps:
┌─────────────────────────────────────────────────────────────────────┐
│  1. Remove namespace prefix (if present)                            │
│     "prefetch:..." → "..."                                          │
├─────────────────────────────────────────────────────────────────────┤
│  2. Check for comprehensive pattern                                 │
│     "spreadsheet:comprehensive" → comprehensive: true               │
├─────────────────────────────────────────────────────────────────────┤
│  3. Parse key-value pairs                                           │
│     Split by "&", then by "="                                       │
│     Remove JSON quotes from values                                  │
├─────────────────────────────────────────────────────────────────────┤
│  4. Extract spreadsheetId                                           │
│     From params or first part of key                                │
├─────────────────────────────────────────────────────────────────────┤
│  5. Return parsed object or null                                    │
└─────────────────────────────────────────────────────────────────────┘
```

## Metadata Tracking

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RefreshMetadata Storage                          │
├─────────────────────────────────────────────────────────────────────┤
│  Map<cacheKey, RefreshMetadata>                                     │
│                                                                     │
│  Max Size: 1000 entries                                             │
│  Eviction: LRU (Least Recently Used)                                │
│                                                                     │
│  Each Entry Contains:                                               │
│  • spreadsheetId: string                                            │
│  • range?: string                                                   │
│  • comprehensive?: boolean                                          │
│  • lastAccessed: timestamp                                          │
│  • accessCount: number                                              │
└─────────────────────────────────────────────────────────────────────┘

Lifecycle:
──────────────────────────────────────────────────────────────────────
1. Created: When prefetch completes
2. Updated: On cache hit (via markPrefetchHit)
3. Used: To calculate refresh priority
4. Evicted: When map exceeds 1000 entries (remove oldest 100)

Access Tracking:
──────────────────────────────────────────────────────────────────────
executePrefetch() → trackRefreshMetadata() → Initial entry
     ↓
Cache Hit → markPrefetchHit() → Increment accessCount
     ↓                           Update lastAccessed
refreshCacheEntry() → Use metadata → Calculate priority
     ↓
LRU Eviction → Remove oldest entries → Keep size ≤ 1000
```

## Namespace Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Cache Namespaces                             │
└─────────────────────────────────────────────────────────────────────┘

"prefetch" namespace:
────────────────────────────────────────────────────────────────────
• Value ranges (A1:B10)
• Basic spreadsheet metadata
• TTL: Variable (default 5 min)

"spreadsheet" namespace:
────────────────────────────────────────────────────────────────────
• Comprehensive metadata (all sheets, charts, formats, rules)
• Used by analysis operations
• TTL: 5 minutes

Background refresh monitors BOTH namespaces:
────────────────────────────────────────────────────────────────────
getExpiringEntries(threshold, "prefetch")
getExpiringEntries(threshold, "spreadsheet")
```

## Performance Characteristics

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Performance Profile                          │
└─────────────────────────────────────────────────────────────────────┘

Time Complexity:
────────────────────────────────────────────────────────────────────
• getExpiringEntries:     O(n) where n = cache entries
• createRefreshTask:      O(1) lookup in metadata map
• calculateRefreshPrioty: O(1) arithmetic operations
• parseCacheKey:          O(m) where m = key length
• Priority sorting:       O(k log k) where k = expiring entries

Space Complexity:
────────────────────────────────────────────────────────────────────
• Metadata storage:       O(1000) = ~100KB max
• Expiring entries list:  O(k) where k = entries expiring
• Refresh task queue:     O(k) temporary

Latency:
────────────────────────────────────────────────────────────────────
• Detection cycle:        30 seconds (configurable)
• Refresh threshold:      60 seconds before expiry
• API call latency:       100-500ms (Google Sheets API)
• Cache update:           O(1)

Throughput:
────────────────────────────────────────────────────────────────────
• Concurrent refreshes:   2 (configurable)
• Refresh rate:           Up to 4 per minute (2 workers × 30s cycle)
• No impact on user ops:  Background queue, separate priority
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Error Handling                               │
└─────────────────────────────────────────────────────────────────────┘

refreshExpiringSoon() catches all errors
     ↓
     ├─ getExpiringEntries() fails
     │      → Log warning, skip cycle
     │
     ├─ createRefreshTask() returns null
     │      → Skip task, continue with others
     │
     └─ refreshCacheEntry() throws error
            ↓
            ├─ API call fails (rate limit, network, auth)
            │      → Increment failedRefreshes
            │      → Log debug message
            │      → Cache entry expires naturally
            │
            ├─ Cache update fails
            │      → Increment failedRefreshes
            │      → Log warning
            │
            └─ Parse error
                   → Increment failedRefreshes
                   → Log debug with cache key

Graceful Degradation:
────────────────────────────────────────────────────────────────────
• Single refresh failure → Other refreshes continue
• All refreshes fail → Cache expires normally, re-fetch on next access
• API unavailable → System backs off, tries again in 30s
• No impact on user operations → User requests always served
```

## Metrics Dashboard View

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Prefetch & Refresh Metrics                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Prefetch Statistics:                                               │
│  ├─ Total Prefetches:      1,234                                    │
│  ├─ Successful:            1,200 (97.2%)                            │
│  ├─ Failed:                34 (2.8%)                                │
│  └─ Cache Hits:            890 (72.1% hit rate)                     │
│                                                                     │
│  Background Refresh Statistics:                                     │
│  ├─ Total Refreshes:       156                                      │
│  ├─ Successful:            152 (97.4%)                              │
│  ├─ Failed:                4 (2.6%)                                 │
│  └─ Refresh Hit Rate:      97.4%                                    │
│                                                                     │
│  System Health:                                                     │
│  ├─ Metadata Entries:      847 / 1000                               │
│  ├─ Cache Entries:         423                                      │
│  ├─ Queue Size:            2 / 2 workers busy                       │
│  └─ Last Refresh Cycle:    12 seconds ago                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Usage:
────────────────────────────────────────────────────────────────────
const stats = prefetchSystem.getStats();
console.log(`Refresh success: ${stats.refreshHitRate}%`);
console.log(`Total: ${stats.totalRefreshes}`);
```
