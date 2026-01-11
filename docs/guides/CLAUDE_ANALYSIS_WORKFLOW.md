# Claude Sheet Analysis Workflow Guide

> **Purpose**: This guide shows how Claude should analyze Google Sheets before taking actions, ensuring safe operations and optimal tool usage patterns.

---

## Table of Contents

1. [Pre-Action Analysis Workflow](#pre-action-analysis-workflow)
2. [Tool Selection Decision Tree](#tool-selection-decision-tree)
3. [Tool Calling Patterns by Use Case](#tool-calling-patterns-by-use-case)
4. [Safety Rails & Confirmation Flow](#safety-rails--confirmation-flow)
5. [Error Handling Patterns](#error-handling-patterns)
6. [Performance Optimization](#performance-optimization)
7. [Common Workflows](#common-workflows)

---

## Pre-Action Analysis Workflow

**Every sheet operation should follow this 5-step analysis pattern:**

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Authentication Check                                   │
│  ► sheets_auth action="status"                                  │
│  • Verify user is authenticated before any operation            │
│  • If not authenticated → sheets_auth action="login"            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Spreadsheet Context                                    │
│  ► sheets_spreadsheet action="get"                              │
│  • Get spreadsheet title, sheets list, properties               │
│  • Cache spreadsheetId for subsequent operations                │
│  • Verify sheet names exist before range operations             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Data Quality Analysis (if modifying data)              │
│  ► sheets_analysis action="data_quality"                        │
│  • Check for empty cells, duplicates, mixed types               │
│  • Identify issues BEFORE making changes                        │
│  • Use sheets_analysis action="formula_audit" for formula ops   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Preview Changes (Dry Run)                              │
│  ► Any write operation with safety:{dryRun:true}                │
│  • See exactly what will change before executing                │
│  • User can review and approve or modify                        │
│  • No actual changes made to spreadsheet                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: Execute with Safety                                    │
│  ► Operation with safety:{createSnapshot:true}                  │
│  • Creates automatic restore point before execution             │
│  • Enables instant rollback if issues discovered                │
│  • Use sheets_history action="rollback" to undo                 │
└─────────────────────────────────────────────────────────────────┘
```

### Example: Complete Analysis Before Writing

```json
// Step 1: Check authentication
{ "action": "status" }  // → sheets_auth

// Step 2: Get spreadsheet context
{ 
  "action": "get", 
  "spreadsheetId": "1ABC..." 
}  // → sheets_spreadsheet

// Step 3: Analyze data quality
{ 
  "action": "data_quality",
  "spreadsheetId": "1ABC...",
  "range": { "a1": "Sheet1!A1:Z100" }
}  // → sheets_analysis

// Step 4: Preview write (dry run)
{
  "action": "write",
  "spreadsheetId": "1ABC...",
  "range": { "a1": "Sheet1!A1:B10" },
  "values": [["Header1", "Header2"], ["Data1", "Data2"]],
  "safety": { "dryRun": true }
}  // → sheets_values

// Step 5: Execute with snapshot
{
  "action": "write",
  "spreadsheetId": "1ABC...",
  "range": { "a1": "Sheet1!A1:B10" },
  "values": [["Header1", "Header2"], ["Data1", "Data2"]],
  "safety": { "createSnapshot": true }
}  // → sheets_values
```

---

## Tool Selection Decision Tree

### Which Analysis Tool to Use?

```
User wants to analyze spreadsheet data
│
├── Need fast, deterministic checks? (<1 second)
│   └── ✅ sheets_analysis
│       • data_quality - duplicates, empty cells, mixed types
│       • formula_audit - errors, broken refs, performance issues
│       • statistics - mean, median, std dev, correlations
│       • structure - sheet layout, named ranges, protection
│
├── Need AI-powered insights? (2-5 seconds)
│   └── ✅ sheets_analyze
│       • analyze - patterns, trends, anomalies with AI reasoning
│       • generate_formula - natural language → Google Sheets formula
│       • suggest_chart - AI recommends best visualization
│
└── BEST PRACTICE: Use BOTH in sequence
    1. sheets_analysis first (fast baseline)
    2. sheets_analyze second (deeper AI insights)
```

### Which Write Tool to Use?

```
User wants to modify data
│
├── Single range operation?
│   └── ✅ sheets_values action="write"
│
├── Multiple ranges in one operation?
│   └── ✅ sheets_values action="batch_write"
│
├── Append rows to end of data?
│   └── ✅ sheets_values action="append"
│
├── 2+ operations that must succeed together?
│   └── ✅ sheets_transaction
│       1. action="begin" → get transactionId
│       2. action="queue" (repeat for each operation)
│       3. action="commit" → executes all atomically
│
└── >100 cells being modified?
    └── ✅ ALWAYS use sheets_confirm first for user approval
```

### Delete Operations Decision Tree

```
⚠️ DELETE OPERATIONS ARE DESTRUCTIVE

User wants to delete rows/columns/sheets
│
├── Check dependencies first
│   └── sheets_impact action="analyze" changeType="delete"
│
├── Get user confirmation
│   └── sheets_confirm action="request" with detailed plan
│
├── Create restore point
│   └── safety: { createSnapshot: true }
│
└── Execute delete
    └── sheets_dimensions action="delete_rows" (or delete_columns)
```

---

## Tool Calling Patterns by Use Case

### Pattern 1: Read-Only Analysis

```json
// Fast path - no confirmation needed
sheets_auth      → { "action": "status" }
sheets_analysis  → { "action": "data_quality", "spreadsheetId": "...", "range": {...} }
sheets_analysis  → { "action": "statistics", "spreadsheetId": "...", "range": {...} }
```

### Pattern 2: Safe Write Operation

```json
// Single write with safety rails
sheets_values → {
  "action": "write",
  "spreadsheetId": "1ABC...",
  "range": { "a1": "Sheet1!A1:D10" },
  "values": [[...]],
  "safety": {
    "dryRun": true,           // Step 1: Preview
    "createSnapshot": false
  }
}

// After user approval, execute:
sheets_values → {
  "action": "write",
  "spreadsheetId": "1ABC...",
  "range": { "a1": "Sheet1!A1:D10" },
  "values": [[...]],
  "safety": {
    "dryRun": false,          // Step 2: Execute
    "createSnapshot": true    // With restore point
  }
}
```

### Pattern 3: Bulk Operations with Transaction

```json
// Begin transaction (80-95% fewer API calls)
sheets_transaction → {
  "action": "begin",
  "spreadsheetId": "1ABC...",
  "autoRollback": true
}
// Returns: { "transactionId": "tx_123" }

// Queue operations
sheets_transaction → {
  "action": "queue",
  "transactionId": "tx_123",
  "operation": {
    "tool": "sheets_values",
    "action": "write",
    "args": { "range": {...}, "values": [[...]] }
  }
}

sheets_transaction → {
  "action": "queue",
  "transactionId": "tx_123",
  "operation": {
    "tool": "sheets_format",
    "action": "set_font",
    "args": { "range": {...}, "bold": true }
  }
}

// Commit all at once
sheets_transaction → {
  "action": "commit",
  "transactionId": "tx_123"
}
```

### Pattern 4: AI-Powered Formula Generation

```json
// Step 1: Describe what you need in natural language
sheets_analyze → {
  "action": "generate_formula",
  "spreadsheetId": "1ABC...",
  "description": "Calculate year-over-year growth percentage comparing column B (this year) to column C (last year)",
  "range": { "a1": "Sheet1!A1:C100" }
}
// Returns: "=(B2-C2)/C2*100" with explanation

// Step 2: Apply the generated formula
sheets_values → {
  "action": "write",
  "spreadsheetId": "1ABC...",
  "range": { "a1": "Sheet1!D2" },
  "values": [["=(B2-C2)/C2*100"]],
  "safety": { "dryRun": true }
}
```

---

## Safety Rails & Confirmation Flow

### When to Require Confirmation

| Operation Type | Cells Affected | Confirmation Required |
|---------------|----------------|----------------------|
| Read | Any | ❌ No |
| Write | < 10 | ❌ No (but recommend dry-run) |
| Write | 10-100 | ⚠️ Recommended |
| Write | > 100 | ✅ **Required** |
| Delete rows/columns | Any | ✅ **Required** |
| Delete sheet | Any | ✅ **Required** |
| Change sharing | Any | ✅ **Required** |

### Confirmation Flow (MCP Elicitation)

```json
// Step 1: Build operation plan
sheets_confirm → {
  "action": "request",
  "plan": {
    "title": "Clean Data Quality Issues",
    "description": "Fix 25 data quality issues in Sales sheet",
    "steps": [
      {
        "stepNumber": 1,
        "description": "Remove 10 duplicate rows from A2:A100",
        "tool": "sheets_dimensions",
        "action": "delete_rows",
        "risk": "high",
        "isDestructive": true,
        "canUndo": true
      },
      {
        "stepNumber": 2,
        "description": "Fill 15 empty cells in required columns",
        "tool": "sheets_values",
        "action": "write",
        "risk": "medium",
        "isDestructive": false,
        "canUndo": true
      }
    ],
    "willCreateSnapshot": true,
    "additionalWarnings": ["This will permanently delete rows unless snapshot is created"]
  }
}

// User sees interactive UI:
// ┌─────────────────────────────────────────┐
// │ Plan: Clean Data Quality Issues         │
// │ Risk: HIGH | Affects: 25 cells          │
// │                                         │
// │ Step 1: Delete 10 rows (HIGH RISK)      │
// │ Step 2: Fill 15 cells (medium risk)     │
// │                                         │
// │ [✓ Approve] [✎ Modify] [✗ Cancel]       │
// └─────────────────────────────────────────┘

// Returns: { "status": "approved" | "rejected" | "modified" }
```

### Snapshot & Rollback Pattern

```json
// Create manual snapshot before risky operation
sheets_versions → {
  "action": "create_snapshot",
  "spreadsheetId": "1ABC...",
  "description": "Before bulk data import 2024-01-09"
}
// Returns: { "snapshotId": "snap_123", "timestamp": "..." }

// ... perform operations ...

// If something goes wrong, rollback:
sheets_versions → {
  "action": "restore",
  "spreadsheetId": "1ABC...",
  "revisionId": "snap_123"
}
```

---

## Error Handling Patterns

### Error Response Pattern

```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "User not authenticated or insufficient permissions",
    "suggestion": "Run sheets_auth action='login' to authenticate"
  }
}
```

### Common Errors and Recovery

| Error Code | Cause | Recovery Action |
|-----------|-------|-----------------|
| `TOKEN_NOT_FOUND` | First time use | `sheets_auth action="login"` |
| `AUTH_EXPIRED` | Token expired | Auto-refreshes, or re-login |
| `PERMISSION_DENIED` | No access to sheet | Request owner to share |
| `RANGE_NOT_FOUND` | Invalid range/sheet name | Use `sheets_sheet action="list"` to verify |
| `QUOTA_EXCEEDED` | Too many API calls | Wait 60s, use batch operations |
| `VALIDATION_FAILED` | Invalid input format | Check schema requirements |

### Recovery Workflow

```
Error detected
│
├── PERMISSION_DENIED
│   └── sheets_auth action="login" → Complete OAuth → Retry
│
├── RANGE_NOT_FOUND
│   └── sheets_sheet action="list" → Verify sheet name → Fix range → Retry
│
├── QUOTA_EXCEEDED
│   └── Wait 60 seconds → Use batch operations → Retry
│
├── TRANSACTION_FAILED
│   └── Auto-rollback if autoRollback:true → Review errors → Retry
│
└── Unknown Error
    └── sheets_history action="list" → Check recent operations → Debug
```

---

## Performance Optimization

### API Quota Conservation

```
┌────────────────────────────────────────────────────────────────┐
│  INEFFICIENT: Multiple single operations (10 API calls)       │
├────────────────────────────────────────────────────────────────┤
│  sheets_values action="write" range="A1"  → 1 call            │
│  sheets_values action="write" range="A2"  → 1 call            │
│  sheets_values action="write" range="A3"  → 1 call            │
│  ... (7 more)                             → 7 calls           │
│  TOTAL: 10 API calls                                          │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  EFFICIENT: Batch operation (1 API call)                      │
├────────────────────────────────────────────────────────────────┤
│  sheets_values action="batch_write" → 1 call                  │
│    ranges: ["A1:A10"]                                         │
│    values: [[...10 values...]]                                │
│  TOTAL: 1 API call (90% reduction!)                           │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  OPTIMAL: Transaction (1 API call for 50+ operations)         │
├────────────────────────────────────────────────────────────────┤
│  sheets_transaction action="begin"        → 0 API calls       │
│  sheets_transaction action="queue" × 50   → 0 API calls       │
│  sheets_transaction action="commit"       → 1 API call        │
│  TOTAL: 1 API call (98% reduction!)                           │
└────────────────────────────────────────────────────────────────┘
```

### Caching Strategy

- **Cache spreadsheetId** after first `sheets_spreadsheet action="get"`
- **Cache sheet names/IDs** after `sheets_sheet action="list"`
- **Use batch_read** instead of multiple single reads
- **Check auth status once** at session start, not before every operation

---

## Common Workflows

### Workflow 1: Import Data Safely

```
1. sheets_auth action="status"                    // Verify auth
2. sheets_spreadsheet action="get"                // Get metadata
3. sheets_analysis action="data_quality"          // Check existing data
4. sheets_values action="write" dryRun:true       // Preview import
5. sheets_confirm action="request"                // Get user approval
6. sheets_values action="write" createSnapshot:true // Execute
7. sheets_format action="set_font" bold:true      // Format headers
8. sheets_dimensions action="auto_resize"         // Fit columns
```

### Workflow 2: Generate Report from Data

```
1. sheets_auth action="status"                    // Verify auth
2. sheets_values action="read"                    // Get data
3. sheets_analysis action="statistics"            // Calculate stats
4. sheets_analyze action="analyze"                // AI pattern detection
5. sheets_analyze action="suggest_chart"          // Get chart recommendation
6. sheets_charts action="create"                  // Create visualization
```

### Workflow 3: Clean Data Quality Issues

```
1. sheets_analysis action="data_quality"          // Find issues
2. sheets_analysis action="formula_audit"         // Check formulas
3. sheets_impact action="analyze"                 // Check dependencies
4. sheets_confirm action="request"                // User approval
5. sheets_fix action="preview" mode="preview"     // Preview fixes
6. sheets_fix action="apply" createSnapshot:true  // Apply fixes
7. sheets_analysis action="data_quality"          // Verify fixes
```

### Workflow 4: Collaborative Editing Setup

```
1. sheets_spreadsheet action="create"             // New spreadsheet
2. sheets_sheet action="add"                      // Add sheets
3. sheets_advanced action="add_named_range"       // Define ranges
4. sheets_advanced action="add_protected_range"   // Protect headers
5. sheets_rules action="add_validation"           // Add dropdowns
6. sheets_format action="apply_preset"            // Apply styling
7. sheets_sharing action="share"                  // Share with team
```

---

## Quick Reference: Tool → Action Mapping

| Tool | Primary Actions | Use Case |
|------|----------------|----------|
| `sheets_auth` | status, login, logout | Authentication |
| `sheets_spreadsheet` | get, create, copy, list | Spreadsheet metadata |
| `sheets_sheet` | list, add, delete, duplicate | Sheet (tab) management |
| `sheets_values` | read, write, append, batch_read, batch_write | Cell data operations |
| `sheets_cells` | merge, add_note, set_hyperlink | Individual cell properties |
| `sheets_format` | set_font, set_colors, set_borders | Visual formatting |
| `sheets_dimensions` | insert_rows, delete_rows, freeze, auto_resize | Row/column structure |
| `sheets_rules` | add_conditional_format, add_validation | Rules & validation |
| `sheets_charts` | create, update, delete | Chart visualization |
| `sheets_pivot` | create, refresh | Pivot table aggregation |
| `sheets_filter_sort` | set_filter, sort_range | Filtering & sorting |
| `sheets_sharing` | share, revoke, get_link | Permission management |
| `sheets_comments` | add, reply, resolve | Collaboration comments |
| `sheets_versions` | create_snapshot, restore | Version control |
| `sheets_analysis` | data_quality, formula_audit, statistics | Fast deterministic analysis |
| `sheets_analyze` | analyze, generate_formula, suggest_chart | AI-powered analysis |
| `sheets_advanced` | add_named_range, add_protected_range | Advanced features |
| `sheets_transaction` | begin, queue, commit | Atomic batch operations |
| `sheets_validation` | validate | Pre-flight validation |
| `sheets_conflict` | detect, resolve | Conflict management |
| `sheets_impact` | analyze | Change impact analysis |
| `sheets_history` | list, rollback | Operation audit trail |
| `sheets_confirm` | request, get_stats | User confirmation UI |
| `sheets_fix` | preview, apply | Auto-fix issues |
| `sheets_macros` | record, play, save | Macro recording |
| `sheets_custom_functions` | create, list, execute | Custom functions |

---

## Checklist: Before Any Sheet Operation

- [ ] **Auth checked** - `sheets_auth action="status"` returns authenticated
- [ ] **Spreadsheet exists** - Verified with `sheets_spreadsheet action="get"`
- [ ] **Sheet name valid** - Confirmed with `sheets_sheet action="list"`
- [ ] **Range format correct** - Using `{ "a1": "Sheet1!A1:D10" }` object format
- [ ] **Data analyzed** - Ran `sheets_analysis action="data_quality"` if modifying
- [ ] **Impact assessed** - Used `sheets_impact action="analyze"` for deletions
- [ ] **Dry-run completed** - Previewed with `safety: { dryRun: true }`
- [ ] **User confirmed** - Got approval via `sheets_confirm` for >100 cells
- [ ] **Snapshot created** - Executing with `safety: { createSnapshot: true }`

---

*Last Updated: 2026-01-09*
*ServalSheets Version: 1.3.0*
