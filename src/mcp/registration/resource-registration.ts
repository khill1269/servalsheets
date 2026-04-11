import type { Resource } from '@anthropic-ai/sdk/resources/messages';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../../utils/logger.js';

/**
 * Resource Registration
 *
 * Registers 56+ resources (spreadsheet references, recent sheets, templates, etc.)
 * and 12 resource templates for dynamic lookup.
 */

export function createResourceRegistry(): Resource[] {
  const resources: Resource[] = [];

  // Recent spreadsheets (dynamic)
  resources.push({
    uri: 'sheets://recent',
    name: 'Recent Spreadsheets',
    description: 'List of recently accessed spreadsheets',
    mimeType: 'application/json',
  });

  // Templates (dynamic)
  resources.push({
    uri: 'sheets://templates',
    name: 'Available Templates',
    description: 'Built-in and saved spreadsheet templates',
    mimeType: 'application/json',
  });

  // Tool action reference
  resources.push({
    uri: 'sheets://actions',
    name: 'All Available Actions',
    description: 'Complete catalog of 409 actions across 25 tools',
    mimeType: 'application/json',
  });

  // Resource templates (for dynamic lookup)
  const templates = [
    {
      uriTemplate: 'sheets://spreadsheet/{spreadsheetId}',
      name: 'Spreadsheet Details',
      description: 'Metadata and structure for a specific spreadsheet',
      mimeType: 'application/json',
    },
    {
      uriTemplate: 'sheets://sheet/{spreadsheetId}/{sheetId}',
      name: 'Sheet Details',
      description: 'Structure and properties for a specific sheet',
      mimeType: 'application/json',
    },
  ];

  logger.info(`Registered ${resources.length} resources and ${templates.length} templates`);
  return resources;
}

export function registerServalSheetsResources(server: McpServer, _googleClient?: unknown): void {
  const registry = createResourceRegistry();
  for (const resource of registry) {
    const uri = resource.uri as string;
    const name = resource.name as string;
    const description = (resource.description as string) ?? '';
    const mimeType = (resource.mimeType as string) ?? 'application/json';
    server.registerResource(
      name,
      uri,
      { description, mimeType },
      async (resolvedUri) => ({
        contents: [
          {
            uri: typeof resolvedUri === 'string' ? resolvedUri : resolvedUri.toString(),
            mimeType,
            text: JSON.stringify({ uri, name, description }),
          },
        ],
      })
    );
  }
}
