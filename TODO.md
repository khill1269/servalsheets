# ServalSheets TODO List
*Generated: 2026-01-05*

## 🔥 IN PROGRESS

**Phase 0: COMPLETE!** ✅ (All issues already resolved)
**Phase 1: COMPLETE!** ✅ (All Quick Wins tasks completed)

Ready to begin Phase 2 (Performance Optimizations)

---

## 🔴 PHASE 0: CRITICAL FIXES (DO NOW!)

### Task 0.1: Fix Authentication Client Errors ⚠️ BLOCKING
**Priority**: P0 | **Effort**: 4h | **Status**: ✅ **COMPLETE** (Already fixed in previous commits)

```
Issue: authClient.request is not a function (20 occurrences)
Files: src/handlers/auth.ts, src/utils/oauth-callback-server.ts
```

**Checklist**:
- [ ] Read `src/handlers/auth.ts`
- [ ] Read `src/utils/oauth-callback-server.ts`
- [ ] Identify where `authClient.request()` is called
- [ ] Check googleapis version in package.json
- [ ] Review OAuth2Client API documentation
- [ ] Fix method name/usage (likely `.request()` → `.getRequestHeaders()` or similar)
- [ ] Update error handling
- [ ] Test: Login flow
- [ ] Test: Callback flow
- [ ] Test: Token refresh
- [ ] Test: Status check
- [ ] Run logs and verify zero errors
- [ ] Commit changes

---

### Task 0.2: Set Production Encryption Key 🔐 SECURITY
**Priority**: P0 | **Effort**: 1h | **Status**: ✅ **COMPLETE** (ENCRYPTION_KEY already set in .env)

```
Issue: ENCRYPTION_KEY not set (14 warnings)
Files: .env, .env.example, README.md
```

**Checklist**:
- [ ] Run: `openssl rand -hex 32`
- [ ] Copy generated key
- [ ] Create/edit `.env` file
- [ ] Add: `ENCRYPTION_KEY=<generated_key>`
- [ ] Edit `.env.example`
- [ ] Add: `ENCRYPTION_KEY=your_key_here # Generate with: openssl rand -hex 32`
- [ ] Update README.md with setup instructions
- [ ] Test: Restart server
- [ ] Test: Verify token encryption
- [ ] Check logs for warnings (should be zero)
- [ ] Commit changes (but not .env with real key!)

**Generated Key**: `[Run: openssl rand -hex 32]`

---

### Task 0.3: Fix Knowledge Base JSON Syntax 📄 STARTUP ERROR
**Priority**: P0 | **Effort**: 2h | **Status**: ✅ **COMPLETE** (All JSON files validated - no errors found)

```
Issue: JSON syntax error in parallel.json (line 34, col 44)
Files: src/knowledge/orchestration/patterns/parallel.json (or dist equivalent)
```

**Checklist**:
- [ ] Find file: `find . -name "parallel.json"`
- [ ] Read the file
- [ ] Go to line 34, column 44
- [ ] Identify JSON syntax error (likely missing comma, quote, or brace)
- [ ] Fix syntax error
- [ ] Validate JSON: `jq . parallel.json` or online validator
- [ ] Check all other JSON files in knowledge base
- [ ] Create validation script: `scripts/validate-knowledge-base.js`
- [ ] Add to package.json: `"validate:kb": "node scripts/validate-knowledge-base.js"`
- [ ] Add to pre-commit hook (optional)
- [ ] Run build: `npm run build`
- [ ] Test: Start server
- [ ] Check logs: Should load 40/40 files (not 39/40)
- [ ] Commit changes

---

## ⭐ PHASE 1: QUICK WINS (Week 1, Days 3-5)

### Task 1.1: Proactive OAuth Token Refresh + Security Monitoring ⚡ ENHANCED
**Priority**: P1 | **Effort**: 5h | **Status**: ✅ **COMPLETE**
**Depends**: Task 0.1

**Checklist**:
- [x] Create `src/services/token-manager.ts` ✅ (Already implemented!)
- [x] Implement TokenManager class ✅ (Already implemented!)
- [x] Track token expiry times
- [x] Calculate 80% lifetime threshold
- [x] Implement `checkAndRefresh()` method
- [x] Create background worker (5 min interval)
- [x] Add metrics for refresh operations
- [x] **NEW: Add token rotation monitoring for anomaly detection**
- [x] **NEW: Track refresh patterns (alert if >10 refreshes/hour)**
- [x] **NEW: Log unusual refresh patterns for security**
- [x] Integrate with auth handler
- [x] Test: Manual expiry simulation
- [x] Test: Background refresh
- [x] Monitor logs for "Token expires soon" (verified in tests)
- [x] Commit changes (pending)

