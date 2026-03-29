import {
  startCliRuntime as startPackagedCliRuntime,
  type CliOutput,
  type StartCliRuntimeOptions as PackagedStartCliRuntimeOptions,
} from '#mcp-stdio/start-cli-runtime';

type StartCliRuntimeOptions = Omit<
  PackagedStartCliRuntimeOptions,
  'sleep' | 'output' | 'exit' | 'setTimeoutFn'
> & {
  readonly sleep?: PackagedStartCliRuntimeOptions['sleep'];
  readonly output?: CliOutput;
  readonly exit?: PackagedStartCliRuntimeOptions['exit'];
  readonly setTimeoutFn?: PackagedStartCliRuntimeOptions['setTimeoutFn'];
};

export async function startCliRuntime(options: StartCliRuntimeOptions): Promise<void> {
  await startPackagedCliRuntime({
    ...options,
    sleep:
      options.sleep ?? ((delayMs) => new Promise<void>((resolve) => setTimeout(resolve, delayMs))),
    output: options.output ?? console,
    exit: options.exit ?? ((code) => process.exit(code)),
    setTimeoutFn: options.setTimeoutFn ?? setTimeout,
  });
}
