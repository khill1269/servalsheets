import type { Resource, TextResourceContents } from '@modelcontextprotocol/sdk/types.js';
import { TOOL_ACTIONS } from '../../mcp/completions.js';
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

// Alias for mcp/registration/index.ts re-export
export const registerServalSheetsResources = createResourceRegistry;
