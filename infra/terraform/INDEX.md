# ServalSheets MCP Server - AWS Terraform Module

**Status**: ✅ Production-Ready | **Version**: 1.0 | **Size**: 148 KB | **Files**: 13

A complete, battle-tested Terraform module for deploying ServalSheets MCP server on AWS AgentCore Runtime with ECS Fargate.

## 📋 Documentation Map

Start here based on your role:

### 👨‍💼 For Product Managers / Decision Makers

- **Read first**: [README.md](./README.md) - Architecture, features, costs
- **Then**: Cost Estimates section to understand pricing

### 👨‍💻 For Developers (First-time Deploy)

- **Read first**: [QUICK_START.sh](./QUICK_START.sh) - Run the automated setup
- **Read second**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Dev environment section
- **Reference**: [terraform.tfvars.example](./terraform.tfvars.example) - Configuration

### 🏗️ For DevOps / Infrastructure Engineers

- **Read first**: [README.md](./README.md) - Complete overview
- **Read second**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - All sections
- **Reference**: [variables.tf](./variables.tf) - All 40+ configuration options
- **Maintenance**: [Makefile](./Makefile) - 30+ useful commands

### 🚀 For Deployment to Production

1. [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - "Deploy to Production" section
2. [variables.tf](./variables.tf) - Production variable requirements
3. [README.md](./README.md) - "Security Considerations" section
4. [Makefile](./Makefile) - Deploy commands

### 🔧 For Troubleshooting / Debugging

- [README.md](./README.md#troubleshooting) - Common issues and fixes
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#troubleshooting) - Detailed troubleshooting
- [Makefile](./Makefile) - Diagnostic commands

## 📁 File Organization

### Core Infrastructure (7 files, ~55 KB)

| File                             | Size   | Purpose                              |
| -------------------------------- | ------ | ------------------------------------ |
| [main.tf](./main.tf)             | 14 KB  | VPC, subnets, ALB, ECS, auto-scaling |
| [variables.tf](./variables.tf)   | 6.3 KB | 40+ input variables with validation  |
| [outputs.tf](./outputs.tf)       | 5.7 KB | 30+ outputs for resource details     |
| [iam.tf](./iam.tf)               | 6.0 KB | IAM roles and policies               |
| [monitoring.tf](./monitoring.tf) | 8.8 KB | CloudWatch logs, dashboard, alarms   |
| [waf.tf](./waf.tf)               | 6.8 KB | AWS WAF rules and logging            |
| [versions.tf](./versions.tf)     | 603 B  | Terraform and provider versions      |

### Configuration (2 files, ~7.4 KB)

| File                                                   | Size   | Purpose                             |
| ------------------------------------------------------ | ------ | ----------------------------------- |
| [terraform.tfvars.example](./terraform.tfvars.example) | 3.7 KB | Example config for all environments |
| [.gitignore](./.gitignore)                             | 967 B  | Prevent committing secrets/state    |

### Documentation (4 files, ~68 KB)

| File                                         | Size      | Purpose                              |
| -------------------------------------------- | --------- | ------------------------------------ |
| [README.md](./README.md)                     | 17 KB     | Quick start, architecture, reference |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | 20 KB     | Step-by-step deployment procedures   |
| [FILES_SUMMARY.md](./FILES_SUMMARY.md)       | 11 KB     | Complete file manifest               |
| [INDEX.md](./INDEX.md)                       | This file | Navigation and quick reference       |

### Automation (2 files, ~17 KB)

| File                               | Type  | Purpose                  |
| ---------------------------------- | ----- | ------------------------ |
| [Makefile](./Makefile)             | Shell | 30+ useful make commands |
| [QUICK_START.sh](./QUICK_START.sh) | Bash  | Automated setup script   |

## 🚀 Quick Start (Choose One)

### Option A: Automated (Recommended)

```bash
chmod +x QUICK_START.sh
./QUICK_START.sh dev us-east-1
terraform apply tfplan
```

### Option B: Manual

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars
terraform init
terraform plan
terraform apply
```

### Option C: Using Make

```bash
make help           # Show all commands
make init          # Initialize
make plan          # Show changes
make apply         # Deploy
make health-check  # Verify
```

## 📊 What Gets Deployed

### Network

- VPC with 2 availability zones
- Public subnets with NAT gateways
- Private subnets for ECS tasks
- Security groups with least-privilege rules

### Compute

- ECS Cluster with Container Insights
- ECS Fargate Service (ARM64/Graviton)
- Auto-scaling (2-10 tasks, CPU/memory-based)
- Task definition with 1024 CPU, 2048 MB memory

### Load Balancing

- Application Load Balancer
- Target group with health checks
- HTTP → HTTPS redirect
- ACM certificate (custom or self-signed)

### Security

- AWS WAF with 6 rules
- Rate limiting (2000 req/5min per IP)
- SQL injection protection
- Secrets Manager integration

### Monitoring

- CloudWatch Log Group
- CloudWatch Dashboard (4 widgets)
- 6 CloudWatch Alarms (CPU, memory, errors, etc.)
- SNS notifications (optional)

## 💰 Cost Estimate

| Component       | Dev        | Staging    | Prod        |
| --------------- | ---------- | ---------- | ----------- |
| ECS Fargate     | $5-15      | $15-30     | $30-60      |
| ALB             | $18        | $18        | $18         |
| NAT Gateway     | $32        | $32        | $32         |
| CloudWatch      | $5-10      | $5-10      | $10-15      |
| WAF             | $1-2       | $2-5       | $5-10       |
| **Total/Month** | **$61-77** | **$72-95** | **$95-135** |

## ✅ Pre-Deployment Checklist

- [ ] AWS account access with appropriate permissions
- [ ] Terraform >= 1.5 installed
- [ ] AWS CLI >= 2.13 installed (and configured)
- [ ] Docker image pushed to ECR
- [ ] Secrets Manager secrets created (or use QUICK_START.sh)
- [ ] S3 bucket for Terraform state (optional but recommended)
- [ ] ACM certificate prepared (optional, uses self-signed by default)

## 🔐 Security Features

✅ **Network**: Private subnets, NAT gateways, VPC isolation
✅ **Access Control**: Security groups with explicit allow-lists
✅ **DDoS Protection**: AWS WAF with rate limiting and managed rules
✅ **Encryption**: Secrets Manager with KMS encryption
✅ **IAM**: Granular roles with minimal permissions
✅ **Logging**: CloudWatch with 30-90 day retention
✅ **HTTPS**: TLS 1.2+, auto-redirect from HTTP
✅ **Monitoring**: CloudWatch alarms for anomalies

## 🛠️ Common Operations

### Deploy

```bash
terraform apply tfplan
```

### Check Status

```bash
make ecs-describe        # ECS service status
make health-check        # Health endpoint
make logs                # View logs
make dashboard           # Open monitoring dashboard
```

### Scale Up/Down

```bash
terraform apply -var="desired_count=5"
```

### Update Image

```bash
terraform apply -var="image_tag=v1.0.1"
```

### Destroy (Caution!)

```bash
terraform destroy
```

## 📞 Support

- **Getting Started**: See [README.md](./README.md)
- **Deployment Issues**: See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#troubleshooting)
- **Configuration Options**: See [variables.tf](./variables.tf)
- **Quick Commands**: Run `make help`

## 🔗 Related Resources

- **ServalSheets Code**: `/mnt/servalsheets`
- **Project Docs**: `docs/development/CODEBASE_CONTEXT.md`
- **MCP Spec**: `https://modelcontextprotocol.io`
- **AWS ECS**: `https://docs.aws.amazon.com/ecs/`
- **Terraform Docs**: `https://www.terraform.io/docs/`

## 📝 Version History

| Version | Date       | Changes                    |
| ------- | ---------- | -------------------------- |
| 1.0     | 2024-01-15 | Initial production release |

## 🎯 Next Steps

1. **Start Here**: Run [QUICK_START.sh](./QUICK_START.sh)
2. **Review Plan**: Check `terraform.tfvars` and `tfplan`
3. **Deploy**: Run `terraform apply tfplan`
4. **Verify**: Run `make health-check`
5. **Monitor**: Open dashboard with `make dashboard`

---

**Ready to deploy?** → Run `./QUICK_START.sh dev us-east-1`

**Questions?** → Check [README.md](./README.md) or [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

**Need to troubleshoot?** → See [README.md#troubleshooting](./README.md#troubleshooting)
