# ServalSheets Production-Readiness Assessment

**Project:** ServalSheets v1.6.0 — Google Sheets MCP Server
**Assessor:** Senior Staff Engineer / Security Reviewer
**Date:** 2026-02-05
**Runtime:** Node.js 20+ / TypeScript 5.9
**Deployment:** Docker/Kubernetes, Cloud Run, stdio (Claude Desktop)
**Data Sensitivity:** PII (user spreadsheet data, OAuth tokens, Google credentials)

---

## 1. Executive Summary

### Recommendation: **CONDITIONAL GO** — with 2 P0 blockers that must be resolved first

ServalSheets is a remarkably feature-rich MCP server (21 tools, 293+ actions) with mature engineering across auth, observability, testing, and safety rails. The architecture reflects serious production thinking: encrypted token storage, PKCE-enforced OAuth 2.1, circuit breakers, comprehensive log redaction, and property-based tests.

However, two Critical findings block a clean production launch:

1. **Real secrets exist on disk** (`.env`, `.env.backup`) containing live OAuth client secrets, API keys, encryption keys, and an Anthropic API key. While `.env` is gitignored and not tracked, the `.env.backup` file's presence with a *different* set of OAuth credentials indicates credential sprawl. Any developer cloning this repo's working directory receives live secrets.

2. **Webhook URL registration lacks SSRF protection.** The Zod schema requires HTTPS (`z.string().url().startsWith('https://')`) but does not block private/internal IP ranges (`10.x`, `172.16-31.x`, `192.168.x`, `169.254.x`, `127.x`, `::1`). An attacker who gains MCP tool access can register webhooks to internal infrastructure endpoints.

### Top 5 Risks

| # | Risk | Severity | Blast Radius |
|---|------|----------|-------------|
| 1 | Live secrets on disk (`.env`, `.env.backup` with OAuth secrets + Anthropic API key) | **Critical** | Full account compromise, API key abuse |
| 2 | Webhook SSRF — no private IP blocking on webhook URL registration | **High** | Internal network scanning, data exfiltration to internal endpoints |
| 3 | Apps Script `run` action executes arbitrary functions with no whitelist | **High** | Code execution under user's Google identity |
| 4 | No per-user/per-tenant rate limiting at MCP tool layer (only per-IP at HTTP) | **Medium** | Quota exhaustion, abuse amplification |
| 5 | Token refresh race condition — no mutex on concurrent refresh calls | **Medium** | Duplicate token refresh requests, potential token invalidation |

---

## 2. Architecture Overview

### Repository Map

```
servalsheets/
├── src/
│   ├── cli.ts                    # CLI entrypoint (stdio + http modes)
│   ├── server.ts                 # MCP server core (~1200 lines)
│   ├── http-server.ts            # Express HTTP/SSE transport (~800 lines)
│   ├── oauth-provider.ts         # OAuth 2.1 provider (~900 lines)
│   ├── remote-server.ts          # Remote server wrapper
│   ├── index.ts                  # Library export
│   ├── handlers/                 # 25 tool handler files (one per tool domain)
│   │   ├── base.ts               # BaseHandler with auth, circuit breaker, safety
│   │   ├── data.ts, core.ts, format.ts, dimensions.ts, ...
│   │   ├── appsscript.ts         # HIGH-RISK: script execution
│   │   ├── webhooks.ts           # HIGH-RISK: webhook registration
│   │   └── collaborate.ts        # MEDIUM-RISK: sharing/permissions
│   ├── mcp/
│   │   └── registration/         # Tool/resource/prompt definitions
│   ├── schemas/                  # Zod schemas for all 21 tools
│   ├── security/                 # Webhook signatures, scope management, RFC 8707
│   ├── services/                 # Google API client, token management, caching
│   ├── config/                   # Environment validation, constants, scopes
│   ├── utils/                    # Logger, redaction, retry, validation helpers
│   ├── server/                   # Health checks, metrics server
│   ├── startup/                  # Lifecycle, security validations
│   ├── observability/            # OpenTelemetry, SLI/SLO, metrics
│   └── core/                     # Rate limiter, policy enforcer, batch compiler
├── tests/                        # 206 test files across 26 directories
├── deployment/                   # Docker, Kubernetes, observability configs
├── .github/workflows/            # CI (ci.yml, security.yml, test-gates.yml)
├── .env.example                  # Template (safe)
├── .env                          # LIVE SECRETS (gitignored but on disk)
├── .env.backup                   # LIVE SECRETS (different credentials!)
└── Dockerfile                    # Multi-stage Alpine, non-root
```

