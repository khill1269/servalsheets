---
title: ServalSheets Installation Guide
category: guide
last_updated: 2026-03-24
description: Complete installation guide for all deployment scenarios.
version: 2.0.0
tags: [sheets]
audience: user
difficulty: intermediate
---

# ServalSheets Installation Guide

Complete installation guide for all deployment scenarios.

## 📋 Quick Start (Choose Your Path)

### Path 1: OAuth Setup Script (Optional)

**Best for:** Quick OAuth setup, local development

```bash
cd /path/to/servalsheets
npm install
npm run build
./scripts/setup-oauth.sh
```

**What it does:**

- ✅ Runs OAuth authentication in your browser
- ✅ Writes local Claude Desktop stdio config for `dist/cli.js`
- ✅ Verifies tokens/config files

[Full Guide →](./CLAUDE_DESKTOP_SETUP.md)

---

### Path 2: Service Account Setup (Manual)

**Best for:** CI/CD, automation, scripted deployments

Follow the credentials quickstart and configure Claude Desktop manually:

- [QUICKSTART_CREDENTIALS.md](./QUICKSTART_CREDENTIALS.md)
- [CLAUDE_DESKTOP_SETUP.md](./CLAUDE_DESKTOP_SETUP.md)

---

### Path 3: Manual Configuration

**Best for:** Custom setups, advanced users, troubleshooting

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "servalsheets": {
      "command": "npx",
      "args": ["servalsheets"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json",
        "LOG_LEVEL": "info",
        "RATE_LIMIT_READS_PER_MINUTE": "300",
        "RATE_LIMIT_WRITES_PER_MINUTE": "60"
      }
    }
  }
}
```

[Full Guide →](./CLAUDE_DESKTOP_SETUP.md#manual-setup-5-minutes)

---

### Path 4: Hosted Streamable HTTP Server

**Best for:** Hosted deployments, remote connectors, multi-user access

```bash
# Hosted connector auth (Claude <-> your server)
export OAUTH_CLIENT_ID=your-client-id
export OAUTH_CLIENT_SECRET=your-client-secret

# Google Sheets auth used by ServalSheets itself
export GOOGLE_CLIENT_ID=your-google-client-id
export GOOGLE_CLIENT_SECRET=your-google-client-secret
export GOOGLE_REDIRECT_URI=https://your-domain.com/callback

# Production secrets (required)
export JWT_SECRET=$(openssl rand -hex 32)
export STATE_SECRET=$(openssl rand -hex 32)
export ALLOWED_REDIRECT_URIS=https://claude.ai/api/mcp/auth_callback,https://claude.com/api/mcp/auth_callback

