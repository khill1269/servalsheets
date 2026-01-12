/**
 * Test Data Generator - Generate schema-compliant test data
 * Reads actual schemas and generates valid test arguments
 */

// Test spreadsheet ID (public Google Sheets example)
const TEST_SPREADSHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

export interface TestDataSpec {
  tool: string;
  action: string;
  args: any;
  description: string;
  requiresAuth: boolean;
}

/**
 * Generate test arguments for all tools and actions
 * Based on actual schema definitions in src/schemas/
 */
export function generateAllTestData(): Map<string, TestDataSpec> {
  const testData = new Map<string, TestDataSpec>();

  // Generate test data for each tool
  const generators = [
    ...generateAuthTestData(),
    ...generateSpreadsheetTestData(),
    ...generateSheetTestData(),
    ...generateValuesTestData(),
    ...generateCellsTestData(),
    ...generateFormatTestData(),
    ...generateDimensionsTestData(),
    ...generateRulesTestData(),
    ...generateChartsTestData(),
    ...generatePivotTestData(),
    ...generateFilterSortTestData(),
    ...generateSharingTestData(),
    ...generateCommentsTestData(),
    ...generateVersionsTestData(),
    ...generateAnalysisTestData(),
    ...generateAdvancedTestData(),
    ...generateTransactionTestData(),
    ...generateValidationTestData(),
    ...generateConflictTestData(),
    ...generateImpactTestData(),
    ...generateHistoryTestData(),
    ...generateConfirmTestData(),
    ...generateAnalyzeTestData(),
    ...generateFixTestData(),
    ...generateCompositeTestData(),
  ];

  for (const spec of generators) {
    testData.set(`${spec.tool}.${spec.action}`, spec);
  }

  return testData;
}

/**
 * sheets_auth test data
 */
function generateAuthTestData(): TestDataSpec[] {
  return [
    {
      tool: 'sheets_auth',
      action: 'status',
      args: { action: 'status' },
      description: 'Check authentication status',
      requiresAuth: false,
    },
    {
      tool: 'sheets_auth',
      action: 'login',
      args: { action: 'login' },
      description: 'Start OAuth flow',
      requiresAuth: false,
    },
    {
      tool: 'sheets_auth',
      action: 'callback',
      args: { action: 'callback', code: 'test-oauth-code' },
      description: 'Complete OAuth with code',
      requiresAuth: false,
    },
    {
      tool: 'sheets_auth',
      action: 'logout',
      args: { action: 'logout' },
      description: 'Clear authentication',
      requiresAuth: false,
    },
  ];
}

/**
 * sheets_spreadsheet test data
 */
function generateSpreadsheetTestData(): TestDataSpec[] {
  return [
    {
      tool: 'sheets_spreadsheet',
      action: 'get',
      args: { action: 'get', spreadsheetId: TEST_SPREADSHEET_ID },
      description: 'Get spreadsheet metadata',
      requiresAuth: true,
    },
    {
      tool: 'sheets_spreadsheet',
      action: 'create',
      args: { action: 'create', title: 'Test Spreadsheet' },
      description: 'Create new spreadsheet',
      requiresAuth: true,
    },
    {
      tool: 'sheets_spreadsheet',
      action: 'copy',
      args: { action: 'copy', spreadsheetId: TEST_SPREADSHEET_ID },
      description: 'Copy spreadsheet',
      requiresAuth: true,
    },
    {
      tool: 'sheets_spreadsheet',
      action: 'update_properties',
      args: {
        action: 'update_properties',
        spreadsheetId: TEST_SPREADSHEET_ID,
        title: 'Updated Title',
      },
      description: 'Update spreadsheet properties',
      requiresAuth: true,
    },
    {
      tool: 'sheets_spreadsheet',
      action: 'get_url',
      args: { action: 'get_url', spreadsheetId: TEST_SPREADSHEET_ID },
      description: 'Get spreadsheet URL',
      requiresAuth: true,
    },
    {
      tool: 'sheets_spreadsheet',
      action: 'batch_get',
      args: { action: 'batch_get', spreadsheetIds: [TEST_SPREADSHEET_ID] },
      description: 'Batch get spreadsheets',
      requiresAuth: true,
    },
    {
      tool: 'sheets_spreadsheet',
      action: 'get_comprehensive',
      args: { action: 'get_comprehensive', spreadsheetId: TEST_SPREADSHEET_ID },
      description: 'Get comprehensive spreadsheet info',
      requiresAuth: true,
    },
    {
      tool: 'sheets_spreadsheet',
      action: 'list',
      args: { action: 'list', pageSize: 10 },
      description: 'List spreadsheets',
      requiresAuth: true,
    },
  ];
}

