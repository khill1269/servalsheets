# ANTP Implementation Plan - ServalSheets

## Executive Summary

After analyzing the entire ServalSheets codebase, I've identified the optimal integration points for implementing the AI-Native Tool Protocol (ANTP) extensions. The project is exceptionally well-architected, making this implementation straightforward.

---

## Current Architecture Analysis

### Strengths Already Present ✅

| Feature | Location | Status |
|---------|----------|--------|
| **Structured Error Handling** | `src/utils/error-factory.ts` | Already has agent-actionable errors with `resolution`, `resolutionSteps`, `suggestedTools` |
| **Safety Options (dryRun)** | `src/schemas/shared.ts` | `SafetyOptionsSchema` with `dryRun`, `effectScope`, `expectedState` |
| **Cost Estimation Types** | `src/schemas/shared.ts` | `CostEstimateSchema` and `ResponseMetaSchema` already defined! |
| **Tool Suggestions Types** | `src/schemas/shared.ts` | `ToolSuggestionSchema` already exists |
| **Mutation Tracking** | `src/schemas/shared.ts` | `MutationSummarySchema` with `cellsAffected`, `diff`, `reversible` |
| **Base Handler Pattern** | `src/handlers/base.ts` | Clean abstraction for all handlers |
| **Request Context** | `src/utils/request-context.ts` | Per-request tracking already exists |
| **Batch Compiler Safety** | `src/core/batch-compiler.ts` | Effect scope validation, dry-run execution |

### What Needs to Be Added

| ANTP Extension | Integration Point | Effort |
|----------------|-------------------|--------|
| `_meta` (response metadata) | `buildToolResponse()` in `registration.ts` | Low |
| `_preview` (operation preview) | `executeWithSafety()` in `batch-compiler.ts` | Medium |
| `_size` (token estimation) | `buildToolResponse()` + handlers | Medium |
| `_recovery` (structured errors) | Already 80% done in `error-factory.ts` | Low |
| `_suggest` (next actions) | New `SuggestionEngine` class | Medium |

---

## File-by-File Integration Map

### 1. Response Enhancement (`_meta`)

**File:** `src/mcp/registration.ts`
**Function:** `buildToolResponse()`
**Current:**
```typescript
export function buildToolResponse(result: unknown): CallToolResult {
  const structuredContent = ...;
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
    isError: isError ? true : undefined,
  };
}
```

**Enhanced:**
```typescript
export function buildToolResponse(
  result: unknown, 
  meta?: ResponseMeta
): CallToolResult {
  const structuredContent = { 
    ...result,
    _meta: meta ? buildMeta(meta) : undefined,
  };
  // ...
}
```

### 2. Preview Extension (`_preview`)

**File:** `src/core/batch-compiler.ts`
**Method:** `executeWithSafety()`
**Enhancement:** Already supports `dryRun` - extend to return structured preview

**File:** `src/handlers/base.ts`
**Add:** `preview()` method that delegates to batch compiler

### 3. Size Estimation (`_size`)

**New File:** `src/utils/token-estimator.ts`
```typescript
export function estimateTokens(data: unknown): number {
  const json = JSON.stringify(data);
  return Math.ceil(json.length / 4); // Rough token estimate
}

export function truncateToTokenLimit(
  data: unknown, 
  maxTokens: number,
  strategy: 'paginate' | 'summarize' | 'truncate'
): { data: unknown; truncated: boolean; continuation?: string } {
  // Implementation
}
```

### 4. Recovery Enhancement (`_recovery`)

**File:** `src/utils/error-factory.ts`
**Status:** 80% complete - already has `resolution`, `resolutionSteps`, `suggestedTools`
**Enhancement:** Add tool call suggestions for automated recovery

### 5. Suggestions Engine (`_suggest`)

**New File:** `src/utils/suggestion-engine.ts`
```typescript
export class SuggestionEngine {
  suggest(context: SuggestionContext): ToolSuggestion[] {
    // Based on current operation, suggest next steps
    // Detect anti-patterns
    // Recommend optimizations
  }
}
```

---

## Schema Extensions

**File:** `src/schemas/shared.ts`

