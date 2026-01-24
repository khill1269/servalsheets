#!/usr/bin/env npx tsx
/**
 * ServalSheets Live Monitor v2.1
 *
 * Real-time monitoring, analysis, and debugging of MCP tool calls in Claude Desktop.
 *
 * Features:
 * - Real-time tool call tracking with request/response payloads
 * - Error pattern detection and categorization
 * - Performance metrics and slow query detection
 * - Spreadsheet access tracking
 * - Export to JSON for later analysis
 * - Validation error hot spot insights
 * - 🆕 Anomaly detection with real-time alerts (error rate spikes)
 * - 🆕 Silence detection (no activity warnings)
 *
 * Usage:
 *   npx tsx scripts/live-monitor.ts              # Live follow mode
 *   npx tsx scripts/live-monitor.ts --errors     # Errors only
 *   npx tsx scripts/live-monitor.ts --stats      # Stats from existing log
 *   npx tsx scripts/live-monitor.ts --verbose    # Show full payloads
 *   npx tsx scripts/live-monitor.ts --export     # Export to JSON file
 *   npx tsx scripts/live-monitor.ts --slow 2000  # Highlight calls > 2000ms
 */

import { spawn } from 'child_process';
import * as readline from 'readline';
import { createReadStream, existsSync, writeFileSync } from 'fs';

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

// Error categories for pattern detection
const ERROR_CATEGORIES = {
  VALIDATION: /invalid_type|invalid_value|invalid_union|required|missing/i,
  NOT_FOUND: /not found|does not exist|no.*with id/i,
  AUTH: /unauthorized|forbidden|auth|token|credential|permission/i,
  RATE_LIMIT: /rate limit|quota|too many requests/i,
  TIMEOUT: /timeout|cancelled|timed out/i,
  API: /request failed|status code|api error/i,
  SCHEMA: /schema|expected.*received|invalid input/i,
};

// Stats tracking
interface CallRecord {
  id: number | string;
  tool: string;
  action: string;
  timestamp: string;
  duration?: number;
  success?: boolean;
  error?: string;
  errorCategory?: string;
  spreadsheetId?: string;
  request?: unknown;
  response?: unknown;
}

const stats = {
  totalMessages: 0,
  toolCalls: 0,
  responses: 0,
  errors: 0,
  cancellations: 0,
  byTool: new Map<string, { calls: number; errors: number; totalMs: number; slowCalls: number }>(),
  byAction: new Map<string, { calls: number; errors: number; totalMs: number }>(),
  bySpreadsheet: new Map<string, { calls: number; errors: number }>(),
  byErrorCategory: new Map<string, number>(),
  errorDetails: [] as CallRecord[],
  allCalls: [] as CallRecord[],
  slowCalls: [] as CallRecord[],
  validationErrors: new Map<string, number>(), // Track which fields cause validation errors
  startTime: Date.now(),
};

