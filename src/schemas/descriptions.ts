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

  sheets_auth: `🔐 OAuth 2.1 authentication management with PKCE (4 actions). ALWAYS check status before other operations. Actions: status, login, callback, logout.

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
→ sheets_core (list spreadsheets after login)
→ sheets_data (read data after authentication)
→ Any tool (check auth status before operations)`,

  //=============================================================================
  // CORE DATA OPERATIONS
  //=============================================================================

  sheets_core: `📋 Manage spreadsheets and sheets (15 actions). Wave 4 consolidation: spreadsheet (8) + sheet (7). Actions: get, create, copy, update_properties, get_url, batch_get, get_comprehensive, list, add_sheet, delete_sheet, duplicate_sheet, update_sheet, copy_sheet_to, list_sheets, get_sheet.

**💡 TIP: For ANALYSIS, use sheets_analyze action "comprehensive" instead - it gets metadata + data + analysis in ONE CALL!**

**Quick Examples - Spreadsheets:**
• Create new: {"action":"create","title":"Q4 Budget 2024"}
• Get metadata: {"action":"get","spreadsheetId":"1ABC..."}
• Get URL: {"action":"get_url","spreadsheetId":"1ABC..."} → Returns edit/view links
• Batch get: {"action":"batch_get","spreadsheetIds":["1ABC...","2DEF..."]} → Get multiple spreadsheets
• Copy: {"action":"copy","spreadsheetId":"1ABC...","title":"Copy of Budget"}
• Update: {"action":"update_properties","spreadsheetId":"1ABC...","title":"New Title"}

**Quick Examples - Sheets:**
• Add sheet: {"action":"add_sheet","spreadsheetId":"1ABC...","title":"Q1 Data"}
• Delete sheet: {"action":"delete_sheet","spreadsheetId":"1ABC...","sheetId":123456}
• Rename: {"action":"update_sheet","spreadsheetId":"1ABC...","sheetId":123456,"title":"Updated Name"}
• List all: {"action":"list_sheets","spreadsheetId":"1ABC..."}
• Duplicate: {"action":"duplicate_sheet","spreadsheetId":"1ABC...","sourceSheetId":123456}

**When to Use sheets_core vs sheets_analyze:**
✅ Use sheets_core for: Creating, copying, updating spreadsheet/sheet properties
✅ Use sheets_analyze {"action":"comprehensive"} for: Getting metadata + data + analysis together

**Performance Tips:**
• Cache spreadsheetId from create/list - don't call get repeatedly
• Use list_sheets once and cache sheet IDs - avoid repeated lookups
• For analysis: Use sheets_analyze comprehensive instead of get + data + analysis
• Batch sheet operations in sheets_transaction for atomicity

**Common Workflows:**
1. New project → {"action":"create"} then save ID
2. Analyze existing → sheets_analyze {"action":"comprehensive"} (gets metadata + data + analysis)
3. Find existing → {"action":"list"} then filter by name
4. Duplicate for backup → {"action":"copy"} with descriptive title
5. Add sheet → {"action":"add_sheet"} after creating spreadsheet
6. For templates → {"action":"duplicate_sheet"} instead of creating blank

**Error Recovery:**
• NOT_FOUND → Spreadsheet deleted or wrong ID, use {"action":"list"} to find
• SHEET_NOT_FOUND → Use {"action":"list_sheets"} to get valid sheet IDs
• DUPLICATE_TITLE → Check existing names with list_sheets first
• PERMISSION_DENIED → Not shared with you, request owner to share
• PROTECTED_SHEET → Remove protection with sheets_advanced

**Commonly Used With:**
→ sheets_analyze (comprehensive analysis replaces get + data + analysis)
→ sheets_data (populate sheets after creation)
→ sheets_format (style headers after creation)
→ sheets_dimensions (freeze rows after setup)
→ sheets_collaborate (share after creation)
→ sheets_advanced (protect sheets after configuration)`,

  sheets_data: `Unified cell data operations: read, write, append, clear, find/replace, notes, validation, hyperlinks, merge/unmerge, cut/copy (21 actions). Wave 4 consolidation: values (9) + cells (12).

**Quick Examples:**
• Read range: {"action":"read","spreadsheetId":"1ABC...","range":"Sheet1!A1:D10"}
• Write cell: {"action":"write","spreadsheetId":"1ABC...","range":"A1","values":[["Hello"]]}
• Append row: {"action":"append","spreadsheetId":"1ABC...","range":"Sheet1","values":[["Q4","2024","$50K"]]}
• Batch read: {"action":"batch_read","spreadsheetId":"1ABC...","ranges":["A1:B2","D1:E2"]}
• Merge cells: {"action":"merge","spreadsheetId":"1ABC...","range":"A1:C1"}
• Add note: {"action":"add_note","spreadsheetId":"1ABC...","range":"A1","note":"Data validated 2024-01-06"}
• Set hyperlink: {"action":"set_hyperlink","spreadsheetId":"1ABC...","range":"A1","url":"https://example.com"}
• Copy cells: {"action":"copy","spreadsheetId":"1ABC...","source":"A1","destination":"B1:B10"}

**Performance Tips:**
• Use batch_read/batch_write for multiple ranges - saves 80% API quota
• Semantic ranges {"semantic":{"column":"Revenue"}} find by header
• For >10K cells enable majorDimension:"ROWS"
• Merge cells in batches using sheets_transaction - single API call

**📚 Resources:**
• servalsheets://guides/quota-optimization → Save 80-99% API quota
• servalsheets://guides/batching-strategies → When to batch vs single ops
• servalsheets://examples/batch-operations → Copy-paste code examples
• servalsheets://decisions/read-vs-batch-read → Decision tree

**🔒 Safety & Undo (Critical for Writes):**
• DRY-RUN FIRST: {"safety":{"dryRun":true}} → Preview changes before executing
• USER CONFIRMATION: Use sheets_confirm for >100 cells or destructive ops
• AUTO-SNAPSHOT: {"safety":{"createSnapshot":true}} → Auto-backup before execution
• TRANSACTIONS: Wrap 2+ writes in sheets_transaction for atomicity + rollback
• UNDO: sheets_history action="rollback" OR sheets_versions action="restore"

**Common Workflows:**
1. After reading → Use sheets_analysis for data quality
2. Before writes → ALWAYS use dryRun first to preview
3. Before >100 cells → Use sheets_confirm for user approval
4. For 2+ operations → Wrap in sheets_transaction for atomicity
5. Critical changes → Enable createSnapshot for instant undo
6. After merge → Use sheets_format to style merged header

**Error Recovery:**
• QUOTA_EXCEEDED → Use batch operations (batch_write), wait 60s
• RANGE_NOT_FOUND → Check sheet name with sheets_core
• PERMISSION_DENIED → Call sheets_auth action="login"
• MERGE_CONFLICT → Unmerge existing cells first
• PROTECTED_RANGE → Remove protection with sheets_advanced

**Commonly Used With:**
→ sheets_confirm (get approval before >100 cell writes)
→ sheets_transaction (wrap multiple writes atomically)
→ sheets_quality (validate before writing)
→ sheets_analysis (analyze data quality after reading)
→ sheets_format (style merged cells after merging)`,

  //=============================================================================
  // FORMATTING & STYLING
  //=============================================================================

  sheets_format: `Apply visual formatting to cells: colors, fonts, borders, alignment, number formats (9 actions). Actions: set_colors, set_font, set_borders, set_alignment, set_number_format, set_text_rotation, set_padding, apply_theme, conditional_format.

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
→ sheets_data (merge headers before formatting)
→ sheets_transaction (batch format operations)`,

  sheets_dimensions: `⚠️ Manage rows and columns: insert, delete, resize, freeze, group (21 actions). DELETE OPERATIONS ARE DESTRUCTIVE - always confirm first. Actions: insert_rows, insert_columns, delete_rows, delete_columns, resize_rows, resize_columns, auto_resize_rows, auto_resize_columns, hide_rows, hide_columns, show_rows, show_columns, freeze_rows, freeze_columns, unfreeze, group_rows, group_columns, ungroup_rows, ungroup_columns, move_rows, move_columns.

**⚡ WHEN TO USE:**
• Insert rows/columns before bulk data operations
• Delete rows/columns (with confirmation for >10 rows)
• Resize rows/columns for better readability
• Freeze rows/columns for navigation (headers/labels)
• Auto-resize after data import for optimal width
• Group rows/columns for collapsible sections

**❌ DON'T USE FOR:**
• Data modification (use sheets_data)
• Cell formatting (use sheets_format)
• Reading dimensions (use sheets_core action="get")

**🔴 CRITICAL: Delete Operations Safety**
• delete_rows/delete_columns are PERMANENT (no built-in undo)
• ALWAYS use sheets_confirm before deleting >10 rows
• ALWAYS enable createSnapshot:true for delete operations
• ALWAYS check dependencies with sheets_quality before delete

**Quick Examples:**
• Insert rows: {"action":"insert_rows","spreadsheetId":"1ABC...","sheetId":0,"startIndex":5,"count":10}
• Delete columns (SAFE): {"action":"delete_columns","spreadsheetId":"1ABC...","sheetId":0,"startIndex":3,"count":2,"safety":{"dryRun":true,"createSnapshot":true}}
• Freeze headers: {"action":"freeze_rows","spreadsheetId":"1ABC...","sheetId":0,"count":1}
• Auto-resize: {"action":"auto_resize","spreadsheetId":"1ABC...","sheetId":0,"dimension":"COLUMNS"}

**🔒 Safety & Undo for Deletes:**
1. DRY-RUN: {"safety":{"dryRun":true}} → See what will be deleted
2. IMPACT CHECK: sheets_quality action="analyze" → Check formula dependencies
3. USER CONFIRM: sheets_confirm → Get approval for >10 rows/columns
4. SNAPSHOT: {"safety":{"createSnapshot":true}} → Create restore point
5. EXECUTE: Remove dryRun flag, delete with snapshot
6. UNDO: sheets_versions action="restore" using snapshotId from response

**Performance Tips:**
• Insert/delete multiple rows in one call instead of looping
• Use auto_resize after bulk data operations for optimal width
• Freeze headers immediately after creating sheet for better UX

**Common Workflows:**
1. Before delete → Check impact with sheets_quality
2. Before delete → Request confirmation with sheets_confirm
3. After import → Auto-resize columns for readability
4. Before adding data → Insert rows/columns to make space
5. For reports → Freeze top row and first column

**Error Recovery:**
• INDEX_OUT_OF_BOUNDS → Verify sheet dimensions with sheets_core list_sheets
• PROTECTED_DIMENSION → Remove protection first
• TOO_MANY_ROWS → Google Sheets limit is 10M cells per sheet

**Commonly Used With:**
→ sheets_confirm (ALWAYS for delete operations >10 rows)
→ sheets_quality (check dependencies before delete)
→ sheets_collaborate (create snapshot before delete)
→ sheets_data (insert rows before bulk writes)`,

  //=============================================================================
  // DATA RULES
  //=============================================================================

  sheets_rules: `Create conditional formatting and data validation rules (8 actions). Actions: add_conditional_format, update_conditional_format, delete_conditional_format, list_conditional_formats, add_validation, update_validation, delete_validation, list_validations.

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
→ sheets_data (validate data matches rules)
→ sheets_advanced (combine with data validation)`,

  //=============================================================================
  // VISUALIZATION
  //=============================================================================

  sheets_charts: `Create and manage charts and visualizations (9 actions). Actions: create, update, delete, move, resize, list, get, update_data_range, set_position.

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
→ sheets_data (prepare data before charting)
→ sheets_format (format data for better charts)
→ sheets_visualize (create pivot before charting aggregates)`,

  sheets_pivot: `Create and manage pivot tables for data aggregation (6 actions). Actions: create, update, refresh, delete, list, get.

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
→ sheets_visualize (visualize pivot results)
→ sheets_data (export pivot data)
→ sheets_format (style pivot tables)`,

  sheets_visualize: `Create and manage visualizations including charts and pivot tables (15 actions). Combines charts (9 actions) + pivot tables (6 actions).

**Chart Actions:** create, update, delete, move, resize, list, get, update_data_range, set_position
**Pivot Actions:** create_pivot, update_pivot, refresh_pivot, delete_pivot, list_pivots, get_pivot

**Quick Examples:**
• Line chart: {"action":"create","spreadsheetId":"1ABC...","type":"LINE","range":"A1:B10","title":"Sales Trend"}
• Pie chart: {"action":"create","spreadsheetId":"1ABC...","type":"PIE","range":"A1:B5","title":"Market Share"}
• Pivot table: {"action":"create_pivot","spreadsheetId":"1ABC...","sourceRange":"A1:D100","rows":["Category"],"columns":["Month"],"values":[{"field":"Revenue","function":"SUM"}]}
• Update chart: {"action":"update","spreadsheetId":"1ABC...","chartId":123,"title":"Updated Title","range":"A1:B20"}

**Performance Tips:**
• Create charts after formatting data for best visual results
• Use sheets_analyze to suggest optimal chart types
• Limit data range to <1000 points for smooth rendering
• Use pivot tables for large datasets instead of complex formulas

**Common Workflows:**
1. After analysis → Create visualizations
2. For dashboards → Create multiple charts + pivots in transaction
3. For reports → Export charts as images
4. After data import → Create pivot for analysis

**Error Recovery:**
• INVALID_RANGE → Verify data range exists
• TOO_MANY_SERIES → Reduce columns in range
• SOURCE_RANGE_INVALID → Verify pivot source data exists

**Commonly Used With:**
→ sheets_analyze (suggest optimal chart types and visualizations)
→ sheets_data (prepare and export visualization data)
→ sheets_format (format data for better charts)
→ sheets_transaction (batch create multiple visualizations)`,

  sheets_filter_sort: `Apply filters and sort data (14 actions). Actions: set_filter, create_filter_view, update_filter_view, delete_filter_view, list_filter_views, sort_range, sort_sheet, clear_filter, apply_basic_filter, remove_basic_filter, set_filter_criteria, add_sort_spec, remove_sort_spec, get_filter_views.

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
→ sheets_data (read filtered data)
→ sheets_analysis (analyze filtered subsets)
→ sheets_visualize (chart filtered views)`,

  //=============================================================================
  // COLLABORATION
  //=============================================================================

  sheets_sharing: `Manage spreadsheet sharing and permissions (8 actions). Actions: share, revoke, transfer_ownership, get_permissions, list_permissions, update_permission, get_link, set_link_sharing.

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
→ sheets_collaborate (collaborate with shared users)
→ sheets_collaborate (snapshot before sharing)`,

  sheets_comments: `Manage threaded comments on cells (10 actions). Actions: add, reply, resolve, unresolve, delete, delete_reply, list, list_replies, get, update.

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
→ sheets_collaborate (collaborate with team)
→ sheets_data (comment on data issues)
→ sheets_analysis (comment on findings)`,

  sheets_collaborate: `Manage collaboration including sharing, permissions, comments, and version history (28 actions). Combines sheets_sharing (8 actions) + sheets_comments (10 actions) + sheets_versions (10 actions).

**Sharing Actions:** share, revoke, transfer_ownership, get_permissions, list_permissions, update_permission, get_link, set_link_sharing
**Comments Actions:** add_comment, reply_to_comment, resolve_comment, unresolve_comment, delete_comment, delete_reply, list_comments, list_replies, get_comment, update_comment
**Version Actions:** list_revisions, get_revision, create_snapshot, restore_revision, delete_snapshot, list_snapshots, get_snapshot, restore_from_snapshot, export_revision, compare_revisions

**Quick Examples:**
• Share with user: {"action":"share","spreadsheetId":"1ABC...","email":"user@example.com","role":"reader"}
• Add comment: {"action":"add_comment","spreadsheetId":"1ABC...","range":"A1","text":"Please verify"}
• Create snapshot: {"action":"create_snapshot","spreadsheetId":"1ABC...","description":"Before cleanup"}
• Get sharing link: {"action":"get_link","spreadsheetId":"1ABC...","access":"anyone"}
• Reply to comment: {"action":"reply_to_comment","spreadsheetId":"1ABC...","commentId":"comment_123","text":"Verified"}
• List revisions: {"action":"list_revisions","spreadsheetId":"1ABC...","limit":10}

**Performance Tips:**
• Share with groups instead of individual users
• Create snapshots before major changes
• Resolve comments after addressing them
• Use "commenter" role for review stakeholders
• Versions stored for 30 days

**Common Workflows:**
1. After creation → Share with team
2. For review → Add comments on data issues
3. Before big changes → Create snapshot
4. After mistakes → Restore previous version
5. For collaboration → Reply to comments with updates
6. For stakeholders → Generate time-limited link

**Error Recovery:**
• USER_NOT_FOUND → Verify email address
• COMMENT_NOT_FOUND → May have been deleted
• REVISION_NOT_FOUND → May have expired (30 day limit)

**Commonly Used With:**
→ sheets_advanced (protect ranges after sharing)
→ sheets_data (comment on data issues)
→ sheets_analysis (comment on analysis findings)
→ sheets_transaction (snapshot before batch changes)
→ sheets_history (track collaboration over time)
→ sheets_quality (resolve conflicts with previous versions)`,

  //=============================================================================
  // VERSION CONTROL
  //=============================================================================

  sheets_versions: `Access version history and restore points (10 actions). Actions: list_revisions, get_revision, create_snapshot, restore, delete_snapshot, list_snapshots, get_snapshot, restore_from_snapshot, export_revision, compare_revisions.

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
→ sheets_quality (resolve with previous versions)`,

  //=============================================================================
  // ANALYSIS & INTELLIGENCE
  //=============================================================================

  sheets_analysis: `📊 Analyze structure, data quality, formulas, and statistics (13 actions - DEPRECATED, use sheets_analyze instead). Use THIS tool for traditional analysis. Actions: data_quality, formula_audit, structure_analysis, statistics, correlations, summary, dependencies, compare_ranges, detect_patterns, column_analysis, suggest_templates, generate_formula, suggest_chart.

**🔍 sheets_analysis vs sheets_analyze - WHEN TO USE WHICH:**

**Use sheets_analysis (THIS TOOL) for:**
✅ Fast, deterministic checks (<1 second)
✅ Data quality issues (empty cells, duplicates, mixed types)
✅ Formula errors (#REF!, #DIV/0!, circular refs)
✅ Statistics (mean, median, std dev, correlation)
✅ Known issue types with specific fixes
✅ Structural analysis (sheets, ranges, named ranges)
✅ Performance (no LLM cost or latency)

**Use sheets_analyze (AI tool) for:**
✅ Pattern detection (AI finds non-obvious trends)
✅ Anomaly detection (statistical outliers with context)
✅ Formula generation (natural language → Google Sheets formula)
✅ Chart recommendations (AI suggests best visualization)
✅ Novel insights (AI explains what's interesting about the data)
✅ Complex interpretation (requires reasoning)

**Decision Tree:**
1. Need basic stats or known issues? → sheets_analysis
2. Need AI to find patterns/generate formulas? → sheets_analyze
3. Unsure? → Start with sheets_analysis (fast/free), then sheets_analyze for deeper insights

**Quick Examples:**
• Data quality: {"action":"data_quality","spreadsheetId":"1ABC...","range":"Sheet1!A1:Z100"}
• Formula audit: {"action":"formula_audit","spreadsheetId":"1ABC..."}
• Statistics: {"action":"statistics","spreadsheetId":"1ABC...","range":"Data!B2:B100"}
• Patterns: {"action":"detect_patterns","spreadsheetId":"1ABC...","range":"Sales!A:D"}

**What Each Action Finds:**
• data_quality: Empty headers, duplicates, mixed types, missing values, whitespace
• formula_audit: Broken refs, volatile functions (TODAY/RAND), complex formulas, full column refs (A:A), nested IFERROR, VLOOKUP performance issues
• statistics: Mean, median, mode, std dev, min, max, quartiles, null count
• detect_patterns: Trends, correlations, seasonality, anomalies (z-score outliers)
• column_analysis: Data type detection, distribution, unique values, frequency
• suggest_chart: Best chart types for data structure

**Performance Tips:**
• Limit range to analyzed area only - don't scan entire sheet
• data_quality checks <10K cells in <1 second
• formula_audit scans all formulas in sheet (can take 2-3 seconds for large sheets)
• Use before writes to catch issues early (saves API quota)
• Results are cached for 60 seconds

**Common Workflows:**
1. After data import → {"action":"data_quality"} to verify
2. Before complex formulas → {"action":"formula_audit"} for errors
3. For quick stats → {"action":"statistics"} (faster than AI)
4. THEN if needed → Use sheets_analyze for AI insights

**Error Recovery:**
• RANGE_TOO_LARGE → Reduce range to <10K cells per analysis
• NO_DATA → Check range has values, not formulas only
• INVALID_RANGE → Verify format: "Sheet1!A1:D10"

**Commonly Used With:**
→ sheets_analyze (AI insights AFTER sheets_analysis finds issues)
→ sheets_fix (automatically fix issues found)
→ sheets_data (fix issues found in analysis)
→ sheets_format (apply conditional formatting based on findings)`,

  sheets_analyze: `🤖 ONE TOOL TO RULE THEM ALL (10 actions) - Comprehensive spreadsheet analysis that REPLACES sheets_core + sheets_data + sheets_analysis in a SINGLE CALL. Use action "comprehensive" to get EVERYTHING: metadata, data, quality analysis, patterns, formulas, performance recommendations, and AI insights. Actions: analyze_data, suggest_visualization, generate_formula, detect_patterns, analyze_structure, analyze_quality, analyze_performance, create_recommended_chart, create_recommended_pivot, explain_analysis.

**⚡ START HERE - Use "comprehensive" action for complete spreadsheet analysis:**

**🎯 RECOMMENDED: action "comprehensive" (ONE CALL GETS EVERYTHING):**
✅ Spreadsheet metadata (replaces sheets_core get)
✅ All sheet data (replaces sheets_data read - with smart sampling)
✅ Data quality analysis (replaces sheets_analysis data_quality)
✅ Statistical analysis (replaces sheets_analysis structure_analysis)
✅ Pattern detection (trends, anomalies, correlations)
✅ Formula analysis & optimization recommendations
✅ Performance recommendations
✅ Visualization suggestions with executable parameters
✅ Natural language summary + top insights

**Quick Example - Comprehensive Analysis (START HERE):**
{"action":"comprehensive","spreadsheetId":"1ABC...","includeFormulas":true,"includeVisualizations":true,"includePerformance":true}

This ONE call returns EVERYTHING you need. No need to call sheets_core, sheets_data, or sheets_analysis separately!

**Other Available Actions (use when you need specific analysis only):**
• analyze_data: Smart routing (fast stats OR AI insights based on data size)
• suggest_visualization: Chart/pivot recommendations with executable params
• generate_formula: Natural language → Google Sheets formula
• detect_patterns: Trends, anomalies, correlations
• analyze_structure: Schema, types, relationships
• analyze_quality: Data quality issues with fix suggestions
• analyze_performance: Optimization recommendations
• analyze_formulas: Formula intelligence (volatile, complex, optimizations)
• query_natural_language: Conversational data queries
• explain_analysis: Explain previous analysis results

**Performance Tips:**
• "comprehensive" uses smart sampling: <10K rows = sample (1-3s), >10K rows = full (3-10s)
• includeFormulas:false to skip formula analysis if not needed
• includeVisualizations:false to skip chart suggestions
• Caches metadata for 5min, structure for 3min, samples for 1min

**Decision Tree:**
1. Need complete analysis? → {"action":"comprehensive"} (ONE CALL!)
2. Need specific analysis only? → Use specific action (analyze_data, suggest_visualization, etc.)
3. Need to create charts from recommendations? → sheets_visualize (after comprehensive)
4. Need to apply formulas? → sheets_data (after generate_formula)

**Common Workflows:**
1. Analyze spreadsheet: {"action":"comprehensive"} → Get EVERYTHING in one call
2. Generate charts: Use chartRecommendations from comprehensive → sheets_charts create
3. Fix issues: Use qualityIssues from comprehensive → sheets_fix apply
4. Optimize performance: Use performance recommendations → Apply suggested changes

**Error Recovery:**
• SAMPLING_UNAVAILABLE → Client doesn't support MCP Sampling
• RANGE_TOO_LARGE → Reduce to <50K rows or use sampling
• INTERNAL_ERROR → Retry with includeFormulas:false if formula analysis fails

**Commonly Used With:**
→ sheets_visualize (create AI-suggested visualizations)
→ sheets_fix (apply quality issue fixes)
→ sheets_data (apply generated formulas)
→ sheets_confirm (confirm before applying recommendations)`,

  //=============================================================================
  // ADVANCED FEATURES
  //=============================================================================

  sheets_advanced: `Advanced features: named ranges, protection, metadata, banding, formula intelligence (27 actions). Wave 5: Absorbed sheets_formulas for unified advanced capabilities. Actions: add_named_range, update_named_range, delete_named_range, list_named_ranges, add_protected_range, update_protected_range, delete_protected_range, list_protected_ranges, set_metadata, get_metadata, delete_metadata, apply_banding, update_banding, delete_banding, list_bandings, add_developer_metadata, get_developer_metadata, delete_developer_metadata, search_developer_metadata, formula_generate, formula_suggest, formula_explain, formula_optimize, formula_fix, formula_trace_precedents, formula_trace_dependents, formula_manage_named_ranges.

**Quick Examples:**
• Named range: {"action":"add_named_range","spreadsheetId":"1ABC...","name":"Revenue","range":"B2:B100"}
• Protect: {"action":"add_protected_range","spreadsheetId":"1ABC...","range":"A1:D1","editors":["admin@example.com"]}
• Banding: {"action":"apply_banding","spreadsheetId":"1ABC...","range":"A1:D100","headerColor":"#4285F4"}
• Generate formula: {"action":"formula_generate","description":"Sum values in column A"}
• Explain formula: {"action":"formula_explain","formula":"=SUMIF(A:A,'>100',B:B)"}
• Trace precedents: {"action":"formula_trace_precedents","spreadsheetId":"1ABC...","range":"C5"}

**Performance Tips:**
• Named ranges make formulas more readable
• Protect headers to prevent accidental edits
• Formula actions use AI (1-2s latency, caching enabled)
• Batch formula operations in sheets_transaction for efficiency

**Common Workflows:**
1. After setup → Create named ranges for key data
2. For templates → Protect formula cells
3. Formula help → Use formula_explain for documentation
4. Formula creation → Use formula_generate from natural language
5. Formula optimization → Use formula_optimize for performance improvements

**Error Recovery:**
• NAME_CONFLICT → Named range already exists
• FORMULA_INVALID → Check formula syntax with formula_explain
• AI_UNAVAILABLE → Formula intelligence requires Sampling feature

**Commonly Used With:**
→ sheets_collaborate (protect sensitive ranges)
→ sheets_data (use named ranges in operations)
→ sheets_format (apply banding for readability)
→ sheets_analyze (formula analysis for optimization)`,

  //=============================================================================
  // ENTERPRISE / SAFETY
  //=============================================================================

  sheets_transaction: `Execute multiple operations atomically with rollback support (6 actions). ALWAYS use for 2+ operations on the same spreadsheet. Actions: begin, queue, commit, rollback, status, list.

**⚡ WHEN TO USE (Critical):**
• ANY TIME you need 2+ operations on the same spreadsheet
• Bulk imports/updates (>50 rows)
• Multi-step workflows (format + write + validate)
• Operations that must succeed or fail together
• Critical changes requiring atomicity

**❌ DON'T USE:**
• Single operations (just call the tool directly)
• Read-only operations (analysis, queries)
• Operations on different spreadsheets

**Performance Benefits:**
• 🚀 1 API call instead of N calls (80-95% quota savings)
• ⚡ 10x faster for bulk operations (batched execution)
• 🔄 Automatic rollback on ANY failure (no partial writes)
• 🔒 Guaranteed atomicity (all-or-nothing)

**Quick Examples:**
• Begin: {"action":"begin","spreadsheetId":"1ABC...","autoRollback":true}
• Queue: {"action":"queue","transactionId":"tx_123","operation":{"tool":"sheets_data","action":"write","params":{...}}}
• Commit: {"action":"commit","transactionId":"tx_123"} ← Executes all atomically

**Workflow Pattern:**
1. BEGIN transaction: {"action":"begin","spreadsheetId":"1ABC..."}
2. QUEUE each operation: {"action":"queue","transactionId":"tx_123","operation":{...}} (repeat)
3. COMMIT all: {"action":"commit","transactionId":"tx_123"} → Single API call executes all
4. IF ERROR → Auto-rollback if autoRollback:true

**Example - Bulk Import (Instead of 100 writes):**
Begin tx → Queue write op #1 → Queue write op #2 → ... → Queue write op #100 → Commit
Result: 1 API call, 99% quota saved, atomic execution

**Error Recovery:**
• TRANSACTION_TIMEOUT → Commit smaller batches (max 50 operations)
• INVALID_OPERATION → Validate each operation before queuing
• AUTO_ROLLBACK → Transaction failed, spreadsheet unchanged (safe)

**📚 Resources:**
• servalsheets://decisions/when-to-use-transaction → Decision flowchart
• servalsheets://examples/transactions → Complete workflow examples
• servalsheets://guides/error-recovery → Rollback patterns

**Commonly Used With:**
→ sheets_confirm (get user approval before committing)
→ sheets_quality (validate before transaction)
→ sheets_history (track transaction operations)
→ sheets_data (batch writes in transaction)`,

  sheets_quality: `Enterprise quality assurance combining validation, conflict detection, and impact analysis (4 actions). Actions: validate, detect_conflicts, resolve_conflict, analyze_impact.

**Quick Examples:**
• Validate data: {"action":"validate","value":"test-value","rules":["not_empty","valid_email"],"context":{"spreadsheetId":"1ABC..."}}
• Detect conflicts: {"action":"detect_conflicts","spreadsheetId":"1ABC...","range":"A1:D10"}
• Resolve conflict: {"action":"resolve_conflict","conflictId":"conflict_123","strategy":"keep_local"}
• Analyze impact: {"action":"analyze_impact","spreadsheetId":"1ABC...","operation":{"type":"data_write","tool":"sheets_data","action":"write","params":{"range":"A1:B10","values":[[1,2]]}}}

**Performance Tips:**
• Validate before sheets_transaction to catch errors early
• Use detect_conflicts for concurrent editing scenarios
• Run analyze_impact before bulk changes to preview effects
• Cache validation results for 60s to avoid repeated checks

**Common Workflows:**
1. Before bulk write → Validate operation, detect conflicts, analyze impact
2. Before transaction → Check conflicts with other users
3. After data import → Validate data quality
4. Before delete → Analyze impact on formulas and charts

**Error Recovery:**
• VALIDATION_FAILED → See detailed errors in response, fix data
• CONFLICT_DETECTED → Use resolve_conflict action with appropriate strategy
• INVALID_RULE → Check supported validation rules
• TOO_COMPLEX → Simplify analysis range for impact analysis

**Commonly Used With:**
→ sheets_transaction (validate and check conflicts before commit)
→ sheets_confirm (show impact before user confirmation)
→ sheets_data (validate data before writes)
→ sheets_collaborate (restore clean version if needed)`,

  sheets_history: `Track and query operation history for debugging and audit trails (7 actions). Actions: list, get, stats, undo, redo, revert_to, clear.

**Quick Examples:**
• List recent: {"action":"list","spreadsheetId":"1ABC...","limit":10}
• Get operation: {"action":"get","spreadsheetId":"1ABC...","operationId":"op_123"}
• Search: {"action":"search","spreadsheetId":"1ABC...","query":"sheets_data","timeRange":"last_hour"}
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
→ sheets_collaborate (correlate with snapshots)
→ sheets_analysis (debug data quality issues)
→ All tools (audit trail for all operations)`,

  sheets_confirm: `⚠️ Request user confirmation before executing multi-step or destructive operations (2 actions). Uses MCP Elicitation (SEP-1036). YOU (Claude) plan → USER confirms via interactive UI → YOU execute. Actions: request, get_stats.

**🔴 WHEN YOU MUST USE THIS (Critical):**
• BEFORE any operation that:
  - Modifies >100 cells
  - Deletes sheets, rows, or columns
  - Changes sharing permissions
  - Executes 3+ operations in sequence
  - Has "high" risk level
  - Is irreversible without manual restore

**❌ DON'T USE FOR:**
• Read-only operations (analysis, queries)
• Single cell edits
• Low-risk operations (<10 cells modified)
• Operations user explicitly said "just do it"

**MCP Elicitation Flow:**
1. YOU build operation plan with steps, risks, impact
2. YOU call sheets_confirm with the plan
3. USER sees interactive form in Claude Desktop:
   ┌─────────────────────────────────────────┐
   │ Plan: Delete Duplicate Rows             │
   │ Risk: HIGH | Affects: 150 rows          │
   │                                         │
   │ Step 1: Identify duplicates (low risk)  │
   │ Step 2: Delete 150 rows (HIGH RISK)    │
   │ Step 3: Update formulas (medium risk)  │
   │                                         │
   │ Snapshot will be created for undo      │
   │                                         │
   │ [✓ Approve] [✎ Modify] [✗ Cancel]      │
   └─────────────────────────────────────────┘
4. USER clicks Approve/Modify/Cancel
5. YOU receive confirmation result
6. IF APPROVED → Execute plan with sheets_transaction
7. IF REJECTED → Abort, no changes made

**Quick Examples:**
{
  "action": "request",
  "plan": {
    "title": "Clean Data Quality Issues",
    "description": "Fix 25 data quality issues found in Sales sheet",
    "steps": [
      {
        "stepNumber": 1,
        "description": "Remove 10 duplicate rows from A2:A100",
        "tool": "sheets_dimensions",
        "action": "delete_rows",
        "risk": "high",
        "estimatedApiCalls": 1,
        "isDestructive": true,
        "canUndo": true
      },
      {
        "stepNumber": 2,
        "description": "Fix 15 empty cells in required columns",
        "tool": "sheets_data",
        "action": "write",
        "risk": "medium",
        "estimatedApiCalls": 1,
        "isDestructive": true,
        "canUndo": true
      }
    ],
    "willCreateSnapshot": true,
    "additionalWarnings": ["This will permanently delete rows"]
  }
}

**Best Practices:**
• ALWAYS show estimated impact (cells, rows, API calls)
• ALWAYS indicate if operation is destructive
• ALWAYS mention snapshot/undo capability
• Be specific in step descriptions (not "update data" but "update 50 cells in column B")
• Include risk level for EACH step (low/medium/high)

**Error Recovery:**
• ELICITATION_UNAVAILABLE → Client doesn't support MCP Elicitation (use dry-run instead)
• USER_REJECTED → User declined, abort operation, explain what was avoided
• USER_MODIFIED → User changed plan, parse modifications and adjust

**📚 Resources:**
• servalsheets://decisions/when-to-confirm → When to request confirmation
• servalsheets://guides/error-recovery → Handling confirmation errors

**Commonly Used With:**
→ sheets_quality (analyze impact before building plan)
→ sheets_transaction (execute approved plan atomically)
→ sheets_analysis (show data quality issues to fix)
→ sheets_history (track confirmed operations for audit)`,

  sheets_fix: `Automatically fix common spreadsheet issues detected by sheets_analysis (1 action). Supports preview mode (see what would be fixed) and apply mode (actually fix). Actions: fix.

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

  //=============================================================================
  // COMPOSITE OPERATIONS
  //=============================================================================

  sheets_composite: `🔄 High-level composite operations that combine multiple API calls (4 actions). Actions: import_csv, smart_append, bulk_update, deduplicate.

