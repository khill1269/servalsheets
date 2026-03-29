import { describe, expect, it } from 'vitest';
import { registerServalSheetsPrompts } from '../../src/mcp/registration/prompt-registration.js';
import {
  getPromptsCatalogCount,
  listPromptCatalogBuckets,
} from '../../src/resources/prompts-catalog.js';

describe('prompts catalog consistency', () => {
  it('advertises the exact runtime prompt set exposed by prompts/list', () => {
    const runtimePromptNames: string[] = [];
    const server = {
      registerPrompt(name: string) {
        runtimePromptNames.push(name);
      },
    };

    registerServalSheetsPrompts(server as never);

    const catalogPromptNames = listPromptCatalogBuckets().flatMap((bucket) =>
      bucket.prompts.map((prompt) => prompt.name)
    );

    expect(new Set(catalogPromptNames)).toEqual(new Set(runtimePromptNames));
    expect(getPromptsCatalogCount()).toBe(runtimePromptNames.length);
  });
});
