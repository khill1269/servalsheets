/**
 * Spreadsheet Resource Template
 *
 * URI template: spreadsheet://{spreadsheetId}
 *
 * Returns a descriptor pointing to the recommended tools for fetching live
 * spreadsheet metadata. The resource itself does NOT call Google APIs — it is
 * a static pointer/guide that helps LLM clients discover the right action to
 * use for a given spreadsheetId.
 *
 * @category Resources
 */

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { completeSpreadsheetId } from '../mcp/completions.js';

export function registerSpreadsheetResources(server: McpServer): void {
  server.registerResource(
    'Spreadsheet Descriptor',
    new ResourceTemplate('spreadsheet://{spreadsheetId}', {
      list: undefined,
      complete: {
        spreadsheetId: async (value) => completeSpreadsheetId(value),
      },
    }),
    {
      description:
        'Metadata pointer for a Google Spreadsheet. Use sheets_core action:"get" for live metadata, or sheets_analyze action:"scout" for a structure overview.',
      mimeType: 'application/json',
    },
    async (uri, { spreadsheetId }) => {
      const id = Array.isArray(spreadsheetId) ? spreadsheetId[0] : spreadsheetId;
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({
              spreadsheetId: id,
              description:
                'Use sheets_core action:"get" to fetch live spreadsheet metadata, or sheets_analyze action:"scout" for structure overview.',
              actions: {
                get: { tool: 'sheets_core', action: 'get', params: { spreadsheetId: id } },
                scout: { tool: 'sheets_analyze', action: 'scout', params: { spreadsheetId: id } },
                read: {
                  tool: 'sheets_data',
                  action: 'read',
                  params: { spreadsheetId: id, range: 'Sheet1!A1:Z100' },
                },
              },
            }),
          },
        ],
      };
    }
  );
}