# Start server
npm run start:http
```

[Deployment Guide →](./DEPLOYMENT.md)
[Remote OAuth Guide →](./OAUTH_USER_SETUP.md)

---

## 🎯 Installation Checklist

- [ ] **Prerequisites Met**
  - [ ] Node.js 20+ installed (`node --version`)
  - [ ] Claude Desktop installed (if using STDIO)
  - [ ] Google Cloud project with Sheets API enabled
  - [ ] Service account JSON OR OAuth credentials

- [ ] **Repository Setup**
  - [ ] Clone/download repository
  - [ ] Run `npm install`
  - [ ] Run `npm run build`
  - [ ] Verify build: `dist/cli.js` exists

- [ ] **Credentials Configured**
  - [ ] Service account JSON downloaded
  - [ ] Saved to standard location: `~/.config/google/`
  - [ ] OR OAuth access token obtained

- [ ] **Installation Method**
  - [ ] Chose installation path (1-4 above)
  - [ ] Followed setup steps
  - [ ] Verified local stdio config or hosted OAuth setup was created correctly

- [ ] **Google Sheets Sharing** (Service Account Only)
  - [ ] Found service account email in JSON
  - [ ] Shared target spreadsheets with service account
  - [ ] Granted appropriate permissions (Viewer/Editor)

- [ ] **Testing**
  - [ ] Restarted Claude Desktop (⌘+Q, reopen)
  - [ ] Saw 🔨 icon in Claude Desktop (custom ServalSheets icon may not appear yet)
  - [ ] Tested basic operation
  - [ ] Checked logs: `~/Library/Logs/Claude/mcp-server-servalsheets.log`

---

## 🆕 Current Automatic Features

These features are **always active** and require no configuration:

| Feature               | Benefit                         | Status       |
| --------------------- | ------------------------------- | ------------ |
| HTTP Compression      | 60-80% bandwidth reduction      | ✅ Automatic |
| Payload Monitoring    | 2MB warnings, 10MB limits       | ✅ Automatic |
| Batch Efficiency      | Real-time optimization analysis | ✅ Automatic |
| Dynamic Rate Limiting | Auto-throttles on 429 errors    | ✅ Automatic |

---

## ⚙️ Optional Configuration

Enable these features via environment variables:

### OpenTelemetry Tracing

```json
"env": {
  "OTEL_ENABLED": "true",
  "OTEL_LOG_SPANS": "true"
}
```

**Use When:**

- Debugging performance issues
- Identifying bottlenecks
- Understanding request flow

### Custom Rate Limits

```json
"env": {
  "RATE_LIMIT_READS_PER_MINUTE": "500",
  "RATE_LIMIT_WRITES_PER_MINUTE": "100"
}
```

**Use When:**

- You have increased Google Cloud quotas
- Testing under different load conditions
- Need stricter rate limiting

### Debug Logging

```json
"env": {
  "LOG_LEVEL": "debug"
}
```

**Use When:**

- Troubleshooting issues
- Understanding tool behavior
- Verifying configuration

---

## 📚 Documentation Index

| Document                                                       | Purpose                 | Audience        |
| -------------------------------------------------------------- | ----------------------- | --------------- |
| [README.md](../../README.md)                                   | Project overview        | Everyone        |
| [CLAUDE_DESKTOP_SETUP.md](./CLAUDE_DESKTOP_SETUP.md)           | Claude Desktop setup    | Desktop users   |
| [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md)               | This document           | Everyone        |
| [RELEASE_NOTES_v1.6.0.md](../releases/RELEASE_NOTES_v1.6.0.md) | v2.0.0 details          | Upgrading users |
| [CHANGELOG.md](../../CHANGELOG.md)                             | All versions            | Everyone        |
| [.env.example](../../.env.example)                             | Environment variables   | Deployers       |
| [DEPLOYMENT.md](./DEPLOYMENT.md)                               | Production deployment   | DevOps          |
| [SECURITY.md](../../SECURITY.md)                               | Security best practices | Security teams  |
| [PERFORMANCE.md](./PERFORMANCE.md)                             | Performance tuning      | Advanced users  |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)                     | Common issues           | Support         |

---

## 🔧 Installation Scripts

| Script           | Type        | Use Case               |
| ---------------- | ----------- | ---------------------- |
| `setup-oauth.sh` | Interactive | OAuth credential setup |

---

## 🚦 Verification Steps

After installation, verify everything works:

### 1. Check MCP Server Loaded

```bash
# Look for 🔨 icon in Claude Desktop bottom-right (custom ServalSheets icon may not appear yet)
```

### 2. Test Basic Operation

```
In Claude Desktop:
"List sheets in spreadsheet: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
```

### 3. Check Logs

```bash
tail -f ~/Library/Logs/Claude/mcp-server-servalsheets.log
```

**Look for:**

- ✅ `ServalSheets MCP Server initialized`
- ✅ `Background tasks started`
- ✅ `HTTP compression enabled automatically`
- ✅ `Connection health monitoring started`

### 4. Verify Features

```bash
# In logs, look for:
- "HTTP compression enabled" → Compression active
- "Payload monitoring" → Size tracking active
- "Batch efficiency analyzed" → Optimization active
- "Rate limiter throttled" → Dynamic limiting working (if 429 occurs)
```

---

## 🆘 Common Issues

### Issue: "Build failed"

```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### Issue: "Service account email not found"

