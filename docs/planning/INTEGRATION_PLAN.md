---
title: 'ServalSheets Integration Plan: Existing Features → Production'
category: general
last_updated: 2026-02-04
description: 'Goal: Wire in ~1500 LOC of existing production-ready code to deliver 40% of top 1% value in 2-3 weeks'
version: 1.6.0
---

# ServalSheets Integration Plan: Existing Features → Production

**Goal:** Wire in ~1500 LOC of existing production-ready code to deliver 40% of top 1% value in 2-3 weeks

**Status:** Ready for execution
**Timeline:** 2-3 weeks (vs 12 weeks to build from scratch)
**ROI:** 4x faster time-to-value

---

## Phase 1: Quick Wins (Week 1) - 5 days

### 1A. Enable Background Quality Analysis (Day 1: 4-6 hours)

**Status:** 90% complete, fire-and-forget monitoring exists but not enabled

**Files to modify:**

1. `src/handlers/data.ts` - Enable in write operations
2. `src/handlers/dimensions.ts` - Enable in destructive operations
3. `src/config/env.ts` - Add feature flag
4. `docs/guides/MONITORING.md` - Document feature

**Implementation Steps:**

```typescript
// 1. src/config/env.ts (add config)
export const BACKGROUND_ANALYSIS_ENABLED = process.env.ENABLE_BACKGROUND_ANALYSIS !== 'false'; // Default: true
export const BACKGROUND_ANALYSIS_MIN_CELLS = parseInt(
  process.env.BACKGROUND_ANALYSIS_MIN_CELLS || '10',
  10
);
export const BACKGROUND_ANALYSIS_DEBOUNCE_MS = parseInt(
  process.env.BACKGROUND_ANALYSIS_DEBOUNCE_MS || '2000',
  10
);

// 2. src/handlers/data.ts (in write/update/delete actions)
import { getBackgroundAnalyzer } from '../services/background-analyzer.js';

// After successful write
if (BACKGROUND_ANALYSIS_ENABLED) {
  const analyzer = getBackgroundAnalyzer();
  analyzer.analyzeInBackground(spreadsheetId, range, estimatedCellsAffected, this.sheetsApi, {
    qualityThreshold: 70,
    minCellsChanged: BACKGROUND_ANALYSIS_MIN_CELLS,
    debounceMs: BACKGROUND_ANALYSIS_DEBOUNCE_MS,
  });
}

// 3. src/handlers/dimensions.ts (in delete_rows, delete_columns, clear)
// Same pattern as above
```

**Documentation Update:**

````markdown
# docs/guides/MONITORING.md

## Background Quality Analysis

ServalSheets automatically monitors data quality after destructive operations.

**How it works:**

- Triggered after writes affecting ≥10 cells (configurable)
- Runs in background (fire-and-forget, non-blocking)
- 2-second debounce to batch multiple writes
- Alerts added to session context if quality drops >20%

**Configuration:**

```bash
ENABLE_BACKGROUND_ANALYSIS=true  # Default
BACKGROUND_ANALYSIS_MIN_CELLS=10  # Minimum cells to trigger
BACKGROUND_ANALYSIS_DEBOUNCE_MS=2000  # Wait time before analysis
```
````

**Alerts:**

```json
{
  "severity": "high",
  "message": "Data quality dropped from 85% to 65% after write to A1:B100",
  "actionable": {
    "tool": "sheets_fix",
    "action": "fix_all",
    "params": { "spreadsheetId": "...", "range": "A1:B100", "preview": true }
  }
}
```

````

**Verification:**
```bash
# 1. Run test with background analysis
ENABLE_BACKGROUND_ANALYSIS=true npm test tests/handlers/data.test.ts

# 2. Check logs for "Starting background quality analysis"
grep "background quality analysis" logs/*.log

# 3. Verify no performance regression
npm run bench:compare
````

---

### 1B. Expose Multi-Step Planner as Tool (Day 2-3: 8-12 hours)

**Status:** 80% complete, `src/analysis/planner.ts` exists with 684 LOC

**Files to modify:**

1. `src/schemas/analyze.ts` - Add `plan` action
2. `src/handlers/analyze.ts` - Wire planner
3. `src/mcp/registration/tool-definitions.ts` - Update tool definition
4. `tests/handlers/analyze.test.ts` - Add planner tests
5. `docs/reference/tools/sheets_analyze.md` - Document action

**Implementation Steps:**

```typescript
// 1. src/schemas/analyze.ts (add to actions enum)
export const AnalyzeActionSchema = z.enum([
  'comprehensive',
  'quick',
  'formulas',
  'dependencies',
  'quality',
  'patterns',
  'plan', // NEW: Multi-step analysis planning
]);

