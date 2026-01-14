# ServalSheets Tool Reorganization Plan

## Executive Summary

**Current State:** 26 tools, ~215 actions
**Target State:** 11 "Super Tools", ~180 actions (consolidated)
**Goal:** Maximize LLM efficiency through reduced cognitive load, clearer intent mapping, and consolidated functionality

---

## Current Architecture Analysis

### Tool Inventory (26 tools)

| # | Tool | Actions | Category | Issues |
|---|------|---------|----------|--------|
| 1 | sheets_auth | 4 | Core | ✅ Good |
| 2 | sheets_spreadsheet | 8 | Core | ✅ Good |
| 3 | sheets_sheet | 7 | Core | ✅ Good |
| 4 | sheets_values | 9 | Core | ✅ Good |
| 5 | sheets_cells | 12 | Core | ⚠️ Overlaps with values |
| 6 | sheets_format | 9 | Core | ✅ Good |
| 7 | sheets_dimensions | 21 | Core | ✅ Good but large |
| 8 | sheets_rules | 8 | Core | ⚠️ Should merge with format |
| 9 | sheets_charts | 9 | Viz | ✅ Good |
| 10 | sheets_pivot | 6 | Viz | ⚠️ Could merge with charts |
| 11 | sheets_filter_sort | 14 | Viz | ✅ Good |
| 12 | sheets_sharing | 8 | Collab | ✅ Good |
| 13 | sheets_comments | 10 | Collab | ⚠️ Could merge with sharing |
| 14 | sheets_versions | 10 | Collab | ⚠️ Overlaps with history |
| 15 | sheets_advanced | 19 | Core | ⚠️ Miscellaneous catch-all |
| 16 | sheets_analysis | 13 | Analysis | ❌ DEPRECATED, confusing name |
| 17 | sheets_analyze | 10 | Analysis | ⚠️ Confusing vs sheets_analysis |
| 18 | sheets_fix | 1 | Analysis | ⚠️ Single action tool |
| 19 | sheets_transaction | 6 | Safety | ✅ Critical |
| 20 | sheets_validation | 1 | Safety | ⚠️ Single action tool |
| 21 | sheets_conflict | 2 | Safety | ⚠️ Low action count |
| 22 | sheets_impact | 1 | Safety | ⚠️ Single action tool |
| 23 | sheets_history | 7 | Safety | ⚠️ Overlaps with versions |
| 24 | sheets_confirm | 2 | MCP | ✅ Good |
| 25 | sheets_session | 13 | MCP | ⚠️ Too many actions |
| 26 | sheets_composite | 4 | High-Level | ✅ Good concept |

### Key Problems

1. **Too Many Tools (26)** - LLMs struggle with >12 tool choices
2. **Naming Confusion** - sheets_analysis vs sheets_analyze
3. **Single-Action Tools** - validation (1), impact (1), conflict (2), fix (1)
4. **Overlapping Tools** - cells/values, versions/history, rules/format
5. **Inconsistent Granularity** - dimensions (21) vs validation (1)
6. **Deprecated Code** - sheets_analysis still present

---

## Proposed Architecture: 11 Super Tools

### Design Principles

1. **Intent-Based Grouping** - Tools match user mental models
2. **10-15 Actions Per Tool** - Optimal for LLM reasoning
3. **Clear Naming** - No ambiguous names
4. **Transaction-First** - Safety built into every write operation
5. **Progressive Disclosure** - Common actions first, advanced second

