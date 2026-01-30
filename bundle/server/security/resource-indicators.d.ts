/**
 * ServalSheets - Resource Indicators (RFC 8707)
 *
 * Implements RFC 8707 Resource Indicators for OAuth 2.0 token validation.
 * Ensures tokens were issued for THIS specific resource server, preventing
 * token mis-redemption attacks in multi-server environments.
 *
 * Flow:
 * 1. Client requests token with `resource` parameter pointing to our server
 * 2. Authorization server includes resource in token audience
 * 3. ServalSheets validates token audience matches our resource identifier
 * 4. Tokens without matching audience are rejected
 *
 * @see https://www.rfc-editor.org/rfc/rfc8707 - Resource Indicators for OAuth 2.0
 * @see https://spec.modelcontextprotocol.io/specification/security/
 */
/**
 * Resource indicator configuration
 */
export interface ResourceIndicatorConfig {
    /** This server's resource identifier (typically server URL) */
    resourceIdentifier: string;
    /** Allow tokens without resource indicator (lenient mode for migration) */
    allowMissingResource?: boolean;
    /** Additional valid resource identifiers (for aliases/migrations) */
    additionalResources?: string[];
    /** Google's token info endpoint for opaque token validation */
    tokenInfoEndpoint?: string;
}
/**
 * Token validation result
 */
export interface TokenValidationResult {
    valid: boolean;
    reason?: string;
    resourceMatch?: boolean;
    audience?: string | string[];
    scopes?: string[];
    expiresAt?: number;
    email?: string;
}
/**
 * Resource Indicator Validator
 *
 * Validates OAuth tokens against RFC 8707 resource indicators.
 * Ensures tokens are intended for this specific server.
 */
export declare class ResourceIndicatorValidator {
    private config;
    private validResources;
    constructor(config: ResourceIndicatorConfig);
    /**
     * Normalize resource identifier for comparison
     * Removes trailing slashes and lowercases
     */
    private normalizeResource;
    /**
     * Validate a JWT access token
     * Note: This does NOT verify signature - that should be done by Google's libraries
     * This only validates the audience claim against our resource identifier
     */
    validateJwtToken(token: string): TokenValidationResult;
    /**
     * Validate an opaque access token via Google's tokeninfo endpoint
     */
    validateOpaqueToken(token: string): Promise<TokenValidationResult>;
    /**
     * Check if audience matches our resource identifier
     */
    private checkAudience;
    /**
     * Check if a value matches any valid resource identifier
     */
    private isValidResource;
    /**
     * Get the resource identifier for OAuth authorization requests
     * Include this in the `resource` parameter when requesting tokens
     */
    getResourceIdentifier(): string;
    /**
     * Generate WWW-Authenticate header for 401 responses
     * Includes resource indicator hint
     */
    getWwwAuthenticateHeader(error?: string, errorDescription?: string): string;
    /**
     * Create authorization URL with resource parameter
     */
    createAuthorizationUrl(authEndpoint: string, params: {
        clientId: string;
        redirectUri: string;
        scope: string;
        state?: string;
        codeChallenge?: string;
        codeChallengeMethod?: string;
    }): string;
    /**
     * Validate and log token usage for audit
     */
    validateAndLog(token: string, operation: string, resourceId?: string): Promise<TokenValidationResult>;
    /**
     * Validate token (alias for validateAndLog for backward compatibility)
     * Tries JWT validation first, falls back to opaque token validation
     */
    validateToken(token: string): Promise<TokenValidationResult>;
    /**
     * Introspect token via Google's tokeninfo endpoint
     * Returns result with 'active' field for OAuth introspection compatibility
     */
    introspectToken(token: string): Promise<{
        active: boolean;
        aud?: string;
        scope?: string;
        exp?: number;
        email?: string;
        error?: string;
    }>;
    /**
     * Generate resource identifier from hostname and port
     * Static utility method for creating RFC 8707 resource identifiers
     */
    static generateResourceIdentifier(host: string, port?: number): string;
}
/**
 * Express middleware for resource indicator validation
 */
export declare function resourceIndicatorMiddleware(validator: ResourceIndicatorValidator): (req: {
    headers: {
        authorization?: string;
    };
    path?: string;
}, res: {
    status: (code: number) => {
        json: (body: unknown) => void;
    };
    setHeader: (name: string, value: string) => void;
}, next: () => void) => Promise<void>;
/**
 * Optional resource indicator middleware - validates tokens if present,
 * allows through if no token (for mixed auth/anonymous access)
 */
export declare function optionalResourceIndicatorMiddleware(validator: ResourceIndicatorValidator): (req: {
    headers: {
        authorization?: string;
    };
    path?: string;
}, res: {
    status: (code: number) => {
        json: (body: unknown) => void;
    };
    setHeader: (name: string, value: string) => void;
}, next: () => void) => Promise<void>;
/**
 * Create a validator with default configuration
 */
export declare function createResourceIndicatorValidator(serverUrl: string, options?: Partial<ResourceIndicatorConfig>): ResourceIndicatorValidator;
//# sourceMappingURL=resource-indicators.d.ts.map