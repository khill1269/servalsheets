/**
 * Action Recommender Service
 *
 * Provides intelligent suggestions for next actions based on what the user just did.
 * After a successful tool call, this service recommends what to do next based on
 * pattern matching against the tool and action that just completed.
 *
 * Used to make ServalSheets more proactive and assist the Claude LLM in
 * discovering powerful chaining patterns.
 */

import { logger } from '../utils/logger.js';

export interface SuggestedAction {
  tool: string;
  action: string;
  reason: string;
  params?: Record<string, unknown>;
}

const RECOMMENDATION_RULES: Record<string, SuggestedAction[]> = {
  // After reading data
  'sheets_data.read': [
    {
      tool: 'sheets_analyze',
      action: 'detect_patterns',
      reason: 'Analyze patterns in the data you just read',
    },
    {
      tool: 'sheets_visualize',
      action: 'suggest_chart',
      reason: 'Visualize this data with a chart',
    },
    {
      tool: 'sheets_dimensions',
      action: 'auto_resize',
      reason: 'Auto-fit column widths to content',
    },
  ],
  'sheets_data.batch_read': [
    {
      tool: 'sheets_analyze',
      action: 'detect_patterns',
      reason: 'Analyze patterns across multiple ranges',
    },
    {
      tool: 'sheets_data',
      action: 'cross_compare',
      reason: 'Compare the ranges you just read',
    },
  ],

  // After writing data
  'sheets_data.write': [
    {
      tool: 'sheets_format',
      action: 'set_format',
      reason: 'Format the cells you just wrote',
    },
    {
      tool: 'sheets_dimensions',
      action: 'freeze',
      reason: 'Freeze header row if you wrote headers',
    },
    {
      tool: 'sheets_dimensions',
      action: 'auto_resize',
      reason: 'Auto-fit columns to new content',
    },
  ],
  'sheets_data.append': [
    {
      tool: 'sheets_format',
      action: 'set_format',
      reason: 'Format the appended rows',
    },
    {
      tool: 'sheets_quality',
      action: 'validate',
      reason: 'Validate the data you just appended',
    },
  ],

  // After importing
  'sheets_composite.import_csv': [
    {
      tool: 'sheets_fix',
      action: 'clean',
      reason: 'Clean imported data (trim, normalize formats)',
    },
    {
      tool: 'sheets_fix',
      action: 'detect_anomalies',
      reason: 'Check for outliers in imported data',
    },
    {
      tool: 'sheets_format',
      action: 'apply_preset',
      reason: 'Apply professional formatting to imported data',
    },
  ],
  'sheets_composite.import_xlsx': [
    {
      tool: 'sheets_fix',
      action: 'clean',
      reason: 'Clean imported data',
    },
    {
      tool: 'sheets_analyze',
      action: 'scout',
      reason: 'Understand the imported sheet structure',
    },
  ],

  // After creating a chart
  'sheets_visualize.chart_create': [
    {
      tool: 'sheets_visualize',
      action: 'chart_update',
      reason: 'Refine chart title, colors, or legend',
    },
    {
      tool: 'sheets_format',
      action: 'set_format',
      reason: 'Format the data range behind the chart',
    },
    {
      tool: 'sheets_composite',
      action: 'export_xlsx',
      reason: 'Export spreadsheet with chart',
    },
  ],

  // After generating a sheet
  'sheets_composite.generate_sheet': [
    {
      tool: 'sheets_format',
      action: 'batch_format',
      reason: 'Add professional formatting',
    },
    {
      tool: 'sheets_format',
      action: 'add_conditional_format_rule',
      reason: 'Add conditional formatting rules',
    },
    {
      tool: 'sheets_collaborate',
      action: 'share_add',
      reason: 'Share the generated spreadsheet',
    },
  ],

  // After cleaning data
  'sheets_fix.clean': [
    {
      tool: 'sheets_fix',
      action: 'suggest_cleaning',
      reason: 'Check for additional cleaning opportunities',
    },
    {
      tool: 'sheets_fix',
      action: 'detect_anomalies',
      reason: 'Detect statistical outliers',
    },
    {
      tool: 'sheets_format',
      action: 'set_number_format',
      reason: 'Standardize number formats',
    },
  ],

  // After sharing
  'sheets_collaborate.share_add': [
    {
      tool: 'sheets_collaborate',
      action: 'comment_add',
      reason: 'Add a comment explaining the share',
    },
    {
      tool: 'sheets_collaborate',
      action: 'share_set_link',
      reason: 'Configure link sharing settings',
    },
  ],

  // After analysis
  'sheets_analyze.scout': [
    {
      tool: 'sheets_analyze',
      action: 'suggest_next_actions',
      reason: 'Get AI-powered improvement suggestions',
    },
    {
      tool: 'sheets_analyze',
      action: 'comprehensive',
      reason: 'Run deep analysis on the sheet',
    },
    {
      tool: 'sheets_analyze',
      action: 'detect_patterns',
      reason: 'Detect data patterns',
    },
  ],
  'sheets_analyze.comprehensive': [
    {
      tool: 'sheets_analyze',
      action: 'suggest_next_actions',
      reason: 'Get actionable suggestions from analysis',
    },
    {
      tool: 'sheets_analyze',
      action: 'generate_actions',
      reason: 'Generate executable improvement actions',
    },
  ],

  // After formatting
  'sheets_format.batch_format': [
    {
      tool: 'sheets_dimensions',
      action: 'auto_resize',
      reason: 'Auto-fit columns after formatting',
    },
    {
      tool: 'sheets_dimensions',
      action: 'freeze',
      reason: 'Freeze header row',
    },
  ],

  // After creating a spreadsheet
  'sheets_core.create': [
    {
      tool: 'sheets_core',
      action: 'add_sheet',
      reason: 'Add additional sheets/tabs',
    },
    {
      tool: 'sheets_data',
      action: 'write',
      reason: 'Write data to the new spreadsheet',
    },
    {
      tool: 'sheets_session',
      action: 'set_active',
      reason: 'Set as active spreadsheet for subsequent calls',
    },
  ],

  // After cross-sheet operations
  'sheets_data.cross_read': [
    {
      tool: 'sheets_data',
      action: 'cross_compare',
      reason: 'Compare data across spreadsheets',
    },
    {
      tool: 'sheets_analyze',
      action: 'detect_patterns',
      reason: 'Analyze patterns in cross-sheet data',
    },
  ],

  // After template operations
  'sheets_templates.apply': [
    {
      tool: 'sheets_data',
      action: 'write',
      reason: 'Fill template with your data',
    },
    {
      tool: 'sheets_format',
      action: 'batch_format',
      reason: 'Customize template formatting',
    },
  ],

  // After quality checks
  'sheets_quality.validate': [
    {
      tool: 'sheets_fix',
      action: 'clean',
      reason: 'Fix data quality issues found',
    },
    {
      tool: 'sheets_quality',
      action: 'detect_conflicts',
      reason: 'Detect concurrent modification conflicts',
    },
  ],

  // After sorting
  'sheets_dimensions.sort_range': [
    {
      tool: 'sheets_format',
      action: 'apply_preset',
      reason: 'Apply formatting to sorted data',
    },
    {
      tool: 'sheets_analyze',
      action: 'detect_patterns',
      reason: 'Analyze patterns in sorted data',
    },
    {
      tool: 'sheets_dimensions',
      action: 'set_basic_filter',
      reason: 'Add a filter for interactive sorting and filtering',
    },
    {
      tool: 'sheets_dimensions',
      action: 'create_filter_view',
      reason: 'Create a named filter view to save this sort configuration',
    },
  ],

  // After cross-sheet write
  'sheets_data.cross_write': [
    {
      tool: 'sheets_data',
      action: 'cross_read',
      reason: 'Verify data written to destination spreadsheet',
    },
    {
      tool: 'sheets_data',
      action: 'cross_compare',
      reason: 'Compare source and destination to confirm accuracy',
    },
  ],

  // After cross-sheet query
  'sheets_data.cross_query': [
    {
      tool: 'sheets_data',
      action: 'cross_read',
      reason: 'Fetch raw data from source spreadsheets for deeper analysis',
    },
    {
      tool: 'sheets_analyze',
      action: 'scout',
      reason: 'Explore the structure of queried spreadsheets',
    },
  ],

  // After quick insights
  'sheets_analyze.quick_insights': [
    {
      tool: 'sheets_analyze',
      action: 'comprehensive',
      reason: 'Run a full analysis to go beyond the quick structural snapshot',
    },
    {
      tool: 'sheets_fix',
      action: 'suggest_cleaning',
      reason: 'Get AI-powered cleaning recommendations for any issues found',
    },
  ],

  // After auto_enhance
  'sheets_analyze.auto_enhance': [
    {
      tool: 'sheets_analyze',
      action: 'suggest_next_actions',
      reason: 'Get further ranked suggestions after applying enhancements',
    },
    {
      tool: 'sheets_visualize',
      action: 'suggest_chart',
      reason: 'Visualize the enhanced data with a recommended chart',
    },
  ],

  // After federation remote call
  'sheets_federation.call_remote': [
    {
      tool: 'sheets_data',
      action: 'write',
      reason: 'Store remote results in the active spreadsheet',
    },
    {
      tool: 'sheets_session',
      action: 'get_context',
      reason: 'Review session context updated by the remote operation',
    },
  ],

  // After freezing rows/columns
  'sheets_dimensions.freeze': [
    {
      tool: 'sheets_format',
      action: 'apply_preset',
      reason: 'Format the header row with a professional style',
    },
    {
      tool: 'sheets_dimensions',
      action: 'auto_resize',
      reason: 'Auto-resize columns for readability',
    },
  ],

  // After adding a new sheet
  'sheets_core.add_sheet': [
    {
      tool: 'sheets_data',
      action: 'write',
      reason: 'Write column headers to the new sheet',
    },
    {
      tool: 'sheets_dimensions',
      action: 'freeze',
      reason: 'Freeze the header row on the new sheet',
    },
    {
      tool: 'sheets_core',
      action: 'update_sheet',
      reason: 'Set a tab color to organize sheets visually',
    },
  ],

  // After adding a named range
  'sheets_advanced.add_named_range': [
    {
      tool: 'sheets_analyze',
      action: 'generate_formula',
      reason: 'Use the named range in a formula via generate_formula',
    },
    {
      tool: 'sheets_advanced',
      action: 'add_protected_range',
      reason: 'Protect the named range to prevent accidental edits',
    },
  ],

  // After comparing revisions (closest to restore_cells intent)
  'sheets_history.diff_revisions': [
    {
      tool: 'sheets_data',
      action: 'read',
      reason: 'Read the current values to verify against the diff',
    },
    {
      tool: 'sheets_collaborate',
      action: 'comment_add',
      reason: 'Document the revision finding with a comment',
    },
  ],

  // After modeling a scenario
  'sheets_dependencies.model_scenario': [
    {
      tool: 'sheets_dependencies',
      action: 'create_scenario_sheet',
      reason: 'Materialize the scenario as a separate sheet for comparison',
    },
    {
      tool: 'sheets_dependencies',
      action: 'compare_scenarios',
      reason: 'Compare this scenario against another set of changes',
    },
  ],

  // After importing from BigQuery
  'sheets_bigquery.import_from_bigquery': [
    {
      tool: 'sheets_analyze',
      action: 'scout',
      reason: 'Scout the imported data structure and column types',
    },
    {
      tool: 'sheets_fix',
      action: 'clean',
      reason: 'Clean and standardize the imported data',
    },
  ],

  // After running an Apps Script
  'sheets_appsscript.run': [
    {
      tool: 'sheets_data',
      action: 'read',
      reason: 'Verify the script results by reading the affected range',
    },
    {
      tool: 'sheets_appsscript',
      action: 'update_content',
      reason:
        'If you need recurring automation, edit the script to manage ScriptApp triggers in code',
    },
  ],

  // After committing a transaction
  'sheets_transaction.commit': [
    {
      tool: 'sheets_data',
      action: 'read',
      reason: 'Verify the committed changes look correct',
    },
    {
      tool: 'sheets_history',
      action: 'undo',
      reason: 'Undo the transaction if the results are unexpected',
    },
  ],

  // After running a forecast
  'sheets_compute.forecast': [
    {
      tool: 'sheets_visualize',
      action: 'chart_create',
      reason: 'Visualize the forecast results with a chart',
    },
    {
      tool: 'sheets_composite',
      action: 'export_xlsx',
      reason: 'Export the forecast results as an Excel file',
    },
  ],

  // After detecting anomalies
  'sheets_fix.detect_anomalies': [
    {
      tool: 'sheets_fix',
      action: 'clean',
      reason: 'Clean the anomalous data identified',
    },
    {
      tool: 'sheets_format',
      action: 'add_conditional_format_rule',
      reason: 'Highlight anomalies with conditional formatting',
    },
  ],

  // After applying a format preset
  'sheets_format.apply_preset': [
    {
      tool: 'sheets_dimensions',
      action: 'freeze',
      reason: 'Freeze the header row after applying the preset',
    },
    {
      tool: 'sheets_dimensions',
      action: 'auto_resize',
      reason: 'Auto-resize columns to fit the formatted content',
    },
  ],

  // ── Newly covered actions ──────────────────────────────────────────────────

  // After history operations
  'sheets_history.timeline': [
    {
      tool: 'sheets_history',
      action: 'diff_revisions',
      reason: 'Diff two revisions from the timeline to see cell-level changes',
    },
  ],
  'sheets_history.restore_cells': [
    {
      tool: 'sheets_quality',
      action: 'validate',
      reason: 'Validate data after restoring cells from a past revision',
    },
  ],

  // After connector operations
  'sheets_connectors.query': [
    {
      tool: 'sheets_data',
      action: 'write',
      reason: 'Write connector query results into a sheet for further analysis',
    },
    {
      tool: 'sheets_visualize',
      action: 'suggest_chart',
      reason: 'Visualize the external data with a chart',
    },
  ],

  // After agent operations
  'sheets_agent.execute': [
    {
      tool: 'sheets_agent',
      action: 'observe',
      reason: 'Observe execution results — verify the plan completed correctly',
    },
  ],
  'sheets_agent.plan': [
    {
      tool: 'sheets_agent',
      action: 'execute',
      reason: 'Execute the plan that was just compiled',
    },
  ],

  // After template operations
  'sheets_templates.create': [
    {
      tool: 'sheets_templates',
      action: 'list',
      reason: 'Verify the template was saved — list all templates',
    },
  ],

  // After auth
  'sheets_auth.login': [
    {
      tool: 'sheets_session',
      action: 'set_active',
      reason: 'Set the target spreadsheet to work with',
    },
    {
      tool: 'sheets_core',
      action: 'list',
      reason: 'List accessible spreadsheets after authentication',
    },
  ],

  // After webhook operations
  'sheets_webhook.watch_changes': [
    {
      tool: 'sheets_webhook',
      action: 'get_stats',
      reason: 'Check webhook delivery stats to confirm it is active',
    },
  ],

  // After compute operations
  'sheets_compute.aggregate': [
    {
      tool: 'sheets_data',
      action: 'write',
      reason: 'Write aggregated results into a summary range',
    },
    {
      tool: 'sheets_visualize',
      action: 'chart_create',
      reason: 'Create a chart from the computed aggregations',
    },
  ],

  // After session context operations
  'sheets_session.set_active': [
    {
      tool: 'sheets_analyze',
      action: 'scout',
      reason: 'Scout the active spreadsheet to understand its structure',
    },
  ],

  // After share operations
  'sheets_collaborate.comment_add': [
    {
      tool: 'sheets_collaborate',
      action: 'comment_list',
      reason: 'Review all comments on the spreadsheet',
    },
  ],

  // After data clear/delete
  'sheets_data.clear': [
    {
      tool: 'sheets_data',
      action: 'read',
      reason: 'Verify the range was cleared successfully',
    },
  ],
};

