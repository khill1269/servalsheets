import { spawn } from 'child_process';

const start = Date.now();
const proc = spawn('node', ['dist/cli.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let initialized = false;

proc.stdout.on('data', (data) => {
  const str = data.toString();
  // Look for MCP protocol initialization
  if (!initialized && str.includes('"jsonrpc"')) {
    const elapsed = Date.now() - start;
    console.log(`Server initialization time: ${elapsed}ms`);
    initialized = true;
    proc.kill();
  }
});

proc.stderr.on('data', (data) => {
  // Ignore stderr for now
});

// Send an initialize request
setTimeout(() => {
  if (!initialized) {
    proc.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' }
      }
    }) + '\n');
  }
}, 100);

setTimeout(() => {
  if (!initialized) {
    console.log('Timeout: Server did not initialize within 5s');
    proc.kill();
  }
}, 5000);
