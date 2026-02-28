---
title: Deleted Module Value Matrix
category: development
last_updated: 2026-02-24
description: Value-based analysis of deleted modules for integration vs retirement decisions.
---

# Deleted Module Value Matrix (No-Overlap Integration)

Date: 2026-02-24
Scope: Re-analysis of deleted modules for salvageable value vs safe retirement.
Method: static references (`rg`), active architecture comparison, test/type gates.

## Decision Rules

- `integrate`: concept is useful and already aligned with active architecture.
- `retire`: module is superseded or duplicates active systems.
- `defer`: useful idea exists but should be implemented later as a targeted feature.

## File-by-File Analysis

### 1) `src/utils/action-intelligence.ts` (deleted)

- Original value:
  - Runtime helper access to `ACTION_ANNOTATIONS` (idempotency, batch alternatives, hints).
- Overlap analysis:
  - Data source already existed in `src/schemas/annotations.ts`.
  - Utility file was a duplicate access layer.
- Reuse decision:
  - `integrate` helpers directly into canonical annotations module, not as a parallel util file.
- Integrated now:
  - Added helper exports to `src/schemas/annotations.ts`:
    - `getActionAnnotation`, `getActionHints`, `getBatchSuggestion`, `isRetryable`, `getApiCallCount`, `getPrerequisites`, `getActionGuidance`, `shouldWarnAboutIdempotency`, `getActionAnnotationKeysForTool`, `hasActionAnnotations`.
  - Wired into `src/services/confirm-service.ts` to generate annotation-based confirmation warnings.
- Disposition: `retire standalone file`, `keep concept in canonical module`.

### 2) `src/constants/extraction-fields.ts` (deleted)

- Original value:
  - 6 extraction tiers + category mapping for a 43-category testing model.
- Overlap analysis:
  - Active runtime retrieval is already implemented in `src/analysis/tiered-retrieval.ts` and used by `sheets_analyze` paths.
  - No active imports/usages of deleted tier constants/functions.
  - Category taxonomy in deleted file is test-framework-centric and not used by current analysis execution.
- Reuse decision:
  - `retire` as runtime module (would duplicate tiered retrieval).
  - `defer` selective taxonomy ideas only if a future test framework explicitly consumes them.
- Disposition: `safe to keep deleted`.

### 3) `src/types/google-api-extensions.ts` (deleted)

- Original value:
  - Supplemental Google API response interfaces to reduce `any` spread.
- Overlap analysis:
  - Active code uses:
    - `googleapis` native `sheets_v4` types, and
    - platform-level interfaces from `packages/serval-core/src/interfaces/backend.ts`.
  - Adapters already map Google responses into normalized types (`src/adapters/google-sheets-backend.ts`).
- Reuse decision:
  - `retire` duplicate type layer.
  - Keep strict typing improvements in adapter/core interfaces instead of parallel extension types.
- Disposition: `safe to keep deleted`.

### 4) `src/types/operation-plan.ts` (deleted)

- Original value:
  - Rich planning metadata (`successCriteria`, `rollbackStrategy`, alternatives, step rationale/outcomes/dependencies).
- Overlap analysis:
  - Existing active plan contract: `src/schemas/confirm.ts` + `src/services/confirm-service.ts`.
  - Some high-value metadata was missing in active confirm flow.
- Reuse decision:
  - `integrate` non-duplicative metadata into existing confirm plan schema/service.
- Integrated now:
  - Added optional fields in confirm schema/service:
    - Plan: `successCriteria`, `rollbackStrategy`, `alternatives`
    - Step: `rationale`, `expectedOutcome`, `estimatedDuration`, `optional`, `dependsOn`
  - Wired handler mapping in `src/handlers/confirm.ts`.
  - Added display support and tests in `tests/services/confirm-service.test.ts`.
- Disposition: `retire standalone file`, `keep selected metadata in active confirm path`.

### 5) `src/types/sampling.ts` (deleted)

- Original value:
  - Enhanced tool-call/workflow orchestration types.
- Overlap analysis:
  - Active architecture already has concrete orchestration models:
    - `src/analysis/flow-orchestrator.ts`
    - `src/analysis/planner.ts`
    - `src/services/pipeline-executor.ts`
  - Deleted types would duplicate active flow-step and dependency models without runtime integration.
- Reuse decision:
  - `retire` deleted type set.
  - `defer` only if future orchestration contracts need shared cross-module public types.
- Disposition: `safe to keep deleted`.

## Dependency Wiring Sanity Check (Do Not Remove)

### `hyperformula`

