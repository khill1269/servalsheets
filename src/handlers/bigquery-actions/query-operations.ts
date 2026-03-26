/**
 * BigQuery query and refresh actions:
 * - query: Execute BigQuery SQL query (direct or Connected Sheets)
 * - preview: Preview query results
 * - refresh: Refresh a Connected Sheets data source
 * - cancel_refresh: Cancel an in-progress data source refresh
 */

import type { BigQueryHandlerAccess } from './internal.js';
import type {
  BigQueryResponse,
  BigQueryQueryInput,
  BigQueryPreviewInput,
  BigQueryRefreshInput,
  BigQueryCancelRefreshInput,
} from '../../schemas/index.js';
import { validateBigQuerySql } from './helpers.js';
import { logger } from '../../utils/logger.js';

export async function handleQuery(
  ha: BigQueryHandlerAccess,
  req: BigQueryQueryInput
): Promise<BigQueryResponse> {
  // Validate query to prevent destructive SQL operations
  validateBigQuerySql(req.query);

  // Path 1: Direct BigQuery execution when client is available and no dataSourceId
  if (ha.bigqueryApi && !req.dataSourceId) {
    const bigquery = ha.bigqueryApi;

    try {
      // dryRun: validate query and return cost estimate without executing
      if (req.dryRun) {
        const dryRunResponse = await ha.withBigQueryCircuitBreaker(() =>
          bigquery.jobs.query({
            projectId: req.projectId,
            requestBody: {
              query: req.query,
              useLegacySql: false,
              dryRun: true,
              location: req.location,
            },
          })
        );
        const estimatedBytes = parseInt(dryRunResponse.data.totalBytesProcessed ?? '0', 10);
        return ha.success('query', {
          dryRun: true,
          estimatedBytes,
          estimatedGB: (estimatedBytes / (1024 * 1024 * 1024)).toFixed(4),
        });
      }

      // Map schema parameters to BigQuery API format
      const queryParameters = req.parameters?.map((param) => ({
        name: param.name,
        parameterType: param.parameterType,
        parameterValue: {
          value: String(param.parameterValue.value),
        },
      }));

      const result = await ha.executeQueryWithJobPolling(bigquery, {
        projectId: req.projectId,
        query: req.query,
        maxResults: req.maxResults ?? 10000,
        timeoutMs: req.timeoutMs,
        maximumBytesBilled: req.maximumBytesBilled,
        useQueryCache: req.useQueryCache ?? true,
        location: req.location,
        parameterMode: queryParameters?.length ? 'NAMED' : undefined,
        queryParameters,
      });

      return ha.success('query', {
        rowCount: result.rows.length,
        columns: result.columns,
        rows: result.rows as (string | number | boolean | null)[][],
        bytesProcessed: result.bytesProcessed,
        cacheHit: result.cacheHit,
        jobId: result.jobId,
      });
    } catch (err) {
      logger.error('Failed to execute BigQuery query', { err, req });
      return ha.mapBigQueryError(err);
    }
  }

  // Path 2: Connected Sheets data source (persistent, auto-refreshes in Sheets)
  try {
    // Update existing data source query
    if (req.dataSourceId) {
      await ha.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: req.spreadsheetId ?? '',
        requestBody: {
          requests: [
            {
              updateDataSource: {
                dataSource: {
                  dataSourceId: req.dataSourceId,
                  spec: {
                    bigQuery: {
                      projectId: req.projectId,
                      querySpec: {
                        rawQuery: req.query,
                      },
                    },
                  },
                },
                fields: 'spec.bigQuery.querySpec',
              },
            },
          ],
        },
      });

      return ha.success('query', {
        connection: {
          dataSourceId: req.dataSourceId,
          spec: {
            projectId: req.projectId,
            query: req.query,
          },
        },
      });
    }

    // Create new Connected Sheets data source
    const response = await ha.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId ?? '',
      requestBody: {
        requests: [
          {
            addDataSource: {
              dataSource: {
                spec: {
                  bigQuery: {
                    projectId: req.projectId,
                    querySpec: {
                      rawQuery: req.query,
                    },
                  },
                },
              },
            },
          },
        ],
      },
    });

    const addedDataSource = response.data?.replies?.[0]?.addDataSource?.dataSource;

    return ha.success('query', {
      connection: {
        dataSourceId: addedDataSource?.dataSourceId ?? '',
        spec: {
          projectId: req.projectId,
          query: req.query,
        },
        sheetId: addedDataSource?.sheetId ?? undefined,
      },
      sheetId: addedDataSource?.sheetId ?? undefined,
    });
  } catch (err) {
    logger.error('Failed to execute BigQuery query via Connected Sheets', { err, req });
    throw err;
  }
}

