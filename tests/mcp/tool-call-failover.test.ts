import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Handlers } from '../../src/handlers/index.js';
import { TaskStoreAdapter } from '../../src/core/task-store-adapter.js';
import { InMemoryTaskStore } from '../../src/core/task-store.js';
import { resetEnvForTest } from '../../src/config/env.js';
import type { GoogleApiClient } from '../../src/services/google-api.js';
import { resetSessionContext } from '../../src/services/session-context.js';

const { getRemoteToolClient } = vi.hoisted(() => ({
  getRemoteToolClient: vi.fn(),
}));

vi.mock('../../src/services/remote-mcp-tool-client.js', () => ({
  getRemoteToolClient,
}));

import { registerServalSheetsTools } from '../../src/mcp/registration/tool-handlers.js';

function createMockHandlers(overrides?: {
  computeHandle?: ReturnType<typeof vi.fn>;
  analyzeHandle?: ReturnType<typeof vi.fn>;
  connectorsHandle?: ReturnType<typeof vi.fn>;
  agentHandle?: ReturnType<typeof vi.fn>;
  bigqueryHandle?: ReturnType<typeof vi.fn>;
  appsscriptHandle?: ReturnType<typeof vi.fn>;
}): Handlers {
  const makeHandler = (handle?: ReturnType<typeof vi.fn>) => ({
    handle: handle ?? vi.fn(async () => ({ response: { success: true } })),
  });

  return {
    core: makeHandler(),
    data: makeHandler(),
    format: makeHandler(),
    dimensions: makeHandler(),
    visualize: makeHandler(),
    collaborate: makeHandler(),
    advanced: makeHandler(),
    transaction: makeHandler(),
    quality: makeHandler(),
    history: makeHandler(),
    confirm: makeHandler(),
    analyze: makeHandler(overrides?.analyzeHandle),
    fix: makeHandler(),
    composite: makeHandler(),
    session: makeHandler(),
    templates: makeHandler(),
    bigquery: makeHandler(overrides?.bigqueryHandle),
    appsscript: makeHandler(overrides?.appsscriptHandle),
    webhooks: makeHandler(),
    dependencies: makeHandler(),
    federation: makeHandler(),
    compute: makeHandler(overrides?.computeHandle),
    agent: makeHandler(overrides?.agentHandle),
    connectors: makeHandler(overrides?.connectorsHandle),
  } as unknown as Handlers;
}

