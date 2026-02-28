#!/usr/bin/env bash
#
# Release readiness checks for production publishing.
# Fail-fast by design.

set -euo pipefail

echo "Release readiness: check:drift"
npm run check:drift

echo "Release readiness: check:placeholders"
npm run check:placeholders

echo "Release readiness: check:doc-action-counts"
npm run check:doc-action-counts

echo "Release readiness: typecheck"
npm run typecheck

echo "Release readiness: format:check"
npm run format:check

echo "Release readiness: validate:alignment"
npm run validate:alignment

echo "Release readiness: validate:compliance"
npm run validate:compliance

echo "Release readiness: validate:mcp-protocol"
npm run validate:mcp-protocol

echo "Release readiness: test:compliance"
npm run test:compliance

echo "Release readiness: check:integration-wiring"
npm run check:integration-wiring

echo "Release readiness checks passed."
