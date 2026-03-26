import { InMemoryTaskMessageQueue } from '@modelcontextprotocol/sdk/experimental/tasks/stores/in-memory.js';
import type {
  TaskMessageQueue,
  TaskStore,
} from '@modelcontextprotocol/sdk/experimental/tasks/interfaces.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

type McpServerIdentity = ConstructorParameters<typeof McpServer>[0];
type McpServerOptions = NonNullable<ConstructorParameters<typeof McpServer>[1]>;

export interface CreateBaseMcpServerOptions {
  readonly serverInfo: McpServerIdentity;
  readonly capabilities: McpServerOptions['capabilities'];
  readonly instructions?: McpServerOptions['instructions'];
  readonly taskStore?: TaskStore;
  readonly taskMessageQueue?: TaskMessageQueue;
}

export function createBaseMcpServer({
  serverInfo,
  capabilities,
  instructions,
  taskStore,
  taskMessageQueue,
}: CreateBaseMcpServerOptions): McpServer {
  return new McpServer(serverInfo, {
    capabilities,
    instructions,
    taskStore,
    taskMessageQueue: taskMessageQueue ?? new InMemoryTaskMessageQueue(),
  });
}
