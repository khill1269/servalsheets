# MCP Protocol Compliance Report — ServalSheets

> Protocol: MCP 2025-11-25 | Audit Date: 2026-05-12 | SDK: @modelcontextprotocol/sdk v1.29.0 | Grade: A+

## Verdict: FULLY COMPLIANT (with two cosmetic gaps)

ServalSheets implements the full MCP 2025-11-25 specification across all six core capabilities (Tools, Resources, Prompts, Sampling, Elicitation, Tasks). Verified end-to-end against the published spec and the @modelcontextprotocol/sdk v1.29.0 runtime. Two non-blocking cosmetic gaps remain: prompt icons (SDK-side limitation, P21-D1) and the optional `icon.theme` field (intentionally omitted for theme-agnostic SVGs).

## Protocol Version

- Declared: `'2025-11-25'` at `src/constants/protocol.ts:6` (`MCP_PROTOCOL_VERSION`)
- Re-exported via `src/version.ts:21` for SERVER_INFO
- Matches the current production protocol version published by modelcontextprotocol.io

## Server Identity (serverInfo)

`SERVER_INFO` at `src/version.ts:24-31` declares the full 2025-11-25 identity surface:

- `name: 'servalsheets'` — stable identifier (`src/version.ts:25`)
- `title: 'ServalSheets'` — human-readable display name (`src/version.ts:26`)
- `version: '2.0.0'` — sourced from `VERSION` at `src/version.ts:18`
- `protocolVersion: '2025-11-25'` — `src/version.ts:28`
- `description` — dynamically composed using `TOOL_COUNT`/`ACTION_COUNT` from `src/generated/action-counts.ts` (no hardcoded counts) — `src/version.ts:29`
- `websiteUrl: 'https://github.com/khill1269/servalsheets'` — `src/version.ts:30`
- `icons: SERVER_ICONS` (inline SVG data URI) — `src/version.ts:34-40`

The `icon.theme` field is **deliberately omitted** because the inline SVG renders correctly under both light and dark UI themes. Per spec, `theme` is optional and clients MUST treat its absence as theme-agnostic.

## Tools

- **TOOL_COUNT = 25**, **ACTION_COUNT = 410** (computed from `src/generated/action-counts.ts:42,47` — sum of the `ACTION_COUNTS` map)
- Tools are registered via `server.registerTool()` in `src/server.ts` and `src/mcp/registration/`
- Each tool exposes a top-level `icons: Icon[]` field (NOT nested in `annotations`) — matches the spec's `Tool` interface
- Annotations use the `Hint` suffix per SEP-986 (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) — sourced from `src/generated/annotations.ts`
- `outputSchema` declared on all 25 tools (verified by contract suite `tests/contracts/mcp-wire-output-contract.test.ts`)
- Name format complies with SEP-986 (1–128 chars, `A-Za-z0-9_-.`)

## Resources

- **13 resources** registered via `server.registerResource()` in `src/mcp/registration/resource-registration.ts`
- All resources now carry `icons` metadata — verified at `src/mcp/registration/resource-registration.ts:575` (`icons: RESOURCE_ICONS['spreadsheet']`) and analogous entries for the remaining 12 templates
- ResourceTemplates support per-variable completion (`spreadsheetId`, `range`) — `src/mcp/registration/resource-registration.ts:562-565`
- Subscriptions enabled (`resources.subscribe: true` in capabilities)

## Prompts

- **40 prompts** registered via `server.registerPrompt()` in `src/mcp/registration/prompt-registration.ts:67-…`
- **Gap (P21-D1):** Prompts currently lack `icons`. The SDK's `registerPrompt()` accepts `icons` in its TypeScript signature but strips them from the wire-format payload at runtime. Tracked as cosmetic — does not affect functional compliance. See "Compliance Gaps" below.

## Elicitation

ServalSheets supports both **form mode** (default) and **URL mode** (SEP-1036) per spec.

Schema migration from plain `enum` to titled `oneOf` (clearer client UX, preserves backward-compat JSON Schema semantics):

- `chartType`
- `delimiter`
- `focus`
- `direction`
- `mode`

Schemas already using `selectField()` helper (titled `oneOf` from initial implementation):

- `sheets_core.create`
- `sheets_format.add_conditional_format_rule`

Remaining plain-`enum` schema: `sheets_analyze.scout` (dynamic enum populated at runtime — lower priority).

URL-mode elicitation is wired for OAuth and API-key connector flows via `sheets_connectors.configure`.

## Tasks (experimental, SEP-1686)

