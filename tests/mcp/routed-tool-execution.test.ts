import { beforeEach, describe, expect, it, vi } from 'vitest';

const { federationHandle, getRemoteToolClient } = vi.hoisted(() => ({
  federationHandle: vi.fn(),
  getRemoteToolClient: vi.fn(),
}));

vi.mock('../../src/handlers/federation.js', () => ({
  FederationHandler: class FederationHandler {
    handle = federationHandle;
  },
}));

vi.mock('../../src/services/remote-mcp-tool-client.js', () => ({
  getRemoteToolClient,
}));

import { executeRoutedToolCall } from '../../src/mcp/routed-tool-execution.js';

describe('executeRoutedToolCall', () => {
  beforeEach(() => {
    federationHandle.mockReset();
    getRemoteToolClient.mockReset();
  });

  it('routes sheets_federation through the remote executor', async () => {
    federationHandle.mockResolvedValue({
      response: {
        success: true,
        action: 'list_servers',
        servers: [],
      },
    });
    const localExecute = vi.fn(async () => ({ response: { success: true } }));

    const result = await executeRoutedToolCall({
      toolName: 'sheets_federation',
      transport: 'stdio',
      args: { request: { action: 'list_servers' } },
      localExecute,
    });

    expect(result).toMatchObject({
      response: {
        success: true,
        action: 'list_servers',
      },
    });
    expect(localExecute).not.toHaveBeenCalled();
    expect(federationHandle).toHaveBeenCalledWith({
      request: {
        action: 'list_servers',
      },
    });
  });

  it('falls back to the hosted remote executor for prefer_local tools after local failure', async () => {
    getRemoteToolClient.mockResolvedValue({
      callRemoteTool: vi.fn(async () => ({
        structuredContent: {
          response: {
            success: true,
            source: 'remote',
          },
        },
      })),
    });
    const localExecute = vi.fn(async () => {
      throw new Error('local compute failed');
    });

    const result = await executeRoutedToolCall({
      toolName: 'sheets_compute',
      transport: 'stdio',
      args: { request: { action: 'evaluate' } },
      localExecute,
    });

    expect(result).toMatchObject({
      response: {
        success: true,
        source: 'remote',
      },
    });
    expect(localExecute).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_compute');
  });

  it('falls back to the hosted remote executor for sheets_analyze after local failure', async () => {
    getRemoteToolClient.mockResolvedValue({
      callRemoteTool: vi.fn(async () => ({
        structuredContent: {
          response: {
            success: true,
            action: 'analyze_data',
            source: 'remote',
          },
        },
      })),
    });
    const localExecute = vi.fn(async () => {
      throw new Error('local analyze failed');
    });

    const result = await executeRoutedToolCall({
      toolName: 'sheets_analyze',
      transport: 'stdio',
      args: {
        request: {
          action: 'analyze_data',
          spreadsheetId: 'spreadsheet-123',
          analysisTypes: ['summary'],
        },
      },
      localExecute,
    });

    expect(result).toMatchObject({
      response: {
        success: true,
        action: 'analyze_data',
        source: 'remote',
      },
    });
    expect(localExecute).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_analyze');
  });

  it('falls back to the hosted remote executor when local execution returns an internal error response', async () => {
    getRemoteToolClient.mockResolvedValue({
      callRemoteTool: vi.fn(async () => ({
        structuredContent: {
          response: {
            success: true,
            source: 'remote',
          },
        },
      })),
    });
    const localExecute = vi.fn(async () => ({
      response: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'local compute failed',
          retryable: false,
        },
      },
    }));

    const result = await executeRoutedToolCall({
      toolName: 'sheets_compute',
      transport: 'streamable-http',
      args: { request: { action: 'evaluate' } },
      localExecute,
    });

    expect(result).toMatchObject({
      response: {
        success: true,
        source: 'remote',
      },
    });
    expect(localExecute).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_compute');
  });

  it('falls back to the hosted remote executor for sheets_connectors after local failure', async () => {
    getRemoteToolClient.mockResolvedValue({
      callRemoteTool: vi.fn(async () => ({
        structuredContent: {
          response: {
            success: true,
            action: 'list_connectors',
            source: 'remote',
          },
        },
      })),
    });
    const localExecute = vi.fn(async () => {
      throw new Error('local connectors failed');
    });

    const result = await executeRoutedToolCall({
      toolName: 'sheets_connectors',
      transport: 'stdio',
      args: {
        request: {
          action: 'list_connectors',
        },
      },
      localExecute,
    });

    expect(result).toMatchObject({
      response: {
        success: true,
        action: 'list_connectors',
        source: 'remote',
      },
    });
    expect(localExecute).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_connectors');
  });

  it('falls back to the hosted remote executor for sheets_agent after local failure', async () => {
    getRemoteToolClient.mockResolvedValue({
      callRemoteTool: vi.fn(async () => ({
        structuredContent: {
          response: {
            success: true,
            action: 'list_plans',
            source: 'remote',
          },
        },
      })),
    });
    const localExecute = vi.fn(async () => {
      throw new Error('local agent failed');
    });

    const result = await executeRoutedToolCall({
      toolName: 'sheets_agent',
      transport: 'stdio',
      args: {
        request: {
          action: 'list_plans',
        },
      },
      localExecute,
    });

    expect(result).toMatchObject({
      response: {
        success: true,
        action: 'list_plans',
        source: 'remote',
      },
    });
    expect(localExecute).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_agent');
  });

  it('falls back to the hosted remote executor for sheets_bigquery after local failure', async () => {
    getRemoteToolClient.mockResolvedValue({
      callRemoteTool: vi.fn(async () => ({
        structuredContent: {
          response: {
            success: true,
            action: 'list_connections',
            source: 'remote',
          },
        },
      })),
    });
    const localExecute = vi.fn(async () => {
      throw new Error('local bigquery failed');
    });

    const result = await executeRoutedToolCall({
      toolName: 'sheets_bigquery',
      transport: 'stdio',
      args: {
        request: {
          action: 'list_connections',
          spreadsheetId: 'spreadsheet-123',
        },
      },
      localExecute,
    });

    expect(result).toMatchObject({
      response: {
        success: true,
        action: 'list_connections',
        source: 'remote',
      },
    });
    expect(localExecute).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_bigquery');
  });

  it('falls back to the hosted remote executor for sheets_appsscript after local failure', async () => {
    getRemoteToolClient.mockResolvedValue({
      callRemoteTool: vi.fn(async () => ({
        structuredContent: {
          response: {
            success: true,
            action: 'get',
            source: 'remote',
          },
        },
      })),
    });
    const localExecute = vi.fn(async () => {
      throw new Error('local appsscript failed');
    });

    const result = await executeRoutedToolCall({
      toolName: 'sheets_appsscript',
      transport: 'stdio',
      args: {
        request: {
          action: 'get',
          spreadsheetId: 'spreadsheet-123',
        },
      },
      localExecute,
    });

    expect(result).toMatchObject({
      response: {
        success: true,
        action: 'get',
        source: 'remote',
      },
    });
    expect(localExecute).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_appsscript');
  });

  it('keeps local tools on the local executor', async () => {
    const localExecute = vi.fn(async () => 'local result');

    const result = await executeRoutedToolCall({
      toolName: 'sheets_core',
      transport: 'stdio',
      args: { request: { action: 'get' } },
      localExecute,
    });

    expect(result).toBe('local result');
    expect(localExecute).toHaveBeenCalledTimes(1);
    expect(federationHandle).not.toHaveBeenCalled();
  });
});
