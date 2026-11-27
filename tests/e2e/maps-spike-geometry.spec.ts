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

test('dibuja línea, rectángulo, círculo y arrastra un vértice', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openLab(page);

  const box = await page.locator('.wc-maps-spike__canvas').boundingBox();

  if (box === null) {
    throw new Error('No se pudo medir el lienzo.');
  }

  const point = (x: number, y: number) => ({
    x: box.x + box.width * x,
    y: box.y + box.height * y,
  });
  const click = async (x: number, y: number): Promise<void> => {
    const target = point(x, y);
    await page.mouse.click(target.x, target.y);
  };
  const count = () =>
    page.locator('.wc-maps-spike').getAttribute('data-feature-count');

  await page
    .getByRole('button', { name: messages.mapsSpike.modes.linestring })
    .click();
  await click(0.15, 0.2);
  await click(0.35, 0.25);
  await page.keyboard.press('Enter');
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-layer-count-paths',
    '1',
  );

  await page
    .getByRole('button', { name: messages.mapsSpike.modes.rectangle })
    .click();
  await click(0.55, 0.2);
  await click(0.7, 0.35);
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-layer-count-regions',
    '1',
  );

  await page
    .getByRole('button', { name: messages.mapsSpike.modes.circle })
    .click();
  await click(0.8, 0.2);
  await click(0.92, 0.35);
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-layer-count-regions',
    '2',
  );

  await page
    .getByRole('button', { name: messages.mapsSpike.modes.polygon })
    .click();
  await click(0.3, 0.55);
  await click(0.6, 0.55);
  await click(0.45, 0.8);
  await page.keyboard.press('Enter');
  await expect(page.locator('.wc-maps-spike')).toHaveAttribute(
    'data-layer-count-regions',
    '3',
  );
  expect(await count()).toBe('4');

  await page
    .getByRole('button', { name: messages.mapsSpike.modes.select, exact: true })
    .click();
  await click(0.45, 0.65);
  await page
    .getByRole('tab', { name: messages.mapsSpike.panel.tabs.selection })
    .click();
  await page.locator('.wc-maps-spike__details summary').first().click();

  const before = await page
    .locator('.wc-maps-spike__pre')
    .first()
    .textContent();
  const firstVertex = point(0.3, 0.55);

  await page.mouse.move(firstVertex.x, firstVertex.y);
  await page.mouse.down();
  await page.mouse.move(firstVertex.x + 28, firstVertex.y + 18, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(400);

  const after = await page.locator('.wc-maps-spike__pre').first().textContent();

  expect(after).not.toBe(before);
  expect(await count()).toBe('4');
  expect(
    page.getByRole('heading', { name: '1 elemento seleccionado' }),
  ).toBeVisible();

  await page
    .getByRole('tab', { name: messages.mapsSpike.panel.tabs.export })
    .click();
  await page
    .getByRole('button', { name: messages.mapsSpike.export.actions.png })
    .click();
  await expect(page.getByText(/wc-m2-01-png-[0-9a-f]{8}/).first()).toBeVisible({
    timeout: 30_000,
  });
  await page
    .getByRole('tab', { name: messages.mapsSpike.panel.tabs.selection })
    .click();
  await expect(
    page.getByRole('heading', { name: '1 elemento seleccionado' }),
  ).toBeVisible();
});
