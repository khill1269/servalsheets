import { FederationHandler } from '../handlers/federation.js';
import type { SheetsFederationInput } from '../schemas/federation.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { SessionContextManager } from '../services/session-context.js';
import { getRemoteToolClient } from '../services/remote-mcp-tool-client.js';
import { SheetsFederationInputSchemaLegacy } from './registration/tool-handler-map.js';
import { parseForHandler } from './registration/tool-arg-normalization.js';
import { dispatchToolCall, getToolRoutePolicy, type ToolTransport } from './tool-routing.js';
import { ServiceError } from '../core/errors.js';

interface SessionContextCandidate {
  trackRequest?: () => void;
  recordOperation?: SessionContextManager['recordOperation'];
}

export interface ExecuteRoutedToolCallOptions<T> {
  readonly toolName: string;
  readonly transport: ToolTransport;
  readonly args: Record<string, unknown>;
  readonly localExecute: () => Promise<T>;
  readonly sessionContext?: SessionContextCandidate | null;
}

function coerceSessionContextManager(
  sessionContext: SessionContextCandidate | null | undefined
): SessionContextManager | undefined {
  if (
    sessionContext &&
    typeof sessionContext === 'object' &&
    typeof sessionContext.recordOperation === 'function'
  ) {
    return sessionContext as SessionContextManager;
  }

  return undefined;
}

function createRemoteExecutor<T>({
  toolName,
  args,
  sessionContext,
}: Pick<ExecuteRoutedToolCallOptions<T>, 'toolName' | 'args' | 'sessionContext'>):
  | (() => Promise<T>)
  | undefined {
  if (toolName !== 'sheets_federation') {
    return undefined;
  }

  return async () => {
    const handler = new FederationHandler(undefined, {
      sessionContext: coerceSessionContextManager(sessionContext),
    });

    return (await handler.handle(
      parseForHandler<SheetsFederationInput>(
        SheetsFederationInputSchemaLegacy,
        args,
        'SheetsFederationInput',
        'sheets_federation'
      )
    )) as T;
  };
}

function unwrapRemoteCallResult<T>(result: CallToolResult | unknown): T {
  if (result && typeof result === 'object' && 'structuredContent' in result) {
    const structuredContent = (result as { structuredContent?: unknown }).structuredContent;
    if (structuredContent !== undefined) {
      return structuredContent as T;
    }
  }

  return result as T;
}

function createHostedRemoteExecutor<T>({
  toolName,
  args,
}: Pick<ExecuteRoutedToolCallOptions<T>, 'toolName' | 'args'>): (() => Promise<T>) | undefined {
  const policy = getToolRoutePolicy(toolName);
  if (!policy.remoteTransport || toolName === 'sheets_federation') {
    return undefined;
  }

  return async () => {
    const client = await getRemoteToolClient(toolName);
    if (!client) {
      throw new ServiceError(
        `Remote MCP executor is not configured or enabled for tool "${toolName}".`,
        'SERVICE_NOT_ENABLED',
        'RemoteToolRouting',
        false,
        { toolName }
      );
    }

    return unwrapRemoteCallResult<T>(await client.callRemoteTool(toolName, args));
  };
}

export async function executeRoutedToolCall<T>(
  options: ExecuteRoutedToolCallOptions<T>
): Promise<T> {
  return await dispatchToolCall({
    toolName: options.toolName,
    transport: options.transport,
    localExecute: options.localExecute,
    remoteExecute: createRemoteExecutor(options) ?? createHostedRemoteExecutor(options),
  });
}
