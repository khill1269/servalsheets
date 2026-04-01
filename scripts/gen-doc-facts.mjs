#!/usr/bin/env node

import { relative } from 'path';
import { fileURLToPath } from 'url';
import { loadSourceDocFacts, writeDocFactsFile } from './lib/docs-facts.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const facts = loadSourceDocFacts(ROOT);
const outputPath = writeDocFactsFile(ROOT, facts);

console.log(
  `Generated ${relative(ROOT, outputPath)} (${facts.counts.tools} tools, ${facts.counts.actions} actions, ${facts.counts.prompts} prompts, ${facts.counts.resources} resources, ${facts.counts.resourceTemplates} resource templates)`,
);
