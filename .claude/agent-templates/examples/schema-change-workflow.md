# Complete Workflow Example: Schema Change

**Scenario:** Add new `timeout` parameter to all 25 tool schemas

**Estimated Time:** 60 minutes
**Estimated Cost (Optimized):** $11.40
**Estimated Cost (All Opus):** $70.00
**Savings:** 84%

---

## Agent 1: Research Existing Patterns (Haiku)

**Cost:** ~$0.10 | **Time:** 5 minutes

```typescript
Task({
  subagent_type: 'Explore',
  model: 'haiku',
  description: 'Research timeout patterns (5min)',
  prompt: `
    Research how timeouts are currently handled:

    1. Search for existing timeout parameters:
       - grep -r "timeout" src/schemas/
       - Check if any schemas already have timeout
       - Look at src/handlers/base.ts for timeout handling

    2. Find similar optional parameters:
       - Look for other optional parameters in schemas
       - Identify the z.optional() pattern usage
       - Check validation patterns (min/max values)

    3. Analyze Google API timeout behavior:
       - Check src/services/google-api.ts
       - Identify where timeout will be applied in code
       - Document current default timeout (if any)

    Output:
    - Current timeout handling (if exists)
    - Common optional parameter patterns
    - Where timeout will be applied in code
    - Recommended default/max values
  `,
});
```

**Expected Output:**

````markdown
# Timeout Pattern Research

## Current State

- No explicit timeout parameters in schemas
- Default timeout: 30s (from Google API client config)
- Applied at: src/services/google-api.ts:42

## Optional Parameter Pattern

All optional parameters follow this pattern:

```typescript
z.object({
  requiredParam: z.string(),
  optionalParam: z.string().optional(),
});
```
````

## Recommendations

- timeout?: number (milliseconds)
- Default: 30000 (30s)
- Min: 1000 (1s)
- Max: 300000 (5min)
- Validation: z.number().min(1000).max(300000).optional()

## Similar Code

Found in sheets_core.ts (lines 42-67): maxRetries optional parameter
Found in sheets_data.ts (lines 15-30): valueRenderOption optional parameter

````

---

## Agent 2: API Best Practices Review (Sonnet)

**Cost:** ~$3.00 | **Time:** 10 minutes

```typescript
Task({
  subagent_type: 'Google API Expert',
  model: 'sonnet',
  description: 'Validate timeout approach (10min)',
  prompt: `
    Review the timeout parameter approach for Google Sheets API compliance:

    1. Check Google API timeout recommendations:
       - Does Google Sheets API have timeout limits?
       - What are typical timeout values in the wild?
       - Any API-specific guidance?

    2. MCP protocol compliance:
       - Does MCP 2025-11-25 have timeout guidance?
       - Should timeout be per-action or global?
       - Precedent: How do other MCP servers handle timeouts?

    3. Implementation concerns:
       - Should timeout apply to all 25 tools or specific ones?
       - Which operations actually benefit from custom timeout?
         (Long-running: BigQuery exports, Apps Script execution)
       - Quick operations: Read/write don't need custom timeout

    4. Fallback strategy:
       - If user specifies timeout but operation exceeds it, what happens?
       - Should we warn when timeout is very low (< 5s)?
       - Should we auto-extend timeout for known long-running ops?

    Output:
    - Recommended default timeout per operation type
    - Which tools should support timeout parameter
    - Circuit breaker interaction with timeout
    - Deprecation strategy (if changing existing behavior)
  `,
});
```

**Expected Output:**

````markdown
# Google API + MCP Timeout Review

## API Timeout Limits

- Google Sheets API: Default 30s, max 60s
- BigQuery API: No hard timeout (can run hours)
- Apps Script API: 30min max execution time

## Recommendation

Timeout should be optional per-action:
- Default: 30000ms (match Google default)
- Min: 5000ms (prevent too-aggressive timeouts)
- Max: 600000ms (10 min, reasonable upper bound)

## Apply to Which Tools?

Yes: sheets_bigquery, sheets_appsscript, sheets_analyze (long-running analysis)
Optional: All others (unnecessary overhead)
No: Authentication actions (must complete)

## Circuit Breaker Interaction

- Circuit breaker timeout: 30s (existing)
- User timeout: Applied per-request
- If both exceeded: Return circuit breaker error (prioritize)

## Deprecation

No breaking change:
- timeout is new optional parameter
- Existing code continues to work
- No deprecation needed
````

---

## Agent 3: Implementation (Sonnet)

**Cost:** ~$8.00 | **Time:** 30 minutes

