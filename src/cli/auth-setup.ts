#!/usr/bin/env node
/**
 * ServalSheets - Interactive Authentication Setup
 *
 * Provides a user-friendly OAuth authentication flow:
 * - Auto-discovers credentials in common locations
 * - Opens browser automatically
 * - Shows clear status and progress
 * - Validates configuration
 *
 * Usage: npm run auth
 */

/* eslint-disable no-console */
// Console output is required for CLI interaction in this file

import { logger } from '../utils/logger.js';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { EncryptedFileTokenStore } from '../services/token-store.js';
import { getRecommendedScopes, SCOPE_DESCRIPTIONS } from '../config/oauth-scopes.js';
import { EMBEDDED_OAUTH, isEmbeddedOAuthConfigured } from '../config/embedded-oauth.js';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import * as http from 'http';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

interface AuthStatus {
  hasEnvFile: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasTokens: boolean;
  envPath: string;
  tokenPath: string;
}

/**
 * Check current authentication status
 */
async function getAuthStatus(): Promise<AuthStatus> {
  const envPath = path.join(process.cwd(), '.env');
  const tokenPath = path.join(process.env['HOME'] || '', '.servalsheets', 'tokens.encrypted');

  let hasClientId = false;
  let hasClientSecret = false;
  let hasEnvFile = false;

  // Check if .env exists
  try {
    await fsPromises.access(envPath);
    hasEnvFile = true;
    const envContent = await fsPromises.readFile(envPath, 'utf-8');
    hasClientId =
      /OAUTH_CLIENT_ID=.+/.test(envContent) && !/OAUTH_CLIENT_ID=PASTE_YOUR/.test(envContent);
    hasClientSecret =
      /OAUTH_CLIENT_SECRET=.+/.test(envContent) &&
      !/OAUTH_CLIENT_SECRET=PASTE_YOUR/.test(envContent);
  } catch {
    // File does not exist
  }

  // Check if token file exists
  let hasTokens = false;
  try {
    await fsPromises.access(tokenPath);
    hasTokens = true;
  } catch {
    // File does not exist
  }

  return {
    hasEnvFile,
    hasClientId,
    hasClientSecret,
    hasTokens,
    envPath,
    tokenPath,
  };
}

/**
 * Try to find credentials.json in common locations
 */
async function findCredentials(): Promise<string | null> {
  const possiblePaths = [
    path.join(process.cwd(), 'credentials.json'),
    path.join(process.cwd(), 'client_secret.json'),
    path.join(process.env['HOME'] || '', 'Downloads', 'credentials.json'),
    path.join(process.env['HOME'] || '', 'Downloads', 'client_secret.json'),
    path.join(process.env['HOME'] || '', 'Documents', 'credentials.json'),
  ];

  for (const credPath of possiblePaths) {
    try {
      await fsPromises.access(credPath);
      return credPath;
    } catch {
      // File does not exist, continue to next path
    }
  }

  return null;
}

/**
 * Extract OAuth credentials from credentials.json
 */
async function extractCredentialsFromJson(
  jsonPath: string
): Promise<{ clientId: string; clientSecret: string; redirectUri: string } | null> {
  try {
    const fileContent = await fsPromises.readFile(jsonPath, 'utf-8');
    const content = JSON.parse(fileContent);

    // Handle both installed app and web app formats
    const creds = content.installed || content.web;

    if (!creds || !creds.client_id || !creds.client_secret) {
      return null;
    }

    // Get redirect URI (first one, or use env var, or default to localhost:3000)
    // MEDIUM-001 FIX: Support configurable redirect URI
    const defaultRedirectUri =
      process.env['OAUTH_REDIRECT_URI'] || 'http://localhost:3000/callback';
    const redirectUri = creds.redirect_uris?.[0] || defaultRedirectUri;

    return {
      clientId: creds.client_id,
      clientSecret: creds.client_secret,
      redirectUri,
    };
  } catch (_error) {
    return null;
  }
}

/**
 * Update .env file with OAuth credentials
 */