### New Tool Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SERVALSHEETS 2.0 - 11 SUPER TOOLS               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  TIER 1: FOUNDATION (3 tools)                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ sheets_auth  │  │ sheets_data  │  │ sheets_style │              │
│  │ (4 actions)  │  │ (28 actions) │  │ (18 actions) │              │
│  │              │  │              │  │              │              │
│  │ OAuth flow   │  │ CRUD + find  │  │ Format+rules │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  TIER 2: STRUCTURE (2 tools)                                        │
│  ┌──────────────┐  ┌──────────────┐                                 │
│  │ sheets_      │  │ sheets_      │                                 │
│  │ structure    │  │ visualize    │                                 │
│  │ (25 actions) │  │ (20 actions) │                                 │
│  │              │  │              │                                 │
│  │ Sheets/dims/ │  │ Charts/pivot │                                 │
│  │ named/protect│  │ filter/sort  │                                 │
│  └──────────────┘  └──────────────┘                                 │
│                                                                      │
│  TIER 3: INTELLIGENCE (2 tools)                                     │
│  ┌──────────────┐  ┌──────────────┐                                 │
│  │ sheets_      │  │ sheets_      │                                 │
│  │ analyze      │  │ automate     │                                 │
│  │ (15 actions) │  │ (12 actions) │                                 │
│  │              │  │              │                                 │
│  │ AI analysis  │  │ Fix/import/  │                                 │
│  │ +suggestions │  │ bulk/dedupe  │                                 │
│  └──────────────┘  └──────────────┘                                 │
│                                                                      │
│  TIER 4: COLLABORATION (2 tools)                                    │
│  ┌──────────────┐  ┌──────────────┐                                 │
│  │ sheets_      │  │ sheets_      │                                 │
│  │ share        │  │ history      │                                 │
│  │ (16 actions) │  │ (12 actions) │                                 │
│  │              │  │              │                                 │
│  │ Perms+comments│ │ Versions/ops │                                 │
│  └──────────────┘  └──────────────┘                                 │
│                                                                      │
│  TIER 5: SAFETY & CONTEXT (2 tools)                                 │
│  ┌──────────────┐  ┌──────────────┐                                 │
│  │ sheets_      │  │ sheets_      │                                 │
│  │ safety       │  │ context      │                                 │
│  │ (12 actions) │  │ (8 actions)  │                                 │
│  │              │  │              │                                 │
│  │ Tx/validate/ │  │ Session/NL   │                                 │
│  │ conflict/    │  │ confirm/plan │                                 │
│  │ impact       │  │              │                                 │
│  └──────────────┘  └──────────────┘                                 │
│                                                                      │
│  TOTAL: 11 tools, ~170 actions                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Tool Specifications

### 1. sheets_auth (Keep as-is)
**Actions:** 4 | **Category:** Foundation

No changes needed. Clear, focused, essential.

```
status    - Check authentication state
login     - Initiate OAuth flow  
callback  - Complete OAuth with code
logout    - Clear credentials
```

---

### 2. sheets_data (NEW - Consolidates values + cells)
**Actions:** 28 | **Category:** Foundation

Merges: `sheets_spreadsheet` + `sheets_values` + `sheets_cells`

**Rationale:** All data CRUD operations in one place. User thinks "I want to work with data" - one tool.

```
# Spreadsheet Level (from sheets_spreadsheet)
create              - Create new spreadsheet
get                 - Get spreadsheet metadata
get_url             - Get shareable URL
copy                - Copy spreadsheet
update_properties   - Update title, locale, etc.
batch_get           - Get multiple spreadsheets
list                - List accessible spreadsheets

# Cell Values (from sheets_values)
read                - Read range values
write               - Write range values (with safety options)
append              - Append rows to range
clear               - Clear range values
batch_read          - Read multiple ranges
batch_write         - Write multiple ranges
find                - Find values in range
replace             - Find and replace

# Cell Operations (from sheets_cells)
add_note            - Add cell note
get_note            - Get cell note
clear_note          - Remove cell note
set_hyperlink       - Add hyperlink
clear_hyperlink     - Remove hyperlink
merge               - Merge cells
unmerge             - Unmerge cells
get_merges          - List merged regions
cut                 - Cut cells
copy_cells          - Copy cells
paste               - Paste cells
get_properties      - Get cell properties
```

**Key Improvement:** Safety options built into every write action:
```json
{
  "action": "write",
  "range": "A1:B10",
  "values": [...],
  "safety": {
    "dryRun": true,
    "createSnapshot": true,
    "requireConfirmation": true  // triggers sheets_context confirm
  }
}
```

