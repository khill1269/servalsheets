# Claude Code Rules (ServalSheets)

> **Size cap: 300 lines.** If this file exceeds 300 lines, move content to `docs/`.
> Architecture reference: `docs/development/ARCHITECTURE.md`

## Live State & Session Context

Live project state (auto-generated): @.serval/state.md

**Load on demand — do NOT auto-load these large files:**

- Session notes (20KB): `.serval/session-notes.md` — read only the section matching current task
- Codebase context (80KB+): `docs/development/CODEBASE_CONTEXT.md` — load only handler/service section matching current module
- Feature roadmap (40KB+): `docs/development/FEATURE_PLAN.md` — load only the section for current feature
- Dispatch map (JSON): `.serval/routing-map.json` — query by `tool.action` key (e.g. `sheets_data.read`)

## Project Overview

ServalSheets is a production-grade MCP server for Google Sheets with 25 tools and 410 actions.
Runtime: Node.js + TypeScript (strict). See `src/schemas/index.ts` for authoritative counts.

### Core Pipeline

```
MCP Request → src/server.ts:handleToolCall()
  → src/mcp/registration/tool-handlers.ts:createToolCallHandler()
    → normalizeToolArgs() → Zod validation → handler.executeAction()
      → src/services/google-api.ts (auto-retry + circuit breaker)
    → buildToolResponse() → CallToolResult
```

Full 4-layer trace with line numbers: `docs/development/ARCHITECTURE.md`

## Non-negotiable Workflow

1. **Verify before claiming** — every fact needs `file:line` OR `command → output`
2. **Trace execution paths** — prove reachability from entrypoint (STDIO/HTTP/Remote)
3. **No "fixes" without failing proof** — reproduce with script or failing test first
4. **Minimal change policy** — ≤3 src/ files unless tests require more; no refactors while debugging
5. **No silent fallbacks** — never `return {}` without logging; use `ErrorCode` enum
6. **Dead code claims need proof** — run `npm run validate:dead-code <file> <start> <end>`
7. **Schema-handler alignment** — run `npm run validate:alignment`; deviations must be in `src/schemas/handler-deviations.ts`
8. **Audit docs must validate** — `npm run validate:audit` with `.github/AUDIT_TEMPLATE.md` format

## AI Verification Protocol (see `.claude/verification-protocol.md` for full rules)

A claim without `command → output` evidence is **[UNVERIFIED]** and must not be acted on.

| Claim type | Required command |
|---|---|
| "Line N contains X" | `Read(file, offset=N-2, limit=8)` |
| "There are N instances" | `grep -rn "pattern" path/ \| wc -l` |
| "X is not implemented" | `grep -rn "X" src/` — show empty results |
| "Y causes Z" | Read every conditional/catch on the path |
| "Comment is current" | Grep for actual implementation |
| "Feature/middleware missing" | Read `.serval/ground-truth.json` first |

Two-phase audits: Phase 1 = gather evidence only. Phase 2 = interpret evidence only.
Known codebase error patterns: `.serval/corrections.jsonl` (injected at SessionStart).

## Verification (single canonical reference)

```bash
# Before every commit
npm run verify              # Full pipeline (typecheck + lint + test + drift + checks)
npm run verify:safe         # Skips lint (use when ESLint OOMs in low-memory envs)

# After schema changes (ONE command)
npm run schema:commit       # Regenerate metadata + verify + test + stage

# Quick checks (< 15 seconds each)
npm run check:drift         # Metadata sync
npm run test:fast           # Unit + contract tests
npm run typecheck           # TypeScript strict mode

# Individual checks
npm run check:placeholders  # No TODO/FIXME in src/
npm run check:debug-prints  # No console.log in handlers
npm run check:silent-fallbacks  # No silent {} returns
npm run validate:alignment  # Schema-handler alignment
npm run validate:audit      # Audit document validation
npm run check:mcp-features  # MCP 2025-11-25 feature coverage scan (sampling/elicitation/tasks/etc.)

# Gate pipelines (two separate systems — both must pass for releases)
npm run gates               # Deployment gates: typecheck + test:run + check:drift
npm run audit:gate          # Audit quality gates A1-A14 (architecture, coverage, contracts, MCP features)
npm run verify:build        # Build + validate + smoke

# Per-tool debug tracing (dev only)
DEBUG_TOOL=sheets_data DEBUG_ACTION=read npm run test:fast   # verbose logs for one tool/action
DEBUG_TOOL=sheets_data DEBUG_VERBOSE=true npm run test:fast  # includes request/response payloads
```

