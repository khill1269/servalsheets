---
title: ServalSheets — Full Optimization & Evaluation Brief
category: development
last_updated: 2026-04-27
description: Comprehensive briefing for AI-driven deep evaluation, best-practice research, and implementation of all identified improvements across MCP protocol, LLM usability, AI patterns, Google API, schemas, security, and performance.
---

# ServalSheets — Full Optimization & Evaluation Brief

> **Instructions for the evaluating AI:**
> This document is your complete briefing. Read it fully before executing anything.
> Work in this order: (1) Verify claims with grep/read commands, (2) Research best practices from official docs, (3) Implement fixes in priority order, (4) Run verification commands after each fix.
> Every claim in this document has a `Verify:` command. Run it before acting on any finding.
> Use the two-phase audit protocol: Phase 1 = gather evidence only, Phase 2 = interpret evidence only.

---

## Part 0 — Project Context

### What ServalSheets Is

Production-grade MCP (Model Context Protocol) server for Google Sheets. Everything the Google Sheets API can do, exposed as MCP tools for LLM agents.

```
25 tools | 409 actions | MCP 2025-11-25 | TypeScript/Node.js strict | v2.0.0
```

### Current Verified State

```bash
# Run to confirm current baseline
npm run test:fast          # Should: 81 files, 1849 tests, all pass
npm run typecheck          # Should: 0 errors
npm run check:drift        # Should: 25 tools, 409 actions synchronized
npm run lint               # Should: 0 warnings
```

### Source of Truth Files

| Metric | File | Line |
|---|---|---|
| TOOL_COUNT (25) | `src/generated/action-counts.ts` | :42 |
| ACTION_COUNT (409) | `src/generated/action-counts.ts` | :47 |
| Protocol Version | `src/constants/protocol.ts` | :6 |
| Package Version | `package.json` | :4 |
| SDK Version | `package.json` | dependencies |

### Architecture Pipeline

```
STDIO/HTTP Request
  → src/server.ts (MCP entrypoint)
  → src/mcp/registration/tool-handlers.ts:createToolCallHandler() [26-step middleware]
  → src/handlers/{tool}.ts:executeAction()
  → src/services/google-api.ts:executeWithRetry()
  → Google Sheets/Drive API v4/v3
```

### Handler Architecture (Verified)

- **13 extend BaseHandler:** advanced, analyze, appsscript, bigquery, collaborate, composite, core, data, dimensions, fix, format, templates, visualize
- **12 standalone:** agent, auth, compute, confirm, connectors, dependencies, federation, history, quality, session, transaction, webhooks

---

## Part 1 — MCP Protocol 2025-11-25 Compliance

### Research Directive

Before implementing any fixes, fetch and read:
- `https://modelcontextprotocol.io/specification/2025-11-25/changelog`
- `https://modelcontextprotocol.io/specification/2025-11-25/server/tools`
- `https://modelcontextprotocol.io/specification/2025-11-25/server/sampling`
- `https://github.com/modelcontextprotocol/modelcontextprotocol` — Check open/merged PRs for new SEPs

**Research Questions:**
1. Are there any SEPs merged after SEP-1686 (Tasks) that we haven't implemented?
2. Has SEP-1303 (input validation as tool execution error) been finalized? What exactly does it require?
3. What is the correct `ref/resource` completion response format per spec?
4. Is `notifications/prompts/list_changed` required when prompts are static?
5. What is the `Implementation` object `description` field format and requirements?
6. Are there any new OAuth-related SEPs (SEP-835, SEP-991) that apply to our server?
7. What does the spec say about `stopSequences` in sampling requests?

### Finding P-1: SEP-1303 — Input Validation as Tool Execution Error (WARNING)

**What:** Per MCP 2025-11-25 spec change, Zod validation errors from `parseForHandler()` may currently surface as JSON-RPC `-32602 InvalidParams` instead of `CallToolResult{isError:true}`. The spec now requires validation errors to be tool execution errors so LLMs can self-correct.

**Verify:**
```bash
grep -n "parseForHandler\|ZodError\|safeParse\|z\.ZodError" src/mcp/registration/tool-handlers.ts | head -20
# Look at line ~563 where parseForHandler throws
sed -n '555,575p' src/mcp/registration/tool-handlers.ts
```

**Expected Fix:**
```typescript
// In the catch block around parseForHandler() call
} catch (err) {
  if (err instanceof z.ZodError) {
    return buildToolResponse({
      response: {
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: `Input validation failed: ${err.issues.map(i =>
            `${i.path.join('.')}: ${i.message}`).join('; ')}`,
          suggestedFix: 'Check the action schema for correct parameter names and types.',
          retryable: true,
          category: 'client',
        }
      }
    }, { isError: true });
  }
  throw err;
}
```

**Files to modify:** `src/mcp/registration/tool-handlers.ts`
**Research:** Verify current spec requirement at modelcontextprotocol.io — behavior may already be handled by SDK 1.29.0

---

### Finding P-2: Missing `description` on `Implementation` object (INFO)

**What:** `SERVER_INFO` in `src/version.ts` lacks `description` field added in 2025-11-25.

**Verify:**
```bash
grep -n "SERVER_INFO\|name.*servalsheets\|description" src/version.ts | head -10
```

**Fix:**
```typescript
// src/version.ts
export const SERVER_INFO = {
  name: 'servalsheets',
  version: VERSION,
  protocolVersion: MCP_PROTOCOL_VERSION,
  description: 'Production-grade MCP server for Google Sheets — 25 tools, 409 actions, MCP 2025-11-25',
} as const;
```

---

### Finding P-3: `ref/resource` Completion Returns Empty (WARNING)

**What:** `src/server/control-plane-registration.ts:180` returns `{values:[]}` for `ref/resource` without logging why. The spec defines this as a standard completion ref type.

**Verify:**
```bash
sed -n '175,195p' src/server/control-plane-registration.ts
# Check what resource URIs we have registered
grep -rn "registerResource\|server\.resource\b" src/resources/ --include="*.ts" | head -10
```

**Research Questions:**
1. Does the spec require `ref/resource` to return matching resource URIs?
2. What format should resource URI completions be in?
3. Should we return spreadsheet IDs, sheet names, or full resource URIs?

**Expected Fix:** Either return relevant resource URIs (spreadsheet IDs from session context) or document why empty is correct.

---

### Finding P-4: Missing SEPs to Investigate

**Verify each:**
```bash
# SEP-991: OAuth Client ID Metadata Documents
grep -rn "oauth-client-id\|client.*metadata\|well-known.*oauth-client" src/ --include="*.ts" | head -5
# Expected: no results

# SEP-835: Incremental scope consent
grep -rn "WWW-Authenticate\|incremental.*scope\|scope.*consent" src/ --include="*.ts" | head -5
# Expected: no results

# OIDC Discovery
grep -rn "openid-configuration\|oidc.*discovery\|/.well-known/openid" src/ --include="*.ts" | head -5

# stopSequences in sampling
grep -rn "stopSequences\|stop_sequences" src/ --include="*.ts" | head -5
# Expected: no results — investigate if should be used
```

