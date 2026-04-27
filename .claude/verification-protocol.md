# Verification Protocol — ServalSheets

Injected automatically into analysis/audit agents. Non-negotiable.

## Before reporting any specific claim, run the corresponding command:

| Claim type | Required command | What to show |
|---|---|---|
| "Line N contains X" | `Read(file, offset=N-2, limit=8)` | Actual line content |
| "There are N instances" | `grep -rn "pattern" path/ \| wc -l` | Exact stdout number |
| "X is not implemented" | `grep -rn "X\|alternate" src/` | Empty results as proof |
| "Y causes Z" | Read every conditional/catch between Y and Z | Full path shown |
| "Comment says X is current" | `grep -rn "described_fn" src/` | Find actual implementation |
| "Feature X is missing" | Read `.serval/ground-truth.json` first | Registry status field |
| "N test failures" | Run the test command | Actual test runner output |
| "Middleware A not in STDIO" | Check `handler-dispatch.ts` and `build-server-stdio-tool-runtime.ts` | Trace both paths |

## Known error patterns on THIS codebase (from .serval/corrections.jsonl):

1. **Stale comment trusted**: features-2025-11-25.ts had "not yet wired" comment for completions — 
   the handler WAS wired at control-plane-registration.ts:93. Always grep for the implementation.

2. **Synthesized line numbers**: Line 79/112 of execute-stdio-tool-call were cited as containing 
   specific code — they were interface field declarations. Always Read(file, offset=N-2, limit=8).

3. **Partial evidence anchoring**: DUMMY_WEBHOOK_SECRET "allows requests" — missed the 
   `!secret || !isValid` compound check two lines later. Read the FULL function.

4. **Transport assumption**: One agent claimed "both transports use same middleware chain" by reading 
   tool-handlers.ts without verifying which transports call it. Trace from the entrypoint.

## Two-Phase Rule

Phase 1 (evidence collection — NO conclusions):
- Run all grep/read/count commands
- Collect ALL output before interpreting any

Phase 2 (analysis — conclusions from Phase 1 only):
- Every conclusion MUST cite a Phase 1 evidence item
- Label: CONFIRMED (code read) | INFERRED (pattern) | [UNVERIFIED]

## Evidence format for every finding:

```
CLAIM: [assertion]
COMMAND: $ grep -rn "pattern" src/ | head -5
OUTPUT: [actual stdout]
VERDICT: CONFIRMED | REFUTED | [UNVERIFIED]
```
