# ServalSheets Development Phases

**Project**: ServalSheets MCP Server v1.3.0
**Generated**: 2026-01-07

This document breaks down the project roadmap into gated phases that follow the PROMPT_CONTRACT.md workflow.

## How to Use This File

1. **Read PROMPT_CONTRACT.md first** - Understand the non-negotiable rules
2. **Copy a phase prompt** from this file
3. **Paste into Claude** as your work instruction
4. **Wait for DONE ✅** before moving to next phase
5. **Run VS Code Task: "Phase Complete Gate"** to verify all checks pass

---

## 🔥 PHASE 0: CRITICAL FIXES (DO NOW!)

### Phase 0.1: Fix Authentication Client Errors

**Priority**: P0 (BLOCKING)
**Estimated Effort**: 4h
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 0.1: Fix authClient.request is not a function errors

Acceptance criteria:
- All authClient.request() calls are replaced with correct method
- OAuth2Client API usage matches googleapis v169 specification
- Login flow works without errors
- Token refresh works without errors
- Zero authClient errors in logs
- Commands must pass: build + test + typecheck + check:placeholders

Context:
Issue: authClient.request is not a function (20 occurrences)
Files affected: src/handlers/auth.ts, src/utils/oauth-callback-server.ts
googleapis version: ^169.0.0

Constraints:
- No stubs/placeholders
- Preserve MCP compliance and Google API correctness
- Must test actual OAuth flow

Proceed:
1) List files you will edit
2) Implement fix (likely .request() → .getRequestHeaders() or similar)
3) Run VS Code task: "Phase Complete Gate (All Checks)"
4) Report outputs and mark DONE ✅

Before DONE ✅, output a Capabilities Truth Table for auth-related tools.
```

**Files to Edit**:
- `src/handlers/auth.ts`
- `src/utils/oauth-callback-server.ts`

**Testing Checklist**:
- [ ] Login flow completes successfully
- [ ] Callback flow works
- [ ] Token refresh works
- [ ] Status check returns correct data
- [ ] Zero authClient errors in logs

---

### Phase 0.2: Set Production Encryption Key

**Priority**: P0 (SECURITY)
**Estimated Effort**: 1h
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 0.2: Configure production encryption key

Acceptance criteria:
- ENCRYPTION_KEY environment variable is documented
- .env.example includes ENCRYPTION_KEY with generation instructions
- README.md updated with setup instructions
- Zero "ENCRYPTION_KEY not set" warnings in logs
- .env file NOT committed to git
- Commands must pass: build + test + typecheck + check:placeholders

Context:
Issue: ENCRYPTION_KEY not set (14 warnings)
Security requirement: Token encryption requires 32-byte hex key
Generation: openssl rand -hex 32

Constraints:
- Never commit actual .env file with real key
- Only update .env.example with placeholder
- Must document key generation process

Proceed:
1) List files you will edit
2) Implement documentation updates
3) Run VS Code task: "Phase Complete Gate (All Checks)"
4) Report outputs and mark DONE ✅
```

**Files to Edit**:
- `.env.example`
- `README.md` (security/setup section)
- Potentially add to `QUICKSTART.md`

**Testing Checklist**:
- [ ] .env.example has ENCRYPTION_KEY placeholder
- [ ] Generation command documented
- [ ] README has clear setup instructions
- [ ] .gitignore includes .env
- [ ] Zero warnings after setting key

---

### Phase 0.3: Fix Knowledge Base JSON Syntax

**Priority**: P0 (STARTUP ERROR)
**Estimated Effort**: 2h
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 0.3: Fix JSON syntax error in knowledge base

Acceptance criteria:
- parallel.json has valid JSON syntax
- All 40 knowledge base files load successfully
- Zero JSON parse errors in logs
- Validation script added to prevent future errors
- Commands must pass: build + test + typecheck + check:placeholders

Context:
Issue: JSON syntax error in parallel.json (line 34, col 44)
Knowledge base: 39/40 files loading (should be 40/40)
Location: src/knowledge/orchestration/patterns/parallel.json

Constraints:
- Fix must preserve semantic meaning of JSON
- Add validation to CI pipeline
- Must verify all other JSON files in knowledge base

Proceed:
1) List files you will edit
2) Fix JSON syntax error
3) Create scripts/validate-knowledge-base.js
4) Add validation to package.json scripts
5) Run VS Code task: "Phase Complete Gate (All Checks)"
6) Report outputs and mark DONE ✅
```

**Files to Edit**:
- `src/knowledge/orchestration/patterns/parallel.json`
- `scripts/validate-knowledge-base.js` (create new)
- `package.json` (add `"validate:kb"` script)

**Testing Checklist**:
- [ ] parallel.json validates with jq
- [ ] Server loads 40/40 knowledge files
- [ ] Validation script checks all JSON files
- [ ] Zero JSON errors in logs

---

## ⭐ PHASE 1: QUICK WINS

### Phase 1.1: Proactive OAuth Token Refresh

**Priority**: P1
**Estimated Effort**: 5h
**Current Status**: ⬜ Not Started
**Depends**: Phase 0.1

**Phase Prompt** (copy this):

```
Phase 1.1: Implement proactive OAuth token refresh with security monitoring

