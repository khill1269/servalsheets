#!/bin/bash
# Build ServalSheets .mcpb bundle for Claude Desktop
# Creates a distributable bundle with all dependencies

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUNDLE_DIR="$PROJECT_ROOT/bundle"
SERVER_DIR="$BUNDLE_DIR/server"
OUTPUT_FILE="$PROJECT_ROOT/servalsheets.mcpb"

echo "Building ServalSheets .mcpb bundle..."

# Step 1: Build the project
echo "Step 1/5: Building project..."
cd "$PROJECT_ROOT"
npm run build

# Step 2: Clean and prepare bundle directory
echo "Step 2/5: Preparing bundle directory..."
rm -rf "$SERVER_DIR"
mkdir -p "$SERVER_DIR"

# Step 3: Copy dist files to bundle/server
echo "Step 3/5: Copying dist files..."
cp -r "$PROJECT_ROOT/dist/"* "$SERVER_DIR/"

# Step 4: Copy production dependencies
echo "Step 4/5: Installing production dependencies..."
cp "$PROJECT_ROOT/package.json" "$SERVER_DIR/package.json"

# Create a minimal package.json for the bundle
cat > "$SERVER_DIR/package.json" << 'EOF'
{
  "name": "servalsheets-bundle",
  "version": "1.4.0",
  "type": "module",
  "main": "index.js",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.2",
    "compression": "^1.8.1",
    "cors": "^2.8.5",
    "dotenv": "^17.2.3",
    "express": "^5.2.1",
    "express-rate-limit": "^8.2.1",
    "googleapis": "^170.0.0",
    "helmet": "^8.0.0",
    "jsonwebtoken": "^9.0.2",
    "lru-cache": "^11.0.0",
    "open": "^11.0.0",
    "p-queue": "^9.0.1",
    "prom-client": "^15.1.3",
    "uuid": "^13.0.0",
    "winston": "^3.17.0",
    "zod": "4.3.5"
  }
}
EOF

# Install production dependencies in the server directory
cd "$SERVER_DIR"
npm install --omit=dev --ignore-scripts --no-audit --no-fund 2>/dev/null

# Step 5: Create the .mcpb archive
echo "Step 5/5: Creating .mcpb bundle..."
cd "$BUNDLE_DIR"

# Remove old bundle if exists
rm -f "$OUTPUT_FILE"

# Create the zip (mcpb is a zip file)
zip -r "$OUTPUT_FILE" manifest.json server/ icon.png 2>/dev/null || \
zip -r "$OUTPUT_FILE" manifest.json server/

# Calculate size
BUNDLE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)

echo ""
echo "=========================================="
echo " ServalSheets Bundle Created Successfully"
echo "=========================================="
echo ""
echo "  Output: $OUTPUT_FILE"
echo "  Size:   $BUNDLE_SIZE"
echo ""
echo "To install in Claude Desktop:"
echo "  1. Open Claude Desktop"
echo "  2. Go to Settings > Extensions"
echo "  3. Click 'Install from file'"
echo "  4. Select: servalsheets.mcpb"
echo ""
echo "Or double-click the .mcpb file to install."
echo ""
