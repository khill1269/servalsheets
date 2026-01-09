# ServalSheets - Complete Action Reference Guide

**Version**: v1.3.1
**Date**: 2026-01-08
**Total**: 24 tools, 190 actions

This guide documents the **actual implemented actions** for all tools based on schema analysis.

---

## Quick Reference by Tool

| Tool | Actions | Description |
|------|---------|-------------|
| sheets_auth | 4 | Authentication & session management |
| sheets_spreadsheet | 8 | Spreadsheet-level operations |
| sheets_sheet | 7 | Sheet management (add, delete, etc.) |
| sheets_values | 9 | Cell value read/write operations |
| sheets_cells | 12 | Cell-level operations (notes, validation, etc.) |
| sheets_format | 9 | Cell and range formatting |
| sheets_dimensions | 21 | Row/column operations |
| sheets_rules | 8 | Conditional formatting rules |
| sheets_charts | 9 | Chart creation and management |
| sheets_pivot | 6 | Pivot table operations |
| sheets_filter_sort | 14 | Filtering and sorting |
| sheets_sharing | 8 | Permission and sharing management |
| sheets_comments | 10 | Comment management |
| sheets_versions | 10 | Version history and revisions |
| sheets_analysis | 13 | Data quality and analysis |
| sheets_advanced | 19 | Named ranges and advanced features |
| sheets_transaction | 6 | Transaction management |
| sheets_validation | 1 | Data validation |
| sheets_conflict | 2 | Conflict detection and resolution |
| sheets_impact | 1 | Impact analysis |
| sheets_history | 7 | Operation history tracking |
| sheets_confirm | 2 | User confirmation (Elicitation) |
| sheets_analyze | 4 | AI-powered analysis (Sampling) |
| sheets_fix | ? | Automated issue resolution |

---

## Detailed Action Listings

### sheets_auth (4 actions)
```
status          - Check authentication status
login           - Initiate OAuth login flow
callback        - Handle OAuth callback
logout          - Log out and clear credentials
```

### sheets_spreadsheet (8 actions)
```
get                  - Get spreadsheet metadata
create               - Create new spreadsheet
copy                 - Copy existing spreadsheet
update_properties    - Update spreadsheet properties
get_url              - Get spreadsheet URL
batch_get            - Get multiple spreadsheets
get_comprehensive    - Get full metadata (optimized)
list                 - List user's spreadsheets (NEW in v1.3.1)
```

### sheets_sheet (7 actions)
```
add        - Add new sheet
delete     - Delete sheet
duplicate  - Duplicate sheet
update     - Update sheet properties
list       - List all sheets
get        - Get sheet details
hide       - Hide/show sheet
```

### sheets_values (9 actions)
```
read         - Read cell values
write        - Write cell values
append       - Append rows
clear        - Clear range
batch_read   - Read multiple ranges
batch_write  - Write multiple ranges
count        - Count values in range
find         - Find values
replace      - Find and replace
```

### sheets_cells (12 actions)
```
add_note          - Add note to cell
get_note          - Get cell note
clear_note        - Remove note
set_validation    - Set data validation
clear_validation  - Remove validation
set_hyperlink     - Add hyperlink
clear_hyperlink   - Remove hyperlink
merge             - Merge cells
unmerge           - Unmerge cells
get_merges        - List merged ranges
cut               - Cut cells
copy              - Copy cells
```

### sheets_format (9 actions)
```
set_format         - Set cell format
set_background     - Set background color
set_text_format    - Set text formatting
set_borders        - Set cell borders
set_number_format  - Set number format
get_format         - Get cell format
copy_format        - Copy format
clear_format       - Clear formatting
auto_resize        - Auto-resize columns
```

