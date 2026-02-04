---
title: Comprehensive ServalSheets Audit Toolkit
category: archived
last_updated: 2026-01-31
description: "Purpose: Systematic validation of codebase integrity, documentation accuracy, and standards compliance"
---

# Comprehensive ServalSheets Audit Toolkit

**Purpose:** Systematic validation of codebase integrity, documentation accuracy, and standards compliance
**Date:** 2026-01-29

---

## 🎯 Audit Objectives

1. ✅ **Code Integration** - All modules properly wired and imported
2. ✅ **Documentation Accuracy** - Docs match implementation
3. ✅ **MCP Compliance** - Protocol 2025-11-25 conformance
4. ✅ **Type Safety** - No TypeScript errors
5. ✅ **Test Coverage** - High confidence in features
6. ✅ **Dependency Health** - Up-to-date, secure packages
7. ✅ **Performance** - No regressions
8. ✅ **Architecture** - Clean module boundaries

---

## 📊 TIER 1: Automated Analysis (Run These First)

### 1.1 TypeScript Strict Mode Compilation

**Purpose:** Find type errors, unused imports, and integration issues

```bash
# Full strict mode compilation
npm run typecheck

# Generate detailed report
npx tsc --noEmit --pretty false 2>&1 | tee typescript-audit.txt

# Count errors by type
grep "error TS" typescript-audit.txt | cut -d: -f4 | sort | uniq -c | sort -rn
```

**What it catches:**

- ✅ Missing imports
- ✅ Type mismatches
- ✅ Unused variables
- ✅ Incorrect function signatures

---

### 1.2 Dependency Analysis & Architecture

**Tool:** `madge` - Circular dependency detection

```bash
# Install madge
npm install -D madge

# Check for circular dependencies (CRITICAL)
npx madge --circular --extensions ts src/

# Generate dependency graph
npx madge --image dependency-graph.svg src/

# Find orphaned files (not imported anywhere)
npx madge --orphans src/

# List files with most dependencies (complexity hotspots)
npx madge --depends src/ | sort -k2 -rn | head -20
```

**What it catches:**

- ✅ Circular dependencies (architecture smell)
- ✅ Orphaned files (unused code)
- ✅ High coupling (over-complex modules)

---

### 1.3 Import/Export Validation

**Tool:** `ts-prune` - Find unused exports

```bash
# Install ts-prune
npm install -D ts-prune

# Find unused exports (dead code)
npx ts-prune | tee unused-exports.txt

# Count by file
npx ts-prune | grep "used in module" | wc -l
```

**What it catches:**

- ✅ Dead code
- ✅ Refactoring leftovers
- ✅ Incorrectly exported internals

---

### 1.4 Test Coverage Analysis

```bash
# Run tests with coverage
npm run test:coverage

# Generate HTML report
npx c8 --reporter=html --reporter=text npm test

# Open coverage report
open coverage/index.html

# Find uncovered critical paths
npx c8 report --reporter=text | grep -A5 "Uncovered"
```

**Thresholds to check:**

- ✅ Handlers: >80% coverage
- ✅ Services: >70% coverage
- ✅ Utils: >85% coverage
- ✅ Critical paths: 100% coverage

---

### 1.5 Dependency Security & Updates

```bash
# Security audit
npm audit --audit-level=moderate

# Check for outdated packages
npm outdated

# Generate detailed report
npm outdated --json > outdated-packages.json

# Check for deprecated packages
npm ls --depth=0 | grep DEPRECATED

# Update safely (patch versions only)
npm update

# Interactive update tool
npx npm-check-updates --interactive
```

**What it catches:**

- ✅ Security vulnerabilities
- ✅ Deprecated packages
- ✅ Major version updates needed

---

## 📋 TIER 2: MCP-Specific Validation

### 2.1 MCP Inspector - Interactive Testing

**Tool:** Official MCP Inspector

