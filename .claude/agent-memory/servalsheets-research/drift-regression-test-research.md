---
name: Drift Regression Test Coverage Analysis
description: Analysis of existing source-dist-consistency test and gap for stale dist detection
type: reference
---

# Drift Regression Test Coverage Analysis

**Date:** 2026-05-12  
**Test File:** tests/contracts/source-dist-consistency-script.test.ts  
**Script:** scripts/check-source-dist-consistency.ts

## Current Test Coverage

### Test 1: Dev Mode (allow-missing-dist)
**Location:** test.ts lines 12-23  
**Scenario:** Tests when dist artifacts are missing  
**Command:** `node --import tsx scripts/check-source-dist-consistency.ts --allow-missing-dist`  
**Assertion:** Exit code 0, output matches `/Source\/dist consistency (passed|skipped)/i`  
**File handling:** Does NOT create temp files; tests script's graceful fallback  

### Test 2: Strict Mode (dist must exist)
**Location:** test.ts lines 25-46  
**Scenario:** Tests when dist artifacts exist  
**Command:** `node --import tsx scripts/check-source-dist-consistency.ts` (no flags)  
**Assertions:**
- If dist exists: exit code 0, output contains "Source/dist consistency passed."
- If dist missing: exit code 1, output matches `/Source\/dist consistency/i`

**File system checks performed (script.ts):**
1. Verify dist/schemas/action-counts.js exists (line 176)
2. Verify dist/mcp/completions.js exists (line 177)
3. Load and compare action counts (lines 200-216)
4. Compare completions counts (lines 217-222)
5. Verify runtime assets exist (HTML, CSS, JSON files) (lines 241-262)
6. Check packages/mcp-http dist consistency via fresh tsc build (lines 264, 102-171)
7. Verify src/mcp/completions.ts header comment "Total: N actions" matches actual count (lines 266-273)

## Gap: Stale Dist Detection

**Current limitation:** Test only detects MISSING dist, not STALE/out-of-sync dist.

### Scenario NOT Covered

```typescript
// Dist exists but is outdated
// - source: action count = 410
// - dist/schemas/action-counts.js: ACTION_COUNTS = { sheets_data: 24 } (old)
// - dist/mcp/completions.js: TOOL_ACTIONS = { sheets_data: ['read'] } (old)
// Test currently: PASSES (files exist, but content drifted)
```

### Root Cause

The **two-branch structure** at lines 182-191 means:
- If dist exists → proceed to strict checks (good)
- If dist missing → exit early with code 1 (good)
- BUT: Strict checks (lines 200-287) only run if dist files exist; they don't validate content freshness

### What IS Checked (lines 200-235)

The script DOES compare content via:
```typescript
const distActionCountsModule = await import(distActionCountsPath);  // Loads actual JS
const sourceActionCounts = SOURCE_ACTION_COUNTS;                   // Current source
compareCountMaps('src/schemas/action-counts.ts vs dist/...', sourceActionCounts, distActionCounts, errors);
```

This WOULD catch stale dist IF the test actually loads and compares.

## Why Test Passes with Stale Dist

The test at lines 25-46 only asserts:
```typescript
if (hasDistArtifacts) {
  expect(result.status, output).toBe(0);  // ← Only checks exit code
  expect(output).toContain('Source/dist consistency passed.');
}
```

It does NOT:
- Parse script output to verify what was actually compared
- Assert counts matched (e.g., "410 actions")
- Stub/mock dist files to old values and verify detection

## Recommended Regression Test

**Pattern to add (new test in source-dist-consistency-script.test.ts):**

```typescript
it('detects stale dist artifacts', () => {
  // Step 1: Create temp dir with old dist content
  const tempDir = mkdtempSync(resolve(projectRoot, '.test-stale-dist-'));
  const oldDistPath = resolve(tempDir, 'old-dist');
  mkdirSync(oldDistPath, { recursive: true });
  
  // Write STALE action-counts.js (pretend old schema)
  const staleActionCounts = `
    export const ACTION_COUNTS = {
      sheets_data: 20,  // ← Intentionally old count (actual is 25)
      // ... other tools with old counts
    };
  `;
  writeFileSync(
    resolve(oldDistPath, 'schemas/action-counts.js'),
    staleActionCounts
  );
  
  // Step 2: Temporarily replace dist with old version
  const realDistPath = resolve(projectRoot, 'dist');
  const backupPath = resolve(projectRoot, 'dist.backup');
  
  if (existsSync(realDistPath)) {
    renameSync(realDistPath, backupPath);
  }
  cpSync(oldDistPath, realDistPath, { recursive: true });
  
  try {
    // Step 3: Run script expecting FAILURE
    const env = { ...process.env, NODE_ENV: 'test' };
    const result = spawnSync('node', ['--import', 'tsx', scriptPath], {
      cwd: projectRoot,
      encoding: 'utf8',
      env,
    });
    
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
    
    // Step 4: Assert detection
    expect(result.status, output).toBe(1);  // ← Must fail on stale dist
    expect(output).toContain('dist drift');  // ← Error message mentions drift
    expect(output).toMatch(/sheets_data.*source=25.*dist=20/);  // ← Specific mismatch
    
  } finally {
    // Cleanup
    rmSync(realDistPath, { recursive: true, force: true });
    if (existsSync(backupPath)) {
      renameSync(backupPath, realDistPath);
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
});
```

## Implementation Notes

### File System Manipulation Patterns (Already Used in Script)

The script already uses:
```typescript
mkdtempSync()          // Line 125
existsSync()           // Many locations
readFileSync()         // Line 160
rmSync(, { recursive: true })  // Line 170
```

**The test should follow same pattern:**
- Use `mkdtempSync()` for temp dir (built-in, no extra deps)
- Use `cpSync()` or `writeFileSync()` to seed stale content
- Use `rmSync()` for cleanup in finally block
- Preserve original dist via backup/restore

### Why This Pattern Works

1. **Isolation:** Temp dir + backup/restore prevents side effects
2. **Clarity:** Explicit old values in stale dist show what's being tested
3. **Coverage:** Tests the actual detection logic in compareCountMaps() (lines 48-59)
4. **Failure mode:** Validates exit code 1 + error message format

### Tricky Parts

**Do NOT attempt:**
- Modifying source files to test — breaks other tests
- Running `npm run build` in test — too slow, undo burden
- Mocking require/import — brittle, test should run real script

**Instead:**
- Create isolated temp dist with stale content ✅
- Swap out dist directory temporarily ✅
- Restore in finally block ✅
- Run script against modified state ✅

## Expected Error Message

When dist is stale, script outputs (lines 276-280):

```
❌ Source/dist consistency check failed:
   - src/schemas/action-counts.ts vs dist/schemas/action-counts.js: sheets_data source=25 dist=20
   - ... (other mismatches)
```

Test should assert:
```typescript
expect(output).toContain('Source/dist consistency check failed');
expect(output).toMatch(/sheets_data.*source=\d+.*dist=\d+/);
```

## Integration Point

Add to: `tests/contracts/source-dist-consistency-script.test.ts`

After the existing two tests (lines 12-46).

Does NOT require:
- New helper files
- Changes to check-source-dist-consistency.ts
- Environment variables
- Mock frameworks

Can reuse: `vitest` (already imported), `spawnSync`, `fs` functions (already in script)
