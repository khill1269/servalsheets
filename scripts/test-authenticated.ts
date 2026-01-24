/**
 * Authenticated Action Tester - Tests ALL 250 actions with real OAuth
 * 
 * Unlike test-all-actions-comprehensive.ts which runs unauthenticated,
 * this script uses your OAuth credentials to test actions against a REAL spreadsheet.
 * 
 * Usage:
 *   npm run build && node dist/scripts/test-authenticated.js
 *   npm run build && node dist/scripts/test-authenticated.js --tool sheets_data
 *   npm run build && node dist/scripts/test-authenticated.js --action clear
 *   npm run build && node dist/scripts/test-authenticated.js --timeout 5000
 * 
 * Key features:
 *   - 5-second timeout per action (catches hangs quickly)
 *   - Real authentication via OAuth
 *   - Tests against your actual spreadsheet
 *   - Detailed issue logging for debugging
 *   - CSV output for tracking sheet
 */

import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { writeFileSync, appendFileSync } from 'fs';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Your testing spreadsheet
const TEST_SPREADSHEET_ID = '1P-uRTiCXwaKBI4il2qUMmJinZaHKjnRE2-q2IGSgBNA';
const TEST_SHEET_NAME = '🧪 Test Sandbox';
const TEST_SHEET_ID = 23117074; // gid from URL

interface Config {
  timeout: number;
  filterTool: string | null;
  filterAction: string | null;
  verbose: boolean;
  outputFile: string;
}

const config: Config = {
  timeout: 5000, // 5 seconds - quick timeout to catch hangs
  filterTool: null,
  filterAction: null,
  verbose: false,
  outputFile: 'test-authenticated-results.csv',
};

// Parse CLI args
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--tool=')) config.filterTool = arg.split('=')[1];
  if (arg.startsWith('--action=')) config.filterAction = arg.split('=')[1];
  if (arg.startsWith('--timeout=')) config.timeout = parseInt(arg.split('=')[1]);
  if (arg === '--verbose' || arg === '-v') config.verbose = true;
}

// ============================================================================
// TEST DEFINITIONS - ALL 250 ACTIONS
// ============================================================================

type ActionDef = {
  tool: string;
  action: string;
  args: Record<string, any>;
  skip?: string; // Reason to skip
  destructive?: boolean; // Needs cleanup after
};

const wrap = (args: any) => ({ request: args });

