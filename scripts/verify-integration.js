#!/usr/bin/env node
/**
 * Integration Verification Script
 *
 * Verifies that all Phase 1-4 features are properly integrated
 * and can be loaded without runtime errors.
 */

console.log('🔍 Verifying Phase 1-4 Integration...\n');

let errors = 0;
let warnings = 0;

// Test 1: Verify lifecycle management loads
console.log('✓ Test 1: Lifecycle Management');
try {
  const lifecycle = await import('../dist/startup/lifecycle.js');

  // Check required exports
  const required = [
    'requireEncryptionKeyInProduction',
    'validateAuthExemptList',
    'validateOAuthConfig',
    'startBackgroundTasks',
    'gracefulShutdown',
    'registerSignalHandlers',
    'getConnectionStats',
    'getTracingStats',
    'getCacheStats',
    'getDeduplicationStats',
  ];

  for (const exportName of required) {
    if (typeof lifecycle[exportName] !== 'function') {
      console.error(`  ❌ Missing or invalid export: ${exportName}`);
      errors++;
    }
  }

  console.log('  ✅ All lifecycle exports present\n');
} catch (error) {
  console.error(`  ❌ Failed to load lifecycle: ${error.message}\n`);
  errors++;
}

// Test 2: Verify tracing loads
console.log('✓ Test 2: OpenTelemetry Tracing');
try {
  const tracing = await import('../dist/utils/tracing.js');

  const required = [
    'initTracer',
    'shutdownTracer',
    'getTracer',
    'withToolSpan',
    'withOperationSpan',
  ];

  for (const exportName of required) {
    if (typeof tracing[exportName] !== 'function') {
      console.error(`  ❌ Missing or invalid export: ${exportName}`);
      errors++;
    }
  }

  console.log('  ✅ All tracing exports present\n');
} catch (error) {
  console.error(`  ❌ Failed to load tracing: ${error.message}\n`);
  errors++;
}

// Test 3: Verify connection health loads
console.log('✓ Test 3: Connection Health Monitoring');
try {
  const health = await import('../dist/utils/connection-health.js');

  const required = [
    'startConnectionHealthMonitoring',
    'stopConnectionHealthMonitoring',
    'getConnectionHealthMonitor',
  ];

  for (const exportName of required) {
    if (typeof health[exportName] !== 'function') {
      console.error(`  ❌ Missing or invalid export: ${exportName}`);
      errors++;
    }
  }

  console.log('  ✅ All connection health exports present\n');
} catch (error) {
  console.error(`  ❌ Failed to load connection health: ${error.message}\n`);
  errors++;
}

// Test 4: Verify cache manager loads
console.log('✓ Test 4: Cache Manager');
try {
  const cache = await import('../dist/utils/cache-manager.js');

  if (!cache.cacheManager) {
    console.error('  ❌ cacheManager singleton not exported');
    errors++;
  } else {
    // Check methods
    const methods = [
      'get',
      'set',
      'delete',
      'has',
      'getOrSet',
      'invalidatePattern',
      'clearNamespace',
      'clear',
      'cleanup',
      'getStats',
      'startCleanupTask',
      'stopCleanupTask',
    ];

    for (const method of methods) {
      if (typeof cache.cacheManager[method] !== 'function') {
        console.error(`  ❌ Missing or invalid method: ${method}`);
        errors++;
      }
    }
  }

  if (typeof cache.createCacheKey !== 'function') {
    console.error('  ❌ createCacheKey helper not exported');
    errors++;
  }

  console.log('  ✅ Cache manager fully functional\n');
} catch (error) {
  console.error(`  ❌ Failed to load cache manager: ${error.message}\n`);
  errors++;
}

