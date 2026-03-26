/**
 * Matrix operations: transpose, multiply, determinant, inverse, rank, eigenvalues, trace.
 */

import {
  transpose,
  matrixMultiply,
  determinant,
  invertMatrix,
  computeRank,
  computeEigenvaluesQR,
} from '../compute-engine-math.js';
import { ValidationError } from '../../core/errors.js';

/**
 * Perform matrix operations.
 */
export function matrixOp(
  matrix: number[][],
  operation: string,
  secondMatrix?: number[][]
): { matrix?: number[][]; scalar?: number; eigenvalues?: number[] } {
  switch (operation) {
    case 'transpose':
      return { matrix: transpose(matrix) };
    case 'multiply': {
      if (!secondMatrix)
        throw new ValidationError(
          'multiply requires secondRange',
          'secondRange',
          'a valid A1 range string'
        );
      return { matrix: matrixMultiply(matrix, secondMatrix) };
    }
    case 'determinant': {
      if (matrix.length !== matrix[0]?.length)
        throw new ValidationError(
          'Determinant requires a square matrix',
          'range',
          'NxN square range'
        );
      return { scalar: determinant(matrix) };
    }
    case 'inverse': {
      if (matrix.length !== matrix[0]?.length)
        throw new ValidationError('Inverse requires a square matrix', 'range', 'NxN square range');
      return { matrix: invertMatrix(matrix) };
    }
    case 'trace': {
      if (matrix.length !== matrix[0]?.length)
        throw new ValidationError('Trace requires a square matrix', 'range', 'NxN square range');
      let sum = 0;
      for (let i = 0; i < matrix.length; i++) sum += matrix[i]![i]!;
      return { scalar: sum };
    }
    case 'rank':
      return { scalar: computeRank(matrix) };
    case 'eigenvalues': {
      if (matrix.length !== matrix[0]?.length)
        throw new ValidationError(
          'Eigenvalues requires a square matrix',
          'range',
          'NxN square range'
        );
      return { eigenvalues: computeEigenvaluesQR(matrix) };
    }
    default:
      throw new ValidationError(
        `Unsupported matrix operation: ${operation}`,
        'operation',
        'transpose | multiply | determinant | inverse | trace | rank | eigenvalues'
      );
  }
}
