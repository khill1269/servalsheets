#!/usr/bin/env node
/**
 * Test full server initialization
 */

console.log('Testing full server initialization...\n');

try {
  console.log('1. Setting environment...');
  process.env.OAUTH_AUTO_OPEN_BROWSER = 'false';
  process.env.LOG_LEVEL = 'debug';

  console.log('2. Running startup lifecycle...');
  const lifecycle = await import('./dist/startup/lifecycle.js');
  lifecycle.requireEncryptionKeyInProduction();
  lifecycle.ensureEncryptionKey();
  lifecycle.logEnvironmentConfig();
  await lifecycle.startBackgroundTasks();
  lifecycle.registerSignalHandlers();
  console.log('   ✓ Lifecycle complete');

  console.log('3. Importing server module...');
  const { createServalSheetsServer } = await import('./dist/server.js');
  console.log('   ✓ Server module imported');

  console.log('4. Creating server instance...');
  const server = await createServalSheetsServer({});
  console.log('   ✓ Server created');

  console.log('\n✅ Server initialization successful!');
  console.log('Server instance:', typeof server);

  // Don't exit immediately, let the server run for a moment
  setTimeout(() => {
    console.log('\nShutting down...');
    process.exit(0);
  }, 2000);
} catch (error) {
  console.error('\n❌ Server initialization failed:');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
