# Tool Input/Output and Annotation Alignment Investigation Plan

## Executive Summary

This plan outlines a systematic investigation of tool manifests, schema registries, input/output mappings, and annotation alignment across ServalSheets' codebase to identify and document discrepancies, drift risks, and inconsistencies.

## Context

ServalSheets has 15 tools with 158 actions across multiple source files:
- **Manifests**: `server.json`, `mcpb.json`
- **Schema Registry**: `src/schemas/index.ts` (TOOL_REGISTRY)
- **Annotations**: `src/schemas/annotations.ts` (TOOL_ANNOTATIONS)
- **Tool Schemas**: 15 individual schema files in `src/schemas/*.ts`
- **Shared Types**: `src/schemas/shared.ts`

## Known Discrepancies (from Analysis)

1. **sheets_sheet idempotent hint**: Differs between server.json/annotations.ts and sheet.ts
2. **sheets_pivot actions**: Actions listed in index.ts may not match SheetsPivotInputSchema
3. **Annotation duplication**: Same data exists in server.json and annotations.ts (drift risk)
4. **Prompt args**: Not Zod schemas while all tool inputs/outputs are Zod-based

## Investigation Phases

### Phase 1: Annotation Alignment Audit

**Objective**: Compare annotation fields across all sources and identify mismatches.

**Tasks**:

1. **Extract annotations from server.json**
   - Parse tools array (lines 81-247)
   - Extract `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` for each tool
   - Create structured comparison table

2. **Extract annotations from annotations.ts**
   - Parse TOOL_ANNOTATIONS object (lines 13-119)
   - Extract same four hint fields for each tool
   - Compare against server.json data

3. **Check per-tool annotation constants**
   - Search for `ANNOTATIONS` exports in each tool schema file (e.g., `SHEETS_SHEET_ANNOTATIONS`)
   - Verify existence and consistency with annotations.ts
   - Identify tools missing per-tool annotation constants

4. **Specific investigation: sheets_sheet idempotentHint**
   - server.json line 100: `idempotentHint: true`
   - annotations.ts line 25: `idempotentHint: true`
   - sheet.ts: Check for any contradictory comments or constants
   - Determine if "true" is semantically correct given delete/add operations

**Deliverable**: Annotation alignment matrix showing all discrepancies

---

### Phase 2: Action Catalog Cross-Reference

**Objective**: Verify that actions listed in TOOL_REGISTRY match actual input schemas.

**Tasks**:

1. **Extract TOOL_REGISTRY actions**
   - Parse src/schemas/index.ts lines 32-onwards
   - List all actions for each tool from the registry

2. **Extract actual schema actions**
   - For each tool schema file (spreadsheet.ts, sheet.ts, etc.):
     - Parse the discriminatedUnion input schema
     - Extract all action literals from union branches
   - Create master list of actual implemented actions

3. **Compare TOOL_REGISTRY vs. actual schemas**
   - Generate diff for each tool
   - Flag missing actions (in registry but not in schema)
   - Flag extra actions (in schema but not in registry)

4. **Specific investigation: sheets_pivot**
   - index.ts: Check listed pivot actions
   - pivot.ts: Parse SheetsPivotInputSchema discriminatedUnion
   - Document exact mismatch details

5. **Action count validation**
   - Compare ACTION_COUNTS in annotations.ts (lines 145-161)
   - Verify against actual schema action counts
   - Flag any count mismatches

**Deliverable**: Per-tool action reconciliation report with specific discrepancies

---

### Phase 3: Input/Output Schema Pattern Audit

**Objective**: Verify consistent use of schema patterns across all tools.

**Tasks**:

1. **Input schema patterns**
   - Verify all 15 tools use `z.discriminatedUnion('action', ...)`
   - Check for consistent BaseSchema usage (spreadsheetId field)
   - Identify any non-conforming input patterns

