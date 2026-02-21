# Session Notes
> Updated by each Claude session as its last act. Captures intent, decisions, and next steps
> that code analysis alone cannot determine.

## Current Phase
Platform evolution. Backlog and priorities tracked in `TASKS.md` (project root).

## What Was Just Completed (Session 13, 2026-02-21)
- **CLAUDE.md restructured**: 1081 → 195 lines. Architecture/reference moved to `docs/development/ARCHITECTURE.md`. Added 300-line size cap.
- **TASKS.md created**: Persistent backlog with P0–P3 priorities. Separates "what to do" from "what happened" (session-notes.md).
- **PROJECT_STATUS.md fixed**: Drift check status updated from "hangs" to "pass".
- **Git commit + push**: All Sessions 8–12 work committed as `4a6e3e9`, pushed to origin/main.

## What Was Just Completed (Session 12, 2026-02-21)
- **ESLint AJV crash fixed**: Global `ajv@^8.18.0` override was breaking `@eslint/eslintrc` (needs ajv@6). Added nested override in `package.json` and manually installed ajv@6.12.6 into eslintrc's node_modules.
- **generate-metadata.ts hang fixed**: Root cause was two `execSync('npx prettier --write ...')` calls creating IPC pipe conflicts. Removed all prettier calls from the script (formatting is a separate concern). Removed non-deterministic `generatedAt` timestamp. Added semantic JSON comparison in validate mode.
- **check-metadata-drift.sh simplified**: Replaced 122-line script with 20-line wrapper that calls `node --import tsx scripts/generate-metadata.ts --validate`.
- **npm run verify pipeline restored**: `check:drift` now works (no longer hangs). Updated CLAUDE.md known issues section.
- **Silent fallback checker improved**: Increased lookback to 5 lines, added 6 new exclusion patterns (switch/case, typeof guards, for..of loops, inline comments). False positives reduced from 48 → 13 (73% reduction).
- **`.claude/agents/README.md` created**: Index of all 17 specialized agents organized by category (Core Development, Quality & Testing, Google API, Protocol & Config) with "when to use which" guide.

## Next Steps
See `TASKS.md` for the full prioritized backlog. Top priority is P0: serval-core extraction.

## Key Decisions Made
- **Option D chosen** for context continuity: auto-generated state + manual session notes
- **Simulation proved**: 100% fact recovery vs 49% with CLAUDE.md alone, at ~4k extra tokens
- **Native Claude Code mechanics**: SessionStart hook + @import syntax (no custom infrastructure)
- **Audit infrastructure complete**: 8/8 steps, 981 audit tests, CI gate script operational

## Architecture Notes
- serval-core v0.1.0 exists at `packages/serval-core/`
- GoogleSheetsBackend adapter at `src/adapters/google-sheets-backend.ts`
- Multi-LLM exporter Phase 3 complete
- 22 tools with 315 actions (source: `src/schemas/action-counts.ts`)

## Session History
| Date | Session | What Happened |
|------|---------|---------------|
| 2026-02-20 | 8+ | Completed audit steps 1-2 (fixtures + coverage test, 976 tests passing) |
| 2026-02-20 | 9 | Completed audit steps 3-8, researched continuity, built simulation |
| 2026-02-21 | 10 | Implemented Option D continuity system, fixed stale files |
| 2026-02-21 | 11 | DX overhaul: state generator upgrade, CLAUDE.md style guide + architecture + recipe, stale count fixes across 6 files, verify:safe script, bash syntax fix |
| 2026-02-21 | 12 | Pipeline restoration: ESLint AJV fix, drift hang fix (removed npx prettier), verify pipeline restored, silent fallback checker improved (48→13 FP), agents README index created |
| 2026-02-21 | 13 | CLAUDE.md restructure (1081→195 lines), ARCHITECTURE.md created, TASKS.md backlog, PROJECT_STATUS.md fix, git commit+push |
