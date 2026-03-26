/**
 * ServalSheets - BigQuery Handler
 *
 * Handles sheets_bigquery tool (17 actions):
 * - connect: Create BigQuery Connected Sheets data source
 * - connect_looker: Create Looker Connected Sheets data source
 * - disconnect: Remove BigQuery/Looker connection
 * - list_connections: List all data source connections
 * - get_connection: Get connection details
 * - cancel_refresh: Cancel an in-progress data source refresh
 * - query: Execute BigQuery SQL query
 * - preview: Preview query results
 * - refresh: Refresh data source
 * - list_datasets: List BigQuery datasets
 * - list_tables: List tables in dataset
 * - get_table_schema: Get table schema
 * - export_to_bigquery: Export sheet data to BigQuery
 * - import_from_bigquery: Import BigQuery results to sheet
 * - create_scheduled_query: Create a scheduled query
 * - list_scheduled_queries: List scheduled queries
 * - delete_scheduled_query: Delete a scheduled query
 *
 * APIs Used:
 * - Google Sheets API (DataSource for Connected Sheets - BigQuery and Looker)
 * - Google BigQuery API (jobs.query, datasets, tables)
 *
 * MCP Protocol: 2025-11-25
 *
 * Action implementations decomposed into bigquery-actions/ submodules.
 */

import { ErrorCodes } from './error-codes.js';
import type { sheets_v4 } from 'googleapis';
import type { bigquery_v2 } from 'googleapis';
import { BaseHandler, type HandlerContext, unwrapRequest } from './base.js';
import type { Intent } from '../core/intent.js';
import { CircuitBreaker } from '../utils/circuit-breaker.js';
import { getCircuitBreakerConfig, getEnv } from '../config/env.js';
import { circuitBreakerRegistry } from '../services/circuit-breaker-registry.js';
import { ServiceError } from '../core/errors.js';
import type {
  SheetsBigQueryInput,
  SheetsBigQueryOutput,
  BigQueryResponse,
  BigQueryRequest,
  BigQueryConnectInput,
  BigQueryConnectLookerInput,
  BigQueryDisconnectInput,
  BigQueryListConnectionsInput,
  BigQueryGetConnectionInput,
  BigQueryCancelRefreshInput,
  BigQueryQueryInput,
  BigQueryPreviewInput,
  BigQueryRefreshInput,
  BigQueryListDatasetsInput,
  BigQueryListTablesInput,
  BigQueryGetTableSchemaInput,
  BigQueryExportInput,
  BigQueryImportInput,
  MutationSummary,
} from '../schemas/index.js';
import { logger } from '../utils/logger.js';
import type {
  BigQueryHandlerAccess,
  QueryJobParams,
  QueryJobResult,
} from './bigquery-actions/internal.js';

// Submodule imports
import {
  handleConnect,
  handleConnectLooker,
  handleDisconnect,
  handleListConnections,
  handleGetConnection,
} from './bigquery-actions/connection-management.js';
import {
  handleQuery,
  handlePreview,
  handleRefresh,
  handleCancelRefresh,
} from './bigquery-actions/query-operations.js';
import {
  handleListDatasets,
  handleListTables,
  handleGetTableSchema,
} from './bigquery-actions/utils.js';
import {
  handleExportToBigQuery,
  handleImportFromBigQuery,
} from './bigquery-actions/data-transfer.js';
import {
  handleCreateScheduledQuery,
  handleListScheduledQueries,
  handleDeleteScheduledQuery,
} from './bigquery-actions/scheduled-queries.js';

/** Maximum BigQuery result rows (ISSUE-188: configurable via env var) */
const MAX_BIGQUERY_RESULT_ROWS = getEnv().MAX_BIGQUERY_RESULT_ROWS;

export class SheetsBigQueryHandler extends BaseHandler<SheetsBigQueryInput, SheetsBigQueryOutput> {
  private sheetsApi: sheets_v4.Sheets;
  private bigqueryApi: bigquery_v2.Bigquery | null;
  private circuitBreaker: CircuitBreaker;