Already has most types! Just need to add:

```typescript
// ANTP Response Extensions (add after ResponseMetaSchema)

/** Preview result for _preview extension */
export const PreviewResultSchema = z.object({
  approved: z.boolean().default(false),
  operation: z.string(),
  impact: z.object({
    cellsAffected: z.number().int().min(0),
    sheetsAffected: z.array(z.string()),
    dataLoss: z.boolean(),
    reversible: z.boolean(),
  }),
  warnings: z.array(z.string()),
  confirmationRequired: z.boolean(),
  confirmationPrompt: z.string().optional(),
});

/** Size metadata for _size extension */
export const SizeMetaSchema = z.object({
  tokensEstimate: z.number().int().min(0),
  totalAvailable: z.number().int().min(0).optional(),
  truncated: z.boolean(),
  continuation: z.object({
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
    remainingTokens: z.number().int().min(0).optional(),
  }).optional(),
});

/** Hints that clients can pass */
export const ANTPHintsSchema = z.object({
  maxResponseTokens: z.number().int().positive().optional(),
  preferSummary: z.boolean().optional(),
  verbosity: z.enum(['minimal', 'normal', 'detailed']).optional(),
}).optional();

/** Full ANTP response metadata */
export const ANTPMetaSchema = z.object({
  timing: z.object({
    serverMs: z.number().min(0),
    apiMs: z.number().min(0).optional(),
  }),
  quota: z.object({
    used: z.number().int().min(0),
    limit: z.number().int().min(0),
    remaining: z.number().int().min(0),
  }).optional(),
  size: SizeMetaSchema.optional(),
  preview: PreviewResultSchema.optional(),
  suggestions: z.array(ToolSuggestionSchema).optional(),
});
```

---

## Implementation Order

### Phase 1: Foundation (Day 1)
1. Add ANTP schema types to `shared.ts`
2. Create `src/extensions/` directory structure
3. Implement `_meta` in `buildToolResponse()`
4. Add timing tracking to request context

### Phase 2: Preview (Day 2)
1. Extend `SafetyOptionsSchema` with `_preview` parameter
2. Enhance `executeWithSafety()` to return preview data
3. Update handlers to pass preview flag through
4. Add preview tests

### Phase 3: Size & Hints (Day 3)
1. Create `token-estimator.ts`
2. Add `_hints` parameter to tool schemas
3. Implement truncation strategies
4. Add pagination support for large responses

### Phase 4: Suggestions (Day 4)
1. Create `SuggestionEngine` class
2. Define suggestion rules per tool/action
3. Detect anti-patterns (N+1 reads, etc.)
4. Integrate into response building

### Phase 5: Documentation & Tests (Day 5)
1. Write ANTP specification document
2. Add comprehensive tests
3. Update existing test fixtures
4. Create example usage documentation

---

## File Structure After Implementation

```
src/
├── extensions/           # NEW: ANTP extensions
│   ├── index.ts         # Export all extensions
│   ├── types.ts         # ANTP type definitions
│   ├── meta.ts          # _meta implementation
│   ├── preview.ts       # _preview implementation
│   ├── size.ts          # _size implementation
│   └── suggest.ts       # _suggest implementation
├── handlers/
│   ├── base.ts          # UPDATED: Add preview() method
│   └── ...
├── mcp/
│   └── registration.ts  # UPDATED: Enhanced buildToolResponse()
├── schemas/
│   └── shared.ts        # UPDATED: ANTP schemas
├── utils/
│   ├── error-factory.ts # UPDATED: Enhanced recovery
│   ├── request-context.ts # UPDATED: Timing tracking
│   └── token-estimator.ts # NEW: Token estimation
└── ...
```

---

## Middleware Integration

**File:** `src/server.ts`