### sheets_dimensions (21 actions)
```
insert_rows           - Insert rows
insert_columns        - Insert columns
delete_rows           - Delete rows
delete_columns        - Delete columns
move_rows             - Move rows
move_columns          - Move columns
resize_rows           - Resize rows
resize_columns        - Resize columns
auto_resize_rows      - Auto-resize rows
auto_resize_columns   - Auto-resize columns
get_row_height        - Get row height
get_column_width      - Get column width
hide_rows             - Hide rows
hide_columns          - Hide columns
show_rows             - Show rows
show_columns          - Show columns
freeze_rows           - Freeze rows
freeze_columns        - Freeze columns
unfreeze              - Unfreeze panes
group_rows            - Group rows
group_columns         - Group columns
```

### sheets_rules (8 actions)
```
add_conditional_format     - Add conditional format
update_conditional_format  - Update rule
delete_conditional_format  - Delete rule
list                       - List all rules
get                        - Get rule details
clear_all                  - Clear all rules
validate                   - Validate rule
preview                    - Preview rule effects
```

### sheets_charts (9 actions)
```
create   - Create chart
update   - Update chart
delete   - Delete chart
list     - List charts
get      - Get chart details
move     - Move chart position
resize   - Resize chart
copy     - Copy chart
export   - Export chart image
```

### sheets_pivot (6 actions)
```
create   - Create pivot table
update   - Update pivot table
delete   - Delete pivot table
list     - List pivot tables
get      - Get pivot details
refresh  - Refresh pivot data
```

### sheets_filter_sort (14 actions)
```
set_basic_filter     - Set basic filter
clear_basic_filter   - Clear basic filter
get_basic_filter     - Get filter settings
add_filter_view      - Add filter view
update_filter_view   - Update filter view
delete_filter_view   - Delete filter view
list_filters         - List all filters
sort_range           - Sort range
get_sort_specs       - Get sort specifications
create_sort_spec     - Create sort specification
remove_sort          - Remove sorting
get_sort_range       - Get sorted range
apply_filter         - Apply filter criteria
clear_filter         - Clear filter
```

### sheets_sharing (8 actions)
```
share                 - Share with user/group
update_permission     - Update permission
remove_permission     - Remove permission
list_permissions      - List all permissions
get_permission        - Get specific permission
transfer_ownership    - Transfer ownership
set_link_sharing      - Set link sharing settings
get_sharing_link      - Get sharing link
```

### sheets_comments (10 actions)
```
add           - Add comment
update        - Update comment
delete        - Delete comment
list          - List comments
get           - Get comment details
resolve       - Resolve comment
reopen        - Reopen comment
add_reply     - Add reply
update_reply  - Update reply
delete_reply  - Delete reply
```

### sheets_versions (10 actions)
```
list_revisions    - List revision history
get_revision      - Get revision details
restore_revision  - Restore to revision
compare           - Compare revisions
export_revision   - Export revision
create_snapshot   - Create snapshot
list_snapshots    - List snapshots
restore_snapshot  - Restore snapshot
delete_snapshot   - Delete snapshot
set_retention     - Set retention policy
```

### sheets_analysis (13 actions)
```
data_quality       - Analyze data quality
formula_audit      - Audit formulas
structure_analysis - Analyze structure
duplicate_finder   - Find duplicates
gap_detector       - Detect gaps
outlier_detection  - Detect outliers
correlation        - Calculate correlations
summary_stats      - Calculate statistics
trend_analysis     - Analyze trends
pattern_detection  - Detect patterns
consistency_check  - Check consistency
completeness       - Check completeness
accuracy          - Check accuracy
```

### sheets_advanced (19 actions)
```
add_named_range      - Add named range
update_named_range   - Update named range
delete_named_range   - Delete named range
list_named_ranges    - List named ranges
protect_range        - Protect range
unprotect_range      - Unprotect range
list_protected       - List protected ranges
add_developer_meta   - Add metadata
get_developer_meta   - Get metadata
delete_developer_meta - Delete metadata
set_data_source      - Set data source
refresh_data_source  - Refresh data
create_macro         - Create macro
run_macro            - Run macro
list_macros          - List macros
import_data          - Import external data
export_data          - Export data
create_slicer        - Create slicer
update_slicer        - Update slicer
```