  constructor(
    context: HandlerContext,
    sheetsApi: sheets_v4.Sheets,
    bigqueryApi?: bigquery_v2.Bigquery
  ) {
    super('sheets_bigquery', context);
    this.sheetsApi = sheetsApi;
    this.bigqueryApi = bigqueryApi ?? null;

    // Initialize circuit breaker for BigQuery API
    const circuitConfig = getCircuitBreakerConfig();
    this.circuitBreaker = new CircuitBreaker({
      ...circuitConfig,
      name: 'bigquery-api',
    });

    // Register fallback strategy for circuit breaker
    this.circuitBreaker.registerFallback({
      name: 'bigquery-unavailable-fallback',
      priority: 1,
      shouldUse: () => true,
      execute: async () => {
        throw new ServiceError(
          'BigQuery API temporarily unavailable due to repeated failures. Try again in 30 seconds.',
          'UNAVAILABLE',
          'bigquery-api',
          true,
          { circuitBreaker: 'bigquery-api', retryAfterSeconds: 30 }
        );
      },
    });

    // Register with global registry
    circuitBreakerRegistry.register(
      'bigquery-api',
      this.circuitBreaker,
      'BigQuery API circuit breaker'
    );
  }

  async handle(input: SheetsBigQueryInput): Promise<SheetsBigQueryOutput> {
    // 1. Unwrap request from wrapper
    const rawReq = unwrapRequest<SheetsBigQueryInput['request']>(input);

    // 2. Require auth
    this.requireAuth();

    // 3. Track spreadsheet ID if applicable
    const spreadsheetId = 'spreadsheetId' in rawReq ? rawReq.spreadsheetId : undefined;
    this.trackSpreadsheetId(spreadsheetId);

    try {
      // 4. Build handler access object for submodule delegation
      const ha = this.buildHandlerAccess();

      // 5. Dispatch to action handler
      const req = rawReq as BigQueryRequest;
      this.checkOperationScopes(`${this.toolName}.${req.action}`);
      let response: BigQueryResponse;

      switch (req.action) {
        case 'connect':
          response = await handleConnect(ha, req as BigQueryConnectInput);
          break;
        case 'connect_looker':
          response = await handleConnectLooker(ha, req as BigQueryConnectLookerInput);
          break;
        case 'disconnect':
          response = await handleDisconnect(ha, req as BigQueryDisconnectInput);
          break;
        case 'list_connections':
          response = await handleListConnections(ha, req as BigQueryListConnectionsInput);
          break;
        case 'get_connection':
          response = await handleGetConnection(ha, req as BigQueryGetConnectionInput);
          break;
        case 'cancel_refresh':
          response = await handleCancelRefresh(ha, req as BigQueryCancelRefreshInput);
          break;
        case 'query':
          response = await handleQuery(ha, req as BigQueryQueryInput);
          break;
        case 'preview':
          response = await handlePreview(ha, req as BigQueryPreviewInput);
          break;
        case 'refresh':
          response = await handleRefresh(ha, req as BigQueryRefreshInput);
          break;
        case 'list_datasets':
          response = await handleListDatasets(ha, req as BigQueryListDatasetsInput);
          break;
        case 'list_tables':
          response = await handleListTables(ha, req as BigQueryListTablesInput);
          break;
        case 'get_table_schema':
          response = await handleGetTableSchema(ha, req as BigQueryGetTableSchemaInput);
          break;
        case 'export_to_bigquery':
          response = await handleExportToBigQuery(ha, req as BigQueryExportInput);
          break;
        case 'import_from_bigquery':
          response = await handleImportFromBigQuery(ha, req as BigQueryImportInput);
          break;
        case 'create_scheduled_query':
          response = await handleCreateScheduledQuery(ha, req);
          break;
        case 'list_scheduled_queries':
          response = await handleListScheduledQueries(ha, req);
          break;
        case 'delete_scheduled_query':
          response = await handleDeleteScheduledQuery(ha, req);
          break;
        default: {
          const _exhaustiveCheck: never = req;
          response = this.error({
            code: ErrorCodes.INVALID_PARAMS,
            message: `Unknown action: ${(_exhaustiveCheck as { action: string }).action}`,
            retryable: false,
            suggestedFix: "Check parameter format - ranges use A1 notation like 'Sheet1!A1:D10'",
          });
        }
      }

      // 6. Track context after successful operation
      if (response.success && spreadsheetId) {
        this.trackContextFromRequest({ spreadsheetId });
      }

      // 7. Return wrapped response
      return { response };
    } catch (err) {
      return { response: this.mapError(err) };
    }
  }

