import { z } from 'zod';

/**
 * Format-related schemas for sheets_format tool
 */

export const FormatTypeSchema = z.enum([
  'text',
  'number',
  'percent',
  'currency',
  'date',
  'time',
  'datetime'
]);

export type FormatType = z.infer<typeof FormatTypeSchema>;