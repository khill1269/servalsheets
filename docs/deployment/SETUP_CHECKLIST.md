# AWS AgentCore Deployment Setup Checklist

Pre-deployment configuration steps to enable the CI/CD pipeline.

## AWS IAM Setup

### 1. Create IAM Role for GitHub Actions

```bash
# Create trust policy document
cat > /tmp/github-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::050752643237:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR-ORG/servalsheets:*"
        }
      }
    }
  ]
}
EOF

# Create the role
aws iam create-role \
  --role-name github-actions-servalsheets \
  --assume-role-policy-document file:///tmp/github-trust-policy.json \
  --description "GitHub Actions role for ServalSheets AWS deployments"
```

### 2. Attach Required Policies

```bash
# Create inline policy for ECR access
cat > /tmp/ecr-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeImages",
        "ecr:DescribeRepositories"
      ],
      "Resource": "arn:aws:ecr:us-east-1:050752643237:repository/servalsheets/mcp-server"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name github-actions-servalsheets \
  --policy-name servalsheets-ecr-access \
  --policy-document file:///tmp/ecr-policy.json
```

```bash
# Create inline policy for ECS access
cat > /tmp/ecs-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:DescribeTasks",
        "ecs:ListTasks",
        "ecs:RegisterTaskDefinition",
        "ecs:UpdateService"
      ],
      "Resource": [
        "arn:aws:ecs:us-east-1:050752643237:cluster/servalsheets-staging",
        "arn:aws:ecs:us-east-1:050752643237:cluster/servalsheets-prod",
        "arn:aws:ecs:us-east-1:050752643237:service/servalsheets-staging/servalsheets-staging-service",
        "arn:aws:ecs:us-east-1:050752643237:service/servalsheets-prod/servalsheets-prod-service",
        "arn:aws:ecs:us-east-1:050752643237:task-definition/servalsheets-staging:*",
        "arn:aws:ecs:us-east-1:050752643237:task-definition/servalsheets-prod:*"
      ]
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name github-actions-servalsheets \
  --policy-name servalsheets-ecs-access \
  --policy-document file:///tmp/ecs-policy.json
```

```bash
# Create inline policy for IAM PassRole (required for ECS task definitions)
cat > /tmp/iam-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": [
        "arn:aws:iam::050752643237:role/ecsTaskExecutionRole",
        "arn:aws:iam::050752643237:role/ecsTaskRole"
      ]
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name github-actions-servalsheets \
  --policy-name servalsheets-iam-passrole \
  --policy-document file:///tmp/iam-policy.json
```

### 3. Verify Role Creation

```bash
# Get role ARN
aws iam get-role --role-name github-actions-servalsheets --query 'Role.Arn' --output text
# Expected output: arn:aws:iam::050752643237:role/github-actions-servalsheets

# List attached policies
aws iam list-role-policies --role-name github-actions-servalsheets
# Expected: servalsheets-ecr-access, servalsheets-ecs-access, servalsheets-iam-passrole
```

## AWS ECR Setup

### 1. Verify ECR Repository Exists

```bash
# Check if repository exists
aws ecr describe-repositories --repository-names servalsheets/mcp-server --region us-east-1

# If not found, create it
aws ecr create-repository \
  --repository-name servalsheets/mcp-server \
  --region us-east-1 \
  --image-tag-mutability MUTABLE \
  --image-scanning-configuration scanOnPush=true
```

### 2. Configure Lifecycle Policy (Optional)

```bash
# Keep last 10 images, delete images older than 30 days
cat > /tmp/lifecycle-policy.json << 'EOF'
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep last 10 images",
      "selection": {
        "tagStatus": "any",
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 2,
      "description": "Delete images older than 30 days",
      "selection": {
        "tagStatus": "any",
        "countType": "sinceImagePushed",
        "countUnit": "days",
        "countNumber": 30
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
EOF

aws ecr put-lifecycle-policy \
  --repository-name servalsheets/mcp-server \
  --lifecycle-policy-text file:///tmp/lifecycle-policy.json \
  --region us-east-1
```

## AWS ECS Setup

### 1. Verify Clusters Exist

