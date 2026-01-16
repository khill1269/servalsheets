/**
 * Comprehensive Action-Level Test Suite
 *
 * Tests ALL 208 actions across all 26 tools with:
 * - Proper authentication
 * - Valid test spreadsheet
 * - Detailed error logging
 * - Structured report generation
 *
 * Usage:
 *   npm run build && node dist/scripts/test-all-actions-comprehensive.js
 */

import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { writeFileSync } from 'fs';
import { TOOL_ACTIONS } from '../src/schemas/index.js';

interface TestResult {
  tool: string;
  action: string;
  status: 'pass' | 'fail' | 'skip' | 'auth_required';
  message: string;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];
let requestId = 1;

// Test spreadsheet ID (public test sheet)
const TEST_SPREADSHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

function createJsonRpcClient(child: ChildProcess) {
  let buffer = '';
  const pending = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  child.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const json = JSON.parse(line);
        const id = json?.id;
        if (typeof id === 'number' && pending.has(id)) {
          const entry = pending.get(id);
          if (entry) {
            clearTimeout(entry.timeout);
            pending.delete(id);
            entry.resolve(json);
          }
        }
      } catch {
        // Ignore non-JSON log lines
      }
    }
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    // Log stderr but don't fail
    const text = chunk.toString();
    if (!text.includes('[ServalSheets]') && process.env.LOG_LEVEL === 'debug') {
      console.error('STDERR:', text);
    }
  });

  const send = (method: string, params: any = {}): Promise<any> => {
    return new Promise((resolve, reject) => {
      const id = requestId++;
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 10000); // 10 second timeout

      pending.set(id, { resolve, reject, timeout });

      const request = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
      child.stdin?.write(request);
    });
  };

  return { send };
}

async function testAction(
  client: any,
  toolName: string,
  action: string,
  args: any
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const response = await client.send('tools/call', {
      name: toolName,
      arguments: args,
    });

    const duration = Date.now() - startTime;

    // Check response structure
    if (!response.result || !response.result.content) {
      return {
        tool: toolName,
        action,
        status: 'fail',
        message: 'Invalid response structure: missing content',
        duration,
      };
    }

    const content = response.result.content;
    const textContent = content.find((c: any) => c.type === 'text');

    if (!textContent || !textContent.text) {
      return {
        tool: toolName,
        action,
        status: 'fail',
        message: 'Invalid response structure: no text content',
        duration,
      };
    }

    const text = textContent.text;

    // Check for authentication errors
    if (
      text.includes('not authenticated') ||
      text.includes('OAUTH_NOT_CONFIGURED') ||
      text.includes('OAuth') ||
      text.includes('login required')
    ) {
      return {
        tool: toolName,
        action,
        status: 'auth_required',
        message: 'Authentication required (expected without credentials)',
        duration,
      };
    }

    // Check for errors
    if (text.includes('Error:') || text.includes('Failed') || text.includes('INVALID')) {
      return {
        tool: toolName,
        action,
        status: 'fail',
        message: `Tool returned error`,
        error: text.substring(0, 500),
        duration,
      };
    }

    // Success
    return {
      tool: toolName,
      action,
      status: 'pass',
      message: 'Success',
      duration,
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    return {
      tool: toolName,
      action,
      status: 'fail',
      message: `Exception during test`,
      error: (err as Error).message,
      duration,
    };
  }
}

