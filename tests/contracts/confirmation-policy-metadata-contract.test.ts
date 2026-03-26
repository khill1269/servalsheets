import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { ACTION_METADATA } from '../../src/schemas/action-metadata.js';
import {
  DESTRUCTIVE_OPERATIONS,
  READONLY_OPERATIONS,
} from '../../src/services/confirmation-policy.js';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DIMENSIONS_SCHEMA_PATH = path.join(PROJECT_ROOT, 'src/schemas/dimensions.ts');

function getPropertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return null;
}

function extractDimensionAliasMap(): Record<string, string> {
  const content = readFileSync(DIMENSIONS_SCHEMA_PATH, 'utf8');
  const sourceFile = ts.createSourceFile(
    DIMENSIONS_SCHEMA_PATH,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        declaration.name.text !== 'DIMENSION_ACTION_ALIASES'
      ) {
        continue;
      }

      if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) {
        throw new Error('DIMENSION_ACTION_ALIASES is not an object literal');
      }

      const aliases: Record<string, string> = {};

      for (const property of declaration.initializer.properties) {
        if (
          !ts.isPropertyAssignment(property) ||
          !ts.isObjectLiteralExpression(property.initializer)
        ) {
          continue;
        }

        const aliasName = getPropertyName(property.name);
        if (!aliasName) {
          continue;
        }

        const actionProperty = property.initializer.properties.find(
          (entry): entry is ts.PropertyAssignment =>
            ts.isPropertyAssignment(entry) && getPropertyName(entry.name) === 'action'
        );
        if (!actionProperty || !ts.isStringLiteral(actionProperty.initializer)) {
          continue;
        }

        aliases[aliasName] = actionProperty.initializer.text;
      }

      return aliases;
    }
  }

  throw new Error('DIMENSION_ACTION_ALIASES declaration not found');
}

const dimensionAliases = extractDimensionAliasMap();

function resolveAction(tool: string, action: string): { tool: string; action: string } {
  if (tool === 'sheets_dimensions' && dimensionAliases[action]) {
    return { tool, action: dimensionAliases[action] };
  }

  return { tool, action };
}

describe('confirmation-policy and metadata contracts', () => {
  it('marks confirmation-policy destructive operations as destructive metadata', () => {
    const mismatches: string[] = [];

    for (const operation of DESTRUCTIVE_OPERATIONS) {
      const [tool, action] = operation.split(':');
      if (!tool || !action) {
        continue;
      }

      const resolved = resolveAction(tool, action);
      const metadata = ACTION_METADATA[resolved.tool]?.[resolved.action];
      if (!metadata || !metadata.destructive || !metadata.requiresConfirmation) {
        mismatches.push(`${tool}:${action}`);
      }
    }

    expect(
      mismatches,
      `Destructive confirmation-policy operations missing destructive confirmation metadata: ${mismatches.join(', ')}`
    ).toEqual([]);
  });

  it('marks read-only confirmation-policy operations as readOnly metadata, excluding contextual find_replace', () => {
    const mismatches: string[] = [];

    for (const operation of READONLY_OPERATIONS) {
      if (operation === 'sheets_data:find_replace') {
        continue;
      }

      const [tool, action] = operation.split(':');
      if (!tool || !action) {
        continue;
      }

      const resolved = resolveAction(tool, action);
      const metadata = ACTION_METADATA[resolved.tool]?.[resolved.action];
      if (!metadata || !metadata.readOnly) {
        mismatches.push(`${tool}:${action}`);
      }
    }

    expect(
      mismatches,
      `Read-only confirmation-policy operations missing readOnly metadata: ${mismatches.join(', ')}`
    ).toEqual([]);
  });
});
