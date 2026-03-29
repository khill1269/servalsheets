# ServalSheets Cleanup Plan
> Audit Date: 2026-03-28 | Prioritized by risk × effort × impact

## Executive Summary

ServalSheets is in excellent shape. No critical issues were found. This plan is organized into three tiers: items that should be done immediately (safe, low-effort, high-value), medium-term improvements, and long-term architectural evolution.

**Score before cleanup**: 8.5/10
**Expected score after Immediate tier**: 9.2/10

---

## Tier 1: Immediate (Safe, Low-Effort, High-Value)

These are clear wins: either they remove waste or fix demonstrable drift. All are safe to do without tests or review.

### 1.1 Remove Root-Level Build Artifacts

**Files**: `servalsheets-v2-clean.tar.gz` (342 MB), `servalsheets.mcpb` (84 MB), `servalsheets-2.0.0.tgz` (5.2 MB)

**Why**: These ARE listed in `.gitignore` (lines 146, 147, 303) but are present in the working tree. They add 431MB of friction to every IDE scan, file watcher, and search tool.

**Action**:
```bash
rm "servalsheets-v2-clean.tar.gz" "servalsheets.mcpb" "servalsheets-2.0.0.tgz"
```

**Risk**: Zero — these are build artifacts already excluded from git tracking.

---

### 1.2 Clean .serval/ Metadata Bloat

| File | Size | Issue |
|------|------|-------|
| `.serval/plans/.fuse_hidden*` (62 files) | ~100 KB | macOS temp files from aborted file operations |
| `.serval/audit-comprehensive-2026-03-22.md` | 30 KB | Old audit superseded by this one |
| `.serval/codebase-manifest-report.txt` | 21 KB | Duplicate of manifest |
| `.serval/audit-findings-session103.md` | 9 KB | Old session artifact |
| `.serval/research-delta-session103.md` | 13 KB | Old session artifact |

**Action**:
```bash
rm .serval/plans/.fuse_hidden* 2>/dev/null || true
rm .serval/audit-comprehensive-2026-03-22.md
rm .serval/codebase-manifest-report.txt
rm .serval/audit-findings-session103.md
rm .serval/research-delta-session103.md
```

**Risk**: Zero — these are development metadata, auto-regeneratable.

---

### 1.3 Clean tests/benchmarks/ Historical JSON Snapshots

**Files**: 8 historical JSON files, ~1.5 MB total.

| Files | Size |
|-------|------|
| `tests/benchmarks/action-matrix-v2-2026-03-16T*.json` (7 files) | ~1.2 MB |
| `tests/benchmarks/action-matrix-2026-03-16.json` | ~300 KB |

**Action**: Delete all `*.json` files in `tests/benchmarks/`. Keep all `.ts` benchmark files.
```bash
find tests/benchmarks -name "*.json" -delete
```

**Risk**: Low — these are historical point-in-time snapshots. The `.ts` test files that generate new snapshots are preserved.

---

### 1.4 Fix Prompt Count Documentation Drift

**Issue**: `src/mcp/registration/prompt-registration.ts` registers **40 prompts**. Multiple documentation sources claim **32 prompts**:
- `docs/development/CODEBASE_CONTEXT.md` mentions "38 guided workflows"
- Protocol compliance report claims 40 (verified by code inspection in this audit)

**Action**: Update any references claiming 32 or 38 prompts to say 40.
```bash
grep -rn "32 prompt\|38 prompt" docs/ src/
```

**Risk**: Zero — documentation only change.

---

### 1.5 Add .agent-context/ to .gitignore

**File**: `.agent-context/` directory (44 KB: Claude Code session learning memory)

**Issue**: These are Claude Code workflow artifacts. They should not be tracked in git. Check if currently tracked:
```bash
git ls-files .agent-context/
```

**Action**: Add to `.gitignore` if not already present:
```
# Claude Code session memory
.agent-context/
```

**Risk**: Zero — local development metadata.

---

## Tier 2: Medium-Term (1–4 hours each, measurable quality improvement)

### 2.1 Audit 338 npm Scripts for Orphaned/Duplicate Commands

**Issue**: `package.json` contains **338 scripts** — one of the largest seen in any MCP server. Many were added over 112 sessions without cleanup.

**Target areas**:
- Scripts prefixed `check:` — many may be duplicated by gate commands
- Scripts prefixed `validate:` — verify still-active vs superseded
- Scripts prefixed `audit:` — session-specific scripts that may no longer apply
- Deprecated gate names (G1-G12 vs G0-G5 naming conflict in docs)

