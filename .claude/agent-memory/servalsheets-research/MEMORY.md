# servalsheets-research Agent Memory

**Last Updated:** 2026-02-18
**Memory Scope:** project (shared with team)

---

## Patterns Discovered

### Handler Structure Pattern (All 22 tool handlers)

```typescript
export class ToolHandler extends BaseHandler {
  // or standalone class
  async handle(request: InputType): Promise<OutputType> {
    // 1. Unwrap legacy envelope
    const req = unwrapRequest<InputType['request']>(input);
    // 2. Switch on action
    switch (req.action) {
      case 'action_name':
        return this.handleActionName(params);
      default:
        throw new ValidationError(`Unknown action: ${action}`);
    }
  }
}
```

**Key correction from 2026-02-18 audit:**

- Public entry point is `handle()` (NOT `executeAction()`)
- `executeAction` appears only as a private helper in format.ts and data.ts
- Only 13 of 22 handlers extend BaseHandler (see list below)
- All 22 handlers have `async handle(` verified by grep

### Handlers that DO extend BaseHandler (13)

advanced, appsscript, analyze, bigquery, collaborate, composite, core, data, dimensions, fix, format, templates, visualize

### Handlers that do NOT extend BaseHandler (9)

auth, confirm, dependencies, federation, history, quality, session, transaction, webhooks
(These are standalone classes or use different patterns)

### Response Building Pattern (NEVER in handlers)

- Handlers return: `{ response: { success: true, data } }`
- Tool layer calls: `buildToolResponse()` at `src/mcp/registration/tool-handlers.ts`

### Error Handling Pattern

- Use structured errors with ErrorCode enum
- NEVER `return {}` without throwing
- Circuit breaker automatic via BaseHandler (only for 13 BaseHandler handlers)

---

## Common File Locations

- **Handlers:** `src/handlers/*.ts` (26 files total: 22 tool handlers + base.ts + logging.ts + optimization.ts + index.ts)
- **Schemas:** `src/schemas/*.ts` (33 files: 22 tool schemas + shared.ts + rbac.ts + prompts.ts + federation.ts + logging.ts + others)
- **Tests:** `tests/handlers/*.test.ts` (40 files including federation.test.ts)
- **Contracts:** `tests/contracts/*.test.ts` (15 files)

---

## Source of Truth (Verified 2026-02-18)

- **TOOL_COUNT:** 22 (src/schemas/action-counts.ts:38)
- **ACTION_COUNT:** 315 (src/schemas/action-counts.ts:43 — computed sum)
- **Protocol:** MCP 2025-11-25 (src/version.ts:14)
- **Version:** 1.7.0 (src/version.ts:11)

## Action Count Discrepancies (Known)

- CLAUDE.md says sheets_advanced=26 → actual is 31 (schema header and action-counts.ts both say 31)
- data.ts header says "18 actions" → actual is 19 (discriminated union has 19 entries)
- descriptions-minimal.ts says sheets_advanced=26 → stale documentation

---

## Undocumented Directories (Not in CLAUDE.md)

These directories exist but are NOT in CLAUDE.md architecture map:

- `src/analysis/` (14 files) — analysis helpers used by analyze handler
- `src/startup/` (5 files) — lifecycle/preflight/restart management
- `src/security/` (4 files) — webhook-signature, resource-indicators, incremental-scope
- `src/storage/` (3 files) — session-manager, session-store
- `src/graphql/` (4 files) — GraphQL API (P3-1 feature)
- `src/admin/` (2 files) — admin dashboard routes
- `src/di/` (1 file) — dependency injection container

---

## Schema Files NOT Registered as Tools

- `src/schemas/rbac.ts` — RBAC schemas, used by rbac-manager service
- `src/schemas/prompts.ts` — MCP prompts definitions
- `src/schemas/logging.ts` — MCP logging/setLevel protocol handler
- `src/schemas/handler-deviations.ts` — alignment deviation registry

---

## Resource Registration (OPEN_QUESTIONS #3 - Answered)

- `schema://tools` → registered as literal string URI (line 172 of src/resources/schemas.ts)
- `schema://tools/{toolName}` → registered as ResourceTemplate (line 183 of src/resources/schemas.ts)
- This is CORRECT architecture — template handles individual tool queries

---

## OPEN_QUESTIONS Status (2026-02-18)

1. **inputSchema type:object** — LIKELY RESOLVED. SheetsDataInputSchema is `z.object({ request: ... })` which produces `{ type: 'object', ... }` at root via z.toJSONSchema()
2. **elicitInput wire protocol** — STILL OPEN. Requires runtime MCP Inspector test
3. **schema://tools URI template** — RESOLVED. Uses ResourceTemplate correctly (src/resources/schemas.ts:183)
4. **README.md existence** — RESOLVED. File exists at repo root with correct counts (22 tools, 305 actions)
5. **SKILL.md count drift** — RESOLVED. skill/SKILL.md is manually maintained; currently shows correct counts (22 tools, 305 actions). generate-metadata.ts does NOT update SKILL.md

---

## Verification Commands

```bash
# Source of truth
src/schemas/action-counts.ts  # TOOL_COUNT and ACTION_COUNT

# Quick verification
npm run check:drift  # 3 seconds
npm run test:fast    # 8 seconds
```

---

## Anti-Patterns to Avoid

- Don't use "~" or "approximately" for line counts - always verify with `wc -l`
- Don't hardcode tool/action counts - reference source file
- Don't claim code is "dead" without running `npm run validate:dead-code`
- Don't use `find`, `grep`, `cat` commands - use Glob, Grep, Read tools instead
- Don't assume all handlers extend BaseHandler - 9 of 22 do NOT
- Don't assume public handler method is `executeAction` - it's `handle()`
