import { describe, expect, it } from 'vitest';

import { TOOL_DEFINITIONS } from '../../src/mcp/registration/tool-definitions.js';
import {
  getToolCatalogDiagnostics,
  validateToolCatalogConfiguration,
} from '../../src/mcp/tool-catalog.js';

describe('tool catalog routing integration', () => {
  it('includes validated route manifest diagnostics', () => {
    const diagnostics = getToolCatalogDiagnostics();

    expect(diagnostics.routeManifest.valid).toBe(true);
    expect(diagnostics.routeManifest.missingToolNames).toEqual([]);
    expect(diagnostics.routeManifest.extraToolNames).toEqual([]);
    expect(diagnostics.routingSummary.totalToolCount).toBe(TOOL_DEFINITIONS.length);
    expect(diagnostics.routingSummary.remoteCount).toBeGreaterThan(0);
    expect(diagnostics.routingSummary.preferLocalCount).toBeGreaterThan(0);
  });

  it('validates catalog configuration with route diagnostics attached', () => {
    const diagnostics = validateToolCatalogConfiguration();

    expect(diagnostics.routeManifest.valid).toBe(true);
    expect(diagnostics.routingSummary.stdioExposedCount).toBe(TOOL_DEFINITIONS.length);
  });
});