/**
 * Get recommended next actions based on a tool and action that just completed.
 *
 * @param toolName - The tool that just executed (e.g., 'sheets_data')
 * @param action - The action that just executed (e.g., 'read')
 * @returns Array of SuggestedAction objects (0-3 items), ordered by relevance
 */
export function getRecommendedActions(toolName: string, action: string): SuggestedAction[] {
  const key = `${toolName}.${action}`;
  return RECOMMENDATION_RULES[key] || [];
}

// Date-like detection helpers (mirrors lightweight-quality-scanner logic without import)
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const MDY_DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;

function isDateLikeValue(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  return ISO_DATE_RE.test(v) || MDY_DATE_RE.test(v);
}

function isNumericValue(v: unknown): boolean {
  if (typeof v === 'number') return true;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return true;
  return false;
}

type CellValue = string | number | boolean | null;

/**
 * Get recent session operations for dedup (non-critical — returns empty on failure).
 * Avoids suggesting actions the user already performed in the last N minutes.
 */
function getRecentSessionActions(windowMinutes: number = 10): Set<string> {
  const recent = new Set<string>();
  try {
    // Dynamic import to avoid circular dependency — session-context is optional
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSessionContext } = require('./session-context.js') as {
      getSessionContext: () => { getOperationHistory: (limit: number) => Array<{ tool: string; action: string; timestamp: number }> };
    };
    const ctx = getSessionContext();
    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    const ops = ctx.getOperationHistory(20);
    for (const op of ops) {
      if (op.timestamp >= cutoff) {
        recent.add(`${op.tool}.${op.action}`);
      }
    }
  } catch {
    // Session context not initialized — no dedup (non-critical)
  }
  return recent;
}

