import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FederatedMcpClient } from '../../../packages/mcp-client/src/federated-mcp-client.js';

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

describe('@serval/mcp-client FederatedMcpClient', () => {
  const validateServerUrl = vi.fn();
  const createServiceError = vi.fn((message: string) => new Error(message));
  const createNotFoundError = vi.fn((resourceType: string, identifier: string) => {
    return new Error(`Missing ${resourceType}: ${identifier}`);
  });
  const createCircuitBreaker = vi.fn(({ timeout }: { timeout: number }) => ({
    execute: async <T>(operation: () => Promise<T>) => operation(),
    timeout,
  }));
  const log = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    validateServerUrl.mockResolvedValue(undefined);
    connectMock.mockResolvedValue(undefined);
    callToolMock.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    listToolsMock.mockResolvedValue({ tools: [{ name: 'remote_tool' }] });
    closeMock.mockResolvedValue(undefined);
  });

  function createClient() {
    return new FederatedMcpClient(
      [
        {
          name: 'remote',
          url: 'https://example.com/mcp',
          transport: 'http',
        },
      ],
      30000,
      10,
      {
        log,
        validateServerUrl,
        getRequestContext: () => ({ traceId: 'trace-1', spanId: 'span-1' }),
        getCircuitBreakerConfig: () => ({
          failureThreshold: 5,
          successThreshold: 2,
        }),
        createCircuitBreaker,
        createServiceError,
        createNotFoundError,
        clientVersion: '1.0.0',
        clientNamePrefix: 'servalsheets-federation',
      }
    );
  }

  it('validates the remote URL before creating the transport', async () => {
    const client = createClient();

    const result = await client.callRemoteTool('remote', 'tool_name', { value: 1 });

    expect(validateServerUrl).toHaveBeenCalledWith('https://example.com/mcp');
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(transportCtor).toHaveBeenCalledWith(
      new URL('https://example.com/mcp'),
      expect.objectContaining({
        requestInit: {
          headers: {
            'x-trace-id': 'trace-1',
            'x-span-id': 'span-1',
            traceparent: '00-trace-1-span-1-01',
          },
        },
      })
    );
    expect(result).toEqual({ content: [{ type: 'text', text: 'ok' }] });
  });

  it('fails closed when URL validation rejects', async () => {
    validateServerUrl.mockRejectedValue(new Error('private network URL blocked'));
    const client = createClient();

    await expect(client.callRemoteTool('remote', 'tool_name', {})).rejects.toThrow(
      'private network URL blocked'
    );
    expect(connectMock).not.toHaveBeenCalled();
    expect(transportCtor).not.toHaveBeenCalled();
  });

  it('lists remote tools through the connected client', async () => {
    const client = createClient();

    const tools = await client.listRemoteTools('remote');

    expect(tools).toEqual([{ name: 'remote_tool' }]);
    expect(listToolsMock).toHaveBeenCalledOnce();
  });
});