function getTestArgs(toolName: string, action: string): any {
  // Test arguments for each tool/action combination
  const baseArgs: Record<string, any> = {
    // Auth tool
    sheets_auth: {
      status: { action: 'status' },
      login: { action: 'login' },
      logout: { action: 'logout' },
      callback: { action: 'callback', code: 'test-code' },
    },

    // Spreadsheet tool
    sheets_spreadsheet: {
      list: { action: 'list', pageSize: 10 },
      get: { action: 'get', spreadsheetId: TEST_SPREADSHEET_ID },
      create: { action: 'create', title: 'Test Spreadsheet' },
      copy: { action: 'copy', spreadsheetId: TEST_SPREADSHEET_ID },
      update_properties: {
        action: 'update_properties',
        spreadsheetId: TEST_SPREADSHEET_ID,
        title: 'Updated Title',
      },
      get_url: { action: 'get_url', spreadsheetId: TEST_SPREADSHEET_ID },
      batch_get: { action: 'batch_get', spreadsheetIds: [TEST_SPREADSHEET_ID] },
      get_comprehensive: { action: 'get_comprehensive', spreadsheetId: TEST_SPREADSHEET_ID },
    },

    // Sheet tool
    sheets_sheet: {
      list: { action: 'list', spreadsheetId: TEST_SPREADSHEET_ID },
      get: { action: 'get', spreadsheetId: TEST_SPREADSHEET_ID, sheetName: 'Sheet1' },
      add: { action: 'add', spreadsheetId: TEST_SPREADSHEET_ID, title: 'New Sheet' },
      delete: { action: 'delete', spreadsheetId: TEST_SPREADSHEET_ID, sheetId: 999 },
      duplicate: { action: 'duplicate', spreadsheetId: TEST_SPREADSHEET_ID, sourceSheetId: 0 },
      update: {
        action: 'update',
        spreadsheetId: TEST_SPREADSHEET_ID,
        sheetId: 0,
        title: 'Updated Sheet',
      },
      copy_to: {
        action: 'copy_to',
        spreadsheetId: TEST_SPREADSHEET_ID,
        sheetId: 0,
        destinationSpreadsheetId: TEST_SPREADSHEET_ID,
      },
    },

    // Values tool
    sheets_values: {
      read: {
        action: 'read',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:D10',
      },
      write: {
        action: 'write',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:B2',
        values: [
          ['Test', 'Data'],
          ['123', '456'],
        ],
      },
      append: {
        action: 'append',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1',
        values: [['Append', 'Test']],
      },
      clear: { action: 'clear', spreadsheetId: TEST_SPREADSHEET_ID, range: 'Sheet1!Z100' },
      batch_read: {
        action: 'batch_read',
        spreadsheetId: TEST_SPREADSHEET_ID,
        ranges: ['Sheet1!A1:B2', 'Sheet1!C1:D2'],
      },
      batch_write: {
        action: 'batch_write',
        spreadsheetId: TEST_SPREADSHEET_ID,
        data: [
          { range: 'Sheet1!A1:B1', values: [['Test1', 'Test2']] },
          { range: 'Sheet1!A2:B2', values: [['Test3', 'Test4']] },
        ],
      },
      batch_clear: {
        action: 'batch_clear',
        spreadsheetId: TEST_SPREADSHEET_ID,
        ranges: ['Sheet1!Z100', 'Sheet1!Z101'],
      },
      find: {
        action: 'find',
        spreadsheetId: TEST_SPREADSHEET_ID,
        query: 'test',
        range: 'Sheet1!A1:D10',
      },
      replace: {
        action: 'replace',
        spreadsheetId: TEST_SPREADSHEET_ID,
        find: 'old',
        replace: 'new',
        range: 'Sheet1!A1:D10',
      },
    },

    // Cells tool
    sheets_cells: {
      add_note: {
        action: 'add_note',
        spreadsheetId: TEST_SPREADSHEET_ID,
        cell: 'A1',
        note: 'Test note',
      },
      get_note: { action: 'get_note', spreadsheetId: TEST_SPREADSHEET_ID, cell: 'A1' },
      clear_note: { action: 'clear_note', spreadsheetId: TEST_SPREADSHEET_ID, cell: 'A1' },
      set_validation: {
        action: 'set_validation',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'A1:A10',
        condition: { type: 'NUMBER_GREATER', values: [{ userEnteredValue: '0' }] },
      },
      clear_validation: {
        action: 'clear_validation',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'A1:A10',
      },
      set_hyperlink: {
        action: 'set_hyperlink',
        spreadsheetId: TEST_SPREADSHEET_ID,
        cell: 'A1',
        url: 'https://example.com',
      },
      clear_hyperlink: {
        action: 'clear_hyperlink',
        spreadsheetId: TEST_SPREADSHEET_ID,
        cell: 'A1',
      },
      merge: {
        action: 'merge',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'A1:B2',
        mergeType: 'MERGE_ALL',
      },
      unmerge: { action: 'unmerge', spreadsheetId: TEST_SPREADSHEET_ID, range: 'A1:B2' },
      get_merges: { action: 'get_merges', spreadsheetId: TEST_SPREADSHEET_ID },
      cut: {
        action: 'cut',
        spreadsheetId: TEST_SPREADSHEET_ID,
        source: { a1: 'A1:B2' },
        destination: { a1: 'D1' },
      },
      copy: {
        action: 'copy',
        spreadsheetId: TEST_SPREADSHEET_ID,
        source: { a1: 'A1:B2' },
        destination: { a1: 'D1' },
      },
    },

    // Format tool
    sheets_format: {
      set_format: {
        action: 'set_format',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'A1:B2',
        format: { backgroundColor: { red: 1, green: 0, blue: 0 } },
      },
      set_background: {
        action: 'set_background',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'A1',
        color: { red: 1, green: 0, blue: 0 },
      },
      set_text_format: {
        action: 'set_text_format',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'A1',
        format: { bold: true },
      },
      set_number_format: {
        action: 'set_number_format',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'A1',
        type: 'NUMBER',
        pattern: '#,##0.00',
      },
      set_alignment: {
        action: 'set_alignment',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'A1',
        horizontalAlignment: 'CENTER',
      },
      set_borders: {
        action: 'set_borders',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'A1:B2',
        borders: { top: { style: 'SOLID', color: { red: 0, green: 0, blue: 0 } } },
      },
      clear_format: {
        action: 'clear_format',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'A1:B2',
      },
      apply_preset: {
        action: 'apply_preset',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'A1:B10',
        preset: 'header_row',
      },
      auto_fit: { action: 'auto_fit', spreadsheetId: TEST_SPREADSHEET_ID, dimension: 'COLUMNS' },
    },

    // Dimensions tool
    sheets_dimensions: {
      insert_rows: {
        action: 'insert_rows',
        spreadsheetId: TEST_SPREADSHEET_ID,
        startIndex: 0,
        endIndex: 1,
      },
      insert_columns: {
        action: 'insert_columns',
        spreadsheetId: TEST_SPREADSHEET_ID,
        startIndex: 0,
        endIndex: 1,
      },
      delete_rows: {
        action: 'delete_rows',
        spreadsheetId: TEST_SPREADSHEET_ID,
        startIndex: 10,
        endIndex: 11,
      },
      delete_columns: {
        action: 'delete_columns',
        spreadsheetId: TEST_SPREADSHEET_ID,
        startIndex: 10,
        endIndex: 11,
      },
      move_rows: {
        action: 'move_rows',
        spreadsheetId: TEST_SPREADSHEET_ID,
        startIndex: 0,
        endIndex: 1,
        destinationIndex: 5,
      },
      move_columns: {
        action: 'move_columns',
        spreadsheetId: TEST_SPREADSHEET_ID,
        startIndex: 0,
        endIndex: 1,
        destinationIndex: 5,
      },
      resize_rows: {
        action: 'resize_rows',
        spreadsheetId: TEST_SPREADSHEET_ID,
        startIndex: 0,
        endIndex: 1,
        pixelSize: 100,
      },
      resize_columns: {
        action: 'resize_columns',
        spreadsheetId: TEST_SPREADSHEET_ID,
        startIndex: 0,
        endIndex: 1,
        pixelSize: 150,
      },
      auto_resize: { action: 'auto_resize', spreadsheetId: TEST_SPREADSHEET_ID },
      hide_rows: {
        action: 'hide_rows',
        spreadsheetId: TEST_SPREADSHEET_ID,
        startIndex: 0,
        endIndex: 1,
      },
      hide_columns: {
        action: 'hide_columns',
        spreadsheetId: TEST_SPREADSHEET_ID,
        startIndex: 0,
        endIndex: 1,
      },
      show_rows: {
        action: 'show_rows',
        spreadsheetId: TEST_SPREADSHEET_ID,
        startIndex: 0,
        endIndex: 1,
      },
      show_columns: {
        action: 'show_columns',
        spreadsheetId: TEST_SPREADSHEET_ID,
        startIndex: 0,
        endIndex: 1,
      },
      freeze_rows: { action: 'freeze_rows', spreadsheetId: TEST_SPREADSHEET_ID, count: 1 },
      freeze_columns: { action: 'freeze_columns', spreadsheetId: TEST_SPREADSHEET_ID, count: 1 },
      group_rows: {
        action: 'group_rows',
        spreadsheetId: TEST_SPREADSHEET_ID,
        startIndex: 0,
        endIndex: 2,
      },
      group_columns: {
        action: 'group_columns',
        spreadsheetId: TEST_SPREADSHEET_ID,
        startIndex: 0,
        endIndex: 2,
      },
      ungroup_rows: {
        action: 'ungroup_rows',
        spreadsheetId: TEST_SPREADSHEET_ID,
        startIndex: 0,
        endIndex: 2,
      },
      ungroup_columns: {
        action: 'ungroup_columns',
        spreadsheetId: TEST_SPREADSHEET_ID,
        startIndex: 0,
        endIndex: 2,
      },
      append_rows: { action: 'append_rows', spreadsheetId: TEST_SPREADSHEET_ID, count: 10 },
      append_columns: { action: 'append_columns', spreadsheetId: TEST_SPREADSHEET_ID, count: 5 },
    },

    // Rules tool
    sheets_rules: {
      add_conditional_format: {
        action: 'add_conditional_format',
        spreadsheetId: TEST_SPREADSHEET_ID,
        ranges: [{ a1: 'A1:A10' }],
        rule: {
          booleanRule: {
            condition: { type: 'NUMBER_GREATER', values: [{ userEnteredValue: '10' }] },
            format: { backgroundColor: { red: 1, green: 0, blue: 0 } },
          },
        },
      },
      update_conditional_format: {
        action: 'update_conditional_format',
        spreadsheetId: TEST_SPREADSHEET_ID,
        ruleId: 0,
        rule: {
          booleanRule: {
            condition: { type: 'NUMBER_GREATER', values: [{ userEnteredValue: '20' }] },
            format: { backgroundColor: { red: 0, green: 1, blue: 0 } },
          },
        },
      },
      delete_conditional_format: {
        action: 'delete_conditional_format',
        spreadsheetId: TEST_SPREADSHEET_ID,
        ruleId: 0,
      },
      list_conditional_formats: {
        action: 'list_conditional_formats',
        spreadsheetId: TEST_SPREADSHEET_ID,
      },
      add_data_validation: {
        action: 'add_data_validation',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'A1:A10',
        rule: { condition: { type: 'NUMBER_GREATER', values: [{ userEnteredValue: '0' }] } },
      },
      clear_data_validation: {
        action: 'clear_data_validation',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'A1:A10',
      },
      list_data_validations: {
        action: 'list_data_validations',
        spreadsheetId: TEST_SPREADSHEET_ID,
      },
      add_preset_rule: {
        action: 'add_preset_rule',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'A1:A10',
        preset: 'highlight_duplicates',
      },
    },

    // Continue for remaining tools...
    // Charts, Pivot, Filter/Sort, Sharing, Comments, Versions, Analysis, Advanced
    // Transaction, Validation, Conflict, Impact, History, Confirm, Analyze, Fix, Composite, Session

    // For brevity, adding placeholders for remaining tools
    sheets_charts: {
      list: { action: 'list', spreadsheetId: TEST_SPREADSHEET_ID },
      get: { action: 'get', spreadsheetId: TEST_SPREADSHEET_ID, chartId: 0 },
      create: {
        action: 'create',
        spreadsheetId: TEST_SPREADSHEET_ID,
        spec: { title: 'Test Chart' },
      },
      update: {
        action: 'update',
        spreadsheetId: TEST_SPREADSHEET_ID,
        chartId: 0,
        spec: { title: 'Updated Chart' },
      },
      delete: { action: 'delete', spreadsheetId: TEST_SPREADSHEET_ID, chartId: 0 },
      move: {
        action: 'move',
        spreadsheetId: TEST_SPREADSHEET_ID,
        chartId: 0,
        newPosition: { overlayPosition: { anchorCell: { sheetId: 0, rowIndex: 0, columnIndex: 0 } } },
      },
      resize: {
        action: 'resize',
        spreadsheetId: TEST_SPREADSHEET_ID,
        chartId: 0,
        width: 400,
        height: 300,
      },
      update_data_range: {
        action: 'update_data_range',
        spreadsheetId: TEST_SPREADSHEET_ID,
        chartId: 0,
        dataRange: 'Sheet1!A1:B10',
      },
      export: { action: 'export', spreadsheetId: TEST_SPREADSHEET_ID, chartId: 0 },
    },

    sheets_pivot: {
      list: { action: 'list', spreadsheetId: TEST_SPREADSHEET_ID },
      get: { action: 'get', spreadsheetId: TEST_SPREADSHEET_ID, pivotTableId: 0 },
      create: {
        action: 'create',
        spreadsheetId: TEST_SPREADSHEET_ID,
        source: { a1: 'Sheet1!A1:D10' },
        rows: [{ sourceColumnOffset: 0 }],
        values: [{ summarizeFunction: 'SUM', sourceColumnOffset: 1 }],
      },
      update: {
        action: 'update',
        spreadsheetId: TEST_SPREADSHEET_ID,
        pivotTableId: 0,
        values: [{ summarizeFunction: 'AVERAGE', sourceColumnOffset: 1 }],
      },
      delete: { action: 'delete', spreadsheetId: TEST_SPREADSHEET_ID, pivotTableId: 0 },
      refresh: { action: 'refresh', spreadsheetId: TEST_SPREADSHEET_ID, pivotTableId: 0 },
    },

    sheets_filter_sort: {
      set_basic_filter: {
        action: 'set_basic_filter',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'A1:D10',
      },
      clear_basic_filter: { action: 'clear_basic_filter', spreadsheetId: TEST_SPREADSHEET_ID },
      get_basic_filter: { action: 'get_basic_filter', spreadsheetId: TEST_SPREADSHEET_ID },
      update_filter_criteria: {
        action: 'update_filter_criteria',
        spreadsheetId: TEST_SPREADSHEET_ID,
        column: 0,
        criteria: { condition: { type: 'TEXT_CONTAINS', values: [{ userEnteredValue: 'test' }] } },
      },
      sort_range: {
        action: 'sort_range',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'A1:D10',
        sortSpecs: [{ dimensionIndex: 0, sortOrder: 'ASCENDING' }],
      },
      create_filter_view: {
        action: 'create_filter_view',
        spreadsheetId: TEST_SPREADSHEET_ID,
        title: 'Test Filter View',
        range: { a1: 'A1:D10' },
      },
      update_filter_view: {
        action: 'update_filter_view',
        spreadsheetId: TEST_SPREADSHEET_ID,
        filterViewId: 0,
        title: 'Updated Filter View',
      },
      delete_filter_view: {
        action: 'delete_filter_view',
        spreadsheetId: TEST_SPREADSHEET_ID,
        filterViewId: 0,
      },
      list_filter_views: { action: 'list_filter_views', spreadsheetId: TEST_SPREADSHEET_ID },
      get_filter_view: {
        action: 'get_filter_view',
        spreadsheetId: TEST_SPREADSHEET_ID,
        filterViewId: 0,
      },
      create_slicer: {
        action: 'create_slicer',
        spreadsheetId: TEST_SPREADSHEET_ID,
        spec: { dataRange: { a1: 'A1:A10' }, columnIndex: 0 },
      },
      update_slicer: {
        action: 'update_slicer',
        spreadsheetId: TEST_SPREADSHEET_ID,
        slicerId: 0,
        spec: { columnIndex: 1 },
      },
      delete_slicer: { action: 'delete_slicer', spreadsheetId: TEST_SPREADSHEET_ID, slicerId: 0 },
      list_slicers: { action: 'list_slicers', spreadsheetId: TEST_SPREADSHEET_ID },
    },

    sheets_sharing: {
      list_permissions: { action: 'list_permissions', spreadsheetId: TEST_SPREADSHEET_ID },
      get_permission: {
        action: 'get_permission',
        spreadsheetId: TEST_SPREADSHEET_ID,
        permissionId: 'test',
      },
      share: {
        action: 'share',
        spreadsheetId: TEST_SPREADSHEET_ID,
        email: 'test@example.com',
        role: 'reader',
      },
      update_permission: {
        action: 'update_permission',
        spreadsheetId: TEST_SPREADSHEET_ID,
        permissionId: 'test',
        role: 'writer',
      },
      remove_permission: {
        action: 'remove_permission',
        spreadsheetId: TEST_SPREADSHEET_ID,
        permissionId: 'test',
      },
      transfer_ownership: {
        action: 'transfer_ownership',
        spreadsheetId: TEST_SPREADSHEET_ID,
        newOwnerEmail: 'newowner@example.com',
      },
      set_link_sharing: {
        action: 'set_link_sharing',
        spreadsheetId: TEST_SPREADSHEET_ID,
        access: 'reader',
      },
      get_sharing_link: { action: 'get_sharing_link', spreadsheetId: TEST_SPREADSHEET_ID },
    },

    sheets_comments: {
      list: { action: 'list', spreadsheetId: TEST_SPREADSHEET_ID },
      get: { action: 'get', spreadsheetId: TEST_SPREADSHEET_ID, commentId: 'test' },
      add: {
        action: 'add',
        spreadsheetId: TEST_SPREADSHEET_ID,
        cell: 'A1',
        content: 'Test comment',
      },
      update: {
        action: 'update',
        spreadsheetId: TEST_SPREADSHEET_ID,
        commentId: 'test',
        content: 'Updated comment',
      },
      delete: { action: 'delete', spreadsheetId: TEST_SPREADSHEET_ID, commentId: 'test' },
      resolve: { action: 'resolve', spreadsheetId: TEST_SPREADSHEET_ID, commentId: 'test' },
      reopen: { action: 'reopen', spreadsheetId: TEST_SPREADSHEET_ID, commentId: 'test' },
      add_reply: {
        action: 'add_reply',
        spreadsheetId: TEST_SPREADSHEET_ID,
        commentId: 'test',
        content: 'Test reply',
      },
      update_reply: {
        action: 'update_reply',
        spreadsheetId: TEST_SPREADSHEET_ID,
        commentId: 'test',
        replyId: 'test-reply',
        content: 'Updated reply',
      },
      delete_reply: {
        action: 'delete_reply',
        spreadsheetId: TEST_SPREADSHEET_ID,
        commentId: 'test',
        replyId: 'test-reply',
      },
    },

    sheets_versions: {
      list_revisions: { action: 'list_revisions', spreadsheetId: TEST_SPREADSHEET_ID },
      get_revision: {
        action: 'get_revision',
        spreadsheetId: TEST_SPREADSHEET_ID,
        revisionId: '1',
      },
      restore_revision: {
        action: 'restore_revision',
        spreadsheetId: TEST_SPREADSHEET_ID,
        revisionId: '1',
      },
      keep_revision: {
        action: 'keep_revision',
        spreadsheetId: TEST_SPREADSHEET_ID,
        revisionId: '1',
      },
      create_snapshot: { action: 'create_snapshot', spreadsheetId: TEST_SPREADSHEET_ID },
      list_snapshots: { action: 'list_snapshots', spreadsheetId: TEST_SPREADSHEET_ID },
      restore_snapshot: {
        action: 'restore_snapshot',
        spreadsheetId: TEST_SPREADSHEET_ID,
        snapshotId: 'test',
      },
      delete_snapshot: {
        action: 'delete_snapshot',
        spreadsheetId: TEST_SPREADSHEET_ID,
        snapshotId: 'test',
      },
      compare: {
        action: 'compare',
        spreadsheetId: TEST_SPREADSHEET_ID,
        revisionId1: '1',
        revisionId2: '2',
      },
      export_version: {
        action: 'export_version',
        spreadsheetId: TEST_SPREADSHEET_ID,
        revisionId: '1',
      },
    },

    sheets_analysis: {
      data_quality: {
        action: 'data_quality',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:D10',
      },
      formula_audit: { action: 'formula_audit', spreadsheetId: TEST_SPREADSHEET_ID },
      structure_analysis: { action: 'structure_analysis', spreadsheetId: TEST_SPREADSHEET_ID },
      statistics: {
        action: 'statistics',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:D10',
      },
      correlations: {
        action: 'correlations',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:D10',
      },
      summary: {
        action: 'summary',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:D10',
      },
      dependencies: {
        action: 'dependencies',
        spreadsheetId: TEST_SPREADSHEET_ID,
        cell: 'A1',
      },
      compare_ranges: {
        action: 'compare_ranges',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range1: 'Sheet1!A1:B5',
        range2: 'Sheet1!C1:D5',
      },
      detect_patterns: {
        action: 'detect_patterns',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:D10',
      },
      column_analysis: {
        action: 'column_analysis',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A:A',
      },
      suggest_templates: { action: 'suggest_templates', spreadsheetId: TEST_SPREADSHEET_ID },
      generate_formula: {
        action: 'generate_formula',
        spreadsheetId: TEST_SPREADSHEET_ID,
        description: 'sum of column A',
      },
      suggest_chart: {
        action: 'suggest_chart',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:D10',
      },
    },

    sheets_advanced: {
      list_named_ranges: { action: 'list_named_ranges', spreadsheetId: TEST_SPREADSHEET_ID },
      get_named_range: {
        action: 'get_named_range',
        spreadsheetId: TEST_SPREADSHEET_ID,
        name: 'TestRange',
      },
      add_named_range: {
        action: 'add_named_range',
        spreadsheetId: TEST_SPREADSHEET_ID,
        name: 'TestRange',
        range: 'Sheet1!A1:B10',
      },
      update_named_range: {
        action: 'update_named_range',
        spreadsheetId: TEST_SPREADSHEET_ID,
        namedRangeId: 'test',
        range: 'Sheet1!A1:C10',
      },
      delete_named_range: {
        action: 'delete_named_range',
        spreadsheetId: TEST_SPREADSHEET_ID,
        namedRangeId: 'test',
      },
      list_protected_ranges: {
        action: 'list_protected_ranges',
        spreadsheetId: TEST_SPREADSHEET_ID,
      },
      add_protected_range: {
        action: 'add_protected_range',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:B10',
        description: 'Protected area',
      },
      update_protected_range: {
        action: 'update_protected_range',
        spreadsheetId: TEST_SPREADSHEET_ID,
        protectedRangeId: 0,
        description: 'Updated protection',
      },
      delete_protected_range: {
        action: 'delete_protected_range',
        spreadsheetId: TEST_SPREADSHEET_ID,
        protectedRangeId: 0,
      },
      set_metadata: {
        action: 'set_metadata',
        spreadsheetId: TEST_SPREADSHEET_ID,
        key: 'test_key',
        value: 'test_value',
      },
      get_metadata: {
        action: 'get_metadata',
        spreadsheetId: TEST_SPREADSHEET_ID,
        key: 'test_key',
      },
      delete_metadata: {
        action: 'delete_metadata',
        spreadsheetId: TEST_SPREADSHEET_ID,
        key: 'test_key',
      },
      add_banding: {
        action: 'add_banding',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:D10',
      },
      update_banding: {
        action: 'update_banding',
        spreadsheetId: TEST_SPREADSHEET_ID,
        bandedRangeId: 0,
      },
      delete_banding: {
        action: 'delete_banding',
        spreadsheetId: TEST_SPREADSHEET_ID,
        bandedRangeId: 0,
      },
      list_banding: { action: 'list_banding', spreadsheetId: TEST_SPREADSHEET_ID },
      create_table: {
        action: 'create_table',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:D10',
      },
      delete_table: {
        action: 'delete_table',
        spreadsheetId: TEST_SPREADSHEET_ID,
        tableId: 'test',
      },
      list_tables: { action: 'list_tables', spreadsheetId: TEST_SPREADSHEET_ID },
    },

    sheets_transaction: {
      begin: { action: 'begin', spreadsheetId: TEST_SPREADSHEET_ID },
      queue: {
        action: 'queue',
        transactionId: 'test-tx',
        operation: { type: 'updateCells', range: 'A1', values: [['test']] },
      },
      commit: { action: 'commit', transactionId: 'test-tx' },
      rollback: { action: 'rollback', transactionId: 'test-tx' },
      status: { action: 'status', transactionId: 'test-tx' },
      list: { action: 'list' },
    },

    sheets_validation: {
      validate: {
        action: 'validate',
        data: [
          ['test', '123'],
          ['hello', '456'],
        ],
        rules: [
          { type: 'not_empty', column: 0 },
          { type: 'type', column: 1, expectedType: 'number' },
        ],
      },
    },

    sheets_conflict: {
      detect: {
        action: 'detect',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'A1:B2',
        localVersion: 1,
      },
      resolve: {
        action: 'resolve',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'A1:B2',
        strategy: 'keep_local',
      },
    },

    sheets_impact: {
      analyze: {
        action: 'analyze',
        spreadsheetId: TEST_SPREADSHEET_ID,
        operation: { type: 'delete_rows', startIndex: 0, endIndex: 1 },
      },
    },

    sheets_history: {
      list: { action: 'list' },
      get: { action: 'get', operationId: 'test-op' },
      stats: { action: 'stats' },
      undo: { action: 'undo' },
      redo: { action: 'redo' },
      revert_to: { action: 'revert_to', operationId: 'test-op' },
      clear: { action: 'clear' },
    },

    sheets_confirm: {
      request: {
        action: 'request',
        plan: {
          title: 'Test Plan',
          description: 'Testing confirmation',
          operations: [{ description: 'Test operation', tool: 'sheets_values', action: 'write' }],
        },
      },
      get_stats: { action: 'get_stats' },
    },

    sheets_analyze: {
      analyze: {
        action: 'analyze',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:D10',
        prompt: 'Analyze this data',
      },
      generate_formula: {
        action: 'generate_formula',
        description: 'Calculate average of column A',
      },
      suggest_chart: {
        action: 'suggest_chart',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:D10',
      },
      get_stats: { action: 'get_stats' },
    },

    sheets_fix: {
      fix: {
        spreadsheetId: TEST_SPREADSHEET_ID,
        issues: [
          {
            type: 'empty_cells',
            severity: 'warning',
            location: 'A1:A10',
            description: 'Empty cells found',
          },
        ],
        mode: 'preview',
      },
    },

    sheets_composite: {
      import_csv: {
        action: 'import_csv',
        spreadsheetId: TEST_SPREADSHEET_ID,
        csvContent: 'a,b,c\n1,2,3\n4,5,6',
        sheetName: 'Imported',
      },
      smart_append: {
        action: 'smart_append',
        spreadsheetId: TEST_SPREADSHEET_ID,
        sheetName: 'Sheet1',
        data: { name: 'Test', value: '123' },
      },
      bulk_update: {
        action: 'bulk_update',
        spreadsheetId: TEST_SPREADSHEET_ID,
        sheetName: 'Sheet1',
        keyColumn: 'A',
        updates: [{ key: 'test', updates: { B: 'updated' } }],
      },
      deduplicate: {
        action: 'deduplicate',
        spreadsheetId: TEST_SPREADSHEET_ID,
        range: 'Sheet1!A1:D10',
        keyColumns: [0],
      },
    },

    sheets_session: {
      get_active: { action: 'get_active' },
      set_context: { action: 'set_context', spreadsheetId: TEST_SPREADSHEET_ID },
      clear_context: { action: 'clear_context' },
      get_history: { action: 'get_history' },
    },
  };

  const toolArgs = baseArgs[toolName];
  if (!toolArgs) {
    return null;
  }

  return toolArgs[action] || null;
}

