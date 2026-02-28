/**
 * ServalSheets - Compute Handler
 *
 * Standalone handler for sheets_compute tool (10 actions).
 * Routes computation requests to the compute-engine service.
 *
 * Actions: evaluate, aggregate, statistical, regression, forecast,
 *          matrix_op, pivot_compute, custom_function, batch_compute, explain_formula
 */

import type { sheets_v4 } from 'googleapis';
import type { SheetsComputeInput, SheetsComputeOutput } from '../schemas/compute.js';
import {
  fetchRangeData,
  aggregate,
  computeStatistics,
  computeRegression,
  computeForecast,
  matrixOp,
  computePivot,
  explainFormula,
} from '../services/compute-engine.js';
import { logger } from '../utils/logger.js';

export class ComputeHandler {
  constructor(private sheetsApi: sheets_v4.Sheets) {}

  async handle(input: SheetsComputeInput): Promise<SheetsComputeOutput> {
    const req = input.request;
    const startMs = Date.now();

    try {
      switch (req.action) {
        case 'evaluate':
          return await this.handleEvaluate(req);
        case 'aggregate':
          return await this.handleAggregate(req);
        case 'statistical':
          return await this.handleStatistical(req);
        case 'regression':
          return await this.handleRegression(req);
        case 'forecast':
          return await this.handleForecast(req);
        case 'matrix_op':
          return await this.handleMatrixOp(req);
        case 'pivot_compute':
          return await this.handlePivotCompute(req);
        case 'custom_function':
          return await this.handleCustomFunction(req);
        case 'batch_compute':
          return await this.handleBatchCompute(req);
        case 'explain_formula':
          return await this.handleExplainFormula(req);
        default: {
          const _exhaustive: never = req;
          return {
            response: {
              success: false as const,
              error: {
                code: 'INVALID_PARAMS' as const,
                message: `Unknown compute action: ${(req as { action: string }).action}`,
                retryable: false,
              },
            },
          };
        }
      }
    } catch (error) {
      const elapsed = Date.now() - startMs;
      logger.error('Compute handler error', {
        action: req.action,
        durationMs: elapsed,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        response: {
          success: false as const,
          error: {
            code: 'INTERNAL_ERROR' as const,
            message: error instanceof Error ? error.message : String(error),
            retryable: false,
          },
        },
      };
    }
  }

  // ========================================================================
  // Action Handlers
  // ========================================================================

  private async handleEvaluate(
    req: SheetsComputeInput['request'] & { action: 'evaluate' }
  ): Promise<SheetsComputeOutput> {
    const startMs = Date.now();

    // For now, resolve cell references if a range is provided
    let resolvedCells: Record<string, unknown> | undefined;
    if (req.range) {
      const data = await fetchRangeData(this.sheetsApi, req.spreadsheetId, req.range);
      resolvedCells = {};
      const _headers = data[0] || [];
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
      result = `Evaluation error: ${e instanceof Error ? e.message : String(e)}`;
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

  private async handleAggregate(
    req: SheetsComputeInput['request'] & { action: 'aggregate' }
  ): Promise<SheetsComputeOutput> {
    const startMs = Date.now();
    const data = await fetchRangeData(this.sheetsApi, req.spreadsheetId, req.range);

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

  private async handleStatistical(
    req: SheetsComputeInput['request'] & { action: 'statistical' }
  ): Promise<SheetsComputeOutput> {
    const startMs = Date.now();
    const data = await fetchRangeData(this.sheetsApi, req.spreadsheetId, req.range);

    const result = computeStatistics(data, {
      columns: req.columns,
      percentiles: req.percentiles,
      includeCorrelations: req.includeCorrelations,
    });

    return {
      response: {
        success: true,
        action: 'statistical',
        statistics: result.statistics,
        correlations: result.correlations,
        computationTimeMs: Date.now() - startMs,
      },
    };
  }

  private async handleRegression(
    req: SheetsComputeInput['request'] & { action: 'regression' }
  ): Promise<SheetsComputeOutput> {
    const startMs = Date.now();
    const data = await fetchRangeData(this.sheetsApi, req.spreadsheetId, req.range);

    const result = computeRegression(data, {
      xColumn: req.xColumn,
      yColumn: req.yColumn,
      type: req.type,
      degree: req.degree,
      predict: req.predict,
    });

    return {
      response: {
        success: true,
        action: 'regression',
        coefficients: result.coefficients,
        rSquared: result.rSquared,
        equation: result.equation,
        predictions: result.predictions,
        residuals: result.residuals,
        computationTimeMs: Date.now() - startMs,
      },
    };
  }

  private async handleForecast(
    req: SheetsComputeInput['request'] & { action: 'forecast' }
  ): Promise<SheetsComputeOutput> {
    const startMs = Date.now();
    const data = await fetchRangeData(this.sheetsApi, req.spreadsheetId, req.range);

    const result = computeForecast(data, {
      dateColumn: req.dateColumn,
      valueColumn: req.valueColumn,
      periods: req.periods,
      method: req.method,
      seasonality: req.seasonality,
    });

    return {
      response: {
        success: true,
        action: 'forecast',
        forecast: result.forecast,
        trend: result.trend,
        methodUsed: result.methodUsed,
        computationTimeMs: Date.now() - startMs,
      },
    };
  }

  private async handleMatrixOp(
    req: SheetsComputeInput['request'] & { action: 'matrix_op' }
  ): Promise<SheetsComputeOutput> {
    const startMs = Date.now();
    const data = await fetchRangeData(this.sheetsApi, req.spreadsheetId, req.range);

    // Convert to numeric matrix
    const matrix = data.map((row) =>
      row.map((cell) => (typeof cell === 'number' ? cell : parseFloat(String(cell)) || 0))
    );

    let secondMatrix: number[][] | undefined;
    if (req.secondRange) {
      const secondData = await fetchRangeData(this.sheetsApi, req.spreadsheetId, req.secondRange);
      secondMatrix = secondData.map((row) =>
        row.map((cell) => (typeof cell === 'number' ? cell : parseFloat(String(cell)) || 0))
      );
    }

    const result = matrixOp(matrix, req.operation, secondMatrix);

    // Optionally write result
    let written = false;
    if (req.outputRange && result.matrix) {
      const { executeWithRetry } = await import('../utils/retry.js');
      await executeWithRetry(async () =>
        this.sheetsApi.spreadsheets.values.update({
          spreadsheetId: req.spreadsheetId,
          range: req.outputRange!,
          valueInputOption: 'RAW',
          requestBody: { values: result.matrix },
        })
      );
      written = true;
    }

    return {
      response: {
        success: true,
        action: 'matrix_op',
        matrix: result.matrix,
        scalar: result.scalar,
        eigenvalues: result.eigenvalues,
        written,
        computationTimeMs: Date.now() - startMs,
      },
    };
  }

  private async handlePivotCompute(
    req: SheetsComputeInput['request'] & { action: 'pivot_compute' }
  ): Promise<SheetsComputeOutput> {
    const startMs = Date.now();
    const data = await fetchRangeData(this.sheetsApi, req.spreadsheetId, req.range);

    const result = computePivot(data, {
      rows: req.rows,
      columns: req.columns,
      values: req.values,
      filters: req.filters,
    });

    return {
      response: {
        success: true,
        action: 'pivot_compute',
        pivotTable: result,
        computationTimeMs: Date.now() - startMs,
      },
    };
  }

  private async handleCustomFunction(
    req: SheetsComputeInput['request'] & { action: 'custom_function' }
  ): Promise<SheetsComputeOutput> {
    const startMs = Date.now();
    const data = await fetchRangeData(this.sheetsApi, req.spreadsheetId, req.range);
    const headers = (data[0] || []).map(String);
    const rows = data.slice(1);

    // Evaluate expression for each row
    const values: unknown[] = [];
    for (const row of rows) {
      let expr = req.expression;
      // Replace $ColumnName and $A, $B etc. with actual values
      for (let i = 0; i < headers.length; i++) {
        const headerName = headers[i]!;
        const colLetter = String.fromCharCode(65 + i);
        const cellVal = row[i] ?? 0;
        expr = expr.replace(new RegExp(`\\$${headerName}`, 'gi'), String(cellVal));
        expr = expr.replace(new RegExp(`\\$${colLetter}\\b`, 'g'), String(cellVal));
      }
      try {
        values.push(evaluateExpression(expr));
      } catch {
        values.push(null);
      }
    }

    // Write to output column if specified
    let writtenToColumn: string | undefined;
    if (req.outputColumn) {
      const colIdx = headers.indexOf(req.outputColumn);
      const targetCol =
        colIdx >= 0 ? String.fromCharCode(65 + colIdx) : String.fromCharCode(65 + headers.length);
      const writeRange = `${targetCol}1:${targetCol}${rows.length + 1}`;
      const writeValues = [[req.outputColumn], ...values.map((v) => [v])];

      const { executeWithRetry } = await import('../utils/retry.js');
      await executeWithRetry(async () =>
        this.sheetsApi.spreadsheets.values.update({
          spreadsheetId: req.spreadsheetId,
          range: writeRange,
          valueInputOption: 'RAW',
          requestBody: { values: writeValues },
        })
      );
      writtenToColumn = req.outputColumn;
    }

    return {
      response: {
        success: true,
        action: 'custom_function',
        values,
        writtenToColumn,
        rowCount: rows.length,
        computationTimeMs: Date.now() - startMs,
      },
    };
  }

  private async handleBatchCompute(
    req: SheetsComputeInput['request'] & { action: 'batch_compute' }
  ): Promise<SheetsComputeOutput> {
    const startMs = Date.now();
    const results: Array<{ id: string; success: boolean; result?: unknown; error?: string }> = [];

    for (const computation of req.computations) {
      try {
        const subInput: SheetsComputeInput = {
          request: {
            ...computation.params,
            action: computation.type,
            spreadsheetId: req.spreadsheetId,
            verbosity: req.verbosity,
          } as SheetsComputeInput['request'],
        };
        const subResult = await this.handle(subInput);
        if (subResult.response.success) {
          const {
            action: _action,
            success: _success,
            computationTimeMs: _computationTimeMs,
            ...rest
          } = subResult.response;
          results.push({ id: computation.id, success: true, result: rest });
        } else {
          results.push({
            id: computation.id,
            success: false,
            error: subResult.response.error.message,
          });
          if (req.stopOnError) break;
        }
      } catch (error) {
        results.push({
          id: computation.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
        if (req.stopOnError) break;
      }
    }

    return {
      response: {
        success: true,
        action: 'batch_compute',
        results,
        computationTimeMs: Date.now() - startMs,
      },
    };
  }

  private async handleExplainFormula(
    req: SheetsComputeInput['request'] & { action: 'explain_formula' }
  ): Promise<SheetsComputeOutput> {
    const startMs = Date.now();
    const explanation = explainFormula(req.formula);

    // Resolve cell references if range provided
    if (req.range) {
      const data = await fetchRangeData(this.sheetsApi, req.spreadsheetId, req.range);
      for (const ref of explanation.references) {
        // Try to resolve each reference from the data
        const cellMatch = ref.ref.match(/^([A-Z]+)(\d+)$/i);
        if (cellMatch) {
          const colIdx = cellMatch[1]!.toUpperCase().charCodeAt(0) - 65;
          const rowIdx = parseInt(cellMatch[2]!) - 1;
          if (data[rowIdx] && data[rowIdx]![colIdx] !== undefined) {
            (ref as { ref: string; value?: unknown }).value = data[rowIdx]![colIdx];
          }
        }
      }
    }

    return {
      response: {
        success: true,
        action: 'explain_formula',
        explanation,
        computationTimeMs: Date.now() - startMs,
      },
    };
  }
}

// ============================================================================
// Simple Expression Evaluator
// ============================================================================

function evaluateExpression(expr: string): number | string {
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
