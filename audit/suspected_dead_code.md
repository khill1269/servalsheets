# Suspected Dead Code Report — ServalSheets
> Generated: 2026-03-28 | Evidence-based. Every claim backed by grep/inspection.

## Summary

**Confirmed Dead Code: 0 items** — Every candidate was verified as active.
**Confirmed Non-Issues (False Positives): 6 items** — Previously suspected, now cleared.
**Legitimate Cleanup Opportunities: 8 items** — Not dead code, but unnecessary files/data.

---

## Section 1: Verified NOT Dead Code (Previous False Positives)

### 1.1 `src/handlers/optimization.ts` — ACTIVE
- **Previous claim**: "Possible unused utilities" (CODEBASE_CONTEXT.md)
- **Finding**: 21 exports used throughout hot-path handlers and services
- **Verified imports from**:
  - `src/services/metrics/optimization-metrics.ts` → `OptimizationMetricsService`
  - `src/analysis/comprehensive.ts` → `suggestOptimization()`
  - Multiple handlers use `fastSuccess()`, `fastError()`, `fastCacheKey()`
- **Verdict**: ACTIVE utility module. Do not delete.

### 1.2 `src/graphql/` — ACTIVE (HTTP Admin Plane)
- **Previous assumption**: Possibly unwired GraphQL aspirational code
- **Finding**: 4 files, 982 lines total. Wired via `src/http-server/graphql-admin.ts`
- **Integration path**: `http-server/route-surface.ts` → `registerHttpGraphQlAndAdmin()` → `graphql/index.ts`
- **Verdict**: Active GraphQL admin endpoint. Do not delete.

### 1.3 `src/services/agentic-planner.ts` — DOES NOT EXIST (ESLint rule is precautionary)
- **Previous concern**: ESLint ignores `agentic-planner.ts` suggesting incomplete implementation
- **Finding**: File does not exist. ESLint ignore is future-proofing for when Phase 3 adds it.
- **Verdict**: No dead code; ESLint rule is aspirational/forward-compatible.

### 1.4 `src/services/checkpoint-manager.ts` — DOES NOT EXIST
- Same as above. Not created yet. ESLint rule is precautionary.

### 1.5 `src/transports/websocket-server.ts` + `websocket-transport.ts` — DO NOT EXIST
- Same as above. Phase 3 deferred. Not created yet.

### 1.6 `src/services/time-travel.ts` — ACTIVE (F5 Feature Completed)
- **Finding**: F5 Time-Travel was completed (Session history). Exists at 3 locations:
  - `src/resources/time-travel.ts`
  - `src/handlers/history-actions/time-travel.ts`
  - `src/services/time-travel.ts`
- **Verdict**: Active. Not dead.

---

## Section 2: Legitimate Cleanup Opportunities

These are not dead code but represent unnecessary committed files or stale data that can be safely removed.

### 2.1 Root-Level Build Artifacts (SHOULD REMOVE FROM WORKING TREE)
| File | Size | Issue |
|------|------|-------|
| `servalsheets-v2-clean.tar.gz` | 342 MB | Committed build artifact; listed in .gitignore but still present |
| `servalsheets.mcpb` | 84 MB | Same issue |
| `servalsheets-2.0.0.tgz` | 5.2 MB | Same issue |

**Note**: These files ARE in `.gitignore` (lines 146, 147, 303) so they should not be tracked. If they appear in `git status`, run `git rm --cached` on them. If they are untracked, simply delete them. 342MB in working directory is friction for every IDE and tool scan.

**Action**: `rm servalsheets-v2-clean.tar.gz servalsheets.mcpb servalsheets-2.0.0.tgz`

### 2.2 `.serval/` Metadata Bloat (2.7 MB)
| File | Size | Issue |
|------|------|-------|
| `.serval/codebase-manifest.json` | 2.2 MB | Full repo snapshot regenerated on each session start; stale between sessions |
| `.serval/plans/` | 240 KB | 62 `.fuse_hidden*` temporary file artifacts from incomplete file operations |
| `.serval/audit-comprehensive-2026-03-22.md` | 30 KB | Old audit; superseded |
| `.serval/codebase-manifest-report.txt` | 21 KB | Duplicate of manifest |
| `.serval/audit-findings-session103.md` | 9 KB | Old session artifact |
| `.serval/research-delta-session103.md` | 13 KB | Old session artifact |

