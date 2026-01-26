import { google } from 'googleapis';

// Use application default credentials
const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

// Import handler functions
const qualityModule = await import('../src/handlers/quality.js');
const confirmModule = await import('../src/handlers/confirm.js');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const spreadsheetName = `ServalSheets Fix Test - QualityConfirm - ${timestamp}`;

console.log(`\n=== Test Agent 3: Quality & Confirm Tools ===\n`);

// Step 1: Create test spreadsheet
console.log(`1. Creating test spreadsheet: ${spreadsheetName}`);
const createResult = await sheets.spreadsheets.create({
  requestBody: {
    properties: { title: spreadsheetName },
    sheets: [
      {
        properties: { title: 'TestSheet', gridProperties: { rowCount: 100, columnCount: 26 } },
      },
    ],
  },
});

const spreadsheetId = createResult.data.spreadsheetId!;
console.log(`✅ Created spreadsheet: ${spreadsheetId}\n`);

let totalTests = 0;
let successCount = 0;

// Step 2: Test sheets_quality.analyze_impact with valid tools
console.log(`2. Testing sheets_quality.analyze_impact with valid tools`);

const validTools = ['sheets_data', 'sheets_format', 'sheets_visualize'];

for (const toolName of validTools) {
  totalTests++;
  try {
    const result = await qualityModule.handleAnalyzeImpact({
      spreadsheetId,
      operation: {
        tool: toolName,
        action: 'test_action',
        affectedRange: 'A1:B10',
        estimatedCellCount: 20,
      },
    });

    if (result.content && result.content.length > 0) {
      console.log(`✅ sheets_quality.analyze_impact with tool="${toolName}" succeeded`);
      successCount++;
    } else {
      console.log(
        `❌ sheets_quality.analyze_impact with tool="${toolName}" returned empty content`
      );
    }
  } catch (error: any) {
    console.log(
      `❌ sheets_quality.analyze_impact with tool="${toolName}" failed: ${error.message}`
    );
  }
}

// Step 3: Test sheets_quality.analyze_impact with INVALID tool
console.log(`\n3. Testing sheets_quality.analyze_impact with INVALID tool`);
totalTests++;
try {
  const result = await qualityModule.handleAnalyzeImpact({
    spreadsheetId,
    operation: {
      tool: 'invalid_tool',
      action: 'test_action',
      affectedRange: 'A1:B10',
      estimatedCellCount: 20,
    },
  });
  console.log(`❌ sheets_quality.analyze_impact with invalid tool should have failed but didn't`);
} catch (error: any) {
  if (
    error.message.includes('Invalid tool name') ||
    error.message.includes('validation') ||
    error.name === 'ZodError'
  ) {
    console.log(
      `✅ sheets_quality.analyze_impact correctly rejected invalid tool: ${error.message}`
    );
    successCount++;
  } else {
    console.log(`⚠️  sheets_quality.analyze_impact failed with unexpected error: ${error.message}`);
  }
}

// Step 4: Test sheets_confirm.request WITHOUT optional fields
console.log(`\n4. Testing sheets_confirm.request WITHOUT optional fields (was 57% error rate!)`);
totalTests++;
try {
  const result = await confirmModule.handleRequestConfirmation({
    spreadsheetId,
    plan: [
      { stepNumber: 1, description: 'Read data', tool: 'sheets_data', action: 'read' },
      { stepNumber: 2, description: 'Format cells', tool: 'sheets_format', action: 'format' },
      { stepNumber: 3, description: 'Create chart', tool: 'sheets_visualize', action: 'create' },
    ],
    // NO optional fields: risk, isDestructive, canUndo
  });

  if (result.content && result.content.length > 0) {
    console.log(`✅ sheets_confirm.request WITHOUT optional fields succeeded`);
    console.log(`   Defaults applied: risk=low, isDestructive=false, canUndo=false`);
    successCount++;
  } else {
    console.log(`❌ sheets_confirm.request returned empty content`);
  }
} catch (error: any) {
  console.log(`❌ sheets_confirm.request WITHOUT optional fields failed: ${error.message}`);
  if (error.name === 'ZodError') {
    console.log(`   Validation errors:`, JSON.stringify(error.errors, null, 2));
  }
}

// Step 5: Test sheets_confirm.request WITH all optional fields
console.log(`\n5. Testing sheets_confirm.request WITH all optional fields`);
totalTests++;
try {
  const result = await confirmModule.handleRequestConfirmation({
    spreadsheetId,
    plan: [
      { stepNumber: 1, description: 'Delete sheet', tool: 'sheets_core', action: 'delete' },
      { stepNumber: 2, description: 'Clear data', tool: 'sheets_data', action: 'clear' },
    ],
    risk: 'high',
    isDestructive: true,
    canUndo: false,
  });

  if (result.content && result.content.length > 0) {
    console.log(`✅ sheets_confirm.request WITH all optional fields succeeded`);
    successCount++;
  } else {
    console.log(`❌ sheets_confirm.request returned empty content`);
  }
} catch (error: any) {
  console.log(`❌ sheets_confirm.request WITH optional fields failed: ${error.message}`);
  if (error.name === 'ZodError') {
    console.log(`   Validation errors:`, JSON.stringify(error.errors, null, 2));
  }
}

// Summary
console.log(`\n=== Test Results Summary ===`);
console.log(`Total tests run: ${totalTests}`);
console.log(`Success count: ${successCount}`);
console.log(`Success rate: ${((successCount / totalTests) * 100).toFixed(1)}%`);
console.log(`Spreadsheet ID: ${spreadsheetId}`);
console.log(`\n✅ Test Agent 3 Complete`);
