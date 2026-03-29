import {
  FederatedMcpClient as PackagedFederatedMcpClient,
  type FederatedMcpClientDependencies,
  type FederationServerConfig,
} from '#mcp-client/federated-mcp-client';
import { CircuitBreaker } from '../utils/circuit-breaker.js';
import { logger } from '../utils/logger.js';
import { validateFederationServerUrl } from './webhook-url-validation.js';
import { ServiceError, NotFoundError } from '../core/errors.js';
import { getApiSpecificCircuitBreakerConfig } from '../config/env.js';
import { getRequestContext } from '../utils/request-context.js';

function createDefaultFederatedClientDependencies(): FederatedMcpClientDependencies {
  return {
    log: logger,
    validateServerUrl: validateFederationServerUrl,
    getRequestContext,
    getCircuitBreakerConfig: () => getApiSpecificCircuitBreakerConfig('federation'),
    createCircuitBreaker: (params: {
      failureThreshold: number;
      successThreshold: number;
      timeout: number;
    }) => new CircuitBreaker(params),
    createServiceError: (message: string, retryable = false) =>
      new ServiceError(message, 'INTERNAL_ERROR', 'FederatedMcpClient', retryable),
    createNotFoundError: (resourceType: string, identifier: string) =>
      new NotFoundError(resourceType, identifier),
    clientVersion: '1.0.0',
    clientNamePrefix: 'servalsheets-federation',
  };
}

export type { FederationServerConfig };

export class FederatedMcpClient extends PackagedFederatedMcpClient {
  constructor(servers: FederationServerConfig[], defaultTimeoutMs = 30000, maxConnections = 10) {
    super(servers, defaultTimeoutMs, maxConnections, createDefaultFederatedClientDependencies());
  }
}

let globalFederationClient: FederatedMcpClient | null = null;

export async function getFederationClient(
  servers: FederationServerConfig[]
): Promise<FederatedMcpClient> {
  if (!globalFederationClient) {
    globalFederationClient = new FederatedMcpClient(servers);
    await globalFederationClient.initialize();
  }
  return globalFederationClient;
}

export async function resetFederationClient(): Promise<void> {
  if (globalFederationClient) {
    await globalFederationClient.shutdown();
    globalFederationClient = null;
  }
}
