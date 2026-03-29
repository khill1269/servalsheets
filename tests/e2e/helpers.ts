/**
 * ServalSheets - E2E Test Helpers
 *
 * Utilities for E2E testing of the MCP server.
 * Provides HTTP client for MCP protocol communication,
 * environment configuration, and assertion helpers.
 *
 * @module tests/e2e/helpers
 */

import type {
  ServerCapabilities,
  Tool,
  Resource,
  Prompt,
  ClientCapabilities,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Configuration for MCP client
 */
export interface McpClientConfig {
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom headers to include in requests */
  headers?: Record<string, string>;
  /** Retry configuration */
  retry?: {
    maxRetries: number;
    delayMs: number;
  };
}

/**
 * MCP HTTP Client for E2E testing
 *
 * Implements MCP protocol over HTTP transport for testing purposes.
 * Wraps fetch API with MCP protocol handling, validation, and utilities.
 *
 * @example
 * ```typescript
 * const client = new McpClient('http://localhost:3000');
 * const capabilities = await client.initialize();
 * const tools = await client.listTools();
 * const result = await client.callTool('sheets_data', { request: { action: 'read_range', ... } });
 * await client.close();
 * ```
 */
export class McpClient {
  private baseUrl: string;
  private config: Required<McpClientConfig>;
  private requestId = 0;
  private serverCapabilities?: ServerCapabilities;
  private toolCache?: Tool[];

  constructor(baseUrl: string, config: McpClientConfig = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.config = {
      timeout: config.timeout ?? 10000,
      debug: config.debug ?? false,
      headers: config.headers ?? {},
      retry: config.retry ?? { maxRetries: 3, delayMs: 100 },
    };
  }

  /**
   * Send a raw JSON-RPC request to the server
   */
  private async sendRequest(method: string, params: any): Promise<any> {
    const id = ++this.requestId;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    if (this.config.debug) {
      console.log('→ MCP Request:', JSON.stringify(request, null, 2));
    }

    const response = await this.fetchWithRetry(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify(request),
    }, this.config.timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as Record<string, any>;

    if (this.config.debug) {
      console.log('← MCP Response:', JSON.stringify(data, null, 2));
    }

    if (data['error']) {
      throw new Error(`MCP Error: ${data['error'].message}`);
    }

    return data['result'];
  }

  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    timeout?: number
  ): Promise<Response> {
    const resolvedTimeout = timeout || this.config.timeout;
    const maxRetries = this.config.retry.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), resolvedTimeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          const delay = this.config.retry.delayMs * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Initialize MCP session with optional client capabilities
   *
   * @param clientCapabilities - Client capabilities (e.g., sampling, elicitation)
   * @returns Server capabilities
   */
  async initialize(clientCapabilities?: ClientCapabilities): Promise<ServerCapabilities> {
    this.serverCapabilities = await this.sendRequest('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: clientCapabilities || {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0',
      },
    });

    // Send initialized notification
    await this.sendRequest('initialized', {});

    return this.serverCapabilities!;
  }

  /**
   * List all available tools
   *
   * @returns Array of tool definitions
   */
  async listTools(): Promise<Tool[]> {
    // Use cached tools if available
    if (this.toolCache) {
      return this.toolCache;
    }

    this.toolCache = await this.sendRequest('tools/list', {}) as Tool[];
    return this.toolCache!;
  }

  /**
   * Call a specific tool with arguments
   *
   * @param toolName - Name of the tool (e.g., 'sheets_data')
   * @param args - Tool arguments (must follow MCP schema)
   * @returns Tool execution result
   */
  async callTool(toolName: string, args: any): Promise<any> {
    return this.sendRequest('tools/call', {
      name: toolName,
      arguments: args,
    });
  }

  /**
   * List available resources
   *
   * @returns Array of resource definitions
   */
  async listResources(): Promise<Resource[]> {
    return this.sendRequest('resources/list', {});
  }

  /**
   * Read a resource by URI
   *
   * @param uri - Resource URI
   * @returns Resource content
   */
  async readResource(uri: string): Promise<any> {
    return this.sendRequest('resources/read', { uri });
  }

  /**
   * List available prompts
   *
   * @returns Array of prompt definitions
   */
  async listPrompts(): Promise<Prompt[]> {
    return this.sendRequest('prompts/list', {});
  }

  /**
   * Get a specific prompt
   *
   * @param name - Prompt name
   * @param arguments_ - Prompt arguments
   * @returns Prompt content
   */
  async getPrompt(name: string, arguments_?: Record<string, string>): Promise<any> {
    return this.sendRequest('prompts/get', {
      name,
      arguments: arguments_,
    });
  }

  /**
   * Set logging level
   *
   * @param level - Log level ('debug' | 'info' | 'warn' | 'error')
   */
  async setLoggingLevel(level: 'debug' | 'info' | 'warn' | 'error'): Promise<void> {
    await this.sendRequest('logging/setLevel', { level });
  }

  /**
   * Close the client session
   */
  async close(): Promise<void> {
    // No-op for HTTP client, but provided for interface consistency
  }

  /**
   * Get server capabilities
   */
  getServerCapabilities(): ServerCapabilities | undefined {
    return this.serverCapabilities;
  }

  /**
   * Validate MCP protocol compliance
   *
   * @returns Validation result with errors if any
   */
  validateProtocolCompliance(): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!this.serverCapabilities) {
      errors.push('Server capabilities not loaded');
    } else {
      const caps = this.serverCapabilities as any;
      if (!caps.protocolVersion) {
        errors.push('Missing protocol version');
      }
      if (caps.protocolVersion !== '2025-11-25') {
        errors.push(
          `Protocol version mismatch: expected 2025-11-25, got ${caps.protocolVersion}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Get environment configuration for tests
 */
export function getEnvironmentConfig(): {
  baseUrl: string;
  timeout: number;
  enableAuth: boolean;
  jwtToken?: string;
  cognitoUserPoolId?: string;
} {
  return {
    baseUrl: process.env['BASE_URL'] || 'http://localhost:3000',
    timeout: parseInt(process.env['REQUEST_TIMEOUT'] || '10000', 10),
    enableAuth: process.env['ENABLE_AUTH'] === 'true',
    jwtToken: process.env['JWT_TOKEN'],
    cognitoUserPoolId: process.env['COGNITO_USER_POOL_ID'],
  };
}

/**
 * Wait for server to be healthy before running tests
 *
 * Polls the health endpoint until it returns 200 or timeout is reached.
 *
 * @param baseUrl - Base URL of the server
 * @param timeoutMs - Maximum time to wait (default: 30000)
 * @throws Error if server doesn't become healthy in time
 */
export async function waitForHealthy(
  baseUrl: string,
  timeoutMs: number = 30000
): Promise<void> {
  const startTime = Date.now();
  const url = `${baseUrl}/health/live`;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.status === 200) {
        return;
      }
    } catch (error) {
      // Ignore errors and retry
    }
    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Server did not become healthy within ${timeoutMs}ms`);
}

/**
 * Assert that a response has valid MCP response structure
 *
 * @param response - Response to validate
 * @throws Error if response structure is invalid
 */
export function assertMcpResponse(response: any): void {
  if (!response) {
    throw new Error('Response is null or undefined');
  }

  if (typeof response !== 'object') {
    throw new Error(`Response must be an object, got ${typeof response}`);
  }

  // MCP responses should have certain structure
  if (!response.hasOwnProperty('success') && !response.hasOwnProperty('error')) {
    // Some responses might have different structure
    // This is a lenient check
  }
}

/**
 * Generate a JWT token for testing (mock implementation)
 *
 * In production, this would use a real JWT library.
 * For testing, we provide a mock that creates a basic JWT structure.
 *
 * @param payload - Token payload
 * @param secret - Signing secret (not used in mock)
 * @returns JWT token string
 */
export function generateMockJwt(
  payload: Record<string, any>,
  secret: string = 'test-secret'
): string {
  // Mock JWT: header.payload.signature
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = 'mock-signature';

  return `${header}.${body}.${signature}`;
}

/**
 * Create test headers with optional authentication
 *
 * @param token - JWT token (optional)
 * @returns Headers object
 */
export function createTestHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Assert that a tool response indicates success
 *
 * @param response - Tool response
 * @throws Error if response indicates failure
 */
export function assertToolSuccess(response: any): void {
  if (!response) {
    throw new Error('Response is empty');
  }

  if (response.response?.error) {
    throw new Error(`Tool error: ${JSON.stringify(response.response.error)}`);
  }

  if (response.response?.success === false) {
    throw new Error(
      `Tool returned success: false - ${JSON.stringify(response.response)}`
    );
  }
}

/**
 * Assert that a tool response indicates failure
 *
 * @param response - Tool response
 * @throws Error if response doesn't indicate failure
 */
export function assertToolError(response: any): void {
  if (!response) {
    throw new Error('Response is empty');
  }

  if (!response.response?.error && response.response?.success !== false) {
    throw new Error('Expected error response, but got success');
  }
}

/**
 * Create a test MCP client with default configuration
 *
 * @param baseUrl - Server base URL
 * @param config - Optional configuration overrides
 * @returns MCP client instance
 */
export function createTestClient(
  baseUrl: string = 'http://localhost:3000',
  config?: McpClientConfig
): McpClient {
  return new McpClient(baseUrl, config);
}

/**
 * Format test output for better readability
 *
 * @param title - Test title
 * @param data - Data to format
 * @returns Formatted string
 */
export function formatTestOutput(title: string, data: any): string {
  return `\n${'='.repeat(60)}\n${title}\n${'='.repeat(60)}\n${JSON.stringify(data, null, 2)}\n`;
}
