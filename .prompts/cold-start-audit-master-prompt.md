# ServalSheets — Cold-Start + Correctness Deep Audit (Master Prompt)

> **Paste this entire file as the opening message of a fresh session.** It is self-contained: you do not need prior conversation history to execute it. Every claim inside must be independently verified against the codebase by the session executing this prompt.

---

## 0. Mission

You are a senior Node.js / TypeScript engineer and MCP protocol specialist. A prior audit identified **23 issues** across a production MCP server (ServalSheets — a Google Sheets MCP with 25 tools and 409 actions). Those findings are **hypotheses until you re-verify them**. Your mission has three parts:

1. **Verify** every issue below by reading the cited `file:line`, reproducing the behavior, and producing evidence that the claim is (a) correct, (b) partially correct with nuance, or (c) stale/wrong.
2. **Fix** each confirmed issue using a minimal-change patch, a failing-then-passing test, and a benchmark where applicable.
3. **Prove** correctness by running the project's own verification pipeline (`npm run verify:safe`) and recording before/after metrics.

**You must use every advanced capability available to you:** parallel subagents (Explore / Plan / general-purpose) for independent investigations, `Bash` for reproduction and benchmarks, `Grep` / `Read` for source-of-truth verification, `TodoWrite` for tracking every issue through the investigate → fix → prove cycle, and `Task` tools for durable long-running work (tests, benchmarks, full verification runs).

The repo root is the current working directory. The project is a TypeScript strict-mode Node.js codebase; you have full read + edit + execute access.

---

## 1. Non-negotiable protocol (from `CLAUDE.md`)

These rules are **hard gates**. Violating any of them means your work is rejected.

1. **Verify before claiming.** Every factual statement requires either `file:line` anchor OR `command → output` evidence. No "approximately", no "around", no hand-wave.
2. **Trace execution paths.** For every hot-path claim, prove reachability from the stdio entrypoint `src/cli.ts` through `packages/mcp-stdio/src/start-stdio-server.ts` to the flagged line.
3. **No fixes without failing proof.** Before writing any fix, produce a failing test or a reproducing script that demonstrates the bug. A fix with no failing baseline is not accepted.
4. **Minimal change policy.** ≤3 `src/` files modified per issue unless tests force more. No refactors while debugging. No rename-only commits bundled with behavior changes.
5. **No silent fallbacks.** Never `return {}` without an error. Use the `ErrorCode` enum; throw typed errors from `src/errors/`.
6. **Schema-handler alignment.** After any schema edit run `npm run schema:commit` (regenerates `action-counts.ts`, `annotations.ts`, `completions.ts`, `server.json`). Deviations must be declared in `src/schemas/handler-deviations.ts`.
7. **Mutation action parity.** Any action rename must update `MUTATION_ACTIONS` (audit-middleware) AND the write-lock set AND cache invalidation graph. Run `npm run check:integration-wiring`.
8. **No documentation-as-deliverable.** Do not create `*_REPORT.md`, `*_ANALYSIS.md`, `*_LOG.md`, `*_SUMMARY.md`. Report findings in chat; ship code changes.
9. **Hardcoded counts are forbidden.** Always reference `src/schemas/action-counts.ts` (re-exported via `src/schemas/index.ts`) for tool/action counts. Never write `25` or `409` literals.

---

## 2. Source of truth (verify these first, every session)

Before investigating any issue, confirm the project baseline by reading these files:

| Metric | Source of truth |
|---|---|
| `TOOL_COUNT`, `ACTION_COUNT` | `src/schemas/action-counts.ts` re-exported by `src/schemas/index.ts` |
| Protocol version | `src/constants/protocol.ts` re-exported by `src/version.ts` |
| `TOOL_ACTIONS` map | `src/mcp/completions.ts` (verified by `tests/contracts/completions-cross-map.test.ts`) |
| `MUTATION_ACTIONS` | `src/middleware/audit-middleware.ts` (parity script: `scripts/check-mutation-actions.mjs`) |
| Tool list | `src/schemas/tool-definitions.ts` — do NOT import in performance-sensitive paths; it pulls the whole schema tree |
| Architecture doc | `docs/development/ARCHITECTURE.md` |
| Live state | `.serval/state.md` (auto-generated) |

Confirm each of these exists and reports the expected count (25 tools, 409 actions, protocol `2025-11-25`). If any drift is detected, halt and run `npm run check:drift` before proceeding.