// Add plan-specific schema
export const AnalyzePlanArgsSchema = z.object({
  spreadsheetId: z.string(),
  sheetId: z.number().optional(),
  goal: z.enum([
    'quick',
    'optimize',
    'clean',
    'visualize',
    'understand',
    'audit',
    'auto'
  ]).default('auto'),
  maxSteps: z.number().min(1).max(20).default(10),
  allowParallel: z.boolean().default(true),
});

// 2. src/handlers/analyze.ts (add handler)
import { Planner } from '../analysis/planner.js';
import { TieredRetrieval } from '../analysis/tiered-retrieval.js';

private async handlePlan(args: AnalyzePlanArgs): Promise<AnalysisResult> {
  const { spreadsheetId, sheetId, goal, maxSteps, allowParallel } = args;

  // Initialize services
  const tieredRetrieval = new TieredRetrieval(this.sheetsApi);
  const planner = new Planner(this.sheetsApi, tieredRetrieval);

  // Scout spreadsheet
  const scoutResult = await planner.scout(spreadsheetId, sheetId);

  // Create execution plan
  const plan = planner.createPlan(scoutResult, goal);

  // Filter by max steps
  if (plan.steps.length > maxSteps) {
    plan.steps = plan.steps.slice(0, maxSteps);
  }

  return {
    success: true,
    plan: {
      planId: plan.planId,
      goal: plan.intent,
      totalSteps: plan.steps.length,
      estimatedLatencyMs: plan.totalEstimatedLatencyMs,
      parallelizable: allowParallel ? plan.parallelizable : undefined,
      criticalPath: plan.criticalPath,
      steps: plan.steps.map(step => ({
        stepId: step.stepId,
        action: step.action,
        tool: step.tool,
        description: step.description,
        estimatedLatencyMs: step.estimatedLatencyMs,
        dependencies: step.dependencies,
      })),
    },
    metadata: {
      spreadsheetId,
      sheetId,
      timestamp: new Date().toISOString(),
    }
  };
}
```

**Documentation Update:**

````markdown
# docs/reference/tools/sheets_analyze.md

## Action: `plan`

**Purpose:** Generate multi-step analysis execution plan

**Use Cases:**

- Optimize large analysis workflows
- Understand critical path dependencies
- Identify parallelizable operations
- Estimate total analysis time

**Parameters:**

- `spreadsheetId` (required): Spreadsheet ID
- `sheetId` (optional): Target sheet
- `goal` (optional): Planning intent (default: `auto`)
- `maxSteps` (optional): Maximum plan steps (1-20, default: 10)
- `allowParallel` (optional): Enable parallel execution (default: true)

**Example:**

```json
{
  "tool": "sheets_analyze",
  "action": "plan",
  "args": {
    "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "goal": "optimize",
    "maxSteps": 8,
    "allowParallel": true
  }
}
```
````

**Response:**

```json
{
  "success": true,
  "plan": {
    "planId": "plan_abc123",
    "goal": "optimize",
    "totalSteps": 6,
    "estimatedLatencyMs": 8500,
    "parallelizable": [[0, 1], [2, 3, 4]],
    "criticalPath": [0, 2, 5],
    "steps": [...]
  }
}
```

````

**Tests:**

```typescript
// tests/handlers/analyze.test.ts
describe('sheets_analyze - plan action', () => {
  it('should generate execution plan with quick goal', async () => {
    const result = await handler.handle({
      action: 'plan',
      args: {
        spreadsheetId: TEST_SPREADSHEET_ID,
        goal: 'quick',
        maxSteps: 5,
      }
    });

    expect(result.success).toBe(true);
    expect(result.plan).toBeDefined();
    expect(result.plan.steps.length).toBeLessThanOrEqual(5);
    expect(result.plan.goal).toBe('quick');
  });

  it('should identify parallelizable steps', async () => {
    const result = await handler.handle({
      action: 'plan',
      args: {
        spreadsheetId: TEST_SPREADSHEET_ID,
        goal: 'optimize',
        allowParallel: true,
      }
    });

    expect(result.plan.parallelizable).toBeDefined();
    expect(Array.isArray(result.plan.parallelizable)).toBe(true);
  });
});
````

