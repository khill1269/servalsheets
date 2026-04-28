---
name: Stress Test Infrastructure Baseline Audit
description: Complete audit of existing performance testing, load simulation, quota management, and concurrency infrastructure with design recommendations for comprehensive stress test system
type: reference
---

# ServalSheets Stress Test Infrastructure Audit

**Session:** Ground Truth Research (2026-04-28)  
**Scope:** Performance benchmarking, load simulation, concurrency management, quota handling, and comprehensive scenario testing  
**Status:** Complete baseline established; design ready for implementation

---

## EXECUTIVE SUMMARY

ServalSheets has strong foundational performance infrastructure but **lacks end-to-end scenario stress testing**. Current setup measures:
- ✅ Schema validation performance (9 benchmarks across 409 actions)
- ✅ Memory leaks under sustained load (1,000+ validations)
- ✅ Response building latency
- ✅ Concurrency coordinator with adaptive quota management
- ✅ Circuit breaker with 429 error recovery
- ✅ Batching system with adaptive window sizing
- ❌ Multi-user concurrent workflow scenarios
- ❌ AI+Sheets user journey simulation
- ❌ Fault injection (quota exhaustion, network failures, auth expiry)
- ❌ Agent plan execution under contention
- ❌ Cache efficiency under load
- ❌ Transaction/session state persistence stress

**Recommended Build:** 5-phase stress test system generating 1000+ dynamic scenarios with fault injection and real-world AI usage patterns.

---

## PART 1: EXISTING INFRASTRUCTURE

### 1.1 Performance Benchmarking (tests/audit/performance-profile.bench.ts)

**What it measures:**
- Schema validation per tool (409 actions sampled)
- Invalid input rejection speed (error fast-path)
- Fixture generation throughput (409 fixtures)
- Response building time (small/medium/large payloads)
- JSON serialization (MCP output bottleneck)
- Full action sweep (all 409 validations)
- Memory pressure (500 sequential validations)

