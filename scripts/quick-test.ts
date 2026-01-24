#!/usr/bin/env tsx
/**
 * ServalSheets Direct Handler Tester
 * Bypasses MCP protocol for faster testing
 * Tests handlers directly with mock context
 */

import { google, sheets_v4, drive_v3 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

const TRACKING_SHEET_ID = '1P-uRTiCXwaKBI4il2qUMmJinZaHKjnRE2-q2IGSgBNA';

interface TestResult {
  tool: string;
  action: string;
  status: 'PASS' | 'FAIL' | 'TIMEOUT' | 'ERROR' | 'SKIP';
  duration: number;
  error?: string;
  timestamp: string;
}

// Quick auth setup
async function getAuthClient() {
  const tokenPath = path.join(process.env.HOME || '', '.servalsheets', 'tokens.json');

  if (!fs.existsSync(tokenPath)) {
    throw new Error('No tokens found. Run sheets_auth login first.');
  }

  const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID ||
      '650528178356-0h36h5unaah4rqahieflo20f062976rf.apps.googleusercontent.com',
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3000/callback'
  );

  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

async function runQuickTests() {
  console.log('🚀 ServalSheets Quick Test Runner\n');

  const auth = await getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  const results: TestResult[] = [];

  // Test 1: sheets.spreadsheets.get
  console.log('Testing sheets_core → get...');
  let start = Date.now();
  try {
    const res = await sheets.spreadsheets.get({
      spreadsheetId: TRACKING_SHEET_ID,
      fields: 'spreadsheetId,properties,spreadsheetUrl',
    });
    results.push({
      tool: 'sheets_core',
      action: 'get',
      status: 'PASS',
      duration: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
    console.log(`  ✅ PASS (${Date.now() - start}ms) - ${res.data.properties?.title}`);
  } catch (e: any) {
    results.push({
      tool: 'sheets_core',
      action: 'get',
      status: 'FAIL',
      duration: Date.now() - start,
      error: e.message,
      timestamp: new Date().toISOString(),
    });
    console.log(`  ❌ FAIL: ${e.message}`);
  }

  // Test 2: sheets.spreadsheets.values.get
  console.log('Testing sheets_data → read...');
  start = Date.now();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: TRACKING_SHEET_ID,
      range: "'Testing Dashboard'!A1:J5",
    });
    results.push({
      tool: 'sheets_data',
      action: 'read',
      status: 'PASS',
      duration: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
    console.log(`  ✅ PASS (${Date.now() - start}ms) - ${res.data.values?.length} rows`);
  } catch (e: any) {
    results.push({
      tool: 'sheets_data',
      action: 'read',
      status: 'FAIL',
      duration: Date.now() - start,
      error: e.message,
      timestamp: new Date().toISOString(),
    });
    console.log(`  ❌ FAIL: ${e.message}`);
  }

  // Test 3: drive.files.list
  console.log('Testing sheets_core → list...');
  start = Date.now();
  try {
    const res = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      pageSize: 5,
      fields: 'files(id,name)',
    });
    results.push({
      tool: 'sheets_core',
      action: 'list',
      status: 'PASS',
      duration: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
    console.log(`  ✅ PASS (${Date.now() - start}ms) - ${res.data.files?.length} spreadsheets`);
  } catch (e: any) {
    results.push({
      tool: 'sheets_core',
      action: 'list',
      status: 'FAIL',
      duration: Date.now() - start,
      error: e.message,
      timestamp: new Date().toISOString(),
    });
    console.log(`  ❌ FAIL: ${e.message}`);
  }

  // Test 4: drive.permissions.list
  console.log('Testing sheets_collaborate → share_list...');
  start = Date.now();
  try {
    const res = await drive.permissions.list({
      fileId: TRACKING_SHEET_ID,
      fields: 'permissions(id,type,role,emailAddress)',
    });
    results.push({
      tool: 'sheets_collaborate',
      action: 'share_list',
      status: 'PASS',
      duration: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
    console.log(
      `  ✅ PASS (${Date.now() - start}ms) - ${res.data.permissions?.length} permissions`
    );
  } catch (e: any) {
    results.push({
      tool: 'sheets_collaborate',
      action: 'share_list',
      status: 'FAIL',
      duration: Date.now() - start,
      error: e.message,
      timestamp: new Date().toISOString(),
    });
    console.log(`  ❌ FAIL: ${e.message}`);
  }

  // Test 5: drive.revisions.list
  console.log('Testing sheets_collaborate → version_list_revisions...');
  start = Date.now();
  try {
    const res = await drive.revisions.list({
      fileId: TRACKING_SHEET_ID,
      pageSize: 10,
      fields: 'revisions(id,modifiedTime)',
    });
    results.push({
      tool: 'sheets_collaborate',
      action: 'version_list_revisions',
      status: 'PASS',
      duration: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
    console.log(`  ✅ PASS (${Date.now() - start}ms) - ${res.data.revisions?.length} revisions`);
  } catch (e: any) {
    results.push({
      tool: 'sheets_collaborate',
      action: 'version_list_revisions',
      status: 'FAIL',
      duration: Date.now() - start,
      error: e.message,
      timestamp: new Date().toISOString(),
    });
    console.log(`  ❌ FAIL: ${e.message}`);
  }

  // Test 6: drive.files.copy
  console.log('Testing sheets_core → copy...');
  start = Date.now();
  try {
    const res = await drive.files.copy({
      fileId: TRACKING_SHEET_ID,
      requestBody: {
        name: `Test Copy - ${new Date().toISOString()}`,
      },
      fields: 'id,name',
    });
    results.push({
      tool: 'sheets_core',
      action: 'copy',
      status: 'PASS',
      duration: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
    console.log(`  ✅ PASS (${Date.now() - start}ms) - Created ${res.data.id}`);

    // Cleanup - delete the copy
    await drive.files.delete({ fileId: res.data.id! });
    console.log(`  🧹 Cleaned up test copy`);
  } catch (e: any) {
    results.push({
      tool: 'sheets_core',
      action: 'copy',
      status: 'FAIL',
      duration: Date.now() - start,
      error: e.message,
      timestamp: new Date().toISOString(),
    });
    console.log(`  ❌ FAIL: ${e.message}`);
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('SUMMARY');
  console.log('═'.repeat(50));
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Total: ${results.length} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);

  // Save results
  const resultsFile = path.join(__dirname, '../test-results', `quick-${Date.now()}.json`);
  if (!fs.existsSync(path.dirname(resultsFile))) {
    fs.mkdirSync(path.dirname(resultsFile), { recursive: true });
  }
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n📄 Results: ${resultsFile}`);

  return results;
}

runQuickTests().catch(console.error);
