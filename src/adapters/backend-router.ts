/**
 * ServalSheets - Backend Router
 *
 * Routes SpreadsheetBackend method calls to the correct platform backend
 * based on document ID patterns or explicit platform selection.
 *
 * Design:
 *   - Single point of dispatch for multi-platform support
 *   - Routes by document ID pattern + optional explicit platform hint
 *   - Auto-discovers available backends from environment configuration
 *   - Delegates all work to registered backends
 *
 * Routing logic:
 *   1. Check explicit platform hint (if provided in params)
 *   2. Analyze document ID pattern:
 *      - Google: 44-char alphanumeric string (typical Google Doc ID)
 *      - Excel: OneDrive/SharePoint path patterns or item IDs
 *      - Notion: UUID v4 format
 *      - Airtable: starts with "app" prefix
 *   3. Fall back to default platform
 *   4. Throw NotFoundError if no backend registered for resolved platform
 */

import type {
  SpreadsheetBackend,
  SpreadsheetPlatform,
  ReadRangeParams,
  ReadRangeResult,
  WriteRangeParams,
  WriteRangeResult,
  AppendParams,
  AppendResult,
  ClearRangeParams,
  ClearRangeResult,
  BatchReadParams,
  BatchReadResult,
  BatchWriteParams,
  BatchWriteResult,
  BatchClearParams,
  BatchClearResult,
  GetDocumentParams,
  CreateDocumentParams,
  SpreadsheetMetadata,
  SheetMetadata,
  AddSheetParams,
  DeleteSheetParams,
  CopySheetParams,
  CopySheetResult,
  BatchMutationRequest,
  BatchMutationResult,
  CopyDocumentParams,
  FileMetadata,
  ListFilesParams,
  ListFilesResult,
  ListRevisionsParams,
  ListRevisionsResult,
  RevisionMetadata,
} from '@serval/core';

import { ServiceError, NotFoundError } from '../core/errors.js';
import { logger } from '../utils/logger.js';

// ============================================================
// Types
// ============================================================

/**
 * Configuration for BackendRouter
 */
export interface BackendRouterConfig {
  /** Default platform when no routing hint is available */
  defaultPlatform: SpreadsheetPlatform;
  /** Registered backends by platform */
  backends: Map<SpreadsheetPlatform, SpreadsheetBackend>;
  /** Optional: custom routing function for document IDs */
  routeDocument?: (documentId: string) => SpreadsheetPlatform;
}

/**
 * Extended params with optional platform hint
 */
interface RoutableParams {
  documentId: string;
  _platformHint?: SpreadsheetPlatform;
}

// ============================================================
// Backend Router
// ============================================================

export class BackendRouter implements SpreadsheetBackend {
  readonly platform: SpreadsheetPlatform;
  private backends: Map<SpreadsheetPlatform, SpreadsheetBackend>;
  private defaultPlatform: SpreadsheetPlatform;
  private customRouteDocument?: (documentId: string) => SpreadsheetPlatform;

  constructor(config: BackendRouterConfig) {
    this.backends = config.backends;
    this.defaultPlatform = config.defaultPlatform;
    this.customRouteDocument = config.routeDocument;
    this.platform = config.defaultPlatform;

    if (this.backends.size === 0) {
      throw new ServiceError(
        'BackendRouter: No backends registered',
        'INTERNAL_ERROR',
        'BackendRouter',
        false,
        { backends: 0 }
      );
    }

    logger.info('BackendRouter initialized', {
      defaultPlatform: this.defaultPlatform,
      backends: Array.from(this.backends.keys()),
    });
  }

  // ─── Backend Management ────────────────────────────────────

  /**
   * Register a new backend at runtime
   */
  registerBackend(platform: SpreadsheetPlatform, backend: SpreadsheetBackend): void {
    this.backends.set(platform, backend);
    logger.info('Backend registered', { platform });
  }

  /**
   * Remove a backend
   */
  unregisterBackend(platform: SpreadsheetPlatform): void {
    this.backends.delete(platform);
    logger.info('Backend unregistered', { platform });
  }

  /**
   * Get the backend for a specific platform
   */
  getBackend(platform: SpreadsheetPlatform): SpreadsheetBackend | undefined {
    return this.backends.get(platform);
  }

  /**
   * List all registered platforms
   */
  get registeredPlatforms(): SpreadsheetPlatform[] {
    return Array.from(this.backends.keys());
  }

  // ─── Routing Logic ────────────────────────────────────────

  /**
   * Resolve which platform a document ID belongs to
   *
   * Strategy:
   * 1. If customRouteDocument provided, use it
   * 2. Analyze document ID pattern
   * 3. Fall back to defaultPlatform
   */
  private resolveBackendForDocId(documentId: string): SpreadsheetBackend {
    let platform = this.defaultPlatform;

    // 1. Custom routing function (highest priority)
    if (this.customRouteDocument) {
      platform = this.customRouteDocument(documentId);
    } else {
      // 2. Pattern-based detection
      platform = this.detectPlatformByDocId(documentId);
    }

    // 3. Get backend for resolved platform
    const backend = this.backends.get(platform);
    if (!backend) {
      throw new NotFoundError('backend', platform, {
        registeredPlatforms: this.registeredPlatforms,
      });
    }

    return backend;
  }

