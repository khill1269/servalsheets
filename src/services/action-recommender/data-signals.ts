/**
 * Action Recommender — Data Signal Analysis
 *
 * Core logic for detecting data patterns, analyzing response values,
 * and suggesting contextual actions based on actual spreadsheet content.
 */

import { logger } from '../../utils/logger.js';
import {
  type SuggestedAction,
  RECOMMENDATION_RULES,
  RANGE_CARRYING_ACTIONS,
  WORKFLOW_CHAINS,
} from './recommendation-rules.js';

type CellValue = string | number | boolean | null;

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

/**
 * Get recent session operations for dedup (non-critical — returns empty on failure).
 * Avoids suggesting actions the user already performed in the last N minutes.
 */
function getRecentSessionActions(windowMinutes: number = 10): Set<string> {
  const recent = new Set<string>();
  try {
    // Dynamic import to avoid circular dependency — session-context is optional
    const { getSessionContext } = require('../../services/session-context.js') as {
      getSessionContext: () => {
        getOperationHistory: (
          limit: number
        ) => Array<{ tool: string; action: string; timestamp: number }>;
      };
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
 * Helper: Get recommended actions for a specific tool.action pair.
 * Inlined to avoid circular dependency.
 */
function getRecommendedActionsInline(toolName: string, action: string): SuggestedAction[] {
  const key = `${toolName}.${action}`;
  return RECOMMENDATION_RULES[key] || [];
}

/**
 * Helper: Get workflow chain suggestion.
 * Inlined to avoid circular dependency.
 */
function getWorkflowChainSuggestionInline(
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
        ...(options?.spreadsheetId
          ? { params: { ...ctxParams, rules: ['remove_duplicates'] } }
          : {}),
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
          reason:
            'Column has mixed types (numbers stored as text) — standardize for consistent data',
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
  const chainStep = getWorkflowChainSuggestionInline(toolName, action, {
    spreadsheetId: options?.spreadsheetId,
    range: options?.range,
  });
  if (chainStep) {
    addIfNew(chainStep);
  }

  // ── Base: static rules (appended after data signals, deduplicated) ──────────
  const staticRules = getRecommendedActionsInline(toolName, action);
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