## No Documentation File Creation

Never create `*_REPORT.md`, `*_ANALYSIS.md`, `*_LOG.md`, `*_SUMMARY.md`, or session logs.
Report findings in chat. Code changes only — no meta-documentation.

## Common Gotchas

### 1. Metadata Drift After Schema Changes

Modified `src/schemas/*.ts` without regenerating → CI fails "metadata drift detected".
**Fix:** `npm run schema:commit` after ANY schema change. This is the #1 CI failure cause.
Generated files: `src/schemas/index.ts`, `annotations.ts`, `src/mcp/completions.ts`, `server.json`, `package.json`.

**`server.json` is GENERATED — never hand-edit it.** The source is `scripts/generate-metadata.ts`. Edit the generator, then run `npm run generate:metadata`. Direct edits to `server.json` are overwritten on the next `schema:commit` or `generate:metadata` call.

### 2. Response Builder Anti-Pattern

```typescript
// ❌ Handler returns MCP format directly
return { content: [{ type: 'text', text: 'result' }] };
// ✅ Handler returns data; tool layer converts
return buildToolResponse({ response: { success: true, data } });
```

### 3. Hardcoded Counts

Always reference `src/schemas/action-counts.ts:41,46` for TOOL_COUNT/ACTION_COUNT (re-exported via `src/schemas/index.ts:16`). Never hardcode.

### 4. Line Count Claims

Always run `wc -l file.ts`. Never use "~", "approximately", or "around".

### 5. Silent Fallbacks

```typescript
// ❌ if (!sheet) return {};
// ✅ if (!sheet) throw new SheetNotFoundError('Sheet not found', { spreadsheetId, sheetName });
```

### 6. Legacy Envelope Wrapping

Tests need `{ request: { action: 'read_range', ... } }` not `{ action: 'read_range', ... }`.
See `normalizeToolArgs()` in `tool-handlers.ts:81-118`.

### 7. Test Quality Anti-Patterns (ISSUE-237)

```typescript
// ❌ Tautological — always passes regardless of actual value
expect([true, false]).toContain(response.success);
// ✅ Assert the specific expected value
expect(response.success).toBe(false);

// ❌ Non-deterministic — different results each run
const largeData = Array.from({ length: 1000 }, (_, i) => [Math.random(), new Date()]);
// ✅ Deterministic — reproducible across all runs
const largeData = Array.from({ length: 1000 }, (_, i) => [(i + 1) * 10, '2024-01-15']);
```

### 8. Stale Hardcoded Action Names (ISSUE-231, P7-B1)

When renaming an action (e.g. `write_range` → `write`), also update:

- `MUTATION_ACTION_NAMES` in `src/middleware/mutation-actions.constants.ts` (canonical source; both middleware files derive from this)
- `AUTH_EXEMPT_TOOLS` in `src/startup/lifecycle.ts:39`
- Cache invalidation rules in `src/services/cache-invalidation-graph.ts`
- `scripts/check-integration-wiring.mjs` guards

Run `npm run check:integration-wiring` and `npm run check:mutation-actions` after any action rename to catch mismatches.

### 9. MCP Client Behavior (Session 107)

LLM clients using ServalSheets MUST follow these patterns:

- **Startup:** `sheets_auth.status` → `sheets_session.get_context` (shows connectors) → `sheets_session.set_active`
- **After each mutation:** call `sheets_session.record_operation` (or enable `autoRecord` via `update_preferences`)
- **Before writing to formula ranges:** call `sheets_quality.analyze_impact` to assess risk
- **3+ step work:** use `sheets_agent.plan + execute(interactiveMode: true)` — NOT `execute_pipeline`
- **Transactions:** only queue batchable ops (write, format, dimension). `add_note`/`comment_add`/`chart_create` go directly after commit
- **Connectors:** `get_context` response includes `connectors.zeroAuth` (auto-configure) and `connectors.oauthReady`

### 10. Adapter Pattern: packages/mcp-http vs src/http-server

**NOT duplication.** Two different concerns:

- `packages/mcp-http/`: Generic HTTP transport library (publishable as `@serval/mcp-http`)
  - Zero ServalSheets-specific imports — only DI-injected interfaces
  - Implements transport mechanics: SSE, streamable HTTP, rate limiting, CORS, helmet
