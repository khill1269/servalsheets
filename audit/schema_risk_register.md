# Schema Risk Register — ServalSheets

> Audit Date: 2026-03-28 | 34 schema files, ~26K LOC, Zod v4.3.6

## Risk Summary

| Risk                                         | Severity | Count              | Action Required                            |
| -------------------------------------------- | -------- | ------------------ | ------------------------------------------ |
| `z.any()` / `z.unknown()` in request schemas | MEDIUM   | 126+ instances     | Document necessity; convert high-risk ones |
| `collaborate` flat schema workaround         | LOW      | 1 tool             | Monitor SDK; revert when fixed             |
| Missing `.strict()` on input schemas         | LOW      | ~22 tools          | Optional hardening                         |
| `z.lazy()` for circular refs                 | LOW      | 1 instance         | Correct usage                              |
| `as unknown` type assertions                 | LOW      | 3 instances        | Acceptable (localized)                     |
| Documented schema-handler deviations         | INFO     | 1 tool (6 aliases) | Tracking active                            |
| Protocol deviation (ISSUE-255)               | INFO     | 1 issue            | Documented + controllable                  |

---

## 1. z.any() / z.unknown() Usage — MEDIUM RISK

**Total instances**: 126+ across schema files
**Verified count**: `grep -rn "z\.any()\|z\.unknown()"` in `src/schemas/`

### Distribution by File

| File            | Instances | Nature                                                |
| --------------- | --------- | ----------------------------------------------------- |
| `session.ts`    | 11        | Arbitrary preferences, checkpoint data, profile state |
| `composite.ts`  | 13        | Import/export payloads, generation results            |
| `quality.ts`    | 13        | Rule results, conflict data, validation findings      |
| `analyze.ts`    | 3         | Finding params, issue details, error records          |
| `core.ts`       | 12        | Developer metadata values, DataFilter payloads        |
| `compute.ts`    | 9         | Computation results, sklearn model output             |
| `appsscript.ts` | 8         | Script execution results, function params             |
| `confirm.ts`    | 8         | Dynamic form schema, URL parameters                   |
| `webhook.ts`    | 4         | Event payload, delivery record                        |
| `shared.ts`     | 4         | Generic response wrappers, diff results               |
| `agent.ts`      | 4         | Step params, plan steps, result data                  |
| `history.ts`    | 4         | Annotation data, diff metadata                        |
| `federation.ts` | 3         | Remote tool input params, results                     |
| `connectors.ts` | 2         | External connector query results                      |
| `fix.ts`        | 6         | Cleaning results, anomaly details                     |
| `templates.ts`  | 4         | Template parameter values                             |
| `rbac.ts`       | 1         | Custom attribute claims                               |
| `data.ts`       | 2         | Cross-compare value pairs                             |

### Classification of z.any()/z.unknown() Uses

**Justified (external API boundaries):**

- `core.ts` — Google Sheets `DeveloperMetadata.value` is arbitrary string/JSON
- `appsscript.ts` — Apps Script function parameters (user-defined)
- `federation.ts` — Remote MCP tool parameters (schema unknown until runtime)
- `compute.ts` — sklearn/custom model outputs (structure varies by model type)
- `webhook.ts` — Webhook event payloads (external service-defined)

**Potentially Improvable:**

- `session.ts` — Preferences and checkpoint state could have typed sub-schemas
- `composite.ts` — Generation results and import payloads have known shapes
- `quality.ts` — Validation findings have predictable structure
- `agent.ts` — Plan step params could use discriminated union by step type

### Risk Assessment

- **Immediate security risk**: LOW — z.unknown() at least ensures values exist; no XSS/injection via Zod
- **Runtime error risk**: MEDIUM — untyped payloads reaching downstream code without type guards
- **Audit difficulty**: MEDIUM — hard to trace what data flows through untyped fields

### Recommended Action (Priority 2)

For high-value actions, replace `z.unknown()` with typed alternatives:

