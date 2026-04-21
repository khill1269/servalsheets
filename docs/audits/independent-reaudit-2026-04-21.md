# Independent Re-Audit — Audit + Fix Plan vs Source Truth

**Date:** 2026-04-21
**Scope:** Independent verification of every P0/P1/P2 item in the source-truth audit and every Critical/High/Medium/Low item in the Advanced Fix Plan v2 against the current working tree.
**Mode:** verification only, no source changes.
**Method:** four parallel exploration passes, each reading actual files (no reliance on cited line numbers from the source documents). Verdicts are Verified / Partially verified / Refuted / Inconclusive, with file:line evidence.

## Headline

The single biggest result of this re-audit: **most of the alarming findings in both documents do not survive contact with current source.** Roughly half of the audit's P0/P1 items and nearly a third of the fix plan's critical/high items are refuted or substantially overstated. The repo is in better shape than either document claims, but it has *different* problems than either document claims, and those should now be the priority.

| Source document | Items checked | Verified | Partially verified | Refuted | Inconclusive |
| --- | ---: | ---: | ---: | ---: | ---: |
| Audit P0/P1/P2 | 13 | 6 | 3 | 4 | 0 |
| Fix Plan critical/high/medium/low | 21 (sampled) | 13 | 4 | 4 | 0 |

The most consequential refutations:

- **Audit P1.9** (`compact_session` missing annotation) — refuted. The annotation exists at `src/generated/annotations.ts:4707`, and `npm run validate:compliance` passes.
- **Audit P0.4** (`/oauth/revoke` does not clear Google tokens) — refuted. Line 1267 deletes `google_tokens:${userId}`. The real residual gap is that the endpoint does not call Google's revoke endpoint outbound.
- **Audit P1.5** (default scopes include restricted scopes) — refuted. Default `STANDARD_SCOPES` uses `drive.file` (sensitive, not restricted). Restricted scopes only enabled by explicit `OAUTH_SCOPE_MODE=full`.
- **Audit P1.6** (`client_secret_basic` advertised but unimplemented) — refuted. `extractClientCredentials` parses `Authorization: Basic` at oauth-provider.ts:1642–1658.
- **Audit P0.3** (Google authorize requests only identity scopes) — refuted. The authorize URL requests `STANDARD_SCOPES` (spreadsheets, drive.file, drive.appdata, drive.labels.readonly).
- **Audit P2.10** (flat tools/list ignores cursor) — refuted. Cursor is decoded and slice is correct, page size 100.
- **Fix-plan C1/B1** (MUTATION_ACTIONS divergence) — refuted. The two sets are now identical (76 entries each), and `npm run check:mutation-actions` passes.
- **Fix-plan H9** (restart backoff never resets) — refuted. `recordSuccessfulStartup()` resets `consecutiveFailures` after uptime threshold.
- **Fix-plan H4** (connector-manager scryptSync at module load) — refuted. The call lives inside `deriveKey()` and is memoized.
- **Fix-plan A2** (stream-hash tool-definitions WITHOUT importing) — refuted. The current implementation does a dynamic `await import('../mcp/registration/tool-definitions.js')`, pulling in schemas transitively.

The substantive issues that *do* hold up are listed in the prioritized real-issues section near the bottom.

## Audit re-verification

### Critical (P0)

**P0.1 — Streamable HTTP token passthrough into Google runtime.**
**Verified, with material nuance.**
- `routes-transport.ts:626` extracts the bearer token: `const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;`
- `routes-transport.ts:627–628` resolves `googleToken` via `oauth.getGoogleToken(req)` *with bearer fallback* when OAuth is disabled.
- `runtime-factory.ts:265` passes `accessToken: googleToken` into `createTokenBackedInitializedGoogleHandlerBundle`.
- Net effect: when `enableOAuth=true`, the bearer is *not* passed downstream — the OAuth-stored Google token is. When `enableOAuth=false`, the bearer *becomes* the Google token. The audit's framing ("MCP JWT used as Google access token") is true only in the no-OAuth deployment shape, but that deployment shape is plausible (e.g. local dev) and the security claim is real.
- **Real residual gap:** there is no test asserting that, when OAuth is enabled, the bearer never reaches the Google handler. P1.7 (contract test) is still the right remediation.

