# ServalSheets Task Backlog

> Persistent backlog of planned work. Updated across sessions.
> For session-level context (what just happened, decisions), see `.serval/session-notes.md`.

## Active Phase: Remediation & Architecture (P16)

Goal: Fix post-P15 wiring gaps, activate dormant performance systems, and build formula evaluation + pipeline execution capabilities.

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

## Completed Phase: Quality Hardening & Protocol Completeness (P7–P15)

> Completed Sessions 36-38 (2026-02-23). Committed as `3d6e731` — 103 files changed, 12,786 insertions.
> 22 tools, 340 actions (was 335). All 2,253 tests pass.

### P7 — Critical Bug Fixes ✅

- [x] **P7-B1**: Fix cache invalidation rule name mismatch — `sheets_fix.auto_fix` → `sheets_fix.fix` — Session 37
- [x] **P7-B2**: Add 20 missing P4 cache invalidation rules (cross_write, clean, standardize_formats, fill_missing, restore_cells, auto_enhance, create_scenario_sheet + 13 read-only entries) — Session 37
- [x] **P7-B3**: Full cache graph key audit — corrected `sheets_core.rename`, slicer actions moved to `sheets_dimensions`, 3 collaborate reply actions — Session 37
- [x] **P7-VERIFY**: npm run verify:safe passed — Session 37

### P8 — Safety Regressions ✅

- [x] **P8-S1**: `history.undo/redo/revert_to` — added `confirmDestructiveAction()` + `createSnapshotIfNeeded()` — Session 37
- [x] **P8-S2**: 8 `dimensions` destructive actions — fixed insert order (snapshot → confirm → execute), added to move/hide/show/append, `advanced.add_protected_range` — Session 37
- [x] **P8-VERIFY**: Safety rail order audit passed — Session 37

### P9 — API Correctness & Performance ✅

- [x] **P9-A1**: `analyze_performance` unbounded fetch fixed — added `maxSheets` param + batchGet for formula ranges — Session 37
- [x] **P9-A2**: Double `spreadsheets.get` in `list_data_validations` + `detect_spill_ranges` merged — Session 37
- [x] **P9-A3**: `share_get_link` pre-existence check removed — Session 37

### P10 — Type Safety ✅

- [x] **P10-T1**: 21 `as any` casts fixed in core.ts, session.ts, appsscript.ts, quality.ts — Session 37
- [x] **P10-T2**: `SESSION_ERROR` added to `ErrorCodeSchema`; `mapStandaloneError()` extracted to `src/handlers/helpers/error-mapping.ts` — Session 37
- [x] **P10-T3**: Pre-existing TypeScript errors in suggestion-engine.ts, excel-online-backend.ts, notion-backend.ts fixed — Session 38

### P11 — Architecture Consistency ✅

- [x] **P11-A1**: Verbosity filter extracted to `src/handlers/helpers/verbosity-filter.ts`; progress reporting added to 4 handlers — Session 37
- [x] **P11-A2**: All 22 handler switch defaults use TypeScript `never` exhaustiveness pattern — Session 37

### P12 — Schema Completeness ✅

- [x] **P12-S1**: Pagination added to list_data_validations, list_filter_views, cross_read; `superRefine` on core.get — Session 37
- [x] **P12-S2**: `ChartTypeSchema` + `A1NotationSchema` enum constraints added — Session 37
- [x] **P12-S3**: `textRotation`, `padding`, `spreadsheetTheme`, `filterCriteria`, `foregroundColorStyle`, `backgroundColorStyle` added to schemas — Session 37
- [x] **P12-S4**: MCP SDK workaround documented; regression test added for collaborate discriminated union — Session 37

### P13 — MCP Protocol Completeness ✅

- [x] **P13-M1**: Task IDs (SEP-1686) on 7 long-running operations — Session 37
- [x] **P13-M2**: Session Context wired to 10 handler actions — Session 37
- [x] **P13-M3**: Sampling (SEP-1577) on 5 high-value actions (find_replace, suggest_format, model_scenario, diff_revisions, comment_add) — Session 37
- [x] **P13-M4**: Elicitation wizards (SEP-1036) on 4 complex actions (chart_create, add_conditional_format_rule, core.create, transaction.begin) — Session 37