**Research Questions:**
1. Are SEP-991 and SEP-835 required for MCP registry submission or just optional?
2. What is the exact format of `stopSequences` in sampling requests? What values are useful?
3. For JSON/code generation sampling calls, what `stopSequences` would bound output correctly?

---

### Finding P-5: `notifications/prompts/list_changed` Never Sent

**Verify:**
```bash
grep -rn "prompts.*list.*changed\|list_changed.*prompt\|sendPromptListChanged" src/ --include="*.ts" | head -5
grep -n "listChanged.*prompts\|prompts.*listChanged" src/mcp/features-2025-11-25.ts | head -5
```

**Research:** Does the spec require this notification when prompts are registered statically at startup? Or only when prompts change dynamically?

---

## Part 2 — LLM Usability Improvements

### Research Directive

Before implementing, research:
- `https://docs.anthropic.com/en/docs/build-with-claude/tool-use` — Latest tool use best practices
- `https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering` — Latest prompting guidance
- `https://modelcontextprotocol.io/docs/concepts/tools` — MCP tool description best practices
- Search: "MCP tool description LLM usability best practices 2025 2026"
- Search: "Zod schema describe LLM agent best practices"

**Research Questions:**
1. What is the optimal tool description format for current Claude models (Sonnet 4.6)?
2. How many tokens should a typical action `.describe()` use for best LLM routing?
3. What patterns in tool descriptions most reliably cause Claude to choose the right tool?
4. Are there any new Claude features (computer use, extended thinking integration) that change how tools should be described?
5. What does Anthropic's latest guidance say about error messages for self-correction?

### Finding U-1: 4 Enums Missing `.describe()` (HIGH — 30 min fix)

**Verify:**
```bash
grep -n "FederationActionSchema\|WebhookActionsSchema\|WebhookEventTypeSchema" \
  src/schemas/federation.ts src/schemas/webhook.ts | head -20

# Check if describe() exists on these
grep -A3 "z\.enum\(\[" src/schemas/federation.ts | head -10
grep -A3 "WebhookActionsSchema\|WebhookEventTypeSchema" src/schemas/webhook.ts | head -15

# Check connector operator enum
grep -n "operator.*z\.enum\|z\.enum.*eq.*neq" src/schemas/connectors.ts | head -5
```

**Fixes Needed:**

`src/schemas/federation.ts` — Add to `FederationActionSchema`:
```typescript
.describe(
  'Federation action. "call_remote": Execute a tool on remote MCP server (requires serverName, toolName). ' +
  '"list_servers": List all configured remote servers and connection status. ' +
  '"get_server_tools": Discover available tools on a remote server (requires serverName). ' +
  '"validate_connection": Test connectivity to a remote server (requires serverName).'
)
```

`src/schemas/webhook.ts` — Add to `WebhookActionsSchema`:
```typescript
.describe(
  'Webhook action. "register": Register webhook for change notifications. ' +
  '"unregister": Stop receiving notifications. "list": List all webhooks. ' +
  '"get": Get webhook details. "test": Send test event. "get_stats": Delivery statistics. ' +
  '"watch_changes": Enable real-time tracking via Pub/Sub. ' +
  '"subscribe_workspace"/"reactivate_workspace"/"unsubscribe_workspace"/"list_workspace_subscriptions": Workspace-level subscription lifecycle.'
)
```

`src/schemas/webhook.ts` — Add to `WebhookEventTypeSchema`:
```typescript
.describe(
  'Event type to receive. "sheet.update": Structure/metadata changes. ' +
  '"sheet.create"/"sheet.delete"/"sheet.rename": Tab lifecycle. ' +
  '"cell.update": Cell value changes. "format.update": Style/border changes. ' +
  '"all": Receive all event types.'
)
```

`src/schemas/connectors.ts` — Improve operator enum description:
```typescript
.describe(
  'Comparison operator: "eq" (equals), "neq" (not equals), "gt" (greater than), ' +
  '"lt" (less than), "gte" (>=), "lte" (<=), "contains" (substring), "starts_with" (prefix)'
)
```

---

### Finding U-2: `response_format` Should Be `responseFormat` (LOW — 5 min)

**Verify:**
```bash
grep -n "response_format\b" src/schemas/data.ts | head -5
# All other fields in data.ts use camelCase — this is the only snake_case field
```

**Fix:** `src/schemas/data.ts:115` — rename `response_format` → `responseFormat`

**Warning:** Update any handler code that reads this field:
```bash
grep -rn "response_format\b" src/handlers/ --include="*.ts" | head -10
```

---

### Finding U-3: 4 Missing Idempotence Warnings (HIGH — 30 min)

**Verify:**
```bash
grep -n "ACTION_GOTCHAS\|GOTCHAS\|gotcha" src/mcp/registration/response-intelligence.ts | head -10
sed -n '77,132p' src/mcp/registration/response-intelligence.ts
```

**Fixes:** Add to `ACTION_GOTCHAS` map in `src/mcp/registration/response-intelligence.ts`:

```typescript
'sheets_dimensions.insert': 'Inserting multiple rows? Always insert BOTTOM-TO-TOP — row indices shift after each insert. Insert at higher index first.',
'sheets_data.find_replace': 'Scans the ENTIRE specified range. For 1-2 known cells, sheets_data.write is faster and uses less quota.',
'sheets_history.restore_cells': 'WRITES old cell values immediately. Create a snapshot with sheets_collaborate.version_create_snapshot BEFORE restoring if you may want to undo.',
'sheets_collaborate.version_restore_revision': 'Restores the ENTIRE spreadsheet to a past state — irreversible without another restore. Use sheets_history.restore_cells for surgical cell recovery instead.',
```

---

### Finding U-4: SEP-1303 Enables LLM Self-Correction (HIGH — 1 hr)

*(See Part 1, Finding P-1 for implementation details)*

This is important for LLM usability: when the LLM passes wrong parameters, it currently gets a protocol-level error that it may not interpret correctly. Converting to `CallToolResult{isError:true}` gives the LLM a structured error with `suggestedFix` that guides it to correct the input.

---

### Finding U-5: Response Hints Only Fire on READ Operations (MEDIUM — 2-3 hrs)

**Verify:**
```bash
# Check where response hints are injected
grep -rn "generateResponseHints\|enhanceResponse\|_hints\|responseHints" \
  src/mcp/registration/ --include="*.ts" | head -20

# Check how many handler response paths call hint generation
grep -rn "generateResponseHints\|enhanceResponse" src/handlers/ --include="*.ts" | head -20
```

**Research Questions:**
1. What format should mutation response hints use? (cells_affected, formulas_recalculated, etc.)
2. What is the Claude API's recommended way to include structured hints in tool responses?
3. Are there performance concerns with running hint generation on every mutation?