async function updateEnvFile(
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<void> {
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';

  try {
    await fsPromises.access(envPath);
    envContent = await fsPromises.readFile(envPath, 'utf-8');

    // Update existing values
    envContent = envContent.replace(/OAUTH_CLIENT_ID=.*/, `OAUTH_CLIENT_ID=${clientId}`);
    envContent = envContent.replace(
      /OAUTH_CLIENT_SECRET=.*/,
      `OAUTH_CLIENT_SECRET=${clientSecret}`
    );
    envContent = envContent.replace(/OAUTH_REDIRECT_URI=.*/, `OAUTH_REDIRECT_URI=${redirectUri}`);
  } catch {
    // Create new .env file
    envContent = `# ServalSheets OAuth Configuration
OAUTH_CLIENT_ID=${clientId}
OAUTH_CLIENT_SECRET=${clientSecret}
OAUTH_REDIRECT_URI=${redirectUri}

# Server Configuration
HTTP_PORT=3000
NODE_ENV=development
LOG_LEVEL=info
LOG_FORMAT=pretty

# Session Secret (auto-generated)
SESSION_SECRET=${randomBytes(32).toString('hex')}
ALLOWED_REDIRECT_URIS=${redirectUri}

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
`;
  }

  await fsPromises.writeFile(envPath, envContent, 'utf-8');
}

/**
 * Start temporary HTTP server to receive OAuth callback
 */
async function startCallbackServer(port: number): Promise<string> {
  // Load branded HTML templates first
  const successHtml = await fsPromises.readFile(path.join(__dirname, 'auth-success.html'), 'utf-8');
  const errorHtmlTemplate = await fsPromises.readFile(
    path.join(__dirname, 'auth-error.html'),
    'utf-8'
  );

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url?.startsWith('/callback')) {
        const url = new URL(req.url, `http://localhost:${port}`);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          // Inject error message into template via query parameter (handled by client-side JS)
          const errorHtml = errorHtmlTemplate.replace(
            '</body>',
            `<script>
              const urlParams = new URLSearchParams('?error=${encodeURIComponent(error)}');
              const errorMsg = urlParams.get('error');
              if (errorMsg) {
                document.getElementById('error-message').textContent = decodeURIComponent(errorMsg);
              }
            </script></body>`
          );
          res.end(errorHtml);
          server.close();
          reject(new Error(error));
        } else if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(successHtml);
          server.close();
          resolve(code);
        }
      }
    });

    server.listen(port, () => {
      console.log(
        `${colors.cyan}Waiting for authorization callback on http://localhost:${port}/callback ...${colors.reset}`
      );
    });

    server.on('error', reject);

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timeout (5 minutes)'));
    }, 300000);
  });
}

/**
 * Open URL in default browser
 */
async function openBrowser(url: string): Promise<void> {
  try {
    const open = (await import('open')).default;
    await open(url);
  } catch (_error) {
    // If open package not available, try platform-specific commands
    // Use execFile (not exec) to prevent command injection via URL
    const { execFile } = await import('child_process');
    const platform = process.platform;

    const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
    const args = platform === 'win32' ? ['/c', 'start', url] : [url];

    execFile(cmd, args, (error) => {
      if (error) {
        throw error;
      }
    });
  }
}

/**
 * Main authentication setup flow
 */