---

### 3. sheets_style (NEW - Consolidates format + rules)
**Actions:** 18 | **Category:** Foundation

Merges: `sheets_format` + `sheets_rules`

**Rationale:** "Make it look good" = one tool. Formatting and rules are both about appearance.

```
# Formatting (from sheets_format)
set_format          - Apply comprehensive format
set_background      - Set background color
set_text_format     - Set font, size, color, bold, etc.
set_number_format   - Set number/date/currency format
set_alignment       - Set text alignment
set_borders         - Set cell borders
clear_format        - Clear all formatting
apply_preset        - Apply named preset (header, currency, etc.)
auto_fit            - Auto-resize to content

# Rules (from sheets_rules)
add_conditional     - Add conditional formatting rule
update_conditional  - Update conditional rule
delete_conditional  - Delete conditional rule
list_conditionals   - List all conditional rules
add_validation      - Add data validation (dropdown, etc.)
clear_validation    - Clear data validation
list_validations    - List all validation rules
add_preset_rule     - Apply preset rule (duplicate highlight, etc.)
add_alternating     - Apply alternating colors (banding)
```

---

### 4. sheets_structure (NEW - Consolidates sheet + dimensions + advanced)
**Actions:** 25 | **Category:** Structure

Merges: `sheets_sheet` + `sheets_dimensions` + parts of `sheets_advanced`

**Rationale:** "Organize my spreadsheet" = one tool. Sheets, rows, columns, named ranges, protection.

```
# Sheet Management (from sheets_sheet)
add_sheet           - Add new sheet/tab
delete_sheet        - Delete sheet
duplicate_sheet     - Duplicate sheet
rename_sheet        - Rename sheet
hide_sheet          - Hide sheet
show_sheet          - Show hidden sheet
move_sheet          - Reorder sheets
list_sheets         - List all sheets
copy_to             - Copy sheet to another spreadsheet

# Dimensions (from sheets_dimensions - consolidated)
insert_rows         - Insert rows
insert_columns      - Insert columns
delete_rows         - Delete rows (DESTRUCTIVE)
delete_columns      - Delete columns (DESTRUCTIVE)
resize              - Resize rows or columns
auto_resize         - Auto-fit to content
freeze              - Freeze rows/columns
unfreeze            - Unfreeze
group               - Group rows/columns
ungroup             - Ungroup
hide_dimension      - Hide rows/columns
show_dimension      - Show hidden rows/columns

# Organization (from sheets_advanced)
add_named_range     - Create named range
delete_named_range  - Delete named range
list_named_ranges   - List all named ranges
add_protection      - Protect range/sheet
remove_protection   - Remove protection
list_protections    - List protected ranges
```

---

### 5. sheets_visualize (NEW - Consolidates charts + pivot + filter_sort)
**Actions:** 20 | **Category:** Structure

Merges: `sheets_charts` + `sheets_pivot` + `sheets_filter_sort`

**Rationale:** "Help me see my data" = one tool. Charts, pivots, filters are all visualization.

```
# Charts (from sheets_charts)
create_chart        - Create chart
update_chart        - Update chart properties
delete_chart        - Delete chart
list_charts         - List all charts
move_chart          - Move/resize chart
export_chart        - Export chart as image

# Pivot Tables (from sheets_pivot)
create_pivot        - Create pivot table
update_pivot        - Update pivot configuration
delete_pivot        - Delete pivot table
refresh_pivot       - Refresh pivot data
list_pivots         - List all pivot tables

# Filtering & Sorting (from sheets_filter_sort)
set_filter          - Set basic filter
clear_filter        - Clear basic filter
update_filter       - Update filter criteria
sort_range          - Sort range
create_filter_view  - Create filter view
update_filter_view  - Update filter view
delete_filter_view  - Delete filter view
list_filter_views   - List filter views
create_slicer       - Create slicer
update_slicer       - Update slicer
```

---

