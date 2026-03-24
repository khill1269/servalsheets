import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

type RequestId = string | number;

type InitializeRequest = {
  id?: RequestId;
  method?: string;
};

type CancelNotification = {
  params?: {
    requestId?: RequestId;
  };
};

type GuardableRawServer = {
  _onrequest?: (request: InitializeRequest, extra?: unknown) => Promise<void> | void;
  _oncancel?: (notification: CancelNotification) => unknown;
};

const guardedRawServers = new WeakSet<object>();

export interface InstallInitializeCancellationGuardOptions {
  readonly onIgnoredCancellation?: (requestId: RequestId) => void;
}

/**
 * MCP §1.5 forbids clients from cancelling `initialize`.
 * The SDK's generic cancellation path can otherwise abort the in-flight init
 * request before its response is emitted if a notifications/cancelled arrives
 * in the same read cycle.
 */
export function installInitializeCancellationGuard(
  server: Pick<McpServer, 'server'>,
  options: InstallInitializeCancellationGuardOptions = {}
): boolean {
  const rawServer = server.server as unknown as GuardableRawServer;

  if (typeof rawServer !== 'object' || rawServer === null) {
    return false;
  }

  if (typeof rawServer._onrequest !== 'function' || typeof rawServer._oncancel !== 'function') {
    return false;
  }

  if (guardedRawServers.has(rawServer)) {
    return true;
  }

  guardedRawServers.add(rawServer);

  const originalOnRequest = rawServer._onrequest.bind(rawServer);
  const originalOnCancel = rawServer._oncancel.bind(rawServer);
  const protectedInitializeRequestIds = new Set<RequestId>();

  rawServer._onrequest = (request, extra) => {
    if (request.method === 'initialize' && request.id !== undefined) {
      const requestId = request.id;
      protectedInitializeRequestIds.add(requestId);

      const finalize = () => {
        protectedInitializeRequestIds.delete(requestId);
      };

      try {
        const result = originalOnRequest(request, extra) as void | Promise<void>;
        if (result && typeof result.finally === 'function') {
          return result.finally(finalize);
        }

        setImmediate(finalize);
        return result;
      } catch (error) {
        finalize();
        throw error;
      }
    }

    return originalOnRequest(request, extra);
  };

  rawServer._oncancel = (notification) => {
    const requestId = notification.params?.requestId;
    if (requestId !== undefined && protectedInitializeRequestIds.has(requestId)) {
      options.onIgnoredCancellation?.(requestId);
      return;
    }

    return originalOnCancel(notification);
  };

  return true;
}