```bash
# List ECS clusters
aws ecs list-clusters --region us-east-1

# Check for staging cluster
aws ecs describe-clusters \
  --clusters servalsheets-staging \
  --region us-east-1

# Check for production cluster
aws ecs describe-clusters \
  --clusters servalsheets-prod \
  --region us-east-1

# If clusters don't exist, create them:
aws ecs create-cluster \
  --cluster-name servalsheets-staging \
  --region us-east-1

aws ecs create-cluster \
  --cluster-name servalsheets-prod \
  --region us-east-1
```

### 2. Verify Services Exist

```bash
# Check staging service
aws ecs describe-services \
  --cluster servalsheets-staging \
  --services servalsheets-staging-service \
  --region us-east-1

# Check production service
aws ecs describe-services \
  --cluster servalsheets-prod \
  --services servalsheets-prod-service \
  --region us-east-1

# If services don't exist, check ARCHITECTURE.md for service setup
```

### 3. Verify Task Definitions Exist

```bash
# Check staging task definition
aws ecs describe-task-definition \
  --task-definition servalsheets-staging \
  --region us-east-1

# Check production task definition
aws ecs describe-task-definition \
  --task-definition servalsheets-prod \
  --region us-east-1
```

### 4. Verify Task Execution Role (Required)

```bash
# Check if ecsTaskExecutionRole exists
aws iam get-role --role-name ecsTaskExecutionRole

# If not found, it should be created automatically by AWS
# But verify it has proper permissions for ECR image pulling
```

## GitHub Configuration

### 1. Create GitHub Secrets

Go to: `Settings → Secrets and variables → Actions`

**Optional Secrets** (for smoke testing and notifications):

| Secret | Value | Required |
|--------|-------|----------|
| `STAGING_URL` | `https://staging.sheets-api.internal` | No |
| `PROD_URL` | `https://api.sheets.internal` | No |
| `SLACK_WEBHOOK_URL` | Slack webhook URL | No |

**Do NOT create AWS secrets** — uses OIDC authentication instead.

### 2. Setup GitHub Environments

Go to: `Settings → Environments`

#### Staging Environment
1. Click "New environment" → Name: `staging`
2. Keep protection rules minimal (optional)
3. Add secrets:
   - `STAGING_URL` (if not in repo secrets)
4. Click "Save protection rules"

#### Production Environment
1. Click "New environment" → Name: `production`
2. Enable protection rules:
   - ✓ "Require approval before deployment"
   - Required reviewers: Select admins
   - Dismiss stale deployment reviews: (optional)
3. Add secrets:
   - `PROD_URL` (if not in repo secrets)
4. Click "Save protection rules"

### 3. Configure Branch Protection (Recommended)

Go to: `Settings → Branches → Add rule`

For `main` branch:
- ✓ Require pull request reviews before merging
- ✓ Require status checks to pass before merging
  - Required status checks:
    - `deploy-agentcore/staging`
    - `deploy-agentcore/production` (optional)

### 4. Add GitHub OIDC Token Reuse Limitation (Optional)

This is automatically configured but verify:
- Role ARN: `arn:aws:iam::050752643237:role/github-actions-servalsheets`
- OIDC Provider: `token.actions.githubusercontent.com`
- Subject: Restricted to `repo:YOUR-ORG/servalsheets:*`

## Verification Checklist

### AWS IAM
- [ ] Role `github-actions-servalsheets` exists
- [ ] Role has trust relationship with GitHub OIDC
- [ ] Role has ECR permissions policy attached
- [ ] Role has ECS permissions policy attached
- [ ] Role has IAM PassRole policy attached
- [ ] Role ARN: `arn:aws:iam::050752643237:role/github-actions-servalsheets`

### AWS ECR
- [ ] Repository `servalsheets/mcp-server` exists in us-east-1
- [ ] Repository is accessible from GitHub Actions role
- [ ] (Optional) Lifecycle policy configured

### AWS ECS
- [ ] Cluster `servalsheets-staging` exists
- [ ] Cluster `servalsheets-prod` exists
- [ ] Service `servalsheets-staging-service` exists in staging cluster
- [ ] Service `servalsheets-prod-service` exists in prod cluster
- [ ] Task definitions registered for both environments
- [ ] Task execution role exists and has ECR permissions

