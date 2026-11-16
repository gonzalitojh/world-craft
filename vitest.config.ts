import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mismo alias que `tsconfig.json` para que los tests importen igual que la
    // aplicación (`@/lib/...`).
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` lanza al importarse fuera de Next; en Vitest se sustituye
      // por un módulo vacío para poder probar los módulos de servidor.
      'server-only': fileURLToPath(
        new URL('./tests/helpers/server-only-stub.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/unit/setup.ts'],
    restoreMocks: true,
  },
});
