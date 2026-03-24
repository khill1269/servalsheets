export const DEFAULT_DEGRADED_STARTUP_PATTERNS = [
  'google',
  'oauth',
  'credential',
  'token',
  'network',
  'enotfound',
  'eai_again',
  'econn',
  'fetch failed',
  'invalid_grant',
  'unauthenticated',
  'permission denied',
  'could not load the default credentials',
] as const;

export interface ProcessBreadcrumbsExtra {
  readonly [key: string]: unknown;
}

export interface DegradedStartupOptions {
  readonly transport?: string;
  readonly nodeEnv?: string;
  readonly allowDegradedExplicitly?: boolean;
  readonly isAuthError?: (error: unknown) => boolean;
  readonly patterns?: readonly string[];
}

export function getProcessBreadcrumbs(
  extra: ProcessBreadcrumbsExtra = {}
): Record<string, unknown> {
  const memory = process.memoryUsage();

  return {
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssMb: Math.round(memory.rss / 1024 / 1024),
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
      externalMb: Math.round(memory.external / 1024 / 1024),
    },
    ...extra,
  };
}

export function shouldAllowDegradedStartup(
  error: unknown,
  options: DegradedStartupOptions = {}
): boolean {
  const allowDegradedByTransport =
    options.transport === 'stdio' ||
    options.nodeEnv === 'test' ||
    options.allowDegradedExplicitly === true;

  if (!allowDegradedByTransport) {
    return false;
  }

  if (options.isAuthError?.(error) === true) {
    return true;
  }

  const message =
    error instanceof Error
      ? `${error.name} ${error.message} ${error.stack ?? ''}`
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);
  const normalized = message.toLowerCase();
  const patterns = options.patterns ?? DEFAULT_DEGRADED_STARTUP_PATTERNS;

  return patterns.some((pattern) => normalized.includes(pattern));
}
