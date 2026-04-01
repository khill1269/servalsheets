---
title: Fly.io Deployment Runbook
category: runbook
doc_class: active
last_updated: 2026-04-01
description: Step-by-step deployment of ServalSheets to Fly.io as a remote MCP server.
version: 2.0.0
audience: operator
---

# Fly.io Deployment Runbook

Complete deployment of ServalSheets v2.0.0 as a remote MCP server on Fly.io.
Total time: approximately 30 minutes on first run.

## Prerequisites

```bash
# 1. Install flyctl (if not installed)
curl -L https://fly.io/install.sh | sh
export PATH="$HOME/.fly/bin:$PATH"

# 2. Add to ~/.zshrc permanently
echo 'export FLYCTL_INSTALL="$HOME/.fly"' >> ~/.zshrc
echo 'export PATH="$FLYCTL_INSTALL/bin:$PATH"' >> ~/.zshrc

# 3. Authenticate (opens browser)
flyctl auth login

# 4. Confirm auth
flyctl auth whoami

```

## Required secrets to have ready

Before deploying, gather these values:

| Secret                 | Where to find                                             |
| ---------------------- | --------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Google Cloud Console → APIs & Services → Credentials      |
| `GOOGLE_CLIENT_SECRET` | Same as above                                             |
| `REDIS_URL`            | Upstash, Render Redis, or fly.io Redis add-on (see below) |

## Step 1 — Provision Redis

```bash
# Option A: Fly.io built-in Redis (simplest)
flyctl redis create --name servalsheets-redis --region iad

# Get the connection URL
flyctl redis status servalsheets-redis
# Copy the "Private URL" — format: redis://default:password@host:port

```

## Step 2 — Launch the app

```bash
cd /Users/thomascahill/Documents/mcp-servers/servalsheets-v2

# Launch (reads fly.toml automatically)
flyctl launch --name servalsheets --region iad --no-deploy

```

When prompted:

- App name: `servalsheets` (or custom)
- Region: `iad` (Northern Virginia — low latency)
- Would you like to deploy? **No** (set secrets first)

## Step 3 — Set all secrets

```bash
flyctl secrets set \
  GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com" \
  GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET" \
  REDIS_URL="redis://default:PASSWORD@HOST:PORT" \
  NODE_ENV="production" \
  LOG_LEVEL="info" \
  ENABLE_LEGACY_SSE="false" \
  CORS_ORIGINS="https://claude.ai,https://claude.com" \
  ALLOWED_REDIRECT_URIS="https://servalsheets.fly.dev/oauth/callback,https://claude.ai/api/mcp/auth_callback,https://claude.com/api/mcp/auth_callback,http://localhost:3000/callback"

```

Verify secrets are set:

```bash
flyctl secrets list

```

## Step 4 — Update Google OAuth callback URLs

In Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 client:

Add to **Authorized redirect URIs**:

```

https://servalsheets.fly.dev/oauth/google-callback
https://claude.ai/api/mcp/auth_callback
https://claude.com/api/mcp/auth_callback

```

## Step 5 — Deploy

```bash
flyctl deploy

```

First deploy takes ~5 minutes (Docker build + push).
Subsequent deploys take ~2 minutes (layer cache).

## Step 6 — Verify deployment

```bash
# Check app status
flyctl status

# Check logs (should see resource registration messages)
flyctl logs | head -30

# Health check
curl -s https://servalsheets.fly.dev/health/ready | python3 -m json.tool

# Server card (primary discovery endpoint)
curl -s https://servalsheets.fly.dev/.well-known/mcp.json | python3 -m json.tool | head -20

# OAuth metadata
curl -s https://servalsheets.fly.dev/.well-known/oauth-authorization-server | python3 -m json.tool

```

Expected `/health/ready` response:

```json
{
  "status": "ready",
  "redis": "connected",
  "auth": "configured",
  "version": "2.0.0"
}
```

## Step 7 — Test Claude connector

1. Open Claude Desktop → Settings → Connectors → Add Connector
2. Enter: `https://servalsheets.fly.dev`
3. Click Connect — you should be redirected to Google OAuth
4. Authorize with your Google account
5. Return to Claude — run: `Check my ServalSheets connection status`

## Step 8 — Create reviewer test account

```bash
# Create 3 Google Sheets in the reviewer test account:
# 1. "ServalSheets Review — Basic Data"
# 2. "ServalSheets Review — Financial Model"
# 3. "ServalSheets Review — Collaboration"

# Update TEST_ACCOUNT_SETUP.md with the actual spreadsheet IDs:
# Replace the placeholder IDs (1ABC..., 1DEF..., 1GHI...) with real ones

```

## Step 9 — Tick remaining checklist items

```bash
# Edit docs/guides/SUBMISSION_CHECKLIST.md
# Mark these as done once verified:
# - The submitted surface is GA-quality
# - The exposed tool set fits Anthropic policy
# - Public HTTPS base URL is stable and reachable
# - Claude.ai/Desktop/Code connection flows tested
# - Reviewer test access can stay active
# - Reviewer test account prepared
# - Representative sample spreadsheets available
# - TLS certificate valid (Fly.io handles this automatically)

```

## Troubleshooting

**"Error: no access token available"**

```bash
flyctl auth login

```

**Deploy fails with OOM**
Edit `fly.toml` → increase `memory_mb` from 512 to 1024:

```toml
[[vm]]
  memory_mb = 1024

```

**Redis connection refused**

```bash
# Check Redis is provisioned in same region
flyctl redis status servalsheets-redis

# Test connectivity from app
flyctl ssh console
node -e "const r=require('redis').createClient({url:process.env.REDIS_URL}); r.connect().then(()=>console.log('ok')).catch(console.error)"

```

**OAuth "redirect_uri not in allowlist"**

- Add `https://YOURAPP.fly.dev/oauth/google-callback` to Google Cloud Console
- Redeploy: `flyctl deploy`

**Slow cold starts**
Set `min_machines_running = 1` in `fly.toml` to keep one instance warm:

```toml
[http_service]
  min_machines_running = 1
  auto_stop_machines = false

```
