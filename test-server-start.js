#!/usr/bin/env node
/**
 * Minimal server start test
 */

import { spawn } from 'child_process';

console.log('Starting MCP server...\n');

const child = spawn('node', ['dist/cli.js', '--stdio'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    OAUTH_AUTO_OPEN_BROWSER: 'false',
    LOG_LEVEL: 'debug',
    MCP_TRANSPORT: 'stdio'
  },
});

child.stdout.on('data', (chunk) => {
  console.log('[STDOUT]', chunk.toString());
});

child.stderr.on('data', (chunk) => {
  console.error('[STDERR]', chunk.toString());
});

child.on('error', (error) => {
  console.error('[ERROR] Failed to start:', error);
});

child.on('exit', (code, signal) => {
  console.log(`[EXIT] code=${code}, signal=${signal}`);
  process.exit(code || 0);
});

// Send initialize after 1 second
setTimeout(() => {
  console.log('\nSending initialize request...\n');
  const request = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test',
        version: '1.0.0',
      },
    },
  }) + '\n';
  child.stdin.write(request);
}, 1000);

// Timeout after 10 seconds
setTimeout(() => {
  console.log('\n[TIMEOUT] No response after 10 seconds');
  child.kill();
}, 10000);
