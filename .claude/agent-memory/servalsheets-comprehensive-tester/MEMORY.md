# ServalSheets Comprehensive Tester - Agent Memory

## Key Findings (2026-02-18)

### Action Count Discrepancy

- **Actual count:** 25 tools, 409 actions (from `src/schemas/action-counts.ts`)
- **CLAUDE.md claims:** 305 actions
- **Capabilities resource says:** 305 actions, version 2.0.0.0
- **Package.json says:** version 2.0.0.0
- 6 tools have mismatched counts between MCP description and schema
- 9 actions missing from MCP tool enum definitions (invisible to Claude Code)

### Auth Gate Architecture

- ALL 24 non-auth tools gated at `src/server.ts:728` via `checkAuth()`
- Auth gate happens AFTER schema validation (Zod catches invalid actions first)
- Auth gate happens BEFORE handler-level parameter validation
- Local-only tools (session, history, confirm, transaction) are needlessly gated
- OAuth callback server on port 3000, 120s timeout, falls through to manual flow

### Error Handling Patterns

- Zod validation errors use `INTERNAL_ERROR` code instead of `INVALID_PARAMS`
- Zod errors are returned as raw JSON arrays in message string
- Invalid OAuth callback code returns "invalid_client" (misleading - should be "invalid_code")
- Auth error responses have well-structured resolution steps with `suggestedNextStep`

### MCP Resources

- 68 MCP resources registered
- Resources work even when not authenticated
- Schema resources provide complete input/output schema definitions
- Metrics dashboard tracks tool usage, cache, API efficiency

## Key Findings (2026-04-19) — Schema/Handler/Compliance Audit

### Cache Invalidation Graph — CRITICAL Performance Defect

- `src/services/cache-invalidation-graph.ts` lines ~496-523: all 26 `sheets_session` rules use STALE v1 action names (`init`, `set_context`, `clear_context`, `set_preferences`, etc.)
- Current schema has 32 completely different actions (`set_active`, `get_active`, `compact_session`, etc.)
- None of the 32 current session actions are in the graph
- Result: `getInvalidationKeys()` returns `['*']` (full cache wipe) on every session action call
- File: `src/services/cache-invalidation-graph.ts` around line 496

### Handler Aliases Not in Schema (Documented Deviation)

- `src/handlers/core.ts` lines ~549-580 has 6 alias cases: `rename_sheet`, `hide_sheet`, `show_sheet`, `unhide_sheet`, `copy_to`, `update_sheet_properties`
- These bypass Zod validation (schema only accepts the 21 canonical actions)
- They are intentional and documented in `src/schemas/handler-deviations.ts` lines 113-142
- LLMs cannot discover aliases via completions (not in TOOL_ACTIONS) but calls work if guessed

### Schema Completeness — All 25 Tools Verified

- All 25 tool Zod schemas have correct discriminated unions matching ACTION_COUNTS
- All 25 tools have output schemas registered in `tool-definitions.ts`
- Output schema validation is ADVISORY only — gated behind `VALIDATE_OUTPUT_SCHEMAS` env var
- Output validation is per-tool (not per-action) — no granular per-action output validation

### MUTATION_ACTIONS Parity

- Two separate MUTATION_ACTIONS sets exist and are identical:
  - `src/middleware/audit-middleware.ts:159` (typed as `MutationEvent['action']`)
  - `src/middleware/write-lock-middleware.ts:27` (typed as `string`)
- A third set `FORCE_WRITE_ACTIONS` in write-lock-middleware covers additional structural mutations

### auto_fill Naming Collision (Not a Bug)

- Both `sheets_data` and `sheets_dimensions` have an `auto_fill` action
- This is safe — routing is per-tool, action names only need uniqueness within a tool

## Key Findings (2026-04-28) — Full Suite Audit

### Action Count (Authoritative)

- `src/generated/action-counts.ts`: 25 tools, **410 actions** (not 409 — `sheets_dimensions` is 31, not 30)
- The MCP server description says "410 actions" (correct)
- Drift check passes: source/dist synchronized at 25 tools, 410 actions

### Test Suite Totals (2026-04-28)

