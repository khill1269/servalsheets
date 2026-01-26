# ServalSheets Advanced Orchestration Skill (v1.6.0)

## Overview

Enterprise-grade Google Sheets MCP server with 267 actions across 21 tools. Implements the UASEV+R protocol for intelligent spreadsheet operations with transaction support, AI analysis, and conversational context.

**Version:** 1.6.0 (21 tools, 267 actions)  
**Updated:** 2026-01-25  
**Protocol:** MCP 2025-11-25 Compliant

## Quick Reference: 21 Tools & 271 Actions

| Tool                  | Actions | Purpose                             |
| --------------------- | ------- | ----------------------------------- |
| `sheets_auth`         | 4       | OAuth 2.1 authentication            |
| `sheets_core`         | 17      | Spreadsheet/sheet management        |
| `sheets_data`         | 20      | Cell values, notes, hyperlinks      |
| `sheets_format`       | 21      | Styling, conditional formatting     |
| `sheets_dimensions`   | 39      | Rows, columns, filters, sorting     |
| `sheets_visualize`    | 18      | Charts, pivot tables                |
| `sheets_collaborate`  | 28      | Sharing, comments, versions         |
| `sheets_advanced`     | 23      | Named ranges, protection, chips     |
| `sheets_transaction`  | 6       | Atomic batch operations             |
| `sheets_quality`      | 4       | Validation, conflict detection      |
| `sheets_history`      | 7       | Undo/redo, audit                    |
| `sheets_confirm`      | 5       | User confirmation (MCP Elicitation) |
| `sheets_analyze`      | 11      | AI-powered analysis                 |
| `sheets_fix`          | 1       | Auto-fix issues                     |
| `sheets_composite`    | 7       | Import CSV, smart append            |
| `sheets_session`      | 13      | Conversation context                |
| `sheets_templates`    | 8       | Template library                    |
| `sheets_bigquery`     | 14      | BigQuery integration                |
| `sheets_appsscript`   | 14      | Apps Script automation              |
| `sheets_webhook`      | 6       | Change notifications                |
| `sheets_dependencies` | 7       | Formula dependency graph            |

---

## UASEV+R Protocol

For ANY spreadsheet request, follow this sequence:

```
U - UNDERSTAND: Parse user intent, identify hidden requirements
A - ASSESS:     sheets_analyze { action: "comprehensive" } - Get full picture
S - STRATEGIZE: Plan optimal approach, use transactions for 2+ operations
E - EXECUTE:    Run tools in optimal order with proper error handling
V - VERIFY:     Confirm goal achieved, validate results
R - REFLECT:    Report results, suggest improvements, next steps
```

### Quick Decision Guide

**When to skip comprehensive analysis (fast path):**
- Simple reads/writes < 100 cells → Use `sheets_auth status` only
- Known spreadsheet structure → Skip analysis

**When to use transactions:**
- 2+ related writes → 80% quota savings + atomicity guarantee
- Multi-sheet updates → Prevents inconsistent data on failure

**When to use batch operations:**
- 3+ reads from different ranges → `batch_read` (1 call vs N calls)
- Multiple writes → `batch_write` (1 call vs N calls)
- Quota savings: 66-99% depending on operation count

**When to request confirmation (`sheets_confirm`):**
- Destructive operations: delete, clear, truncate
- Updates affecting > 100 cells
- Operations without snapshots/undo

**For workflow patterns:** Load `servalsheets://patterns/workflows` resource to see real-world examples with API metrics.

---

## Complete Tool Reference

### 🔐 sheets_auth (4 actions)

Authentication management. **Always call first!**

| Action     | Purpose                    |
| ---------- | -------------------------- |
| `status`   | Check authentication state |
| `login`    | Get OAuth URL              |
| `callback` | Complete OAuth with code   |
| `logout`   | Clear credentials          |

```json
{ "action": "status" }
```

---

### 📋 sheets_core (17 actions)

Spreadsheet and sheet management.

