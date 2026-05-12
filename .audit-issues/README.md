# Audit issues — 2026-04-29

Paste-ready GitHub issue drafts from a read-only-then-fixed audit run.
GitHub MCP authentication failed during this session, so issues couldn't be
filed automatically. Paste these into github.com/khill1269/servalsheets/issues/new
once auth is reconnected.

## Files

| File | Filing recommendation |
|---|---|
| `01-tool-mode-and-doc-drift.md` | File AND close (everything resolved) |
| `02-mcp-spec-compliance.md` | File as open — one P3 follow-up (`x-defer-loading`) |
| `03-security-hardening.md` | File AND close (10 fixes resolved, retractions documented) |
| `04-test-debt.md` | File as open — `.skip()` backlog needs owners |

## Source-code markers

The 10 security fixes are tagged in source with `SEC-008` through `SEC-015` and
`SAMPLING-001`. Grep for these to find the exact code added in this audit.

## Why this is `.audit-issues/` and not `audit/`

The repo's existing `audit/` folder contains long-lived architecture & protocol
compliance reports. This folder holds session-specific paste-ready issue
drafts; treat as ephemeral. Add to `.gitignore` if you don't want it tracked.
