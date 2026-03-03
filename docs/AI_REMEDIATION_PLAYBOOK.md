---
title: AI Remediation Playbook
category: development
last_updated: 2026-02-24
description: Agentic remediation strategy for ServalSheets quality issues
version: 1.7.0
---

# ServalSheets — AI-Driven Remediation Playbook

> **Purpose:** Master prompt and execution plan for an AI agent (Claude Code) to systematically
> audit, verify, plan, and fix all 234 issues across 20 quality categories — producing
> production-grade code with zero regressions.
>
> **Input Documents:**
> - `ISSUES.md` — 234 individually tracked issues with file:line references and fix instructions
> - `docs/PRODUCTION_AUDIT.md` — 20-category quality assessment with scores, grades, and priority tiers
> - `CLAUDE.md` — Project rules, verification commands, coding conventions
> - `docs/development/CODEBASE_CONTEXT.md` — Full architecture reference (391 actions, 25 tools)
> - `docs/development/FEATURE_PLAN.md` — Feature specs for P4 additions
>
> **Execution Model:** 7 phases, each with discovery → planning → implementation → verification gates.
> Each phase uses parallel subagents for speed while the main agent coordinates and validates.

---

## TABLE OF CONTENTS

1. [Pre-Flight Setup](#1-pre-flight-setup)
2. [Phase 0: Audit & Triage (Read-Only)](#2-phase-0-audit--triage)
3. [Phase 1: Critical Fixes (P0 — 4 issues)](#3-phase-1-critical-fixes)
4. [Phase 2: High-Severity Fixes (P1 — 29 issues)](#4-phase-2-high-severity-fixes)
5. [Phase 3: Medium-Severity — Code Quality & Safety (P2a — 55 issues)](#5-phase-3-medium-severity-code-quality)
6. [Phase 4: Medium-Severity — Infrastructure & Protocol (P2b — 45 issues)](#6-phase-4-medium-severity-infrastructure)
7. [Phase 5: Low-Severity & Polish (P3 — 101 issues)](#7-phase-5-low-severity--polish)
8. [Phase 6: Final Verification & Release Gate](#8-phase-6-final-verification)
9. [Agent Architecture & Tool Usage](#9-agent-architecture)
10. [Negative Constraints (NC-01 through NC-20)](#10-negative-constraints)
11. [Per-Issue Execution Protocol](#11-per-issue-execution-protocol)
12. [VS Code Integration & Workflow Tips](#12-vs-code-integration)

---

## 1. PRE-FLIGHT SETUP

### 1.1 Context Loading Prompt

Paste this at the start of every Claude Code session:

```
@CLAUDE.md @.serval/state.md @.serval/session-notes.md @docs/development/CODEBASE_CONTEXT.md

You are remediating ServalSheets, a production MCP server (25 tools, 391 actions).
Two reference documents drive this work:
- ISSUES.md: 234 tracked issues with file:line refs and fix instructions
- docs/PRODUCTION_AUDIT.md: 20-category quality audit with scores

RULES:
1. Never modify generated files directly (action-counts.ts, annotations.ts, completions.ts, server.json)
2. After ANY schema change: `npm run schema:commit` IMMEDIATELY
3. One commit per logical unit — never batch
4. Reproduce every bug with a failing test BEFORE fixing
5. Run `npm run verify:safe` after every phase (not `verify` — ESLint OOMs)
6. Delegate test runs and typechecks to subagents — never run in main context
7. Load only the handler/schema being worked on — never all 22 at once
8. Follow safety rail order: snapshot → confirm → execute (NC-08)

Current phase: [PHASE_NUMBER]
Current issue: [ISSUE_ID]
```

### 1.2 VS Code Workspace Setup

```bash
# Terminal 1: Watch mode for fast feedback
npm run typecheck -- --watch

# Terminal 2: Test runner in watch mode
npx vitest --watch --reporter=verbose

# Terminal 3: Git status monitoring
watch -n 5 'git status --short'
```

### 1.3 Branch Strategy

```bash
git checkout -b remediation/phase-N    # One branch per phase
# After phase passes all gates:
git checkout main && git merge --no-ff remediation/phase-N
```

### 1.4 Pre-Flight Verification Checklist

```bash
# Run BEFORE starting any phase — establishes the baseline
npm run typecheck              # Record: ___ errors (expected: some pre-existing in 3 files)
npm run test:fast              # Record: ___ / ___ pass
npm run check:drift            # Record: pass / fail
npm run validate:alignment     # Record: pass / fail
npm run check:silent-fallbacks # Record: ___ false positives
npm run check:placeholders     # Record: ___ TODOs in src/
npm run check:debug-prints     # Record: ___ console.logs in handlers
```

---

## 2. PHASE 0: AUDIT & TRIAGE (Read-Only)

**Goal:** Verify every issue in ISSUES.md is still valid, categorize by phase, and produce a machine-readable task list.

**Duration:** 1 session | **Files changed:** 0 | **Risk:** None

### 2.1 Discovery Agents (run in parallel)

Launch 4 subagents simultaneously:

```
Agent 1 — CRITICAL + HIGH validation:
  Read ISSUES.md Section 1 (ISSUE-001 through ISSUE-004) and Section 2 (ISSUE-005 through ISSUE-025).
  For each issue: open the referenced file:line, confirm the bug still exists.
  Output: list of [ISSUE-ID, status: CONFIRMED/FIXED/CHANGED, current_file:line]

Agent 2 — MEDIUM validation (Sections 3, 5, 10):
  Read ISSUES.md Sections 3, 5, and 10 (ISSUE-026 through ISSUE-069, ISSUE-087 through ISSUE-111).
  For each: check if the file:line reference is still accurate. Some may have been fixed in Sessions 24-38.
  Output: list of [ISSUE-ID, status, current_file:line]

Agent 3 — Deep Audit validation (Section 11 A-F):
  Read ISSUES.md Section 11 subsections A through F (ISSUE-112 through ISSUE-158).
  Verify file:line refs against current codebase.
  Output: list of [ISSUE-ID, status, current_file:line]

Agent 4 — Deep Audit validation (Section 11 G-L) + Release Blockers:
  Read ISSUES.md Section 11 subsections G through L (ISSUE-159 through ISSUE-222) plus
  Section 6 (ISSUE-070 through ISSUE-075).
  Verify file:line refs.
  Output: list of [ISSUE-ID, status, current_file:line]
```

### 2.2 Triage Output

After all 4 agents complete, merge results into a tracking table:

```markdown
| Issue | Status | Phase | Blocked By | Est. Files | Est. Lines |
|-------|--------|-------|------------|------------|------------|
| ISSUE-001 | CONFIRMED | 1 | — | 4 | ~40 |
| ISSUE-002 | FIXED | — | — | — | — |
| ...
```

### 2.3 Phase 0 Gate

- [ ] Every ISSUE-xxx verified against current codebase
- [ ] Fixed issues marked and excluded from remaining phases
- [ ] Dependency graph built (which issues block which)
- [ ] Phase assignments confirmed
- [ ] Zero code changes made

---

## 3. PHASE 1: CRITICAL FIXES (P0)

**Issues:** ISSUE-001, ISSUE-002, ISSUE-003, ISSUE-004, plus ISSUE-087, ISSUE-088, ISSUE-089, ISSUE-090 (Addendum CRITICAL)
**Goal:** Eliminate all workflow-blocking bugs
**Duration:** 1-2 sessions | **Max files per commit:** 3 | **Risk:** HIGH — these touch auth and error handling

### 3.1 Issue Execution Order

```
ISSUE-002: sheetId=0 falsy bug          → 1 file, 5 min    (unblocks everything)
ISSUE-003: LLM API leaks billing info   → 1 file, 15 min   (security)
ISSUE-004: BigQuery raw error exposure   → 1 file, 10 min   (security)
ISSUE-001: Auth token drops              → 4 files, 45 min  (complex, 3 sub-bugs)
ISSUE-087: Optional chaining crash       → 1 file, 10 min
ISSUE-088: createMessage hang            → 1 file, 15 min
ISSUE-089: batchUpdate partial failures  → 1 file, 20 min
ISSUE-090: GDPR data export stubs       → 2 files, 30 min
```

### 3.2 Per-Issue Protocol (applies to ALL phases)

For each issue, follow this exact sequence:

```
┌─ STEP 1: RESEARCH ──────────────────────────────────────┐
│ Read the file:line from ISSUES.md                       │
│ Read 50 lines of surrounding context                    │
│ Read the handler's test file                            │
│ Read the relevant schema if applicable                  │
└─────────────────────────────────────────────────────────┘
          │
┌─ STEP 2: REPRODUCE ────────────────────────────────────┐
│ Write a failing test that demonstrates the bug          │
│ Run test in subagent: confirm it FAILS                  │
│ If test passes → issue may be fixed → verify & skip     │
└─────────────────────────────────────────────────────────┘
          │
┌─ STEP 3: PLAN ─────────────────────────────────────────┐
│ Identify ALL files that need changes (max 3 for bugs)   │
│ Check NC-01 through NC-20 for constraint violations     │
│ If schema change needed → plan schema:commit step       │
│ Write the fix plan as a comment in the test file        │
└─────────────────────────────────────────────────────────┘
          │
┌─ STEP 4: IMPLEMENT ───────────────────────────────────┐
│ Apply minimal fix — no refactoring in same commit       │
│ Follow existing patterns in the file                    │
│ Use typed errors, not generic Error()                   │
│ Follow import ordering convention                       │
└─────────────────────────────────────────────────────────┘
          │
┌─ STEP 5: VERIFY ──────────────────────────────────────┐
│ Run the specific test file in subagent                  │
│ Run npm run typecheck in subagent                       │
│ Run npm run check:drift in subagent                     │
│ If schema changed: npm run schema:commit first          │
│ Confirm: test that FAILED in step 2 now PASSES          │
└─────────────────────────────────────────────────────────┘
          │
┌─ STEP 6: COMMIT ──────────────────────────────────────┐
│ git add [specific files only]                           │
│ git commit -m "fix(ISSUE-XXX): [description]"           │
│ ONE commit per issue — never batch                      │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Phase 1 Gate

```bash
# ALL must pass before moving to Phase 2
npm run test:fast              # Must pass (2253+ tests, 0 failures)
npm run typecheck              # 0 NEW errors (pre-existing in 3 files OK)
npm run check:drift            # Pass
npm run validate:alignment     # Pass
npm run check:silent-fallbacks # 0 false positives
```

- [ ] All P0 issues resolved with passing tests
- [ ] No regressions in existing test suite
- [ ] Each fix has its own commit
- [ ] ISSUES.md updated: mark resolved issues `[DONE]`

---

## 4. PHASE 2: HIGH-SEVERITY FIXES (P1)

**Issues:** ISSUE-005 through ISSUE-025 (original), ISSUE-091 through ISSUE-097 (Addendum HIGH),
ISSUE-112 through ISSUE-119 (Deep Audit HIGH)
**Count:** ~29 issues | **Duration:** 3-5 sessions

### 4.1 Subphase Grouping (by handler/service domain)

Group issues by the files they touch to minimize context switching:

```
Subphase 2A — Auth & Token (2 issues):
  ISSUE-005 (timeout kills auth), ISSUE-008 (OAuth scope gaps)

Subphase 2B — Safety Rails (4 issues):
  ISSUE-013 (safety rail gaps), ISSUE-014 (snapshot timing),
  ISSUE-015 (safety missing on destructive ops), ISSUE-091 (cancellation error handling)

Subphase 2C — API Efficiency (5 issues):
  ISSUE-019 (unbounded metadata fetch), ISSUE-020 (double API calls),
  ISSUE-112 (TieredRetrieval 3x calls), ISSUE-114 (A1:ZZ10000 default),
  ISSUE-118 (core.list missing supportsAllDrives)

Subphase 2D — Race Conditions (4 issues):
  ISSUE-011 (write conflict race), ISSUE-012 (batch window race),
  ISSUE-092 (Promise.all mode), ISSUE-113 (PQueue unbounded)

Subphase 2E — MCP Protocol (4 issues):
  ISSUE-025 (progress not streamed), ISSUE-116 (P4 features no integration tests),
  ISSUE-117 (GDPR consent gate), ISSUE-119 (MCP cancellation)

Subphase 2F — Data Handling (5 issues):
  ISSUE-006 (timeout 60s too low), ISSUE-007 (background analysis blocks),
  ISSUE-009 (large response truncation), ISSUE-010 (field mask gaps),
  ISSUE-115 (memory watchdog missing)

Subphase 2G — Session & History (5 issues):
  ISSUE-016-024 (remaining P1 items), ISSUE-093-097 (Addendum remainders),
  ISSUE-115b (core.list scope)
```

### 4.2 Parallel Agent Strategy

For each subphase, launch 2 parallel agents:

```
Agent A (Research + Test Writing):
  - Read all issue file:line references in the subphase
  - Write failing tests for each issue
  - Output: test file with N failing tests

Agent B (Fix Implementation):
  - Wait for Agent A to confirm failing tests
  - Implement fixes following the Per-Issue Protocol
  - Output: fixed files + passing test confirmation
```

### 4.3 Phase 2 Gate

Same as Phase 1 gate, plus:

```bash
npm run verify:safe            # Full pipeline (typecheck + test + drift)
```

- [ ] All 29 P1 issues resolved
- [ ] Pre-existing typecheck errors in suggestion-engine.ts, excel-online-backend.ts, notion-backend.ts FIXED
- [ ] Each subphase has its own commit group
- [ ] Zero regressions

---

## 5. PHASE 3: MEDIUM-SEVERITY — CODE QUALITY (P2a)

**Issues:** Handler-specific bugs (ISSUE-120 through ISSUE-140), type safety (ISSUE-026 through ISSUE-040),
schema fixes (ISSUE-041 through ISSUE-057), error handling improvements
**Count:** ~55 issues | **Duration:** 3-4 sessions

### 5.1 Batch Strategy

These are smaller, more mechanical fixes. Group by handler file:

```
Batch 3A — core.ts (ISSUE-120, ISSUE-176, plus related)
Batch 3B — format.ts (ISSUE-121, ISSUE-122, ISSUE-179, ISSUE-211)
Batch 3C — dimensions.ts (ISSUE-123, ISSUE-180)
Batch 3D — advanced.ts (ISSUE-124, ISSUE-125, ISSUE-181)
Batch 3E — collaborate.ts (ISSUE-126, ISSUE-183, ISSUE-155)
Batch 3F — composite.ts (ISSUE-127, ISSUE-128, ISSUE-184)
Batch 3G — analyze.ts (ISSUE-129, ISSUE-130, ISSUE-185)
Batch 3H — fix.ts (ISSUE-131, ISSUE-132)
Batch 3I — appsscript.ts (ISSUE-133, ISSUE-134)
Batch 3J — dependencies.ts (ISSUE-135, ISSUE-216, ISSUE-217)
Batch 3K — quality.ts (ISSUE-136)
Batch 3L — session.ts (ISSUE-137, ISSUE-138)
Batch 3M — transaction.ts (ISSUE-139, ISSUE-190)
Batch 3N — webhooks.ts (ISSUE-140, ISSUE-191)
Batch 3O — Schema shared.ts (ISSUE-144, ISSUE-145, ISSUE-195)
Batch 3P — Type casts (ISSUE-026 through ISSUE-035 — as any removal)
```

### 5.2 Mechanical Fix Agent Prompt

For batches of similar fixes (like `as any` removal), use this specialized prompt:

```
You are fixing type safety issues in ServalSheets. For each `as any` or `as unknown` cast:

1. Read the surrounding code (20 lines context)
2. Determine the actual type the value should be
3. Create a proper type assertion or type guard
4. If the type is complex, create a named interface in the same file
5. Verify with: npx tsc --noEmit [file]

Rules:
- Never use `as any` — use `as SpecificType` or a type guard
- If the Google API type is missing, use `Schema$[TypeName]` from googleapis
- If a runtime check is needed, add `if (typeof x === 'string')` guard
- Each batch of fixes in one file = one commit
```

### 5.3 Phase 3 Gate

```bash
npm run test:fast              # All tests pass
npm run typecheck              # ZERO errors (pre-existing must be fixed by now)
npm run check:drift            # Pass
npm run validate:alignment     # Pass
npm run check:silent-fallbacks # 0
npm run check:placeholders     # 0
npm run check:debug-prints     # 0
```

- [ ] All ~55 P2a issues resolved
- [ ] `npm run typecheck` produces ZERO errors globally
- [ ] All `as any` casts either removed or annotated with justification comments
- [ ] All handler switch statements have `never` exhaustiveness checks

---

## 6. PHASE 4: MEDIUM-SEVERITY — INFRASTRUCTURE & PROTOCOL (P2b)

**Issues:** Infrastructure (ISSUE-141 through ISSUE-150), MCP protocol (ISSUE-151 through ISSUE-154),
Google API efficiency (ISSUE-155 through ISSUE-158), Security (ISSUE-159 through ISSUE-164),
GDPR (ISSUE-165 through ISSUE-166), Testing (ISSUE-167 through ISSUE-171),
Strategic (ISSUE-172 through ISSUE-175)
**Count:** ~45 issues | **Duration:** 3-5 sessions

### 6.1 Subphase Grouping

```
Subphase 4A — Infrastructure hardening:
  ISSUE-141 (base.ts field mask), ISSUE-142 (metadata cache reuse),
  ISSUE-143 (retry.ts GOAWAY detection), ISSUE-146 (event-store cursor),
  ISSUE-147 (conflict detector mutex), ISSUE-148 (circuit breaker adaptive),
  ISSUE-149 (retry-after hints), ISSUE-150 (request prioritization)

Subphase 4B — MCP protocol completeness:
  ISSUE-151 (client capability probe), ISSUE-152 (knowledge base files),
  ISSUE-153 (progress wiring), ISSUE-154 (session context for format)

Subphase 4C — Google API efficiency:
  ISSUE-155 (collaborate.ts field masks), ISSUE-156 (batch metadata dedup),
  ISSUE-157 (cross-read concurrency cap), ISSUE-158 (suggestion-engine filter)

Subphase 4D — Security & Auth:
  ISSUE-159 (RBAC setup), ISSUE-160 (token rotation), ISSUE-161 (trace propagation),
  ISSUE-162 (circuit breaker alerts), ISSUE-163 (OTLP export), ISSUE-164 (request replay)

Subphase 4E — GDPR compliance:
  ISSUE-165 (Art. 15 access), ISSUE-166 (audit log classification)

Subphase 4F — Test coverage:
  ISSUE-167 (MCP pipeline integration tests), ISSUE-168 (error path coverage),
  ISSUE-169 (generic error messages in 8 handlers), ISSUE-170 (suggest_format fallback),
  ISSUE-171 (appsscript scope docs)

Subphase 4G — Strategic investments (PLAN ONLY — implement if time permits):
  ISSUE-172 (plugin architecture), ISSUE-173 (enterprise auth),
  ISSUE-174 (semantic search), ISSUE-175 (external data connectors)
```

### 6.2 Special Handling: Schema Changes

Multiple Phase 4 issues add new schema fields (ISSUE-165 adds `request_data_access` action,
ISSUE-157 adds `.max(50)` validation). After ALL schema changes in a subphase:

```bash
npm run schema:commit          # MANDATORY — regenerates 5 files
npm run check:drift            # Verify no drift
npm run validate:alignment     # Verify schema-handler alignment
```

### 6.3 Phase 4 Gate

```bash
npm run verify:safe            # Full pipeline
npm run gates                  # G0-G5 all pass
```

- [ ] All ~45 P2b issues resolved
- [ ] Integration tests exist for MCP pipeline
- [ ] Error path coverage ≥60% across handlers
- [ ] GDPR compliance gaps closed (Art. 7, 15, 17, 20)

---

## 7. PHASE 5: LOW-SEVERITY & POLISH (P3)

**Issues:** ISSUE-058 through ISSUE-060, ISSUE-098 through ISSUE-111 (Addendum LOW),
ISSUE-176 through ISSUE-222 (Deep Audit LOW), MCP gaps (ISSUE-061 through ISSUE-069),
Release blockers (ISSUE-070 through ISSUE-075), Test coverage (ISSUE-076 through ISSUE-078),
API opportunities (ISSUE-079 through ISSUE-083), i18n (ISSUE-084 through ISSUE-086)
**Count:** ~101 issues | **Duration:** 4-6 sessions

### 5.1 Mass-Fix Categories

Many P3 issues are mechanical. Use specialized agents:

```
Agent Type: "Documentation Fixer"
  Issues: ISSUE-201, ISSUE-208, ISSUE-209, ISSUE-210, ISSUE-212, ISSUE-219, ISSUE-220, ISSUE-221
  Pattern: Update descriptions, comments, and docs — no logic changes
  Verification: npm run check:drift

Agent Type: "Response Shape Normalizer"
  Issues: ISSUE-178, ISSUE-180, ISSUE-183, ISSUE-189, ISSUE-191
  Pattern: Add missing fields to response objects with defaults
  Verification: npm run test:fast

Agent Type: "Error Message Improver"
  Issues: ISSUE-169 (8 handlers), ISSUE-177, ISSUE-187, ISSUE-193
  Pattern: Replace generic messages with field-specific actionable errors
  Verification: npm run test:fast

Agent Type: "Safety Rail Adder"
  Issues: ISSUE-125, ISSUE-182, ISSUE-194, ISSUE-200, ISSUE-202, ISSUE-203, ISSUE-206
  Pattern: Add confirmation/snapshot/validation guards
  Verification: npm run test:fast + manual review

Agent Type: "Google API Enhancer"
  Issues: ISSUE-079 through ISSUE-083, ISSUE-196, ISSUE-197, ISSUE-198, ISSUE-199
  Pattern: Expose additional API parameters in schemas
  Verification: npm run schema:commit + npm run test:fast

Agent Type: "i18n Foundations"
  Issues: ISSUE-084, ISSUE-085, ISSUE-086, ISSUE-218, ISSUE-293 (RTL)
  Pattern: Add locale-aware parameters and format handling
  Verification: npm run schema:commit + npm run test:fast
```

### 7.2 Release Blockers (must be done in Phase 5)

```
ISSUE-070: TypeScript compilation errors      → Fix the 3 pre-existing error files
ISSUE-071: npm audit vulnerabilities          → npm audit fix --force, then verify
ISSUE-072: Token scope validation             → Per-action scope checks
ISSUE-073: Git worktree state                 → Clean up 569 uncommitted files
ISSUE-074: npm publish readiness              → package.json files field, .npmignore
ISSUE-075: CHANGELOG completeness             → Update for all P4-P15 changes
```

### 7.3 Phase 5 Gate

```bash
npm run verify:safe
npm run gates
npm run audit:full             # Coverage + perf + memory + gate + snapshot
npm audit --audit-level=high   # 0 high/critical vulnerabilities
npx tsc --noEmit               # ZERO errors
```

- [ ] All 101 P3 issues resolved
- [ ] npm audit clean
- [ ] TypeScript compiles with zero errors
- [ ] All release blockers cleared
- [ ] CHANGELOG updated

---

## 8. PHASE 6: FINAL VERIFICATION & RELEASE GATE

**Goal:** Comprehensive validation that all 234 issues are resolved with zero regressions.

### 8.1 Full Verification Suite

Run ALL of these (delegate each to a separate subagent):

```bash
# Core pipeline
npm run verify:safe              # typecheck + test + drift
npm run gates                    # G0-G5 validation gates

# Quality checks
npm run check:drift              # Metadata sync
npm run check:placeholders       # No TODO/FIXME in src/
npm run check:debug-prints       # No console.log in handlers
npm run check:silent-fallbacks   # 0 false positives
npm run validate:alignment       # Schema-handler alignment

# Audit suite
npm run audit:coverage           # 340-action coverage test
npm run audit:perf               # Performance benchmarks
npm run audit:memory             # Memory leak detection
npm run audit:gate               # CI gate (7 checks)
npm run audit:snapshot           # Full health report

# Security & supply chain
npm audit --audit-level=high     # 0 vulnerabilities
npx license-checker --failOn 'GPL'  # No GPL contamination

# Build verification
npm run verify:build             # Build + validate + smoke
```

### 8.2 Regression Test Matrix

Create and run targeted regression tests for each phase:

```bash
# Phase 1 regressions (auth, security)
npx vitest run tests/handlers/auth.test.ts tests/security/

# Phase 2 regressions (safety rails, API efficiency)
npx vitest run tests/handlers/ tests/contracts/

# Phase 3 regressions (type safety, handler bugs)
npx vitest run tests/contracts/schema-handler-alignment.test.ts

# Phase 4 regressions (infrastructure, MCP)
npx vitest run tests/integration/ tests/enterprise/

# Phase 5 regressions (everything)
npm run test:fast
```

### 8.3 Issue Registry Verification

Run a final audit agent:

```
Read ISSUES.md from start to end.
For each ISSUE-001 through ISSUE-222:
  1. Verify it is marked [DONE]
  2. Verify the fix commit exists in git log
  3. Verify a test covering the fix exists
  4. Verify the file:line reference no longer shows the bug
Output: [ISSUE-ID, commit_hash, test_file, verified: YES/NO]
```

### 8.4 PRODUCTION_AUDIT.md Score Update

After all fixes, re-run the 20-category audit and update scores:

```
Target scores (post-remediation):
| Category                    | Before | Target |
|-----------------------------|--------|--------|
| Security                    | 86     | 95+    |
| Architecture                | 90     | 93+    |
| Code Quality                | 85     | 95+    |
| Testing                     | 82     | 92+    |
| MCP Protocol                | 98     | 99+    |
| Performance                 | 92     | 96+    |
| DevOps                      | 95     | 97+    |
| Documentation               | 91     | 95+    |
| Licensing & Supply Chain    | 78     | 90+    |
| Backward Compatibility      | 82     | 90+    |
| Concurrency                 | 75     | 90+    |
| Google API Quota            | 68     | 85+    |
| Cost Optimization           | 71     | 85+    |
| Disaster Recovery           | 76     | 88+    |
| Compliance (SOC 2/HIPAA)    | 62     | 85+    |
| Scalability                 | 74     | 85+    |
| Observability               | 85     | 93+    |
| Internationalization        | 54     | 72+    |
| Plugin Architecture         | 28     | 45+    |
| Incident Response           | 82     | 92+    |
| OVERALL                     | 77     | 90+    |
```

### 8.5 Final Gate Checklist

- [ ] ALL 234 issues marked [DONE] in ISSUES.md
- [ ] `npm run verify:safe` — PASS
- [ ] `npm run gates` — ALL G0-G5 PASS
- [ ] `npm run audit:full` — ALL PASS
- [ ] `npm run typecheck` — ZERO errors
- [ ] `npm audit` — ZERO high/critical vulnerabilities
- [ ] Git log shows atomic commits per issue
- [ ] PRODUCTION_AUDIT.md updated with new scores
- [ ] CHANGELOG.md updated for release
- [ ] README.md action counts verified against action-counts.ts

---

## 9. AGENT ARCHITECTURE

### 9.1 Main Agent Role

The main Claude Code agent acts as **coordinator**. It:
- Loads context for the current phase/subphase
- Dispatches work to subagents
- Reviews subagent output
- Runs verification gates
- Makes commits
- Tracks progress in ISSUES.md

The main agent should NEVER:
- Run the full test suite directly (delegate to Bash subagent)
- Load more than 2-3 handler files simultaneously
- Skip the per-issue protocol
- Make commits without passing the phase gate

### 9.2 Subagent Types

```
┌─────────────────────────────────────────────────────────┐
│                    MAIN AGENT                            │
│         (Coordinator — reads issues, plans,              │
│          dispatches, reviews, commits)                   │
└───────┬───────┬───────┬───────┬───────┬────────────────┘
        │       │       │       │       │
   ┌────▼──┐ ┌─▼────┐ ┌▼─────┐ ┌▼────┐ ┌▼──────┐
   │Explore│ │ Plan │ │ Bash │ │Task │ │Task   │
   │Agent  │ │Agent │ │Agent │ │Agent│ │Agent  │
   │       │ │      │ │      │ │(Fix)│ │(Test) │
   └───────┘ └──────┘ └──────┘ └─────┘ └───────┘
```

**Explore Agent** — Use for:
- "Find all usages of X across the codebase"
- "Which handlers use confirmDestructiveAction?"
- "Where is ErrorCode enum defined?"
- Quick codebase searches before fixing

**Plan Agent** — Use for:
- Complex multi-file fixes (ISSUE-001 auth token)
- Architectural decisions (ISSUE-172 plugin system)
- When unsure about approach

**Bash Agent** — Use for:
- `npm run test:fast` (returns pass/fail summary)
- `npm run typecheck` (returns error list)
- `npm run schema:commit` (returns success/fail)
- `npm run verify:safe` (returns full pipeline result)
- `git` operations
- `wc -l` for line counts

**Task Agent (Fix)** — Use for:
- Implementing a fix for a single issue
- Mechanical batch fixes (as any removal, error message improvement)
- Schema changes + handler updates

**Task Agent (Test)** — Use for:
- Writing failing tests before fixes
- Running specific test files
- Verifying regressions after fixes

### 9.3 Agent Dispatch Patterns

**Pattern 1: Serial Fix (simple issues)**
```
Main → Explore (find current code) → Main → Fix (implement) → Bash (verify) → Main (commit)
```

**Pattern 2: Parallel Research + Fix (medium issues)**
```
Main → [Explore (find code), Task (write failing test)] → Main → Fix (implement) → Bash (verify)
```

**Pattern 3: Parallel Batch (mechanical fixes)**
```
Main → [Fix Agent 1 (handler A), Fix Agent 2 (handler B), Fix Agent 3 (handler C)]
     → Bash (verify all) → Main (commit per handler)
```

**Pattern 4: Complex Fix (multi-file issues)**
```
Main → Plan (design approach) → Main (approve) → Fix (implement phase 1)
     → Bash (verify) → Fix (implement phase 2) → Bash (verify) → Main (commit)
```

### 9.4 Context Window Management

Each session has ~200K tokens. Budget them:

```
Reserved for system prompt + CLAUDE.md:     ~15K tokens
Reserved for issue context (ISSUES.md):     ~10K tokens per issue
Reserved for file reads:                    ~30K tokens per handler
Reserved for subagent results:              ~20K tokens
Available for work:                         ~125K tokens

Rule: Max 5-8 issues per session depending on complexity
```

---

## 10. NEGATIVE CONSTRAINTS (NC-01 through NC-20)

Copy these into EVERY session prompt. These are non-negotiable rules derived from 38 development sessions:

```
NC-01: NEVER modify src/schemas/*.ts without immediately running npm run schema:commit
NC-02: NEVER hardcode TOOL_COUNT or ACTION_COUNT
NC-03: NEVER edit generated files directly
NC-04: NEVER use ~, approximately, or around for line counts — always wc -l
NC-05: NEVER return MCP format from handlers — use buildToolResponse()
NC-06: NEVER silent fallback: return {} — throw typed ErrorCode error
NC-07: NEVER new Error('message') — use typed errors
NC-08: NEVER skip safety rail order: snapshot → confirm → execute
NC-09: NEVER write tests in flat format — use envelope { request: { action } }
NC-10: NEVER run full test suite in main context — delegate to subagent
NC-11: NEVER claim fix works without first writing a failing test
NC-12: NEVER use full column refs like Sheet1!A:Z
NC-13: NEVER call Google API without fields parameter
NC-14: NEVER retry 403 insufficientPermissions
NC-15: NEVER put >100 operations in single batchUpdate
NC-16: NEVER call Google API directly — wrap in executeWithRetry()
NC-17: NEVER run npm run verify in low memory — use verify:safe
NC-18: NEVER batch git commits — one per logical unit
NC-19: NEVER load all 25 handlers at session start
NC-20: sheetId=0 IS VALID — use === undefined, not !sheetId
```

---

## 11. PER-ISSUE EXECUTION PROTOCOL

### 11.1 Quick Reference Card

For EVERY issue, regardless of severity:

```
1. READ    → Open file:line from ISSUES.md, read 50-line context
2. TEST    → Write failing test demonstrating the bug (NC-11)
3. VERIFY  → Run test in subagent, confirm it FAILS
4. FIX     → Apply minimal change (≤3 files for bugs)
5. CHECK   → Run test again, confirm it PASSES
6. GATE    → npm run typecheck + check:drift (subagent)
7. COMMIT  → git add [files] && git commit -m "fix(ISSUE-XXX): ..."
8. MARK    → Update ISSUES.md: add [DONE] to issue header
```

### 11.2 Commit Message Format

```
fix(ISSUE-XXX): [concise description]

- [what was wrong]
- [what was changed]
- [which test verifies it]

Refs: ISSUES.md ISSUE-XXX
```

### 11.3 When Multiple Issues Share a File

Fix them in a single session but SEPARATE commits:

```bash
# Fix ISSUE-121 in format.ts
git add src/handlers/format.ts tests/handlers/format.test.ts
git commit -m "fix(ISSUE-121): eliminate N+1 read in rule_add_conditional_format"

# Fix ISSUE-122 in format.ts (same file, different fix)
git add src/handlers/format.ts tests/handlers/format.test.ts
git commit -m "fix(ISSUE-122): add type guard before Schema\$Request cast"
```

### 11.4 When a Fix Requires Schema Changes

```bash
# Step 1: Schema change
vim src/schemas/dimensions.ts   # Add new field/validation

# Step 2: IMMEDIATELY regenerate (NC-01)
npm run schema:commit           # Regenerates 5 files

# Step 3: Handler change
vim src/handlers/dimensions.ts  # Wire the new schema field

# Step 4: Test
vim tests/handlers/dimensions.test.ts  # Add test

# Step 5: Verify
npm run test:fast && npm run check:drift

# Step 6: Single commit (schema + handler + test = one logical unit)
git add src/schemas/dimensions.ts src/handlers/dimensions.ts tests/handlers/dimensions.test.ts
git add src/schemas/action-counts.ts src/schemas/annotations.ts  # Generated files
git commit -m "fix(ISSUE-123): add type guard for filter condition.type"
```

---

## 12. VS CODE INTEGRATION & WORKFLOW TIPS

### 12.1 Recommended Extensions

```
- Error Lens: Inline TypeScript errors (catch issues before running typecheck)
- GitLens: Blame annotations to understand why code was written this way
- Todo Tree: Track any remaining TODO/FIXME (should be 0 in src/)
- Vitest: Run individual tests from the editor gutter
- ESLint: Real-time lint feedback (if memory allows)
```

### 12.2 VS Code Tasks (`.vscode/tasks.json`)

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Verify Safe",
      "type": "shell",
      "command": "npm run verify:safe",
      "group": "test",
      "problemMatcher": "$tsc"
    },
    {
      "label": "Schema Commit",
      "type": "shell",
      "command": "npm run schema:commit",
      "group": "build"
    },
    {
      "label": "Test Fast",
      "type": "shell",
      "command": "npm run test:fast",
      "group": "test"
    },
    {
      "label": "Check Drift",
      "type": "shell",
      "command": "npm run check:drift",
      "group": "test"
    }
  ]
}
```

### 12.3 Keyboard Shortcuts for Remediation Workflow

```
Ctrl+Shift+B → Run "Verify Safe" task
Ctrl+Shift+T → Run "Test Fast" task
Ctrl+Shift+G → Open Source Control (stage + commit)
Ctrl+` → Toggle terminal (for git operations)
Ctrl+Shift+F → Search across workspace (find issue references)
```

### 12.4 Claude Code CLI Workflow

```bash
# Start a remediation session
claude --context "$(cat docs/AI_REMEDIATION_PLAYBOOK.md | head -100)"

# Or use the @ syntax to load context files
# In Claude Code prompt:
@CLAUDE.md @ISSUES.md @docs/PRODUCTION_AUDIT.md

# Run verification in background
claude --background "npm run verify:safe"

# Use subagents for parallel work
# (Claude Code handles this automatically with Task tool)
```

### 12.5 Session Management

Each Claude Code session should:

1. **Start** with the context loading prompt from Section 1.1
2. **State** the current phase and target issues
3. **Track** progress by updating ISSUES.md with `[DONE]` markers
4. **End** by updating `.serval/session-notes.md` with what was completed
5. **Verify** with the phase gate before ending

### 12.6 Handling Session Context Limits

If a session runs out of context mid-phase:

1. Note the last completed ISSUE-xxx in session-notes.md
2. Start a new session with the context loading prompt
3. Add: "Continuing from ISSUE-xxx. The following issues are already [DONE]: ..."
4. The `@.serval/session-notes.md` import will carry forward decisions

---

## APPENDIX A: ISSUE COUNT BY PHASE

| Phase | Issues | Est. Sessions | Verification Gate |
|-------|--------|---------------|-------------------|
| 0 | 0 (audit only) | 1 | No code changes |
| 1 | 8 (P0 Critical) | 1-2 | test:fast + typecheck + drift |
| 2 | 29 (P1 High) | 3-5 | verify:safe |
| 3 | 55 (P2a Code Quality) | 3-4 | verify:safe + ZERO typecheck errors |
| 4 | 45 (P2b Infrastructure) | 3-5 | verify:safe + gates |
| 5 | 101 (P3 Low + Release) | 4-6 | audit:full + npm audit |
| 6 | 0 (verification only) | 1 | ALL gates + full re-audit |
| **Total** | **234 + verification** | **16-24 sessions** | |

## APPENDIX B: FILE HOTSPOTS

Files touched by the most issues (fix these carefully):

```
src/handlers/format.ts          — 6 issues (121, 122, 179, 211, 154, 170)
src/handlers/core.ts            — 5 issues (120, 176, 115b, 118, 200)
src/handlers/data.ts            — 5 issues (156, 177, 178, 206, 208)
src/handlers/advanced.ts        — 4 issues (124, 125, 181, 210)
src/handlers/collaborate.ts     — 4 issues (126, 155, 183, 197)
src/handlers/composite.ts       — 4 issues (127, 128, 184, 169)
src/handlers/analyze.ts         — 4 issues (129, 130, 185, 209)
src/handlers/base.ts            — 3 issues (141, 142, 192)
src/handlers/appsscript.ts      — 4 issues (133, 134, 171, 203-205)
src/handlers/dependencies.ts    — 3 issues (135, 216, 217)
src/utils/retry.ts              — 2 issues (001, 143)
src/utils/circuit-breaker.ts    — 3 issues (148, 149, 162)
src/schemas/shared.ts           — 3 issues (144, 145, 195)
src/services/concurrency-coordinator.ts — 2 issues (113, 150)
src/config/env.ts               — 2 issues (159, 194)
```

## APPENDIX C: CROSS-REFERENCE — AUDIT CATEGORIES TO ISSUES

| Audit Category | ISSUES.md References |
|----------------|---------------------|
| 1. Security (86→95+) | SEC-01→ISSUE-159, SEC-02→ISSUE-193, SEC-03→ISSUE-214, SEC-04→ISSUE-214, ISSUE-003, ISSUE-004, ISSUE-160, ISSUE-161, ISSUE-215 |
| 2. Architecture (90→93+) | ARCH-01→ISSUE-none (new), ARCH-02→ISSUE-none (P3 backlog) |
| 3. Code Quality (85→95+) | CQ-01→ISSUE-026-035, CQ-02→ISSUE-169, ISSUE-120-140 (handler bugs) |
| 4. Testing (82→92+) | TEST-01→ISSUE-076-078, TEST-02→ISSUE-none (flaky tests), ISSUE-116, ISSUE-167, ISSUE-168 |
| 5. MCP Protocol (98→99+) | MCP-01→ISSUE-061-069, ISSUE-119, ISSUE-151-154 |
| 6. Performance (92→96+) | PERF-01→ISSUE-none (request merger TTL), ISSUE-112-115 |
| 7. DevOps (95→97+) | OPS-01→ISSUE-none, OPS-02→ISSUE-none |
| 8. Documentation (91→95+) | DOC-01-03→ISSUE-221, ISSUE-208-210 |
| 9. Supply Chain (78→90+) | SC-01-04→ISSUE-071 (npm audit) |
| 10. Backward Compat (82→90+) | BC-01-03→ISSUE-none (deprecation policy) |
| 11. Concurrency (75→90+) | CONC-01-05→ISSUE-011, ISSUE-012, ISSUE-092, ISSUE-113, ISSUE-147 |
| 12. Quota Mgmt (68→85+) | QUOTA-01-03→ISSUE-none (new), ISSUE-150 |
| 13. Cost Opt (71→85+) | COST-01-04→ISSUE-none (flag wiring) |
| 14. Disaster Recovery (76→88+) | DR-01-04→ISSUE-089 (partial batch), ISSUE-none (WAL) |
| 15. Compliance (62→85+) | COMP-01-04→ISSUE-088, ISSUE-090, ISSUE-103, ISSUE-117, ISSUE-165, ISSUE-166 |
| 16. Scalability (74→85+) | SCALE-01-04→ISSUE-093 (unbounded maps) |
| 17. Observability (85→93+) | OBS-01-03→ISSUE-057, ISSUE-161, ISSUE-163, ISSUE-192, ISSUE-213 |
| 18. i18n (54→72+) | I18N-01-06→ISSUE-084-086, ISSUE-218 |
| 19. Plugin Arch (28→45+) | PLUG-01-07→ISSUE-172 |
| 20. Incident Response (82→92+) | IR-01-05→ISSUE-none (runbooks, post-mortem) |

---

*Generated: 2026-02-24 | Source: ISSUES.md (234 issues) + PRODUCTION_AUDIT.md (20 categories)*
*Execution estimate: 16-24 Claude Code sessions across 7 phases*