```bash
# Extract email from JSON
jq -r '.client_email' /path/to/service-account.json
```

### Issue: "Config syntax error"

```bash
# Validate JSON
jq . ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

### Issue: "MCP server not loading"

```bash
# Test CLI manually
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
node /path/to/dist/cli.js
# Should start and wait for input (Ctrl+C to exit)
```

[More Troubleshooting →](./TROUBLESHOOTING.md)

---

## 📊 Monitoring & Statistics

After installation, access runtime statistics:

```typescript
import {
  getCacheStats,
  getDeduplicationStats,
  getBatchEfficiencyStats_,
  getTracingStats,
  getConnectionStats,
} from './src/startup/lifecycle.js';

// In production, these are logged at shutdown
```

**Statistics Available:**

- Cache hit rates and sizes
- Request deduplication rates
- Batch efficiency metrics
- OpenTelemetry span counts
- Connection health status

---

## 🎓 Learning Path

**New User:**

1. Start with [CLAUDE_DESKTOP_SETUP.md](./CLAUDE_DESKTOP_SETUP.md)
2. Use interactive installation script
3. Test basic operations
4. Read [PROMPTS_GUIDE.md](./PROMPTS_GUIDE.md)

**Deploying to Production:**

1. Read [SECURITY.md](./SECURITY.md)
2. Review [DEPLOYMENT.md](./DEPLOYMENT.md)
3. Configure [.env.example](./.env.example)
4. Set up monitoring per [MONITORING.md](./MONITORING.md)
5. Review [PERFORMANCE.md](./PERFORMANCE.md)

**Troubleshooting:**

1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Review logs: `~/Library/Logs/Claude/mcp-server-servalsheets.log`
3. Enable debug logging: `LOG_LEVEL=debug`
4. Enable tracing: `OTEL_ENABLED=true`

---

## 🔄 Upgrading

Review the changelog and release notes for any release-specific migration notes before upgrading.

### Quick Upgrade

```bash
cd /path/to/servalsheets
git pull
npm install
npm run build

# If using local build, restart Claude Desktop
# If using npx, it will auto-update on next use
```

### Optional: Update Environment Variables

```bash
# Add or tune optional settings as needed
export TRACING_ENABLED=true
export TRACING_SAMPLE_RATE=0.1
export OTEL_LOG_SPANS=true
export MCP_REMOTE_EXECUTOR_URL=https://example.com/mcp
export MCP_REMOTE_EXECUTOR_TOOLS=sheets_compute,sheets_analyze
```

[Full Migration Guide →](./RELEASE_NOTES_v1.6.0.md#migration-guide)

---

## 📞 Support

- **Issues**: https://github.com/khill1269/servalsheets/issues
- **Documentation**: See links above
- **Logs**: `~/Library/Logs/Claude/mcp-server-servalsheets.log`
- **Discussions**: GitHub Discussions (coming soon)

---

## ✅ Installation Complete Checklist

Before considering installation complete:

- [ ] Build succeeded with zero errors
- [ ] Configuration file created and valid JSON
- [ ] Credentials configured (service account OR OAuth)
- [ ] Claude Desktop restarted and shows 🔨 icon (custom ServalSheets icon may not appear yet)
- [ ] Test operation succeeded
- [ ] Logs show no errors
- [ ] Current automatic features confirmed in logs
- [ ] Service account email shared with target spreadsheets (if applicable)
- [ ] Documentation reviewed for your use case

**Congratulations!** ServalSheets is now installed and ready to use.

---

**Version:** 2.0.0
**Last Updated:** 2026-03-24
**Compatibility:** Node.js 20+, Claude Desktop, MCP Protocol 2025-11-25
