#!/bin/bash
# G11: Scan for hardcoded secrets, API keys, and tokens in src/.
# Exempts: placeholder strings, env var patterns, tool hash baseline.
#
# Pass condition: 0 matches

set -e

# Patterns: api_key, apikey, secret, token followed by = or : and a long literal value
# Excludes: ${...}, REPLACE_WITH_*, process.env, placeholder patterns, comments
COUNT=$(rg -i "(api[_-]?key|apikey|client_secret|bearer[_-]?token|access[_-]?token|refresh[_-]?token)\s*[:=]\s*['\"][A-Za-z0-9_\-\.\/+]{20,}['\"]" \
  src/ --type ts \
  --glob '!src/config/embedded-oauth.ts' \
  --glob '!src/security/**' \
  2>/dev/null | grep -v "REPLACE_WITH_\|process\.env\|getEnv()\|TODO\|example\|test\|mock\|fake\|dummy" \
  | wc -l | tr -d ' ')

if [ "$COUNT" -gt 0 ]; then
  echo "❌ G11 FAILED: Found $COUNT possible hardcoded secret(s) in src/"
  echo "   Move credentials to environment variables."
  rg -i "(api[_-]?key|apikey|client_secret|bearer[_-]?token|access[_-]?token|refresh[_-]?token)\s*[:=]\s*['\"][A-Za-z0-9_\-\.\/+]{20,}['\"]" \
    src/ --type ts \
    --glob '!src/config/embedded-oauth.ts' \
    --glob '!src/security/**' \
    | grep -v "REPLACE_WITH_\|process\.env\|getEnv()\|TODO\|example\|test\|mock\|fake\|dummy"
  exit 1
fi

echo "✅ G11 hardcoded-secrets: no hardcoded credentials detected in src/"
