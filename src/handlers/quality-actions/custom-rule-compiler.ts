/**
 * Custom validation rule compiler — converts schema-level rule definitions
 * into executable ValidationRule instances for the ValidationEngine.
 */

import { ValidationError } from '../../core/errors.js';
import type {
  CustomValidationRuleInput,
  ValidationRuleInput,
  BuiltinValidationRuleInput,
} from '../../schemas/quality.js';
import type { ValidationContext, ValidationRule } from '../../types/validation.js';

export function isBuiltinRuleInput(rule: ValidationRuleInput): rule is BuiltinValidationRuleInput {
  return typeof rule === 'string';
}

export function isCustomRuleInput(rule: ValidationRuleInput): rule is CustomValidationRuleInput {
  return typeof rule === 'object' && rule !== null;
}

function normalizeComparableValue(value: unknown): string | number | boolean | null | undefined {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return '';
    }
    const numericValue = Number(trimmed);
    return Number.isFinite(numericValue) ? numericValue : trimmed;
  }

  return undefined; // OK: Explicit empty - unsupported comparison values are ignored
}

function buildCustomRuleId(rule: CustomValidationRuleInput, index: number): string {
  return rule.id ?? `custom_${rule.type}_${index + 1}`;
}

function resolveContextLookupValue(
  context: ValidationContext | undefined,
  contextKey: string
): unknown {
  const metadata =
    context?.metadata && typeof context.metadata === 'object'
      ? (context.metadata as Record<string, unknown>)
      : undefined;
  const root = context as Record<string, unknown> | undefined;
  return metadata?.[contextKey] ?? root?.[contextKey];
}

export function buildValidationContext(
  inputContext: Record<string, unknown> | undefined,
  requestedRuleIds?: string[]
): ValidationContext {
  const metadataSource =
    inputContext && typeof inputContext === 'object' && inputContext['metadata']
      ? inputContext['metadata']
      : undefined;
  const metadata =
    metadataSource && typeof metadataSource === 'object'
      ? { ...(metadataSource as Record<string, unknown>), ...(inputContext ?? {}) }
      : inputContext
        ? { ...inputContext }
        : undefined;

  return {
    ...(inputContext ?? {}),
    ...(metadata ? { metadata } : {}),
    ...(requestedRuleIds && requestedRuleIds.length > 0 ? { rules: requestedRuleIds } : {}),
  };
}

export function compileCustomValidationRule(
  rule: CustomValidationRuleInput,
  index: number
): ValidationRule {
  const id = buildCustomRuleId(rule, index);
  const severity = rule.severity ?? 'error';

  switch (rule.type) {
    case 'comparison':
      return {
        id,
        name: rule.name ?? `Comparison ${rule.operator.toUpperCase()}`,
        type: 'business_rule',
        description: `Validate value ${rule.operator} comparison target`,
        validator: (value, context) => {
          const actual = normalizeComparableValue(value);
          const rawTarget =
            'value' in rule.compareTo
              ? rule.compareTo.value
              : resolveContextLookupValue(context, rule.compareTo.contextKey);

          if (!('value' in rule.compareTo) && rawTarget === undefined) {
            return {
              valid: false,
              message:
                rule.message ??
                `Missing comparison target in context: ${rule.compareTo.contextKey}`,
            };
          }

          const target = normalizeComparableValue(rawTarget);
          if (actual === undefined || target === undefined) {
            return {
              valid: false,
              message:
                rule.message ?? 'Comparison rules require string, number, boolean, or null values',
            };
          }

          let valid = false;
          switch (rule.operator) {
            case 'gt':
              valid = typeof actual === 'number' && typeof target === 'number' && actual > target;
              break;
            case 'gte':
              valid = typeof actual === 'number' && typeof target === 'number' && actual >= target;
              break;
            case 'lt':
              valid = typeof actual === 'number' && typeof target === 'number' && actual < target;
              break;
            case 'lte':
              valid = typeof actual === 'number' && typeof target === 'number' && actual <= target;
              break;
            case 'eq':
              valid = actual === target;
              break;
            case 'neq':
              valid = actual !== target;
              break;
          }

          return {
            valid,
            message: valid
              ? undefined
              : (rule.message ?? `Value must satisfy comparison operator ${rule.operator}`),
          };
        },
        severity,
        errorMessage: rule.message ?? `Value must satisfy comparison operator ${rule.operator}`,
        enabled: true,
      };
    case 'pattern': {
      let regex: RegExp;
      try {
        regex = new RegExp(rule.pattern, rule.flags);
      } catch (error) {
        throw new ValidationError(
          `Invalid custom pattern rule: ${error instanceof Error ? error.message : String(error)}`,
          'rules'
        );
      }

      return {
        id,
        name: rule.name ?? 'Pattern Match',
        type: 'pattern',
        description: `Validate value against regex ${rule.pattern}`,
        validator: (value) => ({
          valid: typeof value === 'string' && regex.test(value),
          message: rule.message ?? `Value must match pattern ${rule.pattern}`,
        }),
        severity,
        errorMessage: rule.message ?? `Value must match pattern ${rule.pattern}`,
        enabled: true,
      };
    }
    case 'length':
      return {
        id,
        name: rule.name ?? 'Length Check',
        type: 'custom',
        description: 'Validate string or array length',
        validator: (value) => {
          const length =
            typeof value === 'string' || Array.isArray(value) ? value.length : undefined;
          if (length === undefined) {
            return {
              valid: false,
              message: rule.message ?? 'Length rules require a string or array value',
            };
          }
          const minValid = rule.min === undefined || length >= rule.min;
          const maxValid = rule.max === undefined || length <= rule.max;
          return {
            valid: minValid && maxValid,
            message:
              rule.message ??
              `Value length must be${rule.min !== undefined ? ` >= ${rule.min}` : ''}${
                rule.min !== undefined && rule.max !== undefined ? ' and' : ''
              }${rule.max !== undefined ? ` <= ${rule.max}` : ''}`.trim(),
          };
        },
        severity,
        errorMessage: rule.message ?? 'Value length is outside the allowed range',
        enabled: true,
      };
    case 'one_of':
      return {
        id,
        name: rule.name ?? 'Allowed Values',
        type: 'custom',
        description: 'Validate value against an allowed set',
        validator: (value) => {
          const candidate = normalizeComparableValue(value);
          const normalizedAllowed = rule.values.map((allowed) => normalizeComparableValue(allowed));
          const valid = normalizedAllowed.some((allowed) => {
            if (
              !rule.caseSensitive &&
              typeof candidate === 'string' &&
              typeof allowed === 'string'
            ) {
              return candidate.toLowerCase() === allowed.toLowerCase();
            }
            return candidate === allowed;
          });
          return {
            valid,
            message:
              rule.message ??
              `Value must be one of: ${rule.values.map((value) => String(value)).join(', ')}`,
          };
        },
        severity,
        errorMessage: rule.message ?? 'Value is not in the allowed set',
        enabled: true,
      };
  }
}
