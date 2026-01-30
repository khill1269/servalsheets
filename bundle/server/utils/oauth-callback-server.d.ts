/**
 * ServalSheets - OAuth Callback Server
 *
 * Temporary HTTP server for capturing OAuth callbacks in STDIO mode.
 * Starts on-demand, captures the authorization code, and auto-closes.
 */
export interface CallbackServerOptions {
    port?: number;
    host?: string;
    timeout?: number;
}
export interface CallbackResult {
    code?: string;
    error?: string;
    state?: string;
}
/**
 * Start a temporary HTTP server to capture OAuth callback
 * Returns the authorization code when received
 */
export declare function startCallbackServer(options?: CallbackServerOptions): Promise<CallbackResult>;
/**
 * Extract port from redirect URI
 */
export declare function extractPortFromRedirectUri(redirectUri: string): number;
//# sourceMappingURL=oauth-callback-server.d.ts.map