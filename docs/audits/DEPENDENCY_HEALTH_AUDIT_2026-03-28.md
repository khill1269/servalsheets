# Dependency Health Audit — 2026-03-28

> Generated: 2026-03-28 | Auditor: Claude Code | Scope: full dependency tree

## Executive Summary

Full dependency health remediation of servalsheets@2.0.0. Removed 4 unused packages
(109 transitive deps eliminated), migrated dead-code tooling from abandoned `ts-prune`
to `knip`, verified all security overrides, created a Zod abstraction layer for
single-maintainer risk mitigation, applied patch-level updates, and confirmed 0
vulnerabilities.

## Changes Made

### Phase 1A: Removed Unused Packages

| Package | Type | Reason |
|---|---|---|
| `npm-run-all@^4.1.5` | devDependency | Zero usage in any script or code |
| `bindings@^1.5.0` | devDependency | Zero imports anywhere in codebase |
| `@types/stripe@^8.0.416` | devDependency | Redundant — `stripe@17.x` ships own types |
| `ts-prune@^0.10.3` | devDependency | Abandoned project, replaced by `knip` |

**Result:** 109 packages removed from node_modules.

### Phase 1B: Script Migration

| Script | Before | After |
|---|---|---|
| `dead-code` | `ts-prune --ignore ...` | `knip --production --no-exit-code` |
| `dead-code:report:raw` | `ts-prune --ignore ...` | `knip --production --reporter compact` |

Removed `.tsprunerc` config file.

### Phase 2: Override Verification

All 12 overrides verified as still necessary:

| Override | Status | Justification |
|---|---|---|
| `esbuild@^0.27.2` | ✅ Keep | Used by vite/vitest build pipeline |
| `express-rate-limit@^8.3.1` | ✅ Keep | Matches direct dep, prevents downgrade |
| `hono@^4.12.7` | ✅ Keep | Transitive from @modelcontextprotocol/sdk |
| `@hono/node-server@^1.19.11` | ✅ Keep | Transitive from @modelcontextprotocol/sdk |
| `underscore@^1.13.8` | ✅ Keep | Security fix (prototype pollution CVE) |
| `eslint → ajv@^6.12.4` | ✅ Keep | ESLint compatibility |
| `@eslint/eslintrc → ajv@^6.12.4` | ✅ Keep | ESLint compatibility |
| `minimatch@^10.2.1` | ✅ Keep | Forces modern version across tree |
| `xmldom → @xmldom/xmldom@^0.8.10` | ✅ Keep | Security fix for node-saml |
| `xml2js@^0.5.0` | ✅ Keep | CVE-2023-0842 fix for node-saml |
| `handlebars@^4.7.9` | ✅ Keep | Transitive from eslint-plugin-boundaries |
| `path-to-regexp@^8.4.0` | ✅ Keep | Express security fix |

### Phase 3A: Zod Abstraction Layer

Created `src/lib/schema.ts` — a thin re-export layer over Zod:

```typescript
export { z } from 'zod';
export type { ZodTypeAny, ZodSchema } from 'zod';
```

**Status:** Layer created. Migration of 48 source files from `import { z } from 'zod'`
to `import { z } from '../lib/schema.js'` is tracked as follow-up work (mechanical
find-replace, low risk).

### Phase 3B: Redis Abstraction

ioredis is imported in 3 files, all behind the existing `src/services/cache-store.ts`
abstraction. **No action needed** — already properly isolated.

### Phase 3C: Express Isolation

Express imports are confined to ~8 files in `src/server/` and `src/middleware/`.
**No action needed** — natural boundary already exists.

### Phase 4: Security & Updates

- `npm audit`: **0 vulnerabilities** ✅
- Patch updates applied: vitest 4.1.1→4.1.2, turbo 2.8.20→2.8.21,
  zod-to-json-schema 3.25.1→3.25.2, @vitest/coverage-v8 4.1.1→4.1.2

## Funding Risk Assessment

### 🔴 Critical Runtime (direct dependencies seeking funding)

| Package | Maintainer Model | Funding | Risk |
|---|---|---|---|
| `zod@^4.3.6` | Single maintainer (colinhacks) | GitHub Sponsors | HIGH — 48 files depend directly |
| `express@^5.2.1` | OpenCollective + corporate | Well-funded | LOW |
| `express-rate-limit@^8.3.1` | Small team | GitHub Sponsors | MEDIUM |
| `cors@^2.8.6` | Express ecosystem | OpenCollective | LOW |
| `dotenv@^17.2.4` | dotenvx.com | Commercial backing | LOW |
| `uuid@^13.0.0` | Single maintainer (broofa) | GitHub Sponsors | LOW |

### 🟡 Optional Runtime

| Package | Risk |
|---|---|
| `ioredis@^5.10.0` | MEDIUM — optional, properly abstracted |

### 🟢 Dev Dependencies

| Package | Risk |
|---|---|
| `vitest@^4.x` | LOW — OpenCollective funded, active community |
| `eslint@^9.x` | LOW — well-funded ecosystem |
| `prettier@^3.x` | LOW — widely used |

## Outstanding Major Version Updates

These require dedicated PRs with testing:

| Package | Current | Latest | Breaking? |
|---|---|---|---|
| `stripe` | 17.7.0 | 21.0.1 | Yes — major API changes |
| `eslint` | 9.39.4 | 10.1.0 | Yes — config format changes |
| `typescript` | 5.9.3 | 6.0.2 | Yes — new type checking behavior |
| `vite` | 7.3.1 | 8.0.3 | Yes — build config changes |
| `knip` | 5.88.1 | 6.1.0 | Likely — new API |
| `react/react-dom` | 18.3.1 | 19.2.4 | Yes — new React model |
| `@types/node` | 20.19.37 | 25.5.0 | Yes — new Node.js APIs |

**Recommendation:** Update in order of risk: knip → markdownlint-cli2 → stripe →
eslint → typescript (each as separate PR with full test suite).

## Follow-Up Tasks

- [ ] Migrate 48 src/ files from `import { z } from 'zod'` to `import { z } from '../lib/schema.js'`
- [ ] Evaluate `stripe@21.x` migration (4 major versions behind)
- [ ] Evaluate `eslint@10.x` migration when plugin ecosystem catches up
- [ ] Evaluate `typescript@6.x` migration after ecosystem stability
- [ ] Add `npm audit` check to CI workflow if not already present
- [ ] Schedule quarterly dependency health review

## Metrics

| Metric | Before | After |
|---|---|---|
| Total audited packages | 1,499 | 1,390 |
| Packages removed | — | 109 |
| Vulnerabilities | 0 | 0 |
| Unused devDependencies | 4 | 0 |
| Stale overrides | 0 (verified) | 0 |
| Abstraction layers | 0 | 1 (Zod) |
