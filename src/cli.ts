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

// Suppress dotenv's informational banner to prevent Claude Desktop JSON parsing errors
// The banner "[dotenv@17.2.3] injecting env..." breaks STDIO transport JSON parsing
// Load from project root so it works regardless of CWD
dotenv.config({ quiet: true, path: join(projectRoot, '.env') });

import { type ServalSheetsServerOptions } from './server.js';
import { logger } from './utils/logger.js';
import { VERSION } from './version.js';
import { buildCliServerOptions } from './cli/build-server-options.js';
import { parseCliCommand } from './cli/command-parsing.js';
import { dispatchCliCommand } from './cli/command-dispatch.js';
import {
  startBackgroundTasks,
  registerSignalHandlers,
  logEnvironmentConfig,
  requireEncryptionKeyInProduction,
  ensureEncryptionKey,
} from './startup/lifecycle.js';
import { runPreflightChecks } from './startup/preflight-validation.js';
import { enhanceStartupError } from './utils/enhanced-errors.js';
import {
  checkRestartBackoff,
  recordStartupAttempt,
  recordSuccessfulStartup,
} from './startup/restart-policy.js';
import { startCliRuntime } from './cli/start-runtime.js';
import { startStdioCli } from './cli/start-stdio.js';
import { startSelectedCliTransport } from './cli/start-selected-transport.js';

// Global crash handlers — prevent silent exits that leave Claude Desktop with "Server disconnected"
// These write to stderr (safe in STDIO mode — only stdout is the MCP channel)
process.on('unhandledRejection', (reason) => {
  console.error('ServalSheets unhandled rejection:', reason);
  logger.error('Unhandled promise rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (error) => {
  console.error('ServalSheets uncaught exception:', error);
  logger.error('Uncaught exception — shutting down', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Record startup start time for metrics
process.env['SERVALSHEETS_STARTUP_TIME'] = Date.now().toString();

const args = process.argv.slice(2);
const parsedCommand = parseCliCommand(args);
const dispatchedCommand = await dispatchCliCommand(parsedCommand, {
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

if (dispatchedCommand.kind === 'handled') {
  process.exit(0);
}

const cliOptions = dispatchedCommand.cliOptions;

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
