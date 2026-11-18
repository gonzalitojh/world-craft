import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Pruebas de integración de persistencia.
 *
 * Cada archivo usa su propia base en `os.tmpdir()`. Se ejecutan en procesos
 * separados (`pool: 'forks'`) y sin paralelismo entre archivos para que el
 * módulo nativo y los bloqueos de SQLite no interfieran.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
    restoreMocks: true,
  },
});
