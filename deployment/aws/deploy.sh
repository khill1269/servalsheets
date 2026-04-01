#!/bin/bash
# ServalSheets AWS ECS Fargate Deployment Script
# This script builds, pushes, and deploys ServalSheets to AWS ECS Fargate
# Usage: ./deploy.sh [AWS_ACCOUNT_ID] [AWS_REGION] [CLUSTER_NAME] [SERVICE_NAME]
# Example: ./deploy.sh 123456789012 us-east-1 production servalsheets

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $*" >&2
}

# Script directory and defaults
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
AWS_ACCOUNT_ID="${1:-}"
AWS_REGION="${2:-us-east-1}"
ECS_CLUSTER="${3:-production}"
ECS_SERVICE="${4:-servalsheets}"
TASK_FAMILY="servalsheets"
IMAGE_TAG="${5:-latest}"

# Validation
if [[ -z "$AWS_ACCOUNT_ID" ]]; then
  log_error "AWS Account ID is required"
  echo "Usage: $0 <AWS_ACCOUNT_ID> [AWS_REGION] [CLUSTER_NAME] [SERVICE_NAME] [IMAGE_TAG]"
  exit 1
fi

log_info "ServalSheets AWS ECS Fargate Deployment"
log_info "AWS Account: $AWS_ACCOUNT_ID"
log_info "Region: $AWS_REGION"
log_info "Cluster: $ECS_CLUSTER"
log_info "Service: $ECS_SERVICE"
log_info "Image Tag: $IMAGE_TAG"

# ========== PRE-DEPLOYMENT CHECKS ==========
log_info "Running pre-deployment checks..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
  log_error "AWS CLI is not installed"
  exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
  log_error "docker is not installed"
  exit 1
fi

# Check if jq is installed (for JSON parsing)
if ! command -v jq &> /dev/null; then
  log_warning "jq is not installed, some features may not work optimally"
fi

# Verify AWS credentials and get current identity
log_info "Verifying AWS credentials..."
CALLER_IDENTITY=$(aws sts get-caller-identity --region "$AWS_REGION" 2>&1)
if echo "$CALLER_IDENTITY" | grep -q "InvalidClientTokenId\|NotAuthorizedException"; then
  log_error "AWS credentials are invalid or not configured"
  exit 1
fi
log_success "AWS credentials verified"

# ========== ECR SETUP ==========
log_info "Setting up Amazon Elastic Container Registry (ECR)..."

ECR_REPO_NAME="servalsheets"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
ECR_IMAGE_URI="${ECR_REGISTRY}/${ECR_REPO_NAME}"

# Check if ECR repository exists, if not create it
if ! aws ecr describe-repositories \
  --repository-names "$ECR_REPO_NAME" \
  --region "$AWS_REGION" &> /dev/null; then
  log_info "Creating ECR repository: $ECR_REPO_NAME"
  aws ecr create-repository \
    --repository-name "$ECR_REPO_NAME" \
    --region "$AWS_REGION" \
    --encryption-configuration encryptionType=AES \
    --tags Key=Name,Value=servalsheets Key=Environment,Value=production
  log_success "ECR repository created"
else
  log_success "ECR repository '$ECR_REPO_NAME' already exists"
fi

# Set lifecycle policy for ECR (keep last 10 images)
log_info "Setting ECR lifecycle policy..."
aws ecr put-lifecycle-policy \
  --repository-name "$ECR_REPO_NAME" \
  --lifecycle-policy-text '{
    "rules": [
      {
        "rulePriority": 1,
        "description": "Keep last 10 images",
        "selection": {
          "tagStatus": "tagged",
          "tagPrefixList": ["latest"],
          "countType": "imageCountMoreThan",
          "countNumber": 10
        },
        "action": {
          "type": "expire"
        }
      }
    ]
  }' \
  --region "$AWS_REGION" || log_warning "Could not set lifecycle policy (may already exist)"

# ========== BUILD PHASE ==========
log_info "Building ServalSheets Docker image..."

cd "$PROJECT_DIR"

