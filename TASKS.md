# ServalSheets Task Backlog

> Persistent backlog of planned work. Updated across sessions.
> For session-level context (what just happened, decisions), see `.serval/session-notes.md`.

## Active Phase: P18 — Decomposition & Refinement Execution

Goal: Execute the post-readiness backlog focused on maintainability decomposition and targeted refinement work while keeping verification gates green.

**Current baseline (2026-03-03, latest): 25 tools, 407 actions, `test:fast` green, 0 TS errors, MCP protocol suites green, `audit:coverage` green (1207/1207). Pre-next-phase blockers closed.**
**Phase handoff**: P19 readiness exit criteria are satisfied; P18 backlog execution is now active.

### P18 Immediate TODO (Kickoff)

- [x] P18-D3: Start `src/handlers/analyze.ts` decomposition (`analyze-actions/` split) while preserving behavior/tests.
- [x] P18-D4: Stage `src/handlers/composite.ts` decomposition (`composite-actions/` split) after D3.
- [x] P18-D5: Complete `src/handlers/core.ts` thin-dispatch decomposition and remove temporary size-budget override.
- [x] P18-D6: Complete `src/handlers/collaborate.ts` decomposition (`collaborate-actions/` split) and remove temporary size-budget override.
- [x] P18-D7: Complete `src/handlers/visualize.ts` decomposition (`visualize-actions/` split) and remove temporary size-budget override.
- [x] P18-D8: Complete `src/handlers/advanced.ts` decomposition (`advanced-actions/` split) and remove temporary size-budget override.
- [x] P18-D9: Draft server decomposition sequence for `src/server.ts` and `src/http-server.ts` extraction. (See `docs/development/P18_D9_SERVER_DECOMPOSITION_SEQUENCE.md`)
- [x] P18-D9A: Extract shared server/http utility modules (logging bridge + request/action extraction helpers). (`src/server-utils/logging-bridge-utils.ts`, `src/server-utils/request-extraction.ts`; `typecheck` + focused MCP/logging suites green)
- [x] P18-D9B: Extract `src/server.ts` tool-call pipeline modules (`handleToolCall` internals) and thin the class orchestrator. (`src/server-runtime/{tool-call-metrics,preinit-tool-routing,handler-dispatch,logging-bridge}.ts`; focused suites green)
- [x] P18-D9C: Extract `src/server.ts` registration/bootstrap modules and remove the `src/server.ts` size-budget override. (`src/server-runtime/{resource-registration,control-plane-registration,bootstrap}.ts` extracted; `src/server.ts` reduced `1898 -> 1356`; focused parity suites + typecheck + lint green)
- [x] P18-D9D: Extract `src/http-server.ts` middleware + observability/admin route modules. (`src/http-server/{middleware,routes-observability}.ts` extracted; `src/http-server.ts` `3259 -> 2168`; typecheck + focused HTTP suites green)
- [x] P18-D9E: Extract `src/http-server.ts` transport/session/webhook/lifecycle modules and remove the `src/http-server.ts` size-budget override. (`src/http-server/{transport-helpers,routes-webhooks,graphql-admin,routes-transport}.ts` extracted; `src/http-server.ts` `3259 -> 956`; override removed from `scripts/check-file-sizes.sh`; typecheck + targeted ESLint + focused HTTP suites green)
- [x] P18-D10: Complete final gate verification (`verify:safe`) for decomposition closure. (`check:file-sizes` green after `src/handlers/dimensions.ts` reduction to `2033`; `verify:safe` now passing)

## Completed Phase: Remediation & Architecture (P16)

All P16 items verified complete in codebase as of 2026-03-02 reaudit. TASKS.md was stale — items were implemented but not marked done.

## Historical Execution Track: Advanced Integration Completion (P17)

Goal: Complete runtime wiring and production hardening for recently added advanced capabilities (SQL/Python compute, workspace events, formula callback security, scheduler durability) while keeping verification gates green.
Status: Substantially complete; retained here as historical context while P18 is the active execution track.

### P17 Execution TODO

- [x] P17-01: Runtime wiring in `src/server.ts`
  - [x] Add DuckDB engine to handler context
  - [x] Add Scheduler service to handler context
  - [x] Trigger optional Python preload on startup when enabled
  - [x] Ensure Workspace Events service is injected at handler creation time

- [x] P17-02: Handler injection completion in `src/handlers/index.ts`
  - [x] Pass `duckdbEngine` + `samplingServer` into `ComputeHandler`
  - [x] Pass `scheduler` into `SessionHandler` (`setScheduler`)
  - [x] Pass `driveApi` + `workspaceEventsService` into `WebhookHandler`
  - [x] Pass `googleClient` into `HistoryHandler` for activity attribution

- [x] P17-03: History enrichment correctness
  - [x] Ensure `history.timeline` calls revision timeline with Drive Activity context
  - [x] Expose `activityAvailable` and actor metadata when enrichment exists

- [x] P17-04: Workspace events endpoint follow-through
  - [x] Replace placeholder route behavior for `/webhook/workspace-events` with manager-backed handling
  - [x] Keep callback non-blocking and robust against malformed envelopes

- [x] P17-05: Formula callback hardening
  - [x] Add request freshness validation (`timestamp` skew window)
  - [x] Add replay protection (nonce/signature cache window)
  - [x] Keep HMAC validation + rate limit + result cache behavior

- [x] P17-06: Toolchain resilience
  - [x] Resolve current local lint dependency mismatch (ESLint/AJV resolution) — resolved via npm audit fix (2026-03-15)
  - [x] `npm run verify` fully green — typecheck ✅ lint ✅ format ✅ alignment ✅ drift ✅ tests ✅ (2646/2646)

- [x] P17-07: Documentation/source-of-truth sync
  - [x] Update unified plan counts and status to current action totals
  - [x] Record completed P17 items in this backlog

## Completed Execution Track: Readiness & Source-of-Truth (P19)

Goal: Resolve discrepancies identified in the 2026-03-03 production audit verification and convert them into executable, tracked work before starting the next major improvement phase.

Reference report:

- `audit-output/production-audit-verification-2026-03-03.md`

### P19 Execution TODO

- [x] P19-01: Audit claim reconciliation (docs + reports)
  - [x] Update `ServalSheets_Production_Audit.md` to mark stale findings and refreshed metrics
  - [x] Update `MCP_AUDIT_REPORT.md` open-work section with newly verified gaps
  - [x] Ensure `UNIFIED_IMPROVEMENT_PLAN.md` and this backlog share the same active priorities

- [x] P19-02: Coverage suite integrity
  - [x] Fix stale valid fixtures for `sheets_compute` actions (`sql_query`, `sql_join`, `python_eval`, `pandas_profile`, `sklearn_model`, `matplotlib_chart`)
  - [x] Fix stale valid fixtures for `sheets_session` schedule actions (`schedule_create`, `schedule_cancel`, `schedule_run_now`)
  - [x] Fix stale valid fixtures for workspace webhook actions (`subscribe_workspace`, `unsubscribe_workspace`)
  - [x] Re-run `npm run audit:coverage` to green (`1207/1207` pass)

- [x] P19-03: Error code normalization hardening
  - [x] Replace non-canonical error outputs (`OPERATION_FAILED`, `RATE_LIMIT`) with enum-backed canonical codes (`INTERNAL_ERROR`, `RATE_LIMITED`)
  - [x] Add/extend tests to ensure canonical emission in response builder paths
  - [x] Keep backward-compatible alias metadata only at response-compat layer

- [x] P19-04: Mutation safety hardening
  - [x] Add centralized formula-sanitization coverage for all mutation entry points (not only data write/find-replace paths)
