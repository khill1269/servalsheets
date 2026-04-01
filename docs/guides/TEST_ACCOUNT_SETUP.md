---
title: Reviewer Test Account Setup
category: guide
doc_class: active
last_updated: 2026-03-31
description: Instructions for Anthropic reviewers to set up a test environment for evaluating ServalSheets.
version: 2.0.0
audience: reviewer
---

# Reviewer Test Account Setup

This guide provides everything an Anthropic reviewer needs to evaluate
ServalSheets end-to-end: test credentials, sample spreadsheets, and
representative workflows.

> **Server facts** — 25 tools, 409 actions, v2.0.0, MCP 2025-11-25

## Quick Start (5 minutes)

### 1. Connect via Claude Connectors

In Claude Desktop or Claude.ai:

```
Settings → Connectors → Add Connector
```

Enter the hosted ServalSheets URL (provided separately via secure channel).

### 2. Authenticate

Click **Connect** and complete the Google OAuth flow using the reviewer test
account credentials provided below.

### 3. Run a smoke test

In a new Claude conversation:

```
Use ServalSheets to check connection status, then list my accessible spreadsheets.
```

Expected: Claude calls `sheets_auth → status`, then `sheets_core → list`.

## Test Account Details

Test credentials are provided via Anthropic's secure reviewer portal.

The test Google account has the following sample spreadsheets pre-loaded:

| Spreadsheet                           | Purpose                                  |
| ------------------------------------- | ---------------------------------------- |
| ServalSheets Review — Basic Data      | Read/write/format tests                  |
| ServalSheets Review — Financial Model | Analysis, compute, dependency tests      |
| ServalSheets Review — Collaboration   | Sharing, comments, version history tests |

> Actual spreadsheet IDs are provided in the reviewer portal alongside credentials.

## Representative Test Workflows

Run these in Claude to evaluate coverage across the main capability areas.

### Workflow 1 — Read and analyze (2 min)

```
1. Read the data in the "Sales" sheet of the Basic Data spreadsheet
2. Run a comprehensive analysis on it
3. Suggest a chart visualization
```

Tools exercised: `sheets_data.read`, `sheets_analyze.comprehensive`,
`sheets_visualize.suggest_chart`

### Workflow 2 — Write with safety rails (3 min)

```
1. Write a new row with today's date, "Test entry", and value 999 to the Basic Data sheet
2. Show me the write confirmation before executing
3. After writing, undo the change
```

Tools exercised: `sheets_confirm.request`, `sheets_data.write`,
`sheets_history.undo`

### Workflow 3 — Formula generation (2 min)

```
In the Financial Model spreadsheet, generate a formula that calculates
the 90-day moving average of column B and explain what it does.
```

Tools exercised: `sheets_analyze.generate_formula`,
`sheets_compute.explain_formula`

### Workflow 4 — Transaction and rollback (3 min)

```
1. Begin a transaction on the Basic Data spreadsheet
2. Queue 3 writes: update cells A10, B10, C10 with test values
3. Show me the plan before committing
4. Commit atomically
```

Tools exercised: `sheets_transaction.begin`, `sheets_transaction.queue`,
`sheets_confirm.request`, `sheets_transaction.commit`

### Workflow 5 — What-if scenario modeling (2 min)

```
In the Financial Model spreadsheet, model what happens to all dependent
cells if Revenue in B2 drops by 20%.
```

Tools exercised: `sheets_dependencies.build`,
`sheets_dependencies.model_scenario`

### Workflow 6 — Collaboration workflow (3 min)

```
1. Add a comment to cell A1 of the Collaboration spreadsheet saying "Reviewed"
2. Create a version snapshot with description "Pre-edit snapshot"
3. List the 5 most recent revision history entries
```

Tools exercised: `sheets_collaborate.comment_add`,
`sheets_collaborate.version_create_snapshot`,
`sheets_collaborate.version_list_revisions`

## Full Tool Coverage Matrix

| Tool                  | Actions | Guide                                       |
| --------------------- | ------- | ------------------------------------------- |
| `sheets_auth`         | 5       | [OAuth Setup](OAUTH_USER_SETUP.md)          |
| `sheets_core`         | 21      | [Usage Guide](USAGE_GUIDE.md)               |
| `sheets_data`         | 25      | [Usage Guide](USAGE_GUIDE.md)               |
| `sheets_format`       | 25      | [Formatting](../examples/formatting.md)     |
| `sheets_dimensions`   | 30      | —                                           |
| `sheets_visualize`    | 18      | —                                           |
| `sheets_analyze`      | 26      | [Analysis](../examples/analysis.md)         |
| `sheets_collaborate`  | 41      | —                                           |
| `sheets_history`      | 10      | —                                           |
| `sheets_transaction`  | 6       | [Transactions](../features/TRANSACTIONS.md) |
| `sheets_quality`      | 4       | —                                           |
| `sheets_confirm`      | 5       | [Confirmation Guide](CONFIRMATION_GUIDE.md) |
| `sheets_fix`          | 6       | —                                           |
| `sheets_composite`    | 21      | —                                           |
| `sheets_session`      | 31      | —                                           |
| `sheets_advanced`     | 31      | —                                           |
| `sheets_compute`      | 16      | —                                           |
| `sheets_dependencies` | 10      | [Dependencies](sheets_dependencies.md)      |
| `sheets_agent`        | 8       | [Agent Mode](../features/AGENT_MODE.md)     |
| `sheets_templates`    | 8       | —                                           |
| `sheets_connectors`   | 10      | —                                           |
| `sheets_bigquery`     | 17      | [BigQuery](sheets_bigquery.md)              |
| `sheets_appsscript`   | 19      | [Apps Script](sheets_appsscript.md)         |
| `sheets_webhook`      | 11      | [Webhooks](sheets_webhook.md)               |
| `sheets_federation`   | 4       | [Federation](../features/FEDERATION.md)     |

## Expected Behavior Notes

- **Auth status** — The test account has pre-authorized tokens. `sheets_auth.status`
  should return `authenticated: true` immediately.
- **Quota** — The test account uses a dedicated Google Cloud project with elevated
  Sheets API quota (300 reads/min, 60 writes/min).
- **Safety rails** — Destructive operations (delete, clear, overwrite >100 cells)
  will trigger `sheets_confirm` for user approval before executing. This is by design.
- **Token refresh** — Google access tokens expire after 1 hour. ServalSheets
  auto-refreshes using the stored refresh token — no manual re-auth needed.

## Reporting Issues

If a tool behaves unexpectedly during review:

1. Note the tool name and action (e.g., `sheets_analyze.comprehensive`)
2. Note the spreadsheet ID and any relevant cell ranges
3. Check `/health/ready` for server health status
4. File a report via the Anthropic reviewer portal

Logs are available at the server's `/metrics` and `/stats` endpoints for
debugging. The server also exposes OpenTelemetry traces if needed.
