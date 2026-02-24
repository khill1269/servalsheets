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
 * Total: 22 tools, 340 actions (see TOOL_COUNT/ACTION_COUNT in index.ts)
 *
 * SHARED CONTEXT (applies to all tools except sheets_auth):
 * - PREREQUISITE: sheets_auth must be authenticated before using any tool.
 * - Range format: "Sheet1!A1:D10" (case-sensitive, include sheet name). Spaces/emoji: "'My Sheet'!A1:D10"
 * - spreadsheetId: Long alphanumeric string from Google Sheets URL.
 * - sheetId: Numeric ID from sheets_core.list_sheets (0, 123456789, etc.), not sheet name.
 * - BATCH RULE: 3+ similar operations → use batch_* or sheets_transaction (1 API call, 80-95% savings).
 * - FIRST TIME? Use sheets_analyze action:"comprehensive" or "scout" before other tools.
 */

import { ACTION_COUNTS } from './action-counts.js';

export const TOOL_DESCRIPTIONS: Record<string, string> = {
  //=============================================================================
  // AUTHENTICATION
  //=============================================================================

  sheets_auth: `🔐 AUTH - Authenticate with Google Sheets via OAuth 2.1 (${ACTION_COUNTS['sheets_auth']} actions). Call status first.

**Use when:** Checking auth state, logging in/out, managing OAuth token lifecycle
**NOT this tool - use instead:**
> All other tools REQUIRE authentication first - this is a PREREQUISITE
**ACTIONS (4):** status, login, callback, logout
**Parameter format examples:**
- Status check: {"action":"status"}
- Login: {"action":"login"}
- Callback: {"action":"callback","code":"4/0AX4XfWh..."}`,

  //=============================================================================
  // CORE DATA OPERATIONS
  //=============================================================================

  sheets_core: `📋 CORE - Create and manage spreadsheets and sheets/tabs (${ACTION_COUNTS['sheets_core']} actions). Get metadata and URLs.

**DECISION GUIDE - Which action should I use?**
→ **Need metadata from 3+ spreadsheets?** Use batch_get (1 API call for all, NOT 3+ separate get calls)
→ **Deleting 3+ sheets?** Use batch_delete_sheets (1 API call, 80%+ savings)
→ **Updating 3+ sheet properties?** Use batch_update_sheets (1 call vs N calls)

**Use when:** Creating/copying spreadsheets, adding/deleting/renaming sheets, getting metadata
**NOT this tool - use instead:**
> sheets_data - Reading/writing CELL VALUES
> sheets_format - Applying STYLES or formatting
> sheets_analyze - For metadata + data + analysis in 1 call (faster!)
**ACTIONS (19):** get, create, copy, update_properties, get_url, batch_get, get_comprehensive, list, add_sheet, delete_sheet, duplicate_sheet, update_sheet, copy_sheet_to, list_sheets, get_sheet, batch_delete_sheets, batch_update_sheets, clear_sheet, move_sheet
**Key parameter:** sheetId (numeric ID from list_sheets, not sheet name: 0, 123456789, etc.)

**Parameter format examples:**
- Create: {"action":"create","title":"My Spreadsheet"}
- Get metadata: {"action":"get","spreadsheetId":"1ABC..."}
- Batch get metadata: {"action":"batch_get","spreadsheetIds":["1ABC...","1DEF...","1GHI..."]} ← 3 spreadsheets in 1 call!
- Add sheet: {"action":"add_sheet","spreadsheetId":"1ABC...","title":"New Sheet"}
- Batch delete sheets: {"action":"batch_delete_sheets","spreadsheetId":"1ABC...","sheetIds":[123,456,789]} ← 3 sheets deleted in 1 call!
**SAFETY:**
[Read-only] get, list, list_sheets, get_sheet, get_url, get_comprehensive, batch_get
[Destructive] delete_sheet, batch_delete_sheets, clear_sheet ← permanent, use sheets_confirm
[Safe mutation] create, copy, add_sheet, duplicate_sheet, update_sheet, update_properties, copy_sheet_to, move_sheet, batch_update_sheets

**Tip:** Use sheets_analyze comprehensive instead of get for metadata + data + analysis in 1 call

**SMART ROUTING:**
- Need sheet with headers + formatting? → Use sheets_composite.setup_sheet (not add_sheet + write + format separately)
- Clone structure? → Use sheets_core.duplicate_sheet or sheets_composite.clone_structure
- Just checking sheet names? → Use sheets_analyze.scout (faster, includes column info)
- Managing 3+ sheets? → Use batch_delete_sheets or batch_update_sheets (80%+ savings!)`,

  sheets_data: `📝 DATA - Read and write cell values, notes, and hyperlinks (${ACTION_COUNTS['sheets_data']} actions). Append rows, find/replace text, merge cells.

**DECISION GUIDE - Which action should I use?**
→ **Need to add rows?** Use append (auto-finds last row at bottom) OR sheets_composite.smart_append (column-matched)
→ **Need multiple ranges?** Use batch_read / batch_write (1 API call, same cost as 1 read/write!)
→ **Need column matching?** Use sheets_composite.smart_append (auto-matches headers, safer than manual append)

**Use when:** Reading/writing cell values, appending rows, managing notes/links/validation, clipboard operations
**NOT this tool - use instead:**
> sheets_core - Managing SHEETS/TABS (add_sheet, delete_sheet)
> sheets_format - Applying CELL STYLES, colors, borders
> sheets_dimensions - Resizing, hiding, freezing ROWS/COLUMNS
> sheets_analyze - For analyzing DATA patterns and quality
**ACTIONS BY CATEGORY:**
[Read/Write] read, write, append, clear, batch_read, batch_write, batch_clear, find_replace
[Notes/Links] add_note, get_note, clear_note, set_hyperlink, clear_hyperlink
[Merge] merge_cells, unmerge_cells, get_merges
[Clipboard] cut_paste, copy_paste
[Spill Detection] detect_spill_ranges — find array formula spill regions
[Cross-Spreadsheet] cross_read (fetch+join from multiple spreadsheets), cross_query (NL query across spreadsheets), cross_write (copy data between spreadsheets), cross_compare (diff two ranges across spreadsheets)

**Range format:** "Sheet1!A1:D10" (case-sensitive; spaces/emoji: "'My Sheet'!A1:D10")

⚠️ **EMOJI SHEET NAMES:** ALWAYS use single quotes: "'📊 Dashboard'!A1:Z30" NOT "📊 Dashboard!A1:Z30"

ℹ️ **SPARKLINE NOTE:** SPARKLINE formulas render visually but API reads return empty values (expected behavior). Don't retry or investigate empty SPARKLINE reads.

**Parameter format examples:**
- Read single: {"action":"read","spreadsheetId":"1ABC...","range":"Sheet1!A1:D10"}
- Read batch: {"action":"batch_read","spreadsheetId":"1ABC...","ranges":["Sheet1!A1:D100","Sheet2!A1:B50"]} ← Same API cost as read, but gets 2 ranges!
- Write: {"action":"write","spreadsheetId":"1ABC...","range":"Sheet1!A1:D10","values":[["Name","Age"],["Alice",30]]}
- Write batch: {"action":"batch_write","spreadsheetId":"1ABC...","data":[{"range":"Sheet1!A1:D10","values":[...]},{"range":"Sheet2!A1:B20","values":[...]}]}
- Append: {"action":"append","spreadsheetId":"1ABC...","range":"Sheet1!A:D","values":[["Bob",25]]}
**SAFETY:**
[Read-only] read, batch_read, get_note, get_merges, detect_spill_ranges, cross_read, cross_query, cross_compare
[Destructive] write, clear, batch_write, batch_clear, cut_paste, cross_write ← requires confirmation for >100 cells
[Non-idempotent] append ← NEVER retry on timeout (duplicates rows)
[Safe mutation] find_replace, add_note, clear_note, set_hyperlink, clear_hyperlink, merge_cells, unmerge_cells, copy_paste

**Dynamic ranges:** Use \`dataFilter\` instead of hard-coded A1 ranges for production systems. Read \`knowledge:///search?q=dynamic ranges datafilter\` for full guide with examples.

**COMMON MISTAKES (AVOID!):**
1. Range format: ✅ "Sheet1!A1:D10" ✅ "'My Sheet'!A1:D10" | ❌ "A1:D10" (missing sheet name) | ❌ "Sheet1A1:D10" (wrong syntax)
2. Using write instead of append: ❌ write for new rows requires finding last row manually | ✅ append auto-finds last row
3. Multiple sequential reads instead of batch: ❌ Multiple read calls | ✅ batch_read in 1 call
4. Not validating before large writes: ❌ write directly | ✅ sheets_quality.validate first, then write

**CROSS-SPREADSHEET OPERATIONS:**
→ **Need data from multiple spreadsheets?** Use cross_read (parallel fetch + optional join by key column)
→ **Natural language query across sheets?** Use cross_query ("show revenue from Sales joined with costs from Finance")
→ **Copy data between spreadsheets?** Use cross_write (source → destination, with confirmation)
→ **Compare data across spreadsheets?** Use cross_compare (cell-level diff with delta percentages)

**Parameter format examples (cross-spreadsheet):**
- Cross read: {"action":"cross_read","sources":[{"spreadsheetId":"1ABC...","range":"Sheet1!A1:D100"},{"spreadsheetId":"2DEF...","range":"Sheet1!A1:D100"}],"joinKey":"ProductID"}
- Cross query: {"action":"cross_query","sources":[{"spreadsheetId":"1ABC...","range":"Sales!A1:D100"},{"spreadsheetId":"2DEF...","range":"Costs!A1:C50"}],"query":"total revenue minus costs by category"}
- Detect spills: {"action":"detect_spill_ranges","spreadsheetId":"1ABC...","sheetId":0}

**SMART ROUTING:**
- Need to add rows? → Use append (auto-finds last row) NOT write
- 3+ ranges to read/write? → Use batch_read/batch_write (same API cost!)
- 5+ operations that must succeed together? → Use sheets_transaction (1 API call, 80%+ savings)
- Bulk updating 50+ rows? → Use sheets_transaction OR sheets_composite.bulk_update
- Need column matching? → Use sheets_composite.smart_append instead
- Want to validate first? → Run sheets_quality.validate before write
- Need structure first? → Run sheets_analyze.scout (0 data transfer)
- Need data from multiple spreadsheets? → Use cross_read / cross_query (NOT manual multi-read)`,

  //=============================================================================
  // FORMATTING & STYLING
  //=============================================================================

  sheets_format: `🎨 FORMAT - Cell styling, sparklines & conditional rules (${ACTION_COUNTS['sheets_format']} actions). set_format, suggest_format, set_background, set_text_format, set_number_format, set_alignment, set_borders, clear_format, apply_preset, auto_fit, batch_format, sparkline_add, sparkline_get, sparkline_clear, rule_add_conditional_format, rule_update_conditional_format, rule_delete_conditional_format, rule_list_conditional_formats, set_data_validation, clear_data_validation, list_data_validations, add_conditional_format_rule, set_rich_text

**DECISION GUIDE - Which action should I use?**
→ **Formatting 3+ ranges?** ALWAYS use batch_format — 1 API call for all, 80%+ savings vs sequential calls
→ **Need a professional look?** Use sheets_composite.setup_sheet (headers+format+freeze in 2 calls, NOT sheets_format calls)
→ **Just 1-2 format changes?** Use individual set_format (simple, 1 call per range)
→ **Setting up a new sheet?** Use sheets_composite.setup_sheet instead (includes headers+format+freeze atomically)

**ROUTING - Pick this tool when:**
> Changing cell COLORS, FONTS, BORDERS, ALIGNMENT, text formatting
> Applying number formats (currency, dates, percentages, custom patterns)
> Creating conditional formatting rules (color scales, data bars, formula-based)
> Adding data validation dropdowns or rules
> Creating sparkline visualizations in cells
> Applying MULTIPLE format changes at once → use batch_format (80-95% faster)

**NOT this tool - use instead:**
> sheets_data - Changing cell VALUES or text content
> sheets_core - Managing SHEETS/TABS structure
> sheets_dimensions - Changing row/column SIZE, visibility, or grouping
> sheets_advanced - Creating NAMED RANGES or protecting cells
> sheets_composite.setup_sheet - For full sheet setup (headers+format+freeze+optional data in 2 calls)

**⚡ PERFORMANCE TIP:** Use batch_format when applying 3+ format changes. It combines all operations into a single Google API call instead of N separate calls. Example: styling a header (background + text + borders) = 1 API call instead of 3.

**ACTIONS BY CATEGORY:**
[Style] set_format, set_background, set_text_format, set_number_format, set_alignment, set_borders
[Helpers] suggest_format, clear_format, apply_preset, auto_fit
[Conditional] add_conditional_format_rule (RECOMMENDED - uses presets), rule_add_conditional_format (advanced - complex schema), rule_update_conditional_format, rule_delete_conditional_format, rule_list_conditional_formats
[Validation] set_data_validation, clear_data_validation, list_data_validations
[Rich Text] set_rich_text (mixed formatting within a single cell)
[Batch] batch_format ← Use for 3+ format changes (80%+ savings!)

**TOP 3 ACTIONS:**
1. batch_format: {"action":"batch_format","spreadsheetId":"1ABC...","requests":[{"range":"Sheet1!A1:D1","format":{...}},{"range":"Sheet1!A2:D10","format":{...}}]} ← 2+ formats in 1 call!
2. apply_preset: {"action":"apply_preset","spreadsheetId":"1ABC...","range":"Sheet1!A1:D10","preset":"header_row"} ← Quick professional look
3. set_background: {"action":"set_background","spreadsheetId":"1ABC...","range":"Sheet1!A1:D1","color":"#4285F4"}

⚠️ Copy sheet names from API responses — never type emoji manually (lookalikes cause silent failures).

**SMART ROUTING:**
- 1-2 format ranges? → Individual set_format
- 3+ ranges? → batch_format (1 API call, 80%+ savings)
- Conditional formatting? → add_conditional_format_rule with presets (simpler than rule_add_)
- Professional look? → apply_preset: header_row + alternating_rows
- New sheet? → sheets_composite.setup_sheet (includes format + freeze)`,

  //=============================================================================
  // DIMENSIONS & STRUCTURE
  //=============================================================================

  sheets_dimensions: `📐 DIMENSIONS - Rows, columns, filters, sorting (${ACTION_COUNTS['sheets_dimensions']} actions).

**DECISION GUIDE - Which action should I use?**
→ **Need 3+ dimension changes?** Use sheets_transaction to batch them (1 API call, 80%+ savings vs sequential)
→ **Setting up a new sheet?** Use sheets_composite.setup_sheet (includes freeze, format, headers in 2 calls)
→ **Just 1-2 operations?** Use individual actions (simple, fast)

**ROUTING - Pick this tool when:**
> Inserting or deleting ROWS or COLUMNS
> Resizing, hiding, freezing, or grouping rows/columns
> Applying basic filters, creating filter views, or slicers
> Sorting data by columns
> Auto-fitting column widths

**NOT this tool - use instead:**
> sheets_data - Changing cell VALUES or content
> sheets_format - Changing cell COLORS, fonts, borders, or styles
> sheets_core - Deleting entire SHEETS (not rows/columns)
> sheets_analyze - For understanding DATA before filtering/sorting

**ACTIONS (28):** insert, append, delete, move, resize, auto_resize, hide, show, freeze, unfreeze, group, ungroup, set_basic_filter, clear_basic_filter, get_basic_filter, create_filter_view, update_filter_view, delete_filter_view, list_filter_views, sort_range, trim_whitespace, randomize_range, text_to_columns, auto_fill, create_slicer, update_slicer, delete_slicer, list_slicers

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
[Basic Filter] set_basic_filter, clear_basic_filter, get_basic_filter
[Filter Views] create_filter_view, update_filter_view, delete_filter_view, list_filter_views, get_filter_view
[Sort] sort_range
[Range Utils] trim_whitespace, randomize_range, text_to_columns, auto_fill
[Slicers] create_slicer, update_slicer, delete_slicer, list_slicers

**TOP 3 ACTIONS:**
1. insert: {"action":"insert","spreadsheetId":"1ABC...","sheetId":0,"dimension":"ROWS","startIndex":5,"count":10}
2. freeze: {"action":"freeze","spreadsheetId":"1ABC...","sheetId":0,"dimension":"ROWS","count":1}
3. sort_range: {"action":"sort_range","spreadsheetId":"1ABC...","range":"Sheet1!A1:D100","sortSpecs":[{"columnIndex":0,"sortOrder":"DESCENDING"}]}

**dimension parameter:** Always use "ROWS" or "COLUMNS" (uppercase)
**sheetId:** Numeric ID from sheets_core.list_sheets (0, 123456789, etc.). Preferred for reliability.
**sheetName:** Supported as alternative when sheetId is not provided.
**range format:** "Sheet1!A1:D100" (required for sort_range, case-sensitive)

**SAFETY:**
[Read-only] get_basic_filter, list_filter_views, get_filter_view, list_slicers
[Destructive] delete ← permanent, NOT idempotent; delete_filter_view, delete_slicer, clear_basic_filter
[Non-idempotent] insert, append ← calling twice doubles the effect, NEVER retry on timeout
[Safe mutation] move, resize, auto_resize, hide, show, freeze, group, ungroup, sort_range, trim_whitespace, randomize_range, text_to_columns, auto_fill, set_basic_filter, create_filter_view, update_filter_view, create_slicer, update_slicer

**SAFETY CRITICAL - NOT IDEMPOTENT:**
⚠️ insert and delete are NOT idempotent — calling twice doubles the effect. Always verify current state before structural changes.
EXAMPLE: insert(count:5) twice = 10 rows inserted, NOT 5 (no automatic deduplication)
SOLUTION: Get current row count first, then insert once with precise count.

**COMMON MISTAKE - INDEX SHIFTING:**
❌ BAD: Want to delete rows 3,5,7 → Delete row 3, then delete row 5 (but row 5 is now row 4 after deletion!)
✅ GOOD: Delete rows from BOTTOM to TOP (delete row 7, then 5, then 3) — indices don't shift this way

**SAFETY:** delete is PERMANENT. Always use sheets_confirm for >10 rows/columns.

**SMART ROUTING:**
- insert/delete are NOT idempotent — never retry on timeout without checking state
- Delete multiple rows? → Delete from BOTTOM to TOP (indices shift!)
- Need header freeze? → Included in sheets_composite.setup_sheet
- Need to combine insert+freeze+filter? → Batch them together (1 call)`,

  //=============================================================================
  // VISUALIZATION
  //=============================================================================

  sheets_visualize: `📊 VISUALIZE - Charts, trendlines & pivot tables (${ACTION_COUNTS['sheets_visualize']} actions).

**Tip:** Use sheets_analyze action:"suggest_chart" or "suggest_pivot" first for recommendations.

**ROUTING - Pick this tool when:**
> Creating charts (bar, line, pie, scatter, column, combo, etc.)
> Creating pivot tables for aggregation and summarization
> Updating, moving, resizing, or deleting visualizations

**NOT this tool - use instead:**
> sheets_analyze - Getting chart/pivot RECOMMENDATIONS and suggestions
> sheets_data - Reading the SOURCE DATA to visualize
> sheets_format - Styling the SOURCE data (not the chart)

**ACTIONS BY CATEGORY:**
[Charts] chart_create, chart_update, chart_delete, chart_list, chart_get, chart_move, chart_resize, chart_update_data_range, suggest_chart
[Trendlines] chart_add_trendline (⚠️ DEPRECATED — Google Sheets REST API does not accept trendline fields via batchUpdate; use Google Sheets UI instead), chart_remove_trendline
[Pivots] pivot_create, pivot_update, pivot_delete, pivot_list, pivot_get, pivot_refresh, suggest_pivot

**TOP 3 ACTIONS:**
1. chart_create: {"action":"chart_create","spreadsheetId":"1ABC...","sheetId":0,"chartType":"LINE","data":{"sourceRange":"Sheet1!A1:B10"},"position":{"anchorCell":"Sheet1!E2"},"options":{"title":"Sales Trend"}}
2. pivot_create: {"action":"pivot_create","spreadsheetId":"1ABC...","sourceRange":"Sheet1!A1:D100","rows":[{"sourceColumnOffset":0}],"values":[{"sourceColumnOffset":3,"summarizeFunction":"SUM"}]}
3. suggest_chart: {"action":"suggest_chart","spreadsheetId":"1ABC...","range":"Sheet1!A1:D100"}

**POSITION FORMAT:** anchorCell MUST include sheet name: "Sheet1!E2" not just "E2"
**sourceRange format:** "Sheet1!A1:D100" (required, case-sensitive)
**sheetId:** Numeric ID from sheets_core.list_sheets (0, 123456789, etc.)

**CHART CONSTRAINTS:**
- BAR charts: series target BOTTOM_AXIS only (horizontal bars)
- COLUMN charts: series target LEFT_AXIS (vertical bars)
- sheetId changes when sheets are recreated - always fetch fresh from list_sheets

**TIP:** Use suggest_chart or suggest_pivot first to get AI recommendations before creating.`,

  //=============================================================================
  // COLLABORATION
  //=============================================================================

  sheets_collaborate: `👥 COLLABORATE - Sharing, comments, versions & snapshots (${ACTION_COUNTS['sheets_collaborate']} actions).

**Requires:** Elevated Drive scope (OAUTH_SCOPE_MODE=full or incremental consent). Create snapshots before destructive ops.

**ROUTING - Pick this tool when:**
> Sharing a spreadsheet with users/groups/domains
> Adding, replying to, resolving, or listing comments
> Creating snapshots (backup points before changes)
> Viewing or restoring previous file versions
> Transferring file ownership

**NOT this tool - use instead:**
> sheets_advanced - PROTECTING specific cell ranges
> sheets_history - Viewing OPERATION history (this session's changes)
> sheets_format - Styling cells (not sharing)

**ACTIONS BY CATEGORY:**
[Sharing] share_add, share_update, share_remove, share_list, share_get, share_transfer_ownership, share_set_link, share_get_link
[Comments] comment_add, comment_update, comment_delete, comment_list, comment_get, comment_resolve, comment_reopen, comment_add_reply, comment_update_reply, comment_delete_reply
[Versions] version_list_revisions, version_get_revision, version_restore_revision, version_keep_revision, version_create_snapshot, version_list_snapshots, version_restore_snapshot, version_delete_snapshot, version_compare, version_export
[Approvals] approval_create, approval_approve, approval_reject, approval_get_status, approval_list_pending, approval_delegate, approval_cancel

**TOP 3 ACTIONS:**
1. share_add: {"action":"share_add","spreadsheetId":"1ABC...","email":"user@example.com","role":"writer"}
2. comment_add: {"action":"comment_add","spreadsheetId":"1ABC...","range":"A1","content":"Please verify this"}
3. version_create_snapshot: {"action":"version_create_snapshot","spreadsheetId":"1ABC...","description":"Before cleanup"}

**email format:** "user@example.com" or "group@domain.com"
**role options:** viewer, commenter, editor, owner

**SAFETY:**
[Read-only] share_list, share_get, share_get_link, comment_list, comment_get, version_list_revisions, version_get_revision, version_list_snapshots, version_compare, version_export, approval_get_status, approval_list_pending
[Destructive] share_remove, comment_delete, comment_delete_reply, version_restore_revision, version_restore_snapshot, version_delete_snapshot, approval_cancel ← irreversible or data-altering
[Non-idempotent] share_transfer_ownership ← IRREVERSIBLE, cannot be undone
[Safe mutation] share_add, share_update, share_set_link, comment_add, comment_update, comment_resolve, comment_reopen, comment_add_reply, comment_update_reply, version_create_snapshot, version_keep_revision, approval_create, approval_approve, approval_reject, approval_delegate

**TIP:** Always create a snapshot before destructive operations!`,

  //=============================================================================
  // ANALYSIS & INTELLIGENCE
  //=============================================================================

  sheets_analyze: `🤖 ANALYZE - Spreadsheet analysis, insights & AI-powered suggestions (${ACTION_COUNTS['sheets_analyze']} actions). START HERE.

**🚀 ALWAYS START HERE:**
For any spreadsheet you haven't seen before, ALWAYS call action:"comprehensive" FIRST. It gives you metadata + data quality + formula health + recommended actions in just 1-2 API calls.
Saves 70%+ time vs manual analysis. Gets everything you need to plan your next steps.

**DECISION GUIDE - Which action should I use?**
→ **First time seeing this sheet?** Use comprehensive (full overview, 2 API calls, 73% faster than manual)
→ **Just need structure/metadata?** Use scout (1 API call, 0 data transfer, super-fast)
→ **Analyzing specific data range?** Use analyze_data (quality, patterns, trends)
→ **Need a chart/pivot?** Use suggest_chart or suggest_pivot (get recommendations before creating)
→ **Want formula ideas?** Use generate_formula (describe what you want, Claude generates it)

**Use when:** Understanding spreadsheet structure/quality, generating AI insights, detecting patterns, natural language queries, getting proactive improvement suggestions
**NOT this tool - use instead:**
> sheets_quality - Validating DATA or detecting CONFLICTS before writing
> sheets_data - Writing CHANGES to the spreadsheet
> sheets_visualize - Creating CHARTS (use suggest_chart from here first)
> sheets_fix - Auto-fixing ISSUES or CLEANING DATA (use comprehensive first to find issues, then fix/clean)

**ACTIONS BY CATEGORY:**
[Discovery] comprehensive (START HERE), scout (fast metadata), analyze_structure
[Data Analysis] analyze_data, detect_patterns, analyze_quality, analyze_performance, analyze_formulas
[AI Features] generate_formula, query_natural_language, explain_analysis, suggest_visualization
[Workflow] plan, execute_plan, drill_down, generate_actions
[Copilot] suggest_next_actions (proactive ranked suggestions with executable params), auto_enhance (auto-apply safe improvements)

→ **Want proactive suggestions?** Use suggest_next_actions — returns ranked, actionable suggestions (add formulas, fix formatting, create charts) with ready-to-execute params
→ **Want auto-improvements?** Use auto_enhance with mode:"preview" first, then mode:"apply" — applies top non-destructive enhancements (freeze headers, auto-resize, number formats)

**TOP 3 ACTIONS:**
1. comprehensive: {"action":"comprehensive","spreadsheetId":"1ABC..."} ← START HERE for new sheets (metadata + data + quality in 1-2 calls)
2. scout: {"action":"scout","spreadsheetId":"1ABC..."} ← Fast metadata only (1 call, 0 data transfer)
3. suggest_next_actions: {"action":"suggest_next_actions","spreadsheetId":"1ABC...","maxSuggestions":5} ← Get ranked improvement suggestions

**Parameter format examples (Copilot):**
- Suggestions: {"action":"suggest_next_actions","spreadsheetId":"1ABC...","maxSuggestions":5,"categories":["formulas","formatting","visualization"]}
- Auto-enhance preview: {"action":"auto_enhance","spreadsheetId":"1ABC...","mode":"preview"}
- Auto-enhance apply: {"action":"auto_enhance","spreadsheetId":"1ABC...","mode":"apply","maxEnhancements":3}

**Progressive workflow:** scout (metadata) → plan → execute_plan → drill_down → generate_actions (for large/complex sheets)
**Copilot workflow:** suggest_next_actions → review suggestions → execute specific suggestions OR auto_enhance for batch improvements`,

  //=============================================================================
  // ADVANCED FEATURES
  //=============================================================================

  sheets_advanced: `⚙️ ADVANCED - Named ranges, protection, metadata, banding, tables (${ACTION_COUNTS['sheets_advanced']} actions).

**ROUTING - Pick this tool when:**
> Creating or managing NAMED RANGES (references by name, not cell address)
> PROTECTING specific cell ranges from editing
> Adding alternating row colors (BANDING)
> Managing developer METADATA for custom attributes
> Creating structured TABLES for data organization

**NOT this tool - use instead:**
> sheets_data - Writing VALUES to cells or changing content
> sheets_format - Basic FORMATTING like colors, fonts, borders, styles
> sheets_collaborate - SHARING permissions with other users
> sheets_dimensions - Hiding or freezing rows/columns

⚠️ **BANDING PRE-CHECK:** Always call \`list_banding\` before \`add_banding\` to check if banding already exists. Adding banding to a range that already has it will fail.

**ACTIONS BY CATEGORY:**
[Named Ranges] add_named_range, update_named_range, delete_named_range, list_named_ranges, get_named_range
[Protection] add_protected_range, update_protected_range, delete_protected_range, list_protected_ranges
[Metadata] set_metadata, get_metadata, delete_metadata
[Banding] add_banding, update_banding, delete_banding, list_banding
[Tables] create_table, delete_table, list_tables, update_table, rename_table_column, set_table_column_properties
[Smart Chips] add_person_chip, add_drive_chip, add_rich_link_chip, list_chips

**Parameter format examples:**
- Named range: {"action":"add_named_range","spreadsheetId":"1ABC...","name":"Revenue","range":"B2:B100"}
- Protection: {"action":"add_protected_range","spreadsheetId":"1ABC...","range":"A1:D1","editors":{"users":["admin@example.com"]}}
- Table: {"action":"create_table","spreadsheetId":"1ABC...","range":"A1:D100"}

**TOP 3 ACTIONS:**
1. add_named_range: {"action":"add_named_range","spreadsheetId":"1ABC...","name":"Revenue","range":"B2:B100"}
2. add_protected_range: {"action":"add_protected_range","spreadsheetId":"1ABC...","range":"A1:D1","editors":{"users":["admin@example.com"]}}
3. create_table: {"action":"create_table","spreadsheetId":"1ABC...","range":"A1:D100"}

**range format:** "Sheet1!A1:D100" (case-sensitive, include sheet name)
**protection options:** editors (users/groups who can edit), unprotectedRanges (cells that stay editable)

**SAFETY:**
[Read-only] list_named_ranges, get_named_range, list_protected_ranges, get_metadata, list_banding, list_tables, list_chips, list_named_functions, get_named_function
[Destructive] delete_named_range, delete_protected_range, delete_metadata, delete_banding, delete_table, delete_named_function ← permanent removal
[Safe mutation] add_named_range, update_named_range, add_protected_range, update_protected_range, set_metadata, add_banding, update_banding, create_table, update_table, rename_table_column, set_table_column_properties, add_person_chip, add_drive_chip, add_rich_link_chip, create_named_function, update_named_function

**TIP:** Tables use Sheets API v4 table objects for structured ranges. Named ranges allow formulas to use names instead of cell addresses.`,

  //=============================================================================
  // ENTERPRISE / SAFETY
  //=============================================================================

  sheets_transaction: `🔄 TRANSACTION - Atomic batch operations (${ACTION_COUNTS['sheets_transaction']} actions).

**DECISION GUIDE - Should I use transactions?**
→ **1-4 simple operations?** Use direct tool calls (overhead exceeds benefit, skip transaction overhead)
→ **5+ operations that must succeed/fail together?** Use transactions (1 API call total, 80%+ savings)
→ **Bulk update 50+ rows?** Use transactions OR sheets_composite.bulk_update (both atomic, similar savings)
→ **Mix of different operation types?** Use transactions (begin → queue → commit = atomic execution)
→ **Sequential non-dependent ops?** Use direct calls (no atomicity needed, don't add transaction overhead)

**ROUTING - Pick this tool when:**
> You need 5+ operations to succeed or fail TOGETHER
> Bulk updates/imports (>50 rows with different values)
> Operations where atomicity matters (all-or-nothing)
> You want to SAVE API QUOTA (80-95% savings)

**NOT this tool - use instead:**
> Direct tool calls for 1-4 simple operations (transaction overhead exceeds benefit)
> sheets_composite for high-level operations (import_csv, smart_append, bulk_update)
> Single read/write operations (no need for atomicity)

**ACTIONS (6):** begin, queue, commit, rollback, status, list

**COST:** 100 writes = 1 API call with transaction. Use for 5+ operations (80-95% savings).

**Parameter format examples:**
1. begin: {"action":"begin","spreadsheetId":"1ABC..."} -> Get transactionId
2. queue: {"action":"queue","transactionId":"tx_123","operation":{...}} -> Add operations (0 API cost!)
3. queue: {"action":"queue","transactionId":"tx_123","operation":{...}} -> Add more operations
4. commit: {"action":"commit","transactionId":"tx_123"} -> Execute ALL atomically in 1 call
5. rollback: {"action":"rollback","transactionId":"tx_123"} -> Discard all queued operations

**transactionId format:** Returned from begin action: "tx_abc123..."
**operation format:** Any valid sheets_data or sheets_dimensions request without spreadsheetId (transaction context)

**WORKFLOW:** begin → queue (0 cost) → queue → commit (1 API call). NOT: begin → queue → commit → queue → commit.
**RULE:** Only use for 5+ operations OR when atomicity is critical.`,

  sheets_quality: `✅ QUALITY - Data validation & conflict detection (${ACTION_COUNTS['sheets_quality']} actions).

**Use BEFORE writes.** Run validate before sheets_data/sheets_transaction.

**ROUTING - Pick this tool when:**
> VALIDATING individual values or entire datasets before writing (email formats, required fields, data types)
> Detecting CONFLICTS from concurrent/simultaneous edits
> Analyzing IMPACT of a planned operation on dependent formulas or data
> Pre-flight checks before destructive operations

**NOT this tool - use instead:**
> sheets_analyze - For comprehensive data QUALITY ANALYSIS (patterns, issues, suggestions)
> sheets_format - For adding VALIDATION RULES to cells (dropdowns, data validation)
> sheets_data - For WRITING the validated data

**ACTIONS (4):** validate, detect_conflicts, resolve_conflict, analyze_impact

**SAFETY GATE - WHEN TO VALIDATE:**
Call validate BEFORE large writes (>100 cells) to catch format errors, type mismatches, and constraint violations BEFORE they hit the API:
❌ RISKY: Write 500 cells, discover halfway through they're wrong type
✅ SAFE: validate all 500 cells (instant), then write

Example: {"action":"validate","value":"test@email.com","rules":["not_empty","valid_email"]}

**TOP 3 ACTIONS:**
1. validate: {"action":"validate","value":"test@email.com","rules":["not_empty","valid_email"]}
2. analyze_impact: {"action":"analyze_impact","spreadsheetId":"1ABC...","operation":{"type":"delete_rows","range":"A1:A10"}}
3. detect_conflicts: {"action":"detect_conflicts","spreadsheetId":"1ABC..."}

**validate rules examples:** not_empty, valid_email, is_number, is_date, min_length, max_length, matches_pattern
**impact operation types:** delete_rows, delete_columns, clear_range, write_range, create_chart, delete_formula

**PRE-WRITE WORKFLOW:**
1. Plan operation (which cells, what values)
2. sheets_quality.validate → Check for errors
3. sheets_quality.analyze_impact → Check formula dependencies
4. sheets_data.write → Execute with confidence

**USE BEFORE:** Large writes, deletes, or concurrent editing scenarios. Use analyze_impact to check formula dependencies.`,

  sheets_history: `📜 HISTORY - Operation audit & undo/redo (${ACTION_COUNTS['sheets_history']} actions).

**ROUTING - Pick this tool when:**
> Viewing what operations were performed (in this session)
> UNDOING a recent operation (this session only)
> Getting operation STATISTICS and timing
> Reverting to a previous operation state (this session)

**NOT this tool - use instead:**
> sheets_collaborate - For FILE version history (Google revisions, snapshots) — history across sessions
> sheets_session - For CONVERSATION context and natural language references
> sheets_analyze - For data quality insights

**ACTIONS BY CATEGORY:**
[Session Operations] list, get, stats, undo, redo, revert_to, clear
[Time-Travel] timeline (chronological change history with who/what/when), diff_revisions (cell-level diff between two revisions), restore_cells (surgically restore specific cells from a past revision)

**DECISION GUIDE:**
→ **Undo recent ServalSheets operation?** Use undo (session-scoped only)
→ **When did a value change?** Use timeline (shows chronological changes per cell, across sessions)
→ **Compare two points in time?** Use diff_revisions (cell-level diff between any two revisions)
→ **Restore specific cells without full revert?** Use restore_cells (surgical — restore just cells D15, E20 from Tuesday's revision)

**IMPORTANT - SESSION vs REVISION SCOPE:**
- undo/redo/revert_to: Session-scoped (THIS conversation only). Does NOT track manual Sheets UI edits.
- timeline/diff_revisions/restore_cells: Revision-scoped (Google Drive file history, across sessions and users).
For across-session recovery, use sheets_collaborate.version_* OR the time-travel actions above.

**Parameter format examples:**
- List operations: {"action":"list","spreadsheetId":"1ABC...","limit":10}
- Undo: {"action":"undo","spreadsheetId":"1ABC..."} ← Undoes last ServalSheets operation
- Timeline: {"action":"timeline","spreadsheetId":"1ABC...","range":"Sheet1!D1:D100","since":"2026-02-01","until":"2026-02-20"}
- Diff revisions: {"action":"diff_revisions","spreadsheetId":"1ABC...","revisionId1":"123","revisionId2":"456","range":"Sheet1!A1:Z100"}
- Restore cells: {"action":"restore_cells","spreadsheetId":"1ABC...","revisionId":"123","cells":["Sheet1!D15","Sheet1!E20"]}

**TOP 3 ACTIONS:**
1. timeline: {"action":"timeline","spreadsheetId":"1ABC...","range":"Sheet1!D1:D100","since":"2026-02-01"} ← When did data change?
2. undo: {"action":"undo","spreadsheetId":"1ABC..."} ← Revert last ServalSheets op
3. diff_revisions: {"action":"diff_revisions","spreadsheetId":"1ABC...","revisionId1":"123","revisionId2":"456"} ← Compare two points in time

**SAFETY:**
[Read-only] list, get, stats, timeline, diff_revisions
[Destructive] clear ← permanently erases operation history; restore_cells ← overwrites current cell values
[Non-idempotent] undo, redo ← calling twice reverses the operation; revert_to ← replays history to a point

**LIMITS:** Session ops track last 100 per spreadsheet. Timeline depends on Google Drive revision retention.
**API LIMITATION:** diff_revisions returns metadata comparison only (Google Drive API cannot export historical revision content for Workspace files — always returns current version). For cell-level change tracking, use timeline instead.
**TIME-TRAVEL WORKFLOW:**
1. timeline → Find when a value changed and which revision
2. diff_revisions → Compare that revision with current state
3. restore_cells → Surgically restore only the broken cells (NOT full revision revert)

**RECOVERY OPTIONS:**
- Quick undo: sheets_history.undo (session only)
- Find when data broke: sheets_history.timeline → diff_revisions → restore_cells
- Full revision restore: sheets_collaborate.version_restore_revision (all-or-nothing)`,

  sheets_confirm: `⚠️ CONFIRM - User confirmation before destructive operations (${ACTION_COUNTS['sheets_confirm']} actions).

**ROUTING - Pick this tool when:**
> You've PLANNED a multi-step operation and need user approval
> The operation is DESTRUCTIVE (deletes, overwrites >100 cells)
> The operation has HIGH RISK (irreversible, affects formulas)
> You want the user to review steps BEFORE execution

**NOT this tool - use instead:**
> Direct tool calls for SINGLE low-risk operations
> sheets_quality analyze_impact - To check impact BEFORE building a plan

**ACTIONS (5):** request, get_stats, wizard_start, wizard_step, wizard_complete

**HOW IT WORKS (MCP Elicitation SEP-1036):**
1. Claude builds a plan with steps, risks, estimates
2. sheets_confirm.request presents the plan to the user
3. User sees interactive UI in Claude Desktop/client
4. User approves/modifies/declines
5. Claude receives result and acts accordingly

**Parameter format examples:**
1. Build your plan:
   {
     "action": "request",
     "plan": {
       "title": "Delete Duplicate Rows",
       "description": "Remove 150 duplicate rows from Sales sheet",
       "steps": [
         {"stepNumber":1, "description":"Identify duplicates", "tool":"sheets_analyze", "action":"comprehensive", "risk":"low"},
         {"stepNumber":2, "description":"Delete 150 rows", "tool":"sheets_dimensions", "action":"delete", "risk":"high", "isDestructive":true}
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

  sheets_fix: `🔧 FIX - Auto-fix issues AND automated data cleaning pipeline (${ACTION_COUNTS['sheets_fix']} actions).

**DECISION GUIDE - Which action should I use?**
→ **sheets_analyze found formula/structure issues?** Use fix (auto-resolves volatile formulas, missing freezes, etc.)
→ **Messy data (whitespace, inconsistent formats, duplicates)?** Use suggest_cleaning first, then clean
→ **Dates/currencies/phones in different formats?** Use standardize_formats (normalize to consistent format)
→ **Empty cells in a dataset?** Use fill_missing (forward fill, mean, median, or constant)
→ **Need to find statistical outliers?** Use detect_anomalies (IQR or z-score methods)
→ **Not sure what's wrong?** Use suggest_cleaning for AI-powered recommendations

**ROUTING - Pick this tool when:**
> Auto-fixing formula/structure issues found by sheets_analyze
> Cleaning messy data: whitespace, duplicates, format inconsistencies, type mismatches
> Standardizing date/currency/phone/email formats across columns
> Filling empty cells with statistical strategies
> Detecting statistical outliers and anomalies

**NOT this tool - use instead:**
> sheets_analyze - First, to DETECT issues (comprehensive or analyze_quality)
> sheets_data/sheets_format - For MANUAL targeted fixes
> sheets_quality - For VALIDATING data before writing

**ACTIONS BY CATEGORY:**
[Issue Resolution] fix — auto-fix formula/structure issues (volatile formulas, missing freezes, etc.)
[Data Cleaning] clean (auto-detect+fix common issues), suggest_cleaning (AI recommendations)
[Format Standardization] standardize_formats (dates, currencies, phones, emails → consistent format)
[Gap Filling] fill_missing (forward, backward, mean, median, mode, constant)
[Anomaly Detection] detect_anomalies (IQR or z-score outlier flagging)

**Parameter format examples:**
- Fix issues: {"action":"fix","spreadsheetId":"1ABC...","issues":[...],"mode":"preview"}
- Auto-clean: {"action":"clean","spreadsheetId":"1ABC...","range":"Sheet1!A1:Z100","mode":"preview"}
- Clean with rules: {"action":"clean","spreadsheetId":"1ABC...","range":"Sheet1!A1:Z100","rules":["trim_whitespace","fix_dates","remove_duplicates"],"mode":"apply"}
- Standardize: {"action":"standardize_formats","spreadsheetId":"1ABC...","range":"Sheet1!A1:Z100","columns":[{"column":"B","targetFormat":"iso_date"},{"column":"D","targetFormat":"currency_usd"}]}
- Fill gaps: {"action":"fill_missing","spreadsheetId":"1ABC...","range":"Sheet1!C2:C100","strategy":"forward"}
- Detect outliers: {"action":"detect_anomalies","spreadsheetId":"1ABC...","range":"Sheet1!B2:B100","method":"iqr","threshold":1.5}
- Get suggestions: {"action":"suggest_cleaning","spreadsheetId":"1ABC...","range":"Sheet1!A1:Z100"}

**Built-in clean rules:** trim_whitespace, normalize_case, fix_dates, fix_numbers, fix_booleans, remove_duplicates, fix_emails, fix_phones, fix_urls, fix_currency
**Format targets:** iso_date, us_date, eu_date, currency_usd, currency_eur, phone_e164, email_lowercase, url_https, title_case, percentage
**Fill strategies:** forward (last known value), backward (next known value), mean, median, mode, constant

**DATA CLEANING WORKFLOW:**
1. suggest_cleaning → Get AI recommendations for what to clean
2. clean mode:"preview" → See proposed changes without modifying
3. clean mode:"apply" → Execute with snapshot for rollback

**SMART ROUTING:**
- Not sure what's wrong? → suggest_cleaning first (AI recommendations)
- Known issues from analyze? → fix (formula/structure issues)
- Messy data? → clean with mode:"preview" first, then mode:"apply"
- Inconsistent formats? → standardize_formats (dates, currencies, phones)
- Empty cells? → fill_missing (choose strategy based on data type)
- detect_anomalies and suggest_cleaning are always READ-ONLY (no modifications)`,

  //=============================================================================
  // COMPOSITE OPERATIONS
  //=============================================================================

  sheets_composite: `🔗 COMPOSITE - Pre-optimized workflows for common operations (${ACTION_COUNTS['sheets_composite']} actions). Combines multiple steps into single calls for 60-80% API savings.

**⚡ BEFORE DOING MANUAL OPERATIONS:**
BEFORE using 3+ separate tools (sheets_data + sheets_format + sheets_dimensions), check if sheets_composite can do it in 1-2 calls. This is the efficiency hub — most common multi-step workflows are here.

**DECISION GUIDE - Which action should I use?**
→ **Setting up a new sheet with headers + formatting?** Use setup_sheet (2 calls, NOT 5-6 manual ones)
→ **Adding rows but want column-matched safety?** Use smart_append (auto-matches by headers, safer than append)
→ **Importing data from CSV?** Use import_csv (parse + validate + write in 1 call)
→ **Removing duplicates?** Use deduplicate with preview:true first (see what gets removed before committing)
→ **Exporting to Excel?** Use export_xlsx (1 call, includes all formatting)
→ **Bulk updating multiple rows?** Use bulk_update (atomic, with preview support)

**Use when:** Importing CSV, setting up sheets with headers, appending with column matching, bulk updates, deduplication, exporting XLSX, cloning structure

**NOT this tool - use instead:**
> sheets_data - Simple single read/write operations
> sheets_transaction - Custom multi-step operations needing atomicity
> sheets_core - Creating spreadsheets without templates
> sheets_format - One-off format changes

**ACTIONS BY CATEGORY:**
[Import/Export] import_csv, import_xlsx, import_and_format, export_xlsx, export_large_dataset, get_form_responses
[Data Operations] smart_append, bulk_update, deduplicate, clone_structure
[Sheet Setup] setup_sheet
[AI Sheet Generation] generate_sheet (create spreadsheet from description), generate_template (create reusable template from description), preview_generation (dry-run: see proposed structure without creating)
[Audit & Reporting] audit_sheet (data quality audit: formula counts, type checks, blank cells), publish_report (export sheet as PDF/XLSX/CSV with title + date)
[Pipeline & Migration] data_pipeline (sequential ETL: filter → sort → deduplicate → transform → aggregate), instantiate_template (apply saved template with {{placeholder}} substitution), migrate_spreadsheet (migrate data between spreadsheets with column mapping)

**🏆 EFFICIENCY POWERHOUSE - USE THESE FIRST:**

**setup_sheet - FASTEST PATH FOR NEW SHEETS:**
Creates headers + formatting + freeze + optional data + optional alternating rows in just 2 API calls (NOT 7-8 manual ones).
Compare: manual = sheets_core.add_sheet + sheets_data.write + sheets_format.set_format + sheets_format.apply_preset + sheets_dimensions.freeze + sheets_dimensions.auto_resize (6-8 calls)
Example: {"action":"setup_sheet","spreadsheetId":"1ABC...","sheetId":0,"headers":["Name","Age","Email"],"freezeHeaderRow":true,"formatAsTable":true}

**smart_append - AUTO-MATCH COLUMNS:**
Automatically matches data columns by header name — no manual column mapping needed. Appends data only if headers match.
Compare: manual = sheets_data.read(headers) + match_columns_manually + sheets_data.append (3+ calls)
Example: {"action":"smart_append","spreadsheetId":"1ABC...","range":"Sheet1!A1:D100","data":[["Alice",30,"alice@example.com"]]}

**deduplicate - WITH PREVIEW:**
Use deduplicate with preview:true first to see what gets removed before committing.
Example: {"action":"deduplicate","spreadsheetId":"1ABC...","range":"Sheet1!A1:D100","preview":true} → Review results
Then: {"action":"deduplicate","spreadsheetId":"1ABC...","range":"Sheet1!A1:D100","mode":"remove"}

**import_csv - BULK LOAD WITH VALIDATION:**
Loads CSV, validates types/formats, writes to sheet in 1 call. Option to create new sheet or append to existing.
Example: {"action":"import_csv","spreadsheetId":"1ABC...","csvPath":"/path/to/file.csv","sheetName":"Data","hasHeader":true}

**Parameter format examples:**
- Setup sheet: {"action":"setup_sheet","spreadsheetId":"1ABC...","sheetId":0,"headers":["Name","Age","Email"],"freezeHeaderRow":true}
- Smart append: {"action":"smart_append","spreadsheetId":"1ABC...","range":"Sheet1!A1:D100","data":[["Alice",30]]}
- Import CSV: {"action":"import_csv","spreadsheetId":"1ABC...","csvPath":"/path/to/file.csv","sheetName":"Data"}
- Deduplicate (preview first): {"action":"deduplicate","spreadsheetId":"1ABC...","range":"Sheet1!A1:D100","preview":true}
- Bulk update: {"action":"bulk_update","spreadsheetId":"1ABC...","range":"Sheet1!A2:D100","updates":[...]}

**Savings:** 60-80% fewer API calls vs manual approach (e.g., setup_sheet: 2-3 calls vs 5-7 manual calls)

**AI SHEET GENERATION:**
→ **Create spreadsheet from a description?** Use generate_sheet ("Q1 budget tracker with revenue by month and profit margin formulas")
→ **Preview before creating?** Use preview_generation (returns proposed columns, formulas, formatting — no spreadsheet created)
→ **Save as reusable template?** Use generate_template (parameterizes text columns with {{placeholder}} tokens)

**Parameter format examples (AI generation):**
- Generate sheet: {"action":"generate_sheet","description":"Q1 budget tracker with revenue, expenses, and profit margin by month","style":"professional"}
- Preview first: {"action":"preview_generation","description":"Employee time tracking with weekly hours and overtime calculation"}
- Generate template: {"action":"generate_template","description":"Monthly expense report","parameterize":true}

**AUDIT & REPORTING:**
→ **Audit a spreadsheet for data quality?** Use audit_sheet (formula counts, mixed types, blank cells, locked ranges)
→ **Export a sheet as a report?** Use publish_report (PDF/XLSX/CSV with optional title + timestamp)

**Parameter format examples (audit & reporting):**
- Audit sheet: {"action":"audit_sheet","spreadsheetId":"1ABC...","sheetName":"Budget"}
- Publish report: {"action":"publish_report","spreadsheetId":"1ABC...","sheetName":"Summary","format":"pdf","title":"Q1 Report"}

**PIPELINE & MIGRATION:**
→ **Run ETL on a range?** Use data_pipeline (chain: filter → sort → deduplicate → transform → aggregate in 1 call)
→ **Apply a saved template with variable substitution?** Use instantiate_template (replaces {{placeholder}} tokens with values)
→ **Move data between spreadsheets?** Use migrate_spreadsheet (column mapping + optional type transforms)

**Parameter format examples (pipeline & migration):**
- Data pipeline: {"action":"data_pipeline","spreadsheetId":"1ABC...","range":"Sheet1!A1:D100","steps":[{"type":"filter","column":"Status","value":"Active"},{"type":"sort","column":"Date","order":"desc"}]}
- Instantiate template: {"action":"instantiate_template","spreadsheetId":"1ABC...","templateId":"tmpl_001","variables":{"MONTH":"March","YEAR":"2026"}}
- Migrate spreadsheet: {"action":"migrate_spreadsheet","sourceSpreadsheetId":"1ABC...","destinationSpreadsheetId":"1DEF...","columnMapping":{"A":"B","B":"C"}}

**COMMON WORKFLOWS:**
- New sheet from scratch? → setup_sheet (2 calls) for manual, OR generate_sheet for AI-powered
- Create from description? → preview_generation → generate_sheet (AI creates structure + formulas + formatting)
- Import CSV and clean up? → import_csv + deduplicate
- Add data with header matching? → smart_append (auto-matches)
- Full sheet setup + data? → import_and_format (1 call)
- Bulk update with safety? → bulk_update with preview:true first
- Save as template? → generate_template (from description) or sheets_templates.create (from existing sheet)
- Audit before sharing? → audit_sheet → publish_report (quality check then export)
- Migrate data between files? → migrate_spreadsheet (column mapping preserves structure)
- ETL on existing data? → data_pipeline (filter + sort + dedup + transform in 1 call)`,

  //=============================================================================
  // SESSION CONTEXT
  //=============================================================================

  sheets_session: `📋 SESSION - Conversation context for natural language (${ACTION_COUNTS['sheets_session']} actions).

**Tip:** Call action:"set_active" early to enable natural language references. Checkpoints require ENABLE_CHECKPOINTS=true.

**ROUTING - Pick this tool when:**
> Setting the "active" spreadsheet for natural language references
> Recording operations for undo support in this conversation
> Resolving references like "the spreadsheet", "that sheet", "the budget"
> Storing user preferences or conversation checkpoints
> Finding spreadsheets by natural language descriptions

**NOT this tool - use instead:**
> sheets_history - For OPERATION AUDIT trail (what was changed and when)
> sheets_collaborate - For FILE versions and versions history
> sheets_core - For getting spreadsheet metadata

**ACTIONS BY CATEGORY:**
[Context] set_active, get_active, get_context
[History] record_operation, get_last_operation, get_history
[References] find_by_reference
[Preferences] update_preferences, get_preferences
[Pending] set_pending, get_pending, clear_pending
[Checkpoints] save_checkpoint, load_checkpoint, list_checkpoints, delete_checkpoint
[Alerts] get_alerts, acknowledge_alert, clear_alerts
[Profile] set_user_id, get_profile, update_profile_preferences
[Formula Learning] record_successful_formula, reject_suggestion, get_top_formulas
[Reset] reset

**🚀 CALL THIS FIRST IN MULTI-STEP WORKFLOWS:**
Use action:"set_active" at the start of any multi-step workflow. This stores the spreadsheet context so subsequent tools can use natural language references.
Example workflow:
1. sheets_session.set_active → Stores active spreadsheet ID + title
2. "Update the budget" → Resolves to active spreadsheet (no need to repeat spreadsheetId)
3. sheets_data operations now don't need spreadsheetId parameter (implicit context)

**TOP 3 ACTIONS:**
1. set_active: {"action":"set_active","spreadsheetId":"1ABC...","title":"Budget 2025"} ← CALL THIS FIRST
2. get_context: {"action":"get_context"} → Returns active spreadsheet, last operation, pending ops
3. find_by_reference: {"action":"find_by_reference","reference":"the budget spreadsheet","type":"spreadsheet"}

**reference types:** spreadsheet, sheet, range, cell
**Enables natural language:** "Update the budget" → Resolves to the active spreadsheet. "Undo that" → Uses session history.
**NATURAL LANGUAGE WORKFLOW:**
1. set_active("1ABC...") → Store context
2. "Update column A" → Tools now know which spreadsheet
3. Subsequent operations don't need spreadsheetId (use active context)`,

  //=============================================================================
  // ENTERPRISE TIER 7
  //=============================================================================

  sheets_templates: `📄 TEMPLATES - Reusable spreadsheet templates (${ACTION_COUNTS['sheets_templates']} actions).

**ROUTING - Pick this tool when:**
> Creating a new spreadsheet from a TEMPLATE
> Saving a spreadsheet AS a template for reuse
> Managing your template library
> Using builtin templates from knowledge base (import_builtin)

**NOT this tool - use instead:**
> sheets_core - For CREATING spreadsheets without templates
> sheets_collaborate - For FILE snapshots/backups/versions
> sheets_composite.setup_sheet - For quick setup instead of templates

**ACTIONS BY CATEGORY:**
[List] list (with optional category filter, includeBuiltin)
[CRUD] get, create, update, delete
[Use] apply (create spreadsheet from template), preview
[Import] import_builtin (from knowledge base)

**Parameter format examples:**
- List templates: {"action":"list","includeBuiltin":true}
- Apply template: {"action":"apply","templateId":"budget-2024","title":"Q1 Budget"}
- Create template: {"action":"create","spreadsheetId":"1ABC...","name":"My Budget Template"}
- Import builtin: {"action":"import_builtin","templateId":"expense_tracker"}

**TOP 3 ACTIONS:**
1. list: {"action":"list","includeBuiltin":true} -> See all templates
2. apply: {"action":"apply","templateId":"budget-2024","title":"Q1 Budget"} -> Create from template
3. create: {"action":"create","spreadsheetId":"1ABC...","name":"My Budget Template"} -> Save as template

**STORAGE:** Templates are stored in your Google Drive appDataFolder (hidden, private, auto-cleanup on uninstall).

**TIP:** Use import_builtin to import pre-built templates from ServalSheets knowledge base.`,

  sheets_bigquery: `📊 BIGQUERY - Connected Sheets integration (${ACTION_COUNTS['sheets_bigquery']} actions).

**Requires:** BigQuery API enabled in GCP project + bigquery.readonly or bigquery OAuth scope.

**ROUTING - Pick this tool when:**
> Connecting Google Sheets to BigQuery data sources
> Running SQL queries on BigQuery from Sheets
> Exploring BigQuery datasets and table schemas
> Exporting sheet data TO BigQuery tables
> Importing BigQuery query results INTO sheets

**NOT this tool - use instead:**
> sheets_data - For regular read/write within the spreadsheet
> sheets_visualize - For creating charts from sheet data

**ACTIONS BY CATEGORY:**
[Connection] connect, connect_looker, disconnect, list_connections, get_connection
[Query] query (run SQL), preview (test without full execution), refresh (update data), cancel_refresh
[Discovery] list_datasets, list_tables, get_table_schema
[Transfer] export_to_bigquery, import_from_bigquery
[Scheduled] create_scheduled_query, list_scheduled_queries, delete_scheduled_query

**TOP 3 ACTIONS:**
1. query: {"action":"query","projectId":"my-project","query":"SELECT * FROM dataset.table LIMIT 100"}
2. list_tables: {"action":"list_tables","projectId":"my-project","datasetId":"my_dataset"}
3. import_from_bigquery: {"action":"import_from_bigquery","spreadsheetId":"1ABC...","projectId":"my-project","query":"SELECT ..."}

**projectId:** Your GCP project ID (e.g., "my-project-12345")
**TIP:** Use preview to test expensive queries before full execution.`,

  sheets_appsscript: `⚡ APPSSCRIPT - Apps Script automation (${ACTION_COUNTS['sheets_appsscript']} actions).

**Requires:** USER OAuth only (NOT service accounts). Apps Script API must be enabled in GCP.

**ROUTING - Pick this tool when:**
> Creating, updating, or managing Apps Script projects
> Deploying scripts as web apps, API executables, or scheduled triggers
> Running Apps Script functions remotely
> Monitoring script execution, logs, and performance
> Creating automation workflows extending Sheets functionality

**NOT this tool - use instead:**
> sheets_data - For direct cell manipulation and data changes
> sheets_composite - For high-level data operations (import, append, etc.)
> sheets_analyze - For AI-powered data analysis
> sheets_dimensions/sheets_format - For structural/styling changes

**ACTIONS BY CATEGORY:**
[Project] create, get, get_content, update_content
[Version] create_version, list_versions, get_version
[Deploy] deploy, list_deployments, get_deployment, undeploy
[Execute] run (execute function), list_processes (logs), get_metrics
[Trigger] create_trigger, list_triggers, delete_trigger, update_trigger

**TOP 3 ACTIONS:**
1. run: {"action":"run","scriptId":"1ABC...","functionName":"myFunction","parameters":["arg1"]}
2. get_content: {"action":"get_content","scriptId":"1ABC..."}
3. deploy: {"action":"deploy","scriptId":"1ABC...","deploymentType":"WEB_APP","access":"ANYONE"}

**⚠️ SAFETY:** run executes code with SIDE EFFECTS. deploy creates PUBLIC endpoints.
**scriptId:** From Apps Script editor. **deploymentType:** WEB_APP, EXECUTION_API
**TIP:** Use devMode:true to test latest code (owner only) before deploying.`,

  sheets_webhook: `🔔 WEBHOOK - Event-driven automation and real-time notifications (${ACTION_COUNTS['sheets_webhook']} actions).

**Requires:** Redis backend (set \`REDIS_URL\` env var) + HTTPS endpoint that returns 200 OK within 10s. Without \`REDIS_URL\`, all actions return \`CONFIG_ERROR\`.

**ROUTING - Pick this tool when:**
> Setting up REAL-TIME notifications for spreadsheet changes
> Triggering EXTERNAL systems when data updates
> Building EVENT-DRIVEN workflows and automation
> Monitoring spreadsheet ACTIVITY in real-time
> Integrating with external webhooks or callback systems

**NOT this tool - use instead:**
> sheets_data - For direct read/write operations
> sheets_history - For viewing PAST changes (this session)
> sheets_collaborate - For sharing and permissions
> sheets_appsscript - For custom automation within Sheets

**ACTIONS BY CATEGORY:**
[Lifecycle] register (create webhook), unregister (remove webhook), get (view details), list (all webhooks), watch_changes (monitor updates)
[Testing] test (send test payload), get_stats (delivery metrics)

**TOP 3 ACTIONS:**
1. register: {"action":"register","spreadsheetId":"1ABC...","webhookUrl":"https://api.example.com/webhook","eventTypes":["cell.update"],"secret":"your-secret-key"}
2. list: {"action":"list","spreadsheetId":"1ABC..."}
3. test: {"action":"test","webhookId":"wh_123"}

**webhookUrl format:** "https://api.example.com/webhook" (HTTPS only, not HTTP)
**eventTypes examples:** cell.update, format.update, sheet.create, sheet.delete, sheet.rename, all
**secret parameter:** Used for HMAC signature verification (recommended)

**eventTypes:** cell.update, format.update, sheet.create/delete/rename, all
**Limits:** Max 1 day lifetime (re-register daily). HTTPS only. Use secret for HMAC verification.`,

  sheets_dependencies: `🔗 DEPENDENCIES - Formula dependency analysis and impact assessment (${ACTION_COUNTS['sheets_dependencies']} actions).

**ROUTING - Pick this tool when:**
> Understanding FORMULA relationships and dependencies
> Analyzing IMPACT of changing specific cell values
> Detecting CIRCULAR REFERENCES causing #REF! errors
> Finding what cells DEPEND ON a given cell
> Visualizing formula DEPENDENCY GRAPHS
> Planning spreadsheet REFACTORING safely
> Checking formula complexity before changes

**NOT this tool - use instead:**
> sheets_analyze - For general spreadsheet analysis and quality insights
> sheets_quality - For error DETECTION and impact analysis
> sheets_fix - For AUTO-FIXING formula errors
> sheets_data - For reading/writing cell VALUES

**ACTIONS BY CATEGORY:**
[Analysis] build (create graph), analyze_impact (what changes affect), get_stats (complexity metrics)
[Queries] get_dependencies (what cell depends on), get_dependents (what depends on cell)
[Quality] detect_cycles (find circular refs)
[Export] export_dot (Graphviz visualization)
[Scenario Modeling] model_scenario ("what if revenue drops 20%?" — traces full recalculation cascade), compare_scenarios (side-by-side comparison of multiple what-if scenarios), create_scenario_sheet (materialize scenario as new sheet)

**DECISION GUIDE:**
→ **What cells does this formula depend on?** Use get_dependencies
→ **What breaks if I change this cell?** Use analyze_impact or get_dependents
→ **Circular reference errors?** Use detect_cycles
→ **What if revenue drops 20%?** Use model_scenario (traces formula cascade, shows all affected cells with deltas)
→ **Compare best/worst/expected cases?** Use compare_scenarios (multiple scenarios side-by-side)
→ **Save a scenario as a separate sheet?** Use create_scenario_sheet (non-destructive copy with changes applied)

**TOP 3 ACTIONS:**
1. model_scenario: {"action":"model_scenario","spreadsheetId":"1ABC...","changes":[{"cell":"Revenue!B2","newValue":80000}]} ← What-if analysis with full cascade
2. analyze_impact: {"action":"analyze_impact","spreadsheetId":"1ABC...","cell":"Data!A1"}
3. compare_scenarios: {"action":"compare_scenarios","spreadsheetId":"1ABC...","scenarios":[{"name":"Best Case","changes":[{"cell":"B2","newValue":120000}]},{"name":"Worst Case","changes":[{"cell":"B2","newValue":60000}]}]}

**Parameter format examples (Scenario Modeling):**
- Model scenario: {"action":"model_scenario","spreadsheetId":"1ABC...","changes":[{"cell":"Revenue!B2","newValue":80000},{"cell":"Revenue!C2","newValue":85000}]}
- Compare scenarios: {"action":"compare_scenarios","spreadsheetId":"1ABC...","scenarios":[{"name":"Conservative","changes":[{"cell":"B2","newValue":90000}]},{"name":"Aggressive","changes":[{"cell":"B2","newValue":150000}]}]}
- Materialize: {"action":"create_scenario_sheet","spreadsheetId":"1ABC...","scenario":{"name":"Q2 Conservative","changes":[{"cell":"B2","newValue":90000}]}}

**cell format:** "Sheet1!A1" or "Sheet1!A1:C10"

**SCENARIO WORKFLOW:**
1. build → Create dependency graph
2. model_scenario → "What if revenue drops 20%?" → See all cascading effects
3. compare_scenarios → Compare conservative vs aggressive vs expected
4. create_scenario_sheet → Save chosen scenario as separate sheet for stakeholders

**SAFETY:**
[Read-only] build, analyze_impact, get_dependencies, get_dependents, detect_cycles, get_stats, export_dot, model_scenario, compare_scenarios
[Safe mutation] create_scenario_sheet ← creates new sheet (non-destructive to original data, but requires confirmation)

**TIP:** Run detect_cycles first, then model_scenario for accurate what-if analysis.`,

  sheets_federation: `🌐 FEDERATION - Call external MCP servers for composite workflows (${ACTION_COUNTS['sheets_federation']} actions).

**PREREQUISITES:** Set MCP_FEDERATION_ENABLED=true and MCP_FEDERATION_SERVERS in environment. Remote servers must be running and accessible.

**ROUTING - Pick this tool when:**
> Integrating EXTERNAL data sources (weather, ML models, databases)
> Chaining operations across MULTIPLE services (analyze → transform → write to Sheets)
> Calling specialized MCP SERVERS (Python analytics, SQL databases)
> Building COMPOSITE workflows that combine different MCP tools
> Connecting to THIRD-PARTY APIs via their MCP server implementations

**NOT this tool - use instead:**
> sheets_data - For direct Sheets read/write operations
> sheets_bigquery - For BigQuery integration (built-in)
> sheets_webhook - For receiving notifications FROM external services
> sheets_appsscript - For custom JavaScript automation WITHIN Sheets

**ACTIONS BY CATEGORY:**
[Execution] call_remote (invoke remote tool)
[Discovery] list_servers (configured servers), get_server_tools (available tools on server)
[Health] validate_connection (test connectivity)

**Parameter format examples:**
- Call remote: {"action":"call_remote","serverName":"weather-api","toolName":"get_forecast","toolInput":{"location":"San Francisco"}}
- List servers: {"action":"list_servers"}
- Get tools: {"action":"get_server_tools","serverName":"ml-server"}
- Validate: {"action":"validate_connection","serverName":"weather-api"}

**TOP 3 ACTIONS:**
1. call_remote: {"action":"call_remote","serverName":"weather-api","toolName":"get_forecast","toolInput":{"location":"SF","days":7}} -> Call remote MCP tool
2. list_servers: {"action":"list_servers"} -> See configured remote servers
3. validate_connection: {"action":"validate_connection","serverName":"weather-api"} -> Test connection

**CONFIGURATION:**
Set MCP_FEDERATION_SERVERS environment variable with JSON array:
[{"name":"weather-api","url":"http://localhost:3001","auth":{"type":"bearer","token":"sk-..."}}]

**SECURITY:** Only call trusted MCP servers. Use bearer tokens. Set timeouts (default: 30s). Validate responses before writing.
**WORKFLOW:** validate_connection → get_server_tools → call_remote → sheets_data.write results. Results cached 5 min.`,
};

// Type export for other modules
export type ToolName = keyof typeof TOOL_DESCRIPTIONS;

// Helper to get description with fallback
export function getToolDescription(name: string): string {
  return TOOL_DESCRIPTIONS[name as ToolName] ?? `${name} operations`;
}
