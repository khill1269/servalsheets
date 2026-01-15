# Part 6: Execution Framework (Categories 81-106)

**Agent execution commands and verification procedures**

---

## Required Commands

### Phase 1: Build & Verify
```bash
cd /Users/thomascahill/Documents/mcp-servers/servalsheets
mkdir -p analysis-output

# Build
npm run build 2>&1 | tee analysis-output/build.log
echo "Exit code: $?"

# Type check
npm run typecheck 2>&1 | tee analysis-output/typecheck.log
echo "Exit code: $?"

# Lint
npm run lint 2>&1 | tee analysis-output/lint.log
echo "Exit code: $?"
```

### Phase 2: Test
```bash
# All tests
npm test 2>&1 | tee analysis-output/tests.log
echo "Exit code: $?"

# Coverage
npm run test:coverage 2>&1 | tee analysis-output/coverage.log
echo "Exit code: $?"
```

### Phase 3: Security
```bash
# Audit
npm audit --json > analysis-output/audit.json
npm audit 2>&1 | tee analysis-output/audit.log

# Secret scan
grep -r "sk-" src/ && echo "SECRETS FOUND!" || echo "No secrets"
grep -r "API_KEY" src/ && echo "API KEYS FOUND!" || echo "No API keys"
```

### Phase 4: Validate
```bash
# Server.json
npm run validate:server-json 2>&1 | tee analysis-output/validate.log

# Tool count
npm run show:tools 2>&1 | tee analysis-output/tools.log
```

### Phase 5: Metrics
```bash
# Dependencies
npm ls --depth=0 > analysis-output/deps.log
npm outdated > analysis-output/outdated.log 2>&1 || true

# LOC
find src -name "*.ts" | xargs wc -l > analysis-output/loc.log

# File counts
echo "Source files: $(find src -name '*.ts' | wc -l)"
echo "Test files: $(find tests -name '*.ts' | wc -l)"
```

---

## Verification Checklist

### Category 81: Build Verification
- [ ] `npm run build` exits 0
- [ ] dist/ directory created
- [ ] All .js files present
- [ ] All .d.ts files present

### Category 82: Type Check Verification
- [ ] `npm run typecheck` exits 0
- [ ] "Found 0 errors" in output
- [ ] No warnings about missing types

### Category 83: Lint Verification
- [ ] `npm run lint` exits 0
- [ ] No errors
- [ ] Warnings acceptable (document count)

### Category 84: Test Verification
- [ ] `npm test` exits 0
- [ ] All tests pass
- [ ] Test count ≥ 1,500

### Category 85: Coverage Verification
- [ ] Line coverage ≥ 75%
- [ ] Branch coverage ≥ 70%
- [ ] Function coverage ≥ 75%
- [ ] Statement coverage ≥ 75%

### Category 86: Security Verification
- [ ] 0 critical vulnerabilities
- [ ] 0 high vulnerabilities
- [ ] No secrets in source

### Category 87: Dependency Verification
- [ ] MCP SDK version correct
- [ ] No deprecated packages
- [ ] All deps resolve

### Category 88: Tool Registration
- [ ] 17 tools registered
- [ ] All have descriptions
- [ ] All have schemas
- [ ] All have annotations

### Category 89: server.json Verification
- [ ] Valid JSON
- [ ] Version matches package.json
- [ ] Tool count matches
- [ ] Action count matches

### Category 90: File Structure
- [ ] src/ organized correctly
- [ ] tests/ mirrors src/
- [ ] docs/ complete

### Category 91: Documentation
- [ ] README complete
- [ ] CHANGELOG up to date
- [ ] API docs present

### Category 92: Examples
- [ ] Examples directory exists
- [ ] Examples are runnable
- [ ] Examples cover main use cases

### Category 93: CI/CD
- [ ] GitHub Actions present
- [ ] All workflows pass
- [ ] Docker configured

### Category 94: Version Consistency
- [ ] package.json version
- [ ] server.json version
- [ ] CHANGELOG version
- [ ] All match

### Category 95: Cross-Reference
- [ ] Tool count consistent everywhere
- [ ] Action count consistent
- [ ] No stale references

### Category 96: Overall Health
- [ ] All commands pass
- [ ] No warnings in build
- [ ] Project is healthy

---

## Evidence Collection

After running commands, collect these files:

```
analysis-output/
├── build.log       # npm run build
├── typecheck.log   # npm run typecheck
├── lint.log        # npm run lint
├── tests.log       # npm test
├── coverage.log    # npm run test:coverage
├── audit.json      # npm audit --json
├── audit.log       # npm audit (human readable)
├── validate.log    # npm run validate:server-json
├── tools.log       # npm run show:tools
├── deps.log        # npm ls
├── outdated.log    # npm outdated
└── loc.log         # Line counts
```

---

## Failure Recovery

### If build fails:
```bash
rm -rf dist node_modules
npm ci
npm run build
```

### If tests fail:
```bash
# Run single failing test
npm test -- tests/handlers/values.test.ts

# Check for environment issues
node -v  # Should be 20+
npm -v   # Should be 10+
```

### If lint fails:
```bash
# Auto-fix
npm run lint -- --fix
npm run format
```

---

## Scoring Summary (Part 6)

| Category | Description | Pass/Fail |
|----------|-------------|-----------|
| 81. Build | npm run build | ___ |
| 82. Types | npm run typecheck | ___ |
| 83. Lint | npm run lint | ___ |
| 84. Tests | npm test | ___ |
| 85. Coverage | ≥75% | ___ |
| 86. Security | 0 high/critical | ___ |
| 87. Deps | Clean audit | ___ |
| 88. Tools | 27 registered | ___ |
| 89. Manifest | server.json valid | ___ |
| 90. Structure | Organized | ___ |
| 91. Docs | Complete | ___ |
| 92. Examples | Present | ___ |
| 93. CI/CD | Passing | ___ |
| 94. Versions | Consistent | ___ |
| 95. Cross-Ref | No drift | ___ |
| 96. Health | Overall | ___ |

**Pass Rate: ___ / 16**