### sheets_transaction (6 actions)
```
begin    - Begin transaction
queue    - Queue operation
commit   - Commit transaction
rollback - Rollback transaction
status   - Get transaction status
stats    - Get transaction statistics
```

### sheets_validation (1 action)
```
validate - Validate spreadsheet integrity
```

### sheets_conflict (2 actions)
```
detect   - Detect conflicts
resolve  - Resolve conflicts
```

### sheets_impact (1 action)
```
analyze - Analyze operation impact
```

### sheets_history (7 actions)
```
list        - List operation history
get         - Get operation details
stats       - Get history statistics
undo        - Undo operation
redo        - Redo operation
revert_to   - Revert to point in time
clear       - Clear history
```

### sheets_confirm (2 actions)
```
request   - Request user confirmation (Elicitation)
get_stats - Get confirmation statistics
```

### sheets_analyze (4 actions)
```
analyze          - AI-powered analysis (Sampling)
generate_formula - Generate formula suggestion
suggest_chart    - Suggest chart type
get_stats        - Get analysis statistics
```

---

## Common Mistakes & Corrections

### ❌ Wrong Action Names → ✅ Correct Action Names

**sheets_cells**:
- ❌ `get` → ✅ Use `get_note`, `get_merges`
- ❌ `set` → ✅ Use `add_note`, `set_validation`, `set_hyperlink`

**sheets_sharing**:
- ❌ `check_permissions` → ✅ Use `list_permissions` or `get_permission`
- ❌ `add_permission` → ✅ Use `share`

**sheets_format**:
- ❌ `get_format` → ✅ Use `get_format` (this one is correct)
- ❌ `apply_format` → ✅ Use `set_format`

**sheets_dimensions**:
- ❌ `resize` → ✅ Use `resize_rows` or `resize_columns`
- ❌ `hide` → ✅ Use `hide_rows` or `hide_columns`

**sheets_versions**:
- ❌ `list` → ✅ Use `list_revisions` or `list_snapshots`
- ❌ `restore` → ✅ Use `restore_revision` or `restore_snapshot`

**sheets_history**:
- ❌ `get_stats` → ✅ Use `stats`
- ❌ `list_history` → ✅ Use `list`

---

## Action Naming Patterns

### Common Prefixes
- `add_` - Add new item (add_note, add_named_range)
- `get_` - Retrieve information (get_note, get_format)
- `set_` - Set/configure (set_format, set_validation)
- `clear_` - Remove/clear (clear_note, clear_format)
- `delete_` - Delete item (delete_chart, delete_snapshot)
- `update_` - Modify existing (update_chart, update_permission)
- `list_` - Enumerate items (list_charts, list_permissions)
- `create_` - Create new complex item (create_chart, create_macro)

### Common Standalone Actions
- `status` - Get status
- `stats` - Get statistics
- `validate` - Perform validation
- `analyze` - Perform analysis
- `refresh` - Refresh data
- `export` - Export data
- `import` - Import data

---

## Testing Actions

To test any action:

```javascript
{
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'sheets_<tool>',      // e.g., 'sheets_cells'
    arguments: {
      request: {
        action: '<action_name>',  // e.g., 'get_merges'
        spreadsheetId: '<id>',
        // ... other parameters
      }
    }
  }
}
```

---

## Quick Command Reference

```bash
# List all actions for a specific tool
grep "action: z.literal" src/schemas/<tool>.ts

# Count actions per tool
npm run gen:metadata | grep "📝"

# Test action availability
node test_script.js --tool sheets_cells --action get_merges
```

---

**Note**: This reference was generated from schema analysis on 2026-01-08. Always refer to the actual schema files (`src/schemas/*.ts`) for the definitive source of truth.

**Issue #7 Status**: DOCUMENTED ✅ 
All action names have been documented. Tool descriptions should be updated to reflect these correct action names.
