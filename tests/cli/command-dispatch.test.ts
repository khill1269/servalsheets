import { describe, expect, it, vi } from 'vitest';

import { dispatchCliCommand, getCliHelpText } from '../../src/cli/command-dispatch.js';

describe('dispatchCliCommand', () => {
  it('returns run options for the normal run path', async () => {
    const result = await dispatchCliCommand(
      { kind: 'run', options: { transport: 'stdio' } },
      {
        runAuthSetup: vi.fn(async () => undefined),
        loadPackageVersion: vi.fn(async () => '1.2.3'),
        versionFallback: '0.0.0',
        output: { log: vi.fn() },
        exit: vi.fn(),
      }
    );

    expect(result).toEqual({
      kind: 'run',
      cliOptions: { transport: 'stdio' },
    });
  });

  it('handles init by running auth setup and exiting', async () => {
    const runAuthSetup = vi.fn(async () => undefined);
    const exit = vi.fn();

    const result = await dispatchCliCommand(
      { kind: 'init' },
      {
        runAuthSetup,
        loadPackageVersion: vi.fn(async () => '1.2.3'),
        versionFallback: '0.0.0',
        output: { log: vi.fn() },
        exit,
      }
    );

    expect(runAuthSetup).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(0);
    expect(result).toEqual({ kind: 'handled' });
  });

  it('prints help text and exits', async () => {
    const output = { log: vi.fn() };
    const exit = vi.fn();

    await dispatchCliCommand(
      { kind: 'help' },
      {
        runAuthSetup: vi.fn(async () => undefined),
        loadPackageVersion: vi.fn(async () => '1.2.3'),
        versionFallback: '0.0.0',
        output,
        exit,
      }
    );

    expect(output.log).toHaveBeenCalledWith(getCliHelpText());
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('falls back to the bundled version when package lookup fails', async () => {
    const output = { log: vi.fn() };
    const exit = vi.fn();

    await dispatchCliCommand(
      { kind: 'version' },
      {
        runAuthSetup: vi.fn(async () => undefined),
        loadPackageVersion: vi.fn(async () => {
          throw new Error('missing package metadata');
        }),
        versionFallback: '9.9.9',
        output,
        exit,
      }
    );

    expect(output.log).toHaveBeenCalledWith('servalsheets v9.9.9');
    expect(exit).toHaveBeenCalledWith(0);
  });
});