**Verification:**

```bash
# 1. Run tests
npm test tests/handlers/analyze.test.ts

# 2. Manual test via MCP Inspector
echo '{"tool":"sheets_analyze","action":"plan","args":{"spreadsheetId":"...","goal":"optimize"}}' | npx @modelcontextprotocol/inspector node dist/cli.js

# 3. Check metadata counts
npm run check:drift  # Should show +1 action
```

---

### 1C. Wire Streaming to MCP Progress Notifications (Day 4-5: 2-3 hours) ✅ COMPLETE

**Status:** ✅ **COMPLETE** - Streaming analyzer already integrated, just needed progress notification wiring

**Discovery:** The streaming implementation was already fully integrated:

- ✅ `StreamingAnalyzer` class exists at `src/analysis/streaming.ts` (214 LOC, AsyncGenerator pattern)
- ✅ Analyze handler routes large datasets (>50K cells) to streaming path via `AnalysisRouter`
- ✅ SSE transport exists for MCP protocol at `/sse` endpoint
- ❌ Progress callbacks only logged internally, not sent to client

**What was done:**

1. Added `sendProgress()` import to `src/handlers/analyze.ts`
2. Updated streaming progress callback to call `sendProgress()` with chunk progress
3. Now sends MCP progress notifications: `notifications/progress` with progressToken

**Files modified:**

1. `src/handlers/analyze.ts` - Added sendProgress() call in streaming callback (lines 1941-1946)

**How it works:**

```typescript
// src/handlers/analyze.ts (lines 53, 1941-1946)
// Import added:
import { sendProgress } from '../utils/request-context.js';

// In streaming case (line ~1925):
const streamingResult = await streamingAnalyzer.execute(
  req.spreadsheetId,
  sheetId as number | undefined,
  metadata,
  async (chunk) => {
    // Progress callback - send to client via MCP progress notifications
    const progressPercent = ((chunk.rowsProcessed / chunk.totalRows) * 100).toFixed(1);
    logger.info('Streaming progress', {
      chunkIndex: chunk.chunkIndex,
      totalChunks: chunk.totalChunks,
      progress: `${progressPercent}%`,
      partialResults: chunk.partialResults,
    });

    // Send MCP progress notification to client (if supported)
    await sendProgress(
      chunk.chunkIndex,
      chunk.totalChunks,
      `Processing chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks} (${progressPercent}% - ${chunk.rowsProcessed}/${chunk.totalRows} rows)`
    );
  }
);
```

**Automatic Routing to Streaming Path:**

```typescript
// src/analysis/router.ts:148-169
// AnalysisRouter automatically selects streaming path for large datasets
private routeAnalyzeData(request: SheetsAnalyzeInput, cellCount: number): RoutingDecision {
  // Streaming for very large datasets
  if (cellCount > 50_000) {
    if (!this.capabilities.hasTasks) {
      return { path: 'ai', reason: 'Large dataset but tasks unavailable' };
    }
    return {
      path: 'streaming',
      reason: 'Large dataset requires chunked processing via tasks',
      estimatedDuration: 60,
      cacheable: false,
      requiresSampling: false,
      requiresTasks: true,
    };
  }
  // ... other paths
}
```

**Client Experience:**

When analyzing large datasets (>50K cells), clients receive MCP progress notifications:

```json
{
  "method": "notifications/progress",
  "params": {
    "progressToken": "analysis-12345",
    "progress": 5,
    "total": 50,
    "message": "Processing chunk 6/50 (12.0% - 6000/50000 rows)"
  }
}
```

**Benefits:**

- Clients can show real-time progress UI
- No timeout issues on large operations (Claude Desktop gets keepalive signals)
- Memory efficient: processes in 1000-row chunks
- Automatic: router selects streaming path for datasets >50K cells
- Progress tracking: Real-time updates

**Usage:**

```json
{
  "tool": "sheets_analyze",
  "action": "comprehensive",
  "args": {
    "spreadsheetId": "...",
    "streaming": true,
    "chunkSize": 1000
  }
}
```

**Response (SSE format):**