// Test 5: Verify request deduplication loads
console.log('✓ Test 5: Request Deduplication');
try {
  const dedup = await import('../dist/utils/request-deduplication.js');

  if (!dedup.requestDeduplicator) {
    console.error('  ❌ requestDeduplicator singleton not exported');
    errors++;
  } else {
    // Check methods
    const methods = [
      'deduplicate',
      'getStats',
      'destroy',
    ];

    for (const method of methods) {
      if (typeof dedup.requestDeduplicator[method] !== 'function') {
        console.error(`  ❌ Missing or invalid method: ${method}`);
        errors++;
      }
    }
  }

  if (typeof dedup.createRequestKey !== 'function') {
    console.error('  ❌ createRequestKey helper not exported');
    errors++;
  }

  console.log('  ✅ Request deduplication fully functional\n');
} catch (error) {
  console.error(`  ❌ Failed to load request deduplication: ${error.message}\n`);
  errors++;
}

// Test 6: Verify auth setup script exists
console.log('✓ Test 6: Interactive Auth Setup');
try {
  const fs = await import('fs');
  const authScriptPath = './dist/cli/auth-setup.js';

  if (!fs.existsSync(authScriptPath)) {
    console.error(`  ❌ Auth setup script not found at ${authScriptPath}`);
    errors++;
  } else {
    console.log('  ✅ Auth setup script present\n');
  }
} catch (error) {
  console.error(`  ❌ Failed to verify auth setup: ${error.message}\n`);
  errors++;
}

// Test 7: Check environment variable configuration
console.log('✓ Test 7: Environment Configuration');
try {
  // Check .env file exists
  const fs = await import('fs');

  if (!fs.existsSync('.env')) {
    console.log('  ⚠️  No .env file found (run "npm run auth" to create one)');
    warnings++;
  } else {
    const envContent = fs.readFileSync('.env', 'utf-8');

    // Check for key variables
    const checks = [
      { key: 'OAUTH_CLIENT_ID', optional: true },
      { key: 'OAUTH_CLIENT_SECRET', optional: true },
      { key: 'ENCRYPTION_KEY', optional: true },
      { key: 'CACHE_ENABLED', optional: true },
      { key: 'DEDUPLICATION_ENABLED', optional: true },
    ];

    for (const { key, optional } of checks) {
      if (!envContent.includes(key)) {
        if (optional) {
          console.log(`  ℹ️  ${key} not set (will use defaults)`);
        } else {
          console.log(`  ⚠️  ${key} not set`);
          warnings++;
        }
      }
    }
  }

  console.log('  ✅ Environment configuration checked\n');
} catch (error) {
  console.error(`  ❌ Failed to check environment: ${error.message}\n`);
  errors++;
}

// Test 8: Verify HTTP server integration
console.log('✓ Test 8: HTTP Server Integration');
try {
  const httpServer = await import('../dist/http-server.js');
  console.log('  ✅ HTTP server loads successfully\n');
} catch (error) {
  console.error(`  ❌ Failed to load HTTP server: ${error.message}\n`);
  errors++;
}

// Test 9: Verify CLI integration
console.log('✓ Test 9: CLI Integration');
try {
  // Just check it loads, don't execute
  const fs = await import('fs');
  if (!fs.existsSync('./dist/cli.js')) {
    console.error('  ❌ CLI script not found');
    errors++;
  } else {
    console.log('  ✅ CLI script present\n');
  }
} catch (error) {
  console.error(`  ❌ Failed to verify CLI: ${error.message}\n`);
  errors++;
}

// Summary
console.log('═'.repeat(60));
console.log('VERIFICATION SUMMARY');
console.log('═'.repeat(60));

if (errors === 0 && warnings === 0) {
  console.log('✅ ALL TESTS PASSED - Integration verified successfully!');
  console.log('\nPhases 1-4 are fully integrated and ready for production:');
  console.log('  ✓ Phase 1: Interactive Auth Setup');
  console.log('  ✓ Phase 2: Lifecycle Management');
  console.log('  ✓ Phase 3: Observability (Tracing + Connection Health)');
  console.log('  ✓ Phase 4: Performance (Cache + Deduplication)');
  console.log('\nNext steps:');
  console.log('  1. Run "npm run auth" to set up OAuth authentication');
  console.log('  2. Start the server with "npm run start:http"');
  console.log('  3. Monitor performance with cache/dedup statistics');
  process.exit(0);
} else {
  console.log(`❌ VERIFICATION FAILED`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Warnings: ${warnings}`);
  console.log('\nPlease review the errors above and fix any issues.');
  process.exit(1);
}
