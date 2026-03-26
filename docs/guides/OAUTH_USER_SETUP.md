---
title: OAuth User Authentication Setup
category: guide
last_updated: 2026-03-24
description: Configure Google OAuth for ServalSheets remote MCP connectors using the current Claude flow.
version: 2.0.0
tags: [oauth, authentication, setup, claude]
audience: user
difficulty: intermediate
doc_class: active
---

# OAuth User Authentication Setup

This guide is for the current **remote MCP connector** flow.

It does **not** use the legacy pattern of editing
`claude_desktop_config.json` to point Claude Desktop directly at a remote HTTP
server.

## Current Connection Model

- Claude Desktop local servers still use stdio config
- remote ServalSheets connectors are added through Claude's connector UI
- your remote server must expose the correct OAuth and well-known endpoints
- your OAuth app must allow both Claude callback URLs and any localhost testing callbacks you support

## 1. Create Google OAuth Credentials

1. In Google Cloud Console, create or select a dedicated project.
2. Enable Google Sheets API and Google Drive API.
3. Configure the OAuth consent screen.
4. Create a **Web application** OAuth client.

## 2. Allow The Right Redirect URIs

At minimum, allow the current Claude callback URLs:

```text
https://claude.ai/api/mcp/auth_callback
https://claude.com/api/mcp/auth_callback
```

Also allow any localhost callbacks you support for local testing, Claude Code,
or MCP Inspector.

Example localhost callbacks:

```text
http://localhost:3000/callback
http://localhost:6274/oauth/callback
```

Verify the current Claude callback expectations against Anthropic's latest
remote MCP connector docs before production rollout.

## 3. Configure ServalSheets

Set the OAuth environment variables on the remote ServalSheets deployment.

Typical values include:

```bash
OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_REDIRECT_URI=https://claude.ai/api/mcp/auth_callback
ALLOWED_REDIRECT_URIS=https://claude.ai/api/mcp/auth_callback,https://claude.com/api/mcp/auth_callback,http://localhost:3000/callback
```

Use your real deployment URL and redirect strategy. Do not copy the example
blindly into production.

## 4. Start The Remote Server

Your submission target should be the hosted HTTP server, not the local stdio
adapter.

For local verification of the hosted surface:

```bash
npm run start:http
```

Then verify:

```bash
curl http://localhost:3000/.well-known/mcp.json
curl http://localhost:3000/.well-known/oauth-authorization-server
curl http://localhost:3000/health
```

## 5. Add The Connector In Claude

Use Claude's current connector UX:

1. Open Claude.
2. Go to `Settings > Connectors`.
3. Add the ServalSheets remote connector.
4. Complete the OAuth consent flow in the browser.
5. Return to Claude and confirm the connector is active.

Do not configure the remote server directly in
`claude_desktop_config.json`. That is not the supported remote connector path.

## 6. Validate The Login Flow

Successful validation should cover:

- initial OAuth login
- callback completion
- token persistence
- token refresh
- a successful read request from Claude

Example validation prompts:

- `List my available Google Sheets`
- `Read the first 10 rows from the reviewer test spreadsheet`
- `Analyze the summary sheet and explain what it contains`

## 7. Troubleshooting

### Redirect URI mismatch

- verify every callback URL exactly matches the OAuth client configuration
- verify `ALLOWED_REDIRECT_URIS` includes the same values
- verify you are not mixing localhost and hosted redirect flows incorrectly

### Connector does not appear connected

- verify the connector was added through Claude settings, not local config
- verify `/.well-known/mcp.json` is reachable from the hosted URL
- verify the OAuth metadata endpoints are reachable

### OAuth succeeds but calls fail

- verify the reviewer account actually has access to the sample spreadsheets
- verify required Google scopes were granted
- check the remote server logs for token refresh or session errors

## 8. Security Notes

- use a dedicated OAuth project for review or development
- do not commit OAuth secrets
- keep token storage encrypted
- scope permissions to only what the submitted server needs

## 9. Related Docs

- [`SUBMISSION_CHECKLIST.md`](./SUBMISSION_CHECKLIST.md)
- [`TEST_ACCOUNT_SETUP.md`](./TEST_ACCOUNT_SETUP.md)
- [`CLAUDE_DESKTOP_SETUP.md`](./CLAUDE_DESKTOP_SETUP.md)