function getAllActions(): ActionDef[] {
  const ssId = TEST_SPREADSHEET_ID;
  const sheetId = TEST_SHEET_ID;
  const range = `'${TEST_SHEET_NAME}'!A1:B2`;
  const cell = `'${TEST_SHEET_NAME}'!H5`;

  return [
    // ========== sheets_auth (4) ==========
    { tool: 'sheets_auth', action: 'status', args: wrap({ action: 'status' }) },
    { tool: 'sheets_auth', action: 'login', args: wrap({ action: 'login' }) },
    { tool: 'sheets_auth', action: 'logout', args: wrap({ action: 'logout' }), skip: 'Would break session' },
    { tool: 'sheets_auth', action: 'callback', args: wrap({ action: 'callback', code: 'test' }), skip: 'Requires real OAuth code' },

    // ========== sheets_core (15) ==========
    { tool: 'sheets_core', action: 'get', args: wrap({ action: 'get', spreadsheetId: ssId }) },
    { tool: 'sheets_core', action: 'create', args: wrap({ action: 'create', title: 'Test Sheet Auto' }), skip: 'Creates files' },
    { tool: 'sheets_core', action: 'copy', args: wrap({ action: 'copy', spreadsheetId: ssId }), skip: 'Creates files' },
    { tool: 'sheets_core', action: 'update_properties', args: wrap({ action: 'update_properties', spreadsheetId: ssId, title: 'Test' }), skip: 'Modifies sheet' },
    { tool: 'sheets_core', action: 'get_url', args: wrap({ action: 'get_url', spreadsheetId: ssId }) },
    { tool: 'sheets_core', action: 'batch_get', args: wrap({ action: 'batch_get', spreadsheetIds: [ssId] }) },
    { tool: 'sheets_core', action: 'get_comprehensive', args: wrap({ action: 'get_comprehensive', spreadsheetId: ssId }) },
    { tool: 'sheets_core', action: 'list', args: wrap({ action: 'list', maxResults: 5 }) },
    { tool: 'sheets_core', action: 'add_sheet', args: wrap({ action: 'add_sheet', spreadsheetId: ssId, title: 'TempSheet' }), skip: 'Modifies sheet' },
    { tool: 'sheets_core', action: 'delete_sheet', args: wrap({ action: 'delete_sheet', spreadsheetId: ssId, sheetId: 999 }), skip: 'Destructive' },
    { tool: 'sheets_core', action: 'duplicate_sheet', args: wrap({ action: 'duplicate_sheet', spreadsheetId: ssId, sheetId }) },
    { tool: 'sheets_core', action: 'update_sheet', args: wrap({ action: 'update_sheet', spreadsheetId: ssId, sheetId, title: 'Renamed' }), skip: 'Modifies sheet' },
    { tool: 'sheets_core', action: 'copy_sheet_to', args: wrap({ action: 'copy_sheet_to', spreadsheetId: ssId, sheetId, destinationSpreadsheetId: ssId }) },
    { tool: 'sheets_core', action: 'list_sheets', args: wrap({ action: 'list_sheets', spreadsheetId: ssId }) },
    { tool: 'sheets_core', action: 'get_sheet', args: wrap({ action: 'get_sheet', spreadsheetId: ssId, sheetId }) },

    // ========== sheets_data (20) - CRITICAL TO TEST ==========
    { tool: 'sheets_data', action: 'read', args: wrap({ action: 'read', spreadsheetId: ssId, range }) },
    { tool: 'sheets_data', action: 'write', args: wrap({ action: 'write', spreadsheetId: ssId, range: cell, values: [['test']] }), destructive: true },
    { tool: 'sheets_data', action: 'append', args: wrap({ action: 'append', spreadsheetId: ssId, range: `'${TEST_SHEET_NAME}'!A:B`, values: [['X', 'Y']] }), skip: 'Adds data' },
    { tool: 'sheets_data', action: 'clear', args: wrap({ action: 'clear', spreadsheetId: ssId, range: cell }) }, // KNOWN HANG
    { tool: 'sheets_data', action: 'batch_read', args: wrap({ action: 'batch_read', spreadsheetId: ssId, ranges: [range] }) },
    { tool: 'sheets_data', action: 'batch_write', args: wrap({ action: 'batch_write', spreadsheetId: ssId, data: [{ range: cell, values: [['test']] }] }), destructive: true },
    { tool: 'sheets_data', action: 'batch_clear', args: wrap({ action: 'batch_clear', spreadsheetId: ssId, ranges: [cell] }) }, // KNOWN HANG
    { tool: 'sheets_data', action: 'find_replace', args: wrap({ action: 'find_replace', spreadsheetId: ssId, find: 'ZZZNOTFOUND', replace: 'X' }) },
    { tool: 'sheets_data', action: 'add_note', args: wrap({ action: 'add_note', spreadsheetId: ssId, cell, note: 'Test note' }) },
    { tool: 'sheets_data', action: 'get_note', args: wrap({ action: 'get_note', spreadsheetId: ssId, cell }) },
    { tool: 'sheets_data', action: 'clear_note', args: wrap({ action: 'clear_note', spreadsheetId: ssId, cell }) },
    { tool: 'sheets_data', action: 'set_validation', args: wrap({ action: 'set_validation', spreadsheetId: ssId, range: cell, validation: { type: 'ONE_OF_LIST', values: ['A', 'B'] } }) },
    { tool: 'sheets_data', action: 'clear_validation', args: wrap({ action: 'clear_validation', spreadsheetId: ssId, range: cell }) },
    { tool: 'sheets_data', action: 'set_hyperlink', args: wrap({ action: 'set_hyperlink', spreadsheetId: ssId, cell, url: 'https://example.com', label: 'Test' }) },
    { tool: 'sheets_data', action: 'clear_hyperlink', args: wrap({ action: 'clear_hyperlink', spreadsheetId: ssId, cell }) },
    { tool: 'sheets_data', action: 'merge_cells', args: wrap({ action: 'merge_cells', spreadsheetId: ssId, range: `'${TEST_SHEET_NAME}'!I1:J2`, mergeType: 'MERGE_ALL' }), destructive: true },
    { tool: 'sheets_data', action: 'unmerge_cells', args: wrap({ action: 'unmerge_cells', spreadsheetId: ssId, range: `'${TEST_SHEET_NAME}'!I1:J2` }) },
    { tool: 'sheets_data', action: 'get_merges', args: wrap({ action: 'get_merges', spreadsheetId: ssId, sheetId }) },
    { tool: 'sheets_data', action: 'cut_paste', args: wrap({ action: 'cut_paste', spreadsheetId: ssId, source: cell, destination: `'${TEST_SHEET_NAME}'!I5` }), destructive: true },
    { tool: 'sheets_data', action: 'copy_paste', args: wrap({ action: 'copy_paste', spreadsheetId: ssId, source: cell, destination: `'${TEST_SHEET_NAME}'!J5` }) },

    // ========== sheets_format (18) ==========
    { tool: 'sheets_format', action: 'set_format', args: wrap({ action: 'set_format', spreadsheetId: ssId, range: cell, format: { bold: true } }) },
    { tool: 'sheets_format', action: 'suggest_format', args: wrap({ action: 'suggest_format', spreadsheetId: ssId, range }), skip: 'Requires MCP sampling' },
    { tool: 'sheets_format', action: 'set_background', args: wrap({ action: 'set_background', spreadsheetId: ssId, range: cell, color: { red: 0.9, green: 0.9, blue: 0.9 } }) },
    { tool: 'sheets_format', action: 'set_text_format', args: wrap({ action: 'set_text_format', spreadsheetId: ssId, range: cell, textFormat: { bold: true } }) },
    { tool: 'sheets_format', action: 'set_number_format', args: wrap({ action: 'set_number_format', spreadsheetId: ssId, range: cell, numberFormat: { type: 'NUMBER', pattern: '#,##0' } }) },
    { tool: 'sheets_format', action: 'set_alignment', args: wrap({ action: 'set_alignment', spreadsheetId: ssId, range: cell, horizontalAlignment: 'CENTER' }) },
    { tool: 'sheets_format', action: 'set_borders', args: wrap({ action: 'set_borders', spreadsheetId: ssId, range: cell, top: { style: 'SOLID' } }) },
    { tool: 'sheets_format', action: 'clear_format', args: wrap({ action: 'clear_format', spreadsheetId: ssId, range: cell }) },
    { tool: 'sheets_format', action: 'apply_preset', args: wrap({ action: 'apply_preset', spreadsheetId: ssId, range, preset: 'header_row' }) },
    { tool: 'sheets_format', action: 'auto_fit', args: wrap({ action: 'auto_fit', spreadsheetId: ssId, sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 5 }) },
    { tool: 'sheets_format', action: 'rule_add_conditional_format', args: wrap({ action: 'rule_add_conditional_format', spreadsheetId: ssId, sheetId, ranges: [range], booleanRule: { condition: { type: 'NOT_BLANK' }, format: { backgroundColor: { red: 0.9, green: 1, blue: 0.9 } } } }) },
    { tool: 'sheets_format', action: 'rule_update_conditional_format', args: wrap({ action: 'rule_update_conditional_format', spreadsheetId: ssId, sheetId, ruleIndex: 0 }), skip: 'Needs existing rule' },
    { tool: 'sheets_format', action: 'rule_delete_conditional_format', args: wrap({ action: 'rule_delete_conditional_format', spreadsheetId: ssId, sheetId, ruleIndex: 999 }), skip: 'Needs existing rule' },
    { tool: 'sheets_format', action: 'rule_list_conditional_formats', args: wrap({ action: 'rule_list_conditional_formats', spreadsheetId: ssId, sheetId }) },
    { tool: 'sheets_format', action: 'set_data_validation', args: wrap({ action: 'set_data_validation', spreadsheetId: ssId, range: cell, condition: { type: 'ONE_OF_LIST', values: ['Yes', 'No'] } }) },
    { tool: 'sheets_format', action: 'clear_data_validation', args: wrap({ action: 'clear_data_validation', spreadsheetId: ssId, range: cell }) },
    { tool: 'sheets_format', action: 'list_data_validations', args: wrap({ action: 'list_data_validations', spreadsheetId: ssId, sheetId }) },
    { tool: 'sheets_format', action: 'add_conditional_format_rule', args: wrap({ action: 'add_conditional_format_rule', spreadsheetId: ssId, sheetId, ranges: [range], rulePreset: 'highlight_duplicates' }) },

    // ========== sheets_dimensions (39) ==========
    { tool: 'sheets_dimensions', action: 'insert_rows', args: wrap({ action: 'insert_rows', spreadsheetId: ssId, sheetId, startIndex: 50, endIndex: 51 }) },
    { tool: 'sheets_dimensions', action: 'insert_columns', args: wrap({ action: 'insert_columns', spreadsheetId: ssId, sheetId, startIndex: 20, endIndex: 21 }) },
    { tool: 'sheets_dimensions', action: 'delete_rows', args: wrap({ action: 'delete_rows', spreadsheetId: ssId, sheetId, startIndex: 50, endIndex: 51 }) },
    { tool: 'sheets_dimensions', action: 'delete_columns', args: wrap({ action: 'delete_columns', spreadsheetId: ssId, sheetId, startIndex: 20, endIndex: 21 }) },
    { tool: 'sheets_dimensions', action: 'move_rows', args: wrap({ action: 'move_rows', spreadsheetId: ssId, sheetId, startIndex: 40, endIndex: 41, destinationIndex: 45 }) },
    { tool: 'sheets_dimensions', action: 'move_columns', args: wrap({ action: 'move_columns', spreadsheetId: ssId, sheetId, startIndex: 15, endIndex: 16, destinationIndex: 18 }) },
    { tool: 'sheets_dimensions', action: 'resize_rows', args: wrap({ action: 'resize_rows', spreadsheetId: ssId, sheetId, startIndex: 0, endIndex: 1, pixelSize: 30 }) },
    { tool: 'sheets_dimensions', action: 'resize_columns', args: wrap({ action: 'resize_columns', spreadsheetId: ssId, sheetId, startIndex: 0, endIndex: 1, pixelSize: 100 }) },
    { tool: 'sheets_dimensions', action: 'auto_resize', args: wrap({ action: 'auto_resize', spreadsheetId: ssId, sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 3 }) },
    { tool: 'sheets_dimensions', action: 'hide_rows', args: wrap({ action: 'hide_rows', spreadsheetId: ssId, sheetId, startIndex: 45, endIndex: 46 }) },
    { tool: 'sheets_dimensions', action: 'hide_columns', args: wrap({ action: 'hide_columns', spreadsheetId: ssId, sheetId, startIndex: 18, endIndex: 19 }) },
    { tool: 'sheets_dimensions', action: 'show_rows', args: wrap({ action: 'show_rows', spreadsheetId: ssId, sheetId, startIndex: 45, endIndex: 46 }) },
    { tool: 'sheets_dimensions', action: 'show_columns', args: wrap({ action: 'show_columns', spreadsheetId: ssId, sheetId, startIndex: 18, endIndex: 19 }) },
    { tool: 'sheets_dimensions', action: 'freeze_rows', args: wrap({ action: 'freeze_rows', spreadsheetId: ssId, sheetId, frozenRowCount: 1 }) },
    { tool: 'sheets_dimensions', action: 'freeze_columns', args: wrap({ action: 'freeze_columns', spreadsheetId: ssId, sheetId, frozenColumnCount: 1 }) },
    { tool: 'sheets_dimensions', action: 'group_rows', args: wrap({ action: 'group_rows', spreadsheetId: ssId, sheetId, startIndex: 30, endIndex: 35 }) },
    { tool: 'sheets_dimensions', action: 'group_columns', args: wrap({ action: 'group_columns', spreadsheetId: ssId, sheetId, startIndex: 10, endIndex: 12 }) },
    { tool: 'sheets_dimensions', action: 'ungroup_rows', args: wrap({ action: 'ungroup_rows', spreadsheetId: ssId, sheetId, startIndex: 30, endIndex: 35 }) },
    { tool: 'sheets_dimensions', action: 'ungroup_columns', args: wrap({ action: 'ungroup_columns', spreadsheetId: ssId, sheetId, startIndex: 10, endIndex: 12 }) },
    { tool: 'sheets_dimensions', action: 'append_rows', args: wrap({ action: 'append_rows', spreadsheetId: ssId, sheetId, count: 1 }), skip: 'Adds rows' },
    { tool: 'sheets_dimensions', action: 'append_columns', args: wrap({ action: 'append_columns', spreadsheetId: ssId, sheetId, count: 1 }), skip: 'Adds columns' },
    { tool: 'sheets_dimensions', action: 'set_basic_filter', args: wrap({ action: 'set_basic_filter', spreadsheetId: ssId, range }) },
    { tool: 'sheets_dimensions', action: 'clear_basic_filter', args: wrap({ action: 'clear_basic_filter', spreadsheetId: ssId, sheetId }) },
    { tool: 'sheets_dimensions', action: 'get_basic_filter', args: wrap({ action: 'get_basic_filter', spreadsheetId: ssId, sheetId }) },
    { tool: 'sheets_dimensions', action: 'filter_update_filter_criteria', args: wrap({ action: 'filter_update_filter_criteria', spreadsheetId: ssId, sheetId, columnIndex: 0, criteria: {} }), skip: 'Needs filter' },
    { tool: 'sheets_dimensions', action: 'sort_range', args: wrap({ action: 'sort_range', spreadsheetId: ssId, range, sortSpecs: [{ dimensionIndex: 0, sortOrder: 'ASCENDING' }] }) },
    { tool: 'sheets_dimensions', action: 'trim_whitespace', args: wrap({ action: 'trim_whitespace', spreadsheetId: ssId, range }) },
    { tool: 'sheets_dimensions', action: 'randomize_range', args: wrap({ action: 'randomize_range', spreadsheetId: ssId, range }), skip: 'Modifies data' },
    { tool: 'sheets_dimensions', action: 'text_to_columns', args: wrap({ action: 'text_to_columns', spreadsheetId: ssId, range: cell, delimiter: { type: 'COMMA' } }) },
    { tool: 'sheets_dimensions', action: 'auto_fill', args: wrap({ action: 'auto_fill', spreadsheetId: ssId, sourceRange: cell, destinationRange: `'${TEST_SHEET_NAME}'!H5:H10` }), skip: 'Modifies data' },
    { tool: 'sheets_dimensions', action: 'create_filter_view', args: wrap({ action: 'create_filter_view', spreadsheetId: ssId, range, title: 'TestFilterView' }), skip: 'Creates resource' },
    { tool: 'sheets_dimensions', action: 'update_filter_view', args: wrap({ action: 'update_filter_view', spreadsheetId: ssId, filterViewId: 1 }), skip: 'Needs filter view' },
    { tool: 'sheets_dimensions', action: 'delete_filter_view', args: wrap({ action: 'delete_filter_view', spreadsheetId: ssId, filterViewId: 999 }), skip: 'Needs filter view' },
    { tool: 'sheets_dimensions', action: 'list_filter_views', args: wrap({ action: 'list_filter_views', spreadsheetId: ssId, sheetId }) },
    { tool: 'sheets_dimensions', action: 'get_filter_view', args: wrap({ action: 'get_filter_view', spreadsheetId: ssId, filterViewId: 1 }), skip: 'Needs filter view' },
    { tool: 'sheets_dimensions', action: 'create_slicer', args: wrap({ action: 'create_slicer', spreadsheetId: ssId, sheetId, range, column: { sourceColumnOffset: 0 } }), skip: 'Creates resource' },
    { tool: 'sheets_dimensions', action: 'update_slicer', args: wrap({ action: 'update_slicer', spreadsheetId: ssId, slicerId: 1 }), skip: 'Needs slicer' },
    { tool: 'sheets_dimensions', action: 'delete_slicer', args: wrap({ action: 'delete_slicer', spreadsheetId: ssId, slicerId: 999 }), skip: 'Needs slicer' },
    { tool: 'sheets_dimensions', action: 'list_slicers', args: wrap({ action: 'list_slicers', spreadsheetId: ssId, sheetId }) },

    // ========== sheets_visualize (16) ==========
    { tool: 'sheets_visualize', action: 'chart_create', args: wrap({ action: 'chart_create', spreadsheetId: ssId, sheetId, chartType: 'BAR', data: { sourceRange: range } }), skip: 'Creates chart' },
    { tool: 'sheets_visualize', action: 'suggest_chart', args: wrap({ action: 'suggest_chart', spreadsheetId: ssId, range }), skip: 'Requires sampling' },
    { tool: 'sheets_visualize', action: 'chart_update', args: wrap({ action: 'chart_update', spreadsheetId: ssId, chartId: 1, title: 'Updated' }), skip: 'Needs chart' },
    { tool: 'sheets_visualize', action: 'chart_delete', args: wrap({ action: 'chart_delete', spreadsheetId: ssId, chartId: 999 }), skip: 'Needs chart' },
    { tool: 'sheets_visualize', action: 'chart_list', args: wrap({ action: 'chart_list', spreadsheetId: ssId }) },
    { tool: 'sheets_visualize', action: 'chart_get', args: wrap({ action: 'chart_get', spreadsheetId: ssId, chartId: 1 }), skip: 'Needs chart' },
    { tool: 'sheets_visualize', action: 'chart_move', args: wrap({ action: 'chart_move', spreadsheetId: ssId, chartId: 1, position: { anchorCell: 'A1' } }), skip: 'Needs chart' },
    { tool: 'sheets_visualize', action: 'chart_resize', args: wrap({ action: 'chart_resize', spreadsheetId: ssId, chartId: 1, width: 600, height: 400 }), skip: 'Needs chart' },
    { tool: 'sheets_visualize', action: 'chart_update_data_range', args: wrap({ action: 'chart_update_data_range', spreadsheetId: ssId, chartId: 1, data: { sourceRange: range } }), skip: 'Needs chart' },
    { tool: 'sheets_visualize', action: 'pivot_create', args: wrap({ action: 'pivot_create', spreadsheetId: ssId, sheetId, sourceRange: range, values: [{ summarizeFunction: 'COUNTA', sourceColumnOffset: 0 }] }), skip: 'Creates pivot' },
    { tool: 'sheets_visualize', action: 'suggest_pivot', args: wrap({ action: 'suggest_pivot', spreadsheetId: ssId, range }), skip: 'Requires sampling' },
    { tool: 'sheets_visualize', action: 'pivot_update', args: wrap({ action: 'pivot_update', spreadsheetId: ssId, sheetId }), skip: 'Needs pivot' },
    { tool: 'sheets_visualize', action: 'pivot_delete', args: wrap({ action: 'pivot_delete', spreadsheetId: ssId, sheetId }), skip: 'Needs pivot' },
    { tool: 'sheets_visualize', action: 'pivot_list', args: wrap({ action: 'pivot_list', spreadsheetId: ssId }) },
    { tool: 'sheets_visualize', action: 'pivot_get', args: wrap({ action: 'pivot_get', spreadsheetId: ssId, sheetId }), skip: 'Needs pivot' },
    { tool: 'sheets_visualize', action: 'pivot_refresh', args: wrap({ action: 'pivot_refresh', spreadsheetId: ssId, sheetId }), skip: 'Needs pivot' },

    // ========== sheets_session (13) ==========
    { tool: 'sheets_session', action: 'set_active', args: wrap({ action: 'set_active', spreadsheetId: ssId, title: 'Test' }) },
    { tool: 'sheets_session', action: 'get_active', args: wrap({ action: 'get_active' }) },
    { tool: 'sheets_session', action: 'get_context', args: wrap({ action: 'get_context' }) },
    { tool: 'sheets_session', action: 'record_operation', args: wrap({ action: 'record_operation', tool: 'sheets_data', actionName: 'read', spreadsheetId: ssId }) },
    { tool: 'sheets_session', action: 'get_last_operation', args: wrap({ action: 'get_last_operation' }) },
    { tool: 'sheets_session', action: 'get_history', args: wrap({ action: 'get_history', limit: 5 }) },
    { tool: 'sheets_session', action: 'find_by_reference', args: wrap({ action: 'find_by_reference', reference: 'test', type: 'spreadsheet' }) },
    { tool: 'sheets_session', action: 'update_preferences', args: wrap({ action: 'update_preferences', preferences: { verbosity: 'minimal' } }) },
    { tool: 'sheets_session', action: 'get_preferences', args: wrap({ action: 'get_preferences' }) },
    { tool: 'sheets_session', action: 'set_pending', args: wrap({ action: 'set_pending', type: 'operation', data: { tool: 'test' } }) },
    { tool: 'sheets_session', action: 'get_pending', args: wrap({ action: 'get_pending' }) },
    { tool: 'sheets_session', action: 'clear_pending', args: wrap({ action: 'clear_pending' }) },
    { tool: 'sheets_session', action: 'reset', args: wrap({ action: 'reset' }) },

    // ========== sheets_history (7) ==========
    { tool: 'sheets_history', action: 'list', args: wrap({ action: 'list', limit: 5 }) },
    { tool: 'sheets_history', action: 'get', args: wrap({ action: 'get', operationId: 'op_1' }) },
    { tool: 'sheets_history', action: 'stats', args: wrap({ action: 'stats' }) },
    { tool: 'sheets_history', action: 'undo', args: wrap({ action: 'undo', spreadsheetId: ssId }) },
    { tool: 'sheets_history', action: 'redo', args: wrap({ action: 'redo', spreadsheetId: ssId }) },
    { tool: 'sheets_history', action: 'revert_to', args: wrap({ action: 'revert_to', operationId: 'op_1' }) },
    { tool: 'sheets_history', action: 'clear', args: wrap({ action: 'clear' }), skip: 'Clears history' },

    // ========== sheets_transaction (6) ==========
    { tool: 'sheets_transaction', action: 'begin', args: wrap({ action: 'begin', spreadsheetId: ssId }) },
    { tool: 'sheets_transaction', action: 'queue', args: wrap({ action: 'queue', transactionId: 'test', operation: { tool: 'sheets_data', action: 'read', params: {} } }), skip: 'Needs active tx' },
    { tool: 'sheets_transaction', action: 'commit', args: wrap({ action: 'commit', transactionId: 'test' }), skip: 'Needs active tx' },
    { tool: 'sheets_transaction', action: 'rollback', args: wrap({ action: 'rollback', transactionId: 'test' }) },
    { tool: 'sheets_transaction', action: 'status', args: wrap({ action: 'status', transactionId: 'test' }) },
    { tool: 'sheets_transaction', action: 'list', args: wrap({ action: 'list' }) },

    // ========== sheets_quality (4) ==========
    { tool: 'sheets_quality', action: 'validate', args: wrap({ action: 'validate', value: 'test@example.com', rules: ['not_empty', 'valid_email'] }) },
    { tool: 'sheets_quality', action: 'detect_conflicts', args: wrap({ action: 'detect_conflicts', spreadsheetId: ssId }) },
    { tool: 'sheets_quality', action: 'resolve_conflict', args: wrap({ action: 'resolve_conflict', conflictId: 'c1', resolution: 'keep_local' }), skip: 'Needs conflict' },
    { tool: 'sheets_quality', action: 'analyze_impact', args: wrap({ action: 'analyze_impact', spreadsheetId: ssId, operation: { type: 'delete_rows', sheetId, startIndex: 0, endIndex: 1 } }) },

    // ========== sheets_confirm (5) ==========
    { tool: 'sheets_confirm', action: 'request', args: wrap({ action: 'request', plan: { title: 'Test', description: 'Test op', steps: [] } }), skip: 'Requires elicitation' },
    { tool: 'sheets_confirm', action: 'get_stats', args: wrap({ action: 'get_stats' }) },
    { tool: 'sheets_confirm', action: 'wizard_start', args: wrap({ action: 'wizard_start', title: 'Test', steps: [{ id: 's1', title: 'Step 1' }] }), skip: 'Requires elicitation' },
    { tool: 'sheets_confirm', action: 'wizard_step', args: wrap({ action: 'wizard_step', wizardId: 'w1', stepId: 's1' }), skip: 'Needs wizard' },
    { tool: 'sheets_confirm', action: 'wizard_complete', args: wrap({ action: 'wizard_complete', wizardId: 'w1' }), skip: 'Needs wizard' },

    // ========== sheets_analyze (11) ==========
    { tool: 'sheets_analyze', action: 'comprehensive', args: wrap({ action: 'comprehensive', spreadsheetId: ssId }) },
    { tool: 'sheets_analyze', action: 'analyze_data', args: wrap({ action: 'analyze_data', spreadsheetId: ssId, range }) },
    { tool: 'sheets_analyze', action: 'suggest_visualization', args: wrap({ action: 'suggest_visualization', spreadsheetId: ssId, range }), skip: 'Requires sampling' },
    { tool: 'sheets_analyze', action: 'generate_formula', args: wrap({ action: 'generate_formula', spreadsheetId: ssId, description: 'Sum column A' }), skip: 'Requires sampling' },
    { tool: 'sheets_analyze', action: 'detect_patterns', args: wrap({ action: 'detect_patterns', spreadsheetId: ssId, range }) },
    { tool: 'sheets_analyze', action: 'analyze_structure', args: wrap({ action: 'analyze_structure', spreadsheetId: ssId }) },
    { tool: 'sheets_analyze', action: 'analyze_quality', args: wrap({ action: 'analyze_quality', spreadsheetId: ssId }) },
    { tool: 'sheets_analyze', action: 'analyze_performance', args: wrap({ action: 'analyze_performance', spreadsheetId: ssId }) },
    { tool: 'sheets_analyze', action: 'analyze_formulas', args: wrap({ action: 'analyze_formulas', spreadsheetId: ssId }) },
    { tool: 'sheets_analyze', action: 'query_natural_language', args: wrap({ action: 'query_natural_language', spreadsheetId: ssId, query: 'What is the total?' }), skip: 'Requires sampling' },
    { tool: 'sheets_analyze', action: 'explain_analysis', args: wrap({ action: 'explain_analysis', analysisResult: { type: 'test' }, question: 'Why?' }), skip: 'Requires sampling' },

    // ========== sheets_fix (1) ==========
    { tool: 'sheets_fix', action: 'fix', args: wrap({ action: 'fix', spreadsheetId: ssId, issues: [{ type: 'NO_FROZEN_HEADERS', severity: 'low', description: 'Test' }], mode: 'preview' }) },

    // ========== sheets_composite (4) ==========
    { tool: 'sheets_composite', action: 'import_csv', args: wrap({ action: 'import_csv', spreadsheetId: ssId, csvData: 'A,B\n1,2', targetRange: cell }), skip: 'Modifies data' },
    { tool: 'sheets_composite', action: 'smart_append', args: wrap({ action: 'smart_append', spreadsheetId: ssId, targetSheet: TEST_SHEET_NAME, data: [{ A: 1, B: 2 }] }), skip: 'Modifies data' },
    { tool: 'sheets_composite', action: 'bulk_update', args: wrap({ action: 'bulk_update', spreadsheetId: ssId, updates: [{ range: cell, values: [['X']] }] }), skip: 'Modifies data' },
    { tool: 'sheets_composite', action: 'deduplicate', args: wrap({ action: 'deduplicate', spreadsheetId: ssId, range, keyColumnIndices: [0] }), skip: 'Modifies data' },

    // ========== sheets_templates (8) ==========
    { tool: 'sheets_templates', action: 'list', args: wrap({ action: 'list' }) },
    { tool: 'sheets_templates', action: 'get', args: wrap({ action: 'get', templateId: 'test' }), skip: 'Needs template' },
    { tool: 'sheets_templates', action: 'create', args: wrap({ action: 'create', spreadsheetId: ssId, name: 'TestTemplate' }), skip: 'Creates resource' },
    { tool: 'sheets_templates', action: 'apply', args: wrap({ action: 'apply', templateId: 'test', title: 'NewSheet' }), skip: 'Creates resource' },
    { tool: 'sheets_templates', action: 'update', args: wrap({ action: 'update', templateId: 'test', name: 'Updated' }), skip: 'Needs template' },
    { tool: 'sheets_templates', action: 'delete', args: wrap({ action: 'delete', templateId: 'test' }), skip: 'Needs template' },
    { tool: 'sheets_templates', action: 'preview', args: wrap({ action: 'preview', templateId: 'test' }), skip: 'Needs template' },
    { tool: 'sheets_templates', action: 'import_builtin', args: wrap({ action: 'import_builtin', builtinName: 'budget' }) },

    // ========== sheets_collaborate (28) - Most need resources ==========
    { tool: 'sheets_collaborate', action: 'share_list', args: wrap({ action: 'share_list', spreadsheetId: ssId }) },
    { tool: 'sheets_collaborate', action: 'share_get_link', args: wrap({ action: 'share_get_link', spreadsheetId: ssId }) },
    { tool: 'sheets_collaborate', action: 'comment_list', args: wrap({ action: 'comment_list', spreadsheetId: ssId }) },
    { tool: 'sheets_collaborate', action: 'version_list_revisions', args: wrap({ action: 'version_list_revisions', spreadsheetId: ssId }) },
    { tool: 'sheets_collaborate', action: 'version_list_snapshots', args: wrap({ action: 'version_list_snapshots', spreadsheetId: ssId }) },
    // Skip destructive/resource-creating ones
    { tool: 'sheets_collaborate', action: 'share_add', args: wrap({ action: 'share_add', spreadsheetId: ssId, type: 'user', role: 'reader', emailAddress: 'test@example.com' }), skip: 'Modifies sharing' },
    { tool: 'sheets_collaborate', action: 'share_update', args: wrap({ action: 'share_update', spreadsheetId: ssId, permissionId: 'p1', role: 'writer' }), skip: 'Needs permission' },
    { tool: 'sheets_collaborate', action: 'share_remove', args: wrap({ action: 'share_remove', spreadsheetId: ssId, permissionId: 'p1' }), skip: 'Needs permission' },
    { tool: 'sheets_collaborate', action: 'share_get', args: wrap({ action: 'share_get', spreadsheetId: ssId, permissionId: 'p1' }), skip: 'Needs permission' },
    { tool: 'sheets_collaborate', action: 'share_transfer_ownership', args: wrap({ action: 'share_transfer_ownership', spreadsheetId: ssId, newOwnerEmail: 'test@test.com' }), skip: 'Dangerous' },
    { tool: 'sheets_collaborate', action: 'share_set_link', args: wrap({ action: 'share_set_link', spreadsheetId: ssId, enabled: true, role: 'reader' }), skip: 'Modifies sharing' },
    { tool: 'sheets_collaborate', action: 'comment_add', args: wrap({ action: 'comment_add', spreadsheetId: ssId, content: 'Test' }), skip: 'Creates comment' },
    { tool: 'sheets_collaborate', action: 'comment_update', args: wrap({ action: 'comment_update', spreadsheetId: ssId, commentId: 'c1', content: 'Updated' }), skip: 'Needs comment' },
    { tool: 'sheets_collaborate', action: 'comment_delete', args: wrap({ action: 'comment_delete', spreadsheetId: ssId, commentId: 'c1' }), skip: 'Needs comment' },
    { tool: 'sheets_collaborate', action: 'comment_get', args: wrap({ action: 'comment_get', spreadsheetId: ssId, commentId: 'c1' }), skip: 'Needs comment' },
    { tool: 'sheets_collaborate', action: 'comment_resolve', args: wrap({ action: 'comment_resolve', spreadsheetId: ssId, commentId: 'c1' }), skip: 'Needs comment' },
    { tool: 'sheets_collaborate', action: 'comment_reopen', args: wrap({ action: 'comment_reopen', spreadsheetId: ssId, commentId: 'c1' }), skip: 'Needs comment' },
    { tool: 'sheets_collaborate', action: 'comment_add_reply', args: wrap({ action: 'comment_add_reply', spreadsheetId: ssId, commentId: 'c1', content: 'Reply' }), skip: 'Needs comment' },
    { tool: 'sheets_collaborate', action: 'comment_update_reply', args: wrap({ action: 'comment_update_reply', spreadsheetId: ssId, commentId: 'c1', replyId: 'r1', content: 'Updated' }), skip: 'Needs reply' },
    { tool: 'sheets_collaborate', action: 'comment_delete_reply', args: wrap({ action: 'comment_delete_reply', spreadsheetId: ssId, commentId: 'c1', replyId: 'r1' }), skip: 'Needs reply' },
    { tool: 'sheets_collaborate', action: 'version_get_revision', args: wrap({ action: 'version_get_revision', spreadsheetId: ssId, revisionId: '1' }), skip: 'Needs revision' },
    { tool: 'sheets_collaborate', action: 'version_restore_revision', args: wrap({ action: 'version_restore_revision', spreadsheetId: ssId, revisionId: '1' }), skip: 'Destructive' },
    { tool: 'sheets_collaborate', action: 'version_keep_revision', args: wrap({ action: 'version_keep_revision', spreadsheetId: ssId, revisionId: '1', keepForever: true }), skip: 'Modifies revision' },
    { tool: 'sheets_collaborate', action: 'version_create_snapshot', args: wrap({ action: 'version_create_snapshot', spreadsheetId: ssId, name: 'Test Snapshot' }) },
    { tool: 'sheets_collaborate', action: 'version_restore_snapshot', args: wrap({ action: 'version_restore_snapshot', spreadsheetId: ssId, snapshotId: 's1' }), skip: 'Needs snapshot' },
    { tool: 'sheets_collaborate', action: 'version_delete_snapshot', args: wrap({ action: 'version_delete_snapshot', spreadsheetId: ssId, snapshotId: 's1' }), skip: 'Needs snapshot' },
    { tool: 'sheets_collaborate', action: 'version_compare', args: wrap({ action: 'version_compare', spreadsheetId: ssId, revisionId1: '1', revisionId2: '2' }), skip: 'Needs revisions' },
    { tool: 'sheets_collaborate', action: 'version_export', args: wrap({ action: 'version_export', spreadsheetId: ssId, format: 'xlsx' }) },

    // ========== sheets_advanced (23) ==========
    { tool: 'sheets_advanced', action: 'list_named_ranges', args: wrap({ action: 'list_named_ranges', spreadsheetId: ssId }) },
    { tool: 'sheets_advanced', action: 'list_protected_ranges', args: wrap({ action: 'list_protected_ranges', spreadsheetId: ssId }) },
    { tool: 'sheets_advanced', action: 'get_metadata', args: wrap({ action: 'get_metadata', spreadsheetId: ssId, metadataKey: 'test' }) },
    { tool: 'sheets_advanced', action: 'list_banding', args: wrap({ action: 'list_banding', spreadsheetId: ssId }) },
    { tool: 'sheets_advanced', action: 'list_tables', args: wrap({ action: 'list_tables', spreadsheetId: ssId }) },
    { tool: 'sheets_advanced', action: 'list_chips', args: wrap({ action: 'list_chips', spreadsheetId: ssId }) },
    // Skip resource-creating/modifying ones
    { tool: 'sheets_advanced', action: 'add_named_range', args: wrap({ action: 'add_named_range', spreadsheetId: ssId, name: 'TestRange', range }), skip: 'Creates resource' },
    { tool: 'sheets_advanced', action: 'update_named_range', args: wrap({ action: 'update_named_range', spreadsheetId: ssId, namedRangeId: 'nr1', name: 'Updated' }), skip: 'Needs named range' },
    { tool: 'sheets_advanced', action: 'delete_named_range', args: wrap({ action: 'delete_named_range', spreadsheetId: ssId, namedRangeId: 'nr1' }), skip: 'Needs named range' },
    { tool: 'sheets_advanced', action: 'get_named_range', args: wrap({ action: 'get_named_range', spreadsheetId: ssId, name: 'TestRange' }), skip: 'Needs named range' },
    { tool: 'sheets_advanced', action: 'add_protected_range', args: wrap({ action: 'add_protected_range', spreadsheetId: ssId, range, description: 'Protected' }), skip: 'Creates protection' },
    { tool: 'sheets_advanced', action: 'update_protected_range', args: wrap({ action: 'update_protected_range', spreadsheetId: ssId, protectedRangeId: 1, description: 'Updated' }), skip: 'Needs protection' },
    { tool: 'sheets_advanced', action: 'delete_protected_range', args: wrap({ action: 'delete_protected_range', spreadsheetId: ssId, protectedRangeId: 1 }), skip: 'Needs protection' },
    { tool: 'sheets_advanced', action: 'set_metadata', args: wrap({ action: 'set_metadata', spreadsheetId: ssId, metadataKey: 'testKey', metadataValue: 'testValue' }), skip: 'Modifies metadata' },
    { tool: 'sheets_advanced', action: 'delete_metadata', args: wrap({ action: 'delete_metadata', spreadsheetId: ssId, metadataId: 1 }), skip: 'Needs metadata' },
    { tool: 'sheets_advanced', action: 'add_banding', args: wrap({ action: 'add_banding', spreadsheetId: ssId, range }), skip: 'Creates banding' },
    { tool: 'sheets_advanced', action: 'update_banding', args: wrap({ action: 'update_banding', spreadsheetId: ssId, bandedRangeId: 1 }), skip: 'Needs banding' },
    { tool: 'sheets_advanced', action: 'delete_banding', args: wrap({ action: 'delete_banding', spreadsheetId: ssId, bandedRangeId: 1 }), skip: 'Needs banding' },
    { tool: 'sheets_advanced', action: 'create_table', args: wrap({ action: 'create_table', spreadsheetId: ssId, range }), skip: 'Creates table' },
    { tool: 'sheets_advanced', action: 'delete_table', args: wrap({ action: 'delete_table', spreadsheetId: ssId, tableId: 't1' }), skip: 'Needs table' },
    { tool: 'sheets_advanced', action: 'add_person_chip', args: wrap({ action: 'add_person_chip', spreadsheetId: ssId, cell, email: 'test@example.com' }), skip: 'Modifies cell' },
    { tool: 'sheets_advanced', action: 'add_drive_chip', args: wrap({ action: 'add_drive_chip', spreadsheetId: ssId, cell, fileId: 'f1' }), skip: 'Modifies cell' },
    { tool: 'sheets_advanced', action: 'add_rich_link_chip', args: wrap({ action: 'add_rich_link_chip', spreadsheetId: ssId, cell, uri: 'https://example.com' }), skip: 'Modifies cell' },

    // ========== sheets_bigquery (14) - All require BigQuery setup ==========
    { tool: 'sheets_bigquery', action: 'list_connections', args: wrap({ action: 'list_connections', spreadsheetId: ssId }) },
    { tool: 'sheets_bigquery', action: 'list_datasets', args: wrap({ action: 'list_datasets', projectId: 'test-project' }), skip: 'Needs BigQuery' },
    { tool: 'sheets_bigquery', action: 'list_tables', args: wrap({ action: 'list_tables', projectId: 'test-project', datasetId: 'test-dataset' }), skip: 'Needs BigQuery' },
    { tool: 'sheets_bigquery', action: 'get_table_schema', args: wrap({ action: 'get_table_schema', projectId: 'test-project', datasetId: 'test-dataset', tableId: 'test-table' }), skip: 'Needs BigQuery' },
    { tool: 'sheets_bigquery', action: 'connect', args: wrap({ action: 'connect', spreadsheetId: ssId, spec: { projectId: 'p', datasetId: 'd', tableId: 't' } }), skip: 'Needs BigQuery' },
    { tool: 'sheets_bigquery', action: 'connect_looker', args: wrap({ action: 'connect_looker', spreadsheetId: ssId, spec: { modelName: 'm', exploreName: 'e' } }), skip: 'Needs Looker' },
    { tool: 'sheets_bigquery', action: 'disconnect', args: wrap({ action: 'disconnect', spreadsheetId: ssId, dataSourceId: 'ds1' }), skip: 'Needs connection' },
    { tool: 'sheets_bigquery', action: 'get_connection', args: wrap({ action: 'get_connection', spreadsheetId: ssId, dataSourceId: 'ds1' }), skip: 'Needs connection' },
    { tool: 'sheets_bigquery', action: 'query', args: wrap({ action: 'query', projectId: 'p', sql: 'SELECT 1' }), skip: 'Needs BigQuery' },
    { tool: 'sheets_bigquery', action: 'preview', args: wrap({ action: 'preview', projectId: 'p', datasetId: 'd', tableId: 't' }), skip: 'Needs BigQuery' },
    { tool: 'sheets_bigquery', action: 'refresh', args: wrap({ action: 'refresh', spreadsheetId: ssId, dataSourceId: 'ds1' }), skip: 'Needs connection' },
    { tool: 'sheets_bigquery', action: 'cancel_refresh', args: wrap({ action: 'cancel_refresh', spreadsheetId: ssId, dataSourceId: 'ds1' }), skip: 'Needs connection' },
    { tool: 'sheets_bigquery', action: 'export_to_bigquery', args: wrap({ action: 'export_to_bigquery', spreadsheetId: ssId, range, destination: { projectId: 'p', datasetId: 'd', tableId: 't' } }), skip: 'Needs BigQuery' },
    { tool: 'sheets_bigquery', action: 'import_from_bigquery', args: wrap({ action: 'import_from_bigquery', spreadsheetId: ssId, query: 'SELECT 1', targetRange: range }), skip: 'Needs BigQuery' },

    // ========== sheets_appsscript (14) - All require Apps Script setup ==========
    { tool: 'sheets_appsscript', action: 'create', args: wrap({ action: 'create', spreadsheetId: ssId, title: 'TestScript' }), skip: 'Creates script' },
    { tool: 'sheets_appsscript', action: 'get', args: wrap({ action: 'get', scriptId: 'script1' }), skip: 'Needs script' },
    { tool: 'sheets_appsscript', action: 'get_content', args: wrap({ action: 'get_content', scriptId: 'script1' }), skip: 'Needs script' },
    { tool: 'sheets_appsscript', action: 'update_content', args: wrap({ action: 'update_content', scriptId: 'script1', files: [] }), skip: 'Needs script' },
    { tool: 'sheets_appsscript', action: 'create_version', args: wrap({ action: 'create_version', scriptId: 'script1', description: 'v1' }), skip: 'Needs script' },
    { tool: 'sheets_appsscript', action: 'list_versions', args: wrap({ action: 'list_versions', scriptId: 'script1' }), skip: 'Needs script' },
    { tool: 'sheets_appsscript', action: 'get_version', args: wrap({ action: 'get_version', scriptId: 'script1', versionNumber: 1 }), skip: 'Needs script' },
    { tool: 'sheets_appsscript', action: 'deploy', args: wrap({ action: 'deploy', scriptId: 'script1', versionNumber: 1, description: 'Deploy' }), skip: 'Needs script' },
    { tool: 'sheets_appsscript', action: 'list_deployments', args: wrap({ action: 'list_deployments', scriptId: 'script1' }), skip: 'Needs script' },
    { tool: 'sheets_appsscript', action: 'get_deployment', args: wrap({ action: 'get_deployment', scriptId: 'script1', deploymentId: 'd1' }), skip: 'Needs script' },
    { tool: 'sheets_appsscript', action: 'undeploy', args: wrap({ action: 'undeploy', scriptId: 'script1', deploymentId: 'd1' }), skip: 'Needs script' },
    { tool: 'sheets_appsscript', action: 'run', args: wrap({ action: 'run', scriptId: 'script1', functionName: 'myFunction' }), skip: 'Needs script' },
    { tool: 'sheets_appsscript', action: 'list_processes', args: wrap({ action: 'list_processes', scriptId: 'script1' }), skip: 'Needs script' },
    { tool: 'sheets_appsscript', action: 'get_metrics', args: wrap({ action: 'get_metrics', scriptId: 'script1' }), skip: 'Needs script' },
  ];
}