Acceptance criteria:
- TokenManager tracks token expiry times
- Background worker refreshes tokens at 80% lifetime
- Security monitoring for unusual refresh patterns
- Alert on >10 refreshes per hour (possible compromise)
- Zero "Token expires soon" warnings in logs
- Commands must pass: build + test + typecheck + check:placeholders

Context:
File exists: src/services/token-manager.ts
Enhancement: Add proactive refresh + security monitoring
Background worker: Check every 5 minutes
Metrics: Track refresh operations and patterns

Constraints:
- Must handle race conditions
- Must log all refresh attempts
- Must not cause thundering herd
- Security alerts for anomalies

Proceed:
1) List files you will edit
2) Implement TokenManager enhancements
3) Add background worker
4) Add security monitoring
5) Integrate with auth handler
6) Run VS Code task: "Phase Complete Gate (All Checks)"
7) Report outputs and mark DONE ✅

Before DONE ✅, output a Capabilities Truth Table.
```

**Files to Edit**:
- `src/services/token-manager.ts`
- `src/handlers/auth.ts` (integration)
- `src/utils/logger.ts` (security alerts)

---

### Phase 1.2: Optimize Connection Health Monitoring

**Priority**: P1
**Estimated Effort**: 3h
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 1.2: Optimize connection health monitoring thresholds

Acceptance criteria:
- disconnectThresholdMs increased to 120000 (2 min)
- warnThresholdMs increased to 60000 (1 min)
- checkIntervalMs increased to 15000 (15 sec)
- Exponential backoff for reconnects implemented
- Routine disconnects logged at debug level (not info)
- <10 disconnections per hour during normal operation
- Commands must pass: build + test + typecheck + check:placeholders

Context:
File: src/mcp/registration.ts
Issue: Too aggressive health check causing frequent disconnects
Enhancement: Tune thresholds for production stability

Proceed:
1) List files you will edit
2) Update threshold constants
3) Implement exponential backoff
4) Adjust log levels
5) Run VS Code task: "Phase Complete Gate (All Checks)"
6) Report outputs and mark DONE ✅
```

**Files to Edit**:
- `src/mcp/registration.ts`

---

### Phase 1.3: Add Operation History Resource

**Priority**: P1
**Estimated Effort**: 4h
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 1.3: Implement operation history resource

Acceptance criteria:
- OperationHistory interface defined with all required fields
- HistoryService tracks last 100 operations in circular buffer
- history://operations resource available via resources/list
- Resource includes: id, timestamp, tool, action, params, result, duration, cellsAffected, snapshotId
- Operations recorded automatically on each tool call
- Commands must pass: build + test + typecheck + check:placeholders

Context:
New feature: Operation history for debugging and undo system
Storage: In-memory circular buffer (max 100 entries)
Future: Foundation for undo/redo system

Proceed:
1) List files you will edit
2) Create types and interfaces
3) Implement HistoryService
4) Register resource with MCP
5) Integrate with tool handlers
6) Run VS Code task: "Phase Complete Gate (All Checks)"
7) Report outputs and mark DONE ✅

Before DONE ✅, output a Capabilities Truth Table including new resource.
```

**Files to Edit**:
- `src/types/history.ts` (create)
- `src/services/history-service.ts` (create)
- `src/resources/index.ts` (add resource)
- `src/mcp/resources.ts` (register)

---

### Phase 1.4: Add Parameter Inference System

**Priority**: P1
**Estimated Effort**: 3h
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 1.4: Implement smart parameter inference from context

Acceptance criteria:
- ContextManager singleton tracks lastUsed spreadsheetId, sheetId, range
- inferParameters() method fills in missing parameters from context
- updateContext() called after each successful operation
- Integrated into all handler files
- reset() method available to clear context
- Commands must pass: build + test + typecheck + check:placeholders

Context:
UX enhancement: Reduce repetitive parameter entry
Pattern: Track last used IDs and infer when not provided
Safety: Only infer, never override explicitly provided params

Proceed:
1) List files you will edit
2) Create ContextManager service
3) Implement inference logic
4) Integrate with all handlers
5) Add tests for context tracking
6) Run VS Code task: "Phase Complete Gate (All Checks)"
7) Report outputs and mark DONE ✅
```

**Files to Edit**:
- `src/services/context-manager.ts` (create)
- `src/handlers/*.ts` (integrate into all)

---

### Phase 1.5: Add Cache Statistics Resource

