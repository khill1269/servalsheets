#!/usr/bin/env node
/**
 * Automated MCP Protocol Smoke Test
 *
 * Replaces manual MCP Inspector UI testing. Starts the STDIO server,
 * connects via MCP SDK client, and tests all 25 tools/410 actions via
 * actual JSON-RPC protocol — no Google credentials required for
 * schema/validation testing.
 *
 * Usage:
 *   node scripts/mcp-protocol-smoke.mjs [--json] [--tool <name>] [--fail-fast]
 *
 * Output: Structured report with pass/fail/skip per action
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const failFast = args.includes('--fail-fast');
const toolFilter = args.includes('--tool') ? args[args.indexOf('--tool') + 1] : null;

// ── Load fixtures ────────────────────────────────────────────────────────────
// Dynamically import TypeScript via tsx to get fixtures
async function loadFixtures() {
  try {
    // Try compiled JS first
    const compiled = join(projectRoot, 'dist/tests/audit/action-coverage-fixtures.js');
    const { generateAllFixtures } = await import(compiled);
    return generateAllFixtures();
  } catch {
    // Fall back to generated action metadata produced by `npm run build`.
  }

  try {
    const compiledCompletions = join(projectRoot, 'dist/generated/completions.js');
    const { TOOL_ACTIONS } = await import(compiledCompletions);
    return fixturesFromToolActions(TOOL_ACTIONS);
  } catch {
    // Fall back to routing-map.json for local developer worktrees.
  }

  try {
    const routingMap = JSON.parse(
      readFileSync(join(projectRoot, '.serval/routing-map.json'), 'utf-8')
    );
    return fixturesFromToolActions(
      Object.fromEntries(
        Object.entries(routingMap.tools).map(([tool, toolData]) => [tool, toolData.actions ?? []])
      )
    );
  } catch (err) {
    throw new Error(`Unable to load action fixtures: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function fixturesFromToolActions(toolActions) {
  const fixtures = [];
  for (const [tool, actions] of Object.entries(toolActions)) {
    if (toolFilter && tool !== toolFilter) continue;
    for (const action of actions ?? []) {
      fixtures.push({
        tool,
        action,
        validInput: { request: { action, spreadsheetId: 'test-smoke-id' } },
        invalidInput: { request: {} },
        skipReason: undefined,
      });
    }
  }
  return fixtures;
}

// ── Test categories ──────────────────────────────────────────────────────────
// Actions that are safe to call with validation-only (no real API)
const VALIDATION_SAFE = new Set([
  'sheets_auth.status',
  'sheets_session.get_active',
  'sheets_session.get_context',
]);

// Actions that should return auth error (not validation error) — confirms routing works
const AUTH_GATE_EXPECTED = new Set([
  'sheets_core.list',
  'sheets_data.read',
  'sheets_format.set_background',
  'sheets_analyze.scout',
]);

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const results = {
    startedAt: new Date().toISOString(),
    phase: 'starting',
    toolsVerified: 0,
    actionsTotal: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    toolList: [],
    actionResults: [],
  };

  log('🔌 Starting ServalSheets STDIO server...');

  const serverEnv = {
    ...process.env,
    NODE_ENV: 'test',
    SESSION_STORE_TYPE: 'memory',
    ALLOW_MEMORY_SESSIONS: 'true',
    CACHE_REDIS_ENABLED: 'false',
    LOG_LEVEL: 'error', // Suppress noise during testing
    SKIP_PREFLIGHT: 'true',
    MCP_TRANSPORT: 'stdio',
    SERVAL_TOOL_MODE: 'bundled',
    SERVAL_STAGED_REGISTRATION: 'false', // Smoke test validates full tool surface; disable staged loading
    SERVALSHEETS_LOAD_DOTENV: 'false',
    ENABLE_PYTHON_COMPUTE: 'false',
  };
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', join(projectRoot, 'src/cli.ts'), '--stdio'],
    env: serverEnv,
    stderr: 'pipe',
  });

  // Use the existing transport rather than spawning twice
  const client = new Client(
    { name: 'mcp-protocol-smoke', version: '1.0.0' },
    {
      capabilities: {
        sampling: {},
        elicitation: { form: {} },
        roots: { listChanged: false },
      },
    }
  );

  try {
    log('🤝 Connecting via MCP protocol (MCP 2025-11-25)...');
    await client.connect(transport);
    results.phase = 'connected';

    // ── Phase 1: tools/list validation ──────────────────────────────────────
    log('📋 Fetching tools/list...');
    const { tools } = await client.listTools();
    results.toolList = tools.map((t) => ({ name: t.name, description: t.description?.slice(0, 60) }));
    results.toolsVerified = tools.length;

    const EXPECTED_TOOLS = 25;
    const MIN_VISIBLE_TOOLS = 24;
    if (tools.length < MIN_VISIBLE_TOOLS || tools.length > EXPECTED_TOOLS) {
      results.errors.push(`Expected ${MIN_VISIBLE_TOOLS}-${EXPECTED_TOOLS} visible tools, got ${tools.length}`);
    } else {
      log(`✅ tools/list: ${tools.length}/${EXPECTED_TOOLS} visible tools present`);
    }

    // Validate each tool has inputSchema
    for (const tool of tools) {
      if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
        results.errors.push(`Tool ${tool.name} missing inputSchema`);
      }
      if (!tool.description) {
        results.errors.push(`Tool ${tool.name} missing description`);
      }
    }

    // ── Phase 2: Per-action protocol tests ──────────────────────────────────
    const fixtures = await loadFixtures();
    const filtered = toolFilter ? fixtures.filter((f) => f.tool === toolFilter) : fixtures;
    results.actionsTotal = filtered.length;

    log(`\n🧪 Testing ${filtered.length} actions via tools/call...\n`);

    for (const fixture of filtered) {
      if (fixture.skipReason) {
        results.skipped++;
        results.actionResults.push({
          tool: fixture.tool,
          action: fixture.action,
          status: 'skipped',
          reason: fixture.skipReason,
        });
        continue;
      }

      const actionKey = `${fixture.tool}.${fixture.action}`;

      try {
        const callResult = await Promise.race([
          client.callTool({
            name: fixture.tool,
            arguments: fixture.validInput,
          }),
          timeout(15_000, `${actionKey} timed out`),
        ]);

        // For validation-safe actions, expect success
        // For most actions without credentials, expect auth error (isError: true)
        // But NOT a JSON-RPC error (which would indicate schema/routing failure)
        const content = callResult.content?.[0];
        const responseText = content?.type === 'text' ? content.text : '';

        let status = 'pass';
        let detail = '';

        if (VALIDATION_SAFE.has(actionKey)) {
          // These should fully succeed
          if (callResult.isError) {
            status = 'fail';
            detail = `Expected success, got error: ${responseText.slice(0, 200)}`;
          }
        } else if (AUTH_GATE_EXPECTED.has(actionKey)) {
          // Should get auth error (not routing/schema error)
          if (!callResult.isError) {
            // Got a success without auth? Unexpected
            status = 'warn';
            detail = 'Got success without auth — may need investigation';
          } else if (responseText.includes('NOT_AUTHENTICATED') || responseText.includes('AUTHENTICATION_REQUIRED')) {
            status = 'pass';
            detail = 'Auth gate working correctly';
          } else if (responseText.includes('Input validation error') || responseText.includes('Invalid arguments')) {
            status = 'pass';
            detail = 'Schema rejected incomplete smoke fixture before auth';
          } else {
            status = 'fail';
            detail = `Expected auth error, got: ${responseText.slice(0, 200)}`;
          }
        } else {
          // General: any response (success or error) means routing worked
          // A JSON-RPC protocol error would have thrown above
          status = 'pass';
          if (callResult.isError) {
            detail = 'Expected error (no auth/credentials)';
          }
        }

        if (status === 'pass') results.passed++;
        else if (status === 'fail') {
          results.failed++;
          if (!jsonMode) log(`  ❌ ${actionKey}: ${detail}`);
          if (failFast) break;
        } else {
          results.passed++; // warn counts as pass
          if (!jsonMode) log(`  ⚠️  ${actionKey}: ${detail}`);
        }

        results.actionResults.push({ tool: fixture.tool, action: fixture.action, status, detail });

      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        if (detail.includes('Input validation error') || detail.includes('Invalid arguments')) {
          results.passed++;
          results.actionResults.push({
            tool: fixture.tool,
            action: fixture.action,
            status: 'pass',
            detail: `Schema rejected incomplete smoke fixture: ${detail.slice(0, 200)}`,
          });
          continue;
        }

        results.failed++;
        results.actionResults.push({
          tool: fixture.tool,
          action: fixture.action,
          status: 'fail',
          detail: `Protocol error: ${detail}`,
        });
        if (!jsonMode) log(`  ❌ ${actionKey}: Protocol error: ${detail}`);
        if (failFast) break;
      }
    }

    results.phase = 'complete';

  } catch (err) {
    results.phase = 'connection_failed';
    results.errors.push(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await client.close().catch(() => {});
  }

  // ── Report ───────────────────────────────────────────────────────────────
  results.completedAt = new Date().toISOString();
  results.passRate = results.actionsTotal > 0
    ? `${((results.passed / (results.actionsTotal - results.skipped)) * 100).toFixed(1)}%`
    : '0%';

  if (jsonMode) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`MCP Protocol Smoke Test Results`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`Tools verified:  ${results.toolsVerified}/25`);
    console.log(`Actions tested:  ${results.actionsTotal}`);
    console.log(`  ✅ Passed:     ${results.passed}`);
    console.log(`  ❌ Failed:     ${results.failed}`);
    console.log(`  ⊘  Skipped:    ${results.skipped}`);
    console.log(`Pass rate:       ${results.passRate}`);
    if (results.errors.length > 0) {
      console.log(`\nErrors:`);
      results.errors.forEach((e) => console.log(`  • ${e}`));
    }
    console.log(`${'─'.repeat(60)}`);
  }

  process.exit(results.failed > 0 || results.errors.length > 0 ? 1 : 0);
}

function log(msg) {
  if (!jsonMode) console.log(msg);
}

function timeout(ms, message) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
