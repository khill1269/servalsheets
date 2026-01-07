# ServalSheets: Optimized Phase Execution Plan

**Version**: 1.3.0
**Date**: 2026-01-07
**Goal**: Ship production-ready MCP server in 6-7 hours

This is the streamlined, prioritized version based on comprehensive analysis.
See [COMPREHENSIVE_PLAN.md](./COMPREHENSIVE_PLAN.md) for full details.

---

## 🎯 QUICK START

**Use this workflow**:
1. Paste [PROMPT_CONTRACT.md](./PROMPT_CONTRACT.md) into Claude
2. Copy phase prompt below
3. Run → Verify → Mark DONE ✅
4. Move to next phase

**VS Code Task**: `Terminal → Run Task → Phase Complete Gate (All Checks)`

---

## 🔥 PHASE 0: CRITICAL FIXES (MUST DO FIRST)

### Phase 0.1: Fix MCP Tools List Timeouts 🚨

**Priority**: P0 (HIGHEST) | **Effort**: 2h | **Blocking**: Yes

**Phase Prompt**:

```
Phase 0.1: Fix MCP tools/list timeout failures

Acceptance criteria:
- 3 timeout tests in mcp-tools-list.test.ts pass
- Server responds to stdio within 10 seconds
- No blocking operations during initialization
- tools/list returns all 23 tools correctly
- Commands must pass: build + test + typecheck + check:placeholders

Context:
File: tests/integration/mcp-tools-list.test.ts
Issue: All 3 tests timeout waiting for server response (10s limit)
Root causes to investigate:
1. Server hangs during startup
2. stdio communication blocked
3. Synchronous blocking operation in initialization
4. Knowledge base loading too slow (40 files)

Constraints:
- Must maintain MCP protocol compliance
- Cannot break existing functionality
- Must preserve knowledge base loading

Proceed:
1) List files you will investigate
2) Run manual test: `node dist/cli.js` (test stdio responsiveness)
3) Profile server startup time
4) Identify blocking operation
5) Implement fix (async loading, timeout increase, or remove blocker)
6) Run VS Code task: "Phase Complete Gate (All Checks)"
7) Report outputs and mark DONE ✅

Expected Fix: Either:
- Make knowledge base loading async/non-blocking
- Increase test timeout if server legitimately takes >10s
- Remove/defer expensive startup operations
```

**Investigation Steps**:
1. Check server startup time: `time node dist/cli.js < /dev/null &`
2. Test stdio: `echo '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}' | node dist/cli.js`
3. Review: `src/server.ts` initialization
4. Review: `src/resources/knowledge.ts` file loading (40 files)
5. Check for synchronous `fs.readFileSync` calls

**Possible Fixes**:
- Make knowledge base loading async
- Defer knowledge base loading until first request
- Increase test timeout to 30s
- Add initialization progress logging

**Success Criteria**:
```bash
npm test tests/integration/mcp-tools-list.test.ts
# Expected: 3/3 tests passing
```

---

### Phase 0.2: Fix HTTP Transport Tests

**Priority**: P0 | **Effort**: 1h

**Phase Prompt**:

```
Phase 0.2: Fix HTTP transport health and auth tests

Acceptance criteria:
- /health endpoint returns status: "healthy" (not "degraded")
- Authorization header test passes
- No regression in other HTTP tests
- Commands must pass: build + test + typecheck + check:placeholders

Context:
File: tests/integration/http-transport.test.ts
Issues:
1. Health check returns "degraded" when should be "healthy"
2. Authorization header test expects 401 but gets 200/406

Constraints:
- Health status must reflect actual system state
- Authorization must work correctly

Proceed:
1) List files you will edit
2) Fix health check logic (investigate why degraded)
3) Fix or update authorization test
4) Run VS Code task: "Phase Complete Gate (All Checks)"
5) Report outputs and mark DONE ✅
```

**Files to Check**:
- `src/http-server.ts` - Health endpoint logic
- `src/server.ts` - Health check dependencies

**Likely Fix**: Health check too strict (checking unavailable dependencies)

---

### Phase 0.3: Fix Property Test (Write Action)

**Priority**: P0 | **Effort**: 30 min

**Phase Prompt**:

