# Claude Code Development Operating System (Dev OS)

**For ServalSheets 2.0.0 (MCP 2025-11-25)**  
Last Updated: Session 111 (2026-04-01)

This is the complete decision framework and agent collective for ServalSheets development.

## Quick Links

- **Live Project State:** `.serval/state.md` (metrics, test health, tools/actions)
- **Session Notes:** `.serval/session-notes.md` (current phase, what just completed)
- **Architecture Reference:** `docs/development/CODEBASE_CONTEXT.md` (all 25 tools, handler patterns)
- **Feature Specs:** `docs/development/FEATURE_PLAN.md` (P4-P14 features, implementation order)
- **Source of Truth:** `src/schemas/action-counts.ts:41,46` (authoritative tool/action counts)
- **MCP Compliance:** MCP 2025-11-25 (SEP-1577, SEP-1036, SEP-1686, SEP-973)

## Phase 0: Setup (Session Start)

**Happens automatically via `.claude/hooks.json` SessionStart hook.**

- Auto-generates `.serval/state.md` with live metrics (tools, actions, test count, git status)
- Displays 25 agents available + their specializations
- Prompts to read CLAUDE.md if not already loaded

**Task:** Confirm project state is green (tests passing, metadata synced)

## Phase 1: Plan (5–10 min)

**Goal:** Break down user request into atomic tasks.

1. **Understand the request** — Is it:
   - Feature implementation (extends an action)?
   - Bug fix (fix broken code)?
   - Verification (run gates)?
   - Architecture review (audit)?  
   - Documentation (update docs)?

2. **Map to specialists**
   - Feature? → `servalsheets-research` + `google-api-expert` + `servalsheets-implementation`
   - Bug? → `debug-tracer` + `servalsheets-research` + fix + `servalsheets-validation`
   - Verify? → `servalsheets-validation` alone
   - Audit? → 3 parallel `Explore` agents
   - Docs? → `writing-specialist` alone

3. **Estimate scope** — How many src/ files will change?
   - ≤3 files: Direct task (no planning needed)
   - 4–6 files: 1–2 agent chain (research → implementation)
   - 7+ files: Escalate to user for architecture confirmation

4. **Set success criteria**
   - Tests pass? (npm run test:fast)
   - Drift check passes? (npm run check:drift)
   - Code review? (npm run verify:safe)

## Phase 2: Research (5–30 min per agent)

**Specialists:** `servalsheets-research`, `google-api-expert`, `debug-tracer`, `security-auditor`

### servalsheets-research

Reads existing code patterns to understand implementation strategy.

**Prompt Template:**

```
Find 2-3 similar {action_name} implementations in src/handlers/ to understand:
1. Schema pattern (discriminated union in src/schemas/{tool}.ts)
2. Handler method signature (private async handle{ActionName})
3. Service usage (which services does it call?)
4. Test pattern (success + error paths in tests/handlers/)
5. Any schema commits needed (npm run schema:commit)
```

**Outputs:**
- Code snippets (file:line references)
- Pattern identification
- Implementation roadmap

### google-api-expert

Validates approach against Google APIs best practices.

**Prompt Template:**

```
Review the {action} approach for:
1. API efficiency: Are we making the minimum API calls?
   - Any full-column refs (Sheet1!A:Z) triggering grid fetch?
   - Missing field masks?
   - Missed batching opportunities?
2. Rate limits: Will this hit quota on typical usage?
3. Circuit breaker: Does it degrade gracefully?
4. Caching: Does it leverage CachedSheetsApi or TieredRetrieval?
5. Retry logic: Is it in scope for executeWithRetry()?
```

**Outputs:**
- API call count estimate
- Efficiency optimizations
- Rate limit concerns
- Circuit breaker strategy

### debug-tracer

Diagnoses failures by tracing execution through the 4-layer pipeline.

**Prompt Template:**

