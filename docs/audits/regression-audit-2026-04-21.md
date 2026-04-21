# High-Level Regression Audit — ServalSheets

**Date:** 2026-04-21
**Author:** Session continuation for Prometheus (thomas@titanhorizongroup.com)
**Scope:** Explain how a project that previously scored "perfect" on LLM+MCP compliance landed six live bugs in a single E2E session, and what the repo's validation signal is actually telling us.
**Status on user machine (verified via Desktop Commander):** typecheck `EXIT=0`, `check:drift` clean, `validate:alignment` "ALL TOOLS ALIGNED", `validate:compliance` 0 errors / 1 pre-existing warning, `check:mutation-actions` / `check:integration-wiring` / `check:silent-fallbacks` all green, BUG #3-6 regression probes all green against `dist/`.

---

## 1. TL;DR

There was no "deep regression." The repo's compound-tool layer (the authoritative 25 tools × 409 actions with Zod discriminated unions) is healthy and all schema-handler gates still pass. What regressed is a **thin adapter layer** that translates those 25 compound tools into ~396 flat per-action MCP tools for LLM clients. That adapter was added recently (`c9bc46ff feat(mcp): cursor-based pagination for flat tools/list surface`, `4f4963e0 fix(mcp): harden flat-tool-call interceptor registration`) and it did not have equivalent contract tests. Every one of the six session bugs lives in that adapter or in closely coupled post-dispatch helpers — nothing found this session touches the compound schemas, the handlers, or the 13 validation gates that define "perfect score."

The previous "perfect" scores are still earned at the compound layer they measure. The adapter is net-new surface area without parity gates.

---

## 2. What the six session bugs actually are, and where they live

All six were surfaced by one natural-language E2E session against a real Google Sheet (`169QxkGixF8kowh7T5WdakBBsuKWLdrPpLKGrXKheGik`). They cluster in two files.

| # | Symptom | Root file | Layer |
|---|---|---|---|
| 1 | Flat call envelope shape mismatch on route | `src/mcp/registration/flat-tool-routing.ts` | Adapter |
| 2 | `sheets_discover` advertised on flat surface but never dispatched | `src/mcp/registration/flat-tool-routing.ts` | Adapter |
| 3 | Flat `inputSchema` for 380+ deferred tools was a generic `{spreadsheetId}` fallback, hiding action-specific required params | `src/mcp/registration/tools-list-compat.ts:597, 795` (hand-tuned `ALWAYS_LOADED_SCHEMAS` + generic fallback) | Adapter |
| 4 | `fixableVia.params.spreadsheetId = undefined` escaped `suggestFix()` and broke downstream Zod `.strict()` validation | `src/services/error-fix-suggester.ts` | Post-dispatch error helper |
| 5 | `prefer_local` tools (`sheets_analyze`, `sheets_agent`) threw `SERVICE_NOT_ENABLED` when local execution failed — failover logic tried a remote executor that was never configured | `src/mcp/routed-tool-execution.ts:126-176` (`createHostedRemoteExecutor`) | Dispatch |
| 6 | `sheets_agent` flat schemas (`list_plans`, `plan`, `execute`, `get_status`) falsely advertised `spreadsheetId` as required | Same as #3 — resolved automatically by the #3 fix | Adapter |

