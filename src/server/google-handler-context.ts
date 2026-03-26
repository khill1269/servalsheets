import {
  BatchCompiler,
  DiffEngine,
  PolicyEnforcer,
  RangeResolver,
  RateLimiter,
  type ProgressEvent,
} from '../core/index.js';
import type { HandlerContext } from '../handlers/index.js';
import type { GoogleApiClient } from '../services/google-api.js';
import { SnapshotService } from '../services/snapshot.js';
import type { PerformanceServices } from '../startup/performance-init.js';
import type { RequestDeduplicator } from '../utils/request-deduplication.js';
import { createHandlerAuthContext } from './handler-auth-context.js';

export interface GoogleHandlerRuntimeServices extends PerformanceServices {
  readonly snapshotService: SnapshotService;
}

export interface CreateGoogleHandlerContextBaseOptions<TExtraContext extends object = object> {
  readonly googleClient: GoogleApiClient;
  readonly runtimeServices: GoogleHandlerRuntimeServices;
  readonly onProgress?: (event: ProgressEvent) => void;
  readonly requestDeduplicator?: RequestDeduplicator;
  readonly extraContext?: TExtraContext;
}

export interface CreateGoogleHandlerContextOptions<TExtraContext extends object = object> {
  readonly googleClient: GoogleApiClient;
  readonly onProgress?: (event: ProgressEvent) => void;
  readonly requestDeduplicator?: RequestDeduplicator;
  readonly extraContext?: TExtraContext;
}

type BaseGoogleHandlerContext = Pick<
  HandlerContext,
  | 'batchCompiler'
  | 'rangeResolver'
  | 'googleClient'
  | 'batchingSystem'
  | 'cachedSheetsApi'
  | 'requestMerger'
  | 'parallelExecutor'
  | 'prefetchPredictor'
  | 'accessPatternTracker'
  | 'queryOptimizer'
  | 'prefetchingSystem'
  | 'snapshotService'
  | 'auth'
  | 'requestDeduplicator'
>;

export async function initializeGoogleHandlerRuntime(
  googleClient: GoogleApiClient
): Promise<GoogleHandlerRuntimeServices> {
  const snapshotService = new SnapshotService({ driveApi: googleClient.drive });
  const { initializePerformanceOptimizations } = await import('../startup/performance-init.js');
  const performanceServices = await initializePerformanceOptimizations(googleClient.sheets);

  return {
    snapshotService,
    ...performanceServices,
  };
}

export async function createGoogleHandlerContext<TExtraContext extends object = object>(
  options: CreateGoogleHandlerContextOptions<TExtraContext>
): Promise<BaseGoogleHandlerContext & TExtraContext> {
  const runtimeServices = await initializeGoogleHandlerRuntime(options.googleClient);

  return createGoogleHandlerContextBase({
    ...options,
    runtimeServices,
  });
}

export function createGoogleHandlerContextBase<TExtraContext extends object = object>(
  options: CreateGoogleHandlerContextBaseOptions<TExtraContext>
): BaseGoogleHandlerContext & TExtraContext {
  const { googleClient, runtimeServices } = options;

  return {
    batchCompiler: new BatchCompiler({
      rateLimiter: new RateLimiter(),
      diffEngine: new DiffEngine({ sheetsApi: googleClient.sheets }),
      policyEnforcer: new PolicyEnforcer(),
      snapshotService: runtimeServices.snapshotService,
      sheetsApi: googleClient.sheets,
      onProgress: options.onProgress,
    }),
    rangeResolver: new RangeResolver({ sheetsApi: googleClient.sheets }),
    googleClient,
    batchingSystem: runtimeServices.batchingSystem,
    cachedSheetsApi: runtimeServices.cachedSheetsApi,
    requestMerger: runtimeServices.requestMerger,
    parallelExecutor: runtimeServices.parallelExecutor,
    prefetchPredictor: runtimeServices.prefetchPredictor,
    accessPatternTracker: runtimeServices.accessPatternTracker,
    queryOptimizer: runtimeServices.queryOptimizer,
    prefetchingSystem: runtimeServices.prefetchingSystem,
    snapshotService: runtimeServices.snapshotService,
    auth: createHandlerAuthContext(() => googleClient),
    ...(options.requestDeduplicator ? { requestDeduplicator: options.requestDeduplicator } : {}),
    ...(options.extraContext ?? ({} as TExtraContext)),
  };
}
