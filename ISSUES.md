# ServalSheets — Master Issue Registry

> Consolidated from 8 source documents: Audit_Report, Fix_Report, MCP_Test_Results,
> Handler_Analysis, Complete_Audit_Roadmap, Competitive_Analysis, Implementation_Guide,
> Strategic_Roadmap. Use this file to drive agent-by-agent codebase remediation.
>
> **How to use**: Assign one agent per issue. Agent must: (1) read the file:line reference,
> (2) reproduce the bug (failing test or script), (3) apply minimal fix, (4) run verification gate.
> Mark issues `[DONE]` when resolved. Never skip the negative constraints below.

## STATUS NORMALIZATION SNAPSHOT — 2026-02-27 (Session 44 Update)

This snapshot aligns issue status tags with the current validated code state. Updated after
full audit sweep + bulk_update MUTATION_ACTIONS wiring fix + Prettier formatting fixes.
Test baseline: **2376/2376 pass** (`npm run test:fast`). TypeScript: **0 errors**.
Gates: typecheck ✅, check:drift ✅, validate:alignment ✅ (22/22 tools), integration-wiring ✅, format:check ✅.

- Total issues: `240`
- Legacy fixed markers: `58` (`[FIXED-PRE]`)
- Verified done markers: `109` (`[DONE]`) + `71` (`[FALSE ALARM]`)
- Remaining open/maintainer-only: `2` (ISSUE-073: git cleanup, ISSUE-075: npm publish)

Normalization policy:
- `[DONE]`: verified in current code and/or tests in this audit wave.
- `[FIXED-PRE]`: historical fix marker retained, but not fully re-verified in this pass.
- No marker: still open/pending verification.

Newly verified in first pass (wave 1):
- `ISSUE-070` — `npm run typecheck` reports 0 TypeScript errors. All 3 previously-failing files (suggestion-engine.ts, excel-online-backend.ts, notion-backend.ts) now clean.
- `ISSUE-139` — queue hard cap is enforced in transaction handler (`MAX_TRANSACTION_OPS`, `OPERATION_LIMIT_EXCEEDED`).
- `ISSUE-188` — bigquery row safety limit is centralized via `MAX_BIGQUERY_RESULT_ROWS` env-backed constant.
- `ISSUE-189` — confirm response schema now defaults `message` to an empty string, closing the contract gap.
- `ISSUE-190` — transaction schema declares `_meta` optional; tests cover `_meta` present and absent response paths.
- `ISSUE-191` — webhook handler success responses are consistently nested under `data`; targeted webhook tests pass.
- `ISSUE-192` — BaseHandler tracing now sets `spreadsheetId` + `action` + `range`, records exceptions, and is wired into shared API helper paths.
- `ISSUE-193` — tool response error-path redaction strips stack and path-like values before MCP serialization.
- `ISSUE-194` — startup warning exists for public host with RBAC disabled.
- `ISSUE-195` — `MutationSummarySchema` no longer defines a duplicate `snapshot` object; snapshot metadata is centralized in `ResponseMetaSchema`.
- `ISSUE-204` — `appsscript.create` now defaults `runtimeVersion` to `V8`, with explicit schema docs for runtime choices.
- `ISSUE-196` — `duplicate_filter_view` is now exposed and wired across schema, handler, metadata, and handler tests.
- `ISSUE-202` — `sheets_core` now resolves Drive shortcut IDs to target spreadsheet IDs before API operations.

Newly verified in second pass (wave 2, confirmed against live code):
- `ISSUE-022` — `DataFilterSchema` at `src/schemas/shared.ts:613-620` has `superRefine` that rejects `startRowIndex >= endRowIndex` with a clear error.
- `ISSUE-064` — `src/mcp/sampling.ts` uses `AGENTIC_TOOLS` array + `toolChoice: 'auto'` for tool-augmented sampling (MCP 2025-11-25).
- `ISSUE-153` — `transaction.commit` calls `sendProgress()` at 0% start and 100% completion (confirmed in handler).
- `ISSUE-155` — All Drive API calls in `collaborate.ts` for share/comment/version operations have `fields` masks. Confirmed by Google API expert agent.
- `ISSUE-156` — `metadataCache.getOrFetch()` in `src/services/cached-sheets-api.ts` deduplicates redundant metadata fetches within the same request lifecycle.
- `ISSUE-160` — Proactive token refresh fires at 80% of token lifetime (~12+ min before expiry). Confirmed at `src/auth/encrypted-file-token-store.ts`.
- `ISSUE-177` — `data.ts:1587-1598` uses dual check: `error.message.includes('timed out')` AND `error.code === 'DEADLINE_EXCEEDED'`. Both locale-dependent and code-based checks present.
- `ISSUE-185` — `convertRangeInput()` return is guarded by `resolveAnalyzeRange()` null-safety wrapper at `analyze.ts`. No unguarded undefined propagation.
- `ISSUE-186` — `folderMoveError` field is returned in the `templates.ts` response when a folder move fails (`templates.ts:507`).
- `ISSUE-211` — **RE-CONFIRMED FIXED**. Full test suite: `2367/2367 pass`. `tests/handlers/format.test.ts:154` passes. Previous REGRESSION report was based on a stale gate run.
- `ISSUE-216` — `analyzerCache` at `dependencies.ts:33` is `AnalyzerLRUCache` with proper generics (typed Map), 25-entry cap, 30-min TTL.
- `ISSUE-217` — Both `batchGet` calls in `modelScenario` (dependencies.ts:416-427) are wrapped in `executeWithRetry()`.

**Newly verified in wave1-security-codex worktree (2026-02-25):**
- `ISSUE-072` — per-action OAuth scope check wired in `server.ts`.
- `ISSUE-074` — `.serval/state.md` regenerated with correct action count (346).
- `ISSUE-088` — all `createMessage()` calls wrapped with `withSamplingTimeout`.
- `ISSUE-090` — GDPR delete/export/consent APIs added: `user-profile-manager.ts`, `session.ts`, `server.ts`.
- `ISSUE-102` — user profile encryption documented with `PROFILE_ENCRYPTION_KEY` env var guidance.
- `ISSUE-103` — consent tracking fields (`consentGrantedAt`, `consentVersion`, `dataProcessingScope`) added to `UserProfile`.
- `ISSUE-117` — `assertSamplingConsent()` consent gate enforced per-user before all Sampling calls.
- `ISSUE-159` — `RBAC_SETUP.md` added; startup warning wired in `package.json`.
- `ISSUE-165` — GDPR Art. 15 right-of-access response added to session.ts `get_profile`.
- `ISSUE-166` — `audit-middleware.ts` now classifies log entries with `dataSensitivity: 'PII' | 'METADATA' | 'NONE'`.
- `ISSUE-215` — webhook endpoint URL tokens redacted via `src/middleware/redaction.ts` patterns in `webhooks.ts`.

**New issues added in second 12-agent audit pass (ISSUE-232 through ISSUE-239):**
- `ISSUE-232` — [DONE] CRITICAL: `assertSamplingConsent()` is a NO-OP — `_consentChecker` never assigned at runtime (fixed Session 41)
- `ISSUE-233` — [DONE] HIGH: `ParallelExecutor` instance in `perf-init.ts` not wired into `SheetsDataHandler`
- `ISSUE-234` — [DONE] MEDIUM: P14 composite actions missing `ACTION_ANNOTATIONS` entries in `annotations.ts`
- `ISSUE-235` — [DONE] LOW: `metrics.ts` missing P4-P14 feature instrumentation counters
- `ISSUE-236` — [DONE] LOW: `prompt-registration.ts` has no P4-P14 guided workflow prompts
- `ISSUE-237` — [DONE] LOW: `fix-cleaning.test.ts` — bare format handled by `unwrapRequest()` fallback; tautological assertion + `Math.random()` non-determinism fixed
- `ISSUE-238` — [DONE] LOW: `history-timetravel.test.ts` does not exist — no handler tests for `timeline`/`diff_revisions`/`restore_cells`
- `ISSUE-239` — [FALSE ALARM] LOW: `tests/helpers/wait-for.ts` has 17 callers across test suite — was incorrectly flagged as dead code

**Session 42 false alarms (verified by code inspection):**
- `ISSUE-088` — all `createMessage()` calls already wrapped in `withSamplingTimeout()`; issue pre-dates the wrapper addition.
- `ISSUE-091` — handlers use `ServiceError('OPERATION_CANCELLED')`, not `new Error('...')`; `OperationCancelledError` does not exist in core/errors.ts.
- `ISSUE-092` — `format.ts:867` already uses `Promise.allSettled()`; the issue describes the pre-fix state.
- `ISSUE-100` — `history.clear` already calls `confirmDestructiveAction()`. Snapshot not needed (clears operation log, not spreadsheet data).
- `ISSUE-096` — `collaborate.ts` and `core.ts` already have `supportsAllDrives: true, includeItemsFromAllDrives: true` on all Drive API calls.
- `ISSUE-097` — `session-context.ts` already has `SESSION_TTL_MS` constant + TTL eviction at line 1183-1189.
- `ISSUE-118` — `sheets_core.list` Drive call (core.ts:1186-1188) already includes `supportsAllDrives` + `includeItemsFromAllDrives`.

**Issues previously marked REGRESSION — resolved:**
- `ISSUE-211` — was reverted to OPEN in first pass (false alarm from stale gate output); confirmed DONE in second pass.

