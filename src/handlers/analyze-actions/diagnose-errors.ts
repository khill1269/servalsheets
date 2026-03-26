/**
 * ServalSheets - Diagnose Errors Action Handler
 *
 * Scans spreadsheet ranges for error values and provides root cause analysis.
 */

import { CellError } from '../../utils/cell-error.js';
import type { AnalyzeHandlerAccess } from './internal.js';
import type { DiagnoseErrorsInput } from '../../schemas/analyze.js';
import { mapError } from '../helpers/error-mapping.js';

export async function handleDiagnoseErrorsAction(
  ha: AnalyzeHandlerAccess,
  req: DiagnoseErrorsInput,
  verbosity: 'minimal' | 'standard' | 'detailed'
) {
  try {
    if (!req.spreadsheetId || !req.range) {
      return ha.makeError({
        code: 'INVALID_PARAMS',
        message: 'spreadsheetId and range are required',
        retryable: false,
      });
    }

    // Fetch range data
    const response = await ha.api.spreadsheets.values.get({
      spreadsheetId: req.spreadsheetId,
      range: req.range,
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const values = response.data.values || [];
    const errors: Array<{
      cell: string;
      errorType: string;
      value: string;
      rootCauses: string[];
      suggestedFixes: string[];
    }> = [];

    // Scan for error values
    const errorTypes = new Map<string, RegExp>([
      ['#REF!', /#REF!/],
      ['#VALUE!', /#VALUE!/],
      ['#NAME?', /#NAME\?/],
      ['#DIV/0!', /#DIV\/0!/],
      ['#NULL!', /#NULL!/],
      ['#N/A', /#N\/A/],
      ['#ERROR!', /#ERROR!/],
    ]);

    for (let row = 0; row < values.length; row++) {
      const rowValues = values[row];
      for (let col = 0; col < rowValues.length; col++) {
        const cellValue = String(rowValues[col]);
        for (const [errorType, pattern] of errorTypes) {
          if (pattern.test(cellValue)) {
            const cellRef = `${columnToLetter(col)}${row + 1}`;
            errors.push({
              cell: cellRef,
              errorType,
              value: cellValue,
              rootCauses: analyzeErrorRootCauses(errorType),
              suggestedFixes: analyzeSuggestedFixes(errorType),
            });
            break;
          }
        }
      }
    }

    return ha.makeSuccess('diagnose_errors', {
      spreadsheetId: req.spreadsheetId,
      range: req.range,
      errorCount: errors.length,
      errors,
      summary: errors.length > 0
        ? `Found ${errors.length} error(s) in range`
        : 'No errors found in range',
    });
  } catch (error) {
    return ha.makeError(mapError(error));
  }
}

function columnToLetter(col: number): string {
  let letter = '';
  while (col >= 0) {
    letter = String.fromCharCode((col % 26) + 65) + letter;
    col = Math.floor(col / 26) - 1;
  }
  return letter;
}

function analyzeErrorRootCauses(errorType: string): string[] {
  const causes: Record<string, string[]> = {
    '#REF!': [
      'Referenced cell or range was deleted',
      'Formula refers to invalid cell reference',
      'Cross-sheet reference to deleted sheet',
    ],
    '#VALUE!': [
      'Formula argument has wrong type (text in numeric function)',
      'Invalid date or time format',
      'Incompatible operands in calculation',
    ],
    '#NAME?': [
      'Function name is misspelled or unrecognized',
      'Named range does not exist',
      'Function is not available in this version',
    ],
    '#DIV/0!': [
      'Division by zero in formula',
      'Denominator evaluates to empty cell or zero',
    ],
    '#NULL!': [
      'Incorrect range operator used',
      'Missing argument in function',
    ],
    '#N/A': [
      'VLOOKUP/HLOOKUP value not found',
      'MATCH function found no match',
      'Function result is not available',
    ],
  };
  return causes[errorType] || ['Unknown error type'];
}

function analyzeSuggestedFixes(errorType: string): string[] {
  const fixes: Record<string, string[]> = {
    '#REF!': [
      'Verify the referenced cell or range exists',
      'Check if the referenced sheet was deleted',
      'Use absolute references ($A$1) instead of relative',
    ],
    '#VALUE!': [
      'Ensure all function arguments are of correct type',
      'Check date/time formats match the locale',
      'Use VALUE() or DATEVALUE() for text conversions',
    ],
    '#NAME?': [
      'Check function spelling and case',
      'Verify named range exists in spreadsheet settings',
      'Use valid Google Sheets function names',
    ],
    '#DIV/0!': [
      'Check denominator value is not zero or empty',
      'Use IFERROR() to handle division errors gracefully',
      'Use IF() to check for zero before dividing',
    ],
    '#NULL!': [
      'Use proper range syntax (A1:Z10 or A1,Z10)',
      'Check all required function arguments are provided',
    ],
    '#N/A': [
      'Verify lookup value exists in the lookup range',
      'Use IFERROR() to handle not-found cases',
      'Check for leading/trailing spaces in lookup values',
    ],
  };
  return fixes[errorType] || ['Try reviewing the formula syntax'];
}
