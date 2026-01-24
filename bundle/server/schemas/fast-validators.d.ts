/**
 * ServalSheets - Fast Validators
 *
 * Pre-compiled validators for ALL 16 tools (after Wave 5 consolidation).
 * These perform FAST validation (action + required fields only).
 * Full Zod validation happens in handlers for type safety.
 *
 * Purpose: Catch obvious errors early with minimal overhead.
 * Pattern: Return raw input after basic checks (handlers do full parsing)
 */
export declare class FastValidationError extends Error {
    code: string;
    details?: Record<string, unknown>;
    constructor(code: string, message: string, details?: Record<string, unknown>);
    toErrorDetail(): {
        code: 'INVALID_PARAMS';
        message: string;
        details: Record<string, unknown>;
        retryable: boolean;
    };
}
export declare function fastValidateAuth(input: Record<string, unknown>): void;
export declare function fastValidateCore(input: Record<string, unknown>): void;
export declare function fastValidateData(input: Record<string, unknown>): void;
export declare function fastValidateFormat(input: Record<string, unknown>): void;
export declare function fastValidateDimensions(input: Record<string, unknown>): void;
export declare function fastValidateVisualize(input: Record<string, unknown>): void;
export declare function fastValidateCollaborate(input: Record<string, unknown>): void;
export declare function fastValidateAdvanced(input: Record<string, unknown>): void;
export declare function fastValidateTransaction(input: Record<string, unknown>): void;
export declare function fastValidateQuality(input: Record<string, unknown>): void;
export declare function fastValidateHistory(input: Record<string, unknown>): void;
export declare function fastValidateConfirm(input: Record<string, unknown>): void;
export declare function fastValidateAnalyze(input: Record<string, unknown>): void;
export declare function fastValidateFix(input: Record<string, unknown>): void;
export declare function fastValidateComposite(input: Record<string, unknown>): void;
export declare function fastValidateSession(input: Record<string, unknown>): void;
export declare function fastValidateTemplates(input: Record<string, unknown>): void;
export declare function fastValidateBigQuery(input: Record<string, unknown>): void;
export declare function fastValidateAppsScript(input: Record<string, unknown>): void;
type FastValidatorFn = (input: Record<string, unknown>) => void;
/**
 * Get fast validator for a tool
 */
export declare function getFastValidator(toolName: string): FastValidatorFn | undefined;
/**
 * Fast validate input - throws FastValidationError on failure
 */
export declare function fastValidate(toolName: string, input: unknown): void;
/**
 * Check if fast validator exists
 */
export declare function hasFastValidator(toolName: string): boolean;
export {};
//# sourceMappingURL=fast-validators.d.ts.map