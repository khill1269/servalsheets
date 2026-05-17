# Research Agent Memory

**Agent:** servalsheets-research (Haiku model)  
**Specialty:** Fast pattern analysis, code reading, implementation strategy  
**Updated:** Session 131 (Comprehensive Architecture Audit)

## ⭐ COMPREHENSIVE ARCHITECTURE AUDIT (NEW — Session 131)

**See [`comprehensive-architecture-audit-2026-05-13.md`](comprehensive-architecture-audit-2026-05-13.md)** — Complete inventory of handler patterns, error handling, schema alignment, middleware chain, services, config, and code quality.

**Key findings:**
- **13 BaseHandler subclasses + 12 standalone handlers** (all 25 verified by class declarations)
- **Error handling:** 0 silent fallbacks, all errors use ErrorCode enum + recovery hints
- **Action naming:** All 411 actions use consistent verb or verb_noun pattern
- **Layer enforcement:** .dependency-cruiser.json enforces strict layer violations; 0 circular deps (except 2 allowed: sampling.ts, elicitation.ts)
- **Middleware stack:** 9 layers (audit, write-lock, mutation-safety, idempotency, rate-limit, rbac, redaction, tenant-isolation, schema-version)
- **Services:** ~85+ specialized services with clear separation of concerns
- **Schema-handler alignment:** All 411 actions have discriminated union entries + switch cases (verified via audit test)
- **Code quality:** 0 TODOs/FIXMEs, complete auto-generation pipeline, 629 test files

## ⭐ AI INTELLIGENCE LAYER AUDIT (Session 130)

**See [`ai-intelligence-layer-audit.md`](ai-intelligence-layer-audit.md)** — Comprehensive audit of response intelligence, session context richness, and AI-optimization for Claude/LLM clients.

**Key findings:**
- **Response intelligence:** 26% of 409 actions (107 actions) have explicit hints/gotchas injected; remaining 74% get generic enrichment
- **Error recovery params:** fixableVia object pre-fills tool+action but NOT spreadsheetId/range — forces extra LLM RTT
- **Session context:** 8 fields returned (active sheet, last op, connectors) but missing recent history, domain classification, risk indicators
- **Quality warnings:** Automatic on reads, but no pre-flight warnings on destructive writes/deletes
- **CoT hints:** Excellent for financial data (revenue/cost/profit detection), weak on domain classification overall
- **Scout action:** Returns recommendations but no pre-ordered action sequences (LLM must discover scout→clean→format→visualize order)
- **Priority fixes:** (1) Pre-fill params in error recovery (20-40% RTT saving), (2) Add domain classification, (3) Pre-write analysis for formulas, (4) Multi-step sequences

## ⭐ SDK PROMPT ICONS GAP (Session 129)

**See [`sdk-prompt-icons-research.md`](sdk-prompt-icons-research.md)** — Investigation of @modelcontextprotocol/sdk@1.29.0 vs MCP 2025-11-25 spec.

**Key finding:** Type assertion + manual icon insertion both fail. SDK's registerPrompt config excludes icons field; wire response (lines 412-417 mcp.js) hardcodes {name, title, description, arguments}. No workarounds preserve SDK convenience. Solution: Open issue with SDK or extend server.setRequestHandler() directly (non-standard).

## ⭐ DRIFT REGRESSION TEST GAP (Session 129)

**See [`drift-regression-test-research.md`](drift-regression-test-research.md)** — Coverage analysis of source-dist-consistency test.

**Gap found:** Test only detects MISSING dist, not STALE dist. Current test (test.ts lines 25-46) passes if dist files exist (even with old content). Script actually DOES compare (lines 200-235) but test only checks exit code. Recommended: Add 3rd test using mkdtempSync + stale content + backup/restore pattern.

## ⭐ STRESS TEST INFRASTRUCTURE (NEW — Session 128)

**See [`stress-test-infrastructure-audit.md`](stress-test-infrastructure-audit.md)** — Complete audit of performance testing, load simulation, concurrency, and fault injection. Establishes baseline and design for 50+ scenario generator targeting 1000+ concurrent AI+Sheets user flows.

