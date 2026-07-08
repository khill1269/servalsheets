#!/usr/bin/env node
/**
 * npm audit wrapper that allows specific GHSAs to pass through.
 *
 * Usage: node scripts/audit-with-exceptions.mjs [--audit-level=high] GHSA-xxx GHSA-yyy ...
 *
 * Replaces `npm audit --allow-ghsas` which is unreliable in npm 10.9.x.
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'node:url';

const SECURITY_EXCEPTIONS_PATH = fileURLToPath(new URL('../SECURITY_EXCEPTIONS.md', import.meta.url));

// Parse GHSA IDs from SECURITY_EXCEPTIONS.md
function loadAllowedGhsas() {
  const md = readFileSync(SECURITY_EXCEPTIONS_PATH, 'utf8');
  const ghsaPattern = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/g;
  return new Set(md.match(ghsaPattern) ?? []);
}

// Run npm audit and get JSON output
function runAudit() {
  try {
    const output = execSync('npm audit --json', { stdio: ['ignore', 'pipe', 'pipe'] });
    return JSON.parse(output.toString());
  } catch (err) {
    // npm audit exits non-zero when vulnerabilities found — parse stdout anyway
    const stdout = err.stdout?.toString() ?? '{}';
    try {
      return JSON.parse(stdout);
    } catch {
      console.error('Failed to parse npm audit output');
      process.exit(1);
    }
  }
}

const auditLevelArg = process.argv.find(a => a.startsWith('--audit-level='));
const auditLevel = auditLevelArg ? auditLevelArg.split('=')[1] : 'high';

const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical'];
const minSeverityIdx = SEVERITY_ORDER.indexOf(auditLevel);

const allowedGhsas = loadAllowedGhsas();
const auditReport = runAudit();

const vulns = auditReport.vulnerabilities ?? {};
const newVulns = [];

for (const [pkgName, vuln] of Object.entries(vulns)) {
  if (!Array.isArray(vuln.via)) continue;

  for (const via of vuln.via) {
    if (typeof via !== 'object') continue;

    const severityIdx = SEVERITY_ORDER.indexOf(via.severity);
    if (severityIdx < minSeverityIdx) continue;

    const ghsaUrl = via.url ?? '';
    const ghsaId = ghsaUrl.split('/advisories/').pop() ?? '';

    if (allowedGhsas.has(ghsaId)) continue;

    newVulns.push({ package: pkgName, severity: via.severity, ghsa: ghsaId, title: via.title });
  }
}

const meta = auditReport.metadata?.vulnerabilities ?? {};
console.log(`npm audit: ${meta.total ?? '?'} total vulnerabilities`);
console.log(`Allowlisted GHSAs (${allowedGhsas.size}): ${[...allowedGhsas].join(', ')}`);

if (newVulns.length === 0) {
  console.log('✅ No NEW high/critical vulnerabilities beyond documented exceptions');
  process.exit(0);
} else {
  console.error(`\n❌ ${newVulns.length} UNLISTED vulnerabilities at or above ${auditLevel}:`);
  for (const v of newVulns) {
    console.error(`  - ${v.package}: ${v.severity} — ${v.ghsa} — ${v.title}`);
  }
  console.error('\nAdd to SECURITY_EXCEPTIONS.md or upgrade the dependency.');
  process.exit(1);
}
