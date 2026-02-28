/**
 * Tool: sheets_compute
 * Server-side computation engine for spreadsheet data.
 * Provides deterministic math, statistics, forecasting, and matrix operations
 * without requiring AI/Sampling round-trips.
 *
 * Actions (10):
 * - evaluate: Evaluate a formula/expression against cell data
 * - aggregate: Run aggregation functions (SUM, AVG, COUNT, etc.) on ranges
 * - statistical: Descriptive statistics (mean, median, stddev, percentiles, etc.)
 * - regression: Linear/polynomial/exponential regression on data series
 * - forecast: Time-series forecasting with trend detection
 * - matrix_op: Matrix operations (transpose, multiply, inverse, determinant)
 * - pivot_compute: In-memory pivot table computation
 * - custom_function: Execute a user-defined computation expression
 * - batch_compute: Run multiple computations in a single call
 * - explain_formula: Parse and explain a Google Sheets formula
 */

import { z } from 'zod';
import {
  A1NotationSchema,
  ErrorDetailSchema,
  ResponseMetaSchema,
  SafetyOptionsSchema,
  type ToolAnnotations,
} from './shared.js';

// ============================================================================
// Common Schemas
// ============================================================================

const CommonFieldsSchema = z.object({
  spreadsheetId: z.string().min(1).describe('Spreadsheet ID from URL'),
  safety: SafetyOptionsSchema.optional().describe('Safety options for computation'),
  verbosity: z
    .enum(['minimal', 'standard', 'detailed'])
    .optional()
    .default('standard')
    .describe(
      'Response detail level: minimal (result only), standard (result + metadata), detailed (result + steps + metadata)'
    ),
});

// ============================================================================
// Individual Action Schemas
// ============================================================================

const EvaluateActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('evaluate')
    .describe('Evaluate a formula or expression against spreadsheet data'),
  formula: z
    .string()
    .min(1)
    .describe(
      'Formula to evaluate. Supports Google Sheets syntax (e.g., "=SUM(A1:A10)", "=IF(B2>100, B2*0.9, B2)"). Cell references are resolved against the spreadsheet.'
    ),
  range: A1NotationSchema.optional().describe(
    'Context range for relative cell references (A1 notation). Required if formula uses relative refs.'
  ),
}).strict();

const AggregateActionSchema = CommonFieldsSchema.extend({
  action: z.literal('aggregate').describe('Run aggregation functions on a range of data'),
  range: A1NotationSchema.describe('Range to aggregate (A1 notation, e.g., "Sheet1!A1:A100")'),
  functions: z
    .array(
      z.enum([
        'sum',
        'average',
        'count',
        'counta',
        'countblank',
        'min',
        'max',
        'median',
        'mode',
        'product',
        'stdev',
        'stdevp',
        'var',
        'varp',
      ])
    )
    .min(1)
    .describe('Aggregation functions to compute. Example: ["sum", "average", "count"]'),
  groupBy: z
    .string()
    .optional()
    .describe(
      'Column to group by before aggregating (column letter, e.g., "A" or column header name)'
    ),
}).strict();

const StatisticalActionSchema = CommonFieldsSchema.extend({
  action: z.literal('statistical').describe('Compute descriptive statistics for a data range'),
  range: A1NotationSchema.describe('Range containing numeric data (A1 notation)'),
  columns: z
    .array(z.string())
    .optional()
    .describe(
      'Specific columns to analyze (letters or header names). All numeric columns if omitted.'
    ),
  percentiles: z
    .array(z.number().min(0).max(100))
    .optional()
    .default([25, 50, 75])
    .describe('Percentiles to compute (0-100). Default: [25, 50, 75] (quartiles)'),
  includeCorrelations: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include correlation matrix between numeric columns'),
}).strict();

const RegressionActionSchema = CommonFieldsSchema.extend({
  action: z.literal('regression').describe('Perform regression analysis on data series'),
  range: A1NotationSchema.describe('Range containing X and Y data (A1 notation)'),
  xColumn: z.string().describe('Column for independent variable (letter or header name)'),
  yColumn: z.string().describe('Column for dependent variable (letter or header name)'),
  type: z
    .enum(['linear', 'polynomial', 'exponential', 'logarithmic', 'power'])
    .optional()
    .default('linear')
    .describe('Regression type. Default: linear'),
  degree: z
    .number()
    .int()
    .min(2)
    .max(6)
    .optional()
    .default(2)
    .describe('Polynomial degree (only for polynomial type). Default: 2'),
  predict: z
    .array(z.number())
    .optional()
    .describe('X values to predict Y for using the fitted model'),
}).strict();

const ForecastActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('forecast')
    .describe('Time-series forecasting with trend and seasonality detection'),
  range: A1NotationSchema.describe('Range containing time series data (A1 notation)'),
  dateColumn: z.string().describe('Column containing dates/timestamps (letter or header name)'),
  valueColumn: z.string().describe('Column containing values to forecast (letter or header name)'),
  periods: z.number().int().min(1).max(365).describe('Number of future periods to forecast'),
  method: z
    .enum(['linear_trend', 'moving_average', 'exponential_smoothing', 'auto'])
    .optional()
    .default('auto')
    .describe('Forecasting method. "auto" selects best fit. Default: auto'),
  seasonality: z
    .number()
    .int()
    .min(2)
    .optional()
    .describe('Seasonality period (e.g., 12 for monthly data with yearly seasonality)'),
}).strict();

const MatrixOpActionSchema = CommonFieldsSchema.extend({
  action: z.literal('matrix_op').describe('Perform matrix operations on spreadsheet data'),
  range: A1NotationSchema.describe('Range containing the matrix data (A1 notation)'),
  operation: z
    .enum(['transpose', 'multiply', 'inverse', 'determinant', 'eigenvalues', 'rank', 'trace'])
    .describe('Matrix operation to perform'),
  secondRange: A1NotationSchema.optional().describe(
    'Second matrix range (required for multiply operation)'
  ),
  outputRange: A1NotationSchema.optional().describe(
    'Range to write the result to (if omitted, result is returned but not written)'
  ),
}).strict();

const PivotComputeActionSchema = CommonFieldsSchema.extend({
  action: z
    .literal('pivot_compute')
    .describe('Compute an in-memory pivot table from spreadsheet data'),
  range: A1NotationSchema.describe('Source data range (A1 notation, must include headers)'),
  rows: z
    .array(z.string())
    .min(1)
    .describe('Columns to use as row groupings (header names or column letters)'),
  columns: z
    .array(z.string())
    .optional()
    .describe('Columns to use as column groupings (header names or column letters)'),
  values: z
    .array(
      z.object({
        column: z.string().describe('Column to aggregate (header name or letter)'),
        function: z
          .enum(['sum', 'average', 'count', 'min', 'max', 'median'])
          .describe('Aggregation function'),
      })
    )
    .min(1)
    .describe('Value columns with aggregation functions'),
  filters: z
    .array(
      z.object({
        column: z.string().describe('Column to filter on'),
        values: z.array(z.union([z.string(), z.number(), z.boolean()])).describe('Allowed values'),
      })
    )
    .optional()
    .describe('Optional filters to apply before pivoting'),
}).strict();

const CustomFunctionActionSchema = CommonFieldsSchema.extend({
  action: z.literal('custom_function').describe('Execute a custom computation expression on data'),
  range: A1NotationSchema.describe('Data range to operate on (A1 notation)'),
  expression: z
    .string()
    .min(1)
    .describe(
      'Computation expression using column references. Supports: arithmetic (+, -, *, /, %), comparison (>, <, ==, !=), logical (AND, OR, NOT), and built-in functions (ABS, ROUND, CEIL, FLOOR, SQRT, POW, LOG, LN, EXP, MOD). Column refs: $A, $B or $ColumnName. Example: "ROUND($Revenue * $TaxRate, 2)"'
    ),
  outputColumn: z
    .string()
    .optional()
    .describe('Column header name for the result. If omitted, returns results without writing.'),
}).strict();

const BatchComputeActionSchema = CommonFieldsSchema.extend({
  action: z.literal('batch_compute').describe('Run multiple computations in a single call'),
  computations: z
    .array(
      z.object({
        id: z.string().describe('Unique identifier for this computation'),
        type: z
          .enum(['evaluate', 'aggregate', 'statistical', 'custom_function'])
          .describe('Computation type'),
        params: z
          .record(z.string(), z.unknown())
          .describe(
            'Parameters for the computation (same as individual action params, minus spreadsheetId)'
          ),
      })
    )
    .min(1)
    .max(50)
    .describe('Array of computations to execute (max 50)'),
  stopOnError: z
    .boolean()
    .optional()
    .default(false)
    .describe('Stop execution on first error (default: false, continues and collects errors)'),
}).strict();

