import { defineConfig } from '@playwright/test';

/**
 * Pruebas E2E de escritorio.
 *
 * Playwright abre el binario de Electron con el build de `out/` y un
 * `--user-data-dir` temporal por prueba (ver `tests/e2e/fixtures`). No usa
 * navegadores descargados ni red: solo la aplicación real. Se ejecutan en serie
 * porque cada instancia bloquea su propio `userData` y las pruebas comparten la
 * pantalla del runner.
 *
 * No forman parte de la CI de cada PR (ver `docs/calidad/plan-de-pruebas.md`):
 * se ejecutan antes de `review`, en local, y en la build de release de M5.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env.CI === 'true',
  retries: process.env.CI === 'true' ? 1 : 0,
  reporter: process.env.CI === 'true' ? 'github' : 'list',
  outputDir: 'test-results/e2e',
  use: {
    trace: 'retain-on-failure',
    video: 'off',
    screenshot: 'only-on-failure',
  },
});
