/**
 * BigQuery connection management actions:
 * - connect: Create BigQuery Connected Sheets data source
 * - connect_looker: Create Looker Connected Sheets data source
 * - disconnect: Remove BigQuery/Looker connection
 * - list_connections: List all data source connections
 * - get_connection: Get connection details
 */

import type { sheets_v4 } from 'googleapis';
import type { BigQueryHandlerAccess } from './internal.js';
import type {
  BigQueryResponse,
  BigQueryConnectInput,
  BigQueryConnectLookerInput,
  BigQueryDisconnectInput,
  BigQueryListConnectionsInput,
  BigQueryGetConnectionInput,
} from '../../schemas/index.js';
import { ErrorCodes } from '../error-codes.js';
import { validateBigQuerySql } from './helpers.js';
import { logger } from '../../utils/logger.js';

export async function handleConnect(
  ha: BigQueryHandlerAccess,
  req: BigQueryConnectInput
): Promise<BigQueryResponse> {
  try {
    // Build data source spec
    const dataSourceSpec: sheets_v4.Schema$DataSourceSpec = {
      bigQuery: {
        projectId: req.spec.projectId,
      },
    };

    // Add table or query reference
    if (req.spec.tableId && req.spec.datasetId) {
      dataSourceSpec.bigQuery!.tableSpec = {
        tableProjectId: req.spec.projectId,
        datasetId: req.spec.datasetId,
        tableId: req.spec.tableId,
      };
    } else if (req.spec.query) {
      validateBigQuerySql(req.spec.query);
      dataSourceSpec.bigQuery!.querySpec = {
        rawQuery: req.spec.query,
      };
    }

    const response = await ha.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId,
      requestBody: {
        requests: [
          {
            addDataSource: {
              dataSource: {
                spec: dataSourceSpec,
              },
            },
          },
        ],
      },
    });

    const addedDataSource = response.data?.replies?.[0]?.addDataSource?.dataSource;

    logger.info('Created BigQuery connection', {
      spreadsheetId: req.spreadsheetId,
      dataSourceId: addedDataSource?.dataSourceId,
    });

    return ha.success('connect', {
      connection: {
        dataSourceId: addedDataSource?.dataSourceId ?? '',
        type: 'bigquery' as const,
        spec: {
          projectId: req.spec.projectId,
          datasetId: req.spec.datasetId,
          tableId: req.spec.tableId,
          query: req.spec.query,
        },
        sheetId: addedDataSource?.sheetId ?? undefined,
      },
      message:
        'BigQuery data source created. Note: initial data load is asynchronous. ' +
        'Use bigquery refresh action to check status, or read the connected sheet after a few seconds.',
    });
  } catch (err) {
    logger.error('Failed to create BigQuery connection', { err, req });
    throw err;
  }
}

export async function handleConnectLooker(
  ha: BigQueryHandlerAccess,
  req: BigQueryConnectLookerInput
): Promise<BigQueryResponse> {
  try {
    // Build Looker data source spec
    // Looker uses the 'looker' field in DataSourceSpec (not in googleapis types yet)
    const dataSourceSpec = {
      looker: {
        instanceUri: req.spec.instanceUri,
        model: req.spec.model,
        explore: req.spec.explore,
      },
    } as sheets_v4.Schema$DataSourceSpec;

    const response = await ha.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId,
      requestBody: {
        requests: [
          {
            addDataSource: {
              dataSource: {
                spec: dataSourceSpec,
              },
            },
          },
        ],
      },
    });

    const addedDataSource = response.data?.replies?.[0]?.addDataSource?.dataSource;

    logger.info('Created Looker connection', {
      spreadsheetId: req.spreadsheetId,
      dataSourceId: addedDataSource?.dataSourceId,
      instanceUri: req.spec.instanceUri,
    });

    return ha.success('connect_looker', {
      connection: {
        dataSourceId: addedDataSource?.dataSourceId ?? '',
        type: 'looker' as const,
        lookerSpec: {
          instanceUri: req.spec.instanceUri,
          model: req.spec.model,
          explore: req.spec.explore,
        },
        sheetId: addedDataSource?.sheetId ?? undefined,
      },
    });
  } catch (err) {
    logger.error('Failed to create Looker connection', { err, req });
    throw err;
  }
}

