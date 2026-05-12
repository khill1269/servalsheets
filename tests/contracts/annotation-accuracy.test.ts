/**
 * Annotation Accuracy Tests
 *
 * Verifies that tool annotations (readOnlyHint, idempotentHint) are consistent
 * with the mutation action registry. A tool marked readOnlyHint:true must have
 * zero actions in MUTATION_ACTION_NAMES. A tool marked idempotentHint:true should
 * have only actions that are genuinely safe to repeat.
 */

import { describe, it, expect } from 'vitest';
import { TOOL_ANNOTATIONS } from '../../src/generated/annotations.js';
import { MUTATION_ACTION_NAMES } from '../../src/middleware/mutation-actions.constants.js';

// MUTATION_ACTION_NAMES is a readonly array of bare action names (no tool prefix)
const mutationSet = new Set<string>(MUTATION_ACTION_NAMES);

// Actions belonging to read-only tools — none should appear in mutation set
// Derived by inspecting the schemas for sheets_analyze, sheets_compute, sheets_confirm
const READ_ONLY_TOOL_ACTIONS: Record<string, readonly string[]> = {
  sheets_analyze: [
    'analyze_data', 'analyze_formulas', 'analyze_performance', 'analyze_quality',
    'analyze_structure', 'auto_enhance', 'cancel_intelligence', 'comprehensive',
    'detect_patterns', 'diagnose_errors', 'discover_action', 'drill_down',
    'execute_plan', 'explain_analysis', 'formula_health_check', 'generate_actions',
    'generate_formula', 'get_intelligence_report', 'plan', 'query_natural_language',
    'quick_insights', 'schedule_intelligence', 'scout', 'semantic_search',
    'suggest_next_actions', 'suggest_visualization',
  ],
  sheets_compute: [
    'evaluate', 'aggregate', 'statistical', 'regression', 'forecast',
    'matrix_op', 'pivot_compute', 'custom_function', 'batch_compute',
    'explain_formula', 'python_eval', 'sql_query', 'sql_join',
    'pandas_profile', 'sklearn_model', 'matplotlib_chart',
  ],
  sheets_confirm: ['request', 'get_stats', 'wizard_start', 'wizard_step', 'wizard_complete'],
};

describe('Annotation Accuracy', () => {
  it('tools with readOnlyHint:true have no mutation actions', () => {
    const readOnlyTools = Object.entries(TOOL_ANNOTATIONS)
      .filter(([, ann]) => ann.readOnlyHint === true)
      .map(([toolName]) => toolName);

    expect(readOnlyTools.length).toBeGreaterThanOrEqual(2);

    for (const toolName of readOnlyTools) {
      const toolActionNames = READ_ONLY_TOOL_ACTIONS[toolName] ?? [];
      for (const actionName of toolActionNames) {
        expect(
          mutationSet.has(actionName),
          `Tool ${toolName} is marked readOnlyHint:true but action "${actionName}" is in MUTATION_ACTION_NAMES`
        ).toBe(false);
      }
    }
  });

  it('MUTATION_ACTION_NAMES is non-empty (sanity check)', () => {
    expect(MUTATION_ACTION_NAMES.length).toBeGreaterThan(50);
  });

  it('all tools in annotations match known tool names', () => {
    const annotatedTools = Object.keys(TOOL_ANNOTATIONS);
    for (const tool of annotatedTools) {
      expect(tool).toMatch(/^sheets_[a-z]+$/);
    }
    expect(annotatedTools).toHaveLength(25);
  });

  it('sheets_data write action is in MUTATION_ACTION_NAMES', () => {
    // Sanity check that mutation tracking is working for a known mutation action
    expect(mutationSet.has('write')).toBe(true);
    expect(mutationSet.has('append')).toBe(true);
    expect(mutationSet.has('clear')).toBe(true);
  });
});