```
Phase 0.3: Fix write action property test failure

Acceptance criteria:
- Property test for write action passes
- Schema validation correct for all edge cases
- No regression in other property tests
- Commands must pass: build + test + typecheck + check:placeholders

Context:
File: tests/property/schema-validation.property.test.ts
Test: "should accept valid write action inputs"
Issue: Write action validation failing on edge case

Constraints:
- Must maintain type safety
- Cannot loosen validation inappropriately

Proceed:
1) List files you will edit
2) Investigate exact validation error
3) Fix schema or test case (whichever is incorrect)
4) Run VS Code task: "Phase Complete Gate (All Checks)"
5) Report outputs and mark DONE ✅
```

**Files to Check**:
- `src/schemas/values.ts` - Write action schema
- Test file to see exact failure

---

### Phase 0.4: Remove All Placeholders

**Priority**: P0 | **Effort**: 1.5h

**Phase Prompt**:

```
Phase 0.4: Remove all TODO/placeholder/simulate comments

Acceptance criteria:
- Zero placeholders in src/ directory
- All TODOs either implemented or removed
- All "simulate" comments replaced with real implementations
- Intentional "not implemented" features marked explicitly
- Commands must pass: build + test + typecheck + check:placeholders

Context:
Found 16 placeholders in source code:
- 4 TODOs: remote-server.ts, prefetching-system.ts
- 2 "placeholder": pivots.ts, fix.ts
- 2 "simulate": fix.ts, cancellation.test.ts
- 6 "not implemented": versions.ts, advanced.ts
- 2 TODOs in tests (acceptable, skipping)

Constraints:
- No placeholders/stubs/TODOs in final code
- Features either implemented or explicitly marked as intentional omissions
- Cannot break existing functionality

Proceed:
1) List all 14 source file placeholders to fix
2) For each placeholder:
   - Implement if simple
   - Remove if unnecessary
   - Mark as INTENTIONALLY_UNIMPLEMENTED if complex feature stub
3) Verify no functionality regression
4) Run VS Code task: "Phase Complete Gate (All Checks)"
5) Report outputs and mark DONE ✅

Specific fixes required:
- remote-server.ts:237 - Implement Redis ping or remove
- prefetching-system.ts:302 - Implement or remove auto-refresh
- pivots.ts:40 - Remove "placeholder" comment, return proper data
- fix.ts:379,413 - Remove "placeholder"/"simulate"
- versions.ts:323 - Change to INTENTIONALLY_UNIMPLEMENTED
- advanced.ts:645 - Change to INTENTIONALLY_UNIMPLEMENTED
- transaction-manager.ts:456 - Implement or mark manual-only
```

---

### Phase 0.5: Commit All Staged Work

**Priority**: P0 | **Effort**: 30 min

**Phase Prompt**:

```
Phase 0.5: Commit all staged changes in logical groups

Acceptance criteria:
- All 21 staged files committed
- Commits are atomic and logical
- Commit messages follow conventional commit format
- No uncommitted changes in git status
- Build still passes after commits

Context:
21 files staged:
- 14 documentation files (completion reports)
- 4 source files (handlers, schemas)
- 3 supporting files

Constraints:
- Each commit should be atomic (one logical change)
- Commit messages descriptive
- No "WIP" or "misc" commits

Proceed:
1) Review git status
2) Create 4 logical commits:
   a) Knowledge base completion (formulas, templates, schemas)
   b) Tool enhancements (Phase 2 work)
   c) Bug fixes (handlers, schemas)
   d) Documentation (status reports)
3) Verify build passes after each commit
4) Run VS Code task: "Phase Complete Gate (All Checks)"
5) Report outputs and mark DONE ✅

Commit format:
feat: <description>
fix: <description>
docs: <description>

Body: Details and impact
```

---

## ⭐ PHASE 1: PRODUCTION POLISH (HIGH PRIORITY)

### Phase 1.1: Fix Documentation Accuracy

**Priority**: P1 | **Effort**: 30 min

**Phase Prompt**:

```
Phase 1.1: Remove false claims from documentation

Acceptance criteria:
- No mentions of brain/ directory
- No mentions of orchestration/ directory
- All feature claims accurate and verifiable
- Documentation honest about what exists
- Commands must pass: build + test + typecheck + check:placeholders

Context:
Files to update:
- README.md
- DELIVERABLES.md
- src/knowledge/README.md

False claims to remove:
- brain/ directory (never existed)
- orchestration/ directory (never existed)

Constraints:
- Honesty is non-negotiable
- Only claim features that exist
- Document what IS, not what SHOULD BE

Proceed:
1) List files to edit
2) Search and remove brain/ mentions
3) Search and remove orchestration/ mentions
4) Verify all claims in README are accurate
5) Run VS Code task: "Phase Complete Gate (All Checks)"
6) Report outputs and mark DONE ✅
```

