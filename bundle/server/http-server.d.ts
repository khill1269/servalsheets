/**
 * ServalSheets - HTTP Transport Server
 *
 * Streamable HTTP transport for Claude Connectors Directory
 * Supports both SSE and HTTP streaming
 * MCP Protocol: 2025-11-25
 */
export interface HttpServerOptions {
    port?: number;
    host?: string;
    corsOrigins?: string[];
    rateLimitWindowMs?: number;
    rateLimitMax?: number;
    trustProxy?: boolean;
    enableOAuth?: boolean;
    oauthConfig?: {
        issuer: string;
        clientId: string;
        clientSecret: string;
        jwtSecret: string;
        stateSecret: string;
        allowedRedirectUris: string[];
        googleClientId: string;
        googleClientSecret: string;
        accessTokenTtl: number;
        refreshTokenTtl: number;
    };
}
/**
 * Create HTTP server with MCP transport
 */
export declare function createHttpServer(options?: HttpServerOptions): {
    app: unknown;
    start: () => Promise<void>;
    stop: () => Promise<void> | undefined;
    sessions: unknown;
};
/**
 * Start HTTP server - convenience function for CLI
 */
export declare function startHttpServer(options?: HttpServerOptions): Promise<void>;
/**
 * Start remote server with OAuth - convenience function for CLI
 * This is a compatibility wrapper that enables OAuth mode
 */
export declare function startRemoteServer(options?: {
    port?: number;
}): Promise<void>;
//# sourceMappingURL=http-server.d.ts.map