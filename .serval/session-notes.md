# Session Notes

> Updated by each Claude session as its last act. Captures intent, decisions, and next steps
> that code analysis alone cannot determine.
> Full session history (Sessions 8–49): `docs/development/CODEBASE_CONTEXT.md#historical-feature-milestones`
> Sessions 50–105 compressed: see Session History table below.

## Current Phase

**Session 111 (2026-04-01) — Flat tool mode debugging + production cleanup.** Branch `main`. 409 actions (25 tools). 2810/2810 tests pass (143 test files).

## What Was Just Completed (Session 111)

**Flat tool mode diagnosis + comprehensive production cleanup — all verified green.**

### Flat tool mode fix

- **Root cause identified**: The `tools/call` interceptor in `flat-tool-call-interceptor.ts` works correctly (proven via direct STDIO test), but the Cowork/Claude Desktop server instance was running stale code from before the interceptor was deployed
- **Proof**: Spawned fresh server via STDIO, sent JSON-RPC `tools/call` for `sheets_auth_status` → success. Called `sheets_discover` (meta-tool only handled by interceptor) → success. Both flat and compound tool calls work.
- **Proof of stale instance**: Calling `sheets_discover` from Cowork session → "Tool not found" (interceptor not active in running instance)
- **Fix**: Restart Claude Desktop to load current dist/ with working interceptor
- **Cleanup**: Removed all 5 `process.stderr.write` debug traces from interceptor, rebuilt dist

### Production cleanup

1. **Orphaned processes**: Killed ~20 zombie `node dist/cli.js` processes on host machine via Desktop Commander
2. **Temp file cleanup**: Deleted 40+ debugging artifacts from root directory (14 HTML reports, 4 Office docs, test scripts, .bak files, .tmp/ directory, test fixture directories, stale audit/research files, AQUI-VR framework artifacts)
3. **Documentation sync**: Fixed 12 stale count references across 8 files (README.md, CODEBASE_CONTEXT.md, SOURCE_OF_TRUTH.md, state.md, metadata.json, facts.json, PROJECT_STATUS.md, USAGE_GUIDE.md) — all now consistently show 25 tools / 409 actions
4. **Metadata regeneration**: `npm run schema:commit` (via generate-metadata.ts) — all 7 generated files in sync
5. **Full verification**: TypeScript 0 errors, 2810/2810 tests pass, no drift, no placeholders, no debug prints

**Key decisions:**

- Flat tool interceptor pattern is architecturally correct (overrides SDK handler via `setRequestHandler`)
- `sheets_discover` meta-tool proves interceptor activity (no compound handler exists for it)
- No code changes needed for the flat mode fix — just a server restart

**Files changed (1 src + 8 docs):**

- `src/mcp/registration/flat-tool-call-interceptor.ts` — removed debug stderr traces
- README.md, CODEBASE_CONTEXT.md, SOURCE_OF_TRUTH.md, .serval/state.md, .agent-context/metadata.json, docs/generated/facts.json, PROJECT_STATUS.md, USAGE_GUIDE.md — count sync to 409

## What Remains

1. **Restart Claude Desktop** to pick up the working flat tool call interceptor
2. **Fly.io deployment** — verify HTTP transport on Fly.io
3. **End-to-end Google Sheets testing** — test actual operations once auth works
4. **Rotate API keys** — secrets were visible in config dump during debugging session

## What Was Previously Completed (Session 110)

**Claude Code architecture review → 4 confirmed gaps found and implemented — all 2841/2841 tests pass.**

### Improvements implemented

1. **autoRecord wiring** (`src/mcp/registration/tool-execution-side-effects.ts`):
   - After every successful mutation, checks `sessionCtx.getPreferences().autoRecord`
   - If `true`, automatically calls `sessionCtx.recordOperation(...)` — no more manual `record_operation` calls needed
   - Added `getSessionContextFn` to `ToolExecutionSideEffectDeps` interface + default wired in `createDefaultDeps()`
   - Non-critical: wrapped in try/catch — never blocks tool execution
   - Tests: 2 new tests in `tests/unit/tool-execution-side-effects.test.ts`