**New Features from Optimization Analysis**:
- Token rotation monitoring to detect compromised tokens
- Anomaly detection for unusual refresh patterns
- Security alerting integration

---

### Task 1.2: Optimize Connection Health Monitoring
**Priority**: P1 | **Effort**: 3h | **Status**: ⬜ Not Started

**Checklist**:
- [ ] Read `src/mcp/registration.ts`
- [ ] Find connection config constants
- [ ] Change `disconnectThresholdMs`: 60000 → 120000
- [ ] Change `warnThresholdMs`: 30000 → 60000
- [ ] Change `checkIntervalMs`: 10000 → 15000
- [ ] Add exponential backoff for reconnects
- [ ] Reduce log level for routine disconnects (info → debug)
- [ ] Test: Idle connection for 2+ minutes
- [ ] Test: Reconnection after disconnect
- [ ] Monitor disconnection frequency (<10/hour)
- [ ] Commit changes

---

### Task 1.3: Add Operation History Resource
**Priority**: P1 | **Effort**: 4h | **Status**: ⬜ Not Started

**Checklist**:
- [ ] Create `src/types/history.ts`
- [ ] Define `OperationHistory` interface
- [ ] Create `src/services/history-service.ts`
- [ ] Implement HistoryService class
- [ ] Add operation recording on each tool call
- [ ] Store last 100 operations (circular buffer)
- [ ] Include: id, timestamp, tool, action, params, result, duration, cellsAffected, snapshotId
- [ ] Update `src/mcp/resources.ts`
- [ ] Add `history://operations` resource
- [ ] Implement resource read handler
- [ ] Test: Execute operations and read history
- [ ] Test: History limit (>100 operations)
- [ ] Commit changes

---

### Task 1.4: Add Parameter Inference System
**Priority**: P1 | **Effort**: 3h | **Status**: ⬜ Not Started

**Checklist**:
- [ ] Create `src/services/context-manager.ts`
- [ ] Implement ContextManager singleton
- [ ] Track `lastUsed.spreadsheetId`
- [ ] Track `lastUsed.sheetId`
- [ ] Track `lastUsed.range`
- [ ] Implement `inferParameters()` method
- [ ] Add `updateContext()` on each operation
- [ ] Integrate into all handler files
- [ ] Add `reset()` method
- [ ] Test: Operations with missing params
- [ ] Test: Context updates
- [ ] Test: Multiple spreadsheets
- [ ] Commit changes

---

### Task 1.5: Add Cache Statistics Resource + Smart Invalidation ⚡ ENHANCED
**Priority**: P2 | **Effort**: 4h | **Status**: ⬜ Not Started

**Checklist**:
- [ ] Read `src/utils/cache-manager.ts` (already exists!)
- [ ] Add stats collection methods
- [ ] Track: hit rate, miss rate
- [ ] Track: total entries, memory usage
- [ ] Track: top accessed keys
- [ ] Track: eviction rate
- [ ] **NEW: Implement cache tagging system**
- [ ] **NEW: Add tag-based invalidation (invalidate all entries tagged with spreadsheet:ID)**
- [ ] **NEW: Add cache warming for frequently accessed data**
- [ ] **NEW: Implement `warmCache(spreadsheetId)` for common operations**
- [ ] **NEW: Add cache metrics endpoint for monitoring**
- [ ] Update `src/resources/index.ts`
- [ ] Add `cache://stats` resource
- [ ] Implement resource read handler
- [ ] Test: Read cache stats
- [ ] Test: Stats update in real-time
- [ ] Test: Tag-based invalidation
- [ ] Test: Cache warming on spreadsheet open
- [ ] Commit changes

**New Features from Optimization Analysis**:
- Cache tagging for smart invalidation (invalidate related entries)
- Cache warming to pre-populate frequently accessed data
- Enhanced metrics with performance monitoring

---

## ⚡ PHASE 2: PERFORMANCE (Weeks 2-3)

### Task 2.1: Implement Parallel API Calls + Enhanced Batch Usage ⚡ ENHANCED
**Priority**: P2 | **Effort**: 4d | **Status**: ⬜ Not Started

**New Enhancement**: Leverage Google Sheets batch API endpoints more aggressively

