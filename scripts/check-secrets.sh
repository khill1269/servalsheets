#!/bin/bash
#
# Check for hardcoded secrets in source code.
# Catches common patterns: API keys, OAuth secrets, tokens.
#
set -e

echo "🔍 Checking for hardcoded secrets..."
FOUND=0

# Google OAuth client secret
if grep -rn "GOCSPX-" src/ --include="*.ts" 2>/dev/null | grep -v "process\.env\|example\|placeholder\|REDACTED"; then
  echo "❌ Found potential Google OAuth client secret in src/"
  FOUND=1
fi

# Google API key pattern
if grep -rn "AIza[A-Za-z0-9_-]\{35\}" src/ --include="*.ts" 2>/dev/null | grep -v "process\.env\|example\|placeholder\|REDACTED\|regex\|pattern\|test"; then
  echo "❌ Found potential Google API key in src/"
  FOUND=1
fi

# Anthropic API key
if grep -rn "sk-ant-[A-Za-z0-9-]\{20,\}" src/ --include="*.ts" 2>/dev/null | grep -v "process\.env\|example\|placeholder\|REDACTED"; then
  echo "❌ Found potential Anthropic API key in src/"
  FOUND=1
fi

# GitHub personal access token
if grep -rn "ghp_[A-Za-z0-9]\{36\}" src/ --include="*.ts" 2>/dev/null | grep -v "process\.env\|example\|placeholder\|REDACTED"; then
  echo "❌ Found potential GitHub token in src/"
  FOUND=1
fi

if [ $FOUND -eq 1 ]; then
  echo ""
  echo "❌ Found hardcoded secrets in source code"
  exit 1
fi

echo "✅ No hardcoded secrets detected"
