# ServalSheets — Complete Production Audit Reference

> **Audit Date**: March 2–3, 2026 | **Branch**: `remediation/phase-1`
> **Server**: 25 tools, 391 actions, MCP Protocol 2025-11-25, v1.7.0
> **Combined Score**: 87.4 / 100 across 28 audit categories, 147 checks
> **Verification Note (March 3, 2026)**: Some findings below are now stale versus verified runtime state. Canonical delta source: `audit-output/production-audit-verification-2026-03-03.md`.

---

## Table of Contents

0. [Verification Delta Addendum (2026-03-03)](#0-verification-delta-addendum-2026-03-03)
1. [Executive Summary](#1-executive-summary)
2. [Phase 1 — Core Engineering Audit (11 Categories)](#2-phase-1--core-engineering-audit)
3. [Phase 2 — Extended Audit (17 Categories)](#3-phase-2--extended-audit)
4. [Context Consumption Analysis](#4-context-consumption-analysis)
5. [Key Files Reference](#5-key-files-reference)
6. [Consolidated Findings](#6-consolidated-findings)
7. [Priority Fix Roadmap](#7-priority-fix-roadmap)
8. [Competitive Position](#8-competitive-position)

---

## 0. Verification Delta Addendum (2026-03-03)

This document remains a full audit narrative, but execution planning should follow the verified delta report and synchronized tracking docs (`TASKS.md`, `UNIFIED_IMPROVEMENT_PLAN.md`, `ISSUES.md`, `MCP_AUDIT_REPORT.md`).

### Findings Reclassified Since Initial Audit Pass

| Finding ID | Initial Status | Verified Status (2026-03-03) | Notes |
|---|---|---|---|
| `SEC-003` (rate limiting) | HIGH / FAIL | Implemented | Runtime middleware now enforces rate controls; treat this as historical debt already addressed. |
| `RESIL-004` (no WAL/journal) | HIGH | Reframed | Core persistence durability is handled by existing stores; remaining architecture decision is webhook Redis hard-requirement vs degraded fallback mode. |
| `TEST-005` (alignment completeness) | HIGH | Fixed | Contract alignment suite includes all 25 tools (`agent`/`compute`/`connectors` included) and passes (`30/30`). |

### Pre-Next-Phase Blockers (Authoritative, Now Closed)

- `audit:coverage` fixture drift is resolved (`1207/1207` pass as of March 3, 2026).
- Runtime error-code emissions were canonicalized for known non-canonical paths (`RATE_LIMIT` -> `RATE_LIMITED`, composite catch path -> `INTERNAL_ERROR`).
- Mutation safety hardening was completed in shared pipeline: centralized formula guard + expanded multi-spreadsheet write-lock orchestration (verified by middleware + fast-suite tests).
- Webhook durability architecture decision is finalized: Redis hard requirement (`WEBHOOK_DURABILITY_MODE=redis_required`), with no degraded in-memory fallback for webhook lifecycle state.

---

## 1. Executive Summary

ServalSheets is a production-grade MCP server for Google Sheets that delivers 25 tools and 391 actions — 4-8x more than any competing Sheets MCP implementation. The audit examined 28 categories across engineering quality, MCP protocol compliance, LLM usability, security, performance, and competitive positioning.

### Score Breakdown

| Audit Phase | Categories | Checks | Score | Grade |
|-------------|-----------|--------|-------|-------|
| Phase 1 — Core Engineering | 11 | 65 | 90.8/100 | A- |
| Phase 2 — Extended | 17 | 82 | 84.7/100 | B+ |
| **Combined Weighted** | **28** | **147** | **87.4/100** | **B+** |

### Critical Findings (2)

- **RESIL-001**: Formula injection — `IMPORTXML`, `INDIRECT`, `IMPORTHTML` pass unvalidated to Google Sheets API
- **RESIL-002**: No per-sheet write locking — concurrent mutations can corrupt data

### High Findings (4)

- **TEST-005**: 3 tools missing from alignment test (agent, compute, connectors = 34 actions, 8.7% untested)
- **RESIL-003**: Redis is hard-required for webhooks with no in-memory fallback
- **RESIL-004**: Transactions are not ACID — no journal/WAL for crash recovery
- **SEC-003**: No rate limiting per-user (quota exhaustion possible)

---

## 2. Phase 1 — Core Engineering Audit

### Category 1: Schema & Type Safety (Score: 95/100)

| Check | Status | Detail |
|-------|--------|--------|
| SCHEMA-001: Zod validation on all inputs | PASS | All 391 actions validated via discriminated unions |
| SCHEMA-002: Output shape validation | PASS | `validateOutputSchema()` advisory check on all responses |
| SCHEMA-003: TypeScript strict mode | PASS | `strict: true` in tsconfig, 0 TS errors |
| SCHEMA-004: No `as any` casts in handlers | PASS | All 21 historical `as any` casts removed (P10-P11) |
| SCHEMA-005: Schema-handler alignment | PARTIAL | `npm run validate:alignment` passes, but alignment test missing 3 tools |
| SCHEMA-006: Discriminated union correctness | PASS | `action` field discriminator on all 25 tool schemas |

**Finding TEST-005 (HIGH)**: `tests/contracts/schema-handler-alignment.test.ts` line 34-57 — TOOLS array has only 22 entries. Missing: `sheets_agent` (8 actions), `sheets_compute` (16 actions), `sheets_connectors` (10 actions) = 34 actions (8.7%) with no contract test coverage.

### Category 2: Error Handling (Score: 88/100)

| Check | Status | Detail |
|-------|--------|--------|
| ERR-001: Structured error classes | PASS | 12 error classes, all extend `ServalError` from @serval/core |
| ERR-002: ErrorCode enum completeness | PARTIAL | Missing `OPERATION_FAILED` and `RATE_LIMIT` (should be `RATE_LIMITED`) |
| ERR-003: No silent fallbacks | PASS | `check:silent-fallbacks` script passes, 0 violations |
| ERR-004: Circuit breaker coverage | PASS | Per-API breakers: Sheets, Drive, BigQuery, Docs, Slides; threshold 5 (BQ/AS: 3) |
| ERR-005: Retry strategy correctness | PASS | 3 retries, 100ms-32s exponential backoff, jitter 0.1, deadline checks |
| ERR-006: Error recovery annotations | PASS | 392 `errorRecovery` blocks in annotations.ts covering all 391 actions |

**Finding ERR-002 (MEDIUM)**: `src/schemas/shared.ts:420-529` — ErrorCodeSchema enum is missing two codes that appear in handler responses. Some handlers return `OPERATION_FAILED` and rate limit errors without matching enum entries.

### Category 3: API Optimization (Score: 96/100)

| Check | Status | Detail |
|-------|--------|--------|
| API-001: Field masks on all reads | PASS | `ENABLE_AGGRESSIVE_FIELD_MASKS=true`, 80-95% payload reduction |
| API-002: ETag conditional requests | PASS | `ENABLE_CONDITIONAL_REQUESTS=true`, 80-100x API call reduction |
| API-003: Request merging | PASS | `ENABLE_REQUEST_MERGING=true`, overlapping ranges merged (20-40% savings) |
| API-004: Batch compilation | PASS | Max 100 ops per `batchUpdate`, adaptive window 20-200ms |
| API-005: Parallel execution | PASS | `ENABLE_PARALLEL_EXECUTOR=true`, 20 concurrent requests, 40% faster for 100+ ranges |
| API-006: No full-column references | PASS | No `A:Z` patterns in handler code (validated by grep) |

**6-Layer Optimization Stack**:
```
Layer 1: Request Merging (overlapping ranges → single request)
Layer 2: Field Masks (95% payload reduction on metadata)
Layer 3: ETag Caching (304 Not Modified, skip re-fetch)
Layer 4: LRU Cache (5-min TTL local cache)
Layer 5: Parallel Executor (20 concurrent for batch reads)
Layer 6: Batch Compiler (100 ops per batchUpdate)
```

### Category 4: Security (Score: 85/100)

| Check | Status | Detail |
|-------|--------|--------|
| SEC-001: OAuth 2.1 implementation | PASS | 3-tier scopes, AES-256-GCM token encryption |
| SEC-002: CSRF protection | PASS | 32-byte random tokens, 10-minute TTL |
| SEC-003: Rate limiting | FAIL | No per-user rate limiting — quota exhaustion possible |
| SEC-004: PII handling | PASS | 13 redaction patterns in audit middleware |
| SEC-005: Token storage | PASS | `EncryptedFileTokenStore` with AES-256-GCM |
| SEC-006: Input sanitization | PARTIAL | Standard Zod validation but no formula injection protection |

### Category 5: Test Quality (Score: 92/100)

| Check | Status | Detail |
|-------|--------|--------|
| TEST-001: Test count vs action count | PASS | 2,444 tests for 391 actions (6.25x ratio) |
| TEST-002: Contract test coverage | PARTIAL | 22/25 tools covered (missing agent, compute, connectors) |
| TEST-003: No tautological assertions | PASS | ISSUE-237 pattern banned, `check:test-quality` script enforces |
| TEST-004: Deterministic test data | PASS | No `Math.random()` or `new Date()` in test fixtures |
| TEST-005: Alignment test completeness | FAIL | 34 actions (8.7%) not in alignment test |
| TEST-006: Error path coverage | PASS | All handlers test success + error paths |

### Category 6: MCP Protocol Compliance (Score: 95/100)

| Check | Status | Detail |
|-------|--------|--------|
| MCP-001: Protocol version | PASS | `2025-11-25` (confirmed latest via web search) |
| MCP-002: STDIO transport | PASS | `McpServer` + `StdioServerTransport` |
| MCP-003: HTTP/SSE transport | PASS | Express + `SSEServerTransport` |
| MCP-004: Streamable HTTP | PASS | `InMemoryEventStore`, cursor-based replay |
| MCP-005: Tool registration | PASS | 25 tools with JSON Schema `inputSchema` |
| MCP-006: Resources | PASS | 2 URI templates + knowledge resources |
| MCP-007: Prompts | PASS | 48 guided workflows |
| MCP-008: Sampling (SEP-1577) | PASS | 7 call sites, GDPR consent gate, adaptive model |
| MCP-009: Elicitation (SEP-1036) | PASS | 10 wizard flows, 6 schema builders, 5s timeout |
| MCP-010: Tasks (SEP-1686) | PASS | 7 long-running operations emit Task IDs |
| MCP-011: Logging | PASS | Dynamic log level via MCP request |
| MCP-012: Completions | PASS | 9 dimensions + 17 action aliases |
| MCP-013: Icons (SEP-973) | PASS | 25 SVG icons |
| MCP-014: Server Instructions | PASS | 1,079-line instructions with 5-GROUP mental model |

### Category 7: Documentation Currency (Score: 82/100)

| Check | Status | Detail |
|-------|--------|--------|
| DOC-001: CLAUDE.md accuracy | PASS | Matches codebase patterns and file references |
| DOC-002: state.md accuracy | PASS | Auto-generated, verified 25 tools / 391 actions |
| DOC-003: CODEBASE_CONTEXT.md | FAIL | Says "391 actions" in 3 locations (stale from Session 46) |
| DOC-004: metadata.json | FAIL | `.agent-context/metadata.json` says 25/391 (actual: 25/391) |
| DOC-005: session-notes.md | PASS | Current through Session 52 |
| DOC-006: FEATURE_PLAN.md | PASS | Accurate feature specs, implementation status marked |

### Category 8: Build & CI (Score: 94/100)

| Check | Status | Detail |
|-------|--------|--------|
| BUILD-001: TypeScript compilation | PASS | `tsc --noEmit` succeeds (0 errors) |
| BUILD-002: Gate pipeline | PASS | G0-G5 all green |
| BUILD-003: Metadata drift check | PASS | `npm run check:drift` passes |
| BUILD-004: Schema commit workflow | PASS | `npm run schema:commit` regenerates all generated files |
| BUILD-005: Placeholder check | PASS | No TODO/FIXME in src/ |
| BUILD-006: Debug print check | PASS | No `console.log` in handlers |

### Category 9: Handler Architecture (Score: 93/100)

| Check | Status | Detail |
|-------|--------|--------|
| HANDLER-001: BaseHandler usage | PASS | 13/25 tools extend BaseHandler (appropriate split) |
| HANDLER-002: Response pattern consistency | PASS | `this.success()` for BaseHandler, `{ response: {...} }` for standalone |
| HANDLER-003: Safety rail coverage | PASS | ~49 destructive ops have confirmation + snapshot |
| HANDLER-004: Switch exhaustiveness | PASS | All 13 BaseHandler subclasses use `never` exhaustiveness check |
| HANDLER-005: Action dispatch correctness | PASS | All 391 actions reachable from entrypoint |

### Category 10: Observability (Score: 88/100)

| Check | Status | Detail |
|-------|--------|--------|
| OBS-001: Prometheus metrics | PASS | 6 metric types: calls, duration, API calls, circuit breaker, cache |
| OBS-002: Distributed tracing | PASS | `TraceAggregator` with LRU cache (5-min TTL, max 1000) |
| OBS-003: Health endpoints | PASS | `/health/live` + `/health/ready` (Kubernetes-ready) |
| OBS-004: Structured logging | PASS | JSON format with request context |
| OBS-005: Audit trail | PASS | `ENABLE_AUDIT_LOGGING=true`, mutation tracking |

### Category 11: Google API Currency (Score: 94/100)

| Check | Status | Detail |
|-------|--------|--------|
| GAPI-001: Sheets API v4 | PASS | Current stable, no breaking changes |
| GAPI-002: Drive API v3 | PASS | Revision access, sharing, activity |
| GAPI-003: BigQuery API | PASS | Connected Sheets support |
| GAPI-004: Apps Script API | PASS | Script execution, triggers |
| GAPI-005: New API features | INFO | =AI() function (additive), Workspace Events API (implemented) |

### Phase 1 Score: 90.8 / 100

---

## 3. Phase 2 — Extended Audit

### Group A: LLM Intelligence & Usability

#### A1: Tool Description Quality (Score: 92/100)

| Check | Status | Detail |
|-------|--------|--------|
| LLM-001: Routing clarity | PASS | Each tool has "Use when" + "NOT this tool" sections |
| LLM-002: Decision trees | PASS | 12 decision trees across descriptions |
| LLM-003: Few-shot examples | PASS | 11 complete request/response examples in instructions |
| LLM-004: Action categorization | PASS | Actions grouped by category in every description |
| LLM-005: Cross-tool references | PASS | Every description links to alternatives |
| LLM-006: Description length variance | PARTIAL | Range: 146 chars (webhook) to 3,489 chars (collaborate) — webhook too sparse |

**Tool Description Stats**:
- Average: 2,388 chars per tool
- Largest: `sheets_collaborate` (3,489 chars, 40 actions)
- Smallest: `sheets_webhook` (146 chars, 10 actions — needs expansion)
- Total: 59,697 chars (~14,924 tokens)

#### A2: Error Recovery Intelligence (Score: 95/100)

| Check | Status | Detail |
|-------|--------|--------|
| LLM-007: errorRecovery coverage | PASS | 392 blocks covering all 391 actions |
| LLM-008: Recovery actionability | PASS | Each block provides specific fix steps, not generic messages |
| LLM-009: Cross-action recovery | PASS | Recovery hints reference other tools (e.g., "verify with sheets_core.list_sheets") |
| LLM-010: Error code mapping | PASS | All error codes map to human-readable guidance |

#### A3: Mental Model & Cognitive Load (Score: 90/100)

| Check | Status | Detail |
|-------|--------|--------|
| LLM-011: 5-GROUP mental model | PASS | Read → Modify → Analyze → Orchestrate → Admin progression |
| LLM-012: Action naming consistency | PASS | Verb-first naming: `read`, `write`, `create`, `delete`, `list` |
| LLM-013: Parameter naming consistency | PASS | `spreadsheetId`, `sheetId`, `range` consistent across all tools |
| LLM-014: Cognitive overload risk | PARTIAL | 391 actions is very large — mitigated by grouping but still high |

#### A4: Session Context Intelligence (Score: 88/100)

| Check | Status | Detail |
|-------|--------|--------|
| LLM-015: "That range" resolution | PASS | Fuzzy matching via `find_by_reference` with 4 reference types |
| LLM-016: Learning from feedback | PASS | `reject_suggestion` + `record_successful_formula` for binary learning |
| LLM-017: Active spreadsheet tracking | PASS | `set_active` / `get_active` persists across calls |
| LLM-018: Operation history | PASS | `get_last_operation` + `get_history` for context continuity |
| LLM-019: Preference persistence | PARTIAL | Preferences stored in memory only — lost on restart |

#### A5: Autocompletion & Aliases (Score: 91/100)

| Check | Status | Detail |
|-------|--------|--------|
| LLM-020: Completion dimensions | PASS | 9 dimensions: spreadsheetId, range, sheetName, action, etc. |
| LLM-021: Action aliases | PASS | 17 aliases (e.g., "read_range" → "read", "write_range" → "write") |
| LLM-022: Recent entity cache | PASS | LRU caches for recently used spreadsheet IDs and ranges |
| LLM-023: Schema discovery | PASS | `schema://tools/{toolName}` resource for dynamic schema access |

### Group B: Advanced MCP Feature Depth

#### B1: Sampling Integration (Score: 93/100)

| Check | Status | Detail |
|-------|--------|--------|
| SAMP-001: Call site count | PASS | 7 sampling call sites across analyze, fix, suggest, generate |
| SAMP-002: GDPR consent gate | PASS | User data only sent to sampling with consent check |
| SAMP-003: Adaptive model selection | PASS | Haiku for simple, Sonnet for complex analysis |
| SAMP-004: JSON schema constraints | PASS | All sampling requests use structured output schemas |
| SAMP-005: Graceful degradation | PASS | All sampling calls have non-AI fallback paths |

**Sampling Call Sites**:
1. `analyzeData()` — comprehensive data analysis
2. `generateFormula()` — AI formula generation
3. `recommendChart()` — chart type suggestion
4. `explainFormula()` — plain-language formula explanation
5. `identifyDataIssues()` — data quality detection
6. `analyzeDataStreaming()` — streaming analysis
7. `streamAgenticOperation()` — multi-step agentic flows

#### B2: Elicitation Integration (Score: 91/100)

| Check | Status | Detail |
|-------|--------|--------|
| ELIC-001: Wizard flow count | PASS | 10 interactive wizard flows |
| ELIC-002: Schema builder types | PASS | 6 types: text, number, boolean, enum, date, email |
| ELIC-003: Destructive op confirmation | PASS | 49 destructive ops confirmed via elicitation |
| ELIC-004: Timeout handling | PASS | 5-second fail-safe timeout on all elicitation |
| ELIC-005: Client capability check | PASS | Graceful skip when client doesn't support elicitation |

**Wizard Flows**:
1. `chart_create` — 2-step: chart type → title
2. `add_conditional_format_rule` — 1-step: rule preset selection
3. `create` (spreadsheet) — 1-step: title + locale + timezone
4. `begin` (transaction) — 1-step: description for audit trail
5. `share_add` — 1-step: email + role + notification
6-10. Various destructive operation confirmations

#### B3: Task & Background Operations (Score: 89/100)

| Check | Status | Detail |
|-------|--------|--------|
| TASK-001: Task-capable operations | PASS | 7 long-running ops emit Task IDs |
| TASK-002: Task store adapter | PASS | `TaskStoreAdapter` in `core/task-store-adapter.ts` |
| TASK-003: Progress reporting | PARTIAL | `sendProgress()` works per-request but not streamed as notifications |
| TASK-004: Cancellation support | PASS | Tasks can be cancelled via Task ID |

**Task-Capable Operations**: `export_to_bigquery`, `import_from_bigquery`, `run` (AppsScript), `export_large_dataset`, `timeline`, `call_remote`, `list_servers`, `get_server_tools`, `validate_connection`

#### B4: Resource & Knowledge System (Score: 86/100)

| Check | Status | Detail |
|-------|--------|--------|
| RES-001: URI template resources | PASS | 2 URI templates for dynamic schema access |
| RES-002: Knowledge resources | PASS | Tool documentation available as resources |
| RES-003: Resource freshness | PARTIAL | No cache invalidation on resource reads |

#### B5: Prompt Workflow Coverage (Score: 90/100)

| Check | Status | Detail |
|-------|--------|--------|
| PROMPT-001: Workflow count | PASS | 48 guided workflows registered |
| PROMPT-002: Parameter elicitation | PASS | All prompts define required + optional parameters |
| PROMPT-003: Multi-step sequencing | PASS | Complex workflows have step-by-step execution |
| PROMPT-004: Coverage vs actions | PARTIAL | 48 prompts for 391 actions (12.3% coverage by prompt) |

### Group C: Resilience & Edge Cases

#### C1: Formula Injection Protection (Score: 30/100)

| Check | Status | Detail |
|-------|--------|--------|
| RESIL-001: Dangerous function filtering | CRITICAL FAIL | `IMPORTXML`, `INDIRECT`, `IMPORTHTML` pass unvalidated |
| RESIL-002: Formula AST validation | FAIL | `formula-parser.ts` exists (14K lines) but not used for input validation |
| RESIL-003: User-supplied formula sanitization | FAIL | Formulas written directly to Google Sheets API |

**Impact**: An attacker could craft formulas that exfiltrate data via `IMPORTXML` to an external server. The existing `formula-parser.ts` (14,047 lines) already has AST parsing capability — it just needs a whitelist validator wrapping it.

**Proposed Fix**: Add `validateFormulaInput()` that parses formulas through the existing AST parser and rejects functions on a blocklist (`IMPORTXML`, `IMPORTHTML`, `IMPORTFEED`, `IMPORTRANGE` without explicit approval, `INDIRECT` with external references).

#### C2: Concurrent Safety (Score: 40/100)

| Check | Status | Detail |
|-------|--------|--------|
| RESIL-004: Per-sheet write locking | CRITICAL FAIL | No mutex per spreadsheet — concurrent writes can interleave |
| RESIL-005: Optimistic concurrency | PARTIAL | ETag-based advisory locks exist but are not enforced |
| RESIL-006: Transaction isolation | FAIL | `TransactionManager` uses in-memory state only, no journal/WAL |

**Impact**: Two Claude sessions writing to the same spreadsheet simultaneously can produce corrupted data. The existing `ConcurrencyCoordinator` manages API quota but not logical write ordering.

**Proposed Fix**: Add `PQueue` with concurrency=1 per spreadsheetId in the middleware layer, wrapping all mutation operations.

#### C3: Infrastructure Resilience (Score: 65/100)

| Check | Status | Detail |
|-------|--------|--------|
| RESIL-007: Redis dependency | HIGH | Webhooks hard-require Redis — no in-memory fallback |
| RESIL-008: Token refresh race | PASS | `PQueue` concurrency=1 prevents concurrent refreshes |
| RESIL-009: Circuit breaker recovery | PASS | 30s reset timeout, read-only fallback for Sheets |
| RESIL-010: Memory leak protection | PASS | LRU caches with max size + TTL eviction |
| RESIL-011: HTTP/2 GOAWAY handling | PASS | `ENABLE_AUTO_CONNECTION_RESET=true` |

#### C4: Data Integrity (Score: 72/100)

| Check | Status | Detail |
|-------|--------|--------|
| RESIL-012: Snapshot before destructive ops | PASS | ~20 handlers call `createSnapshotIfNeeded()` |
| RESIL-013: Undo reliability | PASS | `HistoryService` tracks operations, undo reverses them |
| RESIL-014: Transaction rollback | PARTIAL | Rollback exists but no crash recovery (in-memory only) |
| RESIL-015: Idempotency | PASS | `ENABLE_IDEMPOTENCY=true`, retry-safe deduplication |

### Group D: Competitive & Architectural

#### D1: Competitive Differentiation (Score: 94/100)

| Check | Status | Detail |
|-------|--------|--------|
| COMP-001: Action count vs competitors | PASS | 391 actions vs ~50-100 for closest competitor |
| COMP-002: MCP feature coverage | PASS | Only server with full MCP 2025-11-25 (12/12 capabilities) |
| COMP-003: Exclusive features | PASS | 9 features no competitor offers |
| COMP-004: API optimization depth | PASS | 6-layer optimization stack unique in market |

**Exclusive Features (no competitor offers)**:
1. Cross-spreadsheet federation (join/query/compare across sheets)
2. AI-powered sheet generation from natural language
3. Scenario modeling with dependency cascade
4. Time-travel debugging with surgical cell restore
5. Automated data cleaning pipeline
6. Smart suggestions / copilot mode
7. MCP Sampling integration for AI analysis
8. MCP Elicitation for interactive wizards
9. Formula dependency graph with impact analysis

#### D2: Architecture Scalability (Score: 88/100)

| Check | Status | Detail |
|-------|--------|--------|
| ARCH-001: Handler decomposition readiness | PARTIAL | P18-D1–D10 deferred; file-size budget system in place |
| ARCH-002: Adapter layer | PASS | 4 backends: Google Sheets (active), Excel Online, Notion, Airtable (scaffolds) |
| ARCH-003: Monorepo structure | PASS | `@serval/core` v0.1.0 with `SpreadsheetBackend` interface |
| ARCH-004: Feature flag system | PASS | 20 flags in `src/config/env.ts`, all runtime-toggleable |

#### D3: Deployment Readiness (Score: 85/100)

| Check | Status | Detail |
|-------|--------|--------|
| DEPLOY-001: Health endpoints | PASS | `/health/live` + `/health/ready` |
| DEPLOY-002: Graceful shutdown | PASS | Signal handlers for SIGTERM/SIGINT |
| DEPLOY-003: Environment config | PASS | All config via environment variables |
| DEPLOY-004: Multi-transport | PASS | STDIO + HTTP/SSE + Streamable HTTP |
| DEPLOY-005: Metrics export | PARTIAL | Prometheus metrics defined but `ENABLE_METRICS_SERVER=OFF` by default |

### Phase 2 Score: 84.7 / 100

---

## 4. Context Consumption Analysis

### What Claude Receives on Startup

When Claude connects to ServalSheets via MCP, information loads in **5 distinct layers**:

#### Layer 1: Tool Discovery (~17,000 tokens) — Loaded Immediately

| Component | Source File | Chars | Tokens |
|-----------|-----------|-------|--------|
| 25 tool JSON Schemas | `server.json` | 8,413 | ~2,100 |
| 25 tool descriptions | `src/schemas/descriptions.ts` | 59,697 | ~14,900 |
| **TOTAL** | | **68,110** | **~17,000** |

This is what Claude sees in the `tools/list` MCP response. Each tool includes a `name`, `description`, and `inputSchema` (JSON Schema derived from Zod definitions).

**Per-Tool Description Sizes**:

| Tool | Chars | ~Tokens | Actions |
|------|-------|---------|---------|
| sheets_collaborate | 3,489 | ~426 | 40 |
| sheets_dependencies | 3,618 | ~456 | 10 |
| sheets_dimensions | 3,394 | ~508 | 29 |
| sheets_advanced | 3,477 | ~489 | 31 |
| sheets_composite | 3,359 | ~533 | 20 |
| sheets_analyze | 3,145 | ~472 | 19 |
| sheets_data | 2,922 | ~381 | 23 |
| sheets_core | 2,917 | ~465 | 19 |
| sheets_compute | 2,925 | ~350 | 16 |
| sheets_format | 2,812 | ~337 | 24 |
| sheets_visualize | 2,641 | ~333 | 18 |
| sheets_history | 2,570 | ~368 | 10 |
| sheets_session | 2,530 | ~372 | 31 |
| sheets_fix | 2,360 | ~313 | 6 |
| sheets_federation | 2,279 | ~293 | 4 |
| sheets_transaction | 2,185 | ~363 | 6 |
| sheets_quality | 1,924 | ~250 | 4 |
| sheets_confirm | 2,070 | ~328 | 5 |
| sheets_connectors | 2,125 | ~296 | 10 |
| sheets_templates | 1,611 | ~226 | 8 |
| sheets_appsscript | 1,638 | ~233 | 19 |
| sheets_agent | 1,565 | ~267 | 8 |
| sheets_bigquery | 1,489 | ~203 | 17 |
| sheets_auth | 506 | ~82 | 4 |
| sheets_webhook | 146 | ~20 | 10 |

#### Layer 2: Server Instructions (~6,200 tokens) — Sent Once Per Session

| Component | Source File | Lines | Chars | Tokens |
|-----------|-----------|-------|-------|--------|
| Operating manual | `src/mcp/features-2025-11-25.ts` | ~700 | 39,926 | ~6,189 |

**Contents**:
- 5-GROUP mental model (Read → Modify → Analyze → Orchestrate → Admin)
- 12 decision trees for common task routing
- 11 few-shot examples with complete request/response pairs
- Shared context rules (range format, batch optimization, prerequisites)
- Safety rules for destructive operations
- MCP feature awareness (Sampling, Elicitation, Tasks, Completions)

#### Layer 3: Action Annotations (~52,500 tokens) — Runtime / On-Demand

| Component | Source File | Lines | Chars | Tokens |
|-----------|-----------|-------|-------|--------|
| Per-action metadata | `src/schemas/annotations.ts` | 10,290 | 390,598 | ~52,456 |

This is the **single largest file** in the project. It contains 391 action-level entries, each with:
- 392 `errorRecovery` blocks (specific fix instructions per error code)
- Parameter guidance (required/optional, format examples, valid ranges)
- Cross-action suggestions ("after this action, consider...")

**Not sent upfront** — loaded when Claude processes tool call results or requests schema details.

#### Layer 4: Guided Workflows (~21,700 tokens) — On Prompt Invocation

| Component | Source File | Lines | Chars | Tokens |
|-----------|-----------|-------|-------|--------|
| 48 workflow prompts | `src/mcp/registration/prompt-registration.ts` | 5,132 | 145,091 | ~21,753 |

Multi-step workflow templates like "Import CSV and format", "Set up tracking sheet", "Create chart from data range". Only loaded when a specific prompt is invoked.

#### Layer 5: Completions & Resources (~5,000 tokens) — On-Demand

| Component | Source File | Chars | Tokens |
|-----------|-----------|-------|--------|
| Autocompletion | `src/mcp/completions.ts` | 31,873 | ~3,689 |
| Resource definitions | `src/mcp/registration/resource-registration.ts` | 11,605 | ~1,351 |
| **TOTAL** | | **43,478** | **~5,040** |

### Context Budget Summary

| Layer | When Loaded | Tokens | Cumulative |
|-------|------------|--------|-----------|
| L1: Tool Discovery | Immediately | ~17,000 | 17,000 |
| L2: Server Instructions | Session start | ~6,200 | 23,200 |
| L3: Action Annotations | Per tool call | ~52,500 | 75,700 |
| L4: Workflow Prompts | On invocation | ~21,700 | 97,400 |
| L5: Completions + Resources | On demand | ~5,000 | 102,400 |

**Practical startup cost**: ~23,200 tokens (L1 + L2)
**Maximum if all layers load**: ~102,400 tokens

### Scaling Math

Each new action adds approximately:
- ~134 tokens to annotations
- ~38 tokens to descriptions
- ~22 tokens to server.json
- **~194 tokens per action**

Each new tool (averaging 15 actions) adds approximately **~6,625 tokens** total.

At 391 actions, the server fits comfortably within Claude's 200K context window even if all layers load simultaneously.

---

## 5. Key Files Reference

### Files Claude Reads (MCP Protocol)

| Priority | File | Purpose | Tokens |
|----------|------|---------|--------|
| P0 | `src/schemas/descriptions.ts` | Tool routing decisions | ~14,900 |
| P0 | `server.json` | JSON Schema for all 391 inputs | ~2,100 |
| P1 | `src/mcp/features-2025-11-25.ts` | Mental model, decision trees, examples | ~6,200 |
| P2 | `src/schemas/annotations.ts` | Error recovery, action metadata | ~52,500 |
| P3 | `src/mcp/registration/prompt-registration.ts` | 48 workflow templates | ~21,700 |
| P3 | `src/mcp/completions.ts` | Autocomplete intelligence | ~3,700 |
| P4 | `src/mcp/registration/resource-registration.ts` | Schema URI templates | ~1,400 |

### Files That Define Server Behavior (Not Sent to Claude)

| File | Lines | Purpose |
|------|-------|---------|
| `src/server.ts` | 1,898 | MCP server entrypoint, tool registration |
| `src/http-server.ts` | 3,292 | HTTP/SSE + Streamable HTTP transports |
| `src/handlers/base.ts` | 1,569 | BaseHandler: batching, snapshots, verbosity, errors |
| `src/mcp/registration/tool-handlers.ts` | 2,030 | Request pipeline: normalize → validate → dispatch → respond |
| `src/mcp/sampling.ts` | 960 | 7 sampling call sites with GDPR consent gate |
| `src/mcp/elicitation.ts` | 759 | 10 wizard flows, 6 schema builders |

### Schema Files (Zod → JSON Schema)

| File | Lines | Actions |
|------|-------|---------|
| `src/schemas/collaborate.ts` | 869 | 40 |
| `src/schemas/advanced.ts` | 858 | 31 |
| `src/schemas/dimensions.ts` | 992 | 29 |
| `src/schemas/format.ts` | 1,039 | 24 |
| `src/schemas/data.ts` | 1,110 | 23 |
| `src/schemas/composite.ts` | 1,535 | 20 |
| `src/schemas/analyze.ts` | 2,208 | 19 |
| `src/schemas/core.ts` | 831 | 19 |
| `src/schemas/appsscript.ts` | 705 | 19 |
| `src/schemas/visualize.ts` | 769 | 18 |
| `src/schemas/bigquery.ts` | 600 | 17 |
| `src/schemas/compute.ts` | 685 | 16 |
| `src/schemas/session.ts` | 758 | 31 |
| `src/schemas/connectors.ts` | 368 | 10 |
| `src/schemas/dependencies.ts` | 359 | 10 |
| `src/schemas/history.ts` | 404 | 10 |
| `src/schemas/webhook.ts` | 383 | 10 |
| `src/schemas/agent.ts` | 365 | 8 |
| `src/schemas/templates.ts` | 344 | 8 |
| `src/schemas/fix.ts` | 503 | 6 |
| `src/schemas/transaction.ts` | 246 | 6 |
| `src/schemas/confirm.ts` | 352 | 5 |
| `src/schemas/auth.ts` | 106 | 4 |
| `src/schemas/federation.ts` | 193 | 4 |
| `src/schemas/quality.ts` | 405 | 4 |

### Handler Files (Execution Logic)

| File | Lines | Type | Actions |
|------|-------|------|---------|
| `src/handlers/format.ts` | 3,128 | BaseHandler | 24 |
| `src/handlers/data.ts` | 2,979 | BaseHandler | 23 |
| `src/handlers/analyze.ts` | 2,625 | BaseHandler | 19 |
| `src/handlers/core.ts` | 2,013 | BaseHandler | 19 |
| `src/handlers/collaborate.ts` | 1,943 | BaseHandler | 40 |
| `src/handlers/visualize.ts` | 1,865 | BaseHandler | 18 |
| `src/handlers/advanced.ts` | 1,766 | BaseHandler | 31 |
| `src/handlers/dimensions.ts` | 1,439 | BaseHandler | 29 |
| `src/handlers/composite.ts` | 1,242 | BaseHandler | 20 |
| `src/handlers/session.ts` | 646 | Standalone | 31 |
| `src/handlers/auth.ts` | 577 | Standalone | 4 |
| `src/handlers/fix.ts` | 557 | Standalone | 6 |
| `src/handlers/confirm.ts` | 425 | Standalone | 5 |
| `src/handlers/dependencies.ts` | 377 | Standalone | 10 |
| `src/handlers/quality.ts` | 309 | Standalone | 4 |
| `src/handlers/federation.ts` | 272 | Standalone | 4 |
| + 9 more standalone handlers | — | — | — |

---

## 6. Consolidated Findings

### All Findings by Severity

#### CRITICAL (2)

| ID | Category | Finding | Impact | Proposed Fix |
|----|----------|---------|--------|-------------|
| RESIL-001 | Formula Injection | `IMPORTXML`/`INDIRECT`/`IMPORTHTML` pass unvalidated to Google Sheets API | Data exfiltration via crafted formulas | Add `validateFormulaInput()` using existing `formula-parser.ts` AST with function blocklist |
| RESIL-002 | Concurrent Safety | No per-sheet write locking — concurrent mutations interleave | Data corruption on parallel writes | Add `PQueue` per-spreadsheetId in middleware wrapping all mutation ops |

#### HIGH (4)

| ID | Category | Finding | Impact | Proposed Fix |
|----|----------|---------|--------|-------------|
| TEST-005 | Test Coverage | 3 tools missing from alignment test (34 actions, 8.7%) | Schema-handler drift undetected for agent/compute/connectors | Add `sheets_agent`, `sheets_compute`, `sheets_connectors` to TOOLS array in alignment test |
| RESIL-003 | Infrastructure | Redis hard-required for webhooks, no fallback | Webhook tool unusable without Redis | Add `InMemoryWebhookStore` fallback with degradation warning |
| RESIL-004 | Transactions | No journal/WAL for crash recovery | Uncommitted transaction state lost on crash | Add JSON file persistence for transaction journal |
| SEC-003 | Security | No per-user rate limiting | Single user can exhaust Google API quota | Add token-bucket rate limiter in middleware |

#### MEDIUM (5)

| ID | Category | Finding | Impact | Proposed Fix |
|----|----------|---------|--------|-------------|
| ERR-002 | Error Handling | Missing `OPERATION_FAILED` and `RATE_LIMIT` error codes | Handler responses use codes not in enum | Add codes to `ErrorCodeSchema` in shared.ts |
| DOC-003 | Documentation | CODEBASE_CONTEXT.md says "391 actions" (3 locations) | Stale documentation misleads developers | Update to 391 |
| DOC-004 | Documentation | metadata.json says 25/391 | Stale metadata | Regenerate metadata.json |
| LLM-006 | LLM Usability | `sheets_webhook` description only 146 chars (10 actions) | Claude may not route webhook requests correctly | Expand to match other tool description quality (~2,000+ chars) |
| LLM-019 | Session Context | Preferences stored in memory only | User preferences lost on server restart | Add file-based persistence option |

#### LOW (3)

| ID | Category | Finding | Impact | Proposed Fix |
|----|----------|---------|--------|-------------|
| LLM-014 | Cognitive Load | 391 actions is high cognitive load | Claude may occasionally pick wrong action | Mitigated by 5-GROUP model; consider progressive disclosure |
| DEPLOY-005 | Deployment | Metrics server OFF by default | No production monitoring without manual enable | Document in deployment guide |
| PROMPT-004 | Workflows | 48 prompts for 391 actions (12.3% coverage) | Most actions have no guided workflow | Add prompts for top 20 most-used actions |

---

## 7. Priority Fix Roadmap

Historical snapshot from the initial audit pass. Current execution priorities are maintained in `TASKS.md` and `UNIFIED_IMPROVEMENT_PLAN.md` (post-P19 backlog).

### P0 — Security Critical (Fix Immediately)

| Fix | Files Changed | Effort |
|-----|--------------|--------|
| Formula injection validator | `src/services/formula-validator.ts` (NEW), `src/handlers/data.ts` | 2-3 hours |
| Per-sheet write locking | `src/middleware/write-lock.ts` (NEW), `src/server.ts` | 2-3 hours |

### P1 — High Impact (Fix This Sprint)

| Fix | Files Changed | Effort |
|-----|--------------|--------|
| Add 3 tools to alignment test | `tests/contracts/schema-handler-alignment.test.ts` | 30 minutes |
| In-memory webhook fallback | `src/services/webhook-manager.ts` | 2-3 hours |
| Transaction journal persistence | `src/services/transaction-manager.ts` | 3-4 hours |
| Per-user rate limiting | `src/middleware/rate-limiter.ts` (NEW), `src/server.ts` | 2-3 hours |

### P2 — Medium Impact (Fix This Month)

| Fix | Files Changed | Effort |
|-----|--------------|--------|
| Add missing error codes | `src/schemas/shared.ts` | 15 minutes |
| Update stale doc counts | `docs/development/CODEBASE_CONTEXT.md`, `.agent-context/metadata.json` | 15 minutes |
| Expand webhook description | `src/schemas/descriptions.ts` | 30 minutes |
| Preference persistence | `src/services/session-context.ts` | 1-2 hours |

### P3 — Low Impact (Backlog)

| Fix | Files Changed | Effort |
|-----|--------------|--------|
| Progressive action disclosure | `src/schemas/descriptions.ts`, `src/mcp/features-2025-11-25.ts` | 4-6 hours |
| Metrics server documentation | `docs/deployment/` | 1 hour |
| Additional workflow prompts | `src/mcp/registration/prompt-registration.ts` | 4-6 hours |

---

## 8. Competitive Position

### ServalSheets vs Market

| Dimension | ServalSheets | Best Competitor | Gap |
|-----------|-------------|----------------|-----|
| Total actions | 391 | ~50-100 | 4-8x more |
| MCP capabilities used | 12/12 | 2-4/12 | Only full implementation |
| Tool descriptions | 59,697 chars with decision trees | ~500-2,000 chars generic | 30-120x richer |
| Error recovery | 392 action-specific blocks | None | Exclusive |
| AI integration | 7 sampling sites + 10 wizards | None | Exclusive |
| API optimization | 6-layer stack | Basic retry only | Exclusive |
| Cross-spreadsheet | 4 federation actions | None | Exclusive |
| Scenario modeling | 3 actions with dependency cascade | None | Exclusive |
| Session intelligence | Fuzzy reference resolution + learning | None | Exclusive |

### Unique Selling Propositions

1. **Only MCP server with full 2025-11-25 protocol support** (12/12 capabilities)
2. **391 actions** — 4-8x more than any competitor
3. **AI-powered features** — sheet generation, smart suggestions, scenario modeling
4. **6-layer API optimization** — 80-100x API call reduction
5. **Production-grade safety** — snapshots, confirmations, idempotency, audit trail

---

## Appendix: Verification Commands

```bash
# Core verification
npm run verify              # Full pipeline (typecheck + lint + test + drift)
npm run verify:safe         # Safe mode (skips lint, for low-memory environments)
npm run schema:commit       # After ANY schema change

# Quick checks
npm run test:fast           # 2,444 tests (~30s)
npm run typecheck           # TypeScript strict mode
npm run check:drift         # Metadata sync verification
npm run validate:alignment  # Schema-handler alignment
npm run validate:mcp-protocol  # MCP protocol conformance suites

# Quality gates
npm run gates               # G0-G5 validation pipeline
npm run check:placeholders  # No TODO/FIXME in src/
npm run check:debug-prints  # No console.log in handlers
npm run check:silent-fallbacks  # No silent {} returns

# Audit suite
npm run audit:coverage      # Action fixture/schema coverage gate
npm run audit:perf          # Performance benchmarks
npm run audit:memory        # Memory leak detection
npm run audit:gate          # CI gate (7 checks)
npm run audit:full          # All of the above
```

---

*Generated: March 3, 2026 | Audit by Claude Opus 4.6 | Branch: remediation/phase-1*
