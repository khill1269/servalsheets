/**
 * Tool: sheets_visualize
 * Consolidated chart and pivot table visualization operations
 * Merges sheets_charts (9 actions) and sheets_pivot (7 actions) into 16 actions
 */
import { z } from 'zod';
import { SpreadsheetIdSchema, SheetIdSchema, RangeInputSchema, GridRangeSchema, ChartTypeSchema, LegendPositionSchema, ChartPositionSchema, ColorSchema, SummarizeFunctionSchema, SortOrderSchema, ErrorDetailSchema, SafetyOptionsSchema, MutationSummarySchema, ResponseMetaSchema, } from './shared.js';
// ============================================================================
// CHART SCHEMAS (from charts.ts)
// ============================================================================
const ChartDataSchema = z.object({
    sourceRange: RangeInputSchema,
    series: z
        .array(z.object({
        column: z.coerce.number().int().min(0),
        color: ColorSchema.optional(),
    }))
        .optional(),
    categories: z.coerce.number().int().min(0).optional(),
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
    pieHole: z.coerce.number().min(0).max(1).optional(),
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
    sourceColumnOffset: z.coerce.number().int().min(0),
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
            groups: z.array(z.object({
                groupName: z.string(),
                items: z.array(z.string()),
            })),
        })
            .optional(),
        histogramRule: z
            .object({
            interval: z.coerce.number().positive(),
            start: z.coerce.number().optional(),
            end: z.coerce.number().optional(),
        })
            .optional(),
    })
        .optional(),
});
const PivotValueSchema = z.object({
    sourceColumnOffset: z.coerce.number().int().min(0),
    summarizeFunction: SummarizeFunctionSchema,
    name: z.string().optional(),
    calculatedDisplayType: z
        .enum(['PERCENT_OF_ROW_TOTAL', 'PERCENT_OF_COLUMN_TOTAL', 'PERCENT_OF_GRAND_TOTAL'])
        .optional(),
});
const PivotFilterSchema = z.object({
    sourceColumnOffset: z.coerce.number().int().min(0),
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
// CONSOLIDATED INPUT SCHEMA (16 actions)
// ============================================================================
const CommonFieldsSchema = z.object({
    verbosity: z
        .enum(['minimal', 'standard', 'detailed'])
        .optional()
        .default('standard')
        .describe('Response detail level: minimal (essential info only, ~50% less tokens), standard (balanced), detailed (full metadata)'),
    safety: SafetyOptionsSchema.optional().describe('Safety options (dryRun, createSnapshot, etc.)'),
});
// ===== CHART ACTION SCHEMAS (9 actions) =====
const ChartCreateActionSchema = CommonFieldsSchema.extend({
    action: z.literal('chart_create').describe('Create a new chart'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    sheetId: SheetIdSchema.describe('Numeric sheet ID where chart will be placed'),
    chartType: ChartTypeSchema.describe('Chart type (LINE, BAR, COLUMN, PIE, SCATTER, etc.)'),
    data: ChartDataSchema.describe('Chart data source (range, series, categories)'),
    position: ChartPositionSchema.describe('Chart position and size on the sheet'),
    options: ChartOptionsSchema.optional().describe('Chart options (title, subtitle, legend, colors, 3D, stacking, etc.)'),
});
const SuggestChartActionSchema = CommonFieldsSchema.extend({
    action: z.literal('suggest_chart').describe('Get AI-powered chart suggestions for data range'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    range: RangeInputSchema.describe('Data range to analyze for suggestions'),
    maxSuggestions: z
        .number()
        .int()
        .min(1)
        .max(5)
        .optional()
        .default(3)
        .describe('Number of suggestions to return (default: 3)'),
});
const ChartUpdateActionSchema = CommonFieldsSchema.extend({
    action: z.literal('chart_update').describe('Update an existing chart'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    chartId: z.coerce.number().int().describe('Numeric chart ID to update'),
    chartType: ChartTypeSchema.optional().describe('New chart type'),
    data: ChartDataSchema.optional().describe('New chart data source'),
    position: ChartPositionSchema.optional().describe('New chart position'),
    options: ChartOptionsSchema.optional().describe('New chart options'),
});
const ChartDeleteActionSchema = CommonFieldsSchema.extend({
    action: z.literal('chart_delete').describe('Delete a chart'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    chartId: z.coerce.number().int().describe('Numeric chart ID to delete'),
});
const ChartListActionSchema = CommonFieldsSchema.extend({
    action: z.literal('chart_list').describe('List all charts in a spreadsheet'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    sheetId: SheetIdSchema.optional().describe('Optional sheet ID to filter charts'),
});
const ChartGetActionSchema = CommonFieldsSchema.extend({
    action: z.literal('chart_get').describe('Get details of a specific chart'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    chartId: z.coerce.number().int().describe('Numeric chart ID to retrieve'),
});
const ChartMoveActionSchema = CommonFieldsSchema.extend({
    action: z.literal('chart_move').describe('Move a chart to a new position'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    chartId: z.coerce.number().int().describe('Numeric chart ID to move'),
    position: ChartPositionSchema.describe('New chart position'),
});
const ChartResizeActionSchema = CommonFieldsSchema.extend({
    action: z.literal('chart_resize').describe('Resize a chart'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    chartId: z.coerce.number().int().describe('Numeric chart ID to resize'),
    width: z.coerce.number().positive().describe('Width in pixels (must be positive)'),
    height: z.coerce.number().positive().describe('Height in pixels (must be positive)'),
});
const ChartUpdateDataRangeActionSchema = CommonFieldsSchema.extend({
    action: z.literal('chart_update_data_range').describe("Update a chart's data range"),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    chartId: z.coerce.number().int().describe('Numeric chart ID to update'),
    data: ChartDataSchema.describe('New chart data source'),
});
// ===== PIVOT ACTION SCHEMAS (7 actions) =====
const PivotCreateActionSchema = CommonFieldsSchema.extend({
    action: z.literal('pivot_create').describe('Create a new pivot table'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    sourceRange: RangeInputSchema.describe('Source data range for the pivot table (A1 notation or semantic)'),
    values: z.array(PivotValueSchema).min(1).describe('Value aggregations (at least one required)'),
    rows: z.array(PivotGroupSchema).optional().describe('Row groupings for the pivot table'),
    columns: z.array(PivotGroupSchema).optional().describe('Column groupings for the pivot table'),
    filters: z.array(PivotFilterSchema).optional().describe('Filter criteria for the pivot table'),
    destinationSheetId: SheetIdSchema.optional().describe('Sheet ID for pivot table destination (omit = new sheet)'),
    destinationCell: z
        .string()
        .regex(/^[A-Z]{1,3}\d+$/, 'Invalid cell reference format (expected: A1, AA1, AAA1)')
        .optional()
        .default('A1')
        .describe('Top-left cell for pivot table (default: A1)'),
});
const SuggestPivotActionSchema = CommonFieldsSchema.extend({
    action: z.literal('suggest_pivot').describe('Get AI-powered pivot table suggestions'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    range: RangeInputSchema.describe('Data range to analyze for suggestions'),
    maxSuggestions: z
        .number()
        .int()
        .min(1)
        .max(5)
        .optional()
        .default(3)
        .describe('Number of suggestions to return (default: 3)'),
});
const PivotUpdateActionSchema = CommonFieldsSchema.extend({
    action: z.literal('pivot_update').describe('Update an existing pivot table'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    sheetId: SheetIdSchema.describe('Numeric sheet ID containing the pivot table'),
    rows: z.array(PivotGroupSchema).optional().describe('New row groupings'),
    columns: z.array(PivotGroupSchema).optional().describe('New column groupings'),
    values: z.array(PivotValueSchema).optional().describe('New value aggregations'),
    filters: z.array(PivotFilterSchema).optional().describe('New filter criteria'),
});
const PivotDeleteActionSchema = CommonFieldsSchema.extend({
    action: z.literal('pivot_delete').describe('Delete a pivot table'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    sheetId: SheetIdSchema.describe('Numeric sheet ID containing the pivot table'),
});
const PivotListActionSchema = CommonFieldsSchema.extend({
    action: z.literal('pivot_list').describe('List all pivot tables in a spreadsheet'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
});
const PivotGetActionSchema = CommonFieldsSchema.extend({
    action: z.literal('pivot_get').describe('Get details of a specific pivot table'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    sheetId: SheetIdSchema.describe('Numeric sheet ID containing the pivot table'),
});
const PivotRefreshActionSchema = CommonFieldsSchema.extend({
    action: z.literal('pivot_refresh').describe('Refresh a pivot table with latest data'),
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    sheetId: SheetIdSchema.describe('Numeric sheet ID containing the pivot table'),
});
/**
 * All visualization operation inputs (charts and pivot tables)
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 * - JSON Schema conversion handled by src/utils/schema-compat.ts
 */
export const SheetsVisualizeInputSchema = z.object({
    request: z.discriminatedUnion('action', [
        // Chart actions (9)
        ChartCreateActionSchema,
        SuggestChartActionSchema,
        ChartUpdateActionSchema,
        ChartDeleteActionSchema,
        ChartListActionSchema,
        ChartGetActionSchema,
        ChartMoveActionSchema,
        ChartResizeActionSchema,
        ChartUpdateDataRangeActionSchema,
        // Pivot actions (7)
        PivotCreateActionSchema,
        SuggestPivotActionSchema,
        PivotUpdateActionSchema,
        PivotDeleteActionSchema,
        PivotListActionSchema,
        PivotGetActionSchema,
        PivotRefreshActionSchema,
    ]),
});
// ============================================================================
// CONSOLIDATED OUTPUT SCHEMA
// ============================================================================
const VisualizeResponseSchema = z.discriminatedUnion('success', [
    z.object({
        success: z.literal(true),
        action: z.string(),
        // Chart-specific response fields
        chartId: z.coerce.number().int().optional().describe('Chart ID (for chart actions)'),
        charts: z
            .array(z.object({
            chartId: z.coerce.number().int(),
            chartType: z.string(),
            sheetId: z.coerce.number().int(),
            title: z.string().optional(),
            position: ChartPositionSchema,
        }))
            .optional()
            .describe('List of charts (for chart_list action)'),
        // Pivot-specific response fields
        pivotTable: z
            .object({
            sheetId: z.coerce.number().int(),
            sourceRange: GridRangeSchema,
            rowGroups: z.coerce.number().int(),
            columnGroups: z.coerce.number().int(),
            values: z.coerce.number().int(),
        })
            .optional()
            .describe('Pivot table details (for pivot actions)'),
        pivotTables: z
            .array(z.object({
            sheetId: z.coerce.number().int(),
            title: z.string(),
        }))
            .optional()
            .describe('List of pivot tables (for pivot_list action)'),
        // Shared suggestion fields
        suggestions: z
            .array(z.union([
            // Chart suggestions
            z.object({
                chartType: ChartTypeSchema,
                title: z.string(),
                explanation: z.string(),
                confidence: z.coerce.number().min(0).max(100),
                reasoning: z.string(),
                dataMapping: z.object({
                    seriesColumns: z.array(z.coerce.number().int()).optional(),
                    categoryColumn: z.coerce.number().int().optional(),
                }),
            }),
            // Pivot suggestions
            z.object({
                title: z.string(),
                explanation: z.string(),
                confidence: z.coerce.number().min(0).max(100),
                reasoning: z.string(),
                configuration: z.object({
                    rowGroupColumns: z
                        .array(z.coerce.number().int())
                        .describe('Column indices to group by rows'),
                    columnGroupColumns: z
                        .array(z.coerce.number().int())
                        .optional()
                        .describe('Column indices to group by columns'),
                    valueColumns: z
                        .array(z.object({
                        columnIndex: z.coerce.number().int(),
                        function: SummarizeFunctionSchema,
                    }))
                        .describe('Columns to aggregate and their functions'),
                }),
            }),
        ]))
            .optional()
            .describe('Visualization suggestions (for suggest_chart, suggest_pivot actions)'),
        // Common response fields
        dryRun: z.boolean().optional(),
        mutation: MutationSummarySchema.optional(),
        snapshotId: z.string().optional().describe('Snapshot ID for rollback (if created)'),
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
export const SHEETS_VISUALIZE_ANNOTATIONS = {
    title: 'Visualizations (Charts & Pivot Tables)',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
};
//# sourceMappingURL=visualize.js.map