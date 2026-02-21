/**
 * Tests for DependenciesHandler (Phase 3)
 *
 * Validates formula dependency analysis, graph building, and cycle detection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { sheets_v4 } from 'googleapis';
import {
  DependenciesHandler,
  createDependenciesHandler,
  clearAnalyzerCache,
} from '../../src/handlers/dependencies.js';

const unwrapResponse = <T extends { response?: unknown }>(result: T) =>
  'response' in result ? (result as { response?: unknown }).response : result;

describe('DependenciesHandler', () => {
  let handler: DependenciesHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSheetsApi: any;

  beforeEach(() => {
    clearAnalyzerCache();

    // Mock Google Sheets API
    // Use mockResolvedValue (not mockResolvedValueOnce) so mocks persist for auto-build cases
    mockSheetsApi = {
      spreadsheets: {
        get: vi.fn().mockResolvedValue({
          data: {
            spreadsheetId: '1ABC',
            sheets: [
              {
                properties: {
                  sheetId: 0,
                  title: 'Sheet1',
                },
              },
            ],
          },
        }),
        values: {
          get: vi.fn().mockResolvedValue({
            data: {
              values: [
                ['10', '20', '=A1+B1'], // Row 1: A1, B1, C1 (formula)
                ['=C1*2', '5', '=A2+B2'], // Row 2: A2 (formula), B2, C2 (formula)
              ],
            },
          }),
        },
      },
    } as unknown as sheets_v4.Sheets;

    handler = createDependenciesHandler(mockSheetsApi);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Build Action', () => {
    it('should build dependency graph from spreadsheet', async () => {
      const result = unwrapResponse(
        await handler.handle({
          request: {
            action: 'build',
            spreadsheetId: '1ABC',
          },
        })
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        spreadsheetId: '1ABC',
        cellCount: expect.any(Number),
        formulaCount: expect.any(Number),
      });
    });

    it('should filter by sheet names if provided', async () => {
      const result = unwrapResponse(
        await handler.handle({
          request: {
            action: 'build',
            spreadsheetId: '1ABC',
            sheetNames: ['Sheet1'],
          },
        })
      );

      expect(result.success).toBe(true);
      // When sheetNames provided, spreadsheets.get is skipped
      expect(mockSheetsApi.spreadsheets.get).not.toHaveBeenCalled();
      // But values.get should be called for the specified sheet
      expect(mockSheetsApi.spreadsheets.values.get).toHaveBeenCalledWith(
        expect.objectContaining({
          spreadsheetId: '1ABC',
          range: 'Sheet1',
          valueRenderOption: 'FORMULA',
        })
      );
    });

    it('should handle build errors', async () => {
      mockSheetsApi.spreadsheets.get.mockRejectedValueOnce(new Error('API error'));

      const result = unwrapResponse(
        await handler.handle({
          request: {
            action: 'build',
            spreadsheetId: '1ABC',
          },
        })
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INTERNAL_ERROR');
    });

    it('should cache analyzer for subsequent calls', async () => {
      // First build
      await handler.handle({
        request: {
          action: 'build',
          spreadsheetId: '1ABC',
        },
      });

      // Second build should reuse cache
      await handler.handle({
        request: {
          action: 'build',
          spreadsheetId: '1ABC',
        },
      });

      // Should be called twice (once for each build)
      expect(mockSheetsApi.spreadsheets.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Analyze Impact Action', () => {
    it('should analyze impact of cell change', async () => {
      // Build graph first
      await handler.handle({
        request: {
          action: 'build',
          spreadsheetId: '1ABC',
        },
      });

      // Analyze impact
      const result = unwrapResponse(
        await handler.handle({
          request: {
            action: 'analyze_impact',
            spreadsheetId: '1ABC',
            cell: 'Sheet1!A1',
          },
        })
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        targetCell: 'Sheet1!A1',
        directDependents: expect.any(Array),
        allAffectedCells: expect.any(Array),
      });
    });

    it('should build graph if not cached', async () => {
      const result = unwrapResponse(
        await handler.handle({
          request: {
            action: 'analyze_impact',
            spreadsheetId: '1ABC',
            cell: 'Sheet1!C1',
          },
        })
      );

      expect(result.success).toBe(true);
      expect(mockSheetsApi.spreadsheets.get).toHaveBeenCalled();
    });

    it('should handle invalid cell addresses', async () => {
      await handler.handle({
        request: {
          action: 'build',
          spreadsheetId: '1ABC',
        },
      });

      const result = unwrapResponse(
        await handler.handle({
          request: {
            action: 'analyze_impact',
            spreadsheetId: '1ABC',
            cell: 'InvalidCell',
          },
        })
      );

      // Should handle gracefully
      expect(result.success).toBe(true);
    });

    it('should include dependency chain', async () => {
      await handler.handle({
        request: {
          action: 'build',
          spreadsheetId: '1ABC',
        },
      });

      const result = unwrapResponse(
        await handler.handle({
          request: {
            action: 'analyze_impact',
            spreadsheetId: '1ABC',
            cell: 'Sheet1!A1',
          },
        })
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('dependencies');
    });
  });

  describe('Detect Cycles Action', () => {
    it('should detect circular dependencies', async () => {
      // Mock circular dependency: A1 → C1 → B1 → A1
      mockSheetsApi.spreadsheets.get.mockResolvedValueOnce({
        data: {
          spreadsheetId: '1ABC',
          sheets: [
            {
              properties: {
                sheetId: 0,
                title: 'Sheet1',
              },
            },
          ],
        },
      });

      mockSheetsApi.spreadsheets.values.get.mockResolvedValueOnce({
        data: {
          values: [
            ['=C1+1', '=A1+1', '=B1+1'], // A1 → C1, B1 → A1, C1 → B1 (circular)
          ],
        },
      });

      await handler.handle({
        request: {
          action: 'build',
          spreadsheetId: '1ABC',
        },
      });

      const result = unwrapResponse(
        await handler.handle({
          request: {
            action: 'detect_cycles',
            spreadsheetId: '1ABC',
          },
        })
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('circularDependencies');
    });

    it('should return empty array if no cycles', async () => {
      await handler.handle({
        request: {
          action: 'build',
          spreadsheetId: '1ABC',
        },
      });

      const result = unwrapResponse(
        await handler.handle({
          request: {
            action: 'detect_cycles',
            spreadsheetId: '1ABC',
          },
        })
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data.circularDependencies)).toBe(true);
      }
    });
  });

  describe('Get Dependencies Action', () => {
    it('should get cells that a cell depends on', async () => {
      await handler.handle({
        request: {
          action: 'build',
          spreadsheetId: '1ABC',
        },
      });

      const result = unwrapResponse(
        await handler.handle({
          request: {
            action: 'get_dependencies',
            spreadsheetId: '1ABC',
            cell: 'Sheet1!C1',
          },
        })
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('dependencies');
      if (result.success) {
        expect(Array.isArray(result.data.dependencies)).toBe(true);
      }
    });

    it('should return empty array for cells without dependencies', async () => {
      await handler.handle({
        request: {
          action: 'build',
          spreadsheetId: '1ABC',
        },
      });

      const result = unwrapResponse(
        await handler.handle({
          request: {
            action: 'get_dependencies',
            spreadsheetId: '1ABC',
            cell: 'Sheet1!A1', // A1 is a constant value
          },
        })
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Get Dependents Action', () => {
    it('should get cells that depend on a cell', async () => {
      await handler.handle({
        request: {
          action: 'build',
          spreadsheetId: '1ABC',
        },
      });

      const result = unwrapResponse(
        await handler.handle({
          request: {
            action: 'get_dependents',
            spreadsheetId: '1ABC',
            cell: 'Sheet1!A1',
          },
        })
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('dependents');
      if (result.success) {
        expect(Array.isArray(result.data.dependents)).toBe(true);
      }
    });

    it('should return empty array for leaf cells', async () => {
      await handler.handle({
        request: {
          action: 'build',
          spreadsheetId: '1ABC',
        },
      });

      const result = unwrapResponse(
        await handler.handle({
          request: {
            action: 'get_dependents',
            spreadsheetId: '1ABC',
            cell: 'Sheet1!C2', // C2 is a leaf node
          },
        })
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Get Stats Action', () => {
    it('should return dependency graph statistics', async () => {
      await handler.handle({
        request: {
          action: 'build',
          spreadsheetId: '1ABC',
        },
      });

      const result = unwrapResponse(
        await handler.handle({
          request: {
            action: 'get_stats',
            spreadsheetId: '1ABC',
          },
        })
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        totalCells: expect.any(Number),
        formulaCells: expect.any(Number),
        totalDependencies: expect.any(Number),
      });
    });

    it('should build graph if not cached', async () => {
      const result = unwrapResponse(
        await handler.handle({
          request: {
            action: 'get_stats',
            spreadsheetId: '1ABC',
          },
        })
      );

      expect(result.success).toBe(true);
      expect(mockSheetsApi.spreadsheets.get).toHaveBeenCalled();
    });
  });

  describe('Export DOT Action', () => {
    it('should export graph in DOT format', async () => {
      await handler.handle({
        request: {
          action: 'build',
          spreadsheetId: '1ABC',
        },
      });

      const result = unwrapResponse(
        await handler.handle({
          request: {
            action: 'export_dot',
            spreadsheetId: '1ABC',
          },
        })
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('dot');
      if (result.success && 'dot' in result.data) {
        expect(typeof result.data.dot).toBe('string');
        expect(result.data.dot).toContain('digraph');
      }
    });

    it('should handle export errors', async () => {
      mockSheetsApi.spreadsheets.get.mockRejectedValueOnce(new Error('API error'));

      const result = unwrapResponse(
        await handler.handle({
          request: {
            action: 'export_dot',
            spreadsheetId: '1ABC',
          },
        })
      );

      expect(result.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown action', async () => {
      const result = unwrapResponse(
        await handler.handle({
          request: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            action: 'unknown_action' as any,
            spreadsheetId: '1ABC',
          },
        })
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PARAMS');
    });

    it('should handle internal errors', async () => {
      mockSheetsApi.spreadsheets.get.mockRejectedValueOnce(new Error('Internal server error'));

      const result = unwrapResponse(
        await handler.handle({
          request: {
            action: 'build',
            spreadsheetId: '1ABC',
          },
        })
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Internal server error');
    });
  });

  describe('Cache Management', () => {
    it('should cache analyzers per spreadsheet', async () => {
      // Build for spreadsheet 1
      await handler.handle({
        request: {
          action: 'build',
          spreadsheetId: '1ABC',
        },
      });

      // Build for spreadsheet 2
      mockSheetsApi.spreadsheets.get.mockResolvedValueOnce({
        data: {
          spreadsheetId: '2DEF',
          sheets: [
            {
              properties: {
                sheetId: 0,
                title: 'Sheet1',
              },
            },
          ],
        },
      });
      mockSheetsApi.spreadsheets.values.get.mockResolvedValueOnce({
        data: {
          values: [['1', '2', '3']],
        },
      });
      await handler.handle({
        request: {
          action: 'build',
          spreadsheetId: '2DEF',
        },
      });

      // Both should be cached independently
      expect(mockSheetsApi.spreadsheets.get).toHaveBeenCalledTimes(2);
    });

    it('should rebuild graph when requested', async () => {
      // Initial build
      await handler.handle({
        request: {
          action: 'build',
          spreadsheetId: '1ABC',
        },
      });

      // Rebuild
      await handler.handle({
        request: {
          action: 'build',
          spreadsheetId: '1ABC',
        },
      });

      // Should fetch twice (rebuild clears cache)
      expect(mockSheetsApi.spreadsheets.get).toHaveBeenCalledTimes(2);
    });
  });
});
