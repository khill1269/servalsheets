/**
 * DiscoveryClient
 *
 * @purpose Fetches Google API schemas dynamically from Discovery API v1 to detect new fields, deprecations, API version changes
 * @category Infrastructure
 * @usage Use with SchemaCache for schema validation; fetches sheets/drive API schemas, caches locally for 30 days
 * @dependencies logger
 * @stateful No - stateless HTTP client for Discovery API
 * @singleton No - can be instantiated per discovery request
 *
 * @example
 * const client = new DiscoveryClient();
 * const schema = await client.discover('sheets', 'v4'); // Fetch latest schema
 * if (schema.deprecations.length > 0) logger.warn('API has deprecations:', schema.deprecations);
 */
/**
 * Discovery API schema definition
 */
export interface DiscoverySchema {
    id: string;
    name: string;
    version: string;
    title: string;
    description: string;
    documentationLink: string;
    schemas: Record<string, SchemaDefinition>;
    resources: Record<string, ResourceDefinition>;
    methods?: Record<string, MethodDefinition>;
    baseUrl?: string;
    rootUrl?: string;
    servicePath?: string;
    batchPath?: string;
    parameters?: Record<string, ParameterDefinition>;
    auth?: {
        oauth2?: {
            scopes?: Record<string, {
                description: string;
            }>;
        };
    };
}
/**
 * Schema definition (object type)
 */
export interface SchemaDefinition {
    id?: string;
    type: string;
    description?: string;
    properties?: Record<string, PropertyDefinition>;
    additionalProperties?: PropertyDefinition;
    items?: PropertyDefinition;
    required?: string[];
    enum?: string[];
    enumDescriptions?: string[];
    format?: string;
    pattern?: string;
    minimum?: string;
    maximum?: string;
    deprecated?: boolean;
}
/**
 * Property definition
 */
export interface PropertyDefinition {
    type?: string;
    description?: string;
    $ref?: string;
    format?: string;
    items?: PropertyDefinition;
    properties?: Record<string, PropertyDefinition>;
    additionalProperties?: PropertyDefinition;
    enum?: string[];
    deprecated?: boolean;
    required?: string[];
    pattern?: string;
    minimum?: string;
    maximum?: string;
}
/**
 * Resource definition
 */
export interface ResourceDefinition {
    methods?: Record<string, MethodDefinition>;
    resources?: Record<string, ResourceDefinition>;
}
/**
 * Method definition
 */
export interface MethodDefinition {
    id: string;
    path: string;
    httpMethod: string;
    description?: string;
    parameters?: Record<string, ParameterDefinition>;
    parameterOrder?: string[];
    request?: {
        $ref: string;
    };
    response?: {
        $ref: string;
    };
    scopes?: string[];
    supportsMediaDownload?: boolean;
    supportsMediaUpload?: boolean;
    mediaUpload?: {
        accept?: string[];
        maxSize?: string;
        protocols?: {
            simple?: {
                multipart?: boolean;
                path?: string;
            };
            resumable?: {
                multipart?: boolean;
                path?: string;
            };
        };
    };
    deprecated?: boolean;
}
/**
 * Parameter definition
 */
export interface ParameterDefinition {
    type: string;
    description?: string;
    required?: boolean;
    location?: string;
    enum?: string[];
    enumDescriptions?: string[];
    pattern?: string;
    minimum?: string;
    maximum?: string;
    default?: string;
    repeated?: boolean;
    format?: string;
}
/**
 * Schema comparison result
 */
export interface SchemaComparison {
    api: string;
    version: string;
    newFields: Array<{
        path: string;
        type: string;
        description: string;
    }>;
    deprecatedFields: Array<{
        path: string;
        deprecationMessage: string;
    }>;
    changedFields: Array<{
        path: string;
        oldType: string;
        newType: string;
    }>;
    newMethods: Array<{
        name: string;
        description: string;
    }>;
    removedMethods: string[];
    hasChanges: boolean;
}
/**
 * Discovery API Client Configuration
 */
export interface DiscoveryClientConfig {
    enabled?: boolean;
    cacheTTL?: number;
    timeout?: number;
}
/**
 * Google Discovery API Client
 */
export declare class DiscoveryApiClient {
    private readonly cache;
    private readonly enabled;
    private readonly cacheTTL;
    private readonly timeout;
    constructor(config?: DiscoveryClientConfig);
    /**
     * Check if Discovery API is enabled
     */
    isEnabled(): boolean;
    /**
     * Get API schema from Discovery API
     */
    getApiSchema(api: 'sheets' | 'drive', version: string): Promise<DiscoverySchema>;
    /**
     * List available versions for an API
     */
    listAvailableVersions(api: 'sheets' | 'drive'): Promise<string[]>;
    /**
     * Compare current schema with a new schema
     */
    compareSchemas(api: string, version: string, currentSchema: DiscoverySchema, newSchema: DiscoverySchema): SchemaComparison;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        entries: number;
        oldestEntry: number | null;
        newestEntry: number | null;
    };
    /**
     * Get Discovery API URL for an API
     */
    private getDiscoveryUrl;
    /**
     * Get API list URL
     */
    private getApiListUrl;
    /**
     * Compare schema objects recursively
     */
    private compareSchemaObjects;
    /**
     * Compare properties recursively
     */
    private compareProperties;
    /**
     * Compare methods recursively
     */
    private compareMethods;
}
/**
 * Get or create global Discovery API client
 */
export declare function getDiscoveryApiClient(): DiscoveryApiClient;
/**
 * Reset global Discovery API client
 */
export declare function resetDiscoveryApiClient(): void;
//# sourceMappingURL=discovery-client.d.ts.map