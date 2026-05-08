# ServalSheets Full MCP Audit Report

## 1. Executive Summary

ServalSheets is close to MCP 2025-11-25 alignment, but the audit found several material gaps before it should be treated as production-complete:

- Protocol risk: input schema validation still appears to rethrow `ZodError` from tool handlers, which may violate SEP-1303 unless the SDK wrapper converts it to `CallToolResult.isError`.
- Test gate risk: full Vitest and coverage runs are currently red due OAuth callback bind failures in the sandbox plus non-sandbox-looking cleanup and performance threshold failures.
- Security/operations risk: HTTP CORS defaults are safer than "allow all", but production can still boot with implicit remote origins; OAuth session persistence still uses a lazy Redis session store path.
- Schema/runtime drift: generated metadata now reports 410 actions while docs and `SERVER_INFO` still claim 409.
- Several issues in the optimization brief are already fixed locally: `SERVER_INFO.description`, resource completions, enum descriptions, table name propagation, `update_dimension_group`, health endpoints, and bounded spreadsheet existence cache.

Overall score: **78/100**. The main path to 100% is to harden SEP-1303 behavior with a protocol test, stabilize the full test gate, make production startup/security defaults explicit, and resolve docs/generated metadata drift.

## 2. Methodology

Evidence was gathered in two phases:

1. Local repository verification using `rg`, file reads, and npm verification commands.
2. Official-source cross-checks against MCP, TypeScript SDK, MCP Inspector, and Zod JSON Schema documentation.

The worktree was already dirty before audit commands ran. No user-owned changes were reverted.

Baseline:

| Evidence | Result |
|---|---|
| Branch | `main` |
| Commit | `dd72c1d25a874f2744fc1101fd7f4593d3a9c4ee` |
| Node | `v24.5.0` |
| npm | `11.5.1` |
| Initial worktree | Dirty, with modified live tests, handlers, scripts, and untracked probe files |

Command results:

| Command | Result |
|---|---|
| `npm install` | Hung; killed. npm then reported it could not write logs under `/Users/thomascahill/.npm/_logs`. |
| `npm run build` | Failed in sandbox due `tsx` IPC `EPERM`; passed with escalation. Generated metadata reported 25 tools and 410 actions. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed. |
| `npm test` | Failed: 1 failed file, 5 failed tests, 11751 passed, 1202 skipped, 2 todo. Failures were OAuth callback loopback bind `EPERM`. |
| `npx vitest run` | Failed: 3 failed files, 11 failed tests. OAuth bind failures, fixture cleanup `ENOENT`, and benchmark threshold failures. |
| `npx vitest run --coverage` | Failed with the same 11 failed tests. |
| `npx @modelcontextprotocol/inspector --help` | Hung; killed. npm again reported log-dir write failure. |

## 3. Official Docs Checked

Official sources used for interpretation:

- MCP lifecycle: https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle
- MCP tools: https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- MCP completion: https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/completion
- MCP schema reference: https://modelcontextprotocol.io/specification/2025-11-25/schema
- MCP tasks: https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks
- SEP-1303 input validation errors: https://modelcontextprotocol.io/seps/1303-input-validation-errors-as-tool-execution-errors
- MCP Inspector docs: https://modelcontextprotocol.io/docs/tools/inspector
- TypeScript SDK repo: https://github.com/modelcontextprotocol/typescript-sdk
- Zod JSON Schema docs: https://zod.dev/json-schema

Key official-doc conclusions:

- Tools must return tool execution failures through `CallToolResult` when the model can recover from the error. SEP-1303 specifically targets validation errors during `tools/call`.
- Tool `inputSchema` is JSON Schema; Zod-to-JSON-Schema conversion must avoid unsupported runtime-only constructs or must fail closed.
- Completion supports `ref/prompt` and `ref/resource`; servers may return empty completions, but implemented resources should ideally complete known resource values.
- Inspector supports CLI and UI workflows, but this local environment did not produce Inspector output because `npx` hung and npm could not write logs.

## 4. Repository Map

