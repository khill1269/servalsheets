# servalsheets-research Agent Memory

**Last Updated:** 2026-02-17
**Memory Scope:** project (shared with team)

---

## Patterns Discovered

### Handler Structure Pattern (All 24 handlers follow this)
```typescript
export class ToolHandler extends BaseHandler {
  async executeAction(request: InputType): Promise<OutputType> {
    // 1. Unwrap legacy envelope
    const unwrapped = unwrapRequest(request);
    // 2. Extract discriminated union
    const { action, ...params } = unwrapped;
    // 3. Switch on action
    switch (action) {
      case 'action_name':
        return this.handleActionName(params);
      default:
        throw createValidationError(`Unknown action: ${action}`);
    }
  }
}
```

### Response Building Pattern (NEVER in handlers)
- Handlers return: `{ response: { success: true, data } }`
- Tool layer calls: `buildToolResponse()` at `src/mcp/registration/tool-handlers.ts:500+`

### Error Handling Pattern
- Use structured errors with ErrorCode enum
- NEVER `return {}` without throwing
- Circuit breaker automatic via BaseHandler

---

## Common File Locations

- **Handlers:** `src/handlers/*.ts` (24 files)
- **Schemas:** `src/schemas/*.ts` (24 files)
- **Tests:** `tests/handlers/*.test.ts` (23 files, missing: federation.test.ts)
- **Contracts:** `tests/contracts/*.test.ts` (667+ guarantees)

---

## Verification Commands

```bash
# Source of truth
src/schemas/action-counts.ts:38  # TOOL_COUNT = 23
src/schemas/action-counts.ts:43  # ACTION_COUNT = 299

# Line counts (verified 2026-02-17)
src/server.ts: 1383 lines
src/http-server.ts: 2402 lines
src/handlers/base.ts: 1605 lines

# Quick verification
npm run check:drift  # 3 seconds
npm run test:fast    # 8 seconds
```

---

## Research Shortcuts

**Find all handlers:**
```bash
Glob("src/handlers/*.ts")
```

**Search for pattern:**
```bash
Grep("executeAction", path="src/handlers/", output_mode="files_with_matches")
```

**Count actions in schema:**
```bash
Read("src/schemas/tool-name.ts") | grep "z.literal" | wc -l
```

---

## Anti-Patterns to Avoid

❌ Don't use "~" or "approximately" for line counts - always verify with `wc -l`
❌ Don't hardcode tool/action counts - reference source file
❌ Don't claim code is "dead" without running `npm run validate:dead-code`
❌ Don't use `find`, `grep`, `cat` commands - use Glob, Grep, Read tools instead
