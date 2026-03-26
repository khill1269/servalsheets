/**
 * Helper functions for extracting action and principal information from requests
 */

/**
 * Extract action from nested request arguments
 * Checks up to 3 levels deep for nested request objects
 */
export function extractActionFromArgs(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') return undefined;

  const obj = args as Record<string, unknown>;

  // Level 1: Direct action property
  if (typeof obj.action === 'string') {
    return obj.action;
  }

  // Level 2: Nested in request object
  if (obj.request && typeof obj.request === 'object') {
    const req = obj.request as Record<string, unknown>;
    if (typeof req.action === 'string') {
      return req.action;
    }

    // Level 3: Nested deeper
    if (req.request && typeof req.request === 'object') {
      const deepReq = req.request as Record<string, unknown>;
      if (typeof deepReq.action === 'string') {
        return deepReq.action;
      }
    }
  }

  return undefined;
}

/**
 * Extract principal ID from request headers
 * Checks multiple header names for user/session/client identification
 */
export function extractPrincipalIdFromHeaders(
  headers: Record<string, string | string[] | undefined>
): string | undefined {
  const headerNames = ['x-user-id', 'x-session-id', 'x-client-id', 'x-principal-id'];

  for (const name of headerNames) {
    const value = headers[name] || headers[name.toLowerCase()];

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    } else if (Array.isArray(value) && value.length > 0) {
      const trimmed = value[0].trim();
      if (trimmed) return trimmed;
    }
  }

  return undefined;
}
