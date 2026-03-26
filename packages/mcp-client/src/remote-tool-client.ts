import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface RemoteToolClientConfig {
  readonly url: string;
  readonly timeoutMs?: number;
  readonly auth?: {
    readonly type: 'bearer' | 'api-key';
    readonly token: string;
  };
  readonly headers?: Record<string, string>;
}

export interface RemoteToolRequestContext {
  readonly traceId?: string;
  readonly spanId?: string;
}

export interface RemoteToolClientLogger {
  debug?(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface RemoteToolClientDependencies {
  readonly log: RemoteToolClientLogger;
  readonly validateServerUrl: (url: string) => Promise<void>;
  readonly getRequestContext: () => RemoteToolRequestContext | undefined;
  readonly createServiceError: (message: string, retryable?: boolean) => Error;
  readonly clientVersion: string;
  readonly clientName: string;
}

function createTimeoutError(
  createServiceError: RemoteToolClientDependencies['createServiceError'],
  timeoutMs: number
): Error {
  return createServiceError(`Remote MCP tool call timed out after ${timeoutMs}ms`, true);
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  createServiceError: RemoteToolClientDependencies['createServiceError']
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(createTimeoutError(createServiceError, timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export class RemoteToolClient {
  private client: Client | null = null;

  constructor(
    private readonly config: RemoteToolClientConfig,
    private readonly dependencies: RemoteToolClientDependencies
  ) {}

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      ...(this.config.headers ?? {}),
    };

    if (this.config.auth?.type === 'bearer') {
      headers['Authorization'] = `Bearer ${this.config.auth.token}`;
    } else if (this.config.auth?.type === 'api-key') {
      headers['X-API-Key'] = this.config.auth.token;
    }

    const requestContext = this.dependencies.getRequestContext();
    if (requestContext?.traceId) {
      headers['x-trace-id'] = requestContext.traceId;
      if (requestContext.spanId) {
        headers['x-span-id'] = requestContext.spanId;
        headers['traceparent'] = `00-${requestContext.traceId}-${requestContext.spanId}-01`;
      }
    }

    return headers;
  }

  private async getClient(): Promise<Client> {
    if (this.client) {
      return this.client;
    }

    await this.dependencies.validateServerUrl(this.config.url);

    const transport = new StreamableHTTPClientTransport(new URL(this.config.url), {
      requestInit: {
        headers: this.buildHeaders(),
      },
    });

    const client = new Client({
      name: this.dependencies.clientName,
      version: this.dependencies.clientVersion,
    });

    await client.connect(transport);
    this.client = client;

    this.dependencies.log.info('Connected remote MCP tool client', {
      component: 'remote-tool-client',
      url: this.config.url,
    });

    return client;
  }

  async callRemoteTool(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<CallToolResult> {
    const client = await this.getClient();
    const timeoutMs = this.config.timeoutMs ?? 30000;

    this.dependencies.log.debug?.('Calling hosted MCP tool', {
      component: 'remote-tool-client',
      toolName,
      url: this.config.url,
    });

    return await withTimeout(
      client.callTool({
        name: toolName,
        arguments: input,
      }) as Promise<CallToolResult>,
      timeoutMs,
      this.dependencies.createServiceError
    );
  }

  async listTools(): Promise<unknown[]> {
    const client = await this.getClient();
    const response = await client.listTools();
    return (response.tools as unknown[]) ?? [];
  }

  async close(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.close();
    this.client = null;

    this.dependencies.log.info('Disconnected remote MCP tool client', {
      component: 'remote-tool-client',
      url: this.config.url,
    });
  }
}
