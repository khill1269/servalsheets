---
title: Submission Checklist
category: guide
last_updated: 2026-03-24
description: Current checklist for preparing ServalSheets for Anthropic remote MCP directory submission.
version: 2.0.0
tags: [mcp, submission, claude]
audience: developer
difficulty: intermediate
doc_class: active
---

# Submission Checklist

Use this checklist before any official Anthropic remote MCP submission.

For mutable repo facts such as tool count, action count, version, and protocol
version, use [`docs/generated/facts.json`](../generated/facts.json) as the
documentation source of truth.

## 1. Product And Policy Fit

- [ ] The submitted surface is GA-quality, not beta or unstable
- [ ] The exposed tool set fits Anthropic's current MCP directory policy
- [ ] Cross-service automation risks have been reviewed for connector and federation features
- [ ] Privacy policy, security policy, and support contact are public and accessible over HTTPS

## 2. Transport And Protocol

- [ ] Public HTTPS base URL is stable and reachable
- [ ] Streamable HTTP endpoint is available at `/mcp`
- [ ] `/.well-known/mcp.json` is served correctly
- [ ] `/.well-known/oauth-authorization-server` is served correctly when auth is enabled
- [ ] `/.well-known/oauth-protected-resource` is served correctly when auth is enabled
- [ ] MCP protocol version matches [`docs/generated/facts.json`](../generated/facts.json)
- [ ] Claude.ai, Claude Desktop, and Claude Code connection flows have all been tested

## 3. OAuth And Auth

- [ ] OAuth authorization code flow is working end to end
- [ ] PKCE is enforced
- [ ] Allowed redirect URIs include the current Claude callback URLs
- [ ] Localhost redirect URIs used for Claude Code / MCP Inspector testing are allowlisted separately
- [ ] Production token storage and session configuration are documented
- [ ] Reviewer test access can stay active after initial review

## 4. Tool Quality

- [ ] All submitted tools have accurate descriptions
- [ ] All submitted tools include correct `readOnlyHint`
- [ ] All submitted tools include correct `destructiveHint`
- [ ] All submitted tools include `title` where applicable
- [ ] Tool names are no longer than 64 characters
- [ ] Tool results are token-efficient and do not return unnecessary payloads

## 5. Reviewer Experience

- [ ] At least 3 working examples are documented
- [ ] A reviewer test account is prepared if authentication is required
- [ ] Representative sample spreadsheets are available in the reviewer environment
- [ ] Reviewer instructions are captured in [`TEST_ACCOUNT_SETUP.md`](./TEST_ACCOUNT_SETUP.md)
- [ ] Remote OAuth setup is captured in [`OAUTH_USER_SETUP.md`](./OAUTH_USER_SETUP.md)

## 6. Infrastructure And Security

- [ ] TLS certificate is valid and trusted
- [ ] Firewall / reverse proxy rules are documented without hardcoded stale Claude IP ranges
- [ ] CORS allows the required Claude origins
- [ ] Rate limiting is enabled
- [ ] Health and readiness endpoints are working
- [ ] Logs and metrics are available for reviewer troubleshooting

## 7. Metadata Consistency

- [ ] `package.json`, `server.json`, and `manifest.json` agree on version and product description
- [ ] Active docs use [`docs/generated/facts.json`](../generated/facts.json) or generated sections for mutable counts
- [ ] `npm run check:doc-action-counts` passes
- [ ] `npm run validate:doc-tables` passes

## 8. Required Validation

Run these before submission:

```bash
npm run typecheck
npm run build
npm run check:drift
npm run check:doc-action-counts
npm run validate:doc-tables
npm run test:compliance
```

If transport failover is part of the submitted surface, also run:

```bash
npm run test:mcp-http-task-contract
```

## 9. Manual Smoke Checks

```bash
curl -s https://YOUR_HOST/.well-known/mcp.json | jq '.'
curl -s https://YOUR_HOST/health/ready | jq '.'
curl -s https://YOUR_HOST/info | jq '.'
```

For authenticated submissions, also verify the live OAuth and connector flow in
Claude itself rather than only with local curl tests.