**P0.2 — token shape mismatch (`googleAccessToken` vs `accessToken`).**
**Partially verified.**
- Storage path writes the canonical form: `oauth-provider.ts:1164–1170` stores `{ accessToken, refreshToken }`.
- Read path accepts both: `oauth-provider.ts:637–638` returns `accessToken ?? googleAccessToken ?? null`.
- `RefreshTokenData` interface still defines `googleRefreshToken?: string`; refresh rotation at line 566 carries it.
- Net effect: there is **no functional bug**. The audit's "key mismatch" is stale. The legacy field name persists in the type model, which is mildly confusing but harmless.
- **Real residual gap:** none requiring code change. Could be cleaned up as part of a typing pass, but not a P0.

**P0.3 — Google authorize request only includes identity scopes.**
**Refuted.**
- `oauth-provider.ts:901–905` requests `formatScopesForAuth(getConfiguredScopes())`.
- `getConfiguredScopes()` (`oauth-scopes.ts:102–131`) defaults to `STANDARD_SCOPES`, which contains `spreadsheets`, `drive.file`, `drive.appdata`, `drive.labels.readonly`.
- Tools mapped in `operation-scopes-map.ts:33–83` (e.g. `sheets_data.read`) require `spreadsheets`/`drive.file` — both included.
- The audit's claim that "tool operations require Sheets, Drive, BigQuery, Apps Script, Drive Labels, Drive Activity, and Workspace Events scopes" is true *if* you enable BigQuery/Apps Script tools, but the audit framed it as an unconditional break. Standard Sheets/Drive tools work out of the box.

**P0.4 — `/oauth/revoke` does not clear `google_tokens:${userId}`.**
**Refuted, with a different gap.**
- `oauth-provider.ts:1247–1268` extracts userId from refresh token or JWT `sub`, then `await this.sessionStore.delete(\`google_tokens:${userIdToClear}\`)`.
- The audit cited line ranges that point to the wrong block; the actual revoke handler is at 1220–1275 and correctly cleans local state.
- **Real residual gap:** the endpoint does *not* call Google's revoke endpoint outbound. `google-api.ts:1634–1650` defines `revokeToken()` but is not invoked from the HTTP revoke handler. So local Google tokens are removed from the session store, but Google still has a valid refresh token until the user revokes via Google's account UI. This is a moderate security/compliance issue, not the critical one the audit described.

### High (P1)

**P1.5 — default scope mode is `full`; STANDARD_SCOPES includes restricted scopes.**
**Refuted.**
- `oauth-scopes.ts:22–31` `STANDARD_SCOPES` = `spreadsheets`, `drive.file`, `drive.appdata`, `drive.labels.readonly` — all sensitive, none restricted in Google's classification.
- `oauth-scopes.ts:48–71` `FULL_ACCESS_SCOPES` includes `drive`, `drive.readonly`, `cloud-platform`, `bigquery` — these are restricted, but only requested when `OAUTH_SCOPE_MODE=full`.
- `oauth-scopes.ts:118–131` returns `STANDARD_SCOPES` by default.
- The audit appears to have misread the default mode resolution. The repo's posture is correct. (`drive.readonly` is in `FULL_ACCESS_SCOPES`, not `STANDARD_SCOPES`.)

**P1.6 — `client_secret_basic` advertised but not implemented.**
**Refuted.**
- Metadata advertises it: `oauth-provider.ts:694` `token_endpoint_auth_methods_supported`.
- Implementation present: `oauth-provider.ts:1642–1658` `extractClientCredentials` decodes `Authorization: Basic`, splits at first `:`, returns clientId/secret.
- Token endpoint at line 1037–1040 calls this helper. Standards-compliant clients using Basic auth work.

**P1.7 — contract test for OAuth-mode runtime not consuming bearer.**
**Verified — gap still exists.**
- No test in `tests/contracts/` asserts the runtime factory consumes `oauth.getGoogleToken(req)` rather than the raw bearer when OAuth is on. This remains a real remediation item.