| Action                | Purpose                              |
| --------------------- | ------------------------------------ |
| `get`                 | Get spreadsheet metadata             |
| `create`              | Create new spreadsheet               |
| `copy`                | Copy entire spreadsheet              |
| `update_properties`   | Update title, locale, timezone       |
| `get_url`             | Get shareable URL                    |
| `batch_get`           | Get multiple spreadsheets            |
| `get_comprehensive`   | **1-SHOT METADATA** - Get everything |
| `list`                | List user's spreadsheets             |
| `add_sheet`           | Add new sheet (tab)                  |
| `delete_sheet`        | Delete sheet                         |
| `duplicate_sheet`     | Copy sheet within spreadsheet        |
| `update_sheet`        | Update sheet properties              |
| `copy_sheet_to`       | Copy sheet to another spreadsheet    |
| `list_sheets`         | List all sheets                      |
| `get_sheet`           | Get sheet by name or ID              |
| `batch_delete_sheets` | Delete multiple sheets               |
| `batch_update_sheets` | Update multiple sheets               |

**⚡ Power Move:** Use `get_comprehensive` for instant full analysis!

```json
{ "action": "get_comprehensive", "spreadsheetId": "..." }
```

---

### 📝 sheets_data (20 actions)

Cell values, notes, hyperlinks, and data operations.

| Action             | Purpose               |
| ------------------ | --------------------- |
| `read`             | Read cell values      |
| `write`            | Write cell values     |
| `append`           | Append rows           |
| `clear`            | Clear cell contents   |
| `batch_read`       | Read multiple ranges  |
| `batch_write`      | Write multiple ranges |
| `batch_clear`      | Clear multiple ranges |
| `find_replace`     | Find and replace text |
| `add_note`         | Add cell note         |
| `get_note`         | Get cell note         |
| `clear_note`       | Remove cell note      |
| `set_validation`   | Set data validation   |
| `clear_validation` | Clear validation      |
| `set_hyperlink`    | Add hyperlink         |
| `clear_hyperlink`  | Remove hyperlink      |
| `merge_cells`      | Merge cell range      |
| `unmerge_cells`    | Unmerge cells         |
| `get_merges`       | List merged cells     |
| `cut_paste`        | Cut and paste         |
| `copy_paste`       | Copy and paste        |

```json
{ "action": "batch_read", "spreadsheetId": "...", "ranges": ["Sheet1!A1:Z100", "Sheet2!A1:Z100"] }
```

---

### 🎨 sheets_format (21 actions)

Cell styling and conditional formatting.

| Action                           | Purpose                        |
| -------------------------------- | ------------------------------ |
| `set_format`                     | Apply comprehensive formatting |
| `suggest_format`                 | AI format suggestions          |
| `set_background`                 | Set background color           |
| `set_text_format`                | Set font, size, color          |
| `set_number_format`              | Set number format              |
| `set_alignment`                  | Set text alignment             |
| `set_borders`                    | Add/update borders             |
| `clear_format`                   | Clear all formatting           |
| `apply_preset`                   | Apply preset style             |
| `auto_fit`                       | Auto-fit columns               |
| `sparkline_add`                  | Add sparkline chart            |
| `sparkline_get`                  | Get sparkline info             |
| `sparkline_clear`                | Remove sparkline               |
| `rule_add_conditional_format`    | Add conditional rule           |
| `rule_update_conditional_format` | Update rule                    |
| `rule_delete_conditional_format` | Delete rule                    |
| `rule_list_conditional_formats`  | List all rules                 |
| `set_data_validation`            | Set validation dropdown        |
| `clear_data_validation`          | Clear validation               |
| `list_data_validations`          | List validations               |
| `add_conditional_format_rule`    | Add rule (alternate)           |

```json
{
  "action": "set_format",
  "spreadsheetId": "...",
  "range": "A1:Z1",
  "format": {
    "backgroundColor": "#1a73e8",
    "textFormat": { "bold": true, "foregroundColor": "#ffffff" }
  }
}
```

---

### 📐 sheets_dimensions (39 actions)

Rows, columns, filters, and sorting.

