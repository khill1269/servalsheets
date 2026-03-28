# ServalSheets MCP Server - AWS AgentCore Runtime Terraform Module

Production-grade Terraform module for deploying the ServalSheets MCP server on AWS using ECS Fargate with AgentCore Runtime integration.

## Features

- **ECS Fargate on Graviton (ARM64)**: Cost-optimized container deployment
- **Application Load Balancer**: HTTPS termination with auto-redirect from HTTP
- **Auto-scaling**: CPU and memory-based scaling (min 2, max 10 tasks)
- **High Availability**: Multi-AZ deployment across 2 availability zones
- **Security**:
  - AWS WAF with rate limiting and managed rule groups
  - Security groups with least-privilege access
  - Secrets Manager integration for sensitive configs
  - IAM roles with minimal permissions
- **Monitoring**:
  - CloudWatch Dashboard with key metrics
  - Automated alarms for CPU, memory, error rates
  - ECS Container Insights
  - Comprehensive log retention policies
- **Production Ready**:
  - State locking guidance
  - Tagging strategy
  - Resource naming conventions
  - Terraform validation

## Architecture

```
                        ┌─────────────────┐
                        │   Internet      │
                        └────────┬────────┘
                                 │ HTTPS:443
                                 │ HTTP:80 → 301
                                 ▼
                    ┌────────────────────────┐
                    │  Application Load      │
                    │  Balancer (Public)     │
                    │  + AWS WAF             │
                    └────────────┬───────────┘
                                 │
                    ┌────────────┴───────────┐
                    │                        │
        ┌─────────────────────┐   ┌─────────────────────┐
        │  Public Subnet 1    │   │  Public Subnet 2    │
        │  (us-east-1a)       │   │  (us-east-1b)       │
        │  + NAT Gateway      │   │  + NAT Gateway      │
        └─────────────────────┘   └─────────────────────┘
                    │                        │
        ┌─────────────────────┐   ┌─────────────────────┐
        │ Private Subnet 1    │   │ Private Subnet 2    │
        │ (us-east-1a)        │   │ (us-east-1b)        │
        │                     │   │                     │
        │ ┌─────────────────┐ │   │ ┌─────────────────┐ │
        │ │  ECS Task 1     │ │   │ │  ECS Task N     │ │
        │ │  (container:    │ │   │ │  (container:    │ │
        │ │   port 8000)    │ │   │ │   port 8000)    │ │
        │ └─────────────────┘ │   │ └─────────────────┘ │
        │                     │   │                     │
        └─────────────────────┘   └─────────────────────┘
                    │                        │
                    └────────────┬───────────┘
                                 │
                    ┌────────────────────────┐
                    │  CloudWatch Logs       │
                    │  Alarms & Dashboard    │
                    └────────────────────────┘
```

## Quick Start

### 1. Prerequisites

- Terraform >= 1.5
- AWS CLI configured with appropriate credentials
- Docker image already pushed to ECR
- AWS Secrets Manager secrets configured (see below)

### 2. Prepare Secrets Manager

Create the following secrets in AWS Secrets Manager (default region: us-east-1):

```bash
# Cognito configuration
aws secretsmanager create-secret \
  --name servalsheets/cognito-config \
  --secret-string '{"user_pool_id":"us-east-1_d6Q1t6bUi","client_id":"5ro2o67qejkbgd6857ee521r93"}'

# ECR configuration (if needed)
aws secretsmanager create-secret \
  --name servalsheets/ecr-config \
  --secret-string '{"registry":"050752643237.dkr.ecr.us-east-1.amazonaws.com"}'

# Bedrock configuration
aws secretsmanager create-secret \
  --name servalsheets/bedrock-config \
  --secret-string '{"guardrail_id":"rur8hed14y0b","guardrail_version":"1"}'
```

### 3. Create terraform.tfvars