**Metrics collected:**
- Per-benchmark timing (Vitest benchmarks)
- Throughput (#ops per second)
- Memory baseline (heap before/after)

**Limitations:**
- Single-threaded (no concurrency testing)
- Synthetic payloads only (not end-to-end API calls)
- No real Google API latency simulation
- No user journey scenarios

**Run command:** `npm run audit:perf` (~10-15 sec)

---

### 1.2 Memory Leak Detection (tests/audit/memory-leaks.test.ts)

**What it tests:**
- 1,000 schema validations < 50MB growth
- 50× fixture generations < 50MB growth
- 1,000 mixed valid/invalid parsing (error GC)
- 500 serialize cycles (JSON→Object→JSON)
- 10,000 TOOL_ACTIONS map accesses (static map stability)

**Metrics:**
- Heap before/after (forced GC)
- Growth threshold: 50MB max (configurable)
- Allocation tracking for each scenario

**Limitations:**
- Validation-only (no API calls)
- No concurrency
- No long-running state (sessions, contexts)

**Run command:** `npm run audit:memory` (~3-5 sec)

---

### 1.3 Concurrency Coordinator (src/services/concurrency-coordinator.ts)

**Architecture:**
- Semaphore pattern with FIFO queue
- Global limit: 15 concurrent operations (default)
- Per-operation tracking with source/start-time
- Adaptive adjustment: quota-based and heap-pressure-aware

**Configuration:**
```typescript
{
  maxConcurrent: 25,              // Current limit (adaptive)
  enableAdaptive: true,           // On/off
  minConcurrent: 5,               // Floor
  maxConcurrentCeiling: 30,       // Ceiling
  adjustmentIntervalMs: 10000,    // Check every 10s
  enableMetrics: true,            // Prometheus hooks
  verboseLogging: false,          // Debug mode
}
```

**Adaptive rules:**
- Quota > 80%: Reduce by 20% (avoid 429)
- Quota < 50%: Increase by 20% (optimize throughput)
- Heap > 80%: Reduce by 30% (prevent OOM)
- 429 error: Reduce by 5 (immediate)

**Metrics tracked:**
```typescript
activeOperations: number;
peakConcurrent: number;
totalOperations: number;
totalWaitTimeMs: number;
limitReachedCount: number;
averageWaitTimeMs: number;
rateLimitErrorCount: number;
currentLimit: number;           // Dynamic
limitAdjustmentCount: number;
timeSinceLast429Ms: number | null;
minimumLimitReached: boolean;
maximumLimitReached: boolean;
```

**Test coverage:**
- ✅ Basic permit acquire/release
- ✅ Queue ordering (FIFO)
- ✅ Concurrency enforcement (5 concurrent ops)
- ✅ execute() wrapper (auto acquire/release)
- ✅ Error handling (permit released on throw)
- ❌ Adaptive adjustment under load
- ❌ Quota reporting and tracking
- ❌ 429 recovery integration test
- ❌ Heap pressure scenario

**File:** `src/services/concurrency-coordinator.ts:1-400`

---

### 1.4 Batching System (src/services/batching-system.ts)

**Architecture:**
- Queue-based operation collection
- Adaptive window sizing (20-100ms default)
- 100-op limit per API call
- Low/high threshold triggers adjustment

**Adaptive window logic:**
```typescript
if (opsInBatch < 3): increase window by 20%
if (opsInBatch > 50): decrease window by 20%
else: maintain
```

**Metrics:**
- `totalOperations`: cumulative
- `totalBatches`: number compiled
- `currentWindowMs`: dynamic window size
- `avgWindowMs`: average over history

**Limitations:**
- No end-to-end test with real Google API
- Window adjustment untested under load
- No failure handling (429, network timeout)

---

### 1.5 Circuit Breaker (src/utils/circuit-breaker.ts + registry)

**Patterns:**
- Per-endpoint circuit breaker
- States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (recovery)
- QuotaCircuitBreaker for 429-specific handling
- Fallback strategies: cached data, partial result, error

**Registry:**
- Global circuit-breaker-registry.ts
- Per-spreadsheet throttle (PER_SPREADSHEET_RPS env var)
- Shared Drive rate limiter (token bucket, 3 RPS)

**Metrics:**
- State transitions
- Error counts
- Recovery time

---

### 1.6 Google API Client (src/services/google-api.ts)

**Features:**
- Connection pooling (HTTP/2 when available)
- Token management with keychain fallback
- Retry with exponential backoff
- Per-request timeout (configurable)
- Request context tracking

**Existing integration:**
- ConcurrencyCoordinator wrapper
- Circuit breaker integration
- Metrics reporting (lazy-loaded)

---

### 1.7 Audit Gates (scripts/audit-gate.sh)

**15 gates run in CI:**
1. TypeScript compiles
2. No metadata drift
3. Architecture boundaries
4. Integration wiring
5. No silent fallbacks
6. No debug prints
7. Action coverage passes
8. Memory leak tests pass
9. Contract tests pass
10. Google API compliance
11. MCP protocol compliance (2025-11-25)
12. Source/dist consistency
13. MCP feature coverage
14. Live test structural coverage
15. Mutation testing (critical paths, >= 60%)

**Performance tracking CI:** `.github/workflows/performance-tracking.yml`
- Baseline caching per branch
- P95 latency regression detection (>15% = fail)
- Performance dashboard (GitHub Pages)
- PR comment with results

---

## PART 2: STRESS TEST INFRASTRUCTURE GAPS

### 2.1 Missing: End-to-End Scenario Testing

**Current:** Synthetic microbenchmarks  
**Needed:** Real handler → Google API call chains

Example missing:
```
1. User reads 100-cell range (data.read)
2. Analyzes data quality (analyze.scout)
3. Applies conditional format (format.add_conditional_format_rule)
4. Writes results (data.write)
5. Records operation (session.record_operation)
```

### 2.2 Missing: Multi-User Concurrency Scenarios

**Current:** Single user per test  
**Needed:** 50-1000 concurrent users with realistic think-time

Example scenario:
```
50 users simultaneously:
  - Each reads their own spreadsheet
  - Apply filters (dimensions.set_basic_filter)
  - Pivot/aggregate (compute.* or custom formulas)
  - Export results
  - Record operation
```

### 2.3 Missing: AI+Sheets User Journey Simulation

**Current:** Individual action coverage  
**Needed:** LLM-driven agent workflows

```
Agent plan:
  1. sheets_analyze.scout → understand structure
  2. sheets_format.suggest_format → analyze data
  3. sheets_composite.import_csv → load external data
  4. sheets_advanced.batch_custom_explain → explain anomalies
  5. sheets_data.batch_write → update
  6. sheets_session.record_operation → persist
```

### 2.4 Missing: Fault Injection

**Current:** Success path only  
**Needed:** Resilience under:
- Quota exhaustion (429 errors)
- Network latency/timeouts
- Auth token expiry
- Partial failures in batch operations
- Concurrent modification conflicts
- Circuit breaker open state

### 2.5 Missing: Cache Efficiency Metrics

**Current:** No cache hit/miss tracking  
**Needed:** Measure cache effectiveness under load

```
- Cache hit rate by tool
- Invalidation latency
- Stale data incidents
- Prefetch effectiveness
```

### 2.6 Missing: Agent Plan Execution Stress

**Current:** Handler unit tests  
**Needed:** 10-100 step plans under contention

```
- Step timeout detection
- Reflexion retry under load
- Checkpoint recovery
- Plan state persistence
- Session context race conditions
```

### 2.7 Missing: Transaction Boundary Testing

**Current:** Individual operations  
**Needed:** Multi-step transactions under load

```
- Begin/rollback at scale
- Deadlock detection
- Concurrent transaction conflicts
- Snapshot consistency
```

---

## PART 3: RECOMMENDED ARCHITECTURE

### 3.1 Scenario Generator

**Purpose:** Generate 1000+ deterministic test scenarios from templates

**Location:** `tests/stress/scenario-generator.ts`

**Template categories:**
1. **Sequential I/O:** read → analyze → write (1 user, 10-100 cells)
2. **Concurrent dashboards:** 50 users, each read 1000 cells
3. **Agent workflows:** 5-20 step plans with branching
4. **Batch operations:** 100-1000 cells in single call
5. **BigQuery import:** CSV → sheets → BigQuery export
6. **Collaboration:** Concurrent edits to same sheet
7. **Transaction stress:** Begin/commit/rollback loops
8. **Session persistence:** Multi-day session state
9. **Quota saturation:** 100 rapid operations
10. **Recovery flows:** 429 → backoff → retry

**Scenario metadata:**
```typescript
interface StressScenario {
  id: string;                    // unique ID
  name: string;                  // human-readable
  description: string;           // what it tests
  category: ScenarioCategory;
  concurrentUsers: number;
  durationMs: number;
  steps: ExecutionStep[];
  expectedMetrics: {
    p50LatencyMs: number;
    p95LatencyMs: number;
    maxErrorRate: number;
    minCacheHitRate: number;
  };
  faultInjection?: {
    quota429At?: number;          // % of operations
    networkLatencyMs?: number;
    authExpiryAt?: number;        // step number
    partialBatchFailure?: number; // % of batch ops
  };
}
```

**Generation logic:**
```
1. Start with base template (e.g., "sequential I/O")
2. Vary:
   - Cell counts (10, 100, 1000, 10000)
   - User counts (1, 5, 50, 100, 1000)
   - Step complexity (3 steps, 10 steps, 20 steps)
   - Data sizes (small, medium, large, huge)
   - Error injection (none, quota, network, auth)
3. Generate deterministic data (seeded RNG)
4. Register in scenario catalog
```

**Output:** File-based registry (JSON)
```json
{
  "scenarios": [
    {
      "id": "seq-io-small-1",
      "name": "Sequential I/O (10 cells, 1 user)",
      "category": "sequential_io",
      ...
    }
  ],
  "count": 1247,
  "lastGenerated": "2026-04-28T15:30:00Z"
}
```

---

### 3.2 Load Test Runner

**Purpose:** Execute scenarios with monitoring and metrics collection

**Location:** `tests/stress/load-test-runner.ts`

**Responsibilities:**
1. Load scenario catalog
2. Instantiate mock Google API or use live endpoints
3. Spawn concurrent users
4. Inject faults at specified times
5. Collect metrics
6. Generate report

**Orchestration:**
```typescript
class LoadTestRunner {
  private coordinator: ConcurrencyCoordinator;
  private metrics: LoadTestMetrics;
  private scenarios: StressScenario[];

  async run(scenarioId: string, options: RunOptions): Promise<LoadTestResult> {
    // 1. Load scenario
    const scenario = await this.loadScenario(scenarioId);

    // 2. Initialize
    await this.setup(scenario);

    // 3. Run concurrently
    const promises = [];
    for (let i = 0; i < scenario.concurrentUsers; i++) {
      promises.push(this.runUser(i, scenario));
    }

    // 4. Monitor + inject faults
    this.startFaultInjection(scenario.faultInjection);

    // 5. Wait for completion
    await Promise.all(promises);

    // 6. Analyze
    return this.generateReport();
  }

  private async runUser(userId: number, scenario: StressScenario): Promise<void> {
    for (const step of scenario.steps) {
      const result = await this.coordinator.execute(`user-${userId}`, async () => {
        return await this.executeStep(step, userId);
      });

      this.recordMetric(userId, step.action, result);
    }
  }
}
```

---

### 3.3 Fault Injection Engine

**Purpose:** Simulate real-world failures at specified times

**Location:** `tests/stress/fault-injector.ts`

**Fault types:**
```typescript
type FaultType = 
  | 'quota_429'           // 429 HTTP response
  | 'timeout'             // Exceed operation timeout
  | 'network_latency'     // Add artificial delay
  | 'auth_expired'        // Expired OAuth token
  | 'partial_batch_fail'  // N% of batch ops fail
  | 'circuit_open'        // Force circuit breaker open
  | 'heap_pressure'       // Spike memory usage
  | 'connection_reset';   // TCP reset

interface FaultEvent {
  type: FaultType;
  triggerAt: number;              // Step index or % of ops
  duration?: number;              // How long to inject
  probability?: number;           // 0-1 for random injection
  affectedTools?: string[];       // Scope to specific tools
  metadata?: Record<string, any>; // Fault-specific config
}
```

**Injection points:**
- Pre-API call (intercept handler)
- Google API response (mock client)
- Concurrency coordinator (quota tracking)
- Circuit breaker (state manipulation)
- Token manager (expiry simulation)

---

### 3.4 Metrics Collector

**Purpose:** Gather detailed performance + reliability metrics

**Location:** `tests/stress/metrics-collector.ts`

**Metrics:**
```typescript
interface LoadTestMetrics {
  // Latency
  latency: {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    maxMs: number;
    meanMs: number;
  };

  // Success/failure
  success: { count: number; rate: number };
  failure: {
    count: number;
    rate: number;
    byErrorCode: Record<string, number>;
  };

  // Concurrency
  concurrency: {
    peakSimultaneous: number;
    averageQueueDepth: number;
    maxQueueDepth: number;
  };

  // Cache
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
  };

  // Quota
  quota: {
    requestsMade: number;
    quota429Count: number;
    recoveryTimeMs: number[];
  };

  // Resource
  memory: {
    peakHeapMB: number;
    averageHeapMB: number;
    gcCount: number;
  };

  // Custom
  custom: Record<string, number | string>;
}
```

**Collection mechanism:**
```typescript
// Hook into handlers via decorator
async executeWithMetrics<T>(
  tool: string,
  action: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  const startMem = process.memoryUsage().heapUsed;

  try {
    const result = await fn();
    const duration = performance.now() - start;

    this.recordSuccess(tool, action, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    this.recordFailure(tool, action, duration, error);
    throw error;
  }
}
```

---

### 3.5 Mock Google API Provider

**Purpose:** Simulate Google Sheets API with realistic latency + failures

**Location:** `tests/stress/mock-google-api-provider.ts`

**Capabilities:**
- Realistic latency distribution (normal + outliers)
- Quota tracking (60 req/min simulation)
- 429 error responses at specified times
- Partial failure in batch operations
- Token expiry simulation
- Connection timeout simulation

**Configuration:**
```typescript
interface MockApiConfig {
  // Latency simulation
  baseLatencyMs: number;           // 50ms average
  latencyVariance: number;         // ±20%
  outlierProbability: number;      // 5% get 5x latency

  // Quota
  quotaWindow: number;             // 60000ms (60s)
  quotaPerWindow: number;          // 60 requests
  quota429StartAt?: number;        // Fail at X% utilization

  // Failures
  failureRate: number;             // 0.0-1.0
  timeoutRate: number;
  batchPartialFailureRate: number;
}
```

**Request simulation:**
```typescript
async executeRequest(
  tool: string,
  action: string,
  params: Record<string, any>
): Promise<ApiResponse> {
  // 1. Check quota
  if (!this.checkQuota()) {
    return {
      status: 429,
      error: 'RATE_LIMIT_EXCEEDED',
      retryAfter: this.calculateBackoffMs(),
    };
  }

  // 2. Simulate latency
  const latency = this.generateLatency();
  await sleep(latency);

  // 3. Simulate failure
  if (Math.random() < this.config.failureRate) {
    return {
      status: 500,
      error: 'INTERNAL_ERROR',
    };
  }

  // 4. Return success
  return {
    status: 200,
    data: this.generateMockResponse(tool, action, params),
  };
}
```

---

### 3.6 Integration with CI

**Location:** `.github/workflows/stress-testing.yml` (new)

**Trigger:** Nightly + PR (opt-in with label)

**Stages:**
1. Build + unit tests
2. Run 10 small scenarios (~5 min)
3. Run 50 medium scenarios (~15 min)
4. Generate report
5. Compare vs baseline
6. Block merge if regression > 10%

**Artifacts:**
- Scenario results (JSON)
- Performance dashboard (HTML)
- Fault injection analysis
- Concurrent user breakdown

---

## PART 4: IMPLEMENTATION PLAN

### Phase 1: Scenario Generation (Week 1)
- [ ] `tests/stress/scenario-generator.ts` (500 LOC)
- [ ] 10 base scenario templates
- [ ] Catalog generation + validation
- [ ] Unit tests for generator logic

### Phase 2: Load Test Runner (Week 2)
- [ ] `tests/stress/load-test-runner.ts` (600 LOC)
- [ ] Concurrency orchestration
- [ ] Integration with mock API
- [ ] Result aggregation

### Phase 3: Fault Injection (Week 2)
- [ ] `tests/stress/fault-injector.ts` (400 LOC)
- [ ] 8 fault types
- [ ] Injection point adapters
- [ ] Recovery verification

### Phase 4: Metrics + Reporting (Week 3)
- [ ] `tests/stress/metrics-collector.ts` (300 LOC)
- [ ] Dashboard generation
- [ ] Baseline comparison
- [ ] Performance regression detection

### Phase 5: Mock API + CI (Week 3)
- [ ] `tests/stress/mock-google-api-provider.ts` (500 LOC)
- [ ] `.github/workflows/stress-testing.yml` (150 LOC)
- [ ] CI integration
- [ ] Nightly runs + PR gates

### Phase 6: AI Scenario Expansion (Week 4)
- [ ] Agent plan scenario templates
- [ ] Multi-step workflow fixtures
- [ ] Session state persistence tests
- [ ] Transaction boundary scenarios

---

## PART 5: SPECIFIC STRESS TEST SCENARIOS

### Scenario 1: Sequential Read-Analyze-Write (1 user)

```typescript
{
  id: "seq-io-10c-small",
  name: "Sequential I/O (10 cells, small)",
  concurrentUsers: 1,
  durationMs: 5000,
  steps: [
    { action: 'sheets_data.read', params: { range: 'Sheet1!A1:A10' } },
    { action: 'sheets_analyze.scout', params: { limit: 10 } },
    { action: 'sheets_format.suggest_format', params: { range: 'Sheet1!A1:A10' } },
    { action: 'sheets_data.write', params: { range: 'Sheet1!B1:B10', values: [['new']] } },
    { action: 'sheets_session.record_operation', params: { action: 'write', description: 'Updated format' } },
  ],
  expectedMetrics: {
    p50LatencyMs: 150,
    p95LatencyMs: 300,
    maxErrorRate: 0.01,
  },
}
```

### Scenario 2: Concurrent Dashboard Builds (50 users)

```typescript
{
  id: "concurrent-dashboards-50u",
  name: "Concurrent Dashboard Builds (50 users, 1000 cells each)",
  concurrentUsers: 50,
  durationMs: 30000,
  steps: [
    // Each user repeats:
    { action: 'sheets_data.read', params: { ranges: ['Sheet1!A1:J100'] } },
    { action: 'sheets_dimensions.set_basic_filter', params: { range: 'Sheet1!A1:J100' } },
    { action: 'sheets_visualize.chart_create', params: { ... } },
    // Think time (2 sec)
    { action: 'sheets_session.record_operation', params: { ... } },
  ],
  faultInjection: {
    networkLatencyMs: 50,  // Add 50ms extra
  },
}
```

### Scenario 3: Agent Plan Execution (10-step workflow)

```typescript
{
  id: "agent-plan-10step",
  name: "Agent Plan: Analyze + Clean + Export (10 steps)",
  concurrentUsers: 10,
  durationMs: 60000,
  steps: [
    { action: 'sheets_analyze.scout', params: {} },
    { action: 'sheets_quality.analyze_impact', params: { range: 'Sheet1!A1:Z1000' } },
    { action: 'sheets_analyze.explain_analysis', params: { ... } },
    { action: 'sheets_fix.clean', params: { issues: ['duplicates', 'blanks'] } },
    { action: 'sheets_advanced.batch_custom_explain', params: { formulas: [...] } },
    { action: 'sheets_format.batch_format', params: { ... } },
    { action: 'sheets_dimensions.auto_resize', params: { sheetId: 0, dimension: 'COLUMNS' } },
    { action: 'sheets_data.batch_write', params: { data: [...] } },
    { action: 'sheets_visualize.chart_create', params: { ... } },
    { action: 'sheets_session.record_operation', params: { action: 'agent_plan', stepCount: 10 } },
  ],
  expectedMetrics: {
    p50LatencyMs: 5000,
    p95LatencyMs: 8000,
  },
}
```

### Scenario 4: Quota Saturation + Recovery (100 users, quota injection)

```typescript
{
  id: "quota-saturation-recovery",
  name: "Quota Saturation + Recovery",
  concurrentUsers: 100,
  durationMs: 120000,
  steps: [
    // Rapid fire requests
    { action: 'sheets_data.read', params: { range: 'Sheet1!A1:A10' } },
    // Repeat 10x per user
  ],
  faultInjection: {
    quota429At: 80,  // Start 429 when quota > 80%
    duration: 30000, // For 30 seconds
  },
  expectedMetrics: {
    quota: {
      quota429Count: ">= 50",  // At least 50 get 429
      recoveryTimeMs: "<= 5000", // Recover within 5s
    },
  },
}
```

### Scenario 5: Concurrent Edits + Collaboration (50 users)

```typescript
{
  id: "collab-concurrent-edits",
  name: "Concurrent Editing (50 users, same sheet)",
  concurrentUsers: 50,
  durationMs: 60000,
  steps: [
    { action: 'sheets_session.set_active', params: { spreadsheetId: 'SHARED_SHEET' } },
    { action: 'sheets_data.write', params: { range: 'Sheet1!A[USER_ID]:B[USER_ID]', values: [['data']] } },
    { action: 'sheets_collaborate.comment_add', params: { cell: 'A1', text: 'Comment from user [USER_ID]' } },
    { action: 'sheets_session.record_operation', params: {} },
  ],
  expectedMetrics: {
    success: { rate: ">= 0.95" },  // At least 95% succeed
  },
}
```

### Scenario 6: BigQuery Import → Transform → Export (1 user, 10K rows)

```typescript
{
  id: "bigquery-pipeline-10k",
  name: "BigQuery Import + Transform + Export (10K rows)",
  concurrentUsers: 1,
  durationMs: 120000,
  steps: [
    { action: 'sheets_bigquery.import_table', params: { table: 'my_table', limit: 10000 } },
    { action: 'sheets_analyze.scout', params: {} },
    { action: 'sheets_advanced.batch_custom_explain', params: { ... } },
    { action: 'sheets_dimensions.append', params: { sheetId: 0, count: 100 } },
    { action: 'sheets_data.batch_write', params: { data: [...] } },
    { action: 'sheets_bigquery.export', params: { destination: 'export_table' } },
    { action: 'sheets_session.record_operation', params: { action: 'bigquery_pipeline' } },
  ],
  expectedMetrics: {
    p95LatencyMs: 30000,
  },
}
```

### Scenario 7: Transaction Stress (rollback/commit loops)

```typescript
{
  id: "transaction-stress-100u",
  name: "Transaction Begin/Commit Under Contention (100 users)",
  concurrentUsers: 100,
  durationMs: 60000,
  steps: [
    { action: 'sheets_transaction.begin', params: {} },
    { action: 'sheets_data.write', params: { range: 'Sheet1!A[USER_ID]:A[USER_ID]', values: [['val']] } },
    { action: 'sheets_format.format_cells', params: { range: '...', formatting: {...} } },
    { action: 'sheets_transaction.commit', params: { safety: { confirmed: true } } },
  ],
  expectedMetrics: {
    success: { rate: ">= 0.99" },  // 99% commit success
  },
}
```

### Scenario 8: Large Batch Operations (1000 cells per user)

```typescript
{
  id: "batch-format-1000c",
  name: "Batch Format 1000 Cells",
  concurrentUsers: 10,
  durationMs: 60000,
  steps: [
    { action: 'sheets_format.batch_format', params: {
      operations: Array(100).fill({
        type: 'text_format',
        range: 'Sheet1!A[ROW]:Z[ROW]',
        textFormat: { bold: true, foregroundColor: { red: 1 } },
      }),
    }},
    { action: 'sheets_session.record_operation', params: {} },
  ],
  expectedMetrics: {
    p95LatencyMs: 2000,
  },
}
```

### Scenario 9: Session State Persistence (multi-day sim)

```typescript
{
  id: "session-persistence-multiday",
  name: "Session State Persistence (simulated multi-day)",
  concurrentUsers: 5,
  durationMs: 300000,  // 5 minutes = 5 "days" at 60x speedup
  steps: [
    // Day 1: Set context
    { action: 'sheets_session.set_active', params: { spreadsheetId: 'PERSISTENCE_TEST' } },
    { action: 'sheets_session.update_preferences', params: { autoRecord: true } },
    { action: 'sheets_data.read', params: { range: 'Sheet1!A1:J100' } },

    // Day 2: Resume context
    { action: 'sheets_session.get_context', params: {} },  // Should remember spreadsheetId
    { action: 'sheets_history.undo', params: { steps: 1 } },

    // Day 3: Multi-operation workflow
    { action: 'sheets_data.append', params: { range: 'Sheet1!A:A', values: [['new']] } },
    { action: 'sheets_session.get_history', params: { limit: 20 } },

    // Day 4: Complex state
    { action: 'sheets_analyze.scout', params: {} },

    // Day 5: Verify history
    { action: 'sheets_history.timeline', params: { limit: 50 } },
  ],
  expectedMetrics: {
    success: { rate: ">= 0.98" },
  },
}
```

### Scenario 10: Error Recovery + Resilience (fault injection heavy)

```typescript
{
  id: "resilience-full-fault-injection",
  name: "Resilience Under All Faults",
  concurrentUsers: 25,
  durationMs: 120000,
  steps: [
    { action: 'sheets_data.read', params: { range: 'Sheet1!A1:J100' } },
    { action: 'sheets_analyze.scout', params: {} },
    { action: 'sheets_data.write', params: { ... } },
    { action: 'sheets_session.record_operation', params: {} },
  ],
  faultInjection: {
    quota429At: 70,
    networkLatencyMs: 100,
    authExpiryAt: 50,  // Step 50: simulate expired token
    partialBatchFailure: 0.1,  // 10% of batch ops fail
    circuitBreakerOpenAt: 75,  // Force open at 75% duration
  },
  expectedMetrics: {
    success: { rate: ">= 0.85" },  // 85% succeed even under all faults
    quota: { recoveryTimeMs: "<= 10000" },  // Recover within 10s of 429
  },
}
```

---

## PART 6: BASELINE MEASUREMENTS (Current State)

From existing infrastructure:

| Metric | Value | Source |
|--------|-------|--------|
| Schema validation latency (per action) | 0.1–0.5ms | performance-profile.bench.ts |
| Response building (small payload) | 0.05ms | performance-profile.bench.ts |
| Response building (1000 cells) | 0.2–0.5ms | performance-profile.bench.ts |
| JSON serialization (1000 cells) | 0.3–0.8ms | performance-profile.bench.ts |
| Memory baseline (409 actions) | ~50MB | memory-leaks.test.ts |
| Memory growth (1000 validations) | < 50MB | memory-leaks.test.ts |
| Concurrency coordinator permit acquire | < 1ms | concurrency-coordinator.test.ts |
| Queue FIFO ordering latency | < 2ms | concurrency-coordinator.test.ts |
| Circuit breaker state transition | < 1ms | circuit-breaker.test.ts |
| Batching window size (default) | 50ms | batching-system.ts:42 |
| Max batch operations | 100 | batching-system.ts:114 |
| Global concurrency limit | 15 (adaptive 5-30) | concurrency-coordinator.ts:160 |

---

## PART 7: KEY FILES TO CREATE

```
tests/stress/
├── scenario-generator.ts        (500 LOC) — Generate 1000+ scenarios
├── load-test-runner.ts          (600 LOC) — Execute scenarios
├── fault-injector.ts            (400 LOC) — Inject 8 fault types
├── metrics-collector.ts         (300 LOC) — Gather metrics
├── mock-google-api-provider.ts  (500 LOC) — Mock Google API
├── scenario-catalog.json        (auto-gen) — Scenario registry
├── scenarios/
│   ├── sequential-io.ts
│   ├── concurrent-dashboards.ts
│   ├── agent-workflows.ts
│   ├── quota-saturation.ts
│   ├── collaboration.ts
│   ├── bigquery-pipeline.ts
│   ├── transactions.ts
│   └── resilience.ts
└── tests/
    ├── scenario-generator.test.ts
    ├── load-test-runner.test.ts
    ├── fault-injector.test.ts
    └── end-to-end-scenarios.test.ts

.github/workflows/
└── stress-testing.yml          (150 LOC) — CI integration

package.json additions:
  "stress:generate": "node tests/stress/scenario-generator.ts",
  "stress:run": "vitest run tests/stress/end-to-end-scenarios.test.ts",
  "stress:full": "npm run stress:generate && npm run stress:run",
  "stress:profile": "node --prof tests/stress/load-test-runner.ts && node --prof-process isolate-*.log > profile.txt"
```

---

## IMPLEMENTATION CHECKLIST

- [ ] Create scenario generator with 10 base templates
- [ ] Implement load test runner with concurrency orchestration
- [ ] Add fault injector with 8 fault types
- [ ] Build metrics collector with dashboard generation
- [ ] Create mock Google API provider
- [ ] Add CI workflow for nightly stress testing
- [ ] Integrate with baseline tracking
- [ ] Performance regression detection (>10% = fail)
- [ ] Agent scenario expansion (10+ additional scenarios)
- [ ] Cache efficiency metrics
- [ ] Transaction/session stress tests
- [ ] Documentation + runbooks

---

## REFERENCE COUNTS

- **Scenarios to implement:** 50+ (start with 10)
- **Fault types:** 8
- **Concurrency levels:** 1, 5, 10, 25, 50, 100, 1000
- **Data scales:** 10 cells, 100 cells, 1000 cells, 10000 cells
- **Expected LOC:** ~2500 (stress test framework) + ~500 (CI integration)
- **CI runtime:** 20-30 minutes (nightly), 5 minutes (quick PR check)

---

## OPEN QUESTIONS FOR IMPLEMENTATION

1. **Mock vs. Live API:** Should stress tests use mock Google API or hit real endpoints with dummy spreadsheets?
2. **Baseline storage:** Where to store historical baselines? (Git LFS, cloud storage, local cache?)
3. **Failure thresholds:** What error rates trigger CI failure? (5%, 10%?)
4. **Multi-region:** Test against different Google regions?
5. **Token refresh:** Simulate OAuth token refresh during long-running tests?

---

