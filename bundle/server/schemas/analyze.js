/**
 * Tool: sheets_analyze (CONSOLIDATED - PURE ANALYSIS)
 *
 * Ultimate analysis tool combining traditional statistics + AI-powered insights.
 * Consolidates legacy sheets_analysis into sheets_analyze (11 actions)
 * into a single intelligent tool with 11 actions and smart routing.
 *
 * DESIGN PRINCIPLE: This tool ANALYZES data and provides recommendations.
 * It does NOT create or modify spreadsheets. Recommendations include executable
 * parameters that other tools (sheets_visualize) can use directly.
 *
 * Features:
 * - Fast path: Traditional statistics for <10K rows (0.5-2s)
 * - AI path: LLM-powered insights via MCP Sampling for complex analysis (3-15s)
 * - Streaming path: Task-enabled chunked processing for >50K rows (async)
 * - Tiered retrieval: 4-level data fetching (metadata/structure/sample/full)
 * - 43-category extraction: Systematic feature extraction
 * - Executable recommendations: Ready-to-use params for creation tools
 *
 * @see MCP_PROTOCOL_COMPLETE_REFERENCE.md - Sampling, Tasks
 * @see MCP_SEP_SPECIFICATIONS_COMPLETE.md - SEP-1577
 */
import { z } from 'zod';
import { SpreadsheetIdSchema, SheetIdSchema, RangeInputSchema, ChartPositionSchema, LegendPositionSchema, ColorSchema, SummarizeFunctionSchema, SortOrderSchema, ErrorDetailSchema, ResponseMetaSchema, } from './shared.js';
/**
 * Analysis types available
 */
const AnalysisTypeSchema = z.enum([
    'summary', // Overall data summary
    'patterns', // Pattern recognition
    'anomalies', // Outlier/anomaly detection
    'trends', // Trend analysis
    'quality', // Data quality assessment
    'correlations', // Relationship discovery
    'recommendations', // Actionable recommendations
]);
/**
 * Data quality issue schema (from sheets_analyze) - Enhanced with executable fixes
 */
const DataQualityIssueSchema = z.object({
    type: z.enum([
        'EMPTY_HEADER',
        'DUPLICATE_HEADER',
        'MIXED_DATA_TYPES',
        'EMPTY_ROW',
        'EMPTY_COLUMN',
        'TRAILING_WHITESPACE',
        'LEADING_WHITESPACE',
        'INCONSISTENT_FORMAT',
        'STATISTICAL_OUTLIER',
        'MISSING_VALUE',
        'DUPLICATE_ROW',
        'INVALID_EMAIL',
        'INVALID_URL',
        'INVALID_DATE',
        'FORMULA_ERROR',
    ]),
    severity: z.enum(['low', 'medium', 'high']),
    location: z.string(),
    description: z.string(),
    autoFixable: z.boolean(),
    fixTool: z.string().optional(),
    fixAction: z.string().optional(),
    fixParams: z.record(z.string(), z.unknown()).optional(),
    // NEW: Ready-to-execute fix parameters
    executableFix: z
        .object({
        tool: z.string().describe('Tool to use for fix (e.g., sheets_fix, sheets_data)'),
        action: z.string().describe('Action to perform'),
        params: z.record(z.string(), z.unknown()).describe('Complete parameters ready to execute'),
        description: z.string().describe('Human-readable fix description'),
        estimatedTime: z.string().optional().describe('Estimated time to complete fix'),
    })
        .optional()
        .describe('Fully parameterized fix that can be executed immediately'),
});
/**
 * Template detection schema (NEW for Phase 3)
 */
const TemplateDetectionSchema = z.object({
    detectedType: z.enum([
        'budget',
        'invoice',
        'expense_report',
        'crm',
        'project_tracker',
        'inventory',
        'time_sheet',
        'sales_report',
        'dashboard',
        'data_entry',
        'custom',
        'unknown',
    ]),
    confidence: z.coerce.number().min(0).max(100),
    characteristics: z.array(z.string()).describe('Key characteristics that match the template'),
    recommendations: z
        .array(z.object({
        type: z.enum(['formula', 'formatting', 'validation', 'chart', 'pivot', 'structure']),
        suggestion: z.string(),
        benefit: z.string(),
        executionParams: z.record(z.string(), z.unknown()).optional(),
    }))
        .optional()
        .describe('Template-specific recommendations to enhance the spreadsheet'),
    missingFeatures: z
        .array(z.string())
        .optional()
        .describe('Common features of this template type that are missing'),
});
/**
 * Performance recommendation schema (NEW)
 */
