# ServalSheets Fixes Checklist

**Track remediation progress here**

---

## P0 - Critical Security: HTTP Multi-Session Isolation

**Status**: [ ] Not Started | [ ] In Progress | [ ] Testing | [ ] Complete

### Implementation Tasks

- [ ] Create `src/utils/request-context.ts` with AsyncLocalStorage
- [ ] Update `src/http-server.ts:1400-1500` - Create per-request services
- [ ] Update `src/services/session-context.ts:979-984` - Add context getter
- [ ] Update `src/services/context-manager.ts:313-318` - Add context getter
- [ ] Update `src/services/history-service.ts:553-558` - Add context getter
- [ ] Update `src/services/etag-cache.ts:42-60` - Add keyPrefix support
- [ ] Update `src/utils/request-deduplication.ts:100-150` - Add user context to keys

### Testing Tasks

- [ ] Write `tests/security/session-isolation.test.ts`
- [ ] Write `tests/live-api/security/multi-session.live.test.ts`
- [ ] Run unit tests: `npm run test:fast`
- [ ] Run integration tests: `npm run test:live`
- [ ] Security audit completed
- [ ] Staging deployment validated
- [ ] Performance impact < 5%

### Verification

- [ ] Two concurrent users have isolated context
- [ ] Cache keys include user/session prefix
- [ ] No cross-user data leaks in logs
- [ ] Authorization checks before cache hits
- [ ] STDIO mode still works (backward compat)

**Estimated Effort**: 2 weeks
**Actual Effort**: ****\_****

---

## P1 - Documentation Drift

**Status**: [ ] Not Started | [ ] In Progress | [ ] Testing | [X] Complete

### Implementation Tasks

- [x] Run `npm run gen:metadata`
- [x] Update `README.md:3` - Change 272 → 291
- [x] Update `README.md:59` - Change 272 → 291
- [x] Update `README.md:70` - Change 272 → 291
- [x] Update `docs/guides/SKILL.md:18` - Change 272 → 291
- [x] Update `src/mcp/completions.ts:17` - Comment 272 → 291

### Testing Tasks

- [x] Run `npm run check:drift` (should pass)
- [x] Add drift check to `.github/workflows/ci.yml`
- [x] Add drift check to `.husky/pre-commit`
- [x] Verify all docs match `src/schemas/annotations.ts:173-195`

### Verification

- [x] `npm run check:drift` passes
- [x] README shows "21 tools, 291 actions"
- [x] SKILL guide shows "291 actions"
- [x] CI checks documentation on every commit

**Estimated Effort**: 1 hour
**Actual Effort**: 45 minutes

---

## P1 - Response Size Handling

**Status**: [ ] Not Started | [ ] In Progress | [ ] Testing | [ ] Complete

### Implementation Tasks

#### batch_read Pagination

- [ ] Update `src/handlers/data.ts:1114` - Change `false` → `Boolean(...)`
- [ ] Update `src/schemas/data.ts` - Ensure cursor/pageSize/streaming fields exist
- [ ] Test with 50k cell range

#### Resource Truncation

- [ ] Update `src/resources/resource-registration.ts:150-200`
- [ ] Add truncation logic for ranges > 10k cells
- [ ] Return truncated: true + message
- [ ] Test with `sheets:///id/Sheet1!A1:Z20000`

#### Progress Notifications

- [ ] Update `src/analysis/streaming.ts:200-250` - Add MCP notifications
- [ ] Update `src/handlers/analyze.ts` - Extract progressToken
- [ ] Test progress notifications emitted correctly

### Testing Tasks

- [ ] Write `tests/handlers/data-pagination.test.ts`
- [ ] Write `tests/live-api/tools/sheets-data-large.live.test.ts`
- [ ] Test batch_read with pageSize=1000
- [ ] Test resource reads > 10k cells
- [ ] Test streaming analysis progress

### Verification

- [ ] batch_read pagination works
- [ ] Resources truncate at 10k cells
- [ ] Progress notifications emitted during streaming
- [ ] No performance regression

**Estimated Effort**: 1 week
**Actual Effort**: ****\_****

---

## P2 - Transport Inconsistency

**Status**: [ ] Not Started | [ ] In Progress | [ ] Testing | [ ] Complete

### Implementation Tasks

- [ ] Create `src/startup/performance-init.ts` - Extract optimization init
- [ ] Update `src/server.ts:200-300` - Use performance-init
- [ ] Update `src/http-server.ts:180-195` - Add performance services
- [ ] Add feature flag `ENABLE_PERFORMANCE_OPTIMIZATIONS`

### Testing Tasks

- [ ] Write `tests/benchmarks/transport-parity.bench.ts`
- [ ] Benchmark STDIO performance
- [ ] Benchmark HTTP performance
- [ ] Verify < 20% difference

### Verification

- [ ] Both transports have same optimizations
- [ ] Performance within 20% of each other
- [ ] No regressions in either transport

**Estimated Effort**: 3 days
**Actual Effort**: ****\_****

---

## P2 - Task Cancellation Gap (HTTP)

**Status**: [ ] Not Started | [ ] In Progress | [ ] Testing | [ ] Complete

### Implementation Tasks

- [ ] Update `src/handlers/base.ts:20-40` - Add abortSignal to HandlerContext
- [ ] Update `src/http-server.ts:130-180` - Create task store with cancellation
- [ ] Update `src/mcp/registration/tool-handlers.ts:300-400` - Pass AbortSignal
- [ ] Update `src/handlers/data.ts:611-693` - Check signal in read
- [ ] Update `src/handlers/analyze.ts` - Check signal in loops
- [ ] Update `src/handlers/composite.ts` - Check signal between ops

### Testing Tasks

- [ ] Write `tests/handlers/cancellation.test.ts`
- [ ] Write `tests/live-api/cancellation.live.test.ts`
- [ ] Test handler respects AbortSignal
- [ ] Test task marked as cancelled
- [ ] Test client can cancel operations

### Verification

- [ ] AbortSignal passed to all handlers
- [ ] Long operations check signal
- [ ] Resources cleaned up on abort
- [ ] Tasks marked as 'cancelled' state

**Estimated Effort**: 1 week
**Actual Effort**: ****\_****

---

## P3 - Comment Drift

**Status**: [ ] Not Started | [ ] In Progress | [ ] Testing | [X] Complete

### Implementation Tasks

- [x] Update `src/mcp/completions.ts:17` - Change comment 272 → 291

### Verification

- [x] Comment matches actual count (291)

**Estimated Effort**: 5 minutes
**Actual Effort**: 2 minutes

---

## Overall Progress

**Phase 1 - Quick Wins**:

- [x] P3 complete (2 min) ✅
- [x] P1 docs complete (45 min) ✅

**Phase 2 - Features**:

- [ ] P1 response complete (1 week)
- [ ] P2 transport complete (3 days)
- [ ] P2 cancellation complete (1 week)

**Phase 3 - Security**:

- [ ] P0 isolation complete (2 weeks)

**Total Completion**: 33% (2/6 items) → Target: 100%

---

## Sign-Off

**Implementer**: ******\_\_\_\_******
**Reviewer**: ******\_\_\_\_******
**Security Auditor**: ******\_\_\_\_******
**Date**: ******\_\_\_\_******
