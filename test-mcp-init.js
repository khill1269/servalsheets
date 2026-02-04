#!/usr/bin/env node
// Test MCP initialization with STDIO

import { spawn } from 'child_process';

const server = spawn('node', ['dist/cli.js', '--stdio'], {
  cwd: '/Users/thomascahill/Documents/servalsheets 2',
  env: process.env
});

let output = '';
let errorOutput = '';

server.stdout.on('data', (data) => {
  output += data.toString();
  console.log('STDOUT:', data.toString());
});

server.stderr.on('data', (data) => {
  errorOutput += data.toString();
  console.error('STDERR:', data.toString());
});

server.on('close', (code) => {
  console.error(`Server exited with code ${code}`);
  console.error('Total stdout:', output.length, 'bytes');
  console.error('Total stderr:', errorOutput.length, 'bytes');
  process.exit(code);
});

setTimeout(() => {
  console.log('Sending initialize request...');
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0' }
    }
  };
  server.stdin.write(JSON.stringify(initRequest) + '\n');
}, 1000);

setTimeout(() => {
  console.log('Timeout - killing server');
  server.kill();
}, 5000);
