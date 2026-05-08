import { describe, expect, it } from 'vitest';
import { register } from 'prom-client';
import { recordToolCall } from '../../src/observability/metrics.js';

describe('tool call Prometheus metrics', () => {
  it('records histogram observations with success and error_code labels', async () => {
    recordToolCall('test_tool_metrics', 'success_action', 'success', 0.05);
    recordToolCall('test_tool_metrics', 'error_action', 'error', 0.05, 'INVALID_PARAMS');

    const metrics = await register.metrics();

    expect(metrics).toContain(
      'servalsheets_tool_call_duration_seconds_bucket{le="0.1",tool="test_tool_metrics",action="success_action",success="true",error_code="none"}'
    );
    expect(metrics).toContain(
      'servalsheets_tool_call_duration_seconds_bucket{le="0.1",tool="test_tool_metrics",action="error_action",success="false",error_code="INVALID_PARAMS"}'
    );
  });
});
