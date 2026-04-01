import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetEnvForTest } from '../../src/config/env.js';
import { buildPlannerToolCatalog } from '../../src/mcp/planner-tool-catalog.js';
import { TOOL_DEFINITIONS } from '../../src/mcp/registration/tool-definitions.js';
import { buildToolCatalogSummary } from '../../src/services/agent/plan-compiler.js';
import { registerPlannerToolCatalog } from '../../src/services/agent-engine.js';

describe('agent plan compiler catalog summary', () => {
  beforeEach(() => {
    delete process.env['REDIS_URL'];
    delete process.env['ENABLE_APPSSCRIPT_TRIGGER_COMPAT'];
    resetEnvForTest();
    registerPlannerToolCatalog(buildPlannerToolCatalog(TOOL_DEFINITIONS));
  });

  afterEach(() => {
    resetEnvForTest();
    delete process.env['REDIS_URL'];
    delete process.env['ENABLE_APPSSCRIPT_TRIGGER_COMPAT'];
  });

  it('builds planner summary from filtered live metadata', () => {
    const summary = buildToolCatalogSummary();

    expect(summary).toContain('sheets_auth (Authentication)');
    expect(summary).toContain('all actions auth-exempt');
    expect(summary).toContain('sheets_history (Operation History & Undo)');
    expect(summary).toContain('auth-exempt: list, get, stats');
    expect(summary).toContain('sheets_webhook (Webhook Notifications)');
    expect(summary).toContain('availability: Redis backend not configured in this server process');
    expect(summary).not.toContain('list_triggers');
    expect(summary).not.toContain('create_trigger');
  });
});
