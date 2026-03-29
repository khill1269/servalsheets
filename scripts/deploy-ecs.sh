#!/usr/bin/env bash

################################################################################
# ServalSheets ECS Deployment Helper Script
#
# Manual deployment utility for deploying ServalSheets MCP server to AWS ECS
# Fargate clusters (staging or production).
#
# Usage:
#   ./scripts/deploy-ecs.sh --environment staging --image-tag sha-abc123
#   ./scripts/deploy-ecs.sh --environment prod --image-tag v1.2.3
#
# Required:
#   - AWS CLI configured with appropriate credentials
#   - jq installed for JSON processing
#   - Proper IAM permissions to describe/update ECS resources
#
# Environment Variables:
#   AWS_REGION        - AWS region (default: us-east-1)
#   AWS_PROFILE       - AWS profile to use (optional)
#   ENABLE_ROLLBACK   - Auto-rollback on failure (default: true)
#
################################################################################

set -euo pipefail

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="050752643237"
ECR_REPOSITORY="servalsheets/mcp-server"
ENABLE_ROLLBACK="${ENABLE_ROLLBACK:-true}"
DEPLOYMENT_TIMEOUT=300  # 5 minutes
STABILITY_CHECK_INTERVAL=10
MAX_RETRIES=3

# Script state
ENVIRONMENT=""
IMAGE_TAG=""
CLUSTER=""
SERVICE=""
SCRIPT_START_TIME=$(date +%s)

################################################################################
# Utility Functions
################################################################################

# Print with timestamp and color
log() {
    local level="$1"
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case "${level}" in
        INFO)
            echo -e "${BLUE}[${timestamp}]${NC} ℹ️  ${message}"
            ;;
        SUCCESS)
            echo -e "${GREEN}[${timestamp}]${NC} ✅ ${message}"
            ;;
        WARNING)
            echo -e "${YELLOW}[${timestamp}]${NC} ⚠️  ${message}"
            ;;
        ERROR)
            echo -e "${RED}[${timestamp}]${NC} ❌ ${message}"
            ;;
        *)
            echo "[${timestamp}] ${message}"
            ;;
    esac
}

# Print section header
section() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  ${1}${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

# Print elapsed time
elapsed_time() {
    local end_time=$(date +%s)
    local duration=$((end_time - SCRIPT_START_TIME))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    printf "%02d:%02d" $minutes $seconds
}

# Verify AWS CLI and required tools
verify_prerequisites() {
    section "Verifying Prerequisites"

    log INFO "Checking for required tools..."

    if ! command -v aws &> /dev/null; then
        log ERROR "AWS CLI not found. Please install it first."
        exit 1
    fi
    log SUCCESS "AWS CLI found"

    if ! command -v jq &> /dev/null; then
        log ERROR "jq not found. Please install it first (brew install jq / apt-get install jq)"
        exit 1
    fi
    log SUCCESS "jq found"

    # Verify AWS credentials
    if ! aws sts get-caller-identity --region "${AWS_REGION}" &> /dev/null; then
        log ERROR "AWS credentials not configured or invalid"
        exit 1
    fi
    log SUCCESS "AWS credentials verified"

    local account_id=$(aws sts get-caller-identity --query Account --output text)
    if [ "${account_id}" != "${AWS_ACCOUNT_ID}" ]; then
        log WARNING "Connected to account ${account_id}, expected ${AWS_ACCOUNT_ID}"
    fi
}

# Parse command-line arguments
parse_arguments() {
    section "Parsing Arguments"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --image-tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            --cluster)
                CLUSTER="$2"
                shift 2
                ;;
            --service)
                SERVICE="$2"
                shift 2
                ;;
            -h|--help)
                print_usage
                exit 0
                ;;
            *)
                log ERROR "Unknown argument: $1"
                print_usage
                exit 1
                ;;
        esac
    done

    # Validate required arguments
    if [ -z "${ENVIRONMENT}" ]; then
        log ERROR "Missing required argument: --environment"
        print_usage
        exit 1
    fi

    if [ -z "${IMAGE_TAG}" ]; then
        log ERROR "Missing required argument: --image-tag"
        print_usage
        exit 1
    fi

    # Set cluster and service based on environment if not explicitly provided
    case "${ENVIRONMENT}" in
        dev|staging)
            CLUSTER="${CLUSTER:-servalsheets-staging}"
            SERVICE="${SERVICE:-servalsheets-staging-service}"
            ;;
        prod|production)
            CLUSTER="${CLUSTER:-servalsheets-prod}"
            SERVICE="${SERVICE:-servalsheets-prod-service}"
            ;;
        *)
            log ERROR "Invalid environment: ${ENVIRONMENT}. Must be dev, staging, or prod"
            exit 1
            ;;
    esac

    log INFO "Environment: ${ENVIRONMENT}"
    log INFO "Image tag: ${IMAGE_TAG}"
    log INFO "Cluster: ${CLUSTER}"
    log INFO "Service: ${SERVICE}"
}

