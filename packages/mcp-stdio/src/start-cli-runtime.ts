export interface CliPreflightItem {
  readonly name: string;
  readonly message: string;
  readonly fix?: string;
}

export interface CliPreflightResults {
  readonly criticalFailures: number;
  readonly warnings: number;
  readonly failures: readonly CliPreflightItem[];
  readonly warningList: readonly CliPreflightItem[];
}

export interface CliOutput {
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}

export interface StartCliRuntimeOptions {
  readonly checkRestartBackoff: () => Promise<number>;
  readonly sleep: (ms: number) => Promise<void>;
  readonly recordStartupAttempt: () => Promise<void>;
  readonly runPreflightChecks: () => Promise<CliPreflightResults>;
  readonly requireEncryptionKeyInProduction: () => void;
  readonly ensureEncryptionKey: () => void;
  readonly logEnvironmentConfig: () => void;
  readonly startBackgroundTasks: () => Promise<void>;
  readonly registerSignalHandlers: () => void;
  readonly startTransport: () => Promise<void>;
  readonly recordSuccessfulStartup: () => Promise<void>;
  readonly output: CliOutput;
  readonly exit: (code: number) => void;
  readonly setTimeoutFn?: (callback: () => void, delayMs: number) => unknown;
  readonly successThresholdMs?: number;
}

function printPreflightFailures(output: CliOutput, failures: readonly CliPreflightItem[]): void {
  output.error('\n❌ Pre-flight checks failed - cannot start server\n');
  failures.forEach((failure) => {
    output.error(`  ✗ ${failure.name}: ${failure.message}`);
    if (failure.fix) {
      output.error(`    Fix: ${failure.fix}`);
    }
  });
  output.error('');
}

function printPreflightWarnings(output: CliOutput, warnings: readonly CliPreflightItem[]): void {
  output.warn('\n⚠️  Pre-flight warnings:\n');
  warnings.forEach((warning) => {
    output.warn(`  • ${warning.name}: ${warning.message}`);
    if (warning.fix) {
      output.warn(`    Fix: ${warning.fix}`);
    }
  });
  output.warn('');
}

export async function startCliRuntime(options: StartCliRuntimeOptions): Promise<void> {
  const backoffDelay = await options.checkRestartBackoff();
  if (backoffDelay > 0) {
    options.output.error(
      `⏳ Waiting ${Math.ceil(backoffDelay / 1000)}s before restart (exponential backoff)...`
    );
    await options.sleep(backoffDelay);
  }

  await options.recordStartupAttempt();

  const preflightResults = await options.runPreflightChecks();
  if (preflightResults.criticalFailures > 0) {
    printPreflightFailures(options.output, preflightResults.failures);
    options.exit(1);
    return;
  }

  if (preflightResults.warnings > 0) {
    printPreflightWarnings(options.output, preflightResults.warningList);
  }

  options.requireEncryptionKeyInProduction();
  options.ensureEncryptionKey();
  options.logEnvironmentConfig();
  await options.startBackgroundTasks();
  options.registerSignalHandlers();
  await options.startTransport();

  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  setTimeoutFn(() => {
    void options.recordSuccessfulStartup().catch(() => {
      // Ignore errors in background bookkeeping.
    });
  }, options.successThresholdMs ?? 30000);
}
