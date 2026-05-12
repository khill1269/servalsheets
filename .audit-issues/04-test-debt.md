**Title:** [Audit 2026-04-29] Test-suite debt — most claims retracted, 1 real follow-up

**Labels:** audit, tests, code-quality

---

## Summary

Most original findings about test quality were **false positives**. Recording here so they're not re-discovered. One real item remains: the skipped-test backlog needs owners.

## Retracted (false positives in initial audit)

### RETRACT (mostly): P0-9 — "Three tautological tests"
**Reading:** the actual files

- `tests/analysis/testing-agent-simple.test.ts` — **NOT tautological.** A 350-line legitimate test. The `expect(true).toBe(true)` strings the audit flagged are inside source-code template literals used as test fixtures.
- `tests/sdks/sdk-generation.test.ts:267, 284, 301` — Weak `expect(true).toBe(true)` inside `catch` blocks as graceful skip-on-missing-SDK. Not pure tautology; should be `it.skip()` with a documented reason. **P3 hygiene.**
- `tests/startup/preflight-async-io.test.ts:57` — One stub `expect(true).toBe(true)` after 17 lines of real async/Promise testing. Weak but not pure tautology. **P3 hygiene.**

### RETRACT: P1-6 — "66 silent fallbacks"
**Reading:** spot-check of 10 instances

All 66 `return undefined` instances are annotated with inline `// OK: Explicit empty` comments per CLAUDE.md silent-fallback rules. The `scripts/check-silent-fallbacks.sh` allowlist matches. Not error-swallowing.

### RETRACT: P1-7 — "Snapshot coverage incomplete (4 vs 25)"
**Reading:** `tests/snapshots/__snapshots__/schemas.snapshot.test.ts.snap`

Lean by design. The canonical snapshot test iterates all exports from `src/schemas/index.js` matching `*Schema` / `*Input` / `*Output` patterns and snapshots each. Four `.snap` files cover all 25 tools' schemas plus 6 shared types. CI gates the snapshot via `npm run test:snapshots`.

## Real, deferred

### P1-8 — `it.skip()` backlog
**Exact count (re-verified):** **51** `.skip()` instances across 20 files. (Original audit said 38 — undercounted.)

**`.only()` count:** 0 — discipline is good.

**Spot-checks of 5 random skips** suggest a mix of:
- Intentional feature gates (e.g. tests that require external auth)
- Incomplete migrations (compute-engine regression tests)
- TDD scaffolds awaiting impl

**Acceptance:**
- [ ] Each `.skip()` block needs an owner + a tracking issue ref + a deadline, OR removal.
- [ ] Add a CI check that `wc -l` on `grep -rln "\.skip\\("` doesn't grow without explicit allowlist update.
- [ ] Consider migrating production-feature `.skip()` cases to a separate `tests/manual/` directory so the main suite reflects "what's actually tested".

## Other quality items (P2/P3, all real but lower priority)

- [ ] No `knip` / `ts-prune` CI gate. `knip` config exists but is non-blocking in `scripts/audit-gate.sh:147-150`.
- [ ] `stryker.critical.conf.mjs` mutates ~10 files; expand to nightly per-handler mutation testing.
- [ ] `tests/audit/action-coverage.test.ts` validates schema presence per action but does not exercise handler dispatch — a `case 'foo':` falling through to `NotImplementedError` would still pass.
- [ ] No `scripts/check-handler-action-alignment.mjs` — existing wiring checks cover middleware mutation lists but not handler/action one-to-one.

## CI infra (verified)

`scripts/audit-gate.sh` enforces gates **A1–A15**:
- A1 typecheck
- A2 metadata drift
- A3 architecture boundaries
- A4 integration wiring
- A5 silent fallbacks
- A6 debug prints
- A7 action coverage
- A8 memory leaks
- A9 contracts
- A10 Google API compliance
- A11 MCP protocol
- A12 source/dist consistency
- A13 MCP feature coverage
- A14 live test guard
- A15 mutation score (optional, gated by `SKIP_MUTATION_TESTING`)

No `continue-on-error: true` on critical gates in `.github/workflows/ci.yml`. Foundation is solid.