- Total test files run: 550 (excluding live-api and simulation)
- Total tests: 10,551 (10,189 pass, 309 skipped, 2 todo)
- **51 failures** in 5 failing files (99.5% pass rate)
- TypeScript: compiles cleanly with no errors
- Metadata drift: none detected
- Integration tests: 17 pass, 5 skipped (all pass)
- MCP tests: 28 files, 182 pass, 4 skipped (all pass)
- Contract tests: 42 files, 1303 pass (all pass)
- Service tests: 81 files, 1730 pass, 22 skipped (all pass)
- Audit tests: 4 files, 1289 pass (all pass, incl 1264 action coverage assertions)

### Failing Tests — Root Causes (2026-04-28)

**File 1: `tests/handlers/advanced.test.ts` — 41/45 fail**
- Root cause: Mock context uses `auth.scopes: ['https://www.googleapis.com/auth/drive.file']`
- All `sheets_advanced` operations require `spreadsheets` or `spreadsheets.readonly` scope
- Commit `b316fd90` changed `checkOperationScopes` to enforce scope checks regardless of `INCREMENTAL_CONSENT_ENABLED`
- Previously, scope checks were skipped when `INCREMENTAL_CONSENT_ENABLED=false` (the test environment default)
- Error returned: `INSUFFICIENT_PERMISSIONS` instead of expected success or `PRECONDITION_FAILED`
- Fix: update test mock to use `scopes: ['https://www.googleapis.com/auth/spreadsheets']`

