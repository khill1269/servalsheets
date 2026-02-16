# ServalSheets v1.6.0 — Full Codebase Audit

**Date:** February 5, 2026
**Scope:** Dependencies, MCP compliance, feature wiring, Google best practices, OAuth/security, TypeScript/build, testing
**Mode:** Read-only audit (no code changes)

---

## Executive Summary

ServalSheets is a production-grade MCP server for Google Sheets with 21 tools and 293 actions. After tracing every layer of the codebase — from npm dependencies through MCP registration, handler wiring, Google API integration, OAuth security, and testing infrastructure — the project is in strong shape overall.

**Overall Score: 93/100**

| Area | Score | Verdict |
|------|-------|---------|
| MCP Protocol Compliance | 98% | Excellent — one doc mismatch |
| Feature Wiring (21 tools) | 100% | All tools fully wired end-to-end |
| Google Sheets Best Practices | 100% | All 13 best practices implemented |
| OAuth & Security | 90% | Strong — 3 minor hardening items |
| Dependencies | 75% | 1 HIGH vulnerability needs immediate fix |
| TypeScript & Build | 95% | Strict mode, boundaries, solid pipeline |
| Testing Infrastructure | 95% | 206 test files, 100% tool coverage |

---

## 1. CRITICAL — Fix Immediately

### 1.1 @modelcontextprotocol/sdk Vulnerability (HIGH)

- **Current:** 1.25.2
- **Fix:** Upgrade to 1.26.0
- **Issue:** Cross-client data leak via shared server/transport instance reuse (GHSA-345p-7cg4-v4c7)
- **Transitive:** Also fixes 4 hono CVEs (XSS, cache bypass, IP validation bypass)
- **Action:** `npm install @modelcontextprotocol/sdk@1.26.0`
- **Side benefit:** SDK 1.26.0 adds capability type declarations for `sampling` and `elicitation`, resolving the two SDK limitation comments in features-2025-11-25.ts

---

## 2. IMPORTANT — Action Count Mismatch

### 2.1 server.json vs package.json Discrepancy

| File | Says |
|------|------|
| package.json | "293 actions" |
| server.json (line 4) | "293 actions" |
| manifest.json | "293 actions" |
| Source of truth (schemas/index.ts) | ACTION_COUNT = 293 |

**Action:** Update server.json description from "293 actions" to "293 actions"

---

## 3. Dependencies Audit

### 3.1 Outdated Packages

| Package | Current | Latest | Priority |
|---------|---------|--------|----------|
| @modelcontextprotocol/sdk | 1.25.2 | 1.26.0 | CRITICAL (vulnerability) |
| googleapis | 170.1.0 | 171.3.0 | Important (major version) |
| @types/node | 22.19.7 | 25.2.1 | Low (devDep, 3 major behind) |
| turbo | 2.7.6 | 2.8.3 | Low (devDep) |
| dotenv | 17.2.3 | 17.2.4 | Low (patch) |
| cspell | 9.6.2 | 9.6.4 | Low (patch) |

### 3.2 Up-to-Date (Confirmed Current)

- zod: 4.3.6 (latest Zod 4)
- TypeScript: 5.9.3 (latest)
- vitest: 4.0.16 (latest)
- express: 5.2.1 (latest Express 5)
- winston: 3.17.0 (latest)

### 3.3 Lock File Status

In sync — no warnings or resolution issues.

---

## 4. MCP Protocol 2025-11-25 Compliance

### 4.1 Feature Implementation Status

| MCP Feature | Status | Notes |
|-------------|--------|-------|
| Protocol version declaration | PASS | "2025-11-25" in server.json and features file |
| 21 tools registered | PASS | All defined, mapped, and wired |
| 293 actions | PASS | Source of truth in schemas/index.ts |
| Tool annotations (4 hints) | PASS | readOnlyHint, destructiveHint, idempotentHint, openWorldHint on all 21 |
| Tool naming (SEP-986) | PASS | All snake_case |
| Tool icons (SEP-973) | PASS | All 21 tools have base64 SVG icons |
| Structured outputs | PASS | content + structuredContent on all tools |
| Discriminated unions | PASS | action field in request, success in response |
| SEP-1577 Sampling | PASS | 960-line implementation, used by sheets_analyze |
| SEP-1036 Elicitation | PASS | 759-line implementation, used by sheets_confirm |
| SEP-1686 Tasks | PASS | Task store adapter, 8 tools with task support |
| Completions | PASS | 293 actions + 70+ aliases |
| Resources | PASS | Spreadsheet, schema, chart, pivot, quality URIs |
| Prompts | PASS | 6 guided workflows |
| Logging | PASS | Winston + MCP dynamic log levels |
| Server instructions | PASS | 1,139 lines of LLM context guidance |
| STDIO transport | PASS | Default transport for Claude Desktop |
| HTTP transport | PASS | Express + SSE + streaming |

