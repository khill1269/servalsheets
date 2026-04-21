---
title: Audits
date: 2026-04-21
status: active
---

# ServalSheets Audit Trail

This folder tracks how the project's audit posture has evolved. Read top to bottom; each entry notes what it superseded.

## Current canonical view

**[regression-audit-2026-04-21.md](./regression-audit-2026-04-21.md)** — the current-state audit. Explains how six live bugs surfaced during an E2E session despite the compound-tool layer scoring "perfect" on all existing validation gates, why the validation gates didn't see them (they operate on compound tools; the bugs live in the flat-tool adapter that projects 25 compound tools into ~396 per-action MCP tools for LLM clients), and the five small contract tests that close the gap permanently. Cross-references the earlier audits below and marks each of their findings as **verified / refuted / still-valid / superseded**.

## 2026-04-21 audit cycle (reading order)

1. **[source-truth-compliance-architecture-audit-2026-04-21.md](./source-truth-compliance-architecture-audit-2026-04-21.md)** — original wide-scope audit. Lists R1-R12 risks plus a P0-P2 backlog around OAuth token bridging, Google scope posture, DCR consent, and MCP primitive coverage. Several of its P0/P1 findings turned out to be stale or partially patched; see the re-audit for specifics.

2. **[independent-reaudit-2026-04-21.md](./independent-reaudit-2026-04-21.md)** — verification pass over the original audit with file:line evidence. Refutes roughly half of the P0/P1 claims (notably: `compact_session` annotation exists, `/oauth/revoke` does clear local tokens, `STANDARD_SCOPES` excludes restricted scopes, `client_secret_basic` is implemented, flat `tools/list` paginates with page size 100, MUTATION_ACTIONS sets are identical at 76 entries). The final "Real P0-P2" list at the bottom is tighter and grounded.

3. **[fix-plan-vs-audit-gap-report.md](./fix-plan-vs-audit-gap-report.md)** — coverage matrix showing the audit backlog and a separate internal fix plan are almost entirely orthogonal: the audit focused on OAuth/scope/token-bridge posture, the fix plan on cold-start latency, stdio framing, and module-load side effects. Neither covered what broke at the MCP wire in the E2E session, which is exactly what the regression audit addresses.

4. **[modern-protocols-upgrade-recommendations.md](./modern-protocols-upgrade-recommendations.md)** — forward-looking research: MCP SEPs since `2025-11-25` (DPoP, Workload Identity Federation, server cards, manifest, attested DCR), Google OAuth modern patterns (RFC 8693 token exchange, RFC 7009 revoke, least-privilege scopes), and elicitation URL mode for sensitive interactions. Use this when prioritizing the post-fix remediation roadmap.

## Earlier dated audits (2026-03)

Mar-2026 audits capture the project at earlier phases:

- [AQUI-VR_v3.2_Framework](./AQUI-VR_v3.2_Framework.md)
- [AUDIT_REPORT](./AUDIT_REPORT.md)
- [CODEBASE_AUDIT_SUPPLEMENT](./CODEBASE_AUDIT_SUPPLEMENT.md)
- [CODEBASE_FULL_AUDIT](./CODEBASE_FULL_AUDIT.md)
- [DEPENDENCY_HEALTH_AUDIT_2026-03-28](./DEPENDENCY_HEALTH_AUDIT_2026-03-28.md)
- [DOCS_COMPLETE_AUDIT_2026-03-24](./DOCS_COMPLETE_AUDIT_2026-03-24.md)
- [DOCS_CRAWLER_DEEP_AUDIT_2026-03-24](./DOCS_CRAWLER_DEEP_AUDIT_2026-03-24.md)
- [DOCS_FOLDER_COMPLETE_AUDIT_2026-03-24](./DOCS_FOLDER_COMPLETE_AUDIT_2026-03-24.md)
- [DOCS_SYSTEM_AUDIT_2026-03-24](./DOCS_SYSTEM_AUDIT_2026-03-24.md)
- [MCP_STARTUP_ANALYSIS](./MCP_STARTUP_ANALYSIS.md)
- [PHASE_12_REBASELINE_2026-03-24](./PHASE_12_REBASELINE_2026-03-24.md)
- [POLICY_FIT_REVIEW_2026-03-31](./POLICY_FIT_REVIEW_2026-03-31.md)
- [PROJECT_SNAPSHOT](./PROJECT_SNAPSHOT.md)
- [ServalSheets_GitHub_Audit](./ServalSheets_GitHub_Audit.md)
- [ANTHROPIC_MCP_SUBMISSION_CROSSWALK_2026-03-24](./ANTHROPIC_MCP_SUBMISSION_CROSSWALK_2026-03-24.md)

Keep them for historical context but treat the 2026-04-21 set as the current view.

## How to update

When closing an audit finding:

1. Update the relevant `.md` entry inline with a `**STATUS: RESOLVED**` line plus commit SHA.
2. Add a short note to this README under a new "Resolutions" section if the finding was cross-referenced in multiple docs.
3. Don't delete the finding — the audit trail is more valuable than a green backlog.
