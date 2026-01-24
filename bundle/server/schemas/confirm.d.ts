/**
 * Tool: sheets_confirm
 *
 * Uses MCP Elicitation (SEP-1036) for user confirmation before executing
 * multi-step operations. This is the correct MCP pattern:
 * - Claude plans the operations
 * - This tool presents the plan for user confirmation
 * - User approves/modifies/rejects via Elicitation
 *
 * @see MCP_PROTOCOL_COMPLETE_REFERENCE.md - Elicitation section
 */
import { z } from 'zod';
import { type ToolAnnotations } from './shared.js';
/**
 * Risk level schema
 */
declare const RiskLevelSchema: z.ZodEnum<{
    low: "low";
    medium: "medium";
    high: "high";
    critical: "critical";
}>;
/**
 * Plan step schema
 */
declare const PlanStepSchema: z.ZodObject<{
    stepNumber: z.ZodCoercedNumber<unknown>;
    description: z.ZodString;
    tool: z.ZodString;
    action: z.ZodString;
    risk: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        critical: "critical";
    }>;
    estimatedApiCalls: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    isDestructive: z.ZodOptional<z.ZodBoolean>;
    canUndo: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
/**
 * Operation plan schema for confirmation
 */
declare const OperationPlanSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    steps: z.ZodArray<z.ZodObject<{
        stepNumber: z.ZodCoercedNumber<unknown>;
        description: z.ZodString;
        tool: z.ZodString;
        action: z.ZodString;
        risk: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
            critical: "critical";
        }>;
        estimatedApiCalls: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        isDestructive: z.ZodOptional<z.ZodBoolean>;
        canUndo: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>;
    willCreateSnapshot: z.ZodDefault<z.ZodBoolean>;
    additionalWarnings: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
/**
 * Wizard step definition for multi-step flows
 */