```typescript
Task({
  subagent_type: 'servalsheets-implementation',
  model: 'sonnet',
  description: 'Implement timeout parameter (30min)',
  prompt: `
    Implement timeout parameter across schemas and handlers:

    1. Schema Changes (src/schemas/*.ts):
       - Add timeout?: z.number().min(5000).max(600000).optional() to 10 tool schemas
       - Tools: sheets_bigquery, sheets_appsscript, sheets_analyze, sheets_core,
         sheets_data, sheets_composite, sheets_visualize, sheets_format,
         sheets_dimensions, sheets_advanced
       - Run npm run schema:commit after changes

    2. Handler Changes (src/handlers/*.ts):
       - Extract timeout from request params in 10 handlers
       - Pass to executeWithRetry() options: { timeoutMs: timeout ?? DEFAULT_TIMEOUT }
       - Example: src/handlers/bigquery.ts (already long-running)

    3. Service Changes (src/services/google-api.ts):
       - Add timeoutMs: number to GoogleApiCallOptions
       - Implement timeout enforcement in executeWithRetry()
       - Use AbortController if timeout exceeded

    4. Tests (tests/handlers/*.test.ts):
       - Test timeout parameter accepted (success path)
       - Test timeout parameter validated (error: < 5000ms, > 600000ms)
       - Test request completes within timeout

    5. Verification:
       - npm run schema:commit
       - npm run test:fast (all 2253 tests pass)
       - npm run verify:safe (G0-G5 gates pass)

    Output:
    - Files changed (with line counts)
    - Test coverage report
    - Verification results
  `,
});
```

**Expected Output:**

````markdown
# Implementation Complete

## Schema Changes

- src/schemas/bigquery.ts: +1 line (timeout param)
- src/schemas/appsscript.ts: +1 line
- src/schemas/analyze.ts: +1 line
- src/schemas/core.ts: +1 line
- src/schemas/data.ts: +1 line
- src/schemas/composite.ts: +1 line
- src/schemas/visualize.ts: +1 line
- src/schemas/format.ts: +1 line
- src/schemas/dimensions.ts: +1 line
- src/schemas/advanced.ts: +1 line

Total schema changes: 10 files, +10 lines

## Handler Changes

- src/handlers/bigquery.ts: +2 lines (extract + pass timeout)
- src/handlers/appsscript.ts: +2 lines
- ... (8 more handlers: +2 lines each)

Total handler changes: 10 files, +20 lines

## Service Changes

- src/services/google-api.ts: +15 lines (timeout enforcement)

Total: 21 files changed, ~45 lines added

## Tests

- New tests: 20 (2 per tool: success + validation error)
- All tests: 2253/2253 passing
- Coverage: 100% of timeout code paths

## Verification (npm run verify:safe)

✅ G0: check:drift (no metadata changes needed)
✅ G1: check:placeholders (0 TODOs)
✅ G2: check:debug-prints (0 console.log)
✅ G3: check:silent-fallbacks (no silent errors)
✅ G4: test:fast (2253/2253 pass)
✅ G5: typecheck (0 errors)

Ready to commit!
````

---

## Agent 4: Code Review (Sonnet)

**Cost:** ~$0.30 | **Time:** 5 minutes

```typescript
Task({
  subagent_type: 'code-review-orchestrator',
  model: 'sonnet',
  description: 'Pre-commit review (5min)',
  prompt: `
    Review timeout implementation for:
    1. Type safety: All timeout values typed as number, validated with Zod
    2. Error handling: Timeout errors use typed ErrorCode (TIMEOUT_ERROR)
    3. Backwards compatibility: timeout is optional, no breaking changes
    4. Test quality: Assertions are specific (not tautological)
    5. Documentation: Handler methods updated with JSDoc?

    Approve or request changes.
  `,
});
```

**Expected Output:**

````markdown
# Code Review: APPROVED ✅

## Checks Passed

✅ Type Safety: All timeout params typed as number | undefined
✅ Error Handling: TIMEOUT_ERROR added to ErrorCodeSchema
✅ Backwards Compatibility: timeout? parameter (optional)
✅ Test Quality: 20 tests cover success + validation error paths
✅ Documentation: Handler methods updated with JSDoc

## Minor Suggestions

1. Consider adding rate-limit guidance to JSDoc
   ("Timeout is per-request, not cumulative across retries")
2. Document default timeout value in server instructions

These are optional improvements; code is ready to commit.
````

---

## Cost Breakdown

| Agent                   | Model  | Time   | Cost    | Task                                 |
| ----------------------- | ------ | ------ | ------- | ------------------------------------ |
| Research Patterns       | Haiku  | 5 min  | $0.10   | Find existing patterns, defaults     |
| API Best Practices      | Sonnet | 10 min | $3.00   | Google API + MCP compliance review  |
| Implementation          | Sonnet | 30 min | $8.00   | Schema/handler/service changes      |
| Code Review             | Sonnet | 5 min  | $0.30   | Pre-commit validation               |
| **TOTAL (Optimized)**   |        |        | **$11.40** | **Multi-specialist approach**    |
| **TOTAL (All Opus)**    |        |        | **$70.00** | **Single agent approach (wasteful)** |
| **Savings**             |        |        | **84%** | **6x cost reduction**               |

---

## Key Takeaways

1. **Specialist agents save money:** Haiku for reads ($0.10), Sonnet for implementation ($3-8)
2. **Parallel execution:** Research + API review could run simultaneously (add 1 session, save overall time)
3. **Sequential dependency:** Implementation must follow research (needs pattern knowledge)
4. **Final review is quick:** Code review (5 min, $0.30) catches issues before commit
5. **Total cost: $11.40** for 60 min of specialized work (vs $70 for all-Opus approach)

---

## Lessons for Your Own Workflows

- Use **Haiku for reads/searches** (fast, cheap)
- Use **Sonnet for complex work** (implementation, review, architecture)
- **Research first** (5 min, $0.10) → saves implementation time
- **Review last** (5 min, $0.30) → prevents rework
- **Run in parallel** when independent (research + API review simultaneously)
- **Verify gates run** (npm run verify:safe) before committing
