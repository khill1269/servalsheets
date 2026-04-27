#!/usr/bin/env node
/**
 * Generate .serval/ground-truth.json
 *
 * Extracts security defaults and MCP feature implementation locations from
 * source files and produces a machine-readable registry for audit tooling.
 *
 * Usage:
 *   node scripts/generate-ground-truth-registry.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ============================================================================
// Security Defaults — extracted from src/config/env.ts
// ============================================================================

function extractSecurityDefaults() {
  const envTs = readFileSync(join(ROOT, 'src/config/env.ts'), 'utf8');

  /**
   * Extract the .default(value) for a given env var name.
   * Handles: StrictBooleanSchema.default(false), z.boolean().default(true), etc.
   */
  function extractDefault(varName) {
    // Match: VAR_NAME: <something>.default(value)
    const re = new RegExp(`${varName}\\s*:\\s*[^,\\n]+\\.default\\(([^)]+)\\)`, 'm');
    const m = envTs.match(re);
    if (!m) return null;
    const raw = m[1].trim();
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw.replace(/['"]/g, '');
  }

  // OTEL_ENABLED has no .default() — it uses StrictBooleanSchema bare (defaults to env-required)
  // Checking the line context: if no default annotation, the absence of default means required/no-default.
  const otelLine = envTs.match(/OTEL_ENABLED\s*:\s*([^\n,]+)/m);
  const otelDefault = otelLine
    ? otelLine[1].includes('.default(') ? extractDefault('OTEL_ENABLED') : null
    : null;

  return {
    rbacEnabled: extractDefault('ENABLE_RBAC') ?? false,
    // CORS localhost-in-prod is not a Zod field — it's a hardcoded allowance in the HTTP layer
    corsLocalhostInProduction: true,
    samplingConsentRequired: extractDefault('SAMPLING_CONSENT_REQUIRED') ?? true,
    auditLoggingEnabled: extractDefault('ENABLE_AUDIT_LOGGING') ?? false,
    otelEnabled: otelDefault,
  };
}

// ============================================================================
// MCP Features — declared in src/mcp/features-2025-11-25.ts
// ============================================================================

const FEATURES = {
  completions: {
    declaredFile: 'src/mcp/features-2025-11-25.ts',
    declaredSymbol: 'completions:',
    implementedFile: 'src/server/control-plane-registration.ts',
    implementedSymbol: 'registerToolCompletionHandler',
  },
  sampling: {
    declaredFile: 'src/mcp/features-2025-11-25.ts',
    declaredSymbol: 'SEP-1577 Sampling',
    implementedFile: 'src/mcp/sampling.ts',
    implementedSymbol: 'checkSamplingSupport',
  },
  elicitation: {
    declaredFile: 'src/mcp/features-2025-11-25.ts',
    declaredSymbol: 'SEP-1036 Elicitation',
    implementedFile: 'src/mcp/elicitation.ts',
    implementedSymbol: 'checkElicitationSupport',
  },
  tasks: {
    declaredFile: 'src/mcp/features-2025-11-25.ts',
    declaredSymbol: 'SEP-1686 Tasks',
    implementedFile: 'src/core/task-store-adapter.ts',
    implementedSymbol: 'TaskStoreAdapter',
  },
  listChanged: {
    declaredFile: 'src/mcp/features-2025-11-25.ts',
    declaredSymbol: 'listChanged notifications',
    implementedFile: 'src/mcp/registration/tool-stage-manager.ts',
    implementedSymbol: 'STAGED_REGISTRATION',
  },
  logging: {
    declaredFile: 'src/mcp/features-2025-11-25.ts',
    declaredSymbol: 'Logging capability',
    implementedFile: 'src/utils/logger.ts',
    implementedSymbol: 'logger',
  },
};

function findLineNumber(filePath, symbol) {
  try {
    const content = readFileSync(join(ROOT, filePath), 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(symbol)) {
        return i + 1;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function grepLineNumber(filePath, symbol) {
  try {
    const result = execSync(
      `grep -n "${symbol}" "${join(ROOT, filePath)}" | head -1`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    if (!result) return null;
    return parseInt(result.split(':')[0], 10);
  } catch {
    return null;
  }
}

function resolveFeature(name, spec) {
  const declaredLine = findLineNumber(spec.declaredFile, spec.declaredSymbol ?? `${name}:`);
  const implementedLine = grepLineNumber(spec.implementedFile, spec.implementedSymbol);

  const declaredRef = declaredLine
    ? `${spec.declaredFile}:${declaredLine}`
    : `${spec.declaredFile}:?`;
  const implementedRef = implementedLine
    ? `${spec.implementedFile}:${implementedLine}`
    : null;

  // Determine status: IMPLEMENTED if we found the symbol in the implementation file
  let status = 'UNKNOWN';
  if (implementedRef) {
    status = 'IMPLEMENTED';
  } else {
    // Check if the implementation file even exists
    try {
      readFileSync(join(ROOT, spec.implementedFile), 'utf8');
      status = 'DECLARED_ONLY'; // File exists but symbol not found
    } catch {
      status = 'MISSING'; // Implementation file doesn't exist
    }
  }

  return {
    declared: declaredRef,
    implemented: implementedRef ?? `${spec.implementedFile}:?`,
    status,
  };
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const securityDefaults = extractSecurityDefaults();

  const features = {};
  for (const [name, spec] of Object.entries(FEATURES)) {
    features[name] = resolveFeature(name, spec);
  }

  const registry = {
    generatedAt: new Date().toISOString(),
    securityDefaults,
    features,
    knownStaleComments: [],
  };

  const outPath = join(ROOT, '.serval/ground-truth.json');
  writeFileSync(outPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify(registry, null, 2));
}

main();
