/**
 * Test worker pool formula parsing
 */

import { parseFormula, parseFormulaAsync } from './dist/analysis/formula-parser.js';
import { getWorkerPool, shutdownWorkerPool } from './dist/services/worker-pool.js';

async function testWorkerPool() {
  console.log('🧪 Testing Worker Pool Formula Parsing\n');

  const testFormulas = [
    '=SUM(A1:A10)',
    '=VLOOKUP(A1, Sheet1!A:B, 2, FALSE)',
    '=IF(AND(A1>10, B1<20), C1+D1, E1*F1)',
    '=ARRAYFORMULA(A2:A100*B2:B100)',
    '=SUMIF(A:A, ">10", B:B)',
    '=INDEX(MATCH(A1, Sheet2!A:A, 0), Sheet2!B:B)',
    '=IMPORTRANGE("spreadsheet_id", "Sheet1!A1:Z100")',
    '=QUERY(A1:D10, "SELECT A, SUM(B) GROUP BY A")',
  ];

  // Warm up worker pool
  const pool = getWorkerPool({ poolSize: 2, taskTimeout: 10000 });
  console.log('✅ Worker pool created with 2 workers\n');

  // Test synchronous parsing (baseline)
  console.log('📊 Baseline: Synchronous parsing (main thread)');
  const syncStart = performance.now();
  for (const formula of testFormulas) {
    parseFormula(formula);
  }
  const syncTime = performance.now() - syncStart;
  console.log(`   Time: ${syncTime.toFixed(2)}ms\n`);

  // Test async parsing (worker threads)
  console.log('⚡ Worker threads: Async parsing (offloaded)');
  const asyncStart = performance.now();
  const results = await Promise.all(testFormulas.map((formula) => parseFormulaAsync(formula)));
  const asyncTime = performance.now() - asyncStart;
  console.log(`   Time: ${asyncTime.toFixed(2)}ms`);
  console.log(`   Speedup: ${(syncTime / asyncTime).toFixed(2)}x\n`);

  // Verify results match
  console.log('✓ Verifying results match...');
  for (let i = 0; i < testFormulas.length; i++) {
    const syncResult = parseFormula(testFormulas[i]);
    const asyncResult = results[i];

    if (JSON.stringify(syncResult) !== JSON.stringify(asyncResult)) {
      throw new Error(`Mismatch at formula ${i}: ${testFormulas[i]}`);
    }
  }
  console.log('✅ All results match!\n');

  // Show parsed example
  console.log('📝 Example parsed formula:');
  console.log(`   Formula: ${testFormulas[2]}`);
  console.log(`   Functions: ${results[2].functions.join(', ')}`);
  console.log(`   References: ${results[2].references.map((r) => r.raw).join(', ')}\n`);

  // Show worker pool stats
  const stats = pool.getStats();
  console.log('📊 Worker Pool Statistics:');
  console.log(`   Pool size: ${stats.poolSize}`);
  console.log(`   Active workers: ${stats.activeWorkers}`);
  console.log(`   Tasks completed: ${stats.totalTasks}`);
  console.log(`   Queue size: ${stats.queueSize}\n`);

  // Cleanup
  await shutdownWorkerPool();
  console.log('🏁 Test complete - worker pool shut down');
}

testWorkerPool().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
