/**
 * ServalSheets - Schema Resources
 *
 * Provides on-demand access to full tool schemas when DEFER_SCHEMAS is enabled.
 * This allows tools to be registered with minimal schemas while full schemas
 * are available via MCP resources.
 *
 * URI Pattern: schema://tools/{toolName}
 *
 * @module resources/schemas
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TOOL_DEFINITIONS } from '../mcp/registration/tool-definitions.js';
import { zodSchemaToJsonSchema } from '../utils/schema-compat.js';
import { logger } from '../utils/logger.js';

/**
 * Schema resource content cache
 * Caches converted JSON schemas to avoid repeated conversions
 */
const schemaCache = new Map<string, string>();

/**
 * Get the full JSON Schema for a tool
 *
 * @param toolName - Name of the tool (e.g., 'sheets_core')
 * @returns JSON string of the full schema, or null if not found
 */
export function getToolSchema(toolName: string): string | null {
  // Check cache first
  const cached = schemaCache.get(toolName);
  if (cached) {
    return cached;
  }

  // Find the tool definition
  const tool = TOOL_DEFINITIONS.find((t) => t.name === toolName);
  if (!tool) {
    return null;
  }

  // Convert Zod schema to JSON Schema
  const jsonSchema = zodSchemaToJsonSchema(tool.inputSchema);

  // Build complete schema document with metadata
  const schemaDoc = {
    $id: `schema://tools/${toolName}`,
    title: toolName,
    description: tool.description,
    inputSchema: jsonSchema,
    annotations: tool.annotations,
  };

  const content = JSON.stringify(schemaDoc, null, 2);

  // Cache for future requests
  schemaCache.set(toolName, content);

  return content;
}

/**
 * Get a summary of all available tool schemas
 *
 * @returns JSON string with tool names and brief descriptions
 */
export function getSchemaIndex(): string {
  const index = {
    $id: 'schema://tools',
    title: 'ServalSheets Tool Schemas',
    description:
      'Index of all available tool schemas. Read individual schema resources for full details.',
    tools: TOOL_DEFINITIONS.map((tool) => ({
      name: tool.name,
      uri: `schema://tools/${tool.name}`,
      title: tool.annotations.title || tool.name,
      readOnlyHint: tool.annotations.readOnlyHint,
      destructiveHint: tool.annotations.destructiveHint,
    })),
    usage: {
      instructions:
        'Before calling a tool, read its schema resource to understand available actions and parameters.',
      example:
        'Read schema://tools/sheets_data to see all data operations (read, write, append, etc.)',
    },
  };

  return JSON.stringify(index, null, 2);
}

/**
 * Read a schema resource by URI
 *
 * @param uri - Resource URI (schema://tools or schema://tools/{toolName})
 * @returns Resource contents
 */
export async function readSchemaResource(
  uri: string
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  // Handle index request
  if (uri === 'schema://tools' || uri === 'schema://tools/') {
    return {
      contents: [
        {
          uri: 'schema://tools',
          mimeType: 'application/json',
          text: getSchemaIndex(),
        },
      ],
    };
  }

  // Extract tool name from URI
  const match = uri.match(/^schema:\/\/tools\/([a-z_]+)$/);
  if (!match) {
    throw new Error(`Invalid schema URI: ${uri}. Expected schema://tools/{toolName}`);
  }

  const toolName = match[1]!;
  const content = getToolSchema(toolName);

  if (!content) {
    throw new Error(`Unknown tool: ${toolName}. Use schema://tools to see available tools.`);
  }

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: content,
      },
    ],
  };
}

/**
 * Register schema resources with the MCP server
 *
 * Registers resources for tool schema access:
 * - schema://tools - Index of all tool schemas
 * - schema://tools/{toolName} - Full schema for a specific tool
 *
 * When DEFER_SCHEMAS is enabled, Claude should read these resources
 * before calling tools to understand available actions.
 *
 * @param server - McpServer instance
 */
export function registerSchemaResources(server: McpServer): void {
  try {
    // Schema index - lists all available tool schemas
    server.registerResource(
      'Tool Schema Index',
      'schema://tools',
      {
        description:
          'Index of all ServalSheets tool schemas. Lists 19 tools with their URIs and metadata.',
        mimeType: 'application/json',
      },
      async (uri) => readSchemaResource(typeof uri === 'string' ? uri : String(uri))
    );

    // Register resource template for individual tool schemas
    // Uses URI template syntax supported by MCP 2025-11-25
    server.registerResource(
      'Tool Schema',
      'schema://tools/{toolName}',
      {
        description:
          'Full JSON Schema for a specific tool. Includes all actions, parameters, and validation rules.',
        mimeType: 'application/json',
      },
      async (uri) => readSchemaResource(typeof uri === 'string' ? uri : String(uri))
    );

    logger.info('Schema resources registered', {
      component: 'resources/schemas',
      toolCount: TOOL_DEFINITIONS.length,
    });
  } catch (error) {
    logger.error('Failed to register schema resources', {
      component: 'resources/schemas',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
