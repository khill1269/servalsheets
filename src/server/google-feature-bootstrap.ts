import type { GoogleApiClient } from '../services/google-api.js';
import { initConflictDetector } from '../services/conflict-detector.js';
import { initImpactAnalyzer } from '../services/impact-analyzer.js';
import { initTransactionManager } from '../services/transaction-manager.js';
import { initValidationEngine } from '../services/validation-engine.js';

export function initializeGoogleAdvancedFeatures(googleClient: GoogleApiClient): void {
  initTransactionManager(googleClient);
  initConflictDetector(googleClient);
  initImpactAnalyzer(googleClient);
  initValidationEngine(googleClient);
}
