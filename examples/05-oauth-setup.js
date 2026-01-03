#!/usr/bin/env node
/**
 * ServalSheets Example 5: OAuth Authentication Setup
 *
 * This example demonstrates how to set up OAuth 2.0 authentication for
 * user-facing applications that need to access Google Sheets on behalf of users.
 *
 * Features demonstrated:
 * - OAuth 2.0 authorization flow
 * - Token management (access + refresh tokens)
 * - Token storage and persistence
 * - Automatic token refresh
 * - Secure credential handling
 *
 * Prerequisites:
 * - Node.js 22+
 * - npm install servalsheets
 * - Google Cloud Project with OAuth credentials
 * - OAuth client ID and client secret
 *
 * Setup:
 * 1. Go to https://console.cloud.google.com
 * 2. Create or select a project
 * 3. Enable Google Sheets API
 * 4. Create OAuth 2.0 credentials (Desktop app or Web app)
 * 5. Download client secret JSON
 * 6. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables
 */

import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// ============================================================================
// Configuration
// ============================================================================

const SPREADSHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

// OAuth 2.0 Configuration
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

// Token storage path (encrypted in production!)
const TOKEN_PATH = path.join(os.homedir(), '.servalsheets', 'tokens.json');

// Scopes required for Google Sheets access
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly', // Optional: to list spreadsheets
];

// ============================================================================
// OAuth Client Setup
// ============================================================================

/**
 * Create OAuth2 client
 */
function createOAuth2Client() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error(
      'OAuth credentials not found. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.\n\n' +
      'To get credentials:\n' +
      '1. Go to https://console.cloud.google.com\n' +
      '2. Create/select a project\n' +
      '3. Enable Google Sheets API\n' +
      '4. Create OAuth 2.0 Client ID\n' +
      '5. Download credentials'
    );
  }

  return new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );
}

// ============================================================================
// Authorization Flow
// ============================================================================

/**
 * Generate authorization URL
 */
function getAuthUrl(oauth2Client) {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Request refresh token
    scope: SCOPES,
    prompt: 'consent', // Force consent screen to get refresh token
  });

  return authUrl;
}

/**
 * Start local HTTP server to handle OAuth callback
 */