```
data: {"chunk":{"chunkIndex":0,"totalChunks":50,"rowsProcessed":1000,"partialResults":{...}}}

data: {"chunk":{"chunkIndex":1,"totalChunks":50,"rowsProcessed":2000,"partialResults":{...}}}

...

data: {"done":true}
```

**MCP Client Handling:**

MCP clients that support progress notifications will automatically receive updates. The MCP SDK handles the transport layer.

```typescript
// Client receives notifications via MCP protocol:
// notifications/progress with progressToken, progress, total, message
```

**Current Implementation Status:**

- ✅ Streaming analyzer processes in chunks (memory efficient)
- ✅ Router auto-selects streaming for >50K cells
- ✅ Progress notifications sent to client via `sendProgress()`
- ✅ Aggregated results returned at end
- ⏭️ Future: Add integration tests (not blocking for Phase 1)

**Verification:**

```bash
# 1. TypeScript compilation passes
npm run typecheck  # Should pass with no errors

# 2. All tests pass
npm run test  # Existing tests should pass

# 3. Verify routing logic
# The AnalysisRouter at src/analysis/router.ts:148-169
# automatically selects streaming path when cellCount > 50_000

# 4. Full build verification
npm run verify  # All checks pass
```

---

## Phase 2: High-Value Features (Week 2) - 5 days

### 2A. Extend Distributed Cache to Data Responses (Day 6-8: 12-16 hours)

**Status:** 60% complete, caches capabilities only

**Files to modify:**

1. `src/services/capability-cache.ts` - Rename to `distributed-cache.ts`, generalize
2. `src/services/google-api.ts` - Use cache for data responses
3. `src/services/cached-sheets-api.ts` - Integrate L2 cache
4. `src/config/env.ts` - Add cache configuration
5. `tests/services/distributed-cache.test.ts` - Add tests
6. `docs/guides/PERFORMANCE.md` - Document caching strategy

**Implementation:**

See detailed implementation in full plan (distributed-cache.ts code sample above)

**Verification:**

```bash
# 1. Run cache tests
npm test tests/services/distributed-cache.test.ts

# 2. Verify Redis integration
REDIS_URL=redis://localhost:6379 npm test

# 3. Check cache hit rate
npm run test:load -- --cache-metrics
```

---

### 2B. Expand E2E Test Coverage (Day 9-10: 8-12 hours)

**Status:** 30% complete (basic CRUD only)

**Files to create:**

1. `tests/e2e/workflows/analysis-workflow.test.ts`
2. `tests/e2e/workflows/transaction-workflow.test.ts`
3. `tests/e2e/workflows/collaboration-workflow.test.ts`
4. `tests/e2e/workflows/automation-workflow.test.ts`
5. `tests/e2e/setup/test-orchestrator.ts`

**Implementation:**

```typescript
// tests/e2e/workflows/analysis-workflow.test.ts
import { describe, it, expect } from 'vitest';
import { createE2EClient } from '../setup/test-orchestrator.js';

describe('E2E: Analysis Workflow', () => {
  it('should complete full analysis pipeline', async () => {
    const client = await createE2EClient();

    // 1. Create test spreadsheet
    const { spreadsheetId } = await client.call('sheets_core', {
      action: 'create_spreadsheet',
      args: { title: 'E2E Analysis Test' },
    });

    // 2. Populate with sample data (1000 rows)
    await client.call('sheets_data', {
      action: 'write',
      args: {
        spreadsheetId,
        range: 'A1:E1000',
        values: generateTestData(1000, 5),
      },
    });

    // 3. Generate analysis plan
    const { plan } = await client.call('sheets_analyze', {
      action: 'plan',
      args: {
        spreadsheetId,
        goal: 'optimize',
        maxSteps: 10,
      },
    });

    expect(plan.steps.length).toBeGreaterThan(0);

    // 4. Execute plan steps
    for (const step of plan.steps) {
      const result = await client.call(step.tool, {
        action: step.action,
        args: step.args,
      });
      expect(result.success).toBe(true);
    }

    // 5. Verify analysis results
    const { analysis } = await client.call('sheets_analyze', {
      action: 'comprehensive',
      args: { spreadsheetId },
    });

    expect(analysis.quality_score).toBeGreaterThan(70);

    // Cleanup
    await client.call('sheets_core', {
      action: 'delete_spreadsheet',
      args: { spreadsheetId },
    });
  });
});
```

**Verification:**

