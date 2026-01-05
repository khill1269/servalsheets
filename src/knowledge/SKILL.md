# ServalSheets MCP Server - Google Sheets Integration

## 🔐 MANDATORY: Authentication Check (ALWAYS DO THIS FIRST)

**Before using ANY sheets_* tool (except sheets_auth), Claude MUST first call `sheets_auth` to verify authentication status.**

This is non-negotiable. Skipping this step will result in cryptic errors that waste time.

---

## Authentication Flow

### Step 1: ALWAYS START HERE - Check auth status

```json
{
  "tool": "sheets_auth",
  "request": { "action": "status" }
}
```

**Possible responses:**

| Response | Meaning | Next Step |
|----------|---------|-----------|
| `authenticated: true` | Ready to use all tools | Proceed with user's request |
| `authenticated: false, authType: "oauth"` | OAuth configured but no session | Call `sheets_auth` with `action: "login"` |
| `authenticated: false, authType: "unconfigured"` | OAuth not configured | Tell user to set environment variables |

### Step 2: If NOT authenticated, initiate login

```json
{
  "tool": "sheets_auth", 
  "request": { "action": "login" }
}
```

This returns:
- `authUrl`: A URL the user must visit to authenticate
- `instructions`: Step-by-step guide for the user

**Present the authUrl to the user as a clickable link and wait for them to provide the authorization code.**

### Step 3: Complete authentication with the code

```json
{
  "tool": "sheets_auth",
  "request": { 
    "action": "callback",
    "code": "<paste the code from user here>"
  }
}
```

### Step 4: Confirm success, then proceed

Only after receiving `authenticated: true` should you proceed with any other sheets_* tools.

---

## Decision Tree

```
User asks about Google Sheets
        │
        ▼
┌───────────────────────┐
│ Call sheets_auth      │
│ action: "status"      │
└───────────┬───────────┘
            │
      authenticated?
       /         \
     YES          NO
      │            │
      ▼            ▼
  Proceed     Check authType
  with           │
  request    ┌───┴────┐
             │        │
          "oauth"  "unconfigured"
             │        │
             ▼        ▼
        Call login  Tell user to
        action      configure OAuth
             │
             ▼
        Present authUrl
        to user
             │
             ▼
        Wait for code
             │
             ▼
        Call callback
        with code
             │
             ▼
        Confirm success,
        then proceed
```

---

## Example Interaction

**User**: "Analyze my spreadsheet at https://docs.google.com/spreadsheets/d/abc123..."

**Claude's Response Pattern**:

1. **First**, call `sheets_auth` with `action: "status"`

2. **If response shows** `authenticated: false`:
   - Call `sheets_auth` with `action: "login"`
   - Tell user: "I need to connect to your Google account first. Please click this link to authorize: [authUrl]"
   - "Once you've authorized, please paste the code you receive here."

3. **When user provides code**:
   - Call `sheets_auth` with `action: "callback"` and the code
   - Confirm success: "Great, I'm now connected to your Google account!"

4. **Now proceed** with the original request (analyzing the spreadsheet)

---

## ⚠️ CRITICAL RULES

1. **NEVER skip the auth check** - Even if you think you're authenticated from a previous conversation, always verify with `sheets_auth action: "status"`

2. **NEVER call other sheets_* tools before confirming authentication** - This will result in errors

3. **If any tool returns an auth-related error**, go back to step 1 (check status)

4. **Present OAuth URLs as clickable links** for better UX

5. **The auth state can expire** - If you get auth errors after previously being authenticated, re-check status

---

## Available Tools (Use only after authentication confirmed)

| Tool | Purpose | Key Actions |
|------|---------|-------------|
| `sheets_auth` | Authentication | status, login, callback, logout |
| `sheets_spreadsheet` | Spreadsheet ops | get, create, copy, update_properties |
| `sheets_sheet` | Sheet/tab ops | add, delete, duplicate, update, list |
| `sheets_values` | Cell values | read, write, append, clear, find, replace |
| `sheets_cells` | Cell operations | notes, validation, hyperlinks, merge |
| `sheets_format` | Formatting | colors, fonts, borders, alignment |
| `sheets_dimensions` | Rows/columns | insert, delete, move, resize, freeze |
| `sheets_rules` | Rules | conditional formatting, data validation |
| `sheets_charts` | Charts | create, update, delete, move, export |
| `sheets_pivot` | Pivot tables | create, update, refresh |
| `sheets_filter_sort` | Filter/sort | basic filter, filter views, slicers |
| `sheets_sharing` | Sharing | permissions, ownership, link sharing |
| `sheets_comments` | Comments | add, reply, resolve, delete |
| `sheets_versions` | Versions | revisions, snapshots, restore |
| `sheets_analysis` | Analysis | data_quality, statistics, formula_audit |
| `sheets_advanced` | Advanced | named ranges, protected ranges, metadata |

---

## Common Error Recovery

| Error | Cause | Solution |
|-------|-------|----------|
| "No access, refresh token..." | Not authenticated | Run auth flow from step 1 |
| "OAuth client credentials not configured" | Missing env vars | User needs to set OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET |
| "Invalid or expired authorization code" | Stale code | Get a new auth URL with `action: "login"` |
| "Token has been expired or revoked" | Session expired | Run auth flow from step 1 |

---

## Environment Setup (for users)

If authentication is not configured, users need to:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials (Desktop app type)
3. Set environment variables:
   ```bash
   export OAUTH_CLIENT_ID="your-client-id"
   export OAUTH_CLIENT_SECRET="your-client-secret"
   export ENCRYPTION_KEY="$(openssl rand -hex 32)"  # For secure token storage
   ```
4. Restart the MCP server

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│  SERVALSHEETS AUTHENTICATION QUICK REFERENCE                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. CHECK STATUS FIRST (always!)                            │
│     sheets_auth { action: "status" }                        │
│                                                             │
│  2. IF NOT AUTHENTICATED:                                   │
│     sheets_auth { action: "login" }                         │
│     → Present authUrl to user                               │
│     → Wait for authorization code                           │
│                                                             │
│  3. COMPLETE WITH CODE:                                     │
│     sheets_auth { action: "callback", code: "..." }         │
│                                                             │
│  4. CONFIRM SUCCESS, THEN USE OTHER TOOLS                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