function startAuthServer(oauth2Client) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url.indexOf('/oauth2callback') > -1) {
          // Parse authorization code from callback
          const qs = new url.URL(req.url, REDIRECT_URI).searchParams;
          const code = qs.get('code');

          if (!code) {
            throw new Error('No authorization code received');
          }

          console.log('\n✓ Received authorization code');

          // Exchange code for tokens
          const { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);

          console.log('✓ Tokens obtained successfully');

          // Send success response to browser
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Authorization Successful</title>
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  }
                  .container {
                    background: white;
                    padding: 3rem;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                    text-align: center;
                  }
                  h1 { color: #4CAF50; margin: 0 0 1rem 0; }
                  p { color: #666; margin: 0; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h1>✓ Authorization Successful!</h1>
                  <p>You can close this window and return to the terminal.</p>
                </div>
              </body>
            </html>
          `);

          // Close server and resolve
          server.close();
          resolve(tokens);
        }
      } catch (err) {
        res.end('Error during authorization. Check terminal for details.');
        server.close();
        reject(err);
      }
    });

    server.listen(3000, () => {
      console.log('\n✓ Authorization server started on http://localhost:3000');
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timeout'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Perform complete OAuth flow
 */
async function authorize(oauth2Client) {
  console.log('\n[OAUTH] Starting authorization flow...');

  // Check for existing tokens
  const existingTokens = await loadTokens();
  if (existingTokens) {
    console.log('✓ Found existing tokens');
    oauth2Client.setCredentials(existingTokens);

    // Verify tokens are still valid
    try {
      await oauth2Client.getAccessToken();
      console.log('✓ Tokens are valid');
      return oauth2Client;
    } catch (error) {
      console.log('⚠ Tokens expired or invalid, re-authorizing...');
    }
  }

  // Generate auth URL
  const authUrl = getAuthUrl(oauth2Client);

  console.log('\n📋 Please authorize this application:');
  console.log('\n  ' + authUrl);
  console.log('\nOpening browser automatically...');
  console.log('(If browser doesn\'t open, copy the URL above manually)');

  // Try to open browser
  const open = (await import('open')).default;
  try {
    await open(authUrl);
  } catch (error) {
    console.log('\n⚠ Could not open browser automatically');
  }

  // Wait for callback
  console.log('\nWaiting for authorization...');
  const tokens = await startAuthServer(oauth2Client);

  // Save tokens
  await saveTokens(tokens);
  console.log('✓ Tokens saved to', TOKEN_PATH);

  return oauth2Client;
}

// ============================================================================
// Token Storage
// ============================================================================

/**
 * Load tokens from file
 */
async function loadTokens() {
  try {
    const data = await fs.readFile(TOKEN_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File doesn't exist yet
    }
    throw error;
  }
}

/**
 * Save tokens to file
 */
async function saveTokens(tokens) {
  // Ensure directory exists
  const dir = path.dirname(TOKEN_PATH);
  await fs.mkdir(dir, { recursive: true });

  // Save tokens
  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));

  // Set restrictive permissions (Unix only)
  if (process.platform !== 'win32') {
    await fs.chmod(TOKEN_PATH, 0o600);
  }
}

/**
 * Delete stored tokens
 */
async function deleteTokens() {
  try {
    await fs.unlink(TOKEN_PATH);
    console.log('✓ Tokens deleted');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

// ============================================================================
// Token Refresh
// ============================================================================

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(oauth2Client) {
  console.log('\n[REFRESH] Refreshing access token...');

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

    // Save updated tokens
    await saveTokens(credentials);
    console.log('✓ Access token refreshed');

    return credentials;
  } catch (error) {
    console.error('✗ Token refresh failed:', error.message);
    throw error;
  }
}

/**
 * Setup automatic token refresh
 */
function setupAutoRefresh(oauth2Client) {
  oauth2Client.on('tokens', async (tokens) => {
    console.log('\n[AUTO-REFRESH] New tokens received');

    if (tokens.refresh_token) {
      console.log('  New refresh token received');
    }

    // Save tokens automatically
    await saveTokens(tokens);
    console.log('  ✓ Tokens saved automatically');
  });
}

// ============================================================================
// Token Info
// ============================================================================

/**
 * Display token information
 */
async function displayTokenInfo(oauth2Client) {
  console.log('\n[TOKEN INFO]');

  const credentials = oauth2Client.credentials;

  if (credentials.access_token) {
    console.log('  Access Token: ' + credentials.access_token.substring(0, 20) + '...');
  }

  if (credentials.refresh_token) {
    console.log('  Refresh Token: ' + credentials.refresh_token.substring(0, 20) + '...');
  }

  if (credentials.expiry_date) {
    const expiresIn = Math.floor((credentials.expiry_date - Date.now()) / 1000);
    console.log(`  Expires in: ${expiresIn} seconds (${Math.floor(expiresIn / 60)} minutes)`);

    if (expiresIn < 300) {
      console.log('  ⚠ Token expires soon, will auto-refresh');
    }
  }

  if (credentials.scope) {
    console.log('  Scopes:', credentials.scope);
  }

  console.log('  Token stored at:', TOKEN_PATH);
}

// ============================================================================
// Example Usage
// ============================================================================

/**
 * Test authenticated API access
 */
async function testApiAccess(oauth2Client) {
  console.log('\n[TEST] Testing authenticated API access...');

  try {
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // Read spreadsheet metadata
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    console.log('✓ Successfully accessed spreadsheet');
    console.log(`  Title: ${response.data.properties.title}`);
    console.log(`  Sheets: ${response.data.sheets.length}`);
    console.log(`  Locale: ${response.data.properties.locale}`);
    console.log(`  Time Zone: ${response.data.properties.timeZone}`);

    // Read some data
    const valuesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A1:C3',
    });

    const values = valuesResponse.data.values || [];
    console.log(`\n  Read ${values.length} rows from Sheet1!A1:C3`);

    return true;
  } catch (error) {
    console.error('✗ API access failed:', error.message);
    throw error;
  }
}

// ============================================================================
// Main Example
// ============================================================================

async function main() {
  console.log('=== ServalSheets Example: OAuth Setup ===\n');
  console.log('This example demonstrates OAuth 2.0 authentication for Google Sheets.');

  try {
    // Create OAuth client
    console.log('\n[SETUP] Creating OAuth2 client...');
    const oauth2Client = createOAuth2Client();
    console.log('✓ OAuth2 client created');

    // Setup auto-refresh
    setupAutoRefresh(oauth2Client);

    // Authorize (or use existing tokens)
    await authorize(oauth2Client);

    // Display token info
    await displayTokenInfo(oauth2Client);

    // Test API access
    await testApiAccess(oauth2Client);

    // Demonstrate token refresh (if token is about to expire)
    const credentials = oauth2Client.credentials;
    if (credentials.expiry_date && credentials.refresh_token) {
      const expiresIn = Math.floor((credentials.expiry_date - Date.now()) / 1000);

      if (expiresIn < 300) {
        console.log('\n[DEMO] Token expires soon, demonstrating refresh...');
        await refreshAccessToken(oauth2Client);
      } else {
        console.log('\n[INFO] Token is fresh, skipping refresh demo');
        console.log('      (Refresh happens automatically when token expires)');
      }
    }

    // Display final token info
    await displayTokenInfo(oauth2Client);

    // ========================================================================
    // Success!
    // ========================================================================
    console.log('\n=== Example Complete ===');
    console.log('\nKey Takeaways:');
    console.log('  1. OAuth 2.0 allows applications to access user data securely');
    console.log('  2. Refresh tokens enable long-term access without re-authorization');
    console.log('  3. Tokens should be stored securely (encrypted in production)');
    console.log('  4. Access tokens expire ~1 hour, refresh tokens last longer');
    console.log('  5. googleapis library handles token refresh automatically');
    console.log('  6. Always use "offline" access_type to get refresh token');
    console.log('  7. Store tokens with restrictive file permissions (0600)');

    console.log('\nNext Steps:');
    console.log('  - Use these tokens in your application');
    console.log('  - Implement token encryption for production');
    console.log('  - Add error handling for expired/revoked tokens');
    console.log('  - Consider using a database for multi-user apps');
    console.log('  - Review Google OAuth best practices');

    console.log('\nCleanup:');
    console.log('  To revoke tokens: Delete', TOKEN_PATH);
    console.log('  To revoke at Google: https://myaccount.google.com/permissions');

  } catch (error) {
    console.error('\n=== Example Failed ===');
    console.error(`Error: ${error.message}`);

    if (error.message.includes('credentials not found')) {
      console.error('\nPlease set OAuth credentials:');
      console.error('  export GOOGLE_CLIENT_ID="your-client-id"');
      console.error('  export GOOGLE_CLIENT_SECRET="your-client-secret"');
      console.error('\nSee QUICKSTART_CREDENTIALS.md for detailed setup instructions.');
    } else if (error.message.includes('redirect_uri_mismatch')) {
      console.error('\nRedirect URI mismatch. Please add to your OAuth client:');
      console.error('  ' + REDIRECT_URI);
    } else if (error.message.includes('access_denied')) {
      console.error('\nAuthorization denied by user.');
    }

    process.exit(1);
  }
}

// ============================================================================
// CLI Commands
// ============================================================================

const command = process.argv[2];

if (command === 'revoke') {
  // Revoke tokens
  deleteTokens()
    .then(() => {
      console.log('✓ Tokens revoked locally');
      console.log('To revoke at Google: https://myaccount.google.com/permissions');
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
} else if (command === 'info') {
  // Display token info
  loadTokens()
    .then(tokens => {
      if (!tokens) {
        console.log('No tokens found. Run without arguments to authorize.');
        return;
      }

      console.log('Token Information:');
      console.log('  Access Token: ' + (tokens.access_token ? '✓ Present' : '✗ Missing'));
      console.log('  Refresh Token: ' + (tokens.refresh_token ? '✓ Present' : '✗ Missing'));

      if (tokens.expiry_date) {
        const expiresIn = Math.floor((tokens.expiry_date - Date.now()) / 1000);
        if (expiresIn > 0) {
          console.log(`  Expires in: ${expiresIn} seconds (${Math.floor(expiresIn / 60)} minutes)`);
        } else {
          console.log('  Status: ✗ Expired');
        }
      }

      console.log('  Stored at: ' + TOKEN_PATH);
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
} else if (command === 'help' || command === '--help' || command === '-h') {
  console.log('ServalSheets OAuth Example\n');
  console.log('Usage:');
  console.log('  node 05-oauth-setup.js          Run OAuth flow and test API');
  console.log('  node 05-oauth-setup.js revoke   Revoke stored tokens');
  console.log('  node 05-oauth-setup.js info     Display token information');
  console.log('  node 05-oauth-setup.js help     Show this help message');
} else {
  // Run main example
  main();
}