# Build Docker image
ECR_IMAGE_FULL="${ECR_IMAGE_URI}:${IMAGE_TAG}"
log_info "Building Docker image: $ECR_IMAGE_FULL"

if docker build \
  -t "$ECR_IMAGE_FULL" \
  -t "${ECR_IMAGE_URI}:latest" \
  -f deployment/docker/Dockerfile \
  --build-arg NODE_ENV=production \
  .; then
  log_success "Docker image built successfully"
else
  log_error "Docker image build failed"
  exit 1
fi

# ========== PUSH PHASE ==========
log_info "Pushing Docker image to Amazon ECR..."

# Login to ECR
log_info "Authenticating Docker with ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$ECR_REGISTRY" || {
  log_error "Failed to authenticate with ECR"
  exit 1
}
log_success "Docker authenticated with ECR"

# Push to ECR
log_info "Pushing image: $ECR_IMAGE_FULL"
if docker push "$ECR_IMAGE_FULL"; then
  log_success "Image pushed to ECR: $ECR_IMAGE_FULL"
else
  log_error "Failed to push image to ECR"
  exit 1
fi

# Also push latest tag
if docker push "${ECR_IMAGE_URI}:latest"; then
  log_success "Latest tag pushed to ECR"
fi

# ========== SECRETS MANAGEMENT ==========
log_info "Setting up secrets in AWS Secrets Manager..."

create_or_update_secret() {
  local secret_name="$1"
  local secret_value="$2"

  if aws secretsmanager describe-secret \
    --secret-id "$secret_name" \
    --region "$AWS_REGION" &> /dev/null; then
    log_info "Secret '$secret_name' exists, updating..."
    aws secretsmanager update-secret \
      --secret-id "$secret_name" \
      --secret-string "$secret_value" \
      --region "$AWS_REGION" --quiet
  else
    log_info "Creating secret '$secret_name'..."
    aws secretsmanager create-secret \
      --name "$secret_name" \
      --secret-string "$secret_value" \
      --region "$AWS_REGION" \
      --tags Key=Name,Value=servalsheets Key=Environment,Value=production \
      --quiet
  fi
}

# Check for required secrets
check_and_create_secret() {
  local secret_name="$1"
  local prompt_message="$2"

  if aws secretsmanager describe-secret \
    --secret-id "$secret_name" \
    --region "$AWS_REGION" &> /dev/null; then
    log_success "Secret '$secret_name' already exists"
    return 0
  fi

  log_warning "Secret '$secret_name' not found"
  echo -n "Enter $prompt_message (or press Enter to skip): "
  read -r secret_value

  if [[ -n "$secret_value" ]]; then
    create_or_update_secret "$secret_name" "$secret_value"
    log_success "Secret '$secret_name' created"
  else
    log_warning "Skipping secret '$secret_name'. You must create it manually."
  fi
}

check_and_create_secret "servalsheets/jwt-secret" \
  "JWT signing secret (generate: openssl rand -hex 32)"

check_and_create_secret "servalsheets/encryption-key" \
  "Token encryption key (generate: openssl rand -hex 32)"

check_and_create_secret "servalsheets/google-client-id" \
  "Google OAuth Client ID"

check_and_create_secret "servalsheets/google-client-secret" \
  "Google OAuth Client Secret"

check_and_create_secret "servalsheets/admin-api-key" \
  "Admin API key (generate: openssl rand -hex 32)"

check_and_create_secret "servalsheets/redis-url" \
  "Redis connection URL"

check_and_create_secret "servalsheets/oauth-issuer" \
  "OAuth issuer URL"

check_and_create_secret "servalsheets/oauth-redirect-uri" \
  "OAuth redirect URI"

check_and_create_secret "servalsheets/anthropic-api-key" \
  "Anthropic API key (optional)" || true

check_and_create_secret "servalsheets/voyage-api-key" \
  "Voyage AI API key (optional)" || true

# ========== IAM ROLE SETUP ==========
log_info "Setting up IAM roles..."

TASK_ROLE_NAME="servalsheets-task-role"
TASK_ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${TASK_ROLE_NAME}"

