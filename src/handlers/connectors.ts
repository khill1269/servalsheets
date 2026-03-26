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
import type { ConnectorCredentials } from '../connectors/types.js';
import type { ElicitationServer } from '../mcp/elicitation.js';
import { generateElicitationId, safeElicit, selectField } from '../mcp/elicitation.js';
import { startApiKeyServer, startOAuthCredentialsServer } from '../utils/api-key-server.js';
import type {
  ConnectorCatalogEntry,
  ConnectorUxMetadata,
  ConnectorMeta,
  EnrichedConnector,
  ConnectorsHandlerAccess,
} from './connectors-actions/internal.js';
import { handleListConnectors, handleConfigure } from './connectors-actions/management.js';
import {
  handleQuery,
  handleBatchQuery,
  handleSubscribe,
  handleUnsubscribe,
  handleListSubscriptions,
  handleTransform,
} from './connectors-actions/data.js';
import { handleStatus, handleDiscover } from './connectors-actions/status.js';

// ============================================================================
// UX Metadata
// ============================================================================

const CONNECTOR_SETUP_HINTS: Record<string, ConnectorUxMetadata> = {
  finnhub: {
    signupUrl: 'https://finnhub.io/register',
    hint: 'Free tier: stocks, earnings, and market news',
    recommendedUseCases: ['Stock quotes', 'Earnings calendars', 'Market news'],
    exampleQuery: {
      endpoint: 'stock/quote',
      params: { symbol: 'AAPL' },
    },
  },
  fred: {
    signupUrl: 'https://fred.stlouisfed.org/docs/api/api_key.html',
    hint: 'Free economic indicators, interest rates, and macro data',
    recommendedUseCases: ['Macro time series', 'Rates and inflation', 'Economic releases'],
    exampleQuery: {
      endpoint: 'series/observations',
      params: { series_id: 'FEDFUNDS' },
    },
  },
  alpha_vantage: {
    signupUrl: 'https://www.alphavantage.co/support/#api-key',
    hint: 'Free tier: stocks, forex, and crypto data',
    recommendedUseCases: ['Daily market data', 'FX and crypto', 'Technical indicators'],
  },
  polygon: {
    signupUrl: 'https://polygon.io/dashboard/signup',
    hint: 'Real-time and historical market data',
    recommendedUseCases: ['Market snapshots', 'Aggregated bars', 'Reference data'],
  },
  fmp: {
    signupUrl: 'https://financialmodelingprep.com/developer/docs',
    hint: 'Fundamentals, statements, and company metrics',
    recommendedUseCases: ['Company fundamentals', 'Financial statements', 'Quotes'],
    exampleQuery: {
      endpoint: 'quote',
      params: { symbol: 'AAPL' },
    },
  },
};

// ============================================================================
// Handler
// ============================================================================

export interface ConnectorsHandlerOptions {
  samplingServer?: SamplingServer;
  sessionContext?: import('../services/session-context.js').SessionContextManager;
  elicitationServer?: ElicitationServer;
}

export class ConnectorsHandler {
  private samplingServer?: SamplingServer;
  private sessionContext?: import('../services/session-context.js').SessionContextManager;
  private elicitationServer?: ElicitationServer;

  constructor(options?: ConnectorsHandlerOptions) {
    this.samplingServer = options?.samplingServer;
    this.sessionContext = options?.sessionContext;
    this.elicitationServer = options?.elicitationServer;
  }

  private createMeta(options: {
    nextBestAction: string;
    verificationSummary: string;
    nextSteps?: string[];
  }): ConnectorMeta {
    return {
      journeyStage: 'connector_setup' as const,
      nextBestAction: options.nextBestAction,
      verificationSummary: options.verificationSummary,
      ...(options.nextSteps ? { nextSteps: options.nextSteps } : {}),
    };
  }

  private getConnectorUx(connectorId: string): ConnectorUxMetadata {
    return (
      CONNECTOR_SETUP_HINTS[connectorId] ?? {
        recommendedUseCases: ['Live external data import'],
      }
    );
  }

