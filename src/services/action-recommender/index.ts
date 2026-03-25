/**
 * Action Recommender Service — thin re-export facade
 *
 * Provides intelligent suggestions for next actions based on what the user just did.
 * After a successful tool call, this service recommends what to do next based on
 * pattern matching against the tool and action that just completed.
 *
 * Used to make ServalSheets more proactive and assist the Claude LLM in
 * discovering powerful chaining patterns.
 *
 * Implementation split into src/services/action-recommender/ submodules:
 * - recommendation-rules.ts: All pure data constants
 * - data-signals.ts: All logic functions
 */

import {
  type SuggestedAction,
  RECOMMENDATION_RULES,
  ERROR_RECOVERY_RULES,
  RANGE_CARRYING_ACTIONS,
  WORKFLOW_CHAINS,
} from './recommendation-rules.js';

export type { SuggestedAction } from './recommendation-rules.js';
export { getDataAwareSuggestions } from './data-signals.js';

/**
 * Get recommended next actions based on a tool and action that just completed.
 *
 * @param toolName - The tool that just executed (e.g., 'sheets_data')
 * @param action - The action that just executed (e.g., 'read')
 * @returns Array of SuggestedAction objects (0-3 items), ordered by relevance
 */
export function getRecommendedActions(toolName: string, action: string): SuggestedAction[] {
  const key = `${toolName}.${action}`;
  return RECOMMENDATION_RULES[key] || [];
}

/**
 * Get recovery actions for a specific error code.
 *
 * @param errorCode - The error code from a failed tool call
 * @param context - Optional spreadsheetId/range to pre-fill params
 * @returns Array of SuggestedAction objects with recovery guidance
 */
export function getErrorRecoveryActions(
  errorCode: string,
  context?: { spreadsheetId?: string; range?: string }
): SuggestedAction[] {
  const rules = ERROR_RECOVERY_RULES[errorCode];
  if (!rules) return [];

  // Pre-fill context params when available
  if (context?.spreadsheetId) {
    return rules.map((rule) => ({
      ...rule,
      params: {
        spreadsheetId: context.spreadsheetId,
        ...(context.range &&
          RANGE_CARRYING_ACTIONS.has(`${rule.tool}.${rule.action}`) && {
            range: context.range,
          }),
      },
    }));
  }

  return rules;
}

/**
 * Get workflow chain suggestions when the completed action is the start of a known pattern.
 * Returns only the FIRST step of the chain (the immediate next action) plus a workflow label.
 */
export function getWorkflowChainSuggestion(
  toolName: string,
  action: string,
  context?: { spreadsheetId?: string; range?: string }
): SuggestedAction | null {
  const key = `${toolName}.${action}`;
  const chain = WORKFLOW_CHAINS.find((c) => c.trigger === key);
  if (!chain || chain.steps.length === 0) return null;

  const firstStep = { ...chain.steps[0]! };
  firstStep.reason = `[${chain.workflow}] ${firstStep.reason}`;

  // Pre-fill params
  if (context?.spreadsheetId) {
    firstStep.params = {
      spreadsheetId: context.spreadsheetId,
      ...(context.range &&
        RANGE_CARRYING_ACTIONS.has(`${firstStep.tool}.${firstStep.action}`) && {
          range: context.range,
        }),
    };
  }

  return firstStep;
}
