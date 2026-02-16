#!/bin/bash
# Check for Hardcoded Tool/Action Count References
#
# Detects hardcoded numbers in source files that should reference
# TOOL_COUNT or ACTION_COUNT constants instead.
#
# This prevents drift when tools/actions are added but comments aren't updated.
#
# Exit codes:
# - 0: No hardcoded count references found
# - 1: Hardcoded references detected

set -e

echo "🔍 Checking for hardcoded tool/action count references..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Patterns to detect hardcoded counts
# Note: We allow these patterns in specific contexts (imports, constants)
PATTERNS=(
  "[0-9]{2,3} tools"
  "[0-9]{2,3} actions"
  "\\b(21|22|23) tools\\b"
  "\\b(294|298|300) actions\\b"
)

VIOLATIONS=()
VIOLATION_COUNT=0

# Directories to search
SEARCH_DIRS="src/"

# Files to exclude (where hardcoded counts are acceptable)
EXCLUDE_PATTERNS=(
  "src/schemas/index.ts"        # Constants defined here
  "src/version.ts"               # Version metadata
  "package.json"                 # NPM metadata
  "server.json"                  # Generated metadata
)

# Build grep exclude arguments
EXCLUDE_ARGS=""
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
  EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude=$pattern"
done

echo ""
echo "Searching in: $SEARCH_DIRS"
echo "Excluding: ${EXCLUDE_PATTERNS[*]}"
echo ""

# Search for each pattern
for pattern in "${PATTERNS[@]}"; do
  # Use grep with Perl regex for better pattern matching
  matches=$(grep -rn -P "$pattern" $SEARCH_DIRS \
    $EXCLUDE_ARGS \
    --include="*.ts" \
    --include="*.js" \
    2>/dev/null || true)

  if [ ! -z "$matches" ]; then
    # Filter out lines that are importing or referencing constants
    filtered_matches=$(echo "$matches" | grep -v "TOOL_COUNT\|ACTION_COUNT\|import\|export const" || true)

    if [ ! -z "$filtered_matches" ]; then
      VIOLATIONS+=("$filtered_matches")
      VIOLATION_COUNT=$((VIOLATION_COUNT + $(echo "$filtered_matches" | wc -l)))
    fi
  fi
done

# Report results
if [ ${#VIOLATIONS[@]} -gt 0 ]; then
  echo -e "${RED}❌ Found hardcoded count references:${NC}\n"

  for violation in "${VIOLATIONS[@]}"; do
    # Parse and format each violation
    while IFS= read -r line; do
      if [ ! -z "$line" ]; then
        # Extract file, line number, and content
        file=$(echo "$line" | cut -d: -f1)
        line_num=$(echo "$line" | cut -d: -f2)
        content=$(echo "$line" | cut -d: -f3-)

        echo -e "${YELLOW}$file:$line_num${NC}"
        echo "  $content"
        echo ""
      fi
    done <<< "$violation"
  done

  echo -e "${RED}Total violations: $VIOLATION_COUNT${NC}\n"
  echo "These hardcoded counts should reference TOOL_COUNT or ACTION_COUNT constants."
  echo "Or use dynamic comments like: 'See TOOL_COUNT in src/schemas/index.ts'"
  echo ""
  exit 1
else
  echo -e "${GREEN}✅ No hardcoded count references found${NC}"
  echo ""
  echo "All tool/action count references use constants or are properly excluded."
  exit 0
fi
