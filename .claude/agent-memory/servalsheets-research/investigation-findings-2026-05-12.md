---
name: investigation-findings-2026-05-12
description: Three targeted investigations - check:drift hang, DEFER_DESCRIPTIONS behavior, and prompt count resolution with root causes and fix paths
metadata:
  type: project
---

# Three Investigations (Session 131, 2026-05-12)

## Investigation 1: check:drift Hang

**Status:** ROOT CAUSE IDENTIFIED

**Location:** `scripts/check-metadata-drift.sh:40` + `scripts/generate-metadata.ts:318`

**Issue:** `npm run check:drift` times out (60s) on systems with large schema files.

**Root Cause:** TypeScript Compiler API in `generate-metadata.ts` calls `ts.createSourceFile()` and recursively traverses AST via `visitNode()` (line 292) using `ts.forEachChild()` for all 25 schema files. Files like `analyze.ts` (2434 lines, 26-action discriminated union), `composite.ts` (1712 lines), and `action-metadata.ts` (2775 lines) cause the recursive tree walk to become expensive, exceeding the 60-second timeout.

**Why it happens:** The AST traversal has no optimization for large discriminated unions. Each `z.discriminatedUnion('action', [item1, item2, ..., item26])` creates a deeply nested AST that the recursive visitor must traverse completely.

**Evidence:**
- `src/schemas/analyze.ts` line 1238-1275: 26-action discriminated union
- `src/schemas/composite.ts`: 1712 lines with nested schema objects
- Script calls `_run_with_timeout 60 node --import tsx scripts/generate-metadata.ts --validate` (check-metadata-drift.sh:40)
- `.serval/state.md` line 108: Known issue documented "npm run check:drift hangs/times out"

**Fix Complexity:** Medium (< 1 day)

**Concrete Fix Path:**
1. Add regex-based fallback for files >1MB in `generate-metadata.ts` (around line 314-345)
   - Use simple pattern: `/z\.literal\('([^']+)'\)/g` for discriminated unions
   - Use pattern: `/z\.enum\(\[([^\]]+)\]\)/g` for enum patterns
   - Only applies to files that cause timeout; most files still use AST
2. Increase timeout from 60s to 120s in `scripts/check-metadata-drift.sh:40` as secondary guard
3. Add comment explaining performance issue with large unions
4. Test with current schemas to confirm <30s completion

**Files to edit:**
- `scripts/check-metadata-drift.sh` (timeout)
- `scripts/generate-metadata.ts` (regex fallback)

---

## Investigation 2: DEFER_DESCRIPTIONS Behavior

**Status:** FULLY CHARACTERIZED

**Key Finding:** Only two description tiers exist (minimal ~100 chars, full 200-500+ chars). No medium tier.

**Implementation Details:**

**Activation:**
- File: `src/config/constants.ts:282-290`
- Env var: `SERVAL_DEFER_DESCRIPTIONS=true`
- Auto-detection: STDIO (Claude Desktop) → true, HTTP → false

**When DEFER_DESCRIPTIONS=true:**
- Uses `TOOL_DESCRIPTIONS_MINIMAL` from `src/schemas/descriptions-minimal.ts`
- Example (sheets_auth): ~100 chars vs full: 200+ chars
- Saves ~7,700 tokens per comment at `src/mcp/registration/tool-definitions.ts:84`

**Usage in tool registration:**
- File: `src/mcp/registration/tool-definitions.ts:88-91`
- Function: `getDescription(toolName: string): string`
- Line 89: Returns `TOOL_DESCRIPTIONS_MINIMAL[toolName]` if deferred, else `TOOL_DESCRIPTIONS[toolName]`

**Current tier breakdown:**
- Minimal (DEFER_DESCRIPTIONS=true): 17 lines, ~100-150 chars per tool
- Full (default): 1181 lines, 200-500+ chars per tool