  private enrichConnector(connector: ConnectorCatalogEntry): EnrichedConnector {
    const ux = this.getConnectorUx(connector.id);
    return {
      ...connector,
      ...(ux.signupUrl ? { signupUrl: ux.signupUrl } : {}),
      recommendedUseCases: ux.recommendedUseCases,
      nextStep: connector.configured
        ? `Run sheets_connectors action "status" with connectorId "${connector.id}" or make a first query.`
        : `Run sheets_connectors action "configure" with connectorId "${connector.id}".`,
    };
  }

  private makeErrorResponse(
    action: SheetsConnectorsInput['request']['action'],
    code: (typeof ErrorCodes)[keyof typeof ErrorCodes],
    message: string,
    suggestedFix?: string,
    nextBestAction?: string
  ): SheetsConnectorsOutput {
    return {
      response: {
        success: false,
        action,
        error: {
          code,
          message,
          retryable: false,
          ...(suggestedFix ? { suggestedFix } : {}),
        },
        ...(nextBestAction
          ? {
              _meta: this.createMeta({
                nextBestAction,
                verificationSummary:
                  'Connector setup could not proceed because required input was missing.',
                nextSteps: suggestedFix ? [suggestedFix] : undefined,
              }),
            }
          : {}),
      },
    };
  }

  private getConnectorCatalog(): ConnectorCatalogEntry[] {
    return connectorManager.listConnectors().connectors;
  }

  private getConnectorEntry(connectorId: string | undefined): ConnectorCatalogEntry | undefined {
    if (!connectorId) {
      return undefined;
    }
    return this.getConnectorCatalog().find((connector) => connector.id === connectorId);
  }

  private async elicitConnectorSelection(): Promise<string | null> {
    if (!this.elicitationServer) {
      return null;
    }

    const connectors = this.getConnectorCatalog();

    try {
      const result = await safeElicit<{ connectorId: string } | null>(
        this.elicitationServer,
        {
          mode: 'form',
          message:
            'Choose the connector you want to configure. ServalSheets will then ask only for the auth fields that connector requires.',
          requestedSchema: {
            type: 'object',
            properties: {
              connectorId: selectField({
                title: 'Connector',
                description: 'Available built-in connectors',
                options: connectors.map((connector) => ({
                  value: connector.id,
                  label: `${connector.name} — ${connector.description}`,
                })),
              }),
            },
            required: ['connectorId'],
          },
        },
        null
      );

      if (typeof result?.connectorId === 'string' && result.connectorId.trim()) {
        return result.connectorId.trim();
      }
    } catch {
      // Elicitation unsupported or unavailable — fall through to manual error response
    }

    return null;
  }

  private async elicitApiKey(connector: ConnectorCatalogEntry): Promise<string | null> {
    if (!this.elicitationServer) {
      return null;
    }

    const setupHint = CONNECTOR_SETUP_HINTS[connector.id];
    const supportsUrl = !!this.elicitationServer.getClientCapabilities()?.elicitation?.url;

    if (supportsUrl) {
      let shutdown: (() => void) | undefined;

      try {
        const handle = await startApiKeyServer({
          provider: connector.name,
          signupUrl: setupHint?.signupUrl ?? 'https://example.com',
          hint: setupHint?.hint ?? 'Paste your API key',
        });
        shutdown = handle.shutdown;

        const elicitationId = generateElicitationId('connector_key');
        const result = await this.elicitationServer.elicitInput({
          mode: 'url',
          message:
            `Open the local ${connector.name} setup page to paste your API key. ` +
            'The key is stored locally and does not need to travel in the MCP request payload.',
          elicitationId,
          url: handle.url,
        });

        if (result.action !== 'accept') {
          shutdown();
          return null;
        }

        const apiKey = (await handle.keyPromise).trim();
        if (!apiKey) {
          return null;
        }

        if (this.elicitationServer.createElicitationCompletionNotifier) {
          const notify = this.elicitationServer.createElicitationCompletionNotifier(elicitationId);
          try {
            await notify();
          } catch (notifyErr) {
            logger.warn('API key elicitation completion notification failed (non-fatal)', {
              error: notifyErr,
            });
          }
        }

        return apiKey;
      } catch {
        shutdown?.();
      }
    }

    // MCP 2025-11-25 MUST NOT: never collect API keys via form mode (key would transit MCP payload).
    // URL mode is the only secure path — if unavailable, caller will ask user to provide key directly.
    return null; // OK: Explicit empty — no secure fallback when URL elicitation unavailable
  }

