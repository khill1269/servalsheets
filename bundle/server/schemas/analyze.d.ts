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
import { type ToolAnnotations } from './shared.js';
/**
 * Analysis types available
 */
declare const AnalysisTypeSchema: z.ZodEnum<{
    patterns: "patterns";
    summary: "summary";
    recommendations: "recommendations";
    anomalies: "anomalies";
    trends: "trends";
    quality: "quality";
    correlations: "correlations";
}>;
/**
 * Data quality issue schema (from sheets_analyze) - Enhanced with executable fixes
 */
declare const DataQualityIssueSchema: z.ZodObject<{
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
    executableFix: z.ZodOptional<z.ZodObject<{
        tool: z.ZodString;
        action: z.ZodString;
        params: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        description: z.ZodString;
        estimatedTime: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * Performance recommendation schema (NEW)
 */
export declare const PerformanceRecommendationSchema: z.ZodObject<{
    type: z.ZodEnum<{
        VOLATILE_FORMULAS: "VOLATILE_FORMULAS";
        EXCESSIVE_FORMULAS: "EXCESSIVE_FORMULAS";
        LARGE_RANGES: "LARGE_RANGES";
        CIRCULAR_REFERENCES: "CIRCULAR_REFERENCES";
        INEFFICIENT_STRUCTURE: "INEFFICIENT_STRUCTURE";
        TOO_MANY_SHEETS: "TOO_MANY_SHEETS";
    }>;
    severity: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    description: z.ZodString;
    estimatedImpact: z.ZodString;
    recommendation: z.ZodString;
    executableFix: z.ZodOptional<z.ZodObject<{
        tool: z.ZodString;
        action: z.ZodString;
        params: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        description: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * All analysis operation inputs
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 * - JSON Schema conversion handled by src/utils/schema-compat.ts
 */
export declare const SheetsAnalyzeInputSchema: z.ZodObject<{
    request: z.ZodDiscriminatedUnion<[z.ZodObject<{
        spreadsheetId: z.ZodString;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        action: z.ZodLiteral<"comprehensive">;
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
        includeFormulas: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        includeVisualizations: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        includePerformance: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        forceFullData: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        samplingThreshold: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        sampleSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        cursor: z.ZodOptional<z.ZodString>;
        pageSize: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        context: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        action: z.ZodLiteral<"analyze_data">;
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
        analysisTypes: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodEnum<{
            patterns: "patterns";
            summary: "summary";
            recommendations: "recommendations";
            anomalies: "anomalies";
            trends: "trends";
            quality: "quality";
            correlations: "correlations";
        }>>>>;
        useAI: z.ZodOptional<z.ZodBoolean>;
        context: z.ZodOptional<z.ZodString>;
        maxTokens: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        action: z.ZodLiteral<"suggest_visualization">;
        range: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$strip>]>>;
        goal: z.ZodOptional<z.ZodString>;
        preferredTypes: z.ZodOptional<z.ZodArray<z.ZodString>>;
        includeCharts: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        includePivots: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        action: z.ZodLiteral<"generate_formula">;
        description: z.ZodString;
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
        targetCell: z.ZodOptional<z.ZodString>;
        includeExplanation: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        action: z.ZodLiteral<"detect_patterns">;
        range: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
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
        }, z.core.$strip>]>>;
        includeCorrelations: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        includeTrends: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        includeSeasonality: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        includeAnomalies: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        action: z.ZodLiteral<"analyze_structure">;
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
        detectTables: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        detectHeaders: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        action: z.ZodLiteral<"analyze_quality">;
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
            validation: "validation";
            headers: "headers";
            data_types: "data_types";
            empty_cells: "empty_cells";
            duplicates: "duplicates";
            outliers: "outliers";
            formatting: "formatting";
        }>>>;
        outlierMethod: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            iqr: "iqr";
            zscore: "zscore";
            modified_zscore: "modified_zscore";
        }>>>;
        outlierThreshold: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        action: z.ZodLiteral<"analyze_performance">;
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
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        action: z.ZodLiteral<"analyze_formulas">;
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
        includeOptimizations: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        includeComplexity: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>, z.ZodObject<{
        spreadsheetId: z.ZodString;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        action: z.ZodLiteral<"query_natural_language">;
        query: z.ZodString;
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
        conversationId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"explain_analysis">;
        analysisResult: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        question: z.ZodOptional<z.ZodString>;
        spreadsheetId: z.ZodOptional<z.ZodString>;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        context: z.ZodOptional<z.ZodString>;
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
    }, z.core.$strip>], "action">;
}, z.core.$strip>;
/**
 * Analysis finding schema
 */
