# @serval/mcp-stdio

STDIO transport bootstrap helpers for MCP servers.

## Purpose

Provides the full server lifecycle for process-level MCP communication over STDIO. Handles the three-phase startup sequence (telemetry initialisation → handler initialisation → transport start), signal handling for graceful shutdown, tool and resource registration, task handler creation, and CLI option parsing. Designed to be composed via dependency injection so the product layer supplies its own handlers and runtime dependencies.

## Key Exports

- `startStdioServer` — drives the three-phase startup sequence; accepts `initTelemetry`, `validateEnv`, `verifyToolIntegrity`, `initialize`, `shutdown`, and `startTransport` as injected functions
- `startStdioTransport` — binds the MCP server to the STDIO transport and begins the message loop
- `startStdioRuntime` — top-level entry point that composes runtime state, dependencies, and lifecycle
- `startStdioCli` / `startCliRuntime` — CLI-specific entry points that parse argv before starting
- `createStdioServer` — creates and configures the `McpServer` instance
- `initializeStdioRuntime` — runs handler registration and returns the initialised runtime state
- `shutdownStdioServer` — graceful shutdown with signal handling
- `registerStdioTools` / `registerStdioToolSet` — registers tool handlers on the MCP server
- `registerStdioResources` / `registerStdioCapabilities` — registers resource templates and capability declarations
- `createStdioTaskHandler` — creates the task lifecycle handler for background tool operations
- `createStdioRuntimeState` / `createStdioRuntimeDependencies` — DI factories for runtime internals
- `buildStdioRuntimeDependencies` / `buildStdioToolRuntime` — higher-level builders that compose state and dependency sets
- `buildServerStdioInfrastructure` / `buildServerStdioLifecycle` — server-level infrastructure and lifecycle builders
- `prepareStdioBootstrap` — resolves bootstrap config from environment before server creation
- `buildCliServerOptions` / `cliOptions` — CLI argument parsing utilities
- `executeStdioToolCall` / `resolveStdioToolCall` — tool call execution and routing on the STDIO path

## Usage

```typescript
import { startStdioServer } from '@serval/mcp-stdio';

await startStdioServer({
  initTelemetry: async () => { /* init OTEL */ },
  validateEnv: () => { /* check required env vars */ },
  verifyToolIntegrity: async () => { /* hash check */ },
  initialize: async () => { /* register handlers */ },
  shutdown: async () => { /* cleanup */ },
  startTransport: async () => { /* bind STDIO */ },
  getProcessBreadcrumbs: () => ({ version: '2.0.0' }),
  log: logger,
});
```

## Notes

Internal use only — private package, not published to npm. Startup phases are logged with `[Phase N/3]` prefixes. The `processLike` option accepts a mock process object for testing lifecycle without spawning a real process.
