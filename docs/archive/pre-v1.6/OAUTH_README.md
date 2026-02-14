# OAuth Configuration - Complete Reference

**All you need to know about ServalSheets OAuth**

---

## 📚 Documentation Index

| Document | Purpose | Audience |
|----------|---------|----------|
| **[OAUTH_QUICK_START.md](OAUTH_QUICK_START.md)** | 5-minute setup guide | All users |
| **[OAUTH_STARTUP_FLOW.md](OAUTH_STARTUP_FLOW.md)** | How OAuth loads at server start | Developers |
| **[OAUTH_FLOW_DIAGRAM.md](OAUTH_FLOW_DIAGRAM.md)** | Visual flow diagrams | Visual learners |
| **[OAUTH_COMPLIANCE_REPORT.md](OAUTH_COMPLIANCE_REPORT.md)** | MCP & Google compliance | Auditors |
| **[OAUTH_VERIFICATION_CHECKLIST.md](OAUTH_VERIFICATION_CHECKLIST.md)** | Security verification | Security teams |
| **[OAUTH_MIGRATION_GUIDE.md](OAUTH_MIGRATION_GUIDE.md)** | Upgrade from old config | Existing users |
| **[docs/guides/OAUTH_STANDARDIZED_SETUP.md](docs/guides/OAUTH_STANDARDIZED_SETUP.md)** | Complete setup guide | New users |

---

## ⚡ Quick Reference

### What Scopes Are Used?

**Default (Recommended)**: 8 comprehensive scopes
```
spreadsheets
drive
drive.appdata
bigquery
cloud-platform
script.projects
script.deployments
script.processes
```

### How to Change Scope Mode?

```bash
# In .env file
OAUTH_SCOPE_MODE=full     # 8 scopes (default, all features)
OAUTH_SCOPE_MODE=minimal  # 2 scopes (testing only)
OAUTH_SCOPE_MODE=readonly # 2 scopes (analysis only)
```

### Where Are Scopes Defined?

**Single source of truth**: `src/config/oauth-scopes.ts`

All OAuth flows use this file:
- CLI authentication (`npm run auth`)
- HTTP OAuth provider
- STDIO server startup
- MCP tool registration

### How to Re-authenticate?

```bash
# Delete old tokens
rm ~/.servalsheets/tokens.encrypted

# Re-authenticate with new scopes
npm run auth

# Grant ALL permissions when prompted
```

---

## 🎯 Common Questions

### Q: Why 8 scopes instead of 2?

**A**: To avoid repeated authentication prompts. With comprehensive scopes:
- ✅ User authenticates **once**
- ✅ All features work immediately
- ✅ No "insufficient permissions" errors
- ✅ Better user experience

### Q: Do I need BigQuery/Apps Script scopes?

**A**: Only if you use those features:
- `sheets_bigquery` tool → Requires BigQuery scopes
- `sheets_appsscript` tool → Requires Apps Script scopes
- Templates → Requires `drive.appdata` scope
- Sharing → Requires full `drive` scope

If you don't use these, you can use `OAUTH_SCOPE_MODE=minimal`.

### Q: Are my tokens secure?

**A**: Yes:
- ✅ Encrypted at rest (AES-256-GCM)
- ✅ Stored in `~/.servalsheets/` (user-only access)
- ✅ Key from environment variable
- ✅ HTTPS required in production
- ✅ Automatic token rotation

### Q: How do I verify my setup?

```bash
# Quick test
./test-auth.sh

# Or manual check
npm run start:http &
curl http://localhost:3000/health | jq .scopes
```

### Q: What if I see "insufficient permissions"?

Your tokens have old scopes. Re-authenticate:
```bash
rm ~/.servalsheets/tokens.encrypted
npm run auth
```

---

## 🔐 Security

### Production Checklist

- [x] HTTPS enabled
- [x] HSTS headers configured
- [x] Rate limiting enabled
- [x] PKCE enforced
- [x] State tokens signed
- [x] Redirect URI validated
- [x] Tokens encrypted at rest

### Compliance Status

- ✅ **MCP Protocol 2025-11-25**: COMPLIANT
- ✅ **OAuth 2.1**: COMPLIANT
- ✅ **Google OAuth Best Practices**: COMPLIANT

See: [OAUTH_COMPLIANCE_REPORT.md](OAUTH_COMPLIANCE_REPORT.md)

---

## 🚀 Getting Started

1. **Read**: [OAUTH_QUICK_START.md](OAUTH_QUICK_START.md) (5 minutes)
2. **Setup**: Run `npm run auth` (2 minutes)
3. **Verify**: Run `./test-auth.sh` (30 seconds)
4. **Use**: Start server with `npm run start:http`

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| "Invalid client" | Check `OAUTH_CLIENT_ID` in `.env` |
| "Redirect URI mismatch" | Add `http://localhost:3000/callback` in Google Cloud Console |
| "Missing scope" | Re-authenticate: `rm ~/.servalsheets/tokens.encrypted && npm run auth` |
| "Token expired" | Re-authenticate (same as above) |
| Features don't work | Verify 8 scopes: `curl http://localhost:3000/health \| jq .scopes` |

---

## 📞 Support

- **Issues**: https://github.com/anthropics/claude-code/issues
- **Documentation**: `docs/guides/`
- **Examples**: `docs/examples/oauth.md`

---

**Version**: 1.6.0
**Last Updated**: 2026-02-03
**Status**: ✅ Production Ready
