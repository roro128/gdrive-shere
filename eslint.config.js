import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.react-router/**',
      '.svelte-kit/**',
      'build/**',
      '.wrangler/**',
      'dist/**',
      'node_modules/**',
      'terraform/.terraform/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-undef': 'off'
    }
  }
);