```hcl
environment                = "dev"
aws_region                 = "us-east-1"
ecr_repository_url         = "050752643237.dkr.ecr.us-east-1.amazonaws.com/servalsheets/mcp-server"
image_tag                  = "latest"
cognito_user_pool_id       = "us-east-1_d6Q1t6bUi"
cognito_client_id          = "5ro2o67qejkbgd6857ee521r93"
bedrock_guardrail_id       = "rur8hed14y0b"
bedrock_guardrail_version  = "1"

# Networking
vpc_cidr                   = "10.0.0.0/16"

# Compute
cpu                        = 1024
memory                     = 2048
desired_count              = 2
min_capacity               = 2
max_capacity               = 10

# Features
enable_waf                 = true
enable_monitoring          = true
enable_xray_tracing        = false
cloudwatch_alarms_enabled  = true

# Optional: Custom domain
# domain_name                = "mcp.example.com"
# certificate_arn            = "arn:aws:acm:us-east-1:xxx:certificate/xxx"

# Tags
tags = {
  Owner   = "platform-team"
  CostCenter = "engineering"
}
```

### 4. State Management Setup (Optional but Recommended)

Create S3 bucket and DynamoDB table for state locking:

```bash
# Create S3 bucket
aws s3api create-bucket \
  --bucket servalsheets-terraform-state \
  --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket servalsheets-terraform-state \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name servalsheets-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

Then uncomment the `backend` block in `versions.tf`.

### 5. Deploy

```bash
# Initialize Terraform
terraform init

# Validate configuration
terraform validate

# Plan deployment
terraform plan -out=tfplan

# Apply changes
terraform apply tfplan
```

### 6. Verify Deployment

```bash
# Get the load balancer DNS
terraform output alb_dns_name

# Test health check
curl -v https://$(terraform output -raw alb_dns_name)/health/live

# Access logs
aws logs tail /ecs/servalsheets-dev --follow

# View dashboard
terraform output cloudwatch_dashboard_url
```

## Variable Reference

### Environment

| Variable      | Type        | Default   | Description                               |
| ------------- | ----------- | --------- | ----------------------------------------- |
| `environment` | string      | -         | Deployment environment (dev/staging/prod) |
| `aws_region`  | string      | us-east-1 | AWS region for resources                  |
| `tags`        | map(string) | {}        | Additional tags for all resources         |

### Container & Image

| Variable | Type | Default | Description |
| `ecr_repository_url` | string | 050752643237.dkr... | ECR repository URL |
| `image_tag` | string | latest | Docker image tag |
| `container_port` | number | 8000 | Container port (AgentCore requires 8000) |

### Compute

| Variable                    | Type   | Default | Description                                         |
| --------------------------- | ------ | ------- | --------------------------------------------------- |
| `cpu`                       | number | 1024    | CPU units (256, 512, 1024, 2048, 4096, 8192, 16384) |
| `memory`                    | number | 2048    | Memory in MB                                        |
| `desired_count`             | number | 2       | Desired number of tasks                             |
| `min_capacity`              | number | 2       | Min tasks for auto-scaling                          |
| `max_capacity`              | number | 10      | Max tasks for auto-scaling                          |
| `target_cpu_utilization`    | number | 70      | Target CPU % for scaling                            |
| `target_memory_utilization` | number | 75      | Target memory % for scaling                         |

### Networking

| Variable               | Type         | Default                        | Description                     |
| ---------------------- | ------------ | ------------------------------ | ------------------------------- |
| `vpc_cidr`             | string       | 10.0.0.0/16                    | VPC CIDR block                  |
| `private_subnet_cidrs` | list(string) | [10.0.1.0/24, 10.0.2.0/24]     | Private subnet CIDRs            |
| `public_subnet_cidrs`  | list(string) | [10.0.101.0/24, 10.0.102.0/24] | Public subnet CIDRs             |
| `domain_name`          | string       | ""                             | Optional domain for Route53/ACM |
| `certificate_arn`      | string       | ""                             | Optional ACM certificate ARN    |

### Monitoring & Alerts

| Variable                    | Type   | Default | Description                                |
| --------------------------- | ------ | ------- | ------------------------------------------ |
| `enable_monitoring`         | bool   | true    | Enable CloudWatch monitoring               |
| `enable_container_insights` | bool   | true    | Enable ECS Container Insights              |
| `cloudwatch_alarms_enabled` | bool   | true    | Enable CloudWatch alarms                   |
| `log_retention_days`        | number | 30      | CloudWatch log retention days              |
| `alarm_sns_topic_arn`       | string | ""      | Optional SNS topic for alarm notifications |
| `high_cpu_threshold`        | number | 85      | CPU alarm threshold (%)                    |
| `high_memory_threshold`     | number | 85      | Memory alarm threshold (%)                 |
| `error_rate_threshold`      | number | 5       | 5xx error rate threshold (%)               |

### Security

| Variable                 | Type   | Default      | Description            |
| ------------------------ | ------ | ------------ | ---------------------- |
| `enable_waf`             | bool   | true         | Enable AWS WAF         |
| `enable_xray_tracing`    | bool   | false        | Enable X-Ray tracing   |
| `secrets_manager_prefix` | string | servalsheets | Secrets Manager prefix |

### Health Checks

| Variable                           | Type   | Default      | Description                     |
| ---------------------------------- | ------ | ------------ | ------------------------------- |
| `health_check_path`                | string | /health/live | Health check path               |
| `health_check_interval`            | number | 30           | Health check interval (seconds) |
| `health_check_timeout`             | number | 5            | Health check timeout (seconds)  |
| `health_check_healthy_threshold`   | number | 2            | Consecutive successful checks   |
| `health_check_unhealthy_threshold` | number | 3            | Consecutive failed checks       |

### Integration

| Variable                    | Type   | Default                    | Description               |
| --------------------------- | ------ | -------------------------- | ------------------------- |
| `cognito_user_pool_id`      | string | us-east-1_d6Q1t6bUi        | Cognito User Pool ID      |
| `cognito_client_id`         | string | 5ro2o67qejkbgd6857ee521r93 | Cognito Client ID         |
| `bedrock_guardrail_id`      | string | rur8hed14y0b               | Bedrock Guardrail ID      |
| `bedrock_guardrail_version` | string | 1                          | Bedrock Guardrail version |

## Outputs

Key outputs available after deployment:

```bash
# Access the service
terraform output alb_dns_name
terraform output service_url