| Action                          | Purpose                |
| ------------------------------- | ---------------------- |
| `insert_rows`                   | Insert rows            |
| `insert_columns`                | Insert columns         |
| `delete_rows`                   | Delete rows            |
| `delete_columns`                | Delete columns         |
| `move_rows`                     | Move rows              |
| `move_columns`                  | Move columns           |
| `resize_rows`                   | Set row height         |
| `resize_columns`                | Set column width       |
| `auto_resize`                   | Auto-fit dimensions    |
| `hide_rows`                     | Hide rows              |
| `hide_columns`                  | Hide columns           |
| `show_rows`                     | Show hidden rows       |
| `show_columns`                  | Show hidden columns    |
| `freeze_rows`                   | Freeze header rows     |
| `freeze_columns`                | Freeze columns         |
| `group_rows`                    | Create row group       |
| `group_columns`                 | Create column group    |
| `ungroup_rows`                  | Remove row group       |
| `ungroup_columns`               | Remove column group    |
| `append_rows`                   | Append empty rows      |
| `append_columns`                | Append empty columns   |
| `set_basic_filter`              | Create filter          |
| `clear_basic_filter`            | Remove filter          |
| `get_basic_filter`              | Get filter info        |
| `filter_update_filter_criteria` | Update filter criteria |
| `sort_range`                    | Sort data range        |
| `trim_whitespace`               | Trim whitespace        |
| `randomize_range`               | Randomize row order    |
| `text_to_columns`               | Split text to columns  |
| `auto_fill`                     | Auto-fill series       |
| `create_filter_view`            | Create filter view     |
| `update_filter_view`            | Update filter view     |
| `delete_filter_view`            | Delete filter view     |
| `list_filter_views`             | List filter views      |
| `get_filter_view`               | Get filter view        |
| `create_slicer`                 | Create slicer          |
| `update_slicer`                 | Update slicer          |
| `delete_slicer`                 | Delete slicer          |
| `list_slicers`                  | List slicers           |

```json
{ "action": "freeze_rows", "spreadsheetId": "...", "sheetId": 0, "frozenRowCount": 1 }
```

---

### 📊 sheets_visualize (18 actions)

Charts and pivot tables.

| Action                    | Purpose                  |
| ------------------------- | ------------------------ |
| `chart_create`            | Create chart             |
| `suggest_chart`           | AI chart recommendations |
| `chart_update`            | Update chart             |
| `chart_delete`            | Delete chart             |
| `chart_list`              | List charts              |
| `chart_get`               | Get chart details        |
| `chart_move`              | Move chart               |
| `chart_resize`            | Resize chart             |
| `chart_update_data_range` | Update data source       |
| `chart_add_trendline`     | Add trendline            |
| `chart_remove_trendline`  | Remove trendline         |
| `pivot_create`            | Create pivot table       |
| `suggest_pivot`           | AI pivot suggestions     |
| `pivot_update`            | Update pivot             |
| `pivot_delete`            | Delete pivot             |
| `pivot_list`              | List pivot tables        |
| `pivot_get`               | Get pivot details        |
| `pivot_refresh`           | Refresh pivot data       |

```json
{
  "action": "chart_create",
  "spreadsheetId": "...",
  "sheetId": 0,
  "chartType": "LINE",
  "data": { "sourceRange": "A1:B10" },
  "position": { "anchorCell": "D2" }
}
```

---

### 👥 sheets_collaborate (28 actions)

Sharing, comments, and version control.

| Action                     | Purpose            |
| -------------------------- | ------------------ |
| `share_add`                | Share with user    |
| `share_update`             | Update permissions |
| `share_remove`             | Remove access      |
| `share_list`               | List permissions   |
| `share_get`                | Get permission     |
| `share_transfer_ownership` | Transfer ownership |
| `share_set_link`           | Set link sharing   |
| `share_get_link`           | Get link settings  |
| `comment_add`              | Add comment        |
| `comment_update`           | Update comment     |
| `comment_delete`           | Delete comment     |
| `comment_list`             | List comments      |
| `comment_get`              | Get comment        |
| `comment_resolve`          | Resolve comment    |
| `comment_reopen`           | Reopen comment     |
| `comment_add_reply`        | Add reply          |
| `comment_update_reply`     | Update reply       |
| `comment_delete_reply`     | Delete reply       |
| `version_list_revisions`   | List revisions     |
| `version_get_revision`     | Get revision       |
| `version_restore_revision` | Restore revision   |
| `version_keep_revision`    | Pin revision       |
| `version_create_snapshot`  | Create snapshot    |
| `version_list_snapshots`   | List snapshots     |
| `version_restore_snapshot` | Restore snapshot   |
| `version_delete_snapshot`  | Delete snapshot    |
| `version_compare`          | Compare versions   |
| `version_export`           | Export version     |

