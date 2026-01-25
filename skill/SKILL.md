---
name: google-sheets-expert
description: |
  Enterprise-grade Google Sheets MCP server (ServalSheets v1.6.0) with 21 tool 
  categories and 271 specialized actions. Implements UASEV+R protocol for 
  intelligent spreadsheet operations with transaction support (80% API savings), 
  AI analysis, conversational context, and MCP 2025-11-25 compliance (96% score).

  Use when: (1) Working with Google Sheets via URL or ID, (2) Analyzing, cleaning, 
  or transforming data, (3) Creating charts, reports, or dashboards, (4) Building 
  financial models, (5) Natural language requests like "clean my data", 
  (6) Any mention of Google Sheets, spreadsheets, or sheet data.

  Key capabilities: OAuth 2.1 with PKCE, atomic transactions, task support with 
  cancellation, MCP elicitation for confirmations, 3-layer context management,
  comprehensive error handling with recovery suggestions.
---

# ServalSheets Expert Skill

Transform from tool executor to spreadsheet consultant. Think strategically, act optimally, advise proactively.

## UASEV+R Protocol

For ANY spreadsheet request, follow this sequence:

```
U - UNDERSTAND  What does the user actually need? (not just what they asked)
A - ASSESS      sheets_analyze { action: "comprehensive" } - Get full picture
S - STRATEGIZE  Plan optimal approach, use transactions for 2+ operations
E - EXECUTE     Run tools in optimal order with proper error handling
V - VERIFY      Confirm goal achieved, validate results
R - REFLECT     Report results, suggest improvements, next steps
```

## Tool Architecture

21 tools with 273 actions. Each tool called with `request` object:

```json
{ "request": { "action": "action_name", "spreadsheetId": "...", ...params } }
```

### Essential Tools

| Tool                 | Actions | Purpose                               |
| -------------------- | ------- | ------------------------------------- |
| `sheets_auth`        | 4       | OAuth 2.1 — **call status first**     |
| `sheets_core`        | 17      | Spreadsheet/sheet management          |
| `sheets_data`        | 20      | Read/write cell values                |
| `sheets_analyze`     | 11      | AI analysis — **use comprehensive**   |
| `sheets_transaction` | 6       | Atomic batching — **80% API savings** |

### All Tools

| Tool                  | Actions | Purpose                             |
| --------------------- | ------- | ----------------------------------- |
| `sheets_format`       | 21      | Styling, conditional formatting     |
| `sheets_dimensions`   | 39      | Rows, columns, filters, sorting     |
| `sheets_visualize`    | 18      | Charts, pivot tables                |
| `sheets_collaborate`  | 28      | Sharing, comments, versions         |
| `sheets_advanced`     | 23      | Named ranges, protection, chips     |
| `sheets_quality`      | 4       | Validation, conflict detection      |
| `sheets_history`      | 7       | Undo/redo, audit                    |
| `sheets_confirm`      | 5       | User confirmation (MCP Elicitation) |
| `sheets_fix`          | 1       | Auto-fix issues                     |
| `sheets_composite`    | 7       | Import CSV, smart append            |
| `sheets_session`      | 13      | Conversation context                |
| `sheets_templates`    | 8       | Template library                    |
| `sheets_bigquery`     | 14      | BigQuery integration                |
| `sheets_appsscript`   | 14      | Apps Script automation              |
| `sheets_webhook`      | 6       | Change notifications                |
| `sheets_dependencies` | 7       | Formula dependency graph            |

## Key Workflows

### First Contact (Spreadsheet Shared)

```
1. sheets_auth { action: "status" }
2. sheets_analyze { action: "comprehensive", spreadsheetId: "..." }
3. Present: structure, issues found, quick wins available
```

### Data Cleaning

```
1. sheets_analyze { action: "comprehensive" }
2. sheets_collaborate { action: "version_create_snapshot" }  // backup
3. sheets_composite { action: "deduplicate" } OR manual fixes
4. sheets_quality { action: "validate" }  // verify improvement
```

### Multi-Step Operations (Use Transactions!)

```
1. sheets_transaction { action: "begin", spreadsheetId: "..." }
2. sheets_transaction { action: "queue", operation: {...} }  // repeat
3. sheets_transaction { action: "commit" }  // single API call
```

## Error Handling

| Error                   | Action                                         |
| ----------------------- | ---------------------------------------------- |
| "Not authenticated"     | sheets_auth { action: "status" }, then "login" |
| "Spreadsheet not found" | Verify URL/ID, check sharing permissions       |
| "Permission denied"     | Check sharing settings                         |
| "Rate limit"            | Use sheets_transaction for batching            |

## Standards

### Always

- ✅ Check auth status first
- ✅ Use `comprehensive` for initial analysis
- ✅ Create backup before destructive changes
- ✅ Use transactions for 2+ operations
- ✅ Provide specific numbers ("removed 45 rows")

### Never

- ❌ Execute without reading data first
- ❌ Assume data is clean
- ❌ Skip validation after changes
- ❌ Make destructive changes without confirmation

## References

Load for detailed information:

- [references/tool-guide.md](references/tool-guide.md) — Complete 21 tools, 273 actions
