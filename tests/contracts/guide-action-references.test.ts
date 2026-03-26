import { readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { TOOL_ACTIONS } from '../../src/mcp/completions.js';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DOC_DIRECTORIES = [
  path.join(PROJECT_ROOT, 'docs/deployment'),
  path.join(PROJECT_ROOT, 'docs/development'),
  path.join(PROJECT_ROOT, 'docs/features'),
  path.join(PROJECT_ROOT, 'docs/guides'),
  path.join(PROJECT_ROOT, 'docs/reference'),
  path.join(PROJECT_ROOT, 'docs/testing'),
];
const DIMENSIONS_SCHEMA_PATH = path.join(PROJECT_ROOT, 'src/schemas/dimensions.ts');

function getPropertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return null;
}

function extractDimensionActionAliases(): string[] {
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

      return declaration.initializer.properties
        .filter(ts.isPropertyAssignment)
        .map((property) => getPropertyName(property.name))
        .filter((name): name is string => Boolean(name))
        .map((name) => `sheets_dimensions.${name}`);
    }
  }

  throw new Error('DIMENSION_ACTION_ALIASES declaration not found');
}

function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractDocActionRefs(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf8');
  const matches = content.match(/sheets_[a-z_]+\.[a-z_]*[a-z]{3,}\b/g) ?? [];

  return matches.filter((match) => !match.endsWith('.md'));
}

describe('active doc action references', () => {
  it('only reference runtime actions or documented sheets_dimensions compatibility aliases', () => {
    const allowedRefs = new Set<string>();

    for (const [toolName, actions] of Object.entries(TOOL_ACTIONS)) {
      for (const actionName of actions) {
        allowedRefs.add(`${toolName}.${actionName}`);
      }
    }

    for (const aliasRef of extractDimensionActionAliases()) {
      allowedRefs.add(aliasRef);
    }

    const staleRefs: string[] = [];

    for (const docDir of DOC_DIRECTORIES) {
      for (const filePath of collectMarkdownFiles(docDir)) {
        for (const ref of extractDocActionRefs(filePath)) {
          if (!allowedRefs.has(ref)) {
            staleRefs.push(`${path.relative(PROJECT_ROOT, filePath)}: ${ref}`);
          }
        }
      }
    }

    expect(
      staleRefs,
      `Active docs contain stale tool.action references: ${staleRefs.join(', ')}`
    ).toEqual([]);
  });
});