```
Trace {failing_test_or_error} through:
Layer 1: Schema (src/schemas/)
  - Does Zod validation pass?
  - Check discriminated union
Layer 2: Handler (src/handlers/)
  - Does handler method match schema shape?
  - Does it return correct response format?
Layer 3: Service (src/services/)
  - Which service is called?
  - Does it handle errors?
Layer 4: Google API (src/services/google-api.ts)
  - Retry/circuit breaker?
  - Rate limiting?
Output: File:line references to failure origin
```

**Outputs:**
- Exact failure location (file:line)
- Root cause diagnosis
- Minimal fix proposal (≤3 files)

### security-auditor

Validates OAuth, credential handling, input validation.

**Prompt Template:**

```
Security audit of {action_or_feature}:
1. OAuth scope usage: Does it request necessary scopes?
2. Input validation: Are params validated before API call?
3. Credential handling: Are tokens stored/transmitted safely?
4. SSRF prevention: Any untrusted URLs in API params?
5. XSS/injection risks: Any unsanitized user input in responses?
```

**Outputs:**
- Risk assessment (none / low / medium / high)
- Specific vulnerabilities
- Remediation steps

## Phase 3: Implementation (20–120 min per task)

**Specialist:** `servalsheets-implementation`

**Workflow:** TDD (schema → handler → test)

### Step 1: Schema First

Modify `src/schemas/{tool}.ts` to add the new action to the discriminated union:

```typescript
// Before
type SheetsCoreAction =
  | { action: 'read'; params: ReadParams }
  | { action: 'write'; params: WriteParams };

// After
type SheetsCoreAction =
  | { action: 'read'; params: ReadParams }
  | { action: 'write'; params: WriteParams }
  | { action: 'new_action'; params: NewActionParams }; // ← Add here
```

### Step 2: Run schema:commit

```bash
npm run schema:commit
```

This regenerates metadata and updates `src/schemas/action-counts.ts` automatically.

### Step 3: Handler Method

Add case + method to `src/handlers/{tool}.ts`:

```typescript
case 'new_action': {
  const result = await this.handleNewAction(req);
  return this.success('new_action', result, isMutation);
}

private async handleNewAction(req: NewActionInput): Promise<NewActionOutput> {
  // 1. Validate business rules (Zod already ran schema validation)
  // 2. Confirm if destructive: await this.confirmDestructiveAction(...)
  // 3. Snapshot if destructive: await this.createSnapshotIfNeeded(...)
  // 4. Execute: const result = await this.context.cachedApi.method(...)
  // 5. Return: return this.success('new_action', result, isMutation);
}
```

### Step 4: Write Tests

In `tests/handlers/{tool}.test.ts`:

```typescript
describe('new_action', () => {
  test('success path', async () => {
    const req = { action: 'new_action', spreadsheetId: TEST_ID, ... };
    const result = await handler.handle(req);
    expect(result.response.success).toBe(true);
    expect(result.response.data).toMatchObject({ ... });
  });

  test('error path: validation fails', async () => {
    const req = { action: 'new_action', spreadsheetId: '', ... }; // Invalid
    const result = await handler.handle(req);
    expect(result.response.success).toBe(false);
    expect(result.response.error).toBeDefined();
  });
});
```

### Step 5: Verify

```bash
npm run test:fast          # Unit + contract tests
npm run verify:safe        # Full verification (skip lint if OOM)
```

## Phase 4: Validation (5–15 min)

**Specialist:** `servalsheets-validation`

**Gates (run in order, fail-fast):**

```bash
G0: npm run check:drift            # Metadata sync
G1: npm run check:placeholders     # No TODO/FIXME in src/
G2: npm run check:debug-prints     # No console.log in handlers
G3: npm run check:silent-fallbacks # No silent {} returns
G4: npm run test:fast              # Unit + contract tests (2253/2253 passing)
G5: npm run verify:safe            # Full (typecheck + test + drift)
```

**Failure handling:**

- If G0 fails: `npm run schema:commit` (metadata out of sync)
- If G1-G3 fail: Code cleanup required
- If G4 fails: Test regression — investigate and fix
- If G5 fails: TypeScript errors or other compliance issues

