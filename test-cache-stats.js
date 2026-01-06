#!/usr/bin/env node
/**
 * Test script to verify cache statistics functionality
 *
 * This script tests the cache manager and resource to ensure stats are working correctly.
 */

import { cacheManager } from './dist/utils/cache-manager.js';

async function testCacheStatistics() {
  console.log('Testing cache statistics functionality...\n');

  // Reset stats for clean test
  cacheManager.resetStats();
  cacheManager.clear();
  console.log('✓ Cleared cache and reset statistics');

  // Test 1: Empty cache stats
  console.log('\n=== Test 1: Empty Cache ===');
  let stats = cacheManager.getStats();
  console.log(`Total entries: ${stats.totalEntries}`);
  console.log(`Hits: ${stats.hits}, Misses: ${stats.misses}`);
  console.log(`Hit rate: ${stats.hitRate.toFixed(2)}%`);

  if (stats.totalEntries !== 0) {
    console.error('✗ FAILED: Expected 0 entries');
    process.exit(1);
  }
  console.log('✓ Empty cache stats correct');

  // Test 2: Add some cache entries
  console.log('\n=== Test 2: Add Cache Entries ===');
  cacheManager.set('test1', { data: 'value1' }, { namespace: 'test' });
  cacheManager.set('test2', { data: 'value2' }, { namespace: 'test' });
  cacheManager.set('test3', { data: 'value3' }, { namespace: 'other' });

  stats = cacheManager.getStats();
  console.log(`Total entries: ${stats.totalEntries}`);
  console.log(`Total size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
  console.log(`Namespaces:`, Object.keys(stats.byNamespace));

  if (stats.totalEntries !== 3) {
    console.error('✗ FAILED: Expected 3 entries');
    process.exit(1);
  }
  console.log('✓ Cache entries added successfully');

  // Test 3: Cache hits and misses
  console.log('\n=== Test 3: Cache Hits and Misses ===');
  const hit1 = cacheManager.get('test1', 'test');
  const hit2 = cacheManager.get('test2', 'test');
  const miss1 = cacheManager.get('nonexistent', 'test');
  const miss2 = cacheManager.get('another', 'test');

  stats = cacheManager.getStats();
  console.log(`Hits: ${stats.hits}, Misses: ${stats.misses}`);
  console.log(`Hit rate: ${stats.hitRate.toFixed(2)}%`);

  if (stats.hits !== 2 || stats.misses !== 2) {
    console.error(`✗ FAILED: Expected 2 hits and 2 misses, got ${stats.hits} hits and ${stats.misses} misses`);
    process.exit(1);
  }
  console.log('✓ Hit rate calculation correct');

  // Test 4: Namespace breakdown
  console.log('\n=== Test 4: Namespace Breakdown ===');
  console.log('Namespace stats:', stats.byNamespace);

  if (stats.byNamespace['test'] !== 2 || stats.byNamespace['other'] !== 1) {
    console.error('✗ FAILED: Namespace breakdown incorrect');
    process.exit(1);
  }
  console.log('✓ Namespace breakdown correct');

  // Test 5: Cache patterns
  console.log('\n=== Test 5: Cache Invalidation ===');
  const invalidated = cacheManager.invalidatePattern(/test/, 'test');
  console.log(`Invalidated ${invalidated} entries`);

  stats = cacheManager.getStats();
  console.log(`Remaining entries: ${stats.totalEntries}`);

  if (stats.totalEntries !== 1) {
    console.error('✗ FAILED: Expected 1 remaining entry');
    process.exit(1);
  }
  console.log('✓ Pattern invalidation working');

  // Test 6: getOrSet functionality
  console.log('\n=== Test 6: GetOrSet ===');
  let fetchCount = 0;
  const factory = async () => {
    fetchCount++;
    return { computed: 'value' };
  };

  const result1 = await cacheManager.getOrSet('computed', factory, { namespace: 'test' });
  const result2 = await cacheManager.getOrSet('computed', factory, { namespace: 'test' });

  console.log(`Factory called ${fetchCount} times (expected: 1)`);
  console.log(`Results match: ${JSON.stringify(result1) === JSON.stringify(result2)}`);

  if (fetchCount !== 1) {
    console.error('✗ FAILED: Factory should only be called once');
    process.exit(1);
  }
  console.log('✓ GetOrSet caching working');

  // Final stats summary
  console.log('\n=== Final Statistics ===');
  stats = cacheManager.getStats();
  console.log(JSON.stringify({
    totalEntries: stats.totalEntries,
    totalSizeKB: (stats.totalSize / 1024).toFixed(2),
    hits: stats.hits,
    misses: stats.misses,
    hitRate: stats.hitRate.toFixed(2) + '%',
    namespaceCount: Object.keys(stats.byNamespace).length,
  }, null, 2));

  console.log('\n✓ All tests passed!');
  console.log('\nCache statistics are working correctly.');
}

testCacheStatistics().catch(error => {
  console.error('✗ Test failed:', error);
  process.exit(1);
});
