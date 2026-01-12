# MCP Inspector Enhancement Plan

## Current Coverage Analysis

### Coverage by Tool (22 sample requests → 70 actions available)

| Tool | Current | Actions | Coverage | Priority |
|------|---------|---------|----------|----------|
| **Core Operations (Under-Represented)** |
| sheets_auth | 2 | 4 | 50% | ✅ Good |
| sheets_spreadsheet | 1 | 6 | 17% | 🟡 Add: create, copy, list |
| sheets_sheet | 1 | 7 | 14% | 🔴 Add: add, delete, duplicate |
| sheets_values | 2 | 9 | 22% | 🟡 Add: append, batch_read, find/replace |
| sheets_cells | 0 | 12 | **0%** | 🔴 **MISSING - Add: merge, notes, hyperlinks** |
| sheets_format | 1 | 9 | 11% | 🔴 Add: fonts, borders, number formats |
| sheets_dimensions | 0 | 21 | **0%** | 🔴 **MISSING - Add: insert/delete rows, freeze** |
| sheets_rules | 0 | 8 | **0%** | 🔴 **MISSING - Add: conditional format, validation** |
| sheets_charts | 0 | 9 | **0%** | 🔴 **MISSING - Add: create, update charts** |
| sheets_pivot | 0 | 6 | **0%** | 🔴 **MISSING - Add: create, refresh pivots** |
| sheets_filter_sort | 0 | 14 | **0%** | 🔴 **MISSING - Add: filters, sorting** |
| sheets_sharing | 0 | 8 | **0%** | 🔴 **MISSING - Add: share, permissions** |
| sheets_comments | 0 | 10 | **0%** | 🔴 **MISSING - Add: add, reply comments** |
| sheets_versions | 0 | 10 | **0%** | 🔴 **MISSING - Add: snapshots, restore** |
| sheets_analysis | 2 | 13 | 15% | 🟡 Add: statistics, patterns |
| sheets_advanced | 0 | 19 | **0%** | 🔴 **MISSING - Add: named ranges, protection** |
| **Enterprise (Good Coverage)** |
| sheets_transaction | 1 | 6 | 17% | 🟡 Add: queue, commit examples |
| sheets_validation | 1 | 1 | 100% | ✅ Complete |
| sheets_conflict | 1 | 2 | 50% | ✅ Good |
| sheets_impact | 1 | 1 | 100% | ✅ Complete |
| sheets_history | 1 | 7 | 14% | 🟡 Add: search, rollback |
| **MCP-Native (Good Coverage)** |
| sheets_confirm | 2 | 2 | 100% | ✅ Complete |
| sheets_analyze | 3 | 4 | 75% | ✅ Good |
| sheets_fix | 1 | ? | ? | ✅ Good |

### Summary
- **Current:** 22 sample requests covering ~31% of actions
- **Missing:** 11 tools with ZERO sample requests
- **Target:** 60+ comprehensive sample requests (86% coverage)

---

## Proposed Enhancements (38 new samples)

### Phase 1: Critical Missing Tools (15 samples)

#### sheets_cells (12 actions → Add 3 samples)
```json
{
  "name": "🔗 Cells: Merge Header Row",
  "tool": "sheets_cells",
  "action": "merge",
  "description": "Merge cells A1:D1 for a header",
  "arguments": {
    "action": "merge",
    "spreadsheetId": "YOUR_TEST_SPREADSHEET_ID_HERE",
    "range": { "a1": "Sheet1!A1:D1" },
    "mergeType": "MERGE_ALL"
  }
},
{
  "name": "📝 Cells: Add Note to Cell",
  "tool": "sheets_cells",
  "action": "add_note",
  "arguments": {
    "action": "add_note",
    "spreadsheetId": "YOUR_TEST_SPREADSHEET_ID_HERE",
    "range": { "a1": "Sheet1!A1" },
    "note": "Data validated on 2024-01-06"
  }
},
{
  "name": "🔗 Cells: Set Hyperlink",
  "tool": "sheets_cells",
  "action": "set_hyperlink",
  "arguments": {
    "action": "set_hyperlink",
    "spreadsheetId": "YOUR_TEST_SPREADSHEET_ID_HERE",
    "range": { "a1": "Sheet1!A1" },
    "url": "https://example.com",
    "text": "Click here"
  }
}
```

