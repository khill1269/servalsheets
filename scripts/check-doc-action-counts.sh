#!/bin/bash
#
# Check documentation for incorrect action counts
# Ensures all references to action counts use the correct value (293)
#
# Usage: bash scripts/check-doc-action-counts.sh

set -e

# Get the correct action count from source of truth
EXPECTED=$(node -e "import('./src/schemas/annotations.js').then(m => console.log(m.ACTION_COUNT))" 2>/dev/null || echo "293")

echo "🔍 Checking documentation for incorrect action counts..."
echo "Expected: $EXPECTED actions"
echo ""

# Files to check
FILES=(
  "README.md"
  "CLAUDE.md"
  "CHANGELOG.md"
  "SERVALSHEETS_COMPLETE_MAP.md"
  "skill/SKILL.md"
  "skill/references/tool-guide.md"
  "src/mcp/completions.ts"
  "src/mcp/registration/prompt-registration.ts"
  "docs/"*.md
  "docs/guides/"*.md
)

ERRORS=0
INCORRECT_COUNTS=()

# Check for old action counts (272 and 291)
OLD_COUNTS=("272" "291")

for OLD_COUNT in "${OLD_COUNTS[@]}"; do
  echo "Searching for '$OLD_COUNT actions'..."

  # Search in markdown files
  FOUND=$(grep -rn "$OLD_COUNT actions" \
    --include="*.md" \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=.git \
    --exclude-dir=bundle \
    --exclude-dir=.plan \
    . 2>/dev/null || true)

  if [ -n "$FOUND" ]; then
    echo "❌ Found incorrect count '$OLD_COUNT actions' in markdown files:"
    echo "$FOUND"
    echo ""
    ERRORS=$((ERRORS + 1))
    INCORRECT_COUNTS+=("$OLD_COUNT")
  fi

  # Search in TypeScript files
  FOUND_TS=$(grep -rn "$OLD_COUNT actions" \
    --include="*.ts" \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=.git \
    src/ 2>/dev/null || true)

  if [ -n "$FOUND_TS" ]; then
    echo "❌ Found incorrect count '$OLD_COUNT actions' in TypeScript files:"
    echo "$FOUND_TS"
    echo ""
    ERRORS=$((ERRORS + 1))
  fi
done

# Check for generic "X actions" pattern that isn't the expected count
echo "Verifying all action count references..."
ALL_ACTION_REFS=$(grep -rn "[0-9]\+ actions" \
  --include="*.md" \
  --include="*.ts" \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=.git \
  --exclude-dir=bundle \
  --exclude-dir=.plan \
  --exclude-dir=tests \
  . 2>/dev/null | grep -v "$EXPECTED actions" | grep -v "test" || true)

if [ -n "$ALL_ACTION_REFS" ]; then
  echo "⚠️  Found references with counts other than $EXPECTED:"
  echo "$ALL_ACTION_REFS" | head -20
  echo ""
  if [ $(echo "$ALL_ACTION_REFS" | wc -l) -gt 20 ]; then
    echo "... and $(( $(echo "$ALL_ACTION_REFS" | wc -l) - 20 )) more"
  fi
fi

if [ $ERRORS -eq 0 ]; then
  echo "✅ All action counts are correct ($EXPECTED actions)"
  exit 0
else
  echo ""
  echo "❌ Found $ERRORS incorrect action count(s): ${INCORRECT_COUNTS[*]}"
  echo ""
  echo "To fix automatically, run:"
  echo "  bash scripts/fix-doc-action-counts.sh"
  exit 1
fi
