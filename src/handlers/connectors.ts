/**
 * ServalSheets - Connectors Handler
 *
 * Handles all sheets_connectors actions by delegating to ConnectorManager.
 * Standalone handler pattern (not BaseHandler) since connectors are
 * independent of Google Sheets API.
 *
 * Actions (10):
 * - list_connectors, configure, query, batch_query, subscribe,
 *   unsubscribe, list_subscriptions, transform, status, discover
 *
 * P5.3: Added AI-powered connector discovery via MCP Sampling
 */

import { ErrorCodes } from './error-codes.js';
import { logger } from '../utils/logger.js';
import { connectorManager } from '../resources/connectors-runtime.js';
import type { SheetsConnectorsInput, SheetsConnectorsOutput } from '../schemas/connectors.js';
import type { SamplingServer } from '../mcp/sampling.js';
import { generateAIInsight } from '../mcp/sampling.js';

// ============================================================================
// Handler
// ============================================================================

export interface ConnectorsHandlerOptions {
  samplingServer?: SamplingServer;
  sessionContext?: import('../services/session-context.js').SessionContextManager;
}

export class ConnectorsHandler {
  private samplingServer?: SamplingServer;
  private sessionContext?: import('../services/session-context.js').SessionContextManager;

  constructor(options?: ConnectorsHandlerOptions) {
    this.samplingServer = options?.samplingServer;
    this.sessionContext = options?.sessionContext;
  }

  async handle(input: SheetsConnectorsInput): Promise<SheetsConnectorsOutput> {
    const { request } = input;
    const { action } = request;

    try {
      switch (action) {
        case 'list_connectors':
          return this.handleListConnectors();

        case 'configure':
          return this.handleConfigure(request);

        case 'query':
          return this.handleQuery(request);

        case 'batch_query':
          return this.handleBatchQuery(request);

        case 'subscribe':
          return this.handleSubscribe(request);

        case 'unsubscribe':
          return this.handleUnsubscribe(request);

        case 'list_subscriptions':
          return this.handleListSubscriptions();

        case 'transform':
          return this.handleTransform(request);

        case 'status':
          return this.handleStatus(request);

        case 'discover':
          return this.handleDiscover(request);

        default: {
          const _exhaustive: never = action;
          return {
            response: {
              success: false,
              action: String(_exhaustive),
              error: {
                code: ErrorCodes.INVALID_PARAMS,
                message: `Unknown action: ${String(_exhaustive)}`,
                retryable: false,
              },
            },
          };
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Connector handler error', { action, error: message });
      return {
        response: {
          success: false,
          action,
          error: { code: ErrorCodes.INTERNAL_ERROR, message, retryable: false },
        },
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------

  private handleListConnectors(): SheetsConnectorsOutput {
    const result = connectorManager.listConnectors();
    return {
      response: {
        success: true,
        action: 'list_connectors',
        connectors: result.connectors,
      },
    };
  }

  private async handleConfigure(
    req: Extract<SheetsConnectorsInput['request'], { action: 'configure' }>
  ): Promise<SheetsConnectorsOutput> {
    const result = await connectorManager.configure(req.connectorId, req.credentials);
    if (!result.success) {
      return {
        response: {
          success: false as const,
          action: 'configure',
          error: { code: ErrorCodes.CONNECTOR_ERROR, message: result.message, retryable: false },
        },
      };
    }
    return {
      response: {
        success: true as const,
        action: 'configure',
        message: result.message,
      },
    };
  }

  private async handleQuery(
    req: Extract<SheetsConnectorsInput['request'], { action: 'query' }>
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
      if (this.sessionContext) {
        this.sessionContext.recordOperation({
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

  private async handleBatchQuery(
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

  private handleSubscribe(
    req: Extract<SheetsConnectorsInput['request'], { action: 'subscribe' }>
  ): SheetsConnectorsOutput {
    const sub = connectorManager.subscribe(
      req.connectorId,
      req.endpoint,
      req.params ?? {},
      req.schedule,
      req.destination
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

  private handleUnsubscribe(
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

  private handleListSubscriptions(): SheetsConnectorsOutput {
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

  private async handleTransform(
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

  private async handleStatus(
    req: Extract<SheetsConnectorsInput['request'], { action: 'status' }>
  ): Promise<SheetsConnectorsOutput> {
    const result = await connectorManager.status(req.connectorId);
    return {
      response: {
        success: true,
        action: 'status',
        id: result.id,
        name: result.name,
        configured: result.configured,
        health: result.health,
        quota: result.quota,
      },
    };
  }

  private async handleDiscover(
    req: Extract<SheetsConnectorsInput['request'], { action: 'discover' }>
  ): Promise<SheetsConnectorsOutput> {
    if (req.endpoint) {
      const discovery = await connectorManager.discover(req.connectorId);
      const endpoint = discovery.endpoints.find((candidate) => candidate.id === req.endpoint);
      if (!endpoint) {
        return {
          response: {
            success: false,
            action: 'discover',
            error: {
              code: ErrorCodes.INVALID_PARAMS,
              message: `Unknown endpoint "${req.endpoint}" for connector "${req.connectorId}"`,
              retryable: false,
            },
          },
        };
      }

      // Get schema for a specific endpoint
      const schema = await connectorManager.getEndpointSchema(req.connectorId, req.endpoint);
      return {
        response: {
          success: true,
          action: 'discover',
          schema,
        },
      };
    }

    // List all endpoints with AI-powered recommendation
    const result = await connectorManager.discover(req.connectorId);

    // AI-powered connector recommendation
    let aiRecommendation: string | undefined;
    if (this.samplingServer) {
      aiRecommendation = await generateAIInsight(
        this.samplingServer,
        'connectorDiscovery',
        `Which endpoints from connector "${req.connectorId}" would be most useful? What data can each provide?`,
        { connectorId: req.connectorId, endpoints: result.endpoints },
        { maxTokens: 400 }
      );
    }

    return {
      response: {
        success: true,
        action: 'discover',
        endpoints: result.endpoints,
        ...(aiRecommendation ? { aiRecommendation } : {}),
      },
    };
  }
}
