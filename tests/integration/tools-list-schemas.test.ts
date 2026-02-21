import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ServalSheetsServer } from '../../src/server.js';

type ListToolsResponse = {
  tools: Array<{
    name: string;
    inputSchema: { type: string; properties?: Record<string, unknown>; [key: string]: unknown };
    outputSchema?: { type: string; properties?: Record<string, unknown>; [key: string]: unknown };
  }>;
};

async function requestToolsList(server: ServalSheetsServer): Promise<ListToolsResponse> {
  const mcpServer = server.server;
  const protocolServer = (
    mcpServer as unknown as { server: { _requestHandlers?: Map<string, any> } }
  ).server;
  const handler = protocolServer?._requestHandlers?.get('tools/list');
  if (!handler) {
    throw new Error('tools/list handler not registered');
  }
  return handler({ method: 'tools/list', params: {} }, { sessionId: 'test' });
}

describe('tools/list Schema Serialization', () => {
  let server: ServalSheetsServer;

  beforeAll(async () => {
    // Create server instance (applies SDK patch)
    server = new ServalSheetsServer({
      name: 'ServalSheets Test',
      version: '1.0.0-test',
    });

    // Initialize to register tools
    await server.initialize();
  });

  afterAll(async () => {
    // Clean shutdown
    await server.shutdown();
  });

  it('should return non-empty schemas for all 22 tools', async () => {
    // Call tools/list via MCP protocol
    const response = await requestToolsList(server);

    expect(response).toBeDefined();
    expect(response.tools).toBeInstanceOf(Array);
    expect(response.tools).toHaveLength(22);

    // Check each tool has non-empty schema
    for (const tool of response.tools) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();

      const properties = tool.inputSchema.properties as Record<string, unknown>;
      const propertyCount = Object.keys(properties).length;
      expect(propertyCount).toBeGreaterThan(0);

      // Should NOT be the empty schema bug
      expect(tool.inputSchema).not.toEqual({
        type: 'object',
        properties: {},
      });
    }
  });

  it('should handle z.preprocess tools correctly', async () => {
    const preprocessTools = [
      'sheets_confirm',
      'sheets_data',
      'sheets_format',
      'sheets_dimensions',
      'sheets_quality',
    ];

    const response = await requestToolsList(server);

    for (const toolName of preprocessTools) {
      const tool = response.tools.find((t) => t.name === toolName);
      expect(tool, `Tool ${toolName} should be registered`).toBeDefined();
      expect(tool!.inputSchema.properties).toBeDefined();

      const propertyCount = Object.keys(tool!.inputSchema.properties).length;
      expect(propertyCount, `Tool ${toolName} should have non-empty schema`).toBeGreaterThan(0);
    }
  });

  it('should expose request property for all tools', async () => {
    const response = await requestToolsList(server);

    // All ServalSheets tools use { request: ... } pattern
    for (const tool of response.tools) {
      expect(
        tool.inputSchema.properties.request,
        `Tool ${tool.name} should have request property`
      ).toBeDefined();

      // Request should have oneOf or properties
      const request = tool.inputSchema.properties.request as Record<string, unknown>;
      const hasOneOf = 'oneOf' in request;
      const hasProperties = 'properties' in request;

      expect(
        hasOneOf || hasProperties,
        `Tool ${tool.name} request should have oneOf or properties`
      ).toBe(true);
    }
  });

  it('should handle outputSchema registration', async () => {
    const response = await requestToolsList(server);

    // Output schemas are optional in MCP, but if present should be valid
    for (const tool of response.tools) {
      if (tool.outputSchema) {
        expect(tool.outputSchema.type).toBe('object');
        expect(tool.outputSchema.properties).toBeDefined();

        // Should not be empty
        const properties = tool.outputSchema.properties as Record<string, unknown>;
        const propertyCount = Object.keys(properties).length;
        expect(
          propertyCount,
          `Tool ${tool.name} should have non-empty output schema`
        ).toBeGreaterThan(0);
      }
    }
  });
});
