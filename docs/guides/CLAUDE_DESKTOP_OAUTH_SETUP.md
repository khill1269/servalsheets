---
title: Claude Desktop OAuth Setup
category: guide
last_updated: 2026-03-24
description: Local stdio OAuth helper flow for Claude Desktop.
version: 2.0.0
tags: [oauth, authentication, setup, claude]
audience: user
difficulty: intermediate
doc_class: active
---

# Claude Desktop OAuth Setup

This guide is for the **local Claude Desktop stdio** setup path.

Use it when Claude Desktop launches ServalSheets as a local process from
`claude_desktop_config.json` and you want that local process to complete a
browser-based Google OAuth flow.

If you are configuring a **hosted remote connector**, use
[`OAUTH_USER_SETUP.md`](./OAUTH_USER_SETUP.md) instead.

## What This Flow Does

The local helper script:

1. builds the project
2. starts the local HTTP auth helper
3. writes or updates the local Claude Desktop stdio config
4. opens a browser authorization flow
5. stores OAuth tokens for the local ServalSheets process

It does **not** configure a hosted remote connector in Claude.

## Quick Start

```bash
cd /path/to/servalsheets
npm install
npm run build
./scripts/setup-oauth.sh
```

Typical result:

- local config written for `dist/cli.js`
- local auth helper started on `localhost`
- browser authorization link shown

## Local User Flow

1. Run `./scripts/setup-oauth.sh`.
2. Follow the browser login flow.
3. Restart Claude Desktop.
4. Use ServalSheets normally in Claude Desktop.

This is a one-time local setup unless your tokens are revoked or your OAuth
configuration changes.

## What Claude Desktop Uses

Claude Desktop still uses a local stdio config like this:

```json
{
  "mcpServers": {
    "servalsheets": {
      "command": "node",
      "args": ["/absolute/path/to/servalsheets/dist/cli.js"]
    }
  }
}
```

The browser OAuth portion is only there to supply credentials to that local
process.

## Troubleshooting

### The browser flow works but Claude still cannot access Sheets

- restart Claude Desktop fully
- verify the local config still points at the correct `dist/cli.js`
- verify the local token store was written successfully

### Redirect mismatch

- verify the localhost callback configured by the setup flow matches the OAuth
  client configuration
- if you need a hosted remote connector, stop here and switch to
  [`OAUTH_USER_SETUP.md`](./OAUTH_USER_SETUP.md)

## Related Docs

- [`CLAUDE_DESKTOP_SETUP.md`](./CLAUDE_DESKTOP_SETUP.md)
- [`OAUTH_STANDARDIZED_SETUP.md`](./OAUTH_STANDARDIZED_SETUP.md)
- [`OAUTH_USER_SETUP.md`](./OAUTH_USER_SETUP.md)
