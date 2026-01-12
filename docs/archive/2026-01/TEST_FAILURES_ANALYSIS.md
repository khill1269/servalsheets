# Test Failures Analysis
**Generated**: 2026-01-10
**Test Run**: Full suite via `npm test`

## Summary

**Total Test Files Analyzed**: ~98
**Test Failures Identified**: ~140 failures across 7 test file categories

## Failure Categories

### Category 1: Metrics Service Tests (44 failures)
**Files**:
- `tests/services/metrics.test.ts` (25 failures)
- `tests/services/metrics.extended.test.ts` (19 failures)

**Priority**: P1 (High)
**Estimated Fix Time**: 3-4 hours

### Category 2: Sheet Resolver Tests (41 failures)
**Files**:
- `tests/services/sheet-resolver.extended.test.ts` (31 failures)
- `tests/services/sheet-resolver.test.ts` (10 failures)

**Priority**: P1 (High)
**Estimated Fix Time**: 3-4 hours

### Category 3: History Service Tests (17 failures)
**Files**:
- `tests/services/history-service.extended.test.ts` (15 failures)
- `tests/services/history-service.test.ts` (2 failures)

**Priority**: P1 (High)
**Estimated Fix Time**: 2-3 hours

## Next Steps

1. Complete full test run
2. Start with singleton reset fixes
3. Update mocks for Zod v4
4. Fix service tests category by category

**Total Estimated Fix Time**: 12-16 hours
