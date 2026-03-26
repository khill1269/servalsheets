/**
 * Request Extraction Utilities
 *
 * Helper functions for extracting action and principal from HTTP requests.
 */

function getSingleHeaderValue(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name];
  if (Array.isArray(value)) return value[0];
  return value;
}

export function extractActionFromArgs(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') return undefined;

  const argsObj = args as Record<string, unknown>;

  // Level 1: Direct action
  if (typeof argsObj['action'] === 'string') {
    return argsObj['action'];
  }

  // Level 2: Nested in request object
  const request = argsObj['request'];
  if (request && typeof request === 'object') {
    const reqObj = request as Record<string, unknown>;
    if (typeof reqObj['action'] === 'string') {
      return reqObj['action'];
    }

    // Level 3: Nested in request.request
    const innerRequest = reqObj['request'];
    if (innerRequest && typeof innerRequest === 'object') {
      const innerObj = innerRequest as Record<string, unknown>;
      if (typeof innerObj['action'] === 'string') {
        return innerObj['action'];
      }
    }
  }

  return undefined;
}

export function extractPrincipalIdFromHeaders(headers: Record<string, string | string[] | undefined>): string | undefined {
  const headerNames = ['x-user-id', 'x-session-id', 'x-client-id'];

  for (const name of headerNames) {
    const value = getSingleHeaderValue(headers, name);
    if (value) return value;
  }

  return undefined;
}
