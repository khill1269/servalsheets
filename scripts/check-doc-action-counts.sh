#!/bin/bash
#
# Comprehensive Documentation Count Validation
#
# Validates that documentation references match source of truth:
# - Tool counts (TOOL_COUNT constant)
# - Action counts (ACTION_COUNT constant)
#
# Excludes CHANGELOG.md (historical records are acceptable)
#
# Exit codes:
# - 0: All documentation synchronized
# - 1: Documentation count mismatches detected
#
# Usage: bash scripts/check-doc-action-counts.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Comprehensive documentation validation..."
echo ""

# Get source of truth from built files
if [ ! -d "dist" ]; then
  echo "❌ dist/ directory not found. Run 'npm run build' first."
  exit 1
fi

SOURCE_TOOL_COUNT=$(node -p "require('./dist/schemas/index.js').TOOL_COUNT" 2>/dev/null || echo "0")
SOURCE_ACTION_COUNT=$(node -p "require('./dist/schemas/index.js').ACTION_COUNT" 2>/dev/null || echo "0")

if [ "$SOURCE_TOOL_COUNT" = "0" ] || [ "$SOURCE_ACTION_COUNT" = "0" ]; then
  echo "❌ Failed to load constants from dist/schemas/index.js"
  exit 1
fi

echo -e "${GREEN}Source of truth: ${SOURCE_TOOL_COUNT} tools, ${SOURCE_ACTION_COUNT} actions${NC}"
echo ""

# Critical documentation files that MUST match exactly
CRITICAL_DOCS=(
  "README.md"
  "CLAUDE.md"
  "docs/guides/SKILL.md"
  "docs/development/PROJECT_STATUS.md"
  "docs/development/SOURCE_OF_TRUTH.md"
)

# Additional files to check (warnings only)
ADDITIONAL_DOCS=(
  "src/mcp/completions.ts"
  "src/mcp/registration/prompt-registration.ts"
  "src/config/constants.ts"
  "src/schemas/descriptions.ts"
  "src/schemas/action-metadata.ts"
)

# Files to EXCLUDE (historical records, archived content)
EXCLUDE_PATTERNS=(
  "CHANGELOG.md"
  "docs/archive/"
  "docs/generated/"
  ".plan/"
  "node_modules/"
  "dist/"
  ".git/"
)

ERRORS=()
WARNINGS=()

# ============================================================================
# VALIDATION 1: Critical Documentation Files (exact match required)
# ============================================================================

echo "Validating critical documentation files..."

for doc in "${CRITICAL_DOCS[@]}"; do
  if [ ! -f "$doc" ]; then
    WARNINGS+=("⚠️  Critical doc not found: $doc")
    continue
  fi

  # Check for combined "X tools, Y actions" pattern (most reliable)
  COMBINED_REFS=$(grep -E '[0-9]+ tools,? ([0-9]+ )?actions' "$doc" 2>/dev/null || true)

  if [ -n "$COMBINED_REFS" ]; then
    # Extract tool count from combined pattern (deduplicate with sort -u)
    TOOL_IN_COMBINED=$(echo "$COMBINED_REFS" | grep -oE '[0-9]+ tools' | grep -oE '[0-9]+' | sort -u || true)
    # Check each unique count (allows multiple correct references)
    for count in $TOOL_IN_COMBINED; do
      if [ "$count" != "$SOURCE_TOOL_COUNT" ]; then
        ERRORS+=("$doc: combined pattern has '$count tools' (expected '$SOURCE_TOOL_COUNT tools')")
      fi
    done

    # Extract action count from combined pattern (deduplicate with sort -u)
    ACTION_IN_COMBINED=$(echo "$COMBINED_REFS" | grep -oE '[0-9]+ actions' | grep -oE '[0-9]+' | sort -u || true)
    # Check each unique count (allows multiple correct references)
    for count in $ACTION_IN_COMBINED; do
      if [ "$count" != "$SOURCE_ACTION_COUNT" ]; then
        ERRORS+=("$doc: combined pattern has '$count actions' (expected '$SOURCE_ACTION_COUNT actions')")
      fi
    done
  fi

  # Check for standalone total references (filter out per-tool counts)
  # Only flag if pattern suggests it's a total (near words like "total", "all", or at start of line)
  TOTAL_TOOL_REFS=$(grep -iE '(^|total|all|provides)\s+[0-9]+ tools' "$doc" 2>/dev/null | grep -oE '[0-9]+ tools' | grep -oE '[0-9]+' | sort -u || true)

  for count in $TOTAL_TOOL_REFS; do
    if [ "$count" != "$SOURCE_TOOL_COUNT" ]; then
      ERRORS+=("$doc: total tool count is '$count tools' (expected '$SOURCE_TOOL_COUNT tools')")
    fi
  done
done

