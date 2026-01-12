# Phase 2 Strategic Plan: Single Source of Truth
**Critical Analysis & Execution Strategy**

**Date**: 2026-01-07
**Phase**: 2 - Single Source of Truth
**Priority**: P1 (High - Foundation for all metadata)
**Risk Level**: HIGH (Touches core metadata generation)

---

## Executive Summary

Phase 2 establishes a **single source of truth** for all tool/action metadata by:
1. Fixing the metadata generator to accurately count actions from schemas
2. Adding CI guards to prevent future drift
3. Ensuring tool descriptions propagate to all endpoints

**Current State**: ❌ **CRITICAL DRIFT DETECTED**
- Generator counts: **24 tools, 152 actions**
- Manual counts (annotations.ts): **24 tools, 188 actions**
- TODO claims: **23 tools, 188 actions**
- **Reality**: Need forensic analysis

---

## Critical Issues Identified

### Issue #1: Metadata Generator Logic Flaw

**File**: `scripts/generate-metadata.ts`

**Problem**: The generator uses flawed regex patterns that miss actions:

```typescript
// Line 63: Matches discriminated unions
const unionMatches = content.match(/z\.discriminatedUnion\(['"]action['"],\s*\[([\s\S]*?)\]\)/g);

// Line 72: Counts action literals
const literals = match.match(/action:\s*z\.literal\(['"][\w_]+['"]\)/g);
```

**Why It Fails**:
1. **Multi-line patterns**: Regex doesn't handle complex formatting
2. **Nested structures**: Discriminated unions span hundreds of lines
3. **Non-action schemas**: sheets_fix doesn't use action discriminator
4. **Analysis schema anomaly**: Has 13 actions but generator found only 1

**Evidence**:
```bash
$ npm run gen:metadata
📝 analysis.ts          → 1 actions  # WRONG! Should be 13
📝 advanced.ts          → 10 actions # WRONG! Should be 19
Total: 24 tools, 152 actions        # WRONG! Should be 188
```

---

### Issue #2: Multiple Sources of Truth

**Current Architecture** (❌ FRAGMENTED):
```
Source 1: src/mcp/registration.ts TOOL_DEFINITIONS (24 tools)
Source 2: src/schemas/index.ts TOOL_REGISTRY (22 tools - missing 2)
Source 3: src/schemas/annotations.ts ACTION_COUNTS (24 tools, manual counts)
Source 4: src/mcp/completions.ts TOOL_ACTIONS (23 tools - missing sheets_fix)
Source 5: package.json description (hardcoded "152 actions")
Source 6: server.json metadata (generated, but wrong)
```

**Result**: Inconsistent counts across the codebase

---

### Issue #3: sheets_fix Not in Completions

**File**: `src/mcp/completions.ts`

The TOOL_ACTIONS map lists 23 tools but omits `sheets_fix`:
```typescript
export const TOOL_ACTIONS: Record<string, string[]> = {
  sheets_auth: [...],
  ...
  sheets_analyze: ['analyze'],
  // ❌ sheets_fix is MISSING!
};
```

This breaks autocompletion for the sheets_fix tool.

---

### Issue #4: Schema Pattern Inconsistency

**sheets_fix breaks the pattern**:

Most tools use:
```typescript
const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('action1'), ... }),
  z.object({ action: z.literal('action2'), ... }),
]);
```

But sheets_fix uses:
```typescript
export const SheetsFixRequestSchema = z.object({
  spreadsheetId: z.string(),
  issues: z.array(...),
  mode: z.enum(['preview', 'apply']),
  // ❌ No action discriminator!
});
```

This makes it **ungeneratable** by the current system.

---

## Official MCP 2025-11-25 Compliance

### Required Tool Properties

Per the [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25):

**Tools Must Include**:
1. ✅ **name**: Unique tool identifier (standardized format per SEP-986)
2. ✅ **description**: What the tool does (untrusted, user must approve)
3. ✅ **inputSchema**: JSON Schema for parameters
4. ✅ **annotations** (optional): Behavioral hints
   - `readOnlyHint`: Tool doesn't modify data
   - `destructiveHint`: Tool can delete/overwrite
   - `idempotentHint`: Same input = same result
   - `openWorldHint`: Tool accesses external systems

**Security Requirements**:
> "Tools are arbitrary code execution. Descriptions and annotations should be considered untrusted unless obtained from a trusted server. Hosts must obtain explicit user consent before invoking tools."