// Anomaly Detection - Rolling window tracking
const anomalyDetection = {
  windowSize: 20, // Track last N calls
  recentCalls: [] as { timestamp: number; success: boolean; tool: string }[],
  baselineErrorRate: 0.15, // 15% baseline error rate
  alertThreshold: 2.0, // Alert if error rate is 2x baseline
  lastAlertTime: 0,
  alertCooldown: 30000, // Don't alert more than once per 30 seconds

  addCall(success: boolean, tool: string): void {
    this.recentCalls.push({ timestamp: Date.now(), success, tool });
    if (this.recentCalls.length > this.windowSize) {
      this.recentCalls.shift();
    }
    this.checkForAnomaly();
  },

  getCurrentErrorRate(): number {
    if (this.recentCalls.length < 5) return 0;
    const errors = this.recentCalls.filter(c => !c.success).length;
    return errors / this.recentCalls.length;
  },

  checkForAnomaly(): void {
    if (this.recentCalls.length < 10) return; // Need enough data

    const currentRate = this.getCurrentErrorRate();
    const now = Date.now();

    // Check for error spike
    if (currentRate > this.baselineErrorRate * this.alertThreshold) {
      if (now - this.lastAlertTime > this.alertCooldown) {
        this.lastAlertTime = now;
        const failingTools = this.getFailingTools();
        console.log(`\n${c.bgRed}${c.white}${c.bright} ⚠️  ANOMALY DETECTED ${c.reset}`);
        console.log(`${c.red}  Error rate spike: ${(currentRate * 100).toFixed(0)}% (baseline: ${(this.baselineErrorRate * 100).toFixed(0)}%)${c.reset}`);
        if (failingTools.length > 0) {
          console.log(`${c.yellow}  Affected tools: ${failingTools.join(', ')}${c.reset}`);
        }
        console.log('');
      }
    }

    // Check for sudden silence (possible crash/hang)
    const oldestCall = this.recentCalls[0];
    if (oldestCall && now - oldestCall.timestamp > 60000 && this.recentCalls.length === this.windowSize) {
      // All calls are older than 1 minute - possible stall
      if (now - this.lastAlertTime > this.alertCooldown) {
        this.lastAlertTime = now;
        console.log(`\n${c.bgYellow}${c.white}${c.bright} ⏸️  NO RECENT ACTIVITY ${c.reset}`);
        console.log(`${c.yellow}  No tool calls in the last minute${c.reset}\n`);
      }
    }
  },

  getFailingTools(): string[] {
    const toolErrors = new Map<string, number>();
    const toolCalls = new Map<string, number>();

    for (const call of this.recentCalls) {
      toolCalls.set(call.tool, (toolCalls.get(call.tool) || 0) + 1);
      if (!call.success) {
        toolErrors.set(call.tool, (toolErrors.get(call.tool) || 0) + 1);
      }
    }

    const failing: string[] = [];
    for (const [tool, errors] of toolErrors) {
      const calls = toolCalls.get(tool) || 1;
      if (errors / calls > 0.3) { // >30% error rate for this tool
        failing.push(`${tool}(${((errors / calls) * 100).toFixed(0)}%)`);
      }
    }
    return failing;
  }
};

const LOG_FILE = `${process.env['HOME']}/Library/Logs/Claude/mcp-server-ServalSheets.log`;

// Args
const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const errorsOnly = args.includes('--errors');
const statsOnly = args.includes('--stats');
const verboseMode = args.includes('--verbose');
const exportMode = args.includes('--export');
const slowThresholdIdx = args.indexOf('--slow');
const slowThreshold = slowThresholdIdx >= 0 ? parseInt(args[slowThresholdIdx + 1] || '3000') : 3000;

