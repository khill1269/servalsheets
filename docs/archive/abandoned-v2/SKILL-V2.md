# ServalSheets 2.0 - Advanced Orchestration Skill

## Overview

ServalSheets 2.0 consolidates 26 tools into **11 Super Tools** with ~170 actions for maximum LLM efficiency.

## Tool Quick Reference

| Tool | Actions | Use Case |
|------|---------|----------|
| `sheets_auth` | 4 | 🔐 OAuth - ALWAYS check first |
| `sheets_data` | 26 | 📊 Read/write data - START HERE |
| `sheets_style` | 18 | 🎨 Formatting & rules |
| `sheets_structure` | 27 | 🏗️ Sheets, rows, columns |
| `sheets_visualize` | 21 | 📈 Charts, pivots, filters |
| `sheets_analyze` | 15 | 🤖 AI analysis - use "comprehensive" |
| `sheets_automate` | 12 | ⚡ Fixes, bulk ops, import |
| `sheets_share` | 16 | 👥 Permissions & comments |
| `sheets_history` | 12 | 📜 Versions & undo |
| `sheets_safety` | 12 | 🛡️ Transactions & validation |
| `sheets_context` | 8 | 🧠 Session & confirmation |

## Decision Tree

```
User wants to...
│
├─ Authenticate? ──────────────► sheets_auth
│
├─ Read/write data? ───────────► sheets_data
│   ├─ Create spreadsheet ─────► action: "create"
│   ├─ Read cells ─────────────► action: "read" / "batch_read"
│   ├─ Write cells ────────────► action: "write" / "batch_write"
│   ├─ Find/replace ───────────► action: "find" / "replace"
│   └─ Cell operations ────────► action: "merge" / "add_note" / etc.
│
├─ Format/style? ──────────────► sheets_style
│   ├─ Colors/fonts ───────────► action: "set_format" / "set_text_format"
│   ├─ Borders ────────────────► action: "set_borders"
│   ├─ Number formats ─────────► action: "set_number_format"
│   ├─ Conditional rules ──────► action: "add_conditional"
│   ├─ Dropdowns ──────────────► action: "add_validation"
│   └─ Presets ────────────────► action: "apply_preset"
│
├─ Organize structure? ────────► sheets_structure
│   ├─ Add/delete sheets ──────► action: "add_sheet" / "delete_sheet"
│   ├─ Insert/delete rows ─────► action: "insert_rows" / "delete_rows"
│   ├─ Freeze headers ─────────► action: "freeze"
│   ├─ Named ranges ───────────► action: "add_named_range"
│   └─ Protect cells ──────────► action: "add_protection"
│
├─ Visualize data? ────────────► sheets_visualize
│   ├─ Create chart ───────────► action: "create_chart"
│   ├─ Create pivot ───────────► action: "create_pivot"
│   ├─ Filter data ────────────► action: "set_filter"
│   └─ Sort data ──────────────► action: "sort_range"
│
├─ Analyze/understand? ────────► sheets_analyze
│   ├─ Full analysis ──────────► action: "comprehensive" ⭐ USE THIS
│   ├─ Quality check ──────────► action: "data_quality"
│   ├─ Generate formula ───────► action: "generate_formula"
│   └─ Suggest chart ──────────► action: "suggest_chart"
│
├─ Automate tasks? ────────────► sheets_automate
│   ├─ Fix issues ─────────────► action: "apply_fixes"
│   ├─ Import CSV ─────────────► action: "import_csv"
│   ├─ Bulk update ────────────► action: "bulk_update"
│   └─ Deduplicate ────────────► action: "deduplicate"
│
├─ Share/collaborate? ─────────► sheets_share
│   ├─ Share with user ────────► action: "share"
│   ├─ Add comment ────────────► action: "add_comment"
│   └─ Get share link ─────────► action: "get_share_link"
│
├─ Version control? ───────────► sheets_history
│   ├─ Create snapshot ────────► action: "create_snapshot"
│   ├─ Undo last action ───────► action: "undo"
│   └─ Restore version ────────► action: "restore_revision"
│
├─ Multiple operations? ───────► sheets_safety
│   ├─ Begin transaction ──────► action: "begin"
│   ├─ Queue operations ───────► action: "queue"
│   ├─ Commit all ─────────────► action: "commit"
│   └─ Validate data ──────────► action: "validate"
│
└─ Need confirmation? ─────────► sheets_context
    ├─ Request approval ───────► action: "request_confirm"
    └─ Track session ──────────► action: "set_active"
```