**File 2: `tests/handlers/elicitation-wizards.test.ts` — 6/12 fail (chart_create + add_conditional_format_rule)**
- Root cause: Test mocks `../../src/security/incremental-scope.js` but mock does NOT export `InsufficientScopeError`
- Commit `b316fd90` added `InsufficientScopeError` to base.ts (imported from incremental-scope.js)
- When `validator.hasRequiredScopes()` returns undefined (mock doesn't implement it), the throw path runs
- But `InsufficientScopeError` is undefined in the mock → `TypeError: InsufficientScopeError is not a constructor`
- `SheetsCoreHandler.create` and `TransactionHandler.begin` pass because `OPERATION_SCOPES` has no entry for those operations (unknown ops return true)
- Fix: add `InsufficientScopeError: class extends Error {}` and `hasRequiredScopes: vi.fn().mockReturnValue(true)` to the incremental-scope mock

**File 3: `tests/handlers/fix.test.ts` — 2/22 fail**
- Root cause: New retry tests added in commit `99a73607` use `range: 'Sheet1!A1:B2'` (bare string)
- Handler calls `extractRangeA1(req.range)` which requires an object `{a1: '...'}` not a string
- Fix: change test fixture to `range: { a1: 'Sheet1!A1:B2' }`

**File 4: `tests/snapshots/schemas.snapshot.test.ts` — 1 fail**
- Root cause: Uncommitted change adds `safety: SafetyOptionsSchema` to `ClearSheetActionSchema` in `src/schemas/core.ts`
- Snapshot for `SheetsCoreInputSchema` is now stale
- Fix: run `npx vitest run tests/snapshots -u` after committing schema change

**File 5: `tests/compliance/tool-routing.test.ts` — 1 fail**
- Root cause: Commit `38aeeeaf` added new minimal descriptions exceeding 500-char gate
- Offenders: `sheets_data` (584), `sheets_dimensions` (530), `sheets_composite` (588), `sheets_appsscript` (602)
- Test expects `desc.length <= 500` for all 25 tools
- Fix: either trim the descriptions or raise the gate to 650

### Uncommitted Changes (2026-04-28)

4 files with unstaged changes:
- `scripts/mcp-protocol-smoke.mjs` — minor refactor
- `src/handlers/advanced-actions/named-ranges.ts` — `skipIfElicitationUnavailable` → `preConfirmed` fix
- `src/handlers/dimensions-actions/filter-view-operations.ts` — 1 line addition
- `tests/live-api/setup/test-rate-limiter.ts` — minor fix

Large batch of `safety.confirmed` / `preConfirmed` changes already committed in `92b35581`:
- `src/handlers/base.ts`: expose `preConfirmed` option on `confirmDestructiveAction`
- `src/utils/safety-helpers.ts`: `preConfirmed` bypass in `requestSafetyConfirmation`
- `src/handlers/advanced-actions/protected-ranges.ts`, `src/handlers/core-actions/sheet-ops.ts`,
  `src/handlers/core-actions/sheet-batch.ts`, `src/handlers/dimensions-actions/filter-sort-operations.ts`,
  `src/handlers/dimensions-actions/structure-operations.ts`, `src/handlers/data-actions/batch.ts`: all wired
- `src/schemas/core.ts`: added `safety: SafetyOptionsSchema` to `ClearSheetActionSchema` (causes snapshot failure)

### Scope Enforcement Architecture (b316fd90 — 2026-04-28)

- `src/handlers/base.ts:checkOperationScopes()` now unconditionally enforces OAuth scopes
- Previously guarded by `if (!INCREMENTAL_CONSENT_ENABLED) return` — tests depended on this
- Scope map: `src/security/operation-scopes-map.ts` — 1200+ entries, all 410 actions covered
- `ScopeValidator.hasRequiredScopes()` — checks if current scopes satisfy operation requirements
- Scope upgrade rules: `spreadsheets` covers `spreadsheets.readonly`; `drive` covers `drive.file`
- Tests that mock `auth.scopes: ['drive.file']` now fail for `spreadsheets`-scoped operations

### MCP Compliance (2026-04-28)

- MCP 2025-11-25: PASS (18/18 compliance tests)
- 25 tools registered, all with annotations
- All tool names follow `sheets_*` convention
- Tools unique, no duplicates
- Prompts and resources registered
- STDIO purity: PASS
- Output sanitization: PASS
- Error code compliance: PASS

### Per-Tool Handler Test Status (2026-04-28)

| Tool | Handler Test File | Status |
|------|------------------|--------|
| sheets_advanced | advanced.test.ts | FAIL (41/45) — scope mock issue |
| sheets_agent | agent.test.ts | PASS |
| sheets_analyze | analyze.test.ts + 7 more | PASS |
| sheets_appsscript | appsscript.test.ts | PASS |
| sheets_auth | auth.test.ts | PASS |
| sheets_bigquery | bigquery.test.ts | PASS |
| sheets_collaborate | collaborate.test.ts + 3 more | PASS |
| sheets_composite | composite.test.ts + 3 more | PASS |
| sheets_compute | compute.test.ts | PASS |
| sheets_confirm | confirm.test.ts | PASS |
| sheets_connectors | connectors.test.ts | PASS |
| sheets_core | core.test.ts | PASS |
| sheets_data | data.test.ts + 4 more | PASS |
| sheets_dependencies | dependencies.test.ts | PASS |
| sheets_dimensions | dimensions.test.ts | PASS |
| sheets_federation | federation.test.ts | PASS |
| sheets_fix | fix.test.ts | FAIL (2/22) — string range in new test |
| sheets_format | format.test.ts + 4 more | PASS (elicitation cross-test fails) |
| sheets_history | history.test.ts | PASS |
| sheets_quality | quality.test.ts | PASS |
| sheets_session | session.test.ts + 4 more | PASS |
| sheets_templates | templates.test.ts | PASS |
| sheets_transaction | transaction.test.ts | PASS |
| sheets_visualize | visualize.test.ts | PASS (elicitation cross-test fails) |
| sheets_webhook | webhook.test.ts + 2 more | PASS |

Note: elicitation-wizards.test.ts is a cross-tool file testing chart_create (visualize) + add_conditional_format_rule (format)

## Files to Reference

- Auth guard: `src/utils/auth-guard.ts`
- Auth gate in server: `src/server.ts:728`
- Action counts: `src/generated/action-counts.ts` (re-exported via `src/schemas/action-counts.ts`)
- Tool completions: `src/generated/completions.ts` (re-exported via `src/mcp/completions.ts`)
- Handler deviations: `src/schemas/handler-deviations.ts`
- Cache invalidation graph: `src/services/cache-invalidation-graph.ts`
- Tool annotations: `src/generated/annotations.ts`
- Tool definitions: `src/mcp/registration/tool-definitions.ts`
- Output validation: `src/mcp/registration/tool-response.ts:222`
- Scope map: `src/security/operation-scopes-map.ts`
- Scope validator: `src/security/incremental-scope.ts`
- Minimal descriptions: `src/schemas/descriptions-minimal.ts`
