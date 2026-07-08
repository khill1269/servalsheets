# Security Exceptions

> Tracked vulnerabilities that cannot be fixed immediately due to upstream dependencies.
> Each exception has a review date — re-evaluate on or before that date.

## Active Exceptions

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

## Resolved Exceptions

### SE-001: node-saml transitive vulnerability (node-forge) — RESOLVED 2026-07-08

| Field | Value |
|-------|-------|
| **Advisory** | GHSA-65ch-62r8-g69g |
| **Resolution** | Upgrade to `@node-saml/node-saml@^5.1.0` which uses `xml-encryption@3.1.0` (dropped `node-forge` dependency) |
| **Verified** | `npm ls node-forge` returns empty tree |
| **Resolved By** | @khill1269 |
