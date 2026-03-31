---
title: Anthropic Directory Policy Fit Review
date: 2026-03-31
status: active
audience: development
doc_class: active
---

# Anthropic Directory Policy Fit Review

## Purpose

Assess whether ServalSheets' full tool surface fits the current Anthropic remote MCP
directory policy, with specific attention to the `sheets_connectors` and
`sheets_federation` tools flagged in the submission crosswalk.

## Policy Reference

Current Anthropic MCP directory policy disallows or sharply limits:

- Money movement / financial transaction servers
- Image, video, or audio generation servers
- **Cross-service automation servers that orchestrate actions across unrelated
  third-party applications**

Source: `docs/audits/ANTHROPIC_MCP_SUBMISSION_CROSSWALK_2026-03-24.md`

---

## Assessment: sheets_connectors

**What it does:** Queries external data sources (Finnhub, FRED, Alpha Vantage, Polygon)
and writes the results into a Google Sheet. The external query is always
initiated by the user and the result goes into the sheet — it does not
orchestrate between unrelated apps.

**Data flow:**

```
User → Claude → sheets_connectors.query(source=finnhub, symbol=AAPL) → Finnhub API → write to Sheet
```

**Policy risk assessment:** LOW

The tool is a data ingestion helper for a spreadsheet, not a cross-service
orchestration engine. It is analogous to a spreadsheet's built-in `=GOOGLEFINANCE()`
function — pulling external data into a local document context. The destination is
always a Google Sheet cell or range, not a downstream third-party service.

**Mitigation already in place:**

- All connectors require explicit user configuration via `sheets_connectors.configure`
- Credentials are stored per-user in the encrypted session store
- The `discover` action exposes available endpoints — users see exactly what data
  sources are accessible before using them

**Recommendation:** Include in submission. Frame in tool description as "import
live data into Google Sheets from financial/economic data sources."

---

## Assessment: sheets_federation

**What it does:** Calls tools on other MCP servers discovered via a registry.
Allows one ServalSheets action to invoke a tool on a remote MCP server and write
the result back to a sheet.

**Data flow:**

```
User → Claude → sheets_federation.call_remote(server=X, tool=Y, args=Z) → Remote MCP server → write result to Sheet
```

**Policy risk assessment:** MEDIUM-HIGH

This is the more significant policy risk. It enables cross-service automation by
design — it explicitly bridges ServalSheets to arbitrary external MCP servers.
This could be read as "orchestrating actions across unrelated third-party
applications" depending on how broadly Anthropic interprets the policy.

**Mitigating factors:**

- Remote servers must be explicitly registered by the operator via environment config
- `validate_connection` confirms server availability before actions are dispatched
- The tool surface (list_servers, get_server_tools) provides full transparency
- All results are written back to a Google Sheet — the output is still bounded

**Options for submission:**

| Option                              | Tradeoff                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **A — Include with scoping note**   | Full surface submitted; note in description that federation requires operator-configured server registry. Possible policy review question. |
| **B — Exclude from submission set** | Simplest path to approval. Federation is an advanced operator feature not needed for most users. Can be added in a subsequent submission.  |
| **C — Gate behind feature flag**    | Ship with `ENABLE_FEDERATION=false` default; exclude from tool list unless explicitly enabled. Most conservative.                          |

**Recommendation:** **Option B** for initial submission. Exclude `sheets_federation`
from the submitted tool set via `MCP_TOOL_EXCLUDE=sheets_federation` env var (if
supported) or by noting it is a pre-release feature in the submission form.
`sheets_connectors` is unambiguous and should be included.

---

## Summary Table

| Tool                | Policy Risk                        | Recommendation                  |
| ------------------- | ---------------------------------- | ------------------------------- |
| sheets_auth         | None                               | Include                         |
| sheets_core         | None                               | Include                         |
| sheets_data         | None                               | Include                         |
| sheets_format       | None                               | Include                         |
| sheets_dimensions   | None                               | Include                         |
| sheets_visualize    | None                               | Include                         |
| sheets_collaborate  | None                               | Include                         |
| sheets_advanced     | None                               | Include                         |
| sheets_transaction  | None                               | Include                         |
| sheets_quality      | None                               | Include                         |
| sheets_history      | None                               | Include                         |
| sheets_confirm      | None                               | Include                         |
| sheets_analyze      | None                               | Include                         |
| sheets_fix          | None                               | Include                         |
| sheets_composite    | None                               | Include                         |
| sheets_session      | None                               | Include                         |
| sheets_templates    | None                               | Include                         |
| sheets_bigquery     | None — Google-to-Google            | Include                         |
| sheets_appsscript   | None — Google-to-Google            | Include                         |
| sheets_webhook      | None                               | Include                         |
| sheets_dependencies | None                               | Include                         |
| sheets_compute      | None                               | Include                         |
| sheets_agent        | None                               | Include                         |
| sheets_connectors   | Low — data ingestion only          | Include with description note   |
| sheets_federation   | Medium-High — cross-service bridge | Exclude from initial submission |

**Submitted tool count (if federation excluded): 24 tools**

---

## Action Items

- [ ] Decide Option A/B/C for sheets_federation before submission
- [ ] If Option B: check whether server.json / tool list can exclude a single tool
      without a rebuild (env-based exclusion is in `src/config/schema-optimization.ts`)
- [ ] Update TEST_ACCOUNT_SETUP.md reviewer workflows to exclude federation tests
      if Option B is chosen
- [ ] Add scoping language to sheets_connectors description: emphasize data flows
      _into_ the spreadsheet, not cross-service orchestration
