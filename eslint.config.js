import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.svelte-kit/**',
      '.wrangler/**',
      'dist/**',
      'node_modules/**',
      'terraform/.terraform/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  eslintConfigPrettier,
  {
    files: ['**/*.{ts,svelte}'],
    rules: {
      // TypeScript and svelte-check own name resolution for these files.
      'no-undef': 'off'
    }
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser
      }
    },
    rules: {
      'svelte/no-navigation-without-resolve': 'off'
    }
  }
);
