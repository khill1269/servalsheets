#!/usr/bin/env node
/**
 * Test script to verify TokenManager functionality
 *
 * This script tests the token manager's proactive refresh capabilities:
 * - Token status detection
 * - Refresh threshold calculation
 * - Background monitoring
 * - Security monitoring (anomaly detection)
 */

import { TokenManager } from './dist/services/token-manager.js';

// Mock OAuth2Client for testing
class MockOAuth2Client {
  constructor() {
    this.credentials = {
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      expiry_date: Date.now() + 3000000, // 50 minutes from now (within 80% threshold)
    };
    this.refreshCount = 0;
  }

  async refreshAccessToken() {
    this.refreshCount++;
    const newExpiry = Date.now() + 3600000; // 1 hour from now
    this.credentials = {
      ...this.credentials,
      access_token: `refreshed_token_${this.refreshCount}`,
      expiry_date: newExpiry,
    };
    return { credentials: this.credentials };
  }

  setCredentials(credentials) {
    this.credentials = { ...this.credentials, ...credentials };
  }
}

async function testTokenManager() {
  console.log('Testing TokenManager functionality...\n');

  // Test 1: Token status with valid token
  console.log('=== Test 1: Token Status ===');
  const oauthClient = new MockOAuth2Client();
  const tokenManager = new TokenManager({ oauthClient });

  const status = tokenManager.getTokenStatus();
  console.log(`Has access token: ${status.hasAccessToken}`);
  console.log(`Has refresh token: ${status.hasRefreshToken}`);
  console.log(`Time until expiry: ${Math.round((status.timeUntilExpiry ?? 0) / 1000)}s`);

  if (!status.hasAccessToken || !status.hasRefreshToken) {
    console.error('✗ FAILED: Expected both tokens to be present');
    process.exit(1);
  }
  console.log('✓ Token status correct\n');

  // Test 2: Token doesn't need refresh yet (50 minutes remaining, within 80% threshold)
  console.log('=== Test 2: Token Doesn\'t Need Refresh ===');
  const needsRefresh1 = await tokenManager.checkAndRefresh();
  console.log(`Needs refresh: ${needsRefresh1}`);

  if (needsRefresh1) {
    console.error('✗ FAILED: Token should not need refresh with 50 minutes remaining (within 80% threshold)');
    process.exit(1);
  }
  console.log('✓ Refresh threshold working\n');

  // Test 3: Token needs refresh (simulate near-expiry)
  console.log('=== Test 3: Token Needs Refresh ===');
  oauthClient.credentials.expiry_date = Date.now() + 60000; // 1 minute from now
  const needsRefresh2 = await tokenManager.checkAndRefresh();
  console.log(`Needs refresh: ${needsRefresh2}`);
  console.log(`Refresh count: ${oauthClient.refreshCount}`);

  if (!needsRefresh2 || oauthClient.refreshCount !== 1) {
    console.error('✗ FAILED: Token should have been refreshed');
    process.exit(1);
  }
  console.log('✓ Proactive refresh working\n');

  // Test 4: Metrics tracking
  console.log('=== Test 4: Metrics Tracking ===');
  const metrics = tokenManager.getMetrics();
  console.log(`Total refreshes: ${metrics.totalRefreshes}`);
  console.log(`Successful refreshes: ${metrics.successfulRefreshes}`);
  console.log(`Success rate: ${(metrics.successRate * 100).toFixed(1)}%`);

  if (metrics.totalRefreshes !== 1 || metrics.successfulRefreshes !== 1) {
    console.error('✗ FAILED: Expected 1 successful refresh');
    process.exit(1);
  }
  console.log('✓ Metrics tracking working\n');

  // Test 5: Security monitoring - normal usage
  console.log('=== Test 5: Security Monitoring (Normal) ===');
  let patternStats = tokenManager.getRefreshPatternStats();
  console.log(`Refreshes last hour: ${patternStats.refreshesLastHour}`);
  console.log(`Is anomalous: ${patternStats.isAnomalous}`);

  if (patternStats.isAnomalous) {
    console.error('✗ FAILED: Single refresh should not be anomalous');
    process.exit(1);
  }
  console.log('✓ Normal usage pattern detected\n');

  // Test 6: Security monitoring - anomaly detection
  console.log('=== Test 6: Security Monitoring (Anomaly) ===');
  // Simulate many refreshes to trigger anomaly detection
  for (let i = 0; i < 12; i++) {
    oauthClient.credentials.expiry_date = Date.now() + 60000;
    await tokenManager.checkAndRefresh();
  }

  patternStats = tokenManager.getRefreshPatternStats();
  console.log(`Refreshes last hour: ${patternStats.refreshesLastHour}`);
  console.log(`Is anomalous: ${patternStats.isAnomalous}`);

  if (!patternStats.isAnomalous) {
    console.error('✗ FAILED: Should detect anomaly with 13 refreshes in an hour');
    process.exit(1);
  }
  console.log('✓ Anomaly detection working\n');

  // Test 7: Token refresh callback
  console.log('=== Test 7: Refresh Callback ===');
  let callbackCalled = false;
  let callbackTokens = null;

  const tokenManager2 = new TokenManager({
    oauthClient: new MockOAuth2Client(),
    onTokenRefreshed: async (tokens) => {
      callbackCalled = true;
      callbackTokens = tokens;
    },
  });

  const oauthClient2 = tokenManager2['oauthClient'];
  oauthClient2.credentials.expiry_date = Date.now() + 60000;
  await tokenManager2.refreshToken();

  console.log(`Callback called: ${callbackCalled}`);
  console.log(`Callback received tokens: ${callbackTokens !== null}`);

  if (!callbackCalled || !callbackTokens) {
    console.error('✗ FAILED: onTokenRefreshed callback should be called');
    process.exit(1);
  }
  console.log('✓ Refresh callback working\n');

  // Test 8: Background monitoring start/stop
  console.log('=== Test 8: Background Monitoring ===');
  const tokenManager3 = new TokenManager({
    oauthClient: new MockOAuth2Client(),
    checkIntervalMs: 100, // Fast interval for testing
  });

  tokenManager3.start();
  const metrics3Before = tokenManager3.getMetrics();
  console.log(`Is running: ${metrics3Before.isRunning}`);

  // Wait for a check cycle
  await new Promise(resolve => setTimeout(resolve, 150));

  tokenManager3.stop();
  const metrics3After = tokenManager3.getMetrics();
  console.log(`Stopped: ${!metrics3After.isRunning}`);

  if (!metrics3Before.isRunning || metrics3After.isRunning) {
    console.error('✗ FAILED: Background monitoring start/stop failed');
    process.exit(1);
  }
  console.log('✓ Background monitoring working\n');

  // Final summary
  console.log('=== Final Summary ===');
  const finalMetrics = tokenManager.getMetrics();
  console.log(JSON.stringify({
    totalRefreshes: finalMetrics.totalRefreshes,
    successfulRefreshes: finalMetrics.successfulRefreshes,
    successRate: (finalMetrics.successRate * 100).toFixed(1) + '%',
    averageDuration: Math.round(finalMetrics.averageRefreshDuration) + 'ms',
  }, null, 2));

  console.log('\n✓ All tests passed!');
  console.log('\nTokenManager is working correctly:');
  console.log('  • Proactive token refresh at 80% lifetime');
  console.log('  • Security monitoring with anomaly detection');
  console.log('  • Background monitoring with configurable intervals');
  console.log('  • Metrics tracking for observability');
}

testTokenManager().catch(error => {
  console.error('✗ Test failed:', error);
  process.exit(1);
});
