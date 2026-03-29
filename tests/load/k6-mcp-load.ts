/**
 * ServalSheets — k6 HTTP Load Test Suite
 *
 * Production load testing for the AgentCore hosted deployment.
 * Tests MCP protocol endpoints under concurrent load with realistic
 * tool call patterns.
 *
 * Prerequisites:
 *   npm install -g k6  (or brew install k6)
 *   export SERVAL_BASE_URL=https://your-alb-dns.amazonaws.com
 *   export SERVAL_AUTH_TOKEN=<cognito-jwt>
 *
 * Run:
 *   k6 run tests/load/k6-mcp-load.ts
 *   k6 run --vus 50 --duration 5m tests/load/k6-mcp-load.ts
 *
 * Stages (default):
 *   Warm-up   → 10 VUs over 30s
 *   Ramp-up   → 50 VUs over 1m
 *   Sustained → 50 VUs for 3m
 *   Spike     → 100 VUs for 1m
 *   Cool-down → 0 VUs over 30s
 *
 * Thresholds:
 *   p95 < 2s, p99 < 5s, error rate < 1%, req/s > 100
 */

// NOTE: This file is written for k6's JavaScript runtime.
// TypeScript types are for IDE support only — k6 transpiles automatically.

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// ============================================================================
// Configuration
// ============================================================================

const BASE_URL = __ENV.SERVAL_BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.SERVAL_AUTH_TOKEN || '';
const MCP_PATH = '/mcp';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Warm-up
    { duration: '1m', target: 50 },    // Ramp-up
    { duration: '3m', target: 50 },    // Sustained load
    { duration: '1m', target: 100 },   // Spike
    { duration: '30s', target: 0 },    // Cool-down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<2000', 'p(99)<5000'],
    'http_req_failed': ['rate<0.01'],
    'mcp_tool_call_duration': ['p(95)<3000'],
    'mcp_tool_call_errors': ['rate<0.02'],
    'mcp_auth_check_duration': ['p(99)<500'],
    'iterations': ['rate>10'],
  },
  tags: {
    project: 'servalsheets',
    env: __ENV.K6_ENV || 'staging',
  },
};

// ============================================================================
// Custom Metrics
// ============================================================================

const mcpToolCallDuration = new Trend('mcp_tool_call_duration', true);
const mcpToolCallErrors = new Rate('mcp_tool_call_errors');
const mcpAuthCheckDuration = new Trend('mcp_auth_check_duration', true);
const toolCallsByName = new Counter('tool_calls_by_name');

// ============================================================================
// Test Data
// ============================================================================

const SPREADSHEET_IDS = new SharedArray('spreadsheetIds', () => [
  'load-test-sheet-001',
  'load-test-sheet-002',
  'load-test-sheet-003',
  'load-test-sheet-004',
  'load-test-sheet-005',
]);

const TOOL_CALL_SCENARIOS = [
  // Read-heavy (60% of traffic)
  { weight: 20, tool: 'sheets_core', action: 'get', name: 'core_get' },
  { weight: 15, tool: 'sheets_data', action: 'read', name: 'data_read' },
  { weight: 10, tool: 'sheets_core', action: 'list_sheets', name: 'core_list' },
  { weight: 8, tool: 'sheets_session', action: 'get_context', name: 'session_context' },
  { weight: 7, tool: 'sheets_auth', action: 'status', name: 'auth_status' },

  // Write (20% of traffic)
  { weight: 8, tool: 'sheets_data', action: 'write', name: 'data_write' },
  { weight: 5, tool: 'sheets_data', action: 'append', name: 'data_append' },
  { weight: 4, tool: 'sheets_format', action: 'format_cells', name: 'format_cells' },
  { weight: 3, tool: 'sheets_data', action: 'clear', name: 'data_clear' },

  // Analysis (15% of traffic)
  { weight: 5, tool: 'sheets_analyze', action: 'quick_analysis', name: 'analyze_quick' },
  { weight: 4, tool: 'sheets_quality', action: 'validate', name: 'quality_validate' },
  { weight: 3, tool: 'sheets_compute', action: 'summary_stats', name: 'compute_stats' },
  { weight: 3, tool: 'sheets_dependencies', action: 'list_dependents', name: 'deps_list' },

  // Heavy ops (5% of traffic)
  { weight: 2, tool: 'sheets_analyze', action: 'comprehensive', name: 'analyze_full' },
  { weight: 2, tool: 'sheets_composite', action: 'import_csv', name: 'composite_import' },
  { weight: 1, tool: 'sheets_visualize', action: 'chart_create', name: 'viz_chart' },
];

// Pre-compute cumulative weights for weighted random selection
const totalWeight = TOOL_CALL_SCENARIOS.reduce((sum, s) => sum + s.weight, 0);

function pickScenario() {
  let r = Math.random() * totalWeight;
  for (const scenario of TOOL_CALL_SCENARIOS) {
    r -= scenario.weight;
    if (r <= 0) return scenario;
  }
  return TOOL_CALL_SCENARIOS[0];
}

function pickSpreadsheetId() {
  return SPREADSHEET_IDS[Math.floor(Math.random() * SPREADSHEET_IDS.length)];
}

// ============================================================================
// MCP Request Builders
// ============================================================================

