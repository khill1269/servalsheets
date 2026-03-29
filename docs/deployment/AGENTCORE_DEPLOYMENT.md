# ServalSheets AWS AgentCore Runtime Deployment

Complete CI/CD deployment pipeline for ServalSheets MCP server to AWS ECS Fargate.

## Overview

Two complementary deployment systems:

1. **GitHub Actions Workflow** (`deploy-agentcore.yml`) — Automated CI/CD pipeline
2. **Manual Deployment Script** (`deploy-ecs.sh`) — For ad-hoc deployments and troubleshooting

## Architecture

```
GitHub Event → Workflow Trigger
  ↓
Verify (typecheck + test + drift)
  ↓
Build & Push (ECR, ARM64, Docker Buildx)
  ↓
Deploy Staging (ECS update, stabilize, smoke tests)
  ↓
[Success] → Deploy Production (approval gate, same pattern)
[Failure] → Rollback + Slack notification
```

### AWS Infrastructure

| Component | Environment | Value |
|-----------|-------------|-------|
| AWS Account | All | 050752643237 |
| AWS Region | All | us-east-1 |
| ECR Repository | All | 050752643237.dkr.ecr.us-east-1.amazonaws.com/servalsheets/mcp-server |
| ECS Cluster (Staging) | staging | servalsheets-staging |
| ECS Cluster (Production) | prod | servalsheets-prod |
| ECS Service (Staging) | staging | servalsheets-staging-service |
| ECS Service (Production) | prod | servalsheets-prod-service |
| Task Definition | All | Updated on each deployment |
| IAM Role (GitHub) | All | arn:aws:iam::050752643237:role/github-actions-servalsheets |

## Workflow: deploy-agentcore.yml

### Triggers

#### 1. Push to `main` branch
Automatically deploys to **staging** environment.

```bash
git push origin main
# → Triggers deploy-agentcore.yml
# → Staging deployment only (no production)
```

#### 2. Push version tags (`v*.*.*`)
Automatically deploys to **staging**, then **production** after staging succeeds.

```bash
git tag v1.2.3
git push origin v1.2.3
# → Triggers deploy-agentcore.yml
# → Staging deployment first
# → Production deployment after staging smoke tests pass
```

#### 3. Manual trigger via `workflow_dispatch`
Allows selecting target environment and custom image tag.

**GitHub UI:**
1. Go to Actions → "Deploy to AWS AgentCore Runtime"
2. Click "Run workflow"
3. Select environment (dev/staging/prod)
4. Enter image tag (e.g., sha-abc123, v1.2.3, latest)
5. Click "Run workflow"

**GitHub CLI:**
```bash
gh workflow run deploy-agentcore.yml \
  -f environment=staging \
  -f image_tag=sha-$(git rev-parse --short HEAD)

gh workflow run deploy-agentcore.yml \
  -f environment=prod \
  -f image_tag=v1.2.3
```

### Job Pipeline

#### Job 1: `verify` (5 min timeout)
Pre-deployment checks before building image.

**Steps:**
- Checkout code
- Setup Node 20
- Install dependencies (npm ci)
- TypeScript type checking (`npm run typecheck`)
- Run unit + integration tests (`npm run test:fast`)
- Check metadata drift (`npm run check:drift`)

**Caching:**
- npm cache: Saves 1-2 minutes per run
- Node modules: Shared across jobs

**Fails if:**
- TypeScript errors found
- Tests fail
- Metadata drift detected

#### Job 2: `build-and-push` (15 min timeout)
Build ARM64 Docker image and push to ECR.

**Prerequisites:**
- Must pass: `verify` job

**Environment:**
- Runs: ubuntu-latest
- Docker Buildx: Enabled for ARM64 cross-compilation
- QEMU: For ARM64 architecture support

**Image Tagging Strategy:**
- Manual dispatch: Use specified tag (e.g., `v1.2.3`, `sha-abc123`)
- Version tag push (v*.*.*): Use semantic version (e.g., `1.2.3`)
- Main branch push: Use short SHA (e.g., `sha-abc123def456`)

