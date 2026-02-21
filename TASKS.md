# ServalSheets Task Backlog

> Persistent backlog of planned work. Updated across sessions.
> For session-level context (what just happened, decisions), see `.serval/session-notes.md`.

## Active Phase: Platform Evolution

Goal: Extract shared logic into `@serval/core` so ServalSheets becomes one backend among many.

## Backlog

### P0 — serval-core Extraction

Status: **In Progress** (scaffold exists at `packages/serval-core/` v0.1.0, 24 files)

- [ ] Audit which `src/` modules duplicate `packages/serval-core/src/` (errors, retry, circuit-breaker, history, logger, redact, bounded-cache)
- [ ] Migrate `src/utils/retry.ts` → import from `@serval/core/safety`
- [ ] Migrate `src/utils/circuit-breaker.ts` → import from `@serval/core/safety`
- [ ] Migrate `src/core/errors.ts` → import from `@serval/core/errors`
- [ ] Migrate `src/utils/logger.ts` → import from `@serval/core/utils`
- [ ] Migrate `src/utils/redact.ts` → import from `@serval/core/utils`
- [ ] Migrate `src/utils/bounded-cache.ts` → import from `@serval/core/utils`
- [ ] Migrate `src/services/history-service.ts` → import from `@serval/core/history`
- [ ] Migrate `src/observability/metrics.ts` → import from `@serval/core/observability`
- [ ] Wire `src/adapters/google-sheets-backend.ts` to use core interfaces
- [ ] Verify all 22 tools still pass contract tests after migration
- [ ] Update `src/services/google-api.ts` to use core circuit breaker + retry
- [ ] Publish `@serval/core` v0.2.0 with all migrated modules

### P1 — Build & DX Polish

- [ ] Fix `docs/development/PROJECT_STATUS.md` stale entries (drift check fixed, false positive count)
- [ ] Update `.serval/state.md` known issues (drift check resolved)
- [ ] ESLint OOM in low-memory environments — investigate `ESLINT_USE_FLAT_CONFIG` or per-directory linting
- [ ] Reduce silent fallback false positives (13 remaining) — needs AST-based checker

### P2 — Feature Flags to Enable

These flags exist but are OFF by default. Evaluate and enable when ready:

- [ ] `ENABLE_PARALLEL_EXECUTOR` — parallel action execution within a single request
- [ ] `ENABLE_RBAC` — role-based access control for multi-tenant deployments
- [ ] `ENABLE_AUDIT_LOGGING` — structured audit trail for compliance
- [ ] `ENABLE_TENANT_ISOLATION` — per-tenant data separation
- [ ] `ENABLE_IDEMPOTENCY` — idempotent request handling (retry-safe)
- [ ] `ENABLE_COST_TRACKING` — Google API quota/cost tracking per user

### P3 — Future Backends

Once serval-core is extracted, these become possible:

- [ ] Google Docs backend (via `@serval/core` interfaces)
- [ ] Notion backend
- [ ] Airtable backend
- [ ] Excel Online backend

## Completed

- [x] Audit infrastructure (8/8 steps, 981 tests) — Session 9
- [x] Continuity system (Option D: state.md + session-notes.md) — Session 10
- [x] DX overhaul (CLAUDE.md, state generator, verify:safe) — Session 11
- [x] Pipeline restoration (ESLint AJV, drift hang, silent fallbacks) — Session 12
- [x] CLAUDE.md restructure (1081 → 195 lines, ARCHITECTURE.md created) — Session 13
- [x] TASKS.md + session-notes.md tracking system — Session 13
