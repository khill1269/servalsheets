#!/usr/bin/env bash
# check-sdk-drift.sh — Detect when openapi.yaml / server.json have changed
# since SDKs were last generated.
#
# Usage: bash scripts/check-sdk-drift.sh
# Exit 0 = SDKs are up-to-date (or baseline not yet recorded).
# Exit 1 = Source inputs changed since last `npm run gen:sdks`.
#
# The hash baseline is stored in .serval/sdk-source-hash (committed).
# Update it by running: npm run gen:sdks (which calls this script with --record).

set -euo pipefail

HASH_FILE=".serval/sdk-source-hash"
RECORD_MODE="${1:-}"

# Compute a combined hash of the two files that drive SDK generation.
# Using sha256sum on Linux, shasum on macOS.
compute_hash() {
  local files="openapi.yaml server.json"
  if command -v sha256sum &>/dev/null; then
    cat $files | sha256sum | awk '{print $1}'
  else
    cat $files | shasum -a 256 | awk '{print $1}'
  fi
}

# Verify source files exist
for f in openapi.yaml server.json; do
  if [ ! -f "$f" ]; then
    echo "⚠️  check-sdk-drift: $f not found, skipping drift check"
    exit 0
  fi
done

CURRENT_HASH=$(compute_hash)

if [ "$RECORD_MODE" = "--record" ]; then
  echo "$CURRENT_HASH" > "$HASH_FILE"
  echo "✓ SDK source hash recorded: ${CURRENT_HASH:0:12}..."
  exit 0
fi

if [ ! -f "$HASH_FILE" ]; then
  echo "ℹ️  No SDK source hash baseline found — run 'npm run gen:sdks' to establish one."
  exit 0
fi

BASELINE_HASH=$(cat "$HASH_FILE")

if [ "$CURRENT_HASH" != "$BASELINE_HASH" ]; then
  echo ""
  echo "❌ SDK DRIFT DETECTED"
  echo "   openapi.yaml or server.json changed since SDKs were last generated."
  echo "   Run 'npm run gen:sdks' to regenerate SDKs and update the baseline."
  echo "   Baseline: ${BASELINE_HASH:0:12}..."
  echo "   Current:  ${CURRENT_HASH:0:12}..."
  echo ""
  exit 1
fi

echo "✓ SDK source inputs unchanged (hash: ${CURRENT_HASH:0:12}...)"
exit 0