**Approach**:
```bash
# Find scripts that reference non-existent files
node -e "const p=require('./package.json'); Object.entries(p.scripts).forEach(([k,v])=>console.log(k,v))" | grep "\.ts\|\.mjs\|\.sh" | while IFS= read -r line; do echo "$line"; done
```

**Expected reduction**: 30–50% of scripts can likely be removed or consolidated.

**Risk**: Low — scripts are invoked manually or by CI. Check `.github/workflows/` references before removing.

---

### 2.2 Fix z.any()/z.unknown() in High-Value Schemas

**Issue**: 126+ instances across 18 schema files (see `schema_risk_register.md` SR-01). Most are justified at external boundaries. Four are improvable with modest effort.

**Priority order** (highest LLM-call risk first):
1. `src/schemas/agent.ts` — step params could use discriminated union by step type
2. `src/schemas/session.ts` — preferences could have typed sub-schemas
3. `src/schemas/composite.ts` — generation results have known shapes
4. `src/schemas/quality.ts` — validation findings have predictable structure

**Effort per file**: 2–4 hours (requires reading handler code to understand actual shapes).

**Risk**: Medium — must verify handler code handles new typed schemas correctly. Run `npm run verify:safe` after each change.

---

### 2.3 Add .strict() to Action*Input Schemas

**Issue**: Only `compute.ts` consistently uses `.strict()` on input schemas. Other tools silently ignore unknown properties.

**Benefit**: Prevents clients from passing extra fields that silently pass validation.

**Action**: Add `.strict()` to all `Action*Input` schemas in discriminated union branches across all 25 tools.

**Automated approach**:
```bash
# Count schemas without .strict()
grep -rn "z\.object({" src/schemas/ | grep -v ".strict()" | wc -l
```

**Risk**: Low — `.strict()` only affects input validation, not existing valid requests.

---

### 2.4 Revert collaborate.ts to z.discriminatedUnion() When SDK Bug is Fixed

**Issue**: `src/schemas/collaborate.ts` uses a flat `z.object()` + `.superRefine()` workaround because MCP SDK v1.26.0 has a bug with large discriminated unions (41+ actions). Current SDK: v1.28.0.

**Action**: Check if SDK v1.28.0+ fixes the discriminated union bug:
```bash
# Check release notes / changelog
cat node_modules/@modelcontextprotocol/sdk/CHANGELOG.md | grep -A5 "discriminated"
```

If fixed, revert `collaborate.ts` and run `npm run test:fast` to verify.

**Risk**: Low — test suite covers this at `tests/contracts/collaborate-discriminated-union.test.ts`.

---

### 2.5 Split tool-discovery-hints.ts (2,530 LOC)

**File**: `src/mcp/registration/tool-discovery-hints.ts` (2,530 lines, 94 KB)

**Issue**: Single-file hints table for all 25 tools. Hard to navigate and review. This is a data-heavy file with predictable per-tool structure.

**Proposal**: Split into per-tool hint files in `src/mcp/registration/hints/`:
```
hints/
  sheets_data.ts
  sheets_format.ts
  sheets_analyze.ts
  ... (25 files)
  index.ts  (re-exports TOOL_DISCOVERY_HINTS)
```

**Benefit**: Each file ~100 lines. Easier code review, git blame, and per-tool updates.

**Risk**: Low — pure refactor (no behavior change). Must run `npm run verify:safe` and `npm run test:fast`.

---

### 2.6 Make Output Validation Blocking for Critical Tools

**Issue**: `validateOutputSchema()` in `tool-handlers.ts:547-596` is **advisory only** — malformed responses reach clients without error.

**Recommendation**: For the 3 most-critical read actions, make output validation blocking:
- `sheets_data.read`
- `sheets_core.get`
- `sheets_core.get_sheet`

**Approach**: Add a `strict_output_validation: true` flag to action metadata for these three, and check the flag before returning.

**Risk**: Low impact if validation is correct. Medium development risk — need confidence schemas match actual outputs.

---

## Tier 3: Long-Term (Architectural Evolution)

These are not urgent but represent opportunities to reduce maintenance burden as the codebase grows.

### 3.1 Monorepo Boundary Clarity

**Issue**: Several distinct products share the repo root:
- `/ui/tracing-dashboard/` — React/Vite tracing app
- `/add-on/` — Google Sheets Add-on
- `/tools/google-docs-server/` — Separate MCP server
- `/tools/gcloud-console-server/` — Separate MCP server
- `/infra/` — Terraform infrastructure
- The main ServalSheets MCP server (`src/`)

**Proposal**: Each of these products has different release cadences, build tools, and owners. They should be clearly documented as separate projects or moved to separate repositories.

**Minimum viable improvement**: Add a root `WORKSPACE.md` that maps each directory to its product, owner, and release process.

