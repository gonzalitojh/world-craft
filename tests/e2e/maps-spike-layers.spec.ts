import { test, expect } from './fixtures/electron-app';
import type { Page } from '@playwright/test';

import { INTERNAL_MAPS_SPIKE_HASH } from '../../src/renderer/shell/internal-views';
import { es as messages } from '../../src/renderer/messages/es';

async function openLab(page: Page): Promise<void> {
  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, INTERNAL_MAPS_SPIKE_HASH);
  await expect(page.locator('[data-maps-spike-ready="true"]')).toBeVisible({
    timeout: 30_000,
  });
}

test('importación atómica, capas ocultas y vaciado confirmado', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openLab(page);

  await expect(
    page.getByRole('checkbox', { name: 'Mostrar Regiones', exact: true }),
  ).toHaveAttribute('aria-describedby', 'wc-maps-spike-layer-count-regions');

  await page
    .getByRole('button', { name: messages.mapsSpike.layers.load500 })
    .first()
    .click();
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-feature-count',
    '500',
    { timeout: 30_000 },
  );

  for (const layer of ['Regiones', 'Caminos', 'Lugares']) {
    await page
      .getByRole('checkbox', { name: new RegExp(`Mostrar ${layer}`) })
      .uncheck();
  }

  await expect(page.getByText(messages.mapsSpike.map.allHidden)).toBeVisible();
  await page
    .getByRole('tab', { name: messages.mapsSpike.panel.tabs.export })
    .click();
  await expect(
    page.getByRole('button', { name: messages.mapsSpike.export.actions.svg }),
  ).toBeDisabled();
  await expect(
    page.getByText(messages.mapsSpike.export.hiddenHint),
  ).toBeVisible();

  await page
    .getByRole('tab', { name: messages.mapsSpike.panel.tabs.layers })
    .click();

  for (const layer of ['Regiones', 'Caminos', 'Lugares']) {
    await page
      .getByRole('checkbox', { name: new RegExp(`Mostrar ${layer}`) })
      .check();
  }

  const input = page.locator('input[type=file]');

  await input.setInputFiles({
    name: 'invalido.geojson',
    mimeType: 'application/geo+json',
    buffer: Buffer.from(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [1, 2] },
            properties: { layer: 'oceanos', mode: 'point' },
          },
        ],
      }),
    ),
  });
  await expect(page.getByRole('alert')).toContainText(
    'No se ha importado nada',
  );
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-feature-count',
    '500',
  );

  const holeFile = {
    name: 'con-agujero.geojson',
    mimeType: 'application/geo+json',
    buffer: Buffer.from(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [4, 0],
                  [4, 4],
                  [0, 4],
                  [0, 0],
                ],
                [
                  [1, 1],
                  [1, 3],
                  [3, 3],
                  [3, 1],
                  [1, 1],
                ],
              ],
            },
            properties: { layer: 'regions', mode: 'polygon' },
          },
        ],
      }),
    ),
  };
  await input.setInputFiles(holeFile);
  await expect(page.getByRole('alert')).toContainText('agujeros');
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-feature-count',
    '500',
  );

  const mixedFile = {
    name: 'mixta.geojson',
    mimeType: 'application/geo+json',
    buffer: Buffer.from(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [3, 4] },
            properties: { mode: 'point' },
          },
          {
            // El parser la acepta, pero Terra Draw la rechaza por precisión:
            // sirve para probar que se revierte el lote entero.
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [1.123456789, 2.123456789],
            },
            properties: { mode: 'point' },
          },
        ],
      }),
    ),
  };
  await input.setInputFiles(mixedFile);
  await expect(page.getByRole('alert')).toContainText(
    'No se pudieron añadir todos',
  );
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-feature-count',
    '500',
  );
  await expect(page.getByText(/elementos importados/)).toHaveCount(0);

  await input.setInputFiles({
    name: 'un-punto.geojson',
    mimeType: 'application/geo+json',
    buffer: Buffer.from(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [3, 4] },
            properties: { mode: 'point' },
          },
        ],
      }),
    ),
  });
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-feature-count',
    '501',
  );

  await page
    .getByRole('button', { name: messages.mapsSpike.layers.load500 })
    .click();
  const replaceDialog = page.getByRole('dialog');
  await expect(replaceDialog).toBeVisible();
  await expect(
    replaceDialog.getByRole('button', {
      name: messages.mapsSpike.dialog.cancel,
    }),
  ).toBeFocused();
  await replaceDialog
    .getByRole('button', { name: messages.mapsSpike.dialog.replaceConfirm })
    .click();
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-feature-count',
    '500',
    { timeout: 30_000 },
  );

  await page
    .getByRole('button', { name: messages.mapsSpike.toolbar.clear })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: messages.mapsSpike.dialog.cancel }),
  ).toBeFocused();
  await dialog
    .getByRole('button', { name: messages.mapsSpike.dialog.clearConfirm })
    .click();
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-feature-count',
    '0',
  );
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-metrics-state',
    'idle',
  );
  await expect(
    page.getByRole('button', { name: messages.mapsSpike.modes.point }),
  ).toBeFocused();
});
