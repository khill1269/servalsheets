---
title: Complete Docs Folder Audit
date: 2026-03-24
status: final
auditor: automated-deep-scan
---

# Complete Docs Folder Audit — 2026-03-24

## Executive Summary

| Metric | Value |
|--------|-------|
| Total markdown files | **182** |
| Git-tracked files | **147** |
| Non-markdown files (on disk) | **445** (mostly gitignored `.vitepress/dist/`, research binaries, review archive) |
| Directories | **48** |
| Subfolders | **18** |
| Files missing frontmatter | **20+** |
| Files with absolute local paths | **6** (5 in guides/, 1 in review/) |
| Truly broken internal links | **3** missing targets |
| .DS_Store files | **3** (should be gitignored) |
| Oversized md files (>50KB) | **3** |

### Fixes Applied During This Audit

1. **Created `docs/deployment/monitoring.md`** — resolves 6+ broken links referencing a monitoring page
2. **Fixed 5 absolute local paths** in `docs/deployment/production-launch-checklist.md` — converted to relative paths

---

## 1. Folder-by-Folder Breakdown

### `docs/` (root) — 3 files
| File | Status | Notes |
|------|--------|-------|
| `index.md` | ✅ OK | VitePress landing page |
| `privacy.md` | ✅ OK | Privacy policy |
| `README.md` | ✅ OK | Docs navigation hub |

### `docs/architecture/` — 1 file
| File | Status | Notes |
|------|--------|-------|
| `overview.md` | ✅ OK | Architecture overview |
| `architecture.json` | ⚠️ Non-md | JSON data file, tracked |

### `docs/audits/` — 9 files
| File | Status | Notes |
|------|--------|-------|
| `AUDIT_REPORT.md` | ⚠️ No frontmatter | Historical audit |
| `AQUI-VR_v3.2_Framework.md` | ⚠️ No frontmatter | Framework evaluation |
| `CODEBASE_AUDIT_SUPPLEMENT.md` | ⚠️ No frontmatter | |
| `CODEBASE_FULL_AUDIT.md` | ⚠️ No frontmatter, **65KB** | Very large file |
| `DOCS_CRAWLER_DEEP_AUDIT_2026-03-24.md` | ⚠️ **92KB** | Auto-generated, oversized |
| `DOCS_FOLDER_COMPLETE_AUDIT_2026-03-24.md` | ✅ | Previous audit |
| `MCP_STARTUP_ANALYSIS.md` | ⚠️ No frontmatter | |
| `PROJECT_SNAPSHOT.md` | ⚠️ No frontmatter | |
| `ServalSheets_GitHub_Audit.md` | ⚠️ No frontmatter | |

**Issues:** 6/9 files lack frontmatter. `CODEBASE_FULL_AUDIT.md` and `DOCS_CRAWLER_DEEP_AUDIT` are oversized.

### `docs/compliance/` — 2 files
| File | Status | Notes |
|------|--------|-------|
| `MCP_PROTOCOL_COMPLIANCE.md` | ✅ OK | |
| `GOOGLE_API_COMPLIANCE.md` | ✅ OK | |

### `docs/deployment/` — 9 files
| File | Status | Notes |
|------|--------|-------|
| `index.md` | ✅ OK | |
| `MONITORING.md` | ✅ **Created this audit** | On macOS = same as `monitoring.md` |
| `production-launch-checklist.md` | ✅ **Fixed this audit** | 5 absolute paths → relative |
| `docker.md` | ✅ OK | |
| `environment-variables.md` | ✅ OK | |
| `helm-chart.md` | ✅ OK | |
| `kubernetes.md` | ✅ OK | |
| `multi-instance.md` | ✅ OK | |
| `scaling.md` | ✅ OK | |

### `docs/development/` — 25 files
| File | Status | Notes |
|------|--------|-------|
| `ARCHITECTURE.md` | ✅ OK | |
| `CODEBASE_CONTEXT.md` | ✅ OK | |
| `DEVELOPER_WORKFLOW.md` | ✅ OK | |
| `HANDLER_PATTERNS.md` | ✅ OK | |
| `IMPLEMENTATION_GUARDRAILS.md` | ✅ OK | |
| `SCRIPTS_REFERENCE.md` | ✅ OK | |
| `SOURCE_OF_TRUTH.md` | ✅ OK | |
| `TESTING.md` | ✅ OK | |
| `PERFORMANCE.md` | ❌ **MISSING** | Referenced by links but doesn't exist |
| `SCHEMA_DESIGN.md` | ❌ **MISSING** | Referenced by links but doesn't exist |
| `TESTING_STRATEGY.md` | ❌ **MISSING** | Referenced by links but doesn't exist |
| *(14 other files)* | ✅ OK | |

**Issues:** 3 files referenced by internal links don't exist.

### `docs/examples/` — 6 md + 6 JSON
| Status | Notes |
|--------|-------|
| ✅ OK | All example files have matching JSON data files |

