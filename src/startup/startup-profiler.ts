import { serverStartupPhaseDuration } from '../observability/metrics.js';
import { logger as defaultLogger } from '../utils/logger.js';

interface StartupPhaseState {
  phase: string;
  startedAt: number;
  durationMs?: number;
  completedAt?: number;
}

const startupPhases = new Map<string, StartupPhaseState>();
const startupPhaseOrder: string[] = [];

function getTransportLabel(): string {
  return process.env['MCP_TRANSPORT'] || 'stdio';
}

export function resetStartupProfilerForTest(): void {
  startupPhases.clear();
  startupPhaseOrder.length = 0;
}

export function beginStartupPhase(phase: string): void {
  if (startupPhases.has(phase)) {
    return;
  }

  startupPhases.set(phase, {
    phase,
    startedAt: Date.now(),
  });
  startupPhaseOrder.push(phase);
}

export function endStartupPhase(phase: string): number | undefined {
  const existing = startupPhases.get(phase);
  if (!existing) {
    return undefined;
  }

  if (existing.durationMs !== undefined) {
    return existing.durationMs;
  }

  const completedAt = Date.now();
  const durationMs = Math.max(0, completedAt - existing.startedAt);

  existing.completedAt = completedAt;
  existing.durationMs = durationMs;

  serverStartupPhaseDuration.observe(
    {
      phase,
      transport: getTransportLabel(),
    },
    durationMs / 1000
  );

  return durationMs;
}

export async function recordStartupPhase<T>(
  phase: string,
  operation: () => Promise<T> | T
): Promise<T> {
  beginStartupPhase(phase);
  try {
    return await operation();
  } finally {
    endStartupPhase(phase);
  }
}

export function recordStartupPhaseSync<T>(phase: string, operation: () => T): T {
  beginStartupPhase(phase);
  try {
    return operation();
  } finally {
    endStartupPhase(phase);
  }
}

export function getStartupPhaseSummary(): Array<{ phase: string; durationMs: number }> {
  return startupPhaseOrder
    .map((phase) => startupPhases.get(phase))
    .filter((entry): entry is StartupPhaseState => Boolean(entry && entry.durationMs !== undefined))
    .map((entry) => ({
      phase: entry.phase,
      durationMs: entry.durationMs ?? 0,
    }));
}

export function flushStartupSummary(
  log: Pick<typeof defaultLogger, 'info'> = defaultLogger
): Array<{ phase: string; durationMs: number }> {
  const summary = getStartupPhaseSummary();
  if (summary.length === 0) {
    return summary;
  }

  log.info('Startup phase timing', {
    transport: getTransportLabel(),
    phases: summary,
  });

  return summary;
}
