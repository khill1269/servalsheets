/**
 * Comprehensive Action-Level Test Suite - ALL 241 ACTIONS
 *
 * Tests EVERY action across all 19 tools via STDIO JSON-RPC.
 * Designed to detect issues like the copy hang (Issue #1).
 *
 * Usage:
 *   npm run build && node dist/scripts/test-all-actions-comprehensive.js
 *   npm run build && node dist/scripts/test-all-actions-comprehensive.js --tool sheets_core
 *   npm run build && node dist/scripts/test-all-actions-comprehensive.js --verbose
 *   npm run build && node dist/scripts/test-all-actions-comprehensive.js --debug
 *   npm run build && node dist/scripts/test-all-actions-comprehensive.js --log-file=test.log
 *
 * Results are categorized:
 *   - pass: Tool executed successfully
 *   - auth_required: Expected auth error (no credentials configured)
 *   - validation_error: Schema validation caught bad input
 *   - api_error: External API error (Google API)
 *   - timeout: Request hung (CRITICAL - like Issue #1)
 *   - crash: Unhandled exception
 *
 * Output files:
 *   - test-results-comprehensive.json: Full test results
 *   - test-errors.log: Detailed error log for debugging
 *   - test-errors.csv: CSV export for analysis
 *   - test-performance.json: Performance metrics
 *
 * @version 3.0.0 - Enhanced logging and debugging
 */

import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { writeFileSync, appendFileSync, existsSync, unlinkSync } from 'fs';
import { TOOL_ACTIONS } from '../src/schemas/index.js';

// ============================================================================
// LOGGING SYSTEM
// ============================================================================

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogConfig {
  level: LogLevel;
  console: boolean;
  file: string | null;
  timestamps: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

class Logger {
  private config: LogConfig;
  private logBuffer: string[] = [];

  constructor(config: Partial<LogConfig> = {}) {
    this.config = {
      level: config.level ?? 'INFO',
      console: config.console ?? true,
      file: config.file ?? null,
      timestamps: config.timestamps ?? true,
    };

    // Clear existing log file
    if (this.config.file && existsSync(this.config.file)) {
      unlinkSync(this.config.file);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = this.config.timestamps ? `[${new Date().toISOString()}] ` : '';
    const prefix = `${timestamp}[${level}]`;
    let formatted = `${prefix} ${message}`;
    if (data !== undefined) {
      if (typeof data === 'object') {
        formatted += '\n' + JSON.stringify(data, null, 2);
      } else {
        formatted += ` ${data}`;
      }
    }
    return formatted;
  }

  private write(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const formatted = this.formatMessage(level, message, data);
    this.logBuffer.push(formatted);

    if (this.config.console) {
      const color =
        level === 'ERROR'
          ? '\x1b[31m'
          : level === 'WARN'
            ? '\x1b[33m'
            : level === 'DEBUG'
              ? '\x1b[36m'
              : '';
      const reset = color ? '\x1b[0m' : '';
      console.log(`${color}${formatted}${reset}`);
    }

    if (this.config.file) {
      appendFileSync(this.config.file, formatted + '\n');
    }
  }

  debug(message: string, data?: any): void {
    this.write('DEBUG', message, data);
  }
  info(message: string, data?: any): void {
    this.write('INFO', message, data);
  }
  warn(message: string, data?: any): void {
    this.write('WARN', message, data);
  }
  error(message: string, data?: any): void {
    this.write('ERROR', message, data);
  }

  getBuffer(): string[] {
    return [...this.logBuffer];
  }
}

// Global logger instance (configured in main)
let logger: Logger;

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

type ResultStatus =
  | 'pass'
  | 'fail'
  | 'skip'
  | 'auth_required'
  | 'validation_error'
  | 'api_error'
  | 'timeout'
  | 'crash';

interface TestResult {
  tool: string;
  action: string;
  status: ResultStatus;
  message: string;
  error?: string;
  errorCode?: string;
  errorStack?: string;
  duration?: number;
  requestPayload?: any;
  responsePayload?: any;
  timestamp: string;
}

interface PerformanceMetrics {
  tool: string;
  action: string;
  duration: number;
  status: ResultStatus;
}

interface ErrorSummary {
  errorCode: string;
  count: number;
  tools: string[];
  actions: string[];
  sampleMessage: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

interface TestConfig {
  requestTimeoutMs: number;
  startupTimeoutMs: number;
  verbose: boolean;
  debug: boolean;
  logFile: string | null;
  filterTool: string | null;
  outputDir: string;
}

const DEFAULT_CONFIG: TestConfig = {
  requestTimeoutMs: 10000,
  startupTimeoutMs: 5000,
  verbose: false,
  debug: false,
  logFile: null,
  filterTool: null,
  outputDir: '.',
};

let CONFIG: TestConfig = { ...DEFAULT_CONFIG };

// ============================================================================
// GLOBAL STATE
// ============================================================================

const results: TestResult[] = [];
const performanceMetrics: PerformanceMetrics[] = [];
const errorsByCode: Map<string, ErrorSummary> = new Map();
let requestId = 1;

// Test spreadsheet ID (public test sheet)
const TEST_SPREADSHEET_ID = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';

// ============================================================================
// JSON-RPC CLIENT WITH DEBUG LOGGING
// ============================================================================

interface JsonRpcRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: any;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

function createJsonRpcClient(child: ChildProcess) {
  let buffer = '';
  const pending = new Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
      request: JsonRpcRequest;
      startTime: number;
    }
  >();

  child.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const json = JSON.parse(line) as JsonRpcResponse;
        const id = json?.id;
        if (typeof id === 'number' && pending.has(id)) {
          const entry = pending.get(id);
          if (entry) {
            clearTimeout(entry.timeout);
            pending.delete(id);

            const duration = Date.now() - entry.startTime;
            logger.debug(`Response received [${id}] in ${duration}ms`, {
              method: entry.request.method,
              hasError: !!json.error,
              hasResult: !!json.result,
            });

            if (CONFIG.debug && json.error) {
              logger.debug(`Error details [${id}]:`, json.error);
            }

            entry.resolve(json);
          }
        }
      } catch (e) {
        // Log non-JSON lines in debug mode
        if (CONFIG.debug && line.trim()) {
          logger.debug(`Non-JSON stdout: ${line.substring(0, 200)}`);
        }
      }
    }
  });

  child.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) {
      // Always log stderr in debug mode, skip [ServalSheets] prefix noise otherwise
      if (CONFIG.debug) {
        logger.debug(`STDERR: ${text}`);
      } else if (!text.includes('[ServalSheets]')) {
        logger.warn(`Server stderr: ${text.substring(0, 200)}`);
      }
    }
  });

  const send = (
    method: string,
    params: any = {},
    timeoutMs = CONFIG.requestTimeoutMs
  ): Promise<{ response: JsonRpcResponse; request: JsonRpcRequest }> => {
    return new Promise((resolve, reject) => {
      const id = requestId++;
      const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
      const startTime = Date.now();

      logger.debug(`Sending request [${id}]: ${method}`, CONFIG.debug ? params : undefined);

      const timeout = setTimeout(() => {
        pending.delete(id);
        logger.error(`Request timeout [${id}]: ${method} after ${timeoutMs}ms`);
        reject(new Error(`TIMEOUT after ${timeoutMs}ms: ${method}`));
      }, timeoutMs);

      pending.set(id, {
        resolve: (response) => resolve({ response, request }),
        reject,
        timeout,
        request,
        startTime,
      });

      const requestStr = JSON.stringify(request) + '\n';
      child.stdin?.write(requestStr);
    });
  };

  return { send };
}

// ============================================================================
// ERROR CLASSIFICATION AND TRACKING
// ============================================================================

interface ClassificationResult {
  status: ResultStatus;
  message: string;
  errorCode?: string;
}

/**
 * Extract error code from response text
 */
