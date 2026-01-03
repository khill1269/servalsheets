#!/bin/bash
#
# ServalSheets Claude Desktop OAuth Setup
#
# This script sets up ServalSheets to work with Claude Desktop using OAuth

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

clear

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                           ║${NC}"
echo -e "${BLUE}║          ${BOLD}ServalSheets for Claude Desktop${NC}${BLUE}                ║${NC}"
echo -e "${BLUE}║              ${CYAN}OAuth Setup Wizard${NC}${BLUE}                        ║${NC}"
echo -e "${BLUE}║                                                           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ENV_FILE="$SCRIPT_DIR/.env"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js from https://nodejs.org"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi

echo -e "${CYAN}This wizard will help you set up ServalSheets with OAuth.${NC}"
echo -e "${CYAN}You'll be able to sign in with your Google account!${NC}"
echo ""
echo -e "Setup takes about ${YELLOW}5 minutes${NC}."
echo ""
read -p "Press Enter to begin..."
echo ""

# =============================================================================
# Step 1: Get Google OAuth Credentials
# =============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 1/5:${NC} Get Google OAuth Credentials"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "You need to create OAuth credentials in Google Cloud Console."
echo ""
echo -e "${YELLOW}Instructions:${NC}"
echo "1. Go to: https://console.cloud.google.com/apis/credentials"
echo "2. Create OAuth client ID (Web application)"
echo "3. Add redirect URI: ${CYAN}http://localhost:3000/callback${NC}"
echo ""
echo -e "${YELLOW}Don't have a Google Cloud project yet?${NC}"
echo "1. Go to: https://console.cloud.google.com"
echo "2. Create a new project"
echo "3. Enable Google Sheets API"
echo "4. Configure OAuth consent screen (External)"
echo "5. Create OAuth client ID"
echo ""
read -p "Press Enter when you have your OAuth credentials..."
echo ""

echo -e "${CYAN}Enter your OAuth Client ID:${NC}"
read -r CLIENT_ID

if [ -z "$CLIENT_ID" ]; then
    echo -e "${RED}Error: Client ID is required${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}Enter your OAuth Client Secret:${NC}"
read -rs CLIENT_SECRET
echo ""

if [ -z "$CLIENT_SECRET" ]; then
    echo -e "${RED}Error: Client Secret is required${NC}"
    exit 1
fi

# =============================================================================
# Step 2: Install Dependencies
# =============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 2/5:${NC} Installing Dependencies"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd "$SCRIPT_DIR"

if [ ! -d "node_modules" ]; then
    echo "Installing packages..."
    npm ci > /dev/null 2>&1
    echo -e "${GREEN}✓${NC} Dependencies installed"
else
    echo -e "${GREEN}✓${NC} Dependencies already installed"
fi

# =============================================================================
# Step 3: Build Project
# =============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 3/5:${NC} Building Project"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

npm run build > /dev/null 2>&1
echo -e "${GREEN}✓${NC} Project built successfully"

# =============================================================================
# Step 4: Create Configuration
# =============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 4/5:${NC} Creating Configuration"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Generate secure session secret
SESSION_SECRET=$(openssl rand -hex 32)

# Create .env file
cat > "$ENV_FILE" <<EOF
# ServalSheets OAuth Configuration
# Generated: $(date)

# Google OAuth Credentials
OAUTH_CLIENT_ID=$CLIENT_ID
OAUTH_CLIENT_SECRET=$CLIENT_SECRET
OAUTH_REDIRECT_URI=http://localhost:3000/callback

# Server Configuration
HTTP_PORT=3000
NODE_ENV=development
LOG_LEVEL=info
LOG_FORMAT=pretty

# Session & Security
SESSION_SECRET=$SESSION_SECRET
ALLOWED_REDIRECT_URIS=http://localhost:3000/callback

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
EOF

echo -e "${GREEN}✓${NC} Configuration saved to .env"

# =============================================================================
# Step 5: Configure Claude Desktop
# =============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Step 5/5:${NC} Configuring Claude Desktop"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
CLAUDE_CONFIG="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

if [ ! -d "$CLAUDE_CONFIG_DIR" ]; then
    mkdir -p "$CLAUDE_CONFIG_DIR"
fi

# Backup existing config
if [ -f "$CLAUDE_CONFIG" ]; then
    BACKUP="$CLAUDE_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$CLAUDE_CONFIG" "$BACKUP"
    echo -e "${YELLOW}⚠️${NC}  Backed up existing config to: $(basename "$BACKUP")"
fi

# Create new config (HTTP mode)
cat > "$CLAUDE_CONFIG" <<EOF
{
  "mcpServers": {
    "servalsheets": {
      "command": "node",
      "args": ["$SCRIPT_DIR/dist/http-server.js"],
      "env": {}
    }
  }
}
EOF

echo -e "${GREEN}✓${NC} Claude Desktop configured (HTTP mode)"

# =============================================================================
# Success!
# =============================================================================

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║                  ${BOLD}✨ Setup Complete! ✨${NC}${GREEN}                   ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get authorization URL
AUTH_URL="http://localhost:3000/authorize?redirect_uri=http://localhost:3000/callback"

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Next Steps:${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}1. The server will start automatically with Claude Desktop${NC}"
echo ""
echo -e "${YELLOW}2. Restart Claude Desktop:${NC}"
echo -e "   - Quit completely: ${CYAN}⌘+Q${NC}"
echo -e "   - Reopen from Applications"
echo ""
echo -e "${YELLOW}3. First time you use any tool, Claude will show:${NC}"
echo -e "   ${CYAN}\"🔐 Authorization Required\"${NC}"
echo -e "   ${CYAN}\"Click here to authorize: [link]\"${NC}"
echo ""
echo -e "${YELLOW}4. Click the link and sign in with Google${NC}"
echo ""
echo -e "${YELLOW}5. After authorizing, try again in Claude Desktop!${NC}"
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BOLD}Authorization URL (you'll see this in Claude Desktop):${NC}"
echo -e "${CYAN}${AUTH_URL}${NC}"
echo ""
echo -e "${GREEN}That's it! Restart Claude Desktop and start using ServalSheets!${NC}"
echo ""
echo -e "Need help? See: ${BLUE}$SCRIPT_DIR/CLAUDE_DESKTOP_OAUTH_SETUP.md${NC}"
echo ""
