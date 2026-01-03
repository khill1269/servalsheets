#!/bin/bash
#
# ServalSheets OAuth Setup Script
#
# This script helps you set up OAuth authentication for ServalSheets

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ServalSheets OAuth Setup Wizard     ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ENV_FILE="$SCRIPT_DIR/.env"

# Check if .env already exists
if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  .env file already exists${NC}"
    read -p "Do you want to overwrite it? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing .env file. Edit it manually if needed."
        exit 0
    fi

    # Backup existing file
    BACKUP="$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$ENV_FILE" "$BACKUP"
    echo -e "${GREEN}✓${NC} Backed up to: $BACKUP"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}Step 1: Google OAuth Credentials${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""
echo "You need to create OAuth credentials in Google Cloud Console:"
echo ""
echo "1. Go to: ${YELLOW}https://console.cloud.google.com/apis/credentials${NC}"
echo "2. Create OAuth client ID (Web application)"
echo "3. Add redirect URI: ${YELLOW}http://localhost:3000/callback${NC}"
echo ""
read -p "Press Enter when you have your credentials ready..."

echo ""
echo -e "${YELLOW}Enter your OAuth Client ID:${NC}"
read -r CLIENT_ID

echo ""
echo -e "${YELLOW}Enter your OAuth Client Secret:${NC}"
read -r CLIENT_SECRET

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
    echo -e "${RED}Error: Both Client ID and Client Secret are required${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}Step 2: Server Configuration${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}HTTP Port (default: 3000):${NC}"
read -r HTTP_PORT
HTTP_PORT=${HTTP_PORT:-3000}

echo ""
echo -e "${GREEN}✓${NC} Generating secure session secret..."
SESSION_SECRET=$(openssl rand -hex 32)

echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}Step 3: Creating .env file${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""

cat > "$ENV_FILE" <<EOF
# ServalSheets OAuth Configuration
# Generated: $(date)

# Google OAuth Credentials
OAUTH_CLIENT_ID=$CLIENT_ID
OAUTH_CLIENT_SECRET=$CLIENT_SECRET
OAUTH_REDIRECT_URI=http://localhost:$HTTP_PORT/callback

# Server Configuration
HTTP_PORT=$HTTP_PORT
NODE_ENV=development
LOG_LEVEL=info
LOG_FORMAT=pretty

# Session & Security
SESSION_SECRET=$SESSION_SECRET
ALLOWED_REDIRECT_URIS=http://localhost:$HTTP_PORT/callback

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:$HTTP_PORT
EOF

echo -e "${GREEN}✓${NC} Created .env file"

echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}Step 4: Update Claude Desktop Config${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""

CLAUDE_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"

if [ -f "$CLAUDE_CONFIG" ]; then
    # Backup
    BACKUP="$CLAUDE_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$CLAUDE_CONFIG" "$BACKUP"
    echo -e "${GREEN}✓${NC} Backed up Claude config to: $BACKUP"

    # Update config
    cat > "$CLAUDE_CONFIG" <<EOF
{
  "mcpServers": {
    "servalsheets": {
      "url": "http://localhost:$HTTP_PORT",
      "transport": {
        "type": "http"
      }
    }
  }
}
EOF
    echo -e "${GREEN}✓${NC} Updated Claude Desktop config"
else
    echo -e "${YELLOW}⚠️  Claude Desktop config not found${NC}"
    echo "Create it manually at: $CLAUDE_CONFIG"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Setup Complete! 🎉            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. ${YELLOW}Start the server:${NC}"
echo "   ${BLUE}npm run start:http${NC}"
echo ""
echo "2. ${YELLOW}Authorize your Google account:${NC}"
echo "   ${BLUE}open http://localhost:$HTTP_PORT/authorize?redirect_uri=http://localhost:$HTTP_PORT/callback${NC}"
echo ""
echo "3. ${YELLOW}Restart Claude Desktop:${NC}"
echo "   - Quit completely (⌘+Q)"
echo "   - Reopen from Applications"
echo "   - Look for 🔨 icon"
echo ""
echo "4. ${YELLOW}Test in Claude Desktop:${NC}"
echo '   "List all my Google Sheets"'
echo ""
echo "For detailed instructions, see:"
echo "  ${BLUE}$SCRIPT_DIR/OAUTH_USER_SETUP.md${NC}"
echo ""
