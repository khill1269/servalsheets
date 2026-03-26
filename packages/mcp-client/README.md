# @serval/mcp-client

Outbound MCP client helpers for federation.

## Purpose

Provides two client abstractions for connecting from ServalSheets to remote MCP servers. `FederatedMcpClient` manages a registry of named federation servers (tool listing, tool calling, connection validation) with per-server circuit breakers and trace propagation. `RemoteToolClient` is a lower-level single-server client for calling a specific tool on a remote endpoint with timeout and auth support.

## Key Exports

- `FederatedMcpClient` — registry client that maps server names to `FederationServerConfig` entries; supports `listServers`, `getServerTools`, `callTool`, `validateConnection`, and `disconnect`
- `FederationServerConfig` — server definition: `name`, `url`, `transport` (`'http' | 'stdio'`), optional `auth` (bearer or api-key), optional `timeoutMs`
- `FederatedMcpClientDependencies` — DI interface required to instantiate `FederatedMcpClient`: logger, URL validator, circuit breaker factory, error factories, client version
- `RemoteToolClient` — single-server client that calls `tools/call` on a remote MCP endpoint via Streamable HTTP; wraps calls with a configurable timeout and optional auth headers
- `RemoteToolClientConfig` — connection config: `url`, `timeoutMs`, `auth`, `headers`
- `RemoteToolClientDependencies` — DI interface for `RemoteToolClient`: logger, URL validator, error factory, client name and version

## Usage

```typescript
import { FederatedMcpClient } from '@serval/mcp-client';

const client = new FederatedMcpClient(
  [{ name: 'analytics', url: 'https://analytics.internal/mcp', transport: 'http' }],
  {
    log: logger,
    validateServerUrl,
    getRequestContext,
    getCircuitBreakerConfig,
    createCircuitBreaker,
    createServiceError,
    createNotFoundError,
    clientVersion: '2.0.0',
  }
);

const tools = await client.getServerTools('analytics');
const result = await client.callTool('analytics', 'run_query', { sql: '...' });
```

## Notes

Internal use only — private package, not published to npm. Both clients use `@modelcontextprotocol/sdk`'s `StreamableHTTPClientTransport` under the hood. Circuit breakers are supplied by the caller (DI pattern) to avoid coupling to a specific breaker implementation.
