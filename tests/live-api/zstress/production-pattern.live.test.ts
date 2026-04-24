import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  getLiveApiClient,
  applyQuotaDelay,
  generateTestId,
  sleep,
  standardAfterEach,
  formatDuration,
} from '../setup/index.js';
import { shouldRunIntegrationTests } from '../../helpers/credential-loader.js';
import type { LiveApiClient } from '../setup/live-api-client.js';

let _prodStressRecords: OpRecord[] = [];

const runStress =
  shouldRunIntegrationTests() &&
  process.env['GOOGLE_OAUTH_TOKENS'] !== undefined &&
  process.env['STRESS_TEST'] === '1';

const STRESS_CONFIG = {
  SESSION_COUNT: 20,
  OPS_PER_SESSION: 8,
  BURST_READ_COUNT: 30,
  P95_LATENCY_LIMIT_MS: 10000,
  SUCCESS_RATE_FLOOR: 0.85,
  TEST_TIMEOUT: 300000,
  HOOK_TIMEOUT: 120000,
} as const;

type OpKind = 'read' | 'write' | 'structural';

interface OpRecord {
  kind: OpKind;
  latencyMs: number;
  success: boolean;
  retryCount: number;
  error?: string;
}

function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function pickKind(rand: () => number): OpKind {
  const r = rand();
  if (r < 0.6) return 'read';
  if (r < 0.9) return 'write';
  return 'structural';
}

function p95(latencies: number[]): number {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1]!;
}

function p50(latencies: number[]): number {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.5)] ?? sorted[sorted.length - 1]!;
}

async function runRead(
  client: LiveApiClient,
  spreadsheetId: string,
  sessionIdx: number
): Promise<OpRecord> {
  const start = Date.now();
  let retryCount = 0;
  const ranges = [
    `Sheet1!A1:D10`,
    `Sheet1!A1:A20`,
    `Sheet1!B1:C5`,
  ] as const;
  const range = ranges[sessionIdx % ranges.length]!;

  try {
    await client.readData(spreadsheetId, range);
    return { kind: 'read', latencyMs: Date.now() - start, success: true, retryCount };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('429') || msg.includes('RATE_LIMIT') || msg.includes('quota')) {
      retryCount++;
      await sleep(2000 + retryCount * 1000);
      try {
        await client.readData(spreadsheetId, range);
        return { kind: 'read', latencyMs: Date.now() - start, success: true, retryCount };
      } catch (retryErr) {
        const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
        return {
          kind: 'read',
          latencyMs: Date.now() - start,
          success: false,
          retryCount,
          error: retryMsg,
        };
      }
    }
    return { kind: 'read', latencyMs: Date.now() - start, success: false, retryCount, error: msg };
  }
}

async function runWrite(
  client: LiveApiClient,
  spreadsheetId: string,
  sessionIdx: number,
  opIdx: number
): Promise<OpRecord> {
  const start = Date.now();
  let retryCount = 0;
  const col = String.fromCharCode(65 + (sessionIdx % 5));
  const row = (opIdx % 10) + 1;

  try {
    await client.writeData(spreadsheetId, `Sheet1!${col}${row}`, [[`s${sessionIdx}_o${opIdx}`]]);
    return { kind: 'write', latencyMs: Date.now() - start, success: true, retryCount };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('429') || msg.includes('RATE_LIMIT') || msg.includes('quota')) {
      retryCount++;
      await sleep(3000 + retryCount * 1500);
      try {
        await client.writeData(spreadsheetId, `Sheet1!${col}${row}`, [
          [`s${sessionIdx}_o${opIdx}_r`],
        ]);
        return { kind: 'write', latencyMs: Date.now() - start, success: true, retryCount };
      } catch (retryErr) {
        const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
        return {
          kind: 'write',
          latencyMs: Date.now() - start,
          success: false,
          retryCount,
          error: retryMsg,
        };
      }
    }
    return { kind: 'write', latencyMs: Date.now() - start, success: false, retryCount, error: msg };
  }
}

async function runStructural(
  client: LiveApiClient,
  spreadsheetId: string,
  sessionIdx: number
): Promise<OpRecord> {
  const start = Date.now();
  try {
    await client.getSpreadsheet(spreadsheetId);
    return { kind: 'structural', latencyMs: Date.now() - start, success: true, retryCount: 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      kind: 'structural',
      latencyMs: Date.now() - start,
      success: false,
      retryCount: 0,
      error: msg,
    };
  }
}

async function runSession(
  client: LiveApiClient,
  spreadsheetId: string,
  sessionIdx: number,
  rand: () => number
): Promise<OpRecord[]> {
  const records: OpRecord[] = [];
  const kinds: OpKind[] = Array.from({ length: STRESS_CONFIG.OPS_PER_SESSION }, () =>
    pickKind(rand)
  );

  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[i]!;
    if (kind === 'read') {
      records.push(await runRead(client, spreadsheetId, sessionIdx));
    } else if (kind === 'write') {
      records.push(await runWrite(client, spreadsheetId, sessionIdx, i));
    } else {
      records.push(await runStructural(client, spreadsheetId, sessionIdx));
    }
    if (i < kinds.length - 1) {
      await sleep(50);
    }
  }

  return records;
}

