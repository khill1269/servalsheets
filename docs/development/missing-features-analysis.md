# ServalSheets Missing Features Analysis

**Date:** 2026-01-04
**Status:** Infrastructure exists, integration needed

---

## Summary

Several advanced features have **infrastructure in place** but are **not fully integrated** into the tool handlers. This document identifies what needs to be wired up.

---

## Feature Status Matrix

| Feature | Infrastructure | Integration | Status | Priority |
|---------|---------------|-------------|---------|----------|
| **Apps Script Integration** | ❌ None | ❌ Not implemented | 🔴 Not Started | LOW |
| **Redis Caching** | ✅ RedisSessionStore, RedisTaskStore | ⚠️ Partial (session only) | 🟡 Partial | MEDIUM |
| **Circuit Breaker** | ✅ Complete class | ⚠️ Used in GoogleAPI only | 🟡 Partial | HIGH |
| **Bulkhead Pattern** | ❌ None | ❌ Not implemented | 🔴 Not Started | LOW |
| **Token Bucket Rate Limiting** | ✅ Complete (RateLimiter) | ✅ Fully integrated | 🟢 Complete | N/A |
| **Diff Options** | ✅ Schema + DiffEngine | ❌ Not exposed in tools | 🟡 Needs Wiring | HIGH |
| **includeValuesInResponse** | ❌ Not in schema | ❌ Not implemented | 🔴 Not Started | MEDIUM |

---

## Detailed Analysis

### 1. Apps Script Integration ❌

**Infrastructure:** None
**What's Missing:** Everything

**What Needs to Be Done:**
- Add Apps Script API client to GoogleApiClient
- Create `sheets_script` tool with actions:
  - `execute`: Run custom Apps Script function
  - `list_projects`: List available script projects
  - `get_project`: Get script project details
- Add schema in `src/schemas/script.ts`
- Add handler in `src/handlers/script.ts`
- Security considerations: Sandbox execution, permission scoping

**Estimated Effort:** 12-16 hours

**Priority:** LOW (niche use case, security concerns)

---

### 2. Redis Caching ⚠️

**Infrastructure:** ✅ RedisSessionStore (implemented), RedisTaskStore (stub exists in plan)
**What's Missing:**
- Spreadsheet metadata caching layer
- API response caching
- Cache invalidation strategy

**Current Usage:**
- `src/storage/session-store.ts` - RedisSessionStore fully implemented
- `src/core/task-store.ts` - Only InMemoryTaskStore, RedisTaskStore planned but not implemented

**What Needs to Be Done:**

1. **Implement RedisTaskStore** (from plan Phase 4):
   ```typescript
   // src/core/redis-task-store.ts
   export class RedisTaskStore implements TaskStore {
     constructor(redis: Redis, keyPrefix: string = 'task:');
     // Full implementation in implementation plan
   }
   ```

2. **Add Spreadsheet Metadata Cache:**
   ```typescript
   // src/utils/cache-manager.ts (exists, needs Redis backend)
   export class RedisCache extends CacheManager {
     constructor(redis: Redis, ttl: number);
     // Override get/set to use Redis
   }
   ```

3. **Add API Response Cache:**
   - Cache spreadsheet.get() responses (metadata heavy)
   - Cache range reads (short TTL, invalidate on writes)
   - Use cache keys: `ss:{spreadsheetId}:meta`, `ss:{spreadsheetId}:range:{range}`

**Configuration Needed:**
```bash
REDIS_URL=redis://localhost:6379
REDIS_CACHE_TTL=300000  # 5 minutes for metadata
REDIS_RANGE_TTL=60000   # 1 minute for range data
```

**Estimated Effort:** 8-12 hours

**Priority:** MEDIUM (production scalability)

---

### 3. Circuit Breaker ⚠️

**Infrastructure:** ✅ Full implementation in `src/utils/circuit-breaker.ts`
**Current Usage:** Only in GoogleApiClient (line 74-91)

**What's Missing:** Integration in other external service calls

**What Needs to Be Done:**

1. **Wrap All External API Calls:**
   - SnapshotService (Drive API calls)
   - OAuth token exchanges
   - Any webhook/callback endpoints

