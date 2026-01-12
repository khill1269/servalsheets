# Agent Orchestration Plan for ServalSheets TODO Completion

**Analysis Date**: 2026-01-07
**Total Remaining Tasks**: 21 tasks (Phase 1-5)
**Phase 0 Status**: ✅ COMPLETE (5/5 tasks done)

---

## Executive Summary

**Estimated Total Duration**: 57 hours of work (Phases 1-5 only)
**Optimal Execution**: 5 orchestration hops (waves) with parallel agent execution
**Compressed Timeline**: ~2-3 weeks with parallel execution vs 4-5 weeks sequential
**Verification Strategy**: Multi-layer validation using VS Code tasks, npm scripts, and GitHub Actions

**Strategic Update (2026-01-07)**: Phase 2.5 (Tool Consolidation) has been deferred until after Phases 1-5 complete. Focus is on achieving full functionality and production readiness with the current 24-tool architecture before reconsidering consolidation.

---

## Orchestration Strategy: 5-Hop Architecture

### Wave 1 (Hop 1): Phase 1 - MCP Protocol Compliance Foundation
**Duration**: ~18 hours (8 independent tasks)
**Can Execute in Parallel**: YES - 8 agents simultaneously

#### Tasks in Wave 1:
1. **Task 1.1**: Forward Complete MCP Context (3h)
   - Files: `src/server.ts`, `src/mcp/registration.ts`
   - Agent: General-purpose or Plan agent
   - Verification: Test requestId/signal flow

2. **Task 1.2**: Return MCP Tool Errors (2h)
   - Files: `src/mcp/registration.ts`
   - Agent: General-purpose agent
   - Verification: Trigger tool errors in HTTP/remote

3. **Task 1.3**: Fix History Undo/Revert (2h)
   - Files: `src/handlers/index.ts`, `src/handlers/history.ts`
   - Agent: General-purpose agent
   - Verification: Test undo/revert operations

4. **Task 1.4**: Register sheets_fix Tool (1h)
   - Files: `src/mcp/registration.ts`, `README.md`
   - Agent: General-purpose agent (quick task)
   - Verification: `tools/list` includes sheets_fix

5. **Task 1.5**: Register Logging Handler (1h)
   - Files: `src/server.ts`, `src/mcp/logging.ts`
   - Agent: General-purpose agent (quick task)
   - Verification: `logging/setLevel` works

6. **Task 1.6**: Wire Completions (3h)
   - Files: `src/server.ts`, `src/mcp/completions.ts`
   - Agent: General-purpose agent
   - Verification: Completions return correct actions

7. **Task 1.7**: Add Resource Parity (2h)
   - Files: `src/server/http-server.ts`, `src/server/remote-server.ts`
   - Agent: General-purpose agent
   - Verification: All resources available in HTTP/remote

8. **Task 1.8**: Wire sheets_auth (2h)
   - Files: `src/server/http-server.ts`, `src/server/remote-server.ts`
   - Agent: General-purpose agent
   - Verification: Auth status correct in HTTP

**Wave 1 Verification Strategy**:
```bash
# Run after all Wave 1 agents complete
npm run typecheck          # Type safety
npm test -- --run          # Unit tests
npm run build              # Build verification
npm run test:integration   # Integration tests
```

**VS Code Task**: "CI Gate (Build+Test+Typecheck)"

---

### Wave 2 (Hop 2): Phase 2 - Single Source of Truth
**Duration**: ~11 hours (3 tasks, 1 depends on others)
**Parallel Execution**: Partial (2.1 must complete before 2.2)

#### Tasks in Wave 2:
1. **Task 2.1**: Generate Counts/Actions from Schemas (6h) ⚠️ CRITICAL PATH
   - Files: `scripts/generate-metadata.ts`, all schemas
   - Agent: Plan agent (complex refactoring)
   - Dependencies: None
   - Verification: Counts match reality (23 tools, 188 actions)
   - **Must complete before 2.2**

