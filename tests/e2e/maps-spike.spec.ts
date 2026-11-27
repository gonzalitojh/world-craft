import { expect, test } from './fixtures/electron-app';

import { es as messages } from '../../src/renderer/messages/es';
import { INTERNAL_MAPS_SPIKE_HASH } from '../../src/renderer/shell/internal-views';

/**
 * Puerta técnica del spike de mapas (#80).
 *
 * Abre el laboratorio interno sobre el build real (`out/`), con la CSP de
 * producción y sin red, y exige que MapLibre y Terra Draw lleguen a estado
 * listo. También comprueba que no hay peticiones HTTP ni errores de consola:
 * una violación de CSP aparecería como error del renderer.
 */
test('el laboratorio de mapas arranca con worker local y sin red', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const httpRequests: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('request', (request) => {
    if (/^https?:/i.test(request.url())) {
      httpRequests.push(request.url());
    }
  });

  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, INTERNAL_MAPS_SPIKE_HASH);

  await expect(
    page.getByText(messages.mapsSpike.banner.title, { exact: true }),
  ).toBeVisible();

  await expect(page.locator('[data-maps-spike-ready="true"]')).toBeVisible({
    timeout: 30_000,
  });

  await expect(
    page.getByText(messages.mapsSpike.status.ready, { exact: true }),
  ).toBeVisible();

  // Deja margen a los errores asíncronos del worker y confirma que MapLibre
  // arrancó su worker local, no un fallback remoto ni un `data:`.
  await page.waitForTimeout(500);

  const workers = page.workers();

  expect(workers.length).toBeGreaterThan(0);
  expect(workers[0]?.url()).toMatch(/maplibre-gl-worker-[\w-]+\.js$/);
  await expect(page.locator('.maplibregl-canvas')).toHaveCount(1);

  const preferences = await page.evaluate(() =>
    window.worldCraft.preferences.get(),
  );

  expect(preferences.ok && preferences.data.lastView).toBe('home');
  expect(httpRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