| Area | Evidence |
|---|---|
| Package/scripts | `package.json`, npm workspaces, build metadata scripts |
| MCP entrypoint | `src/server.ts` |
| Tool registration | `src/mcp/registration/tool-definitions.ts` |
| Tool execution | `src/mcp/registration/tool-handlers.ts` |
| Tool response builder | `src/mcp/registration/tool-response.ts` |
| JSON Schema conversion | `src/utils/schema-compat.ts`, `src/mcp/registration/tools-list-compat.ts` |
| Control plane | `src/server/control-plane-registration.ts` |
| Prompts | `src/mcp/registration/prompt-registration.ts` |
| Resources | `src/mcp/registration/resource-registration.ts`, `src/resources/` |
| HTTP transport | `packages/mcp-http/src/routes-transport.ts`, `packages/mcp-http/src/middleware.ts` |
| HTTP runtime config | `packages/mcp-http/src/runtime-config.ts` |
| Health routes | `packages/mcp-http/src/observability-core-routes.ts` |
| Sampling | `src/mcp/sampling.ts`, `src/utils/sampling-consent.ts` |
| Elicitation | `src/mcp/elicitation.ts` |
| Tasks | `src/mcp/features-2025-11-25.ts`, task-related services/tests |
| Google API retry | `src/services/google-api.ts` |
| Redis/session | `src/storage/session-store.ts`, `src/server/bootstrap.ts`, `src/auth/oauth-provider.ts` |
| Observability | `src/observability/metrics.ts`, `src/observability/otel-setup.ts` |
| CI | `.github/workflows/ci.yml`, `mcp-protocol-test.yml`, `test-gates.yml`, `security.yml`, `schema-check.yml`, `nightly-live-api.yml`, `performance.yml` |
| Tests | `tests/unit`, `tests/contracts`, `tests/compliance`, `tests/integration`, `tests/e2e`, `tests/simulation`, `tests/property`, `tests/live-api`, `tests/benchmarks`, `tests/security` |

Generated metadata drift:

| Source | Evidence |
|---|---|
| Build output | Generated metadata reported **410 actions**. |
| Brief and `SERVER_INFO` | Still claim **409 actions**. |
| Impact | Public metadata and docs can become inconsistent with generated schema. |

## 5. MCP Compliance Matrix

| Capability | Status | Evidence | Risk |
|---|---:|---|---|
| initialize/lifecycle | Partial pass | Build/typecheck pass; lifecycle code present in server entrypoint and transport package | Needs raw JSON-RPC transcript. |
| initialized notification | Unverified | Inspector/harness could not complete | Need protocol harness artifact. |
| ping | Unverified | Tests exist, but full suite red | Need targeted harness. |
| cancellation | Partial | Cancellation tests and control-plane paths exist | Need transport-level proof. |
| progress | Partial | Tool handler includes progress path and response handling | Need JSON-RPC transcript. |
| logging | Partial | Winston/audit/observability modules exist | Redaction proof missing. |
| pagination | Partial | Tool/resource list code exists | Need cursor edge tests. |
| tools/list | Partial | 25 tools generated by build | Inspector output missing. |
| tools/call | At risk | `parseForHandler` rethrows `ZodError` | SEP-1303 behavior needs proof/fix. |
| resources/list/read | Partial | Resource registration exists | Need read transcript. |
| resource completion | Pass | `ref/resource` handler routes spreadsheet, sheet, and range completions | Brief claim is stale. |
| prompts/list/get | Partial | Prompt registration exists | Static prompt list notifications likely not required unless dynamic. |
| sampling | Partial | Sampling module and consent gate exist | Extended-thinking and stop sequence enhancements absent. |
| elicitation | Partial | Elicitation module exists | Need protocol tests for primitive schemas. |
| tasks | Partial | 2025-11-25 feature module references task support | Need task lifecycle tests. |
| Streamable HTTP | Partial | HTTP transport package present | Inspector HTTP proof missing. |
| legacy SSE | Partial | Routes present in transport package | Reconnect proof missing. |
| HTTP auth | Partial | OAuth provider exists | Basic/full scope behavior and Redis session path need hardening. |

## 6. Zod Audit