- Status: `actively wired`, do not remove.
- Evidence:
  - Core implementation: `src/services/formula-evaluator.ts` (dynamic import + engine lifecycle).
  - Used by scenario modeling paths in `src/handlers/dependencies.ts`.
  - Test coverage present: `tests/handlers/formula-evaluator.test.ts`.

### `graphql` + `@apollo/server`

- Status: `actively wired`, do not remove.
- Evidence:
  - GraphQL server: `src/graphql/server.ts` (`ApolloServer` + endpoint handlers).
  - HTTP integration: `src/http-server.ts` imports and initializes GraphQL endpoint.
  - Resolver layer uses `graphql` types/errors: `src/graphql/resolvers.ts`.

## Validation Run (after integration changes)

- `npm run test -- tests/services/confirm-service.test.ts` ✅
- `npx eslint src/services/confirm-service.ts src/handlers/confirm.ts src/schemas/confirm.ts src/schemas/annotations.ts tests/services/confirm-service.test.ts` ✅
- `npm run typecheck` ✅
- `npm run check:integration-wiring` ✅
- `npm run check:drift` ✅

## Final Keep/Retire Summary

- Keep integrated ideas:
  - Action annotation runtime helpers (now in canonical `annotations.ts`)
  - Confirm plan metadata enhancements (now in active confirm schema/service/handler)
- Retire deleted modules:
  - `extraction-fields.ts`
  - `google-api-extensions.ts`
  - `sampling.ts`
- Keep dependencies:
  - `hyperformula`
  - `graphql`
  - `@apollo/server`

## Live Dead-Code Value Audit (2026-02-24, multi-parameter)

Scope: symbol/file candidates from `audit-output/dead-code-triage-2026-02-24.{md,json}`.

Value parameters used for each decision:
- Runtime wiring: direct runtime imports/calls in `src/`.
- Tooling dependency: test/script usage and CI contract impact.
- Architectural uniqueness: unique capability vs overlap/duplication.
- Integration readiness: can it be wired with low-risk config/bootstrapping.
- Deletion risk: chance of removing unfinished or roadmap-critical work.

### Updated Classification Signal

- Script/tooling references are now separated from runtime wiring debt:
  - `script_in_use`: `4` symbols (keep).
  - `wiring_candidate`: `0` symbols (no unresolved runtime gaps in this pass).

### File-Level Decisions

