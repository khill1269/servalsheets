#!/usr/bin/env node

import { getPromptsCatalogCount } from '../src/resources/prompts-catalog.js';
import { createServalSheetsTestHarness } from '../tests/helpers/mcp-test-harness.js';

async function main(): Promise<void> {
  const harness = await createServalSheetsTestHarness();

  try {
    const [resources, resourceTemplates, prompts] = await Promise.all([
      harness.client.listResources(),
      harness.client.listResourceTemplates(),
      harness.client.listPrompts(),
    ]);
    const promptCatalogCount = getPromptsCatalogCount();

    if (prompts.prompts.length !== promptCatalogCount) {
      throw new Error(
        `Prompt catalog drift detected: runtime has ${prompts.prompts.length}, catalog has ${promptCatalogCount}`
      );
    }

    process.stdout.write(
      JSON.stringify({
        prompts: prompts.prompts.length,
        resources: resources.resources.length,
        resourceTemplates: resourceTemplates.resourceTemplates.length,
        promptCatalogCount,
      })
    );
  } finally {
    await harness.close();
  }
}

await main();
