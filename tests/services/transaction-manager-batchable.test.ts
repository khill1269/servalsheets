/**
 * TransactionManager — batchable flag warning tests
 *
 * Verifies that queueing an action annotated with batchable: false in
 * ACTION_ANNOTATIONS emits a non-throwing warning on the Transaction,
 * while batchable actions do not.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TransactionManager } from '../../src/services/transaction-manager.js';

describe('TransactionManager queue batchable warnings', () => {
  let tm: TransactionManager;

  beforeEach(() => {
    tm = new TransactionManager({ enabled: true });
  });

  it('emits a warning when queueing chart_create (batchable: false)', async () => {
    const txnId = await tm.begin('sheet-1', { autoSnapshot: false });
    await tm.queue(txnId, {
      type: 'custom',
      tool: 'sheets_visualize',
      action: 'chart_create',
      params: { dataRange: 'A1:B10', chartType: 'COLUMN' },
    });

    const transaction = tm.getTransaction(txnId);
    expect(transaction.warnings).toBeDefined();
    expect(transaction.warnings!.length).toBe(1);
    expect(transaction.warnings![0]!.action).toBe('sheets_visualize.chart_create');
    expect(transaction.warnings![0]!.reason).toContain('non-batchable');
  });

  it('does NOT emit a warning when queueing sheets_data.write (batchable: true by default)', async () => {
    const txnId = await tm.begin('sheet-1', { autoSnapshot: false });
    await tm.queue(txnId, {
      type: 'values_write',
      tool: 'sheets_data',
      action: 'write',
      params: { range: 'A1', values: [[1]] },
    });

    const transaction = tm.getTransaction(txnId);
    // warnings is either undefined or an empty array
    expect(transaction.warnings ?? []).toEqual([]);
  });

  it('emits warnings for each of the 6 known non-batchable actions', async () => {
    const nonBatchable: Array<[string, string]> = [
      ['sheets_data', 'add_note'],
      ['sheets_data', 'set_hyperlink'],
      ['sheets_advanced', 'set_metadata'],
      ['sheets_collaborate', 'comment_add'],
      ['sheets_collaborate', 'share_add'],
      ['sheets_visualize', 'chart_create'],
    ];

    for (const [tool, action] of nonBatchable) {
      const txnId = await tm.begin(`sheet-${tool}-${action}`, { autoSnapshot: false });
      await tm.queue(txnId, {
        type: 'custom',
        tool,
        action,
        params: {},
      });
      const transaction = tm.getTransaction(txnId);
      expect(
        transaction.warnings?.some((w) => w.action === `${tool}.${action}`),
        `${tool}.${action} should emit a batchable warning`
      ).toBe(true);
    }
  });
});
