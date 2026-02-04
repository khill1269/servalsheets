/**
 * ServalSheets - Centralized OAuth Scope Configuration
 *
 * Single source of truth for all Google API scopes required by ServalSheets.
 * This ensures consistent OAuth flows and prevents incremental consent issues.
 *
 * @see https://developers.google.com/identity/protocols/oauth2/scopes
 */

/**
 * FULL_ACCESS_SCOPES - Complete scope set for all ServalSheets features
 *
 * This is the RECOMMENDED scope set for normal use. It includes:
 * - Full Sheets API access (read/write)
 * - Full Drive access (required for sharing, comments, templates)
 * - Drive AppData (required for template storage)
 * - BigQuery (required for sheets_bigquery tool)
 * - Apps Script (required for sheets_appsscript tool)
 *
 * Users are prompted ONCE for all permissions upfront.
 */
export const FULL_ACCESS_SCOPES = [
  // Core Sheets & Drive
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.appdata',

  // BigQuery (for sheets_bigquery tool)
  'https://www.googleapis.com/auth/bigquery',
  'https://www.googleapis.com/auth/cloud-platform',

  // Apps Script (for sheets_appsscript tool)
  'https://www.googleapis.com/auth/script.projects',
  'https://www.googleapis.com/auth/script.deployments',
  'https://www.googleapis.com/auth/script.processes',
] as const;

/**
 * MINIMAL_SCOPES - Bare minimum for basic spreadsheet operations
 *
 * Use this ONLY if you need to minimize permissions.
 * Many features (sharing, templates, BigQuery, Apps Script) will NOT work.
 */
export const MINIMAL_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
] as const;

/**
 * READONLY_SCOPES - Read-only access for analysis/reporting
 *
 * Use this for read-only analysis tools or reporting systems.
 */
export const READONLY_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
] as const;

/**
 * Get the recommended scope set for ServalSheets
 * This is what should be used in 99% of cases.
 */
export function getRecommendedScopes(): readonly string[] {
  return FULL_ACCESS_SCOPES;
}

/**
 * Get scopes based on environment or configuration
 */
export function getConfiguredScopes(): readonly string[] {
  const scopeMode = process.env['OAUTH_SCOPE_MODE'] ?? 'full';

  switch (scopeMode) {
    case 'minimal':
      return MINIMAL_SCOPES;
    case 'readonly':
      return READONLY_SCOPES;
    case 'full':
    default:
      return FULL_ACCESS_SCOPES;
  }
}

/**
 * Scope descriptions for user consent screen
 */
export const SCOPE_DESCRIPTIONS: Record<string, string> = {
  'https://www.googleapis.com/auth/spreadsheets':
    'Create, view, and edit Google Sheets spreadsheets',
  'https://www.googleapis.com/auth/drive':
    'View, edit, create, and delete all your Google Drive files (required for sharing and collaboration)',
  'https://www.googleapis.com/auth/drive.file':
    'View and manage Google Drive files created or opened with this app',
  'https://www.googleapis.com/auth/drive.appdata':
    'View and manage its own configuration data in your Google Drive (for templates)',
  'https://www.googleapis.com/auth/bigquery':
    'View and manage data in Google BigQuery (for Connected Sheets)',
  'https://www.googleapis.com/auth/cloud-platform':
    'View and manage data across Google Cloud services (required for BigQuery export)',
  'https://www.googleapis.com/auth/script.projects':
    'Create and update Google Apps Script projects',
  'https://www.googleapis.com/auth/script.deployments': 'Manage Apps Script deployments',
  'https://www.googleapis.com/auth/script.processes': 'View Apps Script processes and executions',
  'https://www.googleapis.com/auth/spreadsheets.readonly': 'View your Google Sheets spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly': 'View your Google Drive files',
};

/**
 * Validate that current scopes include all required scopes
 */
export function validateScopes(
  currentScopes: string[],
  requiredScopes: readonly string[]
): {
  valid: boolean;
  missing: string[];
} {
  const missing = requiredScopes.filter((scope) => !currentScopes.includes(scope));
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Format scopes for OAuth authorization URL
 */
export function formatScopesForAuth(scopes: readonly string[]): string {
  return scopes.join(' ');
}