### P14 — Composite Workflows ✅

- [x] **P14-C1**: 5 composite workflow actions added to `sheets_composite` (14 → 19 actions, 335 → 340 total): audit_sheet, publish_report, data_pipeline, instantiate_template, migrate_spreadsheet — Session 38

### P15 — Documentation Sweep ✅

- [x] **P15**: CODEBASE_CONTEXT.md, README.md, descriptions.ts all updated to 340 actions — Session 38

---

## P16-Remediation Unified Plan

> Identified Session 39 (2026-02-24). Consolidates two parallel work streams:
> (A) Audit remediation (ISSUES.md ISSUE-NNN confirmed defects via Remediation Plan Waves 1-6)
> (B) Post-P15 internal gaps (P16 phases below).
> Claude Code task tracker Tasks #14-24 map to consolidated execution batches.
>
> Execution order: Tasks 14+15+16+17 in parallel → 18 → 19 → 20 → 21 → 22 → 23/24
> ISSUES.md = lookup reference only (not a tracking document).

### Remediation Wave Status (ISSUES.md confirmed defects)

Batched into Claude Code tasks by parallel-safety and schema dependencies:

| Batch               | Task | Issues                                                    | Schema?                                      |
| ------------------- | ---- | --------------------------------------------------------- | -------------------------------------------- |
| Wave 1A             | #14  | ISSUE-088, 16-B5                                          | No — run in parallel                         |
| Wave 1B             | #15  | ISSUE-096, ISSUE-049, ISSUE-041, ISSUE-200, 16-B4         | No — run in parallel                         |
| Wave 1C             | #16  | ISSUE-013, ISSUE-099, 16-S1, 16-S2, ISSUE-136             | No — run in parallel                         |
| Wave 1D             | #17  | ISSUE-093, ISSUE-113, 16-B1/B2/B3, 16-S3/S4/S5, ISSUE-211 | No — run in parallel                         |
| Wave 1E             | #18  | ISSUE-071 (npm audit)                                     | No — after Wave 1                            |
| Wave 2 + 16-C2      | #19  | ISSUE-039/011/145/204 + 6 more paginations                | **Yes** — schema:commit required             |
| Wave 3 + P16-Phase3 | #20  | ISSUE-015/016/019 + 16-A1-A6                              | No                                           |
| Wave 4 + Wave 5     | #21  | ISSUE-090/102/117/214 + ISSUE-066/107/119                 | No                                           |
| Wave 6 + P16-Phase5 | #22  | ISSUE-085/101/161/162/169 + 16-U1-U5                      | No                                           |
| P16-Phase6          | #23  | 16-F1-F6                                                  | Blocked (license)                            |
| P16-Phase7          | #24  | 16-P1-P4                                                  | **Yes** — schema:commit for execute_pipeline |

Deferred (requires architecture decision): ISSUE-094 (persistent idempotency), ISSUE-086 (formula locale), ISSUE-075 (@serval/core publish), ISSUE-147 (server-side mutex), ISSUE-168 (error path coverage), ISSUE-173/174/175 (enterprise auth/semantic search).

### P16-Phase1 — Critical Bugs (→ Task #14 Wave 1A + Task #17 Wave 1D)

New bugs found AFTER P7-P15 — distinct from the items P7 addressed:

- [ ] **16-B1**: `src/mcp/completions.ts:17` — stale comment says "305 actions" (actual: 340). Causes confusion in drift checks.
- [ ] **16-B2**: `src/schemas/descriptions.ts:11` — says "22 tools, 335 actions" (actual: 340).
- [ ] **16-B3**: `src/services/cache-invalidation-graph.ts:155-165` — conditional format action names still stale: `sheets_format.add_rule/update_rule/delete_rule/list_rules/clear_rules/reorder_rules` → correct names: `add_conditional_format_rule`, `rule_add_conditional_format`, `rule_update_conditional_format`, `rule_delete_conditional_format`, `rule_list_conditional_formats`. Cache never invalidates on conditional format mutations despite P7 believing it was fixed.
- [ ] **16-B4**: `src/handlers/format.ts:702, 902` — `suggest_format` makes two identical `spreadsheets.get()` calls (main path + `handleSuggestFormatRuleBased()` fallback). Extract shared result, pass to fallback.
- [ ] **16-B5**: `src/services/cross-spreadsheet.ts:73` — `fetchRangeGrid()` calls `sheetsApi.spreadsheets.values.get()` directly without `executeWithRetry()`. Makes entire F2 federation feature fragile under transient failures.