  /**
   * Detect platform from document ID pattern
   *
   * Pattern matching:
   * - Google: 44-char alphanumeric (typical Google Sheets doc ID)
   * - Excel: Contains "/" (OneDrive/SharePoint path) or looks like GUID
   * - Notion: UUID v4 format (8-4-4-4-12 hex)
   * - Airtable: Starts with "app"
   */
  private detectPlatformByDocId(documentId: string): SpreadsheetPlatform {
    // Airtable: starts with "app" + alphanumeric
    if (/^app[a-zA-Z0-9]{14}$/.test(documentId)) {
      return 'airtable';
    }

    // Notion: UUID v4 format (8-4-4-4-12)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(documentId)) {
      return 'notion';
    }

    // Excel/OneDrive: Contains "/" (path) or GUID pattern
    if (
      documentId.includes('/') ||
      /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(documentId)
    ) {
      return 'excel-online';
    }

    // Google: 44-char alphanumeric string
    if (/^[a-zA-Z0-9_-]{44}$/.test(documentId)) {
      return 'google-sheets';
    }

    // Default fallback
    return this.defaultPlatform;
  }

  /**
   * Resolve backend for params with optional platform hint
   */
  private resolveBackend(params: RoutableParams): SpreadsheetBackend {
    // Explicit platform hint (highest priority)
    if (params._platformHint) {
      const backend = this.backends.get(params._platformHint);
      if (!backend) {
        throw new NotFoundError('backend', params._platformHint, {
          registeredPlatforms: this.registeredPlatforms,
        });
      }
      return backend;
    }

    // Auto-detect from document ID
    return this.resolveBackendForDocId(params.documentId);
  }

  // ─── SpreadsheetBackend Implementation ──────────────────────

  // ─── Lifecycle ─────────────────────────────────────────────

  async initialize(): Promise<void> {
    logger.debug('BackendRouter.initialize: initializing all backends');
    const errors: Array<{ platform: SpreadsheetPlatform; error: Error }> = [];

    for (const [platform, backend] of this.backends) {
      try {
        await backend.initialize();
        logger.debug('Backend initialized', { platform });
      } catch (error) {
        errors.push({ platform, error: error instanceof Error ? error : new Error(String(error)) });
      }
    }

    if (errors.length > 0) {
      throw new ServiceError(
        `BackendRouter: ${errors.length} backend(s) failed to initialize`,
        'INTERNAL_ERROR',
        'BackendRouter',
        false,
        { failures: errors.map((e) => ({ platform: e.platform, message: e.error.message })) }
      );
    }

    logger.info('BackendRouter: all backends initialized');
  }

  async dispose(): Promise<void> {
    logger.debug('BackendRouter.dispose: disposing all backends');
    const errors: Array<{ platform: SpreadsheetPlatform; error: Error }> = [];

    for (const [platform, backend] of this.backends) {
      try {
        await backend.dispose();
        logger.debug('Backend disposed', { platform });
      } catch (error) {
        errors.push({ platform, error: error instanceof Error ? error : new Error(String(error)) });
      }
    }

    if (errors.length > 0) {
      logger.warn('BackendRouter: some backends failed to dispose', {
        failures: errors.map((e) => ({ platform: e.platform, message: e.error.message })),
      });
    }

    logger.info('BackendRouter: all backends disposed');
  }

  // ─── Value Operations ──────────────────────────────────────

  async readRange(params: ReadRangeParams): Promise<ReadRangeResult> {
    const backend = this.resolveBackend(params as RoutableParams);
    return backend.readRange(params);
  }

  async writeRange(params: WriteRangeParams): Promise<WriteRangeResult> {
    const backend = this.resolveBackend(params as RoutableParams);
    return backend.writeRange(params);
  }

  async appendRows(params: AppendParams): Promise<AppendResult> {
    const backend = this.resolveBackend(params as RoutableParams);
    return backend.appendRows(params);
  }

  async clearRange(params: ClearRangeParams): Promise<ClearRangeResult> {
    const backend = this.resolveBackend(params as RoutableParams);
    return backend.clearRange(params);
  }

  async batchRead(params: BatchReadParams): Promise<BatchReadResult> {
    const backend = this.resolveBackend(params as RoutableParams);
    return backend.batchRead(params);
  }

  async batchWrite(params: BatchWriteParams): Promise<BatchWriteResult> {
    const backend = this.resolveBackend(params as RoutableParams);
    return backend.batchWrite(params);
  }

  async batchClear(params: BatchClearParams): Promise<BatchClearResult> {
    const backend = this.resolveBackend(params as RoutableParams);
    return backend.batchClear(params);
  }

  // ─── Document Operations ───────────────────────────────────

  async getDocument(params: GetDocumentParams): Promise<SpreadsheetMetadata> {
    const backend = this.resolveBackend(params as RoutableParams);
    return backend.getDocument(params);
  }

  async createDocument(params: CreateDocumentParams): Promise<SpreadsheetMetadata> {
    const backend = this.backends.get(this.defaultPlatform);
    if (!backend) {
      throw new NotFoundError('backend', this.defaultPlatform);
    }
    return backend.createDocument(params);
  }

  async addSheet(params: AddSheetParams): Promise<SheetMetadata> {
    const backend = this.resolveBackend(params as RoutableParams);
    return backend.addSheet(params);
  }

  async deleteSheet(params: DeleteSheetParams): Promise<void> {
    const backend = this.resolveBackend(params as RoutableParams);
    return backend.deleteSheet(params);
  }

  async copySheet(params: CopySheetParams): Promise<CopySheetResult> {
    const backend = this.resolveBackend(params as RoutableParams);
    return backend.copySheet(params);
  }

  async executeBatchMutations(
    documentId: string,
    request: BatchMutationRequest
  ): Promise<BatchMutationResult> {
    const backend = this.resolveBackend({ documentId, _platformHint: undefined } as RoutableParams);
    return backend.executeBatchMutations(documentId, request);
  }

  // ─── File Operations ───────────────────────────────────────

  async copyDocument(params: CopyDocumentParams): Promise<FileMetadata> {
    const backend = this.resolveBackend(params as RoutableParams);
    return backend.copyDocument(params);
  }

  async getFileMetadata(documentId: string): Promise<FileMetadata> {
    const backend = this.resolveBackend({ documentId, _platformHint: undefined } as RoutableParams);
    return backend.getFileMetadata(documentId);
  }

  async listFiles(params: ListFilesParams): Promise<ListFilesResult> {
    const backend = this.backends.get(this.defaultPlatform);
    if (!backend) {
      throw new NotFoundError('backend', this.defaultPlatform);
    }
    return backend.listFiles(params);
  }

  async listRevisions(params: ListRevisionsParams): Promise<ListRevisionsResult> {
    const backend = this.resolveBackend(params as RoutableParams);
    return backend.listRevisions(params);
  }

  async getRevision(documentId: string, revisionId: string): Promise<RevisionMetadata> {
    const backend = this.resolveBackend({ documentId, _platformHint: undefined } as RoutableParams);
    return backend.getRevision(documentId, revisionId);
  }

  // ─── Native Escape Hatch ───────────────────────────────────

  native<T>(): T {
    const backend = this.backends.get(this.defaultPlatform);
    if (!backend) {
      throw new NotFoundError('backend', this.defaultPlatform);
    }
    return backend.native<T>();
  }
}

