/**
 * Global Test Setup
 *
 * Runs before each test file to ensure clean state.
 * Resets all singleton services to prevent test pollution.
 */

import { beforeEach, afterEach } from 'vitest';
import { resetAllSingletons } from './helpers/singleton-reset.js';

// Disable response compaction in tests to ensure predictable responses
process.env['COMPACT_RESPONSES'] = 'false';

// Reset all singletons before each test
beforeEach(() => {
  resetAllSingletons();
});

// Optional: Clean up after each test
afterEach(() => {
  // Additional cleanup if needed
});
