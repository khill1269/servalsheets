#!/usr/bin/env node
/**
 * Test server startup step-by-step
 */

console.log('Testing server startup...\n');

try {
  console.log('1. Setting environment...');
  process.env.OAUTH_AUTO_OPEN_BROWSER = 'false';
  process.env.LOG_LEVEL = 'debug';

  console.log('2. Importing lifecycle functions...');
  const lifecycle = await import('./dist/startup/lifecycle.js');

  console.log('3. Testing requireEncryptionKeyInProduction...');
  lifecycle.requireEncryptionKeyInProduction();
  console.log('   ✓ Pass');

  console.log('4. Testing ensureEncryptionKey...');
  lifecycle.ensureEncryptionKey();
  console.log('   ✓ Pass');

  console.log('5. Testing logEnvironmentConfig...');
  lifecycle.logEnvironmentConfig();
  console.log('   ✓ Pass');

  console.log('6. Testing startBackgroundTasks...');
  await lifecycle.startBackgroundTasks();
  console.log('   ✓ Pass');

  console.log('7. Testing registerSignalHandlers...');
  lifecycle.registerSignalHandlers();
  console.log('   ✓ Pass');

  console.log('\n✅ All startup steps completed successfully!');

  process.exit(0);
} catch (error) {
  console.error('\n❌ Startup failed:');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
