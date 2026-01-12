#!/bin/bash
# ServalSheets Audit - Phase 0: Evidence Collection
# Runs all evidence collection in parallel (background)

set -e

echo "🔍 ServalSheets Audit - Phase 0: Evidence Collection"
echo "=================================================="
echo ""

# Create output structure
echo "📁 Creating output directories..."
mkdir -p analysis-output/{evidence,metrics,category-reports}
echo "✅ Directories created"
echo ""

# Track background PIDs
declare -a PIDS=()

# Function to run command in background
run_bg() {
    local name="$1"
    local cmd="$2"
    local output="$3"

    echo "🚀 Starting: $name"
    eval "$cmd > $output 2>&1" &
    PIDS+=($!)
}

# Start all evidence collection in parallel
echo "Starting parallel evidence collection..."
echo ""

run_bg "CI Pipeline" "npm run ci" "analysis-output/evidence/ci.log"
run_bg "Test Suite (Verbose)" "npm test -- --reporter=verbose" "analysis-output/evidence/tests-detailed.log"
run_bg "Coverage Report" "npm run test:coverage" "analysis-output/evidence/coverage.log"
run_bg "Type Check" "npm run typecheck" "analysis-output/evidence/typecheck.log"
run_bg "Lint Analysis" "npm run lint" "analysis-output/evidence/lint.log"
run_bg "Security Audit" "npm audit --json" "analysis-output/evidence/audit.json"
run_bg "Dependency Tree" "npm ls --json" "analysis-output/evidence/deps.json"
run_bg "Build Process" "npm run build" "analysis-output/evidence/build.log"

# Code metrics (sync, fast)
echo "📊 Collecting code metrics..."
find src -name "*.ts" -exec wc -l {} + > analysis-output/metrics/loc.txt 2>&1
find tests -name "*.test.ts" | wc -l > analysis-output/metrics/test-count.txt 2>&1
node -p "JSON.stringify(require('./package.json'), null, 2)" > analysis-output/evidence/package.json 2>&1
echo "✅ Code metrics collected"
echo ""

# Wait for all background processes
echo "⏳ Waiting for all evidence collection to complete..."
echo "   (This may take 2-5 minutes depending on system)"
echo ""

FAILED=0
for i in "${!PIDS[@]}"; do
    pid=${PIDS[$i]}
    if wait $pid; then
        echo "   ✅ Process $((i+1))/${#PIDS[@]} completed"
    else
        echo "   ⚠️  Process $((i+1))/${#PIDS[@]} failed (continuing anyway)"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "=================================================="
echo "Phase 0 Complete!"
echo ""
echo "📊 Evidence Summary:"
echo "   - Evidence files: $(ls -1 analysis-output/evidence/ | wc -l)"
echo "   - Metric files: $(ls -1 analysis-output/metrics/ | wc -l)"
if [ $FAILED -gt 0 ]; then
    echo "   - ⚠️  Failed processes: $FAILED"
fi
echo ""
echo "📁 Evidence location: analysis-output/evidence/"
echo "📁 Metrics location: analysis-output/metrics/"
echo ""
echo "Next step: Run Phase 1 (Parallel Category Analysis)"
echo ""
