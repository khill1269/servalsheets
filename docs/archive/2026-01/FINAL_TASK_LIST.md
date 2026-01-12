# ServalSheets Final Task List

## Current Status Summary

**Production Readiness**: 9.0/10
**Test Coverage**: 78% (1,688 tests, 1,643 passing - 98.6% pass rate)
**Wave 3 Status**: Substantially Complete (4/6 tracks done)

---

## 🔴 PRIORITY 0: Quick Wins (< 30 minutes)

### P0.1: Remove Unused Dependencies ✅
**Status**: Ready to execute
**Effort**: 5 minutes
**Impact**: Medium (cleaner dependencies, ~500KB reduction)

```bash
npm uninstall crypto-js @types/crypto-js
```

**Verification**:
- crypto-js: NOT used in codebase ✅
- @types/crypto-js: NOT needed ✅
- No imports found in src/ ✅

---

## 🟠 PRIORITY 1: Fix Test Infrastructure (2-4 hours)

### P1.1: Fix Mock Infrastructure Issues
**Status**: 23 tests failing (98.6% pass rate)
**Effort**: 2-4 hours
**Impact**: High (improve pass rate to 99%+)

**Failing Tests** (5 files, 23 tests):
1. **analyze.test.ts** (13 failures) - Capability cache singleton mocking
2. **auth.test.ts** (7 failures) - OAuth2 client mocking
3. **fix.test.ts** (2 failures) - Type inference with `as const`
4. **mcp-tools-list.test.ts** (2 failures) - Integration schema validation

**Action Plan**:

#### Fix 1: Capability Cache Singleton (analyze.test.ts)
```typescript
// tests/handlers/analyze.test.ts
// Current issue: CapabilityCacheService singleton not properly reset

beforeEach(() => {
  // Add proper singleton reset
  vi.resetModules();
  const { CapabilityCacheService } = await import('../../src/services/capability-cache');
  const cache = CapabilityCacheService.getInstance();
  cache.clear();
});
```

#### Fix 2: OAuth2 Client Mocking (auth.test.ts)
```typescript
// tests/handlers/auth.test.ts
// Current issue: OAuth2Client not properly mocked

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    generateAuthUrl: vi.fn(),
    getToken: vi.fn(),
    setCredentials: vi.fn(),
    credentials: {},
  })),
}));
```

#### Fix 3: Type Inference (fix.test.ts)
```typescript
// tests/handlers/fix.test.ts
// Add explicit type assertion
const input = {
  action: 'fix' as const,  // Add 'as const'
  spreadsheetId: 'test',
  // ...
};
```

#### Fix 4: Integration Schema (mcp-tools-list.test.ts)
```typescript
// Update expected tool count or fix schema registration
// Verify all 24 tools are properly registered
```

**Success Criteria**:
- All 1,688 tests passing (100% pass rate)
- Zero mock configuration issues
- All handlers fully tested

---

## 🟡 PRIORITY 2: Complete Wave 3 (1-2 days)

### P2.1: Track B2 - Server Refactorer
**Status**: Pending
**Effort**: 3-4 hours
**Impact**: Medium (maintainability)

**Objective**: Extract task management from [server.ts](src/server.ts) (922 lines → < 600)

**Files to Create**:
- `src/services/task-manager.ts` - Task lifecycle management
- `tests/services/task-manager.test.ts` - Comprehensive tests

**Extraction Scope**:
```typescript
// Move from server.ts to task-manager.ts:
class TaskManager {
  - registerTask()
  - updateTaskProgress()
  - cancelTask()
  - getTaskStatus()
  - listActiveTasks()
  - cleanupCompletedTasks()
}
```

**Success Criteria**:
- server.ts: < 600 lines
- Zero breaking changes
- All tests passing
- TaskManager has 15+ unit tests

---

### P2.2: Track C2 - HTTP/2 Enabler
**Status**: Pending
**Effort**: 2-3 hours
**Impact**: Low-Medium (5-15% latency reduction)

