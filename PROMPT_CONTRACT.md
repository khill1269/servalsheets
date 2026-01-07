# ServalSheets Development Contract

**Project**: TypeScript MCP Server (Google Sheets API v4 + Google Drive API v3)
**Version**: 1.3.0
**Tools**: 23 tools, 152 actions

---

## NON-NEGOTIABLE RULES

### 1. No Placeholders or Stubs
- No `TODO`, `FIXME`, `stub`, `placeholder`, `simulate`, or `not implemented` markers
- Every function must have complete implementation
- No pseudo-code in final output
- No "we'll implement this later" comments

### 2. No Simulated Results
- If you can't run a command, say so and stop
- Don't fabricate command outputs or test results
- Don't assume success without verification
- Must run actual build + test + validation commands

### 3. MCP Compliance (CRITICAL)
- `tools/list` schemas MUST match runtime handler implementations exactly
- `tools/call` must forward full MCP context including:
  - `_meta.elicitation` (if used)
  - `_meta.sampling` (if used)
  - All discriminated union action types
- `initialize` capabilities must be truthful:
  - Only claim features that are actually wired
  - Don't advertise unimplemented capabilities
- MCP SDK version: `@modelcontextprotocol/sdk@^1.25.1`

### 4. Google API Correctness
- Use correct Sheets v4 API endpoints and request shapes
- Use correct Drive v3 API endpoints and request shapes
- googleapis version: `^169.0.0`
- Minimize API calls: justify any added call
- Use batch APIs aggressively (`batchUpdate`, `batchGet`)
- Never log secrets/tokens/PII
- Handle quota limits gracefully

### 5. Drift Prevention
- Tool registry (`src/mcp/registration.ts`) is the single source of truth
- Any metadata changes require updates in the SAME PR:
  - `server.json` (auto-generated via `npm run gen:metadata`)
  - Tool counts in tests
  - Documentation
  - Type definitions
  - Schema exports

---

## WORKFLOW: GATED PHASES

Every task must follow this exact workflow. Do NOT skip phases or move ahead without completion.

### Phase Structure

For EACH phase:

#### A) PLAN
List exact files you will edit:
```
Files to edit:
- src/handlers/example.ts (add new action)
- src/schemas/example.ts (update schema)
- src/mcp/registration.ts (update tool registration)
```

#### B) IMPLEMENT
Make the edits using appropriate tools (Edit, Write)

#### C) VERIFY
Run these commands in order:
```bash
npm run build          # Must complete without errors
npm test              # Must pass all tests
npm run typecheck     # Must pass type checking
npm run check:placeholders  # Must find zero placeholders
```

#### D) REPORT
Report command outputs in this format:
```
✅ npm run build - SUCCESS (12.3s)
✅ npm test - SUCCESS (23 tests passed)
✅ npm run typecheck - SUCCESS (0 errors)
✅ npm run check:placeholders - SUCCESS (no placeholders found)
```

#### E) MARK COMPLETE
End with one of:
- `DONE ✅` - Phase complete, all gates passed
- `BLOCKED ❌` - Phase blocked, include exact error text and next fix

**DO NOT MOVE TO NEXT PHASE until current phase shows DONE ✅**

---

## OUTPUT FORMAT

### Start of Phase
```
Phase N: <goal in one sentence>

Acceptance criteria:
- <specific criterion 1>
- <specific criterion 2>
- Commands must pass: build + test + typecheck + check:placeholders

Files to edit:
- <file path 1> (<what changes>)
- <file path 2> (<what changes>)
```

### During Phase
- Show diffs for significant changes
- Show command outputs for all verification steps
- No essays or unnecessary explanations
- Focus on facts and results

### End of Phase
```
Verification Results:
✅ npm run build - SUCCESS
✅ npm test - SUCCESS
✅ npm run typecheck - SUCCESS
✅ npm run check:placeholders - SUCCESS

Phase N: DONE ✅
```

OR

```
Verification Results:
❌ npm test - FAILED

Error:
[exact error text]

Next fix:
[specific fix to apply]

Phase N: BLOCKED ❌
```

---

## MCP COMPLIANCE TRUTH TABLE

Before marking any phase DONE ✅, output a **Capabilities Truth Table**:

```
Capabilities Truth Table:
┌─────────────────────┬──────────┬────────────┬───────────────────────────┐
│ Capability          │ Claimed? │ Wired?     │ Evidence                  │
├─────────────────────┼──────────┼────────────┼───────────────────────────┤
│ tools/list          │ ✅ Yes   │ ✅ Yes     │ src/mcp/registration.ts:L42│
│ tools/call          │ ✅ Yes   │ ✅ Yes     │ src/server.ts:L156        │
│ resources/list      │ ✅ Yes   │ ✅ Yes     │ src/resources/index.ts:L23│
│ resources/read      │ ✅ Yes   │ ✅ Yes     │ src/resources/index.ts:L45│
│ prompts/list        │ ✅ Yes   │ ✅ Yes     │ src/prompts/index.ts:L12  │
│ prompts/get         │ ✅ Yes   │ ✅ Yes     │ src/prompts/index.ts:L34  │
│ logging/setLevel    │ ✅ Yes   │ ✅ Yes     │ src/utils/logger.ts:L89   │
│ completion          │ ❌ No    │ ❌ No      │ Not implemented           │
│ sampling/create     │ ✅ Yes   │ ✅ Yes     │ src/mcp/sampling.ts:L56   │
└─────────────────────┴──────────┴────────────┴───────────────────────────┘
```

This prevents claiming capabilities that aren't actually wired.

---

## CONSTRAINTS

