import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedPerformanceServices = {
  batchingSystem: { kind: 'batching' },
  cachedSheetsApi: { kind: 'cached' },
  requestMerger: { kind: 'merger' },
  parallelExecutor: { kind: 'parallel' },
  prefetchPredictor: { kind: 'predictor' },
  accessPatternTracker: { kind: 'tracker' },
  queryOptimizer: { kind: 'optimizer' },
  prefetchingSystem: null,
};

const initializePerformanceOptimizations = vi.fn(async () => mockedPerformanceServices);

vi.mock('../../src/startup/performance-init.js', () => ({
  initializePerformanceOptimizations,
}));

import {
  createGoogleHandlerContext,
  createGoogleHandlerContextBase,
  initializeGoogleHandlerRuntime,
} from '../../src/server/google-handler-context.js';

describe('google handler context helper', () => {
  beforeEach(() => {
    initializePerformanceOptimizations.mockClear();
  });

  it('initializes shared Google runtime services', async () => {
    const googleClient = {
      sheets: { spreadsheets: {} },
      drive: {},
    };

    const runtime = await initializeGoogleHandlerRuntime(googleClient as never);

    expect(initializePerformanceOptimizations).toHaveBeenCalledWith(googleClient.sheets);
    expect(runtime.snapshotService).toBeDefined();
    expect(runtime.queryOptimizer).toBe(mockedPerformanceServices.queryOptimizer);
    expect(runtime.prefetchingSystem).toBeNull();
  });

  it('builds a reusable base handler context with live auth getters', () => {
    const googleClient = {
      sheets: { spreadsheets: {} },
      drive: {},
      hasElevatedAccess: false,
      scopes: ['spreadsheets.readonly'],
    };
    const requestDeduplicator = { kind: 'dedup' };

    const context = createGoogleHandlerContextBase({
      googleClient: googleClient as never,
      runtimeServices: {
        snapshotService: { kind: 'snapshot' },
        ...mockedPerformanceServices,
      } as never,
      requestDeduplicator: requestDeduplicator as never,
      extraContext: {
        taskStore: { kind: 'task-store' },
      },
    });

    expect(context.batchCompiler).toBeDefined();
    expect(context.rangeResolver).toBeDefined();
    expect(context.googleClient).toBe(googleClient);
    expect(context.requestDeduplicator).toBe(requestDeduplicator);
    expect(context.taskStore).toEqual({ kind: 'task-store' });
    expect(context.auth?.hasElevatedAccess).toBe(false);
    expect(context.auth?.scopes).toEqual(['spreadsheets.readonly']);

    googleClient.hasElevatedAccess = true;
    googleClient.scopes = ['spreadsheets', 'drive.file'];

    expect(context.auth?.hasElevatedAccess).toBe(true);
    expect(context.auth?.scopes).toEqual(['spreadsheets', 'drive.file']);
  });

  it('creates a Google handler context without separate runtime plumbing', async () => {
    const googleClient = {
      sheets: { spreadsheets: {} },
      drive: {},
      hasElevatedAccess: true,
      scopes: ['spreadsheets', 'drive.file'],
    };
    const requestDeduplicator = { kind: 'dedup' };

    const context = await createGoogleHandlerContext({
      googleClient: googleClient as never,
      requestDeduplicator: requestDeduplicator as never,
      extraContext: {
        taskStore: { kind: 'task-store' },
      },
    });

    expect(initializePerformanceOptimizations).toHaveBeenCalledWith(googleClient.sheets);
    expect(context.googleClient).toBe(googleClient);
    expect(context.requestDeduplicator).toBe(requestDeduplicator);
    expect(context.taskStore).toEqual({ kind: 'task-store' });
    expect(context.auth?.hasElevatedAccess).toBe(true);
    expect(context.auth?.scopes).toEqual(['spreadsheets', 'drive.file']);
  });
});
