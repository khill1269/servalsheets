# ServalSheets Tool Reference

<!-- BEGIN:AUTOGEN counts -->
ServalSheets exposes **25 tools** / **411 actions** over the MCP interface.
<!-- END:AUTOGEN counts -->

## Tools

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
| `sheets_dimensions` | 31 | Rows, Columns & Sorting |
| `sheets_federation` | 4 | MCP Server Federation |
| `sheets_fix` | 6 | Auto-Fix Issues |
| `sheets_format` | 25 | Formatting & Styling |
| `sheets_history` | 10 | Operation History & Undo |
| `sheets_quality` | 4 | Data Validation & Quality |
| `sheets_session` | 33 | Session & Context Management |
| `sheets_templates` | 8 | Spreadsheet Templates |
| `sheets_transaction` | 6 | Atomic Batch Operations |
| `sheets_visualize` | 18 | Charts & Pivot Tables |
| `sheets_webhook` | 11 | Webhook Notifications |
<!-- END:AUTOGEN tools -->

## Notes

- Tool inputs are wrapped under `request`: `{ request: { action: 'read', ... } }`.
- Results are `CallToolResult`; prefer `structuredContent.response` and check `response.success`.
- Mutating actions emit audit events; PII is redacted by default
  (set `AUDIT_PII_REDACTION=false` to opt out with a startup warning).