export async function handleDisconnect(
  ha: BigQueryHandlerAccess,
  req: BigQueryDisconnectInput
): Promise<BigQueryResponse> {
  try {
    await ha.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: req.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDataSource: {
              dataSourceId: req.dataSourceId,
            },
          },
        ],
      },
    });

    logger.info('Deleted BigQuery connection', {
      spreadsheetId: req.spreadsheetId,
      dataSourceId: req.dataSourceId,
    });

    return ha.success('disconnect', {
      mutation: {
        cellsAffected: 0,
        sheetsModified: [req.dataSourceId],
      },
    });
  } catch (err) {
    logger.error('Failed to delete BigQuery connection', { err, req });
    throw err;
  }
}

export async function handleListConnections(
  ha: BigQueryHandlerAccess,
  req: BigQueryListConnectionsInput
): Promise<BigQueryResponse> {
  try {
    const spreadsheet = await ha.sheetsApi.spreadsheets.get({
      spreadsheetId: req.spreadsheetId,
      includeGridData: false,
      fields: 'dataSources,dataSourceSchedules',
    });

    const dataSources = spreadsheet.data.dataSources ?? [];
    const connections = dataSources
      .filter((ds) => ds.spec?.bigQuery || (ds.spec as Record<string, unknown>)?.['looker'])
      .map((ds) => {
        const spec = ds.spec as Record<string, unknown>;
        const lookerSpec = spec?.['looker'] as Record<string, string> | undefined;
        if (lookerSpec) {
          return {
            dataSourceId: ds.dataSourceId ?? '',
            type: 'looker' as const,
            lookerSpec: {
              instanceUri: lookerSpec['instanceUri'] ?? '',
              model: lookerSpec['model'] ?? '',
              explore: lookerSpec['explore'] ?? '',
            },
            sheetId: ds.sheetId ?? undefined,
          };
        }
        return {
          dataSourceId: ds.dataSourceId ?? '',
          type: 'bigquery' as const,
          spec: {
            projectId: ds.spec?.bigQuery?.projectId ?? '',
            datasetId: ds.spec?.bigQuery?.tableSpec?.datasetId ?? undefined,
            tableId: ds.spec?.bigQuery?.tableSpec?.tableId ?? undefined,
            query: ds.spec?.bigQuery?.querySpec?.rawQuery ?? undefined,
          },
          sheetId: ds.sheetId ?? undefined,
        };
      });

    return ha.success('list_connections', {
      connections,
    });
  } catch (err) {
    logger.error('Failed to list data source connections', { err, req });
    throw err;
  }
}

export async function handleGetConnection(
  ha: BigQueryHandlerAccess,
  req: BigQueryGetConnectionInput
): Promise<BigQueryResponse> {
  try {
    const spreadsheet = await ha.sheetsApi.spreadsheets.get({
      spreadsheetId: req.spreadsheetId,
      includeGridData: false,
      fields: 'dataSources',
    });

    const dataSource = spreadsheet.data.dataSources?.find(
      (ds) => ds.dataSourceId === req.dataSourceId
    );

    if (!dataSource) {
      return ha.error({
        code: ErrorCodes.NOT_FOUND,
        message: `Data source not found: ${req.dataSourceId}`,
        retryable: false,
        suggestedFix: 'Verify the spreadsheet ID is correct and you have access to it',
      });
    }

    const spec = dataSource.spec as Record<string, unknown>;
    const lookerSpec = spec?.['looker'] as Record<string, string> | undefined;

    if (lookerSpec) {
      return ha.success('get_connection', {
        connection: {
          dataSourceId: dataSource.dataSourceId ?? '',
          type: 'looker' as const,
          lookerSpec: {
            instanceUri: lookerSpec['instanceUri'] ?? '',
            model: lookerSpec['model'] ?? '',
            explore: lookerSpec['explore'] ?? '',
          },
          sheetId: dataSource.sheetId ?? undefined,
        },
      });
    }

    return ha.success('get_connection', {
      connection: {
        dataSourceId: dataSource.dataSourceId ?? '',
        type: 'bigquery' as const,
        spec: {
          projectId: dataSource.spec?.bigQuery?.projectId ?? '',
          datasetId: dataSource.spec?.bigQuery?.tableSpec?.datasetId ?? undefined,
          tableId: dataSource.spec?.bigQuery?.tableSpec?.tableId ?? undefined,
          query: dataSource.spec?.bigQuery?.querySpec?.rawQuery ?? undefined,
        },
        sheetId: dataSource.sheetId ?? undefined,
      },
    });
  } catch (err) {
    logger.error('Failed to get data source connection', { err, req });
    throw err;
  }
}
