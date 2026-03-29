import { ConfigError } from '../core/errors.js';
import {
  buildRemoteHttpServerOptions as buildRemoteHttpServerOptionsImpl,
  type BuildRemoteHttpServerOptionsParams,
  type RemoteHttpEnvConfig,
  type RemoteHttpServerOptions,
} from '#mcp-http/remote-options';
import type { HttpOAuthServerConfig } from '#mcp-http/auth-providers';

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
