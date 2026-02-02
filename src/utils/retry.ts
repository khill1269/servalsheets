/**
 * ServalSheets - Retry Utilities
 *
 * Exponential backoff with jitter and request timeouts.
 */

import { getRequestContext, getRequestLogger } from './request-context.js';
import { recordRateLimitHit, recordRetryAttempt } from '../observability/metrics.js';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  retryable?: (error: unknown) => boolean;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = parseInt(process.env['GOOGLE_API_TIMEOUT_MS'] ?? '30000', 10);
const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'retryable' | 'timeoutMs'>> = {
  maxRetries: parseInt(process.env['GOOGLE_API_MAX_RETRIES'] ?? '3', 10),
  baseDelayMs: parseInt(process.env['GOOGLE_API_RETRY_BASE_DELAY_MS'] ?? '500', 10),
  maxDelayMs: parseInt(process.env['GOOGLE_API_RETRY_MAX_DELAY_MS'] ?? '60000', 10),
  jitterRatio: parseFloat(process.env['GOOGLE_API_RETRY_JITTER'] ?? '0.2'),
};

const RETRYABLE_STATUS = new Set([401, 429, 500, 502, 503, 504]);
const RETRYABLE_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ENETUNREACH',
  'ECONNABORTED',
  // HTTP/2 connection errors (Google servers close idle connections after ~5 min)
  'ERR_HTTP2_GOAWAY_SESSION',
  'ERR_HTTP2_SESSION_ERROR',
  'ERR_HTTP2_STREAM_CANCEL',
  'ERR_HTTP2_STREAM_ERROR',
]);

export async function executeWithRetry<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const logger = getRequestLogger();
  const requestContext = getRequestContext();

  const maxRetries = options.maxRetries ?? DEFAULT_RETRY_OPTIONS.maxRetries;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_RETRY_OPTIONS.baseDelayMs;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_RETRY_OPTIONS.maxDelayMs;
  const jitterRatio = options.jitterRatio ?? DEFAULT_RETRY_OPTIONS.jitterRatio;
  const timeoutMs = options.timeoutMs ?? requestContext?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryable = options.retryable ?? isRetryableError;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await withTimeout(operation, timeoutMs);

      // Record successful retry if this wasn't the first attempt
      if (attempt > 0) {
        const status = getErrorStatus(lastError);
        const isRateLimited = status === 429;
        const retryReason = isRateLimited ? 'rate_limit' : status ? `status_${status}` : 'unknown';
        recordRetryAttempt('google-api', retryReason, true, 0);
      }

      return result;
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !retryable(error)) {
        throw error;
      }

      // Enhanced rate limit handling (P2-1: Adaptive backoff for 429s)
      const status = getErrorStatus(error);
      const isRateLimited = status === 429;
      const retryAfterMs = parseRetryAfter(error);
      const backoff = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      const jitter = backoff * jitterRatio * (Math.random() * 2 - 1);
      const delay = Math.max(0, retryAfterMs ?? backoff + jitter);

      if (requestContext?.deadline && Date.now() + delay > requestContext.deadline) {
        logger.warn('Retry skipped due to request deadline', {
          attempt,
          maxRetries,
          delayMs: delay,
          isRateLimited,
        });
        throw error;
      }

      // Enhanced logging for rate limits with Retry-After header detection
      if (isRateLimited) {
        // Record rate limit hit metric
        recordRateLimitHit('google-api', 'sheets');

        logger.warn('Rate limit hit, backing off with adaptive delay', {
          attempt,
          maxRetries,
          delayMs: delay,
          retryAfterMs,
          usedRetryAfterHeader: retryAfterMs !== undefined,
          exponentialBackoff: backoff,
        });
      } else {
        logger.warn('Retrying Google API call', {
          attempt,
          maxRetries,
          delayMs: delay,
          errorStatus: status,
        });
      }

      // Record retry attempt metric
      const retryReason = isRateLimited ? 'rate_limit' : status ? `status_${status}` : 'unknown';
      recordRetryAttempt('google-api', retryReason, false, delay / 1000);

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Extract HTTP status code from error object
 */
function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const errAny = error as {
    code?: unknown;
    response?: { status?: number };
  };

  const status = errAny.response?.status;
  if (typeof status === 'number') {
    return status;
  }

  if (typeof errAny.code === 'number') {
    return errAny.code;
  }

  return undefined;
}

function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const errAny = error as {
    code?: unknown;
    message?: unknown;
    name?: unknown;
    response?: { status?: number; headers?: Record<string, string | string[]> };
  };

  const status = errAny.response?.status;
  if (typeof status === 'number' && RETRYABLE_STATUS.has(status)) {
    // Special handling for 401: only retry if token expired
    if (status === 401) {
      const message = typeof errAny.message === 'string' ? errAny.message.toLowerCase() : '';
      return message.includes('token expired') || message.includes('invalid credentials');
    }
    return true;
  }

  if (typeof errAny.code === 'number' && RETRYABLE_STATUS.has(errAny.code)) {
    return true;
  }

  if (typeof errAny.code === 'string' && RETRYABLE_CODES.has(errAny.code)) {
    return true;
  }

  if (typeof errAny.name === 'string' && errAny.name === 'AbortError') {
    return true;
  }

  if (typeof errAny.message === 'string') {
    const message = errAny.message.toLowerCase();
    return (
      message.includes('rate limit') ||
      message.includes('quota exceeded') ||
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('temporarily unavailable') ||
      message.includes('backend error') ||
      // HTTP/2 GOAWAY errors - connection was closed by server
      message.includes('goaway') ||
      message.includes('new streams cannot be created') ||
      message.includes('session error') ||
      (message.includes('stream') && message.includes('closed')) ||
      message.includes('socket hang up') ||
      (message.includes('connection') && message.includes('closed'))
    );
  }

  return false;
}

function parseRetryAfter(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    // OK: Explicit empty - typed as optional, invalid error object
    return undefined;
  }
  const headers = (error as { response?: { headers?: Record<string, string | string[]> } }).response
    ?.headers;
  if (!headers) {
    // OK: Explicit empty - typed as optional, no response headers
    return undefined;
  }

  const headerValue = headers['retry-after'] ?? headers['Retry-After'];
  if (!headerValue) {
    // OK: Explicit empty - typed as optional, no Retry-After header
    return undefined;
  }

  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return numeric * 1000;
  }

  const parsedDate = Date.parse(String(value));
  if (!Number.isNaN(parsedDate)) {
    return Math.max(0, parsedDate - Date.now());
  }

  // OK: Explicit empty - typed as optional, unparseable Retry-After value
  return undefined;
}

async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const logger = getRequestLogger();
  const controller = new AbortController();
  const timeoutError = new Error(`Request timed out after ${timeoutMs}ms`);
  timeoutError.name = 'TimeoutError';

  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      logger.warn('Request timeout triggered', {
        timeoutMs,
        message: 'Google API call exceeded timeout, aborting request',
      });
      controller.abort();
      reject(timeoutError);
    }, timeoutMs);
  });

  const operationPromise = Promise.resolve(operation(controller.signal));

  try {
    return await Promise.race([operationPromise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    operationPromise.catch(() => undefined);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
