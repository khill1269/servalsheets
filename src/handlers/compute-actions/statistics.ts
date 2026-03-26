/**
 * Statistics & Aggregate Action Handlers
 *
 * Actions: evaluate, aggregate, statistical
 */

import { ErrorCodes } from '../error-codes.js';
import { extractRangeA1 } from '../../utils/range-helpers.js';
import { generateAIInsight } from '../../mcp/sampling.js';
import {
  fetchRangeData,
  aggregate,
  computeStatistics,
} from '../../services/compute-engine.js';
import type { SheetsComputeInput, SheetsComputeOutput } from '../../schemas/compute.js';
import type { ComputeHandlerAccess } from './internal.js';
import { resolveComputeInputData } from './header-resolution.js';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Compute moving window results (average, median, sum).
 */
export function computeMovingWindowResult(
  data: number[],
  windowSize: number,
  operation: 'average' | 'median' | 'sum'
): number[] {
  const result: number[] = [];
  const size = Math.max(1, Math.min(windowSize, data.length));

  for (let i = 0; i <= data.length - size; i++) {
    const window = data.slice(i, i + size);
    switch (operation) {
      case 'average':
        result.push(window.reduce((a, b) => a + b, 0) / window.length);
        break;
      case 'median': {
        const sorted = [...window].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        result.push(sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2);
        break;
      }
      case 'sum':
        result.push(window.reduce((a, b) => a + b, 0));
        break;
    }
  }
  return result;
}

/**
 * Simple expression evaluator for basic arithmetic and spreadsheet functions.
 */
export function evaluateExpression(expr: string): number | string {
  // Handle IF function (ternary: IF(condition, true_value, false_value))
  // Need to parse carefully to handle nested parentheses in arguments
  const ifStart = /\bIF\s*\(/i.exec(expr);
  if (ifStart) {
    const startIndex = ifStart.index + ifStart[0].length - 1; // Position of opening paren
    let depth = 0;
    let commaPositions: number[] = [];
    let i = startIndex;

    // Find matching closing paren and comma positions at depth 1
    for (i = startIndex; i < expr.length; i++) {
      if (expr[i] === '(') depth++;
      else if (expr[i] === ')') {
        depth--;
        if (depth === 0) break;
      } else if (expr[i] === ',' && depth === 1) {
        commaPositions.push(i);
      }
    }

    const endIndex = i;
    if (commaPositions.length === 2 && depth === 0) {
      // Found IF with 3 arguments
      const condition = expr.substring(startIndex + 1, commaPositions[0]!).trim();
      const trueVal = expr.substring(commaPositions[0]! + 1, commaPositions[1]!).trim();
      const falseVal = expr.substring(commaPositions[1]! + 1, endIndex).trim();

      try {
        // Evaluate condition
        const condSanitized = condition.replace(/[^0-9+\-*/().<%>=!&|\s]/g, '');
        const condFn = new Function(`"use strict"; return (${condSanitized})`);
        const condResult = condFn();
        // Return appropriate branch
        const resultExpr = condResult ? trueVal : falseVal;
        return evaluateExpression(resultExpr);
      } catch {
        // Fallback if condition evaluation fails
        return `Cannot evaluate: ${expr}`;
      }
    }
  }

  // Handle common spreadsheet functions
  const funcPattern =
    /\b(SUM|AVERAGE|COUNT|MIN|MAX|ABS|ROUND|SQRT|POW|LOG|LN|EXP|MOD|CEIL|FLOOR)\s*\(([^)]*)\)/gi;
  let processed = expr;

  let match;
  while ((match = funcPattern.exec(processed)) !== null) {
    const fnName = match[1]!.toUpperCase();
    const argsStr = match[2]!;
    const args = argsStr.split(',').map((a) => {
      const trimmed = a.trim();
      const num = parseFloat(trimmed);
      return isNaN(num) ? 0 : num;
    });

    let result: number;
    switch (fnName) {
      case 'SUM':
        result = args.reduce((a, b) => a + b, 0);
        break;
      case 'AVERAGE':
        result = args.length > 0 ? args.reduce((a, b) => a + b, 0) / args.length : 0;
        break;
      case 'COUNT':
        result = args.length;
        break;
      case 'MIN':
        result = Math.min(...args);
        break;
      case 'MAX':
        result = Math.max(...args);
        break;
      case 'ABS':
        result = Math.abs(args[0] || 0);
        break;
      case 'ROUND':
        result =
          Math.round((args[0] || 0) * Math.pow(10, args[1] || 0)) / Math.pow(10, args[1] || 0);
        break;
      case 'SQRT':
        result = Math.sqrt(args[0] || 0);
        break;
      case 'POW':
        result = Math.pow(args[0] || 0, args[1] || 0);
        break;
      case 'LOG':
        result = Math.log10(args[0] || 1);
        break;
      case 'LN':
        result = Math.log(args[0] || 1);
        break;
      case 'EXP':
        result = Math.exp(args[0] || 0);
        break;
      case 'MOD':
        result = (args[0] || 0) % (args[1] || 1);
        break;
      case 'CEIL':
      case 'CEILING':
        result = Math.ceil(args[0] || 0);
        break;
      case 'FLOOR':
        result = Math.floor(args[0] || 0);
        break;
      default:
        result = 0;
    }

    processed =
      processed.slice(0, match.index) +
      String(result) +
      processed.slice(match.index! + match[0].length);
    funcPattern.lastIndex = 0; // Reset for nested functions
  }

  // Evaluate remaining arithmetic
  try {
    // Sanitize: only allow numbers, operators, parentheses, spaces, dots
    const sanitized = processed.replace(/[^0-9+\-*/().%\s]/g, '');
    if (sanitized.trim() === '') return 0;
    // Use Function constructor for safe arithmetic evaluation
    const fn = new Function(`"use strict"; return (${sanitized})`);
    const result = fn();
    return typeof result === 'number' && isFinite(result) ? result : 0;
  } catch {
    return `Cannot evaluate: ${expr}`;
  }
}

