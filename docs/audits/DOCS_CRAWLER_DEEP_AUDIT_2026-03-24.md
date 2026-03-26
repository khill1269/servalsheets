---
title: Docs Crawler Deep Audit
date: 2026-03-24
status: active
generated: true
---

# 🕷️ Docs Crawler Deep Audit Report

> Generated: 2026-03-24T07:47:31.020Z

## 📊 Overview

| Metric | Value |
|--------|-------|
| Total files | 620 |
| Total directories | 47 |
| Total size | 28.8 MB |
| Total lines | 151,442 |
| Total words | 1,272,435 |
| Total issues | 268 |
| Duplicate groups | 0 |
| TODO markers | 225 |
| Binary files | 22 |
| Empty/near-empty | 0 |

## 📂 File Categories

| Category | Count |
|----------|-------|
| other | 273 |
| markdown | 179 |
| web | 133 |
| binary | 20 |
| data | 11 |
| image | 2 |
| text | 2 |

## 📁 Subfolder Analysis

| Subfolder | Files | Size | Markdown | Issues |
|-----------|-------|------|----------|--------|
| `.vitepress` | 400 | 24.9 MB | 0 | 125 |
| `review` | 50 | 1.2 MB | 30 | 34 |
| `guides` | 41 | 678.4 KB | 41 | 15 |
| `development` | 25 | 398.9 KB | 25 | 28 |
| `operations` | 13 | 138.3 KB | 13 | 7 |
| `runbooks` | 13 | 85.5 KB | 13 | 6 |
| `examples` | 12 | 126.4 KB | 6 | 0 |
| `reference` | 12 | 164.6 KB | 11 | 2 |
| `research` | 11 | 503.7 KB | 1 | 11 |
| `(root)` | 8 | 145.7 KB | 7 | 17 |
| `audits` | 8 | 216.7 KB | 8 | 7 |
| `deployment` | 8 | 75.0 KB | 8 | 11 |
| `security` | 5 | 85.7 KB | 5 | 0 |
| `features` | 3 | 33.0 KB | 3 | 3 |
| `remediation` | 3 | 15.4 KB | 2 | 1 |
| `architecture` | 2 | 24.1 KB | 1 | 0 |
| `compliance` | 2 | 37.6 KB | 2 | 0 |
| `releases` | 2 | 9.4 KB | 2 | 0 |
| `public` | 1 | 6 B | 0 | 0 |
| `testing` | 1 | 43.5 KB | 1 | 1 |

## 🚨 Issues Summary

| Count | Severity |
|-------|----------|
| 2 | 🔴 CRITICAL |

| Count | Severity |
|-------|----------|
| 108 | 🟡 MEDIUM |

| Count | Severity |
|-------|----------|
| 158 | 🔵 LOW |

### Issues by Category

| Category | Count |
|----------|-------|
| wrong-format | 135 |
| broken-link | 88 |
| missing-frontmatter | 23 |
| binary-in-docs | 20 |
| count-inconsistency | 2 |

## 🔴 Critical & High Issues

### 🔴 [CRITICAL] count-inconsistency
- **File:** `(cross-file)`
- **Message:** Action count inconsistency: found values 100, 207, 291, 299, 300, 302, 305, 335, 340, 342, 370, 391, 399, 400, 401, 402, 403, 404, 407, 408 across 139 references
- **Suggestion:** Run schema regeneration and update all docs to match SOURCE_OF_TRUTH.md

### 🔴 [CRITICAL] count-inconsistency
- **File:** `(cross-file)`
- **Message:** Tool count inconsistency: found values 12, 13, 15, 16, 17, 21, 22, 23, 25 across 181 references
- **Suggestion:** Update all docs to reflect actual tool count from codebase

## 🟡 Medium Issues

| File | Category | Message |
|------|----------|---------|
| `README.md` | broken-link | Broken internal link: ./analysis/00_QUICKSTART.md |
| `README.md` | broken-link | Broken internal link: ./analysis/01_FUNCTIONAL.md |
| `README.md` | broken-link | Broken internal link: ./analysis/02_PROTOCOL.md |
| `README.md` | broken-link | Broken internal link: ./analysis/03_CODE_QUALITY.md |
| `README.md` | broken-link | Broken internal link: ./analysis/04_DEEP_TECHNICAL.md |
| `README.md` | broken-link | Broken internal link: ./analysis/05_EXCELLENCE.md |
| `README.md` | broken-link | Broken internal link: ./analysis/06_EXECUTION.md |
| `README.md` | broken-link | Broken internal link: ./analysis/07_SCORING.md |
| `README.md` | broken-link | Broken internal link: ./analysis/agent-prompts/ |
| `README.md` | broken-link | Broken internal link: ./COMPARISON_MATRIX.md |
| `README.md` | broken-link | Broken internal link: ./CASE_STUDIES.md |
| `README.md` | broken-link | Broken internal link: ../SKILL.md |
| `deployment/aws.md` | broken-link | Broken internal link: ./monitoring |
| `deployment/docker.md` | broken-link | Broken internal link: ./monitoring |
| `deployment/gcp.md` | broken-link | Broken internal link: ./monitoring |
| `deployment/helm.md` | broken-link | Broken internal link: ./monitoring |
| `deployment/index.md` | broken-link | Broken internal link: ./monitoring |
| `deployment/kubernetes.md` | broken-link | Broken internal link: ./monitoring |
| `deployment/production-launch-checklist.md` | broken-link | Broken internal link: /Users/thomascahill/Documents/servalsheets%202/docs/runboo |
| `deployment/production-launch-checklist.md` | broken-link | Broken internal link: /Users/thomascahill/Documents/servalsheets%202/docs/runboo |
| `deployment/production-launch-checklist.md` | broken-link | Broken internal link: /Users/thomascahill/Documents/servalsheets%202/docs/runboo |
| `deployment/production-launch-checklist.md` | broken-link | Broken internal link: /Users/thomascahill/Documents/servalsheets%202/docs/runboo |
| `deployment/production-launch-checklist.md` | broken-link | Broken internal link: /Users/thomascahill/Documents/servalsheets%202/docs/securi |
| `development/CLAUDE_CODE_RULES.md` | broken-link | Broken internal link: ../../AGENTS.md |
| `development/DEBUGGING_AND_TESTING.md` | broken-link | Broken internal link: ./architecture-diagrams.md |
| `development/DEBUGGING_AND_TESTING.md` | broken-link | Broken internal link: ./DEVELOPMENT_LOG.md |
| `development/DEVELOPER_WORKFLOW.md` | broken-link | Broken internal link: ./AUDIT_REPORT_2026-01-11.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./PERFORMANCE.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./MONITORING.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./DEPLOYMENT.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./TROUBLESHOOTING.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ../MCP_2025-11-25_COMPLIANCE_CHECKLIST.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./COMPREHENSIVE_ANALYSIS_REPORT.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./DOCUMENTATION_IMPROVEMENTS.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./PROJECT_AUDIT_REPORT.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./VERIFICATION_REPORT.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ../MCP_2025-11-25_COMPLIANCE_CHECKLIST.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./USAGE_GUIDE.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./QUICKSTART_CREDENTIALS.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./CLAUDE_DESKTOP_SETUP.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./TROUBLESHOOTING.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./DEPLOYMENT.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./PERFORMANCE.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./MONITORING.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./TROUBLESHOOTING.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./TROUBLESHOOTING.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./USAGE_GUIDE.md |
| `development/DOCUMENTATION.md` | broken-link | Broken internal link: ./TROUBLESHOOTING.md |
| `development/PERFORMANCE_TARGETS.md` | broken-link | Broken internal link: ./OPTIMIZATION_IMPLEMENTATION_PLAN.md |
| `development/PROJECT_STATUS.md` | broken-link | Broken internal link: /docs/CHANGELOG.md |
| `development/testing/QUICK_START.md` | broken-link | Broken internal link: ./helpers/README.md |
| `guides/ADAPTIVE_BATCH_WINDOW_GUIDE.md` | broken-link | Broken internal link: ../ADAPTIVE_BATCH_WINDOW_IMPLEMENTATION.md |
| `guides/ADAPTIVE_BATCH_WINDOW_GUIDE.md` | broken-link | Broken internal link: ../../scripts/benchmark-adaptive-window.ts |
| `guides/ADDING_A_HANDLER.md` | broken-link | Broken internal link: ../development/TYPESCRIPT_ERROR_GUIDE.md |
| `guides/ERROR_HANDLING.md` | broken-link | Broken internal link: error-recovery.md |
| `guides/ERROR_HANDLING.md` | broken-link | Broken internal link: ./CIRCUIT_BREAKER.md |
| `guides/ERROR_HANDLING.md` | broken-link | Broken internal link: ./RATE_LIMITING.md |
| `guides/ERROR_HANDLING.md` | broken-link | Broken internal link: ./CIRCUIT_BREAKER.md |
| `guides/INSTALLATION_GUIDE.md` | broken-link | Broken internal link: ./RELEASE_NOTES_v1.6.0.md |
| `guides/OAUTH_USER_SETUP.md` | broken-link | Broken internal link: ./PRODUCTION_DEPLOYMENT_GUIDE.md |
| `guides/ONBOARDING.md` | broken-link | Broken internal link: ../development/TYPESCRIPT_ERROR_GUIDE.md |
| `guides/ONBOARDING.md` | broken-link | Broken internal link: ../development/TYPESCRIPT_ERROR_GUIDE.md |
| `guides/ONBOARDING.md` | broken-link | Broken internal link: ../development/SCHEMA_DESIGN.md |
| `guides/SCHEMA_VERSIONING.md` | broken-link | Broken internal link: ./docs/migration/v1-to-v2.md |
| `guides/USAGE_GUIDE.md` | broken-link | Broken internal link: ../MCP_2025-11-25_COMPLIANCE_CHECKLIST.md |
| `guides/sheets_webhook.md` | broken-link | Broken internal link: ../../src/handlers/webhook.ts |
| `index.md` | broken-link | Broken internal link: /COMPARISON_MATRIX |
| `index.md` | broken-link | Broken internal link: /CASE_STUDIES |
| `operations/DEGRADATION_MODES.md` | broken-link | Broken internal link: ../knowledge/api/error-handling.md |
| `operations/DEGRADATION_MODES.md` | broken-link | Broken internal link: ../development/CONFIGURATION.md |
| `operations/DEGRADATION_MODES.md` | broken-link | Broken internal link: ../deployment/MONITORING.md |
| `operations/REQUEST_REPLAY.md` | broken-link | Broken internal link: ../development/TESTING_STRATEGY.md |
| `operations/REQUEST_REPLAY.md` | broken-link | Broken internal link: ../development/PERFORMANCE.md |
| `operations/high-error-rate.md` | broken-link | Broken internal link: ../guides/RATE_LIMITING.md |
| `operations/high-error-rate.md` | broken-link | Broken internal link: ../guides/CIRCUIT_BREAKER.md |
| `reference/tools/sheets_data.md` | broken-link | Broken internal link: /reference/tools/sheets_format |
| `reference/tools/sheets_data.md` | broken-link | Broken internal link: /reference/tools/sheets_core |
| `remediation/benchmark-fix-action-plan-2026-03-20.md` | broken-link | Broken internal link: ../../AQUI-VR_v3.2_Framework.md |
| `research/AI_Spreadsheet_Comparison_2026.xlsx` | binary-in-docs | Binary file (.xlsx) in docs/ — not version-control friendly |
| `research/ServalSheets_vs_Competitors_Functionality_2026.xlsx` | binary-in-docs | Binary file (.xlsx) in docs/ — not version-control friendly |
| `research/benchmark_report.xlsx` | binary-in-docs | Binary file (.xlsx) in docs/ — not version-control friendly |
| `review/archive/experimental/PHASE_3_USER_GUIDE.md` | broken-link | Broken internal link: ../../../guides/GRAPHQL_API.md |
| `review/archive/planning-artifacts/API_AUDIT_INDEX.md` | broken-link | Broken internal link: ./AUDIT_SUMMARY.txt |
| `review/archive/planning-artifacts/API_AUDIT_INDEX.md` | broken-link | Broken internal link: ./GOOGLE_API_ANALYSIS.md |
| `review/archive/planning-artifacts/API_AUDIT_INDEX.md` | broken-link | Broken internal link: ./AUDIT_SUMMARY.txt |
| `review/archive/planning-artifacts/AQUI_Framework_Research_Report.docx` | binary-in-docs | Binary file (.docx) in docs/ — not version-control friendly |
| `review/archive/planning-artifacts/AQUI_Implementation_Mapping.docx` | binary-in-docs | Binary file (.docx) in docs/ — not version-control friendly |
| `review/archive/planning-artifacts/AQUI_MCP_Enhancement_Analysis.docx` | binary-in-docs | Binary file (.docx) in docs/ — not version-control friendly |
| `review/archive/planning-artifacts/AQUI_VR_Final_Specification.docx` | binary-in-docs | Binary file (.docx) in docs/ — not version-control friendly |
| `review/archive/planning-artifacts/AQUI_VR_Implementation_Spec.docx` | binary-in-docs | Binary file (.docx) in docs/ — not version-control friendly |
| `review/archive/planning-artifacts/AQUI_VR_MCP_Scoring_Matrix.xlsx` | binary-in-docs | Binary file (.xlsx) in docs/ — not version-control friendly |
| `review/archive/planning-artifacts/AQUI_VR_MCP_Scoring_Matrix2.xlsx` | binary-in-docs | Binary file (.xlsx) in docs/ — not version-control friendly |
| `review/archive/planning-artifacts/COMPETITIVE_DOMINANCE_BLUEPRINT.docx` | binary-in-docs | Binary file (.docx) in docs/ — not version-control friendly |
| `review/archive/planning-artifacts/LUSAREP_UASEVR_Integration_Strategy.docx` | binary-in-docs | Binary file (.docx) in docs/ — not version-control friendly |
| `review/archive/planning-artifacts/SERVALSHEETS_MASTER_EXECUTION_PLAN.docx` | binary-in-docs | Binary file (.docx) in docs/ — not version-control friendly |
| `review/archive/planning-artifacts/ServalSheets_Competitive_Analysis.docx` | binary-in-docs | Binary file (.docx) in docs/ — not version-control friendly |
| `review/archive/planning-artifacts/ServalSheets_Competitive_Analysis_SourceCode.docx` | binary-in-docs | Binary file (.docx) in docs/ — not version-control friendly |
| `review/archive/planning-artifacts/ServalSheets_Enhanced_Implementation_Plan.docx` | binary-in-docs | Binary file (.docx) in docs/ — not version-control friendly |
| `review/archive/planning-artifacts/ServalSheets_GTM_Strategy.docx` | binary-in-docs | Binary file (.docx) in docs/ — not version-control friendly |
| `review/archive/planning-artifacts/ServalSheets_Implementation_Plan.docx` | binary-in-docs | Binary file (.docx) in docs/ — not version-control friendly |
| `review/archive/planning-artifacts/ServalSheets_LUSAREP_Analysis.docx` | binary-in-docs | Binary file (.docx) in docs/ — not version-control friendly |
| `review/archive/planning-artifacts/ServalSheets_Unicorn_Strategy.docx` | binary-in-docs | Binary file (.docx) in docs/ — not version-control friendly |
| `runbooks/README.md` | broken-link | Broken internal link: ./slo-availability.md |
| `runbooks/README.md` | broken-link | Broken internal link: ./slo-latency.md |
| `runbooks/README.md` | broken-link | Broken internal link: ./slo-errors.md |
| `runbooks/README.md` | broken-link | Broken internal link: ./slo-google-api.md |
| `runbooks/README.md` | broken-link | Broken internal link: ./slo-cache.md |
| `runbooks/README.md` | broken-link | Broken internal link: ./error-budget.md |

## 🔢 Action Count Cross-Reference

