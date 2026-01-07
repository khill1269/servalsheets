import { spawn } from 'child_process';

console.log('=== Testing minimal MCP SDK connect() ===\n');

const child = spawn('node', ['test-minimal-connect.mjs'], {
  cwd: '/Users/thomascahill/Documents/mcp-servers/servalsheets'
});

child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
});

child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
});

child.on('exit', (code) => {
  console.log(`\n=== Process exited with code: ${code} ===`);
  clearTimeout(timer);
  process.exit(code);
});

const timer = setTimeout(() => {
  console.log('\n=== TIMEOUT: Process did not complete in 3 seconds ===');
  child.kill();
  process.exit(1);
}, 3000);