// ============================================================================
// Action Handlers
// ============================================================================

export async function handleEvaluate(
  access: ComputeHandlerAccess,
  req: SheetsComputeInput['request'] & { action: 'evaluate' }
): Promise<SheetsComputeOutput> {
  const startMs = Date.now();

  // For now, resolve cell references if a range is provided
  let resolvedCells: Record<string, unknown> | undefined;
  if (req.range) {
    const data = await fetchRangeData(access.sheetsApi, req.spreadsheetId, extractRangeA1(req.range));
    resolvedCells = {};
    for (let r = 0; r < data.length; r++) {
      for (let c = 0; c < (data[r]?.length || 0); c++) {
        const colLetter = String.fromCharCode(65 + c);
        resolvedCells[`${colLetter}${r + 1}`] = data[r]![c];
      }
    }
  }

  // Simple expression evaluation for basic arithmetic
  let result: unknown;
  try {
    const cleaned = req.formula.startsWith('=') ? req.formula.slice(1) : req.formula;
    // Replace cell refs with resolved values
    let expression = cleaned;
    if (resolvedCells) {
      for (const [ref, val] of Object.entries(resolvedCells)) {
        expression = expression.replace(new RegExp(`\\b${ref}\\b`, 'gi'), String(val ?? 0));
      }
    }
    // Evaluate basic SUM, AVERAGE, etc.
    result = evaluateExpression(expression);
  } catch (e) {
    const message = `Evaluation error: ${e instanceof Error ? e.message : String(e)}`;
    return {
      response: {
        success: false as const,
        error: {
          code: ErrorCodes.OPERATION_FAILED,
          message,
          retryable: false,
        },
      },
    };
  }

  // evaluateExpression returns a string on failure (e.g. "Cannot evaluate: ...")
  if (typeof result === 'string' && result.startsWith('Cannot evaluate:')) {
    return {
      response: {
        success: false as const,
        error: {
          code: ErrorCodes.OPERATION_FAILED,
          message: result,
          retryable: false,
        },
      },
    };
  }

  return {
    response: {
      success: true,
      action: 'evaluate',
      result,
      formula: req.formula,
      resolvedCells,
      computationTimeMs: Date.now() - startMs,
    },
  };
}

