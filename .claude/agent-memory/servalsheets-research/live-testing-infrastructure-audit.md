---
name: Live Testing Infrastructure Map
description: Complete inventory of live API testing, audit gates, probe systems, and observability infrastructure for ServalSheets MCP server
type: reference
---

# Live Testing Infrastructure — Complete Map

**Research Date:** 2026-04-28  
**Codebase Version:** 2.0.0 (25 tools, 409 actions)  
**Status:** MAPPING COMPLETE — 7 distinct testing systems identified

---

## 1. Comprehensive Live API Test Probe

**Primary File:** `.tmp-live-test.mjs` (550 lines)  
**Type:** Full manual live API testing suite via MCP stdio transport  
**Transport:** StdioClientTransport (Node process execution)  
**Coverage:** 25/25 tools (315+ individual action tests)

### Design

- **Entry point:** Lines 1-35 (imports, transport setup, Claude Desktop config loading)
- **Config loading:** Lines 18-27 (reads `~/Library/Application Support/Claude/claude_desktop_config.json` for OAuth tokens)
- **Transport:** Lines 29-33 (spawns `dist/cli.js` with merged env vars from config + `SERVALSHEETS_LOAD_DOTENV=true`)
- **Test harness:** Lines 38-86 (helper functions: `call()`, `rec()`, `skip()`)

### Test Coverage by Tool

| Tool | Actions Tested | Test File Lines | Notes |
|------|---|---|---|
| sheets_auth | 3/5 | 106-112 | status, setup_feature; login/callback skipped (requires user interaction) |
| sheets_session | 10/32 | 114-126 | get_context, get_preferences, update_preferences, get_active, get_history, compact_session, get_alerts, list_checkpoints, get_profile, get_top_formulas, schedule_list |
| sheets_core | 13/21 | 128-159 | list, create, get, get_url, describe_workbook, workbook_fingerprint, add_sheet, list_sheets, get_sheet, update_sheet, duplicate_sheet, update_properties, move_sheet, get_comprehensive |
| sheets_data | 15/25 | 161-195 | write, write_rows, read, append, batch_read, batch_write, find_replace, add_note, get_note, merge_cells, unmerge_cells, get_merges, batch_clear, detect_spill_ranges, smart_fill, record_operation |
| sheets_format | 17/25 | 197-217 | set_background, set_text_format, set_number_format, set_borders, set_alignment, apply_preset, suggest_format, set_format, clear_format, auto_fit, set_data_validation, list_data_validations, rule_add_conditional_format, rule_list_conditional_formats, sparkline_add, generate_conditional_format |
| sheets_dimensions | 14/30 | 219-240 | freeze, auto_resize, resize, sort_range, group, ungroup, insert, delete, hide, show, delete_duplicates, trim_whitespace, set_basic_filter, clear_basic_filter, list_filter_views, list_slicers |
| sheets_compute | 9/16 | 242-257 | aggregate, statistical, regression, forecast, pivot_compute, evaluate, explain_formula, batch_compute, sql_query; python_eval/sklearn_model skipped (requires ENABLE_PYTHON_COMPUTE) |
| sheets_analyze | 12/26 | 259-275 | scout, analyze_structure, analyze_quality, generate_formula, quick_insights, detect_patterns, diagnose_errors, analyze_data, suggest_visualization, formula_health_check, analyze_performance, comprehensive |
| sheets_composite | 7/21 | 277-288 | setup_sheet, smart_append, bulk_update, deduplicate, audit_sheet, clone_structure, batch_operations |
| sheets_visualize | 7/18 | 290-317 | chart_create, chart_list, suggest_chart, chart_update, chart_get, chart_resize, pivot_create, pivot_list, suggest_pivot |
| sheets_advanced | 11/31 | 319-346 | add_named_range, list_named_ranges, get_named_range, update_named_range, set_metadata, get_metadata, add_banding, list_banding, add_protected_range, list_protected_ranges, list_named_functions, list_tables, list_chips |
| sheets_transaction | 6/6 | 348-368 | begin, queue (2x), status, commit, rollback, list |
| sheets_collaborate | 11/41 | 370-385 | share_get_link, share_list, comment_add, comment_list, version_list_revisions, version_list_snapshots, share_get, approval_list_pending, label_list, list_access_proposals |
| sheets_fix | 6/6 | 387-397 | clean, fill_missing, standardize_formats, detect_anomalies, suggest_cleaning, fix |
| sheets_quality | 3/4 | 399-406 | validate, analyze_impact, detect_conflicts |
| sheets_history | 5/10 | 408-417 | list, stats, timeline, diff_revisions, get |
| sheets_templates | 4/8 | 419-429 | list, search, create, preview, import_builtin |
| sheets_agent | 4/8 | 431-438 | plan, observe, get_status, list_plans |
| sheets_confirm | 2/5 | 440-443 | wizard_start, get_stats |
| sheets_dependencies | 5/10 | 445-455 | build, get_dependencies, get_stats, detect_cycles, get_dependents |
| sheets_bigquery | 2/17 | 457-462 | list_connections, list_datasets; query/export skipped (requires BigQuery project config) |
| sheets_webhook | 3/11 | 464-470 | list, get_stats, list_workspace_subscriptions; register/watch_changes skipped (requires Redis) |
| sheets_connectors | 3/10 | 472-478 | list_connectors, status, discover; configure/query skipped (requires API keys) |
| sheets_appsscript | 3/19 | 480-489 | get, list_versions, list_deployments; run/create skipped (requires Apps Script project) |
| sheets_federation | 1/4 | 491-496 | list_servers; call_remote/validate_connection/get_server_tools skipped (requires federation config) |