**Priority**: P2
**Estimated Effort**: 4h
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 1.5: Add cache statistics resource with smart invalidation

Acceptance criteria:
- Cache tagging system implemented
- Tag-based invalidation (invalidate all cache entries for spreadsheet:ID)
- Cache warming for frequently accessed data
- warmCache(spreadsheetId) method for common operations
- cache://stats resource shows hit rate, miss rate, memory usage, top keys, eviction rate
- Cache metrics available for monitoring
- Commands must pass: build + test + typecheck + check:placeholders

Context:
Existing: src/utils/cache-manager.ts
Enhancement: Add stats collection + smart invalidation + warming
Resource: cache://stats for runtime observability

Proceed:
1) List files you will edit
2) Add stats collection to CacheManager
3) Implement cache tagging system
4) Implement tag-based invalidation
5) Add cache warming methods
6) Register cache://stats resource
7) Run VS Code task: "Phase Complete Gate (All Checks)"
8) Report outputs and mark DONE ✅

Before DONE ✅, output a Capabilities Truth Table including new resource.
```

**Files to Edit**:
- `src/utils/cache-manager.ts`
- `src/resources/index.ts`

---

## ⚡ PHASE 2: PERFORMANCE

### Phase 2.1: Implement Parallel API Calls + Batch APIs

**Priority**: P2
**Estimated Effort**: 4d
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 2.1: Refactor handlers to use parallel execution and batch APIs

Acceptance criteria:
- All sequential independent API calls replaced with Promise.all()
- spreadsheets.batchUpdate used for multiple formatting operations
- spreadsheets.values.batchGet used for multiple range reads
- spreadsheets.values.batchUpdate used for multiple value updates
- Expected 70-90% reduction in API calls for multi-range operations
- Execution time tracking in parallel executor
- Metrics: totalExecutions, avgDuration, p95Duration
- All 15 handler files refactored
- Commands must pass: build + test + typecheck + check:placeholders

Context:
Existing: src/services/parallel-executor.ts
Enhancement: Aggressive batch API usage
Impact: Massive latency reduction for multi-operation tools

Handlers to refactor (do in separate sub-phases):
1. src/handlers/spreadsheet.ts
2. src/handlers/sheet.ts
3. src/handlers/values.ts
4. src/handlers/cells.ts
5. src/handlers/dimensions.ts
6. src/handlers/format.ts
7. src/handlers/rules.ts
8. src/handlers/analysis.ts
9. src/handlers/charts.ts
10. src/handlers/pivot.ts
11. src/handlers/sharing.ts
12. src/handlers/comments.ts
13. src/handlers/versions.ts
14. src/handlers/advanced.ts
15. src/handlers/knowledge.ts

Proceed:
1) Pick ONE handler to start
2) List files you will edit
3) Identify sequential API calls
4) Replace with Promise.all() or batch API
5) Add execution time tracking
6) Test functionality
7) Run VS Code task: "Phase Complete Gate (All Checks)"
8) Report outputs and mark DONE ✅ for this handler
9) Repeat for next handler

NOTE: This is a multi-phase task. Complete ONE handler per phase.
```

**Files to Edit**: All 15 handlers (one at a time)

---

### Phase 2.2: Build Predictive Prefetching System

**Priority**: P2
**Estimated Effort**: 4d
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 2.2: Implement predictive prefetching for common access patterns

Acceptance criteria:
- AccessPatternTracker records all data access patterns
- prefetchOnOpen() fetches first 100 rows + metadata on spreadsheet open
- prefetchAdjacent() predicts next ranges (A1:B10 → likely B1:C10 or A11:B20)
- Background refresh worker refreshes cache <1min before expiry
- Configurable strategies for different use cases
- Metrics show cache hit rate increase
- Commands must pass: build + test + typecheck + check:placeholders

Context:
New feature: Intelligent prefetching based on access patterns
Storage: In-memory pattern analysis
Impact: Reduced perceived latency for common workflows

Proceed:
1) List files you will edit
2) Create AccessPatternTracker
3) Implement PrefetchingSystem
4) Add prefetch strategies
5) Integrate with cache service
6) Add background refresh worker
7) Run VS Code task: "Phase Complete Gate (All Checks)"
8) Report outputs and mark DONE ✅
```

**Files to Edit**:
- `src/services/prefetching-system.ts` (create)
- `src/services/access-pattern-tracker.ts` (create)
- `src/utils/cache-manager.ts` (integrate)

---

### Phase 2.3: Implement Batch Request Time Windows

**Priority**: P2
**Estimated Effort**: 3d
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 2.3: Add request batching with time windows

Acceptance criteria:
- BatchingSystem queues operations by batch key (spreadsheetId + type)
- 50-100ms collection window for grouping operations
- getBatchKey() method groups related operations
- execute() queues operation, executeBatch() runs after window
- mergeOperations() combines multiple ops into single batch request
- Individual promise resolution maintained
- Cross-tool batching supported (format operations)
- Metrics track batch sizes and API call reduction
- Commands must pass: build + test + typecheck + check:placeholders

Context:
New feature: Automatic operation batching
Pattern: Collect operations in time window, execute as batch
Impact: Further API call reduction beyond Phase 2.1

Proceed:
1) List files you will edit
2) Create BatchingSystem service
3) Implement time window logic
4) Add operation queue by batch key
5) Implement promise resolution tracking
6) Integrate with all handlers
7) Run VS Code task: "Phase Complete Gate (All Checks)"
8) Report outputs and mark DONE ✅
```

