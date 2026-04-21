# Upgrade Path — Modern MCP and Google Patterns for Real Remaining Issues

**Date:** 2026-04-21
**Inputs:** `independent-reaudit-2026-04-21.md` (this session) + external research on current MCP specs/SEPs and Google OAuth/Workspace best practices.
**Mode:** research + recommendations; no source changes.
**Caveat on sources:** the MCP draft spec is evolving rapidly. Some third-party blogs assert specific dated specs (e.g. "2026-03-15") that are actually draft documents, not ratified. Where I cite a spec requirement below, I've tried to tie it to the underlying RFC or to a specific MCP SEP PR number rather than to a blog summary. Where something is aspirational I mark it "draft."

## What changed in the MCP ecosystem since this repo picked 2025-11-25

The repo currently targets protocol version `2025-11-25`. Since then:

1. **Governance moved under the Linux Foundation** with a formal SEP (Specification Enhancement Proposal) process. Protocol changes now go through PRs against the `modelcontextprotocol/modelcontextprotocol` repo with numeric SEP identifiers.
2. **The authorization spec hardened substantially.** The draft at `/specification/draft/basic/authorization` now codifies "MCP servers MUST NOT pass through tokens," mandates RFC 9728 discovery, and requires MCP servers to be pure OAuth 2.1 resource servers (not authorization servers). The ServalSheets OAuth provider currently plays both roles; this is an architectural drift from where the spec is heading.
3. **Active SEPs relevant to this repo:**
   - **SEP-1932 (DPoP).** Sender-constrained tokens for MCP via RFC 9449. Bind access tokens to a client key pair so a stolen bearer is useless to an attacker.
   - **SEP-1933 (Workload Identity Federation).** Keyless MCP server identity using external IdPs instead of stored credentials. Meshes well with Google Workload Identity Federation.
   - **SEP-1649 (server cards).** Static `.well-known/mcp/server-card.json` for server discovery.
   - **SEP-1960 (manifest).** `.well-known/mcp` manifest.
   - **SEP-1461 (attested client registration).** Hardens DCR — directly relevant to audit P1.8.
4. **2025-11-25 itself added features** this repo hasn't fully adopted:
   - **Elicitation** with form and URL modes. URL mode is specifically for sensitive interactions that should *not* pass through the MCP client (e.g. OAuth scope upgrades).
   - **Async Tasks** for long-running work.
   - **Structured content** in tool responses.
   - **Titled enums and multi-select enums** in elicitation schemas.

The repo uses Tasks and Elicitation partially (per repo source reviews earlier in this session). The scope-upgrade and DPoP angles are the biggest unused leverage.

## Issue-by-issue upgrade recommendations

Ordered as they appear in the re-audit's "Real remaining issues" list.

### Real P0

#### 1. OAuth-mode token bridge has no contract test asserting bearer is not passed downstream

**Current state:** `packages/mcp-http/src/routes-transport.ts:627–628` resolves `googleToken` via `oauth.getGoogleToken(req)` and falls back to the bearer when `enableOAuth=false`. Works in practice but unenforced.

**Modern pattern — token exchange, not passthrough.**
- MCP draft authorization spec: **"An MCP server MUST NOT pass through the token it received from the MCP client."** No bearer fallback should exist even in "OAuth disabled" mode — that mode should simply reject requests that require Google access.
- **RFC 8693 OAuth 2.0 Token Exchange** is the standard pattern when an MCP server needs to call an upstream API on behalf of the user. Grant type `urn:ietf:params:oauth:grant-type:token-exchange` lets the MCP server present the incoming token to its *own* authorization server and receive a downscoped Google-audience token in return. This preserves the "confused deputy" boundary.
- **Practical upgrade for this repo:**
  1. Delete the bearer-fallback branch entirely. If `enableOAuth=false`, surface a structured `UNAUTHORIZED` error that declines the tool call instead of pretending the MCP token is a Google token.
  2. Add a contract test that starts the `/mcp` transport with `enableOAuth=true`, dispatches a tool call with a mock bearer that is *not* a Google token, and asserts the downstream Google client never sees the bearer.
  3. Long-term: stand up a token-exchange path so the MCP server is a proper OAuth client to Google, holding its own refresh tokens keyed to `userId`, not treating its own JWT as a Google credential.

#### 2. `/oauth/revoke` does not call Google's outbound revoke endpoint

