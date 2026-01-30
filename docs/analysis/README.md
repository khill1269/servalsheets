# ServalSheets Analysis Framework

> **Version:** 2.0.0 | **Categories:** 106 | **Max Score:** 140%

## Quick Start

```bash
# Run the full analysis
cd /Users/thomascahill/Documents/mcp-servers/servalsheets
npm run ci 2>&1 | tee analysis-output/ci.log
npm run test:coverage 2>&1 | tee analysis-output/coverage.log
npm audit --json > analysis-output/audit.json
```

## File Index

| File | Categories | Tokens | Focus |
|------|------------|--------|-------|
| [00_QUICKSTART.md](00_QUICKSTART.md) | - | ~2K | Agent instructions, commands |
| [01_FUNCTIONAL.md](01_FUNCTIONAL.md) | 1-12 | ~8K | Auth, Data, Format, Safety |
| [02_PROTOCOL.md](02_PROTOCOL.md) | 13-16 | ~6K | MCP, Sheets API, Drive, BigQuery |
| [03_CODE_QUALITY.md](03_CODE_QUALITY.md) | 17-32 | ~8K | Zod, TypeScript, Testing, CI/CD |
| [04_DEEP_TECHNICAL.md](04_DEEP_TECHNICAL.md) | 33-60 | ~10K | Caching, Sessions, Performance |
| [05_EXCELLENCE.md](05_EXCELLENCE.md) | 61-80 | ~8K | DX, Scalability, Security |
| [06_EXECUTION.md](06_EXECUTION.md) | 81-106 | ~8K | Agent commands, VS Code |
| [07_SCORING.md](07_SCORING.md) | - | ~3K | Rubric, report template |

## Category Summary

### Base Score (100%)
- **Part 1:** Functional Features (1-12) = 46%
- **Part 2:** Protocol Compliance (13-16) = 18%
- **Part 3:** Code Quality (17-32) = 36%

### Bonus Score (+40%)
- **Part 4:** Deep Technical (33-60) = +20%
- **Part 5:** Excellence (61-80) = +20%

**Maximum Possible: 140%**

## Project Facts

| Metric | Value |
|--------|-------|
| Version | 1.6.0 |
| Tools | 21 |
| Actions | 2 |
| Tests | 1,830+ |
| LOC | 77,813 |
| MCP SDK | 1.25.2 |

## How to Use

1. **Read 00_QUICKSTART.md first** - Get agent instructions
2. **Run commands** - Execute npm ci, test, audit
3. **Score each file** - Work through 01-06 sequentially
4. **Use 07_SCORING.md** - Apply rubric, generate report
