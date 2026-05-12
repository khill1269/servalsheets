# ServalSheets Task Backlog

> Persistent backlog of planned work. Updated across sessions.
> For session-level context (what just happened, decisions), see `.serval/session-notes.md`.

## Active Phase: P21 — MCP Protocol Compliance & Quality Hardening (2026-05-12)

Goal: Close spec compliance gaps found during the 2026-05-12 deep audit against MCP 2025-11-25 official spec (fetched live) and SDK v1.29.0. Harden test coverage for drift detection, initialize response shape, sampling probe scenarios, and live protocol smoke. Fix three spec gaps in `serverInfo`. Rewrite empty compliance report.

**Baseline (2026-05-12): 1864/1864 tests passing, TypeScript 0 errors. Already done this phase: `check:drift` bug fixed (removed `|| {}` from `check-metadata-drift.sh:44`), `packages/mcp-http` clean rebuild (stale `.tsbuildinfo` deleted), 5 elicitation schemas migrated to titled `oneOf` via `selectField()`, 13 resources get `icons` per spec, `SamplingHealth.model` + startup log + `.env.quickstart` LLM var docs.**

---

### P21-A: Protocol Compliance Fixes

- [x] **P21-A1** — Add `websiteUrl` and `title` to `serverInfo`
  - `src/version.ts:24-29`: add `websiteUrl: 'https://github.com/khill1269/servalsheets'` and `title: 'ServalSheets'`
  - Verify also propagated via `src/server/build-server-stdio-infrastructure.ts:45-51`
  - Spec: `Implementation extends BaseMetadata, Icons`; `BaseMetadata.title` and `Implementation.websiteUrl` are both optional but defined

- [x] **P21-A2** — Fix SEP-1649 → SEP-2127 in `src/server/well-known.ts`
  - Lines 5, 310, 543: replace "SEP-1649" with "SEP-2127 (draft, unmerged)"
  - SEP-2127 confirmed open PR as of 2026-05-12; `observability-core-routes.ts` already uses correct SEP number

- [x] **P21-A3** — Remove dead `$schema` URL from `src/server/well-known.ts:360`
  - `https://modelcontextprotocol.io/schemas/mcp-server-card.json` is a 404 (SEP not merged, schema not published)
  - Remove the `$schema` field or replace with the GitHub PR URL

- [x] **P21-A4** — Icon `theme` field *(resolved: no action needed)*
  - All SVGs use `stroke="currentColor"` → theme-agnostic by design; `theme` field is for theme-specific variants only
  - MCP spec: `theme` is optional and only applicable when server provides separate light/dark icon variants
  - Server icon uses hardcoded colors but embedded data URI — theme field inapplicable
  - Decision recorded in `docs/development/ADVANCED_GOTCHAS.md` context

---

### P21-B: Test Coverage

- [x] **P21-B1** — Add stale-dist regression test
  - File: `tests/contracts/source-dist-consistency-script.test.ts`
  - Current gap: tests detect MISSING dist only; stale dist (files exist with old content) is untested
  - Pattern: write old `ACTION_COUNTS` values to temp dir → backup real dist → run script → assert exit 1 + error message contains mismatch → restore real dist
  - No new deps — reuse `mkdtempSync`, `cpSync`, `renameSync`, `rmSync` (already used by the script)

- [x] **P21-B2** — Add initialize wire shape test
  - File: `tests/contracts/mcp-protocol.test.ts` — extend the STDIO purity suite (lines 313-410)
  - Assert: `result.protocolVersion === '2025-11-25'`, `result.serverInfo.name` defined, `result.serverInfo.icons` present, `result.capabilities.resources.subscribe === true`, `result.capabilities.tasks` defined
  - Assert conditional: `result.capabilities.tools?.listChanged === true` when `SERVAL_STAGED_REGISTRATION` unset (default)
  - Env: add `ENABLE_STDIO_PURITY_TEST` guard (already pattern in file)

- [x] **P21-B3** — Add tools/list shape test (bundled + flat mode)
  - File: `tests/contracts/mcp-protocol.test.ts` — same suite
  - Bundled: exactly 25 tools, each tool has `icons` array with ≥1 entry
  - Flat (`SERVAL_TOOL_MODE=flat`): 410 tools total (ACTION_COUNT 409 + `sheets_discover`), `sheets_discover` has `inputSchema.properties.query`
  - listChanged absent when `SERVAL_STAGED_REGISTRATION=false`

- [x] **P21-B4** — Create sampling health probe test suite
  - File: `tests/services/sampling-health-probe.test.ts` (replaces no-op `tests/simulation/_probe.test.ts`)
  - Mock pattern: `vi.stubGlobal('fetch', vi.fn())` per `tests/observability/otel-export.test.ts:20-25`
  - Env isolation: `vi.stubEnv('ANTHROPIC_API_KEY', '')` / `vi.stubEnv('ENABLE_SAMPLING', 'false')`
  - 8 scenarios: (1) 2xx success → healthy + provider + model populated, (2) ENABLE_SAMPLING=false → config:disabled, (3) no API key → config:missing_api_key, (4) HTTP 401 → probe:failed, (5) HTTP 429 → probe:failed, (6) network throw → probe:exception, (7) 3 consecutive failures → circuit_open (FAILURE_THRESHOLD=3 at `sampling-health-probe.ts:51`), (8) cache freshness: cachedUntil > Date.now()