---

## 3. Investigation protocol — apply to EVERY issue

For each of the 23 issues below, execute this 6-step cycle. Do not skip steps. Record results in your TodoList.

### Step 1 — Reproduce & measure

- `Read` the file at the cited line. If the claim says "line X", verify by opening that exact range.
- `Grep` for the symbol/function to find every usage. The claim is only true if usages match the described behavior.
- For **latency issues**: run `node --prof` or inject `performance.now()` around the claimed hot-path section; record the wall-clock time over 5 runs.
- For **correctness issues**: write a test file (`tests/audit/issue-CN.test.ts`) that demonstrates the bug. It must fail against current `main`.
- For **resource leak issues**: run `node --expose-gc` and `process.memoryUsage()` before/after, or use `heapdump` snapshots.

### Step 2 — Establish source of truth

- For every numeric claim (lines, milliseconds, bytes), cite the measurement command and its output.
- For every behavioral claim, cite `file:line` for the code path.
- Cross-check against `docs/development/ARCHITECTURE.md` — the doc is authoritative for the 4-layer pipeline; if your finding contradicts it, you must explain which is wrong.
- Check `git log --follow -p <file>` for the most recent change that touched the cited lines; note if the issue was introduced recently.

### Step 3 — Root cause

- Trace execution path from entrypoint. For stdio: `src/cli.ts:1` → `installStdioGuard()` → `dynamic_imports` at `cli.ts:99-110` → `packages/mcp-stdio/src/start-stdio-server.ts:23-72` → `packages/mcp-stdio/src/start-stdio-transport.ts:73` (where `server.connect()` fires).
- Identify **why** the code is on the critical path (not just what it does). Often the real fix is moving the call, not rewriting the implementation.
- Check if the issue is masked by another. Example: a 5s timeout isn't observable if an earlier 1.8s blocking call always trips a different bug first.
- Consult `docs/development/CODEBASE_CONTEXT.md` section for the affected module — load ONLY the relevant section, do not read the whole 80KB file.

### Step 4 — Fix design

- Propose the minimal patch (≤3 files). Write `before` / `after` snippets.
- Identify which tests need updating (`tests/**`).
- Check schema-handler alignment: if you touch `src/schemas/**`, plan for `npm run schema:commit`.
- Check `MUTATION_ACTIONS` parity: if the fix renames/adds an action, plan all four update sites (audit-middleware, write-lock-middleware, cache-invalidation-graph, check-integration-wiring script).
- Consider rollback: can the fix be feature-flagged? If yes, gate it (`SERVAL_STARTUP_MODE`, etc.).

### Step 5 — Implement

- Apply edits via `Edit` tool (never `Write` unless the file is new).
- Run `npm run schema:commit` immediately after any schema change — do NOT batch.
- Delegate `npm run verify:safe` to a subagent (returns pass/fail summary without filling your context with 5K lines of output).
- Iterate until green.

### Step 6 — Prove

- Show the failing test now passing.
- Show the benchmark: before/after wall-clock ms (for latency fixes), before/after memory (for leak fixes), before/after correctness (for data integrity fixes).
- Show `npm run verify:safe` passes in the subagent log.
- Commit with message that includes the issue ID, file:line references, and the measured improvement (e.g. `fix(cold-start): move verifyToolIntegrity post-connect — A1 (−1800ms at src/security/tool-hash-registry.ts:46)`).

---

## 4. Required advanced-capability usage

Do not operate this prompt with just `Read` + `Edit`. You must deploy:

### Parallel subagents (single message with multiple `Task` tool calls)
- **Explore agent** (thorough) for each independent investigation. Launch in parallel — 4 agents at once is normal for this audit.
- **Plan agent** after Phase A is complete, to design the Phase B+C rollout sequence before writing code.
- **general-purpose agent** for full `npm run audit:full` runs (produces massive output; keep it out of main context).

### Bash for reproduction
- Cold-start measurement: `time node dist/cli.js --transport stdio <<< '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}'`
- Schema tree size: `wc -l src/schemas/shared.ts src/schemas/action-metadata.ts src/schemas/descriptions.ts src/schemas/tool-definitions.ts`
- Test runs via subagent: never in main context.
- Git archaeology: `git log --oneline -20 <file>`, `git blame -L <start>,<end> <file>`.