```bash
# Run E2E tests
npm run test:e2e

# Run with coverage
npm run test:e2e -- --coverage

# Expected: 5+ workflows, 30+ assertions, 90%+ pass rate
```

---

## Phase 3: Scale & Performance (Week 3) - 5 days

### 3A. Scale Load Testing to 1000+ Concurrent (Day 11-13)

**Current:** Max 10 concurrent, simple scenarios
**Target:** 1000+ concurrent, mixed workload, sustained load

**Files:**

1. `tests/load/k6-script.js` (new)
2. `tests/load/scenarios.ts` (new)
3. `.github/workflows/performance-gate.yml` (new)

**Implementation:**

```javascript
// tests/load/k6-script.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    reads: {
      executor: 'constant-arrival-rate',
      rate: 700,
      duration: '5m',
      preAllocatedVUs: 100,
      maxVUs: 500,
      exec: 'readScenario',
    },
    writes: {
      executor: 'constant-arrival-rate',
      rate: 200,
      duration: '5m',
      preAllocatedVUs: 50,
      maxVUs: 200,
      exec: 'writeScenario',
    },
    analysis: {
      executor: 'constant-arrival-rate',
      rate: 100,
      duration: '5m',
      preAllocatedVUs: 20,
      maxVUs: 100,
      exec: 'analysisScenario',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<400'], // 95% < 400ms
    http_req_duration: ['p(99)<2000'], // 99% < 2s
    errors: ['rate<0.01'], // <1% error rate
  },
};

export function readScenario() {
  const res = http.post(
    'http://localhost:3000/v1/tools/call',
    JSON.stringify({
      name: 'sheets_data',
      arguments: {
        action: 'read',
        args: {
          spreadsheetId: __ENV.TEST_SPREADSHEET_ID,
          range: 'A1:Z100',
        },
      },
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 400ms': (r) => r.timings.duration < 400,
  }) || errorRate.add(1);

  sleep(0.1);
}
```

**Run:**

```bash
# Install k6
brew install k6  # macOS

# Run load test
TEST_SPREADSHEET_ID=... k6 run tests/load/k6-script.js

# Expected: ✓ 1000 req/s, P95 < 400ms, error rate < 1%
```

---

## Documentation Updates

### New Docs to Create

1. `docs/guides/STREAMING.md` - Streaming analysis guide
2. `docs/guides/CACHING.md` - Multi-tier caching guide
3. `docs/guides/BACKGROUND_ANALYSIS.md` - Background monitoring
4. `docs/reference/tools/sheets_plan.md` - Multi-step planning reference

### Docs to Update

1. `docs/guides/PERFORMANCE.md` - Add streaming, caching sections
2. `docs/guides/MONITORING.md` - Add background analysis
3. `docs/README.md` - Add new features
4. `README.md` - Update feature list

---

## Verification Checklist

After each phase, run:

```bash
# 1. Full verification suite
npm run verify

# 2. Integration tests
npm run test:integration

# 3. Load tests (local)
npm run test:load

# 4. E2E tests
npm run test:e2e

# 5. Metadata sync check
npm run check:drift

# 6. Documentation validation
npm run docs:validate

# 7. Build check
npm run build
npm run verify:build
```

**Success Criteria:**

- ✅ All verify checks pass
- ✅ Test count increases by 50+ tests
- ✅ Action count increases by 1 (plan action)
- ✅ Load test: 1000 req/s, P95 < 400ms
- ✅ E2E coverage: 5+ workflows
- ✅ Documentation: 4+ new docs

---

## Timeline Summary

| Phase      | Duration | Deliverables                                 |
| ---------- | -------- | -------------------------------------------- |
| **Week 1** | 5 days   | Background analysis, planner tool, streaming |
| **Week 2** | 5 days   | Distributed cache, E2E tests                 |
| **Week 3** | 5 days   | Load testing 1000+, documentation            |
| **Total**  | 15 days  | 40% of top 1% value delivered                |

**ROI:** 4x faster than building from scratch (3 weeks vs 12 weeks for 40% of value)

---

## Next Steps

1. **Start with Phase 1A** (Day 1) - Immediate value, lowest risk
2. **Verify each step** before moving to next
3. **Update this plan** as you discover issues
4. **Track metrics** to validate improvements

**Ready to execute?** Start with:

```bash
git checkout -b feature/integration-phase-1
npm run verify  # Ensure clean baseline
```