**Key findings:**
- **Existing:** Schema validation benchmarks (409 actions), memory leak tests (1000 ops < 50MB), concurrency coordinator (15 default, 5-30 adaptive), circuit breaker, batching system (100-op limit, 20-100ms window)
- **Missing:** Multi-user concurrency, AI workflow simulation, fault injection, cache metrics, agent plan stress, transaction boundary tests
- **Recommended build:** 5-phase system with scenario generator, load runner, fault injector, metrics collector, mock API, + CI integration

## ⭐ LIVE TESTING INFRASTRUCTURE MAP (Session 128)

**See [`live-testing-infrastructure-audit.md`](live-testing-infrastructure-audit.md)** — Complete inventory of live API testing, audit gates, probe systems, observability stack, and CI workflows. Load for designing comprehensive testing systems.

**Key findings:**
- `.tmp-live-test.mjs`: 196/409 actions tested (47.9% coverage) via stdio transport
- `.tmp-probe-smoke.mjs`: Server startup validation (3s)
- `tests/audit/action-coverage-fixtures.ts`: Auto-generated 409 fixtures from TOOL_ACTIONS
- `scripts/audit-gate.sh`: 15-gate CI pipeline (40-60s, A1-A15)
- `tests/config/vitest.config.live.*.ts`: Smoke/nightly/optimization live test runners
- Observability: Prometheus+Grafana+Loki+Tempo stack (`.env.local.observability`)

## ⭐ GROUND TRUTH REGISTRY (NEW)

**See [`ground-truth-registry.md`](ground-truth-registry.md)** — Authoritative baseline with file:line evidence for all architectural facts, counts, and critical patterns. Load this first for any accuracy-sensitive work.

## Core Facts

- **Project:** ServalSheets MCP server, 25 tools, 409 actions
- **Source of truth for counts:** `src/schemas/action-counts.ts:41,46`
- **All 409 actions verified:** Session 109 (3-agent Explore audit)
- **Test count:** 2253/2253 passing (Session 110)
- **Handler architecture:** 13 BaseHandler subclasses + 12 standalone handlers

## Handler Implementation Patterns

### BaseHandler Subclasses (13 tools)

These extend `src/handlers/base.ts:BaseHandler<Input, Output>`.

```typescript
private async handle{ActionName}(input: InputType): Promise<OutputType> {
  // 1. Validate business rules (Zod already ran)
  // 2. Confirm if destructive: await this.confirmDestructiveAction(...)
  // 3. Snapshot if destructive: await this.createSnapshotIfNeeded(...)
  // 4. Execute: const result = await this.context.cachedApi.method(...)
  // 5. Return: return this.success('action_name', result, isMutation);
}

// Dispatch in switch statement:
case 'action_name': {
  const result = await this.handleActionName(req);
  return result; // BaseHandler.success() returns MCP format
}
```

### Standalone Handlers (12 tools)

These implement `handle()` directly:

```typescript
case 'action_name': {
  const result = await this.handleActionName(req);
  return { response: { success: true, action: 'action_name', ...result } };
}

private async handleActionName(req: InputType): Promise<OutputType> {
  // Same 5-step pattern as BaseHandler
}
```

## Schema Patterns

### Discriminated Union Pattern

All schemas use Zod discriminated unions:

```typescript
export const SheetsDataActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('read'),
    spreadsheetId: SpreadsheetIdSchema,
    range: A1NotationSchema,
    valueRenderOption: z.enum(['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA']).optional(),
  }),
  z.object({
    action: z.literal('write'),
    spreadsheetId: SpreadsheetIdSchema,
    range: A1NotationSchema,
    values: z.array(z.array(z.any())),
  }),
  // ... more actions
]);
```

### Optional Parameters

All optional parameters use `.optional()`:

```typescript
z.object({
  requiredParam: z.string(),
  optionalParam: z.string().optional(),
  numberWithMin: z.number().min(1).optional(),
});
```

## Service Usage Patterns

### Most Common Services