```json
{ "action": "share_add", "spreadsheetId": "...", "email": "user@example.com", "role": "writer" }
```

---

### ⚙️ sheets_advanced (23 actions)

Named ranges, protection, metadata, chips.

| Action                   | Purpose                 |
| ------------------------ | ----------------------- |
| `add_named_range`        | Create named range      |
| `update_named_range`     | Update named range      |
| `delete_named_range`     | Delete named range      |
| `list_named_ranges`      | List named ranges       |
| `get_named_range`        | Get named range         |
| `add_protected_range`    | Protect range           |
| `update_protected_range` | Update protection       |
| `delete_protected_range` | Remove protection       |
| `list_protected_ranges`  | List protections        |
| `set_metadata`           | Set developer metadata  |
| `get_metadata`           | Get metadata            |
| `delete_metadata`        | Delete metadata         |
| `add_banding`            | Add alternating colors  |
| `update_banding`         | Update banding          |
| `delete_banding`         | Remove banding          |
| `list_banding`           | List banding            |
| `create_table`           | Create structured table |
| `delete_table`           | Delete table            |
| `list_tables`            | List tables             |
| `add_person_chip`        | Add @mention chip       |
| `add_drive_chip`         | Add Drive file chip     |
| `add_rich_link_chip`     | Add rich link chip      |
| `list_chips`             | List smart chips        |

```json
{ "action": "add_named_range", "spreadsheetId": "...", "name": "Revenue", "range": "B2:B100" }
```

---

### 🔄 sheets_transaction (6 actions)

Atomic batch operations - **80% API savings!**

| Action     | Purpose                  |
| ---------- | ------------------------ |
| `begin`    | Start transaction        |
| `queue`    | Add operation            |
| `commit`   | Execute all atomically   |
| `rollback` | Cancel transaction       |
| `status`   | Check transaction status |
| `list`     | List active transactions |

```json
// Start transaction
{ "action": "begin", "spreadsheetId": "..." }

// Queue operations
{ "action": "queue", "transactionId": "tx_...", "operation": { "tool": "sheets_data", "action": "write", "params": {...} } }

// Commit atomically
{ "action": "commit", "transactionId": "tx_..." }
```

---

### ✅ sheets_quality (4 actions)

Validation and conflict detection.

| Action             | Purpose                       |
| ------------------ | ----------------------------- |
| `validate`         | Validate data                 |
| `detect_conflicts` | Find conflicts                |
| `resolve_conflict` | Resolve conflict              |
| `analyze_impact`   | Pre-execution impact analysis |

```json
{ "action": "validate", "value": "test@email.com", "rules": ["not_empty", "valid_email"] }
```

---

### 📜 sheets_history (7 actions)

Operation audit and undo/redo.

| Action      | Purpose                  |
| ----------- | ------------------------ |
| `list`      | List operations          |
| `get`       | Get operation details    |
| `stats`     | Get statistics           |
| `undo`      | Undo last operation      |
| `redo`      | Redo operation           |
| `revert_to` | Revert to specific point |
| `clear`     | Clear history            |

```json
{ "action": "undo", "spreadsheetId": "..." }
```

---

### ⚠️ sheets_confirm (5 actions)

User confirmation (MCP Elicitation).

| Action            | Purpose                     |
| ----------------- | --------------------------- |
| `request`         | Request user confirmation   |
| `get_stats`       | Get confirmation statistics |
| `wizard_start`    | Start multi-step wizard     |
| `wizard_step`     | Execute wizard step         |
| `wizard_complete` | Complete wizard             |

```json
{
  "action": "request",
  "plan": {
    "title": "Delete Duplicate Rows",
    "steps": [{ "stepNumber": 1, "description": "Delete 150 rows", "risk": "high" }]
  }
}
```

---

### 🤖 sheets_analyze (11 actions)

AI-powered analysis. **Use `comprehensive` for 1-shot analysis!**

