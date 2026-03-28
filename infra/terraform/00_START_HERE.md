# 🚀 ServalSheets MCP Server - AWS Deployment

Welcome! This directory contains a **production-ready Terraform module** for deploying ServalSheets MCP server to AWS AgentCore Runtime.

## ⚡ 60-Second Quick Start

```bash
# 1. Make script executable
chmod +x QUICK_START.sh

# 2. Run automated setup (creates all secrets, generates config)
./QUICK_START.sh dev us-east-1

# 3. Review the plan, then apply
terraform apply tfplan

# 4. Wait ~10-15 minutes for deployment
# 5. Verify it's running
terraform output service_url
curl "$(terraform output -raw health_check_url)"
```

## 📚 What's Included

This module deploys:

- **Networking**: VPC with 2 AZs, public/private subnets, NAT gateways
- **Compute**: ECS Fargate on ARM64 (Graviton) with auto-scaling (2-10 tasks)
- **Load Balancing**: Application Load Balancer with HTTPS and health checks
- **Security**: AWS WAF (rate limiting + SQL injection protection), Security groups, IAM roles
- **Monitoring**: CloudWatch logs, dashboard, alarms for CPU/memory/errors
- **Integration**: Secrets Manager for Cognito/Bedrock configs

**Total Cost**: ~$80-150/month for development, ~$150-250/month for production

## 📖 Documentation Guide

Choose your path:

### 🏃 I Want to Deploy NOW

1. Run: `./QUICK_START.sh dev us-east-1`
2. Read: The generated plan
3. Run: `terraform apply tfplan`
4. Done! Check: `make health-check`

### 📖 I Want to Understand First

1. Read: [README.md](./README.md) (15 min) - Architecture, features, costs
2. Read: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) (20 min) - Step-by-step instructions
3. Then deploy

### 🔧 I'm a DevOps Engineer

1. Review: [variables.tf](./variables.tf) - All 40+ configuration options
2. Review: [main.tf](./main.tf) - Infrastructure code
3. Check: [Makefile](./Makefile) - 30+ useful commands
4. Deploy with your standard process

### 🏭 I Need to Deploy to Production