### P16-Phase2 — Safety Gaps in P14 Actions (→ Task #16 Wave 1C)

P14 added 5 composite actions; snapshot/circuit breaker coverage needs verification:

- [ ] **16-S1**: `composite.data_pipeline` (handlers/composite.ts:~1712) — mutates data but likely missing `createSnapshotIfNeeded()`. Verify and add.
- [ ] **16-S2**: `composite.instantiate_template` (~1880) + `composite.migrate_spreadsheet` (~1965) — audit snapshot coverage and add if missing.
- [ ] **16-S3**: `src/handlers/federation.ts` — claims "circuit breaker protection" (line 28) but has no circuit breaker for remote MCP calls. Wire `CircuitBreaker` for remote calls.
- [ ] **16-S4**: `src/handlers/webhooks.ts` — no circuit breaker for HTTP POST deliveries to external endpoints. Wire `CircuitBreaker` for outbound webhook calls.
- [ ] **16-S5**: Both federation.ts and webhooks.ts do not use `mapStandaloneError()` or `applyVerbosityFilter()` helpers added in P10/P11. Standardize.

### P16-Phase3 — Activate Dormant Performance Systems (→ Task #20)

Fully implemented systems that are wired but never triggered:

- [ ] **16-A1**: `src/services/sampling-context-cache.ts` — exists, fully implemented, **never imported anywhere**. Wire `getSpreadsheetContext()` into `src/mcp/sampling.ts` before building sampling prompts. Saves 200-400ms per sampling call.
- [ ] **16-A2**: `src/handlers/analyze.ts:478` — `WorkerPool` threshold `rowCount > 10000` is too high. Lower to `> 1000`. Workers never activate for typical Claude workloads (500-5000 rows).
- [ ] **16-A3**: `PrefetchingSystem` + `AccessPatternTracker` — learns patterns but never acts. Add `recordAccess()` on cache miss and `prefetch()` trigger post-read in `CachedSheetsApi`.
- [ ] **16-A4**: `PrefetchingSystem` is request-level only. Add tool-level tracking so patterns cross request boundaries within a session.
- [ ] **16-A5**: `src/services/concurrency-coordinator.ts` — adapts on quota (429) only; `process.memoryUsage()` never called. Add heap pressure monitoring; reduce concurrency when heap > 80%.
- [ ] **16-A6**: `readOnlyMode` circuit breaker fallback — implemented in circuit-breaker.ts but client ignores return value. Wire response so callers fall back to cached data when circuit opens.

### P16-Phase4 — Cache Graph + Pagination Gaps (→ Task #17 Wave 1D + Task #19 Schema Batch)

Post-P12 gaps identified by deeper audit:

- [ ] **16-C1**: Cache graph missing 3 read-only entries for P5 AI actions: `sheets_format.suggest_format`, `sheets_visualize.suggest_chart`, `sheets_visualize.suggest_pivot`. These should invalidate (read-only cache entry prevents stale suggestion data).
- [ ] **16-C2**: `src/handlers/advanced.ts` — 6 list operations without pagination (P12-S1 only covered 3 others): `list_named_ranges:381`, `list_protected_ranges:573`, `list_banding:924`, `list_tables:1062`, `list_named_functions:1641`, `list_chips:1518`. Add `nextCursor`/`hasMore`/`totalCount` + `npm run schema:commit`.

### P16-Phase5 — Claude UX Improvements (→ Task #22)

Post-P5 gaps found in MCP features file and completions:

