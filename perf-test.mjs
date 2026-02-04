import { spawn } from 'child_process';

console.log('Testing ServalSheets MCP initialization...');
const start = Date.now();

const proc = spawn('node', ['dist/cli.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

proc.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test", version: "1.0.0" }
  }
}) + '\n');

let output = '';
proc.stdout.on('data', (data) => {
  output += data.toString();
  if (output.includes('"result"')) {
    const duration = Date.now() - start;
    console.log(`✓ Initialize response time: ${duration}ms`);
    proc.kill();
    process.exit(0);
  }
});

setTimeout(() => {
  console.log('✗ Timeout after 5s');
  proc.kill();
  process.exit(1);
}, 5000);
