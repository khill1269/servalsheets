/**
 * BigQuery metadata discovery actions:
 * - list_datasets: List BigQuery datasets in a project
 * - list_tables: List tables in a BigQuery dataset
 * - get_table_schema: Get schema of a BigQuery table
 */

import type { BigQueryHandlerAccess } from './internal.js';
import type {
  BigQueryResponse,
  BigQueryListDatasetsInput,
  BigQueryListTablesInput,
  BigQueryGetTableSchemaInput,
} from '../../schemas/index.js';
import { logger } from '../../utils/logger.js';

export async function handleListDatasets(
  ha: BigQueryHandlerAccess,
  req: BigQueryListDatasetsInput
): Promise<BigQueryResponse> {
  const bigquery = ha.requireBigQuery();

  try {
    const maxResults = req.maxResults ?? 100;
    let allDatasets: { datasetId: string; location?: string; description?: string }[] = [];
    let pageToken: string | undefined;

    do {
      const response = await ha.withBigQueryCircuitBreaker(() =>
        bigquery.datasets.list({
          projectId: req.projectId,
          maxResults: Math.min(maxResults - allDatasets.length, 100),
          pageToken,
        })
      );

      const datasets =
        response.data.datasets?.map((ds) => ({
          datasetId: ds.datasetReference?.datasetId ?? '',
          location: ds.location ?? undefined,
          description: ds.friendlyName ?? undefined,
        })) ?? [];

      allDatasets.push(...datasets);
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken && allDatasets.length < maxResults);

    return ha.success('list_datasets', {
      datasets: allDatasets,
    });
  } catch (err) {
    logger.error('Failed to list BigQuery datasets', { err, req });
    throw err;
  }
}

export async function handleListTables(
  ha: BigQueryHandlerAccess,
  req: BigQueryListTablesInput
): Promise<BigQueryResponse> {
  const bigquery = ha.requireBigQuery();

  try {
    const maxResults = req.maxResults ?? 100;
    let allTables: { tableId: string; type?: string; description?: string }[] = [];
    let pageToken: string | undefined;

    do {
      const response = await ha.withBigQueryCircuitBreaker(() =>
        bigquery.tables.list({
          projectId: req.projectId,
          datasetId: req.datasetId,
          maxResults: Math.min(maxResults - allTables.length, 100),
          pageToken,
        })
      );

      const tables =
        response.data.tables?.map((t) => ({
          tableId: t.tableReference?.tableId ?? '',
          type: t.type ?? undefined,
          description: t.friendlyName ?? undefined,
        })) ?? [];

      allTables.push(...tables);
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken && allTables.length < maxResults);

    return ha.success('list_tables', {
      tables: allTables,
    });
  } catch (err) {
    logger.error('Failed to list BigQuery tables', { err, req });
    throw err;
  }
}

export async function handleGetTableSchema(
  ha: BigQueryHandlerAccess,
  req: BigQueryGetTableSchemaInput
): Promise<BigQueryResponse> {
  const bigquery = ha.requireBigQuery();

  try {
    const response = await ha.withBigQueryCircuitBreaker(() =>
      bigquery.tables.get({
        projectId: req.projectId,
        datasetId: req.datasetId,
        tableId: req.tableId,
      })
    );

    const schema =
      response.data.schema?.fields?.map((f) => ({
        name: f.name ?? '',
        type: f.type ?? 'STRING',
        mode: (f.mode as 'NULLABLE' | 'REQUIRED' | 'REPEATED') ?? undefined,
        description: f.description ?? undefined,
      })) ?? [];

    return ha.success('get_table_schema', {
      schema,
    });
  } catch (err) {
    logger.error('Failed to get BigQuery table schema', { err, req });
    throw err;
  }
}