- [ ] **16-U1**: `src/mcp/features-2025-11-25.ts` — P14 composite actions (audit_sheet, publish_report, data_pipeline, instantiate_template, migrate_spreadsheet) absent from all decision trees. Add them.
- [ ] **16-U2**: `sheets_session` (26 actions) mentioned only once in server instructions — needs "LLM continuity" guidance section explaining checkpoint/pending/preferences pattern.
- [ ] **16-U3**: Federation workflow example missing from server instructions.
- [ ] **16-U4**: `src/mcp/completions.ts:562-681` (ACTION_ALIASES) — missing aliases for: `audit`→`audit_sheet`, `publish`→`publish_report`, `pipeline`/`etl`→`data_pipeline`, `scenario`/`what-if`→`model_scenario`, `cross`/`multi`→`cross_read`, `remote`→`call_remote`.
- [ ] **16-U5**: `src/mcp/registration/prompt-registration.ts` — 7 prompts missing for P14 actions: audit_sheet, publish_report, data_pipeline, instantiate_template, migrate_spreadsheet, cross_sheet_analysis, scenario_what_if.

### P16-Phase6 — Formula Evaluation Engine (→ Task #23, blocked on license)

HyperFormula-based local formula evaluation for scenario modeling:

- [ ] **16-F1**: Evaluate HyperFormula license — GPL-v3 (open source projects) vs commercial (~$2K/year). Decision gate before any implementation.
- [ ] **16-F2**: Implement 3-layer evaluator: Layer 1 = HyperFormula (395 functions, local), Layer 2 = Google Sheets API (authoritative fallback), Layer 3 = Apps Script bound script (QUERY/FILTER/IMPORTRANGE/GOOGLEFINANCE). New file: `src/services/formula-evaluator.ts`.
- [ ] **16-F3**: Wire evaluator into `dependencies.model_scenario` + `compare_scenarios` (currently estimates only). Structural sharing pattern: frozen base grid + overlay Map per scenario.
- [ ] **16-F4**: Wire evaluator into `analyze.generate_formula` dry-run verification mode.
- [ ] **16-F5**: Apps Script bound script (`src/services/apps-script-evaluator.ts`) — `SpreadsheetApp.flush()` for synchronous recalc. Needs OAuth scope verification.
- [ ] **16-F6**: Tests covering: HyperFormula path, Google API fallback, Apps Script path, `ErrorType.NOT_AVAILABLE` sentinel for unsupported functions.

### P16-Phase7 — Cross-Tool Pipeline Executor (→ Task #24)

DAG-based parallel execution of multi-step tool sequences:

- [ ] **16-P1**: Implement `PipelineExecutor` service — DAG dependency resolver, READ vs WRITE classification, conservative sequential default for ambiguous cases. New file: `src/services/pipeline-executor.ts`.
- [ ] **16-P2**: Add `execute_pipeline` action to `sheets_session` (26 → 27 actions). Schema: `{ steps: [{ tool, action, params, dependsOn?: string[] }] }`. Run `npm run schema:commit`.
- [ ] **16-P3**: Wire `PipelineExecutor` into the handler — parallel READ steps, sequential WRITE steps, fail-fast on error with partial rollback.
- [ ] **16-P4**: Integration tests for common pipeline patterns: read→transform→write, multi-source federation, audit→fix→publish.

---

## Completed

- [x] Audit infrastructure (8/8 steps, 981 tests) — Session 9
- [x] Continuity system (Option D: state.md + session-notes.md) — Session 10
- [x] DX overhaul (CLAUDE.md, state generator, verify:safe) — Session 11
- [x] Pipeline restoration (ESLint AJV, drift hang, silent fallbacks) — Session 12
- [x] CLAUDE.md restructure (1081 → 195 lines, ARCHITECTURE.md created) — Session 13
- [x] TASKS.md + session-notes.md tracking system — Session 13
- [x] P7-P15 Quality Hardening & Protocol Completeness — Sessions 36-38, 2026-02-23 (commit `3d6e731`, 103 files, 12,786 insertions, 335 → 340 actions, 2,253/2,253 tests)
