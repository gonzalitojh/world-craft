import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Pruebas de integración y RLS.
 *
 * Requieren un proyecto Supabase de desarrollo y `DIRECT_URL` en `.env.local`.
 * No se ejecutan en CI ni en `pnpm test`: son locales y comprueban la base de
 * datos real, no mocks.
 *
 * `fileParallelism: false` evita que dos archivos creen usuarios y mundos a la
 * vez y compitan por los mismos fixtures.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(
        new URL('./tests/helpers/server-only-stub.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    setupFiles: ['tests/db/setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    restoreMocks: true,
  },
});
