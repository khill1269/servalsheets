---
title: Docs Optimization Plan
date: 2026-03-24
status: active
priority: P0
---

# 📋 Docs Optimization Plan

> Based on deep crawler audit of 620 files, 28.8 MB, 268 issues

---

## 🎯 Executive Summary

The docs/ folder has grown to **28.8 MB across 620 files**, but **86% of that (24.9 MB / 400 files) is the `.vitepress/dist/` build output** that shouldn't be in source control. The remaining 220 source files have 143 real issues: 2 critical count inconsistencies, 88 broken links, 22 binary files bloating git, and 23 missing frontmatters.

---

## Phase 1: Massive Size Reduction (P0 — saves 24.9 MB)

### 1.1 Gitignore `.vitepress/dist/`

- **Impact:** Remove 400 files / 24.9 MB (86% of docs folder)
- **Why:** Build output — regenerated on every `vitepress build`
- **Action:**

  ```bash
  echo "docs/.vitepress/dist/" >> .gitignore
  git rm -r --cached docs/.vitepress/dist/
  ```

- **Risk:** Zero — this is standard for all VitePress projects

### 1.2 Move Binary Files Out of Git

- **22 binary files** (16 .docx, 4 .xlsx, 2 SVG placeholders) = ~600 KB
- **Action:** Move to external storage (Google Drive / S3) and replace with links
- Files to relocate:
  - `research/*.xlsx` (3 files, 161 KB)
  - `review/archive/planning-artifacts/*.docx` (13 files, ~370 KB)
  - `review/archive/planning-artifacts/*.xlsx` (2 files, 46 KB)

**Phase 1 Total Savings: ~25.5 MB (88% reduction)**

---

## Phase 2: Fix Critical Issues (P0)

### 2.1 Action Count Inconsistency

- **20 different values** found across 139 references (100, 207, 291...408)
- **Root Cause:** Counts were never centralized; each doc hardcodes its own number
- **Fix:**
  1. Run `npm run check:metadata-drift` to get actual count from source code
  2. Update `development/SOURCE_OF_TRUTH.md` with canonical number
  3. Run `scripts/fix-doc-action-counts.sh` to bulk-update all docs
  4. Add CI gate: `npm run check:hardcoded-counts`

### 2.2 Tool Count Inconsistency

- **9 different values** (12, 13, 15, 16, 17, 21, 22, 23, 25) across 181 references
- **Same fix approach** as action counts

---

## Phase 3: Fix Broken Links (P1 — 88 broken links)

### 3.1 Missing Target Files (create or redirect)

| Pattern | Count | Fix |
|---------|-------|-----|
| `./monitoring` (deployment/) | 6 | Create `docs/deployment/monitoring.md` stub |
| `./CIRCUIT_BREAKER.md` | 3 | Create or redirect to `guides/ERROR_RECOVERY.md` |
| `./RATE_LIMITING.md` | 2 | Create or redirect to `guides/ERROR_RECOVERY.md` |
| `./TROUBLESHOOTING.md` (dev/) | 5 | Redirect to `guides/TROUBLESHOOTING.md` |
| `./PERFORMANCE.md` (dev/) | 3 | Redirect to `guides/PERFORMANCE.md` |
| `../MCP_2025-11-25_COMPLIANCE_CHECKLIST.md` | 3 | Fix path to `../compliance/MCP_2025-11-25_COMPLIANCE_CHECKLIST.md` |
| `./analysis/*` (README.md) | 9 | Remove — old analysis folder no longer exists |
| SLO runbooks (runbooks/README) | 6 | Create stub SLO runbooks or remove links |
| Absolute local paths (production-launch) | 5 | Convert to relative paths |

### 3.2 Automation

```bash
# Run link checker as CI gate
npx tsx scripts/check-doc-links.sh
```

---

## Phase 4: Content Consolidation (P1)

### 4.1 Archive Stale Review Docs

The `review/` folder has **50 files / 1.2 MB** — many are one-time audit artifacts:

- Move dated reports (2026-03-*) to `review/archive/`
- Keep only active: `index.md`, `REMEDIATION_PLAN.md`, `MASTER_EXECUTION_PLAN.md`

