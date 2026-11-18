import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

// Tooling del repositorio de escritorio. El scaffold de Electron añadirá los
// plugins de React cuando exista código de renderer; hasta entonces no se
// cargan dependencias que aún no se usan.
export default tseslint.config(
  {
    ignores: [
      'out/',
      'build/',
      'dist/',
      'release/',
      'coverage/',
      'node_modules/',
      'playwright-report/',
      'test-results/',
      // Migraciones SQL de SQLite: no son TypeScript del proyecto y se revisan
      // a mano.
      'drizzle/',
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