### Request Flow (stdio mode)

```
Claude Desktop → stdin (JSON-RPC) → StdioServerTransport
  → server.ts handleToolCall()
    → requestQueue (concurrency control)
    → checkAuth(googleClient)
    → Zod schema validation (parseWithCache)
    → Handler.handle(request)
      → requireAuth()
      → scopeValidator.validateOperation()
      → Google Sheets/Drive/Script API call
        → rate-limiter → circuit-breaker → retry w/ backoff
      → response compaction → history recording
    → buildToolResponse()
  → stdout (JSON-RPC response)
```

### Request Flow (HTTP mode)

```
HTTP Client → Express (helmet, cors, compression, rate-limit)
  → OAuth 2.1 provider (PKCE + JWT)
  → StreamableHTTPServerTransport / SSEServerTransport
  → same MCP server pipeline as above
```

### Key Third-Party Dependencies

| Dependency | Version | Risk | Notes |
|-----------|---------|------|-------|
| `@modelcontextprotocol/sdk` | 1.26.0 | Low | Official MCP SDK |
| `googleapis` | ^171.0.0 | Low | Official Google client |
| `express` | ^5.2.1 | Low | Express 5 (newer, less battle-tested than v4) |
| `jsonwebtoken` | ^9.0.2 | Low | Well-maintained |
| `zod` | 4.3.6 | Low | Pinned, well-maintained |
| `winston` | ^3.17.0 | Low | Standard logger |
| `keytar` | ^7.9.0 (optional) | Medium | Native module, system keychain access |
| `redis` | ^5.10.0 (optional) | Low | Session store for production |

No abandoned or high-risk dependencies identified. All are mainstream, actively maintained packages.

---

## 3. Production-Readiness Rubric

### 3.1 Correctness & Robustness — Score: 4/5

**Strengths:**
- Zod discriminated unions for all 21 tools with typed action routing
- Policy enforcer caps operations at 50K cells, 10K row deletes
- Grid data size validation prevents OOM (`base.ts:1121-1186`)
- Response size limits (10MB max, 50KB compact threshold)
- ETag caching prevents stale reads
- Request deduplication prevents concurrent duplicates

**Gaps:**
- A1 notation parsing relies on Google API for final validation (no pre-flight check)
- Comment/reply text length not validated at schema level
- Apps Script `parameters` field accepts arbitrary JSON without type constraints

### 3.2 Security — Score: 3/5

**Strengths:**
- OAuth 2.1 with mandatory PKCE (S256 only)
- AES-256-GCM encrypted token storage with atomic writes and 0o600 permissions
- JWT with HS256, audience/issuer validation, 30s clock tolerance
- HMAC-SHA256 webhook signatures with timing-safe comparison
- RFC 8707 resource indicators prevent token mis-redemption
- Comprehensive log redaction (50+ field patterns, deep object traversal)
- Helmet security headers on HTTP transport
- TruffleHog + CodeQL in CI security workflow

**Gaps (see Risk Register):**
- Live secrets on disk (Critical)
- No SSRF protection on webhook URLs (High)
- No Apps Script function whitelist (High)
- No per-user rate limiting at tool layer (Medium)
- `HOST` env var can be set to `0.0.0.0` without explicit opt-in (Medium)

### 3.3 Privacy & Compliance — Score: 4/5

**Strengths:**
- Incremental scope consent (160+ operation-to-scope mappings)
- Least-privilege scope defaults per operation
- Token encryption at rest (AES-256-GCM)
- File permissions 0o600 for token files
- Audit logging for token operations
- PRIVACY.md present

**Gaps:**
- Email addresses logged in audit trails (may need opt-out for GDPR)
- No data retention policy enforcement in code
- No explicit PII scrubbing for spreadsheet cell values in logs

### 3.4 Reliability — Score: 4/5