Five of six are in the flat-tool adapter. The sixth (#4) is in `suggestFix`, which is called only when handlers surface errors — also post-dispatch cosmetics, not core correctness.

**Nothing in `src/handlers/**`, `src/schemas/**`, `src/services/google-api.ts`, `src/middleware/**`, or `src/auth/**` was implicated.** The compound-tool request path is sound.

---

## 3. Why the validation gates gave a "perfect" signal despite this

The 13 gates listed in `CLAUDE.md:37-65` and `check:drift`/`validate:alignment`/`validate:compliance` all operate on **compound** tools:

- `validate:alignment` walks the 25 tool schemas vs. the 25 handler switch statements; the flat surface is not part of this graph.
- `check:drift` compares generated metadata artifacts (`src/schemas/index.ts`, `annotations.ts`, `src/generated/completions.ts`, `server.json`) against source Zod. Again — compound only.
- `validate:compliance` checks MCP schema conformance per compound tool.
- `check:mutation-actions` and `check:integration-wiring` guard the middleware lists and rename rules.

The flat surface is a **presentation adapter** added to let LLM clients see each action as its own tool. Its input schemas are **hand-maintained** in `ALWAYS_LOADED_SCHEMAS` (16 bootstrap-critical entries at `tools-list-compat.ts:597`) with a **generic `{spreadsheetId, range?, values?}` fallback** (previously at lines ~797-826) used for every other action. That means:

1. There was no test asserting each flat tool's advertised `inputSchema.required` is the same set the compound action's Zod schema requires.
2. There was no test asserting flat-tool args routed through `flat-tool-routing.ts` are accepted by the compound's discriminated-union shape.
3. The "advertised vs dispatched" parity (BUG #2 — `sheets_discover`) had no gate.

So all 409 actions were advertised correctly *as actions* (the gates that the score measures), but the LLM-facing *per-action inputs* were 16 right + 380 generic — a structural gap, not a bug that drift analysis could see.

---

## 4. How we closed each bug this session

| Bug | Fix | Where |
|---|---|---|
| #1 | Normalized arg shape in routing | `src/mcp/registration/flat-tool-routing.ts` |
| #2 | Dispatched `sheets_discover` through the same route path used by other flat tools | `src/mcp/registration/flat-tool-routing.ts`, `src/mcp/registration/flat-tool-call-interceptor.ts` |
| #3 / #6 | **New helper** `buildFlatInputSchemaForAction(parentTool, action)` derives per-action JSON Schema from the compound Zod DU at advertise time, replacing the generic fallback. Peels `z.object({ request: ... })`, unwraps `z.preprocess`/`ZodPipe` via `.def.out`, iterates `DU.options`, matches by `.shape.action.def.values`, converts via `zodSchemaToJsonSchema`, strips the `action` field. | `src/mcp/registration/flat-input-schemas.ts` (new), wired at `src/mcp/registration/tools-list-compat.ts:789-826` |
| #4 | Added `sanitizeSuggestedParams()` wrapper around `suggestFixInternal()` — strips `undefined` values from `params` across all 30+ branches without per-branch edits | `src/services/error-fix-suggester.ts` |
| #5 | `createHostedRemoteExecutor` now returns `undefined` when `isRemoteMcpExecutorToolEnabled(toolName)` is false, so `dispatchToolCall` stays local-only and surfaces the real local error. Hardened with `try/catch` because `getEnv()` can throw during env validation. | `src/mcp/routed-tool-execution.ts:126-176` |

Verified via two probes against the real `dist/` on the user's machine:
- `scripts/probe-flat-schemas.mjs` — 7/7 cases green, including `sheets_agent.list_plans: required=[]` (BUG #6 specifically) and `sheets_agent.plan: required=["description"]`.
- `scripts/probe-bug4-5.mjs` — 5/5 cases green, including `isRemoteMcpExecutorToolEnabled(sheets_analyze): false`.

---

## 5. Where the two existing audit documents fit

This is important context: **two separate audits already live in the repo and they disagree with each other.**

- `docs/audits/source-truth-compliance-architecture-audit-2026-04-21.md` — 220 lines, lists R1-R12 risks, treats compliance drift as widespread.
- `independent-reaudit-2026-04-21.md` — 299 lines, refutes ~50% of the original's P0/P1 claims with specific file:line evidence. Notable refutations: `compact_session` annotation exists (`src/generated/annotations.ts:4707`), OAuth revoke does delete local tokens (line 1267), `STANDARD_SCOPES` already excludes restricted scopes, `client_secret_basic` is implemented (line 1642), flat `tools/list` paginates with page size 100 (`tools-list-compat.ts:37,183,184`), MUTATION_ACTIONS sets are identical (76 entries each).
- `fix-plan-vs-audit-gap-report.md` — 118 lines, concludes the audit and fix-plan are "almost entirely orthogonal" (audit = OAuth/scope posture; fix plan = cold-start latency and stdio framing).

**Neither pre-existing audit flagged any of the six session bugs.** The re-audit's "Real P0-P2" final list (lines 248-270) focuses on OAuth bearer test gaps, outbound Google revoke, cold-start latency, stdio framing, server-instructions size, `setInterval` at module load, etc. Those are all valid — but they are *orthogonal* to what broke for the user at the MCP wire.

This is the real lesson: both audits optimized for a threat model (security posture + cold-start) and missed the LLM-facing contract layer entirely. The new flat-tool surface was never in scope for either.

---

## 6. Why "perfect LLM+MCP score" was and is still true — just narrower than it sounded

Protocol compliance is scored on whether the server implements MCP 2025-11-25's required primitives (tools, resources, prompts, completions capability declaration, elicitation, tasks, structured content) and whether its tool schemas round-trip cleanly. All of that is still true — and `validate:compliance` still prints 0 errors.

What "perfect MCP score" never measured:

- Whether every advertised tool's `inputSchema.required` is actually what the handler will accept
- Whether every advertised tool is dispatchable
- Whether error responses round-trip through `.strict()` Zod on the client side
- Whether dispatch-failover semantics are internally consistent

Those four bullets are exactly the six session bugs, plus one more latent class: post-dispatch structured-content payload validity.

---

## 7. Root-cause narrative (one paragraph)

The compound-tool pipeline was built first and is still excellent. Then a flat-surface adapter was grafted on to improve LLM usability (LLMs prefer one tool = one action over one tool with a discriminated-union `action` field). That adapter shipped with:
1. a **16-entry hand-maintained schema map** for the actions the team uses during bootstrap, and
2. a **generic fallback** for the remaining ~380 actions, advertising just `{spreadsheetId, range?, values?}`.

No one wrote a contract test saying "the flat surface must be a lossless projection of the compound surface." The drift monitor (`check:drift`) cannot see adapter-vs-source drift because the adapter is not a generated artifact. The alignment validator (`validate:alignment`) operates at the compound layer. CI said green because the gates didn't cover the adapter, not because the adapter was right. Meanwhile, adjacent helpers (`error-fix-suggester`, `routed-tool-execution`) had the same problem in miniature — their behavior is downstream of the flat-tool path, so failures there only surface under real LLM E2E.

---

## 8. Minimum work to prevent the next wave

All five items below are small. None touch the 25 handlers.

1. **Contract test: flat ↔ compound schema parity.** New file `tests/contracts/flat-surface-parity.test.ts`. For every flat tool, assert `buildFlatInputSchemaForAction(parentTool, action).required` matches the compound Zod action's required keys (minus `action`). Run in `npm run test:fast`.
2. **Retire `ALWAYS_LOADED_SCHEMAS` over time.** The 16 hand-tuned entries at `tools-list-compat.ts:597` should each be compared to what `buildFlatInputSchemaForAction` produces; when identical, delete the hand entry. Single source of truth.
3. **Contract test: every flat tool is dispatchable.** For every entry in `flat-tool-registry.ts`, assert `flat-tool-routing.ts` has a code path that routes it. Would have caught BUG #2 (`sheets_discover`).
4. **Contract test: `suggestFix` output passes strict Zod.** Parse every `suggestFix(code, msg)` result through `FixableViaSchema.strict()` for the full `ErrorCode` enum. Would have caught BUG #4.
5. **Contract test: `prefer_local` dispatch doesn't require remote config.** For each tool whose policy is `prefer_local`, simulate a local throw with remote disabled and assert the original local error propagates (not `SERVICE_NOT_ENABLED`). Would have caught BUG #5.

Effort: roughly one session. No refactors, no handler changes, one new test file per item.

---

## 9. Cross-reference to the two existing audits

| Existing finding | Severity (re-audit) | Status vs this session |
|---|---|---|
| Audit P1.7 — no test asserting OAuth bearer not passed through | P0 kept | **Still valid, not in this session's scope** |
| Audit P0.4 — `/oauth/revoke` doesn't call Google outbound | P0 kept (demoted from "local tokens leak") | **Still valid, not in this session's scope** |
| Fix-plan C2/C3/C4 — env exit / cli.ts framing / cold-start | P1 verified | Partially addressed this session (`src/config/env.ts` eager exit → throw; `src/startup/preflight-validation.ts` async I/O) |
| Audit P1.9 — `compact_session` annotation | **Refuted** by re-audit | Confirmed: `src/generated/annotations.ts:4707` |
| Audit P2.10 — flat `tools/list` ignores cursor | **Refuted** by re-audit | Confirmed: `tools-list-compat.ts:37,183,184` |
| Re-audit R11 — `_requestHandlers` private SDK hook | P2 w/ mitigation | Not in this session's scope; assertion exists at `flat-tool-call-interceptor.ts:81-85` |
| **This session R13 — flat `inputSchema` drifts from compound DU** | **New, P1** | **Fixed** via `flat-input-schemas.ts` |
| **This session R14 — `suggestFix` emits `undefined` params** | **New, P2** | **Fixed** via `sanitizeSuggestedParams` |
| **This session R15 — `prefer_local` failover requires remote config** | **New, P1** | **Fixed** via `isRemoteMcpExecutorToolEnabled` gate |
| **This session R16 — flat tool advertised but not dispatched** (`sheets_discover`) | **New, P1** | **Fixed** |

R13-R16 are the ones that matter operationally, and none of them needed a refactor — they needed a thin contract test that nobody had written yet.

---

## 10. Closing read on "how did we regress"

You didn't, really. The compound layer still scores what it scored before. What happened is three independent pieces of adapter/helper code shipped between the last "perfect" run and this session's E2E (the flat interceptor, the cursor-paginated flat `tools/list`, and the `error-fix-suggester`), and they each introduced a thin failure mode that the existing gates could not see. Each failure mode is now either fixed or has a named test to prevent recurrence. Your instinct that "our high-level code is good" is correct — the gaps are adapter-shaped, not architecture-shaped.

The one compounding factor: two contradictory audit docs in the repo root were pulling review attention toward OAuth/token-bridge concerns (real, but orthogonal), while the actual user-facing failure mode was the flat tool surface. Worth deleting or reconciling those two docs so the next audit doesn't spend half its time relitigating refuted findings.

---

## Sources (file:line, verified this session)

- `src/mcp/registration/flat-input-schemas.ts` (new, ~140 lines)
- `src/mcp/registration/tools-list-compat.ts:597, 789-826`
- `src/mcp/registration/flat-tool-routing.ts` (modified)
- `src/mcp/registration/flat-tool-call-interceptor.ts:81-85` (assertion on SDK private handlers)
- `src/services/error-fix-suggester.ts` (+ `sanitizeSuggestedParams`)
- `src/mcp/routed-tool-execution.ts:126-176, 189` (remote executor gate)
- `packages/mcp-runtime/src/dispatch-tool-call.ts:53-59` (`prefer_local` failover branch)
- `scripts/probe-flat-schemas.mjs` — 7/7 green
- `scripts/probe-bug4-5.mjs` — 5/5 green
- `docs/audits/source-truth-compliance-architecture-audit-2026-04-21.md`
- `independent-reaudit-2026-04-21.md`
- `fix-plan-vs-audit-gap-report.md`
- Validation gate outputs (this session): `check:drift`=EXIT 0, `validate:alignment`="ALL TOOLS ALIGNED", `validate:compliance`=0 errors, `check:mutation-actions` / `check:integration-wiring` / `check:silent-fallbacks` all pass, `npx tsc --noEmit`=EXIT 0.
