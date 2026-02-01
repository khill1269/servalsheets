/**
 * ServalSheets - Resource Registration
 *
 * Resource templates and handlers for spreadsheet data access.
 *
 * @module mcp/registration/resource-registration
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GoogleApiClient } from '../../services/google-api.js';
import { completeRange, completeSpreadsheetId } from '../completions.js';
import { registerChartResources } from '../../resources/charts.js';
import { registerPivotResources } from '../../resources/pivots.js';
import { registerQualityResources } from '../../resources/quality.js';
import { createAuthRequiredError, createResourceReadError } from '../../utils/mcp-errors.js';

// ============================================================================
// RESOURCES REGISTRATION
// ============================================================================

/**
 * Registers ServalSheets resources with the MCP server
 *
 * Resources provide read-only access to spreadsheet metadata via URI templates.
 *
 * @param server - McpServer instance
 * @param googleClient - Google API client (null if not authenticated)
 */
export function registerServalSheetsResources(
  server: McpServer,
  googleClient: GoogleApiClient | null
): void {
  const spreadsheetTemplate = new ResourceTemplate('sheets:///{spreadsheetId}', {
    list: undefined,
    complete: {
      spreadsheetId: async (value) => completeSpreadsheetId(value),
    },
  });

  const rangeTemplate = new ResourceTemplate('sheets:///{spreadsheetId}/{range}', {
    list: undefined,
    complete: {
      spreadsheetId: async (value) => completeSpreadsheetId(value),
      range: async (value) => completeRange(value),
    },
  });

  server.registerResource(
    'spreadsheet',
    spreadsheetTemplate,
    {
      title: 'Spreadsheet',
      description: 'Google Sheets spreadsheet metadata (properties and sheet list)',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const rawSpreadsheetId = variables['spreadsheetId'];
      const spreadsheetId = Array.isArray(rawSpreadsheetId)
        ? rawSpreadsheetId[0]
        : rawSpreadsheetId;

      if (!spreadsheetId || typeof spreadsheetId !== 'string') {
        return { contents: [] };
      }

      if (!googleClient) {
        throw createAuthRequiredError(uri.href);
      }

      try {
        const sheetsResponse = await googleClient.sheets.spreadsheets.get({
          spreadsheetId,
          fields: 'properties,sheets.properties',
        });

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(sheetsResponse.data, null, 2),
            },
          ],
        };
      } catch (error) {
        throw createResourceReadError(uri.href, error);
      }
    }
  );

  server.registerResource(
    'spreadsheet_range',
    rangeTemplate,
    {
      title: 'Spreadsheet Range',
      description: 'Google Sheets range values (A1 notation)',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const rawSpreadsheetId = variables['spreadsheetId'];
      const rawRange = variables['range'];
      const spreadsheetId = Array.isArray(rawSpreadsheetId)
        ? rawSpreadsheetId[0]
        : rawSpreadsheetId;
      const encodedRange = Array.isArray(rawRange) ? rawRange[0] : rawRange;
      const range = typeof encodedRange === 'string' ? decodeURIComponent(encodedRange) : undefined;

      if (!spreadsheetId || typeof spreadsheetId !== 'string' || !range) {
        return { contents: [] };
      }

      if (!googleClient) {
        throw createAuthRequiredError(uri.href);
      }

      try {
        const valuesResponse = await googleClient.sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });

        // Truncate large responses to prevent MCP protocol issues
        const MAX_CELLS = 10000;
        const values = valuesResponse.data.values || [];
        const totalCells = values.reduce(
          (sum, row) => sum + (Array.isArray(row) ? row.length : 0),
          0
        );

        let result: Record<string, unknown>;

        if (totalCells > MAX_CELLS) {
          // Truncate to first N rows that fit within limit
          let cellCount = 0;
          const truncatedValues: unknown[][] = [];

          for (const row of values) {
            const rowLength = Array.isArray(row) ? row.length : 0;
            if (cellCount + rowLength > MAX_CELLS) {
              break;
            }
            truncatedValues.push(row);
            cellCount += rowLength;
          }

          result = {
            ...valuesResponse.data,
            values: truncatedValues,
            _truncated: true,
            _message: `Response truncated: ${totalCells} cells exceeds ${MAX_CELLS} limit. Use sheets_data tool with pagination for large ranges.`,
            _originalCellCount: totalCells,
          };
        } else {
          result = { ...valuesResponse.data };
        }

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        throw createResourceReadError(uri.href, error);
      }
    }
  );

  // Register additional data exploration resources
  registerChartResources(server, googleClient?.sheets ?? null);
  registerPivotResources(server, googleClient?.sheets ?? null);
  registerQualityResources(server, googleClient?.sheets ?? null);
}