- `src/http-server/`: ServalSheets-specific wiring layer
  - Imports from `../../packages/mcp-http/dist/` and injects product services
  - OAuth, session context, metrics, RBAC, Google handler bundle — all wired here

**Rule:** Never move code from `src/http-server/` into `packages/mcp-http/` unless it has zero
ServalSheets-specific imports. The package layer must remain product-agnostic.

**See `docs/development/ADVANCED_GOTCHAS.md` for gotchas 11–18** (snapshot updates, safety.confirmed bypass, inferErrorSource utility, convertRangeInputAsync migration, annotateAIGeneratedDraftPlan backfill param, server.json generation, RBAC_STRICT mode, sql_join injection guard).

## Key Files

- `src/server.ts` — MCP server entrypoint
- `src/mcp/registration/*` — Tool + schema registration
- `src/handlers/*` — 25 tool handlers (13 extend BaseHandler, 12 standalone)
- `src/schemas/*` — Zod schemas (validation source of truth)
- `tests/contracts/*` — Contract tests (schema guarantees)
- `src/services/event-bus.ts` — Event bus (memory/Kafka/Pub-Sub/SNS) — `EVENT_BUS_BACKEND`
- `src/connectors/plugin-api.ts` — Third-party connector plugins — `SERVAL_CONNECTOR_PLUGINS`
- `src/security/oidc-provider.ts` — OIDC PKCE SSO — `OIDC_DISCOVERY_URL`, `OIDC_CLIENT_ID`
- `packages/serval-sdk/` — `@serval/sdk` typed client (namespaced MCP access)
- `src/utils/infer-error-source.ts` — **Canonical** error-source heuristic (shared by BaseHandler + mapStandaloneError)
- `src/services/sampling-health-probe.ts` — Real sampling reachability probe (5-min TTL, circuit breaker)
- `scripts/generate-metadata.ts` — **Authoritative source for `server.json`** — edit here, not server.json directly
- `src/handlers/helpers/error-mapping.ts` — `mapStandaloneError()` for 12 standalone handlers
- `tests/snapshots/` — Schema shape snapshots; update with `npx vitest run tests/snapshots -u` after schema changes

## Code Patterns

Response: `this.success('action', data)` (BaseHandler) · `{ response: { success: true, action, ...data } }` (standalone) · `this.mapError(error)` (both).
Errors: `throw new SheetNotFoundError(...)` not `new Error(...)`.
Imports: External → domain → types → config → services → utils → schemas → MCP.
Naming: `handle{Action}` · `createMock{Type}` · `{src}To{target}` · `{Tool}{Action}Input`.

> Full patterns: `docs/development/CLAUDE_CODE_RULES.md`

## Adding a New Action

**Step 1:** Schema in `src/schemas/{tool}.ts` — add to discriminated union
**Step 2:** Handler in `src/handlers/{tool}.ts` — add case + private method
**Step 3:** Test in `tests/handlers/{tool}.test.ts` — success + error paths (no `Math.random()`, no tautological assertions)
**Step 4:** `npm run schema:commit`
**Step 5 (if mutating):** Add action name to `MUTATION_ACTION_NAMES` in `src/middleware/mutation-actions.constants.ts` — canonical source derived by both `audit-middleware.ts` and `write-lock-middleware.ts`. Also add to `MutationEvent['action']` in `src/services/audit-logger-types.ts` (TS compiler enforces membership).
**Step 6 (always):** Add cache invalidation rule in `src/services/cache-invalidation-graph.ts` (use `invalidates: []` for read-only)
**Step 7 (if session-context wired):** Write back with `sessionContext.recordOperation()` — not just read/filter
**Step 8 (if new error code):** Add code to `ErrorCodeSchema` in `src/schemas/shared.ts` before using it in handlers

## Source of Truth

| Metric                  | Source File                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| ACTION_COUNT            | `src/schemas/index.ts`                                                                         |
| TOOL_COUNT              | `src/schemas/index.ts`                                                                         |
| Protocol Version        | `src/constants/protocol.ts` (re-exported via `src/version.ts:14`)                             |
| TOOL_ACTIONS map        | `src/mcp/completions.ts` — verified by `tests/contracts/completions-cross-map.test.ts`        |
| MUTATION_ACTIONS        | `src/middleware/mutation-actions.constants.ts:MUTATION_ACTION_NAMES`                          |
| server.json content     | `scripts/generate-metadata.ts` — **never edit server.json directly**                         |
| Error source inference  | `src/utils/infer-error-source.ts` — used by BaseHandler.mapError + mapStandaloneError         |
| Sampling health         | `src/services/sampling-health-probe.ts` — probes real reachability, 5-min cache               |
| DataQualityIssue types  | `src/schemas/analyze.ts:DataQualityIssueSchema.shape.type` (`DataQualityIssue['type']`)       |
| SafetyOptions schema    | `src/schemas/shared.ts:SafetyOptionsSchema` — includes `confirmed`, `dryRun`, `autoSnapshot` |

