/**
 * Handler-Schema Alignment Deviations
 *
 * This file documents intentional deviations where handler behavior differs from schema definition.
 * These are justified and tracked rather than "fixed" to preserve intentional design decisions.
 *
 * Format:
 * {
 *   tool: "tool_name",
 *   action: "action_name",
 *   deviation: "description of how handler differs",
 *   reason: "why this deviation is intentional",
 *   file: "src/handlers/...",
 *   line: number
 * }
 */

import { z } from 'zod';

const HandlerDeviationSchema = z.object({
  tool: z.string(),
  action: z.string(),
  deviation: z.string(),
  reason: z.string(),
  file: z.string(),
  line: z.number().int().positive(),
});

// Documented deviations (intentional schema-handler misalignments)
const DOCUMENTED_DEVIATIONS: z.infer<typeof HandlerDeviationSchema>[] = [
  // Example: if a handler intentionally doesn't use a schema field, document it here
];

export const HANDLER_DEVIATIONS = DOCUMENTED_DEVIATIONS;
export type HandlerDeviation = z.infer<typeof HandlerDeviationSchema>;