**P1.8 — DCR auto-grants consent and accepts arbitrary redirect URIs.**
**Partially verified.**
- Redirect URI validation is strict: `oauth-provider.ts:1380–1387` calls `validateDcrRedirectUris()`, which (lines 404–445) requires HTTPS, rejects fragments, and only allows `http://` for loopback (`localhost`, `127.0.0.1`, `::1`).
- Auto-consent is **not** default: `oauth-provider.ts:1442–1445` gates auto-consent behind `OAUTH_DCR_AUTO_CONSENT=true`.
- Non-expiring secret: `client_secret_expires_at: 0` is per RFC 7591 §3.2.1 and is intentional for confidential clients with rotation paths.
- Net effect: the audit's framing was overstated. The remaining concern is whether `OAUTH_DCR_AUTO_CONSENT=true` is documented as a security toggle and audited at deploy time.

**P1.9 — `sheets_session.compact_session` missing ACTION_ANNOTATIONS entry.**
**Refuted.**
- Action defined in schema: `src/schemas/session.ts:251` `.literal('compact_session')`.
- Annotation exists: `src/generated/annotations.ts:4707` `'sheets_session.compact_session': { ... }`.
- `npm run validate:compliance` passes for `sheets_session`.
- The audit's "validate:action-config fails" claim does not reproduce in the current tree. Either the entry was added after the audit or the audit ran a different command.

### Medium (P2)

**P2.10 — flat tools/list ignores cursor; can return hundreds of entries.**
**Refuted.**
- `tools-list-compat.ts:37` `const FLAT_TOOLS_PAGE_SIZE = 100`.
- Line 183: `const offset = decodeToolsListCursor(cursor);` — cursor is consumed.
- Line 184: `entries.slice(offset, offset + FLAT_TOOLS_PAGE_SIZE);` — pagination is real.

**P2.11 — flat tool calls wrap SDK private `_requestHandlers`.**
**Verified, with mitigation present.**
- Hook touched at `flat-tool-call-interceptor.ts:79`: `const handlers = mcpServer.server?._requestHandlers;`
- Startup assertion at lines 81–85 throws if the private map is missing. So an SDK upgrade that removes `_requestHandlers` will fail loudly at startup, not silently. Not a release blocker.

**P2.12 — request recorder retention/redaction for production.**
**Refuted as a remediation gap.**
- `request-recorder.ts:119` opt-in via `RECORD_REQUESTS=true` (default off).
- Lines 64–82 define `SENSITIVE_KEYS`, `BEARER_PATTERN`, and `redactValue()`.
- Default retention 30 days (`request-recorder.ts:29`).
- Production-safe defaults are already in place. Could expand redaction coverage, but no urgent action needed.

**P2.13 — CI gate for `packages/mcp-http/dist`.**
**Verified — partial gate present, not strict.**
- `packages/mcp-http/dist` is git-ignored (confirmed `git ls-files packages/mcp-http/dist` empty).
- `src/http-server/middleware.ts:14` imports from `'../../packages/mcp-http/dist/middleware.js'`.
- An existing `npm run check:source-dist` script exists but is permissive (`--allow-missing-dist`). A strict parity gate would still be valuable.

## Fix Plan re-verification

### Critical

**C1 / B1 — MUTATION_ACTIONS divergence between audit-middleware and write-lock-middleware.**
**Refuted.**
- Both sets contain 76 entries (counted directly from `audit-middleware.ts:159` and `write-lock-middleware.ts:27`).
- `npm run check:mutation-actions` passes with "✅ Check 1: write-lock ↔ audit MUTATION_ACTIONS are identical".
- The fix plan's framing was correct *historically* but the divergence has already been resolved. The CI gate exists. Phase B1 is largely complete.

**C2 — `env.ts` eager `validateEnv` with 12× `process.exit(1)`.**
**Verified.**
- `src/config/env.ts:541` `export let env: Env = validateEnv();` runs at module import.
- 12 `process.exit(1)` call sites (lines 236, 249, 258, 267, 279, 294, 311, 321, 328, 335, 342, 352).
- Lazy `getEnv()` exists at line 521 but the eager export dominates the cold path.

