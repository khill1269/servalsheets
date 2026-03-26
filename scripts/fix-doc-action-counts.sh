#!/bin/bash
#
# Compatibility wrapper for docs count fixes.
# The old implementation encoded stale action totals and should not be used.
#
# Usage: bash scripts/fix-doc-action-counts.sh

set -e

echo "⚠️  scripts/fix-doc-action-counts.sh is now a compatibility wrapper."
echo "   Using the generated docs facts path instead of hardcoded historical counts."
echo ""

node scripts/gen-doc-facts.mjs
node scripts/sync-doc-counts.mjs --fix
node scripts/check-doc-action-counts.mjs