| Count | References |
|-------|------------|
| **100** | features/TRANSACTIONS.md:314 |
| **207** | development/SCRIPTS_REFERENCE.md:501 |
| **291** | guides/ACTION_REFERENCE.md:97, guides/USAGE_GUIDE.md:42, review/MCP_PROTOCOL_COORDINATOR_AUDIT.md:24 |
| **299** | development/SCRIPTS_REFERENCE.md:1376 |
| **300** | guides/ADDING_AN_ACTION.md:274, guides/ADDING_AN_ACTION.md:518, guides/ADDING_AN_ACTION.md:548 |
| **302** | guides/ADDING_A_HANDLER.md:450 |
| **305** | audits/DOCS_FOLDER_COMPLETE_AUDIT_2026-03-24.md:110 |
| **335** | development/CODEBASE_CONTEXT.md:492, development/FEATURE_PLAN.md:25 |
| **340** | development/CODEBASE_CONTEXT.md:533, development/CODEBASE_CONTEXT.md:537 |
| **342** | audits/AQUI-VR_v3.2_Framework.md:127, review/archive/planning-artifacts/API_AUDIT_INDEX.md:13, review/archive/planning-artifacts/API_AUDIT_INDEX.md:108, review/archive/planning-artifacts/API_AUDIT_INDEX.md:123, review/archive/planning-artifacts/API_AUDIT_INDEX.md:140, review/archive/planning-artifacts/COMPETITIVE_GAP_DEEP_DIVE.md:5, review/archive/planning-artifacts/COMPETITIVE_GAP_DEEP_DIVE.md:12, review/archive/planning-artifacts/COMPETITIVE_GAP_DEEP_DIVE.md:93, review/archive/planning-artifacts/COMPETITIVE_GAP_DEEP_DIVE.md:781, review/archive/planning-artifacts/GOOGLE_API_TACTICAL_FINDINGS.md:527, review/archive/planning-artifacts/GOOGLE_API_TACTICAL_FINDINGS.md:537 |
| **370** | review/archive/planning-artifacts/COMPETITIVE_GAP_DEEP_DIVE.md:781 |
| **391** | SERVALSHEETS_ADVANCEMENT_PLAN_V3.md:180 |
| **399** | SERVALSHEETS_ADVANCEMENT_PLAN_V3.md:180, audits/PROJECT_SNAPSHOT.md:15, audits/PROJECT_SNAPSHOT.md:22, review/archive/planning-artifacts/SERVALSHEETS_ADVANCEMENT_PLAN_V2.md:145 |
| **400** | SERVALSHEETS_ADVANCEMENT_PLAN_V3.md:203 |
| **401** | SERVALSHEETS_ADVANCEMENT_PLAN_V3.md:214 |
| **402** | AQUI-VR_EVALUATION.md:14, AQUI-VR_EVALUATION.md:207, AQUI-VR_EVALUATION.md:223, COMPETITIVE_ANALYSIS.md:15, SERVALSHEETS_ADVANCEMENT_PLAN_V3.md:30, audits/AQUI-VR_v3.2_Framework.md:147, audits/AQUI-VR_v3.2_Framework.md:151, audits/AQUI-VR_v3.2_Framework.md:266, audits/AQUI-VR_v3.2_Framework.md:270, audits/AQUI-VR_v3.2_Framework.md:360, audits/AQUI-VR_v3.2_Framework.md:363, audits/AQUI-VR_v3.2_Framework.md:553, audits/MCP_STARTUP_ANALYSIS.md:284, reference/ACTION_NAMING_STANDARD.md:13, reference/ACTION_NAMING_STANDARD.md:19, reference/ACTION_NAMING_STANDARD.md:109, reference/API_MCP_REFERENCE.md:817, reference/API_MCP_REFERENCE.md:898, reference/API_MCP_REFERENCE.md:904, reference/COMPARISON_MATRIX.md:44, reference/COMPARISON_MATRIX.md:186, reference/COMPARISON_MATRIX.md:213, reference/COMPARISON_MATRIX.md:259, reference/api/API-COMPLIANCE-MATRIX.md:275, reference/api/GOOGLE_SHEETS_API_V4_MCP_AUDIT.md:277, reference/api/GOOGLE_SHEETS_API_V4_MCP_AUDIT.md:301, reference/api/GOOGLE_SHEETS_API_V4_MCP_AUDIT.md:329, reference/api/GOOGLE_SHEETS_API_V4_MCP_AUDIT.md:422, reference/api/GOOGLE_SHEETS_API_V4_MCP_AUDIT.md:423, reference/api/GOOGLE_SHEETS_API_V4_MCP_AUDIT.md:454, reference/api/GOOGLE_SHEETS_API_V4_MCP_AUDIT.md:457, review/ADVANCED_AUDIT_VERIFICATION_2026-03-17.md:30, review/ADVANCED_AUDIT_VERIFICATION_2026-03-17.md:31, review/EFFICIENCY_MASTER_GUIDE_2026-03-13.md:614, review/archive/planning-artifacts/NEXT_LEVEL_ADVANCEMENT_PLAN.md:13, review/archive/planning-artifacts/NEXT_LEVEL_ADVANCEMENT_PLAN.md:38, review/archive/planning-artifacts/NEXT_LEVEL_ADVANCEMENT_PLAN.md:248, review/archive/planning-artifacts/NEXT_LEVEL_ADVANCEMENT_PLAN.md:248, review/archive/planning-artifacts/NEXT_LEVEL_ADVANCEMENT_PLAN.md:268, review/archive/planning-artifacts/SERVALSHEETS_ADVANCEMENT_PLAN_V2.md:12, review/archive/planning-artifacts/SERVALSHEETS_ADVANCEMENT_PLAN_V2.md:82, review/archive/planning-artifacts/SERVALSHEETS_ADVANCEMENT_PLAN_V2.md:270, review/servalsheets-mega-prompt.md:324 |
| **403** | audits/AQUI-VR_v3.2_Framework.md:151, audits/AQUI-VR_v3.2_Framework.md:270, audits/AQUI-VR_v3.2_Framework.md:360, audits/AQUI-VR_v3.2_Framework.md:363, audits/AQUI-VR_v3.2_Framework.md:553, audits/DOCS_FOLDER_COMPLETE_AUDIT_2026-03-24.md:95, audits/DOCS_FOLDER_COMPLETE_AUDIT_2026-03-24.md:440, deployment/index.md:99, guides/ACTION_REFERENCE.md:15, guides/ADDING_AN_ACTION.md:255, guides/ADDING_AN_ACTION.md:273, guides/ADDING_AN_ACTION.md:517, guides/ADDING_AN_ACTION.md:549, guides/ADDING_AN_ACTION.md:549, guides/CLAUDE_DESKTOP_SETUP.md:477, guides/CLAUDE_DESKTOP_SETUP.md:483, index.md:9, index.md:24, review/CLAUDE_DESKTOP_CONFIG_AUDIT_2026-03-13.md:235, testing/MASTER_TEST_PLAN.md:3, testing/MASTER_TEST_PLAN.md:359 |
| **404** | audits/CODEBASE_FULL_AUDIT.md:725, audits/DOCS_FOLDER_COMPLETE_AUDIT_2026-03-24.md:175, development/CODEBASE_CONTEXT.md:105, development/SOURCE_OF_TRUTH.md:214, development/SOURCE_OF_TRUTH.md:260, development/SOURCE_OF_TRUTH.md:310 |
| **407** | audits/AUDIT_REPORT.md:7, audits/AUDIT_REPORT.md:18, audits/AUDIT_REPORT.md:144, audits/AUDIT_REPORT.md:147, audits/AUDIT_REPORT.md:391, audits/CODEBASE_AUDIT_SUPPLEMENT.md:234, audits/CODEBASE_AUDIT_SUPPLEMENT.md:258, audits/CODEBASE_FULL_AUDIT.md:5, audits/CODEBASE_FULL_AUDIT.md:310, audits/DOCS_FOLDER_COMPLETE_AUDIT_2026-03-24.md:159, audits/ServalSheets_GitHub_Audit.md:5, audits/ServalSheets_GitHub_Audit.md:12, compliance/MCP_2025-11-25_COMPLIANCE_CHECKLIST.md:18, development/ACTION_REGISTRY.md:2, development/ACTION_REGISTRY.md:9, development/CODEBASE_CONTEXT.md:12, development/DEVELOPER_WORKFLOW.md:1560, development/DEVELOPER_WORKFLOW.md:1563, development/DOCUMENTATION.md:54, development/HANDLER_PATTERNS.md:14, development/SCRIPTS_REFERENCE.md:229, development/SCRIPTS_REFERENCE.md:251, development/SCRIPTS_REFERENCE.md:342, development/SCRIPTS_REFERENCE.md:365, development/SCRIPTS_REFERENCE.md:500, development/SOURCE_OF_TRUTH.md:33, development/SOURCE_OF_TRUTH.md:134, development/SOURCE_OF_TRUTH.md:213, development/SOURCE_OF_TRUTH.md:309, guides/ONBOARDING.md:43, guides/SKILL.md:18, review/MCP_PROTOCOL_COORDINATOR_AUDIT.md:16, review/MCP_PROTOCOL_SOURCE_MANIFEST.md:19 |
| **408** | review/COMPETITIVE_REMEDIATION_ANALYSIS.md:295, review/MASTER_EXECUTION_PLAN.md:692 |

## 🔧 Tool Count Cross-Reference

| Count | References |
|-------|------------|
| **12** | audits/CODEBASE_FULL_AUDIT.md:223, audits/CODEBASE_FULL_AUDIT.md:683, development/CODEBASE_CONTEXT.md:54, guides/CLAUDE_DESKTOP_SETUP.md:776 |
| **13** | audits/CODEBASE_FULL_AUDIT.md:207, audits/CODEBASE_FULL_AUDIT.md:676, development/CODEBASE_CONTEXT.md:31 |
| **15** | review/BUG_REPORT_2026-03-16.md:252, security/RBAC_GUIDE.md:130 |
| **16** | review/MCP_PROTOCOL_COORDINATOR_AUDIT.md:24 |
| **17** | AQUI-VR_EVALUATION.md:107, reference/API_MCP_REFERENCE.md:452, reference/API_MCP_REFERENCE.md:476, review/archive/planning-artifacts/SERVALSHEETS_ADVANCEMENT_PLAN_V2.md:244 |
| **21** | guides/ACTION_REFERENCE.md:96, guides/USAGE_GUIDE.md:42, review/MCP_PROTOCOL_COORDINATOR_AUDIT.md:24 |
| **22** | audits/AQUI-VR_v3.2_Framework.md:127, audits/DOCS_FOLDER_COMPLETE_AUDIT_2026-03-24.md:96, audits/DOCS_FOLDER_COMPLETE_AUDIT_2026-03-24.md:110, audits/DOCS_FOLDER_COMPLETE_AUDIT_2026-03-24.md:453, audits/DOCS_FOLDER_COMPLETE_AUDIT_2026-03-24.md:454, review/archive/planning-artifacts/API_AUDIT_INDEX.md:13, review/archive/planning-artifacts/API_AUDIT_INDEX.md:108, review/archive/planning-artifacts/COMPETITIVE_GAP_DEEP_DIVE.md:5, review/archive/planning-artifacts/COMPETITIVE_GAP_DEEP_DIVE.md:12, review/archive/planning-artifacts/COMPETITIVE_GAP_DEEP_DIVE.md:781 |
| **23** | audits/MCP_STARTUP_ANALYSIS.md:125, audits/MCP_STARTUP_ANALYSIS.md:332 |
| **25** | AQUI-VR_EVALUATION.md:14, AQUI-VR_EVALUATION.md:76, AQUI-VR_EVALUATION.md:78, AQUI-VR_EVALUATION.md:80, AQUI-VR_EVALUATION.md:147, AQUI-VR_EVALUATION.md:147, AQUI-VR_EVALUATION.md:223, AQUI-VR_EVALUATION.md:403, COMPETITIVE_ANALYSIS.md:54, audits/AQUI-VR_v3.2_Framework.md:270, audits/AQUI-VR_v3.2_Framework.md:270, audits/AQUI-VR_v3.2_Framework.md:363, audits/AQUI-VR_v3.2_Framework.md:363, audits/AUDIT_REPORT.md:7, audits/AUDIT_REPORT.md:18, audits/AUDIT_REPORT.md:61, audits/AUDIT_REPORT.md:74, audits/AUDIT_REPORT.md:86, audits/AUDIT_REPORT.md:129, audits/AUDIT_REPORT.md:137, audits/AUDIT_REPORT.md:342, audits/AUDIT_REPORT.md:343, audits/AUDIT_REPORT.md:351, audits/CODEBASE_AUDIT_SUPPLEMENT.md:86, audits/CODEBASE_AUDIT_SUPPLEMENT.md:295, audits/CODEBASE_AUDIT_SUPPLEMENT.md:468, audits/CODEBASE_FULL_AUDIT.md:5, audits/CODEBASE_FULL_AUDIT.md:205, audits/CODEBASE_FULL_AUDIT.md:278, audits/CODEBASE_FULL_AUDIT.md:461, audits/CODEBASE_FULL_AUDIT.md:724, audits/CODEBASE_FULL_AUDIT.md:732, audits/CODEBASE_FULL_AUDIT.md:1012, audits/CODEBASE_FULL_AUDIT.md:1025, audits/DOCS_FOLDER_COMPLETE_AUDIT_2026-03-24.md:96, audits/DOCS_FOLDER_COMPLETE_AUDIT_2026-03-24.md:110, audits/DOCS_FOLDER_COMPLETE_AUDIT_2026-03-24.md:455, audits/DOCS_FOLDER_COMPLETE_AUDIT_2026-03-24.md:535, audits/MCP_STARTUP_ANALYSIS.md:10, audits/MCP_STARTUP_ANALYSIS.md:59, audits/MCP_STARTUP_ANALYSIS.md:95, audits/MCP_STARTUP_ANALYSIS.md:121, audits/MCP_STARTUP_ANALYSIS.md:157, audits/MCP_STARTUP_ANALYSIS.md:187, audits/MCP_STARTUP_ANALYSIS.md:308, audits/MCP_STARTUP_ANALYSIS.md:345, audits/MCP_STARTUP_ANALYSIS.md:376, audits/MCP_STARTUP_ANALYSIS.md:418, audits/MCP_STARTUP_ANALYSIS.md:426, audits/PROJECT_SNAPSHOT.md:14, audits/PROJECT_SNAPSHOT.md:31, audits/ServalSheets_GitHub_Audit.md:5, audits/ServalSheets_GitHub_Audit.md:12, compliance/MCP_2025-11-25_COMPLIANCE_CHECKLIST.md:18, compliance/MCP_2025-11-25_COMPLIANCE_CHECKLIST.md:45, development/ACTION_REGISTRY.md:2, development/ACTION_REGISTRY.md:9, development/ARCHITECTURE.md:54, development/CODEBASE_CONTEXT.md:12, development/CODEBASE_CONTEXT.md:119, development/CODEBASE_CONTEXT.md:128, development/CODEBASE_CONTEXT.md:315, development/CODEBASE_CONTEXT.md:390, development/DEVELOPER_WORKFLOW.md:672, development/DEVELOPER_WORKFLOW.md:1560, development/DEVELOPER_WORKFLOW.md:1563, development/DOCUMENTATION.md:54, development/DURABLE_SCHEMA_PATTERN.md:456, development/HANDLER_PATTERNS.md:14, development/SCRIPTS_REFERENCE.md:119, development/SCRIPTS_REFERENCE.md:229, development/SCRIPTS_REFERENCE.md:251, development/SCRIPTS_REFERENCE.md:293, development/SCRIPTS_REFERENCE.md:341, development/SCRIPTS_REFERENCE.md:343, development/SCRIPTS_REFERENCE.md:344, development/SCRIPTS_REFERENCE.md:365, development/SCRIPTS_REFERENCE.md:369, development/SOURCE_OF_TRUTH.md:33, development/SOURCE_OF_TRUTH.md:134, development/SOURCE_OF_TRUTH.md:259, development/SOURCE_OF_TRUTH.md:309, development/TESTING.md:690, features/TRANSACTIONS.md:306, guides/ACTION_REFERENCE.md:15, guides/ADDING_AN_ACTION.md:255, guides/ADDING_A_HANDLER.md:450, guides/CLAUDE_DESKTOP_SETUP.md:455, guides/CLAUDE_DESKTOP_SETUP.md:477, guides/CLAUDE_DESKTOP_SETUP.md:483, guides/CLAUDE_DESKTOP_SETUP.md:777, guides/CLAUDE_DESKTOP_SETUP.md:825, guides/DEBUGGING.md:462, guides/MCP_INSPECTOR_TESTING_GUIDE.md:332, guides/MCP_INSPECTOR_TESTING_GUIDE.md:399, guides/ONBOARDING.md:43, guides/SKILL.md:18, index.md:24, reference/ACTION_NAMING_STANDARD.md:19, reference/API_MCP_REFERENCE.md:776, reference/API_MCP_REFERENCE.md:817, reference/API_MCP_REFERENCE.md:898, reference/COMPARISON_MATRIX.md:186, reference/api/API-COMPLIANCE-MATRIX.md:275, reference/api/GOOGLE_SHEETS_API_V4_MCP_AUDIT.md:256, reference/api/GOOGLE_SHEETS_API_V4_MCP_AUDIT.md:277, reference/api/GOOGLE_SHEETS_API_V4_MCP_AUDIT.md:301, reference/api/GOOGLE_SHEETS_API_V4_MCP_AUDIT.md:422, reference/api/GOOGLE_SHEETS_API_V4_MCP_AUDIT.md:423, reference/api/GOOGLE_SHEETS_API_V4_MCP_AUDIT.md:454, reference/api/GOOGLE_SHEETS_API_V4_MCP_AUDIT.md:457, reference/api/GOOGLE_SHEETS_API_V4_MCP_AUDIT.md:457, review/ADVANCED_AUDIT_VERIFICATION_2026-03-17.md:30, review/ADVANCED_AUDIT_VERIFICATION_2026-03-17.md:31, review/CLAUDE_DESKTOP_CONFIG_AUDIT_2026-03-13.md:217, review/CLAUDE_DESKTOP_CONFIG_AUDIT_2026-03-13.md:218, review/COMPETITIVE_REMEDIATION_ANALYSIS.md:277, review/COMPETITIVE_REMEDIATION_ANALYSIS.md:295, review/EFFICIENCY_MASTER_GUIDE_2026-03-13.md:24, review/EFFICIENCY_MASTER_GUIDE_2026-03-13.md:614, review/MASTER_EXECUTION_PLAN.md:212, review/MASTER_EXECUTION_PLAN.md:387, review/MASTER_EXECUTION_PLAN.md:497, review/MASTER_EXECUTION_PLAN.md:524, review/MASTER_EXECUTION_PLAN.md:692, review/MCP_OAUTH_LOG_ANALYSIS_2026-03-13.md:149, review/MCP_PROTOCOL_COORDINATOR_AUDIT.md:16, review/MCP_PROTOCOL_COORDINATOR_AUDIT.md:47, review/MCP_PROTOCOL_COORDINATOR_AUDIT.md:51, review/MCP_PROTOCOL_SOURCE_MANIFEST.md:18, review/REMEDIATION_PLAN.md:296, review/REMEDIATION_PLAN.md:302, review/REMEDIATION_PLAN.md:314, review/REMEDIATION_PLAN.md:323, review/REMEDIATION_PLAN.md:328, review/REMEDIATION_PLAN.md:349, review/REMEDIATION_PLAN.md:463, review/REMEDIATION_PLAN.md:618, review/REMEDIATION_PLAN.md:677, review/REMEDIATION_PLAN_ADDENDUM.md:38, review/REMEDIATION_PLAN_ADDENDUM.md:94, review/archive/planning-artifacts/COMPETITIVE_GAP_DEEP_DIVE.md:781, review/archive/planning-artifacts/NEXT_LEVEL_ADVANCEMENT_PLAN.md:13, review/archive/planning-artifacts/NEXT_LEVEL_ADVANCEMENT_PLAN.md:51, review/archive/planning-artifacts/NEXT_LEVEL_ADVANCEMENT_PLAN.md:51, review/archive/planning-artifacts/NEXT_LEVEL_ADVANCEMENT_PLAN.md:268, review/archive/planning-artifacts/SERVALSHEETS_ADVANCEMENT_PLAN_V2.md:12, review/archive/planning-artifacts/SERVALSHEETS_ADVANCEMENT_PLAN_V2.md:239, review/archive/planning-artifacts/SERVALSHEETS_ADVANCEMENT_PLAN_V2.md:248, review/archive/planning-artifacts/SERVALSHEETS_ADVANCEMENT_PLAN_V2.md:385, review/servalsheets-mega-prompt.md:10, review/servalsheets-mega-prompt.md:324 |