// ============================================================================
// TEST RUNNER
// ============================================================================

interface TestResult {
  tool: string;
  action: string;
  status: 'PASS' | 'FAIL' | 'TIMEOUT' | 'SKIP' | 'ERROR';
  duration: number;
  message: string;
  errorCode?: string;
}

const results: TestResult[] = [];

async function runTests() {
  console.log('🧪 ServalSheets Authenticated Test Runner\n');
  console.log(`Config: timeout=${config.timeout}ms, tool=${config.filterTool || 'ALL'}, action=${config.filterAction || 'ALL'}\n`);

  const child = spawn('node', ['dist/cli.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let buffer = '';
  const pending = new Map<number, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();
  let requestId = 1;

  child.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.id && pending.has(json.id)) {
          const p = pending.get(json.id)!;
          clearTimeout(p.timeout);
          p.resolve(json);
          pending.delete(json.id);
        }
      } catch {
        if (config.verbose) console.log('LOG:', line.slice(0, 100));
      }
    }
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    if (config.verbose) console.error('STDERR:', chunk.toString().slice(0, 200));
  });

  const send = (method: string, params: any = {}): Promise<any> => {
    return new Promise((resolve, reject) => {
      const id = requestId++;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error('TIMEOUT'));
      }, config.timeout);

      pending.set(id, { resolve, reject, timeout });
      child.stdin?.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  };

  try {
    // Initialize
    console.log('🚀 Initializing server...');
    await send('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'auth-test', version: '1.0.0' },
    });

    // Check auth
    console.log('🔐 Checking authentication...');
    const authResult = await send('tools/call', {
      name: 'sheets_auth',
      arguments: { request: { action: 'status' } },
    });
    const authText = authResult.result?.content?.[0]?.text || '{}';
    const authResponse = JSON.parse(authText);
    
    if (!authResponse.response?.authenticated) {
      console.log('❌ Not authenticated! Please run OAuth login first.\n');
      console.log('   Try: sheets_auth action="login"\n');
      process.exit(1);
    }
    console.log('✅ Authenticated!\n');

    // Get actions to test
    let actions = getAllActions();
    
    // Apply filters
    if (config.filterTool) {
      actions = actions.filter(a => a.tool === config.filterTool);
    }
    if (config.filterAction) {
      actions = actions.filter(a => a.action === config.filterAction);
    }

    console.log(`📋 Testing ${actions.length} actions...\n`);
    console.log('─'.repeat(70));

    let currentTool = '';
    for (const def of actions) {
      // Print tool header
      if (def.tool !== currentTool) {
        currentTool = def.tool;
        console.log(`\n📦 ${currentTool}`);
      }

      // Skip if marked
      if (def.skip) {
        results.push({
          tool: def.tool,
          action: def.action,
          status: 'SKIP',
          duration: 0,
          message: def.skip,
        });
        console.log(`   ⏭️  ${def.action} - SKIP (${def.skip})`);
        continue;
      }

      // Run test
      const startTime = Date.now();
      try {
        const result = await send('tools/call', {
          name: def.tool,
          arguments: def.args,
        });
        const duration = Date.now() - startTime;

        const text = result.result?.content?.[0]?.text || '{}';
        let response;
        try {
          response = JSON.parse(text);
        } catch {
          response = { response: { success: false, error: { message: text.slice(0, 100) } } };
        }

        if (response.response?.success) {
          results.push({
            tool: def.tool,
            action: def.action,
            status: 'PASS',
            duration,
            message: 'Success',
          });
          console.log(`   ✅ ${def.action} - PASS (${duration}ms)`);
        } else {
          const errorCode = response.response?.error?.code || 'UNKNOWN';
          const errorMsg = response.response?.error?.message || text.slice(0, 50);
          results.push({
            tool: def.tool,
            action: def.action,
            status: 'FAIL',
            duration,
            message: errorMsg,
            errorCode,
          });
          console.log(`   ❌ ${def.action} - FAIL [${errorCode}] (${duration}ms)`);
          if (config.verbose) console.log(`      ${errorMsg.slice(0, 100)}`);
        }
      } catch (err: any) {
        const duration = Date.now() - startTime;
        if (err.message === 'TIMEOUT') {
          results.push({
            tool: def.tool,
            action: def.action,
            status: 'TIMEOUT',
            duration,
            message: `Hung after ${config.timeout}ms`,
          });
          console.log(`   ⏱️  ${def.action} - TIMEOUT (${duration}ms) ⚠️ CRITICAL`);
        } else {
          results.push({
            tool: def.tool,
            action: def.action,
            status: 'ERROR',
            duration,
            message: err.message,
          });
          console.log(`   💥 ${def.action} - ERROR (${duration}ms)`);
          if (config.verbose) console.log(`      ${err.message}`);
        }
      }
    }

    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(70));
    
    const pass = results.filter(r => r.status === 'PASS').length;
    const fail = results.filter(r => r.status === 'FAIL').length;
    const timeout = results.filter(r => r.status === 'TIMEOUT').length;
    const skip = results.filter(r => r.status === 'SKIP').length;
    const error = results.filter(r => r.status === 'ERROR').length;

    console.log(`✅ PASS:    ${pass}`);
    console.log(`❌ FAIL:    ${fail}`);
    console.log(`⏱️  TIMEOUT: ${timeout} ${timeout > 0 ? '⚠️  CRITICAL - CODE FIX NEEDED' : ''}`);
    console.log(`⏭️  SKIP:    ${skip}`);
    console.log(`💥 ERROR:   ${error}`);
    console.log(`📦 TOTAL:   ${results.length}`);

    // Show timeouts (critical)
    if (timeout > 0) {
      console.log('\n🚨 TIMEOUT ISSUES (require code fix):');
      for (const r of results.filter(r => r.status === 'TIMEOUT')) {
        console.log(`   • ${r.tool}.${r.action}`);
      }
    }

    // Show failures
    if (fail > 0) {
      console.log('\n❌ FAILURES:');
      for (const r of results.filter(r => r.status === 'FAIL')) {
        console.log(`   • ${r.tool}.${r.action} [${r.errorCode}]: ${r.message.slice(0, 60)}`);
      }
    }

    // Write CSV
    const csv = ['tool,action,status,duration_ms,error_code,message'];
    for (const r of results) {
      csv.push(`${r.tool},${r.action},${r.status},${r.duration},${r.errorCode || ''},"${(r.message || '').replace(/"/g, '""')}"`);
    }
    writeFileSync(config.outputFile, csv.join('\n'));
    console.log(`\n📄 Results written to: ${config.outputFile}`);

  } finally {
    child.kill();
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
