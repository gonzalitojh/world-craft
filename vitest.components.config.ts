import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Pruebas de componentes del renderer con Testing Library.
 *
 * El entorno es `jsdom` y el setup extiende `expect` con los matchers de
 * jest-dom. Las pruebas viven en `tests/components/` y no abren Electron: la
 * ventana real se cubre en `tests/e2e/` con Playwright.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/components/**/*.test.tsx'],
    setupFiles: ['tests/setup/components.ts'],
    restoreMocks: true,
  },
});
