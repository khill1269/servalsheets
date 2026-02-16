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
 * Total: 22 tools, 298 actions (see TOOL_COUNT/ACTION_COUNT in index.ts)
 *
 * PREREQUISITES documented for each tool to prevent wrong-order calls.
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

**⚠️ FIRST TIME WITH THIS SPREADSHEET?**
Use sheets_analyze action:"comprehensive" or action:"scout" instead of sheets_core.get for richer metadata + quality insights in same API cost. scout is fastest for structure-only needs.

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

**⚡ BATCH OPERATION THRESHOLD:**
WHEN TO BATCH: If getting metadata from 3+ spreadsheets OR managing 3+ sheets, ALWAYS use batch_* operations — same Google API quota cost, 1 API call instead of N (80-95% fewer round trips).
EXAMPLE: Getting 5 spreadsheet metadata = 1 API call with batch_get, NOT 5 separate get calls.

**Parameter format examples:**
- Create: {"action":"create","title":"My Spreadsheet"}
- Get metadata: {"action":"get","spreadsheetId":"1ABC..."}
- Batch get metadata: {"action":"batch_get","spreadsheetIds":["1ABC...","1DEF...","1GHI..."]} ← 3 spreadsheets in 1 call!
- Add sheet: {"action":"add_sheet","spreadsheetId":"1ABC...","title":"New Sheet"}
- Batch delete sheets: {"action":"batch_delete_sheets","spreadsheetId":"1ABC...","sheetIds":[123,456,789]} ← 3 sheets deleted in 1 call!
**Tip:** Use sheets_analyze comprehensive instead of get for metadata + data + analysis in 1 call

**SMART ROUTING:**
- Need sheet with headers + formatting? → Use sheets_composite.setup_sheet (not add_sheet + write + format separately)
- Clone structure? → Use sheets_core.duplicate_sheet or sheets_composite.clone_structure
- Just checking sheet names? → Use sheets_analyze.scout (faster, includes column info)
- Managing 3+ sheets? → Use batch_delete_sheets or batch_update_sheets (80%+ savings!)`,

  sheets_data: `📝 DATA - Read and write cell values, notes, and hyperlinks (${ACTION_COUNTS['sheets_data']} actions). Append rows, find/replace text, merge cells.

**⚠️ FIRST TIME WITH THIS SPREADSHEET?**
If you haven't analyzed this spreadsheet yet, START with sheets_analyze action:"comprehensive" or action:"scout" to understand structure, data quality, and column types. Prevents mistakes and saves time (70%+ faster).

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
**ACTIONS (18):** read, write, append, clear, batch_read, batch_write, batch_clear, find_replace, add_note, get_note, clear_note, set_hyperlink, clear_hyperlink, merge_cells, unmerge_cells, get_merges, cut_paste, copy_paste
**Batch operations:** 3+ ranges? Use batch_read/batch_write (1 call vs N calls, 80%+ quota savings)
**Common actions:** read, write, append, batch_read, batch_write, find_replace, clear
**Range format:** Always include sheet name: "Sheet1!A1:D10" (case-sensitive, use quotes for spaces/emoji: "'My Sheet'!A1:D10" or "'📊 Dashboard'!A1:D10")

⚠️ **EMOJI SHEET NAMES:** ALWAYS use single quotes: "'📊 Dashboard'!A1:Z30" NOT "📊 Dashboard!A1:Z30"

ℹ️ **SPARKLINE NOTE:** SPARKLINE formulas render visually but API reads return empty values (expected behavior). Don't retry or investigate empty SPARKLINE reads.

**Parameter format examples:**
- Read single: {"action":"read","spreadsheetId":"1ABC...","range":"Sheet1!A1:D10"}
- Read batch: {"action":"batch_read","spreadsheetId":"1ABC...","ranges":["Sheet1!A1:D100","Sheet2!A1:B50"]} ← Same API cost as read, but gets 2 ranges!
- Write: {"action":"write","spreadsheetId":"1ABC...","range":"Sheet1!A1:D10","values":[["Name","Age"],["Alice",30]]}
- Write batch: {"action":"batch_write","spreadsheetId":"1ABC...","data":[{"range":"Sheet1!A1:D10","values":[...]},{"range":"Sheet2!A1:B20","values":[...]}]}
- Append: {"action":"append","spreadsheetId":"1ABC...","range":"Sheet1!A:D","values":[["Bob",25]]}
**spreadsheetId format:** "1abc123def456..." (long alphanumeric from URL)
**Safety:** write/clear are destructive - use dryRun:true to preview, sheets_confirm for >100 cells

**🎯 DYNAMIC RANGES WITH DATAFILTER:**

Hard-coded ranges (A1:B10) break when rows/columns are inserted or deleted. DataFilter provides resilient alternatives:

**1. Developer Metadata Lookup (RECOMMENDED for production):**
Tag your data ranges first (use sheets_advanced.set_metadata), then query by metadata instead of A1 notation. The metadata moves with your data!

Example - Tag a range:
{"tool":"sheets_advanced","action":"set_metadata","spreadsheetId":"1ABC...","metadataKey":"dataset:sales_2024","metadataValue":"Q1 revenue data","location":{"sheetId":0,"dimensionRange":{"dimension":"ROWS","startIndex":0,"endIndex":100}}}

Example - Read by metadata:
{"action":"read","spreadsheetId":"1ABC...","dataFilter":{"developerMetadataLookup":{"metadataKey":"dataset:sales_2024","locationType":"SHEET"}}}