---

### 3.2 Reduce New-Action 8-Step Process to 3–4 Steps

**Current process** (from `CLAUDE.md`):
1. Schema in `src/schemas/{tool}.ts`
2. Handler in `src/handlers/{tool}.ts`
3. Test in `tests/handlers/{tool}.test.ts`
4. `npm run schema:commit`
5. Add to `MUTATION_ACTIONS` if mutating
6. Add to write-lock set if mutating
7. Add cache invalidation rule
8. Write back with `sessionContext.recordOperation()` if wired
9. Add error code if new

**Proposal**: Generate steps 5–7 automatically from the schema annotation:
```typescript
// Schema annotation (new field):
actions: {
  write: { mutates: true, cacheInvalidates: ['sheets_data.read'], sessionRecord: true }
}
```
A code generator reads this and updates `audit-middleware.ts`, `mutation-safety-middleware.ts`, and `cache-invalidation-graph.ts` automatically.

**Risk**: High implementation complexity. Only worth doing if action addition frequency is high.

---

### 3.3 Auto-Generate Flat-Mode Per-Action Schemas from Zod

**Issue**: The 15 always-loaded flat tool schemas in `tools-list-compat.ts` are hand-authored JSON Schema objects. Any schema change in `src/schemas/*.ts` requires manually updating both.

**Proposal**: Add a `schema:commit` step that extracts per-action JSON schemas from the Zod discriminated unions and writes them to `src/generated/flat-tool-schemas.ts`.

**Risk**: Medium — requires reliable Zod→JSON Schema extraction per discriminated union branch (not just top-level).

---

### 3.4 Type-Harden Generated Files

**Issue**: `src/generated/annotations.ts` (10,679 lines) is auto-generated but not type-checked against the `ToolAnnotations` interface at the call site. If `features-2025-11-25.ts` changes the expected shape, the generated file silently drifts.

**Proposal**: Add a TypeScript `satisfies` check at the bottom of the generated file:
```typescript
// At bottom of annotations.ts (generated)
TOOL_ANNOTATIONS satisfies Record<string, ToolAnnotationSet>
```

**Risk**: Low — TypeScript only, no behavior change.

---

## Summary Table

| ID | Item | Tier | Effort | Risk | Blocking? |
|----|------|------|--------|------|-----------|
| C-01 | Remove 431MB build artifacts | Immediate | 1 min | None | No |
| C-02 | Clean .serval/ metadata bloat | Immediate | 2 min | None | No |
| C-03 | Clean benchmarks/ JSON snapshots | Immediate | 1 min | Low | No |
| C-04 | Fix prompt count documentation | Immediate | 30 min | None | No |
| C-05 | Add .agent-context/ to .gitignore | Immediate | 5 min | None | No |
| C-06 | Audit 338 npm scripts | Medium | 2–4 hrs | Low | No |
| C-07 | Improve z.any() in 4 schemas | Medium | 8–16 hrs | Medium | No |
| C-08 | Add .strict() to input schemas | Medium | 4–8 hrs | Low | No |
| C-09 | Revert collaborate.ts if SDK fixed | Medium | 2 hrs | Low | No |
| C-10 | Split tool-discovery-hints.ts | Medium | 2 hrs | Low | No |
| C-11 | Blocking output validation (3 actions) | Medium | 4 hrs | Medium | No |
| C-12 | Monorepo boundary clarity | Long-term | 1 day | Low | No |
| C-13 | Reduce new-action process | Long-term | 2–3 days | High | No |
| C-14 | Auto-generate flat-mode schemas | Long-term | 1–2 days | Medium | No |
| C-15 | Type-harden generated files | Long-term | 2 hrs | Low | No |

---

## What NOT to Change

The following were investigated and confirmed as correct/intentional:

| Item | Verdict |
|------|---------|
| `src/handlers/optimization.ts` | ACTIVE — 21 exports used in hot paths |
| `src/graphql/` | ACTIVE — wired to HTTP admin plane |
| Scaffold adapters (Notion, Airtable, Excel Online) | INTENTIONAL — Phase 3 scaffolds |
| `packages/mcp-http/` vs `src/http-server/` | INTENTIONAL — adapter pattern separation |
| ESLint ignores for agentic-planner, checkpoint-manager, websocket | CORRECT — forward-declarations |
| `.serval/codebase-manifest.json` (2.2 MB) | AUTO-REGENERATED — delete anytime |
| `z.lazy()` in `src/schemas/core.ts:639` | CORRECT — breaks circular reference |
| 8 generic `throw new Error()` in worker files | INTENTIONAL — worker serialization boundary |
| ISSUE-255 (isError flag) | CONTROLLED — env var override available |
