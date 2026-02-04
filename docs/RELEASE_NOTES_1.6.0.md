---
title: ServalSheets v1.6.0 - Skill Package and MCP Server Cards
category: general
last_updated: 2026-01-31
description: Successfully packaged the skill and implemented MCP Server Cards (SEP-1649).
version: 1.6.0
tags: [sheets]
---

# ServalSheets v1.6.0 - Skill Package and MCP Server Cards

## Summary

Successfully packaged the skill and implemented MCP Server Cards (SEP-1649).

## Changes Made

### 1. MCP Server Cards (SEP-1649)

**New endpoint:** `/.well-known/mcp.json`

This is the primary discovery mechanism for HTTP-based MCP servers per SEP-1649. The server card enables:

- Autoconfiguration without manual endpoint setup
- Registry/crawler discovery of MCP servers
- Static capability verification before connection
- Reduced latency for server information display

**Implementation:**

- Added `McpServerCard` interface in `src/server/well-known.ts`
- Added `getMcpServerCard()` function to generate the card
- Added `mcpServerCardHandler` Express handler
- Registered at `/.well-known/mcp.json` in `registerWellKnownHandlers()`
- Added test suite in `tests/mcp-server-card.test.ts` (9 tests, all passing)

### 2. Skill Package Updated

**Version:** 1.6.0
**Tools:** 21
**Actions:** 291

**Package contents:**

- `SKILL.md` - Main skill file with UASEV+R protocol
- `references/tool-guide.md` - Complete 21 tools, 293 actions reference

### 3. Version Updates

- `package.json`: 1.4.0 → 1.6.0
- `src/version.ts`: 1.4.0 → 1.6.0
- Description updated to "21 tools, 293 actions"

## Files Modified

1. `/src/server/well-known.ts` - Added MCP Server Card implementation
2. `/src/version.ts` - Version bump to 1.6.0
3. `/package.json` - Version and description updates
4. `/skill/SKILL.md` - Action count correction
5. `/skill/references/tool-guide.md` - Action count correction

## Files Created

1. `/tests/mcp-server-card.test.ts` - Test suite for server cards
2. `/dist/google-sheets-expert.skill` - Packaged skill file

## MCP Server Card Response

```json
{
  "$schema": "https://modelcontextprotocol.io/schemas/mcp-server-card.json",
  "mcp_version": "2025-11-25",
  "server_name": "servalsheets",
  "server_version": "1.6.0",
  "description": "Enterprise-grade Google Sheets MCP server with 21 tools and 291 specialized actions...",
  "endpoints": {
    "streamable_http": "https://example.com/mcp",
    "sse": "https://example.com/sse",
    "stdio": true
  },
  "capabilities": {
    "tools": { "count": 21, "actions": 291 },
    "resources": { "templates": true, "subscriptions": false },
    "prompts": { "count": 17 },
    "sampling": true,
    "tasks": true,
    "elicitation": { "form": true, "url": true },
    "completions": true,
    "logging": true
  },
  "authentication": {
    "required": true,
    "methods": ["oauth2"],
    "oauth2": {
      "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
      "token_endpoint": "https://oauth2.googleapis.com/token",
      "pkce_required": true
    }
  },
  "security": {
    "tls_required": true,
    "min_tls_version": "1.2"
  },
  "keywords": ["google-sheets", "spreadsheet", "mcp", "ai", "automation", ...],
  "license": "MIT"
}
```

## Well-Known Endpoints

| Endpoint                                  | Purpose                   | Spec     |
| ----------------------------------------- | ------------------------- | -------- |
| `/.well-known/mcp.json`                   | MCP Server Card (primary) | SEP-1649 |
| `/.well-known/mcp-configuration`          | Legacy MCP config         | Custom   |
| `/.well-known/oauth-authorization-server` | OAuth AS metadata         | RFC 8414 |
| `/.well-known/oauth-protected-resource`   | OAuth resource metadata   | RFC 9728 |

## Next Steps

1. Deploy server and test `/.well-known/mcp.json` endpoint
2. Upload skill package to Claude Desktop skill directory
3. Register with MCP registry (when available)
