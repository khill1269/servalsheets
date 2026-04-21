# Source-Truth Compliance and Architecture Audit

Date: 2026-04-21
Repo: `/Users/thomascahill/Documents/servalsheets 2`
Mode: report-only, no source fixes

## Executive Risk Summary

Go/no-go posture: no-go for production OAuth-backed remote MCP until the token bridge and Google scope issues below are fixed and covered by live or contract tests.

This audit treats current source, config, tests, scripts, and package metadata as repo truth. Repo documentation and previous reports were not used as proof of behavior. External standards were used only as compliance baselines:

- MCP 2025-11-25 lifecycle: https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle
- MCP 2025-11-25 transports: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- MCP 2025-11-25 authorization: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- MCP 2025-11-25 tools: https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- Google API Services User Data Policy: https://developers.google.com/terms/api-services-user-data-policy
- Google OAuth 2.0 policies: https://developers.google.com/identity/protocols/oauth2/policies
- Google Workspace API user-data/developer policy: https://developers.google.com/workspace/workspace-api-user-data-developer-policy
- Google Drive scope guidance: https://developers.google.com/workspace/drive/api/guides/api-specific-auth

Highest-risk findings:

1. Critical MCP authorization failure: Streamable HTTP passes the client bearer token directly into the Google runtime as `googleToken`, violating MCP token-passthrough requirements and causing Google API calls to use an MCP JWT instead of a Google access token. Evidence: `packages/mcp-http/src/routes-transport.ts:625-739`, `packages/mcp-http/src/runtime-factory.ts:220-245`.
2. Critical OAuth token-shape bug: the OAuth provider stores Google tokens as `googleAccessToken` and `googleRefreshToken`, but `getGoogleToken()` reads `accessToken`. Legacy SSE OAuth therefore cannot retrieve the Google access token either. Evidence: `src/auth/oauth-provider.ts:565-574`, `src/auth/oauth-provider.ts:1090-1099`.
3. High Google consent/scope failure: the server OAuth authorize flow redirects to Google with only `openid profile email`, while tool operations require Sheets, Drive, BigQuery, Apps Script, Drive Labels, Drive Activity, and Workspace Events scopes. Evidence: `src/auth/oauth-provider.ts:832-839`, `src/config/oauth-scopes.ts:22-75`, `src/security/operation-scopes-map.ts:33-55`, `src/security/operation-scopes-map.ts:149-265`.
4. High Google least-privilege and verification risk: default non-SaaS scope mode is `full`, and even `STANDARD_SCOPES` includes `drive.readonly`, a restricted Drive scope. Evidence: `src/config/oauth-scopes.ts:22-35`, `src/config/oauth-scopes.ts:52-75`, `src/config/oauth-scopes.ts:122-135`.
5. Medium release readiness failure: `npm run validate:action-config` fails because `sheets_session.compact_session` is in the schema action set but has no `ACTION_ANNOTATIONS` entry. Evidence: `src/schemas/session.ts:249-257`, `src/schemas/session.ts:555-572`, `src/generated/annotations.ts:4660-5022`.

## Inventory

Tracked file inventory from `git ls-files`: 2207 files.

Classification from tracked paths:

| Category | Count |
| --- | ---: |
| Source | 892 |
| Test | 651 |
| Config | 81 |
| Script | 195 |
| Docs | 277 |
| Asset | 10 |
| Other | 101 |

Working tree was dirty before this report. Existing modified/deleted files were treated as user-owned and were not reverted. Build artifacts under `packages/mcp-http/dist` exist locally but are not tracked by Git; root package exports point at root `dist/*`, and the package `@serval/mcp-http` exports `./dist/index.js`. Evidence: `package.json:7-22`, `package.json:28-33`, `packages/mcp-http/package.json:7-17`.

## Architecture Trace

Text trace from client request to Google API:

