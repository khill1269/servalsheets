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

### Test Results (2026-02-18)

- 6680 total tests: 6019 pass, 28 fail, 633 skipped (99.5% pass rate)
- 12 failing test files, categorized:
  - 3 contract tests: Import `src/mcp/registration.js` which was deleted
  - 3 compliance tests: Server instructions decision tree coverage
  - 2 compliance tests: Response truncation hints
  - 1 chaos test: Token refresh exhaustion
  - 1 SDK test: Action count extraction
  - 1 util test: Webhook handler case count (expects 6, got 7)
  - 5 google-api service tests: Mock setup issue (`google.docs is not a function`)
  - 1 cache invalidation test: Missing invalidation rules for new actions

### MCP Resources

- 68 MCP resources registered
- Resources work even when not authenticated
- Schema resources provide complete input/output schema definitions
- Metrics dashboard tracks tool usage, cache, API efficiency

### Performance Baseline

- Server uptime: stable over 100+ minutes
- Memory usage: ~201MB (stable)
- Cache: 57% hit rate (schema-validation namespace)
- Fast test suite: 3.96s (81 files, 2112 tests)
- Full test suite: 13.48s (278 files, 6680 tests)

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

### agencyHint / requiredScopes — FALSE SESSION NOTE

- Session 108 notes claim `agencyHint` (SEP-1792) and `requiredScopes` (SEP-1880) were added
- These fields do NOT exist anywhere in the codebase (confirmed via full-repo grep)
- `ToolAnnotations` interface at `src/schemas/shared.ts:1515` has only 5 standard MCP fields
- The MEMORY.md note from Session 112 repeating this claim is also incorrect — ignore it

### Stale Comment in Generated Completions

- `src/generated/completions.ts` line 21 says "sheets_analyze has 23 actions"
- Actual count: 26 (matches `ACTION_COUNTS.sheets_analyze = 26` and the 26-item array)
- This is a stale comment in a generated file — functionally harmless but misleading

### Schema Completeness — All 25 Tools Verified

- All 25 tool Zod schemas have correct discriminated unions matching ACTION_COUNTS
- All 25 tools have output schemas registered in `tool-definitions.ts`
- Output schema validation is ADVISORY only — gated behind `VALIDATE_OUTPUT_SCHEMAS` env var
- Output validation is per-tool (not per-action) — no granular per-action output validation

### Elicitation Wizards — All 4 Working

- `chart_create`: `src/handlers/visualize-actions/charts.ts:188` — calls `deps.context.server.elicitInput()`, 2-step form
- `add_conditional_format_rule`: `src/handlers/format-actions/conditional.ts:405` — calls `elicitConditionalFormatPreset()`
- `core.create`: `src/handlers/core-actions/spreadsheet-ops.ts:269` — calls `elicitSpreadsheetCreation()`
- `transaction.begin`: `src/handlers/transaction.ts:68` — calls `this.context.server.elicitInput()`
- All 4 are non-blocking (try/catch), degrade gracefully if client doesn't support elicitation
- `mode: 'form'` usage in charts.ts is VALID — confirmed in SDK types.d.ts line 4982

### MUTATION_ACTIONS Parity

- Two separate MUTATION_ACTIONS sets exist and are identical:
  - `src/middleware/audit-middleware.ts:159` (typed as `MutationEvent['action']`)
  - `src/middleware/write-lock-middleware.ts:27` (typed as `string`)
- A third set `FORCE_WRITE_ACTIONS` in write-lock-middleware covers additional structural mutations

### auto_fill Naming Collision (Not a Bug)

- Both `sheets_data` and `sheets_dimensions` have an `auto_fill` action
- This is safe — routing is per-tool, action names only need uniqueness within a tool

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