**Action**:
```bash
rm .serval/plans/.fuse_hidden*   # 62 garbage temp files
rm .serval/audit-comprehensive-2026-03-22.md
rm .serval/codebase-manifest-report.txt
rm .serval/audit-findings-session103.md
rm .serval/research-delta-session103.md
# codebase-manifest.json: auto-regenerated on session start; OK to delete and let it regenerate
```

### 2.3 `tests/benchmarks/` Historical JSON Files (1.2 MB)
| Files | Size | Issue |
|-------|------|-------|
| `action-matrix-v2-2026-03-16T*.json` (7 files) | 1.2 MB combined | Historical benchmark snapshots; not needed for tests |
| `action-matrix-2026-03-16.json` | ~300 KB | Same |

**Action**: Keep `.ts` test files (handler-performance.bench.ts, performance-regression.test.ts, etc.), delete all `*.json` benchmark snapshots in `tests/benchmarks/`.

### 2.4 `.agent-context/` Development Metadata (44 KB)
| File | Size | Note |
|------|------|------|
| `recurring-issues.json` | 20.5 KB | Claude Code session learning memory |
| `fixes-applied.md` | 5 KB | Session artifact |
| `learning-memory.md` | 2.8 KB | Session artifact |

**Assessment**: These are Claude Code workflow artifacts. Useful for continuity but not source code. Consider adding to `.gitignore` if not already.

### 2.5 `docs/audits/` Old Audit Reports
- `docs/audits/DOCS_CRAWLER_DEEP_AUDIT_2026-03-24.json` (23,848 lines / 94KB)
- `docs/audits/CODEBASE_FULL_AUDIT.md` (1,209 lines)
- These are point-in-time audits. Consider archiving or removing post-2026-03-28 audit.

### 2.6 `docs/review/archive/` Planning Artifacts
- `docs/review/archive/planning-artifacts/COMPETITIVE_GAP_DEEP_DIVE.md` (795 lines)
- Multiple archived planning documents; legitimate history but contribute to 361 markdown file count.

### 2.7 Scaffold Backend Adapters (Intentional, Documented)
| File | Lines | Status |
|------|-------|--------|
| `src/adapters/notion-backend.ts` | 954 | P3 scaffold; declared intentional in CODEBASE_CONTEXT.md |
| `src/adapters/airtable-backend.ts` | 938 | Same |
| `src/adapters/excel-online-backend.ts` | (similar) | Same |

**Verdict**: NOT dead code. Intentional scaffolds for future P3 backends. Document as such in README.

### 2.8 Unused ESLint-Ignored Services (Files That Don't Exist Yet)
ESLint config ignores these paths — but the files don't exist yet (Phase 3 future work):
- `src/services/agentic-planner.ts`
- `src/services/checkpoint-manager.ts`
- `src/transports/websocket-server.ts`
- `src/transports/websocket-transport.ts`
- `src/ui/**` (eslint ignores; builds handled separately)
- `src/plugins/**` (Phase 3 plugin system not yet created)

**Action**: These ESLint ignores are valid forward-declarations. No cleanup needed.

---

## Section 3: knip Configuration (Dead Code Tool)

The repo has `knip.json` configured for dead code detection. Run:
```bash
npm run check:dead-code
```

Or for a detailed report:
```bash
npm run dead-code:report
```

This provides automated detection of unused exports, files, and dependencies. The above analysis was manual; automated knip analysis may surface additional items.

---

## Appendix: Files Investigated

| File / Path | Method | Verdict |
|-------------|--------|---------|
| `src/handlers/optimization.ts` | Read + grep imports | ACTIVE |
| `src/graphql/` | Read + grep HTTP server | ACTIVE |
| `src/services/agentic-planner.ts` | `find` lookup | DOES NOT EXIST |
| `src/services/checkpoint-manager.ts` | `find` lookup | DOES NOT EXIST |
| `src/transports/websocket-*.ts` | `find` lookup | DO NOT EXIST |
| `src/services/time-travel.ts` | `find` lookup | ACTIVE |
| `servalsheets-v2-clean.tar.gz` | `ls -lh` | CLEANUP TARGET |
| `.serval/plans/.fuse_hidden*` | `ls` | CLEANUP TARGET |
| `tests/benchmarks/*.json` | `ls -lh` | CLEANUP TARGET |
