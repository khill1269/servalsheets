# Session Notes

> Updated by each Claude session as its last act. Captures intent, decisions, and next steps
> that code analysis alone cannot determine.
> Full session history (Sessions 8–49): `docs/development/CODEBASE_CONTEXT.md#historical-feature-milestones`
> Sessions 50–113 compressed: see Session History table below.

## Current Phase

**Sessions 112–115 (2026-04-19 → 2026-04-23) — Full audit remediation + MCP submission prep.** Branch `main`. 25 tools / 409 actions. 535/535 test files pass (11,601 tests). All 14 audit gates green.

## What Was Just Completed (Sessions 112–115)

**28-bug live stress test remediation, code simplification, and Anthropic MCP directory submission preparation. All 14 audit gates green. 535 test files pass.**

### Audit scope

A 14-phase live MCP stress test against the `ServalSheets Showcase Hub` workbook produced 28 confirmed bugs and a no-go recommendation for directory submission. Sessions 112–115 resolved 25+ of those bugs and all 12 original submission blockers.

### Fixes applied (by root cluster)

**Root A — Analyze range scoping (bugs 7, 8, 9, 27)**
- `analyze_quality`, `analyze_structure`, `analyze_formulas` — `sheetId` now scopes the read via `convertRangeInputAsync`
- `convertRangeInputAsync` wired into quality.ts, patterns.ts, and handleGenerateFormula — all three now return `NOT_IMPLEMENTED` for `grid`/`semantic` instead of silently falling back to workbook-wide reads
- Sync `convertRangeInput` private method removed (was unused after full migration)

**Root B — error envelope schema (bug 5, universal)**
- `response-intelligence.ts` now writes `fix.explanation` (string) to `suggestedFix` — matches `z.string().optional()` schema
- `fixableVia` holds the structured `{tool, action, params, explanation}` object
- Locked in by `tests/contracts/error-envelope-schema.test.ts` (11 tests)

**Root C — sampling truthfulness (bugs 12, 13, 14)**
- New `src/services/sampling-health-probe.ts` — real reachability probe with 5-min TTL cache + circuit breaker (3-failure threshold)
- `auth.status.sampling.available = probe.healthy` (not env-var presence)

**Root D — agent plan binding (bugs 1, 2)**
- Regex-fallback plans get `_requiredParams: string[]` on each invalid step via `annotateAIGeneratedDraftPlan(plan, true)`
- `planningContextSummary` includes `REGEX_FALLBACK:` prefix when AI sampling was unavailable
- `annotateAIGeneratedDraftPlan` now takes optional `backfillSentinels` param — merges two passes into one

**Root E — elicitation alternatives (bugs 3, 4)**
- `delete_named_range`, `delete_banding`, `delete_protected_range` now return `ELICITATION_UNAVAILABLE` (was `PRECONDITION_FAILED`) so recovery-engine attaches `wizard_start` + `safety.confirmed` alternatives
- `safety.confirmed: z.boolean().optional()` added to `SafetyOptionsSchema` — all three handlers pass `skipIfElicitationUnavailable: req.safety?.confirmed === true`

**Root F — error-source-aware suggester (bugs 18, 19, 24, 25)**
- `ErrorSource` type + optional `errorSource` param in `suggestFix()`
- `inferErrorSource()` extracted to `src/utils/infer-error-source.ts` — shared by `BaseHandler.mapError` and `mapStandaloneError`
- `mapStandaloneError` now emits `errorSource` on every return
- `tool-response.ts` reads `error['errorSource']` and passes it to `applyResponseIntelligence`
- `exposedToolSurface` wired from `TOOL_ACTIONS` in `tool-response.ts` — suppresses suggestions pointing at unregistered actions

**Root G — Apps Script lifecycle (bugs 20, 21, 22, 23, 24, 28)**
- `script.run` devMode uses `scriptId` not `deploymentId!` (was `/scripts/undefined:run`)
- 404 on deploymentId → structured `NOT_FOUND` with 4-step HEAD-deployment workflow explanation
- `list_deployments` epoch sentinel `1970-01-01T00:00:00Z` filtered out
- `script.update_content` rejection names the matched pattern + line numbers + 3-line snippet
- `script.metrics` OAuth scope added to `FULL_ACCESS_SCOPES`
- `get_metrics` 403 now routes to `sheets_auth.setup_feature` not retry playbook