### 6. sheets_analyze (ENHANCED - Consolidates analysis + AI)
**Actions:** 15 | **Category:** Intelligence

Merges: `sheets_analyze` + `sheets_analysis` (deprecated)

**Rationale:** Remove the confusing dual-tool situation. One comprehensive analysis tool.

```
# Comprehensive (PRIMARY - use this first)
comprehensive       - Get EVERYTHING: metadata + data + quality + patterns + formulas

# Traditional Analysis (fast, deterministic)
data_quality        - Check data quality issues
formula_audit       - Audit all formulas
statistics          - Compute statistics
detect_patterns     - Find patterns, anomalies
column_analysis     - Analyze column types/values

# AI-Powered Analysis (uses Sampling)
generate_formula    - NL → Google Sheets formula
suggest_chart       - Recommend visualizations
explain_data        - Explain what's in the data
query_natural       - Answer questions about data
suggest_template    - Recommend templates based on data

# Actions (apply analysis results)
apply_recommendation - Apply a specific recommendation
```

---

### 7. sheets_automate (NEW - Consolidates fix + composite)
**Actions:** 12 | **Category:** Intelligence

Merges: `sheets_fix` + `sheets_composite`

**Rationale:** "Do this automatically" = one tool. Fixes, imports, bulk operations.

```
# Automated Fixing (from sheets_fix)
preview_fixes       - Preview what would be fixed
apply_fixes         - Apply fixes to issues
fix_formulas        - Fix broken formulas specifically
fix_formatting      - Fix formatting issues specifically

# Bulk Operations (from sheets_composite)
import_csv          - Import CSV data
import_json         - Import JSON data
smart_append        - Append with header matching
bulk_update         - Update rows by key column
deduplicate         - Remove duplicate rows
bulk_format         - Apply formatting to multiple ranges
bulk_validate       - Validate multiple ranges
migrate_data        - Move data between sheets/spreadsheets
```

---

### 8. sheets_share (ENHANCED - Consolidates sharing + comments)
**Actions:** 16 | **Category:** Collaboration

Merges: `sheets_sharing` + `sheets_comments`

**Rationale:** "Share with my team" = one tool. Permissions and comments are both collaboration.

```
# Permissions (from sheets_sharing)
share               - Share with user/group
update_permission   - Update permission level
remove_permission   - Remove access
list_permissions    - List all permissions
get_permission      - Get specific permission
transfer_ownership  - Transfer ownership
set_link_sharing    - Set link sharing options
get_share_link      - Get shareable link

# Comments (from sheets_comments)
add_comment         - Add comment to cell
update_comment      - Edit comment
delete_comment      - Delete comment
list_comments       - List all comments
get_comment         - Get specific comment
resolve_comment     - Mark resolved
reopen_comment      - Reopen resolved comment
add_reply           - Reply to comment
```

---

### 9. sheets_history (ENHANCED - Consolidates versions + history)
**Actions:** 12 | **Category:** Collaboration

Merges: `sheets_versions` + `sheets_history`

**Rationale:** "What happened?" = one tool. Versions and operation history are both about the past.

```
# Version Control (from sheets_versions)
list_revisions      - List revision history
get_revision        - Get specific revision
restore_revision    - Restore to revision
create_snapshot     - Create named snapshot
list_snapshots      - List snapshots
restore_snapshot    - Restore snapshot
compare_versions    - Compare two versions

# Operation History (from sheets_history)
list_operations     - List recent operations
get_operation       - Get operation details
undo                - Undo last operation
redo                - Redo undone operation
revert_to           - Revert to specific operation
```

---

### 10. sheets_safety (NEW - Consolidates transaction + validation + conflict + impact)
**Actions:** 12 | **Category:** Safety

Merges: `sheets_transaction` + `sheets_validation` + `sheets_conflict` + `sheets_impact`

**Rationale:** "Make sure this is safe" = one tool. All pre-flight and atomicity concerns.