# Print usage information
print_usage() {
    cat << EOF
Usage: $(basename $0) --environment ENVIRONMENT --image-tag TAG [OPTIONS]

Required Arguments:
  --environment ENV     Deployment environment (dev, staging, prod)
  --image-tag TAG       Docker image tag (e.g., sha-abc123, v1.2.3)

Optional Arguments:
  --cluster NAME        ECS cluster name (auto-determined by environment)
  --service NAME        ECS service name (auto-determined by environment)
  -h, --help           Show this help message

Environment Variables:
  AWS_REGION           AWS region (default: us-east-1)
  AWS_PROFILE          AWS profile to use (optional)
  ENABLE_ROLLBACK      Auto-rollback on failure (default: true)

Examples:
  # Deploy sha-abc123 to staging
  ./scripts/deploy-ecs.sh --environment staging --image-tag sha-abc123

  # Deploy v1.2.3 to production
  ./scripts/deploy-ecs.sh --environment prod --image-tag v1.2.3

  # Deploy with custom cluster/service names
  ./scripts/deploy-ecs.sh --environment staging --image-tag sha-abc123 \\
    --cluster my-cluster --service my-service
EOF
}

################################################################################
# ECS Operations
################################################################################

# Get current task definition ARN for the service
get_current_task_def() {
    log INFO "Fetching current task definition..."

    local task_def_arn
    task_def_arn=$(aws ecs describe-services \
        --cluster "${CLUSTER}" \
        --services "${SERVICE}" \
        --region "${AWS_REGION}" \
        --query 'services[0].taskDefinition' \
        --output text)

    if [ -z "${task_def_arn}" ] || [ "${task_def_arn}" == "None" ]; then
        log ERROR "Could not find task definition for service ${SERVICE}"
        return 1
    fi

    echo "${task_def_arn}"
}

