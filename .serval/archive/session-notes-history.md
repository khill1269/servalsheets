# Session Notes Archive

> Archived from `.serval/session-notes.md` — load only when investigating specific past sessions.
> Sessions 50–105 compressed: see Session History table in session-notes.md.
> Sessions 8–49: see `docs/development/CODEBASE_CONTEXT.md#historical-feature-milestones`

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
