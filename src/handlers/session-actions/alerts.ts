/**
 * Session alert action handlers.
 * Covers: get_alerts, acknowledge_alert, clear_alerts
 */

import type { SheetsSessionOutput } from '../../schemas/session.js';
import type { SessionContextManager } from '../../services/session-context.js';
import { ValidationError } from '../../core/errors.js';

export function handleGetAlerts(
  session: SessionContextManager,
  req: {
    action: 'get_alerts';
    onlyUnacknowledged?: boolean;
    severity?: string;
  }
): SheetsSessionOutput {
  const { onlyUnacknowledged, severity } = req;

  const alerts = session.getAlerts({
    onlyUnacknowledged: onlyUnacknowledged ?? true,
    severity,
  });

  // Alert type from session-context has `actionable` params typed as
  // Record<string, unknown>, while the output schema uses a specific value union.
  // The runtime values are always compatible.
  return {
    response: {
      success: true,
      action: 'get_alerts' as const,
      alerts,
      count: alerts.length,
      hasCritical: alerts.some((a) => a.severity === 'critical'),
    },
  } as SheetsSessionOutput;
}

export function handleAcknowledgeAlert(
  session: SessionContextManager,
  req: { action: 'acknowledge_alert'; alertId?: string }
): SheetsSessionOutput {
  const { alertId } = req;
  const acknowledged = session.acknowledgeAlert(alertId!);
  if (!acknowledged) {
    throw new ValidationError(`Alert not found: ${alertId}`, 'alertId');
  }
  return {
    response: {
      success: true,
      action: 'acknowledge_alert' as const,
      alertId: alertId!,
      message: 'Alert acknowledged',
    },
  };
}

export function handleClearAlerts(session: SessionContextManager): SheetsSessionOutput {
  session.clearAlerts();
  return {
    response: {
      success: true,
      action: 'clear_alerts' as const,
      message: 'All alerts cleared',
    },
  };
}