```bash
# Install MCP Inspector globally
npm install -g @modelcontextprotocol/inspector

# Inspect your server (STDIO mode)
npx @modelcontextprotocol/inspector dist/cli.js

# Opens at http://localhost:6274
# Manually test each tool interactively
```

**Manual Test Checklist:**

- [ ] All 21 tools appear in list
- [ ] Each tool has correct input schema
- [ ] Each tool returns valid output schema
- [ ] Error handling works correctly
- [ ] Streaming/progress works
- [ ] Authorization flow works

---

### 2.2 MCP Schema Validation

**Create validation script:** `scripts/validate-mcp-schemas.ts`

```typescript
/**
 * Validate all MCP schemas against protocol spec
 */
import { TOOL_REGISTRY } from '../src/schemas/index.js';
import { toMcpSchema } from '../src/mcp/registration/schema-helpers.js';

console.log('🔍 Validating MCP Schemas...\n');

let errors = 0;
for (const [toolName, schemas] of Object.entries(TOOL_REGISTRY)) {
  try {
    // Validate input schema can convert to JSON Schema
    const inputSchema = toMcpSchema(schemas.input, 'input');

    // Validate output schema can convert to JSON Schema
    const outputSchema = toMcpSchema(schemas.output, 'output');

    // Check for required fields
    if (!inputSchema.properties) {
      console.error(`❌ ${toolName}: Missing input properties`);
      errors++;
    }

    console.log(`✅ ${toolName}: Valid schemas`);
  } catch (error) {
    console.error(`❌ ${toolName}: ${error.message}`);
    errors++;
  }
}

console.log(`\n${errors === 0 ? '✅' : '❌'} Total errors: ${errors}`);
process.exit(errors > 0 ? 1 : 0);
```

```bash
# Run schema validation
npx tsx scripts/validate-mcp-schemas.ts
```

---

### 2.3 Protocol Compliance Checker

**Create compliance script:** `scripts/check-mcp-compliance.ts`

```typescript
/**
 * Check MCP Protocol 2025-11-25 compliance
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const checks = {
  '✅ Protocol version declared': () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
    return pkg.description?.includes('2025-11-25') || false;
  },

  '✅ Tools registered via SDK': () => {
    const server = readFileSync('src/server.ts', 'utf-8');
    return server.includes('server.tool(') || server.includes('setRequestHandler');
  },

  '✅ Resources registered': () => {
    const server = readFileSync('src/server.ts', 'utf-8');
    return server.includes('server.resource(') || server.includes('listResources');
  },

  '✅ Prompts registered': () => {
    const server = readFileSync('src/server.ts', 'utf-8');
    return server.includes('server.prompt(') || server.includes('listPrompts');
  },

  '✅ Error handling with ErrorCode': () => {
    const files = [
      'src/handlers/base.ts',
      'src/core/errors.ts',
    ];
    return files.some(f => {
      const content = readFileSync(f, 'utf-8');
      return content.includes('ErrorCode') || content.includes('McpError');
    });
  },

  '✅ Structured responses': () => {
    const builder = readFileSync('src/mcp/response-builder.ts', 'utf-8');
    return builder.includes('buildToolResponse');
  },
};

console.log('🔍 MCP Protocol Compliance Check\n');

let passed = 0;
let failed = 0;

for (const [check, fn] of Object.entries(checks)) {
  try {
    if (fn()) {
      console.log(check);
      passed++;
    } else {
      console.log(check.replace('✅', '❌'));
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${check}: ${error.message}`);
    failed++;
  }
}

console.log(`\n${passed}/${passed + failed} checks passed`);
process.exit(failed > 0 ? 1 : 0);
```

```bash
# Run compliance check
npx tsx scripts/check-mcp-compliance.ts
```

---

## 📚 TIER 3: Documentation Validation

### 3.1 Generate API Documentation

**Tool:** `typedoc`

```bash
# Install TypeDoc
npm install -D typedoc

# Generate documentation
npx typedoc --out docs/api src/index.ts