**Steps:**
1. Configure AWS credentials (OIDC)
2. Login to ECR
3. Set up Docker Buildx with QEMU
4. Determine image tag based on trigger type
5. Build with `Dockerfile.agentcore` (ARM64 only)
6. Push to ECR with:
   - Specific tag (sha-abc123, v1.2.3, etc.)
   - `latest` tag (main branch only)
7. Output image URI for downstream jobs

**Outputs:**
- `image-uri` — Full image URI (e.g., 050752643237.dkr.ecr.us-east-1.amazonaws.com/servalsheets/mcp-server:v1.2.3)
- `image-tag` — Just the tag portion (e.g., v1.2.3)

**Docker Build:**
- Platform: linux/arm64 only
- Cache: GitHub Actions cache (multi-layer)
- Build args: NODE_ENV=production, BUILD_DATE, VCS_REF
- Layer caching: 80-90% cache hit rate

#### Job 3: `deploy-staging` (10 min timeout)
Deploy to staging ECS cluster with smoke tests.

**Prerequisites:**
- Must pass: `build-and-push`
- Only runs: On main branch push OR manual staging/dev trigger

**Environment:**
- GitHub environment: `staging`
- URL: `${{ secrets.STAGING_URL }}`

**Steps:**
1. Configure AWS credentials (OIDC)
2. Fetch current ECS task definition
3. Register new task definition with updated image
4. Update ECS service (force new deployment)
5. Wait for stabilization (5 min max, 10s check interval)
   - Polls deployment status
   - Waits for: `runningCount == desiredCount`
   - Shows progress every 30s
6. Run E2E smoke tests (`npm run test:e2e`)
7. On failure: Auto-rollback to previous task definition
8. Create GitHub deployment status check

**Deployment Stability:**
- Monitors: deployment status, running/desired task counts
- Timeout: 5 minutes (non-fatal — continues with caution)
- Check interval: Every 10 seconds
- Success: All desired tasks running, no pending tasks

**Smoke Tests:**
- Endpoint: `${{ secrets.STAGING_URL }}`
- Tests: Basic protocol compliance, CRUD operations
- Config: `TEST_E2E=true`, `ENDPOINT_URL=<staging-url>`
- Timeout: Inherited from npm test command

**Auto-Rollback Triggers:**
- Smoke test failure
- Manual: `aws ecs update-service --task-definition <previous>`
- Waits for previous deployment to stabilize

