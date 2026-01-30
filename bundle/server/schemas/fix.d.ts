/**
 * ServalSheets - Fix Tool Schema
 *
 * Automated issue resolution based on analysis results.
 * Takes issues from sheets_analyze and applies fixes.
 */
import { z } from 'zod';
export declare const FixableIssueTypeSchema: z.ZodEnum<{
    MULTIPLE_TODAY: "MULTIPLE_TODAY";
    FULL_COLUMN_REFS: "FULL_COLUMN_REFS";
    NO_FROZEN_HEADERS: "NO_FROZEN_HEADERS";
    NO_FROZEN_COLUMNS: "NO_FROZEN_COLUMNS";
    NO_PROTECTION: "NO_PROTECTION";
    NESTED_IFERROR: "NESTED_IFERROR";
    EXCESSIVE_CF_RULES: "EXCESSIVE_CF_RULES";
}>;
export type FixableIssueType = z.infer<typeof FixableIssueTypeSchema>;
export declare const FixModeSchema: z.ZodEnum<{
    preview: "preview";
    apply: "apply";
}>;
export type FixMode = z.infer<typeof FixModeSchema>;
export declare const IssueToFixSchema: z.ZodObject<{
    type: z.ZodEnum<{
        MULTIPLE_TODAY: "MULTIPLE_TODAY";
        FULL_COLUMN_REFS: "FULL_COLUMN_REFS";
        NO_FROZEN_HEADERS: "NO_FROZEN_HEADERS";
        NO_FROZEN_COLUMNS: "NO_FROZEN_COLUMNS";
        NO_PROTECTION: "NO_PROTECTION";
        NESTED_IFERROR: "NESTED_IFERROR";
        EXCESSIVE_CF_RULES: "EXCESSIVE_CF_RULES";
    }>;
    severity: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    sheet: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type IssueToFix = z.infer<typeof IssueToFixSchema>;
export declare const FixOperationSchema: z.ZodObject<{
    id: z.ZodString;
    issueType: z.ZodEnum<{
        MULTIPLE_TODAY: "MULTIPLE_TODAY";
        FULL_COLUMN_REFS: "FULL_COLUMN_REFS";
        NO_FROZEN_HEADERS: "NO_FROZEN_HEADERS";
        NO_FROZEN_COLUMNS: "NO_FROZEN_COLUMNS";
        NO_PROTECTION: "NO_PROTECTION";
        NESTED_IFERROR: "NESTED_IFERROR";
        EXCESSIVE_CF_RULES: "EXCESSIVE_CF_RULES";
    }>;
    tool: z.ZodString;
    action: z.ZodString;
    parameters: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    estimatedImpact: z.ZodString;
    risk: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
}, z.core.$strip>;
export type FixOperation = z.infer<typeof FixOperationSchema>;
export declare const FixResultSchema: z.ZodObject<{
    operationId: z.ZodString;
    success: z.ZodBoolean;
    message: z.ZodString;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type FixResult = z.infer<typeof FixResultSchema>;
export declare const SheetsFixResponseSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    success: z.ZodLiteral<true>;
    mode: z.ZodEnum<{
        preview: "preview";
        apply: "apply";
    }>;
    operations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        issueType: z.ZodEnum<{
            MULTIPLE_TODAY: "MULTIPLE_TODAY";
            FULL_COLUMN_REFS: "FULL_COLUMN_REFS";
            NO_FROZEN_HEADERS: "NO_FROZEN_HEADERS";
            NO_FROZEN_COLUMNS: "NO_FROZEN_COLUMNS";
            NO_PROTECTION: "NO_PROTECTION";
            NESTED_IFERROR: "NESTED_IFERROR";
            EXCESSIVE_CF_RULES: "EXCESSIVE_CF_RULES";
        }>;
        tool: z.ZodString;
        action: z.ZodString;
        parameters: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        estimatedImpact: z.ZodString;
        risk: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
    }, z.core.$strip>>;
    results: z.ZodOptional<z.ZodArray<z.ZodObject<{
        operationId: z.ZodString;
        success: z.ZodBoolean;
        message: z.ZodString;
        error: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    snapshotId: z.ZodOptional<z.ZodString>;
    summary: z.ZodObject<{
        total: z.ZodNumber;
        applied: z.ZodOptional<z.ZodNumber>;
        failed: z.ZodOptional<z.ZodNumber>;
        skipped: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    message: z.ZodString;
    verificationScore: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    success: z.ZodLiteral<false>;
    error: z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodUnknown>;
        retryable: z.ZodBoolean;
        suggestedFix: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>], "success">;
export type SheetsFixResponse = z.infer<typeof SheetsFixResponseSchema>;
export declare const SheetsFixInputSchema: z.ZodObject<{
    request: z.ZodDiscriminatedUnion<[z.ZodObject<{
        action: z.ZodLiteral<"fix">;
        spreadsheetId: z.ZodString;
        issues: z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                MULTIPLE_TODAY: "MULTIPLE_TODAY";
                FULL_COLUMN_REFS: "FULL_COLUMN_REFS";
                NO_FROZEN_HEADERS: "NO_FROZEN_HEADERS";
                NO_FROZEN_COLUMNS: "NO_FROZEN_COLUMNS";
                NO_PROTECTION: "NO_PROTECTION";
                NESTED_IFERROR: "NESTED_IFERROR";
                EXCESSIVE_CF_RULES: "EXCESSIVE_CF_RULES";
            }>;
            severity: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
            sheet: z.ZodOptional<z.ZodString>;
            description: z.ZodString;
            metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>>;
        mode: z.ZodOptional<z.ZodEnum<{
            preview: "preview";
            apply: "apply";
        }>>;
        filters: z.ZodOptional<z.ZodObject<{
            severity: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>>>;
            types: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                MULTIPLE_TODAY: "MULTIPLE_TODAY";
                FULL_COLUMN_REFS: "FULL_COLUMN_REFS";
                NO_FROZEN_HEADERS: "NO_FROZEN_HEADERS";
                NO_FROZEN_COLUMNS: "NO_FROZEN_COLUMNS";
                NO_PROTECTION: "NO_PROTECTION";
                NESTED_IFERROR: "NESTED_IFERROR";
                EXCESSIVE_CF_RULES: "EXCESSIVE_CF_RULES";
            }>>>;
            sheets: z.ZodOptional<z.ZodArray<z.ZodString>>;
            limit: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        safety: z.ZodOptional<z.ZodObject<{
            createSnapshot: z.ZodDefault<z.ZodBoolean>;
            dryRun: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>], "action">;
}, z.core.$strip>;
export declare const SheetsFixOutputSchema: z.ZodObject<{
    response: z.ZodDiscriminatedUnion<[z.ZodObject<{
        success: z.ZodLiteral<true>;
        mode: z.ZodEnum<{
            preview: "preview";
            apply: "apply";
        }>;
        operations: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            issueType: z.ZodEnum<{
                MULTIPLE_TODAY: "MULTIPLE_TODAY";
                FULL_COLUMN_REFS: "FULL_COLUMN_REFS";
                NO_FROZEN_HEADERS: "NO_FROZEN_HEADERS";
                NO_FROZEN_COLUMNS: "NO_FROZEN_COLUMNS";
                NO_PROTECTION: "NO_PROTECTION";
                NESTED_IFERROR: "NESTED_IFERROR";
                EXCESSIVE_CF_RULES: "EXCESSIVE_CF_RULES";
            }>;
            tool: z.ZodString;
            action: z.ZodString;
            parameters: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            estimatedImpact: z.ZodString;
            risk: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
        }, z.core.$strip>>;
        results: z.ZodOptional<z.ZodArray<z.ZodObject<{
            operationId: z.ZodString;
            success: z.ZodBoolean;
            message: z.ZodString;
            error: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        snapshotId: z.ZodOptional<z.ZodString>;
        summary: z.ZodObject<{
            total: z.ZodNumber;
            applied: z.ZodOptional<z.ZodNumber>;
            failed: z.ZodOptional<z.ZodNumber>;
            skipped: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        message: z.ZodString;
        verificationScore: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        success: z.ZodLiteral<false>;
        error: z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
            details: z.ZodOptional<z.ZodUnknown>;
            retryable: z.ZodBoolean;
            suggestedFix: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>], "success">;
}, z.core.$strip>;
export type SheetsFixInput = z.infer<typeof SheetsFixInputSchema>;
export type SheetsFixOutput = z.infer<typeof SheetsFixOutputSchema>;
/** The unwrapped request type (the discriminated union of actions) */
export type FixRequest = SheetsFixInput['request'];
export type FixInput = SheetsFixInput['request'] & {
    action: 'fix';
    spreadsheetId: string;
    issues: IssueToFix[];
};
import type { ToolAnnotations } from './shared.js';
export declare const SHEETS_FIX_ANNOTATIONS: ToolAnnotations;
//# sourceMappingURL=fix.d.ts.map