**Additional fixes**
- `analyze_quality` score now severity-weighted (critical:20, high:10, medium:5, low:2; capped -60)
- All quality issues no longer hardcoded as `MIXED_DATA_TYPES` — `inferQualityIssueType()` maps message text
- `QualityIssueType` is now `DataQualityIssue['type']` (schema-derived, not local union)
- `scout` per-sheet flags (hasFormulas, hasCharts, hasProtection, hasFilters) — real per-sheet API probe, not workbook-wide copy
- `detect_patterns` numeric string coercion — Google API can return numbers as strings; helpers.ts now coerces
- `checkColumnQuality` single-pass frequency Map (was two-pass set + map)
- `data.ts` unknown-action error no longer embeds all 24 action names verbatim — routes to `sheets_analyze.discover`
- `tables.ts` resolution text no longer references unexposed `sheets_dimensions.clear_basic_filter`
- `update_protected_range` batchUpdate wrapped with context-aware error (cites `protectedRangeId`, not raw API range)
- Named functions error message: "permanently unsupported" not "kept for compatibility"
- `agent.get_status` now also queries `taskStore` when `planStore` misses — unifies `analyze.comprehensive` task polling
- `transaction.ts`: `MAX_TRANSACTION_OPS` cached at module load; dryRun skips cap
- `analyze.ts` row/col caps read from `ANALYZE_MAX_ROWS`/`ANALYZE_MAX_COLS` env vars (both call sites consistent)
- N6: Atomic OAuth callback via `sessionStore.consume()` — Redis `GETDEL`, in-memory sync get+delete
- N5: Per-clientId DCR rate limit on `/oauth/register/:clientId`
- `CLAUDE.md` RFC 7591/7592 citation corrected

**MCP directory submission prep**
- `server.json` `packages` — added remote/streamable-http entry for `https://servalsheets.dev/mcp`
- `server.json` `transports` + `capabilities` (sampling, elicitation) declared
- `generate-metadata.ts` updated as the authoritative source — `server.json` is generated, never hand-edited
- README "Connect to Claude" section added before "What's New"
- 14/14 audit gates green; all Anthropic submission requirements verified

### Code quality improvements (simplify pass)

- `inferErrorSource()` extracted to `src/utils/infer-error-source.ts` — eliminates duplication between `base.ts` and `error-mapping.ts`
- `QualityIssueType` unified with schema: `DataQualityIssue['type']`
- `checkColumnQuality` single-pass frequency map
- `annotateAIGeneratedDraftPlan` + `backfillRequiredParamSentinels` merged into one pass (optional `backfillSentinels` param)
- Inline `import('...')` type cast moved to top-level import in `tool-response.ts`

## What Remains

### Non-blocking for directory submission

1. **Root D dryRun simulators** — per-tool before/after diff for `sheets_data.write`, `sheets_core.delete_sheet`, `sheets_format.set_format` (~1 week)
2. **N17 webhooks task emission** — delivery is fire-and-forget; needs API shape decision before async-task change
3. **N16 federation task emission** — `call_remote` is synchronous; design decision needed
4. **`semantic` range branch** — `convertRangeInputAsync` returns `NOT_IMPLEMENTED` for semantic; a real resolver is deferred

### Pre-deployment (infrastructure, not code)

1. Register domain `servalsheets.dev` → point at Cloud Run / Railway / Fly.io instance
2. Register Google Cloud OAuth app, set `GOOGLE_REDIRECT_URI=https://servalsheets.dev/callback`
3. Generate `JWT_SECRET` (`openssl rand -hex 32`)
4. Provision Redis (optional but recommended for sessions + webhooks)
5. Set `ANTHROPIC_API_KEY` for AI features
6. Verify `/health/ready` → 200 before submitting to Anthropic directory

## Verified False Claims (do not re-investigate)

All prior false claims from sessions 111 and earlier remain valid. New additions:

- **Bug 26 (delete_banding schema drift)** — FALSE. Both `add_banding` and `delete_banding` already use `z.coerce.number().int()` + `SafetyOptionsSchema`. The stress test failure was a request format issue.
- **Bug 16 (comprehensive taskId no polling route)** — RECLASSIFIED P2-docs. `task-store-adapter.ts:65-174` has `getTask`, `listTasks`, cancellation. Server-side is correct; issue was undocumented in tool description. `agent.get_status` now also checks `taskStore`.
- **N8 (wizardSessions Map concurrency)** — ACCEPTABLE RISK. Auto-generated UUIDs (128-bit entropy) make enumeration impossible. Single-tenant practical risk is negligible.
- **N9 (_scheduler singleton)** — NOT A BUG. Module-level lazy singleton set once at boot via `setScheduler()` — intentional pattern.
- **A1NotationSchema preprocessor (Bug 6 state leak)** — FALSE. Pure stateless function, no closure state.