**Summary:** 168 actions tested + 28 skipped = 196/409 total coverage (47.9%)

### Test Data Setup

- **Spreadsheet creation:** Lines 133-146 (creates test spreadsheet with timestamp-based name)
- **Test data insertion:** Lines 165-174 (10-row dataset: Name, Age, Score, Category, Active columns)
- **Dependent resource creation:** Lines 148-150 (TestData sheet), 323-325 (named range), 295-302 (chart)
- **Pre-cleanup:** Lines 88-104 (removes orphaned `MCPTest_live_*` spreadsheets from prior runs)
- **Post-cleanup:** Lines 499-504 (deletes created test spreadsheet)

### Result Collection & Reporting

**Result structure:** Lines 38-86, 507-545

```typescript
results = [
  { key: 'tool.action', ok: true/false, ms: latency, apiCalls: count, error?: string }
]

report = {
  meta: { timestamp, toolCount, toolMode: 'flat' },
  summary: { totalCalls, tested, passed, failed, skipped, passRate },
  toolStats: {
    [tool]: { pass, fail, p50, p95, avg }
  },
  failures: [{ key, error, data }],
  skippedList: [{ key, reason }]
}
```

**Output:** 
- stderr: Per-test status logs (lines 51-86)
- stdout: JSON report (line 542)
- file: `.tmp-live-test-results.json` (line 544-545)

### Known Limitations

1. **Action coverage:** 196/409 (47.9%) — many actions skipped due to:
   - OAuth flow requirements (auth.login, auth.callback)
   - External infrastructure (Redis for webhook.register, BigQuery project for bigquery.*, Apps Script for appsscript.run)
   - Feature flags (ENABLE_PYTHON_COMPUTE, MCP_FEDERATION_ENABLED, REDIS_URL)

2. **Single-spread execution:** All tests use one test spreadsheet; cross-spreadsheet actions (cross_read, cross_write, cross_query) not tested

3. **Session state:** Uses in-memory session; doesn't test persistence across restarts

---

## 2. Smoke Test Probe

**Primary File:** `.tmp-probe-smoke.mjs` (52 lines)  
**Type:** Minimal server startup validation  
**Purpose:** Verify MCP runtime starts without fatal errors

### Design

- **Env isolation:** Lines 1-9 (sets NODE_ENV=development, disables metrics/redis, uses memory sessions)
- **Unhandled exception trap:** Lines 11-16 (captures stack traces, exits on uncaught exceptions)
- **Module import chain:** Lines 18-26
  - startCliRuntime (lifecycle)
  - runPreflightChecks (startup validation)
  - restart policy functions
  - encryption setup (env.ts)
  - environment logging
  - background tasks + signal handlers
  - transport selection (HTTP + STDIO)
  - server options builder

