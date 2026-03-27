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

type HostedFailoverErrorCode = 'INTERNAL_ERROR' | 'UNKNOWN_ERROR';

const HOSTED_FAILOVER_ERROR_CODES = new Set<HostedFailoverErrorCode>([
  'INTERNAL_ERROR',
  'UNKNOWN_ERROR',
]);

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

  return undefined; // OK: Explicit empty
}

function createRemoteExecutor<T>({
  toolName,
  args,
  sessionContext,
}: Pick<ExecuteRoutedToolCallOptions<T>, 'toolName' | 'args' | 'sessionContext'>):
  | (() => Promise<T>)
  | undefined {
  if (toolName !== 'sheets_federation') {
    return undefined; // OK: Explicit empty
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

function assertHostedFailoverEligible(result: unknown): void {
  if (!result || typeof result !== 'object' || !('response' in result)) {
    return;
  }

  const response = (result as { response?: unknown }).response;
  if (!response || typeof response !== 'object') {
    return;
  }

  if ((response as { success?: unknown }).success !== false) {
    return;
  }

  const error = (response as { error?: unknown }).error;
  if (!error || typeof error !== 'object') {
    return;
  }

  const code = (error as { code?: unknown }).code;
  if (
    typeof code === 'string' &&
    HOSTED_FAILOVER_ERROR_CODES.has(code as HostedFailoverErrorCode)
  ) {
    const message =
      typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : `Local ${code.toLowerCase()} response`;
    throw new ServiceError(
      message,
      code as HostedFailoverErrorCode,
      'HostedRemoteFailover',
      false,
      {
        localResult: result,
      }
    );
  }
}

function createHostedRemoteExecutor<T>({
  toolName,
  args,
}: Pick<ExecuteRoutedToolCallOptions<T>, 'toolName' | 'args'>): (() => Promise<T>) | undefined {
  const policy = getToolRoutePolicy(toolName);
  if (!policy.remoteTransport || toolName === 'sheets_federation') {
    return undefined; // OK: Explicit empty
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
    localExecute: async () => {
      const result = await options.localExecute();
      assertHostedFailoverEligible(result);
      return result;
    },
    remoteExecute: createRemoteExecutor(options) ?? createHostedRemoteExecutor(options),
  });
}