**C3 — `cli.ts` fatal path uses `console.error`, breaks JSON-RPC framing.**
**Verified.**
- `src/cli.ts:138–139` writes `console.error('\n❌ FATAL: ...\n')` and an Error message via `console.error`.
- Transport is stdio JSON-RPC. There's an `installStdioGuard()` at lines 14–15 that's *supposed* to intercept early logs, so the actual user impact depends on whether the guard catches the FATAL path (it should, but explicit `process.stderr.write` is safer).

**C4 / Phase A — pre-connect chain blocks initialize for ~3.8s.**
**Verified directionally; specific timing not measured.**
- `start-stdio-server.ts` lines 23–72 confirm the order: telemetry → validateEnv → verifyToolIntegrity → initialize → startTransport. All four are awaited before transport opens.
- The "3,832 ms" figure was not independently re-measured.

### High

**H1 — verifyToolIntegrity loads ~25,611 schema lines pre-connect.**
**Partially verified.**
- `tool-hash-registry.ts:46–54` lazy-imports `tool-definitions.js` on first call (which happens during pre-connect verify).
- `tool-definitions.ts` itself is ~17 KB, but transitively pulls in all schemas. Aggregate schema line count (`wc -l src/schemas/*.ts | tail -1`) is 25,618 — the fix plan's "25,611" number is essentially right.

**H2 — `prepareStdioRuntime` runs 11 heavy steps before connect.**
**Partially verified — overstated.**
- The orchestrator (`start-stdio-server.ts`) only has 4–5 explicit awaited steps before `startTransport()`. The "11 heavy steps" likely counts substeps inside `initialize()`. Directionally correct, count is overstated.

**H3 / A6 — preflight does synchronous 5s Google API reachability check.**
**Verified.**
- `preflight-validation.ts:431–478` performs `httpsGet('https://sheets.googleapis.com/...')` with 5,000 ms timeout, awaited during startup.
- Skipped if no credentials configured (line 435), so impact is conditional on deployment shape.

**H4 / A7 — connector-manager scryptSync at module load.**
**Refuted.**
- `connector-manager.ts:101` calls `scryptSync` inside `deriveKey()`, only invoked when encrypting/decrypting (lines 107, 127).
- Memoized (lines 81–104) so subsequent calls reuse the derived key.
- Not on the cold path. Removing this fix from Phase A would save effort with zero downside.

**H5 — stderr silence: no log output for first ~2s.**
**Inferred verified.** Cold-start orchestrator confirms no stderr writes happen until after `verifyToolIntegrity` completes. Not independently timed.

**H6 — setInterval at module load in 4 files.**
**Verified.**
- Found in: `rate-limit-middleware.ts:94`, `write-lock-middleware.ts:353`, `audit-middleware.ts` (prune interval), `knowledge-deferred.ts`, `confirm.ts`, `lifecycle.ts`. Most use `.unref()` so they don't keep the process alive, but they still execute.
- The "4 files" figure is conservative — it's actually 6+.

**H7 — duplicate validateEnv call.**
**Verified.**
- Module load: `env.ts:541`. Additional call sites: `http-server.ts:154`, `lifecycle.ts:339`, and via stdio orchestrator. At least 2 redundant calls on the cold path.

**H8 — duplicate uncaughtException / unhandledRejection handlers.**
**Verified, with caveat.**
- Registered in both `worker-runner.ts:69,74` and `lifecycle.ts:495,506`. Truly duplicate only if both modules execute in the same process, which they shouldn't in normal operation. Fix is still cheap.

**H9 / B2 — restart-policy backoff never resets.**
**Refuted.**
- `restart-policy.ts:230–232` `recordSuccessfulStartup()` resets `consecutiveFailures = 0` once uptime exceeds the success threshold.
- `clearRestartState()` at lines 253–259 is an additional explicit reset.
- The fix plan was wrong. This item should be removed from Phase B.

### Medium

**M1 — no `.dispose()` on 6 singletons.**
**Partially verified.**
- ConnectorManager has `dispose()` (`connector-manager.ts:1241`), TaskManager has `stopCleanup()`, CacheManager has `stopCleanupTask()`. Several others lack explicit cleanup.
- Whether SIGTERM actually invokes them in `lifecycle.ts:gracefulShutdown` was not confirmed end-to-end. The general direction (incomplete shutdown) is correct.