**Files to Edit**:
- `src/services/batching-system.ts` (create)
- `src/handlers/*.ts` (integrate)

---

### Phase 2.4: Optimize Diff Engine

**Priority**: P3
**Estimated Effort**: 1d
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 2.4: Eliminate redundant API fetches in diff engine

Acceptance criteria:
- Diff engine uses API response data for "after" state
- Post-update fetch eliminated
- Diff accuracy maintained
- Overhead reduction measured
- Commands must pass: build + test + typecheck + check:placeholders

Context:
Existing: src/services/diff-service.ts
Issue: Fetches data again after update to compute diff
Fix: Use API response which already contains updated data

Proceed:
1) List files you will edit
2) Identify redundant fetches
3) Use API response for after state
4) Verify diff accuracy with tests
5) Run VS Code task: "Phase Complete Gate (All Checks)"
6) Report outputs and mark DONE ✅
```

**Files to Edit**:
- `src/services/diff-service.ts`

---

### Phase 2.5: Enhanced Request Deduplication

**Priority**: P2
**Estimated Effort**: 1d
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 2.5: Add result caching to request deduplication

Acceptance criteria:
- EnhancedDeduplicator extends RequestDeduplicator
- LRU cache for completed requests (max: 1000, ttl: 60s)
- Check result cache before making new requests
- Cache hit/miss metrics tracked
- 30-50% reduction in redundant API calls
- 80-95% latency improvement for cached results
- Commands must pass: build + test + typecheck + check:placeholders

Context:
Existing: src/utils/request-deduplication.ts
Enhancement: Cache results for identical requests within TTL
Impact: Near-zero cost for massive performance gain

Proceed:
1) List files you will edit
2) Extend RequestDeduplicator with result cache
3) Add cache-aware deduplicate() method
4) Add metrics tracking
5) Test with identical concurrent/sequential requests
6) Run VS Code task: "Phase Complete Gate (All Checks)"
7) Report outputs and mark DONE ✅
```

**Files to Edit**:
- `src/utils/request-deduplication.ts`

---

## 🤖 PHASE 3: INTELLIGENCE

### Phase 3.1: Build Smart Workflow Engine

**Priority**: P3
**Estimated Effort**: 5d
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 3.1: Implement workflow engine with built-in workflows

Acceptance criteria:
- Workflow, WorkflowStep, WorkflowTrigger interfaces defined
- WorkflowEngine detects and suggests workflows
- Built-in workflows: analyze_and_fix, import_and_clean, create_dashboard
- detectAndSuggest() identifies workflow opportunities
- execute() runs workflow with user confirmation prompts
- Step chaining with context passing
- Workflow metrics tracked
- Documentation for creating custom workflows
- Commands must pass: build + test + typecheck + check:placeholders

Context:
New feature: Intelligent workflow automation
Pattern: Detect intent, suggest workflow, execute with confirmation
Impact: Reduced cognitive load for common tasks

Proceed:
1) List files you will edit
2) Define workflow types
3) Create WorkflowEngine
4) Implement built-in workflows
5) Add detection and suggestion logic
6) Test each workflow
7) Run VS Code task: "Phase Complete Gate (All Checks)"
8) Report outputs and mark DONE ✅
```

**Files to Edit**:
- `src/types/workflow.ts` (create)
- `src/services/workflow-engine.ts` (create)
- `src/workflows/builtin-workflows.ts` (create)

---

### Phase 3.2: Create Operation Planning Agent

**Priority**: P3
**Estimated Effort**: 5d
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 3.2: Implement AI-powered operation planning agent

Acceptance criteria:
- OperationPlan and PlannedStep interfaces defined
- PlanningAgent uses Claude API for plan generation
- planFromIntent() generates multi-step plans from natural language
- Cost estimation included in plans
- Risk analysis included in plans
- presentForConfirmation() shows plan to user
- execute() runs plan with progress tracking
- Automatic snapshot before execution
- Rollback on failure
- Commands must pass: build + test + typecheck + check:placeholders

Context:
New feature: AI planning for complex operations
Integration: Uses Claude API (MCP sampling)
Impact: Natural language to structured operations

Proceed:
1) List files you will edit
2) Define plan types
3) Create PlanningAgent
4) Integrate Claude API
5) Implement cost/risk estimation
6) Add confirmation and execution logic
7) Test with various intents
8) Run VS Code task: "Phase Complete Gate (All Checks)"
9) Report outputs and mark DONE ✅
```

