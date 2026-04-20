import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ServalSheetsError, ServalAuthError, ServalPermissionError, ServalNotFoundError, ServalValidationError } from './errors.js';

export interface ServalTransportConfig {
  readonly url: string;
  readonly auth?: {
    readonly type: 'bearer' | 'api-key';
    readonly token: string;
  };
  readonly timeoutMs?: number;
  readonly headers?: Record<string, string>;
}

const ERROR_CODE_MAP: Record<string, new (message: string, action?: string) => ServalSheetsError> = {
  NOT_FOUND: ServalNotFoundError,
  PERMISSION_DENIED: ServalPermissionError,
  VALIDATION_ERROR: ServalValidationError,
  UNAUTHORIZED: ServalAuthError,
};

export class ServalTransport {
  private client: Client | null = null;
  private readonly config: ServalTransportConfig;

  constructor(config: ServalTransportConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    const headers: Record<string, string> = { ...this.config.headers };

    if (this.config.auth) {
      if (this.config.auth.type === 'bearer') {
        headers['Authorization'] = `Bearer ${this.config.auth.token}`;
      } else {
        headers['X-API-Key'] = this.config.auth.token;
      }
    }

    const transport = new StreamableHTTPClientTransport(new URL(this.config.url), {
      requestInit: { headers },
    });

    this.client = new Client({ name: '@serval/sdk', version: '2.0.0' }, { capabilities: {} });
    await this.client.connect(transport);
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client) throw new ServalSheetsError('Not connected — call connect() first', 'NOT_CONNECTED');

    let result: CallToolResult;
    try {
      result = await this.client.callTool({ name: toolName, arguments: args }) as CallToolResult;
    } catch (err) {
      throw new ServalSheetsError(
        err instanceof Error ? err.message : 'MCP call failed',
        'TRANSPORT_ERROR',
        toolName,
        err
      );
    }

    if (result.isError) {
      const text = result.content.find(c => c.type === 'text')?.text ?? 'Unknown error';
      let parsed: { code?: string; message?: string } = {};
      try { parsed = JSON.parse(text) as typeof parsed; } catch { /* raw text */ }
      const code = parsed.code ?? 'UNKNOWN_ERROR';
      const message = parsed.message ?? text;
      const ErrorClass = ERROR_CODE_MAP[code];
      if (ErrorClass) throw new ErrorClass(message, toolName);
      throw new ServalSheetsError(message, code, toolName);
    }

    const text = result.content.find(c => c.type === 'text')?.text;
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}
