import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      'dist/',
      'node_modules/',
      'coverage/',
      'docs/.vitepress/',
      'scripts/demo/',
      'scripts/measure-*.ts',
      'scripts/generate-metadata.ts',
      'src/__tests__/**',
      'src/services/discovery-client.ts',
      'src/services/schema-cache.ts',
      'src/services/schema-validator.ts',
      'src/cli/schema-manager.ts',
      'src/utils/google-api-inspector.ts',
      'src/utils/protocol-tracer.ts',
      'src/utils/request-replay.ts',
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // Use a dedicated TSConfig for ESLint so test files are included.
        // The main tsconfig.json intentionally excludes tests.
        project: './tsconfig.eslint.json',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        NodeJS: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        AbortSignal: 'readonly',
        AbortController: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...eslint.configs.recommended.rules,
      'no-unused-vars': 'off', // Disable base rule as it can report incorrect errors
      'no-undef': 'off', // Disable base rule as TypeScript handles this
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],
    },
  },
  {
    // CLI tool: Allow 'any' types (warnings acceptable per CLAUDE.md)
    files: ['src/cli.ts', 'src/cli/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'warn',
    },
  },
  {
    // Data handler: Consolidated from values+cells, works with dynamic cell data
    files: ['src/handlers/data.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'warn',
    },
  },
];
