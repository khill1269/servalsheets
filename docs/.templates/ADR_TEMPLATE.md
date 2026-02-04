---
title: ADR-NNNN - [Decision Title]
description: [One-line summary of the decision]
category: architecture
status: [proposed|accepted|deprecated|superseded]
date: 2026-01-31
last_updated: 2026-02-04
deciders: [Names/roles of decision makers]
consulted: [Who was consulted]
informed: [Who needs to know]
version: 1.6.0
supersedes: [ADR-XXXX if applicable]
superseded_by: [ADR-YYYY if deprecated]
related_docs:
  - [/docs/architecture/related-adr.md]
tags: [architecture, decision-record]
---

# ADR-NNNN: [Decision Title]

> **Status:** [Proposed|Accepted|Deprecated|Superseded]
> **Date:** 2026-01-31
> **Deciders:** [Name 1], [Name 2]

## Context

[Describe the context and problem statement in 2-3 paragraphs:

- What situation are we in?
- What forces are at play?
- Why do we need to make a decision now?]

**Business drivers:**

- [Driver 1]
- [Driver 2]

**Technical constraints:**

- [Constraint 1]
- [Constraint 2]

**Assumptions:**

- [Assumption 1]
- [Assumption 2]

## Decision Drivers

What factors influenced this decision?

- **Priority 1:** [e.g., Performance - must handle 10K req/s]
- **Priority 2:** [e.g., Developer experience - minimize complexity]
- **Priority 3:** [e.g., Cost - stay within $X/month budget]

## Considered Options

### Option 1: [Name]

**Description:** [Brief explanation]

**Pros:**

- ✅ [Benefit 1]
- ✅ [Benefit 2]

**Cons:**

- ❌ [Drawback 1]
- ❌ [Drawback 2]

**Cost/Effort:** [Estimate]

### Option 2: [Name]

**Description:** [Brief explanation]

**Pros:**

- ✅ [Benefit 1]
- ✅ [Benefit 2]

**Cons:**

- ❌ [Drawback 1]
- ❌ [Drawback 2]

**Cost/Effort:** [Estimate]

### Option 3: [Name]

[Continue pattern for all options considered]

## Decision

**We will [chosen option] because [primary reason].**

[Expand on the decision in 1-2 paragraphs explaining:

- Why this option best fits our context
- What trade-offs we're accepting
- What makes this the right choice now]

## Decision Outcome

### Chosen: [Option Name]

**Implementation approach:**

1. [Step 1 - what we'll do first]
2. [Step 2 - next milestone]
3. [Step 3 - final state]

**Expected results:**

- [Positive consequence 1]
- [Positive consequence 2]

**Accepted trade-offs:**

- [Negative consequence we're accepting]
- [Risk we're willing to take]

### Rejected Options

**[Option Name]** - Rejected because [brief reason]
**[Option Name]** - Rejected because [brief reason]

## Consequences

### Positive

- [How this improves things]
- [What this enables]
- [Benefits we expect]

### Negative

- [What we lose by not choosing other options]
- [New problems this creates]
- [Technical debt incurred]

### Neutral

- [Changes that are neither good nor bad]
- [Things that require monitoring]

## Validation

**How we'll know this was the right decision:**

- [ ] [Metric 1 reaches target value]
- [ ] [User feedback indicates improvement]
- [ ] [No major incidents related to this change]
- [ ] [Team velocity maintained or improved]

**Review date:** [Date 3-6 months out]

## Implementation Notes

### Migration Path

```typescript
// If replacing existing system
// Phase 1: Run both systems in parallel
// Phase 2: Gradual traffic shift (10% → 50% → 100%)
// Phase 3: Deprecate old system
```

### Rollback Strategy

If this decision proves wrong:

1. [Rollback step 1]
2. [Rollback step 2]
3. [Fallback option]

## References

- [Research Document](https://link-to-research)
- [Proof of Concept PR](https://github.com/repo/pull/123)
- [Discussion Thread](https://github.com/repo/discussions/456)
- [External Resource](https://example.com/article)

## Related ADRs

- [ADR-XXXX: Related Decision](/docs/architecture/adr-xxxx.md)
- [ADR-YYYY: Dependency](/docs/architecture/adr-yyyy.md)

## Updates

| Date | Change | Reason |
|------|--------|--------|
| 2026-01-31 | Initial decision | [Context] |
| YYYY-MM-DD | [Amendment] | [Why] |

---

**Template Version:** 1.0
**ADR Format:** [MADR 3.0](https://adr.github.io/madr/)
**Last Updated:** 2026-01-31