/**
 * Build data-signal suggestions from actual response values.
 * Returns deduplicated suggestions ordered by relevance (data signals first).
 * Session-aware: filters out actions the user already performed in the last 10 minutes.
 */
export function getDataAwareSuggestions(
  toolName: string,
  action: string,
  _result: Record<string, unknown>,
  options?: {
    responseValues?: CellValue[][];
    confidenceGaps?: Array<{ question: string; options?: string[] }>;
    spreadsheetId?: string;
    range?: string;
  }
): SuggestedAction[] {
  const dataSuggestions: SuggestedAction[] = [];
  const seenKeys = new Set<string>();

  // Session-aware dedup: skip suggesting actions the user already ran recently
  const recentActions = getRecentSessionActions();

  function addIfNew(suggestion: SuggestedAction): void {
    const key = `${suggestion.tool}.${suggestion.action}`;
    if (seenKeys.has(key)) return;
    // Don't suggest actions the user already performed in this session window
    if (recentActions.has(key)) {
      logger.debug('Skipping suggestion — already performed in session', { key });
      return;
    }
    seenKeys.add(key);
    dataSuggestions.push(suggestion);
  }

  // ── Signal 1: Response data signals ────────────────────────────────────────
  if (options?.responseValues && options.responseValues.length >= 2) {
    const values = options.responseValues;
    const numCols = Math.max(...values.map((r) => r.length));

    // Analyse columns (skip header row at index 0)
    let hasDateCol = false;
    let hasNumericCol = false;
    let hasVlookup = false;
    let dateColUnsorted = false;
    let totalCells = 0;
    let nullCells = 0;

    for (let c = 0; c < numCols; c++) {
      const dataRows = values.slice(1, 11); // spot-check first 10 rows max

      let colDates: string[] = [];
      let colNums = 0;
      let colStrings = 0;

      for (const row of dataRows) {
        const cell = row[c];
        if (cell === null || cell === undefined || cell === '') {
          nullCells++;
          totalCells++;
          continue;
        }
        totalCells++;

        if (typeof cell === 'string') {
          if (cell.includes('VLOOKUP')) hasVlookup = true;
          if (isDateLikeValue(cell)) {
            hasDateCol = true;
            colDates.push(cell);
          } else {
            colStrings++;
          }
        } else if (isNumericValue(cell)) {
          hasNumericCol = true;
          colNums++;
        }
        void colStrings;
        void colNums;
      }

      // Check if date column is unsorted (spot-check first 10 values)
      if (colDates.length >= 3) {
        const sorted = [...colDates].sort();
        if (sorted.join() !== colDates.join()) {
          dateColUnsorted = true;
        }
      }
    }

    const nullRatio = totalCells > 0 ? nullCells / totalCells : 0;

    // Build context params from available options for pre-filled suggestions
    const ctxParams: Record<string, unknown> = {};
    if (options?.spreadsheetId) ctxParams['spreadsheetId'] = options.spreadsheetId;
    if (options?.range) ctxParams['range'] = options.range;

    // Has date + numeric → chart suggestion
    if (hasDateCol && hasNumericCol) {
      addIfNew({
        tool: 'sheets_visualize',
        action: 'suggest_chart',
        reason: 'Data has date and numeric columns — a line chart would visualize trends',
        ...(options?.spreadsheetId ? { params: { ...ctxParams } } : {}),
      });
    }

    // Contains VLOOKUP → suggest XLOOKUP upgrade
    if (hasVlookup) {
      addIfNew({
        tool: 'sheets_analyze',
        action: 'analyze_formulas',
        reason: 'VLOOKUP detected — consider upgrading to XLOOKUP for better performance',
        ...(options?.spreadsheetId ? { params: { ...ctxParams, checkErrors: true } } : {}),
      });
    }

    // Dates out of order
    if (dateColUnsorted) {
      addIfNew({
        tool: 'sheets_dimensions',
        action: 'sort_range',
        reason: 'Date column values are not in chronological order',
        ...(options?.range ? { params: { ...ctxParams } } : {}),
      });
    }

    // High null rate
    if (nullRatio > 0.1) {
      addIfNew({
        tool: 'sheets_fix',
        action: 'fill_missing',
        reason: `${Math.round(nullRatio * 100)}% of cells are empty — fill missing values`,
        ...(options?.spreadsheetId ? { params: { ...ctxParams, mode: 'preview' } } : {}),
      });
    }

    // ── Additional data-aware patterns ──────────────────────────────────────

    // Duplicate row detection: check if any rows repeat (spot-check first 50 data rows)
    const dataRows = values.slice(1, 51);
    const rowStrings = dataRows.map((r) => r.join('\t'));
    const uniqueRows = new Set(rowStrings);
    if (uniqueRows.size < rowStrings.length * 0.9 && rowStrings.length >= 5) {
      const dupCount = rowStrings.length - uniqueRows.size;
      addIfNew({
        tool: 'sheets_fix',
        action: 'clean',
        reason: `~${dupCount} duplicate row${dupCount !== 1 ? 's' : ''} detected — deduplicate to clean the dataset`,
        ...(options?.spreadsheetId ? { params: { ...ctxParams, rules: ['remove_duplicates'] } } : {}),
      });
    }

    // Formula error detection (#REF!, #N/A, #VALUE!, #DIV/0!, #NAME?, #NULL!)
    let errorCells = 0;
    const errorRe = /^#(REF!|N\/A|VALUE!|DIV\/0!|NAME\?|NULL!|ERROR!)/;
    for (const row of dataRows) {
      for (const cell of row) {
        if (typeof cell === 'string' && errorRe.test(cell)) {
          errorCells++;
        }
      }
    }
    if (errorCells > 0) {
      addIfNew({
        tool: 'sheets_analyze',
        action: 'analyze_formulas',
        reason: `${errorCells} formula error${errorCells !== 1 ? 's' : ''} found (${errorCells > 5 ? 'many' : 'a few'} #REF!, #N/A, etc.) — audit formulas`,
        ...(options?.spreadsheetId ? { params: { ...ctxParams, checkErrors: true } } : {}),
      });
    }

    // Large dataset hint: suggest batch operations or compute for datasets > 500 rows
    if (values.length > 500 && hasNumericCol) {
      addIfNew({
        tool: 'sheets_compute',
        action: 'aggregate',
        reason: `Large dataset (${values.length} rows) — use server-side aggregation for faster SUM/AVG/COUNT`,
        ...(options?.spreadsheetId ? { params: { ...ctxParams } } : {}),
      });
    }

    // Mixed types in a single column → suggest standardize_formats
    for (let c = 0; c < numCols && c < 20; c++) {
      let colTypeCount = { num: 0, str: 0, bool: 0 };
      for (const row of dataRows.slice(0, 10)) {
        const cell = row[c];
        if (cell === null || cell === undefined || cell === '') continue;
        if (typeof cell === 'number') colTypeCount.num++;
        else if (typeof cell === 'boolean') colTypeCount.bool++;
        else if (typeof cell === 'string' && !isDateLikeValue(cell)) colTypeCount.str++;
      }
      const nonZeroCounts = [colTypeCount.num, colTypeCount.str, colTypeCount.bool].filter(
        (v) => v > 0
      );
      if (nonZeroCounts.length >= 2 && colTypeCount.num > 0 && colTypeCount.str > 0) {
        addIfNew({
          tool: 'sheets_fix',
          action: 'standardize_formats',
          reason: 'Column has mixed types (numbers stored as text) — standardize for consistent data',
          ...(options?.spreadsheetId ? { params: { ...ctxParams } } : {}),
        });
        break; // One suggestion is enough
      }
    }
  }

  // ── Signal 2: Confidence gaps ───────────────────────────────────────────────
  if (options?.confidenceGaps && options.confidenceGaps.length > 0) {
    const gapKeywords: Array<[string, SuggestedAction]> = [
      ['formula', { tool: 'sheets_analyze', action: 'analyze_formulas', reason: '' }],
      ['column type', { tool: 'sheets_analyze', action: 'analyze_data', reason: '' }],
      ['chart', { tool: 'sheets_visualize', action: 'suggest_chart', reason: '' }],
      ['format', { tool: 'sheets_format', action: 'suggest_format', reason: '' }],
      ['duplicate', { tool: 'sheets_fix', action: 'clean', reason: '' }],
    ];

    let gapsAdded = 0;
    for (const gap of options.confidenceGaps.slice(0, 3)) {
      if (gapsAdded >= 3) break;
      const lowerQ = gap.question.toLowerCase();

      let matched = false;
      for (const [keyword, template] of gapKeywords) {
        if (lowerQ.includes(keyword)) {
          addIfNew({
            ...template,
            reason: gap.question,
          });
          gapsAdded++;
          matched = true;
          break;
        }
      }

      // Fallback: map to analyze_data if no keyword matched
      if (!matched) {
        addIfNew({
          tool: 'sheets_analyze',
          action: 'analyze_data',
          reason: gap.question,
        });
        gapsAdded++;
      }
    }
  }

  // ── Signal 3: Workflow chain (multi-step pattern) ───────────────────────────
  const chainStep = getWorkflowChainSuggestion(toolName, action, {
    spreadsheetId: options?.spreadsheetId,
    range: options?.range,
  });
  if (chainStep) {
    addIfNew(chainStep);
  }

  // ── Base: static rules (appended after data signals, deduplicated) ──────────
  const staticRules = getRecommendedActions(toolName, action);
  for (const rule of staticRules) {
    addIfNew(rule);
  }

  // ── Inject executable params from session context ──────────────────────────
  if (options?.spreadsheetId) {
    const sid = options.spreadsheetId;
    const rng = options.range;
    for (const suggestion of dataSuggestions) {
      if (!suggestion.params) {
        const p: Record<string, unknown> = { spreadsheetId: sid };
        // Carry range for actions that operate on ranges
        if (rng && RANGE_CARRYING_ACTIONS.has(`${suggestion.tool}.${suggestion.action}`)) {
          p['range'] = rng;
        }
        suggestion.params = p;
      }
    }
  }

  return dataSuggestions;
}

