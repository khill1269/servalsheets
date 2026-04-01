import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { register } from 'prom-client';
import {
  serverStartupDuration,
  serverStartupPhaseDuration,
} from '../../src/observability/metrics.js';
import { logEnvironmentConfig } from '../../src/startup/lifecycle.js';
import {
  recordStartupPhase,
  recordStartupPhaseSync,
  resetStartupProfilerForTest,
} from '../../src/startup/startup-profiler.js';

describe('startup profiler', () => {
  beforeEach(() => {
    register.clear();
    register.registerMetric(serverStartupDuration);
    register.registerMetric(serverStartupPhaseDuration);
    resetStartupProfilerForTest();
  });

  afterEach(() => {
    resetStartupProfilerForTest();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('records startup phase metrics with phase and transport labels', async () => {
    vi.stubEnv('MCP_TRANSPORT', 'http');

    recordStartupPhaseSync('register_tools', () => undefined);
    await recordStartupPhase('register_resources', async () => undefined);

    const metrics = await register.metrics();
    expect(metrics).toContain('servalsheets_server_startup_phase_duration_seconds');
    expect(metrics).toContain('phase="register_tools"');
    expect(metrics).toContain('phase="register_resources"');
    expect(metrics).toContain('transport="http"');
  });

  it('records startup duration using MCP_TRANSPORT rather than legacy transport env', async () => {
    vi.stubEnv('MCP_TRANSPORT', 'http');
    vi.stubEnv('SERVALSHEETS_TRANSPORT', 'stdio');
    vi.stubEnv('SERVALSHEETS_STARTUP_TIME', String(Date.now() - 250));

    logEnvironmentConfig();

    const metrics = await register.metrics();
    expect(metrics).toContain('servalsheets_server_startup_duration_seconds');
    expect(metrics).toContain('transport="http"');
  });
});