function extractErrorCode(text: string): string | undefined {
  // Match common error code patterns
  const patterns = [
    /\[([A-Z_]+)\]/, // [ERROR_CODE]
    /ErrorCode:\s*([A-Z_]+)/i, // ErrorCode: ERROR_CODE
    /code:\s*"?([A-Z_]+)"?/i, // code: ERROR_CODE or code: "ERROR_CODE"
    /"code":\s*"?([A-Z_]+)"?/, // "code": "ERROR_CODE"
    /Error:\s*([A-Z_]+):/, // Error: ERROR_CODE:
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return undefined;
}

/**
 * Classify response into detailed status categories with error code extraction
 */
function classifyResponse(
  text: string,
  jsonError?: { code: number; message: string; data?: any }
): ClassificationResult {
  // Handle JSON-RPC error first
  if (jsonError) {
    const errorCode = jsonError.data?.code || `RPC_${jsonError.code}`;
    const message = jsonError.message || 'Unknown RPC error';

    // Classify based on error code
    if (jsonError.code === -32602 || message.includes('Invalid params')) {
      return { status: 'validation_error', message, errorCode };
    }
    if (jsonError.code === -32601) {
      return { status: 'fail', message: 'Method not found', errorCode: 'METHOD_NOT_FOUND' };
    }

    return { status: 'fail', message, errorCode };
  }

  const errorCode = extractErrorCode(text);

  // Auth errors (expected when no credentials)
  if (
    text.includes('not authenticated') ||
    text.includes('OAUTH_NOT_CONFIGURED') ||
    text.includes('Authentication required') ||
    text.includes('login') ||
    text.includes('Please authenticate') ||
    text.includes('OAuth') ||
    errorCode === 'OAUTH_NOT_CONFIGURED' ||
    errorCode === 'AUTH_REQUIRED'
  ) {
    return {
      status: 'auth_required',
      message: 'Expected auth error',
      errorCode: errorCode || 'AUTH_REQUIRED',
    };
  }

  // Validation errors (schema caught bad input)
  if (
    text.includes('INVALID_PARAMS') ||
    text.includes('validation failed') ||
    text.includes('required field') ||
    text.includes('Invalid input') ||
    text.includes('Validation error') ||
    errorCode === 'INVALID_PARAMS' ||
    errorCode === 'VALIDATION_ERROR'
  ) {
    return {
      status: 'validation_error',
      message: text.substring(0, 100),
      errorCode: errorCode || 'VALIDATION_ERROR',
    };
  }

  // API errors (Google API issues)
  if (
    text.includes('API_ERROR') ||
    text.includes('Google API') ||
    text.includes('403') ||
    text.includes('404') ||
    text.includes('NOT_FOUND') ||
    text.includes('PERMISSION_DENIED') ||
    text.includes('RATE_LIMIT') ||
    text.includes('QUOTA_EXCEEDED') ||
    errorCode?.startsWith('API_') ||
    errorCode === 'NOT_FOUND' ||
    errorCode === 'PERMISSION_DENIED'
  ) {
    return {
      status: 'api_error',
      message: text.substring(0, 100),
      errorCode: errorCode || 'API_ERROR',
    };
  }

  // Generic errors
  if (
    text.includes('Error:') ||
    text.includes('Failed') ||
    text.includes('error') ||
    text.includes('Error')
  ) {
    return {
      status: 'fail',
      message: text.substring(0, 100),
      errorCode: errorCode || 'UNKNOWN_ERROR',
    };
  }

  // Success
  return { status: 'pass', message: 'Success' };
}

/**
 * Track error by code for summary reporting
 */
function trackError(result: TestResult): void {
  if (result.status === 'pass') return;

  const errorCode = result.errorCode || 'UNKNOWN';
  const existing = errorsByCode.get(errorCode);

  if (existing) {
    existing.count++;
    if (!existing.tools.includes(result.tool)) existing.tools.push(result.tool);
    if (!existing.actions.includes(result.action)) existing.actions.push(result.action);
  } else {
    errorsByCode.set(errorCode, {
      errorCode,
      count: 1,
      tools: [result.tool],
      actions: [result.action],
      sampleMessage: result.message,
    });
  }
}

// ============================================================================
// TEST EXECUTION
// ============================================================================

async function testAction(
  client: ReturnType<typeof createJsonRpcClient>,
  toolName: string,
  action: string,
  args: any
): Promise<TestResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  logger.debug(`Testing ${toolName}.${action}`, CONFIG.debug ? args : undefined);

  try {
    const { response, request } = await client.send('tools/call', {
      name: toolName,
      arguments: args,
    });

    const duration = Date.now() - startTime;

    // Track performance
    performanceMetrics.push({ tool: toolName, action, duration, status: 'pass' });

    // Handle JSON-RPC error response
    if (response.error) {
      const { status, message, errorCode } = classifyResponse('', response.error);

      const result: TestResult = {
        tool: toolName,
        action,
        status,
        message,
        errorCode,
        error: response.error.message,
        duration,
        timestamp,
        requestPayload: CONFIG.debug ? request : undefined,
        responsePayload: CONFIG.debug ? response : undefined,
      };

      logger.warn(`${toolName}.${action} failed: ${errorCode || status} - ${message}`);
      trackError(result);
      return result;
    }

    // Check response structure
    if (!response.result || !response.result.content) {
      const result: TestResult = {
        tool: toolName,
        action,
        status: 'crash',
        message: 'Invalid response structure: missing content',
        errorCode: 'INVALID_RESPONSE',
        duration,
        timestamp,
        requestPayload: CONFIG.debug ? request : undefined,
        responsePayload: CONFIG.debug ? response : undefined,
      };

      logger.error(`${toolName}.${action} crash: Invalid response structure`);
      trackError(result);
      return result;
    }

    const content = response.result.content;
    const textContent = content.find((c: any) => c.type === 'text');

    if (!textContent || !textContent.text) {
      const result: TestResult = {
        tool: toolName,
        action,
        status: 'crash',
        message: 'Invalid response structure: no text content',
        errorCode: 'NO_TEXT_CONTENT',
        duration,
        timestamp,
        requestPayload: CONFIG.debug ? request : undefined,
        responsePayload: CONFIG.debug ? response : undefined,
      };

      logger.error(`${toolName}.${action} crash: No text content in response`);
      trackError(result);
      return result;
    }

    const text = textContent.text;
    const { status, message, errorCode } = classifyResponse(text);

    // Update performance metric with actual status
    performanceMetrics[performanceMetrics.length - 1].status = status;

    const result: TestResult = {
      tool: toolName,
      action,
      status,
      message,
      errorCode,
      error: status !== 'pass' && status !== 'auth_required' ? text.substring(0, 500) : undefined,
      duration,
      timestamp,
      requestPayload: CONFIG.debug ? request : undefined,
      responsePayload: CONFIG.debug
        ? { ...response, result: { content: [{ type: 'text', text: text.substring(0, 1000) }] } }
        : undefined,
    };

    if (status === 'pass') {
      logger.debug(`${toolName}.${action} passed in ${duration}ms`);
    } else if (status === 'auth_required') {
      logger.debug(`${toolName}.${action} requires auth (expected)`);
    } else {
      logger.warn(`${toolName}.${action} failed: ${errorCode || status} - ${message}`);
      trackError(result);
    }

    return result;
  } catch (err) {
    const duration = Date.now() - startTime;
    const error = err as Error;
    const errorMessage = error.message;

    // Track performance for failures
    performanceMetrics.push({ tool: toolName, action, duration, status: 'crash' });

    // Check if it's a timeout (CRITICAL - like Issue #1)
    if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
      const result: TestResult = {
        tool: toolName,
        action,
        status: 'timeout',
        message: `CRITICAL: Request timed out after ${CONFIG.requestTimeoutMs}ms`,
        errorCode: 'TIMEOUT',
        error: errorMessage,
        errorStack: error.stack,
        duration,
        timestamp,
      };

      logger.error(`CRITICAL TIMEOUT: ${toolName}.${action} after ${CONFIG.requestTimeoutMs}ms`);
      trackError(result);
      return result;
    }

    const result: TestResult = {
      tool: toolName,
      action,
      status: 'crash',
      message: 'Exception during test',
      errorCode: 'EXCEPTION',
      error: errorMessage,
      errorStack: error.stack,
      duration,
      timestamp,
    };

    logger.error(`${toolName}.${action} crashed: ${errorMessage}`);
    trackError(result);
    return result;
  }
}

/**
 * Generate test arguments for EVERY tool and action (250 total)
 * This ensures 100% action coverage for detecting issues like hanging operations.
 *
 * NOTE: All schemas use the Zod v4 discriminated union format:
 *   { request: { action: "...", ...params } }
 */
