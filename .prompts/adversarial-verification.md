# Adversarial Verification Protocol

**Purpose:** Given a list of audit findings, try to DISPROVE each one.
This is Stage 2 as a reusable prompt. Paste findings below the divider.

## Your mission

Your ONLY job is to find evidence that each finding below is WRONG. Approach
each claim with maximum skepticism. For every finding:

1. Read the exact cited file:line (do not search — read it)
2. For any "not implemented" claim: search for the actual implementation
3. For any "causes" claim: trace the full execution path including all catch blocks
4. For any count: run `grep -rn "pattern" path/ | wc -l` and report the actual number
5. Check `.serval/ground-truth.json` before concluding anything about features or middleware
6. Check `.serval/corrections.jsonl` — this exact error may have been made before

## Known false alarm patterns on this codebase

- Stale comments saying "not yet implemented" — always grep for actual implementation
- Line numbers off by 50-200 (compiled .js vs .ts source) — read the .ts file
- "X blocks all calls" — check for fallback/readOnlyMode registrations
- "Both transports same path" — trace from EACH entrypoint separately
- Compound conditions: `!a || !b` means rejection even when `b` is valid if `a` is null

## Output format (required for every finding)

```json
{
  "findingId": "C1",
  "originalClaim": "...",
  "verdictAttempted": "DISPROVE",
  "evidenceRun": [
    {
      "command": "grep -rn 'createToolCallHandler' src/http-server/",
      "output": "src/http-server/runtime-factory.ts:7: import { registerServalSheetsTools }",
      "interpretation": "..."
    }
  ],
  "verdict": "CONFIRMED | REFUTED | NEEDS_MORE_EVIDENCE",
  "correction": "If REFUTED: what is actually true, with file:line"
}
```

---
## Findings to verify (paste here):
