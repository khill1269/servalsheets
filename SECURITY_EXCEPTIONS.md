# Security Exceptions

> Tracked vulnerabilities that cannot be fixed immediately due to upstream dependencies.
> Each exception has a review date — re-evaluate on or before that date.

## Active Exceptions

### SE-001: node-saml transitive vulnerability (node-forge)

| Field | Value |
|-------|-------|
| **Advisory** | GHSA-65ch-62r8-g69g |
| **Severity** | High |
| **Dependency Chain** | `node-saml` → `xml-encryption` → `node-forge` |
| **Root Cause** | `node-forge` has known high/critical vulnerabilities with no upstream fix |
| **Mitigation** | `xmldom` patched via npm overrides in `package.json` |
| **CI Impact** | Allowlisted via `--allow-ghsas GHSA-65ch-62r8-g69g` in `.github/workflows/ci.yml` and `security.yml` |
| **Resolution Path** | Upgrade to `node-saml` v4 when stable release ships |
| **Created** | 2026-03-26 |
| **Review By** | 2026-06-26 |
| **Owner** | @khill1269 |

### SE-002: node-tar vulnerabilities via duckdb → node-gyp

| Field | Value |
|-------|-------|
| **Advisories** | GHSA-34x7-hfp2-rc4v, GHSA-8qq5-rm4j-mr97, GHSA-83g3-92jg-28cx, GHSA-qffp-2rhf-9h96, GHSA-9ppj-qmqm-q256, GHSA-r6q2-hw4h-h46w, GHSA-vpq2-c234-7xj6 |
| **Severity** | High |
| **Dependency Chain** | `duckdb` → `node-gyp` → `tar`, `make-fetch-happen`, `@tootallnate/once` |
| **Root Cause** | `duckdb` native addon requires `node-gyp` which depends on old `tar ≤7.5.10`; no upstream fix available |
| **Mitigation** | Build-time only; not present in runtime bundle |
| **CI Impact** | Allowlisted via `--allow-ghsas` in `.github/workflows/ci.yml` and `security.yml` |
| **Resolution Path** | Wait for `duckdb` to upgrade its `node-gyp` dependency |
| **Created** | 2026-04-20 |
| **Review By** | 2026-07-20 |
| **Owner** | @khill1269 |

### SE-003: esbuild dev-server vulnerability (dev-only)

| Field | Value |
|-------|-------|
| **Advisory** | GHSA-67mh-4wv8-2f99 |
| **Severity** | Moderate |
| **Package** | `esbuild` |
| **Root Cause** | esbuild dev server can be exploited by malicious websites to read responses; no upstream fix without major version bump |
| **Mitigation** | Dev dependency only — not present in production bundle; only exposed during local development |
| **Resolution Path** | Wait for esbuild to release a patched version |
| **Created** | 2026-04-21 |
| **Review By** | 2026-07-21 |
| **Owner** | @khill1269 |

### SE-004: smol-toml DoS via commented TOML lines (dev-only)

| Field | Value |
|-------|-------|
| **Advisory** | GHSA-v3rj-xjv7-4jmq |
| **Severity** | Moderate |
| **Package** | `smol-toml` (via `markdownlint-cli2`) |
| **Root Cause** | DoS via TOML documents with thousands of consecutive commented lines; `markdownlint-cli2@0.22.0` ships `smol-toml` without fix |
| **Mitigation** | Dev linting tool only — not in production; input is trusted developer-authored config files |
| **Resolution Path** | Wait for `markdownlint-cli2` to upgrade `smol-toml` |
| **Created** | 2026-04-21 |
| **Review By** | 2026-07-21 |
| **Owner** | @khill1269 |

### SE-005: Vite path traversal in optimized deps (dev-only)

| Field | Value |
|-------|-------|
| **Advisory** | GHSA-4w7w-66w2-5vf9 |
| **Severity** | Moderate |
| **Package** | `vite` (also affects `vitepress`) |
| **Root Cause** | Path traversal in optimized deps `.map` file handling in Vite dev server; no fix without breaking upgrade |
| **Mitigation** | Dev dependency only — Vite dev server not exposed in production; used only for docs build and UI development |
| **Resolution Path** | Wait for Vite to release a patched version |
| **Created** | 2026-04-21 |
| **Review By** | 2026-07-21 |
| **Owner** | @khill1269 |

### SE-006: OpenTelemetry Prometheus exporter crash via malformed HTTP request

| Field | Value |
|-------|-------|
| **Advisory** | GHSA-q7rr-3cgh-j5r3 |
| **Severity** | High |
| **Packages** | `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-prometheus`, `@opentelemetry/sdk-node` |
| **Root Cause** | Malformed HTTP request to the Prometheus metrics endpoint can crash the exporter process. Fix requires bumping `@opentelemetry/auto-instrumentations-node` 0.76 → 0.77 (major version, breaking API changes throughout the OTel stack). |
| **Mitigation** | Prometheus exporter only listens on the configured metrics port (default 9091); not exposed to untrusted networks in production. Requires network-level access to exploit. |
| **CI Impact** | Allowlisted via `node scripts/audit-with-exceptions.mjs` (auto-detected from SECURITY_EXCEPTIONS.md). |
| **Resolution Path** | Schedule a separate OTel upgrade sprint to bump the full instrumentation stack and validate the breaking API changes don't regress traces/metrics. |
| **Created** | 2026-06-24 |
| **Review By** | 2026-09-24 |
| **Owner** | @khill1269 |

### SE-007: Vite server.fs.deny bypass on Windows alternate paths

| Field | Value |
|-------|-------|
| **Advisory** | GHSA-fx2h-pf6j-xcff |
| **Severity** | High |
| **Package** | `vite` (via `vitepress`) |
| **Root Cause** | On Windows, `server.fs.deny` can be bypassed using alternate file path representations. Vite dev server only. |
| **Mitigation** | Dev dependency only — Vite dev server is not exposed in production. Project is developed on macOS/Linux; Windows-only attack vector. Vitepress docs build does not run a long-lived server. |
| **CI Impact** | Allowlisted via `node scripts/audit-with-exceptions.mjs` (auto-detected from SECURITY_EXCEPTIONS.md). |
| **Resolution Path** | Upgrade Vite when a patched version ships that also satisfies `vitepress` peer constraints. |
| **Created** | 2026-06-24 |
| **Review By** | 2026-09-24 |
| **Owner** | @khill1269 |

## Resolved Exceptions

_None yet._
