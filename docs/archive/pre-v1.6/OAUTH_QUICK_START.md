# OAuth Quick Start - ServalSheets

**Zero-config OAuth** for 1-click install users. Advanced users can supply their own credentials.

---

## Quick Setup (Under 2 Minutes)

### Standard Install (1-Click / mcpb)

If you installed ServalSheets via the MCP marketplace or 1-click install:

```bash
# Just run auth — embedded credentials are used automatically
npm run auth
```

1. Your browser opens to Google's consent screen
2. Sign in with your Google account
3. Approve the requested permissions
4. Done — ServalSheets is ready to use

No GCP project creation, no client IDs, no secrets to copy.

### Manual / Advanced Install

If you want to use your own GCP project credentials:

```bash
# Option A: Place credentials.json in the project root
# (downloaded from Google Cloud Console > APIs & Services > Credentials)
npm run auth

# Option B: Set environment variables
cat > .env << 'EOF'
OAUTH_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
OAUTH_CLIENT_SECRET=YOUR_SECRET
OAUTH_REDIRECT_URI=http://localhost:3000/callback
HTTP_PORT=3000
OAUTH_SCOPE_MODE=full
EOF

npm run auth
```

**Required APIs** (enable in Google Cloud Console if using your own project):
- Google Sheets API
- Google Drive API
- BigQuery API (only if using `OAUTH_SCOPE_MODE=full`)
- Apps Script API (only if using `OAUTH_SCOPE_MODE=full`)

---

## Credential Resolution Order

ServalSheets resolves OAuth credentials in this order:

1. **Environment variables** — `OAUTH_CLIENT_ID` / `GOOGLE_CLIENT_ID` (for advanced users / service accounts)
2. **Embedded credentials** — published app credentials bundled with ServalSheets (for standard installs)
3. **credentials.json** — auto-discovered in common locations (project root, Downloads, Documents)

If you have environment variables set, they always take priority. This ensures backward compatibility.

---

## Scope Modes

Change via `OAUTH_SCOPE_MODE` in `.env` or bundle config:

| Mode | Default? | Scopes | Use Case |
|------|----------|--------|----------|
| `standard` | **Yes** | Sheets + Drive.file + Drive.appdata (3 scopes) | Most users — read/write spreadsheets, templates |
| `full` | No | All 8 scopes (incl. BigQuery, Apps Script, full Drive) | Power users who need sharing, BigQuery, Apps Script |
| `minimal` | No | Sheets + Drive.file (2 scopes) | Testing / minimal access |
| `readonly` | No | Sheets.readonly + Drive.readonly (2 scopes) | Read-only analysis |

### Standard vs Full Scopes

**Standard mode** (`drive.file`) means ServalSheets can only access spreadsheets it created or that you explicitly opened with it. This is the safest default.

**Full mode** (`drive`) gives access to all files in your Drive, which is needed for sharing, collaboration features, listing all spreadsheets, and BigQuery/Apps Script integration. Switch to full mode if you need these features:

```bash
# In .env
OAUTH_SCOPE_MODE=full

# Then re-authenticate
rm ~/.servalsheets/tokens.encrypted
npm run auth
```

---

## Start Server

```bash
npm run start:http
```

### Verify

```bash
curl http://localhost:3000/health
```

---

## Troubleshooting

### Re-authenticate After Scope Changes

```bash
rm ~/.servalsheets/tokens.encrypted
npm run auth
```

### Token Expired?

```bash
rm ~/.servalsheets/tokens.encrypted
npm run auth
```

### "OAuth credentials not configured"?

This means neither embedded credentials nor environment variables are set. Update to the latest ServalSheets version which includes embedded credentials, or set `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` manually.

### Missing Features (e.g., sharing, BigQuery)?

These require `OAUTH_SCOPE_MODE=full`. Set it in your `.env` and re-authenticate.

---

## Full Documentation

- **Standardized Setup**: `docs/guides/OAUTH_STANDARDIZED_SETUP.md`
- **Claude Desktop Setup**: `docs/guides/CLAUDE_DESKTOP_OAUTH_SETUP.md`
- **Migration Guide**: `OAUTH_MIGRATION_GUIDE.md`
- **Scope Reference**: `src/config/oauth-scopes.ts`

---

**Version**: 1.6.0
**Last Updated**: 2026-02-06
**Protocol**: MCP 2025-11-25
