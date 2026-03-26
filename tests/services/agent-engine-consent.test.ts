import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllPlans,
  compilePlanAI,
  registerToolInputSchemas,
  setAgentSamplingConsentChecker,
  setAgentSamplingServer,
  type SamplingServer,
} from '../../src/services/agent-engine.js';
import { TOOL_DEFINITIONS } from '../../src/mcp/registration/tool-definitions.js';
import {
  clearSamplingConsentCache,
  registerSamplingConsentChecker,
} from '../../src/mcp/sampling.js';

describe('agent engine consent fallback', () => {
  beforeEach(() => {
    registerToolInputSchemas(new Map(TOOL_DEFINITIONS.map((t) => [t.name, t.inputSchema] as const)));
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
});