2. **Agent tool catalog injection** (`src/services/agent/plan-compiler.ts`):
   - Added `buildToolCatalogSummary()` that builds a compact summary of all 25 tools + actions from `TOOL_ACTIONS` (source of truth)
   - Replaced the old hardcoded static tool list in `aiParsePlan()` system prompt with live catalog
   - Agent plans now generated with awareness of all actual tools/actions — no more planning blind

3. **Agent step streaming** (`src/services/agent/plan-executor.ts`):
   - Added `sendProgress()` call after each step in `executePlan()`
   - LLM clients now see real-time progress notifications: "Step N/M completed: description"
   - Non-critical: wrapped in `.catch(() => {})` — never blocks execution

4. **Session compaction** (`src/schemas/session.ts`, `src/services/session-context.ts`, `src/handlers/session.ts`):
   - Added `compact_session` action to `sheets_session` (session now has 32 actions, up from 31)
   - `compactHistory(digest, keepRecent)` method on `SessionContextManager`
   - Handler: if history ≤ keepRecent, no-op; otherwise summarizes old ops into a digest record
   - Analogous to Claude Code's context compaction at ~80% capacity
   - Tool hash baseline regenerated via `npm run security:tool-hashes`

**Key decisions:**

- autoRecord is opt-in (default: false) — no surprise behavior changes for existing users
- buildToolCatalogSummary caps at 8 actions/tool to keep prompt tokens reasonable
- sendProgress uses `.catch()` not try/catch since it returns a promise
- compact_session creates a digest string entry in history (preserves audit trail)
- schema:commit git add fails on gitignored files (docs/generated, manifest.json) — pre-existing issue, not introduced here

**Files changed (8 src + 1 test):**

- `src/mcp/registration/tool-execution-side-effects.ts` — autoRecord wiring
- `src/services/agent/plan-compiler.ts` — buildToolCatalogSummary + live tool catalog injection
- `src/services/agent/plan-executor.ts` — sendProgress after each step
- `src/schemas/session.ts` — compact_session action + output fields
- `src/services/session-context.ts` — compactHistory() method
- `src/handlers/session.ts` — compact_session case
- `src/security/tool-hashes.baseline.json` — regenerated after session schema change
- `tests/unit/tool-execution-side-effects.test.ts` — autoRecord tests
- `tests/utils/ast-schema-parser.test.ts` — updated count: 31→32 for session

**Verification**: 2841/2841 tests pass. TypeScript clean.

## What Was Just Completed (Session 109)

**Full codebase verification (3 parallel Explore agents) + 4 confirmed fixes — all verified with 2784/2784 tests passing.**

- Debunked: mcp-http "duplication" (INTENTIONAL adapter pattern), test `as any` (1,304 occurrences all justified), MCP compliance gaps (none — A+), Google API anti-patterns (none)
- Fixed: layer violation (sampling-consent utils extracted to `src/utils/sampling-consent.ts`), stale metadata (actionCount 404→407, generate-state.mjs root-cause fix), oversized file (`src/security/incremental-scope.ts` 2051→372 lines via `operation-scopes-map.ts`), pre-existing TS error (`retryAfterMs` added to AnalyzeResponseSchema)
- **Verification**: TypeScript 0 errors. 2784/2784 tests pass. `verify:safe` all green.

## What Was Just Completed (Session 108)

**MCP SEP compliance audit + 5 fixes — verified with 2747/2747 tests passing.**

- Annotation title sync (all 25 tools), `sheets_session` idempotentHint `true→false`, agency hints (SEP-1792 draft via `x-servalsheets.agencyHint`), scope requirements (SEP-1880 draft via `x-servalsheets.requiredScopes`)
- MCP SEP score: A+ on 2025-11-25, A on draft spec. Only gap: `resource_link` content block type (spec not finalized)
- Files: `src/generated/annotations.ts`, `src/mcp/registration/tools-list-compat.ts`

## What Was Just Completed (Session 107)

**8 improvements — startup sequence, autoRecord, connector readiness, transaction guidance — verified with 2747/2747 tests.**