export async function handlePreview(
  ha: BigQueryHandlerAccess,
  req: BigQueryPreviewInput
): Promise<BigQueryResponse> {
  // Validate query to prevent destructive SQL operations
  validateBigQuerySql(req.query);

  const bigquery = ha.requireBigQuery();

  try {
    // Opt-in cost estimation: run dry run first when estimateCost is true
    if (req.estimateCost && !req.dryRun) {
      const dryRunResponse = await ha.withBigQueryCircuitBreaker(() =>
        bigquery.jobs.query({
          projectId: req.projectId,
          requestBody: {
            query: req.query,
            useLegacySql: false,
            dryRun: true,
          },
        })
      );
      const estimatedBytes = parseInt(dryRunResponse.data.totalBytesProcessed ?? '0', 10);
      const estimatedGB = estimatedBytes / (1024 * 1024 * 1024);

      // Warn if query will scan more than 1GB
      if (estimatedGB > 1) {
        logger.warn('BigQuery preview will scan large dataset', {
          estimatedBytes,
          estimatedGB: estimatedGB.toFixed(2),
          query: req.query.substring(0, 100),
        });
      }
    }

    // Inject LIMIT if not present to prevent unbounded preview queries
    const maxRows = req.maxRows ?? 10;
    const strippedForLimitCheck = req.query
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/--[^\n]*/g, '');
    const previewQuery = /\bLIMIT\s+\d+/i.test(strippedForLimitCheck)
      ? req.query
      : `${req.query.replace(/;?\s*$/, '')} LIMIT ${maxRows}`;

    // Re-validate the assembled query (LIMIT injection could expose DML in edge cases)
    validateBigQuerySql(previewQuery);

    // Use async job pattern for reliable execution
    const result = await ha.executeQueryWithJobPolling(bigquery, {
      projectId: req.projectId,
      query: previewQuery,
      maxResults: maxRows,
      timeoutMs: req.timeoutMs,
      dryRun: req.dryRun ?? false,
      useQueryCache: req.useQueryCache ?? true,
      location: req.location,
    });

    return ha.success('preview', {
      rowCount: result.rows.length,
      columns: result.columns,
      rows: result.rows as (string | number | boolean | null)[][],
      bytesProcessed: result.bytesProcessed,
      cacheHit: result.cacheHit,
      jobId: result.jobId,
    });
  } catch (err) {
    logger.error('Failed to preview BigQuery query', { err, req });
    return ha.mapBigQueryError(err);
  }
}

export async function handleRefresh(
  ha: BigQueryHandlerAccess,
  req: BigQueryRefreshInput
): Promise<BigQueryResponse> {
  try {
    await ha.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId,
      requestBody: {
        requests: [
          {
            refreshDataSource: {
              dataSourceId: req.dataSourceId,
              force: req.force ?? false,
            },
          },
        ],
      },
    });

    logger.info('Refreshed BigQuery data source', {
      spreadsheetId: req.spreadsheetId,
      dataSourceId: req.dataSourceId,
    });

    return ha.success('refresh', {
      connection: {
        dataSourceId: req.dataSourceId,
        spec: { projectId: '' }, // Minimal spec, details can be fetched via get_connection
        lastRefreshed: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('Failed to refresh BigQuery data source', { err, req });
    throw err;
  }
}

export async function handleCancelRefresh(
  ha: BigQueryHandlerAccess,
  req: BigQueryCancelRefreshInput
): Promise<BigQueryResponse> {
  try {
    await ha.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId,
      requestBody: {
        requests: [
          {
            cancelDataSourceRefresh: {
              dataSourceId: req.dataSourceId,
            },
          },
        ],
      },
    });

    logger.info('Cancelled data source refresh', {
      spreadsheetId: req.spreadsheetId,
      dataSourceId: req.dataSourceId,
    });

    return ha.success('cancel_refresh', {
      cancelled: true,
      connection: {
        dataSourceId: req.dataSourceId,
      },
    });
  } catch (err) {
    logger.error('Failed to cancel data source refresh', { err, req });
    throw err;
  }
}