2. **Example Integration:**
   ```typescript
   // src/services/snapshot.ts
   import { CircuitBreaker } from '../utils/circuit-breaker.js';

   export class SnapshotService {
     private driveCircuit: CircuitBreaker;

     constructor(driveApi: drive_v3.Drive) {
       this.driveCircuit = new CircuitBreaker({
         failureThreshold: 5,
         successThreshold: 2,
         timeout: 60000,
         name: 'drive-api',
       });
     }

     async create(spreadsheetId: string, name?: string) {
       return this.driveCircuit.execute(async () => {
         // existing Drive API call
       });
     }
   }
   ```

3. **Add Circuit Breaker Metrics:**
   - Export stats via health endpoint
   - Log state transitions
   - Alert on open circuits

**Estimated Effort:** 4-6 hours

**Priority:** HIGH (resilience pattern, easy win)

---

### 4. Bulkhead Pattern ❌

**Infrastructure:** None
**What's Missing:** Everything

**What's Needed:**
The bulkhead pattern isolates resources to prevent cascading failures. Could be implemented using PQueue with separate queues.

**Potential Implementation:**
```typescript
// src/utils/bulkhead.ts
export class Bulkhead {
  private queues: Map<string, PQueue>;

  constructor(pools: Record<string, { concurrency: number; maxQueue: number }>) {
    this.queues = new Map();
    for (const [name, config] of Object.entries(pools)) {
      this.queues.set(name, new PQueue({
        concurrency: config.concurrency,
        timeout: 30000,
        throwOnTimeout: true,
      }));
    }
  }

  async execute<T>(pool: string, fn: () => Promise<T>): Promise<T> {
    const queue = this.queues.get(pool);
    if (!queue) throw new Error(`Unknown pool: ${pool}`);
    return queue.add(fn);
  }
}
```

**Usage:**
```typescript
const bulkhead = new Bulkhead({
  'read-operations': { concurrency: 10, maxQueue: 100 },
  'write-operations': { concurrency: 5, maxQueue: 50 },
  'heavy-analysis': { concurrency: 2, maxQueue: 10 },
});

await bulkhead.execute('read-operations', () => this.sheetsApi.get(...));
```

**Estimated Effort:** 6-8 hours

**Priority:** LOW (nice-to-have, PQueue already provides some isolation)

---

### 5. Token Bucket Rate Limiting ✅

**Status:** COMPLETE
**Location:** `src/core/rate-limiter.ts`
**Integration:** Fully integrated in batch operations

No action needed.

---

### 6. Diff Options 🟡

**Infrastructure:** ✅ Complete
- Schema: `DiffOptionsSchema` in `src/schemas/shared.ts` (lines 323-327)
- Engine: `DiffEngine` in `src/core/diff-engine.ts` supports tiered diffs

**What's Missing:** Not exposed in tool parameters

**Current DiffOptions Schema:**
```typescript
{
  tier?: 'METADATA' | 'SAMPLE' | 'FULL',
  sampleSize?: number,  // default: 10
  maxFullDiffCells?: number,  // default: 5000
}
```

**What Needs to Be Done:**

1. **Add to ValuesWriteInput schema** (src/schemas/values.ts):
   ```typescript
   // In ValuesWriteSchema
   diffOptions: DiffOptionsSchema.optional(),
   ```

2. **Wire into handler** (src/handlers/values.ts):
   ```typescript
   async handleWrite(request: ValuesWriteAction) {
     const { diffOptions } = request;

     // Pass to batch compiler
     const execution = await this.context.batchCompiler.executeWrite({
       // ... existing params
       diffOptions: diffOptions ?? { tier: 'METADATA' },
     });
   }
   ```

3. **Update documentation** to explain diff tiers:
   - `METADATA`: Only track changed cells count (fastest)
   - `SAMPLE`: Return sample of changed cells (default 10)
   - `FULL`: Return all changed cells (up to maxFullDiffCells limit)

**Estimated Effort:** 2-3 hours

**Priority:** HIGH (feature is ready, just needs exposure)

---

### 7. includeValuesInResponse ❌

**Infrastructure:** None
**What's Missing:** Schema, handler support, API integration

**What's Needed:**
After write operations, return the written values for verification.

**Implementation Plan:**

1. **Add to schema** (src/schemas/values.ts):
   ```typescript
   // Add to ValuesWriteSchema
   includeValuesInResponse: z.boolean().optional().default(false),
   ```