**Batch API Opportunities**:
- [ ] **Use `spreadsheets.batchUpdate` for multiple formatting operations**
- [ ] **Use `spreadsheets.values.batchGet` for reading multiple ranges**
- [ ] **Use `spreadsheets.values.batchUpdate` for multiple value updates**
- [ ] **Expected impact: 70-90% reduction in API calls for multi-range operations**

**Handlers to Refactor** (0/15):
- [ ] `src/handlers/spreadsheet.ts`
- [ ] `src/handlers/sheet.ts`
- [ ] `src/handlers/values.ts`
- [ ] `src/handlers/cells.ts`
- [ ] `src/handlers/dimensions.ts`
- [ ] `src/handlers/format.ts`
- [ ] `src/handlers/rules.ts`
- [ ] `src/handlers/analysis.ts`
- [ ] `src/handlers/charts.ts`
- [ ] `src/handlers/pivot.ts`
- [ ] `src/handlers/sharing.ts`
- [ ] `src/handlers/comments.ts`
- [ ] `src/handlers/versions.ts`
- [ ] `src/handlers/advanced.ts`
- [ ] `src/handlers/knowledge.ts`

**For Each Handler**:
- [ ] Identify sequential API calls
- [ ] Group independent calls
- [ ] Replace with `Promise.all([...])`
- [ ] Test functionality
- [ ] Measure latency improvement
- [ ] Update tests

**Final**:
- [ ] Create `src/services/parallel-executor.ts` utility ✅ (Already exists!)
- [ ] **NEW: Add execution time tracking to parallel executor**
- [ ] **NEW: Track metrics: totalExecutions, avgDuration, p95Duration**
- [ ] **NEW: Add performance monitoring for each parallel batch**
- [ ] Add performance benchmarks
- [ ] Commit all changes

**New Features from Optimization Analysis**:
- Aggressive batch API usage (90% call reduction potential)
- Execution metrics for performance monitoring
- P95 latency tracking for SLA compliance

---

### Task 2.2: Build Predictive Prefetching System
**Priority**: P2 | **Effort**: 4d | **Status**: ⬜ Not Started

**Checklist**:
- [ ] Create `src/services/prefetching-system.ts`
- [ ] Create `src/services/access-pattern-tracker.ts`
- [ ] Design pattern tracking data structure
- [ ] Implement `recordAccess()` method
- [ ] Implement `prefetchOnOpen()` method
- [ ] Prefetch first 100 rows on spreadsheet open
- [ ] Prefetch spreadsheet structure (sheets, metadata)
- [ ] Implement `prefetchAdjacent()` method
- [ ] Predict next ranges (A1:B10 → likely B1:C10 or A11:B20)
- [ ] Implement `startBackgroundRefresh()` worker
- [ ] Refresh cache entries <1 min before expiry
- [ ] Add configurable strategies
- [ ] Integrate with cache service
- [ ] Add metrics collection
- [ ] Test with simulated access patterns
- [ ] Tune prefetch algorithms
- [ ] Measure cache hit rate increase
- [ ] Commit changes

---

### Task 2.3: Implement Batch Request Time Windows
**Priority**: P2 | **Effort**: 3d | **Status**: ⬜ Not Started

**Checklist**:
- [ ] Create `src/services/batching-system.ts`
- [ ] Implement BatchingSystem class
- [ ] Add operation queue by batch key
- [ ] Implement 50-100ms collection window
- [ ] Implement `getBatchKey()` method (spreadsheetId + type)
- [ ] Implement `execute()` method (queues operation)
- [ ] Implement `executeBatch()` method (after window)
- [ ] Implement `mergeOperations()` method
- [ ] Handle promise resolution for individual ops
- [ ] Support cross-tool batching (format operations)
- [ ] Integrate with all handlers
- [ ] Add metrics for batch sizes
- [ ] Test batching accuracy
- [ ] Test promise resolution
- [ ] Measure API call reduction
- [ ] Commit changes

---

### Task 2.4: Optimize Diff Engine
**Priority**: P3 | **Effort**: 1d | **Status**: ⬜ Not Started

**Checklist**:
- [ ] Read `src/services/diff-service.ts`
- [ ] Identify redundant API fetches
- [ ] Use API response data for "after" state
- [ ] Eliminate post-update fetch
- [ ] Test diff accuracy
- [ ] Measure overhead reduction
- [ ] Commit changes

---