**Files to Edit**:
- `src/types/operation-plan.ts` (create)
- `src/services/planning-agent.ts` (create)

---

### Phase 3.3: Add Advanced AI Insights

**Priority**: P3
**Estimated Effort**: 2d
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 3.3: Implement AI insights engine for data analysis

Acceptance criteria:
- InsightsEngine with methods: explainAnomalies, discoverRelationships, generatePredictions, generateNarrative
- Integrated with analysis handler
- Insights generated for statistical analyses
- Natural language explanations for findings
- Commands must pass: build + test + typecheck + check:placeholders

Context:
Enhancement: AI-powered insights for data analysis
Integration: Uses MCP sampling + Claude
Impact: Better understanding of data patterns

Proceed:
1) List files you will edit
2) Create InsightsEngine
3) Implement insight methods
4) Integrate with analysis handler
5) Test with sample datasets
6) Run VS Code task: "Phase Complete Gate (All Checks)"
7) Report outputs and mark DONE ✅
```

**Files to Edit**:
- `src/services/insights-engine.ts` (create)
- `src/handlers/analysis.ts` (integrate)

---

### Phase 3.4: Enhanced MCP Sampling with Tool Calling

**Priority**: P3
**Estimated Effort**: 2d
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 3.4: Implement MCP 2025-11-25 sampling enhancements

Acceptance criteria:
- createSamplingRequest() accepts tools, toolChoice, parallelToolCalls parameters
- Multi-tool workflows: data quality analysis → fixes → validation
- Server-side agent loops for complex operations
- Tool chaining with context passing
- Error recovery and retry logic
- 20-40% faster AI-powered operations
- Commands must pass: build + test + typecheck + check:placeholders

Context:
MCP Update: November 2025 specification added concurrent tool execution
Existing: src/mcp/sampling.ts
Enhancement: Add new MCP sampling features
Impact: Faster, more sophisticated AI workflows

Proceed:
1) List files you will edit
2) Enhance createSamplingRequest() with new parameters
3) Implement multi-tool workflows
4) Add server-side agent loop support
5) Update analysis handlers
6) Test multi-tool workflows
7) Run VS Code task: "Phase Complete Gate (All Checks)"
8) Report outputs and mark DONE ✅

Before DONE ✅, output a Capabilities Truth Table including sampling enhancements.
```

**Files to Edit**:
- `src/mcp/sampling.ts`
- `src/handlers/analysis.ts`

---

## 🔒 PHASE 4: SAFETY & RELIABILITY

### Phase 4.1: Implement Transaction Support

**Priority**: P2
**Estimated Effort**: 5d
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 4.1: Add ACID-like transaction support for batch operations

Acceptance criteria:
- Transaction interface defined
- TransactionManager with begin, queue, commit, rollback methods
- begin() creates snapshot
- queue() adds operations to transaction
- commit() executes as single batch request
- rollback() restores snapshot
- sheets_transaction tool with all actions
- Atomicity guaranteed (all or nothing)
- Commands must pass: build + test + typecheck + check:placeholders

Context:
New feature: Transaction support for multi-operation safety
Pattern: Begin → Queue → Commit/Rollback
Impact: Safe batch operations with rollback capability

Proceed:
1) List files you will edit
2) Define transaction types
3) Create TransactionManager
4) Implement transaction lifecycle
5) Create sheets_transaction tool
6) Test atomicity and rollback
7) Run VS Code task: "Phase Complete Gate (All Checks)"
8) Report outputs and mark DONE ✅

Before DONE ✅, output a Capabilities Truth Table including new tool.
```

**Files to Edit**:
- `src/types/transaction.ts` (create)
- `src/services/transaction-manager.ts` (create)
- `src/handlers/transaction.ts` (create)
- `src/schemas/transaction.ts` (create)

---

### Phase 4.2: Enhanced Circuit Breaker with Fallbacks

**Priority**: P2
**Estimated Effort**: 3d
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 4.2: Add fallback strategies to circuit breaker

Acceptance criteria:
- CircuitBreakerWithFallback extends CircuitBreaker
- executeWithFallback() method added
- Fallback strategies: cached data, read-only mode, graceful degradation
- Automatic snapshot before destructive operations
- User confirmation for rollback
- AutoRollbackSystem wraps all destructive operations
- Fallback metrics and monitoring
- Commands must pass: build + test + typecheck + check:placeholders

Context:
Existing: src/utils/circuit-breaker.ts
Enhancement: Add fallback strategies for resilience
New: src/services/auto-rollback.ts
Impact: Better availability during API outages

Proceed:
1) List files you will edit
2) Enhance CircuitBreaker with fallback support
3) Implement fallback strategies
4) Create AutoRollbackSystem
5) Integrate with destructive operations
6) Test circuit breaker with fallbacks
7) Run VS Code task: "Phase Complete Gate (All Checks)"
8) Report outputs and mark DONE ✅
```