  // Required by BaseHandler
  protected createIntents(_input: SheetsBigQueryInput): Intent[] {
    return []; // BigQuery doesn't use batch compiler
  }

  /**
   * Build the handler access object that submodule functions use instead of `this`.
   */
  private buildHandlerAccess(): BigQueryHandlerAccess {
    return {
      success: (action: string, data: Record<string, unknown>, mutation?: MutationSummary) =>
        this.success(action, data, mutation),
      error: (e) => this.error(e),
      sendProgress: (current: number, total: number, message?: string) =>
        this.sendProgress(current, total, message),
      context: this.context,
      sheetsApi: this.sheetsApi,
      bigqueryApi: this.bigqueryApi,
      requireBigQuery: () => this._requireBigQuery(),
      withBigQueryCircuitBreaker: <T>(op: () => Promise<T>) => this._withBigQueryCircuitBreaker(op),
      executeQueryWithJobPolling: (bq, params) => this._executeQueryWithJobPolling(bq, params),
      mapBigQueryError: (err) => this._mapBigQueryError(err),
      getFreshAccessToken: () => this._getFreshAccessToken(),
    };
  }

  /**
   * Ensure BigQuery API is available
   */
  private _requireBigQuery(): bigquery_v2.Bigquery {
    if (!this.bigqueryApi) {
      throw this.error({
        code: ErrorCodes.CONFIG_ERROR,
        message:
          'BigQuery API is not configured. Enable BigQuery API in your GCP project and ensure proper OAuth scopes.',
        retryable: false,
      });
    }
    return this.bigqueryApi;
  }

  /**
   * Wrap BigQuery API operations with circuit breaker protection (P2-4)
   */
  private async _withBigQueryCircuitBreaker<T>(operation: () => Promise<T>): Promise<T> {
    return await this.circuitBreaker.execute(operation);
  }

