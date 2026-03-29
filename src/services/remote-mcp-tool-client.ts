import {
  RemoteToolClient as PackagedRemoteToolClient,
  type RemoteToolClientConfig,
  type RemoteToolClientDependencies,
} from '#mcp-client/remote-tool-client';
import { ServiceError } from '../core/errors.js';
import { getRemoteMcpExecutorConfig } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { getRequestContext } from '../utils/request-context.js';
import { validateRemoteMcpExecutorUrl } from './webhook-url-validation.js';

function createDefaultRemoteToolClientDependencies(): RemoteToolClientDependencies {
  return {
    log: logger,
    validateServerUrl: validateRemoteMcpExecutorUrl,
    getRequestContext,
    createServiceError: (message: string, retryable = false) =>
      new ServiceError(message, 'INTERNAL_ERROR', 'RemoteToolClient', retryable),
    clientVersion: '1.0.0',
    clientName: 'servalsheets-remote-executor',
  };
}

export class RemoteToolClient extends PackagedRemoteToolClient {
  constructor(config: RemoteToolClientConfig) {
    super(config, createDefaultRemoteToolClientDependencies());
  }
}

let globalRemoteToolClient: RemoteToolClient | null = null;
let globalRemoteToolClientKey: string | null = null;

function buildRemoteClientKey(config: RemoteToolClientConfig): string {
  return JSON.stringify({
    url: config.url,
    timeoutMs: config.timeoutMs,
    authType: config.auth?.type,
    hasToken: Boolean(config.auth?.token),
  });
}

export function isRemoteMcpExecutorToolEnabled(
  toolName: string,
  config = getRemoteMcpExecutorConfig()
): boolean {
  return config.enabled && config.allowedTools.includes(toolName);
}

export async function getRemoteToolClient(toolName?: string): Promise<RemoteToolClient | null> {
  const config = getRemoteMcpExecutorConfig();
  if (!config.enabled || !config.url) {
    return null;
  }

  if (toolName && !isRemoteMcpExecutorToolEnabled(toolName, config)) {
    return null;
  }

  const nextConfig: RemoteToolClientConfig = {
    url: config.url,
    timeoutMs: config.timeoutMs,
    auth: config.auth,
  };
  const nextKey = buildRemoteClientKey(nextConfig);

  if (!globalRemoteToolClient || globalRemoteToolClientKey !== nextKey) {
    if (globalRemoteToolClient) {
      await globalRemoteToolClient.close();
    }
    globalRemoteToolClient = new RemoteToolClient(nextConfig);
    globalRemoteToolClientKey = nextKey;
  }

  return globalRemoteToolClient;
}

export async function resetRemoteToolClient(): Promise<void> {
  if (globalRemoteToolClient) {
    await globalRemoteToolClient.close();
    globalRemoteToolClient = null;
    globalRemoteToolClientKey = null;
  }
}
