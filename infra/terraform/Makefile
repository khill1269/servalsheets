.PHONY: help init validate plan apply destroy fmt fmt-check init-state state-list state-show logs dashboard health-check clean

# Colors for output
BLUE=\033[0;34m
GREEN=\033[0;32m
YELLOW=\033[0;33m
RED=\033[0;31m
NC=\033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)ServalSheets Terraform Module - Available Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-25s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Configuration:$(NC)"
	@echo "  Copy terraform.tfvars.example to terraform.tfvars and customize"
	@echo "  Set AWS credentials via AWS CLI or environment variables"
	@echo ""

init: ## Initialize Terraform working directory
	@echo "$(BLUE)Initializing Terraform...$(NC)"
	terraform init
	@echo "$(GREEN)✓ Terraform initialized$(NC)"

validate: ## Validate Terraform configuration
	@echo "$(BLUE)Validating configuration...$(NC)"
	terraform validate
	@echo "$(GREEN)✓ Configuration is valid$(NC)"

fmt: ## Format Terraform files
	@echo "$(BLUE)Formatting Terraform files...$(NC)"
	terraform fmt -recursive .
	@echo "$(GREEN)✓ Files formatted$(NC)"

fmt-check: ## Check Terraform formatting without modifying files
	@echo "$(BLUE)Checking Terraform formatting...$(NC)"
	terraform fmt -check -recursive .

plan: ## Show what Terraform will change
	@echo "$(BLUE)Planning Terraform changes...$(NC)"
	terraform plan -out=tfplan
	@echo "$(GREEN)✓ Plan saved to tfplan$(NC)"
	@echo ""
	@echo "$(YELLOW)Next step: run 'make apply'$(NC)"

plan-destroy: ## Plan resource destruction
	@echo "$(RED)Planning destruction of all resources...$(NC)"
	terraform plan -destroy -out=tfplan
	@echo "$(YELLOW)Review the plan above carefully$(NC)"

apply: ## Apply Terraform changes (requires tfplan file from 'make plan')
	@echo "$(BLUE)Applying Terraform changes...$(NC)"
	@if [ -f tfplan ]; then \
		terraform apply tfplan; \
		rm tfplan; \
		echo "$(GREEN)✓ Changes applied$(NC)"; \
	else \
		echo "$(RED)✗ No tfplan file found. Run 'make plan' first$(NC)"; \
		exit 1; \
	fi

apply-force: ## Apply without plan (dangerous - use with caution)
	@echo "$(RED)⚠ Applying without plan review$(NC)"
	terraform apply -auto-approve
	@echo "$(GREEN)✓ Changes applied$(NC)"

destroy: ## Destroy all Terraform-managed resources (interactive)
	@echo "$(RED)⚠ This will destroy all resources!$(NC)"
	@echo "Type 'yes' to confirm destruction"
	terraform destroy
	@echo "$(GREEN)✓ Destruction complete$(NC)"

destroy-auto: ## Destroy without confirmation (use with extreme caution)
	@echo "$(RED)⚠ Destroying all resources without confirmation!$(NC)"
	terraform destroy -auto-approve
	@echo "$(GREEN)✓ Destruction complete$(NC)"

output: ## Show Terraform outputs
	@echo "$(BLUE)Terraform Outputs:$(NC)"
	@terraform output
	@echo ""

output-json: ## Show Terraform outputs in JSON format
	terraform output -json | jq '.'

state-list: ## List resources in Terraform state
	@echo "$(BLUE)Resources in state:$(NC)"
	terraform state list

state-show: ## Show detailed state for all resources
	@echo "$(BLUE)Terraform State:$(NC)"
	terraform state show

refresh: ## Refresh Terraform state
	@echo "$(BLUE)Refreshing Terraform state...$(NC)"
	terraform refresh
	@echo "$(GREEN)✓ State refreshed$(NC)"

logs: ## Tail ECS logs (requires jq)
	@ENV=$$(terraform output -raw environment 2>/dev/null); \
	if [ -z "$$ENV" ]; then \
		echo "$(RED)✗ Could not determine environment$(NC)"; \
		exit 1; \
	fi; \
	echo "$(BLUE)Tailing logs for /ecs/servalsheets-$$ENV $(NC)"; \
	aws logs tail /ecs/servalsheets-$$ENV --follow

logs-errors: ## Tail error logs only
	@ENV=$$(terraform output -raw environment 2>/dev/null); \
	if [ -z "$$ENV" ]; then \
		echo "$(RED)✗ Could not determine environment$(NC)"; \
		exit 1; \
	fi; \
	echo "$(BLUE)Tailing ERROR logs for /ecs/servalsheets-$$ENV $(NC)"; \
	aws logs tail /ecs/servalsheets-$$ENV --follow --filter-pattern "ERROR"

logs-recent: ## Show recent logs (last 100 lines)
	@ENV=$$(terraform output -raw environment 2>/dev/null); \
	if [ -z "$$ENV" ]; then \
		echo "$(RED)✗ Could not determine environment$(NC)"; \
		exit 1; \
	fi; \
	echo "$(BLUE)Recent logs:$(NC)"; \
	aws logs tail /ecs/servalsheets-$$ENV --max-items 100

dashboard: ## Open CloudWatch dashboard in browser
	@URL=$$(terraform output -raw cloudwatch_dashboard_url 2>/dev/null); \
	if [ -z "$$URL" ]; then \
		echo "$(RED)✗ Dashboard URL not available$(NC)"; \
		exit 1; \
	fi; \
	echo "$(BLUE)Opening dashboard: $$URL$(NC)"; \
	open "$$URL" 2>/dev/null || xdg-open "$$URL" 2>/dev/null || echo "Please open manually: $$URL"

health-check: ## Check service health
	@URL=$$(terraform output -raw health_check_url 2>/dev/null); \
	if [ -z "$$URL" ]; then \
		echo "$(RED)✗ Health check URL not available$(NC)"; \
		exit 1; \
	fi; \
	echo "$(BLUE)Checking health: $$URL $(NC)"; \
	curl -I "$$URL" || echo "$(RED)✗ Health check failed$(NC)"

service-url: ## Print the service URL
	@URL=$$(terraform output -raw service_url 2>/dev/null); \
	if [ -z "$$URL" ]; then \
		echo "$(RED)✗ Service URL not available$(NC)"; \
		exit 1; \
	fi; \
	echo "$(BLUE)Service URL: $(NC)$$URL"

ecs-describe: ## Describe ECS service details
	@ENV=$$(terraform output -raw environment 2>/dev/null); \
	CLUSTER=$$(terraform output -raw ecs_cluster_name 2>/dev/null); \
	SERVICE=$$(terraform output -raw ecs_service_name 2>/dev/null); \
	if [ -z "$$ENV" ] || [ -z "$$CLUSTER" ] || [ -z "$$SERVICE" ]; then \
		echo "$(RED)✗ Could not determine ECS details$(NC)"; \
		exit 1; \
	fi; \
	echo "$(BLUE)ECS Service Details:$(NC)"; \
	aws ecs describe-services --cluster $$CLUSTER --services $$SERVICE | jq '.services[0] | {taskCount: .runningCount, desiredCount: .desiredCount, deployments: .deployments}'

metrics: ## Show current ECS metrics
	@CLUSTER=$$(terraform output -raw ecs_cluster_name 2>/dev/null); \
	SERVICE=$$(terraform output -raw ecs_service_name 2>/dev/null); \
	if [ -z "$$CLUSTER" ] || [ -z "$$SERVICE" ]; then \
		echo "$(RED)✗ Could not determine ECS details$(NC)"; \
		exit 1; \
	fi; \
	echo "$(BLUE)ECS Metrics (last 1 hour):$(NC)"; \
	aws cloudwatch get-metric-statistics \
		--namespace AWS/ECS \
		--metric-name CPUUtilization \
		--dimensions Name=ServiceName,Value=$$SERVICE Name=ClusterName,Value=$$CLUSTER \
		--start-time $$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
		--end-time $$(date -u +%Y-%m-%dT%H:%M:%S) \
		--period 300 \
		--statistics Average,Maximum | jq '.Datapoints | sort_by(.Timestamp) | reverse | .[0:5]'

cost-estimate: ## Estimate monthly costs
	@echo "$(BLUE)Cost Estimate:$(NC)"
	@echo "  ECS Fargate (ARM64): ~\$$0.25-\$$1.25/day per task"
	@echo "  ALB: ~\$$18/month"
	@echo "  NAT Gateway: ~\$$32/month"
	@echo "  CloudWatch: ~\$$10/month"
	@echo "  WAF: ~\$$5/month"
	@echo "  Data transfer: variable"
	@echo ""
	@echo "$(YELLOW)Total estimate for typical setup: \$$150-\$$250/month$(NC)"

clean: ## Clean Terraform cache and temporary files
	@echo "$(BLUE)Cleaning up...$(NC)"
	rm -rf .terraform
	rm -f tfplan terraform.tfstate*
	rm -f .terraform.lock.hcl
	@echo "$(GREEN)✓ Cleanup complete$(NC)"

test: validate fmt-check ## Run validation checks
	@echo "$(GREEN)✓ All checks passed$(NC)"

version: ## Show Terraform version
	terraform version

console: ## Open Terraform console for debugging
	@echo "$(BLUE)Opening Terraform console...$(NC)"
	@echo "$(YELLOW)Exit with 'exit' command$(NC)"
	terraform console

reformat-state: ## Reformat state file (use if corrupted)
	@echo "$(YELLOW)⚠ Rewriting state file$(NC)"
	terraform state rm $$(terraform state list | head -1)
	terraform apply -auto-approve
	@echo "$(GREEN)✓ State rewritten$(NC)"

init-state: ## Initialize S3 and DynamoDB for state management
	@echo "$(BLUE)Setting up remote state management...$(NC)"
	aws s3api create-bucket --bucket servalsheets-terraform-state --region us-east-1 2>/dev/null || true
	aws s3api put-bucket-versioning --bucket servalsheets-terraform-state --versioning-configuration Status=Enabled
	aws dynamodb create-table --table-name servalsheets-terraform-locks --attribute-definitions AttributeName=LockID,AttributeType=S --key-schema AttributeName=LockID,KeyType=HASH --billing-mode PAY_PER_REQUEST 2>/dev/null || true
	@echo "$(GREEN)✓ State management initialized$(NC)"
	@echo "$(YELLOW)Uncomment the backend block in versions.tf to enable$(NC)"

docs: ## Generate terraform documentation (requires terraform-docs)
	@which terraform-docs > /dev/null || (echo "$(RED)✗ terraform-docs not installed$(NC)" && exit 1)
	@echo "$(BLUE)Generating documentation...$(NC)"
	terraform-docs markdown table --recursive . > TERRAFORM_DOCS.md
	@echo "$(GREEN)✓ Documentation generated in TERRAFORM_DOCS.md$(NC)"

# Default target
.DEFAULT_GOAL := help