1. Read: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#deploy-to-production) - Full section
2. Prepare: Pre-deployment checklist
3. Review: Security considerations in [README.md](./README.md#security-considerations)
4. Deploy with change control

### 🆘 Something's Not Working

1. Check: [README.md#troubleshooting](./README.md#troubleshooting)
2. Check: [DEPLOYMENT_GUIDE.md#troubleshooting](./DEPLOYMENT_GUIDE.md#troubleshooting)
3. Run: `make logs` to see what's happening
4. Check: `make ecs-describe` to see service status

## 📋 File Quick Reference

| File                                                   | Read When                          |
| ------------------------------------------------------ | ---------------------------------- |
| [INDEX.md](./INDEX.md)                                 | You want a navigation map          |
| [README.md](./README.md)                               | You want architecture and features |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)           | You're ready to deploy             |
| [terraform.tfvars.example](./terraform.tfvars.example) | You're configuring variables       |
| [variables.tf](./variables.tf)                         | You want full variable reference   |
| [Makefile](./Makefile)                                 | You need useful commands           |
| [QUICK_START.sh](./QUICK_START.sh)                     | You want automated setup           |

## ✅ Pre-Deployment Checklist

Before you start:

- [ ] **AWS Account**: Have access to create resources
- [ ] **AWS CLI**: Installed and configured (`aws sts get-caller-identity`)
- [ ] **Terraform**: Version >= 1.5 (`terraform version`)
- [ ] **Docker Image**: Pushed to ECR at `050752643237.dkr.ecr.us-east-1.amazonaws.com/servalsheets/mcp-server`
- [ ] **AWS Region**: Set to `us-east-1` (or modify if needed)
- [ ] **Optional**: jq installed (`brew install jq`) for JSON processing

## 🎯 Three Ways to Deploy

### Option 1: Automated (Easiest)

```bash
chmod +x QUICK_START.sh
./QUICK_START.sh dev us-east-1
terraform apply tfplan
```

### Option 2: Manual (Most Control)

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your settings
terraform init
terraform plan
terraform apply
```

### Option 3: Make Commands (DevOps)

```bash
make init
make validate
make plan
make apply
make health-check  # Verify
```

## 🔧 Common Commands After Deployment

```bash
# Check service status
make ecs-describe

# View logs
make logs

# See key metrics
make metrics

# Open monitoring dashboard
make dashboard

# Test health endpoint
make health-check

# Get service URL
make output | grep service_url

# Scale to 5 tasks
terraform apply -var="desired_count=5"

# Update Docker image
terraform apply -var="image_tag=v1.0.1"

# Destroy (caution!)
terraform destroy
```

## 💰 Cost Breakdown

| Component             | Cost/Month  |
| --------------------- | ----------- |
| ECS Fargate (2 tasks) | $15-25      |
| ALB                   | $18         |
| NAT Gateway (2)       | $32         |
| CloudWatch            | $5-10       |
| WAF                   | $1-2        |
| Data Transfer         | ~$5         |
| **Total Dev**         | **~$75-92** |

Production (3-5 tasks): $150-250/month

## 🔐 Security Out of the Box

✅ Private ECS tasks (no direct internet access)
✅ AWS WAF with rate limiting & SQL injection protection
✅ HTTPS/TLS 1.2+ (HTTP auto-redirects)
✅ Secrets Manager for sensitive configs
✅ Granular IAM roles with minimal permissions
✅ Security groups with explicit allow-lists
✅ CloudWatch logging and monitoring
✅ VPC isolation across 2 availability zones

## 🚨 Important Notes

1. **State File**: Terraform stores state. Keep it safe:
   - Use remote S3 backend (see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#step-3-set-up-remote-state-management))
   - Never commit `terraform.tfstate` to git
   - `.gitignore` already configured to prevent this

2. **Costs**: This is a **production-grade** setup with HA. To reduce costs:
   - Set `desired_count = 1` for development
   - Set `enable_waf = false` (but not recommended for prod)
   - Use smaller `cpu` and `memory` values

3. **Domain Names**: By default, uses ALB DNS name. To use a custom domain:
   - Prepare an ACM certificate in us-east-1
   - Set `domain_name` and `certificate_arn` in `terraform.tfvars`
   - Configure Route53 to point to ALB

## 📞 Need Help?

| Question                 | Answer In                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| "How do I deploy?"       | [QUICK_START.sh](./QUICK_START.sh) or [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)       |
| "What gets created?"     | [README.md](./README.md) Architecture section                                            |
| "How do I configure it?" | [variables.tf](./variables.tf) or [terraform.tfvars.example](./terraform.tfvars.example) |
| "How do I monitor it?"   | [Makefile](./Makefile) or [README.md](./README.md) Maintenance section                   |
| "It's not working"       | [README.md#troubleshooting](./README.md#troubleshooting)                                 |
| "What are the costs?"    | [README.md](./README.md#cost-estimates)                                                  |

## 🎬 Next Steps

1. **Now**: Run `./QUICK_START.sh dev us-east-1`
2. **Then**: Review the terraform plan
3. **Then**: Run `terraform apply tfplan`
4. **Finally**: Run `make health-check` to verify

---

## 📊 Module Statistics

- **Files**: 14 (7 Terraform files, 4 docs, 2 automation, 1 config)
- **Infrastructure Code**: 1,863 lines
- **Documentation**: 1,927 lines
- **Total Size**: 156 KB
- **Resources Created**: 40+ (VPC, subnets, ALB, ECS, CloudWatch, IAM, WAF)
- **Deployment Time**: 10-15 minutes
- **Status**: ✅ Production-Ready

---

**Ready?** → Run `chmod +x QUICK_START.sh && ./QUICK_START.sh dev us-east-1`

**Questions?** → See [INDEX.md](./INDEX.md) for navigation

**Want details?** → Read [README.md](./README.md)

---

**Created**: 2024-01-15 | **Version**: 1.0 | **Status**: Production-Ready
