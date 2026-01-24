/**
 * Tool: sheets_templates
 * Manage reusable spreadsheet templates stored in Google Drive appDataFolder
 *
 * 8 actions: list, get, create, apply, update, delete, preview, import_builtin
 *
 * Storage: Google Drive appDataFolder (hidden, user-specific, auto-cleanup on uninstall)
 * Required scope: https://www.googleapis.com/auth/drive.appdata (non-sensitive)
 *
 * MCP Protocol: 2025-11-25
 */
import { z } from 'zod';
import { type ToolAnnotations } from './shared.js';
/**
 * Sheet definition within a template
 */
declare const TemplateSheetSchema: z.ZodObject<{
    name: z.ZodString;
    headers: z.ZodOptional<z.ZodArray<z.ZodString>>;
    columnWidths: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    rowCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    columnCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    frozenRowCount: z.ZodOptional<z.ZodNumber>;
    frozenColumnCount: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/**
 * Full template definition
 */
declare const TemplateDefinitionSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    version: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    created: z.ZodOptional<z.ZodString>;
    updated: z.ZodOptional<z.ZodString>;
    sheets: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        headers: z.ZodOptional<z.ZodArray<z.ZodString>>;
        columnWidths: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        rowCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        columnCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        frozenRowCount: z.ZodOptional<z.ZodNumber>;
        frozenColumnCount: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    namedRanges: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        range: z.ZodString;
    }, z.core.$strip>>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
/**
 * Template summary (for list responses)
 */
declare const TemplateSummarySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
    created: z.ZodOptional<z.ZodString>;
    updated: z.ZodOptional<z.ZodString>;
    sheetCount: z.ZodNumber;
}, z.core.$strip>;
export declare const SheetsTemplatesInputSchema: z.ZodObject<{
    request: z.ZodDiscriminatedUnion<[z.ZodObject<{
        action: z.ZodLiteral<"list">;
        category: z.ZodOptional<z.ZodString>;
        includeBuiltin: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"get">;
        templateId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"create">;
        spreadsheetId: z.ZodString;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodString>;
        includeData: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        includeFormatting: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"apply">;
        templateId: z.ZodString;
        title: z.ZodString;
        folderId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"update">;
        templateId: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodString>;
        sheets: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            headers: z.ZodOptional<z.ZodArray<z.ZodString>>;
            columnWidths: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
            rowCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            columnCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            frozenRowCount: z.ZodOptional<z.ZodNumber>;
            frozenColumnCount: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>>;
        namedRanges: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            range: z.ZodString;
        }, z.core.$strip>>>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"delete">;
        templateId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"preview">;
        templateId: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"import_builtin">;
        builtinName: z.ZodString;
        customName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>], "action">;
}, z.core.$strip>;
declare const TemplatesResponseSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    success: z.ZodLiteral<true>;
    action: z.ZodString;
    templates: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodString>;
        version: z.ZodOptional<z.ZodString>;
        created: z.ZodOptional<z.ZodString>;
        updated: z.ZodOptional<z.ZodString>;
        sheetCount: z.ZodNumber;
    }, z.core.$strip>>>;
    template: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodString>;
        version: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        created: z.ZodOptional<z.ZodString>;
        updated: z.ZodOptional<z.ZodString>;
        sheets: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            headers: z.ZodOptional<z.ZodArray<z.ZodString>>;
            columnWidths: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
            rowCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            columnCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            frozenRowCount: z.ZodOptional<z.ZodNumber>;
            frozenColumnCount: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        namedRanges: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            range: z.ZodString;
        }, z.core.$strip>>>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
    spreadsheetId: z.ZodOptional<z.ZodString>;
    spreadsheetUrl: z.ZodOptional<z.ZodString>;
    preview: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        sheets: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            headers: z.ZodOptional<z.ZodArray<z.ZodString>>;
            rowCount: z.ZodOptional<z.ZodNumber>;
            columnCount: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        namedRanges: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    deleted: z.ZodOptional<z.ZodBoolean>;
    importedTemplateId: z.ZodOptional<z.ZodString>;
    totalTemplates: z.ZodOptional<z.ZodNumber>;
    builtinCount: z.ZodOptional<z.ZodNumber>;
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
            none: "none";
            exponential_backoff: "exponential_backoff";
            wait_for_reset: "wait_for_reset";
            manual: "manual";
        }>>;
        suggestedTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>], "success">;
