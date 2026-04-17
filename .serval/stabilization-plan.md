# ServalSheets Stabilization Plan

> Created: 2026-04-11. Source: MCP compliance audit + full test:run ground truth.
> This document captures the verified state of the codebase and the phased plan to reach production-grade release.

## Ground Truth (verified 2026-04-11)

| Check | Result |
|---|---|
| `npm run typecheck` | ❌ 68 errors / 14 files |
| `npm run test:fast` (unit+contracts) | ❌ 2 failed / 1701 passed / 19 skipped |
| `npm run test:run` (full) | ❌ 60 files / 241 tests fail, 10926 pass, 4 snapshots fail, 1 worker OOM, 464s |
| `npm run audit:gate` | ❌ 3/12 fail (A1 typecheck, A9 contracts, A11 MCP) |
| `npm run format:check` | ❌ 82 unformatted files |
| `npm run lint` | ❌ broken: eslint-plugin-boundaries not installed |
| `npm run audit:coverage` | ❌ broken: scripts/action-coverage.ts missing |
| `npm audit` | ❌ 25 vulns (2 critical, 11 high, 10 mod, 2 low) |
| `check:drift, check:*, validate:*, docs:*` | ✅ all green |

**Note:** `.serval/state.md` claims "2810/2810 green" — this is stale. Actual: 10926 pass, 241 fail.

## MCP Compliance Score (same session)

**Overall: A+ (175/180)** — protocol compliance is excellent. The failures are in build/test infrastructure, not MCP protocol implementation.

## Phased Plan

### Phase 0 — Triage the current tree (before any upgrades)

**Goal:** Get typecheck green, lint running, format clean.

1. Fix `src/utils/schema-inspection.ts` — Zod v4 removed `z.ZodEffects` and `z.ZodNativeEnum` class names. Replace with `schema._def?.typeName === 'ZodEffects'` guards or use `z.ZodType` with runtime shape checks. Single file, ~6 edits.
2. Bracket-access env in 14 files (TS4111 fix — mechanical): `env.FOO` → `env['FOO']` OR add explicit getter functions.
3. Cast unknowns where needed (TS2322/TS18046).
4. `npm install --save-dev eslint-plugin-boundaries` (missing from node_modules; lint is broken).
5. `npm run format:check` → `prettier --write` on 82 files.
6. Verify: `npm run typecheck && npm run lint && npm run test:fast`.

**Exit criteria:** A1 green, lint runs, format clean.

### Phase 1 — Fix the 241 failing tests (stabilization)

**Goal:** Full test suite green. Don't upgrade anything yet.

1. **Batching destroy unhandled rejection** — change `batching-system.ts:369` to `item.reject(...); /* swallowed by test destroy */` or attach `.catch(()=>{})` to pending promises in tests. Impacts 2+ test files.
2. **Worker OOM** — add `test.poolOptions.threads.minThreads=1, maxThreads=4, isolate=true` to vitest config, or split into shards. Also raise `NODE_OPTIONS=--max-old-space-size=8192` for CI.
3. **Contract F1 (STDIO Output Purity)** — inspect `src/server/build-server-stdio-tool-runtime.ts` try/catch; ensure any log on registration failure goes to stderr not stdout.
4. **Contract F2 (Prompt Registration = 0)** — find where `registerPrompts()` is called (or not) in `src/server/` and wire it up.
5. **Contract F3 (CORS_ORIGINS undefined)** — in `packages/mcp-http/src/runtime-config.ts:71`, default `CORS_ORIGINS` to `''` if undefined. Also audit tests to ensure envConfig fixtures are complete.
6. **Snapshot failures (4)** — regenerate: `npx vitest run -u` on the 4 affected tests only, review diffs.
7. **Regenerate `.serval/state.md`** via `.serval/generate-state.mjs`.

**Exit criteria:** `npm run test:run` passes, `audit:gate` 12/12 green, `state.md` matches reality.

### Phase 2 — Safe patch + minor bumps (no code changes)

Single commit. Run tests after each.

```bash
npm i prettier@latest \
  @typescript-eslint/eslint-plugin@latest @typescript-eslint/parser@latest \
  @types/bcrypt@latest @types/pdfkit@latest \
  sharp@latest
npm i @opentelemetry/api-logs@latest @opentelemetry/exporter-prometheus@latest \
  @opentelemetry/exporter-trace-otlp-http@latest \
  @opentelemetry/sdk-logs@latest @opentelemetry/sdk-node@latest
npm run verify:safe
```

