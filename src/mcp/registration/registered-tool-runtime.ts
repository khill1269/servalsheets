import type { ToolExecution } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export type RegisteredToolHandler = ((
  args: Record<string, unknown>,
  extra?: unknown
) => Promise<CallToolResult>) & {
  createTask?: unknown;
};

export interface RegisteredToolRuntimeEntry {
  enabled: boolean;
  execution?: ToolExecution;
  handler: RegisteredToolHandler;
}

const registeredToolRuntime = new Map<string, RegisteredToolRuntimeEntry>();

export function resetRegisteredToolRuntime(): void {
  registeredToolRuntime.clear();
}

export function setRegisteredToolRuntime(
  toolName: string,
  entry: RegisteredToolRuntimeEntry
): void {
  registeredToolRuntime.set(toolName, entry);
}

export function getRegisteredToolRuntime(toolName: string): RegisteredToolRuntimeEntry | undefined {
  return registeredToolRuntime.get(toolName);
}