# Register new task definition with updated image
register_new_task_def() {
    local current_task_def="$1"
    local new_image="$2"

    log INFO "Registering new task definition with image: ${new_image}"

    local new_task_def_json
    new_task_def_json=$(aws ecs describe-task-definition \
        --task-definition "${current_task_def}" \
        --region "${AWS_REGION}" \
        --query 'taskDefinition' \
        | jq \
            --arg IMAGE "${new_image}" \
            '.containerDefinitions[0].image = $IMAGE |
             del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')

    local new_task_def_arn
    new_task_def_arn=$(echo "${new_task_def_json}" \
        | aws ecs register-task-definition \
            --region "${AWS_REGION}" \
            --cli-input-json file:///dev/stdin \
        | jq -r '.taskDefinition.taskDefinitionArn')

    if [ -z "${new_task_def_arn}" ] || [ "${new_task_def_arn}" == "null" ]; then
        log ERROR "Failed to register new task definition"
        return 1
    fi

    log SUCCESS "Registered new task definition: ${new_task_def_arn}"
    echo "${new_task_def_arn}"
}

# Update ECS service with new task definition
update_ecs_service() {
    local task_def_arn="$1"

    log INFO "Updating ECS service ${SERVICE} with task definition: ${task_def_arn}"

    aws ecs update-service \
        --cluster "${CLUSTER}" \
        --service "${SERVICE}" \
        --task-definition "${task_def_arn}" \
        --force-new-deployment \
        --region "${AWS_REGION}" \
        --output json > /dev/null

    log SUCCESS "Service update initiated"
}

# Get deployment status
get_deployment_status() {
    aws ecs describe-services \
        --cluster "${CLUSTER}" \
        --services "${SERVICE}" \
        --region "${AWS_REGION}" \
        --query 'services[0].deployments[0]' \
        --output json
}

# Wait for deployment to stabilize
wait_for_stability() {
    section "Waiting for Deployment Stability"

    local elapsed=0
    local check_count=0

    log INFO "Checking deployment every ${STABILITY_CHECK_INTERVAL}s (timeout: ${DEPLOYMENT_TIMEOUT}s)"

    while [ $elapsed -lt $DEPLOYMENT_TIMEOUT ]; do
        check_count=$((check_count + 1))

        local deployment_status
        deployment_status=$(get_deployment_status)

        local status=$(echo "${deployment_status}" | jq -r '.status')
        local running=$(echo "${deployment_status}" | jq -r '.runningCount')
        local desired=$(echo "${deployment_status}" | jq -r '.desiredCount')
        local pending=$(echo "${deployment_status}" | jq -r '.pendingCount')

        # Print progress every 30s or when status changes
        if [ $((check_count % 3)) -eq 0 ] || [ "${status}" == "PRIMARY" ]; then
            log INFO "Status: ${status} | Running: ${running}/${desired} | Pending: ${pending}"
        fi

        # Check if deployment is complete
        if [ "${status}" == "PRIMARY" ] && [ "${running}" -eq "${desired}" ] && [ "${pending}" -eq 0 ]; then
            log SUCCESS "Deployment stabilized (${running}/${desired} tasks running)"
            return 0
        fi

        sleep $STABILITY_CHECK_INTERVAL
        elapsed=$((elapsed + STABILITY_CHECK_INTERVAL))
    done

    log WARNING "Deployment did not fully stabilize within ${DEPLOYMENT_TIMEOUT}s"
    log WARNING "Continuing with caution - monitor service health in CloudWatch"
    return 0  # Non-fatal timeout
}

################################################################################
# Smoke Testing
################################################################################

# Run E2E smoke tests
run_smoke_tests() {
    section "Running E2E Smoke Tests"

    local endpoint_url=""

    case "${ENVIRONMENT}" in
        staging|dev)
            endpoint_url="${STAGING_URL:-}"
            ;;
        prod|production)
            endpoint_url="${PROD_URL:-}"
            ;;
    esac

    if [ -z "${endpoint_url}" ]; then
        log WARNING "Endpoint URL not configured, skipping smoke tests"
        return 0
    fi

    log INFO "Testing endpoint: ${endpoint_url}"

    export TEST_E2E=true
    export ENDPOINT_URL="${endpoint_url}"

    if npm ci > /dev/null 2>&1; then
        if npm run test:e2e 2>&1 | tee smoke-test-${ENVIRONMENT}.log; then
            log SUCCESS "Smoke tests passed"
            return 0
        else
            log ERROR "Smoke tests failed"
            return 1
        fi
    else
        log ERROR "Failed to install dependencies"
        return 1
    fi
}

################################################################################
# Rollback
################################################################################