// ── Error → Recovery Rules ──────────────────────────────────────────────────
// These map error codes to recovery actions, enabling self-healing behavior.
// Called by tool-response.ts when an error occurs, so the LLM gets an
// actionable suggestion instead of just retrying blindly.

const ERROR_RECOVERY_RULES: Record<string, SuggestedAction[]> = {
  SHEET_NOT_FOUND: [
    {
      tool: 'sheets_core',
      action: 'list_sheets',
      reason: 'Sheet name not found — list available sheets (names may contain emoji or trailing spaces)',
    },
  ],
  SPREADSHEET_NOT_FOUND: [
    {
      tool: 'sheets_core',
      action: 'list',
      reason: 'Spreadsheet ID not found — list accessible spreadsheets to find the correct ID',
    },
  ],
  INVALID_RANGE: [
    {
      tool: 'sheets_analyze',
      action: 'scout',
      reason: 'Range is invalid — scout the sheet to discover actual dimensions and sheet names',
    },
  ],
  QUOTA_EXCEEDED: [
    {
      tool: 'sheets_transaction',
      action: 'begin',
      reason: 'Quota exceeded — batch remaining operations into a transaction (80-95% fewer API calls)',
    },
  ],
  UNAUTHENTICATED: [
    {
      tool: 'sheets_auth',
      action: 'status',
      reason: 'Authentication expired — check auth status and re-login if needed',
    },
  ],
  AUTH_EXPIRED: [
    {
      tool: 'sheets_auth',
      action: 'login',
      reason: 'Credentials expired — initiate re-authentication flow',
    },
  ],
  PERMISSION_DENIED: [
    {
      tool: 'sheets_collaborate',
      action: 'share_list',
      reason: 'Permission denied — check current sharing permissions on the spreadsheet',
    },
  ],
  CONFLICT: [
    {
      tool: 'sheets_quality',
      action: 'detect_conflicts',
      reason: 'Concurrent modification detected — check for conflicting edits before retrying',
    },
  ],
  TIMEOUT: [
    {
      tool: 'sheets_data',
      action: 'batch_read',
      reason: 'Request timed out — break the range into smaller chunks using batch_read with pagination',
    },
  ],
};

