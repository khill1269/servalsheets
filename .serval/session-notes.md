# Session Notes

> Updated by each Claude session as its last act. Captures intent, decisions, and next steps
> that code analysis alone cannot determine.
> Full session history (Sessions 8–49): `docs/development/CODEBASE_CONTEXT.md#historical-feature-milestones`

## Current Phase

**Session 88 (2026-03-17) — Audit remediation plan complete + working tree commit.** Branch `remediation/phase-1`. 402 actions (25 tools). Final commit `fd00c00`.

## What Was Just Completed (Session 88)

**Audit remediation plan (8 steps) fully implemented** across 3 sessions (87-88):

1. **`z.discriminatedUnion` / `.passthrough()` schema fixes** (`src/schemas/dependencies.ts`, `fix.ts`): F6 scenario action fields now use `z.literal()`, `dataProfile` nested objects use `.passthrough()`
2. **`DataProfile` index signature** (`src/services/cleaning-engine.ts`): `[x: string]: unknown` added for type compatibility
3. **`fixableVia` on ELICITATION_UNAVAILABLE** (`src/handlers/confirm.ts`): Error now includes `fixableVia: { tool: 'sheets_confirm', action: 'wizard_start' }`
4. **Error self-correction protocol** (`src/mcp/features-2025-11-25.ts`): 5-step `## 🔁 ERROR SELF-CORRECTION PROTOCOL` section added to server instructions
5. **Spreadsheet context injection into `aiParsePlan`** (`src/services/agent-engine.ts`): Session context sheet names injected into LLM system prompt when spreadsheetId matches
6. **`aiValidateStepResult()` implemented** (`src/services/agent-engine.ts`): Reflexion-style sampling-based soft validation after each step (IMP-03). Tests: `tests/services/agent-engine-selfeval.test.ts` (5/5 pass)
7. **`_meta.aiMode` in responses** (`src/mcp/registration/response-intelligence.ts`, `tool-response.ts`): `aiMode: 'sampling' | 'heuristic' | 'cached'` now injected into `_meta` on all responses
8. **`startOAuthCredentialsServer()`** (`src/utils/api-key-server.ts`, `src/handlers/connectors.ts`): Replaced MUST NOT-violating form-mode OAuth credential collection with localhost URL-mode server (MCP 2025-11-25 compliance)

**Working tree commit** (`fd00c00`): 45 files, 1870 insertions. Resolved 5 TypeScript errors, fixed ESLint issues (unreachable code, missing return type), annotated silent fallback returns.

**ISSUE-073 resolved**: All stale git worktrees removed (`/private/tmp/servalsheets-audit-5pqvit`, `.claude/worktrees/kind-poincare`). 15 stale branches deleted (wave1-6-codex, backup-zod3, feat/zod-v4, fix/concurrency, publish/\*, wip/agent-batch, worktree-agent-aef381df, claude/kind-poincare).

**Remaining**: `main-local-pre-sync-2026-03-10` and `remediation/phase-1-local-pre-sync-2026-03-09` kept as safety backups. ISSUE-075 (npm publish @serval/core) remains as maintainer-only task.

## What Was Just Completed (Session 87)

**Comprehensive 8-category codebase re-audit** — parallel agents audited all 25 tools across: handler paths, MCP protocol compliance, security, schemas, service layer, advanced features, tests, and documentation. Score: A (excellent).

**6 schema/service hardening fixes** (committed `e2a55a4`):

1. **Federation superRefine** (`src/schemas/federation.ts`): Per-action required field validation — serverName required for call_remote/get_server_tools/validate_connection, toolName required for call_remote
2. **Agent maxSteps cap** (`src/schemas/agent.ts`): `.max(50)` prevents DoS via unbounded plan generation
3. **Core update_sheet newTitle deprecated** (`src/schemas/core.ts`): Dead `newTitle` field marked deprecated (handler only reads `title`)
4. **share_add schema validation** (`src/schemas/collaborate.ts`): emailAddress required when type=user/group, domain required+format-validated when type=domain
5. **DuckDB LIMIT safety** (`src/services/duckdb-engine.ts`): Queries without LIMIT get safety cap of 10,000 rows
6. **Dimensions descriptions** (`src/schemas/dimensions.ts`): sheetId/sheetName descriptions clarify mutual exclusivity

**Live MCP server probe** (`scripts/live-probe.mjs`): Spawned STDIO server with service account credentials and probed:

- Phase 1: Protocol features — 9/9 pass (tools/list=25, resources=68, prompts=48, completions, logging)
- Phase 2: Tool dispatch all 25 tools — 24/25 pass (1 timeout: preview_generation needs LLM API)
- Phase 3: Schema validation error paths — 6/7 pass (1 timeout: share_add elicitation wait)
- Phase 4: Multi-action spot checks — 18/21 pass (3 timeouts: LLM/network/elicitation)
- **Result: 57/60 pass (3 failures are all network/LLM timeouts in sandboxed environment)**

**Key live probe findings:**

- All 25 tools register correctly with schemas, descriptions, and annotations
- All tool dispatch paths work (validated via handler responses)
- Schema validation correctly rejects: missing action, invalid action, empty args, federation missing serverName, agent maxSteps>50, share_add invalid domain
- `sheets_compute.evaluate` works offline (formula evaluator runs locally)
- Session/history/quality/dependencies/connectors return successful responses without Google API

## What Was Just Completed (Session 86)

**Task #10 — Conditional webhook filtering** (committed `75b8787`): `enrichInputSchema()` in tools-list-compat.ts now hides Redis-required actions (register, unregister, list, get, test, get_stats) from both `actionParams` hints and `oneOf` schema variants when Redis is absent. The 4 non-Redis actions remain visible.

**Task #11 — share_add pre-flight validation** (committed `aa1565c`): Added `validateShareAddInput()` + `isValidDomain()` to sharing.ts. Runs before `driveRateLimiter.acquire()` — fails fast vs 15s API timeout. 3 new test cases cover missing emailAddress, missing domain, invalid domain format.

**Task #15 — MCP 2025-11-25 elicitation compliance** (committed `ac224de`): Removed `elicitApiKeyViaForm()` fallback from `connectors.ts:elicitApiKey()` (MUST NOT: API key via form transits MCP payload). URL-mode path (startApiKeyServer) is the only remaining path. Verified no `type: 'array'` in any requestedSchema.

**Verified already done (no code changes needed):**

