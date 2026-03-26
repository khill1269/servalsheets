/**
 * Connectors actions: status, discover
 */

import { ErrorCodes } from '../error-codes.js';
import { connectorManager } from '../../resources/connectors-runtime.js';
import { generateAIInsight } from '../../mcp/sampling.js';
import type { SheetsConnectorsInput, SheetsConnectorsOutput } from '../../schemas/connectors.js';
import type { ConnectorsHandlerAccess } from './internal.js';

export async function handleStatus(
  req: Extract<SheetsConnectorsInput['request'], { action: 'status' }>,
  h: ConnectorsHandlerAccess
): Promise<SheetsConnectorsOutput> {
  const result = await connectorManager.status(req.connectorId);
  const ux = h.getConnectorUx(req.connectorId);
  const nextStep = !result.configured
    ? `Run sheets_connectors action "configure" with connectorId "${req.connectorId}".`
    : result.health?.healthy
      ? `Run sheets_connectors action "query" with connectorId "${req.connectorId}" to pull your first dataset.`
      : `Re-run sheets_connectors action "configure" or inspect the connector credentials for "${req.connectorId}".`;
  return {
    response: {
      success: true,
      action: 'status',
      id: result.id,
      name: result.name,
      configured: result.configured,
      verified: result.health?.healthy ?? false,
      ...(ux.signupUrl ? { signupUrl: ux.signupUrl } : {}),
      recommendedUseCases: ux.recommendedUseCases,
      nextStep,
      ...(ux.exampleQuery
        ? {
            exampleQuery: {
              connectorId: req.connectorId,
              endpoint: ux.exampleQuery.endpoint,
              ...(ux.exampleQuery.params ? { params: ux.exampleQuery.params } : {}),
            },
          }
        : {}),
      health: result.health,
      quota: result.quota,
      _meta: h.createMeta({
        nextBestAction: nextStep,
        verificationSummary: result.configured
          ? result.health?.healthy
            ? `${result.name} is configured and healthy.`
            : `${result.name} is configured but not currently healthy.`
          : `${result.name} is available but not configured yet.`,
      }),
    },
  };
}

export async function handleDiscover(
  req: Extract<SheetsConnectorsInput['request'], { action: 'discover' }>,
  h: ConnectorsHandlerAccess
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
  if (h.samplingServer) {
    aiRecommendation = await generateAIInsight(
      h.samplingServer,
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
