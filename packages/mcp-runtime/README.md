# @serval/mcp-runtime

Transport-agnostic MCP runtime helpers and tool-call routing policy.

## Purpose

Provides the routing layer that decides whether a given tool call executes locally or on a remote executor, and on which transport it is permitted to run. Encodes the per-tool routing manifest (local / remote / prefer_local / disabled_on_stdio), exposes helpers for creating a base MCP server and runtime, and handles cancellation guard initialisation and runtime preflight checks.

## Key Exports

- `dispatchToolCall` — routes a tool call to `localExecute` or `remoteExecute` based on the resolved policy; generic over the return type
- `resolveExecutionTarget` — pure function that maps `(toolName, transport, hasRemoteExecutor, policy)` to `'local' | 'remote'`
- `getToolRoutePolicy` — returns the `ToolRoutePolicy` for a named tool
- `getTransportVisibleToolNames` — returns the subset of tool names visible on a given transport
- `listToolsByRouteMode` — groups all tool names by their route mode
- `validateToolRouteManifest` — checks the manifest for missing or extra tool entries; returns a `ToolRouteManifestValidation` result
- `getToolRoutingSummary` — returns counts per route mode for diagnostics
- `createMcpRuntime` — convenience factory that bundles all manifest helpers into a single object
- `createBaseMcpServer` — creates a base `McpServer` instance with standard capability flags
- `createRuntime` — composes the full runtime from injected dependencies
- `initializeCancellationGuard` — wires per-request abort signals to in-flight tool calls
- `asyncOnce` — utility for one-time async initialisation with shared in-flight deduplication
- `runRuntimePreflight` — validates environment and tool integrity before transport starts
- `ToolName`, `ToolRouteMode`, `ToolTransport`, `ToolRoutePolicy`, `ToolRouteSummary` — shared types

## Usage

```typescript
import { dispatchToolCall, resolveExecutionTarget } from '@serval/mcp-runtime';

const result = await dispatchToolCall({
  toolName: 'sheets_analyze',
  transport: 'streamable-http',
  localExecute: () => localHandler.handle(args),
  remoteExecute: () => remoteExecutor.call('sheets_analyze', args),
});
```

## Notes

Internal use only — private package, not published to npm. The routing manifest in `tool-route-manifest.ts` enumerates all 25 ServalSheets tools and must be kept in sync with the tool registry whenever tools are added or removed.