/**
 * Get recovery actions for a specific error code.
 *
 * @param errorCode - The error code from a failed tool call
 * @param context - Optional spreadsheetId/range to pre-fill params
 * @returns Array of SuggestedAction objects with recovery guidance
 */
export function getErrorRecoveryActions(
  errorCode: string,
  context?: { spreadsheetId?: string; range?: string }
): SuggestedAction[] {
  const rules = ERROR_RECOVERY_RULES[errorCode];
  if (!rules) return [];

  // Pre-fill context params when available
  if (context?.spreadsheetId) {
    return rules.map((rule) => ({
      ...rule,
      params: {
        spreadsheetId: context.spreadsheetId,
        ...(context.range &&
          RANGE_CARRYING_ACTIONS.has(`${rule.tool}.${rule.action}`) && {
            range: context.range,
          }),
      },
    }));
  }

  return rules;
}

// ── Cross-Tool Chaining Rules ──────────────────────────────────────────────
// Multi-step workflow patterns that chain 3+ tools together.
// These are appended to data-aware suggestions when the completed action
// is the START of a known workflow pattern.

interface WorkflowChain {
  /** When this tool.action completes */
  trigger: string;
  /** Description of the workflow */
  workflow: string;
  /** Ordered next steps (first = immediate next action) */
  steps: SuggestedAction[];
}