## Phase 5: Review (10–20 min)

**Specialist:** `code-review-orchestrator`

Checks:

1. **Type safety** — No `any`, `as any`, or TS errors
2. **Linting** — ESLint clean (or justified exceptions)
3. **Security** — OAuth, input validation, no credentials in logs
4. **MCP compliance** — Schema structure, response format, error codes
5. **Testing** — Tests are deterministic (no Math.random()), non-tautological, cover error paths
6. **Documentation** — If handler logic is complex, add inline comments

## Phase 6: Commit & Report (2–5 min)

**Workflow:**

```bash
git add -A
git commit -m "feat: add new_action to sheets_tool

Added handler method + schema + tests for new_action.
Validation: G0-G5 gates pass, 2253/2253 tests pass.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

git push origin branch-name
```

**Report format:**

```markdown
## What Was Done

1. Schema: Added new_action to src/schemas/tool.ts (file:line)
2. Handler: Implemented in src/handlers/tool.ts (file:line)
3. Tests: Added 3 test cases in tests/handlers/tool.test.ts
4. Metadata: Ran npm run schema:commit (regenerated action-counts.ts)

## Verification

- Tests: 2253/2253 pass
- TypeScript: 0 errors
- Drift: Clean
- Ready to commit: YES

## Files Changed

- src/schemas/tool.ts
- src/handlers/tool.ts
- tests/handlers/tool.test.ts
- src/schemas/action-counts.ts (auto-generated)
```

## 25 Agents & Specializations

| Agent                         | Model  | Best For                                              |
| ----------------------------- | ------ | ----------------------------------------------------- |
| dev-team-lead (YOU)           | Sonnet | Orchestrates specialists, makes architectural calls  |
| servalsheets-research         | Haiku  | Finding patterns, reading code, understanding impl   |
| servalsheets-implementation   | Sonnet | TDD code writing, following patterns exactly         |
| servalsheets-validation       | Haiku  | Running G0-G5 gates, checking drift/placeholders     |
| debug-tracer                  | Sonnet | Tracing failures through 4-layer pipeline             |
| code-review-orchestrator      | Sonnet | Type/lint/security/MCP compliance pre-commit         |
| testing-specialist            | Sonnet | Test strategy, coverage gaps, property-based tests    |
| security-auditor              | Sonnet | OAuth, credentials, input validation, SSRF/XSS       |
| google-api-expert             | Sonnet | Sheets/Drive/BigQuery API best practices, quota       |
| mcp-protocol-specialist       | Sonnet | MCP 2025-11-25 spec compliance validation             |
| explore-codebase              | Haiku  | Parallel searches across files (3x faster)           |
| writing-specialist            | Sonnet | Documentation, blog posts, release notes              |
| performance-analyst           | Sonnet | Profiling, optimization, benchmark analysis          |
| data-scientist                | Sonnet | Statistics, hypothesis testing, correlation analysis  |
| typescript-expert             | Sonnet | Type-level programming, branded types, generics      |
| architecture-reviewer         | Sonnet | Design decisions, breaking changes, API evolution     |
| compliance-auditor            | Sonnet | Legal, licensing, data privacy, audit trail          |
| accessibility-specialist      | Haiku  | WCAG, screen reader compat, keyboard nav             |
| devops-engineer               | Sonnet | Docker, CI/CD, cloud deploy, monitoring               |
| release-manager               | Sonnet | Versioning, changelog, breaking change comms          |
| training-specialist           | Sonnet | User guides, video scripts, workshop design          |
| product-manager               | Sonnet | Roadmap prioritization, user story refinement         |
| ux-researcher                 | Sonnet | User testing, feedback synthesis, design validation   |
| frontend-specialist           | Sonnet | Web UX, accessibility, performance, responsive       |
| integration-tester            | Sonnet | Live API tests, e2e scenarios, federated systems      |

## Decision Rules