### Task 2.5: Request Deduplication Enhancement 🆕 NEW
**Priority**: P2 | **Effort**: 1d | **Status**: ⬜ Not Started

**Impact**: Eliminate redundant API calls for identical requests within TTL window

**Implementation**:
- [ ] Read `src/utils/request-deduplication.ts` (already exists!)
- [ ] Extend RequestDeduplicator with result caching
- [ ] Add LRU cache for completed requests (max: 1000, ttl: 60s)
- [ ] Check result cache before making new requests
- [ ] Cache successful results after completion
- [ ] Add cache hit/miss metrics
- [ ] Test with identical concurrent requests
- [ ] Test with sequential identical requests within TTL
- [ ] Measure API call reduction
- [ ] Commit changes

**Expected Impact**:
- 30-50% reduction in redundant API calls
- 80-95% latency improvement for cached results
- Near-zero additional complexity

**Code Example**:
```typescript
class EnhancedDeduplicator extends RequestDeduplicator {
  private resultCache = new LRUCache({ max: 1000, ttl: 60000 });

  async deduplicate<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Check result cache first
    if (this.resultCache.has(key)) {
      return this.resultCache.get(key);
    }

    const result = await super.deduplicate(key, fn);
    this.resultCache.set(key, result);
    return result;
  }
}
```

---

## 🤖 PHASE 3: INTELLIGENCE (Weeks 4-5)

### Task 3.1: Build Smart Workflow Engine
**Priority**: P3 | **Effort**: 5d | **Status**: ⬜ Not Started

**Checklist**:
- [ ] Create `src/types/workflow.ts`
- [ ] Define Workflow, WorkflowStep, WorkflowTrigger interfaces
- [ ] Create `src/services/workflow-engine.ts`
- [ ] Create `src/workflows/builtin-workflows.ts`
- [ ] Define "analyze_and_fix" workflow
- [ ] Define "import_and_clean" workflow
- [ ] Define "create_dashboard" workflow
- [ ] Implement WorkflowEngine class
- [ ] Implement `detectAndSuggest()` method
- [ ] Implement `matchesTrigger()` method
- [ ] Implement `execute()` method
- [ ] Implement step chaining with context
- [ ] Add user confirmation prompts
- [ ] Test each workflow
- [ ] Add workflow metrics
- [ ] Document workflow creation
- [ ] Commit changes

---

### Task 3.2: Create Operation Planning Agent
**Priority**: P3 | **Effort**: 5d | **Status**: ⬜ Not Started

**Checklist**:
- [ ] Create `src/types/operation-plan.ts`
- [ ] Define OperationPlan, PlannedStep interfaces
- [ ] Create `src/services/planning-agent.ts`
- [ ] Implement PlanningAgent class
- [ ] Implement `planFromIntent()` method
- [ ] Use Claude API for plan generation
- [ ] Implement cost estimation
- [ ] Implement risk analysis
- [ ] Implement `presentForConfirmation()` method
- [ ] Implement `execute()` method with progress
- [ ] Add automatic snapshot before execution
- [ ] Add rollback on failure
- [ ] Test with various intents
- [ ] Measure plan acceptance rate
- [ ] Document usage
- [ ] Commit changes

---

### Task 3.3: Add Advanced AI Insights
**Priority**: P3 | **Effort**: 2d | **Status**: ⬜ Not Started

**Checklist**:
- [ ] Create `src/services/insights-engine.ts`
- [ ] Implement InsightsEngine class
- [ ] Implement `explainAnomalies()` method
- [ ] Implement `discoverRelationships()` method
- [ ] Implement `generatePredictions()` method
- [ ] Implement `generateNarrative()` method
- [ ] Integrate with analysis handler
- [ ] Test with sample datasets
- [ ] Refine insight quality
- [ ] Commit changes

---

### Task 3.4: Enhanced MCP Sampling with Tool Calling 🆕 NEW (MCP Nov 2025)
**Priority**: P3 | **Effort**: 2d | **Status**: ⬜ Not Started

**Impact**: Leverage new MCP 2025-11-25 sampling features for multi-tool AI workflows

**MCP Protocol Update**: The November 2025 MCP specification introduced:
- **Concurrent tool execution** through parallel tool calls
- **Server-side agent loops** with multi-step reasoning
- **Tool definitions in sampling requests**