**Quick Examples:**
• Import CSV: {"action":"import_csv","spreadsheetId":"1ABC...","sheet":"Sheet1","csvData":"Name,Age\\nAlice,30\\nBob,25","mode":"replace"}
• Smart append: {"action":"smart_append","spreadsheetId":"1ABC...","sheet":"Sheet1","data":[{"Name":"Alice","Age":30}],"matchHeaders":true}
• Bulk update: {"action":"bulk_update","spreadsheetId":"1ABC...","sheet":"Sheet1","updates":[{"Name":"Alice","Age":31}],"keyColumn":"Name"}
• Deduplicate: {"action":"deduplicate","spreadsheetId":"1ABC...","sheet":"Sheet1","columns":["Name","Email"],"keepFirst":true}

**When to use:**
• import_csv: Import CSV data directly into a spreadsheet
• smart_append: Append data with automatic column matching by header
• bulk_update: Update multiple rows by matching a key column
• deduplicate: Remove duplicate rows based on specific columns

**Import CSV Details:**
• Modes: "replace" (clear sheet first), "append" (add to end), "new_sheet" (create new)
• Auto-detects headers if hasHeader:true
• Trims whitespace with trimValues:true
• Skips empty rows with skipEmptyRows:true
• Custom delimiter support (default: comma)

