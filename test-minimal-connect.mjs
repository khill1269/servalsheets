import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

console.error('[TEST] Creating McpServer...');
const server = new McpServer(
  { name: 'test-server', version: '1.0.0' },
  { capabilities: {} }
);

console.error('[TEST] Creating transport...');
const transport = new StdioServerTransport();

console.error('[TEST] About to call connect()...');
const startTime = Date.now();
try {
  await server.connect(transport);
  const elapsed = Date.now() - startTime;
  console.error(`[TEST] connect() completed in ${elapsed}ms!`);
  console.error('[TEST] Server is now connected and ready');
} catch (error) {
  const elapsed = Date.now() - startTime;
  console.error(`[TEST] connect() failed after ${elapsed}ms:`, error);
}
