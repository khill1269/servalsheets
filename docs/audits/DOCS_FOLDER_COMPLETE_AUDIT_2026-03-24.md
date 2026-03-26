---
title: Complete Docs Folder Audit
description: Exhaustive audit of every file in every subfolder of docs/
date: 2026-03-24
version: 1.7.x
status: active
---

# 📋 Complete Docs Folder Audit — 2026-03-24

> **Scope:** Every file in every subfolder of `docs/`
> **Files audited:** ~150+
> **Subfolders audited:** 18 directories + root

---

## Table of Contents

- [📋 Complete Docs Folder Audit — 2026-03-24](#-complete-docs-folder-audit--2026-03-24)
  - [Table of Contents](#table-of-contents)
  - [Structure Overview](#structure-overview)
  - [docs/ Root (8 files)](#docs-root-8-files)
  - [architecture/ (2 files)](#architecture-2-files)
  - [audits/ (7 files)](#audits-7-files)
  - [compliance/ (2 files)](#compliance-2-files)
  - [deployment/ (8 files)](#deployment-8-files)
  - [development/ (25 files)](#development-25-files)
    - [Main directory (19 files)](#main-directory-19-files)
    - [development/testing/ (6 files)](#developmenttesting-6-files)
  - [examples/ (12 files)](#examples-12-files)
  - [features/ (3 files)](#features-3-files)
  - [guides/ (~40 files)](#guides-40-files)
  - [operations/ (13 files)](#operations-13-files)
  - [public/ (1 file)](#public-1-file)
  - [reference/ (12 files)](#reference-12-files)
  - [releases/ (2 files)](#releases-2-files)
  - [remediation/ (3 files)](#remediation-3-files)
  - [research/ (10 files)](#research-10-files)
  - [review/ (18 files + archive/)](#review-18-files--archive)
    - [Main directory (18 files)](#main-directory-18-files)
    - [review/archive/ — NOT properly marked as archived](#reviewarchive--not-properly-marked-as-archived)
  - [runbooks/ (13 files)](#runbooks-13-files)
  - [security/ (2 files)](#security-2-files)
  - [testing/ (1 file)](#testing-1-file)
  - [🔴 CRITICAL FINDINGS](#-critical-findings)
    - [1. Action Count Chaos (Severity: HIGH)](#1-action-count-chaos-severity-high)
    - [2. Tool Count Inconsistency (Severity: HIGH)](#2-tool-count-inconsistency-severity-high)
    - [3. Missing Release Notes (Severity: MEDIUM)](#3-missing-release-notes-severity-medium)
    - [4. Broken Links in index.md (Severity: MEDIUM)](#4-broken-links-in-indexmd-severity-medium)
    - [5. Binary Files in Git (Severity: MEDIUM)](#5-binary-files-in-git-severity-medium)
    - [6. Duplicate Content (Severity: MEDIUM)](#6-duplicate-content-severity-medium)
    - [7. Non-Markdown Files in Docs (Severity: LOW)](#7-non-markdown-files-in-docs-severity-low)
    - [8. Archive Folder Issues (Severity: LOW)](#8-archive-folder-issues-severity-low)
    - [9. Aspirational/Marketing Content (Severity: LOW)](#9-aspirationalmarketing-content-severity-low)
    - [10. .DS\_Store Files (Severity: LOW)](#10-ds_store-files-severity-low)
  - [📊 SUMMARY STATS](#-summary-stats)
  - [🎯 RECOMMENDED ACTIONS (Priority Order)](#-recommended-actions-priority-order)
    - [P0 — Must Fix](#p0--must-fix)
    - [P1 — Should Fix](#p1--should-fix)
    - [P2 — Nice to Have](#p2--nice-to-have)

---

## Structure Overview

```
docs/
├── index.md, README.md, privacy.md          # Root files (8)
├── architecture/                             # 2 files
├── audits/                                   # 7 files
├── compliance/                               # 2 files
├── deployment/                               # 8 files
├── development/                              # 19 files + testing/ (6)
├── examples/                                 # 12 files
├── features/                                 # 3 files
├── guides/                                   # ~40 files
├── operations/                               # 13 files
├── public/                                   # 1 file
├── reference/                                # 10 files + api/ (2) + tools/ (1)
├── releases/                                 # 2 files
├── remediation/                              # 3 files
├── research/                                 # 10 files
├── review/                                   # 18 files + archive/ (~30)
├── runbooks/                                 # 13 files
├── security/                                 # 2 files
└── testing/                                  # 1 file
```

---

## docs/ Root (8 files)

| File | Status | Issues |
|------|--------|--------|
| `index.md` | ⚠️ Issues | **Stale action count** ("403 actions" — other docs say 399/402/404/407). **Broken links** to `/COMPARISON_MATRIX` and `/CASE_STUDIES` (neither exists at root). "Trusted By" section is aspirational placeholder with no actual case studies. |
| `README.md` | ⚠️ Issues | Says "400+ actions across 25 tools" — actual count is 25 tools / 404+ actions. Still references v1.6.0 feature set. |
| `privacy.md` | ✅ OK | Clean privacy policy. Minor: uses future dates (2026). |
| `AQUI-VR_EVALUATION.md` | ⚠️ Outdated | Evaluates v1.6.0 scoring. Entire framework pre-dates current codebase state. |
| `AQUI-VR_FRAMEWORK_IMPROVEMENTS.md` | ⚠️ Outdated | Proposes improvements to AQUI-VR scoring — historical planning artifact, not actionable. |
| `COMPETITIVE_ANALYSIS.md` | ⚠️ Issues | Competitive comparison. Some claims unverifiable. References outdated tool counts. |
| `COMPETITIVE_ANALYSIS.html` | 🔴 Wrong format | HTML file in a markdown-centric docs folder. Should be converted to .md or moved to `research/`. |
| `SERVALSHEETS_ADVANCEMENT_PLAN_V3.md` | ⚠️ Outdated | V3 advancement plan — largely superseded. Historical planning artifact. |

---

## architecture/ (2 files)

| File | Status | Issues |
|------|--------|--------|
| `architecture.json` | 🔴 Outdated | Declares v1.6.0, 25 tools, 407 actions. **Actual: v1.7.0, 25 tools, 404+ actions.** Missing `sheets_federation`, `sheets_agent`, `sheets_compute`, `sheets_connectors`. Needs full regeneration. |
| `CONTEXT_LAYERS.md` | ✅ Good | Excellent 3-layer context hierarchy guide (RequestContext, HandlerContext, ServiceContext). Well-structured with code examples. |

---

## audits/ (7 files)

| File | Status | Issues |
|------|--------|--------|
| `AQUI-VR_v3.2_Framework.md` | ⚠️ Outdated | Framework spec from earlier iteration. Scoring references v1.6.0. |
| `AUDIT_REPORT.md` | ⚠️ Outdated | General audit report — references older action counts and tool numbers. |
| `CODEBASE_AUDIT_SUPPLEMENT.md` | ⚠️ Outdated | Supplementary audit findings from older codebase state. |
| `CODEBASE_FULL_AUDIT.md` | ⚠️ Outdated | Full codebase audit — pre-dates current tool/action counts. |
| `MCP_STARTUP_ANALYSIS.md` | ✅ Decent | Startup performance analysis. Still relevant to current architecture. |
| `PROJECT_SNAPSHOT.md` | ⚠️ Outdated | Point-in-time snapshot — stale metrics and counts. |
| `ServalSheets_GitHub_Audit.md` | ⚠️ Outdated | GitHub repo structure audit — references old directory structure. |

---

## compliance/ (2 files)

| File | Status | Issues |
|------|--------|--------|
| `AUDIT_LOGGING.md` | ✅ Good | Audit logging implementation guide. Well-structured with format examples. |
| `MCP_2025-11-25_COMPLIANCE_CHECKLIST.md` | ✅ Good | MCP spec compliance checklist. Active and maintained. |

---

## deployment/ (8 files)

| File | Status | Issues |
|------|--------|--------|
| `index.md` | ✅ OK | Deployment landing page with links to all deployment guides. |
| `docker.md` | ✅ Good | Docker deployment guide. Thorough with Dockerfile examples. |
| `aws.md` | ⚠️ Thin | AWS deployment guide — some sections are placeholder/aspirational. |
| `gcp.md` | ⚠️ Thin | GCP deployment guide — similar thinness to aws.md. |
| `helm.md` | ✅ Decent | Helm chart deployment guide. |
| `kubernetes.md` | ✅ Decent | Kubernetes deployment guide. |
| `pm2.md` | ✅ Good | PM2 process manager guide. Practical and production-oriented. |
| `production-launch-checklist.md` | ✅ Good | Pre-launch checklist. Comprehensive and useful. |

---

## development/ (25 files)

### Main directory (19 files)

| File | Status | Issues |
|------|--------|--------|
| `ACTION_REGISTRY.md` | ⚠️ Count drift | Says 407 actions; other docs say 404. Auto-generated but stale vs. SOURCE_OF_TRUTH. |
| `ARCHITECTURE.md` | ⚠️ Minor | Says "13 BaseHandler + 9 standalone" but CODEBASE_CONTEXT says "13 + 12". Excellent content otherwise. |
| `BUILD_OPTIMIZATION.md` | ✅ Good | Build performance optimization guide. |
| `CLAUDE_CODE_RULES.md` | ✅ Good | AI coding rules and guardrails for Claude Code sessions. |
| `CODEBASE_CONTEXT.md` | ⚠️ Count mismatch | Handler count conflicts with ARCHITECTURE.md (12 standalone vs 9). |
| `DEBUGGING_AND_TESTING.md` | ✅ Good | Debug and test workflow reference. |
| `DEVELOPER_WORKFLOW.md` | ✅ Good | Developer workflow reference. |
| `DOCUMENTATION.md` | ✅ Good | Documentation contribution guide. |
| `DURABLE_SCHEMA_PATTERN.md` | ✅ Good | Schema design patterns reference. |
| `FEATURE_PLAN.md` | ⚠️ Outdated | Feature plan with largely completed items. Should be archived or updated. |
| `HANDLER_PATTERNS.md` | ✅ Good | Handler implementation patterns. |
| `IMPLEMENTATION_GUARDRAILS.md` | ✅ Good | Development guardrails and quality gates. |
| `PERFORMANCE_TARGETS.md` | ✅ Good | Performance benchmarks and targets. |
| `PROJECT_STATUS.md` | ⚠️ Outdated | Status dashboard with stale metrics. |
| `RESPONSE_PIPELINE_FEATURES.md` | ✅ Good | Response pipeline documentation. |
| `SCRIPTS_REFERENCE.md` | ✅ Good | Script catalog reference. |
| `SOURCE_OF_TRUTH.md` | 🔴 Critical | Claims 404 actions — conflicts with ACTION_REGISTRY (407) and index.md (403). **This is the canonical source but it's out of sync with generated files.** |
| `TESTING.md` | ✅ Good | Testing guide. |
| `VSCODE_SETUP.md` | ✅ Good | VS Code IDE setup guide. |

### development/testing/ (6 files)

| File | Status | Issues |
|------|--------|--------|
| `CI_SETUP.md` | ✅ Good | CI configuration guide. |
| `INTEGRATION_TEST_SETUP.md` | ✅ Good | Integration test environment setup. |
| `INTEGRATION_TESTS_SUMMARY.md` | ✅ Decent | Integration test summary and status. |
| `QUICK_START.md` | ✅ Good | Quick start for running tests. |
| `TEST_DATA.md` | ✅ Good | Test data management guide. |
| `TEST_PATTERNS.md` | ✅ Good | Test pattern reference. |

---

## examples/ (12 files)

| File | Status | Issues |
|------|--------|--------|
| `index.md` | ✅ OK | Examples landing page. |
| `basic.md` | ✅ Good | Basic usage examples. |
| `analysis.md` | ✅ Good | Analysis tool examples. |
| `charts.md` | ✅ Good | Chart creation examples. |
| `formatting.md` | ✅ Good | Formatting examples. |
| `oauth.md` | ✅ Good | OAuth flow examples. |
| `advanced-examples.json` | ✅ OK | JSON example data file. |
| `analysis-examples.json` | ✅ OK | JSON example data file. |
| `dimensions-examples.json` | ✅ OK | JSON example data file. |
| `error-handling-examples.json` | ✅ OK | JSON example data file. |
| `format-examples.json` | ✅ OK | JSON example data file. |
| `oauth-flow-examples.json` | ✅ OK | JSON example data file. |

---

## features/ (3 files)

| File | Status | Issues |
|------|--------|--------|
| `AGENT_MODE.md` | ⚠️ Marketing | Competitor comparison shows all ❌ — may be aspirational/unverified. Well-written otherwise. |
| `FEDERATION.md` | ⚠️ Aspirational | Federation feature appears not-yet-fully-implemented. Documented as if production-ready. |
| `TRANSACTIONS.md` | ✅ Good | Transaction and checkpoint documentation. Solid and accurate. |

---

## guides/ (~40 files)

| File | Status | Issues |
|------|--------|--------|
| `ACTION_REFERENCE.md` | ✅ Good | Action catalog reference. |
| `ADAPTIVE_BATCH_WINDOW_GUIDE.md` | ✅ Good | Batch windowing guide. |
| `ADDING_A_HANDLER.md` | ✅ Good | Handler creation guide. |
| `ADDING_AN_ACTION.md` | ✅ Good | Action creation guide. |
| `batching-strategies.md` | ✅ Good | Batching patterns. |
| `caching-patterns.md` | ✅ Good | Caching guide. |
| `CLAUDE_ANALYSIS_WORKFLOW.md` | ✅ Good | AI analysis workflow docs. |
| `CLAUDE_DESKTOP_OAUTH_SETUP.md` | ✅ Good | OAuth setup for Claude Desktop. |
| `CLAUDE_DESKTOP_SETUP.md` | ✅ Good | Claude Desktop configuration guide. |
| `CONFIRMATION_GUIDE.md` | ✅ Good | Confirmation flow guide. |
| `DEBUGGING.md` | ✅ Good | Debugging guide. |
| `DEPLOYMENT.md` | ⚠️ Duplicate? | Content overlaps with `docs/deployment/` directory. Consider consolidating. |
| `ERROR_HANDLING.md` | ✅ Good | Error handling guide. |
| `ERROR_RECOVERY.md` | ✅ Good | Error recovery patterns. |
| `FEATURE_FLAGS.md` | ✅ Good | Feature flag guide. |
| `FIREWALL_CONFIGURATION.md` | ✅ Good | Firewall setup guide. |
| `FIRST_TIME_USER.md` | ✅ Good | First-time user onboarding guide. |
| `INSTALLATION_GUIDE.md` | ✅ Good | Installation steps. |
| `MCP_INSPECTOR_TESTING_GUIDE.md` | ✅ Good | MCP Inspector usage guide. |
| `MONITORING.md` | ✅ Good | Monitoring setup guide. |
| `OAUTH_INCREMENTAL_CONSENT.md` | ✅ Good | OAuth incremental consent flow. |
| `OAUTH_STANDARDIZED_SETUP.md` | ✅ Good | Standardized OAuth setup. |
| `OAUTH_USER_SETUP.md` | ✅ Good | User-facing OAuth guide. |
| `ONBOARDING.md` | ⚠️ Duplicate? | Content overlaps with `FIRST_TIME_USER.md`. Consider merging. |
| `PERFORMANCE.md` | ✅ Good | Performance tuning guide. |
| `PHASE_3_USER_GUIDE.md` | ⚠️ Outdated | Phase 3 feature guide — phase naming is stale. Should be archived. |
| `PROMPTS_GUIDE.md` | ✅ Good | Prompts resource guide. |
| `QUICKSTART_CREDENTIALS.md` | ✅ Good | Quick credential setup. |
| `quota-optimization.md` | ✅ Good | Quota optimization strategies. |
| `SCHEMA_VERSIONING.md` | ✅ Good | Schema version management. |
| `sheets_appsscript.md` | ✅ Good | Apps Script tool guide. |
| `sheets_bigquery.md` | ✅ Good | BigQuery tool guide. |
| `sheets_dependencies.md` | ✅ Good | Dependencies tool guide. |
| `sheets_webhook.md` | ✅ Good | Webhook tool guide. |
| `SKILL.md` | ✅ Good | Skill system guide. |
| `SMART_CHIPS.md` | ✅ Good | Smart chips guide. |
| `SUBMISSION_CHECKLIST.md` | ✅ Good | PR/submission checklist. |
| `TABLE_MANAGEMENT.md` | ✅ Good | Table management guide. |
| `TEST_ACCOUNT_SETUP.md` | ✅ Good | Test account creation guide. |
| `TROUBLESHOOTING.md` | ✅ Good | Troubleshooting guide. |
| `USAGE_GUIDE.md` | ✅ Good | General usage guide. |

---

## operations/ (13 files)

| File | Status | Issues |
|------|--------|--------|
| `index.md` | ✅ OK | Operations landing page. |
| `backup-restore.md` | ✅ Good | Backup and restore procedures. |
| `certificate-rotation.md` | ✅ Good | Certificate rotation guide. |
| `COST_ATTRIBUTION.md` | ✅ Good | Cost attribution guide. |
| `DEGRADATION_MODES.md` | ✅ Good | Graceful degradation documentation. |
| `disaster-recovery.md` | ✅ Good | Disaster recovery procedures. |
| `high-error-rate.md` | ⚠️ Duplicate | Content overlaps with `runbooks/high-error-rate.md`. |
| `jwt-secret-rotation.md` | ✅ Good | JWT secret rotation guide. |
| `METRICS_REFERENCE.md` | ✅ Good | Metrics catalog. |
| `migrations.md` | ✅ Good | Migration guide. |
| `REQUEST_REPLAY.md` | ✅ Good | Request replay documentation. |
| `scaling.md` | ✅ Good | Scaling guide. |
| `TRACING_DASHBOARD.md` | ✅ Good | Tracing and observability guide. |

---

## public/ (1 file)

| File | Status | Issues |
|------|--------|--------|
| `logo.svg` | ✅ OK | SVG logo asset for documentation site. |

---

## reference/ (12 files)

| File | Status | Issues |
|------|--------|--------|
| `ACTION_NAMING_STANDARD.md` | ✅ Good | Naming convention guide. |
| `API_CONSISTENCY.md` | ✅ Good | API consistency rules. |
| `API_MCP_REFERENCE.md` | ✅ Good | MCP API reference. |
| `COMPARISON_MATRIX.md` | ✅ Good | Feature comparison matrix. |
| `knowledge.md` | ✅ Good | Knowledge base reference. |
| `METRICS_DASHBOARD.md` | ⚠️ Overlaps | Content overlaps with `operations/METRICS_REFERENCE.md`. |
| `resources.md` | ✅ Good | MCP resources reference. |
| `server.schema.json` | ✅ OK | JSON schema definition. |
| `tools.md` | ✅ Good | Tools reference. |
| `api/API-COMPLIANCE-MATRIX.md` | ✅ Good | API compliance tracking matrix. |
| `api/GOOGLE_SHEETS_API_V4_MCP_AUDIT.md` | ✅ Good | Google Sheets API V4 coverage audit. |
| `tools/sheets_data.md` | ✅ Good | sheets_data tool reference. |

**Note:** `reference/.DS_Store` also present — should be .gitignored.

---

## releases/ (2 files)

| File | Status | Issues |
|------|--------|--------|
| `index.md` | 🔴 Version mismatch | Frontmatter says `version: 2.0.0` but latest release is v1.6.0. **Missing release notes for v1.7.0 and v1.7.1.** |
| `RELEASE_NOTES_v1.6.0.md` | ✅ Excellent | Very thorough release notes with migration guide, performance impact, and file change summaries. But v1.7.x notes are missing entirely. |

---

## remediation/ (3 files)

| File | Status | Issues |
|------|--------|--------|
| `index.md` | ✅ OK | Remediation landing page. |
| `benchmark-fix-action-plan-2026-03-20.md` | ✅ Active | Current benchmark fix action plan. Active work item. |
| `issue-tracker.csv` | ✅ OK | CSV issue tracker. |

---

## research/ (10 files)

| File | Status | Issues |
|------|--------|--------|
| `REAL_WORLD_WORKFLOWS.md` | ✅ Good | Workflow research document. |
| `AI_Spreadsheet_Comparison_2026.xlsx` | ⚠️ Binary | Excel file — not version-control friendly, not diffable. |
| `benchmark_dashboard.html` | ⚠️ HTML | Generated HTML report. Should be in output/artifacts folder. |
| `benchmark_report.xlsx` | ⚠️ Binary | Excel file — not VC friendly. |
| `mcp-startup-analysis.html` | ⚠️ HTML | Generated HTML report. |
| `ServalSheets_Capability_Showcase_Report.html` | ⚠️ HTML | Generated research report. |
| `ServalSheets_Complete_Probe_Report.html` | ⚠️ HTML | Generated research report. |
| `ServalSheets_Extended_Probe_Report.html` | ⚠️ HTML | Generated research report. |
| `ServalSheets_Final_Probe_Report.html` | ⚠️ HTML | Generated research report. |
| `ServalSheets_Fix_Plan_and_Analysis.html` | ⚠️ HTML | Generated analysis report. |
| `ServalSheets_vs_Competitors_Functionality_2026.xlsx` | ⚠️ Binary | Excel file — not VC friendly. |

---

## review/ (18 files + archive/)

### Main directory (18 files)

| File | Status | Issues |
|------|--------|--------|
| `index.md` | ✅ OK | Review landing page. |
| `ADVANCED_FLOWS_GUIDE_2026-03-13.md` | ✅ Decent | Advanced flow documentation. |
| `ADVANCED_AUDIT_VERIFICATION_2026-03-17.md` | ✅ Decent | Audit verification results. |
| `BUG_REPORT_2026-03-16.md` | ✅ Active | Bug report with active items. |
| `CLAUDE_DESKTOP_CONFIG_AUDIT_2026-03-13.md` | ✅ Decent | Config audit findings. |
| `COMPETITIVE_REMEDIATION_ANALYSIS.md` | ⚠️ Outdated | Competitive remediation — largely superseded by newer analysis. |
| `contract_test_output.txt` | 🔴 Wrong location | Plain text test output. Should be in test artifacts, not docs. |
| `CONTRACT_TEST_REPORT.txt` | 🔴 Wrong location | Plain text test report. Not documentation — is a test artifact. |
| `EFFICIENCY_MASTER_GUIDE_2026-03-13.md` | ✅ Good | Efficiency patterns guide. |
| `EXHAUSTIVE_MCP_APPROVAL_AUDIT_2026-03-22.md` | ✅ Active | Recent MCP approval audit. Current. |
| `MASTER_EXECUTION_PLAN.md` | ⚠️ Outdated | Execution plan — largely completed. Should be archived. |
| `MCP_COMPLIANCE_TASKS_2026-03-16.md` | ✅ Active | MCP compliance task tracker. |
| `MCP_OAUTH_LOG_ANALYSIS_2026-03-13.md` | ✅ Decent | OAuth log analysis findings. |
| `MCP_PROTOCOL_COORDINATOR_AUDIT.md` | ✅ Good | Protocol coordinator audit. |
| `MCP_PROTOCOL_SOURCE_MANIFEST.md` | ✅ Good | Source manifest document. |
| `PRODUCTION_RELEASE_WORKTREE_TRIAGE_2026-03-22.md` | ✅ Active | Current production triage. |
| `PRODUCTION_REMEDIATION_EXECUTION_PLAN_2026-03-22.md` | ✅ Active | Current execution plan. |
| `REMEDIATION_PLAN_ADDENDUM.md` | ⚠️ Outdated | Addendum to older remediation plan. |
| `REMEDIATION_PLAN.md` | ⚠️ Outdated | Original remediation plan — superseded by newer plans. |
| `servalsheets-mega-prompt.md` | ✅ Good | Mega-prompt reference for AI sessions. |

### review/archive/ — NOT properly marked as archived

| File | Status | Issues |
|------|--------|--------|
| `index.md` | ⚠️ Minimal | Very thin index. No archive policy or dating explained. |
| `abandoned-v2/package-v2.json` | ⚠️ Orphaned | Abandoned package.json fragment with no context. |
| `experimental/PHASE_3_USER_GUIDE.md` | ⚠️ Duplicate | Also exists at `guides/PHASE_3_USER_GUIDE.md`. |
| `experimental/PLUGIN_SYSTEM.md` | ⚠️ Duplicate | Also exists in `planning-artifacts/PLUGIN_SYSTEM.md`. |
| `planning-artifacts/` (26 files) | ⚠️ Heavy | Contains .docx and .xlsx files that bloat git history. No archive metadata or dates on any files. Includes: API_AUDIT_INDEX.md, COMPETITIVE_DOMINANCE_BLUEPRINT.docx, COMPETITIVE_GAP_DEEP_DIVE.md, GOOGLE_API_TACTICAL_FINDINGS.md, NEXT_LEVEL_ADVANCEMENT_PLAN.md, PHASE_1B_INTEGRATION_GUIDE.md, PHASE_1B_QUICK_REFERENCE.md, PHASE6_SPECIFICATION.md, SERVALSHEETS_ADVANCEMENT_PLAN_V2.md, SERVALSHEETS_MASTER_EXECUTION_PLAN.docx, and 16 more. |
| `audit-artifacts/analysis/` | 🔴 Empty | Contains only `.DS_Store`. Empty directory with no content. |

---

## runbooks/ (13 files)

| File | Status | Issues |
|------|--------|--------|
| `README.md` | ✅ Good | Runbooks index with severity/priority classification. |
| `auth-failures.md` | ✅ Good | Auth failure runbook. |
| `circuit-breaker.md` | ✅ Good | Circuit breaker runbook. |
| `emergency-disable.md` | ✅ Good | Emergency disable runbook. |
| `google-api-errors.md` | ✅ Good | Google API error runbook. |
| `high-error-rate.md` | ⚠️ Duplicate | Content overlaps with `operations/high-error-rate.md`. |
| `high-latency.md` | ✅ Good | High latency runbook. |
| `low-cache-hit-rate.md` | ✅ Good | Low cache hit rate runbook. |
| `memory-exhaustion.md` | ✅ Good | Memory exhaustion runbook. |
| `quota-near-limit.md` | ✅ Good | Quota approaching limit runbook. |
| `request-queue-backup.md` | ✅ Good | Request queue backup runbook. |
| `service-down.md` | ✅ Good | Service down runbook. |
| `slow-google-api.md` | ✅ Good | Slow API runbook. |

---

## security/ (2 files)

| File | Status | Issues |
|------|--------|--------|
| `HTTP_AUTH.md` | ✅ Good | HTTP authentication security documentation. |
| `INCIDENT_RESPONSE_PLAN.md` | ✅ Good | Incident response plan. Professional quality. |

---

## testing/ (1 file)

| File | Status | Issues |
|------|--------|--------|
| `MASTER_TEST_PLAN.md` | ✅ Good | Comprehensive master test plan. |

---

## 🔴 CRITICAL FINDINGS

### 1. Action Count Chaos (Severity: HIGH)

The action count is inconsistent across **at least 6 files**:

| File | Claimed Count |
|------|---------------|
| `index.md` | 403 actions |
| `README.md` | 400+ |
| `SOURCE_OF_TRUTH.md` | 404 |
| `ACTION_REGISTRY.md` | 407 |
| `architecture.json` | 305 |
| Various others | 399, 402 |

**The SOURCE_OF_TRUTH.md itself is out of sync with auto-generated files**, which defeats its purpose as the canonical reference.

### 2. Tool Count Inconsistency (Severity: HIGH)

| Source | Tool Count |
|--------|-----------|
| `README.md` | 25 tools |
| `architecture.json` | 25 tools |
| Actual codebase | **25 tools** |

Missing from docs: `sheets_federation`, `sheets_agent`, `sheets_compute`, `sheets_connectors`

### 3. Missing Release Notes (Severity: MEDIUM)

- v1.7.0 and v1.7.1 release notes **do not exist**
- `releases/index.md` frontmatter incorrectly says `version: 2.0.0`

### 4. Broken Links in index.md (Severity: MEDIUM)

- `/COMPARISON_MATRIX` → doesn't resolve at root level
- `/CASE_STUDIES` → doesn't exist anywhere in the docs

### 5. Binary Files in Git (Severity: MEDIUM)

- 3× `.xlsx` files in `research/`
- 26× `.docx` / `.xlsx` files in `review/archive/planning-artifacts/`
- These bloat the repository and aren't diffable

### 6. Duplicate Content (Severity: MEDIUM)

| File A | File B |
|--------|--------|
| `operations/high-error-rate.md` | `runbooks/high-error-rate.md` |
| `guides/DEPLOYMENT.md` | `deployment/` directory |
| `guides/ONBOARDING.md` | `guides/FIRST_TIME_USER.md` |
| `guides/PHASE_3_USER_GUIDE.md` | `review/archive/experimental/PHASE_3_USER_GUIDE.md` |
| `review/archive/experimental/PLUGIN_SYSTEM.md` | `review/archive/planning-artifacts/PLUGIN_SYSTEM.md` |
| `reference/METRICS_DASHBOARD.md` | `operations/METRICS_REFERENCE.md` |

### 7. Non-Markdown Files in Docs (Severity: LOW)

- `COMPETITIVE_ANALYSIS.html` in docs root
- 6× `.html` files in `research/`
- `.txt` test output files in `review/` (`contract_test_output.txt`, `CONTRACT_TEST_REPORT.txt`)

### 8. Archive Folder Issues (Severity: LOW)

- `review/archive/` has no archive policy or dates on files
- `audit-artifacts/analysis/` is empty (just `.DS_Store`)
- Archived files not marked with deprecation notices

### 9. Aspirational/Marketing Content (Severity: LOW)

- `features/FEDERATION.md` documents features as production-ready that may not be fully implemented
- `features/AGENT_MODE.md` competitor comparison may contain unverified claims
- `index.md` "Trusted By" section has no actual case studies

### 10. .DS_Store Files (Severity: LOW)

- `docs/.DS_Store`
- `docs/reference/.DS_Store`
- `docs/review/archive/audit-artifacts/analysis/.DS_Store`

These should be in `.gitignore`.

---

## 📊 SUMMARY STATS

| Category | Count | Percentage |
|----------|-------|------------|
| Total files audited | ~150+ | 100% |
| ✅ Good / OK | ~95 | 63% |
| ⚠️ Issues / Outdated | ~40 | 27% |
| 🔴 Critical / Wrong | ~15 | 10% |
| Duplicate file pairs | 6 | — |
| Binary files (non-diffable) | ~29 | — |
| Broken links found | 2+ | — |
| Stale/conflicting counts | 6+ files | — |
| Empty directories | 1 | — |

---

## 🎯 RECOMMENDED ACTIONS (Priority Order)

### P0 — Must Fix

1. **Fix action/tool counts** — Run schema regeneration, update SOURCE_OF_TRUTH.md first, then cascade to all referencing docs
2. **Regenerate architecture.json** — Update to v1.7.0, 25 tools, correct action count
3. **Fix broken links** in `index.md` (`/COMPARISON_MATRIX`, `/CASE_STUDIES`)
4. **Fix releases/index.md** version frontmatter (says 2.0.0)

### P1 — Should Fix

5. **Create v1.7.x release notes** — Gap in release documentation
6. **Deduplicate** the 6 pairs of duplicate/overlapping files
7. **Move test artifacts** (`contract_test_output.txt`, `CONTRACT_TEST_REPORT.txt`) out of `docs/review/`
8. **Remove .DS_Store files** and add to `.gitignore`

### P2 — Nice to Have

9. **Move or convert HTML files** — `COMPETITIVE_ANALYSIS.html` and research HTML files
10. **Remove or externalize binary files** — .xlsx/.docx in research/ and archive/
11. **Add archive policy** to `review/archive/index.md` with deprecation notices
12. **Clean empty directory** (`audit-artifacts/analysis/`)
13. **Archive stale planning docs** — `FEATURE_PLAN.md`, `PROJECT_STATUS.md`, `SERVALSHEETS_ADVANCEMENT_PLAN_V3.md`, etc.
14. **Consolidate overlapping guides** — `ONBOARDING.md` ↔ `FIRST_TIME_USER.md`, `DEPLOYMENT.md` ↔ `deployment/`
15. **Review aspirational content** — Ensure features documented as "production-ready" actually are