**Smart Append Details:**
• Matches columns by header name automatically
• Creates missing columns if createMissingColumns:true
• Preserves existing data and formatting
• Handles column order differences

**Bulk Update Details:**
• Updates rows by matching keyColumn value
• Only modifies specified columns
• Preserves other column values
• Handles missing key values gracefully

**Deduplicate Details:**
• Removes duplicates based on specified columns
• keepFirst:true keeps first occurrence, false keeps last
• Preserves original row order
• Returns count of rows removed

**Performance Tips:**
• CSV import is optimized for large datasets (10k+ rows)
• Smart append batches column additions
• Bulk update uses range updates, not individual cells
• Deduplicate uses efficient in-memory processing

**Common Workflows:**
1. CSV Import → {"action":"import_csv","mode":"new_sheet"} → Create new sheet with data
2. Data append → {"action":"smart_append","matchHeaders":true} → Add rows with column matching
3. Update records → {"action":"bulk_update","keyColumn":"ID"} → Update by primary key
4. Clean data → {"action":"deduplicate","columns":["Email"]} → Remove duplicate emails

**Error Recovery:**
• CSV_PARSE_ERROR → Check delimiter, ensure valid CSV format
• SHEET_NOT_FOUND → Verify sheet name, use sheets_core to list
• COLUMN_NOT_FOUND → Check column headers match data keys
• KEY_COLUMN_NOT_FOUND → Verify keyColumn exists in sheet headers

