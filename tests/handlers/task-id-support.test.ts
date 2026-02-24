/**
 * Task ID Support Tests (MCP SEP-1686)
 *
 * TDD: These tests MUST FAIL before implementation.
 *
 * Verifies that long-running handler actions create a task entry and return
 * a taskId in their response, following the pattern established in
 * src/handlers/analyze.ts around line 2421.
 *
 * Covered actions:
 * - sheets_bigquery: export_to_bigquery, import_from_bigquery
 * - sheets_appsscript: run
 * - sheets_composite: export_large_dataset
 * - sheets_history: timeline
 * - sheets_federation: call_remote, get_server_tools, validate_connection, list_servers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SheetsBigQueryHandler } from '../../src/handlers/bigquery.js';
import { SheetsAppsScriptHandler } from '../../src/handlers/appsscript.js';
import { CompositeHandler } from '../../src/handlers/composite.js';
import { HistoryHandler } from '../../src/handlers/history.js';
import { FederationHandler } from '../../src/handlers/federation.js';
import type { HandlerContext } from '../../src/handlers/base.js';

// ============================================================================
// Mock task store
// ============================================================================

function createMockTaskStore() {
  return {
    createTask: vi.fn().mockResolvedValue({
      taskId: 'mock-task-id-123',
      status: 'working',
    }),
    updateTaskStatus: vi.fn().mockResolvedValue(undefined),
    storeTaskResult: vi.fn().mockResolvedValue(undefined),
    getTask: vi.fn().mockResolvedValue(null),
    getTaskResult: vi.fn().mockResolvedValue(null),
    listTasks: vi.fn().mockResolvedValue({ tasks: [], nextCursor: undefined }),
    cancelTask: vi.fn().mockResolvedValue(undefined),
    isTaskCancelled: vi.fn().mockResolvedValue(false),
    getCancellationReason: vi.fn().mockResolvedValue(null),
    getUnderlyingStore: vi.fn(),
    dispose: vi.fn(),
  };
}

// ============================================================================
// BigQuery: export_to_bigquery and import_from_bigquery
// ============================================================================

describe('sheets_bigquery task ID support', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test mock type
  let mockSheetsApi: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test mock type
  let mockBigQueryApi: any;
  let mockContext: HandlerContext;
  let mockTaskStore: ReturnType<typeof createMockTaskStore>;
  let handler: SheetsBigQueryHandler;

  beforeEach(() => {
    mockTaskStore = createMockTaskStore();

    mockSheetsApi = {
      spreadsheets: {
        values: {
          get: vi.fn().mockResolvedValue({
            data: {
              values: [
                ['id', 'name'],
                ['1', 'Alice'],
                ['2', 'Bob'],
              ],
            },
          }),
          update: vi.fn().mockResolvedValue({ data: {} }),
        },
        batchUpdate: vi.fn().mockResolvedValue({
          data: {
            replies: [
              {
                addSheet: {
                  properties: {
                    sheetId: 999,
                    title: 'BigQuery Results',
                  },
                },
              },
            ],
          },
        }),
      },
    };

    mockBigQueryApi = {
      tabledata: {
        insertAll: vi.fn().mockResolvedValue({
          data: { insertErrors: [] },
        }),
      },
      jobs: {
        query: vi.fn().mockResolvedValue({
          data: {
            rows: [{ f: [{ v: '1' }, { v: 'Alice' }] }],
            schema: {
              fields: [
                { name: 'id', type: 'INTEGER' },
                { name: 'name', type: 'STRING' },
              ],
            },
            totalRows: '1',
            jobComplete: true,
          },
        }),
      },
    };

    mockContext = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock type
      googleClient: {} as any,
      taskStore: mockTaskStore as unknown as HandlerContext['taskStore'],
    };

    handler = new SheetsBigQueryHandler(mockContext, mockSheetsApi, mockBigQueryApi);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('export_to_bigquery', () => {
    it('should create a task and return taskId in response', async () => {
      const result = await handler.handle({
        request: {
          action: 'export_to_bigquery',
          spreadsheetId: 'test-id',
          range: 'Sheet1!A1:B3',
          destination: {
            projectId: 'my-project',
            datasetId: 'my-dataset',
            tableId: 'my-table',
          },
        },
      });

      expect(result.response.success).toBe(true);
      expect(mockTaskStore.createTask).toHaveBeenCalledOnce();
      expect(result.response).toHaveProperty('taskId');
      if (result.response.success && 'taskId' in result.response) {
        expect(result.response.taskId).toBe('mock-task-id-123');
      }
    });

    it('should still work when taskStore is not available (graceful degradation)', async () => {
      const contextWithoutTaskStore: HandlerContext = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock type
        googleClient: {} as any,
      };
      const handlerNoTask = new SheetsBigQueryHandler(
        contextWithoutTaskStore,
        mockSheetsApi,
        mockBigQueryApi
      );

      const result = await handlerNoTask.handle({
        request: {
          action: 'export_to_bigquery',
          spreadsheetId: 'test-id',
          range: 'Sheet1!A1:B3',
          destination: {
            projectId: 'my-project',
            datasetId: 'my-dataset',
            tableId: 'my-table',
          },
        },
      });

      expect(result.response.success).toBe(true);
      // No taskId when taskStore unavailable
      if (result.response.success && 'rowCount' in result.response) {
        expect(result.response).not.toHaveProperty('taskId');
      }
    });
  });

  describe('import_from_bigquery', () => {
    it('should create a task and return taskId in response', async () => {
      const result = await handler.handle({
        request: {
          action: 'import_from_bigquery',
          spreadsheetId: 'test-id',
          query: 'SELECT id, name FROM `my-project.my-dataset.my-table`',
          projectId: 'my-project',
          sheetName: 'BigQuery Results',
          startCell: 'A1',
        },
      });

      expect(result.response.success).toBe(true);
      expect(mockTaskStore.createTask).toHaveBeenCalledOnce();
      expect(result.response).toHaveProperty('taskId');
      if (result.response.success && 'taskId' in result.response) {
        expect(result.response.taskId).toBe('mock-task-id-123');
      }
    });
  });
});

// ============================================================================
// AppsScript: run
// ============================================================================

describe('sheets_appsscript run task ID support', () => {
  let handler: SheetsAppsScriptHandler;
  let mockTaskStore: ReturnType<typeof createMockTaskStore>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock type
  let mockFetch: any;

  beforeEach(() => {
    mockTaskStore = createMockTaskStore();

    const context: HandlerContext = {
      googleClient: {
        oauth2: {
          credentials: {
            access_token: 'test-token',
            refresh_token: 'test-refresh',
            expiry_date: Date.now() + 3600000,
          },
          getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token' }),
        },
        getTokenStatus: vi.fn().mockReturnValue({
          hasAccessToken: true,
          hasRefreshToken: true,
          expiryDate: Date.now() + 3600000,
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock type
      } as any,
      taskStore: mockTaskStore as unknown as HandlerContext['taskStore'],
    };

    handler = new SheetsAppsScriptHandler(context);

    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          done: true,
          response: {
            '@type': 'type.googleapis.com/google.apps.script.v1.ExecutionResponse',
            result: 'Hello, World!',
          },
        })
      ),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock fetch
    global.fetch = mockFetch as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should ALWAYS create a task and return taskId for run action', async () => {
    const result = await handler.handle({
      request: {
        action: 'run',
        scriptId: 'script-abc-123',
        functionName: 'myFunction',
      },
    });

    expect(result.response.success).toBe(true);
    expect(mockTaskStore.createTask).toHaveBeenCalledOnce();
    expect(result.response).toHaveProperty('taskId');
    if (result.response.success && 'taskId' in result.response) {
      expect(result.response.taskId).toBe('mock-task-id-123');
    }
  });

  it('should still run successfully when taskStore is not available', async () => {
    const contextNoTask: HandlerContext = {
      googleClient: {
        oauth2: {
          credentials: {
            access_token: 'test-token',
            refresh_token: 'test-refresh',
            expiry_date: Date.now() + 3600000,
          },
          getAccessToken: vi.fn().mockResolvedValue({ token: 'test-token' }),
        },
        getTokenStatus: vi.fn().mockReturnValue({
          hasAccessToken: true,
          hasRefreshToken: true,
          expiryDate: Date.now() + 3600000,
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock type
      } as any,
    };
    const handlerNoTask = new SheetsAppsScriptHandler(contextNoTask);

    const result = await handlerNoTask.handle({
      request: {
        action: 'run',
        scriptId: 'script-abc-123',
        functionName: 'myFunction',
      },
    });

    // Should still succeed even without task store
    expect(result.response.success).toBe(true);
  });
});

// ============================================================================
// Composite: export_large_dataset
// ============================================================================

describe('sheets_composite export_large_dataset task ID support', () => {
  let handler: CompositeHandler;
  let mockTaskStore: ReturnType<typeof createMockTaskStore>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock type
  let mockSheetsApi: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock type
  let mockDriveApi: any;

  beforeEach(() => {
    mockTaskStore = createMockTaskStore();

    mockSheetsApi = {
      spreadsheets: {
        values: {
          get: vi.fn().mockResolvedValue({
            data: {
              values: [
                ['col1', 'col2'],
                ['a', 'b'],
                ['c', 'd'],
              ],
            },
          }),
        },
      },
    };

    mockDriveApi = {};

    const context: HandlerContext = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock type
      googleClient: {} as any,
      taskStore: mockTaskStore as unknown as HandlerContext['taskStore'],
    };

    handler = new CompositeHandler(context, mockSheetsApi, mockDriveApi);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create a task and return taskId for export_large_dataset', async () => {
    const result = await handler.handle({
      request: {
        action: 'export_large_dataset',
        spreadsheetId: 'test-id',
        range: 'Sheet1!A1:B3',
        format: 'json',
      },
    });

    expect(result.response.success).toBe(true);
    expect(mockTaskStore.createTask).toHaveBeenCalledOnce();
    expect(result.response).toHaveProperty('taskId');
    if (result.response.success && 'taskId' in result.response) {
      expect(result.response.taskId).toBe('mock-task-id-123');
    }
  });
});

// ============================================================================
// History: timeline
// ============================================================================

describe('sheets_history timeline task ID support', () => {
  let handler: HistoryHandler;
  let mockTaskStore: ReturnType<typeof createMockTaskStore>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock type
  let mockDriveApi: any;

  beforeEach(() => {
    mockTaskStore = createMockTaskStore();

    mockDriveApi = {
      revisions: {
        list: vi.fn().mockResolvedValue({
          data: {
            revisions: [
              {
                id: '1',
                modifiedTime: '2024-01-01T00:00:00Z',
                lastModifyingUser: { displayName: 'Alice' },
              },
            ],
          },
        }),
      },
    };

    handler = new HistoryHandler({
      driveApi: mockDriveApi,
      taskStore: mockTaskStore as unknown as HandlerContext['taskStore'],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create a task and return taskId for timeline action', async () => {
    const result = await handler.handle({
      request: {
        action: 'timeline',
        spreadsheetId: 'test-id',
      },
    });

    expect(result.response.success).toBe(true);
    expect(mockTaskStore.createTask).toHaveBeenCalledOnce();
    expect(result.response).toHaveProperty('taskId');
    if (result.response.success && 'taskId' in result.response) {
      expect(result.response.taskId).toBe('mock-task-id-123');
    }
  });

  it('should work without taskStore (graceful degradation)', async () => {
    const handlerNoTask = new HistoryHandler({
      driveApi: mockDriveApi,
    });

    const result = await handlerNoTask.handle({
      request: {
        action: 'timeline',
        spreadsheetId: 'test-id',
      },
    });

    expect(result.response.success).toBe(true);
    // No taskId when taskStore not available
  });
});

// ============================================================================
// Federation: all 4 actions
// ============================================================================

describe('sheets_federation task ID support', () => {
  let handler: FederationHandler;
  let mockTaskStore: ReturnType<typeof createMockTaskStore>;

  beforeEach(() => {
    mockTaskStore = createMockTaskStore();

    // Mock federation env — use importOriginal to preserve other exports
    // (getCircuitBreakerConfig, etc. must remain available for BigQuery/AppsScript)
    vi.mock('../../src/config/env.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../src/config/env.js')>();
      return {
        ...actual,
        getFederationConfig: vi.fn().mockReturnValue({
          enabled: true,
          serversJson: JSON.stringify([
            { name: 'test-server', url: 'http://localhost:3001' },
          ]),
        }),
        getEnv: vi.fn().mockReturnValue({}),
      };
    });

    vi.mock('../../src/config/federation-config.js', () => ({
      parseFederationServers: vi.fn().mockReturnValue([
        { name: 'test-server', url: 'http://localhost:3001' },
      ]),
    }));

    vi.mock('../../src/services/federated-mcp-client.js', () => ({
      getFederationClient: vi.fn().mockResolvedValue({
        callRemoteTool: vi.fn().mockResolvedValue({ result: 'ok' }),
        listRemoteTools: vi.fn().mockResolvedValue([
          { name: 'tool1', description: 'Test tool' },
        ]),
        isConnected: vi.fn().mockReturnValue(true),
      }),
    }));

    handler = new FederationHandler(mockTaskStore as unknown as HandlerContext['taskStore']);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('call_remote should create a task and return taskId', async () => {
    const result = await handler.handle({
      request: {
        action: 'call_remote',
        serverName: 'test-server',
        toolName: 'tool1',
        toolInput: {},
      },
    });

    expect(result.response.success).toBe(true);
    expect(mockTaskStore.createTask).toHaveBeenCalledOnce();
    expect(result.response).toHaveProperty('taskId');
  });

  it('list_servers should create a task and return taskId', async () => {
    const result = await handler.handle({
      request: {
        action: 'list_servers',
      },
    });

    expect(result.response.success).toBe(true);
    expect(mockTaskStore.createTask).toHaveBeenCalledOnce();
    expect(result.response).toHaveProperty('taskId');
  });

  it('get_server_tools should create a task and return taskId', async () => {
    const result = await handler.handle({
      request: {
        action: 'get_server_tools',
        serverName: 'test-server',
      },
    });

    expect(result.response.success).toBe(true);
    expect(mockTaskStore.createTask).toHaveBeenCalledOnce();
    expect(result.response).toHaveProperty('taskId');
  });

  it('validate_connection should create a task and return taskId', async () => {
    const result = await handler.handle({
      request: {
        action: 'validate_connection',
        serverName: 'test-server',
      },
    });

    expect(result.response.success).toBe(true);
    expect(mockTaskStore.createTask).toHaveBeenCalledOnce();
    expect(result.response).toHaveProperty('taskId');
  });

  it('should work without taskStore (graceful degradation)', async () => {
    const handlerNoTask = new FederationHandler();

    const result = await handlerNoTask.handle({
      request: {
        action: 'list_servers',
      },
    });

    expect(result.response.success).toBe(true);
    // No taskId when taskStore not available
  });
});