**Current state:** `oauth-provider.ts:1247–1268` deletes the local `google_tokens:${userId}` entry. `google-api.ts:1634–1650` defines `revokeToken()` but isn't wired to the HTTP path.

**Modern pattern — RFC 7009 token revocation, mandatory for compliance.**
- Google's guidance: **"Revoke tokens as soon as they are no longer needed and delete them permanently from your systems."** Local deletion alone leaves Google with a live refresh token that the user has told you to throw away.
- The correct endpoint is `https://accounts.google.com/o/oauth2/revoke?token=<refresh_or_access_token>` per RFC 7009. Revoking a refresh token cascades to all access tokens in the same authorization bundle.
- **Practical upgrade:** in the revoke handler, after reading `google_tokens:${userId}`, POST the refresh token to Google's revoke endpoint (with a short timeout and circuit breaker — Google's revoke can take >1s), then delete the local entry. Swallow Google-side errors after logging, because the user's intent to revoke matters more than a single failed network call.

### Real P1

#### 3. Cold-start chain blocks ~3.8s pre-connect

No MCP SEP addresses startup latency directly — this is a framework hygiene issue. But two modern patterns are relevant:

- **MCP Tasks (2025-11-25).** Server-side work that the client is told is in progress. Post-connect background initialization can surface as a Task that the client can poll or receive progress notifications on. This means your "server is up but still warming" window becomes observable instead of silent.
- **SEP-1649 server cards** will let clients know statically what a server supports *without* initializing. If a client only needs to know "does this server have `sheets_data`?" it can fetch the server card and never drive the full initialize. Not directly a startup fix, but it reduces initialize-latency pressure.

Fix-plan Phase A1 (move `verifyToolIntegrity` post-connect, gate with `runtimeReady`) is the right pattern. Combine it with a `tasks/list` entry so clients can see the integrity-verification Task in flight.

#### 4. `env.ts` eager `process.exit(1)` + `cli.ts` uses `console.error`

No MCP SEP — this is stdio hygiene. The underlying principle is: **anything that writes to stdout on the stdio transport is a JSON-RPC frame**, so `console.error` (which goes to stderr) is actually correct there; the risk is if `console.error` is patched or a logger is misconfigured. Fix-plan C3 (use `process.stderr.write(JSON.stringify({...}))`) is the defensive pattern — structured stderr logs that won't collide with JSON-RPC even if a downstream library redirects streams.

For `env.ts` exit-on-import, the modern pattern is **fail-at-first-use with a typed error** (fix plan A5). MCP clients can render a structured `error.data` payload to the user via elicitation or notifications, which is strictly better than a dead process that says nothing.

#### 5. Preflight does synchronous 5s Google API reachability check

**Modern pattern — don't.** Reachability checks at startup are an anti-pattern in cloud environments because:
- Google's own client libraries handle retries, circuit breaking, and token refresh transparently.
- A reachability probe can succeed and then fail on the first real request anyway.
- MCP clients have `notifications/progress` and `notifications/message` channels — you can report degraded state asynchronously.