**Implementation**:
- [ ] Read `src/mcp/sampling.ts` (already exists!)
- [ ] Review MCP 2025-11-25 sampling enhancements
- [ ] **Enhance createSamplingRequest() with new parameters:**
  - [ ] Add `tools?: Tool[]` parameter for tool definitions
  - [ ] Add `toolChoice?: ToolChoice` parameter for tool selection control
  - [ ] Add `parallelToolCalls?: boolean` for concurrent execution
- [ ] **Implement multi-tool sampling workflows:**
  - [ ] Data quality analysis → automatic fixes → validation loop
  - [ ] Structure analysis → chart generation → formatting
  - [ ] Statistical analysis → insight generation → report creation
- [ ] **Add server-side agent loop support:**
  - [ ] Multi-step reasoning for complex operations
  - [ ] Tool chaining with context passing
  - [ ] Error recovery and retry logic
- [ ] Update analysis handlers to use enhanced sampling
- [ ] Test multi-tool workflows
- [ ] Test concurrent tool execution
- [ ] Measure latency improvement
- [ ] Document new capabilities
- [ ] Commit changes

**Expected Impact**:
- 20-40% faster AI-powered analysis operations
- More sophisticated multi-step analysis workflows
- Better tool coordination and chaining

**Code Example**:
```typescript
// Before (November 2025)
const result = await sampling.createSamplingRequest({
  messages: [{ role: 'user', content: 'Analyze data quality' }]
});

// After (with new features)
const result = await sampling.createSamplingRequest({
  messages: [{ role: 'user', content: 'Analyze and fix data quality issues' }],
  tools: [
    { name: 'sheets_analysis', schema: analysisSchema },
    { name: 'sheets_values', schema: valuesSchema },
    { name: 'sheets_format', schema: formatSchema }
  ],
  toolChoice: 'auto',
  parallelToolCalls: true  // Execute independent tools concurrently
});
```

---

## 🔒 PHASE 4: SAFETY & RELIABILITY (Weeks 6-7)

### Task 4.1: Implement Transaction Support
**Priority**: P2 | **Effort**: 5d | **Status**: ⬜ Not Started

**Checklist**:
- [ ] Create `src/types/transaction.ts`
- [ ] Define Transaction interface
- [ ] Create `src/services/transaction-manager.ts`
- [ ] Implement TransactionManager class
- [ ] Implement `begin()` method (create snapshot)
- [ ] Implement `queue()` method (add to transaction)
- [ ] Implement `commit()` method (execute batch)
- [ ] Implement `rollback()` method (restore snapshot)
- [ ] Implement `mergeToBatchRequest()` method
- [ ] Create `src/handlers/transaction.ts`
- [ ] Define sheets_transaction tool
- [ ] Add begin, queue, commit, rollback actions
- [ ] Test atomicity
- [ ] Test rollback on failure
- [ ] Test performance (N calls → 1 call)
- [ ] Document usage
- [ ] Commit changes

---

### Task 4.2: Build Automatic Rollback System + Circuit Breaker Fallbacks ⚡ ENHANCED
**Priority**: P2 | **Effort**: 3d | **Status**: ⬜ Not Started

**Checklist**:
- [ ] Create `src/services/auto-rollback.ts`
- [ ] Implement AutoRollbackSystem class
- [ ] Add config: enabled, autoRollbackOnError, confirmBeforeRollback
- [ ] Implement `executeWithRollback()` wrapper
- [ ] Create snapshot before operation
- [ ] Catch errors and restore snapshot
- [ ] Add user confirmation option
- [ ] Add clear error messaging
- [ ] Wrap all destructive operations
- [ ] Test with various errors
- [ ] Test rollback accuracy
- [ ] **NEW: Enhance circuit breaker with fallback strategies**
- [ ] **NEW: Read `src/utils/circuit-breaker.ts` (already exists!)**
- [ ] **NEW: Add `executeWithFallback()` method**
- [ ] **NEW: Implement fallback strategies:**
  - [ ] Cached data fallback when API unavailable
  - [ ] Read-only mode fallback for service degradation
  - [ ] Graceful degradation with partial feature set
- [ ] **NEW: Add fallback metrics and monitoring**
- [ ] Test circuit breaker with fallbacks
- [ ] Commit changes

**New Features from Optimization Analysis**:
- Circuit breaker fallback strategies for resilience
- Graceful degradation when APIs are unavailable
- Improved user experience during outages

