import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/electron-app';
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

async function canvasBox(page: Page) {
  const box = await page.locator('.wc-maps-spike__canvas').boundingBox();

  if (box === null) {
    throw new Error('No se pudo medir el lienzo.');
  }

  return box;
}

test('flujo completo del laboratorio: dibujo, 500, métricas y exportación', async ({
  page,
  userDataDir,
}) => {
  test.setTimeout(180_000);
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

  await openLab(page);

  await expect(
    page.getByRole('heading', {
      level: 2,
      name: messages.mapsSpike.banner.title,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: messages.mapsSpike.modes.select }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-feature-count',
    '0',
  );

  const box = await canvasBox(page);

  await page
    .getByRole('button', { name: messages.mapsSpike.modes.point })
    .click();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-feature-count',
    '1',
  );
  await expect(page.locator('[data-layer-count-places="1"]')).toBeVisible();

  await page
    .getByRole('button', { name: messages.mapsSpike.modes.select })
    .click();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page
    .getByRole('tab', { name: messages.mapsSpike.panel.tabs.selection })
    .click();
  await expect(
    page.getByRole('heading', { name: '1 elemento seleccionado' }),
  ).toBeVisible();

  await page.getByRole('button', { name: /Cambiar el tema/ }).click();
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-map-theme',
    'dark',
  );
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-feature-count',
    '1',
  );
  await expect(
    page.getByRole('heading', { name: '1 elemento seleccionado' }),
  ).toBeVisible();

  // Ocultar la capa seleccionada limpia la selección.
  await page
    .getByRole('tab', { name: messages.mapsSpike.panel.tabs.layers })
    .click();
  await page.getByRole('checkbox', { name: /Mostrar Lugares/ }).uncheck();
  await page
    .getByRole('tab', { name: messages.mapsSpike.panel.tabs.selection })
    .click();
  await expect(
    page.getByRole('heading', {
      name: messages.mapsSpike.selection.emptyTitle,
    }),
  ).toBeVisible();

  await page
    .getByRole('tab', { name: messages.mapsSpike.panel.tabs.layers })
    .click();
  await page.getByRole('checkbox', { name: /Mostrar Lugares/ }).check();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page
    .getByRole('tab', { name: messages.mapsSpike.panel.tabs.selection })
    .click();
  await expect(
    page.getByRole('heading', { name: '1 elemento seleccionado' }),
  ).toBeVisible();

  await page
    .getByRole('button', { name: messages.mapsSpike.toolbar.delete })
    .click();
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-feature-count',
    '0',
  );
  await expect(
    page.getByRole('button', {
      name: messages.mapsSpike.modes.select,
      exact: true,
    }),
  ).toBeFocused();

  await page
    .getByRole('tab', { name: messages.mapsSpike.panel.tabs.layers })
    .click();
  await page
    .getByRole('button', { name: messages.mapsSpike.layers.load500 })
    .first()
    .click();
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-feature-count',
    '500',
    { timeout: 30_000 },
  );
  await expect(page.locator('[data-layer-count-regions="250"]')).toBeVisible();
  await expect(page.locator('[data-layer-count-paths="170"]')).toBeVisible();
  await expect(page.locator('[data-layer-count-places="80"]')).toBeVisible();

  await page
    .getByRole('button', { name: messages.mapsSpike.modes.polygon })
    .click();
  const points = [
    [0.3, 0.3],
    [0.65, 0.3],
    [0.5, 0.65],
  ] as const;

  for (const [x, y] of points) {
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  }

  await page.keyboard.press('Enter');
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-layer-count-regions',
    '251',
  );

  await page
    .getByRole('tab', { name: messages.mapsSpike.panel.tabs.selection })
    .click();
  await page
    .getByRole('button', { name: messages.mapsSpike.metrics.measure })
    .click();
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-metrics-state',
    'ready',
    { timeout: 30_000 },
  );
  await expect(page.getByText(messages.mapsSpike.metrics.pan)).toBeVisible();
  await expect(page.getByText(messages.mapsSpike.metrics.svg)).toBeVisible();
  await expect(page.getByText(messages.mapsSpike.metrics.png)).toBeVisible();
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-feature-count',
    '501',
  );

  await page
    .getByRole('button', { name: messages.mapsSpike.metrics.reportJson })
    .click();
  await expect(page.getByText(/wc-m2-01-json-[0-9a-f]{8}/).first()).toBeVisible(
    { timeout: 30_000 },
  );
  await page
    .getByRole('button', { name: messages.mapsSpike.metrics.reportMarkdown })
    .click();
  await expect(
    page.getByText(/wc-m2-01-markdown-[0-9a-f]{8}/).first(),
  ).toBeVisible({ timeout: 30_000 });

  await page
    .getByRole('tab', { name: messages.mapsSpike.panel.tabs.export })
    .click();
  for (const kind of ['svg', 'png', 'geojson'] as const) {
    await page
      .getByRole('button', { name: messages.mapsSpike.export.actions[kind] })
      .click();
    await expect(
      page.getByText(new RegExp(`wc-m2-01-${kind}-[0-9a-f]{8}`)).first(),
    ).toBeVisible({ timeout: 30_000 });
  }

  const files = await readdir(join(userDataDir, 'data', 'spike-maps'));
  const svg = files.find((file) => /^wc-m2-01-svg-.*\.svg$/.test(file));
  const png = files.find((file) => /^wc-m2-01-png-.*\.png$/.test(file));
  const geojson = files.find((file) =>
    /^wc-m2-01-geojson-.*\.geojson$/.test(file),
  );
  const reportJson = files.find((file) =>
    /^wc-m2-01-json-.*\.json$/.test(file),
  );
  const reportMarkdown = files.find((file) =>
    /^wc-m2-01-markdown-.*\.md$/.test(file),
  );

  expect(svg).toBeDefined();
  expect(png).toBeDefined();
  expect(geojson).toBeDefined();
  expect(reportJson).toBeDefined();
  expect(reportMarkdown).toBeDefined();

  const svgText = await readFile(
    join(userDataDir, 'data', 'spike-maps', svg as string),
    'utf8',
  );
  const geojsonText = await readFile(
    join(userDataDir, 'data', 'spike-maps', geojson as string),
    'utf8',
  );
  const pngBytes = await readFile(
    join(userDataDir, 'data', 'spike-maps', png as string),
  );
  const reportJsonText = await readFile(
    join(userDataDir, 'data', 'spike-maps', reportJson as string),
    'utf8',
  );
  const reportMarkdownText = await readFile(
    join(userDataDir, 'data', 'spike-maps', reportMarkdown as string),
    'utf8',
  );
  const report = JSON.parse(reportJsonText) as {
    readonly limitations: readonly string[];
    readonly medians: { readonly loadMs: number | null };
  };

  expect(report.limitations).toHaveLength(3);
  expect(report.limitations.join(' ')).toContain('feature temporal');
  expect(report.medians.loadMs).not.toBeNull();
  expect(reportMarkdownText).toContain('## Limitaciones de la medición');
  expect(reportMarkdownText).toContain('Carga inicial');

  expect(svgText).toContain('<svg');
  expect(svgText).not.toContain('<script');
  expect(geojsonText).toContain('"type": "FeatureCollection"');
  expect(JSON.parse(geojsonText).features.length).toBe(501);
  expect(pngBytes.length).toBeGreaterThan(1000);
  expect(pngBytes.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );

  // El GeoJSON exportado se puede reimportar tal cual y se añade a lo actual.
  await page
    .getByRole('tab', { name: messages.mapsSpike.panel.tabs.layers })
    .click();
  await page
    .locator('input[type=file]')
    .setInputFiles(join(userDataDir, 'data', 'spike-maps', geojson as string));
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-feature-count',
    '1002',
    { timeout: 30_000 },
  );

  expect(httpRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
