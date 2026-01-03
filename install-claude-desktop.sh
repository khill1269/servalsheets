#!/bin/bash
#
# ServalSheets Claude Desktop Installation Script
#
# This script helps configure ServalSheets for Claude Desktop
#

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}ServalSheets Claude Desktop Setup${NC}"
echo "=================================="
echo ""

# Get the absolute path to this script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CLI_PATH="$SCRIPT_DIR/dist/cli.js"

# Check if CLI exists
if [ ! -f "$CLI_PATH" ]; then
    echo -e "${RED}Error: CLI not found at $CLI_PATH${NC}"
    echo "Please run: npm run build"
    exit 1
fi

echo -e "${GREEN}✓${NC} Found CLI at: $CLI_PATH"

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
        # Expand ~ to home directory
        USER_CRED_PATH="${USER_CRED_PATH/#\~/$HOME}"

        if [ -f "$USER_CRED_PATH" ]; then
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

# Backup existing config if it exists
if [ -f "$CLAUDE_CONFIG" ]; then
    BACKUP="$CLAUDE_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$CLAUDE_CONFIG" "$BACKUP"
    echo -e "${YELLOW}Backed up existing config to: $BACKUP${NC}"
fi

# Read existing config or create new
if [ -f "$CLAUDE_CONFIG" ]; then
    EXISTING_CONFIG=$(cat "$CLAUDE_CONFIG")
else
    EXISTING_CONFIG='{"mcpServers":{}}'
fi

# Build new servalsheets entry
if [ -n "$CRED_PATH" ]; then
    SERVALSHEETS_ENTRY=$(cat <<EOF
{
  "command": "node",
  "args": ["$CLI_PATH"],
  "env": {
    "GOOGLE_APPLICATION_CREDENTIALS": "$CRED_PATH"
  }
}
EOF
)
else
    SERVALSHEETS_ENTRY=$(cat <<EOF
{
  "command": "node",
  "args": ["$CLI_PATH"],
  "env": {
    "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/your/service-account.json"
  }
}
EOF
)
fi

# Merge configs using jq if available, otherwise use simple approach
if command -v jq &> /dev/null; then
    echo "$EXISTING_CONFIG" | jq ".mcpServers.servalsheets = $SERVALSHEETS_ENTRY" > "$CLAUDE_CONFIG"
else
    # Simple approach without jq
    if [ "$EXISTING_CONFIG" = '{"mcpServers":{}}' ]; then
        cat > "$CLAUDE_CONFIG" <<EOF
{
  "mcpServers": {
    "servalsheets": $SERVALSHEETS_ENTRY
  }
}
EOF
    else
        echo -e "${YELLOW}jq not found - you'll need to manually add ServalSheets to config${NC}"
        echo ""
        echo "Add this to $CLAUDE_CONFIG:"
        echo ""
        echo '"servalsheets": '$SERVALSHEETS_ENTRY
        echo ""
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} Updated Claude Desktop config"

# Extract service account email if available
if [ -n "$CRED_PATH" ] && command -v jq &> /dev/null; then
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
echo "3. Look for the 🔨 icon (bottom-right) indicating MCP servers loaded"
echo "4. ${YELLOW}Share your Google Sheets${NC} with service account email"
echo "5. Test with: 'List sheets in spreadsheet: <your-spreadsheet-id>'"
echo ""
echo "For troubleshooting, see:"
echo "  $SCRIPT_DIR/CLAUDE_DESKTOP_SETUP.md"
echo ""
echo "Logs available at:"
echo "  ~/Library/Logs/Claude/mcp-server-servalsheets.log"
echo ""