**Strengths:**
- Exponential backoff with jitter (base 500ms, max 60s, 3 retries)
- `Retry-After` header parsing (seconds and HTTP-date)
- Token bucket rate limiter with auto-throttle on 429 (50% reduction for 60s)
- Circuit breaker with configurable thresholds
- Graceful shutdown with 10s timeout, signal handlers (SIGTERM, SIGINT, SIGHUP)
- Proactive token refresh at 80% lifetime
- Connection health monitoring
- Request queue with concurrency limits

**Gaps:**
- No mutex on concurrent token refresh (race condition)
- Memory sessions lost on restart in non-Redis deployments
- No idempotency keys for write operations

### 3.5 Performance — Score: 4/5

**Strengths:**
- HTTP/2 support with keep-alive connection pooling
- Response compaction (50-80% size reduction)
- Lazy tool loading (`LAZY_LOAD_TOOLS`)
- Schema caching (`parseWithCache`)
- Request deduplication and merging
- Adaptive batch windowing
- Worker pool for formula parsing

**Gaps:**
- No request-level memory budgets
- Large response temporary storage uses filesystem (not bounded)

### 3.6 Observability — Score: 4/5

**Strengths:**
- OpenTelemetry tracing with span attributes per tool call
- Prometheus metrics via `prom-client`
- Structured Winston logging with request context (requestId, traceId, spanId)
- Health endpoints: `/health/live` (liveness) and `/health/ready` (readiness with component checks)
- Metrics server endpoint
- SLI/SLO definitions
- Comprehensive redaction system prevents token leakage in logs

**Gaps:**
- No documented Grafana dashboard configs
- Health check does not verify Google API quota remaining

### 3.7 Testing Quality — Score: 4/5

**Strengths:**
- 206 test files across unit, integration, compliance, security, property-based, load, chaos categories
- Vitest with 75% statement/function/line thresholds, 70% branches
- Property-based tests with fast-check
- Mocked OAuth clients and Google API responses
- Security tests for PKCE, RFC 8707, token validation
- Contract tests with breaking change detection
- 4-shard parallel CI execution
- Codecov integration with PR comments

**Gaps:**
- No end-to-end tests against real MCP client (inspector only)
- No fuzz testing of Zod schema boundaries
- Load/chaos tests exist but coverage unclear

### 3.8 CI/CD & Release Engineering — Score: 4/5

**Strengths:**
- Multi-stage CI: quick checks → 4-shard tests → build → security audit
- 6 specialized test gates with minimum thresholds
- CodeQL, TruffleHog, dependency review in security workflow
- Husky pre-commit hooks with lint-staged
- `npm audit` integration
- Provenance-enabled npm publishing
- Turbo build caching

**Gaps:**
- No SBOM generation
- npm audit at `moderate` level (should be `high` minimum for production)
- No container image scanning (Trivy/Snyk) in CI

### 3.9 Configuration Management — Score: 3/5

**Strengths:**
- Centralized Zod-validated env config (`config/env.ts`)
- Fail-fast at startup on invalid config
- Secure defaults (host `127.0.0.1`, PKCE required, encryption enforced in production)
- Feature flags for staged rollout
- Three tool modes: lite/standard/full

**Gaps:**
- Multiple `.env` files with real secrets on disk
- No env validation for conditional requirements (e.g., Redis URL when `SESSION_STORE_TYPE=redis`)
- `HOST=0.0.0.0` accepted without explicit warning/confirmation
- Same value used for `SESSION_SECRET`, `JWT_SECRET`, and `STATE_SECRET` in `.env`

### 3.10 Documentation & Runbooks — Score: 3/5

**Strengths:**
- Extensive README (65KB)
- OAuth flow diagrams and migration guides
- SECURITY.md with responsible disclosure
- CONTRIBUTING.md
- Deployment docs directory
- VitePress documentation site

**Gaps:**
- No incident response runbook
- No on-call playbook for common failures
- No documented secret rotation procedure (JWT rotation code exists but no ops guide)

---

## 4. Risk Register

### RISK-001: Live Secrets on Disk