2. **Task 2.2**: Add CI Guard for Metadata Drift (2h)
   - Files: `scripts/check-metadata-drift.sh`
   - Agent: General-purpose agent
   - Dependencies: **Task 2.1 must complete first**
   - Verification: CI fails on drift, passes after generator

3. **Task 2.3**: Generate Tool Descriptions for /info (3h)
   - Files: `src/schemas/annotations.ts`, `src/schemas/descriptions.ts`
   - Agent: General-purpose agent
   - Dependencies: None (can run parallel with 2.1)
   - Verification: GET /info returns descriptions

**Execution Order**:
- **Parallel Group A**: Task 2.1, Task 2.3 (run simultaneously)
- **Sequential Group B**: Task 2.2 (waits for 2.1)

**Wave 2 Verification**:
```bash
npm run gen:metadata       # Verify generator works
npm run check:drift        # Verify drift detection
npm run build              # Rebuild with new metadata
npm run validate:server-json  # Verify server.json
```

**VS Code Task**: "08 - Check Drift" + "09 - Validate server.json"

---

### Wave 3 (Hop 3): Phase 3 - Documentation & Consistency
**Duration**: ~4 hours (3 independent tasks)
**Can Execute in Parallel**: YES - 3 agents simultaneously

#### Tasks in Wave 3:
1. **Task 3.1**: Remove References to Deleted Tools (2h)
   - Files: `README.md`, `TOOLS_INTEGRATION_COMPLETE.md`
   - Agent: General-purpose agent
   - Search: sheets_workflow, sheets_insights, sheets_plan
   - Verification: No broken references

2. **Task 3.2**: Update Prompt Copy with Correct Counts (1h)
   - Files: `src/mcp/features-2025-11-25.ts`, `src/mcp/registration.ts`
   - Agent: General-purpose agent (quick task)
   - Verification: Prompts show "23 tools, 188 actions"

3. **Task 3.3**: Update well-known.ts Capabilities (1h)
   - Files: `src/server/well-known.ts`
   - Agent: General-purpose agent (quick task)
   - Verification: GET /.well-known/mcp shows subscriptions: false

**Wave 3 Verification**:
```bash
npm run build              # Rebuild
npm run format:check       # Documentation formatting
npm run verify             # Full verification
```

**VS Code Task**: "Full Verification (verify script)"

---

### Wave 4 (Hop 4): Phase 4 - Auth & API Hardening
**Duration**: ~9 hours (3 independent tasks)
**Can Execute in Parallel**: YES - 3 agents simultaneously

#### Tasks in Wave 4:
1. **Task 4.1**: Verify Scope Coverage (4h)
   - Files: All handlers, `src/auth/scopes.ts`
   - Agent: Plan agent (requires analysis)
   - Verification: Scope matrix, test without required scopes

2. **Task 4.2**: Add Token Redaction (2h)
   - Files: `src/utils/google-api.ts`, `src/utils/error-factory.ts`
   - Agent: General-purpose agent
   - Verification: Tokens redacted in error logs

3. **Task 4.3**: Validate Retry/Error Mapping (3h)
   - Files: Integration tests
   - Agent: General-purpose agent
   - Verification: Integration tests pass with TEST_REAL_API=true

**Wave 4 Verification**:
```bash
npm run test:coverage      # Verify test coverage increased
npm run test:integration   # Run integration suite
npm run security:audit     # Security check
```

**VS Code Task**: "Test Coverage" + "Test Integration"

---

### Wave 5 (Hop 5): Phase 5 - Release Cleanup
**Duration**: ~7 hours (4 tasks, mostly sequential)
**Parallel Execution**: Limited (some dependencies)

#### Tasks in Wave 5:
1. **Task 5.1**: Verify TypeScript/Zod Compile (1h)
   - Agent: General-purpose agent
   - Verification: `npm run typecheck` + `npm run build`

2. **Task 5.2**: Verify Dist Artifact Parity (2h)
   - Agent: General-purpose agent
   - Verification: dist/ matches src/, server starts

