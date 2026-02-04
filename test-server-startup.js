#!/usr/bin/env node
// Test script to diagnose server startup issues

console.error('=== Starting server test ===');

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
  process.exit(1);
});

async function test() {
  try {
    console.error('Importing server...');
    const { createServalSheetsServer } = await import('./dist/server.js');

    console.error('Creating server...');
    const server = await createServalSheetsServer({});

    console.error('Server created successfully!');
    console.error('Server info:', server.getInfo());

    // Exit after 2 seconds
    setTimeout(() => {
      console.error('Test complete, shutting down...');
      process.exit(0);
    }, 2000);
  } catch (error) {
    console.error('ERROR during server creation:', error);
    process.exit(1);
  }
}

test();
