/**
 * ServalSheets - Resource Registration
 *
 * Resource templates and handlers for spreadsheet data access.
 *
 * @module mcp/registration/resource-registration
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GoogleApiClient } from '../../services/google-api.js';
import { completeAction, completeRange, completeSpreadsheetId, TOOL_ACTIONS } from '../completions.js';
import { registerChartResources } from '../../resources/charts.js';
import { registerPivotResources } from '../../resources/pivots.js';
import { registerQualityResources } from '../../resources/quality.js';
import { createAuthRequiredError, createResourceReadError } from '../../utils/mcp-errors.js';

// ============================================================================
// RESOURCES REGISTRATION
// ============================================================================

// Guard against double-registration (SDK throws if a resource template name is reused)
const registeredServers = new WeakSet<McpServer>();

/**
 * Registers ServalSheets resources with the MCP server
 *
 * Resources provide read-only access to spreadsheet metadata via URI templates.
 * Note: resources/list uses SDK's built-in handler. Cursor pagination is not needed
 * with <10 resource templates. The SDK returns all resources in a single page per
 * MCP 2025-11-25 spec (cursor pagination is optional for small collections).
 *
 * @param server - McpServer instance
 * @param googleClient - Google API client (null if not authenticated)
 */
export function registerServalSheetsResources(
  server: McpServer,
  googleClient: GoogleApiClient | null
): void {
  if (registeredServers.has(server)) {
    return; // Already registered on this server instance
  }
  registeredServers.add(server);
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

      // P1-2: Parse pagination parameters from query string
      // URI format: sheets:///spreadsheetId/range?_limit=100&_offset=0
      const DEFAULT_LIMIT = 10000; // Max cells per response
      const parsedUrl = new URL(uri.href, 'sheets://localhost');
      const limitParam = parsedUrl.searchParams.get('_limit');
      const offsetParam = parsedUrl.searchParams.get('_offset');
      const limit = limitParam ? Math.min(parseInt(limitParam, 10), DEFAULT_LIMIT) : DEFAULT_LIMIT;
      const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

      try {
        const valuesResponse = await googleClient.sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });

        const allValues = valuesResponse.data.values || [];
        const totalRows = allValues.length;
        const totalCells = allValues.reduce(
          (sum, row) => sum + (Array.isArray(row) ? row.length : 0),
          0
        );

        // Apply pagination (row-based offset and cell-based limit)
        let paginatedValues: unknown[][];
        let cellCount = 0;

        if (offset > 0) {
          // Skip offset rows
          paginatedValues = [];
          for (let i = offset; i < allValues.length; i++) {
            const row = allValues[i]!;
            const rowLength = Array.isArray(row) ? row.length : 0;
            if (cellCount + rowLength > limit) {
              break;
            }
            paginatedValues.push(row);
            cellCount += rowLength;
          }
        } else {
          // Apply cell limit from start
          paginatedValues = [];
          for (const row of allValues) {
            const rowLength = Array.isArray(row) ? row.length : 0;
            if (cellCount + rowLength > limit) {
              break;
            }
            paginatedValues.push(row);
            cellCount += rowLength;
          }
        }

        const hasMore = offset + paginatedValues.length < totalRows;
        const nextOffset = offset + paginatedValues.length;

        // Build result with pagination metadata
        const result: Record<string, unknown> = {
          ...valuesResponse.data,
          values: paginatedValues,
          _pagination: {
            offset,
            limit,
            totalRows,
            totalCells,
            returnedRows: paginatedValues.length,
            hasMore,
            ...(hasMore && {
              nextUri: `sheets:///${spreadsheetId}/${encodeURIComponent(range)}?_limit=${limit}&_offset=${nextOffset}`,
            }),
          },
        };

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

  // Full context resource — structural metadata for LLM context injection
  const contextTemplate = new ResourceTemplate('sheets:///{spreadsheetId}/context', {
    list: undefined,
    complete: {
      spreadsheetId: async (value) => completeSpreadsheetId(value),
    },
  });

  server.registerResource(
    'spreadsheet_context',
    contextTemplate,
    {
      title: 'Spreadsheet Full Context',
      description:
        'Complete spreadsheet structural metadata: sheets, charts, named ranges, protected ranges, conditional formats, filter views, slicers. Optimized field mask — no cell data.',
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
        const response = await googleClient.sheets.spreadsheets.get({
          spreadsheetId,
          fields: [
            'properties(title,locale,timeZone,defaultFormat)',
            'sheets(properties,conditionalFormats,charts,protectedRanges,bandedRanges',
            'filterViews,slicers,merges,basicFilter)',
            'namedRanges',
          ].join(','),
        });

        const data = response.data;
        const context = {
          spreadsheetId,
          title: data.properties?.title,
          locale: data.properties?.locale,
          timeZone: data.properties?.timeZone,
          sheets: (data.sheets || []).map((s) => ({
            sheetId: s.properties?.sheetId,
            title: s.properties?.title,
            rowCount: s.properties?.gridProperties?.rowCount,
            columnCount: s.properties?.gridProperties?.columnCount,
            frozenRows: s.properties?.gridProperties?.frozenRowCount || 0,
            frozenColumns: s.properties?.gridProperties?.frozenColumnCount || 0,
            chartCount: s.charts?.length || 0,
            conditionalFormatCount: s.conditionalFormats?.length || 0,
            protectedRangeCount: s.protectedRanges?.length || 0,
            filterViewCount: s.filterViews?.length || 0,
            slicerCount: s.slicers?.length || 0,
            mergeCount: s.merges?.length || 0,
            hasBasicFilter: !!s.basicFilter,
            bandedRangeCount: s.bandedRanges?.length || 0,
          })),
          namedRangeCount: data.namedRanges?.length || 0,
          namedRanges: (data.namedRanges || []).map((nr) => ({
            name: nr.name,
            range: nr.range,
          })),
        };

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(context, null, 2),
            },
          ],
        };
      } catch (error) {
        throw createResourceReadError(uri.href, error);
      }
    }
  );

  // Action completion template — enables completeAction() via MCP completion protocol.
  // Clients can request completions for sheets://tools/{toolName}/actions/{action} URIs.
  // The action completer reads toolName from the completion context (MCP 2025-11-25 context.arguments).
  const toolActionTemplate = new ResourceTemplate('sheets://tools/{toolName}/actions/{action}', {
    list: undefined,
    complete: {
      toolName: async (value) =>
        Object.keys(TOOL_ACTIONS).filter((t) => t.startsWith(value || '')),
      action: async (value, context) => {
        const ctx = context as { arguments?: Record<string, string> } | undefined;
        const toolName = ctx?.arguments?.['toolName'] ?? '';
        return completeAction(toolName, value || '');
      },
    },
  });

  server.registerResource(
    'tool_action',
    toolActionTemplate,
    {
      title: 'Tool Action',
      description: 'ServalSheets tool action reference. Use for action name autocompletion.',
      mimeType: 'application/json',
    },
    async (_uri, _variables) => {
      return { contents: [] }; // completions-only resource; no read content
    }
  );

  // Register additional data exploration resources
  registerChartResources(server, googleClient?.sheets ?? null);
  registerPivotResources(server, googleClient?.sheets ?? null);
  registerQualityResources(server, googleClient?.sheets ?? null);
}
