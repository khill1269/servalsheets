---
title: AQUI-VR v3.2 Framework
date: 2026-03-24
status: active
---

# AQUI-VR v3.2 — Audit Quality Infrastructure: Verification & Remediation

**ServalSheets v2.0.0 · Branch: release-1.7.1 · MCP 2025-11-25**
**Based on:** March 2026 full-codebase audit (54 findings: 4C · 10H · 23M · 17L)
**Extends:** G0–G12 gate pipeline in `scripts/audit-gate.sh`
**Adds:** G13–G25 (13 finding-specific gates)
**Last updated:** 2026-03-20

---

## What This Framework Is

A living operational document that:

1. Maps all 54 audit findings to verifiable pass/fail checks
2. Extends the existing G0–G12 gate pipeline with 13 new finding-specific gates (G13–G25)
3. Tracks remediation state per finding (🔴 Open · 🟡 In-Progress · ✅ Done · ⚪ Waived)
4. Defines new scripts to close verification gaps in the existing framework
5. Provides a weighted scoring model that reflects actual compliance depth

**Not a one-time report.** Update finding statuses as items are remediated. The planned runner script is `audit:aquivr`, but it is not currently defined in `package.json`.

**Related benchmark execution plan:** The sheet-backed 44-fix workflow priority list now lives in [docs/remediation/benchmark-fix-action-plan-2026-03-20.md](./docs/remediation/benchmark-fix-action-plan-2026-03-20.md). Use this framework for audit gates and verification evidence; use the benchmark plan for live spreadsheet execution defaults and tool-routing priorities.

---

## Quick Run

```bash
# Planned command surface once the runner scripts exist:
# audit:aquivr
# audit:aquivr:tier1

# Single gate
bash scripts/aquivr-gate.sh G15

# Current score without running gates
node scripts/aquivr-score.mjs
```

> **Prerequisite:** The three runner scripts don't exist yet — see §6 for their specs.

---

## 1. Gate Pipeline Reference

### Existing Gates G0–G12 (from `scripts/audit-gate.sh`)

| Gate | Check | Command | ~Time |
|------|-------|---------|-------|
| G1 | TypeScript compiles | `npx tsc --noEmit` | 10s |
| G2 | No metadata drift | `npm run check:drift` | 3s |
| G3 | Architecture boundaries | `npm run check:architecture` | 2s |
| G4 | Integration wiring | `npm run check:integration-wiring` | 1s |
| G5 | No silent fallbacks | `npm run check:silent-fallbacks` | 2s |
| G6 | No debug prints | `npm run check:debug-prints` | 2s |
| G7 | Action coverage | `vitest run tests/audit/action-coverage.test.ts` | 5s |
| G8 | Memory leak tests | `vitest run tests/audit/memory-leaks.test.ts` | 3s |
| G9 | Contract tests | `vitest run tests/contracts/` | 8s |
| G10 | Google API compliance | `node scripts/audit-google-api-compliance.mjs --offline-ok` | 2s |
| G11 | MCP protocol compliance | `vitest run tests/compliance/mcp-*.test.ts tests/contracts/mcp-*.test.ts` | 5s |
| G12 | Dead-code baseline | `npm run check:dead-code:baseline` | 7s |

### New Gates G13–G25 (this framework)

| Gate | Finding(s) | Check | Status |
|------|-----------|-------|--------|
| G13 | C-1 | No plaintext credentials in .mcp.json | ✅ Done |
| G14 | C-2, H-8 | No stale .bak files in src/ | ✅ Done |
| G15 | C-4, H-9 | CHANGELOG/CLAUDE.md action count matches ACTION_COUNT | ✅ Done — `scripts/aquivr-check-doc-counts.mjs` |
| G16 | C-3 | openapi.json version === package.json version | ✅ Done |
| G17 | H-1 | TOOL_ACTIONS keys match discriminated union literals | ✅ Done — `tests/contracts/completions-cross-map.test.ts` (27/27) |
| G18 | H-2 | ACTIVE_TOOL_DEFINITIONS.length === TOOL_DEFINITIONS.length (unless staged) | ✅ Done — preflight check added |
| G19 | H-5 | Mutation formula scan is key-independent | ✅ Done — scan was already key-independent |
| G20 | H-6 | Write-lock MUTATION_ACTIONS === audit-middleware MUTATION_ACTIONS | ✅ Done — `check-mutation-actions.mjs` already covers this |
| G21 | H-4 | clearDiscoveryHintCache() called in advanceToStage() | ✅ Done — `tool-stage-manager.ts:185` |
| G22 | H-10 | Scaffold adapters guarded behind ENABLE_EXPERIMENTAL_BACKENDS | ✅ Done — constructor guards added |
| G23 | M-3 | SERVER_INSTRUCTIONS.length < 4096 | ✅ Done — preflight check added |
| G24 | M-9 | Node 18 absent from CI matrix | ✅ Done — CI already on 20/22 only |
| G25 | M-19 | check:drift completes in < 30s | ✅ Done — cross-platform timeout via `perl -e 'alarm N; exec @ARGV'` |

---

## 2. Finding Registry

Full record of all 54 findings. Status: 🔴 Open · 🟡 In-Progress · ✅ Done · ⚪ Waived.

### Critical (4)

#### C-1 · Plaintext credentials in .mcp.json · Gate G13

**File:** `.mcp.json` | **Status:** ✅ Done — G13 check passes (no credential patterns found)
