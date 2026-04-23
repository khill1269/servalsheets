/**
 * Error Recovery Map completeness test
 *
 * Ensures every ErrorCode in ErrorCodeSchema has a non-empty hint in
 * ERROR_RECOVERY_MAP. TypeScript's Record<ErrorCode, ...> type already
 * enforces compile-time completeness, but this runtime check catches
 * the reverse direction (entries removed from the enum but still
 * referenced in the map) and ensures hints are actually non-empty.
 */

import { describe, it, expect } from 'vitest';

import { ErrorCodeSchema } from '../../src/schemas/shared.js';
import { ERROR_RECOVERY_MAP } from '../../src/core/error-recovery-map.js';

describe('ERROR_RECOVERY_MAP completeness', () => {
  it('has a non-empty hint for every ErrorCode', () => {
    const codes = ErrorCodeSchema.options;
    expect(codes.length).toBeGreaterThan(0);

    for (const code of codes) {
      const recovery = ERROR_RECOVERY_MAP[code];
      expect(recovery, `missing recovery entry for code ${code}`).toBeDefined();
      expect(
        typeof recovery.hint === 'string' && recovery.hint.length > 0,
        `empty hint for code ${code}`,
      ).toBe(true);
    }
  });

  it('has no recovery entries for codes that are not in ErrorCodeSchema', () => {
    const validCodes = new Set<string>(ErrorCodeSchema.options);
    for (const code of Object.keys(ERROR_RECOVERY_MAP)) {
      expect(
        validCodes.has(code),
        `ERROR_RECOVERY_MAP has orphan entry for code ${code} not in ErrorCodeSchema`,
      ).toBe(true);
    }
  });

  it('includes fixableVia for key auth-related codes', () => {
    const authCodes = [
      'UNAUTHENTICATED',
      'NOT_AUTHENTICATED',
      'PERMISSION_DENIED',
      'TOKEN_EXPIRED',
      'AUTHENTICATION_REQUIRED',
    ] as const;

    for (const code of authCodes) {
      const recovery = ERROR_RECOVERY_MAP[code];
      expect(recovery.fixableVia, `no fixableVia for auth code ${code}`).toBeDefined();
      expect(recovery.fixableVia?.tool).toBe('sheets_auth');
      expect(recovery.fixableVia?.action).toBe('login');
    }
  });
});