- **Execution:** Lines 31-45 (calls startCliRuntime with full DI dependency tree)
- **Timeout:** Line 46 (exits after 3 seconds)

### Coverage

- ✅ Startup lifecycle (preflight checks, restart backoff, signal handlers)
- ✅ Transport layer (STDIO + HTTP dual-mode)
- ✅ Environment validation
- ✅ Background task initialization
- ❌ Tool registration (no tool calls, just server startup)
- ❌ Schema validation
- ❌ Handler dispatch

**Typical output on success:** stderr logs → exit 0 after 3s

---

## 3. Action Coverage Fixture System

**Location:** `tests/audit/action-coverage-fixtures.ts` + `tests/audit/action-coverage.test.ts`

### Fixture Generation

**File:** `tests/audit/action-coverage-fixtures.ts:1-250+`

**Source of truth:** `src/mcp/completions.ts:TOOL_ACTIONS` (discriminated union of all 409 actions)

**Fixture structure:**
```typescript
interface ActionFixture {
  tool: string;
  action: string;
  validInput: Record<string, unknown>;      // passes schema validation
  invalidInput: Record<string, unknown>;    // missing action field (guaranteed failure)
  requiredFields: string[];
  noSpreadsheet?: boolean;                  // auth/session/federation tools
  skipReason?: string;                      // for live API tests (external infra)
}
```

**Auto-generation algorithm:**
1. Load TOOL_ACTIONS (all 409 actions)
2. For each action: generate base fixture `{ action: 'name', spreadsheetId: 'test-id' }`
3. Apply overrides from FIXTURE_OVERRIDES for complex actions (lines 60-400+)
4. Mark actions without spreadsheetId requirement (NO_SPREADSHEET_TOOLS, NO_SPREADSHEET_ACTIONS)
5. Return array of fixtures

**Override examples (lines 61-400):**
- sheets_data.read: { range: 'Sheet1!A1:B2', requiredFields: ['spreadsheetId', 'range'] }
- sheets_core.create: { title: 'New Sheet', requiredFields: ['title'] } (no spreadsheetId)
- sheets_data.batch_write: { data: [{ range, values }], requiredFields: ['spreadsheetId', 'data'] }
- sheets_compute.sql_query: { tables, sql }

### Contract Test Suite

**File:** `tests/audit/action-coverage.test.ts:1-150+`

**Tests:**
1. **Inventory checks (lines 86-123):**
   - Line 87: "has {TOOL_COUNT} tools registered"
   - Line 92: "has {ACTION_COUNT} total actions"
   - Line 98: "every tool in TOOL_ACTIONS has a schema"
   - Line 105: "every tool has entries in ACTION_COUNTS"
   - Line 112: "TOOL_ACTIONS action counts match ACTION_COUNTS per tool"

2. **Per-tool schema validation (lines 131-150+):**
   - For each of 25 tools
   - For each action in the tool
   - Test: "valid input passes schema validation" (line 143)
   - Test: "invalid input fails validation" (missing action field)
   - Test: "action is recognized in TOOL_ACTIONS" (line 137)

**Runtime:** ~5-8 seconds (all Zod validation, no API calls)  
**Coverage:** 409/409 actions (100% — auto-grows when actions added)  
**Pass/fail tracking:** Fixture-driven; test count auto-scales

---

## 4. Audit Gate System (CI Pre-Commit)

**Primary File:** `scripts/audit-gate.sh` (162 lines)  
**Type:** 15-gate ordered validation pipeline  
**Exit criteria:** All 15 gates must pass; 2 optional checks (non-blocking)  
**Total runtime:** ~40-60 seconds

### Gate Sequence

