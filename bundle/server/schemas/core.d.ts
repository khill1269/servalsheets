/**
 * Tool: sheets_core (Consolidated)
 * Core spreadsheet and sheet/tab operations
 *
 * Consolidates legacy sheets_spreadsheet (8 actions) + sheets_sheet (7 actions) = 15 actions
 * MCP Protocol: 2025-11-25
 */
import { z } from 'zod';
import { type ToolAnnotations } from './shared.js';
/**
 * All core spreadsheet and sheet/tab operation inputs
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 * - JSON Schema conversion handled by src/utils/schema-compat.ts
 */
export declare const SheetsCoreInputSchema: z.ZodObject<{
    request: z.ZodDiscriminatedUnion<[z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"get">;
        spreadsheetId: z.ZodString;
        includeGridData: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        ranges: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"create">;
        title: z.ZodString;
        locale: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        timeZone: z.ZodOptional<z.ZodString>;
        sheets: z.ZodOptional<z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            rowCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            columnCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            tabColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"copy">;
        spreadsheetId: z.ZodString;
        newTitle: z.ZodOptional<z.ZodString>;
        destinationFolderId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"update_properties">;
        spreadsheetId: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        locale: z.ZodOptional<z.ZodString>;
        timeZone: z.ZodOptional<z.ZodString>;
        autoRecalc: z.ZodOptional<z.ZodEnum<{
            ON_CHANGE: "ON_CHANGE";
            MINUTE: "MINUTE";
            HOUR: "HOUR";
        }>>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"get_url">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"batch_get">;
        spreadsheetIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"get_comprehensive">;
        spreadsheetId: z.ZodString;
        includeGridData: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        maxRowsPerSheet: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"list">;
        maxResults: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        query: z.ZodOptional<z.ZodString>;
        orderBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            createdTime: "createdTime";
            modifiedTime: "modifiedTime";
            name: "name";
            viewedByMeTime: "viewedByMeTime";
        }>>>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"add_sheet">;
        spreadsheetId: z.ZodString;
        title: z.ZodString;
        index: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        rowCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        columnCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        tabColor: z.ZodOptional<z.ZodObject<{
            red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, z.core.$strip>>;
        hidden: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"delete_sheet">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        allowMissing: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
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
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"duplicate_sheet">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        newTitle: z.ZodOptional<z.ZodString>;
        insertIndex: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"update_sheet">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        title: z.ZodOptional<z.ZodString>;
        index: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        tabColor: z.ZodOptional<z.ZodObject<{
            red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, z.core.$strip>>;
        hidden: z.ZodOptional<z.ZodBoolean>;
        rightToLeft: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"copy_sheet_to">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
        destinationSpreadsheetId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"list_sheets">;
        spreadsheetId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"get_sheet">;
        spreadsheetId: z.ZodString;
        sheetId: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>], "action">;
}, z.core.$strip>;
declare const CoreResponseSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    success: z.ZodLiteral<true>;
    action: z.ZodString;
    spreadsheet: z.ZodOptional<z.ZodObject<{
        spreadsheetId: z.ZodString;
        title: z.ZodString;
        url: z.ZodOptional<z.ZodString>;
        locale: z.ZodOptional<z.ZodString>;
        timeZone: z.ZodOptional<z.ZodString>;
        sheets: z.ZodOptional<z.ZodArray<z.ZodObject<{
            sheetId: z.ZodNumber;
            title: z.ZodString;
            index: z.ZodNumber;
            rowCount: z.ZodNumber;
            columnCount: z.ZodNumber;
            hidden: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            tabColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>;
        createdTime: z.ZodOptional<z.ZodString>;
        modifiedTime: z.ZodOptional<z.ZodString>;
        owners: z.ZodOptional<z.ZodArray<z.ZodObject<{
            email: z.ZodOptional<z.ZodString>;
            displayName: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        lastModifiedBy: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    spreadsheets: z.ZodOptional<z.ZodArray<z.ZodObject<{
        spreadsheetId: z.ZodString;
        title: z.ZodString;
        url: z.ZodOptional<z.ZodString>;
        locale: z.ZodOptional<z.ZodString>;
        timeZone: z.ZodOptional<z.ZodString>;
        sheets: z.ZodOptional<z.ZodArray<z.ZodObject<{
            sheetId: z.ZodNumber;
            title: z.ZodString;
            index: z.ZodNumber;
            rowCount: z.ZodNumber;
            columnCount: z.ZodNumber;
            hidden: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            tabColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>;
        createdTime: z.ZodOptional<z.ZodString>;
        modifiedTime: z.ZodOptional<z.ZodString>;
        owners: z.ZodOptional<z.ZodArray<z.ZodObject<{
            email: z.ZodOptional<z.ZodString>;
            displayName: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        lastModifiedBy: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    url: z.ZodOptional<z.ZodString>;
    newSpreadsheetId: z.ZodOptional<z.ZodString>;
    sheet: z.ZodOptional<z.ZodObject<{
        sheetId: z.ZodNumber;
        title: z.ZodString;
        index: z.ZodNumber;
        rowCount: z.ZodNumber;
        columnCount: z.ZodNumber;
        hidden: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        tabColor: z.ZodOptional<z.ZodObject<{
            red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    sheets: z.ZodOptional<z.ZodArray<z.ZodObject<{
        sheetId: z.ZodNumber;
        title: z.ZodString;
        index: z.ZodNumber;
        rowCount: z.ZodNumber;
        columnCount: z.ZodNumber;
        hidden: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        tabColor: z.ZodOptional<z.ZodObject<{
            red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
    copiedSheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    alreadyDeleted: z.ZodOptional<z.ZodBoolean>;
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
    comprehensiveMetadata: z.ZodOptional<z.ZodObject<{
        spreadsheetId: z.ZodString;
        properties: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        namedRanges: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        sheets: z.ZodOptional<z.ZodArray<z.ZodObject<{
            properties: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            conditionalFormats: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            protectedRanges: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            charts: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            filterViews: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            basicFilter: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            merges: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            data: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        }, z.core.$strip>>>;
        stats: z.ZodOptional<z.ZodObject<{
            sheetsCount: z.ZodCoercedNumber<unknown>;
            namedRangesCount: z.ZodCoercedNumber<unknown>;
            totalCharts: z.ZodCoercedNumber<unknown>;
            totalConditionalFormats: z.ZodCoercedNumber<unknown>;
            totalProtectedRanges: z.ZodCoercedNumber<unknown>;
            cacheHit: z.ZodBoolean;
            fetchTime: z.ZodCoercedNumber<unknown>;
        }, z.core.$strip>>;
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
export declare const SheetsCoreOutputSchema: z.ZodObject<{
    response: z.ZodDiscriminatedUnion<[z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodString;
        spreadsheet: z.ZodOptional<z.ZodObject<{
            spreadsheetId: z.ZodString;
            title: z.ZodString;
            url: z.ZodOptional<z.ZodString>;
            locale: z.ZodOptional<z.ZodString>;
            timeZone: z.ZodOptional<z.ZodString>;
            sheets: z.ZodOptional<z.ZodArray<z.ZodObject<{
                sheetId: z.ZodNumber;
                title: z.ZodString;
                index: z.ZodNumber;
                rowCount: z.ZodNumber;
                columnCount: z.ZodNumber;
                hidden: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                tabColor: z.ZodOptional<z.ZodObject<{
                    red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                }, z.core.$strip>>;
            }, z.core.$strip>>>;
            createdTime: z.ZodOptional<z.ZodString>;
            modifiedTime: z.ZodOptional<z.ZodString>;
            owners: z.ZodOptional<z.ZodArray<z.ZodObject<{
                email: z.ZodOptional<z.ZodString>;
                displayName: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
            lastModifiedBy: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        spreadsheets: z.ZodOptional<z.ZodArray<z.ZodObject<{
            spreadsheetId: z.ZodString;
            title: z.ZodString;
            url: z.ZodOptional<z.ZodString>;
            locale: z.ZodOptional<z.ZodString>;
            timeZone: z.ZodOptional<z.ZodString>;
            sheets: z.ZodOptional<z.ZodArray<z.ZodObject<{
                sheetId: z.ZodNumber;
                title: z.ZodString;
                index: z.ZodNumber;
                rowCount: z.ZodNumber;
                columnCount: z.ZodNumber;
                hidden: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
                tabColor: z.ZodOptional<z.ZodObject<{
                    red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                    alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                }, z.core.$strip>>;
            }, z.core.$strip>>>;
            createdTime: z.ZodOptional<z.ZodString>;
            modifiedTime: z.ZodOptional<z.ZodString>;
            owners: z.ZodOptional<z.ZodArray<z.ZodObject<{
                email: z.ZodOptional<z.ZodString>;
                displayName: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>>;
            lastModifiedBy: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        url: z.ZodOptional<z.ZodString>;
        newSpreadsheetId: z.ZodOptional<z.ZodString>;
        sheet: z.ZodOptional<z.ZodObject<{
            sheetId: z.ZodNumber;
            title: z.ZodString;
            index: z.ZodNumber;
            rowCount: z.ZodNumber;
            columnCount: z.ZodNumber;
            hidden: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            tabColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        sheets: z.ZodOptional<z.ZodArray<z.ZodObject<{
            sheetId: z.ZodNumber;
            title: z.ZodString;
            index: z.ZodNumber;
            rowCount: z.ZodNumber;
            columnCount: z.ZodNumber;
            hidden: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            tabColor: z.ZodOptional<z.ZodObject<{
                red: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                green: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                blue: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                alpha: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>;
        copiedSheetId: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        alreadyDeleted: z.ZodOptional<z.ZodBoolean>;
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
        comprehensiveMetadata: z.ZodOptional<z.ZodObject<{
            spreadsheetId: z.ZodString;
            properties: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            namedRanges: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            sheets: z.ZodOptional<z.ZodArray<z.ZodObject<{
                properties: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                conditionalFormats: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
                protectedRanges: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
                charts: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
                filterViews: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
                basicFilter: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                merges: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
                data: z.ZodOptional<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
            }, z.core.$strip>>>;
            stats: z.ZodOptional<z.ZodObject<{
                sheetsCount: z.ZodCoercedNumber<unknown>;
                namedRangesCount: z.ZodCoercedNumber<unknown>;
                totalCharts: z.ZodCoercedNumber<unknown>;
                totalConditionalFormats: z.ZodCoercedNumber<unknown>;
                totalProtectedRanges: z.ZodCoercedNumber<unknown>;
                cacheHit: z.ZodBoolean;
                fetchTime: z.ZodCoercedNumber<unknown>;
            }, z.core.$strip>>;
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
 * Tool annotations for MCP protocol
 *
 * Combines annotations from spreadsheet and sheet tools:
 * - readOnlyHint: false (can modify data)
 * - destructiveHint: true (delete_sheet is destructive)
 * - idempotentHint: false (create, add, duplicate create new entities; delete without allowMissing fails)
 * - openWorldHint: true (interacts with Google Sheets API)
 */
export declare const SHEETS_CORE_ANNOTATIONS: ToolAnnotations;
export type SheetsCoreInput = z.infer<typeof SheetsCoreInputSchema>;
export type SheetsCoreOutput = z.infer<typeof SheetsCoreOutputSchema>;
export type CoreResponse = z.infer<typeof CoreResponseSchema>;
/** The unwrapped request type (the discriminated union of actions) */
export type CoreRequest = SheetsCoreInput['request'];
export type CoreGetInput = SheetsCoreInput['request'] & {
    action: 'get';
    spreadsheetId: string;
};
export type CoreCreateInput = SheetsCoreInput['request'] & {
    action: 'create';
    title: string;
};
export type CoreCopyInput = SheetsCoreInput['request'] & {
    action: 'copy';
    spreadsheetId: string;
};
export type CoreUpdatePropertiesInput = SheetsCoreInput['request'] & {
    action: 'update_properties';
    spreadsheetId: string;
};
export type CoreGetUrlInput = SheetsCoreInput['request'] & {
    action: 'get_url';
    spreadsheetId: string;
    sheetId?: number;
};
export type CoreBatchGetInput = SheetsCoreInput['request'] & {
    action: 'batch_get';
    spreadsheetIds: string[];
};
export type CoreGetComprehensiveInput = SheetsCoreInput['request'] & {
    action: 'get_comprehensive';
    spreadsheetId: string;
};
export type CoreListInput = SheetsCoreInput['request'] & {
    action: 'list';
};
export type CoreAddSheetInput = SheetsCoreInput['request'] & {
    action: 'add_sheet';
    spreadsheetId: string;
    title: string;
};
export type CoreDeleteSheetInput = SheetsCoreInput['request'] & {
    action: 'delete_sheet';
    spreadsheetId: string;
    sheetId: number;
};
export type CoreDuplicateSheetInput = SheetsCoreInput['request'] & {
    action: 'duplicate_sheet';
    spreadsheetId: string;
    sheetId: number;
};
export type CoreUpdateSheetInput = SheetsCoreInput['request'] & {
    action: 'update_sheet';
    spreadsheetId: string;
    sheetId: number;
};
export type CoreCopySheetToInput = SheetsCoreInput['request'] & {
    action: 'copy_sheet_to';
    spreadsheetId: string;
    sheetId: number;
    destinationSpreadsheetId: string;
};
export type CoreListSheetsInput = SheetsCoreInput['request'] & {
    action: 'list_sheets';
    spreadsheetId: string;
};
export type CoreGetSheetInput = SheetsCoreInput['request'] & {
    action: 'get_sheet';
    spreadsheetId: string;
    sheetId: number;
};
export {};
//# sourceMappingURL=core.d.ts.map