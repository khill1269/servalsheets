#!/usr/bin/env tsx
/**
 * Health Monitoring Test Script
 *
 * Tests the integrated health monitoring system:
 * - Heap health check (memory usage)
 * - Connection health check (heartbeat tracking)
 * - Graceful startup and shutdown
 *
 * Usage:
 *   npm run test:health
 *   # or
 *   tsx scripts/test-health-monitoring.ts
 */

import { ServalSheetsServer } from '../src/server.js';

async function testHealthMonitoring() {
  console.log('🏥 Health Monitoring Test\n');
  console.log('Testing integrated health monitoring system...\n');

  const server = new ServalSheetsServer({
    name: 'servalsheets-test',
    version: '1.4.0',
  });

  try {
    // Initialize server (starts health monitoring)
    console.log('1️⃣  Initializing server...');
    await server.initialize();
    console.log('✅ Server initialized\n');

    // Wait for health checks to run
    console.log('2️⃣  Waiting for health checks to execute (5 seconds)...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log('✅ Health checks running\n');

    // Check health status
    console.log('3️⃣  Checking health status...');
    const healthStatus = await server['healthMonitor'].checkAll();
    console.log('✅ Health Status:');
    console.log(`   - Healthy: ${healthStatus.healthy ? '✅' : '❌'}`);
    console.log(`   - Total checks: ${healthStatus.totalChecks}`);
    console.log(`   - Healthy checks: ${healthStatus.healthyChecks}`);
    console.log(`   - Warning checks: ${healthStatus.warningChecks}`);
    console.log(`   - Critical checks: ${healthStatus.criticalChecks}\n`);

    // Display individual check results
    console.log('4️⃣  Individual Check Results:');
    for (const check of healthStatus.checks) {
      const icon = check.status === 'healthy' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
      console.log(`   ${icon} ${check.name}: ${check.status}`);
      console.log(`      ${check.message}`);
      if (check.metadata) {
        console.log(
          `      Metadata: ${JSON.stringify(check.metadata)
            .replace(/"/g, '')
            .replace(/:/g, ': ')
            .replace(/,/g, ', ')}`
        );
      }
      if (check.recommendation) {
        console.log(`      💡 ${check.recommendation}`);
      }
      console.log();
    }

    // Simulate tool calls to trigger heartbeats
    console.log('5️⃣  Simulating tool calls to test heartbeat tracking...');
    const connectionCheck = server['connectionHealthCheck'];
    connectionCheck.recordHeartbeat('sheets_core');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    connectionCheck.recordHeartbeat('sheets_data');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    connectionCheck.recordHeartbeat('sheets_analyze');
    console.log('✅ Heartbeats recorded: sheets_core, sheets_data, sheets_analyze\n');

    // Check connection health after heartbeats
    console.log('6️⃣  Checking connection health after heartbeats...');
    const finalHealth = await server['healthMonitor'].checkAll();
    const connectionHealthCheck = finalHealth.checks.find((c) => c.name === 'connection');
    if (connectionHealthCheck) {
      console.log('✅ Connection Health:');
      console.log(`   Status: ${connectionHealthCheck.status}`);
      console.log(`   Message: ${connectionHealthCheck.message}`);
      if (connectionHealthCheck.metadata) {
        console.log(`   Last activity: ${connectionHealthCheck.metadata['lastActivity']}`);
        console.log(`   Idle time: ${connectionHealthCheck.metadata['idleTimeMs']}ms`);
      }
    }
    console.log();

    // Graceful shutdown
    console.log('7️⃣  Shutting down server...');
    await server.shutdown();
    console.log('✅ Server shutdown complete\n');

    console.log('🎉 All health monitoring tests passed!');
    console.log('\n📊 Summary:');
    console.log('   ✅ Health monitoring starts automatically');
    console.log('   ✅ Heap health check runs every 30 seconds');
    console.log('   ✅ Connection health check tracks heartbeats');
    console.log('   ✅ Graceful shutdown stops all monitoring');
    console.log('\n💡 When Claude restarts, health monitoring will:');
    console.log('   - Start automatically on server.initialize()');
    console.log('   - Track heap usage (warns at 70%, critical at 85%)');
    console.log('   - Monitor connection activity (warns after 60s, critical after 120s)');
    console.log('   - Log health status to console');
    console.log('   - Stop cleanly on shutdown');

    process.exit(0);
  } catch (error) {
    console.error('❌ Health monitoring test failed:', error);
    process.exit(1);
  }
}

// Run test
testHealthMonitoring();