# Check for undocumented exports
npx typedoc --validation.invalidLink --validation.notDocumented
```

**Add to package.json:**

```json
{
  "scripts": {
    "docs:generate": "typedoc --out docs/api src/index.ts",
    "docs:validate": "typedoc --validation.invalidLink --validation.notDocumented"
  }
}
```

---

### 3.2 Check Markdown Links

**Tool:** `markdown-link-check`

```bash
# Install markdown-link-check
npm install -D markdown-link-check

# Check all markdown files
find . -name "*.md" -not -path "./node_modules/*" -not -path "./dist/*" \
  -exec markdown-link-check {} \;

# Generate report
find . -name "*.md" -not -path "./node_modules/*" -not -path "./dist/*" \
  -exec markdown-link-check {} \; > markdown-links-report.txt 2>&1
```

---

### 3.3 Documentation Coverage

**Create script:** `scripts/check-doc-coverage.ts`

```typescript
/**
 * Check that all exported functions have JSDoc comments
 */
import { Project } from 'ts-morph';

const project = new Project({ tsConfigFilePath: 'tsconfig.json' });
const sourceFiles = project.getSourceFiles('src/**/*.ts');

let undocumented = 0;
let documented = 0;

for (const file of sourceFiles) {
  const functions = file.getFunctions();
  const classes = file.getClasses();

  for (const fn of functions) {
    if (fn.isExported()) {
      if (!fn.getJsDocs().length) {
        console.log(`❌ Undocumented: ${file.getBaseName()}::${fn.getName()}`);
        undocumented++;
      } else {
        documented++;
      }
    }
  }

  for (const cls of classes) {
    if (cls.isExported()) {
      if (!cls.getJsDocs().length) {
        console.log(`❌ Undocumented: ${file.getBaseName()}::${cls.getName()}`);
        undocumented++;
      } else {
        documented++;
      }
    }
  }
}

const coverage = (documented / (documented + undocumented)) * 100;
console.log(`\nDocumentation coverage: ${coverage.toFixed(1)}%`);
console.log(`Documented: ${documented}, Undocumented: ${undocumented}`);

process.exit(undocumented > 0 ? 1 : 0);
```

```bash
# Install ts-morph
npm install -D ts-morph

# Run documentation coverage check
npx tsx scripts/check-doc-coverage.ts
```

---

## 🔬 TIER 4: Code Quality Analysis

### 4.1 Complexity Analysis

**Tool:** `complexity-report`

```bash
# Install complexity reporter
npm install -D complexity-report

# Generate complexity report
npx cr src/**/*.ts --format markdown > complexity-report.md

# Find high-complexity functions (>20)
npx cr src/**/*.ts --format json | jq '.functions[] | select(.cyclomatic > 20)'
```

**Thresholds:**

- Cyclomatic complexity: <20 (prefer <10)
- Function length: <100 lines (prefer <50)
- Parameter count: <5 (prefer <3)

---

### 4.2 Code Duplication Detection

**Tool:** `jscpd`

```bash
# Install jscpd
npm install -D jscpd

# Find duplicated code
npx jscpd src/ --min-lines 5 --min-tokens 50

# Generate HTML report
npx jscpd src/ --format html --output ./jscpd-report
open jscpd-report/index.html
```

---

### 4.3 Bundle Size Analysis

```bash
# Build project
npm run build

# Analyze bundle size
npx esbuild-visualizer dist/index.js