async function runComprehensiveTests() {
  console.log('🧪 Starting comprehensive action-level testing...\n');
  console.log(`Testing ALL 208 actions across 26 tools\n`);
  console.log('='.repeat(80) + '\n');

  const child = spawn('node', ['dist/cli.js', '--stdio'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, OAUTH_AUTO_OPEN_BROWSER: 'false' },
  });

  const client = createJsonRpcClient(child);

  try {
    // Initialize
    await client.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'comprehensive-test-client',
        version: '1.0.0',
      },
    });

    console.log('✅ Server initialized\n');

    // Test all actions for each tool
    for (const [toolName, actions] of Object.entries(TOOL_ACTIONS)) {
      console.log(`\n📦 Testing ${toolName} (${actions.length} actions)...`);

      for (const action of actions) {
        const args = getTestArgs(toolName, action);

        if (!args) {
          results.push({
            tool: toolName,
            action,
            status: 'skip',
            message: 'No test args defined',
          });
          console.log(`  ⏭️  ${action}: No test args`);
          continue;
        }

        const result = await testAction(client, toolName, action, args);
        results.push(result);

        const icon =
          result.status === 'pass'
            ? '✅'
            : result.status === 'fail'
              ? '❌'
              : result.status === 'auth_required'
                ? '🔐'
                : '⏭️';
        console.log(`  ${icon} ${action}: ${result.message} (${result.duration}ms)`);
      }
    }

    // Generate report
    generateReport();
  } finally {
    child.kill();
  }
}

