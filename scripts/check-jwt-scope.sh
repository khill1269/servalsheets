#!/bin/bash
# G10: Verify jwt.sign() only appears in auth/, security/, utils/, oauth-provider.ts,
# and handler auth files. JWT creation outside these auth-adjacent paths is a security red flag.
#
# Allowed paths:
#   src/auth/**          — primary auth subsystem
#   src/security/**      — security subsystem (saml-provider.ts lives here)
#   src/utils/**         — shared utils (token helpers)
#   src/oauth-provider.ts — OAuth 2.0 authorization server (legitimately issues JWTs)
#   src/handlers/auth.ts — auth handler
#
# Pass condition: 0 matches outside allowed paths

set -e

COUNT=$(rg "jwt\.sign\(" src/ --type ts \
  --glob '!src/auth/**' \
  --glob '!src/security/**' \
  --glob '!src/utils/**' \
  --glob '!src/oauth-provider.ts' \
  --glob '!src/handlers/auth.ts' \
  2>/dev/null | wc -l | tr -d ' ')

if [ "$COUNT" -gt 0 ]; then
  echo "❌ G10 FAILED: Found $COUNT jwt.sign() call(s) outside auth-subsystem files"
  echo "   JWT creation must be confined to src/auth/, src/security/, src/utils/, or src/oauth-provider.ts."
  rg "jwt\.sign\(" src/ --type ts \
    --glob '!src/auth/**' \
    --glob '!src/security/**' \
    --glob '!src/utils/**' \
    --glob '!src/oauth-provider.ts' \
    --glob '!src/handlers/auth.ts'
  exit 1
fi

echo "✅ G10 jwt-scope: jwt.sign() confined to auth-subsystem files"
