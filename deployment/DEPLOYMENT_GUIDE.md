# ServalSheets Deployment Guide

ServalSheets is a production-grade MCP server for Google Sheets. This guide covers deploying to Google Cloud Run, AWS ECS Fargate, Railway, and self-hosted environments.

**Current Version:** 2.0.0
**Last Updated:** 2026-04-01
**Platform Support:** Google Cloud Run, AWS ECS Fargate, Railway.app, Kubernetes, Docker

## Table of Contents

1. [Quick Start](#quick-start)
2. [Platform-Specific Guides](#platform-specific-guides)
3. [Environment Configuration](#environment-configuration)
4. [Security Checklist](#security-checklist)
5. [Monitoring & Observability](#monitoring--observability)
6. [Troubleshooting](#troubleshooting)
7. [FAQ](#faq)

---

## Quick Start

### Prerequisites

- Node.js 18+ (for local testing)
- Docker installed
- Appropriate cloud provider account (GCP, AWS, or Railway)
- Google OAuth credentials
- Redis instance (production requirement)

### 30-Second Overview

```bash
# 1. Choose your platform
export PLATFORM="cloudrun"  # or: aws | railway | kubernetes

# 2. Generate secrets
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# 3. Deploy (platform-specific - see below)
./deployment/$PLATFORM/deploy.sh [platform-specific-args]
```

---

## Platform-Specific Guides

### Google Cloud Run

**Best for:** Serverless, fully managed, auto-scaling, minimal ops overhead.

**Specifications:**
- Compute: 2GB RAM, 2 vCPU, Fargate-equivalent
- Scaling: 1-10 instances, auto-scale on concurrency
- Timeout: 300 seconds
- Health checks: `/health/live` (startup), `/health/ready` (continuous)

**Deploy Steps:**

```bash
cd deployment/cloudrun

# 1. Set environment variables
export PROJECT_ID="my-gcp-project"
export REGION="us-central1"
export SERVICE_NAME="servalsheets"

# 2. Run deployment script
./deploy.sh $PROJECT_ID $REGION $SERVICE_NAME

# Script will:
# - Build Docker image
# - Push to Google Container Registry (GCR)
# - Create secrets in Secret Manager
# - Deploy to Cloud Run
# - Output service URL
```

**Configuration File:** `service.yaml`

**Key Environment Variables:**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (OAuth)
- `JWT_SECRET`, `ENCRYPTION_KEY` (Auth)
- `REDIS_URL` (Session storage - from Cloud Memorystore)

**Cost Estimate:**
- $0.00002 per request + compute (1GB-second)
- ~$5-30/month for typical usage

**Monitoring:**
- Cloud Logging: View logs in GCP Console
- Cloud Trace: Distributed tracing integration built-in
- Cloud Monitoring: Metrics dashboard available

**Scaling:**
- Automatic scaling based on request count
- Min 1 instance (cold starts ~3-5 seconds)
- Max 10 instances (configurable)

---

### AWS ECS Fargate

**Best for:** Enterprise, existing AWS infrastructure, multi-region, compliance requirements.

**Specifications:**
- Compute: 2GB RAM, 1 vCPU
- Networking: VPC, security groups, NLB/ALB
- Scaling: 1-10 tasks via Auto Scaling Group
- Logging: CloudWatch Logs with 30-day retention

**Deploy Steps:**

```bash
cd deployment/aws

# 1. Set environment variables
export AWS_ACCOUNT_ID="123456789012"
export AWS_REGION="us-east-1"
export ECS_CLUSTER="production"
export ECS_SERVICE="servalsheets"

# 2. Run deployment script
./deploy.sh $AWS_ACCOUNT_ID $AWS_REGION $ECS_CLUSTER $ECS_SERVICE

# Script will:
# - Build Docker image
# - Create ECR repository
# - Push image to ECR
# - Create secrets in Secrets Manager
# - Register ECS task definition
# - Update ECS service
# - Output service status
```

**Configuration File:** `ecs-task-definition.json`

**Key Environment Variables:**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (OAuth)
- `JWT_SECRET`, `ENCRYPTION_KEY` (Auth)
- `REDIS_URL` (ElastiCache Replication Group)
- `AWS_REGION` (for AWS SDK operations)

**AWS Resources Required:**
- ECR Repository (container registry)
- ECS Cluster (container orchestration)
- ECS Service (managed service definition)
- CloudWatch Log Group
- Secrets Manager (secret storage)
- IAM Roles & Policies

**Setup:**
```bash
# Create ECS cluster (one-time)
aws ecs create-cluster --cluster-name production --region us-east-1

# Create ECS service (after first task definition registration)
aws ecs create-service \
  --cluster production \
  --service-name servalsheets \
  --task-definition servalsheets:1 \
  --desired-count 1 \
  --launch-type FARGATE \
  --region us-east-1
```

**Cost Estimate:**
- ~$0.04 per hour per task + data transfer
- ~$30-100/month for typical usage

**Monitoring:**
- CloudWatch Logs: Real-time log streaming
- CloudWatch Metrics: CPU, memory, network
- X-Ray: Distributed tracing (optional)

---

### Railway.app

**Best for:** Simple deployment, automatic CI/CD, great DX, hobby to small production.

**Specifications:**
- Compute: Configurable (2GB+ recommended)
- Scaling: Manual or auto-scaling via Railway dashboard
- Deployment: Git-based push-to-deploy

**Deploy Steps:**

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Create new project (or link existing)
railway init

# 4. Set environment variables
railway variables set JWT_SECRET=$(openssl rand -hex 32)
railway variables set ENCRYPTION_KEY=$(openssl rand -hex 32)
railway variables set REDIS_URL="redis://..."
# ... set remaining variables

# 5. Deploy
railway up

# Alternatively: Push to Railway-linked git repo (automatic deploy)
git push origin main
```

**Configuration File:** `railway.toml`

**Key Features:**
- GitHub integration (auto-deploy on push)
- Environment variables via dashboard
- Database plugins (PostgreSQL, MongoDB, Redis)
- Built-in domain & SSL

**Cost Estimate:**
- Pay-as-you-go: ~$5-50/month depending on usage
- Starter plan available for experimentation

**Monitoring:**
- Built-in logs dashboard
- Metrics export to Prometheus
- Error tracking integration

---

### Kubernetes (Self-Hosted)

**Best for:** High-scale production, multi-region, full control.

**Requirements:**
- Kubernetes cluster 1.24+ (EKS, GKE, AKS, or self-hosted)
- Helm 3+ (recommended)
- Redis instance accessible to cluster
- Persistent storage (for backups)

**Deployment:**

Use the existing Helm chart in `deployment/helm/`:

```bash
# 1. Create namespace
kubectl create namespace servalsheets

# 2. Create secrets
kubectl create secret generic servalsheets-secrets \
  --from-literal=jwt-secret=$(openssl rand -hex 32) \
  --from-literal=encryption-key=$(openssl rand -hex 32) \
  --from-literal=google-client-id=... \
  --from-literal=google-client-secret=... \
  --namespace servalsheets

# 3. Install Helm chart
helm install servalsheets deployment/helm/servalsheets \
  --namespace servalsheets \
  --values deployment/helm/values-prod.yaml

# 4. Verify deployment
kubectl get pods -n servalsheets
kubectl get svc -n servalsheets
```

**Helm Chart Includes:**
- Deployment with resource limits
- Service for load balancing
- ConfigMap for settings
- HorizontalPodAutoscaler for scaling
- PodDisruptionBudget for high availability
- NetworkPolicy for security

**Cost Estimate:**
- Depends on cluster infrastructure
- ~2 vCPU, 2GB RAM minimum per instance

---

### Docker (Self-Hosted)

**Best for:** Development, single-instance deployments, Docker Compose.

**Run Locally:**

```bash
# Build image
docker build -t servalsheets:latest -f deployment/docker/Dockerfile .

# Run with environment variables
docker run \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  -e ENCRYPTION_KEY=$(openssl rand -hex 32) \
  -e GOOGLE_CLIENT_ID=... \
  -e GOOGLE_CLIENT_SECRET=... \
  -p 3000:3000 \
  servalsheets:latest

# Health check
curl http://localhost:3000/health/live
```

**Docker Compose (with Redis):**

```bash
# See: deployment/docker/docker-compose.yml
docker-compose up -d
```

---

## Environment Configuration

### Essential Production Variables

Every production deployment requires these variables:

| Variable | Description | Generation |
|----------|-------------|-----------|
| `NODE_ENV` | Must be `production` | - |
| `JWT_SECRET` | Signing key for tokens | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Token encryption | `openssl rand -hex 32` |
| `GOOGLE_CLIENT_ID` | OAuth client ID | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | Google Cloud Console |
| `REDIS_URL` | Session/cache storage | Platform-specific |
| `OAUTH_ISSUER` | Server base URL | Your domain |
| `OAUTH_REDIRECT_URI` | Callback URL | `https://domain/callback` |

### Optional but Recommended

| Variable | Impact | Default |
|----------|--------|---------|
| `LOG_LEVEL` | Verbosity (debug/info/warn/error) | info |
| `CORS_ORIGINS` | Allowed client domains | `https://claude.ai,https://claude.com` |
| `ENABLE_AGGRESSIVE_FIELD_MASKS` | Reduce API response size | true |
| `ENABLE_REQUEST_MERGING` | Merge overlapping API calls | true |
| `ENABLE_PARALLEL_EXECUTOR` | Concurrent operations | true |
| `ANTHROPIC_API_KEY` | AI analysis features | (optional) |
| `VOYAGE_API_KEY` | Semantic search | (optional) |

### Configuration by Platform

**Google Cloud Run:**
- Use Secret Manager for secrets
- Set via `--set-secrets` flag in `gcloud run deploy`
- Environment variables via `--set-env-vars`

**AWS ECS:**
- Use Secrets Manager for secrets
- Reference in task definition with `valueFrom`
- Environment variables in container definition

**Railway:**
- Set in Railway dashboard → Variables → Secrets
- Environment variables in Variables → Regular

**Kubernetes:**
- Store in `Secret` objects
- Mount as environment variables in deployment
- Use `sealed-secrets` or similar for GitOps

---

## Security Checklist

### Pre-Deployment

- [ ] All secrets generated with cryptographically secure random (not hardcoded)
- [ ] Secrets stored in platform secret manager (not in code or config files)
- [ ] HTTPS enforced (TLS 1.2+ minimum)
- [ ] CORS origins whitelisted (not `*`)
- [ ] Redis requires authentication in production
- [ ] Audit logging enabled
- [ ] IAM/RBAC configured (minimum permissions)
- [ ] Firewall rules restrict access to necessary ports only

### Post-Deployment

- [ ] Health checks passing (`/health/live` and `/health/ready`)
- [ ] No default credentials in use
- [ ] Secrets Manager access logging enabled
- [ ] CloudWatch/CloudLogging audit trails active
- [ ] SSL certificate valid (auto-renewed if applicable)
- [ ] Database backups configured
- [ ] Monitoring and alerting in place
- [ ] Incident response procedures documented

### Ongoing

- [ ] Secrets rotated regularly (recommend: every 90 days)
- [ ] Dependencies updated for security patches
- [ ] Access logs reviewed for anomalies
- [ ] Rate limiting tuned based on actual usage
- [ ] Backups tested for recovery
- [ ] Performance baseline established and monitored

---

## Monitoring & Observability

### Health Check Endpoints

```bash
# Liveness: Is the app running?
curl https://servalsheets.example.com/health/live

# Readiness: Is the app ready for requests?
curl https://servalsheets.example.com/health/ready

# Metrics: Prometheus-format metrics
curl https://servalsheets.example.com/metrics
```

### Key Metrics to Monitor

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| HTTP error rate | >5% | Check logs, scale up |
| Response time (p99) | >10s | Check Google API quota |
| Redis latency | >500ms | Check Redis connectivity |
| Memory usage | >85% | Increase heap size |
| CPU usage | >80% sustained | Scale horizontally |

### Logging

All platforms support structured logging in JSON format:

```json
{
  "timestamp": "2026-04-01T12:00:00Z",
  "level": "info",
  "message": "Request completed",
  "http.method": "POST",
  "http.path": "/tools/call",
  "http.status": 200,
  "duration_ms": 245,
  "user_id": "user123"
}
```

**Log Aggregation Tools:**
- Google Cloud Logging: `gcloud logging read --limit=50`
- AWS CloudWatch: `aws logs tail /ecs/servalsheets --follow`
- Railway: Dashboard → Logs
- Kubernetes: `kubectl logs -n servalsheets -f deployment/servalsheets`

---

## Troubleshooting

### Common Issues

#### "Health check failing"

```bash
# Check if service is responding
curl -v http://localhost:3000/health/live

# Check logs for startup errors
gcloud run logs read servalsheets --limit=50  # Cloud Run
aws logs tail /ecs/servalsheets --follow     # ECS
railway logs                                   # Railway

# Verify Redis connectivity
REDIS_URL="redis://host:6379"
redis-cli -u "$REDIS_URL" ping
```

#### "Secrets not found"

```bash
# Verify secret exists in platform secret manager
gcloud secrets list --filter="name:servalsheets"  # GCP
aws secretsmanager list-secrets                    # AWS

# Check permissions on service account/role
gcloud iam service-accounts get-iam-policy servalsheets-sa
aws iam get-role-policy --role-name servalsheets-task-role --policy-name SecretsManagerAccess
```

#### "High error rate after deployment"

```bash
# Check logs for errors
# Look for: "PERMISSION_DENIED", "RESOURCE_EXHAUSTED", "DEADLINE_EXCEEDED"

# Common causes:
# 1. Google API quota exceeded: Check Google Cloud Console → APIs & Services
# 2. Redis connection issue: Verify REDIS_URL and security groups
# 3. Missing environment variables: Verify all secrets configured

# Verify configuration
curl -s http://localhost:3000/health/ready | jq .
```

#### "Slow requests / timeouts"

```bash
# Check Google Sheets API quota usage
# GCP Console → APIs & Services → Quotas

# Check Redis latency
redis-cli -u "$REDIS_URL" --latency-histogram

# Increase timeout if needed
export REQUEST_TIMEOUT_MS=600000  # 10 minutes

# Check for request merging opportunities
grep "merged requests" /var/log/servalsheets.log
```

---

## FAQ

### Q: Do I need Redis for production?

**A:** Yes. Without Redis:
- Sessions are lost on restart
- No distributed session sharing
- Task state not persistent
- Cache operations fail

For development only, in-memory mode works.

### Q: What's the minimum resource allocation?

**A:**
- Memory: 2GB (1GB may work for low usage)
- CPU: 1 vCPU (2 vCPU recommended)
- Disk: 100MB+ for application + logs
- Network: 10+ Mbps

### Q: How many concurrent users can one instance handle?

**A:** Depends on workload:
- Light (read-heavy): 100-500 concurrent
- Medium (mixed): 50-200 concurrent
- Heavy (write-heavy): 20-100 concurrent

Monitor response times and scale horizontally if needed.

### Q: Can I use SQLite instead of Redis?

**A:** No. Redis is required for:
- Session distribution across instances
- Task state in distributed deployments
- Rate limiting
- Cache sharing

SQLite is not suitable for distributed systems.

### Q: How do I upgrade ServalSheets?

**A:**
1. Build new Docker image with updated code
2. Push to container registry
3. Update task definition / deployment
4. Gradual rollout (blue-green deployment recommended)
5. Verify health checks after each stage

### Q: How do I handle secrets rotation?

**A:**
1. Generate new secret value
2. Update in platform secret manager
3. Restart deployment (rolling restart)
4. Verify service still healthy
5. Remove old secret after confirmation

### Q: Can I run multiple instances?

**A:** Yes, recommended for production:

**Google Cloud Run:**
- Automatic with `--max-instances=10`
- Auto-scales based on request count

**AWS ECS:**
- Set `desired-count=3+` in service definition
- Add Auto Scaling Group for dynamic scaling

**Kubernetes:**
- Set `replicas=3+` in deployment
- Add HorizontalPodAutoscaler for dynamic scaling

---

## Additional Resources

- **Architecture Documentation:** `docs/development/ARCHITECTURE.md`
- **Source Code:** GitHub repository with deployment workflows
- **Support:** Check GitHub Issues or contact support
- **Updates:** Watch for version updates and security patches

---

**Last Updated:** 2026-04-01
**ServalSheets Version:** 2.0.0
**Deployment Guide Version:** 1.0
