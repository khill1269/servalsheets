import PQueue from 'p-queue';
import { describe, expect, it, vi } from 'vitest';

import { buildStdioToolRuntime } from '../../../packages/mcp-stdio/src/build-stdio-tool-runtime.js';

describe('@serval/mcp-stdio buildStdioToolRuntime', () => {
  it('registers tools and serves pre-init exempt tool calls through the composed runtime', async () => {
    const registerTool = vi.fn();
    const registerTaskTool = vi.fn();
    const registerResources = vi.fn(async () => undefined);
    const buildToolResponse = vi.fn(
      (payload: Record<string, unknown>) =>
        ({
          content: [],
          structuredContent: payload,
        }) as never
    );
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const runtime = buildStdioToolRuntime(
      {
        toolDefinitions: [
          {
            name: 'sheets_auth',
            description: 'Auth helper',
            inputSchema: {},
            outputSchema: {},
            annotations: { title: 'Sheets Auth' },
          },
        ],
        requestQueue: new PQueue({ concurrency: 1 }),
        connectionHealthCheck: {
          recordHeartbeat: vi.fn(),
        },
        taskStore: {},
        taskAbortControllers: new Map(),
        taskWatchdogTimers: new Map(),
        taskWatchdogMs: 1000,
        stagedRegistrationEnabled: false,
        enableToolsListChangedNotifications: false,
        getIsShutdown: () => false,
        getContext: () => null,
        getHandlers: () => null,
        getGoogleClient: () => null,
        getAuthHandler: () => null,
        setAuthHandler: vi.fn(),
        getCachedHandlerMap: () => null,
        setCachedHandlerMap: vi.fn(),
        getResourcesRegistered: () => false,
        setResourcesRegistered: vi.fn(),
        getResourceRegistrationPromise: () => null,
        setResourceRegistrationPromise: vi.fn(),
        getResourceRegistrationFailed: () => false,
        setResourceRegistrationFailed: vi.fn(),
        log: logger,
      },
      {
        registerResources,
        executeToolCall: {
          updateQueueMetrics: vi.fn(),
          createAbortError: (reason) => new Error(String(reason ?? 'aborted')),
          extractIdempotencyKeyFromHeaders: vi.fn(() => undefined),
          resolveCostTrackingTenantId: vi.fn(() => 'tenant'),
          extractPrincipalIdFromHeaders: vi.fn(() => 'principal'),
          createMetadataCache: vi.fn(() => undefined),
          createRequestContext: vi.fn((options) => ({
            logger,
            abortSignal: options.abortSignal,
            principalId: options.principalId,
            sessionContext: options.sessionContext,
            requestId: 'req-1',
          })),
          runWithRequestContext: async (_requestContext, operation) => await operation(),
          buildToolResponse,
          recordSpreadsheetId: vi.fn(),
          extractActionFromArgs: vi.fn(() => 'status'),
          recordToolExecutionResult: vi.fn(),
          recordToolExecutionException: vi.fn(),
          isGoogleAuthError: vi.fn(() => false),
          convertGoogleAuthError: vi.fn(() => ({ response: { success: false } })),
        },
        resolveToolCall: {
          handleSheetsAuthToolCall: vi.fn(async () => ({
            authHandler: null,
            result: { response: { success: true } },
          })),
          recordToolCall: vi.fn(),
          buildToolResponse,
          isToolCallAuthExempt: vi.fn(() => true),
          checkAuthAsync: vi.fn(async () => ({ authenticated: true })),
          buildAuthErrorResponse: vi.fn(() => ({ response: { success: false } })),
          handlePreInitExemptToolCall: vi.fn(async () => null),
          dispatchServerToolCall: vi.fn(),
        },
        createTaskStoreNotConfiguredError: (toolName) => new Error(`${toolName} missing task store`),
        buildToolResponse,
        getToolIcons: vi.fn(() => undefined),
        getToolExecution: vi.fn(() => undefined),
        registerTaskTool,
        registerTool,
        initializeStageManager: (registerNewTools) => {
          registerNewTools([
            {
              name: 'sheets_auth',
              description: 'Auth helper',
              inputSchema: {},
              outputSchema: {},
              annotations: { title: 'Sheets Auth' },
            },
          ]);
        },
        getInitialTools: () => [
          {
            name: 'sheets_auth',
            description: 'Auth helper',
            inputSchema: {},
            outputSchema: {},
            annotations: { title: 'Sheets Auth' },
          },
        ],
        markRegistered: vi.fn(),
        registerToolsListCompatibilityHandler: vi.fn(),
        syncToolList: vi.fn(),
      }
    );

    runtime.registerTools();
    const result = await runtime.handleToolCall('sheets_auth', { action: 'status' });

    expect(registerTool).toHaveBeenCalled();
    expect(registerTaskTool).not.toHaveBeenCalled();
    expect(registerResources).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      structuredContent: {
        response: {
          success: true,
        },
      },
    });
  });
});
