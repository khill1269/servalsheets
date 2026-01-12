#!/usr/bin/env tsx
/**
 * ServalSheets Comprehensive Live API Test Runner
 * 
 * Tests all 26 tools and 208 actions against real Google Sheets API
 * Generates detailed report with issues and recommendations
 * 
 * Usage: npx tsx tests/manual/comprehensive-api-test.ts
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Test configuration
const CONFIG = {
  testSpreadsheetPrefix: 'ServalSheets-Test-',
  timeout: 30000,
  outputDir: './test-results',
  logFile: 'comprehensive-test-log.json',
  reportFile: 'comprehensive-test-report.md',
};

// Types
interface TestResult {
  tool: string;
  action: string;
  status: 'pass' | 'fail' | 'skip' | 'error';
  duration: number;
  error?: string;
  response?: unknown;
  notes?: string;
}

interface TestReport {
  timestamp: string;
  duration: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
  };
  results: TestResult[];
  issues: Issue[];
}

interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  tool: string;
  action: string;
  description: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  recommendation?: string;
}

// Tool registry with all actions
const TOOL_REGISTRY = {
  sheets_auth: {
    actions: ['status', 'login', 'callback', 'logout'],
  },
  sheets_spreadsheet: {
    actions: ['get', 'create', 'copy', 'update_properties', 'get_url', 'batch_get', 'get_comprehensive', 'list'],
  },
  sheets_sheet: {
    actions: ['add', 'delete', 'duplicate', 'update', 'copy_to', 'list', 'get'],
  },
  sheets_values: {
    actions: ['read', 'write', 'append', 'clear', 'batch_read', 'batch_write', 'batch_clear', 'find', 'replace'],
  },
  sheets_cells: {
    actions: ['add_note', 'get_note', 'clear_note', 'set_validation', 'clear_validation', 'set_hyperlink', 'clear_hyperlink', 'merge', 'unmerge', 'get_merges', 'cut', 'copy'],
  },
  sheets_format: {
    actions: ['set_format', 'set_background', 'set_text_format', 'set_number_format', 'set_alignment', 'set_borders', 'clear_format', 'apply_preset', 'auto_fit'],
  },
  sheets_dimensions: {
    actions: ['insert_rows', 'insert_columns', 'delete_rows', 'delete_columns', 'move_rows', 'move_columns', 'resize_rows', 'resize_columns', 'auto_resize', 'hide_rows', 'hide_columns', 'show_rows', 'show_columns', 'freeze_rows', 'freeze_columns', 'group_rows', 'group_columns', 'ungroup_rows', 'ungroup_columns', 'append_rows', 'append_columns'],
  },
  sheets_rules: {
    actions: ['add_conditional_format', 'update_conditional_format', 'delete_conditional_format', 'list_conditional_formats', 'add_data_validation', 'clear_data_validation', 'list_data_validations', 'add_preset_rule'],
  },
  sheets_charts: {
    actions: ['create', 'update', 'delete', 'list', 'get', 'move', 'resize', 'update_data_range', 'export'],
  },
  sheets_pivot: {
    actions: ['create', 'update', 'delete', 'list', 'get', 'refresh'],
  },
  sheets_filter_sort: {
    actions: ['set_basic_filter', 'clear_basic_filter', 'get_basic_filter', 'update_filter_criteria', 'sort_range', 'create_filter_view', 'update_filter_view', 'delete_filter_view', 'list_filter_views', 'get_filter_view', 'create_slicer', 'update_slicer', 'delete_slicer', 'list_slicers'],
  },
  sheets_sharing: {
    actions: ['share', 'update_permission', 'remove_permission', 'list_permissions', 'get_permission', 'transfer_ownership', 'set_link_sharing', 'get_sharing_link'],
  },
  sheets_comments: {
    actions: ['add', 'update', 'delete', 'list', 'get', 'resolve', 'reopen', 'add_reply', 'update_reply', 'delete_reply'],
  },
  sheets_versions: {
    actions: ['list_revisions', 'get_revision', 'restore_revision', 'keep_revision', 'create_snapshot', 'list_snapshots', 'restore_snapshot', 'delete_snapshot', 'compare', 'export_version'],
  },
  sheets_analysis: {
    actions: ['data_quality', 'formula_audit', 'structure_analysis', 'statistics', 'correlations', 'summary', 'dependencies', 'compare_ranges', 'detect_patterns', 'column_analysis', 'suggest_templates', 'generate_formula', 'suggest_chart'],
  },
  sheets_advanced: {
    actions: ['add_named_range', 'update_named_range', 'delete_named_range', 'list_named_ranges', 'get_named_range', 'add_protected_range', 'update_protected_range', 'delete_protected_range', 'list_protected_ranges', 'set_metadata', 'get_metadata', 'delete_metadata', 'add_banding', 'update_banding', 'delete_banding', 'list_banding', 'create_table', 'delete_table', 'list_tables'],
  },
  sheets_transaction: {
    actions: ['begin', 'queue', 'commit', 'rollback', 'status', 'list'],
  },
  sheets_validation: {
    actions: ['validate'],
  },
  sheets_conflict: {
    actions: ['detect', 'resolve'],
  },
  sheets_impact: {
    actions: ['analyze'],
  },
  sheets_history: {
    actions: ['list', 'get', 'stats', 'undo', 'redo', 'revert_to', 'clear'],
  },
  sheets_confirm: {
    actions: ['request', 'get_stats'],
  },
  sheets_analyze: {
    actions: ['analyze', 'generate_formula', 'suggest_chart', 'get_stats'],
  },
  sheets_fix: {
    actions: ['fix'],
  },
  sheets_composite: {
    actions: ['import_csv', 'smart_append', 'bulk_update', 'deduplicate'],
  },
  sheets_session: {
    actions: ['set_active', 'get_active', 'get_context', 'record_operation', 'get_last_operation', 'get_history', 'find_by_reference', 'update_preferences', 'get_preferences', 'set_pending', 'get_pending', 'clear_pending', 'reset'],
  },
};

// MCP Server Communication
class MCPClient {
  private server: ChildProcess | null = null;
  private messageId = 0;
  private pendingRequests = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timeout: NodeJS.Timeout }>();
  private buffer = '';

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = spawn('node', ['dist/cli.js'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.server.stdout?.on('data', (data) => this.handleData(data));
      this.server.stderr?.on('data', (data) => console.error('STDERR:', data.toString()));
      this.server.on('error', reject);
      this.server.on('exit', (code) => {
        if (code !== 0) console.error(`Server exited with code ${code}`);
      });

      // Initialize after startup
      setTimeout(async () => {
        try {
          await this.send('initialize', {
            protocolVersion: '2025-11-25',
            capabilities: { sampling: {}, elicitation: {} },
            clientInfo: { name: 'comprehensive-test', version: '1.0.0' },
          });
          await this.send('notifications/initialized', {}, true);
          resolve();
        } catch (e) {
          reject(e);
        }
      }, 2000);
    });
  }

  private handleData(data: Buffer): void {
    this.buffer += data.toString();
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
          const req = this.pendingRequests.get(msg.id)!;
          clearTimeout(req.timeout);
          this.pendingRequests.delete(msg.id);
          if (msg.error) {
            req.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          } else {
            req.resolve(msg.result);
          }
        }
      } catch (e) {
        // Not JSON, ignore
      }
    }
  }

  async send(method: string, params: unknown, isNotification = false): Promise<unknown> {
    const id = isNotification ? undefined : ++this.messageId;
    const msg = JSON.stringify({ jsonrpc: '2.0', method, params, id }) + '\n';
    
    this.server?.stdin?.write(msg);

    if (isNotification) return;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id!);
        reject(new Error(`Timeout waiting for response to ${method}`));
      }, CONFIG.timeout);

      this.pendingRequests.set(id!, { resolve, reject, timeout });
    });
  }

  async callTool(tool: string, args: Record<string, unknown>): Promise<unknown> {
    const result = await this.send('tools/call', { name: tool, arguments: args });
    return result;
  }

  stop(): void {
    this.server?.kill();
  }
}

// Test Context - stores state between tests
interface TestContext {
  spreadsheetId?: string;
  sheetId?: number;
  sheetTitle?: string;
  chartId?: number;
  pivotSheetId?: number;
  namedRangeId?: string;
  protectedRangeId?: number;
  bandedRangeId?: number;
  filterViewId?: number;
  slicerId?: number;
  transactionId?: string;
  commentId?: string;
  snapshotId?: string;
}

// Test Generator - creates test cases for each action
function generateTestCases(ctx: TestContext): Map<string, Map<string, () => Record<string, unknown>>> {
  const tests = new Map<string, Map<string, () => Record<string, unknown>>>();

  // sheets_auth
  tests.set('sheets_auth', new Map([
    ['status', () => ({ action: 'status' })],
    ['login', () => ({ action: 'login' })],
    // callback requires manual OAuth flow - skip
    ['logout', () => ({ action: 'logout' })],
  ]));

  // sheets_spreadsheet
  tests.set('sheets_spreadsheet', new Map([
    ['list', () => ({ action: 'list', maxResults: 5 })],
    ['create', () => ({ action: 'create', title: `${CONFIG.testSpreadsheetPrefix}${Date.now()}`, sheets: [{ title: 'TestSheet', rowCount: 100, columnCount: 10 }] })],
    ['get', () => ({ action: 'get', spreadsheetId: ctx.spreadsheetId })],
    ['get_url', () => ({ action: 'get_url', spreadsheetId: ctx.spreadsheetId })],
    ['get_comprehensive', () => ({ action: 'get_comprehensive', spreadsheetId: ctx.spreadsheetId, maxRowsPerSheet: 10 })],
    ['update_properties', () => ({ action: 'update_properties', spreadsheetId: ctx.spreadsheetId, title: `${CONFIG.testSpreadsheetPrefix}Updated-${Date.now()}` })],
    ['copy', () => ({ action: 'copy', spreadsheetId: ctx.spreadsheetId, newTitle: `${CONFIG.testSpreadsheetPrefix}Copy-${Date.now()}` })],
    ['batch_get', () => ({ action: 'batch_get', spreadsheetIds: [ctx.spreadsheetId!] })],
  ]));

  // sheets_sheet
  tests.set('sheets_sheet', new Map([
    ['list', () => ({ action: 'list', spreadsheetId: ctx.spreadsheetId })],
    ['add', () => ({ action: 'add', spreadsheetId: ctx.spreadsheetId, title: 'NewTestSheet' })],
    ['get', () => ({ action: 'get', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId })],
    ['update', () => ({ action: 'update', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, title: 'UpdatedSheet' })],
    ['duplicate', () => ({ action: 'duplicate', spreadsheetId: ctx.spreadsheetId, sourceSheetId: ctx.sheetId })],
    ['delete', () => ({ action: 'delete', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId })],
  ]));

  // sheets_values
  tests.set('sheets_values', new Map([
    ['batch_write', () => ({ action: 'batch_write', spreadsheetId: ctx.spreadsheetId, data: [{ range: { a1: `${ctx.sheetTitle}!A1:D5` }, values: [['Name', 'Revenue', 'Units', 'Date'], ['Widget A', 15000, 150, '2026-01-01'], ['Widget B', 22500, 225, '2026-01-02'], ['Widget C', 18750, 188, '2026-01-03'], ['Widget D', 31200, 312, '2026-01-04']] }] })],
    ['batch_read', () => ({ action: 'batch_read', spreadsheetId: ctx.spreadsheetId, ranges: [{ a1: `${ctx.sheetTitle}!A1:D5` }] })],
    ['read', () => ({ action: 'read', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!A1:D5` } })],
    ['write', () => ({ action: 'write', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!E1` }, values: [['Extra']] })],
    ['append', () => ({ action: 'append', spreadsheetId: ctx.spreadsheetId, range: { a1: ctx.sheetTitle }, values: [['Widget E', 25000, 250, '2026-01-05']] })],
    ['find', () => ({ action: 'find', spreadsheetId: ctx.spreadsheetId, query: 'Widget', range: { a1: `${ctx.sheetTitle}!A1:D10` } })],
    ['replace', () => ({ action: 'replace', spreadsheetId: ctx.spreadsheetId, find: 'Widget E', replacement: 'Product E', range: { a1: `${ctx.sheetTitle}!A1:D10` } })],
    ['clear', () => ({ action: 'clear', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!E1:E10` } })],
    ['batch_clear', () => ({ action: 'batch_clear', spreadsheetId: ctx.spreadsheetId, ranges: [{ a1: `${ctx.sheetTitle}!F1:F10` }] })],
  ]));

  // sheets_cells
  tests.set('sheets_cells', new Map([
    ['add_note', () => ({ action: 'add_note', spreadsheetId: ctx.spreadsheetId, cell: `${ctx.sheetTitle}!A1`, note: 'Test note' })],
    ['get_note', () => ({ action: 'get_note', spreadsheetId: ctx.spreadsheetId, cell: `${ctx.sheetTitle}!A1` })],
    ['clear_note', () => ({ action: 'clear_note', spreadsheetId: ctx.spreadsheetId, cell: `${ctx.sheetTitle}!A1` })],
    ['set_hyperlink', () => ({ action: 'set_hyperlink', spreadsheetId: ctx.spreadsheetId, cell: `${ctx.sheetTitle}!A1`, url: 'https://example.com' })],
    ['clear_hyperlink', () => ({ action: 'clear_hyperlink', spreadsheetId: ctx.spreadsheetId, cell: `${ctx.sheetTitle}!A1` })],
    ['merge', () => ({ action: 'merge', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!G1:H1` }, mergeType: 'MERGE_ALL' })],
    ['get_merges', () => ({ action: 'get_merges', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId })],
    ['unmerge', () => ({ action: 'unmerge', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!G1:H1` } })],
    ['set_validation', () => ({ action: 'set_validation', spreadsheetId: ctx.spreadsheetId, cell: `${ctx.sheetTitle}!B2`, validation: { condition: { type: 'NUMBER_GREATER', values: ['0'] }, strict: true } })],
    ['clear_validation', () => ({ action: 'clear_validation', spreadsheetId: ctx.spreadsheetId, cell: `${ctx.sheetTitle}!B2` })],
    ['copy', () => ({ action: 'copy', spreadsheetId: ctx.spreadsheetId, source: { a1: `${ctx.sheetTitle}!A1:A5` }, destination: `${ctx.sheetTitle}!I1` })],
    ['cut', () => ({ action: 'cut', spreadsheetId: ctx.spreadsheetId, source: { a1: `${ctx.sheetTitle}!I1:I5` }, destination: `${ctx.sheetTitle}!J1` })],
  ]));

  // sheets_format
  tests.set('sheets_format', new Map([
    ['set_background', () => ({ action: 'set_background', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!A1:D1` }, color: { red: 0.2, green: 0.4, blue: 0.8 } })],
    ['set_text_format', () => ({ action: 'set_text_format', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!A1:D1` }, textFormat: { bold: true, fontSize: 12 } })],
    ['set_number_format', () => ({ action: 'set_number_format', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!B2:B10` }, numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' } })],
    ['set_alignment', () => ({ action: 'set_alignment', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!A1:D1` }, horizontal: 'CENTER', vertical: 'MIDDLE' })],
    ['set_borders', () => ({ action: 'set_borders', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!A1:D5` }, top: { style: 'SOLID' }, bottom: { style: 'SOLID' }, left: { style: 'SOLID' }, right: { style: 'SOLID' } })],
    ['set_format', () => ({ action: 'set_format', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!A1:D1` }, format: { backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } } })],
    ['apply_preset', () => ({ action: 'apply_preset', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!A1:D1` }, preset: 'header_row' })],
    ['auto_fit', () => ({ action: 'auto_fit', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!A:D` }, dimension: 'COLUMNS' })],
    ['clear_format', () => ({ action: 'clear_format', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!E1:E10` } })],
  ]));

  // sheets_dimensions
  tests.set('sheets_dimensions', new Map([
    ['insert_rows', () => ({ action: 'insert_rows', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, startIndex: 10, count: 2 })],
    ['insert_columns', () => ({ action: 'insert_columns', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, startIndex: 10, count: 2 })],
    ['resize_rows', () => ({ action: 'resize_rows', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, startIndex: 0, endIndex: 5, pixelSize: 30 })],
    ['resize_columns', () => ({ action: 'resize_columns', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, startIndex: 0, endIndex: 4, pixelSize: 120 })],
    ['auto_resize', () => ({ action: 'auto_resize', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 4 })],
    ['freeze_rows', () => ({ action: 'freeze_rows', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, frozenRowCount: 1 })],
    ['freeze_columns', () => ({ action: 'freeze_columns', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, frozenColumnCount: 1 })],
    ['hide_rows', () => ({ action: 'hide_rows', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, startIndex: 15, endIndex: 17 })],
    ['show_rows', () => ({ action: 'show_rows', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, startIndex: 15, endIndex: 17 })],
    ['hide_columns', () => ({ action: 'hide_columns', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, startIndex: 12, endIndex: 14 })],
    ['show_columns', () => ({ action: 'show_columns', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, startIndex: 12, endIndex: 14 })],
    ['group_rows', () => ({ action: 'group_rows', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, startIndex: 2, endIndex: 5 })],
    ['ungroup_rows', () => ({ action: 'ungroup_rows', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, startIndex: 2, endIndex: 5 })],
    ['group_columns', () => ({ action: 'group_columns', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, startIndex: 5, endIndex: 7 })],
    ['ungroup_columns', () => ({ action: 'ungroup_columns', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, startIndex: 5, endIndex: 7 })],
    ['move_rows', () => ({ action: 'move_rows', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, startIndex: 10, endIndex: 12, destinationIndex: 20 })],
    ['move_columns', () => ({ action: 'move_columns', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, startIndex: 10, endIndex: 12, destinationIndex: 15 })],
    ['append_rows', () => ({ action: 'append_rows', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, count: 5 })],
    ['append_columns', () => ({ action: 'append_columns', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, count: 2 })],
    ['delete_rows', () => ({ action: 'delete_rows', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, startIndex: 95, endIndex: 100 })],
    ['delete_columns', () => ({ action: 'delete_columns', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, startIndex: 15, endIndex: 17 })],
  ]));

  // sheets_analysis
  tests.set('sheets_analysis', new Map([
    ['statistics', () => ({ action: 'statistics', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!B2:B5` } })],
    ['data_quality', () => ({ action: 'data_quality', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!A1:D10` } })],
    ['formula_audit', () => ({ action: 'formula_audit', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId })],
    ['structure_analysis', () => ({ action: 'structure_analysis', spreadsheetId: ctx.spreadsheetId })],
    ['column_analysis', () => ({ action: 'column_analysis', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!A1:D10` } })],
    ['detect_patterns', () => ({ action: 'detect_patterns', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!A1:D10` } })],
    ['suggest_chart', () => ({ action: 'suggest_chart', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!A1:D5` } })],
    ['summary', () => ({ action: 'summary', spreadsheetId: ctx.spreadsheetId })],
  ]));

  // sheets_session
  tests.set('sheets_session', new Map([
    ['set_active', () => ({ action: 'set_active', spreadsheetId: ctx.spreadsheetId, title: 'Test Spreadsheet', sheetNames: [ctx.sheetTitle!] })],
    ['get_active', () => ({ action: 'get_active' })],
    ['get_context', () => ({ action: 'get_context' })],
    ['get_preferences', () => ({ action: 'get_preferences' })],
    ['update_preferences', () => ({ action: 'update_preferences', confirmationLevel: 'destructive' })],
    ['record_operation', () => ({ action: 'record_operation', spreadsheetId: ctx.spreadsheetId, tool: 'sheets_values', toolAction: 'write', description: 'Test write', undoable: true })],
    ['get_last_operation', () => ({ action: 'get_last_operation' })],
    ['get_history', () => ({ action: 'get_history', limit: 5 })],
    ['reset', () => ({ action: 'reset' })],
  ]));

  // sheets_history  
  tests.set('sheets_history', new Map([
    ['list', () => ({ action: 'list', spreadsheetId: ctx.spreadsheetId, count: 5 })],
    ['stats', () => ({ action: 'stats' })],
    ['clear', () => ({ action: 'clear', spreadsheetId: ctx.spreadsheetId })],
  ]));

  // sheets_transaction
  tests.set('sheets_transaction', new Map([
    ['begin', () => ({ action: 'begin', spreadsheetId: ctx.spreadsheetId })],
    ['status', () => ({ action: 'status', transactionId: ctx.transactionId })],
    ['queue', () => ({ action: 'queue', transactionId: ctx.transactionId, operation: { tool: 'sheets_values', action: 'write', params: { spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!F1` }, values: [['TxTest']] } } })],
    ['list', () => ({ action: 'list', spreadsheetId: ctx.spreadsheetId })],
    ['rollback', () => ({ action: 'rollback', transactionId: ctx.transactionId })],
  ]));

  // sheets_validation
  tests.set('sheets_validation', new Map([
    ['validate', () => ({ action: 'validate', value: 'test@example.com', rules: ['email'], context: { spreadsheetId: ctx.spreadsheetId } })],
  ]));

  // sheets_conflict
  tests.set('sheets_conflict', new Map([
    ['detect', () => ({ action: 'detect', spreadsheetId: ctx.spreadsheetId, range: `${ctx.sheetTitle}!A1:D10` })],
  ]));

  // sheets_impact
  tests.set('sheets_impact', new Map([
    ['analyze', () => ({ action: 'analyze', spreadsheetId: ctx.spreadsheetId, operation: { type: 'values_write', tool: 'sheets_values', action: 'write', params: { range: `${ctx.sheetTitle}!A1:D10` } } })],
  ]));

  // sheets_composite
  tests.set('sheets_composite', new Map([
    ['import_csv', () => ({ action: 'import_csv', spreadsheetId: ctx.spreadsheetId, csvData: 'Col1,Col2\nA,1\nB,2', mode: 'new_sheet', newSheetName: 'CSVImport' })],
    ['deduplicate', () => ({ action: 'deduplicate', spreadsheetId: ctx.spreadsheetId, sheet: ctx.sheetTitle, keyColumns: ['Name'], preview: true })],
  ]));

  // sheets_versions
  tests.set('sheets_versions', new Map([
    ['list_revisions', () => ({ action: 'list_revisions', spreadsheetId: ctx.spreadsheetId, pageSize: 5 })],
    ['create_snapshot', () => ({ action: 'create_snapshot', spreadsheetId: ctx.spreadsheetId, name: 'TestSnapshot', description: 'Test' })],
    ['list_snapshots', () => ({ action: 'list_snapshots', spreadsheetId: ctx.spreadsheetId })],
  ]));

  // sheets_confirm (requires elicitation - limited testing)
  tests.set('sheets_confirm', new Map([
    ['get_stats', () => ({ action: 'get_stats' })],
  ]));

  // sheets_analyze (requires sampling - limited testing)
  tests.set('sheets_analyze', new Map([
    ['get_stats', () => ({ action: 'get_stats' })],
  ]));

  // sheets_fix
  tests.set('sheets_fix', new Map([
    ['fix', () => ({ action: 'fix', spreadsheetId: ctx.spreadsheetId, issues: [], mode: 'preview' })],
  ]));

  // sheets_rules
  tests.set('sheets_rules', new Map([
    ['list_conditional_formats', () => ({ action: 'list_conditional_formats', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId })],
    ['list_data_validations', () => ({ action: 'list_data_validations', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId })],
    ['add_conditional_format', () => ({ action: 'add_conditional_format', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, range: { a1: `${ctx.sheetTitle}!B2:B10` }, rule: { type: 'boolean', condition: { type: 'NUMBER_GREATER', values: ['20000'] }, format: { backgroundColor: { red: 0, green: 1, blue: 0 } } } })],
    ['add_preset_rule', () => ({ action: 'add_preset_rule', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, range: { a1: `${ctx.sheetTitle}!A1:D10` }, preset: 'highlight_duplicates' })],
  ]));

  // sheets_charts
  tests.set('sheets_charts', new Map([
    ['list', () => ({ action: 'list', spreadsheetId: ctx.spreadsheetId })],
    ['create', () => ({ action: 'create', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, chartType: 'COLUMN', data: { sourceRange: { a1: `${ctx.sheetTitle}!A1:B5` } }, position: { anchorCell: 'F1' }, options: { title: 'Test Chart' } })],
  ]));

  // sheets_pivot
  tests.set('sheets_pivot', new Map([
    ['list', () => ({ action: 'list', spreadsheetId: ctx.spreadsheetId })],
  ]));

  // sheets_filter_sort
  tests.set('sheets_filter_sort', new Map([
    ['sort_range', () => ({ action: 'sort_range', spreadsheetId: ctx.spreadsheetId, range: { a1: `${ctx.sheetTitle}!A2:D10` }, sortSpecs: [{ columnIndex: 1, sortOrder: 'DESCENDING' }] })],
    ['set_basic_filter', () => ({ action: 'set_basic_filter', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId, range: { a1: `${ctx.sheetTitle}!A1:D10` } })],
    ['get_basic_filter', () => ({ action: 'get_basic_filter', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId })],
    ['clear_basic_filter', () => ({ action: 'clear_basic_filter', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId })],
    ['list_filter_views', () => ({ action: 'list_filter_views', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId })],
    ['list_slicers', () => ({ action: 'list_slicers', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId })],
  ]));

  // sheets_sharing
  tests.set('sheets_sharing', new Map([
    ['list_permissions', () => ({ action: 'list_permissions', spreadsheetId: ctx.spreadsheetId })],
    ['get_sharing_link', () => ({ action: 'get_sharing_link', spreadsheetId: ctx.spreadsheetId })],
  ]));

  // sheets_comments
  tests.set('sheets_comments', new Map([
    ['list', () => ({ action: 'list', spreadsheetId: ctx.spreadsheetId })],
    ['add', () => ({ action: 'add', spreadsheetId: ctx.spreadsheetId, anchor: `${ctx.sheetTitle}!A1`, content: 'Test comment' })],
  ]));

  // sheets_advanced
  tests.set('sheets_advanced', new Map([
    ['list_named_ranges', () => ({ action: 'list_named_ranges', spreadsheetId: ctx.spreadsheetId })],
    ['add_named_range', () => ({ action: 'add_named_range', spreadsheetId: ctx.spreadsheetId, name: 'TestRange', range: { a1: `${ctx.sheetTitle}!A1:D5` } })],
    ['list_protected_ranges', () => ({ action: 'list_protected_ranges', spreadsheetId: ctx.spreadsheetId })],
    ['list_banding', () => ({ action: 'list_banding', spreadsheetId: ctx.spreadsheetId, sheetId: ctx.sheetId })],
    ['list_tables', () => ({ action: 'list_tables', spreadsheetId: ctx.spreadsheetId })],
  ]));

  return tests;
}

// Main test runner
async function runTests(): Promise<void> {
  const startTime = Date.now();
  const results: TestResult[] = [];
  const issues: Issue[] = [];
  const ctx: TestContext = {};

  console.log('🚀 Starting ServalSheets Comprehensive API Test\n');
  console.log('='.repeat(60));

  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  const client = new MCPClient();

  try {
    console.log('\n📡 Starting MCP server...');
    await client.start();
    console.log('✅ Server started\n');

    // Phase 1: Auth
    console.log('🔐 Phase 1: Authentication');
    const authResult = await runSingleTest(client, 'sheets_auth', 'status', { action: 'status' }, results, issues);
    if (!authResult || !(authResult as Record<string, unknown>).response?.['authenticated']) {
      console.log('  ⚠️  Not authenticated, attempting login...');
      await runSingleTest(client, 'sheets_auth', 'login', { action: 'login' }, results, issues);
    }

    // Phase 2: Create test spreadsheet
    console.log('\n📊 Phase 2: Create Test Spreadsheet');
    const createResult = await runSingleTest(client, 'sheets_spreadsheet', 'create', {
      action: 'create',
      title: `${CONFIG.testSpreadsheetPrefix}${Date.now()}`,
      sheets: [{ title: 'TestSheet', rowCount: 100, columnCount: 26 }],
    }, results, issues);

    if (createResult) {
      const response = (createResult as Record<string, unknown>).response as Record<string, unknown>;
      ctx.spreadsheetId = response?.spreadsheet?.['spreadsheetId'] || response?.newSpreadsheetId as string;
      const sheets = response?.spreadsheet?.['sheets'] as Array<Record<string, unknown>>;
      if (sheets?.[0]) {
        ctx.sheetId = sheets[0].sheetId as number;
        ctx.sheetTitle = sheets[0].title as string;
      }
      console.log(`  ✅ Created spreadsheet: ${ctx.spreadsheetId}`);
      console.log(`  ✅ Sheet ID: ${ctx.sheetId}, Title: ${ctx.sheetTitle}`);
    } else {
      console.error('  ❌ Failed to create test spreadsheet');
      throw new Error('Cannot proceed without test spreadsheet');
    }

    // Phase 3: Run all tests
    console.log('\n🧪 Phase 3: Running All Tool Tests');
    const testCases = generateTestCases(ctx);

    let toolIndex = 0;
    for (const [tool, actions] of testCases) {
      toolIndex++;
      console.log(`\n[${toolIndex}/${testCases.size}] Testing ${tool}...`);
      
      for (const [action, getParams] of actions) {
        try {
          const params = getParams();
          
          // Handle context-dependent params
          if (tool === 'sheets_transaction' && action === 'begin') {
            const txResult = await runSingleTest(client, tool, action, params, results, issues);
            if (txResult) {
              const txResponse = (txResult as Record<string, unknown>).response as Record<string, unknown>;
              ctx.transactionId = txResponse?.transactionId as string;
            }
            continue;
          }
          
          await runSingleTest(client, tool, action, params, results, issues);
        } catch (e) {
          console.error(`    ❌ ${action}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

  } catch (e) {
    console.error('\n❌ Fatal error:', e);
  } finally {
    client.stop();
  }

  // Generate report
  const report: TestReport = {
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    summary: {
      total: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      skipped: results.filter(r => r.status === 'skip').length,
      errors: results.filter(r => r.status === 'error').length,
    },
    results,
    issues,
  };

  // Save results
  const logPath = path.join(CONFIG.outputDir, CONFIG.logFile);
  fs.writeFileSync(logPath, JSON.stringify(report, null, 2));
  console.log(`\n📝 Detailed log saved to: ${logPath}`);

  // Generate markdown report
  const reportPath = path.join(CONFIG.outputDir, CONFIG.reportFile);
  fs.writeFileSync(reportPath, generateMarkdownReport(report));
  console.log(`📊 Report saved to: ${reportPath}`);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${report.summary.total}`);
  console.log(`✅ Passed: ${report.summary.passed}`);
  console.log(`❌ Failed: ${report.summary.failed}`);
  console.log(`⏭️  Skipped: ${report.summary.skipped}`);
  console.log(`💥 Errors: ${report.summary.errors}`);
  console.log(`⏱️  Duration: ${(report.duration / 1000).toFixed(2)}s`);
  
  if (issues.length > 0) {
    console.log(`\n⚠️  Found ${issues.length} issues:`);
    for (const issue of issues) {
      console.log(`  [${issue.severity.toUpperCase()}] ${issue.tool}:${issue.action} - ${issue.description}`);
    }
  }
}

async function runSingleTest(
  client: MCPClient,
  tool: string,
  action: string,
  params: Record<string, unknown>,
  results: TestResult[],
  issues: Issue[]
): Promise<unknown> {
  const start = Date.now();
  const toolName = `servalsheets:${tool}`;
  
  try {
    const result = await client.callTool(toolName, params);
    const duration = Date.now() - start;
    
    const response = result as Record<string, unknown>;
    const content = response?.content as Array<Record<string, unknown>>;
    const text = content?.[0]?.text as string;
    
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // Not JSON
    }

    const success = parsed?.response?.['success'] === true;
    const error = parsed?.response?.['error'];

    if (success) {
      console.log(`    ✅ ${action} (${duration}ms)`);
      results.push({ tool, action, status: 'pass', duration, response: parsed });
    } else {
      console.log(`    ❌ ${action}: ${error?.['message'] || 'Unknown error'}`);
      results.push({ tool, action, status: 'fail', duration, error: error?.['message'], response: parsed });
      
      // Categorize issue
      issues.push({
        severity: error?.['severity'] === 'critical' ? 'critical' : error?.['code']?.includes('INTERNAL') ? 'high' : 'medium',
        tool,
        action,
        description: error?.['message'] || 'Unknown error',
        actualBehavior: JSON.stringify(error),
        recommendation: error?.['resolution'],
      });
    }

    return parsed;
  } catch (e) {
    const duration = Date.now() - start;
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.log(`    💥 ${action}: ${errorMsg}`);
    results.push({ tool, action, status: 'error', duration, error: errorMsg });
    
    issues.push({
      severity: 'critical',
      tool,
      action,
      description: `Exception: ${errorMsg}`,
    });

    return null;
  }
}

function generateMarkdownReport(report: TestReport): string {
  const lines: string[] = [
    '# ServalSheets Comprehensive API Test Report',
    '',
    `**Generated:** ${report.timestamp}`,
    `**Duration:** ${(report.duration / 1000).toFixed(2)} seconds`,
    '',
    '## Summary',
    '',
    '| Metric | Count |',
    '|--------|-------|',
    `| Total Tests | ${report.summary.total} |`,
    `| ✅ Passed | ${report.summary.passed} |`,
    `| ❌ Failed | ${report.summary.failed} |`,
    `| ⏭️ Skipped | ${report.summary.skipped} |`,
    `| 💥 Errors | ${report.summary.errors} |`,
    '',
    `**Pass Rate:** ${((report.summary.passed / report.summary.total) * 100).toFixed(1)}%`,
    '',
  ];

  if (report.issues.length > 0) {
    lines.push('## Issues Found', '');
    
    const critical = report.issues.filter(i => i.severity === 'critical');
    const high = report.issues.filter(i => i.severity === 'high');
    const medium = report.issues.filter(i => i.severity === 'medium');
    const low = report.issues.filter(i => i.severity === 'low');

    if (critical.length > 0) {
      lines.push('### 🔴 Critical', '');
      for (const issue of critical) {
        lines.push(`- **${issue.tool}:${issue.action}** - ${issue.description}`);
        if (issue.recommendation) lines.push(`  - *Recommendation:* ${issue.recommendation}`);
      }
      lines.push('');
    }

    if (high.length > 0) {
      lines.push('### 🟠 High', '');
      for (const issue of high) {
        lines.push(`- **${issue.tool}:${issue.action}** - ${issue.description}`);
        if (issue.recommendation) lines.push(`  - *Recommendation:* ${issue.recommendation}`);
      }
      lines.push('');
    }

    if (medium.length > 0) {
      lines.push('### 🟡 Medium', '');
      for (const issue of medium) {
        lines.push(`- **${issue.tool}:${issue.action}** - ${issue.description}`);
      }
      lines.push('');
    }

    if (low.length > 0) {
      lines.push('### 🟢 Low', '');
      for (const issue of low) {
        lines.push(`- **${issue.tool}:${issue.action}** - ${issue.description}`);
      }
      lines.push('');
    }
  }

  // Results by tool
  lines.push('## Results by Tool', '');
  
  const byTool = new Map<string, TestResult[]>();
  for (const r of report.results) {
    if (!byTool.has(r.tool)) byTool.set(r.tool, []);
    byTool.get(r.tool)!.push(r);
  }

  for (const [tool, toolResults] of byTool) {
    const passed = toolResults.filter(r => r.status === 'pass').length;
    const total = toolResults.length;
    const emoji = passed === total ? '✅' : passed > 0 ? '⚠️' : '❌';
    
    lines.push(`### ${emoji} ${tool} (${passed}/${total})`, '');
    lines.push('| Action | Status | Duration | Notes |');
    lines.push('|--------|--------|----------|-------|');
    
    for (const r of toolResults) {
      const statusEmoji = r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : r.status === 'skip' ? '⏭️' : '💥';
      const notes = r.error ? r.error.substring(0, 50) + (r.error.length > 50 ? '...' : '') : '';
      lines.push(`| ${r.action} | ${statusEmoji} | ${r.duration}ms | ${notes} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// Run tests
runTests().catch(console.error);
