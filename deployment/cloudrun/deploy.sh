#!/bin/bash
# ServalSheets Cloud Run Deployment Script
# This script builds, pushes, and deploys ServalSheets to Google Cloud Run
# Usage: ./deploy.sh [PROJECT_ID] [REGION] [SERVICE_NAME]
# Example: ./deploy.sh my-project us-central1 servalsheets

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
PROJECT_ID="${1:-}"
REGION="${2:-us-central1}"
SERVICE_NAME="${3:-servalsheets}"
IMAGE_TAG="${4:-latest}"

# Validation
if [[ -z "$PROJECT_ID" ]]; then
  log_error "Project ID is required"
  echo "Usage: $0 <PROJECT_ID> [REGION] [SERVICE_NAME] [IMAGE_TAG]"
  exit 1
fi

log_info "ServalSheets Cloud Run Deployment"
log_info "Project: $PROJECT_ID"
log_info "Region: $REGION"
log_info "Service: $SERVICE_NAME"
log_info "Image Tag: $IMAGE_TAG"

# ========== PRE-DEPLOYMENT CHECKS ==========
log_info "Running pre-deployment checks..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
  log_error "gcloud CLI is not installed"
  exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
  log_error "docker is not installed"
  exit 1
fi

# Authenticate with Google Cloud
log_info "Authenticating with Google Cloud..."
gcloud auth application-default login --quiet 2>/dev/null || true
gcloud config set project "$PROJECT_ID"

# Verify API access
log_info "Verifying Cloud Run API access..."
if ! gcloud services list --enabled --filter="name:run.googleapis.com" --quiet &> /dev/null; then
  log_warning "Cloud Run API may not be enabled, attempting to enable..."
  gcloud services enable run.googleapis.com --quiet
fi

# ========== BUILD PHASE ==========
log_info "Building ServalSheets Docker image..."

cd "$PROJECT_DIR"

# Define GCR image path
GCR_IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
GCR_IMAGE_FULL="${GCR_IMAGE}:${IMAGE_TAG}"

# Build Docker image
log_info "Building Docker image: $GCR_IMAGE_FULL"
if docker build \
  -t "$GCR_IMAGE_FULL" \
  -t "${GCR_IMAGE}:latest" \
  -f deployment/docker/Dockerfile \
  --build-arg NODE_ENV=production \
  .; then
  log_success "Docker image built successfully"
else
  log_error "Docker image build failed"
  exit 1
fi

# ========== PUSH PHASE ==========
log_info "Pushing Docker image to Google Container Registry..."

# Configure docker authentication for GCR
log_info "Configuring Docker authentication..."
gcloud auth configure-docker --quiet

# Push to GCR
log_info "Pushing image: $GCR_IMAGE_FULL"
if docker push "$GCR_IMAGE_FULL"; then
  log_success "Image pushed to GCR: $GCR_IMAGE_FULL"
else
  log_error "Failed to push image to GCR"
  exit 1
fi

# Also push latest tag
if docker push "${GCR_IMAGE}:latest"; then
  log_success "Latest tag pushed to GCR"
fi

# ========== SECRET MANAGEMENT ==========
log_info "Setting up secrets in Google Secret Manager..."

# Function to create or update a secret
create_or_update_secret() {
  local secret_name="$1"
  local secret_value="$2"

  if gcloud secrets describe "$secret_name" --project="$PROJECT_ID" &> /dev/null; then
    log_info "Secret '$secret_name' exists, adding new version..."
    echo -n "$secret_value" | gcloud secrets versions add "$secret_name" \
      --data-file=- --project="$PROJECT_ID" --quiet
  else
    log_info "Creating secret '$secret_name'..."
    echo -n "$secret_value" | gcloud secrets create "$secret_name" \
      --replication-policy="automatic" \
      --data-file=- --project="$PROJECT_ID" --quiet
  fi
}

# Check for required secrets - prompt user if they don't exist or are placeholders
check_and_create_secret() {
  local secret_name="$1"
  local env_var_name="$2"
  local prompt_message="$3"

  # Check if secret already exists in Secret Manager
  if gcloud secrets describe "$secret_name" --project="$PROJECT_ID" &> /dev/null; then
    log_success "Secret '$secret_name' already exists in Secret Manager"
    return 0
  fi

  log_warning "Secret '$secret_name' not found in Secret Manager"
  echo -n "Enter $prompt_message (or press Enter to skip): "
  read -r secret_value

  if [[ -n "$secret_value" ]]; then
    create_or_update_secret "$secret_name" "$secret_value"
    log_success "Secret '$secret_name' created"
  else
    log_warning "Skipping secret '$secret_name'. You must create it manually or the deployment may fail."
  fi
}

# Check critical secrets
check_and_create_secret "servalsheets-jwt-secret" "JWT_SECRET" \
  "JWT signing secret (generate: openssl rand -hex 32)"

check_and_create_secret "servalsheets-encryption-key" "ENCRYPTION_KEY" \
  "Token encryption key (generate: openssl rand -hex 32)"

check_and_create_secret "servalsheets-google-client-id" "GOOGLE_CLIENT_ID" \
  "Google OAuth Client ID"

check_and_create_secret "servalsheets-google-client-secret" "GOOGLE_CLIENT_SECRET" \
  "Google OAuth Client Secret"

check_and_create_secret "servalsheets-admin-api-key" "ADMIN_API_KEY" \
  "Admin API key (generate: openssl rand -hex 32)"

check_and_create_secret "servalsheets-redis-url" "REDIS_URL" \
  "Redis connection URL (redis://host:port or redis-cluster://...)"