#### sheets_dimensions (21 actions → Add 4 samples)
```json
{
  "name": "➕ Dimensions: Insert 5 Rows",
  "tool": "sheets_dimensions",
  "action": "insert_rows",
  "arguments": {
    "action": "insert_rows",
    "spreadsheetId": "YOUR_TEST_SPREADSHEET_ID_HERE",
    "sheetId": 0,
    "startIndex": 5,
    "count": 5
  }
},
{
  "name": "❌ Dimensions: Delete Rows (DRY RUN)",
  "tool": "sheets_dimensions",
  "action": "delete_rows",
  "arguments": {
    "action": "delete_rows",
    "spreadsheetId": "YOUR_TEST_SPREADSHEET_ID_HERE",
    "sheetId": 0,
    "startIndex": 10,
    "count": 2,
    "safety": { "dryRun": true, "createSnapshot": true }
  }
},
{
  "name": "❄️ Dimensions: Freeze Top Row",
  "tool": "sheets_dimensions",
  "action": "freeze_rows",
  "arguments": {
    "action": "freeze_rows",
    "spreadsheetId": "YOUR_TEST_SPREADSHEET_ID_HERE",
    "sheetId": 0,
    "count": 1
  }
},
{
  "name": "📏 Dimensions: Auto-Resize Columns",
  "tool": "sheets_dimensions",
  "action": "auto_resize",
  "arguments": {
    "action": "auto_resize",
    "spreadsheetId": "YOUR_TEST_SPREADSHEET_ID_HERE",
    "sheetId": 0,
    "dimension": "COLUMNS",
    "startIndex": 0,
    "endIndex": 10
  }
}
```

#### sheets_rules (8 actions → Add 2 samples)
```json
{
  "name": "🎨 Rules: Conditional Format (Color Scale)",
  "tool": "sheets_rules",
  "action": "add_conditional_format",
  "arguments": {
    "action": "add_conditional_format",
    "spreadsheetId": "YOUR_TEST_SPREADSHEET_ID_HERE",
    "range": { "a1": "Sheet1!B2:B100" },
    "type": "COLOR_SCALE",
    "minColor": { "red": 1.0, "green": 0.0, "blue": 0.0 },
    "maxColor": { "red": 0.0, "green": 1.0, "blue": 0.0 }
  }
},
{
  "name": "✅ Rules: Add Dropdown Validation",
  "tool": "sheets_rules",
  "action": "add_validation",
  "arguments": {
    "action": "add_validation",
    "spreadsheetId": "YOUR_TEST_SPREADSHEET_ID_HERE",
    "range": { "a1": "Sheet1!C2:C100" },
    "type": "LIST",
    "values": ["High", "Medium", "Low"]
  }
}
```

#### sheets_charts (9 actions → Add 2 samples)
```json
{
  "name": "📈 Charts: Create Line Chart",
  "tool": "sheets_charts",
  "action": "create",
  "arguments": {
    "action": "create",
    "spreadsheetId": "YOUR_TEST_SPREADSHEET_ID_HERE",
    "sheetId": 0,
    "type": "LINE",
    "range": { "a1": "Sheet1!A1:B10" },
    "title": "Sales Trend Over Time"
  }
},
{
  "name": "🥧 Charts: Create Pie Chart",
  "tool": "sheets_charts",
  "action": "create",
  "arguments": {
    "action": "create",
    "spreadsheetId": "YOUR_TEST_SPREADSHEET_ID_HERE",
    "sheetId": 0,
    "type": "PIE",
    "range": { "a1": "Sheet1!A1:B6" },
    "title": "Market Share by Category"
  }
}
```

#### sheets_filter_sort (14 actions → Add 2 samples)
```json
{
  "name": "🔍 Filter: Create Basic Filter",
  "tool": "sheets_filter_sort",
  "action": "set_filter",
  "arguments": {
    "action": "set_filter",
    "spreadsheetId": "YOUR_TEST_SPREADSHEET_ID_HERE",
    "range": { "a1": "Sheet1!A1:D100" },
    "column": "Status",
    "condition": "EQUALS",
    "value": "Active"
  }
},
{
  "name": "⬇️ Sort: Sort by Date Descending",
  "tool": "sheets_filter_sort",
  "action": "sort_range",
  "arguments": {
    "action": "sort_range",
    "spreadsheetId": "YOUR_TEST_SPREADSHEET_ID_HERE",
    "range": { "a1": "Sheet1!A2:D100" },
    "sortColumn": "Date",
    "order": "DESC"
  }
}
```