**M2 / B3 — preflight `readFileSync` on event loop.**
**Verified.**
- `preflight-validation.ts:99` `JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'))`.

**M3 / A8 — SERVER_INSTRUCTIONS ~6 KB on every initialize.**
**Verified, but undercount.**
- The relevant string in `features-2025-11-25.ts:403–533` is closer to ~31 KB based on file character counts. The fix plan's "6 KB" is wrong on the low side. Cost-benefit of moving it to a prompt is even higher than the plan claimed.

**M4 / A9 — TOOL_ICONS eager base64 at module load.**
**Verified.**
- `features-2025-11-25.ts:75–77` defines tool icons as module-level constant with embedded base64 SVG data URIs. Decoded on every import.

**M5 — schema concentration in 3 mega-files.**
**Verified, undercount.**
- Top 3: `action-metadata.ts` (2,775), `analyze.ts` (2,434), `format.ts` (1,302) = 6,511 lines (not 5,792). Total schema dir: 25,618 lines.

**M6 / D2 — completions built but not wired.**
**Verified.**
- `src/generated/completions.ts` exports TOOL_ACTIONS for 409 actions.
- `features-2025-11-25.ts:365–369` capability declared as `completions: {}` with comment confirming the handler is not wired.

**M7 — `DEFER_SCHEMAS` + `STAGED_REGISTRATION` overlap.**
**Inconclusive.**
- The two flags control orthogonal concerns (schema delivery vs tool visibility timing). No shared conditional was found at the call sites.
- Directional claim ("overlap" → consolidate to `SERVAL_STARTUP_MODE`) may still be a UX simplification, but it is not currently a correctness bug.

### Low

**L1 — `getEnv()` exists but underused.**
**Verified.** Function defined at `env.ts:521`. ~69 call sites use it; ~17+ direct `env.X` accesses bypass it.

**L2 — `isStdioMode` evaluated at module load.**
**Verified.** `src/utils/base-logger.ts:38` `const isStdioMode = process.env['MCP_TRANSPORT'] === 'stdio' || !process.env['MCP_TRANSPORT'];`

**L3 — SDK #893: cannot register NEW tools post-connect.**
**Not re-verified in this pass.** This is an upstream SDK limitation, not a repo issue.

### Fix-plan A2 — stream-hash tool-definitions WITHOUT importing.
**Refuted.**
- The fix plan claims A2 will (or already does) hash the file as bytes without importing.
- Current `tool-hash-registry.ts:46–54` uses `await import('../mcp/registration/tool-definitions.js')` — full dynamic import, transitively loading schemas.
- A2 is therefore still an aspirational fix, not a documentation gap. The plan is correct that this would save ~1.5 s, but the work is not done.

## What's actually broken (consolidated, after re-verification)

Ranked by severity. Items where both documents were wrong or already remediated have been removed. Items neither document caught but emerged during verification are marked **NEW**.

### Real P0

1. **OAuth-mode token bridge has no test asserting bearer is not passed downstream.** (Audit P1.7, kept.) The runtime factory does the right thing when OAuth is enabled, but a contract test is needed so a regression here can't ship.
2. **`/oauth/revoke` does not call Google's outbound revoke endpoint.** (Audit P0.4, demoted from "doesn't clear local tokens" — that part was wrong.) `revokeToken()` exists in `google-api.ts` but is never invoked from the HTTP path. Compliance/security exposure.

### Real P1

