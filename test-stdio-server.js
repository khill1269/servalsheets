#!/usr/bin/env node
/**
 * Test STDIO server with simulated client
 */

import { spawn } from 'child_process';

console.log('Testing STDIO server with simulated client...\n');

const child = spawn('node', ['dist/cli.js', '--stdio'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    OAUTH_AUTO_OPEN_BROWSER: 'false',
    LOG_LEVEL: 'info',
  },
});

let stdoutData = '';
let stderrData = '';

child.stdout.on('data', (chunk) => {
  stdoutData += chunk.toString();
  console.log('[STDOUT]', chunk.toString().trim());
});

child.stderr.on('data', (chunk) => {
  stderrData += chunk.toString();
  console.error('[STDERR]', chunk.toString().trim());
});

child.on('error', (error) => {
  console.error('[ERROR] Failed to spawn:', error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  console.log(`\n[EXIT] Server exited with code=${code}, signal=${signal}`);

  if (code !== 0) {
    console.error('\n❌ Server failed to start');
    console.error('\nStdout:', stdoutData || '(empty)');
    console.error('\nStderr:', stderrData || '(empty)');
    process.exit(1);
  }

  process.exit(0);
});

// Wait a moment for server to start, then send initialize
setTimeout(() => {
  console.log('\n[CLIENT] Sending initialize request...');
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0',
      },
    },
  };

  child.stdin.write(JSON.stringify(request) + '\n');
}, 1000);

// Wait for response
setTimeout(() => {
  console.log('\n[CLIENT] Waiting for response...');
}, 2000);

// Timeout and kill after 5 seconds
setTimeout(() => {
  console.log('\n[TIMEOUT] No response received, killing server');
  child.kill();
}, 5000);
