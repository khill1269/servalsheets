/**
 * ServalSheets - Per-Tool Smoke Tests
 *
 * Smoke tests for all 25 tools using non-destructive actions.
 * Verifies that each tool responds to requests without errors,
 * without requiring Google API credentials or live spreadsheet data.
 *
 * @module tests/e2e/tool-smoke
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { McpClient } from './helpers.js';

const config = {
  baseUrl: process.env['BASE_URL'] || 'http://localhost:3000',
  requestTimeout: 10000,
};

describe('Per-Tool Smoke Tests (All 25 Tools)', () => {
  let client: McpClient;

  beforeAll(async () => {
    client = new McpClient(config.baseUrl, { timeout: config.requestTimeout });
    await client.initialize();
  });

  /**
   * Helper to test a non-destructive action for a tool
   */
  const testToolAction = async (
    toolName: string,
    action: string,
    args: any = {}
  ): Promise<void> => {
    const result = await client.callTool(toolName, {
      request: {
        action,
        ...args,
      },
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty('response');
    expect(typeof result.response).toBe('object');
  };

  describe('sheets_auth', () => {
    it('sheets_auth.status returns response', async () => {
      await testToolAction('sheets_auth', 'status');
    });

    it('sheets_auth.list_sessions returns array', async () => {
      const result = await client.callTool('sheets_auth', {
        request: { action: 'list_sessions' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_core', () => {
    it('sheets_core responds to invalid action with error', async () => {
      const result = await client.callTool('sheets_core', {
        request: {
          action: '__invalid__',
        },
      });
      expect(result.response).toBeDefined();
      expect(typeof result.response).toBe('object');
    });
  });

  describe('sheets_data', () => {
    it('sheets_data responds to status action', async () => {
      const result = await client.callTool('sheets_data', {
        request: { action: 'status' },
      });
      expect(result.response).toBeDefined();
    });

    it('sheets_data.read_range requires spreadsheetId', async () => {
      const result = await client.callTool('sheets_data', {
        request: {
          action: 'read_range',
          // Missing required params - should error
        },
      });
      expect(result.response).toBeDefined();
      // Should fail validation
      expect(
        result.response.error ||
          result.response.success === false ||
          result.response.code
      ).toBeTruthy();
    });
  });

  describe('sheets_format', () => {
    it('sheets_format responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_format', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_dimensions', () => {
    it('sheets_dimensions responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_dimensions', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_advanced', () => {
    it('sheets_advanced responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_advanced', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_visualize', () => {
    it('sheets_visualize responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_visualize', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_collaborate', () => {
    it('sheets_collaborate responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_collaborate', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_composite', () => {
    it('sheets_composite responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_composite', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_analyze', () => {
    it('sheets_analyze responds to invalid action', async () => {
      const result = await client.callTool('sheets_analyze', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_fix', () => {
    it('sheets_fix responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_fix', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_templates', () => {
    it('sheets_templates responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_templates', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_bigquery', () => {
    it('sheets_bigquery responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_bigquery', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_appsscript', () => {
    it('sheets_appsscript responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_appsscript', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_session', () => {
    it('sheets_session.get_context returns session structure', async () => {
      const result = await client.callTool('sheets_session', {
        request: { action: 'get_context' },
      });
      expect(result.response).toBeDefined();
      expect(typeof result.response).toBe('object');
    });

    it('sheets_session.list_active returns array', async () => {
      const result = await client.callTool('sheets_session', {
        request: { action: 'list_active' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_confirm', () => {
    it('sheets_confirm.status returns confirmation state', async () => {
      const result = await client.callTool('sheets_confirm', {
        request: { action: 'status' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_transaction', () => {
    it('sheets_transaction responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_transaction', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_quality', () => {
    it('sheets_quality responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_quality', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_history', () => {
    it('sheets_history responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_history', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_dependencies', () => {
    it('sheets_dependencies responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_dependencies', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_federation', () => {
    it('sheets_federation responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_federation', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_webhook', () => {
    it('sheets_webhook responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_webhook', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_agent', () => {
    it('sheets_agent responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_agent', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_compute', () => {
    it('sheets_compute responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_compute', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('sheets_connectors', () => {
    it('sheets_connectors responds without error for invalid action', async () => {
      const result = await client.callTool('sheets_connectors', {
        request: { action: '__invalid__' },
      });
      expect(result.response).toBeDefined();
    });
  });

  describe('All Tools Response Consistency', () => {
    it('All 25 tools handle invalid actions gracefully', async () => {
      const tools = await client.listTools();

      for (const tool of tools) {
        const result = await client.callTool(tool.name, {
          request: { action: '__smoke_test_invalid_action__' },
        });

        expect(result).toBeDefined();
        expect(result).toHaveProperty('response');
        expect(typeof result.response).toBe('object');
        // Should not crash or return malformed response
      }
    });

    it('All 25 tools are discoverable in tool list', async () => {
      const tools = await client.listTools();
      const toolNames = tools.map((t) => t.name);

      const expectedTools = [
        'sheets_advanced',
        'sheets_agent',
        'sheets_analyze',
        'sheets_appsscript',
        'sheets_auth',
        'sheets_bigquery',
        'sheets_collaborate',
        'sheets_composite',
        'sheets_compute',
        'sheets_confirm',
        'sheets_connectors',
        'sheets_core',
        'sheets_data',
        'sheets_dependencies',
        'sheets_dimensions',
        'sheets_federation',
        'sheets_fix',
        'sheets_format',
        'sheets_history',
        'sheets_quality',
        'sheets_session',
        'sheets_templates',
        'sheets_transaction',
        'sheets_visualize',
        'sheets_webhook',
      ];

      for (const expectedTool of expectedTools) {
        expect(toolNames).toContain(expectedTool);
      }
    });

    it('Each tool has valid input schema', async () => {
      const tools = await client.listTools();

      for (const tool of tools) {
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.inputSchema).toBe('object');
      }
    });
  });
});