```text
Client
  -> stdio: package bin/start path -> src/server.ts
       -> buildServerStdioInfrastructure()
       -> createBaseMcpServer(createServerCapabilities())
       -> initializeStdioRuntime()
       -> registerServalSheetsTools()
       -> tool handler dispatch
       -> Google handler bundle
       -> GoogleApiClient
       -> googleapis Sheets/Drive/Docs/Slides/BigQuery/etc.

  -> HTTP: src/http-server.ts / startRemoteServer()
       -> createHttpServer()
       -> registerHttpFoundationMiddleware()
            helmet, compression, response redaction, request recorder,
            HTTPS enforcement, CORS, Origin/Host validation, rate limiting,
            JSON parsing, MCP-Protocol-Version middleware
       -> registerHttpAuthProviders()
            OAuthProvider router, optional SAML guard
       -> bootstrapHttpTransportSessions()
            /mcp Streamable HTTP, optional legacy /sse
       -> createMcpServerInstance()
            createBaseMcpServer(createServerCapabilities())
            optional token-backed Google runtime
            register tools/prompts/resources/logging
       -> StreamableHTTPServerTransport.handleRequest()
       -> tools/list compatibility handler or tools/call dispatch
       -> Google handler bundle
       -> GoogleApiClient
       -> googleapis clients
```

Primary source links:

- HTTP entry and start path: `src/http-server.ts:55-60`, `src/http-server.ts:74-134`, `src/http-server.ts:140-178`.
- HTTP composition: `packages/mcp-http/src/create-http-server.ts:189-345`.
- Foundation middleware: `packages/mcp-http/src/middleware.ts:122-302`.
- OAuth provider registration: `packages/mcp-http/src/auth-providers.ts:66-80`.
- Streamable HTTP route: `packages/mcp-http/src/routes-transport.ts:590-790`.
- Runtime factory: `packages/mcp-http/src/runtime-factory.ts:197-262`.
- Base server/capabilities: `src/mcp/features-2025-11-25.ts:339-385`.
- Tool registration and `tools/list`: `src/mcp/registration/tool-registration.ts:152-256`, `src/mcp/registration/tools-list-compat.ts:843-941`.
- Google client auth and API clients: `src/services/google-api.ts:293-305`, `src/services/google-api.ts:404-421`, `src/services/google-api.ts:443-516`.

## MCP Compliance Matrix

