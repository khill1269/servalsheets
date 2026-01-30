/**
 * OAuth configuration helpers.
 */
export function getOAuthEnvConfig() {
    const clientId = process.env['GOOGLE_CLIENT_ID'] ?? process.env['OAUTH_CLIENT_ID'];
    const clientSecret = process.env['GOOGLE_CLIENT_SECRET'] ?? process.env['OAUTH_CLIENT_SECRET'];
    const redirectUri = process.env['GOOGLE_REDIRECT_URI'] ?? process.env['OAUTH_REDIRECT_URI'];
    return {
        clientId,
        clientSecret,
        redirectUri,
        configured: Boolean(clientId && clientSecret),
    };
}
//# sourceMappingURL=oauth-config.js.map