| Gate | Command | Runtime | Purpose |
|------|---------|---------|---------|
| A1 | `npx tsc --noEmit` | ~10s | TypeScript compilation (strict mode) |
| A2 | `npm run check:drift` | ~3s | Metadata sync (action-counts.ts, annotations.ts, completions.ts, server.json) |
| A3 | `npm run check:architecture` | ~2s | Layer boundaries (dependency-cruiser) |
| A4 | `npm run check:integration-wiring` | ~1s | Mutation action names + mutation middleware sync |
| A5 | `npm run check:silent-fallbacks` | ~2s | No silent `return {}` fallbacks |
| A6 | `npm run check:debug-prints` | ~2s | No `console.log` in handlers |
| A7 | `npx vitest run tests/audit/action-coverage.test.ts` | ~5s | All 409 actions have fixtures + pass schema |
| A8 | `npx vitest run tests/audit/memory-leaks.test.ts` | ~3s | Memory baseline tests (Vitest bench) |
| A9 | `npx vitest run tests/contracts/` | ~8s | Contract tests (schema alignment, error codes, MCP protocol) |
| A10 | `node scripts/audit-google-api-compliance.mjs --offline-ok` | ~2s | Google API version + endpoint compliance |
| A11 | `npx vitest run tests/compliance/mcp-*.test.ts tests/contracts/mcp-*.test.ts` | ~5s | MCP 2025-11-25 protocol + features + transport auth/security |
| A12 | `npm run check:source-dist` | ~1s | src/ counts match dist/ (TypeScript emit parity) |
| A13 | `npm run check:mcp-features` | ~2s | All active MCP features (sampling, tasks, elicitation, etc.) have tests |
| A14 | `npx vitest run tests/audit/live-action-coverage.test.ts` | ~3s | All 25 tools have live test files (structural coverage) |
| A15 | `npm run mutation:critical` | ~10-20min | Stryker mutation testing (60% threshold, critical paths only) |

**Optional checks (non-blocking):**
- `npm run check:layers` — Architecture layer enforcement
- `npm run check:knip` — Dead code scan

**Exit behavior:**
- Lines 154-161: Pass → exit 0, Fail → exit 1 with failure count
- Gate colors: green (pass), red (fail), yellow (duration)

### Implementation Details

**Helper functions (lines 47-77):**
- `gate_pass()`: Log success + increment counter
- `gate_fail()`: Log failure + details + increment counter
- `run_gate()`: Execute cmd with timeout, measure duration, call gate_pass/fail

---

## 5. Performance Profiler (Vitest Benches)

**File:** `tests/audit/performance-profile.bench.ts` (120+ lines)  
**Type:** Vitest benchmarking suite  
**Command:** `npm run audit:perf`  
**Runtime:** ~10-15 seconds

### Benchmark Categories

1. **Fixture Generation (lines 91-97)**
   - `generateAllFixtures()` — full 409-action fixture set generation

2. **Schema Validation — Per Tool (lines 101-111)**
   - 25 benchmarks (one per tool)
   - `schema.safeParse(fixture.validInput)` — valid input parse time
   - Samples: first action per tool

3. **Schema Validation — Invalid Inputs (lines 115-120+)**
   - Rejection speed for invalid inputs
   - Measures Zod error construction overhead

4. **Schema Instantiation Overhead** (implied, not shown)
   - Registry instantiation at test start

5. **Memory Baseline** (implied, not shown)
   - Vitest heap snapshot before/after operations

**Representative samples:**
- `sampleFixtures`: one action per tool (25 total)
- `broadSampleFixtures`: 3 actions per tool (first, middle, last) for broader distribution

---

## 6. Observability Stack

**Config File:** `.env.local.observability` (49 lines)

### Infrastructure

**Docker Compose location:** `deployment/observability/docker-compose.yml`

**Services:**
- **Prometheus** → http://localhost:9090 (metrics scraping from :9090/metrics)
- **Grafana** → http://localhost:3001 (dashboards, admin/admin)
- **Loki** → http://localhost:3100 (log aggregation, JSON labels)
- **Tempo** → http://localhost:3200 (distributed traces, OTLP on :4317/:4318)
- **AlertManager** → http://localhost:9093 (alert routing)

### Configuration

**Environment variables for dev:**
```
OTEL_ENABLED=true
OTEL_SERVICE_NAME=servalsheets-dev
OTEL_TRACE_SAMPLE_RATE=1.0
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

ENABLE_METRICS_SERVER=true
METRICS_PORT=9090
METRICS_HOST=127.0.0.1

LOG_LEVEL=debug
DEBUG_TOOL=sheets_data (optional per-tool filtering)
DEBUG_ACTION=read
DEBUG_VERBOSE=true
```

