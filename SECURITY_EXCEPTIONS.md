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

## Resolved Exceptions

_None yet._