**Expected Pattern:**
```typescript
// After successful write/format/dimension operations:
const hints = generateMutationHints({
  action,
  cellsAffected: result.updatedCells,
  formulasRecalculated: result.formulaCount,
  cascadeRisk: result.hasFormulaDependents,
});
if (hints.length > 0) result._hints = hints;
```

**Files to extend:**
- `src/services/response-hints-engine.ts` — Add `generateMutationHints()` function
- `src/handlers/data.ts` — Call for write, append, batch_write
- `src/handlers/format.ts` — Call for set_format, apply_preset
- `src/handlers/dimensions.ts` — Call for insert, delete, freeze

---

### Finding U-6: Minimal Description Mode Drops Too Much (MEDIUM — 1.5 hrs)

**Verify:**
```bash
wc -l src/schemas/descriptions-minimal.ts
wc -l src/schemas/descriptions.ts
# Compare one tool's description between files:
grep -A5 "sheets_data" src/schemas/descriptions.ts | head -10
grep -A5 "sheets_data" src/schemas/descriptions-minimal.ts | head -10
```

**Research Questions:**
1. What is the average token count difference between full and minimal descriptions?
2. What specific information (if dropped) causes the most routing errors in practice?
3. Should "NOT this tool — use X instead" cross-references always be preserved regardless of verbosity mode?

**Fix Strategy:**
- Always preserve: "3+ ranges → batch_*" decision guides
- Always preserve: "NOT this tool — use X instead" cross-references
- Always preserve: Common mistake warnings
- Drop: Extended examples, verbose parameter documentation
- Target: ~150 tokens per tool (vs 80 current minimal, 350+ full)

---

### Finding U-7: Tool Discovery Hints File Status

**Verify:**
```bash
wc -l src/mcp/registration/tool-discovery-hints.ts
head -30 src/mcp/registration/tool-discovery-hints.ts
# Check if it's populated or stub
grep -c "FEATURE_UNAVAILABLE\|Compatibility action" src/mcp/registration/tool-discovery-hints.ts
```

**Research Questions:**
1. What is the MCP spec's recommended format for tool categories/groupings?
2. Does the SDK expose any mechanism for tool metadata beyond annotations?
3. Should discovery hints be in prompts or in the tool description itself?

---

## Part 3 — AI Pattern Improvements

### Research Directive

Before implementing, research:
- `https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking` — Latest extended thinking API
- `https://docs.anthropic.com/en/api/messages` — Latest sampling API fields (budget_tokens, thinking block)
- `https://arxiv.org/abs/2303.11366` — Original Reflexion paper for implementation patterns
- Search: "MCP sampling best practices Claude 2025 2026 context enrichment"
- Search: "LLM tool use chain-of-thought injection server-side 2025"
- Search: "extended thinking Claude Sonnet 4 integration patterns"

**Research Questions:**
1. Is `budget_tokens` the correct field for extended thinking in Anthropic API 2026? Has the API changed?
2. What is the current Claude Sonnet 4.6 model's behavior with chain-of-thought prompts?
3. What sampling temperature produces best results for each task type (formula generation vs. data analysis vs. planning)?
4. Is there a recommended pattern for injecting spreadsheet context into sampling prompts?
5. How should reflexion prompts be structured for best validation accuracy?

### Finding A-1: No Extended Thinking on Complex Analysis (HIGH — 1-2 hrs)

**Verify:**
```bash
grep -rn "budget_tokens\|thinking.*enabled\|extended_thinking\|maxTokens" \
  src/mcp/sampling.ts src/handlers/analyze-actions/ --include="*.ts" | head -20

# Check what maxTokens values are currently used
grep -rn "maxTokens:" src/mcp/sampling.ts | head -20
```

**Research:** Verify the current Anthropic API syntax for extended thinking. As of 2026, the API may use:
```typescript
// Option A (if thinking blocks are supported):
thinking: { type: 'enabled', budget_tokens: 15000 }

// Option B (if model selection is the mechanism):
model: 'claude-opus-4-7'  // More capable model for complex tasks
```

**Targeted Actions:** `analyze_data`, `diagnose_errors`, `semantic_search`, `comprehensive`, `generate_formula`, `model_scenario`

**Implementation Pattern:**
```typescript
// src/services/sampling-helpers.ts (create if doesn't exist)
export function getSamplingConfig(taskType: 'planning' | 'analysis' | 'suggestion' | 'validation') {
  const configs = {
    planning:    { maxTokens: 2000, temperature: 0.3, budget_tokens: undefined },
    analysis:    { maxTokens: 4000, temperature: 0.2, budget_tokens: 15000 },  // complex
    suggestion:  { maxTokens: 1500, temperature: 0.7, budget_tokens: undefined },
    validation:  { maxTokens: 800,  temperature: 0.1, budget_tokens: undefined },
  };
  return configs[taskType];
}
```

---

### Finding A-2: Sampling Calls Lack Spreadsheet Context (HIGH — 2-3 hrs)

**Verify:**
```bash
# Find all createMessage() call sites
grep -rn "createMessage\|sampling\.createMessage\b" src/ --include="*.ts" | grep -v test | head -20

# Check if sampling-context-cache is being used at these sites
grep -rn "samplingContextCache\|getOrFetch\|SamplingContextCache" src/ --include="*.ts" | grep -v test | head -10
```

**Research Questions:**
1. What spreadsheet context is most useful for different sampling task types?
2. How should context be compressed to fit within token limits?
3. Is there a standard pattern for passing structured data context in sampling prompts?

**Implementation Pattern:**
```typescript
// Wrap all createMessage() calls with this pattern:
const ctx = spreadsheetId
  ? await getSamplingContext(spreadsheetId, samplingContextCache)
  : null;

const enrichedPrompt = ctx
  ? `${systemPrompt}\n\nSpreadsheet context:\n${formatContext(ctx)}`
  : systemPrompt;
```

**Files to update:** All 8 sampling call sites identified in audit.

---

### Finding A-3: CoT Hints Deployed in Only 2 of 25 Tools (HIGH — 2-3 hrs)

**Verify:**
```bash
cat src/services/response-hints-engine.ts | head -50
grep -rn "generateResponseHints\|responseHintsEngine\|_hints" \
  src/mcp/registration/response-intelligence.ts | head -20
grep -rn "generateResponseHints" src/handlers/ --include="*.ts" | head -10
```

**Research Questions:**
1. Are `_hints` in the response body read by Claude models? How are they weighted?
2. Should hints use a specific JSON schema format for best LLM parsing?
3. What is the maximum useful hint payload size before it becomes noise?

**Priority Extensions:**
1. `sheets_format.set_format` — "Formatted 847 cells across 3 ranges. 12 formula cells affected — check for unintended style changes."
2. `sheets_dimensions.insert` — "Inserted 3 rows at index 5. All row references in formulas below row 5 shifted +3."
3. `sheets_analyze.comprehensive` — Structural summary as structured data, not free text
4. `sheets_data.write` — "Written to 50 cells. 3 cells contained formulas (overwritten). 0 protected ranges affected."