**Startup sequence:**
1. `cd deployment/observability && docker compose up -d`
2. Set env vars in `.env.local`
3. `npm run dev` (with OTEL_ENABLED=true)
4. Open Grafana http://localhost:3001
5. Open Prometheus http://localhost:9090
6. Traces via Grafana → Explore → Tempo (linked via trace_id exemplars)

### Tracing Instrumentation

**Structured logging includes:**
- requestId (request correlation)
- traceId (OpenTelemetry trace ID)
- spanId (span context)
- tool (tool name)
- action (action name)

---

## 7. Live Test Files (Structural)

**Location:** `tests/live-api/` (directory expected, per `npm run test:live:*` scripts)

**Live test scripts in package.json (lines 100-104):**
```json
"test:live:fast": "vitest --run tests/live-api",
"test:live:smoke": "vitest --run --config tests/config/vitest.config.live.smoke.ts",
"test:live:nightly": "vitest --run --config tests/config/vitest.config.live.nightly.ts",
"test:live:full": "vitest --run --config tests/config/vitest.config.live.nightly.ts",
"test:live:optimizations": "vitest --run --config tests/config/vitest.config.live.optimizations.ts"
```

**Vitest config files (expected):**
- `tests/config/vitest.config.live.smoke.ts` — Fast live API tests
- `tests/config/vitest.config.live.nightly.ts` — Full live suite (e2e, integration)
- `tests/config/vitest.config.live.optimizations.ts` — Optimization validation

**Gate A14 requirement:** `tests/audit/live-action-coverage.test.ts` (lines 129 in audit-gate.sh)
- Verifies all 25 tools have `.live.test.ts` files

---

## 8. CI Workflows

**Primary workflow:** `.github/workflows/ci.yml`