#### sheets_comments (10 actions → Add 2 samples)
```json
{
  "name": "💬 Comments: Add Comment",
  "tool": "sheets_comments",
  "action": "add",
  "arguments": {
    "action": "add",
    "spreadsheetId": "YOUR_TEST_SPREADSHEET_ID_HERE",
    "range": { "a1": "Sheet1!A1" },
    "text": "Please review this data"
  }
},
{
  "name": "✔️ Comments: Resolve Thread",
  "tool": "sheets_comments",
  "action": "resolve",
  "arguments": {
    "action": "resolve",
    "spreadsheetId": "YOUR_TEST_SPREADSHEET_ID_HERE",
    "commentId": "COMMENT_ID_FROM_ADD"
  }
}
```

### Phase 2: Expand Existing Tools (15 samples)

#### sheets_spreadsheet (Add 3 more)
- Create new spreadsheet
- Copy spreadsheet
- List user's spreadsheets

#### sheets_sheet (Add 3 more)
- Add new sheet
- Delete sheet
- Duplicate sheet

#### sheets_values (Add 3 more)
- Append rows
- Batch read multiple ranges
- Find and replace

#### sheets_format (Add 2 more)
- Set font (bold, size)
- Apply borders
- Number formatting (currency, date)

#### sheets_analysis (Add 2 more)
- Statistics summary
- Column analysis

#### sheets_versions (Add 2 more)
- Create snapshot
- List revisions
- Restore from snapshot

### Phase 3: Real-World Workflows (8 samples)

#### Complete Transaction Example
```json
{
  "name": "🔄 Workflow: Import CSV Data",
  "description": "Complete workflow: Create sheet → Import → Format → Validate",
  "steps": [
    "sheets_sheet: add new sheet 'Imports'",
    "sheets_values: write CSV data",
    "sheets_format: format headers",
    "sheets_dimensions: auto-resize columns",
    "sheets_analysis: data quality check"
  ]
}
```

#### Dashboard Creation
```json
{
  "name": "📊 Workflow: Build Dashboard",
  "description": "Create charts, apply formatting, share with team",
  "steps": [
    "sheets_values: read data",
    "sheets_charts: create line chart",
    "sheets_charts: create pie chart",
    "sheets_format: apply theme",
    "sheets_sharing: share with team"
  ]
}
```

---

## Implementation Priority

### Week 1: Critical Missing Tools (15 samples)
Focus on tools with 0% coverage that are commonly used:
- ✅ sheets_cells
- ✅ sheets_dimensions  
- ✅ sheets_rules
- ✅ sheets_charts
- ✅ sheets_filter_sort
- ✅ sheets_comments

### Week 2: Expand Core Tools (15 samples)
Add more actions to partially-covered tools:
- sheets_spreadsheet
- sheets_sheet
- sheets_values
- sheets_format
- sheets_analysis
- sheets_versions

### Week 3: Advanced Features (8 samples)
- sheets_pivot
- sheets_sharing
- sheets_advanced
- Real-world workflow examples

---

## Expected Benefits

### For Users
- **Better Discovery:** See what's possible with each tool
- **Faster Onboarding:** Copy-paste examples that work
- **Reduced Errors:** Learn correct parameter formats
- **Real Workflows:** End-to-end examples

### For Development
- **Better Testing:** Comprehensive test coverage
- **API Validation:** Catch schema issues early
- **Documentation:** Living examples of all features
- **Quality:** Find edge cases and bugs

### Metrics
- **Before:** 22 samples, 31% coverage
- **After:** 60 samples, 86% coverage
- **Impact:** 3x increase in discoverable actions

---

## Next Steps

1. **Review & Approve:** Confirm priority and scope
2. **Generate Samples:** Create JSON for all 38 new requests
3. **Test in Inspector:** Validate each sample works
4. **Document:** Update INSPECTOR_SETUP.md with new capabilities
5. **Share:** Publish enhanced inspector.json for community

**Estimated Time:** 3-4 hours for full implementation
**Priority:** High - Directly improves user experience and tool discovery