## 🔁 Exact Duplicate Files

No exact duplicates found.

## 📦 Binary Files

- `.vitepress/dist/logo.svg` (6 B)
- `public/logo.svg` (6 B)
- `research/AI_Spreadsheet_Comparison_2026.xlsx` (17.7 KB)
- `research/ServalSheets_vs_Competitors_Functionality_2026.xlsx` (20.6 KB)
- `research/benchmark_report.xlsx` (123.3 KB)
- `review/archive/planning-artifacts/AQUI_Framework_Research_Report.docx` (26.8 KB)
- `review/archive/planning-artifacts/AQUI_Implementation_Mapping.docx` (28.3 KB)
- `review/archive/planning-artifacts/AQUI_MCP_Enhancement_Analysis.docx` (25.3 KB)
- `review/archive/planning-artifacts/AQUI_VR_Final_Specification.docx` (26.5 KB)
- `review/archive/planning-artifacts/AQUI_VR_Implementation_Spec.docx` (36.2 KB)
- `review/archive/planning-artifacts/AQUI_VR_MCP_Scoring_Matrix.xlsx` (23.0 KB)
- `review/archive/planning-artifacts/AQUI_VR_MCP_Scoring_Matrix2.xlsx` (23.0 KB)
- `review/archive/planning-artifacts/COMPETITIVE_DOMINANCE_BLUEPRINT.docx` (23.0 KB)
- `review/archive/planning-artifacts/LUSAREP_UASEVR_Integration_Strategy.docx` (21.5 KB)
- `review/archive/planning-artifacts/SERVALSHEETS_MASTER_EXECUTION_PLAN.docx` (24.3 KB)
- `review/archive/planning-artifacts/ServalSheets_Competitive_Analysis.docx` (22.5 KB)
- `review/archive/planning-artifacts/ServalSheets_Competitive_Analysis_SourceCode.docx` (23.4 KB)
- `review/archive/planning-artifacts/ServalSheets_Enhanced_Implementation_Plan.docx` (34.6 KB)
- `review/archive/planning-artifacts/ServalSheets_GTM_Strategy.docx` (31.6 KB)
- `review/archive/planning-artifacts/ServalSheets_Implementation_Plan.docx` (23.2 KB)
- `review/archive/planning-artifacts/ServalSheets_LUSAREP_Analysis.docx` (23.6 KB)
- `review/archive/planning-artifacts/ServalSheets_Unicorn_Strategy.docx` (23.0 KB)

## 📌 TODO / FIXME Markers

