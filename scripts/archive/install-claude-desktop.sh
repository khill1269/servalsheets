#!/bin/bash
#
# ServalSheets Claude Desktop Installation Script (Security Hardened)
#
# This script helps configure ServalSheets for Claude Desktop
# Version: 1.1.1 (Security Fixed)
#
# Security improvements:
# - Fixed shell injection vulnerability (CRITICAL-002)
# - Added file permission checks (CRITICAL-009)
# - Robust path expansion (CRITICAL-008)
# - Validates credentials before use
#

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Respect NO_COLOR environment variable
if [ -n "$NO_COLOR" ]; then
  GREEN=''
  YELLOW=''
  RED=''
  BLUE=''
  NC=''
fi

echo -e "${GREEN}ServalSheets Claude Desktop Setup v1.1.1${NC}"
echo "==========================================="
echo ""
echo -e "${BLUE}New in v1.1.1:${NC}"
echo "  • HTTP compression (60-80% bandwidth reduction)"
echo "  • Payload monitoring (2MB warnings, 10MB limits)"
echo "  • Batch efficiency analysis"
echo "  • Dynamic rate limiting (auto-throttle on 429 errors)"
echo ""

# Get the absolute path to this script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# CLI lives in the repo-level dist/ directory (not scripts/dist)
CLI_PATH="$SCRIPT_DIR/../dist/cli.js"

# Check if CLI exists
if [ ! -f "$CLI_PATH" ]; then
    echo -e "${RED}Error: CLI not found at $CLI_PATH${NC}"
    echo "Please run: npm run build"
    exit 1
fi

# Verify CLI is executable by node
if ! node "$CLI_PATH" --version &>/dev/null; then
    echo -e "${RED}Error: CLI exists but cannot be executed${NC}"
    echo "Please verify the build completed successfully"
    exit 1
fi

echo -e "${GREEN}✓${NC} Found and verified CLI at: $CLI_PATH"

# Check for Claude Desktop config
CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
CLAUDE_CONFIG="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

if [ ! -d "$CLAUDE_CONFIG_DIR" ]; then
    echo -e "${YELLOW}Warning: Claude Desktop config directory not found${NC}"
    echo "Is Claude Desktop installed?"
    read -p "Create config anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    mkdir -p "$CLAUDE_CONFIG_DIR"
fi

# Verify directory is writable (CRITICAL-009: File permission checks)
if [ ! -w "$CLAUDE_CONFIG_DIR" ]; then
    echo -e "${RED}Error: Cannot write to config directory${NC}"
    echo "Directory: $CLAUDE_CONFIG_DIR"
    echo "Check permissions and try again"
    exit 1
fi

# Check for Google credentials
echo ""
echo "Checking for Google credentials..."

CRED_PATH=""

# Check common locations
COMMON_PATHS=(
    "$HOME/.config/google/servalsheets-service-account.json"
    "$HOME/.config/google/service-account.json"
    "$HOME/service-account.json"
    "$SCRIPT_DIR/credentials.json"
)

for path in "${COMMON_PATHS[@]}"; do
    if [ -f "$path" ]; then
        CRED_PATH="$path"
        echo -e "${GREEN}✓${NC} Found credentials at: $CRED_PATH"
        break
    fi
done