- `capabilities.tasks` declared in `createServerCapabilities()` at `src/mcp/features-2025-11-25.ts:366-374` with `list`, `cancel`, and nested `requests.tools.call` support
- Tools opt in via the ServalSheets `taskSupport` annotation field (`'optional' | 'required' | 'forbidden'`):
  - `sheets_analyze` — `'optional'`
  - `sheets_federation` — `'optional'`
  - `sheets_agent` — `'optional'`
- Task-mode messages include the `_meta["io.modelcontextprotocol/related-task"] = { taskId }` envelope per spec

## Server Instructions (LLM Orientation)

`getServerInstructions()` at `src/mcp/features-2025-11-25.ts:418` is returned in the `initialize` response `instructions` field. Content (dynamically assembled):

- **5-group mental model** with verb triggers for each tool group
- **Mandatory startup sequence**: auth → get_context → set_active
- **Error self-correction (TAER)**: reads `error.recovery`, `error.alternativeActions`, `error.diagnosticSteps` (corrected from stale field names `fixableVia`/`_learnedFix`/`suggestedRecoveryActions`)
- **Advanced capabilities**: Sampling guidance (declare `sampling` capability for AI-powered analysis); Tasks guidance (declare `tasks` capability for background execution)
- **Deferred schema appendix** (injected when `SERVAL_DEFER_SCHEMAS=true`)

## Sampling

- `sampling/createMessage` requests are gated by `assertSamplingConsent()` before every call
- Reachability is monitored by `SamplingHealthProbe` (`src/services/sampling-health-probe.ts`) which now includes the `model` field on probe responses
- Startup log line emits the probed `model` alongside reachability state
- `tools` + `toolChoice` (SEP-1577) supported in `createAgenticRequest()` builder

## Notifications

- `notifications/tools/list_changed` wire format verified against SDK source (`node_modules/@modelcontextprotocol/sdk@1.29.0/dist/esm/server/mcp.js`)
- `resources.listChanged: true` declared unconditionally — `src/mcp/features-2025-11-25.ts:360`
- `tools.listChanged: true` declared conditionally on `SERVAL_STAGED_REGISTRATION` — `src/mcp/features-2025-11-25.ts:395`. Disabled-staged builds omit the capability to avoid spurious change notifications.

## Discovery Endpoints

Implemented in `src/server/well-known.ts`:

- `/.well-known/mcp.json` — primary discovery (`src/server/well-known.ts:5`)
- `/.well-known/mcp/server-card.json` — SEP-2127 Server Cards format
- `/.well-known/oauth-authorization-server` (RFC 8414)
- `/.well-known/oauth-protected-resource` (RFC 9728)

SEP reference updated from the superseded **SEP-1649** to **SEP-2127 (draft)** at `src/server/well-known.ts:5,14`. As of 2026-05-12 SEP-2127 remains an open, unmerged PR (`https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127`); ServalSheets is forward-compatible with the proposed format.

The previously broken `$schema` URL (which 404'd) has been removed from the server-card payload to avoid client-side schema-resolution failures.

## Compliance Gaps (non-blocking)

1. **Prompt icons (P21-D1)** — SDK gap. `McpServer.registerPrompt()` accepts `icons` in its TypeScript signature but discards them when serializing the wire response. Fix requires an upstream change in `@modelcontextprotocol/sdk`. ServalSheets stores the canonical icon data and will surface it once the SDK ships the fix.
2. **`icon.theme` field omitted** — Intentional. The inline server SVG (`src/config/server-icon.ts`) is theme-agnostic; emitting `theme: 'light'` or `'dark'` would falsely constrain rendering. Per spec, `theme` is optional.

## Test Coverage

- **B1** — Stale `dist/` detection (build-output drift sentinel)
- **B2** — `initialize` wire-shape contract (verifies serverInfo, capabilities, protocolVersion)
- **B3** — `tools/list` wire-shape contract (verifies top-level `icons`, `outputSchema`, annotation Hint suffix)
- **B4** — Sampling probe assertions (model field, circuit-breaker behavior, 5-min cache TTL)
- **C1** — End-to-end live protocol probe wired as `npm run test:mcp:protocol:full` (`scripts/live-probe.mjs`)

Run the full protocol suite with:

```bash
npm run validate:mcp-protocol
npm run test:mcp:protocol:full
```

---

**Auditor:** MCP Protocol Specialist Agent
**Spec Reference:** modelcontextprotocol.io 2025-11-25
**SDK Pinned Version:** @modelcontextprotocol/sdk@1.29.0 (`node_modules/@modelcontextprotocol/sdk/package.json:3`)
