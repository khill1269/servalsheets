# Code Review Orchestrator Memory

## Confirmed Patterns

### Handler Inheritance Split (confirmed 2026-02-17)

- 12 of 22 handlers extend BaseHandler: advanced, appsscript, bigquery, collaborate, composite, core, data, dimensions, fix, format, templates, visualize
- 10 handlers do NOT extend BaseHandler: analyze, auth, confirm, dependencies, federation, history, quality, session, transaction, webhooks
- This is intentional for handlers that don't require Google API calls (auth, transaction, history), but creates inconsistency
- Non-BaseHandler handlers each re-implement: applyVerbosityFilter, error handling, requireAuth patterns

### v1-compat Inversion Bug (confirmed 2026-02-17, still present 2026-05-13)

- File: `src/versioning/v1-compat.ts:15-17`
- `ACTION_MAPPINGS_V2_TO_V1` is built by inverting V1_TO_V2, but the map has many-to-one (hide_sheet, show_sheet, rename_sheet all map to update_sheet)
- Result: only ONE of those v1 actions survives in the inverse map (last-write wins = rename_sheet → update_sheet)
- `getV1ActionName('update_sheet')` returns `'rename_sheet'` instead of being meaningfully ambiguous

### Retry Logic / 401 Bug (RESOLVED as of 2026-05-13)

- File: `src/utils/retry.ts:159-175`
- 401 handling was previously too broad; now it only retries for specific token-expired/revoked messages
- 401 + generic "access denied" message is correctly NOT retried (returns after 1 attempt)
- Test `should NOT retry on 401 with non-token error message` at `tests/utils/retry.test.ts:191` — PASSES
- All 1871 tests pass as of 2026-05-13

### process.env Direct Access in Source (confirmed 2026-02-17, updated 2026-05-13)

- `src/handlers/auth-actions/auth-flow.ts:70` — OAUTH_USE_CALLBACK_SERVER read directly
- `src/handlers/auth-actions/feature-setup.ts:384,460,579-580` — process.env WRITES for runtime config (intentional hot-wiring pattern, not a bug)
- `src/handlers/analyze.ts:299-300,527-528` — ANALYZE_MAX_ROWS, ANALYZE_MAX_COLS read directly (not in env.ts)
- `src/handlers/data-actions/read-write.ts:1061,1166` — GOOGLE_API_TIMEOUT_MS read directly (also in retry.ts GOOGLE_SHEETS_RETRY_CONFIG)
- `src/handlers/analyze-actions/semantic-search.ts:28` — GOOGLE_API_KEY read directly
- `src/utils/retry.ts:26-46` — GOOGLE_API_MAX_RETRIES etc. read directly (confirmed pattern, low priority)

### ESLint Warnings (confirmed 2026-02-17, status 2026-05-13)

- `npm run lint` passes with `--max-warnings 0` (0 errors, 0 warnings presented)
- CLI console.log warnings handled correctly per eslint.config.js

### Silent Fallback Check

- `npm run check:silent-fallbacks` — PASSES (no silent fallbacks detected)

### Test Health (confirmed 2026-05-13)

- `npm run test:fast` — 1871 passed (84 files), 0 failures
- All known prior failures (retry 401, enhanced-errors-resources) are resolved

### Data Schema vs Handler Alignment

- data schema has 19 actions (check:drift says 19), handler switch has 19 cases + undocumented aliases in default branch
- detect_spill_ranges IS in both schema and handler (confirmed)
- Aliases in default branch (set_note, add_hyperlink, merge, unmerge) not in schema - acceptable per handler-deviations pattern

### DI Container Usage

- Container class is implemented but handlers are NOT wired through it
- Handlers are instantiated directly in tool-handlers.ts via createHandlers()
- The container exists as infrastructure but has no registrations in production code

### Flat Mode Source Files NOT Removed (found 2026-05-13)

- CLAUDE.md gotcha #19 and commit cbf32ee8 ("docs: update action count to 411, document flat-mode removal (P23)") claim flat mode was REMOVED in P23
- The commit only updated docs/CLAUDE.md — it did NOT delete any source files
- These files still exist and are functional: flat-tool-registry.ts (350 lines), flat-tool-routing.ts (115), flat-discover-handler.ts (100), flat-input-schemas.ts (231), flat-tool-call-interceptor.ts (217)
- `registerFlatToolCallInterceptor` is called in tool-handlers.ts:2155 and build-server-stdio-tool-runtime.ts:261 — it's live code, not dead
- `getEffectiveToolMode()` in src/config/constants.ts:394 still returns 'flat' when SERVAL_TOOL_MODE=flat
- RESOLUTION NEEDED: Either (a) actually delete flat-mode files and remove all callers, or (b) update documentation to say "flat mode is discouraged but still available via SERVAL_TOOL_MODE=flat"

### Google API Scout includeGridData Without Ranges (found 2026-05-13)

- File: `src/handlers/analyze-actions/scout.ts:65-73`
- `spreadsheets.get` with `includeGridData: true` but no `ranges:` parameter
- Comment says "narrow the range aggressively: one cell per sheet" but the call fetches ALL rows (no ranges= causes API to return all row data)
- `fields` mask limits payload to formulaValue only, so bandwidth impact is reduced but still fetches all cells
- Fix: add `ranges: ['A1']` (or sheet-scoped ranges) to constrain API response size for large spreadsheets

### BigQuery SQL Query Schema (note 2026-05-13)

- `src/schemas/bigquery.ts` — query field is `z.string().min(1)` with no length cap
- Parameterized queries are supported via `queryParameters` field, but not enforced
- BigQuery's own parsing prevents injection via parameterization; direct injection is a BigQuery-level concern
- No immediate code change needed, but adding a note in the schema description to prefer parameterized queries would be good practice