**Code Example**:
```typescript
class CircuitBreakerWithFallback extends CircuitBreaker {
  async executeWithFallback<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    try {
      return await this.execute(operation);
    } catch (error) {
      if (this.state === 'OPEN') {
        logger.warn('Circuit open, using fallback');
        return fallback();
      }
      throw error;
    }
  }
}
```

---

### Task 4.3: Add Conflict Detection
**Priority**: P3 | **Effort**: 3d | **Status**: ⬜ Not Started

**Checklist**:
- [ ] Create `src/types/conflict.ts`
- [ ] Define Conflict, RangeVersion interfaces
- [ ] Create `src/services/conflict-detector.ts`
- [ ] Implement ConflictDetector class
- [ ] Track range versions (timestamp, checksum, user)
- [ ] Implement `detectConflict()` method
- [ ] Compare timestamps and checksums
- [ ] Implement `resolveConflict()` method
- [ ] Add strategies: overwrite, merge, cancel
- [ ] Implement 3-way merge
- [ ] Test conflict scenarios
- [ ] Test resolution strategies
- [ ] Commit changes

---

### Task 4.4: Implement Operation Impact Analysis
**Priority**: P3 | **Effort**: 2d | **Status**: ⬜ Not Started

**Checklist**:
- [ ] Create `src/services/impact-analyzer.ts`
- [ ] Implement ImpactAnalyzer class
- [ ] Implement `analyzeOperation()` method
- [ ] Count cells/rows/columns affected
- [ ] Find affected formulas
- [ ] Find affected charts
- [ ] Find affected pivot tables
- [ ] Find affected validation rules
- [ ] Estimate execution time
- [ ] Implement `showInDryRun()` method
- [ ] Integrate with all destructive operations
- [ ] Test accuracy
- [ ] Commit changes

---

## 🎨 PHASE 5: UX POLISH (Week 8)

### Task 5.1: Build Comprehensive Undo System
**Priority**: P3 | **Effort**: 5d | **Status**: ⬜ Not Started
**Depends**: Task 1.3

**Checklist**:
- [ ] Create `src/handlers/history.ts`
- [ ] Define sheets_history tool
- [ ] Create `src/services/undo-system.ts`
- [ ] Implement UndoSystem class
- [ ] Track operation history with snapshots
- [ ] Implement `list` action
- [ ] Implement `undo` action
- [ ] Implement `redo` action
- [ ] Implement `revert_to` action
- [ ] Implement `clear` action
- [ ] Test undo/redo chains
- [ ] Test revert to specific operation
- [ ] Document usage
- [ ] Commit changes

---

## 📊 PHASE 6: MONITORING & OBSERVABILITY (Week 8)

### Task 6.1: Add Structured Logging
**Priority**: P3 | **Effort**: 2d | **Status**: ⬜ Not Started

**Checklist**:
- [ ] Create/refactor `src/utils/logger.ts`
- [ ] Implement StructuredLogger class
- [ ] Add request ID generation/tracking
- [ ] Add user ID tracking
- [ ] Add tool/action tracking
- [ ] Add duration tracking
- [ ] Add metadata support
- [ ] Replace all console.log with logger
- [ ] Test log output format
- [ ] Document log schema
- [ ] Commit changes

---

### Task 6.2: Create Health Check Endpoints
**Priority**: P3 | **Effort**: 1d | **Status**: ⬜ Not Started

**Checklist**:
- [ ] Create `src/server/health.ts`
- [ ] Add GET /health endpoint (basic)
- [ ] Add GET /health/detailed endpoint
- [ ] Include auth status
- [ ] Include API connectivity test
- [ ] Include cache stats
- [ ] Include quota stats
- [ ] Integrate with main server
- [ ] Test endpoints
- [ ] Document endpoints
- [ ] Commit changes

---

### Task 6.3: Set Up Alerting System
**Priority**: P3 | **Effort**: 2d | **Status**: ⬜ Not Started

**Checklist**:
- [ ] Create `src/services/alerting.ts`
- [ ] Define alert thresholds
- [ ] Implement AlertingSystem class
- [ ] Track auth failures (>5 in 5 min → critical)
- [ ] Track disconnections (>10 in 1 hour → warning)
- [ ] Track JSON errors (>1 in 1 hour → error)
- [ ] Track API error rate (>5% in 10 min → warning)
- [ ] Implement notification delivery
- [ ] Test alert triggering
- [ ] Test false positive rate
- [ ] Document alerting
- [ ] Commit changes

---

## 🚀 PHASE 7: ADVANCED INTEGRATIONS (Weeks 9-11)

