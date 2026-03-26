---
title: MCP Server Optimization Execution Plan
category: remediation
last_updated: 2026-03-24
description: Prioritized execution backlog from the latest live log audit, Phase 12 audit, and codebase optimization review.
version: 2.0.0
---

# MCP Server Optimization Execution Plan

This plan consolidates the current live-production findings, the Phase 12 audit, and the broader architecture review into one execution backlog.

## Current Priorities

### P0 — Live Reliability

- [ ] Finish end-to-end live verification of the `sheets_transaction.commit` timeout fix in Claude Desktop and HTTP transport tests
  Current state: code-side task-based execution support, timeout enforcement, keepalive, and transport contracts are green. Remaining proof requires a real Claude Desktop or live Google API session with outbound connectivity; sandbox-local contract suites either pass or skip on localhost/socket gates.
- [x] Let `sheets_agent.plan` accept a provided `scoutResult` so large-workbook planning can bypass its internal scout
- [x] Make transaction execution task-capable for background-safe execution
- [x] Enforce transaction timeout at the actual Google Sheets API boundary
- [x] Keep long transaction commits alive with periodic progress notifications when available

### P1 — Long-Running Workbook and Drive Operations

- [x] Add hard request budgets / pagination guards to `core.describe_workbook`
- [x] Make `core.workbook_fingerprint` metadata-only so it no longer fetches cell values
- [x] Tighten revision scan limits in `collaborate.version_list_revisions`
- [x] Tighten revision scan limits in `history.timeline`

### P2 — Canonical Sheet Semantics

- [x] Fix `data.find_replace` find-only scoping so matches are searched in the intended sheet scope
- [x] Add a true sheet reset path that clears values, formats, banding, filters, and table-adjacent metadata
- [x] Stop `composite.smart_append` from relying on stale append heuristics; compute the append target explicitly
- [x] Normalize `dimensions.sort_range` target resolution when callers provide bare ranges plus explicit sheet context
- [x] Add preflight sheet-grid validation for `dimensions.create_slicer` anchor placement
- [x] Finish the remaining shared range/sheet target normalization pass across dimensions, data, and composite actions

### P3 — Contract and Planner Hardening

- [x] Validate AI-generated agent plan steps against live tool schemas before returning them
- [x] Normalize known schema/docs compatibility aliases at the handler boundary
- [x] Prevent stale tool-discovery-hint overrides from drifting away from runtime action names and required fields
- [x] Remove stale raw action-metadata entries and add a source-level contract guard against dead action keys
- [x] Align active guide/feature docs with current tool.action names and add a docs contract guard for user-facing references
- [x] Move `docs/guides/ACTION_REFERENCE.md` onto the same generated manifest path as `docs/development/ACTION_REGISTRY.md`
- [x] Align destructive confirmation-policy semantics with `ACTION_METADATA` and add a contract over the overlap
- [x] Reduce remaining drift between action metadata and runtime registration semantics

### P4 — Preflight and UX Safety

- [x] Add anchor-cell bounds pre-validation for charts and slicers
- [x] Add explicit header-mode semantics for compute regression/statistical actions
- [x] Improve protected-range listing semantics
- [x] Update protected-range docs to reflect sheet-level and named-range protections
- [x] Re-baseline false positives from the Phase 12 audit after P0-P2 land

## Root-Cause Buckets

1. Long-running operations still use direct-response paths or oversized fetches.
2. Sheet scope and reset semantics are inconsistent.
3. Agent/schema/runtime contracts still drift in edge cases.
4. Several write-heavy features still rely on API error feedback instead of preflight validation.
5. Some reported issues are actually feature gates or definition gaps, not runtime defects.

## First Execution Slice

The first slice is intentionally narrow and log-backed:

1. `sheets_transaction.commit`
2. transaction task support
3. transaction timeout enforcement
4. transaction keepalive / progress continuity

This is the highest-confidence live issue and the best starting point for improving real Claude Desktop reliability.
