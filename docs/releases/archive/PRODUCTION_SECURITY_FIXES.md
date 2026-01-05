# Production Security Fixes - v1.1.1

**Date:** 2026-01-04
**Status:** In Progress

## Critical Fixes Applied

### ✅ CRITICAL-001: Version Mismatch
**Status:** FIXED
**Files Updated:**
- `src/http-server.ts` (3 occurrences)
- `src/server.ts` (1 occurrence)
- `src/remote-server.ts` (2 occurrences)
- `src/oauth-provider.ts` (1 occurrence)
- `server.json` (2 occurrences)
- `mcpb.json` (1 occurrence)

All version strings updated from `1.1.0` to `1.1.1`.

### 🔧 CRITICAL-002: Shell Script Injection Vulnerabilities
**Status:** IN PROGRESS
**Issue:** Install scripts use `echo -e "$ENV_VARS"` with unquoted variables in heredoc
**Risk:** Command injection if user input contains special characters

**Affected Files:**
- `install-claude-desktop.sh`
- `install-claude-desktop-noninteractive.sh`

**Solution:**
Instead of building a complex env vars string and using `echo -e`, we'll build the JSON properly using direct output or jq.

**Current vulnerable pattern:**
```bash
ENV_VARS="\"GOOGLE_APPLICATION_CREDENTIALS\": \"$CRED_PATH\""
if [ -n "$LOG_LEVEL" ]; then
    ENV_VARS="$ENV_VARS,\n    \"LOG_LEVEL\": \"$LOG_LEVEL\""
fi

SERVALSHEETS_ENTRY=$(cat <<EOF
{
  "command": "node",
  "args": ["$CLI_PATH"],
  "env": {
    $(echo -e "$ENV_VARS")  # VULNERABLE!
  }
}
EOF
)
```

**Fixed pattern:**
```bash
# Build JSON safely using jq or direct heredoc with escaped values
if command -v jq &> /dev/null; then
  # Use jq to build JSON safely
  SERVALSHEETS_ENTRY=$(jq -n \
    --arg cmd "node" \
    --arg cli "$CLI_PATH" \
    --arg cred "$CRED_PATH" \
    --arg log "${LOG_LEVEL:-}" \
    '{
      command: $cmd,
      args: [$cli],
      env: {
        GOOGLE_APPLICATION_CREDENTIALS: $cred
      } + (if $log != "" then {LOG_LEVEL: $log} else {} end)
    }'
  )
else
  # Fallback: Use printf with proper escaping
  cat > "$TEMP_FILE" <<EOF
{
  "command": "node",
  "args": ["$CLI_PATH"],
  "env": {
    "GOOGLE_APPLICATION_CREDENTIALS": "$CRED_PATH"
EOF

  if [ -n "$LOG_LEVEL" ]; then
    printf ',\n    "LOG_LEVEL": "%s"' "$LOG_LEVEL" >> "$TEMP_FILE"
  fi

  echo -e "\n  }\n}" >> "$TEMP_FILE"
  SERVALSHEETS_ENTRY=$(cat "$TEMP_FILE")
fi
```

### 🔧 CRITICAL-003: Placeholder Credentials
**Status:** PENDING
**Fix:** Remove hardcoded development paths from example configs

### 🔧 HIGH-002: Redirect URI Validation
**Status:** PENDING
**Fix:** Use URL parsing instead of string matching

## Remaining Critical Issues

See full analysis in production-analysis-report.md for complete list of 35 issues.

---

**Next Steps:**
1. Finish shell script injection fixes
2. Fix redirect URI validation
3. Update example configs
4. Add production checklist document
5. Run security audit
6. Test all fixes