| Action                   | Purpose                                                  |
| ------------------------ | -------------------------------------------------------- |
| `comprehensive`          | **FULL ANALYSIS** - metadata + data + quality + patterns |
| `analyze_data`           | Analyze data patterns                                    |
| `suggest_visualization`  | Recommend charts                                         |
| `generate_formula`       | Generate formula                                         |
| `detect_patterns`        | Detect patterns                                          |
| `analyze_structure`      | Analyze structure                                        |
| `analyze_quality`        | Analyze data quality                                     |
| `analyze_performance`    | Performance analysis                                     |
| `analyze_formulas`       | Analyze formulas                                         |
| `query_natural_language` | Natural language query                                   |
| `explain_analysis`       | Explain analysis results                                 |

```json
{ "action": "comprehensive", "spreadsheetId": "..." }
```

---

### 🔧 sheets_fix (1 action)

Automated issue resolution.

| Action | Purpose                  |
| ------ | ------------------------ |
| `fix`  | Auto-fix detected issues |

```json
{ "action": "fix", "spreadsheetId": "...", "issues": [...], "mode": "preview" }
```

---

### 🔗 sheets_composite (7 actions)

High-level composite operations.

| Action               | Purpose                   |
| -------------------- | ------------------------- |
| `import_csv`         | Import CSV data           |
| `smart_append`       | Intelligent row append    |
| `bulk_update`        | Batch update by key       |
| `deduplicate`        | Remove duplicates         |
| `export_xlsx`        | Export to Excel           |
| `import_xlsx`        | Import from Excel         |
| `get_form_responses` | Get Google Form responses |

```json
{ "action": "import_csv", "spreadsheetId": "...", "sheet": "Data", "csvData": "Name,Age\nAlice,30" }
```

---

### 🧠 sheets_session (13 actions)

Conversation context management.

| Action               | Purpose                      |
| -------------------- | ---------------------------- |
| `set_active`         | Set active spreadsheet       |
| `get_active`         | Get active spreadsheet       |
| `get_context`        | Get full context             |
| `record_operation`   | Record operation             |
| `get_last_operation` | Get last operation           |
| `get_history`        | Get operation history        |
| `find_by_reference`  | Resolve "that", "the budget" |
| `update_preferences` | Update user preferences      |
| `get_preferences`    | Get preferences              |
| `set_pending`        | Set pending operation        |
| `get_pending`        | Get pending operation        |
| `clear_pending`      | Clear pending                |
| `reset`              | Reset session                |

```json
{ "action": "set_active", "spreadsheetId": "...", "title": "Budget 2025" }
```

---

### 📄 sheets_templates (8 actions)

Template library management.

| Action           | Purpose                 |
| ---------------- | ----------------------- |
| `list`           | List templates          |
| `get`            | Get template            |
| `create`         | Save as template        |
| `apply`          | Create from template    |
| `update`         | Update template         |
| `delete`         | Delete template         |
| `preview`        | Preview template        |
| `import_builtin` | Import builtin template |

```json
{ "action": "apply", "templateId": "budget-2024", "title": "Q1 Budget" }
```

---

### 📊 sheets_bigquery (14 actions)

BigQuery Connected Sheets integration.

| Action                 | Purpose                |
| ---------------------- | ---------------------- |
| `connect`              | Connect to BigQuery    |
| `connect_looker`       | Connect to Looker      |
| `disconnect`           | Disconnect source      |
| `list_connections`     | List connections       |
| `get_connection`       | Get connection details |
| `query`                | Run SQL query          |
| `preview`              | Preview query results  |
| `refresh`              | Refresh data           |
| `cancel_refresh`       | Cancel refresh         |
| `list_datasets`        | List datasets          |
| `list_tables`          | List tables            |
| `get_table_schema`     | Get table schema       |
| `export_to_bigquery`   | Export to BigQuery     |
| `import_from_bigquery` | Import from BigQuery   |

```json
{ "action": "query", "projectId": "my-project", "query": "SELECT * FROM dataset.table LIMIT 100" }
```

---

### ⚡ sheets_appsscript (14 actions)

Apps Script automation.

| Action             | Purpose               |
| ------------------ | --------------------- |
| `create`           | Create script project |
| `get`              | Get project details   |
| `get_content`      | Get script code       |
| `update_content`   | Update script         |
| `create_version`   | Create version        |
| `list_versions`    | List versions         |
| `get_version`      | Get version           |
| `deploy`           | Deploy script         |
| `list_deployments` | List deployments      |
| `get_deployment`   | Get deployment        |
| `undeploy`         | Remove deployment     |
| `run`              | Execute function      |
| `list_processes`   | List processes        |
| `get_metrics`      | Get usage metrics     |