### TodoWrite for tracking
Create 23 todo items at session start, one per issue (C1–C4, H1–H9, M1–M7, L1–L3). Mark each through:
`investigating → verified → fix-designed → implemented → proved`.
Only one todo is `in_progress` at a time.

### Checkpoints
After every 5 issues, delegate `npm run verify:safe` to a subagent. Do NOT accumulate 23 unverified patches.

---

## 5. Context — what ServalSheets is (so you can make judgment calls)

- **Runtime:** Node.js + TypeScript strict.
- **Role:** MCP server for Google Sheets with 25 tools and 409 actions. Used via `stdio` (Claude Desktop) and `http` transports.
- **Entrypoint:** `src/cli.ts` (CLI parse) → `packages/mcp-stdio/src/start-stdio-server.ts` (stdio boot) → `packages/mcp-stdio/src/start-stdio-transport.ts:73` (`server.connect(transport)`).
- **Core pipeline:**
  `MCP Request → src/server.ts:handleToolCall() → src/mcp/registration/tool-handlers.ts:createToolCallHandler() → normalizeToolArgs() → Zod validation → handler.executeAction() → src/services/google-api.ts → buildToolResponse() → CallToolResult`
- **Adapter pattern:** `packages/mcp-http` and `packages/mcp-stdio` are product-agnostic transport libraries; `src/http-server/` and `src/cli.ts` are the ServalSheets-specific wiring. Never move code from `src/` into `packages/` unless it has zero ServalSheets imports.
- **Verification pipeline:** `npm run verify:safe` runs typecheck + test + drift check (skips ESLint, which OOMs in ~3 GB environments). `npm run gates` runs the G0–G5 validation gates.

---

## 6. The 23 issues — full enumeration

Each issue has: **ID · severity · file:line · hypothesis · investigation-specific notes · fix reference**. The hypothesis is what a prior audit suspected; you must verify or refute.

### 6.1 Critical — blocks initialize or corrupts protocol

#### C1 · MUTATION_ACTIONS divergence (DATA INTEGRITY)
- **Files:** `src/middleware/audit-middleware.ts`, `src/middleware/write-lock-middleware.ts`
- **Hypothesis:** the two files maintain separate hardcoded lists of mutating action names. A mutation in one but not the other either bypasses the write-lock (race window) or is never audit-logged (compliance gap).
- **Investigate:** extract both sets via a Node one-liner; `diff` them. Check `scripts/check-mutation-actions.mjs` — does it actually enforce parity?
- **Prove the bug:** write a test that calls a mutation action and verifies (a) the write-lock engaged AND (b) the audit log captured it. Run against the divergent action(s).
- **Fix reference:** B1 — extract to `src/schemas/mutation-actions.ts`, re-export from both middleware files, tighten the parity script.

#### C2 · env.ts eager `validateEnv` with 12× `process.exit(1)` at module load
- **File:** `src/config/env.ts:538` (module-load `export let env = validateEnv()`). Exit calls at lines 236, 249, 258, 267, 276, 290, 291, 308, 318, 325, 332, 339, 349.
- **Hypothesis:** a missing env var kills the process before any log reaches stderr → Claude Desktop shows silent hang.
- **Investigate:** reproduce with `env -i node dist/cli.js --transport stdio` (empty env). Capture stderr. Does anything print?
- **Prove the bug:** stderr should be empty or contain a non-JSON fatal line; client-side Claude Desktop should report "server not responding".
- **Fix reference:** A4 — replace eager export with `getEnv()` lazy accessor; A5 — convert `process.exit` to typed `EnvValidationError` throws.

#### C3 · `cli.ts` fatal path uses `console.error` → breaks JSON-RPC framing
- **File:** `src/cli.ts:138-148`
- **Hypothesis:** `console.error('\n❌ FATAL...')` writes plain-text lines that can interleave with JSON-RPC frames on strict clients.
- **Investigate:** verify `stdio-guard.ts` (`src/utils/stdio-guard.ts`) — does it intercept stderr? It should not (guard is stdout-only). Confirm via the file read. Then check whether the `console.error` goes via stderr (safe) or stdout (corruption).
- **Prove or refute:** inject a fatal via `throw new Error('probe')` at top of cli.ts, capture both streams, verify channel.
- **Fix reference:** B6 — replace with `process.stderr.write(JSON.stringify(...) + '\n')`.