---

### Phase 1.2: Add Encryption Key Documentation

**Priority**: P1 | **Effort**: 30 min

**Phase Prompt**:

```
Phase 1.2: Document ENCRYPTION_KEY setup requirement

Acceptance criteria:
- .env.example has ENCRYPTION_KEY with instructions
- README.md has Security Setup section
- QUICKSTART.md mentions encryption key
- Users know how to generate and set key
- Commands must pass: build + test + typecheck + check:placeholders

Context:
Issue: ENCRYPTION_KEY not documented, causes 14 warnings
Security: Required for token encryption at rest

Constraints:
- Never commit actual .env file
- Clear instructions for key generation
- Security best practices

Proceed:
1) List files to edit
2) Update .env.example with key placeholder + generation command
3) Add Security Setup section to README
4) Update QUICKSTART with encryption key step
5) Run VS Code task: "Phase Complete Gate (All Checks)"
6) Report outputs and mark DONE ✅

Key generation command:
openssl rand -hex 32
```

---

### Phase 1.3: Optimize Connection Health Monitoring

**Priority**: P1 | **Effort**: 1h

**Phase Prompt**:

```
Phase 1.3: Tune connection health check thresholds

Acceptance criteria:
- disconnectThresholdMs: 60000 → 120000 (2 min)
- warnThresholdMs: 30000 → 60000 (1 min)
- checkIntervalMs: 10000 → 15000 (15 sec)
- Exponential backoff for reconnects
- Routine disconnects logged at debug level
- <10 disconnections per hour during normal use
- Commands must pass: build + test + typecheck + check:placeholders

Context:
File: src/mcp/registration.ts
Issue: Too aggressive health checks cause frequent disconnects
Impact: User experience, log noise

Constraints:
- Must detect actual disconnects
- Cannot hide real issues
- Balance between responsiveness and stability

Proceed:
1) List files to edit
2) Update threshold constants
3) Implement exponential backoff for reconnects
4) Adjust log levels (routine → debug, unexpected → warn)
5) Test with manual connection interruptions
6) Run VS Code task: "Phase Complete Gate (All Checks)"
7) Report outputs and mark DONE ✅
```

---

### Phase 1.4: Implement Proactive Token Refresh

**Priority**: P2 | **Effort**: 2h

**Phase Prompt**:

```
Phase 1.4: Add proactive OAuth token refresh with monitoring

Acceptance criteria:
- Background worker checks tokens every 5 minutes
- Refreshes at 80% of token lifetime
- Security monitoring for unusual refresh patterns
- Alert on >10 refreshes/hour
- Zero "token expired" errors during operations
- Commands must pass: build + test + typecheck + check:placeholders

Context:
File: src/services/token-manager.ts (exists)
Enhancement: Proactive refresh + security monitoring
Impact: Better UX, security

Constraints:
- Must handle race conditions
- Must not cause thundering herd
- Security monitoring required

Proceed:
1) List files to edit
2) Add background worker (setInterval)
3) Implement checkAndRefresh() logic
4) Add security monitoring (track refresh rate)
5) Integrate with auth handler
6) Test with near-expired tokens
7) Run VS Code task: "Phase Complete Gate (All Checks)"
8) Report outputs and mark DONE ✅
```

---

## ⚡ PHASE 2: PERFORMANCE OPTIMIZATIONS (OPTIONAL)

### Phase 2.1: Enhanced Request Deduplication

**Priority**: P2 | **Effort**: 1h | **Impact**: 30-50% API reduction

**Phase Prompt**:

```
Phase 2.1: Add result caching to request deduplication

Acceptance criteria:
- LRU cache for completed requests (max: 1000, ttl: 60s)
- Check cache before making new requests
- Cache hit/miss metrics
- 30-50% reduction in redundant API calls
- 80-95% latency for cached results
- Commands must pass: build + test + typecheck + check:placeholders

Context:
File: src/utils/request-deduplication.ts (exists)
Enhancement: Cache results, not just in-flight requests
Impact: Massive performance win, near-zero cost

Proceed:
1) List files to edit
2) Extend RequestDeduplicator with result cache
3) Add LRU cache (lru-cache dependency)
4) Check cache before deduplicate()
5) Store results after completion
6) Add metrics tracking
7) Test with identical requests
8) Run VS Code task: "Phase Complete Gate (All Checks)"
9) Report outputs and mark DONE ✅
```