### `docs/features/` — 3 files
| File | Status | Notes |
|------|--------|-------|
| `FEDERATION.md` | ⚠️ No frontmatter | |
| `AGENT_MODE.md` | ⚠️ No frontmatter | |
| `TRANSACTIONS.md` | ⚠️ No frontmatter | |

**Issues:** All 3 lack frontmatter.

### `docs/guides/` — 41 files
| Status | Notes |
|--------|-------|
| ✅ Mostly OK | Largest subfolder |
| ⚠️ 5 files contain absolute `/Users/thomascahill/...` paths | See §3 below |
| ❌ `GRAPHQL_API.md` | Referenced but doesn't exist |

**Issues:** 5 files with hardcoded local paths. 1 missing link target.

### `docs/operations/` — 13 files
| Status | Notes |
|--------|-------|
| ✅ OK | Includes METRICS_REFERENCE, TRACING_DASHBOARD, etc. |

### `docs/public/` — 0 md, 1 SVG
| File | Status | Notes |
|------|--------|-------|
| `logo.svg` | ✅ OK | VitePress static asset |

### `docs/reference/` — 11 files
| Status | Notes |
|--------|-------|
| ✅ OK | Includes tools.md, API reference, schema docs |
| ⚠️ `.DS_Store` | Should be gitignored |
| `server.schema.json` | ✅ OK | JSON schema file |

### `docs/releases/` — 2 files
| Status | Notes |
|--------|-------|
| ✅ OK | Release notes |

### `docs/remediation/` — 3 files
| File | Status | Notes |
|------|--------|-------|
| `benchmark-fix-action-plan-2026-03-20.md` | ✅ OK | |
| `DOCS_OPTIMIZATION_PLAN_2026-03-24.md` | ✅ OK | |
| `issue-tracker.csv` | ✅ OK | Non-md, tracked |

### `docs/research/` — 1 md + 9 binaries (on disk)
| File | Status | Notes |
|------|--------|-------|
| `REAL_WORLD_WORKFLOWS.md` | ⚠️ No frontmatter, **102KB** | Largest md file |
| `*.xlsx` (3 files) | 🔴 Gitignored | Binary spreadsheets on disk only |
| `*.html` (6 files) | 🔴 Gitignored | HTML reports on disk only |

**Issues:** The xlsx/html files should stay gitignored (already are). The 102KB md file is very large.

### `docs/review/` — 30 md + archive/
| Status | Notes |
|--------|-------|
| 🔴 **Entire folder is gitignored** | `docs/review/` in `.gitignore` |
| 30 md files on disk | Ephemeral review artifacts |
| `archive/` subfolder: 31 files (672KB) | Includes .docx, .xlsx planning artifacts |
| `.DS_Store` in archive | Should be cleaned |

**This folder is correctly gitignored** — these are ephemeral review/audit artifacts.

### `docs/runbooks/` — 13 files
| File | Status | Notes |
|------|--------|-------|
| `README.md` | ✅ OK | Index of all runbooks |
| `auth-failures.md` | ✅ OK | |
| `circuit-breaker.md` | ✅ OK | |
| `emergency-disable.md` | ✅ OK | |
| `google-api-errors.md` | ✅ OK | |
| `high-error-rate.md` | ✅ OK | |
| `high-latency.md` | ✅ OK | |
| `low-cache-hit-rate.md` | ✅ OK | |
| `memory-exhaustion.md` | ✅ OK | |
| `quota-near-limit.md` | ✅ OK | |
| `request-queue-backup.md` | ✅ OK | |
| `service-down.md` | ✅ OK | |
| `slow-google-api.md` | ✅ OK | |

**Status:** ✅ All 13 runbooks present and complete.

### `docs/security/` — 5 files
| File | Status | Notes |
|------|--------|-------|
| `INCIDENT_RESPONSE_PLAN.md` | ✅ OK | |
| `OAUTH_SECURITY.md` | ✅ OK | |
| `SECURITY_ARCHITECTURE.md` | ✅ OK | |
| `THREAT_MODEL.md` | ✅ OK | |
| `VULNERABILITY_MANAGEMENT.md` | ✅ OK | |

### `docs/testing/` — 1 file
| File | Status | Notes |
|------|--------|-------|
| `MASTER_TEST_PLAN.md` | ⚠️ No frontmatter | |

### `docs/.vitepress/` — 3 tracked files
| File | Status | Notes |
|------|--------|-------|
| `config.mjs` | ✅ OK | VitePress config |
| `theme/custom.css` | ✅ OK | Custom styles |
| `theme/index.ts` | ✅ OK | Theme setup |
| `dist/` | 🔴 Gitignored | Build output, 0 tracked files ✅ |

---

## 2. Critical Issues

### 🔴 P0: Missing Link Targets (3 files)

These files are referenced by internal links but don't exist:

| Missing File | Referenced From |
|-------------|----------------|
| `docs/development/PERFORMANCE.md` | Multiple development docs |
| `docs/development/SCHEMA_DESIGN.md` | Multiple development docs |
| `docs/development/TESTING_STRATEGY.md` | Multiple development docs |

