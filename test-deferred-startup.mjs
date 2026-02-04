import { spawn } from 'child_process';

async function measureStartup(env = {}) {
  const start = Date.now();
  const proc = spawn('node', ['dist/cli.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...env }
  });

  let initialized = false;
  let resourceLog = '';

  proc.stdout.on('data', (data) => {
    const str = data.toString();
    if (!initialized && str.includes('"jsonrpc"')) {
      const elapsed = Date.now() - start;
      console.log(`Initialization time: ${elapsed}ms`);
      initialized = true;
      proc.kill();
    }
  });

  proc.stderr.on('data', (data) => {
    const str = data.toString();
    if (str.includes('Resource discovery deferred') || str.includes('Resources registered')) {
      resourceLog += str;
    }
  });

  setTimeout(() => {
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
  }, 100);

  return new Promise((resolve) => {
    setTimeout(() => {
      if (!initialized) {
        console.log('Timeout');
        proc.kill();
      }
      resolve(resourceLog);
    }, 5000);
  });
}

console.log('Testing with DEFER_RESOURCE_DISCOVERY=true (default):');
const log1 = await measureStartup();
console.log(log1);

console.log('\nTesting with DEFER_RESOURCE_DISCOVERY=false:');
const log2 = await measureStartup({ DEFER_RESOURCE_DISCOVERY: 'false' });
console.log(log2);