function getTestArgs(toolName: string, action: string): any {
  const spreadsheetId = TEST_SPREADSHEET_ID;
  const sheetId = 0;
  const range = 'Sheet1!A1:B2';

  // Helper to wrap action args in the request wrapper
  const wrap = (args: any) => ({ request: args });

  // Comprehensive test arguments for ALL 250 actions across 19 tools
  // Each action is wrapped in { request: {...} } format for Zod v4 discriminated unions
  const baseArgs: Record<string, Record<string, any>> = {
    // ========================================
    // sheets_auth (4 actions)
    // ========================================
    sheets_auth: {
      status: wrap({ action: 'status' }),
      login: wrap({ action: 'login' }),
      logout: wrap({ action: 'logout' }),
      callback: wrap({ action: 'callback', code: 'test-code' }),
    },

    // ========================================
    // sheets_core (15 actions)
    // ========================================
    sheets_core: {
      get: wrap({ action: 'get', spreadsheetId }),
      create: wrap({ action: 'create', title: 'Test Spreadsheet' }),
      copy: wrap({ action: 'copy', spreadsheetId }), // Issue #1 - was hanging
      update_properties: wrap({ action: 'update_properties', spreadsheetId, title: 'Updated' }),
      get_url: wrap({ action: 'get_url', spreadsheetId }),
      batch_get: wrap({ action: 'batch_get', spreadsheetIds: [spreadsheetId] }),
      get_comprehensive: wrap({ action: 'get_comprehensive', spreadsheetId }),
      list: wrap({ action: 'list', maxResults: 5 }),
      add_sheet: wrap({ action: 'add_sheet', spreadsheetId, title: 'NewSheet' }),
      delete_sheet: wrap({ action: 'delete_sheet', spreadsheetId, sheetId: 999 }),
      duplicate_sheet: wrap({ action: 'duplicate_sheet', spreadsheetId, sheetId }),
      update_sheet: wrap({ action: 'update_sheet', spreadsheetId, sheetId, title: 'Renamed' }),
      copy_sheet_to: wrap({
        action: 'copy_sheet_to',
        spreadsheetId,
        sheetId,
        destinationSpreadsheetId: spreadsheetId,
      }),
      list_sheets: wrap({ action: 'list_sheets', spreadsheetId }),
      get_sheet: wrap({ action: 'get_sheet', spreadsheetId, sheetId }),
      batch_delete_sheets: wrap({
        action: 'batch_delete_sheets',
        spreadsheetId,
        sheetIds: [999, 998],
      }),
      batch_update_sheets: wrap({
        action: 'batch_update_sheets',
        spreadsheetId,
        updates: [{ sheetId, title: 'Updated Sheet' }],
      }),
    },

    // ========================================
    // sheets_data (20 actions)
    // ========================================
    sheets_data: {
      read: wrap({ action: 'read', spreadsheetId, range }),
      write: wrap({ action: 'write', spreadsheetId, range, values: [['A', 'B']] }),
      append: wrap({ action: 'append', spreadsheetId, range: 'Sheet1!A:B', values: [['X', 'Y']] }),
      clear: wrap({ action: 'clear', spreadsheetId, range }),
      batch_read: wrap({ action: 'batch_read', spreadsheetId, ranges: [range] }),
      batch_write: wrap({
        action: 'batch_write',
        spreadsheetId,
        data: [{ range, values: [['A', 'B']] }],
      }),
      batch_clear: wrap({ action: 'batch_clear', spreadsheetId, ranges: [range] }),
      find_replace: wrap({ action: 'find_replace', spreadsheetId, find: 'test' }),
      add_note: wrap({ action: 'add_note', spreadsheetId, cell: 'Sheet1!A1', note: 'Test note' }),
      get_note: wrap({ action: 'get_note', spreadsheetId, cell: 'Sheet1!A1' }),
      clear_note: wrap({ action: 'clear_note', spreadsheetId, cell: 'Sheet1!A1' }),
      set_validation: wrap({
        action: 'set_validation',
        spreadsheetId,
        range,
        validation: { condition: { type: 'ONE_OF_LIST', values: ['A', 'B'] } },
      }),
      clear_validation: wrap({ action: 'clear_validation', spreadsheetId, range }),
      set_hyperlink: wrap({
        action: 'set_hyperlink',
        spreadsheetId,
        cell: 'Sheet1!A1',
        url: 'https://example.com',
      }),
      clear_hyperlink: wrap({ action: 'clear_hyperlink', spreadsheetId, cell: 'Sheet1!A1' }),
      merge_cells: wrap({ action: 'merge_cells', spreadsheetId, range, mergeType: 'MERGE_ALL' }),
      unmerge_cells: wrap({ action: 'unmerge_cells', spreadsheetId, range }),
      get_merges: wrap({ action: 'get_merges', spreadsheetId, sheetId }),
      cut_paste: wrap({
        action: 'cut_paste',
        spreadsheetId,
        source: range,
        destination: 'Sheet1!D1',
      }),
      copy_paste: wrap({
        action: 'copy_paste',
        spreadsheetId,
        source: range,
        destination: 'Sheet1!D1',
      }),
    },

    // ========================================
    // sheets_format (18 actions)
    // ========================================
    sheets_format: {
      set_format: wrap({ action: 'set_format', spreadsheetId, range, format: { bold: true } }),
      suggest_format: wrap({ action: 'suggest_format', spreadsheetId, range }),
      set_background: wrap({
        action: 'set_background',
        spreadsheetId,
        range,
        color: { red: 1, green: 0, blue: 0 },
      }),
      set_text_format: wrap({
        action: 'set_text_format',
        spreadsheetId,
        range,
        textFormat: { bold: true },
      }),
      set_number_format: wrap({
        action: 'set_number_format',
        spreadsheetId,
        range,
        numberFormat: { type: 'NUMBER', pattern: '#,##0.00' },
      }),
      set_alignment: wrap({ action: 'set_alignment', spreadsheetId, range, horizontal: 'CENTER' }),
      set_borders: wrap({
        action: 'set_borders',
        spreadsheetId,
        range,
        borders: { top: { style: 'SOLID' } },
      }),
      clear_format: wrap({ action: 'clear_format', spreadsheetId, range }),
      apply_preset: wrap({
        action: 'apply_preset',
        spreadsheetId,
        range,
        preset: 'alternating_rows',
      }),
      auto_fit: wrap({ action: 'auto_fit', spreadsheetId, range, dimension: 'COLUMNS' }),
      sparkline_add: wrap({
        action: 'sparkline_add',
        spreadsheetId,
        targetCell: 'E1',
        dataRange: 'A1:A10',
      }),
      sparkline_get: wrap({ action: 'sparkline_get', spreadsheetId, cell: 'E1' }),
      sparkline_clear: wrap({ action: 'sparkline_clear', spreadsheetId, cell: 'E1' }),
      rule_add_conditional_format: wrap({
        action: 'rule_add_conditional_format',
        spreadsheetId,
        sheetId,
        range,
        rule: {
          type: 'boolean',
          condition: { type: 'NUMBER_GREATER', values: ['0'] },
          format: { backgroundColor: { red: 1 } },
        },
      }),
      rule_update_conditional_format: wrap({
        action: 'rule_update_conditional_format',
        spreadsheetId,
        sheetId,
        ruleIndex: 0,
        rule: {
          type: 'boolean',
          condition: { type: 'NUMBER_GREATER', values: ['10'] },
          format: { backgroundColor: { red: 1 } },
        },
      }),
      rule_delete_conditional_format: wrap({
        action: 'rule_delete_conditional_format',
        spreadsheetId,
        sheetId,
        ruleIndex: 0,
      }),
      rule_list_conditional_formats: wrap({
        action: 'rule_list_conditional_formats',
        spreadsheetId,
        sheetId,
      }),
      set_data_validation: wrap({
        action: 'set_data_validation',
        spreadsheetId,
        range,
        condition: { type: 'ONE_OF_LIST', values: ['A', 'B'] },
      }),
      clear_data_validation: wrap({ action: 'clear_data_validation', spreadsheetId, range }),
      list_data_validations: wrap({ action: 'list_data_validations', spreadsheetId, sheetId }),
      add_conditional_format_rule: wrap({
        action: 'add_conditional_format_rule',
        spreadsheetId,
        sheetId,
        range,
        rulePreset: 'highlight_duplicates',
      }),
    },

    // ========================================
    // sheets_dimensions (35 actions)
    // ========================================
    sheets_dimensions: {
      insert_rows: wrap({
        action: 'insert_rows',
        spreadsheetId,
        sheetId,
        startIndex: 0,
        endIndex: 1,
      }),
      insert_columns: wrap({
        action: 'insert_columns',
        spreadsheetId,
        sheetId,
        startIndex: 0,
        endIndex: 1,
      }),
      delete_rows: wrap({
        action: 'delete_rows',
        spreadsheetId,
        sheetId,
        startIndex: 0,
        endIndex: 1,
      }),
      delete_columns: wrap({
        action: 'delete_columns',
        spreadsheetId,
        sheetId,
        startIndex: 0,
        endIndex: 1,
      }),
      move_rows: wrap({
        action: 'move_rows',
        spreadsheetId,
        sheetId,
        startIndex: 0,
        endIndex: 1,
        destinationIndex: 5,
      }),
      move_columns: wrap({
        action: 'move_columns',
        spreadsheetId,
        sheetId,
        startIndex: 0,
        endIndex: 1,
        destinationIndex: 5,
      }),
      resize_rows: wrap({
        action: 'resize_rows',
        spreadsheetId,
        sheetId,
        startIndex: 0,
        endIndex: 1,
        pixelSize: 50,
      }),
      resize_columns: wrap({
        action: 'resize_columns',
        spreadsheetId,
        sheetId,
        startIndex: 0,
        endIndex: 1,
        pixelSize: 150,
      }),
      auto_resize: wrap({
        action: 'auto_resize',
        spreadsheetId,
        sheetId,
        dimension: 'COLUMNS',
        startIndex: 0,
        endIndex: 5,
      }),
      hide_rows: wrap({ action: 'hide_rows', spreadsheetId, sheetId, startIndex: 0, endIndex: 1 }),
      hide_columns: wrap({
        action: 'hide_columns',
        spreadsheetId,
        sheetId,
        startIndex: 0,
        endIndex: 1,
      }),
      show_rows: wrap({ action: 'show_rows', spreadsheetId, sheetId, startIndex: 0, endIndex: 1 }),
      show_columns: wrap({
        action: 'show_columns',
        spreadsheetId,
        sheetId,
        startIndex: 0,
        endIndex: 1,
      }),
      freeze_rows: wrap({ action: 'freeze_rows', spreadsheetId, sheetId, frozenRowCount: 1 }),
      freeze_columns: wrap({
        action: 'freeze_columns',
        spreadsheetId,
        sheetId,
        frozenColumnCount: 1,
      }),
      group_rows: wrap({
        action: 'group_rows',
        spreadsheetId,
        sheetId,
        startIndex: 0,
        endIndex: 5,
      }),
      group_columns: wrap({
        action: 'group_columns',
        spreadsheetId,
        sheetId,
        startIndex: 0,
        endIndex: 5,
      }),
      ungroup_rows: wrap({
        action: 'ungroup_rows',
        spreadsheetId,
        sheetId,
        startIndex: 0,
        endIndex: 5,
      }),
      ungroup_columns: wrap({
        action: 'ungroup_columns',
        spreadsheetId,
        sheetId,
        startIndex: 0,
        endIndex: 5,
      }),
      append_rows: wrap({ action: 'append_rows', spreadsheetId, sheetId, count: 5 }),
      append_columns: wrap({ action: 'append_columns', spreadsheetId, sheetId, count: 5 }),
      set_basic_filter: wrap({ action: 'set_basic_filter', spreadsheetId, sheetId, range }),
      clear_basic_filter: wrap({ action: 'clear_basic_filter', spreadsheetId, sheetId }),
      get_basic_filter: wrap({ action: 'get_basic_filter', spreadsheetId, sheetId }),
      filter_update_filter_criteria: wrap({
        action: 'filter_update_filter_criteria',
        spreadsheetId,
        sheetId,
        columnIndex: 0,
        criteria: { 0: { hiddenValues: ['A'] } },
      }),
      sort_range: wrap({
        action: 'sort_range',
        spreadsheetId,
        range,
        sortSpecs: [{ columnIndex: 0, sortOrder: 'ASCENDING' }],
      }),
      trim_whitespace: wrap({ action: 'trim_whitespace', spreadsheetId, range }),
      randomize_range: wrap({ action: 'randomize_range', spreadsheetId, range }),
      text_to_columns: wrap({
        action: 'text_to_columns',
        spreadsheetId,
        source: 'Sheet1!A:A',
        delimiterType: 'COMMA',
      }),
      auto_fill: wrap({
        action: 'auto_fill',
        spreadsheetId,
        sourceRange: 'Sheet1!A1:A1',
        destinationRange: 'Sheet1!A1:A10',
      }),
      create_filter_view: wrap({
        action: 'create_filter_view',
        spreadsheetId,
        sheetId,
        range,
        title: 'TestFilter',
      }),
      update_filter_view: wrap({
        action: 'update_filter_view',
        spreadsheetId,
        filterViewId: 1,
        title: 'UpdatedFilter',
      }),
      delete_filter_view: wrap({ action: 'delete_filter_view', spreadsheetId, filterViewId: 1 }),
      list_filter_views: wrap({ action: 'list_filter_views', spreadsheetId, sheetId }),
      get_filter_view: wrap({ action: 'get_filter_view', spreadsheetId, filterViewId: 1 }),
      create_slicer: wrap({
        action: 'create_slicer',
        spreadsheetId,
        sheetId,
        dataRange: range,
        filterColumn: 0,
        position: { anchorCell: 'G1' },
      }),
      update_slicer: wrap({
        action: 'update_slicer',
        spreadsheetId,
        slicerId: 1,
        title: 'UpdatedSlicer',
      }),
      delete_slicer: wrap({ action: 'delete_slicer', spreadsheetId, slicerId: 1 }),
      list_slicers: wrap({ action: 'list_slicers', spreadsheetId, sheetId }),
    },

    // ========================================
    // sheets_visualize (16 actions)
    // ========================================
    sheets_visualize: {
      chart_create: wrap({
        action: 'chart_create',
        spreadsheetId,
        sheetId,
        chartType: 'BAR',
        data: { sourceRange: range },
        position: { anchorCell: 'E1' },
      }),
      suggest_chart: wrap({ action: 'suggest_chart', spreadsheetId, range }),
      chart_update: wrap({
        action: 'chart_update',
        spreadsheetId,
        chartId: 1,
        options: { title: 'Updated Chart' },
      }),
      chart_delete: wrap({ action: 'chart_delete', spreadsheetId, chartId: 1 }),
      chart_list: wrap({ action: 'chart_list', spreadsheetId }),
      chart_get: wrap({ action: 'chart_get', spreadsheetId, chartId: 1 }),
      chart_move: wrap({
        action: 'chart_move',
        spreadsheetId,
        chartId: 1,
        position: { anchorCell: 'G1' },
      }),
      chart_resize: wrap({
        action: 'chart_resize',
        spreadsheetId,
        chartId: 1,
        width: 600,
        height: 400,
      }),
      chart_update_data_range: wrap({
        action: 'chart_update_data_range',
        spreadsheetId,
        chartId: 1,
        data: { sourceRange: range },
      }),
      chart_add_trendline: wrap({
        action: 'chart_add_trendline',
        spreadsheetId,
        chartId: 1,
        trendline: { type: 'LINEAR' },
      }),
      chart_remove_trendline: wrap({
        action: 'chart_remove_trendline',
        spreadsheetId,
        chartId: 1,
        seriesIndex: 0,
      }),
      pivot_create: wrap({
        action: 'pivot_create',
        spreadsheetId,
        sourceRange: range,
        values: [{ sourceColumnOffset: 1, summarizeFunction: 'SUM' }],
      }),
      suggest_pivot: wrap({ action: 'suggest_pivot', spreadsheetId, range }),
      pivot_update: wrap({ action: 'pivot_update', spreadsheetId, sheetId }),
      pivot_delete: wrap({ action: 'pivot_delete', spreadsheetId, sheetId }),
      pivot_list: wrap({ action: 'pivot_list', spreadsheetId }),
      pivot_get: wrap({ action: 'pivot_get', spreadsheetId, sheetId }),
      pivot_refresh: wrap({ action: 'pivot_refresh', spreadsheetId, sheetId }),
    },

    // ========================================
    // sheets_collaborate (28 actions)
    // ========================================
    sheets_collaborate: {
      share_add: wrap({
        action: 'share_add',
        spreadsheetId,
        type: 'user',
        role: 'reader',
        emailAddress: 'test@example.com',
      }),
      share_update: wrap({
        action: 'share_update',
        spreadsheetId,
        permissionId: 'perm123',
        role: 'writer',
      }),
      share_remove: wrap({ action: 'share_remove', spreadsheetId, permissionId: 'perm123' }),
      share_list: wrap({ action: 'share_list', spreadsheetId }),
      share_get: wrap({ action: 'share_get', spreadsheetId, permissionId: 'perm123' }),
      share_transfer_ownership: wrap({
        action: 'share_transfer_ownership',
        spreadsheetId,
        newOwnerEmail: 'new@example.com',
      }),
      share_set_link: wrap({
        action: 'share_set_link',
        spreadsheetId,
        enabled: true,
        role: 'reader',
      }),
      share_get_link: wrap({ action: 'share_get_link', spreadsheetId }),
      comment_add: wrap({ action: 'comment_add', spreadsheetId, content: 'Test comment' }),
      comment_update: wrap({
        action: 'comment_update',
        spreadsheetId,
        commentId: 'comment123',
        content: 'Updated',
      }),
      comment_delete: wrap({ action: 'comment_delete', spreadsheetId, commentId: 'comment123' }),
      comment_list: wrap({ action: 'comment_list', spreadsheetId }),
      comment_get: wrap({ action: 'comment_get', spreadsheetId, commentId: 'comment123' }),
      comment_resolve: wrap({ action: 'comment_resolve', spreadsheetId, commentId: 'comment123' }),
      comment_reopen: wrap({ action: 'comment_reopen', spreadsheetId, commentId: 'comment123' }),
      comment_add_reply: wrap({
        action: 'comment_add_reply',
        spreadsheetId,
        commentId: 'comment123',
        content: 'Reply',
      }),
      comment_update_reply: wrap({
        action: 'comment_update_reply',
        spreadsheetId,
        commentId: 'comment123',
        replyId: 'reply123',
        content: 'Updated',
      }),
      comment_delete_reply: wrap({
        action: 'comment_delete_reply',
        spreadsheetId,
        commentId: 'comment123',
        replyId: 'reply123',
      }),
      version_list_revisions: wrap({ action: 'version_list_revisions', spreadsheetId }),
      version_get_revision: wrap({
        action: 'version_get_revision',
        spreadsheetId,
        revisionId: '1',
      }),
      version_restore_revision: wrap({
        action: 'version_restore_revision',
        spreadsheetId,
        revisionId: '1',
      }),
      version_keep_revision: wrap({
        action: 'version_keep_revision',
        spreadsheetId,
        revisionId: '1',
        keepForever: true,
      }),
      version_create_snapshot: wrap({
        action: 'version_create_snapshot',
        spreadsheetId,
        name: 'Test Snapshot',
      }),
      version_list_snapshots: wrap({ action: 'version_list_snapshots', spreadsheetId }),
      version_restore_snapshot: wrap({
        action: 'version_restore_snapshot',
        spreadsheetId,
        snapshotId: 'snap123',
      }),
      version_delete_snapshot: wrap({
        action: 'version_delete_snapshot',
        spreadsheetId,
        snapshotId: 'snap123',
      }),
      version_compare: wrap({
        action: 'version_compare',
        spreadsheetId,
        revisionId1: '1',
        revisionId2: '2',
      }),
      version_export: wrap({ action: 'version_export', spreadsheetId, format: 'xlsx' }),
    },

    // ========================================
    // sheets_advanced (23 actions)
    // ========================================
    sheets_advanced: {
      add_named_range: wrap({ action: 'add_named_range', spreadsheetId, name: 'TestRange', range }),
      update_named_range: wrap({
        action: 'update_named_range',
        spreadsheetId,
        namedRangeId: 'nr123',
        name: 'UpdatedRange',
      }),
      delete_named_range: wrap({
        action: 'delete_named_range',
        spreadsheetId,
        namedRangeId: 'nr123',
      }),
      list_named_ranges: wrap({ action: 'list_named_ranges', spreadsheetId }),
      get_named_range: wrap({ action: 'get_named_range', spreadsheetId, name: 'TestRange' }),
      add_protected_range: wrap({
        action: 'add_protected_range',
        spreadsheetId,
        range,
        description: 'Protected',
      }),
      update_protected_range: wrap({
        action: 'update_protected_range',
        spreadsheetId,
        protectedRangeId: 12345,
        description: 'Updated',
      }),
      delete_protected_range: wrap({
        action: 'delete_protected_range',
        spreadsheetId,
        protectedRangeId: 12345,
      }),
      list_protected_ranges: wrap({ action: 'list_protected_ranges', spreadsheetId }),
      set_metadata: wrap({
        action: 'set_metadata',
        spreadsheetId,
        metadataKey: 'testKey',
        metadataValue: 'testValue',
      }),
      get_metadata: wrap({ action: 'get_metadata', spreadsheetId, metadataKey: 'testKey' }),
      delete_metadata: wrap({ action: 'delete_metadata', spreadsheetId, metadataId: 12345 }),
      add_banding: wrap({ action: 'add_banding', spreadsheetId, range }),
      update_banding: wrap({ action: 'update_banding', spreadsheetId, bandedRangeId: 12345 }),
      delete_banding: wrap({ action: 'delete_banding', spreadsheetId, bandedRangeId: 12345 }),
      list_banding: wrap({ action: 'list_banding', spreadsheetId }),
      create_table: wrap({ action: 'create_table', spreadsheetId, range }),
      delete_table: wrap({ action: 'delete_table', spreadsheetId, tableId: 'table123' }),
      list_tables: wrap({ action: 'list_tables', spreadsheetId }),
      add_person_chip: wrap({
        action: 'add_person_chip',
        spreadsheetId,
        range: 'Sheet1!A1',
        email: 'test@example.com',
      }),
      add_drive_chip: wrap({
        action: 'add_drive_chip',
        spreadsheetId,
        range: 'Sheet1!A1',
        fileId: 'file123',
      }),
      add_rich_link_chip: wrap({
        action: 'add_rich_link_chip',
        spreadsheetId,
        range: 'Sheet1!A1',
        uri: 'https://example.com',
      }),
      list_chips: wrap({ action: 'list_chips', spreadsheetId }),
    },

    // ========================================
    // sheets_transaction (6 actions)
    // ========================================
    sheets_transaction: {
      begin: wrap({ action: 'begin', spreadsheetId }),
      queue: wrap({
        action: 'queue',
        transactionId: 'tx123',
        operation: { tool: 'sheets_data', action: 'write', params: { range: 'A1:B2' } },
      }),
      commit: wrap({ action: 'commit', transactionId: 'tx123' }),
      rollback: wrap({ action: 'rollback', transactionId: 'tx123' }),
      status: wrap({ action: 'status', transactionId: 'tx123' }),
      list: wrap({ action: 'list' }),
    },

    // ========================================
    // sheets_quality (4 actions)
    // ========================================
    sheets_quality: {
      validate: wrap({ action: 'validate', value: 'test-value' }),
      detect_conflicts: wrap({ action: 'detect_conflicts', spreadsheetId }),
      resolve_conflict: wrap({
        action: 'resolve_conflict',
        conflictId: 'conflict123',
        strategy: 'keep_local',
      }),
      analyze_impact: wrap({
        action: 'analyze_impact',
        spreadsheetId,
        operation: {
          type: 'values_write',
          tool: 'sheets_data',
          action: 'write',
          params: { range: 'A1:B2' },
        },
      }),
    },

    // ========================================
    // sheets_history (7 actions)
    // ========================================
    sheets_history: {
      list: wrap({ action: 'list', limit: 10 }),
      get: wrap({ action: 'get', operationId: 'op123' }),
      stats: wrap({ action: 'stats' }),
      undo: wrap({ action: 'undo', spreadsheetId }),
      redo: wrap({ action: 'redo', spreadsheetId }),
      revert_to: wrap({ action: 'revert_to', operationId: 'op123' }),
      clear: wrap({ action: 'clear' }),
    },

    // ========================================
    // sheets_confirm (5 actions)
    // ========================================
    sheets_confirm: {
      request: wrap({
        action: 'request',
        plan: {
          title: 'Test Operation',
          description: 'A test operation for validation',
          steps: [
            {
              stepNumber: 1,
              description: 'Read data from sheet',
              tool: 'sheets_data',
              action: 'read',
              risk: 'low',
            },
          ],
        },
      }),
      get_stats: wrap({ action: 'get_stats' }),
      wizard_start: wrap({
        action: 'wizard_start',
        title: 'Create Spreadsheet Wizard',
        description: 'Step-by-step spreadsheet creation',
        steps: [
          {
            stepId: 'step1',
            title: 'Basic Info',
            description: 'Enter basic information',
            fields: [{ name: 'title', label: 'Title', type: 'text', required: true }],
          },
        ],
      }),
      wizard_step: wrap({
        action: 'wizard_step',
        wizardId: 'wiz123',
        stepId: 'step1',
        values: { title: 'Test' },
      }),
      wizard_complete: wrap({ action: 'wizard_complete', wizardId: 'wiz123' }),
    },

    // ========================================
    // sheets_analyze (11 actions)
    // ========================================
    sheets_analyze: {
      comprehensive: wrap({ action: 'comprehensive', spreadsheetId }),
      analyze_data: wrap({ action: 'analyze_data', spreadsheetId, range }),
      suggest_visualization: wrap({ action: 'suggest_visualization', spreadsheetId, range }),
      generate_formula: wrap({
        action: 'generate_formula',
        spreadsheetId,
        description: 'Sum column A',
      }),
      detect_patterns: wrap({ action: 'detect_patterns', spreadsheetId, range }),
      analyze_structure: wrap({ action: 'analyze_structure', spreadsheetId }),
      analyze_quality: wrap({ action: 'analyze_quality', spreadsheetId }),
      analyze_performance: wrap({ action: 'analyze_performance', spreadsheetId }),
      analyze_formulas: wrap({ action: 'analyze_formulas', spreadsheetId }),
      query_natural_language: wrap({
        action: 'query_natural_language',
        spreadsheetId,
        query: 'What is the total?',
      }),
      explain_analysis: wrap({
        action: 'explain_analysis',
        question: 'Explain the analysis results',
      }),
    },

    // ========================================
    // sheets_fix (1 action)
    // ========================================
    sheets_fix: {
      fix: wrap({
        action: 'fix',
        spreadsheetId,
        issues: [
          { type: 'NO_FROZEN_HEADERS', severity: 'low', description: 'Missing frozen header' },
        ],
        mode: 'preview',
      }),
    },

    // ========================================
    // sheets_composite (7 actions)
    // ========================================
    sheets_composite: {
      import_csv: wrap({ action: 'import_csv', spreadsheetId, csvData: 'A,B\n1,2' }),
      smart_append: wrap({
        action: 'smart_append',
        spreadsheetId,
        sheet: 'Sheet1',
        data: [{ Name: 'New', Value: 'Data' }],
      }),
      bulk_update: wrap({
        action: 'bulk_update',
        spreadsheetId,
        sheet: 'Sheet1',
        keyColumn: 'ID',
        updates: [{ ID: '1', Name: 'Updated' }],
      }),
      deduplicate: wrap({
        action: 'deduplicate',
        spreadsheetId,
        sheet: 'Sheet1',
        keyColumns: ['Name'],
      }),
      export_xlsx: wrap({ action: 'export_xlsx', spreadsheetId }),
      import_xlsx: wrap({
        action: 'import_xlsx',
        fileContent: 'UEsDBBQAAAAIAA==',
        title: 'Imported Workbook',
      }),
      get_form_responses: wrap({ action: 'get_form_responses', spreadsheetId }),
    },

    // ========================================
    // sheets_session (13 actions)
    // ========================================
    sheets_session: {
      set_active: wrap({ action: 'set_active', spreadsheetId, title: 'Test Spreadsheet' }),
      get_active: wrap({ action: 'get_active' }),
      get_context: wrap({ action: 'get_context' }),
      record_operation: wrap({
        action: 'record_operation',
        tool: 'sheets_data',
        toolAction: 'read',
        spreadsheetId,
        description: 'Read data from sheet',
        undoable: false,
      }),
      get_last_operation: wrap({ action: 'get_last_operation' }),
      get_history: wrap({ action: 'get_history', limit: 10 }),
      find_by_reference: wrap({
        action: 'find_by_reference',
        reference: 'the spreadsheet',
        referenceType: 'spreadsheet',
      }),
      update_preferences: wrap({
        action: 'update_preferences',
        preferences: { verbosity: 'minimal' },
      }),
      get_preferences: wrap({ action: 'get_preferences' }),
      set_pending: wrap({
        action: 'set_pending',
        type: 'bulk_operation',
        step: 1,
        totalSteps: 3,
        context: { operation: 'write' },
      }),
      get_pending: wrap({ action: 'get_pending' }),
      clear_pending: wrap({ action: 'clear_pending' }),
      reset: wrap({ action: 'reset' }),
    },

    // ========================================
    // sheets_templates (8 actions) - Tier 7 NEW
    // ========================================
    sheets_templates: {
      list: wrap({ action: 'list' }),
      get: wrap({ action: 'get', templateId: 'template123' }),
      create: wrap({ action: 'create', spreadsheetId, name: 'Test Template' }),
      apply: wrap({ action: 'apply', templateId: 'template123', title: 'New from Template' }),
      update: wrap({ action: 'update', templateId: 'template123', name: 'Updated Template' }),
      delete: wrap({ action: 'delete', templateId: 'template123' }),
      preview: wrap({ action: 'preview', templateId: 'template123' }),
      import_builtin: wrap({ action: 'import_builtin', builtinName: 'budget' }),
    },

    // ========================================
    // sheets_bigquery (14 actions) - Tier 7 NEW
    // ========================================
    sheets_bigquery: {
      connect: wrap({
        action: 'connect',
        spreadsheetId,
        spec: { projectId: 'project123', datasetId: 'dataset123', tableId: 'table123' },
      }),
      connect_looker: wrap({
        action: 'connect_looker',
        spreadsheetId,
        spec: {
          instanceUri: 'https://looker.example.com',
          model: 'my_model',
          explore: 'my_explore',
        },
      }),
      disconnect: wrap({ action: 'disconnect', spreadsheetId, dataSourceId: 'ds123' }),
      list_connections: wrap({ action: 'list_connections', spreadsheetId }),
      get_connection: wrap({ action: 'get_connection', spreadsheetId, dataSourceId: 'ds123' }),
      query: wrap({
        action: 'query',
        spreadsheetId,
        projectId: 'project123',
        query: 'SELECT * FROM table LIMIT 10',
      }),
      preview: wrap({ action: 'preview', projectId: 'project123', query: 'SELECT 1' }),
      refresh: wrap({ action: 'refresh', spreadsheetId, dataSourceId: 'ds123' }),
      cancel_refresh: wrap({ action: 'cancel_refresh', spreadsheetId, dataSourceId: 'ds123' }),
      list_datasets: wrap({ action: 'list_datasets', projectId: 'project123' }),
      list_tables: wrap({
        action: 'list_tables',
        projectId: 'project123',
        datasetId: 'dataset123',
      }),
      get_table_schema: wrap({
        action: 'get_table_schema',
        projectId: 'project123',
        datasetId: 'dataset123',
        tableId: 'table123',
      }),
      export_to_bigquery: wrap({
        action: 'export_to_bigquery',
        spreadsheetId,
        range,
        destination: { projectId: 'project123', datasetId: 'dataset123', tableId: 'table123' },
      }),
      import_from_bigquery: wrap({
        action: 'import_from_bigquery',
        spreadsheetId,
        projectId: 'project123',
        query: 'SELECT * FROM dataset123.table123 LIMIT 100',
      }),
    },

    // ========================================
    // sheets_appsscript (14 actions) - Tier 7 NEW
    // ========================================
    sheets_appsscript: {
      create: wrap({ action: 'create', spreadsheetId, title: 'Test Script' }),
      get: wrap({ action: 'get', scriptId: 'script123' }),
      get_content: wrap({ action: 'get_content', scriptId: 'script123' }),
      update_content: wrap({
        action: 'update_content',
        scriptId: 'script123',
        files: [{ name: 'Code', type: 'SERVER_JS', source: 'function test() {}' }],
      }),
      create_version: wrap({
        action: 'create_version',
        scriptId: 'script123',
        description: 'v1.0',
      }),
      list_versions: wrap({ action: 'list_versions', scriptId: 'script123' }),
      get_version: wrap({ action: 'get_version', scriptId: 'script123', versionNumber: 1 }),
      deploy: wrap({
        action: 'deploy',
        scriptId: 'script123',
        versionNumber: 1,
        description: 'Deployment v1',
      }),
      list_deployments: wrap({ action: 'list_deployments', scriptId: 'script123' }),
      get_deployment: wrap({
        action: 'get_deployment',
        scriptId: 'script123',
        deploymentId: 'deploy123',
      }),
      undeploy: wrap({ action: 'undeploy', scriptId: 'script123', deploymentId: 'deploy123' }),
      run: wrap({ action: 'run', scriptId: 'script123', functionName: 'test' }),
      list_processes: wrap({ action: 'list_processes', scriptId: 'script123' }),
      get_metrics: wrap({ action: 'get_metrics', scriptId: 'script123' }),
    },
  };

  const toolArgs = baseArgs[toolName];
  if (!toolArgs) {
    // Unknown tool - return minimal args wrapped in request
    return wrap({ action });
  }

  // Return specific args or fallback with action wrapped in request
  return toolArgs[action] || wrap({ action });
}

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