# Rollback to previous task definition
rollback_deployment() {
    section "Rolling Back Deployment"

    log WARNING "Initiating rollback..."

    local previous_task_def
    previous_task_def=$(aws ecs describe-services \
        --cluster "${CLUSTER}" \
        --services "${SERVICE}" \
        --region "${AWS_REGION}" \
        --query 'services[0].deployments[1].taskDefinition' \
        --output text)

    if [ -z "${previous_task_def}" ] || [ "${previous_task_def}" == "None" ]; then
        log ERROR "Could not find previous task definition for rollback"
        return 1
    fi

    log INFO "Rolling back to: ${previous_task_def}"

    aws ecs update-service \
        --cluster "${CLUSTER}" \
        --service "${SERVICE}" \
        --task-definition "${previous_task_def}" \
        --region "${AWS_REGION}" \
        --output json > /dev/null

    log SUCCESS "Rollback initiated"

    # Wait for rollback to complete
    local elapsed=0
    while [ $elapsed -lt 120 ]; do
        local running=$(aws ecs describe-services \
            --cluster "${CLUSTER}" \
            --services "${SERVICE}" \
            --region "${AWS_REGION}" \
            --query 'services[0].deployments[0].runningCount' \
            --output text)

        local desired=$(aws ecs describe-services \
            --cluster "${CLUSTER}" \
            --services "${SERVICE}" \
            --region "${AWS_REGION}" \
            --query 'services[0].deployments[0].desiredCount' \
            --output text)

        if [ "${running}" -eq "${desired}" ]; then
            log SUCCESS "Rollback completed (${running}/${desired} tasks running)"
            return 0
        fi

        sleep 5
        elapsed=$((elapsed + 5))
    done

    log WARNING "Rollback timeout - monitor service health manually"
    return 1
}

################################################################################
# Main Deployment Flow
################################################################################

main() {
    section "ServalSheets ECS Deployment"

    log INFO "Starting deployment at $(date)"
    log INFO "Elapsed: $(elapsed_time)"

    # Step 1: Verify prerequisites
    verify_prerequisites

    # Step 2: Parse arguments
    parse_arguments "$@"

    # Step 3: Build full image URI
    section "Building Image URI"
    local ecr_uri="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}"
    log INFO "Full image URI: ${ecr_uri}"

    # Step 4: Get current task definition
    section "Preparing Deployment"
    local current_task_def
    if ! current_task_def=$(get_current_task_def); then
        log ERROR "Failed to get current task definition"
        exit 1
    fi
    log SUCCESS "Current task definition: ${current_task_def}"

    # Step 5: Register new task definition
    local new_task_def
    if ! new_task_def=$(register_new_task_def "${current_task_def}" "${ecr_uri}"); then
        log ERROR "Failed to register new task definition"
        exit 1
    fi

    # Step 6: Update ECS service
    section "Deploying to ECS"
    update_ecs_service "${new_task_def}"

    # Step 7: Wait for stability
    if ! wait_for_stability; then
        log WARNING "Deployment stability check inconclusive"
    fi

    # Step 8: Run smoke tests
    if ! run_smoke_tests; then
        log ERROR "Smoke tests failed"

        if [ "${ENABLE_ROLLBACK}" == "true" ]; then
            log WARNING "Initiating automatic rollback..."
            if rollback_deployment; then
                log ERROR "Deployment failed and was rolled back"
                exit 1
            else
                log ERROR "Deployment failed and rollback failed - manual intervention required"
                exit 2
            fi
        else
            log ERROR "Deployment failed - rollback disabled"
            exit 1
        fi
    fi

    # Step 9: Success
    section "Deployment Complete"
    log SUCCESS "✨ Deployment successful!"
    log INFO "Environment: ${ENVIRONMENT}"
    log INFO "Cluster: ${CLUSTER}"
    log INFO "Service: ${SERVICE}"
    log INFO "Image: ${ecr_uri}"
    log INFO "Total time: $(elapsed_time)"

    return 0
}

# Handle errors
trap 'log ERROR "Script failed at line $LINENO"; exit 1' ERR

# Run main function with all arguments
main "$@"