```json
{ "action": "run", "scriptId": "...", "functionName": "myFunction", "parameters": [] }
```

---

### 🔔 sheets_webhook (6 actions)

Change notifications with HMAC signature verification.

| Action       | Purpose                   |
| ------------ | ------------------------- |
| `register`   | Register webhook endpoint |
| `unregister` | Remove webhook            |
| `list`       | List active webhooks      |
| `test`       | Test webhook delivery     |
| `get_status` | Get webhook status        |
| `update`     | Update webhook config     |

```json
{
  "action": "register",
  "spreadsheetId": "...",
  "webhookUrl": "https://your-server.com/webhook",
  "events": ["cellChange", "sheetAdd"]
}
```

---

### 🔗 sheets_dependencies (7 actions)

Formula dependency graph analysis.

| Action           | Purpose                         |
| ---------------- | ------------------------------- |
| `build`          | Build dependency graph          |
| `analyze_impact` | Impact analysis for changes     |
| `detect_cycles`  | Find circular references        |
| `export_dot`     | Export as DOT format            |
| `get_dependents` | Get cells that depend on range  |
| `get_precedents` | Get cells that range depends on |
| `visualize`      | Visualize dependencies          |

```json
{ "action": "build", "spreadsheetId": "...", "sheetId": 0 }
```

---

## Best Practices

### 1. Always Use Transactions for Multiple Operations

```json
// ❌ BAD: 10 separate API calls
sheets_data { action: "write", range: "A1", ... }
sheets_data { action: "write", range: "B1", ... }
// ... 8 more calls

// ✅ GOOD: 1 batched API call
sheets_transaction { action: "begin", spreadsheetId: "..." }
sheets_transaction { action: "queue", transactionId: "tx_...", operation: {...} }
// ... queue more operations
sheets_transaction { action: "commit", transactionId: "tx_..." }
```

### 2. Use `get_comprehensive` for Analysis

```json
// ❌ BAD: Multiple calls for metadata
sheets_core { action: "get", ... }
sheets_core { action: "list_sheets", ... }
sheets_advanced { action: "list_named_ranges", ... }

// ✅ GOOD: 1 call gets everything
sheets_core { action: "get_comprehensive", spreadsheetId: "..." }
```

### 3. Optimal Execution Sequence

```
1. AUTH      → sheets_auth { action: "status" }
2. ANALYZE   → sheets_core { action: "get_comprehensive" }
3. STRUCTURE → Transaction: Create sheets, headers, freeze rows
4. DATA      → Transaction: Write data, formulas
5. FORMAT    → Transaction: Styling, conditional formatting
6. CHARTS    → sheets_visualize { action: "chart_create" }
7. PROTECT   → sheets_advanced { action: "add_protected_range" }
```

### 4. Error Handling Pattern

```json
// Always check auth first
sheets_auth { action: "status" }

// Use quality checks
sheets_quality { action: "validate", dryRun: true }

// Auto-fix issues
sheets_fix { action: "fix", mode: "preview" }

// Use history for recovery
sheets_history { action: "undo" }
```

---

## Response Template

After creating a spreadsheet application:

```
✅ **[Application Name] Created!**

📊 **Dashboard** - KPIs, charts, summary
👥 **Data Sheet** - X columns, formulas, validation
⚙️ **Settings** - Reference data (hidden)

**Features:**
• Auto-generated IDs
• Linked data (VLOOKUP)
• Dropdown validation
• Conditional formatting
• Calculated fields
• Frozen headers

🔗 [Open Spreadsheet](url)

Would you like me to:
1. Add sample data?
2. Create additional charts?
3. Customize columns?
```

---

## Limitations

- Max 100 operations per transaction
- Max 10MB per batchUpdate payload
- API rate limits: 60 requests/minute/user
- Some QUERY formulas may need adjustment
- Cross-sheet INDIRECT requires specific syntax

---

_ServalSheets v1.6.0 | 21 Tools | 271 Actions | MCP 2025-11-25_