function parseArgs(): void {
  const args = process.argv.slice(2);

  for (const arg of args) {
    if (arg.startsWith('--tool=')) {
      CONFIG.filterTool = arg.split('=')[1];
    } else if (arg === '--verbose' || arg === '-v') {
      CONFIG.verbose = true;
    } else if (arg === '--debug' || arg === '-d') {
      CONFIG.debug = true;
      CONFIG.verbose = true;
    } else if (arg.startsWith('--log-file=')) {
      CONFIG.logFile = arg.split('=')[1];
    } else if (arg.startsWith('--timeout=')) {
      CONFIG.requestTimeoutMs = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--output=')) {
      CONFIG.outputDir = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }
}

function printHelp(): void {
  console.log(`
ServalSheets Comprehensive MCP Tool Tester v3.0

Usage:
  npm run build && node dist/scripts/test-all-actions-comprehensive.js [options]

Options:
  --tool=<name>      Test only the specified tool (e.g., --tool=sheets_core)
  --verbose, -v      Show detailed output for each test
  --debug, -d        Enable debug mode with full request/response logging
  --log-file=<path>  Write logs to specified file
  --timeout=<ms>     Set request timeout in milliseconds (default: 10000)
  --output=<dir>     Set output directory for reports (default: current dir)
  --help, -h         Show this help message

Output Files:
  test-results-comprehensive.json  Full test results with all details
  test-errors.log                  Human-readable error log
  test-errors.csv                  CSV export for spreadsheet analysis
  test-performance.json            Performance metrics by action

Examples:
  # Run all tests
  node dist/scripts/test-all-actions-comprehensive.js

  # Test only sheets_core with debug logging
  node dist/scripts/test-all-actions-comprehensive.js --tool=sheets_core --debug

  # Run with custom timeout and log file
  node dist/scripts/test-all-actions-comprehensive.js --timeout=30000 --log-file=debug.log
`);
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runComprehensiveTests() {
  // Parse CLI args
  parseArgs();

  // Initialize logger
  logger = new Logger({
    level: CONFIG.debug ? 'DEBUG' : CONFIG.verbose ? 'INFO' : 'WARN',
    console: true,
    file: CONFIG.logFile || (CONFIG.debug ? 'test-debug.log' : null),
    timestamps: true,
  });

  console.log('🧪 ServalSheets Comprehensive MCP Tool Tester v3.0');
  console.log('='.repeat(60));

  // Log configuration
  logger.info('Test configuration:', {
    filterTool: CONFIG.filterTool || 'ALL',
    verbose: CONFIG.verbose,
    debug: CONFIG.debug,
    timeout: CONFIG.requestTimeoutMs,
    logFile: CONFIG.logFile,
  });

  // Count total actions
  let totalActions = 0;
  for (const actions of Object.values(TOOL_ACTIONS)) {
    totalActions += actions.length;
  }
  console.log(
    `📊 Testing ${totalActions} actions across ${Object.keys(TOOL_ACTIONS).length} tools\n`
  );

  if (CONFIG.filterTool) {
    console.log(`🔍 Filtering to tool: ${CONFIG.filterTool}\n`);
  }

  const child = spawn('node', ['dist/cli.js', '--stdio'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'development',
      OAUTH_AUTO_OPEN_BROWSER: 'false',
      OAUTH_USE_CALLBACK_SERVER: 'false', // Disable callback server in test mode
      LOG_LEVEL: CONFIG.debug ? 'debug' : 'warn',
    },
  });

  const client = createJsonRpcClient(child);

  const testStartTime = Date.now();

  try {
    // Initialize
    logger.info('Starting MCP server...');
    console.log('🚀 Starting MCP server...');

    const { response: initResponse } = await client.send('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: {
        name: 'comprehensive-test-client',
        version: '3.0.0',
      },
    });

    if (initResponse.error) {
      logger.error('Server initialization failed:', initResponse.error);
      throw new Error(`Server initialization failed: ${initResponse.error.message}`);
    }

    logger.info('Server initialized successfully');
    console.log('✅ Server initialized\n');

    // Test all actions for each tool
    const tools = CONFIG.filterTool ? [CONFIG.filterTool] : Object.keys(TOOL_ACTIONS);

    for (const toolName of tools) {
      const actions = TOOL_ACTIONS[toolName];
      if (!actions) {
        logger.warn(`Unknown tool: ${toolName}`);
        console.log(`⚠️  Unknown tool: ${toolName}`);
        continue;
      }

      console.log(`\n📦 ${toolName} (${actions.length} actions)`);
      console.log('-'.repeat(40));
      logger.info(`Testing tool: ${toolName} (${actions.length} actions)`);

      for (const action of actions) {
        const testArgs = getTestArgs(toolName, action);
        const result = await testAction(client, toolName, action, testArgs);
        results.push(result);

        const icon =
          result.status === 'pass'
            ? '✅'
            : result.status === 'auth_required'
              ? '🔐'
              : result.status === 'validation_error'
                ? '⚠️'
                : result.status === 'api_error'
                  ? '🌐'
                  : result.status === 'timeout'
                    ? '⏱️'
                    : result.status === 'crash'
                      ? '💥'
                      : '❌';

        const msg = result.message.substring(0, 50);
        console.log(`  ${icon} ${action} (${result.duration}ms) - ${msg}`);

        if (CONFIG.verbose && result.error) {
          console.log(`      Error: ${result.error.substring(0, 100)}...`);
        }

        if (CONFIG.debug && result.errorCode) {
          console.log(`      Code: ${result.errorCode}`);
        }
      }
    }

    const totalDuration = Date.now() - testStartTime;
    logger.info(`All tests completed in ${totalDuration}ms`);

    // Generate all reports
    const criticalCount = generateReport();
    generateErrorLog();
    generateCSVReport();
    generatePerformanceReport();

    console.log('\n' + '='.repeat(60));
    console.log('📁 GENERATED FILES');
    console.log('='.repeat(60));
    console.log(`  📄 test-results-comprehensive.json - Full test results`);
    console.log(`  📝 test-errors.log - Human-readable error log`);
    console.log(`  📊 test-errors.csv - CSV export for analysis`);
    console.log(`  ⏱️  test-performance.json - Performance metrics`);
    if (CONFIG.logFile || CONFIG.debug) {
      console.log(`  🔍 ${CONFIG.logFile || 'test-debug.log'} - Debug log`);
    }
    console.log('='.repeat(60) + '\n');

    // Exit code - fail if any critical issues
    if (criticalCount > 0) {
      console.log('❌ TESTS FAILED: Critical issues detected (timeout/crash)');
      console.log('   These are like Issue #1 (copy hang) and require investigation.');
      process.exit(1);
    } else {
      console.log('✅ All tests completed (no critical issues)');
      process.exit(0);
    }
  } finally {
    child.kill();
    logger.info('MCP server process terminated');
  }
}