1. **Run agents in parallel** when tasks are independent (research + API review simultaneously)
2. **Run agents sequentially** when each needs the previous output
3. **Always run servalsheets-validation last** before reporting "done"
4. **Never report success** without seeing validation pass
5. **Ask user for confirmation** if task spans >3 src/ files
6. **Escalate to user** for: architecture decisions not in CLAUDE.md, breaking API changes, billing/auth
7. **Use Haiku agents for reads/searches** (cheaper, faster)
8. **Use Sonnet for implementation/review** (more capable)

## Anti-Patterns (Never Do)

- ❌ Skip schema:commit after schema changes (causes CI drift failure)
- ❌ Commit without running verify:safe (tests might fail)
- ❌ Hardcode action counts (use src/schemas/action-counts.ts)
- ❌ Create new tools without user approval (keep 25-tool surface stable)
- ❌ Modify generated files directly (regenerate via schema:commit)
- ❌ Use any/as any in handlers (all 13 BaseHandler subclasses are type-safe)
- ❌ Silent fallbacks ({ return {} } without error) — always throw typed error
- ❌ Retry permission errors (only 429, 5xx, ECONNRESET are retryable)
- ❌ Bypass circuit breaker when it's open (use fallback mode instead)
- ❌ Make API calls without field masks (bloats response sizes)

## Key Automation

### Hooks (`.claude/hooks.json`)

- **SessionStart:** Generate `.serval/state.md` (auto runs)
- **Stop:** Remind to update `.serval/session-notes.md` (auto prompts)
- **PreToolUse (Bash):** Block destructive git commands (auto blocks)
- **PostToolUse (Write):** Warn schema files edited without schema:commit (auto warns)

### Commands (npm)

```bash
# Core workflow
npm run schema:commit    # After ANY schema change (regenerates metadata)
npm run verify:safe      # Full verification (typecheck + test + drift, skip lint)
npm run test:fast        # Quick unit + contract tests
npm run check:drift      # Metadata sync check

# Gates
npm run gates            # G0-G5 full pipeline
npm run check:*          # Individual gates (placeholders, debug-prints, silent-fallbacks)

# Development
npm run typecheck        # TypeScript strict
npm run lint             # ESLint
npm run build            # TypeScript → dist/
```

## What Happens When

| Scenario                          | Action                                                                    |
| --------------------------------- | ------------------------------------------------------------------------- |
| User requests new feature         | Plan → Research → Implement → Validate → Commit (Phases 1–6)             |
| Test fails                        | debug-tracer traces to root cause → fix → validate → commit              |
| Metadata drift detected           | Run npm run schema:commit immediately (regenerates 7 files)               |
| New tool requested (rare)         | Escalate to user (breaks API surface, not recommended)                   |
| Pre-commit check                  | Run servalsheets-validation with G0-G5 gates                             |
| Documentation out of date         | Delegate to writing-specialist (markdown files only)                     |
| Performance regression suspected  | Delegate to performance-analyst (profiling + analysis)                   |
| Security concern                  | Escalate to security-auditor + compliance-auditor                        |

## Session Checklist

Before ending a session:

- [ ] Run `npm run verify:safe` (all green)
- [ ] Update `.serval/session-notes.md` with what you completed
- [ ] Commit work (one commit per logical unit)
- [ ] Push to branch (or main if no PRs)
- [ ] Report summary to user (what changed, test results, ready-to-commit status)

## Common Gotchas

1. **Metadata drift after schema changes** — Run `npm run schema:commit` immediately
2. **Response builder anti-pattern** — Return data from handler; tool layer converts to MCP format
3. **Hardcoded counts** — Always reference `src/schemas/action-counts.ts:41,46`
4. **Silent fallbacks** — Never `return {}` without logging; use ErrorCode enum
5. **Tautological tests** — Assert specific expected value, not `toContain([true, false])`
6. **Test non-determinism** — No `Math.random()` in test fixtures; use deterministic sequences
7. **MCP envelope wrapping** — Tests need `{ request: { action, ... } }` format