#### C4 · Pre-connect chain blocks initialize ~3832 ms
- **Files:** `src/cli.ts:99-110` (dynamic imports), `packages/mcp-stdio/src/start-stdio-server.ts:25` (verifyToolIntegrity), `packages/mcp-stdio/src/start-stdio-server.ts:31` (prepareStdioRuntime), `packages/mcp-stdio/src/start-stdio-transport.ts:73` (server.connect).
- **Hypothesis:** cold-start chain runs 3 major phases before `server.connect()` — 860 ms dynamic imports, 1795 ms tool integrity verify, 997 ms runtime prep.
- **Investigate:** instrument with `performance.now()` at entry and at each phase boundary. Compare against `.serval/state.md` baseline if recorded. Run 5 times, take median.
- **Prove the bug:** median cold-start-to-initialize-response must exceed 3000 ms on a warm machine with no Google creds.
- **Fix reference:** A1 (move verifyToolIntegrity background) + A2 (stream-hash without import) + A3 (defer prepareStdioRuntime).

### 6.2 High — perf / correctness

#### H1 · verifyToolIntegrity loads 25,611 schema lines pre-connect
- **File:** `src/security/tool-hash-registry.ts:46-54` (lazy-imports `tool-definitions.ts`), integrity call at `tool-hash-registry.ts:129-197`.
- **Hypothesis:** the import pulls the full schema tree (`shared.ts` 1836, `action-metadata.ts` 2775, `descriptions.ts` 1181, plus 25 per-tool schemas).
- **Investigate:** `wc -l src/schemas/shared.ts src/schemas/action-metadata.ts src/schemas/descriptions.ts src/schemas/tool-definitions.ts`. Add a `console.time` around the dynamic import.
- **Fix reference:** A2 — stream-hash the compiled `.js` on disk with `createReadStream` + `createHash('sha256')`, no import.

#### H2 · `prepareStdioRuntime` runs 11 heavy steps before connect
- **File:** `packages/mcp-stdio/src/initialize-stdio-runtime.ts:58-155`
- **Hypothesis:** order is ensureToolIntegrityVerified → prepareRuntimePreflight → createOptionalGoogleClient → initializeGoogleRuntime → initializeBuiltinConnectors → initializeBilling → registerTools (25×) → registerCompletions → registerResources → registerPrompts → registerTaskCancelHandler → registerLogging — all before `server.connect`.
- **Investigate:** read the file; confirm each step; measure each with `recordStartupPhase` wrappers already in `src/startup/startup-profiler.ts`.
- **Fix reference:** A3 — register tool names + empty schemas synchronously pre-connect; defer hydration to first-call via `queueMicrotask` + `hydrateOnce()` debounce.

#### H3 · Preflight-validation synchronous 5 s Google API reachability check
- **File:** `src/startup/preflight-validation.ts:431-478`
- **Hypothesis:** blocks connect for up to 5 s on flaky networks.
- **Investigate:** simulate DNS failure or add an iptables rule; measure cold-start. Confirm the call site is on the pre-connect path.
- **Fix reference:** A6 — post-connect non-blocking with AbortController + `notifications/message` warning.

#### H4 · `connector-manager.ts` `scryptSync(N=131072)` blocks 100–200 ms at module load
- **File:** `src/connectors/connector-manager.ts` (search for `scryptSync`)
- **Hypothesis:** called at module load when `CONNECTOR_ENCRYPTION_KEY` is set.
- **Investigate:** set `CONNECTOR_ENCRYPTION_KEY=test`, measure module-load time with `performance.now()` around the require/import.
- **Fix reference:** A7 — lazy derivation on first encrypt/decrypt; cache result.

#### H5 · Stderr silence for first ~2 s
- **Files:** `src/cli.ts:99-110` (logger imported AFTER dynamic_imports), `src/utils/logger.ts`, `src/utils/base-logger.ts:38` (`isStdioMode` at module load).
- **Hypothesis:** first log line appears inside `startStdioServer` after `verifyToolIntegrity` returns (~2 s in). Operators see hang, not progress.
- **Investigate:** `time` the cold-start while redirecting stderr to a file; measure gap between process spawn and first log line.
- **Fix reference:** D1 — raw `process.stderr.write` progress markers from CLI entry, before any import.