// ============================================================================
// REPORT GENERATORS
// ============================================================================

function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60) + '\n');

  // Count by status
  const counts: Record<ResultStatus, number> = {
    pass: 0,
    fail: 0,
    skip: 0,
    auth_required: 0,
    validation_error: 0,
    api_error: 0,
    timeout: 0,
    crash: 0,
  };

  for (const r of results) {
    counts[r.status]++;
  }

  console.log(`✅ Pass:             ${counts.pass}`);
  console.log(`🔐 Auth Required:    ${counts.auth_required}`);
  console.log(`⚠️  Validation Error: ${counts.validation_error}`);
  console.log(`🌐 API Error:        ${counts.api_error}`);
  console.log(`⏱️  Timeout:          ${counts.timeout}`);
  console.log(`💥 Crash:            ${counts.crash}`);
  console.log(`❌ Fail:             ${counts.fail}`);
  console.log(`⏭️  Skipped:          ${counts.skip}`);
  console.log(`📦 Total:            ${results.length}\n`);

  // CRITICAL ISSUES (timeout or crash) - These are like Issue #1
  const critical = results.filter((r) => r.status === 'timeout' || r.status === 'crash');
  if (critical.length > 0) {
    console.log('🚨 CRITICAL ISSUES (require immediate investigation):');
    console.log('-'.repeat(60));
    for (const r of critical) {
      console.log(`  • ${r.tool}.${r.action}: ${r.status.toUpperCase()}`);
      console.log(`    ${r.message}`);
      if (r.errorCode) {
        console.log(`    Code: ${r.errorCode}`);
      }
      if (r.error) {
        console.log(`    Error: ${r.error.substring(0, 150)}...`);
      }
    }
    console.log();
  }

  // Error code summary
  if (errorsByCode.size > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 ERROR CODES SUMMARY');
    console.log('='.repeat(60) + '\n');

    const sortedErrors = [...errorsByCode.values()].sort((a, b) => b.count - a.count);
    for (const err of sortedErrors) {
      console.log(`  ${err.errorCode}: ${err.count} occurrences`);
      console.log(
        `    Tools: ${err.tools.slice(0, 5).join(', ')}${err.tools.length > 5 ? '...' : ''}`
      );
      console.log(`    Sample: ${err.sampleMessage.substring(0, 80)}`);
      console.log();
    }
  }

  // Show failures in detail
  const failures = results.filter((r) => r.status === 'fail');
  if (failures.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ FAILURES (' + failures.length + ')');
    console.log('='.repeat(60) + '\n');

    failures.forEach((f) => {
      console.log(`Tool:      ${f.tool}`);
      console.log(`Action:    ${f.action}`);
      console.log(`ErrorCode: ${f.errorCode || 'N/A'}`);
      console.log(`Message:   ${f.message}`);
      if (f.error) {
        console.log(`Error:     ${f.error.substring(0, 300)}${f.error.length > 300 ? '...' : ''}`);
      }
      console.log('');
    });
  }

  // Tool coverage visualization
  console.log('\n' + '='.repeat(60));
  console.log('📈 TOOL COVERAGE');
  console.log('='.repeat(60) + '\n');

  const toolStats: Record<string, { total: number; pass: number; auth: number; other: number }> =
    {};
  for (const r of results) {
    if (!toolStats[r.tool]) {
      toolStats[r.tool] = { total: 0, pass: 0, auth: 0, other: 0 };
    }
    toolStats[r.tool].total++;
    if (r.status === 'pass') toolStats[r.tool].pass++;
    else if (r.status === 'auth_required') toolStats[r.tool].auth++;
    else toolStats[r.tool].other++;
  }

  for (const [tool, stats] of Object.entries(toolStats)) {
    const pct = Math.round(((stats.pass + stats.auth) / stats.total) * 100);
    const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
    console.log(`${tool.padEnd(20)} ${bar} ${pct}%`);
    console.log(
      `${''.padEnd(20)} (${stats.pass}✅ ${stats.auth}🔐 ${stats.other}❌ / ${stats.total})`
    );
  }

  // Write detailed JSON report
  const reportData = {
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    config: {
      filterTool: CONFIG.filterTool,
      timeout: CONFIG.requestTimeoutMs,
      debug: CONFIG.debug,
    },
    summary: {
      total: results.length,
      ...counts,
      criticalIssues: critical.length,
      uniqueErrorCodes: errorsByCode.size,
      successRate: (((counts.pass + counts.auth_required) / results.length) * 100).toFixed(2) + '%',
    },
    errorCodeSummary: [...errorsByCode.values()],
    critical: critical.map((c) => ({
      tool: c.tool,
      action: c.action,
      status: c.status,
      errorCode: c.errorCode,
      message: c.message,
      error: c.error,
      errorStack: c.errorStack,
    })),
    toolStats,
    results,
  };

  const reportPath = `${CONFIG.outputDir}/test-results-comprehensive.json`;
  writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`\n📄 Detailed report written to: ${reportPath}`);

  // Return critical count for exit code decision
  return critical.length;
}