---

### Phase 2.2: Batch API Optimization (High Value)

**Priority**: P2 | **Effort**: 4h per handler | **Impact**: 70-90% API reduction

**Note**: This is a multi-phase task. Do ONE handler at a time.

**Phase Prompt Template**:

```
Phase 2.2-[N]: Optimize [HandlerName] with batch APIs

Acceptance criteria:
- Replace sequential API calls with batchUpdate/batchGet
- Use Promise.all() for independent operations
- 70-90% reduction in API calls for multi-range operations
- All functionality preserved
- Tests pass
- Commands must pass: build + test + typecheck + check:placeholders

Context:
File: src/handlers/[handler].ts
Strategy: Identify sequential calls, group into batches
Impact: Massive latency reduction

Proceed:
1) List sequential API calls in this handler
2) Group independent calls
3) Replace with batch APIs:
   - spreadsheets.batchUpdate (formatting, multiple changes)
   - spreadsheets.values.batchGet (reading multiple ranges)
   - spreadsheets.values.batchUpdate (writing multiple ranges)
4) Test all actions in this handler
5) Measure API call reduction
6) Run VS Code task: "Phase Complete Gate (All Checks)"
7) Report outputs and mark DONE ✅

Handler priority order:
1. values.ts (most used)
2. format.ts (high batch potential)
3. sheet.ts (common operations)
4. cells.ts
5. [others...]
```

---

## 📋 RECOMMENDED EXECUTION ORDER

### Day 1: Critical Path (6-7 hours)

**Goal**: Ship production v1.3.0

```
Morning (3-4 hours):
✅ Phase 0.1: Fix MCP timeouts (2h) - HIGHEST PRIORITY
✅ Phase 0.2: Fix HTTP tests (1h)
✅ Phase 0.3: Fix property test (30 min)

Afternoon (2-3 hours):
✅ Phase 0.4: Remove placeholders (1.5h)
✅ Phase 0.5: Commit staged work (30 min)
✅ Phase 1.1: Fix documentation (30 min)
✅ Phase 1.2: Add encryption docs (30 min)

Verification (30 min):
✅ npm test (841/841 passing)
✅ npm run check:placeholders (0 found)
✅ Manual testing in Claude Desktop
✅ Tag v1.3.0
```

**Success Criteria**:
- All tests pass
- No placeholders
- Docs accurate
- Ready for production

---

### Day 2-3: Performance (Optional)

**Goal**: Optimize for production scale

```
Day 2:
✅ Phase 1.3: Health monitoring (1h)
✅ Phase 1.4: Token refresh (2h)
✅ Phase 2.1: Request dedup (1h)
✅ Phase 2.2: Start batch optimization (2-3 handlers)

Day 3:
✅ Phase 2.2: Continue batch optimization
✅ Performance testing
✅ Tag v1.3.1
```

---

### Future: Enterprise Features

Based on user feedback:
- BigQuery integration
- Apps Script integration
- Transaction support
- Advanced AI workflows

---

## 🚦 GATE CHECKPOINTS

### After Phase 0 (Critical Fixes)
```bash
✅ npm test                     # 841/841 passing
✅ npm run check:placeholders  # 0 found
✅ npm run typecheck           # 0 errors
✅ git status                  # Clean (all committed)
```

**Decision Point**: Can ship v1.3.0 now if all pass

### After Phase 1 (Polish)
```bash
✅ All Phase 0 checks pass
✅ README accurate
✅ ENCRYPTION_KEY documented
✅ Manual testing complete
```

**Decision Point**: Ship v1.3.0 (recommended)

### After Phase 2 (Performance)
```bash
✅ All Phase 1 checks pass
✅ Performance benchmarks show improvement
✅ No regression in functionality
```

**Decision Point**: Ship v1.3.1 with optimizations

---

## 🎯 QUICK REFERENCE

**Start Phase**: Copy prompt → Paste into Claude (after PROMPT_CONTRACT.md)

**Verify Phase**: `Terminal → Run Task → Phase Complete Gate (All Checks)`

**Mark Complete**: Only when all criteria met and gates pass

**Move Next**: After DONE ✅

**Skip Phase**: Only if non-blocking and documented why

---

**Current Priority**: Phase 0.1 (Fix MCP timeouts)
**Blocking**: Yes - must fix before anything else
**Time Estimate**: 2 hours

**Let's start! 🚀**
