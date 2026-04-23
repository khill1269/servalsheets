---
name: google-sheets-expert
description: Enterprise-grade Google Sheets MCP server (ServalSheets) with tool categories and specialized actions. Implements UASEV+R protocol for intelligent spreadsheet operations with transaction support, AI analysis, conversational context, and MCP 2025-11-25 compliance.
---

# ServalSheets — Google Sheets Expert

<!-- BEGIN:AUTOGEN counts -->
ServalSheets ships **25 tools** exposing **409 actions** across the Google Sheets surface.

Use when: (1) Working with Google Sheets via URL or ID, (2) Analyzing, cleaning, or transforming data,
(3) Creating charts, reports, or dashboards, (4) Building financial models,
(5) Natural language requests like "clean my data", (6) Any mention of Google Sheets, spreadsheets, or sheet data.

Key capabilities: OAuth 2.1 with PKCE, atomic transactions, task support with cancellation,
MCP elicitation for confirmations, 3-layer context management, comprehensive error handling
with recovery suggestions.
<!-- END:AUTOGEN counts -->

## Tool Inventory

<!-- BEGIN:AUTOGEN tools -->
| Tool | Actions | Title |
|------|---------|-------|
| `sheets_advanced` | 31 | Named Ranges, Protection & Tables |
| `sheets_agent` | 8 | Agentic Execution |
| `sheets_analyze` | 26 | AI-Powered Analysis |
| `sheets_appsscript` | 19 | Apps Script Automation |
| `sheets_auth` | 5 | Authentication & Setup |
| `sheets_bigquery` | 17 | BigQuery Integration |
| `sheets_collaborate` | 41 | Sharing & Collaboration |
| `sheets_composite` | 21 | Multi-Step Operations |
| `sheets_compute` | 16 | Computation Engine |
| `sheets_confirm` | 5 | User Confirmation & Approval |
| `sheets_connectors` | 10 | Live Data Connectors |
| `sheets_core` | 21 | Spreadsheet & Sheet Management |
| `sheets_data` | 25 | Cell Data Operations |
| `sheets_dependencies` | 10 | Formula Dependencies & Scenario Modeling |
| `sheets_dimensions` | 30 | Rows, Columns & Sorting |
| `sheets_federation` | 4 | MCP Server Federation |
| `sheets_fix` | 6 | Auto-Fix Issues |
| `sheets_format` | 25 | Formatting & Styling |
| `sheets_history` | 10 | Operation History & Undo |
| `sheets_quality` | 4 | Data Validation & Quality |
| `sheets_session` | 32 | Session & Context Management |
| `sheets_templates` | 8 | Spreadsheet Templates |
| `sheets_transaction` | 6 | Atomic Batch Operations |
| `sheets_visualize` | 18 | Charts & Pivot Tables |
| `sheets_webhook` | 11 | Webhook Notifications |
<!-- END:AUTOGEN tools -->

## Startup pattern

1. `sheets_auth.status` — check whether a session exists
2. `sheets_session.get_context` — inspect connectors and active spreadsheet
3. `sheets_session.set_active` — lock in the working spreadsheet

After each mutation call `sheets_session.record_operation` (or enable `autoRecord` via `update_preferences`).
Before writing into formula ranges call `sheets_quality.analyze_impact` to assess risk.

## Work patterns

- Transactions only queue batchable ops (write, format, dimension). `add_note`, `comment_add`,
  `chart_create` go directly after commit.
- For 3+ step work, prefer `sheets_agent.plan + execute(interactiveMode: true)` rather than
  `execute_pipeline`.
- Open-ended ranges like `A:Z` are disallowed — provide explicit bounds like `A1:Z1000`.