check_and_create_secret "servalsheets-oauth-issuer" "OAUTH_ISSUER" \
  "OAuth issuer URL (e.g., https://servalsheets.example.com)"

check_and_create_secret "servalsheets-oauth-redirect-uri" "OAUTH_REDIRECT_URI" \
  "OAuth redirect URI (e.g., https://servalsheets.example.com/callback)"

# Optional secrets
log_info "Checking optional secrets..."
check_and_create_secret "servalsheets-anthropic-api-key" "ANTHROPIC_API_KEY" \
  "Anthropic API key (optional)" || true

check_and_create_secret "servalsheets-voyage-api-key" "VOYAGE_API_KEY" \
  "Voyage AI API key (optional)" || true

# ========== SERVICE ACCOUNT SETUP ==========
log_info "Setting up service account..."

SA_NAME="servalsheets-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" &> /dev/null; then
  log_success "Service account '$SA_NAME' already exists"
else
  log_info "Creating service account '$SA_NAME'..."
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name="ServalSheets Cloud Run Service Account" \
    --project="$PROJECT_ID"
  log_success "Service account created"
fi

# Grant necessary roles
log_info "Granting IAM roles to service account..."

# Roles needed for ServalSheets
declare -a ROLES=(
  "roles/logging.logWriter"           # Cloud Logging
  "roles/monitoring.metricWriter"     # Cloud Monitoring
  "roles/cloudtrace.agent"            # Cloud Trace
  "roles/secretmanager.secretAccessor" # Access to secrets
  "roles/storage.objectViewer"        # GCS access if needed
)

for role in "${ROLES[@]}"; do
  if gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$role" \
    --condition=None \
    --quiet 2>&1 | grep -q "Updated IAM policy"; then
    log_success "Granted $role"
  else
    log_info "Role $role already granted or binding failed (non-critical)"
  fi
done

# ========== DEPLOYMENT PHASE ==========
log_info "Deploying to Cloud Run..."

# Update the service.yaml with the actual GCR image path
TEMP_YAML=$(mktemp)
sed "s|gcr.io/PROJECT_ID/servalsheets:latest|${GCR_IMAGE_FULL}|g" \
  "$SCRIPT_DIR/service.yaml" | \
  sed "s|PROJECT_ID|${PROJECT_ID}|g" > "$TEMP_YAML"

# Deploy using gcloud run deploy with the manifest
log_info "Deploying service to Cloud Run (region: $REGION)..."

if gcloud run deploy "$SERVICE_NAME" \
  --region "$REGION" \
  --image "$GCR_IMAGE_FULL" \
  --platform managed \
  --allow-unauthenticated \
  --service-account "$SA_EMAIL" \
  --set-env-vars="NODE_ENV=production,LOG_LEVEL=info,PORT=3000,HOST=0.0.0.0,MCP_TRANSPORT=http,GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
  --set-secrets="JWT_SECRET=servalsheets-jwt-secret:latest,ENCRYPTION_KEY=servalsheets-encryption-key:latest,GOOGLE_CLIENT_ID=servalsheets-google-client-id:latest,GOOGLE_CLIENT_SECRET=servalsheets-google-client-secret:latest,ADMIN_API_KEY=servalsheets-admin-api-key:latest,REDIS_URL=servalsheets-redis-url:latest,OAUTH_ISSUER=servalsheets-oauth-issuer:latest,OAUTH_REDIRECT_URI=servalsheets-oauth-redirect-uri:latest" \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10 \
  --min-instances 1 \
  --timeout 300 \
  --quiet; then
  log_success "Deployment successful!"
else
  log_error "Deployment failed"
  rm -f "$TEMP_YAML"
  exit 1
fi

rm -f "$TEMP_YAML"

# ========== POST-DEPLOYMENT ==========
log_info "Retrieving deployed service URL..."

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --format='value(status.url)' \
  --project="$PROJECT_ID")

if [[ -n "$SERVICE_URL" ]]; then
  log_success "ServalSheets deployed successfully!"
  echo ""
  echo "=========================================="
  echo "Deployment Details:"
  echo "=========================================="
  echo "Service Name: $SERVICE_NAME"
  echo "Project ID: $PROJECT_ID"
  echo "Region: $REGION"
  echo "Service URL: $SERVICE_URL"
  echo "Image: $GCR_IMAGE_FULL"
  echo ""
  echo "Health Check URL:"
  echo "  $SERVICE_URL/health/live"
  echo ""
  echo "Ready Check URL:"
  echo "  $SERVICE_URL/health/ready"
  echo ""
  echo "Next steps:"
  echo "1. Configure your DNS to point to: $SERVICE_URL"
  echo "2. Set up SSL certificate (Cloud Run auto-generates HTTPS)"
  echo "3. Configure OAuth redirect URI if needed"
  echo "4. Set up monitoring and alerting"
  echo "5. Check logs: gcloud run logs read $SERVICE_NAME --region=$REGION --limit=50"
  echo ""
else
  log_error "Could not retrieve service URL"
  exit 1
fi

# ========== VERIFICATION ==========
log_info "Verifying deployment health..."

# Wait a moment for the service to be fully ready
sleep 5

# Test the health check endpoint
if curl -sf "${SERVICE_URL}/health/live" > /dev/null 2>&1; then
  log_success "Health check passed!"
else
  log_warning "Health check failed. The service may still be initializing. Check logs with:"
  log_warning "  gcloud run logs read $SERVICE_NAME --region=$REGION --limit=50"
fi

log_success "Deployment script completed!"