if [ ${#ERRORS[@]} -eq 0 ]; then
  echo -e "  ${GREEN}✅ All critical docs match source of truth${NC}"
else
  echo -e "  ${RED}❌ Found ${#ERRORS[@]} mismatch(es) in critical docs${NC}"
fi

echo ""

# ============================================================================
# VALIDATION 2: Additional Documentation Files (warnings only)
# ============================================================================

echo "Checking additional documentation files..."

for doc in "${ADDITIONAL_DOCS[@]}"; do
  if [ ! -f "$doc" ]; then
    continue
  fi

  # Check for combined "X tools, Y actions" pattern
  COMBINED_REFS=$(grep -E '[0-9]+ tools,? ([0-9]+ )?actions' "$doc" 2>/dev/null || true)

  if [ -n "$COMBINED_REFS" ]; then
    # Extract tool count from combined pattern (deduplicate with sort -u)
    TOOL_IN_COMBINED=$(echo "$COMBINED_REFS" | grep -oE '[0-9]+ tools' | grep -oE '[0-9]+' | sort -u || true)
    # Check each unique count
    for count in $TOOL_IN_COMBINED; do
      if [ "$count" != "$SOURCE_TOOL_COUNT" ]; then
        WARNINGS+=("$doc: combined pattern has '$count tools' (expected '$SOURCE_TOOL_COUNT tools')")
      fi
    done

    # Extract action count from combined pattern (deduplicate with sort -u)
    ACTION_IN_COMBINED=$(echo "$COMBINED_REFS" | grep -oE '[0-9]+ actions' | grep -oE '[0-9]+' | sort -u || true)
    # Check each unique count
    for count in $ACTION_IN_COMBINED; do
      if [ "$count" != "$SOURCE_ACTION_COUNT" ]; then
        WARNINGS+=("$doc: combined pattern has '$count actions' (expected '$SOURCE_ACTION_COUNT actions')")
      fi
    done
  fi
done

if [ ${#WARNINGS[@]} -eq 0 ]; then
  echo -e "  ${GREEN}✅ All additional docs match source of truth${NC}"
else
  echo -e "  ${YELLOW}⚠️  Found ${#WARNINGS[@]} potential issue(s) in additional docs${NC}"
fi

echo ""

# ============================================================================
# VALIDATION 3: Scan for Old/Incorrect Count References
# ============================================================================

echo "Scanning for obsolete count references..."

# Known old counts to flag
OLD_TOOL_COUNTS=("20" "21")
OLD_ACTION_COUNTS=("272" "291" "293" "294")

OBSOLETE_FOUND=0

# Build exclude arguments for grep
GREP_EXCLUDES=""
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
  GREP_EXCLUDES="$GREP_EXCLUDES --exclude-dir=$pattern"
done

for old_count in "${OLD_TOOL_COUNTS[@]}"; do
  if [ "$old_count" = "$SOURCE_TOOL_COUNT" ]; then
    continue
  fi

  FOUND=$(grep -rn "$old_count tools" \
    --include="*.md" \
    --include="*.ts" \
    $GREP_EXCLUDES \
    . 2>/dev/null || true)

  if [ -n "$FOUND" ]; then
    echo -e "${YELLOW}⚠️  Found obsolete count '$old_count tools':${NC}"
    echo "$FOUND" | head -5
    OBSOLETE_FOUND=$((OBSOLETE_FOUND + 1))
    echo ""
  fi
done

for old_count in "${OLD_ACTION_COUNTS[@]}"; do
  if [ "$old_count" = "$SOURCE_ACTION_COUNT" ]; then
    continue
  fi

  FOUND=$(grep -rn "$old_count actions" \
    --include="*.md" \
    --include="*.ts" \
    $GREP_EXCLUDES \
    . 2>/dev/null || true)

  if [ -n "$FOUND" ]; then
    echo -e "${YELLOW}⚠️  Found obsolete count '$old_count actions':${NC}"
    echo "$FOUND" | head -5
    OBSOLETE_FOUND=$((OBSOLETE_FOUND + 1))
    echo ""
  fi
done

if [ $OBSOLETE_FOUND -eq 0 ]; then
  echo -e "  ${GREEN}✅ No obsolete count references found${NC}"
fi

echo ""

# ============================================================================
# SUMMARY AND EXIT
# ============================================================================

echo "========================================================================"
echo ""

if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo -e "${YELLOW}⚠️  WARNINGS (non-critical):${NC}"
  echo ""
  for warning in "${WARNINGS[@]}"; do
    echo -e "  ${YELLOW}$warning${NC}"
  done
  echo ""
fi

if [ ${#ERRORS[@]} -eq 0 ]; then
  echo -e "${GREEN}✅ DOCUMENTATION VALIDATION PASSED${NC}"
  echo ""
  echo "   Source of truth: $SOURCE_TOOL_COUNT tools, $SOURCE_ACTION_COUNT actions"
  echo "   All critical documentation is synchronized."
  echo ""

  if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo "   Run 'bash scripts/fix-doc-action-counts.sh' to fix warnings."
    echo ""
  fi

  exit 0
else
  echo -e "${RED}❌ DOCUMENTATION VALIDATION FAILED${NC}"
  echo ""
  echo "   Found ${#ERRORS[@]} critical error(s):"
  echo ""
  for error in "${ERRORS[@]}"; do
    echo -e "   ${RED}- $error${NC}"
  done
  echo ""
  echo "   To fix automatically, run:"
  echo "     bash scripts/fix-doc-action-counts.sh"
  echo ""
  exit 1
fi