**📚 Resources:**
• servalsheets://examples/composite-workflows → Complete import/append/update examples
• servalsheets://guides/quota-optimization → CSV import saves 98% quota
• servalsheets://guides/batching-strategies → When to use composite vs direct

**Commonly Used With:**
→ sheets_data (read data before composite operations)
→ sheets_analysis (validate data quality after import)
→ sheets_core (create/list sheets for operations)
→ sheets_history (track changes from composite operations)`,

  sheets_session: `📋 Session context management for natural language interactions (13 actions). Enables references like "the spreadsheet", "undo that", "continue where we left off". Actions: set_active, get_active, get_context, record_operation, get_last_operation, get_history, find_by_reference, update_preferences, get_preferences, set_pending, get_pending, clear_pending, reset.

**⚡ WHEN TO USE:**
• Track active spreadsheet for natural references ("the spreadsheet")
• Record operations for undo/history support
• Find spreadsheets/operations by natural reference
• Learn user preferences (confirmation level, dry-run defaults)
• Manage multi-step operation state

**Quick Examples:**
• Set active: {"action":"set_active","spreadsheetId":"1ABC...","title":"Budget 2025","sheetNames":["Q1","Q2","Q3","Q4"]}
• Get context: {"action":"get_context"}
• Find by reference: {"action":"find_by_reference","reference":"the budget spreadsheet","type":"spreadsheet"}
• Record operation: {"action":"record_operation","tool":"sheets_data","toolAction":"write","spreadsheetId":"1ABC...","description":"Updated Q1 sales","undoable":true}
• Get last: {"action":"get_last_operation"}
• Get history: {"action":"get_history","limit":10}
• Update preferences: {"action":"update_preferences","confirmationLevel":"destructive"}

**Context Summary:**
The get_context action returns:
• Active spreadsheet with metadata
• Last operation with undo info
• Pending operation state (for multi-step flows)
• Suggested next actions based on context

**Natural Language Support:**
• find_by_reference: Translates "that", "the budget", "last write" to specific IDs
• Maintains recency list for "the spreadsheet" resolution
• Learns naming patterns from user interactions

**Preferences Learned:**
• confirmationLevel: "always" | "destructive" | "never"
• dryRunDefault: true/false
• snapshotDefault: true/false

**Commonly Used With:**
→ All sheets_* tools (records operations automatically)
→ sheets_confirm (respects confirmation preferences)
→ sheets_history (undo via recorded operations)
→ sheets_collaborate (snapshots from recorded operations)`,
};

// Type export for other modules
export type ToolName = keyof typeof TOOL_DESCRIPTIONS;

// Helper to get description with fallback
export function getToolDescription(name: string): string {
  return TOOL_DESCRIPTIONS[name as ToolName] ?? `${name} operations`;
}
