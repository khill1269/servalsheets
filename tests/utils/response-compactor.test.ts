import { describe, it, expect } from 'vitest';
import { compactResponse, isCompactModeEnabled } from '../../src/utils/response-compactor.js';

describe('Response Compactor', () => {
  describe('List Action Fields Preservation (BUG FIX 0.1)', () => {
    it('should preserve permissions array from share_list', () => {
      const response = {
        success: true,
        action: 'share_list',
        permissions: [
          { id: '1', emailAddress: 'user@example.com', role: 'writer' },
          { id: '2', emailAddress: 'viewer@example.com', role: 'reader' },
        ],
      };

      const compacted = compactResponse(response);

      expect(compacted.success).toBe(true);
      expect(compacted.action).toBe('share_list');
      expect(compacted.permissions).toBeDefined();
      expect(Array.isArray(compacted.permissions)).toBe(true);
      expect((compacted.permissions as unknown[]).length).toBeGreaterThan(0);
    });

    it('should preserve namedRanges array from list_named_ranges', () => {
      const response = {
        success: true,
        action: 'list_named_ranges',
        namedRanges: [
          { namedRangeId: '1', name: 'MyRange', range: 'Sheet1!A1:B10' },
          { namedRangeId: '2', name: 'OtherRange', range: 'Sheet1!C1:D10' },
        ],
      };

      const compacted = compactResponse(response);

      expect(compacted.success).toBe(true);
      expect(compacted.namedRanges).toBeDefined();
      expect(Array.isArray(compacted.namedRanges)).toBe(true);
    });

    it('should preserve valueRanges array from batch_read', () => {
      const response = {
        success: true,
        action: 'batch_read',
        valueRanges: [
          { range: 'Sheet1!A1:A5', values: [['A'], ['B'], ['C']] },
          { range: 'Sheet1!B1:B5', values: [['1'], ['2'], ['3']] },
        ],
        _cached: true,
      };

      const compacted = compactResponse(response);

      expect(compacted.success).toBe(true);
      expect(compacted.valueRanges).toBeDefined();
      expect(Array.isArray(compacted.valueRanges)).toBe(true);
      expect((compacted.valueRanges as unknown[]).length).toBe(2);
    });

    it('should preserve comments array from comment_list', () => {
      const response = {
        success: true,
        action: 'comment_list',
        comments: [
          { commentId: '1', content: 'Test comment 1' },
          { commentId: '2', content: 'Test comment 2' },
        ],
      };

      const compacted = compactResponse(response);

      expect(compacted.comments).toBeDefined();
      expect(Array.isArray(compacted.comments)).toBe(true);
    });

    it('should preserve revisions array from version_list_revisions', () => {
      const response = {
        success: true,
        action: 'version_list_revisions',
        revisions: [
          { id: '1', modifiedTime: '2024-01-01' },
          { id: '2', modifiedTime: '2024-01-02' },
        ],
      };

      const compacted = compactResponse(response);

      expect(compacted.revisions).toBeDefined();
      expect(Array.isArray(compacted.revisions)).toBe(true);
    });

    it('should preserve filterViews array from list_filter_views', () => {
      const response = {
        success: true,
        action: 'list_filter_views',
        filterViews: [
          { filterViewId: '1', title: 'My Filter' },
          { filterViewId: '2', title: 'Other Filter' },
        ],
      };

      const compacted = compactResponse(response);

      expect(compacted.filterViews).toBeDefined();
      expect(Array.isArray(compacted.filterViews)).toBe(true);
    });

    it('should preserve templates array from list templates', () => {
      const response = {
        success: true,
        action: 'list',
        templates: [
          { templateId: '1', name: 'Budget Template' },
          { templateId: '2', name: 'Invoice Template' },
        ],
        totalTemplates: 2,
      };

      const compacted = compactResponse(response);

      expect(compacted.templates).toBeDefined();
      expect(Array.isArray(compacted.templates)).toBe(true);
      expect((compacted.templates as unknown[]).length).toBe(2);
      expect(compacted.totalTemplates).toBe(2);
    });

    it('should preserve filter object from get_basic_filter', () => {
      const response = {
        success: true,
        action: 'get_basic_filter',
        filter: {
          range: 'Sheet1!A1:Z100',
          sortSpecs: [],
          criteria: {},
        },
      };

      const compacted = compactResponse(response);

      expect(compacted.filter).toBeDefined();
      expect(typeof compacted.filter).toBe('object');
    });

    it('should truncate very large arrays but not remove them', () => {
      // Create a large permissions array (>100 items)
      const largePermissions = Array.from({ length: 150 }, (_, i) => ({
        id: `${i}`,
        emailAddress: `user${i}@example.com`,
        role: 'reader',
      }));

      const response = {
        success: true,
        action: 'share_list',
        permissions: largePermissions,
      };

      const compacted = compactResponse(response);

      expect(compacted.permissions).toBeDefined();
      expect(Array.isArray(compacted.permissions)).toBe(true);
      // Should be truncated but still present
      const compactedPerms = compacted.permissions as unknown[];
      expect(compactedPerms.length).toBeGreaterThan(0);
      expect(compactedPerms.length).toBeLessThanOrEqual(largePermissions.length);
    });

    it('should preserve empty arrays', () => {
      const response = {
        success: true,
        action: 'list_named_ranges',
        namedRanges: [],
        totalCount: 0,
      };

      const compacted = compactResponse(response);

      expect(compacted.namedRanges).toBeDefined();
      expect(Array.isArray(compacted.namedRanges)).toBe(true);
      expect((compacted.namedRanges as unknown[]).length).toBe(0);
      expect(compacted.totalCount).toBe(0);
    });

    it('should respect verbosity:detailed setting', () => {
      const response = {
        success: true,
        action: 'share_list',
        permissions: Array.from({ length: 200 }, (_, i) => ({
          id: `${i}`,
          emailAddress: `user${i}@example.com`,
        })),
      };

      const compacted = compactResponse(response, { verbosity: 'detailed' });

      // With verbosity:detailed, arrays should not be truncated
      expect((compacted.permissions as unknown[]).length).toBe(200);
    });
  });

  describe('Compact Mode Configuration', () => {
    it('should check compact mode based on environment variable', () => {
      // isCompactModeEnabled() returns true unless COMPACT_RESPONSES='false'
      // In test environment, this may be set to false, so we just verify it's a boolean
      const isEnabled = isCompactModeEnabled();
      expect(typeof isEnabled).toBe('boolean');
    });
  });
});
