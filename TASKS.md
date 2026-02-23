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
- [x] F3: Automated Data Cleaning — extend `sheets_fix` (+5 actions: `clean`, `standardize_formats`, `fill_missing`, `detect_anomalies`, `suggest_cleaning`) — Session 24

Phase 2 — Medium Lift (2-3 sessions each):
- [ ] F1: Natural Language Sheet Generator — extend `sheets_composite` (+3 actions: `generate_sheet`, `generate_template`, `preview_generation`)
- [ ] F5: Time-Travel Debugger — extend `sheets_history` (+3 actions: `timeline`, `diff_revisions`, `restore_cells`)

Phase 3 — Complex Features (3-4 sessions each):
- [ ] F6: Scenario Modeling — extend `sheets_dependencies` (+3 actions: `model_scenario`, `compare_scenarios`, `create_scenario_sheet`)
- [ ] F2: Multi-Spreadsheet Federation — extend `sheets_data` (+4 actions: `cross_read`, `cross_query`, `cross_write`, `cross_compare`)

## Completed

- [x] Audit infrastructure (8/8 steps, 981 tests) — Session 9
- [x] Continuity system (Option D: state.md + session-notes.md) — Session 10
- [x] DX overhaul (CLAUDE.md, state generator, verify:safe) — Session 11
- [x] Pipeline restoration (ESLint AJV, drift hang, silent fallbacks) — Session 12
- [x] CLAUDE.md restructure (1081 → 195 lines, ARCHITECTURE.md created) — Session 13
- [x] TASKS.md + session-notes.md tracking system — Session 13