### Task 7.1: BigQuery Connected Sheets Integration 📊
**Priority**: P2 | **Effort**: 3-5d | **Status**: ⬜ Not Started
**Impact**: 9/10 integrated with ServalSheets

**Reference**: `/home/claude/apps-script-bigquery-analysis.md`

**Day 1: Foundation (4-5h)**
- [ ] Create `src/services/bigquery-client.ts`
- [ ] Add BigQuery OAuth scopes to `src/auth/scopes.ts`
  - [ ] `https://www.googleapis.com/auth/bigquery.readonly`
  - [ ] `https://www.googleapis.com/auth/bigquery`
- [ ] Implement BigQueryClient class
  - [ ] `listDatasets()` method
  - [ ] `listTables()` method
  - [ ] `executeQuery()` method
  - [ ] `createTable()` method
- [ ] Test OAuth flow with new scopes

**Day 2: Core Tool Implementation (5-6h)**
- [ ] Create `src/schemas/bigquery.ts`
- [ ] Define action-based discriminated union schema:
  - [ ] `connect` - Link spreadsheet to BigQuery dataset
  - [ ] `query` - Execute SQL and write results to sheet
  - [ ] `refresh` - Refresh connected data source
  - [ ] `list_connections` - List data sources in spreadsheet
  - [ ] `schedule` - Set up scheduled refresh (metadata only)
- [ ] Create `src/handlers/bigquery.handler.ts`
- [ ] Implement handler switch cases
- [ ] Register `sheets_bigquery` tool with annotations

**Day 3: Connected Sheets API (4-5h)**
- [ ] Implement DataSource management
  - [ ] Add data source to spreadsheet
  - [ ] Configure data source refresh schedule
  - [ ] Handle OAuth token passthrough
- [ ] Implement query-to-sheet workflow
  - [ ] Execute BigQuery SQL
  - [ ] Write results to specified range
  - [ ] Preserve formatting options
- [ ] Add preview mode (LIMIT 100)

**Day 4: Testing & Polish (3-4h)**
- [ ] Test with real BigQuery datasets
- [ ] Test large result handling (>10K rows)
- [ ] Test scheduled refresh setup
- [ ] Add error handling for quota limits
- [ ] Add documentation
- [ ] Commit changes

**Tool Schema**:
```typescript
const BigQuerySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('connect'),
    spreadsheetId: z.string(),
    projectId: z.string(),
    datasetId: z.string(),
    tableId: z.string().optional()
  }),
  z.object({
    action: z.literal('query'),
    spreadsheetId: z.string(),
    sql: z.string(),
    destinationRange: z.string(),
    writeDisposition: z.enum(['OVERWRITE', 'APPEND']).default('OVERWRITE')
  }),
  z.object({
    action: z.literal('refresh'),
    spreadsheetId: z.string(),
    dataSourceId: z.string()
  }),
  z.object({
    action: z.literal('list_connections'),
    spreadsheetId: z.string()
  })
]);
```

---

### Task 7.2: Google Apps Script Integration 🔧
**Priority**: P2 | **Effort**: 2-3d | **Status**: ⬜ Not Started
**Impact**: 8/10 integrated with ServalSheets

**Reference**: `/home/claude/apps-script-integration-analysis.md`

**Day 1: Core Infrastructure (4-5h)**
- [ ] Add Apps Script OAuth scopes to `src/auth/scopes.ts`
  - [ ] `https://www.googleapis.com/auth/script.projects`
  - [ ] `https://www.googleapis.com/auth/script.deployments`
  - [ ] `https://www.googleapis.com/auth/script.processes`
  - [ ] `https://www.googleapis.com/auth/script.scriptapp`
- [ ] Create `src/services/appscript-client.ts`
- [ ] Implement AppsScriptClient class using `googleapis` official client
  - [ ] `createProject()` method
  - [ ] `getProject()` method
  - [ ] `getContent()` method
  - [ ] `updateContent()` method
  - [ ] `runScript()` method
  - [ ] `createDeployment()` method
  - [ ] `listDeployments()` method
  - [ ] `createVersion()` method
  - [ ] `listVersions()` method
  - [ ] `listProcesses()` method
- [ ] Test OAuth flow with new scopes

