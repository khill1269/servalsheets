# ServalSheets MCP Server - AWS Deployment Guide

Complete step-by-step guide for deploying ServalSheets to AWS AgentCore Runtime using Terraform.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Setup](#pre-deployment-setup)
3. [Deploy to Development](#deploy-to-development)
4. [Deploy to Staging](#deploy-to-staging)
5. [Deploy to Production](#deploy-to-production)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Rollback Procedures](#rollback-procedures)
9. [Cost Optimization](#cost-optimization)

## Prerequisites

### AWS Account Setup

You need an AWS account with the following services available:

- ECS Fargate (with Graviton support for ARM64)
- Application Load Balancer (ALB)
- VPC, Subnets, NAT Gateways
- CloudWatch (Logs, Metrics, Alarms, Dashboards)
- AWS WAF
- Secrets Manager
- IAM
- ECR (registry already created)

### Required Tools

Install the following on your local machine:

```bash
# Terraform >= 1.5
terraform version

# AWS CLI >= 2.13
aws --version

# jq (for JSON processing, optional but recommended)
brew install jq  # macOS
apt-get install jq  # Ubuntu/Debian

# Docker (for testing locally)
docker --version
```

### AWS Credentials

Configure AWS CLI with appropriate credentials:

```bash
# Option 1: AWS CLI configuration
aws configure
# Enter AWS Access Key ID
# Enter AWS Secret Access Key
# Default region: us-east-1
# Default output format: json

# Option 2: Environment variables
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="us-east-1"

# Option 3: IAM role (if using EC2, Lambda, etc.)
# Ensure the role has permissions for all AWS services used

# Verify credentials
aws sts get-caller-identity
```

### Permissions Required

The AWS user/role needs permissions for:

- ECS (ecs:\*)
- EC2 (ec2:\*, for VPC/subnets/security groups)
- Load Balancing (elasticloadbalancing:_, autoscaling:_)
- CloudWatch (logs:_, cloudwatch:_)
- IAM (iam:\*)
- WAF (wafv2:\*)
- Secrets Manager (secretsmanager:\*)
- ACM (acm:\*, for certificates)

**Recommended**: Use AWS managed policy `AdministratorAccess` for initial deployment, then create a custom policy for production.

### Docker Image Prerequisites

Ensure your Docker image is already pushed to ECR:

```bash
# Verify image exists
aws ecr describe-images \
  --repository-name servalsheets/mcp-server \
  --region us-east-1 | jq '.imageDetails[-1]'

# Get image URI
aws ecr describe-images \
  --repository-name servalsheets/mcp-server \
  --region us-east-1 \
  --query 'imageDetails[0].imageTags' \
  --output text
```

## Pre-Deployment Setup

### Step 1: Clone Repository and Navigate to Terraform Directory

```bash
cd infra/terraform
ls -la
# Should see: main.tf, variables.tf, iam.tf, monitoring.tf, waf.tf, outputs.tf, versions.tf
```

### Step 2: Create Secrets Manager Secrets

Create the required secrets in AWS Secrets Manager:

```bash
# 1. Cognito Configuration
aws secretsmanager create-secret \
  --name servalsheets/cognito-config \
  --description "Cognito User Pool configuration" \
  --secret-string '{
    "user_pool_id": "us-east-1_d6Q1t6bUi",
    "client_id": "5ro2o67qejkbgd6857ee521r93",
    "region": "us-east-1"
  }' \
  --region us-east-1

# 2. ECR Configuration (optional, for reference)
aws secretsmanager create-secret \
  --name servalsheets/ecr-config \
  --description "ECR registry configuration" \
  --secret-string '{
    "registry": "050752643237.dkr.ecr.us-east-1.amazonaws.com",
    "repository": "servalsheets/mcp-server"
  }' \
  --region us-east-1

# 3. Bedrock Configuration
aws secretsmanager create-secret \
  --name servalsheets/bedrock-config \
  --description "Bedrock Guardrail configuration" \
  --secret-string '{
    "guardrail_id": "rur8hed14y0b",
    "guardrail_version": "1",
    "region": "us-east-1"
  }' \
  --region us-east-1

# Verify secrets were created
aws secretsmanager list-secrets \
  --filters Key=name,Values=servalsheets \
  --region us-east-1
```

### Step 3: Set Up Remote State Management (Recommended)

```bash
# Create S3 bucket for state
aws s3api create-bucket \
  --bucket servalsheets-terraform-state \
  --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket servalsheets-terraform-state \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket servalsheets-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name servalsheets-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1

# Verify setup
aws s3 ls servalsheets-terraform-state
aws dynamodb describe-table \
  --table-name servalsheets-terraform-locks \
  --region us-east-1 | jq '.Table.TableStatus'
```

### Step 4: Prepare Configuration

```bash
# Copy example configuration
cp terraform.tfvars.example terraform.tfvars

# Edit for your environment
nano terraform.tfvars  # or vim, code, etc.
```

**Example terraform.tfvars for development:**

```hcl
environment                = "dev"
aws_region                 = "us-east-1"
ecr_repository_url         = "050752643237.dkr.ecr.us-east-1.amazonaws.com/servalsheets/mcp-server"
image_tag                  = "latest"
cognito_user_pool_id       = "us-east-1_d6Q1t6bUi"
cognito_client_id          = "5ro2o67qejkbgd6857ee521r93"
bedrock_guardrail_id       = "rur8hed14y0b"
bedrock_guardrail_version  = "1"

vpc_cidr                   = "10.0.0.0/16"
cpu                        = 1024
memory                     = 2048
desired_count              = 2
min_capacity               = 2
max_capacity               = 10

enable_monitoring          = true
enable_container_insights  = true
cloudwatch_alarms_enabled  = true
enable_waf                 = true

tags = {
  Owner       = "platform-team"
  CostCenter  = "engineering"
  Environment = "development"
}
```

## Deploy to Development

### Step 1: Initialize Terraform

```bash
# Initialize Terraform
terraform init

# Verify initialization
ls -la .terraform
```

### Step 2: Validate Configuration

```bash
# Validate syntax
terraform validate

# Format code
terraform fmt -recursive .

# Check formatting
terraform fmt -check -recursive .
```

### Step 3: Preview Changes

```bash
# Generate and review plan
terraform plan -out=tfplan

# Review output carefully, especially:
# - Resource creation order
# - Security group rules
# - IAM policies
# - ALB configuration
```

### Step 4: Apply Configuration

```bash
# Apply the plan
terraform apply tfplan

# Wait for completion (typically 10-15 minutes)
# Terraform will create:
# - VPC, subnets, NAT gateways
# - ALB, target group, listeners
# - ECS cluster, service, task definition
# - CloudWatch logs, alarms, dashboard
# - WAF rules
# - IAM roles and policies
```

### Step 5: Verify Deployment

```bash
# Get service URL
terraform output -raw service_url

# Test health check
terraform output -raw health_check_url
curl -v "$(terraform output -raw health_check_url)"

# View ALB DNS name
terraform output -raw alb_dns_name
```

## Deploy to Staging

### Step 1: Create Staging Configuration

```bash
# Create staging-specific terraform.tfvars
cat > terraform.tfvars << 'EOF'
environment                = "staging"
aws_region                 = "us-east-1"
ecr_repository_url         = "050752643237.dkr.ecr.us-east-1.amazonaws.com/servalsheets/mcp-server"
image_tag                  = "v1.0.0"  # Use specific version tag
desired_count              = 3
min_capacity               = 3
max_capacity               = 15
cpu                        = 1024
memory                     = 2048
target_cpu_utilization     = 65
enable_xray_tracing        = true
log_retention_days         = 60

tags = {
  Owner       = "platform-team"
  CostCenter  = "engineering"
  Environment = "staging"
}
EOF
```

### Step 2: Deploy to Staging

```bash
# Plan
terraform plan -out=tfplan

# Review changes
terraform show tfplan

# Apply
terraform apply tfplan

# Verify
terraform output deployment_info
```

## Deploy to Production

### Step 1: Pre-Production Checklist

Before deploying to production, verify:

- [ ] Load testing completed in staging
- [ ] All dependencies verified (Cognito, Bedrock, Secrets Manager)
- [ ] Backup strategy in place
- [ ] Rollback procedure documented and tested
- [ ] Monitoring and alerting configured
- [ ] On-call rotation established
- [ ] Runbook documented
- [ ] Approval from stakeholders obtained

### Step 2: Create Production Configuration

```bash
# Create production-specific configuration
cat > terraform.tfvars << 'EOF'
environment                = "prod"
aws_region                 = "us-east-1"
ecr_repository_url         = "050752643237.dkr.ecr.us-east-1.amazonaws.com/servalsheets/mcp-server"
image_tag                  = "v1.0.0"  # Production release tag
desired_count              = 3
min_capacity               = 3
max_capacity               = 20
cpu                        = 2048
memory                     = 4096
target_cpu_utilization     = 60
target_memory_utilization  = 65

# Custom domain (configure ACM certificate first)
domain_name                = "mcp-api.example.com"
certificate_arn            = "arn:aws:acm:us-east-1:123456789012:certificate/12345678"

# SNS topic for alerts
alarm_sns_topic_arn        = "arn:aws:sns:us-east-1:123456789012:prod-ops-alerts"

# Enhanced monitoring
enable_xray_tracing        = true
enable_container_insights  = true
cloudwatch_alarms_enabled  = true
enable_waf                 = true
log_retention_days         = 90

tags = {
  Owner        = "platform-team"
  CostCenter   = "engineering"
  Environment  = "production"
  Criticality  = "high"
  BackupPolicy = "daily"
}
EOF
```

### Step 3: Pre-Deployment Verification

```bash
# Verify Cognito configuration
aws cognito-idp describe-user-pool --user-pool-id us-east-1_d6Q1t6bUi

# Verify Bedrock guardrail
aws bedrock get-guardrail --guardrail-identifier rur8hed14y0b

# Verify secrets
aws secretsmanager describe-secret --secret-id servalsheets/cognito-config
aws secretsmanager describe-secret --secret-id servalsheets/bedrock-config

# Verify ACM certificate
aws acm describe-certificate --certificate-arn "arn:aws:acm:us-east-1:123456789012:certificate/12345678"
```

### Step 4: Deploy with Change Control

```bash
# Generate detailed plan
terraform plan -out=tfplan -lock-timeout=5m

# Export plan for review
terraform show tfplan > tfplan.json

# Create change ticket with plan attached
# Get approval from change control board

# Apply with monitoring
terraform apply tfplan

# Monitor during deployment
watch -n 5 'aws ecs describe-services \
  --cluster servalsheets-prod-cluster \
  --services servalsheets-prod-service \
  | jq ".services[0] | {running: .runningCount, desired: .desiredCount}"'
```

### Step 5: Post-Deployment Validation

```bash
# Verify all resources
terraform output deployment_info

# Check service health
aws ecs describe-services \
  --cluster servalsheets-prod-cluster \
  --services servalsheets-prod-service \
  | jq '.services[0] | {status: .status, desiredCount: .desiredCount, runningCount: .runningCount}'

# Verify ALB is healthy
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw target_group_arn) \
  | jq '.TargetHealthDescriptions'

# Test endpoint
curl -I "$(terraform output -raw health_check_url)"
```

## Post-Deployment Verification

### Immediate Checks (within 5 minutes)

```bash
# 1. Service is running
aws ecs describe-services \
  --cluster servalsheets-prod-cluster \
  --services servalsheets-prod-service

# 2. Tasks are healthy
aws ecs list-tasks --cluster servalsheets-prod-cluster
aws ecs describe-tasks --cluster servalsheets-prod-cluster --tasks <task-arn>

# 3. Load balancer is passing traffic
aws elbv2 describe-target-health --target-group-arn <tg-arn>

# 4. CloudWatch logs are being written
aws logs tail /ecs/servalsheets-prod --since 1m
```

### Extended Checks (within 1 hour)

```bash
# 1. Verify metrics are being collected
aws cloudwatch list-metrics \
  --namespace AWS/ECS \
  --dimensions Name=ServiceName,Value=servalsheets-prod-service

# 2. Check no alarms are triggered
aws cloudwatch describe-alarms \
  --state-values ALARM

# 3. Verify WAF is working
aws wafv2 list-web-acls --scope REGIONAL

# 4. Check auto-scaling is responding
aws application-autoscaling describe-scaling-activities \
  --service-namespace ecs \
  --resource-id service/servalsheets-prod-cluster/servalsheets-prod-service
```

### Synthetic Monitoring Tests

```bash
# 1. Test health endpoint
curl -v https://mcp-api.example.com/health/live

# 2. Test MCP endpoint
curl -X POST https://mcp-api.example.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "initialize", "id": 1}'

# 3. Load test (if available)
ab -n 100 -c 10 https://mcp-api.example.com/health/live

# 4. SSL/TLS verification
openssl s_client -connect mcp-api.example.com:443
```

## Monitoring and Maintenance

### Daily Monitoring

```bash
# Check service status
aws ecs describe-services \
  --cluster servalsheets-prod-cluster \
  --services servalsheets-prod-service \
  --query 'services[0].[serviceName,status,runningCount,desiredCount]'

# Review CloudWatch dashboard
# Navigate to: CloudWatch → Dashboards → servalsheets-prod-dashboard

# Check for alarms
aws cloudwatch describe-alarms \
  --alarm-names $(make -s get-alarm-names)
```

### Weekly Maintenance

```bash
# Review logs for errors
aws logs insights query \
  --log-group-name /ecs/servalsheets-prod \
  --query 'fields @timestamp, @message | filter @message like /ERROR|WARN/'

# Check resource utilization trends
# Navigate to: CloudWatch → Metrics → ECS

# Review cost (if using AWS Cost Explorer)
# Navigate to: Cost Management → Cost Explorer

# Backup Terraform state
aws s3 cp terraform.tfstate s3://servalsheets-backups/terraform.tfstate.$(date +%Y%m%d)
```

### Monthly Maintenance

```bash
# Verify disaster recovery procedure
# Run: make destroy on staging, then redeploy

# Review and update documentation
# Check if README.md needs updates

# Security audit
# - Review IAM policies
# - Check CloudTrail logs
# - Review WAF rules

# Cost optimization review
# - Analyze EC2 usage
# - Review reserved instance opportunities
```

## Rollback Procedures

### Quick Rollback (Most Recent Version)

If you need to rollback to the previous version:

```bash
# 1. Check current image
aws ecs describe-task-definition \
  --task-definition servalsheets-prod \
  | jq '.taskDefinition.containerDefinitions[0].image'

# 2. Get previous image tag (from git history or image repository)
PREVIOUS_TAG="v1.0.0"

# 3. Update terraform.tfvars
sed -i '' "s/image_tag = .*/image_tag = \"$PREVIOUS_TAG\"/" terraform.tfvars

# 4. Deploy previous version
terraform plan -out=tfplan
terraform apply tfplan

# 5. Monitor rollout
watch -n 5 'aws ecs describe-services \
  --cluster servalsheets-prod-cluster \
  --services servalsheets-prod-service \
  | jq ".services[0] | {running: .runningCount, desired: .desiredCount}"'

# 6. Verify health
curl "$(terraform output -raw health_check_url)"
```

### Full Infrastructure Rollback

If the infrastructure itself has issues:

```bash
# 1. Check Terraform state
terraform state list

# 2. Create new plan to compare with previous state
terraform plan -out=new-tfplan

# 3. If needed, manually revert specific resources
terraform destroy -target aws_ecs_service.app
terraform apply

# 4. Or restore state from backup
aws s3 cp s3://servalsheets-backups/terraform.tfstate.20240101 terraform.tfstate
terraform refresh
```

### Data Recovery

```bash
# If snapshots are available (for stateful data)
aws ec2 describe-snapshots \
  --owner-ids self \
  --filters Name=tag:Environment,Values=prod

# Restore from snapshot
aws ec2 create-volume \
  --snapshot-id snap-xxxxxxxx \
  --availability-zone us-east-1a
```

## Cost Optimization

### Reduce Costs During Development

```bash
# In terraform.tfvars for dev:
desired_count              = 1
min_capacity               = 1
cpu                        = 512
memory                     = 1024
log_retention_days         = 7
enable_xray_tracing        = false
enable_container_insights  = false
```

### Use Spot Instances (Lower Cost)

The current configuration uses a mix of FARGATE and FARGATE_SPOT via the capacity provider strategy. To increase spot usage:

Edit `main.tf` and increase FARGATE_SPOT weight:

```hcl
default_capacity_provider_strategy {
  weight            = 70  # Increase from 50
  capacity_provider = "FARGATE_SPOT"
}
```

### Monitor and Alert on Costs

```bash
# Enable AWS Budget alerts
aws budgets create-budget \
  --account-id 123456789012 \
  --budget file://budget-config.json

# Use Cost Anomaly Detection
aws ce create-anomaly-monitor \
  --anomaly-monitor '{
    "MonitorName": "ServalSheets-Cost",
    "MonitorType": "CUSTOM",
    "MonitorDimension": "SERVICE"
  }'
```

### Reserved Instances and Savings Plans

For production workloads:

- Consider AWS Compute Savings Plans (20-25% discount)
- Use ECS on-demand capacity provider for baseline
- Use Spot for burst capacity

## Troubleshooting

### Tasks Failing to Start

```bash
# Check task logs
aws logs tail /ecs/servalsheets-prod --follow

# Describe the service
aws ecs describe-services \
  --cluster servalsheets-prod-cluster \
  --services servalsheets-prod-service | jq '.services[0].events | .[0:5]'

# Check task definition
aws ecs describe-task-definition \
  --task-definition servalsheets-prod | jq '.taskDefinition.containerDefinitions'
```

### Health Check Failures

```bash
# Test endpoint directly
curl -v https://mcp-api.example.com/health/live

# Check security groups
aws ec2 describe-security-groups \
  --group-ids <ecs-sg-id> | jq '.SecurityGroups[0].IpIngressRules'

# Check target health
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw target_group_arn) \
  | jq '.TargetHealthDescriptions'
```

### High Resource Utilization

```bash
# Check current metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=servalsheets-prod-service \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum

# Scale up manually
terraform apply -var="desired_count=5"
```

## Appendix

### Useful Make Commands

```bash
make help              # Show all available commands
make init              # Initialize Terraform
make validate          # Validate configuration
make plan              # Create execution plan
make apply             # Apply changes
make logs              # Tail service logs
make dashboard         # Open CloudWatch dashboard
make health-check      # Test service health
make ecs-describe      # Show ECS service details
make metrics           # Show current metrics
```

### AWS CLI Quick Reference

```bash
# List all ECS clusters
aws ecs list-clusters

# List services in cluster
aws ecs list-services --cluster servalsheets-prod-cluster

# List tasks
aws ecs list-tasks --cluster servalsheets-prod-cluster

# Describe a task
aws ecs describe-tasks --cluster servalsheets-prod-cluster --tasks <task-arn>

# View container logs
aws logs tail /ecs/servalsheets-prod --follow

# Get CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=servalsheets-prod-service \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average,Maximum,Minimum
```

---

**Last Updated**: 2024-01-15
**Version**: 1.0
**Maintainer**: Platform Engineering Team