## Key Decisions Made This Session

- **`server.json` is GENERATED** — never edit it directly. The source is `scripts/generate-metadata.ts`. Running `npm run generate:metadata` regenerates it.
- **Snapshot tests** — after any `SafetyOptionsSchema` or shared schema change, run `npx vitest run tests/snapshots -u` to update snapshots before `verify:safe`.
- **`safety.confirmed`** — public bypass for elicitation on non-elicitation clients. Pass `true` in `request.safety.confirmed` to pre-approve destructive operations.
- **`inferErrorSource`** — canonical location: `src/utils/infer-error-source.ts`. If you need to classify an error's origin (google_api, ai_service, validation, auth), import from there.
- **dryRun cap bypass** — `transaction.ts` skips `MAX_TRANSACTION_OPS` check when `safety.dryRun: true`. Don't re-add the check.
- **Annotation changes require schema:commit** — `SafetyOptionsSchema` changes are caught by snapshot tests (`tests/snapshots/`), not just `check:drift`.

## Architecture Quick Reference

- Full handler map, service inventory, anti-patterns: `docs/development/CODEBASE_CONTEXT.md`
- Feature specs: `docs/development/FEATURE_PLAN.md`
- Current metrics: `src/schemas/action-counts.ts` + `.serval/state.md`
- Deployment guide: `deployment/DEPLOYMENT_GUIDE.md`
- Submission checklist: see "Pre-deployment" section above

## Session History (recent)

| Date       | Session | Summary                                                                                                                             |
| ---------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-23 | 115     | Code simplify: inferErrorSource shared util, QualityIssueType schema-derived, single-pass checkColumnQuality, annotate+backfill merged |
| 2026-04-23 | 114     | MCP submission prep: server.json HTTP transport + generate-metadata.ts source; README "Connect to Claude" section; snapshots updated |
| 2026-04-23 | 113     | Root A completion: convertRangeInputAsync wired into quality/patterns/generateFormula; mapStandaloneError emits errorSource; N21/N22 |
| 2026-04-22 | 112     | 28-bug audit remediation: Roots A–G, safety.confirmed schema field, backfillRequiredParamSentinels, sampling health probe, 14 gates green |
| 2026-04-01 | 111     | Flat tool mode debugging + production cleanup; stale process cleanup; 2810/2810 tests                                               |
| 2026-03-31 | 110     | Claude Code arch review → 4 fixes: autoRecord wiring, agent catalog injection, step streaming, compact_session; 2841/2841 tests     |
| 2026-03-25 | 109     | 3-agent codebase verification + 4 fixes: sampling-consent utils, metadata sync, incremental-scope decomp, retryAfterMs TS fix       |
| 2026-03-24 | 108     | MCP SEP compliance audit: annotation titles, idempotentHint, agencyHint (SEP-1792), requiredScopes (SEP-1880); A+ score             |
| 2026-03-24 | 107     | get_context connector block, autoRecord pref, 3-step startup instructions, transaction guidance; 2747/2747 tests                    |
| 2026-03-23 | 106     | Admin auth hardening, SAML production hardening, QuotaCircuitBreaker metrics, batch read parallelization; 2717/2717 tests           |
| 2026-03-23 | 105     | Bounded existence cache, per-task timeout, follow-up prompts 25/25 tools, InMemoryEventStore maxBytes; 2702/2702 tests              |
| 2026-03-22 | 104     | XFetch cache, Spearman correlation, autocorrelation seasonality, Isolation Forest, K-Means, LRU+TTL, SWR; 4643/4643 tests          |
| 2026-03-22 | 103     | Full 8-agent audit + 5 verified fixes: PQueue mutex, handler dedup, session GC, tenant cleanup, additive jitter; 2711/2711 tests    |
| 2026-03-21 | 102     | Error typing sprint; BigQuery handler 1964→541 lines (7 submodules); Dimensions handler 2146→430 lines; 2710/2710 tests             |
