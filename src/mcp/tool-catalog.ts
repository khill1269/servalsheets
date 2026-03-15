import { ACTIVE_TOOL_DEFINITIONS } from './registration/tool-definitions.js';
import { TOOL_ACTIONS } from './completions.js';

export function getConfiguredToolNames(): string[] {
  return ACTIVE_TOOL_DEFINITIONS.map((tool) => tool.name);
}

export function getConfiguredToolCount(): number {
  return getConfiguredToolNames().length;
}

export function getConfiguredActionCount(): number {
  return getConfiguredToolNames().reduce((sum, toolName) => {
    return sum + (TOOL_ACTIONS[toolName]?.length ?? 0);
  }, 0);
}
