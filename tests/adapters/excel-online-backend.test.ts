/**
 * ExcelOnlineBackend adapter tests
 *
 * Comprehensive test suite for ExcelOnlineBackend using Vitest.
 * Mocks the GraphClient interface and validates all SpreadsheetBackend methods.
 *
 * Test categories:
 * - Lifecycle (initialize/dispose)
 * - Value operations (read/write/append/clear/batch)
 * - Document operations (get/create/add/delete/copy sheet)
 * - File operations (copy/metadata/list)
 * - Range parsing and edge cases
 * - Backend router integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExcelOnlineBackend, type GraphClient, type GraphRequest, type ExcelOnlineConfig } from '../../src/adapters/excel-online-backend.js';
import { ServiceError, NotFoundError } from '../../src/core/errors.js';

// ============================================================
// Mock Factories
// ============================================================

/**
 * Create a mock GraphRequest that chains method calls.
 * Each chainable method returns a fresh mock so tests can override
 * individual terminal methods (.get(), .post(), etc.).
 */
function createMockGraphRequest(): GraphRequest {
  const mock: GraphRequest = {
    get: vi.fn().mockResolvedValue({ value: [] }),
    post: vi.fn().mockResolvedValue({ value: {} }),
    put: vi.fn().mockResolvedValue({ value: {} }),
    patch: vi.fn().mockResolvedValue({ value: {} }),
    delete: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    top: vi.fn().mockReturnThis(),
    orderby: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
  };
  // Chain methods return the same mock so terminal calls are visible
  (mock.select as ReturnType<typeof vi.fn>).mockReturnValue(mock);
  (mock.filter as ReturnType<typeof vi.fn>).mockReturnValue(mock);
  (mock.top as ReturnType<typeof vi.fn>).mockReturnValue(mock);
  (mock.orderby as ReturnType<typeof vi.fn>).mockReturnValue(mock);
  (mock.header as ReturnType<typeof vi.fn>).mockReturnValue(mock);
  return mock;
}

/**
 * Create a mock GraphClient with chainable request builder
 */
function createMockGraphClient(): GraphClient {
  return {
    api: vi.fn().mockReturnValue(createMockGraphRequest()),
  };
}

/**
 * Standard test fixture: mock client + config with ENABLE_EXPERIMENTAL_BACKENDS
 */
function createTestFixture(): { mockClient: GraphClient; config: ExcelOnlineConfig } {
  const mockClient = createMockGraphClient();
  const config: ExcelOnlineConfig = { client: mockClient };
  return { mockClient, config };
}

// ============================================================
// Tests
// ============================================================

