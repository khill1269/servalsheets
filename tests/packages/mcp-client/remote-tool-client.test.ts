import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RemoteToolClient } from '../../../packages/mcp-client/src/remote-tool-client.js';

const {
  connectMock,
  callToolMock,
  listToolsMock,
  closeMock,
  transportCtor,
} = vi.hoisted(() => ({
  connectMock: vi.fn(),
  callToolMock: vi.fn(),
  listToolsMock: vi.fn(),
  closeMock: vi.fn(),
  transportCtor: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: class StreamableHTTPClientTransport {
    constructor(url: URL, options: unknown) {
      transportCtor(url, options);
      return { url, options };
    }
  },
}));

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class Client {
    connect = connectMock;
    callTool = callToolMock;
    listTools = listToolsMock;
    close = closeMock;
  },
}));

describe('@serval/mcp-client RemoteToolClient', () => {
  const validateServerUrl = vi.fn();
  const createServiceError = vi.fn((message: string) => new Error(message));
  const log = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    validateServerUrl.mockResolvedValue(undefined);
    connectMock.mockResolvedValue(undefined);
    callToolMock.mockResolvedValue({
      content: [],
      structuredContent: {
        response: {
          success: true,
          source: 'remote',
        },
      },
    });
    listToolsMock.mockResolvedValue({ tools: [{ name: 'sheets_compute' }] });
    closeMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createClient() {
    return new RemoteToolClient(
      {
        url: 'https://example.com/mcp',
        timeoutMs: 30000,
        auth: {
          type: 'bearer',
          token: 'secret-token',
        },
      },
      {
        log,
        validateServerUrl,
        getRequestContext: () => ({ traceId: 'trace-1', spanId: 'span-1' }),
        createServiceError,
        clientVersion: '1.0.0',
        clientName: 'servalsheets-remote-executor',
      }
    );
  }

  it('validates the hosted executor URL and forwards auth and trace headers', async () => {
    const client = createClient();

    const result = await client.callRemoteTool('sheets_compute', { request: { action: 'evaluate' } });

    expect(validateServerUrl).toHaveBeenCalledWith('https://example.com/mcp');
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(transportCtor).toHaveBeenCalledWith(
      new URL('https://example.com/mcp'),
      expect.objectContaining({
        requestInit: {
          headers: {
            Authorization: 'Bearer secret-token',
            'x-trace-id': 'trace-1',
            'x-span-id': 'span-1',
            traceparent: '00-trace-1-span-1-01',
          },
        },
      })
    );
    expect(callToolMock).toHaveBeenCalledWith({
      name: 'sheets_compute',
      arguments: { request: { action: 'evaluate' } },
    });
    expect(result).toMatchObject({
      structuredContent: {
        response: {
          success: true,
          source: 'remote',
        },
      },
    });
  });

  it('times out hung hosted tool calls', async () => {
    vi.useFakeTimers();
    callToolMock.mockImplementation(() => new Promise(() => {}));
    const client = createClient();

    const promise = client.callRemoteTool('sheets_compute', { request: { action: 'evaluate' } });
    const expectation = expect(promise).rejects.toThrow('Remote MCP tool call timed out after 30000ms');
    await vi.advanceTimersByTimeAsync(30000);

    await expectation;
    expect(createServiceError).toHaveBeenCalledWith(
      'Remote MCP tool call timed out after 30000ms',
      true
    );
  });
});