| Area | Status | Source-truth evidence | Notes |
| --- | --- | --- | --- |
| Protocol version constant | Pass | `src/constants/protocol.ts:1-6` | Declares `2025-11-25`. |
| HTTP version response header | Pass | `packages/mcp-http/src/protocol-version-middleware.ts:48-55` | Always sets `MCP-Protocol-Version`. |
| Subsequent request version rejection | Pass | `packages/mcp-http/src/protocol-version-middleware.ts:57-85`; test evidence `tests/contracts/mcp-http-transport-auth-security.test.ts:208-254` | Matches MCP requirement to reject unsupported version with 400. |
| Initialize without version header | Partial | `packages/mcp-http/src/protocol-version-middleware.ts:21-37`, `packages/mcp-http/src/protocol-version-middleware.ts:57-65` | Source allows initialize without header in strict mode. Backwards compatibility is deliberate but should be documented as transport policy. |
| Single `/mcp` POST/GET endpoint | Partial | `packages/mcp-http/src/routes-transport.ts:590-790` | Route uses `app.all('/mcp')` and SDK transport. Source does not explicitly validate `Accept` for POST/GET; behavior is delegated to SDK. |
| Session ID creation and enforcement | Pass | `packages/mcp-http/src/routes-transport.ts:631-748` | New sessions use `randomUUID`; missing session on non-initialize returns 400; missing known session returns 404. |
| DELETE session termination | Pass with cleanup note | `packages/mcp-http/src/routes-transport.ts:591-623`, duplicate route at `packages/mcp-http/src/routes-transport.ts:804-848` | Inline DELETE works. Later `app.delete('/mcp')` is unreachable after `app.all('/mcp')`, which is a maintenance risk. |
| Origin validation | Pass | `packages/mcp-http/src/middleware.ts:230-242`, `packages/mcp-http/src/request-validation-middleware.ts:69-99`; test evidence `tests/contracts/mcp-http-transport-auth-security.test.ts:638-675` | Rejects invalid Origin with 403. |
| Local host binding default | Pass | `src/http-server.ts:55-60` | Default host is `127.0.0.1`; can be overridden by env/options. |
| OAuth bearer challenge | Pass | `src/auth/oauth-provider.ts:394-449`; test evidence `tests/contracts/mcp-http-transport-auth-security.test.ts:562-636` | Missing or invalid bearer returns `WWW-Authenticate`. |
| Resource indicators/audience validation | Partial | `src/auth/oauth-provider.ts:669-678`, `src/auth/oauth-provider.ts:1053-1071`, `src/security/resource-indicators.ts:429-513` | Authorization request validates resource syntax; middleware validates resource/audience. Token endpoint does not read a token-request `resource` parameter, while MCP authorization says clients must include resource in authorization and token requests. |
| Token passthrough prohibition | Fail | `packages/mcp-http/src/routes-transport.ts:625-739`, `packages/mcp-http/src/runtime-factory.ts:220-245`; existing test gap `tests/contracts/mcp-http-transport-auth-security.test.ts:756-773` | Streamable HTTP passes the Authorization bearer into Google runtime as `googleToken`. The test only greps `src/handlers/` and misses transport code. |
| Legacy SSE OAuth token retrieval | Fail | `packages/mcp-http/src/routes-transport.ts:338-344`, `src/auth/oauth-provider.ts:565-574`, `src/auth/oauth-provider.ts:1090-1099` | SSE correctly asks OAuthProvider for Google token, but storage/read property names do not match. |
| `tools/list` schemas | Pass with scale risk | `src/mcp/registration/tools-list-compat.ts:887-938`; `npm run validate:compliance` passed with one warning | Bundled mode returns 25 compound tools with input/output schema metadata. |
| `tools/list` pagination/cursor | Partial | `src/mcp/registration/tools-list-compat.ts:848-883` | Cursor is accepted but ignored; flat mode can return hundreds of entries even though comment says single-page <=25. |
| Tool capability declaration | Partial | `src/mcp/features-2025-11-25.ts:377-383` | `tools` capability is only explicitly declared when staged registration is enabled; code relies on SDK auto-registration otherwise. Runtime initialize tests should assert final capabilities. |
| Logging capability and handler | Pass | `src/mcp/features-2025-11-25.ts:361-369`, `packages/mcp-http/src/runtime-factory.ts:264-272` | Capability and HTTP logging handler registration exist. |
| Resources/prompts/completions | Partial | `packages/mcp-http/src/runtime-factory.ts:249-262`, `src/mcp/features-2025-11-25.ts:365-369` | Prompts/resources are registered. Comments say tool-argument completions are built but not wired to `completion/complete`. |
| Cancellation/progress/task support | Partial | `packages/mcp-http/src/runtime-factory.ts:197-214`, `src/mcp/features-2025-11-25.ts:348-359`, `src/mcp/registration/tool-registration.ts:175-207` | Task capability and cancellation guard exist; full wire behavior depends on SDK and targeted tests. |

## Google Developer Compliance Matrix