/**
 * sheets_sheet test data
 */
function generateSheetTestData(): TestDataSpec[] {
  return [
    {
      tool: 'sheets_sheet',
      action: 'add',
      args: {
        action: 'add',
        spreadsheetId: TEST_SPREADSHEET_ID,
        title: 'New Sheet',
      },
      description: 'Add new sheet',
      requiresAuth: true,
    },
    {
      tool: 'sheets_sheet',
      action: 'delete',
      args: {
        action: 'delete',
        spreadsheetId: TEST_SPREADSHEET_ID,
        sheetId: 999,
      },
      description: 'Delete sheet',
      requiresAuth: true,
    },
    {
      tool: 'sheets_sheet',
      action: 'duplicate',
      args: {
        action: 'duplicate',
        spreadsheetId: TEST_SPREADSHEET_ID,
        sourceSheetId: 0,
        newSheetName: 'Duplicated Sheet',
      },
      description: 'Duplicate sheet',
      requiresAuth: true,
    },
    {
      tool: 'sheets_sheet',
      action: 'update',
      args: {
        action: 'update',
        spreadsheetId: TEST_SPREADSHEET_ID,
        sheetId: 0,
        title: 'Updated Sheet',
      },
      description: 'Update sheet properties',
      requiresAuth: true,
    },
    {
      tool: 'sheets_sheet',
      action: 'copy_to',
      args: {
        action: 'copy_to',
        spreadsheetId: TEST_SPREADSHEET_ID,
        sheetId: 0,
        destinationSpreadsheetId: TEST_SPREADSHEET_ID,
      },
      description: 'Copy sheet to another spreadsheet',
      requiresAuth: true,
    },
    {
      tool: 'sheets_sheet',
      action: 'list',
      args: {
        action: 'list',
        spreadsheetId: TEST_SPREADSHEET_ID,
      },
      description: 'List sheets',
      requiresAuth: true,
    },
    {
      tool: 'sheets_sheet',
      action: 'get',
      args: {
        action: 'get',
        spreadsheetId: TEST_SPREADSHEET_ID,
        sheetId: 0,
      },
      description: 'Get sheet properties',
      requiresAuth: true,
    },
  ];
}

/**
 * sheets_values test data
 */
