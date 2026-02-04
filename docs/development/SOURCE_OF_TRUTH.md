---
title: ServalSheets - Source of Truth Reference
category: development
last_updated: 2026-01-31
description: 'Last Updated: 2026-01-20'
version: 1.6.0
tags: [sheets, prometheus]
---

# ServalSheets - Source of Truth Reference

**Last Updated:** 2026-01-20
**Purpose:** Single authoritative reference for all quantitative facts about the codebase

---

## 📊 Core Metrics

### Tool & Action Counts

| Metric           | Source File            | Line              | Current Value | Verification Command                                    |
| ---------------- | ---------------------- | ----------------- | ------------- | ------------------------------------------------------- |
| **TOOL_COUNT**   | `src/schemas/index.ts` | exported constant | `19`          | `grep "export const TOOL_COUNT" src/schemas/index.ts`   |
| **ACTION_COUNT** | `src/schemas/index.ts` | exported constant | `244`         | `grep "export const ACTION_COUNT" src/schemas/index.ts` |

**Verification:**

```bash
# Run metadata generator and check output
npm run check:drift

# Output should show:
# ✅ Total: 21 tools, 293 actions
```

**⚠️ CRITICAL:** Never hardcode `53` or `188` or any other outdated values. Always verify from source.

---

## 📦 Dependencies

### Core Dependencies

| Package                       | Version    | Source         | Purpose                           |
| ----------------------------- | ---------- | -------------- | --------------------------------- |
| **@modelcontextprotocol/sdk** | `^1.25.2`  | `package.json` | MCP protocol implementation       |
| **googleapis**                | `^170.0.0` | `package.json` | Google Sheets/Drive APIs          |
| **zod**                       | `4.3.5`    | `package.json` | Schema validation (EXACT version) |
| **express**                   | `^5.2.1`   | `package.json` | HTTP server                       |
| **p-queue**                   | `^9.0.1`   | `package.json` | Concurrency control               |
| **lru-cache**                 | `^11.0.0`  | `package.json` | In-memory caching                 |
| **winston**                   | `^3.17.0`  | `package.json` | Logging                           |
| **prom-client**               | `^15.1.3`  | `package.json` | Prometheus metrics                |

**Verification:**

```bash
cat package.json | jq '.dependencies'
```

---

## 🏗️ Architecture

### Protocol Version

| Item                 | Source File      | Line | Value                                              |
| -------------------- | ---------------- | ---- | -------------------------------------------------- |
| **MCP Protocol**     | `src/version.ts` | 14   | `2025-11-25`                                       |
| **Version Constant** | `src/version.ts` | 14   | `export const MCP_PROTOCOL_VERSION = '2025-11-25'` |

**Verification:**

```bash
grep "MCP_PROTOCOL_VERSION" src/version.ts
```

---

## 📂 File Metrics

### Line Counts

Run `wc -l <file>` to get exact counts. **Do not estimate.**

| File                     | Lines (Actual) | Command                      |
| ------------------------ | -------------- | ---------------------------- |
| **src/server.ts**        | 920            | `wc -l src/server.ts`        |
| **src/handlers/base.ts** | 654            | `wc -l src/handlers/base.ts` |

**⚠️ NEVER use estimates like "~760" or "~400"** - always run `wc -l` for accuracy.

---

## 🛠️ Tools Breakdown

### Per-Tool Action Counts

**Source:** `npm run check:drift` output or `src/schemas/annotations.ts`

| Tool                 | Actions | Schema File                  |
| -------------------- | ------- | ---------------------------- |
| `sheets_auth`        | 5       | `src/schemas/auth.ts`        |
| `sheets_core`        | 17      | `src/schemas/core.ts`        |
| `sheets_data`        | 14      | `src/schemas/data.ts`        |
| `sheets_format`      | 24      | `src/schemas/format.ts`      |
| `sheets_dimensions`  | 35      | `src/schemas/dimensions.ts`  |
| `sheets_visualize`   | 15      | `src/schemas/visualize.ts`   |
| `sheets_collaborate` | 21      | `src/schemas/collaborate.ts` |
| `sheets_advanced`    | 27      | `src/schemas/advanced.ts`    |
| `sheets_transaction` | 10      | `src/schemas/transaction.ts` |
| `sheets_quality`     | 14      | `src/schemas/quality.ts`     |
| `sheets_history`     | 8       | `src/schemas/history.ts`     |
| `sheets_confirm`     | 5       | `src/schemas/confirm.ts`     |
| `sheets_analyze`     | 11      | `src/schemas/analyze.ts`     |
| `sheets_fix`         | 8       | `src/schemas/fix.ts`         |
| `sheets_composite`   | 6       | `src/schemas/composite.ts`   |
| `sheets_session`     | 8       | `src/schemas/session.ts`     |
| `sheets_templates`   | 8       | `src/schemas/templates.ts`   |
| `sheets_bigquery`    | 8       | `src/schemas/bigquery.ts`    |
| `sheets_appsscript`  | 8       | `src/schemas/appsscript.ts`  |
| **TOTAL**            | **244** | —                            |

**Verification:**

```bash
npm run check:drift | grep "Total:"
# Output: ✅ Total: 21 tools, 293 actions
```

---

