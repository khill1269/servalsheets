import { ConfigError } from '../core/errors.js';
import {
  buildRemoteHttpServerOptions as buildRemoteHttpServerOptionsImpl,
  type BuildRemoteHttpServerOptionsParams,
  type RemoteHttpEnvConfig,
  type RemoteHttpServerOptions,
} from '../../packages/mcp-http/dist/remote-options.js';
import type { HttpOAuthServerConfig } from '../../packages/mcp-http/dist/auth-providers.js';

export type {
  BuildRemoteHttpServerOptionsParams,
  HttpOAuthServerConfig,
  RemoteHttpEnvConfig,
  RemoteHttpServerOptions,
};

export function buildRemoteHttpServerOptions(
  params: BuildRemoteHttpServerOptionsParams
): RemoteHttpServerOptions {
  return buildRemoteHttpServerOptionsImpl(params, {
    createConfigError: (message, configKey) => new ConfigError(message, configKey),
  });
}