**Fix:** Create stub files or update references to point to existing alternatives (e.g., `TESTING.md` instead of `TESTING_STRATEGY.md`).

### 🔴 P0: Hardcoded Local Paths (6 files)

These files contain absolute `/Users/thomascahill/...` paths that will break for other users:

| File | Line(s) | Content |
|------|---------|---------|
| `docs/guides/CLAUDE_DESKTOP_SETUP.md` | 164, 627 | Hardcoded user home paths |
| `docs/guides/CLAUDE_DESKTOP_OAUTH_SETUP.md` | 346, 349 | `/Users/YOUR_USERNAME/...` (partially generic) |
| `docs/guides/QUICKSTART_CREDENTIALS.md` | 47, 130, 132 | Hardcoded paths to dist/ and SA key |
| `docs/guides/OAUTH_USER_SETUP.md` | 62 | `cd /Users/thomascahill/...` |
| `docs/guides/MCP_INSPECTOR_TESTING_GUIDE.md` | 428 | Working directory path |
| `docs/review/CLAUDE_DESKTOP_CONFIG_AUDIT_2026-03-13.md` | 60 | Cache dir path (gitignored file, low priority) |

**Fix:** Replace with `~/Documents/...` or `<YOUR_PROJECT_PATH>/...` placeholder patterns.

---

## 3. Warnings

### ⚠️ Missing Frontmatter (20+ files)

Files without YAML frontmatter headers. This affects `docs:audit` scoring and VitePress metadata:

- `docs/audits/` — 6 files
- `docs/features/` — 3 files (all)
- `docs/testing/` — 1 file
- `docs/research/` — 1 file
- `docs/review/` — 9+ files (gitignored, low priority)

### ⚠️ Oversized Files (3 files)

| File | Size | Recommendation |
|------|------|----------------|
| `docs/research/REAL_WORLD_WORKFLOWS.md` | 102KB | Consider splitting or archiving |
| `docs/audits/DOCS_CRAWLER_DEEP_AUDIT_2026-03-24.md` | 92KB | Auto-generated, consider trimming |
| `docs/audits/CODEBASE_FULL_AUDIT.md` | 65KB | Consider archiving |

### ⚠️ .DS_Store Files (3 locations)

```
docs/.DS_Store
docs/reference/.DS_Store
docs/review/archive/audit-artifacts/analysis/.DS_Store
```

Already in `.gitignore` pattern but may be tracked. Run `git rm --cached` if needed.

### ⚠️ Non-Markdown Files on Disk (Not Tracked)

The `docs/research/` folder has 9 binary files (3 xlsx, 6 html) on disk but correctly gitignored. The `docs/review/archive/` has 17 docx/xlsx planning artifacts also correctly gitignored.

---

## 4. Git Tracking Summary

| Category | Count | Status |
|----------|-------|--------|
| Tracked md files | ~142 | ✅ |
| Tracked non-md files | 5 | ✅ (config.mjs, custom.css, index.ts, logo.svg, issue-tracker.csv) |
| Gitignored: `docs/review/` | entire folder | ✅ Correct |
| Gitignored: `docs/.vitepress/dist/` | build output | ✅ Correct |
| Gitignored: `docs/**/*.docx`, `docs/**/*.xlsx` | binaries | ✅ Correct |
| Gitignored: `docs/research/*.html` | html reports | ✅ Correct |

---

## 5. Remediation Checklist

### Immediate (P0)
- [ ] Create `docs/development/PERFORMANCE.md` (stub or redirect)
- [ ] Create `docs/development/SCHEMA_DESIGN.md` (stub or redirect)
- [ ] Create `docs/development/TESTING_STRATEGY.md` (stub or redirect to TESTING.md)
- [ ] Replace absolute paths in 5 guides files with generic placeholders

### Short-term (P1)
- [ ] Add frontmatter to 11 tracked files missing it (excluding gitignored review/)
- [ ] Run `git rm --cached docs/.DS_Store docs/reference/.DS_Store` if tracked
- [ ] Consider splitting `REAL_WORLD_WORKFLOWS.md` (102KB)

### Low Priority (P2)
- [ ] Clean up `docs/review/archive/` .DS_Store
- [ ] Trim auto-generated audit files >50KB
- [ ] Review whether `docs/guides/GRAPHQL_API.md` should be created or links removed

---

## 6. Architecture Health Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Organization** | 9/10 | 18 well-named subfolders, clear hierarchy |
| **Completeness** | 8/10 | 3 missing targets, otherwise comprehensive |
| **Link Integrity** | 7/10 | Fixed 5 absolute paths; 3 broken + 6 absolute remain |
| **Frontmatter** | 7/10 | 20+ files missing; most in audits/ and review/ |
| **Git Hygiene** | 9/10 | Gitignore rules are comprehensive and correct |
| **File Size** | 8/10 | 3 files >50KB, rest appropriate |
| **Overall** | **8/10** | Good shape, minor cleanup needed |
