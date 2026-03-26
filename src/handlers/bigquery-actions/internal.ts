/**
 * BigQueryHandlerAccess — interface used by all bigquery-actions submodule functions.
 *
 * Submodule standalone functions receive a `BigQueryHandlerAccess` object instead of `this`,
 * which exposes the protected BaseHandler capabilities through public `_delegate` wrappers
 * defined on SheetsBigQueryHandler.
 */

import type { sheets_v4 } from 'googleapis';
import type { bigquery_v2 } from 'googleapis';
import type { HandlerContext } from '../base.js';
import type { BigQueryResponse, MutationSummary } from '../../schemas/index.js';
import type { ErrorDetail } from '../../schemas/shared.js';

export type BigQueryHandlerAccess = {
  success: (
    action: string,
    data: Record<string, unknown>,
    mutation?: MutationSummary
  ) => BigQueryResponse;
  error: (e: ErrorDetail) => BigQueryResponse;
  sendProgress: (current: number, total: number, message?: string) => void;
  context: HandlerContext;
  sheetsApi: sheets_v4.Sheets;
  bigqueryApi: bigquery_v2.Bigquery | null;
  requireBigQuery: () => bigquery_v2.Bigquery;
  withBigQueryCircuitBreaker: <T>(operation: () => Promise<T>) => Promise<T>;
  executeQueryWithJobPolling: (
    bigquery: bigquery_v2.Bigquery,
    params: QueryJobParams
  ) => Promise<QueryJobResult>;
  mapBigQueryError: (err: unknown) => BigQueryResponse;
  getFreshAccessToken: () => Promise<string | null>;
};

export type QueryJobParams = {
  projectId: string;
  query: string;
  maxResults?: number;
  useLegacySql?: boolean;
  timeoutMs?: number;
  maximumBytesBilled?: string;
  dryRun?: boolean;
  useQueryCache?: boolean;
  location?: string;
  parameterMode?: string;
  queryParameters?: bigquery_v2.Schema$QueryParameter[];
};

export type QueryJobResult = {
  rows: unknown[][];
  columns: string[];
  totalRows: number;
  bytesProcessed: number;
  jobId?: string;
  cacheHit?: boolean;
};
