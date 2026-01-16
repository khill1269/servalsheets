/**
 * Tool: sheets_visualize
 * Consolidated chart and pivot table visualization operations
 * Merges sheets_charts (10 actions) and sheets_pivot (7 actions) into 17 actions
 */

import { z } from 'zod';
import {
  SpreadsheetIdSchema,
  SheetIdSchema,
  RangeInputSchema,
  GridRangeSchema,
  ChartTypeSchema,
  LegendPositionSchema,
  ChartPositionSchema,
  ColorSchema,
  SummarizeFunctionSchema,
  SortOrderSchema,
  ErrorDetailSchema,
  SafetyOptionsSchema,
  MutationSummarySchema,
  ResponseMetaSchema,
  type ToolAnnotations,
  type RangeInput,
} from './shared.js';

// ============================================================================
// CHART SCHEMAS (from charts.ts)
// ============================================================================

const ChartDataSchema = z.object({
  sourceRange: RangeInputSchema,
  series: z
    .array(
      z.object({
        column: z.number().int().min(0),
        color: ColorSchema.optional(),
      })
    )
    .optional(),
  categories: z.number().int().min(0).optional(),
  aggregateType: z
    .enum([
      'AVERAGE',
      'COUNT',
      'COUNTA',
      'COUNTUNIQUE',
      'MAX',
      'MEDIAN',
      'MIN',
      'STDEV',
      'STDEVP',
      'SUM',
      'VAR',
      'VARP',
    ])
    .optional(),
});

const ChartOptionsSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  legendPosition: LegendPositionSchema.optional(),
  backgroundColor: ColorSchema.optional(),
  is3D: z.boolean().optional(),
  pieHole: z.number().min(0).max(1).optional(),
  stacked: z.boolean().optional(),
  lineSmooth: z.boolean().optional(),
  axisTitle: z
    .object({
      horizontal: z.string().optional(),
      vertical: z.string().optional(),
    })
    .optional(),
});

// ============================================================================
// PIVOT SCHEMAS (from pivot.ts)
// ============================================================================

