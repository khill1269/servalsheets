# Design-Focused Agent Template

**Model:** Sonnet (complex architecture decisions)  
**Time:** 30-45 min per session  
**Focus:** Architecture, API surface, breaking changes

## When to Use This Template

- Evaluating major architectural changes
- Designing new tool surface (adding actions across multiple tools)
- Planning API-breaking changes
- Multi-week feature projects requiring upfront design
- Cross-team coordination (multiple handler dependencies)

## Prompt Structure

### Phase 1: Context (5 min)

```markdown
# Architecture Design: [Feature Name]

**Goal:** [1-2 sentence what we're trying to achieve]

**Constraints:**
- ServalSheets is 25-tool MCP server (409 actions)
- Must not exceed Y file size limits for handlers (2k lines max)
- Must not break backward compatibility with existing clients
- [Other constraints specific to feature]

**Success Criteria:**
- [Criteria 1]
- [Criteria 2]
- [All gates pass: G0-G5]
```

### Phase 2: Design Analysis (20 min)

Ask agent to analyze:

```markdown
## Design Questions

1. **Tool Surface**
   - Should we extend existing tools or create new ones?
   - Justify: new tools add discovery burden; extending tools increases complexity
   - Precedent: F4-F6 extended existing tools instead of creating new ones

2. **Schema Design**
   - Are all parameters necessary or can we use optional + defaults?
   - Are discriminated unions the right pattern?
   - Precedent: Look at sheets_analyze.comprehensive (26 optional params) vs sheets_data.read (2 required)

3. **Handler Decomposition**
   - If handler grows >1000 lines, split into submodules?
   - Pattern: sheets_analyze uses tier-based architecture (scout → comprehensive → drill-down)

4. **Service Dependencies**
   - What new services do we need?
   - Can we reuse existing services (CachedSheetsApi, BatchCompiler, etc.)?
   - Pattern: Composite handler reuses sheets_data, sheets_format, sheets_dimensions internally

5. **Error Handling**
   - What errors are expected?
   - What typed error classes do we need?
   - Pattern: All errors extend ServiceError or handler-specific base

6. **Testing Strategy**
   - Success + error paths per action
   - Property-based tests for parsers/validators
   - Integration tests for cross-tool coordination

7. **Migration/Breaking Changes**
   - Is this a breaking change to existing actions?
   - Can we do it non-breaking?
   - Example: Renaming write_range → write was breaking; added deprecation period first
```

### Phase 3: Design Document (15 min)

Agent produces:

```markdown
## Recommended Design

### Tool Extension Strategy
- Extend [tool1], [tool2] (total +N actions)
- Keep 25-tool surface (no new tools)
- Justification: [reasoning]

### Schema Decisions
- Action 1: [discriminated union structure]
- Action 2: [optional params with defaults]
- Validation: [custom validators needed]

### Handler Architecture
- Tool 1 handler: [current lines] → [projected lines]
  - Submodule strategy: [if needed]
- Reused services: [list]
- New services: [list]

### Error Model
- New error classes: [list]
- Reused error codes: [list]

### Testing Plan
- Unit tests: [X per action]
- Property-based: [which parsers/validators]
- Integration: [scenarios]

### Risks & Mitigations
- Risk 1: [description] → Mitigation: [approach]
- Risk 2: [description] → Mitigation: [approach]

### Timeline Estimate
- Research: 1 session
- Implementation: 2-3 sessions
- Validation: 1 session
- Total: 4-5 sessions

### File Changes Summary
- src/schemas/: [list]
- src/handlers/: [list]
- src/services/: [list]
- tests/: [list]
```

## Example Usage

**User Request:** "Design the scenario modeling feature (F6)"

**Agent Output:**

```markdown
# Architecture Design: Scenario Modeling (F6)

Goal: Enable what-if analysis by tracing formula dependencies and recalculating impacts.

Constraints:
- Must not exceed 550 lines for new service
- Must reuse existing ImpactAnalyzer (dependency graph)
- Must support side-by-side scenario comparison

## Design Decisions

### Tool Extension Strategy
- Extend sheets_dependencies (add 3 actions: model_scenario, compare_scenarios, create_scenario_sheet)
- Keeps 25-tool surface; dependencies tool goes from 7→10 actions

### Schema Design
```typescript
z.discriminatedUnion('action', [
  z.object({
    action: z.literal('model_scenario'),
    spreadsheetId: SpreadsheetIdSchema,
    changes: z.array(z.object({
      cell: A1NotationSchema,
      newValue: z.any(),
    })),
    outputRange: A1NotationSchema.optional(),
  }),
  // ... compare_scenarios, create_scenario_sheet
]);
```

### Handler: sheets_dependencies
- Current: 248 lines
- Projected: ~380 lines (3 new handler methods)
- New service: ScenarioEngine (550 lines)

### Error Model
- Reuse: SheetNotFoundError, RangeNotFoundError
- New: FormulaEvaluationError (for unsupported functions)

### Testing
- Unit: 1 test per action (3 actions = 3 tests minimum) + error paths = ~6 tests
- Property-based: Formula evaluator edge cases
- Integration: Multi-step scenario modeling

### Risks
1. Formula evaluator may not support all Google Sheets functions
   → Mitigation: Flag unsupported functions, show dependency chain only
2. Large datasets may timeout during simulation
   → Mitigation: Use TieredRetrieval, stream progress

### Timeline
- Research: 1 session (find similar formula evaluation code, dependency graph patterns)
- Implementation: 2 sessions (ScenarioEngine + 3 handler methods + tests)
- Validation: 1 session (verify G0-G5 gates, integration tests)
- Total: 4 sessions
```

## Key Design Patterns to Reference

### Pattern 1: Tool Extension (vs New Tool)

**Why extend existing tools?**
- Clients don't need to discover new tools (discovery burden)
- Existing schema validation infrastructure reused
- Handler class already exists

**Precedent:** All 6 P4 features (F1-F6) extended existing tools; no new tools created

### Pattern 2: Service Decomposition

**When to create new service?**
- Handler becomes >1000 lines
- Logic is reusable across multiple handlers
- Logic is complex enough to warrant unit tests

**Precedent:** sheets_analyze uses 15+ specialized services (scout, comprehensive, confidence-scorer, etc.)

### Pattern 3: Schema Simplification

**Avoid over-specification:**
- Don't require params that have sensible defaults
- Don't require mutually exclusive params (use optional + validation)

**Precedent:** sheets_analyze.comprehensive has 26 optional params; client can skip most of them

## Checklist Before Implementation

- [ ] Architecture reviewed and approved (design doc is final)
- [ ] Schema structure finalized (discriminated union shape)
- [ ] Handler decomposition strategy clear
- [ ] Service dependencies identified
- [ ] Error model complete (all error cases have typed errors)
- [ ] Testing strategy documented
- [ ] File count estimate matches reality (typically within 10%)
- [ ] Timeline estimate is realistic (assume 20% buffer for unknowns)