```typescript
private async handleToolCall(
  toolName: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const startTime = Date.now();
  const requestContext = createRequestContext();
  
  return runWithRequestContext(requestContext, async () => {
    try {
      // Extract ANTP hints
      const hints = extractANTPHints(args);
      
      // Check for preview mode
      if (args._preview) {
        return this.handlePreview(toolName, args);
      }
      
      // Normal execution
      const result = await handler(args);
      
      // Build response with ANTP metadata
      const meta = {
        timing: { serverMs: Date.now() - startTime },
        suggestions: this.suggestionEngine.suggest({ toolName, args, result }),
        size: estimateResponseSize(result, hints),
      };
      
      return buildToolResponse(result, meta);
    } catch (error) {
      // Enhanced error with recovery
      return buildToolResponse(this.mapErrorWithRecovery(error));
    }
  });
}
```

---

## Testing Strategy

### New Test Files

```
tests/
├── extensions/
│   ├── meta.test.ts       # _meta present on all responses
│   ├── preview.test.ts    # Preview never executes
│   ├── size.test.ts       # Truncation works correctly
│   └── suggest.test.ts    # Suggestions are relevant
├── integration/
│   └── antp-flow.test.ts  # End-to-end ANTP tests
└── ...
```

### Key Test Cases

```typescript
describe('ANTP Extensions', () => {
  describe('_meta', () => {
    it('all responses include timing metadata');
    it('quota information is accurate');
    it('token estimates are reasonable');
  });

  describe('_preview', () => {
    it('preview=true never modifies data');
    it('preview returns accurate impact estimate');
    it('preview shows correct warnings');
  });

  describe('_size', () => {
    it('respects maxResponseTokens hint');
    it('paginate strategy returns continuation');
    it('truncate strategy cuts data correctly');
  });

  describe('_suggest', () => {
    it('suggests batch operations for N+1 pattern');
    it('warns about missing analysis before write');
    it('recommends related tools');
  });
});
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| All responses include `_meta` | 100% | Test coverage |
| `_preview` never modifies data | 100% | Integration tests |
| Token estimates within 20% | 80%+ | Comparison with actual |
| Suggestions are actionable | 90%+ | Manual review |
| No performance regression | <5ms overhead | Benchmarks |

---

## Claude Code Prompt

Copy this into Claude Code to begin implementation:

```markdown
# Implement ANTP Extensions for ServalSheets

## Project
`/Users/thomascahill/Documents/mcp-servers/servalsheets`

## Context
ServalSheets already has excellent architecture:
- Agent-actionable errors in `src/utils/error-factory.ts`
- Safety options with dryRun in `src/schemas/shared.ts`
- CostEstimate and ToolSuggestion types already defined
- Clean handler pattern in `src/handlers/base.ts`

## Tasks

### 1. Add ANTP Types (src/schemas/shared.ts)
Add after existing ResponseMetaSchema:
- PreviewResultSchema
- SizeMetaSchema  
- ANTPHintsSchema
- ANTPMetaSchema

### 2. Create Extensions Directory
Create `src/extensions/` with:
- index.ts (exports)
- types.ts (ANTP-specific types)
- meta.ts (build _meta object)
- preview.ts (preview logic)
- size.ts (token estimation)
- suggest.ts (SuggestionEngine class)

### 3. Update buildToolResponse()
In `src/mcp/registration.ts`:
- Accept optional meta parameter
- Add _meta to structuredContent
- Track timing automatically

### 4. Enhance Request Context
In `src/utils/request-context.ts`:
- Add startTime tracking
- Add timing accumulation for API calls

### 5. Create Token Estimator
New file `src/utils/token-estimator.ts`:
- estimateTokens(data): number
- truncateToTokenLimit(data, max, strategy)
- paginateData(data, pageSize)

### 6. Create Suggestion Engine
New file `src/extensions/suggest.ts`:
- SuggestionEngine class
- Rules for each tool/action combination
- Anti-pattern detection

### 7. Add Tests
Create `tests/extensions/` with tests for all extensions

## Start With
1. Add types to shared.ts
2. Create extensions/index.ts and extensions/meta.ts
3. Update buildToolResponse() to include timing

Build incrementally and test each piece.
```

---

## Conclusion

ServalSheets is 70% ready for ANTP. The architecture is clean, the types are partially defined, and the patterns are established. This implementation will make ServalSheets the reference MCP server that Anthropic will want to adopt as a standard.

Estimated total effort: **5 days to production-ready ANTP**