| Area | Status | Source-truth evidence | Notes |
| --- | --- | --- | --- |
| Scope minimization | Fail | `src/config/oauth-scopes.ts:22-35`, `src/config/oauth-scopes.ts:52-75`, `src/config/oauth-scopes.ts:122-135` | Google policy requires minimum relevant permissions. Default self-hosted mode resolves to full restricted scopes; standard mode includes `drive.readonly`. |
| Drive scope classification | Fail | `src/config/oauth-scopes.ts:13-17`, `src/config/oauth-scopes.ts:29-32`, `src/config/oauth-scopes.ts:55-56` | Source comments claim standard avoids restricted scopes, but source includes `drive.readonly`, which Google Drive guidance classifies as restricted. |
| Authorization URL scopes | Fail | `src/auth/oauth-provider.ts:832-839` | Google OAuth request asks only for identity scopes, not the scopes needed by Sheets/Drive/Workspace operations. |
| Incremental authorization support | Partial | `src/security/incremental-scope.ts:212-235`, `src/security/incremental-scope.ts:241-268` | Code can generate incremental consent URLs, but unknown operations are allowed by default at `src/security/incremental-scope.ts:149-153`, and remote OAuth flow does not request feature scopes. |
| Feature scope map | Partial | `src/security/operation-scopes-map.ts:33-55`, `src/security/operation-scopes-map.ts:149-265` | Many operations are mapped to required scopes; enforcement depends on callers invoking `validateOperation`. Unknown operation policy is permissive. |
| Redirect URI validation | Pass for static clients | `src/auth/oauth-provider.ts:267-288`, `src/auth/oauth-provider.ts:686-708` | Static client redirect matching compares origin and pathname exactly. |
| Dynamic client redirect validation | Partial | `src/auth/oauth-provider.ts:1257-1288`, `src/auth/oauth-provider.ts:1335-1368` | DCR accepts any syntactically valid URL and auto-grants consent at registration. No HTTPS/loopback/public-client policy is source-proven. |
| PKCE | Pass | `src/auth/oauth-provider.ts:35-41`, `src/auth/oauth-provider.ts:750-773`, `src/auth/oauth-provider.ts:1004-1035` | Requires S256 and validates verifier. |
| State | Pass with format limit | `src/auth/oauth-provider.ts:800-824`, `src/auth/oauth-provider.ts:826-843` | State is validated as hex and original state is stored with auth code. Some OAuth clients may send non-hex state. |
| Token storage at rest | Pass for local GoogleApiClient | `src/services/token-store.ts:47-137`, `src/services/keychain-store.ts:247-338`, `src/utils/auth-paths.ts:9-28` | AES-256-GCM file store and keychain fallback exist; token path constrained to home/temp. |
| OAuth provider server-side token storage | Partial | `src/auth/oauth-provider.ts:1090-1099` | Stores Google tokens in session store; encryption/at-rest guarantees depend on session store implementation and deployment. |
| Token revocation/deletion | Fail | `src/auth/oauth-provider.ts:1141-1173`, `src/services/google-api.ts:1631-1667` | Local GoogleApiClient can revoke/clear, but remote OAuth revoke only deletes `refresh:${token}` and leaves `google_tokens:${userId}` untouched. |
| Client authentication metadata | Fail | `src/auth/oauth-provider.ts:618-631`, `src/auth/oauth-provider.ts:1454-1512`, `src/auth/oauth-provider.ts:968-971` | Metadata advertises `client_secret_basic`, but token endpoint only reads body `client_id` and `client_secret`; no Basic Authorization parsing is source-proven. |
| Refresh token rotation | Pass | `src/auth/oauth-provider.ts:451-525` | Refresh tokens are single-use rotated in the MCP OAuth layer. |
| Refresh token revocation/expiration handling | Partial | `src/services/token-manager.ts:157-185`, `src/services/token-manager.ts:209-245`; Google policy baseline requires handling revocation/expiration | Local Google API client has proactive refresh; remote provider does not refresh stored Google tokens from `googleRefreshToken` in the bridge path. |
| Privacy/disclosure readiness | Unknown | No source-proven privacy policy URL or in-product disclosure binding found in OAuth config path; env-based policy URIs are optional at `src/server/well-known.ts:479-499` | Google public app verification requires accurate disclosure. Source cannot prove deployed OAuth console configuration. |

## Security and Privacy Risk Register

