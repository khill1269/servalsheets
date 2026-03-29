import { ElicitRequestFormParamsSchema } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';
import {
  multiSelectField,
  type FormElicitParams,
  type PrimitiveSchema,
} from '../../src/mcp/elicitation.js';

describe('elicitation schema compatibility', () => {
  it('accepts spec-compliant multi-select array fields through the official MCP SDK schema', () => {
    const requestedSchema = {
      type: 'object',
      properties: {
        labels: {
          type: 'array',
          title: 'Labels',
          description: 'Choose one or more labels to apply',
          minItems: 1,
          items: {
            type: 'string',
            enum: ['finance', 'operations', 'sales'],
          },
        },
      },
      required: ['labels'],
    } satisfies FormElicitParams['requestedSchema'];

    const parseResult = ElicitRequestFormParamsSchema.safeParse({
      message: 'Select labels',
      requestedSchema,
    });

    expect(parseResult.success).toBe(true);
  });

  it('builds multi-select fields using the local helper without narrowing away MCP-supported arrays', () => {
    const labelsField = multiSelectField({
      title: 'Labels',
      description: 'Choose labels',
      options: [
        { value: 'finance', label: 'Finance' },
        { value: 'ops', label: 'Operations' },
      ],
      minItems: 1,
    }) satisfies PrimitiveSchema;

    const requestedSchema = {
      type: 'object',
      properties: {
        labels: labelsField,
      },
      required: ['labels'],
    } satisfies FormElicitParams['requestedSchema'];

    const parseResult = ElicitRequestFormParamsSchema.safeParse({
      message: 'Select labels',
      requestedSchema,
    });

    expect(parseResult.success).toBe(true);
  });
});
