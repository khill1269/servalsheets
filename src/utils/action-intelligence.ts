/**
 * ServalSheets - Action-Level Intelligence Utilities
 *
 * Provides runtime access to per-action annotations for Claude decision-making.
 * Helps with cost awareness, idempotency, and best-practice recommendations.
 *
 * MCP 2025-11-25 compatible
 */

import { ACTION_ANNOTATIONS } from '../schemas/annotations.js';

/**
 * Get intelligence hints for an action.
 * Used by handlers to enrich responses with guidance.
 */
export function getActionHints(toolName: string, actionName: string): string[] {
  const key = `${toolName}.${actionName}`;
  const ann = ACTION_ANNOTATIONS[key];
  if (!ann) return [];

  const hints: string[] = [];

  if (ann.batchAlternative) {
    hints.push(`💡 For multiple operations, use ${ann.batchAlternative} to save API calls`);
  }

  if (ann.idempotent === false) {
    hints.push(`⚠️  This action is NOT idempotent — calling it again will duplicate the effect`);
  }

  if (ann.commonMistakes && ann.commonMistakes.length > 0) {
    hints.push(`Common mistakes: ${ann.commonMistakes[0]}`);
  }

  return hints;
}

/**
 * Get the batch alternative suggestion when Claude is making
 * multiple sequential calls to the same action.
 */
export function getBatchSuggestion(toolName: string, actionName: string): string | undefined {
  const key = `${toolName}.${actionName}`;
  return ACTION_ANNOTATIONS[key]?.batchAlternative;
}

/**
 * Check if an action is safe to retry on failure.
 */
export function isRetryable(toolName: string, actionName: string): boolean {
  const key = `${toolName}.${actionName}`;
  const ann = ACTION_ANNOTATIONS[key];
  return ann?.idempotent ?? false;
}

/**
 * Get typical API call count for an action.
 * Useful for quota planning and performance estimation.
 */
export function getApiCallCount(toolName: string, actionName: string): number {
  const key = `${toolName}.${actionName}`;
  return ACTION_ANNOTATIONS[key]?.apiCalls ?? 1;
}

/**
 * Get prerequisites for an action (actions that should run first).
 */
export function getPrerequisites(toolName: string, actionName: string): string[] {
  const key = `${toolName}.${actionName}`;
  return ACTION_ANNOTATIONS[key]?.prerequisites ?? [];
}

/**
 * Get usage guidance for an action.
 */
export interface ActionGuidance {
  whenToUse?: string;
  whenNotToUse?: string;
  commonMistakes?: string[];
}

export function getActionGuidance(toolName: string, actionName: string): ActionGuidance {
  const key = `${toolName}.${actionName}`;
  const ann = ACTION_ANNOTATIONS[key];
  if (!ann) return {};

  return {
    whenToUse: ann.whenToUse,
    whenNotToUse: ann.whenNotToUse,
    commonMistakes: ann.commonMistakes,
  };
}

/**
 * Check if an action should be warned about for specific conditions.
 * Useful for safety checks before execution.
 */
export function shouldWarnAboutIdempotency(toolName: string, actionName: string): boolean {
  const key = `${toolName}.${actionName}`;
  const ann = ACTION_ANNOTATIONS[key];
  return ann?.idempotent === false;
}

/**
 * Get all annotation keys for a tool.
 * Useful for introspection and documentation.
 */
export function getActionAnnotationKeysForTool(toolName: string): string[] {
  return Object.keys(ACTION_ANNOTATIONS).filter((key) => key.startsWith(`${toolName}.`));
}

/**
 * Check if an action has annotations (i.e., is in the intelligence database).
 */
export function hasActionAnnotations(toolName: string, actionName: string): boolean {
  const key = `${toolName}.${actionName}`;
  return key in ACTION_ANNOTATIONS;
}

/**
 * Get the complete annotation object for an action.
 */
export function getActionAnnotation(toolName: string, actionName: string) {
  const key = `${toolName}.${actionName}`;
  return ACTION_ANNOTATIONS[key];
}