**Secrets Required:**
- `STAGING_URL` — Base URL of staging environment (e.g., https://staging.sheets-api.internal)

#### Job 4: `deploy-production` (15 min timeout)
Deploy to production ECS cluster (after staging succeeds).

**Prerequisites:**
- Must pass: `build-and-push` AND `deploy-staging`
- Only runs: On version tags (v*.*.*) OR manual prod trigger

**Environment:**
- GitHub environment: `production`
- Requires approval: ✓ (GitHub environment protection)
- URL: `${{ secrets.PROD_URL }}`

**Approval Gate:**
- Workflow pauses at `deploy-production` job
- Branch admins receive notification to review
- Must approve via GitHub Actions UI or API
- Can be auto-approved via environment settings (not recommended)

**Deployment Process:**
- Identical to staging (same task definition pattern)
- Different cluster: `servalsheets-prod`
- Different service: `servalsheets-prod-service`
- Longer stability check: 5 min timeout

**Production-Specific Steps:**
1. Deploy with new image
2. Wait for stabilization
3. Run smoke tests against prod endpoint
4. On failure:
   - Auto-rollback to previous task definition
   - Create GitHub issue with details
   - Include links to CloudWatch logs

**Secrets Required:**
- `PROD_URL` — Base URL of production environment

**Failure Handling:**
- Auto-rollback: Triggered immediately on smoke test failure
- GitHub issue: Created with incident details
  - Include: commit SHA, ref, action run ID
  - Links: To Actions run and CloudWatch logs
  - Labels: deployment, production, incident

#### Job 5: `notify` (2 min timeout)
Post-deployment notifications.

**Runs:**
- Always (success or failure)
- Dependencies: All other jobs (for aggregating status)

**Notifications:**
- Slack webhook (optional, if `SLACK_WEBHOOK_URL` secret configured)

**Slack Message Format:**
```
🐳 ServalSheets AgentCore Deployment
Commit: <linked SHA>
Ref: main / v1.2.3
Build: success / failure
Staging: success / skipped
Production: success / skipped / (not reached)
Overall: success / failure
Image: <ECR URI>
[View Workflow Run] [View Commit]
```

**Secrets Required:**
- `SLACK_WEBHOOK_URL` (optional) — Slack webhook for notifications

### Concurrency

- Group: `deploy-agentcore-<workflow>-<ref>`
- Behavior: Only one deployment per branch/tag at a time
- Cancel in progress: `false` (wait instead of cancel)

### Permissions

```yaml
contents: read           # Read repository code
id-token: write         # OIDC token generation (AWS assume role)
packages: write         # ECR login (if using GitHub packages)
deployments: write      # Create deployment records
artifacts: write        # Store build artifacts
```

### Environment Variables

```yaml
AWS_ACCOUNT_ID: 050752643237
AWS_REGION: us-east-1
ECR_REPOSITORY: servalsheets/mcp-server
DOCKERFILE: Dockerfile.agentcore
```

## Deployment Script: deploy-ecs.sh

Manual deployment helper for ECS operations.

### Installation

```bash
# Script is executable by default
chmod +x scripts/deploy-ecs.sh

# No additional dependencies beyond AWS CLI + jq
brew install awscli jq  # macOS
apt-get install awscli jq  # Ubuntu
```

### Usage

#### Basic Deployment to Staging

```bash
./scripts/deploy-ecs.sh --environment staging --image-tag sha-abc123
```

#### Deployment to Production

```bash
./scripts/deploy-ecs.sh --environment prod --image-tag v1.2.3
```

#### Custom Cluster/Service Names

```bash
./scripts/deploy-ecs.sh \
  --environment staging \
  --image-tag sha-abc123 \
  --cluster my-custom-cluster \
  --service my-custom-service
```

### Command-Line Options

| Option | Required | Example | Description |
|--------|----------|---------|-------------|
| `--environment` | Yes | staging, prod | Deployment environment (determines cluster/service) |
| `--image-tag` | Yes | v1.2.3, sha-abc123 | Docker image tag in ECR |
| `--cluster` | No | servalsheets-staging | ECS cluster name (auto-determined by environment) |
| `--service` | No | servalsheets-staging-service | ECS service name (auto-determined by environment) |
| `--help` | No | — | Show usage information |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| AWS_REGION | us-east-1 | AWS region |
| AWS_PROFILE | (none) | AWS CLI profile to use |
| ENABLE_ROLLBACK | true | Auto-rollback on smoke test failure |
| STAGING_URL | (none) | Staging endpoint for smoke tests |
| PROD_URL | (none) | Production endpoint for smoke tests |

### Script Flow

```
1. Verify Prerequisites
   - AWS CLI available
   - jq installed
   - AWS credentials valid
   - Correct AWS account

2. Parse Arguments
   - Validate environment
   - Set cluster/service
   - Build image URI

3. Prepare Deployment
   - Fetch current task definition
   - Register new task definition with updated image
   - Update ECS service

4. Wait for Stability
   - Poll deployment status (10s intervals)
   - Wait for desired task count to match running
   - Timeout: 5 minutes (non-fatal)

5. Run Smoke Tests
   - POST to endpoint health check
   - Run E2E tests if TEST_E2E env var set
   - Skip if endpoint URL not configured

6. Rollback on Failure
   - If smoke tests fail: revert to previous task def
   - Wait for rollback to stabilize
   - Return exit code 1

7. Report Status
   - Show elapsed time
   - Print deployment summary
   - Return exit code 0 on success
```

### Output Example

```
═══════════════════════════════════════════════════════════
  ServalSheets ECS Deployment
═══════════════════════════════════════════════════════════

[2026-03-27 15:45:23] ℹ️  Starting deployment at Mon Mar 27 15:45:23 UTC 2026

═══════════════════════════════════════════════════════════
  Verifying Prerequisites
═══════════════════════════════════════════════════════════

[2026-03-27 15:45:23] ✅ AWS CLI found
[2026-03-27 15:45:23] ✅ jq found
[2026-03-27 15:45:24] ✅ AWS credentials verified

═══════════════════════════════════════════════════════════
  Parsing Arguments
═══════════════════════════════════════════════════════════

[2026-03-27 15:45:24] ℹ️  Environment: staging
[2026-03-27 15:45:24] ℹ️  Image tag: sha-abc123
[2026-03-27 15:45:24] ℹ️  Cluster: servalsheets-staging
[2026-03-27 15:45:24] ℹ️  Service: servalsheets-staging-service

═══════════════════════════════════════════════════════════
  Building Image URI
═══════════════════════════════════════════════════════════

[2026-03-27 15:45:24] ℹ️  Full image URI: 050752643237.dkr.ecr.us-east-1.amazonaws.com/servalsheets/mcp-server:sha-abc123

═══════════════════════════════════════════════════════════
  Preparing Deployment
═══════════════════════════════════════════════════════════

[2026-03-27 15:45:25] ℹ️  Fetching current task definition...
[2026-03-27 15:45:26] ✅ Current task definition: arn:aws:ecs:us-east-1:050752643237:task-definition/servalsheets-staging:45
[2026-03-27 15:45:26] ℹ️  Registering new task definition with image: 050752643237.dkr.ecr.us-east-1.amazonaws.com/servalsheets/mcp-server:sha-abc123
[2026-03-27 15:45:27] ✅ Registered new task definition: arn:aws:ecs:us-east-1:050752643237:task-definition/servalsheets-staging:46

═══════════════════════════════════════════════════════════
  Deploying to ECS
═══════════════════════════════════════════════════════════

[2026-03-27 15:45:27] ℹ️  Updating ECS service servalsheets-staging-service with task definition: arn:aws:ecs:us-east-1:050752643237:task-definition/servalsheets-staging:46
[2026-03-27 15:45:28] ✅ Service update initiated

═══════════════════════════════════════════════════════════
  Waiting for Deployment Stability
═══════════════════════════════════════════════════════════

[2026-03-27 15:45:28] ℹ️  Checking deployment every 10s (timeout: 300s)
[2026-03-27 15:45:40] ℹ️  Status: PRIMARY | Running: 1/2 | Pending: 1
[2026-03-27 15:45:59] ℹ️  Status: PRIMARY | Running: 2/2 | Pending: 0
[2026-03-27 15:46:01] ✅ Deployment stabilized (2/2 tasks running)

═══════════════════════════════════════════════════════════
  Running E2E Smoke Tests
═══════════════════════════════════════════════════════════

[2026-03-27 15:46:01] ℹ️  Testing endpoint: https://staging.sheets-api.internal
[2026-03-27 15:46:02] ℹ️  Running smoke tests...
✓ Protocol compliance (87ms)
✓ Basic CRUD operations (145ms)
✓ Error handling (56ms)
[2026-03-27 15:46:05] ✅ Smoke tests passed

═══════════════════════════════════════════════════════════
  Deployment Complete
═══════════════════════════════════════════════════════════

[2026-03-27 15:46:05] ✅ ✨ Deployment successful!
[2026-03-27 15:46:05] ℹ️  Environment: staging
[2026-03-27 15:46:05] ℹ️  Cluster: servalsheets-staging
[2026-03-27 15:46:05] ℹ️  Service: servalsheets-staging-service
[2026-03-27 15:46:05] ℹ️  Image: 050752643237.dkr.ecr.us-east-1.amazonaws.com/servalsheets/mcp-server:sha-abc123
[2026-03-27 15:46:05] ℹ️  Total time: 00:42
```

### Error Handling

#### Prerequisites Check Failed
```
❌ AWS CLI not found. Please install it first.
```
**Action:** Install AWS CLI

#### AWS Credentials Invalid
```
❌ AWS credentials not configured or invalid
```
**Action:** Configure AWS CLI (`aws configure` or assume IAM role)

#### Task Definition Not Found
```
❌ Could not find task definition for service servalsheets-staging-service
```
**Action:** Verify cluster and service names exist

#### Deployment Timeout
```
⚠️  Deployment did not fully stabilize within 300s
Continuing with caution - monitor service health in CloudWatch
```
**Action:** Check CloudWatch logs for task failures

#### Smoke Tests Failed
```
❌ Smoke tests failed
```
**Action:** With ENABLE_ROLLBACK=true, automatic rollback triggered

```
🔙 Rolling back deployment...
✅ Rolled back production to: arn:aws:ecs:us-east-1:050752643237:task-definition/servalsheets-prod:42
```

### Exit Codes

| Code | Meaning | Recovery |
|------|---------|----------|
| 0 | Success | None |
| 1 | Deployment failed | Check logs, fix issue, retry |
| 2 | Deployment failed AND rollback failed | Manual investigation required |

### Integration with CI/CD

#### GitHub Actions Workflow
The workflow calls this script indirectly via AWS CLI commands embedded in job steps.

#### Manual Deployment in Emergency
```bash
# Deploy critical hotfix to production
git tag v1.2.4-hotfix
./scripts/deploy-ecs.sh --environment prod --image-tag v1.2.4-hotfix

# Manually triggered deployment
./scripts/deploy-ecs.sh --environment staging --image-tag sha-latest
```

## Configuration & Secrets

### GitHub Secrets Required

#### For GitHub Actions Workflow

| Secret | Environment | Required | Example |
|--------|-------------|----------|---------|
| `STAGING_URL` | All | No | https://staging.sheets-api.internal |
| `PROD_URL` | All | No | https://api.sheets.internal |
| `SLACK_WEBHOOK_URL` | All | No | https://hooks.slack.com/services/... |

#### For AWS OIDC Authentication

No additional secrets needed — uses GitHub OIDC provider.

**IAM Role Configuration Required:**
```yaml
# In AWS Account 050752643237
Role Name: github-actions-servalsheets
Trust Relationship: GitHub OIDC provider
Permissions:
  - ecr:GetAuthorizationToken
  - ecr:BatchGetImage
  - ecr:GetDownloadUrlForLayer
  - ecr:PutImage
  - ecr:InitiateLayerUpload
  - ecr:UploadLayerPart
  - ecr:CompleteLayerUpload
  - ecs:DescribeServices
  - ecs:DescribeTaskDefinition
  - ecs:DescribeTasks
  - ecs:RegisterTaskDefinition
  - ecs:UpdateService
  - iam:PassRole
```

### GitHub Environments

#### Staging Environment
- Name: `staging`
- Protection rules: None (or minimal)
- Secrets: `STAGING_URL`

#### Production Environment
- Name: `production`
- Protection rules:
  - Require approval from admins
  - Required reviewers: At least 1 maintainer
- Secrets: `PROD_URL`

## Monitoring & Logging

### GitHub Actions Logs
- Available at: `https://github.com/your-org/servalsheets/actions`
- Filter by workflow: "Deploy to AWS AgentCore Runtime"
- Each job has collapsible logs

### CloudWatch Logs (ECS)
```bash
# View recent logs from staging
aws logs tail /ecs/servalsheets-staging --follow

# View recent logs from production
aws logs tail /ecs/servalsheets-prod --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /ecs/servalsheets-staging \
  --filter-pattern "ERROR"
```

### ECS Task Logs
```bash
# Get latest running task
TASK_ARN=$(aws ecs list-tasks \
  --cluster servalsheets-staging \
  --service-name servalsheets-staging-service \
  --query 'taskArns[0]' \
  --output text)

# View task logs
aws ecs describe-tasks \
  --cluster servalsheets-staging \
  --tasks ${TASK_ARN} \
  | jq '.tasks[0].containers[0].logStreamName'
```

## Troubleshooting

### Deployment Stuck in "Running Old Task Definition"

**Problem:** New task definition created but service still running old one.

**Solution:**
```bash
# Force new deployment
aws ecs update-service \
  --cluster servalsheets-staging \
  --service servalsheets-staging-service \
  --force-new-deployment
```

### ECR Image Not Found

**Problem:** Error: "Error response from daemon: pull access denied for 050752643237.dkr.ecr.us-east-1.amazonaws.com/servalsheets/mcp-server, repository not found"

**Causes:**
- Image not pushed to ECR
- Wrong AWS account/region
- IAM credentials don't have ECR access

**Solution:**
- Verify image exists: `aws ecr describe-images --repository-name servalsheets/mcp-server`
- Check GitHub Actions build log for push errors

### Smoke Tests Timing Out

**Problem:** E2E tests hang or timeout.

**Causes:**
- Endpoint URL unreachable
- Task not fully started (still initializing)
- Network/firewall issue

**Solution:**
```bash
# Test endpoint connectivity manually
curl -v https://staging.sheets-api.internal/health

# Check task logs
aws ecs describe-tasks --cluster servalsheets-staging --tasks <task-arn>

# View container logs
aws logs tail /ecs/servalsheets-staging --follow
```

### Automatic Rollback Triggered

**Problem:** Smoke tests failed and service was rolled back.

**Steps to Investigate:**
1. Check GitHub Actions log for test failure details
2. Review smoke test output in workflow logs
3. Check CloudWatch logs: `/ecs/servalsheets-staging`
4. Run tests locally: `npm run test:e2e` with `ENDPOINT_URL=<url>`
5. Fix issue and redeploy

## Best Practices

### Version Tags

Always use semantic versioning for production deployments:
```bash
git tag v1.2.3
git push origin v1.2.3
```

Never use floating tags like `latest` or `main` for production.

### Staging Tests

Always deploy to staging first:
- Smoke tests run automatically
- Gives chance to catch issues before production
- Low risk to test new changes

### Approval Gates

Production deployments require manual approval:
- Reviewed by team leads before deploying
- Prevents accidental prod deploys
- Provides paper trail for compliance

### Monitoring

After deploying to production:
1. Check CloudWatch dashboard
2. Monitor error rates
3. Watch for resource warnings
4. Verify metrics are healthy for 5+ minutes

### Rollback Procedures

If production deployment fails:
1. Automatic rollback happens immediately (if smoke tests fail)
2. GitHub issue created with details
3. Team notified via Slack
4. Investigate root cause
5. Fix and redeploy

## Advanced Usage

### Deploying Custom Image

```bash
# Build image locally
docker buildx build \
  --platform linux/arm64 \
  -f Dockerfile.agentcore \
  -t 050752643237.dkr.ecr.us-east-1.amazonaws.com/servalsheets/mcp-server:my-test \
  .

# Push to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 050752643237.dkr.ecr.us-east-1.amazonaws.com

docker push 050752643237.dkr.ecr.us-east-1.amazonaws.com/servalsheets/mcp-server:my-test

# Deploy
./scripts/deploy-ecs.sh --environment staging --image-tag my-test
```

### Canary Deployments

To deploy to a small percentage of traffic first:

1. Create separate ECS service with canary traffic weights
2. Deploy new image to canary service
3. Monitor error rates
4. Gradually shift traffic to new version
5. Roll back if issues detected

(Requires additional ECS service setup — not in scope of this doc)

### Multi-Region Deployments

Currently configured for us-east-1 only. To add additional regions:

1. Create new ECS cluster in additional region
2. Create new ECR repository in additional region (or use same ECR with region-specific tags)
3. Update workflow to deploy to multiple regions
4. Update deploy-ecs.sh to accept region parameter

## Related Documentation

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker for ARM64](https://docs.docker.com/desktop/extensions-sdk/extensions/build-multiarch/)
- [CLAUDE.md](../../CLAUDE.md) — Project coding rules
- [ARCHITECTURE.md](../development/ARCHITECTURE.md) — System architecture
