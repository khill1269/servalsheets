#!/usr/bin/env node
/**
 * ServalSheets Live Test Environment Setup
 *
 * Prepares the live test environment before running live API tests.
 * Steps:
 *   1. Locate Google OAuth credentials
 *   2. Validate credentials with a minimal Sheets API call
 *   3. Create (or locate) a test spreadsheet
 *   4. Emit TEST_SPREADSHEET_ID for downstream use
 *
 * Usage:
 *   node scripts/live-test-setup.mjs
 *   eval $(node scripts/live-test-setup.mjs --export)   # sets env vars in shell
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const EXPORT_MODE = process.argv.includes('--export');

// ─── Credential Resolution ───────────────────────────────────

const CREDENTIAL_LOCATIONS = [
  // 1. Environment variable (JSON string)
  { source: 'env:GOOGLE_OAUTH_TOKENS', resolve: () => resolveEnvTokens() },
  // 2. Well-known file path
  {
    source: `~/.config/servalsheets/oauth-tokens.json`,
    resolve: () => resolveFileTokens(path.join(os.homedir(), '.config', 'servalsheets', 'oauth-tokens.json')),
  },
  // 3. Claude Desktop config
  {
    source: `~/Library/Application Support/Claude/claude_desktop_config.json`,
    resolve: () => resolveClaudeDesktopTokens(),
  },
  // 4. Local .env file in project root
  {
    source: `.env (GOOGLE_OAUTH_TOKENS)`,
    resolve: () => resolveEnvFile(path.join(ROOT, '.env')),
  },
];

function resolveEnvTokens() {
  const raw = process.env.GOOGLE_OAUTH_TOKENS;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function resolveFileTokens(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function resolveClaudeDesktopTokens() {
  const configPath = path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'Claude',
    'claude_desktop_config.json'
  );
  if (!fs.existsSync(configPath)) return null;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    // Look for servalsheets env block
    const servalEnv = config?.mcpServers?.servalsheets?.env ?? {};
    const raw = servalEnv.GOOGLE_OAUTH_TOKENS;
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function resolveEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^GOOGLE_OAUTH_TOKENS=(.+)$/);
      if (match) {
        try {
          return JSON.parse(match[1].replace(/^['"]|['"]$/g, ''));
        } catch {
          return null;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Credential Validation ───────────────────────────────────

async function validateCredentials(tokens) {
  if (!tokens?.access_token) return { valid: false, reason: 'No access_token in credentials' };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      'https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id)',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (response.status === 200) return { valid: true };
    if (response.status === 401) return { valid: false, reason: 'Token expired — refresh required' };
    return { valid: false, reason: `HTTP ${response.status} from Drive API` };
  } catch (err) {
    if (err.name === 'AbortError') return { valid: false, reason: 'Credential validation timed out' };
    return { valid: false, reason: `Network error: ${err.message}` };
  }
}

// ─── Spreadsheet Discovery/Creation ─────────────────────────

async function findOrCreateTestSpreadsheet(tokens) {
  const accessToken = tokens.access_token;
  const timestamp = new Date().toISOString().slice(0, 10);
  const title = `ServalSheets-Test-${timestamp}`;

  // First: try to find an existing test spreadsheet
  try {
    const searchResp = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name contains 'ServalSheets-Test' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&pageSize=10&fields=files(id,name,createdTime)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (searchResp.ok) {
      const data = await searchResp.json();
      if (data.files && data.files.length > 0) {
        // Prefer the most recently created
        const sorted = data.files.sort((a, b) =>
          new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime()
        );
        return { spreadsheetId: sorted[0].id, created: false, title: sorted[0].name };
      }
    }
  } catch {
    // Fall through to create
  }

  // Create a new test spreadsheet
  try {
    const createResp = await fetch(
      'https://sheets.googleapis.com/v4/spreadsheets',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: { title },
          sheets: [{ properties: { title: 'Sheet1' } }],
        }),
      }
    );

    if (createResp.ok) {
      const sheet = await createResp.json();
      return { spreadsheetId: sheet.spreadsheetId, created: true, title };
    }

    return { spreadsheetId: null, error: `Create failed: HTTP ${createResp.status}` };
  } catch (err) {
    return { spreadsheetId: null, error: `Create failed: ${err.message}` };
  }
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  if (!EXPORT_MODE) {
    console.log('ServalSheets Live Test Environment Setup');
    console.log('════════════════════════════════════════\n');
  }

  // Step 1: Find credentials
  let foundTokens = null;
  let foundSource = null;

  for (const loc of CREDENTIAL_LOCATIONS) {
    const tokens = loc.resolve();
    if (tokens) {
      foundTokens = tokens;
      foundSource = loc.source;
      break;
    }
  }

  if (!foundTokens) {
    if (!EXPORT_MODE) {
      console.log('Credential check:');
      for (const loc of CREDENTIAL_LOCATIONS) {
        console.log(`  ✗ ${loc.source}`);
      }
      console.log('');
      console.log('No credentials found. To set up live testing:');
      console.log('');
      console.log('  Option A — Environment variable:');
      console.log('    export GOOGLE_OAUTH_TOKENS=\'{"access_token":"ya29...","refresh_token":"1//..."}\'');
      console.log('');
      console.log('  Option B — Config file:');
      console.log('    mkdir -p ~/.config/servalsheets');
      console.log('    echo \'{"access_token":"ya29...","refresh_token":"1//..."}\' > ~/.config/servalsheets/oauth-tokens.json');
      console.log('');
      console.log('  Option C — Run auth flow:');
      console.log('    npm run start  # then call sheets_auth.login to get tokens');
      console.log('');
    }
    process.exit(1);
  }

  if (!EXPORT_MODE) {
    console.log(`Credentials found: ${foundSource}`);
  }

  // Step 2: Validate
  if (!EXPORT_MODE) process.stdout.write('Validating credentials... ');
  const validation = await validateCredentials(foundTokens);

  if (!validation.valid) {
    if (!EXPORT_MODE) {
      console.log(`✗ ${validation.reason}`);
      console.log('');
      console.log('Run the auth flow to refresh tokens:');
      console.log('  npm run start  # call sheets_auth.login');
    }
    process.exit(1);
  }

  if (!EXPORT_MODE) console.log('✓');

  // Step 3: Find or create test spreadsheet
  if (!EXPORT_MODE) process.stdout.write('Locating test spreadsheet... ');
  const sheetResult = await findOrCreateTestSpreadsheet(foundTokens);

  if (!sheetResult.spreadsheetId) {
    if (!EXPORT_MODE) {
      console.log(`✗ ${sheetResult.error}`);
      console.log('');
      console.log('Check that the OAuth token has Sheets write scope.');
    }
    process.exit(1);
  }

  if (!EXPORT_MODE) {
    if (sheetResult.created) {
      console.log(`✓ Created: ${sheetResult.title}`);
    } else {
      console.log(`✓ Found: ${sheetResult.title}`);
    }
  }

  // Step 4: Output
  if (EXPORT_MODE) {
    // Shell-eval mode — emit export statements
    console.log(`export TEST_SPREADSHEET_ID="${sheetResult.spreadsheetId}"`);
    console.log(`export GOOGLE_OAUTH_TOKENS='${JSON.stringify(foundTokens)}'`);
  } else {
    console.log('');
    console.log('Environment ready:');
    console.log(`  TEST_SPREADSHEET_ID=${sheetResult.spreadsheetId}`);
    console.log(`  Spreadsheet URL: https://docs.google.com/spreadsheets/d/${sheetResult.spreadsheetId}`);
    console.log('');
    console.log('Run live tests:');
    console.log(`  TEST_SPREADSHEET_ID="${sheetResult.spreadsheetId}" npm run test:live:fast`);
    console.log('');
    console.log('Or set it in your shell:');
    console.log(`  export TEST_SPREADSHEET_ID="${sheetResult.spreadsheetId}"`);
    console.log('  npm run test:live:fast');
    console.log('');
  }
}

main().catch((err) => {
  if (!EXPORT_MODE) {
    console.error(`\nSetup failed: ${err.message}`);
  }
  process.exit(1);
});
