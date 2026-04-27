---
title: Advanced Gotchas (Sessions 112-116+)
category: development
last_updated: 2026-04-26
description: Session-specific learnings too detailed for CLAUDE.md — FlatToolInterceptor, ETag isolation, safe-regex, and other subtle invariants.
---

# Advanced Gotchas (Sessions 112–116+)

Session-specific learnings that are too detailed for the CLAUDE.md 300-line budget but important for the relevant code areas.

---

## 11. Schema Changes Also Require Snapshot Updates

After editing `SafetyOptionsSchema`, `RangeInputSchema`, or any shared schema — the snapshot tests in `tests/snapshots/` will fail even after `check:drift` passes:

```bash
npx vitest run tests/snapshots -u   # update snapshots
npm run verify:safe                  # then full verify
```

`check:drift` tracks action/tool counts; snapshot tests track full JSON schema shapes. Both must pass.

---

## 12. `safety.confirmed` — Pre-approval bypass for elicitation

For clients that don't support MCP Elicitation, destructive `sheets_advanced` operations (delete_named_range, delete_banding, delete_protected_range) return `ELICITATION_UNAVAILABLE`. Bypass by re-calling with `safety.confirmed: true`:

```typescript
{ action: 'delete_named_range', namedRangeId: 'nr1', safety: { confirmed: true } }
```

`SafetyOptionsSchema` now has `confirmed: z.boolean().optional()`. The handler passes `skipIfElicitationUnavailable: req.safety?.confirmed === true` to `requestSafetyConfirmation()`.

---

## 13. Error Source Inference — shared utility

When classifying errors for `fixableVia` routing, use the canonical utility:

```typescript
import { inferErrorSource } from '../utils/infer-error-source.js';
const source = inferErrorSource(error); // 'google_api' | 'ai_service' | 'validation' | 'auth' | undefined
```

`BaseHandler.mapError()` and `mapStandaloneError()` both use this. Do NOT inline the heuristic — it was already duplicated and consolidated.

---

## 14. `convertRangeInput` is gone — use `convertRangeInputAsync`

The sync `convertRangeInput` private method was removed from `AnalyzeHandler`. All callers now use `convertRangeInputAsync(spreadsheetId, range)` which:

- Handles `grid` branch via `convertGridRangeToA1`
- Returns `{ notImplemented: true, reason }` for `semantic` (caller must emit `NOT_IMPLEMENTED`)
- Handles `a1` and `namedRange` synchronously (same as before)

Deps interfaces that used to accept `(range) => ConvertedRangeInput | undefined` now accept `(range) => Promise<ConvertedRangeInput | { notImplemented: true; reason: string } | undefined>`.

---

## 15. `annotateAIGeneratedDraftPlan` backfill parameter

```typescript
annotateAIGeneratedDraftPlan(plan, backfillSentinels = false)
```

When `backfillSentinels: true`, each invalid step also gets `_requiredParams: string[]` listing the missing required fields. The plan-compiler passes `true` for regex-fallback plans only.

---

## 16. `server.json` is GENERATED — never hand-edit it

Source: `scripts/generate-metadata.ts`. Edit the generator, then run `npm run generate:metadata`. Direct edits are overwritten on the next `schema:commit` or `generate:metadata` call.

---

## 17. `RBAC_STRICT` mode

When `RBAC_STRICT=true`, RBAC check errors (e.g. Redis unavailable) deny the request instead of defaulting to allow. Default is `false` (allow on error). Set `true` in production deployments where RBAC is the primary auth layer.

---

## 19. C1: Cache invalidation graph 32 vs 27 session entries — FALSE POSITIVE

An audit in Session 113 claimed `cache-invalidation-graph.ts` had only 32 entries for sheets_session but the schema had 29+ actions. This was caused by a regex that missed actions using `.literal(...)` without the `action:` prefix. All 32 cache graph entries DO correspond to real schema actions. The auto-generator at `src/services/cache-invalidation-graph.ts:640-680` fills in missing rules for all TOOL_ACTIONS at runtime anyway.

**Do NOT re-investigate or add extra cache entries for sheets_session.**

## 20. C2: Flat tool interceptor `_requestHandlers` private field — KNOWN + GUARDED

`src/mcp/registration/flat-tool-call-interceptor.ts` accesses the MCP SDK's private `_requestHandlers` Map. This is intentional — no public SDK API exists for wrapping the tools/call handler. The code throws at startup (not silently) if the field is missing or not a Map, so SDK version breakage is caught immediately. The `instanceof Map` guard was added in Session 116 to make this explicit.

**Do NOT try to "fix" this by avoiding the private field — there is no alternative. The throw-on-startup behavior is the correct safeguard.**

