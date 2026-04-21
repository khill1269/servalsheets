# Fix Plan vs Audit — Gap Report

**Inputs**
- Audit: *Source-Truth Compliance and Architecture Audit*, 2026-04-21 (P0/P1/P2 backlog).
- Fix plan: *ServalSheets — Advanced Fix Plan v2* (4 critical / 9 high / 7 medium / 3 low across phases A–E).
- Mode: report only, no source changes.

## Bottom line

The two documents are almost entirely **orthogonal**. The fix plan focuses on **cold-start latency, stdio JSON-RPC framing, module-load side-effects, and process lifecycle hygiene**. The audit focuses on **MCP authorization correctness, Google OAuth scope/consent posture, and remote-HTTP token bridging**. Neither one is a substitute for the other; both should ship.

Of the 13 audit items in the P0/P1/P2 backlog, **0 are addressed end-to-end by the fix plan**. One audit item (P1.6 client_secret_basic) and one fix-plan item (M6 completions wiring) have weak topical proximity to each other, but no remediation overlap. The fix plan does add 23 issues that the audit never mentions — most notably a critical data-integrity bug (MUTATION_ACTIONS divergence) and a critical stdio framing bug (cli.ts console.error breaking JSON-RPC). Those would be missed if you only worked the audit backlog.

If you ship one of these and not the other, you ship a known-broken product in a different way each time. Recommended order: merge fix-plan Phase B (correctness — MUTATION_ACTIONS, restart backoff, framing, dedup), then start the audit P0 OAuth/token-bridge work in parallel with fix-plan Phase A (cold-start).

## Audit backlog → fix-plan coverage matrix

