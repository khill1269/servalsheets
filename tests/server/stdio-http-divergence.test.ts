/**
 * Tests for STDIO/HTTP execution path divergence bugs (C7/C8/C9 from Session 113 audit).
 *
 * C7: autoRecord fires on STDIO path (missing from dispatchServerToolCall)
 * C8: sessionContext not injected into STDIO HandlerContext (missing from google-runtime-bootstrap extraContext)
 * C9: Rate limiting and mutation safety bypass STDIO (missing from dispatchServerToolCall)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Shared hoisted mocks ────────────────────────────────────────────────────

const { getRemoteToolClient } = vi.hoisted(() => ({
  getRemoteToolClient: vi.fn(),
}));

vi.mock('../../src/services/remote-mcp-tool-client.js', () => ({
  getRemoteToolClient,
}));

// ─── C9: rate-limit / mutation-safety mocks ──────────────────────────────────

const { checkRateLimit, detectMutationSafetyViolation } = vi.hoisted(() => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  detectMutationSafetyViolation: vi.fn(() => null),
}));

vi.mock('../../src/middleware/rate-limit-middleware.js', () => ({
  checkRateLimit,
}));

vi.mock('../../src/middleware/mutation-safety-middleware.js', () => ({
  detectMutationSafetyViolation,
}));

// ─── C7/C8: session context mocks ────────────────────────────────────────────

const { getSessionContext } = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
}));

vi.mock('../../src/services/session-context.js', () => ({
  getSessionContext,
  resetSessionContext: vi.fn(),
  getOrCreateSessionContextAsync: vi.fn(),
}));

// ─── C8: google-runtime-bootstrap mocks (hoisted, top-level) ─────────────────

const googleRuntimeMocks = vi.hoisted(() => {
  const backendInitialize = vi.fn().mockResolvedValue(undefined);
  return {
    createGoogleHandlerContext: vi.fn().mockResolvedValue({}),
    createHandlers: vi.fn().mockReturnValue({}),
    createHandlerRuntimeBridge: vi.fn().mockReturnValue({}),
    createTaskAwareSamplingServer: vi.fn(),
    getCostTracker: vi.fn(),
    initializeGoogleAdvancedFeatures: vi.fn(),
    initializeWebhookBootstrap: vi.fn(),
    backendInitialize,
    GoogleSheetsBackend: vi.fn(function MockGoogleSheetsBackend(
      this: { initialize: ReturnType<typeof vi.fn> }
    ) {
      this.initialize = backendInitialize;
      return this;
    }),
    DuckDBEngine: vi.fn(function MockDuckDBEngine() {
      return { kind: 'duckdb' };
    }),
    SchedulerService: vi.fn(function MockSchedulerService() {
      return { kind: 'scheduler' };
    }),
  };
});

vi.mock('../../src/server/google-handler-context.js', () => ({
  createGoogleHandlerContext: googleRuntimeMocks.createGoogleHandlerContext,
}));

vi.mock('../../src/handlers/index.js', () => ({
  createHandlers: googleRuntimeMocks.createHandlers,
}));

vi.mock('../../src/server/handler-runtime-bridge.js', () => ({
  createHandlerRuntimeBridge: googleRuntimeMocks.createHandlerRuntimeBridge,
}));

vi.mock('../../src/mcp/sampling.js', () => ({
  createTaskAwareSamplingServer: googleRuntimeMocks.createTaskAwareSamplingServer,
}));

vi.mock('../../src/services/cost-tracker.js', () => ({
  getCostTracker: googleRuntimeMocks.getCostTracker,
}));

vi.mock('../../src/server/google-feature-bootstrap.js', () => ({
  initializeGoogleAdvancedFeatures: googleRuntimeMocks.initializeGoogleAdvancedFeatures,
}));

vi.mock('../../src/startup/webhook-bootstrap.js', () => ({
  initializeWebhookBootstrap: googleRuntimeMocks.initializeWebhookBootstrap,
}));

vi.mock('../../src/adapters/index.js', () => ({
  GoogleSheetsBackend: googleRuntimeMocks.GoogleSheetsBackend,
}));

vi.mock('../../src/services/duckdb-engine.js', () => ({
  DuckDBEngine: googleRuntimeMocks.DuckDBEngine,
}));

vi.mock('../../src/services/scheduler.js', () => ({
  SchedulerService: googleRuntimeMocks.SchedulerService,
}));

import { dispatchServerToolCall } from '../../src/server/handler-dispatch.js';
import { initializeServerGoogleRuntime } from '../../src/server/google-runtime-bootstrap.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeBaseParams(overrides: Record<string, unknown> = {}) {
  return {
    toolName: 'sheets_data',
    args: { request: { action: 'read', spreadsheetId: 'sheet-1' } },
    rawArgs: { request: { action: 'read', spreadsheetId: 'sheet-1' } },
    rawAction: 'read' as string | undefined,
    handlers: {} as never,
    authHandler: null,
    cachedHandlerMap: {
      sheets_data: vi.fn(async () => ({
        response: { success: true, values: [[1]] },
      })),
    },
    context: { sessionContext: undefined } as never,
    googleClient: null,
    requestId: 'req-test',
    costTrackingTenantId: 'tenant-test',
    ...overrides,
  };
}

// ─── C9: rate limiting on STDIO path ─────────────────────────────────────────

// Minimal stub returned by getSessionContext when a real value is not needed.
// buildToolResponse calls getSessionContext().trackRequest(), so the stub must
// have trackRequest to avoid TypeError in error-path tests.
function makeSessionContextStub(overrides: Record<string, unknown> = {}) {
  return {
    trackRequest: vi.fn(),
    getPreferences: () => ({ autoRecord: false }),
    recordOperation: vi.fn(),
    ...overrides,
  };
}

describe('C9: rate limiting on STDIO dispatch path', () => {
  beforeEach(() => {
    getRemoteToolClient.mockReset();
    checkRateLimit.mockReset();
    detectMutationSafetyViolation.mockReset();
    getSessionContext.mockReset();
    getSessionContext.mockReturnValue(makeSessionContextStub());
  });

  it('returns RATE_LIMITED error when checkRateLimit denies the request', async () => {
    checkRateLimit.mockReturnValueOnce({ allowed: false, retryAfterMs: 5000 });
    detectMutationSafetyViolation.mockReturnValue(null);

    const result = await dispatchServerToolCall(makeBaseParams());

    expect(checkRateLimit).toHaveBeenCalled();
    expect(result.kind).toBe('error');
    if (result.kind !== 'error') throw new Error('Expected error result');

    const body = result.response.structuredContent as {
      response: { success: boolean; error: { code: string } };
    };
    expect(body.response.success).toBe(false);
    expect(body.response.error.code).toBe('RATE_LIMITED');
  });

  it('allows request through when checkRateLimit permits it', async () => {
    checkRateLimit.mockReturnValueOnce({ allowed: true });
    detectMutationSafetyViolation.mockReturnValue(null);
    getSessionContext.mockReturnValue(makeSessionContextStub());

    const handler = vi.fn(async () => ({ response: { success: true } }));
    const params = makeBaseParams({ cachedHandlerMap: { sheets_data: handler } });

    const result = await dispatchServerToolCall(params, {
      executeRoutedToolCall: async ({ localExecute }: { localExecute: () => Promise<unknown> }) =>
        localExecute(),
    });

    expect(checkRateLimit).toHaveBeenCalled();
    expect(result.kind).toBe('result');
  });
});

// ─── C9: mutation safety on STDIO path ───────────────────────────────────────

describe('C9: mutation safety on STDIO dispatch path', () => {
  beforeEach(() => {
    getRemoteToolClient.mockReset();
    checkRateLimit.mockReset();
    detectMutationSafetyViolation.mockReset();
    getSessionContext.mockReset();
    getSessionContext.mockReturnValue(makeSessionContextStub());
  });

  it('returns FORMULA_INJECTION_BLOCKED when detectMutationSafetyViolation fires', async () => {
    checkRateLimit.mockReturnValueOnce({ allowed: true });
    detectMutationSafetyViolation.mockReturnValueOnce({
      path: 'request.values[0]',
      preview: '=IMPORTDATA(evil)',
    });

    const result = await dispatchServerToolCall(
      makeBaseParams({
        args: {
          request: { action: 'write', spreadsheetId: 'sheet-1', values: [['=IMPORTDATA(evil)']] },
        },
      })
    );

    expect(detectMutationSafetyViolation).toHaveBeenCalled();
    expect(result.kind).toBe('error');
    if (result.kind !== 'error') throw new Error('Expected error result');

    const body = result.response.structuredContent as {
      response: { success: boolean; error: { code: string } };
    };
    expect(body.response.success).toBe(false);
    expect(body.response.error.code).toBe('FORMULA_INJECTION_BLOCKED');
  });

  it('allows safe mutations through when no violation is detected', async () => {
    checkRateLimit.mockReturnValueOnce({ allowed: true });
    detectMutationSafetyViolation.mockReturnValueOnce(null);
    getSessionContext.mockReturnValue(makeSessionContextStub());

    const handler = vi.fn(async () => ({ response: { success: true } }));
    const params = makeBaseParams({ cachedHandlerMap: { sheets_data: handler } });

    const result = await dispatchServerToolCall(params, {
      executeRoutedToolCall: async ({ localExecute }: { localExecute: () => Promise<unknown> }) =>
        localExecute(),
    });

    expect(result.kind).toBe('result');
  });
});

// ─── C7: autoRecord on STDIO path ────────────────────────────────────────────

describe('C7: autoRecord fires on STDIO dispatch path when preference is enabled', () => {
  beforeEach(() => {
    getRemoteToolClient.mockReset();
    checkRateLimit.mockReset();
    detectMutationSafetyViolation.mockReset();
    getSessionContext.mockReset();
    getSessionContext.mockReturnValue(makeSessionContextStub());
  });

  it('calls sessionContext.recordOperation when autoRecord is true and operation succeeds', async () => {
    checkRateLimit.mockReturnValueOnce({ allowed: true });
    detectMutationSafetyViolation.mockReturnValueOnce(null);

    const recordOperation = vi.fn();
    getSessionContext.mockReturnValue({
      getPreferences: () => ({ autoRecord: true }),
      recordOperation,
    });

    const handler = vi.fn(async () => ({
      response: { success: true, spreadsheetId: 'sheet-1' },
    }));

    const result = await dispatchServerToolCall(
      makeBaseParams({
        toolName: 'sheets_core',
        args: { request: { action: 'update_sheet', spreadsheetId: 'sheet-1' } },
        rawArgs: { request: { action: 'update_sheet', spreadsheetId: 'sheet-1' } },
        rawAction: 'update_sheet',
        cachedHandlerMap: { sheets_core: handler },
        context: { sessionContext: undefined } as never,
      }),
      {
        executeRoutedToolCall: async ({ localExecute }: { localExecute: () => Promise<unknown> }) =>
          localExecute(),
      }
    );

    expect(result.kind).toBe('result');
    expect(getSessionContext).toHaveBeenCalled();
    expect(recordOperation).toHaveBeenCalled();
  });

  it('does NOT call recordOperation when autoRecord is false', async () => {
    checkRateLimit.mockReturnValueOnce({ allowed: true });
    detectMutationSafetyViolation.mockReturnValueOnce(null);

    const recordOperation = vi.fn();
    getSessionContext.mockReturnValue({
      getPreferences: () => ({ autoRecord: false }),
      recordOperation,
    });

    const handler = vi.fn(async () => ({
      response: { success: true, spreadsheetId: 'sheet-1' },
    }));

    await dispatchServerToolCall(
      makeBaseParams({
        toolName: 'sheets_core',
        args: { request: { action: 'update_sheet', spreadsheetId: 'sheet-1' } },
        rawArgs: { request: { action: 'update_sheet', spreadsheetId: 'sheet-1' } },
        rawAction: 'update_sheet',
        cachedHandlerMap: { sheets_core: handler },
      }),
      {
        executeRoutedToolCall: async ({ localExecute }: { localExecute: () => Promise<unknown> }) =>
          localExecute(),
      }
    );

    expect(recordOperation).not.toHaveBeenCalled();
  });
});

// ─── C8: sessionContext injected into STDIO HandlerContext ────────────────────

describe('C8: sessionContext injected into STDIO HandlerContext via google-runtime-bootstrap', () => {
  beforeEach(() => {
    googleRuntimeMocks.createGoogleHandlerContext.mockReset();
    googleRuntimeMocks.createHandlers.mockReset();
    googleRuntimeMocks.createHandlerRuntimeBridge.mockReset();
    googleRuntimeMocks.backendInitialize.mockReset();
    googleRuntimeMocks.GoogleSheetsBackend.mockClear();
    googleRuntimeMocks.DuckDBEngine.mockClear();
    googleRuntimeMocks.SchedulerService.mockClear();
    getSessionContext.mockReset();

    googleRuntimeMocks.createGoogleHandlerContext.mockResolvedValue({});
    googleRuntimeMocks.createHandlers.mockReturnValue({});
    googleRuntimeMocks.createHandlerRuntimeBridge.mockReturnValue({});
    googleRuntimeMocks.backendInitialize.mockResolvedValue(undefined);
  });

  it('passes sessionContext from getSessionContext() in extraContext', async () => {
    const mockSessionContext = { kind: 'session-context', id: 'stdio-session' };
    getSessionContext.mockReturnValue(mockSessionContext);

    await initializeServerGoogleRuntime({
      googleClient: { sheets: {}, drive: {} } as never,
      envDataDir: '/tmp/data',
      taskStore: {} as never,
      mcpServer: {} as never,
      costTrackingEnabled: false,
      dispatchScheduledJob: vi.fn(async () => ({ isError: false })),
    });

    expect(getSessionContext).toHaveBeenCalled();
    const contextOptions = googleRuntimeMocks.createGoogleHandlerContext.mock.calls[0]?.[0];
    expect(contextOptions?.extraContext).toMatchObject({
      sessionContext: mockSessionContext,
    });
  });

  it('includes sessionContext alongside existing extraContext fields', async () => {
    const mockSessionContext = { kind: 'session-context', id: 'stdio-session-2' };
    getSessionContext.mockReturnValue(mockSessionContext);
    const bridge = { samplingServer: { kind: 'sampling' } };
    googleRuntimeMocks.createHandlerRuntimeBridge.mockReturnValue(bridge);

    await initializeServerGoogleRuntime({
      googleClient: { sheets: {}, drive: {} } as never,
      envDataDir: '/tmp/data',
      taskStore: { kind: 'task-store' } as never,
      mcpServer: {} as never,
      costTrackingEnabled: false,
      dispatchScheduledJob: vi.fn(async () => ({ isError: false })),
    });

    const contextOptions = googleRuntimeMocks.createGoogleHandlerContext.mock.calls[0]?.[0];
    expect(contextOptions?.extraContext).toMatchObject({
      sessionContext: mockSessionContext,
      duckdbEngine: { kind: 'duckdb' },
      taskStore: { kind: 'task-store' },
      ...bridge,
    });
  });
});