### Phase 3 — Fixable CVEs via npm audit fix

```bash
npm audit fix   # captures hono, @hono/node-server, vite, esbuild patches
npm run verify:safe
```

### Phase 4 — Google stack alignment (gaxios + google-auth + googleapis)

All three move together to avoid fetch-layer drift:

```bash
npm i gaxios@^7 google-auth-library@^10 googleapis@^171
npm run verify:safe
```

Test coverage focus: OAuth refresh flow, token expiry, BigQuery jobs, Sheets batchGet.

### Phase 5 — Test infra upgrade (vitest 2→4, @types/node 20→22, ts 5.9→6?)

Sequence matters:
1. `vitest@^3` first (bridge), then `@^4`. Run full suite between.
2. `@types/node@^22` to match actual runtime.
3. Defer TypeScript 6.0 — wait 1–2 minor releases unless hitting v5 blocker.
4. `eslint@^10` + refresh flat config, re-check plugin compatibility.

### Phase 6 — Targeted ecosystem bumps

Split by blast radius:
- **Low:** lru-cache, p-queue, got, pino/pino-pretty, express-rate-limit, joi, uuid@11
- **Medium:** helmet@8, bcrypt@6, redis@5 (requires `.connect()` calls), dotenv@17
- Each group → `verify:safe` → commit.

### Phase 7 — High-risk majors (one PR each, dedicated testing)

- express@5 → touches `src/http-server/` path handling, error middleware
- workerpool@10 / tinypool@2 → rewrite `src/workers/` task dispatch
- canvas@3 → verify system deps (Cairo, Pango) in Dockerfile
- @anthropic-ai/sdk@0.88 → audit all `sampling.ts` + `plan-compiler.ts` callsites
- pyodide@0.29 → retest python-worker sandbox
- duckdb → migrate to @duckdb/node-api

### Phase 8 — Unfixable CVE remediation

- **xlsx → exceljs:** Rewrite `src/services/composite-operations.ts` xlsx import/export paths
- **node-saml stack:** Replace with passport-saml 5+ or pin behind feature flag (disable SAML by default)
- **xmldom:** Falls out once SAML stack is replaced

### Phase 9 — Refresh infrastructure

- Rebuild Docker image on Node 22 LTS
- Update `.github/workflows/*.yml` to use pinned SHAs + OIDC
- Regenerate `server.json`, `manifest.json`, `src/security/tool-hashes.baseline.json`

## Package Tiers

### Tier A — Safe patch/minor bumps