## Core Principles

### 1. Always Use Transactions for 2+ Operations

**NEVER** make individual tool calls when you need multiple operations:

```
sheets_safety { action: "begin", spreadsheetId, autoRollback: true }
sheets_safety { action: "queue", transactionId, operation: {...} }
sheets_safety { action: "queue", transactionId, operation: {...} }
sheets_safety { action: "commit", transactionId }
```

This reduces 10+ API calls to 1.

### 2. Use "comprehensive" for Analysis

Instead of calling `sheets_data.get` + `sheets_data.read` + `sheets_analyze.data_quality`:

```json
{
  "tool": "sheets_analyze",
  "action": "comprehensive",
  "spreadsheetId": "1ABC..."
}
```

Returns EVERYTHING in one call: metadata, data, quality, patterns, recommendations.

### 3. Safety Options on Every Write

Every write action in `sheets_data` supports safety options:

```json
{
  "action": "write",
  "spreadsheetId": "1ABC...",
  "range": "A1:D100",
  "values": [...],
  "safety": {
    "dryRun": true,           // Preview changes
    "createSnapshot": true,   // Auto-backup
    "requireConfirmation": true  // Ask user first
  }
}
```

## Optimal Execution Sequence

For complex operations (CRM, dashboard, tracker):

```
1. AUTH        → sheets_auth { action: "status" }
2. CREATE      → sheets_data { action: "create", title, sheets: [...] }
3. STRUCTURE   → Transaction: headers, column widths, freeze rows
4. REFERENCE   → Transaction: settings/reference data (dropdown sources)
5. FORMULAS    → Transaction: all calculated columns
6. VALIDATION  → Transaction: dropdowns, data validation rules
7. FORMATTING  → Transaction: colors, conditional formatting, borders
8. CHARTS      → sheets_visualize { action: "create_chart", ... }
9. PROTECT     → Transaction: protect formula cells, hide reference sheets
```

## Common Patterns

### Pattern A: Create Multi-Sheet Spreadsheet

```json
{
  "tool": "sheets_data",
  "action": "create",
  "title": "Advanced CRM",
  "sheets": [
    { "title": "📊 Dashboard", "rowCount": 100, "columnCount": 15 },
    { "title": "👥 Contacts", "rowCount": 1000, "columnCount": 20 },
    { "title": "🏢 Companies", "rowCount": 500, "columnCount": 18 },
    { "title": "💰 Deals", "rowCount": 500, "columnCount": 20 },
    { "title": "⚙️ Settings", "rowCount": 100, "columnCount": 10 }
  ]
}
```

### Pattern B: Transaction for Multiple Writes

```json
// 1. Begin
{ "tool": "sheets_safety", "action": "begin", "spreadsheetId": "1ABC...", "autoRollback": true }

// 2. Queue operations
{ "tool": "sheets_safety", "action": "queue", "transactionId": "tx_123",
  "operation": { "tool": "sheets_data", "action": "write", "params": { "range": "A1:Z1", "values": [["ID", "Name", ...]] } } }

{ "tool": "sheets_safety", "action": "queue", "transactionId": "tx_123",
  "operation": { "tool": "sheets_style", "action": "set_format", "params": { "range": "A1:Z1", "format": { "bold": true, "backgroundColor": "#1a73e8" } } } }

{ "tool": "sheets_safety", "action": "queue", "transactionId": "tx_123",
  "operation": { "tool": "sheets_structure", "action": "freeze", "params": { "sheetId": 0, "rows": 1 } } }

// 3. Commit all at once
{ "tool": "sheets_safety", "action": "commit", "transactionId": "tx_123" }
```