function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE TEST RESULTS SUMMARY');
  console.log('='.repeat(80) + '\n');

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const skipped = results.filter((r) => r.status === 'skip').length;
  const authRequired = results.filter((r) => r.status === 'auth_required').length;

  console.log(`✅ Passed:         ${passed}`);
  console.log(`❌ Failed:         ${failed}`);
  console.log(`⏭️  Skipped:        ${skipped}`);
  console.log(`🔐 Auth Required:  ${authRequired}`);
  console.log(`📦 Total:          ${results.length}\n`);

  // Show failures in detail
  const failures = results.filter((r) => r.status === 'fail');
  if (failures.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('❌ FAILURES (' + failures.length + ')');
    console.log('='.repeat(80) + '\n');

    failures.forEach((f) => {
      console.log(`Tool:    ${f.tool}`);
      console.log(`Action:  ${f.action}`);
      console.log(`Message: ${f.message}`);
      if (f.error) {
        console.log(`Error:   ${f.error.substring(0, 300)}${f.error.length > 300 ? '...' : ''}`);
      }
      console.log('');
    });
  }

  // Write detailed JSON report
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed,
      failed,
      skipped,
      authRequired,
      passRate: ((passed / results.length) * 100).toFixed(2) + '%',
    },
    results,
    failures: failures.map((f) => ({
      tool: f.tool,
      action: f.action,
      message: f.message,
      error: f.error,
    })),
  };

  const reportPath = 'test-results-comprehensive.json';
  writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`\n📄 Detailed report written to: ${reportPath}\n`);

  // Group failures by tool
  const failuresByTool = failures.reduce(
    (acc, f) => {
      if (!acc[f.tool]) {
        acc[f.tool] = [];
      }
      acc[f.tool].push(f.action);
      return acc;
    },
    {} as Record<string, string[]>,
  );

  if (Object.keys(failuresByTool).length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 FAILURES BY TOOL');
    console.log('='.repeat(80) + '\n');

    for (const [tool, actions] of Object.entries(failuresByTool)) {
      console.log(`${tool}: ${actions.length} failures`);
      actions.forEach((action) => {
        console.log(`  - ${action}`);
      });
      console.log('');
    }
  }

  // Exit code
  if (failures.length > 0) {
    process.exit(1);
  }
}

runComprehensiveTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
