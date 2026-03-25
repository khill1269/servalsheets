/**
 * Connectors actions: list_connectors, configure
 */

import { ErrorCodes } from '../error-codes.js';
import { recordConnectorId } from '../../mcp/completions.js';
import { connectorManager } from '../../resources/connectors-runtime.js';
import type { SheetsConnectorsInput, SheetsConnectorsOutput } from '../../schemas/connectors.js';
import type { ConnectorsHandlerAccess } from './internal.js';

export function handleListConnectors(h: ConnectorsHandlerAccess): SheetsConnectorsOutput {
  const result = connectorManager.listConnectors();
  const enrichedConnectors = result.connectors.map((connector) => h.enrichConnector(connector));
  // Record connector IDs for MCP completion suggestions
  for (const c of enrichedConnectors) {
    recordConnectorId(c.id);
  }
  const configuredCount = enrichedConnectors.filter((connector) => connector.configured).length;
  return {
    response: {
      success: true,
      action: 'list_connectors',
      message:
        configuredCount > 0
          ? `${configuredCount} connector(s) already configured. Pick one to verify or query.`
          : 'No connectors are configured yet. Pick one provider and run configure.',
      connectors: enrichedConnectors,
      nextStep:
        configuredCount > 0
          ? 'Run sheets_connectors action "status" on a configured connector, or make a first query.'
          : 'Run sheets_connectors action "configure" for the connector you want to use first.',
      _meta: h.createMeta({
        nextBestAction:
          configuredCount > 0
            ? 'Check a configured connector with sheets_connectors.status.'
            : 'Configure one connector with sheets_connectors.configure.',
        verificationSummary: `${configuredCount}/${enrichedConnectors.length} connector(s) are configured.`,
      }),
    },
  };
}

export async function handleConfigure(
  req: Extract<SheetsConnectorsInput['request'], { action: 'configure' }>,
  h: ConnectorsHandlerAccess
): Promise<SheetsConnectorsOutput> {
  let connectorId = req.connectorId?.trim();

  if (!connectorId) {
    connectorId = (await h.elicitConnectorSelection()) ?? undefined;
  }

  if (!connectorId) {
    const nextBestAction =
      'Run list_connectors first or retry configure with connectorId on an elicitation-capable client.';
    return h.makeErrorResponse(
      'configure',
      h.elicitationServer
        ? ErrorCodes.OPERATION_CANCELLED
        : ErrorCodes.ELICITATION_UNAVAILABLE,
      'Connector configuration needs a connectorId. On elicitation-capable MCP clients, the server can prompt for it; otherwise provide connectorId explicitly.',
      'Call list_connectors to see valid connector IDs, then retry configure with connectorId and credentials.',
      nextBestAction
    );
  }

  const connector = h.getConnectorEntry(connectorId);
  if (!connector) {
    return h.makeErrorResponse(
      'configure',
      ErrorCodes.INVALID_PARAMS,
      `Unknown connector "${connectorId}".`,
      'Use list_connectors to see available connector IDs before configuring one.'
    );
  }

  const providedCredentials = req.credentials;
  let credentials: import('../../connectors/types.js').ConnectorCredentials;

  if (connector.authType === 'none') {
    credentials = { type: 'none' };
  } else if (connector.authType === 'api_key') {
    const providedApiKey = providedCredentials?.apiKey?.trim();
    if (providedApiKey) {
      credentials = { type: 'api_key', apiKey: providedApiKey };
    } else {
      const apiKey = await h.elicitApiKey(connector);
      if (!apiKey) {
        return h.makeErrorResponse(
          'configure',
          h.elicitationServer
            ? ErrorCodes.OPERATION_CANCELLED
            : ErrorCodes.ELICITATION_UNAVAILABLE,
          h.elicitationServer
            ? `Connector configuration for "${connector.name}" was cancelled before an API key was provided.`
            : `Connector "${connector.name}" requires credentials.apiKey.`,
          h.elicitationServer
            ? 'Retry configure with credentials.apiKey, or accept the MCP elicitation prompt so the server can open a local setup page for the key.'
            : 'Retry configure with credentials.apiKey, or use an elicitation-capable MCP client so the server can prompt for it.',
          `Provide an API key for "${connector.name}" and retry configure.`
        );
      }
      credentials = { type: 'api_key', apiKey };
    }
  } else {
    const oauth =
      providedCredentials?.oauth &&
      providedCredentials.oauth.clientId &&
      providedCredentials.oauth.clientSecret
        ? providedCredentials.oauth
        : await h.elicitOAuthCredentials(connector);

    if (!oauth) {
      return h.makeErrorResponse(
        'configure',
        h.elicitationServer
          ? ErrorCodes.OPERATION_CANCELLED
          : ErrorCodes.ELICITATION_UNAVAILABLE,
        h.elicitationServer
          ? `Connector configuration for "${connector.name}" was cancelled before OAuth credentials were provided.`
          : `Connector "${connector.name}" requires credentials.oauth with clientId and clientSecret.`,
        h.elicitationServer
          ? 'Retry configure with credentials.oauth, or accept the MCP elicitation prompt so the server can collect the OAuth fields.'
          : 'Retry configure with credentials.oauth, or use an elicitation-capable MCP client so the server can prompt for the fields.',
        `Provide OAuth credentials for "${connector.name}" and retry configure.`
      );
    }

    credentials = { type: 'oauth2', oauth };
  }

  const result = await connectorManager.configure(connector.id, credentials);
  if (!result.success) {
    return {
      response: {
        success: false as const,
        action: 'configure',
        error: { code: ErrorCodes.CONNECTOR_ERROR, message: result.message, retryable: false },
      },
    };
  }
  const status = await connectorManager.status(connector.id).catch(() => null);
  const ux = h.getConnectorUx(connector.id);
  const verified = status?.health?.healthy ?? true;
  return {
    response: {
      success: true as const,
      action: 'configure',
      message: result.message,
      id: connector.id,
      name: connector.name,
      configured: true,
      verified,
      authType: connector.authType,
      ...(ux.signupUrl ? { signupUrl: ux.signupUrl } : {}),
      recommendedUseCases: ux.recommendedUseCases,
      nextStep: verified
        ? `Run a first query against "${connector.id}" to confirm the end-to-end flow.`
        : `Run sheets_connectors action "status" for "${connector.id}" to inspect connector health.`,
      ...(ux.exampleQuery
        ? {
            exampleQuery: {
              connectorId: connector.id,
              endpoint: ux.exampleQuery.endpoint,
              ...(ux.exampleQuery.params ? { params: ux.exampleQuery.params } : {}),
            },
          }
        : {}),
      ...(status?.health ? { health: status.health } : {}),
      ...(status?.quota ? { quota: status.quota } : {}),
      _meta: h.createMeta({
        nextBestAction: verified
          ? `Run sheets_connectors.query for "${connector.id}".`
          : `Run sheets_connectors.status for "${connector.id}".`,
        verificationSummary: verified
          ? `${connector.name} completed configuration and health verification.`
          : `${connector.name} stored credentials but needs a follow-up status check.`,
        nextSteps: ux.exampleQuery
          ? [
              `Example: sheets_connectors { "action": "query", "connectorId": "${connector.id}", "endpoint": "${ux.exampleQuery.endpoint}" }`,
            ]
          : undefined,
      }),
    },
  };
}
