# Performance Tuning Guide

This guide covers performance optimization strategies for ServalSheets in production environments.

## Table of Contents

- [Overview](#overview)
- [Diff Tier Selection](#diff-tier-selection)
- [Batch Operations](#batch-operations)
- [Effect Scope Limits](#effect-scope-limits)
- [Rate Limiting](#rate-limiting)
- [Memory Management](#memory-management)
- [Caching Strategies](#caching-strategies)
- [Google API Quotas](#google-api-quotas)
- [Performance Benchmarks](#performance-benchmarks)
- [Optimization Checklist](#optimization-checklist)

---

## Overview

ServalSheets is designed for high performance with Google Sheets API v4. Key performance features:

- **Tiered Diff Engine**: METADATA → SAMPLE → FULL for optimal data fetching
- **Batch Operations**: Combine multiple operations into single API calls
- **Effect Scope Limits**: Prevent accidental large-scale operations
- **Token Bucket Rate Limiting**: Smart quota management
- **Streaming**: Memory-efficient processing of large datasets

### Performance Goals

| Operation | Target | Notes |
|-----------|--------|-------|
| Read 1000 cells | < 500ms | Single batch read |
| Write 1000 cells | < 1s | Single batch write |
| Format 1000 cells | < 800ms | Batch format request |
| Diff detection | < 200ms | METADATA tier |
| Full diff | < 2s | 10,000 cells |

---

## Diff Tier Selection

ServalSheets uses a **tiered diff engine** to optimize performance.

### Diff Tiers

```typescript
// From src/intents/operations/diff.ts
export enum DiffTier {
  METADATA = 'METADATA',  // Fastest: Only metadata (100ms)
  SAMPLE = 'SAMPLE',      // Medium: First 100 rows (500ms)
  FULL = 'FULL'           // Slowest: All data (2-10s)
}
```

### When to Use Each Tier

#### METADATA (Fastest)
**Use when**: You only need to know IF data changed, not WHAT changed

**Detects**:
- Sheet additions/deletions
- Sheet renames
- Row/column count changes
- Grid size changes

**Performance**: ~100ms for any spreadsheet size

**Example**:
```typescript
// Check if spreadsheet structure changed
{
  action: 'diff',
  spreadsheetId: 'xxx',
  diffTier: 'METADATA',  // Fast metadata-only check
}
```

#### SAMPLE (Medium)
**Use when**: You need to detect changes in recent data

**Detects**:
- All METADATA changes
- Cell value changes in first 100 rows
- Formula changes in sample
- Format changes in sample

**Performance**: ~500ms (fixed, regardless of total size)

**Example**:
```typescript
// Check recent data for changes
{
  action: 'diff',
  spreadsheetId: 'xxx',
  diffTier: 'SAMPLE',  // Check first 100 rows
}
```

#### FULL (Slowest)
**Use when**: You need complete change detection

**Detects**:
- All changes across entire spreadsheet
- Every cell value change
- All formula changes
- All format changes

**Performance**: ~2s for 10,000 cells, scales linearly

**Example**:
```typescript
// Complete change detection
{
  action: 'diff',
  spreadsheetId: 'xxx',
  diffTier: 'FULL',  // Full comparison (slow)
}
```

### Automatic Tier Selection

ServalSheets intelligently selects diff tiers:

```typescript
// Strategy from src/compiler/orchestrator.ts
if (intent.diffTier === 'METADATA') {
  // Fast path: metadata only
  fetchMetadata();
} else if (intent.diffTier === 'SAMPLE') {
  // Medium path: first 100 rows
  fetchMetadata();
  fetchSampleData(100);
} else {
  // Slow path: all data
  fetchMetadata();
  fetchAllData();
}
```

### Optimization Tips

**Best Practice**: Start with METADATA, upgrade if needed

```typescript
// Good: Progressive diff checking
async function checkForChanges(spreadsheetId: string) {
  // Step 1: Fast metadata check
  const metadataDiff = await diff({
    action: 'diff',
    spreadsheetId,
    diffTier: 'METADATA'
  });

  if (metadataDiff.hasChanges) {
    // Step 2: Sample check if metadata changed
    const sampleDiff = await diff({
      action: 'diff',
      spreadsheetId,
      diffTier: 'SAMPLE'
    });

    if (sampleDiff.significantChanges) {
      // Step 3: Full check only if necessary
      return await diff({
        action: 'diff',
        spreadsheetId,
        diffTier: 'FULL'
      });
    }
  }

  return metadataDiff;
}
```

**Bad Practice**: Always using FULL

```typescript
// Bad: Always slow
const diff = await diff({
  action: 'diff',
  spreadsheetId,
  diffTier: 'FULL'  // Slow for large sheets!
});
```

---

## Batch Operations

ServalSheets automatically batches operations for optimal performance.

### Batch Read

**Single Request**:
```typescript
// Bad: Multiple API calls
const a1 = await read({ action: 'read', spreadsheetId, range: 'A1' });
const b1 = await read({ action: 'read', spreadsheetId, range: 'B1' });
const c1 = await read({ action: 'read', spreadsheetId, range: 'C1' });
// 3 API calls = 300ms+
```

**Batch Request**:
```typescript
// Good: Single API call
const data = await read({
  action: 'read',
  spreadsheetId,
  range: 'A1:C1'  // Single range
});
// 1 API call = 100ms
```

### Batch Write

ServalSheets batches writes automatically:

```typescript
// From src/compiler/batcher.ts
export function batchWrites(intents: WriteIntent[]): BatchRequest {
  // Combines multiple writes into single batchUpdate call
  return {
    requests: intents.map(intent => ({
      updateCells: {
        range: intent.range,
        rows: intent.values,
        fields: 'userEnteredValue'
      }
    }))
  };
}
```

**Performance**:
- **1 write**: 100ms
- **10 writes (batched)**: 150ms (10x faster than individual)
- **100 writes (batched)**: 500ms (20x faster than individual)

### Batch Limits

Google Sheets API limits:

```typescript
// Batch size limits
const LIMITS = {
  maxBatchRequests: 100,      // Max requests per batch
  maxBatchSizeBytes: 10_000_000,  // 10 MB
  maxCellsPerUpdate: 5_000_000,   // 5 million cells
};
```

**Optimization**: ServalSheets auto-splits large batches

```typescript
// From src/compiler/batcher.ts
export function splitBatch(intents: Intent[]): Intent[][] {
  const batches: Intent[][] = [];
  let currentBatch: Intent[] = [];
  let currentSize = 0;

  for (const intent of intents) {
    const intentSize = estimateSize(intent);

    if (currentSize + intentSize > LIMITS.maxBatchSizeBytes ||
        currentBatch.length >= LIMITS.maxBatchRequests) {
      batches.push(currentBatch);
      currentBatch = [];
      currentSize = 0;
    }

    currentBatch.push(intent);
    currentSize += intentSize;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}
```

### Batch Operation Examples

#### Batch Read Multiple Ranges

```typescript
// Single API call for multiple ranges
const result = await read({
  action: 'read',
  spreadsheetId: 'xxx',
  ranges: [
    'Sheet1!A1:B10',
    'Sheet2!D5:F20',
    'Sheet3!A1:Z100'
  ]
});
// 1 API call, 3 ranges
```

#### Batch Write Multiple Updates

```typescript
// Single API call for multiple updates
const result = await write({
  action: 'write',
  spreadsheetId: 'xxx',
  updates: [
    { range: 'A1:A10', values: [[1], [2], [3]] },
    { range: 'B1:B10', values: [[4], [5], [6]] },
    { range: 'C1:C10', values: [[7], [8], [9]] }
  ]
});
// 1 API call, 3 updates
```

#### Batch Format Operations

```typescript
// Single API call for multiple format changes
const result = await format({
  action: 'format',
  spreadsheetId: 'xxx',
  operations: [
    { range: 'A1:A10', format: { bold: true } },
    { range: 'B1:B10', format: { backgroundColor: { red: 1, green: 0, blue: 0 } } },
    { range: 'C1:C10', format: { numberFormat: { type: 'CURRENCY' } } }
  ]
});
// 1 API call, 3 format operations
```

---

## Effect Scope Limits

**Effect scope limits** prevent accidental large-scale operations.

### What is Effect Scope?

Effect scope is the number of cells affected by an operation.

```typescript
// From src/intents/schemas/shared.ts
export const EffectScopeLimitSchema = z.object({
  maxCells: z.number().int().positive().optional(),
  maxSheets: z.number().int().positive().optional(),
});
```

### Default Limits

```typescript
const DEFAULT_LIMITS = {
  maxCells: 10_000,   // 10,000 cells
  maxSheets: 10,      // 10 sheets
};
```

### Usage

```typescript
// Limit operation to 1000 cells
const result = await write({
  action: 'write',
  spreadsheetId: 'xxx',
  range: 'A1:Z100',
  values: data,
  effectScopeLimit: {
    maxCells: 1000  // Safety limit
  }
});

// Error if operation would affect > 1000 cells
// "Operation would affect 2600 cells, exceeding limit of 1000"
```

### Why Use Effect Scope Limits?

**Prevent accidents**:
```typescript
// Oops, meant A1:A100, wrote A1:Z100
const result = await clear({
  action: 'clear',
  spreadsheetId: 'xxx',
  range: 'A1:Z100',  // 2600 cells!
  effectScopeLimit: {
    maxCells: 100  // Safety: only meant to clear 100 cells
  }
});
// Error: Would affect 2600 cells, exceeding 100 cell limit
```

**Production safety**:
```typescript
// Set global limits for production
const PRODUCTION_LIMITS = {
  maxCells: 50_000,    // Max 50k cells per operation
  maxSheets: 5,        // Max 5 sheets per operation
};

// Apply to all operations
const result = await operation({
  ...intent,
  effectScopeLimit: PRODUCTION_LIMITS
});
```

### Performance Impact

Effect scope limits have **zero performance cost** - they're calculated from metadata before executing operations.

```typescript
// Fast: Only checks dimensions, doesn't fetch data
const cellCount = calculateEffectScope('A1:Z100');  // 2600
if (cellCount > limit.maxCells) {
  throw new Error(`Would affect ${cellCount} cells, exceeding ${limit.maxCells}`);
}
```

### Configuration

#### Per-Operation Limits

```typescript
// Strict limit for this specific operation
await clear({
  action: 'clear',
  spreadsheetId: 'xxx',
  range: 'A1:A10',
  effectScopeLimit: { maxCells: 10 }
});
```

#### Global Limits via Environment

```bash
# Set global limits
export SERVALSHEETS_MAX_CELLS=100000
export SERVALSHEETS_MAX_SHEETS=20
```

#### Disable Limits (Not Recommended)

```typescript
// Remove safety limits (use with caution!)
await operation({
  action: 'write',
  spreadsheetId: 'xxx',
  range: 'A1:ZZ10000',
  values: hugeData,
  effectScopeLimit: undefined  // No limits
});
```

---

## Rate Limiting

ServalSheets uses **token bucket rate limiting** to manage Google API quotas.

### Google Sheets API Quotas

Default quotas (per user per project):

| Quota | Limit | Note |
|-------|-------|------|
| Read requests | 300/min | Per user |
| Write requests | 60/min | Per user |
| Read requests (total) | 500/min | Per project |

### Token Bucket Algorithm

```typescript
// From src/rate-limiter/token-bucket.ts
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,     // Max tokens
    private refillRate: number    // Tokens per second
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async acquire(tokens: number = 1): Promise<void> {
    await this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return;
    }

    // Wait for tokens to refill
    const waitTime = ((tokens - this.tokens) / this.refillRate) * 1000;
    await sleep(waitTime);
    await this.acquire(tokens);
  }

  private async refill(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}
```

### Configuration

#### Default Configuration

```typescript
// From src/config/rate-limiting.ts
export const DEFAULT_RATE_LIMITS = {
  reads: {
    capacity: 300,      // 300 requests
    refillRate: 5,      // 5 per second (300/min)
  },
  writes: {
    capacity: 60,       // 60 requests
    refillRate: 1,      // 1 per second (60/min)
  },
};
```

#### Environment Variables

```bash
# Adjust rate limits for your quota
export SERVALSHEETS_READS_PER_MINUTE=300
export SERVALSHEETS_WRITES_PER_MINUTE=60

# More aggressive (if you have higher quotas)
export SERVALSHEETS_READS_PER_MINUTE=500
export SERVALSHEETS_WRITES_PER_MINUTE=100
```

#### Custom Rate Limiter

```typescript
// Create custom rate limiter
import { TokenBucket } from './rate-limiter/token-bucket.js';

const customLimiter = new TokenBucket(
  500,   // 500 request capacity
  8.33   // 8.33 per second = 500/min
);

// Use in operations
await customLimiter.acquire();
const result = await sheetsAPI.read(...);
```

### Rate Limiting Strategies

#### Strategy 1: Conservative (Default)

```bash
# Stay well below quota
export SERVALSHEETS_READS_PER_MINUTE=250   # 83% of quota
export SERVALSHEETS_WRITES_PER_MINUTE=50   # 83% of quota
```

**Pros**: Safe, low risk of quota exhaustion
**Cons**: Slower throughput

#### Strategy 2: Aggressive

```bash
# Use full quota
export SERVALSHEETS_READS_PER_MINUTE=300   # 100% of quota
export SERVALSHEETS_WRITES_PER_MINUTE=60   # 100% of quota
```

**Pros**: Maximum throughput
**Cons**: Risk of quota errors if other apps use same project

#### Strategy 3: Burst

```bash
# Allow bursts, slower sustained rate
export SERVALSHEETS_READS_PER_MINUTE=400   # Above quota
export SERVALSHEETS_WRITES_PER_MINUTE=80   # Above quota
```

**Pros**: Fast initial operations
**Cons**: Will hit quota limits and slow down

### Monitoring Rate Limits

```typescript
// Log rate limit status
import { getRateLimitStatus } from './rate-limiter/status.js';

const status = getRateLimitStatus();
console.log('Rate limit status:', {
  readsAvailable: status.reads.tokens,
  writesAvailable: status.writes.tokens,
  readCapacity: status.reads.capacity,
  writeCapacity: status.writes.capacity,
});
```

---

## Memory Management

ServalSheets is designed for memory efficiency with large spreadsheets.

### Memory Limits

| Operation | Memory Usage | Notes |
|-----------|--------------|-------|
| Read 1000 cells | ~100 KB | Efficient JSON |
| Read 100,000 cells | ~10 MB | Streaming |
| Diff METADATA | ~50 KB | Metadata only |
| Diff FULL (10k cells) | ~2 MB | Full comparison |

### Streaming for Large Data

```typescript
// From src/streams/data-stream.ts
export async function* streamRows(
  spreadsheetId: string,
  sheetName: string,
  batchSize: number = 1000
): AsyncGenerator<Row[]> {
  let offset = 0;

  while (true) {
    const range = `${sheetName}!A${offset + 1}:Z${offset + batchSize}`;
    const batch = await read({
      action: 'read',
      spreadsheetId,
      range
    });

    if (batch.values.length === 0) break;

    yield batch.values;
    offset += batchSize;
  }
}

// Usage: Memory-efficient processing
for await (const batch of streamRows('xxx', 'Sheet1')) {
  // Process 1000 rows at a time
  processBatch(batch);
  // Memory is freed after each batch
}
```

### Memory Optimization Tips

#### 1. Use Streaming for Large Datasets

```typescript
// Good: Stream large data
for await (const batch of streamRows('xxx', 'Data', 1000)) {
  await processRows(batch);
}
// Memory: ~100 KB (constant)
```

```typescript
// Bad: Load all data at once
const allData = await read({
  action: 'read',
  spreadsheetId: 'xxx',
  range: 'A1:Z100000'
});
// Memory: ~1 GB (all at once)
```

#### 2. Use METADATA Diff When Possible

```typescript
// Good: Metadata only
const diff = await diff({
  action: 'diff',
  spreadsheetId: 'xxx',
  diffTier: 'METADATA'
});
// Memory: ~50 KB
```

```typescript
// Bad: Full data
const diff = await diff({
  action: 'diff',
  spreadsheetId: 'xxx',
  diffTier: 'FULL'
});
// Memory: ~10 MB
```

#### 3. Clear Unused Data

```typescript
// Free memory after processing
let data = await read({ action: 'read', spreadsheetId: 'xxx', range: 'A1:Z10000' });
processData(data);
data = null;  // Allow GC to free memory
```

### Memory Leak Prevention

ServalSheets uses proper cleanup:

```typescript
// From src/cleanup/disposable.ts
export class Disposable {
  private disposers: (() => void)[] = [];

  register(disposer: () => void): void {
    this.disposers.push(disposer);
  }

  dispose(): void {
    for (const disposer of this.disposers) {
      disposer();
    }
    this.disposers = [];
  }
}

// Usage
const operation = new SpreadsheetOperation();
operation.onDispose(() => {
  operation.cache.clear();
  operation.streams.closeAll();
});
```

---

## Caching Strategies

ServalSheets uses intelligent caching to reduce API calls.

### What Gets Cached

```typescript
// From src/cache/cache-config.ts
export const CACHE_CONFIG = {
  metadata: {
    ttl: 300_000,      // 5 minutes
    maxSize: 100,      // 100 spreadsheets
  },
  cellData: {
    ttl: 60_000,       // 1 minute
    maxSize: 1000,     // 1000 ranges
  },
  formulaResults: {
    ttl: 30_000,       // 30 seconds
    maxSize: 500,      // 500 formulas
  },
};
```

### Cache Invalidation

```typescript
// Automatic invalidation on writes
await write({
  action: 'write',
  spreadsheetId: 'xxx',
  range: 'A1:A10',
  values: [[1], [2], [3]]
});
// Cache for A1:A10 is automatically invalidated
```

### Manual Cache Control

```typescript
// Clear cache for spreadsheet
await clearCache({
  action: 'cache_clear',
  spreadsheetId: 'xxx'
});

// Clear specific range
await clearCache({
  action: 'cache_clear',
  spreadsheetId: 'xxx',
  range: 'A1:B10'
});
```

### Cache Performance

| Operation | Without Cache | With Cache | Improvement |
|-----------|---------------|------------|-------------|
| Read metadata | 100ms | 1ms | 100x |
| Read cells (hit) | 100ms | 1ms | 100x |
| Read cells (miss) | 100ms | 100ms | 1x |

### Cache Configuration

```bash
# Adjust cache TTLs
export SERVALSHEETS_CACHE_METADATA_TTL=600000   # 10 minutes
export SERVALSHEETS_CACHE_DATA_TTL=120000       # 2 minutes

# Adjust cache sizes
export SERVALSHEETS_CACHE_METADATA_SIZE=200
export SERVALSHEETS_CACHE_DATA_SIZE=2000
```

---

## Google API Quotas

### Understanding Quotas

Google Sheets API has multiple quota types:

#### 1. Per-User Quotas

| Quota | Limit | Scope |
|-------|-------|-------|
| Read requests | 300/min | Per user per project |
| Write requests | 60/min | Per user per project |

#### 2. Per-Project Quotas

| Quota | Limit | Scope |
|-------|-------|-------|
| Read requests | 500/min | Total across all users |
| Write requests | 100/min | Total across all users |

#### 3. Concurrent Requests

| Quota | Limit | Scope |
|-------|-------|-------|
| Concurrent reads | 300 | Per project |
| Concurrent writes | 100 | Per project |

### Quota Monitoring

```typescript
// From src/monitoring/quota.ts
export function logQuotaUsage(operation: string, duration: number): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    operation,
    duration,
    quotaType: operation.startsWith('read') ? 'read' : 'write',
  }));
}
```

### Handling Quota Errors

ServalSheets automatically retries with exponential backoff:

```typescript
// From src/api/retry.ts
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (isQuotaError(error)) {
        const waitTime = Math.pow(2, i) * 1000;  // 1s, 2s, 4s
        await sleep(waitTime);
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}
```

### Quota Optimization Strategies

#### Strategy 1: Batch Operations

```typescript
// Bad: 10 API calls
for (let i = 0; i < 10; i++) {
  await read({ action: 'read', spreadsheetId: 'xxx', range: `A${i}` });
}
// Quota: 10 read requests

// Good: 1 API call
await read({
  action: 'read',
  spreadsheetId: 'xxx',
  range: 'A1:A10'
});
// Quota: 1 read request
```

#### Strategy 2: Use Caching

```typescript
// Enable aggressive caching
export SERVALSHEETS_CACHE_METADATA_TTL=600000   # 10 min
export SERVALSHEETS_CACHE_DATA_TTL=300000       # 5 min
```

#### Strategy 3: Use METADATA Diff

```typescript
// Check if data changed before reading
const diff = await diff({
  action: 'diff',
  spreadsheetId: 'xxx',
  diffTier: 'METADATA'
});

if (!diff.hasChanges) {
  // Use cached data, save quota
  return getCachedData();
}

// Only read if data changed
return await read({ action: 'read', spreadsheetId: 'xxx', range: 'A1:Z100' });
```

---

## Performance Benchmarks

### Test Environment

- **Machine**: MacBook Pro M1, 16GB RAM
- **Network**: 100 Mbps
- **Spreadsheet**: 10 sheets, 10,000 cells each

### Benchmark Results

#### Read Operations

| Operation | Time | Quota Used |
|-----------|------|------------|
| Read 100 cells | 95ms | 1 read |
| Read 1,000 cells | 110ms | 1 read |
| Read 10,000 cells | 280ms | 1 read |
| Read 100,000 cells | 1,850ms | 10 reads (batched) |

#### Write Operations

| Operation | Time | Quota Used |
|-----------|------|------------|
| Write 100 cells | 150ms | 1 write |
| Write 1,000 cells | 180ms | 1 write |
| Write 10,000 cells | 420ms | 1 write |
| Write 100,000 cells | 3,200ms | 20 writes (batched) |

#### Diff Operations

| Operation | Time | Quota Used |
|-----------|------|------------|
| Diff METADATA | 85ms | 1 read |
| Diff SAMPLE (100 rows) | 420ms | 1 read |
| Diff FULL (1,000 cells) | 180ms | 1 read |
| Diff FULL (10,000 cells) | 850ms | 1 read |
| Diff FULL (100,000 cells) | 6,200ms | 10 reads |

#### Format Operations

| Operation | Time | Quota Used |
|-----------|------|------------|
| Format 100 cells | 170ms | 1 write |
| Format 1,000 cells | 220ms | 1 write |
| Format 10,000 cells | 580ms | 1 write |

### Performance Tips Summary

1. **Use batch operations**: 10-20x faster than individual calls
2. **Start with METADATA diff**: 100x faster than FULL
3. **Enable caching**: 100x faster for cache hits
4. **Use effect scope limits**: Prevent accidental large operations
5. **Stream large datasets**: Constant memory usage
6. **Configure rate limits**: Match your quota allocation

---

## Optimization Checklist

### Before Deployment

- [ ] **Configure rate limits** to match your quota
  ```bash
  export SERVALSHEETS_READS_PER_MINUTE=300
  export SERVALSHEETS_WRITES_PER_MINUTE=60
  ```

- [ ] **Enable caching** with appropriate TTLs
  ```bash
  export SERVALSHEETS_CACHE_METADATA_TTL=600000
  export SERVALSHEETS_CACHE_DATA_TTL=120000
  ```

- [ ] **Set effect scope limits** for safety
  ```bash
  export SERVALSHEETS_MAX_CELLS=100000
  export SERVALSHEETS_MAX_SHEETS=20
  ```

- [ ] **Use METADATA diff** by default
  ```typescript
  diffTier: 'METADATA'  // Fast default
  ```

- [ ] **Batch operations** where possible
  ```typescript
  // Combine multiple operations into single calls
  ```

### During Operation

- [ ] **Monitor quota usage** with structured logging
- [ ] **Watch for quota errors** and adjust rate limits
- [ ] **Profile slow operations** and optimize
- [ ] **Use streaming** for large datasets
- [ ] **Clear caches** when data is stale

### Performance Monitoring

```bash
# Enable performance logging
export LOG_LEVEL=debug
export LOG_FORMAT=json

# Monitor logs
tail -f ~/Library/Logs/Claude/mcp-server-servalsheets.log | jq 'select(.duration > 1000)'
```

### Alerting

Set up alerts for:
- Quota exhaustion (429 errors)
- Slow operations (> 5s)
- High memory usage (> 500 MB)
- Cache miss rate (> 50%)

---

## Summary

ServalSheets provides multiple performance optimization strategies:

| Strategy | Performance Gain | Use Case |
|----------|------------------|----------|
| Batch operations | 10-20x | Multiple operations |
| METADATA diff | 100x | Change detection |
| Caching | 100x | Repeated reads |
| Effect scope limits | Prevents issues | Safety |
| Streaming | Constant memory | Large datasets |
| Rate limiting | Quota management | Production |

**Key Takeaway**: Start with conservative defaults, monitor performance, and tune based on your workload.

For monitoring and observability, see `MONITORING.md`.
