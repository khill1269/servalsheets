import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { TOOL_ACTIONS } from '../../src/mcp/completions.js';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const ACTION_METADATA_PATH = path.join(PROJECT_ROOT, 'src/schemas/action-metadata.ts');

function getPropertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return null;
}

function extractRawActionMetadataKeys(): Record<string, string[]> {
  const content = readFileSync(ACTION_METADATA_PATH, 'utf8');
  const sourceFile = ts.createSourceFile(
    ACTION_METADATA_PATH,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'RAW_ACTION_METADATA') {
        continue;
      }

      if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) {
        throw new Error('RAW_ACTION_METADATA is not an object literal');
      }

      const metadata: Record<string, string[]> = {};

      for (const toolProperty of declaration.initializer.properties) {
        if (!ts.isPropertyAssignment(toolProperty)) {
          continue;
        }

        const toolName = getPropertyName(toolProperty.name);
        if (!toolName || !ts.isObjectLiteralExpression(toolProperty.initializer)) {
          continue;
        }

        metadata[toolName] = [];

        for (const actionProperty of toolProperty.initializer.properties) {
          if (!ts.isPropertyAssignment(actionProperty)) {
            continue;
          }

          const actionName = getPropertyName(actionProperty.name);
          if (actionName) {
            metadata[toolName].push(actionName);
          }
        }
      }

      return metadata;
    }
  }

  throw new Error('RAW_ACTION_METADATA declaration not found');
}

describe('raw action metadata contracts', () => {
  it('only contains canonical runtime tool names', () => {
    const rawMetadata = extractRawActionMetadataKeys();
    const staleTools = Object.keys(rawMetadata).filter((toolName) => !(toolName in TOOL_ACTIONS));

    expect(staleTools, `Unexpected raw action metadata tools: ${staleTools.join(', ')}`).toEqual([]);
  });

  it('only contains canonical runtime action names for each tool', () => {
    const rawMetadata = extractRawActionMetadataKeys();
    const staleActions: string[] = [];

    for (const [toolName, actions] of Object.entries(rawMetadata)) {
      const knownActions = new Set(TOOL_ACTIONS[toolName] ?? []);

      for (const actionName of actions) {
        if (!knownActions.has(actionName)) {
          staleActions.push(`${toolName}.${actionName}`);
        }
      }
    }

    expect(
      staleActions,
      `RAW_ACTION_METADATA contains stale action keys: ${staleActions.join(', ')}`
    ).toEqual([]);
  });
});