**Research Phase** (30 min):
```bash
# Verify googleapis HTTP/2 support
npm list googleapis
# Check if googleapis uses http2 by default
```

**Implementation** (1 hour):
```typescript
// src/services/google-api.ts
import { google } from 'googleapis';

const sheets = google.sheets({
  version: 'v4',
  auth: oauth2Client,
  http2: true,  // Enable HTTP/2
});
```

**Testing** (1 hour):
```typescript
// tests/integration/http2.test.ts
it('should use HTTP/2 for Google Sheets API', async () => {
  // Verify HTTP/2 connection
  // Measure latency improvement
});
```

**Success Criteria**:
- HTTP/2 enabled for googleapis
- Latency tests show 5-15% improvement
- No regressions in API calls

---

## 🟢 PRIORITY 3: Type Safety (4-6 hours)

### P3.1: Reduce `any` Type Usage
**Status**: 121 occurrences (target < 20)
**Effort**: 4-6 hours
**Impact**: Medium (type safety)

**High-Priority Fixes**:

#### 1. Redis Client Types (2 occurrences)
```typescript
// src/core/task-store.ts:363
- private client: any;
+ private client: Redis | null;

// src/storage/session-store.ts:175
- private client: any;
+ private client: Redis | null;
```

#### 2. Google API Response Types (~20 occurrences)
```typescript
// Replace generic any with proper googleapis types
- const response: any = await sheets.spreadsheets.get();
+ const response: sheets_v4.Schema$Spreadsheet = await sheets.spreadsheets.get();
```

#### 3. Handler Context Types (~30 occurrences)
```typescript
// Use proper HandlerContext type
- ctx: any
+ ctx: HandlerContext
```

#### 4. Mock Types in Tests (~40 occurrences)
```typescript
// Use proper mock types
- as any
+ as MockedObject<GoogleSheetsService>
```

**Success Criteria**:
- `any` usage: 121 → < 50 occurrences
- Zero type errors
- All tests passing

---

## 📊 PRIORITY 4: Documentation & Polish (1-2 days)

### P4.1: Update README.md
**Status**: 776 lines (target < 400)
**Effort**: 2 hours

