import { describe, expect, it, vi } from 'vitest';

const { getRemoteToolClient } = vi.hoisted(() => ({
  getRemoteToolClient: vi.fn(),
}));

vi.mock('../../src/services/remote-mcp-tool-client.js', () => ({
  getRemoteToolClient,
}));

import { dispatchServerToolCall } from '../../src/server/handler-dispatch.js';

describe('dispatchServerToolCall hosted failover', () => {
  it('falls back to the hosted executor for prefer_local tools after local failure', async () => {
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
    const localHandler = vi.fn(async () => {
      throw new Error('local compute failed');
    });

    const result = await dispatchServerToolCall({
      toolName: 'sheets_compute',
      args: { request: { action: 'evaluate' } },
      rawArgs: { request: { action: 'evaluate' } },
      rawAction: 'evaluate',
      handlers: {} as never,
      authHandler: null,
      cachedHandlerMap: { sheets_compute: localHandler },
      context: { sessionContext: undefined } as never,
      googleClient: null,
      requestId: 'req-1',
      costTrackingTenantId: 'tenant-1',
    });

    expect(result.kind).toBe('result');
    if (result.kind !== 'result') {
      throw new Error('Expected routed result');
    }

    expect(result.result).toMatchObject({
      response: {
        success: true,
        source: 'remote',
      },
    });
    expect(localHandler).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_compute');
  });

  it('falls back to the hosted executor for sheets_analyze after local failure', async () => {
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
    const localHandler = vi.fn(async () => {
      throw new Error('local analyze failed');
    });

    const result = await dispatchServerToolCall({
      toolName: 'sheets_analyze',
      args: {
        request: {
          action: 'analyze_data',
          spreadsheetId: 'spreadsheet-123',
          analysisTypes: ['summary'],
        },
      },
      rawArgs: {
        request: {
          action: 'analyze_data',
          spreadsheetId: 'spreadsheet-123',
          analysisTypes: ['summary'],
        },
      },
      rawAction: 'analyze_data',
      handlers: {} as never,
      authHandler: null,
      cachedHandlerMap: { sheets_analyze: localHandler },
      context: { sessionContext: undefined } as never,
      googleClient: null,
      requestId: 'req-2',
      costTrackingTenantId: 'tenant-1',
    });

    expect(result.kind).toBe('result');
    if (result.kind !== 'result') {
      throw new Error('Expected routed result');
    }

    expect(result.result).toMatchObject({
      response: {
        success: true,
        action: 'analyze_data',
        source: 'remote',
      },
    });
    expect(localHandler).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_analyze');
  });

  it('falls back to the hosted executor for sheets_connectors after local failure', async () => {
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
    const localHandler = vi.fn(async () => {
      throw new Error('local connectors failed');
    });

    const result = await dispatchServerToolCall({
      toolName: 'sheets_connectors',
      args: {
        request: {
          action: 'list_connectors',
        },
      },
      rawArgs: {
        request: {
          action: 'list_connectors',
        },
      },
      rawAction: 'list_connectors',
      handlers: {} as never,
      authHandler: null,
      cachedHandlerMap: { sheets_connectors: localHandler },
      context: { sessionContext: undefined } as never,
      googleClient: null,
      requestId: 'req-3',
      costTrackingTenantId: 'tenant-1',
    });

    expect(result.kind).toBe('result');
    if (result.kind !== 'result') {
      throw new Error('Expected routed result');
    }

    expect(result.result).toMatchObject({
      response: {
        success: true,
        action: 'list_connectors',
        source: 'remote',
      },
    });
    expect(localHandler).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_connectors');
  });

  it('falls back to the hosted executor for sheets_agent after local failure', async () => {
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
    const localHandler = vi.fn(async () => {
      throw new Error('local agent failed');
    });

    const result = await dispatchServerToolCall({
      toolName: 'sheets_agent',
      args: {
        request: {
          action: 'list_plans',
        },
      },
      rawArgs: {
        request: {
          action: 'list_plans',
        },
      },
      rawAction: 'list_plans',
      handlers: {} as never,
      authHandler: null,
      cachedHandlerMap: { sheets_agent: localHandler },
      context: { sessionContext: undefined } as never,
      googleClient: null,
      requestId: 'req-4',
      costTrackingTenantId: 'tenant-1',
    });

    expect(result.kind).toBe('result');
    if (result.kind !== 'result') {
      throw new Error('Expected routed result');
    }

    expect(result.result).toMatchObject({
      response: {
        success: true,
        action: 'list_plans',
        source: 'remote',
      },
    });
    expect(localHandler).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_agent');
  });

  it('falls back to the hosted executor for sheets_bigquery after local failure', async () => {
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
    const localHandler = vi.fn(async () => {
      throw new Error('local bigquery failed');
    });

    const result = await dispatchServerToolCall({
      toolName: 'sheets_bigquery',
      args: {
        request: {
          action: 'list_connections',
          spreadsheetId: 'spreadsheet-123',
        },
      },
      rawArgs: {
        request: {
          action: 'list_connections',
          spreadsheetId: 'spreadsheet-123',
        },
      },
      rawAction: 'list_connections',
      handlers: {} as never,
      authHandler: null,
      cachedHandlerMap: { sheets_bigquery: localHandler },
      context: { sessionContext: undefined } as never,
      googleClient: null,
      requestId: 'req-5',
      costTrackingTenantId: 'tenant-1',
    });

    expect(result.kind).toBe('result');
    if (result.kind !== 'result') {
      throw new Error('Expected routed result');
    }

    expect(result.result).toMatchObject({
      response: {
        success: true,
        action: 'list_connections',
        source: 'remote',
      },
    });
    expect(localHandler).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_bigquery');
  });

  it('falls back to the hosted executor for sheets_appsscript after local failure', async () => {
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
    const localHandler = vi.fn(async () => {
      throw new Error('local appsscript failed');
    });

    const result = await dispatchServerToolCall({
      toolName: 'sheets_appsscript',
      args: {
        request: {
          action: 'get',
          spreadsheetId: 'spreadsheet-123',
        },
      },
      rawArgs: {
        request: {
          action: 'get',
          spreadsheetId: 'spreadsheet-123',
        },
      },
      rawAction: 'get',
      handlers: {} as never,
      authHandler: null,
      cachedHandlerMap: { sheets_appsscript: localHandler },
      context: { sessionContext: undefined } as never,
      googleClient: null,
      requestId: 'req-6',
      costTrackingTenantId: 'tenant-1',
    });

    expect(result.kind).toBe('result');
    if (result.kind !== 'result') {
      throw new Error('Expected routed result');
    }

    expect(result.result).toMatchObject({
      response: {
        success: true,
        action: 'get',
        source: 'remote',
      },
    });
    expect(localHandler).toHaveBeenCalledTimes(1);
    expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_appsscript');
  });
});
