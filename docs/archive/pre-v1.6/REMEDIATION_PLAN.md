# ServalSheets Issue Remediation Plan

**Status**: Ready for Implementation
**Priority Order**: P0 → P1 → P2 → P3
**Based on**: MCP 2025-11-25 Spec, Node.js Best Practices, Google Sheets API v4 Docs

---

## Table of Contents

1. [P0 - Critical Security: HTTP Multi-Session Isolation](#p0---critical-security-http-multi-session-isolation)
2. [P1 - Documentation Drift](#p1---documentation-drift)
3. [P1 - Response Size Handling](#p1---response-size-handling)
4. [P2 - Transport Inconsistency](#p2---transport-inconsistency)
5. [P2 - Task Cancellation Gap](#p2---task-cancellation-gap)
6. [P3 - Comment Drift](#p3---comment-drift)

---

## P0 - Critical Security: HTTP Multi-Session Isolation

### Problem Statement

**Security Risk**: Cross-user data leakage in HTTP multi-tenant deployment

**Root Cause**: Process-global singleton services shared across all HTTP sessions:
- `SessionContextManager` - conversation context leaks between users
- `ContextManager` - parameter inference leaks spreadsheetIds
- `HistoryService` - operation history shared across users
- `ETagCache` - cache keys missing user/tenant context
- `RequestDeduplication` - cache keys missing authorization context

**Impact**:
- User A's spreadsheet ID inferred for User B's request
- User B sees User A's cached data without API authorization check
- Cross-user operation history visible
- Violates MCP security best practice: "Servers SHOULD bind session IDs to user-specific information"

### Official Guidance

**MCP 2025-11-25 Specification**:
> "MCP servers SHOULD bind session IDs to user-specific information. When storing or transmitting session-related data (e.g., in a queue), combine the session ID with information unique to the authorized user, such as their internal user ID. Use a key format like `<user_id>:<session_id>`."

**OWASP Multi-Tenant Security**:
- Always include tenant context in cache keys
- Validate authorization before serving cached responses
- Use Row-Level Security or tenant-scoped database connections

**Node.js Best Practices**:
- Use AsyncLocalStorage for request-scoped context
- Avoid module-level singletons with mutable state
- Create per-request service instances

### Implementation Plan

#### Option A: AsyncLocalStorage (Recommended)

**Benefits**:
- Standard Node.js solution (no dependencies)
- Transparent context propagation through async chains
- Zero changes to handler signatures
- MCP spec compliant

**Implementation Steps**:

1. **Create request context store** - `src/utils/request-context.ts`

```typescript
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  userId: string;
  sessionId: string;
  token: string;

  // Per-request service instances
  sessionContext: SessionContextManager;
  contextManager: ContextManager;
  historyService: HistoryService;
  etagCache: ETagCache;
}

const requestStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  const context = requestStorage.getStore();
  if (!context) {
    throw new Error('RequestContext not available outside request scope');
  }
  return context;
}

export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => Promise<T>
): Promise<T> {
  return requestStorage.run(context, fn);
}
```

2. **Update HTTP server middleware** - `src/http-server.ts:1400-1500`

```typescript
// After session creation (line ~1480)
const requestContext: RequestContext = {
  requestId: randomUUID(),
  userId: extractUserIdFromToken(googleToken),
  sessionId,
  token: googleToken,

  // Create per-request service instances
  sessionContext: new SessionContextManager(),
  contextManager: new ContextManager(),
  historyService: new HistoryService({ maxSize: 100 }),
  etagCache: new ETagCache({
    maxAge: 5 * 60 * 1000,
    maxSize: 1000,
    // Add user context to cache keys
    keyPrefix: `user:${userId}:session:${sessionId}:`
  }),
};

// Wrap transport connection in AsyncLocalStorage context
await runWithRequestContext(requestContext, async () => {
  await mcpServer.connect(transport);
});
```

3. **Update service getters to use context**

**Before** (`src/services/session-context.ts:979-984`):
```typescript
let sessionContext: SessionContextManager | null = null;

export function getSessionContext(): SessionContextManager {
  if (!sessionContext) {
    sessionContext = new SessionContextManager();
  }
  return sessionContext;
}
```

**After**:
```typescript
export function getSessionContext(): SessionContextManager {
  // Try request context first (HTTP mode)
  try {
    const context = getRequestContext();
    return context.sessionContext;
  } catch {
    // Fall back to singleton for STDIO mode
    if (!sessionContext) {
      sessionContext = new SessionContextManager();
    }
    return sessionContext;
  }
}
```

Apply same pattern to:
- `src/services/context-manager.ts:313-318`
- `src/services/history-service.ts:553-558`
- `src/services/etag-cache.ts:245-251`

4. **Add user/session prefixes to cache keys**

**ETag Cache** (`src/services/etag-cache.ts:42-60`):
```typescript
export class ETagCache {
  private cache: Map<string, ETagEntry>;
  private readonly maxAge: number;
  private readonly maxSize: number;
  private readonly keyPrefix: string; // NEW

  constructor(options: {
    maxAge?: number;
    maxSize?: number;
    keyPrefix?: string; // NEW - e.g., "user:123:session:abc:"
  } = {}) {
    this.cache = new Map();
    this.maxAge = options.maxAge ?? 5 * 60 * 1000;
    this.maxSize = options.maxSize ?? 1000;
    this.keyPrefix = options.keyPrefix ?? ''; // NEW
  }

  private buildKey(components: CacheKey): string {
    const { spreadsheetId, endpoint, range, params } = components;
    const paramsKey = params ? `:${JSON.stringify(params)}` : '';
    const rangeKey = range ? `:${range}` : '';

    // Include prefix for user/session isolation
    return `${this.keyPrefix}${spreadsheetId}:${endpoint}${rangeKey}${paramsKey}`;
  }
}
```

5. **Add authorization checks before cache hits**

**Request Deduplication** (`src/utils/request-deduplication.ts:100-150`):
```typescript
async deduplicate<T>(
  requestKey: string,
  operation: () => Promise<T>,
  options: DeduplicationOptions = {}
): Promise<T> {
  // Include user context in cache key
  const context = getRequestContext();
  const scopedKey = `${context.userId}:${context.sessionId}:${requestKey}`;

  // Check pending requests
  if (this.pendingRequests.has(scopedKey)) {
    return this.pendingRequests.get(scopedKey)!.promise as Promise<T>;
  }

  // Check result cache with authorization
  if (this.resultCacheEnabled && this.resultCache.has(scopedKey)) {
    const cached = this.resultCache.get(scopedKey);

    // Verify user still has access (paranoid check)
    await verifyUserHasAccess(context.userId, cached.resourceId);

    return cached.result as T;
  }

  // Execute operation
  const promise = operation();
  this.pendingRequests.set(scopedKey, { promise, timestamp: Date.now(), requestKey: scopedKey });

  try {
    const result = await promise;

    if (this.resultCacheEnabled) {
      this.resultCache.set(scopedKey, { result, timestamp: Date.now() });
    }

    return result;
  } finally {
    this.pendingRequests.delete(scopedKey);
  }
}
```

#### Option B: Dependency Injection with Awilix (Alternative)

**Benefits**:
- Explicit dependencies
- Better testability
- Standard enterprise pattern

**Drawbacks**:
- Requires refactoring all handler constructors
- Adds dependency
- More invasive changes

**Not recommended** for ServalSheets due to:
- AsyncLocalStorage is simpler and meets requirements
- Minimal code changes needed
- Already using request-context pattern in some places

### Testing Strategy

1. **Unit Tests** - `tests/security/session-isolation.test.ts`

```typescript
describe('HTTP Multi-Session Isolation', () => {
  test('concurrent sessions have isolated context', async () => {
    const server = createHttpServer({ port: 3001 });

    // Simulate two concurrent users
    const user1Token = 'token-user1';
    const user2Token = 'token-user2';

    const [response1, response2] = await Promise.all([
      fetch('http://localhost:3001/mcp', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user1Token}` },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'sheets_session',
            arguments: { request: { action: 'set_active', spreadsheetId: 'user1-sheet' } }
          }
        })
      }),
      fetch('http://localhost:3001/mcp', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${user2Token}` },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'sheets_session',
            arguments: { request: { action: 'get_active' } }
          }
        })
      })
    ]);

    // User 2 should NOT see user 1's active sheet
    const data2 = await response2.json();
    expect(data2.result.spreadsheetId).not.toBe('user1-sheet');
  });

  test('ETag cache is user-scoped', async () => {
    const user1Cache = new ETagCache({ keyPrefix: 'user:1:' });
    const user2Cache = new ETagCache({ keyPrefix: 'user:2:' });

    user1Cache.set({
      spreadsheetId: 'shared-sheet',
      endpoint: 'values',
      range: 'Sheet1!A1:B10'
    }, 'etag-user1', { values: [[1, 2]] });

    // User 2's cache should be empty
    const user2Data = user2Cache.get({
      spreadsheetId: 'shared-sheet',
      endpoint: 'values',
      range: 'Sheet1!A1:B10'
    });

    expect(user2Data).toBeNull();
  });
});
```

2. **Integration Tests** - `tests/live-api/security/multi-session.live.test.ts`

```typescript
test('multiple users with same spreadsheetId get independent data', async () => {
  // User 1 reads spreadsheet
  const client1 = createTestClient({ userId: 'user1' });
  await client1.call('sheets_data', {
    request: { action: 'read', spreadsheetId: TEST_SHEET_ID, range: { a1: 'A1:B10' } }
  });

  // User 2 reads same spreadsheet (must not get user 1's cached data)
  const client2 = createTestClient({ userId: 'user2' });
  const response2 = await client2.call('sheets_data', {
    request: { action: 'read', spreadsheetId: TEST_SHEET_ID, range: { a1: 'A1:B10' } }
  });

  // Verify API was called (not served from user1's cache)
  expect(response2.metadata?.cacheHit).toBe(false);
});
```

### Migration Path

**Phase 1: STDIO Backward Compatibility** (Current behavior preserved)
- Detect execution mode: `if (process.stdin.isTTY === false)` → STDIO mode
- STDIO mode continues using singleton pattern
- HTTP mode uses AsyncLocalStorage

**Phase 2: HTTP Deployment with Isolation** (New feature)
- Add `ENABLE_MULTI_TENANT=true` environment variable
- Deploy to staging with monitoring
- Verify no cross-session leaks

**Phase 3: Deprecate Singletons** (Future)
- Remove fallback singletons after 2 releases
- All modes use request-scoped services

### Files to Modify

1. `src/utils/request-context.ts` - Add AsyncLocalStorage context
2. `src/http-server.ts:1400-1500` - Create per-request service instances
3. `src/services/session-context.ts:979-984` - Update getter
4. `src/services/context-manager.ts:313-318` - Update getter
5. `src/services/history-service.ts:553-558` - Update getter
6. `src/services/etag-cache.ts:42-60` - Add keyPrefix support
7. `src/utils/request-deduplication.ts:100-150` - Add user context to keys
8. `tests/security/session-isolation.test.ts` - New test file
9. `tests/live-api/security/multi-session.live.test.ts` - New test file

### Rollout Strategy

1. **Week 1**: Implement AsyncLocalStorage context (no behavior change yet)
2. **Week 2**: Update service getters with context fallback
3. **Week 3**: Add cache key prefixes
4. **Week 4**: Integration testing with 2+ concurrent users
5. **Week 5**: Staging deployment with monitoring
6. **Week 6**: Production rollout to HTTP servers

---

## P1 - Documentation Drift

### Problem Statement

**Action Count Mismatch**: Documentation claims 293 actions, code has 293 actions (+19 difference)

**Affected Files**:
- `README.md:3,59` - Claims "293 actions"
- `docs/guides/SKILL.md:18` - Claims "293 actions"
- `src/mcp/completions.ts:17` - Comment says "293 actions" (code is correct at 291)

**Source of Truth**:
- `src/schemas/annotations.ts:224` - `ACTION_COUNT = 291`
- `server.json:4` - `"actionCount": 291`

### Implementation Plan

**Automated Fix**: Use metadata generation script (already exists)

```bash
npm run gen:metadata
npm run check:drift
```

**Manual Updates Needed**:

1. **README.md** - Lines 3, 59, 70
```diff
-Production-grade Google Sheets MCP Server with 21 tools, 293 actions, safety rails, and enterprise features.
+Production-grade Google Sheets MCP Server with 21 tools, 293 actions, safety rails, and enterprise features.

-**21 Tools, 272 Actions**: Comprehensive Google Sheets API v4 coverage
+**21 Tools, 291 Actions**: Comprehensive Google Sheets API v4 coverage

-✅ **Tools**: 21 tools with 293 actions using discriminated unions
+✅ **Tools**: 21 tools with 293 actions using discriminated unions
```

2. **docs/guides/SKILL.md** - Line 18
```diff
-ServalSheets provides 21 tools with 293 actions for comprehensive Google Sheets operations.
+ServalSheets provides 21 tools with 293 actions for comprehensive Google Sheets operations.
```

3. **src/mcp/completions.ts** - Line 17 (comment only)
```diff
- * Total: 293 actions across 21 tools (Tier 7: templates, bigquery, appsscript)
+ * Total: 293 actions across 21 tools (Tier 7: templates, bigquery, appsscript)
```

4. **Per-Tool Action Counts** - Verify all docs match `src/schemas/annotations.ts:173-195`

Correct counts:
```
sheets_advanced: 26 actions
sheets_analyze: 16 actions
sheets_appsscript: 14 actions
sheets_auth: 4 actions
sheets_bigquery: 14 actions
sheets_collaborate: 35 actions
sheets_composite: 10 actions
sheets_confirm: 5 actions
sheets_core: 17 actions
sheets_data: 18 actions
sheets_dependencies: 7 actions
sheets_dimensions: 28 actions
sheets_fix: 1 action
sheets_format: 21 actions
sheets_history: 7 actions
sheets_quality: 4 actions
sheets_session: 26 actions
sheets_templates: 8 actions
sheets_transaction: 6 actions
sheets_visualize: 18 actions
sheets_webhook: 6 actions
```

### Testing Strategy

1. **CI Check**: Add to `.github/workflows/verify.yml`

```yaml
- name: Verify Documentation Matches Code
  run: |
    npm run check:drift

    # Check README.md mentions correct count
    grep -q "21 tools, 293 actions" README.md || exit 1

    # Check SKILL.md mentions correct count
    grep -q "21 tools with 293 actions" docs/guides/SKILL.md || exit 1
```

2. **Pre-commit Hook**: Add to `.husky/pre-commit`

```bash
#!/bin/sh
npm run gen:metadata
npm run check:drift || {
  echo "❌ Metadata drift detected. Run 'npm run gen:metadata' to fix."
  exit 1
}
```

### Files to Modify

1. `README.md` - Lines 3, 59, 70
2. `docs/guides/SKILL.md` - Line 18
3. `src/mcp/completions.ts` - Line 17 (comment)
4. `.github/workflows/verify.yml` - Add drift check
5. `.husky/pre-commit` - Add drift check

---

## P1 - Response Size Handling

### Problem Statement

**Unbounded Responses**: Large range reads and resource fetches can return massive payloads

**Current State**:
- `sheets_data.read` - ✅ Has pagination (cursor, pageSize, auto-paginate at 10k cells)
- `sheets_data.batch_read` - ❌ Pagination explicitly disabled (line 1114)
- Resources (`sheets:///spreadsheetId/range`) - ❌ No pagination or truncation
- Response builder - ❌ Has truncation support but not wired to handlers

**MCP Specification**:
- No explicit response size limits
- Recommends using progress notifications for long operations
- Resources should be pageable via cursor mechanism

**Google Sheets API**:
- No pagination support in values.get/batchGet
- Recommended max: 2MB per response (performance)
- Use Connected Sheets for datasets > 10 million cells

### Implementation Plan

#### Part 1: Enable batch_read Pagination

**File**: `src/handlers/data.ts:1110-1170`

```typescript
private async handleBatchRead(
  input: DataRequest & { action: 'batch_read' }
): Promise<DataResponse> {
  // ❌ BEFORE: const wantsPagination = false;
  // ✅ AFTER: Re-enable pagination
  const wantsPagination = Boolean(input.cursor || input.pageSize || input.streaming);

  if (wantsPagination) {
    // Existing pagination logic (currently commented out)
    if (input.dataFilters && input.dataFilters.length > 0) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: 'Pagination not supported with dataFilters',
        retryable: false,
      });
    }

    if (!input.ranges || input.ranges.length !== 1) {
      return this.error({
        code: 'INVALID_PARAMS',
        message: 'Pagination requires exactly one range',
        retryable: false,
      });
    }

    const singleRange = await this.resolveRangeToA1(input.spreadsheetId, input.ranges[0] as any);
    const paginationPlan = this.buildPaginationPlan({
      range: singleRange,
      cursor: input.cursor,
      pageSize: input.pageSize,
      streaming: input.streaming,
    });

    if (paginationPlan && 'error' in paginationPlan) {
      return paginationPlan.error;
    }

    const readRange = paginationPlan?.range ?? singleRange;

    // Continue with paginated read...
  }

  // Existing non-paginated batch read logic
}
```

**Schema Update**: `src/schemas/data.ts` - Ensure cursor/pageSize/streaming fields exist on batch_read action

```typescript
z.object({
  action: z.literal('batch_read'),
  spreadsheetId: z.string(),
  ranges: z.array(RangeInputSchema).optional(),
  dataFilters: z.array(DataFilterSchema).optional(),

  // Pagination fields (already exist but may need to be uncommented)
  cursor: z.string().optional().describe('Pagination cursor from previous response'),
  pageSize: z.number().int().positive().max(10000).optional().describe('Rows per page (max 10000)'),
  streaming: z.boolean().optional().describe('Enable streaming mode (auto-pagination)'),
})
```

#### Part 2: Resource Response Truncation

**File**: `src/resources/resource-registration.ts:150-200`

```typescript
server.setResourceHandler('sheets', async (request: ReadResourceRequest) => {
  const uri = request.params.uri;
  const match = uri.match(/^sheets:\/\/\/([^/]+)(?:\/(.+))?$/);

  if (!match) {
    throw new Error(`Invalid sheets URI: ${uri}`);
  }

  const [, spreadsheetId, range] = match;

  if (!range) {
    // Metadata request - no truncation needed
    return getSpreadsheetMetadata(spreadsheetId);
  }

  // Range data request - apply size limits
  const decodedRange = decodeURIComponent(range);
  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: decodedRange,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const values = response.data.values ?? [];
  const cellCount = values.reduce((sum, row) => sum + row.length, 0);

  // Truncate if > 10k cells
  if (cellCount > 10000) {
    const truncatedValues = values.slice(0, 1000); // First 1000 rows

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          values: truncatedValues,
          truncated: true,
          totalRows: values.length,
          message: `Response truncated to 1000 rows. Full range has ${values.length} rows (${cellCount} cells). Use sheets_data.read with pagination for complete access.`,
        }),
      }],
    };
  }

  // Return full response
  return {
    contents: [{
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({ values }),
    }],
  };
});
```

#### Part 3: Streaming Analysis Progress Notifications

**Current**: Streaming analysis logs progress but doesn't emit MCP notifications

**File**: `src/analysis/streaming.ts:200-250`

```typescript
async analyzeStreaming(
  spreadsheetId: string,
  sheets: SheetMetadata[],
  options: StreamingConfig
): Promise<AnalysisResult> {
  const mcpServer = getMcpServer(); // Get from request context
  const progressToken = options.progressToken; // Pass from handler

  let processedSheets = 0;
  const totalSheets = sheets.length;

  for (const sheet of sheets) {
    // Analyze sheet
    const sheetResult = await this.analyzeSheet(spreadsheetId, sheet);
    results.push(sheetResult);

    processedSheets++;

    // Emit MCP progress notification
    if (progressToken && mcpServer) {
      await mcpServer.notification({
        method: 'notifications/progress',
        params: {
          progressToken,
          progress: processedSheets,
          total: totalSheets,
          message: `Analyzed ${processedSheets}/${totalSheets} sheets`,
        },
      });
    }

    logger.info(`Streaming analysis progress: ${processedSheets}/${totalSheets}`);
  }

  return results;
}
```

**Handler Update**: `src/handlers/analyze.ts` - Extract progressToken from input

```typescript
async handle(input: SheetsAnalyzeInput): Promise<SheetsAnalyzeOutput> {
  const request = unwrapRequest<SheetsAnalyzeInput['request']>(input);

  // Extract progress token if provided
  const progressToken = (input as any)._meta?.progressToken;

  if (request.action === 'comprehensive') {
    return this.handleComprehensive({
      ...request,
      progressToken, // Pass to streaming analyzer
    });
  }

  // ... other actions
}
```

### Testing Strategy

1. **Unit Tests** - `tests/handlers/data-pagination.test.ts`

```typescript
test('batch_read supports pagination', async () => {
  const handler = createDataHandler();

  const response = await handler.handle({
    request: {
      action: 'batch_read',
      spreadsheetId: 'test-sheet',
      ranges: [{ a1: 'Sheet1!A1:Z10000' }],
      pageSize: 1000,
    },
  });

  expect(response.response.hasMore).toBe(true);
  expect(response.response.nextCursor).toBeDefined();
  expect(response.response.values?.length).toBeLessThanOrEqual(1000);
});

test('resources truncate large responses', async () => {
  const resource = await server.readResource({
    params: { uri: 'sheets:///test-sheet/Sheet1!A1:Z20000' }
  });

  const data = JSON.parse(resource.contents[0].text);

  expect(data.truncated).toBe(true);
  expect(data.values.length).toBe(1000);
  expect(data.message).toContain('Use sheets_data.read with pagination');
});
```

2. **Integration Tests** - `tests/live-api/tools/sheets-data-large.live.test.ts`

```typescript
test('streaming analysis emits progress notifications', async () => {
  const progressUpdates: any[] = [];

  client.onNotification('notifications/progress', (params) => {
    progressUpdates.push(params);
  });

  await client.call('sheets_analyze', {
    request: {
      action: 'comprehensive',
      spreadsheetId: LARGE_SHEET_ID,
    },
    _meta: {
      progressToken: 'test-progress-123',
    },
  });

  expect(progressUpdates.length).toBeGreaterThan(0);
  expect(progressUpdates[0].progressToken).toBe('test-progress-123');
  expect(progressUpdates[progressUpdates.length - 1].progress).toBe(progressUpdates[progressUpdates.length - 1].total);
});
```

### Files to Modify

1. `src/handlers/data.ts:1110-1170` - Re-enable batch_read pagination
2. `src/schemas/data.ts` - Ensure pagination fields in batch_read schema
3. `src/resources/resource-registration.ts:150-200` - Add truncation to range resources
4. `src/analysis/streaming.ts:200-250` - Add progress notifications
5. `src/handlers/analyze.ts` - Extract and pass progressToken
6. `tests/handlers/data-pagination.test.ts` - New test file
7. `tests/live-api/tools/sheets-data-large.live.test.ts` - New test file

---

## P2 - Transport Inconsistency

### Problem Statement

**Behavior Difference**: STDIO transport initializes performance optimizations that HTTP transport doesn't

**STDIO Path** (`src/server.ts:200-300`):
- Initializes prefetching predictor
- Initializes request merger
- Initializes parallel executor
- Initializes batch compiler with adaptive windows

**HTTP Path** (`src/http-server.ts:180-195`):
- Calls `registerServalSheetsTools` without these optimizations
- Performance characteristics differ

### Implementation Plan

**Goal**: Unified behavior across transports

#### Option 1: Extract Optimization Initialization (Recommended)

**Create**: `src/startup/performance-init.ts`

```typescript
import { PrefetchPredictor } from '../services/prefetch.js';
import { RequestMerger } from '../services/request-merger.js';
import { ParallelExecutor } from '../services/parallel-executor.js';
import { BatchCompiler } from '../core/batch-compiler.js';

export interface PerformanceServices {
  prefetchPredictor: PrefetchPredictor;
  requestMerger: RequestMerger;
  parallelExecutor: ParallelExecutor;
  batchCompiler: BatchCompiler;
}

export function initializePerformanceOptimizations(
  googleClient: GoogleApiClient
): PerformanceServices {
  const prefetchPredictor = new PrefetchPredictor({
    maxPredictions: 5,
    confidenceThreshold: 0.7,
    historySize: 100,
  });

  const requestMerger = new RequestMerger({
    enabled: true,
    mergeWindowMs: 50,
  });

  const parallelExecutor = new ParallelExecutor({
    maxConcurrency: 5,
  });

  const batchCompiler = new BatchCompiler({
    adaptiveWindow: true,
    minWindowMs: 20,
    maxWindowMs: 200,
  });

  return {
    prefetchPredictor,
    requestMerger,
    parallelExecutor,
    batchCompiler,
  };
}
```

**Update**: `src/server.ts:200-300` - Use extracted function

```typescript
import { initializePerformanceOptimizations } from './startup/performance-init.js';

// ... in ServalSheetsServer constructor
const perfServices = initializePerformanceOptimizations(this.googleClient);

const handlerContext: HandlerContext = {
  // ... existing context
  ...perfServices, // Spread performance services
};
```

**Update**: `src/http-server.ts:180-195` - Add performance services

```typescript
import { initializePerformanceOptimizations } from './startup/performance-init.js';

async function createMcpServerInstance(googleToken: string) {
  const googleClient = await createGoogleApiClient({ accessToken: googleToken });

  // Initialize performance optimizations
  const perfServices = initializePerformanceOptimizations(googleClient);

  // Create handler context with performance services
  const handlerContext: HandlerContext = {
    googleClient,
    batchCompiler,
    rateLimiter,
    diffEngine,
    policyEnforcer,
    rangeResolver,
    snapshotService,
    ...perfServices, // Add performance services
  };

  const handlers = createHandlers(handlerContext);

  // ... rest of initialization
}
```

#### Option 2: Feature Flag (Alternative)

**For environments where performance optimizations cause issues**:

```typescript
const enableOptimizations = getEnv().ENABLE_PERFORMANCE_OPTIMIZATIONS ?? true;

if (enableOptimizations) {
  const perfServices = initializePerformanceOptimizations(googleClient);
  Object.assign(handlerContext, perfServices);
}
```

### Testing Strategy

1. **Benchmark Tests** - `tests/benchmarks/transport-parity.bench.ts`

```typescript
describe('Transport Performance Parity', () => {
  test('STDIO and HTTP have similar performance', async () => {
    const stdioServer = new ServalSheetsServer();
    const httpServer = createHttpServer({ port: 3002 });

    // Measure STDIO performance
    const stdioStart = Date.now();
    await stdioClient.call('sheets_data', {
      request: { action: 'read', spreadsheetId: TEST_SHEET, range: { a1: 'A1:Z1000' } }
    });
    const stdioDuration = Date.now() - stdioStart;

    // Measure HTTP performance
    const httpStart = Date.now();
    await httpClient.call('sheets_data', {
      request: { action: 'read', spreadsheetId: TEST_SHEET, range: { a1: 'A1:Z1000' } }
    });
    const httpDuration = Date.now() - httpStart;

    // Should be within 20% of each other
    expect(Math.abs(stdioDuration - httpDuration) / stdioDuration).toBeLessThan(0.2);
  });
});
```

### Files to Modify

1. `src/startup/performance-init.ts` - New file with extracted initialization
2. `src/server.ts:200-300` - Use performance-init
3. `src/http-server.ts:180-195` - Add performance services
4. `tests/benchmarks/transport-parity.bench.ts` - New benchmark test

---

## P2 - Task Cancellation Gap

### Problem Statement

**HTTP Cancellation**: HTTP path doesn't pass AbortController to handlers

**Current State**:
- STDIO: `ServalSheetsServer` has full AbortController support
- HTTP: `registerServalSheetsTools` creates task handlers without cancellation

**MCP Specification**:
> "To cancel, the client SHOULD explicitly send an MCP `CancelledNotification`."

**Best Practice**:
- Pass AbortSignal to all async operations
- Clean up resources on abort
- Mark tasks as `cancelled` state

### Implementation Plan

#### Step 1: Add AbortSignal to HandlerContext

**File**: `src/handlers/base.ts:20-40`

```typescript
export interface HandlerContext {
  googleClient: GoogleApiClient;
  batchCompiler: BatchCompiler;
  rateLimiter: RateLimiter;
  // ... other services

  // NEW: Cancellation signal
  abortSignal?: AbortSignal;
}
```

#### Step 2: Create Task Store with Cancellation

**File**: `src/http-server.ts:130-180`

```typescript
async function createMcpServerInstance(googleToken: string) {
  const googleClient = await createGoogleApiClient({ accessToken: googleToken });

  // Create task store with cancellation support
  const taskStore = new TaskStoreAdapter({
    onCancel: async (taskId: string) => {
      logger.info('Task cancelled', { taskId });

      // Get associated AbortController and abort
      const controller = taskAbortControllers.get(taskId);
      if (controller) {
        controller.abort();
        taskAbortControllers.delete(taskId);
      }
    },
  });

  // Map of taskId → AbortController
  const taskAbortControllers = new Map<string, AbortController>();

  // ... rest of initialization
}
```

#### Step 3: Pass AbortSignal to Handlers

**File**: `src/mcp/registration/tool-handlers.ts:300-400`

```typescript
export function registerServalSheetsTools(
  server: McpServer,
  handlers: Handlers,
  options: { googleClient: GoogleApiClient; taskStore?: TaskStoreAdapter }
) {
  const { taskStore } = options;

  // Register each tool with task support
  for (const toolDef of ACTIVE_TOOL_DEFINITIONS) {
    const taskConfig = TOOL_EXECUTION_CONFIG[toolDef.name];

    if (taskConfig?.taskSupport === 'optional' || taskConfig?.taskSupport === 'required') {
      // Create task handler with cancellation
      const taskHandler: ToolTaskHandler = async (args, options) => {
        const taskId = options?.taskId;
        const abortController = new AbortController();

        if (taskId && taskStore) {
          // Store abort controller for cancellation
          taskAbortControllers.set(taskId, abortController);
        }

        try {
          // Update handler context with abort signal
          const contextWithSignal = {
            ...handlers[toolDef.name].context,
            abortSignal: abortController.signal,
          };

          // Call handler with cancellation support
          const result = await handlers[toolDef.name].handle(args, contextWithSignal);

          return {
            status: 'completed' as const,
            result,
          };
        } catch (error) {
          if (error.name === 'AbortError') {
            return {
              status: 'cancelled' as const,
            };
          }

          return {
            status: 'failed' as const,
            error: String(error),
          };
        } finally {
          if (taskId) {
            taskAbortControllers.delete(taskId);
          }
        }
      };

      server.registerToolWithTasks(toolDef.name, toolDef.schema, taskHandler);
    } else {
      // Register without task support
      server.setToolHandler(toolDef.name, async (request) => {
        // ... existing handler logic
      });
    }
  }
}
```

#### Step 4: Check AbortSignal in Long-Running Operations

**Example**: `src/handlers/data.ts:611-693`

```typescript
private async handleRead(input: DataRequest & { action: 'read' }): Promise<DataResponse> {
  const range = await this.resolveRangeToA1(input.spreadsheetId, input.range);

  // Check cancellation before API call
  if (this.context.abortSignal?.aborted) {
    return this.error({
      code: 'OPERATION_CANCELLED',
      message: 'Read operation cancelled',
      retryable: false,
    });
  }

  const response = await this.sheetsApi.spreadsheets.values.get(
    {
      spreadsheetId: input.spreadsheetId,
      range,
      valueRenderOption: input.valueRenderOption,
      dateTimeRenderOption: input.dateTimeRenderOption,
      majorDimension: input.majorDimension,
    },
    {
      // Pass abort signal to Google API client
      signal: this.context.abortSignal,
    }
  );

  // Check cancellation after API call
  if (this.context.abortSignal?.aborted) {
    return this.error({
      code: 'OPERATION_CANCELLED',
      message: 'Read operation cancelled after API call',
      retryable: false,
    });
  }

  // ... process response
}
```

### Testing Strategy

1. **Unit Tests** - `tests/handlers/cancellation.test.ts`

```typescript
test('handler respects AbortSignal', async () => {
  const abortController = new AbortController();
  const handler = createDataHandler({ abortSignal: abortController.signal });

  // Start long-running operation
  const promise = handler.handle({
    request: {
      action: 'read',
      spreadsheetId: 'large-sheet',
      range: { a1: 'A1:Z100000' },
    },
  });

  // Cancel after 100ms
  setTimeout(() => abortController.abort(), 100);

  // Should reject with AbortError
  await expect(promise).rejects.toThrow('AbortError');
});

test('task store marks tasks as cancelled', async () => {
  const taskStore = new TaskStoreAdapter();
  const taskId = 'task-123';

  // Start task
  taskStore.create(taskId, { status: 'working' });

  // Cancel task
  await taskStore.cancel(taskId);

  // Verify status
  const task = taskStore.get(taskId);
  expect(task.status).toBe('cancelled');
});
```

2. **Integration Tests** - `tests/live-api/cancellation.live.test.ts`

```typescript
test('client can cancel long-running operations', async () => {
  const client = createTestClient();

  // Start long analysis
  const promise = client.call('sheets_analyze', {
    request: {
      action: 'comprehensive',
      spreadsheetId: LARGE_SHEET_ID,
    },
  });

  // Send cancellation after 1 second
  setTimeout(() => {
    client.notify('notifications/cancelled', { requestId: promise.requestId });
  }, 1000);

  // Should return cancelled status
  const result = await promise;
  expect(result.status).toBe('cancelled');
});
```

### Files to Modify

1. `src/handlers/base.ts:20-40` - Add abortSignal to HandlerContext
2. `src/http-server.ts:130-180` - Create task store with cancellation
3. `src/mcp/registration/tool-handlers.ts:300-400` - Pass AbortSignal to handlers
4. `src/handlers/data.ts:611-693` - Check signal in read operations
5. `src/handlers/analyze.ts` - Check signal in analysis loops
6. `src/handlers/composite.ts` - Check signal between operations
7. `tests/handlers/cancellation.test.ts` - New test file
8. `tests/live-api/cancellation.live.test.ts` - New test file

---

## P3 - Comment Drift

### Problem Statement

**Minor Issue**: Comment in completions.ts says 293 actions, code is correct at 291

**File**: `src/mcp/completions.ts:17`

```typescript
/**
 * Total: 293 actions across 21 tools (Tier 7: templates, bigquery, appsscript)
 *                ^^^ WRONG
 */
```

### Implementation Plan

**Single Line Fix**:

```diff
-* Total: 293 actions across 21 tools (Tier 7: templates, bigquery, appsscript)
+* Total: 293 actions across 21 tools (Tier 7: templates, bigquery, appsscript)
```

### Files to Modify

1. `src/mcp/completions.ts:17` - Update comment

---

## Implementation Priority & Timeline

### Recommended Order

1. **P3 - Comment Drift** (5 minutes)
   - Single line change
   - No testing needed
   - Can be done immediately

2. **P1 - Documentation Drift** (1 hour)
   - Run metadata generation
   - Update README and SKILL guide
   - Add CI checks
   - Low risk

3. **P1 - Response Size Handling** (1 week)
   - Re-enable batch_read pagination
   - Add resource truncation
   - Add progress notifications
   - Requires integration testing

4. **P2 - Transport Inconsistency** (3 days)
   - Extract performance initialization
   - Update both transports
   - Benchmark testing
   - Medium complexity

5. **P2 - Task Cancellation Gap** (1 week)
   - Add AbortSignal to context
   - Update HTTP server
   - Add cancellation checks
   - Requires careful testing

6. **P0 - Multi-Session Isolation** (2 weeks)
   - AsyncLocalStorage implementation
   - Per-request service instances
   - Cache key updates
   - Authorization checks
   - Extensive security testing
   - **Most critical but most complex**

### Total Estimated Time

- **Quick wins (P3 + P1 docs)**: 1 day
- **Medium items (P1 response + P2s)**: 2-3 weeks
- **Critical security (P0)**: 2 weeks
- **Total**: 4-5 weeks for complete remediation

---

## Verification Checklist

After implementing each fix:

- [ ] All existing tests pass (`npm run test:fast`)
- [ ] New tests written and passing
- [ ] Integration tests pass (`npm run test:live`)
- [ ] Verification pipeline passes (`npm run verify`)
- [ ] No metadata drift (`npm run check:drift`)
- [ ] Documentation updated
- [ ] Security review (for P0)
- [ ] Performance benchmarks (for P2s)
- [ ] Staging deployment validated
- [ ] Production rollout plan documented

---

## References

**Official Documentation Consulted**:
- [MCP 2025-11-25 Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP Security Best Practices](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices)
- [Node.js AsyncLocalStorage](https://nodejs.org/api/async_context.html)
- [OWASP Multi-Tenant Security](https://github.com/OWASP/ASVS/issues/2060)
- [Google Sheets API v4 Reference](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values)
- [Google Sheets API Best Practices](https://developers.google.com/sheets/api/guides/values)

**Related Issues**:
- [MCP Session Isolation #1087](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1087)
- [Multi-Tenant Discussion #193](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/193)
- [AbortController Support #8406](https://github.com/anomalyco/opencode/issues/8406)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-31
**Author**: Claude Sonnet 4.5 (via ServalSheets Analysis)