**Files to Edit**:
- `src/utils/circuit-breaker.ts`
- `src/services/auto-rollback.ts` (create)

---

### Phase 4.3: Add Conflict Detection

**Priority**: P3
**Estimated Effort**: 3d
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 4.3: Implement concurrent modification conflict detection

Acceptance criteria:
- Conflict and RangeVersion interfaces defined
- ConflictDetector tracks range versions (timestamp, checksum, user)
- detectConflict() compares timestamps and checksums
- resolveConflict() with strategies: overwrite, merge, cancel
- 3-way merge implementation
- Commands must pass: build + test + typecheck + check:placeholders

Context:
New feature: Detect and resolve concurrent modifications
Pattern: Track versions, detect conflicts, resolve
Impact: Multi-user safety

Proceed:
1) List files you will edit
2) Define conflict types
3) Create ConflictDetector
4) Implement version tracking
5) Implement conflict detection
6) Implement resolution strategies
7) Test conflict scenarios
8) Run VS Code task: "Phase Complete Gate (All Checks)"
9) Report outputs and mark DONE ✅
```

**Files to Edit**:
- `src/types/conflict.ts` (create)
- `src/services/conflict-detector.ts` (create)

---

### Phase 4.4: Implement Operation Impact Analysis

**Priority**: P3
**Estimated Effort**: 2d
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 4.4: Add impact analysis for destructive operations

Acceptance criteria:
- ImpactAnalyzer analyzes operation before execution
- Counts cells/rows/columns affected
- Finds affected formulas, charts, pivot tables, validation rules
- Estimates execution time
- showInDryRun() displays impact report
- Integrated with all destructive operations
- Commands must pass: build + test + typecheck + check:placeholders

Context:
New feature: Show impact before executing destructive operations
Pattern: Analyze → Show report → Confirm → Execute
Impact: User confidence and safety

Proceed:
1) List files you will edit
2) Create ImpactAnalyzer
3) Implement analysis methods
4) Integrate with destructive operations
5) Test accuracy
6) Run VS Code task: "Phase Complete Gate (All Checks)"
7) Report outputs and mark DONE ✅
```

**Files to Edit**:
- `src/services/impact-analyzer.ts` (create)
- `src/handlers/*.ts` (integrate with destructive ops)

---

## 🎨 PHASE 5: UX POLISH

### Phase 5.1: Build Comprehensive Undo System

**Priority**: P3
**Estimated Effort**: 5d
**Current Status**: ⬜ Not Started
**Depends**: Phase 1.3

**Phase Prompt** (copy this):

```
Phase 5.1: Implement full undo/redo system

Acceptance criteria:
- sheets_history tool with list, undo, redo, revert_to, clear actions
- UndoSystem tracks operations with snapshots
- Undo/redo chains work correctly
- Revert to specific operation works
- History persisted with snapshots
- Commands must pass: build + test + typecheck + check:placeholders

Context:
Depends on: Phase 1.3 (Operation History Resource)
New feature: Full undo/redo support
Impact: User confidence and productivity

Proceed:
1) List files you will edit
2) Create UndoSystem service
3) Create sheets_history tool
4) Implement all actions
5) Test undo/redo chains
6) Test revert to specific operation
7) Run VS Code task: "Phase Complete Gate (All Checks)"
8) Report outputs and mark DONE ✅

Before DONE ✅, output a Capabilities Truth Table including new tool.
```

**Files to Edit**:
- `src/services/undo-system.ts` (create)
- `src/handlers/history.ts` (create)
- `src/schemas/history.ts` (create)

---

## 📊 PHASE 6: MONITORING & OBSERVABILITY

### Phase 6.1: Add Structured Logging

**Priority**: P3
**Estimated Effort**: 2d
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 6.1: Implement structured logging system

Acceptance criteria:
- StructuredLogger class with request ID tracking
- User ID tracking
- Tool/action tracking
- Duration tracking
- Metadata support
- All console.log replaced with logger
- Consistent log schema
- Commands must pass: build + test + typecheck + check:placeholders

Context:
Enhance: src/utils/logger.ts
Pattern: Structured JSON logs for observability
Impact: Better debugging and monitoring