### Code Quality
- TypeScript strict mode enabled
- All types must be explicit (no `any` without justification)
- Zod schemas for all tool inputs
- Discriminated unions for action-based tools
- Error handling for all external calls
- Logging for all operations

### Testing
- Unit tests for all new handlers
- Integration tests for API interactions
- Test coverage must not decrease
- All tests must pass before marking DONE ✅

### Security
- Never commit `.env` files with real credentials
- Always use environment variables for secrets
- Validate all user inputs with Zod
- Sanitize all outputs
- Follow principle of least privilege for OAuth scopes

### Performance
- Use batch APIs when available
- Implement caching where appropriate
- Minimize sequential API calls
- Use request deduplication
- Monitor and log operation durations

---

## SINGLE PHASE RULE

⚠️ **CRITICAL**: You are only allowed to work on ONE phase per response.

If anything remains after completing a phase:
1. Mark current phase DONE ✅
2. Stop
3. Wait for next phase prompt

This prevents rushing and ensures proper gate validation.

---

## EXAMPLE WORKFLOW

```
Phase 1: Add sheets_history tool with undo/redo support

Acceptance criteria:
- Tool schema defined with discriminated union
- Handler implements list/undo/redo/revert_to actions
- Integrated with snapshot service
- All commands pass

Files to edit:
- src/schemas/history.ts (create new schema)
- src/handlers/history.ts (create new handler)
- src/mcp/registration.ts (register new tool)
- src/schemas/index.ts (export schema)
- src/handlers/index.ts (export handler)

[implementation happens]

Verification Results:
✅ npm run build - SUCCESS (11.8s)
✅ npm test - SUCCESS (24 tests passed)
✅ npm run typecheck - SUCCESS (0 errors)
✅ npm run check:placeholders - SUCCESS (no placeholders)

Capabilities Truth Table:
┌─────────────────────┬──────────┬────────────┬───────────────────────────┐
│ Capability          │ Claimed? │ Wired?     │ Evidence                  │
├─────────────────────┼──────────┼────────────┼───────────────────────────┤
│ sheets_history tool │ ✅ Yes   │ ✅ Yes     │ src/mcp/registration.ts:L89│
│ undo action         │ ✅ Yes   │ ✅ Yes     │ src/handlers/history.ts:L45│
│ redo action         │ ✅ Yes   │ ✅ Yes     │ src/handlers/history.ts:L67│
│ revert_to action    │ ✅ Yes   │ ✅ Yes     │ src/handlers/history.ts:L89│
└─────────────────────┴──────────┴────────────┴───────────────────────────┘

Phase 1: DONE ✅
```

---

## COMMON ANTI-PATTERNS TO AVOID

❌ **Don't**: Add `// TODO: Implement this later`
✅ **Do**: Implement it now or don't add the code

❌ **Don't**: Say "tests pass" without running them
✅ **Do**: Run `npm test` and show the output

❌ **Don't**: Move to Phase 2 before Phase 1 is DONE ✅
✅ **Do**: Complete one phase fully before starting the next

❌ **Don't**: Claim a capability in `server.json` that isn't wired
✅ **Do**: Output truth table and verify every capability

❌ **Don't**: Make multiple API calls when batch API exists
✅ **Do**: Use `batchUpdate`, `batchGet`, `batchClear`

❌ **Don't**: Log tokens or sensitive data
✅ **Do**: Redact all secrets in logs

---

## QUICK COMMAND REFERENCE

```bash
# Development
npm run dev                    # Watch mode for development
npm run build                  # Build project (includes metadata generation)
npm run build:clean            # Clean build from scratch

# Validation (run before marking DONE)
npm test                       # Run all tests
npm run typecheck             # TypeScript type checking
npm run lint                  # ESLint validation
npm run check:placeholders    # Check for TODO/stub/placeholder
npm run check:drift           # Verify metadata consistency
npm run verify                # Run all checks (drift + typecheck + lint + format + test)

# CI Pipeline
npm run ci                    # Full CI pipeline (clean + build + verify + validate + smoke)

# Testing
npm run test:integration      # Integration tests with real API
npm run test:coverage         # Test coverage report

# Metadata Management
npm run gen:metadata          # Generate server.json and metadata
npm run validate:server-json  # Validate server.json schema

# Server Operations
npm run start                 # Start MCP server (stdio)
npm run start:http            # Start HTTP server
npm run auth                  # Run OAuth setup flow
```

---

## METADATA GENERATION

ServalSheets uses **automatic metadata generation** to prevent drift.

When you make changes to:
- Tool schemas (`src/schemas/*.ts`)
- Tool handlers (`src/handlers/*.ts`)
- MCP registration (`src/mcp/registration.ts`)

The build process automatically:
1. Generates `server.json` with correct tool definitions
2. Updates tool counts
3. Validates schema consistency

**Never manually edit `server.json`** - it's auto-generated.

If you need to modify metadata:
1. Edit the source schemas/handlers
2. Run `npm run build` (which runs `gen:metadata`)
3. Verify with `npm run validate:server-json`

---

## SUCCESS CRITERIA

A phase is DONE ✅ when:

1. ✅ All files edited as planned
2. ✅ `npm run build` succeeds
3. ✅ `npm test` passes (all tests)
4. ✅ `npm run typecheck` passes (0 errors)
5. ✅ `npm run check:placeholders` finds nothing
6. ✅ Capabilities truth table shows no drift
7. ✅ Changes committed to git

Anything less = BLOCKED ❌

---

**Remember**: This is a production MCP server with 23 tools serving real users. Quality and correctness are non-negotiable. Take time to do it right.
