import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.e2e-fixture/**',
      '.react-router/**',
      '.svelte-kit/**',
      '.worktrees/**',
      'build/**',
      '.wrangler/**',
      'dist/**',
      'docs/**',
      'e2e/**/*.html',
      '**/*.html',
      'node_modules/**',
      'playwright-report/**',
      'terraform/.terraform/**',
      'test-results/**'
    ]
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, eslintConfigPrettier],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      'no-undef': 'off'
    }
  }
);