---

### Finding A-4: Reflexion Not Applied to User-Directed Mutations (MEDIUM — 2-3 hrs)

**Verify:**
```bash
grep -rn "aiValidateStepResult\|validateResult\|reflexion" \
  src/services/agent/ --include="*.ts" | head -15

# Confirm reflexion is ONLY in agent paths
grep -rn "aiValidateStepResult" src/handlers/ --include="*.ts" | head -5
# Expected: 0 results — only in agent/plan-executor.ts
```

**Research Questions:**
1. What is the reflexion paper's recommendation for when to apply vs. skip validation?
2. What cost/latency tradeoff is acceptable for optional mutation validation?
3. Should `validateResult` be an opt-in parameter or enabled by default?

**Implementation Pattern:**
```typescript
// Add optional parameter to high-risk mutation schemas:
// src/schemas/data.ts — write, append, batch_write
validateResult: z.boolean().optional().describe(
  'If true, uses AI sampling to validate the write result for silent failures (formulas left as #ERROR!, partial writes, etc.). ' +
  'Adds ~1-2s latency. Recommended for critical data operations.'
),
```

---

### Finding A-5: Batch Operation Intelligence Missing (MEDIUM — 1-2 hrs)

**Verify:**
```bash
# Check session history tracking
grep -rn "sessionHistory\|lastOperations\|operationHistory" \
  src/services/session-context.ts | head -10

# Check response intelligence for batching suggestions
grep -n "BATCHING_HINTS\|batch.*suggest\|suggest.*batch" \
  src/mcp/registration/response-intelligence.ts | head -10
```

**Research Questions:**
1. What is the session history API surface? How many recent operations are tracked?
2. What threshold makes sense for batch suggestions (2 ops? 3? 5?)?
3. Is this better as a proactive hint or a reactive error recovery suggestion?

**Implementation Pattern:**
```typescript
// In response-intelligence.ts, after recording operation:
const recentSameAction = getRecentOperations(3).filter(
  op => op.tool === currentTool && op.action === currentAction
);
if (recentSameAction.length >= 3 && BATCHABLE_ACTIONS.has(`${currentTool}.${currentAction}`)) {
  hints.push({
    type: 'efficiency',
    message: `You've called ${currentTool}.${currentAction} ${recentSameAction.length} times. ` +
             `Use ${getBatchEquivalent(currentTool, currentAction)} to do all at once — same cost, 1 API call.`,
  });
}
```

---

### Finding A-6: No Constraint-Aware Planner Prompts (MEDIUM — 1-2 hrs)

**Verify:**
```bash
grep -n "compilePlanAI\|buildPlannerPrompt\|plannerSystemPrompt\|CONSTRAINTS" \
  src/services/agent/plan-compiler.ts | head -20
sed -n '195,250p' src/services/agent/plan-compiler.ts
```

**Research Questions:**
1. What are the most common LLM planning mistakes when working with Google Sheets APIs?
2. What is the best format for constraint injection (system prompt vs. user message vs. few-shot)?
3. Are there published benchmarks for constraint-aware planning accuracy?

**Constraints to Add:**
```
GOOGLE SHEETS API CONSTRAINTS (highest-priority gotchas):
- ALL indices are 0-BASED (API) but DISPLAYED as 1-based in UI — off-by-one is the #1 failure
- Writing to a cell with a formula returns success but may produce #ERROR! — always verify after write
- batchUpdate has a 10MB response size limit — check row count before batch operations on >50K rows
- After write, formulas recalculate asynchronously — do not read formula results immediately after write
- Inserting rows shifts ALL formula references below the insertion point
- NEVER use full-column references (A:Z) in batchGet — always bound with explicit rows (A1:Z1000)
- sheetId is numeric (integer) — always use the integer, never the sheet name, in batchUpdate requests
```

---

### Finding A-7: Workflow Templates Not Discoverable (LOW — 30 min)

**Verify:**
```bash
grep -n "WORKFLOW_TEMPLATES\|WorkflowTemplate" src/services/agent/ -r | head -10
# Check if list_plans exposes templates
grep -n "list_plans\|handleListPlans" src/handlers/agent.ts | head -5
grep -n "listPlans\|WORKFLOW_TEMPLATES" src/services/agent-engine.ts | head -10
```

**Fix:** When `list_plans` is called with no active plans, return the available workflow templates as `{ availableWorkflows: [...] }` so LLMs can discover and use them.

---

## Part 4 — Google Sheets/Drive API Gaps

### Research Directive

Before implementing, fetch and read:
- `https://developers.google.com/workspace/sheets/api/reference/rest/v4/changelog` — All changes since 2025-01-01
- `https://developers.google.com/workspace/sheets/api/guides/tables` — Full Tables API (April 2025)
- `https://developers.google.com/workspace/sheets/api/guides/chips` — Smart Chips API (June 2025 GA)
- `https://developers.google.com/workspace/drive/api/guides/manage-revisions` — Drive revisions
- `https://developers.google.com/workspace/events/guides` — Workspace Events API current state

**Research Questions:**
1. What new batchUpdate request types were added to Sheets API in 2025-2026?
2. Are Finance/Map/Calendar chips now writable via REST API? (As of April 2026)
3. What is the current status of native Sheets-level events in Workspace Events API? (Was in Developer Preview)
4. Are there any new quota limits or changes to the existing 300 req/min limits?
5. What new Drive API fields were added in 2025-2026 (itemDownloadRestriction, etc.)?
6. Does the Tables API now support `name` field on table creation? (Was missing in April 2025)
7. Are there any new Apps Script API capabilities we're missing?

### Finding G-1: BUG — `tableName` Silently Dropped from Google API (HIGH)

**Verify:**
```bash
grep -n "tableName\|name.*table\|addTable\|table.*name" \
  src/handlers/advanced-actions/tables.ts | head -20
sed -n '248,270p' src/handlers/advanced-actions/tables.ts
```

**Expected Fix:**
```typescript
// src/handlers/advanced-actions/tables.ts — inside addTable.table object
{
  range: gridRange,
  ...(req.tableName && { name: req.tableName }),  // Add this line
  columnProperties: req.columnProperties?.map(...),
}
```

**Note:** First verify via `WebFetch` that the Google Sheets API Tables endpoint currently accepts `name`. The April 2025 docs confirmed it, but check for updates.

---

### Finding G-2: MISSING — `update_dimension_group` Action (MEDIUM)

**Verify:**
```bash
# Builder exists but no schema/handler:
grep -rn "updateDimensionGroup\|update_dimension_group" src/ --include="*.ts" | head -10
grep -n "group\|ungroup\|collapse\|expand" src/schemas/dimensions.ts | head -10
```

**Research:** What does `updateDimensionGroup` do exactly? Does it change collapse state? What parameters does it take? Is it useful enough to expose?

