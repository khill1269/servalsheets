---
title: Firewall Configuration Guide
category: guide
last_updated: 2026-03-24
description: Configure firewall and reverse proxy rules for the hosted ServalSheets remote MCP endpoint.
version: 2.0.0
tags: [deployment, security, networking]
audience: user
difficulty: intermediate
doc_class: active
---

# Firewall Configuration Guide

Use this guide when deploying the **hosted HTTP** ServalSheets endpoint behind a
firewall or reverse proxy for Claude remote connector access.

## Core Rule

Do not hardcode Claude IP ranges in this doc or in long-lived internal copies.

Use Anthropic's current published IP list as the authority each time you update
firewall rules:

- `https://docs.claude.com/en/api/ip-addresses`

If your deployment is not restricted by source IP, you may not need Claude IP
allowlisting at all. If it is restricted, use the currently published ranges at
deployment time.

## Minimum Network Requirements

- expose the hosted HTTPS endpoint used for `/mcp`
- allow TLS traffic on port `443`
- optionally redirect port `80` to HTTPS
- preserve required Claude CORS origins

## Reverse Proxy And Firewall Pattern

The recommended pattern is:

1. Terminate TLS at a reverse proxy or load balancer.
2. Allow inbound HTTPS from the currently published Claude IP ranges if your environment requires allowlisting.
3. Forward traffic to the ServalSheets HTTP server.
4. Preserve host and protocol headers.
5. Keep health endpoints reachable for your own load balancer and ops checks.

## Example Configuration Pattern

Use placeholders, not stale copied CIDRs.

### AWS Security Group

```bash
aws ec2 authorize-security-group-ingress \
  --group-name servalsheets-claude \
  --protocol tcp \
  --port 443 \
  --cidr <CLAUDE_IPV4_CIDR>
```

### Google Cloud Firewall

```bash
gcloud compute firewall-rules create allow-claude-mcp \
  --direction=INGRESS \
  --priority=1000 \
  --network=default \
  --action=ALLOW \
  --rules=tcp:443 \
  --source-ranges="<CLAUDE_IPV4_CIDR_1>,<CLAUDE_IPV4_CIDR_2>" \
  --target-tags=servalsheets
```

### Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name servalsheets.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## CORS

Make sure the hosted server allows the required Claude browser origins.

Typical configuration:

```bash
CORS_ORIGINS="https://claude.ai,https://claude.com"
```

If you add more origins, document why.

## Health And Readiness

Use health endpoints for your own infrastructure checks:

- `/health`
- `/health/ready`
- `/health/live`

Do not embed stale sample version numbers in this doc. The live expected values
should come from the running build and current metadata.

## Monitoring

Recommended signals:

- inbound request success and failure rates
- TLS handshake errors
- latency for `/mcp`
- auth failures
- rate-limit responses
- certificate expiration

Also monitor for changes in Anthropic-published IP ranges if you depend on
firewall allowlisting.

## Troubleshooting

### Connection refused

- verify the hosted server is listening
- verify the reverse proxy forwards to the correct internal port
- verify your firewall rule set includes the current Claude ranges if allowlisting is enabled

### TLS errors

- verify certificate validity and full chain
- verify TLS 1.2+ support
- verify the public hostname matches the certificate

### CORS errors

- verify `CORS_ORIGINS`
- verify the reverse proxy is not stripping CORS headers
- verify the connector is using the correct public origin

## Related Docs

- [`SUBMISSION_CHECKLIST.md`](./SUBMISSION_CHECKLIST.md)
- [`OAUTH_USER_SETUP.md`](./OAUTH_USER_SETUP.md)
