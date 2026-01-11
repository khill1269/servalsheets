/**
 * ServalSheets - Test Input Factory Functions
 *
 * Factory functions for creating common test input objects with sensible defaults.
 * Reduces boilerplate and ensures consistency across tests.
 */

/**
 * Factory for sheets_values read input
 *
 * Usage:
 * ```typescript
 * const input = createValuesReadInput({ spreadsheetId: 'my-sheet' });
 * const result = await handler.handle(input);
 * ```
 */
export function createValuesReadInput(overrides: {
  spreadsheetId?: string;
  range?: { a1: string } | { sheetName: string };
  valueRenderOption?: string;
  dateTimeRenderOption?: string;
} = {}) {
  return {
    action: 'read' as const,
    spreadsheetId: overrides.spreadsheetId || 'test-sheet-id',
    range: overrides.range || { a1: 'Sheet1!A1:B2' },
    valueRenderOption: overrides.valueRenderOption,
    dateTimeRenderOption: overrides.dateTimeRenderOption,
  };
}

/**
 * Factory for sheets_values write input
 */
export function createValuesWriteInput(overrides: {
  spreadsheetId?: string;
  range?: { a1: string };
  values?: any[][];
  valueInputOption?: string;
} = {}) {
  return {
    action: 'write' as const,
    spreadsheetId: overrides.spreadsheetId || 'test-sheet-id',
    range: overrides.range || { a1: 'Sheet1!A1:B2' },
    values: overrides.values || [['A', 'B'], ['1', '2']],
    valueInputOption: overrides.valueInputOption || 'USER_ENTERED',
  };
}

/**
 * Factory for sheets_spreadsheet get input
 */
export function createSpreadsheetGetInput(overrides: {
  spreadsheetId?: string;
  includeGridData?: boolean;
} = {}) {
  return {
    action: 'get' as const,
    spreadsheetId: overrides.spreadsheetId || 'test-sheet-id',
    includeGridData: overrides.includeGridData,
  };
}

/**
 * Factory for sheets_sheet create input
 */
export function createSheetCreateInput(overrides: {
  spreadsheetId?: string;
  title?: string;
  gridProperties?: {
    rowCount?: number;
    columnCount?: number;
  };
} = {}) {
  return {
    action: 'create' as const,
    spreadsheetId: overrides.spreadsheetId || 'test-sheet-id',
    title: overrides.title || 'New Sheet',
    gridProperties: overrides.gridProperties,
  };
}

/**
 * Factory for sheets_format apply input
 */
export function createFormatApplyInput(overrides: {
  spreadsheetId?: string;
  range?: { a1: string };
  format?: any;
} = {}) {
  return {
    action: 'apply' as const,
    spreadsheetId: overrides.spreadsheetId || 'test-sheet-id',
    range: overrides.range || { a1: 'Sheet1!A1:B2' },
    format: overrides.format || {
      backgroundColor: { red: 1, green: 0, blue: 0 },
    },
  };
}

/**
 * Factory for sheets_analyze analyze input
 */
export function createAnalyzeInput(overrides: {
  spreadsheetId?: string;
  range?: { a1: string };
  analysisTypes?: string[];
} = {}) {
  return {
    action: 'analyze' as const,
    spreadsheetId: overrides.spreadsheetId || 'test-sheet-id',
    range: overrides.range,
    analysisTypes: overrides.analysisTypes || ['summary'],
  };
}

/**
 * Factory for sheets_auth status input
 */
export function createAuthStatusInput() {
  return {
    action: 'status' as const,
  };
}

/**
 * Factory for sheets_auth login input
 */
export function createAuthLoginInput(overrides: {
  scopes?: string[];
} = {}) {
  return {
    action: 'login' as const,
    scopes: overrides.scopes,
  };
}

/**
 * Factory for mock Google Sheets API response
 */
export function createMockSheetsResponse(overrides: {
  values?: any[][];
  sheets?: any[];
} = {}) {
  return {
    data: {
      values: overrides.values || [['A', 'B'], ['1', '2']],
      sheets: overrides.sheets || [
        {
          properties: {
            sheetId: 0,
            title: 'Sheet1',
          },
        },
      ],
    },
  };
}
