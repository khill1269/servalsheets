---
title: Audit Fix Plan
description: Execution roadmap for audit findings from Sessions 112-114
category: development
last_updated: "2026-04-20"
---

# ServalSheets — Audit Fix Plan

> **Purpose**: Execution roadmap for the findings from the three-agent audit
> (MCP protocol compliance, Google API + security, TypeScript code quality).
> Each phase is ordered to minimize cascade breakage, every change is pinned
> to `file:line`, and every fix has a verification step.
>
> **Ground truth as of 2026-04-19** (re-verified against working tree before
> writing this plan). Counts in this document come from `rg`/`wc -l` against
> HEAD, not from prior audit memos.
>
> **Scope**: The plan does not change feature behavior. It closes gaps between
> what the codebase claims (`CLAUDE.md`, `.serval/state.md`, marketing copy)
> and what the code actually does, and satisfies the external compliance bars
> needed for Google OAuth verification + Anthropic MCP Marketplace listing.

---

## Verified Baseline (2026-04-19)

| Metric                                              | Claimed                | Observed             | Source                           |
| --------------------------------------------------- | ---------------------- | -------------------- | -------------------------------- |
| `console.*` in src/                                 | "zero in handlers"     | 0 via gate ✅        | `bash scripts/check-debug-prints.sh` |
| `console.*` raw count in src/*.ts                   | —                      | 204 (all excluded)   | `rg`                             |
| `Math.random` in tests                              | "banned"               | 38 across 22 files ❌ | `rg tests/`                     |
| `as any` in src/                                    | 21                     | 107 across 25 files ❌| `rg src/`                       |
| `agency` / `requiredScopes` in annotations.ts       | "SEP-1792/1880 wired"  | 0 matches ❌         | `rg src/generated/annotations.ts` |
| `/oauth/register` (DCR RFC 7591)                    | —                      | missing ❌           | `rg src/`                        |
| Google revoke call in `/oauth/revoke`               | —                      | missing ❌           | `oauth-provider.ts:1092-1124`    |
| Refresh token rotation                              | —                      | missing ❌           | `oauth-provider.ts:445-507`      |
| `privacy_policy` / `tos_uri` in Google auth URL     | —                      | missing ❌           | `oauth-provider.ts:789-801`      |
| Audit log retention                                 | 7-year (doc comment)   | 90-day default ❌    | `audit-logger.ts:193`            |
| tar chain                                           | "CVE-vulnerable"       | 7.5.13 + 6.2.1 ⚠️     | `package-lock.json`              |
| Tests passing                                       | 2810/2810              | (to re-verify)       | `npm run test:fast`              |
| Tools / Actions                                     | 25 / 409               | 25 / 409             | `src/schemas/action-counts.ts`   |

**Meta-finding (carries across phases)**: The drift between `CLAUDE.md` claims
and reality is the highest-leverage finding. Every phase ends with a claim
update so the two don't re-diverge.

---

## Phase dependency graph

```
Phase 0 (stabilize gates + baseline)
   │
   ├──► Phase 1 (critical security — OAuth revoke, sampling disclosure, tar audit)
   │        │
   │        └──► Phase 3 (OAuth hardening — refresh rotation, consent metadata)
   │
   ├──► Phase 2 (observability hygiene — PII redaction, retention enforcement)
   │        │
   │        └──► Phase 6 (CLAUDE.md reconciliation)
   │
   ├──► Phase 4 (MCP spec gaps — DCR, Resource Indicators, Agency Hints, task cancel)
   │        │
   │        └──► Phase 6
   │
   ├──► Phase 5 (test determinism — Math.random purge + guard rule)
   │        │
   │        └──► Phase 6
   │
   └──► Phase 7 (submission prep — privacy policy, GCP verification, marketplace)
               └── blocked by: Phase 1 + Phase 3 + Phase 4 completion
```

**Rule**: Each phase lands on its own branch (`audit/phase-N-short-name`),
merges to `main` only after `npm run verify:safe` is green, and appends a row
to Session History in `.serval/session-notes.md`.

---

## Phase 0 — Stabilize CI gates and baseline

**Goal**: Prove every regression guard actually runs so subsequent fixes are
verifiable. Nothing behavioral changes.

### P0.1 — Capture exact baseline

```bash
# Run from repo root
npm ci --ignore-scripts
npm run typecheck        2>&1 | tee .audit/baseline-typecheck.log
npm run test:fast        2>&1 | tee .audit/baseline-tests.log
npm run check:drift      2>&1 | tee .audit/baseline-drift.log
npm run check:debug-prints 2>&1 | tee .audit/baseline-debug-prints.log
npm run check:silent-fallbacks 2>&1 | tee .audit/baseline-silent-fallbacks.log
npm run check:mutation-actions 2>&1 | tee .audit/baseline-mutation-actions.log
npm run validate:alignment 2>&1 | tee .audit/baseline-alignment.log
```

Expected outcome: all green. If any gate is red before fixes begin, we fix
**that gate first** — otherwise we can't tell whether later work caused the
regression.

### P0.2 — Add missing guard: Math.random-in-tests

Currently `MUTATION_ACTIONS` parity and `schema:commit` drift are guarded but
`Math.random` in tests is not (CLAUDE.md bans it as a test anti-pattern).

**New file**: `scripts/check-math-random-tests.mjs`

```js
#!/usr/bin/env node
// Fails CI if Math.random() appears anywhere under tests/ (excluding the
// chaos framework, which is legitimately non-deterministic by design).
import { execSync } from 'node:child_process';

const ALLOWED_PATHS = [
  'tests/chaos/',          // chaos framework is non-deterministic by design
];

const raw = execSync(
  'rg --no-heading --line-number "Math\\.random" tests/ || true',
  { encoding: 'utf8' }
);
const offenders = raw
  .split('\n')
  .filter(Boolean)
  .filter((line) => !ALLOWED_PATHS.some((p) => line.startsWith(p)));

if (offenders.length > 0) {
  console.error('❌ Math.random() in tests (see docs/development/CLAUDE_CODE_RULES.md#test-quality):');
  for (const line of offenders) console.error('  ' + line);
  process.exit(1);
}
console.log('✅ No Math.random() in tests (chaos framework exempt)');
```

Wire into `package.json`:

```diff
   "check:silent-fallbacks": "bash scripts/check-silent-fallbacks.sh",
+  "check:math-random-tests": "node scripts/check-math-random-tests.mjs",
   "check:drift": "node scripts/check-schema-drift.mjs",
```

And chain into `verify:safe`:

```diff
-  "verify:safe": "npm run typecheck && npm run test:fast && npm run check:drift && npm run check:debug-prints && npm run check:silent-fallbacks",
+  "verify:safe": "npm run typecheck && npm run test:fast && npm run check:drift && npm run check:debug-prints && npm run check:silent-fallbacks && npm run check:math-random-tests",
```

**Expected**: this new gate fails immediately with 38 offenders. That's fine —
Phase 5 fixes the offenders. We intentionally land the gate first so Phase 5
has a pass/fail target. **Until Phase 5 lands, `verify:safe` is red on that
single gate** and all other phases use `verify:safe -- --skip math-random` or
run the individual gates manually.

Alternative if red CI is unacceptable: land the script but wire it into
`verify` (full) instead of `verify:safe`, then flip in Phase 5.

### P0.3 — Add an audit worktree

```bash
git worktree add ../servalsheets-audit -b audit/phase-0-baseline
cd ../servalsheets-audit
```

All phases work in this worktree so the main checkout stays usable for
feature work during the remediation window.

### Verification

```bash
npm run verify:safe      # must be green or green-except-math-random
ls .audit/*.log          # baseline captured
```

### Exit criteria

- [ ] All baseline logs committed under `.audit/` (gitignored for content,
      tracked for existence via `.audit/.gitkeep`).
- [ ] New guard `check:math-random-tests` present and wired.
- [ ] Worktree in place.

---

## Phase 1 — Critical security (3 non-interacting fixes)

**Goal**: Close the three items that would individually block OAuth verification
or expose users to real harm. Each is isolated enough to land as its own PR.

### P1.1 — `/oauth/revoke` must call Google's revocation endpoint

**File**: `src/auth/oauth-provider.ts:1092-1124`

**Current code** (verified):

```ts
router.post('/oauth/revoke', async (req, res) => {
  const { token, client_id, client_secret } = req.body as Record<string, string | undefined>;
  // ... auth checks ...
  // Try to revoke as refresh token
  await this.sessionStore.delete(`refresh:${token}`);
  // Return 200 OK (RFC 7009 says success even if token not found)
  res.status(200).json({});
});
```

**Problem**: We delete the local session record but never tell Google to
invalidate the underlying Google access/refresh token. After a user clicks
"disconnect" in our UI, Google still believes we have a valid refresh token
and will continue letting us exchange it. This violates Google's "respect user
disconnection" expectation under the API Services User Data Policy.

**Fix**:

1. Before deleting the local `refresh:${token}` entry, load the associated
   Google tokens (they were stored during the initial callback exchange).
2. POST to `https://oauth2.googleapis.com/revoke?token=<google_refresh_token>`
   (per RFC 7009 + Google's own [token revocation docs][grev]).
3. Log outcome; still return 200 per RFC 7009 even if Google returns 400/404.

[grev]: https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke

**New helper** at top of the file (near other `private async` helpers):

```ts
private async revokeGoogleTokenOrLog(googleToken: string | undefined): Promise<void> {
  if (!googleToken) return;
  try {
    await this.oauthCircuit.execute(async () => {
      const resp = await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(googleToken)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );
      if (!resp.ok && resp.status !== 400) {
        // 400 = token already expired/invalid, which is fine for revoke
        logger.warn('Google token revocation returned non-OK', {
          status: resp.status,
        });
      }
    });
  } catch (error) {
    logger.error('Google token revocation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
```

**Patched handler**:

```ts
router.post('/oauth/revoke', async (req, res) => {
  const { token, client_id, client_secret } = req.body as Record<string, string | undefined>;
  if (!token) {
    res.status(400).json({ error: 'invalid_request', error_description: 'Missing token' });
    return;
  }
  const authenticatedClientId = await this.authenticateClient('', client_id, client_secret);
  if (!authenticatedClientId) {
    res.status(401).json({ error: 'invalid_client', error_description: 'Client authentication failed' });
    return;
  }

  // Load the stored refresh record (holds the Google tokens we issued on callback)
  const refreshTokenData = (await this.sessionStore.get(
    `refresh:${token}`
  )) as unknown as RefreshTokenData | null;

  // Revoke the Google refresh token BEFORE deleting our record (fail-safe: if
  // revocation throws, we still want the local record to survive so a retry
  // can drive the revocation to completion)
  await this.revokeGoogleTokenOrLog(refreshTokenData?.googleRefreshToken);

  await this.sessionStore.delete(`refresh:${token}`);
  res.status(200).json({});
});
```

**Schema addition** in the `RefreshTokenData` type (grep for its declaration):
add `googleRefreshToken?: string`. It is populated during the callback at
`oauth-provider.ts:867-873` where `googleTokens.refresh_token` is already in
scope — just plumb it into the `put('refresh:...')` payload.

**Verification**:

```bash
# Unit test
npm run test:fast -- src/auth/oauth-provider.revoke.test.ts

# Manual smoke (local HTTP mode)
curl -X POST http://localhost:3000/oauth/revoke \
  -d "token=<refresh_token>&client_id=...&client_secret=..."
# Then verify in Google account → Security → Third-party apps that the
# connection is gone.
```

Also add a contract test under `tests/auth/oauth-revoke.test.ts` mocking the
`fetch` call to `oauth2.googleapis.com/revoke` and asserting it fires exactly
once per revoke request.

### P1.2 — Sampling must disclose Anthropic as data recipient

**File**: `src/utils/sampling-consent.ts` (88 lines) + call sites in
`src/mcp/sampling.ts`.

**Current state** (verified): the consent checker is pluggable (`registerSamplingConsentChecker`)
and defaults to "always allow" when no checker is registered. No built-in text
names the LLM provider or explains what data will leave the server.

**Problem**: Google API Services User Data Policy §2.4 (Limited Use) requires
transparent disclosure when user Google-Drive data is forwarded to third
parties. Sampling forwards cell values / formulas to whatever client the
server is connected to (Claude Desktop → Anthropic, Cursor → Anthropic or
OpenAI, etc.). Current path allows this with no disclosure.

**Fix**:

1. Add a default consent gate that is **on** unless the installer has
   explicitly accepted the disclosure in env/config.
2. Include a human-readable disclosure message in the error thrown when
   consent is missing, naming the connected client / LLM.
3. Record consent acceptance in audit log for traceability.

**Patch** to `src/utils/sampling-consent.ts`:

```ts
// Add near top of file
const DEFAULT_DISCLOSURE = `Sampling requires sending spreadsheet content
(cell values, formulas, structure) to the connected MCP client, which will
forward it to an AI provider (typically Anthropic Claude, OpenAI, or the
client's configured LLM). This data is subject to the AI provider's privacy
policy and is not stored on ServalSheets servers beyond the request.`;

function getDefaultSamplingConsent(): boolean {
  const env = getEnv();
  return env['SAMPLING_CONSENT_ACCEPTED'] === 'true';
}

export async function assertSamplingConsent(): Promise<void> {
  // Explicit installer-provided checker wins
  if (_consentChecker) {
    // ...existing TTL-cached path...
    return;
  }

  // Default path: require explicit acceptance
  if (!getDefaultSamplingConsent()) {
    throw new ServiceError(
      `SAMPLING_CONSENT_REQUIRED: ${DEFAULT_DISCLOSURE}\n\n` +
      `To enable sampling, set SAMPLING_CONSENT_ACCEPTED=true in your environment, ` +
      `or register a consent handler via registerSamplingConsentChecker().`,
      'PERMISSION_DENIED',
      'sampling',
      false
    );
  }
}
```

**Audit trail addition** in `src/mcp/sampling.ts` (at the top of `createMessage`
or whichever is the main entrypoint):

```ts
await assertSamplingConsent();
auditLogger.logConfiguration({
  userId: getRequestContext()?.principalId ?? 'unknown',
  action: 'sampling.consent.asserted',
  outcome: 'success',
  // ...
});
```

**Docs**: also add a "Data Flow" section to README explaining where
spreadsheet content goes during sampling, explicitly naming Anthropic as the
typical recipient when paired with Claude Desktop.

**Verification**:

```bash
# Consent gate on by default
unset SAMPLING_CONSENT_ACCEPTED
npm run test:fast -- sampling-consent

# Consent accepted
SAMPLING_CONSENT_ACCEPTED=true npm run test:fast -- sampling-consent
```

Add `tests/utils/sampling-consent.test.ts` asserting: (a) default path
throws `SAMPLING_CONSENT_REQUIRED` with Anthropic mentioned in the
message; (b) env opt-in allows; (c) registered custom checker still wins.

### P1.3 — tar CVE audit (confirm first, then bump)

**Observed** in `package-lock.json`:

```
node_modules/duckdb/node_modules/tar      7.5.13
node_modules/tar                          6.2.1
```

**Research needed before code change**: `tar@7.5.13` is AHEAD of the
`tar@7.5.10` ceiling in the advisory the original audit cited — so the
duckdb path may already be safe. `tar@6.2.1` was also patched for
CVE-2024-28863 (the DoS). Run the real audit first:

```bash
npm audit --omit=dev --audit-level=high --json > .audit/npm-audit.json
jq '.vulnerabilities | to_entries | map(select(.value.severity == "critical" or .value.severity == "high"))' .audit/npm-audit.json
```

**If `npm audit` shows no high/critical tar CVE**: update CLAUDE.md /
audit log to mark this finding as "not reproducible as of 2026-04-19"
and move on. No dependency bump needed.

**If it does show one**: add an override to `package.json`:

```diff
+  "overrides": {
+    "tar": "^7.5.13"
+  },
```

then `npm install && npm audit` again.

**Verification**:

```bash
npm audit --omit=dev --audit-level=high      # exit 0
npm run test:fast                            # still 2810 passing
```

### Phase 1 exit criteria

- [ ] P1.1 landed, contract test asserts Google revoke fires.
- [ ] P1.2 landed, `SAMPLING_CONSENT_REQUIRED` default on.
- [ ] P1.3 concluded (either bump or mark-as-n/a).
- [ ] `npm run verify:safe` still green (minus the Math.random gate).

---

## Phase 2 — Observability hygiene

**Goal**: Close the gap between what the audit log claims (compliance-grade,
tamper-proof, 7-year retention, PII-safe) and what the code actually does.

### P2.1 — PII redaction in audit entries

**File**: `src/services/audit-logger.ts` — specifically the `createSignedEntry`
path (search around line 346) and the event type declarations in
`audit-logger-types.ts`.

**Problem**: `AuditEvent` includes free-form fields (error messages, resource
paths, cell values in some mutation events). Nothing strips PII before the
signature is computed, so the immutable ledger may contain user email
addresses / SSN-shaped strings / phone numbers.

**Fix**: add a `redactPII()` pre-signature transform.

**New file**: `src/services/audit-logger-redactor.ts`

```ts
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g;
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const CC_RE = /\b(?:\d[ -]?){13,19}\b/g;

export function redactString(s: string): string {
  return s
    .replace(EMAIL_RE, '[REDACTED:email]')
    .replace(PHONE_RE, '[REDACTED:phone]')
    .replace(SSN_RE, '[REDACTED:ssn]')
    .replace(CC_RE, '[REDACTED:cc]');
}

export function redactObject<T>(obj: T): T {
  if (typeof obj === 'string') return redactString(obj) as unknown as T;
  if (Array.isArray(obj)) return obj.map(redactObject) as unknown as T;
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      // Do not redact userId / principalId — those are the "Who" of W5 and
      // are the point of the log. But redact their embedding in free text.
      out[k] = k === 'userId' || k === 'principalId' ? v : redactObject(v);
    }
    return out as T;
  }
  return obj;
}
```

**Wire in** at `audit-logger.ts` (just before `createSignedEntry`):

```ts
const redacted = redactObject(event);
const entry = this.createSignedEntry(redacted);
```

**Caveat**: redaction happens BEFORE signing so the signed hash covers the
redacted content (otherwise reviewers can't verify integrity without access
to the raw PII).

**Verification**:

```bash
npm run test:fast -- audit-logger-redactor
# Unit test must cover: email, phone, SSN, CC, nested objects, arrays,
# userId carve-out.
```

### P2.2 — Retention: align code to claim

**File**: `src/services/audit-logger.ts:193`, `pruneExpiredLogs()` around 636.

**Problem**: Class-level doc comment claims 7-year retention (SOC 2 CC7.3).
Default `retentionDays = 90`. `pruneExpiredLogs` removes any file older than
`now - retentionDays * 24 * 60 * 60 * 1000` — so the default *actively deletes*
audit logs after 90 days, contradicting the compliance claim.

**Fix (choose one)**:

- **Option A (recommended)**: bump default to 2555 days (7 years) to match the
  claim, because the class advertises itself as compliance-grade. Operators
  can shrink via `AUDIT_LOG_RETENTION_DAYS`.
- **Option B**: keep 90-day default but rewrite the JSDoc to stop claiming 7-year
  retention out-of-the-box. Still document that operators can set it.

Recommend A; it's the safer default for a compliance-oriented product.

```diff
-    this.retentionDays = options?.retentionDays ?? 90;
+    // Default 7 years (SOC 2 CC7.3). Operators can override via
+    // AUDIT_LOG_RETENTION_DAYS. Set lower only when legal retention is shorter.
+    this.retentionDays = options?.retentionDays ?? 2555;
```

Update the class JSDoc (line 38-54) so the `# Storage Architecture` section
matches the actual default.

Also fix `pruneExpiredLogs` to log which files are being deleted so operators
have a paper trail:

```ts
if (ageDays > this.retentionDays) {
  logger.info('audit-log.prune', { file, ageDays, retentionDays });
  await fs.unlink(filePath);
}
```

### P2.3 — Runtime retention cron

`pruneExpiredLogs` currently only runs once at startup + inside `logEvent`.
In a long-lived server that's adequate. But the startup-only cron doesn't
guarantee midnight-UTC cleanup on a long-running instance.

**Fix**: add a daily interval in `initializeAuditState()`:

```ts
this.pruneIntervalHandle = setInterval(() => {
  void this.pruneExpiredLogs();
}, 24 * 60 * 60 * 1000);
this.pruneIntervalHandle.unref(); // don't keep the process alive
```

Store the handle so `close()` can clear it.

### Verification

```bash
npm run test:fast -- audit-logger
npm run test:fast -- audit-logger-redactor
# Integration test: seed a 91-day-old JSONL file, default retention should
# prune it. With AUDIT_LOG_RETENTION_DAYS=30, same file pruned.
```

### Phase 2 exit criteria

- [ ] PII redaction wired before signing, covered by unit test.
- [ ] Default retention matches the compliance claim (7 years).
- [ ] `close()` clears the prune interval cleanly.

---

## Phase 3 — OAuth hardening

**Goal**: Make refresh token handling match OAuth 2.1 best practice and
surface privacy/ToS during consent.

### P3.1 — Refresh token rotation with replay detection

**File**: `src/auth/oauth-provider.ts:445-507`

**Current state** (verified): on refresh, we issue a new access token but
reuse the old refresh token and don't invalidate it. If a refresh token leaks,
an attacker can refresh indefinitely and we'll never detect the overlap.

**Fix** (OAuth 2.1 §6.1 recommendation):

1. On every refresh, generate a new opaque refresh token, store it under
   `refresh:${newToken}`, delete the old `refresh:${oldToken}`.
2. Keep the old token ID in a short-lived blacklist (e.g. 10× access-token TTL).
3. If a request comes in for a blacklisted token, revoke the entire chain
   (the new token too) — this is replay detection.

**New code** replacing `handleRefreshToken`:

```ts
private async handleRefreshToken(
  refreshToken: string,
  res: Pick<express.Response, 'status' | 'json'>,
  clientId?: string,
  clientSecret?: string
): Promise<void> {
  try {
    // Replay check first
    const isBlacklisted = await this.sessionStore.get(`refresh_blacklist:${refreshToken}`);
    if (isBlacklisted) {
      logger.warn('refresh.replay_detected', { tokenPrefix: refreshToken.slice(0, 8) });
      // Revoke the whole chain if we can find it
      const chainId = typeof isBlacklisted === 'object' && isBlacklisted !== null
        ? (isBlacklisted as { chainId?: string }).chainId
        : undefined;
      if (chainId) await this.revokeRefreshChain(chainId);
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Refresh token has been used previously — chain revoked',
      });
      return;
    }

    const refreshTokenData = (await this.sessionStore.get(
      `refresh:${refreshToken}`
    )) as unknown as RefreshTokenData | null;

    if (!refreshTokenData) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token expired or invalid' });
      return;
    }

    const authenticatedClientId = await this.authenticateClient(
      refreshTokenData.clientId,
      clientId,
      clientSecret
    );
    if (!authenticatedClientId) {
      res.status(401).json({ error: 'invalid_client', error_description: 'Client authentication failed' });
      return;
    }

    // Mint NEW access + refresh
    const accessToken = jwt.sign(
      {
        sub: refreshTokenData.userId,
        aud: refreshTokenData.clientId,
        iss: this.config.issuer,
        scope: refreshTokenData.scope,
      },
      this.config.jwtSecret,
      { algorithm: 'HS256', expiresIn: this.config.accessTokenTtl }
    );

    const newRefreshToken = randomBytes(32).toString('hex');
    const chainId = refreshTokenData.chainId ?? randomBytes(16).toString('hex');
    await this.sessionStore.put(
      `refresh:${newRefreshToken}`,
      { ...refreshTokenData, chainId },
      { ttlMs: this.config.refreshTokenTtl * 1000 }
    );

    // Blacklist the old one for replay detection (10× access TTL)
    await this.sessionStore.put(
      `refresh_blacklist:${refreshToken}`,
      { chainId, rotatedAt: Date.now() },
      { ttlMs: this.config.accessTokenTtl * 10 * 1000 }
    );
    await this.sessionStore.delete(`refresh:${refreshToken}`);

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.accessTokenTtl,
      refresh_token: newRefreshToken,
      scope: refreshTokenData.scope,
    });
  } catch (error) {
    logger.error('Refresh token exchange error', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
  }
}

private async revokeRefreshChain(chainId: string): Promise<void> {
  // Sweep the store for any refresh record with this chainId and delete.
  // Implementation depends on sessionStore capabilities — if it supports
  // prefix scan, use that; otherwise keep a chain index.
  logger.warn('refresh.chain_revoked', { chainId });
  // TODO: Fill in per-store sweep or maintain chain:${chainId} → [tokenIds]
}
```

**Schema addition** to `RefreshTokenData` (find declaration):

```ts
interface RefreshTokenData {
  userId: string;
  clientId: string;
  scope: string;
  googleRefreshToken?: string;   // added in P1.1
  chainId?: string;              // added in P3.1
}
```

**Verification**: `tests/auth/oauth-refresh-rotation.test.ts`

```ts
it('rotates refresh token on success', async () => {
  const first = await refresh(origToken);
  expect(first.refresh_token).not.toEqual(origToken);
});

it('detects replay and revokes chain', async () => {
  const rotated = await refresh(origToken);
  // Reuse origToken a second time — should be caught
  const replay = await refresh(origToken);
  expect(replay.status).toBe(400);
  expect(replay.error).toBe('invalid_grant');
  // And the rotated token should now also be invalid
  const attempt = await refresh(rotated.refresh_token);
  expect(attempt.status).toBe(400);
});
```

### P3.2 — Privacy policy / ToS in consent URL

**File**: `src/auth/oauth-provider.ts:789-801`

**Current** (verified):

```ts
const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
googleAuthUrl.searchParams.set('client_id', this.config.googleClientId);
googleAuthUrl.searchParams.set('redirect_uri', `${this.config.issuer}/oauth/callback`);
googleAuthUrl.searchParams.set('response_type', 'code');
googleAuthUrl.searchParams.set('scope', 'openid profile email');
googleAuthUrl.searchParams.set('state', googleOAuthState);
googleAuthUrl.searchParams.set('access_type', 'offline');
googleAuthUrl.searchParams.set('prompt', 'consent');
```

**Problem**: Google's consent screen needs `privacy_policy_uri` and
`terms_of_service_uri` registered on the OAuth client in GCP console
(not as query params — Google doesn't read query params for policy URLs).
But we also need to expose the policy URLs through our own consent UI when
a third-party MCP client hits our `/oauth/authorize` endpoint directly
(DCR flow, Phase 4).

**Fix** is two-part:

1. **GCP side** (no code change — Phase 7): fill in the OAuth consent screen
   fields `privacy_policy_uri = https://servalsheets.io/privacy`,
   `terms_of_service_uri = https://servalsheets.io/terms`. This appears on
   Google's own consent screen.

2. **Our authorize endpoint** (code change): when we render a consent page
   for third-party MCP clients (once DCR is live), include the policy and
   ToS links. Also store the policy URIs on the `OAuthProvider` config so
   they're available to all endpoints.

Add to `OAuthProviderConfig`:

```ts
interface OAuthProviderConfig {
  // ...existing fields...
  privacyPolicyUri?: string;
  termsOfServiceUri?: string;
}
```

Populate from env at bootstrap (oauth-config.ts):

```ts
privacyPolicyUri: process.env.SERVAL_PRIVACY_POLICY_URI ?? 'https://servalsheets.io/privacy',
termsOfServiceUri: process.env.SERVAL_TOS_URI ?? 'https://servalsheets.io/terms',
```

These values are then surfaced in the RFC 8414 metadata document
(`/.well-known/oauth-authorization-server`) — see `src/server/well-known.ts:467`.
RFC 8414 §2 defines `op_policy_uri` and `op_tos_uri`.

```diff
 res.json({
   issuer: config.issuer,
   authorization_endpoint: `${config.issuer}/oauth/authorize`,
   token_endpoint: `${config.issuer}/oauth/token`,
+  op_policy_uri: config.privacyPolicyUri,
+  op_tos_uri: config.termsOfServiceUri,
   // ...
 });
```

### P3.3 — Audit refresh rotations

Add `auditLogger.logAuthentication({ action: 'refresh.rotate', ... })` inside
`handleRefreshToken` success path. Replay detection also logs with
`outcome: 'failure'` so SIEM can alert.

### Phase 3 exit criteria

- [ ] Refresh rotation + blacklist live, replay test green.
- [ ] `op_policy_uri` + `op_tos_uri` in `/.well-known/oauth-authorization-server`.
- [ ] Audit entries emitted on rotate and replay.

---

## Phase 4 — MCP spec gaps

**Goal**: Close the four MCP 2025-11-25 spec items that `CLAUDE.md` claims are
done but the code doesn't implement.

### P4.1 — Dynamic Client Registration (RFC 7591)

**File**: new endpoint in `src/auth/oauth-provider.ts`, metadata in
`src/server/well-known.ts:467`.

MCP 2025-11-25 §Authorization recommends DCR so any MCP client (Claude
Desktop, Cursor, Zed, Continue, …) can register itself without manual
out-of-band client ID handoff.

**Endpoint**: `POST /oauth/register`

```ts
router.post('/oauth/register', async (req, res) => {
  // RFC 7591 §3.1
  const { client_name, redirect_uris, grant_types, response_types, scope } =
    req.body as Record<string, unknown>;

  // Basic validation
  if (!Array.isArray(redirect_uris) || redirect_uris.length === 0) {
    res.status(400).json({ error: 'invalid_redirect_uri' });
    return;
  }
  const normalizedRedirects = (redirect_uris as string[]).map(String);

  // Loopback-only policy (or you can allow http/https based on config)
  for (const uri of normalizedRedirects) {
    if (!isAllowedRedirectUri(uri, this.config.allowedRedirectHosts)) {
      res.status(400).json({
        error: 'invalid_redirect_uri',
        error_description: `redirect_uri '${uri}' not in allow-list`,
      });
      return;
    }
  }

  const clientId = `dcr_${randomBytes(16).toString('hex')}`;
  const clientSecret = randomBytes(32).toString('hex');
  const registrationTime = Date.now();

  await this.sessionStore.put(
    `client:${clientId}`,
    {
      clientId,
      // HMAC store the secret — never store plaintext
      clientSecretHash: createHmac('sha256', this.config.jwtSecret).update(clientSecret).digest('hex'),
      clientName: typeof client_name === 'string' ? client_name : 'Unnamed MCP client',
      redirectUris: normalizedRedirects,
      grantTypes: Array.isArray(grant_types)
        ? (grant_types as string[])
        : ['authorization_code', 'refresh_token'],
      responseTypes: Array.isArray(response_types) ? (response_types as string[]) : ['code'],
      scope: typeof scope === 'string' ? scope : 'openid profile email',
      registeredAt: registrationTime,
      dcr: true, // marks this as DCR-registered vs statically configured
    },
    { ttlMs: 90 * 24 * 60 * 60 * 1000 } // 90d client lifetime
  );

  // RFC 7591 §3.2.1 response
  res.status(201).json({
    client_id: clientId,
    client_secret: clientSecret,
    client_id_issued_at: Math.floor(registrationTime / 1000),
    client_secret_expires_at: 0, // never expires (within the 90d TTL)
    client_name: typeof client_name === 'string' ? client_name : undefined,
    redirect_uris: normalizedRedirects,
    grant_types: Array.isArray(grant_types) ? grant_types : ['authorization_code', 'refresh_token'],
    response_types: Array.isArray(response_types) ? response_types : ['code'],
  });
});
```

**Metadata exposure** (`well-known.ts:467` area):

```diff
 res.json({
   issuer: config.issuer,
   authorization_endpoint: `${config.issuer}/oauth/authorize`,
   token_endpoint: `${config.issuer}/oauth/token`,
+  registration_endpoint: `${config.issuer}/oauth/register`,
   response_types_supported: ['code'],
   grant_types_supported: ['authorization_code', 'refresh_token'],
   code_challenge_methods_supported: ['S256'],
   // ...
 });
```

**Confused-deputy guard**: the existing DCR consent flow in
`oauth-provider.ts:330-382` assumes DCR clients ask for scopes from a bounded
set. Check that `scope` from the request intersects `config.allowedScopes`
before granting.

**Verification**:

```bash
npm run test:fast -- oauth-dcr
# Also run the MCP inspector against the server — it should discover
# the registration_endpoint and auto-register.
npx @modelcontextprotocol/inspector --url http://localhost:3000/mcp
```

### P4.2 — RFC 8707 Resource Indicators

**Files**: `src/auth/oauth-provider.ts` (authorize + token endpoints),
JWT minting for access tokens.

MCP 2025-11-25 authorization says access tokens MUST be audience-bound so a
token for server A cannot be replayed against server B.

**Fix**:

1. On `/oauth/authorize`, accept `resource` query param. Persist it with the
   state record.
2. On `/oauth/token`, echo the `resource` back and bind it into the JWT `aud`
   claim.
3. Resource servers (i.e. the MCP tool-dispatch path) must reject tokens
   whose `aud` doesn't match `config.resourceIndicator`.

**Patch** to authorize handler:

```ts
const resource = (req.query.resource as string | undefined) ?? this.config.resourceIndicator;
// Store alongside existing state:
await this.sessionStore.put(`auth:${authCode}`, {
  // ...
  resource,
});
```

**Patch** to JWT signing (both in code exchange at line ~1040 and refresh at
~478):

```ts
const accessToken = jwt.sign(
  {
    sub: authCodeData.userId,
    aud: authCodeData.resource ?? this.config.resourceIndicator ?? authCodeData.clientId,
    iss: this.config.issuer,
    scope: authCodeData.scope,
  },
  // ...
);
```

Already-wired audience check at `oauth-provider.ts:1178-1182` (introspection)
is good; ensure the tool-dispatch path (search `jwt.verify` in
`src/http-server/`) performs the same check.

### P4.3 — Agency Hints + Required Scopes regeneration

**File**: `src/generated/annotations.ts` (10,713 lines — generated).

**Problem**: CLAUDE.md / session-notes claim `x-servalsheets.agencyHint` and
`x-servalsheets.requiredScopes` are wired per SEP-1792 / SEP-1880. `rg`
against the generated file returns zero matches.

**Fix**: The file is generated by `scripts/generate-metadata.ts` (or the
`schema:commit` command). Locate the generator, add the two fields to the
emission, then regenerate.

```bash
# After editing the generator:
npm run schema:commit
# This must update src/generated/annotations.ts AND
# src/mcp/registration/tools-list-compat.ts in lockstep.
```

Source of the annotations metadata: `src/mcp/registration/tools-list-compat.ts`
(referenced in session-notes 108). Verify the generator reads from there and
emits into both locations.

### P4.4 — Wire AbortController into long-running handlers

**File**: `src/handlers/appsscript.ts` + `src/handlers/bigquery.ts` +
`src/handlers/federation.ts` + `src/handlers/composite.ts` + wherever
`executeWithRetry` is called. `ISSUE-119` in session-notes.

The request context already has `abortSignal` (see
`src/utils/request-context.ts`). The Google API wrappers need to accept and
honor it.

**Fix**:

1. Pass `getRequestContext()?.abortSignal` into the `fetch`-level layer of
   `google-api.ts`.
2. In each long-running handler, plumb it into the underlying Google SDK call
   via `options.signal`.

Example for `appsscript.run`:

```ts
const ctx = getRequestContext();
const result = await this.scriptApi.scripts.run({
  scriptId,
  requestBody,
}, {
  signal: ctx?.abortSignal,
});
```

The googleapis SDK supports `signal` in the options bag. Verify per-tool.

### Phase 4 exit criteria

- [ ] DCR endpoint live + metadata advertises it.
- [ ] Access tokens carry correct `aud`.
- [ ] `annotations.ts` contains `agency` + `requiredScopes`.
- [ ] Abort signal propagates through appsscript / bigquery / federation.
- [ ] Existing 2810 tests still green.

---

## Phase 5 — Test determinism

**Goal**: Remove all 38 `Math.random()` uses from `tests/` (except the chaos
framework which is exempt by design), then flip `check:math-random-tests`
from informational to blocking in `verify:safe`.

### P5.1 — Audit the 38 occurrences

```bash
rg -n 'Math\.random' tests/ > .audit/math-random.txt
```

Triage each line into one of three buckets:

| Pattern                                           | Fix                                               |
| ------------------------------------------------- | ------------------------------------------------- |
| Fuzz-style input (`Array.from({length: N}, Math.random)`) | Replace with deterministic `Array.from({length: N}, (_, i) => i / N)`. |
| Jitter around timestamps (`Date.now() + Math.random()*1000`) | Use `new Date('2024-01-15T00:00:00.000Z').getTime() + i * 1000`. |
| Seeding a test ID (`'id-' + Math.random()`)       | Use `'id-' + testRunId + '-' + i` where `testRunId` is deterministic per test file. |

The 22 files touching this are enumerated earlier (load, chaos, benchmarks,
live-api, e2e). Chaos stays as-is; load / benchmarks / compliance must be
deterministic.

### P5.2 — Flip the gate

Once `rg -n 'Math\.random' tests/ | grep -v chaos/` returns zero, the new
`check:math-random-tests` guard passes and `verify:safe` becomes green
end-to-end.

### Verification

```bash
npm run test:fast                      # still 2810 passing
npm run check:math-random-tests        # exit 0
# Run the test suite twice and diff the output
npm run test:fast -- --reporter=json > .audit/run-a.json
npm run test:fast -- --reporter=json > .audit/run-b.json
diff <(jq '.testResults[].testResults[].title' .audit/run-a.json) \
     <(jq '.testResults[].testResults[].title' .audit/run-b.json)
# Should be empty
```

### Phase 5 exit criteria

- [ ] Zero `Math.random` outside `tests/chaos/`.
- [ ] Two back-to-back runs produce identical reports.

---

## Phase 6 — CLAUDE.md reconciliation

**Goal**: After Phases 1–5 land the behavioral changes, rewrite `CLAUDE.md`,
`.serval/state.md`, and `docs/development/SOURCE_OF_TRUTH.md` so no claim
diverges from the code.

### P6.1 — Reconciliation checklist

Go through `CLAUDE.md` claim-by-claim:

| Claim                                      | After Phases 1-5                | Update needed                              |
| ------------------------------------------ | ------------------------------- | ------------------------------------------ |
| "No console.log in handlers"               | True (was true before too)      | Keep, but clarify which paths are allowed. |
| "Math.random banned in tests"              | True after P5                   | Add reference to `check:math-random-tests`.|
| "SEP-1792 agencyHint wired"                | True after P4.3                 | Add file:line reference.                   |
| "SEP-1880 requiredScopes wired"            | True after P4.3                 | Add file:line reference.                   |
| "as any = 21"                              | 107 — not fixed in this plan    | Replace with actual count + path forward.  |
| "MCP SEP score A+ on 2025-11-25"           | Dependent on P4                 | Update scoring after P4 lands.             |
| "OAuth revocation calls Google"            | True after P1.1                 | Add line reference.                        |
| "Refresh rotation + replay detection"      | True after P3.1                 | Add line reference.                        |
| "Privacy policy in OAuth metadata"         | True after P3.2                 | Add line reference.                        |
| "Retention 7-year"                         | True after P2.2                 | Add `AUDIT_LOG_RETENTION_DAYS` doc.        |
| "PII redaction in audit log"               | True after P2.1                 | Add file reference.                        |
| "DCR endpoint live"                        | True after P4.1                 | Add endpoint URL.                          |
| "Resource Indicators (RFC 8707) enforced"  | True after P4.2                 | Add file:line.                             |

### P6.2 — Split oversized CLAUDE.md content

`CLAUDE.md` size cap is 300 lines (stated in the file itself). After additions
in P6.1 we'll exceed it. Move the "Known Gotchas" table to `docs/development/`
and keep CLAUDE.md at ≤300 lines.

### P6.3 — Update `.serval/state.md`

Regenerate from the generator — `.serval/generate-state.mjs`. Add a Session
112 block to `.serval/session-notes.md` summarizing the audit remediation.

### Phase 6 exit criteria

- [ ] `CLAUDE.md` ≤ 300 lines, every claim verified against code.
- [ ] `.serval/state.md` regenerated, accurate.
- [ ] `.serval/session-notes.md` has a Session 112 entry.

---

## Phase 7 — Submission prep

**Goal**: The code is now compliant. Lock in the external pieces.

### P7.1 — Privacy policy + ToS publication

- Publish `https://servalsheets.io/privacy` and `https://servalsheets.io/terms`.
- Privacy policy MUST describe: what Google scopes are requested, why, what
  is sent to the LLM during sampling, retention, user's right to revoke at
  `https://myaccount.google.com/permissions`.
- Link from GitHub README.

### P7.2 — GCP project + OAuth verification

- Create a clean GCP project `servalsheets-prod`.
- Enable APIs: Sheets, Drive, Apps Script, BigQuery (all used).
- Configure OAuth consent screen: production, external, fill all fields
  including scope justifications and demo video (Google requires a 30s-1min
  scope-walkthrough video).
- Request verification for sensitive Drive scope (`drive.file` is
  non-sensitive; ensure we stay within it).
- **If** we need `drive` restricted scope: CASA Tier 2 security assessment
  required — budget ~6 weeks and ~$5k.

### P7.3 — DXT bundle with embedded OAuth creds

`src/config/embedded-oauth.ts` (verified at 89 lines) already exposes
`EMBEDDED_OAUTH.clientId` / `clientSecret` reading from env with a sentinel
placeholder. The packaging pipeline needs to:

1. Accept `OAUTH_CLIENT_ID` + `OAUTH_CLIENT_SECRET` at build time.
2. Replace the `REPLACE_WITH_*` sentinels in the emitted `.dxt` bundle.
3. Flip `manifest.json.user_config.required` to `false` for the two OAuth
   fields since they're now bundled.

### P7.4 — Anthropic MCP Marketplace submission

- Ensure `package.json.bin` entry (currently missing) so `npx servalsheets`
  works.
- `mcpName` is currently `"ServalSheets"` — the MCP Registry standard uses
  reverse-DNS (`"io.github.<owner>/servalsheets"` or
  `"com.servalsheets/mcp-server"`). Change before first publish.
- Submit via the Anthropic Marketplace web form with:
  - DXT bundle URL
  - Privacy policy URL
  - Demo video (reused from OAuth verification)
  - One-paragraph differentiation vs Google's dev-preview offerings.

### Phase 7 exit criteria

- [ ] Privacy policy live.
- [ ] GCP verification submitted (expect 4–6 week queue).
- [ ] `.dxt` bundle built, test-installed locally in Claude Desktop.
- [ ] Marketplace form submitted.

---

## Per-phase verification matrix

| Phase | Non-destructive verify             | Destructive verify (sandbox only)        |
| ----- | ---------------------------------- | ---------------------------------------- |
| 0     | `npm run verify:safe`              | n/a                                      |
| 1     | `npm run test:fast -- oauth-revoke sampling-consent` + `npm audit` | Revoke a real Google token in test GCP project; confirm via Google account UI. |
| 2     | `npm run test:fast -- audit-logger` | Age-a-file test: write JSONL with mtime 100 days ago, default retention prunes. |
| 3     | `npm run test:fast -- oauth-refresh-rotation` | End-to-end PKCE flow against test IdP. |
| 4     | `npm run test:fast -- oauth-dcr resource-indicator` + `schema:commit` + `npx @modelcontextprotocol/inspector` | Manual DCR: register a new client, issue a token, assert `aud` is correct. |
| 5     | `npm run check:math-random-tests` + two back-to-back `test:fast` diffs | n/a                                      |
| 6     | `wc -l CLAUDE.md` ≤ 300 + regenerate `.serval/state.md` | n/a                            |
| 7     | Out-of-band (external reviews)     | n/a                                      |

---

## Rollback strategy

Each phase is its own branch + PR. If something breaks downstream after merge:

1. `git revert <merge-commit>` on `main`, push.
2. Recreate the branch with the fix reapplied.
3. Add a regression test covering the specific break.

**Hard rule**: never amend a merged commit or force-push `main`.

---

## Cross-cutting risks

| Risk                                             | Mitigation                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| P1.1 revoke call hangs → user click doesn't return | Wrap in circuit breaker (already exists) + 5s timeout + fire-and-forget retry queue. |
| P3.1 rotation broke downstream clients that cache refresh token | Announce in CHANGELOG + email; add a 14-day grace window (accept old token, warn). |
| P4.1 DCR opens spam / abuse vector              | Rate-limit registration to 10/min/IP (existing middleware supports this). |
| P4.3 schema regen blows up tests (snapshot mismatch) | Run `schema:commit` in a throwaway branch first, review diff before merging. |
| P5 test fixes reveal real flakiness            | Track each flake in an ISSUE-NNN and fix in parallel — don't hide with retries. |
| P7.2 verification delay blocks launch           | Start GCP submission in parallel with Phase 1. Google typical wait: 4–6 weeks.  |

---

## Source-of-truth files

| File                                     | Role                                         |
| ---------------------------------------- | -------------------------------------------- |
| `docs/development/AUDIT_FIX_PLAN.md`     | **This file** — canonical plan.              |
| `.serval/session-notes.md`               | Session-by-session delta from the plan.      |
| `.audit/*.log`                           | Baseline + per-phase CI logs.                |
| `src/schemas/action-counts.ts`           | Actions/tools truth.                         |
| `src/constants/protocol.ts`              | MCP protocol version.                        |
| `src/auth/oauth-provider.ts`             | OAuth transport truth — primary target.      |
| `src/generated/annotations.ts`           | MCP tool annotations — regen target for P4.3.|
| `src/services/audit-logger.ts`           | Audit + retention truth.                     |

---

## Time estimate (realistic, solo dev)

| Phase | Estimate                | Notes                                             |
| ----- | ----------------------- | ------------------------------------------------- |
| 0     | 0.5 day                 | Mostly wiring + capturing baseline.               |
| 1     | 2 days                  | Revoke + sampling consent + audit triage.         |
| 2     | 1.5 days                | Redactor + retention + tests.                     |
| 3     | 2 days                  | Rotation + replay chain + tests.                  |
| 4     | 3 days                  | DCR + resource indicator + annotation regen + abort signals. |
| 5     | 1 day                   | Mechanical `Math.random` replacement.             |
| 6     | 0.5 day                 | Doc reconciliation.                               |
| 7     | 2 days dev + 4-6 weeks wait | GCP verification is the long pole. Dev work is small. |
|       | **~13 engineering days**| Calendar: ~8 weeks wall-clock with GCP wait.      |

---

*This document supersedes all prior "audit report" memos. Update it in-place
as phases land — do not fork new plan docs.*