2. **Modify Google API call** (src/handlers/values.ts):
   ```typescript
   async handleWrite(request: ValuesWriteAction) {
     const { includeValuesInResponse } = request;

     // Modify API request
     const params: sheets_v4.Params$Resource$Spreadsheets$Values$Update = {
       spreadsheetId: request.spreadsheetId,
       range: request.range,
       valueInputOption: request.valueInputOption ?? 'USER_ENTERED',
       includeValuesInResponse: includeValuesInResponse ?? false,
       requestBody: { values: request.values },
     };

     const response = await this.sheetsApi.spreadsheets.values.update(params);

     // Return updatedData if requested
     return {
       success: true,
       action: 'write',
       updatedRange: response.data.updatedRange,
       updatedRows: response.data.updatedRows,
       updatedColumns: response.data.updatedColumns,
       updatedCells: response.data.updatedCells,
       updatedData: includeValuesInResponse ? response.data.updatedData : undefined,
     };
   }
   ```

3. **Update response types** to include `updatedData?: ValueRange`

**Estimated Effort:** 3-4 hours

**Priority:** MEDIUM (useful for verification, adds response size)

---

## Implementation Roadmap

### Phase 1: Quick Wins (6-9 hours)
✅ **Immediate value, low effort**

1. **Diff Options Integration** (2-3 hours) - ⭐ HIGH PRIORITY
   - Add to values write schema
   - Wire into handler
   - Update tool annotations

2. **Circuit Breaker Extension** (4-6 hours) - ⭐ HIGH PRIORITY
   - Add to SnapshotService
   - Add to OAuth endpoints
   - Export metrics

### Phase 2: Response Enhancement (7-10 hours)
⚠️ **Medium effort, good user value**

3. **includeValuesInResponse** (3-4 hours)
   - Schema changes
   - Handler integration
   - Response type updates

4. **Redis Task Store** (4-6 hours)
   - Implement RedisTaskStore from plan
   - Add conditional initialization
   - Production deployment guide

### Phase 3: Caching Layer (12-16 hours)
💡 **Higher effort, scalability value**

5. **Redis Metadata Cache** (8-10 hours)
   - RedisCache wrapper for CacheManager
   - Spreadsheet metadata caching
   - Cache invalidation strategy

6. **API Response Cache** (4-6 hours)
   - Range read caching
   - Cache keys and TTL strategy
   - Hit/miss metrics

### Phase 4: Advanced Patterns (Optional, 18-24 hours)
🔮 **Nice-to-have, specialized use cases**

7. **Bulkhead Pattern** (6-8 hours)
   - Bulkhead class implementation
   - Pool configuration
   - Integration with handlers

8. **Apps Script Integration** (12-16 hours)
   - Apps Script API client
   - sheets_script tool
   - Security sandboxing

---

## Recommended Next Steps

Based on current priorities and MCP protocol compliance work:

1. ✅ **Complete Phase 2 (HIGH)** - Activate task support in 4 handlers (current todo)
2. ⭐ **Phase 1, Item 1** - Integrate Diff Options (2-3 hours, high value)
3. ⭐ **Phase 1, Item 2** - Extend Circuit Breaker (4-6 hours, resilience)
4. ⚠️ **Phase 2, Item 3** - Add includeValuesInResponse (3-4 hours, verification)
5. 💡 **Phase 2, Item 4** - Implement RedisTaskStore (4-6 hours, scaling)

**Total estimated for recommendations 2-5:** 13-19 hours

---

## Configuration Summary

New environment variables needed for full feature set:

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_CACHE_TTL=300000           # Metadata cache TTL (5 min)
REDIS_RANGE_TTL=60000            # Range data cache TTL (1 min)
REDIS_TASK_STORE=true            # Use Redis for task storage

# Circuit Breaker (already supported via getCircuitBreakerConfig)
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_SUCCESS_THRESHOLD=2
CIRCUIT_BREAKER_TIMEOUT=60000

# Bulkhead (if implemented)
BULKHEAD_READ_CONCURRENCY=10
BULKHEAD_WRITE_CONCURRENCY=5
BULKHEAD_ANALYSIS_CONCURRENCY=2
```

---

## Testing Requirements

For each implemented feature:

### Unit Tests
- Circuit breaker state transitions
- Redis cache hit/miss logic
- Diff options tier selection
- Bulkhead queue isolation

### Integration Tests
- End-to-end with diff options
- Write operations with includeValuesInResponse
- Circuit breaker with failing services
- Redis failover behavior

### Performance Tests
- Cache hit rate measurement
- Rate limiter token bucket refill
- Bulkhead pool saturation

---

**Last Updated:** 2026-01-04
**Next Review:** After Phase 2 (HIGH) task activation completion
