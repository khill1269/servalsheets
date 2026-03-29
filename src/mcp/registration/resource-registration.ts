/**
 * ServalSheets - Resource Registration
 *
 * Resource templates and handlers for spreadsheet data access.
 *
 * @module mcp/registration/resource-registration
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GoogleApiClient } from '../../services/google-api.js';
import {
  completeAction,
  completeRangeContextAware,
  completeSpreadsheetId,
  TOOL_ACTIONS,
} from '../completions.js';
import { registerChartResources } from '../../resources/charts.js';
import { registerPivotResources } from '../../resources/pivots.js';
import { registerQualityResources } from '../../resources/quality.js';
import { createAuthRequiredError, createResourceReadError } from '../../utils/mcp-errors.js';
import { getHealthSnapshot } from '../../observability/metrics.js';

// ============================================================================
// STATIC RESOURCE CONTENT
// ============================================================================

const TOOL_SELECTION_CONTENT = `# ServalSheets Tool Selection Guide

## Quick Routing (When Intent Is CLEAR)

| User Says | Route To |
|-----------|----------|
| "read/write/append/clear" | sheets_data |
| "format/color/border/font" | sheets_format |
| "share/comment/permission" | sheets_collaborate |
| "create/delete/copy sheet" | sheets_core |
| "undo/redo/history/revert" | sheets_history |
| "insert/delete rows/columns" | sheets_dimensions |
| "chart/graph/visualization" | sheets_visualize |
| "import/export CSV/XLSX" | sheets_composite |
| "formula dependencies/impact" | sheets_dependencies |
| "clean/fix/standardize" | sheets_fix |
| "compute/calculate/forecast" | sheets_compute |
| "run plan/agent/multi-step" | sheets_agent |
| "external API/live data/connector" | sheets_connectors |
| "analyze/understand/explore" | sheets_analyze |
| "dropdown/data validation" | sheets_format.set_data_validation |
| "named range/protected range/table" | sheets_advanced |
| "template/save pattern" | sheets_templates |
| "what if/scenario" | sheets_dependencies.model_scenario |
| "validate/quality" | sheets_quality |
| "webhook/watch changes" | sheets_webhook |
| "transaction/atomic batch" | sheets_transaction |
| "apps script/trigger/deploy" | sheets_appsscript |
| "bigquery/connected sheets" | sheets_bigquery |
| "authenticate/login" | sheets_auth |

## Decision Tree (When Unsure)

**Reading data?**
- 1-2 ranges: \`sheets_data.read\`
- 3+ ranges: \`sheets_data.batch_read\` (same API cost!)
- Structure only: \`sheets_analyze.scout\` (no data, just metadata)
- Multiple spreadsheets: \`sheets_data.cross_read\` / \`cross_query\`

**Writing data?**
- Known cells: \`sheets_data.write\` (always prefer this)
- Pattern-based: \`sheets_data.find_replace\` (ONLY when positions unknown)
- Add to bottom: \`sheets_data.append\` (NOT idempotent!)
- 3+ ranges: \`sheets_data.batch_write\` (70% faster)
- Match headers: \`sheets_composite.smart_append\`
- CSV file: \`sheets_composite.import_csv\`

**COMMON MISTAKE**: Do NOT use find_replace when you know the cell address. Use write instead.

**Formatting?**
- 1-2 changes: Specific action (set_background, set_text_format, etc.)
- 3+ changes: \`sheets_format.batch_format\` (1 API call for ALL)
- Quick preset: \`sheets_format.apply_preset\`
- New sheet + formatting: \`sheets_composite.setup_sheet\`

**Rows & columns?**
- Insert/delete: \`sheets_dimensions\` (dimension:"ROWS"/"COLUMNS")
- Resize/hide/freeze: \`sheets_dimensions\`
- Sort/filter: \`sheets_dimensions\` (sort_range, set_basic_filter)

**Managing sheets?**
- Create: \`sheets_core.add_sheet\` or \`sheets_composite.setup_sheet\` (with formatting)
- Delete: \`sheets_core.delete_sheet\` (check analyze_impact first!)
- Copy: \`sheets_core.duplicate_sheet\`
- Template: \`sheets_templates.apply\`

**Understanding a sheet?**
- Fast metadata: \`sheets_analyze.scout\` (~200ms, 1 API call)
- One aspect: \`sheets_analyze.analyze_data\` with category
- Full audit: \`sheets_analyze.comprehensive\` (use after scout)
- HIERARCHY: scout first, then targeted or comprehensive. Never comprehensive without scout.

**Cleaning data?**
- Auto-detect & fix: \`sheets_fix.clean\` (preview first with mode:"preview")
- Standardize formats: \`sheets_fix.standardize_formats\`
- Fill empty cells: \`sheets_fix.fill_missing\`
- Find outliers: \`sheets_fix.detect_anomalies\`

**Enterprise & automation?**
- BigQuery: \`sheets_bigquery\`
- Apps Script: \`sheets_appsscript\`
- Webhooks: \`sheets_webhook\`
- Federation: \`sheets_federation\`

**Large datasets (>10K rows)?**
- Pagination: \`sheets_data.batch_read\`
- SQL: \`sheets_bigquery\`
- Bulk writes: \`sheets_transaction\` (80-95% fewer API calls)

**5+ operations?**
- All formatting: \`sheets_format.batch_format\`
- Mixed: \`sheets_transaction\` (begin, queue, commit)
- Sheet from scratch: \`sheets_composite.setup_sheet\`

## Disambiguation (Same Name, Different Tools)

### "list"
| Target | Tool.Action |
|--------|-------------|
| Spreadsheets in Drive | sheets_core.list |
| Sheets/tabs | sheets_core.list_sheets |
| Named ranges | sheets_advanced.list_named_ranges |
| Charts | sheets_visualize.chart_list |
| Comments | sheets_collaborate.comment_list |
| Templates | sheets_templates.list |
| Webhooks | sheets_webhook.list |
| Data validations | sheets_format.list_data_validations |
| Filter views | sheets_dimensions.list_filter_views |

### "delete"
| Target | Tool.Action |
|--------|-------------|
| Rows/columns | sheets_dimensions.delete |
| A sheet tab | sheets_core.delete_sheet |
| A named range | sheets_advanced.delete_named_range |
| A chart | sheets_visualize.chart_delete |
| A comment | sheets_collaborate.comment_delete |
| Data validation | sheets_format.clear_data_validation |
| A filter view | sheets_dimensions.delete_filter_view |
| A template | sheets_templates.delete |
| A webhook | sheets_webhook.unregister |

### "create"
| Target | Tool.Action |
|--------|-------------|
| New spreadsheet | sheets_core.create |
| New sheet/tab | sheets_core.add_sheet |
| New chart | sheets_visualize.chart_create |
| New template | sheets_templates.create |
| New named range | sheets_advanced.add_named_range |
| New filter view | sheets_dimensions.create_filter_view |

### "get"
| Target | Tool.Action |
|--------|-------------|
| Spreadsheet metadata | sheets_core.get |
| Cell data | sheets_data.read |
| Chart details | sheets_visualize.chart_get |
| Named range | sheets_advanced.get_named_range |

### "update"
| Target | Tool.Action |
|--------|-------------|
| Cell values | sheets_data.write |
| Sheet properties | sheets_core.update_sheet |
| Chart appearance | sheets_visualize.chart_update |
| Permission role | sheets_collaborate.share_update |
| Named range bounds | sheets_advanced.update_named_range |

### "import"
| Target | Tool.Action |
|--------|-------------|
| CSV file | sheets_composite.import_csv |
| Excel XLSX file | sheets_composite.import_xlsx |
| Built-in template | sheets_templates.import_builtin |
| Data from BigQuery | sheets_bigquery.import_from_bigquery |
| Data from external API | sheets_connectors.query |
`;

// ============================================================================
// EXTRACTED SERVER INSTRUCTION CONTENT (guide resources)
// ============================================================================
// These sections were moved out of SERVER_INSTRUCTIONS to reduce payload size.
// Clients can read them on demand via resources/read.

// DECISION_TREE_CONTENT and DISAMBIGUATION_CONTENT have been consolidated into
// TOOL_SELECTION_CONTENT above to eliminate overlap across 3 separate resources.

const WORKFLOWS_CONTENT = `# ServalSheets Workflows & Patterns

## Common Patterns (Copy-Paste Ready)

**Format a data table:**
\`sheets_format.batch_format with [header_row preset, alternating_rows preset, auto_fit columns]\`

**Add validated data safely:**
\`sheets_quality.validate → sheets_data.append → sheets_analyze.scout (verify)\`

**Build a dashboard:**
\`sheets_composite.setup_sheet → sheets_data.write formulas → sheets_format.batch_format → sheets_visualize.chart_create\`

**Dependent dropdowns (Country → City):**
\`sheets_format.build_dependent_dropdown sourceRange:"Config!A:B" targetSheet:"Form" parentColumn:"A" childColumn:"B"\`

**Live data connector → analyze → clean:**
\`sheets_connectors.list_connectors → sheets_connectors.query → sheets_data.write → sheets_fix.clean\`

**Cross-sheet lookup upgrade:**
\`sheets_analyze.analyze_formulas (find VLOOKUP) → sheets_analyze.generate_formula "convert to XLOOKUP" → sheets_data.write\`

## Tool Chaining (Multi-Step Workflows)

| Workflow | Chain |
|----------|-------|
| Analysis & Fix | scout → comprehensive → sheets_fix (auto-apply) |
| Safe Deletion | analyze_impact → sheets_confirm request → delete_sheet |
| Import Data | import_csv → validate → apply_preset |
| Create Apps Script | create → update_content → create_version → deploy → run |
| Clean Data | suggest_cleaning → clean mode:"preview" → clean mode:"apply" |
| Scenario Analysis | build → model_scenario → create_scenario_sheet |
| Time-Travel | timeline → diff_revisions → restore_cells |
| AI Sheet Gen | preview_generation → generate_sheet → suggest_next_actions |
| Full Audit | scout → comprehensive → suggest_next_actions |
| Formula Modernize | analyze_formulas → generate_formula → write |
| Build Dashboard | scout → suggest_chart → chart_create → sparkline_add → apply_preset |
| Data Relationships | build → get_dependencies → analyze_formulas → detect_patterns |
| Architecture Review | comprehensive → setup_sheet → add_protected_range |
| Cross-Sheet Analysis | cross_read → comprehensive → cross_compare |
| Quality Audit | audit_sheet → publish_report |
| Data Pipeline | configure → data_pipeline → batch_format |
| Spreadsheet Migration | scout (source) → migrate_spreadsheet → scout (verify) |
| Federation/Remote | list_servers → get_server_tools → call_remote |
| Session Continuity | set_active → read → get_context → (use context in next actions) |

## Interactive Wizards (Elicitation)

When a supporting MCP client is connected, these actions launch interactive forms:

| Action | What the Wizard Asks |
|--------|---------------------|
| \`sheets_core.create\` | Spreadsheet title + locale + timezone |
| \`sheets_collaborate.share_add\` | Recipient email + permission role |
| \`sheets_visualize.chart_create\` | Chart type → chart title (2-step) |
| \`sheets_format.add_conditional_format_rule\` | Rule preset selection |
| \`sheets_transaction.begin\` | Transaction description for audit trail |

Any destructive action (delete, clear, bulk overwrite) shows a confirmation form.

## Advanced Sheet Patterns

**Multi-tab with cross-sheet lookups:**
→ \`sheets_agent action:"plan" description:"Create Products + Orders sheets with XLOOKUP"\`

**Full analytics dashboard (KPIs + charts + slicers):**
→ \`sheets_composite action:"build_dashboard" dataSheet:"Sales" layout:"full_analytics"\`

**Dependent dropdowns (Country → Cities):**
→ \`sheets_format action:"build_dependent_dropdown" parentRange:"Sheet1!A2:A100" ...\`

**VLOOKUP → XLOOKUP upgrade:**
→ \`sheets_analyze action:"analyze_formulas"\` → check upgradeOpportunities → write XLOOKUP

**Pivot table + slicer:**
→ \`sheets_visualize action:"pivot_create"\` → \`sheets_dimensions action:"create_slicer"\`

**Dynamic filter formula:**
→ \`sheets_analyze action:"generate_formula" description:"FILTER rows where Status=Active"\`

**Budget vs. Actuals:**
→ \`sheets_agent action:"plan" description:"Budget + Actuals + Variance sheets with formulas"\`
`;

const ERROR_REFERENCE_CONTENT = `# ServalSheets Error & Performance Reference

## Operation Performance Tiers

Check \`_meta.executionTimeMs\` and \`_meta.apiCallsMade\` after each call.

| Tier | Latency | API Calls | Examples |
|------|---------|-----------|---------|
| **Instant** (<50ms) | 0 | Session/context ops, cached reads | sheets_session.*, sheets_auth.status, ETag 304 |
| **Fast** (50-300ms) | 1 | Single read/write, metadata | sheets_data.read, sheets_format.set_background |
| **Medium** (300ms-2s) | 1-3 | Batch ops, chart create, scout | batch_write, chart_create, scout |
| **Slow** (2-10s) | 3-10 | AI analysis, large imports | comprehensive, import_csv, clean |
| **Background** (10s+) | 5-20+ | Apps Script, timeline, BigQuery | sheets_appsscript.run, timeline |

**Quota**: 60 req/min per user. Use transactions (N ops in 1 call) or batch_write (100 cells in 1 call).

## Common Errors and Recovery

| Error Code | Meaning | Recovery |
|------------|---------|----------|
| UNAUTHENTICATED | Token expired/missing | Run sheets_auth status → login flow |
| PERMISSION_DENIED | No access to spreadsheet | Check spreadsheetId, request access |
| SPREADSHEET_NOT_FOUND | Invalid spreadsheetId | Verify ID from URL |
| SHEET_NOT_FOUND | Sheet name doesn't exist | Use sheets_core action:"list_sheets" |
| INVALID_RANGE | Bad A1 notation | Check format: "A1:B10" or "Sheet1!A1" |
| QUOTA_EXCEEDED | Too many requests | Wait 60s, use batch operations |
| INVALID_ARGUMENT | Bad parameter format/value | Check param types, use scout |
| CONFLICT | Concurrent modification | Use sheets_quality.detect_conflicts |
| TIMEOUT | Request took too long | Reduce range size, use batch_read |
| AUTH_EXPIRED | Credentials no longer valid | Run sheets_auth.login to refresh token |
| RATE_LIMITED | Too many rapid requests | Use exponential backoff |
| NOT_FOUND (chart) | Chart ID doesn't exist | Use sheets_visualize.chart_list |
| NOT_FOUND (range) | Named range doesn't exist | Use sheets_advanced.list_named_ranges |
| PROTECTED_RANGE | Range is protected | Use sheets_advanced to check protection |

Before destructive ops: use \`dryRun: true\` to preview; use \`sheets_confirm\` for >100 cells.
NEVER retry \`append\` on timeout (NOT idempotent, duplicates data).

## Google Sheets API Limitations

- **Data bars**: Use \`=SPARKLINE(data, {"charttype","bar"})\` formulas instead
- **Print setup**: Requires Apps Script (\`sheets_appsscript\`)
- **LAMBDA**: Not on Frontline/Nonprofits/legacy tiers; use named ranges
- **XLOOKUP**: Lookup range must be single row or column; use INDEX/MATCH for matrix
- **Revision content**: Drive API returns metadata only; use \`sheets_history.timeline\` for cells

## Examples: Common Requests → Correct Tool Calls

| "User says" | Correct call | Why NOT alternative |
|---|---|---|
| "Write 'Hello' in cell A1" | sheets_data write range:"Sheet1!A1" | write targets specific cell |
| "Add these rows to bottom" | sheets_data append range:"Sheet1" | append auto-finds end |
| "Add sheet called Sales" | sheets_core add_sheet title:"Sales" | dimensions adds rows, not sheets |
| "Insert 3 rows above row 5" | sheets_dimensions insert dimension:"ROWS" startIndex:4 endIndex:7 | 0-based indices |
| "Make header row bold+blue" | sheets_format batch_format | 1 API call for multiple formats |
| "Highlight cells >1000 red" | sheets_format add_conditional_format_rule | conditional, not validation |
| "Share with alice@co.com" | sheets_collaborate share_add role:"writer" | "writer" is API term |
| "Import data.csv to new sheet" | sheets_composite import_csv | data.write needs manual parsing |
| "Dependencies of cell D5" | sheets_dependencies get_dependents cell:"Sheet1!D5" | traces formula graph |
| "Undo last change" | sheets_history undo | undo vs revert_to |
| "What's in this spreadsheet?" | sheets_analyze scout | scout is metadata only (~200ms) |
| "Read A1 to D50" | sheets_data read range:"Sheet1!A1:D50" | you know the range |
| "Sort table by Date desc" | sheets_dimensions sort_range | server-side sort |
| "Get AAPL stock price" | sheets_connectors query connectorId:"alpha-vantage" | live API data |
| "Clean dates, whitespace, dupes" | sheets_fix clean mode:"preview" | auto-detects 10+ issues |
`;

const ADVANCED_USAGE_CONTENT = `# ServalSheets Advanced Usage

## Formula Locale

Non-English locales use \`;\` as separator, \`,\` as decimal.
Always check \`spreadsheetLocale\` (returned by scout/read) before writing formulas.

Example: English \`=SUM(A1:A10)\` → German \`=SUMME(A1:A10)\` with \`;\` separators.

## Color Format

All colors use **0-1 float scale** (NOT 0-255):
\`{ "red": 0.2, "green": 0.6, "blue": 0.8 }\`

Common colors: white = {1,1,1}, black = {0,0,0}, red = {1,0,0}

## AI Features (Sampling SEP-1577)

These actions auto-invoke MCP Sampling for AI-powered analysis:
- \`sheets_analyze.generate_formula\` — NL → Google Sheets formula
- \`sheets_visualize.suggest_chart\` — data-aware chart recommendations
- \`sheets_fix.suggest_cleaning\` — AI cleaning recommendations
- \`sheets_dependencies.model_scenario\` — narrative impact explanation
- \`sheets_history.diff_revisions\` — AI-summarized change explanations
- \`sheets_data.find_replace\` — dry-run replacement estimate

All degrade gracefully to rule-based heuristics when the client doesn't support sampling.

## MCP Protocol Features

### Elicitation (SEP-1036)
Destructive operations may open interactive approval dialogs via MCP elicitation.
Use \`dryRun: true\` when the client doesn't support elicitation to preview changes safely.

### Tasks (SEP-1686)
Use \`tasks/call\` instead of \`tools/call\` for background tracking on long-running operations.
The response \`_meta.taskHint\` will suggest this when appropriate.

### Transactions
For 5+ mixed operations: \`sheets_transaction.begin\` → \`queue\` (repeat) → \`commit\`.
Provides 80-95% API savings vs individual calls, with automatic rollback on failure.

### Completions
Argument autocompletion is available for spreadsheetId, range, action, sheetName, and more.
Recently-used values are prioritized in completion results.
`;

const RANGE_STRATEGY_CONTENT = `# ServalSheets Range Strategy

## Priority Order — always use the highest-applicable strategy:

| Priority | Strategy | When to Use | API Cost | Example |
|----------|----------|-------------|----------|---------|
| 1 | **User-provided range** | User specifies cells | 1 call | \`sheets_data.read range:"Sheet1!A1:D50"\` |
| 2 | **Metadata-first** | No range, need actual bounds | 2 calls | scout → read with discovered bounds |
| 3 | **Scout + targeted** | Exploratory analysis | 1-2 calls | scout returns structure → use sheet dimensions |
| 4 | **Tiered retrieval** | Full analysis workflows | 1-4 calls | comprehensive auto-tiers |
| 5 | **Bounded fallback** | Metadata fetch failed | 1 call | A1:Z1000 (26K cells max) |

## NEVER do these:
- Do NOT fetch A1:ZZ10000 (260K cells) — resolve bounds first
- Do NOT use \`includeGridData: true\` without a \`ranges\` parameter
- Do NOT use full-column references like A:Z — triggers full grid scan
- Do NOT skip field masks on spreadsheets.get()

## ALWAYS do these:
- ALWAYS include sheet name: \`"Sheet1!A1:D50"\` not \`"A1:D50"\`
- ALWAYS use scout first when range is unknown
- ALWAYS use \`verbosity:"minimal"\` for value-only reads
- ALWAYS use \`batch_read\` for 3+ ranges (same API cost)
- Cap: 10K rows for data reads, 1K rows for formatting scans

## Dynamic Range Resolution (best practice):
1. \`sheets_analyze.scout spreadsheetId:"..."\` → returns \`{ sheets: [{ rowCount: 500, columnCount: 8 }] }\`
2. \`sheets_data.read range:"Sheet1!A1:H500"\` ← bounded to actual data
`;

const SAFETY_CONFIRMATION_CONTENT = `# When to Request User Confirmation

## Always Confirm (No exceptions)

1. **Deleting sheets** — Any sheets_core action="delete_sheet" call
2. **Deleting rows (>10)** — sheets_dimensions action="delete" dimension="ROWS" with count > 10
3. **Deleting columns (>3)** — sheets_dimensions action="delete" dimension="COLUMNS" with count > 3
4. **Clearing data (>100 cells)** — sheets_data action="clear" on large ranges
5. **Large writes (>500 cells)** — sheets_data action="write" with >500 cells
6. **Multi-step operations (3+ steps)** — Use sheets_confirm to show the plan
7. **Sharing/permissions** — Any sheets_collaborate sharing call
8. **Anything user didn't explicitly request** — Side effects always need approval

## Suggest Confirmation (Offer, don't require)

- 50-500 cell modifications
- Formatting large ranges
- Adding formulas to existing data
- Sorting/filtering operations
- Import operations

Offer: "I'll update {N} cells. Want me to show a preview first?"

## No Confirmation Needed

- All read operations (read, get, list, find)
- Single cell updates user explicitly asked for
- Small writes (<50 cells) user requested
- Analysis operations, getting statistics

## How to Use sheets_confirm

Build a plan with title, description, steps (with risk level and isDestructive flag), then call sheets_confirm action="request". Check response: approved → execute, declined → abort, modified → adjust.

## Golden Rules

1. Deletion = ALWAYS confirm
2. >100 cells = ALWAYS confirm
3. Sharing = ALWAYS confirm
4. Multi-step = ALWAYS show plan
5. Small explicit requests = No confirmation
6. When uncertain = ASK
7. Offer snapshots for destructive ops
8. Offer dryRun when user seems unsure
`;

const CONFIRMATION_EXAMPLES_CONTENT = `# Confirmation Examples: Good vs Bad

## Example 1: Delete rows with empty status
User: "Delete all rows where status is empty"

BAD: "Done! I deleted 23 rows."

GOOD: "I found 23 rows with empty status. Before I delete them:
1. Want to see which rows they are?
2. I'll create a snapshot so you can undo if needed.
Ready to proceed?"

## Example 2: Clear a column
User: "Clear column D"

BAD: "Cleared column D."

GOOD: "Column D has 847 cells with data. Clearing will erase D2:D848 and may break referencing formulas. Should I show what's there first, or create a snapshot then clear?"

## Example 3: Simple cell update
User: "Change cell A1 to 'Hello'"

BAD (over-confirming): "Are you absolutely sure you want to change A1?"

GOOD: "Done! Changed A1 to 'Hello'." (No confirmation needed for small, explicit requests)

## Example 4: Create a CRM (multi-step)
User: "Set up a CRM for me"

BAD: "Creating CRM... done! I made 6 sheets and added formulas."

GOOD: "I'll create a CRM with Dashboard, Contacts, Companies, Deals, Activities, and Settings sheets. This involves ~15 operations. [Shows plan via sheets_confirm] Ready to create it?"

## Example 5: Share spreadsheet
User: "Share this with john@example.com"

BAD: "Shared with john@example.com as editor."

GOOD: "I'll share with john@example.com. What permission level — Viewer, Commenter, or Editor? Should I send a notification email?"

## Example 6: User says "just do it"
User: "Just format all the headers, don't ask me"

CORRECT: "Got it! Formatting headers now..." (Respect user's preference, track for future)

## Key Takeaways

1. Big operations → Always confirm with details
2. Small explicit requests → Just do it
3. Destructive operations → Offer snapshot + confirm
4. Multi-step → Show the plan first
5. Respect "just do it" preferences
6. When in doubt → Ask nicely
`;

// ============================================================================
// RESOURCES REGISTRATION
// ============================================================================

// Guard against double-registration (SDK throws if a resource template name is reused)
const registeredServers = new WeakSet<McpServer>();

/**
 * Registers ServalSheets resources with the MCP server
 *
 * Resources provide read-only access to spreadsheet metadata via URI templates.
 * Note: resources/list uses SDK's built-in handler. Cursor pagination is not needed
 * with <10 resource templates. The SDK returns all resources in a single page per
 * MCP 2025-11-25 spec (cursor pagination is optional for small collections).
 *
 * @param server - McpServer instance
 * @param googleClient - Google API client (null if not authenticated)
 */
