---
name: sep-status-2026-05-12
description: Verified SEP merge/draft status as of 2026-05-12 from PR pages and modelcontextprotocol.io
metadata:
  type: reference
---

# SEP Status (verified 2026-05-12)

## Latest Protocol Version

- **Current normative spec:** 2025-11-25 (no draft revision merged since)
- **Next release tentative:** June 2026; goal to finalize required SEPs in Q1 2026
- **Roadmap priorities:** transport scalability, agent communication, governance, enterprise readiness

## Merged into 2025-11-25 (Normative)

| SEP | Title | Track |
|-----|-------|-------|
| 973 | Icons on tools/resources/prompts | Core |
| 985 | OAuth PRM aligned with RFC 9728; WWW-Authenticate optional | Core |
| 986 | Tool name guidance | Core |
| 1034 | Default values in elicitation primitives | Core |
| 1036 | URL mode elicitation | Core |
| 1303 | Validation errors as Tool Execution Errors (isError: true) | Core |
| 1319 | Decoupled request param schemas | Schema |
| 1330 | ElicitResult / EnumSchema (titled, untitled, single/multi-select) | Core |
| 1577 | Sampling with tools/toolChoice | Core |
| 1613 | JSON Schema 2020-12 as default dialect | Core |
| 1686 | Tasks (experimental) | Core |
| 1699 | Polling SSE streams (servers may disconnect) | Core |
| 991 | OAuth Client ID Metadata Documents | Core |
| 835 | Incremental scope consent via WWW-Authenticate | Core |
| 932 | Governance | Process |
| 994 | Community communications | Process |
| 1302 | Working/Interest Groups | Process |
| 1730 | SDK tiering system | Process |

PR #797 (OIDC Discovery 1.0 in auth flows) also merged — not a SEP number.

## Merged Since 2025-11-25 (Extensions Track only)

| SEP | Title | Status | Merge Date |
|-----|-------|--------|------------|
| 1865 | MCP Apps — Interactive UIs | Final, Extensions Track | 2026-01-28 |

**Critical:** SEP-1865 is on the Extensions Track (per SEP-1724) — explicitly OPTIONAL. Servers negotiate via extension capabilities mechanism. NOT required for core spec compliance.

## Still Draft / Open (NOT mergeable claims)

| SEP | Title | Status as of 2026-05-12 |
|-----|-------|--------------------------|
| 2127 | Server Cards (`.well-known/mcp/server-card.json`) | OPEN, draft. Last activity 2026-05-10. Schema URL still in flux (community wants `mcpCard: "1.0"` instead of `$schema`). Required fields uncertain |
| 1862 | Tool Resolution (`tools/resolve`) | OPEN, draft. Sponsor assigned 2026-02-04 |
| 1724 | Extensions framework | Draft/WIP issue |
| 1960 | `.well-known/mcp` competing manifest | Open issue |
| 1932 | DPoP | Draft |
| 1933 | Workload Identity Federation | Draft |

## Process Notes

- **SEP-1850 merged 2025-11-28:** SEP submission process moved from issues to PRs
- **Extensions Track:** new path via SEP-1724 allows extensions to move to "Final" without being core spec — uses `{vendor-prefix}/{extension-name}` identifier convention
- Extensions in `ext-*` repos under modelcontextprotocol/ org

## ServalSheets Implications

- ServalSheets correctly uses `(draft)` qualifier on SEP-2127 in well-known.ts
- No new normative gaps since 2025-11-25 (last spec)
- SEP-1865 MCP Apps is OPT-IN extension — not applicable to ServalSheets (Google Sheets has no UI surface; client renders sheet data)
- Server Card $schema placeholder URL is acceptable until SEP-2127 publishes canonical schema
- Next big watch: June 2026 release (current Q1/Q2 SEPs being finalized)