export const PerformanceRecommendationSchema = z.object({
    type: z.enum([
        'VOLATILE_FORMULAS',
        'EXCESSIVE_FORMULAS',
        'LARGE_RANGES',
        'CIRCULAR_REFERENCES',
        'INEFFICIENT_STRUCTURE',
        'TOO_MANY_SHEETS',
    ]),
    severity: z.enum(['low', 'medium', 'high']),
    description: z.string(),
    estimatedImpact: z.string(),
    recommendation: z.string(),
    executableFix: z
        .object({
        tool: z.string(),
        action: z.string(),
        params: z.record(z.string(), z.unknown()),
        description: z.string(),
    })
        .optional()
        .describe('Ready-to-execute optimization'),
});
// ============================================================================
// INPUT SCHEMA (11 actions)
// ============================================================================
const CommonFieldsSchema = z.object({
    spreadsheetId: SpreadsheetIdSchema.describe('Spreadsheet ID from URL'),
    verbosity: z
        .enum(['minimal', 'standard', 'detailed'])
        .optional()
        .default('standard')
        .describe('Response detail level: minimal (essential info only, ~40% less tokens), standard (balanced), detailed (full metadata)'),
    sheetId: SheetIdSchema.optional().describe('Sheet ID for analysis'),
});
// ===== CORE ACTIONS (5 actions) =====
const ComprehensiveActionSchema = CommonFieldsSchema.extend({
    action: z
        .literal('comprehensive')
        .describe('Complete analysis replacing separate sheets_core + sheets_data + sheets_analyze calls'),
    range: RangeInputSchema.optional().describe('Range to analyze'),
    includeFormulas: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include formula analysis and optimization suggestions'),
    includeVisualizations: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include visualization recommendations with executable params'),
    includePerformance: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include performance analysis and optimization recommendations'),
    forceFullData: z
        .boolean()
        .optional()
        .default(false)
        .describe('Force full data retrieval instead of sampling'),
    samplingThreshold: z
        .number()
        .int()
        .positive()
        .optional()
        .default(10000)
        .describe('Row count threshold before sampling kicks in'),
    sampleSize: z
        .number()
        .int()
        .positive()
        .max(5000)
        .optional()
        .default(500)
        .describe('Sample size when sampling is used'),
    cursor: z
        .string()
        .optional()
        .describe('Pagination cursor for comprehensive analysis (format: "sheet:N" where N is sheet index)'),
    pageSize: z
        .number()
        .int()
        .positive()
        .min(1)
        .max(50)
        .optional()
        .default(5)
        .describe('Number of sheets to return per page'),
    context: z.string().optional().describe('Additional context for analysis'),
});
const AnalyzeDataActionSchema = CommonFieldsSchema.extend({
    action: z.literal('analyze_data').describe('Smart routing (stats OR AI)'),
    range: RangeInputSchema.optional().describe('Range to analyze'),
    analysisTypes: z
        .array(AnalysisTypeSchema)
        .min(1)
        .optional()
        .default(['summary', 'quality'])
        .describe('Types of analysis to perform'),
    useAI: z.boolean().optional().describe('Force AI-powered analysis via MCP Sampling'),
    context: z.string().optional().describe('Additional context for the analysis'),
    maxTokens: z
        .number()
        .int()
        .positive()
        .max(8192)
        .optional()
        .describe('Maximum tokens for AI response (default: 4096)'),
});
const SuggestVisualizationActionSchema = CommonFieldsSchema.extend({
    action: z
        .literal('suggest_visualization')
        .describe('Unified chart/pivot recommendations with executable params'),
    range: RangeInputSchema.describe('Range to analyze for visualization suggestions'),
    goal: z
        .string()
        .optional()
        .describe('Visualization goal, e.g., "show trends", "compare categories"'),
    preferredTypes: z.array(z.string()).optional().describe('Preferred chart/pivot types'),
    includeCharts: z.boolean().optional().default(true).describe('Include chart recommendations'),
    includePivots: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include pivot table recommendations'),
});
const GenerateFormulaActionSchema = CommonFieldsSchema.extend({
    action: z.literal('generate_formula').describe('Formula generation with context'),
    description: z.string().min(1).describe('Natural language description of the formula'),
    range: RangeInputSchema.optional().describe('Range for formula context'),
    targetCell: z.string().optional().describe('Target cell for formula context'),
    includeExplanation: z.boolean().optional().default(true).describe('Include formula explanation'),
});
const DetectPatternsActionSchema = CommonFieldsSchema.extend({
    action: z.literal('detect_patterns').describe('Anomalies, trends, correlations'),
    range: RangeInputSchema.describe('Range to analyze for patterns'),
    includeCorrelations: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include correlation analysis'),
    includeTrends: z.boolean().optional().default(true).describe('Include trend detection'),
    includeSeasonality: z
        .boolean()
        .optional()
        .default(false)
        .describe('Include seasonality patterns'),
    includeAnomalies: z.boolean().optional().default(true).describe('Include anomaly detection'),
});
// ===== SPECIALIZED ACTIONS (4 actions) =====
const AnalyzeStructureActionSchema = CommonFieldsSchema.extend({
    action: z.literal('analyze_structure').describe('Schema, types, relationships'),
    range: RangeInputSchema.optional().describe('Range to analyze'),
    detectTables: z.boolean().optional().default(true).describe('Detect table structures'),
    detectHeaders: z.boolean().optional().default(true).describe('Detect header rows'),
});
const AnalyzeQualityActionSchema = CommonFieldsSchema.extend({
    action: z.literal('analyze_quality').describe('Nulls, duplicates, outliers'),
    range: RangeInputSchema.optional().describe('Range to analyze'),
    checks: z
        .array(z.enum([
        'headers',
        'data_types',
        'empty_cells',
        'duplicates',
        'outliers',
        'formatting',
        'validation',
    ]))
        .optional()
        .describe('Quality checks to perform'),
    outlierMethod: z.enum(['iqr', 'zscore', 'modified_zscore']).optional().default('iqr'),
    outlierThreshold: z.coerce.number().optional().default(1.5),
});
const AnalyzePerformanceActionSchema = CommonFieldsSchema.extend({
    action: z.literal('analyze_performance').describe('Optimization suggestions'),
    range: RangeInputSchema.optional().describe('Range to analyze'),
});
const AnalyzeFormulasActionSchema = CommonFieldsSchema.extend({
    action: z.literal('analyze_formulas').describe('Formula analysis and optimization'),
    range: RangeInputSchema.optional().describe('Range to analyze'),
    includeOptimizations: z
        .boolean()
        .optional()
        .default(true)
        .describe('Include optimization suggestions'),
    includeComplexity: z.boolean().optional().default(true).describe('Include complexity scoring'),
});
// ===== INTELLIGENCE ACTIONS (2 actions) =====
const QueryNaturalLanguageActionSchema = CommonFieldsSchema.extend({
    action: z.literal('query_natural_language').describe('Conversational data queries'),
    query: z.string().describe('Natural language query'),
    range: RangeInputSchema.optional().describe('Range for query context'),
    conversationId: z.string().optional().describe('Conversation ID for multi-turn queries'),
});
const ExplainAnalysisActionSchema = z
    .object({
    action: z.literal('explain_analysis').describe('Conversational explanations'),
    analysisResult: z
        .record(z.string(), z.unknown())
        .optional()
        .describe('Previous analysis result to explain'),
    question: z.string().optional().describe('Specific question about the analysis'),
    spreadsheetId: SpreadsheetIdSchema.optional().describe('Spreadsheet ID (optional for context)'),
    sheetId: SheetIdSchema.optional().describe('Sheet ID (optional for context)'),
    context: z.string().optional().describe('Additional context'),
    verbosity: z
        .enum(['minimal', 'standard', 'detailed'])
        .optional()
        .default('standard')
        .describe('Response detail level'),
})
    .refine((data) => !!data.analysisResult || !!data.question, {
    message: 'Either analysisResult or question must be provided',
});
/**
 * All analysis operation inputs
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 * - JSON Schema conversion handled by src/utils/schema-compat.ts
 */