| Field | Value |
|-------|-------|
| **Severity** | Critical |
| **Likelihood** | High (secrets exist now) |
| **Impact** | Full account compromise |
| **Evidence** | `.env` lines 7-8 (OAuth ID/secret), line 25 (session secret), line 31 (encryption key), line 34 (JWT secret), line 37 (state secret), line 76 (Anthropic API key). `.env.backup` lines 7-8 (different OAuth credentials). |
| **Exploit Scenario** | Developer shares working directory, backup, or disk image. Attacker obtains OAuth client secret, impersonates application, steals user tokens. Anthropic API key enables billing abuse. |
| **Fix** | 1) Immediately rotate ALL credentials in `.env` and `.env.backup`. 2) Delete `.env.backup`. 3) Add `.env.backup` and `.env.local` to `.gitignore`. 4) Use a secrets manager (Google Secret Manager, Vault) for production. 5) Scan git history with TruffleHog to confirm secrets were never committed. |
| **Effort** | Small (rotation) + Medium (secrets manager) |
| **Test** | CI check: `test -f .env && echo "FAIL: .env must not exist in repo" && exit 1` |

### RISK-002: Webhook SSRF — No Private IP Blocking

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Likelihood** | Medium |
| **Impact** | Internal network scanning, metadata service access |
| **Evidence** | `src/schemas/webhook.ts:44` validates `z.string().url().startsWith('https://')` but no IP range check. `src/services/webhook-manager.ts` uses URL directly without resolution check. |
| **Exploit Scenario** | Attacker registers webhook to `https://169.254.169.254/latest/meta-data/` (cloud metadata) or `https://10.0.0.1/admin` (internal service). Webhook delivery sends spreadsheet change data to internal endpoint, potentially leaking cloud credentials. |
| **Fix** | Add URL validation function that resolves DNS and blocks RFC 1918, link-local, loopback, and metadata IP ranges. Apply before webhook registration. |
| **Effort** | Small |
| **Test** | Unit test: attempt webhook registration with `https://169.254.169.254/`, `https://10.0.0.1/`, `https://127.0.0.1/`, `https://[::1]/` — all must be rejected. |

### RISK-003: Apps Script Arbitrary Function Execution

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Likelihood** | Low (requires OAuth auth) |
| **Impact** | Code execution under user's Google identity |
| **Evidence** | `src/handlers/appsscript.ts` lines 785-922, `handleRun()` accepts any `functionName` and `parameters`. |
| **Exploit Scenario** | Compromised MCP client sends `run` action with malicious function name targeting a project the authenticated user owns, executing arbitrary Apps Script (which has full Google Workspace access). |
| **Fix** | 1) Add optional function whitelist per project. 2) Require explicit user confirmation before `run` via `sheets_confirm`. 3) Log all `run` invocations to audit trail. |
| **Effort** | Medium |
| **Test** | Integration test: verify `run` with non-whitelisted function returns error when whitelist is configured. |

### RISK-004: No Per-User Rate Limiting at MCP Layer

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Likelihood** | Medium |
| **Impact** | Google API quota exhaustion, DoS |
| **Evidence** | `src/core/rate-limiter.ts` implements token bucket per operation type (read/write) but not per user. HTTP layer has per-IP rate limiting (`express-rate-limit`) but stdio transport has no user-level limits. `src/services/user-rate-limiter.ts` exists but integration not confirmed in tool handler path. |
| **Exploit Scenario** | In multi-user HTTP deployment, one user's rapid tool calls exhaust shared Google API quota, degrading service for all users. |
| **Fix** | Integrate `UserRateLimiter` into `handleToolCall()` in `server.ts`, keyed by authenticated user identity. |
| **Effort** | Small |
| **Test** | Load test: simulate 2 users, verify one user's burst doesn't block the other. |

### RISK-005: Token Refresh Race Condition

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Likelihood** | Low |
| **Impact** | Duplicate refresh requests, potential token invalidation |
| **Evidence** | `src/services/token-manager.ts` uses singleton pattern but `checkAndRefresh()` has no mutex/lock for concurrent callers. |
| **Exploit Scenario** | Two concurrent requests detect token near expiry, both call refresh. Google may invalidate the first refresh token when the second is used, causing auth failures. |
| **Fix** | Add a promise-based mutex: if refresh is in-flight, subsequent callers await the same promise. |
| **Effort** | Small |
| **Test** | Unit test: call `checkAndRefresh()` concurrently 10 times, verify only 1 actual refresh API call is made. |

