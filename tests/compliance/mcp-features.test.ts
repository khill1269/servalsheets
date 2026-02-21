/**
 * MCP 2025-11-25 Feature Compliance Tests
 *
 * Tests all MCP features: server instructions, icons, annotations,
 * deferred schemas, capabilities, tool definitions.
 */

import { describe, it, expect } from 'vitest';
import {
  TOOL_ANNOTATIONS,
  TOOL_DESCRIPTIONS,
  TOOL_DESCRIPTIONS_MINIMAL,
  TOOL_COUNT,
  ACTION_COUNT,
} from '../../src/schemas/index.js';
import {
  TOOL_ICONS,
  TOOL_EXECUTION_CONFIG,
  createServerCapabilities,
  getServerInstructions,
} from '../../src/mcp/features-2025-11-25.js';
import { TOOL_DEFINITIONS } from '../../src/mcp/registration/tool-definitions.js';
import { TOOL_ACTIONS } from '../../src/mcp/completions.js';
import { calculateTotalActions } from '../helpers/count-actions.js';

// All tools (includes Tier 7 enterprise tools + federation)
const ALL_TOOLS = [
  'sheets_auth',
  'sheets_core',
  'sheets_data',
  'sheets_format',
  'sheets_dimensions',
  'sheets_visualize',
  'sheets_collaborate',
  'sheets_advanced',
  'sheets_transaction',
  'sheets_quality',
  'sheets_history',
  'sheets_confirm',
  'sheets_analyze',
  'sheets_fix',
  'sheets_composite',
  'sheets_session',
  'sheets_templates',
  'sheets_bigquery',
  'sheets_appsscript',
  'sheets_webhook',
  'sheets_dependencies',
  'sheets_federation',
];