  private async elicitOAuthCredentials(
    connector: ConnectorCatalogEntry
  ): Promise<ConnectorCredentials['oauth'] | null> {
    if (!this.elicitationServer) {
      return null;
    }

    // MCP 2025-11-25 MUST NOT: never collect clientSecret via form mode (transits MCP payload).
    // Use URL mode — credentials are submitted directly to localhost and never leave the machine.
    const supportsUrl = !!this.elicitationServer.getClientCapabilities()?.elicitation?.url;
    if (!supportsUrl) {
      return null;
    }

    let shutdown: (() => void) | undefined;
    try {
      const handle = await startOAuthCredentialsServer({ provider: connector.name });
      shutdown = handle.shutdown;

      const elicitationId = generateElicitationId('connector_oauth');
      const result = await this.elicitationServer.elicitInput({
        mode: 'url',
        message:
          `Open the local ${connector.name} OAuth setup page to enter your credentials. ` +
          'Credentials are stored locally and never transit through the MCP payload.',
        elicitationId,
        url: handle.url,
      });

      if (result.action !== 'accept') {
        shutdown();
        return null;
      }

      const creds = await handle.credentialsPromise;
      if (!creds.clientId || !creds.clientSecret) {
        return null;
      }

      if (this.elicitationServer.createElicitationCompletionNotifier) {
        const notify = this.elicitationServer.createElicitationCompletionNotifier(elicitationId);
        try {
          await notify();
        } catch (notifyErr) {
          logger.warn('OAuth credentials elicitation completion notification failed (non-fatal)', {
            error: notifyErr,
          });
        }
      }

      return {
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        ...(creds.accessToken ? { accessToken: creds.accessToken } : {}),
        ...(creds.refreshToken ? { refreshToken: creds.refreshToken } : {}),
      };
    } catch {
      shutdown?.();
    }

    return null;
  }

  /** Build the access object passed to submodule action functions. */
  private buildHandlerAccess(): ConnectorsHandlerAccess {
    return {
      samplingServer: this.samplingServer,
      elicitationServer: this.elicitationServer,
      sessionContext: this.sessionContext,
      createMeta: this.createMeta.bind(this),
      getConnectorUx: this.getConnectorUx.bind(this),
      enrichConnector: this.enrichConnector.bind(this),
      makeErrorResponse: this.makeErrorResponse.bind(this),
      getConnectorCatalog: this.getConnectorCatalog.bind(this),
      getConnectorEntry: this.getConnectorEntry.bind(this),
      elicitConnectorSelection: this.elicitConnectorSelection.bind(this),
      elicitApiKey: this.elicitApiKey.bind(this),
      elicitOAuthCredentials: this.elicitOAuthCredentials.bind(this),
    };
  }

  async handle(input: SheetsConnectorsInput): Promise<SheetsConnectorsOutput> {
    const { request } = input;
    const { action } = request;

    try {
      const h = this.buildHandlerAccess();

      switch (action) {
        case 'list_connectors':
          return handleListConnectors(h);

        case 'configure':
          return handleConfigure(request, h);

        case 'query':
          return handleQuery(request, h);

        case 'batch_query':
          return handleBatchQuery(request);

        case 'subscribe':
          return handleSubscribe(request);

        case 'unsubscribe':
          return handleUnsubscribe(request);

        case 'list_subscriptions':
          return handleListSubscriptions();

        case 'transform':
          return handleTransform(request);

        case 'status':
          return handleStatus(request, h);

        case 'discover':
          return handleDiscover(request, h);

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
}