Example - Write by metadata:
{"action":"write","spreadsheetId":"1ABC...","dataFilter":{"developerMetadataLookup":{"metadataKey":"summary:totals"}},"values":[["Total Sales",1250000]]}

**2. Grid Range (row/column indices, 0-indexed):**
{"action":"read","spreadsheetId":"1ABC...","dataFilter":{"gridRange":{"sheetId":0,"startRowIndex":0,"endRowIndex":100,"startColumnIndex":0,"endColumnIndex":5}}}

**3. A1 Range (fallback for dynamic batch operations):**
{"action":"batch_read","spreadsheetId":"1ABC...","dataFilters":[{"a1Range":"Sheet1!A1:D10"}]}

**WHEN TO USE DATAFILTER:**
✓ Production systems with frequent structural changes (rows/columns inserted/deleted)
✓ Multi-user spreadsheets where data grows dynamically
✓ Semantic data organization (tag ranges by purpose, not position: "current_month", "totals_row")
✓ Automated reports that need to find "Q4 sales data" or "summary section"

**WHEN NOT TO USE DATAFILTER:**
✗ Static templates with fixed structure (A1 notation is simpler)
✗ One-time scripts or ad-hoc queries (overhead not justified)
✗ When you need specific cell references (dataFilter returns matched ranges, not specific cells)

**NOTE:** DataFilter requires sheets_advanced.set_metadata to tag ranges first. Use sheets_advanced.get_metadata to list all tagged ranges.

**⚡ BATCH OPERATION THRESHOLD:**
WHEN TO BATCH: If reading/writing 3+ ranges, ALWAYS use batch_read/batch_write — same Google API quota cost, 1 API call instead of N (80-95% fewer round trips).
EXAMPLE: Reading 5 ranges = 1 API call with batch_read, NOT 5 separate calls.

**COMMON MISTAKES (AVOID!):**
1. Range format: ✅ "Sheet1!A1:D10" ✅ "'My Sheet'!A1:D10" | ❌ "A1:D10" (missing sheet name) | ❌ "Sheet1A1:D10" (wrong syntax)
2. Using write instead of append: ❌ write for new rows requires finding last row manually | ✅ append auto-finds last row
3. Multiple sequential reads instead of batch: ❌ Multiple read calls | ✅ batch_read in 1 call
4. Not validating before large writes: ❌ write directly | ✅ sheets_quality.validate first, then write

**SMART ROUTING:**
- Need to add rows? → Use append (auto-finds last row) NOT write
- 3+ ranges to read/write? → Use batch_read/batch_write (same API cost!)
- 5+ operations that must succeed together? → Use sheets_transaction (1 API call, 80%+ savings)
- Bulk updating 50+ rows? → Use sheets_transaction OR sheets_composite.bulk_update
- Need column matching? → Use sheets_composite.smart_append instead
- Want to validate first? → Run sheets_quality.validate before write
- Need structure first? → Run sheets_analyze.scout (0 data transfer)`,

  //=============================================================================
  // FORMATTING & STYLING
  //=============================================================================

  sheets_format: `🎨 FORMAT - Cell styling, sparklines & conditional rules (${ACTION_COUNTS['sheets_format']} actions). set_format, suggest_format, set_background, set_text_format, set_number_format, set_alignment, set_borders, clear_format, apply_preset, auto_fit, batch_format, sparkline_add, sparkline_get, sparkline_clear, rule_add_conditional_format, rule_update_conditional_format, rule_delete_conditional_format, rule_list_conditional_formats, set_data_validation, clear_data_validation, list_data_validations, add_conditional_format_rule

**⚠️ FIRST TIME WITH THIS SPREADSHEET?**
If you haven't analyzed this spreadsheet yet, call sheets_analyze action:"comprehensive" first to understand structure and get formatting recommendations. Use sheets_format.suggest_format for AI-powered format suggestions.

**DECISION GUIDE - Which action should I use?**
→ **Formatting 3+ ranges?** ALWAYS use batch_format — 1 API call for all, 80%+ savings vs sequential calls
→ **Need a professional look?** Use sheets_composite.setup_sheet (headers+format+freeze in 2 calls, NOT sheets_format calls)
→ **Just 1-2 format changes?** Use individual set_format (simple, 1 call per range)
→ **Setting up a new sheet?** Use sheets_composite.setup_sheet instead (includes headers+format+freeze atomically)

**PREREQUISITES:** sheets_auth must be authenticated.

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

**ACTIONS (22):** set_format, suggest_format, set_background, set_text_format, set_number_format, set_alignment, set_borders, clear_format, apply_preset, auto_fit, batch_format, sparkline_add, sparkline_get, sparkline_clear, rule_add_conditional_format, rule_update_conditional_format, rule_delete_conditional_format, rule_list_conditional_formats, set_data_validation, clear_data_validation, list_data_validations, add_conditional_format_rule