describe('MCP 2025-11-25 Feature Compliance', () => {
  // =========================================================================
  // SERVER INSTRUCTIONS
  // =========================================================================
  describe('Server Instructions', () => {
    const instructions = getServerInstructions();

    it('should include tool and action counts', () => {
      expect(instructions).toContain(`${TOOL_COUNT} tools`);
      expect(instructions).toContain(`${ACTION_COUNT} actions`);
    });

    it('should include authentication step as STEP 1', () => {
      expect(instructions).toContain('STEP 1');
      expect(instructions).toContain('sheets_auth');
      expect(instructions).toContain('NEVER skip authentication');
    });

    it('should include session context as STEP 2', () => {
      expect(instructions).toContain('STEP 2');
      expect(instructions).toContain('sheets_session');
      expect(instructions).toContain('set_active');
    });

    it('should include tool selection decision tree', () => {
      expect(instructions).toContain('TOOL SELECTION DECISION TREE');
    });

    it('should route all tools in decision tree or advanced sections', () => {
      for (const tool of ALL_TOOLS) {
        expect(instructions).toContain(tool);
      }
    });

    it('should include tool chaining patterns', () => {
      expect(instructions).toContain('TOOL CHAINING');
      expect(instructions).toContain('sheets_dependencies analyze_impact');
      expect(instructions).toContain('sheets_analyze scout');
      expect(instructions).toContain('sheets_fix');
    });

    it('should include anti-patterns', () => {
      expect(instructions).toContain("Don't use transactions for single operations");
      expect(instructions).toContain("Don't read entire sheet");
    });

    it('should include error recovery table', () => {
      expect(instructions).toContain('UNAUTHENTICATED');
      expect(instructions).toContain('PERMISSION_DENIED');
      expect(instructions).toContain('QUOTA_EXCEEDED');
    });

    it('should include color format guidance', () => {
      expect(instructions).toContain('0-1 scale');
      expect(instructions).toContain('NOT 0-255');
    });

    it('should include safety checklist', () => {
      expect(instructions).toContain('dryRun');
      expect(instructions).toContain('sheets_confirm');
    });

    it('should include quota awareness section', () => {
      expect(instructions).toContain('quotaStatus');
      expect(instructions).toContain('batch_read');
    });

    it('should include formula expertise section', () => {
      expect(instructions).toContain('Quick formula tips');
      expect(instructions).toContain('VLOOKUP');
      expect(instructions).toContain('INDEX/MATCH');
    });

    it('should include collaborative workflow pattern', () => {
      expect(instructions).toContain('Gather requirements');
      expect(instructions).toContain('Plan execution steps');
      expect(instructions).toContain('Wait for user approval');
      expect(instructions).toContain('Execute with safety checks');
      expect(instructions).toContain('Verify results and report back');
    });

    it('should include Tier 7 tools in decision tree', () => {
      expect(instructions).toContain('sheets_bigquery');
      expect(instructions).toContain('sheets_appsscript');
      expect(instructions).toContain('sheets_templates');
      expect(instructions).toContain('sheets_webhook');
      expect(instructions).toContain('sheets_composite');
      expect(instructions).toContain('sheets_dependencies');
    });
  });

  // =========================================================================
  // ICONS (SEP-973)
  // =========================================================================
  describe('Icons (SEP-973)', () => {
    it('should have icons for all tools', () => {
      for (const tool of ALL_TOOLS) {
        expect(TOOL_ICONS[tool]).toBeDefined();
        expect(TOOL_ICONS[tool]!.length).toBeGreaterThan(0);
      }
    });

    it('should use valid SVG data URIs', () => {
      for (const [tool, icons] of Object.entries(TOOL_ICONS)) {
        for (const icon of icons) {
          expect(icon.src).toMatch(/^data:image\/svg\+xml;base64,/);
          expect(icon.mimeType).toBe('image/svg+xml');
          expect(icon.sizes).toContain('24x24');
        }
      }
    });

    it('should decode to valid SVG', () => {
      // Spot check one icon
      const authIcon = TOOL_ICONS['sheets_auth']![0]!;
      const base64 = authIcon.src.replace('data:image/svg+xml;base64,', '');
      const svg = Buffer.from(base64, 'base64').toString('utf-8');
      expect(svg).toContain('<svg');
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    });
  });

  // =========================================================================
  // ANNOTATIONS
  // =========================================================================
  describe('Tool Annotations', () => {
    it('should have annotations for all tools', () => {
      for (const tool of ALL_TOOLS) {
        expect(TOOL_ANNOTATIONS[tool]).toBeDefined();
      }
    });

    it('should have all 4 required annotation hints', () => {
      for (const [tool, ann] of Object.entries(TOOL_ANNOTATIONS)) {
        expect(ann).toHaveProperty('readOnlyHint');
        expect(ann).toHaveProperty('destructiveHint');
        expect(ann).toHaveProperty('idempotentHint');
        expect(ann).toHaveProperty('openWorldHint');
        expect(ann).toHaveProperty('title');
        expect(typeof ann.title).toBe('string');
        expect(ann.title!.length).toBeGreaterThan(0);
      }
    });

    it('should mark read-only tools correctly', () => {
      // sheets_quality (resolve_conflict) and sheets_history (undo/redo) have write operations
      const readOnlyTools = ['sheets_confirm', 'sheets_analyze', 'sheets_dependencies'];
      for (const tool of readOnlyTools) {
        expect(TOOL_ANNOTATIONS[tool]!.readOnlyHint).toBe(true);
      }
    });

    it('should mark write tools as non-read-only', () => {
      const writeTools = [
        'sheets_data',
        'sheets_core',
        'sheets_format',
        'sheets_dimensions',
        'sheets_fix',
        'sheets_composite',
        'sheets_quality',
        'sheets_history', // resolve_conflict, undo/redo are write operations
      ];
      for (const tool of writeTools) {
        expect(TOOL_ANNOTATIONS[tool]!.readOnlyHint).toBe(false);
      }
    });

    it('should mark destructive tools correctly', () => {
      const destructiveTools = [
        'sheets_core', // delete_sheet
        'sheets_data', // clear, overwrite
        'sheets_dimensions', // delete rows/cols
        'sheets_visualize', // delete charts
        'sheets_collaborate', // remove permissions
        'sheets_advanced', // delete named ranges
        'sheets_transaction', // commit modifies data
        'sheets_fix', // applies fixes
        'sheets_composite', // overwrite data
        'sheets_templates', // delete templates
        'sheets_bigquery', // delete connections
        'sheets_appsscript', // undeploy, run side effects
        'sheets_webhook', // unregister
      ];
      for (const tool of destructiveTools) {
        expect(TOOL_ANNOTATIONS[tool]!.destructiveHint).toBe(true);
      }
    });

    it('should mark non-destructive tools correctly', () => {
      const nonDestructiveTools = [
        'sheets_auth',
        'sheets_format', // formatting doesn't destroy data
        'sheets_quality',
        'sheets_history',
        'sheets_confirm',
        'sheets_analyze',
        'sheets_session',
        'sheets_dependencies',
      ];
      for (const tool of nonDestructiveTools) {
        expect(TOOL_ANNOTATIONS[tool]!.destructiveHint).toBe(false);
      }
    });

    it('should mark open world tools (external API calls) correctly', () => {
      const openWorldTools = [
        'sheets_auth',
        'sheets_core',
        'sheets_data',
        'sheets_format',
        'sheets_dimensions',
        'sheets_visualize',
        'sheets_collaborate',
        'sheets_advanced',
        'sheets_transaction',
        'sheets_analyze',
        'sheets_fix',
        'sheets_composite',
        'sheets_templates',
        'sheets_bigquery',
        'sheets_appsscript',
        'sheets_webhook',
        'sheets_quality',
        'sheets_history', // resolve_conflict, undo/redo call Google API
      ];
      for (const tool of openWorldTools) {
        expect(TOOL_ANNOTATIONS[tool]!.openWorldHint).toBe(true);
      }
    });

    it('should mark local-only tools correctly', () => {
      // sheets_quality (resolve_conflict) and sheets_history (undo/redo) call Google API
      const localTools = ['sheets_confirm', 'sheets_session', 'sheets_dependencies'];
      for (const tool of localTools) {
        expect(TOOL_ANNOTATIONS[tool]!.openWorldHint).toBe(false);
      }
    });
  });

  // =========================================================================
  // TOOL DEFINITIONS
  // =========================================================================
  describe('Tool Definitions', () => {
    it('should define exactly 22 tools (includes Tier 7 enterprise + federation)', () => {
      expect(TOOL_DEFINITIONS.length).toBe(22);
    });

    it('should have unique names', () => {
      const names = TOOL_DEFINITIONS.map((t) => t.name);
      expect(new Set(names).size).toBe(22);
    });

    it('should use snake_case naming (SEP-986)', () => {
      for (const tool of TOOL_DEFINITIONS) {
        expect(tool.name).toMatch(/^sheets_[a-z]+$/);
      }
    });

    it('should have non-empty descriptions', () => {
      for (const tool of TOOL_DEFINITIONS) {
        expect(tool.description.length).toBeGreaterThan(10);
      }
    });

    it('should have input and output schemas', () => {
      for (const tool of TOOL_DEFINITIONS) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.outputSchema).toBeDefined();
      }
    });

    it('should have annotations with all 4 required hints', () => {
      for (const tool of TOOL_DEFINITIONS) {
        expect(tool.annotations).toHaveProperty('readOnlyHint');
        expect(tool.annotations).toHaveProperty('destructiveHint');
        expect(tool.annotations).toHaveProperty('idempotentHint');
        expect(tool.annotations).toHaveProperty('openWorldHint');
        expect(tool.annotations).toHaveProperty('title');
      }
    });

    it('should have both per-schema and centralized annotations for all tools', () => {
      // ARCHITECTURE NOTE: Two annotation sources exist:
      // 1. Per-schema annotations (e.g. SHEETS_FORMAT_ANNOTATIONS) → used in TOOL_DEFINITIONS
      // 2. Centralized TOOL_ANNOTATIONS → used for /info endpoint and routing metadata
      // These may diverge (e.g. sheets_format destructiveHint differs because per-schema
      // counts rule deletion as destructive while centralized focuses on cell data).
      // This test verifies both sources exist and have complete hints for all tools.
      for (const tool of TOOL_DEFINITIONS) {
        const centralAnn = TOOL_ANNOTATIONS[tool.name];
        expect(centralAnn).toBeDefined();
        // Both should have all 4 hints
        expect(typeof tool.annotations.readOnlyHint).toBe('boolean');
        expect(typeof tool.annotations.destructiveHint).toBe('boolean');
        expect(typeof tool.annotations.idempotentHint).toBe('boolean');
        expect(typeof tool.annotations.openWorldHint).toBe('boolean');
        expect(typeof centralAnn!.readOnlyHint).toBe('boolean');
        expect(typeof centralAnn!.destructiveHint).toBe('boolean');
        expect(typeof centralAnn!.idempotentHint).toBe('boolean');
        expect(typeof centralAnn!.openWorldHint).toBe('boolean');
      }
    });
  });

  // =========================================================================
  // TOOL EXECUTION CONFIG (SEP-1686 Tasks)
  // =========================================================================
  describe('Task Support (SEP-1686)', () => {
    it('should have execution config for all 22 tools', () => {
      for (const tool of ALL_TOOLS) {
        expect(TOOL_EXECUTION_CONFIG[tool]).toBeDefined();
      }
    });

    it('should allow task support for long-running tools', () => {
      const longRunning = [
        'sheets_analyze',
        'sheets_data',
        'sheets_format',
        'sheets_dimensions',
        'sheets_visualize',
        'sheets_composite',
        'sheets_appsscript',
        'sheets_bigquery',
        'sheets_templates',
      ];
      for (const tool of longRunning) {
        expect(TOOL_EXECUTION_CONFIG[tool]!.taskSupport).toBe('optional');
      }
    });

    it('should forbid task support for fast tools', () => {
      const fast = [
        'sheets_auth',
        'sheets_core',
        'sheets_collaborate',
        'sheets_advanced',
        'sheets_transaction',
        'sheets_quality',
        'sheets_history',
        'sheets_confirm',
        'sheets_fix',
        'sheets_session',
      ];
      for (const tool of fast) {
        expect(TOOL_EXECUTION_CONFIG[tool]!.taskSupport).toBe('forbidden');
      }
    });
  });

  // =========================================================================
  // SERVER CAPABILITIES
  // =========================================================================
  describe('Server Capabilities', () => {
    const caps = createServerCapabilities();

    it('should declare completions capability', () => {
      expect(caps.completions).toBeDefined();
    });

    it('should declare tasks capability', () => {
      expect(caps.tasks).toBeDefined();
      expect(caps.tasks!.list).toBeDefined();
      expect(caps.tasks!.cancel).toBeDefined();
    });

    it('should declare logging capability', () => {
      expect(caps.logging).toBeDefined();
    });
  });

  // =========================================================================
  // DESCRIPTIONS
  // =========================================================================
  describe('Tool Descriptions', () => {
    it('should have full descriptions for all 22 tools', () => {
      for (const tool of ALL_TOOLS) {
        expect(TOOL_DESCRIPTIONS[tool]).toBeDefined();
        expect(TOOL_DESCRIPTIONS[tool]!.length).toBeGreaterThan(50);
      }
    });

    it('should have minimal descriptions for all 22 tools', () => {
      for (const tool of ALL_TOOLS) {
        expect(TOOL_DESCRIPTIONS_MINIMAL[tool]).toBeDefined();
        expect(TOOL_DESCRIPTIONS_MINIMAL[tool]!.length).toBeGreaterThan(10);
      }
    });

    it('should have minimal descriptions shorter than full descriptions', () => {
      for (const tool of ALL_TOOLS) {
        expect(TOOL_DESCRIPTIONS_MINIMAL[tool]!.length).toBeLessThan(
          TOOL_DESCRIPTIONS[tool]!.length
        );
      }
    });
  });

  // =========================================================================
  // METADATA COUNTS
  // =========================================================================
  describe('Metadata Counts', () => {
    it('should have correct tool count', () => {
      // TOOL_COUNT must match TOOL_DEFINITIONS length
      expect(TOOL_COUNT).toBe(TOOL_DEFINITIONS.length);
      expect(TOOL_COUNT).toBe(22); // As of 2026-02-16
    });

    it('should have correct action count (dynamically validated)', () => {
      // Calculate actual action count from TOOL_ACTIONS (single source of truth)
      const actualActionCount = calculateTotalActions(TOOL_ACTIONS);

      // ACTION_COUNT constant must match the sum of all tool actions
      expect(ACTION_COUNT).toBe(actualActionCount);

      // Sanity check: we should have a reasonable number of actions
      expect(actualActionCount).toBeGreaterThan(290);
      expect(actualActionCount).toBeLessThan(350);
    });
  });
});
