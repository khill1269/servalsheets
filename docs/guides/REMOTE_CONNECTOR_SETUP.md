---
title: Remote Connector Setup (Claude Connectors Directory)
category: guide
doc_class: active
last_updated: 2026-03-31
description: How to connect ServalSheets to Claude as a remote MCP connector via the Connectors Directory.
version: 2.0.0
audience: end-user
---

# Remote Connector Setup

This guide covers connecting ServalSheets to Claude as a **remote MCP connector**
via the Connectors Directory. This is the primary supported connection method for
Claude.ai and Claude Desktop.

> **Counts from generated facts** — 25 tools, 409 actions (v2.0.0, MCP 2025-11-25)

## Prerequisites

- Claude Pro, Team, or Enterprise account
- A Google account with Google Sheets access
- A hosted ServalSheets instance or the public hosted endpoint

## Connection Method: Claude Connectors Directory

Remote connectors are added through **Settings → Connectors** in Claude.

> ⚠️ Do **not** add ServalSheets via `claude_desktop_config.json` for remote mode.
> That configuration file is for local stdio servers only.
> Remote connectors must be registered through the Connectors UI.

### Step 1 — Open Connectors settings

In Claude Desktop or Claude.ai, navigate to:

```
Settings → Connectors → Add Connector
```

### Step 2 — Enter the server URL

Enter the base URL of your ServalSheets instance:

```
https://YOUR_SERVALSHEETS_HOST
```

Claude will automatically discover the server via `/.well-known/mcp.json` (SEP-1649 Server Card).

### Step 3 — Authorize with Google

Claude will redirect you through the OAuth flow:

1. Click **Connect** — Claude opens the ServalSheets authorization page
2. You are redirected to Google's consent screen
3. Approve the requested Google Sheets scopes
4. You are returned to Claude with the connector active

The OAuth flow uses PKCE (S256 method) and requires an HTTPS connection.

### Step 4 — Verify connection

In a new Claude conversation, try:

```
Check my ServalSheets connection status
```

Claude will call `sheets_auth` with `action: "status"` and confirm authentication.

## Callback URLs (for server operators)

If you operate a ServalSheets instance behind a firewall or custom domain, ensure
the following callback URLs are allowlisted in your OAuth client configuration:

```
https://claude.ai/api/mcp/auth_callback
https://claude.com/api/mcp/auth_callback
http://localhost:3000/callback
http://127.0.0.1:3000/callback
```

These are set via the `ALLOWED_REDIRECT_URIS` environment variable.

## Transport

ServalSheets uses **Streamable HTTP** transport (MCP 2025-11-25) exclusively for
remote connections. The primary endpoint is `/mcp`.

Legacy SSE transport is disabled by default (`ENABLE_LEGACY_SSE=false`). If a
client negotiates SSE, it receives a `410 Gone` response with a `Link` header
pointing to `/mcp`.

## Scopes

ServalSheets requests Google OAuth scopes in three tiers:

| Tier           | Actions included                                                   |
| -------------- | ------------------------------------------------------------------ |
| `sheets:read`  | Read spreadsheet data, metadata, charts, comments                  |
| `sheets:write` | All read actions plus write, format, manage sheets                 |
| `sheets:admin` | All write actions plus sharing, permissions, BigQuery, Apps Script |

The connector requests `sheets:write` by default. Elevate to `sheets:admin` by calling
`sheets_auth` with `action: "setup_feature"` in Claude.

## Discovery endpoints

Once running, your server exposes:

| Endpoint                                      | Purpose                                  |
| --------------------------------------------- | ---------------------------------------- |
| `GET /.well-known/mcp.json`                   | SEP-1649 Server Card — primary discovery |
| `GET /.well-known/oauth-authorization-server` | RFC 8414 OAuth metadata                  |
| `GET /.well-known/oauth-protected-resource`   | RFC 9728 resource metadata               |
| `GET /.well-known/mcp/tool-hashes`            | Tool integrity manifest                  |
| `GET /health/live`                            | Kubernetes liveness probe                |
| `GET /health/ready`                           | Kubernetes readiness probe               |
| `POST /mcp`                                   | Streamable HTTP MCP endpoint             |
| `DELETE /mcp`                                 | Session termination                      |

## Local stdio (Claude Desktop only)

For local development or Claude Desktop stdio mode, configure
`~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "servalsheets": {
      "command": "node",
      "args": ["/path/to/servalsheets-v2/dist/cli.js"],
      "env": {
        "GOOGLE_CLIENT_ID": "YOUR_GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET": "YOUR_GOOGLE_CLIENT_SECRET",
        "NODE_ENV": "development",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

Then restart Claude Desktop. Authentication runs interactively on first use.

## Troubleshooting

**"Connection refused" or server not found**

- Verify the server URL is reachable: `curl https://YOUR_HOST/health/ready`
- Check TLS certificate validity (must be from a recognized CA)
- Confirm firewall allows traffic from Claude IP ranges

**"OAuth error: redirect_uri not in allowlist"**

- Add the Claude callback URL to `ALLOWED_REDIRECT_URIS`
- Redeploy the server with the updated environment variable

**"Authentication expired"**

- Google access tokens expire after 1 hour and are auto-refreshed via the
  stored refresh token. If refresh fails, call `sheets_auth action:"login"`
  in Claude to re-authenticate.

**"Tool not found: sheets_data"**

- Ensure you are connected to ServalSheets v2.0.0 (25 tools, 409 actions)
- Older versions used different tool names (sheets_values, sheets_spreadsheet)

## Related guides

- [OAuth User Setup](OAUTH_USER_SETUP.md) — detailed OAuth configuration
- [Installation Guide](INSTALLATION_GUIDE.md) — deploying a self-hosted instance
- [Test Account Setup](TEST_ACCOUNT_SETUP.md) — reviewer environment setup
