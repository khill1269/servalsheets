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

**Error Recovery:**
• QUOTA_EXCEEDED → Use batch operations (batch_write), wait 60s
• RANGE_NOT_FOUND → Check sheet name with sheets_spreadsheet
• PERMISSION_DENIED → Call sheets_auth action="login"

**Commonly Used With:**
→ sheets_confirm (get approval before >100 cell writes)
→ sheets_transaction (wrap multiple writes atomically)
→ sheets_validation (validate before writing)
→ sheets_analysis (analyze data quality after reading)`,

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

  sheets_dimensions: `⚠️ Manage rows and columns: insert, delete, resize, freeze, group. DELETE OPERATIONS ARE DESTRUCTIVE - always confirm first. Actions: insert_rows, insert_columns, delete_rows, delete_columns, resize, freeze_rows, freeze_columns, auto_resize.

**⚡ WHEN TO USE:**
• Insert rows/columns before bulk data operations
• Delete rows/columns (with confirmation for >10 rows)
• Resize rows/columns for better readability
• Freeze rows/columns for navigation (headers/labels)
• Auto-resize after data import for optimal width
• Group rows/columns for collapsible sections

**❌ DON'T USE FOR:**
• Data modification (use sheets_values)
• Cell formatting (use sheets_format)
• Reading dimensions (use sheets_spreadsheet action="get")

**🔴 CRITICAL: Delete Operations Safety**
• delete_rows/delete_columns are PERMANENT (no built-in undo)
• ALWAYS use sheets_confirm before deleting >10 rows
• ALWAYS enable createSnapshot:true for delete operations
• ALWAYS check dependencies with sheets_impact before delete

**Quick Examples:**
• Insert rows: {"action":"insert_rows","spreadsheetId":"1ABC...","sheetId":0,"startIndex":5,"count":10}
• Delete columns (SAFE): {"action":"delete_columns","spreadsheetId":"1ABC...","sheetId":0,"startIndex":3,"count":2,"safety":{"dryRun":true,"createSnapshot":true}}
• Freeze headers: {"action":"freeze_rows","spreadsheetId":"1ABC...","sheetId":0,"count":1}
• Auto-resize: {"action":"auto_resize","spreadsheetId":"1ABC...","sheetId":0,"dimension":"COLUMNS"}

**🔒 Safety & Undo for Deletes:**
1. DRY-RUN: {"safety":{"dryRun":true}} → See what will be deleted
2. IMPACT CHECK: sheets_impact action="analyze" → Check formula dependencies
3. USER CONFIRM: sheets_confirm → Get approval for >10 rows/columns
4. SNAPSHOT: {"safety":{"createSnapshot":true}} → Create restore point
5. EXECUTE: Remove dryRun flag, delete with snapshot
6. UNDO: sheets_versions action="restore" using snapshotId from response

**Performance Tips:**
• Insert/delete multiple rows in one call instead of looping
• Use auto_resize after bulk data operations for optimal width
• Freeze headers immediately after creating sheet for better UX

**Common Workflows:**
1. Before delete → Check impact with sheets_impact
2. Before delete → Request confirmation with sheets_confirm
3. After import → Auto-resize columns for readability
4. Before adding data → Insert rows/columns to make space
5. For reports → Freeze top row and first column

**Error Recovery:**
• INDEX_OUT_OF_BOUNDS → Verify sheet dimensions with sheets_sheet list
• PROTECTED_DIMENSION → Remove protection first
• TOO_MANY_ROWS → Google Sheets limit is 10M cells per sheet

**Commonly Used With:**
→ sheets_confirm (ALWAYS for delete operations >10 rows)
→ sheets_impact (check dependencies before delete)
→ sheets_versions (create snapshot before delete)
→ sheets_values (insert rows before bulk writes)`,

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

  sheets_analysis: `📊 Analyze structure, data quality, formulas, and statistics (read-only, fast, deterministic). Use THIS tool for traditional analysis. Actions: data_quality, formula_audit, statistics, detect_patterns, column_analysis, suggest_chart.

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
→ sheets_values (fix issues found in analysis)
→ sheets_format (apply conditional formatting based on findings)`,

  sheets_analyze: `🤖 AI-powered data analysis using MCP Sampling (SEP-1577). Use for pattern detection, anomaly detection, formula generation, and chart recommendations. THIS IS THE AI TOOL - use sheets_analysis for traditional analysis.

**🔍 sheets_analyze vs sheets_analysis - WHEN TO USE WHICH:**