describe('legacy registered tool failover path', () => {
  afterEach(() => {
    getRemoteToolClient.mockReset();
    resetSessionContext();
    resetEnvForTest();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('falls back to the hosted executor for sheets_compute task execution after a local failure', async () => {
    const registeredTaskHandlers: Record<string, { createTask: (...args: unknown[]) => Promise<unknown> }> = {};
    const computeHandle = vi.fn(async () => {
      throw new Error('local compute failed');
    });

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

    const server = {
      server: {
        setRequestHandler: vi.fn(),
      },
      experimental: {
        tasks: {
          registerToolTask: vi.fn(
            (
              name: string,
              _config: Record<string, unknown>,
              handler: { createTask: (...args: unknown[]) => Promise<unknown> }
            ) => {
              registeredTaskHandlers[name] = handler;
            }
          ),
        },
      },
      registerTool: vi.fn(),
    } as unknown as McpServer;

    const googleClient = {
      authType: 'service_account',
    } as unknown as GoogleApiClient;

    await registerServalSheetsTools(server, createMockHandlers({ computeHandle }), {
      googleClient,
    });

    const computeTaskHandler = registeredTaskHandlers['sheets_compute'];
    expect(computeTaskHandler).toBeDefined();

    const taskStore = new TaskStoreAdapter(new InMemoryTaskStore());

    try {
      const created = (await computeTaskHandler!.createTask(
        {
          request: {
            action: 'evaluate',
            spreadsheetId: 'spreadsheet-123',
            formula: '=SUM(A1:A3)',
          },
        },
        { taskStore, taskRequestedTtl: 60_000 }
      )) as { task: { taskId: string } };

      await vi.waitFor(async () => {
        const taskResult = await taskStore.getUnderlyingStore().getTaskResult(created.task.taskId);
        expect(taskResult?.status).toBe('completed');
        expect(taskResult?.result.structuredContent).toMatchObject({
          response: {
            success: true,
            source: 'remote',
          },
        });
      });

      expect(computeHandle).toHaveBeenCalledTimes(1);
      expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_compute');
    } finally {
      taskStore.dispose();
    }
  });

  it('falls back to the hosted executor for sheets_analyze task execution after a local failure', async () => {
    const registeredTaskHandlers: Record<string, { createTask: (...args: unknown[]) => Promise<unknown> }> = {};
    const analyzeHandle = vi.fn(async () => {
      throw new Error('local analyze failed');
    });

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

    const server = {
      server: {
        setRequestHandler: vi.fn(),
      },
      experimental: {
        tasks: {
          registerToolTask: vi.fn(
            (
              name: string,
              _config: Record<string, unknown>,
              handler: { createTask: (...args: unknown[]) => Promise<unknown> }
            ) => {
              registeredTaskHandlers[name] = handler;
            }
          ),
        },
      },
      registerTool: vi.fn(),
    } as unknown as McpServer;

    const googleClient = {
      authType: 'service_account',
    } as unknown as GoogleApiClient;

    await registerServalSheetsTools(server, createMockHandlers({ analyzeHandle }), {
      googleClient,
    });

    const analyzeTaskHandler = registeredTaskHandlers['sheets_analyze'];
    expect(analyzeTaskHandler).toBeDefined();

    const taskStore = new TaskStoreAdapter(new InMemoryTaskStore());

    try {
      const created = (await analyzeTaskHandler!.createTask(
        {
          request: {
            action: 'analyze_data',
            spreadsheetId: 'spreadsheet-123',
            analysisTypes: ['summary'],
          },
        },
        { taskStore, taskRequestedTtl: 60_000 }
      )) as { task: { taskId: string } };

      await vi.waitFor(async () => {
        const taskResult = await taskStore.getUnderlyingStore().getTaskResult(created.task.taskId);
        expect(taskResult?.status).toBe('completed');
        expect(taskResult?.result.structuredContent).toMatchObject({
          response: {
            success: true,
            action: 'analyze_data',
            source: 'remote',
          },
        });
      });

      expect(analyzeHandle).toHaveBeenCalledTimes(1);
      expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_analyze');
    } finally {
      taskStore.dispose();
    }
  });

  it('falls back to the hosted executor for sheets_connectors task execution after a local failure', async () => {
    const registeredTaskHandlers: Record<string, { createTask: (...args: unknown[]) => Promise<unknown> }> = {};
    const connectorsHandle = vi.fn(async () => {
      throw new Error('local connectors failed');
    });

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

    const server = {
      server: {
        setRequestHandler: vi.fn(),
      },
      experimental: {
        tasks: {
          registerToolTask: vi.fn(
            (
              name: string,
              _config: Record<string, unknown>,
              handler: { createTask: (...args: unknown[]) => Promise<unknown> }
            ) => {
              registeredTaskHandlers[name] = handler;
            }
          ),
        },
      },
      registerTool: vi.fn(),
    } as unknown as McpServer;

    const googleClient = {
      authType: 'service_account',
    } as unknown as GoogleApiClient;

    await registerServalSheetsTools(server, createMockHandlers({ connectorsHandle }), {
      googleClient,
    });

    const connectorsTaskHandler = registeredTaskHandlers['sheets_connectors'];
    expect(connectorsTaskHandler).toBeDefined();

    const taskStore = new TaskStoreAdapter(new InMemoryTaskStore());

    try {
      const created = (await connectorsTaskHandler!.createTask(
        {
          request: {
            action: 'list_connectors',
          },
        },
        { taskStore, taskRequestedTtl: 60_000 }
      )) as { task: { taskId: string } };

      await vi.waitFor(async () => {
        const taskResult = await taskStore.getUnderlyingStore().getTaskResult(created.task.taskId);
        expect(taskResult?.status).toBe('completed');
        expect(taskResult?.result.structuredContent).toMatchObject({
          response: {
            success: true,
            action: 'list_connectors',
            source: 'remote',
          },
        });
      });

      expect(connectorsHandle).toHaveBeenCalledTimes(1);
      expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_connectors');
    } finally {
      taskStore.dispose();
    }
  });

  it('falls back to the hosted executor for sheets_agent task execution after a local failure', async () => {
    const registeredTaskHandlers: Record<string, { createTask: (...args: unknown[]) => Promise<unknown> }> = {};
    const agentHandle = vi.fn(async () => {
      throw new Error('local agent failed');
    });

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

    const server = {
      server: {
        setRequestHandler: vi.fn(),
      },
      experimental: {
        tasks: {
          registerToolTask: vi.fn(
            (
              name: string,
              _config: Record<string, unknown>,
              handler: { createTask: (...args: unknown[]) => Promise<unknown> }
            ) => {
              registeredTaskHandlers[name] = handler;
            }
          ),
        },
      },
      registerTool: vi.fn(),
    } as unknown as McpServer;

    const googleClient = {
      authType: 'service_account',
    } as unknown as GoogleApiClient;

    await registerServalSheetsTools(server, createMockHandlers({ agentHandle }), {
      googleClient,
    });

    const agentTaskHandler = registeredTaskHandlers['sheets_agent'];
    expect(agentTaskHandler).toBeDefined();

    const taskStore = new TaskStoreAdapter(new InMemoryTaskStore());

    try {
      const created = (await agentTaskHandler!.createTask(
        {
          request: {
            action: 'list_plans',
          },
        },
        { taskStore, taskRequestedTtl: 60_000 }
      )) as { task: { taskId: string } };

      await vi.waitFor(async () => {
        const taskResult = await taskStore.getUnderlyingStore().getTaskResult(created.task.taskId);
        expect(taskResult?.status).toBe('completed');
        expect(taskResult?.result.structuredContent).toMatchObject({
          response: {
            success: true,
            action: 'list_plans',
            source: 'remote',
          },
        });
      });

      expect(agentHandle).toHaveBeenCalledTimes(1);
      expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_agent');
    } finally {
      taskStore.dispose();
    }
  });

  it('falls back to the hosted executor for sheets_bigquery task execution after a local failure', async () => {
    const registeredTaskHandlers: Record<string, { createTask: (...args: unknown[]) => Promise<unknown> }> = {};
    const bigqueryHandle = vi.fn(async () => {
      throw new Error('local bigquery failed');
    });

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

    const server = {
      server: {
        setRequestHandler: vi.fn(),
      },
      experimental: {
        tasks: {
          registerToolTask: vi.fn(
            (
              name: string,
              _config: Record<string, unknown>,
              handler: { createTask: (...args: unknown[]) => Promise<unknown> }
            ) => {
              registeredTaskHandlers[name] = handler;
            }
          ),
        },
      },
      registerTool: vi.fn(),
    } as unknown as McpServer;

    const googleClient = {
      authType: 'service_account',
    } as unknown as GoogleApiClient;

    await registerServalSheetsTools(server, createMockHandlers({ bigqueryHandle }), {
      googleClient,
    });

    const bigqueryTaskHandler = registeredTaskHandlers['sheets_bigquery'];
    expect(bigqueryTaskHandler).toBeDefined();

    const taskStore = new TaskStoreAdapter(new InMemoryTaskStore());

    try {
      const created = (await bigqueryTaskHandler!.createTask(
        {
          request: {
            action: 'list_connections',
            spreadsheetId: 'spreadsheet-123',
          },
        },
        { taskStore, taskRequestedTtl: 60_000 }
      )) as { task: { taskId: string } };

      await vi.waitFor(async () => {
        const taskResult = await taskStore.getUnderlyingStore().getTaskResult(created.task.taskId);
        expect(taskResult?.status).toBe('completed');
        expect(taskResult?.result.structuredContent).toMatchObject({
          response: {
            success: true,
            action: 'list_connections',
            source: 'remote',
          },
        });
      });

      expect(bigqueryHandle).toHaveBeenCalledTimes(1);
      expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_bigquery');
    } finally {
      taskStore.dispose();
    }
  });

  it('falls back to the hosted executor for sheets_appsscript task execution after a local failure', async () => {
    const registeredTaskHandlers: Record<string, { createTask: (...args: unknown[]) => Promise<unknown> }> = {};
    const appsscriptHandle = vi.fn(async () => {
      throw new Error('local appsscript failed');
    });

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

    const server = {
      server: {
        setRequestHandler: vi.fn(),
      },
      experimental: {
        tasks: {
          registerToolTask: vi.fn(
            (
              name: string,
              _config: Record<string, unknown>,
              handler: { createTask: (...args: unknown[]) => Promise<unknown> }
            ) => {
              registeredTaskHandlers[name] = handler;
            }
          ),
        },
      },
      registerTool: vi.fn(),
    } as unknown as McpServer;

    const googleClient = {
      authType: 'service_account',
    } as unknown as GoogleApiClient;

    await registerServalSheetsTools(server, createMockHandlers({ appsscriptHandle }), {
      googleClient,
    });

    const appsscriptTaskHandler = registeredTaskHandlers['sheets_appsscript'];
    expect(appsscriptTaskHandler).toBeDefined();

    const taskStore = new TaskStoreAdapter(new InMemoryTaskStore());

    try {
      const created = (await appsscriptTaskHandler!.createTask(
        {
          request: {
            action: 'get',
            spreadsheetId: 'spreadsheet-123',
          },
        },
        { taskStore, taskRequestedTtl: 60_000 }
      )) as { task: { taskId: string } };

      await vi.waitFor(async () => {
        const taskResult = await taskStore.getUnderlyingStore().getTaskResult(created.task.taskId);
        expect(taskResult?.status).toBe('completed');
        expect(taskResult?.result.structuredContent).toMatchObject({
          response: {
            success: true,
            action: 'get',
            source: 'remote',
          },
        });
      });

      expect(appsscriptHandle).toHaveBeenCalledTimes(1);
      expect(getRemoteToolClient).toHaveBeenCalledWith('sheets_appsscript');
    } finally {
      taskStore.dispose();
    }
  });
});
