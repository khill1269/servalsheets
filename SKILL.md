# ServalSheets Advanced Orchestration Skill (v1.4.0)

## Overview

This skill enables Claude to create sophisticated Google Sheets applications (CRMs, dashboards, trackers, etc.) using natural language commands via the ServalSheets MCP server.

**Version:** 1.4.0 (17 tools, 226 actions)
**Updated:** 2026-01-16
**Features:** Transactions, AI analysis, auto-repair, conversational context, composite operations

## When to Use This Skill

Use this skill when the user asks to:

- Create a CRM, tracker, dashboard, or database in Google Sheets
- Build a spreadsheet with multiple connected sheets
- Add advanced formulas, validation, or formatting
- Create a "professional" or "advanced" spreadsheet application

## Core Principles

### 1. Always Use Transactions for Multiple Operations

**NEVER** make individual tool calls when you need 2+ operations. Use `sheets_transaction`:

```
sheets_transaction { action: "begin", spreadsheetId, autoRollback: true }
sheets_transaction { action: "queue", transactionId, operation: {...} }
sheets_transaction { action: "queue", transactionId, operation: {...} }
sheets_transaction { action: "commit", transactionId }
```

This reduces 10+ API calls to 1.

### 2. Optimal Execution Sequence

Always follow this order:

```
1. AUTH      → sheets_auth { action: "status" }
2. VALIDATE  → sheets_quality { action: "validate", dryRun: true } (optional)
3. CREATE    → sheets_core { action: "create", title, sheets: [...] }
4. IMPORT    → sheets_composite { action: "import_csv" } (if importing data)
5. STRUCTURE → Transaction: headers, column widths, freeze rows
6. REFERENCE → Transaction: settings/reference data (dropdown sources)
7. FORMULAS  → Transaction: all calculated columns
8. VALIDATION→ Transaction: dropdowns, data validation rules
9. FORMATTING→ Transaction: colors, conditional formatting, borders
10. CHARTS   → sheets_visualize { action: "chart_create", ... }
11. QUALITY  → sheets_quality { action: "validate" } (verify)
12. PROTECT  → Transaction: protect formula cells, hide reference sheets
```

