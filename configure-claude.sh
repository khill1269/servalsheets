#!/bin/bash
#
# Quick Configuration Script for Claude Desktop
#

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CLI_PATH="$SCRIPT_DIR/dist/cli.js"
CLAUDE_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"

echo -e "${BLUE}ServalSheets Claude Desktop Configuration${NC}"
echo "=========================================="
echo ""

# Backup existing config
if [ -f "$CLAUDE_CONFIG" ]; then
    BACKUP="$CLAUDE_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$CLAUDE_CONFIG" "$BACKUP"
    echo -e "${GREEN}✓${NC} Backed up config to: $BACKUP"
fi

echo ""
echo "Choose your credential method:"
echo ""
echo "1) ${YELLOW}OAuth Token${NC} (fastest - 2 minutes, expires in 1 hour)"
echo "2) ${YELLOW}Service Account${NC} (permanent - requires setup)"
echo ""
read -p "Enter choice (1 or 2): " -n 1 -r
echo ""
echo ""

CONFIG_ENTRY=""

if [[ $REPLY =~ ^[1]$ ]]; then
    # OAuth Token
    echo -e "${BLUE}OAuth Token Setup${NC}"
    echo "==================="
    echo ""
    echo "1. Go to: ${YELLOW}https://developers.google.com/oauthplayground/${NC}"
    echo "2. Select scopes:"
    echo "   - https://www.googleapis.com/auth/spreadsheets"
    echo "   - https://www.googleapis.com/auth/drive.file"
    echo "3. Authorize and exchange for token"
    echo "4. Copy the access token (starts with ya29.)"
    echo ""
    read -p "Paste your OAuth token: " OAUTH_TOKEN

    if [ -z "$OAUTH_TOKEN" ]; then
        echo -e "${YELLOW}No token provided. Exiting.${NC}"
        exit 1
    fi

    CONFIG_ENTRY=$(cat <<EOF
{
  "mcpServers": {
    "servalsheets": {
      "command": "node",
      "args": ["$CLI_PATH"],
      "env": {
        "GOOGLE_ACCESS_TOKEN": "$OAUTH_TOKEN"
      }
    }
  }
}
EOF
)

elif [[ $REPLY =~ ^[2]$ ]]; then
    # Service Account
    echo -e "${BLUE}Service Account Setup${NC}"
    echo "======================"
    echo ""
    echo "Enter path to your service account JSON file:"
    echo "(Press Enter to use: ~/.config/google/servalsheets-sa.json)"
    read -r SA_PATH

    if [ -z "$SA_PATH" ]; then
        SA_PATH="$HOME/.config/google/servalsheets-sa.json"
    fi

    # Expand tilde
    SA_PATH="${SA_PATH/#\~/$HOME}"

    if [ ! -f "$SA_PATH" ]; then
        echo -e "${YELLOW}Warning: File not found: $SA_PATH${NC}"
        echo ""
        echo "Create it by:"
        echo "1. Following QUICKSTART_CREDENTIALS.md"
        echo "2. Or download from Google Cloud Console"
        echo ""
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo -e "${GREEN}✓${NC} Found: $SA_PATH"

        # Extract service account email
        if command -v jq &> /dev/null; then
            SA_EMAIL=$(jq -r '.client_email' "$SA_PATH" 2>/dev/null || echo "")
            if [ -n "$SA_EMAIL" ]; then
                echo ""
                echo -e "${YELLOW}Service Account Email:${NC}"
                echo -e "${GREEN}$SA_EMAIL${NC}"
                echo ""
                echo "Share your Google Sheets with this email!"
            fi
        fi
    fi

    CONFIG_ENTRY=$(cat <<EOF
{
  "mcpServers": {
    "servalsheets": {
      "command": "node",
      "args": ["$CLI_PATH"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "$SA_PATH"
      }
    }
  }
}
EOF
)

else
    echo "Invalid choice. Exiting."
    exit 1
fi

# Write config
echo "$CONFIG_ENTRY" > "$CLAUDE_CONFIG"

echo ""
echo -e "${GREEN}✓ Configuration complete!${NC}"
echo ""
echo "Config written to:"
echo "  $CLAUDE_CONFIG"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Quit Claude Desktop completely (⌘+Q)"
echo "2. Reopen Claude Desktop"
echo "3. Look for 🔨 icon in bottom-right"
echo ""
echo -e "${BLUE}=== 🎉 Getting Started ===${NC}"
echo ""
echo "When Claude Desktop starts, type:"
echo -e "  ${GREEN}/welcome${NC} - Interactive introduction to ServalSheets"
echo ""
echo "Or try these guided prompts:"
echo "  /test_connection    - Verify your setup works"
echo "  /first_operation    - Walkthrough your first operation"
echo ""
echo -e "${YELLOW}Quick test with public spreadsheet:${NC}"
echo "  ID: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
echo ""
echo "Ask Claude:"
echo '  "List all sheets in spreadsheet: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"'
echo ""
echo "Or use a prompt:"
echo '  /first_operation spreadsheetId=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
echo ""
echo "For help:"
echo "  View prompts guide: cat PROMPTS_GUIDE.md"
echo "  Check logs: ~/Library/Logs/Claude/mcp-server-servalsheets.log"
echo ""