```
# Transactions (from sheets_transaction)
begin               - Begin transaction
queue               - Queue operation
commit              - Commit all queued operations
rollback            - Rollback transaction
status              - Check transaction status

# Pre-flight Checks (from validation + conflict + impact)
validate            - Validate data before write
check_conflicts     - Check for concurrent modifications
analyze_impact      - Analyze impact of changes
preview             - Preview operation results (dry-run)
estimate_quota      - Estimate API quota usage
verify_range        - Verify range exists and is valid
```

---

### 11. sheets_context (NEW - Consolidates session + confirm)
**Actions:** 8 | **Category:** Safety

Merges: `sheets_session` + `sheets_confirm`

**Rationale:** "Remember this" and "Ask me first" = one tool. Both about conversation context.

```
# Session Context (from sheets_session - simplified)
set_active          - Set active spreadsheet
get_context         - Get full conversation context
find_reference      - Resolve "that", "the budget", etc.
update_preferences  - Update user preferences

# User Confirmation (from sheets_confirm)
request_confirm     - Request user confirmation
get_confirmation    - Get confirmation result
cancel_pending      - Cancel pending confirmation
get_stats           - Get confirmation statistics
```

---

## Migration Plan

### Phase 1: Deprecation Warnings (Week 1-2)
- Add deprecation notices to old tool descriptions
- Log warnings when deprecated tools are used
- Update documentation

### Phase 2: Parallel Running (Week 3-4)
- Deploy new tools alongside old
- Route old tool calls to new implementations
- Collect usage metrics

### Phase 3: Client Updates (Week 5-6)
- Update SKILL.md with new tool patterns
- Update examples and templates
- Notify users of changes

### Phase 4: Remove Old Tools (Week 7-8)
- Remove deprecated tool definitions
- Clean up old schemas
- Final testing

---

## Action Count Comparison

| Category | Current | Proposed | Delta |
|----------|---------|----------|-------|
| Foundation | 32 | 50 | +18 (consolidated) |
| Structure | 47 | 45 | -2 |
| Intelligence | 24 | 27 | +3 |
| Collaboration | 28 | 28 | 0 |
| Safety | 17 | 20 | +3 |
| **TOTAL** | **215** | **170** | **-45** |

Note: Action count decreased because we removed redundant actions and consolidated similar ones.

---

## LLM Efficiency Benefits

### 1. Reduced Cognitive Load
- **Before:** 26 tools to consider
- **After:** 11 tools to consider
- **Improvement:** 58% fewer decisions

### 2. Clearer Intent Mapping
```
User Intent                    → Tool
"Read my data"                 → sheets_data
"Make it look nice"            → sheets_style
"Help me understand this"      → sheets_analyze
"Share with team"              → sheets_share
"Is this safe?"                → sheets_safety
```

### 3. Fewer Tool Switches
- **Before:** Format header = sheets_format → sheets_rules → sheets_dimensions
- **After:** Format header = sheets_style (one tool)

### 4. Built-in Safety
- Every write operation in sheets_data has safety options
- No need to remember to call sheets_transaction separately
- Confirmation built into sheets_context

### 5. Consistent Action Naming
All tools use consistent verb patterns:
- `create_*`, `update_*`, `delete_*`, `list_*`, `get_*`
- No more: `add_*` vs `set_*` vs `create_*` confusion

---

## Implementation Priority

1. **High Priority (Do First)**
   - sheets_data (most used)
   - sheets_style (common workflows)
   - sheets_analyze (remove confusion)

2. **Medium Priority**
   - sheets_structure
   - sheets_visualize
   - sheets_safety

3. **Lower Priority**
   - sheets_share
   - sheets_history
   - sheets_automate
   - sheets_context

---

## Open Questions

1. Should we keep backwards compatibility with old tool names via aliases?
2. Should sheets_auth be merged into sheets_context?
3. Should we add "meta" actions like `sheets_data.help` to each tool?
4. What's the timeline for deprecating sheets_analysis?

---

*Document created: 2025-01-13*
*Target completion: Q1 2025*