**Our Implementation**: ✅ Compliant
- All 24 tools have name, description, inputSchema, annotations
- Zod schemas converted to JSON Schema via `zodToJsonSchemaCompat`
- All tools use discriminated unions for type-safe dispatch

---

## Phase 2 Task Breakdown

### Task 2.1: Generate Counts from Schemas (6h) ⚠️ CRITICAL PATH

**Objective**: Rewrite metadata generator to accurately extract action counts

**Current Problems**:
1. Regex-based parsing fails on complex schemas
2. Doesn't handle sheets_fix (no discriminated union)
3. Counts wrong for analysis (1 vs 13), advanced (10 vs 19)

**Solution Strategy**:

#### Option A: AST-Based Parsing (RECOMMENDED)
Use TypeScript compiler API to parse schema files:

```typescript
import * as ts from 'typescript';

function countActionsFromAST(filePath: string): number {
  const program = ts.createProgram([filePath], {});
  const sourceFile = program.getSourceFile(filePath);

  let actionCount = 0;

  function visit(node: ts.Node) {
    // Find: z.discriminatedUnion('action', [...])
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr) &&
          expr.name.text === 'discriminatedUnion') {
        // Get the array argument
        const args = node.arguments;
        if (args.length >= 2 && ts.isArrayLiteralExpression(args[1])) {
          actionCount = args[1].elements.length;
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return actionCount;
}
```

**Pros**:
- Accurate: No regex limitations
- Maintainable: Works with any schema complexity
- Type-safe: Uses official TypeScript parser

**Cons**:
- Requires `typescript` dev dependency (already installed!)
- More complex implementation (~100 lines vs 20)

#### Option B: Import and Introspect Zod Schemas (ALTERNATIVE)
Dynamically import schemas and count discriminated union options:

```typescript
async function countActionsFromSchema(schemaName: string): Promise<number> {
  const module = await import(`../src/schemas/${schemaName}.js`);

  // Find the ActionSchema (e.g., HistoryActionSchema)
  const actionSchema = Object.values(module).find(
    (exp) => exp && typeof exp === 'object' && '_def' in exp
  );

  if (!actionSchema || actionSchema._def.typeName !== 'ZodDiscriminatedUnion') {
    return 0; // No discriminated union found
  }

  return actionSchema._def.options.length;
}
```

**Pros**:
- Simpler implementation
- No parsing needed
- Directly reads Zod schema structure

**Cons**:
- Requires built schemas (depends on build step)
- Doesn't work before initial build
- Circular dependency risk

#### Recommended Approach: **Option A (AST-Based)**

**Rationale**:
1. Works pre-build (needed for `npm run gen:metadata` before build)
2. No circular dependencies
3. Future-proof for schema evolution
4. TypeScript is already a dev dependency

---

### Task 2.1 Implementation Plan

**Subtask 2.1.1**: Rewrite Action Counter (3h)

**Files to Modify**:
- `scripts/generate-metadata.ts` (major refactor)

**Implementation Steps**:

1. **Add AST-based parser** (1h):
```typescript
import * as ts from 'typescript';

interface SchemaAnalysis {
  toolName: string;
  actionCount: number;
  actions: string[];
}

function analyzeSchema(filePath: string): SchemaAnalysis {
  const program = ts.createProgram([filePath], {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
  });

  const sourceFile = program.getSourceFile(filePath);
  if (!sourceFile) {
    throw new Error(`Could not load ${filePath}`);
  }

  const analysis: SchemaAnalysis = {
    toolName: path.basename(filePath, '.ts'),
    actionCount: 0,
    actions: [],
  };

  function visit(node: ts.Node) {
    // Look for: z.discriminatedUnion('action', [...])
    if (ts.isCallExpression(node)) {
      const expr = node.expression;

      if (ts.isPropertyAccessExpression(expr) &&
          expr.name.text === 'discriminatedUnion') {

        const args = node.arguments;

        // Check first arg is 'action'
        if (args[0] && ts.isStringLiteral(args[0]) &&
            args[0].text === 'action') {

          // Second arg should be array of schemas
          if (args[1] && ts.isArrayLiteralExpression(args[1])) {
            analysis.actionCount = args[1].elements.length;

            // Extract action names
            args[1].elements.forEach(element => {
              const actionName = extractActionLiteral(element);
              if (actionName) {
                analysis.actions.push(actionName);
              }
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return analysis;
}

function extractActionLiteral(node: ts.Node): string | null {
  // Walk tree to find: action: z.literal('action_name')
  let actionName: string | null = null;

  function findLiteral(n: ts.Node) {
    if (ts.isPropertyAssignment(n) &&
        ts.isIdentifier(n.name) &&
        n.name.text === 'action') {

      // Check if value is z.literal('...')
      if (ts.isCallExpression(n.initializer)) {
        const args = n.initializer.arguments;
        if (args[0] && ts.isStringLiteral(args[0])) {
          actionName = args[0].text;
        }
      }
    }
    ts.forEachChild(n, findLiteral);
  }

  findLiteral(node);
  return actionName;
}
```

