---
name: Tool Discovery Landscape (2026-04-29)
description: Current state of tool discovery / deferred loading in MCP — distinguishes Anthropic API features from MCP protocol features
type: reference
---

# Tool Discovery Landscape (verified 2026-04-29)

## Anthropic API `defer_loading` (NOT MCP)

- **Where it lives:** Anthropic Messages API only (`api.anthropic.com/v1/messages`)
- **Wire format:** `"defer_loading": true` on each tool entry in the Messages API `tools` array
- **Tool search tool types:** `tool_search_tool_regex_20251119`, `tool_search_tool_bm25_20251119`
- **Constraints:** at least one tool MUST have `defer_loading: false` (else 400); cannot combine with `cache_control` on same tool
- **Threshold guidance:** trigger when 10+ tools or >10K tokens of definitions
- **Returns:** `tool_reference` blocks (3-5 per search) auto-expanded inline
- **Source:** https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool

## MCP Protocol Status

**No native equivalent exists in MCP 2025-11-25.** Active proposals:

| SEP | Title | Status | Relevance |
|-----|-------|--------|-----------|
| SEP-1862 | Tool Resolution (`tools/resolve`) | Open PR, draft | Closest analog — runtime-refined annotations per arguments |
| SEP-2127 | Server Cards (`.well-known/mcp/server-card.json`) | Open PR, draft (renamed from SEP-1649) | Pre-connect discovery; static metadata only |
| SEP-1960 | `.well-known/mcp` manifest | Open issue | Competing approach to SEP-2127 |
| Roadmap "Result Type Improvements" | Reference-based results | On the horizon | Streaming + reference results for large payloads |

## ServalSheets Custom Extension

- `x-defer-loading: true` — **custom JSON Schema extension**, not from MCP spec
- File: `src/config/constants.ts` `DEFER_DESCRIPTIONS` toggle uses minimal descriptions
- File: `src/handlers/discover.ts` (or similar) — `sheets_discover` tool = ServalSheets-specific search
- **No MCP client reads `x-defer-loading`** — it's harmless extra JSON but provides zero protocol-level deferred loading

## What ServalSheets Should Do

1. **Keep `sheets_discover`** — useful as a server-side search tool; clients can call it explicitly
2. **Document `x-defer-loading` as proprietary** — make clear it's not MCP-standard
3. **Add Anthropic Messages API integration guidance** — tell HTTP/Remote consumers how to wire `defer_loading: true` when forwarding to Claude
4. **Watch SEP-1862** — if `tools/resolve` lands, refactor to use it for runtime annotation refinement
5. **Watch SEP-2127** — implement `/.well-known/mcp/server-card.json` for HTTP transport when merged

## Tool-Argument Completion Gap

- MCP draft spec supports `ref/prompt` and `ref/resource` ONLY for `completion/complete`
- **No `ref/tool` exists.** Calls with `ref/tool` will return `-32602 Invalid params` per spec
- ServalSheets's `src/mcp/completions.ts` correctly limits to prompts/resources
- If tool-arg completion becomes a need, it must be done via `tools/call` with a discovery action (e.g. `sheets_discover` or `sheets_session.suggest`), not via `completion/complete`
