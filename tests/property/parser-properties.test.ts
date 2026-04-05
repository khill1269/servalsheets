import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseA1Range, parseColumnLetter, parseColumnIndex } from '../../src/utils/a1-parser.js';

describe('A1 Parser Properties', () => {
  describe('Roundtrip Properties', () => {
    it('encode then decode A1 notation should return original', () => {
      fc.assert(
        fc.property(fc.tuple(fc.integer({ min: 1, max: 26 }), fc.integer({ min: 1, max: 1000 })), ([col, row]) => {
          const letter = String.fromCharCode(64 + col);
          const encoded = `${letter}${row}`;
          const decoded = parseA1Range(encoded);
          return decoded && decoded.startRow === row && decoded.startCol === col;
        })
      );
    });
  });

  describe('Idempotence Properties', () => {
    it('parsing same range twice should give same result', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 3, maxLength: 10 }), (input) => {
          const result1 = parseA1Range(input);
          const result2 = parseA1Range(input);
          return JSON.stringify(result1) === JSON.stringify(result2);
        })
      );
    });
  });

  describe('Monotonicity Properties', () => {
    it('column indices should be monotonically increasing', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 1, max: 26 }),
            fc.integer({ min: 1, max: 26 })
          ),
          ([col1, col2]) => {
            const letter1 = String.fromCharCode(64 + col1);
            const letter2 = String.fromCharCode(64 + col2);
            const idx1 = parseColumnIndex(letter1) || 0;
            const idx2 = parseColumnIndex(letter2) || 0;
            return (col1 <= col2) === (idx1 <= idx2);
          }
        )
      );
    });
  });

  describe('Error Containment Properties', () => {
    it('invalid A1 references should not throw', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          try {
            parseA1Range(input);
            return true;
          } catch {
            return false; // Should never throw
          }
        })
      );
    });
  });

  describe('Zod Schema Properties', () => {
    it('valid A1 ranges should parse with Zod', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 1, max: 26 }),
            fc.integer({ min: 1, max: 1000 })
          ),
          ([col, row]) => {
            const letter = String.fromCharCode(64 + col);
            const a1 = `${letter}${row}`;
            const schema = require('../../src/schemas/shared.js').A1NotationSchema;
            const result = schema.safeParse(a1);
            return result.success;
          }
        )
      );
    });
  });
});