export declare const SheetsTemplatesOutputSchema: z.ZodObject<{
    response: z.ZodDiscriminatedUnion<[z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodString;
        templates: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            category: z.ZodOptional<z.ZodString>;
            version: z.ZodOptional<z.ZodString>;
            created: z.ZodOptional<z.ZodString>;
            updated: z.ZodOptional<z.ZodString>;
            sheetCount: z.ZodNumber;
        }, z.core.$strip>>>;
        template: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            category: z.ZodOptional<z.ZodString>;
            version: z.ZodDefault<z.ZodOptional<z.ZodString>>;
            created: z.ZodOptional<z.ZodString>;
            updated: z.ZodOptional<z.ZodString>;
            sheets: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                headers: z.ZodOptional<z.ZodArray<z.ZodString>>;
                columnWidths: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
                rowCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                columnCount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
                frozenRowCount: z.ZodOptional<z.ZodNumber>;
                frozenColumnCount: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            namedRanges: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                range: z.ZodString;
            }, z.core.$strip>>>;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
        spreadsheetId: z.ZodOptional<z.ZodString>;
        spreadsheetUrl: z.ZodOptional<z.ZodString>;
        preview: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            sheets: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                headers: z.ZodOptional<z.ZodArray<z.ZodString>>;
                rowCount: z.ZodOptional<z.ZodNumber>;
                columnCount: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            namedRanges: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        deleted: z.ZodOptional<z.ZodBoolean>;
        importedTemplateId: z.ZodOptional<z.ZodString>;
        totalTemplates: z.ZodOptional<z.ZodNumber>;
        builtinCount: z.ZodOptional<z.ZodNumber>;
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
                none: "none";
                exponential_backoff: "exponential_backoff";
                wait_for_reset: "wait_for_reset";
                manual: "manual";
            }>>;
            suggestedTools: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>], "success">;
}, z.core.$strip>;
/**
 * Tool annotations for MCP protocol
 *
 * - readOnlyHint: false (can create/update/delete templates)
 * - destructiveHint: true (delete action removes templates)
 * - idempotentHint: false (create/apply create new resources)
 * - openWorldHint: true (interacts with Google Drive API)
 */
export declare const SHEETS_TEMPLATES_ANNOTATIONS: ToolAnnotations;
export type SheetsTemplatesInput = z.infer<typeof SheetsTemplatesInputSchema>;
export type SheetsTemplatesOutput = z.infer<typeof SheetsTemplatesOutputSchema>;
export type TemplatesResponse = z.infer<typeof TemplatesResponseSchema>;
export type TemplatesRequest = SheetsTemplatesInput['request'];
export type TemplateDefinition = z.infer<typeof TemplateDefinitionSchema>;
export type TemplateSummary = z.infer<typeof TemplateSummarySchema>;
export type TemplateSheet = z.infer<typeof TemplateSheetSchema>;
export type TemplatesListInput = SheetsTemplatesInput['request'] & {
    action: 'list';
};
export type TemplatesGetInput = SheetsTemplatesInput['request'] & {
    action: 'get';
    templateId: string;
};
export type TemplatesCreateInput = SheetsTemplatesInput['request'] & {
    action: 'create';
    spreadsheetId: string;
    name: string;
};
export type TemplatesApplyInput = SheetsTemplatesInput['request'] & {
    action: 'apply';
    templateId: string;
    title: string;
};
export type TemplatesUpdateInput = SheetsTemplatesInput['request'] & {
    action: 'update';
    templateId: string;
};
export type TemplatesDeleteInput = SheetsTemplatesInput['request'] & {
    action: 'delete';
    templateId: string;
};
export type TemplatesPreviewInput = SheetsTemplatesInput['request'] & {
    action: 'preview';
    templateId: string;
};
export type TemplatesImportBuiltinInput = SheetsTemplatesInput['request'] & {
    action: 'import_builtin';
    builtinName: string;
};
export {};
//# sourceMappingURL=templates.d.ts.map