#### H6 · `setInterval` at module load in 4 files (timer leaks)
- **Files:** `src/middleware/audit-middleware.ts` (~line 120), `src/middleware/write-lock-middleware.ts` (~line 20), `src/middleware/rate-limit-middleware.ts` (~line 1), `src/connectors/lifecycle.ts:287-304`.
- **Hypothesis:** each starts a `setInterval` at module load with no cleanup; they run forever, keep the event loop alive, prevent clean shutdown.
- **Investigate:** `Grep -n 'setInterval' src/middleware/ src/connectors/` to confirm. Send SIGTERM to a running server; does it exit within 1 s or hang?
- **Fix reference:** C1 — explicit `.start()` / `.stop()`, register with lifecycle, `.unref()` the handle.

#### H7 · Duplicate `validateEnv` call
- **Files:** `src/config/env.ts:538` (module load) + `packages/mcp-stdio/src/start-stdio-server.ts:24` (explicit call).
- **Hypothesis:** second call is redundant; first is the dangerous one (C2).
- **Investigate:** `Grep -n 'validateEnv' src/ packages/` — confirm both sites. Measure cost of second call alone.
- **Fix reference:** B5 — delete the explicit call; rely on `getEnv()` lazy.

#### H8 · Duplicate `uncaughtException`/`unhandledRejection` handlers
- **Files:** `src/cli.ts`, `packages/mcp-stdio/src/start-stdio-server.ts:54-70`.
- **Hypothesis:** both register handlers; both fire on the same event → double-log, double-shutdown.
- **Investigate:** `throw` inside a handler; count log lines.
- **Fix reference:** B4 — single registration at CLI entry before imports; delete from start-stdio-server.

#### H9 · `restart-policy.ts` backoff never resets
- **File:** `src/services/restart-policy.ts:164`
- **Hypothesis:** backward subtraction (`lastFailureAt - Date.now()` instead of `Date.now() - lastFailureAt`) means "reset after stable window" branch never fires.
- **Investigate:** read the line; write a `vi.useFakeTimers()` test that advances past the threshold and asserts `failureCount === 0`.
- **Fix reference:** B2 — correct subtraction; test the reset boundary.

### 6.3 Medium — hygiene & compliance

#### M1 · No `.dispose()` on 6 singletons — unclean SIGTERM
- **Classes to audit:** `RequestDeduplicator`, `CacheManager`, `PrefetchingSystem`, `HeapWatchdog`, `OAuthProvider`, `TemporaryStorage`.
- **Investigate:** `Grep -rn 'class (RequestDeduplicator|CacheManager|PrefetchingSystem|HeapWatchdog|OAuthProvider|TemporaryStorage)' src/` — locate each; check for `dispose`/`destroy`/`shutdown` method.
- **Fix reference:** C2 — add `dispose(): Promise<void>` to each; C3 — register with `LifecycleRegistry`; await all on SIGTERM with 5 s cap.

#### M2 · `preflight-validation.ts:99` synchronous `readFileSync` on event loop
- **File:** `src/startup/preflight-validation.ts:99`
- **Investigate:** confirm `readFileSync` is called on the cold path. Measure with a mounted-NFS or slow-disk simulation.
- **Fix reference:** B3 — convert to `await readFile(path, 'utf8')`.

#### M3 · `SERVER_INSTRUCTIONS` ~6 KB on every initialize response
- **File:** `src/mcp/features-2025-11-25.ts:403-526`
- **Hypothesis:** ~6 KB operator instructions inlined in every initialize response.
- **Investigate:** `wc -c` on the `SERVER_INSTRUCTIONS` constant; measure response size.
- **Fix reference:** A8 — serve via `prompts/get`; initialize response sends a 1-line summary.

#### M4 · `TOOL_ICONS` eager base64 at module load
- **File:** `src/mcp/features-2025-11-25.ts:74-250`
- **Hypothesis:** 25 base64-encoded SVG strings loaded at module parse.
- **Investigate:** sum the string lengths; confirm they are at module scope (not function-local).
- **Fix reference:** A9 — lazy-load from `src/mcp/icons/*.svg` on first `tools/list`.