const PivotGroupSchema = z.object({
  sourceColumnOffset: z.number().int().min(0),
  sortOrder: SortOrderSchema.optional(),
  showTotals: z.boolean().optional().default(true),
  groupRule: z
    .object({
      dateTimeRule: z
        .object({
          type: z.enum([
            'SECOND',
            'MINUTE',
            'HOUR',
            'DAY_OF_WEEK',
            'DAY_OF_YEAR',
            'DAY_OF_MONTH',
            'WEEK_OF_YEAR',
            'MONTH',
            'QUARTER',
            'YEAR',
            'YEAR_MONTH',
            'YEAR_QUARTER',
            'YEAR_MONTH_DAY',
          ]),
        })
        .optional(),
      manualRule: z
        .object({
          groups: z.array(
            z.object({
              groupName: z.string(),
              items: z.array(z.string()),
            })
          ),
        })
        .optional(),
      histogramRule: z
        .object({
          interval: z.number().positive(),
          start: z.number().optional(),
          end: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});

const PivotValueSchema = z.object({
  sourceColumnOffset: z.number().int().min(0),
  summarizeFunction: SummarizeFunctionSchema,
  name: z.string().optional(),
  calculatedDisplayType: z
    .enum(['PERCENT_OF_ROW_TOTAL', 'PERCENT_OF_COLUMN_TOTAL', 'PERCENT_OF_GRAND_TOTAL'])
    .optional(),
});

const PivotFilterSchema = z.object({
  sourceColumnOffset: z.number().int().min(0),
  filterCriteria: z.object({
    visibleValues: z.array(z.string()).optional(),
    condition: z
      .object({
        type: z.string(),
        values: z.array(z.string()).optional(),
      })
      .optional(),
  }),
});

// ============================================================================
// CONSOLIDATED INPUT SCHEMA (17 actions)
// ============================================================================

// INPUT SCHEMA: Flattened union for MCP SDK compatibility
// The MCP SDK has a bug with z.discriminatedUnion() that causes it to return empty schemas
// Workaround: Use a single object with all fields optional, validate with refine()
export const SheetsVisualizeInputSchema = z
  .object({
    // Required action discriminator (17 actions total)
    action: z
      .enum([
        // Chart actions (10, with prefixes for conflicts)
        'chart_create',
        'suggest_chart',
        'chart_update',
        'chart_delete',
        'chart_list',
        'chart_get',
        'chart_move',
        'chart_resize',
        'chart_update_data_range',
        'chart_export',
        // Pivot actions (7, with prefixes for conflicts)
        'pivot_create',
        'suggest_pivot',
        'pivot_update',
        'pivot_delete',
        'pivot_list',
        'pivot_get',
        'pivot_refresh',
      ])
      .describe('The visualization operation to perform (chart or pivot table)'),

    // Common fields
    spreadsheetId: SpreadsheetIdSchema.optional().describe(
      'Spreadsheet ID from URL (required for all actions)'
    ),

    // ========================================================================
    // CHART FIELDS
    // ========================================================================

    // Chart-specific ID field
    chartId: z
      .number()
      .int()
      .optional()
      .describe(
        'Numeric chart ID (required for: chart_update, chart_delete, chart_get, chart_move, chart_resize, chart_update_data_range, chart_export)'
      ),

    // Chart position and data
    position: ChartPositionSchema.optional().describe(
      'Chart position and size on the sheet (required for: chart_create, chart_move; optional for: chart_update)'
    ),
    data: ChartDataSchema.optional().describe(
      'Chart data source (range, series, categories) (required for: chart_create, chart_update_data_range; optional for: chart_update)'
    ),
    options: ChartOptionsSchema.optional().describe(
      'Chart options (title, subtitle, legend, colors, 3D, stacking, etc.) (optional for: chart_create, chart_update)'
    ),

    // Chart type
    chartType: ChartTypeSchema.optional().describe(
      'Chart type (LINE, BAR, COLUMN, PIE, SCATTER, etc.) (required for: chart_create; optional for: chart_update)'
    ),

    // Chart resize fields
    width: z
      .number()
      .positive()
      .optional()
      .describe(
        'Width in pixels (must be positive) (required for: chart_resize; optional for: chart_export)'
      ),
    height: z
      .number()
      .positive()
      .optional()
      .describe(
        'Height in pixels (must be positive) (required for: chart_resize; optional for: chart_export)'
      ),

    // Chart export field
    format: z
      .enum(['PNG', 'PDF'])
      .optional()
      .default('PNG')
      .describe('Export format (PNG or PDF, default: PNG) (optional for: chart_export)'),

    // ========================================================================
    // PIVOT FIELDS
    // ========================================================================

    // Pivot-specific range field (different from chart range)
    sourceRange: RangeInputSchema.optional().describe(
      'Source data range for the pivot table (A1 notation or semantic) (required for: pivot_create)'
    ),
    destinationSheetId: SheetIdSchema.optional().describe(
      'Sheet ID for pivot table destination (omit = new sheet) (pivot_create only)'
    ),
    destinationCell: z
      .string()
      .regex(/^[A-Z]{1,3}\d+$/, 'Invalid cell reference format (expected: A1, AA1, AAA1)')
      .optional()
      .default('A1')
      .describe("Top-left cell for pivot table (e.g., 'A1', default: A1) (pivot_create only)"),

    // Pivot configuration
    rows: z
      .array(PivotGroupSchema)
      .optional()
      .describe('Row groupings for the pivot table (pivot_create, pivot_update)'),
    columns: z
      .array(PivotGroupSchema)
      .optional()
      .describe('Column groupings for the pivot table (pivot_create, pivot_update)'),
    values: z
      .array(PivotValueSchema)
      .optional()
      .describe('Value aggregations (required for pivot_create; optional for pivot_update)'),
    filters: z
      .array(PivotFilterSchema)
      .optional()
      .describe('Filter criteria for the pivot table (pivot_create, pivot_update)'),

    // ========================================================================
    // SHARED FIELDS (used by both charts and pivots)
    // ========================================================================

    // Sheet ID (used by chart_create, chart_list, and pivot operations)
    sheetId: SheetIdSchema.optional().describe(
      'Numeric sheet ID (required for: chart_create, pivot_update, pivot_delete, pivot_get, pivot_refresh; optional for: chart_list)'
    ),

    // Range field for suggestions (used by both suggest_chart and suggest_pivot)
    range: RangeInputSchema.optional().describe(
      'Data range to analyze for suggestions (required for: suggest_chart, suggest_pivot)'
    ),
    maxSuggestions: z
      .number()
      .int()
      .min(1)
      .max(5)
      .optional()
      .describe(
        'Number of suggestions to return (optional for: suggest_chart, suggest_pivot, default: 3)'
      ),

    // Safety options (used by multiple actions)
    safety: SafetyOptionsSchema.optional().describe(
      'Safety options (dryRun, createSnapshot, etc.) (optional for: chart_update, chart_delete, chart_update_data_range, pivot_update, pivot_delete)'
    ),

    // ===== LLM OPTIMIZATION: VERBOSITY CONTROL =====
    verbosity: z
      .enum(['minimal', 'standard', 'detailed'])
      .optional()
      .default('standard')
      .describe(
        'Response detail level: minimal (essential info only, ~50% less tokens), standard (balanced), detailed (full metadata)'
      ),
  })
  .refine(
    (data) => {
      // Validate required fields based on action
      switch (data.action) {
        // Chart actions
        case 'chart_create':
          return (
            !!data.spreadsheetId &&
            data.sheetId !== undefined &&
            !!data.chartType &&
            !!data.data &&
            !!data.position
          );
        case 'suggest_chart':
          return !!data.spreadsheetId && !!data.range;
        case 'chart_update':
          return !!data.spreadsheetId && data.chartId !== undefined;
        case 'chart_delete':
          return !!data.spreadsheetId && data.chartId !== undefined;
        case 'chart_list':
          return !!data.spreadsheetId;
        case 'chart_get':
          return !!data.spreadsheetId && data.chartId !== undefined;
        case 'chart_move':
          return !!data.spreadsheetId && data.chartId !== undefined && !!data.position;
        case 'chart_resize':
          return (
            !!data.spreadsheetId &&
            data.chartId !== undefined &&
            data.width !== undefined &&
            data.height !== undefined
          );
        case 'chart_update_data_range':
          return !!data.spreadsheetId && data.chartId !== undefined && !!data.data;
        case 'chart_export':
          return !!data.spreadsheetId && data.chartId !== undefined;

        // Pivot actions
        case 'pivot_create':
          return (
            !!data.spreadsheetId && !!data.sourceRange && !!data.values && data.values.length > 0
          );
        case 'suggest_pivot':
          return !!data.spreadsheetId && !!data.range;
        case 'pivot_update':
        case 'pivot_delete':
        case 'pivot_get':
        case 'pivot_refresh':
          return !!data.spreadsheetId && data.sheetId !== undefined;
        case 'pivot_list':
          return !!data.spreadsheetId;

        default:
          return false;
      }
    },
    {
      message: 'Missing required fields for the specified action',
    }
  );

// ============================================================================
// CONSOLIDATED OUTPUT SCHEMA
// ============================================================================

const VisualizeResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    action: z.string(),

    // Chart-specific response fields
    chartId: z.number().int().optional().describe('Chart ID (for chart actions)'),
    charts: z
      .array(
        z.object({
          chartId: z.number().int(),
          chartType: z.string(),
          sheetId: z.number().int(),
          title: z.string().optional(),
          position: ChartPositionSchema,
        })
      )
      .optional()
      .describe('List of charts (for chart_list action)'),
    exportUrl: z.string().optional().describe('Export URL (for chart_export action)'),
    exportData: z
      .string()
      .optional()
      .describe('Base64-encoded export data (for chart_export action)'),

    // Pivot-specific response fields
    pivotTable: z
      .object({
        sheetId: z.number().int(),
        sourceRange: GridRangeSchema,
        rowGroups: z.number().int(),
        columnGroups: z.number().int(),
        values: z.number().int(),
      })
      .optional()
      .describe('Pivot table details (for pivot actions)'),
    pivotTables: z
      .array(
        z.object({
          sheetId: z.number().int(),
          title: z.string(),
        })
      )
      .optional()
      .describe('List of pivot tables (for pivot_list action)'),

    // Shared suggestion fields
    suggestions: z
      .array(
        z.union([
          // Chart suggestions
          z.object({
            chartType: ChartTypeSchema,
            title: z.string(),
            explanation: z.string(),
            confidence: z.number().min(0).max(100),
            reasoning: z.string(),
            dataMapping: z.object({
              seriesColumns: z.array(z.number().int()).optional(),
              categoryColumn: z.number().int().optional(),
            }),
          }),
          // Pivot suggestions
          z.object({
            title: z.string(),
            explanation: z.string(),
            confidence: z.number().min(0).max(100),
            reasoning: z.string(),
            configuration: z.object({
              rowGroupColumns: z
                .array(z.number().int())
                .describe('Column indices to group by rows'),
              columnGroupColumns: z
                .array(z.number().int())
                .optional()
                .describe('Column indices to group by columns'),
              valueColumns: z
                .array(
                  z.object({
                    columnIndex: z.number().int(),
                    function: SummarizeFunctionSchema,
                  })
                )
                .describe('Columns to aggregate and their functions'),
            }),
          }),
        ])
      )
      .optional()
      .describe('Visualization suggestions (for suggest_chart, suggest_pivot actions)'),

    // Common response fields
    dryRun: z.boolean().optional(),
    mutation: MutationSummarySchema.optional(),
    _meta: ResponseMetaSchema.optional(),
  }),
  z.object({
    success: z.literal(false),
    error: ErrorDetailSchema,
  }),
]);

