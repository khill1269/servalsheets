import { getToolRoutePolicy } from './tool-route-manifest.js';
import type {
  DispatchToolCallOptions,
  ResolveExecutionTargetOptions,
  ToolExecutionTarget,
} from './types.js';

export function resolveExecutionTarget({
  toolName,
  transport,
  hasRemoteExecutor,
  policy = getToolRoutePolicy(toolName),
}: ResolveExecutionTargetOptions): ToolExecutionTarget {
  switch (policy.mode) {
    case 'local':
      return 'local';
    case 'remote':
      if (!hasRemoteExecutor) {
        throw new Error(
          `Tool "${toolName}" is marked remote but no remote executor was provided for ${transport}.`
        );
      }
      return 'remote';
    case 'prefer_local':
      return 'local';
    case 'disabled_on_stdio':
      if (transport === 'stdio') {
        throw new Error(`Tool "${toolName}" is disabled on STDIO transport.`);
      }
      return 'local';
  }
}

export async function dispatchToolCall<T>({
  toolName,
  transport,
  localExecute,
  remoteExecute,
  policy,
}: DispatchToolCallOptions<T>): Promise<T> {
  const target = resolveExecutionTarget({
    toolName,
    transport,
    hasRemoteExecutor: typeof remoteExecute === 'function',
    policy,
  });

  if (target === 'remote') {
    return await remoteExecute!();
  }

  return await localExecute();
}