| File | Line | Text |
|------|------|------|
| `deployment/aws.md` | 49 | certificate_arn                = "arn:aws:acm:us-east-1:123456789:certificate/xx |
| `development/DEVELOPER_WORKFLOW.md` | 272 | | `❌ TODO found in src/`      | Placeholder in source                 | Remove o |
| `development/DEVELOPER_WORKFLOW.md` | 781 | - [ ] npm run check:placeholders   # No TODO/FIXME in src/ |
| `development/DURABLE_SCHEMA_PATTERN.md` | 20 | - 252 lines of workaround code |
| `development/DURABLE_SCHEMA_PATTERN.md` | 320 | - **Removed 252 lines of workaround code** (sdk-patch) |
| `development/DURABLE_SCHEMA_PATTERN.md` | 372 | - ✅ Removed `src/utils/sdk-patch.ts` workaround |
| `development/DURABLE_SCHEMA_PATTERN.md` | 449 | - Removed sdk-patch workaround |
| `development/PROJECT_STATUS.md` | 65 | npm run check:placeholders  # No TODO/FIXME in src/ |
| `development/SCRIPTS_REFERENCE.md` | 35 | | `no-placeholders.sh`                   | Check for TODO/FIXME        | `npm ru |
| `development/SCRIPTS_REFERENCE.md` | 518 | **Purpose:** Ensure no TODO/FIXME/HACK markers in `src/` |
| `development/SCRIPTS_REFERENCE.md` | 522 | - `TODO` - Incomplete work |
| `development/SCRIPTS_REFERENCE.md` | 523 | - `FIXME` - Known bugs |
| `development/SCRIPTS_REFERENCE.md` | 524 | - `XXX` - Urgent attention needed |
| `development/SCRIPTS_REFERENCE.md` | 525 | - `HACK` - Temporary solutions |
| `development/SCRIPTS_REFERENCE.md` | 549 | # src/services/semantic-range.ts:359: // TODO: Implement formula detection |
| `development/SCRIPTS_REFERENCE.md` | 996 | npm run docs:find-todos        # Find TODO markers |
| `development/VSCODE_SETUP.md` | 104 | code --install-extension gruntfuggly.todo-tree |
| `development/VSCODE_SETUP.md` | 166 | | **TODO Tree**          | Find all TODOs in project        | |
| `development/testing/TEST_PATTERNS.md` | 496 | **Workaround**: Skip schema completeness assertions in tests. |
| `development/testing/TEST_PATTERNS.md` | 500 | // TODO: Re-enable when SDK v1.26+ fixes discriminated union support |
| `development/testing/TEST_PATTERNS.md` | 566 | 7. **Document workarounds with TODO comments and references** |
| `features/FEDERATION.md` | 494 | ServalSheets stands alone in offering **native federation support** as a first-c |
| `guides/ADDING_AN_ACTION.md` | 488 | Closes #XXX" |
| `guides/ADDING_A_HANDLER.md` | 738 | Closes #XXX" |
| `guides/CLAUDE_DESKTOP_SETUP.md` | 211 | GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com |
| `guides/CLAUDE_DESKTOP_SETUP.md` | 212 | GOOGLE_CLIENT_SECRET=GOCSPX-xxx |
| `guides/CLAUDE_DESKTOP_SETUP.md` | 564 | | `GOOGLE_CLIENT_ID`               | OAuth client ID            | Yes (if OAuth) |
| `guides/CLAUDE_DESKTOP_SETUP.md` | 565 | | `GOOGLE_CLIENT_SECRET`           | OAuth client secret        | Yes (if OAuth) |
| `guides/DEPLOYMENT.md` | 217 | echo "ya29.xxx" | docker secret create google_access_token - |
| `guides/DEPLOYMENT.md` | 284 | "private_key_id": "xxx", |
| `guides/DEPLOYMENT.md` | 287 | "client_id": "xxx", |
| `guides/MONITORING.md` | 147 | "spreadsheetId": "xxx", |
| `guides/MONITORING.md` | 164 | "spreadsheetId": "xxx", |
| `guides/MONITORING.md` | 779 | return await read({ action: 'read', spreadsheetId: 'xxx', range: 'A1:D10' }); |
| `guides/MONITORING.md` | 807 | const result = await read({ action: 'read', spreadsheetId: 'xxx', range: 'A1:D10 |
| `guides/MONITORING.md` | 811 | spreadsheetId: 'xxx', |
| `guides/ONBOARDING.md` | 406 | grep -r "TODO" docs/ |
| `guides/PERFORMANCE.md` | 149 | await client.sheets.spreadsheets.get({ spreadsheetId: 'xxx' });      // Connecti |
| `guides/PERFORMANCE.md` | 162 | client.sheets.spreadsheets.get({ spreadsheetId: 'xxx' }), |
| `guides/PERFORMANCE.md` | 314 | spreadsheetId: 'xxx', |
| `guides/PERFORMANCE.md` | 338 | spreadsheetId: 'xxx', |
| `guides/PERFORMANCE.md` | 362 | spreadsheetId: 'xxx', |
| `guides/PERFORMANCE.md` | 544 | spreadsheetId: 'xxx', |
| `guides/PERFORMANCE.md` | 556 | spreadsheetId: 'xxx', |
| `guides/PERFORMANCE.md` | 572 | spreadsheetId: 'xxx', |
| `guides/PERFORMANCE.md` | 615 | spreadsheetId: 'xxx', |
| `guides/PERFORMANCE.md` | 635 | spreadsheetId: 'xxx', |
| `guides/PERFORMANCE.md` | 680 | spreadsheetId: 'xxx', |
| `guides/PERFORMANCE.md` | 700 | spreadsheetId: 'xxx', |
| `guides/PERFORMANCE.md` | 902 | for await (const batch of streamRows('xxx', 'Sheet1')) { |
| ... | ... | *(175 more)* |

## 🔗 Broken Internal Links

| File | Line | Target |
|------|------|--------|
| `README.md` | 130 | ./analysis/00_QUICKSTART.md |
| `README.md` | 131 | ./analysis/01_FUNCTIONAL.md |
| `README.md` | 132 | ./analysis/02_PROTOCOL.md |
| `README.md` | 133 | ./analysis/03_CODE_QUALITY.md |
| `README.md` | 134 | ./analysis/04_DEEP_TECHNICAL.md |
| `README.md` | 135 | ./analysis/05_EXCELLENCE.md |
| `README.md` | 136 | ./analysis/06_EXECUTION.md |
| `README.md` | 137 | ./analysis/07_SCORING.md |
| `README.md` | 138 | ./analysis/agent-prompts/ |
| `README.md` | 163 | ./COMPARISON_MATRIX.md |
| `README.md` | 164 | ./CASE_STUDIES.md |
| `README.md` | 173 | ../SKILL.md |
| `deployment/aws.md` | 136 | ./monitoring |
| `deployment/docker.md` | 137 | ./monitoring |
| `deployment/gcp.md` | 176 | ./monitoring |
| `deployment/helm.md` | 154 | ./monitoring |
| `deployment/index.md` | 147 | ./monitoring |
| `deployment/kubernetes.md` | 1271 | ./monitoring |
| `deployment/production-launch-checklist.md` | 97 | /Users/thomascahill/Documents/servalsheets%202/docs/runbooks/auth-failures.md |
| `deployment/production-launch-checklist.md` | 98 | /Users/thomascahill/Documents/servalsheets%202/docs/runbooks/google-api-errors.md |
| `deployment/production-launch-checklist.md` | 99 | /Users/thomascahill/Documents/servalsheets%202/docs/runbooks/high-error-rate.md |
| `deployment/production-launch-checklist.md` | 100 | /Users/thomascahill/Documents/servalsheets%202/docs/runbooks/service-down.md |
| `deployment/production-launch-checklist.md` | 144 | /Users/thomascahill/Documents/servalsheets%202/docs/security/INCIDENT_RESPONSE_PLAN.md |
| `development/CLAUDE_CODE_RULES.md` | 17 | ../../AGENTS.md |
| `development/DEBUGGING_AND_TESTING.md` | 421 | ./architecture-diagrams.md |
| `development/DEBUGGING_AND_TESTING.md` | 422 | ./DEVELOPMENT_LOG.md |
| `development/DEVELOPER_WORKFLOW.md` | 1660 | ./AUDIT_REPORT_2026-01-11.md |
| `development/DOCUMENTATION.md` | 81 | ./PERFORMANCE.md |
| `development/DOCUMENTATION.md` | 96 | ./MONITORING.md |
| `development/DOCUMENTATION.md` | 111 | ./DEPLOYMENT.md |
| `development/DOCUMENTATION.md` | 127 | ./TROUBLESHOOTING.md |
| `development/DOCUMENTATION.md` | 150 | ../MCP_2025-11-25_COMPLIANCE_CHECKLIST.md |
| `development/DOCUMENTATION.md` | 161 | ./COMPREHENSIVE_ANALYSIS_REPORT.md |
| `development/DOCUMENTATION.md` | 162 | ./DOCUMENTATION_IMPROVEMENTS.md |
| `development/DOCUMENTATION.md` | 163 | ./PROJECT_AUDIT_REPORT.md |
| `development/DOCUMENTATION.md` | 164 | ./VERIFICATION_REPORT.md |
| `development/DOCUMENTATION.md` | 194 | ../MCP_2025-11-25_COMPLIANCE_CHECKLIST.md |
| `development/DOCUMENTATION.md` | 248 | ./USAGE_GUIDE.md |
| `development/DOCUMENTATION.md` | 251 | ./QUICKSTART_CREDENTIALS.md |
| `development/DOCUMENTATION.md` | 254 | ./CLAUDE_DESKTOP_SETUP.md |
| `development/DOCUMENTATION.md` | 257 | ./TROUBLESHOOTING.md |
| `development/DOCUMENTATION.md` | 260 | ./DEPLOYMENT.md |
| `development/DOCUMENTATION.md` | 263 | ./PERFORMANCE.md |
| `development/DOCUMENTATION.md` | 266 | ./MONITORING.md |
| `development/DOCUMENTATION.md` | 269 | ./TROUBLESHOOTING.md |
| `development/DOCUMENTATION.md` | 272 | ./TROUBLESHOOTING.md |
| `development/DOCUMENTATION.md` | 276 | ./USAGE_GUIDE.md |
| `development/DOCUMENTATION.md` | 277 | ./TROUBLESHOOTING.md |
| `development/PERFORMANCE_TARGETS.md` | 378 | ./OPTIMIZATION_IMPLEMENTATION_PLAN.md |
| `development/PROJECT_STATUS.md` | 95 | /docs/CHANGELOG.md |
| `development/testing/QUICK_START.md` | 106 | ./helpers/README.md |
| `guides/ADAPTIVE_BATCH_WINDOW_GUIDE.md` | 295 | ../ADAPTIVE_BATCH_WINDOW_IMPLEMENTATION.md |
| `guides/ADAPTIVE_BATCH_WINDOW_GUIDE.md` | 297 | ../../scripts/benchmark-adaptive-window.ts |
| `guides/ADDING_A_HANDLER.md` | 823 | ../development/TYPESCRIPT_ERROR_GUIDE.md |
| `guides/ERROR_HANDLING.md` | 15 | error-recovery.md |
| `guides/ERROR_HANDLING.md` | 422 | ./CIRCUIT_BREAKER.md |
| `guides/ERROR_HANDLING.md` | 603 | ./RATE_LIMITING.md |
| `guides/ERROR_HANDLING.md` | 604 | ./CIRCUIT_BREAKER.md |
| `guides/INSTALLATION_GUIDE.md` | 387 | ./RELEASE_NOTES_v1.6.0.md |
| `guides/OAUTH_USER_SETUP.md` | 282 | ./PRODUCTION_DEPLOYMENT_GUIDE.md |
| `guides/ONBOARDING.md` | 530 | ../development/TYPESCRIPT_ERROR_GUIDE.md |
| `guides/ONBOARDING.md` | 574 | ../development/TYPESCRIPT_ERROR_GUIDE.md |
| `guides/ONBOARDING.md` | 612 | ../development/SCHEMA_DESIGN.md |
| `guides/SCHEMA_VERSIONING.md` | 506 | ./docs/migration/v1-to-v2.md |
| `guides/USAGE_GUIDE.md` | 957 | ../MCP_2025-11-25_COMPLIANCE_CHECKLIST.md |
| `guides/sheets_webhook.md` | 1109 | ../../src/handlers/webhook.ts |
| `index.md` | 95 | /COMPARISON_MATRIX |
| `index.md` | 109 | /CASE_STUDIES |
| `operations/DEGRADATION_MODES.md` | 320 | ../knowledge/api/error-handling.md |
| `operations/DEGRADATION_MODES.md` | 321 | ../development/CONFIGURATION.md |
| `operations/DEGRADATION_MODES.md` | 322 | ../deployment/MONITORING.md |
| `operations/REQUEST_REPLAY.md` | 477 | ../development/TESTING_STRATEGY.md |
| `operations/REQUEST_REPLAY.md` | 478 | ../development/PERFORMANCE.md |
| `operations/high-error-rate.md` | 436 | ../guides/RATE_LIMITING.md |
| `operations/high-error-rate.md` | 437 | ../guides/CIRCUIT_BREAKER.md |
| `reference/tools/sheets_data.md` | 528 | /reference/tools/sheets_format |
| `reference/tools/sheets_data.md` | 529 | /reference/tools/sheets_core |
| `remediation/benchmark-fix-action-plan-2026-03-20.md` | 97 | ../../AQUI-VR_v3.2_Framework.md |
| `review/archive/experimental/PHASE_3_USER_GUIDE.md` | 17 | ../../../guides/GRAPHQL_API.md |
| `review/archive/planning-artifacts/API_AUDIT_INDEX.md` | 22 | ./AUDIT_SUMMARY.txt |
| `review/archive/planning-artifacts/API_AUDIT_INDEX.md` | 33 | ./GOOGLE_API_ANALYSIS.md |
| `review/archive/planning-artifacts/API_AUDIT_INDEX.md` | 73 | ./AUDIT_SUMMARY.txt |
| `runbooks/README.md` | 119 | ./slo-availability.md |
| `runbooks/README.md` | 124 | ./slo-latency.md |
| `runbooks/README.md` | 131 | ./slo-errors.md |
| `runbooks/README.md` | 137 | ./slo-google-api.md |
| `runbooks/README.md` | 141 | ./slo-cache.md |
| `runbooks/README.md` | 145 | ./error-budget.md |

## 📝 Frontmatter Coverage

- Markdown files: 179
- With frontmatter: 156 (87%)
- Without frontmatter: 23

## 📋 Complete File Inventory

| Path | Category | Size | Lines | Words |
|------|----------|------|-------|-------|
| `.vitepress/config.mjs` | other | 5.1 KB | 161 | 504 |
| `.vitepress/dist/404.html` | web | 13.1 KB | 27 | 154 |
| `.vitepress/dist/architecture/CONTEXT_LAYERS.html` | web | 88.3 KB | 186 | 3255 |
| `.vitepress/dist/assets/app.D7nADcI8.js` | other | 1.3 KB | 2 | 66 |
| `.vitepress/dist/assets/architecture_CONTEXT_LAYERS.md.C9LZgEng.js` | other | 65.9 KB | 158 | 2681 |
| `.vitepress/dist/assets/architecture_CONTEXT_LAYERS.md.C9LZgEng.lean.js` | other | 677 B | 2 | 27 |
| `.vitepress/dist/assets/audits_MCP_LLM_QUALITY_AUDIT_2026-03-07.md.D4wYrYLY.js` | other | 89.6 KB | 99 | 4835 |
| `.vitepress/dist/assets/audits_MCP_LLM_QUALITY_AUDIT_2026-03-07.md.D4wYrYLY.lean.js` | other | 515 B | 2 | 23 |
| `.vitepress/dist/assets/audits_PRODUCTION_GO_LIVE_2026-03-05.md.K4SDTwvN.js` | other | 11.1 KB | 2 | 556 |
| `.vitepress/dist/assets/audits_PRODUCTION_GO_LIVE_2026-03-05.md.K4SDTwvN.lean.js` | other | 836 B | 2 | 47 |
| `.vitepress/dist/assets/chunks/@localSearchIndexroot.DfGc9PaY.js` | other | 2.3 MB | 2 | 26898 |
| `.vitepress/dist/assets/chunks/framework.BqvU2jwA.js` | other | 106.1 KB | 20 | 2462 |
| `.vitepress/dist/assets/chunks/theme.1UgncIcG.js` | other | 52.5 KB | 3 | 644 |
| `.vitepress/dist/assets/chunks/VPLocalSearchBox.BZ7vQppo.js` | other | 62.4 KB | 10 | 1496 |
| `.vitepress/dist/assets/compliance_AUDIT_LOGGING.md.as5yXLrM.js` | other | 78.2 KB | 166 | 3275 |
| `.vitepress/dist/assets/compliance_AUDIT_LOGGING.md.as5yXLrM.lean.js` | other | 748 B | 2 | 37 |
| `.vitepress/dist/assets/compliance_MCP_2025-11-25_COMPLIANCE_CHECKLIST.md.Dv4zmtWU.js` | other | 67.9 KB | 86 | 2378 |
| `.vitepress/dist/assets/compliance_MCP_2025-11-25_COMPLIANCE_CHECKLIST.md.Dv4zmtWU.lean.js` | other | 1.8 KB | 2 | 50 |
| `.vitepress/dist/assets/deployment_aws.md.Bl1nh5I_.js` | other | 15.9 KB | 42 | 643 |
| `.vitepress/dist/assets/deployment_aws.md.Bl1nh5I_.lean.js` | other | 705 B | 2 | 37 |
| `.vitepress/dist/assets/deployment_docker.md.B_jJISy_.js` | other | 21.1 KB | 63 | 760 |
| `.vitepress/dist/assets/deployment_docker.md.B_jJISy_.lean.js` | other | 727 B | 2 | 37 |
| `.vitepress/dist/assets/deployment_gcp.md.BGwsE8Pu.js` | other | 20.9 KB | 59 | 833 |
| `.vitepress/dist/assets/deployment_gcp.md.BGwsE8Pu.lean.js` | other | 719 B | 2 | 39 |
| `.vitepress/dist/assets/deployment_helm.md.C3MB1XX8.js` | other | 24.0 KB | 71 | 821 |
| `.vitepress/dist/assets/deployment_helm.md.C3MB1XX8.lean.js` | other | 755 B | 2 | 37 |
| `.vitepress/dist/assets/deployment_index.md.BVv_5-zG.js` | other | 17.2 KB | 40 | 692 |
| `.vitepress/dist/assets/deployment_index.md.BVv_5-zG.lean.js` | other | 796 B | 2 | 37 |
| `.vitepress/dist/assets/deployment_kubernetes.md.BZcrU8z8.js` | other | 239.4 KB | 744 | 8191 |
| `.vitepress/dist/assets/deployment_kubernetes.md.BZcrU8z8.lean.js` | other | 857 B | 2 | 43 |
| `.vitepress/dist/assets/deployment_pm2.md.B5cXB663.js` | other | 54.6 KB | 109 | 2185 |
| `.vitepress/dist/assets/deployment_pm2.md.B5cXB663.lean.js` | other | 717 B | 2 | 35 |
| `.vitepress/dist/assets/development_ACTION_REGISTRY.md.DcT0VsyU.js` | other | 18.3 KB | 2 | 802 |
| `.vitepress/dist/assets/development_ACTION_REGISTRY.md.DcT0VsyU.lean.js` | other | 706 B | 2 | 29 |
| `.vitepress/dist/assets/development_ADDING_A_HANDLER.md.BgA6N8rb.js` | other | 166.7 KB | 549 | 5813 |
| `.vitepress/dist/assets/development_ADDING_A_HANDLER.md.BgA6N8rb.lean.js` | other | 768 B | 2 | 41 |
| `.vitepress/dist/assets/development_ADDING_AN_ACTION.md.B4CSM3Ph.js` | other | 102.7 KB | 328 | 4092 |
| `.vitepress/dist/assets/development_ADDING_AN_ACTION.md.B4CSM3Ph.lean.js` | other | 789 B | 2 | 45 |
| `.vitepress/dist/assets/development_ARCHITECTURE.md.BVmgQSuD.js` | other | 43.0 KB | 145 | 2113 |
| `.vitepress/dist/assets/development_ARCHITECTURE.md.BVmgQSuD.lean.js` | other | 722 B | 2 | 31 |
| `.vitepress/dist/assets/development_DEBUGGING_AND_TESTING.md.CiWL6qCc.js` | other | 57.0 KB | 125 | 2213 |
| `.vitepress/dist/assets/development_DEBUGGING_AND_TESTING.md.CiWL6qCc.lean.js` | other | 857 B | 2 | 49 |
| `.vitepress/dist/assets/development_DEBUGGING.md.DFP5UHyQ.js` | other | 75.6 KB | 189 | 3111 |
| `.vitepress/dist/assets/development_DEBUGGING.md.DFP5UHyQ.lean.js` | other | 749 B | 2 | 33 |
| `.vitepress/dist/assets/development_DEVELOPER_WORKFLOW.md.Ce0Nxn0F.js` | other | 254.9 KB | 753 | 10215 |
| `.vitepress/dist/assets/development_DEVELOPER_WORKFLOW.md.Ce0Nxn0F.lean.js` | other | 809 B | 2 | 35 |
| `.vitepress/dist/assets/development_DOCUMENTATION.md.BOxm2GWT.js` | other | 4.1 KB | 2 | 228 |
| `.vitepress/dist/assets/development_DOCUMENTATION.md.BOxm2GWT.lean.js` | other | 769 B | 2 | 33 |
| `.vitepress/dist/assets/development_DURABLE_SCHEMA_PATTERN.md.CagA0Ccp.js` | other | 83.2 KB | 172 | 2946 |
| `.vitepress/dist/assets/development_DURABLE_SCHEMA_PATTERN.md.CagA0Ccp.lean.js` | other | 940 B | 2 | 53 |
| `.vitepress/dist/assets/development_HANDLER_PATTERNS.md.BerW9kxM.js` | other | 185.0 KB | 541 | 5495 |
| `.vitepress/dist/assets/development_HANDLER_PATTERNS.md.BerW9kxM.lean.js` | other | 754 B | 2 | 33 |
| `.vitepress/dist/assets/development_IMPLEMENTATION_GUARDRAILS.md.DWh_neE4.js` | other | 132.5 KB | 376 | 5167 |
| `.vitepress/dist/assets/development_IMPLEMENTATION_GUARDRAILS.md.DWh_neE4.lean.js` | other | 844 B | 2 | 47 |
| `.vitepress/dist/assets/development_MCP_INSPECTOR_TESTING_GUIDE.md.DaNdRthu.js` | other | 45.8 KB | 105 | 2109 |
| `.vitepress/dist/assets/development_MCP_INSPECTOR_TESTING_GUIDE.md.DaNdRthu.lean.js` | other | 1.1 KB | 2 | 77 |
| `.vitepress/dist/assets/development_ONBOARDING.md.Cigk8WzG.js` | other | 90.5 KB | 286 | 3983 |
| `.vitepress/dist/assets/development_ONBOARDING.md.Cigk8WzG.lean.js` | other | 784 B | 2 | 35 |
| `.vitepress/dist/assets/development_PERFORMANCE_TARGETS.md.C3Q2wkgW.js` | other | 39.3 KB | 50 | 1713 |
| `.vitepress/dist/assets/development_PERFORMANCE_TARGETS.md.C3Q2wkgW.lean.js` | other | 722 B | 2 | 27 |
| `.vitepress/dist/assets/development_SCRIPTS_REFERENCE.md.CuO6i16E.js` | other | 155.0 KB | 448 | 7077 |
| `.vitepress/dist/assets/development_SCRIPTS_REFERENCE.md.CuO6i16E.lean.js` | other | 788 B | 2 | 37 |
| `.vitepress/dist/assets/development_SOURCE_OF_TRUTH.md.ClFxH7wf.js` | other | 29.8 KB | 69 | 1357 |
| `.vitepress/dist/assets/development_SOURCE_OF_TRUTH.md.ClFxH7wf.lean.js` | other | 772 B | 2 | 39 |
| `.vitepress/dist/assets/development_testing_CI_SETUP.md.ByigB208.js` | other | 72.2 KB | 242 | 2743 |
| `.vitepress/dist/assets/development_testing_CI_SETUP.md.ByigB208.lean.js` | other | 881 B | 2 | 55 |
| `.vitepress/dist/assets/development_testing_INTEGRATION_TEST_SETUP.md.M4bdKx7t.js` | other | 23.8 KB | 30 | 1339 |
| `.vitepress/dist/assets/development_testing_INTEGRATION_TEST_SETUP.md.M4bdKx7t.lean.js` | other | 938 B | 2 | 63 |
| `.vitepress/dist/assets/development_testing_INTEGRATION_TESTS_SUMMARY.md.Gp_b-Yqq.js` | other | 27.8 KB | 47 | 1518 |
| `.vitepress/dist/assets/development_testing_INTEGRATION_TESTS_SUMMARY.md.Gp_b-Yqq.lean.js` | other | 919 B | 2 | 53 |
| `.vitepress/dist/assets/development_testing_QUICK_START.md.DHosT9Lb.js` | other | 9.2 KB | 13 | 532 |
| `.vitepress/dist/assets/development_testing_QUICK_START.md.DHosT9Lb.lean.js` | other | 733 B | 2 | 37 |
| `.vitepress/dist/assets/development_testing_TEST_DATA.md.Bl2UtsoP.js` | other | 24.8 KB | 62 | 920 |
| `.vitepress/dist/assets/development_testing_TEST_DATA.md.Bl2UtsoP.lean.js` | other | 772 B | 2 | 45 |
| `.vitepress/dist/assets/development_testing_TEST_PATTERNS.md.8k-1ECIg.js` | other | 97.3 KB | 256 | 3500 |
| `.vitepress/dist/assets/development_testing_TEST_PATTERNS.md.8k-1ECIg.lean.js` | other | 682 B | 2 | 23 |
| `.vitepress/dist/assets/development_TESTING.md.BesjS0XW.js` | other | 440.2 KB | 1375 | 13463 |
| `.vitepress/dist/assets/development_TESTING.md.BesjS0XW.lean.js` | other | 685 B | 2 | 29 |
| `.vitepress/dist/assets/development_VSCODE_SETUP.md.C7kV3wOx.js` | other | 48.1 KB | 89 | 2193 |
| `.vitepress/dist/assets/development_VSCODE_SETUP.md.C7kV3wOx.lean.js` | other | 755 B | 2 | 41 |
| `.vitepress/dist/assets/examples_analysis.md.Bk_PQAdW.js` | other | 45.0 KB | 65 | 2429 |
| `.vitepress/dist/assets/examples_analysis.md.Bk_PQAdW.lean.js` | other | 712 B | 2 | 37 |
| `.vitepress/dist/assets/examples_basic.md.BvdrdP7T.js` | other | 26.8 KB | 38 | 1516 |
| `.vitepress/dist/assets/examples_basic.md.BvdrdP7T.lean.js` | other | 693 B | 2 | 31 |
| `.vitepress/dist/assets/examples_charts.md.Ba_G_KoS.js` | other | 52.2 KB | 107 | 2866 |
| `.vitepress/dist/assets/examples_charts.md.Ba_G_KoS.lean.js` | other | 734 B | 2 | 39 |
| `.vitepress/dist/assets/examples_formatting.md.CK1CUeKb.js` | other | 40.5 KB | 51 | 2360 |
| `.vitepress/dist/assets/examples_formatting.md.CK1CUeKb.lean.js` | other | 712 B | 2 | 39 |
| `.vitepress/dist/assets/examples_index.md.CQwwSef5.js` | other | 5.3 KB | 2 | 341 |
| `.vitepress/dist/assets/examples_index.md.CQwwSef5.lean.js` | other | 716 B | 2 | 33 |
| `.vitepress/dist/assets/examples_oauth.md.DxtmZS9q.js` | other | 43.9 KB | 80 | 2346 |
| `.vitepress/dist/assets/examples_oauth.md.DxtmZS9q.lean.js` | other | 761 B | 2 | 41 |
| `.vitepress/dist/assets/guides_ACTION_REFERENCE.md.DmHcf9Ko.js` | other | 7.5 KB | 6 | 452 |
| `.vitepress/dist/assets/guides_ACTION_REFERENCE.md.DmHcf9Ko.lean.js` | other | 745 B | 2 | 37 |
| `.vitepress/dist/assets/guides_ADAPTIVE_BATCH_WINDOW_GUIDE.md.Ck1S4Ce8.js` | other | 44.2 KB | 84 | 1922 |
| `.vitepress/dist/assets/guides_ADAPTIVE_BATCH_WINDOW_GUIDE.md.Ck1S4Ce8.lean.js` | other | 914 B | 2 | 59 |
| `.vitepress/dist/assets/guides_batching-strategies.md.DB19UqxU.js` | other | 78.5 KB | 224 | 3099 |
| `.vitepress/dist/assets/guides_batching-strategies.md.DB19UqxU.lean.js` | other | 708 B | 2 | 29 |
| `.vitepress/dist/assets/guides_caching-patterns.md.CMoVoWIz.js` | other | 83.0 KB | 201 | 3254 |
| `.vitepress/dist/assets/guides_caching-patterns.md.CMoVoWIz.lean.js` | other | 675 B | 2 | 29 |
| `.vitepress/dist/assets/guides_CLAUDE_ANALYSIS_WORKFLOW.md.L538s_JA.js` | other | 92.6 KB | 325 | 3761 |
| `.vitepress/dist/assets/guides_CLAUDE_ANALYSIS_WORKFLOW.md.L538s_JA.lean.js` | other | 821 B | 2 | 41 |
| `.vitepress/dist/assets/guides_CLAUDE_DESKTOP_OAUTH_SETUP.md.DAFWLsLe.js` | other | 44.8 KB | 153 | 2097 |
| `.vitepress/dist/assets/guides_CLAUDE_DESKTOP_OAUTH_SETUP.md.DAFWLsLe.lean.js` | other | 962 B | 2 | 53 |
| `.vitepress/dist/assets/guides_CLAUDE_DESKTOP_SETUP.md.CbiOtiZ6.js` | other | 115.1 KB | 262 | 4653 |
| `.vitepress/dist/assets/guides_CLAUDE_DESKTOP_SETUP.md.CbiOtiZ6.lean.js` | other | 838 B | 2 | 45 |
| `.vitepress/dist/assets/guides_CONFIRMATION_GUIDE.md.CSIQY5io.js` | other | 34.4 KB | 106 | 1451 |
| `.vitepress/dist/assets/guides_CONFIRMATION_GUIDE.md.CSIQY5io.lean.js` | other | 859 B | 2 | 55 |
| `.vitepress/dist/assets/guides_DEPLOYMENT.md.K1t7Hotn.js` | other | 226.6 KB | 902 | 7300 |
| `.vitepress/dist/assets/guides_DEPLOYMENT.md.K1t7Hotn.lean.js` | other | 780 B | 2 | 33 |
| `.vitepress/dist/assets/guides_ERROR_HANDLING.md.DrRTdYxe.js` | other | 110.3 KB | 294 | 3685 |
| `.vitepress/dist/assets/guides_ERROR_HANDLING.md.DrRTdYxe.lean.js` | other | 772 B | 2 | 41 |
| `.vitepress/dist/assets/guides_ERROR_RECOVERY.md.Bjj8bS2_.js` | other | 196.5 KB | 562 | 6745 |
| `.vitepress/dist/assets/guides_ERROR_RECOVERY.md.Bjj8bS2_.lean.js` | other | 636 B | 2 | 23 |
| `.vitepress/dist/assets/guides_error-recovery.md.BEi3MrEr.js` | other | 129.4 KB | 357 | 4709 |
| `.vitepress/dist/assets/guides_error-recovery.md.BEi3MrEr.lean.js` | other | 683 B | 2 | 29 |
| `.vitepress/dist/assets/guides_FEATURE_FLAGS.md.Cw9_nNZJ.js` | other | 39.8 KB | 29 | 2061 |
| `.vitepress/dist/assets/guides_FEATURE_FLAGS.md.Cw9_nNZJ.lean.js` | other | 737 B | 2 | 35 |
| `.vitepress/dist/assets/guides_FIREWALL_CONFIGURATION.md.BVgqmJm5.js` | other | 40.9 KB | 105 | 1742 |
| `.vitepress/dist/assets/guides_FIREWALL_CONFIGURATION.md.BVgqmJm5.lean.js` | other | 951 B | 2 | 61 |
| `.vitepress/dist/assets/guides_FIRST_TIME_USER.md.CptT9xFy.js` | other | 11.9 KB | 2 | 788 |
| `.vitepress/dist/assets/guides_FIRST_TIME_USER.md.CptT9xFy.lean.js` | other | 804 B | 2 | 45 |
| `.vitepress/dist/assets/guides_GRAPHQL_API.md.6Va0Aj97.js` | other | 112.9 KB | 339 | 4006 |
| `.vitepress/dist/assets/guides_GRAPHQL_API.md.6Va0Aj97.lean.js` | other | 684 B | 2 | 33 |
| `.vitepress/dist/assets/guides_INSTALLATION_GUIDE.md.CS8SmAWg.js` | other | 42.6 KB | 72 | 1879 |
| `.vitepress/dist/assets/guides_INSTALLATION_GUIDE.md.CS8SmAWg.lean.js` | other | 788 B | 2 | 35 |
| `.vitepress/dist/assets/guides_MIGRATION_V1_TO_V2.md.C730Exj2.js` | other | 87.8 KB | 184 | 3131 |
| `.vitepress/dist/assets/guides_MIGRATION_V1_TO_V2.md.C730Exj2.lean.js` | other | 740 B | 2 | 37 |
| `.vitepress/dist/assets/guides_MONITORING.md.wRVMaGIy.js` | other | 353.8 KB | 1122 | 12495 |
| `.vitepress/dist/assets/guides_MONITORING.md.wRVMaGIy.lean.js` | other | 1.0 KB | 2 | 55 |
| `.vitepress/dist/assets/guides_OAUTH_INCREMENTAL_CONSENT.md.CWU1yiFJ.js` | other | 34.3 KB | 61 | 1572 |
| `.vitepress/dist/assets/guides_OAUTH_INCREMENTAL_CONSENT.md.CWU1yiFJ.lean.js` | other | 996 B | 2 | 59 |
| `.vitepress/dist/assets/guides_OAUTH_STANDARDIZED_SETUP.md.CdVetp6P.js` | other | 28.3 KB | 46 | 1365 |
| `.vitepress/dist/assets/guides_OAUTH_STANDARDIZED_SETUP.md.CdVetp6P.lean.js` | other | 879 B | 2 | 47 |
| `.vitepress/dist/assets/guides_OAUTH_USER_SETUP.md.DGzZwTjK.js` | other | 28.4 KB | 54 | 1454 |
| `.vitepress/dist/assets/guides_OAUTH_USER_SETUP.md.DGzZwTjK.lean.js` | other | 898 B | 2 | 55 |
| `.vitepress/dist/assets/guides_PERFORMANCE.md.DZwqLT2W.js` | other | 262.6 KB | 665 | 10092 |
| `.vitepress/dist/assets/guides_PERFORMANCE.md.DZwqLT2W.lean.js` | other | 974 B | 2 | 51 |
| `.vitepress/dist/assets/guides_PROMPTS_GUIDE.md.C1nElu1d.js` | other | 18.6 KB | 20 | 1047 |
| `.vitepress/dist/assets/guides_PROMPTS_GUIDE.md.C1nElu1d.lean.js` | other | 799 B | 2 | 47 |
| `.vitepress/dist/assets/guides_QUICKSTART_CREDENTIALS.md.B5Z6QbKs.js` | other | 18.6 KB | 30 | 976 |
| `.vitepress/dist/assets/guides_QUICKSTART_CREDENTIALS.md.B5Z6QbKs.lean.js` | other | 821 B | 2 | 45 |
| `.vitepress/dist/assets/guides_quota-optimization.md.C2f86ds8.js` | other | 74.3 KB | 181 | 2997 |
| `.vitepress/dist/assets/guides_quota-optimization.md.C2f86ds8.lean.js` | other | 703 B | 2 | 29 |
| `.vitepress/dist/assets/guides_SCHEMA_VERSIONING.md.aLwQnjOV.js` | other | 78.3 KB | 168 | 2950 |
| `.vitepress/dist/assets/guides_SCHEMA_VERSIONING.md.aLwQnjOV.lean.js` | other | 742 B | 2 | 35 |
| `.vitepress/dist/assets/guides_sheets_appsscript.md.BeBaGai7.js` | other | 162.6 KB | 378 | 5578 |
| `.vitepress/dist/assets/guides_sheets_appsscript.md.BeBaGai7.lean.js` | other | 693 B | 2 | 27 |
| `.vitepress/dist/assets/guides_sheets_bigquery.md.BRN3jGkW.js` | other | 182.4 KB | 444 | 6211 |
| `.vitepress/dist/assets/guides_sheets_bigquery.md.BRN3jGkW.lean.js` | other | 703 B | 2 | 27 |
| `.vitepress/dist/assets/guides_sheets_dependencies.md.Blix_VTP.js` | other | 123.3 KB | 307 | 4624 |
| `.vitepress/dist/assets/guides_sheets_dependencies.md.Blix_VTP.lean.js` | other | 719 B | 2 | 25 |
| `.vitepress/dist/assets/guides_sheets_webhook.md.ChjjGGlj.js` | other | 140.4 KB | 336 | 5210 |
| `.vitepress/dist/assets/guides_sheets_webhook.md.ChjjGGlj.lean.js` | other | 674 B | 2 | 23 |
| `.vitepress/dist/assets/guides_SKILL.md.BeKjRXYI.js` | other | 91.3 KB | 280 | 3871 |
| `.vitepress/dist/assets/guides_SKILL.md.BeKjRXYI.lean.js` | other | 1.0 KB | 2 | 72 |
| `.vitepress/dist/assets/guides_SMART_CHIPS.md.CZWXnT_8.js` | other | 106.3 KB | 246 | 4124 |
| `.vitepress/dist/assets/guides_SMART_CHIPS.md.CZWXnT_8.lean.js` | other | 681 B | 2 | 27 |
| `.vitepress/dist/assets/guides_SUBMISSION_CHECKLIST.md.DVC1ZUjC.js` | other | 8.8 KB | 7 | 547 |
| `.vitepress/dist/assets/guides_SUBMISSION_CHECKLIST.md.DVC1ZUjC.lean.js` | other | 803 B | 2 | 35 |
| `.vitepress/dist/assets/guides_TABLE_MANAGEMENT.md.bynqxvje.js` | other | 105.8 KB | 232 | 3966 |
| `.vitepress/dist/assets/guides_TABLE_MANAGEMENT.md.bynqxvje.lean.js` | other | 708 B | 2 | 27 |
| `.vitepress/dist/assets/guides_TEST_ACCOUNT_SETUP.md.DzzqZecB.js` | other | 29.4 KB | 2 | 1080 |
| `.vitepress/dist/assets/guides_TEST_ACCOUNT_SETUP.md.DzzqZecB.lean.js` | other | 901 B | 2 | 51 |
| `.vitepress/dist/assets/guides_TROUBLESHOOTING.md.BXLgGtt2.js` | other | 143.0 KB | 416 | 5903 |
| `.vitepress/dist/assets/guides_TROUBLESHOOTING.md.BXLgGtt2.lean.js` | other | 798 B | 2 | 37 |
| `.vitepress/dist/assets/guides_USAGE_GUIDE.md.BHyPENO5.js` | other | 145.4 KB | 387 | 5730 |
| `.vitepress/dist/assets/guides_USAGE_GUIDE.md.BHyPENO5.lean.js` | other | 728 B | 2 | 33 |
| `.vitepress/dist/assets/index.md.BCT_4dZ7.js` | other | 4.9 KB | 9 | 250 |
| `.vitepress/dist/assets/index.md.BCT_4dZ7.lean.js` | other | 1.8 KB | 2 | 110 |
| `.vitepress/dist/assets/inter-italic-cyrillic-ext.r48I6akx.woff2` | other | 42.1 KB | 162 | 955 |
| `.vitepress/dist/assets/inter-italic-cyrillic.By2_1cv3.woff2` | other | 30.6 KB | 118 | 725 |
| `.vitepress/dist/assets/inter-italic-greek-ext.1u6EdAuj.woff2` | other | 17.0 KB | 53 | 391 |
| `.vitepress/dist/assets/inter-italic-greek.DJ8dCoTZ.woff2` | other | 31.8 KB | 117 | 715 |
| `.vitepress/dist/assets/inter-italic-latin-ext.CN1xVJS-.woff2` | other | 118.0 KB | 485 | 2693 |
| `.vitepress/dist/assets/inter-italic-latin.C2AdPX0b.woff2` | other | 73.0 KB | 268 | 1632 |
| `.vitepress/dist/assets/inter-italic-vietnamese.BSbpV94h.woff2` | other | 14.5 KB | 74 | 348 |
| `.vitepress/dist/assets/inter-roman-cyrillic-ext.BBPuwvHQ.woff2` | other | 39.5 KB | 170 | 929 |
| `.vitepress/dist/assets/inter-roman-cyrillic.C5lxZ8CY.woff2` | other | 28.5 KB | 124 | 685 |
| `.vitepress/dist/assets/inter-roman-greek-ext.CqjqNYQ-.woff2` | other | 15.9 KB | 64 | 350 |
| `.vitepress/dist/assets/inter-roman-greek.BBVDIX6e.woff2` | other | 29.2 KB | 102 | 660 |
| `.vitepress/dist/assets/inter-roman-latin-ext.4ZJIpNVo.woff2` | other | 107.6 KB | 443 | 2474 |
| `.vitepress/dist/assets/inter-roman-latin.Di8DUHzh.woff2` | other | 66.2 KB | 262 | 1532 |
| `.vitepress/dist/assets/inter-roman-vietnamese.BjW4sHH5.woff2` | other | 13.7 KB | 58 | 324 |
| `.vitepress/dist/assets/operations_backup-restore.md.DGEzC3EM.js` | other | 103.6 KB | 296 | 3960 |
| `.vitepress/dist/assets/operations_backup-restore.md.DGEzC3EM.lean.js` | other | 967 B | 2 | 58 |
| `.vitepress/dist/assets/operations_certificate-rotation.md.unVtX2z4.js` | other | 99.0 KB | 317 | 3860 |
| `.vitepress/dist/assets/operations_certificate-rotation.md.unVtX2z4.lean.js` | other | 965 B | 2 | 52 |
| `.vitepress/dist/assets/operations_COST_ATTRIBUTION.md.TM3EUa1j.js` | other | 93.1 KB | 169 | 3344 |
| `.vitepress/dist/assets/operations_COST_ATTRIBUTION.md.TM3EUa1j.lean.js` | other | 787 B | 2 | 39 |
| `.vitepress/dist/assets/operations_DEGRADATION_MODES.md.D_eWxPxh.js` | other | 31.5 KB | 57 | 1597 |
| `.vitepress/dist/assets/operations_DEGRADATION_MODES.md.D_eWxPxh.lean.js` | other | 824 B | 2 | 33 |
| `.vitepress/dist/assets/operations_disaster-recovery.md.BJnlpzyX.js` | other | 48.7 KB | 163 | 2069 |
| `.vitepress/dist/assets/operations_disaster-recovery.md.BJnlpzyX.lean.js` | other | 719 B | 2 | 32 |
| `.vitepress/dist/assets/operations_high-error-rate.md.B_5MLQ_A.js` | other | 72.9 KB | 180 | 3036 |
| `.vitepress/dist/assets/operations_high-error-rate.md.B_5MLQ_A.lean.js` | other | 684 B | 2 | 28 |
| `.vitepress/dist/assets/operations_jwt-secret-rotation.md.Qd4bOmf-.js` | other | 45.7 KB | 102 | 2208 |
| `.vitepress/dist/assets/operations_jwt-secret-rotation.md.Qd4bOmf-.lean.js` | other | 975 B | 2 | 62 |
| `.vitepress/dist/assets/operations_METRICS_REFERENCE.md.DQNozl4O.js` | other | 70.3 KB | 203 | 2890 |
| `.vitepress/dist/assets/operations_METRICS_REFERENCE.md.DQNozl4O.lean.js` | other | 832 B | 2 | 42 |
| `.vitepress/dist/assets/operations_migrations.md.CIZ8-3RH.js` | other | 90.7 KB | 285 | 3581 |
| `.vitepress/dist/assets/operations_migrations.md.CIZ8-3RH.lean.js` | other | 884 B | 2 | 48 |
| `.vitepress/dist/assets/operations_REQUEST_REPLAY.md.NG4pNsxK.js` | other | 102.4 KB | 238 | 3531 |
| `.vitepress/dist/assets/operations_REQUEST_REPLAY.md.NG4pNsxK.lean.js` | other | 753 B | 2 | 39 |
| `.vitepress/dist/assets/operations_scaling.md.DNLwnoRW.js` | other | 108.3 KB | 345 | 4164 |
| `.vitepress/dist/assets/operations_scaling.md.DNLwnoRW.lean.js` | other | 902 B | 2 | 52 |
| `.vitepress/dist/assets/operations_TRACING_DASHBOARD.md.BikPubkx.js` | other | 7.5 KB | 16 | 354 |
| `.vitepress/dist/assets/operations_TRACING_DASHBOARD.md.BikPubkx.lean.js` | other | 784 B | 2 | 37 |
| `.vitepress/dist/assets/README.md.DrCnIUl4.js` | other | 7.0 KB | 5 | 360 |
| `.vitepress/dist/assets/README.md.DrCnIUl4.lean.js` | other | 650 B | 2 | 31 |
| `.vitepress/dist/assets/reference_ACTION_NAMING_STANDARD.md.C8ZFLaP6.js` | other | 19.9 KB | 23 | 1095 |
| `.vitepress/dist/assets/reference_ACTION_NAMING_STANDARD.md.C8ZFLaP6.lean.js` | other | 765 B | 2 | 35 |
| `.vitepress/dist/assets/reference_api_API_MCP_MAPPING_MATRIX.md.7IdkNPvo.js` | other | 62.9 KB | 292 | 2439 |
| `.vitepress/dist/assets/reference_api_API_MCP_MAPPING_MATRIX.md.7IdkNPvo.lean.js` | other | 845 B | 2 | 47 |
| `.vitepress/dist/assets/reference_api_API-COMPLIANCE-MATRIX.md.BirF5gll.js` | other | 53.2 KB | 95 | 1556 |
| `.vitepress/dist/assets/reference_api_API-COMPLIANCE-MATRIX.md.BirF5gll.lean.js` | other | 874 B | 2 | 53 |
| `.vitepress/dist/assets/reference_API_CONSISTENCY.md.CqmrlxUu.js` | other | 78.3 KB | 146 | 2935 |
| `.vitepress/dist/assets/reference_API_CONSISTENCY.md.CqmrlxUu.lean.js` | other | 787 B | 2 | 37 |
| `.vitepress/dist/assets/reference_api_GOOGLE_SHEETS_API_V4_MCP_AUDIT.md.vrZEDy8y.js` | other | 42.0 KB | 57 | 1479 |
| `.vitepress/dist/assets/reference_api_GOOGLE_SHEETS_API_V4_MCP_AUDIT.md.vrZEDy8y.lean.js` | other | 882 B | 2 | 53 |
| `.vitepress/dist/assets/reference_API_MCP_REFERENCE.md.Dpqp7ZcN.js` | other | 139.2 KB | 372 | 5106 |
| `.vitepress/dist/assets/reference_API_MCP_REFERENCE.md.Dpqp7ZcN.lean.js` | other | 844 B | 2 | 53 |
| `.vitepress/dist/assets/reference_COMPARISON_MATRIX.md.NSTAIEDf.js` | other | 22.9 KB | 34 | 1013 |
| `.vitepress/dist/assets/reference_COMPARISON_MATRIX.md.NSTAIEDf.lean.js` | other | 791 B | 2 | 41 |
| `.vitepress/dist/assets/reference_knowledge.md.CoAn5x1F.js` | other | 25.9 KB | 57 | 1243 |
| `.vitepress/dist/assets/reference_knowledge.md.CoAn5x1F.lean.js` | other | 830 B | 2 | 47 |
| `.vitepress/dist/assets/reference_METRICS_DASHBOARD.md.CGXR6k1T.js` | other | 7.8 KB | 4 | 290 |
| `.vitepress/dist/assets/reference_METRICS_DASHBOARD.md.CGXR6k1T.lean.js` | other | 727 B | 2 | 35 |
| `.vitepress/dist/assets/reference_resources.md.CO9_6HyP.js` | other | 41.9 KB | 61 | 1834 |
| `.vitepress/dist/assets/reference_resources.md.CO9_6HyP.lean.js` | other | 783 B | 2 | 43 |
| `.vitepress/dist/assets/reference_SERVALSHEETS_ANALYSIS_AND_BEST_PRACTICES.md.uNEcZVDU.js` | other | 55.5 KB | 104 | 2735 |
| `.vitepress/dist/assets/reference_SERVALSHEETS_ANALYSIS_AND_BEST_PRACTICES.md.uNEcZVDU.lean.js` | other | 1.2 KB | 2 | 77 |
| `.vitepress/dist/assets/reference_tools_sheets_data.md.-0jFUrnj.js` | other | 88.3 KB | 235 | 3010 |
| `.vitepress/dist/assets/reference_tools_sheets_data.md.-0jFUrnj.lean.js` | other | 728 B | 2 | 33 |
| `.vitepress/dist/assets/reference_tools.md.DmEFdG0B.js` | other | 23.3 KB | 49 | 839 |
| `.vitepress/dist/assets/reference_tools.md.DmEFdG0B.lean.js` | other | 776 B | 2 | 49 |
| `.vitepress/dist/assets/releases_RELEASE_NOTES_v1.6.0.md.DrRfdrbs.js` | other | 34.5 KB | 86 | 1621 |
| `.vitepress/dist/assets/releases_RELEASE_NOTES_v1.6.0.md.DrRfdrbs.lean.js` | other | 679 B | 2 | 27 |
| `.vitepress/dist/assets/runbooks_auth-failures.md.BJILThGw.js` | other | 64.9 KB | 198 | 2647 |
| `.vitepress/dist/assets/runbooks_auth-failures.md.BJILThGw.lean.js` | other | 716 B | 2 | 25 |
| `.vitepress/dist/assets/runbooks_circuit-breaker.md.f9SQN-dM.js` | other | 38.2 KB | 73 | 1695 |
| `.vitepress/dist/assets/runbooks_circuit-breaker.md.f9SQN-dM.lean.js` | other | 751 B | 2 | 29 |
| `.vitepress/dist/assets/runbooks_google-api-errors.md.BLOJnJyf.js` | other | 30.4 KB | 66 | 1362 |
| `.vitepress/dist/assets/runbooks_google-api-errors.md.BLOJnJyf.lean.js` | other | 678 B | 2 | 27 |
| `.vitepress/dist/assets/runbooks_high-error-rate.md.CeLc7-2M.js` | other | 21.1 KB | 37 | 967 |
| `.vitepress/dist/assets/runbooks_high-error-rate.md.CeLc7-2M.lean.js` | other | 649 B | 2 | 27 |
| `.vitepress/dist/assets/runbooks_high-latency.md.BLd3tc09.js` | other | 27.4 KB | 51 | 1182 |
| `.vitepress/dist/assets/runbooks_high-latency.md.BLd3tc09.lean.js` | other | 630 B | 2 | 25 |
| `.vitepress/dist/assets/runbooks_low-cache-hit-rate.md.CoA3KRbn.js` | other | 37.0 KB | 78 | 1602 |
| `.vitepress/dist/assets/runbooks_low-cache-hit-rate.md.CoA3KRbn.lean.js` | other | 668 B | 2 | 29 |
| `.vitepress/dist/assets/runbooks_memory-exhaustion.md.DoYx35eg.js` | other | 24.7 KB | 48 | 1054 |
| `.vitepress/dist/assets/runbooks_memory-exhaustion.md.DoYx35eg.lean.js` | other | 665 B | 2 | 25 |
| `.vitepress/dist/assets/runbooks_quota-near-limit.md.-Xzwev8O.js` | other | 27.0 KB | 48 | 1250 |
| `.vitepress/dist/assets/runbooks_quota-near-limit.md.-Xzwev8O.lean.js` | other | 687 B | 2 | 31 |
| `.vitepress/dist/assets/runbooks_README.md.DbQFOLro.js` | other | 29.7 KB | 65 | 1440 |
| `.vitepress/dist/assets/runbooks_README.md.DbQFOLro.lean.js` | other | 808 B | 2 | 37 |
| `.vitepress/dist/assets/runbooks_request-queue-backup.md.CPkULSR8.js` | other | 15.2 KB | 14 | 906 |
| `.vitepress/dist/assets/runbooks_request-queue-backup.md.CPkULSR8.lean.js` | other | 711 B | 2 | 27 |
| `.vitepress/dist/assets/runbooks_service-down.md.DJMmGVxk.js` | other | 69.1 KB | 201 | 2623 |
| `.vitepress/dist/assets/runbooks_service-down.md.DJMmGVxk.lean.js` | other | 655 B | 2 | 25 |
| `.vitepress/dist/assets/runbooks_slow-google-api.md.ClhbepWa.js` | other | 35.6 KB | 81 | 1548 |
| `.vitepress/dist/assets/runbooks_slow-google-api.md.ClhbepWa.lean.js` | other | 676 B | 2 | 29 |
| `.vitepress/dist/assets/security_HTTP_AUTH.md.CoeU2bUD.js` | other | 13.6 KB | 17 | 689 |
| `.vitepress/dist/assets/security_HTTP_AUTH.md.CoeU2bUD.lean.js` | other | 725 B | 2 | 33 |
| `.vitepress/dist/assets/security_MULTI_TENANCY.md.CzBGXejq.js` | other | 339.3 KB | 948 | 11571 |
| `.vitepress/dist/assets/security_MULTI_TENANCY.md.CzBGXejq.lean.js` | other | 731 B | 2 | 33 |
| `.vitepress/dist/assets/security_RBAC_GUIDE.md.DrmtYwub.js` | other | 113.5 KB | 251 | 4253 |
| `.vitepress/dist/assets/security_RBAC_GUIDE.md.DrmtYwub.lean.js` | other | 692 B | 2 | 31 |
| `.vitepress/dist/assets/security_WEBHOOK_SECURITY.md.T6Gbb6dq.js` | other | 96.6 KB | 267 | 3437 |
| `.vitepress/dist/assets/security_WEBHOOK_SECURITY.md.T6Gbb6dq.lean.js` | other | 737 B | 2 | 35 |
| `.vitepress/dist/assets/style.BhTTQ9Cb.css` | other | 112.2 KB | 2 | 2308 |
| `.vitepress/dist/audits/MCP_LLM_QUALITY_AUDIT_2026-03-07.html` | web | 112.2 KB | 127 | 5424 |
| `.vitepress/dist/audits/PRODUCTION_GO_LIVE_2026-03-05.html` | web | 33.4 KB | 30 | 1120 |
| `.vitepress/dist/compliance/AUDIT_LOGGING.html` | web | 100.5 KB | 194 | 3844 |
| `.vitepress/dist/compliance/MCP_2025-11-25_COMPLIANCE_CHECKLIST.html` | web | 89.9 KB | 114 | 2948 |
| `.vitepress/dist/deployment/aws.html` | web | 43.4 KB | 70 | 1476 |
| `.vitepress/dist/deployment/docker.html` | web | 48.5 KB | 91 | 1591 |
| `.vitepress/dist/deployment/gcp.html` | web | 48.3 KB | 87 | 1664 |
| `.vitepress/dist/deployment/helm.html` | web | 51.4 KB | 99 | 1651 |
| `.vitepress/dist/deployment/index.html` | web | 44.3 KB | 68 | 1510 |
| `.vitepress/dist/deployment/kubernetes.html` | web | 266.7 KB | 772 | 9020 |
| `.vitepress/dist/deployment/pm2.html` | web | 82.1 KB | 137 | 3016 |
| `.vitepress/dist/development/ACTION_REGISTRY.html` | web | 46.3 KB | 30 | 1665 |
| `.vitepress/dist/development/ADDING_A_HANDLER.html` | web | 194.9 KB | 577 | 6684 |
| `.vitepress/dist/development/ADDING_AN_ACTION.html` | web | 131.0 KB | 356 | 4961 |
| `.vitepress/dist/development/ARCHITECTURE.html` | web | 71.0 KB | 173 | 2974 |
| `.vitepress/dist/development/DEBUGGING_AND_TESTING.html` | web | 84.9 KB | 153 | 3065 |
| `.vitepress/dist/development/DEBUGGING.html` | web | 103.8 KB | 217 | 3984 |
| `.vitepress/dist/development/DEVELOPER_WORKFLOW.html` | web | 283.1 KB | 781 | 11086 |
| `.vitepress/dist/development/DOCUMENTATION.html` | web | 32.3 KB | 30 | 1101 |
| `.vitepress/dist/development/DURABLE_SCHEMA_PATTERN.html` | web | 111.3 KB | 200 | 3810 |
| `.vitepress/dist/development/HANDLER_PATTERNS.html` | web | 213.2 KB | 569 | 6371 |
| `.vitepress/dist/development/IMPLEMENTATION_GUARDRAILS.html` | web | 160.6 KB | 404 | 6036 |
| `.vitepress/dist/development/MCP_INSPECTOR_TESTING_GUIDE.html` | web | 73.6 KB | 133 | 2947 |
| `.vitepress/dist/development/ONBOARDING.html` | web | 118.5 KB | 314 | 4843 |
| `.vitepress/dist/development/PERFORMANCE_TARGETS.html` | web | 67.3 KB | 78 | 2576 |
| `.vitepress/dist/development/SCRIPTS_REFERENCE.html` | web | 183.2 KB | 476 | 7951 |
| `.vitepress/dist/development/SOURCE_OF_TRUTH.html` | web | 57.8 KB | 97 | 2216 |
| `.vitepress/dist/development/TESTING.html` | web | 468.4 KB | 1403 | 14339 |
| `.vitepress/dist/development/testing/CI_SETUP.html` | web | 100.1 KB | 270 | 3592 |
| `.vitepress/dist/development/testing/INTEGRATION_TEST_SETUP.html` | web | 51.8 KB | 58 | 2184 |
| `.vitepress/dist/development/testing/INTEGRATION_TESTS_SUMMARY.html` | web | 55.7 KB | 75 | 2368 |
| `.vitepress/dist/development/testing/QUICK_START.html` | web | 37.2 KB | 41 | 1390 |
| `.vitepress/dist/development/testing/TEST_DATA.html` | web | 52.8 KB | 90 | 1774 |
| `.vitepress/dist/development/testing/TEST_PATTERNS.html` | web | 125.4 KB | 284 | 4365 |
| `.vitepress/dist/development/VSCODE_SETUP.html` | web | 76.4 KB | 117 | 3062 |
| `.vitepress/dist/examples/analysis.html` | web | 70.8 KB | 93 | 3176 |
| `.vitepress/dist/examples/basic.html` | web | 52.6 KB | 66 | 2265 |
| `.vitepress/dist/examples/charts.html` | web | 78.0 KB | 135 | 3611 |
| `.vitepress/dist/examples/formatting.html` | web | 66.3 KB | 79 | 3106 |
| `.vitepress/dist/examples/index.html` | web | 30.9 KB | 30 | 1080 |
| `.vitepress/dist/examples/oauth.html` | web | 69.5 KB | 108 | 3079 |
| `.vitepress/dist/guides/ACTION_REFERENCE.html` | web | 36.0 KB | 34 | 1338 |
| `.vitepress/dist/guides/ADAPTIVE_BATCH_WINDOW_GUIDE.html` | web | 72.4 KB | 112 | 2785 |
| `.vitepress/dist/guides/batching-strategies.html` | web | 106.8 KB | 252 | 3977 |
| `.vitepress/dist/guides/caching-patterns.html` | web | 111.3 KB | 229 | 4132 |
| `.vitepress/dist/guides/CLAUDE_ANALYSIS_WORKFLOW.html` | web | 120.8 KB | 353 | 4633 |
| `.vitepress/dist/guides/CLAUDE_DESKTOP_OAUTH_SETUP.html` | web | 73.0 KB | 181 | 2963 |
| `.vitepress/dist/guides/CLAUDE_DESKTOP_SETUP.html` | web | 143.5 KB | 290 | 5534 |
| `.vitepress/dist/guides/CONFIRMATION_GUIDE.html` | web | 62.6 KB | 134 | 2316 |
| `.vitepress/dist/guides/DEPLOYMENT.html` | web | 255.1 KB | 930 | 8187 |
| `.vitepress/dist/guides/ERROR_HANDLING.html` | web | 138.6 KB | 322 | 4557 |
| `.vitepress/dist/guides/ERROR_RECOVERY.html` | web | 224.7 KB | 590 | 7626 |
| `.vitepress/dist/guides/error-recovery.html` | web | 157.7 KB | 385 | 5587 |
| `.vitepress/dist/guides/FEATURE_FLAGS.html` | web | 68.1 KB | 57 | 2936 |
| `.vitepress/dist/guides/FIREWALL_CONFIGURATION.html` | web | 69.1 KB | 133 | 2604 |
| `.vitepress/dist/guides/FIRST_TIME_USER.html` | web | 40.2 KB | 31 | 1659 |
| `.vitepress/dist/guides/GRAPHQL_API.html` | web | 141.2 KB | 367 | 4882 |
| `.vitepress/dist/guides/INSTALLATION_GUIDE.html` | web | 71.1 KB | 100 | 2768 |
| `.vitepress/dist/guides/MIGRATION_V1_TO_V2.html` | web | 116.1 KB | 212 | 4005 |
| `.vitepress/dist/guides/MONITORING.html` | web | 382.0 KB | 1150 | 13370 |
| `.vitepress/dist/guides/OAUTH_INCREMENTAL_CONSENT.html` | web | 62.5 KB | 89 | 2435 |
| `.vitepress/dist/guides/OAUTH_STANDARDIZED_SETUP.html` | web | 56.5 KB | 74 | 2234 |
| `.vitepress/dist/guides/OAUTH_USER_SETUP.html` | web | 56.8 KB | 82 | 2330 |
| `.vitepress/dist/guides/PERFORMANCE.html` | web | 290.9 KB | 693 | 10969 |
| `.vitepress/dist/guides/PROMPTS_GUIDE.html` | web | 47.1 KB | 48 | 1928 |
| `.vitepress/dist/guides/QUICKSTART_CREDENTIALS.html` | web | 47.1 KB | 58 | 1859 |
| `.vitepress/dist/guides/quota-optimization.html` | web | 102.6 KB | 209 | 3875 |
| `.vitepress/dist/guides/SCHEMA_VERSIONING.html` | web | 106.6 KB | 196 | 3825 |
| `.vitepress/dist/guides/sheets_appsscript.html` | web | 190.9 KB | 406 | 6457 |
| `.vitepress/dist/guides/sheets_bigquery.html` | web | 210.6 KB | 472 | 7090 |
| `.vitepress/dist/guides/sheets_dependencies.html` | web | 151.6 KB | 335 | 5504 |
| `.vitepress/dist/guides/sheets_webhook.html` | web | 168.7 KB | 364 | 6091 |
| `.vitepress/dist/guides/SKILL.html` | web | 119.5 KB | 308 | 4739 |
| `.vitepress/dist/guides/SMART_CHIPS.html` | web | 134.6 KB | 274 | 5003 |
| `.vitepress/dist/guides/SUBMISSION_CHECKLIST.html` | web | 37.0 KB | 35 | 1422 |
| `.vitepress/dist/guides/TABLE_MANAGEMENT.html` | web | 134.1 KB | 260 | 4845 |
| `.vitepress/dist/guides/TEST_ACCOUNT_SETUP.html` | web | 57.6 KB | 45 | 1962 |
| `.vitepress/dist/guides/TROUBLESHOOTING.html` | web | 171.3 KB | 444 | 6776 |
| `.vitepress/dist/guides/USAGE_GUIDE.html` | web | 173.9 KB | 415 | 6618 |
| `.vitepress/dist/hashmap.json` | data | 5.1 KB | 2 | 1 |
| `.vitepress/dist/index.html` | web | 28.3 KB | 37 | 916 |
| `.vitepress/dist/logo.svg` | image | 6 B | 0 | 0 |
| `.vitepress/dist/operations/backup-restore.html` | web | 129.0 KB | 324 | 4682 |
| `.vitepress/dist/operations/certificate-rotation.html` | web | 124.3 KB | 345 | 4572 |
| `.vitepress/dist/operations/COST_ATTRIBUTION.html` | web | 118.4 KB | 197 | 4063 |
| `.vitepress/dist/operations/DEGRADATION_MODES.html` | web | 56.8 KB | 85 | 2318 |
| `.vitepress/dist/operations/disaster-recovery.html` | web | 74.3 KB | 191 | 2806 |
| `.vitepress/dist/operations/high-error-rate.html` | web | 98.2 KB | 208 | 3760 |
| `.vitepress/dist/operations/jwt-secret-rotation.html` | web | 70.9 KB | 130 | 2915 |
| `.vitepress/dist/operations/METRICS_REFERENCE.html` | web | 95.6 KB | 231 | 3609 |
| `.vitepress/dist/operations/migrations.html` | web | 116.0 KB | 313 | 4297 |
| `.vitepress/dist/operations/REQUEST_REPLAY.html` | web | 127.8 KB | 266 | 4250 |
| `.vitepress/dist/operations/scaling.html` | web | 133.8 KB | 373 | 4890 |
| `.vitepress/dist/operations/TRACING_DASHBOARD.html` | web | 32.8 KB | 44 | 1074 |
| `.vitepress/dist/README.html` | web | 29.4 KB | 33 | 932 |
| `.vitepress/dist/reference/ACTION_NAMING_STANDARD.html` | web | 46.8 KB | 51 | 1900 |
| `.vitepress/dist/reference/API_CONSISTENCY.html` | web | 105.2 KB | 174 | 3742 |
| `.vitepress/dist/reference/API_MCP_REFERENCE.html` | web | 166.1 KB | 400 | 5903 |
| `.vitepress/dist/reference/api/API_MCP_MAPPING_MATRIX.html` | web | 89.5 KB | 320 | 3226 |
| `.vitepress/dist/reference/api/API-COMPLIANCE-MATRIX.html` | web | 79.8 KB | 123 | 2340 |
| `.vitepress/dist/reference/api/GOOGLE_SHEETS_API_V4_MCP_AUDIT.html` | web | 68.7 KB | 85 | 2263 |
| `.vitepress/dist/reference/COMPARISON_MATRIX.html` | web | 49.6 KB | 62 | 1803 |
| `.vitepress/dist/reference/knowledge.html` | web | 52.8 KB | 85 | 2043 |
| `.vitepress/dist/reference/METRICS_DASHBOARD.html` | web | 34.5 KB | 32 | 1084 |
| `.vitepress/dist/reference/resources.html` | web | 68.7 KB | 89 | 2635 |
| `.vitepress/dist/reference/SERVALSHEETS_ANALYSIS_AND_BEST_PRACTICES.html` | web | 82.0 KB | 132 | 3507 |
| `.vitepress/dist/reference/tools.html` | web | 50.0 KB | 77 | 1629 |
| `.vitepress/dist/reference/tools/sheets_data.html` | web | 115.2 KB | 263 | 3817 |
| `.vitepress/dist/releases/RELEASE_NOTES_v1.6.0.html` | web | 56.9 KB | 114 | 2195 |
| `.vitepress/dist/runbooks/auth-failures.html` | web | 90.2 KB | 226 | 3375 |
| `.vitepress/dist/runbooks/circuit-breaker.html` | web | 63.5 KB | 101 | 2421 |
| `.vitepress/dist/runbooks/google-api-errors.html` | web | 55.7 KB | 94 | 2089 |
| `.vitepress/dist/runbooks/high-error-rate.html` | web | 46.7 KB | 65 | 1708 |
| `.vitepress/dist/runbooks/high-latency.html` | web | 53.0 KB | 79 | 1926 |
| `.vitepress/dist/runbooks/low-cache-hit-rate.html` | web | 62.4 KB | 106 | 2328 |
| `.vitepress/dist/runbooks/memory-exhaustion.html` | web | 50.1 KB | 76 | 1782 |
| `.vitepress/dist/runbooks/quota-near-limit.html` | web | 52.4 KB | 76 | 1975 |
| `.vitepress/dist/runbooks/README.html` | web | 55.0 KB | 93 | 2164 |
| `.vitepress/dist/runbooks/request-queue-backup.html` | web | 40.5 KB | 42 | 1633 |
| `.vitepress/dist/runbooks/service-down.html` | web | 94.7 KB | 229 | 3365 |
| `.vitepress/dist/runbooks/slow-google-api.html` | web | 61.0 KB | 109 | 2276 |
| `.vitepress/dist/security/HTTP_AUTH.html` | web | 38.6 KB | 45 | 1397 |
| `.vitepress/dist/security/MULTI_TENANCY.html` | web | 364.5 KB | 976 | 12290 |
| `.vitepress/dist/security/RBAC_GUIDE.html` | web | 138.7 KB | 279 | 4972 |
| `.vitepress/dist/security/WEBHOOK_SECURITY.html` | web | 121.6 KB | 295 | 4142 |
| `.vitepress/dist/sitemap.xml` | other | 9.6 KB | 1 | 8 |
| `.vitepress/dist/vp-icons.css` | other | 900 B | 1 | 65 |
| `.vitepress/theme/custom.css` | other | 2.4 KB | 162 | 291 |
| `.vitepress/theme/index.ts` | other | 191 B | 10 | 24 |
| `AQUI-VR_EVALUATION.md` | markdown | 47.1 KB | 450 | 5062 |
| `AQUI-VR_FRAMEWORK_IMPROVEMENTS.md` | markdown | 17.2 KB | 381 | 2645 |
| `architecture/architecture.json` | data | 9.6 KB | 259 | 832 |
| `architecture/CONTEXT_LAYERS.md` | markdown | 14.4 KB | 483 | 1599 |
| `audits/AQUI-VR_v3.2_Framework.md` | markdown | 29.3 KB | 692 | 4045 |
| `audits/AUDIT_REPORT.md` | markdown | 18.9 KB | 425 | 2743 |
| `audits/CODEBASE_AUDIT_SUPPLEMENT.md` | markdown | 23.9 KB | 543 | 3356 |
| `audits/CODEBASE_FULL_AUDIT.md` | markdown | 64.7 KB | 1204 | 7627 |
| `audits/DOCS_FOLDER_COMPLETE_AUDIT_2026-03-24.md` | markdown | 26.8 KB | 555 | 3700 |
| `audits/MCP_STARTUP_ANALYSIS.md` | markdown | 25.0 KB | 548 | 3968 |
| `audits/PROJECT_SNAPSHOT.md` | markdown | 16.6 KB | 458 | 2278 |
| `audits/ServalSheets_GitHub_Audit.md` | markdown | 11.6 KB | 245 | 1660 |
| `COMPETITIVE_ANALYSIS.html` | web | 37.6 KB | 899 | 3142 |
| `COMPETITIVE_ANALYSIS.md` | markdown | 13.1 KB | 228 | 2103 |
| `compliance/AUDIT_LOGGING.md` | markdown | 17.2 KB | 690 | 2142 |
| `compliance/MCP_2025-11-25_COMPLIANCE_CHECKLIST.md` | markdown | 20.4 KB | 138 | 1265 |
| `deployment/aws.md` | markdown | 4.6 KB | 137 | 443 |
| `deployment/docker.md` | markdown | 3.0 KB | 139 | 335 |
| `deployment/gcp.md` | markdown | 5.1 KB | 177 | 527 |
| `deployment/helm.md` | markdown | 3.0 KB | 155 | 318 |
| `deployment/index.md` | markdown | 6.8 KB | 148 | 606 |
| `deployment/kubernetes.md` | markdown | 39.9 KB | 1273 | 3896 |
| `deployment/pm2.md` | markdown | 6.1 KB | 408 | 802 |
| `deployment/production-launch-checklist.md` | markdown | 6.4 KB | 156 | 958 |
| `development/ACTION_REGISTRY.md` | markdown | 7.7 KB | 167 | 613 |
| `development/ARCHITECTURE.md` | markdown | 13.4 KB | 310 | 1515 |
| `development/BUILD_OPTIMIZATION.md` | markdown | 7.9 KB | 415 | 1063 |
| `development/CLAUDE_CODE_RULES.md` | markdown | 867 B | 25 | 101 |
| `development/CODEBASE_CONTEXT.md` | markdown | 29.1 KB | 538 | 3233 |
| `development/DEBUGGING_AND_TESTING.md` | markdown | 9.4 KB | 423 | 1097 |
| `development/DEVELOPER_WORKFLOW.md` | markdown | 35.6 KB | 1688 | 4815 |
| `development/DOCUMENTATION.md` | markdown | 14.1 KB | 332 | 1420 |
| `development/DURABLE_SCHEMA_PATTERN.md` | markdown | 12.5 KB | 481 | 1460 |
| `development/FEATURE_PLAN.md` | markdown | 38.4 KB | 813 | 4627 |
| `development/HANDLER_PATTERNS.md` | markdown | 19.5 KB | 670 | 1698 |
| `development/IMPLEMENTATION_GUARDRAILS.md` | markdown | 23.9 KB | 774 | 2817 |
| `development/PERFORMANCE_TARGETS.md` | markdown | 16.8 KB | 394 | 2374 |
| `development/PROJECT_STATUS.md` | markdown | 3.6 KB | 102 | 473 |
| `development/RESPONSE_PIPELINE_FEATURES.md` | markdown | 13.3 KB | 386 | 1537 |
| `development/SCRIPTS_REFERENCE.md` | markdown | 36.2 KB | 1415 | 4865 |
| `development/SOURCE_OF_TRUTH.md` | markdown | 10.6 KB | 316 | 1245 |
| `development/TESTING.md` | markdown | 43.3 KB | 1646 | 4390 |
| `development/testing/CI_SETUP.md` | markdown | 11.2 KB | 441 | 1253 |
| `development/testing/INTEGRATION_TEST_SETUP.md` | markdown | 7.1 KB | 241 | 995 |
| `development/testing/INTEGRATION_TESTS_SUMMARY.md` | markdown | 9.8 KB | 351 | 1172 |
| `development/testing/QUICK_START.md` | markdown | 2.7 KB | 113 | 368 |
| `development/testing/TEST_DATA.md` | markdown | 3.5 KB | 175 | 426 |
| `development/testing/TEST_PATTERNS.md` | markdown | 14.7 KB | 617 | 1638 |
| `development/VSCODE_SETUP.md` | markdown | 13.9 KB | 509 | 1737 |
| `examples/advanced-examples.json` | data | 9.7 KB | 343 | 749 |
| `examples/analysis-examples.json` | data | 13.4 KB | 414 | 1026 |
| `examples/analysis.md` | markdown | 12.8 KB | 622 | 1737 |
| `examples/basic.md` | markdown | 6.4 KB | 317 | 946 |
| `examples/charts.md` | markdown | 11.3 KB | 565 | 1666 |
| `examples/dimensions-examples.json` | data | 6.2 KB | 244 | 504 |
| `examples/error-handling-examples.json` | data | 19.2 KB | 571 | 1606 |
| `examples/format-examples.json` | data | 10.3 KB | 362 | 836 |
| `examples/formatting.md` | markdown | 10.4 KB | 495 | 1503 |
| `examples/index.md` | markdown | 2.4 KB | 91 | 301 |
| `examples/oauth-flow-examples.json` | data | 12.8 KB | 345 | 1130 |
| `examples/oauth.md` | markdown | 11.5 KB | 522 | 1486 |
| `features/AGENT_MODE.md` | markdown | 8.3 KB | 248 | 1124 |
| `features/FEDERATION.md` | markdown | 14.3 KB | 527 | 1697 |
| `features/TRANSACTIONS.md` | markdown | 10.3 KB | 370 | 1284 |
| `guides/ACTION_REFERENCE.md` | markdown | 2.8 KB | 113 | 379 |
| `guides/ADAPTIVE_BATCH_WINDOW_GUIDE.md` | markdown | 7.3 KB | 307 | 957 |
| `guides/ADDING_A_HANDLER.md` | markdown | 21.2 KB | 853 | 2315 |
| `guides/ADDING_AN_ACTION.md` | markdown | 16.1 KB | 697 | 1901 |
| `guides/batching-strategies.md` | markdown | 12.1 KB | 471 | 1748 |
| `guides/caching-patterns.md` | markdown | 13.1 KB | 482 | 1796 |
| `guides/CLAUDE_ANALYSIS_WORKFLOW.md` | markdown | 23.0 KB | 558 | 2254 |
| `guides/CLAUDE_DESKTOP_OAUTH_SETUP.md` | markdown | 10.0 KB | 431 | 1218 |
| `guides/CLAUDE_DESKTOP_SETUP.md` | markdown | 24.6 KB | 923 | 2910 |
| `guides/CONFIRMATION_GUIDE.md` | markdown | 7.6 KB | 276 | 875 |
| `guides/DEBUGGING.md` | markdown | 10.2 KB | 565 | 1415 |
| `guides/DEPLOYMENT.md` | markdown | 25.9 KB | 1179 | 2390 |
| `guides/ERROR_HANDLING.md` | markdown | 11.8 KB | 607 | 1408 |
| `guides/ERROR_RECOVERY.md` | markdown | 24.9 KB | 1067 | 2939 |
| `guides/FEATURE_FLAGS.md` | markdown | 29.5 KB | 359 | 2857 |
| `guides/FIREWALL_CONFIGURATION.md` | markdown | 7.0 KB | 295 | 926 |
| `guides/FIRST_TIME_USER.md` | markdown | 5.0 KB | 203 | 701 |
| `guides/INSTALLATION_GUIDE.md` | markdown | 10.5 KB | 421 | 1283 |
| `guides/MCP_INSPECTOR_TESTING_GUIDE.md` | markdown | 8.9 KB | 450 | 1272 |
| `guides/MONITORING.md` | markdown | 45.9 KB | 1968 | 5133 |
| `guides/OAUTH_INCREMENTAL_CONSENT.md` | markdown | 9.7 KB | 317 | 1102 |
| `guides/OAUTH_STANDARDIZED_SETUP.md` | markdown | 9.0 KB | 347 | 1119 |
| `guides/OAUTH_USER_SETUP.md` | markdown | 7.9 KB | 339 | 1039 |
| `guides/ONBOARDING.md` | markdown | 16.9 KB | 716 | 2167 |
| `guides/PERFORMANCE.md` | markdown | 39.4 KB | 1670 | 5229 |
| `guides/PHASE_3_USER_GUIDE.md` | markdown | 20.0 KB | 883 | 2282 |
| `guides/PROMPTS_GUIDE.md` | markdown | 8.4 KB | 351 | 1077 |
| `guides/QUICKSTART_CREDENTIALS.md` | markdown | 5.6 KB | 204 | 760 |
| `guides/quota-optimization.md` | markdown | 11.2 KB | 415 | 1622 |
| `guides/SCHEMA_VERSIONING.md` | markdown | 11.1 KB | 507 | 1362 |
| `guides/sheets_appsscript.md` | markdown | 29.0 KB | 1242 | 3547 |
| `guides/sheets_bigquery.md` | markdown | 34.3 KB | 1317 | 4041 |
| `guides/sheets_dependencies.md` | markdown | 21.7 KB | 1059 | 2716 |
| `guides/sheets_webhook.md` | markdown | 26.1 KB | 1114 | 3103 |
| `guides/SKILL.md` | markdown | 16.8 KB | 595 | 2228 |
| `guides/SMART_CHIPS.md` | markdown | 19.3 KB | 825 | 2419 |
| `guides/SUBMISSION_CHECKLIST.md` | markdown | 2.9 KB | 93 | 450 |
| `guides/TABLE_MANAGEMENT.md` | markdown | 19.0 KB | 860 | 2415 |
| `guides/TEST_ACCOUNT_SETUP.md` | markdown | 6.1 KB | 224 | 895 |
| `guides/TROUBLESHOOTING.md` | markdown | 21.3 KB | 1040 | 2828 |
| `guides/USAGE_GUIDE.md` | markdown | 25.2 KB | 1021 | 2951 |
| `index.md` | markdown | 3.3 KB | 124 | 400 |
| `operations/backup-restore.md` | markdown | 14.6 KB | 705 | 1869 |
| `operations/certificate-rotation.md` | markdown | 14.4 KB | 633 | 1675 |
| `operations/COST_ATTRIBUTION.md` | markdown | 13.8 KB | 607 | 1690 |
| `operations/DEGRADATION_MODES.md` | markdown | 9.2 KB | 323 | 1235 |
| `operations/disaster-recovery.md` | markdown | 9.6 KB | 452 | 1361 |
| `operations/high-error-rate.md` | markdown | 12.1 KB | 457 | 1488 |
| `operations/index.md` | markdown | 1.5 KB | 28 | 130 |
| `operations/jwt-secret-rotation.md` | markdown | 9.9 KB | 416 | 1365 |
| `operations/METRICS_REFERENCE.md` | markdown | 12.8 KB | 570 | 1288 |
| `operations/migrations.md` | markdown | 12.8 KB | 659 | 1771 |
| `operations/REQUEST_REPLAY.md` | markdown | 11.1 KB | 483 | 1372 |
| `operations/scaling.md` | markdown | 14.8 KB | 705 | 1827 |
| `operations/TRACING_DASHBOARD.md` | markdown | 1.8 KB | 81 | 248 |
| `privacy.md` | markdown | 1.9 KB | 57 | 268 |
| `public/logo.svg` | image | 6 B | 0 | 0 |
| `README.md` | markdown | 10.8 KB | 224 | 927 |
| `reference/ACTION_NAMING_STANDARD.md` | markdown | 6.3 KB | 225 | 800 |
| `reference/API_CONSISTENCY.md` | markdown | 18.9 KB | 701 | 2440 |
| `reference/API_MCP_REFERENCE.md` | markdown | 21.3 KB | 913 | 2488 |
| `reference/api/API-COMPLIANCE-MATRIX.md` | markdown | 24.7 KB | 478 | 2661 |
| `reference/api/GOOGLE_SHEETS_API_V4_MCP_AUDIT.md` | markdown | 22.9 KB | 458 | 2776 |
| `reference/COMPARISON_MATRIX.md` | markdown | 8.1 KB | 266 | 1146 |
| `reference/knowledge.md` | markdown | 7.3 KB | 350 | 939 |
| `reference/METRICS_DASHBOARD.md` | markdown | 3.9 KB | 107 | 590 |
| `reference/resources.md` | markdown | 9.8 KB | 469 | 1051 |
| `reference/server.schema.json` | data | 21.6 KB | 575 | 2158 |
| `reference/tools.md` | markdown | 6.9 KB | 173 | 688 |
| `reference/tools/sheets_data.md` | markdown | 12.9 KB | 531 | 1469 |
| `releases/index.md` | markdown | 773 B | 27 | 88 |
| `releases/RELEASE_NOTES_v1.6.0.md` | markdown | 8.6 KB | 340 | 1052 |
| `remediation/benchmark-fix-action-plan-2026-03-20.md` | markdown | 5.9 KB | 102 | 810 |
| `remediation/index.md` | markdown | 1.2 KB | 25 | 101 |
| `remediation/issue-tracker.csv` | data | 8.2 KB | 245 | 408 |
| `research/AI_Spreadsheet_Comparison_2026.xlsx` | binary | 17.7 KB | 0 | 0 |
| `research/benchmark_dashboard.html` | web | 8.4 KB | 209 | 720 |
| `research/benchmark_report.xlsx` | binary | 123.3 KB | 0 | 0 |
| `research/mcp-startup-analysis.html` | web | 31.0 KB | 388 | 2116 |
| `research/REAL_WORLD_WORKFLOWS.md` | markdown | 101.9 KB | 2234 | 14234 |
| `research/ServalSheets_Capability_Showcase_Report.html` | web | 36.4 KB | 464 | 2603 |
| `research/ServalSheets_Complete_Probe_Report.html` | web | 32.8 KB | 409 | 2246 |
| `research/ServalSheets_Extended_Probe_Report.html` | web | 49.6 KB | 626 | 3264 |
| `research/ServalSheets_Final_Probe_Report.html` | web | 51.2 KB | 674 | 3697 |
| `research/ServalSheets_Fix_Plan_and_Analysis.html` | web | 30.7 KB | 653 | 3002 |
| `research/ServalSheets_vs_Competitors_Functionality_2026.xlsx` | binary | 20.6 KB | 0 | 0 |
| `review/ADVANCED_AUDIT_VERIFICATION_2026-03-17.md` | markdown | 10.9 KB | 123 | 1326 |
| `review/ADVANCED_FLOWS_GUIDE_2026-03-13.md` | markdown | 31.6 KB | 896 | 3330 |
| `review/archive/abandoned-v2/package-v2.json` | data | 8.8 KB | 246 | 687 |
| `review/archive/experimental/PHASE_3_USER_GUIDE.md` | markdown | 621 B | 20 | 78 |
| `review/archive/experimental/PLUGIN_SYSTEM.md` | markdown | 600 B | 20 | 62 |
| `review/archive/index.md` | markdown | 867 B | 26 | 109 |
| `review/archive/planning-artifacts/API_AUDIT_INDEX.md` | markdown | 9.2 KB | 311 | 1229 |
| `review/archive/planning-artifacts/AQUI_Framework_Research_Report.docx` | binary | 26.8 KB | 0 | 0 |
| `review/archive/planning-artifacts/AQUI_Implementation_Mapping.docx` | binary | 28.3 KB | 0 | 0 |
| `review/archive/planning-artifacts/AQUI_MCP_Enhancement_Analysis.docx` | binary | 25.3 KB | 0 | 0 |
| `review/archive/planning-artifacts/AQUI_VR_Final_Specification.docx` | binary | 26.5 KB | 0 | 0 |
| `review/archive/planning-artifacts/AQUI_VR_Implementation_Spec.docx` | binary | 36.2 KB | 0 | 0 |
| `review/archive/planning-artifacts/AQUI_VR_MCP_Scoring_Matrix.xlsx` | binary | 23.0 KB | 0 | 0 |
| `review/archive/planning-artifacts/AQUI_VR_MCP_Scoring_Matrix2.xlsx` | binary | 23.0 KB | 0 | 0 |
| `review/archive/planning-artifacts/COMPETITIVE_DOMINANCE_BLUEPRINT.docx` | binary | 23.0 KB | 0 | 0 |
| `review/archive/planning-artifacts/COMPETITIVE_GAP_DEEP_DIVE.md` | markdown | 34.1 KB | 796 | 4808 |
| `review/archive/planning-artifacts/GOOGLE_API_TACTICAL_FINDINGS.md` | markdown | 17.1 KB | 543 | 2063 |
| `review/archive/planning-artifacts/LUSAREP_UASEVR_Integration_Strategy.docx` | binary | 21.5 KB | 0 | 0 |
| `review/archive/planning-artifacts/NEXT_LEVEL_ADVANCEMENT_PLAN.md` | markdown | 17.6 KB | 323 | 2439 |
| `review/archive/planning-artifacts/PHASE_1B_INTEGRATION_GUIDE.md` | markdown | 11.0 KB | 427 | 1437 |
| `review/archive/planning-artifacts/PHASE_1B_QUICK_REFERENCE.md` | markdown | 7.6 KB | 309 | 1008 |
| `review/archive/planning-artifacts/PHASE6_SPECIFICATION.md` | markdown | 20.0 KB | 590 | 2518 |
| `review/archive/planning-artifacts/PLUGIN_SYSTEM.md` | markdown | 11.4 KB | 552 | 1356 |
| `review/archive/planning-artifacts/SERVALSHEETS_ADVANCEMENT_PLAN_V2.md` | markdown | 24.1 KB | 541 | 3426 |
| `review/archive/planning-artifacts/ServalSheets_Competitive_Analysis_SourceCode.docx` | binary | 23.4 KB | 0 | 0 |
| `review/archive/planning-artifacts/ServalSheets_Competitive_Analysis.docx` | binary | 22.5 KB | 0 | 0 |
| `review/archive/planning-artifacts/ServalSheets_Enhanced_Implementation_Plan.docx` | binary | 34.6 KB | 0 | 0 |
| `review/archive/planning-artifacts/ServalSheets_GTM_Strategy.docx` | binary | 31.6 KB | 0 | 0 |
| `review/archive/planning-artifacts/ServalSheets_Implementation_Plan.docx` | binary | 23.2 KB | 0 | 0 |
| `review/archive/planning-artifacts/ServalSheets_LUSAREP_Analysis.docx` | binary | 23.6 KB | 0 | 0 |
| `review/archive/planning-artifacts/SERVALSHEETS_MASTER_EXECUTION_PLAN.docx` | binary | 24.3 KB | 0 | 0 |
| `review/archive/planning-artifacts/ServalSheets_Unicorn_Strategy.docx` | binary | 23.0 KB | 0 | 0 |
| `review/BUG_REPORT_2026-03-16.md` | markdown | 29.4 KB | 500 | 4158 |
| `review/CLAUDE_DESKTOP_CONFIG_AUDIT_2026-03-13.md` | markdown | 9.9 KB | 242 | 1367 |
| `review/COMPETITIVE_REMEDIATION_ANALYSIS.md` | markdown | 21.2 KB | 300 | 3145 |
| `review/contract_test_output.txt` | text | 291.3 KB | 1524 | 25441 |
| `review/CONTRACT_TEST_REPORT.txt` | text | 5.4 KB | 135 | 522 |
| `review/EFFICIENCY_MASTER_GUIDE_2026-03-13.md` | markdown | 26.3 KB | 683 | 3380 |
| `review/EXHAUSTIVE_MCP_APPROVAL_AUDIT_2026-03-22.md` | markdown | 25.0 KB | 509 | 3265 |
| `review/index.md` | markdown | 1.5 KB | 33 | 103 |
| `review/MASTER_EXECUTION_PLAN.md` | markdown | 29.7 KB | 755 | 4319 |
| `review/MCP_COMPLIANCE_TASKS_2026-03-16.md` | markdown | 7.4 KB | 130 | 864 |
| `review/MCP_OAUTH_LOG_ANALYSIS_2026-03-13.md` | markdown | 9.1 KB | 256 | 1163 |
| `review/MCP_PROTOCOL_COORDINATOR_AUDIT.md` | markdown | 39.4 KB | 174 | 3681 |
| `review/MCP_PROTOCOL_SOURCE_MANIFEST.md` | markdown | 6.4 KB | 55 | 523 |
| `review/PRODUCTION_RELEASE_WORKTREE_TRIAGE_2026-03-22.md` | markdown | 7.5 KB | 233 | 718 |
| `review/PRODUCTION_REMEDIATION_EXECUTION_PLAN_2026-03-22.md` | markdown | 12.6 KB | 413 | 1645 |
| `review/REMEDIATION_PLAN_ADDENDUM.md` | markdown | 15.2 KB | 303 | 2253 |
| `review/REMEDIATION_PLAN.md` | markdown | 26.7 KB | 693 | 3641 |
| `review/servalsheets-mega-prompt.md` | markdown | 21.3 KB | 373 | 2684 |
| `runbooks/auth-failures.md` | markdown | 11.0 KB | 434 | 1389 |
| `runbooks/circuit-breaker.md` | markdown | 7.5 KB | 303 | 952 |
| `runbooks/emergency-disable.md` | markdown | 3.2 KB | 121 | 436 |
| `runbooks/google-api-errors.md` | markdown | 6.8 KB | 235 | 889 |
| `runbooks/high-error-rate.md` | markdown | 4.2 KB | 180 | 553 |
| `runbooks/high-latency.md` | markdown | 5.2 KB | 235 | 651 |
| `runbooks/low-cache-hit-rate.md` | markdown | 7.6 KB | 280 | 994 |
| `runbooks/memory-exhaustion.md` | markdown | 4.4 KB | 195 | 571 |
| `runbooks/quota-near-limit.md` | markdown | 5.8 KB | 214 | 769 |
| `runbooks/README.md` | markdown | 8.1 KB | 335 | 1039 |
| `runbooks/request-queue-backup.md` | markdown | 4.8 KB | 153 | 679 |
| `runbooks/service-down.md` | markdown | 9.5 KB | 446 | 1180 |
| `runbooks/slow-google-api.md` | markdown | 7.5 KB | 272 | 939 |
| `security/HTTP_AUTH.md` | markdown | 3.6 KB | 132 | 452 |
| `security/INCIDENT_RESPONSE_PLAN.md` | markdown | 9.5 KB | 270 | 1229 |
| `security/MULTI_TENANCY.md` | markdown | 40.8 KB | 1672 | 4703 |
| `security/RBAC_GUIDE.md` | markdown | 19.3 KB | 767 | 2135 |
| `security/WEBHOOK_SECURITY.md` | markdown | 12.4 KB | 507 | 1433 |
| `SERVALSHEETS_ADVANCEMENT_PLAN_V3.md` | markdown | 14.8 KB | 330 | 2258 |
| `testing/MASTER_TEST_PLAN.md` | markdown | 43.5 KB | 453 | 4569 |
