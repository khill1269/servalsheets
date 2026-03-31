/**
 * Zod abstraction layer — single import point for schema validation.
 *
 * All source files should import from here rather than from 'zod' directly.
 * This isolates zod as a single-maintainer risk: upgrades, replacements,
 * or monkey-patching only require changes in this one file.
 *
 * @see docs/audits/DEPENDENCY_HEALTH_AUDIT_2026-03-28.md Phase 3A
 */
export { z } from 'zod';
export type {
  ZodTypeAny,
  ZodSchema,
  ZodType,
  ZodObject,
  ZodString,
  ZodNumber,
  ZodBoolean,
  ZodArray,
  ZodEnum,
  ZodLiteral,
  ZodUnion,
  ZodOptional,
  ZodNullable,
  ZodRecord,
  ZodRawShape,
  infer as ZodInfer,
} from 'zod';
