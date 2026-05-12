

# ServalSheets Specialized Agents

> 21 task-specific agents for Claude Code. Each agent provides focused expertise
> and tooling for a particular aspect of the ServalSheets codebase.
>
> **Architecture:** Hub-and-spoke audit system. `servalsheets-director` owns the master dossier
> at `.serval/audit/master-dossier.yaml` and dispatches the 7 audit specialists. Development agents
> are independent and dispatched directly by `dev-team-lead`.

## Agent Index

### Core Development

| Agent                           | File                             | Purpose                                                                                     |
| ------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| **ServalSheets Implementation** | `servalsheets-implementation.md` | TDD-based feature implementation — adding actions, fixing bugs, modifying handlers/schemas  |
| **ServalSheets Research**       | `servalsheets-research.md`       | Fast read-only codebase research — pattern discovery, architectural analysis, code examples |
| **ServalSheets Validation**     | `servalsheets-validation.md`     | Automated gate pipeline (G0–G4) for pre-commit checks and phase completion                  |
| **Debug Tracer**                | `debug-tracer.md`                | Execution path tracer for the 4-layer pipeline to pinpoint failure origins                  |

### Quality & Testing

| Agent                        | File                                   | Purpose                                                                               |
| ---------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| **Testing Specialist**       | `testing-specialist.md`                | Test strategy design — property-based tests, mutation testing, critical path coverage |
| **Comprehensive Tester**     | `servalsheets-comprehensive-tester.md` | Real-API testing of all 25 tools / 410 actions with performance analysis              |
| **Code Review Orchestrator** | `code-review-orchestrator.md`          | Multi-perspective review — type checking, linting, MCP compliance, security, tests    |
| **Security Auditor**         | `security-auditor.md`                  | OWASP review, OAuth/credential handling, SQL injection, authorization gaps            |
| **Performance Optimizer**    | `performance-optimizer.md`             | Profiling, bottleneck identification, quota optimization, regression validation       |

### Google API Expertise

| Agent                         | File                          | Purpose                                                                              |
| ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------------ |
| **Google API Architect**      | `google-api-architect.md`     | Expert guidance on Sheets/Drive/Apps Script/BigQuery implementation and optimization |
| **Google API Expert**         | `google-api-expert.md`        | Sheets API v4 specialist — real-time docs access, quota optimization                 |
| **Google Apps Script Expert** | `google-appsscript-expert.md` | Apps Script API — custom functions, automation patterns                              |
| **Google BigQuery Expert**    | `google-bigquery-expert.md`   | BigQuery API — Sheets-BigQuery integration patterns                                  |
| **Google Drive Expert**       | `google-drive-expert.md`      | Drive API v3 — file operations, permissions, real-time docs access                   |

### Strategic Audit (Director + Specialists)

| Agent | File | Purpose |
|---|---|---|
| **ServalSheets Director** | `servalsheets-director.md` | Master audit Director — synthesizes specialist YAML, owns `master-dossier.yaml`, dispatches specialists, produces board-grade outputs |
| **Competitive Intelligence** | `competitive-intelligence.md` | Tracks Gemini Sheets, Copilot Excel, OSS MCPs — writes `specialists/competitive.yaml` |
| **Product Gap Analyst** | `product-gap-analyst.md` | Synthesizes functional + competitive YAML into prioritized gap matrix — writes `specialists/gaps.yaml` |
| **Doc DX Auditor** | `doc-dx-auditor.md` | Audits docs across 3 audiences: devs, LLM agents, procurement — writes `specialists/dx.yaml` |

> **Dossier:** `.serval/audit/specialists/` — YAML files written by each specialist. Director reads all and synthesizes.
> **Other specialists** (protocol, security, testing, functional) use existing agents in audit mode — see their descriptions.

### Protocol & Configuration

| Agent                       | File                         | Purpose                                                                          |
| --------------------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| **MCP Protocol Expert**     | `mcp-protocol-expert.md`     | Protocol compliance validation against MCP 2025-11-25 spec                       |
| **MCP Protocol Specialist** | `mcp-protocol-specialist.md` | Elite protocol specialist — compliance, implementation, transport layer guidance |
| **Claude Config Optimizer** | `claude-config-optimizer.md` | Meta-agent for optimizing Claude Code configuration and MCP server usage         |

## Usage

Agents are invoked via Claude Code's Task tool with the appropriate agent file:

```
Task(subagent_type="...", prompt="...", description="...")
```

Each agent file contains its own system prompt with specialized instructions, tool access patterns, and domain knowledge specific to its role.

## When to Use Which Agent

- **Adding a new action?** → ServalSheets Implementation
- **Investigating a bug?** → Debug Tracer → ServalSheets Research
- **Pre-commit check?** → ServalSheets Validation
- **Writing tests?** → Testing Specialist (unit/property) or Comprehensive Tester (live API)
- **Code review?** → Code Review Orchestrator
- **Performance issue?** → Performance Optimizer
- **Security concern?** → Security Auditor
- **Google API question?** → Google API Expert (Sheets), Drive/BigQuery/Apps Script experts for those APIs
- **MCP protocol question?** → MCP Protocol Expert or Specialist
- **Optimizing Claude setup?** → Claude Config Optimizer
- **"Where are we competitively?"** → ServalSheets Director (synthesizes from dossier)
- **Refresh competitive data?** → Competitive Intelligence
- **"What should we build next?"** → Product Gap Analyst (needs functional + competitive YAML)
- **Docs/DX audit?** → Doc DX Auditor
- **Full dossier refresh?** → Director dispatches all specialists
