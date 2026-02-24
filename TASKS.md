# ServalSheets Task Backlog

> Persistent backlog of planned work. Updated across sessions.
> For session-level context (what just happened, decisions), see `.serval/session-notes.md`.

## Active Phase: Platform Evolution

Goal: Extract shared logic into `@serval/core` so ServalSheets becomes one backend among many.

## Backlog

### P0 — serval-core Extraction

Status: **Module migration complete.** Adapter wiring and publish remain.

Migrated (Session 14-15):

- [x] Audit `src/` vs `packages/serval-core/src/` duplicates — Session 14
- [x] `src/utils/retry.ts` → imports base from `@serval/core`, adds Google-specific extensions — Session 14
- [x] `src/utils/circuit-breaker.ts` → re-exports from `@serval/core`, adds `readOnlyMode` — Session 14
- [x] `src/core/errors.ts` → extends `ServalError` from `@serval/core` — Session 14
- [x] `src/utils/redact.ts` → already re-exports from `@serval/core` (pre-existing) — Session 15
- [x] `src/utils/bounded-cache.ts` → already re-exports from `@serval/core` (pre-existing) — Session 15
- [x] `src/services/google-api.ts` → transitively uses core via retry.ts + circuit-breaker.ts — Session 15
- [x] Contract tests pass (815/815) after all migrations — Session 14

Deferred (documented rationale):

- [ ] `src/utils/logger.ts` → DEFERRED (126 callers, deep AsyncLocalStorage request-context integration)
- [ ] `src/services/history-service.ts` → DEFERRED (`spreadsheetId`→`documentId` rename is P3 multi-backend)
- [ ] `src/observability/metrics.ts` → DEFERRED (name prefix `servalsheets_*` vs core `serval_*`; changing breaks dashboards)

Remaining:

- [x] Wire `GoogleSheetsBackend` adapter into handler layer — Session 16 (added to `HandlerContext.backend`, created + injected in `server.ts`, disposed in `shutdown()`)
- [ ] Publish `@serval/core` v0.2.0

### P1 — Build & DX Polish

- [x] Fix `docs/development/PROJECT_STATUS.md` stale entries — Session 17
- [x] Update `.serval/state.md` known issues — Session 17
- [x] ESLint OOM fix — switched to `projectService` (4GB→3GB), excluded `src/ui/**`, removed stale `--ext .ts` — Session 17
- [x] Reduce silent fallback false positives (13→0) — added inline intent comments to all guard-clause returns — Session 17

### P2 — Feature Flags

Audited all 6 flags (Session 18). Enabled 3 safe flags, kept 3 opt-in.

Enabled (default ON) — Session 18:

- [x] `ENABLE_PARALLEL_EXECUTOR` — 40% faster batch reads, 19 tests pass, threshold-guarded (100+ ranges)
- [x] `ENABLE_AUDIT_LOGGING` — compliance audit trail, non-critical (try/catch), 8 tests pass
- [x] `ENABLE_IDEMPOTENCY` — retry-safe tool calls via key-based dedup, 3 test files pass

Remain opt-in (require infrastructure):

- [ ] `ENABLE_RBAC` — requires role/permission config; would block requests without setup
- [ ] `ENABLE_TENANT_ISOLATION` — requires API key infrastructure; would break single-tenant
- [ ] `ENABLE_COST_TRACKING` — per-request overhead; useful only for SaaS/multi-tenant

### P3 — Future Backends

Once serval-core is extracted, these become possible:

- [x] Excel Online backend scaffold — Session 19 (607 lines, implements full SpreadsheetBackend, maps to Microsoft Graph API, validates interface is platform-agnostic)
- [x] Notion backend scaffold — Session 20 (924 lines, maps property-based DB model to cell-grid interface, synthetic A1 range mapping, validates interface works for non-grid platforms)
- [x] Airtable backend scaffold — Session 21 (924 lines, multi-table base model maps naturally to multi-sheet, batch ops in groups of 10, validates interface for record-oriented platforms)
- [ ] Google Docs backend (via `@serval/core` interfaces)

### P4 — Competitive Differentiation Features

Full specs in `docs/development/FEATURE_PLAN.md`. 6 features, 20 new actions (315 → 335), 0 new tools.

Phase 1 — Quick Wins (1-2 sessions each):