### RISK-006: Identical Secrets for Multiple Purposes

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Likelihood** | Medium (currently in `.env`) |
| **Impact** | Key compromise affects all subsystems |
| **Evidence** | `.env` lines 25, 34, 37: `SESSION_SECRET`, `JWT_SECRET`, and `STATE_SECRET` all use the same value `0284fd59d7bd117c398d06de140334e731d111d02de695c74dba6243c5e91b3b`. |
| **Exploit Scenario** | Compromise of any one secret (e.g., via timing attack on state HMAC) gives attacker ability to forge JWTs, session tokens, and OAuth state parameters. |
| **Fix** | Generate unique secrets for each purpose. Add startup validation that rejects identical values. |
| **Effort** | Small |
| **Test** | Startup test: set identical secrets, verify server refuses to start with clear error. |

### RISK-007: HOST Binding Override

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Likelihood** | Low |
| **Impact** | Network exposure |
| **Evidence** | `src/config/env.ts` defaults `HOST` to `127.0.0.1` but accepts any value including `0.0.0.0`. |
| **Fix** | If `HOST` is set to `0.0.0.0`, require explicit `ALLOW_EXTERNAL_ACCESS=true` or log a prominent warning. |
| **Effort** | Small |
| **Test** | Config test: set `HOST=0.0.0.0` without `ALLOW_EXTERNAL_ACCESS=true`, verify error or warning. |

---

## 5. Google API Integration Review

### Auth Approach: STRONG

- **OAuth 2.1 with PKCE** (S256 only, plain rejected) — modern best practice
- **Service account support** — for server-to-server deployments
- **Access token passthrough** — for pre-authenticated clients
- JWT signed with HS256, audience/issuer validated
- Secret rotation support (previous JWT secret accepted during rotation window)
- Circuit breaker on OAuth flows (3-failure threshold)

### Scopes: EXCELLENT (Least Privilege)

- 160+ operation-to-scope mappings in `src/security/incremental-scope.ts`
- Read operations → `.readonly` scopes
- Basic operations → `.spreadsheets` scope
- File operations → `.drive.file` (limited)
- Sharing operations → `.drive` (full, only when needed)
- Apps Script → separate `script.*` scopes
- Incremental consent flow returns auth URL for missing scopes

### Retry/Backoff: GOOD

- Exponential backoff: 500ms base, 60s max, 20% jitter, 3 max retries
- Retryable status codes: 401, 429, 500, 502, 503, 504
- Network error codes: ETIMEDOUT, ECONNRESET, ECONNREFUSED, EAI_AGAIN, ENOTFOUND
- HTTP/2 errors: GOAWAY, SESSION_ERROR, STREAM_CANCEL
- `Retry-After` header parsing (seconds and HTTP-date formats)
- Auto-throttle: 50% rate reduction for 60s on 429
- Per-request timeout via AbortSignal (default 30s)

**Gap:** Rate limit error detection relies on error message string matching (fragile).

### Token Storage: STRONG

- AES-256-GCM encryption with random 12-byte IV per encryption
- Auth tag verification (authenticated encryption)
- 64-character hex key validation at startup
- Atomic writes (temp file + rename)
- File permissions 0o600
- Proactive refresh at 80% token lifetime
- Anomaly detection (>10 refreshes/hour triggers warning)

**Gap:** No token refresh mutex (RISK-005).

### Logging: STRONG (Redaction)

- 50+ sensitive field names auto-redacted
- Pattern detection: Google API keys, OAuth tokens, Bearer tokens, JWTs, AWS keys
- Deep object traversal with circular reference protection
- Recursive depth limit (10) prevents stack overflow
- Applied to all tool call args/results before logging

### Policy/Compliance