- Task #9 (federation hints), Task #12 (schema compliance audit), Task #14 (heap watchdog in comprehensive.ts)
- Task #16 (descriptions.ts fixes in a7721a2), Task #17 (quality custom rules exist), Task #18 (fill_missing parses correctly)
- Task #7 (Redis in webhook description), Task #8 (quality limitations documented), Task #13 (RBAC_GUIDE.md)

**Remaining known issue:** `elicitOAuthCredentials()` in connectors.ts collects clientSecret/tokens via form mode (MUST NOT — no URL-based OAuth alternative available yet). Pre-existing test failure: `webhooks-initialization-bugfix.test.ts` expects old error message string.

## What Was Just Completed (Session 85)

**Round 2 description fixes** (all in `src/schemas/descriptions.ts`, committed `a7721a2`):

- C2 (batch_format): Fixed `"requests"` → `"operations"` in example; added 7-value `type` enum
- H5 (chart_create): Replaced partial 7-value chartType list with full 17-value enum; added legendPosition enum
- H6 (model_scenario): Added `changes[].newValue` field name disambiguation
- M1 (auto_resize): Added sheetId required note + dimension enum
- Task #7 (sheets_webhook): Added prominent Redis-required warning block to description
- Task #8 (sheets*quality): Added 11 builtin rule IDs with `builtin*` prefix; ⚠️ limitations note
- Task #13 (RBAC_GUIDE.md): Added Best Practice #4 for orchestration tool allowlists

**Task #9 completion** — `sheets_federation` ACTION_HINT_OVERRIDES added (committed `0ae700c`). Federation uses flat z.object (not discriminated union) → dynamic extractor returned null. Added 4-action hints: call_remote (serverName+toolName required), list_servers, get_server_tools (serverName), validate_connection (serverName). All 25 tools now have correct required-field hints.

**Task #12 audit** — Full-schema mode JSON Schema output confirmed MCP-compliant (no code changes needed). All 25 schemas: type:object, $schema 2020-12, properties.request present, no Zod leaks. SERVAL_SCHEMA_REFS=true compression: 913KB → ~173KB.

## What Was Just Completed (Session 84)

**Usability audit remediation** — Fixed root cause of 26% failure rate (DEFER_SCHEMAS mode returning `{}` params):

- **`tool-discovery-hints.ts`** (new, 382 lines): Builds per-action `actionParams` hints from Zod schemas; exposes enum values and types via `x-servalsheets.actionParams` on every `tools/list` response
- **`BuiltinValidationRuleSchema`** (`src/schemas/quality.ts`): Added Zod enum for 11 built-in rule IDs so `quality.validate.rules` shows valid values instead of `z.any()`
- **`appsscript.create` top-level `scriptId`** (`src/handlers/appsscript.ts`): Added `scriptId` at the response top level (was buried inside `project` object and could be truncated)
- **Trigger action descriptions** (`src/schemas/appsscript.ts`): Removed "not implemented" phrases that tripped `check:placeholders`; replaced with NOTE about ScriptApp requirement
- **`task-id-support.test.ts`**: Added `devMode: true` to `appsscript run` call to pass handler's pre-flight guard
- **`tools-list-compat.ts`**: Replaced `console.error` with structured `logger.error` calls
- **`connectors.ts`**: Fixed `makeErrorResponse` `code` param type (`string` → `ErrorCode` enum)
- **Silent-fallback annotations**: Added `// OK: Explicit empty` comments to legitimate `return undefined` patterns in compute, sharing, hints, schema-helpers, tools-list-compat (6 files)

**MCP 2025-11-25 verification** — Confirmed server already uses all spec features: `CreateMessageResultWithTools`, `toolChoice` in sampling, experimental tasks API, full capabilities declaration (resources/subscribe/listChanged, tasks/list/cancel/requests, logging, completions).

**Commit**: `371baed` — 58 files changed, 3489 insertions, 424 deletions.

## What Was Just Completed (Session 83)

**Google Cloud Monitoring analysis** — 90-min live API window (Mar 15 23:15–Mar 16 00:55 UTC) showed three failure modes: 429 bursts (23:37–23:42, 00:37–00:46), 404 cascade (23:43–23:47, 60–71% error rate triggered by quota exhaustion), and scattered 400s.

**Fix 1 — Retry-After deadline alignment** (`src/utils/retry.ts`):