2. **Output schema patterns**
   - Verify all 15 tools use `z.discriminatedUnion('success', ...)`
   - Confirm success=true branch includes:
     - action field
     - dryRun field (optional)
     - mutation field (optional, except sheets_analysis)
   - Confirm success=false branch includes ErrorDetailSchema
   - Special case: Verify sheets_analysis has NO safety/mutation fields

3. **Safety rail integration**
   - Identify which actions accept SafetyOptionsSchema
   - Verify mutating actions (destructiveHint=true) include safety options
   - Check that read-only actions (sheets_analysis) exclude safety options

4. **Range handling consistency**
   - List all actions using RangeInputSchema
   - Verify consistent field names (range, sourceRange, destinationRange)
   - Check for any direct A1NotationSchema usage that should use RangeInputSchema

5. **Shared schema usage**
   - Audit usage of shared types: SpreadsheetIdSchema, SheetIdSchema, ColorSchema, etc.
   - Identify any local duplicates or inconsistent definitions
   - Check for deprecated or unused shared schemas

**Deliverable**: Schema pattern compliance report with recommendations

---

### Phase 4: Manifest Synchronization Check

**Objective**: Ensure server.json and mcpb.json are in sync with actual implementation.

**Tasks**:

1. **Tool count verification**
   - server.json: Count tools array entries (should be 15)
   - mcpb.json: Count tools array entries (should be 15)
   - annotations.ts: Verify TOOL_COUNT constant
   - Check for any missing or extra entries

2. **Tool name consistency**
   - Extract tool names from all three sources
   - Verify exact string match (e.g., "sheets_spreadsheet")
   - Check for typos or case mismatches

3. **Description synchronization**
   - Compare tool descriptions in:
     - server.json (lines 84, 95, 106, etc.)
     - mcpb.json (lines 67, 71, 75, etc.)
     - annotations.ts TOOL_DESCRIPTIONS (lines 124-140)
   - Flag any wording discrepancies
   - Recommend single source of truth

4. **Annotation embedding in server.json**
   - Document that annotations exist in TWO places:
     - server.json (embedded in each tool)
     - annotations.ts (centralized)
   - Assess drift risk: If annotations.ts changes, server.json must be manually updated
   - Recommend automation or single source of truth

5. **Version and metadata sync**
   - server.json line 21: version "1.0.0"
   - mcpb.json line 3: version "1.0.0"
   - package.json: Check version field
   - Verify all are identical

**Deliverable**: Manifest synchronization report with drift risk assessment

---

### Phase 5: Prompts Schema Investigation

**Objective**: Understand prompt argument handling and determine if Zod schemas are needed.

**Tasks**:

1. **Prompts file analysis**
   - Read src/schemas/prompts.ts
   - Document argument structure (plain objects vs. Zod schemas)
   - Identify all registered prompts

2. **Argument validation approach**
   - Check if prompt args are validated at runtime
   - Compare with tool input validation (Zod-based)
   - Assess if lack of schemas creates runtime risks

3. **Consistency assessment**
   - Document architectural inconsistency:
     - Tools: Zod-validated inputs
     - Prompts: Plain object inputs (no Zod)
   - Recommend whether prompts should adopt Zod schemas

4. **Prompt registry check**
   - Verify prompt names are registered in MCP server
   - Check for orphaned prompt definitions
   - Validate prompt descriptions

**Deliverable**: Prompts architecture analysis with recommendations

---

### Phase 6: Semantic Correctness Review

**Objective**: Assess if annotation values accurately reflect tool behavior.

**Tasks**:

1. **readOnlyHint validation**
   - sheets_analysis: Verify truly read-only (no mutations)
   - All other tools: Confirm at least some actions mutate state
   - Check for any missing read-only operations

2. **destructiveHint validation**
   - Tools marked true: Verify they can delete/overwrite data
   - Tools marked false: Verify they only format or create
   - Specific checks:
     - sheets_spreadsheet (false): Can it delete?
     - sheets_format (false): Formatting = non-destructive?

