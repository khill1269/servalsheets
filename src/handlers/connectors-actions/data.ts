/**
 * Connectors actions: query, batch_query, transform
 */

import { connectorManager } from '../../resources/connectors-runtime.js';
import { extractRangeA1 } from '../../utils/range-helpers.js';
import type { SheetsConnectorsInput, SheetsConnectorsOutput } from '../../schemas/connectors.js';
import type { ConnectorsHandlerAccess } from './internal.js';

export async function handleQuery(
  req: Extract<SheetsConnectorsInput['request'], { action: 'query' }>,
  h: ConnectorsHandlerAccess
): Promise<SheetsConnectorsOutput> {
  const result = await connectorManager.query(
    req.connectorId,
    req.endpoint,
    req.params ?? {},
    req.transform,
    req.useCache
  );

  // Record operation in session context for LLM follow-up references
  try {
    if (h.sessionContext) {
      h.sessionContext.recordOperation({
        tool: 'sheets_connectors',
        action: 'query',
        spreadsheetId: req.connectorId,
        description: `Queried connector '${req.connectorId}' endpoint '${req.endpoint}': ${result.rows.length} rows`,
        undoable: false,
        cellsAffected: result.rows.length,
      });
    }
  } catch {
    // Non-blocking: session context recording is best-effort
  }

  return {
    response: {
      success: true,
      action: 'query',
      headers: result.headers,
      rows: result.rows,
      metadata: result.metadata,
    },
  };
}

export async function handleBatchQuery(
  req: Extract<SheetsConnectorsInput['request'], { action: 'batch_query' }>
): Promise<SheetsConnectorsOutput> {
  const result = await connectorManager.batchQuery(
    req.queries.map((q) => ({
      connectorId: q.connectorId,
      endpoint: q.endpoint,
      params: q.params ?? {},
      transform: q.transform,
    }))
  );
  return {
    response: {
      success: true,
      action: 'batch_query',
      results: result.results,
    },
  };
}

export function handleSubscribe(
  req: Extract<SheetsConnectorsInput['request'], { action: 'subscribe' }>
): SheetsConnectorsOutput {
  const sub = connectorManager.subscribe(
    req.connectorId,
    req.endpoint,
    req.params ?? {},
    req.schedule,
    {
      spreadsheetId: req.destination.spreadsheetId,
      range: extractRangeA1(req.destination.range, 'destination.range'),
    }
  );
  return {
    response: {
      success: true,
      action: 'subscribe',
      subscription: {
        id: sub.id,
        connectorId: sub.connectorId,
        endpoint: sub.endpoint,
        status: sub.status,
        nextRefresh: sub.nextRefresh,
      },
    },
  };
}

export function handleUnsubscribe(
  req: Extract<SheetsConnectorsInput['request'], { action: 'unsubscribe' }>
): SheetsConnectorsOutput {
  const removed = connectorManager.unsubscribe(req.subscriptionId);
  return {
    response: {
      success: true,
      action: 'unsubscribe',
      removed,
    },
  };
}

export function handleListSubscriptions(): SheetsConnectorsOutput {
  const subs = connectorManager.listSubscriptions();
  return {
    response: {
      success: true,
      action: 'list_subscriptions',
      subscriptions: subs.map((s) => ({
        id: s.id,
        connectorId: s.connectorId,
        endpoint: s.endpoint,
        status: s.status,
        lastRefresh: s.lastRefresh,
        nextRefresh: s.nextRefresh,
      })),
    },
  };
}

export async function handleTransform(
  req: Extract<SheetsConnectorsInput['request'], { action: 'transform' }>
): Promise<SheetsConnectorsOutput> {
  const result = await connectorManager.query(
    req.connectorId,
    req.endpoint,
    req.params ?? {},
    req.transform,
    true // use cache since transform is the primary operation
  );
  return {
    response: {
      success: true,
      action: 'transform',
      headers: result.headers,
      rows: result.rows,
      metadata: result.metadata,
    },
  };
}
