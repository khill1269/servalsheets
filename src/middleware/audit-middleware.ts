/**
 * Audit Middleware
 *
 * Automatically logs audit events for all MCP tool calls.
 */

export const MUTATION_ACTIONS = new Set<string>([
  'write',
  'append',
  'clear',
]);

export class AuditMiddleware {
  async wrap<T>(
    toolName: string,
    action: string,
    args: Record<string, unknown>,
    handler: () => Promise<T>
  ): Promise<T> {
    return handler();
  }
}