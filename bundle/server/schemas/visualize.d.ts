/**
 * Tool: sheets_visualize
 * Consolidated chart and pivot table visualization operations
 * Merges sheets_charts (9 actions) and sheets_pivot (7 actions) into 16 actions
 */
import { z } from 'zod';
import { ChartPositionSchema, type ToolAnnotations, type RangeInput } from './shared.js';
declare const ChartDataSchema: z.ZodObject<{
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
declare const PivotValueSchema: z.ZodObject<{
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
}, z.core.$strip>;
/**
 * All visualization operation inputs (charts and pivot tables)
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 * - JSON Schema conversion handled by src/utils/schema-compat.ts
 */
export declare const SheetsVisualizeInputSchema: z.ZodObject<{
    request: z.ZodDiscriminatedUnion<[z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        action: z.ZodLiteral<"chart_create">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        chartType: z.ZodEnum<{
            BAR: "BAR";
            LINE: "LINE";
            AREA: "AREA";
            COLUMN: "COLUMN";
            SCATTER: "SCATTER";
            COMBO: "COMBO";
            STEPPED_AREA: "STEPPED_AREA";
            PIE: "PIE";
            DOUGHNUT: "DOUGHNUT";
            TREEMAP: "TREEMAP";
            WATERFALL: "WATERFALL";
            HISTOGRAM: "HISTOGRAM";
            CANDLESTICK: "CANDLESTICK";
            ORG: "ORG";
            RADAR: "RADAR";
            SCORECARD: "SCORECARD";
            BUBBLE: "BUBBLE";
        }>;
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
            subtitle: z.ZodOptional<z.ZodString>;
            legendPosition: z.ZodOptional<z.ZodEnum<{
                BOTTOM_LEGEND: "BOTTOM_LEGEND";
                LEFT_LEGEND: "LEFT_LEGEND";
                RIGHT_LEGEND: "RIGHT_LEGEND";
                TOP_LEGEND: "TOP_LEGEND";
                NO_LEGEND: "NO_LEGEND";
            }>>;
            backgroundColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            is3D: z.ZodOptional<z.ZodBoolean>;
            pieHole: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
            stacked: z.ZodOptional<z.ZodBoolean>;
            lineSmooth: z.ZodOptional<z.ZodBoolean>;
            axisTitle: z.ZodOptional<z.ZodObject<{
                horizontal: z.ZodOptional<z.ZodString>;
                vertical: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        action: z.ZodLiteral<"suggest_chart">;
        spreadsheetId: z.ZodString;
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
        maxSuggestions: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        action: z.ZodLiteral<"chart_update">;
        spreadsheetId: z.ZodString;
        chartId: z.ZodCoercedNumber<unknown>;
        chartType: z.ZodOptional<z.ZodEnum<{
            BAR: "BAR";
            LINE: "LINE";
            AREA: "AREA";
            COLUMN: "COLUMN";
            SCATTER: "SCATTER";
            COMBO: "COMBO";
            STEPPED_AREA: "STEPPED_AREA";
            PIE: "PIE";
            DOUGHNUT: "DOUGHNUT";
            TREEMAP: "TREEMAP";
            WATERFALL: "WATERFALL";
            HISTOGRAM: "HISTOGRAM";
            CANDLESTICK: "CANDLESTICK";
            ORG: "ORG";
            RADAR: "RADAR";
            SCORECARD: "SCORECARD";
            BUBBLE: "BUBBLE";
        }>>;
        data: z.ZodOptional<z.ZodObject<{
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
        }, z.core.$strip>>;
        position: z.ZodOptional<z.ZodObject<{
            anchorCell: z.ZodString;
            offsetX: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            offsetY: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            width: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            height: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, z.core.$strip>>;
        options: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            subtitle: z.ZodOptional<z.ZodString>;
            legendPosition: z.ZodOptional<z.ZodEnum<{
                BOTTOM_LEGEND: "BOTTOM_LEGEND";
                LEFT_LEGEND: "LEFT_LEGEND";
                RIGHT_LEGEND: "RIGHT_LEGEND";
                TOP_LEGEND: "TOP_LEGEND";
                NO_LEGEND: "NO_LEGEND";
            }>>;
            backgroundColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
            is3D: z.ZodOptional<z.ZodBoolean>;
            pieHole: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
            stacked: z.ZodOptional<z.ZodBoolean>;
            lineSmooth: z.ZodOptional<z.ZodBoolean>;
            axisTitle: z.ZodOptional<z.ZodObject<{
                horizontal: z.ZodOptional<z.ZodString>;
                vertical: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        action: z.ZodLiteral<"chart_delete">;
        spreadsheetId: z.ZodString;
        chartId: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        action: z.ZodLiteral<"chart_list">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        action: z.ZodLiteral<"chart_get">;
        spreadsheetId: z.ZodString;
        chartId: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        action: z.ZodLiteral<"chart_move">;
        spreadsheetId: z.ZodString;
        chartId: z.ZodCoercedNumber<unknown>;
        position: z.ZodObject<{
            anchorCell: z.ZodString;
            offsetX: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            offsetY: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            width: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            height: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        action: z.ZodLiteral<"chart_resize">;
        spreadsheetId: z.ZodString;
        chartId: z.ZodCoercedNumber<unknown>;
        width: z.ZodCoercedNumber<unknown>;
        height: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        action: z.ZodLiteral<"chart_update_data_range">;
        spreadsheetId: z.ZodString;
        chartId: z.ZodCoercedNumber<unknown>;
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
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        action: z.ZodLiteral<"pivot_create">;
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
            showTotals: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
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
            showTotals: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
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
        destinationCell: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        action: z.ZodLiteral<"suggest_pivot">;
        spreadsheetId: z.ZodString;
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
        maxSuggestions: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        action: z.ZodLiteral<"pivot_update">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        rows: z.ZodOptional<z.ZodArray<z.ZodObject<{
            sourceColumnOffset: z.ZodCoercedNumber<unknown>;
            sortOrder: z.ZodOptional<z.ZodEnum<{
                ASCENDING: "ASCENDING";
                DESCENDING: "DESCENDING";
            }>>;
            showTotals: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
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
            showTotals: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
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
        values: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        action: z.ZodLiteral<"pivot_delete">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        action: z.ZodLiteral<"pivot_list">;
        spreadsheetId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        action: z.ZodLiteral<"pivot_get">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        safety: z.ZodOptional<z.ZodObject<{
            dryRun: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            expectedState: z.ZodOptional<z.ZodObject<{
                version: z.ZodOptional<z.ZodString>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
                sheetTitle: z.ZodOptional<z.ZodString>;
                checksum: z.ZodOptional<z.ZodString>;
                checksumRange: z.ZodOptional<z.ZodString>;
                firstRowValues: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            transactionId: z.ZodOptional<z.ZodString>;
            autoSnapshot: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            effectScope: z.ZodOptional<z.ZodObject<{
                maxCellsAffected: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                maxRowsAffected: z.ZodOptional<z.ZodNumber>;
                maxColumnsAffected: z.ZodOptional<z.ZodNumber>;
                requireExplicitRange: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        action: z.ZodLiteral<"pivot_refresh">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>], "action">;
}, z.core.$strip>;
declare const VisualizeResponseSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    success: z.ZodLiteral<true>;
    action: z.ZodString;
    chartId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    charts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        chartId: z.ZodCoercedNumber<unknown>;
        chartType: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        title: z.ZodOptional<z.ZodString>;
        position: z.ZodObject<{
            anchorCell: z.ZodString;
            offsetX: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            offsetY: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            width: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            height: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, z.core.$strip>;
    }, z.core.$strip>>>;
    pivotTable: z.ZodOptional<z.ZodObject<{
        sheetId: z.ZodCoercedNumber<unknown>;
        sourceRange: z.ZodObject<{
            sheetId: z.ZodCoercedNumber<unknown>;
            startRowIndex: z.ZodOptional<z.ZodNumber>;
            endRowIndex: z.ZodOptional<z.ZodNumber>;
            startColumnIndex: z.ZodOptional<z.ZodNumber>;
            endColumnIndex: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        rowGroups: z.ZodCoercedNumber<unknown>;
        columnGroups: z.ZodCoercedNumber<unknown>;
        values: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>>;
    pivotTables: z.ZodOptional<z.ZodArray<z.ZodObject<{
        sheetId: z.ZodCoercedNumber<unknown>;
        title: z.ZodString;
    }, z.core.$strip>>>;
    suggestions: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
        chartType: z.ZodEnum<{
            BAR: "BAR";
            LINE: "LINE";
            AREA: "AREA";
            COLUMN: "COLUMN";
            SCATTER: "SCATTER";
            COMBO: "COMBO";
            STEPPED_AREA: "STEPPED_AREA";
            PIE: "PIE";
            DOUGHNUT: "DOUGHNUT";
            TREEMAP: "TREEMAP";
            WATERFALL: "WATERFALL";
            HISTOGRAM: "HISTOGRAM";
            CANDLESTICK: "CANDLESTICK";
            ORG: "ORG";
            RADAR: "RADAR";
            SCORECARD: "SCORECARD";
            BUBBLE: "BUBBLE";
        }>;
        title: z.ZodString;
        explanation: z.ZodString;
        confidence: z.ZodCoercedNumber<unknown>;
        reasoning: z.ZodString;
        dataMapping: z.ZodObject<{
            seriesColumns: z.ZodOptional<z.ZodArray<z.ZodCoercedNumber<unknown>>>;
            categoryColumn: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        title: z.ZodString;
        explanation: z.ZodString;
        confidence: z.ZodCoercedNumber<unknown>;
        reasoning: z.ZodString;
        configuration: z.ZodObject<{
            rowGroupColumns: z.ZodArray<z.ZodCoercedNumber<unknown>>;
            columnGroupColumns: z.ZodOptional<z.ZodArray<z.ZodCoercedNumber<unknown>>>;
            valueColumns: z.ZodArray<z.ZodObject<{
                columnIndex: z.ZodCoercedNumber<unknown>;
                function: z.ZodEnum<{
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
            }, z.core.$strip>>;
        }, z.core.$strip>;
    }, z.core.$strip>]>>>;
    dryRun: z.ZodOptional<z.ZodBoolean>;
    mutation: z.ZodOptional<z.ZodObject<{
        cellsAffected: z.ZodNumber;
        rowsAffected: z.ZodOptional<z.ZodNumber>;
        columnsAffected: z.ZodOptional<z.ZodNumber>;
        diff: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
            tier: z.ZodLiteral<"METADATA">;
            before: z.ZodObject<{
                timestamp: z.ZodString;
                rowCount: z.ZodNumber;
                columnCount: z.ZodNumber;
                checksum: z.ZodString;
            }, z.core.$strip>;
            after: z.ZodObject<{
                timestamp: z.ZodString;
                rowCount: z.ZodNumber;
                columnCount: z.ZodNumber;
                checksum: z.ZodString;
            }, z.core.$strip>;
            summary: z.ZodObject<{
                rowsChanged: z.ZodNumber;
                estimatedCellsChanged: z.ZodNumber;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            tier: z.ZodLiteral<"SAMPLE">;
            samples: z.ZodObject<{
                firstRows: z.ZodArray<z.ZodObject<{
                    cell: z.ZodString;
                    before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                    after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                    type: z.ZodEnum<{
                        format: "format";
                        value: "value";
                        formula: "formula";
                        note: "note";
                    }>;
                }, z.core.$strip>>;
                lastRows: z.ZodArray<z.ZodObject<{
                    cell: z.ZodString;
                    before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                    after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                    type: z.ZodEnum<{
                        format: "format";
                        value: "value";
                        formula: "formula";
                        note: "note";
                    }>;
                }, z.core.$strip>>;
                randomRows: z.ZodArray<z.ZodObject<{
                    cell: z.ZodString;
                    before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                    after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                    type: z.ZodEnum<{
                        format: "format";
                        value: "value";
                        formula: "formula";
                        note: "note";
                    }>;
                }, z.core.$strip>>;
            }, z.core.$strip>;
            summary: z.ZodObject<{
                rowsChanged: z.ZodNumber;
                cellsSampled: z.ZodNumber;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            tier: z.ZodLiteral<"FULL">;
            changes: z.ZodArray<z.ZodObject<{
                cell: z.ZodString;
                before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                type: z.ZodEnum<{
                    format: "format";
                    value: "value";
                    formula: "formula";
                    note: "note";
                }>;
            }, z.core.$strip>>;
            summary: z.ZodObject<{
                cellsChanged: z.ZodNumber;
                cellsAdded: z.ZodNumber;
                cellsRemoved: z.ZodNumber;
            }, z.core.$strip>;
        }, z.core.$strip>], "tier">>;
        reversible: z.ZodBoolean;
        revertSnapshotId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    snapshotId: z.ZodOptional<z.ZodString>;
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
export declare const SheetsVisualizeOutputSchema: z.ZodObject<{
    response: z.ZodDiscriminatedUnion<[z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodString;
        chartId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        charts: z.ZodOptional<z.ZodArray<z.ZodObject<{
            chartId: z.ZodCoercedNumber<unknown>;
            chartType: z.ZodString;
            sheetId: z.ZodCoercedNumber<unknown>;
            title: z.ZodOptional<z.ZodString>;
            position: z.ZodObject<{
                anchorCell: z.ZodString;
                offsetX: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                offsetY: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                width: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                height: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>;
        }, z.core.$strip>>>;
        pivotTable: z.ZodOptional<z.ZodObject<{
            sheetId: z.ZodCoercedNumber<unknown>;
            sourceRange: z.ZodObject<{
                sheetId: z.ZodCoercedNumber<unknown>;
                startRowIndex: z.ZodOptional<z.ZodNumber>;
                endRowIndex: z.ZodOptional<z.ZodNumber>;
                startColumnIndex: z.ZodOptional<z.ZodNumber>;
                endColumnIndex: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>;
            rowGroups: z.ZodCoercedNumber<unknown>;
            columnGroups: z.ZodCoercedNumber<unknown>;
            values: z.ZodCoercedNumber<unknown>;
        }, z.core.$strip>>;
        pivotTables: z.ZodOptional<z.ZodArray<z.ZodObject<{
            sheetId: z.ZodCoercedNumber<unknown>;
            title: z.ZodString;
        }, z.core.$strip>>>;
        suggestions: z.ZodOptional<z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
            chartType: z.ZodEnum<{
                BAR: "BAR";
                LINE: "LINE";
                AREA: "AREA";
                COLUMN: "COLUMN";
                SCATTER: "SCATTER";
                COMBO: "COMBO";
                STEPPED_AREA: "STEPPED_AREA";
                PIE: "PIE";
                DOUGHNUT: "DOUGHNUT";
                TREEMAP: "TREEMAP";
                WATERFALL: "WATERFALL";
                HISTOGRAM: "HISTOGRAM";
                CANDLESTICK: "CANDLESTICK";
                ORG: "ORG";
                RADAR: "RADAR";
                SCORECARD: "SCORECARD";
                BUBBLE: "BUBBLE";
            }>;
            title: z.ZodString;
            explanation: z.ZodString;
            confidence: z.ZodCoercedNumber<unknown>;
            reasoning: z.ZodString;
            dataMapping: z.ZodObject<{
                seriesColumns: z.ZodOptional<z.ZodArray<z.ZodCoercedNumber<unknown>>>;
                categoryColumn: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
            }, z.core.$strip>;
        }, z.core.$strip>, z.ZodObject<{
            title: z.ZodString;
            explanation: z.ZodString;
            confidence: z.ZodCoercedNumber<unknown>;
            reasoning: z.ZodString;
            configuration: z.ZodObject<{
                rowGroupColumns: z.ZodArray<z.ZodCoercedNumber<unknown>>;
                columnGroupColumns: z.ZodOptional<z.ZodArray<z.ZodCoercedNumber<unknown>>>;
                valueColumns: z.ZodArray<z.ZodObject<{
                    columnIndex: z.ZodCoercedNumber<unknown>;
                    function: z.ZodEnum<{
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
                }, z.core.$strip>>;
            }, z.core.$strip>;
        }, z.core.$strip>]>>>;
        dryRun: z.ZodOptional<z.ZodBoolean>;
        mutation: z.ZodOptional<z.ZodObject<{
            cellsAffected: z.ZodNumber;
            rowsAffected: z.ZodOptional<z.ZodNumber>;
            columnsAffected: z.ZodOptional<z.ZodNumber>;
            diff: z.ZodOptional<z.ZodDiscriminatedUnion<[z.ZodObject<{
                tier: z.ZodLiteral<"METADATA">;
                before: z.ZodObject<{
                    timestamp: z.ZodString;
                    rowCount: z.ZodNumber;
                    columnCount: z.ZodNumber;
                    checksum: z.ZodString;
                }, z.core.$strip>;
                after: z.ZodObject<{
                    timestamp: z.ZodString;
                    rowCount: z.ZodNumber;
                    columnCount: z.ZodNumber;
                    checksum: z.ZodString;
                }, z.core.$strip>;
                summary: z.ZodObject<{
                    rowsChanged: z.ZodNumber;
                    estimatedCellsChanged: z.ZodNumber;
                }, z.core.$strip>;
            }, z.core.$strip>, z.ZodObject<{
                tier: z.ZodLiteral<"SAMPLE">;
                samples: z.ZodObject<{
                    firstRows: z.ZodArray<z.ZodObject<{
                        cell: z.ZodString;
                        before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                        after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                        type: z.ZodEnum<{
                            format: "format";
                            value: "value";
                            formula: "formula";
                            note: "note";
                        }>;
                    }, z.core.$strip>>;
                    lastRows: z.ZodArray<z.ZodObject<{
                        cell: z.ZodString;
                        before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                        after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                        type: z.ZodEnum<{
                            format: "format";
                            value: "value";
                            formula: "formula";
                            note: "note";
                        }>;
                    }, z.core.$strip>>;
                    randomRows: z.ZodArray<z.ZodObject<{
                        cell: z.ZodString;
                        before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                        after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                        type: z.ZodEnum<{
                            format: "format";
                            value: "value";
                            formula: "formula";
                            note: "note";
                        }>;
                    }, z.core.$strip>>;
                }, z.core.$strip>;
                summary: z.ZodObject<{
                    rowsChanged: z.ZodNumber;
                    cellsSampled: z.ZodNumber;
                }, z.core.$strip>;
            }, z.core.$strip>, z.ZodObject<{
                tier: z.ZodLiteral<"FULL">;
                changes: z.ZodArray<z.ZodObject<{
                    cell: z.ZodString;
                    before: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                    after: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
                    type: z.ZodEnum<{
                        format: "format";
                        value: "value";
                        formula: "formula";
                        note: "note";
                    }>;
                }, z.core.$strip>>;
                summary: z.ZodObject<{
                    cellsChanged: z.ZodNumber;
                    cellsAdded: z.ZodNumber;
                    cellsRemoved: z.ZodNumber;
                }, z.core.$strip>;
            }, z.core.$strip>], "tier">>;
            reversible: z.ZodBoolean;
            revertSnapshotId: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        snapshotId: z.ZodOptional<z.ZodString>;
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
export declare const SHEETS_VISUALIZE_ANNOTATIONS: ToolAnnotations;
export type SheetsVisualizeInput = z.infer<typeof SheetsVisualizeInputSchema>;
export type SheetsVisualizeOutput = z.infer<typeof SheetsVisualizeOutputSchema>;
export type VisualizeResponse = z.infer<typeof VisualizeResponseSchema>;
/** The unwrapped request type (the discriminated union of actions) */
export type VisualizeRequest = SheetsVisualizeInput['request'];
export type ChartCreateInput = SheetsVisualizeInput['request'] & {
    action: 'chart_create';
    spreadsheetId: string;
    sheetId: number;
    chartType: string;
    data: z.infer<typeof ChartDataSchema>;
    position: z.infer<typeof ChartPositionSchema>;
};
export type SuggestChartInput = SheetsVisualizeInput['request'] & {
    action: 'suggest_chart';
    spreadsheetId: string;
    range: RangeInput;
};
export type ChartUpdateInput = SheetsVisualizeInput['request'] & {
    action: 'chart_update';
    spreadsheetId: string;
    chartId: number;
};
export type ChartDeleteInput = SheetsVisualizeInput['request'] & {
    action: 'chart_delete';
    spreadsheetId: string;
    chartId: number;
};
export type ChartListInput = SheetsVisualizeInput['request'] & {
    action: 'chart_list';
    spreadsheetId: string;
};
export type ChartGetInput = SheetsVisualizeInput['request'] & {
    action: 'chart_get';
    spreadsheetId: string;
    chartId: number;
};
export type ChartMoveInput = SheetsVisualizeInput['request'] & {
    action: 'chart_move';
    spreadsheetId: string;
    chartId: number;
    position: z.infer<typeof ChartPositionSchema>;
};
export type ChartResizeInput = SheetsVisualizeInput['request'] & {
    action: 'chart_resize';
    spreadsheetId: string;
    chartId: number;
    width: number;
    height: number;
};
export type ChartUpdateDataRangeInput = SheetsVisualizeInput['request'] & {
    action: 'chart_update_data_range';
    spreadsheetId: string;
    chartId: number;
    data: z.infer<typeof ChartDataSchema>;
};
export type PivotCreateInput = SheetsVisualizeInput['request'] & {
    action: 'pivot_create';
    spreadsheetId: string;
    sourceRange: RangeInput;
    values: z.infer<typeof PivotValueSchema>[];
};
export type SuggestPivotInput = SheetsVisualizeInput['request'] & {
    action: 'suggest_pivot';
    spreadsheetId: string;
    range: RangeInput;
};
export type PivotUpdateInput = SheetsVisualizeInput['request'] & {
    action: 'pivot_update';
    spreadsheetId: string;
    sheetId: number;
};
export type PivotDeleteInput = SheetsVisualizeInput['request'] & {
    action: 'pivot_delete';
    spreadsheetId: string;
    sheetId: number;
};
export type PivotListInput = SheetsVisualizeInput['request'] & {
    action: 'pivot_list';
    spreadsheetId: string;
};
export type PivotGetInput = SheetsVisualizeInput['request'] & {
    action: 'pivot_get';
    spreadsheetId: string;
    sheetId: number;
};
export type PivotRefreshInput = SheetsVisualizeInput['request'] & {
    action: 'pivot_refresh';
    spreadsheetId: string;
    sheetId: number;
};
export {};
//# sourceMappingURL=visualize.d.ts.map