| Audit item | Severity | Fix-plan item | Coverage |
| --- | --- | --- | --- |
| P0.1 — `/mcp` Streamable HTTP passes client bearer to Google runtime as `googleToken` | Critical | none | **Not covered** |
| P0.2 — Google token storage/read property mismatch (`googleAccessToken` vs `accessToken`) | Critical | none | **Not covered** |
| P0.3 — Server OAuth authorize requests only `openid profile email`, not Sheets/Drive/etc. | Critical | none | **Not covered** |
| P0.4 — `/oauth/revoke` does not delete server-side `google_tokens:${userId}` | Critical | none | **Not covered** |
| P1.5 — Default scope mode resolves to `full`; `STANDARD_SCOPES` includes restricted `drive.readonly` | High | none | **Not covered** |
| P1.6 — `client_secret_basic` advertised but token endpoint only reads body params | High | none | **Not covered** |
| P1.7 — Add contract test asserting OAuth-mode runtime gets Google token from store, not bearer | High | none | **Not covered** |
| P1.8 — DCR auto-grants consent and accepts any redirect URI | High | none | **Not covered** |
| P1.9 — Missing `ACTION_ANNOTATIONS` entry for `sheets_session.compact_session` | High | none | **Not covered** |
| P2.10 — Flat `tools/list` ignores cursor; can return hundreds of entries | Medium | none | **Not covered** |
| P2.11 — Flat tool calls wrap SDK private `_requestHandlers` | Medium | L3 (different issue) | **Not covered** — L3 is about post-connect tool registration (SDK #893), not about wrapping `_requestHandlers` |
| P2.12 — Request recorder retention/redaction for production | Medium | none | **Not covered** |
| P2.13 — CI gate for `packages/mcp-http/dist` source/dist consistency | Medium | none | **Not covered** |

**Summary: 0 of 13 audit items materially addressed by the fix plan.**

The fix-plan tooling that *would* help once the audit work begins:
- Fix-plan B1 introduces `npm run check:mutation-actions` as a CI gate. The same pattern is exactly what audit P1.9 needs (annotation parity gate) and what P2.13 needs (package dist parity gate). Worth generalizing the helper.
- Fix-plan A1's `runtimeReady` gate is the right place to also enforce that OAuth-mode `tools/call` requires a server-side Google token (audit P0.1).

## Fix-plan items → audit coverage (reverse direction)

| Fix-plan item | Severity | Audit reference | Coverage |
| --- | --- | --- | --- |
| C1 / B1 — MUTATION_ACTIONS divergence between audit-middleware and write-lock-middleware | Critical | none (CLAUDE.md mentions the gate exists; audit doesn't flag the divergence as a finding) | **Not in audit.** Verified in source: `src/middleware/audit-middleware.ts:159` and `src/middleware/write-lock-middleware.ts:27` both independently declare the set; no source-level constraint forces parity |
| C2 — `env.ts` eager `validateEnv` with 12× `process.exit(1)` at module load | Critical | none | **Not in audit** |
| C3 — `cli.ts` fatal path uses `console.error`, breaks stdio JSON-RPC framing | Critical | none | **Not in audit** — this is the kind of issue that silently breaks stdio clients |
| C4 / A1–A4 — Pre-connect chain blocks initialize ~3.8 s | Critical | none | **Not in audit.** Audit doesn't measure latency at all |
| H1 — `verifyToolIntegrity` loads 25,611 schema lines pre-connect | High | none | **Not in audit** |
| H2 — `prepareStdioRuntime` runs 11 heavy steps before connect | High | none | **Not in audit** |
| H3 / A6 — Preflight does synchronous 5 s Google API reachability check | High | none | **Not in audit** |
| H4 / A7 — `connector-manager` `scryptSync` blocks 100–200 ms at module load | High | none | **Not in audit** |
| H5 / D1 — Stderr silence first ~2 s | High | none | **Not in audit** |
| H6 / C1 (Phase C) — `setInterval` at module load in 4 files (timer leaks) | High | none | **Not in audit** |
| H7 — Duplicate `validateEnv` call | High | none | **Not in audit** |
| H8 — Duplicate `uncaughtException` / `unhandledRejection` handlers | High | none | **Not in audit** |
| H9 / B2 — `restart-policy.ts` backoff never resets | High | none | **Not in audit** |
| M1 / C2 / C3 (Phase C) — No `.dispose()` on 6 singletons; SIGTERM unclean | Medium | none | **Not in audit** |
| M2 / B3 — `readFileSync` on event loop | Medium | none | **Not in audit** |
| M3 / A8 — `SERVER_INSTRUCTIONS` ~6 KB on every initialize | Medium | none | **Not in audit** |
| M4 / A9 — `TOOL_ICONS` eager base64 at module load | Medium | none | **Not in audit** |
| M5 / E1–E3 — Schema concentration (3 mega-files, 5,792 lines) | Medium | none | **Not in audit** |
| M6 / D2 — Tool-argument completions built but not wired to `completion/complete` | Medium | **Audit Compliance Matrix row** ("Resources/prompts/completions: Partial") | **Same observation, both report-only.** Fix plan promotes it to a remediation; audit only flags it in the matrix and never adds it to its P0/P1/P2 backlog |
| M7 / D3 — `DEFER_SCHEMAS` + `STAGED_REGISTRATION` overlap → `SERVAL_STARTUP_MODE` | Medium | none | **Not in audit** |
| L1 / A4 — `getEnv()` lazy accessor exists but underused | Low | none | **Not in audit** |
| L2 — `isStdioMode` evaluated at module load | Low | none | **Not in audit** |
| L3 — SDK #893: cannot register NEW tools post-connect | Low | none directly; audit R11 touches private `_requestHandlers` wrapping (different SDK fragility) | **Not in audit** |

**Summary: 22 of 23 fix-plan items have no equivalent in the audit. The one overlap (M6 / completions) is treated only descriptively in the audit, with no remediation backlog entry.**

## Notable conflicts and risks of running both in parallel

1. **C4 / Phase A vs P0.1** (token-bridge fix). Phase A1 moves `verifyToolIntegrity` and other init steps *after* `server.connect`. The audit's P0.1 fix needs a runtime-construction step (token bridge) that is currently inside the same pre-connect path. Make sure the OAuth-mode HTTP runtime factory is *not* deferred behind the same `runtimeReady` gate, or every first request will race. Recommend adding a unit test that asserts `oauth.getGoogleToken(req)` is consulted before `googleApiClient` is instantiated for any `tools/call`.
2. **B1 vs P1.9.** Both are "schema/middleware list parity" problems. They share the same pattern (a generated set vs a hand-maintained set with no CI gate). Generalize the helper script — `scripts/check-mutation-actions.mjs` and a new `scripts/check-action-annotations.mjs` should share a common parity checker. Otherwise you write the same script twice and drift will reappear.
3. **A6 (post-connect non-blocking preflight) vs audit Compliance Matrix row "Origin validation".** Both touch HTTP startup. A6 changes when preflight runs but doesn't change *what* it checks; the audit's HTTP origin-validation finding is independently passing. No conflict, just a coordination note: don't move CORS/Origin validation into the deferred chain along with Google preflight.
4. **Phase E (schema refactor) vs P1.9.** Phase E splits `action-metadata.ts` into 25 files. The compact_session annotation gap from P1.9 must be fixed *first* (or as part of Phase E), or the split will codify the gap in a new file boundary and make it harder to detect.

## Spot-check of fix-plan evidence against current source

I verified a sample of the fix plan's cited file paths to confirm the document is grounded in the actual repo, not stale:

- `packages/mcp-stdio/src/start-stdio-server.ts` — exists.
- `src/middleware/audit-middleware.ts:159` — `MUTATION_ACTIONS` set declared. ✓
- `src/middleware/write-lock-middleware.ts:27` — second `MUTATION_ACTIONS` set declared. ✓ (C1/B1 confirmed.)
- `src/security/tool-hash-registry.ts` (referenced by A2) — exists.

I did **not** independently re-time cold-start; the fix plan's "~3832 ms current / <200 ms target" numbers are not verified by this report.

## Spot-check of one audit claim that the fix plan does not address

Audit P0.2 cites lines `565–574` and `1090–1099` of `src/auth/oauth-provider.ts`. In the current working tree:
- `getGoogleToken` is at `src/auth/oauth-provider.ts:605`, and at lines 637–638 it currently reads:
  ```ts
  const { accessToken, googleAccessToken } = googleTokenData as GoogleTokenData;
  return accessToken ?? googleAccessToken ?? null;
  ```
  i.e. it accepts **either** key. The "key mismatch" formulation in the audit may be stale or may have been partially patched in the dirty worktree. The substantive concern — that there's no canonical token shape and no test asserting the bridge works — is still valid (and is exactly what audit P1.7 calls for). The fix plan does not address either form.

## Recommended merged backlog (audit + fix plan, ordered)

This is what I'd ship if I controlled the queue. Fix plan PR ordering preserved where possible.

1. **Fix-plan PR 1 (Phase B)** — correctness + framing. MUTATION_ACTIONS unification, restart backoff reset, dedup, `cli.ts` JSON-RPC framing, `readFileSync → readFile`, dedup `validateEnv`. Highest confidence, ships data-integrity and stdio fixes immediately.
2. **Audit P0 OAuth bundle** — token bridge + token-shape contract test + Google scope request fix + revoke cleanup. Treat as a single PR; they share the same OAuth provider file and need the same integration test.
3. **Fix-plan PR 2 (Phase A1+A2)** — verifyToolIntegrity moved post-connect, stream-hash tool-definitions. Biggest cold-start win, low risk, benchmark in CI.
4. **Audit P1 OAuth bundle** — least-privilege scopes, `client_secret_basic` (implement or remove), DCR consent/redirect restrictions.
5. **Fix-plan PR 3 (Phase A3+A4+A5)** — runtime deferral, env lazy, `process.exit → throw`. Behind `SERVAL_STARTUP_MODE=fast` flag.
6. **Audit P1.9 + fix-plan E1** — `compact_session` annotation entry; ship as part of the action-metadata split so the gate covers all 25 files at once.
7. **Fix-plan PR 4 (Phase A6–A9)** — remaining cold-start cleanups.
8. **Fix-plan PR 5 (Phase C)** — SIGTERM/dispose lifecycle.
9. **Audit P2 batch** — flat `tools/list` pagination, replace SDK private wrapping, request-recorder retention, package dist CI gate.
10. **Fix-plan PR 6 (Phase D)** — observability, completions wiring (resolves audit M6 overlap as well).
11. **Fix-plan PR 7 (Phase E)** — schema refactor, gated.

## Items neither document covers but should be on the radar

- No source-proven privacy policy URL or in-product disclosure path for Google OAuth verification (audit calls this out as "Unknown"; fix plan doesn't address it). Required for Google sensitive/restricted scope verification if you ever request `drive.readonly` or Sheets scopes from a public OAuth client.
- No mention in either document of credential rotation / KMS for the AES-256-GCM token store referenced at `src/services/token-store.ts:47-137`. The audit calls the store "Pass" but doesn't audit key lifecycle.
- Neither document covers what happens to in-flight `tools/call` work when `runtimeReady` flips false during a degraded post-connect init failure (fix plan A1 introduces the gate but doesn't define cancellation semantics). Worth speccing before A1 merges.
