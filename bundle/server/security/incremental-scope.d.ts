/**
 * ServalSheets - Incremental Scope Consent (SEP-835)
 *
 * Implements on-demand OAuth scope requests without full re-authentication.
 * When an operation requires elevated permissions, the server returns a
 * structured error with the required scopes and authorization URL.
 *
 * Flow:
 * 1. User attempts operation requiring elevated scope (e.g., sharing)
 * 2. Server detects insufficient scopes
 * 3. Server returns IncrementalScopeRequired error with auth URL
 * 4. Client prompts user to authorize additional scopes
 * 5. User completes authorization
 * 6. Client retries operation with new token
 *
 * @see https://spec.modelcontextprotocol.io/specification/security/
 */
import type { OAuth2Client } from 'google-auth-library';
/**
 * Scope categories for different operations
 */
export declare enum ScopeCategory {
    /** Basic spreadsheet operations */
    SPREADSHEET = "spreadsheet",
    /** File-level Drive operations (create, open) */
    DRIVE_FILE = "drive_file",
    /** Full Drive operations (share, list all, permissions) */
    DRIVE_FULL = "drive_full",
    /** Read-only operations */
    READONLY = "readonly"
}
/**
 * Operation to required scope mapping
 */
export declare const OPERATION_SCOPES: Record<string, {
    required: string[];
    category: ScopeCategory;
    description: string;
}>;
/**
 * Error thrown when additional scopes are required
 */
export declare class IncrementalScopeRequiredError extends Error {
    readonly code = "INCREMENTAL_SCOPE_REQUIRED";
    readonly requiredScopes: string[];
    readonly currentScopes: string[];
    readonly missingScopes: string[];
    readonly authorizationUrl: string;
    readonly operation: string;
    readonly category: ScopeCategory;
    readonly retryable = true;
    constructor(options: {
        operation: string;
        requiredScopes: string[];
        currentScopes: string[];
        authorizationUrl: string;
        category: ScopeCategory;
        description?: string;
    });
    /**
     * Convert to MCP tool error response
     */
    toToolResponse(): {
        content: Array<{
            type: 'text';
            text: string;
        }>;
        structuredContent: {
            error: string;
            code: string;
            operation: string;
            category: string;
            requiredScopes: string[];
            currentScopes: string[];
            missingScopes: string[];
            authorizationUrl: string;
            retryable: boolean;
            instructions: string;
        };
        isError: true;
    };
}
/**
 * Scope validator for checking operation permissions
 */
export declare class ScopeValidator {
    private oauthClient?;
    private currentScopes;
    private clientId?;
    private redirectUri?;
    constructor(options?: {
        oauthClient?: OAuth2Client;
        scopes?: string[];
        clientId?: string;
        redirectUri?: string;
    });
    /**
     * Update current scopes (e.g., after token refresh)
     */
    setScopes(scopes: string[]): void;
    /**
     * Update OAuth client
     */
    setOAuthClient(client: OAuth2Client): void;
    /**
     * Check if current scopes satisfy operation requirements
     */
    hasRequiredScopes(operation: string): boolean;
    /**
     * Check if a broader scope covers the required scope
     */
    private hasScopeUpgrade;
    /**
     * Get missing scopes for an operation
     */
    getMissingScopes(operation: string): string[];
    /**
     * Generate authorization URL for incremental consent
     */
    generateIncrementalAuthUrl(additionalScopes: string[]): string;
    /**
     * Validate operation and throw if scopes insufficient
     */
    validateOperation(operation: string): void;
    /**
     * Get scope requirements for an operation
     */
    getOperationRequirements(operation: string): {
        required: string[];
        category: ScopeCategory;
        description: string;
        satisfied: boolean;
        missing: string[];
    } | null;
    /**
     * Get all operations that can be performed with current scopes
     */
    getAvailableOperations(): string[];
    /**
     * Get operations that require additional scopes
     */
    getRestrictedOperations(): Array<{
        operation: string;
        category: ScopeCategory;
        missingScopes: string[];
    }>;
    /**
     * Get recommended scope set based on intended operations
     */
    static getRecommendedScopes(operations: string[]): string[];
}
/**
 * Create a scope validator from auth context
 */
export declare function createScopeValidator(authContext?: {
    scopes?: string[];
    oauthClient?: OAuth2Client;
}): ScopeValidator;
/**
 * Middleware-style scope check for handlers
 */
export declare function requireScopes(operation: string, validator: ScopeValidator): void;
/**
 * Check if error is an incremental scope error
 */
export declare function isIncrementalScopeError(error: unknown): error is IncrementalScopeRequiredError;
//# sourceMappingURL=incremental-scope.d.ts.map