### 4.2 SDK Limitations (Not Code Issues)

- `sampling` and `elicitation` capabilities cannot be declared in ServerCapabilities with SDK 1.25.x — both features work correctly but aren't advertised. SDK 1.26.0 should resolve this.
- Tool argument completions limited to prompts/resources in SDK 1.25.x — schema resources and server instructions compensate.

---

## 5. Feature Wiring Verification (21/21 Tools)

Every tool was traced through the full chain:

```
tool-definitions.ts → tool-handlers.ts → handlers/index.ts → handler file → schema file → completions.ts
```

| Tool | Defined | Mapped | Handler | Schema | Completions | Result |
|------|---------|--------|---------|--------|-------------|--------|
| sheets_auth | Yes | Yes | auth.ts | auth.ts | 4 actions | WIRED |
| sheets_core | Yes | Yes | core.ts | core.ts | 17 actions | WIRED |
| sheets_data | Yes | Yes | data.ts | data.ts | 18 actions | WIRED |
| sheets_format | Yes | Yes | format.ts | format.ts | 21 actions | WIRED |
| sheets_dimensions | Yes | Yes | dimensions.ts | dimensions.ts | 28 actions | WIRED |
| sheets_visualize | Yes | Yes | visualize.ts | visualize.ts | 18 actions | WIRED |
| sheets_collaborate | Yes | Yes | collaborate.ts | collaborate.ts | 37 actions | WIRED |
| sheets_advanced | Yes | Yes | advanced.ts | advanced.ts | 23 actions | WIRED |
| sheets_transaction | Yes | Yes | transaction.ts | transaction.ts | 6 actions | WIRED |
| sheets_quality | Yes | Yes | quality.ts | quality.ts | 4 actions | WIRED |
| sheets_history | Yes | Yes | history.ts | history.ts | 7 actions | WIRED |
| sheets_confirm | Yes | Yes | confirm.ts | confirm.ts | 5 actions | WIRED |
| sheets_analyze | Yes | Yes | analyze.ts | analyze.ts | 16 actions | WIRED |
| sheets_fix | Yes | Yes | fix.ts | fix.ts | 1 action | WIRED |
| sheets_composite | Yes | Yes | composite.ts | composite.ts | 10 actions | WIRED |
| sheets_session | Yes | Yes | session.ts | session.ts | 17 actions | WIRED |
| sheets_templates | Yes | Yes | templates.ts | templates.ts | 8 actions | WIRED |
| sheets_bigquery | Yes | Yes | bigquery.ts | bigquery.ts | 14 actions | WIRED |
| sheets_appsscript | Yes | Yes | appsscript.ts | appsscript.ts | 14 actions | WIRED |
| sheets_webhook | Yes | Yes | webhooks.ts | webhook.ts | 6 actions | WIRED |
| sheets_dependencies | Yes | Yes | dependencies.ts | dependencies.ts | 7 actions | WIRED |

No broken links, orphaned handlers, or partially wired tools.

---

## 6. Google Sheets API Best Practices

All 13 recommended Google best practices verified:

| Best Practice | Implemented | How |
|---------------|-------------|-----|
| Exponential backoff + jitter | Yes | retry.ts — configurable base/max delay, 20% jitter, respects Retry-After header |
| Batch requests | Yes | batching-system.ts — 50-100ms windows, adaptive sizing, max 100 ops |
| Field masks | Yes | 20+ pre-built masks, 60-95% payload reduction documented |
| Rate limiting (100/100s) | Yes | Token bucket algorithm, per-read/write buckets, adaptive throttle on 429 |
| ETag caching | Yes | L1 memory (5min) + L2 Redis (10min), 304 support |
| Quota management | Yes | All official limits in google-limits.ts, monitoring, error tracking |
| Connection pooling | Yes | HTTP/1.1 + HTTP/2 ALPN, keepAlive, LIFO scheduling, 50 max sockets |
| HTTP/2 support | Yes | Auto-detection via googleapis ALPN |
| Error handling (403, 429, 5xx) | Yes | Retryable status set, HTTP/2 GOAWAY handling, circuit breakers |
| Partial responses (fields) | Yes | Field masks provide this |
| values vs batchUpdate | Yes | Correct API collection per operation type |
| Sheet ID vs name | Yes | Proper distinction with error guidance |
| A1 notation | Yes | Parsing, validation, range merging, overlap detection |