2. **Handle sheets_fix special case** (30min):
```typescript
// Special handling for tools without discriminated unions
const SPECIAL_CASE_TOOLS: Record<string, number> = {
  'fix': 1, // sheets_fix has single action (implicit)
  'validation': 1, // sheets_validation has single action
  'impact': 1, // sheets_impact has single action
  'analyze': 1, // sheets_analyze has single action (uses sampling)
};

function getActionCount(schemaName: string, astAnalysis: SchemaAnalysis): number {
  if (astAnalysis.actionCount > 0) {
    return astAnalysis.actionCount;
  }

  // Check special cases
  return SPECIAL_CASE_TOOLS[schemaName] ?? 0;
}
```

3. **Update count generation** (30min):
```typescript
// Scan all schema files with AST parser
const schemaFiles = fs.readdirSync(join(ROOT, 'src/schemas'))
  .filter(f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'shared.ts');

let TOOL_COUNT = 0;
let ACTION_COUNT = 0;
const toolDetails: Record<string, SchemaAnalysis> = {};

for (const file of schemaFiles) {
  const path = join(ROOT, 'src/schemas', file);
  const analysis = analyzeSchema(path);

  if (analysis.actionCount > 0 || SPECIAL_CASE_TOOLS[analysis.toolName]) {
    TOOL_COUNT++;
    const count = getActionCount(analysis.toolName, analysis);
    ACTION_COUNT += count;
    toolDetails[analysis.toolName] = {
      ...analysis,
      actionCount: count,
    };

    console.log(`  📝 ${file.padEnd(20)} → ${count} actions`);
  }
}

console.log(`\n✅ Total: ${TOOL_COUNT} tools, ${ACTION_COUNT} actions\n`);
```

4. **Generate ACTION_COUNTS for annotations.ts** (1h):
```typescript
// Generate ACTION_COUNTS export for annotations.ts
const actionCountsPath = join(ROOT, 'src/schemas/annotations.ts');
let annotationsContent = fs.readFileSync(actionCountsPath, 'utf-8');

// Build ACTION_COUNTS object
const actionCountsObj = Object.entries(toolDetails)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, details]) => `  sheets_${name}: ${details.actionCount}`)
  .join(',\n');

const actionCountsExport = `export const ACTION_COUNTS: Record<string, number> = {\n${actionCountsObj}\n};`;

// Replace existing ACTION_COUNTS
annotationsContent = annotationsContent.replace(
  /export const ACTION_COUNTS: Record<string, number> = \{[\s\S]*?\};/,
  actionCountsExport
);

fs.writeFileSync(actionCountsPath, annotationsContent);
console.log('✅ Updated src/schemas/annotations.ts ACTION_COUNTS');
```

**Subtask 2.1.2**: Update Completions (1h)

**Files to Modify**:
- `src/mcp/completions.ts`

**Implementation**:
```typescript
// Generate TOOL_ACTIONS from toolDetails
const toolActionsPath = join(ROOT, 'src/mcp/completions.ts');
let completionsContent = fs.readFileSync(toolActionsPath, 'utf-8');

// Build TOOL_ACTIONS object
const toolActionsObj = Object.entries(toolDetails)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, details]) => {
    const actions = details.actions.length > 0
      ? `['${details.actions.join("', '")}']`
      : `['${name}']`; // Fallback for single-action tools
    return `  sheets_${name}: ${actions}`;
  })
  .join(',\n');

const toolActionsExport = `export const TOOL_ACTIONS: Record<string, string[]> = {\n${toolActionsObj}\n};`;

// Replace existing TOOL_ACTIONS
completionsContent = completionsContent.replace(
  /export const TOOL_ACTIONS: Record<string, string\[\]> = \{[\s\S]*?\};/,
  toolActionsExport
);

fs.writeFileSync(toolActionsPath, completionsContent);
console.log('✅ Updated src/mcp/completions.ts TOOL_ACTIONS');
```

