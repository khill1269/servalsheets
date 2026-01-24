/**
 * ServalSheets - LLM-Optimized Tool Descriptions
 *
 * Routing-focused descriptions that help Claude select the right tool:
 * 1. **ROUTING** - When to pick this tool
 * 2. **NOT this tool** - Cross-references to alternatives
 * 3. **ACTIONS BY CATEGORY** - Grouped for quick scanning
 * 4. **TOP 3 ACTIONS** - Most common usage patterns
 * 5. **SAFETY** - Destructive operation warnings
 *
 * Total: 19 tools, 253 actions
 *
 * PREREQUISITES documented for each tool to prevent wrong-order calls.
 */

export const TOOL_DESCRIPTIONS: Record<string, string> = {
  //=============================================================================
  // AUTHENTICATION
  //=============================================================================

  sheets_auth: `🔐 AUTH - OAuth 2.1 authentication (4 actions).

**ROUTING - Pick this tool when:**
> Checking if authenticated or need to log in/out

**NOT this tool:** All other operations require auth first

**ACTIONS:** status, login, callback, logout

**WORKFLOW:**
1. status -> Check auth state
2. login -> Get OAuth URL (if not authenticated)
3. callback -> Complete OAuth with code
4. logout -> Clear tokens

**ALWAYS START HERE:** Call status before any other sheets_* tool.`,

  //=============================================================================
  // CORE DATA OPERATIONS
  //=============================================================================

  sheets_core: `📋 CORE - Spreadsheet & sheet management (17 actions).

**PREREQUISITES:** sheets_auth action:"status" must show authenticated:true

**ROUTING - Pick this tool when:**
> Creating, copying, or managing spreadsheets/sheets
> Getting spreadsheet metadata or URLs
> Adding/deleting/renaming sheets (tabs)

**NOT this tool - use instead:**
> sheets_data - Reading/writing CELL DATA
> sheets_analyze - Getting metadata + data + analysis together
> sheets_format - Changing cell APPEARANCE

**COST (API calls/latency):**
- get/list_sheets: 1 call, ~150-300ms (cached 5min)
- batch_get: 1 call for multiple spreadsheets (preferred!)
- get_comprehensive: 1 call, ~500ms (includes all sheet data)
- create: 1 call, ~300-500ms

**ACTIONS BY CATEGORY:**
[Spreadsheet] get, create, copy, update_properties, get_url, batch_get, get_comprehensive, list
[Sheet/Tab] add_sheet, delete_sheet, duplicate_sheet, update_sheet, copy_sheet_to, list_sheets, get_sheet (supports sheetId OR sheetName)

**TOP 3 ACTIONS:**
1. create: {"action":"create","title":"My Sheet"} - New spreadsheet
2. get: {"action":"get","spreadsheetId":"1ABC..."} - Get metadata
3. add_sheet: {"action":"add_sheet","spreadsheetId":"1ABC...","title":"Q1"} - Add tab

**TIP:** For analysis, use sheets_analyze action="comprehensive" - gets metadata + data + analysis in ONE call!`,

  sheets_data: `📝 DATA - Cell values, notes, validation, hyperlinks (20 actions).

**PREREQUISITES:** sheets_auth must be authenticated. Optional: sheets_session action:"set_active" to enable natural language ranges.

**ROUTING - Pick this tool when:**
> Reading or writing cell VALUES
> Appending rows to a sheet
> Adding notes, hyperlinks, or validation to cells
> Merging cells or using clipboard operations
> Finding/replacing text

**NOT this tool - use instead:**
> sheets_format - Changing cell COLORS, FONTS, BORDERS
> sheets_dimensions - Inserting/deleting ROWS or COLUMNS
> sheets_analyze - ANALYZING data patterns

**COST COMPARISON (Quick Win #3 - Choose wisely!):**
┌─────────────────────────────────────────────────────────────────┐
│ EXAMPLE: Reading 5 ranges from a spreadsheet                   │
├─────────────────────────────────────────────────────────────────┤
│ ❌ BAD:  read x5 = 5 API calls, ~1000ms (200ms each)           │
│ ✅ GOOD: batch_read = 1 API call, ~250ms (80% savings!)        │
└─────────────────────────────────────────────────────────────────┘
- Single operations: 1 call per range (~200-400ms each)
- batch_read/batch_write: 1 call for up to 100 ranges (same latency!)
- **ALWAYS use batch_* when working with 2+ ranges**
- 10 ranges: Single=10 calls (2000ms), Batch=1 call (250ms) = 87% faster

**ACTIONS BY CATEGORY:**
[Read] read, batch_read
[Write] write, append, batch_write
[Clear] clear, batch_clear
[Find] find_replace
[Notes] add_note, get_note, clear_note
[Validation] set_validation, clear_validation
[Links] set_hyperlink, clear_hyperlink
[Merge] merge_cells, unmerge_cells, get_merges
[Clipboard] cut_paste, copy_paste

**TOP 3 ACTIONS:**
1. read: {"action":"read","spreadsheetId":"1ABC...","range":"Sheet1!A1:D10"}
2. write: {"action":"write","spreadsheetId":"1ABC...","range":"Sheet1!A1","values":[["Hello"]]}
3. append: {"action":"append","spreadsheetId":"1ABC...","range":"Sheet1","values":[["New","Row"]]}

**RANGE FORMAT:** Always include sheet name! Use "Sheet1!A1:D10" NOT just "A1:D10". Sheet names are CASE-SENSITIVE. If sheet has spaces: "'My Sheet'!A1:D10"

**SAFETY:** write/clear are destructive. Use dryRun:true to preview. Use sheets_confirm for >100 cells.`,

  //=============================================================================
  // FORMATTING & STYLING
  //=============================================================================

  sheets_format: `🎨 FORMAT - Cell styling, sparklines & conditional rules (21 actions).

**PREREQUISITES:** sheets_auth must be authenticated.

**ROUTING - Pick this tool when:**
> Changing cell COLORS, FONTS, BORDERS, ALIGNMENT
> Applying number formats (currency, dates, percentages)
> Creating conditional formatting rules (color scales, data bars)
> Adding data validation dropdowns
> Creating sparkline visualizations in cells

**NOT this tool - use instead:**
> sheets_data - Changing cell VALUES
> sheets_dimensions - Changing row/column SIZE
> sheets_advanced - Creating NAMED RANGES

**COST COMPARISON (Quick Win #3):**
┌─────────────────────────────────────────────────────────────────┐
│ EXAMPLE: Formatting header + 3 columns                         │
├─────────────────────────────────────────────────────────────────┤
│ ❌ BAD:  set_format x4 = 4 API calls, ~800ms                   │
│ ✅ GOOD: apply_preset = 1 API call, ~250ms (68% savings!)      │
└─────────────────────────────────────────────────────────────────┘
- apply_preset: Common formats in 1 call (header, currency, percentage, etc.)
- set_format: Custom format, 1 call per range (~200ms)
- **TIP:** Use presets when possible, batch custom formats in one request

**ACTIONS BY CATEGORY:**
[Style] set_format, set_background, set_text_format, set_number_format, set_alignment, set_borders
[Helpers] suggest_format, clear_format, apply_preset, auto_fit
[Conditional] rule_add_conditional_format, rule_update_conditional_format, rule_delete_conditional_format, rule_list_conditional_formats, add_conditional_format_rule
[Validation] set_data_validation, clear_data_validation, list_data_validations

**TOP 3 ACTIONS:**
1. set_format: {"action":"set_format","spreadsheetId":"1ABC...","range":"Sheet1!A1:D1","format":{"textFormat":{"bold":true},"backgroundColor":"#4285F4"}}
2. set_number_format: {"action":"set_number_format","spreadsheetId":"1ABC...","range":"Sheet1!B:B","numberFormat":{"type":"CURRENCY","pattern":"$#,##0.00"}}

**RANGE FORMAT:** Always include sheet name! "Sheet1!A1:D10" not "A1:D10". Case-sensitive.
3. add_conditional_format_rule: {"action":"add_conditional_format_rule","spreadsheetId":"1ABC...","sheetId":0,"range":"A1:A100","rulePreset":"color_scale_green_red"}`,

  //=============================================================================
  // DIMENSIONS & STRUCTURE
  //=============================================================================

  sheets_dimensions: `📐 DIMENSIONS - Rows, columns, filters, sorting (29 actions).

**PREREQUISITES:** sheets_auth must be authenticated.

**ROUTING - Pick this tool when:**
> Inserting or deleting ROWS or COLUMNS
> Resizing, hiding, freezing rows/columns
> Grouping rows/columns (collapsible sections)
> Filtering or sorting data
> Creating filter views or slicers

**NOT this tool - use instead:**
> sheets_data - Changing cell VALUES
> sheets_format - Changing cell APPEARANCE
> sheets_core - Deleting entire SHEETS

**COST COMPARISON (Quick Win #3):**
┌─────────────────────────────────────────────────────────────────┐
│ EXAMPLE: Insert 3 rows + hide 2 columns + freeze row 1         │
├─────────────────────────────────────────────────────────────────┤
│ ❌ BAD:  3 separate calls = 3 API calls, ~600ms                │
│ ✅ GOOD: Combined batch = 1 API call, ~250ms (58% savings!)    │
└─────────────────────────────────────────────────────────────────┘
- Single operations: 1 call each (~200ms)
- Multiple dimension changes: Combine in 1 request when possible
- **TIP:** Plan your row/column operations and batch them together

**CONSOLIDATED ACTIONS (use dimension parameter):**
All row/column operations use dimension:"ROWS" or dimension:"COLUMNS":
[Insert/Append] insert, append - add rows or columns
[Delete] delete - remove rows or columns (DESTRUCTIVE)
[Move] move - relocate rows or columns
[Resize] resize, auto_resize - change size
[Visibility] hide, show - toggle visibility
[Freeze] freeze - freeze from top/left
[Group] group, ungroup - collapsible sections

**OTHER ACTIONS:**
[Basic Filter] set_basic_filter, clear_basic_filter, get_basic_filter, filter_update_filter_criteria
[Filter Views] create_filter_view, update_filter_view, delete_filter_view, list_filter_views, get_filter_view
[Sort] sort_range
[Range Utils] trim_whitespace, randomize_range, text_to_columns, auto_fill
[Slicers] create_slicer, update_slicer, delete_slicer, list_slicers

**TOP 3 ACTIONS:**
1. insert: {"action":"insert","spreadsheetId":"1ABC...","sheetId":0,"dimension":"ROWS","startIndex":5,"count":10}
2. freeze: {"action":"freeze","spreadsheetId":"1ABC...","sheetId":0,"dimension":"ROWS","count":1}
3. sort_range: {"action":"sort_range","spreadsheetId":"1ABC...","range":"Sheet1!A1:D100","sortSpecs":[{"columnIndex":0,"sortOrder":"DESCENDING"}]}

**SHEETID NOTE:** Get sheetId from sheets_core action:"list_sheets". IDs are numeric (0, 123456789, etc.) and change when sheets are recreated. Do NOT guess IDs.

**SAFETY:** delete is PERMANENT. Always use sheets_confirm for >10 rows/columns.`,

  //=============================================================================
  // VISUALIZATION
  //=============================================================================

  sheets_visualize: `📊 VISUALIZE - Charts, trendlines & pivot tables (18 actions).

**PREREQUISITES:** sheets_auth must be authenticated. Recommended: Use sheets_analyze action:"suggest_chart" first.

**ROUTING - Pick this tool when:**
> Creating charts (bar, line, pie, scatter, etc.)
> Creating pivot tables for aggregation
> Updating, moving, or deleting visualizations

**NOT this tool - use instead:**
> sheets_analyze - Getting chart RECOMMENDATIONS first
> sheets_data - Reading the DATA to visualize
> sheets_format - Styling the SOURCE data

**ACTIONS BY CATEGORY:**
[Charts] chart_create, chart_update, chart_delete, chart_list, chart_get, chart_move, chart_resize, chart_update_data_range, suggest_chart
[Pivots] pivot_create, pivot_update, pivot_delete, pivot_list, pivot_get, pivot_refresh, suggest_pivot

**TOP 3 ACTIONS:**
1. chart_create: {"action":"chart_create","spreadsheetId":"1ABC...","sheetId":0,"chartType":"LINE","data":{"sourceRange":"Sheet1!A1:B10"},"position":{"anchorCell":"Sheet1!E2"},"options":{"title":"Sales Trend"}}
2. pivot_create: {"action":"pivot_create","spreadsheetId":"1ABC...","sourceRange":"Sheet1!A1:D100","rows":[{"sourceColumnOffset":0}],"values":[{"sourceColumnOffset":3,"summarizeFunction":"SUM"}]}
3. suggest_chart: {"action":"suggest_chart","spreadsheetId":"1ABC...","range":"Sheet1!A1:D100"}

**POSITION FORMAT:** anchorCell MUST include sheet name: "Sheet1!E2" not just "E2"

**CHART CONSTRAINTS:**
- BAR charts: series target BOTTOM_AXIS only (horizontal bars)
- COLUMN charts: series target LEFT_AXIS (vertical bars)
- Use sheetId from sheets_core action:"list_sheets" (IDs change when sheets are recreated)

**TIP:** Use suggest_chart or suggest_pivot first to get AI recommendations.`,

  //=============================================================================
  // COLLABORATION
  //=============================================================================

  sheets_collaborate: `👥 COLLABORATE - Sharing, comments, versions (28 actions).

**PREREQUISITES:** sheets_auth must be authenticated. Recommended: sheets_collaborate action:"version_create_snapshot" before destructive operations.

**ROUTING - Pick this tool when:**
> Sharing a spreadsheet with users/groups
> Adding, replying to, or resolving comments
> Creating snapshots (backup points)
> Viewing or restoring previous versions

**NOT this tool - use instead:**
> sheets_advanced - PROTECTING specific ranges
> sheets_history - Viewing OPERATION history (not file versions)

**ACTIONS BY CATEGORY:**
[Sharing] share_add, share_update, share_remove, share_list, share_get, share_transfer_ownership, share_set_link, share_get_link
[Comments] comment_add, comment_update, comment_delete, comment_list, comment_get, comment_resolve, comment_reopen, comment_add_reply, comment_update_reply, comment_delete_reply
[Versions] version_list_revisions, version_get_revision, version_restore_revision, version_keep_revision, version_create_snapshot, version_list_snapshots, version_restore_snapshot, version_delete_snapshot, version_compare, version_export

**TOP 3 ACTIONS:**
1. share_add: {"action":"share_add","spreadsheetId":"1ABC...","email":"user@example.com","role":"writer"}
2. comment_add: {"action":"comment_add","spreadsheetId":"1ABC...","range":"A1","content":"Please verify this"}
3. version_create_snapshot: {"action":"version_create_snapshot","spreadsheetId":"1ABC...","description":"Before cleanup"}

**TIP:** Always create a snapshot before destructive operations!`,

  //=============================================================================
  // ANALYSIS & INTELLIGENCE
  //=============================================================================

  sheets_analyze: `🤖 ANALYZE - AI-powered analysis (11 actions). START HERE for understanding data.

**PREREQUISITES:** sheets_auth must be authenticated. No other prerequisites - this tool is designed to be your FIRST call after auth.

**ROUTING - Pick this tool when:**
> You want to UNDERSTAND a spreadsheet (structure, quality, patterns)
> You need AI to suggest charts, formulas, or insights
> You want comprehensive analysis in ONE call
> You need natural language queries about data

**NOT this tool - use instead:**
> sheets_data - After analysis, to WRITE changes
> sheets_visualize - After analysis, to CREATE suggested charts
> sheets_fix - After analysis, to FIX detected issues

**COST COMPARISON (Quick Win #3 - Maximum efficiency!):**
┌─────────────────────────────────────────────────────────────────┐
│ EXAMPLE: Understanding a new spreadsheet                       │
├─────────────────────────────────────────────────────────────────┤
│ ❌ BAD:  get + list_sheets + read + analyze_quality + ...      │
│         = 6 API calls, ~3000ms                                  │
│ ✅ GOOD: comprehensive = 1-2 calls, ~800ms (73% savings!)      │
└─────────────────────────────────────────────────────────────────┘
- comprehensive: 1-2 calls, 500ms-2s (gets metadata + data + analysis)
- analyze_data: 1 call (~500ms traditional), 2-3 calls (3-15s AI-powered)
- Individual tools: 5-6 separate calls, cumulative latency
- **ALWAYS start with 'comprehensive' for new spreadsheets**

**ACTIONS BY CATEGORY:**
[Comprehensive] comprehensive (RECOMMENDED - gets EVERYTHING in 1 call)
[Specific Analysis] analyze_data, analyze_structure, analyze_quality, analyze_performance, analyze_formulas
[AI Generation] suggest_visualization, generate_formula, detect_patterns
[Natural Language] query_natural_language, explain_analysis

**START HERE:**
comprehensive: {"action":"comprehensive","spreadsheetId":"1ABC..."}
Returns: metadata + data sample + quality issues + patterns + chart recommendations + formula analysis

**WORKFLOW:**
1. sheets_analyze comprehensive -> Understand the spreadsheet (1 call)
2. sheets_visualize -> Create recommended charts
3. sheets_fix -> Fix detected issues
4. sheets_data -> Apply generated formulas`,

  //=============================================================================
  // ADVANCED FEATURES
  //=============================================================================

  sheets_advanced: `⚙️ ADVANCED - Named ranges, protection, metadata, banding, tables (19 actions).

**PREREQUISITES:** sheets_auth must be authenticated.

**ROUTING - Pick this tool when:**
> Creating or managing NAMED RANGES
> PROTECTING cells from editing
> Adding alternating row colors (BANDING)
> Managing developer METADATA
> Creating structured TABLES

**NOT this tool - use instead:**
> sheets_data - Writing VALUES to cells
> sheets_format - Basic FORMATTING (colors, fonts)
> sheets_collaborate - SHARING permissions (not cell protection)

**ACTIONS BY CATEGORY:**
[Named Ranges] add_named_range, update_named_range, delete_named_range, list_named_ranges, get_named_range
[Protection] add_protected_range, update_protected_range, delete_protected_range, list_protected_ranges
[Metadata] set_metadata, get_metadata, delete_metadata
[Banding] add_banding, update_banding, delete_banding, list_banding
[Tables] create_table, delete_table, list_tables

**TOP 3 ACTIONS:**
1. add_named_range: {"action":"add_named_range","spreadsheetId":"1ABC...","name":"Revenue","range":"B2:B100"}
2. add_protected_range: {"action":"add_protected_range","spreadsheetId":"1ABC...","range":"A1:D1","editors":{"users":["admin@example.com"]}}
3. create_table: {"action":"create_table","spreadsheetId":"1ABC...","range":"A1:D100"}

**TIP:** Tables use Sheets API v4 table objects for structured ranges.`,

  //=============================================================================
  // ENTERPRISE / SAFETY
  //=============================================================================

  sheets_transaction: `🔄 TRANSACTION - Atomic batch operations (6 actions).

**PREREQUISITES:** sheets_auth must be authenticated. Recommended: sheets_quality action:"analyze_impact" for large operations.

**ROUTING - Pick this tool when:**
> You need 2+ operations to succeed or fail TOGETHER
> Bulk imports/updates (>50 rows)
> Operations that must be REVERSIBLE
> You want to SAVE API QUOTA (80-95% savings)

**NOT this tool - use instead:**
> Direct tool calls for SINGLE operations
> sheets_composite for high-level operations (import_csv, smart_append)

**COST COMPARISON (Quick Win #3 - Massive savings!):**
┌─────────────────────────────────────────────────────────────────┐
│ EXAMPLE: Bulk update 100 rows with different values            │
├─────────────────────────────────────────────────────────────────┤
│ ❌ BAD:  sheets_data.write x100 = 100 calls, 20-40 seconds     │
│ ✅ GOOD: transaction = 1 call, ~800ms (95% savings!)           │
└─────────────────────────────────────────────────────────────────┘
- Without transaction: N operations = N API calls (20-40 seconds for 100)
- With transaction: N operations = 1 API call (~500ms-1s)
- **Savings: 80-95% fewer API calls, 10-20x faster**
- **RULE: Always use transactions for 5+ operations or 50+ cells!**

**ACTIONS:** begin, queue, commit, rollback, status, list

**WORKFLOW:**
1. begin: {"action":"begin","spreadsheetId":"1ABC..."} -> Get transactionId
2. queue: {"action":"queue","transactionId":"tx_123","operation":{...}} -> Add operations
3. commit: {"action":"commit","transactionId":"tx_123"} -> Execute ALL atomically
4. (On error) rollback: {"action":"rollback","transactionId":"tx_123"}

**RULE:** Always use transactions for 5+ operations or 50+ cells!`,

  sheets_quality: `✅ QUALITY - Data validation & conflict detection (4 actions).

**PREREQUISITES:** sheets_auth must be authenticated. Use BEFORE sheets_data/sheets_transaction writes.

**ROUTING - Pick this tool when:**
> VALIDATING data before writing (email formats, required fields)
> Detecting CONFLICTS from concurrent edits
> Analyzing IMPACT of an operation before executing

**NOT this tool - use instead:**
> sheets_analyze - For data QUALITY ANALYSIS (patterns, issues)
> sheets_format - For VALIDATION RULES on cells (dropdowns)
> sheets_data - For WRITING the data after validation

**ACTIONS:** validate, detect_conflicts, resolve_conflict, analyze_impact

**TOP 3 ACTIONS:**
1. validate: {"action":"validate","value":"test@email.com","rules":["not_empty","valid_email"]}
2. analyze_impact: {"action":"analyze_impact","spreadsheetId":"1ABC...","operation":{"type":"delete_rows","range":"A1:A10"}}
3. detect_conflicts: {"action":"detect_conflicts","spreadsheetId":"1ABC..."}

**USE BEFORE:** Large writes, deletes, or concurrent editing scenarios.`,

  sheets_history: `📜 HISTORY - Operation audit & undo/redo (7 actions).

**PREREQUISITES:** sheets_auth must be authenticated. History is populated by previous tool calls in this session.

**ROUTING - Pick this tool when:**
> Viewing what operations were performed
> UNDOING a recent operation
> Getting operation STATISTICS

**NOT this tool - use instead:**
> sheets_collaborate - For FILE version history (Google revisions)
> sheets_session - For CONVERSATION context

**ACTIONS:** list, get, stats, undo, redo, revert_to, clear

**TOP 3 ACTIONS:**
1. list: {"action":"list","spreadsheetId":"1ABC...","limit":10}
2. undo: {"action":"undo","spreadsheetId":"1ABC..."}
3. revert_to: {"action":"revert_to","spreadsheetId":"1ABC...","operationId":"op_123"}

**LIMITS:** Tracks last 100 operations per spreadsheet.`,

  sheets_confirm: `⚠️ CONFIRM - User confirmation before destructive operations (2 actions).

**PREREQUISITES:** sheets_auth must be authenticated. Use AFTER planning but BEFORE executing destructive operations.

**ROUTING - Pick this tool when:**
> You've PLANNED a multi-step operation and need user approval
> The operation is DESTRUCTIVE (deletes, overwrites >100 cells)
> The operation has HIGH RISK (irreversible, affects formulas)
> You want the user to review steps BEFORE execution

**NOT this tool - use instead:**
> Direct tool calls for SINGLE low-risk operations
> sheets_quality analyze_impact - To check impact BEFORE building a plan

**HOW IT WORKS (MCP Elicitation SEP-1036):**
1. Claude builds a plan with steps, risks, estimates
2. sheets_confirm.request presents the plan to the user
3. User sees interactive UI in Claude Desktop/client
4. User approves/modifies/declines
5. Claude receives result and acts accordingly

**ACTIONS:** request, get_stats

**WORKFLOW:**
1. Build your plan:
   {
     "action": "request",
     "plan": {
       "title": "Delete Duplicate Rows",
       "description": "Remove 150 duplicate rows from Sales sheet",
       "steps": [
         {"stepNumber":1, "description":"Identify duplicates", "tool":"sheets_analyze", "action":"comprehensive", "risk":"low"},
         {"stepNumber":2, "description":"Delete 150 rows", "tool":"sheets_dimensions", "action":"delete_rows", "risk":"high", "isDestructive":true}
       ],
       "willCreateSnapshot": true,
       "additionalWarnings": ["This cannot be undone without the snapshot"]
     }
   }

2. Check result:
   - If approved: Execute the plan using sheets_transaction
   - If declined: Explain what was avoided, ask for alternatives
   - If modified: Parse modifications, adjust plan, re-confirm if needed

**WHEN TO USE:**
- delete_rows/delete_columns affecting >10 rows
- write/batch_write affecting >100 cells
- share_transfer_ownership (irreversible)
- Any operation chain with 3+ steps
- Operations the user hasn't explicitly approved

**TIP:** Always include risk levels and isDestructive flags for each step.`,

  sheets_fix: `🔧 FIX - Automated issue resolution (1 action).

**PREREQUISITES:** sheets_auth must be authenticated. REQUIRED: sheets_analyze action:"comprehensive" first to detect issues.

**ROUTING - Pick this tool when:**
> sheets_analyze found issues you want to AUTO-FIX
> Fixing common problems: volatile formulas, missing freezes, no protection

**NOT this tool - use instead:**
> sheets_analyze - First, to DETECT issues
> sheets_data/sheets_format - For MANUAL fixes

**ACTION:** fix

**WORKFLOW:**
1. sheets_analyze comprehensive -> Get issues list
2. sheets_fix preview: {"action":"fix","spreadsheetId":"1ABC...","issues":[...],"mode":"preview"}
3. Review proposed fixes
4. sheets_fix apply: {"action":"fix","spreadsheetId":"1ABC...","issues":[...],"mode":"apply","safety":{"createSnapshot":true}}

**FIXABLE ISSUES:** MULTIPLE_TODAY, FULL_COLUMN_REFS, NO_FROZEN_HEADERS, NO_PROTECTION, NESTED_IFERROR, EXCESSIVE_CF_RULES`,

  //=============================================================================
  // COMPOSITE OPERATIONS
  //=============================================================================

  sheets_composite: `🔗 COMPOSITE - High-level data operations (10 actions).

**PREREQUISITES:** sheets_auth must be authenticated.

**ROUTING - Pick this tool when:**
> Setting up a new sheet with headers + formatting in ONE call
> Importing CSV data with auto-formatting
> Appending data with automatic COLUMN MATCHING
> Bulk updating rows by a KEY column
> Cloning sheet structure without data
> Removing DUPLICATE rows
> Exporting/importing XLSX files
> Reading Google Forms responses

**NOT this tool - use instead:**
> sheets_data - For simple read/write/append
> sheets_transaction - For custom multi-step operations

**LLM-OPTIMIZED WORKFLOW ACTIONS (save 60-80% API calls):**
- setup_sheet: Create sheet + headers + formatting + freeze in ONE call
- import_and_format: Import CSV + apply header formatting + auto-resize
- clone_structure: Copy sheet structure (headers, formats) without data

**COST (vs manual alternatives):**
- setup_sheet: 2-3 calls vs 5-7 manual calls (70% savings!)
- import_and_format: 2 calls vs 4-5 manual calls (60% savings!)
- clone_structure: 2 calls vs 5-6 manual calls (65% savings!)
- import_csv: 1-2 calls (~500ms) vs parsing manually (~5 calls)
- smart_append: 2 calls (reads headers + appends) vs ~4 manual calls
- deduplicate: 2-3 calls vs complex manual loop

**ACTIONS:** import_csv, smart_append, bulk_update, deduplicate, export_xlsx, import_xlsx, get_form_responses, setup_sheet, import_and_format, clone_structure

**TOP 3 ACTIONS:**
1. setup_sheet: {"action":"setup_sheet","spreadsheetId":"1ABC...","sheetName":"Q1 Data","headers":["Date","Amount","Category"],"freezeHeaderRow":true}
2. import_and_format: {"action":"import_and_format","spreadsheetId":"1ABC...","csvData":"Name,Age\\nAlice,30","headerFormat":{"bold":true},"autoResizeColumns":true}
3. smart_append: {"action":"smart_append","spreadsheetId":"1ABC...","sheet":"Sheet1","data":[{"Name":"Alice","Age":30}],"matchHeaders":true}

**BENEFIT:** Workflow actions combine multiple operations, reducing latency and API calls.`,

  //=============================================================================
  // SESSION CONTEXT
  //=============================================================================

  sheets_session: `📋 SESSION - Conversation context for natural language (13 actions).

**PREREQUISITES:** sheets_auth must be authenticated. Call action:"set_active" EARLY to enable natural language references.

**ROUTING - Pick this tool when:**
> Setting the "active" spreadsheet for natural references
> Recording operations for undo support
> Resolving references like "the spreadsheet", "that sheet", "undo that"
> Storing user preferences

**NOT this tool - use instead:**
> sheets_history - For OPERATION AUDIT trail
> sheets_collaborate - For FILE versions

**ACTIONS BY CATEGORY:**
[Context] set_active, get_active, get_context
[History] record_operation, get_last_operation, get_history
[References] find_by_reference
[Preferences] update_preferences, get_preferences
[Pending] set_pending, get_pending, clear_pending
[Reset] reset

**TOP 3 ACTIONS:**
1. set_active: {"action":"set_active","spreadsheetId":"1ABC...","title":"Budget 2025"}
2. get_context: {"action":"get_context"} -> Returns active spreadsheet, last operation, pending ops
3. find_by_reference: {"action":"find_by_reference","reference":"the budget spreadsheet","type":"spreadsheet"}

**ENABLES:** "Update the budget" -> Resolves to the active spreadsheet automatically.`,

  //=============================================================================
  // ENTERPRISE TIER 7
  //=============================================================================

  sheets_templates: `📄 TEMPLATES - Reusable spreadsheet templates (8 actions).

**PREREQUISITES:** sheets_auth must be authenticated.

**ROUTING - Pick this tool when:**
> Creating a new spreadsheet from a TEMPLATE
> Saving a spreadsheet AS a template for reuse
> Managing your template library
> Using builtin templates from knowledge base

**NOT this tool - use instead:**
> sheets_core - For CREATING spreadsheets without templates
> sheets_collaborate version_* - For FILE snapshots/backups

**ACTIONS BY CATEGORY:**
[List] list (with optional category filter, includeBuiltin)
[CRUD] get, create, update, delete
[Use] apply (create spreadsheet from template), preview
[Import] import_builtin (from knowledge base)

**TOP 3 ACTIONS:**
1. list: {"action":"list","includeBuiltin":true} -> See all templates
2. apply: {"action":"apply","templateId":"budget-2024","title":"Q1 Budget"} -> Create from template
3. create: {"action":"create","spreadsheetId":"1ABC...","name":"My Budget Template"} -> Save as template

**STORAGE:** Templates are stored in your Google Drive appDataFolder (hidden, private, auto-cleanup on uninstall).

**TIP:** Use import_builtin to import pre-built templates from ServalSheets knowledge base.`,

  sheets_bigquery: `📊 BIGQUERY - Connected Sheets integration (12 actions).

**PREREQUISITES:** sheets_auth must be authenticated. BigQuery API must be enabled in GCP project. OAuth scopes: bigquery.readonly or bigquery.

**ROUTING - Pick this tool when:**
> Connecting Google Sheets to BigQuery data sources
> Running SQL queries on BigQuery from Sheets
> Exploring BigQuery datasets and table schemas
> Exporting sheet data TO BigQuery tables
> Importing BigQuery results INTO sheets

**NOT this tool - use instead:**
> sheets_data - For regular read/write within the spreadsheet
> sheets_visualize - For creating charts from sheet data

**ACTIONS BY CATEGORY:**
[Connection] connect, disconnect, list_connections, get_connection
[Query] query (run SQL), preview (test without full execution), refresh (update data)
[Discovery] list_datasets, list_tables, get_table_schema
[Transfer] export_to_bigquery, import_from_bigquery

**TOP 3 ACTIONS:**
1. query: {"action":"query","projectId":"my-project","query":"SELECT * FROM dataset.table LIMIT 100"} -> Run SQL query
2. list_tables: {"action":"list_tables","projectId":"my-project","datasetId":"my_dataset"} -> Explore dataset
3. import_from_bigquery: {"action":"import_from_bigquery","spreadsheetId":"1ABC...","projectId":"my-project","query":"SELECT ..."} -> Import results

**REQUIREMENTS:**
- BigQuery API must be enabled in your GCP project
- OAuth scope: bigquery.readonly (queries) or bigquery (full access)
- Connected Sheets is a Google Workspace feature (some plans only)

**TIP:** Use preview action to test expensive queries before running full execution.`,

  sheets_appsscript: `⚡ APPSSCRIPT - Apps Script automation (14 actions).

**PREREQUISITES:** sheets_auth must be authenticated (USER OAuth only, not service accounts). Apps Script API must be enabled in GCP project.

**ROUTING - Pick this tool when:**
> Creating or managing Apps Script projects
> Deploying scripts as web apps or API executables
> Running Apps Script functions remotely
> Monitoring script execution and performance
> Creating automation workflows for Sheets

**NOT this tool - use instead:**
> sheets_data - For direct cell manipulation
> sheets_composite - For high-level data operations
> sheets_analyze - For AI-powered analysis

**ACTIONS BY CATEGORY:**
[Project] create, get, get_content, update_content
[Version] create_version, list_versions, get_version
[Deploy] deploy, list_deployments, get_deployment, undeploy
[Execute] run (execute function), list_processes (logs), get_metrics

**TOP 3 ACTIONS:**
1. run: {"action":"run","scriptId":"1ABC...","functionName":"myFunction","parameters":["arg1"]} -> Execute function
2. get_content: {"action":"get_content","scriptId":"1ABC..."} -> View script code
3. deploy: {"action":"deploy","scriptId":"1ABC...","deploymentType":"WEB_APP","access":"ANYONE"} -> Deploy as web app

**REQUIREMENTS:**
- Apps Script API must be enabled in your GCP project
- OAuth scope: script.projects, script.deployments, script.processes
- IMPORTANT: Does NOT work with service accounts - requires user OAuth

**SAFETY WARNINGS:**
- 🔴 run: Executes code with SIDE EFFECTS - may send emails, modify docs, etc.
- 🔴 deploy: Creates PUBLIC endpoints - review access settings carefully

**TIP:** Use devMode:true in run action to test latest saved code (owner only) before deploying.`,

  sheets_webhook: `Manage Google Sheets webhook notifications for real-time change detection.

Key capabilities:
• Register webhooks for spreadsheet changes (cell updates, formatting, structure)
• Configure event filtering (specific event types or all changes)
• Manage webhook lifecycle (register, unregister, list, test)
• Monitor delivery statistics and reliability metrics
• HMAC signature verification for secure webhooks

Actions: register, unregister, list, get, test, get_stats`,

  sheets_dependencies: `Analyze formula dependencies and calculate change impact across spreadsheet.

Key capabilities:
• Build dependency graphs from spreadsheet formulas
• Identify cells affected by changes (direct and indirect dependents)
• Detect circular dependency issues in formulas
• Calculate recalculation costs and complexity
• Export dependency visualizations (DOT format for Graphviz)

Actions: build, analyze_impact, detect_cycles, get_dependencies, get_dependents, get_stats, export_dot`,
};

// Type export for other modules
export type ToolName = keyof typeof TOOL_DESCRIPTIONS;

// Helper to get description with fallback
export function getToolDescription(name: string): string {
  return TOOL_DESCRIPTIONS[name as ToolName] ?? `${name} operations`;
}
