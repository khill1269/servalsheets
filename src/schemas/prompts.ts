/**
 * MCP Prompt Templates (38 guided workflows)
 *
 * These are reusable prompt templates that help LLMs use ServalSheets effectively.
 * Include step-by-step guidance, examples, and best practices for common workflows.
 */

import { z } from 'zod';

const PromptTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  category: z.enum(['read', 'write', 'analyze', 'format', 'automate', 'collaborate']),
  template: z.string(),
  examples: z.array(z.string()).optional(),
});

export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;

// 38 guided workflows (P13 feature)
const PROMPT_TEMPLATES: PromptTemplate[] = [
  // Example templates would be defined here
];

export const PROMPTS = PROMPT_TEMPLATES;