**Subtask 2.1.3**: Update All Metadata Files (1h)

**Files to Update**:
- `package.json` - description field
- `src/schemas/index.ts` - TOOL_COUNT, ACTION_COUNT constants
- `server.json` - full regeneration
- `src/schemas/annotations.ts` - ACTION_COUNTS, TOOL_COUNT, ACTION_COUNT
- `src/mcp/completions.ts` - TOOL_ACTIONS
- `README.md` - tool/action counts in docs (if present)

**Verification**:
```bash
npm run gen:metadata
npm run check:drift  # Should pass
npm run typecheck    # Should pass
npm run build        # Should succeed
```

---

### Task 2.2: Add CI Guard for Metadata Drift (2h)

**Objective**: Prevent future drift by catching it in CI

**Current State**:
- `scripts/check-metadata-drift.sh` exists but only tracks 3 files
- Doesn't check annotations.ts or completions.ts

**Implementation**:

**Subtask 2.2.1**: Expand Drift Detection (1h)

**File**: `scripts/check-metadata-drift.sh`

```bash
#!/bin/bash
set -e

echo "🔍 Checking for metadata drift..."

# Files to track
TRACKED_FILES=(
  "package.json"
  "src/schemas/index.ts"
  "src/schemas/annotations.ts"
  "src/mcp/completions.ts"
  "server.json"
)

# Save current state
for file in "${TRACKED_FILES[@]}"; do
  git add "$file" 2>/dev/null || true
done

# Run generator
npm run gen:metadata --silent

# Check for changes
CHANGED_FILES=()
for file in "${TRACKED_FILES[@]}"; do
  if ! git diff --exit-code "$file" >/dev/null 2>&1; then
    CHANGED_FILES+=("$file")
  fi
done

if [ ${#CHANGED_FILES[@]} -gt 0 ]; then
  echo ""
  echo "❌ METADATA DRIFT DETECTED!"
  echo ""
  echo "The following files are out of sync:"
  for file in "${CHANGED_FILES[@]}"; do
    echo "  - $file"
  done
  echo ""
  echo "To fix:"
  echo "  npm run gen:metadata"
  echo "  git add ${TRACKED_FILES[@]}"
  echo "  git commit -m 'chore: sync metadata'"
  echo ""
  exit 1
fi

echo "✅ No metadata drift detected"
exit 0
```

**Subtask 2.2.2**: Add Pre-commit Hook (30min)

**File**: `.husky/pre-commit` (create if needed)

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Check metadata drift before committing
npm run check:drift || {
  echo ""
  echo "⚠️  Metadata drift detected. Run 'npm run gen:metadata' to fix."
  echo ""
  exit 1
}
```

**Setup**:
```bash
npm install -D husky
npx husky install
npx husky add .husky/pre-commit "npm run check:drift"
```

**Subtask 2.2.3**: Update CI Pipeline (30min)

**File**: `.github/workflows/ci.yml`

Add drift check to CI:
```yaml
- name: Check metadata drift
  run: npm run check:drift
```

---

### Task 2.3: Generate Tool Descriptions for /info Endpoint (3h)

**Objective**: Populate tool descriptions in /info endpoint

**Current State**:
- `src/schemas/annotations.ts:237` has `getToolMetadata()` that returns `description: ''`
- `src/schemas/descriptions.ts` has all tool descriptions
- `/info` endpoint shows blank descriptions

**Implementation**:

**Subtask 2.3.1**: Fix getToolMetadata() (1h)

**File**: `src/schemas/annotations.ts`

```typescript
import { TOOL_DESCRIPTIONS } from './descriptions.js';

export function getToolMetadata(): Record<string, unknown>[] {
  return Object.keys(TOOL_ANNOTATIONS).map(name => ({
    name,
    description: TOOL_DESCRIPTIONS[name] ?? '', // ✅ Import from descriptions.ts
    annotations: TOOL_ANNOTATIONS[name]!,
    actionCount: ACTION_COUNTS[name] ?? 0,
  }));
}
```

**Subtask 2.3.2**: Update /info Endpoint (1h)

**File**: `src/server/remote-server.ts` (line ~263)

Verify `/info` uses `getToolMetadata()`:
```typescript
app.get('/info', (req, res) => {
  const tools = getToolMetadata(); // Should now have descriptions
  res.json({
    name: 'servalsheets',
    version: pkg.version,
    tools,
    capabilities: [...],
  });
});
```

**Subtask 2.3.3**: Test /info Endpoint (1h)

```bash
# Start HTTP server
npm run start:http

