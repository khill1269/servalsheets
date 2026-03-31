---
title: Deployment Guide
category: runbook
doc_class: active
last_updated: 2026-03-31
description: Deploying ServalSheets as a remote MCP server for the Anthropic Connectors Directory.
version: 2.0.0
audience: operator
---

# Deployment Guide

This guide covers deploying ServalSheets as a remote HTTP MCP server
suitable for the Anthropic Connectors Directory.

> **Server facts** — 25 tools, 408 actions, v2.0.0, MCP 2025-11-25

## Prerequisites

- Node.js 20 or 22
- A Google Cloud project with Sheets API, Drive API, and (optional) BigQuery API enabled
- An OAuth 2.0 client ID and secret from Google Cloud Console
- A Redis instance (required in production for token/session storage)
- A public HTTPS domain with a valid TLS certificate

## Environment Variables

### Required

| Variable               | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | OAuth 2.0 client ID from Google Cloud Console        |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret                              |
| `NODE_ENV`             | Set to `production`                                  |
| `REDIS_URL`            | Redis connection URL (e.g. `redis://localhost:6379`) |

> ⚠️ **Production requirement**: `REDIS_URL` must be set. The OAuth provider throws
> `ConfigError` if it is absent in production. In-memory session storage does not
> survive restarts or support multiple instances.

### Recommended

| Variable                | Description                                          | Default                                |
| ----------------------- | ---------------------------------------------------- | -------------------------------------- |
| `PORT`                  | HTTP server port                                     | `3000`                                 |
| `LOG_LEVEL`             | Logging verbosity (`debug`, `info`, `warn`, `error`) | `info`                                 |
| `CORS_ORIGINS`          | Comma-separated allowed origins                      | `https://claude.ai,https://claude.com` |
| `RATE_LIMIT_MAX`        | Max requests per minute per IP                       | `100`                                  |
| `ALLOWED_REDIRECT_URIS` | Comma-separated OAuth callback URLs                  | See below                              |
| `ENABLE_LEGACY_SSE`     | Enable legacy SSE transport                          | `false`                                |

### OAuth Callback URLs

Set `ALLOWED_REDIRECT_URIS` to include all Claude callback URLs:

```
ALLOWED_REDIRECT_URIS=https://claude.ai/api/mcp/auth_callback,https://claude.com/api/mcp/auth_callback,http://localhost:3000/callback,http://127.0.0.1:3000/callback
```

## Deploying to Fly.io (Recommended)

Fly.io supports persistent WebSocket/SSE connections and has first-class Docker support.

```bash
# Install flyctl
brew install flyctl

# Authenticate
fly auth login

# Launch from repo root (creates fly.toml)
fly launch --name servalsheets --region iad

# Set secrets
fly secrets set \
  GOOGLE_CLIENT_ID="your-client-id" \
  GOOGLE_CLIENT_SECRET="your-client-secret" \
  REDIS_URL="redis://default:password@your-redis-host:6379" \
  NODE_ENV="production" \
  CORS_ORIGINS="https://claude.ai,https://claude.com" \
  ALLOWED_REDIRECT_URIS="https://servalsheets.fly.dev/oauth/callback,https://claude.ai/api/mcp/auth_callback,https://claude.com/api/mcp/auth_callback"

# Deploy
fly deploy
```

Recommended `fly.toml` configuration:

```toml
[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false   # Keep alive for long-running MCP sessions
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

## Deploying to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and init
railway login
railway init

# Add Redis plugin from Railway dashboard, then deploy
railway up
```

Set all required environment variables in the Railway dashboard under
**Project → Variables**.

## Firewall and IP Allowlisting

If your deployment sits behind a firewall, allowlist traffic by **hostname validation**
rather than hardcoded IP ranges. Claude's egress IPs rotate periodically.

Recommended approach: trust any request that presents a valid Bearer token issued by
your OAuth server. The token-based authentication model makes IP allowlisting
unnecessary for most deployments.

If IP allowlisting is required by your network policy, consult:
<https://support.claude.com/en/articles/12922490-remote-mcp-server-submission-guide>
for the current guidance on Claude egress ranges.

## CORS Configuration

ServalSheets sets CORS headers based on the `CORS_ORIGINS` environment variable.
For Anthropic Connectors Directory submissions, the minimum required origins are:

```
https://claude.ai
https://claude.com
```

The `/.well-known/mcp.json` endpoint uses `Access-Control-Allow-Origin: *` to
allow unauthenticated discovery from any origin.

## Production Token Storage

In production, all OAuth session data (authorization codes, access tokens, refresh
tokens) is stored in Redis with TTL-based expiry:

| Key pattern              | TTL        | Contents                         |
| ------------------------ | ---------- | -------------------------------- |
| `authcode:{code}`        | 10 minutes | Authorization code exchange data |
| `refresh:{token}`        | 30 days    | Refresh token → user mapping     |
| `google_tokens:{userId}` | 30 days    | Encrypted Google OAuth tokens    |
| `dcr:{clientId}`         | 1 year     | Dynamic client registration data |
| `mcp_consent:{clientId}` | 1 year     | Client consent record            |

Google tokens are **never** stored in JWT payloads. They are stored server-side
in the Redis session store under `google_tokens:{userId}`.

## Health Checks

| Endpoint            | Purpose                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `GET /health/live`  | Liveness — returns 200 if process is alive                         |
| `GET /health/ready` | Readiness — returns 200 if Redis + auth are ready, 503 if degraded |
| `GET /info`         | Server metadata (version, tool count, protocol)                    |

Configure your load balancer to use `/health/ready` for traffic routing.

## Verifying the Deployment

```bash
# Server card (primary discovery)
curl -s https://YOUR_HOST/.well-known/mcp.json | jq '.server_name, .mcp_version, .endpoints'

# OAuth metadata
curl -s https://YOUR_HOST/.well-known/oauth-authorization-server | jq '.issuer'

# Health
curl -s https://YOUR_HOST/health/ready | jq '.'
```

Expected output from health check when fully operational:

```json
{
  "status": "ready",
  "redis": "connected",
  "auth": "configured",
  "version": "2.0.0"
}
```
