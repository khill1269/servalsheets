# ServalSheets Issue Summary & Quick Reference

**Generated**: 2026-01-31
**Full Details**: See [REMEDIATION_PLAN.md](./REMEDIATION_PLAN.md)

---

## Issues Found

| Priority | Issue | Impact | Effort | Status |
|----------|-------|--------|--------|--------|
| **P0** | HTTP Multi-Session Isolation | 🔴 **CRITICAL** - Cross-user data leaks | 2 weeks | Not Started |
| **P1** | Documentation Drift (291 vs 293 actions) | 🟡 Confusion for users | 1 hour | Not Started |
| **P1** | Response Size Handling | 🟡 Large payload issues | 1 week | Not Started |
| **P2** | Transport Inconsistency | 🟢 Performance variance | 3 days | Not Started |
| **P2** | Task Cancellation Gap (HTTP) | 🟢 Resource cleanup | 1 week | Not Started |
| **P3** | Comment Drift | ⚪ Cosmetic | 5 min | Not Started |

---

## P0 - Critical Security Issue (MUST FIX)

### What's Wrong?

HTTP server shares **process-global singletons** across all users:
- `SessionContextManager` - User A's context visible to User B
- `ContextManager` - User A's spreadsheetId inferred for User B
- `HistoryService` - Shared operation history
- `ETagCache` - Cache keys missing user context (authorization bypass)
- `RequestDeduplication` - Cross-user cache hits

### Real Attack Scenario

```
1. User A (alice@company.com) reads Spreadsheet X
2. Data cached with key: "spreadsheet:X:values:Sheet1!A1:B10"
3. User B (bob@attacker.com) requests same Spreadsheet X
4. Cache hit! Bob gets Alice's data WITHOUT Google API auth check
5. Bob sees confidential financial data he shouldn't access
```

### Official Guidance Violated

**MCP Spec Says**:
> "Servers SHOULD bind session IDs to user-specific information using format `<user_id>:<session_id>`"

**OWASP Says**:
> "Multi-tenant caches MUST include tenant context in keys to prevent cross-tenant data leakage"

### Fix Required

Use **AsyncLocalStorage** for per-request service instances:

```typescript
// Before: Process-global singleton
let sessionContext: SessionContextManager | null = null;
export function getSessionContext() {
  if (!sessionContext) {
    sessionContext = new SessionContextManager(); // ❌ SHARED!
  }
  return sessionContext;
}

// After: Request-scoped context
const requestStorage = new AsyncLocalStorage<RequestContext>();
export function getSessionContext() {
  const context = requestStorage.getStore();
  return context.sessionContext; // ✅ PER-REQUEST INSTANCE
}
```

**Files Affected**:
- `src/utils/request-context.ts` (new)
- `src/http-server.ts:1400-1500`
- `src/services/session-context.ts:979-984`
- `src/services/context-manager.ts:313-318`
- `src/services/history-service.ts:553-558`
- `src/services/etag-cache.ts:42-60`
- `src/utils/request-deduplication.ts:100-150`

**Effort**: 2 weeks (includes security testing)

---

## P1 - Documentation Drift

### What's Wrong?

Code says 293 actions, docs say 293 actions (+19 mismatch)

