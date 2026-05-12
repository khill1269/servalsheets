/**
 * MCP ping/lifecycle tests using in-process InMemoryTransport.
 * Verifies the server responds to JSON-RPC ping correctly per MCP 2025-11-25.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerServalSheetsTools } from '../../src/mcp/registration/index.js';

describe('MCP ping lifecycle', () => {
  let server: McpServer;
  let client: Client;

  afterEach(async () => {
    await client?.close?.();
    await server?.close?.();
  });

  it('responds to ping with empty result object', async () => {
    server = new McpServer({ name: 'servalsheets-test', version: '1.0.0' });
    registerServalSheetsTools(server, null);

    client = new Client(
      { name: 'ping-test-client', version: '1.0.0' },
      { capabilities: {} }
    );

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    // ping() is defined in the MCP SDK Client — returns {} per spec
    const result = await client.ping();
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('handles multiple sequential pings without error', async () => {
    server = new McpServer({ name: 'servalsheets-test', version: '1.0.0' });
    registerServalSheetsTools(server, null);

    client = new Client(
      { name: 'ping-test-client', version: '1.0.0' },
      { capabilities: {} }
    );

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    await client.ping();
    await client.ping();
    await client.ping();
    // Reaches here without throwing = pass
  });
});
