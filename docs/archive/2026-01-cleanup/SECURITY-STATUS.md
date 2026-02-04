---
title: Security Status
category: archived
last_updated: 2026-01-31
description: "Last Updated: 2026-01-16"
tags: [security]
---

# Security Status

**Last Updated:** 2026-01-16

## Known Security Issues

### 1. Hono JWT Vulnerability (Transitive Dependency)

**Status:** ⚠️ **MONITORING** - Awaiting upstream fix

**Package:** `hono@4.11.3` (transitive dependency via @modelcontextprotocol/sdk)

**Severity:** HIGH

**CVEs:**

- GHSA-3vhc-576x-3qv4: JWT algorithm confusion when JWK lacks "alg"
- GHSA-f67f-6cw9-8mq4: JWT Algorithm Confusion via Unsafe Default (HS256)

**Dependency Chain:**

```
servalsheets
  └── @modelcontextprotocol/sdk@1.25.2
      └── @hono/node-server@1.19.8
          └── hono@4.11.3 (vulnerable)
```

**Impact Assessment for ServalSheets:** ✅ **LOW RISK**

**Why Low Risk:**

1. **Primary Transport:** ServalSheets uses STDIO transport for Claude Desktop
2. **HTTP Usage:** hono is only used by MCP SDK for HTTP/SSE transport (optional)
3. **JWT Not Used:** ServalSheets OAuth implementation doesn't use hono's JWT middleware
4. **Scope:** Vulnerability is in hono's JWT auth middleware, which we don't use

**Mitigation:**

- Default configuration uses STDIO (unaffected)
- HTTP server mode uses Express, not hono
- If using MCP SDK HTTP features: use OAuth with Google, not JWT

**Resolution Timeline:**

- **Expected Fix:** hono@4.11.4 (not yet released)
- **Workaround:** Already implemented - use STDIO or Express-based HTTP server
- **Tracking:** Will update to @modelcontextprotocol/sdk with fixed hono version when available

**Action Items:**

- [ ] Monitor hono releases for 4.11.4+
- [ ] Update @modelcontextprotocol/sdk when new version with fixed hono is released
- [ ] Re-run `npm audit` monthly

---

## Package Override (Ready for Fix)

When hono@4.11.4 is released, automatically upgrade via package.json override:

```json
{
  "overrides": {
    "hono": ">=4.11.4"
  }
}
```

**Note:** This override is commented out in package.json until 4.11.4 is available.

---

## Security Scanning

```bash
# Run security audit
npm audit --audit-level=high

# Check for updates
npm outdated

# Update dependencies (safe patches)
npm update

# Review security advisories
npm audit
```

---

## Reporting Security Issues

If you discover a security vulnerability in ServalSheets, please:

1. **Do NOT** open a public issue
2. Email: [security contact email]
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

---

## Security Best Practices

### For Users

1. **Use OAuth Authentication** (recommended)
   - Tokens encrypted at rest
   - Automatic token refresh
   - No credentials in environment variables

2. **Service Account Security**
   - Store JSON key files with restricted permissions (600)
   - Rotate service account keys regularly (every 90 days)
   - Use separate service accounts for dev/prod

3. **Environment Variables**
   - Never commit .env files
   - Use secrets management in production
   - Rotate sensitive values regularly

4. **Claude Desktop Integration**
   - OAuth tokens stored in `~/.servalsheets/tokens.json` (600 permissions)
   - No credentials in config file
   - Automatic cleanup on uninstall

### For Developers

1. **Dependency Management**
   - Review security advisories monthly
   - Update dependencies regularly
   - Use `npm audit` in CI/CD

2. **Code Security**
   - No secrets in code
   - Input validation with Zod
   - Structured error messages (no stack traces to users)

3. **Logging**
   - Never log tokens or credentials
   - Sanitize user data before logging
   - Use structured logging (Winston)

---

## Security Contacts

- **Security Issues:** [TBD]
- **General Issues:** https://github.com/khill1269/servalsheets/issues
- **Security Policy:** See SECURITY.md

---

**Next Review:** 2026-02-16