| Service                | Used By                          | Pattern                                 |
| ---------------------- | -------------------------------- | --------------------------------------- |
| CachedSheetsApi        | Most read-heavy handlers         | `await this.context.cachedApi.batchGet()` |
| BatchCompiler          | Format, Dimensions, Advanced     | `await compiler.compile(intents)`       |
| ParallelExecutor       | Data, Composite                  | `await executor.executeParallel()`      |
| GoogleApiClient        | Core, BigQuery, AppsScript       | `await executeWithRetry(...)`           |
| HistoryService         | History handler                  | `await history.recordOperation()`       |
| SessionContextManager  | Session handler                  | `this.context.sessionCtx.set(...)`      |

## Common Test Patterns

### Success Path

```typescript
test('action_name succeeds', async () => {
  const req = {
    request: {
      action: 'action_name',
      spreadsheetId: TEST_SPREADSHEET_ID,
      // ... params
    },
  };

  const result = await handler.handle(req);

  expect(result.response.success).toBe(true);
  expect(result.response.action).toBe('action_name');
  expect(result.response.data).toEqual(expectedData);
});
```

### Error Path

```typescript
test('action_name fails on invalid input', async () => {
  const req = {
    request: {
      action: 'action_name',
      spreadsheetId: '', // Invalid
    },
  };

  const result = await handler.handle(req);

  expect(result.response.success).toBe(false);
  expect(result.response.error).toBeDefined();
  expect(result.response.error.code).toBe('VALIDATION_ERROR');
});
```

## Schema-Handler Alignment

**Verified (Session 109):** All 25 tools have:
- ✅ Schema discriminated union in `src/schemas/{tool}.ts`
- ✅ Handler cases matching all discriminated actions
- ✅ Handler methods following naming convention `handle{ActionName}`
- ✅ Response format matches MCP CallToolResult shape
- ✅ Error handling uses typed ErrorCode enum

**Coverage:** 409/409 actions verified across all tools.

## Important Details

### Envelope Wrapping

All tests use envelope format:

```typescript
// ✅ Correct
{
  request: {
    action: 'read',
    spreadsheetId: '...',
    range: 'A1:C10',
  },
}

// ❌ Wrong (will fail)
{
  action: 'read',
  spreadsheetId: '...',
  range: 'A1:C10',
}
```

The handler layer normalizes both formats via `normalizeToolArgs()` in `tool-handlers.ts:85-124`.

### Metadata Regeneration

After ANY schema change:

```bash
npm run schema:commit
```

This regenerates:
- `src/schemas/action-counts.ts` (ACTION_COUNT, TOOL_COUNT)
- `src/generated/annotations.ts` (tool metadata)
- `src/mcp/completions.ts` (autocompletion map)
- `server.json` (MCP resource manifest)
- `package.json` (scripts update)

## Lookup Tables

### All 25 Tools (by handler type)

**BaseHandler subclasses (13):**
sheets_core, sheets_data, sheets_format, sheets_dimensions, sheets_advanced, sheets_visualize, sheets_collaborate, sheets_composite, sheets_analyze, sheets_fix, sheets_templates, sheets_bigquery, sheets_appsscript

**Standalone (12):**
sheets_auth, sheets_confirm, sheets_dependencies, sheets_quality, sheets_history, sheets_session, sheets_transaction, sheets_federation, sheets_webhook, sheets_agent, sheets_compute, sheets_connectors

### Action Count by Tool (25 tools, 409 total)

sheets_advanced: 31, sheets_agent: 8, sheets_analyze: 26, sheets_appsscript: 19, sheets_auth: 5, sheets_bigquery: 17, sheets_collaborate: 41, sheets_composite: 21, sheets_compute: 16, sheets_confirm: 5, sheets_connectors: 10, sheets_core: 21, sheets_data: 25, sheets_dependencies: 10, sheets_dimensions: 30, sheets_federation: 4, sheets_fix: 6, sheets_format: 25, sheets_history: 10, sheets_quality: 4, sheets_session: 32, sheets_templates: 8, sheets_transaction: 6, sheets_visualize: 18, sheets_webhook: 11

## Quick Lookups

**"Where do I find the X handler?"**

- sheets_core, sheets_data, sheets_format, sheets_dimensions, sheets_advanced, sheets_visualize, sheets_collaborate, sheets_composite, sheets_analyze, sheets_fix, sheets_templates, sheets_bigquery, sheets_appsscript → `src/handlers/{tool}.ts`
- sheets_auth, sheets_confirm, sheets_dependencies, sheets_quality, sheets_history, sheets_session, sheets_transaction, sheets_federation, sheets_webhook, sheets_agent, sheets_compute, sheets_connectors → `src/handlers/{tool}.ts`

