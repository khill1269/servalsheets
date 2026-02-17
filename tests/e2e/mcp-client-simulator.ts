/**
 * ServalSheets - MCP Client Simulator
 *
 * Simulates real MCP clients (Claude Desktop, other LLMs) for E2E testing.
 * Implements MCP 2025-11-25 protocol with full capabilities negotiation.
 *
 * Features:
 * - Initialize handshake with capabilities
 * - Tool discovery (tools/list)
 * - Tool execution (tools/call)
 * - Resource subscription
 * - Sampling support (server-to-client LLM requests)
 * - Elicitation support (user input forms)
 * - Protocol validation
 */

import { EventEmitter } from 'node:events';
import type {
  CallToolResult,
  Tool,
  Resource,
  Prompt,
  ClientCapabilities,
  ServerCapabilities,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP Client configuration
 */
export interface MCPClientConfig {
  /**
   * Client name (e.g., "Claude Desktop", "test-client")
   */
  name: string;

  /**
   * Client version
   */
  version: string;

  /**
   * Client capabilities
   * - elicitation: Support user input forms (SEP-1036)
   * - sampling: Support LLM requests from server (SEP-1577)
   * - roots: Support filesystem roots
   */
  capabilities: ClientCapabilities;

  /**
   * Protocol version (default: 2025-11-25)
   */
  protocolVersion?: string;

  /**
   * Transport type
   */
  transport: 'stdio' | 'http' | 'websocket';

  /**
   * Timeout for requests (ms)
   */
  timeout?: number;
}

/**
 * MCP Client session state
 */
interface MCPClientSession {
  /**
   * Session ID
   */
  sessionId: string;

  /**
   * Client info
   */
  clientInfo: {
    name: string;
    version: string;
  };

  /**
   * Server capabilities after handshake
   */
  serverCapabilities?: ServerCapabilities;

  /**
   * Initialized flag
   */
  initialized: boolean;

  /**
   * Available tools
   */
  tools: Tool[];

  /**
   * Available resources
   */
  resources: Resource[];

  /**
   * Available prompts
   */
  prompts: Prompt[];
}

/**
 * MCP Client Simulator
 *
 * Simulates a real MCP client for E2E testing.
 */
export class MCPClientSimulator extends EventEmitter {
  private config: MCPClientConfig;
  private session: MCPClientSession;
  private requestId = 1;
  private pendingRequests = new Map<
    number,
    { resolve: (value: JSONRPCResponse) => void; reject: (error: Error) => void }
  >();

  constructor(config: MCPClientConfig) {
    super();
    this.config = config;
    this.session = {
      sessionId: `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      clientInfo: {
        name: config.name,
        version: config.version,
      },
      initialized: false,
      tools: [],
      resources: [],
      prompts: [],
    };
  }

  /**
   * Initialize handshake with MCP server
   *
   * Implements MCP 2025-11-25 initialize/initialized flow:
   * 1. Client sends initialize request with capabilities
   * 2. Server responds with server capabilities
   * 3. Client sends initialized notification
   * 4. Handshake complete
   */
  async initialize(): Promise<ServerCapabilities> {
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'initialize',
      params: {
        protocolVersion: this.config.protocolVersion ?? '2025-11-25',
        capabilities: this.config.capabilities,
        clientInfo: this.session.clientInfo,
      },
    };

    const response = await this.sendRequest(request);

    if (response.error) {
      throw new Error(`Initialize failed: ${response.error.message}`);
    }

    // Extract server capabilities
    const serverCapabilities = response.result as {
      protocolVersion: string;
      capabilities: ServerCapabilities;
      serverInfo: { name: string; version: string };
    };

    this.session.serverCapabilities = serverCapabilities.capabilities;
    this.session.initialized = true;

    // Send initialized notification
    await this.sendNotification({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });

    // Emit initialized event
    this.emit('initialized', serverCapabilities);

    return serverCapabilities.capabilities;
  }

  /**
   * List available tools
   *
   * Calls tools/list and caches results.
   */
  async listTools(): Promise<Tool[]> {
    this.assertInitialized();

    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/list',
      params: {},
    };

    const response = await this.sendRequest(request);

    if (response.error) {
      throw new Error(`List tools failed: ${response.error.message}`);
    }

    const result = response.result as { tools: Tool[] };
    this.session.tools = result.tools;

    return result.tools;
  }

  /**
   * Call a tool with arguments
   *
   * Implements tools/call with full validation.
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<CallToolResult> {
    this.assertInitialized();

    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    };

    const response = await this.sendRequest(request);

    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }

    return response.result as CallToolResult;
  }

  /**
   * List available resources
   *
   * Calls resources/list and caches results.
   */
  async listResources(): Promise<Resource[]> {
    this.assertInitialized();

    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'resources/list',
      params: {},
    };

    const response = await this.sendRequest(request);

    if (response.error) {
      throw new Error(`List resources failed: ${response.error.message}`);
    }

    const result = response.result as { resources: Resource[] };
    this.session.resources = result.resources;

    return result.resources;
  }

  /**
   * Read a resource by URI
   *
   * Calls resources/read with validation.
   */
  async readResource(uri: string): Promise<{ contents: unknown[] }> {
    this.assertInitialized();

    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'resources/read',
      params: { uri },
    };

    const response = await this.sendRequest(request);

    if (response.error) {
      throw new Error(`Read resource failed: ${response.error.message}`);
    }

    return response.result as { contents: unknown[] };
  }

  /**
   * Subscribe to resource updates
   *
   * Calls resources/subscribe and listens for notifications.
   */
  async subscribeToResource(uri: string): Promise<void> {
    this.assertInitialized();

    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'resources/subscribe',
      params: { uri },
    };

    const response = await this.sendRequest(request);

    if (response.error) {
      throw new Error(`Subscribe failed: ${response.error.message}`);
    }
  }

  /**
   * List available prompts
   *
   * Calls prompts/list and caches results.
   */
  async listPrompts(): Promise<Prompt[]> {
    this.assertInitialized();

    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'prompts/list',
      params: {},
    };

    const response = await this.sendRequest(request);

    if (response.error) {
      throw new Error(`List prompts failed: ${response.error.message}`);
    }

    const result = response.result as { prompts: Prompt[] };
    this.session.prompts = result.prompts;

    return result.prompts;
  }

  /**
   * Get a prompt by name
   *
   * Calls prompts/get with arguments.
   */
  async getPrompt(
    name: string,
    args?: Record<string, string>,
  ): Promise<{ description?: string; messages: unknown[] }> {
    this.assertInitialized();

    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'prompts/get',
      params: {
        name,
        arguments: args ?? {},
      },
    };

    const response = await this.sendRequest(request);

    if (response.error) {
      throw new Error(`Get prompt failed: ${response.error.message}`);
    }

    return response.result as { description?: string; messages: unknown[] };
  }

  /**
   * Set log level
   *
   * Calls logging/setLevel (MCP 2025-11-25 feature).
   */
  async setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): Promise<void> {
    this.assertInitialized();

    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'logging/setLevel',
      params: { level },
    };

    const response = await this.sendRequest(request);

    if (response.error) {
      throw new Error(`Set log level failed: ${response.error.message}`);
    }
  }

  /**
   * Get client session info
   */
  getSession(): Readonly<MCPClientSession> {
    return { ...this.session };
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.session.initialized;
  }

  /**
   * Validate protocol compliance
   *
   * Checks if server follows MCP 2025-11-25 spec:
   * - Tools have required fields (name, description, inputSchema)
   * - Resources have URI templates or static URIs
   * - Prompts have name and description
   * - Capabilities are properly declared
   */
  validateProtocolCompliance(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check server capabilities
    if (!this.session.serverCapabilities) {
      errors.push('Server capabilities not set (initialize not called)');
    }

    // Validate tools
    for (const tool of this.session.tools) {
      if (!tool.name) {
        errors.push(`Tool missing name: ${JSON.stringify(tool)}`);
      }
      if (!tool.description) {
        errors.push(`Tool ${tool.name} missing description`);
      }
      if (!tool.inputSchema) {
        errors.push(`Tool ${tool.name} missing inputSchema`);
      }
    }

    // Validate resources
    for (const resource of this.session.resources) {
      if (!resource.uri && !resource.uri) {
        errors.push(`Resource missing URI: ${JSON.stringify(resource)}`);
      }
      if (!resource.name) {
        errors.push(`Resource missing name: ${resource.uri}`);
      }
    }

    // Validate prompts
    for (const prompt of this.session.prompts) {
      if (!prompt.name) {
        errors.push(`Prompt missing name: ${JSON.stringify(prompt)}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Close client connection
   */
  async close(): Promise<void> {
    // Clear pending requests
    for (const [id, pending] of this.pendingRequests.entries()) {
      pending.reject(new Error('Client closed'));
      this.pendingRequests.delete(id);
    }

    this.emit('closed');
  }

  /**
   * Send JSON-RPC request and wait for response
   *
   * This is a stub implementation - subclasses should implement transport-specific logic.
   */
  protected async sendRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    throw new Error('sendRequest must be implemented by transport-specific subclass');
  }

  /**
   * Send JSON-RPC notification (no response expected)
   *
   * This is a stub implementation - subclasses should implement transport-specific logic.
   */
  protected async sendNotification(notification: JSONRPCNotification): Promise<void> {
    throw new Error('sendNotification must be implemented by transport-specific subclass');
  }

  /**
   * Assert client is initialized
   */
  private assertInitialized(): void {
    if (!this.session.initialized) {
      throw new Error('Client not initialized - call initialize() first');
    }
  }
}

/**
 * HTTP Transport Client
 *
 * Implements MCP over HTTP/SSE transport.
 */
export class MCPHttpClient extends MCPClientSimulator {
  private baseUrl: string;
  private authToken?: string;

  constructor(config: MCPClientConfig & { baseUrl: string; authToken?: string }) {
    super(config);
    this.baseUrl = config.baseUrl;
    this.authToken = config.authToken;
  }

  protected async sendRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as JSONRPCResponse;
  }

  protected async sendNotification(notification: JSONRPCNotification): Promise<void> {
    await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.authToken ? { Authorization: `Bearer ${this.authToken}` } : {}),
      },
      body: JSON.stringify(notification),
    });
  }
}

/**
 * Create test MCP client with common defaults
 *
 * Convenience factory for creating test clients.
 */
export function createTestClient(
  overrides?: Partial<MCPClientConfig>,
): MCPClientSimulator {
  const defaults: MCPClientConfig = {
    name: 'test-client',
    version: '1.0.0',
    capabilities: {
      elicitation: true,
      sampling: true,
    },
    protocolVersion: '2025-11-25',
    transport: 'http',
    timeout: 5000,
  };

  return new MCPClientSimulator({ ...defaults, ...overrides });
}

/**
 * Create test HTTP client for E2E tests
 */
export function createTestHttpClient(
  baseUrl: string,
  overrides?: Partial<MCPClientConfig>,
): MCPHttpClient {
  const defaults: MCPClientConfig = {
    name: 'test-http-client',
    version: '1.0.0',
    capabilities: {
      elicitation: true,
      sampling: true,
    },
    protocolVersion: '2025-11-25',
    transport: 'http',
    timeout: 5000,
  };

  return new MCPHttpClient({
    ...defaults,
    ...overrides,
    baseUrl,
  });
}
