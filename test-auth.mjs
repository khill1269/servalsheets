// Test OAuth status
import { spawn } from 'child_process';

const proc = spawn('node', ['dist/cli.js'], {
  env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: '' },
  stdio: ['pipe', 'pipe', 'pipe']
});

// Initialize
proc.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } }
}) + '\n');

setTimeout(() => {
  // Check auth status
  proc.stdin.write(JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "sheets_auth",
      arguments: { request: { action: "status" } }
    }
  }) + '\n');
}, 1000);

let buffer = '';
proc.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  lines.forEach(line => {
    if (line.trim()) {
      try {
        const msg = JSON.parse(line);
        if (msg.id === 2) {
          console.log('Auth status result:', JSON.stringify(msg.result, null, 2));
          proc.kill();
          process.exit(0);
        }
      } catch (e) {}
    }
  });
});

proc.stderr.on('data', (data) => console.error('Error:', data.toString()));

setTimeout(() => {
  console.log('Timeout');
  proc.kill();
  process.exit(1);
}, 5000);