#### M5 · Schema concentration — 3 mega-files hold 5792 lines
- **Files:** `src/schemas/shared.ts` (1836), `src/schemas/action-metadata.ts` (2775), `src/schemas/descriptions.ts` (1181).
- **Investigate:** `wc -l`; confirm no circular imports via `madge src/schemas/**/*.ts --circular`.
- **Fix reference:** E1 — split `action-metadata.ts` into 25 per-tool files; E2 — lazy-load enterprise schemas; E3 — `SCHEMA_MODE=compact` flag.

#### M6 · Tool-argument completions built but not wired
- **File:** `src/mcp/completions.ts`
- **Investigate:** read the completion/complete handler; does it return `ref/tool` argument completions or only `ref/resource` / `ref/prompt`? Check the SDK's `CompleteRequestSchema`.
- **Fix reference:** D2 — wire `TOOL_ACTIONS` map to the handler.

#### M7 · `DEFER_SCHEMAS` + `STAGED_REGISTRATION` overlap
- **Files:** `src/config/constants.ts:232-243` (`DEFER_SCHEMAS` auto-on stdio), `src/config/constants.ts:320` (`STAGED_REGISTRATION` opt-in, 3 stages).
- **Investigate:** read both blocks; note every call site that checks either flag.
- **Fix reference:** D3 — collapse to single `SERVAL_STARTUP_MODE = fast | staged | full` with `fast` default in stdio.

### 6.4 Low — cleanliness

#### L1 · `getEnv()` exists but underused
- **File:** `src/config/env.ts:518-523`
- **Investigate:** `Grep -rn "from.*['\"].*env.*['\"]" src/ | head -50` — count callers of eager `env` vs `getEnv()`.
- **Fix reference:** Part of A4; add lint rule preferring `getEnv`.

#### L2 · `isStdioMode` evaluated at module load
- **File:** `src/utils/base-logger.ts:38`
- **Investigate:** confirm the read of `process.env['MCP_TRANSPORT']` at module scope. If the logger is imported before `cli.ts:85` sets the var, stderr-only mode misses.
- **Fix:** convert to a getter function `isStdioMode()`.

#### L3 · SDK Issue #893 — cannot register NEW tools post-connect
- **Upstream:** `@modelcontextprotocol/sdk`. The `server.registerTool()` throws after connect.
- **Investigate:** read `node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js` around the "Cannot register capabilities" string.
- **Workaround:** pre-register all 25 tool names; use `.update() / .enable() / .disable()` for dynamic behavior. Consider an upstream PR.

---

## 7. The 5-phase advanced fix plan

Each phase is a shippable PR that passes `npm run verify:safe`. Ship in this order:

| PR | Phase | Scope | Why this order |
|---|---|---|---|
| 1 | **B** (6 fixes) | Correctness & data integrity | No protocol-level behavior change; highest confidence; fixes the data-integrity bug (C1/B1) first |
| 2 | **A1 + A2** | Move `verifyToolIntegrity` post-connect + stream-hash on disk | Biggest latency win (−3.3 s) with lowest risk |
| 3 | **A3 + A4 + A5** | Defer `prepareStdioRuntime` + lazy env + typed errors | Requires readiness gate and codemod; gate behind `SERVAL_STARTUP_MODE=fast` |
| 4 | **A6..A9** | Post-connect preflight, lazy scrypt, instructions→prompt, lazy icons | Remaining A cleanups |
| 5 | **C1..C3** | Lifecycle: start/stop timers, `.dispose()` singletons, graceful SIGTERM | Touches every singleton; audit each before merge |
| 6 | **D1..D4** | Stderr progress, wire completions, `SERVAL_STARTUP_MODE` flag, split pre/post-connect metric | Observability wire-up |
| 7 | **E1..E3** | Schema refactor (split `action-metadata.ts`, lazy enterprise schemas, `SCHEMA_MODE=compact`) | Largest diff, gated behind feature flag, shipped last |

---

## 8. Measurement rubric (what you must report per issue)

For every issue you resolve, your final commit/report must include:

- **Evidence block** — the `file:line` and the command output that proved the bug.
- **Before metric** — wall-clock ms, bytes, error rate, test status (whichever applies).
- **After metric** — same measurement post-fix.
- **Delta** — signed improvement with unit.
- **Verification** — link to the `npm run verify:safe` subagent log showing green.
- **Test evidence** — the test file path and the before (failing) / after (passing) summary.