**Implementation Needed:**
1. Add `update_dimension_group` to `src/schemas/dimensions.ts` discriminated union
2. Add handler case in `src/handlers/dimensions.ts`
3. Add to `src/services/cache-invalidation-graph.ts`
4. Run `npm run schema:commit` after

---

### Finding G-3: Smart Chip Write Limitations Undocumented (MEDIUM)

**Verify:**
```bash
grep -n "chip\|smartChip\|SmartChip\|person_chip\|drive_chip" \
  src/handlers/advanced-actions/chips.ts | head -20
# Check tool description
grep -n "chip\|smart chip" src/schemas/descriptions.ts | head -10
```

**Research:** Confirm current writeable chip types in June 2025 GA. From initial research: only `person` and Drive `file` chips are writable. Finance, map, calendar, rating chips are read-only.

**Fix:** Add to tool descriptions and chip handler documentation:
```
NOTE: Only person_chip and drive_chip are writable via Sheets API v4.
Finance, map, calendar, and rating chips are read-only via REST API.
```

---

### Finding G-4: Drive API New Fields Not Implemented (LOW)

**Verify:**
```bash
grep -rn "itemDownloadRestriction\|inheritedPermissionsDisabled\|copyRequiresWriterPermission" \
  src/ --include="*.ts" | head -5
# Likely no results
```

**Research:** What exactly are `itemDownloadRestriction` (July 2025) and `inheritedPermissionsDisabled` (Feb 2025)? Are they commonly needed?

**Implementation:** If commonly needed, add optional fields to relevant `share_add`/`share_update` schemas.

---

### Finding G-5: Workspace Events API — Native Sheets Events Status

**Verify:**
```bash
grep -rn "workspaceevents\|WorkspaceEvents\|Workspace.*Events" \
  src/services/ --include="*.ts" | head -10
grep -n "subscribe_workspace\|sheet.*event\|event.*sheet" \
  src/handlers/webhooks.ts | head -10
```

**Research:** What is the current status (April 2026) of native Sheets-level Workspace Events? Is it GA or still in Developer Preview? What events are available?

**Fix needed:** Update `subscribe_workspace` description to accurately reflect what events are available via Workspace Events API vs. what requires Drive change notification polling.

---

## Part 5 — Security Critical Fixes

### Research Directive

Before implementing, research:
- `https://owasp.org/www-project-top-ten/` — Current OWASP Top 10
- `https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html` — Session management
- `https://redis.io/docs/latest/commands/set/` — Redis atomic operations, SET NX, Lua scripts
- Search: "node-redis v4 connect race condition production patterns 2025"
- Search: "CORS Express production security best practices 2026"
- Search: "OAuth 2.1 token rotation patterns Node.js 2025"

**Research Questions:**
1. Is the lazy-connect pattern (`ensureConnected()`) safe for production Redis with node-redis v4? Or must `.connect()` be called explicitly at startup?
2. What CORS configuration is considered production-safe for an MCP server that accepts authenticated requests?
3. What is the current OWASP recommendation for rate limiting authentication endpoints vs. general API endpoints?
4. Is AES-256-GCM with random IV (per token) the current best practice for OAuth token encryption at rest?
5. Should sampling consent be logged to the audit trail per GDPR Article 7 requirements?

### Finding S-1: CRITICAL — Redis Startup Race Condition

**Verify:**
```bash
grep -n "createClient\|client.connect\|ensureConnected\|connect()" \
  src/storage/session-store.ts | head -20

# Check HTTP server startup sequence
grep -n "createSessionStore\|SessionStore\|redis\|listen(" \
  src/server/http-server.ts 2>/dev/null | head -20
grep -n "createSessionStore\|redis\|listen(" \
  src/http-server.ts 2>/dev/null | head -20
```

**Research:** Per node-redis v4 documentation, `.connect()` must be called explicitly. The lazy `ensureConnected()` pattern means the first N requests during startup may fail silently if Redis isn't yet connected.

**Fix:**
```typescript
// In HTTP server startup (http-server.ts or similar):
const sessionStore = createSessionStore(config);
await sessionStore.initialize();  // Must await before server.listen()
server.listen(port, host, () => {
  logger.info(`Server ready on ${host}:${port}`);
});
```

---

### Finding S-2: CRITICAL — CORS Defaults to Allow All Origins

**Verify:**
```bash
grep -n "CORS_ORIGINS\|cors.*origin\|corsOrigins" src/config/env.ts | head -10
grep -n "cors\b" packages/mcp-http/src/ -r | head -15
```

**Fix:**
```typescript
// src/config/env.ts — Change default:
CORS_ORIGINS: z.string()
  .default('http://localhost:3000')
  .describe('Comma-separated allowed CORS origins. Set explicitly in production.'),
```

Add startup validation:
```typescript
// In production startup check:
if (getEnv().NODE_ENV === 'production' && getEnv().CORS_ORIGINS === 'http://localhost:3000') {
  logger.warn('CORS_ORIGINS not explicitly configured for production — defaulting to localhost only');
}
```

---

### Finding S-3: HIGH — Rate Limiting Per-IP Not Per-User

**Verify:**
```bash
grep -n "rateLimit\|rateLimiter\|per.*user\|per.*ip\|principalId.*limit" \
  packages/mcp-http/src/ -r | head -15
grep -n "RATE_LIMIT\|tokensPerMinute\|maxRequests" src/config/env.ts | head -10
```

**Research Questions:**
1. What is the standard approach for per-user rate limiting when users authenticate via OAuth?
2. How should rate limits differ between authenticated vs. unauthenticated requests?
3. What is a reasonable per-user rate limit for Google Sheets API proxying?

**Expected Fix:** Add per-user (`principalId`) rate limit bucket alongside the per-IP bucket. Per-user limit should be stricter (e.g., 100 req/min) while per-IP can be higher (e.g., 500 req/min for shared proxies).

---

### Finding S-4: HIGH — Sampling Consent Not Audit-Logged (GDPR)

**Verify:**
```bash
grep -rn "samplingConsent\|consent.*audit\|audit.*consent\|SAMPLING_CONSENT" \
  src/ --include="*.ts" | grep -v test | head -15
grep -n "logConsent\|consentGranted\|consentDenied" src/utils/sampling-consent.ts | head -10
```

**Research:** GDPR Article 7 requires that consent can be demonstrated. Article 28 covers data processor obligations. Does sampling consent require a logged audit trail?

**Fix Pattern:**
```typescript
// In assertSamplingConsent() — after consent check:
if (consentGranted) {
  auditLogger.log({
    event: 'sampling_consent_granted',
    timestamp: new Date().toISOString(),
    principalId,
    dataScope: spreadsheetId,
    samplingPurpose: taskType,
  });
}
```

---

### Finding S-5: HIGH — GPL License Audit Required

**Verify:**
```bash
npx license-checker --production --json 2>/dev/null | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
gpl = [(k, v.get('licenses','')) for k, v in data.items() if 'GPL' in str(v.get('licenses',''))]
print(f'GPL packages found: {len(gpl)}')
for pkg, lic in gpl: print(f'  {pkg}: {lic}')
" 2>/dev/null || echo "license-checker not installed — run: npm install -g license-checker"
```