async function main(): Promise<void> {
  console.clear();
  console.log('');
  console.log(`${colors.green}╔════════════════════════════════════════════╗${colors.reset}`);
  console.log(
    `${colors.green}║${colors.reset}      ${colors.cyan}🦁 Serval Sheets Authentication${colors.reset}       ${colors.green}║${colors.reset}`
  );
  console.log(
    `${colors.green}║${colors.reset}   ${colors.bright}Production-Grade Google Sheets MCP${colors.reset}    ${colors.green}║${colors.reset}`
  );
  console.log(`${colors.green}╚════════════════════════════════════════════╝${colors.reset}`);
  console.log('');

  // Check current status
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}Step 1: Checking Current Status${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log('');

  const status = await getAuthStatus();

  console.log(
    `Environment file:    ${status.hasEnvFile ? colors.green + '✓' : colors.red + '✗'} ${status.envPath}${colors.reset}`
  );
  console.log(
    `OAuth Client ID:     ${status.hasClientId ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`
  );
  console.log(
    `OAuth Client Secret: ${status.hasClientSecret ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`
  );
  console.log(
    `Token file:          ${status.hasTokens ? colors.green + '✓' : colors.red + '✗'} ${status.tokenPath}${colors.reset}`
  );
  console.log('');

  // If already authenticated, ask if user wants to re-authenticate
  if (status.hasClientId && status.hasClientSecret && status.hasTokens) {
    console.log(`${colors.green}✓ Already authenticated!${colors.reset}`);
    console.log('');
    console.log('If you want to re-authenticate with a different account:');
    console.log(`  1. Delete token file: rm "${status.tokenPath}"`);
    console.log('  2. Run this script again');
    console.log('');
    return;
  }

  // Step 2: Get OAuth credentials
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}Step 2: OAuth Credentials${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log('');

  let clientId = '';
  let clientSecret = '';
  // MEDIUM-001 FIX: Support configurable redirect URI from environment
  let redirectUri = process.env['OAUTH_REDIRECT_URI'] || 'http://localhost:3000/callback';

  if (!status.hasClientId || !status.hasClientSecret) {
    // Try to auto-find credentials.json
    console.log('Looking for credentials.json in common locations...');
    const credPath = await findCredentials();

    if (credPath) {
      console.log(`${colors.green}✓ Found credentials file: ${credPath}${colors.reset}`);
      const creds = await extractCredentialsFromJson(credPath);

      if (creds) {
        console.log(`${colors.green}✓ Extracted OAuth credentials${colors.reset}`);
        clientId = creds.clientId;
        clientSecret = creds.clientSecret;
        redirectUri = creds.redirectUri;

        // Update .env file
        await updateEnvFile(clientId, clientSecret, redirectUri);
        console.log(`${colors.green}✓ Updated .env file${colors.reset}`);
      } else {
        console.log(`${colors.red}✗ Could not parse credentials file${colors.reset}`);
      }
    }

    if (!clientId || !clientSecret) {
      // Try embedded credentials (published app — zero-config for end users)
      if (isEmbeddedOAuthConfigured()) {
        console.log(
          `${colors.green}✓ Using ServalSheets published OAuth credentials${colors.reset}`
        );
        clientId = EMBEDDED_OAUTH.clientId;
        clientSecret = EMBEDDED_OAUTH.clientSecret;
        redirectUri = EMBEDDED_OAUTH.redirectUri;
      } else {
        console.log(`${colors.yellow}No credentials found automatically.${colors.reset}`);
        console.log('');
        console.log('The embedded OAuth credentials have not been configured yet.');
        console.log('You can either:');
        console.log('');
        console.log(`  ${colors.cyan}Option A:${colors.reset} Create your own OAuth credentials:`);
        console.log(
          `    1. Go to: ${colors.cyan}https://console.cloud.google.com/apis/credentials${colors.reset}`
        );
        console.log(`    2. Create OAuth client ID (Desktop application)`);
        console.log(`    3. Download the JSON file as credentials.json`);
        console.log(`    4. Place it in the current directory and run this script again`);
        console.log('');
        console.log(`  ${colors.cyan}Option B:${colors.reset} Wait for the published app release`);
        console.log(`    The maintainer is setting up Google-verified OAuth credentials.`);
        console.log(`    Once available, this script will use them automatically.`);
        console.log('');
        process.exit(1);
      }
    }
  } else {
    // Load from .env
    const envContent = await fsPromises.readFile(status.envPath, 'utf-8');
    const clientIdMatch = envContent.match(/OAUTH_CLIENT_ID=(.+)/);
    const clientSecretMatch = envContent.match(/OAUTH_CLIENT_SECRET=(.+)/);
    const redirectUriMatch = envContent.match(/OAUTH_REDIRECT_URI=(.+)/);

    if (clientIdMatch) clientId = clientIdMatch[1]?.trim() ?? '';
    if (clientSecretMatch) clientSecret = clientSecretMatch[1]?.trim() ?? '';
    // MEDIUM-001 FIX: Support configurable redirect URI
    const defaultRedirectUri =
      process.env['OAUTH_REDIRECT_URI'] || 'http://localhost:3000/callback';
    if (redirectUriMatch) redirectUri = redirectUriMatch[1]?.trim() ?? defaultRedirectUri;

    console.log(`${colors.green}✓ Loaded OAuth credentials from .env${colors.reset}`);
  }

  console.log('');

  // Step 3: Start authentication flow
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}Step 3: Authorization${colors.reset}`);
  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log('');

  try {
    // Create OAuth2 client
    const oauth2Client: OAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Get recommended scopes (deployment-aware: full for self-hosted, standard for SaaS)
    const scopes = Array.from(getRecommendedScopes());

    // Determine effective scope mode for user feedback
    const explicitMode = process.env['OAUTH_SCOPE_MODE'];
    const deploymentMode = process.env['DEPLOYMENT_MODE'] ?? 'self-hosted';
    const scopeMode = explicitMode ?? (deploymentMode === 'saas' ? 'standard' : 'full');

    console.log(
      `${colors.cyan}Scope mode: ${colors.bright}${scopeMode}${colors.reset} (${scopes.length} permissions)`
    );
    console.log('');

    // Warn about disabled features in standard mode
    if (scopeMode === 'standard') {
      console.log(
        `${colors.yellow}⚠️  Standard scope mode - some features will be disabled:${colors.reset}`
      );
      console.log(`  • Sharing/collaboration (sheets_collaborate)`);
      console.log(`  • BigQuery integration (sheets_bigquery)`);
      console.log(`  • Apps Script automation (sheets_appsscript)`);
      console.log(`  • Webhook notifications (sheets_webhook)`);
      console.log('');
      console.log(
        `${colors.cyan}💡 To enable all features, set: ${colors.bright}OAUTH_SCOPE_MODE=full${colors.reset}`
      );
      console.log('');
    } else if (scopeMode === 'full') {
      console.log(`${colors.green}✓${colors.reset} All features enabled (298/298 actions)`);
      console.log('');
    }

    console.log(`${colors.cyan}Requesting the following permissions:${colors.reset}`);
    console.log('');
    scopes.forEach((scope) => {
      const description = SCOPE_DESCRIPTIONS[scope] ?? scope;
      console.log(`  ${colors.green}✓${colors.reset} ${description}`);
    });
    console.log('');

    // Generate authorization URL with full scopes upfront
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      include_granted_scopes: true,
    });

    console.log('Opening browser for Google authentication...');
    console.log('');
    console.log(`${colors.yellow}If browser doesn't open, visit this URL:${colors.reset}`);
    console.log(`${colors.cyan}${authUrl}${colors.reset}`);
    console.log('');

    // Open browser
    try {
      await openBrowser(authUrl);
      console.log(`${colors.green}✓ Browser opened${colors.reset}`);
    } catch (_error) {
      console.log(`${colors.yellow}⚠ Could not open browser automatically${colors.reset}`);
      console.log('Please copy and paste the URL above into your browser.');
    }

    console.log('');

    // Start callback server and wait for authorization
    const port = new URL(redirectUri).port || '3000';
    const authCode = await startCallbackServer(parseInt(port, 10));

    console.log(`${colors.green}✓ Authorization code received${colors.reset}`);
    console.log('');
    console.log('Exchanging code for tokens...');

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(authCode);

    // Save tokens to encrypted file
    const tokenPath = path.join(process.env['HOME'] || '', '.servalsheets', 'tokens.encrypted');
    const encryptionKey = process.env['ENCRYPTION_KEY'] || randomBytes(32).toString('hex');

    // If we generated a new encryption key, add it to .env
    if (!process.env['ENCRYPTION_KEY']) {
      const envPath = path.join(process.cwd(), '.env');
      let envContent = await fsPromises.readFile(envPath, 'utf-8');
      envContent += `\n# Token Encryption Key (auto-generated)\nENCRYPTION_KEY=${encryptionKey}\n`;
      await fsPromises.writeFile(envPath, envContent, 'utf-8');
    }

    const tokenStore = new EncryptedFileTokenStore(tokenPath, encryptionKey);
    await tokenStore.save({
      access_token: tokens.access_token ?? undefined,
      refresh_token: tokens.refresh_token ?? undefined,
      expiry_date: tokens.expiry_date ?? undefined,
      token_type: tokens.token_type ?? undefined,
      scope: tokens.scope ?? undefined,
      id_token: tokens.id_token ?? undefined,
    });

    console.log(`${colors.green}✓ Tokens saved to: ${tokenPath}${colors.reset}`);
    console.log('');

    // Success!
    console.log(
      `${colors.green}${colors.bright}╔════════════════════════════════════════════╗${colors.reset}`
    );
    console.log(
      `${colors.green}${colors.bright}║                                            ║${colors.reset}`
    );
    console.log(
      `${colors.green}${colors.bright}║         Setup Complete! ✨                 ║${colors.reset}`
    );
    console.log(
      `${colors.green}${colors.bright}║                                            ║${colors.reset}`
    );
    console.log(
      `${colors.green}${colors.bright}╚════════════════════════════════════════════╝${colors.reset}`
    );
    console.log('');
    console.log('ServalSheets is now authenticated and ready to use!');
    console.log('');
    console.log(`${colors.cyan}Next steps:${colors.reset}`);
    console.log(`  1. Start the HTTP server: ${colors.yellow}npm run start:http${colors.reset}`);
    console.log(`  2. Or add to Claude Desktop config`);
    console.log(`  3. Try: ${colors.yellow}"List all my Google Sheets"${colors.reset}`);
    console.log('');
  } catch (error) {
    console.log('');
    console.log(`${colors.red}✗ Authentication failed:${colors.reset}`);
    console.log(`  ${error instanceof Error ? error.message : String(error)}`);
    console.log('');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Authentication setup failed:', error);
    process.exit(1);
  });
}

export { main as runAuthSetup };
