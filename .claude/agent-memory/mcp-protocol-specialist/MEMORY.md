# MCP Protocol Specialist Memory

## Audit Results (2026-02-18) -- MCP 2025-11-25 Compliance

**Overall: COMPLIANT** with 2 warnings and 4 informational findings.

### Key File Locations

- Protocol version: `src/version.ts:14` (MCP_PROTOCOL_VERSION = '2025-11-25')
- Duplicate declaration: `src/schemas/shared.ts:22` (same value, should import from version.ts)
- Server capabilities: `src/mcp/features-2025-11-25.ts:315-348`
- Tool definitions: `src/mcp/registration/tool-definitions.ts:155-350` (22 tools)
- Tool handler map: `src/mcp/registration/tool-handlers.ts:275-493`
- Response builder: `src/mcp/registration/tool-handlers.ts:610-799`
- tools/list compat: `src/mcp/registration/tools-list-compat.ts:48-91`
- Tool naming validation: `src/mcp/registration/tool-handlers.ts:1342-1349`
- Annotations: `src/schemas/annotations.ts:15-173`
- Action counts (source of truth): `src/schemas/action-counts.ts`
- server.json: `server.json` (registry metadata)

### Known Issues

1. **server.json instructions contradict runtime** -- says "NEVER wrap in request" but normalizeToolArgs() supports it
2. **Duplicate MCP_PROTOCOL_VERSION** -- declared in both version.ts:14 and shared.ts:22
3. **CLAUDE.md has stale action counts** -- sheets_advanced says 26 (actual: 31), sheets_data says 18 (actual: 19)

### Response Pattern (Verified)

- `buildToolResponse()` always returns `{ content: [TextContent], structuredContent: Record, isError?: true | undefined }`
- `isError: true` for failures, `undefined` (not false) for success -- matches MCP convention
- Non-fatal errors (VALIDATION_ERROR, PERMISSION_DENIED, etc.) set isError=undefined with \_meta.nonFatalError marker
- Stack traces stripped from error responses before serialization (security)

### Transport Compliance

- STDIO: `src/server.ts:1225` -- StdioServerTransport
- SSE: `src/http-server.ts:1866` -- SSEServerTransport (with deprecation headers)
- Streamable HTTP: `src/http-server.ts:2104` -- StreamableHTTPServerTransport (current standard)
- All use official SDK transport classes from @modelcontextprotocol/sdk v1.26.0

### Capability Declaration Pattern

- Server declares: tasks, logging, completions, experimental (tools/prompts/resources auto-registered by SDK)
- Server does NOT declare: elicitation, sampling (these are CLIENT capabilities -- correct per spec)
- Documented at: `src/mcp/features-2025-11-25.ts:305-313`

### Schema Registration Pattern

- Deferred mode (DEFER_SCHEMAS=true): Flat property-list schemas with z.enum for actions (~3K tokens)
- Full mode: Zod schemas converted to JSON Schema by SDK
- Ref mode (SCHEMA_REFS=true): Pre-converted with $defs for shared types (~60% reduction)
- tools/list handler wraps discriminated unions to ensure type:"object" always present

---

**Last Updated:** 2026-02-18
