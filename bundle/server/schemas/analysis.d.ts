/**
 * Tool 14: sheets_analysis (DEPRECATED)
 *
 * ⚠️ DEPRECATION NOTICE ⚠️
 * This tool is deprecated and will be removed in a future version.
 * Please migrate to the consolidated `sheets_analyze` tool which provides:
 * - All functionality from sheets_analysis + sheets_analyze
 * - Intelligent routing (fast/AI/streaming paths)
 * - Enhanced AI-powered insights
 * - Auto-creation workflows for charts and pivots
 *
 * Migration guide:
 * - data_quality → analyze_quality
 * - formula_audit → (removed, use analyze_quality)
 * - structure_analysis → analyze_structure
 * - statistics → (removed, use analyze_data)
 * - correlations → detect_patterns (with includeCorrelations:true)
 * - summary → analyze_data
 * - dependencies → (removed)
 * - compare_ranges → (removed)
 * - detect_patterns → detect_patterns
 * - column_analysis → analyze_data
 * - suggest_templates → (removed)
 * - generate_formula → generate_formula
 * - suggest_chart → suggest_visualization
 *
 * Data quality and formula analysis (READ-ONLY)
 *
 * @deprecated Use sheets_analyze instead
 */
import { z } from 'zod';
import { type ToolAnnotations } from './shared.js';
export declare const SheetsAnalysisInputSchema: z.ZodObject<{
    action: z.ZodEnum<{
        summary: "summary";
        suggest_chart: "suggest_chart";
        generate_formula: "generate_formula";
        detect_patterns: "detect_patterns";
        correlations: "correlations";
        data_quality: "data_quality";
        formula_audit: "formula_audit";
        structure_analysis: "structure_analysis";
        statistics: "statistics";
        dependencies: "dependencies";
        compare_ranges: "compare_ranges";
        column_analysis: "column_analysis";
        suggest_templates: "suggest_templates";
    }>;
    spreadsheetId: z.ZodOptional<z.ZodString>;
    sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    range: z.ZodOptional<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
        a1: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        namedRange: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        semantic: z.ZodObject<{
            sheet: z.ZodString;
            column: z.ZodString;
            includeHeader: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            rowStart: z.ZodOptional<z.ZodNumber>;
            rowEnd: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        grid: z.ZodObject<{
            sheetId: z.ZodCoercedNumber<unknown>;
            startRowIndex: z.ZodOptional<z.ZodNumber>;
            endRowIndex: z.ZodOptional<z.ZodNumber>;
            startColumnIndex: z.ZodOptional<z.ZodNumber>;
            endColumnIndex: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
    }, z.core.$strip>]>>>;
    checks: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        headers: "headers";
        data_types: "data_types";
        empty_cells: "empty_cells";
        duplicates: "duplicates";
        outliers: "outliers";
        formatting: "formatting";
        validation: "validation";
        performance: "performance";
        volatile: "volatile";
        complex: "complex";
        circular: "circular";
        broken: "broken";
        hardcoded: "hardcoded";
        inconsistent: "inconsistent";
    }>>>;
    outlierMethod: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        iqr: "iqr";
        zscore: "zscore";
        modified_zscore: "modified_zscore";
    }>>>;
    outlierThreshold: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    useAI: z.ZodOptional<z.ZodBoolean>;
    complexityThreshold: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    detectTables: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    detectHeaders: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    columns: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    method: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        pearson: "pearson";
        spearman: "spearman";
    }>>>;
    cell: z.ZodOptional<z.ZodString>;
    direction: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        precedents: "precedents";
        dependents: "dependents";
        both: "both";
    }>>>;
    range1: z.ZodOptional<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
        a1: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        namedRange: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        semantic: z.ZodObject<{
            sheet: z.ZodString;
            column: z.ZodString;
            includeHeader: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            rowStart: z.ZodOptional<z.ZodNumber>;
            rowEnd: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        grid: z.ZodObject<{
            sheetId: z.ZodCoercedNumber<unknown>;
            startRowIndex: z.ZodOptional<z.ZodNumber>;
            endRowIndex: z.ZodOptional<z.ZodNumber>;
            startColumnIndex: z.ZodOptional<z.ZodNumber>;
            endColumnIndex: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
    }, z.core.$strip>]>>>;
    range2: z.ZodOptional<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
        a1: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        namedRange: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        semantic: z.ZodObject<{
            sheet: z.ZodString;
            column: z.ZodString;
            includeHeader: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            rowStart: z.ZodOptional<z.ZodNumber>;
            rowEnd: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        grid: z.ZodObject<{
            sheetId: z.ZodCoercedNumber<unknown>;
            startRowIndex: z.ZodOptional<z.ZodNumber>;
            endRowIndex: z.ZodOptional<z.ZodNumber>;
            startColumnIndex: z.ZodOptional<z.ZodNumber>;
            endColumnIndex: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
    }, z.core.$strip>]>>>;
    compareType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        values: "values";
        structure: "structure";
        both: "both";
    }>>>;
    includeCorrelations: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    includeTrends: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    includeSeasonality: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    includeAnomalies: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    analyzeDistribution: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    detectDataType: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    checkQuality: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    findUnique: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    description: z.ZodOptional<z.ZodString>;
    includeExample: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    maxSuggestions: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    targetCell: z.ZodOptional<z.ZodString>;
    includeExplanation: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    goal: z.ZodOptional<z.ZodString>;
    verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        minimal: "minimal";
        standard: "standard";
        detailed: "detailed";
    }>>>;
}, z.core.$strip>;
export type DataQualityInput = Extract<SheetsAnalysisInput, {
    action: 'data_quality';
}>;
export type FormulaAuditInput = Extract<SheetsAnalysisInput, {
    action: 'formula_audit';
}>;
export type StructureAnalysisInput = Extract<SheetsAnalysisInput, {
    action: 'structure_analysis';
}>;
export type StatisticsInput = Extract<SheetsAnalysisInput, {
    action: 'statistics';
}>;
export type CorrelationsInput = Extract<SheetsAnalysisInput, {
    action: 'correlations';
}>;
export type SummaryInput = Extract<SheetsAnalysisInput, {
    action: 'summary';
}>;
export type DependenciesInput = Extract<SheetsAnalysisInput, {
    action: 'dependencies';
}>;
export type CompareRangesInput = Extract<SheetsAnalysisInput, {
    action: 'compare_ranges';
}>;
export type ColumnAnalysisInput = Extract<SheetsAnalysisInput, {
    action: 'column_analysis';
}>;
export type SuggestTemplatesInput = Extract<SheetsAnalysisInput, {
    action: 'suggest_templates';
}>;
export type AnalysisGenerateFormulaInput = Extract<SheetsAnalysisInput, {
    action: 'generate_formula';
}>;
export type AnalysisSuggestChartInput = Extract<SheetsAnalysisInput, {
    action: 'suggest_chart';
}>;
declare const AnalysisResponseSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    success: z.ZodLiteral<true>;
    action: z.ZodString;
    dataQuality: z.ZodOptional<z.ZodObject<{
        score: z.ZodNumber;
        completeness: z.ZodNumber;
        consistency: z.ZodNumber;
        accuracy: z.ZodNumber;
        issues: z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                FORMULA_ERROR: "FORMULA_ERROR";
                EMPTY_HEADER: "EMPTY_HEADER";
                DUPLICATE_HEADER: "DUPLICATE_HEADER";
                MIXED_DATA_TYPES: "MIXED_DATA_TYPES";
                EMPTY_ROW: "EMPTY_ROW";
                EMPTY_COLUMN: "EMPTY_COLUMN";
                TRAILING_WHITESPACE: "TRAILING_WHITESPACE";
                LEADING_WHITESPACE: "LEADING_WHITESPACE";
                INCONSISTENT_FORMAT: "INCONSISTENT_FORMAT";
                STATISTICAL_OUTLIER: "STATISTICAL_OUTLIER";
                MISSING_VALUE: "MISSING_VALUE";
                DUPLICATE_ROW: "DUPLICATE_ROW";
                INVALID_EMAIL: "INVALID_EMAIL";
                INVALID_URL: "INVALID_URL";
                INVALID_DATE: "INVALID_DATE";
            }>;
            severity: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
            location: z.ZodString;
            description: z.ZodString;
            autoFixable: z.ZodBoolean;
            fixTool: z.ZodOptional<z.ZodString>;
            fixAction: z.ZodOptional<z.ZodString>;
            fixParams: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
        summary: z.ZodString;
    }, z.core.$strip>>;
    formulaAudit: z.ZodOptional<z.ZodObject<{
        score: z.ZodNumber;
        totalFormulas: z.ZodNumber;
        uniqueFormulas: z.ZodNumber;
        issues: z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                CIRCULAR_REFERENCE: "CIRCULAR_REFERENCE";
                BROKEN_REFERENCE: "BROKEN_REFERENCE";
                VOLATILE_FUNCTION: "VOLATILE_FUNCTION";
                COMPLEX_FORMULA: "COMPLEX_FORMULA";
                HARDCODED_VALUE: "HARDCODED_VALUE";
                INCONSISTENT_FORMULA: "INCONSISTENT_FORMULA";
                ARRAY_FORMULA_ISSUE: "ARRAY_FORMULA_ISSUE";
                DEPRECATED_FUNCTION: "DEPRECATED_FUNCTION";
                PERFORMANCE_ISSUE: "PERFORMANCE_ISSUE";
            }>;
            severity: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
            cell: z.ZodString;
            formula: z.ZodString;
            description: z.ZodString;
            suggestion: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        summary: z.ZodString;
    }, z.core.$strip>>;
    structure: z.ZodOptional<z.ZodObject<{
        sheets: z.ZodNumber;
        totalRows: z.ZodNumber;
        totalColumns: z.ZodNumber;
        tables: z.ZodOptional<z.ZodArray<z.ZodObject<{
            sheetId: z.ZodNumber;
            range: z.ZodString;
            headers: z.ZodArray<z.ZodString>;
            rowCount: z.ZodNumber;
        }, z.core.$strip>>>;
        namedRanges: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            range: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    statistics: z.ZodOptional<z.ZodObject<{
        columns: z.ZodArray<z.ZodObject<{
            index: z.ZodNumber;
            name: z.ZodOptional<z.ZodString>;
            count: z.ZodNumber;
            sum: z.ZodOptional<z.ZodNumber>;
            mean: z.ZodOptional<z.ZodNumber>;
            median: z.ZodOptional<z.ZodNumber>;
            stdDev: z.ZodOptional<z.ZodNumber>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            nullCount: z.ZodNumber;
            uniqueCount: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    correlations: z.ZodOptional<z.ZodObject<{
        matrix: z.ZodArray<z.ZodArray<z.ZodNumber>>;
        columns: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    summary: z.ZodOptional<z.ZodObject<{
        title: z.ZodString;
        sheets: z.ZodNumber;
        totalCells: z.ZodNumber;
        filledCells: z.ZodNumber;
        formulas: z.ZodNumber;
        charts: z.ZodNumber;
        lastModified: z.ZodString;
    }, z.core.$strip>>;
    dependencies: z.ZodOptional<z.ZodObject<{
        cell: z.ZodString;
        precedents: z.ZodOptional<z.ZodArray<z.ZodString>>;
        dependents: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    comparison: z.ZodOptional<z.ZodObject<{
        identical: z.ZodBoolean;
        differences: z.ZodArray<z.ZodObject<{
            cell: z.ZodString;
            value1: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
            value2: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
        }, z.core.$strip>>;
        diffCount: z.ZodNumber;
    }, z.core.$strip>>;
    templates: z.ZodOptional<z.ZodObject<{
        suggestions: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            description: z.ZodString;
            useCase: z.ZodString;
            structure: z.ZodOptional<z.ZodObject<{
                sheets: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    headers: z.ZodArray<z.ZodString>;
                    columnTypes: z.ZodOptional<z.ZodArray<z.ZodString>>;
                }, z.core.$strip>>;
                features: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            exampleData: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodUnknown>>>;
        }, z.core.$strip>>;
        reasoning: z.ZodString;
    }, z.core.$strip>>;
    formula: z.ZodOptional<z.ZodObject<{
        formula: z.ZodString;
        explanation: z.ZodString;
        components: z.ZodOptional<z.ZodArray<z.ZodObject<{
            part: z.ZodString;
            description: z.ZodString;
        }, z.core.$strip>>>;
        alternatives: z.ZodOptional<z.ZodArray<z.ZodObject<{
            formula: z.ZodString;
            reason: z.ZodString;
        }, z.core.$strip>>>;
        warnings: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    chartSuggestions: z.ZodOptional<z.ZodObject<{
        suggestions: z.ZodArray<z.ZodObject<{
            chartType: z.ZodEnum<{
                BAR: "BAR";
                LINE: "LINE";
                AREA: "AREA";
                COLUMN: "COLUMN";
                SCATTER: "SCATTER";
                COMBO: "COMBO";
                PIE: "PIE";
                TREEMAP: "TREEMAP";
                WATERFALL: "WATERFALL";
                HISTOGRAM: "HISTOGRAM";
                CANDLESTICK: "CANDLESTICK";
                ORG: "ORG";
            }>;
            title: z.ZodString;
            reasoning: z.ZodString;
            configuration: z.ZodOptional<z.ZodObject<{
                xAxis: z.ZodOptional<z.ZodString>;
                yAxis: z.ZodOptional<z.ZodString>;
                series: z.ZodOptional<z.ZodArray<z.ZodString>>;
                aggregation: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            suitabilityScore: z.ZodNumber;
        }, z.core.$strip>>;
        dataInsights: z.ZodString;
    }, z.core.$strip>>;
    _meta: z.ZodOptional<z.ZodObject<{
        suggestions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                optimization: "optimization";
                alternative: "alternative";
                follow_up: "follow_up";
                warning: "warning";
                related: "related";
            }>;
            message: z.ZodString;
            tool: z.ZodOptional<z.ZodString>;
            action: z.ZodOptional<z.ZodString>;
            reason: z.ZodString;
            priority: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>>>;
        }, z.core.$strip>>>;
        costEstimate: z.ZodOptional<z.ZodObject<{
            apiCalls: z.ZodNumber;
            estimatedLatencyMs: z.ZodNumber;
            cellsAffected: z.ZodOptional<z.ZodNumber>;
            quotaImpact: z.ZodOptional<z.ZodObject<{
                current: z.ZodNumber;
                limit: z.ZodNumber;
                remaining: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        relatedTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
        documentation: z.ZodOptional<z.ZodString>;
        nextSteps: z.ZodOptional<z.ZodArray<z.ZodString>>;
        warnings: z.ZodOptional<z.ZodArray<z.ZodString>>;
        snapshot: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodObject<{
        code: z.ZodEnum<{
            PARSE_ERROR: "PARSE_ERROR";
            INVALID_REQUEST: "INVALID_REQUEST";
            METHOD_NOT_FOUND: "METHOD_NOT_FOUND";
            INVALID_PARAMS: "INVALID_PARAMS";
            INTERNAL_ERROR: "INTERNAL_ERROR";
            UNAUTHENTICATED: "UNAUTHENTICATED";
            PERMISSION_DENIED: "PERMISSION_DENIED";
            INVALID_CREDENTIALS: "INVALID_CREDENTIALS";
            INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS";
            QUOTA_EXCEEDED: "QUOTA_EXCEEDED";
            RATE_LIMITED: "RATE_LIMITED";
            RESOURCE_EXHAUSTED: "RESOURCE_EXHAUSTED";
            SPREADSHEET_NOT_FOUND: "SPREADSHEET_NOT_FOUND";
            SPREADSHEET_TOO_LARGE: "SPREADSHEET_TOO_LARGE";
            SHEET_NOT_FOUND: "SHEET_NOT_FOUND";
            INVALID_SHEET_ID: "INVALID_SHEET_ID";
            DUPLICATE_SHEET_NAME: "DUPLICATE_SHEET_NAME";
            INVALID_RANGE: "INVALID_RANGE";
            RANGE_NOT_FOUND: "RANGE_NOT_FOUND";
            PROTECTED_RANGE: "PROTECTED_RANGE";
            FORMULA_ERROR: "FORMULA_ERROR";
            CIRCULAR_REFERENCE: "CIRCULAR_REFERENCE";
            INVALID_DATA_VALIDATION: "INVALID_DATA_VALIDATION";
            MERGE_CONFLICT: "MERGE_CONFLICT";
            CONDITIONAL_FORMAT_ERROR: "CONDITIONAL_FORMAT_ERROR";
            PIVOT_TABLE_ERROR: "PIVOT_TABLE_ERROR";
            CHART_ERROR: "CHART_ERROR";
            FILTER_VIEW_ERROR: "FILTER_VIEW_ERROR";
            NAMED_RANGE_ERROR: "NAMED_RANGE_ERROR";
            DEVELOPER_METADATA_ERROR: "DEVELOPER_METADATA_ERROR";
            DIMENSION_ERROR: "DIMENSION_ERROR";
            BATCH_UPDATE_ERROR: "BATCH_UPDATE_ERROR";
            TRANSACTION_ERROR: "TRANSACTION_ERROR";
            ABORTED: "ABORTED";
            DEADLINE_EXCEEDED: "DEADLINE_EXCEEDED";
            CANCELLED: "CANCELLED";
            DATA_LOSS: "DATA_LOSS";
            UNAVAILABLE: "UNAVAILABLE";
            UNIMPLEMENTED: "UNIMPLEMENTED";
            UNKNOWN: "UNKNOWN";
            OUT_OF_RANGE: "OUT_OF_RANGE";
            FAILED_PRECONDITION: "FAILED_PRECONDITION";
            PRECONDITION_FAILED: "PRECONDITION_FAILED";
            EFFECT_SCOPE_EXCEEDED: "EFFECT_SCOPE_EXCEEDED";
            EXPLICIT_RANGE_REQUIRED: "EXPLICIT_RANGE_REQUIRED";
            AMBIGUOUS_RANGE: "AMBIGUOUS_RANGE";
            FEATURE_UNAVAILABLE: "FEATURE_UNAVAILABLE";
            FEATURE_DEGRADED: "FEATURE_DEGRADED";
            AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED";
            AUTH_ERROR: "AUTH_ERROR";
            CONFIG_ERROR: "CONFIG_ERROR";
            VALIDATION_ERROR: "VALIDATION_ERROR";
            NOT_FOUND: "NOT_FOUND";
            NOT_IMPLEMENTED: "NOT_IMPLEMENTED";
            HANDLER_LOAD_ERROR: "HANDLER_LOAD_ERROR";
            TOO_MANY_SESSIONS: "TOO_MANY_SESSIONS";
            DATA_ERROR: "DATA_ERROR";
            VERSION_MISMATCH: "VERSION_MISMATCH";
            NO_DATA: "NO_DATA";
            SERVICE_NOT_INITIALIZED: "SERVICE_NOT_INITIALIZED";
            SNAPSHOT_CREATION_FAILED: "SNAPSHOT_CREATION_FAILED";
            SNAPSHOT_RESTORE_FAILED: "SNAPSHOT_RESTORE_FAILED";
            TRANSACTION_CONFLICT: "TRANSACTION_CONFLICT";
            TRANSACTION_EXPIRED: "TRANSACTION_EXPIRED";
            SESSION_NOT_FOUND: "SESSION_NOT_FOUND";
            PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE";
            ELICITATION_UNAVAILABLE: "ELICITATION_UNAVAILABLE";
            SAMPLING_UNAVAILABLE: "SAMPLING_UNAVAILABLE";
            FORBIDDEN: "FORBIDDEN";
            REPLAY_FAILED: "REPLAY_FAILED";
            UNKNOWN_ERROR: "UNKNOWN_ERROR";
        }>;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        retryable: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        retryAfterMs: z.ZodOptional<z.ZodNumber>;
        suggestedFix: z.ZodOptional<z.ZodString>;
        alternatives: z.ZodOptional<z.ZodArray<z.ZodObject<{
            tool: z.ZodString;
            action: z.ZodString;
            description: z.ZodString;
        }, z.core.$strip>>>;
        resolution: z.ZodOptional<z.ZodString>;
        resolutionSteps: z.ZodOptional<z.ZodArray<z.ZodString>>;
        category: z.ZodOptional<z.ZodEnum<{
            unknown: "unknown";
            client: "client";
            server: "server";
            network: "network";
            auth: "auth";
            quota: "quota";
        }>>;
        severity: z.ZodOptional<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
            critical: "critical";
        }>>;
        retryStrategy: z.ZodOptional<z.ZodEnum<{
            exponential_backoff: "exponential_backoff";
            wait_for_reset: "wait_for_reset";
            manual: "manual";
            none: "none";
        }>>;
        suggestedTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>], "success">;
export declare const SheetsAnalysisOutputSchema: z.ZodObject<{
    response: z.ZodDiscriminatedUnion<[z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodString;
        dataQuality: z.ZodOptional<z.ZodObject<{
            score: z.ZodNumber;
            completeness: z.ZodNumber;
            consistency: z.ZodNumber;
            accuracy: z.ZodNumber;
            issues: z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<{
                    FORMULA_ERROR: "FORMULA_ERROR";
                    EMPTY_HEADER: "EMPTY_HEADER";
                    DUPLICATE_HEADER: "DUPLICATE_HEADER";
                    MIXED_DATA_TYPES: "MIXED_DATA_TYPES";
                    EMPTY_ROW: "EMPTY_ROW";
                    EMPTY_COLUMN: "EMPTY_COLUMN";
                    TRAILING_WHITESPACE: "TRAILING_WHITESPACE";
                    LEADING_WHITESPACE: "LEADING_WHITESPACE";
                    INCONSISTENT_FORMAT: "INCONSISTENT_FORMAT";
                    STATISTICAL_OUTLIER: "STATISTICAL_OUTLIER";
                    MISSING_VALUE: "MISSING_VALUE";
                    DUPLICATE_ROW: "DUPLICATE_ROW";
                    INVALID_EMAIL: "INVALID_EMAIL";
                    INVALID_URL: "INVALID_URL";
                    INVALID_DATE: "INVALID_DATE";
                }>;
                severity: z.ZodEnum<{
                    low: "low";
                    medium: "medium";
                    high: "high";
                }>;
                location: z.ZodString;
                description: z.ZodString;
                autoFixable: z.ZodBoolean;
                fixTool: z.ZodOptional<z.ZodString>;
                fixAction: z.ZodOptional<z.ZodString>;
                fixParams: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            }, z.core.$strip>>;
            summary: z.ZodString;
        }, z.core.$strip>>;
        formulaAudit: z.ZodOptional<z.ZodObject<{
            score: z.ZodNumber;
            totalFormulas: z.ZodNumber;
            uniqueFormulas: z.ZodNumber;
            issues: z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<{
                    CIRCULAR_REFERENCE: "CIRCULAR_REFERENCE";
                    BROKEN_REFERENCE: "BROKEN_REFERENCE";
                    VOLATILE_FUNCTION: "VOLATILE_FUNCTION";
                    COMPLEX_FORMULA: "COMPLEX_FORMULA";
                    HARDCODED_VALUE: "HARDCODED_VALUE";
                    INCONSISTENT_FORMULA: "INCONSISTENT_FORMULA";
                    ARRAY_FORMULA_ISSUE: "ARRAY_FORMULA_ISSUE";
                    DEPRECATED_FUNCTION: "DEPRECATED_FUNCTION";
                    PERFORMANCE_ISSUE: "PERFORMANCE_ISSUE";
                }>;
                severity: z.ZodEnum<{
                    low: "low";
                    medium: "medium";
                    high: "high";
                }>;
                cell: z.ZodString;
                formula: z.ZodString;
                description: z.ZodString;
                suggestion: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            summary: z.ZodString;
        }, z.core.$strip>>;
        structure: z.ZodOptional<z.ZodObject<{
            sheets: z.ZodNumber;
            totalRows: z.ZodNumber;
            totalColumns: z.ZodNumber;
            tables: z.ZodOptional<z.ZodArray<z.ZodObject<{
                sheetId: z.ZodNumber;
                range: z.ZodString;
                headers: z.ZodArray<z.ZodString>;
                rowCount: z.ZodNumber;
            }, z.core.$strip>>>;
            namedRanges: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                range: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        statistics: z.ZodOptional<z.ZodObject<{
            columns: z.ZodArray<z.ZodObject<{
                index: z.ZodNumber;
                name: z.ZodOptional<z.ZodString>;
                count: z.ZodNumber;
                sum: z.ZodOptional<z.ZodNumber>;
                mean: z.ZodOptional<z.ZodNumber>;
                median: z.ZodOptional<z.ZodNumber>;
                stdDev: z.ZodOptional<z.ZodNumber>;
                min: z.ZodOptional<z.ZodNumber>;
                max: z.ZodOptional<z.ZodNumber>;
                nullCount: z.ZodNumber;
                uniqueCount: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        correlations: z.ZodOptional<z.ZodObject<{
            matrix: z.ZodArray<z.ZodArray<z.ZodNumber>>;
            columns: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        summary: z.ZodOptional<z.ZodObject<{
            title: z.ZodString;
            sheets: z.ZodNumber;
            totalCells: z.ZodNumber;
            filledCells: z.ZodNumber;
            formulas: z.ZodNumber;
            charts: z.ZodNumber;
            lastModified: z.ZodString;
        }, z.core.$strip>>;
        dependencies: z.ZodOptional<z.ZodObject<{
            cell: z.ZodString;
            precedents: z.ZodOptional<z.ZodArray<z.ZodString>>;
            dependents: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        comparison: z.ZodOptional<z.ZodObject<{
            identical: z.ZodBoolean;
            differences: z.ZodArray<z.ZodObject<{
                cell: z.ZodString;
                value1: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
                value2: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
            }, z.core.$strip>>;
            diffCount: z.ZodNumber;
        }, z.core.$strip>>;
        templates: z.ZodOptional<z.ZodObject<{
            suggestions: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                description: z.ZodString;
                useCase: z.ZodString;
                structure: z.ZodOptional<z.ZodObject<{
                    sheets: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        headers: z.ZodArray<z.ZodString>;
                        columnTypes: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    }, z.core.$strip>>;
                    features: z.ZodArray<z.ZodString>;
                }, z.core.$strip>>;
                exampleData: z.ZodOptional<z.ZodArray<z.ZodArray<z.ZodUnknown>>>;
            }, z.core.$strip>>;
            reasoning: z.ZodString;
        }, z.core.$strip>>;
        formula: z.ZodOptional<z.ZodObject<{
            formula: z.ZodString;
            explanation: z.ZodString;
            components: z.ZodOptional<z.ZodArray<z.ZodObject<{
                part: z.ZodString;
                description: z.ZodString;
            }, z.core.$strip>>>;
            alternatives: z.ZodOptional<z.ZodArray<z.ZodObject<{
                formula: z.ZodString;
                reason: z.ZodString;
            }, z.core.$strip>>>;
            warnings: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        chartSuggestions: z.ZodOptional<z.ZodObject<{
            suggestions: z.ZodArray<z.ZodObject<{
                chartType: z.ZodEnum<{
                    BAR: "BAR";
                    LINE: "LINE";
                    AREA: "AREA";
                    COLUMN: "COLUMN";
                    SCATTER: "SCATTER";
                    COMBO: "COMBO";
                    PIE: "PIE";
                    TREEMAP: "TREEMAP";
                    WATERFALL: "WATERFALL";
                    HISTOGRAM: "HISTOGRAM";
                    CANDLESTICK: "CANDLESTICK";
                    ORG: "ORG";
                }>;
                title: z.ZodString;
                reasoning: z.ZodString;
                configuration: z.ZodOptional<z.ZodObject<{
                    xAxis: z.ZodOptional<z.ZodString>;
                    yAxis: z.ZodOptional<z.ZodString>;
                    series: z.ZodOptional<z.ZodArray<z.ZodString>>;
                    aggregation: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
                suitabilityScore: z.ZodNumber;
            }, z.core.$strip>>;
            dataInsights: z.ZodString;
        }, z.core.$strip>>;
        _meta: z.ZodOptional<z.ZodObject<{
            suggestions: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<{
                    optimization: "optimization";
                    alternative: "alternative";
                    follow_up: "follow_up";
                    warning: "warning";
                    related: "related";
                }>;
                message: z.ZodString;
                tool: z.ZodOptional<z.ZodString>;
                action: z.ZodOptional<z.ZodString>;
                reason: z.ZodString;
                priority: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
                    low: "low";
                    medium: "medium";
                    high: "high";
                }>>>;
            }, z.core.$strip>>>;
            costEstimate: z.ZodOptional<z.ZodObject<{
                apiCalls: z.ZodNumber;
                estimatedLatencyMs: z.ZodNumber;
                cellsAffected: z.ZodOptional<z.ZodNumber>;
                quotaImpact: z.ZodOptional<z.ZodObject<{
                    current: z.ZodNumber;
                    limit: z.ZodNumber;
                    remaining: z.ZodNumber;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            relatedTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
            documentation: z.ZodOptional<z.ZodString>;
            nextSteps: z.ZodOptional<z.ZodArray<z.ZodString>>;
            warnings: z.ZodOptional<z.ZodArray<z.ZodString>>;
            snapshot: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        success: z.ZodLiteral<false>;
        error: z.ZodObject<{
            code: z.ZodEnum<{
                PARSE_ERROR: "PARSE_ERROR";
                INVALID_REQUEST: "INVALID_REQUEST";
                METHOD_NOT_FOUND: "METHOD_NOT_FOUND";
                INVALID_PARAMS: "INVALID_PARAMS";
                INTERNAL_ERROR: "INTERNAL_ERROR";
                UNAUTHENTICATED: "UNAUTHENTICATED";
                PERMISSION_DENIED: "PERMISSION_DENIED";
                INVALID_CREDENTIALS: "INVALID_CREDENTIALS";
                INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS";
                QUOTA_EXCEEDED: "QUOTA_EXCEEDED";
                RATE_LIMITED: "RATE_LIMITED";
                RESOURCE_EXHAUSTED: "RESOURCE_EXHAUSTED";
                SPREADSHEET_NOT_FOUND: "SPREADSHEET_NOT_FOUND";
                SPREADSHEET_TOO_LARGE: "SPREADSHEET_TOO_LARGE";
                SHEET_NOT_FOUND: "SHEET_NOT_FOUND";
                INVALID_SHEET_ID: "INVALID_SHEET_ID";
                DUPLICATE_SHEET_NAME: "DUPLICATE_SHEET_NAME";
                INVALID_RANGE: "INVALID_RANGE";
                RANGE_NOT_FOUND: "RANGE_NOT_FOUND";
                PROTECTED_RANGE: "PROTECTED_RANGE";
                FORMULA_ERROR: "FORMULA_ERROR";
                CIRCULAR_REFERENCE: "CIRCULAR_REFERENCE";
                INVALID_DATA_VALIDATION: "INVALID_DATA_VALIDATION";
                MERGE_CONFLICT: "MERGE_CONFLICT";
                CONDITIONAL_FORMAT_ERROR: "CONDITIONAL_FORMAT_ERROR";
                PIVOT_TABLE_ERROR: "PIVOT_TABLE_ERROR";
                CHART_ERROR: "CHART_ERROR";
                FILTER_VIEW_ERROR: "FILTER_VIEW_ERROR";
                NAMED_RANGE_ERROR: "NAMED_RANGE_ERROR";
                DEVELOPER_METADATA_ERROR: "DEVELOPER_METADATA_ERROR";
                DIMENSION_ERROR: "DIMENSION_ERROR";
                BATCH_UPDATE_ERROR: "BATCH_UPDATE_ERROR";
                TRANSACTION_ERROR: "TRANSACTION_ERROR";
                ABORTED: "ABORTED";
                DEADLINE_EXCEEDED: "DEADLINE_EXCEEDED";
                CANCELLED: "CANCELLED";
                DATA_LOSS: "DATA_LOSS";
                UNAVAILABLE: "UNAVAILABLE";
                UNIMPLEMENTED: "UNIMPLEMENTED";
                UNKNOWN: "UNKNOWN";
                OUT_OF_RANGE: "OUT_OF_RANGE";
                FAILED_PRECONDITION: "FAILED_PRECONDITION";
                PRECONDITION_FAILED: "PRECONDITION_FAILED";
                EFFECT_SCOPE_EXCEEDED: "EFFECT_SCOPE_EXCEEDED";
                EXPLICIT_RANGE_REQUIRED: "EXPLICIT_RANGE_REQUIRED";
                AMBIGUOUS_RANGE: "AMBIGUOUS_RANGE";
                FEATURE_UNAVAILABLE: "FEATURE_UNAVAILABLE";
                FEATURE_DEGRADED: "FEATURE_DEGRADED";
                AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED";
                AUTH_ERROR: "AUTH_ERROR";
                CONFIG_ERROR: "CONFIG_ERROR";
                VALIDATION_ERROR: "VALIDATION_ERROR";
                NOT_FOUND: "NOT_FOUND";
                NOT_IMPLEMENTED: "NOT_IMPLEMENTED";
                HANDLER_LOAD_ERROR: "HANDLER_LOAD_ERROR";
                TOO_MANY_SESSIONS: "TOO_MANY_SESSIONS";
                DATA_ERROR: "DATA_ERROR";
                VERSION_MISMATCH: "VERSION_MISMATCH";
                NO_DATA: "NO_DATA";
                SERVICE_NOT_INITIALIZED: "SERVICE_NOT_INITIALIZED";
                SNAPSHOT_CREATION_FAILED: "SNAPSHOT_CREATION_FAILED";
                SNAPSHOT_RESTORE_FAILED: "SNAPSHOT_RESTORE_FAILED";
                TRANSACTION_CONFLICT: "TRANSACTION_CONFLICT";
                TRANSACTION_EXPIRED: "TRANSACTION_EXPIRED";
                SESSION_NOT_FOUND: "SESSION_NOT_FOUND";
                PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE";
                ELICITATION_UNAVAILABLE: "ELICITATION_UNAVAILABLE";
                SAMPLING_UNAVAILABLE: "SAMPLING_UNAVAILABLE";
                FORBIDDEN: "FORBIDDEN";
                REPLAY_FAILED: "REPLAY_FAILED";
                UNKNOWN_ERROR: "UNKNOWN_ERROR";
            }>;
            message: z.ZodString;
            details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            retryable: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            retryAfterMs: z.ZodOptional<z.ZodNumber>;
            suggestedFix: z.ZodOptional<z.ZodString>;
            alternatives: z.ZodOptional<z.ZodArray<z.ZodObject<{
                tool: z.ZodString;
                action: z.ZodString;
                description: z.ZodString;
            }, z.core.$strip>>>;
            resolution: z.ZodOptional<z.ZodString>;
            resolutionSteps: z.ZodOptional<z.ZodArray<z.ZodString>>;
            category: z.ZodOptional<z.ZodEnum<{
                unknown: "unknown";
                client: "client";
                server: "server";
                network: "network";
                auth: "auth";
                quota: "quota";
            }>>;
            severity: z.ZodOptional<z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
                critical: "critical";
            }>>;
            retryStrategy: z.ZodOptional<z.ZodEnum<{
                exponential_backoff: "exponential_backoff";
                wait_for_reset: "wait_for_reset";
                manual: "manual";
                none: "none";
            }>>;
            suggestedTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>], "success">;
}, z.core.$strip>;
export declare const SHEETS_ANALYSIS_ANNOTATIONS: ToolAnnotations;
/**
 * Deprecation metadata
 * @deprecated Since 2026-01-12. Use sheets_analyze instead.
 */
export declare const SHEETS_ANALYSIS_DEPRECATION: {
    readonly deprecated: true;
    readonly deprecatedSince: "2026-01-12";
    readonly removalDate: "2026-04-12";
    readonly replacement: "sheets_analyze";
    readonly migrationGuide: {
        readonly data_quality: "analyze_quality";
        readonly formula_audit: "analyze_quality";
        readonly structure_analysis: "analyze_structure";
        readonly statistics: "analyze_data";
        readonly correlations: "detect_patterns";
        readonly summary: "analyze_data";
        readonly detect_patterns: "detect_patterns";
        readonly column_analysis: "analyze_data";
        readonly generate_formula: "generate_formula";
        readonly suggest_chart: "suggest_visualization";
    };
};
export type SheetsAnalysisInput = z.infer<typeof SheetsAnalysisInputSchema>;
export type SheetsAnalysisOutput = z.infer<typeof SheetsAnalysisOutputSchema>;
export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;
export {};
//# sourceMappingURL=analysis.d.ts.map