- No detected violations of Google API Terms of Service
- Appropriate use of Google client libraries
- API quotas respected via rate limiter + circuit breaker
- Batch limit enforcement (100 requests per batchUpdate, matching Google's limit)

---

## 6. MCP Server Contract & Safety Review

### Tool/Resource Schema: GOOD

- 21 tools with Zod discriminated union schemas
- Typed input/output for all 293+ actions
- Schema optimization: lite (8 tools, 199KB), standard (12), full (21)
- Lazy loading for enterprise tools
- Response compaction reduces LLM context consumption

### Validation: GOOD

- Pre-handler Zod parsing via `parseWithCache()` in `tool-handlers.ts`
- Payload size validation against Google's 10MB limit (9MB safety threshold)
- Grid data size validation (max 500K cells)
- Request deduplication prevents concurrent duplicates

**Gaps:**
- No explicit max string length for text inputs (comment bodies, cell values)
- No rate limiting at MCP protocol level (relies on transport layer)
- A1 notation validated by regex but final validation delegated to Google API

### Dangerous Capabilities

| Capability | Tool | Risk | Mitigation |
|-----------|------|------|-----------|
| Script execution | `sheets_appsscript:run` | HIGH | OAuth-only, circuit breaker, NO function whitelist |
| Webhook registration | `sheets_webhook:register` | HIGH | HTTPS required, NO SSRF protection |
| Document sharing | `sheets_collaborate:share_add` | MEDIUM | Elevated access flag + scope validation |
| Data deletion | `sheets_dimensions:delete_rows/cols` | MEDIUM | Policy enforcer caps at 10K rows |
| BigQuery import | `sheets_bigquery:import` | MEDIUM | Requires BigQuery API enablement |

### Safety Rails: GOOD

- Policy enforcer: max 50K cells/operation, 10K row deletes, 100 column deletes
- Confirmation required: >100 cells affected
- Snapshot recommended: all destructive operations
- Dry-run support for preview
- Single destructive operation per batch
- Explicit range required for destructive operations

### Contract Stability

- MCP Protocol version: 2025-11-25
- Tool schemas versioned via `server.json`
- Breaking change detection in CI test gates (minimum 15 tools)
- Schema comparison with Google Discovery API

---

## 7. Production Hardening Checklist

### P0 — Must-Do Before Launch

- [ ] **Rotate all secrets** in `.env` and `.env.backup` (OAuth client secret, Anthropic API key, encryption key, JWT/session/state secrets)
- [ ] **Delete `.env.backup`** and add it to `.gitignore`
- [ ] **Run TruffleHog** on full git history to confirm no secrets were committed: `trufflehog git file://. --since-commit=HEAD~100`
- [ ] **Add SSRF protection** to webhook URL validation — block private IP ranges, link-local, loopback, metadata endpoints
- [ ] **Generate unique secrets** for `SESSION_SECRET`, `JWT_SECRET`, and `STATE_SECRET` (currently identical)
- [ ] **Add token refresh mutex** to prevent concurrent refresh race condition

### P1 — Should-Do Soon

- [ ] **Integrate UserRateLimiter** into `handleToolCall()` for per-user limits in multi-user deployments
- [ ] **Add request body size limits** to HTTP server (`express.json({ limit: '1mb' })`)
- [ ] **Add Apps Script confirmation** — require `sheets_confirm` before `run` action
- [ ] **Validate HOST binding** — warn or error if `0.0.0.0` without `ALLOW_EXTERNAL_ACCESS=true`
- [ ] **Add container image scanning** (Trivy) to CI pipeline
- [ ] **Generate SBOM** in CI build (`npm sbom` or `syft`)
- [ ] **Add incident response runbook** covering: auth failures, quota exhaustion, token compromise, data breach
- [ ] **Add explicit max string lengths** to comment/cell value inputs in Zod schemas

### P2 — Nice-to-Have

- [ ] Add end-to-end MCP client tests (not just inspector)
- [ ] Add fuzz testing for Zod schema boundary inputs
- [ ] Create Grafana dashboard templates
- [ ] Add health check for Google API quota remaining
- [ ] Document secret rotation procedure (ops runbook)
- [ ] Add email domain whitelist option for sharing operations
- [ ] Implement idempotency keys for write operations
- [ ] Add request-level memory budgets
- [ ] Upgrade npm audit to `--audit-level=high` in CI

---

## 8. Proposed Patch Snippets

### Patch 1: SSRF Protection for Webhook URLs

```typescript
// src/utils/url-validator.ts (NEW FILE)
import { URL } from 'url';
import { lookup } from 'dns/promises';

const BLOCKED_IP_RANGES = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^169\.254\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./, // CGNAT
  /^::1$/, /^fe80:/i, /^fc00:/i, /^fd00:/i,
];

const BLOCKED_HOSTNAMES = ['localhost', 'metadata.google.internal'];

export async function validateWebhookUrl(url: string): Promise<void> {
  const parsed = new URL(url);

  if (parsed.protocol !== 'https:') {
    throw new Error('Webhook URL must use HTTPS');
  }

  if (BLOCKED_HOSTNAMES.includes(parsed.hostname.toLowerCase())) {
    throw new Error(`Blocked hostname: ${parsed.hostname}`);
  }

  // Resolve DNS to prevent DNS rebinding
  const { address } = await lookup(parsed.hostname);
  for (const pattern of BLOCKED_IP_RANGES) {
    if (pattern.test(address)) {
      throw new Error(`Webhook URL resolves to blocked IP range`);
    }
  }
}
```

### Patch 2: Token Refresh Mutex

```typescript
// In src/services/token-manager.ts — add to class
private refreshPromise: Promise<void> | null = null;

async checkAndRefresh(): Promise<void> {
  // If a refresh is already in-flight, await the same promise
  if (this.refreshPromise) {
    return this.refreshPromise;
  }

  try {
    this.refreshPromise = this._doRefresh();
    await this.refreshPromise;
  } finally {
    this.refreshPromise = null;
  }
}

private async _doRefresh(): Promise<void> {
  // ... existing refresh logic moved here ...
}
```

### Patch 3: Startup Validation for Identical Secrets

```typescript
// In src/startup/lifecycle.ts — add to security validations
function validateUniqueSecrets(): void {
  const secrets = {
    SESSION_SECRET: process.env.SESSION_SECRET,
    JWT_SECRET: process.env.JWT_SECRET,
    STATE_SECRET: process.env.STATE_SECRET,
  };

  const values = Object.values(secrets).filter(Boolean);
  const unique = new Set(values);

  if (values.length > 1 && unique.size < values.length) {
    const msg = 'SEC-008: SESSION_SECRET, JWT_SECRET, and STATE_SECRET must be unique values';
    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg);
    }
    logger.warn(msg);
  }
}
```

### Patch 4: Apps Script Run Confirmation

```typescript
// In src/handlers/appsscript.ts — add to handleRun()
async handleRun(input: AppsScriptRunInput): Promise<AppsScriptResponse> {
  // Require confirmation for script execution
  const confirmService = this.context.confirmService;
  if (confirmService) {
    const confirmed = await confirmService.requireConfirmation({
      operation: 'appsscript_run',
      description: `Execute function "${input.functionName}" in project ${input.scriptId}`,
      impact: 'Script will run with your Google account permissions',
      parameters: input.parameters,
    });
    if (!confirmed) {
      return { success: false, error: { code: 'CONFIRMATION_REQUIRED', message: 'User declined script execution' } };
    }
  }

  // ... existing run logic ...
}
```

### Patch 5: Request Body Size Limit

```typescript
// In src/http-server.ts — add after express() initialization
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
```

### Patch 6: Graceful Shutdown Test

```typescript
// tests/server/graceful-shutdown.test.ts (NEW)
import { describe, it, expect, vi } from 'vitest';

describe('Graceful Shutdown', () => {
  it('should complete in-flight requests before shutting down', async () => {
    // Setup: start server, send a slow request
    // Action: send SIGTERM during request processing
    // Assert: request completes, server exits with code 0
  });

  it('should force-terminate after 10s timeout', async () => {
    // Setup: start server, send a request that hangs
    // Action: send SIGTERM
    // Assert: server exits within 11s
  });
});
```

---

## 9. Summary Scores

| Category | Score | Status |
|----------|-------|--------|
| 1. Correctness & Robustness | 4/5 | Good |
| 2. Security | 3/5 | **Needs Work (P0 blockers)** |
| 3. Privacy & Compliance | 4/5 | Good |
| 4. Reliability | 4/5 | Good |
| 5. Performance | 4/5 | Good |
| 6. Observability | 4/5 | Good |
| 7. Testing Quality | 4/5 | Good |
| 8. CI/CD & Release | 4/5 | Good |
| 9. Configuration Management | 3/5 | **Needs Work (secret hygiene)** |
| 10. Documentation & Runbooks | 3/5 | Adequate |
| **Overall** | **3.7/5** | **Conditional Go** |

### Launch Blocker Summary

To upgrade from **Conditional Go** to **Go**:

1. Rotate and remove all live secrets from disk
2. Add SSRF protection to webhook URL validation
3. Generate unique secrets for each cryptographic purpose
4. Add token refresh mutex

Estimated effort to clear all P0 blockers: **1-2 days** of focused engineering work.

---

*Assessment prepared 2026-02-05. This document should be reviewed and updated after remediation of P0 items.*