**Research:** What are the GPL packages and do they affect the npm publish distribution? Are any bundled vs. peer dependencies?

**Fix:** Either replace GPL dependencies with MIT/Apache equivalents, or consult legal on whether the specific GPL variant (LGPL, GPL-3.0, etc.) creates obligations for distribution.

---

### Finding S-6: HIGH — 3 Dependabot Moderate Vulnerabilities Open

**Verify:**
```bash
npm audit 2>&1 | head -30
gh pr list --author app/dependabot --limit 10 2>/dev/null | head -15
```

**Fix:** Review each Dependabot PR:
1. Check if it's a direct or transitive dependency
2. Check if the vulnerability is exploitable in this context
3. Merge if safe, or pin a safe version if merge breaks things

---

### Finding S-7: MEDIUM — Token Encryption Key Rotation Not Supported

**Verify:**
```bash
grep -n "encrypt\|decrypt\|ENCRYPTION_KEY\|rotation\|legacyKey" \
  src/services/token-store.ts | head -15
```

**Research:** What is the standard pattern for AES-256-GCM key rotation without service interruption?

**Fix Pattern:**
```typescript
// token-store.ts — Support multiple keys:
async decryptToken(encrypted: string): Promise<string> {
  // Try current key first
  try { return await this.decryptWith(encrypted, this.currentKey); }
  catch (e) {
    // Try legacy keys for rotation window
    for (const legacyKey of this.legacyKeys) {
      try { return await this.decryptWith(encrypted, legacyKey); }
      catch {}
    }
    throw new Error('Token decryption failed with all keys');
  }
}
```

---

## Part 6 — Performance Gaps

### Research Directive

Before implementing, research:
- `https://developers.google.com/workspace/sheets/api/limits` — Current quota limits and best practices
- Search: "LRU cache TTL eviction Node.js best practices 2025"
- Search: "Google Sheets API field masks complete guide 2025"
- Search: "Circuit breaker pattern Node.js production 2025"

**Research Questions:**
1. Have the Google Sheets API quota limits changed since 2024 (300 read/300 write per min per user)?
2. Is there a recommended TTL for spreadsheet existence caching?
3. What is the current best practice for exponential backoff on Google API 429s?

### Finding Perf-1: Unbounded Spreadsheet Existence Cache (HIGH)

**Verify:**
```bash
grep -n "existenceCache\|spreadsheet.*exist\|exist.*cache\|5000\|maxSize" \
  src/services/cached-sheets-api.ts | head -15
```

**Fix:** Add TTL (1 hour) to the existence cache entries:
```typescript
// Instead of: existenceCache.set(id, true)
existenceCache.set(id, { exists: true, cachedAt: Date.now() });
// On read: if (Date.now() - entry.cachedAt > 3_600_000) delete and refetch
```

---

### Finding Perf-2: executeWithRetry Coverage Audit

**Verify:**
```bash
# Find all direct sheetsApi calls not wrapped in retry
grep -rn "sheetsApi\.\|driveApi\." src/handlers/ --include="*.ts" | \
  grep -v "executeWithRetry\|withRetry\|test\|mock" | \
  grep -v "\.get\b\|\.set\b\|\.has\b\|\.delete\b" | \
  head -20
```

**Research:** What is the current retry configuration? Is exponential backoff with jitter implemented? Are `429`, `500`, `502`, `503`, `504` all included in retryable status codes?

---

## Part 7 — Observability Gaps

### Research Directive

Research:
- `https://opentelemetry.io/docs/specs/semconv/` — Latest semantic conventions for HTTP and RPC spans
- Search: "OpenTelemetry Google API client instrumentation best practices 2025"
- Search: "Prometheus MCP server metrics standard patterns 2026"

**Research Questions:**
1. What are the standard OpenTelemetry semantic conventions for tool calls in MCP servers?
2. What metrics are most valuable for monitoring a Google Sheets proxy? (quota usage, cache hit rate, error rate by code)
3. Should `/health/ready` vs `/health/live` return different information for Kubernetes deployments?

### Finding O-1: No `/health/ready` HTTP Endpoint (HIGH)

**Verify:**
```bash
grep -rn "'/health'\|'/ready'\|'/live'\|healthCheck\|readiness" \
  src/server/ packages/mcp-http/src/ --include="*.ts" | head -15
cat src/server/health.ts | head -40
```

**Fix:** Expose health check as HTTP route in mcp-http or directly in http-server.ts:
```typescript
app.get('/health/ready', async (req, res) => {
  const health = await healthService.checkReadiness();
  res.status(health.ready ? 200 : 503).json(health);
});
app.get('/health/live', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
```

---

### Finding O-2: Tool Action Latency Not Tracked as Histogram (HIGH)

**Verify:**
```bash
grep -rn "histogram\|recordLatency\|tool.*latency\|latency.*tool\|duration.*action" \
  src/observability/ --include="*.ts" | head -15
grep -rn "recordToolCall\|recordLatency" src/mcp/registration/tool-handlers.ts | head -10
```

**Research:** What is the recommended OpenTelemetry histogram bucket configuration for API proxy latency (p50, p95, p99)?

**Fix:** Add `tool_call_duration_ms` histogram with labels: `tool`, `action`, `success` (boolean), `error_code`.

---

### Finding O-3: Quota Usage Not Exported as Metric (HIGH)

**Verify:**
```bash
grep -rn "quotaUsed\|quotaRemaining\|QUOTA\|429.*count\|rate.*limit.*count" \
  src/observability/ src/services/ --include="*.ts" | grep -v test | head -15
```

**Fix:** Add `google_api_quota_used_total` counter with labels: `api` (sheets/drive), `method`, `user_project`.

---

## Part 8 — Schema Deep Dives

### Research Directive

Research:
- `https://json-schema.org/draft/2020-12/json-schema-core.html` — JSON Schema 2020-12 spec
- Search: "Zod to JSON Schema LLM tool use best practices 2025"
- Search: "MCP inputSchema outputSchema discriminated union best practices"

**Research Questions:**
1. Does JSON Schema 2020-12 have better support for discriminated unions than Draft-07?
2. Are there any Zod features that don't convert correctly to JSON Schema via `zodSchemaToJsonSchema`?
3. What is the optimal `.describe()` text length for JSON Schema tool definitions that Claude reads?
4. Should `$schema` be included in every JSON Schema emitted? What dialect?

### Finding Sc-1: Verify JSON Schema Dialect in Emitted Schemas

**Verify:**
```bash
# Check what $schema is emitted for tool inputSchemas
node -e "
const { generateAllFixtures } = require('./src/mcp/registration/tools-list-compat.js');
// Check first tool's inputSchema for $schema field
" 2>/dev/null || echo "Can't run directly — check tools-list-compat.ts:toJsonSchema conversion"

grep -n "\\\$schema\|json-schema.org\|draft.*schema" \
  src/mcp/registration/tools-list-compat.ts src/utils/schema-compat.ts 2>/dev/null | head -15
```

