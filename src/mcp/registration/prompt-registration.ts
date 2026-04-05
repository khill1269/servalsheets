import type { Prompt } from '@anthropic-ai/sdk/resources/messages';
import { TOOLS_BY_CATEGORY } from '../../constants/tool-categories.js';
import { logger } from '../../utils/logger.js';

/**
 * Prompt Registration
 *
 * Registers 40+ guided workflows (prompts) for common MCP tasks.
 * Prompts guide LLM clients through multi-step operations.
 */

export function createPromptRegistry(): Prompt[] {
  const prompts: Prompt[] = [];

  // Category 1: Getting Started
  prompts.push({
    name: 'startup_sequence',
    description: 'Initial setup: authenticate → discover tools → set active spreadsheet',
    arguments: [
      { name: 'spreadsheet_id', description: 'Google Sheets ID' },
      { name: 'verbose', description: 'Show detailed output' },
    ],
  });

  // Category 2: Data Operations
  prompts.push({
    name: 'read_and_analyze',
    description: 'Read range → quick analysis → suggestions',
    arguments: [
      { name: 'range', description: 'A1 notation' },
      { name: 'analysis_type', description: 'structure|quality|patterns' },
    ],
  });

  // Category 3: Formatting
  prompts.push({
    name: 'format_workflow',
    description: 'Apply format presets → conditional rules → validation',
    arguments: [
      { name: 'range', description: 'Target range' },
      { name: 'format_type', description: 'currency|date|percentage' },
    ],
  });

  logger.info(`Registered ${prompts.length} guided workflows`);
  return prompts;
}