### GitHub
- [ ] Workflow file at `.github/workflows/deploy-agentcore.yml`
- [ ] Deploy script at `scripts/deploy-ecs.sh` (executable)
- [ ] (Optional) Secrets configured: `STAGING_URL`, `PROD_URL`, `SLACK_WEBHOOK_URL`
- [ ] (Optional) Environments created: `staging`, `production`
- [ ] (Optional) Production environment has approval requirements

## Testing the Setup

### 1. Dry-Run the Workflow

Create a test branch and push:

```bash
git checkout -b test/deployment
git push origin test/deployment
```

Go to Actions → "Deploy to AWS AgentCore Runtime" and manually trigger:

```bash
gh workflow run deploy-agentcore.yml \
  -f environment=staging \
  -f image_tag=sha-test-123
```

**Expected behavior:**
- Verify job runs and passes
- Build job completes successfully
- Staging deployment attempted (may fail if URL not configured)

### 2. Test Manual Script

```bash
# Get a valid image tag from ECR
IMAGE_TAG=$(aws ecr describe-images \
  --repository-name servalsheets/mcp-server \
  --region us-east-1 \
  --query 'imageDetails[0].imageTags[0]' \
  --output text)

# Deploy to staging
./scripts/deploy-ecs.sh \
  --environment staging \
  --image-tag ${IMAGE_TAG}

# Should see successful deployment output
```

### 3. Test Production Approval Gate

Push a test tag:

```bash
git tag v0.0.0-test
git push origin v0.0.0-test
```

**Expected behavior:**
- Verify and build jobs run
- Staging deployment runs
- Workflow pauses at production job
- GitHub notifies reviewers
- Workflow completes after approval (or times out)

### 4. Verify CloudWatch Integration

```bash
# Check ECS service logs
aws logs tail /ecs/servalsheets-staging --follow

# Should see task startup logs and application output
```

## Troubleshooting Setup

### AWS OIDC Not Working

**Symptoms:** "User is not authorized to perform: sts:AssumeRoleWithWebIdentity"

**Solution:**
1. Verify GitHub OIDC provider exists:
   ```bash
   aws iam list-open-id-connect-providers | grep token.actions.githubusercontent.com
   ```
2. Verify trust policy includes correct repo path
3. Check GitHub Actions logs for token payload

### ECR Push Fails

**Symptoms:** "error response from daemon"

**Solution:**
1. Verify role has ECR permissions
2. Check repository exists: `aws ecr describe-repositories --repository-names servalsheets/mcp-server`
3. Verify image tag is valid (no spaces, special chars)

### ECS Deployment Hangs

**Symptoms:** Deployment stuck in "PRIMARY" status with mismatched task counts

**Solution:**
1. Check CloudWatch logs: `aws logs tail /ecs/servalsheets-staging --follow`
2. Check ECS task failures: `aws ecs describe-tasks --cluster servalsheets-staging --tasks <task-arn>`
3. Verify task definition image URI is correct
4. Verify ECS container agent logs

### Production Approval Not Working

**Symptoms:** Workflow stuck at production job indefinitely

**Solution:**
1. Go to: Settings → Environments → production
2. Verify "Require approval" is enabled
3. Verify you're in the required reviewers list
4. Approve the deployment in Actions UI

## Maintenance

### Monthly Tasks

- [ ] Review IAM role permissions (least privilege)
- [ ] Check ECR image lifecycle policies
- [ ] Audit GitHub Actions workflow logs for errors
- [ ] Verify ECS task health metrics
- [ ] Check CloudWatch log retention policies

### Security

- [ ] Rotate GitHub personal access tokens if used
- [ ] Audit IAM role trust policy quarterly
- [ ] Review GitHub Actions secrets access
- [ ] Monitor AWS CloudTrail for deployment activity
- [ ] Regularly update action versions in workflow

### Monitoring

- [ ] Set up CloudWatch alarms for ECS task failures
- [ ] Set up Slack alerts for workflow failures
- [ ] Monitor ECR image push/pull metrics
- [ ] Track deployment duration trends

## Related Documents

- [AGENTCORE_DEPLOYMENT.md](./AGENTCORE_DEPLOYMENT.md) - Complete deployment guide
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [GitHub Environments Documentation](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
