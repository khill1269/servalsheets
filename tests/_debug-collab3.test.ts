/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Copy EXACT mocks from collaborate-approval.test.ts - ALL of them
vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../src/utils/safety-helpers.js', () => ({
  createSnapshotIfNeeded: vi.fn().mockResolvedValue(undefined),
  requestSafetyConfirmation: vi.fn().mockResolvedValue({
    confirmed: true, required: true, outcome: 'accepted', source: 'policy',
  }),
}));
vi.mock('../../src/mcp/elicitation.js', () => ({
  confirmDestructiveAction: vi.fn().mockResolvedValue({ confirmed: true }),
}));
vi.mock('../../src/security/incremental-scope.js', () => {
  const MockScopeValidator = vi.fn().mockImplementation(function (this: any) {
    this.requireScope = vi.fn();
    this.hasScope = vi.fn().mockReturnValue(true);
    this.validateOperation = vi.fn();
    return this;
  });
  return {
    ScopeValidator: MockScopeValidator,
    ScopeCategory: {
      SPREADSHEETS: 'spreadsheets', DRIVE: 'drive',
      DRIVE_FILE: 'drive.file', SPREADSHEETS_READONLY: 'spreadsheets.readonly',
    },
    IncrementalScopeRequiredError: class extends Error {},
  };
});
vi.mock('../../src/utils/request-context.js', () => ({
  getRequestLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  sendProgress: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/utils/error-factory.js', () => ({
  createNotFoundError: vi.fn((params: any) => ({
    code: 'NOT_FOUND', message: `${params.resourceType} not found`, retryable: false,
  })),
  createValidationError: vi.fn((params: any) => ({
    code: 'INVALID_PARAMS', message: params.reason ?? 'Validation failed', retryable: false,
  })),
}));

import { CollaborateHandler } from '../../src/handlers/collaborate.js';
import { ScopeValidator } from '../../src/security/incremental-scope.js';

describe('Debug test', () => {
  it('direct ScopeValidator check', () => {
    const v = new ScopeValidator({ scopes: [] });
    console.log('ScopeValidator instance keys:', Object.keys(v));
    console.log('typeof validateOperation:', typeof (v as any).validateOperation);
    expect(typeof (v as any).validateOperation).toBe('function');
  });
});
