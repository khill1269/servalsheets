/**
 * Regression test for getEffectiveToolMode() and STAGED_REGISTRATION default.
 *
 * Background: commit 14c57d72 (2026-04-27) silently flipped the implicit
 * default for STDIO clients from 'bundled' to 'flat' by changing one
 * character on the entrypoint-detection branch. The dist built from that
 * commit exposed ~410 flat tools instead of the documented 25 compound
 * tools. CLAUDE.md gotcha #19 explains why bundled MUST be the auto default.
 *
 * Implementation note: TOOL_MODE and STAGED_REGISTRATION are captured at
 * module load time. We can't simply mutate process.env between cases —
 * vi.resetModules() works in isolation but re-imports the prom-client
 * chain, which throws on duplicate gauge registration (same constraint
 * documented in tests/config/env-lazy-load.test.ts). Instead we spawn a
 * fresh Node subprocess per case so each gets a clean module graph.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const CONSTANTS_MODULE = join(REPO_ROOT, 'dist', 'config', 'constants.js');

interface ProbeResult {
  TOOL_MODE: string;
  STAGED_REGISTRATION: boolean;
  effectiveMode: 'flat' | 'bundled';
}

function probe(env: Record<string, string | undefined>): ProbeResult {
  const cleanEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && k !== 'SERVAL_TOOL_MODE' && k !== 'SERVAL_STAGED_REGISTRATION' && k !== 'MCP_TRANSPORT') {
      cleanEnv[k] = v;
    }
  }
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined) cleanEnv[k] = v;
  }
  const script = `
    import('${CONSTANTS_MODULE.replace(/\\/g, '\\\\')}').then(c => {
      process.stdout.write(JSON.stringify({
        TOOL_MODE: c.TOOL_MODE,
        STAGED_REGISTRATION: c.STAGED_REGISTRATION,
        effectiveMode: c.getEffectiveToolMode(),
      }));
    }).catch(e => { process.stderr.write(String(e)); process.exit(2); });
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    env: cleanEnv,
    encoding: 'utf-8',
    timeout: 10_000,
  });
  if (result.status !== 0) {
    throw new Error(`probe subprocess failed (status=${result.status}): ${result.stderr}`);
  }
  return JSON.parse(result.stdout) as ProbeResult;
}

describe('getEffectiveToolMode (regression for commit 14c57d72)', () => {
  it('SERVAL_TOOL_MODE unset + MCP_TRANSPORT=stdio => bundled', () => {
    const r = probe({ MCP_TRANSPORT: 'stdio' });
    expect(r.TOOL_MODE).toBe('auto');
    expect(r.effectiveMode).toBe('bundled');
  });

  it('SERVAL_TOOL_MODE unset + MCP_TRANSPORT unset => bundled', () => {
    const r = probe({});
    expect(r.TOOL_MODE).toBe('auto');
    expect(r.effectiveMode).toBe('bundled');
  });

  it('SERVAL_TOOL_MODE=flat => flat', () => {
    const r = probe({ SERVAL_TOOL_MODE: 'flat' });
    expect(r.TOOL_MODE).toBe('flat');
    expect(r.effectiveMode).toBe('flat');
  });

  it('SERVAL_TOOL_MODE=bundled => bundled', () => {
    const r = probe({ SERVAL_TOOL_MODE: 'bundled' });
    expect(r.TOOL_MODE).toBe('bundled');
    expect(r.effectiveMode).toBe('bundled');
  });

  it('SERVAL_TOOL_MODE=BUNDLED (case-insensitive) => bundled', () => {
    const r = probe({ SERVAL_TOOL_MODE: 'BUNDLED' });
    expect(r.TOOL_MODE).toBe('bundled');
    expect(r.effectiveMode).toBe('bundled');
  });

  it('SERVAL_TOOL_MODE=garbage falls back to auto => bundled', () => {
    const r = probe({ SERVAL_TOOL_MODE: 'turbo-encabulator' });
    expect(r.TOOL_MODE).toBe('auto');
    expect(r.effectiveMode).toBe('bundled');
  });
});

describe('STAGED_REGISTRATION default (regression)', () => {
  it('defaults to true when env unset', () => {
    const r = probe({});
    expect(r.STAGED_REGISTRATION).toBe(true);
  });

  it('SERVAL_STAGED_REGISTRATION=false disables staging', () => {
    const r = probe({ SERVAL_STAGED_REGISTRATION: 'false' });
    expect(r.STAGED_REGISTRATION).toBe(false);
  });

  it('SERVAL_STAGED_REGISTRATION=true keeps staging enabled', () => {
    const r = probe({ SERVAL_STAGED_REGISTRATION: 'true' });
    expect(r.STAGED_REGISTRATION).toBe(true);
  });
});