// ============================================================
// Factory
// ============================================================

/**
 * Create a BackendRouter with auto-discovered backends from environment
 *
 * Available platforms:
 * - google-sheets: Always available (GoogleApiClient)
 * - excel-online: When MICROSOFT_CLIENT_ID is set
 * - notion: When NOTION_API_KEY is set (future)
 * - airtable: When AIRTABLE_API_KEY is set (future)
 *
 * @param config Optional overrides for default platform, custom routing, etc.
 * @returns Initialized BackendRouter
 */
export async function createBackendRouter(
  config?: Partial<BackendRouterConfig>
): Promise<BackendRouter> {
  const backends = new Map<SpreadsheetPlatform, SpreadsheetBackend>();

  // Google Sheets: always available
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { GoogleSheetsBackend }: any = await import('./google-sheets-backend.js');
    const googleApiModule = (await import('../services/google-api.js')) as Record<string, unknown>;
    const googleApiClient = googleApiModule['googleApiClient'] as unknown;

    if (googleApiClient) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const googleBackend = new GoogleSheetsBackend(googleApiClient as any);
      backends.set('google-sheets', googleBackend);
      logger.debug('Google Sheets backend auto-discovered');
    }
  } catch (error) {
    logger.warn('Google Sheets backend unavailable', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Excel Online: optional, when MICROSOFT_CLIENT_ID is set
  if (
    process.env['MICROSOFT_CLIENT_ID'] &&
    process.env['ENABLE_EXPERIMENTAL_BACKENDS'] === 'true'
  ) {
    try {
      void (await import('./excel-online-backend.js'));
      // In production, would create real GraphClient from MSAL
      // For now, skip if no client available
      logger.debug('Excel Online backend: environment flag set (scaffold not instantiated)');
    } catch (error) {
      logger.warn('Excel Online backend unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Notion: future implementation
  // Airtable: future implementation

  const defaultPlatform = config?.defaultPlatform ?? 'google-sheets';

  const router = new BackendRouter({
    defaultPlatform,
    backends,
    routeDocument: config?.routeDocument,
  });

  await router.initialize();
  return router;
}