/**
 * Generate detailed error log file for debugging
 */
function generateErrorLog(): void {
  const errorResults = results.filter((r) => r.status !== 'pass' && r.status !== 'auth_required');

  if (errorResults.length === 0) {
    logger.info('No errors to log');
    return;
  }

  const logPath = `${CONFIG.outputDir}/test-errors.log`;
  let content = `ServalSheets Test Error Log
Generated: ${new Date().toISOString()}
Total Errors: ${errorResults.length}
${'='.repeat(80)}

`;

  // Group by error code
  const byCode = new Map<string, TestResult[]>();
  for (const r of errorResults) {
    const code = r.errorCode || 'UNKNOWN';
    const list = byCode.get(code) || [];
    list.push(r);
    byCode.set(code, list);
  }

  for (const [code, errs] of byCode) {
    content += `\n${'='.repeat(80)}\n`;
    content += `ERROR CODE: ${code} (${errs.length} occurrences)\n`;
    content += `${'='.repeat(80)}\n\n`;

    for (const err of errs) {
      content += `Tool:      ${err.tool}\n`;
      content += `Action:    ${err.action}\n`;
      content += `Status:    ${err.status}\n`;
      content += `Timestamp: ${err.timestamp}\n`;
      content += `Duration:  ${err.duration}ms\n`;
      content += `Message:   ${err.message}\n`;
      if (err.error) {
        content += `Error:\n${err.error}\n`;
      }
      if (err.errorStack) {
        content += `Stack:\n${err.errorStack}\n`;
      }
      if (CONFIG.debug && err.requestPayload) {
        content += `Request:\n${JSON.stringify(err.requestPayload, null, 2)}\n`;
      }
      if (CONFIG.debug && err.responsePayload) {
        content += `Response:\n${JSON.stringify(err.responsePayload, null, 2)}\n`;
      }
      content += `${'-'.repeat(40)}\n\n`;
    }
  }

  writeFileSync(logPath, content);
  console.log(`📝 Error log written to: ${logPath}`);
  logger.info(`Error log written to: ${logPath}`);
}

