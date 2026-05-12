**Title:** [Audit 2026-04-29] Tool-mode resolution and action-count doc drift — RESOLVED

**Labels:** audit, documentation, completed

---

## Summary

Read-only audit on 2026-04-29 surfaced three findings tied to the user-visible symptom *"server is showing way too many tools"*. All three are now fixed locally; this issue documents the rationale and points at the commits.

The actual user-visible symptom (~270+ flat tools loading instead of 25 compound) was almost certainly `SERVAL_TOOL_MODE=flat` set in the user's MCP client config — server defaults are correct.

## Findings & resolution

### P0-1 — Tautology in `getEffectiveToolMode()` ✅ FIXED
**File:** `src/config/constants.ts:397-400` (pre-fix)

```ts
return isHttp ? 'bundled' : 'bundled';
```

Both branches returned the same value; `isHttp` was dead code. The JSDoc claim *"STDIO → 'bundled', HTTP → 'bundled'"* and `audit/protocol_compliance_report.md:29` (*"Auto: STDIO→flat, HTTP→bundled"*) described behavior the code did not implement.

**Fix:** Simplified to:
```ts
export function getEffectiveToolMode(): 'flat' | 'bundled' {
  if (TOOL_MODE === 'flat') return 'flat';
  return 'bundled';
}
```
Behavior unchanged (auto always resolved to bundled). Dead code removed; JSDoc rewritten to match reality.

### P0-2 — Invalid env values in `.env.quickstart` ✅ FIXED
**File:** `.env.quickstart:9-11`

The quickstart referenced `SERVAL_TOOL_MODE=standard` and described auto-detection that doesn't exist. `'standard'` is not a valid value — `resolveToolMode()` accepts only `'flat'`, `'bundled'`, or unset.

**Fix:** Replaced with the actual valid options + a short explanatory comment.

### P0-3 — Action count drift (407 vs 410) ✅ FIXED
Canonical count is **410** (verified by summing `src/generated/action-counts.ts:ACTION_COUNTS`). Two audit docs claimed 407 in current-state contexts.

**Fixes:**
- `audit/protocol_compliance_report.md` — 407 → 410
- `audit/servalsheets_architecture_report.md` — 407 → 410, also corrected the stale "STDIO→flat" claim

**Not fixed (intentional):** `CHANGELOG.md`, `TASKS.md`, `docs/audits/*` historical files. Per `docs/audits/DOCS_CRAWLER_DEEP_AUDIT_2026-03-24.md`, the docs system tracks **20 different action-count values across 139 references** — that's its own follow-up, not part of this fix.

## Follow-up
- [ ] Add a CI gate that fails when hardcoded counts in *current-state* docs disagree with `src/generated/action-counts.ts:ACTION_COUNT`. (Distinguish current-state from historical via path heuristic, e.g. `CHANGELOG.md` excluded.)
- [ ] (Optional) Add WARN log at startup when `TOOL_MODE === 'flat'` so misconfigurations surface in operator logs.