  /**
   * Execute a BigQuery query using the async job pattern with polling.
   * Falls back to synchronous jobs.query for short queries.
   */
  private async _executeQueryWithJobPolling(
    bigquery: bigquery_v2.Bigquery,
    params: QueryJobParams
  ): Promise<QueryJobResult> {
    // Step 1: Try synchronous query first (fast path for small queries)
    const syncResponse = await this._withBigQueryCircuitBreaker(() =>
      bigquery.jobs.query({
        projectId: params.projectId,
        requestBody: {
          query: params.query,
          maxResults: params.maxResults ?? 10000,
          useLegacySql: params.useLegacySql ?? false,
          timeoutMs: params.timeoutMs ?? 10000,
          maximumBytesBilled: params.maximumBytesBilled,
          dryRun: params.dryRun ?? false,
          useQueryCache: params.useQueryCache ?? true,
          location: params.location,
          parameterMode: params.parameterMode,
          queryParameters: params.queryParameters,
        },
      })
    );

    const jobId = syncResponse.data.jobReference?.jobId;
    const jobComplete = syncResponse.data.jobComplete ?? false;

    // If job completed synchronously, return results directly
    if (jobComplete) {
      const syncErrors = syncResponse.data.errors;
      if (syncErrors && syncErrors.length > 0) {
        throw new ServiceError(
          `BigQuery query failed: ${syncErrors[0]?.message ?? 'Unknown error'}`,
          'INTERNAL_ERROR',
          'bigquery'
        );
      }

      const schema = syncResponse.data.schema?.fields ?? [];
      const columns = schema.map((f) => f.name ?? '');
      let allRows = syncResponse.data.rows?.map((row) => row.f?.map((cell) => cell.v) ?? []) ?? [];

      // Handle pagination for large result sets
      let pageToken: string | undefined = syncResponse.data.pageToken ?? undefined;
      while (pageToken && jobId) {
        const currentToken = pageToken;
        const pageResponse = await this._withBigQueryCircuitBreaker(() =>
          bigquery.jobs.getQueryResults({
            projectId: params.projectId,
            jobId,
            pageToken: currentToken,
            maxResults: params.maxResults ?? 10000,
            location: params.location,
          })
        );
        const pageRows =
          pageResponse.data.rows?.map((row) => row.f?.map((cell) => cell.v) ?? []) ?? [];
        allRows = allRows.concat(pageRows);
        pageToken = pageResponse.data.pageToken ?? undefined;

        if (allRows.length > MAX_BIGQUERY_RESULT_ROWS) {
          logger.warn('BigQuery result set truncated at 100K rows', { jobId });
          break;
        }
      }

      return {
        rows: allRows,
        columns,
        totalRows: allRows.length,
        bytesProcessed: parseInt(syncResponse.data.totalBytesProcessed ?? '0', 10),
        jobId: jobId ?? undefined,
        cacheHit: syncResponse.data.cacheHit ?? undefined,
      };
    }

    // Step 2: Job didn't complete synchronously - poll for completion
    if (!jobId) {
      throw new ServiceError(
        'BigQuery query did not return a job ID',
        'INTERNAL_ERROR',
        'bigquery'
      );
    }

    logger.info('BigQuery query running asynchronously, polling for completion', {
      jobId,
      projectId: params.projectId,
    });

    const deadlineMs = Date.now() + (params.timeoutMs ?? 600000);
    const INITIAL_POLL_MS = 1000;
    const MAX_POLL_MS = 10000;

    for (let attempt = 0; ; attempt++) {
      if (Date.now() > deadlineMs) {
        throw new ServiceError(
          `BigQuery query exceeded timeout of ${params.timeoutMs ?? 600000}ms. Job ID: ${jobId} - check BigQuery console for status.`,
          'DEADLINE_EXCEEDED',
          'bigquery'
        );
      }
      const delay = Math.min(INITIAL_POLL_MS * Math.pow(1.5, attempt), MAX_POLL_MS);
      await new Promise((resolve) => setTimeout(resolve, delay));

      const jobStatus = await this._withBigQueryCircuitBreaker(() =>
        bigquery.jobs.get({
          projectId: params.projectId,
          jobId,
          location: params.location,
        })
      );

      const state = jobStatus.data.status?.state;

      if (state === 'DONE') {
        const errors = jobStatus.data.status?.errors;
        if (errors && errors.length > 0) {
          throw new ServiceError(
            `BigQuery query failed: ${errors[0]?.message ?? 'Unknown error'}`,
            'INTERNAL_ERROR',
            'bigquery'
          );
        }

        const resultsResponse = await this._withBigQueryCircuitBreaker(() =>
          bigquery.jobs.getQueryResults({
            projectId: params.projectId,
            jobId,
            maxResults: params.maxResults ?? 10000,
            location: params.location,
          })
        );

        const schema = resultsResponse.data.schema?.fields ?? [];
        const columns = schema.map((f) => f.name ?? '');
        let allRows =
          resultsResponse.data.rows?.map((row) => row.f?.map((cell) => cell.v) ?? []) ?? [];

        let pageToken: string | undefined = resultsResponse.data.pageToken ?? undefined;
        while (pageToken) {
          const currentToken = pageToken;
          const pageResponse = await this._withBigQueryCircuitBreaker(() =>
            bigquery.jobs.getQueryResults({
              projectId: params.projectId,
              jobId,
              pageToken: currentToken,
              maxResults: params.maxResults ?? 10000,
              location: params.location,
            })
          );
          const pageRows =
            pageResponse.data.rows?.map((row) => row.f?.map((cell) => cell.v) ?? []) ?? [];
          allRows = allRows.concat(pageRows);
          pageToken = pageResponse.data.pageToken ?? undefined;

          if (allRows.length > MAX_BIGQUERY_RESULT_ROWS) {
            logger.warn('BigQuery result set truncated at 100K rows', { jobId });
            break;
          }
        }

        return {
          rows: allRows,
          columns,
          totalRows: allRows.length,
          bytesProcessed: parseInt(
            jobStatus.data.statistics?.query?.totalBytesProcessed ?? '0',
            10
          ),
          jobId,
          cacheHit: jobStatus.data.statistics?.query?.cacheHit ?? undefined,
        };
      }

      logger.debug('BigQuery job still running', { jobId, state, attempt });
    }
  }