| Check | Status | Evidence | Action |
|---|---:|---|---|
| Zod v4 JSON Schema conversion | Mostly pass | `src/utils/schema-compat.ts:181-199` uses `z.toJSONSchema(...)` with `io: 'input'` | Keep. |
| Fail-closed schema conversion | Fail | `src/utils/schema-compat.ts:211-219` logs and returns empty object schema on conversion error | Throw in CI/generation paths. |
| Private Zod internals | Risk | `src/mcp/registration/tools-list-compat.ts:67-84` checks `_def` and `_zod` | Replace with public or isolated compatibility helper with tests. |
| Top-level object enforcement | Partial | `tools-list-compat.ts:140-144` wraps schemas missing `type` as object | Add tests for all 25 tool schemas. |
| Discriminated unions | Partial | Large schema surface present | Need generated matrix artifact for all 410 actions. |
| Enum descriptions | Pass | Federation, webhook, event type, connector operator descriptions already present | Optimization brief is stale here. |
| Snake/camel runtime alignment | Fail | `src/schemas/data.ts` still exposes `response_format`; output uses `responseFormat`; handlers read snake_case | Add migration or rename with compatibility. |

Schema matrix summary:

| Tool class | Schema source | Runtime alignment |
|---|---|---|
| `sheets_data` | `src/schemas/data.ts` | Has `response_format` naming drift. |
| `sheets_dimensions` | `src/schemas/dimensions.ts` | Includes `update_dimension_group`. |
| `sheets_advanced` | `src/schemas/advanced.ts` plus action schemas | Table name propagation implemented. |
| `sheets_webhooks` | `src/schemas/webhook.ts` | Descriptions present; event docs should be checked against live Workspace Events. |
| `sheets_federation` | `src/schemas/federation.ts` | Description present. |
| Other tools | `src/schemas/*.ts` | Need automated per-action JSON Schema artifact. |

## 7. Handler Audit

| Handler area | Status | Evidence | Required proof |
|---|---:|---|---|
| Validation | At risk | `src/mcp/registration/tool-handlers.ts:516-567` catches `ZodError` then rethrows new `ZodError` | Negative `tools/call` must return `CallToolResult.isError`. |
| Dispatch | Pass | Handler map begins around `src/mcp/registration/tool-handlers.ts:579` | Add generated action-to-handler map. |
| Error envelope | Partial | `tool-response.ts` handles `isError` for structured failures | Verify validation errors route through it. |
| Destructive controls | Partial | Safety options exist per brief; not fully reverified action-by-action | Generate destructive action matrix. |
| Retry/backoff | Partial | `src/services/google-api.ts` central retry layer exists | Run direct Google API call grep in CI. |
| Cache invalidation | Partial | `update_dimension_group` cache rule exists in `src/services/cache-invalidation-graph.ts:239` | Add mutation cache invalidation tests. |
| Progress/cancellation | Partial | Tool execution middleware includes these concerns | Need JSON-RPC transcript. |
| Response intelligence | Pass/partial | Batch detection exists at `response-intelligence.ts:75-110`; gotchas at `117-151` | Add tests for exact suggestions. |

Handler matrix requirements for follow-up:

- Emit generated CSV/Markdown with columns: `tool`, `action`, `schema`, `handler`, `sideEffect`, `destructive`, `idempotent`, `dryRun`, `confirm`, `retry`, `cacheInvalidation`, `tests`.
- Fail CI if any action lacks handler, schema, or test coverage classification.

## 8. Resource Audit

| Check | Status | Evidence |
|---|---:|---|
| Resource registration | Partial | `src/mcp/registration/resource-registration.ts` present |
| Resource completion | Pass | `src/server/control-plane-registration.ts:181-199` handles `ref/resource` by spreadsheet, sheet, and range argument names |
| Empty completion claim | Stale | The optimization brief's claim that `ref/resource` returns only `{ values: [] }` is no longer true |
| Subscriptions | Partial | `src/resources/` exists; resource subscription behavior needs live protocol tests |
| MIME/URI tests | Unverified | Inspector/harness output missing |

Recommendation:

- Add protocol harness cases for `resources/list`, `resources/read`, `completion/complete` with `ref/resource`, invalid URI, and subscribe/unsubscribe if advertised.

## 9. Prompt Audit

| Check | Status | Evidence | Action |
|---|---:|---|---|
| Prompt registration | Partial | `src/mcp/registration/prompt-registration.ts` present | Generate prompt list matrix. |
| Static prompt list notifications | Likely pass | MCP notifications are relevant when lists change dynamically; static prompts do not need startup `list_changed` | Document static behavior. |
| Prompt arguments | Unverified | Need prompt schema matrix | Add `prompts/get` valid/invalid tests. |