declare const AnalysisFindingSchema: z.ZodObject<{
    type: z.ZodEnum<{
        patterns: "patterns";
        summary: "summary";
        recommendations: "recommendations";
        anomalies: "anomalies";
        trends: "trends";
        quality: "quality";
        correlations: "correlations";
    }>;
    confidence: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    findings: z.ZodArray<z.ZodString>;
    details: z.ZodString;
    affectedCells: z.ZodOptional<z.ZodArray<z.ZodString>>;
    recommendations: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
/**
 * Response schema (consolidated)
 */
declare const AnalyzeResponseSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    success: z.ZodLiteral<true>;
    action: z.ZodString;
    summary: z.ZodOptional<z.ZodString>;
    analyses: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            patterns: "patterns";
            summary: "summary";
            recommendations: "recommendations";
            anomalies: "anomalies";
            trends: "trends";
            quality: "quality";
            correlations: "correlations";
        }>;
        confidence: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
        findings: z.ZodArray<z.ZodString>;
        details: z.ZodString;
        affectedCells: z.ZodOptional<z.ZodArray<z.ZodString>>;
        recommendations: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
    overallQualityScore: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    topInsights: z.ZodOptional<z.ZodArray<z.ZodString>>;
    executionPath: z.ZodOptional<z.ZodEnum<{
        streaming: "streaming";
        fast: "fast";
        ai: "ai";
        sample: "sample";
        full: "full";
    }>>;
    chartRecommendations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        chartType: z.ZodString;
        suitabilityScore: z.ZodCoercedNumber<unknown>;
        reasoning: z.ZodString;
        configuration: z.ZodOptional<z.ZodObject<{
            categories: z.ZodOptional<z.ZodString>;
            series: z.ZodOptional<z.ZodArray<z.ZodString>>;
            stacked: z.ZodOptional<z.ZodBoolean>;
            title: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        insights: z.ZodOptional<z.ZodArray<z.ZodString>>;
        executionParams: z.ZodObject<{
            tool: z.ZodLiteral<"sheets_visualize">;
            action: z.ZodLiteral<"chart_create">;
            params: z.ZodObject<{
                spreadsheetId: z.ZodString;
                sheetId: z.ZodCoercedNumber<unknown>;
                chartType: z.ZodString;
                data: z.ZodObject<{
                    sourceRange: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
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
                    }, z.core.$strip>]>>;
                    series: z.ZodOptional<z.ZodArray<z.ZodObject<{
                        column: z.ZodCoercedNumber<unknown>;
                        color: z.ZodOptional<z.ZodObject<{
                            red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                            green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                            blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                            alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                        }, z.core.$strip>>;
                    }, z.core.$strip>>>;
                    categories: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
                    aggregateType: z.ZodOptional<z.ZodEnum<{
                        AVERAGE: "AVERAGE";
                        COUNT: "COUNT";
                        COUNTA: "COUNTA";
                        COUNTUNIQUE: "COUNTUNIQUE";
                        MAX: "MAX";
                        MEDIAN: "MEDIAN";
                        MIN: "MIN";
                        STDEV: "STDEV";
                        STDEVP: "STDEVP";
                        SUM: "SUM";
                        VAR: "VAR";
                        VARP: "VARP";
                    }>>;
                }, z.core.$strip>;
                position: z.ZodObject<{
                    anchorCell: z.ZodString;
                    offsetX: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    offsetY: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    width: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    height: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                }, z.core.$strip>;
                options: z.ZodOptional<z.ZodObject<{
                    title: z.ZodOptional<z.ZodString>;
                    legendPosition: z.ZodOptional<z.ZodEnum<{
                        BOTTOM_LEGEND: "BOTTOM_LEGEND";
                        LEFT_LEGEND: "LEFT_LEGEND";
                        RIGHT_LEGEND: "RIGHT_LEGEND";
                        TOP_LEGEND: "TOP_LEGEND";
                        NO_LEGEND: "NO_LEGEND";
                    }>>;
                    axisTitle: z.ZodOptional<z.ZodObject<{
                        horizontal: z.ZodOptional<z.ZodString>;
                        vertical: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
            }, z.core.$strip>;
        }, z.core.$strip>;
    }, z.core.$strip>>>;
    pivotRecommendations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        confidence: z.ZodCoercedNumber<unknown>;
        reasoning: z.ZodString;
        configuration: z.ZodObject<{
            rows: z.ZodArray<z.ZodString>;
            columns: z.ZodArray<z.ZodString>;
            values: z.ZodArray<z.ZodObject<{
                field: z.ZodString;
                aggregation: z.ZodEnum<{
                    AVERAGE: "AVERAGE";
                    COUNT: "COUNT";
                    MAX: "MAX";
                    MIN: "MIN";
                    SUM: "SUM";
                }>;
            }, z.core.$strip>>;
        }, z.core.$strip>;
        sourceRange: z.ZodString;
        executionParams: z.ZodObject<{
            tool: z.ZodLiteral<"sheets_visualize">;
            action: z.ZodLiteral<"pivot_create">;
            params: z.ZodObject<{
                spreadsheetId: z.ZodString;
                sourceRange: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
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
                }, z.core.$strip>]>>;
                values: z.ZodArray<z.ZodObject<{
                    sourceColumnOffset: z.ZodCoercedNumber<unknown>;
                    summarizeFunction: z.ZodEnum<{
                        AVERAGE: "AVERAGE";
                        COUNT: "COUNT";
                        COUNTA: "COUNTA";
                        COUNTUNIQUE: "COUNTUNIQUE";
                        MAX: "MAX";
                        MEDIAN: "MEDIAN";
                        MIN: "MIN";
                        STDEV: "STDEV";
                        STDEVP: "STDEVP";
                        SUM: "SUM";
                        VAR: "VAR";
                        VARP: "VARP";
                        PRODUCT: "PRODUCT";
                        CUSTOM: "CUSTOM";
                    }>;
                    name: z.ZodOptional<z.ZodString>;
                    calculatedDisplayType: z.ZodOptional<z.ZodEnum<{
                        PERCENT_OF_ROW_TOTAL: "PERCENT_OF_ROW_TOTAL";
                        PERCENT_OF_COLUMN_TOTAL: "PERCENT_OF_COLUMN_TOTAL";
                        PERCENT_OF_GRAND_TOTAL: "PERCENT_OF_GRAND_TOTAL";
                    }>>;
                }, z.core.$strip>>;
                rows: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    sourceColumnOffset: z.ZodCoercedNumber<unknown>;
                    sortOrder: z.ZodOptional<z.ZodEnum<{
                        ASCENDING: "ASCENDING";
                        DESCENDING: "DESCENDING";
                    }>>;
                    showTotals: z.ZodOptional<z.ZodBoolean>;
                    groupRule: z.ZodOptional<z.ZodObject<{
                        dateTimeRule: z.ZodOptional<z.ZodObject<{
                            type: z.ZodEnum<{
                                MINUTE: "MINUTE";
                                HOUR: "HOUR";
                                SECOND: "SECOND";
                                DAY_OF_WEEK: "DAY_OF_WEEK";
                                DAY_OF_YEAR: "DAY_OF_YEAR";
                                DAY_OF_MONTH: "DAY_OF_MONTH";
                                WEEK_OF_YEAR: "WEEK_OF_YEAR";
                                MONTH: "MONTH";
                                QUARTER: "QUARTER";
                                YEAR: "YEAR";
                                YEAR_MONTH: "YEAR_MONTH";
                                YEAR_QUARTER: "YEAR_QUARTER";
                                YEAR_MONTH_DAY: "YEAR_MONTH_DAY";
                            }>;
                        }, z.core.$strip>>;
                        manualRule: z.ZodOptional<z.ZodObject<{
                            groups: z.ZodArray<z.ZodObject<{
                                groupName: z.ZodString;
                                items: z.ZodArray<z.ZodString>;
                            }, z.core.$strip>>;
                        }, z.core.$strip>>;
                        histogramRule: z.ZodOptional<z.ZodObject<{
                            interval: z.ZodCoercedNumber<unknown>;
                            start: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
                            end: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
                        }, z.core.$strip>>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>>;
                columns: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    sourceColumnOffset: z.ZodCoercedNumber<unknown>;
                    sortOrder: z.ZodOptional<z.ZodEnum<{
                        ASCENDING: "ASCENDING";
                        DESCENDING: "DESCENDING";
                    }>>;
                    showTotals: z.ZodOptional<z.ZodBoolean>;
                    groupRule: z.ZodOptional<z.ZodObject<{
                        dateTimeRule: z.ZodOptional<z.ZodObject<{
                            type: z.ZodEnum<{
                                MINUTE: "MINUTE";
                                HOUR: "HOUR";
                                SECOND: "SECOND";
                                DAY_OF_WEEK: "DAY_OF_WEEK";
                                DAY_OF_YEAR: "DAY_OF_YEAR";
                                DAY_OF_MONTH: "DAY_OF_MONTH";
                                WEEK_OF_YEAR: "WEEK_OF_YEAR";
                                MONTH: "MONTH";
                                QUARTER: "QUARTER";
                                YEAR: "YEAR";
                                YEAR_MONTH: "YEAR_MONTH";
                                YEAR_QUARTER: "YEAR_QUARTER";
                                YEAR_MONTH_DAY: "YEAR_MONTH_DAY";
                            }>;
                        }, z.core.$strip>>;
                        manualRule: z.ZodOptional<z.ZodObject<{
                            groups: z.ZodArray<z.ZodObject<{
                                groupName: z.ZodString;
                                items: z.ZodArray<z.ZodString>;
                            }, z.core.$strip>>;
                        }, z.core.$strip>>;
                        histogramRule: z.ZodOptional<z.ZodObject<{
                            interval: z.ZodCoercedNumber<unknown>;
                            start: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
                            end: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
                        }, z.core.$strip>>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>>;
                filters: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    sourceColumnOffset: z.ZodCoercedNumber<unknown>;
                    filterCriteria: z.ZodObject<{
                        visibleValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
                        condition: z.ZodOptional<z.ZodObject<{
                            type: z.ZodString;
                            values: z.ZodOptional<z.ZodArray<z.ZodString>>;
                        }, z.core.$strip>>;
                    }, z.core.$strip>;
                }, z.core.$strip>>>;
                destinationSheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
                destinationCell: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>;
        }, z.core.$strip>;
    }, z.core.$strip>>>;
    dataAssessment: z.ZodOptional<z.ZodObject<{
        dataType: z.ZodString;
        rowCount: z.ZodCoercedNumber<unknown>;
        columnCount: z.ZodCoercedNumber<unknown>;
        hasHeaders: z.ZodBoolean;
    }, z.core.$strip>>;
    formula: z.ZodOptional<z.ZodObject<{
        formula: z.ZodString;
        explanation: z.ZodString;
        assumptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
        alternatives: z.ZodOptional<z.ZodArray<z.ZodObject<{
            formula: z.ZodString;
            useCase: z.ZodString;
        }, z.core.$strip>>>;
        tips: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    patterns: z.ZodOptional<z.ZodObject<{
        correlations: z.ZodOptional<z.ZodObject<{
            matrix: z.ZodArray<z.ZodArray<z.ZodCoercedNumber<unknown>>>;
            columns: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        trends: z.ZodOptional<z.ZodArray<z.ZodObject<{
            column: z.ZodString;
            direction: z.ZodEnum<{
                increasing: "increasing";
                decreasing: "decreasing";
                stable: "stable";
                seasonal: "seasonal";
            }>;
            confidence: z.ZodCoercedNumber<unknown>;
            description: z.ZodString;
        }, z.core.$strip>>>;
        anomalies: z.ZodOptional<z.ZodArray<z.ZodObject<{
            location: z.ZodString;
            value: z.ZodUnion<readonly [z.ZodString, z.ZodCoercedNumber<unknown>]>;
            expectedRange: z.ZodOptional<z.ZodString>;
            severity: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
        }, z.core.$strip>>>;
        seasonality: z.ZodOptional<z.ZodObject<{
            detected: z.ZodBoolean;
            period: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
            confidence: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    structure: z.ZodOptional<z.ZodObject<{
        sheets: z.ZodCoercedNumber<unknown>;
        totalRows: z.ZodCoercedNumber<unknown>;
        totalColumns: z.ZodCoercedNumber<unknown>;
        tables: z.ZodOptional<z.ZodArray<z.ZodObject<{
            sheetId: z.ZodCoercedNumber<unknown>;
            range: z.ZodString;
            headers: z.ZodArray<z.ZodString>;
            rowCount: z.ZodCoercedNumber<unknown>;
        }, z.core.$strip>>>;
        namedRanges: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            range: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    templateDetection: z.ZodOptional<z.ZodObject<{
        detectedType: z.ZodEnum<{
            unknown: "unknown";
            custom: "custom";
            budget: "budget";
            invoice: "invoice";
            expense_report: "expense_report";
            crm: "crm";
            project_tracker: "project_tracker";
            inventory: "inventory";
            time_sheet: "time_sheet";
            sales_report: "sales_report";
            dashboard: "dashboard";
            data_entry: "data_entry";
        }>;
        confidence: z.ZodCoercedNumber<unknown>;
        characteristics: z.ZodArray<z.ZodString>;
        recommendations: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                formula: "formula";
                validation: "validation";
                formatting: "formatting";
                structure: "structure";
                chart: "chart";
                pivot: "pivot";
            }>;
            suggestion: z.ZodString;
            benefit: z.ZodString;
            executionParams: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>>;
        missingFeatures: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    dataQuality: z.ZodOptional<z.ZodObject<{
        score: z.ZodCoercedNumber<unknown>;
        completeness: z.ZodCoercedNumber<unknown>;
        consistency: z.ZodCoercedNumber<unknown>;
        accuracy: z.ZodCoercedNumber<unknown>;
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
            executableFix: z.ZodOptional<z.ZodObject<{
                tool: z.ZodString;
                action: z.ZodString;
                params: z.ZodRecord<z.ZodString, z.ZodUnknown>;
                description: z.ZodString;
                estimatedTime: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        summary: z.ZodString;
    }, z.core.$strip>>;
    performance: z.ZodOptional<z.ZodObject<{
        overallScore: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        score: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        recommendations: z.ZodArray<z.ZodAny>;
        estimatedImprovementPotential: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    formulaAnalysis: z.ZodOptional<z.ZodObject<{
        totalFormulas: z.ZodCoercedNumber<unknown>;
        complexityDistribution: z.ZodRecord<z.ZodString, z.ZodCoercedNumber<unknown>>;
        volatileFormulas: z.ZodArray<z.ZodObject<{
            cell: z.ZodString;
            formula: z.ZodString;
            volatileFunctions: z.ZodArray<z.ZodString>;
            impact: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
            suggestion: z.ZodString;
        }, z.core.$strip>>;
        optimizationOpportunities: z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            priority: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
            affectedCells: z.ZodArray<z.ZodString>;
            currentFormula: z.ZodString;
            suggestedFormula: z.ZodString;
            reasoning: z.ZodString;
        }, z.core.$strip>>;
        circularReferences: z.ZodOptional<z.ZodArray<z.ZodObject<{
            cells: z.ZodArray<z.ZodString>;
            chain: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    queryResult: z.ZodOptional<z.ZodObject<{
        query: z.ZodString;
        answer: z.ZodString;
        intent: z.ZodObject<{
            type: z.ZodString;
            confidence: z.ZodCoercedNumber<unknown>;
        }, z.core.$strip>;
        data: z.ZodOptional<z.ZodObject<{
            headers: z.ZodArray<z.ZodString>;
            rows: z.ZodArray<z.ZodArray<z.ZodUnknown>>;
        }, z.core.$strip>>;
        visualizationSuggestion: z.ZodOptional<z.ZodObject<{
            chartType: z.ZodString;
            reasoning: z.ZodString;
        }, z.core.$strip>>;
        followUpQuestions: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
    explanation: z.ZodOptional<z.ZodString>;
    spreadsheet: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        locale: z.ZodString;
        timeZone: z.ZodString;
        lastModified: z.ZodOptional<z.ZodString>;
        owner: z.ZodOptional<z.ZodString>;
        sheetCount: z.ZodCoercedNumber<unknown>;
        totalRows: z.ZodCoercedNumber<unknown>;
        totalColumns: z.ZodCoercedNumber<unknown>;
        totalCells: z.ZodCoercedNumber<unknown>;
        namedRanges: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            range: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    sheets: z.ZodOptional<z.ZodArray<z.ZodObject<{
        sheetId: z.ZodCoercedNumber<unknown>;
        sheetName: z.ZodString;
        rowCount: z.ZodCoercedNumber<unknown>;
        columnCount: z.ZodCoercedNumber<unknown>;
        dataRowCount: z.ZodCoercedNumber<unknown>;
        columns: z.ZodArray<z.ZodAny>;
        qualityScore: z.ZodCoercedNumber<unknown>;
        completeness: z.ZodCoercedNumber<unknown>;
        consistency: z.ZodCoercedNumber<unknown>;
        issues: z.ZodArray<z.ZodAny>;
        trends: z.ZodArray<z.ZodAny>;
        anomalies: z.ZodArray<z.ZodAny>;
        correlations: z.ZodArray<z.ZodAny>;
        formulas: z.ZodOptional<z.ZodObject<{
            total: z.ZodCoercedNumber<unknown>;
            unique: z.ZodCoercedNumber<unknown>;
            volatile: z.ZodCoercedNumber<unknown>;
            complex: z.ZodCoercedNumber<unknown>;
            issues: z.ZodArray<z.ZodAny>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
    aggregate: z.ZodOptional<z.ZodObject<{
        totalDataRows: z.ZodCoercedNumber<unknown>;
        totalFormulas: z.ZodCoercedNumber<unknown>;
        overallQualityScore: z.ZodCoercedNumber<unknown>;
        overallCompleteness: z.ZodCoercedNumber<unknown>;
        totalIssues: z.ZodCoercedNumber<unknown>;
        totalAnomalies: z.ZodCoercedNumber<unknown>;
        totalTrends: z.ZodCoercedNumber<unknown>;
        totalCorrelations: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>>;
    visualizations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        chartType: z.ZodString;
        suitabilityScore: z.ZodCoercedNumber<unknown>;
        reasoning: z.ZodString;
        suggestedConfig: z.ZodAny;
        executionParams: z.ZodAny;
    }, z.core.$strip>>>;
    apiCalls: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    dataRetrieved: z.ZodOptional<z.ZodObject<{
        tier: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>;
        rowsAnalyzed: z.ZodCoercedNumber<unknown>;
        samplingUsed: z.ZodBoolean;
    }, z.core.$strip>>;
    nextCursor: z.ZodOptional<z.ZodString>;
    hasMore: z.ZodOptional<z.ZodBoolean>;
    resourceUri: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    message: z.ZodOptional<z.ZodString>;
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
            INTERNAL_ERROR: "INTERNAL_ERROR";
            NOT_IMPLEMENTED: "NOT_IMPLEMENTED";
            AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED";
            INVALID_PARAMS: "INVALID_PARAMS";
            PARSE_ERROR: "PARSE_ERROR";
            INVALID_REQUEST: "INVALID_REQUEST";
            METHOD_NOT_FOUND: "METHOD_NOT_FOUND";
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
            AUTH_ERROR: "AUTH_ERROR";
            CONFIG_ERROR: "CONFIG_ERROR";
            VALIDATION_ERROR: "VALIDATION_ERROR";
            NOT_FOUND: "NOT_FOUND";
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
export declare const SheetsAnalyzeOutputSchema: z.ZodObject<{
    response: z.ZodDiscriminatedUnion<[z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodString;
        summary: z.ZodOptional<z.ZodString>;
        analyses: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                patterns: "patterns";
                summary: "summary";
                recommendations: "recommendations";
                anomalies: "anomalies";
                trends: "trends";
                quality: "quality";
                correlations: "correlations";
            }>;
            confidence: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
            findings: z.ZodArray<z.ZodString>;
            details: z.ZodString;
            affectedCells: z.ZodOptional<z.ZodArray<z.ZodString>>;
            recommendations: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>>;
        overallQualityScore: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        topInsights: z.ZodOptional<z.ZodArray<z.ZodString>>;
        executionPath: z.ZodOptional<z.ZodEnum<{
            streaming: "streaming";
            fast: "fast";
            ai: "ai";
            sample: "sample";
            full: "full";
        }>>;
        chartRecommendations: z.ZodOptional<z.ZodArray<z.ZodObject<{
            chartType: z.ZodString;
            suitabilityScore: z.ZodCoercedNumber<unknown>;
            reasoning: z.ZodString;
            configuration: z.ZodOptional<z.ZodObject<{
                categories: z.ZodOptional<z.ZodString>;
                series: z.ZodOptional<z.ZodArray<z.ZodString>>;
                stacked: z.ZodOptional<z.ZodBoolean>;
                title: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            insights: z.ZodOptional<z.ZodArray<z.ZodString>>;
            executionParams: z.ZodObject<{
                tool: z.ZodLiteral<"sheets_visualize">;
                action: z.ZodLiteral<"chart_create">;
                params: z.ZodObject<{
                    spreadsheetId: z.ZodString;
                    sheetId: z.ZodCoercedNumber<unknown>;
                    chartType: z.ZodString;
                    data: z.ZodObject<{
                        sourceRange: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
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
                        }, z.core.$strip>]>>;
                        series: z.ZodOptional<z.ZodArray<z.ZodObject<{
                            column: z.ZodCoercedNumber<unknown>;
                            color: z.ZodOptional<z.ZodObject<{
                                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                            }, z.core.$strip>>;
                        }, z.core.$strip>>>;
                        categories: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
                        aggregateType: z.ZodOptional<z.ZodEnum<{
                            AVERAGE: "AVERAGE";
                            COUNT: "COUNT";
                            COUNTA: "COUNTA";
                            COUNTUNIQUE: "COUNTUNIQUE";
                            MAX: "MAX";
                            MEDIAN: "MEDIAN";
                            MIN: "MIN";
                            STDEV: "STDEV";
                            STDEVP: "STDEVP";
                            SUM: "SUM";
                            VAR: "VAR";
                            VARP: "VARP";
                        }>>;
                    }, z.core.$strip>;
                    position: z.ZodObject<{
                        anchorCell: z.ZodString;
                        offsetX: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                        offsetY: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                        width: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                        height: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    }, z.core.$strip>;
                    options: z.ZodOptional<z.ZodObject<{
                        title: z.ZodOptional<z.ZodString>;
                        legendPosition: z.ZodOptional<z.ZodEnum<{
                            BOTTOM_LEGEND: "BOTTOM_LEGEND";
                            LEFT_LEGEND: "LEFT_LEGEND";
                            RIGHT_LEGEND: "RIGHT_LEGEND";
                            TOP_LEGEND: "TOP_LEGEND";
                            NO_LEGEND: "NO_LEGEND";
                        }>>;
                        axisTitle: z.ZodOptional<z.ZodObject<{
                            horizontal: z.ZodOptional<z.ZodString>;
                            vertical: z.ZodOptional<z.ZodString>;
                        }, z.core.$strip>>;
                    }, z.core.$strip>>;
                }, z.core.$strip>;
            }, z.core.$strip>;
        }, z.core.$strip>>>;
        pivotRecommendations: z.ZodOptional<z.ZodArray<z.ZodObject<{
            confidence: z.ZodCoercedNumber<unknown>;
            reasoning: z.ZodString;
            configuration: z.ZodObject<{
                rows: z.ZodArray<z.ZodString>;
                columns: z.ZodArray<z.ZodString>;
                values: z.ZodArray<z.ZodObject<{
                    field: z.ZodString;
                    aggregation: z.ZodEnum<{
                        AVERAGE: "AVERAGE";
                        COUNT: "COUNT";
                        MAX: "MAX";
                        MIN: "MIN";
                        SUM: "SUM";
                    }>;
                }, z.core.$strip>>;
            }, z.core.$strip>;
            sourceRange: z.ZodString;
            executionParams: z.ZodObject<{
                tool: z.ZodLiteral<"sheets_visualize">;
                action: z.ZodLiteral<"pivot_create">;
                params: z.ZodObject<{
                    spreadsheetId: z.ZodString;
                    sourceRange: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodUnion<readonly [z.ZodObject<{
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
                    }, z.core.$strip>]>>;
                    values: z.ZodArray<z.ZodObject<{
                        sourceColumnOffset: z.ZodCoercedNumber<unknown>;
                        summarizeFunction: z.ZodEnum<{
                            AVERAGE: "AVERAGE";
                            COUNT: "COUNT";
                            COUNTA: "COUNTA";
                            COUNTUNIQUE: "COUNTUNIQUE";
                            MAX: "MAX";
                            MEDIAN: "MEDIAN";
                            MIN: "MIN";
                            STDEV: "STDEV";
                            STDEVP: "STDEVP";
                            SUM: "SUM";
                            VAR: "VAR";
                            VARP: "VARP";
                            PRODUCT: "PRODUCT";
                            CUSTOM: "CUSTOM";
                        }>;
                        name: z.ZodOptional<z.ZodString>;
                        calculatedDisplayType: z.ZodOptional<z.ZodEnum<{
                            PERCENT_OF_ROW_TOTAL: "PERCENT_OF_ROW_TOTAL";
                            PERCENT_OF_COLUMN_TOTAL: "PERCENT_OF_COLUMN_TOTAL";
                            PERCENT_OF_GRAND_TOTAL: "PERCENT_OF_GRAND_TOTAL";
                        }>>;
                    }, z.core.$strip>>;
                    rows: z.ZodOptional<z.ZodArray<z.ZodObject<{
                        sourceColumnOffset: z.ZodCoercedNumber<unknown>;
                        sortOrder: z.ZodOptional<z.ZodEnum<{
                            ASCENDING: "ASCENDING";
                            DESCENDING: "DESCENDING";
                        }>>;
                        showTotals: z.ZodOptional<z.ZodBoolean>;
                        groupRule: z.ZodOptional<z.ZodObject<{
                            dateTimeRule: z.ZodOptional<z.ZodObject<{
                                type: z.ZodEnum<{
                                    MINUTE: "MINUTE";
                                    HOUR: "HOUR";
                                    SECOND: "SECOND";
                                    DAY_OF_WEEK: "DAY_OF_WEEK";
                                    DAY_OF_YEAR: "DAY_OF_YEAR";
                                    DAY_OF_MONTH: "DAY_OF_MONTH";
                                    WEEK_OF_YEAR: "WEEK_OF_YEAR";
                                    MONTH: "MONTH";
                                    QUARTER: "QUARTER";
                                    YEAR: "YEAR";
                                    YEAR_MONTH: "YEAR_MONTH";
                                    YEAR_QUARTER: "YEAR_QUARTER";
                                    YEAR_MONTH_DAY: "YEAR_MONTH_DAY";
                                }>;
                            }, z.core.$strip>>;
                            manualRule: z.ZodOptional<z.ZodObject<{
                                groups: z.ZodArray<z.ZodObject<{
                                    groupName: z.ZodString;
                                    items: z.ZodArray<z.ZodString>;
                                }, z.core.$strip>>;
                            }, z.core.$strip>>;
                            histogramRule: z.ZodOptional<z.ZodObject<{
                                interval: z.ZodCoercedNumber<unknown>;
                                start: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
                                end: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
                            }, z.core.$strip>>;
                        }, z.core.$strip>>;
                    }, z.core.$strip>>>;
                    columns: z.ZodOptional<z.ZodArray<z.ZodObject<{
                        sourceColumnOffset: z.ZodCoercedNumber<unknown>;
                        sortOrder: z.ZodOptional<z.ZodEnum<{
                            ASCENDING: "ASCENDING";
                            DESCENDING: "DESCENDING";
                        }>>;
                        showTotals: z.ZodOptional<z.ZodBoolean>;
                        groupRule: z.ZodOptional<z.ZodObject<{
                            dateTimeRule: z.ZodOptional<z.ZodObject<{
                                type: z.ZodEnum<{
                                    MINUTE: "MINUTE";
                                    HOUR: "HOUR";
                                    SECOND: "SECOND";
                                    DAY_OF_WEEK: "DAY_OF_WEEK";
                                    DAY_OF_YEAR: "DAY_OF_YEAR";
                                    DAY_OF_MONTH: "DAY_OF_MONTH";
                                    WEEK_OF_YEAR: "WEEK_OF_YEAR";
                                    MONTH: "MONTH";
                                    QUARTER: "QUARTER";
                                    YEAR: "YEAR";
                                    YEAR_MONTH: "YEAR_MONTH";
                                    YEAR_QUARTER: "YEAR_QUARTER";
                                    YEAR_MONTH_DAY: "YEAR_MONTH_DAY";
                                }>;
                            }, z.core.$strip>>;
                            manualRule: z.ZodOptional<z.ZodObject<{
                                groups: z.ZodArray<z.ZodObject<{
                                    groupName: z.ZodString;
                                    items: z.ZodArray<z.ZodString>;
                                }, z.core.$strip>>;
                            }, z.core.$strip>>;
                            histogramRule: z.ZodOptional<z.ZodObject<{
                                interval: z.ZodCoercedNumber<unknown>;
                                start: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
                                end: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
                            }, z.core.$strip>>;
                        }, z.core.$strip>>;
                    }, z.core.$strip>>>;
                    filters: z.ZodOptional<z.ZodArray<z.ZodObject<{
                        sourceColumnOffset: z.ZodCoercedNumber<unknown>;
                        filterCriteria: z.ZodObject<{
                            visibleValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
                            condition: z.ZodOptional<z.ZodObject<{
                                type: z.ZodString;
                                values: z.ZodOptional<z.ZodArray<z.ZodString>>;
                            }, z.core.$strip>>;
                        }, z.core.$strip>;
                    }, z.core.$strip>>>;
                    destinationSheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
                    destinationCell: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>;
            }, z.core.$strip>;
        }, z.core.$strip>>>;
        dataAssessment: z.ZodOptional<z.ZodObject<{
            dataType: z.ZodString;
            rowCount: z.ZodCoercedNumber<unknown>;
            columnCount: z.ZodCoercedNumber<unknown>;
            hasHeaders: z.ZodBoolean;
        }, z.core.$strip>>;
        formula: z.ZodOptional<z.ZodObject<{
            formula: z.ZodString;
            explanation: z.ZodString;
            assumptions: z.ZodOptional<z.ZodArray<z.ZodString>>;
            alternatives: z.ZodOptional<z.ZodArray<z.ZodObject<{
                formula: z.ZodString;
                useCase: z.ZodString;
            }, z.core.$strip>>>;
            tips: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        patterns: z.ZodOptional<z.ZodObject<{
            correlations: z.ZodOptional<z.ZodObject<{
                matrix: z.ZodArray<z.ZodArray<z.ZodCoercedNumber<unknown>>>;
                columns: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
            trends: z.ZodOptional<z.ZodArray<z.ZodObject<{
                column: z.ZodString;
                direction: z.ZodEnum<{
                    increasing: "increasing";
                    decreasing: "decreasing";
                    stable: "stable";
                    seasonal: "seasonal";
                }>;
                confidence: z.ZodCoercedNumber<unknown>;
                description: z.ZodString;
            }, z.core.$strip>>>;
            anomalies: z.ZodOptional<z.ZodArray<z.ZodObject<{
                location: z.ZodString;
                value: z.ZodUnion<readonly [z.ZodString, z.ZodCoercedNumber<unknown>]>;
                expectedRange: z.ZodOptional<z.ZodString>;
                severity: z.ZodEnum<{
                    low: "low";
                    medium: "medium";
                    high: "high";
                }>;
            }, z.core.$strip>>>;
            seasonality: z.ZodOptional<z.ZodObject<{
                detected: z.ZodBoolean;
                period: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
                confidence: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        structure: z.ZodOptional<z.ZodObject<{
            sheets: z.ZodCoercedNumber<unknown>;
            totalRows: z.ZodCoercedNumber<unknown>;
            totalColumns: z.ZodCoercedNumber<unknown>;
            tables: z.ZodOptional<z.ZodArray<z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                range: z.ZodString;
                headers: z.ZodArray<z.ZodString>;
                rowCount: z.ZodCoercedNumber<unknown>;
            }, z.core.$strip>>>;
            namedRanges: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                range: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        templateDetection: z.ZodOptional<z.ZodObject<{
            detectedType: z.ZodEnum<{
                unknown: "unknown";
                custom: "custom";
                budget: "budget";
                invoice: "invoice";
                expense_report: "expense_report";
                crm: "crm";
                project_tracker: "project_tracker";
                inventory: "inventory";
                time_sheet: "time_sheet";
                sales_report: "sales_report";
                dashboard: "dashboard";
                data_entry: "data_entry";
            }>;
            confidence: z.ZodCoercedNumber<unknown>;
            characteristics: z.ZodArray<z.ZodString>;
            recommendations: z.ZodOptional<z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<{
                    formula: "formula";
                    validation: "validation";
                    formatting: "formatting";
                    structure: "structure";
                    chart: "chart";
                    pivot: "pivot";
                }>;
                suggestion: z.ZodString;
                benefit: z.ZodString;
                executionParams: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            }, z.core.$strip>>>;
            missingFeatures: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        dataQuality: z.ZodOptional<z.ZodObject<{
            score: z.ZodCoercedNumber<unknown>;
            completeness: z.ZodCoercedNumber<unknown>;
            consistency: z.ZodCoercedNumber<unknown>;
            accuracy: z.ZodCoercedNumber<unknown>;
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
                executableFix: z.ZodOptional<z.ZodObject<{
                    tool: z.ZodString;
                    action: z.ZodString;
                    params: z.ZodRecord<z.ZodString, z.ZodUnknown>;
                    description: z.ZodString;
                    estimatedTime: z.ZodOptional<z.ZodString>;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            summary: z.ZodString;
        }, z.core.$strip>>;
        performance: z.ZodOptional<z.ZodObject<{
            overallScore: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
            score: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
            recommendations: z.ZodArray<z.ZodAny>;
            estimatedImprovementPotential: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        formulaAnalysis: z.ZodOptional<z.ZodObject<{
            totalFormulas: z.ZodCoercedNumber<unknown>;
            complexityDistribution: z.ZodRecord<z.ZodString, z.ZodCoercedNumber<unknown>>;
            volatileFormulas: z.ZodArray<z.ZodObject<{
                cell: z.ZodString;
                formula: z.ZodString;
                volatileFunctions: z.ZodArray<z.ZodString>;
                impact: z.ZodEnum<{
                    low: "low";
                    medium: "medium";
                    high: "high";
                }>;
                suggestion: z.ZodString;
            }, z.core.$strip>>;
            optimizationOpportunities: z.ZodArray<z.ZodObject<{
                type: z.ZodString;
                priority: z.ZodEnum<{
                    low: "low";
                    medium: "medium";
                    high: "high";
                }>;
                affectedCells: z.ZodArray<z.ZodString>;
                currentFormula: z.ZodString;
                suggestedFormula: z.ZodString;
                reasoning: z.ZodString;
            }, z.core.$strip>>;
            circularReferences: z.ZodOptional<z.ZodArray<z.ZodObject<{
                cells: z.ZodArray<z.ZodString>;
                chain: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        queryResult: z.ZodOptional<z.ZodObject<{
            query: z.ZodString;
            answer: z.ZodString;
            intent: z.ZodObject<{
                type: z.ZodString;
                confidence: z.ZodCoercedNumber<unknown>;
            }, z.core.$strip>;
            data: z.ZodOptional<z.ZodObject<{
                headers: z.ZodArray<z.ZodString>;
                rows: z.ZodArray<z.ZodArray<z.ZodUnknown>>;
            }, z.core.$strip>>;
            visualizationSuggestion: z.ZodOptional<z.ZodObject<{
                chartType: z.ZodString;
                reasoning: z.ZodString;
            }, z.core.$strip>>;
            followUpQuestions: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        explanation: z.ZodOptional<z.ZodString>;
        spreadsheet: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            locale: z.ZodString;
            timeZone: z.ZodString;
            lastModified: z.ZodOptional<z.ZodString>;
            owner: z.ZodOptional<z.ZodString>;
            sheetCount: z.ZodCoercedNumber<unknown>;
            totalRows: z.ZodCoercedNumber<unknown>;
            totalColumns: z.ZodCoercedNumber<unknown>;
            totalCells: z.ZodCoercedNumber<unknown>;
            namedRanges: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                range: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        sheets: z.ZodOptional<z.ZodArray<z.ZodObject<{
            sheetId: z.ZodCoercedNumber<unknown>;
            sheetName: z.ZodString;
            rowCount: z.ZodCoercedNumber<unknown>;
            columnCount: z.ZodCoercedNumber<unknown>;
            dataRowCount: z.ZodCoercedNumber<unknown>;
            columns: z.ZodArray<z.ZodAny>;
            qualityScore: z.ZodCoercedNumber<unknown>;
            completeness: z.ZodCoercedNumber<unknown>;
            consistency: z.ZodCoercedNumber<unknown>;
            issues: z.ZodArray<z.ZodAny>;
            trends: z.ZodArray<z.ZodAny>;
            anomalies: z.ZodArray<z.ZodAny>;
            correlations: z.ZodArray<z.ZodAny>;
            formulas: z.ZodOptional<z.ZodObject<{
                total: z.ZodCoercedNumber<unknown>;
                unique: z.ZodCoercedNumber<unknown>;
                volatile: z.ZodCoercedNumber<unknown>;
                complex: z.ZodCoercedNumber<unknown>;
                issues: z.ZodArray<z.ZodAny>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>;
        aggregate: z.ZodOptional<z.ZodObject<{
            totalDataRows: z.ZodCoercedNumber<unknown>;
            totalFormulas: z.ZodCoercedNumber<unknown>;
            overallQualityScore: z.ZodCoercedNumber<unknown>;
            overallCompleteness: z.ZodCoercedNumber<unknown>;
            totalIssues: z.ZodCoercedNumber<unknown>;
            totalAnomalies: z.ZodCoercedNumber<unknown>;
            totalTrends: z.ZodCoercedNumber<unknown>;
            totalCorrelations: z.ZodCoercedNumber<unknown>;
        }, z.core.$strip>>;
        visualizations: z.ZodOptional<z.ZodArray<z.ZodObject<{
            chartType: z.ZodString;
            suitabilityScore: z.ZodCoercedNumber<unknown>;
            reasoning: z.ZodString;
            suggestedConfig: z.ZodAny;
            executionParams: z.ZodAny;
        }, z.core.$strip>>>;
        apiCalls: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        dataRetrieved: z.ZodOptional<z.ZodObject<{
            tier: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>, z.ZodLiteral<4>]>;
            rowsAnalyzed: z.ZodCoercedNumber<unknown>;
            samplingUsed: z.ZodBoolean;
        }, z.core.$strip>>;
        nextCursor: z.ZodOptional<z.ZodString>;
        hasMore: z.ZodOptional<z.ZodBoolean>;
        resourceUri: z.ZodOptional<z.ZodString>;
        duration: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        message: z.ZodOptional<z.ZodString>;
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
                INTERNAL_ERROR: "INTERNAL_ERROR";
                NOT_IMPLEMENTED: "NOT_IMPLEMENTED";
                AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED";
                INVALID_PARAMS: "INVALID_PARAMS";
                PARSE_ERROR: "PARSE_ERROR";
                INVALID_REQUEST: "INVALID_REQUEST";
                METHOD_NOT_FOUND: "METHOD_NOT_FOUND";
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
                AUTH_ERROR: "AUTH_ERROR";
                CONFIG_ERROR: "CONFIG_ERROR";
                VALIDATION_ERROR: "VALIDATION_ERROR";
                NOT_FOUND: "NOT_FOUND";
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
/**
 * Tool annotations following MCP 2025-11-25
 */
export declare const SHEETS_ANALYZE_ANNOTATIONS: ToolAnnotations;
export type SheetsAnalyzeInput = z.infer<typeof SheetsAnalyzeInputSchema>;
export type SheetsAnalyzeOutput = z.infer<typeof SheetsAnalyzeOutputSchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
export type AnalysisType = z.infer<typeof AnalysisTypeSchema>;
export type AnalysisFinding = z.infer<typeof AnalysisFindingSchema>;
export type DataQualityIssue = z.infer<typeof DataQualityIssueSchema>;
export type PerformanceRecommendation = z.infer<typeof PerformanceRecommendationSchema>;
export type AnalyzeDataInput = SheetsAnalyzeInput['request'] & {
    action: 'analyze_data';
    spreadsheetId: string;
};
export type SuggestVisualizationInput = SheetsAnalyzeInput['request'] & {
    action: 'suggest_visualization';
    spreadsheetId: string;
    range: string;
};
export type GenerateFormulaInput = SheetsAnalyzeInput['request'] & {
    action: 'generate_formula';
    spreadsheetId: string;
    description: string;
};
export type DetectPatternsInput = SheetsAnalyzeInput['request'] & {
    action: 'detect_patterns';
    spreadsheetId: string;
    range: string;
};
export type AnalyzeStructureInput = SheetsAnalyzeInput['request'] & {
    action: 'analyze_structure';
    spreadsheetId: string;
};
export type AnalyzeQualityInput = SheetsAnalyzeInput['request'] & {
    action: 'analyze_quality';
    spreadsheetId: string;
};
export type AnalyzePerformanceInput = SheetsAnalyzeInput['request'] & {
    action: 'analyze_performance';
    spreadsheetId: string;
};
export type ExplainAnalysisInput = SheetsAnalyzeInput['request'] & {
    action: 'explain_analysis';
};
export type ComprehensiveInput = SheetsAnalyzeInput['request'] & {
    action: 'comprehensive';
    spreadsheetId: string;
};
export {};
//# sourceMappingURL=analyze.d.ts.map