# Check if task role exists
if ! aws iam get-role --role-name "$TASK_ROLE_NAME" &> /dev/null; then
  log_info "Creating IAM task role: $TASK_ROLE_NAME"

  # Create assume role policy
  ASSUME_ROLE_POLICY='{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "ecs-tasks.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }'

  aws iam create-role \
    --role-name "$TASK_ROLE_NAME" \
    --assume-role-policy-document "$ASSUME_ROLE_POLICY" \
    --description "Task role for ServalSheets ECS tasks" \
    --tags Key=Name,Value=servalsheets Key=Environment,Value=production

  log_success "IAM task role created"
fi

# Attach policies to the task role
log_info "Attaching policies to task role..."

# Policy for Secrets Manager access
SECRETS_POLICY='{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:'${AWS_REGION}':'${AWS_ACCOUNT_ID}':secret:servalsheets/*"
      ]
    }
  ]
}'

aws iam put-role-policy \
  --role-name "$TASK_ROLE_NAME" \
  --policy-name "SecretsManagerAccess" \
  --policy-document "$SECRETS_POLICY" || log_warning "Could not attach Secrets Manager policy"

# Policy for CloudWatch Logs
LOGS_POLICY='{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:'${AWS_REGION}':'${AWS_ACCOUNT_ID}':log-group:/ecs/*"
    }
  ]
}'

aws iam put-role-policy \
  --role-name "$TASK_ROLE_NAME" \
  --policy-name "CloudWatchLogsAccess" \
  --policy-document "$LOGS_POLICY" || log_warning "Could not attach CloudWatch Logs policy"

log_success "IAM roles configured"

# ========== CLOUDWATCH LOG GROUP ==========
log_info "Setting up CloudWatch Logs..."

LOG_GROUP="/ecs/servalsheets"

if ! aws logs describe-log-groups \
  --log-group-name-prefix "$LOG_GROUP" \
  --region "$AWS_REGION" | grep -q "$LOG_GROUP"; then
  log_info "Creating CloudWatch log group: $LOG_GROUP"
  aws logs create-log-group \
    --log-group-name "$LOG_GROUP" \
    --region "$AWS_REGION"

  aws logs put-retention-policy \
    --log-group-name "$LOG_GROUP" \
    --retention-in-days 30 \
    --region "$AWS_REGION"

  log_success "CloudWatch log group created"
else
  log_success "CloudWatch log group '$LOG_GROUP' already exists"
fi

# ========== ECS TASK DEFINITION ==========
log_info "Registering ECS task definition..."

# Update task definition with current ECR image
TASK_DEF_JSON="$SCRIPT_DIR/ecs-task-definition.json"
TASK_DEF_TEMP=$(mktemp)

# Replace placeholders in task definition
sed "s|ACCOUNT_ID|${AWS_ACCOUNT_ID}|g" "$TASK_DEF_JSON" | \
  sed "s|REGION|${AWS_REGION}|g" | \
  sed "s|${ECR_REGISTRY}/servalsheets:latest|${ECR_IMAGE_FULL}|g" > "$TASK_DEF_TEMP"

# Register the task definition
log_info "Registering task definition: $TASK_FAMILY"
TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json file://"$TASK_DEF_TEMP" \
  --region "$AWS_REGION" | jq -r '.taskDefinition.taskDefinitionArn')

if [[ -n "$TASK_DEF_ARN" ]] && [[ "$TASK_DEF_ARN" != "null" ]]; then
  log_success "Task definition registered: $TASK_DEF_ARN"
else
  log_error "Failed to register task definition"
  rm -f "$TASK_DEF_TEMP"
  exit 1
fi

rm -f "$TASK_DEF_TEMP"

# ========== ECS SERVICE DEPLOYMENT ==========
log_info "Updating ECS service..."

