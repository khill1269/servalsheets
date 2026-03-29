import { describe, expect, it, vi } from 'vitest';

import {
  createSnapshotIfNeeded,
  generateSafetyWarnings,
  getConfirmationDecision,
} from '../../src/utils/safety-helpers.js';

describe('safety helpers', () => {
  it('treats autoSnapshot as a valid snapshot request for destructive operations', async () => {
    const snapshotService = {
      create: vi.fn(async () => ({ id: 'snap-123' })),
    };

    const snapshot = await createSnapshotIfNeeded(
      snapshotService as any,
      {
        isDestructive: true,
        operationType: 'delete_rows',
        spreadsheetId: 'spreadsheet-1',
        affectedRows: 25,
      },
      {
        autoSnapshot: true,
      }
    );

    expect(snapshotService.create).toHaveBeenCalledWith('spreadsheet-1', 'Before delete_rows');
    expect(snapshot).toMatchObject({
      snapshotId: 'snap-123',
    });
  });

  it('does not recommend snapshots when autoSnapshot is already enabled', () => {
    const warnings = generateSafetyWarnings(
      {
        isDestructive: true,
        operationType: 'clear_range',
        affectedCells: 250,
      },
      {
        autoSnapshot: true,
      }
    );

    expect(warnings.some((warning) => warning.type === 'snapshot_recommended')).toBe(false);
  });

  it('lets an explicit createSnapshot=false override autoSnapshot=true', async () => {
    const snapshotService = {
      create: vi.fn(async () => ({ id: 'snap-123' })),
    };

    const snapshot = await createSnapshotIfNeeded(
      snapshotService as any,
      {
        isDestructive: true,
        operationType: 'delete_columns',
        spreadsheetId: 'spreadsheet-1',
        affectedColumns: 5,
      },
      {
        createSnapshot: false,
        autoSnapshot: true,
      }
    );

    expect(snapshotService.create).not.toHaveBeenCalled();
    expect(snapshot).toBeNull();
  });

  it('uses confirmation-policy thresholds for dimensions row deletes', () => {
    expect(
      getConfirmationDecision({
        toolName: 'sheets_dimensions',
        actionName: 'delete_rows',
        operationType: 'delete',
        isDestructive: true,
        affectedRows: 11,
      }).required
    ).toBe(true);

    expect(
      getConfirmationDecision({
        toolName: 'sheets_dimensions',
        actionName: 'delete_rows',
        operationType: 'delete',
        isDestructive: true,
        affectedRows: 5,
      }).required
    ).toBe(false);
  });
});
