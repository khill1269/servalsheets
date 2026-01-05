/**
 * MCP SDK Compatibility Patch
 *
 * Works around SDK method literal extraction with Zod v4 (def.values).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { getObjectShape } from '@modelcontextprotocol/sdk/server/zod-compat.js';

let patched = false;

export function patchMcpServerRequestHandler(): void {
  if (patched) return;
  patched = true;

  const original = Server.prototype.setRequestHandler;

  Server.prototype.setRequestHandler = function setRequestHandlerPatched(
    requestSchema: unknown,
    handler: unknown
  ) {
    const shape = getObjectShape(requestSchema as any);
    const methodSchema = shape?.['method'] as Record<string, unknown> | undefined;

    if (methodSchema && methodSchema['value'] === undefined) {
      const def = (methodSchema['_def'] as { value?: unknown; values?: unknown[] } | undefined)
        ?? ((methodSchema['_zod'] as { def?: { value?: unknown; values?: unknown[] } } | undefined)?.def);
      const literal = def?.value ?? (Array.isArray(def?.values) ? def?.values[0] : undefined);

      if (typeof literal === 'string') {
        Object.defineProperty(methodSchema, 'value', {
          value: literal,
          configurable: true,
        });
      }
    }

    return original.call(this, requestSchema as never, handler as never);
  };
}
