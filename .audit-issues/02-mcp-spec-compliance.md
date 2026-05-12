**Title:** [Audit 2026-04-29] MCP 2025-11-25 spec compliance — RETRACTIONS + 1 follow-up

**Labels:** audit, mcp-spec

---

## Summary

Initial audit subagents flagged several MCP-spec deviations. After read-before-claim re-verification, **most were false positives.** Documenting here to prevent re-discovery.

## Verified compliant (retracting earlier audit claims)

### RETRACT: P0-4 — `taskSupport` / `errorRecovery` annotations
**Reading:** `src/generated/annotations.ts:109-231`, `src/mcp/features-2025-11-25.ts:18`

These fields are ServalSheets extensions (CLAUDE.md gotcha #21 acknowledges this). The MCP 2025-11-25 spec rule for unknown fields is *"clients MUST ignore unknown annotation fields"*, NOT *"servers must prefix with `x-`"*. No spec violation. No fix needed.

### RETRACT: P0-5 — RFC 7591 / 7592 DCR endpoints "missing"
**Reading:** `src/auth/oauth-provider.ts`

Endpoints DO exist:
- `POST /oauth/register` — line 1493 (RFC 7591)
- `GET /oauth/register/:clientId` — line 1728 (RFC 7592)
- `PUT /oauth/register/:clientId` — line 1740
- `DELETE /oauth/register/:clientId` — line 1779
- Per-client rate limiting at line 772
- `registration_endpoint` properly advertised at line 782

The audit subagent missed the file entirely.

### RETRACT: P1-10 — Elicitation capability "not declared"
**Reading:** `src/mcp/features-2025-11-25.ts:344-352`

In MCP 2025-11-25, `elicitation` and `sampling` are **client capabilities** — the server emits requests, the client declares support. The existing comment correctly explains this. Adding `elicitation: {}` to `ServerCapabilities` would *violate* the spec.

## Real, still open

### P3-1 — `x-defer-loading` in tool-list filter logic
**File:** `src/mcp/registration/tools-list-compat.ts:939-940`

Quote: ``filter((t) => !t['x-defer-loading']).length``

CLAUDE.md gotcha #19 says this extension was removed; the symbol still appears in active filtering code. **Need to verify** whether `x-defer-loading` is:
- (a) only used internally for telemetry/logging (then it's just a leftover variable name — safe), or
- (b) actually serialized into the `tools` array of the `tools/list` response (then it's a non-spec field leaking to clients).

**Acceptance:** Read `buildFlatToolListEntries` and the page object construction. If (b), strip the field before returning. If (a), rename the variable for clarity and add a comment.

## Already fixed (referenced for context)

- **P1-9** — Sampling reachability probe at startup ✅ FIXED in `src/startup/lifecycle.ts:probeSamplingHealthAtStartup()` (SAMPLING-001 marker).
