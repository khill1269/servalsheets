/**
 * Restart Policy with Exponential Backoff
 *
 * Implements filesystem-based exponential backoff to prevent rapid restart loops
 * when supervisors (Claude Desktop, PM2, Docker, systemd) automatically restart
 * failed processes.
 *
 * Strategy:
 * - Track consecutive failures in persistent storage (~/.servalsheets/restart-state.json)
 * - Apply exponential backoff: min(baseDelay * 2^failures, maxDelay)
 * - Reset counter after successful startup (server runs > 30 seconds)
 * - First failure: no delay, immediate retry
 * - Second failure: 2s delay
 * - Third failure: 4s delay
 * - Fourth failure: 8s delay
 * - Maximum: 60s delay
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { logger } from '../utils/logger.js';

// Configuration constants
const MIN_BACKOFF_MS = parseInt(process.env['MIN_RESTART_BACKOFF_MS'] || '1000', 10); // 1 second
const MAX_BACKOFF_MS = parseInt(process.env['MAX_RESTART_BACKOFF_MS'] || '60000', 10); // 60 seconds
const SUCCESS_THRESHOLD_MS = parseInt(process.env['SUCCESS_THRESHOLD_MS'] || '30000', 10); // 30 seconds

// State file location
const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || '/tmp';
const STATE_FILE = join(homeDir, '.servalsheets', 'restart-state.json');

export interface RestartState {
  lastStartAttempt: number;
  consecutiveFailures: number;
  lastSuccessfulStart: number;
}

/**
 * Calculate backoff delay based on consecutive failures
 * Formula: min(baseDelay * 2^failures, maxDelay)
 *
 * Examples:
 * - 0 failures: 0ms (no delay)
 * - 1 failure: 2000ms (2 seconds)
 * - 2 failures: 4000ms (4 seconds)
 * - 3 failures: 8000ms (8 seconds)
 * - 4 failures: 16000ms (16 seconds)
 * - 5 failures: 32000ms (32 seconds)
 * - 6+ failures: 60000ms (60 seconds max)
 */
function calculateBackoff(consecutiveFailures: number): number {
  if (consecutiveFailures === 0) {
    return 0;
  }

  const backoff = MIN_BACKOFF_MS * Math.pow(2, consecutiveFailures - 1);
  return Math.min(backoff, MAX_BACKOFF_MS);
}

/**
 * Load restart state from persistent storage
 */
async function loadRestartState(): Promise<RestartState> {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(data) as RestartState;

    logger.debug('Loaded restart state', {
      lastStartAttempt: new Date(parsed.lastStartAttempt).toISOString(),
      consecutiveFailures: parsed.consecutiveFailures,
      lastSuccessfulStart: parsed.lastSuccessfulStart
        ? new Date(parsed.lastSuccessfulStart).toISOString()
        : 'never',
    });

    return parsed;
  } catch {
    // File doesn't exist or is corrupt - return defaults
    logger.debug('No restart state found, using defaults');
    return {
      lastStartAttempt: 0,
      consecutiveFailures: 0,
      lastSuccessfulStart: 0,
    };
  }
}

/**
 * Save restart state to persistent storage
 */
async function saveRestartState(state: RestartState): Promise<void> {
  try {
    // Ensure directory exists
    await fs.mkdir(dirname(STATE_FILE), { recursive: true });

    // Write state atomically (write to temp file, then rename)
    const tempFile = `${STATE_FILE}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(state, null, 2), 'utf-8');
    await fs.rename(tempFile, STATE_FILE);

    logger.debug('Saved restart state', {
      consecutiveFailures: state.consecutiveFailures,
      lastStartAttempt: new Date(state.lastStartAttempt).toISOString(),
    });
  } catch (error) {
    // Ignore write errors - worst case is no backoff
    logger.warn('Failed to save restart state', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Check if we should enforce backoff delay before starting
 * Returns delay in milliseconds (0 = start immediately)
 */
export async function checkRestartBackoff(): Promise<number> {
  const state = await loadRestartState();
  const now = Date.now();

  // If last start was successful (ran for > SUCCESS_THRESHOLD_MS), reset failure count
  if (
    state.lastSuccessfulStart > 0 &&
    state.lastSuccessfulStart - state.lastStartAttempt > SUCCESS_THRESHOLD_MS
  ) {
    logger.debug('Last startup was successful, resetting failure count');
    state.consecutiveFailures = 0;
    await saveRestartState(state);
    return 0;
  }

  // Calculate required backoff based on consecutive failures
  if (state.consecutiveFailures > 0) {
    const backoffDelay = calculateBackoff(state.consecutiveFailures);
    const timeSinceLastAttempt = now - state.lastStartAttempt;

    if (timeSinceLastAttempt < backoffDelay) {
      const remainingDelay = backoffDelay - timeSinceLastAttempt;

      logger.info('Restart backoff applied', {
        consecutiveFailures: state.consecutiveFailures,
        backoffDelay,
        timeSinceLastAttempt,
        remainingDelay,
      });

      return remainingDelay;
    }
  }

  return 0; // No backoff needed
}

/**
 * Record a startup attempt
 * Increments failure counter for exponential backoff calculation
 */
export async function recordStartupAttempt(): Promise<void> {
  const state = await loadRestartState();
  state.lastStartAttempt = Date.now();
  state.consecutiveFailures += 1;

  logger.debug('Recorded startup attempt', {
    consecutiveFailures: state.consecutiveFailures,
    nextBackoffDelay: calculateBackoff(state.consecutiveFailures),
  });

  await saveRestartState(state);
}

/**
 * Record a successful startup (server ran for > SUCCESS_THRESHOLD_MS)
 * Resets failure counter
 */
export async function recordSuccessfulStartup(): Promise<void> {
  const state = await loadRestartState();
  const now = Date.now();
  const uptime = now - state.lastStartAttempt;

  // Only record as successful if server ran long enough
  if (uptime >= SUCCESS_THRESHOLD_MS) {
    state.lastSuccessfulStart = now;
    state.consecutiveFailures = 0;

    logger.info('Recorded successful startup', {
      uptime,
      threshold: SUCCESS_THRESHOLD_MS,
    });

    await saveRestartState(state);
  } else {
    logger.debug('Startup too short to consider successful', {
      uptime,
      threshold: SUCCESS_THRESHOLD_MS,
    });
  }
}

/**
 * Clear restart state (for manual restarts or debugging)
 * Can be called explicitly to reset backoff counters
 */
export async function clearRestartState(): Promise<void> {
  try {
    await fs.unlink(STATE_FILE);
    logger.info('Restart state cleared');
  } catch {
    // Ignore errors - file might not exist
    logger.debug('No restart state to clear');
  }
}

/**
 * Get current restart state (for monitoring/debugging)
 */
export async function getRestartState(): Promise<RestartState> {
  return loadRestartState();
}

/**
 * Format backoff delay for human-readable display
 */
export function formatBackoffDelay(delayMs: number): string {
  if (delayMs === 0) {
    return 'none';
  }

  const seconds = Math.ceil(delayMs / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}