export async function handleAggregate(
  access: ComputeHandlerAccess,
  req: SheetsComputeInput['request'] & { action: 'aggregate' }
): Promise<SheetsComputeOutput> {
  const startMs = Date.now();
  const data = await fetchRangeData(access.sheetsApi, req.spreadsheetId, extractRangeA1(req.range));

  // Check for moving window mode
  const mwMode = req.type;
  if (mwMode === 'moving_average' || mwMode === 'moving_median' || mwMode === 'moving_sum') {
    if (!data || data.length === 0) {
      return {
        response: {
          success: false,
          error: {
            code: ErrorCodes.INVALID_PARAMS,
            message: 'No data found in the specified range',
            retryable: false,
          },
        },
      };
    }

    const headers = (data[0] || []).map(String);
    const valueCol = req.valueColumn || headers[0];
    const colIdx = headers.findIndex(
      (h) => h?.toString().toLowerCase() === valueCol?.toLowerCase()
    );

    if (colIdx < 0) {
      return {
        response: {
          success: false,
          error: {
            code: ErrorCodes.INVALID_PARAMS,
            message: `Column "${valueCol}" not found`,
            retryable: false,
          },
        },
      };
    }

    // Extract numeric values from the column
    const values: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const val = data[i]?.[colIdx];
      if (val !== null && val !== undefined && val !== '' && typeof val === 'number') {
        values.push(val);
      } else if (typeof val === 'string') {
        const parsed = parseFloat(val);
        if (!isNaN(parsed)) values.push(parsed);
      }
    }

    const windowSize = Math.max(1, req.windowSize ?? 3);
    const operation = mwMode.replace('moving_', '') as 'average' | 'median' | 'sum';

    // Compute moving window
    const movingResult = computeMovingWindowResult(values, windowSize, operation);

    return {
      response: {
        success: true,
        action: 'aggregate',
        movingWindow: {
          type: mwMode,
          windowSize,
          values: movingResult,
          originalCount: values.length,
          resultCount: movingResult.length,
        },
        computationTimeMs: Date.now() - startMs,
      },
    };
  }

  // Standard aggregation mode
  const result = aggregate(data, {
    functions: req.functions,
    groupBy: req.groupBy,
  });

  return {
    response: {
      success: true,
      action: 'aggregate',
      aggregations: result.aggregations,
      groups: result.groups,
      rowCount: result.rowCount,
      computationTimeMs: Date.now() - startMs,
    },
  };
}

export async function handleStatistical(
  access: ComputeHandlerAccess,
  req: SheetsComputeInput['request'] & { action: 'statistical' }
): Promise<SheetsComputeOutput> {
  const startMs = Date.now();
  const resolvedData = await resolveComputeInputData(access.sheetsApi, req.spreadsheetId, req.range, {
    hasHeaders: req.hasHeaders,
    headerRow: req.headerRow,
  });
  if (!resolvedData.ok) {
    return {
      response: {
        success: false,
        error: resolvedData.error,
      },
    };
  }
  const data = resolvedData.data;

  // Build moving window config if provided in request
  let movingWindowConfig:
    | { windowSize: number; operation: 'average' | 'median' | 'sum'; column: string }
    | undefined;
  if (req.movingWindow) {
    const mwConfig = req.movingWindow;
    if (mwConfig && typeof mwConfig === 'object') {
      const windowSize = mwConfig.windowSize ?? 3;
      const operation = mwConfig.operation ?? 'average';
      movingWindowConfig = {
        windowSize: Number.isFinite(windowSize) ? Math.max(1, windowSize) : 3,
        operation,
        column: mwConfig.column,
      };
    }
  }

  const result = computeStatistics(data, {
    columns: req.columns,
    // BUG-12 fix: Default percentiles when missing (e.g., via batch_compute forwarding)
    percentiles: req.percentiles ?? [25, 50, 75],
    includeCorrelations: req.includeCorrelations,
    movingWindowConfig,
  });

  // Generate AI insight interpreting statistical results
  let aiInsight: string | undefined;
  if (access.samplingServer && result.statistics) {
    const statsStr = JSON.stringify(result.statistics).slice(0, 2000);
    aiInsight = await generateAIInsight(
      access.samplingServer,
      'dataAnalysis',
      'Interpret these statistical results — what do they tell us about the data?',
      statsStr,
      { maxTokens: 400 }
    );
  }

  // Record operation in session context for LLM follow-up references
  try {
    if (access.sessionContext) {
      access.sessionContext.recordOperation({
        tool: 'sheets_compute',
        action: 'statistical',
        spreadsheetId: req.spreadsheetId,
        range: extractRangeA1(req.range),
        description: `Computed statistics on range ${extractRangeA1(req.range)}`,
        undoable: false,
      });
    }
  } catch {
    // Non-blocking: session context recording is best-effort
  }

  return {
    response: {
      success: true,
      action: 'statistical',
      statistics: result.statistics,
      correlations: result.correlations,
      correlationMatrix: result.correlationMatrix,
      computationTimeMs: Date.now() - startMs,
      ...(aiInsight !== undefined ? { aiInsight } : {}),
    },
  };
}
