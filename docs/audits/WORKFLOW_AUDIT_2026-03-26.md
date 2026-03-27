# GitHub Actions Workflow Audit — 2026-03-26

## Executive Summary

**Before:** 25 workflow files (local + remote), many overlapping, some dead
**After:** 16 focused workflow files — 9 deleted, 3 merged, 3 enhanced
**Impact:** ~36% fewer workflow files, zero lost capability, faster CI feedback

---

## Inventory: What We Had (25 workflows)

| # | Workflow | Triggers | Purpose | Verdict |
|---|---------|----------|---------|---------|
| 1 | `ci.yml` | push/PR/merge | Core CI: lint, typecheck, test, build | **KEEP — enhanced** |
| 2 | `actionlint.yml` | PR/push/merge | Lint workflow YAML | **KEEP — fixed** |
| 3 | `architecture.yml` | PR/push (src changes) | Circular deps, dead code | **KEEP — enhanced** |
| 4 | `audit-106.yml` | push main, weekly | Contract + compliance audits | KEEP |
| 5 | `auto-draft-pr.yml` | push feat/fix branches | Auto-create draft PRs | KEEP |
| 6 | `benchmark.yml` | push main, manual | Tool/action benchmarks, live API | **MERGED → performance.yml** |
| 7 | `claude-fix.yml` | (none/broken) | Auto-fix from Claude suggestions | **DELETED — dead** |
| 8 | `claude.yml` | issue comment | Claude Code agent | KEEP |
| 9 | `coverage.yml` | push/PR | Coverage reporting | **MERGED → ci.yml** |
| 10 | `dependency-validation.yml` | PR/push (pkg changes) | npm audit, syncpack, drift | **MERGED → architecture.yml** |
| 11 | `deploy-dashboard.yml` | manual only | Deploy perf dashboard | **DELETED — never used** |
| 12 | `deploy-demo.yml` | manual only | Deploy demo site | **DELETED — never used** |
| 13 | `docker.yml` | push main, PR, manual | Docker build + push | KEEP |
| 14 | `docs-validation.yml` | push/PR (docs changes) | Doc linting, links, spell | **MERGED → ci.yml** |
| 15 | `docs.yml` | push main (docs changes) | Build + deploy docs site | KEEP |
| 16 | `file-size-check.yml` | PR | Enforce file size limits | **MERGED → ci.yml** |
| 17 | `multi-agent-analysis.yml` | manual only | Multi-agent orchestration | KEEP |
| 18 | `mutation-testing.yml` | push/PR | Stryker mutation testing | **MERGED → ci.yml** |
| 19 | `performance-tracking.yml` | push/PR | Perf regression + PR comments | **MERGED → performance.yml** |
| 20 | `publish.yml` | release published | npm publish | KEEP |
| 21 | `release-audit.yml` | release published, manual | Pre-release audit checks | KEEP |
| 22 | `schema-check.yml` | push/PR (schema changes) | Schema drift detection | KEEP |
| 23 | `scorecards.yml` | push main, weekly | OpenSSF Scorecards | KEEP |
| 24 | `security.yml` | push/PR, daily | CodeQL + Trivy scanning | KEEP |
| 25 | `sync-docs.yml` | push main (docs) | Sync docs to external | KEEP |
| 26 | `test-gates.yml` | push/PR | Gate tests (subset of CI) | **DELETED — 100% duplicate of CI** |
| 27 | `validate-server-json.yml` | push/PR | Validate server.json | **DELETED — already in CI build** |

---

## Changes Made

### 🗑️ Deleted (9 files)

| File | Reason |
|------|--------|
| `claude-fix.yml` | Dead — no trigger, broken references, never ran |
| `deploy-dashboard.yml` | Dead — manual only, zero runs, no deployment target |
| `deploy-demo.yml` | Dead — manual only, zero runs, no demo infrastructure |
| `test-gates.yml` | 100% duplicate of CI test jobs |
| `coverage.yml` | Standalone coverage → now a job in CI |
| `mutation-testing.yml` | Standalone mutation → now a job in CI |
| `validate-server-json.yml` | Single step → now in CI build job |
| `file-size-check.yml` | Single step → now a job in CI |
| `docs-validation.yml` | Small workflow → now a job in CI |

### 🔀 Merged (3 consolidations)

| New File | Absorbed From | Jobs |
|----------|--------------|------|
| **`performance.yml`** | `benchmark.yml` + `performance-tracking.yml` | regression-tests, compliance-tests, tool-benchmarks, action-benchmarks, live-api-tests, update-baseline, summary |
| **`architecture.yml`** (enhanced) | + `dependency-validation.yml` | dependency-analysis, dead-code-analysis, **dependency-validation**, architecture-summary |
| **`ci.yml`** (enhanced) | + `coverage.yml` + `docs-validation.yml` + `file-size-check.yml` + `mutation-testing.yml` + `validate-server-json.yml` | All existing CI jobs + **coverage**, **docs-validation**, **file-size-check**, **mutation-testing** |

### 🔧 Fixed (1 file)

| File | Fix |
|------|-----|
| `actionlint.yml` | Removed `continue-on-error: true` from lint step — was silently passing broken workflows |

---

## Final Workflow Inventory (16 files)

| # | Workflow | Triggers | Category |
|---|---------|----------|----------|
| 1 | `actionlint.yml` | PR/push/merge | **Quality Gate** |
| 2 | `architecture.yml` | PR/push (src + deps) | **Quality Gate** |
| 3 | `audit-106.yml` | push main, weekly | **Compliance** |
| 4 | `auto-draft-pr.yml` | push feat/fix | **Automation** |
| 5 | `ci.yml` | push/PR/merge | **Core CI** |
| 6 | `claude.yml` | issue comment | **AI Agent** |
| 7 | `docker.yml` | push main, PR, manual | **Build/Deploy** |
| 8 | `docs.yml` | push main (docs) | **Documentation** |
| 9 | `multi-agent-analysis.yml` | manual | **AI Agent** |
| 10 | `performance.yml` | push/PR/manual | **Performance** |
| 11 | `publish.yml` | release published | **Release** |
| 12 | `release-audit.yml` | release, manual | **Release** |
| 13 | `schema-check.yml` | push/PR (schemas) | **Quality Gate** |
| 14 | `scorecards.yml` | push main, weekly | **Security** |
| 15 | `security.yml` | push/PR, daily | **Security** |
| 16 | `sync-docs.yml` | push main (docs) | **Documentation** |

---

## CI Trigger Matrix

| Event | Workflows That Fire |
|-------|-------------------|
| **PR to main** | ci, actionlint, architecture, performance, schema-check, security |
| **Push to main** | ci, actionlint, architecture, audit-106, docs, docker, performance, schema-check, scorecards, security, sync-docs |
| **Push to feat/** | ci, auto-draft-pr |
| **Release published** | publish, release-audit |
| **Daily schedule** | security |
| **Weekly schedule** | audit-106, scorecards |
| **Manual dispatch** | multi-agent-analysis, docker, performance, release-audit |

---

## Recommendations for Future

1. **Consider merging `schema-check.yml` into CI** — it's a focused path-filtered check that could be a CI job
2. **Consider merging `actionlint.yml` into CI** — single 5-min job that could run as a quick-check
3. **Monitor `audit-106.yml`** — if it duplicates checks already in CI, consider merging
4. **Add status badges** to README for the core workflows: ci, performance, security, scorecards
5. **Pin all 3rd-party actions** by SHA (already done ✅) — maintain during dependency updates
