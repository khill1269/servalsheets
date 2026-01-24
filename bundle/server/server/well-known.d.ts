/**
 * ServalSheets - .well-known Discovery Endpoints
 *
 * Implements RFC 8615 well-known URIs for server discovery:
 * - /.well-known/mcp-configuration: MCP server capabilities
 * - /.well-known/oauth-authorization-server: OAuth 2.0 metadata (RFC 8414)
 * - /.well-known/oauth-protected-resource: Resource server metadata (RFC 9728)
 *
 * These endpoints allow clients and registries to discover server
 * capabilities without establishing an MCP connection.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8615 - Well-Known URIs
 * @see https://www.rfc-editor.org/rfc/rfc8414 - OAuth 2.0 Authorization Server Metadata
 * @see https://www.rfc-editor.org/rfc/rfc9728 - OAuth 2.0 Protected Resource Metadata
 */
import type { Request, Response } from 'express';
import type { Icon } from '@modelcontextprotocol/sdk/types.js';
/**
 * MCP Server Configuration
 * Describes server capabilities for discovery
 */
export interface McpServerConfiguration {
    /** Server name (package name) */
    name: string;
    /** Server version (semver) */
    version: string;
    /** Human-readable description */
    description: string;
    /** Optional server icon set */
    icons?: Icon[];
    /** MCP protocol version supported */
    protocol_version: string;
    /** Server capabilities */
    capabilities: {
        tools: {
            count: number;
            actions: number;
        };
        resources: {
            supported: boolean;
            templates: boolean;
            subscriptions: boolean;
        };
        prompts: {
            supported: boolean;
            count: number;
        };
        tasks: {
            supported: boolean;
        };
        sampling: {
            supported: boolean;
        };
        elicitation: {
            form: boolean;
            url: boolean;
        };
        completions: {
            supported: boolean;
        };
        logging: {
            supported: boolean;
        };
    };
    /** Supported transports */
    transports: ('stdio' | 'sse' | 'streamable-http')[];
    /** Authentication requirements */
    authentication: {
        type: 'oauth2';
        flows: ('authorization_code' | 'client_credentials')[];
        pkce_required: boolean;
        default_scopes: string[];
        elevated_scopes: string[];
        readonly_scopes: string[];
    };
    /** External links */
    links: {
        documentation?: string;
        repository?: string;
        issues?: string;
        homepage?: string;
        registry_entry?: string;
    };
}
/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 */
export interface OAuthAuthorizationServerMetadata {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    revocation_endpoint?: string;
    jwks_uri?: string;
    scopes_supported: string[];
    response_types_supported: string[];
    grant_types_supported: string[];
    token_endpoint_auth_methods_supported: string[];
    code_challenge_methods_supported: string[];
}
/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728)
 */
export interface OAuthProtectedResourceMetadata {
    resource: string;
    authorization_servers: string[];
    scopes_supported: string[];
    bearer_methods_supported: string[];
    resource_documentation?: string;
}
/**
 * Get MCP server configuration for discovery
 */
export declare function getMcpConfiguration(): McpServerConfiguration;
/**
 * Get OAuth Authorization Server Metadata
 * Points to Google's OAuth server or custom issuer
 */
export declare function getOAuthAuthorizationServerMetadata(issuer?: string): OAuthAuthorizationServerMetadata;
/**
 * Get OAuth Protected Resource Metadata
 * Describes this server as an OAuth-protected resource
 */
export declare function getOAuthProtectedResourceMetadata(serverUrl: string): OAuthProtectedResourceMetadata;
/**
 * Express handler for /.well-known/mcp-configuration
 */
export declare function mcpConfigurationHandler(req: Request, res: Response): void;
/**
 * Express handler for /.well-known/oauth-authorization-server
 */
export declare function oauthAuthorizationServerHandler(req: Request, res: Response): void;
/**
 * Express handler for /.well-known/oauth-protected-resource
 */
export declare function oauthProtectedResourceHandler(req: Request, res: Response): void;
/**
 * Register all well-known handlers with an Express app
 */
export declare function registerWellKnownHandlers(app: {
    get: (path: string, handler: (req: Request, res: Response) => void) => void;
}): void;
/** @deprecated Use getMcpConfiguration instead */
export declare const buildMcpConfiguration: typeof getMcpConfiguration;
/** @deprecated Use getOAuthAuthorizationServerMetadata instead */
export declare const buildOAuthAuthorizationServerMetadata: typeof getOAuthAuthorizationServerMetadata;
/** @deprecated Use getOAuthProtectedResourceMetadata instead */
export declare const buildOAuthProtectedResourceMetadata: typeof getOAuthProtectedResourceMetadata;
/** @deprecated Use mcpConfigurationHandler instead */
export declare const handleMcpConfiguration: typeof mcpConfigurationHandler;
/** @deprecated Use oauthAuthorizationServerHandler instead */
export declare const handleOAuthAuthorizationServer: typeof oauthAuthorizationServerHandler;
/** @deprecated Use oauthProtectedResourceHandler instead */
export declare const handleOAuthProtectedResource: typeof oauthProtectedResourceHandler;
//# sourceMappingURL=well-known.d.ts.map