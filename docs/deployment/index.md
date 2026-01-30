# Deployment Overview

ServalSheets supports multiple deployment options from development to enterprise production.

## Deployment Options

| Method                     | Best For                 | Complexity | Scalability |
| -------------------------- | ------------------------ | ---------- | ----------- |
| [Docker](./docker)         | Single server, dev/test  | ⭐         | ⭐⭐        |
| [Kubernetes](./kubernetes) | Production, multi-tenant | ⭐⭐⭐     | ⭐⭐⭐⭐⭐  |
| [Helm](./helm)             | K8s with GitOps          | ⭐⭐⭐     | ⭐⭐⭐⭐⭐  |
| [AWS](./aws)               | AWS-native production    | ⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐  |
| [GCP](./gcp)               | GCP-native production    | ⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐  |
| [PM2](./pm2)               | Node.js process manager  | ⭐⭐       | ⭐⭐⭐      |

## Quick Start

### Docker (Fastest)

```bash
docker run -d \
  -p 3000:3000 \
  -v /path/to/service-account.json:/etc/google/service-account.json:ro \
  -e GOOGLE_APPLICATION_CREDENTIALS=/etc/google/service-account.json \
  servalsheets:latest
```

### Claude Desktop (Local)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "servalsheets": {
      "command": "npx",
      "args": ["servalsheets"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json"
      }
    }
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer                            │
│                    (ALB / Cloud LB / Ingress)                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ServalSheets Instances                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Instance 1  │  │  Instance 2  │  │  Instance N  │  ...     │
│  │   (HTTP)     │  │   (HTTP)     │  │   (HTTP)     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│    Google Sheets API    │     │    Redis (Optional)     │
│                         │     │    Session Storage      │
└─────────────────────────┘     └─────────────────────────┘
```

## Environment Variables

| Variable                         | Required | Description                      |
| -------------------------------- | -------- | -------------------------------- |
| `NODE_ENV`                       | ✅       | `production` or `development`    |
| `HTTP_PORT`                      | ✅       | HTTP server port (default: 3000) |
| `GOOGLE_APPLICATION_CREDENTIALS` | ✅\*     | Path to service account JSON     |
| `OAUTH_CLIENT_ID`                | OAuth    | Google OAuth client ID           |
| `OAUTH_CLIENT_SECRET`            | OAuth    | Google OAuth client secret       |
| `SESSION_SECRET`                 | OAuth    | Session encryption secret        |
| `LOG_LEVEL`                      |          | `debug`, `info`, `warn`, `error` |
| `REDIS_URL`                      |          | Redis URL for HA sessions + Streamable HTTP resumability |

## Health Checks

| Endpoint       | Purpose    | Expected        |
| -------------- | ---------- | --------------- |
| `GET /health`  | Liveness   | `200 OK`        |
| `GET /ready`   | Readiness  | `200 OK`        |
| `GET /metrics` | Prometheus | Metrics payload |

## Security Checklist

- [ ] Use service account with minimal permissions
- [ ] Enable OAuth 2.1 for user authentication
- [ ] Configure HTTPS/TLS termination
- [ ] Set up secret management
- [ ] Enable network policies / security groups
- [ ] Configure rate limiting
- [ ] Set up audit logging

## Next Steps

- [Docker](./docker) - Container deployment
- [Kubernetes](./kubernetes) - K8s manifests
- [AWS](./aws) - Terraform for ECS Fargate
- [Monitoring](./monitoring) - Observability setup
