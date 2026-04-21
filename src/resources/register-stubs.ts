/**
 * register-stubs.ts
 *
 * Provides register*Resources() functions for resource shim files that contain
 * only a const export (no get*Resources() or register*Resources() functions).
 *
 * These shims exist as typed constants used elsewhere in the codebase.
 * The actual resource text content and MCP registration logic lives here.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nameFromUri(uri: string): string {
  return uri
    .split('/')
    .pop()!
    .replace(/[^a-z0-9]+/gi, '_')
    .toLowerCase()
    .replace(/^_|_$/g, '');
}

function registerItems(
  server: McpServer,
  items: Array<{ uri: string; mimeType?: string; text: string }>
): void {
  for (const item of items) {
    const mimeType = item.mimeType ?? 'text/plain';
    server.registerResource(
      nameFromUri(item.uri),
      item.uri,
      { description: '', mimeType },
      async (uri) => ({
        contents: [
          { uri: typeof uri === 'string' ? uri : uri.toString(), mimeType, text: item.text },
        ],
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

export function registerCacheResources(server: McpServer): void {
  registerItems(server, [
    {
      uri: 'cache://stats',
      text: `Cache Performance Metrics

Three-tier caching system:

1. ETag Cache (HTTP 304)
   - Conditional requests to Google API
   - Reduces bandwidth by 95%
   - Automatic via googleapis client

2. Local LRU Cache
   - 5-minute TTL
   - Per-range storage
   - Hit rates: 80-100% for repeat reads

3. Request Deduplication
   - 50ms window for identical requests
   - Automatic merge of overlapping ranges
   - Estimated 20-40% reduction in API calls

Invalidation:
- Mutation operations clear relevant ranges
- Dependency graph tracks cascades
- Full cache clear on spreadsheet edits

Memory: Bounded LRU prevents unbounded growth`,
    },
    {
      uri: 'cache://deduplication',
      text: `Request Deduplication System

How it works:

1. Collection window: 50ms
   - All requests arriving within 50ms are collected
   - Adaptive window: 20-200ms based on traffic

2. Overlap detection:
   - A1:C10 + B5:D15 merged to A1:D15
   - Single API call instead of two
   - Savings: 20-40% for overlapping patterns

3. Request merging:
   - Bounding box calculation
   - ENABLE_REQUEST_MERGING=true to activate
   - Automatic deduplication in batching system

4. Performance impact:
   - 0ms overhead for non-overlapping
   - 1-5ms for merge computation
   - Net savings: 50-500ms per session (typical)

Configuration:
- ENABLE_REQUEST_MERGING (default: true)
- Window timing: adaptive or fixed
- Max merge attempts: 3 per collection`,
    },
  ]);
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export function registerHistoryResources(server: McpServer): void {
  registerItems(server, [
    {
      uri: 'history://operations',
      text: `Operation History

All operations are tracked and can be undone.

Tracked operations:

Write operations:
- write: cell value changes
- append: new rows added
- clear: cells cleared
- find_replace: bulk replacements

Format operations:
- set_format: formatting changes
- set_borders: border modifications
- set_background: color changes
- set_number_format: number format changes

Structural operations:
- insert: new rows/columns
- delete: removed rows/columns
- move: moved rows/columns
- hide/show: visibility changes
- freeze: freeze row/column

Filter operations:
- set_basic_filter: filter applied
- clear_basic_filter: filter removed
- create_filter_view: named filter created
- update_filter_view: filter updated

History features:
- Full undo/redo support
- Timeline with timestamps
- User attribution (if configured)
- Selective rollback to any point
- Snapshot creation for checkpoints
- Compaction for old operations`,
    },
    {
      uri: 'history://snapshots',
      text: `Snapshot System

Snapshots are point-in-time backups of spreadsheet state.

Types:

Automatic snapshots:
- Before destructive operations
- Created when safety rail triggered
- Expires after 24 hours
- Max 10 automatic snapshots

Manual snapshots:
- Created by user request
- Named with custom description
- Persist indefinitely
- Up to 50 per spreadsheet

Snapshot operations:
- Create: save current state
- List: view all snapshots
- Restore: revert to snapshot
- Delete: remove snapshot
- Compare: diff from snapshot

Snapshots include:
- All cell values
- Formatting information
- Formula content
- Named ranges
- Filter views
- Chart definitions
- Conditional formatting rules

Not included:
- Edit history before snapshot
- Comments
- Revision metadata`,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Transaction
// ---------------------------------------------------------------------------

export function registerTransactionResources(server: McpServer): void {
  registerItems(server, [
    {
      uri: 'transaction://guide',
      text: `Transaction System Guide

Execute multiple operations atomically (all-or-nothing).

How transactions work:

1. Begin transaction
   - Creates operation queue
   - Captures initial state
   - Starts timeout (5 minutes)

2. Queue operations
   - Add multiple write/format operations
   - No API calls yet
   - All queued operations validated
   - Batchable and non-batchable separated

3. Commit
   - Execute batchable operations first (single API call)
   - Execute non-batchable operations (separate calls)
   - All succeed or entire transaction rolls back
   - History recorded as single unit

4. Rollback (on error)
   - Undo all completed operations
   - Restore from snapshot
   - Error details provided
   - User can retry or abandon

Batchable operations:
- values:write, values:append, values:clear
- format:update
- sheet:update
- Up to 100 per API call

Non-batchable operations:
- chart:create, chart:delete
- filter_view:create, filter_view:delete
- resource_link:add
- comment:add
- Each requires separate API call

Best practices:
- Group related operations in transactions
- Batch similar operations together
- Keep transactions <1 minute execution time
- Test with preview mode first
- Use snapshots for safety`,
    },
    {
      uri: 'transaction://manager-docs',
      text: `Transaction Manager Documentation

Internal implementation details.

TransactionManager class:
- Manages transaction state
- Tracks queued operations
- Handles commit/rollback logic
- Coordinates with Google APIs
- Enforces constraints

Transaction states:
- INITIAL: Just created, ready to queue
- QUEUED: Operations added, ready to commit
- COMMITTING: Executing operations
- COMMITTED: All operations completed
- FAILED: Error occurred, needs rollback
- ROLLED_BACK: All changes undone

Operation batching:
- Groups batchable operations
- Max 100 operations per batchUpdate
- Respects cell/sheet limits
- Validates references before commit

Error handling:
- Captures error details
- Partial rollback if failure mid-execution
- Snapshot-based recovery
- User retry capability

Performance:
- 0ms overhead for single operations
- Batch efficiency: up to 80% reduction vs sequential
- Typical execution: 200-1000ms
- Timeout: 5 minutes per transaction`,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Conflict
// ---------------------------------------------------------------------------

export function registerConflictResources(server: McpServer): void {
  registerItems(server, [
    {
      uri: 'conflict://detection',
      text: `Conflict Detection

Detects concurrent modifications when two clients edit simultaneously.

How detection works:

1. Capture current spreadsheet state before operation
2. Perform operation locally
3. Fetch fresh state from Google Sheets
4. Compare: baseline vs fresh state
5. If mismatch: conflict detected

Conflict types:

Cell conflicts:
- Cell edited by another user while you were working
- Shows: original other user's value your proposed value

Range conflicts:
- Multiple cells modified (structural changes)
- Detected when row/column counts change

Formula conflicts:
- Formula cell modified by another user
- Shows old vs new formula text

Resolution options:
- Keep current (other user's changes)
- Use remote (your changes overwrite)
- Merge (combine where possible)

Non-conflicting scenarios:
- Different ranges: no conflict
- Same range, different columns: usually mergeable
- Different sheets: no conflict`,
    },
    {
      uri: 'conflict://transaction-journal',
      text: `Transaction Journal

Atomic multi-operation transactions:

Flow:
1. Begin transaction (creates scope)
2. Queue operations (no API calls yet)
3. Commit: execute all or none
4. Rollback: undo on failure

Batchable operations:
- values:write, values:append, values:clear
- format:update
- sheet:update
- batch up to 100 per call

Non-batchable (commit separately):
- chart:create, chart:delete
- resource_link:add
- comment:add
- filter_view:create

Transaction safety:
- Snapshot before commit
- All-or-nothing atomicity
- Automatic rollback on error
- History tracked as single unit`,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Impact
// ---------------------------------------------------------------------------

export function registerImpactResources(server: McpServer): void {
  registerItems(server, [
    {
      uri: 'impact://analyzer',
      text: `Impact Analyzer

Predicts how changes ripple through dependent formulas.

Capabilities:

1. Dependency graph building
   - Maps all cell references
   - Identifies formula dependencies
   - Detects circular references
   - Performance: <500ms per sheet

2. Impact calculation
   - Shows all dependent cells
   - Calculates cascade depth
   - Estimates affected cell count
   - Risk assessment (low/medium/high)

3. Change simulation
   - What-if analysis
   - Traces formula recalculation
   - Shows value changes
   - Percentage delta calculation

4. Safety scoring
   - Low risk: 10 or fewer dependents
   - Medium risk: 11-100 dependents
   - High risk: more than 100 dependents
   - Critical: circular references`,
    },
    {
      uri: 'impact://what-if',
      text: `What-If Analysis

Scenario modeling for decision making.

Types of scenarios:

1. Value change
   - Change single cell value
   - See impact on dependent formulas

2. Formula change
   - Modify formula logic
   - Check impact on downstream cells

3. Data change
   - Modify multiple cells
   - Complex scenario modeling

4. Structural change
   - Add/remove rows or columns
   - Check formula breaks

Features:
- Non-destructive (doesn't modify original)
- Multiple scenarios supported
- Comparison views
- Rollback to original anytime`,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function registerValidationResources(server: McpServer): void {
  registerItems(server, [
    {
      uri: 'validation://builtin-rules',
      text: `Built-in Validation Rules

Pre-configured validation rules for common scenarios.

Number validations:
- whole_number: Integer values only
- decimal: Any decimal number
- greater_than: X > threshold
- less_than: X < threshold
- between: min <= X <= max

Text validations:
- text_length: String length constraints
- text_contains: Must contain substring
- text_is_email: Valid email format
- text_is_url: Valid URL format
- custom_formula: Formula-based validation

Date validations:
- date_is_valid: Valid date value
- date_on_or_after: >= date
- date_on_or_before: <= date
- date_between: date range

List validations:
- list: Choose from dropdown list
- list_is_range: Values from range

Implementation:
- Native Google Sheets data validation
- Applied to cells or ranges
- Evaluated on data entry
- Prevents invalid submissions`,
    },
    {
      uri: 'validation://engine-stats',
      text: `Validation Engine Statistics

Performance:
- Validation overhead: <1ms per cell
- Bulk validation time: <100ms per range
- Cache hit rate: 95%+ for common rules
- Memory usage: <1MB per 1000 rules

Compliance:
- Rules matching business requirements
- Updated rule tracking
- Audit trail of changes`,
    },
    {
      uri: 'validation://comprehensive-docs',
      text: `Validation Engine Documentation

ValidationEngine class:
- Manages validation rules
- Applies rules to ranges
- Tracks violations
- Provides recommendations

Builtin validators:
- NumberValidator: Range, whole, decimal checks
- TextValidator: Length, pattern, email, URL
- DateValidator: Valid date, range, today
- ListValidator: Dropdown, range-based
- CheckboxValidator: Boolean values
- CustomValidator: Formula-based`,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export function registerMetricsResources(server: McpServer): void {
  registerItems(server, [
    {
      uri: 'metrics://api-calls',
      text: `API Call Metrics

Google Sheets API usage:

By operation:
- batchGet: Most common (read operations)
- batchUpdate: All mutations combined
- spreadsheets.get: Metadata fetches
- values.append: Adding rows

Quota tracking:
- Daily limit: 500,000 cells
- Rate limit: 100 requests per 100 seconds per user

Circuit breaker:
- Activates after 5 failures in 30s
- Returns cached data in read-only mode
- Auto-resets after 30s of stability`,
    },
    {
      uri: 'metrics://performance',
      text: `Performance Metrics

Operation latency:
- read (simple): 100-300ms
- read (large range): 500ms-5s
- write (single cell): 200-400ms
- write (batch): 300-800ms
- analysis (quick): 200-400ms
- analysis (comprehensive): 5-30s`,
    },
    {
      uri: 'metrics://reliability',
      text: `Reliability Metrics

Error rates:
- Authentication: <0.1% (cached tokens)
- API calls: <2% (transient errors)
- Validation: <0.5% (schema mismatches)

Recovery:
- Automatic retry: 3 attempts with exponential backoff
- Circuit breaker: Read-only fallback mode
- Timeout: 30s per request, 5m per batch`,
    },
    {
      uri: 'metrics://usage-dashboard',
      text: `Usage Dashboard

Session statistics:
- Total actions per session
- Mutations vs reads ratio
- Most used tools: Ranked list
- Error rate: Failures per 1000 ops

Cache effectiveness:
- Cache hits: Count and percentage
- Bytes saved: Estimated bandwidth reduction
- Duplicates eliminated: Merged requests`,
    },
    {
      uri: 'metrics://optimization-advisor',
      text: `Optimization Advisor

API optimization:
- High error rate detected: Check quotas, network
- Many duplicate requests: Enable request merging
- Low cache hit rate: Increase TTL or fetch size

Formula optimization:
- Slow formulas: Use INDEX/MATCH instead of VLOOKUP
- Large dependency chains: Break into smaller steps

Session optimization:
- Sequential reads detected: Use parallel executor
- High mutation rate: Use transactions`,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export function registerDiscoveryResources(server: McpServer): void {
  registerItems(server, [
    {
      uri: 'discovery://api-health',
      text: `Google API Health Check

Google Sheets API (v4)
- Quota: 500k cells/day
- Rate limit: 100 req/100s per user
- Circuit breaker: 5 failures resets after 30s

Google Drive API (v3)
- Quota: 1m calls/day
- Rate limit: 1000 req/100s per user

Google BigQuery API
- Quota: 100k queries/day
- Circuit breaker: 3 failures

Google Apps Script API
- Quota: 20m executions/day
- Rate limit: 20 req/s`,
    },
    {
      uri: 'discovery://versions',
      text: `API Versions

Google Sheets: v4 (latest stable)
Google Drive: v3 (latest stable)
BigQuery: v2 (latest stable)
Apps Script: v1 (latest stable)

Version compatibility:
- All APIs compatible with Node.js 18+
- googleapis package: v130+
- google-auth-library: v9+`,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Confirm
// ---------------------------------------------------------------------------

export function registerConfirmResources(server: McpServer): void {
  registerItems(server, [
    {
      uri: 'confirm://wizards',
      text: `Interactive Wizard System

Wizards guide complex operations step-by-step.

Available wizards:

1. Chart Creation
   - Step 1: Select chart type
   - Step 2: Configure data range
   - Step 3: Set title and axis labels

2. Conditional Formatting
   - Step 1: Select rule type
   - Step 2: Configure conditions
   - Step 3: Set formatting style

3. Spreadsheet Creation
   - Step 1: Enter title
   - Step 2: Select template (optional)

All wizards:
- Non-blocking (graceful degradation without support)
- Support multipart forms
- Return executable parameters`,
    },
    {
      uri: 'confirm://destructive-ops',
      text: `Destructive Operations

Operations requiring confirmation:

Sheet Operations:
- Delete sheet
- Clear all data
- Delete rows/columns (more than 10)

Data Operations:
- Delete duplicates
- Overwrite range (more than 100 cells)
- Find and replace (global)

For each:
1. Show description of impact
2. Request user confirmation
3. Create snapshot for undo
4. Execute operation
5. Track in history`,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Analyze
// ---------------------------------------------------------------------------

export function registerAnalyzeResources(server: McpServer): void {
  registerItems(server, [
    {
      uri: 'analyze://stats',
      text: `Analysis Statistics

The analyze tool provides comprehensive spreadsheet analysis including:

- Data profiling: type detection, null rates, cardinality
- Quality scoring: data quality percentages, anomaly detection
- Pattern recognition: trends, seasonality, outliers
- Structure analysis: headers, tables, named ranges
- Formula analysis: dependency tracking, error detection
- Performance analysis: slow formulas, unused calculations

Note: Analyses are cached for 5 minutes per range.`,
    },
    {
      uri: 'analyze://help',
      text: `Analysis Action Guide

quick_insights
- Fast preliminary scan (~200ms)
- Returns high-level patterns

comprehensive
- Full 43-feature analysis
- Includes AI-powered insights

scout
- Column type detection
- Empty rate analysis

analyze_quality
- Data quality scoring
- Issue detection

analyze_performance
- Formula efficiency analysis
- Slow formula detection`,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

export function registerChartResources(server: McpServer, _sheets?: unknown): void {
  registerItems(server, [
    {
      uri: 'charts://types',
      text: `Chart Types Supported

Basic:
- Line chart (trends, time series)
- Column chart (categorical comparison)
- Bar chart (horizontal categorical)
- Area chart (stacked trends)

Comparison:
- Combo chart (mixed line + column)
- Scatter chart (correlation analysis)

Distribution:
- Histogram (frequency distribution)
- Pie chart (composition)
- Donut chart (part-to-whole)

Statistical:
- Box plot (quartiles, outliers)
- Candlestick (OHLC data)

Map:
- Geo chart (geographic distribution)`,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Pivots
// ---------------------------------------------------------------------------

export function registerPivotResources(server: McpServer, _sheets?: unknown): void {
  registerItems(server, [
    {
      uri: 'pivots://guide',
      text: `Pivot Tables Guide

What are pivot tables?
- Summarize data by categories
- Aggregate values (sum, count, average)
- Compare across dimensions

Typical uses:
- Sales by region and month
- Product performance by category
- Customer analysis by segment

Google Sheets pivot API:
- createPivotTable: Create new pivot
- updatePivotTable: Modify structure
- deletePivotTable: Remove pivot`,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Quality
// ---------------------------------------------------------------------------

export function registerQualityResources(server: McpServer, _sheets?: unknown): void {
  registerItems(server, [
    {
      uri: 'quality://analysis',
      text: `Data Quality Analysis

Assesses data completeness, consistency, and accuracy.

Quality dimensions:

Completeness:
- Blank cells (count and percentage)
- Null values by column
- Score: 100% - (blanks / total)

Consistency:
- Format inconsistencies (dates, numbers, text)
- Type mismatches (text in number column)
- Case variations

Accuracy:
- Outliers (statistical anomalies)
- Invalid formats (email, phone, URL)

Quality score calculation:
- 0-100% scale
- More than 90%: Excellent
- 70-90%: Good
- 50-70%: Needs work
- Less than 50%: Critical issues`,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------

export async function registerKnowledgeResources(server: McpServer): Promise<void> {
  registerItems(server, [
    {
      uri: 'knowledge://formula-library',
      text: `Formula Library

Math & Statistics:
- SUM(range): Total of values
- AVERAGE(range): Mean value
- MEDIAN(range): Middle value
- STDEV(range): Standard deviation
- COUNTIF(range, criteria): Conditional count
- SUMIF(range, criteria, sum_range): Conditional sum

Text:
- CONCATENATE(A1, " ", B1): Join text
- TRIM(text): Remove whitespace
- SUBSTITUTE(text, old, new): Replace text

Date & Time:
- TODAY(): Current date
- NOW(): Current date & time
- DATEDIF(date1, date2, "D"): Days between

Logic:
- IF(condition, true_val, false_val): Conditional
- AND(cond1, cond2): All must be true
- IFS(cond1, val1, cond2, val2, ...): Multiple conditions

Lookup:
- INDEX/MATCH: Preferred over VLOOKUP (faster)
- FILTER(range, criteria): Filter rows
- UNIQUE(range): Remove duplicates`,
    },
    {
      uri: 'knowledge://data-cleaning',
      text: `Data Cleaning Patterns

Whitespace issues:
- Leading/trailing spaces: TRIM()
- Extra spaces: SUBSTITUTE(text, "  ", " ")

Type conversions:
- Text to number: VALUE() function
- Number to text: TEXT() function
- Date parsing: DATEVALUE() for text dates

Missing values:
- Identify: COUNTBLANK() to find empty cells
- Replace: IFERROR() with default values

Duplicates:
- Identify: COUNTIF() for frequency analysis
- Remove: Use UNIQUE() function`,
    },
    {
      uri: 'knowledge://analysis-workflow',
      text: `Analysis Workflow

1. Quick scan (scout): Column types, empty rates, ~200ms
2. Quality assessment (analyze_quality): Data quality score, ~1-2 seconds
3. Comprehensive analysis (comprehensive): 43 features, AI insights, ~10-30 seconds
4. Targeted deep-dive (drill_down): Focus on specific finding, ~5-10 seconds
5. Action generation: Convert findings to executable params

When to use each:
- scout: Quick understanding of any sheet
- analyze_quality: Data quality concerns
- comprehensive: Full understanding needed`,
    },
    {
      uri: 'knowledge://performance-tuning',
      text: `Performance Optimization

Formula optimization:
- Use INDEX/MATCH instead of VLOOKUP (faster)
- Cache expensive calculations in helper columns
- Use FILTER instead of nested IFs when possible

API call reduction:
- Batch reads together (parallel executor)
- Enable caching (5-minute TTL default)
- Request deduplication (50ms window)

Monitoring:
- Use analyze_performance to find slow formulas
- Track API quota usage`,
    },
    {
      uri: 'knowledge://mcp-features',
      text: `MCP Features

Sampling (AI analysis):
- Formula generation from description
- Chart recommendations
- Insight generation

Elicitation (interactive forms):
- Wizard-guided complex operations
- Confirmation dialogs

Tasks (background operations):
- Long-running exports
- BigQuery operations
- Apps Script execution

Completions:
- Spreadsheet ID autocompletion
- Range suggestion`,
    },
  ]);
}

export async function listKnowledgeResources(): Promise<
  Array<{ uri: string; contents: { mimeType: string; text: string } }>
> {
  return [
    { uri: 'knowledge://formula-library', contents: { mimeType: 'text/plain', text: '' } },
    { uri: 'knowledge://data-cleaning', contents: { mimeType: 'text/plain', text: '' } },
    { uri: 'knowledge://analysis-workflow', contents: { mimeType: 'text/plain', text: '' } },
    { uri: 'knowledge://performance-tuning', contents: { mimeType: 'text/plain', text: '' } },
    { uri: 'knowledge://mcp-features', contents: { mimeType: 'text/plain', text: '' } },
  ];
}

export function registerKnowledgeIndexResource(server: McpServer): void {
  server.registerResource(
    'Knowledge Index',
    'knowledge://index',
    { description: 'Index of all knowledge resources', mimeType: 'text/plain' },
    async (uri) => ({
      contents: [
        {
          uri: typeof uri === 'string' ? uri : uri.toString(),
          mimeType: 'text/plain',
          text: `Knowledge Resources

- knowledge://formula-library
- knowledge://data-cleaning
- knowledge://analysis-workflow
- knowledge://performance-tuning
- knowledge://mcp-features`,
        },
      ],
    })
  );
}
