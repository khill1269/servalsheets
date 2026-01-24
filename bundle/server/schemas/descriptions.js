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
 * Total: 16 tools, 207 actions
 */
export const TOOL_DESCRIPTIONS = {
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
    sheets_core: `📋 CORE - Spreadsheet & sheet management (15 actions).

**ROUTING - Pick this tool when:**
> Creating, copying, or managing spreadsheets/sheets
> Getting spreadsheet metadata or URLs
> Adding/deleting/renaming sheets (tabs)

**NOT this tool - use instead:**
> sheets_data - Reading/writing CELL DATA
> sheets_analyze - Getting metadata + data + analysis together
> sheets_format - Changing cell APPEARANCE

**ACTIONS BY CATEGORY:**
[Spreadsheet] get, create, copy, update_properties, get_url, batch_get, get_comprehensive, list
[Sheet/Tab] add_sheet, delete_sheet, duplicate_sheet, update_sheet, copy_sheet_to, list_sheets, get_sheet

**TOP 3 ACTIONS:**
1. create: {"action":"create","title":"My Sheet"} - New spreadsheet
2. get: {"action":"get","spreadsheetId":"1ABC..."} - Get metadata
3. add_sheet: {"action":"add_sheet","spreadsheetId":"1ABC...","title":"Q1"} - Add tab

**TIP:** For analysis, use sheets_analyze action="comprehensive" - gets metadata + data + analysis in ONE call!`,
    sheets_data: `📝 DATA - Cell values, notes, validation, hyperlinks (20 actions).

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
1. read: {"action":"read","spreadsheetId":"1ABC...","range":"A1:D10"}
2. write: {"action":"write","spreadsheetId":"1ABC...","range":"A1","values":[["Hello"]]}
3. append: {"action":"append","spreadsheetId":"1ABC...","range":"Sheet1","values":[["New","Row"]]}

**SAFETY:** write/clear are destructive. Use dryRun:true to preview. Use sheets_confirm for >100 cells.`,
    //=============================================================================
    // FORMATTING & STYLING
    //=============================================================================
    sheets_format: `🎨 FORMAT - Cell styling & conditional rules (18 actions).

**ROUTING - Pick this tool when:**
> Changing cell COLORS, FONTS, BORDERS, ALIGNMENT
> Applying number formats (currency, dates, percentages)
> Creating conditional formatting rules (color scales, data bars)
> Adding data validation dropdowns

**NOT this tool - use instead:**
> sheets_data - Changing cell VALUES
> sheets_dimensions - Changing row/column SIZE
> sheets_advanced - Creating NAMED RANGES

**ACTIONS BY CATEGORY:**
[Style] set_format, set_background, set_text_format, set_number_format, set_alignment, set_borders
[Helpers] suggest_format, clear_format, apply_preset, auto_fit
[Conditional] rule_add_conditional_format, rule_update_conditional_format, rule_delete_conditional_format, rule_list_conditional_formats, add_conditional_format_rule
[Validation] set_data_validation, clear_data_validation, list_data_validations

**TOP 3 ACTIONS:**
1. set_format: {"action":"set_format","spreadsheetId":"1ABC...","range":"A1:D1","format":{"textFormat":{"bold":true},"backgroundColor":"#4285F4"}}
2. set_number_format: {"action":"set_number_format","spreadsheetId":"1ABC...","range":"B:B","numberFormat":{"type":"CURRENCY","pattern":"$#,##0.00"}}
3. add_conditional_format_rule: {"action":"add_conditional_format_rule","spreadsheetId":"1ABC...","sheetId":0,"range":"A1:A100","rulePreset":"color_scale_green_red"}`,
    //=============================================================================
    // DIMENSIONS & STRUCTURE
    //=============================================================================
    sheets_dimensions: `📐 DIMENSIONS - Rows, columns, filters, sorting (39 actions).

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

**ACTIONS BY CATEGORY:**
[Insert] insert_rows, insert_columns, append_rows, append_columns
[Delete] delete_rows, delete_columns
[Move] move_rows, move_columns
[Resize] resize_rows, resize_columns, auto_resize
[Visibility] hide_rows, hide_columns, show_rows, show_columns
[Freeze] freeze_rows, freeze_columns
[Group] group_rows, group_columns, ungroup_rows, ungroup_columns
[Basic Filter] set_basic_filter, clear_basic_filter, get_basic_filter, filter_update_filter_criteria
[Filter Views] create_filter_view, update_filter_view, delete_filter_view, list_filter_views, get_filter_view
[Sort] sort_range
[Range Utils] trim_whitespace, randomize_range, text_to_columns, auto_fill
[Slicers] create_slicer, update_slicer, delete_slicer, list_slicers

**TOP 3 ACTIONS:**
1. insert_rows: {"action":"insert_rows","spreadsheetId":"1ABC...","sheetId":0,"startIndex":5,"count":10}
2. freeze_rows: {"action":"freeze_rows","spreadsheetId":"1ABC...","sheetId":0,"count":1}
3. sort_range: {"action":"sort_range","spreadsheetId":"1ABC...","range":"A1:D100","sortSpecs":[{"columnIndex":0,"sortOrder":"DESCENDING"}]}

**SAFETY:** delete_rows/delete_columns are PERMANENT. Always use sheets_confirm for >10 rows.`,
    //=============================================================================
    // VISUALIZATION
    //=============================================================================
    sheets_visualize: `📊 VISUALIZE - Charts & pivot tables (16 actions).

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
1. chart_create: {"action":"chart_create","spreadsheetId":"1ABC...","sheetId":0,"chartType":"LINE","data":{"sourceRange":"A1:B10"},"position":{"anchorCell":"E2"},"options":{"title":"Sales Trend"}}
2. pivot_create: {"action":"pivot_create","spreadsheetId":"1ABC...","sourceRange":"A1:D100","rows":[{"sourceColumnOffset":0}],"values":[{"sourceColumnOffset":3,"summarizeFunction":"SUM"}]}
3. suggest_chart: {"action":"suggest_chart","spreadsheetId":"1ABC...","range":"A1:D100"}

**TIP:** Use suggest_chart or suggest_pivot first to get AI recommendations.`,
    //=============================================================================
    // COLLABORATION
    //=============================================================================
    sheets_collaborate: `👥 COLLABORATE - Sharing, comments, versions (28 actions).

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

**ROUTING - Pick this tool when:**
> You want to UNDERSTAND a spreadsheet (structure, quality, patterns)
> You need AI to suggest charts, formulas, or insights
> You want comprehensive analysis in ONE call
> You need natural language queries about data

**NOT this tool - use instead:**
> sheets_data - After analysis, to WRITE changes
> sheets_visualize - After analysis, to CREATE suggested charts
> sheets_fix - After analysis, to FIX detected issues

**ACTIONS BY CATEGORY:**
[Comprehensive] comprehensive (RECOMMENDED - gets EVERYTHING)
[Specific Analysis] analyze_data, analyze_structure, analyze_quality, analyze_performance, analyze_formulas
[AI Generation] suggest_visualization, generate_formula, detect_patterns
[Natural Language] query_natural_language, explain_analysis

**START HERE:**
comprehensive: {"action":"comprehensive","spreadsheetId":"1ABC..."}
Returns: metadata + data sample + quality issues + patterns + chart recommendations + formula analysis

**WORKFLOW:**
1. sheets_analyze comprehensive -> Understand the spreadsheet
2. sheets_visualize -> Create recommended charts
3. sheets_fix -> Fix detected issues
4. sheets_data -> Apply generated formulas`,
    //=============================================================================
    // ADVANCED FEATURES
    //=============================================================================
    sheets_advanced: `⚙️ ADVANCED - Named ranges, protection, metadata, banding, tables (19 actions).

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

**ROUTING - Pick this tool when:**
> You need 2+ operations to succeed or fail TOGETHER
> Bulk imports/updates (>50 rows)
> Operations that must be REVERSIBLE
> You want to SAVE API QUOTA (80-95% savings)

**NOT this tool - use instead:**
> Direct tool calls for SINGLE operations
> sheets_composite for high-level operations (import_csv, smart_append)

**ACTIONS:** begin, queue, commit, rollback, status, list

**WORKFLOW:**
1. begin: {"action":"begin","spreadsheetId":"1ABC..."} -> Get transactionId
2. queue: {"action":"queue","transactionId":"tx_123","operation":{...}} -> Add operations
3. commit: {"action":"commit","transactionId":"tx_123"} -> Execute ALL atomically
4. (On error) rollback: {"action":"rollback","transactionId":"tx_123"}

**BENEFIT:** 100 writes = 1 API call (vs 100 calls without transaction)`,
    sheets_quality: `✅ QUALITY - Data validation & conflict detection (4 actions).

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
    sheets_composite: `🔗 COMPOSITE - High-level data operations (4 actions).

**ROUTING - Pick this tool when:**
> Importing CSV data into a spreadsheet
> Appending data with automatic COLUMN MATCHING
> Bulk updating rows by a KEY column
> Removing DUPLICATE rows

**NOT this tool - use instead:**
> sheets_data - For simple read/write/append
> sheets_transaction - For custom multi-step operations

**ACTIONS:** import_csv, smart_append, bulk_update, deduplicate

**TOP 3 ACTIONS:**
1. import_csv: {"action":"import_csv","spreadsheetId":"1ABC...","sheet":"Sheet1","csvData":"Name,Age\\nAlice,30","mode":"replace"}
2. smart_append: {"action":"smart_append","spreadsheetId":"1ABC...","sheet":"Sheet1","data":[{"Name":"Alice","Age":30}],"matchHeaders":true}
3. deduplicate: {"action":"deduplicate","spreadsheetId":"1ABC...","sheet":"Sheet1","columns":["Email"],"keepFirst":true}

**BENEFIT:** These handle complex logic (header matching, key lookups) automatically.`,
    //=============================================================================
    // SESSION CONTEXT
    //=============================================================================
    sheets_session: `📋 SESSION - Conversation context for natural language (13 actions).

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
};
// Helper to get description with fallback
export function getToolDescription(name) {
    return TOOL_DESCRIPTIONS[name] ?? `${name} operations`;
}
//# sourceMappingURL=descriptions.js.map