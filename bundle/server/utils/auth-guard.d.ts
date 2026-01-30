/**
 * ServalSheets - Auth Guard
 *
 * Provides authentication checking and clear error messages for LLMs.
 * This module ensures that when auth fails, the error message clearly
 * instructs the LLM how to proceed with the OAuth flow.
 */
import type { GoogleApiClient } from '../services/google-api.js';
export interface AuthGuardResult {
    authenticated: boolean;
    error?: AuthGuardError;
}
export interface AuthGuardError {
    code: 'NOT_AUTHENTICATED' | 'NOT_CONFIGURED' | 'TOKEN_EXPIRED';
    message: string;
    resolution: string;
    resolutionSteps: string[];
    nextTool: {
        name: 'sheets_auth';
        action: 'status' | 'login';
    };
}
/**
 * Check authentication status and return clear instructions if not authenticated
 *
 * This function is designed to produce error messages that clearly instruct
 * the LLM how to proceed with authentication.
 */
export declare function checkAuth(googleClient: GoogleApiClient | null): AuthGuardResult;
/**
 * Build a standardized auth error response for tool handlers
 *
 * This creates a response object that follows the ServalSheets response schema
 * and includes clear instructions for the LLM.
 */
export declare function buildAuthErrorResponse(error: AuthGuardError): {
    response: {
        success: false;
        error: {
            code: string;
            message: string;
            retryable: boolean;
            resolution: string;
            resolutionSteps: string[];
            suggestedNextStep: {
                tool: string;
                action: string;
                description: string;
            };
        };
    };
};
/**
 * Require authentication - throws a clear error if not authenticated
 *
 * Use this in tool handlers that require authentication.
 */
export declare function requireAuth(googleClient: GoogleApiClient | null): asserts googleClient is GoogleApiClient;
/**
 * Custom error class for auth failures
 *
 * This error carries structured data that can be used to build
 * informative error responses for the LLM.
 */
export declare class AuthRequiredError extends Error {
    readonly code: string;
    readonly resolution: string;
    readonly resolutionSteps: string[];
    readonly nextTool: {
        name: string;
        action: string;
    };
    constructor(error: AuthGuardError);
    toResponse(): unknown;
}
/**
 * Check if an error is a Google authentication error
 *
 * This function examines error messages and codes to determine if the error
 * is related to authentication/authorization issues with Google APIs.
 */
export declare function isGoogleAuthError(error: unknown): boolean;
/**
 * Convert a Google auth error to a standardized auth error response
 *
 * This ensures that when Google APIs fail due to auth issues, the LLM
 * receives clear instructions on how to proceed with authentication.
 */
export declare function convertGoogleAuthError(error: unknown): {
    response: {
        success: false;
        error: {
            code: string;
            message: string;
            retryable: boolean;
            resolution: string;
            resolutionSteps: string[];
            suggestedNextStep: {
                tool: string;
                action: string;
                description: string;
            };
        };
    };
};
//# sourceMappingURL=auth-guard.d.ts.map