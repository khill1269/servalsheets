/**
 * ServalSheets — Google Formula Evaluation Service (Layer 3)
 *
 * Evaluates Google-specific formulas (QUERY, FILTER, IMPORTRANGE, GOOGLEFINANCE)
 * that HyperFormula cannot handle locally. Uses a hidden Apps Script evaluation
 * sheet deployed once per spreadsheet.
 *
 * Architecture note: Layer 3 activates for ~10% of real-world sheets. For the other
 * 90%, HyperFormula (Layer 2) handles everything locally with no API calls.
 *
 * See docs/FORMULA_EVALUATION_ARCHITECTURE.md §Layer 3 for full design rationale.
 */

import type { sheets_v4, script_v1 } from 'googleapis';
import { logger } from '../utils/logger.js';
import { executeWithRetry } from '../utils/retry.js';

// Apps Script function name deployed to the target spreadsheet
const EVAL_SCRIPT_FUNCTION = 'evaluateFormulaBatch';

// Hidden evaluation sheet name (hidden from user)
const EVAL_SHEET_NAME = '_ServalEval';

// Max formulas per batch (Apps Script quota constraint)
const MAX_FORMULAS_PER_BATCH = 100;

export interface FormulaEvalRequest {
  formula: string;
  cell: string; // Original cell reference for context
}

export interface FormulaEvalResult {
  formula: string;
  cell: string;
  value: string | number | boolean | null;
  error?: string;
}

/**
 * Google Formula Evaluation Service
 *
 * Requires `deploymentId` — the Apps Script deployment ID for the target
 * spreadsheet's evaluation script. Create via `sheets_appsscript.deploy` if
 * not already deployed.
 */
export class GoogleFormulaService {
  constructor(
    private sheetsApi: sheets_v4.Sheets,
    private scriptApi: script_v1.Script
  ) {}

  /**
   * Evaluate a batch of Google-specific formulas by running an Apps Script
   * function on the target spreadsheet.
   *
   * Falls back gracefully with an informative message if:
   * - No deployment ID provided
   * - Apps Script API unavailable
   * - Rate limit exceeded
   *
   * @returns Results with `error` field set for formulas that couldn't be evaluated
   */
  async evaluateBatch(
    spreadsheetId: string,
    deploymentId: string | undefined,
    requests: FormulaEvalRequest[]
  ): Promise<FormulaEvalResult[]> {
    if (!deploymentId) {
      logger.debug('google_formula_service_no_deployment', { spreadsheetId });
      return requests.map((r) => ({
        ...r,
        value: null,
        error: 'No Apps Script deployment — deploy evaluator script via sheets_appsscript.deploy',
      }));
    }

    if (requests.length === 0) return [];

    // Process in batches of MAX_FORMULAS_PER_BATCH
    const allResults: FormulaEvalResult[] = [];
    for (let i = 0; i < requests.length; i += MAX_FORMULAS_PER_BATCH) {
      const batch = requests.slice(i, i + MAX_FORMULAS_PER_BATCH);
      const batchResults = await this.evaluateSingleBatch(spreadsheetId, deploymentId, batch);
      allResults.push(...batchResults);
    }

    return allResults;
  }

  private async evaluateSingleBatch(
    spreadsheetId: string,
    deploymentId: string,
    requests: FormulaEvalRequest[]
  ): Promise<FormulaEvalResult[]> {
    try {
      const response = await executeWithRetry(async () =>
        this.scriptApi.scripts.run({
          scriptId: deploymentId,
          requestBody: {
            function: EVAL_SCRIPT_FUNCTION,
            parameters: [
              requests.map((r) => ({ formula: r.formula, cell: r.cell })),
              spreadsheetId,
            ],
          },
        })
      );

      const rawResults = response.data['response']?.['result'];
      if (!Array.isArray(rawResults)) {
        return requests.map((r) => ({
          ...r,
          value: null,
          error: 'Apps Script returned unexpected result format',
        }));
      }

      return rawResults.map((item: unknown, i: number) => {
        const req = requests[i]!;
        if (item && typeof item === 'object' && 'value' in item) {
          const typed = item as { formula: string; cell: string; value: unknown; error?: string };
          return {
            formula: req.formula,
            cell: req.cell,
            value: normalizeScriptValue(typed.value),
            ...(typed.error ? { error: typed.error } : {}),
          };
        }
        return { formula: req.formula, cell: req.cell, value: null, error: 'Malformed result' };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('google_formula_service_batch_failed', { spreadsheetId, error: message });
      return requests.map((r) => ({
        ...r,
        value: null,
        error: `Apps Script evaluation failed: ${message}`,
      }));
    }
  }

  /**
   * The Apps Script source code to deploy on the target spreadsheet.
   * Call `sheets_appsscript.create` with this source, then `sheets_appsscript.deploy`.
   */
  static readonly EVAL_SCRIPT_SOURCE = `
/**
 * ServalSheets formula evaluation helper.
 * Deployed automatically by the formula evaluation engine.
 */
function evaluateFormulaBatch(formulas, sourceSheetName) {
  const ss = SpreadsheetApp.getActive();
  let evalSheet = ss.getSheetByName('${EVAL_SHEET_NAME}');
  if (!evalSheet) {
    evalSheet = ss.insertSheet('${EVAL_SHEET_NAME}');
    evalSheet.hideSheet();
  }

  const formulaArray = formulas.map(function(f) { return [f.formula]; });
  evalSheet.getRange(1, 1, formulaArray.length, 1).setFormulas(formulaArray);
  SpreadsheetApp.flush(); // Force synchronous recalculation

  const values = evalSheet.getRange(1, 1, formulaArray.length, 1).getValues();
  evalSheet.clearContents();

  return values.map(function(row, i) {
    return {
      formula: formulas[i].formula,
      cell: formulas[i].cell,
      value: row[0]
    };
  });
}
`.trim();
}

function normalizeScriptValue(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v;
  return String(v);
}
