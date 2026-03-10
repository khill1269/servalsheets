import { describe, expect, it } from 'vitest';
import { getActionGuidance, readSchemaResource } from '../../src/resources/schemas.js';

describe('schema://actions resources', () => {
  it('returns per-tool action guidance payload', () => {
    const text = getActionGuidance('sheets_data');
    expect(text).toBeTruthy();

    const parsed = JSON.parse(text!);
    expect(parsed.$id).toBe('schema://actions/sheets_data');
    expect(parsed.tool).toBe('sheets_data');
    expect(parsed.count).toBeGreaterThan(0);
    expect(parsed.actions.some((item: { action: string }) => item.action === 'read')).toBe(true);
  });

  it('serves actions index and tool guidance through readSchemaResource', async () => {
    const index = await readSchemaResource('schema://actions');
    const indexPayload = JSON.parse(index.contents[0]!.text);
    expect(indexPayload.$id).toBe('schema://actions');
    expect(indexPayload.tools.some((tool: { name: string }) => tool.name === 'sheets_data')).toBe(
      true
    );

    const details = await readSchemaResource('schema://actions/sheets_data');
    const detailPayload = JSON.parse(details.contents[0]!.text);
    expect(detailPayload.$id).toBe('schema://actions/sheets_data');
    expect(detailPayload.count).toBeGreaterThan(0);
  });
});