## 🔄 Generated Files (DO NOT Edit Manually)

These files are **automatically generated** by `scripts/generate-metadata.ts`:

| File                         | What It Contains                          | Updated By             |
| ---------------------------- | ----------------------------------------- | ---------------------- |
| `package.json`               | Description with tool/action counts       | `npm run gen:metadata` |
| `src/schemas/index.ts`       | `TOOL_COUNT` and `ACTION_COUNT` constants | `npm run gen:metadata` |
| `src/schemas/annotations.ts` | `ACTION_COUNTS` per-tool breakdown        | `npm run gen:metadata` |
| `src/mcp/completions.ts`     | `TOOL_ACTIONS` for autocompletion         | `npm run gen:metadata` |
| `server.json`                | Full MCP server metadata                  | `npm run gen:metadata` |

**Input Source (Source of Truth):**

- `src/schemas/*.ts` - Individual tool schemas with `z.enum([...])` action arrays

**Workflow:**

```bash
# 1. Modify a schema file
code src/schemas/values.ts

# 2. Regenerate metadata
npm run gen:metadata

# 3. Verify no drift
npm run check:drift

# 4. Review changes
git diff package.json src/schemas/index.ts src/schemas/annotations.ts src/mcp/completions.ts server.json
```

**⚠️ NEVER edit these 5 files directly** - changes will be overwritten.

---

## 🗑️ Deleted Files (Historical Reference)

Files that were intentionally removed and should NOT be referenced:

| File                                 | Deleted Date | Reason                                      | Git Evidence                                              |
| ------------------------------------ | ------------ | ------------------------------------------- | --------------------------------------------------------- |
| `src/mcp/sdk-compat.ts`              | 2026-01-11   | Schema flattening complete, native SDK used | `git status` shows `D src/mcp/sdk-compat.ts`              |
| `tests/contracts/sdk-compat.test.ts` | 2026-01-11   | Test for deleted file                       | `git status` shows `D tests/contracts/sdk-compat.test.ts` |

**Verification:**

```bash
git status | grep "^D"
# Output:
# D src/mcp/sdk-compat.ts
# D tests/contracts/sdk-compat.test.ts
```

**If you see references to these files in code/docs:** They are outdated and should be removed.

---

## 🔍 How to Verify Any Claim

### Rule: Every Factual Claim Needs Evidence

**Format:**

```
Claim: <statement>
Evidence: <file:line> OR <command → output>
```

**Examples:**

✅ **Good:**

```
Claim: ServalSheets has 293 actions
Evidence: src/schemas/index.ts exports ACTION_COUNT = 207
Command: grep "export const ACTION_COUNT" src/schemas/index.ts
Output: export const ACTION_COUNT = 207;
```

❌ **Bad:**

```
Claim: ServalSheets has 53 actions
Evidence: (none)
```

### Verification Commands Cheat Sheet

```bash
# Tool/Action counts
npm run check:drift | grep "Total:"

# Line counts
wc -l src/server.ts src/handlers/base.ts

# Protocol version
grep "MCP_PROTOCOL_VERSION" src/version.ts

# Dependency versions
cat package.json | jq '.dependencies'

# Git status (deleted files)
git status | grep "^D"

# TypeScript errors
npm run typecheck 2>&1 | grep "error TS"

# Placeholder check
npm run check:placeholders

# Full verification
npm run verify
```

---

## 📋 Quick Reference: Current Values (2026-01-20)

```
TOOL_COUNT:         19
ACTION_COUNT:       244
MCP_PROTOCOL:       2025-11-25
ZOD_VERSION:        4.3.5
SDK_VERSION:        ^1.25.2
GOOGLEAPIS_VERSION: ^170.0.0

Line Counts:
  src/server.ts:         920 lines
  src/handlers/base.ts:  654 lines

Build Status:
  npm run verify:      ✅ PASSING
  TypeScript:          ✅ 0 errors
  Placeholders:        ✅ None found
  Metadata Drift:      ✅ PASSING
```

**Last Verified:** 2026-01-20 via `npm run verify`

---

## 🔗 Related Documentation

- **CLAUDE.md** - Development rules with source of truth reference
- **PROJECT_STATUS.md** - Current build status and active issues
- **CLAUDE_CODE_RULES.md** - Full development rules with examples
- **FULL_PROJECT_ANALYSIS.md** - Comprehensive analysis (with audit corrections)

---

## 🤖 For AI Assistants

**When analyzing this codebase:**

1. **ALWAYS verify claims** from the source files listed in this document
2. **NEVER trust outdated documentation** - run verification commands
3. **NEVER hardcode metric values** - reference source files with `file:line`
4. **Check PROJECT_STATUS.md** for current build state before claiming "everything works"
5. **Use verification commands** from this document to prove claims

**Example of proper verification:**

```
Q: How many actions does ServalSheets have?
A: Let me verify...

Command: grep "export const ACTION_COUNT" src/schemas/index.ts
Output: export const ACTION_COUNT = 207;

ServalSheets has 293 actions across 21 tools.
Evidence: src/schemas/index.ts exports ACTION_COUNT = 207
```

---

**This document is the single authoritative reference for all quantitative facts about ServalSheets. When in doubt, verify from source.**