Example (well-formed):
```
Issue H1 — verifyToolIntegrity loads 25,611 schema lines pre-connect
Evidence: wc -l src/schemas/shared.ts src/schemas/action-metadata.ts src/schemas/descriptions.ts → 1836 + 2775 + 1181 = 5792 lines directly; tool-definitions.ts imports all three (src/schemas/tool-definitions.ts:1-20)
Before: median integrity verify wall-clock = 1795 ms (5 runs)
After:  median integrity verify wall-clock =  293 ms (5 runs)
Delta: −1502 ms
Verification: subagent log #4 — 1421 tests pass, 0 fail, 0 drift
Test: tests/security/tool-hash-registry.test.ts — added hash-on-disk equivalence check (was: no direct test)
```

---

## 9. Anti-patterns to reject

If you catch yourself doing any of these, STOP and redo:

- **Making a claim without `file:line`** — reject the claim.
- **Running `npm test` in the main context** — always delegate to a subagent.
- **Accepting an Explore agent's findings without spot-checking** — trust but verify; read at least 2 cited files yourself.
- **Batching multiple issue fixes into one commit** — one logical unit per commit.
- **Skipping `npm run schema:commit`** after a schema edit — the #1 CI failure cause.
- **Using `Math.random()` or `new Date()` in new tests** — see CLAUDE.md test quality section.
- **Writing a tautological assertion** like `expect([true, false]).toContain(x)` — assert specific values.
- **Using `console.log` in handlers** — `npm run check:debug-prints` will fail.
- **Returning `{}` on the error path** — throw a typed error with remediation hint.

---

## 10. Companion artifacts

Two HTML artifacts summarize the same findings in a visual format. Read them when you need the executive-summary view:

- `/sessions/<session-id>/mnt/.artifacts/servalsheets-cold-start-fix-plan/index.html` — original 10-fix plan with evidence blocks and a reproduction script.
- `/sessions/<session-id>/mnt/.artifacts/servalsheets-advanced-fix-plan-v2/index.html` — unified 23-issue map + 5-phase advanced plan with risk × gain matrix.

These are summaries. This markdown prompt is the authoritative work order.

---

## 11. Kickoff checklist (first 5 minutes of new session)

Execute in this order:

1. Read `CLAUDE.md` (root) — confirm rules haven't changed.
2. Read `.serval/state.md` — confirm live counts (25 tools, 409 actions, protocol `2025-11-25`).
3. Run `npm run check:drift` via subagent — confirm metadata is clean before you touch anything.
4. Create 23 todos via `TodoWrite` — one per issue (C1–C4, H1–H9, M1–M7, L1–L3), all status `pending`.
5. Launch 4 parallel Explore agents in a single message to re-verify sections 6.1–6.4 independently.
6. Reconcile their findings with section 6 above. Mark any issue that is stale/wrong and explain why.
7. Begin Phase B (PR 1) — correctness fixes first.

Do NOT begin any implementation until steps 1–6 are complete.

---

## 12. Verification commands (memorize these)

```bash
npm run verify:safe              # Full pipeline minus ESLint (memory-safe)
npm run verify                   # Full pipeline incl. ESLint (needs ~3GB)
npm run schema:commit            # Regenerate metadata + verify + stage (after schema edits)
npm run check:drift              # Metadata sync check (<15s)
npm run check:mutation-actions   # Write-lock vs audit-middleware parity
npm run check:integration-wiring # Action-rename safety
npm run check:placeholders       # No TODO/FIXME in src/
npm run check:debug-prints       # No console.log in handlers
npm run check:silent-fallbacks   # No silent {} returns
npm run test:fast                # Unit + contract (<30s via subagent)
npm run typecheck                # TS strict
npm run validate:alignment       # Schema ↔ handler alignment
npm run validate:audit           # Audit doc format (.github/AUDIT_TEMPLATE.md)
npm run gates                    # G0–G5 gate pipeline
npm run audit:full               # Coverage + perf + memory + gate (delegate to subagent)
```

---

## 13. When you are done

Report a final summary in chat with:

- Number of issues confirmed / refuted / partially-true (out of 23).
- List of PRs shipped with before/after metrics per PR.
- Cold-start benchmark: before (~3832 ms expected) vs after (target <200 ms).
- Any issues deferred with justification.
- Any new issues discovered during investigation (inevitable — note them).

No markdown report file. No summary doc. Just the chat message + the shipped code + the passing `verify:safe` log.

---

**Now begin at section 11, step 1.**
