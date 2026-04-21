---
title: Source-Truth Compliance Remediation Tasks
category: runbook
last_updated: 2026-04-21
description: Prioritized remediation backlog derived from the 2026-04-21 Source-Truth Compliance & Architecture Audit.
version: 2.0.0
status: active
---

# Source-Truth Compliance Remediation Tasks

Source audit: `docs/audits/source-truth-compliance-architecture-audit-2026-04-21.md`

Status key:

- TODO: not started
- IN PROGRESS: actively being changed
- VERIFY: implementation exists, verification pending
- DONE: implementation and focused verification passed
- BLOCKED: needs external environment or decision

## P0 Production Blockers

| ID | Status | Audit IDs | Task | Primary files | Verification |
| --- | --- | --- | --- | --- | --- |
| P0-1 | DONE | R1 | Separate MCP bearer token from Google access token in HTTP transport; never pass MCP bearer to Google runtime. | `packages/mcp-http/src/routes-transport.ts`, `tests/http-server/routes-transport.test.ts` | Passed: `npm run test:run -- tests/http-server/routes-transport.test.ts tests/integration/oauth-flow.test.ts`; `npm run typecheck` |
| P0-2 | DONE | R2 | Standardize OAuthProvider Google token storage/retrieval shape. | `src/auth/oauth-provider.ts`, `tests/integration/oauth-flow.test.ts` | Passed: OAuth token bridge regression test; `npm run typecheck` |
| P0-3 | DONE | R3, R4 | Replace identity-only Google auth scopes with configured least-privilege Google scopes and incremental consent path. | `src/auth/oauth-provider.ts`, `src/config/oauth-scopes.ts`, OAuth/scope tests | Passed: `npm run test:run -- tests/config/oauth-scopes.test.ts tests/integration/oauth-flow.test.ts`; `npm run typecheck` |
| P0-4 | DONE | R6 | Delete server-side Google token entries on MCP token revocation. | `src/auth/oauth-provider.ts`, OAuth tests | Passed: revocation storage cleanup test; `npm run typecheck` |

## P1 Compliance Hardening

| ID | Status | Audit IDs | Task | Primary files | Verification |
| --- | --- | --- | --- | --- | --- |
| P1-1 | DONE | R4 | Make default/public Google scope mode least-privilege and gate restricted scopes behind explicit opt-in. | `src/config/oauth-scopes.ts`, tests | Passed: `npm run test:run -- tests/config/oauth-scopes.test.ts tests/integration/oauth-flow.test.ts`; `npm run typecheck` |
| P1-2 | DONE | R7 | Implement `client_secret_basic` or remove it from OAuth metadata. | `src/auth/oauth-provider.ts`, OAuth tests | Passed: `npm run test:run -- tests/integration/oauth-flow.test.ts` |
| P1-3 | DONE | R5 | Harden DCR consent and redirect URI policy. | `src/auth/oauth-provider.ts`, OAuth tests | Passed: `npm run test:run -- tests/integration/oauth-flow.test.ts`; `npm run typecheck` |
| P1-4 | DONE | R12 | Add missing `sheets_session.compact_session` action annotation. | generated annotation source, `src/generated/annotations.ts` | Passed earlier: `node --import tsx scripts/validate-action-configuration.ts`; current reruns are blocked by user-owned conflict markers in `src/schemas/compute.ts` |

## P2 Release and Runtime Safety

| ID | Status | Audit IDs | Task | Primary files | Verification |
| --- | --- | --- | --- | --- | --- |
| P2-1 | VERIFY | R10 | Add flat `tools/list` pagination or constrain flat mode on remote HTTP. | `src/mcp/registration/tools-list-compat.ts`, `tests/contracts/mcp-tools-list.test.ts` | Implemented; `npm run test:run -- tests/contracts/mcp-tools-list.test.ts` blocked by user-owned conflict markers in `src/schemas/compute.ts` |
| P2-2 | DONE | R11 | Replace or guard private SDK `_requestHandlers` interception. | `src/mcp/registration/flat-tool-call-interceptor.ts`, `tests/mcp/flat-tool-call-interceptor-runtime.test.ts` | Passed: `npm run test:run -- tests/mcp/flat-tool-call-interceptor-runtime.test.ts` |
| P2-3 | VERIFY | R8 | Add request-recorder retention and production payload controls. | `src/services/request-recorder.ts`, `tests/replay/request-recorder.test.ts` | Implemented; source check passed: `npx tsc --ignoreConfig --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck --esModuleInterop --allowSyntheticDefaultImports --types node src/services/request-recorder.ts`; runtime test skipped because local `better-sqlite3` native module is unavailable |
| P2-4 | DONE | R9 | Add package source/dist consistency gate for `packages/mcp-http/dist`. | `scripts/check-source-dist-consistency.ts`, `package.json` | Passed: `npm run check:source-dist` |

## Verification Stack

Run after each P0/P1 group:

```bash
npm run typecheck
npm run validate:compliance
npm run validate:alignment
node --import tsx scripts/validate-action-configuration.ts
npm run check:drift
npm run check:architecture
npm run check:jwt-scope
npm run check:secrets
npm run test:run -- tests/compliance
npm run test:mcp-http-task-contract
npm run test:run -- tests/contracts/mcp-http-transport-auth-security.test.ts tests/integration/oauth-flow.test.ts tests/config/oauth-scopes.test.ts tests/http-server/routes-transport.test.ts
```

E2E protocol tests remain BLOCKED until `TEST_E2E`, `TEST_SPREADSHEET_ID`, and `TEST_HTTP_BASE_URL` are set.

Current local blocker: broad schema-importing checks are blocked by user-owned merge conflict markers in `src/schemas/compute.ts`. Do not mark full-repo gates as clean until that file is resolved.