Proceed:
1) List files you will edit
2) Enhance logger with structured logging
3) Replace all console.log calls
4) Add request/user/tool tracking
5) Test log output format
6) Run VS Code task: "Phase Complete Gate (All Checks)"
7) Report outputs and mark DONE ✅
```

**Files to Edit**:
- `src/utils/logger.ts`
- All files with console.log (mass replacement)

---

### Phase 6.2: Create Health Check Endpoints

**Priority**: P3
**Estimated Effort**: 1d
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 6.2: Add health check HTTP endpoints

Acceptance criteria:
- GET /health endpoint (basic status)
- GET /health/detailed endpoint (full diagnostics)
- Includes: auth status, API connectivity, cache stats, quota stats
- Integrated with HTTP server
- Commands must pass: build + test + typecheck + check:placeholders

Context:
New feature: Health check endpoints for monitoring
Integration: HTTP server (src/http-server.ts)
Impact: Production monitoring and alerting

Proceed:
1) List files you will edit
2) Create health check endpoints
3) Implement detailed diagnostics
4) Integrate with HTTP server
5) Test endpoints
6) Run VS Code task: "Phase Complete Gate (All Checks)"
7) Report outputs and mark DONE ✅
```

**Files to Edit**:
- `src/server/health.ts` (create)
- `src/http-server.ts` (integrate)

---

### Phase 6.3: Set Up Alerting System

**Priority**: P3
**Estimated Effort**: 2d
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 6.3: Implement runtime alerting system

Acceptance criteria:
- AlertingSystem tracks error thresholds
- Alerts on: auth failures >5/5min, disconnects >10/hour, JSON errors >1/hour, API error rate >5%/10min
- Notification delivery implemented
- Alert triggering tested
- Low false positive rate
- Commands must pass: build + test + typecheck + check:placeholders

Context:
New feature: Automatic alerting for production issues
Pattern: Track metrics, trigger on thresholds, notify
Impact: Proactive issue detection

Proceed:
1) List files you will edit
2) Create AlertingSystem
3) Define thresholds
4) Implement metric tracking
5) Implement notification delivery
6) Test alert triggering
7) Run VS Code task: "Phase Complete Gate (All Checks)"
8) Report outputs and mark DONE ✅
```

**Files to Edit**:
- `src/services/alerting.ts` (create)

---

## 🚀 PHASE 7: ADVANCED INTEGRATIONS

### Phase 7.1: BigQuery Connected Sheets Integration

**Priority**: P2
**Estimated Effort**: 3-5d
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 7.1: Implement BigQuery integration with Connected Sheets

Acceptance criteria:
- BigQuery OAuth scopes added to auth
- BigQueryClient with listDatasets, listTables, executeQuery, createTable methods
- sheets_bigquery tool with actions: connect, query, refresh, list_connections, schedule
- DataSource management implemented
- Query-to-sheet workflow works
- Preview mode (LIMIT 100) available
- Large result handling (>10K rows) tested
- Commands must pass: build + test + typecheck + check:placeholders

Context:
New feature: BigQuery integration
Integration: Google BigQuery API
Impact: Enterprise data integration

Proceed:
1) List files you will edit
2) Add BigQuery scopes
3) Create BigQueryClient
4) Implement sheets_bigquery tool
5) Test with real BigQuery datasets
6) Run VS Code task: "Phase Complete Gate (All Checks)"
7) Report outputs and mark DONE ✅

Before DONE ✅, output a Capabilities Truth Table including new tool.
```

**Files to Edit**:
- `src/services/bigquery-client.ts` (create)
- `src/auth/scopes.ts` (add scopes)
- `src/schemas/bigquery.ts` (create)
- `src/handlers/bigquery.handler.ts` (create)

---

### Phase 7.2: Google Apps Script Integration

**Priority**: P2
**Estimated Effort**: 2-3d
**Current Status**: ⬜ Not Started

**Phase Prompt** (copy this):

```
Phase 7.2: Implement Google Apps Script integration

Acceptance criteria:
- Apps Script OAuth scopes added
- AppsScriptClient with full API coverage
- sheets_appscript tool with all actions
- Script templates for common use cases
- create_bound_script convenience action
- Works with Cloud Platform project requirement
- Error handling for common issues
- Commands must pass: build + test + typecheck + check:placeholders

Context:
New feature: Apps Script automation integration
Integration: Google Apps Script API
CRITICAL: Does NOT work with service accounts
Impact: Advanced automation capabilities

Proceed:
1) List files you will edit
2) Add Apps Script scopes
3) Create AppsScriptClient
4) Implement sheets_appscript tool
5) Add script templates
6) Test with real Apps Script projects
7) Run VS Code task: "Phase Complete Gate (All Checks)"
8) Report outputs and mark DONE ✅

Before DONE ✅, output a Capabilities Truth Table including new tool.
```

**Files to Edit**:
- `src/services/appscript-client.ts` (create)
- `src/auth/scopes.ts` (add scopes)
- `src/schemas/appscript.ts` (create)
- `src/handlers/appscript.handler.ts` (create)

---

