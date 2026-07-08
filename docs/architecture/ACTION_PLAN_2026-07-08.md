---
title: Architecture Action Plan
category: architecture
date: 2026-07-08
last_updated: 2026-07-08
status: active
---

# Architecture Action Plan

This plan captures the next high-leverage cleanup tracks after the VS Code resource audit. It is scoped to reducing fragility without changing product behavior.

## Current Shape

Primary runtime entry points:

- `src/cli.ts` starts stdio and local CLI flows.
- `src/http-server.ts` starts the Streamable HTTP server.
- `src/http-server/runtime-factory.ts` and `src/http-server/server-lifecycle.ts` assemble HTTP runtime dependencies.
- `src/mcp/registration/tool-handlers.ts` normalizes MCP calls, validates schemas, runs handlers, and builds MCP responses.

Core ownership boundaries:

- `src/schemas/` owns action contracts and generated metadata inputs.
- `src/handlers/` owns tool/action orchestration.
- `src/services/` owns external APIs, stateful infrastructure, caching, tracing, replay, audit, metrics, and background work.
- `src/config/env.ts` owns typed environment parsing, but some launch, MCP, and script configs still define runtime behavior directly.
- `tests/` is already split by contract, unit, service, integration, compliance, live API, audit, simulation, and snapshot intent.

## Priority 1: Configuration Ownership

Goal: make `src/config/env.ts` the only runtime configuration contract.

Actions:

- Move launch-only feature flags into documented env presets instead of duplicating them across `.vscode/launch.json` and MCP config.
- Add a lightweight config inventory script that reports env keys used outside `src/config/env.ts`.
- Keep secrets out of VS Code and MCP JSON files; use environment references or VS Code MCP prompt inputs.
- Treat request tracing, Google API body tracing, and replay capture as explicit opt-in forensic modes.

Relevant files:

- `src/config/env.ts`
- `.mcp.json`
- `.vscode/launch.json`
- `docs/operations/REQUEST_REPLAY.md`
- `docs/operations/TRACING_DASHBOARD.md`

## Priority 2: Handler and Service Boundaries

Goal: keep handlers thin and services explicit.

Actions:

- Keep handler files focused on request orchestration, validation-specific branching, and response shaping.
- Move reusable external API behavior into `src/services/` or `src/core/`, not sibling handlers.
- Expand `scripts/check-architecture.sh` with checks for direct `process.env` reads outside config and cross-handler imports.
- Document exceptions for standalone handlers that do not extend `BaseHandler`.

Relevant files:

- `src/handlers/base.ts`
- `src/handlers/helpers/`
- `src/services/google-api.ts`
- `scripts/check-architecture.sh`

## Priority 3: Generated File Blast Radius

Goal: generated files should not wake editor watchers, Snyk, search, tests, or MCP tooling.

Actions:

- Keep `.stryker-tmp/`, `.tmp/`, `.tmp-analysis/`, `.dist-check-*/`, `tests/.tmp/`, traces, replays, coverage, generated docs, and local archives excluded consistently.
- Keep VS Code watcher/search excludes aligned with `.gitignore`.
- Keep Snyk in manual mode for this workspace unless a dedicated security scan is being run.

Relevant files:

- `.gitignore`
- `.vscode/settings.json`
- `stryker*.conf.*`
- `scripts/setup-vscode.sh`

## Priority 4: Test Command Taxonomy

Goal: every test command should have a clear cost tier.

Actions:

- Fast local: `test:fast`, `typecheck`, `lint`, `check:drift`.
- Normal verification: `verify:safe`.
- Full local verification: `verify`.
- Live/API tests: `test:live:*`, always opt-in.
- Mutation/performance/audit: `mutation:*`, `audit:*`, and benchmark tasks, always explicit.
- Keep `.vscode/tasks.json` small and only wired to scripts that exist in `package.json`.

Relevant files:

- `package.json`
- `.vscode/tasks.json`
- `docs/development/TESTING_STRATEGY.md`

## Priority 5: Developer Setup

Goal: setup commands should not unexpectedly change project dependencies or start background services.

Actions:

- Keep `scripts/setup-vscode.sh` limited to editor configuration.
- Split dependency maintenance into an explicit dependency update workflow.
- Keep secret setup separate from editor setup.
- Add a future `doctor` script for local environment diagnostics rather than embedding checks in setup.

Relevant files:

- `scripts/setup-vscode.sh`
- `docs/development/VSCODE_SETUP.md`
- `docs/guides/QUICKSTART_CREDENTIALS.md`

## Next Patches

1. Extend `scripts/check-architecture.sh` to detect direct `process.env` usage outside `src/config/`.
2. Add a `scripts/doctor-vscode.mjs` command that reports workspace size, stale extension directories, missing scripts in `.vscode/tasks.json`, and dangerous MCP values without printing secrets.
3. Add documentation for the lean VS Code profile and the manual high-cost extension profile.
4. Consolidate trace/replay launch configs into clearly named forensic-only entries.
