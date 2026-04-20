import { ServalTransport, type ServalTransportConfig } from './transport.js';
import { CoreNamespace } from './namespaces/core.js';
import { DataNamespace } from './namespaces/data.js';
import { FormatNamespace } from './namespaces/format.js';
import { AnalyzeNamespace } from './namespaces/analyze.js';
import { SessionNamespace } from './namespaces/session.js';

export interface ServalSheetsClientConfig extends ServalTransportConfig {
  /** Auto-set active spreadsheet on connect */
  readonly defaultSpreadsheetId?: string;
}

/**
 * Developer-friendly typed client for ServalSheets MCP server.
 *
 * @example
 * const client = new ServalSheetsClient({ url: 'http://localhost:3000/mcp', auth: { type: 'bearer', token: 'my-token' } });
 * await client.connect();
 * const data = await client.data.read({ spreadsheetId: '1ABC', range: 'Sheet1!A1:B10' });
 */
export class ServalSheetsClient {
  private readonly transport: ServalTransport;
  private readonly config: ServalSheetsClientConfig;

  readonly core: CoreNamespace;
  readonly data: DataNamespace;
  readonly format: FormatNamespace;
  readonly analyze: AnalyzeNamespace;
  readonly session: SessionNamespace;

  constructor(config: ServalSheetsClientConfig) {
    this.config = config;
    this.transport = new ServalTransport(config);
    this.core = new CoreNamespace(this.transport);
    this.data = new DataNamespace(this.transport);
    this.format = new FormatNamespace(this.transport);
    this.analyze = new AnalyzeNamespace(this.transport);
    this.session = new SessionNamespace(this.transport);
  }

  async connect(): Promise<this> {
    await this.transport.connect();
    if (this.config.defaultSpreadsheetId) {
      await this.session.setActive(this.config.defaultSpreadsheetId);
    }
    return this;
  }

  async disconnect(): Promise<void> {
    await this.transport.disconnect();
  }

  /** Call any tool/action directly when a typed namespace method is not available */
  async call(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    return this.transport.callTool(toolName, args);
  }

  /** Convenience: connect, run callback, disconnect */
  static async withClient<T>(config: ServalSheetsClientConfig, fn: (client: ServalSheetsClient) => Promise<T>): Promise<T> {
    const client = new ServalSheetsClient(config);
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.disconnect();
    }
  }
}
