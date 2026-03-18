import { describe, expect, it, vi } from 'vitest';
import { handleQueryNaturalLanguageAction } from '../../src/handlers/analyze-actions/query-natural-language.js';

describe('query_natural_language action', () => {
  it('honors an explicit range and uses header rows for schema inference', async () => {
    const sheetsApi = {
      spreadsheets: {
        get: vi.fn().mockResolvedValue({
          data: {
            spreadsheetId: 'sheet-123',
            properties: { title: 'Quarterly Metrics' },
            sheets: [
              {
                properties: {
                  sheetId: 1,
                  title: 'Summary',
                  index: 0,
                  gridProperties: { rowCount: 100, columnCount: 10 },
                },
              },
              {
                properties: {
                  sheetId: 2,
                  title: 'Revenue',
                  index: 1,
                  gridProperties: { rowCount: 50, columnCount: 2 },
                },
              },
            ],
          },
        }),
        values: {
          get: vi.fn().mockResolvedValue({
            data: {
              values: [
                ['Revenue', 'Cost'],
                [100, 40],
                [200, 80],
              ],
            },
          }),
        },
      },
    } as any;

    const result = await handleQueryNaturalLanguageAction(
      {
        spreadsheetId: 'sheet-123',
        query: 'What is the total Revenue?',
        range: 'Revenue!A1:B3',
      },
      {
        checkSamplingCapability: vi.fn().mockResolvedValue(null),
        server: {
          createMessage: vi.fn().mockResolvedValue({
            content: {
              type: 'text',
              text: JSON.stringify({
                answer: 'Total revenue is 300.',
                followUpQuestions: [],
              }),
            },
          }),
        } as any,
        sheetsApi,
      }
    );

    expect(result.success).toBe(true);
    expect(sheetsApi.spreadsheets.values.get).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-123',
      range: 'Revenue!A1:B3',
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    if (result.success) {
      expect(result.queryResult?.intent.type).toBe('AGGREGATE');
      expect(result.queryResult?.answer).toContain('300');
    }
  });
});
