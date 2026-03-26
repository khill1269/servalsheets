---
title: Phase 12 Rebaseline
category: audit
last_updated: 2026-03-24
description: Reclassification of the original 29 Phase 12 findings after the P0-P4 reliability and contract hardening slices landed.
version: 2.0.0
---

# Phase 12 Rebaseline

This rebaseline replaces the old assumption that all 29 Phase 12 findings were still current.
It reflects the code changes that landed in the optimization execution plan through 2026-03-24.

## Summary

| Status | Count | Meaning |
| --- | ---: | --- |
| Fixed in code | 13 | Root cause addressed and covered by targeted tests |
| Fixed in code, pending live verification | 2 | Code path changed materially, but the original live workbook path still needs re-run proof |
| Still open / partially addressed | 11 | No direct fix landed yet, or only a cascade was reduced |
| Feature gate / definition gap | 3 | Not a current runtime defect in the same sense as the original audit framed it |

## Reclassified Findings

| Bug # | Original finding | Current status | Notes |
| --- | --- | --- | --- |
| 1 | `core.describe_workbook` timeout | Fixed in code | Added bounded workbook analysis with `maxSheets` and truncation metadata. |
| 2 | `core.workbook_fingerprint` timeout | Fixed in code | Now metadata-only; removed the expensive value fetch path. |
| 3 | `session.update_preferences` silent no-op | Still open / partially addressed | Not reverified in this pass; treat as unresolved until a live repro or targeted regression confirms behavior. |
| 4 | `core.clear_sheet` intermittent timeout by `sheetName` | Still open / partially addressed | Reset semantics were improved, but the original `sheetName` timeout path was not directly reverified. |
| 5 | `composite.smart_append` stale row pointer | Fixed in code | Append target is now computed explicitly from live sheet values. |
| 6 | `fix.clean` acronym false positives | Still open / partially addressed | Cleaning-rule intelligence pass has not landed yet. |
| 7 | `fix.suggest_cleaning` phone false positive on ISO dates | Still open / partially addressed | Same rule-engine gap as Bug 6. |
| 8 | `fix.suggest_cleaning` number false positive on Date columns | Still open / partially addressed | Same rule-engine gap as Bug 6. |
| 9 | `transaction.commit` timeout | Fixed in code, pending live verification | Commit is now task-capable, timeout-enforced, and keepalive-aware; Claude Desktop/HTTP proof is still the remaining open verification step. |
| 10 | `format.generate_conditional_format` cannot parse cross-column comparisons | Still open / partially addressed | No CUSTOM_FORMULA/NL cross-column parser slice landed yet. |
| 11 | `format.apply_preset` alternating rows conflicts with prior banding | Still open / partially addressed | Sheet reset now clears banding when explicitly used, but preset-level idempotent banding behavior is not fixed yet. |
| 12 | `format.suggest_format` rejects `sheetName` | Fixed in code | Added compatibility normalization for the documented `sheetName` path. |
| 13 | `visualize.chart_create` anchor cell bounds not prevalidated | Fixed in code | Charts and slicers now fail early on out-of-bounds anchors. |
| 14 | `compute.statistical` / `regression` header resolution drift | Fixed in code | Added `hasHeaders` / `headerRow` semantics and header resolution helper. |
| 15 | `compute.batch_compute` nested A1 range rejection | Still open / partially addressed | No nested range normalization slice has landed yet. |
| 16 | AI actions fail without `ANTHROPIC_API_KEY` | Feature gate / definition gap | This is now treated as a sampling/configuration gate, not a generic runtime bug, but it still needs clean UX verification. |
| 17 | `agent.plan` expects `description` instead of `goal` | Still open / partially addressed | Planner hardening landed, but the input alias itself has not been normalized yet. |
| 18 | `agent.execute_step` rejects numeric step ID | Fixed in code | Current agent schema already supports the numeric path; this finding is stale. |
| 19 | `agent.plan` malformed params / workbook-timeout root cause | Fixed in code, pending live verification | `scoutResult` bypass and step validation landed; the large-workbook live planning path still needs re-run proof. |
| 20 | `confirm.wizard_start` rejects field type `string` | Fixed in code | Added compatibility alias from `string` to `text`. |
| 21 | `confirm.get_stats` ignores wizard completions | Feature gate / definition gap | This is currently a product-definition mismatch, not an established runtime regression. |
| 22 | `collaborate.version_list_revisions` timeout | Fixed in code | Revision scans now stream/short-circuit instead of loading entire histories. |
| 23 | `advanced.list_protected_ranges` omits sheet protections | Fixed in code | Protection scope now preserves `range`, `sheet`, and `named_range`, with `unprotectedRanges` when present. |
| 24 | `advanced.create_table` blocked by residual banding | Still open / partially addressed | Improved sheet reset reduces the cascade, but table-level banding preflight is still not implemented. |
| 25 | `history.timeline` timeout | Fixed in code | Timeline pagination is now limit-aware and short-circuits when enough revisions are available. |
| 26 | `session.save_checkpoint` requires `ENABLE_CHECKPOINTS=true` | Feature gate / definition gap | This is an intentional environment gate unless product policy changes. |
| 27 | `templates.import_builtin` names undiscoverable | Still open / partially addressed | Builtin-name discoverability still needs an explicit surfaced contract. |
| 28 | `dimensions.sort_range` timeout by `sheetName` | Fixed in code | Sort target resolution now accepts explicit sheet context for bare ranges without relying on stale session state. |
| 29 | `data.find_replace` returns 0 matches for known-present value | Fixed in code | Find-only mode now uses explicit current-sheet/all-sheet scope and returns absolute coordinates. |

## Current Read

The original Phase 12 list materially overstated the remaining defect load after the recent slices.
The highest-value unresolved items are now narrower:

1. Finish live verification for `transaction.commit` and large-workbook `agent.plan`.
2. Complete the remaining cleaning-intelligence and compatibility work for Bugs 6-8, 10, 15, 17, 24, and 27.
3. Decide whether Bugs 21 and 26 are product-policy changes or should remain documented gates.

## Net Effect

The Phase 12 audit should no longer be read as "29 current bugs."
The current state is closer to:

- 13 fixed in code
- 2 fixed in code but awaiting live proof
- 11 still open or partially reduced
- 3 reframed as gates or definition mismatches
