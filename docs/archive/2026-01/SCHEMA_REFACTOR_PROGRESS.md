# MCP Schema Refactoring Progress

## Goal
Refactor tool input schemas to expose proper JSON Schema in `tools/list` response.

**Problem:** Every tool shows only `request*` parameter with no field descriptions in MCP clients.

**Root Cause:** All schemas wrap discriminated unions in `z.object({ request: ... })` envelope.

**Solution:** Unwrap schemas to expose fields at top level for proper MCP client UX.

---

## Refactoring Pattern

### ❌ Before (Wrong)
```typescript
const AuthActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status") }),
  z.object({ action: z.literal("login"), scopes: z.array(z.string()).optional() }),
  // ...
]);

export const SheetsAuthInputSchema = z.object({
  request: AuthActionSchema,  // ← Wrapper hides fields!
});
```

**JSON Schema Output:**
```json
{
  "type": "object",
  "properties": {
    "request": { /* ... */ }  // ← Only "request*" visible to clients
  },
  "required": ["request"]
}
```

### ✅ After (Correct)
```typescript
// Direct discriminated union (no wrapper)
export const SheetsAuthInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status").describe("Check authentication status"),
  }),
  z.object({
    action: z.literal("login").describe("Initiate OAuth login flow"),
    scopes: z.array(z.string()).optional().describe("Optional additional OAuth scopes to request"),
  }),
  // ...
]);
```

**JSON Schema Output:**
```json
{
  "anyOf": [
    {
      "type": "object",
      "properties": {
        "action": {
          "type": "string",
          "const": "status",
          "description": "Check authentication status"  // ← Descriptions visible!
        }
      },
      "required": ["action"]
    },
    // ... more branches
  ]
}
```

---

## Handler Updates Required

### ❌ Before
```typescript
async handle(input: SheetsAuthInput): Promise<SheetsAuthOutput> {
  const { request } = input;  // ← Unwrap request
  switch (request.action) {
    case "status": ...
    case "login": return await this.handleLogin(request);
  }
}

private async handleLogin(
  request: Extract<AuthAction, { action: "login" }>  // ← Old type
): Promise<AuthResponse> {
  const scopes = request.scopes;
}
```

### ✅ After
```typescript
async handle(input: SheetsAuthInput): Promise<SheetsAuthOutput> {
  // Input is the action directly (no wrapper)
  switch (input.action) {
    case "status": ...
    case "login": return await this.handleLogin(input);
  }
}

private async handleLogin(
  request: Extract<SheetsAuthInput, { action: "login" }>  // ← Use input type
): Promise<AuthResponse> {
  const scopes = request.scopes;
}
```

---

## Progress

### ✅ Completed (4/24)

| Tool | Schema | Handler | Tested | Notes |
|------|--------|---------|--------|-------|
| `sheets_auth` | ✅ | ✅ | ✅ | First tool refactored. Pattern established. |
| `sheets_values` | ✅ | ✅ | ✅ | 9 actions, all parameters visible |
| `sheets_spreadsheet` | ✅ | ✅ | ✅ | 8 actions (including list, batch_get, comprehensive) |
| `sheets_sheet` | ✅ | ✅ | ✅ | 7 actions (add, delete, duplicate, update, etc.) |

### 🔄 In Progress (0/24)

(none)

### ⏳ Remaining (23/24)

1. `sheets_spreadsheet`
2. `sheets_sheet`
3. `sheets_values`
4. `sheets_cells`
5. `sheets_format`
6. `sheets_dimensions`
7. `sheets_rules`
8. `sheets_charts`
9. `sheets_pivot`
10. `sheets_filter_sort`
11. `sheets_sharing`
12. `sheets_comments`
13. `sheets_versions`
14. `sheets_analysis`
15. `sheets_advanced`
16. `sheets_transaction`
17. `sheets_validation`
18. `sheets_conflict`
19. `sheets_impact`
20. `sheets_history`
21. `sheets_confirm` (MCP Elicitation)
22. `sheets_analyze` (MCP Sampling)
23. `sheets_fix`

---

## Testing Checklist (Per Tool)

After each refactor:

1. ✅ **TypeScript compiles:** `npx tsc --noEmit`
2. ✅ **Build succeeds:** `npm run build`
3. ✅ **Schema test passes:** `npx tsx scripts/show-tools-list-schemas.ts`
4. ✅ **Runtime test:** Call tool with MCP inspector or test script
5. ✅ **Fields visible:** Confirm `action` and other fields appear in tools/list

---

## Extraction Helpers Update

The following functions in `src/mcp/registration.ts` need updating after all schemas are refactored:

```typescript
// Current (supports both wrapped and unwrapped)
function extractAction(args: Record<string, unknown>): string {
  const request = args["request"] as Record<string, unknown> | undefined;
  if (request && typeof request["action"] === "string") {
    return request["action"];  // ← Old wrapper format
  }
  if (typeof args["action"] === "string") {
    return args["action"];  // ← New direct format
  }
  return "unknown";
}
```

**After all tools refactored:** Remove wrapper fallback logic, keep only direct access.

---

## Benefits of This Refactoring

1. ✅ **Better MCP Client UX**: All fields visible with autocomplete and validation
2. ✅ **Field Descriptions**: Clients can show inline help for each parameter
3. ✅ **Proper Discriminated Unions**: `anyOf` branches clearly show action options
4. ✅ **MCP Best Practice Compliance**: Follows spec for tool input schemas
5. ✅ **Future-proof**: No SDK-specific workarounds needed

---

## Next Steps

1. Refactor `sheets_values` (most used tool, good test case)
2. Refactor `sheets_sheet`, `sheets_spreadsheet` (core tools)
3. Continue with remaining 20 tools one by one
4. Update extraction helpers after all tools done
5. Add regression test to prevent future wrapping

---

**Last Updated:** 2026-01-08
**Progress:** 4/24 tools completed (17%) - PR #1 Ready!