**Performance Tip:** For complex spreadsheets, check [servalsheets://guides/quota-optimization](servalsheets://guides/quota-optimization) first.

### 3. Sheet Naming Convention

Use emoji + name for visual organization:

- 📊 Dashboard
- 👥 Contacts
- 🏢 Companies
- 💰 Deals
- 📝 Tasks
- ⚙️ Settings (hidden)

## Modern ServalSheets Features (v1.4.0)

### Conversational Context (sheets_session)

Reference spreadsheets naturally without repeating IDs:

- "the spreadsheet" instead of full spreadsheetId
- "undo that" to revert the last operation
- "show me the active context"

### Composite Operations (sheets_composite)

High-level operations that handle complexity automatically:

- **import_csv**: Import CSV with auto-type detection
- **smart_append**: Intelligent row appending with duplicate detection
- **bulk_update**: Batch update multiple ranges efficiently
- **deduplicate**: Remove duplicate rows by key columns

### Quality Assurance (sheets_quality)

Validate and fix data integrity:

- **validate**: Check data quality and consistency
- **detect_conflicts**: Find conflicting data
- **resolve_conflict**: Auto-resolve conflicts
- **analyze_impact**: Preview change impact before committing

### Auto-Repair (sheets_fix)

Automatically fix broken spreadsheets:

- **fix**: Repair broken formulas, references, and structure

### AI Analysis (sheets_analyze)

Intelligent insights and suggestions:

- **analyze_data**: Get AI-powered data analysis
- **suggest_visualization**: Recommend best chart types
- **comprehensive**: Full spreadsheet analysis

### History & Undo (sheets_history)

Time-travel for spreadsheet changes:

- **undo**: Revert last operation
- **redo**: Re-apply undone operation
- **revert_to**: Jump to specific snapshot
- **list**: View operation history

---

## Tool Call Patterns

### Pattern A: Create Multi-Sheet Spreadsheet

**Tool:** `sheets_core` (formerly sheets_spreadsheet)

```json
{
  "action": "create",
  "title": "Advanced CRM",
  "sheets": [
    { "title": "📊 Dashboard", "rowCount": 100, "columnCount": 15 },
    { "title": "👥 Contacts", "rowCount": 1000, "columnCount": 20 },
    { "title": "🏢 Companies", "rowCount": 500, "columnCount": 18 },
    { "title": "💰 Deals", "rowCount": 500, "columnCount": 20 },
    { "title": "📝 Activities", "rowCount": 2000, "columnCount": 15 },
    { "title": "📧 Interactions", "rowCount": 5000, "columnCount": 12 },
    { "title": "⚙️ Settings", "rowCount": 100, "columnCount": 10 }
  ]
}
```

### Pattern B: Batch Write Headers + Data

**Tool:** `sheets_data` (formerly sheets_values)

Queue multiple writes in one transaction:

```json
{
  "action": "queue",
  "transactionId": "tx_...",
  "operation": {
    "tool": "sheets_data",
    "action": "write",
    "params": {
      "range": "'👥 Contacts'!A1:R1",
      "values": [
        [
          "ID",
          "First Name",
          "Last Name",
          "Full Name",
          "Email",
          "Phone",
          "Company",
          "Company ID",
          "Title",
          "Status",
          "Lead Source",
          "Owner",
          "Created",
          "Last Contact",
          "Days Since",
          "Total Deals",
          "Deal Value",
          "Notes"
        ]
      ]
    }
  }
}
```

### Pattern C: Add Formulas (Write as Text)

**Tool:** `sheets_data`

Formulas are written as text values starting with `=`:

```json
{
  "action": "queue",
  "transactionId": "tx_...",
  "operation": {
    "tool": "sheets_data",
    "action": "write",
    "params": {
      "range": "'👥 Contacts'!A2:A1000",
      "values": [["=\"C-\"&TEXT(ROW()-1,\"0000\")"]]
    }
  }
}
```

For formulas that should copy down, write to first data row and let user drag OR write the formula to the full range.

### Pattern D: Add Data Validation (Dropdown)

**Tool:** `sheets_dimensions` (for validation rules)

```json
{
  "action": "queue",
  "transactionId": "tx_...",
  "operation": {
    "tool": "sheets_dimensions",
    "action": "set_data_validation",
    "params": {
      "range": "'👥 Contacts'!J2:J1000",
      "type": "LIST",
      "values": ["Active", "Inactive", "Lead", "Prospect"]
    }
  }
}
```

For dropdowns from another sheet:

```json
{
  "operation": {
    "tool": "sheets_dimensions",
    "action": "set_data_validation",
    "params": {
      "range": "'👥 Contacts'!G2:G1000",
      "type": "LIST",
      "formula": "='⚙️ Settings'!$A$2:$A$100"
    }
  }
}
```

### Pattern E: Conditional Formatting

**Tool:** `sheets_format`

```json
{
  "action": "queue",
  "transactionId": "tx_...",
  "operation": {
    "tool": "sheets_format",
    "action": "add_conditional_format",
    "params": {
      "range": "'💰 Deals'!I2:I1000",
      "type": "TEXT_EQ",
      "values": ["Closed Won"],
      "format": {
        "backgroundColor": "#e6f4ea",
        "textFormat": { "foregroundColor": "#137333", "bold": true }
      }
    }
  }
}
```

### Pattern F: Format Headers

```json
{
  "action": "queue",
  "transactionId": "tx_...",
  "operation": {
    "tool": "sheets_format",
    "action": "set_format",
    "params": {
      "range": "'👥 Contacts'!A1:R1",
      "format": {
        "backgroundColor": "#1a73e8",
        "textFormat": {
          "foregroundColor": "#ffffff",
          "bold": true,
          "fontSize": 11
        },
        "horizontalAlignment": "CENTER",
        "verticalAlignment": "MIDDLE"
      }
    }
  }
}
```

### Pattern G: Freeze Rows

```json
{
  "action": "queue",
  "transactionId": "tx_...",
  "operation": {
    "tool": "sheets_dimensions",
    "action": "freeze_rows",
    "params": {
      "sheetId": 1,
      "count": 1
    }
  }
}
```

### Pattern H: Create Chart

**Tool:** `sheets_visualize` (formerly sheets_charts)

```json
{
  "action": "chart_create",
  "spreadsheetId": "...",
  "chartType": "PIE",
  "range": "'📊 Dashboard'!A10:B15",
  "title": "Deals by Stage",
  "position": {
    "sheetId": 0,
    "offsetX": 0,
    "offsetY": 200
  }
}
```

## CRM Blueprint Quick Reference

### Contacts Sheet Columns

```
A: ID (formula: ="C-"&TEXT(ROW()-1,"0000"))
B: First Name
C: Last Name
D: Full Name (formula: =B2&" "&C2)
E: Email
F: Phone
G: Company (dropdown from Companies)
H: Company ID (formula: VLOOKUP)
I: Title
J: Status (dropdown: Active/Inactive/Lead)
K: Lead Source (dropdown from Settings)
L: Owner (dropdown from Settings)
M: Created Date
N: Last Contact (formula: MAXIFS from Interactions)
O: Days Since Contact (formula: =TODAY()-N2)
P: Total Deals (formula: COUNTIF)
Q: Deal Value (formula: SUMIF)
R: Notes
```

### Deals Sheet Columns

```
A: Deal ID (formula: ="D-"&TEXT(ROW()-1,"0000"))
B: Deal Name
C: Contact (dropdown)
D: Contact ID (formula: VLOOKUP)
E: Company ID (formula: VLOOKUP)
F: Company Name (formula: VLOOKUP)
G: Value (currency)
H: Stage (dropdown: Lead/Qualified/Proposal/Negotiation/Closed Won/Closed Lost)
I: Status (dropdown: Open/Won/Lost)
J: Probability (formula: VLOOKUP from stage)
K: Expected Value (formula: =G2*J2)
L: Close Date
M: Days in Stage (formula)
N: Stage Changed Date
O: Created Date
P: Owner (dropdown)
Q: Next Step
R: Notes
```

### Pipeline Stages + Probabilities

```
Lead = 10%
Qualified = 25%
Proposal = 50%
Negotiation = 75%
Closed Won = 100%
Closed Lost = 0%
```

### Dashboard Formulas

```
Total Pipeline: =SUMIF(DEALS!I:I,"Open",DEALS!G:G)
Win Rate: =COUNTIF(DEALS!I:I,"Won")/COUNTIFS(DEALS!I:I,"<>Open")
Avg Deal: =AVERAGEIF(DEALS!I:I,"Won",DEALS!G:G)
Overdue Tasks: =COUNTIFS(TASKS!H:H,"<>Done",TASKS!G:G,"<"&TODAY())
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

After creating a CRM, respond with:

```
✅ **Advanced CRM Created!**

📊 **Dashboard** - KPIs, pipeline chart, activity summary
👥 **Contacts** - 18 columns with auto-lookup to companies
🏢 **Companies** - Revenue tracking, contact counts
💰 **Deals** - Full pipeline with stage probabilities
📝 **Activities** - Task management with due dates
📧 **Interactions** - Communication log
⚙️ **Settings** - Reference data (hidden)

**Features:**
• Auto-generated IDs for all records
• Linked data across sheets (VLOOKUP)
• Dropdown lists for data consistency
• Conditional formatting for status indicators
• Formulas for calculated fields
• Frozen headers for easy navigation

🔗 [Open CRM](spreadsheet_url)

Would you like me to:
1. Add sample data?
2. Create additional charts?
3. Customize any columns?
```

### Pattern I: Import CSV Data

**Tool:** `sheets_composite`

```json
{
  "action": "import_csv",
  "spreadsheetId": "...",
  "sheetName": "Contacts",
  "csvData": "Name,Email,Phone\nJohn,john@example.com,555-0100",
  "hasHeaders": true,
  "autoDetectTypes": true
}
```

### Pattern J: Deduplicate Data

**Tool:** `sheets_composite`

```json
{
  "action": "deduplicate",
  "spreadsheetId": "...",
  "range": "Contacts!A2:C1000",
  "keyColumns": ["B"],
  "keepFirst": true
}
```

### Pattern K: Fix Broken Spreadsheet

**Tool:** `sheets_fix`

```json
{
  "action": "fix",
  "spreadsheetId": "...",
  "autoRepair": true
}
```

---

## Error Handling (Enhanced)

### Before Operations

1. **Check auth**: `sheets_auth { action: "status" }`
2. **Validate first** (optional): `sheets_quality { action: "validate", dryRun: true }`
3. **Use transactions**: Auto-rollback prevents partial state

### When Errors Occur

1. **Check error code**: See [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for 46+ error codes
2. **Read guides**: [servalsheets://guides/error-recovery](servalsheets://guides/error-recovery)
3. **Try auto-repair**: `sheets_fix { action: "fix" }`
4. **Use history**: `sheets_history { action: "undo" }`

### Common Errors & Solutions

| Error Code           | Solution                                                                   |
| -------------------- | -------------------------------------------------------------------------- |
| `QUOTA_EXCEEDED`     | Check [quota-optimization guide](servalsheets://guides/quota-optimization) |
| `FORMULA_ERROR`      | Run `sheets_fix { action: "fix" }`                                         |
| `CIRCULAR_REFERENCE` | Analyze with `sheets_analyze { action: "comprehensive" }`                  |
| `INVALID_RANGE`      | Verify A1 notation syntax                                                  |
| `PERMISSION_DENIED`  | Check spreadsheet sharing settings                                         |

### Performance Guides

Before creating complex spreadsheets, consult:

- **Batching:** [servalsheets://guides/batching-strategies](servalsheets://guides/batching-strategies)
- **Caching:** [servalsheets://guides/caching-patterns](servalsheets://guides/caching-patterns)
- **Quota:** [servalsheets://guides/quota-optimization](servalsheets://guides/quota-optimization)
- **Errors:** [servalsheets://guides/error-recovery](servalsheets://guides/error-recovery)

### Decision Trees

Use for guidance on complex decisions:

- [When to use transactions](servalsheets://decisions/when-to-use-transaction)
- [Tool selection guide](servalsheets://decisions/tool-selection)

---

## Quick Troubleshooting

| Issue            | Quick Fix                                       |
| ---------------- | ----------------------------------------------- |
| Quota exceeded   | See quota optimization guide                    |
| Formula broken   | `sheets_fix { action: "fix" }`                  |
| Data conflicts   | `sheets_quality { action: "detect_conflicts" }` |
| Need to undo     | `sheets_history { action: "undo" }`             |
| Import CSV fails | `sheets_composite { action: "import_csv" }`     |
| Slow performance | Check batching strategies guide                 |

**Full troubleshooting:** [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

---

## Limitations

- Max 100 operations per transaction
- Max 10MB per batchUpdate payload
- Some complex QUERY formulas may need adjustment
- Cross-sheet INDIRECT references require specific syntax
- API rate limits: 60 requests/minute/user (use batching!)
