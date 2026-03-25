import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export interface FederationServerConfig {
  readonly name: string;
  readonly url: string;
  readonly transport: 'http' | 'stdio';
  readonly auth?: {
    readonly type: 'bearer' | 'api-key';
    readonly token?: string;
  };
  readonly timeoutMs?: number;
}

export interface FederatedMcpRequestContext {
  readonly traceId?: string;
  readonly spanId?: string;
}

export interface CircuitBreakerLike {
  execute<T>(operation: () => Promise<T>): Promise<T>;
}

export interface FederatedMcpClientLogger {
  debug?(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export interface FederatedMcpClientDependencies {
  readonly log: FederatedMcpClientLogger;
  readonly validateServerUrl: (url: string) => Promise<void>;
  readonly getRequestContext: () => FederatedMcpRequestContext | undefined;
  readonly getCircuitBreakerConfig: () => {
    readonly failureThreshold: number;
    readonly successThreshold: number;
  };
  readonly createCircuitBreaker: (params: {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
  }) => CircuitBreakerLike;
  readonly createServiceError: (message: string, retryable?: boolean) => Error;
  readonly createNotFoundError: (resourceType: string, identifier: string) => Error;
  readonly clientVersion: string;
  readonly clientNamePrefix?: string;
}

export class FederatedMcpClient {
  private clients = new Map<string, Client>();
  private circuitBreakers = new Map<string, CircuitBreakerLike>();
  private cache = new Map<string, { result: unknown; expiresAt: number }>();
  private serverConfigs = new Map<string, FederationServerConfig>();

  constructor(
    private readonly servers: FederationServerConfig[],
    private readonly defaultTimeoutMs: number,
    private readonly maxConnections: number,
    private readonly dependencies: FederatedMcpClientDependencies
  ) {
    for (const server of servers) {
      this.serverConfigs.set(server.name, server);
    }
  }

  private getCircuitBreaker(serverName: string): CircuitBreakerLike {
    let breaker = this.circuitBreakers.get(serverName);
    if (!breaker) {
      const config = this.serverConfigs.get(serverName);
      const defaults = this.dependencies.getCircuitBreakerConfig();
      breaker = this.dependencies.createCircuitBreaker({
        failureThreshold: defaults.failureThreshold,
        successThreshold: defaults.successThreshold,
        timeout: config?.timeoutMs ?? this.defaultTimeoutMs,
      });
      this.circuitBreakers.set(serverName, breaker);
    }
    return breaker;
  }

  async initialize(): Promise<void> {
    this.dependencies.log.info('Initializing federated MCP clients', {
      component: 'federated-mcp-client',
      serverCount: this.servers.length,
    });

    for (const server of this.servers) {
      try {
        await this.getClientForServer(server.name);
        this.dependencies.log.info('Connected to federated server', {
          component: 'federated-mcp-client',
          server: server.name,
        });
      } catch (error) {
        this.dependencies.log.warn('Failed to connect to federated server', {
          component: 'federated-mcp-client',
          server: server.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async getClientForServer(serverName: string): Promise<Client> {
    const existing = this.clients.get(serverName);
    if (existing) {
      return existing;
    }

    if (this.clients.size >= this.maxConnections) {
      throw this.dependencies.createServiceError(
        `Max connections (${this.maxConnections}) exceeded. Close existing connections or increase limit.`
      );
    }

    const config = this.serverConfigs.get(serverName);
    if (!config) {
      throw this.dependencies.createNotFoundError('server config', serverName);
    }

    const headers: Record<string, string> = {};
    if (config.auth?.type === 'bearer' && config.auth.token) {
      headers['Authorization'] = `Bearer ${config.auth.token}`;
    } else if (config.auth?.type === 'api-key' && config.auth.token) {
      headers['X-API-Key'] = config.auth.token;
    }

    const requestContext = this.dependencies.getRequestContext();
    if (requestContext?.traceId) {
      headers['x-trace-id'] = requestContext.traceId;
      if (requestContext.spanId) {
        headers['x-span-id'] = requestContext.spanId;
        headers['traceparent'] = `00-${requestContext.traceId}-${requestContext.spanId}-01`;
      }
    }

    await this.dependencies.validateServerUrl(config.url);

    const transport = new StreamableHTTPClientTransport(new URL(config.url), {
      requestInit: { headers },
    });

    const client = new Client({
      name: `${this.dependencies.clientNamePrefix ?? 'servalsheets-federation'}-${serverName}`,
      version: this.dependencies.clientVersion,
    });

    await client.connect(transport);
    this.clients.set(serverName, client);

    this.dependencies.log.debug?.('MCP client connection established', {
      component: 'federated-mcp-client',
      serverName,
      url: config.url,
    });

    return client;
  }

  async callRemoteTool(serverName: string, toolName: string, input: unknown): Promise<unknown> {
    const cacheKey = `${serverName}:${toolName}:${JSON.stringify(input)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      this.dependencies.log.debug?.('Federation cache hit', {
        component: 'federated-mcp-client',
        serverName,
        toolName,
      });
      return cached.result;
    }

    const result = await this.getCircuitBreaker(serverName).execute(async () => {
      const client = await this.getClientForServer(serverName);
      const config = this.serverConfigs.get(serverName);
      const timeoutMs = config?.timeoutMs ?? this.defaultTimeoutMs;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await client.callTool({
          name: toolName,
          arguments: input as Record<string, unknown>,
        });

        clearTimeout(timeoutId);

        this.dependencies.log.info('Remote tool call succeeded', {
          component: 'federated-mcp-client',
          serverName,
          toolName,
        });

        return response;
      } catch (error) {
        clearTimeout(timeoutId);

        if ((error as { name?: string }).name === 'AbortError') {
          this.dependencies.log.error('Remote tool call timed out', {
            component: 'federated-mcp-client',
            serverName,
            toolName,
            timeoutMs,
          });
          throw this.dependencies.createServiceError(
            `Remote call timed out after ${timeoutMs}ms`,
            true
          );
        }

        throw error;
      }
    });

    this.cache.set(cacheKey, {
      result,
      expiresAt: Date.now() + 300000,
    });

    return result;
  }

  async listRemoteTools(serverName: string): Promise<unknown[]> {
    const client = await this.getClientForServer(serverName);
    const response = await client.listTools();
    return (response.tools as unknown[]) || [];
  }

  getConfiguredServers(): string[] {
    return Array.from(this.serverConfigs.keys());
  }

  isConnected(serverName: string): boolean {
    return this.clients.has(serverName);
  }

  async disconnect(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (client) {
      await client.close();
      this.clients.delete(serverName);
      this.dependencies.log.info('Disconnected from federated server', {
        component: 'federated-mcp-client',
        serverName,
      });
    }
  }

  async shutdown(): Promise<void> {
    this.dependencies.log.info('Shutting down federated MCP clients', {
      component: 'federated-mcp-client',
      connectionCount: this.clients.size,
    });

    for (const [serverName, client] of this.clients.entries()) {
      try {
        await client.close();
        this.dependencies.log.debug?.('Disconnected from server during shutdown', {
          component: 'federated-mcp-client',
          serverName,
        });
      } catch (error) {
        this.dependencies.log.warn('Error disconnecting from server during shutdown', {
          component: 'federated-mcp-client',
          serverName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.clients.clear();
    this.circuitBreakers.clear();
    this.cache.clear();

    this.dependencies.log.info('Federated MCP client shutdown complete', {
      component: 'federated-mcp-client',
    });
  }

  clearCache(): void {
    this.cache.clear();
    this.dependencies.log.debug?.('Federation cache cleared', {
      component: 'federated-mcp-client',
    });
  }

  getCacheStats(): { size: number; entries: number } {
    return {
      size: this.cache.size,
      entries: this.cache.size,
    };
  }
}
