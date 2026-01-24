/**
 * OAuth configuration helpers.
 */
export interface OAuthEnvConfig {
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    configured: boolean;
}
export declare function getOAuthEnvConfig(): OAuthEnvConfig;
//# sourceMappingURL=oauth-config.d.ts.map