**Files Claiming 272**:
- [README.md:3](README.md#L3)
- [README.md:59](README.md#L59)
- [docs/guides/SKILL.md:18](docs/guides/SKILL.md#L18)
- [src/mcp/completions.ts:17](src/mcp/completions.ts#L17) (comment only)

**Source of Truth**:
- [src/schemas/annotations.ts:224](src/schemas/annotations.ts#L224): `ACTION_COUNT = 291` ✅
- [server.json:4](server.json#L4): `"actionCount": 291` ✅

### Fix Required

```bash
# Automated fix
npm run gen:metadata

# Manual updates
sed -i 's/293 actions/293 actions/g' README.md
sed -i 's/293 actions/293 actions/g' docs/guides/SKILL.md
sed -i 's/Total: 293 actions/Total: 293 actions/g' src/mcp/completions.ts
```

**Effort**: 1 hour

---

## P1 - Response Size Handling

### What's Wrong?

1. **batch_read pagination disabled** - Line 1114: `const wantsPagination = false;`
2. **Resources unbounded** - `sheets:///id/range` can return entire sheet
3. **Streaming progress not emitted** - Logs progress but no MCP notifications

### Fix Required

#### Re-enable batch_read pagination

```typescript
// src/handlers/data.ts:1114
- const wantsPagination = false;
+ const wantsPagination = Boolean(input.cursor || input.pageSize || input.streaming);
```

#### Add resource truncation

```typescript
// src/resources/resource-registration.ts:180
if (cellCount > 10000) {
  return {
    contents: [{
      text: JSON.stringify({
        values: values.slice(0, 1000),
        truncated: true,
        message: "Use sheets_data.read with pagination for full access"
      })
    }]
  };
}
```

#### Emit progress notifications

```typescript
// src/analysis/streaming.ts:230
if (progressToken && mcpServer) {
  await mcpServer.notification({
    method: 'notifications/progress',
    params: {
      progressToken,
      progress: processedSheets,
      total: totalSheets,
    }
  });
}
```

**Effort**: 1 week

---

## P2 - Transport Inconsistency

### What's Wrong?

**STDIO path** gets performance optimizations:
- Prefetch predictor
- Request merger
- Parallel executor
- Adaptive batch compiler

**HTTP path** doesn't get these optimizations → different performance

### Fix Required

Extract to shared function:

```typescript
// src/startup/performance-init.ts (new file)
export function initializePerformanceOptimizations(googleClient) {
  return {
    prefetchPredictor: new PrefetchPredictor(),
    requestMerger: new RequestMerger(),
    parallelExecutor: new ParallelExecutor(),
    batchCompiler: new BatchCompiler(),
  };
}

// Use in both src/server.ts and src/http-server.ts
const perfServices = initializePerformanceOptimizations(googleClient);
Object.assign(handlerContext, perfServices);
```

**Effort**: 3 days

---

## P2 - Task Cancellation Gap (HTTP)

### What's Wrong?

STDIO server has AbortController support, HTTP doesn't

**Missing**:
- AbortSignal not passed to handlers
- Can't cancel long-running operations
- Resources not cleaned up on disconnect

### Fix Required

```typescript
// 1. Add to HandlerContext
export interface HandlerContext {
  abortSignal?: AbortSignal;
}

// 2. Create AbortController per task
const abortController = new AbortController();
taskAbortControllers.set(taskId, abortController);

// 3. Pass to Google API
await sheetsApi.spreadsheets.values.get({
  spreadsheetId,
  range,
}, {
  signal: abortController.signal // ✅
});

// 4. Handle cancellation
if (error.name === 'AbortError') {
  return { status: 'cancelled' };
}
```

**Effort**: 1 week

---

## P3 - Comment Drift

### What's Wrong?

Comment says 272, code has 291

```typescript
// src/mcp/completions.ts:17
/**
 * Total: 293 actions  // ❌ WRONG
 */
```

### Fix Required

```diff
-* Total: 293 actions across 21 tools
+* Total: 293 actions across 21 tools
```

**Effort**: 5 minutes

---

## Recommended Implementation Order

### Phase 1: Quick Wins (1 day)
1. ✅ Fix P3 comment drift (5 min)
2. ✅ Fix P1 documentation drift (1 hour)
3. ✅ Add CI checks for future drift

### Phase 2: Features (2-3 weeks)
4. ✅ P1 response size handling (1 week)
5. ✅ P2 transport consistency (3 days)
6. ✅ P2 task cancellation (1 week)

### Phase 3: Security (2 weeks)
7. ✅ P0 multi-session isolation (2 weeks)
   - Most complex
   - Requires security audit
   - Needs staging validation

---

## Testing Requirements

### P0 Security Testing (Critical)

```typescript
// Must verify:
test('concurrent users have isolated context', async () => {
  const user1 = createClient('token-user1');
  const user2 = createClient('token-user2');

  await user1.setActive('sheet-A');
  const active = await user2.getActive();

  expect(active).not.toBe('sheet-A'); // ✅ ISOLATED
});

test('cache keys are user-scoped', async () => {
  const user1Cache = new ETagCache({ keyPrefix: 'user:1:' });
  const user2Cache = new ETagCache({ keyPrefix: 'user:2:' });

  user1Cache.set('sheet:X', data);

  expect(user2Cache.get('sheet:X')).toBeNull(); // ✅ NO LEAK
});
```

### All Fixes

- [ ] Unit tests pass (`npm run test:fast`)
- [ ] Integration tests pass (`npm run test:live`)
- [ ] Verification pipeline passes (`npm run verify`)
- [ ] No metadata drift (`npm run check:drift`)
- [ ] Security review completed (P0 only)
- [ ] Staging deployment validated
- [ ] Performance benchmarks acceptable (P2s)

---

## What's NOT Broken?

✅ **Build Status**: All 1403 tests passing
✅ **TypeScript**: 0 compilation errors
✅ **Linting**: Clean (41 CLI warnings acceptable)
✅ **No TODOs/FIXMEs**: Clean codebase
✅ **No console.logs**: Proper logging everywhere
✅ **Metadata Generation**: Works correctly (293 actions in code)
✅ **STDIO Mode**: Fully functional with optimizations

---

## Official Documentation References

**MCP Protocol**:
- [MCP 2025-11-25 Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [Security Best Practices](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices)
- [Session Hijacking Prevention](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices#session-hijacking)

**Node.js Best Practices**:
- [AsyncLocalStorage Documentation](https://nodejs.org/api/async_context.html)
- [Multi-Tenant Node.js Guide](https://medium.com/@larbisahli/multi-tenant-application-architecture-with-node-js-express-and-postgresql-3b94ea270a72)
- [Singleton Anti-Pattern Warning](https://www.bennadel.com/blog/4327-caution-your-javascript-node-module-might-be-a-singleton-anti-pattern.htm)

**OWASP Security**:
- [Cache Poisoning](https://owasp.org/www-community/attacks/Cache_Poisoning)
- [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [Multi-Tenant Access Controls](https://github.com/OWASP/ASVS/issues/2060)

**Google Sheets API**:
- [Values API Reference](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values)
- [Usage Limits](https://developers.google.com/sheets/api/limits)
- [Best Practices](https://cloud.google.com/apis/docs/client-libraries-best-practices)

---

## Next Steps

1. **Review** this summary and [REMEDIATION_PLAN.md](./REMEDIATION_PLAN.md)
2. **Prioritize** based on deployment needs:
   - Deploying HTTP server soon? → **Fix P0 immediately**
   - STDIO only? → **P0 is lower priority**
3. **Start with quick wins** (P3 + P1 docs) to build momentum
4. **Security audit** before deploying HTTP multi-tenant mode

---

**Questions?** See full implementation details in [REMEDIATION_PLAN.md](./REMEDIATION_PLAN.md)
