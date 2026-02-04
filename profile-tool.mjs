import { spawn } from 'child_process';

const proc = spawn('node', ['dist/cli.js'], {
  env: { ...process.env, LOG_LEVEL: 'debug' },
  stdio: ['pipe', 'pipe', 'pipe']
});

// Initialize
const initStart = Date.now();
proc.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } }
}) + '\n');

let buffer = '';
let initDone = false;

proc.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  lines.forEach(line => {
    if (line.trim()) {
      try {
        const msg = JSON.parse(line);
        if (msg.id === 1 && !initDone) {
          initDone = true;
          const initTime = Date.now() - initStart;
          console.log(`✓ Init: ${initTime}ms`);
          
          // Now test a simple tool call
          const toolStart = Date.now();
          proc.stdin.write(JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/list"
          }) + '\n');
        } else if (msg.id === 2) {
          const toolTime = Date.now() - initStart;
          console.log(`✓ tools/list: ${toolTime}ms`);
          proc.kill();
          process.exit(0);
        }
      } catch (e) {}
    }
  });
});

proc.stderr.on('data', (data) => {
  const line = data.toString();
  if (line.includes('Registered') || line.includes('knowledge')) {
    console.log('  Context:', line.trim().substring(0, 80));
  }
});

setTimeout(() => {
  console.log('✗ Timeout');
  proc.kill();
  process.exit(1);
}, 10000);