export const SheetsAnalyzeInputSchema = z.object({
    request: z.discriminatedUnion('action', [
        // Core actions (5)
        ComprehensiveActionSchema,
        AnalyzeDataActionSchema,
        SuggestVisualizationActionSchema,
        GenerateFormulaActionSchema,
        DetectPatternsActionSchema,
        // Specialized actions (4)
        AnalyzeStructureActionSchema,
        AnalyzeQualityActionSchema,
        AnalyzePerformanceActionSchema,
        AnalyzeFormulasActionSchema,
        // Intelligence actions (2)
        QueryNaturalLanguageActionSchema,
        ExplainAnalysisActionSchema,
    ]),
});
/**
 * Analysis finding schema
 */
const AnalysisFindingSchema = z.object({
    type: AnalysisTypeSchema,
    confidence: z.enum(['high', 'medium', 'low']),
    findings: z.array(z.string()),
    details: z.string(),
    affectedCells: z.array(z.string()).optional(),
    recommendations: z.array(z.string()).optional(),
});
/**
 * Formula suggestion schema
 */
const FormulaSuggestionSchema = z.object({
    formula: z.string(),
    explanation: z.string(),
    assumptions: z.array(z.string()).optional(),
    alternatives: z
        .array(z.object({
        formula: z.string(),
        useCase: z.string(),
    }))
        .optional(),
    tips: z.array(z.string()).optional(),
});
/**
 * Chart recommendation schema with executable parameters
 */