  /**
   * Map BigQuery API errors to structured ServalSheets errors
   */
  private _mapBigQueryError(err: unknown): BigQueryResponse {
    const error = err as {
      response?: { data?: { error?: { code?: number; status?: string; message?: string } } };
      message?: string;
    };
    const apiError = error.response?.data?.error;

    if (apiError) {
      switch (apiError.status) {
        case 'PERMISSION_DENIED':
          return this.error({
            code: ErrorCodes.PERMISSION_DENIED,
            message: `BigQuery access denied: ${apiError.message ?? 'Check permissions'}`,
            retryable: false,
            suggestedFix:
              'Ensure OAuth scopes include bigquery and the user has access to the dataset.',
          });
        case 'NOT_FOUND':
          return this.error({
            code: ErrorCodes.NOT_FOUND,
            message: `BigQuery resource not found: ${apiError.message ?? 'Check project/dataset/table IDs'}`,
            retryable: false,
            suggestedFix: 'Verify projectId, datasetId, and tableId are correct.',
          });
        case 'INVALID_ARGUMENT':
          return this.error({
            code: ErrorCodes.INVALID_PARAMS,
            message: `Invalid BigQuery query: ${apiError.message ?? 'Check SQL syntax'}`,
            retryable: false,
            suggestedFix: 'Check SQL syntax. Use preview with dryRun:true to validate queries.',
          });
        default:
          break;
      }

      if (apiError.code === 429) {
        return this.error({
          code: ErrorCodes.QUOTA_EXCEEDED,
          message: 'BigQuery API rate limit exceeded. Try again later.',
          retryable: true,
          suggestedFix: 'Wait 60 seconds and retry, or reduce query frequency.',
        });
      }
    }

    return this.error({
      code: ErrorCodes.UNAVAILABLE,
      message: `BigQuery operation failed: ${error.message ?? 'Unknown error'}`,
      retryable: true,
      suggestedFix: 'Try again. If the issue persists, check the BigQuery console.',
    });
  }

  /**
   * Get a fresh OAuth access token, refreshing if it expires within 60 seconds.
   * Falls back to the cached token if refresh fails.
   */
  private async _getFreshAccessToken(): Promise<string | null> {
    const googleClient = this.context.googleClient;
    if (!googleClient) return null;

    const credentials = googleClient.oauth2.credentials;
    const expiryDate = credentials?.expiry_date as number | undefined;
    const isExpiringSoon = expiryDate !== undefined && expiryDate - Date.now() < 60_000;

    if (isExpiringSoon || !credentials?.access_token) {
      try {
        const result = await googleClient.oauth2.getAccessToken();
        return result?.token ?? credentials?.access_token ?? null;
      } catch {
        return credentials?.access_token ?? null;
      }
    }
    return credentials.access_token;
  }
}
