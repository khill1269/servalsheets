---
title: 'Part 1: Functional Features (Categories 1-12)'
category: general
last_updated: 2026-01-31
description: 'Weight: 46% of base score'
version: 1.6.0
---

# Part 1: Functional Features (Categories 1-12)

**Weight: 46% of base score**

---

## Category 1: Authentication & Authorization (5%)

### Requirements

- [ ] OAuth 2.0/2.1 with PKCE
- [ ] Token encryption (AES-256-GCM)
- [ ] Minimal scopes (drive.file)
- [ ] Per-user session isolation
- [ ] Token never exposed to LLM

### Files to Check

```
src/handlers/auth.ts
src/schemas/auth.ts
src/services/token-store.ts
src/services/token-manager.ts
```

### Questions

1. Does sheets_auth have status, login, callback, logout actions?
2. Is PKCE enforced?
3. Are tokens encrypted at rest?
4. Is session isolation implemented?

---

## Category 2: Core Data Operations (8%)

### Requirements

- [ ] Batch API calls (batchGet, batchUpdate)
- [ ] Intelligent caching with TTL
- [ ] Atomic transactions
- [ ] 429 error handling with backoff
- [ ] Large range handling (>10K cells)

### Files to Check

```
src/handlers/values.ts
src/handlers/cells.ts
src/core/batch-compiler.ts
src/services/batching-system.ts
src/utils/cache-manager.ts
```

### Questions

1. How many actions does sheets_data support? (target: 9+)
2. Is automatic batching implemented?
3. What's the cache TTL?
4. Is there a transaction tool?

---

## Category 3: Formatting & Styling (4%)

### Requirements

- [ ] BatchUpdate for format changes
- [ ] Number formats (not strings)
- [ ] Theme color support
- [ ] Conditional formatting

### Files to Check

```
src/handlers/format.ts
src/handlers/dimensions.ts
src/schemas/format.ts
```

### Questions

1. How many format actions?
2. Can conditional formatting be applied?
3. Are theme colors supported?

---

## Category 4: Data Rules & Validation (3%)

### Requirements

- [ ] Data validation rules
- [ ] Custom formula validation
- [ ] Protected ranges
- [ ] Named ranges

### Files to Check

```
src/handlers/rules.ts
src/handlers/advanced.ts
src/services/validation-engine.ts
```

### Questions

1. What validation types supported?
2. Can formulas be validated?
3. Is protection implemented?

---

## Category 5: Visualization (4%)

### Requirements

- [ ] Common chart types (bar, line, pie)
- [ ] Chart placement control
- [ ] Pivot tables with aggregations
- [ ] Filter views

### Files to Check

```
src/handlers/charts.ts
src/handlers/pivot.ts
src/handlers/filter-sort.ts
```

### Questions

1. What chart types supported?
2. Are pivot aggregations working?
3. Is filter view implemented?

---

## Category 6: Collaboration (3%)

### Requirements

- [ ] Drive API sharing
- [ ] Confirmation before sharing
- [ ] Comments with cell anchoring
- [ ] Session context

### Files to Check

```
src/handlers/sharing.ts
src/handlers/comments.ts
src/services/session-context.ts
```

### Questions

1. Does sharing require confirmation?
2. Can comments anchor to cells?
3. Is session tracking active spreadsheets?

---

## Category 7: Version Control (3%)

### Requirements

- [ ] List revisions (Drive API)
- [ ] Named snapshots
- [ ] Operation history (undo)
- [ ] Restoration capability

### Files to Check

```
src/handlers/versions.ts
src/handlers/history.ts
src/services/snapshot.ts
```

### Questions

1. How many version actions?
2. Are snapshots automatic before destructive ops?
3. Can operations be rolled back?

---

## Category 8: Data Analysis & AI (4%)

### Requirements

- [ ] Deterministic analysis (stats, outliers)
- [ ] AI analysis via MCP Sampling
- [ ] Data size limits for AI
- [ ] Analysis prompt templates

### Files to Check

```
src/handlers/analysis.ts
src/handlers/analyze.ts
src/mcp/sampling.ts
```

### Questions

1. What deterministic analyses available?
2. Does sheets_analyze use Sampling?
3. How is large data sampled?

---

## Category 9: Advanced Functions (3%)

### Requirements

- [ ] Formula generation
- [ ] Templates (CRM, inventory)
- [ ] Request deduplication
- [ ] Composite operations

### Files to Check

```
src/handlers/advanced.ts
src/handlers/composite.ts
src/knowledge/templates/
```

### Questions

1. What advanced actions available?
2. Are templates pre-built?
3. Is request dedup working?

---

## Category 10: Enterprise Safety (5%)

### Requirements

- [ ] Confirmation for destructive actions
- [ ] Impact assessment
- [ ] Transaction with rollback
- [ ] Dry-run/preview mode
- [ ] Automatic snapshots
- [ ] Conflict detection

### Files to Check

```
src/handlers/confirm.ts
src/handlers/impact.ts
src/handlers/transaction.ts
src/handlers/conflict.ts
src/services/snapshot.ts
```

### Questions

1. What triggers confirmation?
2. Is impact analysis available?
3. Does transaction support dry-run?
4. Are snapshots automatic?

---

## Category 11: Composite Operations (2%)

### Requirements

- [ ] Multi-step composite tools
- [ ] SKILL.md for LLM guidance
- [ ] Workflow pattern docs
- [ ] Usage examples

### Files to Check

```
src/handlers/composite.ts
src/knowledge/workflow-patterns.json
docs/guides/SKILL.md
```

### Questions

1. What composite actions available?
2. Is SKILL.md present?
3. How many examples exist?

---

## Category 12: Security & Oversight (2%)

### Requirements

- [ ] Tool allowlisting
- [ ] Input validation
- [ ] Elicitation for clarification
- [ ] Logging with redaction
- [ ] Rate limiting

### Files to Check

```
src/security/
src/utils/logger.ts
src/utils/redact.ts
src/mcp/elicitation.ts
```

### Questions

1. Can tools be disabled?
2. Is input validated?
3. Are sensitive values redacted?
4. Is rate limiting per-session?

---

## Scoring Summary (Part 1)

| Category         | Weight  | Score (0-10) | Weighted |
| ---------------- | ------- | ------------ | -------- |
| 1. Auth          | 5%      | \_\_\_       | \_\_\_   |
| 2. Data Ops      | 8%      | \_\_\_       | \_\_\_   |
| 3. Formatting    | 4%      | \_\_\_       | \_\_\_   |
| 4. Rules         | 3%      | \_\_\_       | \_\_\_   |
| 5. Visualization | 4%      | \_\_\_       | \_\_\_   |
| 6. Collaboration | 3%      | \_\_\_       | \_\_\_   |
| 7. Versioning    | 3%      | \_\_\_       | \_\_\_   |
| 8. AI Analysis   | 4%      | \_\_\_       | \_\_\_   |
| 9. Advanced      | 3%      | \_\_\_       | \_\_\_   |
| 10. Safety       | 5%      | \_\_\_       | \_\_\_   |
| 11. Composite    | 2%      | \_\_\_       | \_\_\_   |
| 12. Security     | 2%      | \_\_\_       | \_\_\_   |
| **Total**        | **46%** |              |          |