const WORKFLOW_CHAINS: WorkflowChain[] = [
  {
    trigger: 'sheets_composite.import_csv',
    workflow: 'Import → Clean → Format → Share',
    steps: [
      { tool: 'sheets_fix', action: 'clean', reason: 'Step 1/3: Clean imported data (trim, normalize types)' },
      { tool: 'sheets_format', action: 'apply_preset', reason: 'Step 2/3: Apply professional formatting' },
      { tool: 'sheets_collaborate', action: 'share_add', reason: 'Step 3/3: Share the polished spreadsheet' },
    ],
  },
  {
    trigger: 'sheets_composite.import_xlsx',
    workflow: 'Import → Clean → Format → Share',
    steps: [
      { tool: 'sheets_fix', action: 'clean', reason: 'Step 1/3: Clean imported data' },
      { tool: 'sheets_format', action: 'apply_preset', reason: 'Step 2/3: Apply professional formatting' },
      { tool: 'sheets_collaborate', action: 'share_add', reason: 'Step 3/3: Share the polished spreadsheet' },
    ],
  },
  {
    trigger: 'sheets_core.create',
    workflow: 'Create → Structure → Populate → Format',
    steps: [
      { tool: 'sheets_data', action: 'write', reason: 'Step 1/3: Write headers and initial data' },
      { tool: 'sheets_dimensions', action: 'freeze', reason: 'Step 2/3: Freeze header row' },
      { tool: 'sheets_format', action: 'batch_format', reason: 'Step 3/3: Apply formatting in one batch call' },
    ],
  },
  {
    trigger: 'sheets_analyze.scout',
    workflow: 'Scout → Analyze → Fix → Visualize',
    steps: [
      { tool: 'sheets_analyze', action: 'comprehensive', reason: 'Step 1/3: Deep analysis of patterns and issues' },
      { tool: 'sheets_fix', action: 'clean', reason: 'Step 2/3: Fix any data quality issues found' },
      { tool: 'sheets_visualize', action: 'suggest_chart', reason: 'Step 3/3: Visualize key insights' },
    ],
  },
  {
    trigger: 'sheets_data.read',
    workflow: 'Read → Compute → Write Results',
    steps: [
      { tool: 'sheets_compute', action: 'aggregate', reason: 'Step 1/2: Compute aggregations (SUM, AVG, etc.) server-side' },
      { tool: 'sheets_data', action: 'write', reason: 'Step 2/2: Write computed results back to the sheet' },
    ],
  },
  {
    trigger: 'sheets_fix.clean',
    workflow: 'Clean → Validate → Format → Protect',
    steps: [
      { tool: 'sheets_quality', action: 'validate', reason: 'Step 1/3: Validate cleaned data passes all rules' },
      { tool: 'sheets_format', action: 'batch_format', reason: 'Step 2/3: Apply consistent formatting' },
      { tool: 'sheets_advanced', action: 'add_protected_range', reason: 'Step 3/3: Protect clean data from accidental edits' },
    ],
  },
  {
    trigger: 'sheets_bigquery.query',
    workflow: 'Query → Import → Visualize',
    steps: [
      { tool: 'sheets_bigquery', action: 'import_from_bigquery', reason: 'Step 1/2: Import query results into a sheet' },
      { tool: 'sheets_visualize', action: 'chart_create', reason: 'Step 2/2: Create a chart from the imported data' },
    ],
  },
  {
    trigger: 'sheets_dependencies.model_scenario',
    workflow: 'Model → Compare → Materialize',
    steps: [
      { tool: 'sheets_dependencies', action: 'compare_scenarios', reason: 'Step 1/2: Compare multiple what-if scenarios side by side' },
      { tool: 'sheets_dependencies', action: 'create_scenario_sheet', reason: 'Step 2/2: Materialize the best scenario as a new sheet' },
    ],
  },
  // ── Newly covered tool chains ──────────────────────────────────────────────
  {
    trigger: 'sheets_history.timeline',
    workflow: 'Timeline → Diff → Restore',
    steps: [
      { tool: 'sheets_history', action: 'diff_revisions', reason: 'Step 1/2: Compare two revisions to find what changed' },
      { tool: 'sheets_history', action: 'restore_cells', reason: 'Step 2/2: Surgically restore specific cells from a past revision' },
    ],
  },
  {
    trigger: 'sheets_templates.apply',
    workflow: 'Apply Template → Populate → Format',
    steps: [
      { tool: 'sheets_data', action: 'write', reason: 'Step 1/2: Populate the template with actual data' },
      { tool: 'sheets_format', action: 'batch_format', reason: 'Step 2/2: Customize formatting for the populated template' },
    ],
  },
  {
    trigger: 'sheets_connectors.discover',
    workflow: 'Discover → Configure → Query',
    steps: [
      { tool: 'sheets_connectors', action: 'configure', reason: 'Step 1/2: Configure the discovered connector with credentials' },
      { tool: 'sheets_connectors', action: 'query', reason: 'Step 2/2: Query external data via the configured connector' },
    ],
  },
  {
    trigger: 'sheets_agent.execute',
    workflow: 'Execute → Observe → Adjust',
    steps: [
      { tool: 'sheets_agent', action: 'observe', reason: 'Step 1/2: Observe execution results and verify correctness' },
      { tool: 'sheets_agent', action: 'rollback', reason: 'Step 2/2: Roll back if results are incorrect (checkpoint-based)' },
    ],
  },
  {
    trigger: 'sheets_quality.validate',
    workflow: 'Validate → Fix → Re-validate',
    steps: [
      { tool: 'sheets_fix', action: 'clean', reason: 'Step 1/2: Auto-fix validation issues found' },
      { tool: 'sheets_quality', action: 'validate', reason: 'Step 2/2: Re-validate to confirm all issues are resolved' },
    ],
  },
];

