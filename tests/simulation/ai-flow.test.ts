/**
 * AI Conversation Flow Simulation Tests
 *
 * Simulates realistic Claude+ServalSheets multi-step conversations.
 * Each test runs one full conversation flow against real handler code
 * with mock Google API — no real network calls.
 *
 * These tests catch issues unit tests miss:
 * - Response hint routing at the right steps
 * - nextAction suggestion quality
 * - Multi-step session state coherence
 * - Handler idempotence patterns
 * - Response intelligence layer behavior end-to-end
 *
 * MCP Protocol: 2025-11-25
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runConversationFlow } from './ai-flow-simulator.js';
import { ALL_FLOWS } from './ai-flow-scenarios.js';
import type { FlowResult } from './ai-flow-simulator.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a multi-line diagnostic for a failed flow.
 * Printed when a flow fails so developers can trace which step broke.
 */
function formatFlowDiagnostic(result: FlowResult): string {
  const lines: string[] = [`Flow '${result.flow}' failed in ${result.totalMs}ms`];

  for (const step of result.steps) {
    const status = step.expectationsMet ? '[PASS]' : '[FAIL]';
    const intent = step.intent.substring(0, 50);
    lines.push(
      `  ${status} step ${step.step} (${step.tool}.${step.action}): ${intent}`
    );
    if (!step.expectationsMet) {
      for (const failure of step.failures) {
        lines.push(`         -> ${failure}`);
      }
    }
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────

describe('AI Conversation Flow Simulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const flow of ALL_FLOWS) {
    it(`${flow.name}: ${flow.description}`, async () => {
      const result = await runConversationFlow(flow);

      if (!result.passed) {
        // Console table for quick visual triage in CI
        const tableRows = result.steps.map((s) => ({
          step: s.step,
          intent: s.intent.substring(0, 45),
          tool_action: `${s.tool}.${s.action}`,
          passed: s.expectationsMet ? 'YES' : 'NO',
          failures: s.failures.join('; ').substring(0, 80),
        }));
        console.table(tableRows);
      }

      expect(result.passed, formatFlowDiagnostic(result)).toBe(true);
    });
  }

  // ─── Coverage meta-test ───────────────────────────────────────────────────
  //
  // Verify we have the expected number of flows and categories are diverse.
  // This catches accidental deletion or duplication of scenarios.

  it('meta: all 10 flows are registered and cover at least 4 categories', () => {
    expect(ALL_FLOWS).toHaveLength(10);

    const categories = new Set(ALL_FLOWS.map((f) => f.category));
    expect(categories.size).toBeGreaterThanOrEqual(4);

    // Every flow must have at least 2 steps
    for (const flow of ALL_FLOWS) {
      expect(
        flow.steps.length,
        `Flow '${flow.name}' must have >= 2 steps`
      ).toBeGreaterThanOrEqual(2);
    }

    // Every flow must have a description
    for (const flow of ALL_FLOWS) {
      expect(
        flow.description.length,
        `Flow '${flow.name}' must have a non-empty description`
      ).toBeGreaterThan(0);
    }
  });

  it('meta: flow names are unique', () => {
    const names = ALL_FLOWS.map((f) => f.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('meta: all steps have non-empty intent and valid tool/action', () => {
    for (const flow of ALL_FLOWS) {
      for (const step of flow.steps) {
        expect(
          step.intent.length,
          `Flow '${flow.name}' has a step with empty intent`
        ).toBeGreaterThan(0);

        expect(
          step.tool.startsWith('sheets_'),
          `Flow '${flow.name}' step '${step.intent}' has invalid tool '${step.tool}'`
        ).toBe(true);

        expect(
          step.action.length,
          `Flow '${flow.name}' step '${step.intent}' has empty action`
        ).toBeGreaterThan(0);
      }
    }
  });
});