**Adding medium tier (250-300 chars) would require:**
1. Create `src/schemas/descriptions-medium.ts` with 25 tool descriptions (250-300 chars each)
2. Change env var to `SERVAL_DEFER_DESCRIPTIONS` value enum: 'none' | 'medium' | 'full'
3. Update `src/config/constants.ts` to parse the enum value
4. Update `getDescription()` in tool-definitions.ts to handle three tiers
5. Estimated effort: 2-3 hours (mostly manual description trimming)

---

## Investigation 3: Prompt Count Resolution

**Status:** ROOT CAUSE IDENTIFIED, STRAIGHTFORWARD FIX

**Contradiction:** dx.yaml says 40 prompts, protocol.yaml says 42 prompts (both 2026-05-12)

**Actual Count:** 40 prompts registered

**Evidence:**

1. **Registration count (source of truth):** `src/mcp/registration/prompt-registration.ts`
   - Grep count: `server.registerPrompt(` appears **40 times** in file
   - Prompts: welcome, test_connection, first_operation, full_setup, auto_analyze, compare_spreadsheets, analyze_with_history, performance_audit, clean_data, automated_data_cleaning, masterclass_data_quality, import_data, bulk_import_data, advanced_data_migration, migrate_spreadsheet, generate_sheet_from_description, batch_optimizer, data_pipeline, diagnose_errors, recover_from_error, undo_changes, masterclass_formulas, masterclass_performance, setup_collaboration, audit_security, safe_operation, audit_sheet, publish_report, create_visualization, create_report, what_if_scenario_modeling, cross_spreadsheet_federation, smart_suggestions_copilot, instantiate_template, transform_data, setup_budget, scenario_multi_user, challenge_quality_detective, connector_setup, connector_data_pipeline

2. **Catalog metadata count:** `src/resources/prompts-catalog.ts`
   - File structure: 10 buckets with prompts arrays
   - Total entries in buckets: 42 (includes duplicates)
   - Duplicates found:
     * `full_setup` in both `first_time` (line 44-46) and `automate` (line 110-111)
     * `analyze_with_history` in both `analyze` (line 56-58) and `visualize` (line 183)
   - Function `getPromptsCatalogCount()` (line 243-250) deduplicates using Set, should return 40

3. **Why YAML files differ:**
   - dx.yaml: Reports 40 (correct, matches registration)
   - protocol.yaml: Reports 42 (incorrect, counts bucket entries without deduplication)

**Root Cause:** protocol.yaml was generated by summing bucket sizes (4+4+3+4+4+3+2+5+5+2+8+2=42) instead of using `getPromptsCatalogCount()` which applies Set deduplication.

**Fix Complexity:** Trivial (< 1 hour)

**Concrete Fix Path:**
1. Open `src/resources/prompts-catalog.ts`
2. Remove `full_setup` from `automate` bucket (lines 110-111) — keep it only in `first_time` where it's conceptually primary
3. Remove `analyze_with_history` from `visualize` bucket (line 183) — keep it only in `analyze` bucket
4. Verify with Node: `node -e "const {getPromptsCatalogCount} = require('./src/resources/prompts-catalog.ts'); console.log(getPromptsCatalogCount());"`
5. Regenerate protocol.yaml to report 40

**Files to edit:**
- `src/resources/prompts-catalog.ts` (remove 2 duplicate entries)
- `protocol.yaml` (regenerate with correct count)

**Why this matters:** dx.yaml and protocol.yaml should be identical for this count. Having different values creates confusion for CLI tools and documentation generators that consume these files as sources of truth.

---

## Summary Table

| Investigation | Root Cause | Fix Complexity | Priority |
|---|---|---|---|
| check:drift hang | AST recursion too slow for 26-action unions | Medium (regex fallback) | High — blocking CI |
| DEFER_DESCRIPTIONS | Only 2 tiers exist, no medium tier | Medium (add tier) | Low — feature request |
| Prompt count | Catalog has duplicates, metadata counts them | Trivial (dedup) | High — metadata integrity |

