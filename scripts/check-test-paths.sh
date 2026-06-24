#!/usr/bin/env bash
# Fails if tests/ files use process.cwd() to build paths that route through
# sanitizeTokenStorePath() — which only allows paths under $HOME/tmpdir/tmp.
# Prevents regressions like #332 where security hardening broke token-store tests.

set -uo pipefail

cd "$(dirname "$0")/.."

VIOLATIONS=$(grep -rn "process\.cwd()" tests/ --include="*.ts" 2>/dev/null \
  | grep -iE "token|auth-path|TokenStore|\.encrypted" \
  || true)

if [ -n "$VIOLATIONS" ]; then
  echo "❌ Tests construct auth/token paths via process.cwd():"
  echo "$VIOLATIONS"
  echo ""
  echo "sanitizeTokenStorePath() at src/utils/auth-paths.ts:27-34 only allows"
  echo "paths under \$HOME, os.tmpdir(), /tmp, or /private/tmp. Use tmpdir()"
  echo "from 'os' instead — see commit for #332 for example."
  exit 1
fi

echo "✅ No process.cwd() used to build auth/token test paths"
