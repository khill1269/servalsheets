# ServalSheets Documentation

> **Production-grade Google Sheets MCP server documentation**  
> Version 1.4.0 | Updated January 2026

## 📁 Documentation Structure

```
docs/
├── README.md                    # This file
├── architecture-diagrams.md     # System architecture (Mermaid)
├── openapi.json                 # OpenAPI specification
│
├── guides/                      # User & admin guides (18 files)
├── examples/                    # Tool request/response examples (17 files)
├── development/                 # Developer documentation (16 files)
├── operations/                  # Production runbooks (8 files)
├── analysis/                    # Audit framework (15 files)
├── planning/                    # Active roadmap (1 file)
├── releases/                    # Release notes (1 file)
│
├── generated/                   # Auto-generated (gitignored)
│   └── api/                     # TypeDoc API reference
│
└── archive/                     # Historical documentation
    └── 2026-01/                 # Archived files by date
```

**Active Files:** 79 | **Generated:** 244 | **Archived:** 172

---

## 🚀 Quick Start

| Goal                  | Start Here                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| **New user**          | [FIRST_TIME_USER.md](./guides/FIRST_TIME_USER.md) → [CLAUDE_DESKTOP_SETUP](./guides/CLAUDE_DESKTOP_SETUP.md) |
| **Developer**         | [TESTING.md](./development/TESTING.md) → [HANDLER_PATTERNS](./development/HANDLER_PATTERNS.md)               |
| **Production deploy** | [DEPLOYMENT.md](./guides/DEPLOYMENT.md) → [operations/](./operations/)                                       |
| **Troubleshooting**   | [TROUBLESHOOTING.md](./guides/TROUBLESHOOTING.md)                                                            |

---

## 📚 Documentation by Category

### User Guides (`guides/`)

End-user and administrator documentation:

| File                                                        | Description                |
| ----------------------------------------------------------- | -------------------------- |
| [INSTALLATION_GUIDE.md](./guides/INSTALLATION_GUIDE.md)     | Installation instructions  |
| [CLAUDE_DESKTOP_SETUP.md](./guides/CLAUDE_DESKTOP_SETUP.md) | Claude Desktop integration |
| [OAUTH_USER_SETUP.md](./guides/OAUTH_USER_SETUP.md)         | OAuth authentication setup |
| [USAGE_GUIDE.md](./guides/USAGE_GUIDE.md)                   | How to use ServalSheets    |
| [FIRST_TIME_USER.md](./guides/FIRST_TIME_USER.md)           | First-time walkthrough     |
| [PROMPTS_GUIDE.md](./guides/PROMPTS_GUIDE.md)               | Effective AI prompts       |
| [TROUBLESHOOTING.md](./guides/TROUBLESHOOTING.md)           | Common issues & solutions  |
| [DEPLOYMENT.md](./guides/DEPLOYMENT.md)                     | Production deployment      |
| [MONITORING.md](./guides/MONITORING.md)                     | Observability & metrics    |
| [PERFORMANCE.md](./guides/PERFORMANCE.md)                   | Performance optimization   |
| [SKILL.md](./guides/SKILL.md)                               | Claude skill integration   |

### Examples (`examples/`)

Request/response examples for production tools (see `src/schemas/index.ts` for tool/action counts):

| File                                                                    | Coverage                          |
| ----------------------------------------------------------------------- | --------------------------------- |
| [advanced-examples.json](./examples/advanced-examples.json)             | Named ranges, filters, protection |
| [analysis-examples.json](./examples/analysis-examples.json)             | Data quality analysis             |
| [dimensions-examples.json](./examples/dimensions-examples.json)         | Row/column operations             |
| [format-examples.json](./examples/format-examples.json)                 | Cell formatting & styles          |
| [oauth-flow-examples.json](./examples/oauth-flow-examples.json)         | OAuth 2.1 + PKCE flow             |
| [error-handling-examples.json](./examples/error-handling-examples.json) | Error handling patterns           |

**Note:** For complete tool documentation, see:

- `npm run show:tools` - List all tools with action counts
- `server.json` - Auto-generated MCP tool definitions
- [ACTION_REFERENCE.md](./guides/ACTION_REFERENCE.md) - Tool reference guide

### Development (`development/`)

Internal development documentation:

| File                                                                 | Description                     |
| -------------------------------------------------------------------- | ------------------------------- |
| [TESTING.md](./development/TESTING.md)                               | Comprehensive testing guide     |
| [HANDLER_PATTERNS.md](./development/HANDLER_PATTERNS.md)             | Handler implementation patterns |
| [DURABLE_SCHEMA_PATTERN.md](./development/DURABLE_SCHEMA_PATTERN.md) | Schema design patterns          |
| [DEVELOPER_WORKFLOW.md](./development/DEVELOPER_WORKFLOW.md)         | Development workflow            |
| [CLAUDE_CODE_RULES.md](./development/CLAUDE_CODE_RULES.md)           | AI coding guidelines            |
| [SOURCE_OF_TRUTH.md](./development/SOURCE_OF_TRUTH.md)               | Canonical references            |
| [SCRIPTS_REFERENCE.md](./development/SCRIPTS_REFERENCE.md)           | NPM scripts reference           |
| [testing/](./development/testing/)                                   | Testing subdocs (6 files)       |

