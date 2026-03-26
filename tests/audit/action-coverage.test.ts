import { describe, it, expect } from 'vitest';
import * as actionCoverageFixtures from './action-coverage-fixtures';
import { TOOL_ACTIONS } from '../../src/mcp/completions';
import { ACTION_COUNT, TOOL_COUNT } from '../../src/schemas';

describe('Action Coverage Audit', () => {
  const allTools = Object.keys(TOOL_ACTIONS);

  it('should have 25 tools registered', () => {
    expect(allTools.length).toBe(25);
  });

  it('should match TOOL_COUNT constant', () => {
    expect(allTools.length).toBe(TOOL_COUNT);
  });

  it('should match ACTION_COUNT constant', () => {
    const totalActions = allTools.reduce((sum, tool) => {
      return sum + (TOOL_ACTIONS[tool] as string[]).length;
    }, 0);
    expect(totalActions).toBe(ACTION_COUNT);
  });

  describe('per-tool action coverage', () => {
    for (const [toolName, expectedCount] of Object.entries(
      actionCoverageFixtures.EXPECTED_ACTION_COUNTS
    )) {
      it(`${toolName} should have exactly ${expectedCount} actions`, () => {
        const actions = TOOL_ACTIONS[toolName] as string[];
        expect(actions).toBeDefined();
        expect(actions.length).toBe(expectedCount);
      });
    }
  });

  describe('all tools in completions map', () => {
    for (const toolName of Object.keys(actionCoverageFixtures.EXPECTED_ACTION_COUNTS)) {
      it(`${toolName} should be in TOOL_ACTIONS`, () => {
        expect(TOOL_ACTIONS).toHaveProperty(toolName);
      });
    }
  });

  describe('all actions are strings', () => {
    for (const [toolName, actions] of Object.entries(TOOL_ACTIONS)) {
      it(`${toolName} actions should all be strings`, () => {
        expect(Array.isArray(actions)).toBe(true);
        for (const action of actions as unknown[]) {
          expect(typeof action).toBe('string');
        }
      });
    }
  });

  describe('no duplicate actions within tools', () => {
    for (const [toolName, actions] of Object.entries(TOOL_ACTIONS)) {
      it(`${toolName} should have no duplicate actions`, () => {
        const actionSet = new Set(actions as string[]);
        expect(actionSet.size).toBe((actions as string[]).length);
      });
    }
  });

  it('should recognize all expected action names', () => {
    for (const [toolName, actions] of Object.entries(TOOL_ACTIONS)) {
      for (const action of actions as string[]) {
        expect(typeof action).toBe('string');
        expect(action.length).toBeGreaterThan(0);
      }
    }
  });
});
