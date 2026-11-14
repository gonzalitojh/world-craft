import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import eslintConfigPrettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// `eslint-config-next` todavía no es compatible con los peers de ESLint 10, así
// que se aplican los plugins de Next y de React Hooks por separado y solo a
// TypeScript. Prettier va al final para no pelear con reglas de estilo.
const nextRecommended = nextPlugin.configs.recommended;
const reactHooksRecommended = reactHooks.configs.flat.recommended;

export default tseslint.config(
  {
    ignores: [
      '.next/',
      'out/',
      'build/',
      'dist/',
      'coverage/',
      'node_modules/',
      'playwright-report/',
      'test-results/',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      ...nextRecommended.plugins,
      ...reactHooksRecommended.plugins,
    },
    rules: {
      ...nextRecommended.rules,
      ...reactHooksRecommended.rules,
    },
  },
  {
    // Scripts de mantenimiento en Node: usan globals que no existen en el
    // vocabulario del navegador.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
      },
    },
  },
  eslintConfigPrettier,
);
