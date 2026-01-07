/**
 * ServalSheets - Enhanced Tool Descriptions
 * 
 * LLM-Optimized descriptions that help AI agents:
 * 1. Know WHEN to use each tool
 * 2. See COMMON PATTERNS with examples
 * 3. Understand QUOTA implications
 * 4. Make better tool selection decisions
 * 
 * Format: Each description includes:
 * - Primary purpose (first line)
 * - **When to use:** decision guidance
 * - **Quick examples:** copy-paste ready
 * - **Performance:** quota/batching tips
 * - **Related:** complementary tools
 */

export const TOOL_DESCRIPTIONS: Record<string, string> = {

  //=============================================================================
  // AUTHENTICATION
  //=============================================================================
  
  sheets_auth: `🔐 OAuth 2.1 authentication management with PKCE. ALWAYS check status before other operations. Actions: status, login, callback, logout.

**Quick Examples:**
• Check status: {"action":"status"} → See if authenticated
• Start login: {"action":"login"} → Opens browser for OAuth flow
• Complete auth: {"action":"callback","code":"4/0Adeu5B..."} → Submit authorization code
• Logout: {"action":"logout"} → Clears all tokens

**First-Time Setup:**
1. {"action":"status"} → Check if already authenticated
2. If not authenticated → {"action":"login"} → Get authUrl
3. Open authUrl in browser to complete OAuth flow
4. Copy authorization code from redirect URL
5. {"action":"callback","code":"..."} → Complete authentication
6. Tokens stored encrypted in GOOGLE_TOKEN_STORE_PATH

**Performance Tips:**
• Check status once at start, not before every operation
• Tokens auto-refresh when expired (1 hour lifetime)
• Encrypted storage prevents token theft

**Common Workflows:**
1. Session start → {"action":"status"} once
2. If unauthenticated → {"action":"login"} → Get authUrl → {"action":"callback"}
3. On PERMISSION_DENIED → Re-authenticate with {"action":"login"}
4. Switch accounts → {"action":"logout"} then {"action":"login"}

**Error Recovery:**
• TOKEN_NOT_FOUND → First time: {"action":"login"} then {"action":"callback"}
• AUTH_EXPIRED → Tokens auto-refresh automatically
• PERMISSION_DENIED → Call {"action":"login"} to re-authenticate

**Commonly Used With:**
→ sheets_spreadsheet (list spreadsheets after login)
→ sheets_values (read data after authentication)
→ Any tool (check auth status before operations)`,

  //=============================================================================
  // CORE DATA OPERATIONS
  //=============================================================================

  sheets_spreadsheet: `Create, get, copy, update spreadsheets and manage properties. Actions: get, create, copy, update_properties, get_url, batch_get.

**Quick Examples:**
• Create new: {"action":"create","title":"Q4 Budget 2024"}
• Get metadata: {"action":"get","spreadsheetId":"1ABC..."}
• Get URL: {"action":"get_url","spreadsheetId":"1ABC..."} → Returns edit/view links
• Batch get: {"action":"batch_get","spreadsheetIds":["1ABC...","2DEF..."]} → Get multiple spreadsheets
• Copy: {"action":"copy","spreadsheetId":"1ABC...","title":"Copy of Budget"}
• Update: {"action":"update_properties","spreadsheetId":"1ABC...","title":"New Title"}

**Performance Tips:**
• Cache spreadsheetId from create/list - don't call get repeatedly
• Use list with filters to find specific spreadsheets
• get action returns full metadata including all sheets

**Common Workflows:**
1. New project → {"action":"create"} then save ID
2. Find existing → {"action":"list"} then filter by name
3. Before operations → {"action":"get"} to verify sheets exist
4. Duplicate for backup → {"action":"copy"} with descriptive title

**Error Recovery:**
• NOT_FOUND → Spreadsheet deleted or wrong ID, use {"action":"list"} to find
• PERMISSION_DENIED → Not shared with you, request owner to share
• INVALID_ARGUMENT → Check title is non-empty string

**Commonly Used With:**
→ sheets_sheet (add sheets after creating spreadsheet)
→ sheets_values (populate data after creation)
→ sheets_sharing (share after creation)
→ sheets_versions (snapshot after major changes)`,

  sheets_sheet: `Manage individual sheets (tabs) within a spreadsheet. Actions: add, delete, duplicate, update, list, hide, show, move.

**Quick Examples:**
• Add sheet: {"action":"add","spreadsheetId":"1ABC...","title":"Q1 Data"}
• Delete sheet: {"action":"delete","spreadsheetId":"1ABC...","sheetId":123456}
• Rename: {"action":"update","spreadsheetId":"1ABC...","sheetId":123456,"title":"Updated Name"}
• List all: {"action":"list","spreadsheetId":"1ABC..."}
• Duplicate: {"action":"duplicate","spreadsheetId":"1ABC...","sourceSheetId":123456}

**Performance Tips:**
• Use list action once and cache sheet IDs - avoid repeated lookups
• Batch sheet operations in sheets_transaction for atomicity
• Hide unused sheets instead of deleting (preserves references)

**Common Workflows:**
1. Before adding → Use sheets_spreadsheet to verify it doesn't exist
2. After creating → Use sheets_format to apply styling
3. For templates → Duplicate existing sheet instead of creating blank

**Error Recovery:**
• SHEET_NOT_FOUND → Use list action to get valid sheet IDs
• DUPLICATE_TITLE → Check existing names with list first
• PROTECTED_SHEET → Remove protection with sheets_advanced

**Commonly Used With:**
→ sheets_values (populate new sheet after creation)
→ sheets_format (style headers after creation)
→ sheets_dimensions (freeze rows after setup)
→ sheets_advanced (protect sheets after configuration)`,

  sheets_values: `Read, write, append, clear, find, and replace cell values in Google Sheets ranges. Actions: read, write, append, clear, batch_read, batch_write, find, replace.

**Quick Examples:**
• Read range: {"action":"read","spreadsheetId":"1ABC...","range":"Sheet1!A1:D10"}
• Write cell: {"action":"write","spreadsheetId":"1ABC...","range":"A1","values":[["Hello"]]}
• Append row: {"action":"append","spreadsheetId":"1ABC...","range":"Sheet1","values":[["Q4","2024","$50K"]]}
• Batch read: {"action":"batch_read","spreadsheetId":"1ABC...","ranges":["A1:B2","D1:E2"]}

**Performance Tips:**
• Use batch_read/batch_write for multiple ranges - saves 80% API quota
• Semantic ranges {"semantic":{"column":"Revenue"}} find by header
• For >10K cells enable majorDimension:"ROWS"

**Common Workflows:**
1. After reading → Use sheets_analysis for data quality
2. Before writes → Use sheets_validation for pre-flight checks
3. Critical changes → Wrap in sheets_transaction for atomicity

**Error Recovery:**
• QUOTA_EXCEEDED → Use batch operations, wait 60s
• RANGE_NOT_FOUND → Check sheet name with sheets_spreadsheet
• PERMISSION_DENIED → Call sheets_auth action="login"

**Commonly Used With:**
→ sheets_analysis (analyze data quality after reading)
→ sheets_validation (validate before writing)
→ sheets_format (format after bulk writes)
→ sheets_transaction (wrap writes for atomicity)`,

  //=============================================================================
  // FORMATTING & STYLING
  //=============================================================================

  sheets_cells: `Manage individual cell properties and metadata. Actions: merge, unmerge, copy, paste, clear_format, add_note, set_hyperlink, get_properties.

**Quick Examples:**
• Merge cells: {"action":"merge","spreadsheetId":"1ABC...","range":"A1:C1","mergeType":"MERGE_ALL"}
• Add note: {"action":"add_note","spreadsheetId":"1ABC...","range":"A1","note":"Data validated 2024-01-06"}
• Set hyperlink: {"action":"set_hyperlink","spreadsheetId":"1ABC...","range":"A1","url":"https://example.com"}
• Copy format: {"action":"copy","spreadsheetId":"1ABC...","source":"A1","destination":"B1:B10"}

**Performance Tips:**
• Merge cells in batches using sheets_transaction - single API call
• Use copy action for consistent formatting across ranges
• Get properties once and cache - don't fetch repeatedly

**Common Workflows:**
1. After merge → Use sheets_format to style merged header
2. Before paste → Use get_properties to verify destination is empty
3. For templates → Copy format from reference cells

**Error Recovery:**
• MERGE_CONFLICT → Unmerge existing cells first
• INVALID_RANGE → Verify range with sheets_values action="read"
• PROTECTED_RANGE → Remove protection with sheets_advanced

**Commonly Used With:**
→ sheets_format (style merged cells after merging)
→ sheets_values (copy data with paste action)
→ sheets_comments (add notes to important cells)`,

  sheets_format: `Apply visual formatting to cells: colors, fonts, borders, alignment, number formats. Actions: set_colors, set_font, set_borders, set_alignment, set_number_format, conditional_format.

**Quick Examples:**
• Bold header: {"action":"set_font","spreadsheetId":"1ABC...","range":"A1:D1","bold":true}
• Currency: {"action":"set_number_format","spreadsheetId":"1ABC...","range":"B2:B100","format":"$#,##0.00"}
• Background: {"action":"set_colors","spreadsheetId":"1ABC...","range":"A1:D1","backgroundColor":"#4285F4"}
• Borders: {"action":"set_borders","spreadsheetId":"1ABC...","range":"A1:D10","style":"SOLID"}

**Performance Tips:**
• Apply formatting in sheets_transaction - single request for multiple styles
• Use apply_preset for common patterns (header, currency, dates)
• Format entire columns at once instead of individual cells

**Common Workflows:**
1. After data import → Format headers, currency columns, dates
2. Before charts → Apply conditional formatting for visual context
3. For reports → Use preset styles for consistency

**Error Recovery:**
• INVALID_COLOR → Use hex format (#RRGGBB) or named colors
• INVALID_FORMAT → Check number format syntax in Google Sheets docs
• RANGE_TOO_LARGE → Split into smaller ranges

**Commonly Used With:**
→ sheets_rules (add conditional formatting after styling)
→ sheets_dimensions (auto-resize after formatting)
→ sheets_cells (merge headers before formatting)
→ sheets_transaction (batch format operations)`,

  sheets_dimensions: `Manage rows and columns: insert, delete, resize, freeze, group. Actions: insert_rows, insert_columns, delete_rows, delete_columns, resize, freeze_rows, freeze_columns, auto_resize.

**Quick Examples:**
• Insert rows: {"action":"insert_rows","spreadsheetId":"1ABC...","sheetId":0,"startIndex":5,"count":10}
• Delete columns: {"action":"delete_columns","spreadsheetId":"1ABC...","sheetId":0,"startIndex":3,"count":2}
• Freeze headers: {"action":"freeze_rows","spreadsheetId":"1ABC...","sheetId":0,"count":1}
• Auto-resize: {"action":"auto_resize","spreadsheetId":"1ABC...","sheetId":0,"dimension":"COLUMNS"}

**Performance Tips:**
• Insert/delete multiple rows in one call instead of looping
• Use auto_resize after bulk data operations for optimal width
• Freeze headers immediately after creating sheet for better UX

**Common Workflows:**
1. After import → Auto-resize columns for readability
2. Before adding data → Insert rows/columns to make space
3. For reports → Freeze top row and first column

**Error Recovery:**
• INDEX_OUT_OF_BOUNDS → Verify sheet dimensions with sheets_sheet list
• PROTECTED_DIMENSION → Remove protection first
• TOO_MANY_ROWS → Google Sheets limit is 10M cells per sheet

**Commonly Used With:**
→ sheets_values (insert rows before bulk writes)
→ sheets_format (auto-resize after data import)
→ sheets_advanced (group rows for better organization)`,

  //=============================================================================
  // DATA RULES
  //=============================================================================

  sheets_rules: `Create conditional formatting and data validation rules. Actions: add_conditional_format, add_validation, remove_rule, list_rules.

**Quick Examples:**
• Color scale: {"action":"add_conditional_format","spreadsheetId":"1ABC...","range":"A1:A100","type":"COLOR_SCALE","minColor":"#FF0000","maxColor":"#00FF00"}
• Dropdown: {"action":"add_validation","spreadsheetId":"1ABC...","range":"B1:B100","type":"LIST","values":["Yes","No","Maybe"]}
• Date validation: {"action":"add_validation","spreadsheetId":"1ABC...","range":"C1:C100","type":"DATE","condition":"AFTER","value":"2024-01-01"}

**Performance Tips:**
• Apply rules to entire columns for automatic expansion
• Use color scales for quick visual data analysis
• Validation rules prevent data entry errors

**Common Workflows:**
1. After data import → Add validation to prevent bad data
2. For dashboards → Use conditional formatting for visual cues
3. For forms → Add dropdowns to standardize inputs

**Error Recovery:**
• INVALID_CONDITION → Check supported condition types
• RANGE_OVERLAP → Remove conflicting rules first

**Commonly Used With:**
→ sheets_format (apply base formatting before rules)
→ sheets_values (validate data matches rules)
→ sheets_advanced (combine with data validation)`,

  //=============================================================================
  // VISUALIZATION
  //=============================================================================

  sheets_charts: `Create and manage charts and visualizations. Actions: create, update, delete, move, list.

**Quick Examples:**
• Line chart: {"action":"create","spreadsheetId":"1ABC...","type":"LINE","range":"A1:B10","title":"Sales Trend"}
• Pie chart: {"action":"create","spreadsheetId":"1ABC...","type":"PIE","range":"A1:B5","title":"Market Share"}
• Update: {"action":"update","spreadsheetId":"1ABC...","chartId":123,"title":"Updated Title","range":"A1:B20"}

**Performance Tips:**
• Create charts after formatting data for best visual results
• Use sheets_analyze to suggest optimal chart types
• Limit data range to <1000 points for smooth rendering

**Common Workflows:**
1. After analysis → Create visualizations
2. For dashboards → Create multiple charts in transaction
3. For reports → Export charts as images

**Error Recovery:**
• INVALID_RANGE → Verify data range exists
• TOO_MANY_SERIES → Reduce columns in range

**Commonly Used With:**
→ sheets_analyze (suggest optimal chart types)
→ sheets_values (prepare data before charting)
→ sheets_format (format data for better charts)
→ sheets_pivot (create pivot before charting aggregates)`,

  sheets_pivot: `Create and manage pivot tables for data aggregation. Actions: create, update, refresh, delete.

**Quick Examples:**
• Create: {"action":"create","spreadsheetId":"1ABC...","sourceRange":"A1:D100","rows":["Category"],"columns":["Month"],"values":[{"field":"Revenue","function":"SUM"}]}
• Refresh: {"action":"refresh","spreadsheetId":"1ABC...","pivotId":123}

**Performance Tips:**
• Use pivot tables for large datasets instead of complex formulas
• Refresh after source data changes

**Common Workflows:**
1. After data import → Create pivot for analysis
2. For dashboards → Combine with charts

**Error Recovery:**
• SOURCE_RANGE_INVALID → Verify source data exists

**Commonly Used With:**
→ sheets_charts (visualize pivot results)
→ sheets_values (export pivot data)
→ sheets_format (style pivot tables)`,

  sheets_filter_sort: `Apply filters and sort data. Actions: set_filter, create_filter_view, sort_range, remove_filter.

**Quick Examples:**
• Filter: {"action":"set_filter","spreadsheetId":"1ABC...","range":"A1:D100","column":"Status","condition":"EQUALS","value":"Active"}
• Sort: {"action":"sort_range","spreadsheetId":"1ABC...","range":"A2:D100","sortColumn":"Date","order":"DESC"}

**Performance Tips:**
• Use filter views for multiple filter sets
• Sort server-side instead of in client code

**Common Workflows:**
1. After import → Sort by date
2. For analysis → Create filtered views

**Error Recovery:**
• INVALID_CONDITION → Check supported conditions

**Commonly Used With:**
→ sheets_values (read filtered data)
→ sheets_analysis (analyze filtered subsets)
→ sheets_charts (chart filtered views)`,

  //=============================================================================
  // COLLABORATION
  //=============================================================================

  sheets_sharing: `Manage spreadsheet sharing and permissions. Actions: share, revoke, transfer_ownership, get_link.

**Quick Examples:**
• Share: {"action":"share","spreadsheetId":"1ABC...","email":"user@example.com","role":"reader"}
• Get link: {"action":"get_link","spreadsheetId":"1ABC...","access":"anyone"}

**Performance Tips:**
• Share with groups instead of individual users
• Use "commenter" role for stakeholders

**Common Workflows:**
1. After creation → Share with team
2. For review → Generate time-limited link

**Error Recovery:**
• USER_NOT_FOUND → Verify email address

**Commonly Used With:**
→ sheets_advanced (protect ranges after sharing)
→ sheets_comments (collaborate with shared users)
→ sheets_versions (snapshot before sharing)`,

  sheets_comments: `Manage threaded comments on cells. Actions: add, reply, resolve, delete, list.

**Quick Examples:**
• Add: {"action":"add","spreadsheetId":"1ABC...","range":"A1","text":"Please verify"}
• Reply: {"action":"reply","spreadsheetId":"1ABC...","commentId":"comment_123","text":"Verified"}
• Resolve: {"action":"resolve","spreadsheetId":"1ABC...","commentId":"comment_123"}

**Performance Tips:**
• Use comments for collaboration
• Resolve after addressing

**Common Workflows:**
1. For review → Add comments on data
2. For collaboration → Reply with updates

**Error Recovery:**
• COMMENT_NOT_FOUND → May have been deleted

**Commonly Used With:**
→ sheets_sharing (collaborate with team)
→ sheets_values (comment on data issues)
→ sheets_analysis (comment on findings)`,

  //=============================================================================
  // VERSION CONTROL
  //=============================================================================

  sheets_versions: `Access version history and restore points. Actions: list_revisions, get_revision, create_snapshot, restore.

**Quick Examples:**
• List: {"action":"list_revisions","spreadsheetId":"1ABC...","limit":10}
• Snapshot: {"action":"create_snapshot","spreadsheetId":"1ABC...","description":"Before cleanup"}
• Restore: {"action":"restore","spreadsheetId":"1ABC...","revisionId":"rev_123"}

**Performance Tips:**
• Create snapshots before major changes
• Versions stored for 30 days

**Common Workflows:**
1. Before changes → Create snapshot
2. After mistakes → Restore previous version

**Error Recovery:**
• REVISION_NOT_FOUND → May have expired

**Commonly Used With:**
→ sheets_transaction (snapshot before big changes)
→ sheets_history (track changes over time)
→ sheets_conflict (resolve with previous versions)`,

  //=============================================================================
  // ANALYSIS & INTELLIGENCE
  //=============================================================================

  sheets_analysis: `Analyze structure, data quality, formulas, and statistics (read-only). Actions: data_quality, formula_audit, statistics, detect_patterns, column_analysis, suggest_chart.

**Quick Examples:**
• Data quality: {"action":"data_quality","spreadsheetId":"1ABC...","range":"Sheet1!A1:Z100"}
• Formula audit: {"action":"formula_audit","spreadsheetId":"1ABC..."}
• Statistics: {"action":"statistics","spreadsheetId":"1ABC...","range":"Data!B2:B100"}
• Patterns: {"action":"detect_patterns","spreadsheetId":"1ABC...","range":"Sales!A:D"}

**Performance Tips:**
• Limit range to analyzed area only - don't scan entire sheet
• data_quality checks: empty cells, duplicates, type mismatches
• formula_audit finds: #REF!, #DIV/0!, circular references
• Use before writes to catch issues early (saves API quota)

**Common Workflows:**
1. After data import → {"action":"data_quality"} to verify
2. Before complex formulas → {"action":"formula_audit"} for errors
3. For dashboards → {"action":"suggest_chart"} for viz recommendations
4. Data profiling → {"action":"column_analysis"} per column

**Error Recovery:**
• RANGE_TOO_LARGE → Reduce range to <10K cells per analysis
• NO_DATA → Check range has values, not formulas only
• INVALID_RANGE → Verify format: "Sheet1!A1:D10"

**Commonly Used With:**
→ sheets_analyze (AI-powered insights after quality check)
→ sheets_values (fix issues found in analysis)
→ sheets_format (apply conditional formatting based on findings)
→ sheets_charts (visualize analysis results)`,

  sheets_analyze: `AI-powered data analysis using MCP Sampling (SEP-1577). Analyze patterns, anomalies, trends, generate formulas, suggest charts.

**Quick Examples:**
• Full analysis: {"action":"analyze","spreadsheetId":"1ABC...","range":"Sales!A1:F100","types":["patterns","anomalies","trends"]}
• Generate formula: {"action":"generate_formula","spreadsheetId":"1ABC...","description":"Calculate YoY growth from columns B and C"}
• Suggest chart: {"action":"suggest_chart","spreadsheetId":"1ABC...","range":"A1:D20","goal":"show trends over time"}

**Performance Tips:**
• Uses MCP Sampling for intelligent analysis
• Limit to <5000 cells for fast responses
• Specify analysis types to reduce processing

**Common Workflows:**
1. New dataset → Full analysis for overview
2. Need formula → Describe in natural language
3. Create dashboard → Get chart suggestions

**Error Recovery:**
• SAMPLING_UNAVAILABLE → Client doesn't support MCP Sampling
• RANGE_TOO_LARGE → Reduce to representative sample

**Commonly Used With:**
→ sheets_analysis (basic analysis before AI insights)
→ sheets_charts (create suggested charts)
→ sheets_values (apply generated formulas)`,

  //=============================================================================
  // ADVANCED FEATURES
  //=============================================================================

  sheets_advanced: `Advanced features: named ranges, protection, metadata, banding. Actions: add_named_range, add_protected_range, set_metadata, apply_banding.

**Quick Examples:**
• Named range: {"action":"add_named_range","spreadsheetId":"1ABC...","name":"Revenue","range":"B2:B100"}
• Protect: {"action":"add_protected_range","spreadsheetId":"1ABC...","range":"A1:D1","editors":["admin@example.com"]}
• Banding: {"action":"apply_banding","spreadsheetId":"1ABC...","range":"A1:D100","headerColor":"#4285F4"}

**Performance Tips:**
• Named ranges make formulas more readable
• Protect headers to prevent accidental edits

**Common Workflows:**
1. After setup → Create named ranges for key data
2. For templates → Protect formula cells

**Error Recovery:**
• NAME_CONFLICT → Named range already exists

**Commonly Used With:**
→ sheets_sharing (protect sensitive ranges)
→ sheets_values (use named ranges in operations)
→ sheets_format (apply banding for readability)`,

  //=============================================================================
  // ENTERPRISE / SAFETY
  //=============================================================================

  sheets_transaction: `Execute multiple operations atomically with rollback support. Actions: begin, add_operation, commit, rollback, status.

**Quick Examples:**
• Begin: {"action":"begin","spreadsheetId":"1ABC...","description":"Bulk import Q1 data"}
• Add op: {"action":"add_operation","transactionId":"tx_123","operation":{"tool":"sheets_values","args":{...}}}
• Commit: {"action":"commit","transactionId":"tx_123"}
• Rollback: {"action":"rollback","transactionId":"tx_123"}

**Performance Tips:**
• Batch 10-50 operations per transaction - saves 80-95% API quota
• Use for any multi-step workflow to ensure atomicity
• Rollback is instant using auto-snapshots

**Common Workflows:**
1. Before commit → Use sheets_validation to verify all operations
2. After rollback → Use sheets_history to see what was reverted
3. For critical changes → Always wrap in transaction

**Error Recovery:**
• TRANSACTION_TIMEOUT → Commit smaller batches (max 50 operations)
• INVALID_OPERATION → Validate each operation before adding
• SNAPSHOT_FAILED → Check storage quota with sheets_spreadsheet

**Commonly Used With:**
→ sheets_validation (validate before transaction)
→ sheets_history (track transaction operations)
→ sheets_versions (automatic snapshots on begin)
→ All tools (wrap any multi-step workflow)`,

  sheets_validation: `Pre-flight validation before operations: check data quality, detect conflicts, verify ranges. Actions: validate_operation, check_conflicts, verify_range, validate_data.

**Quick Examples:**
• Validate write: {"action":"validate_operation","spreadsheetId":"1ABC...","operation":{"action":"write","range":"A1:D10"}}
• Check conflicts: {"action":"check_conflicts","spreadsheetId":"1ABC...","ranges":["A1:B10","C1:D10"]}
• Verify range: {"action":"verify_range","spreadsheetId":"1ABC...","range":"Sheet1!A1:Z100"}
• Validate data: {"action":"validate_data","spreadsheetId":"1ABC...","range":"A1:A100","rules":["not_empty","unique"]}

**Performance Tips:**
• Validate before sheets_transaction to catch errors early
• Use check_conflicts for concurrent editing scenarios
• Cache validation results for 60s to avoid repeated checks

**Common Workflows:**
1. Before bulk write → Validate operation to catch issues
2. Before transaction → Check conflicts with other users
3. After data import → Validate data quality

**Error Recovery:**
• VALIDATION_FAILED → See detailed errors in response, fix data
• CONFLICT_DETECTED → Use sheets_conflict to resolve
• INVALID_RULE → Check supported validation rules

**Commonly Used With:**
→ sheets_transaction (validate before commit)
→ sheets_conflict (check conflicts before operations)
→ sheets_impact (preview operation effects)
→ sheets_values (validate data before writes)`,

  sheets_conflict: `Detect and resolve concurrent modification conflicts. Actions: detect, resolve, list_conflicts.

**Quick Examples:**
• Detect: {"action":"detect","spreadsheetId":"1ABC...","ranges":["A1:D10"]}
• Resolve: {"action":"resolve","spreadsheetId":"1ABC...","conflictId":"conflict_123","strategy":"keep_latest"}

**Performance Tips:**
• Check before critical operations
• Use sheets_transaction to prevent conflicts

**Common Workflows:**
1. Before bulk write → Detect conflicts
2. After conflict → Resolve with appropriate strategy

**Error Recovery:**
• NO_CONFLICTS → All clear to proceed

**Commonly Used With:**
→ sheets_validation (detect conflicts before validation)
→ sheets_transaction (resolve conflicts before commit)
→ sheets_versions (restore clean version if needed)`,

  sheets_impact: `Analyze impact of changes before execution. Actions: analyze, get_dependencies, preview.

**Quick Examples:**
• Analyze: {"action":"analyze","spreadsheetId":"1ABC...","range":"B2:B100","changeType":"delete"}
• Dependencies: {"action":"get_dependencies","spreadsheetId":"1ABC...","range":"A1"}

**Performance Tips:**
• Run before bulk changes
• Check formula dependencies

**Common Workflows:**
1. Before delete → Analyze impact on formulas
2. Before update → Preview cascading changes

**Error Recovery:**
• TOO_COMPLEX → Simplify analysis range

**Commonly Used With:**
→ sheets_validation (check impact before validation)
→ sheets_transaction (preview transaction effects)
→ sheets_confirm (show impact before user confirmation)`,

  sheets_history: `Track and query operation history for debugging and audit trails. Actions: list, get, search, clear, rollback.

**Quick Examples:**
• List recent: {"action":"list","spreadsheetId":"1ABC...","limit":10}
• Get operation: {"action":"get","spreadsheetId":"1ABC...","operationId":"op_123"}
• Search: {"action":"search","spreadsheetId":"1ABC...","query":"sheets_values","timeRange":"last_hour"}
• Rollback: {"action":"rollback","spreadsheetId":"1ABC...","toOperationId":"op_100"}

**Performance Tips:**
• History stored for last 100 operations per spreadsheet
• Use search with timeRange to find operations quickly
• Rollback uses transaction snapshots for instant recovery

**Common Workflows:**
1. After error → List recent operations to find root cause
2. For audit → Search by tool name and date range
3. To undo → Rollback to specific operation ID

**Error Recovery:**
• OPERATION_NOT_FOUND → Operation may have expired (>100 ops ago)
• ROLLBACK_FAILED → Check if snapshot exists for that operation
• HISTORY_DISABLED → Enable in spreadsheet settings

**Commonly Used With:**
→ sheets_transaction (track transaction operations)
→ sheets_versions (correlate with snapshots)
→ sheets_analysis (debug data quality issues)
→ All tools (audit trail for all operations)`,

  sheets_confirm: `Confirm multi-step operations with the user before execution. Uses MCP Elicitation (SEP-1036). Claude plans, user confirms, Claude executes.

**Quick Examples:**
• Confirm plan: {"action":"request_confirmation","plan":{"title":"Delete Old Data","steps":[...],"risk":"high"}}
• Get status: {"action":"get_status","confirmationId":"conf_123"}

**Performance Tips:**
• Use for any destructive or bulk operation
• Plan previews use sheets_impact internally
• User sees full plan before confirming

**Common Workflows:**
1. Plan operation → Build step list
2. Request confirmation → User reviews
3. On confirm → Execute with sheets_transaction
4. On reject → Abort cleanly

**Error Recovery:**
• ELICITATION_UNAVAILABLE → Client doesn't support MCP Elicitation
• CONFIRMATION_TIMEOUT → Prompt user to confirm again
• USER_REJECTED → Abort operation, no changes made

**Commonly Used With:**
→ sheets_impact (generate plan impact preview)
→ sheets_transaction (execute confirmed plan atomically)
→ sheets_history (track confirmed operations)`,

  sheets_fix: `Automatically fix common spreadsheet issues detected by sheets_analysis. Supports preview mode (see what would be fixed) and apply mode (actually fix).

**Quick Examples:**
• Preview fixes: {"spreadsheetId":"1ABC...","issues":[...],"mode":"preview"}
• Apply fixes: {"spreadsheetId":"1ABC...","issues":[...],"mode":"apply","safety":{"createSnapshot":true}}
• Filter by severity: {"spreadsheetId":"1ABC...","issues":[...],"filters":{"severity":["high","medium"]}}

**Fixable Issue Types:**
• MULTIPLE_TODAY → Replace redundant TODAY() calls with cell references
• FULL_COLUMN_REFS → Convert A:A to bounded ranges
• NO_FROZEN_HEADERS → Freeze top row for better navigation
• NO_FROZEN_COLUMNS → Freeze left column(s) for better navigation
• NO_PROTECTION → Protect formula cells from accidental edits
• NESTED_IFERROR → Simplify excessive IFERROR nesting
• EXCESSIVE_CF_RULES → Consolidate overlapping conditional format rules

**Performance Tips:**
• Always preview before apply - verify fix operations are correct
• Enable createSnapshot:true for instant rollback capability
• Use filters to apply only high/medium severity fixes first
• Limit fixes to specific sheets with filters.sheets parameter

**Common Workflows:**
1. Run sheets_analysis → Get data_quality or formula_audit results
2. Preview fixes → {"mode":"preview"} to see operations
3. Review operations → Verify estimated impact and risk
4. Apply fixes → {"mode":"apply","safety":{"createSnapshot":true}}
5. Verify → Re-run sheets_analysis to check verificationScore

**Safety Features:**
• createSnapshot:true → Auto-snapshot before applying (rollback via sheets_history)
• dryRun:true → Simulate without applying (testing)
• Preview mode → Shows exact operations before execution
• Risk levels → Each operation tagged low/medium/high

**Error Recovery:**
• FIX_FAILED → Check results array for specific operation errors
• SNAPSHOT_FAILED → Verify storage quota available
• INVALID_ISSUE → Issue type not fixable by this tool

**Commonly Used With:**
→ sheets_analysis (detect issues before fixing)
→ sheets_history (rollback if fixes cause problems)
→ sheets_confirm (confirm high-risk fixes before applying)
→ sheets_transaction (execute multiple fixes atomically)`,

};

// Type export for other modules
export type ToolName = keyof typeof TOOL_DESCRIPTIONS;

// Helper to get description with fallback
export function getToolDescription(name: string): string {
  return TOOL_DESCRIPTIONS[name as ToolName] ?? `${name} operations`;
}
