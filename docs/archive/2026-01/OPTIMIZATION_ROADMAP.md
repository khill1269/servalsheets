# ServalSheets Optimization Roadmap

## Current State Analysis

### ✅ Already Implemented
1. **Request Deduplication** - 30-50% API savings
2. **Request Merger** - 20-40% read savings (50ms window)
3. **Cache Manager** - Range-based invalidation, 5min TTL
4. **Circuit Breaker** - Fallback strategies
5. **Lazy Handler Loading** - Proxy-based

### 🔴 Critical Optimization Opportunities

## Phase 1: Schema Optimization (High Impact)

### Problem
Zod parsing is expensive. Every tool call parses the entire discriminated union schema.

### Solution: Pre-compiled Schema Validation

```typescript
// Before: Full Zod parse every call
const result = SheetsValuesInputSchema.parse(input);

// After: Type-narrowed fast path
function validateValuesInput(input: unknown): SheetsValuesInput {
  const obj = input as Record<string, unknown>;
  const action = obj.action as string;
  
  // Fast path: validate only fields for this action
  switch (action) {
    case 'read':
      return validateReadInput(obj);
    case 'write':
      return validateWriteInput(obj);
    // ... etc
  }
}
```

### Files to Update
- All 25+ schema files in `/src/schemas/`
- Create `/src/schemas/validators.ts` for fast-path validators

---

## Phase 2: Handler Optimization (High Impact)

### 2.1 Reduce Async Overhead

**Problem**: Unnecessary async/await chains
**Solution**: Use synchronous paths where possible

```typescript
// Before
async handle(input) {
  const req = await this.inferRequestParameters(input);
  const result = await this.executeAction(req);
  return result;
}

// After
handle(input) {
  // inferRequestParameters is synchronous
  const req = this.inferRequestParameters(input);
  return this.executeAction(req);
}
```

### 2.2 Inline Hot Paths

**Problem**: Virtual method dispatch overhead
**Solution**: Inline frequently-called operations

### 2.3 Optimize Context Tracking

**Problem**: `trackSpreadsheetId`, `trackContextFromRequest` called every time
**Solution**: Batch context updates, skip redundant updates

### Files to Update
- `/src/handlers/base.ts`
- All 25 handler files

---

## Phase 3: Cache Optimization (Medium Impact)

### 3.1 Two-Tier Cache

**Current**: Single LRU cache
**Optimized**: Hot (in-memory) + Warm (LRU) tiers

```typescript
class TwoTierCache {
  private hotCache = new Map<string, unknown>(); // Last 100 items
  private warmCache: LRUCache;
  
  get(key: string) {
    // Hot tier first (O(1))
    if (this.hotCache.has(key)) return this.hotCache.get(key);
    // Then warm tier
    return this.warmCache.get(key);
  }
}
```

### 3.2 Prefetch on Read Patterns

**Current**: No prefetching
**Optimized**: Predict next read based on access patterns

```typescript
// After reading A1:A100, prefetch B1:B100
const accessPatterns = {
  'read:Sheet1!A:A': ['read:Sheet1!B:B', 'read:Sheet1!C:C'],
};
```

### Files to Update
- `/src/utils/cache-manager.ts`
- `/src/services/prefetch-predictor.ts`

---

## Phase 4: Response Optimization (Medium Impact)

### 4.1 Lazy Response Building

**Problem**: Always build full response even if client doesn't need all fields
**Solution**: Only include requested fields

### 4.2 Response Streaming for Large Data

**Current**: Buffer entire response
**Optimized**: Stream large value arrays

---

## Phase 5: Infrastructure Optimization (Low-Medium Impact)

### 5.1 Connection Pooling

**Current**: New connection per request
**Optimized**: Persistent connection pool

### 5.2 Batch Compiler Optimization

**Current**: Compile intents → batches every time
**Optimized**: Cache compiled batches for repeated patterns

---

## Implementation Order

### Week 1: Quick Wins (2-3x improvement expected)
1. [ ] Pre-compile most-used schemas (values, spreadsheet, sheet)
2. [ ] Remove unnecessary async in hot paths
3. [ ] Add hot-tier cache

### Week 2: Medium Effort (1.5-2x additional)
4. [ ] Optimize all handlers
5. [ ] Add prefetch predictor
6. [ ] Optimize request merger timing

### Week 3: Polish (10-20% additional)
7. [ ] Response streaming
8. [ ] Connection pooling
9. [ ] Comprehensive benchmarks

---

## Metrics to Track

| Metric | Current | Target |
|--------|---------|--------|
| Cold start time | ~2s | <500ms |
| Average request latency | ~150ms | <50ms |
| Cache hit rate | ~60% | >90% |
| API calls saved | ~40% | >70% |
| Memory usage | ~100MB | <50MB |

---

## Files to Create

1. `/src/utils/fast-validators.ts` - Pre-compiled validators
2. `/src/utils/hot-cache.ts` - Two-tier cache
3. `/src/utils/response-stream.ts` - Streaming responses
4. `/src/benchmarks/` - Performance tests