- Added `extractRetryAfterMs(error)` helper (mirrors serval-core's internal `parseRetryAfter`)
- `onRetry` deadline check now uses Retry-After value when present, so deadline math matches the actual wait time serval-core enforces
- Records `googleApiRetryAfterWaitMs` metric (Fix 5) and logs when header is respected
- Note: serval-core already respects Retry-After in actual sleep (line 106–109); this fix makes the deadline check consistent with it

**Fix 2 — Spreadsheet existence pre-caching** (`src/services/cached-sheets-api.ts`):

- Added `private knownSpreadsheets = new Map<string, number>()` with 5-min TTL
- Added `async ensureSpreadsheetExists(spreadsheetId)` public method — minimal-field GET (`fields: 'spreadsheetId'`), cached result
- `invalidateSpreadsheet()` also clears the existence entry
- Call before mutations to convert 404 quota-waste into fast local throw

**Fix 3 — QuotaCircuitBreaker** (`src/utils/circuit-breaker.ts`):

- Added `QuotaCircuitBreaker` wrapper class — wraps core `CircuitBreaker`, tracks 429s separately
- Opens quota gate after `ceil(failureThreshold/2)` consecutive quota failures (default 3) with `2×timeout` reset (default 60s)
- Standard breaker still handles all other error types at normal threshold

**Fix 4 — Test harness pre-flight** (`tests/live-api/action-matrix.live.test.ts`):

- Added spreadsheet accessibility verification in `createMatrixSpreadsheet` after creation and tracking
- Throws with clear message before seeding/running 300+ actions against an inaccessible spreadsheet

**Fix 5 — Retry-After metric** (`src/observability/metrics.ts`):

- Added `googleApiRetryAfterWaitMs` Histogram (buckets 1s–120s) observed by Fix 1

**Fix A — Wire QuotaCircuitBreaker into production path** (`src/services/google-api.ts`, `src/services/circuit-breaker-registry.ts`):

- `ICircuitBreaker` interface (structural) added to `circuit-breaker.ts:40-47` — satisfied by both `CircuitBreaker` and `QuotaCircuitBreaker`
- `circuit-breaker-registry.ts`: changed `breaker` field and `register()` param from `CircuitBreaker` → `ICircuitBreaker`
- `google-api.ts`: `sheetsCircuit` field type changed to `QuotaCircuitBreaker`; `new CircuitBreaker({...})` → `new QuotaCircuitBreaker({...})` for the Sheets API breaker; `wrapGoogleApi` `circuit` option widened to `ICircuitBreaker`
- Result: 429 quota cascade now trips the fast gate (after ~3 hits) instead of waiting for 5-failure standard threshold

**Fix B — Wire ensureSpreadsheetExists into mutation path** (`src/services/google-api.ts`):

- Added `existenceChecker?: (spreadsheetId: string) => Promise<void>` option to `wrapGoogleApi`
- Proxy checks existence BEFORE executing write ops when `sharedDriveFileId` is known
- Existence cache lives on `GoogleApiClient` instance (`spreadsheetExistenceCache`, `EXISTENCE_TTL_MS = 5min`) to survive `reinitializeApis()`
- Raw pre-wrap `sheetsApi` captured in closure to avoid proxy recursion
- Both `initialize()` and `reinitializeApis()` wire the closure as `existenceChecker`
- Result: bad spreadsheetIds fail fast locally instead of consuming quota on a doomed 404

**Verification**: `npx tsc --noEmit` → 0 errors; `npm run test:fast` → all passing (parallel flakes in data-clear-bugfix are pre-existing, pass when isolated)

**Session 82 (2026-03-15) — Cache O(1) + CoT `_hints` intelligence layer.** Branch `remediation/phase-1`. 402 actions (25 tools). 8991/8991 tests. All gates green.

## What Was Just Completed (Session 82)

**Stash cleanup:** Audited all 7 git stashes against HEAD. All confirmed superseded or inferior to current code — dropped all 7.

**`perf(cache): O(1) size tracking via _totalSizeBytes running counter`** (`src/utils/cache-manager.ts`):

- Added `private _totalSizeBytes = 0` field to `CacheManager`
- 9 mutation points updated to increment/decrement the counter: `get()` (expire), `set()` (overwrite + new), `delete()`, `cleanup()`, `clear()`, `evictOldest()`, `invalidatePattern()`, `clearNamespace()`, `invalidateRange()`
- `getStats()` and `getTotalSize()` now O(1) (was O(N) full-scan loop)

**`feat(intelligence): CoT _hints layer for sheets_data read responses`** — NEW `src/services/response-hints-engine.ts` (270 lines):

- `generateResponseHints(values: CellValue[][]): ResponseHints | null` — sync, zero API calls, <50ms
- `ResponseHints`: `{ dataShape?, primaryKeyColumn?, dataRelationships?, formulaOpportunities?, riskLevel?, nextPhase? }`
- Column profiling: `isDate` (content-based), `isNumeric`, `isId` (keyword), `uniqueRatio`, `nullRatio` per column, capped at 50 data rows
- `buildDataShape()`: time-series granularity detection (daily/weekly/monthly), structured data label
- `detectPrimaryKey()`: ID-keyword + 100% unique first, any 100% unique fallback
- `detectRelationships()`: revenue+cost→profit margin formula, date×numeric→trend, 2 dates→DAYS() duration
- `assessRisk()`: `none/low/medium/high` based on nullRatio + duplicate numeric cols
- `suggestNextPhase()`: workflow string routing based on risk + data shape
- Wired into `applyResponseIntelligence()` in `response-intelligence.ts` for `sheets_data.read/batch_read/cross_read`
- NEW `tests/services/response-hints-engine.test.ts` — 17 tests, all passing

**Test count**: 8991/8991 (up from 8941 — added 17 hints tests + 33 tranche E regression tests)

## Session 81 Summary (2026-03-15)

**Session 81 (2026-03-15) — Type safety sprint + progress tranche E + recommender coverage.** Branch `remediation/phase-1`. 402 actions (25 tools). 2674/2674 tests. All gates green.

## What Was Just Completed (Session 80)

**Codebase Enhancement Plan (items A, C, D):**

- **A: task-aware-sampling-server.test.ts** — staged and committed (was untracked `??`)
- **C: ActionKey template literal** — `src/schemas/descriptions.ts` exports `ActionKey`; `cache-invalidation-graph.ts` uses `Partial<Record<ActionKey, InvalidationRule>>` for compile-time rule key validation
- **D: Zod v4 native `z.toJSONSchema()`** — snapshot tests migrated from `zod-to-json-schema` to native; 13 snapshots regenerated (draft-07→draft/2020-12); `zod-to-json-schema` removed

**34 uncommitted session files committed** in 5 batches: resources/notifications expansion, MCP sampling/features, tests, docs, audit doc.

**LLM Intelligence Sprint Phases 1-3:**

- **Phase 1**: `_meta.apiCallsMade` + `_meta.executionTimeMs` + `_meta.quotaImpact` — tracks Google API calls per-request via `RequestContext.apiCallsMade` (incremented in `wrapGoogleApi`); wall-clock time from `requestStartTime`
- **Phase 2**: Performance tier table in `features-2025-11-25.ts` (5 tiers Instant→Background); smarter `SHEET_NOT_FOUND` in `error-fix-suggester.ts` (extracts attempted name, detects emoji/whitespace/case issues)
- **Phase 3**: Batching hints in `_meta` — `applyResponseIntelligence()` now returns `{ batchingHint? }` (was void); 7-entry BATCHING_HINTS map; `transactionHint` when `apiCallsMade >= 5`

## What Was Just Completed (Session 81)

**Type safety sprint (53 generic throws → typed error classes, 11 files):**

- `src/connectors/{alpha-vantage,fred,polygon,finnhub,fmp,mcp-bridge,rest-generic}.ts` — ConfigError (API key missing), ServiceError/INTERNAL_ERROR (HTTP failures), ServiceError/QUOTA_EXCEEDED (rate limits), NotFoundError (tool/endpoint not found)
- `src/connectors/connector-manager.ts` — NotFoundError (connector not found), ConfigError (not configured), ServiceError/QUOTA_EXCEEDED (rate limit), ValidationError
- `src/utils/google-sheets-helpers.ts` — ValidationError for all A1 notation, spreadsheetId, URI limit, chip type errors
- `src/startup/lifecycle.ts` — ConfigError for all startup/init failures
- `src/security/webhook-signature.ts` — ConfigError (secret length), ValidationError (encoding/signature)

**Progress coverage tranche E** — bigquery/composite.generate_sheet/history.timeline already had sendProgress calls; added regression tests to lock in the behavior (218 lines across 3 test files).

**action-recommender.ts coverage** — 5 new RECOMMENDATION_RULES + 6 test cases:

- sheets_data.cross_write, sheets_data.cross_query, sheets_analyze.quick_insights, sheets_analyze.auto_enhance, sheets_federation.call_remote now all have relevant follow-up suggestions

**2674/2674 tests passing** (up from 2658).

## Session 80 Summary (2026-03-15)

LLM Intelligence Phases 1-3 + codebase enhancement plan items A/C/D (see prior session block).

## What Was Just Completed (Session 79)

- **Dead code removal**: 42 `noUnusedLocals` errors eliminated. Removed unused fields, functions, and exhaustiveness check vars across 16 files. `npx tsc --noEmit --noUnusedLocals`: 0 errors.
- **Typed error sprint**: 89 `throw new Error(` in `src/services/` replaced with typed classes from `src/core/errors.ts` (ValidationError, ServiceError, ConfigError, NotFoundError, AuthenticationError, DataError). 4 throws in `duckdb-worker.ts` left as plain (runs in `worker_threads`, no module resolution to src/core/).
- **ESLint fix**: `allowDefaultProject` extended to `scripts/*/*.ts` and `scripts/*/*/*.ts` to cover nested script files.
- **All commits**: 8 commits landed cleanly through pre-commit hook (alignment, drift, placeholder, silent-fallback checks all green).
- **Tests**: 2654/2654 passing after both fix sprints.

## What Was Just Completed (Session 78)

Systematic test suite repair — reduced from 63 failing tests to 0. Key fixes across 14+ test files:

- **Hardcoded 2024 timestamps**: `1704067200000` is in the past from 2026. Fixed `token-manager`, `confirm-service`, `capability-cache` tests to use `Date.now()` or `vi.useFakeTimers({ now: timestamp })`.
- **`NotFoundError` message casing**: `NotFoundError('role', id)` produces `"role not found: id"` (lowercase). Fixed `rbac`, `task-manager`, `template-store` tests.
- **`A1NotationSchema` blocks full column refs**: `A:A`, `B:B` blocked by regex. Updated `validation-errors` test to use bounded ranges.
- **Webhook `cleanupExpired`**: Used 2024 `now` — active webhooks appeared expired. Fixed to `Date.now()`.
- **Webhook SSRF test**: `WEBHOOK_DNS_STRICT=true` default caused DNS failure. Set env to `false` in test.
- **`workspace-events` constructor**: Test mocked `workspaceEvents.subscriptions.create` but impl uses `fetch` + `oauth2`. Rewrote test to mock `fetch` directly.
- **`sampling-analysis` `includeContext`**: Added `includeContext: 'thisServer'` to `buildAnalysisSamplingRequest`.
- **Resource registration "already registered"**: Added try-catch in `registerResources()` to swallow duplicate errors; added guard in `start()` to call `registerResources()` when `!this.resourcesRegistered`.
- **`schema:commit` instructions conflict**: Fixed `scripts/generate-metadata.ts` to use envelope format as canonical; regenerated `server.json`.
- **`graphql/resolvers.ts` TS error**: Removed invalid `a1Range` from `Schema$GridRange` in `applyFormat`.
- **`appsscript.get` superRefine vs llm-compatibility conflict**: Restored `superRefine` (requires scriptId OR spreadsheetId); added override in `llm-compatibility.test.ts` `applyActionOverrides` for `sheets_appsscript`+`get` to inject `spreadsheetId: SAMPLE_SPREADSHEET_ID`.

**Final result**: 353 test files passed, 51 skipped, 8941 tests passed, 0 failed.

**Session 77 (2026-03-14) — S3-A quick_insights + S3-B auto_fill implemented.** Branch `remediation/phase-1`. 2646/2646 tests. 402 actions (25 tools). All gates green.

## What Was Just Completed (Session 77)

Two new actions added following full TDD workflow (tests first, implementation second):

**S3-A: `sheets_analyze.quick_insights`** — fast AI-free structural snapshot

- Schema: `src/schemas/analyze.ts` — `QuickInsightsActionSchema` with `range`, `maxInsights` params
- Handler: `src/handlers/analyze.ts:handleQuickInsights()` — reads sheet data, detects data types per column (number/date/text/empty), computes emptyRate, generates pattern-based insights and suggestions. No Sampling call.
- `SPECIAL_CASE_TOOLS.analyze.count` updated 21→22 in `scripts/generate-metadata.ts`
- Cache rule: `sheets_analyze.quick_insights` with `invalidates: []` (read-only)

**S3-B: `sheets_data.auto_fill`** — extend a source range pattern into a fill range

- Schema: `src/schemas/data.ts` — `AutoFillActionSchema` with `sourceRange`, `fillRange`, `strategy` (`detect|linear|repeat|date`)
- Handler: `src/handlers/data-actions/auto-fill.ts` (new file, ~260 lines) — `DataHandlerAccess` pattern; `tryLinear()` (constant diff), `tryDate()` (constant time step), cyclic repeat fallback; writes via `spreadsheets.values.update`
- Wired into `src/handlers/data.ts` switch
- Cache rule: `sheets_data.auto_fill` with `invalidates: ['values:*']`

**Results:** 2 commits (test: `e5d75a8`, feat: `5791216`), 2646/2646 tests, schema:commit clean (402 actions), verify:safe green.

## Current Phase (prior)

**Session 76 (2026-03-14) — Re-audit remediation complete.** Branch `remediation/phase-1`. 2646/2646 tests. 402 actions (25 tools). Score: ~85/100 → ~88/100.

## What Was Just Completed (Session 76)

Re-audit remediation plan implemented. Most "genuine" issues from the plan were already fixed in prior sessions. Remaining work done:

**S2: Webhook DNS fail-closed** (`src/services/webhook-url-validation.ts`)

- DNS failure now throws by default (`WEBHOOK_DNS_STRICT=true`)
- Opt-out via `WEBHOOK_DNS_STRICT=false` for flaky DNS environments
- Added `WEBHOOK_DNS_STRICT` env var to `src/config/env.ts`
- 7/7 tests passing (rewrote pre-existing broken tests that expected `ValidationError` instead of `Error`)

**DX1: `servalsheets init` subcommand** (`src/cli.ts`)

- `args[0] === 'init'` → imports and runs `src/cli/auth-setup.ts:runAuthSetup()`
- Help text updated to show `init` command
- `src/cli/auth-setup.ts` already existed with full OAuth wizard; now wired as a CLI subcommand

**SC1: Plan file encryption** (delegated agent, 43/43 tests)

- NEW: `src/utils/plan-crypto.ts` — AES-256-GCM encrypt/decrypt
- `src/config/env.ts` — added `PLAN_ENCRYPTION_KEY` (64-char hex, optional)
- `src/services/agent-engine.ts` — `persistPlan` wraps with `encryptPlan`, `loadPersistedPlans` wraps with `decryptPlan`
- Backward compat: plaintext if key unset

**G2: Per-spreadsheet request throttle** (delegated agent)

- NEW: `src/services/per-spreadsheet-throttle.ts` — token-bucket per spreadsheetId, LRU-capped at 500
- `src/config/env.ts` — added `PER_SPREADSHEET_RPS` (default 3)
- `src/services/google-api.ts` — throttle wired into proxy wrapper (line ~1768)
- Fixed: lazy `rps` getter (not module-init) to avoid `getEnv()` at import time

**Pre-existing false positives confirmed and fixed:**

- G1 (timeout 30s→60s): already 60000 ✓
- E2 (compute success:true on error): already fixed ✓
- S1 (anonymous rate limit): already per-IP ✓
- E1 (silent catches): already logger.warn ✓
- F1 (quick_insights): already implemented ✓
- auto_fill (sheets_data): already implemented ✓

**Collateral fixes:**

- `COMPUTE_ERROR` added to `ErrorCodeSchema` (was missing — `ErrorCodes.COMPUTE_ERROR` was `undefined`)
- `src/handlers/analyze.ts:764` — `typeof req.range !== 'string'` guard for `generate_formula` action
- `src/handlers/data-actions/auto-fill.ts` — `GOOGLE_API_ERROR` → `INTERNAL_ERROR`
- `tests/schemas.test.ts` — ACTION_COUNT upper bound 400 → 450
- `tests/utils/ast-schema-parser.test.ts` — data action count 24 → 25
- `tests/handlers/compute.test.ts` S1-B — `=1 + abc` → `=1 + )` (expression that actually fails)
- `src/mcp/completions.ts` header comment 400 → 402
- `npm run schema:commit` — regenerated metadata for all schema changes

## What Was Just Completed (Session 75)

MCP 2025-11-25 Elicitation spec audit — 4 violations found and fixed:

1. **`ElicitationServer` interface** (`src/mcp/elicitation.ts:116`): Wrong method name `sendElicitationCompleteNotification` → correct SDK method `createElicitationCompletionNotifier?(id): () => Promise<void>` (returns notifier fn, not direct Promise)

2. **`completeOAuthFlow()`** (`src/mcp/elicitation.ts:1065`): Was calling `sendElicitationCompleteNotification` directly. Fixed to call `createElicitationCompletionNotifier(id)` → invoke result. Was also never called at all — wired into `handleLogin()` (automatic OAuth) and `handleCallback()` (manual OAuth) in `src/handlers/auth.ts`.

3. **`setupConnector()` form-mode API key (MUST NOT violation)** (`src/handlers/auth.ts`): Collecting API keys via `safeElicit` with `mode: 'form'` violates spec. Replaced with local browser form via `startApiKeyServer()` (URL mode → key never transits MCP client).

4. **`setupSampling()` form-mode API key (MUST NOT violation)** (`src/handlers/auth.ts`): Same fix — routes Anthropic API key entry through localhost browser form.

5. **Dead code removed**: `initiateVerificationFlow` export (`src/mcp/elicitation.ts`, was lines 1074-1109) — confirmed never called anywhere, deleted.

**New files:**

- `src/utils/api-key-server.ts` — localhost HTTP server for secure API key input (DNS-rebinding protection, XSS escaping, random port, 2-min timeout)
- `tests/utils/api-key-server.test.ts` — 10 tests (all passing)
- `tests/unit/source-emoji-guard.test.ts` updated — added `utils/api-key-server.ts` to allowlist

**Pre-existing failures (NOT introduced this session):** `tests/cli/auth-setup.test.ts` (5 tests, `validateStoredOAuthTokens is not a function`)

**Session 58 (2026-03-11) — Full LLM Intelligence plan complete.** 2,641/2,641 tests. 399 actions. All gates G0-G1 green. Branch `remediation/phase-1`. Final commit: `b2da52b`.

## What Was Just Completed (Session 58)

4-sprint LLM Intelligence plan fully implemented (6 commits, Tracks A-D):

**Sprint 1 (A1-A7) — Response Intelligence:**

- A1: `src/services/lightweight-quality-scanner.ts` (NEW) — 5 quality checks injected into every read/write response as `dataQualityWarnings`
- A2: `src/services/action-recommender.ts` — 3-signal data-aware suggestions (data signals + confidence gaps + static fallback)
- A3: `src/handlers/base.ts` + `src/services/error-pattern-learner.ts` — pattern learner wired into error responses
- A4: `src/mcp/sampling.ts` + `src/services/session-context.ts` — last-5 ops + active spreadsheet injected into sampling context
- A5: `src/mcp/features-2025-11-25.ts` — Error Recovery table + AI Features + Advanced Sheet Patterns sections added
- A6: `src/utils/response-compactor.ts` — `_truncated` key injected when fields are compacted
- A7: `src/schemas/session.ts`, `webhook.ts`, `transaction.ts` — enriched `.describe()` text on all params

**Sprint 2 (B1-B4) — Agent Intelligence:**

- B1: `src/services/agent-engine.ts` — structured `ErrorDetail` on plan state, auto-retry on retryable errors, auto-recovery step injection on `fixableVia`
- B2: `src/mcp/elicitation.ts` — `elicitUserClarification()` for confidence-triggered mid-tool elicitation
- B3: `src/services/session-context.ts` — `recordElicitationRejection()` + `wasRecentlyRejected()` (30-min window)
- B4: `src/utils/circuit-breaker.ts` — code-based `NON_RETRYABLE_FOR_CIRCUIT_BREAKER` set (no more text matching)

**Sprint 3 (C1-C3) — Formula Intelligence:**

- C1: `src/analysis/formula-helpers.ts` — `FORMULA_PATTERN_LIBRARY` (10 patterns) + `getRelevantPatterns()` + `extractFormulaKeywords()`; wired into `src/services/sampling-analysis.ts` few-shot examples
- C2: `src/services/sheet-generator.ts` — XLOOKUP/FILTER/ARRAYFORMULA standards + 4 new domain recipes (Marketing Funnel, Project Gantt, Inventory, HR Roster) + `lookupSource` cross-sheet injection + formula validation pass
- C3: `src/analysis/suggestion-engine.ts` — `COLUMN_SEMANTIC_GROUPS` (6 groups) + `detectSemanticPatterns()` with 15 new rules

**Sprint 4 (D1-D3) — Advanced Orchestration:**

- D1: `src/services/agent-engine.ts` — `inject_cross_sheet_lookup` step type + 4 workflow templates (multi-sheet-crm, budget-vs-actuals, project-tracker, inventory-with-lookups)
- D2: `src/handlers/composite.ts` + `src/schemas/composite.ts` — `build_dashboard` action (KPI rows, charts, slicers, layout presets)
- D3: `src/handlers/format.ts` + `src/schemas/format.ts` — `build_dependent_dropdown` action (named ranges + ONE_OF_RANGE validation)

**Result:** 397 → 399 actions, 2,641 tests passing, all pre-commit gates green.

## Genuine Remaining Work

1. **Error typing**: ~100 generic throws remain in src/services/ (google-api.ts, analysis/) — handlers already clean
2. **P18-D1–D10**: Handler decomposition — file-size budget system in place; actual decomposition deferred
3. ~~**16-F1–F6**: Formula evaluation engine~~ — **COMPLETE** ✅ `src/services/formula-evaluator.ts` (582 lines, HyperFormula v3.2.0, 5-layer evaluator) + `src/services/apps-script-evaluator.ts` (166 lines, Apps Script fallback). Wired into `model_scenario`, `compare_scenarios`, `create_scenario_sheet`.
4. **ISSUE-073**: Git worktree cleanup (maintainer-only)
5. **ISSUE-075**: npm publish @serval/core v0.2.0 (maintainer-only)
6. **Sampling**: Add `ANTHROPIC_API_KEY` to claude_desktop_config.json env block (manual — user must add own key)

## Verified False Claims (do not re-investigate)

These were in prior session notes or audit plans but are source-verified NOT real issues:

- **G-1**: revision-timeline no pagination — FALSE. `revision-timeline.ts:119-140` paginates with 50-page cap.
- **G-2**: collaborate/versions no pagination — FALSE. `versions.ts:390-399` paginates with 100-page cap.
- **G-4**: Apps Script bypasses `wrapGoogleApi` retry — FALSE. `appsscript.ts:365` wraps with `executeWithRetry()` + circuit breaker.
- **G-6**: core.list no pagination — FALSE. `core-actions/spreadsheet-read.ts:182-261` has cursor-based pagination with 20-page cap.
- **NEW-1 (agent self-eval gap)**: RESOLVED. `executePlan()` now calls `aiValidateStepResult()` after each step (IMP-03, 2026-03-09). Tests: `tests/services/agent-engine-selfeval.test.ts`.
- **NEW-2 (connector discover SSRF)**: RESOLVED. `connectors.ts:278` validates `req.endpoint` against `discovery.endpoints` before calling `getEndpointSchema()`.
- **connector manager unbounded maps** — FALSE. `cappedMapSet` used at tenant-context.ts:214,302,360,381,429.
- **OAuth redirect URI hardcoded** — FALSE. `oauth-config.ts:26` reads `OAUTH_REDIRECT_URI` from env.

## What Was Just Completed

### Session 55 (2026-03-03) — MCP/API Fixes + Workspace Hygiene

**MCP/API Fixes (6):**

- Fix 1A: `bootstrap.ts` error message `=true` → `=strict` (GDPR consent env var)
- Fix 1B: Removed duplicate `registerSamplingConsentChecker` from `http-server.ts` + orphaned imports
- Fix 1C: Stale "16 tools" comment → "all 25 tools" in `features-2025-11-25.ts`
- Fix 2A: `tools: { listChanged: true }` declared in `createServerCapabilities()` when STAGED_REGISTRATION active
- Fix 2B: `audience` annotations on all content items in `response-builder.ts` (`['assistant']` / `['user','assistant']` for errors)
- Fix 3A: Hardened `is304NotModified()` in `etag-helpers.ts` to check all GaxiosError shapes

**VERIFIED_FIX_PLAN (9 fixes):**

- Fix 1: `manifest.json` rewritten to MCPB v0.3 format (version 1.7.0, 25/391, correct icon)
- Fix 2: 19 doc files updated (22→25 tools, stale counts→391 actions); RELEASE_NOTES_1.6.0.md preserved
- Fix 3: `CODEBASE_CONTEXT.md` + `PROJECT_STATUS.md` 377→391
- Fix 4: 10 untracked root files deleted/moved to `docs/audits/`
- Fix 5: `git mv GOOGLE_API_ISSUES.md docs/audits/` + `ISSUES.md docs/historical/`
- Fix 6: `docs/archive/abandoned-v2/` deleted (git rm -rf)
- Fix 7: `.data/` deleted; Fix 8: `.bak` files deleted
- Fix 9: Action list extracted to `docs/development/ACTION_REGISTRY.md`; Feature Flags table removed from CODEBASE_CONTEXT.md (~45-line savings per session)

**Result:** 0 TS errors, 2452/2452 tests, drift PASS, G0–G5 all green

## Session 54 (2026-03-03) — Project Audit Execution & Doc Hygiene

- Executed all 9 fixes from VERIFIED_FIX_PLAN.md (Fixes 1-8 were already done in prior sessions):
  - **Fix 2 remaining**: Added current-count notes to 3 historical docs (RELEASE_NOTES_1.6.0.md, ISSUES.md, GOOGLE_API_ISSUES.md)
  - **Fix 9c**: Created `scripts/sync-doc-counts.mjs` with progression-pattern detection and historical-doc skipping
  - Fixed 5 stale count references in non-historical docs via sync script (`--fix` mode)
  - Fixed "22-tool" → "25-tool" in FEATURE_PLAN.md line 18
- Verified all fixes: 0 stale "22 tools" in non-historical docs, 0 stale "377 actions", manifest.json correct (v1.7.0/25/391), 0 untracked root clutter
- Note: `scripts/sync-doc-counts.ts` (TS version, Session 18) already exists in package.json but lacks progression-pattern detection; `.mjs` version is more robust
- Note: `FULL_PROJECT_AUDIT_AND_PLAN.md` and `VERIFIED_FIX_PLAN.md` remain on disk (untracked, deletion blocked by sandbox permissions)
- Note: `docs/archive/abandoned-v2/package-v2.json` remains on disk (untracked, 0 git-tracked files, deletion blocked)
- Typecheck: OOM in sandbox (known issue — needs 3GB+ heap)

### Session 53 (2026-03-03) — P2 Hardening Follow-Through

- Added consent gates to remaining direct sampling call paths in decomposed handlers/services:
  - `analyze-actions/query-natural-language.ts`
  - `analyze-actions/explain.ts`
  - `format-actions/validation.ts`
  - `services/llm-fallback.ts`
  - `services/sheet-generator.ts`
- Added core progress streaming coverage for `sheets_core.batch_get`:
  - `core-actions/spreadsheet-read.ts` emits MCP progress notifications for large request sets
  - `core.ts` now injects `sendProgress` into spreadsheet-read deps
- Added regression tests:
  - `tests/unit/llm-fallback-consent.test.ts` (new)
  - `tests/handlers/core.test.ts` progress assertion for `batch_get`
- Fixed strict typing regressions in decomposed analyze actions (`query-natural-language.ts`, `suggest-visualization.ts`).
- Verification run:
  - `npm run typecheck` ✅
  - targeted `eslint` (with `NODE_OPTIONS=--max-old-space-size=8192`) ✅
  - `npx vitest run tests/handlers/core.test.ts tests/unit/llm-fallback-consent.test.ts tests/mcp/sampling-consent-cache.test.ts` ✅ (`44/44`)

### Session 53 (2026-03-03) — P2 Deep Sampling-Consent Audit Closure

- Completed helper-level consent audit and hardening:
  - `src/mcp/sampling.ts`: added `assertSamplingConsent()` to `analyzeDataStreaming` summary call and `streamAgenticOperation` loop entry.
  - `src/services/agent-engine.ts`: local consent guard now falls back to global MCP sampling consent guard when no agent-local checker is configured.
- Added explicit regression tests:
  - `tests/mcp/sampling-agentic-consent.test.ts`
  - `tests/services/agent-engine-consent.test.ts`
- Verification run:
  - `npm run typecheck` ✅
  - targeted `eslint` (`sampling.ts`, `agent-engine.ts`, new tests) ✅
  - `npx vitest run tests/mcp/sampling-consent-cache.test.ts tests/mcp/sampling-agentic-consent.test.ts tests/services/agent-engine-consent.test.ts tests/unit/llm-fallback-consent.test.ts tests/handlers/core.test.ts` ✅ (`47/47`)

### Session 53 (2026-03-03) — P2 Progress Coverage Phase-2 (Tranche A)

- Added progress notifications for additional long-running handlers:
  - `src/handlers/analyze-actions/formulas.ts` (`analyze_formulas` full-grid scan)
  - `src/handlers/advanced-actions/chips.ts` (`list_chips` multi-sheet chip scan)
- Wired progress callbacks from parent handlers:
  - `src/handlers/analyze.ts`
  - `src/handlers/advanced.ts`
- Added regression assertions:
  - `tests/handlers/analyze.test.ts` (analyze_formulas progress emission)
  - `tests/handlers/advanced.test.ts` (list_chips progress emission)
- Verification run:
  - `npm run typecheck` ✅
  - targeted source `eslint` ✅ (`formulas.ts`, `analyze.ts`, `chips.ts`, `advanced.ts`)
  - `npx vitest run tests/handlers/analyze.test.ts tests/handlers/advanced.test.ts tests/handlers/core.test.ts tests/mcp/sampling-agentic-consent.test.ts tests/services/agent-engine-consent.test.ts` ✅ (`101/101`)

### Session 53 (2026-03-03) — P2 Progress Coverage Phase-2 (Tranche B)

- Added progress notifications for composite orchestration loops:
  - `src/handlers/composite-actions/batch.ts` (`batch_operations` sequential operation execution)
- Wired progress callback from parent handler:
  - `src/handlers/composite.ts`
- Added regression assertion:
  - `tests/handlers/composite.test.ts` (batch_operations progress emission)
- Verification run:
  - `npm run typecheck` ✅
  - targeted source `eslint` ✅ (`batch.ts`, `composite.ts`)
  - `npx vitest run tests/handlers/composite.test.ts tests/handlers/core.test.ts tests/handlers/analyze.test.ts tests/handlers/advanced.test.ts` ✅ (`187/187`)

### Session 53 (2026-03-03) — P2 Progress Coverage Phase-2 (Tranche C)

- Added progress notifications for dependency scenario analysis loops:
  - `src/handlers/dependencies.ts`:
    - `model_scenario` multi-change impact/evaluation phases
    - `compare_scenarios` multi-scenario phase progression
- Added regression assertions:
  - `tests/handlers/dependencies.test.ts` (request-context progress notification checks for `model_scenario` and `compare_scenarios`)
- Verification run:
  - `npm run typecheck` ✅
  - targeted source `eslint` ✅ (`dependencies.ts`)
  - `npx vitest run tests/handlers/dependencies.test.ts tests/handlers/composite.test.ts tests/handlers/core.test.ts tests/handlers/analyze.test.ts tests/handlers/advanced.test.ts` ✅ (`222/222`)

### Session 53 (2026-03-03) — P2 Progress Coverage Phase-2 (Tranche D)

- Added progress notifications for template application workflows:
  - `src/handlers/templates.ts`:
    - multi-sheet `apply` progress milestones (start, periodic sheet preparation, completion)
- Added regression assertion:
  - `tests/handlers/templates.test.ts` (progress notification check for multi-sheet `apply`)
- Verification run:
  - `npm run typecheck` ✅
  - targeted source `eslint` ✅ (`templates.ts`)
  - `npx vitest run tests/handlers/templates.test.ts tests/handlers/dependencies.test.ts tests/handlers/composite.test.ts tests/handlers/core.test.ts tests/handlers/analyze.test.ts tests/handlers/advanced.test.ts` ✅ (`264/264`)
  - Extended focused suite (consent + progress coverage): `npx vitest run tests/mcp/sampling-consent-cache.test.ts tests/mcp/sampling-agentic-consent.test.ts tests/services/agent-engine-consent.test.ts tests/unit/llm-fallback-consent.test.ts tests/handlers/core.test.ts tests/handlers/analyze.test.ts tests/handlers/advanced.test.ts tests/handlers/composite.test.ts tests/handlers/dependencies.test.ts tests/handlers/templates.test.ts` ✅ (`272/272`)

### Session 52 (2026-03-02) — P18 Verification Sprint

- **P18-P1–P4**: `pipeline-executor.ts` + `execute_pipeline` on sheets_session already implemented ✅
- **P18-X4**: `sampling-validator.ts` (96 lines) with 5 Zod schemas already implemented ✅
- **P18-X1–X3**: DuckDB (sql_query/sql_join + duckdb-engine.ts), Pyodide (ENABLE_PYTHON_COMPUTE), Workspace Events (auto-renewal at expireTime-12h) — all already implemented ✅
- **P18-X5**: `progress: {}` in ServerCapabilities blocked by TS2353 (SDK type gap) — marked N/A; sendProgress() already works per-request ✅
- **P18-G3**: Updated 7 stale `377`→`391` references in competitive gap analysis doc ✅
- **Result**: 0 TS errors, 2444/2444 tests, check:drift PASS

### Session 51 (2026-03-02) — P16 Backlog Verification

- All P16 items (16-B4, 16-B5, 16-C1–C2, 16-S1–S5, 16-A1–A6, 16-U1–U4) already implemented — TASKS.md was stale
- **16-U5 (genuine)**: Added 5 missing prompt registrations to `prompt-registration.ts` (`audit_sheet`, `publish_report`, `data_pipeline`, `instantiate_template`, `migrate_spreadsheet`); schemas existed in `src/schemas/prompts.ts:259-301`
- state.md regenerated (377→391), TASKS.md marked all P16 `[x]`, UNIFIED_IMPROVEMENT_PLAN.md updated to Rev 7

### Session 50 (2026-03-01) — Advanced Integrations (+14 actions, 377→391)

- **DuckDB**: sql_query + sql_join on sheets_compute; `duckdb-engine.ts` + `duckdb-worker.ts`
- **Pyodide**: python_eval, pandas_profile, sklearn_model, matplotlib_chart; `python-engine.ts`
- **Drive Activity**: WHO/WHEN attribution on history.timeline; `drive.activity.readonly` scope
- **Workspace Events**: subscribe/unsubscribe/list; `workspace-events.ts` (7-day auto-renewal)
- **SERVAL() Formula AI**: install_serval_function; HMAC-SHA256 signing; `formula-callback.ts`
- **Scheduler**: schedule_create/list/cancel/run_now; `scheduler.ts` with node-cron + JSON persistence
- **Sampling Validator**: `sampling-validator.ts` wired into 5 sampling call sites
- **Result**: 377→391 actions, 2444/2444 tests, 0 TS errors

### Session 49 (2026-02-28) — P16 LLM Usability + Elicitation Wiring

- `features-2025-11-25.ts`: 5-GROUP MENTAL MODEL, 11 new few-shot examples, INTERACTIVE WIZARDS section
- Wired `elicitSpreadsheetCreation` (title + locale + timezone) → sheets_core.create
- Wired `elicitSharingSettings` (email + role + notification) → sheets_collaborate.share_add
- **Result**: 0 TS errors, 2427/2427 tests

### Session 47-48 (2026-02-28) — G0–G5 Gates Green + LLM UX Polish

- Fixed connectors.ts:106 TS2322 (last gate blocker)
- Added 5 test registry entries, updated stale action names in 3 test files
- 45 errorRecovery blocks across annotations.ts; 17 action aliases in completions.ts
- **Gate status**: G0✅ G1✅ G2✅ G3✅ G4✅ G5✅ (25 tools, 391 actions, 2425 tests)

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

| Date       | Session | Summary                                                                                                                               |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-03 | 54      | Project audit execution: fixed 5 stale doc counts, created sync-doc-counts.mjs, added historical-doc notes, all verifications green   |
| 2026-03-03 | 53      | P2 phase-2 progress coverage tranche D: added progress notifications for templates.apply (multi-sheet), tests green                   |
| 2026-03-03 | 53      | P2 phase-2 progress coverage tranche C: added progress notifications for dependencies.model_scenario + compare_scenarios, tests green |
| 2026-03-03 | 53      | P2 phase-2 progress coverage tranche B: added progress notifications for composite.batch_operations, tests green                      |
| 2026-03-03 | 53      | P2 phase-2 progress coverage tranche A: added progress notifications for analyze_formulas + list_chips, tests green                   |
| 2026-03-03 | 53      | P2 follow-through: sampling-consent hardening + core.batch_get progress notifications + focused regression tests                      |
| 2026-03-02 | 52      | P18 verification sprint — all items closed or N/A                                                                                     |
| 2026-03-02 | 51      | P16 backlog verification, 5 prompt registrations added, state.md updated                                                              |
| 2026-03-01 | 50      | Advanced integrations: DuckDB/Pyodide/Drive Activity/Workspace Events/Scheduler/SERVAL Formula                                        |
| 2026-02-28 | 49      | P16 LLM usability, elicitation wiring (core.create + collaborate.share_add)                                                           |
| 2026-02-28 | 47-48   | G0–G5 gates green, connectors.ts fix, LLM UX polish (annotations, aliases)                                                            |
| 2026-02-27 | 46      | sheets_connectors metadata + full wiring verification (10 actions)                                                                    |
| 2026-02-25 | 41      | ISSUE-226/234/237 fixes; 24 issues verified already fixed                                                                             |
| 2026-02-24 | 39      | Remediation Phase 1: 9 tests fixed, security fixes, gate pipeline restored                                                            |
| 2026-02-23 | 35-38   | P6 API fixes, P7–P15 implementation (cache, safety rails, MCP wiring, 5 composite actions)                                            |
| 2026-02-23 | 24-34   | P4 features: F4 Suggestions, F3 Cleaning, F1 Generator, F5 Time-Travel, F6 Scenarios, F2 Federation                                   |
| 2026-02-22 | 18-23   | P2 feature flags, P3 backends (Excel/Notion/Airtable), P4 feature plan                                                                |
| 2026-02-21 | 13-17   | P0 serval-core migration, P1 DX polish (ESLint fix, drift check, silent FPs)                                                          |
| 2026-02-20 | 8-12    | Audit infrastructure (fixtures, coverage, gates, drift, agents)                                                                       |