- [x] F4: Smart Suggestions / Copilot — extend `sheets_analyze` (+2 actions: `suggest_next_actions`, `auto_enhance`) — Session 24
- [x] F3: Automated Data Cleaning — extend `sheets_fix` (+5 actions: `clean`, `standardize_formats`, `fill_missing`, `detect_anomalies`, `suggest_cleaning`) — Session 26

Phase 2 — Medium Lift (2-3 sessions each):

- [x] F1: Natural Language Sheet Generator — extend `sheets_composite` (+3 actions: `generate_sheet`, `generate_template`, `preview_generation`) — Session 28
- [x] F5: Time-Travel Debugger — extend `sheets_history` (+3 actions: `timeline`, `diff_revisions`, `restore_cells`) — Session 30

Phase 3 — Complex Features (3-4 sessions each):

- [x] F6: Scenario Modeling — extend `sheets_dependencies` (+3 actions: `model_scenario`, `compare_scenarios`, `create_scenario_sheet`) — Session 31 (schema + handler inline; 11 tests added)
- [x] F2: Multi-Spreadsheet Federation — extend `sheets_data` (+4 actions: `cross_read`, `cross_query`, `cross_write`, `cross_compare`) — Session 32 (cross-spreadsheet.ts service, 16 tests, 331→335 actions)

### P5 — Claude Optimization (LLM Discoverability)

Completed Session 33-34: Make all 335 actions discoverable and safe for Claude.

- [x] Phase 1: Updated 6 tool descriptions for 20 P4 actions in `src/schemas/descriptions.ts` — Session 33
- [x] Phase 2: Updated server instructions decision tree in `src/mcp/features-2025-11-25.ts` (+5 sections, +4 workflows) — Session 33
- [x] Phase 3: Verified all 22 tool icons present — Session 33
- [x] Phase 4: Added `validateSpecialCaseCounts()` guard in `scripts/generate-metadata.ts` — Session 33
- [x] Phase 5: Added per-action `[Read-only]`/`[Destructive]`/`[Non-idempotent]`/`[Safe mutation]` safety hints to 7 tools — Session 34

### P6 — API Feature Audit Fixes

Audit conducted Session 34. 9 confirmed issues, 1 disproven (gridRange already implemented).
Full audit scope: Google Sheets API feature coverage vs ServalSheets implementation.

**High Priority — Session 35:**

- [x] A1: `diff_revisions` returns metadata-only — Drive API limitation made transparent in handler message + descriptions — Session 35
- [x] A2: `model_scenario`/`compare_scenarios` now fetches current values + formulas for affected cells (500-cell cap) — Session 35
- [x] A3: `create_scenario_sheet` added `sourceSheetName` param; infers from cell refs as fallback — Session 35

**Medium Priority — Session 35:**

- [x] A4: `chart_add_trendline` marked deprecated in descriptions (REST API limitation) — Session 35
- [x] A5: User profile storage warns on startup when using `/tmp` default — Session 35
- [x] A6: Slicer `filterCriteria` exposed in create/update schema + handler — Session 35

**Low Priority — Session 35:**

- [x] A7: Named function `as any` casts replaced with `ExtendedSpreadsheetProperties` interface + `as Schema$Request` for batchUpdate — Session 35
- [x] A8: `copy_paste` now tracks confirmation skip via `recordConfirmationSkip()` (matching `cut_paste`) — Session 35
- [x] A9: Fix stubs replaced with descriptive NOT_IMPLEMENTED comments — Session 35

**Disproven (no action):**

- [x] ~~gridRange DataFilter missing~~ — Already present in `schemas/shared.ts:595-603` with all 3 variants.

**Confirmed Correct (no action):**

- [x] Macros not implemented — no REST API exists
- [x] Triggers return `NOT_IMPLEMENTED` — no external REST API exists
- [x] `pivot_refresh` is a no-op — Google auto-refreshes pivots

---

## Active Phase: Quality Hardening & Protocol Completeness (P7–P15)

> Full analysis conducted Session 36 (2026-02-23). 4 parallel agents audited all 22 tools × 335 actions
> across: handler patterns, schema coherence, API efficiency, and MCP orchestration.
> Task IDs 1-20 in Claude Code task tracker map to items below.

### P7 — Critical Bug Fixes (Active bugs causing incorrect behavior)

