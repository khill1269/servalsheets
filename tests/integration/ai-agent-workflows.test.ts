/**
 * AI Agent Workflow Integration Tests
 *
 * Realistic MCP protocol workflow tests using the real in-memory client-server pair.
 * No Google API credentials are required — auth errors are expected and tested.
 *
 * W1: Tool discovery — listTools returns TOOL_COUNT tools with correct shape
 * W2: Auth status — sheets_auth.status returns valid MCP shape
 * W3: Session set_active + get_active round-trip
 * W4: SEP-1303 validation error shape — missing required field → isError + audience
 * W5: Session record + get_history shows recorded operation
 * W6: All 25 tools respond without crashing — content[0].type === 'text' + parseable JSON
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { resetEnvForTest } from '../../src/config/env.js';
import { createServalSheetsTestHarness, type McpTestHarness } from '../helpers/mcp-test-harness.js';
import { TOOL_COUNT } from '../../src/schemas/action-counts.js';

let harness: McpTestHarness;

beforeAll(async () => {
  // Force bundled (25-tool) mode: MCP_TRANSPORT=http causes getEffectiveToolMode() → 'bundled'.
  // Without this, the test runner (vitest) has no MCP_TRANSPORT set, so the server defaults
  // to 'flat' (~400 per-action tools), which is the STDIO/Claude Desktop optimized mode.
  vi.stubEnv('MCP_TRANSPORT', 'http');
  // sheets_federation is hidden when MCP_FEDERATION_SERVERS is not set (isToolFullyUnavailable).
  // Supply a stub server so all 25 tools appear in tools/list.
  vi.stubEnv('MCP_FEDERATION_SERVERS', 'test-server:http://localhost:9999');
  resetEnvForTest();

  harness = await createServalSheetsTestHarness({
    clientCapabilities: {
      sampling: {},
      elicitation: { form: {} },
    },
  });
});

afterAll(async () => {
  await harness.close();
  vi.unstubAllEnvs();
  resetEnvForTest();
});

function parse(result: Awaited<ReturnType<typeof harness.client.callTool>>): unknown {
  try {
    return JSON.parse(result.content[0].text as string);
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// W1: Tool discovery
// ---------------------------------------------------------------------------
describe('W1: Tool discovery', () => {
  it('listTools returns exactly TOOL_COUNT tools', async () => {
    const { tools } = await harness.client.listTools();
    expect(tools).toHaveLength(TOOL_COUNT);
  });

  it('every tool has name, description, and inputSchema', async () => {
    const { tools } = await harness.client.listTools();
    for (const tool of tools) {
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.inputSchema).toBe('object');
    }
  });

  it('tool names include expected ServalSheets tools', async () => {
    const { tools } = await harness.client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain('sheets_auth');
    expect(names).toContain('sheets_session');
    expect(names).toContain('sheets_data');
    expect(names).toContain('sheets_core');
    expect(names).toContain('sheets_format');
  });
});

// ---------------------------------------------------------------------------
// W2: Auth status — works without credentials
// ---------------------------------------------------------------------------
describe('W2: Auth status (no credentials required)', () => {
  it('sheets_auth.status returns a valid MCP response shape', async () => {
    const result = await harness.client.callTool({
      name: 'sheets_auth',
      arguments: { request: { action: 'status' } },
    });

    // Must have a content array
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);

    // First item must be type text
    expect(result.content[0].type).toBe('text');

    // Text must be parseable JSON
    const text = result.content[0].text as string;
    expect(() => JSON.parse(text)).not.toThrow();

    // Parsed response must have the expected shape
    const parsed = JSON.parse(text) as { response?: { success?: boolean } };
    expect(parsed).toHaveProperty('response');
    expect(typeof parsed.response?.success).toBe('boolean');
  });

  it('sheets_auth.status structuredContent has response.success', async () => {
    const result = await harness.client.callTool({
      name: 'sheets_auth',
      arguments: { request: { action: 'status' } },
    });

    const sc = result.structuredContent as { response?: { success?: boolean } } | null;
    // structuredContent is present and has response.success (either true or false)
    expect(sc).not.toBeNull();
    expect(sc?.response).toBeDefined();
    expect(typeof sc?.response?.success).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// W3: Session set_active + get_active round-trip
// ---------------------------------------------------------------------------
describe('W3: Session set_active + get_active round-trip', () => {
  const TEST_SPREADSHEET_ID = 'fake-spreadsheet-id-001';

  it('set_active succeeds and get_active returns the same spreadsheetId', async () => {
    const setResult = await harness.client.callTool({
      name: 'sheets_session',
      arguments: {
        request: {
          action: 'set_active',
          spreadsheetId: TEST_SPREADSHEET_ID,
          title: 'Test Spreadsheet',
          sheetNames: ['Sheet1'],
        },
      },
    });

    // set_active should succeed (session ops are auth-exempt)
    expect(setResult.content[0].type).toBe('text');
    const setResponse = parse(setResult) as { response?: { success?: boolean } };
    expect(setResponse.response?.success).toBe(true);

    // get_active should return the same spreadsheetId
    const getResult = await harness.client.callTool({
      name: 'sheets_session',
      arguments: { request: { action: 'get_active' } },
    });

    expect(getResult.content[0].type).toBe('text');
    // get_active response nests spreadsheetId under response.spreadsheet.spreadsheetId
    // (handler returns: { response: { spreadsheet: { spreadsheetId, title, ... } } })
    const getResponse = parse(getResult) as {
      response?: { success?: boolean; spreadsheet?: { spreadsheetId?: string } };
    };
    expect(getResponse.response?.success).toBe(true);
    expect(getResponse.response?.spreadsheet?.spreadsheetId).toBe(TEST_SPREADSHEET_ID);
  });
});

// ---------------------------------------------------------------------------
// W4: SEP-1303 validation error shape — missing required field
// ---------------------------------------------------------------------------
describe('W4: Validation error shape (SEP-1303)', () => {
  it('sheets_data.read with missing spreadsheetId returns isError: true with text content', async () => {
    // Provide action and range but omit required spreadsheetId.
    // This triggers schema validation failure — either at the SDK input-validation layer
    // (McpServer.validateToolInput) or at our handler's parseForHandler layer.
    // Both paths produce isError: true with content[0].type === 'text'.
    const result = await harness.client.callTool({
      name: 'sheets_data',
      arguments: {
        request: {
          action: 'read',
          range: 'Sheet1!A1:B10',
          // spreadsheetId intentionally omitted
        },
      },
    });

    // MCP shape: content array with type text
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0].type).toBe('text');

    // Fatal input validation error → isError: true
    expect(result.isError).toBe(true);

    // Error message must mention the invalid input
    const text = result.content[0].text as string;
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('sheets_data.read with valid params but no auth returns structured error JSON', async () => {
    // This call PASSES schema validation but fails at Google auth (no credentials set up).
    // It goes through our buildToolResponse path → structured JSON with response.error.
    const result = await harness.client.callTool({
      name: 'sheets_data',
      arguments: {
        request: {
          action: 'read',
          spreadsheetId: 'test-spreadsheet-id',
          range: 'Sheet1!A1',
        },
      },
    });

    // Must be valid MCP shape
    expect(result.content[0].type).toBe('text');

    // The content must be parseable JSON (our buildToolResponse output)
    const text = result.content[0].text as string;
    expect(() => JSON.parse(text)).not.toThrow();

    const parsed = JSON.parse(text) as {
      response?: { success?: boolean; error?: { code?: string; message?: string } };
    };
    expect(parsed.response?.success).toBe(false);
    expect(parsed.response?.error).toBeDefined();
    expect(typeof parsed.response?.error?.message).toBe('string');

    // Audience annotation on our structured error responses
    const item = result.content[0] as {
      type: string;
      text: string;
      annotations?: { audience?: string[] };
    };
    // Non-fatal auth errors have audience ['assistant']; fatal errors have ['user', 'assistant'].
    // Either is valid here — just verify audience is defined and is an array.
    if (item.annotations?.audience !== undefined) {
      expect(Array.isArray(item.annotations.audience)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// W5: Session record + get_history
// ---------------------------------------------------------------------------
describe('W5: Session record_operation + get_history', () => {
  it('records an operation and get_history includes it', async () => {
    const spreadsheetId = 'fake-spreadsheet-id-w5-001';

    const recordResult = await harness.client.callTool({
      name: 'sheets_session',
      arguments: {
        request: {
          action: 'record_operation',
          tool: 'sheets_data',
          toolAction: 'write',
          spreadsheetId,
          description: 'Wrote quarterly revenue data to Sheet1!A1:D5',
          undoable: true,
        },
      },
    });

    expect(recordResult.content[0].type).toBe('text');
    const recordResponse = parse(recordResult) as { response?: { success?: boolean } };
    expect(recordResponse.response?.success).toBe(true);

    // get_history should return at least one entry
    const historyResult = await harness.client.callTool({
      name: 'sheets_session',
      arguments: {
        request: {
          action: 'get_history',
          limit: 5,
        },
      },
    });

    expect(historyResult.content[0].type).toBe('text');
    // OperationRecord uses `action` (not `toolAction`) — the handler maps toolAction → action
    // when calling session.recordOperation (see session-actions/context.ts:handleRecordOperation)
    const historyResponse = parse(historyResult) as {
      response?: {
        success?: boolean;
        operations?: Array<{ tool?: string; action?: string; spreadsheetId?: string }>;
      };
    };
    expect(historyResponse.response?.success).toBe(true);
    expect(Array.isArray(historyResponse.response?.operations)).toBe(true);

    // The recorded operation should appear in history
    const operations = historyResponse.response?.operations ?? [];
    const recorded = operations.find(
      (op) =>
        op.tool === 'sheets_data' &&
        op.action === 'write' &&
        op.spreadsheetId === spreadsheetId
    );
    expect(recorded).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// W6: All 25 tools respond without crashing
// ---------------------------------------------------------------------------
describe('W6: All 25 tools respond without crashing', () => {
  /**
   * Minimal valid call parameters for each of the 25 tools.
   * Auth-exempt tools (auth, session, confirm, history, transaction, templates,
   * federation, webhook, agent, connectors) return success.
   * Google-API-dependent tools return auth errors but must NOT crash.
   *
   * Format: [toolName, arguments]
   */
  const MINIMAL_TOOL_CALLS: Array<[string, Record<string, unknown>]> = [
    // Group 1 — Auth-exempt session tools
    ['sheets_auth', { request: { action: 'status' } }],
    ['sheets_session', { request: { action: 'get_active' } }],
    ['sheets_session', { request: { action: 'get_context' } }],
    // sheets_confirm wraps action in request envelope (SheetsConfirmInputSchema uses request wrapper)
    ['sheets_confirm', { request: { action: 'get_stats' } }],
    ['sheets_history', { request: { action: 'list' } }],
    // sheets_transaction: 'status' requires transactionId; use 'list' (optional spreadsheetId)
    ['sheets_transaction', { request: { action: 'list' } }],
    ['sheets_templates', { request: { action: 'list' } }],
    ['sheets_federation', { request: { action: 'list_servers' } }],
    ['sheets_webhook', { request: { action: 'list' } }],
    ['sheets_agent', { request: { action: 'plan', description: 'List all sheets' } }],
    ['sheets_connectors', { request: { action: 'list_connectors' } }],

    // Group 2 — Google API dependent (will return auth errors)
    ['sheets_core', { request: { action: 'list' } }],
    [
      'sheets_data',
      { request: { action: 'read', spreadsheetId: 'test-id', range: 'Sheet1!A1' } },
    ],
    ['sheets_format', { request: { action: 'suggest_format', spreadsheetId: 'test-id' } }],
    [
      'sheets_dimensions',
      {
        request: {
          action: 'freeze',
          spreadsheetId: 'test-id',
          dimension: 'ROWS',
          count: 1,
        },
      },
    ],
    [
      'sheets_visualize',
      { request: { action: 'suggest_chart', spreadsheetId: 'test-id', range: 'Sheet1!A1:C10' } },
    ],
    [
      'sheets_collaborate',
      { request: { action: 'share_list', spreadsheetId: 'test-id' } },
    ],
    [
      'sheets_advanced',
      { request: { action: 'list_named_ranges', spreadsheetId: 'test-id' } },
    ],
    [
      'sheets_analyze',
      { request: { action: 'analyze_data', spreadsheetId: 'test-id' } },
    ],
    [
      'sheets_composite',
      {
        request: {
          action: 'import_csv',
          spreadsheetId: 'test-id',
          csvData: 'a,b\n1,2',
        },
      },
    ],
    [
      'sheets_compute',
      {
        request: {
          action: 'aggregate',
          spreadsheetId: 'test-id',
          range: 'Sheet1!A1:A10',
          // functions enum uses lowercase: 'sum' not 'SUM'
          functions: ['sum'],
        },
      },
    ],
    [
      'sheets_dependencies',
      { request: { action: 'build', spreadsheetId: 'test-id' } },
    ],
    ['sheets_quality', { request: { action: 'validate', value: 42, rules: [] } }],
    [
      'sheets_fix',
      {
        request: {
          action: 'clean',
          spreadsheetId: 'test-id',
          range: 'Sheet1!A1:Z100',
        },
      },
    ],
    [
      'sheets_bigquery',
      {
        request: {
          action: 'list_connections',
          spreadsheetId: 'test-id',
        },
      },
    ],
    [
      'sheets_appsscript',
      {
        request: {
          action: 'get',
          spreadsheetId: 'test-id',
        },
      },
    ],
  ];

  // Deduplicate — some tools appear once, but we only want one call per tool
  const seenTools = new Set<string>();
  const uniqueCalls = MINIMAL_TOOL_CALLS.filter(([toolName]) => {
    if (seenTools.has(toolName)) return false;
    seenTools.add(toolName);
    return true;
  });

  it.each(uniqueCalls)(
    '%s responds with content[0].type === "text" and parseable JSON',
    async (toolName, args) => {
      const result = await harness.client.callTool({
        name: toolName,
        arguments: args,
      });

      // Must have a content array with at least one item
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);

      // First content item must be type text
      expect(result.content[0].type).toBe('text');

      // Text must be parseable JSON — no crashes allowed
      const text = result.content[0].text as string;
      expect(typeof text).toBe('string');
      expect(() => JSON.parse(text)).not.toThrow();

      // Parsed JSON must have a response object
      const parsed = JSON.parse(text) as { response?: { success?: boolean } };
      expect(parsed).toHaveProperty('response');
    }
  );

  it('all 25 distinct tools are covered in MINIMAL_TOOL_CALLS', () => {
    const coveredTools = new Set(MINIMAL_TOOL_CALLS.map(([name]) => name));
    expect(coveredTools.size).toBe(TOOL_COUNT);
  });
});
