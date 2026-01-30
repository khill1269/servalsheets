/**
 * ServalSheets - Auth Handler
 *
 * Handles OAuth authentication flows for sheets_auth tool.
 */
import type { GoogleApiClient } from '../services/google-api.js';
import type { SheetsAuthInput, SheetsAuthOutput } from '../schemas/auth.js';
import type { ElicitationServer } from '../mcp/elicitation.js';
export interface AuthHandlerOptions {
    googleClient?: GoogleApiClient | null;
    oauthClientId?: string;
    oauthClientSecret?: string;
    redirectUri?: string;
    tokenStorePath?: string;
    tokenStoreKey?: string;
    elicitationServer?: ElicitationServer;
}
export declare class AuthHandler {
    private googleClient?;
    private oauthClientId?;
    private oauthClientSecret?;
    private redirectUri?;
    private tokenStorePath?;
    private tokenStoreKey?;
    private elicitationServer?;
    private tokenManager?;
    constructor(options?: AuthHandlerOptions);
    handle(input: SheetsAuthInput): Promise<SheetsAuthOutput>;
    private handleStatus;
    private handleLogin;
    private handleCallback;
    private handleLogout;
    /**
     * Initialize and start token manager for proactive refresh
     * Phase 1, Task 1.1: Proactive OAuth Token Refresh
     */
    private startTokenManager;
    private createOAuthClient;
}
//# sourceMappingURL=auth.d.ts.map