3. **Task 5.3**: Update package.json Prepack Hook (1h)
   - Files: `package.json`
   - Agent: General-purpose agent
   - Verification: `npm pack` runs generator

4. **Task 5.4**: Final Validation Checklist (3h)
   - Agent: General-purpose agent
   - Comprehensive testing and documentation

**Wave 5 Verification**:
```bash
npm run ci                 # Full CI pipeline
npm pack --dry-run         # Verify prepack works
node dist/cli.js --version # Smoke test
```

**VS Code Task**: "Full CI Pipeline"

---

## Phase 2.5: Tool Consolidation (24→11 Tools) ⏸️ DEFERRED
**Duration**: 8+ hours
**Status**: ⏸️ **DEFERRED** - Not in critical path
**Decision Date**: 2026-01-07
**Priority**: P3 (Future Enhancement)

**Strategic Decision**: This phase has been officially **deferred** until after Phases 1-5 complete and the system is production-stable.

**Rationale for Deferral**:
1. Major breaking change requiring client migration
2. Current 24-tool architecture is MCP-compliant and functional
3. Needs real-world usage feedback before architectural changes
4. Requires extensive backward compatibility work
5. Focus needed on fixing existing issues and establishing metadata reliability

**When to Revisit**:
- After all Phases 1-5 tasks completed
- System stable in production
- User feedback collected on current architecture
- Performance metrics and LLM usage patterns analyzed
- Stakeholder approval obtained

This is a potential future enhancement that should be:
1. Planned separately with user/stakeholder input
2. Executed only after core functionality is proven stable
3. Rolled out with full backward compatibility
4. Validated against real-world usage patterns

---

## Verification Matrix

### Layer 1: Per-Task Verification (Agent Level)
Each agent executes task-specific verification:
- Unit tests for changed code
- Integration tests for affected features
- Manual testing steps from TODO checklist

### Layer 2: Per-Wave Verification (Orchestrator Level)
After each wave completes:
```bash
# Quick verification
npm run typecheck
npm test -- --run
npm run build

# Deep verification (after Waves 2, 4, 5)
npm run verify
npm run ci
```

### Layer 3: VS Code Tasks (Developer Level)
Use VS Code task runner for structured validation:
- **During Development**: Individual tasks (Build, Test, Typecheck)
- **After Each Wave**: "CI Gate (Build+Test+Typecheck)"
- **Before Next Wave**: "Phase Complete Gate (All Checks)"
- **Final Validation**: "Full CI Pipeline"

### Layer 4: GitHub Actions (Continuous Integration)
Automated validation on every commit:
- Type checking
- Linting
- Unit tests
- Build verification
- Security audit

### Layer 5: Final Release Gate
Before release (Task 5.4):
```bash
npm run ci                      # Full pipeline
npm run validate:server-json    # Schema validation
npm run test:coverage           # Coverage check
npm pack --dry-run              # Package test
npm run smoke                   # Basic functionality
```

---

## Resource Utilization Analysis

### Optimal Agent Allocation
**Maximum Parallelism**: 8 agents (Wave 1)
**Typical Parallelism**: 3 agents (Waves 3, 4)
**Sequential Bottlenecks**: Task 2.1→2.2, Wave 5 tasks

### Compute Resources
- **Memory**: ~500MB per agent (TypeScript compilation)
- **CPU**: Parallel builds benefit from multi-core
- **Disk**: ~100MB per agent workspace (if isolated)

### Test Execution Strategy
1. **Unit Tests**: Run in parallel across agents (fast, isolated)
2. **Integration Tests**: Run sequentially (require shared state)
3. **CI Pipeline**: Run after each wave completion
4. **Coverage Reports**: Generate after Wave 4 (security focus)

---

## Risk Mitigation

### Critical Path Dependencies
1. **Task 2.1 blocks 2.2**: Generate metadata before drift checking
2. **Wave 1 stability**: MCP protocol fixes affect all subsequent work
3. **Build failures**: Any wave can break the build pipeline