Never hardcode these values — always reference the source file with `file:line`.

## Audit Mode

1. Show exact execution path (entrypoint → callsite)
2. Run `npm run verify` and report failures
3. Reproduce bug with failing test
4. Propose minimal patch (≤3 files)
5. No refactors in same PR

## Feature Build Workflow

When implementing a new feature (e.g., F4 Smart Suggestions from `docs/development/FEATURE_PLAN.md`):

1. **Scope**: Read only the feature spec section + target handler/schema. Don't load all 22 handlers.
2. **Schema first**: Add to discriminated union in `src/schemas/{tool}.ts`
3. **Schema commit**: `npm run schema:commit` — do this IMMEDIATELY, not at the end
4. **Service**: Create new service in `src/services/` following existing patterns
5. **Handler**: Add case to switch + private `handle{Action}()` method
6. **Test**: Success + error paths in `tests/handlers/{tool}.test.ts`
7. **Verify**: `npm run verify:safe` (includes drift check, skips lint for memory safety)
8. **Session notes**: Update `.serval/session-notes.md` before ending

## Workflow Anti-Patterns

- **Don't read all handlers at session start** — scope to the module being worked on
- **Don't run full test suite in main context** — delegate to subagent (returns summary vs 5K tokens of output)
- **Don't batch commits** — commit per logical unit (schema change, handler, tests)
- **Don't skip schema:commit** — #1 CI failure cause; PostToolUse hook will remind you
- **Don't modify generated files directly** — `action-counts.ts`, `annotations.ts`, `completions.ts`, `server.json` are generated by `schema:commit`. For `server.json` specifically, edit `scripts/generate-metadata.ts` then run `npm run generate:metadata`.
- **Don't use `verify` in low-memory** — use `verify:safe` (skips ESLint, includes drift check)
- **Don't forget snapshot tests after schema changes** — `check:drift` passes but `tests/snapshots/` will fail; run `npx vitest run tests/snapshots -u` to update

## Subagent Delegation

Use Task tool (subagents) for heavy operations to keep main context clean:

- **Test runs**: `npm run test:fast` — delegate, get pass/fail summary
- **Typecheck**: `npm run typecheck` — delegate, get error list only
- **Audit**: `npm run audit:full` — always delegate (produces massive output)
- **Code exploration**: Use Explore agent for "find all usages of X" searches
- **Verification**: After feature complete, delegate `npm run verify:safe` to subagent

Pattern: `Task(Bash, "Run npm run test:fast in /path/to/project and report pass/fail count + any failures")`

## Hooks

Configured in `.claude/hooks.json`:

- **SessionStart**: Auto-generates `.serval/state.md` with live project metrics
- **Stop**: Prompts to verify tests pass, metadata synced, session notes updated
- **PreToolUse (Bash)**: Blocks destructive git commands (`reset --hard`, `push --force`)
- **PostToolUse (Write/Edit)**: Warns when schema files edited without `schema:commit`

## Known Issues

ESLint may OOM in low-memory environments (~3GB heap) — use `verify:safe`. Silent fallback checker has 0 false positives (all annotated with inline comments).

## Security Features (quick ref)

RFC 7591 DCR registration (`POST /oauth/register`) + RFC 7592 management (`GET`/`PUT`/`DELETE /oauth/register/:id`), RFC 8707 Resource Indicators (`aud` binding), SAML 2.0 SSO (`src/security/saml-provider.ts`), OIDC PKCE SSO (`src/security/oidc-provider.ts`), range-level RBAC (`src/services/rbac-manager.ts`), cross-day hash-chain audit (`src/services/audit-logger.ts`, `AUDIT_PII_REDACTION=true`). Further reading: `docs/development/ARCHITECTURE.md` · `docs/development/CLAUDE_CODE_RULES.md` · `docs/development/PROJECT_STATUS.md`
