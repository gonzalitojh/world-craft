import { expect, test } from '@playwright/test';

import { es } from '../../src/messages/es';

const viewports = [
  { name: 'móvil', width: 360, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'escritorio', width: 1280, height: 800 },
];

const routes = ['/', '/login', '/health', '/esta-ruta-no-existe'];

for (const viewport of viewports) {
  test(`sin scroll horizontal ni desbordes a ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });

    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));

      expect(
        metrics.scrollWidth,
        `scroll horizontal en ${route} a ${viewport.width}px`,
      ).toBeLessThanOrEqual(metrics.innerWidth);
    }
  });
}

test('los botones se apilan en móvil y se alinean en escritorio', async ({
  page,
}) => {
  const primary = () => page.getByRole('link', { name: es.home.primaryAction });
  const secondary = () =>
    page.getByRole('link', { name: es.home.secondaryAction });

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');

  const mobilePrimary = await primary().boundingBox();
  const mobileSecondary = await secondary().boundingBox();

  expect(mobilePrimary).not.toBeNull();
  expect(mobileSecondary).not.toBeNull();
  if (mobilePrimary && mobileSecondary) {
    expect(mobileSecondary.y).toBeGreaterThan(mobilePrimary.y);
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');

  const desktopPrimary = await primary().boundingBox();
  const desktopSecondary = await secondary().boundingBox();

  if (desktopPrimary && desktopSecondary) {
    expect(Math.abs(desktopPrimary.y - desktopSecondary.y)).toBeLessThan(4);
  }
});

test('el título largo envuelve sin desbordar en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');

  const title = page.getByRole('heading', { level: 1, name: es.home.title });
  const box = await title.boundingBox();

  expect(box).not.toBeNull();
  if (box) {
    expect(box.width).toBeLessThanOrEqual(360);
    // Un título de una sola línea desbordaría: comprobamos que ocupa varias.
    expect(box.height).toBeGreaterThan(48);
  }
});