### Pattern C: Full Analysis in One Call

```json
{
  "tool": "sheets_analyze",
  "action": "comprehensive",
  "spreadsheetId": "1ABC...",
  "includeFormulas": true,
  "includeVisualizations": true,
  "includePerformance": true
}
```

Returns:
- Spreadsheet metadata
- All sheet data (with smart sampling for large sheets)
- Data quality issues
- Pattern detection
- Formula analysis
- Chart recommendations
- Performance recommendations

### Pattern D: Styling with Presets

```json
{
  "tool": "sheets_style",
  "action": "apply_preset",
  "spreadsheetId": "1ABC...",
  "range": "A1:Z1",
  "preset": "header"
}
```

Available presets: `header`, `subheader`, `data`, `currency`, `percentage`, `date`, `highlight`, `warning`, `error`, `success`, `link`

### Pattern E: Dropdowns from Data Validation

```json
{
  "tool": "sheets_style",
  "action": "add_validation",
  "spreadsheetId": "1ABC...",
  "range": "J2:J1000",
  "rule": {
    "type": "LIST",
    "values": ["Active", "Inactive", "Lead", "Prospect"]
  }
}
```

Or from another range:

```json
{
  "tool": "sheets_style",
  "action": "add_validation",
  "spreadsheetId": "1ABC...",
  "range": "G2:G1000",
  "rule": {
    "type": "LIST_RANGE",
    "range": "'⚙️ Settings'!A2:A100"
  }
}
```

## Color Palette

```
Header Background: #1a73e8 (Blue)
Header Text: #ffffff (White)
Success/Won: #34a853 / #e6f4ea
Warning/Pending: #fbbc04 / #fef7e0  
Danger/Lost: #ea4335 / #fce8e6
Neutral: #5f6368
Alt Row: #f8f9fa
```

## Response Template

After creating a complex spreadsheet:

```
✅ **[Title] Created!**

📊 **Dashboard** - KPIs, charts, summary
👥 **[Sheet 1]** - Description
🏢 **[Sheet 2]** - Description
💰 **[Sheet 3]** - Description
⚙️ **Settings** - Reference data (hidden)

**Features:**
• Auto-generated IDs
• Linked data across sheets
• Dropdown lists for consistency
• Conditional formatting
• Calculated fields
• Frozen headers

🔗 [Open Spreadsheet](url)

Would you like me to:
1. Add sample data?
2. Create additional charts?
3. Customize any columns?
```

## Error Handling

If a transaction fails:
1. Auto-rollback is enabled, so no partial state
2. Report which operation failed
3. Suggest fix (usually validation issue or formula syntax)
4. Offer to retry with correction

## Migration from v1

| v1 Tool | v2 Tool |
|---------|---------|
| sheets_spreadsheet | sheets_data |
| sheets_values | sheets_data |
| sheets_cells | sheets_data |
| sheets_format | sheets_style |
| sheets_rules | sheets_style |
| sheets_sheet | sheets_structure |
| sheets_dimensions | sheets_structure |
| sheets_advanced | sheets_structure |
| sheets_charts | sheets_visualize |
| sheets_pivot | sheets_visualize |
| sheets_filter_sort | sheets_visualize |
| sheets_analysis | sheets_analyze |
| sheets_analyze | sheets_analyze |
| sheets_fix | sheets_automate |
| sheets_composite | sheets_automate |
| sheets_sharing | sheets_share |
| sheets_comments | sheets_share |
| sheets_versions | sheets_history |
| sheets_history | sheets_history |
| sheets_transaction | sheets_safety |
| sheets_validation | sheets_safety |
| sheets_conflict | sheets_safety |
| sheets_impact | sheets_safety |
| sheets_confirm | sheets_context |
| sheets_session | sheets_context |

## Benefits of v2

1. **58% fewer tools** - 11 vs 26 = easier reasoning
2. **Intent-based grouping** - Tools match user mental models
3. **Built-in safety** - Every write has safety options
4. **One-call analysis** - "comprehensive" gets everything
5. **Consistent naming** - All actions use verb_noun pattern
