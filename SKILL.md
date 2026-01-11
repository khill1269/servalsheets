# ServalSheets Advanced Orchestration Skill

## Overview

This skill enables Claude to create sophisticated Google Sheets applications (CRMs, dashboards, trackers, etc.) using natural language commands via the ServalSheets MCP server.

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
2. CREATE    → sheets_spreadsheet { action: "create", title, sheets: [...] }
3. STRUCTURE → Transaction: headers, column widths, freeze rows
4. REFERENCE → Transaction: settings/reference data (dropdown sources)
5. FORMULAS  → Transaction: all calculated columns
6. VALIDATION→ Transaction: dropdowns, data validation rules
7. FORMATTING→ Transaction: colors, conditional formatting, borders
8. CHARTS    → sheets_charts { action: "create", ... } (separate calls OK)
9. PROTECT   → Transaction: protect formula cells, hide reference sheets
```

### 3. Sheet Naming Convention

Use emoji + name for visual organization:
- 📊 Dashboard
- 👥 Contacts
- 🏢 Companies  
- 💰 Deals
- 📝 Tasks
- ⚙️ Settings (hidden)

## Tool Call Patterns

### Pattern A: Create Multi-Sheet Spreadsheet

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

Queue multiple writes in one transaction:

```json
{
  "action": "queue",
  "transactionId": "tx_...",
  "operation": {
    "tool": "sheets_values",
    "action": "write",
    "params": {
      "range": "'👥 Contacts'!A1:R1",
      "values": [["ID", "First Name", "Last Name", "Full Name", "Email", "Phone", "Company", "Company ID", "Title", "Status", "Lead Source", "Owner", "Created", "Last Contact", "Days Since", "Total Deals", "Deal Value", "Notes"]]
    }
  }
}
```

### Pattern C: Add Formulas (Write as Text)

Formulas are written as text values starting with `=`:

```json
{
  "action": "queue",
  "transactionId": "tx_...",
  "operation": {
    "tool": "sheets_values",
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

```json
{
  "action": "queue",
  "transactionId": "tx_...",
  "operation": {
    "tool": "sheets_rules",
    "action": "add_validation",
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
    "tool": "sheets_rules",
    "action": "add_validation",
    "params": {
      "range": "'👥 Contacts'!G2:G1000",
      "type": "LIST",
      "formula": "='⚙️ Settings'!$A$2:$A$100"
    }
  }
}
```

### Pattern E: Conditional Formatting

```json
{
  "action": "queue",
  "transactionId": "tx_...",
  "operation": {
    "tool": "sheets_rules",
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

```json
{
  "action": "create",
  "spreadsheetId": "...",
  "type": "PIE",
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

## Error Handling

If a transaction fails:
1. Auto-rollback is enabled, so no partial state
2. Report which operation failed
3. Suggest fix (usually validation issue or formula syntax)
4. Offer to retry with correction

## Limitations

- Max 100 operations per transaction
- Max 10MB per batchUpdate payload
- Some complex QUERY formulas may need adjustment
- Cross-sheet INDIRECT references require specific syntax