## 21. Flat tool pagination bug — only first 100 of 409 tools visible to LLM clients

**Root cause:** `FLAT_TOOLS_PAGE_SIZE` was 100 in `src/mcp/registration/tools-list-compat.ts`. MCP clients (Claude Desktop, Claude Code) only fetch the first `tools/list` page and ignore `nextCursor`. With 100 tools per page and TOOL_ACTIONS ordered alphabetically, only `sheets_advanced + sheets_agent + sheets_analyze + sheets_appsscript + sheets_auth + sheets_bigquery` (31+8+26+15+5+14=99 tools + `sheets_discover` = 100 total) were visible. All `sheets_core`, `sheets_data`, `sheets_session`, `sheets_format`, `sheets_collaborate`, etc. tools were silently missing.

**Fix:** Raised to 1000 in Session 116+. Flat tool entries with `x-defer-loading: true` have minimal schemas, so a 409-tool single-page response stays compact.

**Companion bug:** `getEffectiveToolMode()` in `src/config/constants.ts` had `return isHttp ? 'bundled' : 'bundled'` — both branches returned 'bundled'. This meant local dev without `SERVAL_TOOL_MODE` env set always ran bundled mode. Fixed to `return isHttp ? 'bundled' : 'flat'`.

**Do NOT reduce `FLAT_TOOLS_PAGE_SIZE` below the total flat tool count.** The pagination code correctly handles cursors, but real MCP clients don't follow nextCursor for tools/list.

**Deferred tools MUST use minimal schemas in tools/list.** Tools with `deferLoading: true` emit `{ type: 'object' }` as their inputSchema. Full schemas for all 394 deferred tools would be ~1.2MB — 4× over the 300KB STDIO wire budget (`mcp-wire-output-contract.test.ts:83`). The actual schema is resolved at call time by the compound handler. Never add full schema derivation for deferred tools in `buildFlatToolListEntries`.

---

## 22. Flat interceptor throws in tests using lightweight McpServer mocks

Any test that calls `registerServalSheetsTools()` (or anything that triggers `registerFlatToolCallInterceptor`) with a mock McpServer that lacks `server._requestHandlers` as a real `Map` instance will throw:

```
Error: [FlatToolInterceptor] Cannot register flat tools/call routing:
MCP SDK _requestHandlers map is not accessible.
```

**Root cause:** `getEffectiveToolMode()` now defaults to `'flat'` for non-HTTP processes (Session 116 fix). The interceptor runs and checks `instanceof Map`, which fails on minimal mocks.

**Fix pattern** — add `MCP_TRANSPORT=http` to force bundled mode in tests that don't need flat routing:

```typescript
beforeEach(() => { vi.stubEnv('MCP_TRANSPORT', 'http'); });
afterEach(() => { vi.unstubAllEnvs(); });
```

**Affected files** (already fixed): `tests/mcp/tool-call-failover.test.ts`, `tests/mcp/tool-call-keepalive.test.ts`, `tests/mcp/tool-action-log-sheet.test.ts`, `tests/integration/tool-mode-registration.test.ts`, `tests/integration/tools-list-schemas.test.ts`.

**Alternative fix**: Add `server.server._requestHandlers = new Map()` to the mock — but the `MCP_TRANSPORT=http` approach is simpler and more representative of these tests' intent (they test the compound/bundled path, not the flat adapter).

---

## 23. `executePlan` dryRun changed from no-op shim to real handler delegation

**Old behavior (pre-Session 116):** `dryRun: true` returned `{ dryRunPreview: true }` on each step, never calling the handler.

**New behavior:** `dryRun: true` calls `executeHandler(step.tool, step.action, { ...params, safety: { dryRun: true } })`. Each handler's own `safety.dryRun` path is responsible for returning a preview (what-if) response.

**Why:** The old shim hid unexecutable plans (wrong params, missing required fields). The new approach catches those early with real errors during the preview phase.

**Tests to update:** Any test asserting `expect(handler).not.toHaveBeenCalled()` or `expect(r.result.dryRunPreview).toBe(true)` in the context of dryRun execution. Change to: handler IS called with `safety: { dryRun: true }` in params, and `r.success` is true if the handler mock succeeds.

**Source:** `src/services/agent/plan-executor.ts:880-916`

---

## 18. SQL injection guard in `sql_join`

`sheets_compute.sql_join` validates `alias`, `on`, and `select` fields against safe identifier patterns before interpolating into DuckDB SQL. DuckDB runs in-process and can read local files (`read_csv_auto` etc.) — injection is a sandbox escape. Do NOT remove or weaken the validation in `src/handlers/compute-actions/advanced-query.ts`.