# Infrastructure details
terraform output ecs_cluster_arn
terraform output ecs_service_arn
terraform output vpc_id

# Monitoring
terraform output cloudwatch_log_group_name
terraform output cloudwatch_dashboard_url

# All deployment information
terraform output deployment_info
```

## Cost Estimates

Based on typical production deployment (2-10 tasks, us-east-1):

- **ECS Fargate (ARM64 Graviton)**: ~$0.25-$1.25/day per task
- **Application Load Balancer**: ~$18/month + data transfer
- **NAT Gateway**: ~$32/month + data transfer
- **CloudWatch Logs**: ~$0.50/GB ingested
- **CloudWatch Monitoring**: ~$10/month for dashboard + alarms
- **AWS WAF**: ~$5/month + $0.50 per million requests

**Monthly estimate (2-5 tasks, normal traffic)**: ~$150-$250

## Security Considerations

1. **Network Isolation**: Private subnets with NAT gateway for egress
2. **WAF**: Rate limiting (2000 req/5min per IP), SQL injection protection, IP reputation
3. **Secrets Manager**: All sensitive configuration encrypted with KMS
4. **IAM**: Minimal permissions with separate task execution and task roles
5. **Security Groups**: Explicit allow-lists, no broad 0.0.0.0/0 ingress to containers
6. **HTTPS Only**: HTTP redirects to HTTPS, modern TLS 1.2+
7. **Monitoring**: Comprehensive CloudWatch alarms for anomalies

### Additional Hardening Recommendations

- Enable VPC Flow Logs for network monitoring
- Use AWS Config for compliance checking
- Enable GuardDuty for threat detection
- Implement service-to-service authentication
- Use private ECR repository with image scanning
- Enable ECS Exec for container debugging (with CloudTrail logging)

## Maintenance

### Update Task Definition

```bash
# 1. Update image_tag in terraform.tfvars
image_tag = "v2.0.1"