# Check if service exists
if aws ecs describe-services \
  --cluster "$ECS_CLUSTER" \
  --services "$ECS_SERVICE" \
  --region "$AWS_REGION" 2>&1 | grep -q "ACTIVE"; then

  log_info "Updating existing ECS service: $ECS_SERVICE"

  aws ecs update-service \
    --cluster "$ECS_CLUSTER" \
    --service "$ECS_SERVICE" \
    --task-definition "$TASK_FAMILY:latest" \
    --region "$AWS_REGION" \
    --force-new-deployment \
    --quiet

  log_success "ECS service updated"
else
  log_warning "ECS service '$ECS_SERVICE' not found in cluster '$ECS_CLUSTER'"
  log_info "To create the service, run:"
  echo "  aws ecs create-service --cluster $ECS_CLUSTER --service-name $ECS_SERVICE --task-definition $TASK_DEF_ARN --desired-count 1 --launch-type FARGATE --region $AWS_REGION"
  exit 1
fi

# ========== WAIT FOR DEPLOYMENT ==========
log_info "Waiting for service to stabilize..."

# Wait for the service to reach a stable state
ATTEMPTS=0
MAX_ATTEMPTS=60
while [[ $ATTEMPTS -lt $MAX_ATTEMPTS ]]; do
  SERVICE_STATUS=$(aws ecs describe-services \
    --cluster "$ECS_CLUSTER" \
    --services "$ECS_SERVICE" \
    --region "$AWS_REGION" | jq -r '.services[0].deployments | length')

  RUNNING_COUNT=$(aws ecs describe-services \
    --cluster "$ECS_CLUSTER" \
    --services "$ECS_SERVICE" \
    --region "$AWS_REGION" | jq -r '.services[0].runningCount')

  DESIRED_COUNT=$(aws ecs describe-services \
    --cluster "$ECS_CLUSTER" \
    --services "$ECS_SERVICE" \
    --region "$AWS_REGION" | jq -r '.services[0].desiredCount')

  if [[ "$SERVICE_STATUS" == "1" ]] && [[ "$RUNNING_COUNT" == "$DESIRED_COUNT" ]]; then
    log_success "Service has stabilized (running: $RUNNING_COUNT, desired: $DESIRED_COUNT)"
    break
  fi

  log_info "Waiting for service to stabilize... (attempt $((ATTEMPTS + 1))/$MAX_ATTEMPTS) running: $RUNNING_COUNT, desired: $DESIRED_COUNT"
  sleep 10
  ATTEMPTS=$((ATTEMPTS + 1))
done

if [[ $ATTEMPTS -eq $MAX_ATTEMPTS ]]; then
  log_warning "Service did not stabilize within timeout. Check ECS console for details."
fi

# ========== POST-DEPLOYMENT ==========
log_success "ServalSheets deployment to AWS ECS Fargate completed!"
echo ""
echo "=========================================="
echo "Deployment Details:"
echo "=========================================="
echo "AWS Account: $AWS_ACCOUNT_ID"
echo "Region: $AWS_REGION"
echo "ECS Cluster: $ECS_CLUSTER"
echo "ECS Service: $ECS_SERVICE"
echo "Task Family: $TASK_FAMILY"
echo "Image: $ECR_IMAGE_FULL"
echo "Task Role ARN: $TASK_ROLE_ARN"
echo ""
echo "Next steps:"
echo "1. Configure Application Load Balancer (ALB) for the service"
echo "2. Set up Route 53 DNS records pointing to the ALB"
echo "3. Configure SSL/TLS certificate for HTTPS"
echo "4. Set up CloudWatch alarms for monitoring"
echo "5. View logs: aws logs tail $LOG_GROUP --follow --region $AWS_REGION"
echo "6. View ECS service status: aws ecs describe-services --cluster $ECS_CLUSTER --services $ECS_SERVICE --region $AWS_REGION"
echo ""
echo "Monitor deployment:"
echo "  aws ecs describe-tasks --cluster $ECS_CLUSTER --tasks \$(aws ecs list-tasks --cluster $ECS_CLUSTER --service-name $ECS_SERVICE --region $AWS_REGION --query 'taskArns[]' --output text) --region $AWS_REGION"
echo ""

log_success "Deployment script completed!"
