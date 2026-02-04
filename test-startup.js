// Test server startup time
const start = Date.now();
console.log('Testing ServalSheets startup...');

import('./dist/server.js').then(() => {
  const duration = Date.now() - start;
  console.log(`Startup time: ${duration}ms`);
  process.exit(0);
}).catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
