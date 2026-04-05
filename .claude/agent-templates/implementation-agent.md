# TDD Implementation Template

**Model:** Sonnet (implementation)  
**Time:** 30-60 min per action  
**Focus:** Schema → Handler → Tests → Verify

## When to Use This Template

- Adding new actions to existing tools
- Fixing bugs that require code changes
- Implementing features with clear specification
- Decomposing large handlers into submodules

## Prompt Structure

### Setup

```markdown
# TDD Implementation: [Action Name]

**Tool:** [sheets_tool]
**Action:** [new_action_name]
**Estimated Lines:** ~[X] lines of code

**Specification:**
- Input params: [list]
- Output: [describe]
- Error cases: [list]

**Precedent:** Found similar action at [file:line] — use as implementation pattern

**Workflow:**
1. Schema first (discriminated union)
2. Run npm run schema:commit
3. Handler method + dispatch case
4. Tests (success + 2-3 error paths)
5. npm run verify:safe
```

### Phase 1: Schema (5 min)

Agent adds to `src/schemas/{tool}.ts`:

```typescript
// Identify existing discriminated union
export const Sheets{Tool}ActionSchema = z.discriminatedUnion('action', [
  // ... existing actions ...
  
  // ADD HERE
  z.object({
    action: z.literal('new_action'),
    spreadsheetId: SpreadsheetIdSchema,
    // ... other params
  }),
]);
```

**Validation:**
- Params match specification
- All required params present
- Optional params use `.optional()`
- Enums use `z.enum([...])` not strings

### Phase 2: Schema Commit (2 min)

```bash
npm run schema:commit
```

This regenerates:
- `src/schemas/action-counts.ts` (ACTION_COUNT updated)
- `src/generated/annotations.ts`
- `src/mcp/completions.ts`
- `server.json`

### Phase 3: Handler Method (15 min)

**Prompt:**

```markdown
# Handler Implementation

Tool: sheets_core (BaseHandler subclass)
Action: new_action

Add to src/handlers/core.ts:

1. Case in switch statement:
```typescript
case 'new_action': {
  const result = await this.handleNewAction(req);
  return result; // BaseHandler.success() returns MCP format
}
```

2. Private handler method following pattern at core.ts:123 (line number example):
```typescript
private async handleNewAction(req: NewActionInput): Promise<NewActionOutput> {
  // 1. Validate business rules (Zod already ran)
  // 2. Confirm if destructive: await this.confirmDestructiveAction(...)
  // 3. Snapshot if destructive: await this.createSnapshotIfNeeded(...)
  // 4. Execute: const result = await this.context.cachedApi.method(...)
  // 5. Return: return this.success('new_action', result, isMutation);
}
```

Notes:
- isMutation = true if action modifies data
- Use this.context.cachedApi for reads (cached)
- Use executeWithRetry() for Google API calls
- All errors must be typed (no generic Error)
```

**Output Format:**

```
Handler method added to src/handlers/core.ts at line 250 (example)
Case statement added at line 85 (example)
Total handler lines: +22 lines
```

### Phase 4: Tests (15 min)

**Prompt:**

```markdown
# Test Implementation

Add to tests/handlers/core.test.ts:

1. Success path (should pass with valid input):
```typescript
describe('new_action', () => {
  test('success: creates resource', async () => {
    const req = {
      request: {
        action: 'new_action',
        spreadsheetId: TEST_SPREADSHEET_ID,
        // ... other params
      },
    };

    const result = await handler.handle(req);

    expect(result.response.success).toBe(true);
    expect(result.response.action).toBe('new_action');
    expect(result.response.data).toEqual({
      id: 'expected_id',
      // ... other fields
    });
  });
});
```

2. Error path 1 (validation error):
```typescript
test('error: validation fails on invalid input', async () => {
  const req = {
    request: {
      action: 'new_action',
      spreadsheetId: '', // Invalid: empty
    },
  };

  const result = await handler.handle(req);

  expect(result.response.success).toBe(false);
  expect(result.response.error?.code).toBe('VALIDATION_ERROR');
});
```

3. Error path 2 (resource not found):
```typescript
test('error: fails when resource not found', async () => {
  const req = {
    request: {
      action: 'new_action',
      spreadsheetId: 'nonexistent_id',
    },
  };

  const result = await handler.handle(req);

  expect(result.response.success).toBe(false);
  expect(result.response.error?.code).toBe('SPREADSHEET_NOT_FOUND');
});
```

Criteria:
- Tests use envelope format: { request: { action, ... } }
- Assertions are specific (not .toContain([true, false]))
- Fixtures are deterministic (no Math.random())
- Error assertions check error code
```

