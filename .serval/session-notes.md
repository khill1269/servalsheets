# Session Notes

> Updated by each Claude session as its last act. Captures intent, decisions, and next steps
> that code analysis alone cannot determine.
> Full session history (Sessions 8–49): `docs/development/CODEBASE_CONTEXT.md#historical-feature-milestones`

## Current Phase

**Session 109 (2026-03-24) — Codebase verification + layer violation fix + oversized file decomposition.** Branch `release-1.7.1`. 407 actions (25 tools). 2784/2784 tests pass (141 test files).

## What Was Just Completed (Session 109)

**Full codebase verification (3 parallel Explore agents) + 4 confirmed fixes — all verified with 2784/2784 tests passing.**

### Verification (debunked false positives)
- **mcp-http "duplication"**: INTENTIONAL adapter pattern. `packages/mcp-http/` = generic library; `src/http-server/` = product-specific wiring. NOT duplicate code.
- **Test `as any` (1,304 occurrences)**: ALL justified standard test patterns (mock setup, input adaptation). No fixes needed.
- **MCP compliance gaps**: NONE. A+ on MCP 2025-11-25. All features wired.
- **Google API anti-patterns**: NONE. No unbounded column refs, retry properly applied via BaseHandler/CachedSheetsApi.

### Task 1 — Layer violation fix
Services/analysis importing from `src/mcp/` creates transport coupling. Fixed by extracting shared utilities:
- **`src/utils/sampling-consent.ts`** (NEW): `registerSamplingConsentChecker`, `clearSamplingConsentCache`, `assertSamplingConsent`, `withSamplingTimeout`
- **`src/mcp/sampling.ts`**: Now re-exports from utils
- **`src/services/llm-fallback.ts`, `src/services/sheet-generator.ts`, `src/services/agent/sampling.ts`**: Import path fixed `../mcp/sampling.js` → `../utils/sampling-consent.js`
- **`src/analysis/conversational-helpers.ts`**: `SamplingMessage` now imported from `@modelcontextprotocol/sdk/types.js`

### Task 2 — Stale metadata fixes
- **`.agent-context/metadata.json`**: `actionCount: 404→407`, `buildVersion: 1.7.0→2.0.0`
- **`.serval/generate-state.mjs`**: Now reads `src/generated/action-counts.ts` (not re-export stub)

### Task 3 — Oversized file decomposition: `src/security/incremental-scope.ts`
- **Before**: 2,051 lines (logic + 1,665-line data map mixed)
- **`src/security/operation-scopes-map.ts`** (NEW, ~1,697 lines): `ScopeCategory` enum + `OPERATION_SCOPES` data map
- **`src/security/incremental-scope.ts`**: 2,051 → 372 lines (82% reduction). Re-exports both symbols for backwards compat.

### Task 4 — Pre-existing TypeScript error fix
- **`src/schemas/analyze.ts`**: Added `retryAfterMs: z.number().int().positive().optional()` to `AnalyzeResponseSchema` success branch
- Fixes TS2353 in `src/handlers/analyze-actions/comprehensive.ts:88`

**Verification**: TypeScript 0 errors. 2784/2784 tests pass. `verify:safe` all green.

---

## What Was Just Completed (Session 108)

**Full MCP SEP compliance audit + 5 fixes — verified with 2747/2747 tests passing.**

1. **Annotation title sync** (`src/generated/annotations.ts`): Synced all 25 tool annotation titles to match `tool-definitions.ts`
2. **sheets_session idempotentHint corrected**: Changed from `true` to `false`
3. **Agency hints (SEP-1792 draft)** (`src/mcp/registration/tools-list-compat.ts`): `TOOL_AGENCY_HINTS` map — autonomous/orchestrated/direct
4. **Scope requirements (SEP-1880 draft)**: `TOOL_SCOPE_REQUIREMENTS` map for all 25 tools
5. **MCP SEP compliance**: A+ on current spec, A on draft spec

---

## Genuine Remaining Work

1. **Error typing**: ~100 generic throws remain in src/services/ (google-api.ts, analysis/) — handlers already clean
2. **P18-D1–D10**: Handler decomposition — file-size budget system in place; actual decomposition deferred
3. **ISSUE-073**: Git worktree cleanup (maintainer-only)
4. **ISSUE-075**: npm publish @serval/core v0.2.0 (maintainer-only)
5. **Sampling**: Add `ANTHROPIC_API_KEY` to claude_desktop_config.json env block (user must add own key)

## Verified False Claims (do not re-investigate)

- **G-1**: revision-timeline no pagination — FALSE. `revision-timeline.ts:119-140` paginates.
- **G-2**: collaborate/versions no pagination — FALSE. `versions.ts:390-399` paginates.
- **G-4**: Apps Script bypasses retry — FALSE. `appsscript.ts:365` wraps with `executeWithRetry()`.
- **G-6**: core.list no pagination — FALSE. `core-actions/spreadsheet-read.ts:182-261` has cursor pagination.
- **connector manager unbounded maps** — FALSE. `cappedMapSet` used at tenant-context.ts:214,302,360,381,429.
- **OAuth redirect URI hardcoded** — FALSE. `oauth-config.ts:26` reads `OAUTH_REDIRECT_URI` from env.
- **mcp-http "duplication"** — FALSE. Intentional adapter pattern (Session 109).
- **Test `as any` (1,304 occurrences)** — ALL justified (Session 109).