### Phase 7.3: Unified Cross-Feature Workflows

**Priority**: P3
**Estimated Effort**: 2d
**Current Status**: ⬜ Not Started
**Depends**: Phase 7.1, Phase 7.2

**Phase Prompt** (copy this):

```
Phase 7.3: Create unified Sheets + BigQuery + Apps Script workflows

Acceptance criteria:
- Workflow templates: ETL Pipeline, Automated Reporting, Data Sync
- UnifiedWorkflows orchestrates cross-feature operations
- End-to-end workflows tested
- Documentation for each workflow
- Commands must pass: build + test + typecheck + check:placeholders

Context:
Depends on: Phase 7.1, Phase 7.2
New feature: Cross-feature workflow orchestration
Impact: Powerful automation combining all features

Proceed:
1) List files you will edit
2) Create UnifiedWorkflows service
3) Implement workflow templates
4) Test end-to-end workflows
5) Add documentation
6) Run VS Code task: "Phase Complete Gate (All Checks)"
7) Report outputs and mark DONE ✅
```

**Files to Edit**:
- `src/services/unified-workflows.ts` (create)

---

## HOW TO USE THESE PHASES

### Step 1: Start Fresh
Open Claude and paste PROMPT_CONTRACT.md first to set the rules.

### Step 2: Copy Phase Prompt
Copy the **entire phase prompt** (the code block) from this file.

### Step 3: Paste and Execute
Paste into Claude. Claude will follow the gated workflow:
- List files to edit
- Make changes
- Run verification commands
- Report results
- Mark DONE ✅ or BLOCKED ❌

### Step 4: Verify with VS Code
Run: `Terminal → Run Task → Phase Complete Gate (All Checks)`

This runs:
- npm run build
- npm test
- npm run typecheck
- npm run check:placeholders

### Step 5: Move to Next Phase
Only move to the next phase when current phase shows DONE ✅

---

## QUICK REFERENCE

**CI Gates Available** (in .vscode/tasks.json):
- `CI Gate (Build+Test)` - Quick validation
- `CI Gate (Build+Test+Typecheck)` - Medium validation
- `Phase Complete Gate (All Checks)` - Full validation (use this!)
- `Full Verification (verify script)` - Complete CI including drift check
- `Full CI Pipeline` - Complete pipeline including validation

**Verification Commands**:
```bash
npm run build              # Build project
npm test                   # Run tests
npm run typecheck          # Type checking
npm run check:placeholders # Find TODO/stub/placeholder
npm run check:drift        # Check metadata consistency
npm run verify             # All checks together
npm run ci                 # Full CI pipeline
```

**Guard Script**:
```bash
npm run check:placeholders
# OR
bash scripts/no-placeholders.sh
```

---

## PROGRESS TRACKING

Update this section as you complete phases:

### Completed Phases
- [ ] Phase 0.1: Fix Authentication Client Errors
- [ ] Phase 0.2: Set Production Encryption Key
- [ ] Phase 0.3: Fix Knowledge Base JSON Syntax
- [ ] Phase 1.1: Proactive OAuth Token Refresh
- [ ] Phase 1.2: Optimize Connection Health Monitoring
- [ ] Phase 1.3: Add Operation History Resource
- [ ] Phase 1.4: Add Parameter Inference System
- [ ] Phase 1.5: Add Cache Statistics Resource
- [ ] Phase 2.1: Implement Parallel API Calls + Batch APIs
- [ ] Phase 2.2: Build Predictive Prefetching System
- [ ] Phase 2.3: Implement Batch Request Time Windows
- [ ] Phase 2.4: Optimize Diff Engine
- [ ] Phase 2.5: Enhanced Request Deduplication
- [ ] Phase 3.1: Build Smart Workflow Engine
- [ ] Phase 3.2: Create Operation Planning Agent
- [ ] Phase 3.3: Add Advanced AI Insights
- [ ] Phase 3.4: Enhanced MCP Sampling with Tool Calling
- [ ] Phase 4.1: Implement Transaction Support
- [ ] Phase 4.2: Enhanced Circuit Breaker with Fallbacks
- [ ] Phase 4.3: Add Conflict Detection
- [ ] Phase 4.4: Implement Operation Impact Analysis
- [ ] Phase 5.1: Build Comprehensive Undo System
- [ ] Phase 6.1: Add Structured Logging
- [ ] Phase 6.2: Create Health Check Endpoints
- [ ] Phase 6.3: Set Up Alerting System
- [ ] Phase 7.1: BigQuery Connected Sheets Integration
- [ ] Phase 7.2: Google Apps Script Integration
- [ ] Phase 7.3: Unified Cross-Feature Workflows

**Current Phase**: Phase 0.1
**Last Updated**: 2026-01-07

---

**Remember**: One phase at a time. No rushing. Quality over speed. 🎯