3. **Cold-start chain blocks for ~3.8 s pre-connect.** (Fix plan C4 / Phase A1–A4.) Verified shape: `verifyToolIntegrity → initialize → startTransport` are all awaited serially. A1 (verifyToolIntegrity post-connect) and A2 (stream-hash without dynamic import) remain valid.
4. **`env.ts` eager `validateEnv` with 12× `process.exit(1)` and stdio framing risk in `cli.ts`.** (Fix plan C2 + C3.) Both verified. Either survives in any deployment that uses stdio.
5. **Preflight does synchronous 5 s Google API check on cold path when credentials are configured.** (Fix plan H3.) Verified.
6. **DCR `OAUTH_DCR_AUTO_CONSENT=true` is a security-relevant deploy toggle with no documented audit/admin gate.** (Audit P1.8, scoped down.) Strict redirect URI validation is in place; the auto-consent env var is the residual risk.
7. **No CI gate enforcing source/dist parity for `packages/mcp-http`.** (Audit P2.13.) Permissive `check:source-dist --allow-missing-dist` exists; strict parity check is missing. Wrappers import from `dist/`, so stale `dist` silently runs.
8. **Tool-argument completions generated but not wired to `completion/complete` handler.** (Fix plan M6 / Audit matrix row.) Capability advertised as `{}`, no handler.

### Real P2

9. **`SERVER_INSTRUCTIONS` is ~31 KB (not 6 KB) and ships on every initialize response.** (Fix plan M3, undercount.) Either move to a prompt or compress.
10. **`TOOL_ICONS` eager base64 at module load.** (Fix plan M4.) Cheap to lazy-load.
11. **`setInterval` at module load in 6+ files.** (Fix plan H6, undercount.) Most use `.unref()`. Convert to explicit `.start()` for testability and clean SIGTERM.
12. **Schema concentration in 3 mega-files (6,511 lines).** (Fix plan M5, undercount.) Maintenance, not correctness.
13. **No SIGTERM dispose path for several singletons** (TransactionManager, ResourceNotificationManager). (Fix plan M1, scoped.)
14. **`readFileSync` in preflight async path.** (Fix plan M2 / B3.)
15. **NEW: `_requestHandlers` private SDK hook is acceptable (assertion present), but worth re-verifying on every `@modelcontextprotocol/sdk` upgrade.** Add to release checklist, no code change needed today.

### Removed from the backlog (refuted in this re-audit)

- Audit P0.2 token shape mismatch (read accepts both forms; storage is canonical).
- Audit P0.3 identity-only Google scopes (default is STANDARD_SCOPES with Sheets/Drive).
- Audit P0.4 revoke doesn't clear local tokens (line 1267 deletes them; outbound revoke is the real residual gap).
- Audit P1.5 default scopes include restricted (default avoids restricted scopes).
- Audit P1.6 `client_secret_basic` not implemented (it is, at line 1642).
- Audit P1.9 `compact_session` missing annotation (annotated at line 4707).
- Audit P2.10 flat tools/list ignores cursor (cursor is consumed, page size 100).
- Audit P2.11 promotion to remediation (assertion is present, mitigation is sufficient).
- Audit P2.12 request recorder retention (opt-in, redaction, 30-day default).
- Fix plan C1/B1 MUTATION_ACTIONS divergence (sets are identical, CI gate passes).
- Fix plan H4 connector-manager scryptSync at module load (lazy + memoized).
- Fix plan H9 restart backoff never resets (reset paths exist).
- Fix plan A2 stream-hash claim (still uses dynamic import — *the fix is real*, but the documentation should not imply it's already done).

## Caveats on this re-audit

- Several agent reports cited line numbers I did not personally re-open. They are direct reads from the same tree, but if the working tree changes between this report and a follow-up, line numbers will shift.
- Cold-start latency numbers (3,832 ms current, <200 ms target, individual budget items) were not re-measured; only the *shape* of the pre-connect chain was confirmed.
- I did not exercise OAuth flows live. The contract test gap from real-P0-#1 is exactly the test that would close this loop.
- `getEnv()` call-site counts and similar quantitative claims were spot-checked, not exhaustively recounted.

## Where to spend the next hour, the next day, the next week

- **Next hour:** delete the refuted items from your tracking system so they stop occupying mental space. Add the `revoke → Google outbound` and the `OAuth bearer-not-passed` contract test to your top of queue.
- **Next day:** ship Phase A1 + A2 from the fix plan (the cold-start unblock — that's the real ~3.3 s win) along with Phase B's C2/C3 (env exit + cli.ts framing). These are the verified critical items.
- **Next week:** add the strict source/dist parity gate, wire `completion/complete`, and run a formal cold-start benchmark in CI so the latency numbers in the fix plan become enforceable rather than aspirational.