---

### P21-C: Live Smoke Integration

- [x] **P21-C1** — Wire `scripts/live-probe.mjs` to `package.json`
  - Add: `"test:mcp:protocol:full": "node scripts/live-probe.mjs"`
  - Closes resources/prompts/completion gap in `npm run test:mcp:protocol` (which only covers tool actions)
  - Credential-free: uses fake spreadsheetId — no Google API costs

- [x] **P21-C2** — Strengthen `scripts/live-probe.mjs` assertions
  - resources/list: assert count ≥ 13, each resource has `icons` field (now present after P21 session work)
  - prompts/list: assert count ≥ 40
  - templates/list: assert count ≥ 6
  - Add: one intentionally invalid tool call → assert `isError: true` in JSON-RPC response

- [x] **P21-C3** — Add task-capable path to live smoke
  - Update client `initialize` in `scripts/live-probe.mjs` to declare `capabilities: { tasks: { list: {}, cancel: {}, requests: { tools: { call: {} } } } }`
  - Add `sheets_analyze.comprehensive` call (taskSupport: 'optional') and assert either result or task notification

---

### P21-D: Prompt Icons (SDK Gap — Tracked)

- [ ] **P21-D1** — File upstream SDK issue for `registerPrompt()` icons
  - SDK strips `icons` at destructure in `mcp.js:731`: `const { title, description, argsSchema } = config`
  - Wire response hardcodes 4 fields only — icons never serialized
  - No existing issue found in modelcontextprotocol/typescript-sdk as of 2026-05-12
  - File at: https://github.com/modelcontextprotocol/typescript-sdk/issues
  - Title: "`registerPrompt()` should accept MCP ToolAnnotations (icons, emoji) in config"
  - Reference: `src/mcp/registration/prompt-registration.ts` (40 prompts, all missing icons)

- [ ] **P21-D2** — Implement lower-level prompt icons workaround *(hold until D1 feedback)*
  - `server.server.setRequestHandler(ListPromptsRequestSchema, ...)` to intercept and inject icons
  - Must re-implement prompt serialization — complex; defer unless SDK fix not forthcoming by 2026-Q3

---

### P21-E: Compliance Report

- [x] **P21-E1** — Rewrite `audit/protocol_compliance_report.md` from scratch
  - File is currently 2 bytes (empty) — was truncated; **do not cite it**
  - Write from current code state: protocol version, tools 25/409, resources 13 (icons ✅), prompts 40 (icons ❌ SDK gap), elicitation (5 schemas migrated), tasks (experimental), sampling probe, server cards (SEP-2127 draft/unmerged, two endpoints at `observability-core-routes.ts` + `well-known.ts`, inconsistent SEP numbers), websiteUrl gap, icon theme gap, listChanged wire format (correct per SDK)

---

## Completed Phase: P20 — Flat-Tool Wire Hardening (2026-04-21)

Goal: Close the flat-tool adapter gap identified during the 2026-04-21 E2E session — six live wire bugs that scored "clean" against the compound-tool validation gates because those gates do not traverse the flat-tool projection. Add five small contract probes so the gap does not reopen.

**Completed 2026-05-12. Branch: `codex-native-gap-closure`. Closing commit: `548bd9b4 Close native gap remediation`.**

**Original baseline (2026-04-21): 25 tools, 410 actions, typecheck green, `check:drift` / `validate:alignment` / `validate:compliance` (0 errors) / `check:mutation-actions` / `check:integration-wiring` / `check:silent-fallbacks` / `check:source-dist` all green. BUG #3/#6 probe 7/7, BUG #4/#5 probe 5/5.**

Canonical reference: [docs/audits/regression-audit-2026-04-21.md](./docs/audits/regression-audit-2026-04-21.md). Remediation backlog: [docs/remediation/source-truth-compliance-remediation-tasks-2026-04-21.md](./docs/remediation/source-truth-compliance-remediation-tasks-2026-04-21.md).

## Completed Phase: P18 — Decomposition & Refinement Execution

Goal: Execute the post-readiness backlog focused on maintainability decomposition and targeted refinement work while keeping verification gates green.

**Baseline (2026-03-03): 25 tools, 407 actions, `test:fast` green, 0 TS errors, MCP protocol suites green, `audit:coverage` green (1207/1207).**
**Phase handoff**: P19 readiness exit criteria satisfied; P18 backlog executed.

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
- [x] P18-D11: Decompose `src/services/cleaning-engine-rules.ts` enough to remove its temporary size-budget override after the post-merge CI stabilization work.

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
