/**
 * Batch, Custom Function & Explain Action Handlers
 *
 * Actions: custom_function, batch_compute, explain_formula
 */

import { extractRangeA1 } from '../../utils/range-helpers.js';
import { generateAIInsight } from '../../mcp/sampling.js';
import { fetchRangeData, explainFormula } from '../../services/compute-engine.js';
import type { SheetsComputeInput, SheetsComputeOutput } from '../../schemas/compute.js';
import type { ComputeHandlerAccess } from './internal.js';
import { evaluateExpression } from './statistics.js';

export async function handleCustomFunction(
  access: ComputeHandlerAccess,
  req: SheetsComputeInput['request'] & { action: 'custom_function' }
): Promise<SheetsComputeOutput> {
  const startMs = Date.now();
  const data = await fetchRangeData(access.sheetsApi, req.spreadsheetId, extractRangeA1(req.range));
  const headers = (data[0] || []).map(String);
  const rows = data.slice(1);

  // Evaluate expression for each row
  const values: unknown[] = [];

  // BUG-19 fix: Detect if expression uses bare 'x' variable (no $ prefix).
  // LLMs commonly send "x * 1.1" instead of "$ColumnName * 1.1".
  // When 'x' is used and the range has a single data column (or we can infer
  // the target column), substitute x with each row's value.
  const usesBareX = /\bx\b/.test(req.expression) && !/\$/.test(req.expression);

  for (const row of rows) {
    let expr = req.expression;

    if (usesBareX) {
      // Single-variable mode: substitute 'x' with the first (or only) numeric value
      // If range is a single column, use that value. Otherwise use first column.
      const numericIndices = headers
        .map((_, i) => i)
        .filter((i) => typeof row[i] === 'number' || !isNaN(Number(row[i])));
      const targetIdx = numericIndices.length === 1 ? numericIndices[0]! : 0;
      const cellVal = row[targetIdx] ?? 0;
      expr = expr.replace(/\bx\b/g, String(cellVal));
    }

    // Replace $ColumnName and $A, $B etc. with actual values
    for (let i = 0; i < headers.length; i++) {
      const headerName = headers[i]!;
      const colLetter = String.fromCharCode(65 + i);
      const cellVal = row[i] ?? 0;
      expr = expr.replace(new RegExp(`\\$${headerName}`, 'gi'), String(cellVal));
      expr = expr.replace(new RegExp(`\\$${colLetter}\\b`, 'g'), String(cellVal));
    }
    try {
      values.push(evaluateExpression(expr));
    } catch {
      values.push(null);
    }
  }

  // Write to output column if specified
  let writtenToColumn: string | undefined;
  if (req.outputColumn) {
    const colIdx = headers.indexOf(req.outputColumn);
    const targetCol =
      colIdx >= 0 ? String.fromCharCode(65 + colIdx) : String.fromCharCode(65 + headers.length);
    const writeRange = `${targetCol}1:${targetCol}${rows.length + 1}`;
    const writeValues = [[req.outputColumn], ...values.map((v) => [v])];

    const { executeWithRetry } = await import('../../utils/retry.js');
    await executeWithRetry(async () =>
      access.sheetsApi.spreadsheets.values.update({
        spreadsheetId: req.spreadsheetId,
        range: writeRange,
        valueInputOption: 'RAW',
        requestBody: { values: writeValues },
      })
    );
    writtenToColumn = req.outputColumn;
  }

  return {
    response: {
      success: true,
      action: 'custom_function',
      values,
      writtenToColumn,
      rowCount: rows.length,
      computationTimeMs: Date.now() - startMs,
    },
  };
}

export async function handleBatchCompute(
  access: ComputeHandlerAccess,
  req: SheetsComputeInput['request'] & { action: 'batch_compute' }
): Promise<SheetsComputeOutput> {
  const startMs = Date.now();
  const results: Array<{ id: string; success: boolean; result?: unknown; error?: string }> = [];

  for (const computation of req.computations) {
    try {
      const subInput: SheetsComputeInput = {
        request: {
          ...computation.params,
          action: computation.type,
          spreadsheetId: req.spreadsheetId,
          verbosity: req.verbosity,
        } as SheetsComputeInput['request'],
      };
      // Recursively call the appropriate handler based on action type
      const handler = await import('../compute.js').then((m) => m.ComputeHandler);
      const computeHandler = new handler(access.sheetsApi, {
        samplingServer: access.samplingServer,
        duckdbEngine: access.duckdbEngine,
        server: access.server,
        sessionContext: access.sessionContext,
      });
      const subResult = await computeHandler.handle(subInput);
      if (subResult.response.success) {
        const {
          action: _action,
          success: _success,
          computationTimeMs: _computationTimeMs,
          ...rest
        } = subResult.response;
        results.push({ id: computation.id, success: true, result: rest });
      } else {
        results.push({
          id: computation.id,
          success: false,
          error: subResult.response.error.message,
        });
        if (req.stopOnError) break;
      }
    } catch (error) {
      results.push({
        id: computation.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      if (req.stopOnError) break;
    }
  }

  return {
    response: {
      success: true,
      action: 'batch_compute',
      results,
      computationTimeMs: Date.now() - startMs,
    },
  };
}

export async function handleExplainFormula(
  access: ComputeHandlerAccess,
  req: SheetsComputeInput['request'] & { action: 'explain_formula' }
): Promise<SheetsComputeOutput> {
  const startMs = Date.now();
  const explanation = explainFormula(req.formula);

  // Resolve cell references if range provided
  if (req.range) {
    const data = await fetchRangeData(
      access.sheetsApi,
      req.spreadsheetId,
      extractRangeA1(req.range)
    );
    for (const ref of explanation.references) {
      // Try to resolve each reference from the data
      const cellMatch = ref.ref.match(/^([A-Z]+)(\d+)$/i);
      if (cellMatch) {
        const colIdx = cellMatch[1]!.toUpperCase().charCodeAt(0) - 65;
        const rowIdx = parseInt(cellMatch[2]!) - 1;
        if (data[rowIdx] && data[rowIdx]![colIdx] !== undefined) {
          (ref as { ref: string; value?: unknown }).value = data[rowIdx]![colIdx];
        }
      }
    }
  }

  // Generate AI insight with enhanced formula explanation
  let aiInsight: string | undefined;
  if (access.samplingServer) {
    const explainStr = `Formula: ${req.formula}\nBreakdown: ${JSON.stringify(explanation).slice(0, 1500)}`;
    aiInsight = await generateAIInsight(
      access.samplingServer,
      'formulaExplanation',
      'Provide a detailed, plain-language explanation of this formula including edge cases',
      explainStr,
      { maxTokens: 500 }
    );
  }

  return {
    response: {
      success: true,
      action: 'explain_formula',
      explanation,
      computationTimeMs: Date.now() - startMs,
      ...(aiInsight !== undefined ? { aiInsight } : {}),
    },
  };
}
