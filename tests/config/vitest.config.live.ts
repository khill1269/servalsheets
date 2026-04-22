/**
 * Vitest Configuration for Live API Tests (compat shim)
 *
 * This file historically ran the full live-api suite. As of 2026-04-21
 * (Phase 2 tiering) it re-exports the NIGHTLY config so the full surface
 * still runs for anyone invoking the old path directly.
 *
 * New call sites should use one of:
 *   - `tests/config/vitest.config.live.smoke.ts`   — PR-tier, quota-safe
 *   - `tests/config/vitest.config.live.nightly.ts` — full surface
 *   - `tests/config/vitest.config.live.optimizations.ts` — timing-sensitive benchmarks
 *
 * Use with: npx vitest --config tests/config/vitest.config.live.ts
 */

export { default } from './vitest.config.live.nightly.js';