# 2. Plan and apply
terraform plan -out=tfplan
terraform apply tfplan

# 3. The ECS service will gradually roll out new tasks
# Check progress with:
aws ecs describe-services \
  --cluster servalsheets-dev-cluster \
  --services servalsheets-dev-service
```

### Scale Tasks Manually

```bash
# Update desired_count (auto-scaling will manage it)
terraform apply -var="desired_count=5"
```

### Update Auto-scaling Thresholds

```bash
terraform apply \
  -var="target_cpu_utilization=80" \
  -var="max_capacity=15"
```

### View Logs

```bash
# CloudWatch CLI
aws logs tail /ecs/servalsheets-dev --follow

# Or use CloudWatch Insights
aws logs start-query \
  --log-group-name /ecs/servalsheets-dev \
  --start-time 1609459200 \
  --end-time 1609545600 \
  --query-string 'fields @timestamp, @message | filter @message like /ERROR/'
```

## Troubleshooting

### Tasks Not Starting

```bash
# Check task definition
aws ecs describe-task-definition \
  --task-definition servalsheets-dev

# Check service events
aws ecs describe-services \
  --cluster servalsheets-dev-cluster \
  --services servalsheets-dev-service

# Check CloudWatch logs
aws logs tail /ecs/servalsheets-dev --follow
```

### Health Checks Failing

```bash
# Verify health check path responds
curl -v https://<alb-dns>/health/live

# Check container logs for startup errors
aws logs tail /ecs/servalsheets-dev --since 1m

# Verify security group allows ALB → ECS traffic
aws ec2 describe-security-groups \
  --group-ids <ecs-sg-id>
```

### High CPU/Memory Usage

```bash
# Check CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=servalsheets-dev-service \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 300 \
  --statistics Average,Maximum

# Check container performance
docker stats $(aws ecs list-tasks --cluster servalsheets-dev-cluster)
```

### WAF Blocking Legitimate Traffic

```bash
# Check WAF logs
aws logs tail /aws/waf/servalsheets-dev --follow

# Temporarily disable WAF for testing
terraform apply -var="enable_waf=false"

# Update WAF rules as needed, then re-enable
terraform apply -var="enable_waf=true"
```

## Cleanup

```bash
# Destroy all resources (careful!)
terraform destroy

# Or target specific resources
terraform destroy -target aws_ecs_service.app
```

## Advanced Usage

### Custom Application Configuration

Add environment variables in `main.tf` task definition:

```hcl
environment = [
  { name = "CUSTOM_SETTING", value = "value" },
  # ... more vars
]
```

### Integration with Existing Infrastructure

Use data sources to reference existing resources:

```hcl
data "aws_vpc" "existing" {
  id = var.existing_vpc_id
}

data "aws_subnets" "existing" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.existing.id]
  }
}
```

### Multi-Region Deployment

Create separate directories for each region:

```bash
infra/terraform/
├── us-east-1/
│   ├── terraform.tfvars
│   └── (symlink to main module files)
└── eu-west-1/
    ├── terraform.tfvars
    └── (symlink to main module files)
```

## Debugging

Enable Terraform debug logging:

```bash
export TF_LOG=DEBUG
export TF_LOG_PATH=/tmp/terraform.log
terraform plan
```

View AWS API logs:

```bash
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=servalsheets-dev
```

## Contributing

When updating this module:

1. Run `terraform validate` to check syntax
2. Run `terraform fmt` to format code
3. Test in `dev` environment first
4. Update README.md with any new variables
5. Tag release with semantic versioning

## License

This Terraform module is part of the ServalSheets project. See LICENSE file for details.

## Support

For issues or questions:

- Check CloudWatch logs: `/ecs/servalsheets-{env}`
- Check WAF logs: `/aws/waf/servalsheets-{env}`
- Review deployment metrics in CloudWatch Dashboard
- Consult AWS documentation for ECS Fargate and Bedrock