| ID | Severity | Category | Finding | Evidence | Failure mode | Remediation |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Critical | MCP auth | Streamable HTTP token passthrough to Google runtime | `packages/mcp-http/src/routes-transport.ts:625-739`, `packages/mcp-http/src/runtime-factory.ts:220-245` | MCP access token is used as Google access token, violating MCP authorization and breaking API calls. | In OAuth mode, call `oauth.getGoogleToken(req)` or a dedicated token bridge; never pass client bearer tokens downstream. Add contract test around `/mcp` runtime construction. |
| R2 | Critical | OAuth token bridge | Google token storage/read key mismatch | `src/auth/oauth-provider.ts:565-574`, `src/auth/oauth-provider.ts:1090-1099` | OAuth login succeeds but server cannot retrieve Google access token. | Use one stored token shape; add unit/integration test that callback -> token -> `getGoogleToken()` returns Google token. |
| R3 | High | Google scopes | Google authorization requests only identity scopes | `src/auth/oauth-provider.ts:832-839` | Tools needing Sheets/Drive fail or request undisclosed later access. | Build Google scope request from operation/minimum scope set, using incremental consent for elevated features. |
| R4 | High | Least privilege | Default scopes include restricted/full scopes | `src/config/oauth-scopes.ts:22-35`, `src/config/oauth-scopes.ts:52-75`, `src/config/oauth-scopes.ts:122-135` | Google verification/security assessment risk; violates minimum-permission posture for public apps. | Make minimal or standard non-restricted scopes default for public mode; gate restricted scopes by explicit feature and disclosure. |
| R5 | High | OAuth DCR | Public DCR auto-grants consent and returns non-expiring client secret | `src/auth/oauth-provider.ts:1257-1368` | Arbitrary registered clients may obtain trusted client credentials and consent without user UI. | Require explicit user/admin consent for DCR, constrain redirect URI classes, expire/rotate client secrets. |
| R6 | High | Revocation/deletion | Remote revoke does not clear Google token storage | `src/auth/oauth-provider.ts:1090-1099`, `src/auth/oauth-provider.ts:1141-1173` | User revokes MCP refresh token but server-side Google tokens remain until TTL. | Link refresh token to user token key, delete Google token entry on revoke, and revoke Google refresh token where available. |
| R7 | Medium | OAuth metadata | `client_secret_basic` advertised but not implemented | `src/auth/oauth-provider.ts:630`, `src/auth/oauth-provider.ts:968-971`, `src/auth/oauth-provider.ts:1454-1512` | Standards-compliant clients using Basic auth fail. | Parse Authorization Basic header or remove advertised support. |
| R8 | Medium | Data retention | Request recorder stores full payloads when enabled | `packages/mcp-http/src/middleware.ts:166-192`, `src/services/request-recorder.ts:104-137`, `src/services/request-recorder.ts:178-194` | Debug SQLite may retain spreadsheet IDs, arguments, and response data. | Keep opt-in, document retention, add TTL default, expand redaction to known PII/spreadsheet fields or exclude response bodies in production. |
| R9 | Medium | Runtime drift | Source wrappers import package `dist`, and package dist is untracked | `src/http-server/middleware.ts:14-15`, `src/http-server/routes-transport.ts:1-28`, `packages/mcp-http/package.json:7-17` | Local runtime may execute stale untracked dist even while source appears fixed. | Require build before audit/runtime, track release artifacts only at package boundary, and add CI gate for package src/dist consistency. |
| R10 | Medium | Tools/list scale | Flat tools/list ignores cursor and can return hundreds of tools | `src/mcp/registration/tools-list-compat.ts:848-883` | Large discovery payloads and clients cannot page. | Implement cursor pagination for flat mode or keep bundled mode for remote HTTP. |
| R11 | Medium | SDK fragility | Flat tool calls wrap SDK private `_requestHandlers` | `src/mcp/registration/flat-tool-call-interceptor.ts:70-88` | SDK upgrade can silently disable flat routing. | Use public SDK routing hooks or add startup assertion/test that flat call path is active. |
| R12 | Medium | Semantic metadata | Missing action annotation for `compact_session` | `src/schemas/session.ts:249-257`, `src/schemas/session.ts:555-572`; command failure `npm run validate:action-config` | Planner/discovery metadata incomplete for a registered action. | Add generated/manual `ACTION_ANNOTATIONS` entry and gate in CI. |

## Semantic and Tool Alignment

Source-proven positives:

- 25 tools and 409 actions are declared and counted by validation output from `npm run validate:compliance`.
- `npm run validate:alignment` reports 25/25 tools aligned, with 409 actions and 6 documented `sheets_core` aliases.
- `npm run check:drift` reports no metadata drift and source/dist runtime artifact consistency for the checked root artifacts.
- Tool schemas include input/output schema material in bundled `tools/list`: `src/mcp/registration/tools-list-compat.ts:887-938`.