/**
 * Get workflow chain suggestions when the completed action is the start of a known pattern.
 * Returns only the FIRST step of the chain (the immediate next action) plus a workflow label.
 */
export function getWorkflowChainSuggestion(
  toolName: string,
  action: string,
  context?: { spreadsheetId?: string; range?: string }
): SuggestedAction | null {
  const key = `${toolName}.${action}`;
  const chain = WORKFLOW_CHAINS.find((c) => c.trigger === key);
  if (!chain || chain.steps.length === 0) return null;

  const firstStep = { ...chain.steps[0]! };
  firstStep.reason = `[${chain.workflow}] ${firstStep.reason}`;

  // Pre-fill params
  if (context?.spreadsheetId) {
    firstStep.params = {
      spreadsheetId: context.spreadsheetId,
      ...(context.range &&
        RANGE_CARRYING_ACTIONS.has(`${firstStep.tool}.${firstStep.action}`) && {
          range: context.range,
        }),
    };
  }

  return firstStep;
}

/** Actions that benefit from receiving the source range in params */
const RANGE_CARRYING_ACTIONS = new Set([
  'sheets_analyze.detect_patterns',
  'sheets_analyze.analyze_data',
  'sheets_analyze.quick_insights',
  'sheets_analyze.analyze_formulas',
  'sheets_visualize.suggest_chart',
  'sheets_fix.suggest_cleaning',
  'sheets_fix.clean',
  'sheets_fix.fill_missing',
  'sheets_fix.standardize_formats',
  'sheets_fix.detect_anomalies',
  'sheets_dimensions.auto_resize',
  'sheets_dimensions.sort_range',
  'sheets_data.cross_read',
  'sheets_data.read',
  'sheets_data.write',
  'sheets_compute.evaluate',
  'sheets_compute.aggregate',
  'sheets_quality.validate',
]);
