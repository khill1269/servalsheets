#!/usr/bin/env node
/**
 * ServalSheets - CLI Entry Point
 * MCP Protocol: 2025-11-25
 *
 * Supports multiple transports:
 * - STDIO (default): For Claude Desktop and MCP clients
 * - HTTP: For web-based integrations
 */

// Load environment variables from .env file (silently to avoid MCP JSON parsing errors)
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory where the CLI is located (works for both src and dist)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Go up one level from dist/ or src/ to find .env in project root
const projectRoot = join(__dirname, '..');

function shouldLoadDotenv(env: NodeJS.ProcessEnv = process.env): boolean {
  const explicitSetting = env['SERVALSHEETS_LOAD_DOTENV'];
  if (explicitSetting === 'true') {
    return true;
  }

  if (explicitSetting === 'false') {
    return false;
  }

  return env['NODE_ENV'] !== 'test';
}

// Suppress dotenv's informational banner to prevent Claude Desktop JSON parsing errors
// The banner "[dotenv@17.2.3] injecting env..." breaks STDIO transport JSON parsing
// Load from project root so it works regardless of CWD
if (shouldLoadDotenv()) {
  dotenv.config({ quiet: true, path: join(projectRoot, '.env') });
}

import { type ServalSheetsServerOptions } from './server.js';
import { VERSION } from './version.js';
import { buildCliServerOptions } from './cli/build-server-options.js';
import { parseCliCommand } from './cli/command-parsing.js';
import { dispatchCliCommand } from './cli/command-dispatch.js';
import { enhanceStartupError } from './utils/enhanced-errors.js';
import { startCliRuntime } from './cli/start-runtime.js';
import { recordStartupPhase } from './startup/startup-profiler.js';

// Record startup start time for metrics
process.env['SERVALSHEETS_STARTUP_TIME'] = Date.now().toString();

const args = process.argv.slice(2);
const dispatchedCommand = await recordStartupPhase('cli_parse_dispatch', async () => {
  const parsedCommand = parseCliCommand(args);
  return await dispatchCliCommand(parsedCommand, {
    runAuthSetup: async () => {
      const { runAuthSetup } = await import('./cli/auth-setup.js');
      await runAuthSetup();
    },
    loadPackageVersion: async () => {
      const pkg = await import('../package.json', { assert: { type: 'json' } });
      return pkg.default.version;
    },
    versionFallback: VERSION,
    output: console,
    exit: (code) => {
      process.exit(code);
    },
  });
});

if (dispatchedCommand.kind === 'handled') {
  process.exit(0);
}

const cliOptions = dispatchedCommand.cliOptions;
process.env['MCP_TRANSPORT'] = cliOptions.transport;
const [
  { logger },
  {
    startBackgroundTasks,
    registerSignalHandlers,
    logEnvironmentConfig,
    requireEncryptionKeyInProduction,
    ensureEncryptionKey,
  },
  { runPreflightChecks },
  { checkRestartBackoff, recordStartupAttempt, recordSuccessfulStartup },
  { startStdioCli },
  { startSelectedCliTransport },
] = await recordStartupPhase(
  'dynamic_imports',
  async () =>
    await Promise.all([
      import('./utils/logger.js'),
      import('./startup/lifecycle.js'),
      import('./startup/preflight-validation.js'),
      import('./startup/restart-policy.js'),
      import('./cli/start-stdio.js'),
      import('./cli/start-selected-transport.js'),
    ])
);

const serverOptions: ServalSheetsServerOptions = buildCliServerOptions(cliOptions, process.env);

// Initialize and start server
(async () => {
  try {
    await startCliRuntime({
      checkRestartBackoff,
      recordStartupAttempt,
      runPreflightChecks,
      requireEncryptionKeyInProduction,
      ensureEncryptionKey,
      logEnvironmentConfig,
      startBackgroundTasks,
      registerSignalHandlers,
      recordSuccessfulStartup,
      startTransport: async () =>
        startSelectedCliTransport(cliOptions, serverOptions, {
          startStdioCli,
          env: process.env,
          log: logger,
        }),
    });
  } catch (error) {
    // Use enhanced error system for actionable messages
    const enhancedError = enhanceStartupError(error);

    console.error('\n❌ FATAL: ServalSheets failed to start\n');
    console.error(`Error: ${enhancedError.message}\n`);

    if (enhancedError.resolution) {
      console.error(`💡 Fix: ${enhancedError.resolution}\n`);
    }

    if (enhancedError.resolutionSteps && enhancedError.resolutionSteps.length > 0) {
      console.error('Steps to resolve:');
      enhancedError.resolutionSteps.forEach((step) => console.error(`  ${step}`));
      console.error('');
    }

    // Structured logging for debugging
    logger.error('Failed to start ServalSheets server', {
      error: enhancedError,
      stack: error instanceof Error ? error.stack : undefined,
    });

    process.exit(1);
  }
})();
