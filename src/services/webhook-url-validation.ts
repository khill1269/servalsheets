import dns from 'node:dns';
import { logger } from '../utils/logger.js';
import { getEnv } from '../config/env.js';

/**
 * Check if an IPv4 address string is in a private/internal range.
 */
function isPrivateIPv4(ip: string): boolean {
  const match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 127 ||
    a === 0
  );
}

/**
 * Check if an IPv6 address string is private/internal.
 */
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/[[\]]/g, '');
  if (
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe80') ||
    lower === '::1'
  ) {
    return true;
  }

  const v4MappedMatch = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4MappedMatch) {
    return isPrivateIPv4(v4MappedMatch[1]!);
  }

  return false;
}

/**
 * SSRF protection: Block webhook URLs pointing to private/internal networks.
 * Validates HTTPS-only URLs and blocks internal/private IP targets.
 */
export async function validateWebhookUrl(urlString: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error(`Invalid webhook URL: ${urlString}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Webhook URL must use HTTPS');
  }

  const hostname = parsed.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    throw new Error('Webhook URL cannot target localhost');
  }

  if (/^\d+$/.test(hostname)) {
    throw new Error('Webhook URL cannot use decimal IP encoding');
  }

  if (/^0x[0-9a-fA-F]+$/.test(hostname)) {
    throw new Error('Webhook URL cannot use hex IP encoding');
  }

  if (isPrivateIPv4(hostname)) {
    throw new Error('Webhook URL cannot target private/internal IP addresses');
  }

  if (hostname.startsWith('[') || hostname.includes(':')) {
    if (isPrivateIPv6(hostname)) {
      throw new Error('Webhook URL cannot target private/internal IPv6 addresses');
    }
  }

  try {
    const addresses = await dns.promises.resolve(hostname);
    for (const address of addresses) {
      if (isPrivateIPv4(address) || isPrivateIPv6(address)) {
        throw new Error(
          'Webhook URL hostname resolves to a private/internal IP address (DNS rebinding protection)'
        );
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('DNS rebinding')) {
      throw error;
    }

    const dnsStrict = getEnv().WEBHOOK_DNS_STRICT;
    if (dnsStrict) {
      throw new Error(
        `DNS resolution failed for ${hostname} — webhook URL cannot be verified (set WEBHOOK_DNS_STRICT=false to allow in flaky DNS environments)`
      );
    }

    logger.warn(
      'DNS resolution failed during SSRF validation (WEBHOOK_DNS_STRICT=false, allowing)',
      {
        hostname,
        error: error instanceof Error ? error.message : String(error),
      }
    );
  }
}
