---
title: Testing Strategy
date: 2026-03-24
status: active
---

# Testing Strategy

## Overview

ServalSheets uses layered validation so most CI coverage stays offline while still proving MCP protocol behavior, HTTP transport behavior, and hosted failover behavior.

Most code changes should be validated with both repo-wide gates and a focused test slice:

- `npm run typecheck`
- `npm run build`
- the narrowest relevant Vitest command for the files you changed

## Validation Layers

| Layer | Primary command | Purpose | External dependency |
|-------|------------------|---------|---------------------|
| Fast/unit | `npm run test:fast` | Core logic, schemas, utils, most handlers | None |
| Handler-focused | `npm run test:handlers` | Tool handler behavior with mocks | Mocked |
| Contract | `npm run test:contracts` | MCP contract behavior | None |
| Compliance | `npm run test:compliance` | MCP protocol/spec conformance | None |
| Integration | `npm run test:integration` | Cross-module flows and hosted-server integration slices | Local HTTP harness |
| MCP HTTP task contract | `npm run test:mcp-http-task-contract` | Streamable HTTP task semantics | Local script/test harness |
| Raw HTTP failover | `npm run test:http-transport-failover` | Real `/mcp` session flow with hosted failover regression coverage | Localhost socket bind |
| Full suite | `npm run test:all` | Full Vitest suite | Mixed |
| Live Google validation | `npm run test:live` | Real Google-backed behavior | Google APIs |

## Common Commands

```bash
# Fast local loop
npm run test:fast
npm run typecheck

# HTTP and protocol coverage
npm run test:integration
npm run test:mcp-http-task-contract
npm run test:http-transport-failover

# Full repo validation
npm run test:all
npm run build
npm run security:audit
npm run docs:audit
npm run release:audit
```

## Test Organization

```text
tests/
├── packages/         # Workspace package tests (mcp-http, mcp-stdio, mcp-runtime, mcp-client)
├── handlers/         # Handler behavior and snapshots
├── contracts/        # MCP protocol contract tests
├── compliance/       # Spec compliance and transport guarantees
├── http-server/      # HTTP transport and route-surface regressions
├── integration/      # Cross-module and hosted-server integration tests
├── server/           # STDIO/runtime integration tests
├── services/         # Service-level tests
└── fixtures/         # Shared data and harnesses
```

## Hosted Failover Coverage

Hosted failover is off by default. The remote executor path is only enabled when both of these are set:

- `MCP_REMOTE_EXECUTOR_URL`
- `MCP_REMOTE_EXECUTOR_TOOLS`

The allowlist in `MCP_REMOTE_EXECUTOR_TOOLS` is enforced in config and in the runtime client gate. Setting only the URL does not enable failover.

Coverage is intentionally split across two levels:

- Mocked/helper/runtime failover coverage proves routing and fallback behavior without needing sockets.
- `tests/http-server/http-transport-failover.test.ts` proves the real `/mcp` session flow over the HTTP transport.

The raw transport failover suite self-skips when localhost binding is unavailable, but CI runs it in the dedicated `http-transport-failover` job.

## Release-Minimum Evidence

For changes that affect transports, hosted execution, or routing, attach at least:

- `npm run typecheck`
- `npm run build`
- `npm run test:mcp-http-task-contract`
- `npm run test:http-transport-failover`
- the focused package, service, or handler test slice for the edited area

## Related

- [Testing Guide](./TESTING.md)
- [Master Test Plan](../testing/MASTER_TEST_PLAN.md)
- [Implementation Guardrails](./IMPLEMENTATION_GUARDRAILS.md)