**Action**:
- Create [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical details
- Simplify README to focus on quick start
- Move advanced topics to separate guides

### P4.2: Add JSDoc Comments (High-Value APIs)
**Status**: Minimal JSDoc
**Effort**: 4-6 hours (focus on public APIs)

**Priority Files**:
1. `src/services/batching-system.ts`
2. `src/services/prefetching-system.ts`
3. `src/services/transaction-manager.ts`
4. `src/utils/cache-manager.ts`
5. All handler public methods

**Template**:
```typescript
/**
 * Batches multiple append operations into a single API call.
 *
 * @param spreadsheetId - The ID of the spreadsheet
 * @param operations - Array of append operations to batch
 * @returns Promise resolving to batch execution result
 * @throws {ServiceError} If batch execution fails
 *
 * @example
 * ```typescript
 * await batchingSystem.executeBatchValuesAppend('sheet-id', operations);
 * ```
 */
```

### P4.3: Create CONTRIBUTING.md
**Status**: Missing
**Effort**: 1 hour

**Contents**:
- Development setup
- Testing guidelines
- Code style
- PR process
- Agent orchestration patterns

---

## 🚀 PRIORITY 5: Performance Optimization (Optional)

### P5.1: Tree-shake googleapis
**Status**: Not started
**Effort**: 1 day
**Impact**: Low (bundle size reduction)

```typescript
// Instead of
import { google } from 'googleapis';

// Use specific imports
import { sheets_v4 } from '@googleapis/sheets';
import { drive_v3 } from '@googleapis/drive';
```

**Trade-off**: More complex imports vs. smaller bundle
**Recommendation**: Low priority, current bundle size acceptable

---

## 📋 Execution Plan

### Phase 1: Quick Wins (30 minutes)
```bash
# Remove unused dependencies
npm uninstall crypto-js @types/crypto-js

# Verify
npm list
```

### Phase 2: Test Fixes (2-4 hours)
```bash
# Fix capability cache mocking (analyze.test.ts)
# Fix OAuth2 client mocking (auth.test.ts)
# Fix type inference (fix.test.ts)
# Fix integration tests (mcp-tools-list.test.ts)

# Verify
npm test
# Target: 100% pass rate
```

### Phase 3: Complete Wave 3 (1-2 days)
```bash
# Deploy Track B2 agent: Server refactorer
# Deploy Track C2 agent: HTTP/2 enabler

# Verify
npm test
npm run build
npm run typecheck
```

### Phase 4: Type Safety (4-6 hours)
```bash
# Reduce any usage from 121 to < 50
# Focus on: Redis clients, API responses, handler contexts

# Verify
npm run typecheck
```

### Phase 5: Documentation (1-2 days)
```bash
# Update README.md
# Add JSDoc to public APIs
# Create CONTRIBUTING.md

# Verify
npm run build
```

---

## Success Metrics

| Metric | Current | Target | Priority |
|--------|---------|--------|----------|
| **Test Pass Rate** | 98.6% | 100% | 🔴 P1 |
| **Test Coverage** | 78% | 80%+ | 🟢 P3 |
| **Unused Dependencies** | 2 | 0 | 🔴 P0 |
| **any Usage** | 121 | < 50 | 🟡 P3 |
| **server.ts Lines** | 922 | < 600 | 🟡 P2 |
| **Production Readiness** | 9.0/10 | 9.5/10 | 🟡 P2 |

---

## Verification Checklist

After completing all tasks:

- [ ] **P0**: Dependencies cleaned (crypto-js removed)
- [ ] **P1**: All 1,688 tests passing (100% pass rate)
- [ ] **P2.1**: server.ts refactored (< 600 lines)
- [ ] **P2.2**: HTTP/2 enabled (latency improved)
- [ ] **P3**: `any` usage reduced (< 50 occurrences)
- [ ] **P4**: Documentation updated (README, JSDoc, CONTRIBUTING)
- [ ] Zero type errors: `npm run typecheck`
- [ ] Zero lint issues: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Integration tests pass: `npm run test:integration`

---

## Final Production Readiness Estimate

```
Current:  9.0/10
After P0: 9.0/10 (cleanup)
After P1: 9.2/10 (100% tests passing)
After P2: 9.4/10 (Wave 3 complete)
After P3: 9.5/10 (type safety improved)
After P4: 9.6/10 (documentation polished)

Target:   9.5-9.6/10 ✅
```

---

## Time Estimates

| Priority | Tasks | Effort | Agent Count |
|----------|-------|--------|-------------|
| P0 | Quick wins | 30 min | Manual |
| P1 | Test fixes | 2-4 hours | Manual/1 agent |
| P2 | Wave 3 completion | 1-2 days | 2 agents |
| P3 | Type safety | 4-6 hours | Manual/1 agent |
| P4 | Documentation | 1-2 days | Manual/1 agent |
| **Total** | **All** | **3-5 days** | **4-5 agents** |

---

## Agent Deployment Strategy (Optional)

If using orchestrated AI agents:

1. **Fix Agent** (P1): Fix test mock infrastructure
2. **Refactor Agent** (P2.1): Extract task manager from server.ts
3. **HTTP/2 Agent** (P2.2): Enable HTTP/2 for googleapis
4. **Type Safety Agent** (P3): Reduce `any` usage
5. **Documentation Agent** (P4): Update docs and add JSDoc

---

**Generated**: 2026-01-09
**Current Status**: Wave 3 substantially complete (4/6 tracks)
**Remaining Work**: P0-P4 tasks listed above
**Estimated Completion**: 3-5 days with focused effort
