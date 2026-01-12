# ServalSheets Comprehensive Audit Prompt

## Mission
Conduct a thorough audit of the ServalSheets MCP server codebase to verify the status of previously identified issues and establish best practices alignment.

## Phase 1: Issue Verification (Zod v4 Compatibility)

### P0 Critical - Schema Conversion
```bash
# Check if schema-compat.ts still has broken .toJSONSchema() calls
cat src/utils/schema-compat.ts | head -150
```

**Investigate:**
1. Does `src/utils/schema-compat.ts` lines 108-141 still call a non-existent `.toJSONSchema()` method?
2. Is `zod-to-json-schema` properly imported and used?
3. Run: `grep -n "toJSONSchema\|zodToJsonSchema" src/utils/schema-compat.ts`

### P0 Critical - ZodEffects Handling
```bash
# Check schema-inspection.ts for ZodEffects usage
cat src/utils/schema-inspection.ts | grep -n "ZodEffects\|innerType\|_def"
```

**Investigate:**
1. Line 73-76: Is `instanceof z.ZodEffects` still used?
2. Does `.innerType()` work with Zod v4's ZodPipe/ZodTransform split?
3. Document all `_def` access patterns (lines 82, 88, 94, 214, 244)

### P1 - Test Suite Verification
```bash
# Run schema transformation tests
npx vitest tests/contracts/schema-transformation.test.ts --run --reporter verbose 2>&1 | head -100
```

---

## Phase 2: Issue Verification (MCP SDK Compatibility)

### F-01 Critical - Empty Input Schemas on tools/list
```bash
# Check current tools/list output for empty schemas
NODE_ENV=development MCP_TRANSPORT=stdio timeout 10 node --input-type=module -e "
import { spawn } from 'child_process';
const child = spawn('node', ['dist/cli.js'], {
  env: { ...process.env, NODE_ENV: 'development', MCP_TRANSPORT: 'stdio' }
});
let buffer = '';
const pending = new Map();
child.stdout.on('data', c => {
  buffer += c.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const json = JSON.parse(line);
      const id = json?.id;
      if (pending.has(id)) {
        pending.get(id)(json);
        pending.delete(id);
      }
    } catch {}
  }
});
const request = (payload, timeoutMs = 20000) => new Promise((resolve, reject) => {
  const id = payload.id;
  const t = setTimeout(() => { pending.delete(id); reject(new Error('timeout')); }, timeoutMs);
  pending.set(id, (json) => { clearTimeout(t); resolve(json); });
  child.stdin.write(JSON.stringify(payload) + '\n');
});
(async () => {
  await request({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'probe', version: '0.0.0' } }
  });
  const res = await request({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const tools = res?.result?.tools ?? [];
  const empty = tools.filter(t => {
    const s = t.inputSchema;
    const props = s?.properties && typeof s.properties === 'object' ? Object.keys(s.properties).length : 0;
    const oneOf = Array.isArray(s?.oneOf) ? s.oneOf.length : 0;
    const anyOf = Array.isArray(s?.anyOf) ? s.anyOf.length : 0;
    return props === 0 && oneOf === 0 && anyOf === 0;
  }).map(t => t.name);
  console.log('tool_count:', tools.length);
  console.log('empty_input_schemas:', empty.length);
  if (empty.length > 0) console.log('empty_tools:', empty);
  if (empty.length === 0) console.log('✅ All tools have non-empty input schemas');
  child.kill();
})();
" 2>&1
```

### F-02 Critical - HTTP Transport Schema Wrapping
```bash
# Check if wrapInputSchemaForLegacyRequest still creates ZodUnion
grep -rn "wrapInputSchemaForLegacyRequest\|z.union" src/mcp/registration/
cat src/mcp/registration/schema-helpers.ts 2>/dev/null || echo "File not found"
```

### F-04 - SDK vs Local Schema Conversion Mismatch
```bash
# Check which conversion path is used at runtime
grep -rn "normalizeObjectSchema\|toJsonSchemaCompat\|zodToJsonSchema" src/
```

### F-06 - Internal _def/_zod Access
```bash
# Audit all internal Zod property access
grep -rn "_def\|_zod" src/ --include="*.ts" | grep -v "node_modules\|dist\|.test.ts"
```

### F-07 - console.log in Runtime (stdio corruption risk)
```bash
# Find console.log usage that could corrupt stdio
grep -rn "console.log\|console.warn\|console.error" src/ --include="*.ts" | grep -v "node_modules\|dist\|.test.ts" | head -50
```

---

## Phase 3: Current State Analysis

### Check Zod Version
```bash
cat package.json | grep -A2 '"zod"'
npm ls zod
```

### Check MCP SDK Version
```bash
cat package.json | grep -A2 '"@modelcontextprotocol"'
npm ls @modelcontextprotocol/sdk
```

### Review Schema Registration Flow
```bash
# Trace the schema registration path
cat src/mcp/registration/tool-handlers.ts 2>/dev/null | head -100
cat src/mcp/server.ts 2>/dev/null | head -100
```

### Check Test Coverage for Schema Issues
```bash
# List relevant test files
ls -la tests/contracts/ tests/integration/ 2>/dev/null
cat tests/integration/mcp-tools-list.test.ts 2>/dev/null | head -80
cat tests/contracts/sdk-compat.test.ts 2>/dev/null | head -80
```

---

## Phase 4: Run Test Suite

```bash
# Run all relevant tests
npx vitest tests/integration/mcp-tools-list.test.ts --run --reporter verbose 2>&1
npx vitest tests/contracts/sdk-compat.test.ts --run --reporter verbose 2>&1
npx vitest tests/contracts/schema-transformation.test.ts --run --reporter verbose 2>&1
```

---

## Phase 5: Best Practices Research

### Questions to Answer:
1. **Zod v4 JSON Schema Conversion**: What is the canonical way to convert Zod v4 schemas to JSON Schema for MCP tools/list?
2. **MCP SDK Compatibility**: How should discriminatedUnion schemas be registered to avoid empty schema fallback?
3. **Schema Inspection**: What are stable public APIs for inspecting Zod schema types without _def access?
4. **Stdio Safety**: What's the correct logging pattern for MCP servers using stdio transport?
5. **Test Coverage**: What contract tests should exist to prevent schema registration regressions?

### Check MCP SDK Source for Guidance
```bash
# Find SDK's schema handling
find node_modules/@modelcontextprotocol -name "*.js" -exec grep -l "normalizeObjectSchema\|toJsonSchemaCompat" {} \;
cat node_modules/@modelcontextprotocol/sdk/dist/server/zod-compat.js 2>/dev/null | head -100
```

---

## Deliverables

After completing this audit, provide:

1. **Status Matrix**: For each issue (Zod #1-13, MCP F-01 to F-13), mark as:
   - ✅ FIXED - Issue no longer exists
   - ❌ STILL EXISTS - Issue confirmed present
   - ⚠️ PARTIAL - Partially addressed
   - 🔍 NEEDS INVESTIGATION - Unclear

2. **Root Cause Analysis**: For any remaining issues, explain the technical root cause

3. **Fix Recommendations**: Prioritized list of fixes with code snippets

4. **Best Practices Report**: Document recommended patterns for:
   - Zod v4 schema definition for MCP tools
   - JSON Schema conversion
   - Schema inspection without internals
   - Logging in stdio MCP servers

5. **Test Gap Analysis**: Missing tests that should be added

---

## Notes

- Working directory: `/Users/thomascahill/Documents/mcp-servers/servalsheets`
- Build before testing if dist/ is stale: `npm run build`
- If build fails, work with source directly using ts-node or vitest
