#!/bin/bash
# ServalSheets - 4-Level Gate Pipeline
#
# MUST pass in order: G0 → G1 → G2 → G3 → G4
# Any gate failure stops the pipeline immediately
#
# G0: Baseline integrity (typecheck, lint, drift)
# G1: Metadata consistency (cross-map, hardcoded counts)
# G2: Phase behavior (handlers, integration, compliance)
# G3: API/protocol/docs quality (compliance, docs)
# G4: Final truth check (ESM-safe constants)
#
# Usage: bash scripts/validation-gates.sh
# CI: npm run gates

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "═══════════════════════════════════════"
echo "  GATE PIPELINE - ServalSheets"
echo "═══════════════════════════════════════"
echo ""

# G0: Baseline integrity
echo ""
echo "▶ G0: BASELINE INTEGRITY"
echo "───────────────────────────────────────"
npm run typecheck
npm run lint
npm run check:placeholders
npm run check:silent-fallbacks
npm run check:debug-prints
npm run check:drift
npm run validate:server-json
npm run test:fast
echo "✅ G0 passed"

# G1: Metadata/map consistency
echo ""
echo "▶ G1: METADATA CONSISTENCY"
echo "───────────────────────────────────────"
npm test -- --run tests/contracts/cross-map-consistency.test.ts
npm test -- --run tests/contracts/schema-handler-alignment.test.ts
bash scripts/check-hardcoded-counts.sh
npx tsx scripts/validate-schema-handler-alignment.ts
echo "✅ G1 passed"

# G2: Phase behavior
echo ""
echo "▶ G2: PHASE BEHAVIOR"
echo "───────────────────────────────────────"
npm run test:handlers
npm run test:integration
npm run test:compliance
echo "✅ G2 passed"

# G3: API/protocol/docs quality
echo ""
echo "▶ G3: API/PROTOCOL/DOCS"
echo "───────────────────────────────────────"
npm run validate:compliance
npm run docs:validate || echo "⚠️  Docs validation has warnings (non-blocking)"
bash scripts/docs-freshness-check.sh || echo "⚠️  Some docs have stale counts (non-blocking)"
echo "✅ G3 passed"

# G4: Final truth check (ESM-safe)
echo ""
echo "▶ G4: FINAL TRUTH CHECK"
echo "───────────────────────────────────────"
npm run build > /dev/null 2>&1
node --input-type=module <<'EOF'
import { TOOL_COUNT, ACTION_COUNT } from './dist/schemas/action-counts.js';
if (TOOL_COUNT !== 22) {
  console.error('❌ Source of truth mismatch: TOOL_COUNT=' + TOOL_COUNT + ' (expected 22)');
  process.exit(1);
}
if (ACTION_COUNT < 200) {
  console.error('❌ Source of truth mismatch: ACTION_COUNT=' + ACTION_COUNT + ' (suspiciously low)');
  process.exit(1);
}
console.log('✓ Source of truth confirmed: ' + TOOL_COUNT + ' tools, ' + ACTION_COUNT + ' actions');
EOF
echo "✅ G4 passed"

# G5: Audit validation & score
echo ""
echo "▶ G5: AUDIT VALIDATION & SCORE"
echo "───────────────────────────────────────"

# Validate any audit documents present
if [ -f "SCHEMA_HANDLER_ALIGNMENT_AUDIT.md" ] || \
   [ -f "*_AUDIT.md" ] || \
   [ -f "*_ANALYSIS.md" ]; then
  echo "Validating audit claims..."
  bash scripts/verify-audit-claims.sh || {
    echo "❌ Audit claims validation failed"
    exit 1
  }
fi

# Check npm audit score
npm run audit:quick > /dev/null 2>&1
if [ -f "audit-output/quick-results.json" ]; then
  SCORE=$(node --input-type=module -e "import fs from 'fs'; const data = JSON.parse(fs.readFileSync('audit-output/quick-results.json', 'utf8')); console.log(data.total_percentage);")
  THRESHOLD=85

  echo "Quick audit score: ${SCORE}%"

  if (( $(echo "$SCORE < $THRESHOLD" | bc -l) )); then
    echo "❌ Audit score below threshold: ${SCORE}% < ${THRESHOLD}%"
    exit 1
  else
    echo "✓ Audit score meets threshold: ${SCORE}% ≥ ${THRESHOLD}%"
  fi
else
  echo "⚠️  Quick audit results not found, skipping score check"
fi
echo "✅ G5 passed"

echo ""
echo "═══════════════════════════════════════"
echo "  ✅ ALL GATES PASSED (G0-G5)"
echo "═══════════════════════════════════════"