Additional optimizations beyond Google's baseline recommendations: request merging (20-40% API reduction), prefetch prediction (200-500ms latency reduction), request deduplication, N+1 elimination via metadata caching, concurrency coordination (global 15-op semaphore).

---

## 7. OAuth & Security Audit

### 7.1 Strengths (Score: 9/10)

| Security Feature | Implementation | Quality |
|-----------------|----------------|---------|
| OAuth 2.1 + PKCE (S256) | Enforced, plain rejected | Excellent |
| Token encryption at rest | AES-256-GCM, random IV | Excellent |
| Proactive token refresh | 80% threshold, 5min checks | Strong |
| Secret redaction | 15+ patterns, deep recursive | Excellent |
| Incremental scopes | 1,708 operation-to-scope mappings | Excellent |
| Resource indicators (RFC 8707) | Audience validation, token mismatch prevention | Strong |
| Webhook signatures | HMAC-SHA256, timing-safe comparison | Excellent |
| State tokens | HMAC-signed, 5min TTL, one-time use | Strong |
| Rate limiting (auth) | 10 req/min per IP on OAuth routes | Present |
| Production enforcement | Redis required in production | Proper |
| File permissions | 0o600 on token files, atomic writes | Proper |

### 7.2 Minor Hardening Recommendations

1. **JWT algorithm:** Explicitly set `algorithm: 'HS256'` in jwt.sign() calls to prevent algorithm confusion attacks
2. **CORS validation:** Add code-level validation rejecting wildcard `*` and requiring `https://` in production
3. **Internal state signing:** Consider signing the base64 state in the Google callback flow for defense-in-depth (redirect URI validation already mitigates risk)

### 7.3 No Hardcoded Secrets

All secrets use environment variables with placeholder values in .env.example.

---

## 8. TypeScript & Build Pipeline

### 8.1 TypeScript Configuration

- **Target:** ES2022
- **Module:** NodeNext (proper ESM)
- **Strict mode:** Enabled with additional checks (noImplicitReturns, noFallthroughCasesInSwitch, noUncheckedIndexedAccess, noPropertyAccessFromIndexSignature)
- **Incremental builds:** Enabled (.tsbuildinfo)
- **Declaration maps:** Enabled for debugging
- **Build exclusions:** Test files, schema utilities (7 files excluded from build)

### 8.2 ESLint Configuration

- Flat config (eslint.config.js) — modern format
- @typescript-eslint with strict rules (no-explicit-any: error, no-unused-vars: error)
- Architecture boundaries via eslint-plugin-boundaries (handler → service → schema → util)
- Appropriate relaxations for CLI files and data handler (dynamic types)
- Caching enabled (.eslintcache)

### 8.3 Build Pipeline

- `npm run build`: gen:metadata → tsc → copy-assets
- Prepack: gen:metadata → build → validate:server-json
- CI: clean → build → verify → validate:server-json → smoke
- Husky pre-commit: lint-staged (eslint + prettier)
- Turbo for caching and task orchestration

### 8.4 Code Quality Tools

- Knip (dead code detection)
- dependency-cruiser (architecture enforcement)
- ts-prune (unused export detection)
- cspell (spell checking)
- markdownlint-cli2 (docs linting)
- Vale (prose quality)
- prettier (formatting)

---

## 9. Testing Infrastructure

### 9.1 Coverage

- **206 test files** across 25 categories
- **91,645 lines** of test code
- **100% tool coverage** (21/21 tools)
- **Coverage thresholds:** 75% lines, 75% functions, 70% branches, 75% statements

### 9.2 Test Categories

| Category | Files | Purpose |
|----------|-------|---------|
| Handlers | 36 | Tool-specific unit tests |
| Services | 40 | Service layer isolation |
| Live API | 23 | Real Google Sheets API staging |
| Unit | 17 | Core logic |
| Integration | 10 | Cross-component |
| Compliance | 9 | MCP spec adherence |
| Contracts | 9 | API response shape |
| Core | 8 | Infrastructure |
| Utils | 10 | Utility functions |
| Security | Tests | Auth, redaction, scope validation |
| Property | Tests | Property-based (fast-check) |
| Chaos | Tests | Resilience under failure |
| Load | Tests | Performance under stress |
| Benchmarks | Tests | Performance regression tracking |

