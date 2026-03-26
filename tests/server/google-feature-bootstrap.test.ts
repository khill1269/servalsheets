import { describe, expect, it, vi } from 'vitest';

const featureBootstrapMocks = vi.hoisted(() => ({
  initTransactionManager: vi.fn(),
  initConflictDetector: vi.fn(),
  initImpactAnalyzer: vi.fn(),
  initValidationEngine: vi.fn(),
}));

vi.mock('../../src/services/transaction-manager.js', () => ({
  initTransactionManager: featureBootstrapMocks.initTransactionManager,
}));

vi.mock('../../src/services/conflict-detector.js', () => ({
  initConflictDetector: featureBootstrapMocks.initConflictDetector,
}));

vi.mock('../../src/services/impact-analyzer.js', () => ({
  initImpactAnalyzer: featureBootstrapMocks.initImpactAnalyzer,
}));

vi.mock('../../src/services/validation-engine.js', () => ({
  initValidationEngine: featureBootstrapMocks.initValidationEngine,
}));

import { initializeGoogleAdvancedFeatures } from '../../src/server/google-feature-bootstrap.js';

describe('google feature bootstrap helper', () => {
  it('initializes the shared Phase 4 Google-backed services', () => {
    const googleClient = { sheets: {}, drive: {} };

    initializeGoogleAdvancedFeatures(googleClient as never);

    expect(featureBootstrapMocks.initTransactionManager).toHaveBeenCalledWith(googleClient);
    expect(featureBootstrapMocks.initConflictDetector).toHaveBeenCalledWith(googleClient);
    expect(featureBootstrapMocks.initImpactAnalyzer).toHaveBeenCalledWith(googleClient);
    expect(featureBootstrapMocks.initValidationEngine).toHaveBeenCalledWith(googleClient);
  });
});