```typescript
// Current (risky):
result: z.record(z.string(), z.unknown());

// Improved:
result: z.union([
  z.object({ type: z.literal('numeric'), value: z.number() }),
  z.object({ type: z.literal('text'), value: z.string() }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
```

Start with: `agent.ts` step params, `session.ts` preferences, `composite.ts` generation results.

---

## 2. collaborate Schema — Known SDK Workaround

**File**: `src/schemas/collaborate.ts:139-823`

**Issue**: MCP SDK v1.26.0 has a bug with `z.discriminatedUnion()` on large discriminators (41+ actions). `sheets_collaborate` uses a flat `z.object()` + `.superRefine()` workaround.

**Risk**:

- Non-standard pattern that bypasses discriminated union type narrowing
- Handler still performs explicit action dispatch correctly
- Schema validation functionally equivalent (verified by tests)

**Mitigation**: `tests/contracts/collaborate-discriminated-union.test.ts` validates the workaround behavior

**Resolution**: Revert to `z.discriminatedUnion()` when SDK bug is fixed. Track via SDK changelog.

---

## 3. Missing .strict() on Input Schemas — LOW RISK

**File**: `src/schemas/compute.ts` (only tool consistently using `.strict()`)

**Pattern**: `}).strict()` prevents unknown properties in request payloads

**Current coverage**: ~15 schemas in `compute.ts` use `.strict()`. Other tools do not.

**Risk**: Without `.strict()`, clients can pass extra properties that silently pass validation but may cause unexpected behavior if handler code reads unknown fields.

**Recommendation**: Add `.strict()` to all `Action*Input` schemas in discriminated union branches. Low priority — existing behavior hasn't caused issues.

---

## 4. z.lazy() — Single Correct Usage

**File**: `src/schemas/core.ts:639`

```typescript
z.lazy(() => z.record(z.string(), z.any()));
```

**Context**: Breaks circular reference in DataFilter schema (Google Sheets recursive filter structure)

**Risk**: LOW — correct usage. Not a code smell; `z.lazy()` exists specifically for this.

---

## 5. Type Assertions in Schemas — Acceptable

**File**: `src/schemas/format.ts` (3 instances at lines 858, 875, 886)

```typescript
const values = condition['values'] as unknown[];
```

**Context**: Extracting typed arrays from conditional formatting objects where TypeScript inference breaks

**Risk**: LOW — localized to one file, one feature area. Each has a defined purpose.

---

## 6. Handler-Schema Alignment Deviations — TRACKED

**File**: `src/schemas/handler-deviations.ts` (256 lines)

### Tool Deviations

**sheets_core** (documented 2026-02-17):
| Alias in Handler | Maps To (Schema Action) | Justification |
|-----------------|------------------------|---------------|
| `copy_to` | `copy_sheet_to` | Legacy name compatibility |
| `hide_sheet` | `update_sheet` | Convenience alias |
| `show_sheet` | `update_sheet` | Convenience alias |
| `unhide_sheet` | `update_sheet` | Convenience alias |
| `rename_sheet` | `update_sheet` | Convenience alias |
| `update_sheet_properties` | `update_sheet` | Convenience alias |

**Assessment**: All 6 are documented, justified, and tested. Validation script (`validate:alignment`) enforces no undocumented deviations.

### Protocol Deviation

**ISSUE-255**: `isError` flag not always set when `MCP_NON_FATAL_TOOL_ERRORS=true`

- **Control**: Environment variable override available
- **Risk**: Low — only affects error response shape, not data integrity
- **Status**: Intentional behavior; documented with justification

---

## 7. Schema Design Patterns — Quality Assessment

### z.discriminatedUnion() — Used Correctly

- 23 of 25 tools use proper discriminated unions on `action` field
- TypeScript narrows correctly to specific action type in handlers
- Exceptions: `collaborate` (SDK bug), `federation` (z.enum, justified)

### superRefine() — Comprehensive Cross-Field Validation

