/**
 * Tool: sheets_quality
 * Enterprise quality assurance: validation, conflict detection, and impact analysis.
 *
 * Actions (4):
 * - validate: Data validation with built-in validators
 * - detect_conflicts: Detect concurrent modification conflicts
 * - resolve_conflict: Resolve detected conflicts with strategies
 * - analyze_impact: Pre-execution impact analysis with dependency tracking
 */
import { z } from 'zod';
import { type ToolAnnotations } from './shared.js';
/**
 * All quality assurance operation inputs
 *
 * Proper discriminated union using Zod v4's z.discriminatedUnion() for:
 * - Better type safety at compile-time
 * - Clearer error messages for LLMs
 * - Each action has only its required fields (no optional field pollution)
 * - JSON Schema conversion handled by src/utils/schema-compat.ts
 */
export declare const SheetsQualityInputSchema: z.ZodObject<{
    request: z.ZodDiscriminatedUnion<[z.ZodObject<{
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
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"validate">;
        value: z.ZodUnknown;
        rules: z.ZodOptional<z.ZodArray<z.ZodString>>;
        context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        stopOnFirstError: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>, z.ZodObject<{
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
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"detect_conflicts">;
        spreadsheetId: z.ZodString;
        range: z.ZodOptional<z.ZodString>;
        since: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
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
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"resolve_conflict">;
        conflictId: z.ZodString;
        strategy: z.ZodEnum<{
            manual: "manual";
            keep_local: "keep_local";
            keep_remote: "keep_remote";
            merge: "merge";
        }>;
        mergedValue: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
    }, z.core.$strip>, z.ZodObject<{
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
        verbosity: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            minimal: "minimal";
            standard: "standard";
            detailed: "detailed";
        }>>>;
        action: z.ZodLiteral<"analyze_impact">;
        spreadsheetId: z.ZodString;
        operation: z.ZodObject<{
            type: z.ZodString;
            tool: z.ZodString;
            action: z.ZodString;
            params: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>;
    }, z.core.$strip>], "action">;
}, z.core.$strip>;
declare const QualityResponseSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    success: z.ZodLiteral<true>;
    action: z.ZodString;
    valid: z.ZodOptional<z.ZodBoolean>;
    errorCount: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    warningCount: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    infoCount: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    totalChecks: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    passedChecks: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    errors: z.ZodOptional<z.ZodArray<z.ZodObject<{
        ruleId: z.ZodString;
        ruleName: z.ZodString;
        severity: z.ZodEnum<{
            error: "error";
            warning: "warning";
            info: "info";
        }>;
        message: z.ZodString;
        actualValue: z.ZodOptional<z.ZodUnknown>;
        expectedValue: z.ZodOptional<z.ZodUnknown>;
        path: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    warnings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        ruleId: z.ZodString;
        ruleName: z.ZodString;
        message: z.ZodString;
    }, z.core.$strip>>>;
    duration: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    dryRun: z.ZodOptional<z.ZodBoolean>;
    validationPreview: z.ZodOptional<z.ZodObject<{
        wouldApply: z.ZodBoolean;
        affectedCells: z.ZodOptional<z.ZodNumber>;
        rulesPreview: z.ZodOptional<z.ZodArray<z.ZodObject<{
            ruleId: z.ZodString;
            condition: z.ZodString;
            cellsAffected: z.ZodCoercedNumber<unknown>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    conflicts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        spreadsheetId: z.ZodString;
        range: z.ZodString;
        localVersion: z.ZodCoercedNumber<unknown>;
        remoteVersion: z.ZodCoercedNumber<unknown>;
        localValue: z.ZodUnknown;
        remoteValue: z.ZodUnknown;
        conflictType: z.ZodEnum<{
            concurrent_write: "concurrent_write";
            version_mismatch: "version_mismatch";
            data_race: "data_race";
        }>;
        severity: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
            critical: "critical";
        }>;
        detectedAt: z.ZodCoercedNumber<unknown>;
        suggestedStrategy: z.ZodEnum<{
            manual: "manual";
            keep_local: "keep_local";
            keep_remote: "keep_remote";
            merge: "merge";
        }>;
    }, z.core.$strip>>>;
    conflictId: z.ZodOptional<z.ZodString>;
    resolved: z.ZodOptional<z.ZodBoolean>;
    resolution: z.ZodOptional<z.ZodObject<{
        strategy: z.ZodString;
        finalValue: z.ZodUnknown;
        version: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>>;
    impact: z.ZodOptional<z.ZodObject<{
        severity: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
            critical: "critical";
        }>;
        scope: z.ZodObject<{
            rows: z.ZodCoercedNumber<unknown>;
            columns: z.ZodCoercedNumber<unknown>;
            cells: z.ZodCoercedNumber<unknown>;
            sheets: z.ZodArray<z.ZodString>;
        }, z.core.$strip>;
        affectedResources: z.ZodObject<{
            formulas: z.ZodArray<z.ZodString>;
            charts: z.ZodArray<z.ZodString>;
            pivotTables: z.ZodArray<z.ZodString>;
            validationRules: z.ZodArray<z.ZodString>;
            namedRanges: z.ZodArray<z.ZodString>;
            protectedRanges: z.ZodArray<z.ZodString>;
        }, z.core.$strip>;
        estimatedExecutionTime: z.ZodCoercedNumber<unknown>;
        warnings: z.ZodArray<z.ZodObject<{
            severity: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
                critical: "critical";
            }>;
            message: z.ZodString;
            affectedResources: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        recommendations: z.ZodArray<z.ZodObject<{
            action: z.ZodString;
            reason: z.ZodString;
            priority: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
        }, z.core.$strip>>;
        canProceed: z.ZodBoolean;
        requiresConfirmation: z.ZodBoolean;
    }, z.core.$strip>>;
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
export declare const SheetsQualityOutputSchema: z.ZodObject<{
    response: z.ZodDiscriminatedUnion<[z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodString;
        valid: z.ZodOptional<z.ZodBoolean>;
        errorCount: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        warningCount: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        infoCount: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        totalChecks: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        passedChecks: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        errors: z.ZodOptional<z.ZodArray<z.ZodObject<{
            ruleId: z.ZodString;
            ruleName: z.ZodString;
            severity: z.ZodEnum<{
                error: "error";
                warning: "warning";
                info: "info";
            }>;
            message: z.ZodString;
            actualValue: z.ZodOptional<z.ZodUnknown>;
            expectedValue: z.ZodOptional<z.ZodUnknown>;
            path: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        warnings: z.ZodOptional<z.ZodArray<z.ZodObject<{
            ruleId: z.ZodString;
            ruleName: z.ZodString;
            message: z.ZodString;
        }, z.core.$strip>>>;
        duration: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        dryRun: z.ZodOptional<z.ZodBoolean>;
        validationPreview: z.ZodOptional<z.ZodObject<{
            wouldApply: z.ZodBoolean;
            affectedCells: z.ZodOptional<z.ZodNumber>;
            rulesPreview: z.ZodOptional<z.ZodArray<z.ZodObject<{
                ruleId: z.ZodString;
                condition: z.ZodString;
                cellsAffected: z.ZodCoercedNumber<unknown>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
        conflicts: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            spreadsheetId: z.ZodString;
            range: z.ZodString;
            localVersion: z.ZodCoercedNumber<unknown>;
            remoteVersion: z.ZodCoercedNumber<unknown>;
            localValue: z.ZodUnknown;
            remoteValue: z.ZodUnknown;
            conflictType: z.ZodEnum<{
                concurrent_write: "concurrent_write";
                version_mismatch: "version_mismatch";
                data_race: "data_race";
            }>;
            severity: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
                critical: "critical";
            }>;
            detectedAt: z.ZodCoercedNumber<unknown>;
            suggestedStrategy: z.ZodEnum<{
                manual: "manual";
                keep_local: "keep_local";
                keep_remote: "keep_remote";
                merge: "merge";
            }>;
        }, z.core.$strip>>>;
        conflictId: z.ZodOptional<z.ZodString>;
        resolved: z.ZodOptional<z.ZodBoolean>;
        resolution: z.ZodOptional<z.ZodObject<{
            strategy: z.ZodString;
            finalValue: z.ZodUnknown;
            version: z.ZodCoercedNumber<unknown>;
        }, z.core.$strip>>;
        impact: z.ZodOptional<z.ZodObject<{
            severity: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
                critical: "critical";
            }>;
            scope: z.ZodObject<{
                rows: z.ZodCoercedNumber<unknown>;
                columns: z.ZodCoercedNumber<unknown>;
                cells: z.ZodCoercedNumber<unknown>;
                sheets: z.ZodArray<z.ZodString>;
            }, z.core.$strip>;
            affectedResources: z.ZodObject<{
                formulas: z.ZodArray<z.ZodString>;
                charts: z.ZodArray<z.ZodString>;
                pivotTables: z.ZodArray<z.ZodString>;
                validationRules: z.ZodArray<z.ZodString>;
                namedRanges: z.ZodArray<z.ZodString>;
                protectedRanges: z.ZodArray<z.ZodString>;
            }, z.core.$strip>;
            estimatedExecutionTime: z.ZodCoercedNumber<unknown>;
            warnings: z.ZodArray<z.ZodObject<{
                severity: z.ZodEnum<{
                    low: "low";
                    medium: "medium";
                    high: "high";
                    critical: "critical";
                }>;
                message: z.ZodString;
                affectedResources: z.ZodOptional<z.ZodArray<z.ZodString>>;
            }, z.core.$strip>>;
            recommendations: z.ZodArray<z.ZodObject<{
                action: z.ZodString;
                reason: z.ZodString;
                priority: z.ZodEnum<{
                    low: "low";
                    medium: "medium";
                    high: "high";
                }>;
            }, z.core.$strip>>;
            canProceed: z.ZodBoolean;
            requiresConfirmation: z.ZodBoolean;
        }, z.core.$strip>>;
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
export declare const SHEETS_QUALITY_ANNOTATIONS: ToolAnnotations;
export type SheetsQualityInput = z.infer<typeof SheetsQualityInputSchema>;
export type SheetsQualityOutput = z.infer<typeof SheetsQualityOutputSchema>;
export type QualityResponse = z.infer<typeof QualityResponseSchema>;
export type QualityValidateInput = SheetsQualityInput['request'] & {
    action: 'validate';
    value: unknown;
};
export type QualityDetectConflictsInput = SheetsQualityInput['request'] & {
    action: 'detect_conflicts';
    spreadsheetId: string;
};
export type QualityResolveConflictInput = SheetsQualityInput['request'] & {
    action: 'resolve_conflict';
    conflictId: string;
    strategy: 'keep_local' | 'keep_remote' | 'merge' | 'manual';
};
export type QualityAnalyzeImpactInput = SheetsQualityInput['request'] & {
    action: 'analyze_impact';
    spreadsheetId: string;
    operation: {
        type: string;
        tool: string;
        action: string;
        params: Record<string, unknown>;
    };
};
export {};
//# sourceMappingURL=quality.d.ts.map