**Research:** What JSON Schema dialect does MCP 2025-11-25 require? Is `$schema: "https://json-schema.org/draft/2020-12/schema"` required or optional?

---

### Finding Sc-2: Verify ALL 409 Action Discriminants Have Descriptions

**Verify:**
```bash
# Count total action discriminants (z.literal() calls in schemas)
grep -rn "z\.literal(" src/schemas/ --include="*.ts" | grep -v "test\|spec\|shared" | wc -l

# Count discriminants WITH .describe()
grep -rn "z\.literal.*\.describe\|literal.*describe\b" src/schemas/ --include="*.ts" | wc -l

# Find any WITHOUT describe:
grep -rn "z\.literal(" src/schemas/ --include="*.ts" | \
  grep -v "\.describe\|test\|shared" | head -20
```

---

## Part 9 — Advanced Methods to Research and Implement

This section contains areas that require fresh research — no prior implementation exists. The evaluating AI should research, prototype, and propose implementations.

### Advanced Topic 1: Tool Composition Patterns

**Research Questions:**
1. Are there published patterns for MCP servers that recommend tool chains to LLMs?
2. Should ServalSheets expose "macros" — named sequences of operations that can be executed atomically?
3. What is the standard way to recommend follow-up tools in MCP tool responses?
4. Can `nextActions` in the response drive Claude's tool selection on the next turn?

**Investigate:**
```bash
grep -rn "nextActions\|suggestedActions\|followUp\|toolChain" \
  src/mcp/registration/ src/services/ --include="*.ts" | grep -v test | head -20
```

---

### Advanced Topic 2: Structured Output Schemas for LLM Parsing

**Research Questions:**
1. Can Claude parse `structuredContent` from `CallToolResult` natively, or does it rely on the text `content`?
2. Should output schemas be designed for Claude's structured output parsing feature?
3. Is there a standard pattern for returning results that Claude can directly use as structured data?
4. How does the `audience` annotation (`['assistant']` vs `['user', 'assistant']`) affect how Claude processes tool results?

**Investigate:**
```bash
grep -n "structuredContent\|audience.*assistant\|content.*type.*text" \
  src/mcp/registration/tool-response.ts | head -20
```

---

### Advanced Topic 3: MCP Resource Subscription Patterns

**Research Questions:**
1. What is the correct pattern for streaming live Google Sheets changes to subscribed MCP clients?
2. Should spreadsheet cells be exposed as MCP resources with their values (enabling `resources/subscribe` for live data)?
3. What is the latency and quota impact of real-time resource subscriptions?
4. How does the Workspace Events API integrate with MCP resource subscriptions?

**Investigate:**
```bash
ls src/resources/
grep -rn "subscribe\|notification.*resource\|ResourceTemplate" \
  src/resources/ --include="*.ts" | head -20
```

---

### Advanced Topic 4: Multi-Tenant Architecture Review

**Research Questions:**
1. Is the current session context a true singleton or properly isolated per HTTP session?
2. Can concurrent requests from different users corrupt each other's session state?
3. What is the correct pattern for tenant isolation in a shared MCP server?
4. Should API quota be tracked and enforced per-tenant?

**Investigate:**
```bash
grep -n "singleton\|global.*session\|static.*context\|shared.*state" \
  src/services/session-context.ts | head -10

# Check for thread-safety issues
grep -n "Map\b\|Set\b\|let.*=.*{}\|const.*=.*\[\]" \
  src/services/session-context.ts | head -20
```

---

### Advanced Topic 5: MCP Registry Submission Optimization

**Research Questions:**
1. What exactly does the MCP registry validator check? Are there automated tests?
2. What makes the difference between a "community" and "featured" listing on the MCP registry?
3. What documentation format does the registry display to users?
4. What security review does Anthropic conduct on submitted MCP servers?
5. Are there performance benchmarks required for listing?

**Research Directive:**
```
Fetch: https://registry.modelcontextprotocol.io/
Fetch: https://github.com/modelcontextprotocol/registry
Search: "MCP registry featured listing requirements 2026"
Search: "mcp-publisher publish requirements checklist"
```

---

### Advanced Topic 6: Prompt Engineering for Sheets-Specific Tasks

**Research Questions:**
1. What system prompts work best for formula generation tasks in Claude?
2. How should range selection ambiguity be resolved in prompts (when user says "column A" but means multiple sheets)?
3. What few-shot examples are most effective for chart type selection?
4. How should the LLM be prompted to handle large spreadsheets (100K+ rows) where it can't see all data?

**Investigate:**
```bash
grep -rn "systemPrompt\|few.shot\|example\|template" \
  src/services/agent/plan-compiler.ts | head -20
grep -rn "systemPrompt" src/mcp/sampling.ts | head -15
```

---

### Advanced Topic 7: Cost Optimization via Intelligent Caching

**Research Questions:**
1. Can sampling results be cached when the same prompt + context is used repeatedly?
2. What is the typical sampling call cost per action? Is caching economically justified?
3. Are there standard patterns for semantic similarity caching of LLM responses?
4. How should cache invalidation work when the underlying spreadsheet data changes?

**Investigate:**
```bash
grep -rn "samplingCache\|llm.*cache\|cache.*sampling\|embeddings\|semantic.*cache" \
  src/services/ --include="*.ts" | grep -v test | head -10
```

---

### Advanced Topic 8: Property-Based Testing Coverage

**Research Questions:**
1. Are there common Google Sheets edge cases that property-based tests would catch (e.g., emoji in cell values, maximum row limits, formula recursion depth)?
2. What is the current fast-check coverage for schema validation?
3. What are the most valuable properties to test in a Google Sheets MCP server?

**Investigate:**
```bash
grep -rn "fc\.\|fast-check\|arbitrary\|fc\.property" \
  tests/ --include="*.ts" | head -20
```

---

## Part 10 — Implementation Checklist (Ordered by Sprint)

### Sprint 1 — Critical Security + Protocol (8 hrs)

- [ ] **S-1**: Fix Redis startup race — await `.connect()` before HTTP server listens
- [ ] **S-2**: Fix CORS default — change from `''` to `'http://localhost:3000'`
- [ ] **P-1**: SEP-1303 — convert ZodError to CallToolResult{isError:true} (verify spec first)
- [ ] **P-2**: Add `description` to `SERVER_INFO` in `src/version.ts`
- [ ] **G-1**: Fix `tableName` not sent to Google Tables API in `tables.ts:253`
- [ ] **U-2**: Rename `response_format` → `responseFormat` in `data.ts`
- [ ] **U-1**: Add `.describe()` to 4 enums (federation, webhook ×2, connectors)

### Sprint 2 — LLM Usability (16 hrs)