export const SheetsVisualizeOutputSchema = z.object({
  response: VisualizeResponseSchema,
});

// ============================================================================
// ANNOTATIONS
// ============================================================================

export const SHEETS_VISUALIZE_ANNOTATIONS: ToolAnnotations = {
  title: 'Visualizations (Charts & Pivot Tables)',
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SheetsVisualizeInput = z.infer<typeof SheetsVisualizeInputSchema>;
export type SheetsVisualizeOutput = z.infer<typeof SheetsVisualizeOutputSchema>;
export type VisualizeResponse = z.infer<typeof VisualizeResponseSchema>;

// ============================================================================
// TYPE NARROWING HELPERS (17 action types)
// ============================================================================

// Chart action types (10)
export type ChartCreateInput = SheetsVisualizeInput & {
  action: 'chart_create';
  spreadsheetId: string;
  sheetId: number;
  chartType: string;
  data: z.infer<typeof ChartDataSchema>;
  position: z.infer<typeof ChartPositionSchema>;
};

export type SuggestChartInput = SheetsVisualizeInput & {
  action: 'suggest_chart';
  spreadsheetId: string;
  range: RangeInput;
};

export type ChartUpdateInput = SheetsVisualizeInput & {
  action: 'chart_update';
  spreadsheetId: string;
  chartId: number;
};

export type ChartDeleteInput = SheetsVisualizeInput & {
  action: 'chart_delete';
  spreadsheetId: string;
  chartId: number;
};

export type ChartListInput = SheetsVisualizeInput & {
  action: 'chart_list';
  spreadsheetId: string;
};

export type ChartGetInput = SheetsVisualizeInput & {
  action: 'chart_get';
  spreadsheetId: string;
  chartId: number;
};

export type ChartMoveInput = SheetsVisualizeInput & {
  action: 'chart_move';
  spreadsheetId: string;
  chartId: number;
  position: z.infer<typeof ChartPositionSchema>;
};

export type ChartResizeInput = SheetsVisualizeInput & {
  action: 'chart_resize';
  spreadsheetId: string;
  chartId: number;
  width: number;
  height: number;
};

export type ChartUpdateDataRangeInput = SheetsVisualizeInput & {
  action: 'chart_update_data_range';
  spreadsheetId: string;
  chartId: number;
  data: z.infer<typeof ChartDataSchema>;
};

export type ChartExportInput = SheetsVisualizeInput & {
  action: 'chart_export';
  spreadsheetId: string;
  chartId: number;
};

// Pivot action types (7)
export type PivotCreateInput = SheetsVisualizeInput & {
  action: 'pivot_create';
  spreadsheetId: string;
  sourceRange: RangeInput;
  values: NonNullable<SheetsVisualizeInput['values']>;
};

export type SuggestPivotInput = SheetsVisualizeInput & {
  action: 'suggest_pivot';
  spreadsheetId: string;
  range: RangeInput;
};

export type PivotUpdateInput = SheetsVisualizeInput & {
  action: 'pivot_update';
  spreadsheetId: string;
  sheetId: number;
};

export type PivotDeleteInput = SheetsVisualizeInput & {
  action: 'pivot_delete';
  spreadsheetId: string;
  sheetId: number;
};

export type PivotListInput = SheetsVisualizeInput & {
  action: 'pivot_list';
  spreadsheetId: string;
};

export type PivotGetInput = SheetsVisualizeInput & {
  action: 'pivot_get';
  spreadsheetId: string;
  sheetId: number;
};

export type PivotRefreshInput = SheetsVisualizeInput & {
  action: 'pivot_refresh';
  spreadsheetId: string;
  sheetId: number;
};
