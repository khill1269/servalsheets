#!/usr/bin/env node
/**
 * Test CLI startup by adding explicit logging
 */

// Write directly to stderr BEFORE any imports
import { writeFileSync } from 'fs';

const log = (msg) => {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  process.stderr.write(line);
  writeFileSync('/tmp/servalsheets-startup.log', line, { flag: 'a' });
};

log('=== START ===');
log('Node version: ' + process.version);
log('CWD: ' + process.cwd());
log('Args: ' + JSON.stringify(process.argv));

try {
  log('Setting environment...');
  process.env.OAUTH_AUTO_OPEN_BROWSER = 'false';
  process.env.LOG_LEVEL = 'info';

  log('Importing dotenv...');
  const dotenv = await import('dotenv');
  dotenv.default.config({ quiet: true });
  log('dotenv configured');

  log('Importing lifecycle...');
  const lifecycle = await import('./dist/startup/lifecycle.js');
  log('lifecycle imported');

  log('Running requireEncryptionKeyInProduction...');
  lifecycle.requireEncryptionKeyInProduction();
  log('requireEncryptionKeyInProduction complete');

  log('Running ensureEncryptionKey...');
  lifecycle.ensureEncryptionKey();
  log('ensureEncryptionKey complete');

  log('Running logEnvironmentConfig...');
  lifecycle.logEnvironmentConfig();
  log('logEnvironmentConfig complete');

  log('Running startBackgroundTasks...');
  await lifecycle.startBackgroundTasks();
  log('startBackgroundTasks complete');

  log('Running registerSignalHandlers...');
  lifecycle.registerSignalHandlers();
  log('registerSignalHandlers complete');

  log('Importing server...');
  const { createServalSheetsServer } = await import('./dist/server.js');
  log('server imported');

  log('Creating server...');
  const server = await createServalSheetsServer({});
  log('Server created successfully!');

  log('Server info: ' + JSON.stringify(server.getInfo()));
  log('=== SERVER RUNNING ===');

  // Keep running
  await new Promise(() => {});
} catch (error) {
  log('ERROR: ' + error.message);
  log('STACK: ' + error.stack);
  process.exit(1);
}