# Check individual file sizes
find dist -name "*.js" -exec ls -lh {} \; | sort -k5 -hr | head -20
```

---

## 🧪 TIER 5: Integration Testing

### 5.1 End-to-End MCP Server Test

**Create test:** `tests/e2e/mcp-server.test.ts`

```typescript
/**
 * E2E test: Start server, call all tools, verify responses
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('MCP Server E2E', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    // Start server
    transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/cli.js'],
    });

    client = new Client({ name: 'test-client', version: '1.0.0' }, {});
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  it('should list all 21 tools', async () => {
    const result = await client.listTools();
    expect(result.tools).toHaveLength(21);
  });

  it('should call sheets_auth tool', async () => {
    const result = await client.callTool({
      name: 'sheets_auth',
      arguments: { action: 'status' },
    });
    expect(result.isError).toBe(false);
  });

  // Add test for each tool...
});
```

```bash
# Run E2E tests
npm run test:e2e
```

---

## 🤖 TIER 6: AI-Powered Analysis with MCP Servers

### 6.1 Use Code Analysis MCP Servers

**Install useful MCP servers:**

```bash
# Filesystem MCP server (analyze project structure)
npm install -g @modelcontextprotocol/server-filesystem

# GitHub MCP server (check issues, PRs)
npm install -g @modelcontextprotocol/server-github

# Brave Search MCP server (research best practices)
npm install -g @modelcontextprotocol/server-brave-search
```

**Configure in Claude Desktop:**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/thomascahill/Documents/servalsheets 2"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-token"
      }
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-key"
      }
    }
  }
}
```

**Then ask Claude to:**

- "Use filesystem MCP to analyze all TypeScript files and find inconsistencies"
- "Use GitHub MCP to check for open issues related to documentation"
- "Use Brave Search to find latest MCP best practices and compare to our implementation"

---

### 6.2 Custom Analysis MCP Server

**Create your own audit MCP server:**

```bash
# Create new MCP server project
mkdir servalsheets-auditor
cd servalsheets-auditor
npm init -y
npm install @modelcontextprotocol/sdk
```

**`src/audit-server.ts`:**

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const server = new Server(
  { name: 'servalsheets-auditor', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Tool: Check all handlers are registered
server.tool('audit_handler_registration', 'Check all handlers are properly registered', {}, async () => {
  const handlersDir = '../src/handlers';
  const serverFile = '../src/server.ts';

  const handlerFiles = readdirSync(handlersDir).filter(f => f.endsWith('.ts'));
  const serverContent = readFileSync(serverFile, 'utf-8');

  const unregistered = handlerFiles.filter(f => {
    const handlerName = f.replace('.ts', '');
    return !serverContent.includes(handlerName);
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        totalHandlers: handlerFiles.length,
        unregistered,
        status: unregistered.length === 0 ? 'OK' : 'ISSUES_FOUND'
      }, null, 2)
    }]
  };
});

// Tool: Check schema consistency
server.tool('audit_schema_consistency', 'Check all schemas match their handlers', {}, async () => {
  // Implementation...
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

**Then use it with Claude:**

```bash
npx @modelcontextprotocol/inspector dist/audit-server.js
```

---

## 📊 TIER 7: Continuous Monitoring

### 7.1 Create Audit Dashboard Script

**`scripts/audit-dashboard.sh`:**

```bash
#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📊 SERVALSHEETS COMPREHENSIVE AUDIT DASHBOARD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. TypeScript Compilation
echo "1️⃣  TypeScript Compilation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx tsc --noEmit 2>&1 | grep -c "error TS" | xargs -I {} echo "  Errors: {}"
echo ""

# 2. Circular Dependencies
echo "2️⃣  Circular Dependencies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx madge --circular --extensions ts src/ | grep -c "✖" | xargs -I {} echo "  Found: {}"
echo ""

# 3. Test Coverage
echo "3️⃣  Test Coverage"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npm test -- --coverage --silent 2>&1 | grep "All files" | head -1
echo ""

# 4. Security Vulnerabilities
echo "4️⃣  Security Vulnerabilities"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npm audit --audit-level=moderate --json | jq -r '.metadata | "  Total: \(.vulnerabilities.total), High: \(.vulnerabilities.high), Critical: \(.vulnerabilities.critical)"'
echo ""

# 5. Outdated Packages
echo "5️⃣  Outdated Packages"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npm outdated | wc -l | xargs -I {} echo "  Packages: {}"
echo ""

# 6. Unused Exports
echo "6️⃣  Unused Exports (Dead Code)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx ts-prune | grep -c "used in module" | xargs -I {} echo "  Found: {}"
echo ""

# 7. Documentation Coverage
echo "7️⃣  Documentation Coverage"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx tsx scripts/check-doc-coverage.ts 2>&1 | grep "coverage:"
echo ""

# 8. Code Duplication
echo "8️⃣  Code Duplication"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx jscpd src/ --silent | grep "duplication" | head -1
echo ""

# 9. Bundle Size
echo "9️⃣  Bundle Size"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ls -lh dist/index.js 2>/dev/null | awk '{print "  Main bundle: " $5}' || echo "  Not built"
echo ""

# 10. MCP Compliance
echo "🔟 MCP Protocol Compliance"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npx tsx scripts/check-mcp-compliance.ts 2>&1 | grep "checks passed"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Audit completed: $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

```bash
chmod +x scripts/audit-dashboard.sh
./scripts/audit-dashboard.sh
```

---

### 7.2 GitHub Actions CI Pipeline

**`.github/workflows/comprehensive-audit.yml`:**

```yaml
name: Comprehensive Audit

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 0 * * 0' # Weekly on Sunday

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript compilation
        run: npm run typecheck

      - name: Lint check
        run: npm run lint

      - name: Test with coverage
        run: npm run test:coverage

      - name: Check circular dependencies
        run: npx madge --circular --extensions ts src/

      - name: Security audit
        run: npm audit --audit-level=moderate

      - name: Check for outdated packages
        run: npm outdated || true

      - name: Unused exports check
        run: npx ts-prune > unused-exports.txt || true

      - name: MCP compliance check
        run: npx tsx scripts/check-mcp-compliance.ts

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info

      - name: Generate audit report
        run: ./scripts/audit-dashboard.sh > audit-report.txt

      - name: Upload audit report
        uses: actions/upload-artifact@v4
        with:
          name: audit-report
          path: audit-report.txt
```

---

## ✅ MASTER AUDIT CHECKLIST

**Run these commands in order:**

```bash
# 1. Setup audit tools (one-time)
npm install -D madge ts-prune typedoc markdown-link-check \
  complexity-report jscpd ts-morph

# 2. Run comprehensive audit
npm run typecheck                           # TypeScript errors
npx madge --circular src/                   # Circular deps
npx ts-prune                                # Dead code
npm test -- --coverage                       # Test coverage
npm audit                                    # Security
npm outdated                                 # Updates
npx tsx scripts/check-mcp-compliance.ts     # MCP compliance
npx tsx scripts/check-doc-coverage.ts       # Documentation
npx jscpd src/                              # Duplication
npx typedoc --validation.notDocumented      # API docs

# 3. Interactive testing
npx @modelcontextprotocol/inspector dist/cli.js

# 4. Generate dashboard
./scripts/audit-dashboard.sh

# 5. Review reports
cat typescript-audit.txt
cat unused-exports.txt
open jscpd-report/index.html
open coverage/index.html
open docs/api/index.html
```

---

## 📈 Success Criteria

**Your project is "audit-passing" when:**

- ✅ **0 TypeScript errors** in strict mode
- ✅ **0 circular dependencies**
- ✅ **>80% test coverage** (handlers, services)
- ✅ **0 high/critical security vulnerabilities**
- ✅ **<5% code duplication**
- ✅ **>70% documentation coverage**
- ✅ **100% MCP compliance** (all checks pass)
- ✅ **All 21 tools testable** in MCP Inspector
- ✅ **<10 unused exports** (dead code)
- ✅ **All dependencies <1 year old**

---

## 🚀 Next Steps

1. **Run Tier 1-3** (automated checks) - **1 day**
2. **Fix issues found** - **2-3 days**
3. **Set up CI pipeline** (GitHub Actions) - **2 hours**
4. **Run weekly audits** - **ongoing**
5. **Use MCP servers** for AI-assisted analysis - **ongoing**

---

**This toolkit provides systematic, tool-based validation that's far more reliable than manual inspection!**