**Output Format:**

```
Tests added to tests/handlers/core.test.ts
Lines 450-480: success test
Lines 481-495: validation error test
Lines 496-510: not found error test
Total test lines: +60 lines
Test coverage: 3/3 paths tested (success + 2 error cases)
```

### Phase 5: Verification (10 min)

**Prompt:**

```markdown
# Verification Checklist

Run these commands:

1. npm run schema:commit (regenerate metadata)
2. npm run test:fast (run unit + contract tests)
3. npm run verify:safe (full verification: typecheck + test + drift)

Report:
- Errors found: [list]
- Tests passing: [count]/2253
- TypeScript errors: [count]
- Drift check: [pass/fail]
- Ready to commit: [yes/no]
```

**Expected Output:**

```markdown
# Verification Results ✅

✅ npm run schema:commit
   - Metadata regenerated
   - ACTION_COUNT: 408 → 409 (new action added)

✅ npm run test:fast
   - Tests passing: 2253/2253
   - New tests: 3 (all passing)

✅ npm run verify:safe
   - TypeScript: 0 errors
   - Drift: No metadata drift
   - Ready to commit
```

## Cost Estimate

**Per-action TDD cost:**
- Schema: 5 min ($0.15)
- Handler: 15 min ($0.50)
- Tests: 15 min ($0.50)
- Verification: 5 min ($0.15)
- **Total: 40 min, $1.30 per action**

**For 10 actions (typical feature):**
- Cost: ~$13
- Time: ~7 hours
- Quality: 100% test coverage

## Common Pitfalls & Fixes

### Pitfall 1: Forgetting schema:commit

**Symptom:** Tests fail with "unknown action" error  
**Cause:** Schema changed but metadata not regenerated  
**Fix:** `npm run schema:commit`

### Pitfall 2: Non-deterministic tests

**Symptom:** Test passes sometimes, fails other times  
**Cause:** Math.random() in fixture data  
**Fix:** Use deterministic sequence:

```typescript
// ❌ Wrong
const data = Array.from({ length: 100 }, () => Math.random());

// ✅ Right
const data = Array.from({ length: 100 }, (_, i) => (i + 1) * 10);
```

### Pitfall 3: Tautological assertions

**Symptom:** Test passes even when handler is broken  
**Cause:** Assertion doesn't test specific value  
**Fix:** Assert specific expected value:

```typescript
// ❌ Wrong
expect([true, false]).toContain(response.success);

// ✅ Right
expect(response.success).toBe(true);
```

### Pitfall 4: Wrong response format

**Symptom:** Tests pass but handler returns wrong MCP format  
**Cause:** BaseHandler vs Standalone handler mismatch  
**Fix:** BaseHandler returns `this.success()`; standalone returns `{ response: { ... } }`

## Checklist Before Committing

- [ ] Schema added to discriminated union
- [ ] `npm run schema:commit` ran successfully
- [ ] Handler method added with 5-step pattern
- [ ] Case statement added to switch
- [ ] 3+ test cases added (success + errors)
- [ ] All tests passing (2253/2253)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No console.log (`npm run check:debug-prints`)
- [ ] No TODO/FIXME (`npm run check:placeholders`)
- [ ] `npm run verify:safe` all green
