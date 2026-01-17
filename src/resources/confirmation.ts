/**
 * ServalSheets - Confirmation Resources
 *
 * MCP Resources that provide Claude with confirmation guidance.
 * Claude can query these to understand when/how to confirm.
 *
 * @module resources/confirmation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  analyzeOperation,
  shouldConfirm,
  getConfirmationGuidance,
  CONFIRMATION_THRESHOLDS,
} from '../services/confirmation-policy.js';

// ============================================================================
// RESOURCE REGISTRATION
// ============================================================================

/**
 * Register confirmation-related resources
 */
export function registerConfirmationResources(server: McpServer): void {
  // Static resource: Confirmation guide
  server.registerResource(
    'confirmation_guide',
    new ResourceTemplate('sheets:///confirmation/guide', { list: undefined }),
    {
      title: 'Confirmation Guide',
      description: 'When and how Claude should request user confirmation',
      mimeType: 'text/markdown',
    },
    async () => {
      const guide = getConfirmationGuidance();
      const thresholds = `
## Confirmation Thresholds

### Cell Count Triggers
- **Low risk** (no confirm): < ${CONFIRMATION_THRESHOLDS.cells.low} cells
- **Medium risk** (suggest): ${CONFIRMATION_THRESHOLDS.cells.low}-${CONFIRMATION_THRESHOLDS.cells.medium} cells
- **High risk** (require): ${CONFIRMATION_THRESHOLDS.cells.medium}-${CONFIRMATION_THRESHOLDS.cells.high} cells
- **Critical** (require + snapshot): > ${CONFIRMATION_THRESHOLDS.cells.critical} cells

### Delete Triggers
- **Rows**: Confirm if deleting > ${CONFIRMATION_THRESHOLDS.delete.rows} rows
- **Columns**: Confirm if deleting > ${CONFIRMATION_THRESHOLDS.delete.columns} columns
- **Sheets**: ALWAYS confirm sheet deletion

### Multi-Step Triggers
- **Steps**: Confirm if ${CONFIRMATION_THRESHOLDS.operations.steps}+ steps
- **API Calls**: Confirm if ${CONFIRMATION_THRESHOLDS.operations.apiCalls}+ API calls
`;

      return {
        contents: [
          {
            uri: 'sheets:///confirmation/guide',
            mimeType: 'text/markdown',
            text: guide + thresholds,
          },
        ],
      };
    }
  );

  // Dynamic resource: Check if operation needs confirmation
  const checkTemplate = new ResourceTemplate('sheets:///confirmation/check/{tool}/{action}', {
    list: undefined,
  });

  server.registerResource(
    'confirmation_check',
    checkTemplate,
    {
      title: 'Check Confirmation Requirement',
      description: 'Check if a specific operation requires user confirmation',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const tool = Array.isArray(variables['tool']) ? variables['tool'][0] : variables['tool'];
      const action = Array.isArray(variables['action'])
        ? variables['action'][0]
        : variables['action'];

      if (!tool || !action) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify({ error: 'Missing tool or action' }),
            },
          ],
        };
      }

      // Analyze with default parameters
      const analysis = analyzeOperation({
        tool: `sheets_${tool}`,
        action,
      });

      const decision = shouldConfirm({
        tool: `sheets_${tool}`,
        action,
      });

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                tool,
                action,
                analysis: {
                  isDestructive: analysis.isDestructive,
                  canUndo: analysis.canUndo,
                  riskLevel: analysis.risk.level,
                  reason: analysis.risk.reason,
                },
                decision: {
                  shouldConfirm: decision.confirm,
                  reason: decision.reason,
                  suggestDryRun: decision.suggestDryRun,
                  suggestSnapshot: decision.suggestSnapshot,
                },
                guidance: analysis.risk.warning || null,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Resource: Quick reference for destructive operations
  server.registerResource(
    'destructive_operations',
    new ResourceTemplate('sheets:///confirmation/destructive', {
      list: undefined,
    }),
    {
      title: 'Destructive Operations List',
      description: 'List of operations that are destructive and require confirmation',
      mimeType: 'application/json',
    },
    async () => {
      const destructive = [
        {
          tool: 'sheets_data',
          action: 'clear',
          description: 'Clear cell contents',
        },
        {
          tool: 'sheets_sheet',
          action: 'delete',
          description: 'Delete entire sheet',
        },
        {
          tool: 'sheets_dimensions',
          action: 'delete_rows',
          description: 'Delete rows',
        },
        {
          tool: 'sheets_dimensions',
          action: 'delete_columns',
          description: 'Delete columns',
        },
        {
          tool: 'sheets_rules',
          action: 'remove_rule',
          description: 'Remove validation/formatting rules',
        },
        {
          tool: 'sheets_visualize',
          action: 'delete',
          description: 'Delete chart',
        },
        {
          tool: 'sheets_pivot',
          action: 'delete',
          description: 'Delete pivot table',
        },
        {
          tool: 'sheets_advanced',
          action: 'remove_protection',
          description: 'Remove sheet/range protection',
        },
        {
          tool: 'sheets_sharing',
          action: 'revoke',
          description: 'Revoke user access',
        },
        {
          tool: 'sheets_comments',
          action: 'delete',
          description: 'Delete comments',
        },
      ];

      return {
        contents: [
          {
            uri: 'sheets:///confirmation/destructive',
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                title: 'Destructive Operations - ALWAYS Confirm',
                operations: destructive,
                rule: 'These operations can cause data loss. ALWAYS use sheets_confirm before executing.',
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ConfirmationResources = {
  registerConfirmationResources,
};