### Operations (`operations/`)

Production runbooks and procedures:

| File                                                            | Description                 |
| --------------------------------------------------------------- | --------------------------- |
| [backup-restore.md](./operations/backup-restore.md)             | Backup & disaster recovery  |
| [disaster-recovery.md](./operations/disaster-recovery.md)       | Incident response (P0-P3)   |
| [scaling.md](./operations/scaling.md)                           | Horizontal/vertical scaling |
| [migrations.md](./operations/migrations.md)                     | Zero-downtime migrations    |
| [certificate-rotation.md](./operations/certificate-rotation.md) | TLS certificate rotation    |
| [jwt-secret-rotation.md](./operations/jwt-secret-rotation.md)   | JWT secret rotation         |
| [high-error-rate.md](./operations/high-error-rate.md)           | Error rate runbook          |
| [METRICS_REFERENCE.md](./operations/METRICS_REFERENCE.md)       | Metrics & alerting          |

### Analysis (`analysis/`)

Reusable audit framework for MCP servers:

| File                                                    | Description                |
| ------------------------------------------------------- | -------------------------- |
| [00_QUICKSTART.md](./analysis/00_QUICKSTART.md)         | Audit quickstart           |
| [01_FUNCTIONAL.md](./analysis/01_FUNCTIONAL.md)         | Functional analysis        |
| [02_PROTOCOL.md](./analysis/02_PROTOCOL.md)             | Protocol compliance        |
| [03_CODE_QUALITY.md](./analysis/03_CODE_QUALITY.md)     | Code quality audit         |
| [04_DEEP_TECHNICAL.md](./analysis/04_DEEP_TECHNICAL.md) | Technical deep-dive        |
| [05_EXCELLENCE.md](./analysis/05_EXCELLENCE.md)         | Excellence criteria        |
| [06_EXECUTION.md](./analysis/06_EXECUTION.md)           | Execution audit            |
| [07_SCORING.md](./analysis/07_SCORING.md)               | Scoring methodology        |
| [agent-prompts/](./analysis/agent-prompts/)             | AI agent prompts (6 files) |

---

## 🔧 API Reference

Auto-generated TypeDoc documentation is available at `docs/generated/api/`.

**Generate locally:**

```bash
npm run docs           # Generate API docs
npm run docs:watch     # Watch mode
```

> **Note:** Generated docs are gitignored. Run `npm run docs` after cloning.

---

## 📋 Additional Resources

### Marketing & Comparison

| File                                           | Description                  |
| ---------------------------------------------- | ---------------------------- |
| [COMPARISON_MATRIX.md](./COMPARISON_MATRIX.md) | ServalSheets vs alternatives |
| [CASE_STUDIES.md](./CASE_STUDIES.md)           | Real-world implementations   |

### Root-Level Files

| File                            | Description             |
| ------------------------------- | ----------------------- |
| [README.md](../README.md)       | Project overview        |
| [CHANGELOG.md](../CHANGELOG.md) | Version history         |
| [SECURITY.md](../SECURITY.md)   | Security policy         |
| [SKILL.md](../SKILL.md)         | Claude skill definition |

### Configuration Examples

| File                                                                        | Description           |
| --------------------------------------------------------------------------- | --------------------- |
| [.env.example](../.env.example)                                             | Environment variables |
| [claude_desktop_config.example.json](../claude_desktop_config.example.json) | Claude Desktop config |

### Knowledge Base (`src/knowledge/`)

AI-powered knowledge for smart suggestions:

- `api/` - API references (charts, pivots, formatting, validation)
- `formulas/` - Formula functions reference (100+ functions)
- `templates/` - Pre-built spreadsheet templates

---

## 🗄️ Archive

Historical documentation is preserved in `archive/2026-01/` (172 files).

Archive contains:

- Completed development phases
- Session summaries
- Historical analysis reports
- Superseded documentation

---

## 📊 Documentation Stats

| Category         | Files  | Purpose                  |
| ---------------- | ------ | ------------------------ |
| Guides           | 18     | User documentation       |
| Examples         | 17     | Request/response samples |
| Development      | 16     | Developer docs           |
| Operations       | 8      | Production runbooks      |
| Analysis         | 15     | Audit framework          |
| Planning         | 1      | Active roadmap           |
| Releases         | 1      | Release notes            |
| **Active Total** | **79** |                          |
| Generated (API)  | 244    | TypeDoc output           |
| Archive          | 172    | Historical               |

---

**Last Updated:** January 12, 2026  
**Documentation Version:** 3.0 (Reorganized per MCP best practices)
