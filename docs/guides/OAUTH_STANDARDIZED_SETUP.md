---
title: Standardized OAuth Setup Guide
category: guide
last_updated: 2026-03-24
description: Reference OAuth configuration for full-scope ServalSheets deployments.
version: 2.0.0
tags: [oauth, authentication, setup, scopes, google-api]
audience: user
difficulty: beginner
doc_class: active
---

# Standardized OAuth Setup Guide

This guide is the reference configuration for **full-scope OAuth** in
ServalSheets.

It is not the only user-facing connection flow:

- for **local Claude Desktop stdio**, see [`CLAUDE_DESKTOP_OAUTH_SETUP.md`](./CLAUDE_DESKTOP_OAUTH_SETUP.md)
- for **hosted remote connectors**, see [`OAUTH_USER_SETUP.md`](./OAUTH_USER_SETUP.md)

## What This Guide Covers

- the Google APIs that a full-scope ServalSheets deployment may need
- the OAuth client configuration shape
- the main environment variables
- the difference between local localhost callbacks and hosted Claude callbacks

## 1. Create The OAuth Project

In Google Cloud Console:

1. create or select a project
2. enable the APIs your deployment actually needs
3. configure the OAuth consent screen
4. create a **Web application** OAuth client

For the broadest ServalSheets feature surface, that may include:

- Google Sheets API
- Google Drive API
- BigQuery API
- Apps Script API

Do not enable scopes or APIs you do not intend to submit or operate.

## 2. Configure Redirect URIs By Deployment Type

### Local stdio / local auth helper

Typical localhost callbacks:

```text
http://localhost:3000/callback
http://127.0.0.1:3000/callback
```

### Hosted remote connector

Current Claude connector callbacks:

```text
https://claude.ai/api/mcp/auth_callback
https://claude.com/api/mcp/auth_callback
```

If you support both local and hosted flows, allow both categories explicitly.

## 3. Configure ServalSheets

Typical environment variables:

```bash
OAUTH_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
OAUTH_CLIENT_SECRET=YOUR_CLIENT_SECRET
OAUTH_REDIRECT_URI=https://claude.ai/api/mcp/auth_callback
ALLOWED_REDIRECT_URIS=https://claude.ai/api/mcp/auth_callback,https://claude.com/api/mcp/auth_callback,http://localhost:3000/callback
OAUTH_SCOPE_MODE=full
```

For local-only development, `OAUTH_REDIRECT_URI` may instead be a localhost
callback.

## 4. Scope Modes

ServalSheets supports multiple scope modes. `full` is the widest feature
surface.

Use `full` only when your deployment truly needs the broader capabilities such
as:

- collaboration features
- BigQuery integration
- Apps Script automation

If your deployment needs less, prefer a narrower scope mode and a narrower
OAuth consent surface.

## 5. Verification

After configuration:

```bash
npm run start:http
curl http://localhost:3000/health/ready
curl http://localhost:3000/.well-known/oauth-authorization-server
```

For hosted connectors, also verify the live connector flow inside Claude after
the hosted server is deployed.

## 6. Troubleshooting

### Redirect URI mismatch

- verify the exact callback URL in Google Cloud Console
- verify `OAUTH_REDIRECT_URI`
- verify `ALLOWED_REDIRECT_URIS`
- verify you are not mixing local and hosted flows accidentally

### Missing permissions

- confirm the enabled scopes actually match the tools you want to use
- if you changed scope mode, repeat the auth flow to obtain fresh tokens

### Hosted connector still not working

- verify the hosted well-known endpoints are reachable
- verify you used Claude's connector UI rather than local stdio config

## Related Docs

- [`CLAUDE_DESKTOP_OAUTH_SETUP.md`](./CLAUDE_DESKTOP_OAUTH_SETUP.md)
- [`OAUTH_USER_SETUP.md`](./OAUTH_USER_SETUP.md)
- [`SUBMISSION_CHECKLIST.md`](./SUBMISSION_CHECKLIST.md)