- 40+ uses across schema files
- Key validations: A1Notation format, GridRange bounds, gradient color values, DataFilter requirements, required field combinations
- All in `src/schemas/shared.ts` primitives (inherited by all tools)

### Default Values — Sensible

```typescript
mode: z.enum(['standard', 'advanced']).default('standard');
iterations: z.number().default(3);
percentiles: z.array(z.number()).default([25, 50, 75]);
hasHeaders: z.boolean().default(true);
timeoutMs: z.number().default(30000);
```

All defaults are sensible, documented, and reduce client-side boilerplate.

### Schema Reuse — Excellent

- 150+ references to `SpreadsheetIdSchema`, `RangeSchema`, `SheetNameSchema` from `shared.ts`
- No duplicate primitive definitions found
- `ColorSchema`, `GridRangeSchema`, `CellReferenceSchema` all centralized

---

## 8. Schema Caching — Performance Optimization

**File**: `src/mcp/registration/schema-helpers.ts`

```typescript
const PREPARED_SCHEMA_CACHE = new Map<string, AnySchema>();
```

- Key: `toolName + ':' + schemaType` (e.g., `'sheets_data:input'`)
- `getCachedPreparedSchema()` — get or compute
- Saves 8-40ms at startup (`zodSchemaToJsonSchema()` is CPU-intensive)
- 42 transformations at startup (25 tools × ~2 schema types)

---

## 9. Zod Version Status

| Metric                | Value                                  |
| --------------------- | -------------------------------------- |
| Version               | `^4.3.6` (pinned in `package.json:58`) |
| MCP SDK compatibility | ✅ MCP SDK v1.28.0 supports Zod v4     |
| Breaking changes      | None detected                          |
| v3 patterns           | None found                             |

No Zod version risk. Running current stable v4.

---

## 10. Output Schema Coverage

- **Defined**: 48 output schema exports across tools
- **Registration**: Passed through tool registration pipeline (`tool-handlers.ts:855, 1436, 1860`)
- **Validation**: Advisory (non-blocking) via `validateOutputSchema()` — `tool-handlers.ts:547-596`
- **Risk**: Output validation is advisory only; malformed responses can reach clients

**Recommendation**: Consider making output validation blocking for critical tools (data.read, core.get) to catch runtime regressions early.

---

## 11. action-metadata.ts Completeness

**File**: `src/schemas/action-metadata.ts` (2,712 lines)

Per-action metadata fields: `readOnly`, `apiCalls`, `quotaCost`, `requiresConfirmation`, `destructive`, `idempotent`, `typicalLatency`, `savings`

**Coverage**: Structure is comprehensive (2,712 lines for 409 actions = ~6.7 lines/action average)

**Usage**: Referenced by BaseHandler for cost estimation in responses, and by LLM hints system

---

## 12. parse() vs safeParse() Usage

**Registration layer** (`src/mcp/registration/`):

- ✅ No unsafe `.parse()` calls detected
- ✅ All schema validation uses `parseWithCache()` (returns `ZodResult`, not throws)
- ✅ `tool-arg-normalization.ts:4` uses `parseWithCache` for defensive validation

---

## Risk Register Summary

| ID    | Issue                                                   | File                  | Severity | Status                                    |
| ----- | ------------------------------------------------------- | --------------------- | -------- | ----------------------------------------- |
| SR-01 | 126+ z.any()/z.unknown() instances                      | multiple              | MEDIUM   | Track; prioritize agent/session/composite |
| SR-02 | collaborate flat schema workaround                      | collaborate.ts        | LOW      | SDK bug; monitor for fix                  |
| SR-03 | Output validation is advisory-only                      | tool-handlers.ts      | LOW      | Consider hardening for critical tools     |
| SR-04 | Missing .strict() on most schemas                       | multiple              | LOW      | Optional hardening                        |
| SR-05 | sheets_core handler aliases undocumented in type system | core.ts               | LOW      | Documented in deviations file             |
| SR-06 | ISSUE-255 isError omission                              | handler-deviations.ts | INFO     | Controlled via env var                    |