## 10. Advanced Features

| Feature | Status | Evidence | Recommendation |
|---|---:|---|---|
| Sampling | Partial | `src/mcp/sampling.ts` has multiple `maxTokens` call sites and no `stopSequences`/thinking config | Add task-type config only after verifying client support. |
| Sampling consent | Partial pass | `src/utils/sampling-consent.ts:94-130` audit-logs verified/denied events when audit logging is enabled | Align env naming between bootstrap and config. |
| Elicitation | Partial | `src/mcp/elicitation.ts` present | Add schema and negative tests. |
| Tasks | Partial | Feature module exists | Add task lifecycle harness. |
| Batch intelligence | Pass/partial | `detectBatchPattern` implemented in `response-intelligence.ts:75-110` | Test threshold and suggested equivalent. |
| Workflow templates | Unverified | Agent services present | Add `list_plans` template discovery test. |
| Sampling result cache | Present | `src/services/sampling-result-cache.ts` exists | Add invalidation tests tied to spreadsheet mutation. |
| Property-based testing | Present | `tests/property` includes fast-check tests | Expand for range parsing, formulas, Unicode, max sizes. |

## 11. Transport/Lifecycle

| Area | Status | Evidence | Risk |
|---|---:|---|---|
| STDIO | Partial | Main entrypoint present | Need Inspector STDIO transcript. |
| HTTP | Partial | `packages/mcp-http/src/routes-transport.ts` present | Need Inspector HTTP transcript. |
| CORS | Partial | `runtime-config.ts:45-73` supplies remote and localhost defaults; middleware uses credentials at `middleware.ts:211-227` | Production should require explicit origins or log hard warning. |
| Origin validation | Pass/partial | `middleware.ts:230-235` applies origin validation | Add tests for disallowed origin. |
| Rate limiting | Partial fail | HTTP middleware key is client IP at `middleware.ts:244-254`; no principal key in that path | Add per-principal limiter after auth. |
| Health endpoints | Pass | `/health/live`, `/health/ready`, and `/health` exist in `observability-core-routes.ts` | Brief claim is stale. |
| Redis startup | Partial fail | `OAuthProvider` creates `SessionStore` at `src/auth/oauth-provider.ts:211-220`; `RedisSessionStore` lazy-connects at `session-store.ts:117-124` | Initialize session store before listening in OAuth/HTTP startup. |

## 12. Security

| Area | Status | Evidence | Recommendation |
|---|---:|---|---|
| CORS | Partial | `CORS_ORIGINS` default is empty in `src/config/env.ts:199`; package fills defaults | In production, require explicit `CORS_ORIGINS` or fail startup. |
| Rate limiting | Partial fail | IP-only limiter in HTTP middleware | Add per-user/principal limiter and separate unauthenticated limits. |
| OAuth scopes | Partial | User observed basic/full OAuth variance; scope enforcement defaults false at `src/config/env.ts:220-223` | Define scope profiles and make auth URL explain requested scope set. |
| Redis session | Partial fail | Lazy Redis connection path in `session-store.ts` | Add `initialize()` and await it in startup. |
| Token storage | Partial | `src/services/token-store.ts` exists | Add key rotation test and legacy-key decrypt path. |
| Sampling consent audit | Partial pass | `src/utils/sampling-consent.ts:94-130` audit path exists | Fix env consistency and add audit-log tests. |
| Logging redaction | Partial | Logging modules exist | Add redaction transcript checks. |
| SSRF/path traversal/injection | Unverified | Large handler surface | Add focused security tests for URL, path, formula/script, Apps Script, and webhook inputs. |
| License/audit | Unverified | `npx license-checker` was not run | Add CI license gate with installed dependency. |
| npm audit | Unverified in this run | `npm audit` was not completed | Run after npm environment issue is fixed. |

## 13. Testing

Test suite is extensive, but current full-gate status is red.

| Test command | Result | Failure type |
|---|---|---|
| `npm test` | Failed | OAuth callback bind `EPERM` in sandbox |
| `npx vitest run` | Failed | OAuth bind `EPERM`; fixture cleanup `ENOENT`; benchmark threshold failures |
| `npx vitest run --coverage` | Failed | Same 11 failing tests |
| `npm run typecheck` | Passed | None |
| `npm run lint` | Passed | None |
| `npm run build` | Passed with escalation | Sandbox blocked `tsx` IPC pipe |