**Use sheets_analyze (THIS TOOL - AI) for:**
✅ Pattern detection (AI finds non-obvious trends in time series, sales, etc.)
✅ Anomaly detection (AI explains WHY outliers are interesting)
✅ Formula generation (natural language → Google Sheets formula)
✅ Chart recommendations (AI suggests best visualization types)
✅ Novel insights (AI explains what's interesting about the data)
✅ Complex interpretation (requires reasoning about business context)

**Use sheets_analysis (traditional tool) for:**
✅ Fast, deterministic checks (<1 second, no LLM cost)
✅ Data quality issues (empty cells, duplicates)
✅ Formula errors (#REF!, #DIV/0!)
✅ Simple statistics (mean, median, std dev)

**Decision Tree:**
1. Need AI reasoning/insights? → sheets_analyze
2. Need to generate formulas from natural language? → sheets_analyze
3. Need basic stats or known issues? → sheets_analysis
4. Workflow: ALWAYS start with sheets_analysis (fast), THEN sheets_analyze for deeper insights

**Quick Examples:**
• Full analysis: {"action":"analyze","spreadsheetId":"1ABC...","range":"Sales!A1:F100","analysisTypes":["patterns","anomalies","trends"]}
• Generate formula: {"action":"generate_formula","spreadsheetId":"1ABC...","description":"Calculate YoY growth percentage comparing this year (column B) to last year (column C)","range":"Data!A1:C100"}
• Suggest chart: {"action":"suggest_chart","spreadsheetId":"1ABC...","range":"A1:D20","goal":"show revenue trends over time"}

**What AI Provides:**
• analyze: Patterns (trends, correlations, seasonality), anomalies (outliers with context), data quality issues with suggested fixes, overall quality score (0-100)
• generate_formula: Google Sheets formula from natural language, explanation of how it works, alternative formulas, assumptions, tips
• suggest_chart: Best chart types ranked by suitability, configuration (axes, series), reasoning for each suggestion

**Performance Tips:**
• Uses MCP Sampling - requires client support (Claude Desktop supports it)
• Limit to <5000 cells for fast responses (<3 seconds)
• Specify analysisTypes to reduce processing time
• More expensive than sheets_analysis (uses LLM tokens)
• Response time: 2-5 seconds depending on data size

**Common Workflows:**
1. ALWAYS start: sheets_analysis (fast checks)
2. IF need insights: sheets_analyze (AI reasoning)
3. Example: "Analyze this data" → sheets_analysis first, then sheets_analyze if user wants deeper insights

**Error Recovery:**
• SAMPLING_UNAVAILABLE → Client doesn't support MCP Sampling (use sheets_analysis instead)
• RANGE_TOO_LARGE → Reduce to <5000 cells (sample if needed)
• PARSE_ERROR → AI response format invalid, retry with clearer context

**Commonly Used With:**
→ sheets_analysis (run BEFORE sheets_analyze for baseline)
→ sheets_charts (create AI-suggested charts)
→ sheets_values (apply generated formulas)
→ sheets_confirm (confirm AI suggestions before applying)`,

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

  sheets_transaction: `Execute multiple operations atomically with rollback support. ALWAYS use for 2+ operations on the same spreadsheet. Actions: begin, queue, commit, rollback, status.

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
• Queue: {"action":"queue","transactionId":"tx_123","operation":{"tool":"sheets_values","action":"write","params":{...}}}
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

**Commonly Used With:**
→ sheets_confirm (get user approval before committing)
→ sheets_validation (validate before transaction)
→ sheets_history (track transaction operations)
→ sheets_values (batch writes in transaction)`,

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

  sheets_confirm: `⚠️ Request user confirmation before executing multi-step or destructive operations. Uses MCP Elicitation (SEP-1036). YOU (Claude) plan → USER confirms via interactive UI → YOU execute.

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
        "tool": "sheets_values",
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

**Commonly Used With:**
→ sheets_impact (analyze impact before building plan)
→ sheets_transaction (execute approved plan atomically)
→ sheets_analysis (show data quality issues to fix)
→ sheets_history (track confirmed operations for audit)`,

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

  //=============================================================================
  // COMPOSITE OPERATIONS
  //=============================================================================

  sheets_composite: `🔄 High-level composite operations that combine multiple API calls. Actions: import_csv, smart_append, bulk_update, deduplicate.

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
• SHEET_NOT_FOUND → Verify sheet name, use sheets_sheet to list
• COLUMN_NOT_FOUND → Check column headers match data keys
• KEY_COLUMN_NOT_FOUND → Verify keyColumn exists in sheet headers

**Commonly Used With:**
→ sheets_values (read data before composite operations)
→ sheets_analysis (validate data quality after import)
→ sheets_sheet (create/list sheets for operations)
→ sheets_history (track changes from composite operations)`,
};

// Type export for other modules
export type ToolName = keyof typeof TOOL_DESCRIPTIONS;

// Helper to get description with fallback
export function getToolDescription(name: string): string {
  return TOOL_DESCRIPTIONS[name as ToolName] ?? `${name} operations`;
}
