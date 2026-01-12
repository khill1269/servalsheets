# ServalSheets Live API Test Executor
# Run this by telling Claude: "Execute the comprehensive test suite using the connected MCP tools"

This file defines the test plan. Claude should execute each test using the connected servalsheets MCP tools.

## Test Plan

### Phase 1: Authentication
- [x] sheets_auth:status
- [ ] sheets_auth:login (if needed)

### Phase 2: Setup - Create Test Spreadsheet
- [ ] sheets_spreadsheet:create - Create test spreadsheet with initial sheet

### Phase 3: Core Operations

#### sheets_spreadsheet (8 actions)
- [ ] list
- [ ] get
- [ ] get_url
- [ ] get_comprehensive  
- [ ] update_properties
- [ ] copy
- [ ] batch_get

#### sheets_sheet (7 actions)
- [ ] list
- [ ] add
- [ ] get
- [ ] update
- [ ] duplicate
- [ ] copy_to (to same spreadsheet)
- [ ] delete

#### sheets_values (9 actions)
- [ ] batch_write (write test data)
- [ ] batch_read
- [ ] read
- [ ] write  
- [ ] append
- [ ] find
- [ ] replace
- [ ] clear
- [ ] batch_clear

#### sheets_cells (12 actions)
- [ ] add_note
- [ ] get_note
- [ ] clear_note
- [ ] set_hyperlink
- [ ] clear_hyperlink
- [ ] merge
- [ ] get_merges
- [ ] unmerge
- [ ] set_validation
- [ ] clear_validation
- [ ] copy
- [ ] cut

#### sheets_format (9 actions)
- [ ] set_background
- [ ] set_text_format
- [ ] set_number_format
- [ ] set_alignment
- [ ] set_borders
- [ ] set_format
- [ ] apply_preset
- [ ] auto_fit
- [ ] clear_format

#### sheets_dimensions (21 actions)
- [ ] insert_rows
- [ ] insert_columns
- [ ] resize_rows
- [ ] resize_columns
- [ ] auto_resize
- [ ] freeze_rows
- [ ] freeze_columns
- [ ] hide_rows
- [ ] show_rows
- [ ] hide_columns
- [ ] show_columns
- [ ] group_rows
- [ ] ungroup_rows
- [ ] group_columns
- [ ] ungroup_columns
- [ ] move_rows
- [ ] move_columns
- [ ] append_rows
- [ ] append_columns
- [ ] delete_rows
- [ ] delete_columns

#### sheets_rules (8 actions)
- [ ] list_conditional_formats
- [ ] add_conditional_format
- [ ] update_conditional_format
- [ ] delete_conditional_format
- [ ] list_data_validations
- [ ] add_data_validation
- [ ] clear_data_validation
- [ ] add_preset_rule

#### sheets_charts (9 actions)
- [ ] list
- [ ] create
- [ ] get
- [ ] update
- [ ] move
- [ ] resize
- [ ] update_data_range
- [ ] export
- [ ] delete

#### sheets_pivot (6 actions)
- [ ] list
- [ ] create
- [ ] get
- [ ] update
- [ ] refresh
- [ ] delete

#### sheets_filter_sort (14 actions)
- [ ] set_basic_filter
- [ ] get_basic_filter
- [ ] update_filter_criteria
- [ ] clear_basic_filter
- [ ] sort_range
- [ ] create_filter_view
- [ ] get_filter_view
- [ ] update_filter_view
- [ ] delete_filter_view
- [ ] list_filter_views
- [ ] create_slicer
- [ ] update_slicer
- [ ] delete_slicer
- [ ] list_slicers

#### sheets_sharing (8 actions)
- [ ] list_permissions
- [ ] get_sharing_link
- [ ] share
- [ ] get_permission
- [ ] update_permission
- [ ] remove_permission
- [ ] set_link_sharing
- [ ] transfer_ownership (skip - requires another user)

#### sheets_comments (10 actions)
- [ ] list
- [ ] add
- [ ] get
- [ ] update
- [ ] resolve
- [ ] reopen
- [ ] add_reply
- [ ] update_reply
- [ ] delete_reply
- [ ] delete

#### sheets_versions (10 actions)
- [ ] list_revisions
- [ ] get_revision
- [ ] keep_revision
- [ ] create_snapshot
- [ ] list_snapshots
- [ ] compare
- [ ] export_version
- [ ] restore_snapshot
- [ ] delete_snapshot
- [ ] restore_revision

#### sheets_analysis (13 actions)
- [ ] statistics
- [ ] data_quality
- [ ] formula_audit
- [ ] structure_analysis
- [ ] column_analysis
- [ ] detect_patterns
- [ ] correlations
- [ ] summary
- [ ] dependencies
- [ ] compare_ranges
- [ ] suggest_templates
- [ ] generate_formula
- [ ] suggest_chart

#### sheets_advanced (19 actions)
- [ ] list_named_ranges
- [ ] add_named_range
- [ ] get_named_range
- [ ] update_named_range
- [ ] delete_named_range
- [ ] list_protected_ranges
- [ ] add_protected_range
- [ ] update_protected_range
- [ ] delete_protected_range
- [ ] set_metadata
- [ ] get_metadata
- [ ] delete_metadata
- [ ] list_banding
- [ ] add_banding
- [ ] update_banding
- [ ] delete_banding
- [ ] list_tables
- [ ] create_table
- [ ] delete_table

#### sheets_transaction (6 actions)
- [ ] begin
- [ ] status
- [ ] queue
- [ ] list
- [ ] commit
- [ ] rollback

#### sheets_validation (1 action)
- [ ] validate

#### sheets_conflict (2 actions)
- [ ] detect
- [ ] resolve

#### sheets_impact (1 action)
- [ ] analyze

#### sheets_history (7 actions)
- [ ] list
- [ ] get
- [ ] stats
- [ ] undo
- [ ] redo
- [ ] revert_to
- [ ] clear

#### sheets_confirm (2 actions)
- [ ] get_stats
- [ ] request (skip - requires elicitation)

#### sheets_analyze (4 actions)
- [ ] get_stats
- [ ] analyze (skip - requires sampling)
- [ ] generate_formula (skip - requires sampling)
- [ ] suggest_chart (skip - requires sampling)

#### sheets_fix (1 action)
- [ ] fix (preview mode)

#### sheets_composite (4 actions)
- [ ] import_csv
- [ ] smart_append
- [ ] bulk_update
- [ ] deduplicate

#### sheets_session (13 actions)
- [ ] set_active
- [ ] get_active
- [ ] get_context
- [ ] get_preferences
- [ ] update_preferences
- [ ] record_operation
- [ ] get_last_operation
- [ ] get_history
- [ ] find_by_reference
- [ ] set_pending
- [ ] get_pending
- [ ] clear_pending
- [ ] reset

## Total: 26 tools, 208 actions