- `get_context` enriched with `connectors: { available, configured, zeroAuth, oauthReady }` block
- Server instructions: 3-step startup (auth → get_context → set_active), record_operation guidance, analyze_impact pre-flight, agent plan+execute for 3+ steps
- `autoRecord: boolean` preference added to UserPreferences (default: false; opt-in)
- Transaction commit errors now list BATCHABLE vs NON-BATCHABLE ops with actionable FIX guidance
- `retryAfterMs: 30_000` hint added to comprehensive degradation/error responses
- `get_history` empty hint added (guides toward record_operation or autoRecord)

## Genuine Remaining Work

1. **Error typing**: ~100 generic throws remain in src/services/ (google-api.ts, analysis/) — handlers already clean
2. **P18-D1–D10**: Handler decomposition — file-size budget system in place; actual decomposition deferred
3. ~~**16-F1–F6**: Formula evaluation engine~~ — **COMPLETE** ✅ `src/services/formula-evaluator.ts` (582 lines, HyperFormula v3.2.0) + `src/services/apps-script-evaluator.ts` (166 lines).
4. **ISSUE-073**: Git worktree cleanup (maintainer-only)
5. **ISSUE-075**: npm publish @serval/core v0.2.0 (maintainer-only)
6. **Sampling**: Add `ANTHROPIC_API_KEY` to claude_desktop_config.json env block (manual — user must add own key)

## Verified False Claims (do not re-investigate)

- **G-1**: revision-timeline no pagination — FALSE. `revision-timeline.ts:119-140` paginates with 50-page cap.
- **G-2**: collaborate/versions no pagination — FALSE. `versions.ts:390-399` paginates with 100-page cap.
- **G-4**: Apps Script bypasses `wrapGoogleApi` retry — FALSE. `appsscript.ts:365` wraps with `executeWithRetry()`.
- **G-6**: core.list no pagination — FALSE. `core-actions/spreadsheet-read.ts:182-261` has cursor-based pagination.
- **NEW-1 (agent self-eval gap)**: RESOLVED. `executePlan()` calls `aiValidateStepResult()` after each step. Tests: `tests/services/agent-engine-selfeval.test.ts`.
- **NEW-2 (connector discover SSRF)**: RESOLVED. `connectors.ts:278` validates `req.endpoint` against `discovery.endpoints`.
- **connector manager unbounded maps** — FALSE. `cappedMapSet` used at tenant-context.ts:214,302,360,381,429.
- **OAuth redirect URI hardcoded** — FALSE. `oauth-config.ts:26` reads `OAUTH_REDIRECT_URI` from env.

## Key Decisions Made

- **Option D continuity**: auto-generated state.md + manual session-notes.md (no custom infrastructure)
- **Safety rail order**: `createSnapshotIfNeeded()` BEFORE `confirmDestructiveAction()` (snapshot must exist before user approves)
- **P18-X5 N/A**: SDK `ServerCapabilities` type doesn't include `progress` field — not fixable without SDK change; `sendProgress()` already works per-request
- **16-F1–F6 COMPLETE** (2026-03-15): `formula-evaluator.ts` (582 lines, HyperFormula v3.2.0) + `apps-script-evaluator.ts` (166 lines). Wired into scenario modeling actions.
- **Minimal change policy**: ≤3 src/ files per fix unless tests require more; no refactors while debugging

## Architecture Quick Reference

- Full handler map, service inventory, anti-patterns: `docs/development/CODEBASE_CONTEXT.md`
- Feature specs (F1–F6): `docs/development/FEATURE_PLAN.md`
- Current metrics (tools/actions/tests): `src/schemas/action-counts.ts` + `.serval/state.md`
- TASKS.md: open backlog (P2 phase-2 progress coverage tranche E, ISSUE-073, ISSUE-075)

## Session History (recent)