> ✅ **Already fixed (prior session):** TypeScript errors in `dependencies.ts` and `dimensions.ts` — 10 errors (null safety, boolean coercion, filterCriteria type mapping, index signature access). All 1,946+ tests pass.

- [ ] **P7-B1** (Task #1): Fix cache invalidation rule name mismatch — `sheets_fix.auto_fix` → `sheets_fix.fix` in `src/services/cache-invalidation-graph.ts:419`. Rule never fires; post-fix reads return stale data.
- [ ] **P7-B2** (Task #2): Add 20 missing P4 cache invalidation rules to `cache-invalidation-graph.ts`. 7 mutating actions (cross_write, clean, standardize_formats, fill_missing, restore_cells, auto_enhance, create_scenario_sheet) cause cache staleness.
- [ ] **P7-B3** (Task #21): **BROADER ISSUE** — Full cache graph key audit. At least 6 additional stale rule keys beyond B1: `sheets_core.rename`, `sheets_core.rename_sheet`, `sheets_data.read_metadata`, `sheets_data.copy_range`, slicer actions under `sheets_visualize` (moved to `sheets_dimensions`), and 3 collaborate comment reply actions. Auto-backfill at lines 570-581 prevents total breakage but all stale keys are dead rules. Fix all stale keys OR refactor graph to auto-generate from schema.
- [ ] **P7-VERIFY** (Task #18): Gate — npm run verify:safe + cross-reference every rule key in graph against actual action names. Blocked by P7-B1 + P7-B2 + P7-B3.

### P8 — Safety Regressions (Data loss risk)

- [ ] **P8-S1** (Task #3): Add `confirmDestructiveAction()` + `createSnapshotIfNeeded()` to `history.undo` (line 159), `history.redo` (line 233), `history.revert_to` (line 307). Currently execute without any safety rails.
- [ ] **P8-S2** (Task #4): Add `createSnapshotIfNeeded()` to 8 `dimensions` destructive actions (insert, move, hide, show, append). Fix insert to: snapshot → confirm → execute (currently inverted). Add both safety rails to `advanced.add_protected_range`.
- [ ] **P8-VERIFY** (Task #19): Gate — npm run verify:safe + manual safety rail order audit. Blocked by P8-S1 + P8-S2.

### P9 — API Correctness & Performance

- [ ] **P9-A1** (Task #5): Fix `analyze_performance` unbounded `includeGridData: true` at `analyze.ts:796`. No ranges parameter, no sheet count guard — fetches up to 520k cells. Add maxSheets param + use batchGet for formula ranges.
- [ ] **P9-A2** (Task #6): Merge double `spreadsheets.get` calls in `list_data_validations` (format.ts:2055-2108) and `detect_spill_ranges` (data.ts:2918-2940). Apply `MAX_CELLS_PER_REQUEST` cap to detect_spill_ranges.
- [ ] **P9-A3** (Task #22): Remove unnecessary pre-existence check in `share_get_link` (`collaborate.ts:604-607`). 1 quota unit wasted per call — `permissions.list` would 404 anyway if file missing.

### P10 — Type Safety

> ✅ **Already clean:** `dependencies.ts` and `dimensions.ts` — 0 `as any` casts (verified by grep). Confirmed fixed in prior session.

- [ ] **P10-T1** (Task #7): Fix 18 `as any` casts in remaining 4 handlers — `core.ts:986-1005` (9 consecutive), `session.ts:136,304,315,361,526`, `appsscript.ts:1034`, `quality.ts:136,237`.
- [ ] **P10-T2** (Task #8): Standardize `ErrorCodeSchema` enum usage. All 22 handlers hardcode string literals. Extract `mapStandaloneError()` helper to `src/handlers/helpers/error-mapping.ts` for 9 standalone handlers.
- [ ] **P10-T3** (Task #23): Fix pre-existing TypeScript errors in 3 scaffold files — `src/analysis/suggestion-engine.ts`, `src/adapters/excel-online-backend.ts`, `src/adapters/notion-backend.ts`. These block `npm run typecheck` from passing. Fix root type issues, no `as any` casts.

### P11 — Architecture Consistency

- [ ] **P11-A1** (Task #9): Extract verbosity filter helper from 8 standalone handlers (copy-pasted identically in quality.ts:40, session.ts:41, history.ts:46, auth.ts:92, transaction.ts:28 + 3 more). Add progress reporting to quality.validate, transaction.commit, session bulk ops, federation.
- [ ] **P11-A2** (Task #10): Standardize all 22 handler switch default cases to TypeScript `never` exhaustiveness pattern (currently mixed: never, throw, implicit return).

### P12 — Schema Completeness

- [ ] **P12-S1** (Task #11): Add pagination (`nextCursor`, `hasMore`, `totalCount`) to list_data_validations, list_filter_views, analyze.comprehensive. Fix cross_read response field `mergedValues` → `rows`. Add `superRefine` to core.get for `includeGridData` requires `ranges`. Run `npm run schema:commit`.
- [ ] **P12-S2** (Task #12): Add enum constraints to 8 string fields (chartType, shapeType in visualize; aggregation, sortOrder in analyze). Standardize A1 notation validation using shared `A1NotationSchema` for add_note, set_hyperlink, slicer anchorCell. Run `npm run schema:commit`.
- [ ] **P12-S3** (Task #24): Add missing Google API v4 params — `textRotation` + `padding` on set_format; `spreadsheetTheme` on update_properties; multi-column `sortSpecs` array on sort_range (currently single-column only). Run `npm run schema:commit`.
- [ ] **P12-S4** (Task #25): Document sheets_collaborate discriminated union MCP SDK workaround (`collaborate.ts:98`). Add regression test verifying refine() catches all 35 invalid field combos. Add migration TODO for when SDK is fixed. 40% schema bloat + no type narrowing until then.

### P13 — MCP Protocol Completeness

- [ ] **P13-M1** (Task #13): Add Task IDs (SEP-1686) to 7 long-running handlers — bigquery (export/import), appsscript (run), composite (export_large_dataset), history (timeline), data (cross_read >3 sources), federation (all 4 actions). Copy pattern from analyze.ts:2385.
- [ ] **P13-M2** (Task #14): Wire Session Context to 10 handlers — data.read (active_range), format.suggest_format (filter rejected), fix.suggest_cleaning (learning), fix.clean (record rules), dimensions (schema state), visualize.chart_create (store ID), data.cross_read, history.timeline, data.write.
- [ ] **P13-M3** (Task #15): Add Sampling (SEP-1577) to 5 actions — data.find_replace (suggest patterns), format.suggest_format (richer suggestions), dependencies.model_scenario (estimate formulas), history.diff_revisions (explain changes), collaborate.comment_add (context templates). All with graceful fallback.
- [ ] **P13-M4** (Task #16): Add Elicitation wizard flows (SEP-1036) to 4 complex actions — visualize.chart_create (4 steps), format.add_conditional_format_rule (4 steps), core.create (4 steps), transaction.begin (transaction builder). All via optional `interactive: true` param.

### P14 — Composite Workflows

- [ ] **P14-C1** (Task #17): Add 5 pre-built composite workflow actions to `sheets_composite` (14 → 19 actions, 335 → 340 total):
  - `audit_sheet` — analyze + validate + suggest_cleaning → unified audit result
  - `publish_report` — format + export + share with rollback safety
  - `data_pipeline` — clean + validate + write with all-or-nothing semantics
  - `instantiate_template` — load template + fill + format + share
  - `migrate_spreadsheet` — cross_read + cross_write + clean + verify (row count match)
  - Run `npm run schema:commit` after.

### P15 — Documentation Sweep (blocked by all P7-P14)

- [ ] **P15** (Task #20): Update CODEBASE_CONTEXT.md (action counts, MCP feature table), FEATURE_PLAN.md, session-notes.md, MEMORY.md (new anti-patterns, safety rail order), README.md (action count), descriptions.ts (4 thin tool descriptions: quality, history, session, templates).

---

## Completed

- [x] Audit infrastructure (8/8 steps, 981 tests) — Session 9
- [x] Continuity system (Option D: state.md + session-notes.md) — Session 10
- [x] DX overhaul (CLAUDE.md, state generator, verify:safe) — Session 11
- [x] Pipeline restoration (ESLint AJV, drift hang, silent fallbacks) — Session 12
- [x] CLAUDE.md restructure (1081 → 195 lines, ARCHITECTURE.md created) — Session 13
- [x] TASKS.md + session-notes.md tracking system — Session 13