| Package | Current → Latest | Notes |
|---|---|---|
| prettier | 3.8.1 → 3.8.2 | patch |
| @typescript-eslint/* | 8.58.0 → 8.58.1 | patch |
| @opentelemetry/* | 0.200 → 0.214 | minor (prerelease line) |
| googleapis | 140 → 171 | additive Sheets/Drive API surface |
| gaxios | 6.7 → 7.1 | major but node-fetch removal only |
| google-auth-library | 9.15 → 10.6 | major: requires gaxios 7 |
| sharp | 0.33.5 → 0.34.5 | libvips bump, needs rebuild |
| pdfkit | 0.14 → 0.18 | font file format change |
| @types/bcrypt, @types/pdfkit | minor bumps | types only |
| dotenv | 16.6 → 17.4 | quiet breaking on DOTENV_CONFIG_* |

### Tier B — Medium-risk majors

| Package | Current → Latest | Key breaking changes |
|---|---|---|
| vitest + @vitest/* | 2.1.9 → 4.1.4 | v3: browser mode changes, v4: drops deps.inline |
| typescript | 5.9.3 → 6.0.2 | Isolated declarations, stricter checks |
| eslint | 9.39 → 10.2 | Drops Node 18, removes eslintrc fully |
| @types/node | 20 → 22 (NOT 25) | Stick to LTS types |
| pino + pino-pretty | 9→10, 11→13 | Transport worker API change |
| lru-cache | 10.4 → 11.3 | Drops .reset() alias, needs .clear() |
| p-queue | 7.4 → 9.1 | ESM-only; abortSignal arg moved |
| got | 14.6 → 15.0 | Drops Node 18 |
| uuid | 10 → 11 (NOT 13) | v11 drops deprecated entries |
| redis | 4.7 → 5.11 | .connect() required |
| helmet | 7 → 8 | crossOriginEmbedderPolicy default change |
| bcrypt | 5 → 6 | Node-gyp rebuild |
| joi | 17 → 18 | Node 20+ min |
| express-rate-limit | 7.5 → 8.3 | Store API change |

### Tier C — High-risk majors

| Package | Current → Latest | Why risky |
|---|---|---|
| express | 4.22 → 5.2 | Routing rewrite, error handling semantics |
| workerpool | 6.5 → 10.0 | 4-major jump; API rewrite |
| tinypool | 0.8 → 2.1 | ESM-only, Piscina-style API |
| canvas | 2 → 3 | Drops Cairo bundling |
| @anthropic-ai/sdk | 0.31 → 0.88 | Pre-1.0, nearly every minor breaks |
| pyodide | 0.27 → 0.29 | Python 3.12→3.13 |
| duckdb | 1.x → @duckdb/node-api | Ecosystem migration |

### Tier D — Unfixable CVEs

| CVE | Severity | Chain | Fix |
|---|---|---|---|
| node-saml signature bypass | CRITICAL | node-saml | Replace SAML stack |
| xmldom XML injection | CRITICAL | node-saml → xmldom | Replace SAML stack |
| xlsx prototype pollution + ReDoS | HIGH | direct dep | Replace with exceljs |
| node-forge prototype pollution | HIGH | google-auth-library transitive | Upgrade to v10 |
| tar/cacache/node-gyp | HIGH | build-time only | Upgrade @mapbox/node-pre-gyp consumers |
| xml2js, xml-encryption, xml-crypto | HIGH | SAML stack | Tied to node-saml fix |
| duckdb → node-gyp | HIGH | build-time | Upgrade duckdb |
| @tootallnate/once | LOW | deprecated | Will disappear with http-proxy-agent upgrade |

### Tier E — Fixable CVEs (npm audit fix)

- @hono/node-server serveStatic path traversal
- hono cookie write-path
- vitest + @vitest/{mocker,coverage-v8,ui} (ties to Vitest upgrade)
- vite + vite-node path traversal
- esbuild dev server
- xml-crypto (depends on xmldom replacement)

## Advanced Methods Recommendations

**Priority order for adoption:**

1. **Renovate Bot** — autonomous dep hygiene, grouped PRs weekly
2. **knip** — kill dead code, unused exports/files/dependencies
3. **noUncheckedIndexedAccess** — would have prevented 23 of today's 68 TS errors
4. **MCP Inspector CI workflow** — catches protocol regressions before commit
5. **release-please** — automated release PR from commit history

**Full list by category:**

- **Dependency hygiene:** Renovate, npm audit signatures, socket.dev, lockfile-lint
- **Supply-chain/SBOM:** @cyclonedx/cyclonedx-npm, OpenSSF Scorecard, Sigstore cosign, Trivy
- **Test velocity:** knip, Vitest sharding (4 shards), vitest-mock-extended, Stryker subset
- **Type safety:** tsgo, arethetypeswrong, tsd, expect-type, typescript-eslint type-aware rules
- **API observability:** GCP WIF, @google-cloud/monitoring, contract tests (RUN_LIVE=1)
- **MCP-specific:** MCP Inspector CI, tools/list JSON snapshot, session replay fixtures
- **Code quality ratchets:** danger.js, husky+lint-staged, commitlint, size-limit, oxlint
- **Documentation:** typedoc, lychee link checking, doctest
- **Release/deploy:** release-please, changesets, canary deploys, blue/green with SLO gate
- **Meta-automation:** Extended Claude Code hooks, /new-action skill scaffold

## Execution Recommendation

**Do not start with package upgrades.** Execute in this order:

1. **Phase 0 + 1** first — fix tree + stabilize tests. Without this, any upgrade mixes unrelated failures.
2. **Phase 2 + 3** — safe bumps + audit fix, one commit each.
3. **Phase 4** — Google stack as a single PR (three packages must move together).
4. **Pause. Commit. Evaluate** whether to proceed to Phase 5+ or hold.
5. **Phase 5–8** as individual PRs, each with its own testing pass.

High-risk majors (Express 5, workerpool 10, Anthropic SDK 0.88, xlsx→exceljs, SAML replacement) should be 5 separate PRs over several sessions.
