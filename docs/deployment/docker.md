---
title: Docker Deployment
category: general
last_updated: 2026-03-24
description: Deploy ServalSheets using Docker for quick setup and easy management.
version: 2.0.0
tags: [deployment, docker, kubernetes]
---

# Docker Deployment

Deploy ServalSheets using Docker for quick setup and easy management.

This guide is for the hosted HTTP deployment surface. For local Claude Desktop
stdio setup, use [`CLAUDE_DESKTOP_SETUP.md`](../guides/CLAUDE_DESKTOP_SETUP.md).

## Prerequisites

- Docker 20.10+
- Node 20+ compatible container image
- Google service account JSON file or hosted OAuth credentials

## Quick Start

```bash
# Pull or build image
docker build -f deployment/docker/Dockerfile -t servalsheets:latest .

# Run with service account
docker run -d \
  --name servalsheets \
  -p 3000:3000 \
  -v /path/to/service-account.json:/etc/google/service-account.json:ro \
  -e GOOGLE_APPLICATION_CREDENTIALS=/etc/google/service-account.json \
  -e NODE_ENV=production \
  servalsheets:latest
```

## Docker Compose

For production deployments with additional services:

```yaml
# docker-compose.yml
version: '3.8'

services:
  servalsheets:
    build:
      context: .
      dockerfile: deployment/docker/Dockerfile
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - HTTP_PORT=3000
      - LOG_LEVEL=info
      - GOOGLE_APPLICATION_CREDENTIALS=/etc/google/service-account.json
    volumes:
      - ./service-account.json:/etc/google/service-account.json:ro
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health/live']
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  # Optional: Redis for HA sessions
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

Start:

```bash
docker-compose up -d
```

## Environment Variables

| Variable                         | Required | Default | Description                   |
| -------------------------------- | -------- | ------- | ----------------------------- |
| `NODE_ENV`                       | Yes      | -       | `production` or `development` |
| `HTTP_PORT`                      | No       | `3000`  | HTTP server port              |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes      | -       | Path to service account       |
| `LOG_LEVEL`                      | No       | `info`  | Log verbosity                 |
| `RATE_LIMIT_MAX_REQUESTS`        | No       | `100`   | Max requests per window       |

For hosted OAuth-based connector deployments, also configure the callback and
allowlist settings described in
[`OAUTH_USER_SETUP.md`](../guides/OAUTH_USER_SETUP.md).

## Health Check

```bash
# Check container health
docker inspect servalsheets --format='{{.State.Health.Status}}'

# View health endpoint
curl http://localhost:3000/health/ready
```

## Logs

```bash
# Stream logs
docker logs -f servalsheets

# Last 100 lines
docker logs --tail 100 servalsheets
```

## Updating

```bash
# Pull latest
docker pull servalsheets:latest

# Restart with new image
docker-compose up -d --force-recreate
```

## Resource Limits

```yaml
services:
  servalsheets:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
```

## Next Steps

- [Kubernetes](./kubernetes) - Container orchestration
- [Monitoring](./monitoring) - Observability setup
- [Security](/SECURITY) - Security best practices