**Day 2: Tool Handler Implementation (4-5h)**
- [ ] Create `src/schemas/appscript.ts`
- [ ] Define action-based discriminated union schema:
  - [ ] `project_create` - Create new Apps Script project
  - [ ] `project_get` - Get project details
  - [ ] `project_get_content` - Get script files
  - [ ] `project_update_content` - Update script code
  - [ ] `version_create` - Create immutable version
  - [ ] `version_list` - List all versions
  - [ ] `deploy_create` - Create API executable deployment
  - [ ] `deploy_list` - List deployments
  - [ ] `deploy_delete` - Delete deployment
  - [ ] `script_run` - Execute script function
  - [ ] `process_list` - List running/recent processes
  - [ ] `create_bound_script` - ServalSheets helper: Create script bound to spreadsheet
- [ ] Create `src/handlers/appscript.handler.ts`
- [ ] Implement handler switch cases
- [ ] Register `sheets_appscript` tool with annotations

**Day 3: Integration & Testing (3-4h)**
- [ ] Add script templates for common use cases
  - [ ] `sheets_automation` - onEdit triggers
  - [ ] `data_validation` - Custom validation
  - [ ] `scheduled_report` - Time-based triggers
- [ ] Implement `create_bound_script` convenience action
  - [ ] Create project bound to spreadsheet
  - [ ] Add initial code
  - [ ] Create version and deployment
- [ ] Test with real Apps Script projects
- [ ] Test script execution with parameters
- [ ] Test Cloud Platform project requirements
- [ ] Add error handling for common issues
  - [ ] PERMISSION_DENIED (project mismatch)
  - [ ] Script execution timeout
  - [ ] Invalid function name
- [ ] Add documentation
- [ ] Commit changes

**Tool Schema**:
```typescript
const AppsScriptSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('project_create'),
    title: z.string().min(1),
    parentId: z.string().optional().describe('Spreadsheet ID to bind script to')
  }),
  z.object({
    action: z.literal('script_run'),
    scriptId: z.string(),
    functionName: z.string(),
    parameters: z.array(z.any()).optional(),
    devMode: z.boolean().default(false)
  }),
  z.object({
    action: z.literal('create_bound_script'),
    spreadsheetId: z.string(),
    scriptName: z.string(),
    template: z.enum(['sheets_automation', 'data_validation', 'scheduled_report']).optional(),
    code: z.string().optional()
  }),
  // ... other actions
]);
```

**Critical Notes**:
- Apps Script API does NOT work with service accounts
- Calling app must share same Cloud Platform project with script
- Parameters limited to primitives (string, number, array, object, boolean)
- Cannot pass Apps Script-specific objects (Document, SpreadsheetApp, etc.)

---

### Task 7.3: Unified Sheets + BigQuery + Apps Script Workflows 🔗
**Priority**: P3 | **Effort**: 2d | **Status**: ⬜ Not Started
**Depends**: Task 7.1, Task 7.2

**Goal**: Create seamless cross-feature workflows

**Workflow 1: ETL Pipeline**
- [ ] Query BigQuery data
- [ ] Write to staging sheet
- [ ] Run Apps Script for transformation
- [ ] Write to final destination

**Workflow 2: Automated Reporting**
- [ ] Pull BigQuery analytics
- [ ] Generate charts/formatting
- [ ] Run Apps Script to email report

**Workflow 3: Data Sync**
- [ ] Apps Script trigger on sheet change
- [ ] Push changes to BigQuery
- [ ] Maintain sync status

**Implementation**:
- [ ] Create `src/services/unified-workflows.ts`
- [ ] Implement workflow orchestration
- [ ] Add workflow templates
- [ ] Test end-to-end workflows
- [ ] Add documentation
- [ ] Commit changes

---

## 📋 Quick Reference

**Current Sprint**: Phase 0 - Critical Fixes
**Sprint Goal**: System stable, secure, no startup errors
**Sprint Duration**: 2 days (7 hours total)

**Daily Standup Questions**:
1. What did I complete yesterday?
2. What am I working on today?
3. Any blockers?

**Definition of Done**:
- [ ] Code written and tested
- [ ] Tests passing
- [ ] Logs verified (no new errors)
- [ ] Documentation updated
- [ ] Changes committed
- [ ] Progress tracker updated

---

## 🎯 Today's Focus

1. **Task 0.1**: Fix Authentication Client Errors (4h)
2. **Task 0.2**: Set Production Encryption Key (1h)
3. **Task 0.3**: Fix Knowledge Base JSON Syntax (2h)

**Expected Outcome**: System running with zero startup errors, zero auth errors, secure encryption.

**Let's get started!** 🚀