- [ ] **U-3**: Add 4 idempotence warnings to ACTION_GOTCHAS
- [ ] **A-5**: Add batch operation intelligence to response-intelligence.ts
- [ ] **A-1**: Research extended thinking API, implement for 6 complex analysis actions
- [ ] **A-2**: Add spreadsheet context to all 8 sampling call sites
- [ ] **A-3**: Deploy CoT hints to 4 mutation handler response paths
- [ ] **A-6**: Add constraint-aware planner prompts to plan-compiler.ts
- [ ] **G-3**: Document smart chip write limitations in tool descriptions

### Sprint 3 — Security + Operations (16 hrs)

- [ ] **S-3**: Add per-user rate limiting alongside per-IP
- [ ] **S-4**: Add sampling consent audit logging
- [ ] **S-5**: Run GPL license audit, fix or document
- [ ] **S-6**: Merge/address 3 Dependabot moderate vulnerabilities
- [ ] **S-7**: Add encryption key rotation support to token-store.ts
- [ ] **O-1**: Add `/health/ready` and `/health/live` HTTP endpoints
- [ ] **O-2**: Add tool action latency histogram to OTel
- [ ] **O-3**: Add quota usage gauge metric

### Sprint 4 — Google API + Advanced Features (16 hrs)

- [ ] **G-2**: Add `update_dimension_group` action (schema + handler + cache rule)
- [ ] **G-4**: Add Drive API new fields if commonly needed (research first)
- [ ] **G-5**: Update Workspace Events subscription description based on current API status
- [ ] **A-4**: Add optional `validateResult` reflexion to high-risk mutation actions
- [ ] **A-7**: Expose workflow templates via `agent.list_plans` when no active plans
- [ ] **Perf-1**: Add TTL to spreadsheet existence cache
- [ ] **Perf-2**: Audit and fix uncovered `executeWithRetry` call sites

### Sprint 5 — Deep Research + Registry (16 hrs)

- [ ] **Advanced 1-8**: Research and prototype each advanced topic
- [ ] **P-3**: Implement `ref/resource` completion
- [ ] **P-4**: Evaluate SEP-991, SEP-835, OIDC Discovery — implement if required
- [ ] **npm publish** — after security fixes complete
- [ ] **mcp-publisher publish** — registry submission
- [ ] Per-client installation docs (Claude Desktop, Cursor, VS Code, Copilot)

---

## Part 11 — Verification Commands Reference

Run these after making changes to verify nothing broke:

```bash
# Fast baseline (run after every change)
npm run test:fast
npm run typecheck

# After schema changes (MANDATORY)
npm run schema:commit

# Before commit
npm run verify:safe

# Full audit
npm run audit:gate
npm run check:mcp-features
npm run validate:mcp-protocol

# Security
npm audit
npx license-checker --production --onlyAllow 'MIT;ISC;Apache-2.0;BSD-2-Clause;BSD-3-Clause;CC0-1.0;Unlicense;0BSD'

# After all fixes
npm run verify:safe
npm run gates
```

---

## Part 12 — Key Files Reference

| Category | File | What It Contains |
|---|---|---|
| Tool registration | `src/mcp/registration/tool-definitions.ts` | All 25 tool definitions with inputSchema, outputSchema, annotations |
| Middleware chain | `src/mcp/registration/tool-handlers.ts` | 26-step middleware, all tool dispatch, error handling |
| Response building | `src/mcp/registration/tool-response.ts` | CallToolResult construction, isError logic, structuredContent |
| MCP capabilities | `src/mcp/features-2025-11-25.ts` | Server capability declaration, SEP implementations, tool icons |
| Sampling | `src/mcp/sampling.ts` | All createMessage() calls, consent gating, timeout, fallback |
| Elicitation | `src/mcp/elicitation.ts` | Form/URL elicitation, PrimitiveSchemaDefinition |
| Response intelligence | `src/mcp/registration/response-intelligence.ts` | Action gotchas, batching hints, quality warnings |
| Response hints engine | `src/services/response-hints-engine.ts` | CoT hints for read operations |
| Action recommender | `src/services/action-recommender.ts` | Next-action suggestions |
| Plan compiler | `src/services/agent/plan-compiler.ts` | LLM plan generation prompt |
| Plan executor | `src/services/agent/plan-executor.ts` | Step execution with reflexion |
| LLM fallback | `src/services/llm-fallback.ts` | Direct API fallback when sampling unavailable |
| Session context | `src/services/session-context.ts` | Multi-turn session state |
| ETag cache | `src/services/etag-cache.ts` | Dual-tier read cache |
| Token store | `src/services/token-store.ts` | AES-256-GCM OAuth token storage |
| Redis session | `src/storage/session-store.ts` | Session persistence |
| Health check | `src/server/health.ts` | 7-point readiness check |
| OTel setup | `src/observability/otel-setup.ts` | OpenTelemetry initialization |
| Completions | `src/server/control-plane-registration.ts` | ref/prompt, ref/resource, ref/tool handlers |
| Fixture overrides | `tests/audit/action-coverage-fixtures.ts` | Live API test fixtures with skipReasons |
| Shared schemas | `src/schemas/shared.ts` | ColorSchema, RangeInput, SafetyOptions, ErrorDetail |
| Google API client | `src/services/google-api.ts` | executeWithRetry, circuit breaker, quota management |

---

## Appendix A — Known Working (Do Not Regress)

These are confirmed correct — do not change them while fixing other things:

- **Tool annotations**: All 4 hints (readOnly, destructive, idempotent, openWorld) are accurate for all 25 tools
- **Safety options**: All destructive actions have `SafetyOptionsSchema.optional()` — do not remove
- **Schema coercion**: `sheetId` as `z.coerce.number()`, ColorSchema accepting hex/named/RGB, boolean coercion — all correct
- **ETag user scoping**: Already scoped by userId — do not change the key format
- **Redis pattern**: `ensureConnected()` before commands is correct for application layer; startup race is the separate issue
- **ReDoS protection**: `quality.ts:112` max(200) guard — do not remove
- **Zod→JSON Schema**: `tools-list-compat.ts:87-146` conversion is correct — do not change
- **isError logic**: `tool-response.ts:565,693` — `isError: hasFailure && !treatAsNonFatal` — correct per spec

---

## Appendix B — Anti-Patterns to Avoid

- **Never** hardcode tool counts or action counts — always reference `src/generated/action-counts.ts`
- **Never** edit `server.json` directly — it's generated by `scripts/generate-metadata.ts`
- **Never** add `return {}` in handlers — use `throw new SheetNotFoundError()` instead
- **Never** use `as any` in handler code — fix the type instead
- **Never** skip `npm run schema:commit` after schema changes — it's the #1 CI failure cause
- **Never** add `console.log` to handler code — use Winston logger
- **Never** use `Math.random()` in tests — use deterministic values
- **Never** use tautological assertions (`expect([true,false]).toContain(x)`) — use specific expected value

---

*Generated: 2026-04-27 | Branch: main | Commit: bd2013b5*
*Verified state: 81 test files, 1849 tests passing, 0 uncommitted changes*