function buildMcpRequest(tool: string, action: string, params: Record<string, unknown> = {}) {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: `load-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    method: 'tools/call',
    params: {
      name: tool,
      arguments: {
        request: {
          action,
          ...params,
        },
      },
    },
  });
}

function getHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Request-ID': `k6-${__VU}-${__ITER}-${Date.now()}`,
  };
  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }
  return headers;
}

function buildToolParams(action: string, spreadsheetId: string): Record<string, unknown> {
  switch (action) {
    case 'get':
      return { spreadsheetId };
    case 'read':
      return { spreadsheetId, range: 'Sheet1!A1:Z100' };
    case 'list_sheets':
      return { spreadsheetId };
    case 'get_context':
      return {};
    case 'status':
      return {};
    case 'write':
      return {
        spreadsheetId,
        range: 'Sheet1!A1:C3',
        values: [
          ['Load Test', Date.now(), __VU],
          ['Row 2', 'data', 'here'],
          ['Row 3', 'more', 'data'],
        ],
      };
    case 'append':
      return {
        spreadsheetId,
        range: 'Sheet1!A:C',
        values: [['Append', Date.now(), __VU]],
      };
    case 'format_cells':
      return {
        spreadsheetId,
        range: 'Sheet1!A1:C1',
        format: { bold: true, backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } },
      };
    case 'clear':
      return { spreadsheetId, range: 'Sheet1!Z1:Z1' };
    case 'quick_analysis':
      return { spreadsheetId, range: 'Sheet1!A1:E20' };
    case 'validate':
      return { spreadsheetId, range: 'Sheet1!A1:Z50' };
    case 'summary_stats':
      return { spreadsheetId, range: 'Sheet1!B2:B100' };
    case 'list_dependents':
      return { spreadsheetId, cell: 'A1' };
    case 'comprehensive':
      return { spreadsheetId, maxSheets: 1 };
    case 'import_csv':
      return { spreadsheetId, csv: 'a,b,c\n1,2,3\n4,5,6', targetSheet: 'LoadTest' };
    case 'chart_create':
      return {
        spreadsheetId,
        sheetName: 'Sheet1',
        chartType: 'BAR',
        dataRange: 'Sheet1!A1:B10',
        title: 'Load Test Chart',
      };
    default:
      return { spreadsheetId };
  }
}

// ============================================================================
// Test Scenarios
// ============================================================================

export default function () {
  const scenario = pickScenario();
  const spreadsheetId = pickSpreadsheetId();

  group(`tool_${scenario.name}`, () => {
    const params = buildToolParams(scenario.action, spreadsheetId);
    const body = buildMcpRequest(scenario.tool, scenario.action, params);
    const headers = getHeaders();

    const start = Date.now();
    const res = http.post(`${BASE_URL}${MCP_PATH}`, body, {
      headers,
      timeout: '30s',
      tags: { tool: scenario.tool, action: scenario.action },
    });
    const duration = Date.now() - start;

    // Record metrics
    mcpToolCallDuration.add(duration);
    toolCallsByName.add(1, { tool: scenario.tool, action: scenario.action });

    // Validate response
    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'has json body': (r) => {
        try {
          JSON.parse(r.body as string);
          return true;
        } catch {
          return false;
        }
      },
      'no server error': (r) => r.status < 500,
      'response time OK': () => duration < 5000,
    });

    if (!success) {
      mcpToolCallErrors.add(1);
    } else {
      mcpToolCallErrors.add(0);
    }

    // Check MCP response structure
    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body as string);
        check(body, {
          'has jsonrpc': (b: Record<string, unknown>) => b.jsonrpc === '2.0',
          'has result or error': (b: Record<string, unknown>) => 'result' in b || 'error' in b,
        });
      } catch {
        // Non-JSON response
      }
    }
  });

  // Simulate realistic think time between requests
  sleep(Math.random() * 0.5 + 0.1);
}

// ============================================================================
// Lifecycle Hooks
// ============================================================================

export function setup() {
  // Verify server is reachable
  const healthCheck = http.get(`${BASE_URL}/ping`, {
    headers: getHeaders(),
    timeout: '10s',
  });

  const ok = check(healthCheck, {
    'server is reachable': (r) => r.status === 200,
  });

  if (!ok) {
    console.error(`Server at ${BASE_URL} is not reachable. Aborting load test.`);
    return { abort: true };
  }

  // Auth check timing
  if (AUTH_TOKEN) {
    const start = Date.now();
    const authRes = http.post(
      `${BASE_URL}${MCP_PATH}`,
      buildMcpRequest('sheets_auth', 'status', {}),
      { headers: getHeaders(), timeout: '10s' }
    );
    mcpAuthCheckDuration.add(Date.now() - start);

    check(authRes, {
      'auth check succeeds': (r) => r.status === 200,
    });
  }

  return { startTime: Date.now() };
}

export function teardown(data: Record<string, unknown>) {
  if (data.startTime) {
    const totalDuration = (Date.now() - (data.startTime as number)) / 1000;
    console.log(`Load test completed in ${totalDuration.toFixed(1)}s`);
  }
}

// ============================================================================
// Scenarios (named, for k6 Cloud or structured runs)
// ============================================================================

export const scenarios = {
  // Scenario 1: Steady state
  steady_state: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 20 },
      { duration: '5m', target: 20 },
      { duration: '30s', target: 0 },
    ],
    gracefulRampDown: '10s',
  },

  // Scenario 2: Spike test
  spike_test: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 5 },
      { duration: '10s', target: 200 },  // Sudden spike
      { duration: '1m', target: 200 },
      { duration: '10s', target: 5 },
      { duration: '30s', target: 0 },
    ],
    gracefulRampDown: '10s',
  },

  // Scenario 3: Soak test (long-running)
  soak_test: {
    executor: 'constant-vus',
    vus: 30,
    duration: '30m',
  },

  // Scenario 4: Breakpoint test
  breakpoint: {
    executor: 'ramping-arrival-rate',
    startRate: 10,
    timeUnit: '1s',
    preAllocatedVUs: 50,
    maxVUs: 500,
    stages: [
      { duration: '2m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '2m', target: 300 },
      { duration: '2m', target: 500 },
    ],
  },
};
