/**
 * ServalSheets - tools/list Compatibility Handler
 *
 * Overrides the MCP SDK tools/list handler to safely convert Zod v4 schemas
 * (including transforms/pipes) into JSON Schema without throwing.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { zodSchemaToJsonSchema } from '../../utils/schema-compat.js';

const EMPTY_OBJECT_JSON_SCHEMA = { type: 'object', properties: {} };

function isZodSchema(schema: unknown): boolean {
  return Boolean(
    schema &&
    typeof schema === 'object' &&
    ('_def' in (schema as Record<string, unknown>) || '_zod' in (schema as Record<string, unknown>))
  );
}

function toJsonSchema(schema: unknown): Record<string, unknown> {
  if (!schema) {
    return EMPTY_OBJECT_JSON_SCHEMA;
  }
  if (isZodSchema(schema)) {
    try {
      return zodSchemaToJsonSchema(schema as unknown as import('zod').ZodTypeAny);
    } catch {
      return EMPTY_OBJECT_JSON_SCHEMA;
    }
  }
  if (typeof schema === 'object') {
    return schema as Record<string, unknown>;
  }
  return EMPTY_OBJECT_JSON_SCHEMA;
}

export function registerToolsListCompatibilityHandler(server: McpServer): void {
  const protocolServer = server.server as unknown as {
    setRequestHandler: typeof server.server.setRequestHandler;
  };

  const registeredTools = (
    server as unknown as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK internal property type
      _registeredTools?: Record<string, any>;
    }
  )._registeredTools;

  protocolServer.setRequestHandler(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK schema is runtime-validated
    ListToolsRequestSchema as any,
    () => ({
      tools: Object.entries(registeredTools ?? {})
        .filter(([, tool]) => tool?.enabled !== false)
        .map(([name, tool]) => {
          const toolDefinition: Record<string, unknown> = {
            name,
            title: tool.title,
            description: tool.description,
            inputSchema: toJsonSchema(tool.inputSchema),
            annotations: tool.annotations,
            execution: tool.execution,
            _meta: tool._meta,
          };

          if (tool.outputSchema) {
            toolDefinition['outputSchema'] = toJsonSchema(tool.outputSchema);
          }

          return toolDefinition;
        }),
    })
  );
}
