import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'coverage/**', '**/dist/**', '**/coverage/**', 'node_modules/**'],
  },
  {
    files: [
      'src/**/*.ts',
      'tests/**/*.ts',
      'apps/**/*.ts',
      'packages/**/*.ts',
      'vite.config.ts',
      'apps/**/vite.config.ts',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
];
