#!/bin/bash

# ServalSheets Terraform Quick Start Script
# This script automates the initial setup and deployment process

set -e

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-dev}"
AWS_REGION="${2:-us-east-1}"
SECRETS_PREFIX="servalsheets"

echo -e "${BLUE}ServalSheets Terraform Quick Start${NC}"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo ""

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}Checking prerequisites...${NC}"

    local missing=0

    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        echo -e "${RED}✗ Terraform not found${NC}"
        missing=1
    else
        echo -e "${GREEN}✓ Terraform $(terraform version -json | jq -r '.terraform_version')${NC}"
    fi

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}✗ AWS CLI not found${NC}"
        missing=1
    else
        echo -e "${GREEN}✓ AWS CLI $(aws --version | cut -d' ' -f1)${NC}"
    fi

    # Check jq
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}⚠ jq not found (optional but recommended)${NC}"
    else
        echo -e "${GREEN}✓ jq installed${NC}"
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}✗ AWS credentials not configured${NC}"
        echo "Run: aws configure"
        missing=1
    else
        ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
        USER=$(aws sts get-caller-identity --query Arn --output text)
        echo -e "${GREEN}✓ AWS credentials configured${NC}"
        echo "  Account: $ACCOUNT"
        echo "  User: $USER"
    fi

    if [ $missing -eq 1 ]; then
        echo -e "${RED}Please install missing prerequisites${NC}"
        exit 1
    fi

    echo ""
}

# Create Secrets Manager secrets
create_secrets() {
    echo -e "${BLUE}Creating Secrets Manager secrets...${NC}"

    # Cognito configuration
    echo -n "Creating Cognito config... "
    if aws secretsmanager describe-secret --secret-id "$SECRETS_PREFIX/cognito-config" &> /dev/null; then
        echo -e "${YELLOW}exists${NC}"
    else
        aws secretsmanager create-secret \
            --name "$SECRETS_PREFIX/cognito-config" \
            --description "Cognito User Pool configuration" \
            --secret-string '{
                "user_pool_id": "us-east-1_d6Q1t6bUi",
                "client_id": "5ro2o67qejkbgd6857ee521r93",
                "region": "us-east-1"
            }' \
            --region "$AWS_REGION" > /dev/null 2>&1
        echo -e "${GREEN}created${NC}"
    fi

    # Bedrock configuration
    echo -n "Creating Bedrock config... "
    if aws secretsmanager describe-secret --secret-id "$SECRETS_PREFIX/bedrock-config" &> /dev/null; then
        echo -e "${YELLOW}exists${NC}"
    else
        aws secretsmanager create-secret \
            --name "$SECRETS_PREFIX/bedrock-config" \
            --description "Bedrock Guardrail configuration" \
            --secret-string '{
                "guardrail_id": "rur8hed14y0b",
                "guardrail_version": "1",
                "region": "us-east-1"
            }' \
            --region "$AWS_REGION" > /dev/null 2>&1
        echo -e "${GREEN}created${NC}"
    fi

    # ECR configuration
    echo -n "Creating ECR config... "
    if aws secretsmanager describe-secret --secret-id "$SECRETS_PREFIX/ecr-config" &> /dev/null; then
        echo -e "${YELLOW}exists${NC}"
    else
        aws secretsmanager create-secret \
            --name "$SECRETS_PREFIX/ecr-config" \
            --description "ECR registry configuration" \
            --secret-string '{
                "registry": "050752643237.dkr.ecr.us-east-1.amazonaws.com",
                "repository": "servalsheets/mcp-server"
            }' \
            --region "$AWS_REGION" > /dev/null 2>&1
        echo -e "${GREEN}created${NC}"
    fi

    echo ""
}

