**Title:** [Audit 2026-04-29] Security hardening — RESOLVED (10 fixes, marked SEC-008 through SEC-015)

**Labels:** audit, security, completed

---

## Summary

Read-only audit on 2026-04-29 plus a strict re-audit produced 10 verified security fixes, all landed locally with `SEC-008..SEC-015` source markers. This issue documents the resolution and points at the commits.

Three originally-claimed findings were **retracted** as false positives.

## Fixed (10)

| Marker | Finding | File:line |
|---|---|---|
| SEC-008 | Production HTTP must have `OAUTH_REDIRECT_URI` set; wire `enforceProductionOAuthConfig()` | `src/startup/lifecycle.ts:170 validateOAuthConfig` |
| SEC-009 | Surface bundled-credentials warning at startup; wire `warnIfDefaultCredentialsInHttpMode()` | same |
| SEC-010 | Warn when `STRICT_MCP_PROTOCOL_VERSION` unset in production | `src/startup/lifecycle.ts:warnIfStrictProtocolVersionDisabledInProduction` |
| SEC-011 | Drop `data:` from Helmet `imgSrc` directive | `packages/mcp-http/src/middleware.ts:130` |
| SEC-012 | Throw on `CORS_ORIGINS=*` in production | `packages/mcp-http/src/middleware.ts:120-138` |
| SEC-013 | Force `requireTimestamp=true` in production webhooks; deprecate the toggle | `src/utils/webhook-verification.ts:194-205` |
| SEC-014 | `JWT_SECRET` minimum 32-byte entropy validation | `src/auth/oauth-provider.ts:1948-1972` |
| SEC-015 (SAML) | `SSO_JWT_SECRET` minimum 32-byte entropy validation | `src/security/saml-provider.ts:544-563` |
| SEC-015 (OIDC) | Same check on OIDC code path (separate function) | `src/security/oidc-provider.ts:669-688` |
| SAMPLING-001 | Sampling reachability probe at startup | `src/startup/lifecycle.ts:probeSamplingHealthAtStartup` |

Each fix throws `ConfigError` in production / logs warn in dev, matching the existing `requireEncryptionKeyInProduction()` pattern at `src/startup/lifecycle.ts:55-83`.

## Retracted (false positives in initial audit)

### RETRACT: P1-2 — "Anonymous principals each exhaust quota"
**Reading:** `src/mcp/registration/tool-handlers.ts:1191`

`const principalId = requestContext.principalId ?? 'anonymous';` means all anon requests share **one** bucket — the conservative design. They don't independently exhaust quota.

There IS a related concern (anon-A starves anon-B), but it's mitigatable via session/client-id headers and is a deployment-design call, not a code bug.

### RETRACT: P1-3 — "RBAC middleware not wired"
**Reading:** `src/http-server/enterprise-middleware.ts`, `packages/mcp-http/src/enterprise-middleware.ts:70-87`

RBAC middleware IS wired through `registerHttpEnterpriseMiddleware`. It's gated behind `enableRbac` (env: `ENABLE_RBAC=true`), which is documented as an opt-in enterprise feature in CLAUDE.md gotcha #17 and `docs/development/ADVANCED_GOTCHAS.md`.

`RBAC_STRICT=true` controls fail-closed vs fail-open on RBAC errors (`src/mcp/registration/tool-handlers.ts:1275-1290`). Both behaviors are intentional and documented.

### RETRACT: P1-NEW-d — "SQL injection in compute handlers"
**Reading:** `src/services/duckdb-worker.ts:30-54`

`validateDuckDbSql()` enforces SELECT-only, blocks DDL/DML/`read_csv`/`pragma`/etc. `validateTableName()` allowlists `[A-Za-z_][A-Za-z0-9_]{0,63}` before any interpolation. Column headers are sanitized (line 76-77). Quote escaping at lines 86, 91.

The protection is regex-based blocklist (not parameterized queries), which is hardenable but is **not** "no protection" as initially claimed.

## Real but deferred (P2 hygiene)

- [ ] Replace DuckDB regex blocklist with prepared statements / parameterized queries (`src/services/duckdb-worker.ts`). Enhancement, not a vulnerability.
- [ ] Consider per-IP rate-limit tier for `'anonymous'` to prevent anon-vs-anon DoS (`src/middleware/rate-limit-middleware.ts`).
- [ ] Add `scripts/check-security-defaults.mjs` to fail CI when any of the SEC-* defaults regress.
- [ ] Make `ENABLE_RBAC=true` the default in `NODE_ENV=production` (architectural call).
