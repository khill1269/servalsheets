import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import boundariesPlugin from 'eslint-plugin-boundaries';

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
    // Architectural boundaries enforcement
    files: ['src/**/*.ts'],
    plugins: {
      boundaries: boundariesPlugin,
    },
    settings: {
      'boundaries/elements': [
        { type: 'entrypoint', pattern: 'src/(cli|server|http-server|remote-server).ts' },
        { type: 'handler', pattern: 'src/handlers/*' },
        { type: 'service', pattern: 'src/services/*' },
        { type: 'schema', pattern: 'src/schemas/*' },
        { type: 'util', pattern: 'src/utils/*' },
        { type: 'mcp', pattern: 'src/mcp/*' },
        { type: 'config', pattern: 'src/config/*' },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              from: ['entrypoint'],
              allow: ['handler', 'service', 'schema', 'mcp', 'config', 'util'],
            },
            {
              from: ['handler'],
              allow: ['service', 'schema', 'util', 'config'],
            },
            {
              from: ['service'],
              allow: ['schema', 'util', 'config'],
              disallow: ['handler'],
            },
            {
              from: ['schema'],
              allow: ['util'],
            },
            {
              from: ['mcp'],
              allow: ['handler', 'service', 'schema', 'util', 'config'],
            },
          ],
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
  {
    // Utility scripts: Allow console.log for CLI output
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
];
