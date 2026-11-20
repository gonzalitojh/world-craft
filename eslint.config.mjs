import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Tooling del repositorio de escritorio.
 *
 * El renderer es la frontera de confianza más estricta: solo conoce globals de
 * navegador y tiene prohibido importar Electron, Node o módulos del proceso
 * principal. main, preload, tests y configuración corren en Node.
 */
const nodeFiles = [
  'src/main/**/*.ts',
  'src/preload/**/*.ts',
  'tests/**/*.ts',
  'scripts/**/*.mjs',
  '*.config.ts',
  'electron.vite.config.ts',
  'vitest.config.ts',
];

const rendererFiles = ['src/renderer/**/*.{ts,tsx}'];

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
    files: nodeFiles,
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Solo las pruebas que mezclan Node y navegador necesitan ambos globals:
    // componentes (jsdom) y E2E (`page.evaluate`). Las unitarias y de
    // integración siguen con globals de Node.
    files: ['tests/components/**/*.{ts,tsx}', 'tests/e2e/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    // electron-builder carga la configuración en CommonJS; `require` y
    // `module.exports` son la interfaz que espera.
    files: ['electron-builder.config.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // La capa de datos, las copias y la lógica pura del modo seguro deben poder
    // probarse sin Electron. La composición (userData, diálogos, ciclo de vida)
    // vive en `src/main/persistence.ts`, `src/main/safe-mode-dialog.ts` y
    // `src/main/safe-mode-recovery.ts`.
    files: [
      'src/main/db/**/*.ts',
      'src/main/backup/**/*.ts',
      'src/main/safe-mode-prompt.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'electron',
              message:
                'La capa de datos y el prompt puro no importan Electron; reciben puertos o rutas ya resueltas.',
            },
          ],
          patterns: [
            {
              group: ['electron/*'],
              message:
                'La capa de datos y el prompt puro no importan Electron; reciben puertos o rutas ya resueltas.',
            },
          ],
        },
      ],
    },
  },
  {
    files: rendererFiles,
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      'no-restricted-globals': [
        'error',
        {
          name: 'require',
          message:
            'El renderer no puede usar require; usa la API tipada de window.worldCraft.',
        },
        {
          name: 'process',
          message:
            'El renderer no accede a process; la información llega por el preload.',
        },
        {
          name: 'Buffer',
          message: 'El renderer no accede a Buffer; no tiene Node habilitado.',
        },
        {
          name: '__dirname',
          message: 'El renderer no conoce rutas del sistema de archivos.',
        },
        {
          name: '__filename',
          message: 'El renderer no conoce rutas del sistema de archivos.',
        },
        {
          name: 'module',
          message: 'El renderer no tiene módulos CommonJS de Node.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'electron',
              message:
                'El renderer no importa Electron; usa window.worldCraft expuesto por el preload.',
            },
            {
              name: 'fs',
              message: 'El renderer no tiene acceso al sistema de archivos.',
            },
            {
              name: 'path',
              message: 'El renderer no conoce rutas del sistema de archivos.',
            },
            {
              name: 'child_process',
              message: 'El renderer no puede ejecutar procesos del sistema.',
            },
            {
              name: 'better-sqlite3',
              message:
                'La base de datos solo se usa en el proceso principal (ADR 0002).',
            },
          ],
          patterns: [
            {
              group: ['node:*'],
              message: 'El renderer no tiene módulos de Node.',
            },
            {
              group: ['@/main', '@/main/*', '@/preload', '@/preload/*'],
              message:
                'El renderer no importa código de main ni del preload; comparte contratos desde shared.',
            },
            {
              group: [
                '../main/*',
                '../**/main/*',
                '../preload/*',
                '../**/preload/*',
              ],
              message:
                'El renderer no importa código de main ni del preload; comparte contratos desde shared.',
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
);