# Initialize S3 and DynamoDB for state management
setup_remote_state() {
    echo -e "${BLUE}Setting up remote state management...${NC}"

    # Create S3 bucket
    echo -n "Creating S3 bucket for state... "
    if aws s3 ls "s3://servalsheets-terraform-state" &> /dev/null; then
        echo -e "${YELLOW}exists${NC}"
    else
        aws s3api create-bucket \
            --bucket servalsheets-terraform-state \
            --region "$AWS_REGION" > /dev/null 2>&1
        aws s3api put-bucket-versioning \
            --bucket servalsheets-terraform-state \
            --versioning-configuration Status=Enabled > /dev/null 2>&1
        echo -e "${GREEN}created${NC}"
    fi

    # Create DynamoDB table
    echo -n "Creating DynamoDB table for state locking... "
    if aws dynamodb describe-table --table-name servalsheets-terraform-locks &> /dev/null 2>&1; then
        echo -e "${YELLOW}exists${NC}"
    else
        aws dynamodb create-table \
            --table-name servalsheets-terraform-locks \
            --attribute-definitions AttributeName=LockID,AttributeType=S \
            --key-schema AttributeName=LockID,KeyType=HASH \
            --billing-mode PAY_PER_REQUEST \
            --region "$AWS_REGION" > /dev/null 2>&1
        echo -e "${GREEN}created${NC}"
    fi

    echo ""
}

# Create terraform.tfvars
create_tfvars() {
    echo -e "${BLUE}Creating terraform.tfvars...${NC}"

    if [ -f terraform.tfvars ]; then
        echo -e "${YELLOW}terraform.tfvars already exists, skipping${NC}"
        echo ""
        return
    fi

    cat > terraform.tfvars << EOF
# ServalSheets Terraform Configuration
# Generated by QUICK_START.sh on $(date)

environment                = "$ENVIRONMENT"
aws_region                 = "$AWS_REGION"
ecr_repository_url         = "050752643237.dkr.ecr.us-east-1.amazonaws.com/servalsheets/mcp-server"
image_tag                  = "latest"

cognito_user_pool_id       = "us-east-1_d6Q1t6bUi"
cognito_client_id          = "5ro2o67qejkbgd6857ee521r93"
bedrock_guardrail_id       = "rur8hed14y0b"
bedrock_guardrail_version  = "1"

vpc_cidr                   = "10.0.0.0/16"

cpu                        = 1024
memory                     = 2048
desired_count              = $([ "$ENVIRONMENT" = "prod" ] && echo "3" || echo "2")
min_capacity               = $([ "$ENVIRONMENT" = "prod" ] && echo "3" || echo "2")
max_capacity               = $([ "$ENVIRONMENT" = "prod" ] && echo "20" || echo "10")

enable_monitoring          = true
enable_container_insights  = true
cloudwatch_alarms_enabled  = true
enable_waf                 = true
$([ "$ENVIRONMENT" = "prod" ] && echo "log_retention_days         = 90" || echo "log_retention_days         = 30")

tags = {
  Owner       = "platform-team"
  CostCenter  = "engineering"
  Environment = "$ENVIRONMENT"
}
EOF

    echo -e "${GREEN}Created terraform.tfvars${NC}"
    echo -e "${YELLOW}Review and edit as needed:${NC}"
    echo "  nano terraform.tfvars"
    echo ""
}

# Initialize Terraform
init_terraform() {
    echo -e "${BLUE}Initializing Terraform...${NC}"
    terraform init
    echo -e "${GREEN}Terraform initialized${NC}"
    echo ""
}

# Validate configuration
validate_terraform() {
    echo -e "${BLUE}Validating Terraform configuration...${NC}"
    terraform validate
    echo -e "${GREEN}Configuration is valid${NC}"
    echo ""
}

# Format Terraform files
format_terraform() {
    echo -e "${BLUE}Formatting Terraform files...${NC}"
    terraform fmt -recursive .
    echo -e "${GREEN}Files formatted${NC}"
    echo ""
}

# Create and show plan
plan_terraform() {
    echo -e "${BLUE}Creating Terraform plan...${NC}"
    terraform plan -out=tfplan
    echo ""
    echo -e "${YELLOW}Review the plan above${NC}"
    echo -e "${YELLOW}To apply, run:${NC}"
    echo -e "${GREEN}  terraform apply tfplan${NC}"
    echo ""
}

# Main flow
main() {
    check_prerequisites
    create_secrets
    setup_remote_state
    create_tfvars
    init_terraform
    validate_terraform
    format_terraform
    plan_terraform

    echo -e "${GREEN}Quick start complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review terraform.tfvars configuration"
    echo "2. Review the plan output above"
    echo "3. Run: terraform apply tfplan"
    echo ""
    echo "For more information, see:"
    echo "  - README.md for overview"
    echo "  - DEPLOYMENT_GUIDE.md for detailed instructions"
    echo "  - Run 'make help' for useful commands"
}

# Run main function
main
