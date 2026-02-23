/**
 * ServalSheets - Embedded OAuth Credentials
 *
 * These are the published OAuth credentials for the ServalSheets app.
 * They are embedded in the distributed code so end users don't need to
 * create their own Google Cloud project.
 *
 * Per Google's documentation for "Desktop application" (installed app)
 * OAuth clients, the client_id and client_secret are NOT confidential
 * and are safe to distribute in application code. The security model
 * relies on PKCE (which ServalSheets enforces via oauth-provider.ts)
 * rather than client secret confidentiality.
 *
 * This is the same model used by Chrome extensions, VS Code extensions,
 * and other Google-authenticated desktop applications.
 *
 * @see https://developers.google.com/identity/protocols/oauth2/native-app
 * @see https://developers.google.com/identity/protocols/oauth2/native-app#creatingcred
 */

/**
 * Published ServalSheets OAuth credentials.
 *
 * IMPORTANT: Replace these default values with your real
 * Google Cloud Console credentials before publishing.
 *
 * To create these credentials:
 * 1. Go to https://console.cloud.google.com/apis/credentials
 * 2. Create OAuth Client ID → Application type: "Desktop application"
 * 3. Copy the Client ID and Client Secret here
 * 4. Submit app for Google verification (OAuth consent screen → Publish)
 */
export const EMBEDDED_OAUTH = {
  clientId:
    process.env['OAUTH_CLIENT_ID'] ??
    '928247231183-7unv94dc4rs3vo3tmib9tkcu5mkd8sd1.apps.googleusercontent.com',
  clientSecret:
    process.env['OAUTH_CLIENT_SECRET'] ??
    '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',
  redirectUri:
    process.env['OAUTH_REDIRECT_URI'] ?? 'http://localhost:3000/callback',
};

/**
 * Check if the embedded credentials have been configured
 * (i.e., default values have been replaced with real credentials)
 */
export function isEmbeddedOAuthConfigured(): boolean {
  return (
    !EMBEDDED_OAUTH.clientId.startsWith('REPLACE_WITH_') &&
    !EMBEDDED_OAUTH.clientSecret.startsWith('REPLACE_WITH_') &&
    EMBEDDED_OAUTH.clientId.length > 0 &&
    EMBEDDED_OAUTH.clientSecret.length > 0
  );
}