### Mitigation Strategy
1. **Incremental Commits**: Commit after each task completion
2. **Rollback Points**: Tag each wave completion
3. **Continuous Validation**: Run `npm run verify` after each wave
4. **Agent Checkpoints**: Save agent state for resume capability

---

## Timeline Comparison

### Sequential Execution (Current Approach)
- **Week 1**: Phase 1 (8 tasks × 2-3h avg = 18h)
- **Week 2**: Phase 2 (3 tasks = 11h)
- **Week 3**: Phase 3 + Phase 4 start (13h)
- **Week 4**: Phase 4 completion + Phase 5 (16h)
- **Total**: 4-5 weeks

### Parallel Execution (Orchestrated Approach)
- **Week 1**: Wave 1 (18h work, ~3-4 days wall time with 8 agents)
- **Week 1-2**: Wave 2 (11h work, ~2 days with 2-3 agents)
- **Week 2**: Wave 3 (4h work, ~1 day with 3 agents)
- **Week 2-3**: Wave 4 (9h work, ~2 days with 3 agents)
- **Week 3**: Wave 5 (7h work, ~1-2 days)
- **Total**: 2-3 weeks

**Time Savings**: ~40-50% reduction with optimal parallelization

---

## Recommended Execution Commands

### Starting a Wave
```bash
# Ensure clean state
git status
npm run verify

# Create wave branch
git checkout -b wave-N-description

# Dispatch agents (see per-wave sections above)
```

### Completing a Wave
```bash
# Run wave verification
npm run typecheck
npm test -- --run
npm run build
npm run verify  # Optional: full check

# Commit wave completion
git add .
git commit -m "feat(wave-N): Complete [description]"
git push origin wave-N-description

# Merge and tag
git checkout main
git merge wave-N-description
git tag wave-N-complete
git push --tags
```

### Emergency Rollback
```bash
# Identify last good state
git log --oneline --graph

# Rollback
git reset --hard wave-N-complete
git push --force origin main  # Use with caution
```

---

## Verification Checklist Template

Use this for each wave completion:

```markdown
## Wave N Verification

### Build & Type Safety
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] No TypeScript errors
- [ ] Dist artifacts generated

### Testing
- [ ] `npm test -- --run` passes (unit tests)
- [ ] `npm run test:integration` passes (if applicable)
- [ ] New tests added for changed functionality
- [ ] Test coverage maintained or improved

### Code Quality
- [ ] `npm run lint` passes
- [ ] `npm run format:check` passes
- [ ] No placeholders remaining (`npm run check:placeholders`)
- [ ] No metadata drift (`npm run check:drift`)

### Functional Verification
- [ ] Manual testing of changed features
- [ ] Integration tests pass
- [ ] Server starts without errors (`npm run smoke`)

### Documentation
- [ ] README.md updated (if needed)
- [ ] CHANGELOG.md updated
- [ ] Inline documentation added

### Commit
- [ ] Changes committed with descriptive message
- [ ] Branch merged to main
- [ ] Tag created: `wave-N-complete`
```

---

## Conclusion

**Best Approach**: Execute as 5 orchestrated waves with maximum parallelization

**Key Success Factors**:
1. Use VS Code tasks for structured validation
2. Run incremental verification after each wave
3. Leverage parallel agent execution in Waves 1, 3, 4
4. Maintain rollback points at wave boundaries
5. Use GitHub Actions for continuous validation

**Expected Outcome**:
- All 21 remaining tasks completed
- ~40-50% time savings vs sequential execution
- High confidence through multi-layer verification
- Production-ready release with comprehensive testing

**Next Steps**:
1. Review and approve this orchestration plan
2. Initialize Wave 1 branch
3. Dispatch 8 parallel agents for Phase 1 tasks
4. Begin systematic execution

---

**Document Status**: Ready for Execution
**Approval Required**: Yes
**Estimated Start**: Upon approval