**New issues added in first 12-agent audit pass (ISSUE-223 through ISSUE-231):**
- `ISSUE-223` — [DONE] CRITICAL: Real OAuth client secret hardcoded in `embedded-oauth.ts` (credential leak)
- `ISSUE-224` — [DONE] HIGH: `AUTH_EXEMPT_ACTIONS` reads pre-normalization args; auth exemption silently fails for standard envelope format
- `ISSUE-225` — [DONE] HIGH: HTTP transport `HandlerContext` omits `taskStore`; Task IDs never emitted via HTTP
- `ISSUE-226` — [DONE] HIGH: GDPR consent gate bypassed for direct `server.createMessage()` calls in handlers
- `ISSUE-227` — [DONE] MEDIUM: `CHECKPOINTS_DISABLED`/`CHECKPOINT_NOT_FOUND` error codes used in session.ts but absent from `ErrorCodeSchema`
- `ISSUE-228` — [FALSE ALARM] MEDIUM: `sampling-context-cache.ts` is dead code — actually imported by `src/mcp/sampling.ts` (lines 27, 279, 436) and `tool-handlers.ts` (line 37)
- `ISSUE-229` — [DONE] MEDIUM: ETag 304 conditional-request optimization likely inoperative (`googleapis` doesn't reliably throw `{ code: 304 }`)
- `ISSUE-230` — [DONE] BLOCKER: `src/schemas/annotations.ts` in `MM` git state (both staged + unstaged) from interrupted `schema:commit`
- `ISSUE-231` — [DONE] HIGH: Audit middleware `MUTATION_ACTIONS` set uses stale action names (`write_range` vs `write`); structured mutation audit events never fire

---

## NEGATIVE CONSTRAINTS (Read before touching any issue)

These rules derived from 38 development sessions. Violations caused CI failures or data loss.

| # | Constraint | Reason |
|---|-----------|--------|
| NC-01 | NEVER modify `src/schemas/*.ts` without immediately running `npm run schema:commit` | #1 CI failure cause — drifts 5 generated files |
| NC-02 | NEVER hardcode TOOL_COUNT or ACTION_COUNT — always read `src/schemas/action-counts.ts` | 42+ files CI-tracks these values |
| NC-03 | NEVER edit generated files directly: `action-counts.ts`, `annotations.ts`, `completions.ts`, `server.json` | These are outputs of `schema:commit` |
| NC-04 | NEVER use `~`, `approximately`, or `around` for line counts — always run `wc -l` | False line count claims waste debugging time |
| NC-05 | NEVER return MCP format from handlers: `{ content: [{ type: 'text', text }] }` | Use `buildToolResponse()` — handlers return `{ response: { success, data } }` |
| NC-06 | NEVER silent fallback: `return {}` without logging — throw a typed `ErrorCode` error | Silent fallbacks mask failures and block debugging |
| NC-07 | NEVER use `new Error('message')` — use typed errors: `SheetNotFoundError`, etc. with structured context | Typed errors enable proper client-side error handling |
| NC-08 | NEVER skip safety rail order for destructive ops: `createSnapshotIfNeeded` → `confirmDestructiveAction` → execute | Snapshot MUST be created BEFORE asking for confirmation — it captures pre-op state that must exist before user approves |
| NC-09 | NEVER write tests using flat format `{ action: 'read', ... }` — use envelope: `{ request: { action: 'read', ... } }` | `normalizeToolArgs()` at `tool-handlers.ts:85-124` expects envelope |
| NC-10 | NEVER run the full test suite in the main agent context — delegate to a subagent | Full suite output is 5K+ tokens, wastes context window |
| NC-11 | NEVER claim a fix works without first writing a failing test | Reproduce → fix → verify is the only valid sequence |
| NC-12 | NEVER use full column refs like `Sheet1!A:Z` | Triggers full grid fetch; always use bounded ranges like `A1:Z100` |
| NC-13 | NEVER call Google Sheets API without `fields` parameter | Bare `spreadsheets.get()` returns entire spreadsheet |
| NC-14 | NEVER retry `403 insufficientPermissions` | Only `403 userRateLimitExceeded` is retryable — infinite retry loop otherwise |
| NC-15 | NEVER put more than 100 operations in a single `batchUpdate` | Google API hard limit |
| NC-16 | NEVER call Google API directly — always wrap in `executeWithRetry()` | Bypass means no retry, no circuit breaker, no deadline tracking |
| NC-17 | NEVER run `npm run verify` in low-memory environments — use `npm run verify:safe` | ESLint needs ~3GB heap; OOM kills the process |
| NC-18 | NEVER batch git commits — one commit per logical unit (schema change, handler, tests) | Atomic commits enable clean rollback |
| NC-19 | NEVER load all 22 handlers into context at session start | Load only the module being worked on |
| NC-20 | sheetId=0 is VALID — the first sheet always has ID 0 in Google Sheets | `!sheetId` falsy check incorrectly rejects it — use `=== undefined` |

---

## SECTION 1 — CRITICAL ISSUES (P0) — Blocks workflows

### ISSUE-001: [FIXED-PRE] Auth token drops mid-session
**Severity**: CRITICAL | **Source**: Fix_Report #1, MCP_Test_Results #1
**Files**: `src/utils/retry.ts:209-217`, `src/services/token-manager.ts:156-185`, `src/services/google-api.ts:172-176`, `src/handlers/auth.ts:521-569`

**Root cause (3 interconnected bugs)**:
1. `retry.ts:209-217` — Only retries 401 if message contains exact strings `'token expired'` or `'invalid_grant'`. Google returns generic 401s for scope/rate-limit issues that don't match → token marked invalid without refresh attempt
2. `token-manager.ts:156-185` — Polls every 5 minutes instead of reacting to 401 events → 5-min blind window after token failure
3. `google-api.ts:172-176` — Caches token validation for 5 minutes, masking invalidity after scope errors

**Fix**:
```typescript
// retry.ts:209-217 — expand 401 pattern:
return message.includes('token expired') || message.includes('invalid_grant')
  || message.includes('unauthorized') || message.includes('insufficient')
  || message.includes('scope');

// token-manager.ts — add event-driven refresh:
async refreshTokenImmediately(): Promise<void> {
  await this.tokenManager.refreshToken();
  this.lastValidationResult = undefined;
}

// auth.ts:530 — reduce check interval:
checkIntervalMs: 60000  // 1 min, not 5 min
```

**Verification**: `npm run test -- --grep '401.*refresh'` + simulate 3 sequential re-auth cycles

---

### ISSUE-002: [FIXED-PRE] sheetId=0 rejected as falsy (global bug)
**Severity**: CRITICAL | **Source**: Fix_Report #2, MCP_Test_Results #5
**Files**: `src/schemas/format.ts:272`, `src/handlers/bigquery.ts:1424`

**Root cause**: `!sheetId` evaluates to `true` when `sheetId === 0`. JavaScript falsy check incorrectly rejects the first sheet (which always has sheetId=0 per Google Sheets API).

**Fix**:
```typescript
// format.ts:272 — replace .refine():
.refine((data) => data.range || data.sheetId !== undefined, {
  message: 'Either range or sheetId must be provided'
})
// bigquery.ts:1424:
if (targetSheetId === undefined && req.sheetId === undefined) {
```

**Global scan required**: `grep -rn '!sheetId\|!req.sheetId\|!input.sheetId' src/` — fix all matches.

**Verification**: Test `auto_fit` with `sheetId=0`, `bigquery.query` with `sheetId=0`

---

### ISSUE-003: [FIXED-PRE] LLM API errors leak billing info + internal details to users
**Severity**: HIGH→CRITICAL (security) | **Source**: Fix_Report #3, MCP_Test_Results #6/#7
**Files**: `src/services/llm-fallback.ts:140-150,181-182,225-226`, `src/handlers/visualize.ts:410-418`, `src/handlers/analyze.ts:1595-1885`

**Root cause**: `llm-fallback.ts` throws raw HTTP response body as Error message. This includes billing details, request IDs, and API keys in error responses. All LLM-powered actions propagate this to end users without sanitization.

**Fix**:
```typescript
// llm-fallback.ts:140-150 (Anthropic) + 181-182 (OpenAI) + 225-226 (Google):
if (!response.ok) {
  const errorBody = await response.text();
  logger.error('LLM API error', { provider: 'anthropic', status: response.status, body: errorBody });
  throw new Error('AI suggestion service temporarily unavailable. Please try again later.');
}
// visualize.ts + analyze.ts catch blocks: log original, return sanitized message
```

**Verification**: Trigger billing error, confirm no API details in response; `grep -rn 'error.message' src/handlers/ | check for unsanitized propagation`

---

### ISSUE-004: [FIXED-PRE] requireBigQuery() throws raw Error instead of typed error
**Severity**: CRITICAL (handler crash) | **Source**: Handler_Analysis BQ12.1
**File**: `src/handlers/bigquery.ts:253`

**Root cause**: `requireBigQuery()` throws a raw error object directly instead of using `this.error()`. This bypasses the error mapping pipeline and can crash the handler with an unstructured response.

**Fix**: Change to `throw new ServiceUnavailableError('BigQuery client not initialized', { handler: 'bigquery' })` or use `return this.error({ code: 'SERVICE_UNAVAILABLE', message: '...' })`.

---

## SECTION 2 — HIGH ISSUES (P1) — Significantly degrades functionality

### ISSUE-005: [FIXED-PRE] sheets_core.copy times out at 30s for large spreadsheets
**Severity**: HIGH | **Source**: Fix_Report #4, MCP_Test_Results #2
**Files**: `src/utils/retry.ts:25`, `src/handlers/core.ts:633-690`

Drive `files.copy` scales with file size (30-120s+ for >10K rows). Global `DEFAULT_TIMEOUT_MS=30000` applies. No per-operation timeout override despite comment at `core.ts:633` referencing `BUG-007`.

**Fix**: `const copyTimeout = parseInt(process.env['SHEETS_CORE_COPY_TIMEOUT_MS'] ?? '120000', 10);` and pass to `driveApi.files.copy()`.

---

### ISSUE-006: [FIXED-PRE] sheets_data.clear has hardcoded 30s timeout ignoring env var
**Severity**: HIGH | **Source**: Fix_Report #5, MCP_Test_Results #9
**File**: `src/handlers/data.ts:1519-1521`

Hardcoded `Promise.race()` with `setTimeout(30000)` ignores `GOOGLE_API_TIMEOUT_MS` env var entirely.

**Fix**: Remove hardcoded `Promise.race` timeout. Use retry mechanism's configurable timeout. Add `SHEETS_DATA_CLEAR_TIMEOUT_MS` env var.

---

### ISSUE-007: [FIXED-PRE] sheets_composite.import_csv COMPOSITE_TIMEOUT_MS not implemented
**Severity**: HIGH | **Source**: Fix_Report #6, MCP_Test_Results #15
**File**: `src/handlers/composite.ts:211-257`

Comment at `composite.ts:214-217` claims `COMPOSITE_TIMEOUT_MS` controls the timeout, but it's not actually implemented. Default 30s from global retry applies. Times out on small CSVs under slow conditions.

**Fix**: Actually implement `COMPOSITE_TIMEOUT_MS`: `const compositeTimeout = parseInt(process.env['COMPOSITE_TIMEOUT_MS'] ?? '120000', 10)` and pass to `compositeService.importCsv()`.

---

### ISSUE-008: [FIXED-PRE] sheets_collaborate — all 35 actions blocked by default OAuth scope
**Severity**: HIGH | **Source**: Fix_Report #7, MCP_Test_Results #4
**Files**: `src/config/oauth-scopes.ts:22-29`, `src/security/incremental-scope.ts:79-1199`

`STANDARD_SCOPES` only includes `drive.file`. All 35 collaborate actions need `drive` or `drive.readonly`. Incremental scope system exists and works correctly but needs smoother UX. Entire tool is non-functional with default permissions.

**Fix (3 parts)**:
1. Add `RECOMMENDED_SCOPES` tier including `drive.readonly`
2. Add `availableFeatures`/`missingScopes` to `auth.status` response
3. Auto-prompt scope upgrade on first use of blocked feature

---

### ISSUE-009: [FIXED-PRE] update_sheet rename silently ignores `newTitle` param
**Severity**: HIGH | **Source**: Fix_Report #8, MCP_Test_Results #8/#27
**Files**: `src/schemas/core.ts:243-256`, `src/handlers/core.ts:1279`

Schema uses `title` not `newTitle`. Passing `newTitle` silently ignored (Zod strips unknown keys by default). Rename may not apply at all. Confirmed via `batch_get` after the call.

**Fix**: Either add `newTitle` as alias in schema (`const title = input.title ?? input.newTitle`), or add Zod `.strict()` to explicitly reject unknown keys with an error message.

---

### ISSUE-010: [FIXED-PRE] history.undo/redo — missing snapshot validation before restore
**Severity**: HIGH (data loss risk) | **Source**: Handler_Analysis SAF-01, HST18.1
**File**: `src/handlers/history.ts:180-289`

Restores data from snapshot without verifying the snapshot exists or is uncorrupted. If snapshot is missing, restoration fails silently or with a confusing error.

**Fix**: Before `confirmDestructiveAction()`, validate snapshot exists: `const snapshot = await snapshotService.get(snapshotId); if (!snapshot) throw new SnapshotNotFoundError(...)`.

---

### ISSUE-011: [FIXED-PRE] history.revert_to — no dry-run before reverting entire spreadsheet
**Severity**: HIGH (data loss risk) | **Source**: Handler_Analysis SAF-02, HST18.2
**File**: `src/handlers/history.ts:359-421`

All current changes irreversibly overwritten with no preview. User has no way to see what will be lost.

**Fix**: Add `dryRun?: boolean` param. When true, compute and return the diff (cells that would change) without executing. Require explicit `dryRun: false` for actual revert.

---

### ISSUE-012: [DONE] history.restore_cells — no confirmation for >10 cells
**Severity**: HIGH | **Source**: Handler_Analysis SAF-03, HST18.3
**File**: `src/handlers/history.ts:521-561`

Surgically restores cells from historic revision with no elicitation. No threshold check.

**Fix**: `if (cells.length > 10) { await this.confirmDestructiveAction({ description: `Restore ${cells.length} cells from ${revisionId}` }); }`

---

### ISSUE-013: [FIXED-PRE] collaborate.approval_cancel — removes protection without confirmation
**Severity**: HIGH | **Source**: Handler_Analysis SAF-04, COL7.4
**File**: `src/handlers/collaborate.ts:1741-1798`

Cancelling an approval process deletes the underlying protection range — unrecoverable — without any elicitation. Safety rail order entirely absent.

**Fix**: Add `await this.confirmDestructiveAction({ description: 'Cancel approval and remove sheet protection' })` + `createSnapshotIfNeeded()`.

---

### ISSUE-014: [FIXED-PRE] data.batch_clear — skips confirmation, only records metrics
**Severity**: HIGH | **Source**: Handler_Analysis SAF-05, D2.3
**File**: `src/handlers/data.ts:2344-2352`

`batch_clear` only calls `recordConfirmationSkip()` for metrics tracking but never calls `confirmDestructiveAction()`. Can silently clear hundreds of cells.

**Fix**: Always call `confirmDestructiveAction()` first, then `createSnapshotIfNeeded()`, then execute.

---

### ISSUE-015: [FIXED-PRE] dependencies.modelScenario — 3 sequential batchGet calls
**Severity**: HIGH | **Source**: Handler_Analysis API-01, DEP16.1
**File**: `src/handlers/dependencies.ts:416-455`

Fetches values, formulas, and input values in 3 separate `batchGet` calls. Can be merged into a single call with combined ranges.

**Fix**: Merge into single `batchGet` with `ranges` array containing all needed refs.

---

### ISSUE-016: [FIXED-PRE] dependencies.compareScenarios — N×2 API calls
**Severity**: HIGH | **Source**: Handler_Analysis API-02, DEP16.2
**File**: `src/handlers/dependencies.ts:530-540`

Each scenario fetches data separately. N scenarios = N×2 API calls. Single pre-fetch of all affected ranges should be reused across all scenarios.

---

### ISSUE-017: [DONE] visualize.handleChartUpdate — unnecessary double fetch
**Severity**: HIGH | **Source**: Handler_Analysis API-03, V6.1
**File**: `src/handlers/visualize.ts:424-495`

Reads chart spec before calling `batchUpdate`. Let batchUpdate fail naturally if chart doesn't exist rather than pre-fetching.

---

### ISSUE-018: [DONE] data.copy_paste — double API call
**Severity**: HIGH | **Source**: Handler_Analysis API-04, D2.2
**File**: `src/handlers/data.ts:1423-1450`

Makes two API calls where one suffices. Fix: single API flow — values.get then batchUpdate in sequence.

---

### ISSUE-019: [FIXED-PRE] advanced.list_chips — includeGridData:true O(n×m) cost
**Severity**: HIGH | **Source**: Handler_Analysis API-05, A5.3
**File**: `src/handlers/advanced.ts:1531`

Fetches entire grid with `includeGridData:true` to find chips. O(n×m) cost scales with cell count.

**Fix**: Use targeted range fetch or document as expensive operation with warning.

---

### ISSUE-020: [FIXED-PRE] server.ts handler map race condition
**Severity**: HIGH | **Source**: Handler_Analysis CON-01
**File**: `src/server.ts:790`

`??=` operator is not atomic under concurrent requests. Handler instantiation can race.

**Fix**: Create handler map in `initialize()` before accepting requests, not lazily on first request.

---

### ISSUE-021: [DONE] A1 notation sheet name escaping not validated
**Severity**: HIGH | **Source**: Handler_Analysis SCH-01
**File**: `src/schemas/shared.ts:146-154`

Single quotes in sheet names cause A1 resolution failures. Not validated by schema.

**Fix**: Add escaping validation regex: sheet names containing single quotes must be escaped as `''` in A1 notation.

---

### ISSUE-022: [DONE] DataFilter bounds unchecked
**Severity**: HIGH | **Source**: Handler_Analysis SCH-02
**File**: `src/schemas/data.ts:147-162`

`startRowIndex >= endRowIndex` (inverted bounds) is accepted without error.

**Fix**: Add `.refine()` cross-field validation: `startRowIndex < endRowIndex`.

---

### ISSUE-023: [DONE] ExecutableAction missing required spreadsheetId
**Severity**: HIGH | **Source**: Handler_Analysis SCH-03
**File**: `src/schemas/shared.ts:1210-1327`

`ExecutableAction` (used in suggestion results) doesn't include `spreadsheetId` in action params. Suggestions returned by `suggest_next_actions` are unusable without it.

**Fix**: Make `spreadsheetId` required in `ExecutableAction.params` schema.

---

### ISSUE-024: [FIXED-PRE] Unchecked JSON.parse on sampling responses (crash risk)
**Severity**: HIGH | **Source**: Handler_Analysis TS-03
**Files**: `src/handlers/visualize.ts:1180`, `src/handlers/data.ts:1773`

`JSON.parse()` called directly on sampling API responses without try-catch. Malformed response crashes the handler.

**Fix**: Wrap in try-catch, return `PARSE_ERROR` with the raw response logged for debugging.

---

### ISSUE-025: [FIXED-PRE] sendProgress() calls not streamed to clients (infrastructure gap)
**Severity**: HIGH (UX) | **Source**: Handler_Analysis 13.3, CODEBASE_CONTEXT.md
**File**: `src/server.ts:294-299`

9 handlers call `sendProgress()` but these are only logged — NOT sent as MCP progress notifications. Single infrastructure fix would immediately benefit all 9 tools.

**Fix**: Wire `sendProgress()` to emit `notifications/progress` MCP messages via the transport layer.

---

## SECTION 3 — MEDIUM ISSUES (P2) — Schema/docs mismatches, bugs with workarounds

### ISSUE-026: [FIXED-PRE] batch_format — type discriminator undocumented
**Severity**: MEDIUM | **Source**: Fix_Report #9, MCP_Test_Results #11
**Files**: `src/schemas/format.ts:583-647`, `src/schemas/descriptions.ts:125-137`

Operations array requires `type` field (`background|text_format|number_format|...`) but description shows no example with the required type field. LLMs construct invalid requests.

**Fix**: Add example in descriptions.ts: `{"type":"background","range":"Sheet1!A1:D1","color":{"red":0.4}}`

---

### ISSUE-027: [FIXED-PRE] chart_create — complex required params not documented
**Severity**: MEDIUM | **Source**: Fix_Report #10, MCP_Test_Results #14
**Files**: `src/schemas/visualize.ts:265-285`, `src/schemas/descriptions.ts:261`

Schema requires `data.sourceRange` + `position.anchorCell` objects. Simple `{chartType, range}` shorthand doesn't work. Description oversimplifies.

**Fix**: Expand description example: `{"action":"chart_create","sheetId":0,"chartType":"BAR","data":{"sourceRange":"Sheet1!A1:B10"},"position":{"anchorCell":"Sheet1!G1"}}`

---

### ISSUE-028: [DONE] copy_paste — destination single-cell requirement undocumented
**Severity**: MEDIUM | **Source**: Fix_Report #11, MCP_Test_Results #10
**Files**: `src/schemas/data.ts:473-482`, `src/handlers/data.ts:2341`

Schema says "A1 notation" but handler uses `parseCellReference()` which rejects ranges. No error guidance to indicate single cell is required.

**Fix**: Update field description: `'Destination SINGLE CELL (e.g., "Sheet1!A1"), not a range. Top-left corner of paste area.'`

---

### ISSUE-029: [DONE] analyze_impact — operation object format unclear
**Severity**: MEDIUM | **Source**: Fix_Report #12, MCP_Test_Results #18
**Files**: `src/schemas/quality.ts:105-153`, `src/schemas/descriptions.ts:456`

Schema requires `operation` object but description shows wrong example format.

**Fix**: Update description with two working examples: tool+action form and description-only form.

---

### ISSUE-030: [FIXED-PRE] sheets_fix.fix — issues array pipeline undocumented
**Severity**: MEDIUM | **Source**: Fix_Report #13, MCP_Test_Results #19
**Files**: `src/schemas/fix.ts:28-46,152-166`, `src/schemas/descriptions.ts:563-586`

Requires `IssueToFixSchema` array from `sheets_analyze` output. Description says "requires sheets_analyze first" but doesn't show the exact shape.

**Fix**: Add working example in descriptions.ts showing the exact `IssueToFixSchema` format from `sheets_analyze` output.

---

### ISSUE-031: [FIXED-PRE] Session state lost after re-authentication
**Severity**: MEDIUM | **Source**: Fix_Report #14, MCP_Test_Results #21
**Files**: `src/services/session-context.ts:1054-1071,614-680`, `src/handlers/auth.ts:521-569`

`SessionContext` is a singleton tied to process lifetime, not user/auth session. `exportState()`/`importState()` exist but aren't called during auth lifecycle events.

**Fix**: Add auth event hooks — before token refresh: `sessionContext.exportState()` → save; after re-auth: `sessionContext.importState()` → restore.

---

### ISSUE-032: [FIXED-PRE] update_preferences silently accepts invalid confirmationLevel
**Severity**: MEDIUM | **Source**: Fix_Report #15, MCP_Test_Results #20
**Files**: `src/handlers/session.ts:254`, `src/services/session-context.ts:519-525`

Handler uses `as never` type assertion bypassing validation. No enum check on `confirmationLevel`. Setting `'always'` appears to silently fail.

**Fix**: Add explicit enum validation in `updatePreferences()`: `const VALID_LEVELS = ['always','destructive','never']; if (!VALID_LEVELS.includes(updates.confirmationLevel)) throw ...`

---

### ISSUE-033: [DONE] deduplicate returns SPREADSHEET_NOT_FOUND for valid sheet
**Severity**: MEDIUM | **Source**: Fix_Report #16, MCP_Test_Results #16
**Files**: `src/core/batch-compiler.ts`, `src/handlers/composite.ts:374-507`, `src/services/sheet-resolver.ts:349-379`

`batch-compiler.ts` maps ANY 404 to `SPREADSHEET_NOT_FOUND`, even when the spreadsheet is valid but the sheet tab doesn't exist.

**Fix**: Improve 404 classification — check error message for `'sheet'` or `'tab'` keywords to distinguish `SHEET_NOT_FOUND` from `SPREADSHEET_NOT_FOUND`.

---

### ISSUE-034: [DONE] sort_range — columnIndex vs dimensionIndex naming mismatch
**Severity**: MEDIUM | **Source**: MCP_Test_Results #13
**File**: `src/schemas/dimensions.ts` (sortSpecs field)

`sortSpecs` uses `columnIndex` but Google Sheets API docs use `dimensionIndex`. May confuse users cross-referencing API docs.

**Fix**: Verify which field name the handler actually passes to the API. If `columnIndex` is correct, add a description note; if `dimensionIndex` is what the API expects, rename the field.

---

### ISSUE-035: [DONE] Systemic `as unknown as Type` casts in F3/F4 handlers — fix.ts has 0; analyze.ts has 3 inherent discriminated union narrowing limitations
**Severity**: MEDIUM | **Source**: Handler_Analysis TS-01
**Files**: `src/handlers/composite.ts:318,383,418,436`, `src/handlers/fix.ts:51,54,58,60`, `src/handlers/quality.ts`, `src/handlers/session.ts`, `src/handlers/confirm.ts`

~15 locations. Discriminated union narrowing fails across feature additions (F3 cleaning, F4 suggestions). The `req.action` doesn't narrow the union properly after the initial parse.

**Fix**: Align schema types so `req.action` narrows properly. Create explicit type aliases for each action input and use type predicates where needed.

---

### ISSUE-036: [FIXED-PRE] `as any` in advanced.ts named function API calls
**Severity**: MEDIUM | **Source**: Handler_Analysis TS-02, A5.1
**File**: `src/handlers/advanced.ts:1608-1784`

Multiple `as unknown` casts for named function API calls because `googleapis` types lack `namedFunction` fields.

**Fix**: Extend `ExtendedSpreadsheetProperties` interface to include the named function fields (already partially done per P6 fix — verify completeness).

---

### ISSUE-037: [FALSE ALARM] 5 duplicate response interface definitions in appsscript.ts
**Severity**: MEDIUM | **Source**: Handler_Analysis TS-04, AS13.1
**File**: `src/handlers/appsscript.ts:443-595`

~60 lines of identical interface definitions duplicated within the handler file.

**Fix**: Move response types to `src/schemas/appsscript.ts` and import from there.

---

### ISSUE-038: [FIXED-PRE] ETag conditional request uses raw process.env string
**Severity**: MEDIUM | **Source**: Handler_Analysis API-06, INF-API-03
**File**: `src/services/cached-sheets-api.ts:75`

ETag check uses `process.env['ENABLE_CONDITIONAL_REQUESTS']` directly instead of the typed `getEnv()` accessor. Can silently fail if env var changes type.

**Fix**: Use `getEnv('ENABLE_CONDITIONAL_REQUESTS')` from `src/config/env.ts`.

---

### ISSUE-039: [FALSE ALARM] ConditionTypeSchema — 38 types with no cross-field validation
**Severity**: MEDIUM | **Source**: Handler_Analysis SCH-04
**File**: `src/schemas/shared.ts:319-356`

38 condition types accepted with no validation that companion fields are present/valid. Nonsensical combinations pass schema validation.

**Fix**: Add `.refine()` or `superRefine()` checking that required companion fields are present for each condition type category.

---

### ISSUE-040: [FALSE ALARM] Pagination token format varies across tools
**Severity**: MEDIUM | **Source**: Handler_Analysis SCH-06
**Files**: `src/schemas/data.ts:101`, `src/schemas/core.ts:154`, `src/handlers/analyze.ts`

No standardized pagination token shape or TTL across tools. Some use cursor, some use page token, some use numeric offset.

**Fix**: Define `PaginationTokenSchema` in `shared.ts` and enforce consistent shape across all paginated responses.

---

### ISSUE-041: [FALSE ALARM] Response field naming drift — cellsAffected vs cellsChanged
**Severity**: MEDIUM | **Source**: Handler_Analysis SCH-07

Some handlers return `cellsAffected`, others return `cellsChanged` for the same conceptual field. Causes client-side parsing inconsistency.

**Fix**: Pick one (preferably `cellsAffected` to match schema), update all handlers, add automated alignment test.

---

### ISSUE-042: [DONE] AbortController map grows unbounded
**Severity**: MEDIUM | **Source**: Handler_Analysis MEM-01
**File**: `src/server.ts:526`

AbortController map grows without eviction. Long-running servers will leak memory.

**Fix**: Add TTL-based cleanup and LRU eviction at 10K entries.

---

### ISSUE-043: [FALSE ALARM] Progress notification failures silently swallowed
**Severity**: MEDIUM | **Source**: Handler_Analysis ERR-02
**File**: `src/handlers/base.ts:248-256`

When `sendProgress()` fails (e.g., client disconnected), the error is swallowed. Handler continues without knowing progress reporting is broken.

**Fix**: Return `Result<void, ProgressError>` type so callers can decide whether to abort or continue.

---

### ISSUE-044: [DONE] mapGoogleApiError uses fragile string matching
**Severity**: MEDIUM | **Source**: Handler_Analysis ERR-01
**File**: `src/handlers/base.ts:677-870`

`message.includes('429')` is locale-dependent and breaks for localized Google error messages.

**Fix**: Check `error.code` (numeric HTTP status) first, fall back to string matching only for non-standard errors.

---

### ISSUE-045: [DONE] collaborate.getCurrentUserEmail() used unchecked (may be undefined)
**Severity**: MEDIUM | **Source**: Handler_Analysis COL7.7
**File**: `src/handlers/collaborate.ts:1759`

Result used without null check. Throws uncaught if email unavailable.

**Fix**: `const email = getCurrentUserEmail(); if (!email) throw new AuthenticationRequiredError(...)`

---

### ISSUE-046: [FALSE ALARM] setup_sheet calls spreadsheets.get() twice
**Severity**: MEDIUM | **Source**: Handler_Analysis COMP8.3
**File**: `src/handlers/composite.ts:771-777`

Sheet ID fetched twice in setup_sheet. Cache from first call.

---

### ISSUE-047: [DONE] CleaningEngine loaded 5× via dynamic imports
**Severity**: MEDIUM | **Source**: Handler_Analysis FIX10.5
**File**: `src/handlers/fix.ts:179-408`

`import()` called once per action path. Should be loaded once in constructor or module initialization.

---

### ISSUE-048: [FIXED-PRE] analyzerCache in dependencies.ts never pruned
**Severity**: MEDIUM | **Source**: Handler_Analysis DEP16.3
**File**: `src/handlers/dependencies.ts:33`

Module-level cache grows without bound. Complex spreadsheets can produce large graph objects.

**Fix**: Add LRU eviction at 10 entries.

---

### ISSUE-049: [DONE] appsscript.run — `return {} as T` for empty responses
**Severity**: MEDIUM | **Source**: Handler_Analysis AS13.2
**File**: `src/handlers/appsscript.ts:430`

Returns empty object cast as handler type for delete/undeploy operations. Should return `{ success: true }` typed response.

---

### ISSUE-050: [DONE] templates.handleGet returns different shapes for builtin vs user
**Severity**: MEDIUM | **Source**: Handler_Analysis TPL11.1
**File**: `src/handlers/templates.ts:225-247`

Builtin and user templates return different response shapes, breaking client-side type assumptions.

**Fix**: Normalize both to `{ template: { ...normalizedFields } }` structure.

---

### ISSUE-051: [FALSE ALARM] collaborate.comment_list makes multiple serial API calls
**Severity**: MEDIUM | **Source**: Handler_Analysis COL7.2
**File**: `src/handlers/collaborate.ts:612-738`

Comment operations make multiple serial API calls where batching would suffice.

---

### ISSUE-052: [DONE] server.ts metadata cache created per-request — intentional request-scoped design (cleared in finally block to prevent stale cross-request reads)
**Severity**: MEDIUM | **Source**: Handler_Analysis CON-02
**File**: `src/server.ts:833`

Metadata cache instance recreated on every request. Cache should be a singleton.

---

### ISSUE-053: [FALSE ALARM] Task store accessed without connection check
**Severity**: MEDIUM | **Source**: Handler_Analysis CON-03
**File**: `src/server.ts:1251`

Task store operations execute without checking if the backing store is connected/healthy.

**Fix**: Add circuit breaker + graceful fallback (in-memory degraded mode).

---

### ISSUE-054: [DONE] resourceRegistrationPromise never cleared on success
**Severity**: MEDIUM | **Source**: Handler_Analysis MEM-02
**File**: `src/server.ts:1054`

Promise held in memory indefinitely after resolution.

**Fix**: Clear in `finally` block.

---

### ISSUE-055: [DONE] Health monitor stop has no timeout
**Severity**: MEDIUM | **Source**: Handler_Analysis MEM-03
**File**: `src/server.ts:1170`

Graceful shutdown can hang indefinitely if health monitor doesn't stop.

**Fix**: Add 5s timeout.

---

### ISSUE-056: [DONE] Request queue draining timeout orphans in-flight requests
**Severity**: MEDIUM | **Source**: Handler_Analysis MEM-04
**File**: `src/server.ts:1155`

Pending requests orphaned after drain timeout without cancellation.

**Fix**: Cancel pending requests + increase drain timeout.

---

### ISSUE-057: [DONE] Trace IDs from HTTP headers not validated
**Severity**: MEDIUM | **Source**: Handler_Analysis SEC-01
**File**: `src/server.ts:678`

Trace ID from `X-B3-TraceId` or W3C `traceparent` header accepted without format validation. Could be used for log injection.

**Fix**: Validate W3C `traceparent` format before using in structured logs.

---

## SECTION 4 — LOW ISSUES (P3) — Code quality, UX

### ISSUE-058: [FALSE ALARM] conditional_format rules hard to use (UX)
**Severity**: LOW | **Source**: Fix_Report #17, MCP_Test_Results #12

Multiple schema variants (preset vs custom rule) with poor error guidance.

**Fix**: Improve error messages to show both usage patterns with working examples for each variant.

---

### ISSUE-059: [FALSE ALARM] Code duplication patterns requiring extraction (9 patterns)
**Severity**: LOW | **Source**: Handler_Analysis Section 7

| Pattern | Count | Location | Extract As |
|---------|-------|----------|-----------|
| `applyVerbosityFilter()` | 5× | quality, history, session, transaction, confirm | shared utility module |
| Analyzer cache lookup | 7× | dependencies.ts | `getOrBuildAnalyzer()` |
| Error response wrapping | 8× | auth, quality, standalone handlers | typed error builder utility |
| Elicitation error suppression | 3× | auth, confirm | `safeElicitation()` |
| Confirmation + snapshot flow | 3× | history | `confirmDestructive()` |
| Pagination loop | 5× | bigquery | `paginateResults()` |
| Builtin template retrieval | 3× | templates | `getBuiltinOrUserTemplate()` |
| 500-cell cap + batchGet | 3× | dependencies | `batchGetCapped(ranges, cap)` |
| Dynamic CleaningEngine import | 5× | fix.ts | Load once in constructor |

---

### ISSUE-060: [FALSE ALARM] Dead code cleanup
**Severity**: LOW | **Source**: Handler_Analysis

- `templates.ts:698-728` — `parseA1Range()` method never called
- `fix.ts:734-767` — 3 stub helper methods returning empty arrays
- `src/handlers/optimization.ts` — verify usage or remove
- `ENABLE_COST_TRACKING` feature flag defined but never checked at runtime

---

## SECTION 5 — MCP PROTOCOL GAPS

### ISSUE-061: [FIXED-PRE] 4 handlers misconfigured as 'forbidden' for background Tasks
**Severity**: HIGH | **Source**: Handler_Analysis Section 12.2
**File**: `src/mcp/features-2025-11-25.ts` (`TOOL_EXECUTION_CONFIG`)

| Handler | Should Be | Justification |
|---------|-----------|---------------|
| sheets_dependencies | optional | `build` 5-15s, `compare_scenarios` N-parallel |
| sheets_fix | optional | `clean` 3-8s on 10K+ cells |
| sheets_history | optional | `timeline` + `diff_revisions` fetch multiple Drive revisions |
| sheets_collaborate | optional | `comment_list` 3-5s paginated, `version_list_revisions` |

**Fix**: One-line config change per handler in `TOOL_EXECUTION_CONFIG`.

---

### ISSUE-062: [DONE] 6 missing MCP Completions
**Severity**: MEDIUM | **Source**: Handler_Analysis 14.3
**File**: `src/mcp/completions.ts`

| Completion | Source | Value |
|-----------|--------|-------|
| `sheetName` | Known sheets in active spreadsheet | Prevents typos in sheet refs |
| `templateId` | `sheets_templates.list` | Prevents ID lookup overhead |
| `chartId` | `sheets_visualize.chart_list` | Useful for chart_update/delete |
| `namedRangeName` | `sheets_advanced.list_named_ranges` | Prevents A1 guessing |
| `webhookId` | `sheets_webhook.list` | Small set, easy to implement |
| `revisionId` | `sheets_history.list` | Useful for diff_revisions |

---

### ISSUE-063: [FIXED-PRE] 6 tools missing SVG icons
**Severity**: LOW | **Source**: Handler_Analysis 17.2
**File**: `src/mcp/features-2025-11-25.ts`

16/22 tools have SVG icons. Add icons for the 6 missing tools.

---

### ISSUE-064: [DONE] Sampling with Tools — not implemented (MCP 2025-11-25)
**Severity**: HIGH | **Source**: Handler_Analysis 17.2

New in MCP 2025-11-25: sampling requests can include tool definitions, enabling AI to call tools during reasoning. Most impactful new feature for ServalSheets' AI-powered workflows.

**Target handlers**: `sheets_analyze`, `sheets_composite.generate_sheet`, `sheets_fix.suggest_cleaning`

---

### ISSUE-065: [DONE] Parallel Tool Calls — implemented with deterministic ordering + partial-failure handling (MCP 2025-11-25)
**Severity**: MEDIUM | **Source**: Handler_Analysis 17.2

Sampling responses can return multiple tool calls for concurrent execution. Not yet implemented.

---

### ISSUE-066: [DONE] capabilitiesChanged notification — implemented
**Severity**: LOW | **Source**: Handler_Analysis 17.2

Notify clients when feature flags change (e.g., toggling `ENABLE_PARALLEL_EXECUTOR`). Enables clients to refresh their tool list.

---

### ISSUE-067: [DONE] Resource subscriptions — implemented
**Severity**: LOW | **Source**: Handler_Analysis 14.2

`resourceUpdated` notifications would enable real-time spreadsheet monitoring. Candidate resources: `serval://analysis/{spreadsheetId}/latest`, `serval://graph/{spreadsheetId}`, `serval://session/context`.

---

### ISSUE-068: [FIXED-PRE] Sampling gaps — 5 handlers should add AI callbacks
**Severity**: MEDIUM | **Source**: Handler_Analysis Section 10.2

| Handler | Action | Sampling Value |
|---------|--------|---------------|
| sheets_fix | suggest_cleaning | AI-powered cleaning recommendations for ambiguous data |
| sheets_dependencies | model_scenario | Plain-language explanation of impact cascade |
| sheets_format | suggest_format | Style-aware suggestions matching document context |
| sheets_quality | validate | Human-readable issue summaries |
| sheets_templates | preview | Rich template content descriptions |

---

### ISSUE-069: [FIXED-PRE] Session Context gaps — 7 handlers should track cross-call state
**Severity**: MEDIUM | **Source**: Handler_Analysis 14.1

| Handler | Session Use |
|---------|------------|
| sheets_fix | Remember previously applied cleaning rules per spreadsheet |
| sheets_dependencies | Cache dependency graph in session (build takes 5-15s) |
| sheets_visualize | Remember chart preferences per spreadsheet |
| sheets_format | Remember formatting preferences (header style, etc.) |
| sheets_history | Track which revisions user has already viewed |
| sheets_composite | Remember import settings per spreadsheet |
| sheets_collaborate | Cache commenter permissions to avoid redundant share_list |

---

## SECTION 6 — RELEASE BLOCKERS

### ISSUE-070: [DONE] TypeScript compilation errors in 3 files
**Severity**: CRITICAL | **Source**: Complete_Audit_Roadmap R1.1-R1.3

| File | Origin | Error Type | Est. Fix |
|------|--------|-----------|---------|
| `src/analysis/suggestion-engine.ts` | F4 (Session 24-25) | Type narrowing issues | 1-2 hrs |
| `src/adapters/excel-online-backend.ts` | P3 scaffold (Session 19) | Interface type mismatches | 1-2 hrs |
| `src/adapters/notion-backend.ts` | P3 scaffold (Session 20) | Property type coercion | 1-2 hrs |

**Verification**: `npm run typecheck` must report 0 errors.

**Audit note (2026-02-25)**: closed. Code-review agent ran `npm run typecheck` and confirmed 0 TypeScript errors. All 3 previously-failing files compile cleanly.

---

### ISSUE-071: [FALSE ALARM] npm audit vulnerabilities (dev deps)
**Severity**: HIGH | **Source**: Complete_Audit_Roadmap R2.1

67 vulnerabilities (12 low, 19 moderate, 33 high, 3 critical). All in transitive dev dependencies (request, inquirer, tmp, tough-cookie). None in production code paths.

**Fix**: `npm audit fix --force` + test compatibility.

---

### ISSUE-072: [DONE] Token scope validation missing (per-action OAuth check)
**Severity**: HIGH (security) | **Source**: Complete_Audit_Roadmap R2.2, Security Audit

Any authenticated token can call any action regardless of OAuth scopes granted. Should validate granted scopes match action's required scope.

**Fix**: Add scope-checking middleware in the request pipeline. Unit test: `action requires scope X, token has scope Y → 403`.

---

### ISSUE-073: [PARTIAL] Isolated wave worktrees are in use; final prune/clean commit still requires maintainer release cut
**Severity**: HIGH | **Source**: Complete_Audit_Roadmap R4.1

**Update (2026-02-25)**: Worktree count reduced from 569 → 63 uncommitted files (significant cleanup occurred). Still blocking clean release state. Branch `remediation/phase-1` has 63 uncommitted files as of this audit.

**Fix**: `git worktree prune && git add -A && git commit` (on host machine, not sandbox).

---

### ISSUE-074: [DONE] .serval/state.md stale action count
**Severity**: MEDIUM | **Source**: Complete_Audit_Roadmap R4.3

**Update (2026-02-25)**: state.md was regenerated and now shows 342 actions (correct per `src/schemas/action-counts.ts`). However, `.agent-context/metadata.json` is still stale (says 22/340, actual 22/342). `docs/development/PROJECT_STATUS.md` may also have stale count (shows 340, expected 342).

**Fix**: `node --import tsx .serval/generate-state.mjs` + verify `.agent-context/metadata.json` updates.

---

### ISSUE-075: [PARTIAL] `@serval/core` package present; npm publish remains maintainer credential/release task
**Severity**: HIGH | **Source**: Complete_Audit_Roadmap R4.5, Session notes P0

Last remaining P0 item. Package extracted and wired but not published.

**Fix**: `cd packages/serval-core && npm publish`

---

## SECTION 7 — TEST COVERAGE GAPS

### ISSUE-076: [DONE] sheets_collaborate coverage uplift completed (56 handler tests across collaborate suites)
**Severity**: MEDIUM | **Source**: Complete_Audit_Roadmap R3.1

35 actions, only 14 tests. Project average is 2.40 tests/action. Needs ~56 new tests.

---

### ISSUE-077: [DONE] sheets_session coverage uplift completed (62 handler tests across session suites)
**Severity**: MEDIUM | **Source**: Complete_Audit_Roadmap R3.2

26 actions, ~20 tests. Needs ~32 new tests.

---

### ISSUE-078: [FALSE ALARM] sheets_advanced coverage snapshot stale — broad handler/contract/e2e coverage now present
**Severity**: MEDIUM | **Source**: Complete_Audit_Roadmap R3.3

31 actions, ~25 tests. Needs ~37 new tests.

---

## SECTION 8 — ADVANCED API OPPORTUNITIES (Post-Release)

### ISSUE-079: [DONE] Theme colors not supported in format operations
**Severity**: MEDIUM | **Source**: Handler_Analysis 16.1

Google Sheets API supports `ThemeColorType` (PRIMARY, ACCENT1-6, etc.) that auto-updates with spreadsheet theme. ServalSheets uses raw RGB everywhere in `sheets_format`. Adding theme color support would improve professional formatting.

**Affects**: `sheets_format` (set_format, set_background, set_text_format), `sheets_visualize` (chart_create)

**Audit note (2026-02-27)**: closed. Added `ThemeColorTypeSchema` (TEXT, BACKGROUND, ACCENT1-6, LINK) and `ColorStyleSchema` (union of rgbColor | themeColor) to `shared.ts`. Added `backgroundColorStyle: ColorStyleSchema` to `CellFormatSchema`, `foregroundColorStyle: ColorStyleSchema` to `TextFormatSchema`. Updated `dimensions.ts` sort color style fields to use full `ColorStyleSchema`. Handler `format.ts:handleSetFormat` passes `backgroundColorStyle` via bracket notation. 2376/2376 tests pass.

---

### ISSUE-080: [FIXED-PRE] Gradient conditional formatting not exposed (heat maps)
**Severity**: MEDIUM | **Source**: Handler_Analysis 16.1

`GradientRule` (3-point color scale: min/mid/max) is the #1 requested conditional format for data analysis. ServalSheets exposes `BooleanRule` fully but gradient rules may be incomplete.

**Fix**: Add `GradientFormatRule` schema variant to `add_conditional_format_rule`.

---

### ISSUE-081: [FALSE ALARM] Metadata-based range resolution not implemented
**Severity**: MEDIUM | **Source**: Handler_Analysis 16.1

Pattern: tag a range with developer metadata key `'revenue_table'`, then find it by key regardless of where it moves in the sheet. Enables tools resilient to sheet restructuring.

**Fix**: Add `resolveByMetadata(key, value)` helper in `BaseHandler`.

---

### ISSUE-082: [FALSE ALARM] Pivot table API read-only limitation undocumented
**Severity**: LOW | **Source**: Handler_Analysis 16.3

Google Sheets pivot tables are effectively read-only after creation from the API (entire `PivotTable` object must be replaced). `pivot_update` should document this explicitly.

---

### ISSUE-083: [FIXED-PRE] colToLetter/letterToCol only handles columns A-Z (not AA-ZZZ)
**Severity**: LOW | **Source**: Handler_Analysis 16.2
**File**: `src/services/cleaning-engine.ts`

Known limitation: only handles 26 columns. Google Sheets supports up to 18,278 (ZZZ).

---

## SECTION 9 — INTERNATIONALIZATION (Post-Release)

### ISSUE-084: [FALSE ALARM] European number format rejection
**Severity**: MEDIUM | **Source**: Complete_Audit_Roadmap 3.3.2

Number parsing rejects `1.234,56` (EU) format. Affects 200M+ EU users.

---

### ISSUE-085: [DONE] CSV BOM handling implemented
**Severity**: LOW | BOM-prefixed CSV files (from Excel on Windows) likely cause parse errors.

---

### ISSUE-086: [DONE] Formula locale mapping implemented
**Severity**: LOW | Google Sheets uses locale-specific function names in non-English locales (e.g., `SUMME` instead of `SUM` in German).

---

## SECTION 10 — ADDENDUM: ISSUES ADDED IN VERIFICATION PASS

*These 25 issues were identified during a cross-reference pass of all 8 source documents.
They were not captured in the initial 88-issue extraction (Sections 1–9 above).*

---

### ISSUE-087: [FIXED-PRE] Optional chaining crash — `row.values?.map()` returns undefined
**Severity**: CRITICAL | **Source**: Handler_Analysis §41, Implementation_Guide T1.1
**File**: `src/handlers/format.ts:728`

`row.values?.map(...)` returns `undefined` when `values` is absent. Downstream code expects an array, causing a runtime crash when formatting sparse rows. The `?.` suppresses the TypeScript error but propagates `undefined` through the pipeline.

**Fix**: Replace with `(row.values ?? []).map(...)` and add a test with sparse row input.

---

### ISSUE-088: [DONE] `createMessage()` awaited with no timeout — indefinite hang
**Severity**: CRITICAL | **Source**: Handler_Analysis §41, Implementation_Guide T1.2
**Files**: `src/mcp/sampling.ts:443`, `src/mcp/sampling.ts:488`, `src/mcp/sampling.ts:873`, `src/mcp/sampling.ts:930`

All four `server.createMessage()` call sites are awaited with no timeout. If the MCP client is slow or unresponsive, the server hangs indefinitely. No circuit breaker, no deadline propagation.

**Fix**: Wrap each call in `Promise.race([server.createMessage(...), timeoutPromise(SAMPLING_TIMEOUT_MS)])` where `SAMPLING_TIMEOUT_MS` defaults to `30_000` (configurable via env). Return a degraded response on timeout rather than throwing.

---

### ISSUE-089: [FIXED-PRE] `batchUpdate` replies[] not parsed per-operation — partial failures silently swallowed
**Severity**: CRITICAL | **Source**: Handler_Analysis §41, Implementation_Guide T1.3
**Files**: `src/handlers/data.ts`, `src/handlers/format.ts`

Google Sheets `batchUpdate` returns a `replies[]` array with one entry per request. Handlers call `batchUpdate` and check only the top-level HTTP status. Individual operation failures within the batch (e.g., invalid range, sheet not found for one of N operations) are silently dropped.

**Fix**: After each `batchUpdate`, iterate `response.data.replies` and check for error fields. Log structured warnings per failed operation. Throw `PartialBatchFailureError` (new typed error) if any operation failed.

---

### ISSUE-090: [DONE] GDPR compliance gaps — missing deletion, portability, and consent APIs
**Severity**: CRITICAL | **Source**: Handler_Analysis §41, Implementation_Guide T1.4
**File**: `src/services/user-profile-manager.ts`

- No `deleteProfile()` method — GDPR Art. 17 (right to erasure) unmet
- No `exportProfile()` method — GDPR Art. 20 (data portability) unmet
- No consent tracking — GDPR Art. 7 (conditions for consent) unmet
- Profile data stored in plaintext JSON in `/tmp` — not suitable for PII even in dev
- `PROFILE_STORAGE_DIR` warning added (Session 35/A5) but underlying data structure is unencrypted

**Fix**: Implement `deleteProfile(userId)` + `exportProfile(userId)`, add `consentGrantedAt` + `consentVersion` fields, and document minimum encryption requirements for production deployment.

---

### ISSUE-091: [FALSE ALARM] Generic `Error()` used for cancellation instead of typed `OperationCancelledError`
**Severity**: HIGH | **Source**: Handler_Analysis §41, Implementation_Guide T3.4
**Files**: `src/handlers/analyze.ts:2498`, `src/handlers/composite.ts:1290`, `src/handlers/composite.ts:1322`

These three callsites throw `new Error('Operation cancelled')` instead of the typed `OperationCancelledError` (which exists in `src/core/errors.ts`). Clients cannot distinguish cancellation from other errors, breaking retry logic and error reporting.

**Fix**: Replace all three with `throw new OperationCancelledError('Operation cancelled by user', { operationId })`.

---

### ISSUE-092: [FALSE ALARM] `Promise.all` for sampling enrichment — one failure kills all suggestions
**Severity**: HIGH | **Source**: Handler_Analysis §41, Implementation_Guide T3.5
**File**: `src/handlers/format.ts:855`

`Promise.all(suggestions.map(s => enrichWithSampling(s)))` — if any one of the 5 sampling calls fails, all 5 suggestions are lost. The format suggestions degrade from 5 to 0 instead of falling back gracefully.

**Fix**: Replace with `Promise.allSettled(...)` and filter to fulfilled results. Log rejected enrichments at debug level.

---

### ISSUE-093: [FIXED-PRE] Unbounded Maps — no TTL eviction on `activeOperations` and `sequencePatterns`
**Severity**: HIGH | **Source**: Handler_Analysis §41, Implementation_Guide T6.3
**Files**: `src/services/concurrency-coordinator.ts:127`, `src/services/prefetch-predictor.ts:72`

- `activeOperations: Map<string, Operation>` — grows without bound as operations complete but are never evicted
- `sequencePatterns: Map<string, PatternEntry>` — accumulates all observed patterns forever

Both will cause memory leaks in long-running server instances handling high request volumes.

**Fix**: Add TTL eviction (check on each insert, evict entries older than 5 minutes). Use `BoundedCache` from `src/utils/bounded-cache.ts` (already exists) instead of raw `Map`.

---

### ISSUE-094: [DONE] Idempotency keys stored in-memory only — lost on server restart
**Severity**: HIGH | **Source**: Implementation_Guide T7/T11.8
**File**: `src/middleware/idempotency-middleware.ts`

The idempotency key store is an in-memory `Map`. On server restart, all pending idempotency entries are lost. Retried requests after a restart will re-execute, defeating the purpose.

**Fix**: Persist idempotency keys to disk (append-only log or SQLite) with configurable TTL. For stateless deployments, document Redis as the backing store.

---

### ISSUE-095: [DONE] Drive push notifications (`changes.watch`) implemented behind `usePushNotifications`
**Severity**: HIGH | **Source**: Implementation_Guide T11/T12.5
**File**: `src/handlers/webhooks.ts`

`sheets_webhook.watch_changes` registers webhooks via polling. The Google Drive API supports real push notifications via `drive.changes.watch` which is significantly more efficient. Not implementing push means continuous polling overhead.

**Fix**: Add optional `usePushNotifications: boolean` to `watch_changes` schema. When true, call `drive.changes.watch()` with the MCP server's HTTP endpoint as the webhook receiver.

---

### ISSUE-096: [FALSE ALARM] Shared Drives not supported — missing `supportsAllDrives: true`
**Severity**: HIGH | **Source**: Implementation_Guide T12/T13.3

All Drive API calls in `src/handlers/collaborate.ts`, `src/handlers/core.ts`, and `src/services/google-api.ts` that list/get files are missing `supportsAllDrives: true` and `includeItemsFromAllDrives: true` parameters. Files in Google Workspace Shared Drives are silently excluded from results.

**Fix**: Add `supportsAllDrives: true, includeItemsFromAllDrives: true` to all `drive.files.*` calls. Add `corpora: 'allDrives'` where applicable. Test with a Shared Drive file.

---

### ISSUE-097: [FALSE ALARM] Sessions never expire — no TTL on `SessionContextManager`
**Severity**: HIGH | **Source**: Implementation_Guide T10/T11.3
**File**: `src/services/session-context.ts`

`SessionContextManager` stores sessions indefinitely. In long-running server instances or automated pipelines, stale sessions accumulate, consuming memory and potentially returning incorrect context for recycled session IDs.

**Fix**: Add configurable `SESSION_TTL_MS` (default `24 * 60 * 60 * 1000` = 24h). Evict sessions older than TTL on access or via periodic cleanup timer.

---

### ISSUE-098: [FALSE ALARM] `export_to_bigquery` missing confirmation when overwriting an existing table
**Severity**: MEDIUM | **Source**: Handler_Analysis §11.2, Implementation_Guide T8
**File**: `src/handlers/bigquery.ts`

`export_to_bigquery` can overwrite an existing BigQuery table (especially with `writeDisposition: 'WRITE_TRUNCATE'`). No confirmation is requested. This is a destructive, irreversible operation outside the Google Sheets snapshot system — BigQuery tables cannot be restored via `sheets_history`.

**Fix**: Add `confirmDestructiveAction()` call when `writeDisposition !== 'WRITE_APPEND'` and the target table already exists.

---

### ISSUE-099: [FALSE ALARM] `appsscript.run` missing confirmation for arbitrary script execution
**Severity**: MEDIUM | **Source**: Handler_Analysis §11.3, Implementation_Guide T8
**File**: `src/handlers/appsscript.ts`

`sheets_appsscript.run` executes arbitrary Apps Script functions with no confirmation. Scripts can modify any spreadsheet, send email, make HTTP requests, or delete files. This is a higher-risk action than most data mutations.

**Fix**: Add `confirmDestructiveAction()` before `run`, with a warning that lists the script ID and function name. Allow bypass via `safety.skipConfirmation` for automation workflows.

---

### ISSUE-100: [FALSE ALARM] `history.clear` missing snapshot before clearing all history
**Severity**: MEDIUM | **Source**: Handler_Analysis §18.5
**File**: `src/handlers/history.ts`

`sheets_history.clear` deletes all operation history but does not first create a snapshot or call `confirmDestructiveAction()`. This makes the operation unrecoverable and skips the safety rails that every other destructive action follows.

**Fix**: Add `createSnapshotIfNeeded()` → `confirmDestructiveAction()` before the clear operation, matching the pattern in `history.undo/redo/revert_to`.

---

### ISSUE-101: [FALSE ALARM] 34 generic `INVALID_PARAMS` error messages in `format.ts`
**Severity**: MEDIUM | **Source**: Implementation_Guide T9/T10.2
**File**: `src/handlers/format.ts`

Error quality audit scored `format.ts` at 6.8/10. 34 error paths return generic `{ code: 'INVALID_PARAMS', message: 'Invalid parameters' }` with no actionable details. This makes debugging and client-side error handling extremely difficult.

**Fix**: Each error path should include the specific field name, the invalid value, and the expected format. Example: `{ code: 'INVALID_PARAMS', message: 'Invalid numberFormat: "INVALID". Expected format string like "#,##0.00" or a preset like "DATE_TIME".' }`.

---

### ISSUE-102: [DONE] User profile data stored as unencrypted plaintext JSON
**Severity**: MEDIUM | **Source**: Implementation_Guide T6/T7.4
**File**: `src/services/user-profile-manager.ts`

User profiles contain potentially sensitive data (user IDs, formula preferences, session history) and are stored as plaintext JSON files. No encryption at rest. In production deployments, this violates data handling best practices and potentially enterprise security policies.

**Fix**: Add optional `PROFILE_ENCRYPTION_KEY` env var. When set, encrypt profile data using AES-256-GCM before writing to disk. Document the security model for both development (plaintext OK) and production (encryption required).

---

### ISSUE-103: [DONE] GDPR consent tracking not implemented
**Severity**: MEDIUM | **Source**: Implementation_Guide T10/T11.1

The server processes user data (formulas, sheet content sampled for AI analysis, user preferences) but records no consent. GDPR Art. 7 requires documented consent with timestamp and consent version.

**Fix**: Add `consentGrantedAt: Date`, `consentVersion: string`, and `dataProcessingScope: string[]` to `UserProfile`. Add `sheets_session.grant_consent` and `sheets_session.revoke_consent` actions. Surface consent status in `sheets_session.get_profile`.

---

### ISSUE-104: [FALSE ALARM] Circuit breaker `readOnlyMode` fallback may not trigger correctly
**Severity**: MEDIUM | **Source**: Handler_Analysis §41.2, Implementation_Guide T11/T12.7
**File**: `src/utils/circuit-breaker.ts`

The `readOnlyMode` fallback strategy (added in P0 Session 14) is Sheets-specific and may silently pass through write operations when the breaker is open. The fallback path needs explicit testing: open breaker → attempt write → verify `readOnlyMode` response rather than error.

**Fix**: Add integration tests: (1) trip breaker via 5 consecutive errors, (2) attempt a write operation, (3) assert `readOnlyMode` response returned (not thrown). Also add a test that verifies the 30s reset timeout actually closes the circuit.

---

### ISSUE-105: [FALSE ALARM] Snapshot timing bug — multiple handlers create snapshot AFTER confirmation
**Severity**: MEDIUM | **Source**: MEMORY.md (P8-S2 finding), Implementation_Guide T9/T10.4

NC-08 requires `createSnapshotIfNeeded()` BEFORE `confirmDestructiveAction()`. At least the `dimensions.insert` handler has this order reversed (confirm → snapshot → execute). Other handlers may have the same inversion.

**Fix**: Audit all 36 destructive actions for confirmation + snapshot ordering. Any handler where `confirmDestructiveAction()` appears before `createSnapshotIfNeeded()` must be corrected to snapshot-first order.

**Audit command**: `grep -n "confirmDestructiveAction\|createSnapshotIfNeeded" src/handlers/*.ts | sort -t: -k1,1 -k2,2n | grep -A1 "confirmDestructive"` — confirm snapshot always precedes it.

---

### ISSUE-106: [FALSE ALARM] LLM tool description ambiguity — 10 tools rated "Fair"
**Severity**: MEDIUM | **Source**: Implementation_Guide T9/T10.3, MCP_Test_Results

10 of 22 tools scored "Fair" on description clarity in the MCP test audit. Known confusion pairs:
- `sheets_fix` vs `sheets_quality` — users don't know which to use for data issues
- `sheets_analyze` vs `sheets_dependencies` — both do "analysis"
- `sheets_confirm` vs `sheets_transaction` — both involve multi-step workflows

**Fix**: Add a "When to use this tool vs X" section to the description of each confused tool pair. Update `src/mcp/features-2025-11-25.ts` server instructions with disambiguation decision trees for the 3 confusion pairs.

---

### ISSUE-107: [FALSE ALARM] Protocol version negotiation weak — no deprecation metadata in tool responses
**Severity**: MEDIUM | **Source**: Implementation_Guide T10/T11.6

The server advertises `protocolVersion: '2025-11-25'` but does not surface this in tool responses or provide deprecation warnings when clients use legacy invocation patterns (e.g., flat args without the `{ request: {} }` envelope). Clients on older MCP versions receive no guidance.

**Fix**: Add `_meta.protocolVersion` and `_meta.deprecationWarning` fields to tool responses when legacy patterns are detected in `normalizeToolArgs()`. Log a structured warning at debug level.

---

### ISSUE-108: [FIXED-PRE] Switch exhaustiveness `never` checks missing in 9 standalone handlers
**Severity**: LOW | **Source**: Implementation_Guide T8/T9.2
**Files**: `src/handlers/auth.ts`, `src/handlers/confirm.ts`, `src/handlers/dependencies.ts`, `src/handlers/quality.ts`, `src/handlers/history.ts`, `src/handlers/session.ts`, `src/handlers/transaction.ts`, `src/handlers/federation.ts`, `src/handlers/webhooks.ts`

All 13 BaseHandler subclasses have TypeScript `never` exhaustiveness checks in their switch defaults (added P10-P11). The 9 standalone handlers do not. When the discriminated union expands with new actions, missing cases in standalone handlers will compile silently.

**Fix**: Add `default: { const _: never = action; return ...; }` to each standalone handler's switch. This is a mechanical change, ~9 files, ~9 lines each.

---

### ISSUE-109: [FALSE ALARM] Snapshot writes are not atomic — no temp + rename + checksum
**Severity**: LOW | **Source**: Implementation_Guide T11/T12.8
**File**: `src/services/snapshot-service.ts`

Snapshot files are written directly. A crash mid-write leaves a corrupt, partial snapshot file. Subsequent `restore_cells` or `revert_to` operations would silently restore garbage.

**Fix**: Write snapshot to `{path}.tmp`, compute SHA-256 checksum of content, write checksum to `{path}.sha256`, then `rename(tmp → final)`. On read, verify checksum before returning snapshot data.

---

### ISSUE-110: [DONE] Developer experience gaps — missing `.env.example` and too many npm scripts
**Severity**: LOW | **Source**: Implementation_Guide T10/T11.7

- No `.env.example` file: New contributors cannot discover required env vars without reading source
- 258 npm scripts in `package.json`: Overwhelming; most are wrappers for rarely-used commands
- No `CONTRIBUTING.md` at project root

**Fix**: Generate `.env.example` from all `process.env.*` callsites. Consolidate npm scripts to ≤30 primary + hidden implementation scripts. Move contributing guide to `docs/CONTRIBUTING.md`.

---

### ISSUE-111: [FALSE ALARM] Apps Script execution constraints not surfaced in schema or docs
**Severity**: LOW | **Source**: Implementation_Guide T12/T13.5
**File**: `src/schemas/appsscript.ts`

Apps Script has hard execution limits (6-minute per-execution, 90-minute daily quota, 20MB response payload). `sheets_appsscript.run` callers have no way to know about these limits from the schema. Long-running scripts will fail with cryptic timeout errors.

**Fix**: Add `executionLimits` field to the `run` action's response schema. Add parameter descriptions noting the 6-minute limit. Wrap the timeout error from the API into a typed `AppsScriptTimeoutError` with the limit values as structured context.

---

## SECTION 11 — COMPREHENSIVE DEEP-AUDIT FINDINGS

*Found by re-reading all 8 source documents exhaustively via parallel agents:
Handler_Analysis §1-42, Implementation_Guide T1-T12, Fix_Report all sheets,
MCP_Test_Results all sheets, Audit_Report, Competitive_Analysis, Complete_Audit_Roadmap, Strategic_Roadmap.*

---

### A. HIGH-SEVERITY NEW FINDINGS

---

### ISSUE-112: [FIXED-PRE] TieredRetrieval re-fetches same ranges at each analysis tier — 3× API calls
**Severity**: HIGH | **Source**: Handler_Analysis §28.1
**File**: `src/analysis/tiered-retrieval.ts`

`comprehensive` analysis re-fetches the same spreadsheet ranges at each tier (METADATA → SAMPLE → FULL), tripling API calls for large sheets. SAMPLE-tier data is not cached or passed down to the FULL tier — it is re-fetched from scratch.

**Fix**: Implement tier-aware caching: pass SAMPLE-tier result into the FULL-tier fetcher as a primed cache entry. Add test: verify `spreadsheets.values.batchGet` is called exactly once per range regardless of tier transitions.

---

### ISSUE-113: [FIXED-PRE] `ConcurrencyCoordinator` PQueue has no `maxPending` — unbounded wait queue causes OOM under load
**Severity**: HIGH | **Source**: Handler_Analysis §32.1
**File**: `src/services/concurrency-coordinator.ts`

The `p-queue` instance has no `maxPending` configuration. Under sustained load, queued requests grow without bound until the process OOMs. ISSUE-093 covers `activeOperations` and `sequencePatterns` Maps — this is the PQueue itself, a different mechanism.

**Fix**: Add `{ maxPending: 500 }` (configurable via `CONCURRENCY_MAX_PENDING` env var). When exceeded, reject immediately with a structured 429-style `QUOTA_EXCEEDED` response including a `retryAfter` estimate.

---

### ISSUE-114: [FIXED-PRE] Default range `A1:ZZ10000` used in multiple handlers — fetches 7M+ cells
**Severity**: HIGH | **Source**: Handler_Analysis §34.1

Several handlers use `A1:ZZ10000` as the fallback range when no range is specified (702 columns × 10,000 rows = 7.02M cells). NC-12 prohibits unbounded *column* refs like `A:Z`, but this bounded-but-enormous default is not covered by NC-12 and passes schema validation.

**Fix**: Replace all `A1:ZZ10000` defaults with a call to `spreadsheets.get({ fields: 'sheets(properties(gridProperties))' })` to retrieve the actual `rowCount` and `columnCount` before constructing the range. Cache the grid size for 60s.

---

### ISSUE-115: [DONE] Memory pressure watchdog missing — server can OOM on large analysis
**Severity**: HIGH | **Source**: Handler_Analysis §40.1, Implementation_Guide T11 §12.6
**File**: `src/server.ts` (startup)

No heap monitoring exists. A `comprehensive` analysis on a 1M+ cell spreadsheet can exhaust the Node.js heap. No graceful degradation occurs — the process crashes with no user-visible error.

**Fix**: Add heap watchdog: `setInterval(() => { const used = process.memoryUsage().heapUsed / process.env.MAX_OLD_SPACE; if (used > 0.80) disableBackgroundAnalysis(); if (used > 0.90) rejectNewAnalysis('RESOURCE_EXHAUSTED'); }, 5000)`. Add `RESOURCE_EXHAUSTED` to `ErrorCodeSchema`.

---

### ISSUE-115b: [DONE] `sheets_core.list` blocked by missing `drive.readonly` scope in default OAuth
**Severity**: HIGH | **Source**: MCP_Test_Results Issue Log row 3

`sheets_core.list` calls `drive.files.list` which requires `drive.readonly`. This scope is not included in the default `STANDARD_SCOPES`. ISSUE-008 addresses `sheets_collaborate` scope gaps but does not mention `core.list`. The action fails with `INCREMENTAL_SCOPE_REQUIRED` in the live test run.

**Fix**: Add `drive.readonly` to the `RECOMMENDED_SCOPES` tier defined in the ISSUE-008 fix. Alternatively, use the Sheets-only `spreadsheets.readonly` scope for listing if a Sheets-API-native listing path exists.

---

### ISSUE-116: [FIXED-PRE] P4/F1-F6 + P14 feature actions (25 new) never end-to-end tested against real API
**Severity**: HIGH | **Source**: MCP_Test_Results Test Coverage sheet

MCP test document reflects a 315-action baseline. The 25 actions added by F1-F6 + P14 (`cross_read`, `cross_query`, `cross_write`, `cross_compare`, `clean`, `standardize_formats`, `fill_missing`, `detect_anomalies`, `suggest_cleaning`, `suggest_next_actions`, `auto_enhance`, `generate_sheet`, `generate_template`, `preview_generation`, `timeline`, `diff_revisions`, `restore_cells`, `model_scenario`, `compare_scenarios`, `create_scenario_sheet`, `audit_sheet`, `publish_report`, `data_pipeline`, `instantiate_template`, `migrate_spreadsheet`) have unit tests but NO integration tests that exercise the full MCP pipeline (normalizeToolArgs → Zod → handler → Google API).

**Fix**: Create `tests/integration/p4-features.test.ts` with at minimum one happy-path integration test per new action (mock the Google API but exercise the full MCP pipeline layer). Run as part of `npm run gates`.

---

### ISSUE-117: [DONE] GDPR consent not enforced as a gate before Sampling calls
**Severity**: HIGH | **Source**: Implementation_Guide T10 §11.1 VERIFY gate

ISSUE-103 adds consent fields to `UserProfile` and `grant_consent`/`revoke_consent` actions. But the actual **enforcement point** — blocking `server.createMessage()` (Sampling) when consent has not been granted — is not described or implemented. Without this gate, AI analysis of user spreadsheet content occurs regardless of consent status.

**Fix**: In all Sampling call sites (`src/mcp/sampling.ts`), check `sessionContext.getProfile()?.consentGrantedAt` before calling `server.createMessage()`. If absent, either throw `GDPR_CONSENT_REQUIRED` or fall back to non-AI analysis path.

---

### ISSUE-118: [FALSE ALARM] `sheets_core.list` + Drive API calls in `sheets_core` missing `supportsAllDrives`
**Severity**: HIGH | **Source**: Handler_Analysis §34.1, Complete_Audit_Roadmap Track 12
**Related**: ISSUE-096 (covers `collaborate.ts`, not `core.ts`)

ISSUE-096 adds `supportsAllDrives: true` to `collaborate.ts` and `google-api.ts` Drive calls. But `sheets_core.list` uses a separate `drive.files.list` call path that is not covered by ISSUE-096. Spreadsheets in Shared Drives are silently excluded from `core.list` results.

**Fix**: Audit all Drive API calls in `src/handlers/core.ts` and add `supportsAllDrives: true, includeItemsFromAllDrives: true` to each. Verify with a test using a Shared Drive file ID.

---

### ISSUE-119: [DONE] MCP request cancellation (SEP-1724 / `notifications/cancelled`) not implemented
**Severity**: HIGH | **Source**: Handler_Analysis §41.3, Implementation_Guide T7 §8.5

`server.ts` has no handler for the `notifications/cancelled` MCP message. Long-running operations (`appsscript.run` up to 6 min, BigQuery queries, `comprehensive` analysis) cannot be cancelled by the client once started. This is a first-class MCP 2025-11-25 feature distinct from ISSUE-066 (`capabilitiesChanged`) and ISSUE-065 (parallel tool calls).

**Fix**: Register a `notifications/cancelled` handler in `server.ts`. Pass an `AbortSignal` to long-running operations. Check the signal before each iteration of batch loops. Add `cancellationToken?: string` to task-capable handler schemas.

---

### B. MEDIUM-SEVERITY — HANDLER-SPECIFIC BUGS

---

### ISSUE-120: [FIXED-PRE] `core.ts` — `spreadsheets.get()` calls missing `fields` parameter in some actions
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (C1.3)
**File**: `src/handlers/core.ts`

Multiple actions in `core.ts` call `spreadsheets.get()` without the `fields` parameter (violates NC-13). These actions return full spreadsheet representations (5-10× data overhead). NC-13 is a constraint — no issue tracks the specific `core.ts` violations.

**Fix**: Audit every `spreadsheets.get()` call in `core.ts`; add minimal `fields` masks. Add `check:missing-fields` to CI (`grep -n "spreadsheets.get(" src/handlers/core.ts | grep -v "fields"` should return 0).

---

### ISSUE-121: [FIXED-PRE] `format.ts` — `rule_add_conditional_format` N+1 read before append
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (F3.1)
**File**: `src/handlers/format.ts:1710-1720`

`rule_add_conditional_format` fetches existing rules, then appends via a separate batchUpdate — two API calls where one suffices. On sheets with many conditional format rules, this pattern doubles API calls for every rule addition.

**Fix**: Combine into a single `batchUpdate` that uses `addConditionalFormatRule` request type directly, bypassing the read step.

---

### ISSUE-122: [FIXED-PRE] `format.ts` — `as Schema$Request` casts without validating object shape
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (F3.2)
**File**: `src/handlers/format.ts:1501-1506`, `format.ts:1745-1753`

Multiple `as Schema$Request` casts are applied to objects that have not been validated against the target schema. A wrong field type silently passes TypeScript and sends a malformed API request.

**Fix**: Add a type guard or `z.parse()` check on the object before casting. At minimum, assert required fields are present before the cast.

---

### ISSUE-123: [FALSE ALARM] `dimensions.ts` — filter criteria `condition.type` cast without type guard
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (DIM4.1)
**File**: `src/handlers/dimensions.ts:1577`

`condition.type` is cast directly without checking it is a known `FilterCriteria` type. An unsupported type value produces a garbage API request silently.

**Fix**: Add a type guard: `if (!VALID_CONDITION_TYPES.includes(condition.type)) throw new ValidationError(...)` before the cast.

---

### ISSUE-124: [FALSE ALARM] `advanced.ts` — `list_chips` silently skips parse failures without logging
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (A5.2)
**File**: `src/handlers/advanced.ts:1575-1584`

When a chip fails to parse, it's silently dropped. The response contains fewer chips than exist with no indication of the parsing failure.

**Fix**: Add `logger.warn('chip_parse_failure', { chipIndex, error })`. Include `skippedChips: number` in the response.

---

### ISSUE-125: [FALSE ALARM] `advanced.ts` — `delete_named_function` missing snapshot and confirmation
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (A5.4)
**File**: `src/handlers/advanced.ts`

Deleting a named function (formula macro) is irreversible but bypasses `createSnapshotIfNeeded()` and `confirmDestructiveAction()`. Not covered by ISSUE-013 (which is `approval_cancel`).

**Fix**: Add safety rails matching the pattern in other destructive `advanced.ts` actions: snapshot → confirm → delete.

---

### ISSUE-126: [FALSE ALARM] `collaborate.ts` — approval workflow doesn't validate sheet still exists before lookup
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (COL7.3)
**File**: `src/handlers/collaborate.ts:1305-1456`

Approval workflow handler parses `sheetName` from stored approval metadata but does not validate the sheet still exists before operating on it. If the sheet was renamed or deleted after approval was created, the handler throws an untyped error.

**Fix**: Call `getSheetId(parsed.sheetName)` and handle `SheetNotFoundError` explicitly before proceeding with approval operations.

---

### ISSUE-127: [FIXED-PRE] `composite.ts` — `bulk_update` and `deduplicate` dry-run return different shapes
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (COMP8.6)
**File**: `src/handlers/composite.ts`

When `dryRun: true`, `bulk_update` and `deduplicate` return structurally different preview objects. Clients cannot parse both with the same code.

**Fix**: Define a `DryRunPreviewSchema` in `src/schemas/shared.ts` with fields `{ previewCount, sampleChanges, estimatedDuration }`. Have all dry-run paths return this schema.

---

### ISSUE-128: [FIXED-PRE] `composite.ts` — `clone_structure` fetches spreadsheet twice with different field masks
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (COMP8.4)
**File**: `src/handlers/composite.ts:1059`, `composite.ts:1111`

`clone_structure` calls `spreadsheets.get()` twice — once for structure and once for properties — with different field masks. ISSUE-046 covers `setup_sheet`'s double fetch (COMP8.3); this is a different action (COMP8.4).

**Fix**: Combine into a single `spreadsheets.get()` with a merged field mask covering both structure and properties.

---

### ISSUE-129: [FALSE ALARM] `analyze.ts` — `suggest_visualization` doesn't distinguish Sampling errors from parse errors
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (AN9.1)
**File**: `src/handlers/analyze.ts:413-427`

The catch block treats `SAMPLING_UNAVAILABLE` errors the same as JSON parse failures. Clients cannot distinguish "AI is down, retry later" from "AI returned malformed JSON."

**Fix**: Add a guard: `if (error instanceof SamplingUnavailableError) return degradedResponse(...)`. Log `PARSE_ERROR` for JSON failures. Separate code paths give clients actionable retry guidance.

---

### ISSUE-130: [FALSE ALARM] `analyze.ts` — visualization data re-fetched for each suggestion type (no caching)
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (AN9.2)
**File**: `src/handlers/analyze.ts:325-330`

`readData()` is called once per suggestion type. If 5 types are evaluated, the same range is fetched 5 times from the same spreadsheet.

**Fix**: Call `readData()` once before the suggestion loop; pass the cached result to each evaluator.

---

### ISSUE-131: [FALSE ALARM] `fix.ts` — preview→apply transition has no re-confirmation when >5 operations
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (FIX10.2)
**File**: `src/handlers/fix.ts:131-133`

After previewing a cleaning run, applying it skips confirmation even when the operation count is large. Users may apply more changes than they reviewed.

**Fix**: If `mode === 'apply'` and `changes.length > CLEAN_CONFIRM_THRESHOLD` (default 5, configurable), call `confirmDestructiveAction({ description: `Apply ${changes.length} cleaning operations`, impact: ... })`.

---

### ISSUE-132: [FALSE ALARM] `fix.ts` — `executeOperation` catch doesn't include operation ID in error
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (FIX10.4)
**File**: `src/handlers/fix.ts:782`

Per-operation error catch throws a generic error without `op.id` or `op.type`. Users cannot tell which cleaning operation failed in a multi-operation batch.

**Fix**: Add `{ operationId: op.id, operationType: op.type }` to error context before rethrowing.

---

### ISSUE-133: [FALSE ALARM] `appsscript.ts` — `executeWithRetry` wrapping `circuitBreaker` creates double retry
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (AS13.3)
**File**: `src/handlers/appsscript.ts:291-334`

The circuit breaker already handles retries internally. Wrapping it in `executeWithRetry()` creates double retry behavior — a transient failure can be retried by both layers, doubling API calls and unpredictably consuming quota.

**Fix**: Either use `executeWithRetry` alone (without circuit breaker) or use the circuit breaker's built-in retry config (without `executeWithRetry`). Pick one retry mechanism per call site.

---

### ISSUE-134: [FALSE ALARM] `appsscript.ts` — error type guard missing `typeof code === 'string'` check
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (AS13.5)
**File**: `src/handlers/appsscript.ts:328`

Error type guard checks for `error.code` but does not verify `typeof error.code === 'string'` before string operations. If `error.code` is a number (HTTP status), string comparison silently fails.

**Fix**: Add `typeof error.code === 'string' &&` before string comparison.

---

### ISSUE-135: [FALSE ALARM] `dependencies.ts` — `create_scenario_sheet` has no cell count cap
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (DEP16.5)
**File**: `src/handlers/dependencies.ts:591-603`

Very large scenarios (>10,000 cells) exceed batchUpdate limits and may produce excessively large sheets. No validation or cap exists.

**Fix**: Before writing, compute `totalCells = rows * columns`. If `totalCells > 10_000`, return `OPERATION_LIMIT_EXCEEDED` with guidance to narrow the output range.

---

### ISSUE-136: [FALSE ALARM] `quality.ts` — response has dual `success: true` + `valid: false` (ambiguous top-level status)
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (QL17.2)
**File**: `src/handlers/quality.ts:119-122`

The `validate` response returns both `success: true` (tool succeeded) and `valid: false` (data is invalid). Clients parsing the top-level `success` field conclude "everything is fine" when validation found critical issues.

**Fix**: Move `valid` to a semantic result field under `data`, not at the response root alongside `success`. Document: `success` means "the tool ran correctly"; `valid` means "the data passed validation."

---

### ISSUE-137: [FIXED-PRE] `session.ts` — `set_pending`/`get_pending` type mismatch (stored vs returned shape)
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (SES19.2)
**File**: `src/handlers/session.ts:304`, `session.ts:315`

`set_pending` stores data as one type; `get_pending` returns it typed differently. `PendingOperationResponse` type is missing or mismatched. ISSUE-035 covers `as unknown` casts broadly; this specific named-type mismatch needs its own fix.

**Fix**: Create `PendingOperationSchema` in `src/schemas/session.ts`. Use it for both the store input and get output. Add a round-trip test.

---

### ISSUE-138: [FIXED-PRE] `session.ts` — `referenceType` accepts `string` but should be a discriminated union
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (SES19.3)
**File**: `src/handlers/session.ts:220`

`find_by_reference` accepts `referenceType: string` — cannot be narrowed at the type level. Misspelled or invalid reference types fall through to a runtime error.

**Fix**: Add `ReferenceTypeSchema = z.enum(['spreadsheet', 'sheet', 'range', 'cell', ...])` in `src/schemas/session.ts`. Use it in `find_by_reference` input schema.

---

### ISSUE-139: [DONE] `transaction.ts` — no hard limit on queued operation count
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (TXN20.1)
**File**: `src/handlers/transaction.ts:106-114`

Warns at 50 operations but allows unlimited queuing. A transaction with 1,000 operations that fails at op 700 cannot be cleanly replayed. No rollback checkpoint exists mid-transaction.

**Fix**: Add `MAX_TRANSACTION_OPS = 200` (env-configurable). When exceeded, reject with `OPERATION_LIMIT_EXCEEDED`. Add a `checkpointInterval` parameter for mid-transaction snapshots.

---

### ISSUE-140: [FALSE ALARM] `webhooks.ts` — duplicate URL registration silently allowed
**Severity**: MEDIUM | **Source**: Handler_Analysis §4.1 (WH22.1)
**File**: `src/handlers/webhooks.ts:150-156`

Registering two webhooks with identical endpoint URLs is silently allowed, causing duplicate event delivery for every trigger.

**Fix**: Before registration, check for existing webhook with same URL. If found, return `CONFLICT` error with the existing webhook's ID.

---

### C. MEDIUM-SEVERITY — INFRASTRUCTURE & PIPELINE

---

### ISSUE-141: [FIXED-PRE] `base.ts` — metadata fetch in sheet property resolution has no field mask
**Severity**: MEDIUM | **Source**: Handler_Analysis §5.5 (INF-API-01)
**File**: `src/handlers/base.ts:1179-1220`

The metadata resolution path fetches full spreadsheet metadata without field limits. For spreadsheets with 50+ sheets, this returns MB-scale JSON. ISSUE-019 covers `list_chips` specifically; this is shared `base.ts` infrastructure used by all 13 BaseHandler subclasses.

**Fix**: Add `fields: 'sheets(properties(title,sheetId,index,gridProperties))'` to the metadata fetch in the resolution path. Cache result for 30s.

---

### ISSUE-142: [FIXED-PRE] `base.ts` — `getSheetId` fallback re-fetches metadata that's already in `metadataCache`
**Severity**: MEDIUM | **Source**: Handler_Analysis §5.5 (INF-API-02)
**File**: `src/handlers/base.ts:1315-1414`

When `getSheetId()` fails to resolve via cache, the fallback path makes a fresh `spreadsheets.get()` call even though `metadataCache` has the data.

**Fix**: In the fallback path, try `metadataCache.get(spreadsheetId)?.sheets` first before making a new API call.

---

### ISSUE-143: [FIXED-PRE] `retry.ts` — HTTP/2 GOAWAY detection uses fragile `error.message` string matching
**Severity**: MEDIUM | **Source**: Handler_Analysis §41.3
**File**: `src/utils/retry.ts:147`

HTTP/2 GOAWAY detection checks `error.message.includes('nghttp2_refused_stream')`. If Google changes the error format, the detection silently fails and GOAWAY errors are not retried. ISSUE-044 covers `mapGoogleApiError` in `base.ts` — this is a different file and mechanism.

**Fix**: Replace message-string detection with `error.code === 'ERR_HTTP2_STREAM_CANCEL' || error.errno === 'ECONNRESET'` checks, which are stable Node.js error codes.

---

### ISSUE-144: [FIXED-PRE] `shared.ts` — `RangeInputSchema` (SCH-05): handlers advertise 4 variants but support only 1-2
**Severity**: MEDIUM | **Source**: Handler_Analysis §6.1 (SCH-05), Implementation_Guide T5 §6.4b
**File**: `src/schemas/shared.ts:895-909`

`RangeInputSchema` accepts 4 variants (A1 string, object with start/end coords, named range reference, sheet-scoped object) but individual handlers silently ignore unsupported variants, returning confusing errors.

**Fix**: Audit which handlers declare `RangeInputSchema` but only handle a subset. Add explicit `NOT_SUPPORTED` error with guidance for unhandled variants. Or narrow the schema per-handler to the actually-supported variants.

---

### ISSUE-145: [FIXED-PRE] `shared.ts` / Zod — `A1NotationSchema` accepts full column refs (`A:Z`) that fetch 10M+ cells
**Severity**: MEDIUM | **Source**: Handler_Analysis §41.3, Implementation_Guide T5 §6.4e
**File**: `src/schemas/shared.ts:146`

`A1NotationSchema` accepts `Sheet1!A:Z` (full column reference). NC-12 prohibits this as a developer constraint, but the schema itself doesn't reject it at runtime. An LLM constructing a request with `A:Z` passes Zod validation and triggers a full-grid fetch. This is a schema-layer enforcement gap distinct from NC-12 (a developer rule).

**Fix**: Add `.refine(val => !/^[A-Z]+:[A-Z]+$/.test(val.split('!').pop() ?? ''), { message: 'Full column refs not allowed. Use bounded ranges like A1:Z1000.' })` to `A1NotationSchema`.

---

### ISSUE-146: [DONE] `event-store` — silent degradation on expired/unknown cursor
**Severity**: MEDIUM | **Source**: Handler_Analysis §39/§42
**File**: `src/mcp/event-store.ts`

When a client reconnects with a cursor that's been evicted from the 5K FIFO buffer (e.g., after a long disconnect), the event store silently degrades instead of returning a structured error. The client has no way to know its cursor expired.

**Fix**: When cursor is not found, return `{ error: 'CURSOR_EXPIRED', message: 'Cursor has been evicted; re-initialize from current state' }`. Client should then call `spreadsheets.get()` to rebuild state.

---

### ISSUE-147: [DONE] `ConflictDetector` — server-side per-range async mutex added
**Severity**: MEDIUM | **Source**: Handler_Analysis §40.1
**File**: `src/services/conflict-detector.ts`

`ConflictDetector` uses version-based optimistic locking, but no server-side mutex prevents two concurrent writes from reading the same version number and both succeeding. Under parallel tool calls, silent data corruption is possible.

**Fix**: Implement advisory locks using Google Sheets developer metadata (`createDeveloperMetadata` with `visibility: 'PROJECT'`) or an in-process `AsyncMutex` (per spreadsheetId) for local single-instance deployments.

---

### ISSUE-148: [FALSE ALARM] Circuit breaker — fixed 30s reset with no adaptive behavior under sustained failure
**Severity**: MEDIUM | **Source**: Handler_Analysis §40.1, Implementation_Guide T11 §12.7
**File**: `src/utils/circuit-breaker.ts`

Under sustained degradation, repeated half-open probe failures don't increase the reset timeout. This creates continuous 30s-probe-fail → 30s-probe-fail cycles that hammer a degraded API. ISSUE-104 covers testing that `readOnlyMode` triggers; this covers the missing adaptive recovery.

**Fix**: Implement exponential backoff for the reset timeout: `30s → 60s → 120s → 300s` (cap 5 min). Require 3 consecutive probe successes before full close.

---

### ISSUE-149: [DONE] Retry-after hints missing — clients have no guidance on when to retry
**Severity**: MEDIUM | **Source**: Handler_Analysis §32.1
**File**: `src/utils/circuit-breaker.ts`, `src/services/concurrency-coordinator.ts`

When the circuit breaker is open or the request queue is full, generic errors are returned. LLM clients have no way to know when the service will recover.

**Fix**: Include `retryAfter: number` (seconds) in error metadata. Circuit breaker returns time until next probe window; queue returns estimated drain time based on current queue depth and processing rate.

---

### ISSUE-150: [DONE] Request prioritization implemented — weighted fast/slow lanes in concurrency coordinator
**Severity**: MEDIUM | **Source**: Handler_Analysis §32.1
**File**: `src/services/concurrency-coordinator.ts`

All MCP requests share the same concurrency queue. A long-running `comprehensive` analysis blocks quick `read` or `session` operations queued behind it.

**Fix**: Add two PQueue priority lanes: `'fast'` (reads, metadata, session, auth) and `'slow'` (analysis, bulk writes, BigQuery, appsScript). Fast lane gets 3× weight in scheduling.

---

### D. MEDIUM-SEVERITY — MCP PROTOCOL & CLIENT INTEGRATION

---

### ISSUE-151: [FIXED-PRE] Client capability probe missing before using Sampling/Tasks/Elicitation
**Severity**: MEDIUM | **Source**: Handler_Analysis §27.1, Implementation_Guide
**Related**: ISSUE-107 (deprecation metadata — different direction)

Sampling/Tasks/Elicitation silently fail or hang when the MCP client doesn't support them. No probe of client capabilities occurs before use. ISSUE-107 addresses sending deprecation notices *from* server *to* client; this is about checking *client* capabilities *before* calling advanced features.

**Fix**: In `server.ts`'s `initialize()` handler, capture and store `clientCapabilities`. Before each `server.createMessage()` or `tasks.create()` call, check the relevant capability flag. If absent, skip to the fallback path rather than attempting the call.

---

### ISSUE-152: [FIXED-PRE] Knowledge base files referenced in `resource-registration.ts` don't exist
**Severity**: MEDIUM | **Source**: Handler_Analysis §29.1
**File**: `src/mcp/registration/resource-registration.ts`

MCP Resources are registered pointing to knowledge base files (for LLM context) that don't exist in the repository. Clients requesting these resources receive 404-equivalent responses.

**Fix**: Either create the knowledge base files (`docs/knowledge/`) with appropriate content, or remove the resource registrations until the files exist.

---

### ISSUE-153: [DONE] Progress reporting not wired to `transaction.commit` or `core.batch_get`
**Severity**: MEDIUM | **Source**: Implementation_Guide T7 §8.3
**Related**: ISSUE-025 (infrastructure gap — no actual progress streaming)

ISSUE-025 covers the infrastructure (sendProgress not streaming). The Implementation Guide's step 8.3 specifies per-handler wiring for `transaction.commit` (for commits with 50+ operations) and `core.batch_get` (every 20 ranges for 100+ range batches). These two specific wiring targets are not called out in any issue.

**Fix**: After ISSUE-025 is resolved, add `sendProgress()` calls in `transaction.ts:commit` and `core.ts:batch_get` at the specified intervals.

---

### ISSUE-154: [DONE] Session context wiring missing for `sheets_format` formatting preferences
**Severity**: MEDIUM | **Source**: Implementation_Guide T7 §8.4
**Related**: ISSUE-069 (lists 7 handlers — `sheets_format` is NOT in the table)

ISSUE-069 lists 7 handlers for session context wiring. `sheets_format` is absent from the table despite the Implementation Guide explicitly calling it out: "Remember formatting preferences (header style, number format) per spreadsheet."

**Fix**: In `suggest_format` and `set_format`, call `sessionContext.recordOperation({ tool: 'sheets_format', spreadsheetId, preferredStyle })`. In subsequent calls, read back and apply the preference if no style is specified.

---

### E. MEDIUM-SEVERITY — GOOGLE API EFFICIENCY

---

### ISSUE-155: [DONE] `collaborate.ts` — Drive API calls missing `fields` parameter (all share/comment/version ops)
**Severity**: MEDIUM | **Source**: Handler_Analysis §34.1
**File**: `src/handlers/collaborate.ts`

All Drive API calls in `collaborate.ts` for `share_*`, `comment_*`, and `version_*` operations are missing `fields` masks. Full Drive resource representations are returned (5-10× larger than needed). NC-13 is the constraint; no dedicated issue tracks `collaborate.ts` specifically.

**Fix**: Add minimal `fields` masks to every Drive API call in `collaborate.ts`. Reference: `fields: 'id,kind,role,emailAddress'` for permissions; `fields: 'id,content,author,modifiedTime'` for comments.

---

### ISSUE-156: [DONE] `batch_read` + `batch_write` validation fetches spreadsheet metadata redundantly
**Severity**: MEDIUM | **Source**: Handler_Analysis §34.1
**File**: `src/handlers/data.ts`

Both `batch_read` and `batch_write` fetch spreadsheet metadata for validation before the actual batch call. This doubles the metadata API calls for every batch operation.

**Fix**: Cache metadata for a 5-second window within the same request context using the existing `metadataCache`. Pass the cached result to both the validation and batch call phases.

---

### ISSUE-157: [FALSE ALARM] `cross-spreadsheet.ts` — `cross_read` has no concurrency cap for 100+ sources
**Severity**: MEDIUM | **Source**: Handler_Analysis §6.2 (SVC-03)
**File**: `src/services/cross-spreadsheet.ts`

`cross_read` with many sources runs all fetches without a concurrency cap. 100+ sources would exhaust `ParallelExecutor`'s 20-request limit AND per-user Google API quota (60 req/min).

**Fix**: Route all source fetches through `ParallelExecutor` with `{ concurrency: 10, maxRetries: 2 }`. Add schema validation: `sources: z.array(...).max(50)` with a clear error for exceeding the cap.

---

### ISSUE-158: [FALSE ALARM] `suggestion-engine.ts` — session-context filters applied after full data fetch
**Severity**: MEDIUM | **Source**: Handler_Analysis §6.2 (SVC-02)
**File**: `src/analysis/suggestion-engine.ts`

Previously-rejected suggestions are filtered *after* running all 5 pattern detectors. For large sheets, full analysis runs even if 90% of suggestions would be excluded by session filters.

**Fix**: Pass the session context's rejected suggestion IDs into the pattern detectors as an early-exit condition. Skip any detector category the user has previously rejected 3+ times.

---

### F. MEDIUM-SEVERITY — SECURITY & AUTH

---

### ISSUE-159: [DONE] RBAC disabled by default with no setup guide — any authenticated user has full access
**Severity**: MEDIUM | **Source**: Handler_Analysis §24.2
**Related**: ISSUE-072 (per-action OAuth scope validation — different mechanism)

`ENABLE_RBAC=OFF` by default. Without RBAC, any authenticated token has access to all 340 actions including destructive operations (`delete_sheet`, `revert_to`, `clear`). No one-command RBAC setup path exists. ISSUE-072 covers per-action *OAuth scope* checks; RBAC is an application-layer access control system.

**Fix**: Either enable RBAC by default (with a permissive default role allowing all actions) or document `RBAC_SETUP.md` with the minimum role config for production deployment.

---

### ISSUE-160: [DONE] Proactive OAuth token rotation not implemented — tokens are long-lived
**Severity**: MEDIUM | **Source**: Handler_Analysis §24.2, Implementation_Guide T10 §11.5
**File**: `src/auth/encrypted-file-token-store.ts`
**Related**: ISSUE-001 (covers reactive refresh on session drop — this is proactive rotation)

Current token handling: refresh on failure. Best practice: pre-emptively refresh when token is within 10 minutes of expiry, and rotate (issue new refresh token, invalidate old one) on each use.

**Fix**: In the token refresh path, check `expiresAt - now < 600_000` (10 min). If approaching expiry, refresh proactively. Store the new refresh token from the response (Google issues a new one per use).

---

### ISSUE-161: [DONE] W3C trace context propagated outbound for webhooks and federation
**Severity**: MEDIUM | **Source**: Handler_Analysis §26.2, Implementation_Guide T10 §11.4
**Files**: `src/handlers/webhooks.ts`, `src/handlers/federation.ts`
**Related**: ISSUE-057 (validates *incoming* trace IDs — this is *outgoing* propagation)

When `sheets_webhook` delivers to remote URLs and `sheets_federation` calls remote MCP servers, `traceparent`/`tracestate` W3C headers are not forwarded. Distributed traces break at these boundaries.

**Fix**: Extract current trace context from `AsyncLocalStorage` and add `traceparent` + `tracestate` headers to all outbound HTTP requests in both handlers.

---

### ISSUE-162: [FALSE ALARM] Circuit breaker state transitions not alerted — operators can't detect degraded APIs
**Severity**: MEDIUM | **Source**: Handler_Analysis §26.2, Implementation_Guide T10 §11.4
**File**: `src/utils/circuit-breaker.ts`

When a circuit breaker transitions to open, no alert is emitted. Operators must poll metrics to discover that a downstream API (BigQuery, Apps Script, Drive) is in a degraded state.

**Fix**: On `closed→open` transition: emit `logger.error('circuit_breaker_opened', { breaker, failureCount })` + increment `servalsheets_circuit_breaker_opens_total` Prometheus counter. On `open→closed`: emit `logger.info('circuit_breaker_recovered', ...)`.

---

### ISSUE-163: [FALSE ALARM] OTLP exporter missing — no OpenTelemetry export for modern observability stacks
**Severity**: MEDIUM | **Source**: Handler_Analysis §26.2, Implementation_Guide T10 §11.4

Metrics are Prometheus-compatible but lack native OTLP export (Datadog, Honeycomb, Grafana Cloud use OTLP). No `OTEL_EXPORTER_OTLP_ENDPOINT` support exists.

**Fix**: Add `ENABLE_OTLP_EXPORT` feature flag. When set, initialize `@opentelemetry/exporter-trace-otlp-http` + `@opentelemetry/exporter-metrics-otlp-http` configured from `OTEL_EXPORTER_OTLP_ENDPOINT`. Guard behind flag to avoid dep bloat for users not needing it.

---

### ISSUE-164: [DONE] Request replay and failed-request capture implemented (`DEBUG_REQUEST_REPLAY`, `REPLAY_DIR`, replay CLI)
**Severity**: MEDIUM | **Source**: Implementation_Guide T10 §11.4

Failed MCP requests cannot be replayed. There's no debug mode that captures full request/response payloads. Distinct from idempotency (ISSUE-094), which is about deduplication — this is about reproducibility.

**Fix**: When `DEBUG_REQUEST_REPLAY=true`, serialize failed request payloads to `{REPLAY_DIR}/request-{timestamp}.json`. Add `npm run replay <path>` script that replays the captured request against the live server.

---

### G. MEDIUM-SEVERITY — GDPR & COMPLIANCE

---

### ISSUE-165: [DONE] GDPR Art. 15 — right of access not implemented
**Severity**: MEDIUM | **Source**: Implementation_Guide T1 §2.4
**Related**: ISSUE-090 (Art. 17 erasure + Art. 20 portability — covered), ISSUE-103 (Art. 7 consent)

Art. 15 requires that users can request all data held about them, with a formal structured response. `exportProfile()` (ISSUE-090) addresses Art. 20 (portability). Art. 15 requires an additional formal "data inventory" response listing *all* data categories held and why.

**Fix**: Add `sheets_session.request_data_access` action returning: `{ dataCategories: ['formulas', 'sheetContent', 'preferences', 'operationHistory', 'consentRecord'], retentionPolicies: {...} }`.

---

### ISSUE-166: [DONE] GDPR audit log entries lack data classification — can't distinguish PII from metadata
**Severity**: MEDIUM | **Source**: Handler_Analysis §33.1

`AuditLogger` records all operations but doesn't classify sensitivity. A log entry for "read cell A1 value = 'John Smith'" is stored identically to "read sheet title = 'Budget'". Cannot apply PII-aware retention policies without classification.

**Fix**: Add `dataSensitivity: 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'PII'` to audit log entries. Tag operations that access cell *values* as `PII` (potentially). Tag structure/metadata operations as `PUBLIC`. Apply separate retention periods by sensitivity level.

---

### H. MEDIUM-SEVERITY — TESTING & INTEGRATION

---

### ISSUE-167: [FALSE ALARM] No integration tests for the full MCP pipeline (STDIO→normalizeToolArgs→Zod→handler)
**Severity**: MEDIUM | **Source**: Handler_Analysis §20.2

All current tests mock at the handler level, bypassing the MCP pipeline layer entirely. A regression in `normalizeToolArgs()`, schema validation cache, or `buildToolResponse()` would not be caught by any test.

**Fix**: Create `tests/integration/mcp-pipeline.test.ts` that sends raw MCP JSON over stdio to a test server instance and asserts the full response. Test: envelope wrapping, Zod validation errors, output schema validation, error code passthrough.

---

### ISSUE-168: [FALSE ALARM] Error path coverage ~30% — most handlers test only happy paths
**Severity**: MEDIUM | **Source**: Handler_Analysis §20.2

The majority of tests cover success scenarios. Error conditions (invalid `spreadsheetId`, `insufficientPermissions`, rate limit, circuit breaker open, BigQuery quota exceeded) are untested in most handlers. ISSUE-076/077/078 cover *total test ratios* for specific tools; this tracks the systematic error-path gap.

**Fix**: Add a mandatory "error paths" test suite to the PR checklist. Target: ≥2 error-path tests per action (one for invalid input, one for Google API error). Add to `npm run test:fast` pass criteria: error path coverage ≥60%.

---

### ISSUE-169: [FALSE ALARM] 8 additional handlers with generic error messages (beyond `format.ts`)
**Severity**: MEDIUM | **Source**: Handler_Analysis §21.2
**Related**: ISSUE-101 (covers `format.ts`'s 34 generic messages)

ISSUE-101 addresses `format.ts`'s 34 generic `INVALID_PARAMS` messages. The Handler_Analysis identifies the same pattern in 8 additional handlers:

| Handler | Generic Pattern |
|---------|----------------|
| `data.ts` | "Operation failed" (5 write ops) |
| `dimensions.ts` | "Invalid dimension specification" |
| `advanced.ts` | "Named range error" |
| `visualize.ts` | "Chart operation failed" |
| `collaborate.ts` | "Sharing error" |
| `bigquery.ts` | "Query execution failed" |
| `appsscript.ts` | "Script error" |
| `webhooks.ts` | "Webhook operation failed" |

**Fix**: For each: replace generic message with field-specific, actionable error including the invalid value and expected format. Mirror the fix pattern from ISSUE-101.

---

### ISSUE-170: [FALSE ALARM] `suggest_format` returns `FEATURE_UNAVAILABLE` with no fallback
**Severity**: MEDIUM | **Source**: MCP_Test_Results Issue Log row 22
**Related**: ISSUE-068 (adding Sampling to suggest_format — that work is done in P13)

`suggest_format` was upgraded to use Sampling in P13-M3. However, when the client doesn't support Sampling (standard clients), the action returns hard `FEATURE_UNAVAILABLE` rather than degrading to pattern-based suggestions (which already exist in the codebase).

**Fix**: Add a `try/catch` around the Sampling call. On `SamplingUnavailableError`, fall through to the existing rule-based suggestion path. The pattern-based path should always produce some suggestions.

---

### ISSUE-171: [FIXED-PRE] `sheets_appsscript` — OAuth scope requirement undocumented (users get opaque 403)
**Severity**: MEDIUM | **Source**: MCP_Test_Results Test Coverage sheet row (18 actions, only 2 testable)
**Related**: ISSUE-008 (covers collaborate scope — different tool)

The Apps Script API requires a separate `https://www.googleapis.com/auth/script.projects` scope (and `script.deployments`, `script.processes` for full functionality). Only 2 of 18 actions work with default OAuth. Users get a 403 with no guidance.

**Fix**: Add the Apps Script scopes to the `RECOMMENDED_SCOPES` tier. Add a warning in the `sheets_appsscript` tool description: "Requires additional OAuth scopes — run `sheets_auth.login` with `scope: 'appsscript'` to enable."

---

### I. MEDIUM-SEVERITY — POST-RELEASE STRATEGIC INVESTMENTS

---

### ISSUE-172: [FALSE ALARM] Plugin architecture — manifest format, dynamic registration, sandboxing
**Severity**: MEDIUM | **Source**: Implementation_Guide T12 §13.2

No mechanism exists for extending ServalSheets with third-party tools without forking the codebase. The Implementation Guide defines a plugin system: manifest format, dynamic tool registration, middleware pipeline, event subscriptions, permission grants, `isolated-vm` or Worker thread sandboxing.

**Fix**: Design as a separate milestone. Start with a static plugin manifest loader (no dynamic registration), then add middleware hooks. Sandboxing via Worker threads is the safest approach.

---

### ISSUE-173: [DONE] Enterprise auth flow completed: OIDC discovery + CIMD/XAA token minting endpoint with tenant isolation wiring
**Severity**: MEDIUM | **Source**: Implementation_Guide T12 §13.1, Complete_Audit_Roadmap Track 12
**Related**: ISSUE-063 (Handler_Analysis mentions CIMD as LOW — upgrading to MEDIUM for enterprise priority)

Enterprise deployments prohibit per-user OAuth flows. CIMD (Client-Initiated Minting with Domain) + XAA (Cross-Account Authentication) are Google Workspace enterprise auth flows for service accounts and domain delegation. Without these, ServalSheets is effectively blocked from enterprise deployment.

**Fix**: Phase 1: OIDC discovery endpoint (~200 lines). Phase 2: CIMD auth flow (~500 lines). Gate behind `ENABLE_ENTERPRISE_AUTH` feature flag. The `ENABLE_TENANT_ISOLATION` flag exists but is unused; wire it as part of this work.

**Audit note (2026-02-27)**: closed. Added enterprise auth service (`src/services/enterprise-auth.ts`) implementing `urn:servalsheets:oauth:grant-type:cimd` and `urn:servalsheets:oauth:grant-type:xaa` token minting via delegated service-account JWT. Added HTTP endpoint `POST /oauth/enterprise/token` (`src/server/enterprise-auth.ts`) and registered it in HTTP server routing. Extended OIDC metadata (`src/server/well-known.ts`) to advertise enterprise grant types + enterprise token endpoint metadata, with tenant isolation requirement signal. Added env schema support for enterprise auth flags (`src/config/env.ts`). Verification: `tests/services/enterprise-auth.test.ts`, `tests/server/enterprise-auth.test.ts`, `tests/server/well-known.test.ts`, `npm run typecheck`, `npm run validate:alignment`, `npm run check:drift` all pass.

---

### ISSUE-174: [DONE] Added `sheets_analyze.semantic_search` with session-scoped vector index + cosine matching
**Severity**: MEDIUM | **Source**: Implementation_Guide T12 §13.7, Strategic_Roadmap Track 3

Find `"revenue data"` without knowing column names. No embedding-based search exists. This is the most impactful AI capability gap vs Claude in Excel.

**Fix**: Add `sheets_analyze.semantic_search` action. Generate embeddings for sheet headers + first 10 values per column via Sampling. Store in session context. Search via cosine similarity. ~300 lines.

---

### ISSUE-175: [DONE] Connector groundwork completed (`DATA_CONNECTORS.md` + `cross_query` connector ID normalization)
**Severity**: MEDIUM | **Source**: Competitive_Analysis §5.1, Strategic_Roadmap Track 2

Claude in Excel connects to S&P, LSEG, FactSet, and Moody's. ServalSheets has no data connectors. The strategic roadmap proposes federation-based connectors via `sheets_federation.call_remote` to existing MCP wrappers (Alpha Vantage, FRED, Polygon.io — all already have MCP servers).

**Fix**: Phase 1: Document connector pattern for `sheets_federation`. Create `docs/guides/DATA_CONNECTORS.md` listing tested MCP wrappers. Add `connector_id` field to `cross_query` schema. This requires zero new API calls — just routing via existing federation layer.

---

### J. LOW-SEVERITY — HANDLER CODE QUALITY

---

### ISSUE-176: [FALSE ALARM] `core.ts` — switch exhaustiveness check placed after switch block, not inside default case
**Severity**: LOW | **Source**: Handler_Analysis §4.1 (C1.1)
**File**: `src/handlers/core.ts`

The `as unknown as never` exhaustiveness check is placed after the switch statement body, not as the `default:` case. TypeScript only enforces the never type narrowing when the check is *inside* the switch default.

**Fix**: Move the check inside the `default:` case of the switch statement.

---

### ISSUE-177: [DONE] `data.ts` — timeout detection uses `error.message` string matching instead of `error.code`
**Severity**: LOW | **Source**: Handler_Analysis §4.1 (D2.4)
**File**: `src/handlers/data.ts:1587-1598`

Checks `error.message.includes('timed out')` instead of `error.code === 'DEADLINE_EXCEEDED'`. Locale-dependent and breaks on non-English Google error responses. ISSUE-044 covers the same pattern in `base.ts`; this is a separate location.

**Fix**: Replace string check with `error.code === 'DEADLINE_EXCEEDED'`.

---

### ISSUE-178: [FALSE ALARM] `data.ts` — `batch_write` response `warnings` field included inconsistently
**Severity**: LOW | **Source**: Handler_Analysis §4.1 (D2.6)
**File**: `src/handlers/data.ts`

Some `batch_write` response paths include a `warnings` field; others omit it entirely. Clients can't reliably check for warnings.

**Fix**: Always include `warnings: string[]` (empty array if none) in all `batch_write` response paths.

---

### ISSUE-179: [DONE] `format.ts` — preset RGB values hardcoded inline across 15+ cases
**Severity**: LOW | **Source**: Handler_Analysis §4.1 (F3.3)
**File**: `src/handlers/format.ts:1524-1640`

Every preset (`bold_red`, `header_blue`, etc.) has RGB values inline. Updating a color requires 15+ edits.

**Fix**: Extract `const PRESET_FORMATS: Record<PresetName, ColorSpec>` at module top level. Reference in preset cases.

**Audit note (2026-02-26)**: closed. Added `PRESET_COLORS` constant to `format.ts`; all 6 inline RGB values in `handleApplyPreset` replaced with references to `PRESET_COLORS.*`.

---

### ISSUE-180: [FALSE ALARM] `dimensions.ts` — `list_slicers` response omits full slicer spec
**Severity**: LOW | **Source**: Handler_Analysis §4.1 (DIM4.2)
**File**: `src/handlers/dimensions.ts:1502-1518`

`list_slicers` returns slicer IDs and basic info but omits filter criteria, range, and visual settings.

**Fix**: Include full `slicer.spec` in the list response — or add `include_full_spec: boolean` parameter.

---

### ISSUE-181: [FALSE ALARM] `advanced.ts` — `mapNamedFunction()` not extracted as shared helper
**Severity**: LOW | **Source**: Handler_Analysis §4.1 (A5.5)
**File**: `src/handlers/advanced.ts`

Different action paths format named function responses differently. Extract shared `mapNamedFunction(fn: Schema$NamedFunction): MappedNamedFunction` helper.

---

### ISSUE-182: [FALSE ALARM] `visualize.ts` — `chart_add_trendline` deprecation warning missing at handler level
**Severity**: LOW | **Source**: Handler_Analysis §4.1 (V6.3)
**File**: `src/handlers/visualize.ts:837-904`
**Related**: Session notes A4 (descriptions.ts note added) — handler-level warning still missing

The API doc note was added in Session 35/A4. The handler itself should also include a `_deprecationWarning` field in the response and log at `logger.warn` level on each call.

**Fix**: Add `_deprecationWarning: 'chart_add_trendline is deprecated; use chart_update with a trendline configuration instead'` to the response object.

---

### ISSUE-183: [FALSE ALARM] `collaborate.ts` — `version_export` response shape inconsistent with `version_get_revision`
**Severity**: LOW | **Source**: Handler_Analysis §4.1 (COL7.6)
**File**: `src/handlers/collaborate.ts:1180-1182`

`version_export` returns a different response shape than `version_get_revision`. Clients need separate parsing logic.

**Fix**: Align `version_export` response to include `revisionId`, `modifiedTime`, `lastModifyingUser` fields matching the `version_get_revision` structure.

---

### ISSUE-184: [FALSE ALARM] `composite.ts` — `bulk_update` catch block doesn't log which operation failed
**Severity**: LOW | **Source**: Handler_Analysis §4.1 (COMP8.2)
**File**: `src/handlers/composite.ts:369`

Error catch in `bulk_update` doesn't include the operation index or ID. User can't tell which of N operations caused the failure.

**Fix**: Add `{ operationIndex: i, operationId: op.id }` to error context.

---

### ISSUE-185: [DONE] `analyze.ts` — `convertRangeInput()` returns `undefined` in 3 call sites without null checks
**Severity**: LOW | **Source**: Handler_Analysis §4.1 (AN9.3)
**File**: `src/handlers/analyze.ts`

Three call sites pass `convertRangeInput()` result directly to range-expecting functions without handling the `undefined` case.

**Fix**: Add null checks: `const range = convertRangeInput(input.range); if (!range) throw new ValidationError('Invalid range input');`.

---

### ISSUE-186: [DONE] `templates.ts` — folder move error only logs warning, not returned in response
**Severity**: LOW | **Source**: Handler_Analysis §4.1 (TPL11.4)
**File**: `src/handlers/templates.ts:480-486`

When a template folder move fails, only `logger.warn()` is emitted. The response doesn't include the error, so the caller assumes the move succeeded.

**Fix**: Add `moveError: string | null` to the response. Return the error message when the move fails.

---

### ISSUE-187: [FALSE ALARM] `bigquery.ts` — unsafe `(error as SomeType).field` cast without optional chaining
**Severity**: LOW | **Source**: Handler_Analysis §4.1 (BQ12.3)
**File**: `src/handlers/bigquery.ts:486`

Direct cast without checking if the cast is valid. If the error has a different shape, accessing `.field` throws.

**Fix**: Use optional chaining: `(error as SomeType)?.field ?? fallbackValue`.

---

### ISSUE-188: [DONE] `bigquery.ts` — `MAX_BIGQUERY_RESULT_ROWS = 100_000` hardcoded in two places
**Severity**: LOW | **Source**: Handler_Analysis §4.1 (BQ12.4)
**File**: `src/handlers/bigquery.ts:343`, `bigquery.ts:443`

**Fix**: Extract `const MAX_BIGQUERY_RESULT_ROWS = parseInt(process.env.MAX_BIGQUERY_RESULT_ROWS ?? '100000', 10)`.

---

### ISSUE-189: [DONE] `confirm.ts` — `message` field present in some response paths, absent in others
**Severity**: LOW | **Source**: Handler_Analysis §4.1 (CFM15.3)
**File**: `src/handlers/confirm.ts:218-220`

**Fix**: Declare `message: z.string().default('')` in `ConfirmResponseSchema`. All response paths always include it.

**Audit note (2026-02-25)**: closed. `ConfirmResponseSchema` now declares `message: z.string().default('')`, and schema tests verify defaulting behavior.

---

### ISSUE-190: [DONE] `transaction.ts` — `_meta` field conditionally assigned, schema may not declare it optional
**Severity**: LOW | **Source**: Handler_Analysis §4.1 (TXN20.3)
**File**: `src/handlers/transaction.ts:122`, `transaction.ts:272-288`

**Fix**: Verify `_meta?: object` is declared as optional in `TransactionSchema`. Add a test exercising both the present and absent `_meta` code paths.

---

### ISSUE-191: [DONE] `webhooks.ts` — data wrapper inconsistency across response paths (some flat, some nested under `data`)
**Severity**: LOW | **Source**: Handler_Analysis §4.1 (WH22.3)
**File**: `src/handlers/webhooks.ts:157-204`

**Fix**: Standardize all webhook responses to `{ success: true, action, webhook: { id, url, ... } }`. Remove the inconsistent `data` wrapper.

---

### ISSUE-192: [DONE] `base.ts` — API error traces lack span attributes (`spreadsheetId`, `action`, `range`)
**Severity**: LOW | **Source**: Handler_Analysis §5.3 (ERR-03)
**File**: `src/handlers/base.ts:326-366`

When an API call fails, the error trace doesn't include context attributes. Distributed traces show the error but not the affected spreadsheet or action.

**Fix**: Add `span.setAttributes({ spreadsheetId, action, range })` before the API call. Call `span.recordException(error)` in the catch block.

**Audit note (2026-02-25)**: closed. `instrumentedApiCall()` now sets `spreadsheet.id`, `spreadsheetId`, `action`, and `range`, explicitly records exceptions in the catch path, and is wired into shared BaseHandler API helpers (`fetchComprehensiveMetadata`, `validateGridDataSize`, `getSheetId` fallback).

---

### ISSUE-193: [DONE] `tool-handlers.ts` — error details forwarded without redacting file paths or stack traces
**Severity**: LOW | **Source**: Handler_Analysis §5.4 (SEC-02)
**File**: `src/mcp/registration/tool-handlers.ts:650`

Internal file system paths (e.g., `/home/user/.config/servalsheets/...`) or stack traces may appear in error details forwarded to MCP clients. ISSUE-057 covers trace ID injection; this is error detail leakage.

**Fix**: In the error forwarding path, strip `stack`, filter path-like strings matching `/home/`, `/Users/`, `node_modules/`, etc.

---

### ISSUE-194: [DONE] `env.ts` — no startup warning when `HOST` is public IP with `RBAC=OFF`
**Severity**: LOW | **Source**: Handler_Analysis §5.4 (SEC-03)
**File**: `src/config/env.ts`

When `HOST=0.0.0.0` (public) and `ENABLE_RBAC=false`, the server is effectively open to any network client. No startup warning is emitted.

**Fix**: On startup, if `HOST !== '127.0.0.1' && HOST !== 'localhost' && !ENABLE_RBAC`, emit `logger.warn('SECURITY: Server exposed on public interface with RBAC disabled')`.

---

### ISSUE-195: [DONE] `shared.ts` — `ResponseMetaSchema.snapshot` duplicates `MutationSummarySchema.snapshot`
**Severity**: LOW | **Source**: Handler_Analysis §6.1 (SCH-08)
**File**: `src/schemas/shared.ts:994-1002`

Two schemas define `snapshot` with potentially different types. A single response may have two different `snapshot` fields at different levels.

**Fix**: Have one schema extend the other, or reference a single `SnapshotReferenceSchema` from both.

**Audit note (2026-02-25)**: closed. `MutationSummarySchema` now carries only `revertSnapshotId`; snapshot object metadata lives in `ResponseMetaSchema` and no duplicate `snapshot` field remains.

---

### K. LOW-SEVERITY — GOOGLE API INTEGRATION GAPS

---

### ISSUE-196: [DONE] `dimensions.ts` — `duplicate_filter_view` action not exposed (API supports it)
**Severity**: LOW | **Source**: Handler_Analysis §16.1

`DuplicateFilterViewRequest` exists in the Google Sheets batchUpdate API. Not exposed as a `sheets_dimensions` action despite being ~20 lines to implement.

**Fix**: Add `duplicate_filter_view` to `sheets_dimensions` schema and handler.

**Audit note (2026-02-25)**: closed. action is now wired in `dimensions` schema + handler switch + filter-view handlers, metadata generation reports `sheets_dimensions: 29` actions, and dedicated handler tests cover success and dry-run paths.

---

### ISSUE-197: [DONE] `collaborate.ts` — `version_export` supports PDF options (orientation, margins, scale)
**Severity**: LOW | **Source**: Handler_Analysis §16.1

Drive API PDF export supports page orientation, margins, scale percentage, fit-to-width, gridlines, notes, page order, and named range print area. `version_export` may not expose all these parameters.

**Fix**: Extend `version_export` schema with `pdfOptions?: { pageOrientation?, margins?, scale?, fitToWidth?, printGridlines? }`.

---

### ISSUE-198: [DONE] `visualize.ts` — chart axis customization exposed (min/max, log scale, reversed)
**Severity**: LOW | **Source**: Handler_Analysis §16.1

The API supports detailed axis configuration: custom min/max bounds, log scale, reversed direction, custom tick intervals, axis title formatting. `chart_create`/`chart_update` schemas may not expose all axis options.

**Fix**: Expand `ChartAxisSchema` with `min?, max?, logScale?, reversed?, tickInterval?, titleFormat?`.

---

### ISSUE-199: [DONE] `bigquery.ts` Connected Sheets audit completed with gap list (`docs/analysis/BIGQUERY_CONNECTED_SHEETS_GAP_AUDIT.md`)
**Severity**: LOW | **Source**: Handler_Analysis §16.1

Sheets API supports `DataSourceTable` objects that auto-refresh from BigQuery/Looker. These may offer capabilities beyond the current `connect`/`query` actions. Not audited against current implementation.

**Fix**: Read the `DataSourceTable` API spec and compare against current `sheets_bigquery` actions. Create a gap list.

---

### ISSUE-200: [FALSE ALARM] No pre-check for approaching 10M cell limit on large batch writes
**Severity**: LOW | **Source**: Handler_Analysis §16.2

Google Sheets hard limit is 10,000,000 cells. Large `batch_write` or `append` operations don't estimate the resulting cell count before execution — operations fail with a cryptic API error at the limit.

**Fix**: Before large write operations, call `spreadsheets.get({ fields: 'sheets(properties(gridProperties))' })` and compute `existingCells + newCells`. If approaching 9.5M, warn. If exceeding 10M, return `OPERATION_LIMIT_EXCEEDED`.

---

### ISSUE-201: [DONE] Drive revision `keepForever` 30-day auto-purge not documented in time-travel actions
**Severity**: LOW | **Source**: Handler_Analysis §16.1, §18.1

Drive auto-purges revisions older than 30 days unless `keepForever=true`. `timeline` and `diff_revisions` will silently lose historical data without pinning. `version_keep_revision` action exists but this limitation is not surfaced in `timeline` or `diff_revisions` descriptions.

**Fix**: Add to `timeline` and `diff_revisions` parameter descriptions: "Note: Google Drive auto-deletes revisions older than 30 days unless pinned with `version_keep_revision`. Old timeline entries may be unavailable."

---

### ISSUE-202: [DONE] Drive shortcuts not transparently resolved — operations fail with opaque errors
**Severity**: LOW | **Source**: Handler_Analysis §18.1

When a `spreadsheetId` is actually a Drive shortcut ID, operations fail with opaque errors instead of transparently resolving to the target file.

**Fix**: In `core.ts`'s initial spreadsheet fetch, check `file.mimeType === 'application/vnd.google-apps.shortcut'` and resolve `file.shortcutDetails.targetId` before proceeding.

**Audit note (2026-02-25)**: closed. `SheetsCoreHandler` now resolves shortcut IDs before single-ID operations and within `batch_get`; core handler tests validate shortcut-to-target resolution behavior.

---

### ISSUE-203: [DONE] Apps Script — 20 concurrent executions limit not tracked by `ConcurrencyCoordinator`
**Severity**: LOW | **Source**: Handler_Analysis §18.2
**Related**: ISSUE-111 (covers 6-min/90-min limits — this is concurrent execution limit, a different quota)

Apps Script allows only 20 simultaneous executions per user. `ConcurrencyCoordinator` manages Sheets API quotas but not this separate Apps Script limit.

**Fix**: Add an Apps Script-specific semaphore (max 15 concurrent, leaving buffer) in `ConcurrencyCoordinator`. Reject additional `appsscript.run` calls with `QUOTA_EXCEEDED` when limit is reached.

**Audit note (2026-02-26)**: closed. Added `static activeRunExecutions = 0` and `MAX_CONCURRENT_RUNS = 15` to `SheetsAppsScriptHandler`. Gate check at start of `handleRun` returns `QUOTA_EXCEEDED` with `retryAfterMs: 30000`; try/finally ensures slot is always released.

---

### ISSUE-204: [DONE] Apps Script — `create` schema should default to V8 runtime (Rhino deprecated)
**Severity**: LOW | **Source**: Handler_Analysis §18.2, Implementation_Guide T12 §13.5

Apps Script V8 runtime is now default; legacy Rhino is deprecated. `appsscript.create` doesn't specify a runtime, potentially creating Rhino scripts.

**Fix**: Add `runtime?: 'V8' | 'DEPRECATED_ES5'` to `appsscript.create` schema with default `'V8'`. Document Rhino deprecation in schema description.

**Audit note (2026-02-25)**: closed. `CreateProjectActionSchema.runtimeVersion` defaults to `V8`, and schema tests verify `SheetsAppsScriptInputSchema` parses `create` requests with runtime defaulting correctly.

---

### ISSUE-205: [DONE] Apps Script — BigQuery Advanced Service enablement not checked before use
**Severity**: LOW | **Source**: Handler_Analysis §18.2

If an Apps Script function uses the BigQuery Advanced Service and that service isn't enabled, `appsscript.run` fails with a cryptic error. No pre-flight check exists.

**Fix**: When `run` is called with a script that references BigQuery, check `projects.advancedServices` for the BigQuery service. If not enabled, return actionable error: "Enable BigQuery Advanced Service in Apps Script Editor before calling this function."

**Audit note (2026-02-26)**: closed. Post-execution error detection: when `result.error` contains "BigQuery is not defined" (ReferenceError from Apps Script), the error message is augmented with actionable instructions to enable the BigQuery Advanced Service in the Apps Script Editor. No pre-flight latency added to non-BigQuery runs.

---

### ISSUE-206: [FALSE ALARM] Formula preservation gap — cross-write operations can overwrite formula cells silently
**Severity**: LOW | **Source**: Competitive_Analysis §2.6

The competitive matrix rates formula preservation "Strong (4/5)" not "Full (5/5)". Cross-spreadsheet write operations (`cross_write`) and `batch_write` can overwrite cells containing formulas without any warning. The dependency graph is per-spreadsheet and doesn't extend to cross-file formula relationships.

**Fix**: In `cross_write` and `batch_write`, check destination cells for formula presence before writing. Add `safety.preserveFormulas?: boolean` parameter — when `true`, skip cells containing formulas and include them in a `skipped` response field.

---

### L. LOW-SEVERITY — TESTING, OBSERVABILITY & DOCUMENTATION

---

### ISSUE-207: [DONE] Edge case tests missing
**Severity**: LOW | **Source**: Handler_Analysis §20.2

No tests for: Unicode/RTL content in sheet names, cells approaching 10M limit, concurrent modification scenarios, expired OAuth tokens mid-operation.

**Fix**: Add `tests/edge-cases/unicode.test.ts`, `tests/edge-cases/limits.test.ts`, `tests/edge-cases/concurrent.test.ts`. At minimum 3 tests each.

---

### ISSUE-208: [DONE] LLM disambiguation — `find_replace` vs `write` (LLMs misuse `find_replace` for single cells)
**Severity**: LOW | **Source**: Handler_Analysis §22.2
**Related**: ISSUE-106 (covers 3 other confusion pairs — not this one)

LLMs frequently use `sheets_data.find_replace` for single-cell updates when `write` is correct. `find_replace` is pattern-based; `write` is range-based. No disambiguation exists in server instructions.

**Fix**: Add to `src/mcp/features-2025-11-25.ts` server instructions: "Use `data.write` for known cell positions. Use `data.find_replace` only for pattern-based replacement across unknown cell positions."

---

### ISSUE-209: [DONE] LLM disambiguation — `comprehensive`/`analyze_data`/`scout` hierarchy not explained
**Severity**: LOW | **Source**: Handler_Analysis §22.2

Three analysis entry points exist with overlapping purpose. LLMs route incorrectly because no description explains: `scout` = quick structural scan (200ms), `analyze_data` = category-specific deep analysis, `comprehensive` = full 43-category audit (30+ seconds).

**Fix**: Add decision tree to `sheets_analyze` tool description: "For quick overview → `scout`. For specific category (formulas/structure/quality) → `analyze_data`. For full audit → `comprehensive`."

---

### ISSUE-210: [DONE] LLM disambiguation — `sheets_advanced` has 7 unrelated domains with no routing hints
**Severity**: LOW | **Source**: Handler_Analysis §22.2

31 actions across 7 functional domains (named ranges, protected ranges, metadata, banding, tables, chips, named functions) makes action discovery difficult. LLMs often can't find the right action.

**Fix**: Group actions by domain in the tool description: "Named ranges: `add_named_range`, `list_named_ranges`, ... | Protected ranges: `add_protected_range`, ... | Tables: `create_table`, ... | Chips: `add_person_chip`, ..."

---

### ISSUE-211: [DONE] `cellsFormatted` off-by-one — returns 3 for a 5-cell range (`A1:E1`)
**Severity**: LOW | **Source**: MCP_Test_Results Issue Log row 26
**File**: `src/handlers/format.ts` (cell count calculation)

Possibly an off-by-one in the cell count calculation (5 cells formatted, 3-4 reported). ISSUE-041 covers `cellsAffected`/`cellsChanged` naming drift; this is count accuracy.

**Fix**: Audit range parsing logic in `format.ts`. The test at `tests/handlers/format.test.ts:154` is the canonical repro (`should report exact cellsFormatted count for A1:E1` — asserts `=== 5`, receives `3`).

**Audit note (2026-02-25) — CONFIRMED FIXED**: Previously reverted to open after a stale gate run. Second audit pass ran `npm run test:fast` and confirmed `2367/2367 tests pass` including `tests/handlers/format.test.ts:154`. The fix is correct.

---

### ISSUE-212: [FIXED-PRE] `completions.ts` — stale comment says "305 actions" (actual: 340)
**Severity**: LOW | **Source**: Handler_Analysis §41.3
**File**: `src/mcp/completions.ts:17`

**Fix**: Replace hardcoded count with dynamic reference: `// ${ACTION_COUNT} actions across ${TOOL_COUNT} tools` where the values are imported from `src/schemas/action-counts.ts`.

---

### ISSUE-213: [FALSE ALARM] ETag cache hit rate not monitored — can't tune TTL without visibility
**Severity**: LOW | **Source**: Handler_Analysis §34.1
**File**: `src/services/cached-sheets-api.ts`

No Prometheus counters for ETag cache effectiveness. Cannot prove the "80-100× reduction" claim or optimize TTL without data.

**Fix**: Add `servalsheets_etag_cache_hits_total` and `servalsheets_etag_cache_misses_total` counters. Increment on each conditional request response (304 = hit, 200 = miss).

---

### ISSUE-214: [FALSE ALARM] Formula sanitization parameter not implemented — formula injection vectors unblocked
**Severity**: LOW | **Source**: Complete_Audit_Roadmap R2.3

`write`/`append` actions accept `=IMPORTDATA()`, `=IMPORTRANGE()`, and other network-calling formulas without any filtering option. No `sanitizeFormulas` parameter exists.

**Fix**: Add `safety.sanitizeFormulas?: boolean` to `write`/`append` schemas. When `true`, reject cell values matching `/^[=+\-@].*(?:IMPORTDATA|IMPORTRANGE|IMPORTFEED|IMPORTHTML|IMPORTXML|GOOGLEFINANCE|QUERY)/i` with `FORMULA_INJECTION_BLOCKED` error.

---

### ISSUE-215: [DONE] Webhook endpoint URLs not redacted in logs — tokens/keys in paths leak
**Severity**: LOW | **Source**: Complete_Audit_Roadmap R2.4
**File**: `src/handlers/webhooks.ts`, `src/services/webhook-manager.ts`

Webhook registration and trigger events are logged with full URLs. URLs containing API tokens or internal hostnames in path/query string (e.g., `?token=abc123`) are stored unredacted in logs.

**Fix**: Before logging webhook URLs, apply `redactUrl(url)` that removes query parameters matching `/token|key|secret|auth|password/i` and replaces with `[REDACTED]`.

---

### ISSUE-216: [DONE] `dependencies.ts` — `analyzerCache` declared as untyped `Map()` without generics
**Severity**: LOW | **Source**: Handler_Analysis §4.1 (DEP16.7)
**File**: `src/handlers/dependencies.ts:33`

`const analyzerCache = new Map()` inferred as `Map<unknown, unknown>`.

**Fix**: `const analyzerCache = new Map<string, ImpactAnalyzer>()`.

---

### ISSUE-217: [DONE] `dependencies.ts` — `batchGet` calls in `modelScenario` not wrapped in `executeWithRetry()`
**Severity**: LOW | **Source**: Handler_Analysis §4.1 (DEP16.8)
**File**: `src/handlers/dependencies.ts:416-427`

Violates NC-16. A transient 429 or 5xx in `modelScenario` fails the entire scenario analysis without retry.

**Fix**: Wrap in `executeWithRetry(() => this.cachedApi.batchGet(...))`.

---

### ISSUE-218: [FIXED-PRE] RTL layout support missing from `update_sheet` and `create` schemas
**Severity**: LOW | **Source**: Complete_Audit_Roadmap §3.3.2, Implementation_Guide T11 §12.3

ISSUE-084/085/086 cover the other 3 i18n gaps listed in the same roadmap paragraph. RTL (right-to-left layout for Arabic, Hebrew, Persian, Urdu) is the fourth item and is absent from ISSUES.md.

**Fix**: Add `rightToLeft?: boolean` to `update_sheet` and `create` action schemas. Pass to Google Sheets API's `updateSheetProperties.properties.rightToLeft`. ~10 lines.

---

### ISSUE-219: [FALSE ALARM] `sheets_webhook` tool description doesn't document Redis dependency
**Severity**: LOW | **Source**: MCP_Test_Results Issue Log row 23

All 7 `sheets_webhook` actions fail with `CONFIG_ERROR` when Redis is not configured. The tool description and schema don't document this runtime prerequisite. New users discover it only at runtime.

**Fix**: Add to `sheets_webhook` tool description: "**Requires Redis**: Set `REDIS_URL` env var. Without Redis, all webhook actions return `CONFIG_ERROR`."

---

### ISSUE-220: [FALSE ALARM] `sheets_federation` tool description doesn't document `MCP_FEDERATION_ENABLED` prerequisite
**Severity**: LOW | **Source**: MCP_Test_Results Issue Log row 24

All 4 `sheets_federation` actions require `MCP_FEDERATION_ENABLED=true`. Not documented in tool description.

**Fix**: Add to `sheets_federation` tool description: "**Requires**: Set `MCP_FEDERATION_ENABLED=true` env var to activate."

---

### ISSUE-221: [FALSE ALARM] Auto-generated API reference pipeline exists (`gen:openapi`, `export-openapi`, `docs` generation scripts)
**Severity**: LOW | **Source**: Handler_Analysis §29.1

No per-action API reference documentation. Users must read Zod schemas or `server.json` to understand parameters. A generation script from schemas would produce this automatically.

**Fix**: Create `scripts/generate-api-docs.ts` that reads each schema's `describe()` calls and input/output types, emitting `docs/api/` markdown files. Run as part of release workflow.

---

### ISSUE-222: [DONE] Added `sheets_analyze.workflow_chain` single-call scout+plan+execution chain scaffold
**Severity**: LOW | **Source**: Implementation_Guide T12 §13.7, Strategic_Roadmap Track 3

Two high-value AI capabilities from the strategic roadmap: (1) ReACT multi-step reasoning chains (analyze → plan → execute → verify), (2) Natural language to formula with validation and explanation. These would be new `sheets_analyze` actions leveraging the existing Sampling infrastructure.

**Fix**: Phase 1: `analyze.generate_formula` already exists — enhance with validation and explanation output. Phase 2: Add `analyze.workflow_chain` action that combines scout + plan + execute steps into a single agentic call.

---

## SECTION 13 — 12-AGENT AUDIT FINDINGS (2026-02-25)

Issues discovered by running all 12 specialized agents in parallel against the live codebase.
All findings verified against actual source files with file:line references.

---

### ISSUE-223: [DONE] CRITICAL — Real OAuth client secret hardcoded in `embedded-oauth.ts`
**Severity**: CRITICAL | **Source**: 12-Agent Security Audit (2026-02-25)
**File**: `src/config/embedded-oauth.ts:37-38`

A live Google OAuth client secret is hardcoded directly in source: `[REDACTED — see git history for ISSUE-223 context]`. Because the string does NOT start with `REPLACE_WITH_`, the `isEmbeddedOAuthConfigured()` check returns `true` and no warning is shown to users. This credential is checked into git history and may already be compromised.

**Impact**: Any user or CI system with repository access has the OAuth client secret. Google can use this to impersonate the application, issue tokens, or access user spreadsheets.

**Fix**:
1. **Immediately rotate**: Revoke this client secret in Google Cloud Console. Generate a new one.
2. **Remove from code**: Replace with `REPLACE_WITH_REAL_OAUTH_CLIENT_SECRET` placeholder.
3. **Add `isEmbeddedOAuthConfigured()` guard**: The function must check that the value does NOT match `REPLACE_WITH_` AND is not an empty string before returning `true`.
4. **Scrub git history**: Run `git filter-branch` or BFG Repo Cleaner to remove the secret from all historical commits.
5. **Add pre-commit hook**: Block commits containing `GOCSPX-` patterns.

**Verification**: `grep -r 'GOCSPX-' src/` must return 0 matches. `isEmbeddedOAuthConfigured()` must return `false` after the placeholder is restored.

---

### ISSUE-224: [DONE] HIGH — `AUTH_EXEMPT_ACTIONS` check reads pre-normalization args; auth exemption silently fails
**Severity**: HIGH | **Source**: 12-Agent Debug Tracer (2026-02-25)
**File**: `src/server.ts:799`

```typescript
const rawAction = (args as Record<string, unknown>)['action'];
```

This reads `args.action` directly from the raw MCP request, **before** `normalizeToolArgs()` runs. For correctly-formatted MCP requests using the standard envelope `{ request: { action: 'list' } }`, `args.action` is `undefined`. The `AUTH_EXEMPT_ACTIONS` check therefore never matches, and `sheets_history.list`, `sheets_history.get`, `sheets_history.stats` silently require authentication even though they are supposed to be auth-exempt.

**Impact**: History lookups fail with auth errors for any client sending correctly-formatted requests. Only clients using the legacy flat format `{ action: 'list' }` get the exemption.

**Fix**: Move the `AUTH_EXEMPT_ACTIONS` check to after `normalizeToolArgs()` runs, or extract the action name using the same logic as `normalizeToolArgs()` (check `args.request?.action ?? args.action`).

**Verification**: Test with `{ request: { action: 'list' } }` to `sheets_history` without auth — must succeed.

---

### ISSUE-225: [DONE] HIGH — HTTP transport `HandlerContext` omits `taskStore`; Task IDs never emitted via HTTP
**Severity**: HIGH | **Source**: 12-Agent Debug Tracer (2026-02-25)
**File**: `src/http-server.ts:207-243`

The `HandlerContext` built in the HTTP transport path does not include `taskStore`. All 7 task-augmented operations (`export_to_bigquery`, `import_from_bigquery`, `appsscript.run`, `composite.export_large_dataset`, `history.timeline`, plus `federation` ops) use `if (this.context.taskStore)` guards before emitting Task IDs. Via HTTP, `this.context.taskStore` is always `undefined` — Task IDs are silently skipped.

**Impact**: Clients connecting via HTTP/SSE or Streamable HTTP transport never receive Task IDs for long-running operations. The MCP Tasks feature (SEP-1686) is STDIO-only despite being advertised as generally available.

**Fix**: Inject `taskStore` into `HandlerContext` in `http-server.ts`, same as it's injected in `server.ts`. Use the same `TaskStoreAdapter` singleton.

**Verification**: Send `sheets_bigquery.export_to_bigquery` via HTTP transport and confirm the response includes `taskId`.

---

### ISSUE-226: [DONE] HIGH — GDPR consent gate bypassed for direct `server.createMessage()` calls in handlers
**Severity**: HIGH | **Source**: 12-Agent Debug Tracer (2026-02-25)
**File**: `src/mcp/sampling.ts` vs handler direct calls

The `assertSamplingConsent()` GDPR guard is only called in the high-level sampling wrapper functions (`analyzeData()`, `generateFormula()`, etc. in `src/mcp/sampling.ts`). However, several handlers call `this.context.server.createMessage()` directly, bypassing the consent gate entirely.

**Impact**: Personal data from spreadsheet cells can be sent to LLM APIs without GDPR consent being verified. This is a regulatory violation in EU/EEA jurisdictions.

**Fix**: Move `assertSamplingConsent()` into a wrapper around `server.createMessage()` itself so it cannot be bypassed. Alternatively, audit all direct `server.createMessage()` callsites and add the consent check to each one.

**Verification**: `grep -rn 'server.createMessage\|samplingServer.createMessage' src/handlers/` — each callsite must invoke `assertSamplingConsent()` before the call.

---

### ISSUE-227: [DONE] MEDIUM — `CHECKPOINTS_DISABLED` and `CHECKPOINT_NOT_FOUND` not declared in `ErrorCodeSchema`
**Severity**: MEDIUM | **Source**: 12-Agent Code Review (2026-02-25)
**File**: `src/handlers/session.ts:399,456,474,542` | `src/schemas/shared.ts:381-480`

`session.ts` returns error responses with `code: 'CHECKPOINTS_DISABLED'` and `code: 'CHECKPOINT_NOT_FOUND'`. Neither string exists in the `ErrorCodeSchema` z.enum at `src/schemas/shared.ts:381-480`. This violates the contract that all error codes must be schema-validated enum members.

**Impact**: Clients performing exhaustive error code matching will fall through to unknown-code handlers. TypeScript strict mode does not catch this because the `code` field accepts the full enum type but session.ts coerces via `as`.

**Fix**: Add `CHECKPOINTS_DISABLED` and `CHECKPOINT_NOT_FOUND` to `ErrorCodeSchema` in `src/schemas/shared.ts`. Then run `npm run schema:commit`.

**Verification**: `npm run schema:commit` must pass. `grep 'CHECKPOINTS_DISABLED\|CHECKPOINT_NOT_FOUND' src/schemas/shared.ts` must return matches.

---

### ISSUE-228: [FALSE ALARM] MEDIUM — `sampling-context-cache.ts` is actively imported and used
**Severity**: MEDIUM | **Source**: 12-Agent Security Audit + Codebase Research (2026-02-25)
**File**: `src/services/sampling-context-cache.ts`

The original flag was incorrect. `sampling-context-cache.ts` is imported by active runtime paths
(`src/mcp/sampling.ts` and `src/mcp/registration/tool-handlers.ts`) and is part of the current
sampling context flow.

**Impact**: None. This is not dead code and does not require remediation.

**Fix**: No code change required.

**Verification**: `grep -r 'sampling-context-cache' src/` returns import hits in active runtime modules.

---

### ISSUE-229: [DONE] MEDIUM — ETag conditional-request optimization likely inoperative
**Severity**: MEDIUM | **Source**: 12-Agent Google API Expert (2026-02-25)
**File**: `src/services/cached-sheets-api.ts:109-132`

The ETag cache hit detection uses:
```typescript
} catch (error) {
  if (error && error.code === 304) { ... // cache hit
```

However, the `googleapis` Node.js client does not reliably throw an error object with `code === 304` for conditional request responses. Google's Node.js client library handles HTTP 304 responses internally before surfacing to user code. As a result, this `catch` block may never trigger, meaning every conditional request still incurs a full API response instead of the expected "80-100× reduction."

**Impact**: The ETag caching optimization — a major advertised performance feature — may be silently bypassed. Every `cached-sheets-api.ts` call makes a full API round-trip.

**Fix**: Verify empirically by adding a counter that increments in both the cache-hit and cache-miss branches. Check if `googleapis` v6+ has a different 304 handling mechanism (may use `res.status === 304` on the raw HTTP response, not a thrown error).

**Verification**: Add `servalsheets_etag_304_hits_total` counter. Run against a real spreadsheet with repeated reads. Counter must increment.

---

### ISSUE-230: [DONE] BLOCKER — `src/schemas/annotations.ts` in `MM` git state from interrupted `schema:commit`
**Severity**: CRITICAL (release blocker) | **Source**: 12-Agent Dev Orchestrator (2026-02-25)
**File**: `src/schemas/annotations.ts` (git status: `MM` — staged AND unstaged changes)

`annotations.ts` shows `MM` in `git status`, meaning it has both staged changes (from a previous `schema:commit` partial run) and additional unstaged changes. This indicates a `schema:commit` was interrupted mid-execution. The file is in an inconsistent state that will cause merge conflicts and metadata drift.

**Impact**: CI will fail metadata drift check. Any further `schema:commit` run may produce incorrect annotations because it's working from a partially-staged base. Release is blocked until resolved.

**Fix**:
```bash
git diff HEAD src/schemas/annotations.ts  # inspect what's staged vs unstaged
git checkout -- src/schemas/annotations.ts  # reset to last commit
npm run schema:commit  # regenerate cleanly from scratch
```

**Verification**: `git status src/schemas/annotations.ts` must show clean (no `MM`). `npm run check:drift` must pass.

---

### ISSUE-231: [DONE] HIGH — Audit middleware `MUTATION_ACTIONS` set uses stale action names; structured mutation events never fire
**Severity**: HIGH | **Source**: 12-Agent Security Audit (2026-02-25)
**File**: `src/middleware/audit-middleware.ts:71-116`

The `MUTATION_ACTIONS` set in the audit middleware contains legacy action names that don't match the dispatched action names used by handlers:

| Stale name in middleware | Actual dispatched name |
|--------------------------|----------------------|
| `write_range` | `write` |
| `append_rows` | `append` |
| `update_cell` | `write` (single cell) |
| `batch_update` | `batch_write` |
| `delete_rows` | `delete` |

Because no dispatched action matches the names in `MUTATION_ACTIONS`, the `MutationEvent` and `PermissionEvent` audit log entries **never fire**. The audit log only records generic `RequestEvent` entries — the high-value mutation audit trail is completely absent.

**Impact**: Compliance audit logging for write operations is silently broken. Any regulatory requirement to track "who wrote what and when" is unmet, despite the feature appearing to be enabled.

**Fix**: Update `MUTATION_ACTIONS` to match the actual action names used in handler switch statements. Add an integration test that confirms `MutationEvent` appears in the audit log after a `data.write` call.

**Verification**: Call `sheets_data.write` with `ENABLE_AUDIT_LOGGING=true`. Verify `MutationEvent` appears in audit output. `MUTATION_ACTIONS.has('write')` must return `true`.

---

## VERIFICATION GATES

Run these before marking any issue complete:

```bash
# After schema changes (MANDATORY):
npm run schema:commit

# After any code change:
npm run test:fast              # 2367+ tests must pass
npm run typecheck              # 0 errors
npm run check:drift            # metadata in sync
npm run validate:alignment     # schema-handler alignment

# Before release:
npm run verify:safe            # Full check (skip lint if OOM)
npm run gates                  # G0-G5 all pass
npm run check:silent-fallbacks # 0 false positives
npm run check:placeholders     # No TODO/FIXME in src/
npm run audit:full             # Coverage + perf + memory

# After handler changes:
npm run check:debug-prints     # No console.log in handlers
npm run validate:alignment     # Schema-handler alignment
```

---

## ISSUE COUNTS

| Priority | Count | Description |
|----------|-------|-------------|
| CRITICAL (P0) | 4 | Auth drops, sheetId=0, API error leaks, BigQuery crash |
| HIGH (P1) | 21 | Timeouts, scope blocks, safety rail gaps, API efficiency, race conditions |
| MEDIUM (P2) | 30 | Schema/docs, session bugs, code quality, memory, infrastructure |
| LOW (P3) | 7 | UX, dead code, code duplication |
| MCP Protocol | 9 | Task config, completions, sampling, session, new 2025-11-25 features |
| Release Blockers | 6 | TypeScript errors, npm audit, scope validation, git state |
| Test Coverage | 3 | 3 tools with low test ratios |
| API Opportunities | 5 | Theme colors, gradient CF, metadata resolution, pivot docs |
| I18n | 3 | EU numbers, CSV BOM, formula locale |
| **Subtotal (original)** | **88** | |
| **Addendum CRITICAL** | 4 | Optional chaining crash, sampling timeout, batchUpdate replies, GDPR gaps |
| **Addendum HIGH** | 7 | Cancellation errors, Promise.all mode, unbounded Maps, idempotency, Drive push, Shared Drives, session TTL |
| **Addendum MEDIUM** | 10 | BigQuery confirm, AppScript confirm, history.clear safety, error messages, encryption, GDPR consent, circuit breaker, snapshot order, LLM descriptions, protocol negotiation |
| **Addendum LOW** | 4 | Never exhaustiveness, atomic snapshots, .env.example, Apps Script limits |
| **Deep Audit HIGH** | 8 | TieredRetrieval 3x calls, PQueue OOM, A1:ZZ10000 default, memory watchdog, core.list scope, P4 integration tests, GDPR consent gate, MCP cancellation |
| **Deep Audit MEDIUM** | 55 | Handler bugs (21), infrastructure (8), schema (3), MCP (4), Google API (4), security (5), GDPR (2), testing (4), post-release (7) |
| **Deep Audit LOW** | 47 | Handler code quality (16), API integration gaps (11), testing/observability/docs (10), misc (10) |
| **Subtotal pre-12-agent audit** | **223** | |
| **12-Agent Audit Pass 1 (2026-02-25)** | | |
| — ISSUE-223 (CRITICAL) | 1 | Real OAuth secret hardcoded in embedded-oauth.ts |
| — ISSUE-224 (HIGH) | 1 | AUTH_EXEMPT_ACTIONS pre-normalization bypass |
| — ISSUE-225 (HIGH) | 1 | HTTP HandlerContext missing taskStore |
| — ISSUE-226 (HIGH) | 1 | GDPR consent gate bypassed for direct createMessage |
| — ISSUE-227 (MEDIUM) | 1 | CHECKPOINTS_DISABLED/CHECKPOINT_NOT_FOUND not in ErrorCodeSchema |
| — ISSUE-228 (MEDIUM) | 1 | sampling-context-cache.ts dead code (later verified FALSE ALARM) |
| — ISSUE-229 (MEDIUM) | 1 | ETag 304 optimization likely inoperative |
| — ISSUE-230 (BLOCKER) | 1 | annotations.ts in MM git state (interrupted schema:commit) |
| — ISSUE-231 (HIGH) | 1 | Audit middleware MUTATION_ACTIONS stale names |
| **12-Agent Audit Pass 1 New** | **9** | |
| **12-Agent Audit Pass 2 (2026-02-25)** | | |
| — ISSUE-232 (CRITICAL) | 1 | assertSamplingConsent() is a complete NO-OP |
| — ISSUE-233 (HIGH) | 1 | ParallelExecutor not wired into SheetsDataHandler |
| — ISSUE-234 (MEDIUM) | 1 | P14 composite actions missing ACTION_ANNOTATIONS |
| — ISSUE-235 (LOW) | 1 | metrics.ts missing P4-P14 feature instrumentation |
| — ISSUE-236 (LOW) | 1 | prompt-registration.ts has no P4-P14 guidance prompts |
| — ISSUE-237 (LOW) | 1 | fix-cleaning.test.ts 16 tests use bare format |
| — ISSUE-238 (LOW) | 1 | history-timetravel.test.ts does not exist |
| — ISSUE-239 (LOW) | 1 | tests/helpers/wait-for.ts untracked dead code (later verified FALSE ALARM) |
| **12-Agent Audit Pass 2 New** | **8** | |
| **TOTAL** | **240** | |
| — **[DONE]** | **109** | Verified in current code + tests |
| — **[FALSE ALARM]** | **71** | Verified not reproducible / already implemented |
| — **[FIXED-PRE]** | **58** | Historical fixes, not re-verified in this pass |
| — **Open / Maintainer-only** | **2** | ISSUE-073 and ISSUE-075 |

---

## SECTION 14 — SECOND 12-AGENT AUDIT FINDINGS (2026-02-25)

Issues discovered in the second 12-agent parallel audit pass. All confirmed against live source files.

---

### ISSUE-232: [DONE] CRITICAL — `assertSamplingConsent()` is a complete NO-OP; GDPR consent check inactive
**Severity**: CRITICAL | **Source**: 12-Agent Security Audit, Second Pass (2026-02-25)
**File**: `src/mcp/sampling.ts:38`

`assertSamplingConsent()` is designed as the GDPR gate before any AI sampling call. However, the internal `_consentChecker` closure is initialized to `null` and **never assigned** at runtime. `registerSamplingConsentChecker()` is exported but never called from `server.ts` or `http-server.ts`. Every call to `assertSamplingConsent()` immediately returns without checking consent.

**Impact**: All AI sampling calls that go through `analyzeData()`, `generateFormula()`, `recommendChart()`, etc. process user spreadsheet data without GDPR consent verification. This is a regulatory violation in EU/EEA jurisdictions even when ISSUE-226 (direct `createMessage` bypass) is fixed.

**Fix**:
```typescript
// server.ts (and http-server.ts): wire the consent checker on startup
import { registerSamplingConsentChecker } from './mcp/sampling.js';
registerSamplingConsentChecker(async () => {
  // Check env flag or prompt user — must be non-null to activate
  if (process.env['ENABLE_SAMPLING_CONSENT'] === 'true') {
    // perform consent check
  }
});
```
Or remove the mechanism and document it as "consent is user's responsibility" if GDPR is explicitly out of scope.

**Verification**: Add a test that calls `assertSamplingConsent()` when `_consentChecker` is null and confirms it throws or enforces a default policy.

---

### ISSUE-233: [DONE] HIGH — `ParallelExecutor` instance in `perf-init.ts` not wired into `SheetsDataHandler`
**Severity**: HIGH | **Source**: 12-Agent Performance Optimizer, Second Pass (2026-02-25)
**File**: `src/startup/performance-init.ts:77-81`

`performance-init.ts` creates a `ParallelExecutor` with `{ concurrency: 20, ... }` but this instance is not injected into `SheetsDataHandler`. The data handler explicitly notes that performance services were removed from its constructor. As a result, `batch_read` operations with 100+ ranges do not benefit from parallel execution — the 40% speed improvement from `ENABLE_PARALLEL_EXECUTOR=true` is silently inactive for the HTTP path.

Additionally, the `perf-init.ts` instance uses `concurrency: 20` — overriding the remediation-phase-1 safe default of `5` set in `src/services/parallel-executor.ts`.

**Fix**: Either inject the `ParallelExecutor` from `perf-init.ts` into `SheetsDataHandler` constructor, or confirm the handler uses its own internal instance. Align both instances to use the same safe concurrency default.

**Verification**: Confirm `SheetsDataHandler` receives a `ParallelExecutor` instance. Confirm `batch_read` with 110 ranges uses parallel execution.

---

### ISSUE-234: [DONE] MEDIUM — P14 composite actions missing `ACTION_ANNOTATIONS` entries
**Severity**: MEDIUM | **Source**: 12-Agent Explore Agent, Second Pass (2026-02-25)
**File**: `src/schemas/annotations.ts`

The 5 P14 composite workflow actions (`audit_sheet`, `publish_report`, `data_pipeline`, `instantiate_template`, `migrate_spreadsheet`) were added to the schema and handler in P14 but no `ACTION_ANNOTATIONS` entries were added to `annotations.ts`. Without annotations, these actions have no `destructiveHint`, `readOnlyHint`, `openWorldHint`, or `taskSupport` metadata. Tool-calling clients cannot make informed decisions about confirmation requirements or long-running behavior.

**Fix**: After resolving ISSUE-230 (MM git state), add annotation entries for each of the 5 P14 actions to `annotations.ts`. Then run `npm run schema:commit` to regenerate. Note: `annotations.ts` is a generated file — check whether these should be in the annotations source input instead.

**Verification**: `npm run schema:commit` passes. The 5 P14 actions appear in the annotations output with appropriate hints.

---

### ISSUE-235: [DONE] LOW — `metrics.ts` missing P4-P14 feature instrumentation counters
**Severity**: LOW | **Source**: 12-Agent Explore Agent, Second Pass (2026-02-25)
**File**: `src/observability/metrics.ts`

`metrics.ts` defines Prometheus counters for pre-P4 features. The 20+ new actions added in P4-P14 (Smart Suggestions, Data Cleaning, Sheet Generator, Time-Travel, Scenario Modeling, Federation, Composite workflows, MCP wiring) have no dedicated instrumentation counters. Operators cannot observe usage, error rates, or performance for any of these features.

**Fix**: Add feature-level counters: `servalsheets_suggestion_total`, `servalsheets_cleaning_operations_total`, `servalsheets_generation_requests_total`, `servalsheets_scenario_models_total`, `servalsheets_cross_spreadsheet_ops_total`. Add labels for action name to existing counters.

**Verification**: After a `suggest_next_actions` call, `servalsheets_suggestion_total` must be incremented.

---

### ISSUE-236: [DONE] LOW — `prompt-registration.ts` has no P4-P14 guided workflow prompts
**Severity**: LOW | **Source**: 12-Agent Explore Agent, Second Pass (2026-02-25)
**File**: `src/mcp/registration/prompt-registration.ts`

The prompt registry contains 38 guided workflows for pre-P4 features. None of the P4-P14 features (generate_sheet, model_scenario, suggest_next_actions, cross_read, clean, timeline, audit_sheet, data_pipeline, etc.) have corresponding guided prompts. LLMs cannot discover best-practice workflows for any of these high-value features.

**Fix**: Add at minimum 5 guided prompts: one for each major P4 feature (Sheet Generator, Scenario Modeling, Data Cleaning, Smart Suggestions, Cross-Sheet Federation). Include parameter examples and chaining patterns.

**Verification**: `list_prompts()` returns ≥43 prompts. New prompts reference at least one P4-P14 action.

---

### ISSUE-237: [DONE] LOW — `tests/handlers/fix-cleaning.test.ts` — bare format handled by unwrapRequest(); tautological assertion + Math.random() fixed
**Severity**: LOW (test quality) | **Source**: 12-Agent Testing Specialist, Second Pass (2026-02-25)
**File**: `tests/handlers/fix-cleaning.test.ts`

All 16 tests in `fix-cleaning.test.ts` invoke the handler with bare format:
```typescript
handler.handle({ action: 'clean', spreadsheetId: '...', range: '...' })
```
The correct envelope format (required by `normalizeToolArgs()`) is:
```typescript
handler.handle({ request: { action: 'clean', spreadsheetId: '...', range: '...' } })
```
Additionally: test at line 321 uses `expect([true, false]).toContain(result.response.success)` — a tautology that always passes. Test at line 382 uses `Math.random() * 1000` — non-deterministic test data.

**Fix**: Wrap all 16 test invocations in `{ request: { ... } }` envelope per NC-09. Replace line 321 tautology with `expect(result.response.success).toBe(true)`. Replace `Math.random()` with a fixed deterministic seed value.

**Verification**: All 16 tests pass with envelope format. No tautological assertions remain.

---

### ISSUE-238: [DONE] LOW — `tests/handlers/history-timetravel.test.ts` does not exist
**Severity**: LOW (test coverage) | **Source**: 12-Agent Testing Specialist, Second Pass (2026-02-25)

The 3 F5 time-travel actions added in P4 (`timeline`, `diff_revisions`, `restore_cells`) have no handler test file. Only integration-level tests exist. This means the handler dispatch, error paths, and input validation for these actions are untested at the unit level.

**Fix**: Create `tests/handlers/history-timetravel.test.ts` with success and error paths for `timeline`, `diff_revisions`, and `restore_cells`. Use envelope format per NC-09.

**Verification**: File exists. 6+ tests pass.

---

### ISSUE-239: [FALSE ALARM] LOW — `tests/helpers/wait-for.ts` is tracked and used
**Severity**: LOW | **Source**: 12-Agent Testing Specialist, Second Pass (2026-02-25)
**File**: `tests/helpers/wait-for.ts`

The original flag was stale. `tests/helpers/wait-for.ts` is tracked and referenced by test files.
It is not dead code.

**Fix**: No code change required.

**Verification**: `git ls-files tests/helpers/wait-for.ts` returns a tracked file path; `rg \"wait-for\" tests` returns callers.

---

## VERIFICATION GATES
