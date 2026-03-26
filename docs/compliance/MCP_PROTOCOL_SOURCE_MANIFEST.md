# MCP Protocol Source Manifest

> Tracks which MCP specification sections are implemented and where the source lives.

| MCP Feature | Spec Section | Source File(s) | Status |
|---|---|---|---|
| tools/list | §5.6.1 | `src/mcp/registration/tool-definitions.ts` | ✅ |
| tools/call | §5.6.2 | `src/mcp/registration/tool-handlers.ts` | ✅ |
| resources/list | §5.7.1 | `src/resources/` | ✅ |
| resources/read | §5.7.2 | `src/resources/` | ✅ |
| prompts/list | §5.8.1 | `src/mcp/registration/prompt-definitions.ts` | ✅ |
| prompts/get | §5.8.2 | `src/mcp/registration/prompt-handlers.ts` | ✅ |
| sampling | §5.9 | `src/mcp/sampling.ts` | ✅ |
| elicitation | §5.10 | `src/mcp/elicitation.ts` | ✅ |
| completions | §5.11 | `src/mcp/completions.ts` | ✅ |
| logging | §5.12 | `src/server/logging-bridge-utils.ts` | ✅ |
| notifications | §5.13 | `src/resources/notifications.ts` | ✅ |
| tasks | §5.14 | `src/server/create-stdio-task-handler.ts` | ✅ |
| OAuth 2.1 | §4.2 | `src/handlers/auth.ts`, `src/auth/` | ✅ |
| Structured Output | §5.6.3 | `src/mcp/registration/output-schemas.ts` | ✅ |
| Tool Annotations | §5.6.4 | `src/mcp/registration/tool-annotations.ts` | ✅ |
| HTTP Transport | §4.1 | `src/http-server.ts`, `packages/mcp-http/` | ✅ |
| stdio Transport | §4.0 | `src/server/create-stdio-server.ts` | ✅ |

## Protocol Version

Current: **2025-11-25** (see `src/mcp/features-2025-11-25.ts`)

---
*Auto-maintained. Last updated: 2026-03-25.*