export function registerServalSheetsResources(
  server: McpServer,
  googleClient: GoogleApiClient | null
): void {
  if (registeredServers.has(server)) {
    return; // Already registered on this server instance
  }
  registeredServers.add(server);
  const spreadsheetTemplate = new ResourceTemplate('sheets:///{spreadsheetId}', {
    list: undefined,
    complete: {
      spreadsheetId: async (value) => completeSpreadsheetId(value),
    },
  });

  const rangeTemplate = new ResourceTemplate('sheets:///{spreadsheetId}/{range}', {
    list: undefined,
    complete: {
      spreadsheetId: async (value) => completeSpreadsheetId(value),
      range: async (value) => completeRangeContextAware(value),
    },
  });

  server.registerResource(
    'spreadsheet',
    spreadsheetTemplate,
    {
      title: 'Spreadsheet',
      description: 'Google Sheets spreadsheet metadata (properties and sheet list)',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const rawSpreadsheetId = variables['spreadsheetId'];
      const spreadsheetId = Array.isArray(rawSpreadsheetId)
        ? rawSpreadsheetId[0]
        : rawSpreadsheetId;

      if (!spreadsheetId || typeof spreadsheetId !== 'string') {
        return { contents: [] };
      }

      if (!googleClient) {
        throw createAuthRequiredError(uri.href);
      }

      try {
        const sheetsResponse = await googleClient.sheets.spreadsheets.get({
          spreadsheetId,
          fields: 'properties,sheets.properties',
        });

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(sheetsResponse.data, null, 2),
            },
          ],
        };
      } catch (error) {
        throw createResourceReadError(uri.href, error);
      }
    }
  );

  server.registerResource(
    'spreadsheet_range',
    rangeTemplate,
    {
      title: 'Spreadsheet Range',
      description: 'Google Sheets range values (A1 notation)',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const rawSpreadsheetId = variables['spreadsheetId'];
      const rawRange = variables['range'];
      const spreadsheetId = Array.isArray(rawSpreadsheetId)
        ? rawSpreadsheetId[0]
        : rawSpreadsheetId;
      const encodedRange = Array.isArray(rawRange) ? rawRange[0] : rawRange;
      const range = typeof encodedRange === 'string' ? decodeURIComponent(encodedRange) : undefined;

      if (!spreadsheetId || typeof spreadsheetId !== 'string' || !range) {
        return { contents: [] };
      }

      if (!googleClient) {
        throw createAuthRequiredError(uri.href);
      }

      // P1-2: Parse pagination parameters from query string
      // URI format: sheets:///spreadsheetId/range?_limit=100&_offset=0
      const DEFAULT_LIMIT = 10000; // Max cells per response
      const parsedUrl = new URL(uri.href, 'sheets://localhost');
      const limitParam = parsedUrl.searchParams.get('_limit');
      const offsetParam = parsedUrl.searchParams.get('_offset');
      const limit = limitParam ? Math.min(parseInt(limitParam, 10), DEFAULT_LIMIT) : DEFAULT_LIMIT;
      const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

      try {
        const valuesResponse = await googleClient.sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });

        const allValues = valuesResponse.data.values || [];
        const totalRows = allValues.length;
        const totalCells = allValues.reduce(
          (sum, row) => sum + (Array.isArray(row) ? row.length : 0),
          0
        );

        // Apply pagination (row-based offset and cell-based limit)
        let paginatedValues: unknown[][];
        let cellCount = 0;

        if (offset > 0) {
          // Skip offset rows
          paginatedValues = [];
          for (let i = offset; i < allValues.length; i++) {
            const row = allValues[i]!;
            const rowLength = Array.isArray(row) ? row.length : 0;
            if (cellCount + rowLength > limit) {
              break;
            }
            paginatedValues.push(row);
            cellCount += rowLength;
          }
        } else {
          // Apply cell limit from start
          paginatedValues = [];
          for (const row of allValues) {
            const rowLength = Array.isArray(row) ? row.length : 0;
            if (cellCount + rowLength > limit) {
              break;
            }
            paginatedValues.push(row);
            cellCount += rowLength;
          }
        }

        const hasMore = offset + paginatedValues.length < totalRows;
        const nextOffset = offset + paginatedValues.length;

        // Build result with pagination metadata
        const pagination: Record<string, unknown> = {
          offset,
          limit,
          totalRows,
          totalCells,
          returnedRows: paginatedValues.length,
          hasMore,
        };
        if (hasMore) {
          pagination['nextUri'] =
            'sheets:///' +
            spreadsheetId +
            '/' +
            encodeURIComponent(range) +
            '?_limit=' +
            String(limit) +
            '&_offset=' +
            String(nextOffset);
        }

        const result: Record<string, unknown> = {
          ...valuesResponse.data,
          values: paginatedValues,
          _pagination: pagination,
        };

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        throw createResourceReadError(uri.href, error);
      }
    }
  );

  // Full context resource — structural metadata for LLM context injection
  const contextTemplate = new ResourceTemplate('sheets:///{spreadsheetId}/context', {
    list: undefined,
    complete: {
      spreadsheetId: async (value) => completeSpreadsheetId(value),
    },
  });

  server.registerResource(
    'spreadsheet_context',
    contextTemplate,
    {
      title: 'Spreadsheet Full Context',
      description:
        'Complete spreadsheet structural metadata: sheets, charts, named ranges, protected ranges, conditional formats, filter views, slicers. Optimized field mask — no cell data.',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const rawSpreadsheetId = variables['spreadsheetId'];
      const spreadsheetId = Array.isArray(rawSpreadsheetId)
        ? rawSpreadsheetId[0]
        : rawSpreadsheetId;

      if (!spreadsheetId || typeof spreadsheetId !== 'string') {
        return { contents: [] };
      }

      if (!googleClient) {
        throw createAuthRequiredError(uri.href);
      }

      try {
        const response = await googleClient.sheets.spreadsheets.get({
          spreadsheetId,
          fields: [
            'properties(title,locale,timeZone,defaultFormat)',
            'sheets(properties,conditionalFormats,charts,protectedRanges,bandedRanges',
            'filterViews,slicers,merges,basicFilter)',
            'namedRanges',
          ].join(','),
        });

        const data = response.data;
        const context = {
          spreadsheetId,
          title: data.properties?.title,
          locale: data.properties?.locale,
          timeZone: data.properties?.timeZone,
          sheets: (data.sheets || []).map((s) => ({
            sheetId: s.properties?.sheetId,
            title: s.properties?.title,
            rowCount: s.properties?.gridProperties?.rowCount,
            columnCount: s.properties?.gridProperties?.columnCount,
            frozenRows: s.properties?.gridProperties?.frozenRowCount || 0,
            frozenColumns: s.properties?.gridProperties?.frozenColumnCount || 0,
            chartCount: s.charts?.length || 0,
            conditionalFormatCount: s.conditionalFormats?.length || 0,
            protectedRangeCount: s.protectedRanges?.length || 0,
            filterViewCount: s.filterViews?.length || 0,
            slicerCount: s.slicers?.length || 0,
            mergeCount: s.merges?.length || 0,
            hasBasicFilter: !!s.basicFilter,
            bandedRangeCount: s.bandedRanges?.length || 0,
          })),
          namedRangeCount: data.namedRanges?.length || 0,
          namedRanges: (data.namedRanges || []).map((nr) => ({
            name: nr.name,
            range: nr.range,
          })),
        };

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(context, null, 2),
            },
          ],
        };
      } catch (error) {
        throw createResourceReadError(uri.href, error);
      }
    }
  );

  // Action completion template — enables completeAction() via MCP completion protocol.
  // Clients can request completions for sheets://tools/{toolName}/actions/{action} URIs.
  // The action completer reads toolName from the completion context (MCP 2025-11-25 context.arguments).
  const toolActionTemplate = new ResourceTemplate('sheets://tools/{toolName}/actions/{action}', {
    list: undefined,
    complete: {
      toolName: async (value) => Object.keys(TOOL_ACTIONS).filter((t) => t.startsWith(value || '')),
      action: async (value, context) => {
        const ctx = context as { arguments?: Record<string, string> } | undefined;
        const toolName = ctx?.arguments?.['toolName'] ?? '';
        return completeAction(toolName, value || '');
      },
    },
  });

  server.registerResource(
    'tool_action',
    toolActionTemplate,
    {
      title: 'Tool Action',
      description: 'ServalSheets tool action reference. Use for action name autocompletion.',
      mimeType: 'application/json',
    },
    async (_uri, _variables) => {
      return { contents: [] }; // completions-only resource; no read content
    }
  );

  // Server health snapshot — no auth required, returns in-process metrics
  server.registerResource(
    'server_health',
    'metrics://servalsheets/health',
    {
      title: 'Server Health Snapshot',
      description: 'Server health snapshot including circuit breakers, cache, quota, and error rates',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'metrics://servalsheets/health',
          mimeType: 'application/json',
          text: JSON.stringify(getHealthSnapshot(), null, 2),
        },
      ],
    })
  );

  // guide:// resources — extracted from server instructions to reduce payload size.
  // Clients can read these on demand via resources/read.
  const guideResources: Array<{ uri: string; description: string; content: string }> = [
    {
      uri: 'guide://tool-selection',
      description: 'Unified tool selection guide: quick routing table, decision tree by intent, and disambiguation for same-named actions (list/delete/create/get/update/import)',
      content: TOOL_SELECTION_CONTENT,
    },
    {
      uri: 'guide://workflows',
      description: 'Common patterns, tool chaining workflows, interactive wizards, and advanced sheet patterns',
      content: WORKFLOWS_CONTENT,
    },
    {
      uri: 'guide://error-reference',
      description: 'Error codes, recovery steps, performance tiers, API limitations, and common request examples',
      content: ERROR_REFERENCE_CONTENT,
    },
    {
      uri: 'guide://range-strategy',
      description: 'Priority-ordered strategies for efficient data fetching with range resolution patterns',
      content: RANGE_STRATEGY_CONTENT,
    },
    {
      uri: 'guide://advanced-usage',
      description: 'AI features (Sampling), MCP protocol details (elicitation, tasks, transactions), formula locale, color format',
      content: ADVANCED_USAGE_CONTENT,
    },
    {
      uri: 'guide://safety-confirmation',
      description: 'When and how to request user confirmation before operations — decision tree with thresholds and golden rules',
      content: SAFETY_CONFIRMATION_CONTENT,
    },
    {
      uri: 'guide://confirmation-examples',
      description: 'Good vs bad confirmation behavior examples — 6 scenarios showing proper confirmation patterns',
      content: CONFIRMATION_EXAMPLES_CONTENT,
    },
  ];
  for (const guide of guideResources) {
    server.registerResource(
      guide.uri.replace('guide://', 'guide_').replace(/-/g, '_'),
      guide.uri,
      {
        title: guide.uri.replace('guide://', ''),
        description: guide.description,
        mimeType: 'text/markdown',
      },
      async () => ({
        contents: [
          {
            uri: guide.uri,
            mimeType: 'text/markdown',
            text: guide.content,
          },
        ],
      })
    );
  }

  // Register additional data exploration resources
  registerChartResources(server, googleClient?.sheets ?? null);
  registerPivotResources(server, googleClient?.sheets ?? null);
  registerQualityResources(server, googleClient?.sheets ?? null);
}
