/**
 * Matrix & Pivot Action Handlers
 *
 * Actions: matrix_op, pivot_compute
 */

import { extractRangeA1 } from '../../utils/range-helpers.js';
import { fetchRangeData, matrixOp, computePivot } from '../../services/compute-engine.js';
import type { SheetsComputeInput, SheetsComputeOutput } from '../../schemas/compute.js';
import type { ComputeHandlerAccess } from './internal.js';

export async function handleMatrixOp(
  access: ComputeHandlerAccess,
  req: SheetsComputeInput['request'] & { action: 'matrix_op' }
): Promise<SheetsComputeOutput> {
  const startMs = Date.now();
  const data = await fetchRangeData(access.sheetsApi, req.spreadsheetId, extractRangeA1(req.range));

  // Convert to numeric matrix
  const matrix = data.map((row) =>
    row.map((cell) => (typeof cell === 'number' ? cell : parseFloat(String(cell)) || 0))
  );

  let secondMatrix: number[][] | undefined;
  if (req.secondRange) {
    const secondData = await fetchRangeData(
      access.sheetsApi,
      req.spreadsheetId,
      extractRangeA1(req.secondRange)
    );
    secondMatrix = secondData.map((row) =>
      row.map((cell) => (typeof cell === 'number' ? cell : parseFloat(String(cell)) || 0))
    );
  }

  const result = matrixOp(matrix, req.operation, secondMatrix);

  // Optionally write result
  let written = false;
  if (req.outputRange && result.matrix) {
    const { executeWithRetry } = await import('../../utils/retry.js');
    await executeWithRetry(async () =>
      access.sheetsApi.spreadsheets.values.update({
        spreadsheetId: req.spreadsheetId,
        range: extractRangeA1(req.outputRange!),
        valueInputOption: 'RAW',
        requestBody: { values: result.matrix },
      })
    );
    written = true;
  }

  return {
    response: {
      success: true,
      action: 'matrix_op',
      matrix: result.matrix,
      scalar: result.scalar,
      eigenvalues: result.eigenvalues,
      written,
      computationTimeMs: Date.now() - startMs,
    },
  };
}

export async function handlePivotCompute(
  access: ComputeHandlerAccess,
  req: SheetsComputeInput['request'] & { action: 'pivot_compute' }
): Promise<SheetsComputeOutput> {
  const startMs = Date.now();
  const data = await fetchRangeData(access.sheetsApi, req.spreadsheetId, extractRangeA1(req.range));

  const result = computePivot(data, {
    rows: req.rows,
    columns: req.columns,
    values: req.values,
    filters: req.filters,
  });

  return {
    response: {
      success: true,
      action: 'pivot_compute',
      pivotTable: result,
      computationTimeMs: Date.now() - startMs,
    },
  };
}
