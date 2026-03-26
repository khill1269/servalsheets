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
| **CI Impact** | `npm audit --audit-level=high` runs with `continue-on-error: true` in `.github/workflows/security.yml` |
| **Resolution Path** | Upgrade to `node-saml` v4 when stable release ships |
| **Created** | 2026-03-26 |
| **Review By** | 2026-06-26 |
| **Owner** | @khill1269 |

## Resolved Exceptions

_None yet._