Replace the preflight probe with **lazy fail-on-first-use + `notifications/message`**: the first Google call that fails surfaces a structured error (MCP's `isError: true` with a typed payload). Clients can then elicit a re-auth flow via **URL-mode elicitation** (2025-11-25), which is specifically designed for sensitive interactions that must not pass through the MCP client.

#### 6. DCR `OAUTH_DCR_AUTO_CONSENT=true` is a security-relevant deploy toggle with no documented admin gate

**Modern pattern — SEP-1461 (attested client registration) + admin approval.**
- The active MCP SEP PR #1461 proposes **attested client registration**: DCR clients must present proof of their identity (e.g. a software statement signed by a trusted authority) before the server issues credentials. This is exactly the control missing from your current `OAUTH_DCR_AUTO_CONSENT` branch.
- Google's parallel pattern is **OAuth consent screen with verified app status**: apps that request sensitive/restricted scopes get gated behind verified publisher review.
- **Practical upgrade:** until SEP-1461 lands, the minimum safe posture is:
  1. Default `OAUTH_DCR_AUTO_CONSENT=false` (already true).
  2. Add a README section titled "DCR deployment posture" stating this env var is only safe in single-tenant deployments.
  3. Add a `/oauth/register` middleware that records every successful DCR registration to the audit log (the hash-chain audit logger at `src/services/audit-logger.ts` is the right home).
  4. Rotate the client secret monthly via a background task — `client_secret_expires_at: 0` is spec-compliant but contributes to risk when combined with auto-consent.

#### 7. No CI gate enforcing source/dist parity for `packages/mcp-http`

Not MCP-specific. Modern pattern is **verifiable reproducible builds**: a CI job that runs `npm run build` from a clean tree and fails if the output differs from what was tagged. For this specific case, a minimal gate is a pre-merge script that:
- fails if `packages/mcp-http/dist` is imported from `src/**` AND the tsconfig build produces a diff against a committed `dist-checksum.json`.

This is mentioned here only for completeness — no MCP or Google guidance applies.

#### 8. Tool-argument completions generated but not wired to `completion/complete` handler

**Modern pattern — fully supported MCP capability, straightforward wire-up.**
- The MCP spec defines `completion/complete` with `CompleteRequest` / `CompleteResult` messages. Servers declare the capability by populating `completions: {}` and registering a request handler.
- The 2025-11-25 refinements make completions more powerful:
  - `context` parameter: completions can consider previously-resolved values (e.g. suggesting ranges once a `spreadsheetId` is known).
  - Titled enums: return `{label: "Last Month", value: "2026-03"}` pairs rather than raw strings, so IDEs can render friendly names.
- **Practical upgrade:** add `registerCompletionHandler()` alongside the existing `registerPromptHandler` in `src/mcp/features-2025-11-25.ts`. Route each reference to a per-tool completion provider that consults the generated `TOOL_ACTIONS` map. For `spreadsheetId`, consult the session-context's recently-used IDs. For `range`, if `spreadsheetId` is in the context, enumerate the sheet's tabs and return `A1:Z` ranges as suggestions.

### Real P2

#### 9. `SERVER_INSTRUCTIONS` is ~31 KB on every initialize response

**Modern pattern — MCP prompts, not initialize instructions.**
- The `initialize` response's `instructions` field was designed for short, always-relevant server-behavior guidance. 31 KB is abusing it.
- **Prompts** (`prompts/list` + `prompts/get`) are designed exactly for this: versioned, fetchable-on-demand, introspectable text payloads. Clients that don't need the instructions don't pay the cost.
- The 2025-11-25 spec added **structured content** to prompts, so you can split the 31 KB into topic-scoped prompts (e.g. `getting-started`, `tool-taxonomy`, `error-reference`) and let the client load just what it needs.
- **Practical upgrade:** move the current `SERVER_INSTRUCTIONS` text into a set of prompt definitions. Leave a small stub (<1 KB) in the initialize response that points to them.

#### 10. `TOOL_ICONS` eager base64 at module load

Not MCP-specific beyond "don't do expensive work at module load." The 2025-11-25 tools spec does allow `icons` on tool definitions, which means they're sent on `tools/list`, not on `initialize` — so delivering them lazily when `tools/list` is called is the natural pattern.

#### 11. `setInterval` at module load in 6+ files

No spec angle. Standard Node.js pattern is to use a `Disposable` interface (`AsyncDisposable` as of Node 22) with explicit `.start()` / `.dispose()`. Combined with SIGTERM cleanup (issue #13), this solves both concerns in one refactor.

#### 12. Schema concentration in 3 mega-files (6,511 lines)

Not MCP-specific. One angle worth noting: **tools/list with pagination** (which the repo already implements via flat mode) makes it safer to split schemas per-tool because you're not forced to load all 25 tools' schemas to answer a single `tools/list` call. Pair E1–E3 with `lazy` module loading so each tool's schema lives behind a dynamic `import`, only resolved when `tools/list` asks for that page.

#### 13. No SIGTERM dispose path for several singletons

Modern pattern: Node 22's **`AsyncDisposable`** + `using` syntax, or a simple `dispose registry` pattern. MCP's **`close` / `shutdown` lifecycle notifications** are the client-side correlate — when the server receives a `shutdown` request it should close any Tasks, flush audit logs, and dispose handles in a specific order.

#### 14. `readFileSync` in preflight async path

Node best practice, not MCP. Use `fs/promises` + `readFile`.

#### 15. `_requestHandlers` private SDK hook

Already mitigated (startup assertion). Worth tracking: the MCP TypeScript SDK roadmap includes public extension points that should remove the need to touch `_requestHandlers`. When that ships, refactor.

## New capabilities the repo should consider adopting

These aren't remediation items but are modern patterns that would meaningfully improve ServalSheets if the roadmap allows.

### A. DPoP (SEP-1932 + RFC 9449) — sender-constrained tokens

**Why it matters:** today, if a bearer token leaks (from a log, a DCR'd client misbehaving, a reverse proxy misconfig), an attacker can replay it from anywhere. DPoP binds the token to a client-held key pair; every request includes a `DPoP` header signed by that key. A stolen bearer is useless without the key.

**Effort:** medium. The auth middleware needs to:
- Accept a `DPoP` header alongside `Authorization: DPoP <token>` (note: `DPoP` auth scheme, not `Bearer`).
- Validate the DPoP proof: check the `htm`, `htu`, `iat`, and `jti` claims, ensure `jti` isn't replayed, confirm the public key matches the token's `cnf.jkt` claim.
- Advertise DPoP support in `token_endpoint_auth_methods_supported` or a new metadata field.

**Where it slots into the re-audit:** closes the residual risk behind real-P0 #1. Even if some bearer leaked, it couldn't be replayed against Google (because DPoP would apply to the *MCP* token; the Google token stays in the server-side store, never reaches the client).

### B. RFC 9728 `.well-known/oauth-protected-resource` discovery

**Why it matters:** today, an MCP client has to know out-of-band that ServalSheets's authorization server lives at `src/auth/oauth-provider.ts`'s `/oauth/authorize` path. RFC 9728 standardizes a metadata endpoint clients can discover automatically. The MCP draft spec already **mandates** this for MCP servers.

**Practical upgrade:** add an endpoint at `/.well-known/oauth-protected-resource` returning:
```json
{
  "resource": "https://<host>/mcp",
  "authorization_servers": ["https://<host>"],
  "scopes_supported": ["mcp:read", "mcp:write", "sheets:read", "sheets:write"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://<host>/docs"
}
```

Pair with `.well-known/oauth-authorization-server` (RFC 8414) for the AS side. The repo's existing `src/server/well-known.ts` looks like the natural home.

### C. Workload Identity Federation for Google Cloud integrations

**Why it matters:** if you ever run ServalSheets in a container on GKE, Cloud Run, or an external Kubernetes via federation, **service account key files are the wrong pattern**. Google's current guidance: "transitioning to Workload Identity Federation is no longer a best practice — it is a necessity." Zero static credentials, short-lived tokens, auto-rotated.

**Where it slots into the re-audit:** orthogonal to the OAuth user-identity flow, but relevant for any server-to-server calls (audit ingestion to BigQuery, Cloud Storage for backups, etc.). The mental model: OAuth for *user* Google actions, WIF for *server* Google actions.

### D. URL-mode elicitation for OAuth scope upgrades

**Why it matters:** today, if a user tries a tool that needs a restricted scope (say BigQuery) and the server only has `STANDARD_SCOPES`, the tool fails. With **URL-mode elicitation** (2025-11-25), the server can respond "to use this tool I need these additional scopes — click here." The client opens the URL in a browser (not the LLM context), the user approves the incremental scope, the token is upgraded, and the original tool call resumes.

This is exactly the pattern Google's incremental authorization docs describe. The two protocols compose cleanly.

**Where it slots into the re-audit:** replaces the preflight Google check from issue #5 (which fails early because scopes are wrong) with an in-context remediation UX.

### E. Drive scope migration: `drive.readonly` → `drive.file`

**Why it matters:** Google classifies `drive.readonly` and `drive` as **restricted** scopes, which require **annual CASA (Cloud Application Security Assessment)** — an expensive security audit by a Google-approved lab. `drive.file` is **sensitive** but not restricted; no CASA required, much easier verification.

The repo's `STANDARD_SCOPES` already uses `drive.file` (good). `FULL_ACCESS_SCOPES` still includes `drive` and `drive.readonly`. Google's 2026 guidance: "Google recommends migrating to a non-sensitive Drive API scope if your Drive app uses restricted scopes."

**Practical upgrade:**
- Document that `OAUTH_SCOPE_MODE=full` triggers CASA audit requirements.
- Audit which tools actually *need* `drive.readonly` vs. could use `drive.file` + per-file authorization flow.
- Where possible, use Google's Drive Picker + `drive.file` so each file the user accesses is granted on a per-file basis (no broad scope needed).

### F. Google revoke endpoint + Cross-Account Protection (RISC)

**Why it matters (beyond issue #2):** Google publishes **RISC (Risk and Incident Sharing and Coordination)** events — when a user's Google account is compromised, locked, or revokes access, Google emits security events that your app can subscribe to. Combined with proper revoke handling, your app can respond to upstream credential changes without waiting for the next API call to fail.

**Practical upgrade:** subscribe to RISC events for user accounts. On a `account-disabled` or `sessions-revoked` event, delete the local token store entry. This is paired with issue #2's outbound revoke call.

## Consolidated "modernize" backlog

Ordered by value. Each maps the re-audit issue number to the modern pattern.

| Priority | Re-audit item | Modern protocol / pattern | Effort | Payoff |
| --- | --- | --- | --- | --- |
| P0 | #1 token bridge | RFC 8693 Token Exchange + remove bearer fallback | L | Closes "confused deputy" risk |
| P0 | #2 revoke | RFC 7009 call to Google + RISC subscription | S | Google verification compliance |
| P1 | #6 DCR | SEP-1461 attested registration (track), audit-log DCR, rotate secrets | S–M | Safer multi-tenant posture |
| P1 | #8 completions | Wire `completion/complete` + titled enums + context param | S | Immediate client UX win |
| P1 | — | RFC 9728 `.well-known/oauth-protected-resource` | S | Spec-mandated discovery |
| P1 | #5 preflight | URL-mode elicitation for re-auth + lazy fail-on-first-use | M | Removes 5s cold path + better UX |
| P1 | #3 cold-start | Keep fix-plan Phase A; add Tasks-based progress | M | Verified 3.3s win + observability |
| P2 | — | DPoP (SEP-1932) | M–L | Sender-constrained tokens |
| P2 | #9 SERVER_INSTRUCTIONS | Move to prompts (MCP prompts capability) | S | 31 KB off every initialize |
| P2 | — | Workload Identity Federation for GCP side | M | Keyless server-to-server |
| P2 | — | `drive.readonly` → `drive.file` audit | M | Avoid CASA annual audit |

## What I would NOT chase

- **MCP "v2.1"** — one blog search result referenced this. As of current draft state, there is no ratified v2.1. This is either a third-party fork or a forward-looking blog claim. Track actual SEP PRs on `modelcontextprotocol/modelcontextprotocol`, not summary articles.
- **Implicit OAuth flow** — long deprecated. The repo already uses authorization code + PKCE, which is correct.
- **SEP-1960 / SEP-1649 manifest+server card** — adopt when they land in a ratified spec, not from draft. Low urgency.

## Caveat

All of the above presumes you want the MCP server to be a production-quality, multi-client-safe piece of infrastructure. If the actual deployment surface is "one user, one machine, stdio-only," several of these (DPoP, RFC 8693, WIF, RISC) are overkill. The cold-start work and the OAuth hygiene items still matter in that smaller context.

## Sources

- [Model Context Protocol — draft authorization spec](https://modelcontextprotocol.io/specification/draft/basic/authorization) (note: blocked from direct fetch in this session; referenced via published summaries)
- [MCP 2026 Roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/)
- [SEP-1932: DPoP Profile for MCP (PR #1932)](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1932)
- [SEP-1461: Attested Client Registration (Issue #1461)](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1461)
- [RFC 9449 — OAuth 2.0 Demonstrating Proof of Possession (DPoP)](https://datatracker.ietf.org/doc/html/rfc9449)
- [RFC 8693 — OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693)
- [RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [RFC 7009 — OAuth 2.0 Token Revocation](https://datatracker.ietf.org/doc/html/rfc7009)
- [Google — Workload Identity Federation](https://docs.cloud.google.com/iam/docs/workload-identity-federation)
- [Google — Best Practices: OAuth 2.0](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
- [Google — Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
- [Google — Choose Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Google — Incremental authorization](https://developers.googleblog.com/google-oauth-incremental-authorization-improvement/)
- [Cisco — What's New in MCP: Elicitation, Structured Content, OAuth](https://blogs.cisco.com/developer/whats-new-in-mcp-elicitation-structured-content-and-oauth-enhancements)
- [WorkOS — MCP 2025-11-25 update](https://workos.com/blog/mcp-2025-11-25-spec-update)