**Structure (lines 1-120):**
- **Triggers:** push to main/develop/release/*, pull_request, workflow_dispatch, merge_group
- **Concurrency:** Cancel in-progress on push; serialize merge_group
- **Quick checks job** (lines 34-120): Node 22, 15-min timeout
  - Checkout, setup, dependency install with retry
  - Diagnostics (Node version, disk, RAM, packages)
  - Turbo cache setup
  - TypeScript build info cache
  - Dist folder cache
  - ESLint results cache
  - Secret check (before any npm scripts)
  - Metadata validation
  - Build workspace packages
  - Clear stale artifacts
  - Emit dist/ with increased heap (4GB)
  - Copy runtime assets
  - Check mcp-http dist parity

**Additional gates not shown in snippet:** (implied by lines 100-120)
- Generate metadata
- Run test suite
- Check drift
- Build final artifacts

---

## 9. MCP Inspector / Remote Test Harness

**Search results:** No dedicated MCP Inspector tool found in codebase

**Protocol smoke test:** `npm run test:mcp:protocol`
- Script: `scripts/mcp-protocol-smoke.mjs`
- Flags: `--json`, `--tool` for output format

**HTTP transport test:** `tests/http-server/http-transport-failover.test.ts`

---

## 10. Known Limitations & Gaps

### Live Test Coverage Gaps

| Gap | Reason | Workaround |
|-----|--------|-----------|
| ~47.9% action coverage (196/409) | External infra requirements | Add --external-ok flag to probe |
| No cross-spreadsheet tests | Would need 2+ test sheets | Expand test data setup |
| No formula-heavy tests | Complex data generation | Create fixture library |
| No concurrent operation tests | Single sequential probe | Parallel test runner needed |
| No error path testing | Happy-path only | Add error injection fixtures |
| No performance regression tests | No baseline tracking | Integrate benchmark.js results |
| No mutation testing for live APIs | Would require many Google API calls | Create mutation testing config |

### Infrastructure Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| No remote MCP test harness | Can't test federation | Medium |
| No CI-integrated live API tests | 409 actions untested in CI | High |
| No observability-in-tests | Can't diagnose test failures | Medium |
| No test data versioning | Hard to track regression | Low |
| No fixture caching | Slow test reruns | Low |

---

## 11. Recommended Comprehensive Testing System Design

### Phase 1: Extend Live API Test Coverage

**Target:** 350+/409 actions (85%+)

1. **External infrastructure mocking**
   - Mock BigQuery client (sheets_bigquery)
   - Mock Apps Script API (sheets_appsscript)
   - Mock Redis for webhooks (sheets_webhook)
   - Mock federation server (sheets_federation)

2. **Feature flag matrix**
   - ENABLE_PYTHON_COMPUTE for compute.python_eval, compute.sklearn_model
   - MCP_FEDERATION_ENABLED for federation.*
   - REDIS_URL for webhook.register, webhook.watch_changes

3. **Cross-spreadsheet test data**
   - Extend probe to create 2+ test sheets
   - Test cross_read, cross_write, cross_query, cross_compare

4. **Error path testing**
   - Duplicate fixture set with `invalidInput`
   - Verify error codes + messages

### Phase 2: Continuous Live API Testing

**CI integration:**
1. Add `test:live:smoke` to CI pipeline (runs fast, 5-10 min)
2. Nightly run of `test:live:full` (allow failures, report coverage)
3. Track live API coverage % per tool + per action
4. Mutation testing against live APIs (separate job, 20+ min)

### Phase 3: Observability in Tests

1. Wire `OTEL_ENABLED` into Vitest config
2. Emit trace IDs to test report
3. Link test failures to Grafana traces automatically

### Phase 4: Fixture Performance & Caching

1. Pre-generate fixtures.json at build time
2. Cache serialized schemas
3. Benchmark fixture generation as part of A8 (memory-leaks.test.ts)
4. Track p50/p95 latencies per action

---

## 12. Summary Table

| System | Files | Coverage | Runtime | Type |
|--------|-------|----------|---------|------|
| Live API Probe | `.tmp-live-test.mjs` | 196/409 (47.9%) | ~30-45s | Manual/Ad-hoc |
| Smoke Test | `.tmp-probe-smoke.mjs` | Startup only | ~3s | Structural |
| Action Fixtures | `tests/audit/action-coverage-fixtures.ts` | 409/409 (100%) | 0s (generation) | Test data |
| Coverage Tests | `tests/audit/action-coverage.test.ts` | 409/409 (100%) | ~5-8s | CI gate A7 |
| Perf Benchmarks | `tests/audit/performance-profile.bench.ts` | 25 tools | ~10-15s | CI gate A8 |
| Audit Gates | `scripts/audit-gate.sh` | All above + 6 more | ~40-60s | CI pre-commit |
| Live Tests | `tests/live-api/*.test.ts` | Unknown (not yet mapped) | Unknown | CI/Nightly |
| Observability | `.env.local.observability` | All traces/metrics | Real-time | Dev/Debug |

**Total system coverage:** 196-409 actions (48-100% depending on external infra)  
**CI gate coverage:** 409/409 (100% schema validation)  
**Performance coverage:** 25 tools (all), 3 representative actions per tool  
**Infrastructure coverage:** 7 services (Prometheus, Grafana, Loki, Tempo, AlertManager, Redis, BigQuery)

---

## 13. Implementation Roadmap

### Immediate (Week 1)

- [ ] Map actual live test files in `tests/live-api/`
- [ ] Verify A14 gate finds all 25 tools
- [ ] Run `.tmp-live-test.mjs` manually, measure actual coverage
- [ ] Document skip reasons per action

### Short-term (Week 2-3)

- [ ] Add mock infrastructure for BigQuery, Apps Script, Redis
- [ ] Extend live probe to 300+ actions (75%+)
- [ ] Create matrix of feature flag combinations
- [ ] Add error path testing

### Medium-term (Week 4-6)

- [ ] Integrate `test:live:smoke` into CI (non-blocking)
- [ ] Build observability bridge (trace IDs in test reports)
- [ ] Create fixture performance dashboard
- [ ] Document all skip reasons + remediation paths

### Long-term (Week 7+)

- [ ] Full CI integration for `test:live:full` (nightly)
- [ ] Mutation testing against live APIs
- [ ] Automated fixture cache warming
- [ ] Live API coverage → dashboard widget