const ExplainFormulaActionSchema = CommonFieldsSchema.extend({
  action: z.literal('explain_formula').describe('Parse and explain a Google Sheets formula'),
  formula: z
    .string()
    .min(1)
    .describe('Google Sheets formula to explain (e.g., "=VLOOKUP(A2, Sheet2!A:C, 3, FALSE)")'),
  range: A1NotationSchema.optional().describe(
    'Context range for resolving cell references to actual values'
  ),
}).strict();

// ============================================================================
// Combined Input Schema
// ============================================================================

const normalizeComputeRequest = (val: unknown): unknown => {
  if (typeof val !== 'object' || val === null) return val;
  const obj = val as Record<string, unknown>;

  // Alias: 'expr' → 'expression' for custom_function (LLM compatibility)
  if (obj['action'] === 'custom_function' && obj['expr'] && !obj['expression']) {
    return { ...obj, expression: obj['expr'] };
  }

  // Alias: 'type' → 'method' for forecast (LLM compatibility)
  if (obj['action'] === 'forecast' && !obj['method'] && typeof obj['type'] === 'string') {
    const typeVal = obj['type'];
    if (
      ['linear_trend', 'moving_average', 'exponential_smoothing', 'auto'].includes(
        typeVal as string
      )
    ) {
      return { ...obj, method: typeVal };
    }
  }

  return val;
};

/**
 * All computation engine inputs
 *
 * Discriminated union for 10 compute actions.
 * Each action has only its required fields (no optional field pollution).
 */
export const SheetsComputeInputSchema = z.object({
  request: z.preprocess(
    normalizeComputeRequest,
    z.discriminatedUnion('action', [
      EvaluateActionSchema,
      AggregateActionSchema,
      StatisticalActionSchema,
      RegressionActionSchema,
      ForecastActionSchema,
      MatrixOpActionSchema,
      PivotComputeActionSchema,
      CustomFunctionActionSchema,
      BatchComputeActionSchema,
      ExplainFormulaActionSchema,
    ])
  ),
});

// ============================================================================
// Output Schema
// ============================================================================

const ComputeResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),
    // EVALUATE response
    result: z.unknown().optional().describe('Computation result value'),
    formula: z.string().optional().describe('The formula that was evaluated'),
    resolvedCells: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Cell references resolved during evaluation'),
    // AGGREGATE response
    aggregations: z
      .record(z.string(), z.union([z.number(), z.null()]))
      .optional()
      .describe('Aggregation results keyed by function name'),
    groups: z
      .array(
        z.object({
          key: z.union([z.string(), z.number(), z.boolean(), z.null()]),
          aggregations: z.record(z.string(), z.union([z.number(), z.null()])),
          rowCount: z.number(),
        })
      )
      .optional()
      .describe('Grouped aggregation results (when groupBy is specified)'),
    rowCount: z.number().optional().describe('Total rows processed'),
    // STATISTICAL response
    statistics: z
      .record(
        z.string(),
        z.object({
          count: z.number(),
          mean: z.number().nullable(),
          median: z.number().nullable(),
          mode: z.union([z.number(), z.null()]).optional(),
          stddev: z.number().nullable(),
          variance: z.number().nullable(),
          min: z.number().nullable(),
          max: z.number().nullable(),
          range: z.number().nullable(),
          skewness: z.number().nullable().optional(),
          kurtosis: z.number().nullable().optional(),
          percentiles: z.record(z.string(), z.number()).optional(),
          nullCount: z.number().optional(),
        })
      )
      .optional()
      .describe('Per-column statistics'),
    correlations: z
      .record(z.string(), z.record(z.string(), z.number()))
      .optional()
      .describe('Correlation matrix between columns'),
    // REGRESSION response
    coefficients: z.array(z.number()).optional().describe('Regression coefficients'),
    rSquared: z.number().optional().describe('R-squared (coefficient of determination)'),
    equation: z.string().optional().describe('Human-readable equation string'),
    predictions: z
      .array(z.object({ x: z.number(), y: z.number() }))
      .optional()
      .describe('Predicted values for the provided predict[] inputs'),
    residuals: z
      .object({
        mean: z.number(),
        stddev: z.number(),
        max: z.number(),
      })
      .optional()
      .describe('Residual statistics'),
    // FORECAST response
    forecast: z
      .array(
        z.object({
          period: z.union([z.string(), z.number()]),
          value: z.number(),
          lowerBound: z.number().optional(),
          upperBound: z.number().optional(),
        })
      )
      .optional()
      .describe('Forecasted values with optional confidence bounds'),
    trend: z
      .object({
        direction: z.enum(['increasing', 'decreasing', 'stable']),
        strength: z.number(),
        seasonalityDetected: z.boolean(),
        seasonalPeriod: z.number().optional(),
      })
      .optional()
      .describe('Detected trend information'),
    methodUsed: z.string().optional().describe('Forecasting method that was selected/used'),
    // MATRIX_OP response
    matrix: z
      .array(z.array(z.number()))
      .optional()
      .describe('Result matrix (for transpose, multiply, inverse)'),
    scalar: z.number().optional().describe('Scalar result (for determinant, trace, rank)'),
    eigenvalues: z.array(z.number()).optional().describe('Eigenvalues (for eigenvalues operation)'),
    written: z.boolean().optional().describe('Whether result was written to outputRange'),
    // PIVOT_COMPUTE response
    pivotTable: z
      .object({
        headers: z.array(z.string()),
        rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
        totals: z.record(z.string(), z.number()).optional(),
      })
      .optional()
      .describe('Computed pivot table'),
    // CUSTOM_FUNCTION response
    values: z.array(z.unknown()).optional().describe('Computed values per row'),
    writtenToColumn: z.string().optional().describe('Column the results were written to'),
    // BATCH_COMPUTE response
    results: z
      .array(
        z.object({
          id: z.string(),
          success: z.boolean(),
          result: z.unknown().optional(),
          error: z.string().optional(),
        })
      )
      .optional()
      .describe('Results for each computation in the batch'),
    // EXPLAIN_FORMULA response
    explanation: z
      .object({
        summary: z.string(),
        functions: z.array(
          z.object({
            name: z.string(),
            description: z.string(),
            arguments: z.array(z.string()),
          })
        ),
        references: z.array(
          z.object({
            ref: z.string(),
            value: z.unknown().optional(),
          })
        ),
        complexity: z.enum(['simple', 'moderate', 'complex']),
        dependencyChain: z.array(z.string()).optional(),
      })
      .optional()
      .describe('Formula explanation with function breakdown and references'),
    // Common
    computationTimeMs: z.number().optional().describe('Time taken for computation in milliseconds'),
    message: z.string().optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsComputeOutputSchema = z.object({
  response: ComputeResponseSchema,
});

export const SHEETS_COMPUTE_ANNOTATIONS: ToolAnnotations = {
  title: 'Computation Engine',
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export type SheetsComputeInput = z.infer<typeof SheetsComputeInputSchema>;
export type SheetsComputeOutput = z.infer<typeof SheetsComputeOutputSchema>;
export type ComputeResponse = z.infer<typeof ComputeResponseSchema>;

// Type narrowing helpers for handler methods
export type ComputeEvaluateInput = SheetsComputeInput['request'] & { action: 'evaluate' };
export type ComputeAggregateInput = SheetsComputeInput['request'] & { action: 'aggregate' };
export type ComputeStatisticalInput = SheetsComputeInput['request'] & { action: 'statistical' };
export type ComputeRegressionInput = SheetsComputeInput['request'] & { action: 'regression' };
export type ComputeForecastInput = SheetsComputeInput['request'] & { action: 'forecast' };
export type ComputeMatrixOpInput = SheetsComputeInput['request'] & { action: 'matrix_op' };
export type ComputePivotInput = SheetsComputeInput['request'] & { action: 'pivot_compute' };
export type ComputeCustomFunctionInput = SheetsComputeInput['request'] & {
  action: 'custom_function';
};
export type ComputeBatchInput = SheetsComputeInput['request'] & { action: 'batch_compute' };
export type ComputeExplainFormulaInput = SheetsComputeInput['request'] & {
  action: 'explain_formula';
};