if [ -z "$CRED_PATH" ]; then
    echo -e "${YELLOW}No service account found in common locations${NC}"
    echo ""
    echo "Please provide the path to your service account JSON file:"
    echo "(or press Enter to skip and configure manually later)"
    read -r USER_CRED_PATH

    if [ -n "$USER_CRED_PATH" ]; then
        # CRITICAL-008: Robust path expansion
        # Expand ~ to home directory
        USER_CRED_PATH="${USER_CRED_PATH/#\~/$HOME}"

        # Convert to absolute path if relative
        if [[ "$USER_CRED_PATH" != /* ]]; then
            USER_CRED_PATH="$(cd "$(dirname "$USER_CRED_PATH")" 2>/dev/null && pwd)/$(basename "$USER_CRED_PATH")"
        fi

        if [ -f "$USER_CRED_PATH" ]; then
            # CRITICAL-009: Verify file is readable
            if [ ! -r "$USER_CRED_PATH" ]; then
                echo -e "${RED}Error: File exists but is not readable${NC}"
                echo "Check file permissions: $USER_CRED_PATH"
                exit 1
            fi

            # Validate JSON syntax
            if command -v jq &> /dev/null; then
                if ! jq empty "$USER_CRED_PATH" 2>/dev/null; then
                    echo -e "${RED}Error: Invalid JSON in credentials file${NC}"
                    echo "File: $USER_CRED_PATH"
                    exit 1
                fi
                echo -e "${GREEN}✓${NC} Credentials file validated"
            fi

            CRED_PATH="$USER_CRED_PATH"
            echo -e "${GREEN}✓${NC} Using credentials at: $CRED_PATH"
        else
            echo -e "${RED}Error: File not found: $USER_CRED_PATH${NC}"
            echo "You'll need to configure credentials manually"
        fi
    fi
fi

# Create or update Claude Desktop config
echo ""
echo "Configuring Claude Desktop..."

# Backup existing config if it exists (with verification)
if [ -f "$CLAUDE_CONFIG" ]; then
    BACKUP="$CLAUDE_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
    if ! cp "$CLAUDE_CONFIG" "$BACKUP"; then
        echo -e "${RED}Error: Failed to create backup${NC}"
        exit 1
    fi

    # Verify backup was created
    if [ ! -f "$BACKUP" ]; then
        echo -e "${RED}Error: Backup file not created${NC}"
        exit 1
    fi

    echo -e "${YELLOW}Backed up existing config to: $BACKUP${NC}"
fi

# Read existing config or create new
if [ -f "$CLAUDE_CONFIG" ]; then
    EXISTING_CONFIG=$(cat "$CLAUDE_CONFIG")
else
    EXISTING_CONFIG='{"mcpServers":{}}'
fi

# Ask about optional configuration
echo ""
echo -e "${YELLOW}Optional Configuration${NC}"
echo "Would you like to enable optional features?"
echo ""

# Collect configuration options
LOG_LEVEL=""
ENABLE_TRACING="false"
LOG_SPANS="false"
READS_PER_MIN=""
WRITES_PER_MIN=""

# Ask about log level
echo "1. Log Level (default: info)"
echo "   Options: debug, info, warn, error"
read -p "   Set log level? (press Enter to skip): " LOG_LEVEL

# Ask about OpenTelemetry tracing
echo ""
echo "2. OpenTelemetry Tracing (default: disabled)"
echo "   Enables distributed tracing for debugging"
read -p "   Enable tracing? (y/n, default: n): " -n 1 -r ENABLE_TRACING_INPUT
echo
if [[ $ENABLE_TRACING_INPUT =~ ^[Yy]$ ]]; then
    ENABLE_TRACING="true"
    read -p "   Log spans to console? (y/n, default: n): " -n 1 -r LOG_SPANS_INPUT
    echo
    if [[ $LOG_SPANS_INPUT =~ ^[Yy]$ ]]; then
        LOG_SPANS="true"
    fi
fi

# Ask about rate limiting
echo ""
echo "3. Rate Limiting (default: 300 reads/min, 60 writes/min)"
echo "   Adjust based on your Google Cloud project quotas"
read -p "   Customize rate limits? (y/n, default: n): " -n 1 -r CUSTOM_RATES
echo
if [[ $CUSTOM_RATES =~ ^[Yy]$ ]]; then
    read -p "   Reads per minute (default: 300): " READS_PER_MIN
    read -p "   Writes per minute (default: 60): " WRITES_PER_MIN
fi

# CRITICAL-002 FIX: Build JSON safely using jq instead of echo -e
if command -v jq &> /dev/null; then
    # Use jq to build JSON safely - prevents injection
    SERVALSHEETS_ENTRY=$(jq -n \
        --arg cmd "node" \
        --arg cli "$CLI_PATH" \
        --arg cred "${CRED_PATH:-/path/to/your/service-account.json}" \
        --arg log "$LOG_LEVEL" \
        --arg otel "$ENABLE_TRACING" \
        --arg spans "$LOG_SPANS" \
        --arg reads "$READS_PER_MIN" \
        --arg writes "$WRITES_PER_MIN" \
        '{
            command: $cmd,
            args: [$cli],
            env: {
                GOOGLE_APPLICATION_CREDENTIALS: $cred
            }
        } |
        if $log != "" then .env.LOG_LEVEL = $log else . end |
        if $otel == "true" then .env.OTEL_ENABLED = "true" else . end |
        if $spans == "true" then .env.OTEL_LOG_SPANS = "true" else . end |
        if $reads != "" then .env.RATE_LIMIT_READS_PER_MINUTE = $reads else . end |
        if $writes != "" then .env.RATE_LIMIT_WRITES_PER_MINUTE = $writes else . end'
    )

    # Merge configs using jq
    echo "$EXISTING_CONFIG" | jq ".mcpServers.servalsheets = $SERVALSHEETS_ENTRY" > "$CLAUDE_CONFIG"
    echo -e "${GREEN}✓${NC} Updated Claude Desktop config"
else
    echo -e "${RED}Error: jq is required but not installed${NC}"
    echo "Please install jq:"
    echo "  macOS: brew install jq"
    echo "  Linux: apt-get install jq or yum install jq"
    echo ""
    echo "Or manually add ServalSheets to $CLAUDE_CONFIG"
    exit 1
fi

# Extract service account email if available
if [ -n "$CRED_PATH" ] && [ -f "$CRED_PATH" ] && command -v jq &> /dev/null; then
    SA_EMAIL=$(jq -r '.client_email' "$CRED_PATH" 2>/dev/null || echo "")
    if [ -n "$SA_EMAIL" ]; then
        echo ""
        echo -e "${YELLOW}IMPORTANT:${NC} Share your Google Sheets with this email:"
        echo -e "${GREEN}$SA_EMAIL${NC}"
    fi
fi

# Final instructions
echo ""
echo -e "${GREEN}Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. ${YELLOW}Quit Claude Desktop completely${NC} (⌘+Q)"
echo "2. ${YELLOW}Reopen Claude Desktop${NC}"
echo "3. Look for the 🔨 icon (bottom-right) indicating MCP servers loaded (custom icon may not appear yet)"
echo "4. ${YELLOW}Share your Google Sheets${NC} with service account email"
echo "5. Test with: 'List sheets in spreadsheet: <your-spreadsheet-id>'"
echo ""
echo -e "${BLUE}v1.1.1 Features Active:${NC}"
echo "  ✓ HTTP compression enabled automatically"
echo "  ✓ Payload monitoring (warns at 2MB, errors at 10MB)"
echo "  ✓ Batch efficiency analysis"
echo "  ✓ Dynamic rate limiting (auto-throttles on 429 errors)"
if [ "$ENABLE_TRACING" = "true" ]; then
echo "  ✓ OpenTelemetry tracing enabled"
fi
echo ""
echo "Documentation:"
echo "  Setup Guide:     $SCRIPT_DIR/CLAUDE_DESKTOP_SETUP.md"
echo "  Configuration:   $SCRIPT_DIR/.env.example"
echo "  Performance:     $SCRIPT_DIR/PERFORMANCE.md"
echo "  Troubleshooting: $SCRIPT_DIR/TROUBLESHOOTING.md"
echo ""
echo "Logs available at:"
echo "  ~/Library/Logs/Claude/mcp-server-servalsheets.log"
echo ""