describe.skipIf(!runStress)('production-pattern stress test', () => {
  let client: LiveApiClient;
  let stressSpreadsheetId: string | null = null;

  beforeAll(
    async () => {
      client = await getLiveApiClient();
      const testId = generateTestId('prod_stress');
      const created = await client.createSpreadsheet(`ProdStress_${testId}`);
      stressSpreadsheetId = created.spreadsheetId;

      await applyQuotaDelay();

      await client.writeData(
        stressSpreadsheetId,
        'Sheet1!A1:D20',
        Array.from({ length: 20 }, (_, i) => [
          `row${i + 1}`,
          (i + 1) * 10,
          `label_${i}`,
          '2024-01-15',
        ])
      );

      await applyQuotaDelay();
    },
    STRESS_CONFIG.HOOK_TIMEOUT
  );

  afterEach(async () => {
    await standardAfterEach();
  });

  afterAll(
    async () => {
      if (stressSpreadsheetId) {
        try {
          await client.deleteSpreadsheet(stressSpreadsheetId);
        } catch {
          // ignore cleanup errors
        }
      }

      const allRecords: OpRecord[] = _prodStressRecords;
      if (allRecords.length > 0) {
        const total = allRecords.length;
        const succeeded = allRecords.filter((r) => r.success).length;
        const latencies = allRecords.map((r) => r.latencyMs);
        console.log(
          [
            '',
            '=== Production Pattern Stress Test Report ===',
            `Total ops:    ${total}`,
            `Success rate: ${((succeeded / total) * 100).toFixed(1)}%  (${succeeded}/${total})`,
            `p50 latency:  ${formatDuration(p50(latencies))}`,
            `p95 latency:  ${formatDuration(p95(latencies))}`,
            '============================================',
          ].join('\n')
        );
      }
    },
    STRESS_CONFIG.HOOK_TIMEOUT
  );

  describe('production load simulation', () => {
    it(
      'handles 20 concurrent sessions with realistic op mix without quota cascade',
      async () => {
        const spreadsheetId = stressSpreadsheetId!;
        const rand = lcg(42);

        const sessionPromises = Array.from(
          { length: STRESS_CONFIG.SESSION_COUNT },
          (_, idx) => runSession(client, spreadsheetId, idx, rand)
        );

        const settled = await Promise.allSettled(sessionPromises);

        const allRecords: OpRecord[] = [];
        for (const result of settled) {
          if (result.status === 'fulfilled') {
            allRecords.push(...result.value);
          }
        }

        _prodStressRecords = allRecords;

        const total = allRecords.length;
        const succeeded = allRecords.filter((r) => r.success).length;
        const successRate = total > 0 ? succeeded / total : 0;
        const latencies = allRecords.map((r) => r.latencyMs);
        const latencyP95 = p95(latencies);

        console.log(
          `Sessions: ${settled.filter((s) => s.status === 'fulfilled').length}/${STRESS_CONFIG.SESSION_COUNT} completed`
        );
        console.log(`Ops: ${succeeded}/${total} succeeded (${(successRate * 100).toFixed(1)}%)`);
        console.log(
          `Latency — p50: ${formatDuration(p50(latencies))}, p95: ${formatDuration(latencyP95)}`
        );

        expect(total).toBeGreaterThan(0);
        expect(successRate).toBeGreaterThanOrEqual(STRESS_CONFIG.SUCCESS_RATE_FLOOR);
        expect(latencyP95).toBeLessThan(STRESS_CONFIG.P95_LATENCY_LIMIT_MS);

        const rejectedSessions = settled.filter((s) => s.status === 'rejected').length;
        expect(rejectedSessions).toBe(0);
      },
      STRESS_CONFIG.TEST_TIMEOUT
    );

    it(
      'recovers from rate-limit errors without manual intervention',
      async () => {
        const spreadsheetId = stressSpreadsheetId!;

        const burstPromises = Array.from({ length: STRESS_CONFIG.BURST_READ_COUNT }, (_, i) =>
          (async (): Promise<{ success: boolean; retryCount: number; error?: string }> => {
            const maxAttempts = 4;
            let attempt = 0;
            while (attempt < maxAttempts) {
              try {
                await client.readData(spreadsheetId, `Sheet1!A${(i % 10) + 1}:D${(i % 10) + 1}`);
                return { success: true, retryCount: attempt };
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                const isRateLimit =
                  msg.includes('429') || msg.includes('RATE_LIMIT') || msg.includes('quota');
                if (isRateLimit && attempt < maxAttempts - 1) {
                  attempt++;
                  await sleep(1000 * attempt + 500);
                  continue;
                }
                return { success: false, retryCount: attempt, error: msg };
              }
            }
            return { success: false, retryCount: attempt };
          })()
        );

        const results = await Promise.allSettled(burstPromises);

        const resolved = results
          .filter((r): r is PromiseFulfilledResult<{ success: boolean; retryCount: number; error?: string }> => r.status === 'fulfilled')
          .map((r) => r.value);

        const succeeded = resolved.filter((r) => r.success).length;
        const hadRetries = resolved.filter((r) => r.retryCount > 0).length;
        const failed = resolved.filter((r) => !r.success);
        const unknownErrors = failed.filter((r) => {
          const msg = r.error ?? '';
          return (
            !msg.includes('429') &&
            !msg.includes('RATE_LIMIT') &&
            !msg.includes('quota') &&
            !msg.includes('rateLimitExceeded')
          );
        });

        console.log(
          `Burst reads: ${succeeded}/${STRESS_CONFIG.BURST_READ_COUNT} succeeded, ${hadRetries} needed retries`
        );

        expect(results.filter((r) => r.status === 'rejected').length).toBe(0);
        expect(unknownErrors.length).toBe(0);

        const totalResolved = resolved.length;
        const burstSuccessRate = totalResolved > 0 ? succeeded / totalResolved : 0;
        expect(burstSuccessRate).toBeGreaterThan(0);

        if (hadRetries > 0) {
          console.log(`Retry logic activated for ${hadRetries} operations`);
        }
      },
      STRESS_CONFIG.TEST_TIMEOUT
    );
  });
});