**"Where is the action schema?"**

- All: `src/schemas/{tool}.ts` with discriminated union named `{Tool}ActionSchema`

**"Where is the error code?"**

- All typed errors: `src/schemas/shared.ts:ErrorCodeSchema` (enum)
- Custom error classes: `src/errors/{ErrorType}.ts`

**"How many tests?"**

- Unit: ~1200 (one per action or handler method)
- Contract: ~1000 (schema validation, response format)
- Integration: ~50 (live API tests, skipped in CI)
- Total: 2253 passing

## Middleware Chain & Execution Flow (Session 117)

**CRITICAL FINDING:** STDIO and HTTP transports execute the **identical middleware chain** via `src/mcp/registration/tool-handlers.ts:890-1680`. No divergence between transports. C1 audit finding about execution path differences is **FALSE**.

### Complete Middleware Chain (26 Steps)

1. Request context creation (traceId, spanId, principalId)
2. Queue metrics update
3. Auth exemption check
4. Google API authentication
5. Handler existence check
6. Keepalive start
7. OpenTelemetry tracing setup
8. Legacy invocation detection
9. Rate limiting (token bucket)
10. Argument normalization + envelope unwrapping
11. Verbosity extraction & recording
12. RBAC permission check (if ENABLE_RBAC=true)
13. Mutation safety validation (formula injection blocking)
14. **Routed execution with write-lock (mutations only)**
15. Protocol version injection (_meta field)
16. Span result attributes (success/cells-affected)
17. History recording (session undo trail)
18. Metrics recording (latency, self-corrections)
19. Trace recording (OpenTelemetry spans)
20. Cost tracking (if ENABLE_COST_TRACKING=true)
21. **Audit logging** (if ENABLE_AUDIT_LOGGING=true) ← fires on both success & error
22. Action log spreadsheet append (if ENABLE_ACTION_LOG_SHEET=true)
23. Event bus emission (sheet.write, sheet.format, etc. events)
24. Debug logging per-tool (if DEBUG_TOOL set)
25. Range recording for completions cache
26. Sampling context invalidation (for LLM-focused caching)

**Error path:** Steps 17-26 also execute for errors (history, metrics, trace, audit).

### Audit Logging Call Sites

Only 2 locations (both in same function):
- `tool-handlers.ts:1472` — Success path: `getAuditLogger().logToolCall({ outcome: 'success' })`
- `tool-handlers.ts:1628` — Error path: `getAuditLogger().logToolCall({ outcome: 'failure' })`

Both require `ENABLE_AUDIT_LOGGING=true`. Wrapped in try-catch (non-critical).

## Ground Truth Registry System (Session 117)

**See:** `ground-truth-registry-findings.md` for complete specification.

**Key files:**
- `.serval/routing-map.json` — Current dispatch index (25 tools, 409 actions) — ~65KB
- Missing: schema file references, handler method names, cache rules, test locations

**Proposed solution:** Auto-generated `src/generated/ground-truth-registry.json` with all 5 data streams:
1. Middleware chain (26 steps with file:line)
2. Feature declarations vs implementations (9 MCP 2025-11-25 features)
3. Audit logging callsites (exhaustive grep of logToolCall)
4. Schema→Handler→Test→Cache traceability (all 409 actions)
5. Mutation action flags

**Generator:** `scripts/generate-ground-truth-registry.ts` (4-6 hours to implement)

## Notes for Implementation

1. Always read the similar action first (find 2-3 examples)
2. Follow the exact response format for your handler type (BaseHandler vs Standalone)
3. Run schema:commit immediately after schema changes
4. Tests must use envelope format: { request: { action, ... } }
5. Destructive actions must call confirmDestructiveAction() + createSnapshotIfNeeded()
6. Never hardcode tool/action counts (use src/schemas/action-counts.ts)
7. All errors must use typed ErrorCode from shared.ts
8. Both STDIO and HTTP transports execute identical middleware — no transport-specific code paths exist
