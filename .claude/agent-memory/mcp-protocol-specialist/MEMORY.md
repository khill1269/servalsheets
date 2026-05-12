# MCP Protocol Specialist Memory

## Index
- [tool_discovery_landscape.md](tool_discovery_landscape.md) — `defer_loading` is Anthropic-API only (NOT MCP); SEP-1862/2127/1960 status; tool-arg completion gap

## UPDATE 2026-04-29 — Latest MCP State (Web-Verified)

1. **Latest spec version: 2025-11-25** — no draft revision exists yet. Roadmap last updated 2026-03-05.
2. **SDK: `@modelcontextprotocol/sdk@^1.29.0`** — ServalSheets is at latest. Released ~April 2026.
3. **No `ref/tool` in completion spec** — `ref/prompt` and `ref/resource` only. SEP-1862 (`tools/resolve`) is the closest active proposal but not merged.
4. **`defer_loading` is an Anthropic Messages API field, NOT MCP** — Wire format: `"defer_loading": true` on tool entries in Messages API. Tool search tool types: `tool_search_tool_regex_20251119`, `tool_search_tool_bm25_20251119`. ServalSheets's `x-defer-loading` is custom and unread by MCP clients.
5. **SEP-2127 (was SEP-1649)** = MCP Server Cards via `/.well-known/mcp/server-card.json`. Open PR, draft.
6. **2026 Roadmap priorities:** Transport scalability, Agent communication, Governance, Enterprise readiness. Tool discovery is "On the Horizon" only.
7. **Active SEPs to watch:** SEP-1862 (tools/resolve), SEP-2127 (server cards), SEP-1960 (well-known manifest), SEP-1932 (DPoP), SEP-1933 (Workload Identity Federation), SEP-2133 (experimental-ext- repos).

## Counts (2026-04-28)

- Tools: **25** · Actions: **409** · Source: `src/generated/action-counts.ts`
- Annotations: `src/generated/annotations.ts` (was `src/schemas/annotations.ts`)
- Tool name max: **128 chars** per SEP-986
- JSON Schema default: **2020-12** in 2025-11-25 spec

## Compliance Audit (2026-02-25) — Still Valid

**Overall: 16/17 COMPLIANT, 1 WARNING**

Key files:
- Protocol version: `src/constants/protocol.ts:6` (re-exported `src/version.ts:15`)
- Server capabilities: `src/mcp/features-2025-11-25.ts:315-348`
- Tool registration: `src/server.ts:429-543`
- Tool definitions: `src/mcp/registration/tool-definitions.ts` — all 25 tools have `outputSchema`
- Response builder: `src/mcp/registration/tool-handlers.ts:626-821` (buildToolResponse)
- Sampling: `src/mcp/sampling.ts`
- Completions: `src/mcp/completions.ts`

### Known Deviations

1. **Non-fatal error suppression** (WARNING, by design) — `tool-handlers.ts:130-144` returns `isError: undefined` for recoverable errors with `_meta.nonFatalError: true` marker. Strict spec says `isError: true` for any failed tool execution.

2. **Sampling toolChoice format** — `sampling.ts:1322` uses `toolChoice: { type: 'auto' }`. SDK type expects `{ mode: 'auto' | 'required' | 'none' }`. Code casts via `as` to silence TS. Only affects `createAgenticRequest()` builder; not on hot path.

### Architecture Patterns (Confirmed Stable)

1. Dual annotation sources (per-schema + centralized) — may intentionally diverge
2. `normalizeToolArgs()` legacy envelope wrapping at `tool-handlers.ts:862-895`
3. Output validation is advisory (logs warnings, never blocks)
4. Response size management: >100KB → temp resource with preview
5. Sampling consent gate: `assertSamplingConsent()` before every `createMessage()`

## ServalSheets Tool-Discovery Status

- `sheets_discover` tool = server-side natural-language search (ServalSheets-specific, not MCP-spec)
- `x-defer-loading: true` extension = custom; no MCP client reads it
- `SERVAL_TOOL_MODE=auto` = flat for STDIO (Claude Desktop), bundled for HTTP — sound choice
- **Gap:** no `/.well-known/mcp/server-card.json` endpoint (SEP-2127 not merged yet, but useful for HTTP transport even pre-merge)
- **Gap:** Anthropic Messages API consumers wiring through `src/http-server.ts` could benefit from server-emitted hints to set `defer_loading: true` on the action-bundled tools — currently no such bridge

---
**Last Verified:** 2026-04-29 (web research session) | **Tools:** 25 | **Actions:** 409 | **SDK:** 1.29.0 | **Protocol:** 2025-11-25
