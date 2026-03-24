/**
 * ServalSheets - Compute Handler
 *
 * Standalone handler for sheets_compute tool (16 actions).
 * Thin dispatch-only handler that delegates to compute-actions submodules.
 *
 * Actions: evaluate, aggregate, statistical, regression, forecast,
 *          matrix_op, pivot_compute, custom_function, batch_compute, explain_formula,
 *          sql_query, sql_join, python_eval, pandas_profile, sklearn_model, matplotlib_chart
 */

import { ErrorCodes } from './error-codes.js';
import { assertNever } from '../utils/type-utils.js';
import type { sheets_v4 } from 'googleapis';
import type { SheetsComputeInput, SheetsComputeOutput } from '../schemas/compute.js';
import { logger } from '../utils/logger.js';
import type { SamplingServer } from '../mcp/sampling.js';
import { DuckDBEngine } from '../services/duckdb-engine.js';
import type { ComputeHandlerAccess } from './compute-actions/internal.js';
import {
  handleEvaluate,
  handleAggregate,
  handleStatistical,
} from './compute-actions/statistics.js';
import { handleRegression, handleForecast } from './compute-actions/regression-forecast.js';
import { handleMatrixOp, handlePivotCompute } from './compute-actions/matrix-pivot.js';
import {
  handleCustomFunction,
  handleBatchCompute,
  handleExplainFormula,
} from './compute-actions/batch-custom-explain.js';
import {
  handleSqlQuery,
  handleSqlJoin,
  handlePythonEval,
  handlePandasProfile,
  handleSklearnModel,
  handleMatplotlibChart,
} from './compute-actions/advanced-query.js';

type ElicitFn = (opts: {
  message: string;
  requestedSchema: unknown;
}) => Promise<{ action: string; content: unknown }>;

export class ComputeHandler {
  private access: ComputeHandlerAccess;

  constructor(
    sheetsApi: sheets_v4.Sheets,
    options?: {
      samplingServer?: SamplingServer;
      duckdbEngine?: DuckDBEngine;
      server?: { elicitInput?: ElicitFn };
      sessionContext?: import('../services/session-context.js').SessionContextManager;
    }
  ) {
    this.access = {
      sheetsApi,
      samplingServer: options?.samplingServer,
      duckdbEngine: options?.duckdbEngine,
      server: options?.server,
      sessionContext: options?.sessionContext,
    };
  }

  async handle(input: SheetsComputeInput): Promise<SheetsComputeOutput> {
    const req = input.request;
    const startMs = Date.now();

    try {
      switch (req.action) {
        case 'evaluate':
          return await handleEvaluate(this.access, req);
        case 'aggregate':
          return await handleAggregate(this.access, req);
        case 'statistical':
          return await handleStatistical(this.access, req);
        case 'regression':
          return await handleRegression(this.access, req);
        case 'forecast':
          return await handleForecast(this.access, req);
        case 'matrix_op':
          return await handleMatrixOp(this.access, req);
        case 'pivot_compute':
          return await handlePivotCompute(this.access, req);
        case 'custom_function':
          return await handleCustomFunction(this.access, req);
        case 'batch_compute':
          return await handleBatchCompute(this.access, req);
        case 'explain_formula':
          return await handleExplainFormula(this.access, req);
        case 'sql_query':
          return await handleSqlQuery(this.access, req);
        case 'sql_join':
          return await handleSqlJoin(this.access, req);
        case 'python_eval':
          return await handlePythonEval(this.access, req);
        case 'pandas_profile':
          return await handlePandasProfile(this.access, req);
        case 'sklearn_model':
          return await handleSklearnModel(this.access, req);
        case 'matplotlib_chart':
          return await handleMatplotlibChart(this.access, req);
        default:
          assertNever(req);
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
            code: ErrorCodes.INTERNAL_ERROR,
            message: error instanceof Error ? error.message : String(error),
            retryable: false,
          },
        },
      };
    }
  }
}