const ChartRecommendationSchema = z.object({
    chartType: z.string(),
    suitabilityScore: z.coerce.number().min(0).max(100),
    reasoning: z.string(),
    configuration: z
        .object({
        categories: z.string().optional(),
        series: z.array(z.string()).optional(),
        stacked: z.boolean().optional(),
        title: z.string().optional(),
    })
        .optional(),
    insights: z.array(z.string()).optional(),
    // NEW: Executable parameters for sheets_visualize tool
    executionParams: z
        .object({
        tool: z.literal('sheets_visualize'),
        action: z.literal('chart_create'),
        params: z.object({
            spreadsheetId: z.string(),
            sheetId: z.coerce.number().int(),
            chartType: z.string(),
            data: z.object({
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
            }),
            position: ChartPositionSchema,
            options: z
                .object({
                title: z.string().optional(),
                legendPosition: LegendPositionSchema.optional(),
                axisTitle: z
                    .object({
                    horizontal: z.string().optional(),
                    vertical: z.string().optional(),
                })
                    .optional(),
            })
                .optional(),
        }),
    })
        .describe('Ready-to-execute parameters for sheets_visualize:chart_create action'),
});
/**
 * Pivot table recommendation schema with executable parameters
 */
const PivotRecommendationSchema = z.object({
    confidence: z.coerce.number().min(0).max(100),
    reasoning: z.string(),
    configuration: z.object({
        rows: z.array(z.string()),
        columns: z.array(z.string()),
        values: z.array(z.object({
            field: z.string(),
            aggregation: z.enum(['SUM', 'AVERAGE', 'COUNT', 'MIN', 'MAX']),
        })),
    }),
    sourceRange: z.string(),
    // NEW: Executable parameters for sheets_visualize tool
    executionParams: z
        .object({
        tool: z.literal('sheets_visualize'),
        action: z.literal('pivot_create'),
        params: z.object({
            spreadsheetId: z.string(),
            sourceRange: RangeInputSchema,
            values: z
                .array(z.object({
                sourceColumnOffset: z.coerce.number().int().min(0),
                summarizeFunction: SummarizeFunctionSchema,
                name: z.string().optional(),
                calculatedDisplayType: z
                    .enum(['PERCENT_OF_ROW_TOTAL', 'PERCENT_OF_COLUMN_TOTAL', 'PERCENT_OF_GRAND_TOTAL'])
                    .optional(),
            }))
                .min(1),
            rows: z
                .array(z.object({
                sourceColumnOffset: z.coerce.number().int().min(0),
                sortOrder: SortOrderSchema.optional(),
                showTotals: z.boolean().optional(),
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
            }))
                .optional(),
            columns: z
                .array(z.object({
                sourceColumnOffset: z.coerce.number().int().min(0),
                sortOrder: SortOrderSchema.optional(),
                showTotals: z.boolean().optional(),
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
            }))
                .optional(),
            filters: z
                .array(z.object({
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
            }))
                .optional(),
            destinationSheetId: z.coerce.number().int().optional(),
            destinationCell: z.string().optional(),
        }),
    })
        .describe('Ready-to-execute parameters for sheets_visualize:pivot_create action'),
});
/**
 * Structure analysis result (from sheets_analyze)
 */