| File | Candidate symbols | Value assessment | Decision |
|---|---|---|---|
| `src/services/billing-integration.ts` | `createBillingIntegration` | Runtime bootstrap now wired in `server.ts` and `http-server.ts` via `initializeBillingIntegration` | `integrated` |
| `src/services/google-formula-service.ts` | `GoogleFormulaService` | High-value Layer-3 capability; interface now aligned to `scriptId`, remaining prerequisite is source-sheet evaluation correctness + runtime wiring | `integrate` (pilot path behind feature flag, gated) |
| `src/config/action-field-masks.ts` | `hasFieldMask`, `getFieldMasksForTool`, `getFieldMaskCoverage` | Optimization stack exists but is not connected | `defer-integrate` with `field-mask-injection` |
| `src/utils/field-mask-injection.ts` | `injectBatchFieldMask`, `createFieldMaskInjector`, `measureReduction`, `enableFieldMaskLogging`, `disableFieldMaskLogging`, `getFieldMaskStats` | Useful optimization concept, currently dormant | `defer-integrate` (single pilot handler first) |
| `src/services/sampling-context-cache.ts` | `invalidateContext` | Now wired in `src/mcp/registration/tool-handlers.ts` with mutation-aware invalidation | `integrated` |
| `src/services/metrics-dashboard.ts` | `formatDashboardAsText` | Used by diagnostics script and tests | `keep` (`script_in_use`) |
| `src/utils/ast-schema-parser.ts` | `extractSchemaActions`, `extractHandlerCases`, `isSingleActionTool` | Used by validation scripts/contracts in CI | `keep` (`script_in_use`) |
| `src/config/schema-optimization.ts` | `isLazyLoadTool`, `autoDetectSchemaMode`, `getSchemaStats` | Mostly feature-complete, not currently consumed | `retire exports` or wire explicitly as schema-mode initiative |
| `src/mcp/registration/tool-definitions.ts` | `getLazyToolDefinitions`, `getToolDefinition` | Lazy-load API helpers available but unused | `defer` (wire with lazy tool loading) |
| `src/di/container.ts` | `getContainer`, `resetContainer` | DI class tested, global singleton API unused in runtime | `defer` (plugin/DI direction decision) |
| `src/utils/heap-monitor.ts` | `startHeapMonitorIfEnabled` | Superseded by `src/server/heap-health-check.ts` path | `unify` then `retire` duplicate |
| `src/utils/heap-watchdog.ts` | `getHeapPressureLevel`, `isHeapElevated`, `stopHeapWatchdog` | Watchdog starts in runtime; extra exports unused | `retire exports` unless explicitly needed |
| `src/services/composite-operations.ts` | `getCompositeOperations`, `initializeCompositeOperations` | Handler constructs service directly; singleton wrappers unused | `retire exports` |
| `src/services/cache-invalidation-graph.ts` | `resetCacheInvalidationGraph` | Test-reset helper with no current consumers | `retire` or convert to used test hook |
| `src/services/federated-mcp-client.ts` | `resetFederationClient` | Reset API unused by tests/runtime | `retire` or add explicit test usage |
| `src/services/response-validator.ts` | `resetResponseValidator` | Reset helper unused | `retire` or wire into test reset harness |
| `src/services/idempotency-manager.ts` | `enableIdempotencyLogging`, `disableIdempotencyLogging` | Debug toggles not wired | `retire` unless adding admin/debug endpoint |
| `src/utils/logger-context.ts` | `resetServiceContext` | Unused reset helper | `retire` or wire into test harness |
| `src/utils/schema-cache.ts` | `clearValidationCache` | Current implementation is no-op | `retire` or implement real namespace clear |
| `src/utils/timeout.ts` | `withTimeoutAndKeepalive` | Useful wrapper but no call sites | `integrate` into long-running handlers or `retire` |
| `src/utils/infrastructure.ts` | `CoalescedBatch` | Unused type only; file already has overlap with other infra services | `retire type`, reassess full module overlap separately |
| `src/analysis/formula-parser.ts` | `extractCellReferences`, `extractCellReferencesAsync`, `isRange`, `getReferencedCells`, `getFormulaCacheStats`, `clearFormulaCache` | Convenience API not referenced | `retire exports` |
| `src/analysis/impact-analyzer.ts` | `CellInfo` | Unused interface | `retire` |
| `src/config/federation-config.ts` | `validateServerConfig` | Duplicate validation path (`parseFederationServers`) | `retire` or wire in CLI validation |
| `src/config/google-limits.ts` | `GoogleSheetsLimits` | Type alias unused | `retire` |
| `src/constants/field-masks.ts` | `combineFieldMasks` | Helper is no longer consumed | `retire` |
| `src/resources/sheets.ts` | `SheetResourceOptions` | Unused type export | `retire` |
| `src/types/conflict.ts` | `MergeStrategy`, `ConflictNotification` | Unused types | `retire` |
| `src/types/transaction.ts` | `SnapshotConfig`, `IsolationLevel` | Unused types | `retire` |
| `src/types/validation.ts` | `UniquenessValidation`, `RequiredValidation`, `PatternValidation`, `CustomValidation`, `BusinessRuleValidation`, `ValidatorFactoryOptions` | Partially overlaps current validation engine type surface | `defer` one sprint, prune if no owner |
| `src/utils/cache.ts` | `createCache`, `createTrackedCache` | Convenience factories unused; core class is used | `retire exports` |
| `src/utils/memoization.ts` | `memoizeMulti`, `memoizeWeak`, `memoizeDebounce` | Advanced variants unused | `retire exports` |
| `src/utils/redact.ts` | `redactAll` | Convenience helper unused | `retire` |
| `src/utils/response-diff.ts` | `formatDiffJSON`, `hasFieldChanged`, `getFieldChanges` | Diff core used; helper exports unused | `retire exports` |
| `src/utils/validation-helpers.ts` | `assertInRange`, `isNonEmptyArray`, `isValidSpreadsheetId`, `isValidSheetId`, `safeArrayAccess` | Overlaps other range/validation helpers | `unify` then `retire` duplicates |

### Execution Order to Avoid Losing Value

1. `P0 integrate`: `GoogleFormulaService` (pilot path behind feature flag).
2. `P1 unify`: `heap-monitor` vs `heap-health-check`, validation/range helper overlap.
3. `P1 retire exports`: low-risk unused convenience APIs/types.
4. `P2 prune`: remaining deferred items if no product owner/use case is assigned.

### P0 Gate Criteria (GoogleFormulaService)

- Contract correctness: `scriptId` naming is now aligned; keep this contract stable in future wiring.
- Evaluation correctness: ensure Layer-3 script evaluates formulas against the intended source-sheet context, not only an isolated eval tab.
- Runtime wiring: inject authenticated Script API client via handler context (`googleClient`) and keep it feature-flagged.
- Test proof: add mocked fallback tests in `tests/handlers/dependencies.test.ts` for `needsGoogleEval` paths.