Source-proven gaps:

- `sheets_session.compact_session` is registered in the session action enum but lacks generated annotation metadata, and `npm run validate:action-config` fails.
- Flat tool annotations set `idempotentHint: false` and `openWorldHint: true` for every flat action, with only read-only/destructive derived from known mutations. Evidence: `src/mcp/registration/flat-tool-registry.ts:284-302`. This is semantically conservative but low-fidelity for idempotent read operations and local-only actions.
- Tool-argument completions are explicitly described as not yet wired to `completion/complete`. Evidence: `src/mcp/features-2025-11-25.ts:365-369`.

## Test and Release Gate Results

| Command | Status | Summary |
| --- | --- | --- |
| `npm run typecheck` | Passed | `tsc --noEmit` completed successfully. |
| `npm run validate:compliance` | Passed with warning | Validated 25 tools/409 actions; one warning: `sheets_composite` output response should discriminate on `success`. |
| `npm run check:drift` | Passed | No metadata drift detected; source/dist consistency passed for checked artifacts. |
| `npm run check:architecture` | Passed | Architecture constraints satisfied. |
| `npm run test:run -- tests/compliance` | Passed | 14 files passed, 1 skipped; 197 tests passed, 1 skipped. |
| `npm run test:mcp-http-task-contract` | Passed | 1 test file, 1 test passed. |
| `npm run validate:alignment` | Passed | 25/25 tools aligned; 409 actions. |
| `npm run validate:action-config` | Failed | Missing `ACTION_ANNOTATIONS` entry for `sheets_session.compact_session`. |
| `npm run check:jwt-scope` | Passed | `jwt.sign()` confined to auth subsystem files. |
| `npm run check:secrets` | Passed | No hardcoded secrets detected. |
| Targeted e2e MCP protocol tests | Skipped | Required environment was not available: `TEST_E2E`, `TEST_SPREADSHEET_ID`, and `TEST_HTTP_BASE_URL` were unset; Google OAuth env was not fully configured. |

Commands were local and non-mutating by intent. `check:drift` printed "Updated" messages but final `git status --short` did not show new tracked changes from those generated paths beyond the pre-existing dirty worktree.

## Prioritized Remediation Backlog

P0:

1. Fix `/mcp` Streamable HTTP token bridge so OAuth mode resolves and passes the server-held Google access token, not the MCP bearer token.
2. Fix Google token storage/read property names and add an end-to-end OAuth-provider token retrieval test.
3. Change Google OAuth authorization scopes from identity-only to minimum feature scopes plus incremental consent.
4. Delete server-side Google token entries and revoke Google tokens where possible during `/oauth/revoke`.

P1:

5. Make public/default scope mode least-privilege and remove restricted scopes from `STANDARD_SCOPES` unless the deployment explicitly opts in and has verification.
6. Implement or stop advertising `client_secret_basic`.
7. Add contract tests that instantiate HTTP OAuth mode and assert runtime receives a Google token only from the token store/bridge.
8. Add DCR consent UI/admin approval and redirect URI restrictions.
9. Add `ACTION_ANNOTATIONS` for `sheets_session.compact_session`.

P2:

10. Add flat `tools/list` pagination or constrain flat mode from remote HTTP.
11. Replace private SDK `_requestHandlers` wrapping with public extension points or strong startup checks.
12. Add request-recorder retention controls and production-safe redaction policy.
13. Add a CI package source/dist gate for `packages/mcp-http/dist`, since wrappers import package dist directly.

## Residual Unknowns

- Google OAuth console configuration, privacy policy URL, authorized domains, and published consent screen text cannot be proven from repo source.
- Live Google API behavior was not exercised because the required e2e environment was unset.
- Exact SDK internals for `StreamableHTTPServerTransport` lifecycle, Accept-header handling, and JSON-RPC response shaping were not reimplemented in this audit; source delegates those to `@modelcontextprotocol/sdk`.
