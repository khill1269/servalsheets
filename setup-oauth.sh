#!/bin/bash
# ServalSheets OAuth Setup Script for Claude Desktop
# Run this script to authenticate and configure Claude Desktop

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║       ServalSheets v1.4.0 - OAuth Setup for Claude Desktop    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "📂 Working directory: $SCRIPT_DIR"
echo ""

# Step 1: Check if auth-setup.js exists
if [ ! -f "dist/cli/auth-setup.js" ]; then
    echo "❌ Error: dist/cli/auth-setup.js not found!"
    echo "   Please run 'npm run build' first."
    exit 1
fi

# Step 2: Run OAuth authentication
echo "🔐 Step 1: Authenticating with Google OAuth..."
echo "   This will open your browser for authentication."
echo ""
node dist/cli/auth-setup.js

# Check if authentication succeeded
if [ ! -f ~/.servalsheets/tokens.json ]; then
    echo "❌ Authentication failed. Tokens not found."
    exit 1
fi

echo ""
echo "✅ Authentication successful!"
echo "   Tokens saved to: ~/.servalsheets/tokens.json"
echo ""

# Step 3: Create Claude Desktop config directory if it doesn't exist
CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
if [ ! -d "$CLAUDE_CONFIG_DIR" ]; then
    echo "📁 Creating Claude config directory..."
    mkdir -p "$CLAUDE_CONFIG_DIR"
fi

# Step 4: Generate Claude Desktop config
echo "⚙️  Step 2: Creating Claude Desktop configuration..."

cat > "$CLAUDE_CONFIG_DIR/claude_desktop_config.json" << EOF
{
  "mcpServers": {
    "servalsheets": {
      "command": "node",
      "args": [
        "$SCRIPT_DIR/dist/cli.js"
      ]
    }
  }
}
EOF

echo "✅ Configuration created!"
echo "   Location: $CLAUDE_CONFIG_DIR/claude_desktop_config.json"
echo ""

# Step 5: Verify setup
echo "🔍 Verifying setup..."
if [ -f ~/.servalsheets/tokens.json ]; then
    echo "   ✅ OAuth tokens: Found"
else
    echo "   ❌ OAuth tokens: Missing"
fi

if [ -f "$CLAUDE_CONFIG_DIR/claude_desktop_config.json" ]; then
    echo "   ✅ Claude config: Created"
else
    echo "   ❌ Claude config: Missing"
fi

if [ -f "$SCRIPT_DIR/dist/cli.js" ]; then
    echo "   ✅ Server binary: Found"
else
    echo "   ❌ Server binary: Missing"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                        Setup Complete! ✅                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 Next Steps:"
echo "   1. Quit Claude Desktop completely"
echo "   2. Reopen Claude Desktop"
echo "   3. ServalSheets should appear in the MCP servers list"
echo ""
echo "🧪 Test Commands:"
echo "   Try: 'List all available tools'"
echo "   Try: 'Create a test spreadsheet'"
echo "   Try: 'What can ServalSheets do?'"
echo ""
echo "📚 Documentation:"
echo "   Setup Guide: $SCRIPT_DIR/CLAUDE_DESKTOP_SETUP.md"
echo "   Testing Guide: $SCRIPT_DIR/TESTING_GUIDE.md"
echo ""
echo "🚀 Happy building with ServalSheets!"