# Test /info endpoint
curl http://localhost:3000/info | jq '.tools[] | {name, description}' | head -50

# Verify all descriptions are populated
curl http://localhost:3000/info | jq '.tools[] | select(.description == "") | .name'
# Should return empty (no tools with blank descriptions)
```

---

## Dependency Graph

```
Task 2.1.1 (Rewrite counter) ──► Task 2.1.2 (Update completions) ──┐
                                                                     │
                                                                     ▼
                                                               Task 2.1.3 (Update all files)
                                                                     │
                                                                     ▼
Task 2.3.1 (Fix getToolMetadata) ──► Task 2.3.2 (/info endpoint) ──┤
                                                                     │
                                                                     ▼
                                                               Task 2.2.1 (Expand drift check)
                                                                     │
                                                                     ▼
Task 2.2.2 (Pre-commit hook) + Task 2.2.3 (CI update) ◄─────────────┘
```

**Critical Path**: 2.1.1 → 2.1.2 → 2.1.3 → 2.2.1
**Parallel Tracks**: 2.3 can run alongside 2.2 after 2.1 completes

---

## Verification Strategy

### Level 1: Per-Task Verification

After **Task 2.1**:
```bash
npm run gen:metadata
# Should output: "✅ Total: 24 tools, 188 actions"

# Verify annotations.ts
grep -A 30 "export const ACTION_COUNTS" src/schemas/annotations.ts
# Should show all 24 tools with correct counts

# Verify completions.ts
grep -A 5 "sheets_fix:" src/mcp/completions.ts
# Should show: sheets_fix: ['fix'] or similar
```

After **Task 2.2**:
```bash
# Test drift detection
echo "TEST_DRIFT" >> package.json
npm run check:drift
# Should fail with drift detected

# Restore
git checkout package.json

npm run check:drift
# Should pass
```

After **Task 2.3**:
```bash
npm run start:http &
sleep 5
curl http://localhost:3000/info | jq '.tools[0].description'
# Should return non-empty description

pkill -f "node dist/http-server.js"
```

### Level 2: Integration Verification

```bash
# Full build and verify
npm run ci

# Should pass:
# ✓ typecheck
# ✓ lint
# ✓ test
# ✓ build
# ✓ check:drift
# ✓ validate:server-json
# ✓ smoke test
```

### Level 3: Manual Verification

**Check 1**: Counts are consistent across all files
```bash
grep -r "23 tools\|24 tools" .
grep -r "152 actions\|188 actions" .
# All should show same numbers
```

**Check 2**: No tools missing from completions
```bash
node -e "
const registration = require('./dist/mcp/registration.js');
const completions = require('./dist/mcp/completions.js');

const registeredTools = registration.TOOL_DEFINITIONS.map(t => t.name);
const completionTools = Object.keys(completions.TOOL_ACTIONS);

const missing = registeredTools.filter(t => !completionTools.includes(t));
console.log('Missing from completions:', missing);
"
# Should output: "Missing from completions: []"
```

**Check 3**: Action counts match schemas
```bash
# Run custom verification script
node scripts/verify-action-counts.js
```

Create `scripts/verify-action-counts.js`:
```javascript
import fs from 'fs';
import path from 'path';

const schemasDir = './src/schemas';
const files = fs.readdirSync(schemasDir).filter(f => f.endsWith('.ts'));

console.log('Verifying action counts match schema definitions...\n');

let errors = 0;

