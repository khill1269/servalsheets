import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllPlans,
  compilePlanAI,
  registerPlannerToolCatalog,
  registerToolInputSchemas,
  setAgentSamplingConsentChecker,
  setAgentSamplingServer,
  type SamplingServer,
} from '../../src/services/agent-engine.js';
import { buildPlannerToolCatalog } from '../../src/mcp/planner-tool-catalog.js';
import { TOOL_DEFINITIONS } from '../../src/mcp/registration/tool-definitions.js';
import {
  clearSamplingConsentCache,
  registerSamplingConsentChecker,
} from '../../src/mcp/sampling.js';

describe('agent engine consent fallback', () => {
  beforeEach(() => {
    registerToolInputSchemas(new Map(TOOL_DEFINITIONS.map((t) => [t.name, t.inputSchema] as const)));
    registerPlannerToolCatalog(buildPlannerToolCatalog(TOOL_DEFINITIONS));
  });

  afterEach(async () => {
    setAgentSamplingServer(undefined);
    setAgentSamplingConsentChecker(undefined);
    registerSamplingConsentChecker(async () => {});
    clearSamplingConsentCache();
    await clearAllPlans();
    vi.restoreAllMocks();
  });

  it('uses global sampling consent guard when local agent consent checker is not set', async () => {
    registerSamplingConsentChecker(async () => {
      throw new Error('GDPR_CONSENT_REQUIRED');
    });
    setAgentSamplingConsentChecker(undefined);

    const createMessage = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });
    const server: SamplingServer = {
      createMessage: createMessage as SamplingServer['createMessage'],
    };
    setAgentSamplingServer(server);

    const plan = await compilePlanAI('analyze monthly sales trends', 5, 'sheet-123');

    expect(plan.steps.length).toBeGreaterThan(0);
    expect(createMessage).not.toHaveBeenCalled();
  });

  it('annotates invalid AI-generated draft steps before returning the plan', async () => {
    registerSamplingConsentChecker(async () => {});

    const createMessage = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify([
            {
              tool: 'sheets_data',
              action: 'write',
              params: {},
              description: 'Write output table',
            },
          ]),
        },
      ],
    });
    const server: SamplingServer = {
      createMessage: createMessage as SamplingServer['createMessage'],
    };
    setAgentSamplingServer(server);

    const plan = await compilePlanAI('Write a summary table', 5, 'sheet-123');

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.params['spreadsheetId']).toBe('sheet-123');
    expect(plan.steps[0]?.validation).toEqual(
      expect.objectContaining({
        valid: false,
        suggestedFix: 'Correct the step parameters so they match the tool input schema.',
      })
    );
    expect(plan.steps[0]?.validation?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'values' }),
      ])
    );
  });

  it('passes the live planner catalog summary into the sampling system prompt', async () => {
    registerSamplingConsentChecker(async () => {});

    const createMessage = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });
    const server: SamplingServer = {
      createMessage: createMessage as SamplingServer['createMessage'],
    };
    setAgentSamplingServer(server);

    await compilePlanAI('Review history and auth options', 5, 'sheet-123');

    const systemPrompt = String(createMessage.mock.calls[0]?.[0]?.systemPrompt ?? '');
    expect(systemPrompt).toContain('sheets_history (Operation History & Undo)');
    expect(systemPrompt).toContain('auth-exempt: list, get, stats');
    expect(systemPrompt).not.toContain('list_triggers');
  });
});
