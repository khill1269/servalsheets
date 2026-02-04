# OAuth Quick Start - ServalSheets

**ONE standardized OAuth flow** with full scopes for ALL features.

---

## 🚀 Quick Setup (5 Minutes)

### 1. Get Google OAuth Credentials

1. Go to: https://console.cloud.google.com/apis/credentials
2. Create OAuth Client ID (Web application)
3. Add redirect URI: `http://localhost:3000/callback`
4. Download as `credentials.json` (save in project root)

**Required APIs** (enable in Google Cloud Console):
- ✅ Google Sheets API
- ✅ Google Drive API
- ✅ BigQuery API
- ✅ Apps Script API

### 2. Authenticate

```bash
# Automated setup (finds credentials.json automatically)
npm run auth

# Or manual .env setup
cat > .env << 'EOF'
OAUTH_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
OAUTH_CLIENT_SECRET=YOUR_SECRET
OAUTH_REDIRECT_URI=http://localhost:3000/callback
HTTP_PORT=3000
OAUTH_SCOPE_MODE=full
EOF

npm run auth
```

### 3. Start Server

```bash
npm run start:http
```

### 4. Verify

```bash
curl http://localhost:3000/health
```

Should show 8 scopes:
- ✅ `spreadsheets`
- ✅ `drive`
- ✅ `drive.appdata`
- ✅ `bigquery`
- ✅ `cloud-platform`
- ✅ `script.projects`
- ✅ `script.deployments`
- ✅ `script.processes`

---

## 🔧 What You Get

### Full Access Mode (Default)

**All Features Enabled:**
- ✅ Read/write spreadsheets
- ✅ Create and manage files
- ✅ Share and collaborate
- ✅ Use templates
- ✅ BigQuery integration
- ✅ Apps Script automation
- ✅ Comments and version history

**One-Time Consent:**
- You grant ALL permissions once
- No repeated "grant additional access" prompts
- All tools work immediately

---

## 🔐 Scope Modes

Change via `OAUTH_SCOPE_MODE` in `.env`:

| Mode | Use Case | Scopes |
|------|----------|--------|
| `full` (default) | Normal use | All 8 scopes |
| `minimal` | Testing | Sheets + Drive (file only) |
| `readonly` | Analysis | Read-only access |

---

## 🐛 Troubleshooting

### Re-authenticate After Scope Changes

```bash
rm ~/.servalsheets/tokens.encrypted
npm run auth
```

### Missing Features?

Check Google Cloud Console:
1. All 4 APIs enabled?
2. OAuth client has correct redirect URI?
3. All scopes added to OAuth consent screen?

### Token Expired?

```bash
# Delete old tokens
rm ~/.servalsheets/tokens.encrypted

# Re-authenticate
npm run auth
```

---

## 📚 Full Documentation

- **Complete Setup**: `docs/guides/OAUTH_STANDARDIZED_SETUP.md`
- **Migration Guide**: `OAUTH_MIGRATION_GUIDE.md`
- **Scope Reference**: `src/config/oauth-scopes.ts`

---

**Version**: 1.6.0
**Last Updated**: 2026-02-03
**Protocol**: MCP 2025-11-25
