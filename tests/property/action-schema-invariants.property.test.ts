/**
 * Action Schema Invariants — Property Tests
 *
 * Verifies structural invariants across ALL tools and actions:
 * - Action names are unique within a tool (no discriminator collision)
 * - Every tool has at least one action
 * - All action annotation keys match TOOL_ACTIONS keys
 * - No action name contains invalid characters
 */

import { describe, it, expect } from 'vitest';
import { TOOL_ACTIONS } from '../../src/mcp/completions.js';
import { ACTION_ANNOTATIONS } from '../../src/schemas/annotations.js';
import { ACTION_COUNT } from '../../src/schemas/action-counts.js';

describe('Action schema invariants', () => {
  it('action names are unique within each tool (no discriminator collision)', () => {
    for (const [toolName, actions] of Object.entries(TOOL_ACTIONS)) {
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const action of actions) {
        if (seen.has(action)) duplicates.push(action);
        seen.add(action);
      }
      expect(duplicates, `${toolName} has duplicate actions: ${duplicates.join(', ')}`).toHaveLength(0);
    }
  });

  it('every tool has at least one action', () => {
    for (const [toolName, actions] of Object.entries(TOOL_ACTIONS)) {
      expect(actions.length, `${toolName} has no actions`).toBeGreaterThan(0);
    }
  });

  it('action names contain only valid characters (letters, digits, underscores)', () => {
    const VALID_ACTION = /^[a-z][a-z0-9_]*$/;
    for (const [toolName, actions] of Object.entries(TOOL_ACTIONS)) {
      for (const action of actions) {
        expect(
          VALID_ACTION.test(action),
          `${toolName}.${action} contains invalid characters`
        ).toBe(true);
      }
    }
  });

  it('total action count matches ACTION_COUNT constant', () => {
    const total = Object.values(TOOL_ACTIONS).reduce((sum, actions) => sum + actions.length, 0);
    expect(total).toBe(ACTION_COUNT);
  });

  it('every annotation key matches a real tool.action', () => {
    for (const key of Object.keys(ACTION_ANNOTATIONS)) {
      const [toolName, ...actionParts] = key.split('.');
      const action = actionParts.join('.');
      const toolActions = (TOOL_ACTIONS as Record<string, string[]>)[toolName];
      expect(toolActions, `Annotation key "${key}" references unknown tool "${toolName}"`).toBeDefined();
      if (toolActions) {
        expect(
          toolActions.includes(action),
          `Annotation key "${key}" references unknown action "${action}" in ${toolName}`
        ).toBe(true);
      }
    }
  });

  it('no two different tools share the same action name set (smoke — catches tool merges)', () => {
    const toolsByActionSet = new Map<string, string>();
    for (const [toolName, actions] of Object.entries(TOOL_ACTIONS)) {
      const key = [...actions].sort().join(',');
      if (toolsByActionSet.has(key)) {
        throw new Error(`${toolName} and ${toolsByActionSet.get(key)} have identical action sets`);
      }
      toolsByActionSet.set(key, toolName);
    }
  });
});