Notable failing behaviors:

- `tests/unit/oauth-callback-server.test.ts`: failed to bind loopback ports such as `127.0.0.1:<port>` and `::1:<port>` in sandbox.
- `tests/analysis/orchestrator.test.ts`: `safeUnlinkSync` cleanup hit `ENOENT` for fixture files.
- `tests/benchmarks/performance-regression.test.ts`: p95 thresholds exceeded, including observed values around `19.66ms < 15ms` and `11.32ms < 11ms`.
- Repeated warning: `TimeoutNaNWarning: NaN is not a number. Timeout duration was set to 1.`

Testing gaps:

- No successful Inspector artifact was captured.
- No raw JSON-RPC transcript was captured for initialize, tools/list, tools/call validation failure, prompts, resources, cancellation, progress, or tasks.
- Full-suite outside-sandbox rerun was not completed because escalation was rejected.

## 14. Inspector Plan

Add scripted Inspector jobs after build:

```bash
npx @modelcontextprotocol/inspector --cli node dist/server.js --method tools/list
npx @modelcontextprotocol/inspector --cli node dist/server.js --method resources/list
npx @modelcontextprotocol/inspector --cli node dist/server.js --method prompts/list
```

For HTTP:

```bash
npm run build
npm run start:http
npx @modelcontextprotocol/inspector --cli http://127.0.0.1:3000/mcp --method tools/list
```

Required artifacts:

- Raw JSON-RPC transcript.
- Inspector JSON output.
- Server logs with redaction check.
- Tool schema validation result.
- Invalid `tools/call` result proving SEP-1303 behavior.

Current blocker:

- `npx @modelcontextprotocol/inspector --help` hung in this environment and npm could not write logs under the user npm log directory.

## 15. NPM Scripts

Recommended additions:

```json
{
  "audit:inspector:stdio": "npx @modelcontextprotocol/inspector --cli node dist/server.js --method tools/list",
  "audit:schemas:matrix": "tsx scripts/audit-schema-matrix.ts",
  "audit:handlers:matrix": "tsx scripts/audit-handler-matrix.ts",
  "audit:jsonrpc": "tsx scripts/mcp-protocol-smoke.mjs",
  "audit:licenses": "license-checker --production --onlyAllow 'MIT;ISC;Apache-2.0;BSD-2-Clause;BSD-3-Clause;CC0-1.0;Unlicense;0BSD'"
}
```

Existing scripts that should remain gates:

- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npx vitest run --coverage`
- `npm run check:drift`
- `npm run validate:mcp-protocol`
- `npm run check:mcp-features`

## 16. CI Gates

Recommended required CI artifacts:

| Gate | Requirement |
|---|---|
| Build | Generated metadata must be clean after build. |
| Typecheck | `tsc --noEmit` passes. |
| Lint | Zero warnings. |
| Unit/contract | Full non-live suite green. |
| Coverage | Coverage run green and uploads summary. |
| Schema drift | 25 tools and generated action count match docs and `SERVER_INFO`. |
| Inspector STDIO | `tools/list`, `resources/list`, `prompts/list`, invalid `tools/call`. |
| Inspector HTTP | initialize, tools/list, auth failure, invalid origin. |
| Security | `npm audit`, license allowlist, redaction tests. |
| Performance | Benchmark thresholds stabilized or marked non-blocking with trend alerts. |

## 17. Findings (P0-P3)

### P1 - SEP-1303 Validation Error Path Is Not Proven Compliant

Classification: spec violation risk.

Evidence:

- `src/mcp/registration/tool-handlers.ts:516-567` parses handler input and catches `z.ZodError`.
- The catch block enhances issues, then rethrows `new z.ZodError(enhancedIssues)`.
- SEP-1303 requires tool input validation failures during `tools/call` to be returned as tool execution errors where models can self-correct.

Failing behavior:

- No JSON-RPC transcript proves invalid `tools/call` returns `CallToolResult` with `isError: true`.

Root cause:

- Validation is performed inside the registered tool handler, but its error path still throws a Zod exception instead of explicitly building a tool error response.

Fix recommendation:

- Convert `ZodError` from `parseForHandler` to a structured tool response with `isError: true`, `INVALID_PARAMS`, path-specific messages, and retryable client category.

Test to prove fix:

- Add protocol test that calls a real tool with missing/invalid action params and asserts JSON-RPC success response containing `result.isError === true`, not JSON-RPC `error.code`.

Verification command:

```bash
npx vitest run tests/compliance/sep-1303-validation-errors.test.ts
```

### P1 - Full Test and Coverage Gates Are Red

Classification: test gap / production readiness gap.

Evidence:

- `npm test` failed with 5 OAuth callback server tests failing due loopback bind `EPERM`.
- `npx vitest run` failed with 11 tests across OAuth callback, analysis orchestrator cleanup, and benchmarks.
- `npx vitest run --coverage` failed with the same 11 failures.

Failing behavior:

- Release gates cannot currently prove production readiness.

Root cause:

- Some failures are sandbox-related, but fixture cleanup `ENOENT`, p95 threshold failures, and `TimeoutNaNWarning` need code/test fixes or outside-sandbox confirmation.

Fix recommendation:

- Split sandbox-incompatible loopback tests behind an environment capability check.
- Make fixture cleanup idempotent.
- Stabilize benchmark thresholds or convert them to trend metrics.
- Fix timeout config producing `NaN`.

Test to prove fix:

- Full `npx vitest run --coverage` passes in CI and locally outside sandbox.

Verification command:

```bash
npx vitest run --coverage
```

### P1 - OAuth/HTTP Redis Session Store Uses Lazy Connection Path

Classification: production hardening gap.

Evidence:

- `src/storage/session-store.ts:112-124` creates Redis client and connects lazily in `ensureConnected()`.
- `src/auth/oauth-provider.ts:211-220` creates session store without awaiting explicit initialization.
- `src/server/bootstrap.ts:65-72` does explicitly connect Redis for cache/session-context paths, but OAuth session store is separate.

Failing behavior:

- First OAuth/session requests can race Redis connection during startup.

Root cause:

- Redis lifecycle is command-triggered in `RedisSessionStore` and not uniformly awaited before HTTP readiness.

Fix recommendation:

- Add `initialize()` to session store, call `await sessionStore.initialize()` during OAuth/HTTP startup, and fail readiness if Redis session storage is required but not connected.

Test to prove fix:

- Mock Redis client and assert server does not call `listen()` until `connect()` resolves.

Verification command:

```bash
npx vitest run tests/unit/session-store-startup.test.ts tests/unit/oauth-provider.test.ts
```

### P1 - Production CORS Defaults Are Implicit

Classification: security issue / production hardening gap.

Evidence:

- `src/config/env.ts:199` defines `CORS_ORIGINS` with default `''`.
- `packages/mcp-http/src/runtime-config.ts:45-73` fills empty production origins with remote client origins.
- `packages/mcp-http/src/middleware.ts:211-227` enables CORS with credentials.

Failing behavior:

- Production can start without explicit origin configuration.

Root cause:

- Configuration default is interpreted downstream as an implicit allowlist.

Fix recommendation:

- In production, require explicit `CORS_ORIGINS` or emit a hard startup warning/failure depending on deployment mode.

Test to prove fix:

- Production env with empty `CORS_ORIGINS` fails config validation or logs a structured warning and only allows documented origins.

Verification command:

```bash
npx vitest run packages/mcp-http/src/runtime-config.test.ts packages/mcp-http/src/middleware.test.ts
```

### P2 - Action Count and Documentation Drift

Classification: docs drift / release metadata gap.

Evidence:

- Build generated metadata reported 25 tools and 410 actions.
- `docs/development/OPTIMIZATION_BRIEF.md` and `src/version.ts:23-28` still state 409 actions.

Failing behavior:

- Public server description can disagree with generated metadata.

Root cause:

- Action count is duplicated in prose rather than referenced from generated source of truth.

Fix recommendation:

- Update generated docs and `SERVER_INFO.description` from `src/generated/action-counts.ts`.

Test to prove fix:

- Add drift test asserting `SERVER_INFO.description` includes current generated action count.

Verification command:

```bash
npm run check:drift
```

### P2 - `response_format` Naming Drift

Classification: schema correctness / LLM usability gap.

Evidence:

- `src/schemas/data.ts` contains `response_format` fields at multiple action schemas.
- Output schema uses `responseFormat`.
- Handlers read `input.response_format` in `src/handlers/data-actions/read-write.ts`, `batch.ts`, and `cross.ts`.

Failing behavior:

- Tool inputs use snake_case while adjacent schema and outputs use camelCase, increasing model error rate and client confusion.

Root cause:

- Legacy field was retained in input schemas and handler contracts.

Fix recommendation:

- Add `responseFormat` as canonical input, temporarily accept `response_format` as deprecated alias, update handlers to normalize once.

Test to prove fix:

- Schema test verifies `responseFormat` appears in JSON Schema and alias still works during transition.

Verification command:

```bash
npx vitest run tests/unit/schemas/data-schema.test.ts tests/unit/handlers/data-response-format.test.ts
```

### P2 - Zod Conversion Can Fail Open to Empty Object Schema

Classification: SDK/Zod misuse risk.

Evidence:

- `src/utils/schema-compat.ts:211-219` catches conversion errors and returns `{ type: 'object', properties: {} }`.

Failing behavior:

- A broken schema conversion can publish an over-permissive empty object schema.

Root cause:

- Runtime compatibility helper is used in contexts where failure should be fatal.

Fix recommendation:

- Fail closed in build/schema generation. Only use fallback in explicitly non-production compatibility diagnostics.

Test to prove fix:

- Inject unsupported Zod schema in a fixture and assert schema generation fails.

Verification command:

```bash
npx vitest run tests/unit/schema-compat.test.ts
```

### P2 - Zod Private Internals Used for Schema Detection

Classification: SDK misuse / maintenance risk.

Evidence:

- `src/mcp/registration/tools-list-compat.ts:67-84` checks private `_def` and `_zod` markers.

Failing behavior:

- Zod minor updates can break schema detection.

Root cause:

- No public compatibility abstraction isolates Zod v3/v4 detection.

Fix recommendation:

- Use public `z.ZodType` checks where possible, or isolate the private detection behind a tested helper with explicit Zod version coverage.

Test to prove fix:

- Unit tests with actual Zod schemas and plain objects prove no false positives/negatives.

Verification command:

```bash
npx vitest run tests/unit/tools-list-compat.test.ts
```

### P2 - HTTP Rate Limiting Is IP-Only in Middleware Path

Classification: security issue.

Evidence:

- `packages/mcp-http/src/middleware.ts:244-254` derives rate-limit key from trusted client IP.
- No principal/user key is visible in that middleware path.

Failing behavior:

- Authenticated users behind one NAT share a bucket; one abusive authenticated user can consume shared proxy capacity.

Root cause:

- Rate limiting happens before or without authenticated principal context.

Fix recommendation:

- Add a second per-principal limiter after auth. Keep IP limiter for unauthenticated abuse.

Test to prove fix:

- Two users from same IP get independent authenticated buckets; one user exceeding limit does not block the other.

Verification command:

```bash
npx vitest run packages/mcp-http/src/rate-limit.test.ts
```

### P2 - Tool Latency Histogram Is Defined But Not Recorded With Outcome Labels

Classification: observability gap.

Evidence:

- `src/observability/metrics.ts:35-43` defines `servalsheets_tool_call_duration_seconds` histogram with labels `tool`, `action`.
- `recordToolCallLatency` at `metrics.ts:813-818` records only a summary.
- Tool handler calls latency recording around `src/mcp/registration/tool-handlers.ts:1421`.

Failing behavior:

- Prometheus histogram does not expose tool latency by success/error code as requested.

Root cause:

- Metric definition and recording path drifted.

Fix recommendation:

- Record histogram and include bounded labels: `tool`, `action`, `success`, `error_code`.

Test to prove fix:

- Metrics unit test asserts histogram observation after success and failure tool calls.

Verification command:

```bash
npx vitest run tests/unit/observability/metrics.test.ts
```

### P2 - Inspector Automation Is Not Yet Proven

Classification: test gap.

Evidence:

- `npx @modelcontextprotocol/inspector --help` hung and was killed.
- npm reported log-dir write failure afterward.

Failing behavior:

- No Inspector CLI artifact exists for STDIO or HTTP.

Root cause:

- Local npm environment issue plus no committed Inspector automation.

Fix recommendation:

- Add Inspector scripts and run them in CI where npm cache/log directory is writable.

Test to prove fix:

- CI uploads Inspector JSON for `tools/list`, invalid `tools/call`, `resources/list`, and `prompts/list`.

Verification command:

```bash
npm run audit:inspector:stdio
```

### P3 - Optimization Brief Contains Stale Findings

Classification: docs drift.

Evidence:

- `SERVER_INFO.description` already exists at `src/version.ts:23-28`.
- Resource completion is implemented at `src/server/control-plane-registration.ts:181-199`.
- Federation/webhook/connector enum descriptions already exist.
- `tableName` is sent in `src/handlers/advanced-actions/tables.ts:256`.
- `update_dimension_group` exists in schema, handler, cache invalidation, and response hints.
- `/health/live` and `/health/ready` exist.
- Spreadsheet existence cache is bounded with TTL/max size in `src/services/cached-sheets-api.ts`.

Failing behavior:

- Engineers may waste time implementing fixes that already landed.

Root cause:

- Audit brief is not regenerated from current code.

Fix recommendation:

- Replace the brief with a generated status checklist tied to current verification commands.

Test to prove fix:

- Docs drift script verifies every checklist item has a passing/known-failing command.

Verification command:

```bash
npm run check:drift
```

## 18. Fix Roadmap

Sprint 1:

1. Add SEP-1303 negative `tools/call` test and fix validation error response path.
2. Stabilize full test gate: OAuth bind capability skip, fixture cleanup, benchmark threshold, timeout `NaN`.
3. Fix metadata/docs action count drift.
4. Require or loudly validate production CORS config.
5. Await Redis session store initialization in OAuth/HTTP startup.

Sprint 2:

1. Normalize `responseFormat` input with deprecated alias support.
2. Make schema conversion fail closed in generation paths.
3. Replace or isolate private Zod internals.
4. Add per-principal rate limiting.
5. Record tool call histogram with success/error labels.

Sprint 3:

1. Add Inspector STDIO and HTTP automation.
2. Add generated schema and handler matrices.
3. Add resource/prompt/task/cancellation/progress JSON-RPC harness cases.
4. Add license and npm audit CI gates after npm environment is fixed.

Sprint 4:

1. Reconcile OAuth scope profiles: basic vs full.
2. Add token key rotation tests.
3. Update Workspace Events and smart chip docs against current Google docs.
4. Add sampling config enhancements only where MCP clients support them.

## 19. Verification Commands

Baseline:

```bash
git status --short
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
node --version
npm --version
```

Build and static checks:

```bash
npm run build
npm run typecheck
npm run lint
npm run check:drift
```

Tests:

```bash
npm test
npx vitest run
npx vitest run --coverage
```

Protocol and Inspector:

```bash
npm run validate:mcp-protocol
npm run check:mcp-features
npx @modelcontextprotocol/inspector --cli node dist/server.js --method tools/list
```

Security:

```bash
npm audit
npx license-checker --production --onlyAllow 'MIT;ISC;Apache-2.0;BSD-2-Clause;BSD-3-Clause;CC0-1.0;Unlicense;0BSD'
```

Targeted new tests:

```bash
npx vitest run tests/compliance/sep-1303-validation-errors.test.ts
npx vitest run tests/unit/session-store-startup.test.ts
npx vitest run packages/mcp-http/src/rate-limit.test.ts
npx vitest run tests/unit/schema-compat.test.ts
npx vitest run tests/unit/observability/metrics.test.ts
```

## 20. Final Score

| Category | Score |
|---|---:|
| Protocol compliance | 78 |
| SDK correctness | 76 |
| Schemas | 80 |
| Tools/resources/prompts | 82 |
| Transports/lifecycle | 78 |
| Error handling | 72 |
| Security | 74 |
| Testing | 70 |
| CI | 76 |
| Documentation | 72 |
| Production readiness | 76 |

Final score: **78/100**.

The project has strong breadth and many previously identified gaps are already fixed. The remaining blockers are not mostly feature count issues; they are proof issues: protocol transcripts, stable full test gates, explicit production startup/security behavior, and generated metadata consistency.
