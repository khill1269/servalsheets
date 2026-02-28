import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDir, '../..');
const scriptPath = resolve(projectRoot, 'scripts/check-source-dist-consistency.ts');

describe('check-source-dist-consistency.ts', () => {
  it('passes with synchronized source and dist artifacts', () => {
    const result = spawnSync('node', ['--import', 'tsx', scriptPath], {
      cwd: projectRoot,
      encoding: 'utf8',
      env: process.env,
    });

    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
    expect(result.status, output).toBe(0);
    expect(output).toContain('Source/dist consistency passed.');
  });
});