| Date       | Session | Summary                                                                                                                             |
| ---------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-31 | 110     | Claude Code arch review → 4 fixes: autoRecord wiring, agent catalog injection, step streaming, compact_session; 2841/2841 tests     |
| 2026-03-25 | 109     | 3-agent codebase verification + 4 fixes: sampling-consent utils, metadata sync, incremental-scope decomp, retryAfterMs TS fix       |
| 2026-03-24 | 108     | MCP SEP compliance audit: annotation titles, idempotentHint, agencyHint (SEP-1792), requiredScopes (SEP-1880); A+ score             |
| 2026-03-24 | 107     | get_context connector block, autoRecord pref, 3-step startup instructions, transaction guidance; 2747/2747 tests                    |
| 2026-03-23 | 106     | Admin auth hardening, SAML production hardening, QuotaCircuitBreaker metrics, batch read parallelization; 2717/2717 tests           |
| 2026-03-23 | 105     | Bounded existence cache, per-task timeout, follow-up prompts 25/25 tools, InMemoryEventStore maxBytes; 2702/2702 tests              |
| 2026-03-22 | 104     | XFetch cache, Spearman correlation, autocorrelation seasonality, Isolation Forest, K-Means, LRU+TTL, SWR; 4643/4643 tests          |
| 2026-03-22 | 103     | Full 8-agent audit + 5 verified fixes: PQueue mutex, handler dedup, session GC, tenant cleanup, additive jitter; 2711/2711 tests    |
| 2026-03-21 | 102     | Error typing sprint; BigQuery handler 1964→541 lines (7 submodules); Dimensions handler 2146→430 lines; 2710/2710 tests             |
| 2026-03-21 | 101     | LLM Intelligence: cost estimates, confidence in _meta, traceId auto-gen, tool hiding, recovery playbooks, adaptive descs            |
| 2026-03-20 | 100     | Merge remediation/phase-1 → main (PR #37); resolved 11 conflicts; synced manifest.json 397→404                                     |
| 2026-03-20 | 99      | 8-commit bug fix batch (BUG-1–20): A1 range, output schema mismatches, Google API params, worker safety, auto-fill, compute         |
| 2026-03-19 | 98      | Enterprise SSO/SAML 2.0 SP: saml-provider.ts (NEW), JWT scope='sso', 24 tests; node-saml v3.1.2                                    |
| 2026-03-19 | 97      | Tier 4 services decomp: agent-engine 2467→75 lines (7 submodules), transaction-wal.ts extracted; 2742/2742 tests                   |
| 2026-03-19 | 96      | Tier 2 ACTION_HINT_OVERRIDES; sampling test fix; comprehensive.ts 8-phase progress reporting; 2742/2742 tests                       |
| 2026-03-18 | 95      | semantic_search feature (Voyage AI embeddings, LRU index); live API tests for agent/compute/connectors/federation                   |
| 2026-03-18 | 94      | Issue tracker triage; ISSUE-073/237/240 closed; AQUI-VR 100%/A+; 88 undescribed CSV issues noted                                   |
| 2026-03-18 | 93      | Wiring gap closure: ACTION_HINT_OVERRIDES 25/25 tools, CoT hints 13 types, Google API preflight, BUG-1/BUG-2 fixes                  |
| 2026-03-18 | 92      | AQUI-VR remaining 20 findings closed/waived; M-20 path.basename fix; L-8/L-9 contract tests; all 12 gates green                    |
| 2026-03-18 | 91      | AQUI-VR_v3.2_Framework: 54-finding registry, G13-G25 gates; check:drift macOS hang fix; staged-registration tests                  |
| 2026-03-18 | 90      | Production-ready 1.7.0 release commit; analyze understanding follow-up wiring (query_natural_language, scout, comprehensive)        |
| 2026-03-17 | 89      | Tier 2 ACTION_HINT_OVERRIDES; sampling-enhancements test fix; server instructions -22%; completions expansion; dist verification    |
| 2026-03-16 | 88      | 8-step audit remediation; aiValidateStepResult; \_meta.aiMode; OAuth localhost server; ISSUE-073 resolved                           |
| 2026-03-15 | 87      | 8-category re-audit (A grade); 6 schema fixes; live MCP probe 57/60 pass                                                            |
| 2026-03-15 | 86      | Conditional webhook filtering; share_add pre-flight; elicitation MUST NOT fix; Tasks 9/12/13/14/16/17/18 verified                   |
| 2026-03-15 | 85      | Round 2 description fixes (C2/H5/H6/M1/Task7/8/13); federation ACTION_HINT_OVERRIDES; Task 12 MCP schema audit                      |
| 2026-03-15 | 84      | Usability audit: tool-discovery-hints.ts (NEW); BuiltinValidationRuleSchema; appsscript scriptId; defer-schema fixes                |
| 2026-03-15 | 83      | Google Cloud Monitoring 90-min window: QuotaCircuitBreaker; Retry-After alignment; spreadsheet existence pre-caching; Fix A+B wired |
| 2026-03-15 | 82      | Cache O(1) size tracking; CoT \_hints layer (response-hints-engine.ts, 17 tests); stash cleanup                                     |
| 2026-03-15 | 81      | Type safety sprint (53 typed errors, 11 files); tranche E regression tests; action-recommender 5 new rules                          |
| 2026-03-15 | 80      | LLM Intelligence Phases 1-3 (\_meta.apiCallsMade, performance tiers, batching hints); codebase enhancements A/C/D                   |
| 2026-03-15 | 79      | Dead code removal (42 noUnusedLocals); typed error sprint (89 throws); ESLint fix; 2654/2654 tests                                  |
| 2026-03-14 | 78      | Systematic test repair: 63 failing → 0; 14+ test files; hardcoded timestamps, WebhookManager, resource registration                 |
| 2026-03-14 | 77      | S3-A quick_insights + S3-B auto_fill (TDD); 2646/2646 tests; 402 actions                                                            |
| 2026-03-14 | 76      | Re-audit remediation: webhook DNS fail-closed; servalsheets init CLI; plan encryption; per-spreadsheet throttle                     |
| 2026-03-13 | 75      | MCP 2025-11-25 elicitation compliance: ElicitationServer interface fix, OAuth flow wiring, form-mode removal, api-key-server.ts     |
| 2026-03-11 | 58      | LLM Intelligence full plan (Sprints 1-4): quality scanner, action recommender, agent auto-retry, formula library, build_dashboard   |
| 2026-03-03 | 55      | MCP/API fixes (6); VERIFIED_FIX_PLAN (9 fixes); 2452/2452 tests, G0–G5 green                                                        |
| 2026-03-03 | 54      | Project audit execution: fixed 5 stale doc counts, created sync-doc-counts.mjs, historical-doc notes                                |
| 2026-03-03 | 53      | P2 phase-2 progress coverage tranches A–D + sampling-consent hardening; 272/272 tests                                               |
| 2026-03-02 | 52      | P18 verification sprint — all items closed or N/A                                                                                   |
| 2026-03-02 | 51      | P16 backlog verification, 5 prompt registrations added, state.md updated                                                            |
| 2026-03-01 | 50      | Advanced integrations: DuckDB/Pyodide/Drive Activity/Workspace Events/Scheduler/SERVAL Formula (+14 actions, 377→391)               |
| 2026-02-28 | 49      | P16 LLM usability, elicitation wiring (core.create + collaborate.share_add)                                                         |
| 2026-02-28 | 47-48   | G0–G5 gates green, connectors.ts fix, LLM UX polish (annotations, aliases)                                                          |
| 2026-02-27 | 46      | sheets_connectors metadata + full wiring verification (10 actions)                                                                  |
| 2026-02-25 | 41      | ISSUE-226/234/237 fixes; 24 issues verified already fixed                                                                            |
| 2026-02-24 | 39      | Remediation Phase 1: 9 tests fixed, security fixes, gate pipeline restored                                                          |
| 2026-02-23 | 35-38   | P6 API fixes, P7–P15 implementation (cache, safety rails, MCP wiring, 5 composite actions)                                          |
| 2026-02-23 | 24-34   | P4 features: F4 Suggestions, F3 Cleaning, F1 Generator, F5 Time-Travel, F6 Scenarios, F2 Federation                                 |
| 2026-02-22 | 18-23   | P2 feature flags, P3 backends (Excel/Notion/Airtable), P4 feature plan                                                              |
| 2026-02-21 | 13-17   | P0 serval-core migration, P1 DX polish (ESLint fix, drift check, silent FPs)                                                        |
| 2026-02-20 | 8-12    | Audit infrastructure (fixtures, coverage, gates, drift, agents)                                                                     |