declare const WizardStepDefSchema: z.ZodObject<{
    stepId: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    fields: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        label: z.ZodString;
        type: z.ZodEnum<{
            number: "number";
            boolean: "boolean";
            text: "text";
            select: "select";
            multiselect: "multiselect";
        }>;
        required: z.ZodDefault<z.ZodBoolean>;
        options: z.ZodOptional<z.ZodArray<z.ZodString>>;
        default: z.ZodOptional<z.ZodUnknown>;
        validation: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    dependsOn: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const SheetsConfirmInputSchema: z.ZodObject<{
    request: z.ZodDiscriminatedUnion<[z.ZodObject<{
        action: z.ZodLiteral<"request">;
        plan: z.ZodObject<{
            title: z.ZodString;
            description: z.ZodString;
            steps: z.ZodArray<z.ZodObject<{
                stepNumber: z.ZodCoercedNumber<unknown>;
                description: z.ZodString;
                tool: z.ZodString;
                action: z.ZodString;
                risk: z.ZodEnum<{
                    low: "low";
                    medium: "medium";
                    high: "high";
                    critical: "critical";
                }>;
                estimatedApiCalls: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
                isDestructive: z.ZodOptional<z.ZodBoolean>;
                canUndo: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strip>>;
            willCreateSnapshot: z.ZodDefault<z.ZodBoolean>;
            additionalWarnings: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"get_stats">;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"wizard_start">;
        wizardId: z.ZodOptional<z.ZodString>;
        title: z.ZodString;
        description: z.ZodString;
        steps: z.ZodArray<z.ZodObject<{
            stepId: z.ZodString;
            title: z.ZodString;
            description: z.ZodString;
            fields: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                label: z.ZodString;
                type: z.ZodEnum<{
                    number: "number";
                    boolean: "boolean";
                    text: "text";
                    select: "select";
                    multiselect: "multiselect";
                }>;
                required: z.ZodDefault<z.ZodBoolean>;
                options: z.ZodOptional<z.ZodArray<z.ZodString>>;
                default: z.ZodOptional<z.ZodUnknown>;
                validation: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            dependsOn: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"wizard_step">;
        wizardId: z.ZodString;
        stepId: z.ZodString;
        values: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        direction: z.ZodDefault<z.ZodEnum<{
            next: "next";
            back: "back";
            skip: "skip";
        }>>;
    }, z.core.$strip>, z.ZodObject<{
        action: z.ZodLiteral<"wizard_complete">;
        wizardId: z.ZodString;
        executeImmediately: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>], "action">;
}, z.core.$strip>;
/**
 * Wizard state schema
 */
declare const WizardStateSchema: z.ZodObject<{
    wizardId: z.ZodString;
    title: z.ZodString;
    currentStepIndex: z.ZodNumber;
    totalSteps: z.ZodNumber;
    currentStepId: z.ZodString;
    completedSteps: z.ZodArray<z.ZodString>;
    collectedValues: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    isComplete: z.ZodBoolean;
}, z.core.$strip>;
/**
 * Response schema
 */
declare const ConfirmResponseSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    success: z.ZodLiteral<true>;
    action: z.ZodString;
    planId: z.ZodOptional<z.ZodString>;
    confirmation: z.ZodOptional<z.ZodObject<{
        approved: z.ZodBoolean;
        action: z.ZodEnum<{
            accept: "accept";
            decline: "decline";
            cancel: "cancel";
        }>;
        modifications: z.ZodOptional<z.ZodString>;
        timestamp: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>>;
    stats: z.ZodOptional<z.ZodObject<{
        totalConfirmations: z.ZodCoercedNumber<unknown>;
        approved: z.ZodCoercedNumber<unknown>;
        declined: z.ZodCoercedNumber<unknown>;
        cancelled: z.ZodCoercedNumber<unknown>;
        approvalRate: z.ZodCoercedNumber<unknown>;
        avgResponseTime: z.ZodCoercedNumber<unknown>;
    }, z.core.$strip>>;
    wizard: z.ZodOptional<z.ZodObject<{
        wizardId: z.ZodString;
        title: z.ZodString;
        currentStepIndex: z.ZodNumber;
        totalSteps: z.ZodNumber;
        currentStepId: z.ZodString;
        completedSteps: z.ZodArray<z.ZodString>;
        collectedValues: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        isComplete: z.ZodBoolean;
    }, z.core.$strip>>;
    nextStep: z.ZodOptional<z.ZodObject<{
        stepId: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        fields: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            label: z.ZodString;
            type: z.ZodEnum<{
                number: "number";
                boolean: "boolean";
                text: "text";
                select: "select";
                multiselect: "multiselect";
            }>;
            required: z.ZodDefault<z.ZodBoolean>;
            options: z.ZodOptional<z.ZodArray<z.ZodString>>;
            default: z.ZodOptional<z.ZodUnknown>;
            validation: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        dependsOn: z.ZodOptional<z.ZodString>;
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
export declare const SheetsConfirmOutputSchema: z.ZodObject<{
    response: z.ZodDiscriminatedUnion<[z.ZodObject<{
        success: z.ZodLiteral<true>;
        action: z.ZodString;
        planId: z.ZodOptional<z.ZodString>;
        confirmation: z.ZodOptional<z.ZodObject<{
            approved: z.ZodBoolean;
            action: z.ZodEnum<{
                accept: "accept";
                decline: "decline";
                cancel: "cancel";
            }>;
            modifications: z.ZodOptional<z.ZodString>;
            timestamp: z.ZodCoercedNumber<unknown>;
        }, z.core.$strip>>;
        stats: z.ZodOptional<z.ZodObject<{
            totalConfirmations: z.ZodCoercedNumber<unknown>;
            approved: z.ZodCoercedNumber<unknown>;
            declined: z.ZodCoercedNumber<unknown>;
            cancelled: z.ZodCoercedNumber<unknown>;
            approvalRate: z.ZodCoercedNumber<unknown>;
            avgResponseTime: z.ZodCoercedNumber<unknown>;
        }, z.core.$strip>>;
        wizard: z.ZodOptional<z.ZodObject<{
            wizardId: z.ZodString;
            title: z.ZodString;
            currentStepIndex: z.ZodNumber;
            totalSteps: z.ZodNumber;
            currentStepId: z.ZodString;
            completedSteps: z.ZodArray<z.ZodString>;
            collectedValues: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            isComplete: z.ZodBoolean;
        }, z.core.$strip>>;
        nextStep: z.ZodOptional<z.ZodObject<{
            stepId: z.ZodString;
            title: z.ZodString;
            description: z.ZodString;
            fields: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                label: z.ZodString;
                type: z.ZodEnum<{
                    number: "number";
                    boolean: "boolean";
                    text: "text";
                    select: "select";
                    multiselect: "multiselect";
                }>;
                required: z.ZodDefault<z.ZodBoolean>;
                options: z.ZodOptional<z.ZodArray<z.ZodString>>;
                default: z.ZodOptional<z.ZodUnknown>;
                validation: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            dependsOn: z.ZodOptional<z.ZodString>;
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
/**
 * Tool annotations following MCP 2025-11-25
 */
export declare const SHEETS_CONFIRM_ANNOTATIONS: ToolAnnotations;
export type SheetsConfirmInput = z.infer<typeof SheetsConfirmInputSchema>;
export type SheetsConfirmOutput = z.infer<typeof SheetsConfirmOutputSchema>;
export type ConfirmResponse = z.infer<typeof ConfirmResponseSchema>;
export type PlanStep = z.infer<typeof PlanStepSchema>;
export type OperationPlan = z.infer<typeof OperationPlanSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type WizardStepDef = z.infer<typeof WizardStepDefSchema>;
export type WizardState = z.infer<typeof WizardStateSchema>;
export type ConfirmRequestInput = SheetsConfirmInput['request'] & {
    action: 'request';
    plan: OperationPlan;
};
export type ConfirmGetStatsInput = SheetsConfirmInput['request'] & {
    action: 'get_stats';
};
export type ConfirmWizardStartInput = SheetsConfirmInput['request'] & {
    action: 'wizard_start';
    title: string;
    description: string;
    steps: WizardStepDef[];
};
export type ConfirmWizardStepInput = SheetsConfirmInput['request'] & {
    action: 'wizard_step';
    wizardId: string;
    stepId: string;
    values: Record<string, unknown>;
};
export type ConfirmWizardCompleteInput = SheetsConfirmInput['request'] & {
    action: 'wizard_complete';
    wizardId: string;
};
export {};
//# sourceMappingURL=confirm.d.ts.map