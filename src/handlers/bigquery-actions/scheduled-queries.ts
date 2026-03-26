/**
 * BigQuery scheduled query actions (Data Transfer Service API):
 * - create_scheduled_query: Create a scheduled query
 * - list_scheduled_queries: List scheduled queries
 * - delete_scheduled_query: Delete a scheduled query
 */

import type { BigQueryHandlerAccess } from './internal.js';
import type { BigQueryResponse } from '../../schemas/index.js';
import { ErrorCodes } from '../error-codes.js';
import { validateBigQuerySql, mapDataTransferApiError } from './helpers.js';
import { logger } from '../../utils/logger.js';

export async function handleCreateScheduledQuery(
  ha: BigQueryHandlerAccess,
  req: Record<string, unknown>
): Promise<BigQueryResponse> {
  const projectId = req['projectId'] as string;
  const location = (req['location'] as string) ?? 'US';
  const query = req['query'] as string;
  const displayName = req['displayName'] as string;
  const schedule = req['schedule'] as string;
  const destinationDatasetId = req['destinationDatasetId'] as string | undefined;
  const destinationTableId = req['destinationTableId'] as string | undefined;
  const serviceAccountName = req['serviceAccountName'] as string | undefined;

  validateBigQuerySql(query);

  try {
    if (!ha.context.googleClient) {
      return ha.error({
        code: ErrorCodes.UNAUTHENTICATED,
        message: 'Google client not available - authentication required',
        retryable: false,
      });
    }
    const token = await ha.getFreshAccessToken();
    if (!token) {
      return ha.error({
        code: ErrorCodes.UNAUTHENTICATED,
        message: 'OAuth access token required for scheduled queries',
        retryable: false,
      });
    }

    const url = `https://bigquerydatatransfer.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/transferConfigs`;

    const body: Record<string, unknown> = {
      displayName,
      dataSourceId: 'scheduled_query',
      schedule,
      params: {
        query,
        ...(destinationTableId ? { destination_table_name_template: destinationTableId } : {}),
      },
      ...(destinationDatasetId ? { destinationDatasetId } : {}),
      ...(serviceAccountName ? { serviceAccountName } : {}),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('BigQuery Data Transfer API error', {
        action: 'create_scheduled_query',
        status: response.status,
        body: errorBody.substring(0, 200),
      });
      const mapped = mapDataTransferApiError(response.status);
      return ha.error({
        code: mapped.code,
        message: mapped.message,
        retryable: mapped.retryable,
      });
    }

    const result = (await response.json()) as Record<string, unknown>;

    return ha.success('create_scheduled_query', {
      transferConfigName: result['name'],
      displayName: result['displayName'],
      schedule: result['schedule'],
      state: result['state'],
      nextRunTime: result['nextRunTime'],
    });
  } catch (err) {
    logger.error('Failed to create scheduled query', { err, projectId });
    return ha.mapBigQueryError(err);
  }
}

export async function handleListScheduledQueries(
  ha: BigQueryHandlerAccess,
  req: Record<string, unknown>
): Promise<BigQueryResponse> {
  const projectId = req['projectId'] as string;
  const location = (req['location'] as string) ?? 'US';
  const maxResults = (req['maxResults'] as number) ?? 20;

  try {
    if (!ha.context.googleClient) {
      return ha.error({
        code: ErrorCodes.UNAUTHENTICATED,
        message: 'Google client not available - authentication required',
        retryable: false,
      });
    }
    const token = await ha.getFreshAccessToken();
    if (!token) {
      return ha.error({
        code: ErrorCodes.UNAUTHENTICATED,
        message: 'OAuth access token required for scheduled queries',
        retryable: false,
      });
    }

    const url = `https://bigquerydatatransfer.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/transferConfigs?dataSourceIds=scheduled_query&pageSize=${maxResults}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('BigQuery Data Transfer API error', {
        action: 'list_scheduled_queries',
        status: response.status,
        body: errorBody.substring(0, 200),
      });
      const mapped = mapDataTransferApiError(response.status);
      return ha.error({
        code: mapped.code,
        message: mapped.message,
        retryable: mapped.retryable,
      });
    }

    const result = (await response.json()) as {
      transferConfigs?: unknown[];
      nextPageToken?: string;
    };

    return ha.success('list_scheduled_queries', {
      scheduledQueries: result.transferConfigs ?? [],
      count: (result.transferConfigs ?? []).length,
      nextPageToken: result.nextPageToken,
    });
  } catch (err) {
    logger.error('Failed to list scheduled queries', { err, projectId });
    return ha.mapBigQueryError(err);
  }
}

export async function handleDeleteScheduledQuery(
  ha: BigQueryHandlerAccess,
  req: Record<string, unknown>
): Promise<BigQueryResponse> {
  const transferConfigName = req['transferConfigName'] as string;

  try {
    if (!ha.context.googleClient) {
      return ha.error({
        code: ErrorCodes.UNAUTHENTICATED,
        message: 'Google client not available - authentication required',
        retryable: false,
      });
    }
    const token = await ha.getFreshAccessToken();
    if (!token) {
      return ha.error({
        code: ErrorCodes.UNAUTHENTICATED,
        message: 'OAuth access token required for scheduled queries',
        retryable: false,
      });
    }

    // SEC-1: Validate GCP resource path format to prevent BOLA attacks
    const TRANSFER_CONFIG_PATTERN = /^projects\/[^/]+\/locations\/[^/]+\/transferConfigs\/[^/]+$/;
    if (!TRANSFER_CONFIG_PATTERN.test(transferConfigName)) {
      return ha.error({
        code: ErrorCodes.INVALID_PARAMS,
        message:
          'transferConfigName must be in format: projects/{project}/locations/{location}/transferConfigs/{id}',
        retryable: false,
      });
    }
    const url = `https://bigquerydatatransfer.googleapis.com/v1/${transferConfigName}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('BigQuery Data Transfer API error', {
        action: 'delete_scheduled_query',
        status: response.status,
        body: errorBody.substring(0, 200),
      });
      const mapped = mapDataTransferApiError(response.status);
      return ha.error({
        code: mapped.code,
        message: mapped.message,
        retryable: mapped.retryable,
      });
    }

    return ha.success('delete_scheduled_query', {
      deleted: true,
      transferConfigName,
    });
  } catch (err) {
    logger.error('Failed to delete scheduled query', { err, transferConfigName });
    return ha.mapBigQueryError(err);
  }
}
