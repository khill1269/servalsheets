/**
 * ServalSheets - Enhanced Error Context
 *
 * Provides enhanced error messages with suggested fixes and context.
 */
import type { ErrorDetail } from '../schemas/shared.js';
export interface ErrorSuggestion {
    title: string;
    steps: string[];
}
/**
 * Enhanced error with suggested fixes
 */
export declare function enhanceError(code: string, message: string, context?: Record<string, unknown>): ErrorDetail;
/**
 * Create enhanced error response
 */
export declare function createEnhancedError(code: string, message: string, context?: Record<string, unknown>): {
    success: false;
    error: ErrorDetail;
};
//# sourceMappingURL=enhanced-errors.d.ts.map