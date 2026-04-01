import { runHttpServerDirectEntry } from '../packages/mcp-http/dist/direct-entry.js';

const startupTraceEnabled = process.env['DEBUG_STARTUP_TRACE'] === 'true';
const startupTraceStart = Date.now();

function writeStderr(message: string): void {
  process.stderr.write(`${message}\n`);
}

function startupTrace(step: string, meta?: Record<string, unknown>): void {
  if (!startupTraceEnabled) {
    return;
  }

  const elapsedMs = Date.now() - startupTraceStart;
  const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
  writeStderr(`[startup-trace +${elapsedMs}ms] ${step}${suffix}`);
}

async function importWithTrace<T>(step: string, loader: () => Promise<T>): Promise<T> {
  startupTrace(`${step}:start`);
  const loaded = await loader();
  startupTrace(`${step}:done`);
  return loaded;
}

function shouldUseRemoteDirectEntry(): boolean {
  return (
    process.env['MCP_HTTP_MODE'] === 'true' ||
    process.env['OAUTH_ISSUER'] !== undefined ||
    process.env['OAUTH_CLIENT_SECRET'] !== undefined
  );
}

async function main(): Promise<void> {
  startupTrace('entry:start', { pid: process.pid });

  const lifecycle = await importWithTrace(
    'import:lifecycle',
    () => import('./startup/lifecycle.js')
  );
  const port = parseInt(process.env['PORT'] ?? '3000', 10);

  await runHttpServerDirectEntry({
    port,
    logEnvironmentConfig: () => {
      startupTrace('lifecycle:logEnvironmentConfig');
      lifecycle.logEnvironmentConfig();
    },
    startBackgroundTasks: async () => {
      startupTrace('lifecycle:startBackgroundTasks:start');
      await lifecycle.startBackgroundTasks();
      startupTrace('lifecycle:startBackgroundTasks:done');
    },
    registerSignalHandlers: () => {
      startupTrace('lifecycle:registerSignalHandlers');
      lifecycle.registerSignalHandlers();
    },
    startHttpServer: async ({ port: requestedPort }) => {
      const remote = shouldUseRemoteDirectEntry();
      startupTrace('import:http-server:start', { remote });
      const httpServer = await importWithTrace(
        'import:http-server',
        () => import('./http-server.js')
      );

      startupTrace('http-server:start', { port: requestedPort, remote });
      if (remote) {
        await httpServer.startRemoteServer({ port: requestedPort });
      } else {
        await httpServer.startHttpServer({ port: requestedPort });
      }
      startupTrace('http-server:started');
    },
    log: {
      info(message: string) {
        startupTrace('direct-entry:info', { message });
        writeStderr(message);
      },
      error(message: string, meta?: unknown) {
        startupTrace('direct-entry:error', {
          message,
          meta: meta instanceof Error ? { message: meta.message, stack: meta.stack } : meta,
        });
        writeStderr(meta === undefined ? message : `${message} ${JSON.stringify(meta)}`);
      },
    },
    exit(code: number) {
      startupTrace('process:exit', { code });
      process.exit(code);
    },
  });

  startupTrace('entry:done');
}

void main().catch((error) => {
  startupTrace('entry:fatal', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  writeStderr(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