3. **idempotentHint validation**
   - sheets_sheet (true): Is duplicate/add truly idempotent?
   - sheets_format (true): Same format twice = same result?
   - sheets_values (false): Confirm append is not idempotent
   - Check allowMissing flags that enable idempotency

4. **openWorldHint assessment**
   - All tools marked true: Appropriate for Google Sheets API
   - Verify no hardcoded constraints that would violate openWorld

5. **Special case: sheets_sheet idempotent discrepancy**
   - Deep dive into delete action with allowMissing flag (sheet.ts line 40)
   - Determine if flag makes delete idempotent
   - If so, tool-level idempotentHint:true is correct
   - If not, need action-level annotations

**Deliverable**: Semantic correctness report with corrections needed

---

### Phase 7: Documentation Generation

**Objective**: Create comprehensive reference documentation.

**Tasks**:

1. **Tool catalog**
   - Generate markdown table with:
     - Tool name
     - Action count
     - Annotations (RO, D, I, OW)
     - Description
     - Input schema reference
     - Output schema reference

2. **Action catalog**
   - Generate per-tool action lists with:
     - Action name
     - Input parameters
     - Output fields
     - Safety options support
     - Idempotency behavior

3. **Schema reference**
   - Document all shared schemas in shared.ts
   - Include usage examples
   - List which tools use each shared schema

4. **Annotation guide**
   - Define each annotation field precisely
   - Provide decision tree for assigning values
   - Include examples of correct/incorrect usage

5. **Sync checklist**
   - Create checklist for adding new tools
   - Include all files that must be updated
   - Add to developer documentation

**Deliverable**: Complete tool and schema reference documentation

---

## Investigation Methodology

### Tools to Use
- **Read**: For reading source files
- **Grep**: For searching patterns (e.g., "ANNOTATIONS", "discriminatedUnion")
- **Glob**: For finding schema files
- **Manual comparison**: For nuanced semantic analysis

### Data Collection Strategy
1. Parse each source file systematically
2. Store data in structured format (JSON/markdown tables)
3. Use exact line references for all findings
4. Capture both discrepancies AND confirmations

### Reporting Format
- **Finding**: Specific discrepancy with line numbers
- **Impact**: Low/Medium/High severity
- **Recommendation**: Specific action to resolve
- **Owner**: Which file(s) should be updated

---

## Expected Outcomes

### Primary Deliverables
1. ✅ Annotation alignment matrix
2. ✅ Action catalog reconciliation report
3. ✅ Schema pattern compliance report
4. ✅ Manifest synchronization report
5. ✅ Prompts architecture analysis
6. ✅ Semantic correctness report
7. ✅ Complete reference documentation

### Success Criteria
- All discrepancies documented with line numbers
- Severity and impact assessed for each issue
- Clear recommendations for resolution
- No unanswered questions about schema/annotation alignment

### Risk Mitigation
- Document ALL findings, even if low-impact
- Provide rationale for "no action needed" recommendations
- Identify high-risk areas requiring immediate attention
- Suggest automation to prevent future drift

---

## Estimated Complexity

- **Phase 1**: Medium (requires careful comparison across 3 sources)
- **Phase 2**: High (158 actions to validate)
- **Phase 3**: Medium (pattern checking with some semantic analysis)
- **Phase 4**: Low (straightforward comparison)
- **Phase 5**: Low (single file analysis)
- **Phase 6**: High (requires semantic understanding of each tool)
- **Phase 7**: Medium (synthesis of all findings)

---

## Follow-Up Actions (Post-Investigation)

After completing this investigation plan:

1. **Prioritize fixes**: Create issue list ranked by severity
2. **Implement single source of truth**: Reduce duplication
3. **Add validation tests**: Prevent future drift
4. **Update documentation**: Based on findings
5. **Consider codegen**: Auto-generate server.json from annotations.ts

---

## Notes

- This is a **planning document only** - no code changes will be made during investigation
- Investigation should be thorough but non-invasive
- Focus on documenting current state, not fixing issues
- Recommendations should be actionable and specific