function formatTime(ts: string | number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function categorizeError(error: string): string {
  for (const [category, pattern] of Object.entries(ERROR_CATEGORIES)) {
    if (pattern.test(error)) return category;
  }
  return 'OTHER';
}

function extractValidationPaths(error: string): string[] {
  const paths: string[] = [];
  try {
    const parsed = JSON.parse(error);
    if (Array.isArray(parsed)) {
      for (const issue of parsed) {
        if (issue.path) {
          paths.push(issue.path.join('.'));
        }
      }
    }
  } catch {
    // Not JSON, try regex
    const pathMatches = error.matchAll(/path['":\s]+\[([^\]]+)\]/g);
    for (const match of pathMatches) {
      paths.push(match[1].replace(/['"]/g, '').replace(/,\s*/g, '.'));
    }
  }
  return paths;
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.substring(0, len - 3) + '...';
}

interface JsonRpcMessage {
  jsonrpc: string;
  method?: string;
  id?: number | string;
  params?: {
    name?: string;
    arguments?: {
      request?: {
        action?: string;
        spreadsheetId?: string;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
    requestId?: number;
    reason?: string;
    [key: string]: unknown;
  };
  result?: {
    content?: Array<{
      type: string;
      text?: string;
    }>;
    [key: string]: unknown;
  };
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Track pending calls
const pendingCalls = new Map<number | string, {
  tool: string;
  action: string;
  time: number;
  timestamp: string;
  spreadsheetId?: string;
  request?: unknown;
}>();

function parseLogLine(line: string): CallRecord | null {
  const match = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+\[[sS]erval[sS]heets\]\s+\[\w+\]\s+Message from (client|server): (\{.+\})\s+\{/);

  if (!match) return null;

  const timestamp = match[1];
  const direction = match[2];
  const jsonStr = match[3];

  let msg: JsonRpcMessage;
  try {
    msg = JSON.parse(jsonStr) as JsonRpcMessage;
  } catch {
    return null;
  }

  stats.totalMessages++;

  // Handle tool call (client -> server)
  if (direction === 'client' && msg.method === 'tools/call') {
    const tool = msg.params?.name || 'unknown';
    const action = msg.params?.arguments?.request?.action || 'unknown';
    const spreadsheetId = msg.params?.arguments?.request?.spreadsheetId;
    const id = msg.id;

    if (id !== undefined) {
      pendingCalls.set(id, {
        tool,
        action,
        time: Date.now(),
        timestamp,
        spreadsheetId,
        request: msg.params?.arguments?.request,
      });
    }

    stats.toolCalls++;

    // Track by tool
    if (!stats.byTool.has(tool)) {
      stats.byTool.set(tool, { calls: 0, errors: 0, totalMs: 0, slowCalls: 0 });
    }
    stats.byTool.get(tool)!.calls++;

    // Track by action
    const actionKey = `${tool}.${action}`;
    if (!stats.byAction.has(actionKey)) {
      stats.byAction.set(actionKey, { calls: 0, errors: 0, totalMs: 0 });
    }
    stats.byAction.get(actionKey)!.calls++;

    // Track by spreadsheet
    if (spreadsheetId) {
      if (!stats.bySpreadsheet.has(spreadsheetId)) {
        stats.bySpreadsheet.set(spreadsheetId, { calls: 0, errors: 0 });
      }
      stats.bySpreadsheet.get(spreadsheetId)!.calls++;
    }

    return {
      id: id!,
      tool,
      action,
      timestamp,
      spreadsheetId,
      request: verboseMode ? msg.params?.arguments?.request : undefined,
    };
  }

  // Handle response (server -> client)
  if (direction === 'server' && msg.id !== undefined && msg.result) {
    const id = msg.id;
    const pending = pendingCalls.get(id);
    let duration: number | undefined;
    let tool = pending?.tool || 'unknown';
    let action = pending?.action || 'unknown';
    let spreadsheetId = pending?.spreadsheetId;

    if (pending) {
      duration = Date.now() - pending.time;
      pendingCalls.delete(id);

      // Update tool stats
      const toolStats = stats.byTool.get(tool);
      if (toolStats && duration) {
        toolStats.totalMs += duration;
        if (duration > slowThreshold) {
          toolStats.slowCalls++;
        }
      }

      // Update action stats
      const actionKey = `${tool}.${action}`;
      const actionStats = stats.byAction.get(actionKey);
      if (actionStats && duration) {
        actionStats.totalMs += duration;
      }
    }

    stats.responses++;

    // Parse response content
    let success = true;
    let error: string | undefined;
    let errorCategory: string | undefined;
    let responseData: unknown;

    const content = msg.result.content?.[0];
    if (content?.type === 'text' && content.text) {
      try {
        responseData = JSON.parse(content.text);
        const typedResponse = responseData as { response?: { success?: boolean; error?: { message?: string; code?: string } } };
        if (typedResponse.response?.success === false) {
          success = false;
          error = typedResponse.response.error?.message || typedResponse.response.error?.code || 'Unknown error';
          errorCategory = categorizeError(error);
          stats.errors++;

          // Update error stats
          stats.byErrorCategory.set(errorCategory, (stats.byErrorCategory.get(errorCategory) || 0) + 1);

          const toolStats = stats.byTool.get(tool);
          if (toolStats) toolStats.errors++;

          const actionKey = `${tool}.${action}`;
          const actionStats = stats.byAction.get(actionKey);
          if (actionStats) actionStats.errors++;

          if (spreadsheetId) {
            const ssStats = stats.bySpreadsheet.get(spreadsheetId);
            if (ssStats) ssStats.errors++;
          }

          // Track validation error paths
          if (errorCategory === 'VALIDATION' || errorCategory === 'SCHEMA') {
            const paths = extractValidationPaths(error);
            for (const path of paths) {
              const pathKey = `${tool}.${action}:${path}`;
              stats.validationErrors.set(pathKey, (stats.validationErrors.get(pathKey) || 0) + 1);
            }
          }
        }
      } catch {
        // Not JSON
      }
    }

    const record: CallRecord = {
      id,
      tool,
      action,
      timestamp,
      duration,
      success,
      error,
      errorCategory,
      spreadsheetId,
      request: pending?.request,
      response: verboseMode ? responseData : undefined,
    };

    stats.allCalls.push(record);

    // Feed anomaly detection
    anomalyDetection.addCall(success, tool);

    if (!success) {
      stats.errorDetails.push(record);
    }

    if (duration && duration > slowThreshold) {
      stats.slowCalls.push(record);
    }

    return record;
  }

  // Handle cancellation
  if (msg.method === 'notifications/cancelled') {
    stats.cancellations++;
    const requestId = msg.params?.requestId;
    const pending = requestId !== undefined ? pendingCalls.get(requestId) : undefined;

    return {
      id: requestId || 0,
      tool: pending?.tool || 'unknown',
      action: pending?.action || 'unknown',
      timestamp,
      success: false,
      error: 'Request cancelled',
      errorCategory: 'TIMEOUT',
    };
  }

  return null;
}

function formatCall(record: CallRecord): string {
  const ts = `${c.dim}[${formatTime(record.timestamp)}]${c.reset}`;

  // Determine if this is a call or response
  if (record.duration === undefined && record.success === undefined) {
    // This is a call
    let line = `${ts} ${c.cyan}→${c.reset} ${c.magenta}${record.tool}${c.reset}.${c.bright}${record.action}${c.reset}`;
    if (record.spreadsheetId) {
      line += ` ${c.dim}[${record.spreadsheetId.substring(0, 12)}...]${c.reset}`;
    }
    if (verboseMode && record.request) {
      line += `\n    ${c.dim}Request: ${truncate(JSON.stringify(record.request), 200)}${c.reset}`;
    }
    return line;
  }

  // This is a response
  const statusIcon = record.success ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
  const durationColor = record.duration && record.duration > slowThreshold ? c.red :
                        record.duration && record.duration > 1000 ? c.yellow : c.green;
  const durationStr = record.duration ? ` ${durationColor}(${formatDuration(record.duration)})${c.reset}` : '';

  let line = `${ts} ${c.yellow}←${c.reset} ${statusIcon} ${c.magenta}${record.tool}${c.reset}.${c.bright}${record.action}${c.reset}${durationStr}`;

  if (record.errorCategory) {
    line += ` ${c.bgRed}${c.white} ${record.errorCategory} ${c.reset}`;
  }

  if (record.error) {
    const errorTrunc = truncate(record.error.replace(/\n/g, ' '), 100);
    line += `\n    ${c.red}└─ ${errorTrunc}${c.reset}`;
  }

  if (verboseMode && record.response) {
    line += `\n    ${c.dim}Response: ${truncate(JSON.stringify(record.response), 200)}${c.reset}`;
  }

  return line;
}

function printHeader(): void {
  console.log(`
${c.bright}${c.cyan}╔═══════════════════════════════════════════════════════════════════════════╗
║            🦁 ServalSheets Live Monitor v2.1 (Anomaly Detection)           ║
╚═══════════════════════════════════════════════════════════════════════════╝${c.reset}

${c.dim}Log: ${LOG_FILE.split('/').pop()}
Started: ${new Date().toLocaleString()}
Mode: ${errorsOnly ? 'Errors only' : verboseMode ? 'Verbose' : 'Normal'} | Slow threshold: ${slowThreshold}ms
Press Ctrl+C to stop and show full analysis${c.reset}

${c.cyan}Legend:${c.reset} ${c.cyan}→${c.reset} call  ${c.yellow}←${c.reset} response  ${c.green}✓${c.reset} success  ${c.red}✗${c.reset} error
─────────────────────────────────────────────────────────────────────────────
`);
}

function printStats(): void {
  const runtime = Date.now() - stats.startTime;
  const callsPerMin = stats.toolCalls > 0 && runtime > 60000 ? (stats.toolCalls / (runtime / 60000)).toFixed(1) : 'N/A';
  const errorRate = stats.toolCalls > 0 ? ((stats.errors / stats.toolCalls) * 100).toFixed(1) : '0';

  console.log(`

${c.bright}${c.cyan}═══════════════════════════════════════════════════════════════════════════
                              📊 ANALYSIS REPORT
═══════════════════════════════════════════════════════════════════════════${c.reset}

${c.bright}${c.underscore}Overview${c.reset}
  Runtime:         ${formatDuration(runtime)}
  Total Messages:  ${stats.totalMessages}
  Tool Calls:      ${c.cyan}${stats.toolCalls}${c.reset} (${callsPerMin}/min)
  Responses:       ${stats.responses}
  Errors:          ${c.red}${stats.errors}${c.reset} (${errorRate}%)
  Cancellations:   ${c.yellow}${stats.cancellations}${c.reset}
  Slow Calls:      ${c.yellow}${stats.slowCalls.length}${c.reset} (>${slowThreshold}ms)

${c.bright}${c.underscore}Error Categories${c.reset}`);

  const sortedCategories = [...stats.byErrorCategory.entries()].sort((a, b) => b[1] - a[1]);
  for (const [category, count] of sortedCategories) {
    const pct = ((count / stats.errors) * 100).toFixed(0);
    const color = category === 'VALIDATION' || category === 'SCHEMA' ? c.yellow :
                  category === 'AUTH' ? c.magenta :
                  category === 'TIMEOUT' ? c.blue : c.red;
    console.log(`  ${color}${category.padEnd(12)}${c.reset} ${String(count).padStart(4)} (${pct}%)`);
  }

  // Anomaly Detection Summary
  const currentErrorRate = anomalyDetection.getCurrentErrorRate();
  const anomalyStatus = currentErrorRate > anomalyDetection.baselineErrorRate * anomalyDetection.alertThreshold
    ? `${c.bgRed}${c.white} ELEVATED ${c.reset}`
    : currentErrorRate > anomalyDetection.baselineErrorRate
    ? `${c.yellow}⚠ Above baseline${c.reset}`
    : `${c.green}✓ Normal${c.reset}`;

  console.log(`\n${c.bright}${c.underscore}Anomaly Detection${c.reset}`);
  console.log(`  Recent error rate: ${(currentErrorRate * 100).toFixed(1)}% (baseline: ${(anomalyDetection.baselineErrorRate * 100).toFixed(0)}%)`);
  console.log(`  Status: ${anomalyStatus}`);
  console.log(`  Window: Last ${anomalyDetection.recentCalls.length}/${anomalyDetection.windowSize} calls`);

  console.log(`\n${c.bright}${c.underscore}Tool Performance${c.reset}`);
  console.log(`  ${'Tool'.padEnd(22)} ${'Calls'.padStart(6)} ${'Errors'.padStart(8)} ${'Err%'.padStart(6)} ${'Avg'.padStart(10)} ${'Slow'.padStart(6)}`);
  console.log(`  ${'-'.repeat(60)}`);

  const sortedTools = [...stats.byTool.entries()].sort((a, b) => b[1].calls - a[1].calls);
  for (const [tool, data] of sortedTools) {
    const avgMs = data.calls > 0 ? data.totalMs / data.calls : 0;
    const errorPct = data.calls > 0 ? ((data.errors / data.calls) * 100).toFixed(0) : '0';
    const errorColor = data.errors > 0 ? (parseInt(errorPct) > 20 ? c.red : c.yellow) : c.green;
    const slowColor = data.slowCalls > 0 ? c.yellow : c.dim;
    console.log(`  ${c.magenta}${tool.padEnd(22)}${c.reset} ${String(data.calls).padStart(6)} ${errorColor}${String(data.errors).padStart(8)}${c.reset} ${errorColor}${errorPct.padStart(5)}%${c.reset} ${formatDuration(avgMs).padStart(10)} ${slowColor}${String(data.slowCalls).padStart(6)}${c.reset}`);
  }

  console.log(`\n${c.bright}${c.underscore}Top 20 Actions${c.reset}`);
  const sortedActions = [...stats.byAction.entries()].sort((a, b) => b[1].calls - a[1].calls).slice(0, 20);
  for (const [action, data] of sortedActions) {
    const bar = '█'.repeat(Math.min(15, Math.round((data.calls / stats.toolCalls) * 30)));
    const avgMs = data.calls > 0 ? data.totalMs / data.calls : 0;
    const errorColor = data.errors > 0 ? c.red : c.dim;
    console.log(`  ${c.cyan}${action.padEnd(40)}${c.reset} ${String(data.calls).padStart(4)} ${errorColor}(${data.errors} err)${c.reset} ${formatDuration(avgMs).padStart(8)} ${c.dim}${bar}${c.reset}`);
  }

  if (stats.validationErrors.size > 0) {
    console.log(`\n${c.bright}${c.underscore}${c.yellow}Validation Error Hot Spots${c.reset}`);
    console.log(`  ${c.dim}These fields are causing the most validation errors:${c.reset}`);
    const sortedValidation = [...stats.validationErrors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [path, count] of sortedValidation) {
      console.log(`  ${c.yellow}${path.padEnd(55)}${c.reset} ${count} errors`);
    }
  }

  if (stats.bySpreadsheet.size > 0) {
    console.log(`\n${c.bright}${c.underscore}Spreadsheets Accessed${c.reset}`);
    const sortedSS = [...stats.bySpreadsheet.entries()].sort((a, b) => b[1].calls - a[1].calls).slice(0, 10);
    for (const [ssId, data] of sortedSS) {
      const errorColor = data.errors > 0 ? c.red : c.green;
      console.log(`  ${c.dim}${ssId.substring(0, 20)}...${c.reset} ${data.calls} calls ${errorColor}(${data.errors} errors)${c.reset}`);
    }
  }

  if (stats.slowCalls.length > 0) {
    console.log(`\n${c.bright}${c.underscore}${c.yellow}Slow Calls (>${slowThreshold}ms)${c.reset}`);
    for (const call of stats.slowCalls.slice(-10)) {
      console.log(`  ${c.dim}[${formatTime(call.timestamp)}]${c.reset} ${c.magenta}${call.tool}${c.reset}.${call.action} ${c.yellow}${formatDuration(call.duration!)}${c.reset}`);
    }
  }

  if (stats.errorDetails.length > 0) {
    console.log(`\n${c.bright}${c.underscore}${c.red}Recent Errors (last 15)${c.reset}`);
    for (const err of stats.errorDetails.slice(-15)) {
      const errorTrunc = truncate((err.error || '').replace(/\n/g, ' '), 80);
      console.log(`  ${c.dim}[${formatTime(err.timestamp)}]${c.reset} ${c.magenta}${err.tool}${c.reset}.${err.action}`);
      console.log(`    ${c.bgRed}${c.white} ${err.errorCategory || 'ERROR'} ${c.reset} ${c.red}${errorTrunc}${c.reset}`);
    }
  }

  console.log(`\n${c.cyan}═══════════════════════════════════════════════════════════════════════════${c.reset}\n`);

  // Export if requested
  if (exportMode) {
    const exportData = {
      generatedAt: new Date().toISOString(),
      runtime: formatDuration(runtime),
      summary: {
        totalMessages: stats.totalMessages,
        toolCalls: stats.toolCalls,
        errors: stats.errors,
        errorRate: `${errorRate}%`,
        cancellations: stats.cancellations,
        slowCalls: stats.slowCalls.length,
      },
      byTool: Object.fromEntries(stats.byTool),
      byAction: Object.fromEntries(stats.byAction),
      byErrorCategory: Object.fromEntries(stats.byErrorCategory),
      validationErrors: Object.fromEntries(stats.validationErrors),
      errorDetails: stats.errorDetails.slice(-100),
      slowCalls: stats.slowCalls,
    };

    const filename = `monitor-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    writeFileSync(filename, JSON.stringify(exportData, null, 2));
    console.log(`${c.green}📄 Exported report to: ${filename}${c.reset}\n`);
  }
}

async function monitor(): Promise<void> {
  if (!existsSync(LOG_FILE)) {
    console.error(`${c.red}Log file not found: ${LOG_FILE}${c.reset}`);
    console.log(`${c.yellow}Make sure Claude Desktop is running with ServalSheets configured.${c.reset}`);
    process.exit(1);
  }

  if (statsOnly) {
    console.log(`${c.dim}Reading log file...${c.reset}`);
    const rl = readline.createInterface({
      input: createReadStream(LOG_FILE),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      parseLogLine(line);
    }

    printStats();
    return;
  }

  printHeader();

  const tail = spawn('tail', ['-f', '-n', '50', LOG_FILE]);

  const rl = readline.createInterface({
    input: tail.stdout,
    crlfDelay: Infinity,
  });

  rl.on('line', (line) => {
    if (jsonMode) {
      console.log(line);
      return;
    }

    const record = parseLogLine(line);
    if (!record) return;

    // Filter based on mode
    if (errorsOnly && record.success !== false) {
      return;
    }

    const formatted = formatCall(record);
    if (formatted) {
      console.log(formatted);
    }
  });

  tail.stderr.on('data', (data) => {
    console.error(`${c.red}Error: ${data}${c.reset}`);
  });

  process.on('SIGINT', () => {
    tail.kill();
    printStats();
    process.exit(0);
  });
}

monitor().catch((err) => {
  console.error(`${c.red}Monitor error: ${err}${c.reset}`);
  process.exit(1);
});