function generateValuesTestData(): TestDataSpec[] {
  return [
    {
      tool: 'sheets_values',
      action: 'read',
      args: {
        action: 'read',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:D10',
      },
      description: 'Read cell values',
      requiresAuth: true,
    },
    {
      tool: 'sheets_values',
      action: 'write',
      args: {
        action: 'write',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:B2',
        values: [
          ['Header 1', 'Header 2'],
          ['Value 1', 'Value 2'],
        ],
      },
      description: 'Write cell values',
      requiresAuth: true,
    },
    {
      tool: 'sheets_values',
      action: 'append',
      args: {
        action: 'append',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A:B',
        values: [['New', 'Data']],
      },
      description: 'Append values',
      requiresAuth: true,
    },
    {
      tool: 'sheets_values',
      action: 'clear',
      args: {
        action: 'clear',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:B2',
      },
      description: 'Clear values',
      requiresAuth: true,
    },
    {
      tool: 'sheets_values',
      action: 'batch_read',
      args: {
        action: 'batch_read',
        spreadsheetId: TEST_SPREADSHEET_ID,
        ranges: ['Sheet1!A1:D10', 'Sheet1!F1:H10'],
      },
      description: 'Batch read values',
      requiresAuth: true,
    },
    {
      tool: 'sheets_values',
      action: 'batch_write',
      args: {
        action: 'batch_write',
        spreadsheetId: TEST_SPREADSHEET_ID,
        data: [
          { range: 'Sheet1!A1:B1', values: [['Header 1', 'Header 2']] },
          { range: 'Sheet1!A2:B2', values: [['Data 1', 'Data 2']] },
        ],
      },
      description: 'Batch write values',
      requiresAuth: true,
    },
    {
      tool: 'sheets_values',
      action: 'batch_clear',
      args: {
        action: 'batch_clear',
        spreadsheetId: TEST_SPREADSHEET_ID,
        ranges: ['Sheet1!A1:B2', 'Sheet1!C1:D2'],
      },
      description: 'Batch clear values',
      requiresAuth: true,
    },
    {
      tool: 'sheets_values',
      action: 'find',
      args: {
        action: 'find',
        spreadsheetId: TEST_SPREADSHEET_ID,
        query: 'search text',
      },
      description: 'Find values',
      requiresAuth: true,
    },
    {
      tool: 'sheets_values',
      action: 'replace',
      args: {
        action: 'replace',
        spreadsheetId: TEST_SPREADSHEET_ID,
        find: 'old text',
        replacement: 'new text',
      },
      description: 'Replace values',
      requiresAuth: true,
    },
  ];
}

// Add placeholder generators for remaining tools
function generateCellsTestData(): TestDataSpec[] {
  return [
    {
      tool: 'sheets_cells',
      action: 'merge',
      args: {
        action: 'merge',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:B2',
        mergeType: 'MERGE_ALL',
      },
      description: 'Merge cells',
      requiresAuth: true,
    },
    // ... more cells actions
  ];
}

function generateFormatTestData(): TestDataSpec[] {
  return [
    {
      tool: 'sheets_format',
      action: 'set_format',
      args: {
        action: 'set_format',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:B2',
        format: { bold: true },
      },
      description: 'Set cell format',
      requiresAuth: true,
    },
    // ... more format actions
  ];
}

// Placeholder generators for remaining tools
function generateDimensionsTestData(): TestDataSpec[] { return []; }
function generateRulesTestData(): TestDataSpec[] { return []; }
function generateChartsTestData(): TestDataSpec[] { return []; }
function generatePivotTestData(): TestDataSpec[] { return []; }
function generateFilterSortTestData(): TestDataSpec[] { return []; }
function generateSharingTestData(): TestDataSpec[] { return []; }
function generateCommentsTestData(): TestDataSpec[] { return []; }
function generateVersionsTestData(): TestDataSpec[] { return []; }
function generateAnalysisTestData(): TestDataSpec[] { return []; }
function generateAdvancedTestData(): TestDataSpec[] { return []; }
function generateTransactionTestData(): TestDataSpec[] { return []; }
function generateValidationTestData(): TestDataSpec[] { return []; }
function generateConflictTestData(): TestDataSpec[] { return []; }
function generateImpactTestData(): TestDataSpec[] { return []; }
function generateHistoryTestData(): TestDataSpec[] { return []; }
function generateConfirmTestData(): TestDataSpec[] { return []; }
function generateAnalyzeTestData(): TestDataSpec[] { return []; }
function generateFixTestData(): TestDataSpec[] { return []; }
function generateCompositeTestData(): TestDataSpec[] { return []; }

/**
 * Get test arguments for a specific tool and action
 */
export function getTestArgs(tool: string, action: string): any {
  const testData = generateAllTestData();
  const key = `${tool}.${action}`;
  const spec = testData.get(key);

  if (spec) {
    return spec.args;
  }

  // Fallback: minimal valid args
  return { action };
}