const StructureAnalysisSchema = z.object({
    sheets: z.coerce.number().int(),
    totalRows: z.coerce.number().int(),
    totalColumns: z.coerce.number().int(),
    tables: z
        .array(z.object({
        sheetId: z.coerce.number().int(),
        range: z.string(),
        headers: z.array(z.string()),
        rowCount: z.coerce.number().int(),
    }))
        .optional(),
    namedRanges: z
        .array(z.object({
        name: z.string(),
        range: z.string(),
    }))
        .optional(),
});
/**
 * Pattern detection result (from sheets_analyze + AI)
 */
const PatternDetectionSchema = z.object({
    correlations: z
        .object({
        matrix: z.array(z.array(z.coerce.number())),
        columns: z.array(z.string()),
    })
        .optional(),
    trends: z
        .array(z.object({
        column: z.string(),
        direction: z.enum(['increasing', 'decreasing', 'stable', 'seasonal']),
        confidence: z.coerce.number().min(0).max(100),
        description: z.string(),
    }))
        .optional(),
    anomalies: z
        .array(z.object({
        location: z.string(),
        value: z.union([z.string(), z.coerce.number()]),
        expectedRange: z.string().optional(),
        severity: z.enum(['low', 'medium', 'high']),
    }))
        .optional(),
    seasonality: z
        .object({
        detected: z.boolean(),
        period: z.coerce.number().optional(),
        confidence: z.coerce.number().optional(),
    })
        .optional(),
});
/**
 * Response schema (consolidated)
 */