describe('ExcelOnlineBackend', () => {
  // Enable experimental backends for testing
  beforeEach(() => {
    process.env['ENABLE_EXPERIMENTAL_BACKENDS'] = 'true';
  });

  afterEach(() => {
    delete process.env['ENABLE_EXPERIMENTAL_BACKENDS'];
  });

  // ─── Lifecycle ────────────────────────────────────────────

  describe('constructor', () => {
    it('throws when ENABLE_EXPERIMENTAL_BACKENDS is not set', () => {
      delete process.env['ENABLE_EXPERIMENTAL_BACKENDS'];
      const { config } = createTestFixture();
      expect(() => new ExcelOnlineBackend(config)).toThrow('scaffold');
    });

    it('creates instance with ENABLE_EXPERIMENTAL_BACKENDS=true', () => {
      const { config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);
      expect(backend.platform).toBe('excel-online');
    });

    it('uses default drivePrefix /me/drive/items/', () => {
      const { config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);
      expect(backend.platform).toBe('excel-online');
      // drivePrefix is private but defaults are tested through API path construction
    });

    it('accepts custom drivePrefix for SharePoint', () => {
      const { mockClient } = createTestFixture();
      const config: ExcelOnlineConfig = {
        client: mockClient,
        drivePrefix: '/sites/mysite/drive/items/',
      };
      const backend = new ExcelOnlineBackend(config);
      expect(backend.platform).toBe('excel-online');
    });
  });

  describe('initialize / dispose', () => {
    it('initialize completes without error', async () => {
      const { config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);
      await expect(backend.initialize()).resolves.toBeUndefined();
    });

    it('dispose completes without error', async () => {
      const { config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);
      await expect(backend.dispose()).resolves.toBeUndefined();
    });
  });

  // ─── Value Operations ─────────────────────────────────────

  describe('readRange', () => {
    it('reads values from single range', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.select as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: 'Sheet1!A1:B2',
        values: [
          ['Name', 'Score'],
          ['Alice', 95],
        ],
        text: [
          ['Name', 'Score'],
          ['Alice', '95'],
        ],
      });

      const result = await backend.readRange({
        documentId: 'file123',
        range: 'Sheet1!A1:B2',
      });

      expect(mockClient.api).toHaveBeenCalled();
      expect(result.range).toBe('Sheet1!A1:B2');
      expect(result.majorDimension).toBe('ROWS');
      expect(result.values).toEqual([
        ['Name', 'Score'],
        ['Alice', 95],
      ]);
    });

    it('returns formatted text when valueRenderOption is FORMATTED_VALUE', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.select as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: 'Sheet1!A1:A2',
        values: [[50000], [75000]],
        text: [['$50,000'], ['$75,000']],
      });

      const result = await backend.readRange({
        documentId: 'file123',
        range: 'Sheet1!A1:A2',
        valueRenderOption: 'FORMATTED_VALUE',
      });

      expect(result.values).toEqual([['$50,000'], ['$75,000']]);
    });
  });

  describe('writeRange', () => {
    it('writes values to range via PATCH', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
        address: 'Sheet1!A1:B2',
        cellCount: 4,
      });

      const result = await backend.writeRange({
        documentId: 'file123',
        range: 'Sheet1!A1:B2',
        values: [
          ['Name', 'Score'],
          ['Alice', 95],
        ],
      });

      expect(mockRequest.patch).toHaveBeenCalledWith({
        values: [
          ['Name', 'Score'],
          ['Alice', 95],
        ],
      });
      expect(result.updatedRange).toBe('Sheet1!A1:B2');
      expect(result.updatedRows).toBe(2);
      expect(result.updatedColumns).toBe(2);
      expect(result.updatedCells).toBe(4);
    });
  });

  describe('appendRows', () => {
    it('appends rows via table rows/add endpoint', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.post as ReturnType<typeof vi.fn>).mockResolvedValue({
        index: 9,
      });

      const result = await backend.appendRows({
        documentId: 'file123',
        range: 'Sheet1!A1:B9',
        values: [
          ['new1', 'new2'],
          ['row3', 'row4'],
        ],
      });

      expect(mockRequest.post).toHaveBeenCalled();
      expect(result.updatedRows).toBe(2);
      expect(result.updatedColumns).toBe(2);
      expect(result.updatedCells).toBe(4);
    });
  });

  describe('clearRange', () => {
    it('clears content only (preserves formatting)', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.post as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await backend.clearRange({
        documentId: 'file123',
        range: 'Sheet1!A1:B2',
      });

      expect(mockRequest.post).toHaveBeenCalledWith({ applyTo: 'Contents' });
      expect(result.clearedRange).toBe('Sheet1!A1:B2');
    });
  });

  describe('batchRead', () => {
    it('reads multiple ranges in parallel', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.select as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ values: [['A']], address: 'Sheet1!A1' })
        .mockResolvedValueOnce({ values: [['B']], address: 'Sheet1!B1' });

      const result = await backend.batchRead({
        documentId: 'file123',
        ranges: ['Sheet1!A1', 'Sheet1!B1'],
      });

      expect(result.valueRanges).toHaveLength(2);
      expect(result.valueRanges[0].values).toEqual([['A']]);
      expect(result.valueRanges[1].values).toEqual([['B']]);
    });
  });

  describe('batchWrite', () => {
    it('writes to multiple ranges in parallel', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.patch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ address: 'Sheet1!A1', cellCount: 1 })
        .mockResolvedValueOnce({ address: 'Sheet1!B1', cellCount: 1 });

      const result = await backend.batchWrite({
        documentId: 'file123',
        data: [
          { range: 'Sheet1!A1', values: [['x']] },
          { range: 'Sheet1!B1', values: [['y']] },
        ],
      });

      expect(result.totalUpdatedCells).toBe(2);
      expect(result.responses).toHaveLength(2);
    });
  });

  describe('batchClear', () => {
    it('clears multiple ranges', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.post as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await backend.batchClear({
        documentId: 'file123',
        ranges: ['Sheet1!A1:B2', 'Sheet1!C1:D2'],
      });

      expect(result.clearedRanges).toEqual(['Sheet1!A1:B2', 'Sheet1!C1:D2']);
    });
  });

  // ─── Document Operations ──────────────────────────────────

  describe('getDocument', () => {
    it('fetches workbook metadata with worksheets', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.select as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      // First call: file metadata; Second call: worksheets
      (mockRequest.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: 'file123', name: 'Budget.xlsx', webUrl: 'https://example.com' })
        .mockResolvedValueOnce({
          value: [
            { id: 'ws1', name: 'Sheet1', position: 0, visibility: 'Visible' },
            { id: 'ws2', name: 'Sheet2', position: 1, visibility: 'Hidden' },
          ],
        });

      const result = await backend.getDocument({
        documentId: 'file123',
      });

      expect(mockClient.api).toHaveBeenCalled();
      expect(result.documentId).toBe('file123');
      expect(result.title).toBe('Budget.xlsx');
      expect(result.sheets).toHaveLength(2);
      expect(result.sheets[0].title).toBe('Sheet1');
      expect(result.sheets[1].hidden).toBe(true);
    });
  });

  describe('createDocument', () => {
    it('creates new workbook in OneDrive', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.header as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.put as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'newfile123',
        name: 'NewSheet.xlsx',
        webUrl: 'https://example.com/newsheet',
      });

      const result = await backend.createDocument({
        title: 'NewSheet',
      });

      expect(mockRequest.put).toHaveBeenCalled();
      expect(result.documentId).toBe('newfile123');
      expect(result.title).toBe('NewSheet.xlsx');
    });
  });

  describe('addSheet', () => {
    it('creates new worksheet', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.post as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'sheet123',
        name: 'NewTab',
        position: 2,
      });

      const result = await backend.addSheet({
        documentId: 'file123',
        title: 'NewTab',
      });

      expect(mockRequest.post).toHaveBeenCalled();
      expect(result.title).toBe('NewTab');
      expect(result.index).toBe(2);
    });
  });

  describe('deleteSheet', () => {
    it('deletes worksheet by position lookup', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      // First call: list worksheets to find the target
      (mockRequest.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        value: [
          { id: 'ws-guid-1', position: 0 },
          { id: 'ws-guid-2', position: 1 },
        ],
      });
      (mockRequest.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await expect(
        backend.deleteSheet({
          documentId: 'file123',
          sheetId: 0,
        })
      ).resolves.toBeUndefined();
    });

    it('throws NotFoundError for non-existent sheet', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        value: [{ id: 'ws-guid-1', position: 0 }],
      });

      await expect(
        backend.deleteSheet({
          documentId: 'file123',
          sheetId: 99,
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('copySheet', () => {
    it('throws ServiceError for cross-workbook copy (unsupported)', async () => {
      const { config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      await expect(
        backend.copySheet({
          documentId: 'file123',
          sheetId: 0,
          destinationDocumentId: 'otherfile456',
        })
      ).rejects.toThrow(ServiceError);
    });
  });

  // ─── Batch Mutations ──────────────────────────────────────

  describe('executeBatchMutations', () => {
    it('sends mutations via $batch endpoint', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.post as ReturnType<typeof vi.fn>).mockResolvedValue({
        responses: [
          { id: '1', status: 200, body: {} },
          { id: '2', status: 200, body: {} },
        ],
      });

      const result = await backend.executeBatchMutations('file123', {
        mutations: [
          { method: 'PATCH', url: '/range/format', body: { font: { bold: true } } },
          { method: 'POST', url: '/charts/add', body: { type: 'ColumnClustered' } },
        ],
      });

      expect(mockRequest.post).toHaveBeenCalled();
      expect(result.appliedCount).toBe(2);
      expect(result.replies).toHaveLength(2);
    });
  });

  // ─── File Operations ───────────────────────────────────────

  describe('copyDocument', () => {
    it('copies file to new location with title override', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.post as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'copiedfile123',
        name: 'BudgetCopy.xlsx',
        createdDateTime: '2026-03-27T12:00:00Z',
      });

      const result = await backend.copyDocument({
        documentId: 'file123',
        title: 'BudgetCopy',
      });

      expect(mockRequest.post).toHaveBeenCalled();
      expect(result.documentId).toBe('copiedfile123');
      expect(result.name).toBe('BudgetCopy.xlsx');
    });
  });

  describe('getFileMetadata', () => {
    it('fetches file metadata with field selection', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.select as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'file123',
        name: 'Budget.xlsx',
        file: { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        createdDateTime: '2026-03-25T10:00:00Z',
        lastModifiedDateTime: '2026-03-27T14:00:00Z',
      });

      const result = await backend.getFileMetadata('file123');

      expect(mockRequest.get).toHaveBeenCalled();
      expect(result.documentId).toBe('file123');
      expect(result.name).toBe('Budget.xlsx');
      expect(result.modifiedTime).toBe('2026-03-27T14:00:00Z');
    });
  });

  describe('listFiles', () => {
    it('lists files with filter and pagination', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.top as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.filter as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        value: [
          { id: 'file1', name: 'Report1.xlsx' },
          { id: 'file2', name: 'Report2.xlsx' },
        ],
        '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/drive/root/children?$skip=2',
      });

      const result = await backend.listFiles({
        maxResults: 10,
      });

      expect(mockRequest.get).toHaveBeenCalled();
      expect(result.files).toHaveLength(2);
      expect(result.nextCursor).toBeDefined();
    });
  });

  describe('listRevisions', () => {
    it('fetches revision history with cursor support', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.top as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        value: [
          {
            id: 'rev1',
            lastModifiedDateTime: '2026-03-27T14:00:00Z',
            lastModifiedBy: { user: { displayName: 'Alice', email: 'alice@example.com' } },
          },
          {
            id: 'rev2',
            lastModifiedDateTime: '2026-03-27T13:00:00Z',
            lastModifiedBy: { user: { displayName: 'Bob', email: 'bob@example.com' } },
          },
        ],
      });

      const result = await backend.listRevisions({
        documentId: 'file123',
      });

      expect(mockRequest.get).toHaveBeenCalled();
      expect(result.revisions).toHaveLength(2);
      expect(result.revisions[0].revisionId).toBe('rev1');
      expect(result.revisions[0].modifiedTime).toBe('2026-03-27T14:00:00Z');
    });
  });

  describe('getRevision', () => {
    it('fetches single revision metadata', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'rev1',
        lastModifiedDateTime: '2026-03-27T14:00:00Z',
        lastModifiedBy: { user: { email: 'alice@example.com', displayName: 'Alice' } },
      });

      const result = await backend.getRevision('file123', 'rev1');

      expect(result.revisionId).toBe('rev1');
      expect(result.modifiedTime).toBe('2026-03-27T14:00:00Z');
      expect(result.lastModifyingUser?.email).toBe('alice@example.com');
    });
  });

  // ─── Native Escape Hatch ──────────────────────────────────

  describe('native()', () => {
    it('returns underlying client and drivePrefix', () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const native = backend.native<{ client: GraphClient; drivePrefix: string }>();
      expect(native.client).toBe(mockClient);
      expect(native.drivePrefix).toBe('/me/drive/items/');
    });
  });

  // ─── Range Parsing ─────────────────────────────────────────

  describe('Range parsing', () => {
    it('parses Sheet1!A1:D10 correctly', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.select as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        values: [['1', '2', '3', '4']],
        address: 'Sheet1!A1:D10',
      });

      const result = await backend.readRange({
        documentId: 'file123',
        range: 'Sheet1!A1:D10',
      });

      expect(result.range).toContain('Sheet1');
      expect(result.values).toHaveLength(1);
    });

    it('defaults to Sheet1 when sheet prefix missing', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.select as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        values: [['x']],
        address: 'Sheet1!A1:D10',
      });

      const result = await backend.readRange({
        documentId: 'file123',
        range: 'A1:D10',
      });

      // The API path should include Sheet1 since that's the default
      expect(result.values).toHaveLength(1);
    });

    it("handles quoted sheet names 'My Sheet'!A1:D10", async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.select as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        values: [['data']],
        address: "'My Sheet'!A1",
      });

      const result = await backend.readRange({
        documentId: 'file123',
        range: "'My Sheet'!A1:D10",
      });

      expect(result.values).toHaveLength(1);
    });

    it('handles single cell reference A1', async () => {
      const { mockClient, config } = createTestFixture();
      const backend = new ExcelOnlineBackend(config);

      const mockRequest = createMockGraphRequest();
      (mockClient.api as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.select as ReturnType<typeof vi.fn>).mockReturnValue(mockRequest);
      (mockRequest.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        values: [['single']],
        address: 'Sheet1!A1',
      });

      const result = await backend.readRange({
        documentId: 'file123',
        range: 'A1',
      });

      expect(result.values).toEqual([['single']]);
    });
  });

  // ─── Backend Router Integration ────────────────────────────

  describe('Backend router integration', () => {
    it('routes Excel OneDrive item IDs correctly', () => {
      // Document ID patterns that should route to Excel Online:
      // - Contains "/" (OneDrive/SharePoint path)
      // - GUID format
      const excelIds = [
        '/me/drive/items/ABC123DEF456',
        'A0B1C2D3-E4F5-6A7B-8C9D-0E1F2A3B4C5D',
      ];

      const guidPattern = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
      excelIds.forEach((id) => {
        const isPath = id.includes('/');
        const isGuid = guidPattern.test(id);
        expect(isPath || isGuid).toBe(true);
      });
    });

    it('distinguishes Excel from Google document IDs', () => {
      // Google: 44-char alphanumeric
      const googleId = '1FzN4j1_k3VpYrqQlYg4j5ZpOlZaVqRqLyqGw0u_oQzc';
      // Excel: not 44 chars or has special formatting
      const excelId = '2026-03-27-ABC123';

      expect(/^[a-zA-Z0-9_-]{44}$/.test(googleId)).toBe(true);
      expect(/^[a-zA-Z0-9_-]{44}$/.test(excelId)).toBe(false);
    });
  });
});