### 9.3 Testing Patterns

- Vitest (Node.js environment, v8 coverage)
- vi.fn() / vi.mock() for mocking
- Dual-layer testing: handler tests (mocked) + live API tests (staging)
- Snapshot testing for response stability
- Property-based testing with fast-check

---

## 10. Architecture Overview

### 10.1 Source Code Structure

```
src/ (34 directories, ~200 files)
├── cli.ts                  Entry point (STDIO/HTTP flag routing)
├── server.ts               Main MCP server (47KB, tool registration + request handling)
├── http-server.ts          HTTP transport (80KB, Express + SSE + streaming)
├── oauth-provider.ts       OAuth 2.1 provider (35KB)
├── index.ts                Export surface
├── handlers/       (25 files)  Tool implementations
├── services/       (50+ files) Business logic, caching, optimization
├── schemas/        (29 files)  Zod validation schemas
├── mcp/            (11 files)  MCP protocol integration
├── core/           (13 files)  Batch compiler, rate limiter, errors
├── utils/          (54 files)  Cross-cutting utilities
├── security/       (4 files)   Incremental scopes, RFC 8707, webhooks
├── config/         (6 files)   Environment, limits, scopes
├── types/          (9 files)   TypeScript interfaces
├── server/         (7 files)   Health monitoring, metrics
├── startup/        (3 files)   Lifecycle, performance init
├── resources/      (30 files)  MCP resource providers
├── observability/  (6 files)   Tracing, metrics
├── workers/        (4 files)   Thread pool
├── storage/        (5 files)   Persistence adapters
└── knowledge/      (15 files)  Formula library, reference data
```

### 10.2 Request Flow

```
MCP Request → CLI/HTTP Transport → McpServer → requestQueue (concurrency: 10)
  → handleToolCall() → createRequestContext() → checkAuth()
  → createToolHandlerMap() → handler.handle(args, context)
  → [BatchingSystem → RequestMerger → CachedSheetsApi → ETagCache → Google API]
  → buildToolResponse() → content + structuredContent
```

### 10.3 Performance Optimization Stack

```
Layer 1: Request Deduplication (identical requests collapsed)
Layer 2: Request Merging (overlapping ranges merged, 20-40% savings)
Layer 3: Batching System (50-100ms windows, adaptive sizing)
Layer 4: Prefetch Prediction (access pattern tracking, 200-500ms savings)
Layer 5: ETag Cache (L1 memory + L2 Redis, 30-50% savings)
Layer 6: Field Masks (60-80% payload reduction)
Layer 7: Concurrency Coordinator (global 15-op semaphore)
```

---

## 11. Recommended Actions (Priority Order)

### Critical (Do Now)

1. **Upgrade @modelcontextprotocol/sdk to 1.26.0** — fixes HIGH severity data leak vulnerability and 4 transitive hono CVEs. Also unlocks sampling/elicitation capability declarations.

### Important (This Sprint)

2. **Fix server.json action count** — change "293 actions" to "293 actions" to match source of truth
3. **Review googleapis 171.x** — check breaking changes and upgrade from 170.x
4. **Explicitly set JWT algorithm** — add `algorithm: 'HS256'` to jwt.sign() calls

### Nice to Have (Backlog)

5. Add CORS origin validation preventing wildcard `*` in production
6. Sign internal OAuth state tokens for defense-in-depth
7. Update @types/node from 22.x to 25.x (3 major versions behind)
8. Add 80% quota threshold alerting
9. Add CI check to validate action counts match across all files

---

## 12. What's Working Well

- **Zero TODO/FIXME/HACK comments** in any handler file — production clean
- **Lazy loading** of handlers gives ~30% faster initialization
- **Architectural boundaries** enforced via ESLint plugin
- **Comprehensive server instructions** (1,139 lines) guide LLM behavior
- **Dual-transport** support (STDIO + HTTP) covers all deployment scenarios
- **Enterprise features** (transactions, approvals, BigQuery, Apps Script) are real, not stubs
- **5-layer performance optimization** stack is sophisticated and well-integrated
- **206 test files** with dual-layer testing (mocked + live API)
- **Security posture** is strong with AES-256-GCM, PKCE, RFC 8707, HMAC webhooks

---

*This audit was performed as a read-only analysis. No code changes were made.*