### 4.2 Consolidate Duplicate Coverage

| Topic | Files | Action |
|-------|-------|--------|
| Error handling | `guides/ERROR_HANDLING.md`, `guides/ERROR_RECOVERY.md`, `guides/error-recovery.md` | Merge into single guide |
| OAuth setup | `OAUTH_USER_SETUP.md`, `OAUTH_STANDARDIZED_SETUP.md`, `CLAUDE_DESKTOP_OAUTH_SETUP.md`, `OAUTH_INCREMENTAL_CONSENT.md` | Create unified OAuth guide with sections |
| Deployment | `guides/DEPLOYMENT.md`, `deployment/index.md`, `deployment/*.md` | Single deployment section — remove `guides/DEPLOYMENT.md` duplicate |
| Performance | `guides/PERFORMANCE.md`, `development/PERFORMANCE_TARGETS.md` | Merge or cross-reference clearly |

### 4.3 Research Folder Cleanup

- `research/` has **11 files** (503 KB): 6 HTML probe reports, 3 xlsx, 1 html dashboard, 1 markdown
- **Action:** Archive HTML reports to external storage, keep only `REAL_WORLD_WORKFLOWS.md`

---

## Phase 5: Frontmatter & Standards (P2)

### 5.1 Add Missing Frontmatter (23 files)

- Run `npx tsx scripts/add-frontmatter.ts` on files missing YAML headers
- Required fields: `title`, `date`, `status`

### 5.2 Naming Convention Fixes

- Convert `COMPETITIVE_ANALYSIS.html` → markdown or move to research
- Remove `review/contract_test_output.txt` (291 KB test output!) and `CONTRACT_TEST_REPORT.txt`

### 5.3 TODO Marker Triage

- **225 TODO/FIXME markers** found
- Most are in code examples (`spreadsheetId: 'xxx'`) — acceptable
- Real TODOs to address: ~20 in development/, guides/ files

---

## Phase 6: Structural Improvements (P2)

### 6.1 Missing Docs to Create

| Doc | Location | Purpose |
|-----|----------|---------|
| `deployment/monitoring.md` | deployment/ | Monitoring setup (linked by 6 files) |
| `guides/MIGRATION_GUIDE.md` | guides/ | Version migration (v1→v2 exists but not linked properly) |
| SLO runbooks (5 files) | runbooks/ | `slo-availability.md`, `slo-latency.md`, `slo-errors.md`, `slo-google-api.md`, `slo-cache.md` |

### 6.2 Add CI Documentation Gates

```json
// package.json scripts to add
{
  "docs:audit": "npx tsx scripts/crawl-docs-audit.ts",
  "docs:links": "npx tsx scripts/check-doc-links.sh",
  "docs:counts": "npm run check:hardcoded-counts",
  "docs:frontmatter": "npx tsx scripts/check-frontmatter.ts"
}
```

---

## 📊 Impact Summary

| Phase | Priority | Effort | Impact |
|-------|----------|--------|--------|
| 1. Size Reduction | P0 | 30 min | -25.5 MB (88%) |
| 2. Count Fixes | P0 | 1 hour | Fix 2 critical issues |
| 3. Broken Links | P1 | 2 hours | Fix 88 broken links |
| 4. Consolidation | P1 | 3 hours | Remove ~30 redundant files |
| 5. Standards | P2 | 1 hour | Fix 23 frontmatter + naming |
| 6. Structure | P2 | 2 hours | Create 8 missing docs + CI gates |

**Total estimated effort: ~9.5 hours**
**Result: docs/ drops from 620 files / 28.8 MB → ~185 files / ~2.5 MB**

---

## ✅ Success Criteria

- [ ] `.vitepress/dist/` removed from git tracking
- [ ] All binary files moved to external storage
- [ ] Action/tool counts consistent across all docs
- [ ] Zero broken internal links
- [ ] 100% frontmatter coverage on markdown files
- [ ] CI gates running for docs quality
- [ ] `npm run docs:audit` passes with 0 critical, 0 high issues
