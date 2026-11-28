import type { AxeResults, RunOptions } from 'axe-core';

import { analyzeWithAxe } from './fixtures/axe';
import { expect, test } from './fixtures/electron-app';
import { INTERNAL_MAPS_SPIKE_HASH } from '../../src/renderer/shell/internal-views';
import { es as messages } from '../../src/renderer/messages/es';

const AXE_OPTIONS: RunOptions = {
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  },
};

function expectNoCriticalOrSerious(results: AxeResults, label: string): void {
  expect(results.testEngine.name).toBe('axe-core');
  const serious = results.violations.filter(
    (violation) =>
      violation.impact === 'critical' || violation.impact === 'serious',
  );

  expect(
    serious.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.length,
    })),
    label,
  ).toEqual([]);
}

test('layout, temas, axe y movimiento reducido del laboratorio', async ({
  electronApp,
  page,
}) => {
  test.setTimeout(120_000);
  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, INTERNAL_MAPS_SPIKE_HASH);
  await expect(page.locator('[data-maps-spike-ready="true"]')).toBeVisible({
    timeout: 30_000,
  });

  await expect(page.locator('.wc-maps-spike [role="status"]')).toHaveCount(1);

  const mapCanvas = page.locator('.maplibregl-canvas');

  await expect(mapCanvas).toHaveAttribute(
    'aria-describedby',
    'wc-maps-spike-canvas-help',
  );
  await mapCanvas.focus();
  await expect(mapCanvas).toBeFocused();
  await expect(page.locator('#wc-maps-spike-canvas-help')).toContainText(
    messages.mapsSpike.map.helpMouse,
  );

  const scopedTokens = await page.evaluate(() => {
    const pageRoot = document.querySelector('.wc-maps-spike') as HTMLElement;
    const canvas = document.querySelector(
      '.wc-maps-spike__canvas',
    ) as HTMLElement;

    return {
      own: getComputedStyle(pageRoot).getPropertyValue('--spike-region').trim(),
      inherited: getComputedStyle(canvas)
        .getPropertyValue('--spike-region')
        .trim(),
    };
  });

  expect(scopedTokens.own).toMatch(/^#/);
  expect(scopedTokens.inherited).toBe(scopedTokens.own);

  for (const theme of ['light', 'dark'] as const) {
    if (theme === 'dark') {
      await page.getByRole('button', { name: /Cambiar el tema/ }).click();
      await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
        'data-map-theme',
        'dark',
      );
    }

    for (const width of [1024, 1280, 1600]) {
      const height = width === 1024 ? 700 : width === 1280 ? 800 : 900;
      await electronApp.evaluate(
        ({ BrowserWindow }, size) => {
          BrowserWindow.getAllWindows()[0]?.setContentSize(
            size.width,
            size.height,
          );
        },
        { width, height },
      );
      await page.waitForTimeout(200);

      const layout = await page.evaluate(() => {
        const workbench = document.querySelector(
          '.wc-maps-spike__workbench',
        ) as HTMLElement;
        const frame = document.querySelector(
          '.wc-maps-spike__canvas-frame',
        ) as HTMLElement;
        const panel = document.querySelector(
          '.wc-maps-spike__panel',
        ) as HTMLElement;
        const tabsPanel = document.querySelector(
          '.wc-maps-spike__panel .wc-tabs__panel',
        ) as HTMLElement;

        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          columns: getComputedStyle(workbench).gridTemplateColumns,
          frameHeight: frame.getBoundingClientRect().height,
          panelHeight: panel.getBoundingClientRect().height,
          panelOverflow: getComputedStyle(tabsPanel).overflowY,
        };
      });

      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);

      if (width <= 1180) {
        expect(layout.columns.split(' ')).toHaveLength(1);
        expect(layout.frameHeight).toBeGreaterThanOrEqual(288);
        expect(layout.panelOverflow).toBe('visible');
      } else {
        expect(layout.columns.split(' ').length).toBeGreaterThanOrEqual(2);
        expect(layout.panelOverflow).toBe('auto');
        expect(layout.panelHeight).toBeLessThanOrEqual(544);
      }
    }

    const axe = await analyzeWithAxe(page, AXE_OPTIONS);
    expectNoCriticalOrSerious(axe, `axe ${theme}`);
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(
    page.getByRole('button', { name: /Ajustar la vista/ }),
  ).toBeDisabled();

  await page
    .getByRole('button', { name: 'Cargar 500 de prueba' })
    .first()
    .click();
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-feature-count',
    '500',
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: /Ajustar la vista/ }).click();
  await expect(page.locator('[data-maps-spike-ready="true"]')).toBeVisible();

  await electronApp.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1024, 700);
  });
  await page.waitForTimeout(250);

  const denseLayout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    columns: getComputedStyle(
      document.querySelector('.wc-maps-spike__workbench') as Element,
    ).gridTemplateColumns,
  }));

  expect(denseLayout.scrollWidth).toBeLessThanOrEqual(denseLayout.clientWidth);
  expect(denseLayout.columns.split(' ')).toHaveLength(1);

  const targets = [
    messages.mapsSpike.modes.point,
    messages.mapsSpike.modes.linestring,
    messages.mapsSpike.modes.polygon,
    messages.mapsSpike.modes.rectangle,
    messages.mapsSpike.modes.circle,
    messages.mapsSpike.modes.select,
    messages.mapsSpike.toolbar.delete,
    messages.mapsSpike.toolbar.clear,
    messages.mapsSpike.layers.load500,
    messages.mapsSpike.layers.import,
    messages.mapsSpike.map.fit,
  ];

  for (const label of targets) {
    const box = await page
      .getByRole('button', { name: label, exact: true })
      .first()
      .boundingBox();
    expect(box, label).not.toBeNull();
    expect(box?.height ?? 0, label).toBeGreaterThanOrEqual(31.5);
  }

  for (const label of [
    messages.mapsSpike.panel.tabs.layers,
    messages.mapsSpike.panel.tabs.selection,
    messages.mapsSpike.panel.tabs.export,
  ]) {
    const box = await page
      .getByRole('tab', { name: label, exact: true })
      .boundingBox();
    expect(box, label).not.toBeNull();
    expect(box?.height ?? 0, label).toBeGreaterThanOrEqual(31.5);
  }

  const fitBox = await page
    .getByRole('button', { name: messages.mapsSpike.map.fit, exact: true })
    .boundingBox();
  expect(fitBox?.width ?? 0).toBeGreaterThanOrEqual(31.5);
  expect(fitBox?.height ?? 0).toBeGreaterThanOrEqual(31.5);

  await page
    .getByRole('tab', { name: messages.mapsSpike.panel.tabs.export })
    .click();

  for (const label of [
    messages.mapsSpike.export.actions.svg,
    messages.mapsSpike.export.actions.png,
    messages.mapsSpike.export.actions.geojson,
  ]) {
    const box = await page
      .getByRole('button', { name: label, exact: true })
      .boundingBox();
    expect(box, label).not.toBeNull();
    expect(box?.height ?? 0, label).toBeGreaterThanOrEqual(31.5);
  }

  await page
    .getByRole('tab', { name: messages.mapsSpike.panel.tabs.selection })
    .click();
  const measureBox = await page
    .getByRole('button', {
      name: messages.mapsSpike.metrics.measure,
      exact: true,
    })
    .boundingBox();
  expect(measureBox?.height ?? 0).toBeGreaterThanOrEqual(31.5);

  const axeWithData = await analyzeWithAxe(page, AXE_OPTIONS);
  expectNoCriticalOrSerious(axeWithData, 'axe con datos y movimiento reducido');
});