**COST COMPARISON (Quick Win #3):**
┌─────────────────────────────────────────────────────────────────┐
│ EXAMPLE: Formatting header + 3 columns                         │
├─────────────────────────────────────────────────────────────────┤
│ ❌ BAD:  set_format x4 = 4 API calls, ~800ms                   │
│ ✅ GOOD: batch_format = 1 API call, ~250ms (75% savings!)      │
│ ✅ BETTER: sheets_composite.setup_sheet = 2 calls (full setup) │
└─────────────────────────────────────────────────────────────────┘
- batch_format: Apply up to 100 format changes in 1 call
- apply_preset: Common formats in 1 call (header, currency, percentage, etc.)
- set_format: Custom format, 1 call per range (~200ms)
- **TIP:** Use batch_format for 3+ changes, apply_preset for common patterns

**ACTIONS BY CATEGORY:**
[Style] set_format, set_background, set_text_format, set_number_format, set_alignment, set_borders
[Helpers] suggest_format, clear_format, apply_preset, auto_fit
[Conditional] add_conditional_format_rule (RECOMMENDED - uses presets), rule_add_conditional_format (advanced - complex schema), rule_update_conditional_format, rule_delete_conditional_format, rule_list_conditional_formats
[Validation] set_data_validation, clear_data_validation, list_data_validations
[Batch] batch_format ← Use for 3+ format changes (80%+ savings!)

**TOP 3 ACTIONS:**
1. batch_format: {"action":"batch_format","spreadsheetId":"1ABC...","requests":[{"range":"Sheet1!A1:D1","format":{...}},{"range":"Sheet1!A2:D10","format":{...}}]} ← 2+ formats in 1 call!
2. apply_preset: {"action":"apply_preset","spreadsheetId":"1ABC...","range":"Sheet1!A1:D10","preset":"header_row"} ← Quick professional look
3. set_background: {"action":"set_background","spreadsheetId":"1ABC...","range":"Sheet1!A1:D1","color":"#4285F4"}

**RANGE FORMAT:** Always include sheet name! "Sheet1!A1:D10" not "A1:D10". Case-sensitive. For spaces/emoji use quotes: "'My Sheet'!A1:D10" or "'📊 Dashboard'!A1:D10"

⚠️ **CRITICAL:** Copy sheet names from API responses, never type emoji manually (lookalikes like 📨/📈 or 💠/💰 cause silent failures)
**spreadsheetId format:** "1abc123def456..." (from Google Sheets URL)
**sheetId:** Numeric ID from sheets_core.list_sheets (e.g., 0, 123456789), not sheet name

**PROFESSIONAL LOOK IN 1 CALL:**
For fast professional formatting, use apply_preset with preset codes. Example:
- apply_preset with preset:"header_row" → Bolds header, applies light background
- apply_preset with preset:"alternating_rows" → Striped rows for readability
Combine both in sequence (2 calls total) for professional table look, OR use sheets_composite.setup_sheet (includes all in 2 calls).

**SMART ROUTING:**
- 1-2 format ranges? → Use individual set_format (simple, fast)
- 3+ ranges with same format? → Use batch_format (1 API call for ALL, 80%+ savings!)
- Conditional formatting? → Use add_conditional_format_rule with presets (SIMPLER than rule_add_conditional_format)
- Need professional look? → Use apply_preset: header_row + alternating_rows (2 calls)
- Brand new sheet setup? → Use sheets_composite.setup_sheet (includes format, 2 calls total)
- Complex multi-step? → Use sheets_transaction for atomic batch`,

  //=============================================================================
  // DIMENSIONS & STRUCTURE
  //=============================================================================

  sheets_dimensions: `📐 DIMENSIONS - Rows, columns, filters, sorting (${ACTION_COUNTS['sheets_dimensions']} actions).

**DECISION GUIDE - Which action should I use?**
→ **Need 3+ dimension changes?** Use sheets_transaction to batch them (1 API call, 80%+ savings vs sequential)
→ **Setting up a new sheet?** Use sheets_composite.setup_sheet (includes freeze, format, headers in 2 calls)
→ **Just 1-2 operations?** Use individual actions (simple, fast)

**PREREQUISITES:** sheets_auth must be authenticated. Recommended: Get sheetId from sheets_core.list_sheets first.

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

**⚡ BATCH OPERATION THRESHOLD:**
WHEN TO BATCH: If making 3+ dimension changes (insert + hide + freeze, or multiple inserts), ALWAYS use sheets_transaction — same Google API quota cost, 1 API call instead of N (80-95% fewer round trips).
EXAMPLE: Insert 3 rows + hide 2 columns + freeze row 1 = 1 transaction call, NOT 3 separate calls.

**COST COMPARISON:**
┌─────────────────────────────────────────────────────────────────┐
│ EXAMPLE: Insert 3 rows + hide 2 columns + freeze row 1         │
├─────────────────────────────────────────────────────────────────┤
│ ❌ BAD:  3 separate calls = 3 API calls, ~600ms                │
│ ✅ GOOD: sheets_transaction = 1 API call, ~250ms (58% faster!) │
└─────────────────────────────────────────────────────────────────┘
- Single operations: 1 call each (~200ms)
- Multiple dimension changes: Use sheets_transaction (1 call for all)
- **TIP:** Plan your row/column operations and batch them with sheets_transaction

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

**PREREQUISITES:** sheets_auth must be authenticated. Recommended: Use sheets_analyze action:"suggest_chart" or "suggest_pivot" first.

**ROUTING - Pick this tool when:**
> Creating charts (bar, line, pie, scatter, column, combo, etc.)
> Creating pivot tables for aggregation and summarization
> Updating, moving, resizing, or deleting visualizations

**NOT this tool - use instead:**
> sheets_analyze - Getting chart/pivot RECOMMENDATIONS and suggestions
> sheets_data - Reading the SOURCE DATA to visualize
> sheets_format - Styling the SOURCE data (not the chart)

**ACTIONS (18):** chart_create, suggest_chart, chart_update, chart_delete, chart_list, chart_get, chart_move, chart_resize, chart_update_data_range, chart_add_trendline, chart_remove_trendline, pivot_create, suggest_pivot, pivot_update, pivot_delete, pivot_list, pivot_get, pivot_refresh

**ACTIONS BY CATEGORY:**
[Charts] chart_create, chart_update, chart_delete, chart_list, chart_get, chart_move, chart_resize, chart_update_data_range, suggest_chart
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

**PREREQUISITES:** sheets_auth must be authenticated. Requires elevated Drive scope for sharing/comments/version actions (e.g. OAUTH_SCOPE_MODE=full or incremental consent). Recommended: sheets_collaborate action:"version_create_snapshot" before destructive operations.

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

**ACTIONS (35):** share_add, share_update, share_remove, share_list, share_get, share_transfer_ownership, share_set_link, share_get_link, comment_add, comment_update, comment_delete, comment_list, comment_get, comment_resolve, comment_reopen, comment_add_reply, comment_update_reply, comment_delete_reply, version_list_revisions, version_get_revision, version_restore_revision, version_keep_revision, version_create_snapshot, version_list_snapshots, version_restore_snapshot, version_delete_snapshot, version_compare, version_export, approval_create, approval_approve, approval_reject, approval_get_status, approval_list_pending, approval_delegate, approval_cancel

**ACTIONS BY CATEGORY:**
[Sharing] share_add, share_update, share_remove, share_list, share_get, share_transfer_ownership, share_set_link, share_get_link
[Comments] comment_add, comment_update, comment_delete, comment_list, comment_get, comment_resolve, comment_reopen, comment_add_reply, comment_update_reply, comment_delete_reply
[Versions] version_list_revisions, version_get_revision, version_restore_revision, version_keep_revision, version_create_snapshot, version_list_snapshots, version_restore_snapshot, version_delete_snapshot, version_compare, version_export
[Approvals] approval_create, approval_approve, approval_reject, approval_get_status, approval_list_pending, approval_delegate, approval_cancel

**Parameter format examples:**
- Share: {"action":"share_add","spreadsheetId":"1ABC...","email":"user@example.com","role":"writer"}
- Comment: {"action":"comment_add","spreadsheetId":"1ABC...","range":"A1","content":"Please verify this"}
- Snapshot: {"action":"version_create_snapshot","spreadsheetId":"1ABC...","description":"Before cleanup"}

**TOP 3 ACTIONS:**
1. share_add: {"action":"share_add","spreadsheetId":"1ABC...","email":"user@example.com","role":"writer"}
2. comment_add: {"action":"comment_add","spreadsheetId":"1ABC...","range":"A1","content":"Please verify this"}
3. version_create_snapshot: {"action":"version_create_snapshot","spreadsheetId":"1ABC...","description":"Before cleanup"}

**spreadsheetId format:** "1abc123def456..." (from Google Sheets URL)
**email format:** "user@example.com" or "group@domain.com"
**role options:** viewer, commenter, editor, owner

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

**Use when:** Understanding spreadsheet structure/quality, generating AI insights, detecting patterns, natural language queries
**NOT this tool - use instead:**
> sheets_quality - Validating DATA or detecting CONFLICTS before writing
> sheets_data - Writing CHANGES to the spreadsheet
> sheets_visualize - Creating CHARTS (use suggest_chart from here first)
> sheets_fix - Auto-fixing ISSUES (use comprehensive first to find them)

**ACTIONS (16):** comprehensive, analyze_data, suggest_visualization, generate_formula, detect_patterns, analyze_structure, analyze_quality, analyze_performance, analyze_formulas, query_natural_language, explain_analysis, scout, plan, execute_plan, drill_down, generate_actions

**🚀 START HERE WITH comprehensive:**
For any new spreadsheet, ALWAYS START with action:"comprehensive". Gets metadata + data + quality + insights in 1-2 API calls (73% faster than manual approach).
Returns: Sheet structure, column types, data quality scores, formula health, recommended next actions — everything needed to plan your work.
Example: {"action":"comprehensive","spreadsheetId":"1ABC..."}

**ULTRA-FAST METADATA:**
Use scout for metadata ONLY (sheet names, sizes, column types) — just 1 API call, 0 data transfer. Perfect for "What sheets do I have?" or "How many rows?"
Example: {"action":"scout","spreadsheetId":"1ABC..."} → Returns sheet list with row/column counts and detected column types.

**Parameter format examples:**
- Comprehensive: {"action":"comprehensive","spreadsheetId":"1ABC..."} ← START WITH THIS for new sheets
- Scout (fast metadata): {"action":"scout","spreadsheetId":"1ABC..."} ← Just structure, no data, fastest option
- Analyze data: {"action":"analyze_data","spreadsheetId":"1ABC...","range":"Sheet1!A1:D100"}
- Suggest visualization: {"action":"suggest_visualization","spreadsheetId":"1ABC...","range":"Sheet1!A1:D100"}
- Generate formula: {"action":"generate_formula","description":"Sum of revenue by category"}

**Common actions:** comprehensive (START), analyze_data, suggest_visualization, suggest_chart, suggest_pivot, generate_formula, detect_patterns, analyze_quality
**Progressive actions:** scout (metadata only), plan, execute_plan, drill_down, generate_actions (use for large/complex sheets)
**Tip:** comprehensive is the fastest starting point - uses tiered retrieval (metadata → sample → full scan only if needed). scout is fastest if you only need structure.`,

  //=============================================================================
  // ADVANCED FEATURES
  //=============================================================================

  sheets_advanced: `⚙️ ADVANCED - Named ranges, protection, metadata, banding, tables (${ACTION_COUNTS['sheets_advanced']} actions).

**PREREQUISITES:** sheets_auth must be authenticated.

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

**ACTIONS (26):** add_named_range, update_named_range, delete_named_range, list_named_ranges, get_named_range, add_protected_range, update_protected_range, delete_protected_range, list_protected_ranges, set_metadata, get_metadata, delete_metadata, add_banding, update_banding, delete_banding, list_banding, create_table, delete_table, list_tables, update_table, rename_table_column, set_table_column_properties, add_person_chip, add_drive_chip, add_rich_link_chip, list_chips

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

**TIP:** Tables use Sheets API v4 table objects for structured ranges. Named ranges allow formulas to use names instead of cell addresses.`,

  //=============================================================================
  // ENTERPRISE / SAFETY
  //=============================================================================

  sheets_transaction: `🔄 TRANSACTION - Atomic batch operations (${ACTION_COUNTS['sheets_transaction']} actions).

**PREREQUISITES:** sheets_auth must be authenticated. Recommended: sheets_quality action:"analyze_impact" for large operations.

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

**THRESHOLD DECISION TREE:**
USE transactions when:
- 5+ related operations that must succeed/fail together (atomicity critical)
- Bulk updates (>50 rows with different values each)
- Operations where partial success is unacceptable (all-or-nothing)

SKIP transactions (use direct calls instead) when:
- 1-4 simple operations (transaction overhead exceeds benefit)
- Single write/read operations (no atomicity needed)
- Sequential non-dependent operations (don't need atomic guarantee)
- Fast, simple appends (sheets_data.append is already optimized)

COST COMPARISON (Quick Win #3 - Massive savings!):**
┌─────────────────────────────────────────────────────────────────┐
│ EXAMPLE: Bulk update 100 rows with different values            │
├─────────────────────────────────────────────────────────────────┤
│ ❌ BAD:  sheets_data.write x100 = 100 calls, 20-40 seconds     │
│ ✅ GOOD: transaction = 1 call, ~800ms (95% savings!)           │
│ ✅ ALSO GOOD: sheets_composite.bulk_update = 1 call, simpler   │
└─────────────────────────────────────────────────────────────────┘
- Without transaction: N operations = N API calls (20-40 seconds for 100)
- With transaction: queue() adds operations (0 API cost), commit() sends ALL in 1 batched call
- **Savings: 80-95% fewer API calls, 10-20x faster**
- **RULE: Use transactions ONLY for 5+ operations or 50+ cells!**

**Parameter format examples:**
1. begin: {"action":"begin","spreadsheetId":"1ABC..."} -> Get transactionId
2. queue: {"action":"queue","transactionId":"tx_123","operation":{...}} -> Add operations (0 API cost!)
3. queue: {"action":"queue","transactionId":"tx_123","operation":{...}} -> Add more operations
4. commit: {"action":"commit","transactionId":"tx_123"} -> Execute ALL atomically in 1 call
5. rollback: {"action":"rollback","transactionId":"tx_123"} -> Discard all queued operations

**transactionId format:** Returned from begin action: "tx_abc123..."
**operation format:** Any valid sheets_data or sheets_dimensions request without spreadsheetId (transaction context)

**WORKFLOW:**
begin → queue (cheap, no API calls) → queue → queue → commit (all in 1 API call)
NOT: begin → queue → commit → queue → commit (expensive, multiple API calls)

**WHEN NOT TO USE:**
- 1-4 operations: Direct calls are faster (skip transaction overhead)
- Simple appends: sheets_data.append already optimized
- Trying to undo: transactions are atomic but can't selectively undo parts

**RULE:** Only use transactions for 5+ operations OR when atomicity is critical!`,

  sheets_quality: `✅ QUALITY - Data validation & conflict detection (${ACTION_COUNTS['sheets_quality']} actions).

**PREREQUISITES:** sheets_auth must be authenticated. Use BEFORE sheets_data/sheets_transaction writes.

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

**Parameter format examples:**
- Validate single value: {"action":"validate","value":"test@email.com","rules":["not_empty","valid_email"]}
- Detect conflicts: {"action":"detect_conflicts","spreadsheetId":"1ABC..."}
- Analyze impact BEFORE delete: {"action":"analyze_impact","spreadsheetId":"1ABC...","operation":{"type":"delete_rows","range":"A1:A10"}}

**TOP 3 ACTIONS:**
1. validate: {"action":"validate","value":"test@email.com","rules":["not_empty","valid_email"]} ← Single value validation
2. analyze_impact: {"action":"analyze_impact","spreadsheetId":"1ABC...","operation":{"type":"delete_rows","range":"A1:A10"}} ← Check formula dependencies
3. detect_conflicts: {"action":"detect_conflicts","spreadsheetId":"1ABC..."} ← Concurrent edit detection

**validate rules examples:** not_empty, valid_email, is_number, is_date, min_length, max_length, matches_pattern
**impact operation types:** delete_rows, delete_columns, clear_range, write_range, create_chart, delete_formula

**PRE-WRITE WORKFLOW:**
1. Plan operation (which cells, what values)
2. sheets_quality.validate → Check for errors
3. sheets_quality.analyze_impact → Check formula dependencies
4. sheets_data.write → Execute with confidence

**USE BEFORE:** Large writes, deletes, or concurrent editing scenarios. Use analyze_impact to check formula dependencies.`,

  sheets_history: `📜 HISTORY - Operation audit & undo/redo (${ACTION_COUNTS['sheets_history']} actions).

**PREREQUISITES:** sheets_auth must be authenticated. History is populated by previous tool calls in this session.

**ROUTING - Pick this tool when:**
> Viewing what operations were performed (in this session)
> UNDOING a recent operation (this session only)
> Getting operation STATISTICS and timing
> Reverting to a previous operation state (this session)

**NOT this tool - use instead:**
> sheets_collaborate - For FILE version history (Google revisions, snapshots) — history across sessions
> sheets_session - For CONVERSATION context and natural language references
> sheets_analyze - For data quality insights

**ACTIONS (7):** list, get, stats, undo, redo, revert_to, clear

**IMPORTANT - SESSION-SCOPED ONLY:**
undo reverts the last ServalSheets operation made in THIS conversation only. Does NOT track:
- Manual edits in Sheets UI
- Operations from other users
- Operations from other sessions/conversations
For across-session recovery, use sheets_collaborate.version_* actions (file versions, snapshots).

**Parameter format examples:**
- List operations: {"action":"list","spreadsheetId":"1ABC...","limit":10}
- Undo: {"action":"undo","spreadsheetId":"1ABC..."} ← Undoes last ServalSheets operation
- Revert to operation: {"action":"revert_to","spreadsheetId":"1ABC...","operationId":"op_123"}
- Get stats: {"action":"stats","spreadsheetId":"1ABC..."}

**TOP 3 ACTIONS:**
1. list: {"action":"list","spreadsheetId":"1ABC...","limit":10} ← See operation history
2. undo: {"action":"undo","spreadsheetId":"1ABC..."} ← Revert last ServalSheets op
3. revert_to: {"action":"revert_to","spreadsheetId":"1ABC...","operationId":"op_123"} ← Revert to specific point

**operationId format:** "op_abc123..." (from list action results)
**Session-specific:** History is local to this conversation/session. File versions are in sheets_collaborate.
**Scope:** Only tracks ServalSheets tool operations, not Sheets UI edits or other users' changes.

**LIMITS:** Tracks last 100 operations per spreadsheet per session.
**RECOVERY WORKFLOW:**
- Session recovery: Use sheets_history.undo/revert_to
- Cross-session recovery: Use sheets_collaborate.version_restore_revision or version_restore_snapshot`,

  sheets_confirm: `⚠️ CONFIRM - User confirmation before destructive operations (${ACTION_COUNTS['sheets_confirm']} actions).

**PREREQUISITES:** sheets_auth must be authenticated. Use AFTER planning but BEFORE executing destructive operations.

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

  sheets_fix: `🔧 FIX - Automated issue resolution (${ACTION_COUNTS['sheets_fix']} action).

**PREREQUISITES:** sheets_auth must be authenticated. REQUIRED: sheets_analyze action:"comprehensive" first to detect issues.

**ROUTING - Pick this tool when:**
> sheets_analyze found issues you want to AUTO-FIX
> Fixing common problems: volatile formulas, missing freezes, no protection

**NOT this tool - use instead:**
> sheets_analyze - First, to DETECT issues
> sheets_data/sheets_format - For MANUAL fixes

**ACTION (1):** fix

**Parameter format examples:**
1. Preview fixes: {"action":"fix","spreadsheetId":"1ABC...","issues":[...],"mode":"preview"}
2. Apply fixes: {"action":"fix","spreadsheetId":"1ABC...","issues":[...],"mode":"apply","safety":{"createSnapshot":true}}

**WORKFLOW:**
1. sheets_analyze comprehensive -> Get issues list
2. sheets_fix preview -> Review proposed fixes
3. sheets_fix apply -> Execute fixes with snapshot

**FIXABLE ISSUES:** MULTIPLE_TODAY, FULL_COLUMN_REFS, NO_FROZEN_HEADERS, NO_PROTECTION, NESTED_IFERROR, EXCESSIVE_CF_RULES`,

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

**ACTIONS (10):** import_csv, smart_append, bulk_update, deduplicate, export_xlsx, import_xlsx, get_form_responses, setup_sheet, import_and_format, clone_structure

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

**⚡ SMART ROUTING (EFFICIENCY HUB):**
BEFORE using sheets_data + sheets_format + sheets_dimensions separately, check if sheets_composite can do it in 1-2 calls:
- setup_sheet = add_sheet + write headers + format + freeze + column widths (2 API calls, NOT 6-8)
- smart_append = read headers + match columns + append data (2 API calls, auto-matches columns!)
- import_csv = parse CSV + write + format + validate (2 API calls, validates data)
- deduplicate = scan + remove dupes + report (2 API calls, use preview:true first!)
- bulk_update = atomic multi-row update with preview (1 call, prevents partial failures)
- import_and_format = load + style + freeze + format (1 call, fastest full setup)

**COMMON WORKFLOWS:**
- New sheet from scratch? → setup_sheet (2 calls total)
- Import CSV and clean up? → import_csv + deduplicate (2 calls)
- Add data with header matching? → smart_append (auto-matches, safer)
- Full sheet setup + data? → import_and_format (1 call, includes everything)
- Bulk update with safety? → bulk_update with preview:true first (see impact before commit)`,

  //=============================================================================
  // SESSION CONTEXT
  //=============================================================================

  sheets_session: `📋 SESSION - Conversation context for natural language (${ACTION_COUNTS['sheets_session']} actions).

**PREREQUISITES:** sheets_auth must be authenticated. Call action:"set_active" EARLY to enable natural language references. Checkpoint actions require ENABLE_CHECKPOINTS=true.

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

**PREREQUISITES:** sheets_auth must be authenticated. Templates stored in Google Drive appDataFolder (private).

**ROUTING - Pick this tool when:**
> Creating a new spreadsheet from a TEMPLATE
> Saving a spreadsheet AS a template for reuse
> Managing your template library
> Using builtin templates from knowledge base (import_builtin)

**NOT this tool - use instead:**
> sheets_core - For CREATING spreadsheets without templates
> sheets_collaborate - For FILE snapshots/backups/versions
> sheets_composite.setup_sheet - For quick setup instead of templates

**ACTIONS (8):** list, get, create, update, delete, apply, preview, import_builtin

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

**PREREQUISITES:** sheets_auth must be authenticated. BigQuery API must be enabled in GCP project. OAuth scopes: bigquery.readonly or bigquery.

**ROUTING - Pick this tool when:**
> Connecting Google Sheets to BigQuery data sources
> Running SQL queries on BigQuery from Sheets
> Exploring BigQuery datasets and table schemas
> Exporting sheet data TO BigQuery tables
> Importing BigQuery query results INTO sheets

**NOT this tool - use instead:**
> sheets_data - For regular read/write within the spreadsheet
> sheets_visualize - For creating charts from sheet data

**ACTIONS (14):** connect, connect_looker, disconnect, list_connections, get_connection, query, preview, refresh, cancel_refresh, list_datasets, list_tables, get_table_schema, export_to_bigquery, import_from_bigquery

**ACTIONS BY CATEGORY:**
[Connection] connect, connect_looker, disconnect, list_connections, get_connection
[Query] query (run SQL), preview (test without full execution), refresh (update data), cancel_refresh
[Discovery] list_datasets, list_tables, get_table_schema
[Transfer] export_to_bigquery, import_from_bigquery

**Parameter format examples:**
- Query: {"action":"query","projectId":"my-project","query":"SELECT * FROM dataset.table LIMIT 100"}
- List tables: {"action":"list_tables","projectId":"my-project","datasetId":"my_dataset"}
- Import: {"action":"import_from_bigquery","spreadsheetId":"1ABC...","projectId":"my-project","query":"SELECT ..."}

**TOP 3 ACTIONS:**
1. query: {"action":"query","projectId":"my-project","query":"SELECT * FROM dataset.table LIMIT 100"} -> Run SQL query
2. list_tables: {"action":"list_tables","projectId":"my-project","datasetId":"my_dataset"} -> Explore dataset
3. import_from_bigquery: {"action":"import_from_bigquery","spreadsheetId":"1ABC...","projectId":"my-project","query":"SELECT ..."} -> Import results

**REQUIREMENTS:**
- BigQuery API must be enabled in your GCP project
- OAuth scope: bigquery.readonly (queries) or bigquery (full access)
- Connected Sheets is a Google Workspace feature (some plans only)

**projectId format:** Your GCP project ID (e.g., "my-project-12345")
**query examples:** "SELECT * FROM dataset.table LIMIT 100", "SELECT COUNT(*) FROM dataset.table WHERE date > '2024-01-01'"

**TIP:** Use preview action to test expensive queries before running full execution. Requires BigQuery API enabled.`,

  sheets_appsscript: `⚡ APPSSCRIPT - Apps Script automation (${ACTION_COUNTS['sheets_appsscript']} actions).

**PREREQUISITES:** sheets_auth must be authenticated (USER OAuth only, NOT service accounts). Apps Script API must be enabled in GCP project.

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

**ACTIONS (14):** create, get, get_content, update_content, create_version, list_versions, get_version, deploy, list_deployments, get_deployment, undeploy, run, list_processes, get_metrics

**ACTIONS BY CATEGORY:**
[Project] create, get, get_content, update_content
[Version] create_version, list_versions, get_version
[Deploy] deploy, list_deployments, get_deployment, undeploy
[Execute] run (execute function), list_processes (logs), get_metrics

**Parameter format examples:**
- Run function: {"action":"run","scriptId":"1ABC...","functionName":"myFunction","parameters":["arg1"]}
- Get content: {"action":"get_content","scriptId":"1ABC..."}
- Deploy: {"action":"deploy","scriptId":"1ABC...","deploymentType":"WEB_APP","access":"ANYONE"}

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

**scriptId format:** "1abc123def456..." (from Apps Script editor)
**functionName examples:** "myFunction", "onEdit", "doGet", "doPost"
**deploymentType options:** WEB_APP, API_EXECUTABLE, ADDON

**SAFETY WARNINGS:**
- 🔴 run: Executes code with SIDE EFFECTS - may send emails, modify docs, etc.
- 🔴 deploy: Creates PUBLIC endpoints - review access settings carefully
- ⚠️ User OAuth only - does NOT work with service accounts

**TIP:** Use devMode:true in run action to test latest saved code (owner only) before deploying.`,

  sheets_webhook: `🔔 WEBHOOK - Event-driven automation and real-time notifications (${ACTION_COUNTS['sheets_webhook']} actions).

**PREREQUISITES:** sheets_auth must be authenticated. Requires Redis backend for queue/state. Webhook endpoint must accept HTTPS POST requests and return 200 OK within 10s.

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

**ACTIONS (6):** register, unregister, get, list, test, get_stats

**ACTIONS BY CATEGORY:**
[Lifecycle] register (create webhook), unregister (remove webhook), get (view details), list (all webhooks)
[Testing] test (send test payload), get_stats (delivery metrics)

**Parameter format examples:**
- Register: {"action":"register","spreadsheetId":"1ABC...","webhookUrl":"https://api.example.com/webhook","eventTypes":["cell.update"],"secret":"your-secret-key"}
- List: {"action":"list","spreadsheetId":"1ABC..."}
- Test: {"action":"test","webhookId":"wh_123"}

**TOP 3 ACTIONS:**
1. register: {"action":"register","spreadsheetId":"1ABC...","webhookUrl":"https://api.example.com/webhook","eventTypes":["cell.update"],"secret":"your-secret-key"} -> Create webhook
2. list: {"action":"list","spreadsheetId":"1ABC..."} -> View active webhooks
3. test: {"action":"test","webhookId":"wh_123"} -> Send test notification

**webhookUrl format:** "https://api.example.com/webhook" (HTTPS only, not HTTP)
**eventTypes examples:** cell.update, format.update, sheet.create, sheet.delete, sheet.rename, all
**secret parameter:** Used for HMAC signature verification (recommended)

**WEBHOOK EVENTS:**
- cell.update: Cell values changed
- format.update: Formatting changed
- sheet.create/delete/rename: Sheet structure changes
- all: Subscribe to all events

**REQUIREMENTS:**
- Redis must be configured and reachable (webhooks are queue-backed)
- Webhook URL must be HTTPS (not HTTP)
- Endpoint must return 200 OK within 10 seconds
- HMAC signature verification recommended (use secret parameter)
- Max webhook lifetime: 1 day (Google Drive API limit)
- After 1 day, webhooks expire and must be re-registered

**TIP:** Use the secret parameter for HMAC signature verification to ensure webhook authenticity. Store expiration time and re-register daily.`,

  sheets_dependencies: `🔗 DEPENDENCIES - Formula dependency analysis and impact assessment (${ACTION_COUNTS['sheets_dependencies']} actions).

**PREREQUISITES:** sheets_auth must be authenticated. Spreadsheet should contain formulas for meaningful analysis.

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

**ACTIONS (7):** build, analyze_impact, detect_cycles, get_dependencies, get_dependents, get_stats, export_dot

**ACTIONS BY CATEGORY:**
[Analysis] build (create graph), analyze_impact (what changes affect), get_stats (complexity metrics)
[Queries] get_dependencies (what cell depends on), get_dependents (what depends on cell)
[Quality] detect_cycles (find circular refs)
[Export] export_dot (Graphviz visualization)

**Parameter format examples:**
- Analyze impact: {"action":"analyze_impact","spreadsheetId":"1ABC...","cell":"Data!A1"}
- Detect cycles: {"action":"detect_cycles","spreadsheetId":"1ABC..."}
- Get dependents: {"action":"get_dependents","spreadsheetId":"1ABC...","cell":"Summary!B5"}

**TOP 3 ACTIONS:**
1. analyze_impact: {"action":"analyze_impact","spreadsheetId":"1ABC...","cell":"Data!A1"} -> See what cells would be affected by changing A1
2. detect_cycles: {"action":"detect_cycles","spreadsheetId":"1ABC..."} -> Find circular reference errors
3. get_dependents: {"action":"get_dependents","spreadsheetId":"1ABC...","cell":"Summary!B5"} -> See what formulas use B5

**USE CASES:**
- 📊 Before changing important cells, check impact to avoid breaking formulas
- 🔄 Detect circular references causing #REF! errors
- 🎯 Find all formulas that use a specific cell (dependents)
- 🗺️ Export dependency graph to visualize complex formula relationships

**cell format:** "Sheet1!A1" or full range "Sheet1!A1:C10"
**export_dot output:** Graphviz DOT format for visualizing dependency graphs

**TIP:** Run detect_cycles first to identify circular references, then use analyze_impact before modifying cells with many dependents to understand scope.`,

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

**ACTIONS (4):** call_remote, list_servers, get_server_tools, validate_connection

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

**USE CASES:**
- 🌤️ Weather dashboards: Call weather API → write forecast to Sheets
- 🤖 ML predictions: Read historical data → send to ML server → write predictions back
- 🗄️ Database sync: Query external database → update Sheets with results
- 🔗 Multi-step ETL: Chain data transformations across specialized servers

**SECURITY:**
⚠️ Only call TRUSTED MCP servers
⚠️ Validate responses before writing to Sheets
⚠️ Use bearer tokens for authenticated servers
⚠️ Set timeouts to prevent hanging (default: 30s)

**WORKFLOW EXAMPLE:**
1. validate_connection → Test remote server
2. get_server_tools → Discover available tools
3. call_remote → Execute tool on remote server
4. sheets_data.write → Write results to Sheets

**TIP:** Always test with validate_connection first, then use get_server_tools to discover remote capabilities before calling. Results are cached for 5 minutes automatically.`,
};

// Type export for other modules
export type ToolName = keyof typeof TOOL_DESCRIPTIONS;

// Helper to get description with fallback
export function getToolDescription(name: string): string {
  return TOOL_DESCRIPTIONS[name as ToolName] ?? `${name} operations`;
}