/**
 * Generate CSV report for spreadsheet analysis
 */
function generateCSVReport(): void {
  const csvPath = `${CONFIG.outputDir}/test-errors.csv`;

  // CSV header
  const headers = [
    'tool',
    'action',
    'status',
    'errorCode',
    'message',
    'duration_ms',
    'timestamp',
    'error_preview',
  ];

  const rows: string[][] = [headers];

  // Add all results (or just errors based on config)
  const toExport = CONFIG.debug ? results : results.filter((r) => r.status !== 'pass');

  for (const r of toExport) {
    rows.push([
      r.tool,
      r.action,
      r.status,
      r.errorCode || '',
      `"${(r.message || '').replace(/"/g, '""')}"`,
      String(r.duration || 0),
      r.timestamp,
      `"${(r.error || '').substring(0, 200).replace(/"/g, '""').replace(/\n/g, ' ')}"`,
    ]);
  }

  const csvContent = rows.map((row) => row.join(',')).join('\n');
  writeFileSync(csvPath, csvContent);
  console.log(`📊 CSV report written to: ${csvPath}`);
  logger.info(`CSV report written to: ${csvPath}`);
}

/**
 * Generate performance metrics report
 */
function generatePerformanceReport(): void {
  const perfPath = `${CONFIG.outputDir}/test-performance.json`;

  // Calculate statistics per tool
  const toolPerf: Record<
    string,
    {
      total: number;
      min: number;
      max: number;
      avg: number;
      p50: number;
      p95: number;
      p99: number;
      durations: number[];
    }
  > = {};

  for (const m of performanceMetrics) {
    if (!toolPerf[m.tool]) {
      toolPerf[m.tool] = {
        total: 0,
        min: Infinity,
        max: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        durations: [],
      };
    }
    const tp = toolPerf[m.tool];
    tp.total++;
    tp.durations.push(m.duration);
    if (m.duration < tp.min) tp.min = m.duration;
    if (m.duration > tp.max) tp.max = m.duration;
  }

  // Calculate percentiles
  for (const tp of Object.values(toolPerf)) {
    tp.durations.sort((a, b) => a - b);
    const len = tp.durations.length;
    tp.avg = tp.durations.reduce((a, b) => a + b, 0) / len;
    tp.p50 = tp.durations[Math.floor(len * 0.5)] || 0;
    tp.p95 = tp.durations[Math.floor(len * 0.95)] || 0;
    tp.p99 = tp.durations[Math.floor(len * 0.99)] || 0;
  }

  // Clean up durations array for JSON output
  const cleanToolPerf: Record<string, Omit<(typeof toolPerf)[string], 'durations'>> = {};
  for (const [tool, perf] of Object.entries(toolPerf)) {
    const { durations: _, ...rest } = perf;
    cleanToolPerf[tool] = rest;
  }

  // Find slowest actions
  const slowest = [...performanceMetrics]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 20)
    .map((m) => ({
      tool: m.tool,
      action: m.action,
      duration: m.duration,
      status: m.status,
    }));

  // Find timeout-prone actions (close to timeout)
  const timeoutThreshold = CONFIG.requestTimeoutMs * 0.8;
  const nearTimeout = performanceMetrics
    .filter((m) => m.duration > timeoutThreshold && m.status !== 'timeout')
    .map((m) => ({
      tool: m.tool,
      action: m.action,
      duration: m.duration,
      percentOfTimeout: Math.round((m.duration / CONFIG.requestTimeoutMs) * 100),
    }));

  const perfReport = {
    timestamp: new Date().toISOString(),
    config: {
      timeout: CONFIG.requestTimeoutMs,
    },
    overall: {
      totalTests: performanceMetrics.length,
      avgDuration:
        performanceMetrics.reduce((a, m) => a + m.duration, 0) / performanceMetrics.length,
      minDuration: Math.min(...performanceMetrics.map((m) => m.duration)),
      maxDuration: Math.max(...performanceMetrics.map((m) => m.duration)),
    },
    byTool: cleanToolPerf,
    slowestActions: slowest,
    nearTimeout,
  };

  writeFileSync(perfPath, JSON.stringify(perfReport, null, 2));
  console.log(`⏱️  Performance report written to: ${perfPath}`);
  logger.info(`Performance report written to: ${perfPath}`);
}

runComprehensiveTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
