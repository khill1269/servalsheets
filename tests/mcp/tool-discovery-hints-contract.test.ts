import { beforeEach, describe, expect, it } from 'vitest';
import { TOOL_ACTIONS } from '../../src/mcp/completions.js';
import { TOOL_DEFINITIONS } from '../../src/mcp/registration/tool-definitions.js';
import {
  clearDiscoveryHintCache,
  getToolDiscoveryHint,
} from '../../src/mcp/registration/tool-discovery-hints.js';
import { filterAvailableActions } from '../../src/mcp/tool-availability.js';

describe('tool discovery hint contracts', () => {
  beforeEach(() => {
    clearDiscoveryHintCache();
  });

  it('does not expose stale action names beyond the available runtime action set', () => {
    for (const tool of TOOL_DEFINITIONS) {
      const hint = getToolDiscoveryHint(tool.name);
      if (!hint) {
        continue;
      }

      const declaredActions = new Set(
        filterAvailableActions(tool.name, TOOL_ACTIONS[tool.name] ?? [])
      );

      for (const action of Object.keys(hint.actionParams)) {
        expect(
          declaredActions.has(action),
          `Unexpected discovery hint action ${tool.name}.${action}`
        ).toBe(true);
      }
    }
  });

  it('uses canonical sheets_agent action names and required fields', () => {
    const hint = getToolDiscoveryHint('sheets_agent');
    expect(hint).not.toBeNull();

    expect(hint!.actionParams['get_plan']).toBeUndefined();
    expect(hint!.actionParams['abort_plan']).toBeUndefined();
    expect(hint!.actionParams['create_checkpoint']).toBeUndefined();

    expect(hint!.actionParams['plan']?.required).toEqual(expect.arrayContaining(['description']));
    expect(hint!.actionParams['plan']?.required).not.toContain('goal');

    expect(hint!.actionParams['execute_step']?.required).toEqual(
      expect.arrayContaining(['planId', 'stepId'])
    );
    expect(hint!.actionParams['execute_step']?.required).not.toContain('stepIndex');

    expect(hint!.actionParams['observe']).toBeDefined();
    expect(hint!.actionParams['rollback']).toBeDefined();
    expect(hint!.actionParams['get_status']).toBeDefined();
    expect(hint!.actionParams['resume']).toBeDefined();
  });

  it('uses canonical sheets_confirm and sheets_format hint fields', () => {
    const confirmHint = getToolDiscoveryHint('sheets_confirm');
    expect(confirmHint).not.toBeNull();
    expect(confirmHint!.actionParams['request']?.required).toEqual(['plan']);
    expect(confirmHint!.actionParams['wizard_start']?.required).toEqual(
      expect.arrayContaining(['title', 'description', 'steps'])
    );
    expect(confirmHint!.actionParams['wizard_start']?.required).not.toContain('wizardType');
    expect(confirmHint!.actionParams['wizard_step']?.required).toEqual(
      expect.arrayContaining(['wizardId', 'stepId', 'values'])
    );

    const formatHint = getToolDiscoveryHint('sheets_format');
    expect(formatHint).not.toBeNull();
    expect(formatHint!.actionParams['set_number_format']?.required).toEqual(
      expect.arrayContaining(['spreadsheetId', 'range', 'numberFormat'])
    );
    expect(formatHint!.actionParams['set_number_format']?.required).not.toContain('pattern');
  });
});