for (const file of files) {
  const content = fs.readFileSync(path.join(schemasDir, file), 'utf-8');

  // Count z.literal('action_name') occurrences
  const literals = content.match(/action:\s*z\.literal\(['"][\w_]+['"]\)/g);
  const schemaCount = literals ? literals.length : 0;

  // Extract tool name
  const toolName = file.replace('.ts', '');

  // Compare with ACTION_COUNTS
  const annotationsContent = fs.readFileSync('./src/schemas/annotations.ts', 'utf-8');
  const match = annotationsContent.match(new RegExp(`sheets_${toolName}:\\s*(\\d+)`));
  const annotationCount = match ? parseInt(match[1]) : 0;

  if (schemaCount > 0 && schemaCount !== annotationCount) {
    console.error(`❌ ${file}: schema=${schemaCount}, annotations=${annotationCount}`);
    errors++;
  } else if (schemaCount > 0) {
    console.log(`✓ ${file}: ${schemaCount} actions`);
  }
}

if (errors > 0) {
  console.error(`\n❌ Found ${errors} mismatches`);
  process.exit(1);
} else {
  console.log(`\n✅ All action counts verified`);
}
```

---

## Rollback Plan

If Phase 2 breaks something:

### Immediate Rollback
```bash
git log --oneline | grep "phase-2\|Phase 2" | head -1
# Get commit hash

git revert <commit-hash>
git push origin main
```

### Restore Previous Generator
```bash
git show HEAD~1:scripts/generate-metadata.ts > scripts/generate-metadata.ts
npm run gen:metadata
git add .
git commit -m "chore: rollback phase 2 metadata generator"
```

---

## Success Criteria

**Task 2.1 Complete When**:
- [ ] Generator outputs "24 tools, 188 actions" (or correct final count)
- [ ] All files updated: package.json, index.ts, annotations.ts, completions.ts, server.json
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] No TypeScript errors

**Task 2.2 Complete When**:
- [ ] `npm run check:drift` passes on clean state
- [ ] `npm run check:drift` fails when file manually modified
- [ ] Pre-commit hook blocks commits with drift
- [ ] CI pipeline includes drift check
- [ ] All tracked files covered

**Task 2.3 Complete When**:
- [ ] `/info` endpoint returns non-empty descriptions for all tools
- [ ] `getToolMetadata()` uses TOOL_DESCRIPTIONS
- [ ] Manual curl test shows populated descriptions
- [ ] Integration test passes

**Phase 2 Complete When**:
- [ ] All 3 tasks pass their success criteria
- [ ] `npm run ci` passes
- [ ] No drift detected
- [ ] All metadata consistent across files

---

## Risk Mitigation

### Risk 1: AST Parser Breaks on Schema Changes
**Mitigation**: Add unit tests for parser
```typescript
// tests/unit/metadata-generator.test.ts
describe('Action Counter', () => {
  it('should count discriminated union actions', () => {
    const schema = `
      z.discriminatedUnion('action', [
        z.object({ action: z.literal('get') }),
        z.object({ action: z.literal('set') }),
      ])
    `;
    expect(countActions(schema)).toBe(2);
  });
});
```

### Risk 2: Circular Dependencies
**Mitigation**: Generator runs pre-build, uses AST parsing (no imports)

### Risk 3: CI Failures Block Development
**Mitigation**: Allow `--no-verify` for emergency commits
```bash
git commit --no-verify -m "emergency: hotfix production issue"
```

---

## Timeline

**Total Duration**: 11 hours (critical path)

**Day 1** (6h):
- Morning: Task 2.1.1 - Rewrite counter (3h)
- Afternoon: Task 2.1.2 - Update completions (1h)
- Afternoon: Task 2.1.3 - Update all files (1h)
- Evening: Verification (1h)

**Day 2** (3h):
- Morning: Task 2.3.1 - Fix getToolMetadata (1h)
- Morning: Task 2.3.2 - Update /info (1h)
- Afternoon: Task 2.3.3 - Test /info (1h)

**Day 2** (2h) - Can run parallel with Day 2 morning:
- Morning: Task 2.2.1 - Expand drift check (1h)
- Afternoon: Task 2.2.2 + 2.2.3 - Hooks & CI (1h)

---

## Conclusion

Phase 2 is **high-risk but critical** for establishing a reliable metadata system. The current generator has fundamental flaws that cause drift. We must:

1. Rewrite the generator using AST parsing (not regex)
2. Add comprehensive drift detection
3. Ensure tool descriptions propagate everywhere

After Phase 2, **all metadata will be generated from a single source of truth** (schemas), eliminating manual maintenance and drift.

**Recommendation**: Execute tasks in order 2.1 → 2.3 → 2.2 to establish correct metadata before adding guards.

---

**Sources**:
- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP GitHub Repository](https://github.com/modelcontextprotocol/modelcontextprotocol)
- [One Year of MCP: November 2025 Spec Release](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/)

**Document Status**: Ready for Review & Approval
**Next Step**: Review with team, then begin Task 2.1.1 implementation