const AnalyzeResponseSchema = z.discriminatedUnion('success', [
    z.object({
        success: z.literal(true),
        action: z.string(),
        // analyze_data results
        summary: z.string().optional(),
        analyses: z.array(AnalysisFindingSchema).optional(),
        overallQualityScore: z.coerce.number().min(0).max(100).optional(),
        topInsights: z.array(z.string()).optional(),
        executionPath: z
            .enum(['fast', 'ai', 'streaming', 'sample', 'full'])
            .optional()
            .describe('Path used for analysis'),
        // suggest_visualization results
        chartRecommendations: z.array(ChartRecommendationSchema).optional(),
        pivotRecommendations: z.array(PivotRecommendationSchema).optional(),
        dataAssessment: z
            .object({
            dataType: z.string(),
            rowCount: z.coerce.number(),
            columnCount: z.coerce.number(),
            hasHeaders: z.boolean(),
        })
            .optional(),
        // generate_formula results
        formula: FormulaSuggestionSchema.optional(),
        // detect_patterns results
        patterns: PatternDetectionSchema.optional(),
        // analyze_structure results
        structure: StructureAnalysisSchema.optional(),
        // template detection results (Phase 3)
        templateDetection: TemplateDetectionSchema.optional(),
        // analyze_quality results
        dataQuality: z
            .object({
            score: z.coerce.number().min(0).max(100),
            completeness: z.coerce.number().min(0).max(100),
            consistency: z.coerce.number().min(0).max(100),
            accuracy: z.coerce.number().min(0).max(100),
            issues: z.array(DataQualityIssueSchema),
            summary: z.string(),
        })
            .optional(),
        // analyze_performance results (and comprehensive)
        performance: z
            .object({
            overallScore: z.coerce.number().min(0).max(100).optional(),
            score: z.coerce.number().min(0).max(100).optional(), // Comprehensive uses 'score'
            recommendations: z.array(z.any()), // Allow different recommendation formats
            estimatedImprovementPotential: z.string().optional(),
        })
            .optional(),
        // analyze_formulas results
        formulaAnalysis: z
            .object({
            totalFormulas: z.coerce.number(),
            complexityDistribution: z.record(z.string(), z.coerce.number()),
            volatileFormulas: z.array(z.object({
                cell: z.string(),
                formula: z.string(),
                volatileFunctions: z.array(z.string()),
                impact: z.enum(['low', 'medium', 'high']),
                suggestion: z.string(),
            })),
            optimizationOpportunities: z.array(z.object({
                type: z.string(),
                priority: z.enum(['low', 'medium', 'high']),
                affectedCells: z.array(z.string()),
                currentFormula: z.string(),
                suggestedFormula: z.string(),
                reasoning: z.string(),
            })),
            circularReferences: z
                .array(z.object({
                cells: z.array(z.string()),
                chain: z.string(),
            }))
                .optional(),
        })
            .optional(),
        // query_natural_language results
        queryResult: z
            .object({
            query: z.string(),
            answer: z.string(),
            intent: z.object({
                type: z.string(),
                confidence: z.coerce.number(),
            }),
            data: z
                .object({
                headers: z.array(z.string()),
                rows: z.array(z.array(z.unknown())),
            })
                .optional(),
            visualizationSuggestion: z
                .object({
                chartType: z.string(),
                reasoning: z.string(),
            })
                .optional(),
            followUpQuestions: z.array(z.string()),
        })
            .optional(),
        // explain_analysis results
        explanation: z.string().optional(),
        // comprehensive results
        spreadsheet: z
            .object({
            id: z.string(),
            title: z.string(),
            locale: z.string(),
            timeZone: z.string(),
            lastModified: z.string().optional(),
            owner: z.string().optional(),
            sheetCount: z.coerce.number(),
            totalRows: z.coerce.number(),
            totalColumns: z.coerce.number(),
            totalCells: z.coerce.number(),
            namedRanges: z.array(z.object({ name: z.string(), range: z.string() })),
        })
            .optional(),
        sheets: z
            .array(z.object({
            sheetId: z.coerce.number(),
            sheetName: z.string(),
            rowCount: z.coerce.number(),
            columnCount: z.coerce.number(),
            dataRowCount: z.coerce.number(),
            columns: z.array(z.any()), // Column stats - detailed type omitted for brevity
            qualityScore: z.coerce.number(),
            completeness: z.coerce.number(),
            consistency: z.coerce.number(),
            issues: z.array(z.any()), // Quality issues
            trends: z.array(z.any()), // Trend results
            anomalies: z.array(z.any()), // Anomaly results
            correlations: z.array(z.any()), // Correlation results
            formulas: z
                .object({
                total: z.coerce.number(),
                unique: z.coerce.number(),
                volatile: z.coerce.number(),
                complex: z.coerce.number(),
                issues: z.array(z.any()),
            })
                .optional(),
        }))
            .optional(),
        aggregate: z
            .object({
            totalDataRows: z.coerce.number(),
            totalFormulas: z.coerce.number(),
            overallQualityScore: z.coerce.number(),
            overallCompleteness: z.coerce.number(),
            totalIssues: z.coerce.number(),
            totalAnomalies: z.coerce.number(),
            totalTrends: z.coerce.number(),
            totalCorrelations: z.coerce.number(),
        })
            .optional(),
        visualizations: z
            .array(z.object({
            chartType: z.string(),
            suitabilityScore: z.coerce.number(),
            reasoning: z.string(),
            suggestedConfig: z.any(),
            executionParams: z.any(),
        }))
            .optional(),
        apiCalls: z.coerce.number().optional(),
        dataRetrieved: z
            .object({
            tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
            rowsAnalyzed: z.coerce.number(),
            samplingUsed: z.boolean(),
        })
            .optional(),
        // Pagination fields (MCP 2025-11-25 - comprehensive only)
        nextCursor: z
            .string()
            .optional()
            .describe('Next page cursor for pagination (format: "sheet:N")'),
        hasMore: z.boolean().optional().describe('True if more sheets available'),
        resourceUri: z
            .string()
            .optional()
            .describe('Resource URI when response is too large (analyze://results/{id})'),
        // Common
        duration: z.coerce.number().optional(),
        message: z.string().optional(),
        _meta: ResponseMetaSchema.optional(),
    }),
    z.object({
        success: z.literal(false),
        error: ErrorDetailSchema,
    }),
]);
export const SheetsAnalyzeOutputSchema = z.object({
    response: AnalyzeResponseSchema,
});
/**
 * Tool annotations following MCP 2025-11-25
 */
export const SHEETS_ANALYZE_ANNOTATIONS = {
    title: 'Ultimate Data Analysis',
    readOnlyHint: true, // Pure analysis - does not modify spreadsheets
    destructiveHint: false, // Analysis is non-destructive
    idempotentHint: false, // AI responses may vary
    openWorldHint: true, // Uses MCP Sampling + Google API
};
//# sourceMappingURL=analyze.js.map