## Key Decisions Made

- **Safety rail order**: `createSnapshotIfNeeded()` BEFORE `confirmDestructiveAction()`
- **`autoRecord` preference**: Defaults to false (opt-in)
- **`SamplingMessage` source**: Import from `@modelcontextprotocol/sdk/types.js` directly
- **Admin endpoints**: Return 403 when `ADMIN_API_KEY` unset (explicit disablement)
- **Chunk concurrency** (batch reads): 3 — balances throughput vs quota safety

## Architecture Quick Reference

- Full handler map, service inventory, anti-patterns: `docs/development/CODEBASE_CONTEXT.md`
- Feature specs (F1–F6): `docs/development/FEATURE_PLAN.md`
- Current metrics: `src/schemas/action-counts.ts` + `.serval/state.md`
- TASKS.md: open backlog

## Session History (Sessions 86–109)

| Date       | Session | Summary |
| ---------- | ------- | ------- |
| 2026-03-24 | 109     | Codebase verification (3 agents); layer violation fix (sampling-consent.ts); incremental-scope.ts 82% reduction; TS error fix; 2784/2784 |
| 2026-03-24 | 108     | MCP SEP compliance audit + 5 fixes (annotation titles, idempotentHint, agencyHint, requiredScopes); 2747/2747 |
| 2026-03-24 | 107     | 8 improvements: get_context connector enrichment, autoRecord preference, transaction error messages, retryAfterMs, server instructions startup sequence; 2747/2747 |
| 2026-03-24 | 106     | Admin auth hardening; SAML production hardening; QuotaCircuitBreaker metrics; batch read parallelization; error typing sprint; action-recommender + compute-engine decomposition; 2717/2717 |
| 2026-03-24 | 105     | Bounded knownSpreadsheets cache; per-task timeout in ParallelExecutor; follow-up prompts for all 25 tools; InMemoryEventStore bytes limit; email/URL validation hardening; 2702/2702 |
| 2026-03-24 | 104     | XFetch cache; Spearman correlation; autocorrelation seasonality; Isolation Forest; K-Means clustering; LRU+TTL cache; bounded recentFailuresByPrincipal; SWR cache pattern; 4643/4643 |
| 2026-03-24 | 103     | Full codebase audit (8 agents); 5 confirmed fixes (connection reset mutex, handler dedup, session GC, tenant cleanup, jitter fix); Phase 1 medium fixes; 2711/2711 |
| 2026-03-24 | 102     | Error typing sprint; BigQuery decomposition (1964→541 lines); Dimensions decomposition (2146→430 lines); 2710/2710 |
| 2026-03-24 | 101     | 10-item LLM intelligence plan; cost estimates, confidence in _meta, traceId, tool hiding, recovery playbooks, adaptive descriptions, session-aware dedup; 2710/2710 |
| 2026-03-24 | 100     | Merge remediation/phase-1 → main (PR #37); resolved 11 merge conflicts |
| 2026-03-24 | 99      | 8-commit bug fix batch (BUG-1 through BUG-20) + TypeScript follow-up; 2742/2742 |
| 2026-03-23 | 98      | Enterprise SSO/SAML 2.0 Service Provider (ISSUE-173); 24 tests |
| 2026-03-22 | 97      | Services decomposition: agent-engine.ts (2467→75 lines, 7 submodules); transaction-wal.ts NEW; 2742/2742 |
| 2026-03-21 | 96      | Track A/B/C post-audit: intermediate progress reporting (8 phases); semantic_search tests; 2742/2742 |
| 2026-03-21 | 95      | semantic_search feature (ISSUE-174/175); Voyage AI embeddings; live API test suite; 2742/2742 |
| 2026-03-20 | 94      | Issue tracker triage + backlog closure; AQUI-VR 100% / A+; 2731 tests |
| 2026-03-20 | 93      | Wiring gap closure + benchmark fixes; all 25 tools have LLM hints; CoT hints expanded; 2731 |
| 2026-03-20 | 92      | AQUI-VR remaining 20 findings closed; all 12 audit gates pass; 17 new tests; 2731 |
| 2026-03-19 | 91      | AQUI-VR_v3.2_Framework.md; 54-finding registry; G13–G25 gates; 14 findings resolved; 2731 |
| 2026-03-18 | 90      | Production-ready 1.7.0 release commit; analyze understanding follow-up wiring |
| 2026-03-17 | 89      | Tier 2 ACTION_HINT_OVERRIDES; sampling-enhancements test fix; server instructions -22%; completions expansion |
| 2026-03-16 | 88      | 8-step audit remediation; aiValidateStepResult; _meta.aiMode; OAuth localhost server; ISSUE-073 resolved |
| 2026-03-15 | 87      | 8-category re-audit (A grade); 6 schema fixes; live MCP probe 57/60 pass |
| 2026-03-15 | 86      | Conditional webhook filtering; share_add pre-flight; elicitation MUST NOT fix |
